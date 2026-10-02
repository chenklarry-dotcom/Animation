// Renders the film frame-by-frame in headless Chromium and encodes an MP4.
//
//   node render/render.mjs                         # full 1080x1920 @ 60 fps
//   node render/render.mjs --from 6 --to 8         # a slice (handy for checks)
//   node render/render.mjs --fps 30 --crf 22 --out out/preview.mp4
//   node render/render.mjs --audio media/soundtrack.wav
//
// Each worker is its own Chromium instance rendering a contiguous chunk of
// frames. Pages POST raw RGBA pixels to a loopback server, which pipes them
// into a per-worker lossless ffmpeg segment; segments are then joined and
// encoded once (H.264 High, BT.709, yuv420p, faststart).
//
// Options: --fps --from --to --workers --crf --out --audio --keep
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { serve } from './serve.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function args() {
  const a = process.argv.slice(2);
  const o = {};
  for (let i = 0; i < a.length; i++) {
    if (!a[i].startsWith('--')) continue;
    const k = a[i].slice(2);
    o[k] = a[i + 1] && !a[i + 1].startsWith('--') ? a[++i] : true;
  }
  return o;
}

async function loadPlaywright() {
  try {
    return await import('playwright');
  } catch {
    const { execSync } = await import('node:child_process');
    const root = execSync('npm root -g').toString().trim();
    return await import(path.join(root, 'playwright', 'index.mjs'));
  }
}

function ffmpeg(argv, stdin = 'ignore') {
  const p = spawn('ffmpeg', argv, { stdio: [stdin, 'inherit', 'inherit'] });
  p.done = new Promise((resolve, reject) => {
    p.on('error', reject);
    p.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg exited with ${code}`))));
  });
  return p;
}

const opt = args();
const FPS = Number(opt.fps || 60);
const from = Number(opt.from || 0);
const to = Number(opt.to || 26);
const crf = String(opt.crf || 17);
const out = path.resolve(ROOT, opt.out || 'out/how-to-drink-bottled-water.mp4');
const work = path.resolve(ROOT, 'out/segments');
const audio = opt.audio ? path.resolve(ROOT, opt.audio) : null;
const W = 1080, H = 1920;

const first = Math.round(from * FPS);
const total = Math.round(to * FPS) - first;
const workers = Math.max(1, Math.min(Number(opt.workers || Math.min(4, os.cpus().length)), total));
fs.rmSync(work, { recursive: true, force: true });
fs.mkdirSync(work, { recursive: true });
fs.mkdirSync(path.dirname(out), { recursive: true });

// contiguous chunks, one lossless segment per worker
const chunk = Math.ceil(total / workers);
const segs = Array.from({ length: workers }, (_, k) => {
  const a = first + k * chunk, b = Math.min(first + total, a + chunk);
  const file = path.join(work, `seg_${k}.mkv`);
  const ff = ffmpeg(
    ['-y', '-hide_banner', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${W}x${H}`, '-r', String(FPS),
      '-i', 'pipe:0', '-c:v', 'libx264rgb', '-qp', '0', '-preset', 'ultrafast', file],
    'pipe'
  );
  return { a, b, file, ff };
});

let done = 0;
const t0 = Date.now();
function onPost(req, res) {
  const k = Number(new URL(req.url, 'http://x').searchParams.get('w'));
  const stdin = segs[k].ff.stdin;
  req.on('data', (c) => {
    if (!stdin.write(c)) {
      req.pause();
      stdin.once('drain', () => req.resume());
    }
  });
  req.on('end', () => {
    res.writeHead(200).end('ok');
    done++;
    if (done % 30 === 0 || done === total) {
      const s = (Date.now() - t0) / 1000;
      process.stdout.write(`\r  ${done}/${total} frames  ${(done / s).toFixed(1)} fps  eta ${Math.max(0, (total - done) / (done / s)).toFixed(0)}s   `);
    }
  });
}

const { chromium } = await loadPlaywright();
const server = await serve(0, onPost);
const base = `http://127.0.0.1:${server.address().port}`;
console.log(`Rendering ${total} frames (${from}s -> ${to}s @ ${FPS} fps) with ${workers} workers`);

async function worker(k) {
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || undefined,
    // CPU-rasterised 2D canvas is ~10x faster than SwiftShader GPU canvas;
    // WebGL (SwiftShader) is only used for the distortion frames.
    args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--disable-accelerated-2d-canvas'],
  });
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  page.on('pageerror', (e) => console.error(`\n[worker ${k}]`, e.message));
  await page.goto(`${base}/index.html?render`);
  await page.evaluate(() => window.ready);
  const { a, b } = segs[k];
  for (let i = a; i < b; i++) {
    await page.evaluate(([t, url]) => window.renderAndSend(t, url), [i / FPS, `${base}/frame?w=${k}`]);
  }
  await browser.close();
  segs[k].ff.stdin.end();
  await segs[k].ff.done;
}
await Promise.all(segs.map((_, k) => worker(k)));
server.close();
console.log(`\nFrames done in ${((Date.now() - t0) / 1000).toFixed(1)}s`);

const list = path.join(work, 'list.txt');
fs.writeFileSync(list, segs.map((s) => `file '${s.file}'`).join('\n') + '\n');
const argv = ['-y', '-hide_banner', '-loglevel', 'error', '-stats', '-f', 'concat', '-safe', '0', '-i', list];
if (audio) argv.push('-ss', String(from), '-t', String(to - from), '-i', audio);
argv.push(
  '-map', '0:v:0',
  '-vf', 'scale=out_color_matrix=bt709:out_range=tv,format=yuv420p',
  '-c:v', 'libx264', '-preset', 'slow', '-tune', 'animation', '-crf', crf,
  '-profile:v', 'high', '-level', '4.2',
  '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv',
  '-g', String(FPS * 2), '-r', String(FPS), '-movflags', '+faststart'
);
if (audio) argv.push('-map', '1:a:0', '-c:a', 'aac', '-b:a', '192k', '-ar', '48000');
argv.push(out);
console.log('Encoding', path.relative(ROOT, out));
await ffmpeg(argv).done;
console.log('Wrote', path.relative(ROOT, out), `(${(fs.statSync(out).size / 1e6).toFixed(1)} MB)`);
if (!opt.keep) fs.rmSync(work, { recursive: true, force: true });

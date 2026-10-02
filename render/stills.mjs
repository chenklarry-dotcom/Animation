// Renders individual frames to PNG (plus a contact sheet) for quick review.
//
//   node render/stills.mjs out/stills 0.9 4.5 11.6 17.5
//   node render/stills.mjs out/stills --range 6.3 7.3 0.1
//
// The contact sheet needs ImageMagick's `montage` (skipped if missing).
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { serve } from './serve.mjs';

async function loadPlaywright() {
  try {
    return await import('playwright');
  } catch {
    const root = execFileSync('npm', ['root', '-g']).toString().trim();
    return await import(path.join(root, 'playwright', 'index.mjs'));
  }
}

const [, , outDir, ...rest] = process.argv;
if (!outDir || !rest.length) {
  console.error('usage: node render/stills.mjs <outDir> <t1> [t2 ...] | --range <from> <to> <step>');
  process.exit(1);
}
let times = [];
if (rest[0] === '--range') {
  const [a, b, s] = rest.slice(1).map(Number);
  for (let t = a; t <= b + 1e-9; t += s) times.push(Number(t.toFixed(4)));
} else times = rest.map(Number);
fs.mkdirSync(outDir, { recursive: true });

const { chromium } = await loadPlaywright();
const server = await serve(0);
const browser = await chromium.launch({
  args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--disable-accelerated-2d-canvas'],
});
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
page.on('pageerror', (e) => console.error('[page]', e.message));
await page.goto(`http://127.0.0.1:${server.address().port}/index.html?render`);
await page.evaluate(() => window.ready);
const files = [];
for (const t of times) {
  await page.evaluate((t) => window.renderFrame(t), t);
  const f = path.join(outDir, `t${t.toFixed(3).padStart(7, '0')}.png`);
  await page.screenshot({ path: f });
  files.push(f);
}
await browser.close();
server.close();
console.log(`Wrote ${files.length} frame(s) to ${outDir}`);
if (files.length > 1) {
  try {
    const sheet = path.join(outDir, 'sheet.png');
    execFileSync('montage', [
      ...files.flatMap((f) => ['-label', path.basename(f, '.png'), f]),
      '-tile', `${Math.min(6, files.length)}x`, '-geometry', '270x480+6+6',
      '-background', '#222', '-fill', '#fff', '-pointsize', '18', sheet,
    ]);
    console.log('Contact sheet:', sheet);
  } catch {
    console.log('(montage not available; skipped the contact sheet)');
  }
}

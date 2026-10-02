// main.js — preview player + deterministic frame API for the renderer.
(function (G) {
  'use strict';
  const { Film, Post, TL } = G;
  const params = new URLSearchParams(location.search);
  const RENDER = params.has('render');
  if (RENDER) document.body.classList.add('render');

  // #stage (2D) is the picture; #stagegl sits on top and is only shown on
  // frames that need the distortion pass (ripples, wobble, zoom blur).
  const stage = document.getElementById('stage');
  const stageGL = document.getElementById('stagegl');
  const ctx = stage.getContext('2d', { alpha: false });
  let post = { webgl: false, draw() {} };
  try {
    post = Post.create(stageGL);
  } catch (e) {
    console.warn('WebGL post disabled:', e);
  }

  let usedGL = false;
  function renderFrame(t) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.filter = 'none';
    Film.renderScene(ctx, t);
    const P = Film.postAt(t);
    Post.finish2D(ctx, P, t);
    usedGL = post.webgl && Post.needsGL(P);
    if (usedGL) post.draw(stage, { ...P, grain: 0, vig: 0 }, t);
    stageGL.style.visibility = usedGL ? 'visible' : 'hidden';
  }

  // Renderer hook: draw frame t and POST its raw RGBA pixels to `url`.
  const W = stage.width, H = stage.height;
  const flipped = new Uint8Array(W * H * 4);
  async function renderAndSend(t, url) {
    renderFrame(t);
    let px;
    if (usedGL) {
      const gl = stageGL.getContext('webgl2');
      const raw = new Uint8Array(W * H * 4);
      gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, raw);
      const row = W * 4;
      for (let y = 0; y < H; y++) flipped.set(raw.subarray((H - 1 - y) * row, (H - y) * row), y * row);
      px = flipped;
    } else px = ctx.getImageData(0, 0, W, H).data;
    // a Blob body uploads ~10x faster than a typed-array body in Chromium
    const r = await fetch(url, { method: 'POST', body: new Blob([px]) });
    if (!r.ok) throw new Error('frame upload failed: ' + r.status);
  }
  G.renderAndSend = renderAndSend;

  const fontsReady = Promise.all([
    document.fonts.load('900 100px "Unbounded"'),
    document.fonts.load('600 100px "Unbounded"'),
    document.fonts.load('800 100px "Unbounded"'),
    document.fonts.load('700 30px "JetBrains Mono"'),
  ]).then(() => document.fonts.ready);

  G.renderFrame = renderFrame;
  G.ready = fontsReady.then(() => {
    renderFrame(0);
    return { duration: TL.DURATION, fps: TL.FPS, webgl: post.webgl };
  });
  if (RENDER) return;

  // ---------------------------------------------------------- preview UI
  const playBtn = document.getElementById('play');
  const scrub = document.getElementById('scrub');
  const timeEl = document.getElementById('time');
  const muteBtn = document.getElementById('mute');
  const audio = new Audio('media/soundtrack.m4a');
  audio.preload = 'auto';
  let hasAudio = false;
  audio.addEventListener('canplaythrough', () => (hasAudio = true), { once: true });
  audio.addEventListener('error', () => {
    hasAudio = false;
    if (muteBtn) muteBtn.hidden = true;
  });
  let muted = true;
  scrub.max = TL.DURATION;

  let playing = false, t = 0, last = 0;
  const fmt = (x) => x.toFixed(2).padStart(5, '0') + 's';
  function show(time) {
    t = ((time % TL.DURATION) + TL.DURATION) % TL.DURATION;
    renderFrame(t);
    scrub.value = t;
    timeEl.textContent = fmt(t);
  }
  function syncAudio() {
    if (!hasAudio) return;
    audio.muted = muted;
    if (playing) {
      if (Math.abs(audio.currentTime - t) > 0.08) audio.currentTime = t;
      audio.play().catch(() => {});
    } else audio.pause();
  }
  function loop(now) {
    if (!playing) return;
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    let nt = t + dt;
    if (nt >= TL.DURATION) {
      nt -= TL.DURATION;
      if (hasAudio) audio.currentTime = nt;
    }
    if (hasAudio && !audio.paused && !muted) nt = audio.currentTime;
    show(nt);
    requestAnimationFrame(loop);
  }
  function setPlaying(p) {
    playing = p;
    playBtn.textContent = p ? 'Pause' : 'Play';
    playBtn.setAttribute('aria-pressed', String(p));
    syncAudio();
    if (p) {
      last = performance.now();
      requestAnimationFrame(loop);
    }
  }
  playBtn.addEventListener('click', () => setPlaying(!playing));
  scrub.addEventListener('input', () => {
    show(Number(scrub.value));
    if (hasAudio) audio.currentTime = t;
  });
  if (muteBtn)
    muteBtn.addEventListener('click', () => {
      muted = !muted;
      muteBtn.textContent = muted ? 'Sound off' : 'Sound on';
      syncAudio();
    });
  document.addEventListener('keydown', (e) => {
    if (e.target === scrub && e.key !== ' ') return;
    if (e.key === ' ') {
      e.preventDefault();
      setPlaying(!playing);
    } else if (e.key === 'ArrowRight') show(t + 1 / TL.FPS);
    else if (e.key === 'ArrowLeft') show(t - 1 / TL.FPS);
  });
  G.ready.then(() => {
    show(Number(params.get('t') || 0));
    if (!params.has('paused')) setPlaying(true);
  });
})(window);

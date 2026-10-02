// scenes.js — the film: seven shots stitched together by six transitions.
// Everything is a pure function of time t, so any frame renders on demand.
(function (G) {
  'use strict';
  const { K, Bottle, Cast, FX, TL } = G;
  const { PAL, Ease, clamp, lerp, prog, track, rgb, TAU, PI, W, H } = K;
  const B = Bottle.B;

  const THEME = {
    navy: { bg: PAL.navy, text: '#FFFFFF', accent: PAL.aqua, dark: true },
    yellow: { bg: PAL.yellow, text: PAL.navy, accent: PAL.cobalt, dark: false },
    ice: { bg: PAL.ice, text: PAL.navy, accent: PAL.cobalt, dark: false },
    cobalt: { bg: PAL.cobalt, text: '#FFFFFF', accent: PAL.yellow, dark: true },
    mint: { bg: PAL.mint, text: PAL.navy, accent: PAL.cobalt, dark: false },
  };

  // =================================================================
  // shared world (steps 1-4): bottle, hand, drinker, camera
  // =================================================================
  const S = 1.12; // bottle scale
  const PIV = 314; // rotation pivot height (bottle-local)
  const MOUTH = B.top;
  const GROUND = 1520;
  const Y_LAND = GROUND - PIV * S;
  const Y_LIFT = Y_LAND - 170;
  const CAP_C = B.capSeat + B.capH / 2; // cap centre height
  const CAP_W = [540, Y_LIFT - (CAP_C - PIV) * S]; // cap centre in world (lifted, upright)

  const BUST_S = 1.45;
  const BUST_O = { x: -66.5, y: 680.9 };

  function bustState(t) {
    const tilt = -0.085 * K.win(t, 11.15, 11.6, 13.35, 13.9);
    const slide = -660 * (1 - Ease.outCubic(prog(t, TL.TILT_WIPE[0], TL.TILT_WIPE[1] - 0.03)));
    let gulp = -1, gulpAmp = 0;
    for (const g of TL.GLUGS) {
      const a = t - (g + 0.16);
      if (a >= 0 && a < 0.5) {
        gulp = a / 0.5;
        gulpAmp = 9 * Math.sin((PI * a) / 0.5);
      }
    }
    const happy = t > TL.AHHH - 0.05;
    return { tilt, slide, gulp, gulpAmp, eye: happy ? 'happy' : 'closed' };
  }
  function bustToWorld(t, x, y) {
    const bs = bustState(t);
    const [lx, ly] = Cast.headTransform({ tilt: bs.tilt }, x, y);
    return [BUST_O.x + bs.slide + lx * BUST_S, BUST_O.y + ly * BUST_S];
  }
  const lipsWorld = (t) => bustToWorld(t, Cast.LIPS.x, Cast.LIPS.y);

  function centerFromMouth(mx, my, rot) {
    const d = (MOUTH - PIV) * S;
    return [mx - Math.sin(rot) * d, my + Math.cos(rot) * d];
  }

  const TWIST_SPIN = -1.35; // unscrewing: front of the cap travels left
  function bottleAt(t) {
    const st = {
      vis: true, x: 540, y: Y_LAND, rot: 0, sx: 1, sy: 1, spin: 0, fill: 1,
      capOn: true, capRise: 0, capSpin: 0, cracked: 0, wave: 3,
    };
    const [f0, f1] = TL.BOTTLE_FALL;
    if (t < f0) {
      st.vis = false;
      return st;
    }
    st.spin = 5.4 * (1 - Ease.outCubic(prog(t, f0, f1 + 0.55)));
    if (t < f1) {
      const q = prog(t, f0, f1);
      st.y = lerp(-520, Y_LAND, Ease.inQuad(q));
      st.rot = -0.45 * (1 - Ease.outQuad(q));
      st.sy = 1 + 0.08 * q;
      st.sx = 1 - 0.04 * q;
      st.wave = 3;
      return st;
    }
    const a = t - f1;
    const sq = 0.17 * Math.exp(-7 * a) * Math.cos(TAU * 2.6 * a);
    st.sy = 1 - sq;
    st.sx = (1 + sq * 0.55) * (1 - 0.03 * K.wobble(t - TL.GRIP, 3, 8));
    const [l0, l1] = TL.LIFT;
    const dy = track(t, [
      [l0, 0],
      [l0 + 0.15, 14, Ease.outQuad],
      [l1 - 0.1, -170, Ease.outBack],
      [l1, -170],
    ]);
    st.rot = 0.075 * K.wobble(t - (l0 + 0.15), 1.4, 3.2);
    st.y = GROUND - PIV * S * st.sy + dy;
    st.wave = 3 + 13 * Math.exp(-5 * a);

    // step 2 — cap twists, seal cracks, cap pops
    let spin = 0, rise = 0;
    for (const tt of TL.TWISTS) {
      const q = Ease.inOutCubic(prog(t, tt, tt + TL.TWIST_DUR));
      spin += TWIST_SPIN * q;
      rise += 6 * q;
    }
    st.capSpin = spin;
    st.capRise = rise;
    st.cracked = t >= TL.CRACK ? 1 : 0;
    if (t >= TL.POP) {
      st.capOn = false;
      st.y += 9 * K.wobble(t - TL.POP, 2.6, 7);
      st.wave += 7 * Math.exp(-5 * (t - TL.POP));
    }

    // step 3 — pull back, tilt to the lips, drink
    if (t >= TL.PULLBACK[0]) {
      const p0 = TL.PULLBACK[0];
      const q = Ease.inOutCubic(prog(t, p0, TL.TILT[0]));
      let cx = lerp(540, 700, q), cy = lerp(Y_LIFT, 1020, q);
      let rot = 0.12 * Ease.inOutSine(prog(t, p0, TL.TILT[0]));
      if (t >= TL.TILT[0]) {
        const [a0, a1] = TL.TILT;
        const qa = Ease.inOutCubic(prog(t, a0, a1));
        const qm = Ease.inOutQuad(prog(t, a0, a1 - 0.12));
        rot = lerp(0.12, -2.05, qa);
        const d = (MOUTH - PIV) * S;
        const m0 = [700 + Math.sin(0.12) * d, 1020 - Math.cos(0.12) * d];
        const lips = lipsWorld(t);
        let mx = lerp(m0[0], lips[0] - 8, qm), my = lerp(m0[1], lips[1] + 2, qm);
        rot += -0.27 * Ease.inOutSine(prog(t, TL.DRINK[0], TL.DRINK[1]));
        if (t >= TL.DIVE[0]) {
          const qd = Ease.inCubic(prog(t, TL.DIVE[0], TL.DIVE[0] + 0.7));
          mx = lerp(mx, 1080, qd);
          my = lerp(my, 360, qd);
          rot = lerp(rot, -0.6, qd);
          if (qd >= 1) st.vis = false;
        }
        [cx, cy] = centerFromMouth(mx, my, rot);
      }
      st.x = cx;
      st.y = cy;
      st.rot = rot;
      st.sx = 1;
      st.sy = 1;
      st.fill = track(t, [
        [11.42, 1.0],
        [11.72, 0.83, Ease.outQuad],
        [12.22, 0.64, Ease.outQuad],
        [12.72, 0.45, Ease.outQuad],
        [13.22, 0.27, Ease.outQuad],
        [13.55, 0.17, Ease.outQuad],
      ]);
      st.wave = 3 + 3 * K.win(t, 11.3, 11.5, 13.4, 13.6);
      for (const g of TL.GLUGS) if (t > g) st.wave += 5 * Math.exp(-6 * (t - g));
      st.glugs = TL.GLUGS;
    }
    return st;
  }

  function bottleMatrix(st) {
    return Bottle.bottleMatrix(st.x, st.y, st.rot, S, st.sx, st.sy, PIV);
  }

  // impact shake (screen px), applied to the world layer only
  const SHAKES = [
    [TL.BOTTLE_FALL[1], 12], [TL.GRIP, 3], [TL.POP, 9], [TL.CRUSH[0] + 0.05, 8], [TL.BIN_HIT, 11],
  ];
  function shake(t) {
    let x = 0, y = 0;
    for (const [t0, a] of SHAKES) {
      const d = t - t0;
      if (d < 0 || d > 0.5) continue;
      const k = a * Math.exp(-10 * d);
      x += K.noise1(d * 45 + t0 * 7) * k;
      y += K.noise1(d * 45 + t0 * 7 + 50) * k;
    }
    return [x, y];
  }

  // Water slosh: a damped pendulum chasing the effective-gravity tilt felt
  // at the water's centre of mass. Integrated once for the whole timeline.
  const SLOSH = (() => {
    const dt = 1 / 240, t0 = 2.9, t1 = 15.2;
    const n = Math.ceil((t1 - t0) / dt) + 2;
    const arr = new Float32Array(n);
    const w = TAU * 1.7, z = 0.15, Gv = 9000;
    const pos = (t) => {
      const s = bottleAt(t);
      if (!s.vis) return null;
      return K.Mx.ap(bottleMatrix(s), 0, -180);
    };
    let psi = 0, vel = 0;
    for (let i = 0; i < n; i++) {
      const t = t0 + i * dt;
      const p0 = pos(t - dt), p1 = pos(t), p2 = pos(t + dt);
      let eq = 0;
      if (p0 && p1 && p2 && t > TL.BOTTLE_FALL[1] + 0.02) {
        const ax = (p2[0] - 2 * p1[0] + p0[0]) / (dt * dt);
        const ay = (p2[1] - 2 * p1[1] + p0[1]) / (dt * dt);
        eq = clamp(Math.atan2(ax, Math.max(0.35 * Gv, Gv - ay)), -0.55, 0.55);
      }
      vel += (-w * w * (psi - eq) - 2 * z * w * vel) * dt;
      psi += vel * dt;
      arr[i] = psi;
    }
    return { t0, dt, arr };
  })();
  function sloshAt(t) {
    const f = (t - SLOSH.t0) / SLOSH.dt;
    if (f <= 0) return 0;
    const i = Math.floor(f);
    if (i >= SLOSH.arr.length - 1) return 0;
    return lerp(SLOSH.arr[i], SLOSH.arr[i + 1], f - i);
  }

  function handAt(t) {
    const [h0, h1] = TL.HAND_IN;
    const z0 = TL.ZOOM[0];
    if (t < h0 || t > z0 + 0.62) return null;
    const reachIn = Ease.outBackSoft(prog(t, h0, h1));
    const reachOut = Ease.inCubic(prog(t, z0 + 0.06, z0 + 0.6));
    const grip = Ease.outCubic(prog(t, TL.GRIP - 0.3, TL.GRIP + 0.02)) * (1 - 0.75 * Ease.outQuad(prog(t, z0, z0 + 0.16)));
    return { reach: reachIn * (1 - reachOut), grip };
  }

  // camera: screen = (world - f) * z + p      (log-interpolated zoom)
  const CAMK = [
    { t: 0, f: CAP_W, p: CAP_W, z: 1 },
    { t: TL.ZOOM[0], f: CAP_W, p: CAP_W, z: 1 },
    { t: TL.ZOOM[1], f: CAP_W, p: [540, 1060], z: 2.7, e: Ease.ramp },
    { t: TL.PULLBACK[0], f: CAP_W, p: [540, 1060], z: 2.8, e: Ease.linear },
    { t: TL.PULLBACK[1], f: [540, 1000], p: [540, 960], z: 0.9, e: Ease.swift },
    { t: TL.DIVE[0], f: [540, 1000], p: [540, 960], z: 0.935, e: Ease.linear },
    { t: 14.15, f: [300, 1420], p: [540, 960], z: 1.22, e: Ease.inOutCubic },
    { t: 14.85, f: [209, 987], p: [540, 960], z: 0.85, e: Ease.inOutCubic },
    { t: 19, f: [209, 987], p: [540, 960], z: 0.9, e: Ease.linear },
  ];
  function camAt(t) {
    let i = 1;
    while (i < CAMK.length - 1 && t > CAMK[i].t) i++;
    const a = CAMK[i - 1], b = CAMK[i];
    const q = (b.e || Ease.inOutCubic)(prog(t, a.t, b.t));
    return {
      fx: lerp(a.f[0], b.f[0], q),
      fy: lerp(a.f[1], b.f[1], q),
      px: lerp(a.p[0], b.p[0], q),
      py: lerp(a.p[1], b.p[1], q),
      z: Math.exp(lerp(Math.log(a.z), Math.log(b.z), q)),
    };
  }
  function applyCam(ctx, c) {
    ctx.translate(c.px, c.py);
    ctx.scale(c.z, c.z);
    ctx.translate(-c.fx, -c.fy);
  }
  const toScreen = (c, x, y) => [(x - c.fx) * c.z + c.px, (y - c.fy) * c.z + c.py];

  // Vignette, drawn per shot under the typography so text stays pure white.
  const VIG = { navy: 0.3, yellow: 0.07, ice: 0.05, cobalt: 0.16, mint: 0.07 };
  function vignette(ctx, k) {
    if (k <= 0) return;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const r0 = Math.sqrt(0.04) * H, r1 = Math.sqrt(0.3) * H;
    const g = ctx.createRadialGradient(W / 2, H / 2, r0, W / 2, H / 2, r1);
    for (let i = 0; i <= 8; i++) {
      const x = i / 8;
      g.addColorStop(x, `rgba(0,0,0,${(k * x * x * (3 - 2 * x)).toFixed(4)})`);
    }
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }

  // =================================================================
  // header: "STEP 0n" + progress pills + "<VERB>" / "IT."
  // =================================================================
  const HDR = { x: 84, yLabel: 258, yVerb: 452, yIt: 616, size: 150 };
  const stepEnd = (k) => (k < TL.STEPS.length - 1 ? TL.STEPS[k + 1].at : TL.ZOOM_THROUGH[0]);
  const verbIn = (k) => (k === 0 ? TL.HEADER_IN + 0.04 : TL.STEPS[k].at - 0.2);
  const verbOut = (k) => (k < TL.STEPS.length - 1 ? TL.STEPS[k + 1].at - 0.34 : 1e9);
  const sizeCache = {};
  function verbSize(ctx, verb) {
    if (sizeCache[verb]) return sizeCache[verb];
    K.font(ctx, 100, 900);
    const w = K.charLayout(ctx, verb).width / 100;
    return (sizeCache[verb] = Math.min(HDR.size, 900 / w));
  }

  function header(ctx, t, th) {
    const h0 = TL.HEADER_IN;
    if (t < h0) return;
    ctx.save();
    // label row
    const la = Ease.outCubic(prog(t, h0, h0 + 0.45));
    ctx.globalAlpha = la;
    ctx.translate((1 - la) * -40, 0);
    ctx.fillStyle = th.text;
    K.font(ctx, 34, 700, K.FONT.mono);
    ctx.letterSpacing = '4px';
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left';
    ctx.fillText('STEP', HDR.x, HDR.yLabel);
    let k = 0;
    while (k < TL.STEPS.length - 1 && t >= TL.STEPS[k + 1].at - 0.2) k++;
    const swap = k > 0 ? prog(t, TL.STEPS[k].at - 0.2, TL.STEPS[k].at + 0.3) : 1;
    const dx = HDR.x + ctx.measureText('STEP ').width;
    const dw = ctx.measureText('00').width;
    if (swap < 1) FX.rollDigits(ctx, '0' + k, '0' + (k + 1), swap, dx, HDR.yLabel, 34);
    else ctx.fillText('0' + (k + 1), dx, HDR.yLabel);
    ctx.globalAlpha = la * 0.55;
    ctx.fillText('/05', dx + dw + 2, HDR.yLabel);
    const pillX = dx + dw + 2 + ctx.measureText('/05').width + 26;
    ctx.letterSpacing = '0px';
    // pills
    for (let i = 0; i < 5; i++) {
      const x = pillX + i * 62, y = HDR.yLabel - 17;
      const grow = Ease.outCubic(prog(t, h0 + 0.1 + i * 0.05, h0 + 0.5 + i * 0.05));
      if (grow <= 0) continue;
      const fill = clamp((t - TL.STEPS[i].at) / (stepEnd(i) - TL.STEPS[i].at));
      ctx.globalAlpha = la * 0.22;
      K.rrect(ctx, x, y, 48 * grow, 12, 6);
      ctx.fillStyle = th.text;
      ctx.fill();
      if (fill > 0) {
        ctx.globalAlpha = la;
        K.rrect(ctx, x, y, Math.max(12, 48 * grow * fill), 12, 6);
        ctx.fill();
      }
    }
    ctx.restore();

    // verbs (masked rise in / rise out)
    for (let s = 0; s < TL.STEPS.length; s++) {
      const tin = verbIn(s), tout = verbOut(s);
      if (t < tin || t > tout + 0.7) continue;
      const verb = TL.STEPS[s].verb;
      const size = verbSize(ctx, verb);
      K.kinetic(ctx, verb, {
        x: HDR.x,
        y: HDR.yVerb,
        size,
        color: th.text,
        clip: [HDR.yVerb - HDR.size * 0.98, HDR.yVerb + HDR.size * 0.22],
        fn: (i) => {
          const e = Ease.outExpo(prog(t, tin + i * 0.035, tin + i * 0.035 + 0.6));
          const x = Ease.inCubic(prog(t, tout + i * 0.022, tout + i * 0.022 + 0.3));
          return { dy: (1 - e) * size * 1.2 - x * size * 1.2, r: (1 - e) * 0.25 };
        },
      });
    }
    // "IT." holds across steps and nods at each swap
    let nod = 0;
    for (let s = 1; s < TL.STEPS.length; s++) nod += K.wobble(t - (TL.STEPS[s].at + 0.08), 2.2, 6);
    const itIn = h0 + 0.2;
    K.kinetic(ctx, 'IT.', {
      x: HDR.x,
      y: HDR.yIt,
      size: HDR.size,
      color: th.accent,
      clip: [HDR.yIt - HDR.size * 1.1, HDR.yIt + HDR.size * 0.3],
      fn: (i) => {
        const e = Ease.outExpo(prog(t, itIn + i * 0.05, itIn + i * 0.05 + 0.6));
        return { dy: (1 - e) * HDR.size * 1.2, sy: 1 - 0.1 * nod, sx: 1 + 0.06 * nod, r: (1 - e) * 0.25 };
      },
    });
  }

  // =================================================================
  // shot 0 — intro: the drop and the title
  // =================================================================
  const SURF = 1290;
  const WSP = (TAU * 10) / 26; // wave speed that loops over the film

  function waterBody(ctx, surf, t, amp = 4) {
    const g = ctx.createLinearGradient(0, surf, 0, H);
    g.addColorStop(0, '#0F3B84');
    g.addColorStop(0.18, '#0A2A66');
    g.addColorStop(1, '#05122F');
    ctx.fillStyle = g;
    FX.wavePath(ctx, surf, t, { amp, k: 0.011, speed: WSP });
    ctx.fill();
    // drifting caustic lines
    ctx.save();
    ctx.lineWidth = 3;
    for (let i = 0; i < 4; i++) {
      const y = surf + 70 + i * 95;
      if (y > H) break;
      ctx.strokeStyle = rgb(PAL.aqua, 0.09 - i * 0.015);
      FX.waveLine(ctx, y, t + i * 3, { amp: 9, k: 0.017 + i * 0.003, speed: WSP * (i % 2 ? -1 : 1), phase: i * 1.7 });
      ctx.stroke();
    }
    ctx.restore();
  }
  function surfaceLine(ctx, surf, t, amp = 4) {
    ctx.save();
    ctx.lineWidth = 3;
    ctx.strokeStyle = rgb(PAL.aqua, 0.6);
    FX.waveLine(ctx, surf, t, { amp, k: 0.011, speed: WSP });
    ctx.stroke();
    ctx.restore();
  }

  // mirrored, rippling reflection of a layer below the waterline
  function reflect(ctx, src, surf, t, alpha = 0.32, depth = 520) {
    ctx.save();
    for (let y = 0; y < depth; y += 3) {
      const sy = surf - y - 3;
      if (sy < 0) break;
      const k = y / depth;
      const off = Math.sin(y * 0.09 - t * 5.2) * (1.5 + 9 * k) + Math.sin(y * 0.031 + t * 2.3) * 5 * k;
      ctx.globalAlpha = alpha * Math.pow(1 - k, 1.7);
      ctx.drawImage(src, 0, sy, W, 3, off, surf + y, W, 3);
    }
    ctx.restore();
  }

  // glyphs filled with sloshing water
  function liquidText(g, text, o) {
    const L = K.layer('liquid');
    const lc = L.ctx;
    K.kinetic(lc, text, { ...o, color: '#fff', stroke: null });
    const top = o.y - o.size * 0.76;
    if (o.fill > 0.001) {
      lc.globalCompositeOperation = 'source-in';
      const level = lerp(o.y + 12, top - 18, o.fill);
      const gr = lc.createLinearGradient(0, top, 0, o.y + 10);
      gr.addColorStop(0, PAL.waterLight);
      gr.addColorStop(0.35, PAL.aqua);
      gr.addColorStop(1, PAL.azure);
      lc.fillStyle = gr;
      FX.wavePath(lc, level, o.t, { amp: 7 + 5 * (o.slosh || 0), k: 0.02, speed: 4.2, tilt: o.tilt || 0 });
      lc.fill();
      lc.globalCompositeOperation = 'source-atop';
      lc.lineWidth = 6;
      lc.strokeStyle = 'rgba(255,255,255,0.85)';
      FX.waveLine(lc, level, o.t, { amp: 7 + 5 * (o.slosh || 0), k: 0.02, speed: 4.2, tilt: o.tilt || 0 });
      lc.stroke();
      const R = K.rng(9);
      for (let i = 0; i < 26; i++) {
        const bx = o.x - o.width / 2 + R() * o.width;
        const span = o.y - level + 10;
        const by = o.y + 4 - K.fract(R() + o.t * (0.25 + R() * 0.3)) * span;
        K.circle(lc, bx + Math.sin(o.t * 3 + i) * 4, by, 2 + R() * 4);
        lc.fillStyle = 'rgba(255,255,255,0.55)';
        lc.fill();
      }
      lc.globalCompositeOperation = 'source-over';
      g.drawImage(L.c, 0, 0);
    }
    // Outline: stroke at double width, then punch the glyph fill back out.
    // This keeps only the outer edge and hides the font's overlapping
    // contours, which a plain strokeText would draw inside the letters.
    const OL = K.layer('outline');
    K.kinetic(OL.ctx, text, { ...o, noFill: true, stroke: { color: o.outline, width: (o.strokeW || 5) * 2 } });
    OL.ctx.globalCompositeOperation = 'destination-out';
    K.kinetic(OL.ctx, text, { ...o, color: '#000', stroke: null });
    OL.ctx.globalCompositeOperation = 'source-over';
    g.drawImage(OL.c, 0, 0);
  }

  function introSurface(t) {
    return lerp(SURF, -200, Ease.inOutCubic(prog(t, TL.WAVE[0], TL.WAVE[0] + 0.62)));
  }

  function drawIntroTitle(g, t) {
    K.kinetic(g, 'HOW TO DRINK', {
      x: 540, y: 772, size: 50, weight: 600, align: 'center', spacing: 9, color: 'rgba(255,255,255,0.92)',
      fn: (i) => {
        const e = Ease.outCubic(prog(t, 1.14 + i * 0.03, 1.14 + i * 0.03 + 0.5));
        return { a: e, dy: (1 - e) * 28 };
      },
    });
    K.kinetic(g, 'BOTTLED', {
      x: 540, y: 960, size: 142, align: 'center', color: '#FFFFFF',
      fn: (i) => {
        const p = prog(t, 1.0 + i * 0.045, 1.0 + i * 0.045 + 0.62);
        return { a: clamp(p * 5), dy: (1 - Ease.outBack(p)) * -150, s: lerp(0.4, 1, Ease.outBack(p)) };
      },
    });
    K.font(g, 188, 900);
    const ww = K.charLayout(g, 'WATER').width;
    const fill = Ease.inOutSine(prog(t, TL.WORD_FILL[0], TL.WORD_FILL[1]));
    liquidText(g, 'WATER', {
      x: 540, y: 1190, size: 188, align: 'center', width: ww, outline: PAL.aqua, strokeW: 4,
      fill, t, slosh: Math.exp(-3 * Math.max(0, t - TL.WORD_FILL[1])),
      fn: (i) => {
        const p = prog(t, TL.DROP_HIT + 0.05 + i * 0.055, TL.DROP_HIT + 0.05 + i * 0.055 + 0.55);
        return { dy: (1 - Ease.outBack(p)) * 300, a: p > 0 ? 1 : 0 };
      },
    });
  }

  function shotIntro(ctx, t) {
    const surf = introSurface(t);
    const hit = TL.DROP_HIT;
    ctx.save();
    // impact shake + slow push-in
    const sh = t > hit ? Math.exp(-11 * (t - hit)) * 9 : 0;
    const push = 1 + 0.035 * Ease.inOutSine(prog(t, 0, TL.WAVE[1]));
    ctx.translate(540 + K.noise1(t * 38) * sh, 1000 + K.noise1(t * 38 + 9) * sh);
    ctx.scale(push, push);
    ctx.translate(-540, -1000);

    FX.backdrop(ctx, PAL.navy, { glow: 0.12, glowColor: PAL.azure, gy: 900 });
    FX.rays(ctx, t, { alpha: 0.075 });
    FX.particles(ctx, t, { alpha: 0.45, rings: true, n: 40 });

    const rise = prog(t, TL.WAVE[0], TL.WAVE[0] + 0.62);
    const amp = 4 + 40 * Math.sin(PI * Math.min(1, rise * 1.2)) + (t > hit ? 10 * Math.exp(-3 * (t - hit)) : 0);
    waterBody(ctx, surf, t, amp);

    // title (rendered once into a layer, then shown + reflected)
    const L = K.layer('title');
    drawIntroTitle(L.ctx, t);
    ctx.save();
    ctx.beginPath();
    ctx.rect(-200, -400, W + 400, surf + 400);
    ctx.clip();
    ctx.drawImage(L.c, 0, 0);
    ctx.restore();
    if (rise > 0) {
      // submerged part of the title, seen through the rising water
      ctx.save();
      FX.wavePath(ctx, surf, t, { amp, k: 0.011, speed: WSP });
      ctx.clip();
      ctx.globalAlpha = 0.4;
      ctx.drawImage(L.c, 0, 0);
      ctx.restore();
    }
    reflect(ctx, L.c, surf, t, 0.3 * (1 - K.smoothstep(0, 0.22, rise)));
    surfaceLine(ctx, surf, t, amp);

    // ripples on the surface
    if (t > hit) FX.ripples(ctx, 540, SURF, t - hit, { reach: 760, persp: 0.12, life: 1.6, n: 4, gap: 0.16 });

    // the drop
    const d0 = TL.DROP_START;
    if (t >= d0 && t < hit) {
      const q = prog(t, d0, hit);
      const y = lerp(-90, SURF - 30, Ease.inQuad(q));
      const tr = ctx.createLinearGradient(540, y - 260 * q, 540, y);
      tr.addColorStop(0, rgb(PAL.aqua, 0));
      tr.addColorStop(1, rgb(PAL.aqua, 0.55));
      ctx.strokeStyle = tr;
      ctx.lineWidth = 6;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(540, y - 260 * q);
      ctx.lineTo(540, y - 40);
      ctx.stroke();
      FX.droplet(ctx, 540, y, 28, { sy: 1 + 0.4 * q, sx: 1 - 0.1 * q, glow: 1 });
    }
    if (t >= hit) {
      const a = t - hit;
      const fl = Math.exp(-9 * a);
      const g = ctx.createRadialGradient(540, SURF, 0, 540, SURF, 520);
      g.addColorStop(0, rgb('#BFF3FF', 0.55 * fl));
      g.addColorStop(1, rgb('#BFF3FF', 0));
      ctx.fillStyle = g;
      ctx.fillRect(0, SURF - 520, W, 1040);
      FX.splash(ctx, 540, SURF, a, { scale: 1.05, n: 22 });
    }
    vignette(ctx, VIG.navy);
    ctx.restore();
  }

  // =================================================================
  // shots 1-4 — the bottle world (yellow / ice / cobalt themes)
  // =================================================================
  const FLOATERS = (() => {
    const R = K.rng(21);
    return Array.from({ length: 16 }, (_, i) => ({
      x: R() * W, y: 700 + R() * 1150, kind: i % 4, s: 10 + R() * 18, ph: R() * TAU, sp: 0.4 + R() * 0.6,
    }));
  })();
  function decor(ctx, t, name, th) {
    if (name === 'yellow') {
      // sun disc + floating confetti
      const g = ctx.createRadialGradient(540, 1100, 0, 540, 1100, 560);
      g.addColorStop(0, 'rgba(255,255,255,0.38)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 500, W, 1300);
      ctx.save();
      for (const f of FLOATERS) {
        const x = f.x + Math.sin(t * f.sp + f.ph) * 22, y = f.y + Math.cos(t * f.sp * 0.8 + f.ph) * 26;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(t * 0.6 * f.sp + f.ph);
        ctx.strokeStyle = rgb(PAL.navy, 0.13);
        ctx.fillStyle = rgb(PAL.navy, 0.13);
        ctx.lineWidth = 5;
        ctx.lineCap = 'round';
        if (f.kind === 0) {
          K.circle(ctx, 0, 0, f.s * 0.5);
          ctx.stroke();
        } else if (f.kind === 1) {
          ctx.beginPath();
          ctx.moveTo(-f.s * 0.5, 0);
          ctx.lineTo(f.s * 0.5, 0);
          ctx.moveTo(0, -f.s * 0.5);
          ctx.lineTo(0, f.s * 0.5);
          ctx.stroke();
        } else if (f.kind === 2) {
          K.circle(ctx, 0, 0, f.s * 0.22);
          ctx.fill();
        } else {
          ctx.beginPath();
          for (let k = 0; k < 4; k++) ctx.lineTo(((k % 2) - 0.5) * f.s * 1.2 + k * 2, (k - 1.5) * f.s * 0.3);
          ctx.stroke();
        }
        ctx.restore();
      }
      ctx.restore();
    } else if (name === 'ice') {
      FX.grid(ctx, PAL.cobalt, 0.07, 72, 540 % 72, 1060 % 72);
    } else if (name === 'cobalt') {
      ctx.save();
      const g = ctx.createRadialGradient(560, 1100, 0, 560, 1100, 1000);
      g.addColorStop(0, 'rgba(120,200,255,0.25)');
      g.addColorStop(1, 'rgba(120,200,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = 'rgba(255,255,255,0.06)';
      ctx.lineWidth = 3;
      for (let i = 1; i <= 7; i++) {
        K.circle(ctx, 560, 1100, i * 150 + ((t * 40) % 150));
        ctx.stroke();
      }
      ctx.restore();
      FX.particles(ctx, t, { alpha: 0.3, rings: true, n: 26, seed: 8 });
    }
  }

  function capWorldNow(t, st) {
    // world position of the cap centre while it sits on the bottle
    const m = bottleMatrix(st);
    return K.Mx.ap(m, 0, -(CAP_C + st.capRise));
  }

  function drawFlyingCap(ctx, t) {
    const a = t - TL.POP;
    if (a < 0 || a > 1.2) return;
    const st = bottleAt(TL.POP - 1e-3);
    const [x0, y0] = capWorldNow(TL.POP - 1e-3, st);
    const x = x0 + 700 * a, y = y0 - 2600 * a + 0.5 * 3600 * a * a;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(9.5 * a);
    const flip = Math.cos(a * 14);
    ctx.scale(S, S * (0.55 + 0.45 * Math.abs(flip)));
    ctx.translate(0, B.capH / 2);
    Bottle.drawCap(ctx, { spin: TWIST_SPIN * 3 - a * 20, top: flip < 0 ? Math.abs(flip) : 0 });
    ctx.restore();
  }

  // the drinker, the gulp and the fill
  const GULP_PATH = K.polyline([
    [334, 312], [302, 330], [262, 372], [232, 450], [218, 540], [206, 660], [194, 790], [180, 930],
  ]);
  function fillLevel(t) {
    return Ease.inOutSine(prog(t, TL.FILL[0], TL.FILL[1]));
  }
  function drawDrinker(ctx, t) {
    const bs = bustState(t);
    const fill = fillLevel(t);
    const level = lerp(1250, -12, fill);
    ctx.save();
    ctx.translate(BUST_O.x + bs.slide, BUST_O.y);
    ctx.scale(BUST_S, BUST_S);
    Cast.drawBust(ctx, {
      tilt: bs.tilt, gulp: bs.gulp, gulpAmp: bs.gulpAmp, eye: bs.eye,
      waterLevel: fill > 0 ? level : null,
      inside: (c) => {
        // x-ray gulps travelling down the throat during the dive
        const [g0, g1] = [TL.DIVE[0] + 0.05, TL.DIVE[1] - 0.15];
        if (t > g0 - 0.4 && t < g1 + 0.5) {
          for (let k = 0; k < 3; k++) {
            const q = prog(t, g0 + k * 0.12, g1 + k * 0.12);
            if (q <= 0 || q >= 1) continue;
            const p = K.plAt(GULP_PATH, Ease.inOutCubic(q) * GULP_PATH.len);
            const r = 22 - k * 5;
            const gl = c.createRadialGradient(p.x, p.y, 0, p.x, p.y, r * 3.2);
            gl.addColorStop(0, rgb(PAL.aqua, 0.55));
            gl.addColorStop(1, rgb(PAL.aqua, 0));
            c.fillStyle = gl;
            c.fillRect(p.x - r * 3.2, p.y - r * 3.2, r * 6.4, r * 6.4);
            K.circle(c, p.x, p.y, r);
            c.fillStyle = k === 0 ? PAL.aquaLight : PAL.aqua;
            c.fill();
          }
        }
        // each glug: a glowing sip slides down the throat (x-ray)
        for (const gt of TL.GLUGS) {
          const a = t - (gt + 0.08);
          if (a < 0 || a > 0.55) continue;
          const q = a / 0.55;
          const p = K.plAt(GULP_PATH, Ease.inOutSine(q) * GULP_PATH.len * 0.5);
          const k = Math.sin(PI * q);
          const gl = c.createRadialGradient(p.x, p.y, 0, p.x, p.y, 46);
          gl.addColorStop(0, rgb(PAL.aqua, 0.5 * k));
          gl.addColorStop(1, rgb(PAL.aqua, 0));
          c.fillStyle = gl;
          c.fillRect(p.x - 46, p.y - 46, 92, 92);
          K.ellipse(c, p.x, p.y, 17, 10, p.a);
          c.fillStyle = rgb(PAL.aquaLight, 0.95 * k);
          c.fill();
        }
        // the body filling up
        if (fill > 0) {
          const gw = c.createLinearGradient(0, level, 0, level + 700);
          gw.addColorStop(0, PAL.waterLight);
          gw.addColorStop(0.08, '#78DCFF');
          gw.addColorStop(0.5, PAL.water);
          gw.addColorStop(1, PAL.waterDeep);
          c.fillStyle = gw;
          const amp = 9 + 8 * Math.sin(PI * fill);
          c.beginPath();
          c.moveTo(-400, 1400);
          for (let x = -400; x <= 600; x += 10) {
            c.lineTo(x, level + amp * Math.sin(x * 0.02 + t * 4.5) + amp * 0.4 * Math.sin(x * 0.047 - t * 6.3));
          }
          c.lineTo(600, 1400);
          c.closePath();
          c.fill();
          c.save();
          c.clip();
          const R = K.rng(17);
          for (let i = 0; i < 34; i++) {
            const bx = -180 + R() * 520, sp = 90 + R() * 160;
            const span = 1250 - level + 40;
            const by = 1250 - K.fract(R() + (t * sp) / 900) * span;
            FX.bubble(c, bx + Math.sin(t * 2 + i) * 8, by, 4 + R() * 10, 0.8, { rim: 'rgba(255,255,255,0.65)' });
          }
          c.restore();
          c.beginPath();
          for (let x = -400; x <= 600; x += 10) {
            const yy = level + amp * Math.sin(x * 0.02 + t * 4.5) + amp * 0.4 * Math.sin(x * 0.047 - t * 6.3);
            if (x === -400) c.moveTo(x, yy);
            else c.lineTo(x, yy);
          }
          c.lineWidth = 7;
          c.strokeStyle = 'rgba(255,255,255,0.9)';
          c.stroke();
        }
      },
    });
    ctx.restore();
  }

  function drawGauge(ctx, t, th) {
    const a = Ease.outCubic(prog(t, TL.FILL[0] - 0.25, TL.FILL[0] + 0.2));
    const out = Ease.inCubic(prog(t, TL.AHHH - 0.35, TL.AHHH - 0.05));
    if (a <= 0 || out >= 1) return;
    const fill = fillLevel(t);
    ctx.save();
    ctx.translate((1 - a) * 260 + out * 300, 0);
    ctx.globalAlpha = a * (1 - out);
    const x = 868, y0 = 840, h = 700, w = 96;
    K.rrect(ctx, x, y0, w, h, w / 2);
    ctx.fillStyle = 'rgba(255,255,255,0.14)';
    ctx.fill();
    ctx.lineWidth = 5;
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.stroke();
    ctx.save();
    K.rrect(ctx, x + 10, y0 + 10, w - 20, h - 20, (w - 20) / 2);
    ctx.clip();
    const lvl = y0 + 10 + (h - 20) * (1 - fill);
    const g = ctx.createLinearGradient(0, lvl, 0, y0 + h);
    g.addColorStop(0, PAL.waterLight);
    g.addColorStop(0.2, PAL.aqua);
    g.addColorStop(1, PAL.azure);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(x, y0 + h);
    for (let xx = x; xx <= x + w; xx += 4) ctx.lineTo(xx, lvl + 4 * Math.sin(xx * 0.12 + t * 7));
    ctx.lineTo(x + w, y0 + h);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    // ticks
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    for (let i = 1; i < 10; i++) ctx.fillRect(x - 22, y0 + (h * i) / 10 - 2, i % 5 === 0 ? 16 : 9, 4);
    // readout
    const pct = Math.round(fill * 100);
    K.font(ctx, 66, 800);
    ctx.textAlign = 'center';
    ctx.fillStyle = th.text;
    const pop = 1 + 0.18 * K.wobble(t - TL.FILL[1], 2, 5);
    ctx.save();
    ctx.translate(x + w / 2, y0 - 46);
    ctx.scale(pop, pop);
    ctx.fillText(pct + '%', 0, 0);
    ctx.restore();
    K.font(ctx, 24, 700, K.FONT.mono);
    ctx.letterSpacing = '5px';
    ctx.globalAlpha *= 0.75;
    ctx.fillText('HYDRATION', x + w / 2 - 10, y0 + h + 58);
    ctx.letterSpacing = '0px';
    ctx.restore();
  }

  function shotWorld(ctx, t, name) {
    const th = THEME[name];
    FX.backdrop(ctx, th.bg, { glow: name === 'cobalt' ? 0 : 0.18 });
    decor(ctx, t, name, th);
    const cam = camAt(t);
    const st = bottleAt(t);
    const m = bottleMatrix(st);

    // ground shadow (step 1)
    if (st.vis && t < TL.ZOOM[1]) {
      const h = clamp((GROUND - (st.y + PIV * S * st.sy)) / 900);
      const fall = st.y < Y_LAND - 5 && t < TL.BOTTLE_FALL[1] ? prog(st.y, -520, Y_LAND) : 1;
      const k = (1 - h * 0.7) * fall;
      ctx.save();
      applyCam(ctx, cam);
      K.ellipse(ctx, 540, GROUND + 8, 128 * S * (0.45 + 0.55 * k) * st.sx, 22 * (0.5 + 0.5 * k));
      ctx.fillStyle = rgb(name === 'yellow' ? '#A86A00' : PAL.navy, 0.28 * k);
      ctx.fill();
      ctx.restore();
    }

    ctx.save();
    const [shx, shy] = shake(t);
    ctx.translate(shx, shy);
    applyCam(ctx, cam);
    const px = cam.z * S;

    if (name === 'cobalt' && t > TL.TILT_WIPE[0]) drawDrinker(ctx, t);

    // twist arrow (back half behind the cap)
    const arrowA = K.win(t, TL.TWISTS[0] - 0.3, TL.TWISTS[0], TL.TWISTS[2] + TL.TWIST_DUR, TL.POP - 0.15);
    const capC = st.capOn ? capWorldNow(t, st) : null;
    const arrowDraw = Ease.outCubic(prog(t, TL.TWISTS[0] - 0.3, TL.TWISTS[0] + 0.1));
    const arc = (part) => {
      if (!capC || arrowA <= 0) return;
      const pulse = TL.TWISTS.reduce((s, tt) => s + K.wobble(t - tt, 2, 6), 0);
      ctx.save();
      ctx.globalAlpha = arrowA;
      FX.arcArrow(ctx, capC[0], capC[1] + 6, 98 * S * (1 + 0.03 * pulse), 30 * S, -0.62 * PI, lerp(-0.62 * PI, 0.86 * PI, arrowDraw), {
        width: 9, color: PAL.coral, part,
      });
      ctx.restore();
    };
    arc('back');

    if (st.vis) {
      Bottle.drawBottle(ctx, {
        m, px, t, fill: st.fill, surf: sloshAt(t), wave: st.wave, spin: st.spin,
        capOn: st.capOn, capRise: st.capRise, capSpin: st.capSpin, cracked: st.cracked,
        glugs: st.glugs, dark: th.dark,
        glint: prog(t, TL.BOTTLE_FALL[1] + 0.3, TL.BOTTLE_FALL[1] + 0.85),
      });
    }
    arc('front');

    // the hand rides along in bottle space
    const hand = handAt(t);
    if (hand && st.vis) {
      ctx.save();
      ctx.transform(m[0], m[1], m[2], m[3], m[4], m[5]);
      Cast.drawHand(ctx, { R: 100, u: 118, reach: hand.reach, grip: hand.grip });
      ctx.restore();
    }

    // landing impact lines + grip sparkle
    const la = t - TL.BOTTLE_FALL[1];
    if (la > 0 && la < 0.4) {
      const q = la / 0.4;
      ctx.save();
      ctx.lineCap = 'round';
      ctx.lineWidth = 7 * (1 - q);
      ctx.strokeStyle = PAL.navy;
      for (const sgn of [-1, 1]) {
        for (let i = 0; i < 3; i++) {
          const ang = sgn > 0 ? -0.25 - i * 0.42 : PI + 0.25 + i * 0.42;
          const r0 = 140 + 70 * Ease.outCubic(q), r1 = r0 + 46 * (1 - q);
          ctx.beginPath();
          ctx.moveTo(540 + Math.cos(ang) * r0, GROUND + Math.sin(ang) * r0 * 0.5);
          ctx.lineTo(540 + Math.cos(ang) * r1, GROUND + Math.sin(ang) * r1 * 0.5);
          ctx.stroke();
        }
      }
      ctx.restore();
    }
    if (st.vis && t > TL.GRIP - 0.05 && t < TL.GRIP + 0.8) {
      const [gx, gy] = K.Mx.ap(m, -96, -186);
      FX.sparkles(ctx, gx, gy, t - TL.GRIP, { n: 5, r: 70, size: 26, colors: ['#ffffff', PAL.navy] });
    }
    // lift speed lines
    const ls = prog(t, TL.LIFT[0] + 0.15, TL.LIFT[0] + 0.6);
    if (ls > 0 && ls < 1 && st.vis) {
      ctx.save();
      ctx.lineCap = 'round';
      ctx.strokeStyle = rgb(PAL.navy, 0.5 * Math.sin(PI * ls));
      ctx.lineWidth = 7;
      const baseY = st.y + PIV * S + 40;
      for (let i = -1; i <= 1; i++) {
        const y = baseY + 30 + ls * 120 + Math.abs(i) * 30;
        ctx.beginPath();
        ctx.moveTo(540 + i * 70, y);
        ctx.lineTo(540 + i * 70, y + 70 * (1 - ls));
        ctx.stroke();
      }
      ctx.restore();
    }
    // step 2 fx: click ticks, seal crack, pop
    if (capC) {
      for (const tt of TL.TWISTS) {
        const a = t - (tt + TL.TWIST_DUR - 0.02);
        if (a > 0 && a < 0.3) {
          FX.burst(ctx, capC[0] - 64 * S, capC[1] + 10, a, { n: 3, rot: PI - 0.5, r0: 6, reach: 26, len: 20, width: 4, life: 0.3, color: PAL.navy });
        }
      }
      const ca = t - TL.CRACK;
      if (ca > 0 && ca < 0.5) {
        const band = K.Mx.ap(m, 0, -(B.bandLo + B.bandHi) / 2);
        FX.burst(ctx, band[0] + 60 * S, band[1], ca, { n: 5, rot: -0.9, r0: 10, reach: 40, len: 24, width: 5, life: 0.45, color: PAL.coral });
        FX.burst(ctx, band[0] - 60 * S, band[1], ca, { n: 5, rot: PI - 0.9, r0: 10, reach: 40, len: 24, width: 5, life: 0.45, color: PAL.coral });
      }
    }
    const pa = t - TL.POP;
    if (pa > 0 && pa < 0.8) {
      const st0 = bottleAt(TL.POP - 1e-3);
      const mo = K.Mx.ap(bottleMatrix(st0), 0, -B.top);
      FX.burst(ctx, mo[0], mo[1], pa, { n: 10, r0: 30, reach: 120, len: 50, width: 6, life: 0.4, color: PAL.coral });
      const R = K.rng(5);
      for (let i = 0; i < 26; i++) {
        const ang = -PI / 2 + (R() - 0.5) * 1.6, sp = 300 + R() * 520;
        const aa = pa - R() * 0.06;
        if (aa <= 0) continue;
        const x = mo[0] + Math.cos(ang) * sp * aa, y = mo[1] + Math.sin(ang) * sp * aa + 500 * aa * aa;
        K.circle(ctx, x, y, (2 + R() * 4) * (1 - pa));
        ctx.fillStyle = i % 2 ? '#ffffff' : PAL.aqua;
        ctx.fill();
      }
    }
    drawFlyingCap(ctx, t);
    ctx.restore();

    // screen-space call-outs
    if (pa > 0 && pa < 0.75) {
      const e = Ease.outBack(prog(pa, 0, 0.25));
      const out = Ease.inCubic(prog(pa, 0.5, 0.75));
      ctx.save();
      ctx.translate(760, 760);
      ctx.rotate(-0.16);
      ctx.scale(e * (1 - out * 0.3), e * (1 - out * 0.3));
      ctx.globalAlpha = 1 - out;
      K.font(ctx, 118, 900);
      ctx.textAlign = 'center';
      ctx.fillStyle = PAL.navy;
      ctx.fillText('POP!', 7, 7);
      ctx.fillStyle = PAL.coral;
      ctx.fillText('POP!', 0, 0);
      ctx.restore();
    }
    if (name === 'cobalt') {
      // glug glug
      TL.GLUGS.forEach((g, i) => {
        const a = t - g;
        if (a < 0 || a > 0.6) return;
        const lw = toScreen(cam, ...lipsWorld(t));
        const e = Ease.outBack(prog(a, 0, 0.2));
        const out = Ease.inQuad(prog(a, 0.38, 0.6));
        ctx.save();
        ctx.translate(lw[0] + 150 + (i % 2) * 110, lw[1] + 150 + (i % 2) * 70 - a * 50);
        ctx.rotate(i % 2 ? 0.14 : -0.12);
        ctx.scale(e * (1 + out * 0.2), e * (1 + out * 0.2));
        ctx.globalAlpha = 1 - out;
        K.font(ctx, 62, 900);
        ctx.textAlign = 'center';
        ctx.fillStyle = PAL.navy;
        ctx.fillText('GLUG', 5, 5);
        ctx.fillStyle = '#FFFFFF';
        ctx.fillText('GLUG', 0, 0);
        ctx.restore();
      });
      drawGauge(ctx, t, th);
      // AHHH
      const aa = t - TL.AHHH;
      if (aa > 0 && aa < 1.4) {
        const lw = toScreen(cam, ...lipsWorld(t));
        const [hx, hy] = toScreen(cam, ...bustToWorld(t, 180, 200));
        FX.sparkles(ctx, hx, hy, aa, { n: 9, r: 330, size: 44, colors: ['#ffffff', PAL.yellow, PAL.aquaLight], seed: 31, life: 1.0 });
        // refresh rays around the head
        ctx.save();
        ctx.lineCap = 'round';
        const q = prog(aa, 0, 0.6);
        ctx.strokeStyle = rgb(PAL.yellow, 1 - q);
        ctx.lineWidth = 9 * (1 - q) + 2;
        for (let i = 0; i < 9; i++) {
          const ang = -PI * 0.95 + (i / 8) * PI * 0.9;
          const r0 = 300 + 80 * Ease.outCubic(q), r1 = r0 + 60 * (1 - q);
          ctx.beginPath();
          ctx.moveTo(hx + Math.cos(ang) * r0, hy + Math.sin(ang) * r0);
          ctx.lineTo(hx + Math.cos(ang) * r1, hy + Math.sin(ang) * r1);
          ctx.stroke();
        }
        ctx.restore();
        const word = 'AHHH';
        K.kinetic(ctx, word, {
          x: lw[0] + 22, y: lw[1] + 6, size: 80, color: PAL.yellow,
          fn: (i) => {
            const p = prog(aa, i * 0.06, i * 0.06 + 0.4);
            const out2 = prog(aa, 1.05, 1.35);
            return { s: Ease.outBack(p) * (1 - out2), dy: Math.sin(t * 9 + i * 0.9) * 8 - out2 * 40, r: -0.12, a: 1 - out2 };
          },
        });
      }
    }
    vignette(ctx, VIG[name]);
    header(ctx, t, th);
  }

  // =================================================================
  // shot 5 — recycle it (mint)
  // =================================================================
  const BIN = { x: 540, y: 1440 };
  const RS = 0.95; // bottle scale in this shot
  const RC = { x: 540, y: 930, R: 250 }; // big recycle symbol, final

  function recycleBottleAt(t) {
    const st = { vis: false, x: 540, y: 930, rot: 0, s: RS, sx: 1, sy: 1, spin: 0, crush: 0, capOn: false, capRise: 0, capSpin: 0 };
    const [i0, i1] = TL.BOTTLE_IN;
    if (t < i0) return st;
    st.vis = true;
    const q = prog(t, i0, i1);
    st.y = lerp(-520, 930, Ease.outBack(q));
    st.rot = 0.35 * (1 - Ease.outCubic(q)) + 0.06 * K.wobble(t - i1, 1.6, 4);
    st.spin = 4.2 * (1 - Ease.outCubic(prog(t, i0, i1 + 0.4)));
    const [c0, c1] = TL.CAP_ON;
    if (t >= c0 + 0.24) {
      st.capOn = true;
      const sq = prog(t, c0 + 0.3, c1);
      st.capRise = 14 * (1 - Ease.inOutCubic(sq));
      st.capSpin = 2.8 * Ease.inOutCubic(sq);
    }
    const [k0, k1] = TL.CRUSH;
    st.crush = Ease.outBack(prog(t, k0, k1)) * 1;
    const ks = K.wobble(t - k0, 3, 6);
    st.sx = 1 + 0.08 * ks;
    const [t0, t1] = TL.TOSS;
    if (t >= t0) {
      // hop, flip one and a half turns, drop into the bin cap-first
      const up = Ease.outQuad(prog(t, t0, t0 + 0.18));
      const dn = Ease.inQuad(prog(t, t0 + 0.18, t1 + 0.16));
      st.y = 930 - 150 * up + 980 * dn;
      st.rot = -TAU * 1.5 * Ease.inOutSine(prog(t, t0, t1 - 0.05));
      st.s = RS * lerp(1, 0.72, prog(t, t0, t1));
      if (t > t1 + 0.16) st.vis = false;
    }
    return st;
  }

  function symbolAt(t) {
    const [s0, s1] = TL.SYMBOL;
    const q = Ease.outBack(prog(t, s0, s1));
    const qq = prog(t, s0, s1);
    const by = binY(t);
    const from = { x: BIN.x, y: by + 0.52 * 360, R: 84 };
    return {
      vis: t >= s0,
      x: lerp(from.x, RC.x, Ease.outCubic(qq)),
      y: lerp(from.y, RC.y, Ease.outCubic(qq)),
      R: lerp(from.R, RC.R, q),
      rot: (t - s0) * 2.4 + Ease.outCubic(qq) * 2,
      draw: Ease.outCubic(prog(t, s0, s1 - 0.1)),
    };
  }
  function binY(t) {
    return BIN.y + (1 - Ease.outBack(prog(t, TL.BUBBLES[0] + 0.35, TL.BUBBLES[0] + 0.95))) * 640;
  }

  function shotRecycle(ctx, t) {
    const th = THEME.mint;
    FX.backdrop(ctx, th.bg, { glow: 0.24, gy: 980 });
    // pulse rings
    ctx.save();
    for (let i = 0; i < 6; i++) {
      const r = 180 + i * 140 + ((t * 60) % 140);
      K.circle(ctx, 540, 930, r);
      ctx.lineWidth = 4;
      ctx.strokeStyle = `rgba(255,255,255,${0.16 * (1 - i / 6)})`;
      ctx.stroke();
    }
    ctx.restore();
    FX.particles(ctx, t, { alpha: 0.35, n: 24, seed: 12, color: '#ffffff' });

    ctx.save();
    ctx.translate(...shake(t));
    const by = binY(t);
    const hit = t - TL.BIN_HIT;
    const bsq = hit > 0 ? 0.1 * Math.exp(-6 * hit) * Math.cos(TAU * 2.4 * hit) : 0;
    const binOpt = { sx: 1 + bsq * 0.6, sy: 1 - bsq };
    FX.bin(ctx, BIN.x, by, 1, { ...binOpt, part: 'back' });

    const st = recycleBottleAt(t);
    if (st.vis) {
      const m = Bottle.bottleMatrix(st.x, st.y, st.rot, st.s, st.sx, st.sy, PIV);
      ctx.save();
      if (t > TL.TOSS[0] + 0.2) {
        ctx.beginPath();
        ctx.rect(0, 0, W, by + 330);
        ctx.clip();
      }
      // screw-on arrow, back half
      const [c0, c1] = TL.CAP_ON;
      const aw = K.win(t, c0 + 0.25, c0 + 0.35, c1 - 0.05, c1 + 0.15);
      const capC = K.Mx.ap(m, 0, -(CAP_C + st.capRise));
      const arc = (part) => {
        if (aw <= 0) return;
        ctx.save();
        ctx.globalAlpha = aw;
        FX.arcArrow(ctx, capC[0], capC[1] + 6, 98 * RS, 30 * RS, 1.36 * PI, lerp(1.36 * PI, 0.14 * PI, Ease.outCubic(prog(t, c0 + 0.25, c0 + 0.55))), {
          width: 9, color: PAL.coral, part,
        });
        ctx.restore();
      };
      arc('back');
      Bottle.drawBottle(ctx, {
        m, px: st.s, t, fill: 0, spin: st.spin, capOn: st.capOn, capRise: st.capRise, capSpin: st.capSpin,
        cracked: 1, crush: st.crush, dark: false,
        glint: prog(t, TL.BOTTLE_IN[1] + 0.02, TL.BOTTLE_IN[1] + 0.5),
      });
      arc('front');
      ctx.restore();
      // crunch lines
      const ka = t - TL.CRUSH[0];
      if (ka > 0 && ka < 0.45) {
        const mid = K.Mx.ap(m, 0, -150);
        FX.burst(ctx, mid[0] - 110 * RS, mid[1], ka, { n: 4, rot: PI - 0.6, r0: 16, reach: 60, len: 34, width: 7, life: 0.4, color: PAL.navy });
        FX.burst(ctx, mid[0] + 110 * RS, mid[1], ka, { n: 4, rot: -0.6, r0: 16, reach: 60, len: 34, width: 7, life: 0.4, color: PAL.navy });
      }
    }
    // the cap dropping in from above
    const [c0] = TL.CAP_ON;
    if (t >= c0 - 0.1 && t < c0 + 0.24) {
      const q = Ease.inQuad(prog(t, c0 - 0.1, c0 + 0.24));
      const st2 = recycleBottleAt(t);
      const m2 = Bottle.bottleMatrix(st2.x, st2.y, st2.rot, st2.s, 1, 1, PIV);
      const seat = K.Mx.ap(m2, 0, -(B.capSeat + 14));
      ctx.save();
      ctx.translate(seat[0], lerp(-160, seat[1], q));
      ctx.rotate((1 - q) * 1.6);
      ctx.scale(RS, RS);
      Bottle.drawCap(ctx, { spin: (1 - q) * 6 });
      ctx.restore();
    }
    FX.bin(ctx, BIN.x, by, 1, {
      ...binOpt,
      part: 'front',
      emblemRot: Ease.outCubic(prog(t, TL.BIN_HIT, TL.BIN_HIT + 0.6)) * TAU,
      emblemScale: 1 + 0.25 * Math.max(0, K.wobble(hit, 2, 5)),
    });
    if (hit > 0) FX.sparkles(ctx, BIN.x, by - 20, hit, { n: 8, r: 220, size: 34, colors: ['#ffffff', PAL.navy], seed: 44 });

    // the big symbol rises out of the bin
    const sy = symbolAt(t);
    if (sy.vis) {
      const g = ctx.createRadialGradient(sy.x, sy.y, 0, sy.x, sy.y, sy.R * 1.9);
      g.addColorStop(0, 'rgba(255,255,255,0.5)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(sy.x - sy.R * 2, sy.y - sy.R * 2, sy.R * 4, sy.R * 4);
      FX.recycle(ctx, sy.x, sy.y, sy.R, { color: PAL.navy, rot: sy.rot, draw: sy.draw });
    }
    ctx.restore();
    vignette(ctx, VIG.mint);
    header(ctx, t, th);
  }

  // =================================================================
  // shot 6 — outro: STAY HYDRATED (navy, loops back to the intro)
  // =================================================================
  function drawOutroTitle(g, t) {
    const [d0, d1] = TL.DRAIN;
    const sink = (i, n, delay) => Ease.inBack(prog(t, d0 + 0.2 + delay + i * 0.03, d0 + 0.75 + delay + i * 0.03)) * 560;
    // droplet: born inside the recycle symbol's hole, shoots up into place,
    // bobs, then rises off-screen (it falls again when the loop restarts)
    const grow = Ease.outBack(prog(t, 21.45, 22.0));
    const rise = Ease.outCubic(prog(t, 22.0, 22.5));
    const away = Ease.inCubic(prog(t, d0 + 0.1, d1 - 0.1));
    const bob = Math.sin((t - 22.5) * 2.6) * 8 * prog(t, 22.5, 22.9);
    const dyy = lerp(lerp(930, 600, rise) + bob, -140, away);
    if (grow > 0.01)
      FX.droplet(g, 540, dyy, lerp(46 * grow, 28, away), { glow: 1, sy: 1 + 0.25 * away + 0.14 * Math.sin(PI * rise) });
    K.kinetic(g, 'STAY', {
      x: 540, y: 900, size: 196, align: 'center', color: '#FFFFFF',
      fn: (i) => {
        const p = prog(t, 22.12 + i * 0.05, 22.12 + i * 0.05 + 0.5);
        return { a: clamp(p * 5), dy: (1 - Ease.outCubic(p)) * 50 + sink(i, 4, 0.08), s: Ease.outBack(p) };
      },
    });
    K.font(g, 112, 900);
    const ww = K.charLayout(g, 'HYDRATED.').width;
    const fill = Ease.inOutSine(prog(t, TL.OUTRO_FILL[0], TL.OUTRO_FILL[1])) * (1 - Ease.inCubic(prog(t, d0, d0 + 0.42)));
    liquidText(g, 'HYDRATED.', {
      x: 540, y: 1084, size: 112, align: 'center', width: ww, outline: PAL.aqua, strokeW: 3.5, fill, t,
      slosh: 0.3,
      fn: (i) => {
        const p = prog(t, 22.25 + i * 0.04, 22.25 + i * 0.04 + 0.55);
        return { dy: (1 - Ease.outBack(p)) * 260 + sink(i, 9, 0), a: p > 0 ? 1 : 0 };
      },
    });
    // REPEAT DAILY ↻
    const typed = Math.floor(clamp(prog(t, 23.15, 23.65)) * 12.99);
    const tsink = sink(0, 1, 0.12);
    if (typed > 0) {
      g.save();
      g.translate(0, tsink);
      K.font(g, 34, 700, K.FONT.mono);
      g.letterSpacing = '12px';
      g.textAlign = 'center';
      g.fillStyle = PAL.aqua;
      g.fillText('REPEAT DAILY'.slice(0, typed), 520, 1210);
      g.letterSpacing = '0px';
      const ia = prog(t, 23.6, 23.85);
      if (ia > 0) {
        g.globalAlpha = ia;
        FX.arcArrow(g, 812, 1198, 19, 19, -PI * 0.6 + t * 3, -PI * 0.6 + t * 3 + PI * 1.5, { width: 6, color: PAL.aqua });
      }
      g.restore();
    }
  }

  function shotOutro(ctx, t) {
    FX.backdrop(ctx, PAL.navy, { glow: 0.12, glowColor: PAL.azure, gy: 900 });
    FX.rays(ctx, t, { alpha: 0.075 });
    FX.particles(ctx, t, { alpha: 0.45, rings: true, n: 40 });
    const amp = 4;
    waterBody(ctx, SURF, t, amp);
    const L = K.layer('title');
    drawOutroTitle(L.ctx, t);
    ctx.save();
    ctx.beginPath();
    ctx.rect(-200, -400, W + 400, SURF + 400);
    ctx.clip();
    ctx.drawImage(L.c, 0, 0);
    ctx.restore();
    reflect(ctx, L.c, SURF, t, 0.3);
    surfaceLine(ctx, SURF, t, amp);
    // ripple where the letters sink
    // (timed to fade out completely before the loop point)
    const sa = t - (TL.DRAIN[0] + 0.42);
    if (sa > 0) FX.ripples(ctx, 540, SURF, sa, { reach: 640, persp: 0.12, life: 0.7, n: 3, gap: 0.08, alpha: 0.6 });
    vignette(ctx, VIG.navy);
  }

  // =================================================================
  // transitions + frame dispatch
  // =================================================================
  function waveWipe(ctx, t) {
    shotIntro(ctx, t);
    const [w0, w1] = TL.WAVE;
    const y2 = lerp(H + 140, -220, Ease.inOutCubic(prog(t, w0 + 0.2, w0 + 0.8)));
    ctx.fillStyle = PAL.aqua;
    FX.wavePath(ctx, y2, t, { amp: 40, k: 0.007, speed: 5, phase: 1.3 });
    ctx.fill();
    // bubbles riding the waves
    const R = K.rng(61);
    for (let i = 0; i < 26; i++) {
      const x = R() * W, d = R() * 0.5, r = 8 + R() * 26;
      const q = prog(t, w0 + d, w0 + d + 0.55);
      if (q <= 0 || q >= 1) continue;
      FX.bubble(ctx, x + Math.sin(q * 8 + i) * 16, lerp(H + 60, -80, Ease.inQuad(q)), r, 1 - q * 0.3);
    }
    const y3 = lerp(H + 180, -240, Ease.inOutCubic(prog(t, w0 + 0.36, w1)));
    ctx.save();
    FX.wavePath(ctx, y3, t, { amp: 46, k: 0.0065, speed: 5.5, phase: 2.6 });
    ctx.clip();
    shotWorld(ctx, t, 'yellow');
    ctx.restore();
    ctx.save();
    ctx.lineWidth = 12;
    ctx.strokeStyle = 'rgba(255,255,255,0.92)';
    FX.waveLine(ctx, y3, t, { amp: 46, k: 0.0065, speed: 5.5, phase: 2.6 });
    ctx.stroke();
    ctx.restore();
  }

  function irisWipe(ctx, t) {
    shotWorld(ctx, t, 'yellow');
    const c = camAt(t);
    const st = bottleAt(t);
    const [cx, cy] = toScreen(c, ...capWorldNow(t, st));
    // the iris opens from the cap's own silhouette outwards
    const capR = B.capR * S * c.z * 1.12;
    const q = Ease.inCubic(prog(t, TL.ZOOM[0] + 0.12, TL.ZOOM[1]));
    if (q <= 0) return;
    const r = capR + 2100 * q;
    ctx.save();
    K.circle(ctx, cx, cy, r);
    ctx.clip();
    shotWorld(ctx, t, 'ice');
    ctx.restore();
    K.circle(ctx, cx, cy, r);
    ctx.lineWidth = 16;
    ctx.strokeStyle = `rgba(255,255,255,${0.9 * clamp(q * 12)})`;
    ctx.stroke();
  }

  function clockWipe(ctx, t) {
    shotWorld(ctx, t, 'ice');
    const [a0, a1] = TL.TILT_WIPE;
    const q = Ease.inOutQuad(prog(t, a0, a1 - 0.08));
    if (q <= 0) return;
    const c = camAt(t);
    const st = bottleAt(t);
    const [px, py] = toScreen(c, st.x, st.y);
    const start = -PI / 2 + st.rot;
    const end = start - TAU * q;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.arc(px, py, 3200, start, end, true);
    ctx.closePath();
    ctx.clip();
    shotWorld(ctx, t, 'cobalt');
    ctx.restore();
    if (q < 1) {
      ctx.save();
      ctx.lineCap = 'round';
      ctx.lineWidth = 10;
      ctx.strokeStyle = 'rgba(255,255,255,0.85)';
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(px + Math.cos(end) * 3200, py + Math.sin(end) * 3200);
      ctx.stroke();
      ctx.restore();
    }
  }

  const BUBS = (() => {
    const R = K.rng(77);
    const list = [];
    const cols = 4, rows = 7;
    for (let j = 0; j < rows; j++)
      for (let i = 0; i < cols; i++) {
        const x = (i + 0.5 + (R() - 0.5) * 0.6) * (W / cols);
        const y = (j + 0.5 + (R() - 0.5) * 0.6) * (H / rows);
        list.push({ x, y, delay: (y / H) * -0.32 + 0.32 + R() * 0.08, rmax: 290 + R() * 90 });
      }
    return list;
  })();
  function bubbleWipe(ctx, t) {
    shotWorld(ctx, t, 'cobalt');
    const [b0] = TL.BUBBLES;
    const live = [];
    ctx.save();
    ctx.beginPath();
    for (const b of BUBS) {
      const q = prog(t, b0 + b.delay, b0 + b.delay + 0.32);
      if (q <= 0) continue;
      const r = b.rmax * Ease.outCubic(q);
      const y = b.y + (1 - Ease.outCubic(q)) * 140;
      ctx.moveTo(b.x + r, y);
      ctx.arc(b.x, y, r, 0, TAU);
      live.push([b.x, y, r, q]);
    }
    ctx.clip();
    shotRecycle(ctx, t);
    ctx.restore();
    for (const [x, y, r, q] of live) {
      if (q >= 1) continue;
      ctx.save();
      const a = Math.pow(1 - q, 2.6);
      K.circle(ctx, x, y, r);
      ctx.lineWidth = 14 * (1 - q) + 3;
      ctx.strokeStyle = `rgba(255,255,255,${0.75 * a})`;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x, y, r * 0.78, PI * 1.08, PI * 1.42);
      ctx.lineWidth = 12 * (1 - q) + 3;
      ctx.lineCap = 'round';
      ctx.strokeStyle = `rgba(255,255,255,${0.9 * a})`;
      ctx.stroke();
      ctx.restore();
    }
  }

  function throughWipe(ctx, t) {
    const [z0, z1] = TL.ZOOM_THROUGH;
    const q = prog(t, z0, z1);
    const zoom = Math.exp(Math.log(18) * Ease.inQuart(q));
    const sy = symbolAt(t);
    ctx.save();
    ctx.translate(sy.x, sy.y);
    ctx.scale(zoom, zoom);
    ctx.translate(-sy.x, -sy.y);
    shotRecycle(ctx, t);
    ctx.restore();
    const r = sy.R * 0.34 * zoom * Ease.outCubic(clamp(q * 3.5));
    if (r < 0.5) return;
    ctx.save();
    K.circle(ctx, sy.x, sy.y, r);
    ctx.clip();
    const s2 = lerp(1.35, 1, Ease.outCubic(q));
    ctx.translate(sy.x, sy.y);
    ctx.scale(s2, s2);
    ctx.translate(-sy.x, -sy.y);
    shotOutro(ctx, t);
    ctx.restore();
  }

  function renderScene(ctx, t) {
    if (t < TL.WAVE[0]) return shotIntro(ctx, t);
    if (t < TL.WAVE[1]) return waveWipe(ctx, t);
    if (t < TL.ZOOM[0] + 0.12) return shotWorld(ctx, t, 'yellow');
    if (t < TL.ZOOM[1]) return irisWipe(ctx, t);
    if (t < TL.TILT_WIPE[0]) return shotWorld(ctx, t, 'ice');
    if (t < TL.TILT_WIPE[1]) return clockWipe(ctx, t);
    if (t < TL.BUBBLES[0]) return shotWorld(ctx, t, 'cobalt');
    if (t < TL.BUBBLES[1]) return bubbleWipe(ctx, t);
    if (t < TL.ZOOM_THROUGH[0]) return shotRecycle(ctx, t);
    if (t < TL.ZOOM_THROUGH[1]) return throughWipe(ctx, t);
    return shotOutro(ctx, t);
  }

  // post-processing parameters for the WebGL pass
  function postAt(t) {
    // (the vignette lives in the shots, under the type; see vignette())
    const P = { rx: 540, ry: 960, rage: -1, ramp: 0, wobble: 0, zx: 540, zy: 960, zs: 0, ca: 0, grain: 0.03, vig: 0 };
    const head = () => {
      const c = camAt(t);
      return toScreen(c, ...bustToWorld(t, 200, 200));
    };
    const shocks = [
      [TL.DROP_HIT, () => [540, SURF], 22],
      [TL.AHHH, head, 16],
      [TL.BIN_HIT, () => [540, binY(t)], 10],
    ];
    for (const [t0, at, amp] of shocks) {
      if (t >= t0 && t < t0 + 0.95) {
        const [x, y] = at();
        P.rx = x;
        P.ry = y;
        P.rage = t - t0;
        P.ramp = amp;
      }
    }
    P.wobble = K.win(t, TL.WAVE[0] + 0.15, TL.BEAT_DROP - 0.1, TL.BEAT_DROP + 0.1, TL.WAVE[1] - 0.05);
    const bell = (a, b) => Math.pow(Math.sin(PI * prog(t, a, b)), 2);
    if (t > TL.ZOOM[0] && t < TL.ZOOM[1]) {
      const c = camAt(t);
      const [x, y] = toScreen(c, ...capWorldNow(t, bottleAt(t)));
      P.zx = x;
      P.zy = y;
      P.zs = 0.85 * bell(TL.ZOOM[0], TL.ZOOM[1]);
    }
    if (t > TL.DIVE[0] && t < TL.DIVE[1]) P.zs = 0.32 * bell(TL.DIVE[0], TL.DIVE[1]);
    if (t > TL.ZOOM_THROUGH[0] && t < TL.ZOOM_THROUGH[1]) {
      const sy = symbolAt(t);
      P.zx = sy.x;
      P.zy = sy.y;
      P.zs = 1.1 * bell(TL.ZOOM_THROUGH[0] + 0.15, TL.ZOOM_THROUGH[1]);
    }
    P.ca = 0.0035 * P.zs + 0.004 * P.wobble + (P.rage >= 0 ? 0.004 * Math.exp(-6 * P.rage) : 0);
    return P;
  }

  G.Film = { renderScene, postAt, THEME, camAt, bottleAt };
})(typeof window !== 'undefined' ? window : globalThis);

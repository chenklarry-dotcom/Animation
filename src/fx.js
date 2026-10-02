// fx.js — droplets, splashes, ripples, bubbles, waves, arrows, icons.
(function (G) {
  'use strict';
  const K = G.K;
  const { PAL, rgb, clamp, lerp, TAU, PI, Ease } = K;
  const LOOP = 26; // particles & ambient motion are periodic over the film

  // ------------------------------------------------------------- backdrop
  function backdrop(ctx, color, opts = {}) {
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, K.W, K.H);
    if (opts.glow !== 0) {
      const g = ctx.createRadialGradient(opts.gx || 540, opts.gy || 1050, 0, opts.gx || 540, opts.gy || 1050, opts.gr || 1250);
      g.addColorStop(0, rgb(opts.glowColor || '#ffffff', opts.glow == null ? 0.16 : opts.glow));
      g.addColorStop(1, rgb(opts.glowColor || '#ffffff', 0));
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, K.W, K.H);
    }
  }

  function grid(ctx, color, alpha, size = 72, ox = 0, oy = 0) {
    ctx.save();
    ctx.strokeStyle = rgb(color, alpha);
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let x = K.mod(ox, size); x < K.W; x += size) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, K.H);
    }
    for (let y = K.mod(oy, size); y < K.H; y += size) {
      ctx.moveTo(0, y);
      ctx.lineTo(K.W, y);
    }
    ctx.stroke();
    ctx.restore();
  }

  // drifting specks / mini bubbles (periodic over LOOP seconds)
  function particles(ctx, t, opts = {}) {
    const n = opts.n || 46;
    const R = K.rng(opts.seed || 3);
    const span = K.H + 200;
    ctx.save();
    for (let i = 0; i < n; i++) {
      const x0 = R() * K.W, y0 = R() * span, depth = R();
      const k = depth > 0.6 ? 2 : 1;
      const y = K.mod(y0 - (k * span * t) / LOOP, span) - 100;
      const x = x0 + Math.sin((TAU * (1 + (i % 3)) * t) / LOOP + i) * (14 + 26 * depth);
      const r = 1.5 + depth * depth * (opts.big || 7);
      const tw = 0.55 + 0.45 * Math.sin((TAU * (2 + (i % 4)) * t) / LOOP + i * 1.7);
      const a = (opts.alpha || 0.5) * (0.25 + 0.75 * depth) * tw;
      if (opts.rings && r > 4) {
        K.circle(ctx, x, y, r);
        ctx.lineWidth = 1.6;
        ctx.strokeStyle = rgb(opts.color || '#ffffff', a);
        ctx.stroke();
      } else {
        K.circle(ctx, x, y, r * 0.6);
        ctx.fillStyle = rgb(opts.color || '#ffffff', a);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  // soft light shafts from the top
  function rays(ctx, t, opts = {}) {
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    const n = 5;
    for (let i = 0; i < n; i++) {
      const sway = Math.sin((TAU * (1 + (i % 2)) * t) / LOOP + i * 1.3) * 60;
      const x = 120 + i * 210 + sway;
      const w0 = 60 + (i % 3) * 30, w1 = 220 + (i % 2) * 120;
      const g = ctx.createLinearGradient(0, 0, 0, opts.len || 1300);
      const a = (opts.alpha || 0.07) * (0.6 + 0.4 * Math.sin((TAU * 3 * t) / LOOP + i * 2.1));
      g.addColorStop(0, rgb(opts.color || PAL.aqua, a));
      g.addColorStop(1, rgb(opts.color || PAL.aqua, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(x - w0 / 2, -10);
      ctx.lineTo(x + w0 / 2, -10);
      ctx.lineTo(x + w1 / 2 + 140, opts.len || 1300);
      ctx.lineTo(x - w1 / 2 + 140, opts.len || 1300);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  // -------------------------------------------------------------- droplet
  function dropletPath(ctx, r, k = 2.15) {
    ctx.beginPath();
    ctx.moveTo(0, -r * k);
    ctx.bezierCurveTo(r * 0.5, -r * k * 0.58, r, -r * 0.62, r, 0);
    ctx.arc(0, 0, r, 0, PI);
    ctx.bezierCurveTo(-r, -r * 0.62, -r * 0.5, -r * k * 0.58, 0, -r * k);
    ctx.closePath();
  }
  // teardrop, tip up; (x, y) = centre of the round part
  function droplet(ctx, x, y, r, opts = {}) {
    ctx.save();
    ctx.translate(x, y);
    if (opts.rot) ctx.rotate(opts.rot);
    ctx.scale(opts.sx || 1, opts.sy || 1);
    if (opts.glow) {
      const g = ctx.createRadialGradient(0, -r * 0.3, 0, 0, -r * 0.3, r * 4);
      g.addColorStop(0, rgb(PAL.aqua, 0.35 * opts.glow));
      g.addColorStop(1, rgb(PAL.aqua, 0));
      ctx.fillStyle = g;
      ctx.fillRect(-r * 4, -r * 4.3, r * 8, r * 8);
    }
    dropletPath(ctx, r, opts.k);
    const g = ctx.createLinearGradient(-r, -r * 2, r, r);
    g.addColorStop(0, opts.c0 || '#C9F6FF');
    g.addColorStop(0.45, opts.c1 || PAL.aqua);
    g.addColorStop(1, opts.c2 || PAL.azure);
    ctx.fillStyle = g;
    ctx.fill();
    if (opts.stroke) {
      ctx.lineWidth = opts.stroke;
      ctx.strokeStyle = opts.strokeColor || '#ffffff';
      ctx.stroke();
    }
    // highlights
    ctx.beginPath();
    ctx.ellipse(-r * 0.38, -r * 0.35, r * 0.17, r * 0.34, 0.5, 0, TAU);
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.72, 0.15 * PI, 0.55 * PI);
    ctx.lineWidth = r * 0.1;
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(255,255,255,0.45)';
    ctx.stroke();
    ctx.restore();
  }

  // ------------------------------------------------------------- splashes
  // crown sheet + Worthington jet + flung drops. age in seconds.
  function splash(ctx, x, y, age, opts = {}) {
    if (age < 0 || age > 1.6) return;
    const s = opts.scale || 1;
    const R = K.rng(opts.seed || 11);
    const c = opts.color || PAL.aqua;
    const light = opts.light || '#D9FAFF';
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);
    // crown sheet
    const ca = clamp(age / 0.42);
    if (ca < 1) {
      const spread = 40 + 150 * Ease.outCubic(ca);
      const hgt = 120 * Math.sin(PI * Math.min(1, ca * 1.15)) * (1 - ca * 0.3);
      const spikes = 7;
      ctx.beginPath();
      ctx.moveTo(-spread * 0.55, 6);
      for (let i = 0; i <= spikes * 2; i++) {
        const q = i / (spikes * 2);
        const px = lerp(-spread, spread, q);
        const edge = 1 - Math.pow(Math.abs(q - 0.5) * 2, 2) * 0.5;
        const spike = i % 2 === 0 ? 1 : 0.72;
        ctx.lineTo(px * (1 + 0.15 * (1 - edge)), -hgt * edge * spike - 4);
      }
      ctx.lineTo(spread * 0.55, 6);
      ctx.closePath();
      const g = ctx.createLinearGradient(0, -hgt, 0, 6);
      g.addColorStop(0, light);
      g.addColorStop(1, rgb(c, 0.9));
      ctx.globalAlpha = 1 - ca * 0.6;
      ctx.fillStyle = g;
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    // central jet with a pinched-off drop
    const ja = age - 0.1;
    if (ja > 0 && ja < 0.75) {
      const up = Math.sin(PI * clamp(ja / 0.55)) * 190;
      const w = 22 * (1 - ja / 0.9);
      if (up > 2) {
        K.rrect(ctx, -w / 2, -up, w, up + 6, w / 2);
        const g = ctx.createLinearGradient(0, -up, 0, 0);
        g.addColorStop(0, light);
        g.addColorStop(1, c);
        ctx.fillStyle = g;
        ctx.fill();
      }
      const da = ja - 0.2;
      if (da > 0) {
        const dy = -200 - 420 * da + 1600 * da * da;
        if (dy < 0) {
          ctx.save();
          ctx.translate(0, dy);
          K.circle(ctx, 0, 0, 13);
          ctx.fillStyle = light;
          ctx.fill();
          ctx.restore();
        }
      }
    }
    // flung droplets
    const n = opts.n || 18;
    const grav = 3400;
    for (let i = 0; i < n; i++) {
      const ang = -PI / 2 + (R() - 0.5) * 2.4;
      const sp = 650 + R() * 900;
      const vx = Math.cos(ang) * sp, vy = Math.sin(ang) * sp;
      const r0 = 4 + R() * 10;
      const a = age - R() * 0.05;
      if (a <= 0) continue;
      const px = vx * a, py = vy * a + 0.5 * grav * a * a;
      if (py > 40) continue;
      const vyy = vy + grav * a;
      const rr = r0 * (1 - a * 0.45);
      if (rr < 0.5) continue;
      const ang2 = Math.atan2(vyy, vx);
      const st = 1 + Math.min(1.4, Math.hypot(vx, vyy) / 1400);
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(ang2);
      K.ellipse(ctx, 0, 0, rr * st, rr);
      ctx.fillStyle = i % 3 === 0 ? '#ffffff' : light;
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  }

  // perspective ripple rings on a surface
  function ripples(ctx, x, y, age, opts = {}) {
    const n = opts.n || 3;
    ctx.save();
    for (let i = 0; i < n; i++) {
      const a = age - i * (opts.gap || 0.13);
      if (a <= 0) continue;
      const life = opts.life || 1.3;
      if (a > life) continue;
      const q = a / life;
      const rx = (opts.r0 || 30) + (opts.reach || 700) * Ease.outCubic(q);
      const ry = rx * (opts.persp || 0.16);
      K.ellipse(ctx, x, y, rx, ry);
      ctx.lineWidth = (opts.width || 7) * (1 - q) + 1;
      ctx.strokeStyle = rgb(opts.color || PAL.aqua, (opts.alpha || 0.9) * (1 - q) * (1 - q));
      ctx.stroke();
    }
    ctx.restore();
  }

  function bubble(ctx, x, y, r, a = 1, opts = {}) {
    if (r <= 0.5 || a <= 0) return;
    ctx.save();
    ctx.globalAlpha *= a;
    K.circle(ctx, x, y, r);
    ctx.fillStyle = opts.fill || 'rgba(190,240,255,0.16)';
    ctx.fill();
    ctx.lineWidth = Math.max(1.5, r * 0.09);
    ctx.strokeStyle = opts.rim || 'rgba(255,255,255,0.8)';
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x, y, r * 0.66, PI * 1.1, PI * 1.45);
    ctx.lineWidth = Math.max(1.5, r * 0.13);
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.stroke();
    ctx.restore();
  }

  // ---------------------------------------------------------------- waves
  // Fills everything below a travelling wave whose mean height is `y`.
  function wavePath(ctx, y, t, opts = {}) {
    const amp = opts.amp == null ? 30 : opts.amp;
    const k = opts.k || 0.008;
    const sp = opts.speed || 3;
    const ph = opts.phase || 0;
    ctx.beginPath();
    ctx.moveTo(-20, K.H + 40);
    for (let x = -20; x <= K.W + 20; x += 10) {
      const yy =
        y +
        amp * Math.sin(x * k + t * sp + ph) +
        amp * 0.45 * Math.sin(x * k * 2.3 - t * sp * 1.4 + ph * 1.7) +
        (opts.tilt || 0) * (x - 540);
      ctx.lineTo(x, yy);
    }
    ctx.lineTo(K.W + 20, K.H + 40);
    ctx.closePath();
  }
  function waveLine(ctx, y, t, opts = {}) {
    const amp = opts.amp == null ? 30 : opts.amp;
    const k = opts.k || 0.008;
    const sp = opts.speed || 3;
    const ph = opts.phase || 0;
    ctx.beginPath();
    for (let x = -20; x <= K.W + 20; x += 10) {
      const yy =
        y +
        amp * Math.sin(x * k + t * sp + ph) +
        amp * 0.45 * Math.sin(x * k * 2.3 - t * sp * 1.4 + ph * 1.7) +
        (opts.tilt || 0) * (x - 540);
      if (x === -20) ctx.moveTo(x, yy);
      else ctx.lineTo(x, yy);
    }
  }

  // --------------------------------------------------------------- arrows
  // elliptical arc arrow: from a0 to a1 (radians), arrowhead at a1.
  // part: 'back' draws only the far half, 'front' only the near half.
  function arcArrow(ctx, cx, cy, rx, ry, a0, a1, opts = {}) {
    const lw = opts.width || 12;
    const steps = 64;
    const pts = [];
    for (let i = 0; i <= steps; i++) {
      const a = lerp(a0, a1, i / steps);
      pts.push([cx + rx * Math.cos(a), cy + ry * Math.sin(a), Math.sin(a)]);
    }
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = opts.color || PAL.coral;
    ctx.fillStyle = opts.color || PAL.coral;
    ctx.lineWidth = lw;
    const want = opts.part;
    let drawing = false;
    ctx.beginPath();
    for (let i = 0; i < pts.length; i++) {
      const front = pts[i][2] >= 0;
      const ok = !want || (want === 'front' ? front : !front);
      if (ok) {
        if (!drawing) ctx.moveTo(pts[i][0], pts[i][1]);
        else ctx.lineTo(pts[i][0], pts[i][1]);
        drawing = true;
      } else drawing = false;
    }
    ctx.stroke();
    // head
    const end = pts[pts.length - 1], prev = pts[pts.length - 4];
    const headFront = end[2] >= 0;
    if (opts.head !== false && (!want || (want === 'front') === headFront)) {
      const ang = Math.atan2(end[1] - prev[1], end[0] - prev[0]);
      const hl = lw * 2.4;
      ctx.save();
      ctx.translate(end[0], end[1]);
      ctx.rotate(ang);
      ctx.beginPath();
      ctx.moveTo(hl * 0.55, 0);
      ctx.lineTo(-hl * 0.6, -hl * 0.7);
      ctx.lineTo(-hl * 0.6, hl * 0.7);
      ctx.closePath();
      ctx.lineJoin = 'round';
      ctx.lineWidth = lw * 0.5;
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
  }

  // radial burst of short strokes
  function burst(ctx, x, y, age, opts = {}) {
    const life = opts.life || 0.45;
    if (age < 0 || age > life) return;
    const q = age / life;
    const n = opts.n || 8;
    const r0 = (opts.r0 || 40) + (opts.reach || 90) * Ease.outCubic(q);
    const len = (opts.len || 50) * (1 - q);
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineWidth = (opts.width || 8) * (1 - q * 0.6);
    ctx.strokeStyle = opts.color || PAL.coral;
    for (let i = 0; i < n; i++) {
      const a = (opts.rot || 0) + (i / n) * TAU;
      ctx.beginPath();
      ctx.moveTo(x + Math.cos(a) * r0, y + Math.sin(a) * r0);
      ctx.lineTo(x + Math.cos(a) * (r0 + len), y + Math.sin(a) * (r0 + len));
      ctx.stroke();
    }
    ctx.restore();
  }

  // a few sparkles popping around a point
  function sparkles(ctx, x, y, age, opts = {}) {
    const life = opts.life || 0.9;
    if (age < 0 || age > life + 0.4) return;
    const R = K.rng(opts.seed || 5);
    const n = opts.n || 6;
    ctx.save();
    for (let i = 0; i < n; i++) {
      const delay = R() * (opts.spread || 0.3);
      const a = age - delay;
      if (a < 0 || a > life) continue;
      const q = a / life;
      const ang = R() * TAU, d = (opts.r || 120) * (0.5 + R() * 0.7);
      const s = Math.sin(PI * q) * (opts.size || 26) * (0.6 + R() * 0.6);
      K.sparkle(ctx, x + Math.cos(ang) * d, y + Math.sin(ang) * d, s, q * 0.8);
      ctx.fillStyle = (opts.colors || ['#ffffff'])[i % (opts.colors || ['#ffffff']).length];
      ctx.fill();
    }
    ctx.restore();
  }

  // ------------------------------------------------------------- recycle
  // Three chasing arrows around a rounded triangle.
  // draw: 0..1 (arrow growth), rot: radians
  function recyclePath(R, rc) {
    const verts = [0, 1, 2].map((i) => {
      const a = -PI / 2 + (i * TAU) / 3;
      return [Math.cos(a) * R, Math.sin(a) * R];
    });
    const pts = [];
    for (let i = 0; i < 3; i++) {
      const v = verts[i], p = verts[(i + 2) % 3], n = verts[(i + 1) % 3];
      const d1 = Math.hypot(v[0] - p[0], v[1] - p[1]);
      const u1 = [(v[0] - p[0]) / d1, (v[1] - p[1]) / d1];
      const d2 = Math.hypot(n[0] - v[0], n[1] - v[1]);
      const u2 = [(n[0] - v[0]) / d2, (n[1] - v[1]) / d2];
      const a = [v[0] - u1[0] * rc * 1.6, v[1] - u1[1] * rc * 1.6];
      const b = [v[0] + u2[0] * rc * 1.6, v[1] + u2[1] * rc * 1.6];
      for (let k = 0; k <= 12; k++) {
        const q = k / 12;
        const x = (1 - q) * (1 - q) * a[0] + 2 * q * (1 - q) * v[0] + q * q * b[0];
        const y = (1 - q) * (1 - q) * a[1] + 2 * q * (1 - q) * v[1] + q * q * b[1];
        pts.push([x, y]);
      }
    }
    pts.push(pts[0]);
    return K.polyline(pts);
  }
  const RC_CACHE = new Map();
  function recycle(ctx, x, y, R, opts = {}) {
    const draw = opts.draw == null ? 1 : opts.draw;
    const key = R.toFixed(1);
    let pl = RC_CACHE.get(key);
    if (!pl) {
      pl = recyclePath(R, R * 0.28);
      RC_CACHE.set(key, pl);
    }
    const lw = opts.width || R * 0.2;
    const third = pl.len / 3;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(opts.rot || 0);
    ctx.strokeStyle = opts.color || PAL.navy;
    ctx.fillStyle = opts.color || PAL.navy;
    ctx.lineWidth = lw;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'butt';
    for (let i = 0; i < 3; i++) {
      // start each arrow just after a side's midpoint so heads sit on the sides
      const s0 = i * third + third * 0.58;
      const full = third * 0.86;
      const len = full * clamp(draw * 1.1 - i * 0.05);
      if (len < 2) continue;
      const head = lw * 1.45;
      const bodyLen = Math.max(0, len - head * 0.6);
      const pts = [];
      const steps = 30;
      for (let k = 0; k <= steps; k++) {
        const q = K.plAt(pl, K.mod(s0 + (bodyLen * k) / steps, pl.len));
        pts.push([q.x, q.y]);
      }
      ctx.beginPath();
      K.pathPoly(ctx, pts, false);
      ctx.stroke();
      const tip = K.plAt(pl, K.mod(s0 + len, pl.len));
      const base = K.plAt(pl, K.mod(s0 + bodyLen, pl.len));
      const ang = Math.atan2(tip.y - base.y, tip.x - base.x);
      ctx.save();
      ctx.translate(base.x, base.y);
      ctx.rotate(ang);
      ctx.beginPath();
      ctx.moveTo(head * 1.05, 0);
      ctx.lineTo(-head * 0.12, -lw * 1.2);
      ctx.lineTo(-head * 0.12, lw * 1.2);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  }

  // recycling bin. (x, y) = centre of the rim. s = scale.
  // part: 'back' (inside, drawn before contents) or 'front'
  function bin(ctx, x, y, s, opts = {}) {
    const w = 400, h = 360;
    const part = opts.part || 'front';
    const c = opts.color || PAL.navy;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s * (opts.sx || 1), s * (opts.sy || 1));
    if (part === 'back') {
      K.ellipse(ctx, 0, 0, w / 2, 34);
      ctx.fillStyle = rgb(K.mix(c, '#000000', 0.45));
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.moveTo(-w / 2, 0);
      ctx.lineTo(-w / 2 + 34, h - 30);
      ctx.quadraticCurveTo(-w / 2 + 40, h, -w / 2 + 70, h);
      ctx.lineTo(w / 2 - 70, h);
      ctx.quadraticCurveTo(w / 2 - 40, h, w / 2 - 34, h - 30);
      ctx.lineTo(w / 2, 0);
      ctx.ellipse(0, 0, w / 2, 34, 0, 0, PI, false);
      ctx.closePath();
      const g = ctx.createLinearGradient(-w / 2, 0, w / 2, 0);
      g.addColorStop(0, rgb(K.mix(c, '#ffffff', 0.12)));
      g.addColorStop(0.5, rgb(c));
      g.addColorStop(1, rgb(K.mix(c, '#000000', 0.3)));
      ctx.fillStyle = g;
      ctx.fill();
      // rim
      K.ellipse(ctx, 0, 0, w / 2 + 8, 38);
      ctx.lineWidth = 16;
      ctx.strokeStyle = rgb(K.mix(c, '#ffffff', 0.18));
      ctx.stroke();
      // ribs
      ctx.lineWidth = 7;
      ctx.strokeStyle = 'rgba(255,255,255,0.08)';
      for (const fx of [-0.62, 0.62]) {
        ctx.beginPath();
        ctx.moveTo(fx * (w / 2 - 20), 50);
        ctx.lineTo(fx * (w / 2 - 50), h - 30);
        ctx.stroke();
      }
      // emblem
      recycle(ctx, 0, h * 0.52, 84 * (opts.emblemScale || 1), {
        color: opts.emblem || PAL.mint,
        rot: opts.emblemRot || 0,
        draw: opts.emblemDraw == null ? 1 : opts.emblemDraw,
      });
    }
    ctx.restore();
  }

  // odometer-style digit: rolls from digit a to b with progress q
  function rollDigits(ctx, from, to, q, x, y, size, opts = {}) {
    const h = size * 1.05;
    ctx.save();
    ctx.beginPath();
    ctx.rect(x - 4, y - size * 0.95, size * 3, h + size * 0.2);
    ctx.clip();
    const e = (opts.ease || Ease.outBack)(clamp(q));
    ctx.fillText(from, x, y - e * h);
    ctx.fillText(to, x, y + (1 - e) * h);
    ctx.restore();
  }

  G.FX = {
    LOOP,
    backdrop,
    grid,
    particles,
    rays,
    droplet,
    dropletPath,
    splash,
    ripples,
    bubble,
    wavePath,
    waveLine,
    arcArrow,
    burst,
    sparkles,
    recycle,
    bin,
    rollDigits,
  };
})(typeof window !== 'undefined' ? window : globalThis);

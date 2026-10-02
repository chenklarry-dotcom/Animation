// bottle.js — the hero: a 500 mL PET bottle with volume-conserving water,
// a cylinder-wrapped label and a cap whose grip ridges really turn.
(function (G) {
  'use strict';
  const K = G.K;
  const { PAL, rgb, clamp, lerp, TAU, PI, Mx } = K;

  // Bottle-local units: origin at the base centre, u = height above the base,
  // drawn at y = -u (canvas y grows downwards).
  const B = {
    R: 100,
    wall: 4.5,
    bore: 38,
    shoulderLo: 392,
    shoulderHi: 492,
    neckR: 44,
    flangeLo: 518,
    flangeHi: 526,
    flangeR: 57,
    finishR: 45,
    top: 556,
    bandLo: 530,
    bandHi: 543,
    capR: 52,
    capH: 84,
    labelLo: 170,
    labelHi: 330,
    labelR: 97,
    full: 468,
    ribs: [62, 88, 114, 354, 377],
  };
  B.capSeat = B.bandHi; // cap body bottom sits here when closed
  B.height = B.capSeat + B.capH; // 627

  const smoother = (s) => s * s * s * (s * (s * 6 - 15) + 10);

  function outerR(u) {
    if (u < 0) return 0;
    if (u < 26) return 74 + Math.sqrt(Math.max(0, 676 - (26 - u) * (26 - u)));
    if (u < B.shoulderLo) {
      let x = B.R;
      for (const r of B.ribs) x -= 3.2 * Math.exp(-(((u - r) / 4.5) ** 2));
      x -= 3 * K.win(u, 158, 170, 330, 342);
      return x;
    }
    if (u < B.shoulderHi) {
      const s = (u - B.shoulderLo) / (B.shoulderHi - B.shoulderLo);
      return B.neckR + (B.R - B.neckR) * (1 - smoother(s));
    }
    if (u < B.flangeLo) return B.neckR;
    if (u < B.flangeHi) return B.flangeR;
    return B.finishR;
  }
  function innerR(u) {
    if (u < B.shoulderHi) return Math.max(B.bore, outerR(u) - B.wall);
    return B.bore;
  }

  // ------------------------------------------------------------- outlines
  function profileSamples() {
    const us = [];
    for (let u = 0; u <= 26; u += 1) us.push(u);
    for (let u = 27.5; u < B.shoulderLo; u += 1.5) us.push(u);
    for (let u = B.shoulderLo; u <= B.shoulderHi; u += 2) us.push(u);
    return us;
  }
  const SAMPLES = profileSamples();

  // crush: 0..1 — compresses the body and crinkles the walls
  function crushU(u, c) {
    if (c <= 0) return u;
    const k = 0.46 * c;
    return u <= 400 ? u * (1 - k) : u - 400 * k;
  }
  function crinkle(u, side, c) {
    if (c <= 0 || u < 10 || u > 480) return 0;
    const taper = K.win(u, 10, 50, 420, 480);
    const ph = side > 0 ? 0.3 : 1.9;
    // a few broad folds plus a finer ripple; bulges outwards as it squashes
    return c * taper * (10 + 14 * Math.sin(u * 0.08 + ph) + 5 * Math.sin(u * 0.23 + ph * 2.0));
  }

  function buildOuter(c = 0) {
    const right = [], left = [];
    for (const u of SAMPLES) {
      const r = outerR(u), y = -crushU(u, c);
      right.push([r + crinkle(u, 1, c), y]);
      left.push([-(r + crinkle(u, -1, c)), y]);
    }
    const tail = [
      [B.neckR, B.flangeLo],
      [B.flangeR, B.flangeLo],
      [B.flangeR, B.flangeHi],
      [B.finishR, B.flangeHi],
      [B.finishR, B.top],
    ];
    for (const [x, u] of tail) {
      const y = -crushU(u, c);
      right.push([x, y]);
      left.push([-x, y]);
    }
    return right.concat(left.reverse());
  }
  const OUTER = buildOuter(0);

  const CAVITY = (() => {
    const right = [];
    for (let u = B.wall; u <= B.top; u += 3) right.push([innerR(u), -u]);
    right.push([B.bore, -B.top]);
    const left = right.map(([x, y]) => [-x, y]).reverse();
    return right.concat(left);
  })();
  const FULL_AREA = Math.abs(K.polyArea(K.clipHalf(CAVITY, 0, 1, -B.full)));

  // -------------------------------------------------------------- label
  let LABEL = null;
  function labelTex() {
    if (LABEL) return LABEL;
    const S = 4;
    const w1 = Math.round(TAU * B.labelR * S);
    const h = (B.labelHi - B.labelLo) * S;
    const c = document.createElement('canvas');
    c.width = Math.ceil(w1 * 1.55);
    c.height = h;
    const g = c.getContext('2d');
    const R = K.rng(7);
    const bars = [];
    for (let x = 0; x < 150; ) {
      const w = 2 + Math.floor(R() * 4) * 3;
      bars.push([x, w]);
      x += w + 3 + Math.floor(R() * 3) * 3;
    }
    const paint = (ox) => {
      g.save();
      g.translate(ox, 0);
      const bg = g.createLinearGradient(0, 0, 0, h);
      bg.addColorStop(0, '#FFFFFF');
      bg.addColorStop(1, '#E7F3FF');
      g.fillStyle = bg;
      g.fillRect(0, 0, w1, h);
      // bottom waves (integer frequencies so the band wraps seamlessly)
      const wave = (base, amp, f, ph, color) => {
        g.beginPath();
        g.moveTo(0, h);
        for (let x = 0; x <= w1; x += 8) g.lineTo(x, base + amp * Math.sin((x / w1) * TAU * f + ph));
        g.lineTo(w1, h);
        g.closePath();
        g.fillStyle = color;
        g.fill();
      };
      wave(h * 0.7, h * 0.03, 7, 0.4, PAL.aqua);
      wave(h * 0.78, h * 0.035, 5, 2.2, PAL.cobalt);
      g.fillStyle = PAL.navy;
      g.fillRect(0, h * 0.925, w1, h * 0.075);
      // top band
      g.fillStyle = PAL.cobalt;
      g.fillRect(0, 0, w1, h * 0.075);
      g.fillStyle = PAL.aqua;
      g.fillRect(0, h * 0.075, w1, h * 0.018);

      // front: H2O
      const fx = w1 * 0.5;
      g.textBaseline = 'alphabetic';
      g.textAlign = 'left';
      K.font(g, 232, 900);
      const wH = g.measureText('H').width, wO = g.measureText('O').width;
      K.font(g, 132, 900);
      const w2 = g.measureText('2').width;
      const total = wH + w2 + wO + 16;
      let x = fx - total / 2;
      const base = h * 0.535;
      K.font(g, 232, 900);
      g.fillStyle = PAL.navy;
      g.fillText('H', x, base);
      x += wH + 8;
      K.font(g, 132, 900);
      g.fillStyle = PAL.cobalt;
      g.fillText('2', x, base + 34);
      x += w2 + 8;
      K.font(g, 232, 900);
      g.fillStyle = PAL.navy;
      g.fillText('O', x, base);
      K.font(g, 38, 700, K.FONT.mono);
      g.letterSpacing = '10px';
      g.textAlign = 'center';
      g.fillStyle = PAL.cobaltDeep;
      g.fillText('PURE · 500 mL', fx + 5, h * 0.645);
      g.letterSpacing = '0px';

      // sides: droplet badges
      for (const ux of [0.24, 0.76]) {
        const cx = w1 * ux, cy = h * 0.37;
        g.beginPath();
        g.moveTo(cx, cy - 92);
        g.bezierCurveTo(cx + 30, cy - 46, cx + 58, cy - 10, cx + 58, cy + 22);
        g.arc(cx, cy + 22, 58, 0, PI);
        g.bezierCurveTo(cx - 58, cy - 10, cx - 30, cy - 46, cx, cy - 92);
        g.closePath();
        g.fillStyle = PAL.cobalt;
        g.fill();
        g.beginPath();
        g.arc(cx - 18, cy + 18, 20, PI * 0.95, PI * 1.45);
        g.lineWidth = 9;
        g.lineCap = 'round';
        g.strokeStyle = 'rgba(255,255,255,0.85)';
        g.stroke();
      }
      // back: barcode + "facts"
      const bx = w1 * 0.035, by = h * 0.18;
      g.fillStyle = '#fff';
      g.fillRect(bx - 16, by - 14, 182, 210);
      g.fillStyle = PAL.navy;
      for (const [x0, w] of bars) g.fillRect(bx + x0, by, w, 150);
      K.font(g, 22, 700, K.FONT.mono);
      g.textAlign = 'left';
      g.fillText('0 12345 67890 5', bx, by + 182);
      g.fillStyle = 'rgba(7,26,61,0.55)';
      const fx2 = w1 * 0.86;
      g.fillRect(fx2, h * 0.17, 210, 16);
      for (let i = 0; i < 7; i++) {
        g.fillRect(fx2, h * 0.24 + i * 30, 120 + ((i * 37) % 70), 9);
        g.fillRect(fx2 + 170, h * 0.24 + i * 30, 40, 9);
      }
      g.restore();
    };
    paint(0);
    paint(w1);
    LABEL = { c, w1, h };
    return LABEL;
  }

  function drawLabel(ctx, spin, px, crush) {
    const tex = labelTex();
    const r = B.labelR, hh = B.labelHi - B.labelLo;
    const res = clamp(px, 1, 3.2);
    const Lw = Math.ceil(2 * r * res), Lh = Math.ceil(hh * res);
    const L = K.layer('label', Lw, Lh);
    const N = Math.ceil(Lw / 2.5);
    const sp = spin / TAU;
    for (let i = 0; i < N; i++) {
      const xa = -r + (2 * r * i) / N, xb = -r + (2 * r * (i + 1)) / N;
      const aa = Math.asin(clamp(xa / r, -1, 1)), ab = Math.asin(clamp(xb / r, -1, 1));
      let u0 = 0.5 + aa / TAU + sp;
      u0 -= Math.floor(u0);
      const du = (ab - aa) / TAU;
      L.ctx.drawImage(tex.c, u0 * tex.w1, 0, Math.max(0.5, du * tex.w1), tex.h, (xa + r) * res, 0, (xb - xa) * res + 0.8, Lh);
    }
    const y0 = -crushU(B.labelHi, crush), y1 = -crushU(B.labelLo, crush);
    ctx.drawImage(L.c, -r, y0, 2 * r, y1 - y0);
    // cylindrical shading over the label
    const g = ctx.createLinearGradient(-r, 0, r, 0);
    g.addColorStop(0, 'rgba(10,27,71,0.34)');
    g.addColorStop(0.1, 'rgba(10,27,71,0.10)');
    g.addColorStop(0.24, 'rgba(255,255,255,0.00)');
    g.addColorStop(0.3, 'rgba(255,255,255,0.28)');
    g.addColorStop(0.36, 'rgba(255,255,255,0.00)');
    g.addColorStop(0.75, 'rgba(10,27,71,0.06)');
    g.addColorStop(1, 'rgba(10,27,71,0.42)');
    ctx.fillStyle = g;
    ctx.fillRect(-r, y0, 2 * r, y1 - y0);
    if (crush > 0) {
      // fold creases
      ctx.save();
      ctx.beginPath();
      ctx.rect(-r, y0, 2 * r, y1 - y0);
      ctx.clip();
      ctx.lineWidth = 3;
      for (let i = 0; i < 5; i++) {
        const yy = lerp(y0, y1, (i + 0.5) / 5);
        ctx.strokeStyle = `rgba(10,27,71,${0.22 * crush})`;
        ctx.beginPath();
        ctx.moveTo(-r, yy + 10 * Math.sin(i * 2.3));
        ctx.lineTo(-r * 0.2, yy - 14 + 6 * Math.sin(i));
        ctx.lineTo(r * 0.5, yy + 8);
        ctx.lineTo(r, yy - 6);
        ctx.stroke();
        ctx.strokeStyle = `rgba(255,255,255,${0.35 * crush})`;
        ctx.beginPath();
        ctx.moveTo(-r, yy + 14 + 10 * Math.sin(i * 2.3));
        ctx.lineTo(-r * 0.2, yy - 10 + 6 * Math.sin(i));
        ctx.lineTo(r * 0.5, yy + 12);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  // ----------------------------------------------------------------- cap
  // Cap-local: origin at the centre of the cap's bottom edge, body spans
  // y in [-capH, 0]. spin = rotation about the bottle axis.
  function drawCap(ctx, o = {}) {
    const spin = o.spin || 0;
    const R = B.capR, Hc = B.capH;
    const base = o.color || PAL.cobalt;
    ctx.save();
    K.rrect(ctx, -R, -Hc, 2 * R, Hc, [14, 14, 4, 4]);
    const g = ctx.createLinearGradient(-R, 0, R, 0);
    g.addColorStop(0, rgb(K.mix(base, '#ffffff', 0.18)));
    g.addColorStop(0.35, rgb(base));
    g.addColorStop(0.75, rgb(K.mix(base, '#000a30', 0.25)));
    g.addColorStop(1, rgb(K.mix(base, '#000a30', 0.5)));
    ctx.fillStyle = g;
    ctx.fill();
    ctx.clip();
    // grip ridges, positioned on a rotating cylinder
    const N = 32;
    for (let i = 0; i < N; i++) {
      const a = spin + (i / N) * TAU;
      const c = Math.cos(a), s = Math.sin(a);
      if (c <= 0.02) continue;
      const x = R * 0.985 * s;
      const w = 3.4 * c + 0.3;
      const lit = clamp(0.55 - 0.5 * s, 0, 1) * c;
      ctx.fillStyle = `rgba(255,255,255,${0.1 + 0.3 * lit})`;
      ctx.fillRect(x - w / 2, -Hc + 9, w, Hc - 15);
      const a2 = a + PI / N;
      const c2 = Math.cos(a2);
      if (c2 > 0.02) {
        const x2 = R * 0.985 * Math.sin(a2);
        ctx.fillStyle = `rgba(0,8,48,${0.12 + 0.2 * c2})`;
        ctx.fillRect(x2 - (2.4 * c2 + 0.2) / 2, -Hc + 9, 2.4 * c2 + 0.2, Hc - 15);
      }
    }
    // top lip + view-fixed specular
    ctx.fillStyle = 'rgba(255,255,255,0.22)';
    ctx.fillRect(-R, -Hc, 2 * R, 8);
    const sg = ctx.createLinearGradient(-R * 0.7, 0, -R * 0.3, 0);
    sg.addColorStop(0, 'rgba(255,255,255,0)');
    sg.addColorStop(0.5, 'rgba(255,255,255,0.38)');
    sg.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = sg;
    ctx.fillRect(-R, -Hc, 2 * R, Hc);
    ctx.fillStyle = 'rgba(0,8,48,0.22)';
    ctx.fillRect(-R, -5, 2 * R, 5);
    ctx.restore();
    if (o.top) {
      // the cap seen from above while it tumbles
      K.ellipse(ctx, 0, -Hc, R, R * 0.3 * o.top);
      ctx.fillStyle = rgb(K.mix(base, '#ffffff', 0.12));
      ctx.fill();
    }
  }

  // tamper band ring that stays on the neck once the seal breaks
  function drawBand(ctx, color, cracked, px) {
    const y0 = -B.bandHi, h = B.bandHi - B.bandLo, R = B.capR - 1.5;
    K.rrect(ctx, -R, y0, 2 * R, h, 3);
    const g = ctx.createLinearGradient(-R, 0, R, 0);
    g.addColorStop(0, rgb(K.mix(color, '#ffffff', 0.12)));
    g.addColorStop(0.4, rgb(color));
    g.addColorStop(1, rgb(K.mix(color, '#000a30', 0.45)));
    ctx.fillStyle = g;
    ctx.fill();
    // perforation bridges
    ctx.fillStyle = cracked > 0.5 ? 'rgba(0,8,48,0.0)' : 'rgba(255,255,255,0.55)';
    if (cracked <= 0.5) for (let i = -4; i <= 4; i++) ctx.fillRect(i * 11 - 3, y0 - 1.2, 6, 2.4);
  }

  // ------------------------------------------------------- water helpers
  function waterLevel(n, target) {
    let lo = Infinity, hi = -Infinity;
    for (const p of CAVITY) {
      const d = p[0] * n[0] + p[1] * n[1];
      if (d < lo) lo = d;
      if (d > hi) hi = d;
    }
    let a = lo, b = hi;
    for (let i = 0; i < 34; i++) {
      const m = (a + b) / 2;
      const area = Math.abs(K.polyArea(K.clipHalf(CAVITY, n[0], n[1], m)));
      if (area > target) a = m;
      else b = m;
    }
    return { h: (a + b) / 2, lo, hi };
  }

  /**
   * Draw the bottle. ctx is in world/camera space; st.m maps bottle-local
   * to world. Options:
   *  m, px (screen px per local unit), t, fill (0..1), surf (world tilt of
   *  the water surface), wave (amplitude), spin (label), capOn, capRise,
   *  capSpin, bandOn, cracked, crush (0..1), glugs [times], dark (bg is dark)
   */
  function drawBottle(ctx, st) {
    const t = st.t || 0;
    const px = st.px || 1;
    const crush = st.crush || 0;
    const m = st.m;
    ctx.save();
    ctx.transform(m[0], m[1], m[2], m[3], m[4], m[5]);
    const outer = crush > 0 ? buildOuter(crush) : OUTER;

    // 1 — plastic veil
    ctx.beginPath();
    K.pathPoly(ctx, outer);
    ctx.fillStyle = st.dark ? 'rgba(160,220,255,0.10)' : 'rgba(255,255,255,0.22)';
    ctx.fill();

    // 2 — water, solved in local space so tilt + squash stay volume-true
    const fill = crush > 0 ? 0 : clamp(st.fill == null ? 1 : st.fill, 0, 1.05);
    let surf = null;
    if (fill > 0.002) {
      const a = st.surf || 0;
      const dx = -Math.sin(a), dy = Math.cos(a); // world "down"
      let nx = m[0] * dx + m[1] * dy, ny = m[2] * dx + m[3] * dy;
      const nl = Math.hypot(nx, ny);
      nx /= nl;
      ny /= nl;
      const tx = -ny, ty = nx;
      const lv = waterLevel([nx, ny], fill * FULL_AREA);
      const h = lv.h;
      let smin = Infinity, smax = -Infinity;
      for (const p of CAVITY) {
        const s = p[0] * tx + p[1] * ty;
        if (s < smin) smin = s;
        if (s > smax) smax = s;
      }
      smin -= 30;
      smax += 30;
      const amp = st.wave == null ? 3 : st.wave;
      const line = [];
      for (let s = smin; s <= smax + 0.1; s += 5) {
        const w =
          amp * (Math.sin(s * 0.05 + t * 5.2) * 0.7 + Math.sin(s * 0.13 - t * 7.9) * 0.3) +
          (st.slope || 0) * s;
        const d = h - w;
        line.push([s * tx + d * nx, s * ty + d * ny]);
      }
      const deep = lv.hi + 60;
      const poly = line.concat([
        [smax * tx + deep * nx, smax * ty + deep * ny],
        [smin * tx + deep * nx, smin * ty + deep * ny],
      ]);
      surf = { nx, ny, tx, ty, h, line, lo: lv.lo, hi: lv.hi, smin, smax };

      ctx.save();
      ctx.beginPath();
      K.pathPoly(ctx, CAVITY);
      ctx.clip();
      ctx.beginPath();
      K.pathPoly(ctx, poly);
      const gw = ctx.createLinearGradient(h * nx, h * ny, (h + 420) * nx, (h + 420) * ny);
      gw.addColorStop(0, PAL.waterLight);
      gw.addColorStop(0.07, '#6FD8FF');
      gw.addColorStop(0.45, PAL.water);
      gw.addColorStop(1, PAL.waterDeep);
      ctx.fillStyle = gw;
      ctx.fill();
      ctx.clip();
      // cylindrical depth: darker walls, bright core
      const gc = ctx.createLinearGradient(-B.R, 0, B.R, 0);
      gc.addColorStop(0, 'rgba(8,60,170,0.42)');
      gc.addColorStop(0.18, 'rgba(8,60,170,0.0)');
      gc.addColorStop(0.32, 'rgba(255,255,255,0.16)');
      gc.addColorStop(0.42, 'rgba(255,255,255,0.0)');
      gc.addColorStop(0.8, 'rgba(8,60,170,0.06)');
      gc.addColorStop(1, 'rgba(8,60,170,0.5)');
      ctx.fillStyle = gc;
      ctx.fillRect(-B.R - 5, -B.top - 10, 2 * B.R + 10, B.top + 20);

      // ambient bubbles
      const D = Math.max(10, lv.hi - h);
      const R = K.rng(41);
      for (let i = 0; i < 16; i++) {
        const sFrac = R(), v = 40 + R() * 70, ph = R(), rad = 1.6 + R() * 3.4;
        const s = lerp(smin + 60, smax - 60, sFrac) + 6 * Math.sin(t * 2.2 + i);
        const dd = D * (1 - K.fract(ph + (t * v) / Math.max(D, 120)));
        const bx = s * tx + (h + dd) * nx, by = s * ty + (h + dd) * ny;
        K.circle(ctx, bx, by, rad);
        ctx.fillStyle = 'rgba(255,255,255,0.42)';
        ctx.fill();
      }
      // glug bubbles: air enters at the mouth and rises to the air pocket
      if (st.glugs) {
        for (let gi = 0; gi < st.glugs.length; gi++) {
          const age = t - st.glugs[gi];
          if (age < 0 || age > 1.4) continue;
          const R2 = K.rng(100 + gi);
          for (let j = 0; j < 7; j++) {
            const delay = j * 0.07 + R2() * 0.04;
            const aj = age - delay;
            if (aj < 0) continue;
            const rad = 7 + R2() * 13;
            const speed = 330 + R2() * 260;
            const lat = (R2() - 0.5) * 30 + Math.sin(aj * 13 + j) * 8;
            const ox = 0, oy = -B.top + 6;
            const travel = speed * aj + 120 * aj * aj;
            const bx = ox + lat * tx - travel * nx;
            const by = oy + lat * ty - travel * ny;
            K.ellipse(ctx, bx, by, rad * (1 + 0.12 * Math.sin(aj * 20)), rad * (1 - 0.12 * Math.sin(aj * 20)), Math.atan2(ny, nx));
            ctx.fillStyle = 'rgba(220,248,255,0.30)';
            ctx.fill();
            ctx.lineWidth = 2.2;
            ctx.strokeStyle = 'rgba(255,255,255,0.75)';
            ctx.stroke();
          }
        }
      }
      // bright band just under the surface
      ctx.beginPath();
      K.pathPoly(ctx, line, false);
      ctx.lineWidth = 16;
      ctx.strokeStyle = 'rgba(200,245,255,0.55)';
      ctx.stroke();
      ctx.restore();

      // meniscus line
      ctx.save();
      ctx.beginPath();
      K.pathPoly(ctx, CAVITY);
      ctx.clip();
      ctx.beginPath();
      K.pathPoly(ctx, line, false);
      ctx.lineWidth = 3.2;
      ctx.strokeStyle = 'rgba(255,255,255,0.95)';
      ctx.stroke();
      ctx.restore();
    }

    // 3 — label (opaque, wraps the cylinder; follows the folds when crushed)
    if (crush > 0) {
      ctx.save();
      ctx.beginPath();
      K.pathPoly(ctx, outer);
      ctx.clip();
      ctx.scale(1 + 0.12 * crush, 1);
      drawLabel(ctx, st.spin || 0, px, crush);
      ctx.restore();
    } else drawLabel(ctx, st.spin || 0, px, crush);

    // 4 — plastic shading that follows the profile
    ctx.save();
    ctx.beginPath();
    K.pathPoly(ctx, outer);
    ctx.clip();
    const band = (f0, f1, u0, u1, color) => {
      const a = [], b = [];
      for (let u = u0; u <= u1; u += 4) {
        const r = outerR(u), y = -crushU(u, crush);
        a.push([f0 * r, y]);
        b.push([f1 * r, y]);
      }
      ctx.beginPath();
      K.pathPoly(ctx, a.concat(b.reverse()));
      const y0 = -crushU(u0, crush), y1 = -crushU(u1, crush);
      const g = ctx.createLinearGradient(0, y1, 0, y0);
      g.addColorStop(0, rgb(color, 0));
      g.addColorStop(0.08, rgb(color, color.a));
      g.addColorStop(0.92, rgb(color, color.a));
      g.addColorStop(1, rgb(color, 0));
      ctx.fillStyle = g;
      ctx.fill();
    };
    const edgeTint = st.dark ? [2, 10, 40] : [10, 27, 71];
    edgeTint.a = st.dark ? 0.32 : 0.16;
    band(-1.02, -0.84, 4, B.top, edgeTint);
    band(1.02, 0.86, 4, B.top, edgeTint);
    const hi = [255, 255, 255];
    hi.a = 0.62;
    band(-0.8, -0.64, 22, 505, hi);
    const hi2 = [255, 255, 255];
    hi2.a = 0.3;
    band(-0.52, -0.47, 30, 470, hi2);
    const rim = [255, 255, 255];
    rim.a = 0.34;
    band(0.9, 0.78, 30, 480, rim);
    // product-shot glint sweeping across the plastic
    if (st.glint > 0 && st.glint < 1) {
      ctx.save();
      ctx.rotate(-0.45);
      const gx = lerp(-330, 330, st.glint);
      const gg = ctx.createLinearGradient(gx - 60, 0, gx + 60, 0);
      gg.addColorStop(0, 'rgba(255,255,255,0)');
      gg.addColorStop(0.5, `rgba(255,255,255,${0.65 * Math.sin(PI * st.glint)})`);
      gg.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = gg;
      ctx.fillRect(gx - 60, -900, 120, 1400);
      ctx.restore();
    }
    // ribs
    for (const u of B.ribs) {
      const r = outerR(u) - 1, y = -crushU(u, crush);
      ctx.beginPath();
      ctx.moveTo(-r, y);
      ctx.quadraticCurveTo(0, y + 7, r, y);
      ctx.lineWidth = 2.4;
      ctx.strokeStyle = 'rgba(255,255,255,0.55)';
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-r, y + 3);
      ctx.quadraticCurveTo(0, y + 10, r, y + 3);
      ctx.lineWidth = 2;
      ctx.strokeStyle = st.dark ? 'rgba(0,10,40,0.25)' : 'rgba(10,27,71,0.10)';
      ctx.stroke();
    }
    // base dimple
    const by = -crushU(10, crush);
    ctx.beginPath();
    ctx.moveTo(-60, by);
    ctx.quadraticCurveTo(0, by - 14, 60, by);
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = 'rgba(255,255,255,0.45)';
    ctx.stroke();
    if (crush > 0) {
      // crumple creases across the whole body
      for (let i = 0; i < 9; i++) {
        const u = 28 + i * 47;
        const y = -crushU(u, crush), r = outerR(u) + 14;
        const zig = (dy) => {
          ctx.beginPath();
          ctx.moveTo(-r, y + dy + 9 * Math.sin(i * 1.7));
          ctx.lineTo(-r * 0.32, y + dy - 13 + 5 * Math.sin(i));
          ctx.lineTo(r * 0.3, y + dy + 11 * Math.cos(i * 0.7));
          ctx.lineTo(r, y + dy - 8 * Math.cos(i));
        };
        zig(0);
        ctx.lineWidth = 3.5;
        ctx.strokeStyle = `rgba(10,27,71,${0.3 * crush})`;
        ctx.stroke();
        zig(4.5);
        ctx.lineWidth = 3;
        ctx.strokeStyle = `rgba(255,255,255,${0.55 * crush})`;
        ctx.stroke();
      }
    }
    ctx.restore();

    // 5 — neck ring, threads, opening
    const fl0 = -crushU(B.flangeHi, crush), fl1 = -crushU(B.flangeLo, crush);
    K.rrect(ctx, -B.flangeR, fl0, 2 * B.flangeR, fl1 - fl0, 2.5);
    const gf = ctx.createLinearGradient(-B.flangeR, 0, B.flangeR, 0);
    gf.addColorStop(0, 'rgba(255,255,255,0.75)');
    gf.addColorStop(0.3, 'rgba(255,255,255,0.95)');
    gf.addColorStop(1, st.dark ? 'rgba(120,170,230,0.7)' : 'rgba(170,195,230,0.9)');
    ctx.fillStyle = gf;
    ctx.fill();
    const capOn = st.capOn !== false;
    if (!capOn || (st.capRise || 0) > 4) {
      const tt = -crushU(B.top, crush);
      ctx.lineWidth = 2.6;
      ctx.strokeStyle = 'rgba(255,255,255,0.8)';
      for (let i = 0; i < 3; i++) {
        const y = tt + 7 + i * 7;
        ctx.beginPath();
        ctx.moveTo(-B.finishR, y + 3);
        ctx.lineTo(B.finishR, y - 3);
        ctx.stroke();
      }
      K.ellipse(ctx, 0, tt, B.finishR - 1, 5.5);
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(255,255,255,0.95)';
      ctx.stroke();
    }

    // 6 — outline
    ctx.beginPath();
    K.pathPoly(ctx, outer);
    ctx.lineJoin = 'round';
    ctx.lineWidth = 2.6 / px;
    ctx.strokeStyle = st.edge || (st.dark ? 'rgba(200,235,255,0.55)' : 'rgba(10,27,71,0.32)');
    ctx.stroke();

    // 7 — band + cap
    const capColor = st.capColor || PAL.cobalt;
    if (st.bandOn !== false) {
      ctx.save();
      ctx.translate(0, -crushU(B.bandHi, crush) + B.bandHi);
      drawBand(ctx, capColor, st.cracked || 0, px);
      ctx.restore();
    }
    if (capOn) {
      ctx.save();
      ctx.translate(0, -crushU(B.capSeat, crush) - (st.capRise || 0));
      drawCap(ctx, { spin: st.capSpin || 0, color: capColor });
      ctx.restore();
    }
    ctx.restore();
    return surf;
  }

  // Matrix for a bottle whose local point (0, -pivotU) sits at world (x, y).
  function bottleMatrix(x, y, rot, scale, sx = 1, sy = 1, pivotU = 0) {
    let m = Mx.tr(Mx.id(), x, y);
    m = Mx.rot(m, rot);
    m = Mx.sc(m, scale * sx, scale * sy);
    m = Mx.tr(m, 0, pivotU);
    return m;
  }

  G.Bottle = { B, outerR, innerR, OUTER, CAVITY, FULL_AREA, drawBottle, drawCap, bottleMatrix, labelTex };
})(typeof window !== 'undefined' ? window : globalThis);

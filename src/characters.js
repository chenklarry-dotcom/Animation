// characters.js — navy silhouette cast: the gripping hand and the drinker.
(function (G) {
  'use strict';
  const K = G.K;
  const { PAL, rgb, clamp, lerp, TAU, PI } = K;

  // ----------------------------------------------------------------- hand
  // Drawn in bottle-local space. Fingers wrap across the front of the body.
  // o: { R: bottle radius at grip, u: grip centre height, reach 0..1,
  //      grip 0..1, color, sleeve }
  function drawHand(ctx, o) {
    const R = o.R || 100;
    const yc = -(o.u || 120);
    const reach = o.reach == null ? 1 : o.reach;
    const grip = o.grip == null ? 1 : o.grip;
    const ink = o.color || PAL.ink;
    const hi = rgb(K.mix(ink, '#7FA2FF', 0.28));
    const dark = rgb(K.mix(ink, '#000000', 0.35));
    const dx = (1 - reach) * 760;
    ctx.save();
    ctx.translate(dx, 0);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // forearm + sleeve, coming in from the lower right
    const ax = R + 96;
    ctx.beginPath();
    ctx.moveTo(ax - 10, yc - 72);
    ctx.bezierCurveTo(ax + 120, yc - 66, ax + 300, yc - 30, ax + 900, yc + 120);
    ctx.lineTo(ax + 900, yc + 330);
    ctx.bezierCurveTo(ax + 300, yc + 150, ax + 120, yc + 92, ax - 10, yc + 82);
    ctx.closePath();
    ctx.fillStyle = ink;
    ctx.fill();
    // sleeve
    ctx.save();
    ctx.clip();
    ctx.beginPath();
    ctx.moveTo(ax + 168, yc - 140);
    ctx.lineTo(ax + 1000, yc - 140);
    ctx.lineTo(ax + 1000, yc + 420);
    ctx.lineTo(ax + 128, yc + 420);
    ctx.closePath();
    ctx.fillStyle = o.sleeve || PAL.cobalt;
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.beginPath();
    ctx.moveTo(ax + 168, yc - 140);
    ctx.lineTo(ax + 196, yc - 140);
    ctx.lineTo(ax + 156, yc + 420);
    ctx.lineTo(ax + 128, yc + 420);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // back of the hand
    K.rrect(ctx, R - 34, yc - 88, 150, 176, 58);
    ctx.fillStyle = ink;
    ctx.fill();
    // knuckle sheen
    ctx.beginPath();
    ctx.moveTo(R + 6, yc - 60);
    ctx.quadraticCurveTo(R + 2, yc, R + 8, yc + 58);
    ctx.lineWidth = 5;
    ctx.strokeStyle = hi;
    ctx.globalAlpha = 0.55;
    ctx.stroke();
    ctx.globalAlpha = 1;

    // fingers: index (top) .. pinky (bottom)
    const F = [
      { y: -60, h: 40, len: 1.0 },
      { y: -18, h: 42, len: 1.0 },
      { y: 24, h: 40, len: 0.97 },
      { y: 62, h: 33, len: 0.88 },
    ];
    for (let i = F.length - 1; i >= 0; i--) {
      const f = F[i];
      const g = K.Ease.outBack(clamp(grip * 1.35 - (F.length - 1 - i) * 0.1));
      const tipFull = -(R - 4) * f.len;
      const tip = lerp(R + 20, tipFull, g);
      const base = R + 46;
      const y = yc + f.y + (1 - g) * -6;
      const len = base - tip;
      const tilt = 0.05 + (1 - g) * 0.25;
      ctx.save();
      ctx.translate(base, y);
      ctx.rotate(tilt);
      K.rrect(ctx, -len, -f.h / 2, len + 12, f.h, f.h / 2);
      ctx.fillStyle = ink;
      ctx.fill();
      // separator + top sheen
      ctx.lineWidth = 3.5;
      ctx.strokeStyle = dark;
      ctx.beginPath();
      ctx.moveTo(-len + f.h * 0.4, -f.h / 2 + 1);
      ctx.lineTo(0, -f.h / 2 + 1);
      ctx.stroke();
      ctx.lineWidth = 4;
      ctx.strokeStyle = hi;
      ctx.globalAlpha = 0.6;
      ctx.beginPath();
      ctx.moveTo(-len + f.h * 0.55, -f.h / 2 + 8);
      ctx.lineTo(-f.h * 0.4, -f.h / 2 + 8);
      ctx.stroke();
      ctx.globalAlpha = 1;
      // knuckle crease
      if (len > 120) {
        ctx.lineWidth = 3;
        ctx.strokeStyle = dark;
        ctx.beginPath();
        ctx.arc(-len * 0.42, 0, f.h * 0.3, -0.9, 0.9);
        ctx.stroke();
      }
      ctx.restore();
    }
    // thumb resting over the index finger
    const tg = K.Ease.outCubic(clamp(grip * 1.2));
    ctx.save();
    ctx.translate(R + 70, yc - 74);
    ctx.rotate(lerp(-0.9, -0.22, tg));
    K.rrect(ctx, -lerp(40, 118, tg), -21, lerp(40, 118, tg) + 30, 42, 21);
    ctx.fillStyle = ink;
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = hi;
    ctx.globalAlpha = 0.6;
    ctx.beginPath();
    ctx.moveTo(-lerp(30, 100, tg), -13);
    ctx.lineTo(0, -13);
    ctx.stroke();
    ctx.restore();
    ctx.restore();
  }

  // ---------------------------------------------------------------- bust
  // Profile facing right. Local units: crown at (175, 0), bust cut at y=960.
  const BUST = [
    [-196, 1240],
    [-184, 980],
    [-182, 820],
    [-146, 680],
    [-64, 600],
    [36, 548],
    [66, 486],
    [58, 424],
    [30, 336],
    [14, 232],
    [40, 112],
    [100, 32],
    [176, 0],
    [262, 24],
    [312, 84],
    [328, 148],
    [324, 178],
    [344, 212],
    [368, 247],
    [350, 264],
    [331, 271],
    [339, 288],
    [343, 300],
    [329, 312],
    [339, 324],
    [331, 340],
    [318, 352],
    [331, 382],
    [317, 414],
    [268, 433],
    [236, 450],
    [226, 500],
    [230, 560],
    [262, 612],
    [312, 700],
    [332, 820],
    [338, 980],
    [346, 1240],
  ];
  const LIPS = { x: 334, y: 312 };
  const NECK_PIVOT = { x: 150, y: 470 };
  const THROAT = BUST.findIndex((p) => p[0] === 236 && p[1] === 450); // throat run: THROAT..THROAT+2

  // o: { tilt (rad, head only), gulp: 0..1 position down the throat (or -1),
  //      gulpAmp }
  function bustPoints(o = {}) {
    const tilt = o.tilt || 0;
    const c = Math.cos(tilt), s = Math.sin(tilt);
    const pts = [];
    for (let i = 0; i < BUST.length; i++) {
      let [x, y] = BUST[i];
      const w = K.smoothstep(575, 430, y);
      if (w > 0 && tilt) {
        const dx = x - NECK_PIVOT.x, dy = y - NECK_PIVOT.y;
        const rx = NECK_PIVOT.x + dx * c - dy * s, ry = NECK_PIVOT.y + dx * s + dy * c;
        x = lerp(x, rx, w);
        y = lerp(y, ry, w);
      }
      pts.push([x, y]);
    }
    if (o.gulp != null && o.gulp >= 0 && o.gulpAmp) {
      // a bulge travels down the throat: resample the throat run through a
      // quadratic and push it outwards around the gulp position
      const a = pts[THROAT], m = pts[THROAT + 1], b = pts[THROAT + 2];
      const quad = (q, i) => a[i] * (2 * q - 1) * (q - 1) + m[i] * 4 * q * (1 - q) + b[i] * q * (2 * q - 1);
      const gy = lerp(a[1], b[1], o.gulp);
      const run = [];
      for (let k = 0; k <= 12; k++) {
        const q = k / 12;
        const x = quad(q, 0), y = quad(q, 1);
        run.push([x + o.gulpAmp * Math.exp(-(((y - gy) / 24) ** 2)), y]);
      }
      pts.splice(THROAT, 3, ...run);
    }
    return pts;
  }

  function bustPath(ctx, o) {
    const pts = bustPoints(o);
    ctx.beginPath();
    K.pathSmooth(ctx, pts, false, 1);
    ctx.closePath();
    return pts;
  }

  function headTransform(o, x, y) {
    // where a head-local point lands after the tilt
    const tilt = o.tilt || 0;
    const w = K.smoothstep(575, 430, y);
    const dx = x - NECK_PIVOT.x, dy = y - NECK_PIVOT.y;
    const c = Math.cos(tilt), s = Math.sin(tilt);
    return [lerp(x, NECK_PIVOT.x + dx * c - dy * s, w), lerp(y, NECK_PIVOT.y + dx * s + dy * c, w)];
  }

  // o: { color, tilt, gulp, gulpAmp, eye: 'closed'|'happy', fill: 0..1,
  //      t, waterTop, detail }
  function drawBust(ctx, o = {}) {
    const ink = o.color || PAL.ink;
    ctx.save();
    bustPath(ctx, o);
    ctx.fillStyle = ink;
    ctx.fill();
    if (o.inside) {
      ctx.save();
      ctx.clip();
      o.inside(ctx);
      ctx.restore();
    }
    const features = (earColor, eyeColor) => {
      const [ex, ey] = headTransform(o, 128, 250);
      ctx.save();
      ctx.translate(ex, ey);
      ctx.rotate(o.tilt || 0);
      ctx.beginPath();
      ctx.moveTo(-6, -34);
      ctx.bezierCurveTo(30, -44, 40, 0, 22, 18);
      ctx.bezierCurveTo(12, 30, 4, 34, -4, 30);
      ctx.lineWidth = 7;
      ctx.lineCap = 'round';
      ctx.strokeStyle = earColor;
      ctx.stroke();
      ctx.restore();
      const [qx, qy] = headTransform(o, 282, 194);
      ctx.save();
      ctx.translate(qx, qy);
      ctx.rotate(o.tilt || 0);
      ctx.lineWidth = 7;
      ctx.lineCap = 'round';
      ctx.strokeStyle = eyeColor;
      ctx.beginPath();
      if (o.eye === 'happy') ctx.arc(0, 8, 15, PI * 1.15, PI * 1.85);
      else ctx.arc(0, -6, 15, PI * 0.15, PI * 0.85);
      ctx.stroke();
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(-14, -30);
      ctx.quadraticCurveTo(4, -38, 20, -30);
      ctx.stroke();
      ctx.restore();
    };
    const dryEar = rgb(K.mix(ink, '#ffffff', 0.12)), dryEye = o.eyeColor || rgb(K.mix(ink, '#ffffff', 0.85));
    if (o.waterLevel == null || o.waterLevel > 500) features(dryEar, dryEye);
    else {
      // above the waterline: light features; below it: ink on the water
      ctx.save();
      ctx.beginPath();
      ctx.rect(-500, -500, 1500, o.waterLevel + 500);
      ctx.clip();
      features(dryEar, dryEye);
      ctx.restore();
      ctx.save();
      ctx.beginPath();
      ctx.rect(-500, o.waterLevel, 1500, 2000);
      ctx.clip();
      features(rgb(K.mix(ink, '#3CD3FF', 0.25)), ink);
      ctx.restore();
    }
    ctx.restore();
  }

  G.Cast = { drawHand, drawBust, bustPath, bustPoints, headTransform, BUST, LIPS, NECK_PIVOT };
})(typeof window !== 'undefined' ? window : globalThis);

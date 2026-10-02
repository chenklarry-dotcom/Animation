// core.js — math, easing, colour, randomness, geometry and text helpers.
// Everything here is pure: the whole film is a function of time t.
(function (G) {
  'use strict';

  const W = 1080;
  const H = 1920;
  const PI = Math.PI;
  const TAU = PI * 2;

  // ---------------------------------------------------------------- math
  const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
  const lerp = (a, b, t) => a + (b - a) * t;
  const prog = (t, a, b) => clamp((t - a) / (b - a));
  const fract = (x) => x - Math.floor(x);
  const mod = (a, n) => ((a % n) + n) % n;
  const smoothstep = (a, b, x) => {
    const t = clamp((x - a) / (b - a));
    return t * t * (3 - 2 * t);
  };
  // 0 -> 1 -> 0 window between a and d, ramping over [a,b] and [c,d]
  const win = (t, a, b, c, d) => (t < a || t > d ? 0 : t < b ? smoothstep(a, b, t) : t > c ? 1 - smoothstep(c, d, t) : 1);
  const dist = (ax, ay, bx, by) => Math.hypot(bx - ax, by - ay);

  // -------------------------------------------------------------- easing
  function cubicBezier(x1, y1, x2, y2) {
    const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
    const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
    const sx = (t) => ((ax * t + bx) * t + cx) * t;
    const sy = (t) => ((ay * t + by) * t + cy) * t;
    const dx = (t) => (3 * ax * t + 2 * bx) * t + cx;
    return (x) => {
      if (x <= 0) return 0;
      if (x >= 1) return 1;
      let t = x;
      for (let i = 0; i < 8; i++) {
        const e = sx(t) - x;
        if (Math.abs(e) < 1e-6) return sy(t);
        const d = dx(t);
        if (Math.abs(d) < 1e-6) break;
        t -= e / d;
      }
      let lo = 0, hi = 1;
      t = x;
      for (let i = 0; i < 40; i++) {
        if (sx(t) < x) lo = t;
        else hi = t;
        t = (lo + hi) / 2;
      }
      return sy(t);
    };
  }

  const back = (s) => (t) => 1 + (s + 1) * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2);
  const Ease = {
    linear: (t) => t,
    inQuad: (t) => t * t,
    outQuad: (t) => 1 - (1 - t) * (1 - t),
    inOutQuad: (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
    inCubic: (t) => t * t * t,
    outCubic: (t) => 1 - Math.pow(1 - t, 3),
    inOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
    inQuart: (t) => t * t * t * t,
    outQuart: (t) => 1 - Math.pow(1 - t, 4),
    inOutQuart: (t) => (t < 0.5 ? 8 * t * t * t * t : 1 - Math.pow(-2 * t + 2, 4) / 2),
    inQuint: (t) => t * t * t * t * t,
    outQuint: (t) => 1 - Math.pow(1 - t, 5),
    inOutQuint: (t) => (t < 0.5 ? 16 * Math.pow(t, 5) : 1 - Math.pow(-2 * t + 2, 5) / 2),
    inExpo: (t) => (t <= 0 ? 0 : Math.pow(2, 10 * t - 10)),
    outExpo: (t) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t)),
    inOutExpo: (t) =>
      t <= 0 ? 0 : t >= 1 ? 1 : t < 0.5 ? Math.pow(2, 20 * t - 10) / 2 : (2 - Math.pow(2, -20 * t + 10)) / 2,
    inSine: (t) => 1 - Math.cos((t * PI) / 2),
    outSine: (t) => Math.sin((t * PI) / 2),
    inOutSine: (t) => -(Math.cos(PI * t) - 1) / 2,
    outCirc: (t) => Math.sqrt(1 - Math.pow(t - 1, 2)),
    inCirc: (t) => 1 - Math.sqrt(1 - t * t),
    outBack: back(1.70158),
    outBackSoft: back(1.1),
    outBackHard: back(2.6),
    inBack: (t) => 2.70158 * t * t * t - 1.70158 * t * t,
    outElastic: (t) =>
      t <= 0 ? 0 : t >= 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * ((2 * PI) / 3)) + 1,
    outBounce: (t) => {
      const n1 = 7.5625, d1 = 2.75;
      if (t < 1 / d1) return n1 * t * t;
      if (t < 2 / d1) return n1 * (t -= 1.5 / d1) * t + 0.75;
      if (t < 2.5 / d1) return n1 * (t -= 2.25 / d1) * t + 0.9375;
      return n1 * (t -= 2.625 / d1) * t + 0.984375;
    },
    // motion-design staples
    snappy: cubicBezier(0.2, 0.9, 0.1, 1), // fast out, long settle
    swift: cubicBezier(0.55, 0, 0.1, 1), // ramp in, glide out
    ramp: cubicBezier(0.8, 0, 0.2, 1), // speed-ramped transition
    anticip: cubicBezier(0.5, -0.35, 0.3, 1), // small wind-up then go
  };
  Ease.back = back;
  Ease.bezier = cubicBezier;

  // tween between a and b over [t0,t1]
  const tw = (t, t0, t1, a, b, e = Ease.inOutCubic) => lerp(a, b, e(prog(t, t0, t1)));

  // Keyframes: [[time, value, ease?], ...]; the ease on key i shapes the
  // segment that ends at key i.
  function track(t, keys, def = Ease.inOutCubic) {
    if (t <= keys[0][0]) return keys[0][1];
    for (let i = 1; i < keys.length; i++) {
      const k = keys[i];
      if (t < k[0]) {
        const p = keys[i - 1];
        return lerp(p[1], k[1], (k[2] || def)((t - p[0]) / (k[0] - p[0])));
      }
    }
    return keys[keys.length - 1][1];
  }

  // impulse response: 0 -> wiggle -> 0
  const wobble = (t, freq = 3, decay = 5) => (t <= 0 ? 0 : Math.exp(-decay * t) * Math.sin(TAU * freq * t));
  // 0 -> 1 with springy overshoot
  const springIn = (t, freq = 1.6, decay = 6) => (t <= 0 ? 0 : 1 - Math.exp(-decay * t) * Math.cos(TAU * freq * t));

  // ------------------------------------------------------------- colour
  const hexCache = new Map();
  function hex(h) {
    let v = hexCache.get(h);
    if (v) return v;
    let s = h.replace('#', '');
    if (s.length === 3) s = s.split('').map((c) => c + c).join('');
    const n = parseInt(s, 16);
    v = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    hexCache.set(h, v);
    return v;
  }
  const col = (c) => (typeof c === 'string' ? hex(c) : c);
  function rgb(c, a = 1) {
    const [r, g, b] = col(c);
    return a >= 1
      ? `rgb(${Math.round(r)},${Math.round(g)},${Math.round(b)})`
      : `rgba(${Math.round(r)},${Math.round(g)},${Math.round(b)},${Math.max(0, a).toFixed(4)})`;
  }
  function mix(c1, c2, t) {
    const a = col(c1), b = col(c2);
    return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
  }

  const PAL = {
    navy: '#071A3D',
    navyDeep: '#030C22',
    navyMid: '#0D2A62',
    ink: '#0A1B47',
    inkLight: '#1A3170',
    cobalt: '#2152FF',
    cobaltDeep: '#1338D6',
    azure: '#2F86FF',
    aqua: '#3CD3FF',
    aquaLight: '#A8EEFF',
    ice: '#EAF4FF',
    iceDeep: '#D3E6FF',
    white: '#FFFFFF',
    yellow: '#FFD23F',
    yellowDeep: '#FFB81F',
    coral: '#FF5A5F',
    mint: '#41E2B0',
    mintDeep: '#1FC593',
    water: '#46C9FF',
    waterDeep: '#1677E6',
    waterLight: '#B5F1FF',
  };

  // ---------------------------------------------------------- randomness
  function rng(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const hash1 = (n) => fract(Math.sin(n * 127.1 + 311.7) * 43758.5453123);
  function noise1(x) {
    const i = Math.floor(x), f = x - i;
    const u = f * f * (3 - 2 * f);
    return lerp(hash1(i), hash1(i + 1), u) * 2 - 1;
  }

  // ---------------------------------------------------- affine matrices
  // [a, b, c, d, e, f] — same layout as CanvasRenderingContext2D.setTransform
  const Mx = {
    id: () => [1, 0, 0, 1, 0, 0],
    mul: (m, n) => [
      m[0] * n[0] + m[2] * n[1],
      m[1] * n[0] + m[3] * n[1],
      m[0] * n[2] + m[2] * n[3],
      m[1] * n[2] + m[3] * n[3],
      m[0] * n[4] + m[2] * n[5] + m[4],
      m[1] * n[4] + m[3] * n[5] + m[5],
    ],
    tr: (m, x, y) => Mx.mul(m, [1, 0, 0, 1, x, y]),
    rot: (m, a) => {
      const c = Math.cos(a), s = Math.sin(a);
      return Mx.mul(m, [c, s, -s, c, 0, 0]);
    },
    sc: (m, sx, sy = sx) => Mx.mul(m, [sx, 0, 0, sy, 0, 0]),
    ap: (m, x, y) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]],
    det: (m) => m[0] * m[3] - m[1] * m[2],
    inv: (m) => {
      const d = m[0] * m[3] - m[1] * m[2];
      return [
        m[3] / d,
        -m[1] / d,
        -m[2] / d,
        m[0] / d,
        (m[2] * m[5] - m[3] * m[4]) / d,
        (m[1] * m[4] - m[0] * m[5]) / d,
      ];
    },
  };

  // ------------------------------------------------------------ polygons
  function polyArea(p) {
    let a = 0;
    for (let i = 0, n = p.length; i < n; i++) {
      const u = p[i], v = p[(i + 1) % n];
      a += u[0] * v[1] - v[0] * u[1];
    }
    return a / 2;
  }
  // keep the part of polygon p where dot(pt, d) >= h
  function clipHalf(p, dx, dy, h) {
    const out = [];
    for (let i = 0, n = p.length; i < n; i++) {
      const u = p[i], v = p[(i + 1) % n];
      const du = u[0] * dx + u[1] * dy - h, dv = v[0] * dx + v[1] * dy - h;
      if (du >= 0) out.push(u);
      if (du >= 0 !== dv >= 0) {
        const k = du / (du - dv);
        out.push([u[0] + (v[0] - u[0]) * k, u[1] + (v[1] - u[1]) * k]);
      }
    }
    return out;
  }
  function pathPoly(ctx, p, close = true) {
    ctx.moveTo(p[0][0], p[0][1]);
    for (let i = 1; i < p.length; i++) ctx.lineTo(p[i][0], p[i][1]);
    if (close) ctx.closePath();
  }
  // Catmull-Rom spline through points, as bezier segments
  function pathSmooth(ctx, p, closed = true, k = 1) {
    const n = p.length;
    const P = (i) => (closed ? p[mod(i, n)] : p[clamp(i, 0, n - 1)]);
    ctx.moveTo(p[0][0], p[0][1]);
    const last = closed ? n : n - 1;
    for (let i = 0; i < last; i++) {
      const p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2);
      ctx.bezierCurveTo(
        p1[0] + ((p2[0] - p0[0]) / 6) * k,
        p1[1] + ((p2[1] - p0[1]) / 6) * k,
        p2[0] - ((p3[0] - p1[0]) / 6) * k,
        p2[1] - ((p3[1] - p1[1]) / 6) * k,
        p2[0],
        p2[1]
      );
    }
    if (closed) ctx.closePath();
  }

  // polyline with arc-length parameterisation
  function polyline(pts) {
    const cum = [0];
    for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + dist(pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1]));
    return { pts, cum, len: cum[cum.length - 1] };
  }
  function plAt(pl, s) {
    const { pts, cum } = pl;
    s = clamp(s, 0, pl.len);
    let lo = 0, hi = cum.length - 1;
    while (hi - lo > 1) {
      const m = (lo + hi) >> 1;
      if (cum[m] <= s) lo = m;
      else hi = m;
    }
    const seg = cum[hi] - cum[lo] || 1;
    const k = (s - cum[lo]) / seg;
    const a = pts[lo], b = pts[hi];
    return { x: lerp(a[0], b[0], k), y: lerp(a[1], b[1], k), a: Math.atan2(b[1] - a[1], b[0] - a[0]) };
  }
  function plSub(pl, s0, s1, step = 4) {
    const out = [];
    if (s1 <= s0) return out;
    const n = Math.max(2, Math.ceil((s1 - s0) / step));
    for (let i = 0; i <= n; i++) {
      const q = plAt(pl, lerp(s0, s1, i / n));
      out.push([q.x, q.y]);
    }
    return out;
  }

  // -------------------------------------------------------------- drawing
  function circle(ctx, x, y, r) {
    ctx.beginPath();
    ctx.arc(x, y, Math.max(0, r), 0, TAU);
  }
  function ellipse(ctx, x, y, rx, ry, rot = 0) {
    ctx.beginPath();
    ctx.ellipse(x, y, Math.max(0, rx), Math.max(0, ry), rot, 0, TAU);
  }
  function rrect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
  }
  // 4-point sparkle star
  function sparkle(ctx, x, y, r, rot = 0, thin = 0.22) {
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = rot + (i * PI) / 4 - PI / 2;
      const rr = i % 2 === 0 ? r : r * thin;
      const px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
  }

  // offscreen layers, cached by key so nothing is reallocated per frame
  const layers = new Map();
  function layer(key, w = W, h = H) {
    let L = layers.get(key);
    if (!L || L.c.width !== w || L.c.height !== h) {
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      L = { c, ctx: c.getContext('2d') };
      layers.set(key, L);
    }
    L.ctx.setTransform(1, 0, 0, 1, 0, 0);
    L.ctx.globalAlpha = 1;
    L.ctx.globalCompositeOperation = 'source-over';
    L.ctx.filter = 'none';
    L.ctx.clearRect(0, 0, L.c.width, L.c.height);
    return L;
  }

  // ----------------------------------------------------------------- text
  const FONT = { display: 'Unbounded', mono: 'JetBrains Mono' };
  function font(ctx, size, weight = 900, family = FONT.display) {
    ctx.font = `${weight} ${size}px "${family}"`;
  }
  const layoutCache = new Map();
  // per-glyph x offsets (kerning-aware) for the current ctx.font
  function charLayout(ctx, text, spacing = 0) {
    const key = ctx.font + '|' + spacing + '|' + text;
    let L = layoutCache.get(key);
    if (L) return L;
    const xs = [], ws = [];
    for (let i = 0; i < text.length; i++) {
      xs.push(ctx.measureText(text.slice(0, i)).width + i * spacing);
      ws.push(ctx.measureText(text[i]).width);
    }
    const width = ctx.measureText(text).width + Math.max(0, text.length - 1) * spacing;
    L = { xs, ws, width };
    layoutCache.set(key, L);
    return L;
  }

  /**
   * Text whose glyphs animate individually.
   * o: { x, y, size, weight, family, color, align, spacing, clip:[top,bottom],
   *      fn(i, n) -> { dx, dy, s, sx, sy, r, a }, stroke:{color,width}, noFill }
   * Returns the laid-out width.
   */
  function kinetic(ctx, text, o) {
    font(ctx, o.size, o.weight == null ? 900 : o.weight, o.family || FONT.display);
    const L = charLayout(ctx, text, o.spacing || 0);
    let x0 = o.x;
    if (o.align === 'center') x0 -= L.width / 2;
    else if (o.align === 'right') x0 -= L.width;
    const pivot = -o.size * 0.36;
    ctx.save();
    if (o.clip) {
      ctx.beginPath();
      ctx.rect(-1e4, o.clip[0], 2e4, o.clip[1] - o.clip[0]);
      ctx.clip();
    }
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    if (o.color) ctx.fillStyle = o.color;
    if (o.stroke) {
      ctx.strokeStyle = o.stroke.color;
      ctx.lineWidth = o.stroke.width;
      ctx.lineJoin = 'round';
    }
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (ch === ' ') continue;
      const f = o.fn ? o.fn(i, text.length) : null;
      const a = f && f.a != null ? f.a : 1;
      if (a <= 0.002) continue;
      const cx = x0 + L.xs[i] + L.ws[i] / 2;
      ctx.save();
      ctx.globalAlpha *= a;
      ctx.translate(cx + ((f && f.dx) || 0), o.y + ((f && f.dy) || 0) + pivot);
      if (f && f.r) ctx.rotate(f.r);
      const s = f && f.s != null ? f.s : 1;
      const sx = s * (f && f.sx != null ? f.sx : 1), sy = s * (f && f.sy != null ? f.sy : 1);
      if (sx !== 1 || sy !== 1) ctx.scale(sx, sy);
      if (f && f.color) ctx.fillStyle = f.color;
      if (!o.noFill) ctx.fillText(ch, -L.ws[i] / 2, -pivot);
      if (o.stroke) ctx.strokeText(ch, -L.ws[i] / 2, -pivot);
      ctx.restore();
    }
    ctx.restore();
    return L.width;
  }

  G.K = {
    W, H, PI, TAU,
    clamp, lerp, prog, fract, mod, smoothstep, win, dist,
    Ease, tw, track, wobble, springIn,
    hex, rgb, mix, PAL,
    rng, hash1, noise1,
    Mx, polyArea, clipHalf, pathPoly, pathSmooth, polyline, plAt, plSub,
    circle, ellipse, rrect, sparkle, layer,
    FONT, font, charLayout, kinetic,
  };
})(typeof window !== 'undefined' ? window : globalThis);

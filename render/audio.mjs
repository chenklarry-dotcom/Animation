// Synthesises the soundtrack: a 120 BPM water-pop groove plus sound effects
// locked to the same timing sheet the picture uses (src/timeline.js).
// Pure Node, no dependencies. Writes:
//   out/soundtrack.wav     48 kHz / 16-bit stereo (used for the MP4)
//   media/soundtrack.m4a   AAC for the browser preview player
//
//   node render/audio.mjs [--no-music]
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TL = createRequire(import.meta.url)(path.join(ROOT, 'src/timeline.js'));
const NO_MUSIC = process.argv.includes('--no-music');

const SR = 48000;
const N = Math.ceil(TL.DURATION * SR);
const TAU = Math.PI * 2;
const BEAT = 60 / TL.BPM;
const BAR = BEAT * 4;

// ------------------------------------------------------------ utilities
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const noiseR = rng(99);
const noise = () => noiseR() * 2 - 1;
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));

const bus = () => ({ L: new Float32Array(N), R: new Float32Array(N) });
const drums = bus(), synth = bus(), sfx = bus(), verbSend = bus(), delaySend = bus();

// add a mono voice into a bus; pan is a number or fn(t) in -1..1
function add(b, t0, len, fn, { gain = 1, pan = 0, verb = 0, delay = 0 } = {}) {
  const i0 = Math.round(t0 * SR);
  const n = Math.round(len * SR);
  const panFn = typeof pan === 'function' ? pan : null;
  let gl = Math.cos(((pan || 0) + 1) * Math.PI / 4) * gain, gr = Math.sin(((pan || 0) + 1) * Math.PI / 4) * gain;
  for (let i = 0; i < n; i++) {
    const idx = i0 + i;
    if (idx >= N) break;
    const s = fn(i / SR);
    if (idx < 0) continue;
    if (panFn && (i & 63) === 0) {
      const p = clamp(panFn(i / SR), -1, 1);
      gl = Math.cos((p + 1) * Math.PI / 4) * gain;
      gr = Math.sin((p + 1) * Math.PI / 4) * gain;
    }
    const l = s * gl, r = s * gr;
    b.L[idx] += l;
    b.R[idx] += r;
    if (verb) {
      verbSend.L[idx] += l * verb;
      verbSend.R[idx] += r * verb;
    }
    if (delay) {
      delaySend.L[idx] += l * delay;
      delaySend.R[idx] += r * delay;
    }
  }
}

// RBJ biquad; call .set(freq) to sweep
function biquad(type, freq, Q = 0.707) {
  let b0, b1, b2, a1, a2, x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  const set = (f) => {
    const w = (TAU * Math.min(Math.max(f, 20), SR * 0.45)) / SR;
    const cs = Math.cos(w), sn = Math.sin(w), al = sn / (2 * Q);
    let a0;
    if (type === 'lowpass') {
      b0 = (1 - cs) / 2; b1 = 1 - cs; b2 = (1 - cs) / 2;
    } else if (type === 'highpass') {
      b0 = (1 + cs) / 2; b1 = -(1 + cs); b2 = (1 + cs) / 2;
    } else {
      b0 = al; b1 = 0; b2 = -al;
    }
    a0 = 1 + al;
    a1 = (-2 * cs) / a0;
    a2 = (1 - al) / a0;
    b0 /= a0; b1 /= a0; b2 /= a0;
  };
  set(freq);
  const f = (x) => {
    const y = b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
    x2 = x1; x1 = x; y2 = y1; y1 = y;
    return y;
  };
  f.set = set;
  return f;
}

// ------------------------------------------------------------ drum kit
function kick(t0, gain = 1) {
  let ph = 0;
  add(drums, t0, 0.45, (t) => {
    const f = 47 + 125 * Math.exp(-t / 0.032);
    ph += (TAU * f) / SR;
    const env = Math.min(1, t / 0.0015) * Math.exp(-t / 0.27);
    const click = t < 0.004 ? noise() * (1 - t / 0.004) * 0.25 : 0;
    return Math.tanh((Math.sin(ph) * env + click) * 1.7) * 0.95;
  }, { gain });
}
function clap(t0, gain = 1) {
  const bp = biquad('bandpass', 1500, 0.8);
  add(drums, t0, 0.4, (t) => {
    let e = 0;
    for (const [d, dec] of [[0, 0.007], [0.011, 0.007], [0.021, 0.12]]) if (t >= d) e = Math.max(e, Math.exp(-(t - d) / dec));
    return bp(noise()) * e * 2.2;
  }, { gain, verb: 0.35 });
}
function hat(t0, open = false, gain = 1, pan = 0.25) {
  const hp = biquad('highpass', 8000, 0.7);
  add(drums, t0, open ? 0.32 : 0.07, (t) => hp(noise()) * Math.exp(-t / (open ? 0.1 : 0.017)) * 0.9, { gain, pan, verb: 0.08 });
}
function crash(t0, gain = 1) {
  const hp = biquad('highpass', 5200, 0.6);
  add(drums, t0, 2.2, (t) => hp(noise()) * Math.exp(-t / 0.55) * 0.55 * (1 + 0.3 * Math.sin(t * 380)), { gain, verb: 0.4 });
}

// --------------------------------------------------------------- synths
function bassNote(t0, dur, midi, gain = 1) {
  const f = mtof(midi);
  let ph = 0;
  const lp = biquad('lowpass', 700, 0.9);
  add(synth, t0, dur + 0.04, (t) => {
    ph += (TAU * f) / SR;
    const env = Math.min(1, t / 0.004) * (t < dur ? 1 : Math.exp(-(t - dur) / 0.012)) * (0.72 + 0.28 * Math.exp(-t / 0.09));
    const s = Math.sin(ph) + 0.42 * Math.sin(2 * ph) + 0.18 * Math.sin(3 * ph);
    return lp(Math.tanh(s * 1.4)) * env * 0.5;
  }, { gain });
}
// soft additive pluck; higher partials die faster (a moving low-pass)
function pluckNote(t0, midi, dur = 0.22, gain = 1, pan = 0) {
  const f = mtof(midi);
  for (const det of [-0.0035, 0.0035]) {
    const ff = f * (1 + det);
    const amps = [], decs = [];
    for (let k = 1; k <= 9; k++) {
      amps.push(1 / Math.pow(k, 1.1));
      decs.push(3.5 + k * 3.2);
    }
    add(synth, t0, dur + 0.35, (t) => {
      let s = 0;
      for (let k = 0; k < 9; k++) s += amps[k] * Math.exp(-t * decs[k]) * Math.sin(TAU * ff * (k + 1) * t + k * 0.7);
      const env = Math.min(1, t / 0.002) * (t < dur ? 1 : Math.exp(-(t - dur) / 0.07));
      return s * env * 0.085;
    }, { gain, pan: pan + (det < 0 ? -0.3 : 0.3), verb: 0.25, delay: 0.22 });
  }
}
function padChord(t0, dur, midis, gain = 1) {
  for (const m of midis) {
    for (const det of [-0.005, 0.0, 0.005]) {
      const f = mtof(m) * (1 + det);
      let ph = m; // deterministic, per-note phase offset
      add(synth, t0, dur + 1.2, (t) => {
        ph += (TAU * f * (1 + 0.0018 * Math.sin(TAU * 4.6 * t + m))) / SR;
        const env = Math.min(1, t / 0.7) * (t < dur ? 1 : Math.exp(-(t - dur) / 0.45));
        return (Math.sin(ph) + 0.28 * Math.sin(2 * ph) + 0.1 * Math.sin(3 * ph)) * env * 0.032;
      }, { gain, pan: det * 110, verb: 0.55 });
    }
  }
}
function marimba(t0, midi, gain = 1, pan = 0) {
  const f = mtof(midi);
  add(synth, t0, 0.9, (t) => {
    const env = Math.min(1, t / 0.0015);
    return env * (Math.sin(TAU * f * t) * Math.exp(-t / 0.32) +
      0.45 * Math.sin(TAU * f * 3.99 * t) * Math.exp(-t / 0.045) +
      0.12 * Math.sin(TAU * f * 9.3 * t) * Math.exp(-t / 0.018)) * 0.34;
  }, { gain, pan, verb: 0.35, delay: 0.3 });
}

// ------------------------------------------------------------------ sfx
function plip(t0, f0 = 520, f1 = 1500, gain = 1, pan = 0) {
  // a resonating bubble: fast upward pitch glide
  let ph = 0;
  add(sfx, t0, 0.22, (t) => {
    const f = f0 + (f1 - f0) * Math.pow(Math.min(1, t / 0.045), 0.6);
    ph += (TAU * f) / SR;
    return Math.sin(ph) * Math.min(1, t / 0.0015) * Math.exp(-t / 0.055) * 0.6;
  }, { gain, pan, verb: 0.3 });
}
function splash(t0, dur = 0.5, gain = 1, pan = 0) {
  const bp = biquad('bandpass', 2500, 0.6), hp = biquad('highpass', 900, 0.7);
  add(sfx, t0, dur, (t) => {
    if ((Math.round(t * SR) & 15) === 0) bp.set(1800 + 2600 * Math.exp(-t / 0.12));
    const grain = 0.55 + 0.45 * Math.sin(t * 310 + Math.sin(t * 77) * 3);
    return hp(bp(noise())) * Math.min(1, t / 0.003) * Math.exp(-t / (dur * 0.28)) * grain * 1.6;
  }, { gain, pan, verb: 0.35 });
}
function whoosh(t0, dur, f0, f1, gain = 1, pan0 = -0.6, pan1 = 0.6, peak = 0.62, q = 1.1) {
  const bp = biquad('bandpass', f0, q);
  add(sfx, t0, dur, (t) => {
    const p = t / dur;
    if ((Math.round(t * SR) & 15) === 0) bp.set(f0 * Math.pow(f1 / f0, p));
    const env = p < peak ? Math.pow(p / peak, 2) : Math.pow(1 - (p - peak) / (1 - peak), 1.6);
    return bp(noise()) * env * 1.5;
  }, { gain, pan: (t) => pan0 + (pan1 - pan0) * (t / dur), verb: 0.25 });
}
function sweepTone(t0, dur, f0, f1, gain = 1, shape = 'sine') {
  let ph = 0;
  add(sfx, t0, dur, (t) => {
    const p = t / dur;
    const f = f0 * Math.pow(f1 / f0, p);
    ph += (TAU * f) / SR;
    const env = Math.sin(Math.PI * Math.min(1, p)) ** 1.5;
    return (shape === 'sine' ? Math.sin(ph) : Math.tanh(Math.sin(ph) * 2)) * env * 0.3;
  }, { gain, verb: 0.3 });
}
function click(t0, gain = 1, f = 2600, pan = 0, dec = 0.004) {
  const bp = biquad('bandpass', f, 2.5);
  add(sfx, t0, 0.04, (t) => bp(noise()) * Math.exp(-t / dec) * 3.2, { gain, pan, verb: 0.08 });
}
function thunk(t0, gain = 1) {
  let ph = 0;
  add(sfx, t0, 0.4, (t) => {
    const f = 92 + 150 * Math.exp(-t / 0.018);
    ph += (TAU * f) / SR;
    return (Math.sin(ph) * Math.exp(-t / 0.085) + 0.3 * Math.sin(TAU * 430 * t) * Math.exp(-t / 0.035)) * 0.95;
  }, { gain, verb: 0.12 });
  click(t0, 0.45 * gain, 1700, 0, 0.006);
}
function slosh(t0, dur, gain = 1) {
  const bp = biquad('bandpass', 700, 1.2);
  add(sfx, t0, dur, (t) => {
    if ((Math.round(t * SR) & 15) === 0) bp.set(450 + 900 * Math.pow(Math.sin(t * 19), 2));
    return bp(noise()) * Math.min(1, t / 0.02) * Math.exp(-t / (dur * 0.4)) * 1.1;
  }, { gain, verb: 0.2 });
}
function glug(t0, gain = 1, pan = 0) {
  let ph = 0;
  add(sfx, t0, 0.24, (t) => {
    const f = 125 + 170 * Math.exp(-t / 0.028) + 55 * Math.sin(Math.PI * Math.min(1, t / 0.13));
    ph += (TAU * f) / SR;
    return Math.tanh(Math.sin(ph) * 1.8) * Math.min(1, t / 0.004) * Math.exp(-t / 0.07) * 0.85;
  }, { gain, pan, verb: 0.15 });
  plip(t0 + 0.07, 260, 620, 0.55 * gain, pan + 0.2);
}
function pop(t0, gain = 1) {
  let ph = 0;
  add(sfx, t0, 0.16, (t) => {
    const f = t < 0.01 ? 320 + 1300 * (t / 0.01) : 260 + 1360 * Math.exp(-(t - 0.01) / 0.028);
    ph += (TAU * f) / SR;
    return Math.sin(ph) * Math.min(1, t / 0.0008) * Math.exp(-t / 0.035);
  }, { gain, verb: 0.3 });
  const hp = biquad('highpass', 4500, 0.7);
  add(sfx, t0 + 0.008, 1.0, (t) => hp(noise()) * Math.exp(-t / 0.26) * 0.3 * (0.65 + 0.35 * Math.sin(t * 95)), { gain, verb: 0.2 });
}
function ding(t0, f = 1568, gain = 1, pan = 0) {
  add(sfx, t0, 2.2, (t) => {
    const env = Math.min(1, t / 0.002);
    return env * (Math.sin(TAU * f * t) * Math.exp(-t / 0.75) +
      0.45 * Math.sin(TAU * f * 2.76 * t) * Math.exp(-t / 0.28) +
      0.22 * Math.sin(TAU * f * 5.4 * t) * Math.exp(-t / 0.1)) * 0.3;
  }, { gain, pan, verb: 0.55 });
}
function crunch(t0, dur, gain = 1) {
  const R = rng(7);
  for (let i = 0; i < 90; i++) {
    const tt = t0 + Math.pow(R(), 0.7) * dur;
    click(tt, gain * (0.25 + R() * 0.75), 1200 + R() * 5200, R() * 1.4 - 0.7, 0.002 + R() * 0.006);
  }
  const bp = biquad('bandpass', 2600, 0.7);
  add(sfx, t0, dur + 0.1, (t) => bp(noise()) * Math.exp(-t / (dur * 0.5)) * (R() > 0.7 ? 1 : 0.3) * 0.9, { gain });
}
function sparkleArp(t0, midis, step = 0.045, gain = 1) {
  midis.forEach((m, i) => marimba(t0 + i * step, m, gain * (0.7 + 0.3 * (i / midis.length)), (i % 2 ? 0.4 : -0.4)));
}
function fillRise(t0, dur, f0, f1, gain = 1) {
  const bp = biquad('bandpass', f0, 9);
  add(sfx, t0, dur, (t) => {
    const p = t / dur;
    if ((Math.round(t * SR) & 15) === 0) bp.set(f0 * Math.pow(f1 / f0, p));
    const env = Math.min(1, t / 0.2) * Math.min(1, (dur - t) / 0.12);
    return bp(noise()) * env * 2.4;
  }, { gain, verb: 0.2 });
  const R = rng(13);
  for (let i = 0; i < 22; i++) {
    const tt = t0 + ((i + R()) / 22) * dur;
    const f = f0 * Math.pow(f1 / f0, (tt - t0) / dur);
    plip(tt, f * 0.8, f * 1.7, 0.22 * gain, R() - 0.5);
  }
}
function bubbles(t0, dur, n, gain = 1, seed = 3, f0 = 500, f1 = 1600) {
  const R = rng(seed);
  for (let i = 0; i < n; i++) {
    const p = (i + R() * 0.8) / n;
    const f = f0 + (f1 - f0) * p * (0.7 + R() * 0.6);
    plip(t0 + p * dur, f * 0.75, f * 1.8, gain * (0.4 + R() * 0.6), R() * 1.6 - 0.8);
  }
}
function tick(t0, gain = 1) {
  click(t0, gain, 3800, 0.2, 0.0025);
}

// =============================================================== music
const CH = {
  F: { pad: [53, 57, 60, 64, 67], pl: [65, 69, 72, 76], bass: 41 },
  G: { pad: [55, 59, 62, 64], pl: [67, 71, 74, 76], bass: 43 },
  Em: { pad: [52, 55, 59, 62], pl: [64, 67, 71, 74], bass: 40 },
  Am: { pad: [57, 60, 64, 67, 71], pl: [69, 72, 76, 79], bass: 45 },
  C: { pad: [48, 55, 59, 62, 64], pl: [67, 71, 74, 76], bass: 36 },
};
const GROOVE0 = TL.BEAT_DROP; // 3.0
const PROG = ['F', 'G', 'Em', 'Am'];
// melody per chord: [beat, midi]
const MEL = {
  F: [[0, 76], [0.5, 79], [1, 81], [2, 79], [2.5, 76], [3, 72]],
  G: [[0, 74], [0.5, 76], [1, 79], [2.5, 76], [3, 74]],
  Em: [[0, 71], [0.5, 74], [1, 76], [2, 79], [3, 76]],
  Am: [[0, 72], [0.5, 76], [1, 81], [1.5, 79], [2, 76], [3, 69]],
};
const BREAK = [TL.AHHH, TL.BUBBLES[0] + 0.05]; // drums rest for the "ahhh"
const inBreak = (t) => t >= BREAK[0] - 0.01 && t < BREAK[1];
const GROOVE_END = TL.S6; // 22.0

if (!NO_MUSIC) {
  // intro pad + build
  padChord(0, 1.45, CH.Am.pad, 0.9);
  padChord(1.45, 1.55, CH.G.pad, 0.9);
  // accelerating hat roll that lands just before the drop
  for (let i = 0; i < 10; i++) hat(GROOVE0 - 1.0 * Math.pow(1 - i / 10, 1.6), false, 0.12 + i * 0.045);

  for (let bar = 0; GROOVE0 + bar * BAR < GROOVE_END - 0.01; bar++) {
    const b0 = GROOVE0 + bar * BAR;
    const ch = CH[PROG[bar % 4]];
    const name = PROG[bar % 4];
    for (let beat = 0; beat < 4; beat++) {
      const t = b0 + beat * BEAT;
      if (t >= GROOVE_END - 0.01) break;
      if (!inBreak(t)) {
        kick(t, 1);
        if (bar >= 1 && (beat === 1 || beat === 3)) clap(t, 0.55);
        const sub = bar >= 4 ? 4 : 2;
        for (let s = 0; s < sub; s++) {
          const th = t + (s * BEAT) / sub;
          if (sub === 2 && s === 0) continue;
          if (inBreak(th)) continue;
          hat(th, beat === 3 && s === sub - 1 && bar % 2 === 1, s % 2 ? 0.42 : 0.24, 0.3);
        }
      }
      // pluck stabs on the off-beats
      const ts = t + BEAT / 2;
      if (ts < GROOVE_END - 0.01) ch.pl.forEach((m, i) => pluckNote(ts, m, 0.18, 0.9 - i * 0.08, (i - 1.5) * 0.2));
    }
    // bass: bouncy root pattern
    for (const [bt, oct, d] of [[0, 0, 0.3], [1.5, 0, 0.2], [2, 12, 0.2], [3, 0, 0.35]]) {
      const t = b0 + bt * BEAT;
      if (t < GROOVE_END - 0.01) bassNote(t, d, ch.bass + oct, 1);
    }
    // a quiet pad underneath
    padChord(b0, Math.min(BAR, GROOVE_END - b0) - 0.05, ch.pad, 0.45);
    // melody from step 3 onwards
    if (b0 >= TL.S3 - 0.01) for (const [bt, m] of MEL[name]) {
      const t = b0 + bt * BEAT;
      if (t < GROOVE_END - 0.01) marimba(t, m, 0.75, Math.sin(m) * 0.4);
    }
  }
  crash(GROOVE0, 0.8);
  crash(TL.BUBBLES[0] + 0.05, 0.55);
  // outro: resolve and breathe out into the intro pad
  padChord(GROOVE_END, 2.0, CH.F.pad, 1.1);
  padChord(GROOVE_END + 2.0, 1.5, CH.C.pad, 0.9);
  [65, 69, 72, 76, 79, 84].forEach((m, i) => marimba(TL.S6 + 0.15 + i * 0.09, m, 0.55, i % 2 ? 0.4 : -0.4));
  bassNote(GROOVE_END, 1.6, 41, 0.8);
  bassNote(GROOVE_END + 2.0, 1.3, 36, 0.6);
}

// ================================================================= sfx
// intro
whoosh(TL.DROP_START, TL.DROP_HIT - TL.DROP_START, 900, 3200, 0.35, 0, 0, 0.95, 2.5);
plip(TL.DROP_HIT, 480, 1600, 1.0);
splash(TL.DROP_HIT + 0.005, 0.6, 0.8);
add(sfx, TL.DROP_HIT, 0.3, (t) => Math.sin(TAU * 62 * t) * Math.exp(-t / 0.08) * 0.8, { gain: 0.9 });
whoosh(TL.DROP_HIT + 0.04, 0.5, 600, 2400, 0.45, -0.3, 0.3, 0.3);
sparkleArp(TL.TITLE_IN + 0.05, [76, 79, 84, 88, 91], 0.05, 0.55);
bubbles(TL.WORD_FILL[0], TL.WORD_FILL[1] - TL.WORD_FILL[0], 14, 0.35, 21, 500, 1300);
// wave wipe into the drop
whoosh(TL.WAVE[0], 1.0, 250, 3500, 1.0, -0.7, 0.7, 0.55, 0.8);
splash(TL.WAVE[0] + 0.25, 0.9, 0.55, -0.3);
splash(TL.WAVE[0] + 0.45, 0.9, 0.5, 0.3);
sweepTone(TL.WAVE[0] - 0.4, 0.95, 180, 900, 0.4);
bubbles(TL.WAVE[0] + 0.1, 0.8, 16, 0.4, 5, 400, 1500);

// step 1 — grab it
whoosh(TL.BOTTLE_FALL[0], TL.BOTTLE_FALL[1] - TL.BOTTLE_FALL[0], 1800, 700, 0.5, 0.2, 0, 0.8, 1.6);
thunk(TL.BOTTLE_FALL[1], 1.0);
slosh(TL.BOTTLE_FALL[1] + 0.02, 0.6, 0.6);
whoosh(TL.HAND_IN[0], 0.55, 500, 1600, 0.55, 0.9, 0.2, 0.55);
click(TL.GRIP - 0.03, 0.5, 1100, 0.3, 0.012);
add(sfx, TL.GRIP, 0.09, (t) => Math.sin(TAU * (1900 + 900 * t / 0.09) * t) * Math.exp(-t / 0.03) * 0.18, { gain: 1, pan: 0.2 });
ding(TL.GRIP + 0.02, 2093, 0.25, 0.3);
sweepTone(TL.LIFT[0] + 0.12, 0.42, 300, 900, 0.5);
slosh(TL.LIFT[0] + 0.3, 0.5, 0.45);

// transition 2 — push into the cap
whoosh(TL.ZOOM[0], TL.ZOOM[1] - TL.ZOOM[0] + 0.1, 300, 5000, 1.0, -0.4, 0.4, 0.7, 0.9);
sweepTone(TL.ZOOM[0] + 0.1, 0.7, 220, 1200, 0.35);
plip(TL.ZOOM[1] - 0.12, 700, 1800, 0.45);

// step 2 — twist it
for (const t0 of TL.TWISTS) for (let k = 0; k < 4; k++) click(t0 + 0.03 + k * 0.075, 0.75, 2400 + k * 180, -0.15, 0.003);
click(TL.CRACK, 1.0, 3200, 0.25, 0.008);
click(TL.CRACK + 0.012, 0.8, 1900, -0.25, 0.01);
crunch(TL.CRACK, 0.08, 0.35);
pop(TL.POP, 1.1);
whoosh(TL.POP + 0.02, 0.6, 900, 4000, 0.5, 0, 0.8, 0.3);
whoosh(TL.PULLBACK[0], 0.8, 2500, 500, 0.4, 0.3, -0.3, 0.5);

// transition 3 + step 3 — tilt it
whoosh(TL.TILT_WIPE[0], 0.75, 400, 2800, 0.8, 0.7, -0.7, 0.5, 1.0);
slosh(TL.TILT[0] + 0.3, 1.0, 0.6);
for (const g of TL.GLUGS) glug(g, 1.0, -0.15);
slosh(TL.DRINK[0], 2.0, 0.25);

// transition 4 — the dive
whoosh(TL.DIVE[0], 1.2, 1600, 180, 0.8, 0.2, -0.2, 0.45, 0.9);
glug(TL.DIVE[0] + 0.12, 0.8);
sweepTone(TL.DIVE[0] + 0.1, 0.9, 520, 140, 0.35);

// step 4 — gulp it
fillRise(TL.FILL[0], TL.FILL[1] - TL.FILL[0], 260, 1700, 0.55);
ding(TL.FILL[1], 1568, 0.9);
ding(TL.FILL[1] + 0.12, 2349, 0.5, 0.3);
whoosh(TL.AHHH - 0.45, 0.5, 600, 6000, 0.5, -0.2, 0.2, 0.92);
sparkleArp(TL.AHHH, [72, 76, 79, 84, 88, 91, 96], 0.05, 0.65);
ding(TL.AHHH + 0.02, 2637, 0.35, -0.3);

// transition 5 — bubble burst
bubbles(TL.BUBBLES[0], TL.BUBBLES[1] - TL.BUBBLES[0], 28, 0.75, 9, 380, 1900);
whoosh(TL.BUBBLES[0], 0.8, 300, 2600, 0.5, 0, 0, 0.5);

// step 5 — recycle it
whoosh(TL.BOTTLE_IN[0], 0.45, 1600, 600, 0.45, -0.2, 0, 0.8, 1.6);
thunk(TL.BOTTLE_IN[1] - 0.18, 0.45);
sweepTone(TL.CAP_ON[0] - 0.1, 0.34, 1600, 600, 0.35);
click(TL.CAP_ON[0] + 0.24, 0.9, 1500, 0, 0.01);
for (let k = 0; k < 4; k++) click(TL.CAP_ON[0] + 0.32 + k * 0.05, 0.7, 2600 - k * 120, 0.15, 0.003);
crunch(TL.CRUSH[0], TL.CRUSH[1] - TL.CRUSH[0] + 0.05, 0.9);
sweepTone(TL.TOSS[0], 0.25, 400, 1100, 0.45);
whoosh(TL.TOSS[0] + 0.05, 0.5, 2000, 800, 0.45, -0.4, 0.4, 0.4);
thunk(TL.BIN_HIT, 0.85);
click(TL.BIN_HIT + 0.01, 0.6, 900, 0, 0.02);
sparkleArp(TL.SYMBOL[0], [72, 76, 79, 83, 84, 88], 0.06, 0.6);
// transition 6 — through the symbol
whoosh(TL.ZOOM_THROUGH[0], TL.ZOOM_THROUGH[1] - TL.ZOOM_THROUGH[0] + 0.15, 250, 6000, 1.0, 0, 0, 0.8, 0.8);
sweepTone(TL.ZOOM_THROUGH[0] + 0.1, 0.75, 200, 1400, 0.35);

// outro
plip(22.0, 420, 1300, 0.9);
plip(22.02, 900, 2200, 0.4, 0.3);
splash(TL.S6 + 0.15, 0.4, 0.25);
bubbles(TL.OUTRO_FILL[0], TL.OUTRO_FILL[1] - TL.OUTRO_FILL[0], 14, 0.3, 31, 500, 1400);
for (let i = 0; i < 12; i++) tick(23.15 + i * (0.5 / 12), 0.35);
sweepTone(TL.DRAIN[0], 0.6, 900, 200, 0.3);
for (let i = 0; i < 5; i++) plip(TL.DRAIN[0] + 0.45 + i * 0.07, 380 - i * 30, 900 - i * 60, 0.4, (i - 2) * 0.25);
whoosh(TL.DRAIN[0] + 0.1, 0.8, 2400, 500, 0.35, 0, 0, 0.3);

// ================================================================= mix
function freeverb(src, room = 0.82, damp = 0.3) {
  const sc = SR / 44100;
  const combT = [1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617].map((v) => Math.round(v * sc));
  const apT = [556, 441, 341, 225].map((v) => Math.round(v * sc));
  const spread = Math.round(23 * sc);
  const out = bus();
  for (const [inp, o, off] of [[src.L, out.L, 0], [src.R, out.R, spread]]) {
    const combs = combT.map((l) => ({ b: new Float32Array(l + off), i: 0, st: 0 }));
    const aps = apT.map((l) => ({ b: new Float32Array(l + off), i: 0 }));
    for (let n = 0; n < N; n++) {
      const x = inp[n] * 0.015;
      let s = 0;
      for (const c of combs) {
        const y = c.b[c.i];
        c.st = y * (1 - damp) + c.st * damp;
        c.b[c.i] = x + c.st * room;
        if (++c.i >= c.b.length) c.i = 0;
        s += y;
      }
      for (const a of aps) {
        const bv = a.b[a.i];
        const y = bv - s;
        a.b[a.i] = s + bv * 0.5;
        if (++a.i >= a.b.length) a.i = 0;
        s = y;
      }
      o[n] = s * 3;
    }
  }
  return out;
}
function pingpong(src, time = BEAT * 0.75, fb = 0.38) {
  const d = Math.round(time * SR);
  const out = bus();
  const lpL = biquad('lowpass', 3500), lpR = biquad('lowpass', 3500);
  for (let n = 0; n < N; n++) {
    const fl = n >= d ? out.R[n - d] : 0;
    const fr = n >= d ? out.L[n - d] : 0;
    out.L[n] = lpL(src.L[n] * 0.7 + fl * fb);
    out.R[n] = lpR(src.R[n] * 0.3 + fr * fb);
  }
  return out;
}
const verb = freeverb(verbSend);
const dly = pingpong(delaySend);

// sidechain: synths duck under each kick
const duck = new Float32Array(N).fill(1);
if (!NO_MUSIC) {
  for (let t = GROOVE0; t < GROOVE_END - 0.01; t += BEAT) {
    if (inBreak(t)) continue;
    const i0 = Math.round(t * SR);
    for (let i = 0; i < SR * 0.42 && i0 + i < N; i++) {
      const g = 1 - 0.55 * Math.exp(-i / SR / 0.11);
      duck[i0 + i] = Math.min(duck[i0 + i], g);
    }
  }
}

const L = new Float32Array(N), R = new Float32Array(N);
const MUS = NO_MUSIC ? 0 : 0.8, SFX = 1.0;
for (let n = 0; n < N; n++) {
  const d = duck[n];
  L[n] = MUS * (drums.L[n] * 0.85 + synth.L[n] * d) + SFX * sfx.L[n] + verb.L[n] * 0.5 + dly.L[n] * 0.35 * (MUS ? 1 : 0.4);
  R[n] = MUS * (drums.R[n] * 0.85 + synth.R[n] * d) + SFX * sfx.R[n] + verb.R[n] * 0.5 + dly.R[n] * 0.35 * (MUS ? 1 : 0.4);
}
// gentle fades at the very edges so the loop seam never clicks
const fade = Math.round(0.012 * SR);
for (let i = 0; i < fade; i++) {
  const g = i / fade;
  L[i] *= g; R[i] *= g;
  L[N - 1 - i] *= g; R[N - 1 - i] *= g;
}

// ------------------------------------------------------- level + write
function writeWav(file, l, r, gain) {
  const buf = Buffer.alloc(44 + N * 4);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + N * 4, 4);
  buf.write('WAVE', 8);
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(2, 22);
  buf.writeUInt32LE(SR, 24);
  buf.writeUInt32LE(SR * 4, 28);
  buf.writeUInt16LE(4, 32);
  buf.writeUInt16LE(16, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(N * 4, 40);
  // soft-knee limiter: linear below 0.7, smoothly saturating above, with a
  // ceiling under -1 dBFS so the AAC encode keeps true peaks in check
  const lim = (x) => {
    const a = Math.abs(x), k = 0.7;
    const y = a <= k ? a : k + (1 - k) * Math.tanh((a - k) / (1 - k));
    return Math.sign(x) * y * 0.86;
  };
  for (let n = 0; n < N; n++) {
    buf.writeInt16LE(Math.round(clamp(lim(l[n] * gain), -1, 1) * 32767), 44 + n * 4);
    buf.writeInt16LE(Math.round(clamp(lim(r[n] * gain), -1, 1) * 32767), 46 + n * 4);
  }
  fs.writeFileSync(file, buf);
}
// integrated loudness + true peak via ffmpeg's ebur128 (summary is on stderr)
function measure(file) {
  const txt = execFileSync('sh', ['-c', `ffmpeg -hide_banner -nostats -i "${file}" -af ebur128=peak=true -f null - 2>&1`], {
    encoding: 'utf8',
  });
  const last = (re) => Number((txt.match(re) || []).pop().match(/-?[\d.]+/)[0]);
  return { I: last(/I:\s+-?[\d.]+ LUFS/g), P: last(/Peak:\s+-?[\d.]+ dBFS/g) };
}

fs.mkdirSync(path.join(ROOT, 'out'), { recursive: true });
fs.mkdirSync(path.join(ROOT, 'media'), { recursive: true });
const wav = path.join(ROOT, 'out', NO_MUSIC ? 'soundtrack-sfx.wav' : 'soundtrack.wav');
let peak = 0;
for (let n = 0; n < N; n++) peak = Math.max(peak, Math.abs(L[n]), Math.abs(R[n]));
let gain = 0.8 / peak;
writeWav(wav, L, R, gain);
const TARGET = NO_MUSIC ? -16 : -14; // sparser SFX-only mix gets a little more headroom
for (let pass = 0; pass < 2; pass++) {
  const m = measure(wav);
  const delta = TARGET - m.I;
  console.log(`pass ${pass}: ${m.I.toFixed(1)} LUFS, peak ${m.P.toFixed(1)} dBTP`);
  if (Math.abs(delta) < 0.3) break;
  gain *= Math.pow(10, delta / 20);
  writeWav(wav, L, R, gain);
}
const fin = measure(wav);
console.log(`Wrote ${path.relative(ROOT, wav)}: ${fin.I.toFixed(1)} LUFS, peak ${fin.P.toFixed(1)} dBTP`);
if (!NO_MUSIC) {
  const m4a = path.join(ROOT, 'media', 'soundtrack.m4a');
  execFileSync('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', '-i', wav, '-c:a', 'aac', '-b:a', '160k', '-movflags', '+faststart', m4a]);
  console.log(`Wrote ${path.relative(ROOT, m4a)}`);
}

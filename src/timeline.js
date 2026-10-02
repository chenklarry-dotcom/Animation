// Shared timing sheet (seconds). Read by the renderer (browser) and by the
// soundtrack generator (Node), so picture and sound stay locked together.
// The edit sits on a 120 BPM grid: one beat = 0.5 s.
(function (root) {
  const TL = {
    FPS: 60,
    DURATION: 26,
    BPM: 120,

    // 0 · intro — drop + title
    DROP_START: 0.3,
    DROP_HIT: 0.9,
    TITLE_IN: 1.0,
    WORD_FILL: [1.35, 2.35],
    WAVE: [2.45, 3.45], // transition 1: liquid wave wipe (navy -> yellow)
    BEAT_DROP: 3.0,

    // 1 · GRAB IT (yellow)
    S1: 3.0,
    BOTTLE_FALL: [3.05, 3.5],
    HEADER_IN: 3.4,
    HAND_IN: [4.15, 4.85],
    GRIP: 5.0,
    LIFT: [5.35, 6.15],
    ZOOM: [6.35, 7.15], // transition 2: push into the cap + iris (yellow -> ice)

    // 2 · TWIST IT (ice)
    S2: 7.0,
    TWISTS: [7.5, 8.0, 8.5],
    TWIST_DUR: 0.34,
    CRACK: 8.18,
    POP: 9.0,
    PULLBACK: [9.25, 10.05],

    // 3 · TILT IT (cobalt)
    TILT_WIPE: [9.95, 10.65], // transition 3: clock wipe locked to the tilt
    S3: 10.5,
    TILT: [9.95, 11.35],
    GLUGS: [11.5, 12.0, 12.5, 13.0],
    DRINK: [11.4, 13.55],

    // 4 · GULP IT (cobalt, continuous camera move)
    DIVE: [13.55, 14.75], // transition 4: follow the gulp down the throat
    S4: 14.0,
    FILL: [14.9, 17.05],
    AHHH: 17.45,

    // 5 · RECYCLE IT (mint)
    BUBBLES: [17.95, 18.7], // transition 5: bubble burst reveal (cobalt -> mint)
    S5: 18.5,
    BOTTLE_IN: [18.45, 18.95],
    CAP_ON: [18.95, 19.47],
    CRUSH: [19.5, 19.85],
    TOSS: [20.0, 20.55],
    BIN_HIT: 20.55,
    SYMBOL: [20.75, 21.4],
    ZOOM_THROUGH: [21.35, 22.15], // transition 6: through the recycle symbol (mint -> navy)

    // 6 · STAY HYDRATED (navy)
    S6: 22.0,
    OUTRO_FILL: [22.55, 23.9],
    DRAIN: [24.75, 25.7],
  };

  // The header verb that changes per step ("___ IT.").
  TL.STEPS = [
    { n: 1, verb: 'GRAB', at: TL.S1 },
    { n: 2, verb: 'TWIST', at: TL.S2 },
    { n: 3, verb: 'TILT', at: TL.S3 },
    { n: 4, verb: 'GULP', at: TL.S4 },
    { n: 5, verb: 'RECYCLE', at: TL.S5 },
  ];

  if (typeof module !== 'undefined' && module.exports) module.exports = TL;
  else root.TL = TL;
})(typeof window !== 'undefined' ? window : globalThis);

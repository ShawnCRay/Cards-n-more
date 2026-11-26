/* audio.js - DCW book 2 chiptune engine: late-NES / Famicom-expansion style, everything synthesized
 * with WebAudio (no files, no network).
 *
 * Tracker channels (one voice each, like the hardware):
 *   p1 p2   2A03 pulses (12.5 / 25 / 50% duty)          tr  2A03 4-bit stepped triangle
 *   nz      2A03 LFSR noise (long + short mode)
 *   v1 v2   VRC6-style pulses with 8 duty steps (1/16 .. 8/16, waves q1..q8)
 *   sw      VRC6-style 7-step sawtooth
 *   dm sb   DPCM-style sample voices. Samples are synthesized once in code at NES DMC rates
 *           (4-33 kHz), run through a 1-bit delta encoder (7-bit DAC, +-2 per sample, so the slew
 *           limit gives the familiar crunch) and played back zero-order-hold: kick, snare, clap,
 *           three toms, timpani, slap bass, orchestra stab, "whoa", crowd cheer / boo / laugh, shriek.
 * Mix: buses -> master -> highpass -> low shelf -> lowpass -> soft saturator -> compressor -> limiter
 *      -> safety clip, plus a small stereo room on the music bus, so it sounds as big as we remember.
 * Music is compact pattern data compiled to event lists and scheduled ahead against currentTime by
 * a lookahead timer. The same graph code renders into an OfflineAudioContext for tests
 * (DCW.audio.renderOffline).
 */
(function () {
  'use strict';
  var DCW = window.DCW = window.DCW || {};
  var A = DCW.audio = DCW.audio || {};

  var AC = window.AudioContext || window.webkitAudioContext;
  var OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;

  /* ================================================================== notes */
  var PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  var NN = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  function mtof(m) { return 440 * Math.pow(2, (m - 69) / 12); }
  function noteNum(s) {
    var m = /^([A-G])([#b]?)(-?\d)$/.exec(s);
    if (!m) return null;
    return 12 * (+m[3] + 1) + PC[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
  }
  function nm(m) { return NN[((m % 12) + 12) % 12] + (Math.floor(m / 12) - 1); }
  function nf(s) { return mtof(noteNum(s)); }
  function assign(a) { for (var i = 1; i < arguments.length; i++) { var b = arguments[i]; if (b) for (var k in b) a[k] = b[k]; } return a; }

  /* ================================================================== waves */
  function pulseWave(c, d) {
    var N = 64, re = new Float32Array(N), im = new Float32Array(N);
    for (var n = 1; n < N; n++) {
      re[n] = Math.sin(2 * Math.PI * n * d) / (n * Math.PI);
      im[n] = (1 - Math.cos(2 * Math.PI * n * d)) / (n * Math.PI);
    }
    return c.createPeriodicWave(re, im);
  }
  var coefCache = {};
  function sampledWave(c, key, fn) { // periodic wave from a stepped shape fn(phase 0..1) -> -1..1
    var cf = coefCache[key];
    if (!cf) {
      var N = 64, S = 2048, re = new Float32Array(N), im = new Float32Array(N);
      for (var s = 0; s < S; s++) {
        var v = fn(s / S);
        for (var n = 1; n < N; n++) { var ph = 2 * Math.PI * n * s / S; re[n] += v * Math.cos(ph) * 2 / S; im[n] += v * Math.sin(ph) * 2 / S; }
      }
      cf = coefCache[key] = [re, im];
    }
    return c.createPeriodicWave(cf[0], cf[1]);
  }
  function triShape(p) { var st = Math.floor(p * 32), val = st < 16 ? 15 - st : st - 16; return val / 7.5 - 1; } // NES 32-step 4-bit
  function sawShape(p) { return Math.floor(p * 7) / 3 - 1; }                                                  // VRC6 7-step ramp
  function lfsrBuffer(c, steps, isShort, hold, reps) {
    var sr = c.sampleRate, len = steps * hold * reps, buf = c.createBuffer(1, len, sr), d = buf.getChannelData(0), r = 1, i = 0;
    for (var rp = 0; rp < reps; rp++) {
      for (var k = 0; k < steps; k++) {
        var bit = (r ^ (r >> (isShort ? 6 : 1))) & 1;
        r = (r >> 1) | (bit << 14);
        var v = (r & 1) ? -0.9 : 0.9;
        for (var h = 0; h < hold; h++) d[i++] = v;
      }
    }
    return buf;
  }

  /* ================================================================== DPCM-style samples */
  // Each sample is synthesized once (deterministic), normalized, then 1-bit-delta encoded.
  // root = the pitch (Hz) the sample plays at rate 1, for pitched use.
  var SMP = {
    kick:   { rate: 16885, len: 0.34, peak: 0.98 },
    snare:  { rate: 21307, len: 0.26, peak: 0.95 },
    clap:   { rate: 21307, len: 0.3, peak: 0.92 },
    tomH:   { rate: 16885, len: 0.4, peak: 0.95 },
    tomM:   { rate: 16885, len: 0.45, peak: 0.95 },
    tomL:   { rate: 16885, len: 0.55, peak: 0.95 },
    timp:   { rate: 11186, len: 1.5, peak: 0.95, root: 98 },
    slap:   { rate: 16885, len: 0.75, peak: 0.92, root: 16885 / 204.5 },
    ostab:  { rate: 13983, len: 0.7, peak: 0.92, root: 261.63 },
    whoa:   { rate: 24858, len: 0.62, peak: 0.9, root: 185 },
    cheer:  { rate: 11186, len: 1.9, peak: 0.88 },
    boo:    { rate: 11186, len: 1.4, peak: 0.88 },
    laugh:  { rate: 11186, len: 1.45, peak: 0.88 },
    shriek: { rate: 16885, len: 0.85, peak: 0.88, root: 880 }
  };
  function lcg(seed) { var s = seed >>> 0 || 1; return function () { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; }
  function fst() { return { y1: 0, y2: 0 }; }
  function fstep(st, x, f, bw, sr) { // 2-pole resonator (formant / band filter), coefficients per sample
    var r = Math.exp(-Math.PI * bw / sr), y = (1 - r) * x + 2 * r * Math.cos(2 * Math.PI * f / sr) * st.y1 - r * r * st.y2;
    st.y2 = st.y1; st.y1 = y; return y;
  }
  function drumTone(d, sr, R, f0, fs, fd, dec, click) { // swept sine body + noise click
    var ph = 0;
    for (var i = 0; i < d.length; i++) {
      var t = i / sr, f = f0 + fs * Math.exp(-t * fd);
      ph += 2 * Math.PI * f / sr;
      d[i] = Math.sin(ph) * Math.exp(-t * dec) * Math.min(1, t * 3000 + 0.25) + (R() * 2 - 1) * click * Math.exp(-t * 240);
    }
  }
  function crowd(d, sr, R, o) { // a crowd of naive-saw voices through one shared vowel
    var vs = [], k, i, n = o.n;
    for (k = 0; k < n; k++) vs.push({ f: o.lo + R() * (o.hi - o.lo), ph: R(), on: R() * o.spread, vr: 4 + R() * 3, vd: 0.012 + R() * 0.03, vp: R() * 6.28, amp: 0.45 + R() * 0.55, ha: 4.3 + R() * 2.2, hp: R() });
    var fs = o.vowel.map(fst);
    for (i = 0; i < d.length; i++) {
      var t = i / sr, src = 0;
      for (k = 0; k < n; k++) {
        var v = vs[k]; if (t < v.on) continue;
        var tv = t - v.on, f = v.f * (1 + o.glide * Math.min(1, tv / 0.45)) * (1 + v.vd * Math.sin(6.283 * v.vr * t + v.vp));
        v.ph += f / sr; if (v.ph >= 1) v.ph -= 1;
        var a = v.amp * Math.min(1, tv / 0.07);
        if (o.ha) { var hp = (tv * v.ha + v.hp) % 1; a *= hp < 0.55 ? Math.sin(hp / 0.55 * Math.PI) : 0; }
        src += (v.ph * 2 - 1) * a;
      }
      src = src / Math.sqrt(n) + (R() * 2 - 1) * o.breath;
      var y = 0; for (k = 0; k < o.vowel.length; k++) y += fstep(fs[k], src, o.vowel[k][0], o.vowel[k][1], sr) * o.vowel[k][2];
      d[i] = y * o.env(t);
    }
  }
  var SMPGEN = {
    kick: function (d, sr, R) { drumTone(d, sr, R, 46, 130, 32, 7.5, 0.5); },
    snare: function (d, sr, R) {
      var ph = 0, prev = 0;
      for (var i = 0; i < d.length; i++) {
        var t = i / sr, f = 180 + 60 * Math.exp(-t * 40), n = R() * 2 - 1, hp = n - prev * 0.55; prev = n;
        ph += 2 * Math.PI * f / sr;
        d[i] = Math.sin(ph) * 0.75 * Math.exp(-t * 26) + hp * 0.9 * Math.exp(-t * 12.5);
      }
    },
    clap: function (d, sr, R) {
      var st = fst();
      for (var i = 0; i < d.length; i++) {
        var t = i / sr, e = 0, k;
        for (k = 0; k < 3; k++) { var tk = t - k * 0.011; if (tk >= 0 && tk < 0.03) e = Math.max(e, Math.exp(-tk * 230)); }
        if (t > 0.033) e = Math.max(e, 0.62 * Math.exp(-(t - 0.033) * 15));
        var n = R() * 2 - 1;
        d[i] = (fstep(st, n, 1150, 900, sr) * 2.2 + n * 0.3) * e;
      }
    },
    tomH: function (d, sr, R) { drumTone(d, sr, R, 175, 70, 25, 8, 0.3); },
    tomM: function (d, sr, R) { drumTone(d, sr, R, 128, 50, 25, 7, 0.3); },
    tomL: function (d, sr, R) { drumTone(d, sr, R, 88, 40, 22, 6, 0.3); },
    timp: function (d, sr, R) {
      var P = [[1, 1, 2.4], [1.504, 0.5, 3.2], [1.742, 0.32, 4], [2.0, 0.24, 4.6], [2.245, 0.14, 5.5]], ph = [0, 0, 0, 0, 0];
      for (var i = 0; i < d.length; i++) {
        var t = i / sr, bend = 1 + 0.03 * Math.exp(-t * 18), s = 0;
        for (var k = 0; k < P.length; k++) { ph[k] += 2 * Math.PI * 98 * P[k][0] * bend / sr; s += Math.sin(ph[k]) * P[k][1] * Math.exp(-t * P[k][2]); }
        d[i] = s * Math.min(1, t * 500) + (R() * 2 - 1) * 0.35 * Math.exp(-t * 70);
      }
    },
    slap: function (d, sr, R) { // Karplus-Strong pluck + thumb thump + 4th-harmonic pop, soft clipped
      var N = 204, buf = new Float32Array(N), idx = 0, f0 = sr / (N + 0.5), k;
      for (k = 0; k < N; k++) buf[k] = (R() * 2 - 1) * 0.6 + (k < N * 0.3 ? 0.8 : -0.34);
      for (var i = 0; i < d.length; i++) {
        var t = i / sr, j = idx + 1; if (j >= N) j = 0;
        var y = buf[idx]; buf[idx] = 0.5 * (y + buf[j]) * 0.9985; idx = j;
        var thump = Math.sin(2 * Math.PI * f0 * t) * 0.5 * Math.exp(-t * 7), pop = Math.sin(8 * Math.PI * f0 * t) * 0.25 * Math.exp(-t * 40);
        d[i] = Math.tanh(1.6 * (y + thump + pop)) * Math.exp(-t * 2.2) * Math.min(1, t * 3000);
      }
    },
    ostab: function (d, sr, R) { // power-chord orchestra hit: detuned saw ensemble, falling lowpass, noise blat
      var vs = [], lp = 0;
      [[-12, 0.9], [0, 1], [7, 0.85], [12, 0.7], [19, 0.4], [24, 0.25]].forEach(function (tn) {
        [-6, 6].forEach(function (c) { vs.push({ f: 261.63 * Math.pow(2, tn[0] / 12 + c / 1200), a: tn[1], ph: R() }); });
      });
      for (var i = 0; i < d.length; i++) {
        var t = i / sr, s = 0;
        for (var k = 0; k < vs.length; k++) { var v = vs[k]; v.ph += v.f / sr; if (v.ph >= 1) v.ph -= 1; s += (v.ph * 2 - 1) * v.a; }
        s = s / 4 + (R() * 2 - 1) * 0.8 * Math.exp(-t * 45);
        var fc = 900 + 5200 * Math.exp(-t * 7); lp += (1 - Math.exp(-2 * Math.PI * fc / sr)) * (s - lp);
        d[i] = lp * Math.min(1, t / 0.004) * (0.55 * Math.exp(-t * 3.2) + 0.45 * Math.exp(-t * 16));
      }
    },
    whoa: function (d, sr, R) { // shouted "whoa": saw glottis, formants glide u -> o -> aw
      var ph = 0, a = fst(), b = fst(), c = fst(), L = d.length / sr;
      for (var i = 0; i < d.length; i++) {
        var t = i / sr, u = Math.min(1, t / 0.22), f0 = 185 * (0.94 + 0.08 * Math.sin(Math.PI * Math.min(1, t / L)));
        ph += f0 / sr; if (ph >= 1) ph -= 1;
        var src = (ph * 2 - 1) + (R() * 2 - 1) * 0.04;
        var y = fstep(a, src, 300 + 240 * u, 80, sr) + 0.55 * fstep(b, src, 640 + 250 * u, 100, sr) + 0.2 * fstep(c, src, 2200 + 250 * u, 150, sr);
        d[i] = y * Math.min(1, t / 0.07) * (t > L - 0.16 ? Math.max(0, (L - t) / 0.16) : 1);
      }
    },
    cheer: function (d, sr, R) {
      crowd(d, sr, R, { n: 22, lo: 150, hi: 360, spread: 0.3, glide: 0.15, breath: 0.25, vowel: [[760, 140, 1], [1300, 180, 0.6], [2500, 260, 0.25]],
        env: function (t) { return Math.min(1, t / 0.25) * (t > 1.15 ? Math.max(0, 1 - (t - 1.15) / 0.75) : 1); } });
      var cl = 0, dec = Math.exp(-1 / (sr * 0.004));
      for (var i = 0; i < d.length; i++) {
        var t = i / sr; if (R() < 230 / sr) cl = 0.5 + R() * 0.5; cl *= dec;
        d[i] += (R() * 2 - 1) * cl * 0.35 * Math.min(1, t / 0.15) * (t > 1.2 ? Math.max(0, 1 - (t - 1.2) / 0.7) : 1);
      }
    },
    boo: function (d, sr, R) {
      crowd(d, sr, R, { n: 18, lo: 95, hi: 175, spread: 0.2, glide: -0.08, breath: 0.12, vowel: [[320, 80, 1], [800, 100, 0.45], [2300, 160, 0.12]],
        env: function (t) { return Math.min(1, t / 0.2) * (t > 0.85 ? Math.max(0, 1 - (t - 0.85) / 0.55) : 1); } });
    },
    laugh: function (d, sr, R) {
      crowd(d, sr, R, { n: 14, lo: 170, hi: 320, spread: 0.15, glide: -0.1, breath: 0.18, ha: true, vowel: [[750, 130, 1], [1200, 170, 0.55], [2600, 250, 0.2]],
        env: function (t) { return Math.min(1, t / 0.08) * (t > 0.9 ? Math.max(0, 1 - (t - 0.9) / 0.55) : 1); } });
    },
    shriek: function (d, sr, R) {
      var ph = 0, a = fst(), b = fst(), L = d.length / sr;
      for (var i = 0; i < d.length; i++) {
        var t = i / sr, f = 880 * (0.85 + 0.3 * Math.min(1, t / 0.25)) * (1 + 0.05 * Math.sin(2 * Math.PI * 17 * t) + 0.02 * (R() - 0.5));
        ph += f / sr; if (ph >= 1) ph -= 1;
        var src = (ph < 0.3 ? 1 : -0.43) + (R() * 2 - 1) * 0.35;
        var y = fstep(a, src, 1300, 300, sr) + 0.8 * fstep(b, src, 2900, 500, sr) + 0.3 * src;
        d[i] = y * Math.min(1, t / 0.03) * (t > L - 0.3 ? Math.max(0, (L - t) / 0.3) : 1);
      }
    }
  };
  var smpCache = {};
  function smpSource(name) { // -> Float32Array of decoded 1-bit-delta levels at SMP[name].rate
    if (smpCache[name]) return smpCache[name];
    var def = SMP[name], n = Math.round(def.rate * def.len), src = new Float32Array(n), R = lcg(0x5eed + name.length * 977 + name.charCodeAt(0)), i, pk = 0;
    SMPGEN[name](src, def.rate, R);
    for (i = 0; i < n; i++) pk = Math.max(pk, Math.abs(src[i]));
    var sc = pk > 0 ? def.peak / pk : 0, out = new Float32Array(n), L = 64;
    for (i = 0; i < n; i++) { // DMC: 7-bit DAC, each 1-bit delta moves it +-2
      var target = 64 + src[i] * sc * 62;
      if (target > L) { if (L <= 125) L += 2; } else if (L >= 2) L -= 2;
      out[i] = (L - 64) / 64;
    }
    var fade = Math.min(n, Math.round(def.rate * 0.004));
    for (i = 0; i < fade; i++) out[n - 1 - i] *= i / fade;
    return (smpCache[name] = out);
  }
  function smpBuffer(c, name) { // zero-order-hold upsample to the context rate (the DAC holds each level)
    var s = smpSource(name), rate = SMP[name].rate, sr = c.sampleRate, n = Math.ceil(s.length * sr / rate), buf = c.createBuffer(1, n, sr), d = buf.getChannelData(0), k = rate / sr;
    for (var j = 0; j < n; j++) d[j] = s[Math.min(s.length - 1, Math.floor(j * k))];
    return buf;
  }
  function getSmp(e, name) { return e.smp[name] || (e.smp[name] = smpBuffer(e.ctx, name)); }

  /* ================================================================== engine (per context) */
  function curve(n, fn) { var a = new Float32Array(n); for (var i = 0; i < n; i++) a[i] = fn(i / (n - 1) * 2 - 1); return a; }
  var SAT = null, SAFE = null;
  function makeEngine(c, raw) {
    var e = { ctx: c, sr: c.sampleRate, smp: {} };
    e.waves = { tri: sampledWave(c, 'tri', triShape), saw: sampledWave(c, 'saw7', sawShape) };
    for (var q = 1; q <= 8; q++) e.waves['q' + q] = pulseWave(c, q / 16);
    e.waves.p12 = e.waves.q2; e.waves.p25 = e.waves.q4; e.waves.p50 = e.waves.q8;
    e.nz = {
      L1: lfsrBuffer(c, 32767, false, 1, 1), L8: lfsrBuffer(c, 32767, false, 8, 1),
      S1: lfsrBuffer(c, 93, true, 1, 64), S4: lfsrBuffer(c, 93, true, 4, 16)
    };
    e.master = c.createGain(); e.master.gain.value = 0.72;
    if (raw) e.master.connect(c.destination);
    else {
      var hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 30;
      var ls = c.createBiquadFilter(); ls.type = 'lowshelf'; ls.frequency.value = 140; ls.gain.value = 2.5;
      var lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = Math.min(13500, c.sampleRate * 0.45); lp.Q.value = 0.5;
      var sat = c.createWaveShaper(); sat.curve = SAT || (SAT = curve(2049, function (x) { return Math.tanh(1.35 * x) / Math.tanh(1.35); })); sat.oversample = '2x';
      var comp = c.createDynamicsCompressor();
      comp.threshold.value = -17; comp.knee.value = 12; comp.ratio.value = 4; comp.attack.value = 0.004; comp.release.value = 0.22;
      var lim = c.createDynamicsCompressor();
      lim.threshold.value = -4; lim.knee.value = 0; lim.ratio.value = 20; lim.attack.value = 0.001; lim.release.value = 0.08;
      var safe = c.createWaveShaper(); safe.curve = SAFE || (SAFE = curve(4097, function (x) { var a = Math.abs(x), s = x < 0 ? -1 : 1; return a < 0.9 ? x : s * (0.9 + 0.095 * Math.tanh((a - 0.9) / 0.095)); }));
      e.master.connect(hp); hp.connect(ls); ls.connect(lp); lp.connect(sat); sat.connect(comp); comp.connect(lim); lim.connect(safe); safe.connect(c.destination);
    }
    e.duck = c.createGain(); e.duck.connect(e.master);
    e.musicBus = c.createGain(); e.musicBus.connect(e.duck);
    e.sfxBus = c.createGain(); e.sfxBus.connect(e.master);
    // small stereo room for the music (dry stays mono like the console; the tail is wide)
    try {
      var sr = c.sampleRate, L = Math.round(sr * 1.3), ir = c.createBuffer(2, L, sr), R = lcg(77), pre = Math.round(sr * 0.012);
      for (var ch = 0; ch < 2; ch++) {
        var d = ir.getChannelData(ch), lpv = 0;
        for (var i = pre; i < L; i++) { lpv += 0.45 * ((R() * 2 - 1) - lpv); d[i] = lpv * Math.exp(-(i - pre) / sr * 4.6); }
      }
      e.room = c.createConvolver(); e.room.buffer = ir;
      e.roomSend = c.createGain(); e.roomSend.gain.value = 0.12;
      e.musicBus.connect(e.roomSend); e.roomSend.connect(e.room); e.room.connect(e.duck);
    } catch (err) { e.room = null; e.roomSend = null; }
    return e;
  }

  /* ================================================================== primitives */
  // tone: one oscillator voice. o: w f f2 ft lin steps dur v a sus vib vibR
  function tone(e, out, t, o) {
    var c = e.ctx, osc = c.createOscillator(), g = c.createGain(), dur = o.dur, fr = osc.frequency;
    osc.setPeriodicWave(e.waves[o.w || 'p50'] || e.waves.p50);
    fr.setValueAtTime(o.f, t);
    if (o.steps) { for (var i = 0; i < o.steps.length; i++) fr.setValueAtTime(o.steps[i][1], t + o.steps[i][0]); }
    else if (o.f2) {
      if (o.lin) fr.linearRampToValueAtTime(o.f2, t + (o.ft || dur));
      else fr.exponentialRampToValueAtTime(Math.max(1, o.f2), t + (o.ft || dur));
    }
    if (o.vib) {
      var lfo = c.createOscillator(), lg = c.createGain();
      lfo.frequency.value = o.vibR || 8; lg.gain.value = o.vib;
      lfo.connect(lg); lg.connect(osc.detune); lfo.start(t); lfo.stop(t + dur + 0.03);
    }
    var gg = g.gain, v = o.v, a = o.a || 0.002;
    gg.setValueAtTime(0, t);
    gg.linearRampToValueAtTime(v, t + a);
    if (o.sus) gg.setValueAtTime(v, t + a + o.sus * dur);
    gg.exponentialRampToValueAtTime(v * 0.001 + 1e-6, t + dur);
    gg.setValueAtTime(0, t + dur + 0.002);
    osc.connect(g); g.connect(out);
    osc.start(t); osc.stop(t + dur + 0.03);
    return t + dur;
  }
  // arpeggio / note-run helper: freqs played back to back on one voice
  function run(e, out, t, w, freqs, stepT, v, extra) {
    var steps = [];
    for (var i = 1; i < freqs.length; i++) steps.push([i * stepT, freqs[i]]);
    return tone(e, out, t, assign({ w: w, f: freqs[0], steps: steps, dur: freqs.length * stepT + ((extra && extra.tail) || 0), v: v, sus: 0.85 }, extra));
  }
  // noise: LFSR noise voice. o: hz hz2 dur v a sus short filter{type f f2 q} trem{rate depth}
  function noise(e, out, t, o) {
    var c = e.ctx, src = c.createBufferSource(), g = c.createGain(), dur = o.dur, sr = e.sr, buf, base;
    if (o.short) { if (o.hz >= sr / 4) { buf = e.nz.S1; base = sr; } else { buf = e.nz.S4; base = sr / 4; } }
    else if (o.hz >= sr / 8) { buf = e.nz.L1; base = sr; } else { buf = e.nz.L8; base = sr / 8; }
    src.buffer = buf; src.loop = true;
    src.playbackRate.setValueAtTime(o.hz / base, t);
    if (o.hz2) src.playbackRate.exponentialRampToValueAtTime(Math.max(0.001, o.hz2 / base), t + (o.ft || dur));
    var node = src;
    if (o.filter) {
      var f = c.createBiquadFilter(); f.type = o.filter.type || 'bandpass';
      f.frequency.setValueAtTime(o.filter.f, t); f.Q.value = o.filter.q || 1;
      if (o.filter.f2) f.frequency.exponentialRampToValueAtTime(o.filter.f2, t + dur);
      node.connect(f); node = f;
    }
    var gg = g.gain, v = o.v, a = o.a || 0.001;
    gg.setValueAtTime(0, t);
    gg.linearRampToValueAtTime(v, t + a);
    if (o.sus) gg.setValueAtTime(v, t + a + o.sus * dur);
    gg.exponentialRampToValueAtTime(v * 0.001 + 1e-6, t + dur);
    gg.setValueAtTime(0, t + dur + 0.002);
    node.connect(g);
    var last = g;
    if (o.trem) {
      var tg = c.createGain(), lfo = c.createOscillator(), lg = c.createGain(), dpt = o.trem.depth || 0.6;
      tg.gain.value = 1 - dpt / 2; lfo.type = o.trem.type || 'square'; lfo.frequency.value = o.trem.rate;
      lg.gain.value = dpt / 2; lfo.connect(lg); lg.connect(tg.gain); g.connect(tg); last = tg;
      lfo.start(t); lfo.stop(t + dur + 0.03);
    }
    last.connect(out);
    src.start(t, Math.random() * buf.duration); src.stop(t + dur + 0.03);
    return t + dur;
  }
  // samp: DPCM-style sample voice. o: rate rate2 ft v dur(gate) rel a
  function samp(e, out, t, name, o) {
    var c = e.ctx, src = c.createBufferSource(), g = c.createGain(), buf = getSmp(e, name), rate = o.rate || 1;
    src.buffer = buf;
    src.playbackRate.setValueAtTime(rate, t);
    var lo = rate;
    if (o.rate2) { src.playbackRate.exponentialRampToValueAtTime(o.rate2, t + (o.ft || buf.duration / rate)); lo = Math.min(rate, o.rate2); }
    var len = buf.duration / lo, gate = o.dur && o.dur < len ? o.dur : 0, gg = g.gain;
    if (o.a) { gg.setValueAtTime(0, t); gg.linearRampToValueAtTime(o.v, t + o.a); } else gg.setValueAtTime(o.v, t);
    if (gate) gg.setTargetAtTime(0, t + gate, o.rel || 0.012);
    src.connect(g); g.connect(out);
    src.start(t); src.stop(t + (gate ? gate + 0.1 : len + 0.01));
    return { g: g, end: t + (gate ? gate + 0.04 : len) };
  }

  /* ================================================================== instruments */
  var INST = {
    // 2A03 pulses + triangle
    lead:   { w: 'p25', v: 0.15, a: 0.004, d: 0.25, s: 0.65, r: 0.06, gate: 0.92, vib: 14, vibD: 0.2, vibR: 5.5 },
    lead50: { w: 'p50', v: 0.12, a: 0.006, d: 0.3, s: 0.7, r: 0.08, gate: 0.95, vib: 16, vibD: 0.22, vibR: 5 },
    brass:  { w: 'p25', v: 0.16, a: 0.008, d: 0.18, s: 0.75, r: 0.06, gate: 0.9, slide: 1.5, slideT: 0.035, vib: 12, vibD: 0.18, vibR: 6 },
    horn:   { w: 'p50', v: 0.13, a: 0.012, d: 0.2, s: 0.8, r: 0.08, gate: 0.93, slide: 2, slideT: 0.05, vib: 14, vibD: 0.15, vibR: 5 },
    pluck:  { w: 'p25', v: 0.14, a: 0.002, d: 0.18, s: 0.25, r: 0.04, gate: 0.8 },
    thin:   { w: 'p12', v: 0.13, a: 0.003, d: 0.3, s: 0.6, r: 0.05, gate: 0.9 },
    stab:   { w: 'p12', v: 0.085, a: 0.002, d: 0.09, s: 0.25, r: 0.03, gate: 0.85 },
    arp:    { w: 'p12', v: 0.075, a: 0.002, d: 0.12, s: 0.35, r: 0.03, gate: 0.9 },
    pad:    { w: 'p50', v: 0.065, a: 0.08, d: 0.6, s: 0.75, r: 0.2, gate: 0.97 },
    organ:  { w: 'p50', v: 0.11, a: 0.004, d: 0.4, s: 0.85, r: 0.06, gate: 0.96 },
    organ2: { w: 'p25', v: 0.07, a: 0.002, d: 0.2, s: 0.6, r: 0.03, gate: 0.9 },
    bell:   { w: 'p12', v: 0.12, a: 0.001, d: 0.35, s: 0, r: 0.1, gate: 1 },
    bass:   { w: 'tri', v: 0.3, a: 0.003, d: 1, s: 1, r: 0.015, gate: 0.94 },
    bassS:  { w: 'tri', v: 0.3, a: 0.003, d: 1, s: 1, r: 0.015, gate: 0.6 },
    // VRC6-style pulses (8 duty steps)
    vlead:  { w: 'q3', v: 0.13, a: 0.004, d: 0.28, s: 0.7, r: 0.07, gate: 0.93, vib: 13, vibD: 0.2, vibR: 5.5 },
    vbrass: { w: 'q6', v: 0.12, a: 0.008, d: 0.2, s: 0.75, r: 0.06, gate: 0.9, slide: 1.2, slideT: 0.035, vib: 10, vibD: 0.2, vibR: 6 },
    vreed:  { w: 'q2', v: 0.13, a: 0.01, d: 0.3, s: 0.75, r: 0.06, gate: 0.92, vib: 18, vibD: 0.12, vibR: 6, slide: 0.8, slideT: 0.04 },
    vpad:   { w: 'q8', v: 0.06, a: 0.07, d: 0.6, s: 0.8, r: 0.2, gate: 0.97 },
    vstr:   { w: 'q7', v: 0.075, a: 0.09, d: 0.5, s: 0.85, r: 0.2, gate: 0.98, vib: 12, vibD: 0.25, vibR: 5.5, dbl: 9 },
    vstab:  { w: 'q4', v: 0.08, a: 0.002, d: 0.1, s: 0.3, r: 0.03, gate: 0.8 },
    vpluck: { w: 'q2', v: 0.12, a: 0.002, d: 0.16, s: 0.22, r: 0.05, gate: 0.85 },
    vbell:  { w: 'q1', v: 0.14, a: 0.001, d: 0.3, s: 0, r: 0.12, gate: 1 },
    chirp:  { w: 'q1', v: 0.055, a: 0.001, d: 0.05, s: 0.3, r: 0.02, gate: 0.5, slide: 7, slideT: 0.035 },
    // VRC6-style sawtooth
    sawB:   { w: 'saw', v: 0.12, a: 0.003, d: 0.25, s: 0.8, r: 0.025, gate: 0.9 },
    sawS:   { w: 'saw', v: 0.12, a: 0.002, d: 0.12, s: 0.4, r: 0.02, gate: 0.55 },
    sawL:   { w: 'saw', v: 0.105, a: 0.008, d: 0.3, s: 0.75, r: 0.08, gate: 0.94, vib: 14, vibD: 0.18, vibR: 5.5 },
    sawP:   { w: 'saw', v: 0.06, a: 0.09, d: 0.6, s: 0.85, r: 0.22, gate: 0.98 },
    // DPCM-style pitched samples (sb / dm channels). gate >= 1.5 = ring out; choke = next note cuts it
    slap:   { smp: 'slap', v: 0.5, gate: 0.92, choke: 1 },
    timp:   { smp: 'timp', v: 0.5, gate: 2, choke: 1 },
    ostab:  { smp: 'ostab', v: 0.42, gate: 2 },
    whoa:   { smp: 'whoa', v: 0.45, gate: 2 },
    tom:    { smp: 'tomM', v: 0.45, gate: 2 }
  };
  function I(base, o) { return assign({ base: base }, o); }

  function playSmpNote(e, out, t, dur, midi, inst, vel, pl, ch) {
    var def = SMP[inst.smp]; if (!def) return;
    var rate = def.root ? mtof(midi) / def.root : 1, key = ch || 'sb';
    if (pl && inst.choke) { var prev = pl.smpLast[key]; if (prev && prev.end > t) { try { prev.g.gain.setTargetAtTime(0, t, 0.006); } catch (err) { /* ignore */ } } }
    var v = samp(e, out, t, inst.smp, { rate: rate, v: inst.v * vel, dur: (inst.gate || 1) < 1.5 ? dur * inst.gate : 0 });
    if (pl) pl.smpLast[key] = v;
  }

  function playNote(e, out, t, dur, midi, inst, arp, vel, stepDur, isEcho, pl, ch) {
    if (inst.smp) return playSmpNote(e, out, t, dur, midi, inst, vel, pl, ch);
    var c = e.ctx, f = mtof(midi), g = c.createGain(), nO = inst.dbl ? 2 : 1, oscs = [];
    var r = inst.r || 0.03, off = t + Math.max(inst.a + 0.01, dur * (inst.gate || 0.92)), end = off + r * 3 + 0.02;
    for (var k = 0; k < nO; k++) {
      var osc = c.createOscillator(), fr = osc.frequency;
      osc.setPeriodicWave(e.waves[inst.w] || e.waves.p50);
      if (k) osc.detune.value = inst.dbl;
      if (arp) {
        var at = inst.arpT || 1 / 60, j = 0;
        for (var tt = t; tt < end; tt += at, j++) fr.setValueAtTime(f * Math.pow(2, arp[j % arp.length] / 12), tt);
      } else if (inst.slide) {
        fr.setValueAtTime(f * Math.pow(2, -inst.slide / 12), t);
        fr.exponentialRampToValueAtTime(f, t + inst.slideT);
      } else fr.setValueAtTime(f, t);
      osc.connect(g); osc.start(t); osc.stop(end); oscs.push(osc);
    }
    if (inst.vib && dur > inst.vibD + 0.08) {
      var lfo = c.createOscillator(), lg = c.createGain();
      lfo.frequency.value = inst.vibR || 5;
      lg.gain.setValueAtTime(0, t); lg.gain.setValueAtTime(0, t + inst.vibD);
      lg.gain.linearRampToValueAtTime(inst.vib, t + inst.vibD + 0.15);
      lfo.connect(lg); oscs.forEach(function (o) { lg.connect(o.detune); }); lfo.start(t); lfo.stop(end);
    }
    var pk = inst.v * vel * (nO > 1 ? 0.62 : 1), gg = g.gain;
    gg.setValueAtTime(0, t);
    gg.linearRampToValueAtTime(pk, t + inst.a);
    if (inst.s < 1) gg.setTargetAtTime(pk * inst.s, t + inst.a, inst.d / 3);
    gg.setTargetAtTime(0, off, r / 3);
    g.connect(out);
    if (inst.echo && !isEcho) playNote(e, out, t + inst.echo.steps * stepDur, dur, midi, inst, arp, vel * inst.echo.v, stepDur, true, pl, ch);
  }

  /* ================================================================== drum kits */
  // noise channel kit (2A03 noise + triangle thumps), any channel may use it
  var KIT = {
    k: function (e, o, t, v) { tone(e, o, t, { w: 'tri', f: 170, f2: 48, ft: 0.09, dur: 0.13, v: 0.55 * v }); noise(e, o, t, { hz: 3000, dur: 0.025, v: 0.12 * v }); },
    K: function (e, o, t, v) { tone(e, o, t, { w: 'tri', f: 130, f2: 38, ft: 0.16, dur: 0.24, v: 0.62 * v }); noise(e, o, t, { hz: 1800, hz2: 600, dur: 0.12, v: 0.26 * v }); },
    s: function (e, o, t, v) { noise(e, o, t, { hz: 13000, hz2: 7000, dur: 0.13, v: 0.22 * v }); tone(e, o, t, { w: 'tri', f: 240, f2: 150, dur: 0.06, v: 0.22 * v }); },
    S: function (e, o, t, v) { noise(e, o, t, { hz: 11000, hz2: 4000, dur: 0.28, v: 0.3 * v }); tone(e, o, t, { w: 'tri', f: 200, f2: 110, dur: 0.09, v: 0.3 * v }); },
    r: function (e, o, t, v) { noise(e, o, t, { hz: 16000, dur: 0.05, v: 0.11 * v }); },
    h: function (e, o, t, v) { noise(e, o, t, { hz: 42000, dur: 0.03, v: 0.06 * v }); },
    o: function (e, o, t, v) { noise(e, o, t, { hz: 40000, dur: 0.16, v: 0.06 * v }); },
    c: function (e, o, t, v) { noise(e, o, t, { hz: 32000, hz2: 18000, dur: 0.9, v: 0.15 * v }); },
    t: function (e, o, t, v) { tone(e, o, t, { w: 'tri', f: 230, f2: 115, dur: 0.13, v: 0.45 * v }); noise(e, o, t, { hz: 4000, dur: 0.02, v: 0.06 * v }); },
    T: function (e, o, t, v) { tone(e, o, t, { w: 'tri', f: 150, f2: 72, dur: 0.17, v: 0.5 * v }); noise(e, o, t, { hz: 3000, dur: 0.025, v: 0.07 * v }); },
    m: function (e, o, t, v) { noise(e, o, t, { hz: 24000, dur: 0.035, v: 0.06 * v, short: true }); },
    g: function (e, o, t, v) { noise(e, o, t, { hz: 7000, hz2: 3000, dur: 0.07, v: 0.1 * v }); },
    w: function (e, o, t, v) { noise(e, o, t, { hz: 2600, hz2: 1200, dur: 2.6, v: 0.05 * v, a: 0.9, filter: { type: 'bandpass', f: 600, f2: 1400, q: 0.7 } }); },
    e: function (e, o, t, v) { noise(e, o, t, { hz: 11000, dur: 0.04, v: 0.065 * v, short: true }); },
    v: function (e, o, t, v) { noise(e, o, t, { hz: 2500, hz2: 15000, dur: 0.55, v: 0.1 * v, a: 0.42, short: true }); },
    z: function (e, o, t, v) { for (var i = 0; i < 3; i++) noise(e, o, t + i * 0.042, { hz: 14000 - i * 900, hz2: 8000, dur: 0.045, v: (0.1 + i * 0.025) * v }); },
    // tambourine jingle
    j: function (e, o, t, v) { noise(e, o, t, { hz: 38000, dur: 0.11, v: 0.07 * v, trem: { rate: 55, depth: 0.8 }, filter: { type: 'highpass', f: 5000 } }); },
    // noise clap
    C: function (e, o, t, v) { for (var i = 0; i < 3; i++) noise(e, o, t + i * 0.01, { hz: 16000, dur: i < 2 ? 0.012 : 0.12, v: 0.13 * v, filter: { type: 'bandpass', f: 1300, q: 0.8 } }); }
  };
  // sample kit (dm / sb channels)
  function sk(name, v, rate) { return function (e, o, t, vel) { samp(e, o, t, name, { v: v * vel, rate: rate || 1 }); }; }
  var DKIT = {
    k: sk('kick', 0.52), s: sk('snare', 0.42), c: sk('clap', 0.4), t: sk('tomH', 0.44), u: sk('tomM', 0.46), T: sk('tomL', 0.5),
    K: function (e, o, t, v) { samp(e, o, t, 'kick', { v: 0.62 * v, rate: 0.92 }); noise(e, o, t, { hz: 1800, hz2: 500, dur: 0.12, v: 0.16 * v }); },
    S: function (e, o, t, v) { samp(e, o, t, 'snare', { v: 0.5 * v }); noise(e, o, t, { hz: 11000, hz2: 4000, dur: 0.24, v: 0.13 * v }); },
    x: sk('ostab', 0.42), w: sk('whoa', 0.45), y: sk('cheer', 0.5), b: sk('boo', 0.5), l: sk('laugh', 0.5), j: sk('timp', 0.52), q: sk('shriek', 0.36)
  };

  /* ================================================================== tracker */
  // Pattern syntax (one token = one step unless ':n' given):
  //   C4  F#3  Bb5      note            C4:4   note lasting 4 steps
  //   C4+47             arpeggio offsets (hex semitones, 0 implied), e.g. +37a = minor 7th
  //   .   .:8           rest            -  -:3   hold previous note longer
  //   k s h ...         drum (kit of the channel)  k&c  two drums at once
  //   trailing ! accent, ? ghost        @inst  switch instrument        |  bar line (checked)
  //   [ ... ]n          repeat group n times
  // Song keys: bpm spb bar loop loopFrom seq parts inst insts mix gain room swing swingUnit accel accelMax
  // Part keys: one string per channel, plus vel (part velocity).
  var CHANS = ['p1', 'p2', 'tr', 'nz', 'v1', 'v2', 'sw', 'dm', 'sb'];
  var DEF_INST = { p1: 'lead', p2: 'stab', tr: 'bass', nz: null, v1: 'vlead', v2: 'vpad', sw: 'sawB', dm: 'slap', sb: 'slap' };
  var SMP_CH = { dm: 1, sb: 1 };

  function R(s, n) { var a = []; for (var i = 0; i < n; i++) a.push(s); return a.join(' '); }
  function B() { return Array.prototype.slice.call(arguments).join(' | '); }
  function RB(s, n) { var a = []; for (var i = 0; i < n; i++) a.push(s); return a.join(' | '); } // repeat whole bars

  function resolveInst(def, x) {
    if (!x) return null;
    if (typeof x === 'object') { var b = resolveInst(def, x.base) || INST.lead; var o = assign({}, b, x); delete o.base; return o; }
    if (def.insts && def.insts[x]) return resolveInst(def, def.insts[x]);
    return INST[x] || INST.lead;
  }

  function parseChannel(def, str, inst, barLen, warn, kit) {
    var s = str, re = /\[([^\[\]]*)\](\d+)/;
    while (re.test(s)) s = s.replace(re, function (_, body, n) { return R(body, +n); });
    var toks = s.split(/\s+/).filter(Boolean), evs = [], pos = 0, last = null, barStart = 0, barIdx = 0, bars = false;
    for (var i = 0; i < toks.length; i++) {
      var tok = toks[i];
      if (tok === '|') {
        bars = true;
        if (pos - barStart !== barLen) warn('bar ' + (barIdx + 1) + ' has ' + (pos - barStart) + ' steps');
        barStart = pos; barIdx++; continue;
      }
      if (tok[0] === '@') { inst = resolveInst(def, tok.slice(1)); continue; }
      var m = /^(.+?)(?::(\d+))?$/.exec(tok), body = m[1], len = m[2] ? +m[2] : 1, vel = 1;
      var tail = body.charAt(body.length - 1);
      if (tail === '!' && body.length > 1) { vel = 1.35; body = body.slice(0, -1); }
      else if (tail === '?' && body.length > 1) { vel = 0.5; body = body.slice(0, -1); }
      if (body === '.') { last = null; pos += len; continue; }
      if (body === '-') { if (last) last.d += len; pos += len; continue; }
      var ev = { s: pos, d: len, inst: inst, vel: vel };
      var nmx = /^([A-G][#b]?-?\d)(?:\+([0-9a-f]+))?$/.exec(body);
      if (nmx) {
        ev.m = noteNum(nmx[1]);
        if (nmx[2]) ev.arp = [0].concat(nmx[2].split('').map(function (h) { return parseInt(h, 16); }));
        if (!inst) { warn('note without instrument ' + tok); pos += len; continue; }
      } else {
        var ds = body.split('&'), ok = ds.every(function (x) { return kit[x]; });
        if (!ok) { warn('bad token ' + tok); pos += len; continue; }
        ev.drum = ds;
      }
      evs.push(ev); last = ev; pos += len;
    }
    if (bars && pos - barStart !== barLen) warn('last bar has ' + (pos - barStart) + ' steps');
    return { evs: evs, len: pos };
  }

  function compileSong(name, def) {
    var bar = def.bar || 16, warns = [], parts = {}, mix = def.mix || {};
    Object.keys(def.parts).forEach(function (pn) {
      var p = def.parts[pn], chans = {}, plen = 0, pv = p.vel || 1;
      CHANS.forEach(function (ch) {
        if (!p[ch]) return;
        var inst = resolveInst(def, (def.inst && def.inst[ch]) || DEF_INST[ch]);
        chans[ch] = parseChannel(def, p[ch], inst, bar, function (msg) { warns.push(name + '.' + pn + '.' + ch + ': ' + msg); }, SMP_CH[ch] ? DKIT : KIT);
        plen = Math.max(plen, chans[ch].len);
      });
      var evs = [];
      Object.keys(chans).forEach(function (ch) {
        var cdat = chans[ch], cv = pv * (mix[ch] != null ? mix[ch] : 1);
        if (!cdat.len) return;
        if (plen % cdat.len) warns.push(name + '.' + pn + '.' + ch + ': length ' + cdat.len + ' does not divide part length ' + plen);
        for (var off = 0; off < plen; off += cdat.len) {
          cdat.evs.forEach(function (ev) { if (ev.s + off < plen) evs.push(assign({}, ev, { s: ev.s + off, ch: ch, vel: ev.vel * cv })); });
        }
      });
      if (plen % bar) warns.push(name + '.' + pn + ': part length ' + plen + ' not whole bars');
      parts[pn] = { evs: evs, len: plen };
    });
    var all = [], pos = 0, loopFrom = def.loopFrom || 0, introSteps = 0;
    def.seq.forEach(function (entry, i) {
      if (i === loopFrom) introSteps = pos;
      var mm = /^([A-Za-z0-9_]+?)([+-]\d+)?$/.exec(entry), part = mm && parts[mm[1]];
      if (!part) { warns.push(name + ': unknown part ' + entry); return; }
      var tr = mm[2] ? +mm[2] : 0;
      part.evs.forEach(function (ev) {
        var e2 = assign({}, ev, { s: ev.s + pos });
        if (tr && e2.m != null) e2.m += tr;
        all.push(e2);
      });
      pos += part.len;
    });
    all.sort(function (a, b) { return a.s - b.s; });
    var firstLoop = -1;
    for (var i = 0; i < all.length; i++) if (all[i].s >= introSteps) { firstLoop = i; break; }
    var stepDur = 60 / def.bpm / (def.spb || 4);
    return {
      name: name, evs: all, introSteps: introSteps, totalSteps: pos, loopSteps: pos - introSteps,
      loop: def.loop !== false, stepDur: stepDur, firstLoop: firstLoop, warns: warns,
      gain: def.gain || 1, room: def.room != null ? def.room : 0.12, swing: def.swing || 0, swingUnit: def.swingUnit || 2,
      accel: def.accel || 1, accelMax: def.accelMax || 1, bar: bar,
      introSec: introSteps * stepDur, loopSec: (pos - introSteps) * stepDur, totalSec: pos * stepDur
    };
  }

  function playEvent(e, out, ev, t, stepDur, pl) {
    if (ev.drum) {
      var kit = SMP_CH[ev.ch] ? DKIT : KIT;
      for (var i = 0; i < ev.drum.length; i++) kit[ev.drum[i]](e, out, t, ev.vel);
    } else playNote(e, out, t, ev.d * stepDur, ev.m, ev.inst, ev.arp, ev.vel, stepDur, false, pl, ev.ch);
  }

  // Player: schedules a compiled song into `out` (through its own song-gain node) from t0.
  function Player(e, song, out, t0) {
    this.e = e; this.song = song; this.t0 = t0; this.i = 0; this.iter = 0; this.done = false; this.smpLast = {};
    this.sd = song.stepDur; this.loopT0 = t0 + song.introSteps * song.stepDur;
    this.sg = e.ctx.createGain(); this.sg.gain.value = song.gain; this.sg.connect(out); this.out = this.sg;
  }
  Player.prototype.timeOf = function (ev) {
    var S = this.song, sd, t;
    if (ev.s < S.introSteps) { sd = S.stepDur; t = this.t0 + ev.s * sd; }
    else { sd = this.sd; t = this.loopT0 + (ev.s - S.introSteps) * sd; }
    if (S.swing) { var u = S.swingUnit; if (Math.floor(ev.s / u) % 2 === 1) t += S.swing * u * sd; }
    return t;
  };
  Player.prototype.pump = function (until, now) {
    var S = this.song, evs = S.evs;
    while (!this.done) {
      if (this.i >= evs.length) {
        if (!S.loop || S.firstLoop < 0 || S.loopSteps <= 0) { this.done = true; break; }
        this.iter++; this.i = S.firstLoop;
        this.loopT0 += S.loopSteps * this.sd;
        if (S.accel > 1) this.sd = Math.max(S.stepDur / S.accelMax, this.sd / S.accel);
      }
      var ev = evs[this.i], t = this.timeOf(ev);
      if (t >= until) break;
      if (now == null || t >= now - 0.02) playEvent(this.e, this.out, ev, t, ev.s < S.introSteps ? S.stepDur : this.sd, this);
      this.i++;
    }
  };

  /* ================================================================== composition helpers */
  function T(s, k) { // transpose every note name in a pattern string
    return s.replace(/(^|\s)([A-G][#b]?-?\d)/g, function (_, sp, n) { return sp + nm(noteNum(n) + k); });
  }
  var CQ = { '': [0, 4, 7], m: [0, 3, 7], '7': [0, 4, 7, 10], m7: [0, 3, 7, 10], maj7: [0, 4, 7, 11], dim: [0, 3, 6], dim7: [0, 3, 6, 9],
    aug: [0, 4, 8], sus4: [0, 5, 7], sus2: [0, 2, 7], '6': [0, 4, 7, 9], m6: [0, 3, 7, 9], '5': [0, 7], m7b5: [0, 3, 6, 10], '9': [0, 4, 7, 10, 14], m9: [0, 3, 7, 10, 14] };
  function chord(sym) {
    var m = /^([A-G])([#b]?)(.*)$/.exec(sym) || [0, 'C', '', ''], q = CQ[m[3]] || CQ[''];
    return { pc: (PC[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) + 12) % 12, q: q };
  }
  // chord slots for patterns: 0 root, 1 third, 2 fifth, 3 octave, 4 third+8, 5 fifth+8, 6 seventh (or octave), 7 root-8, 8 fifth-8, 9 root+16
  function CV(sym, oct) {
    var c = chord(sym), r = 12 * (oct + 1) + c.pc, q = c.q, f = q.length > 2 ? q[2] : 12;
    return [r, r + q[1], r + f, r + 12, r + q[1] + 12, r + f + 12, r + (q.length > 3 ? q[3] : 12), r - 12, r + f - 12, r + 24];
  }
  function AT(sym, oct) { var c = chord(sym); return nm(12 * (oct + 1) + c.pc) + '+' + c.q.slice(1, 4).map(function (x) { return x.toString(16); }).join(''); }
  function units(pat) {
    var u = [];
    for (var i = 0; i < pat.length; i++) {
      var ch = pat.charAt(i);
      if (ch === ' ' || ch === '|') continue;
      if ((ch === '!' || ch === '?') && u.length) { u[u.length - 1] += ch; continue; }
      u.push(ch);
    }
    return u;
  }
  // one bar of a chord-relative step pattern: digits = chord slots, x = arpeggiated chord, . rest, - hold
  function P(pat, sym, oct) {
    var ns = CV(sym, oct);
    return units(pat).map(function (x) {
      var c = x.charAt(0), mod = x.slice(1);
      if (c === '.' || c === '-') return c;
      if (c === 'x') return AT(sym, oct) + mod;
      if (c >= '0' && c <= '9') return nm(ns[+c]) + mod;
      return x;
    }).join(' ');
  }
  // one bar per chord entry; an entry 'Gm A' splits its bar evenly between the chords
  function CP(pat, chords, oct) {
    return chords.map(function (entry) {
      var parts = entry.split(' ');
      if (parts.length === 1) return P(pat, entry, oct);
      var u = units(pat), n = u.length / parts.length;
      return parts.map(function (sym, i) { return P(u.slice(i * n, (i + 1) * n).join(''), sym, oct); }).join(' ');
    }).join(' | ');
  }
  // drum step pattern: one char per step (kit letters), . rest, optional alias map for combos
  function Dr(pat, map) { return units(pat).map(function (x) { var c = x.charAt(0); return c === '.' ? '.' : ((map && map[c]) || c) + x.slice(1); }).join(' '); }
  // chord-aware harmony: each melody note gets the nearest chord tone at least `gap` semitones below
  function HC(mel, chords, bar, gap) {
    gap = gap || 3; var pos = 0, out = [];
    mel.split(/\s+/).forEach(function (tok) {
      if (!tok) return;
      if (tok === '|' || tok.charAt(0) === '@') { out.push(tok); return; }
      var m = /^(.+?)(?::(\d+))?$/.exec(tok), body = m[1], len = m[2] ? +m[2] : 1, nx = /^([A-G][#b]?-?\d)(.*)$/.exec(body);
      if (nx) {
        var mid = noteNum(nx[1]), entry = chords[Math.min(chords.length - 1, Math.floor(pos / bar))], ps = entry.split(' ');
        var c = chord(ps[Math.min(ps.length - 1, Math.floor((pos % bar) / (bar / ps.length)))]), pcs = c.q.map(function (q) { return (q + c.pc) % 12; });
        var h = mid - gap; while (h > mid - 13 && pcs.indexOf(((h % 12) + 12) % 12) < 0) h--;
        out.push(nm(h) + nx[2] + (m[2] ? ':' + m[2] : ''));
      } else out.push(tok);
      pos += len;
    });
    return out.join(' ');
  }
  function bars(n, s) { return RB(s || '.:16', n); }

  /* ================================================================== songs (all original) */
  var SONGS = {};
  function song(name, fn) { try { SONGS[name] = fn(); } catch (err) { try { console.error('[audio] song ' + name + ': ' + err.message); } catch (e2) { /* ignore */ } } }

  // The "Doomsday" motif (title, intro, credits, ending): D A D F, a step down and a turn.
  // TITLE - big late-NES title: orchestra hits, then the theme at full band, D minor
  song('title', function () {
    var chA = ['Dm', 'Bb', 'F', 'C', 'Dm', 'Bb', 'Gm A', 'Dm'], chB = ['Bb', 'C', 'Am', 'Dm', 'Gm', 'C', 'F', 'A7'];
    var mA = 'D5:3 A4 D5:2 F5:4 E5:2 D5:2 C5:2 | D5:6 A4:2 Bb4:4 C5:4 | F5:3 C5 F5:2 A5:4 G5:2 F5:2 E5:2 | G5:8 E5:4 C5:4 | ' +
             'D5:3 A4 D5:2 F5:4 E5:2 F5:2 G5:2 | A5:4 Bb5:4 A5:2 G5:2 F5:2 D5:2 | G5:3 F5 E5:2 D5:2 E5:4 C#5:4 | D5:12 .:2 A4:2';
    var mB = 'F5:4 D5:2 F5:2 Bb5:6 A5:2 | G5:4 E5:2 G5:2 C6:6 Bb5:2 | A5:3 G5 E5:2 C5:2 E5:4 A5:4 | F5:6 E5:2 D5:4 A4:4 | ' +
             'Bb4:2 D5:2 G5:2 Bb5:4 A5:2 G5:2 F5:2 | E5:2 G5:2 C6:2 E6:4 D6:2 C6:2 Bb5:2 | A5:4 C6:4 F6:6 E6:2 | E6:4 C#6:4 A5:2 G5:2 E5:2 C#5:2';
    var dr = Dr('k...s..kk.k.s...'), fill = Dr('k.s.s.kss.s.sss!s!'), hat = Dr('h.hhh.o.h.hhh.o.');
    return {
      bpm: 150, loopFrom: 1, room: 0.14,
      inst: { p1: 'lead', p2: 'arp', tr: 'bass', v1: 'vlead', v2: 'vpad', sw: 'sawP', sb: 'ostab' },
      parts: {
        I: {
          p1: 'D5:3 D5:3 D5:2 .:4 A4:4 | F5:3 F5:3 F5:2 A5:4 C#5:4', v1: 'D4:3 D4:3 D4:2 .:4 A3:4 | F4:3 F4:3 F4:2 A4:4 E4:4',
          sw: '@sawB D3:3 D3:3 D3:2 .:4 A2:4 | F3:3 F3:3 F3:2 A3:4 A2:4', tr: 'D2:3 D2:3 D2:2 .:4 A1:4 | F2:3 F2:3 F2:2 A2:4 A1:4',
          sb: 'D4:3 D4:3 D4:2 .:4 A3:4 | F4:3 F4:3 F4:2 @whoa A3:4 .:4', v2: 'A4:16 | C5:8 E5:8',
          dm: Dr('K..K..K.....K...') + ' | ' + Dr('K..K..K.T.T.ttt!t!'), nz: Dr('c..c..c.....c...') + ' | ' + Dr('c..c..c.........')
        },
        A: {
          p1: mA, v1: T(mA, -12), p2: CP('0123432101234321', chA, 4), v2: CP('1---------------', chA, 4),
          tr: CP('0-3-0-3-0-3-0-3-', chA, 2), sw: CP('0-------2-------', chA, 3), dm: B(RB(dr, 7), fill), nz: hat,
          sb: 'D4:4 .:12 | .:16 | F4:4 .:12 | .:16 | D4:4 .:12 | .:16 | .:16 | .:8 A3:2 .:2 A3:4'
        },
        B: {
          p1: mB, v1: HC(mB, chB, 16), p2: CP('0123432101234321', chB, 4), v2: CP('2---------------', chB, 4),
          tr: CP('0-3-0-3-0-3-0-3-', chB, 2), sw: CP('0-------2-------', chB, 3), dm: B(RB(dr, 3), fill, RB(dr, 3), fill), nz: hat,
          sb: 'Bb3:4 .:12 | C4:4 .:12 | A3:4 .:12 | D4:4 .:12 | G3:4 .:12 | C4:4 .:12 | F4:4 .:12 | A3:2 .:2 A3:2 .:2 @whoa A3:8'
        },
        A2: {
          p1: mA, v1: HC(mA, chA, 16), p2: CP('3210321032103210', chA, 4), v2: CP('1---------------', chA, 4),
          tr: CP('0-3-0-3-0-3-0-3-', chA, 2), sw: '@sawB ' + CP('0-0-3-0-0-0-3-0-', chA, 2), dm: B(RB(dr, 7), fill), nz: hat,
          sb: 'D4:4 .:12 | Bb3:4 .:12 | F4:4 .:12 | C4:4 .:12 | D4:4 .:12 | Bb3:4 .:12 | G3:4 .:4 A3:4 .:4 | D4:2 .:2 D4:2 .:2 D4:4 .:4'
        }
      },
      seq: ['I', 'A', 'B', 'A2']
    };
  });

  // INTRO - story crawl: the 8-day clock starts ticking; the motif rises out of timpani and drones
  song('intro', function () {
    var chA = ['Dm', 'Dm', 'Bb', 'Bb', 'Gm', 'Gm', 'A', 'A'], chB = ['Dm', 'F', 'Bb', 'C', 'Gm', 'Bb', 'A', 'A'];
    var mA = '.:16 | .:16 | D5:6 A4:2 D5:4 F5:4 | E5:8 D5:4 C5:4 | D5:12 Bb4:4 | G4:16 | A4:8 C#5:4 E5:4 | A5:16';
    var mB = 'D5:6 A4:2 D5:4 F5:4 | A5:8 G5:4 F5:4 | F5:6 E5:2 D5:4 F5:4 | G5:12 E5:4 | D5:6 Bb4:2 D5:4 G5:4 | F5:8 E5:4 D5:4 | E5:6 F5:2 E5:4 C#5:4 | A4:16';
    var tick = Dr('m...e...m...e...');
    return {
      bpm: 90, room: 0.22,
      inst: { p1: I('lead50', { vib: 20, echo: { steps: 3, v: 0.3 } }), p2: 'arp', tr: 'bass', v1: 'vlead', v2: 'vpad', sw: 'sawP', sb: 'timp' },
      parts: {
        A: {
          p1: mA, p2: CP('0-1-2-3-2-1-2-1-', chA, 4), v2: CP('1---------------', chA, 4), tr: CP('0---------------', chA, 2),
          sw: CP('0---------------', chA, 3), nz: tick,
          sb: 'D2:16 | .:16 | Bb1:16 | .:16 | G1:16 | .:16 | A1:2 A1:2 A1:2 A1:2 A1 A1 A1 A1 A1 A1 A1 A1 | A1:16',
          dm: bars(6) + ' | ' + Dr('k...k...k...k...') + ' | ' + Dr('kkkksssssssssS..')
        },
        B: {
          p1: mB, v1: T(mB, -12), p2: CP('0-1-2-3-2-1-2-1-', chB, 4), v2: CP('1---------------', chB, 4), tr: CP('0-0-0-0-0-0-0-0-', chB, 2),
          sw: CP('0-------2-------', chB, 3), nz: B(Dr('c...e...m...e...'), RB(tick, 7)),
          sb: 'D2:16 | F2:16 | Bb1:16 | C2:16 | G1:16 | Bb1:16 | A1:16 | A1 A1 A1 A1 A1 A1 A1 A1 A1 A1 A1 A1 A1! A1! A1! A1!',
          dm: B(RB(Dr('k.......s.......'), 3), Dr('k.....k.s...s.ss'), RB(Dr('k.......s.......'), 3), Dr('k.k.s.k.ssssS...'))
        }
      },
      seq: ['A', 'B']
    };
  });

  // VILLAGE - Renaissance-fair jig under a red sun (6/8, D dorian): recorder, lute, crumhorn, bagpipe drones, tabor
  song('village', function () {
    var chA = ['Dm', 'C', 'Dm', 'Am', 'Dm', 'C', 'G Am', 'Dm'], chB = ['F', 'C', 'G', 'Dm', 'F', 'C', 'Am', 'Dm'], chC = ['Dm', 'C', 'F', 'Dm'];
    var mA = 'A4:2 D5:2 E5:2 F5:2 E5:2 D5:2 | E5:2 G5:2 E5:2 C5:4 D5:2 | F5:2 E5:2 D5:2 A5:4 F5:2 | E5:6 C5:2 B4:2 A4:2 | ' +
             'A4:2 D5:2 E5:2 F5:2 G5:2 A5:2 | G5:2 E5:2 C5:2 G5:4 E5:2 | D5:2 B4:2 G4:2 A4:2 C5:2 E5:2 | D5:6 .:2 F4:2 G4:2';
    var mA2 = 'A4:2 D5:2 E5:2 F5 G5 F5:2 E5 D5 | E5:2 G5:2 E5:2 C5:4 D5:2 | F5:2 E5:2 D5:2 A5 B5 A5:2 F5:2 | E5:6 C5:2 B4:2 A4:2 | ' +
              'A4:2 D5:2 E5:2 F5:2 G5:2 A5:2 | G5:2 E5:2 C5:2 G5 A5 G5:2 E5:2 | D5:2 B4:2 G4:2 A4:2 C5:2 E5:2 | D5:6 .:2 F4:2 G4:2';
    var mB = 'C6:2 A5:2 F5:2 C6:4 A5:2 | G5:2 A5:2 G5:2 E5:2 D5:2 C5:2 | B4:2 D5:2 G5:2 B5:4 A5:2 | A5:6 F5:2 E5:2 D5:2 | ' +
             'C6:2 D6:2 C6:2 A5:2 G5:2 F5:2 | E5:2 G5:2 C6:2 E6:4 D6:2 | C6:2 B5:2 A5:2 E5:2 D5:2 C5:2 | D5:6 .:2 F4:2 G4:2';
    var mC = 'D6:2 C6:2 A5:2 D6:6 | C6:2 A5:2 G5:2 C6:6 | A5:2 G5:2 F5:2 E5:2 D5:2 C5:2 | D5:6 .:2 F4:2 G4:2';
    var tab = Dr('T...t.T...tt'), tabF = Dr('T.tT.tT.tttt'), tam = Dr('j..h..j..h.h');
    var lute = function (ch) { return CP('0-1-2-3-2-1-', ch, 4); }, jig = function (ch) { return CP('0---2-0---2-', ch, 2); };
    return {
      bpm: 104, spb: 6, bar: 12, room: 0.16,
      inst: { p1: I('lead50', { v: 0.125, vib: 16, vibD: 0.15, vibR: 5.5 }), p2: I('pluck', { v: 0.12 }), tr: 'bass', v1: I('vreed', { v: 0.1 }),
        v2: I('vpad', { v: 0.045 }), sw: I('sawP', { v: 0.04, a: 0.2 }) },
      parts: {
        A: { p1: mA, v1: T(mA, -12), p2: lute(chA), tr: jig(chA), v2: RB('A3:12', 8), sw: RB('D3:12', 8), dm: B(RB(tab, 7), tabF), nz: tam },
        B: { p1: mB, v1: T(mB, -12), p2: lute(chB), tr: jig(chB), v2: RB('A3:12', 8), sw: RB('D3:12', 8), dm: B(RB(tab, 3), tabF, RB(tab, 3), tabF), nz: tam },
        A2: { p1: mA2, v1: HC(mA, chA, 12), p2: lute(chA), tr: jig(chA), v2: RB('A3:12', 8), sw: RB('D3:12', 8), dm: B(RB(tab, 7), tabF), nz: tam },
        B2: { p1: mB, v1: HC(mB, chB, 12), p2: lute(chB), tr: jig(chB), v2: RB('A3:12', 8), sw: RB('D3:12', 8), dm: B(RB(tab, 3), tabF, RB(tab, 3), tabF), nz: tam },
        C: { p1: mC, p2: lute(chC), tr: jig(chC), v2: RB('A3:12', 4), sw: RB('D3:12', 4), dm: B(tabF, tab, tabF, Dr('T.tT.tTTttt!t!')), nz: Dr('j.jj.jj.jj.j') }
      },
      seq: ['A', 'B', 'A2', 'B2', 'C']
    };
  });

  // VILLAGE NIGHT - the same streets after dark: the jig slowed into a music-box nocturne, D minor, crickets
  song('village_night', function () {
    var chA = ['Dm', 'C', 'Dm', 'Am', 'Bb', 'Gm', 'A7', 'Dm'], chB = ['Gm', 'Dm', 'Bb', 'A', 'Gm', 'Dm', 'Eb', 'A7'];
    var mA = 'A4:2 D5:2 E5:2 F5:6 | E5:2 G5:2 E5:2 C5:6 | F5:2 E5:2 D5:2 A5:6 | E5:12 | D5:2 F5:2 Bb5:2 A5:6 | G5:2 F5:2 D5:2 Bb4:6 | C#5:2 E5:2 G5:2 F5:4 E5:2 | D5:12';
    var mB = 'D5:6 Bb4:6 | A4:6 F4:6 | F5:4 E5:2 D5:6 | C#5:12 | G5:6 Bb5:6 | A5:4 G5:2 F5:6 | G5:4 F5:2 Eb5:6 | E5:6 C#5:6';
    var crk = B(Dr('..mmm.......'), Dr('.......mmm..'));
    return {
      bpm: 64, spb: 6, bar: 12, room: 0.28,
      inst: { p1: I('thin', { v: 0.07 }), p2: I('arp', { v: 0.06, echo: { steps: 3, v: 0.35 } }), tr: 'bass', v1: I('vbell', { echo: { steps: 3, v: 0.35 } }),
        v2: I('vpad', { v: 0.05 }), sw: I('sawP', { v: 0.035 }), sb: I('timp', { v: 0.32 }) },
      parts: {
        A: { v1: mA, p2: CP('0-2-1-3-2-1-', chA, 4), v2: CP('1-----------', chA, 4), tr: CP('0-----2-----', chA, 2), sw: RB('D3:12', 8),
          dm: Dr('k?.k?.........'), nz: crk, sb: 'D2:12 | .:12 | .:12 | .:12 | Bb1:12 | .:12 | A1:12 | .:12' },
        B: { v1: mB, p2: CP('0-2-1-3-2-1-', chB, 4), v2: CP('1-----------', chB, 4), tr: CP('0-----2-----', chB, 2), sw: RB('D3:12', 8),
          dm: Dr('k?.k?.........'), nz: B(Dr('w...........'), Dr('.......mmm..'), Dr('..mmm.......'), Dr('.......mmm..')), sb: 'G1:12 | .:12 | .:12 | A1:12 | G1:12 | .:12 | Eb2:12 | A1:12' },
        A2: { v1: mA, p1: T(mA, 12), p2: CP('0-2-1-3-2-1-', chA, 4), v2: CP('1-----------', chA, 4), tr: CP('0-----2-----', chA, 2), sw: RB('D3:12', 8),
          dm: Dr('k?.k?.........'), nz: crk, sb: 'D2:12 | .:12 | .:12 | .:12 | Bb1:12 | .:12 | A1:12 | .:12' }
      },
      seq: ['A', 'B', 'A2', 'B']
    };
  });

  // RUINS - moss, fog and mobs: driving exploration theme, E minor, DPCM slap bass, saw lead in the bridge
  song('ruins', function () {
    var chA = ['Em', 'Em', 'C', 'D', 'Em', 'Em', 'Am', 'B7'], chB = ['C', 'D', 'Bm', 'Em', 'C', 'D', 'B', 'B7'];
    var mA = 'E5:2 .:1 E5:1 G5:2 B5:4 A5:2 G5:2 F#5:2 | G5:3 F#5:1 E5:4 B4:8 | C5:2 .:1 C5:1 E5:2 G5:4 F#5:2 E5:2 D5:2 | F#5:3 E5:1 D5:4 A4:8 | ' +
             'E5:2 .:1 E5:1 G5:2 B5:4 C6:2 B5:2 A5:2 | B5:3 G5:1 E5:4 G5:4 B5:4 | C6:3 B5:1 A5:2 E5:2 A5:4 C6:4 | B5:4 A5:2 F#5:2 D#5:4 B4:4';
    var mB = 'G5:6 E5:2 C5:4 E5:4 | F#5:6 D5:2 A4:4 D5:4 | F#5:4 B5:4 A5:2 F#5:2 D5:4 | E5:12 .:4 | ' +
             'G5:4 C6:4 B5:2 A5:2 G5:4 | A5:4 D6:4 C6:2 B5:2 A5:4 | B5:6 D#6:2 F#6:4 D#6:4 | E6:2 D#6:2 C6:2 B5:2 A5:2 F#5:2 D#5:4';
    var dr = Dr('k...s..kk.k.s...'), fill = Dr('k...s..ks.s.ttTT'), hat = Dr('h.h.o.h.h.h.o.hh');
    var slap = function (ch) { return CP('0..0..3.0.0..3.2', ch, 2); };
    return {
      bpm: 138, room: 0.13,
      inst: { p1: 'lead', p2: 'stab', tr: 'bass', v1: 'vlead', v2: 'vpad', sw: 'sawL', sb: 'slap' },
      parts: {
        A: { p1: mA, v1: T(mA, -12), p2: CP('0.2.3.2.0.2.3.2.', chA, 4), v2: CP('1-------2-------', chA, 4), tr: CP('0-------0-------', chA, 2),
          sb: slap(chA), dm: B(RB(dr, 7), fill), nz: hat },
        B: { sw: mB, v1: HC(mB, chB, 16), p2: CP('0.2.3.2.0.2.3.2.', chB, 4), v2: CP('1-------2-------', chB, 4), tr: CP('0-------0-------', chB, 2),
          sb: slap(chB), dm: B(RB(dr, 3), fill, RB(dr, 3), fill), nz: hat },
        A2: { p1: mA, v1: HC(mA, chA, 16), sw: '@sawB ' + T(mA, -12), p2: CP('0123012301230123', chA, 4), v2: CP('1-------2-------', chA, 4),
          tr: CP('0-------0-------', chA, 2), sb: slap(chA), dm: B(RB(dr, 7), fill), nz: hat }
      },
      mix: { sw: 0.9 },
      seq: ['A', 'B', 'A2', 'B']
    };
  });

  // RUINS NIGHT - fog thickens, mutants hunt: half-time, Phrygian bII, echoing lead, heartbeat kick
  song('ruins_night', function () {
    var chA = ['Em', 'Em', 'C', 'F', 'Em', 'Am', 'F', 'B7'], chB = ['Am', 'Em', 'Am', 'B7', 'C', 'F', 'B7', 'Em'];
    var mA = 'E5:4 G5:4 B5:8 | A5:4 G5:4 F#5:4 D#5:4 | E5:4 G5:4 C6:8 | B5:4 A5:4 F5:8 | E5:4 G5:4 B5:6 C6:2 | C6:4 B5:4 A5:4 E5:4 | F5:6 E5:2 C5:8 | D#5:8 B4:8';
    var mB = 'C6:8 A5:8 | B5:8 G5:8 | A5:4 C6:4 E6:8 | D#6:8 B5:8 | E6:6 D6:2 C6:8 | C6:4 B5:4 A5:4 F5:4 | D#5:4 F#5:4 A5:4 B5:4 | G5:8 E5:8';
    var dr = Dr('k.....k.s.......'), dr2 = Dr('k..k..k.s......s?');
    return {
      bpm: 104, room: 0.22,
      inst: { p1: I('lead50', { echo: { steps: 3, v: 0.32 }, vib: 18 }), p2: I('arp', { v: 0.06 }), tr: 'bass', v1: I('vlead', { v: 0.1 }), v2: I('vpad', { v: 0.05 }),
        sw: I('sawP', { v: 0.045 }), sb: I('slap', { v: 0.42 }) },
      parts: {
        A: { p1: mA, p2: CP('0..2..3.0..2..3.', chA, 4), v2: CP('4---------------', chA, 3), tr: CP('0-------0-------', chA, 2), sw: CP('0---------------', chA, 3),
          sb: CP('0.....0...0.....', chA, 2), dm: B(dr, dr, dr, dr2, dr, dr, dr, dr2), nz: B(Dr('w...............'), Dr('....h.......h...'), Dr('w...............'), Dr('....h...h...h.h.')) },
        B: { p1: mB, v1: HC(mB, chB, 16), p2: CP('0..2..3.0..2..3.', chB, 4), v2: CP('4---------------', chB, 3), tr: CP('0-------0-------', chB, 2), sw: CP('0---------------', chB, 3),
          sb: CP('0.....0...0...3.', chB, 2), dm: B(dr, dr, dr, dr2, dr, dr, dr2, Dr('k..k..k.s.s.ssss')), nz: RB(Dr('....h.......h...'), 8) },
        A2: { sw: '@sawL ' + mA, v1: HC(mA, chA, 16), p2: CP('0..2..3.0..2..3.', chA, 4), v2: CP('4---------------', chA, 3), tr: CP('0-------0-------', chA, 2),
          sb: CP('0.....0...0.....', chA, 2), dm: B(dr, dr, dr, dr2, dr, dr, dr, dr2), nz: B(Dr('w...............'), Dr('....h.......h...'), Dr('w...............'), Dr('....h...h...h.h.')) }
      },
      mix: { sw: 0.9 },
      seq: ['A', 'B', 'A2', 'B']
    };
  });

  // CIRCUS - a calliope oom-pah polka played at half speed (and an octave down): sour pipes, seasick slides, A minor
  song('circus', function () {
    var chA = ['Am', 'E7', 'Am Dm', 'E7 Am'], chB = ['F', 'Am', 'Dm Bb', 'E7'];
    var mA = 'E4:2 D#4 E4 A4:2 E4:2 C4:2 B3 C4 E4:4 | D4:2 C#4 D4 B4:2 G#4:2 E4:2 F4 E4 D4:2 B3:2 | C4:2 B3 C4 A4:2 E4:2 F4:2 E4 F4 D4:4 | G#3:2 B3:2 D4:2 F4:2 E4:4 A3:4';
    var mB = 'A4:3 G#4 A4:2 F4:2 C5:4 A4:4 | E4:3 D#4 E4:2 C4:2 A4:4 E4:4 | F4:2 E4:2 D4:2 A3:2 Bb3:2 D4:2 F4:4 | E4:2 G#4:2 B4:2 D5:2 C5:2 B4:2 G#4:4';
    var oom = function (ch) { return CP('0-..8-..0-..8-..', ch, 2); }, pah = function (ch) { return CP('..x-..x-..x-..x-', ch, 4); };
    var pah2 = function (ch) { return CP('..1...1...1...1.', ch, 4); };
    var kd = Dr('k?...k?...k?...k?...'), cy = Dr('..h?...h?...h?...h?.');
    return {
      bpm: 62, room: 0.24,
      inst: { p1: I('organ', { w: 'p25', v: 0.12, vib: 32, vibD: 0.06, vibR: 4.3, dbl: 22, slide: 1, slideT: 0.07 }), p2: I('stab', { v: 0.07, gate: 0.6 }),
        tr: 'bassS', v1: I('vbell', { v: 0.08, echo: { steps: 3, v: 0.4 } }), v2: I('vstab', { w: 'q6', v: 0.065, gate: 0.6, dbl: -15 }),
        sw: I('sawS', { v: 0.1, slide: 0.5, slideT: 0.04 }), sb: I('whoa', { v: 0.38 }) },
      parts: {
        A: { p1: mA, p2: pah(chA), v2: pah2(chA), tr: oom(chA), sw: oom(chA), dm: kd, nz: cy },
        B: { p1: mB, p2: pah(chB), v2: pah2(chB), tr: oom(chB), sw: oom(chB), dm: kd, nz: cy },
        A2: { p1: mA, v1: T(mA, 24), p2: pah(chA), v2: pah2(chA), tr: oom(chA), sw: oom(chA), dm: kd, nz: cy },
        B2: { p1: mB, v1: T(mB, 24), p2: pah(chB), v2: pah2(chB), tr: oom(chB), sw: oom(chB), dm: kd, nz: B(cy, cy, cy, Dr('..h?...h?.w.......')),
          sb: 'A2:16 | .:16 | D2:16 | E2:8 .:8' }
      },
      seq: ['A', 'B', 'A2', 'B2']
    };
  });

  // BIGTOP - frantic circus gallop for the Big Top, G minor with a Bb trio and a chromatic crowd-whipping break
  song('bigtop', function () {
    var chA = ['Gm', 'D7', 'Gm', 'D7', 'Gm', 'Cm', 'D7', 'Gm'], chB = ['Bb', 'F7', 'Bb', 'F7', 'Eb', 'Bb', 'F7', 'D7'], chC = ['D', 'Eb', 'E', 'D7'];
    var mA = 'D5 D5 G5 D5 Bb5:2 A5:2 G5:2 D5:2 G5:4 | F#5 F#5 A5 F#5 C6:2 Bb5:2 A5:2 F#5:2 D5:4 | G5 A5 Bb5 C6 D6:2 Bb5:2 G5:2 D5:2 Bb4:4 | A4 Bb4 C5 D5 Eb5:2 D5:2 C5:2 A4:2 F#4:4 | ' +
             'G5 G5 Bb5 G5 D6:2 C6:2 Bb5:2 G5:2 D6:4 | Eb6 Eb6 D6 C6 G5:2 Eb5:2 C5:2 Eb5:2 G5:4 | F#5 G5 A5 Bb5 C6 D6 Eb6 D6 C6:2 A5:2 F#5:2 D5:2 | G5:2 D5:2 Bb4:2 D5:2 G5:4 .:4';
    var mB = 'F5:2 Bb5:2 D6:2 Bb5:2 F5:2 D5:2 Bb4:4 | Eb5:2 F5:2 A5:2 C6:2 Eb6:4 C6:4 | D6 C6 Bb5 A5 Bb5:2 F5:2 D5:2 F5:2 Bb5:4 | C6 Bb5 A5 G5 A5:2 F5:2 C5:2 Eb5:2 A5:4 | ' +
             'G5:2 Bb5:2 Eb6:2 Bb5:2 G5:2 Eb5:2 Bb4:4 | F5:2 Bb5:2 D6:2 F6:2 D6:4 Bb5:4 | A5 Bb5 C6 D6 Eb6 D6 C6 Bb5 A5:2 F5:2 Eb5:2 C5:2 | D5:2 F#5:2 A5:2 C6:2 D6:2 C6:2 A5:2 F#5:2';
    var mC = R('D6 A5 F#5 A5', 4) + ' | ' + R('Eb6 Bb5 G5 Bb5', 4) + ' | ' + R('E6 B5 G#5 B5', 4) + ' | F#6 D6 A5 C6 F#6 D6 A5 C6 D6:8';
    var dr = Dr('k.s.k.s.k.s.k.s.'), fill = Dr('k.s.k.s.ssssk!.k!.'), hat = Dr('h.hhh.hhh.hhh.hh');
    var oom = function (ch) { return CP('0-8-0-8-0-8-0-8-', ch, 2); };
    return {
      bpm: 200, room: 0.12,
      inst: { p1: 'lead', p2: 'stab', tr: 'bassS', v1: 'vlead', v2: 'vstab', sw: I('sawS', { v: 0.1 }), sb: 'whoa' },
      parts: {
        A: { p1: mA, v1: T(mA, -12), p2: CP('..x-..x-..x-..x-', chA, 4), v2: CP('..1...1...1...1.', chA, 4), tr: oom(chA), sw: oom(chA),
          dm: B(RB(dr, 7), fill), nz: hat, sb: 'y .:15 | ' + bars(7) },
        B: { p1: mB, v1: HC(mB, chB, 16), p2: CP('..x-..x-..x-..x-', chB, 4), v2: CP('..1...1...1...1.', chB, 4), tr: oom(chB), sw: oom(chB),
          dm: B(RB(dr, 3), fill, RB(dr, 3), fill), nz: hat },
        A2: { p1: mA, v1: HC(mA, chA, 16), p2: CP('..x-..x-..x-..x-', chA, 4), v2: CP('..1...1...1...1.', chA, 4), tr: oom(chA), sw: oom(chA),
          dm: B(RB(dr, 7), fill), nz: hat, sb: '@ostab G4:4 .:12 | ' + bars(6) + ' | .:8 G4:4 G4:4' },
        C: { p1: mC, v1: T(mC, -12), p2: CP('x.x.x.x.x.x.x.x.', chC, 4), tr: oom(chC), sw: oom(chC),
          dm: B(Dr('K.s.K.s.K.s.K.s.'), Dr('K.s.K.s.K.s.K.s.'), Dr('K.s.K.s.K.s.K.s.'), Dr('K.s.s.s.ssssS!.S!.')), nz: Dr('c.hhh.hhh.hhh.hh'),
          sb: 'D4:8 .:8 | Eb4:8 .:8 | E4:8 .:8 | y .:15' }
      },
      seq: ['A', 'B', 'A2', 'B', 'C']
    };
  });

  // HEATHER - the chase: a flaming skull-faced bear on roller skates is right behind you. C minor, 3+3+2 drive, rink organ
  song('heather', function () {
    var chA = ['Cm', 'Cm', 'Ab', 'Bb', 'Cm', 'Cm', 'Ab', 'G'], chB = ['Fm', 'Cm', 'Fm', 'G', 'Ab', 'Bb', 'Bdim7', 'G'];
    var mA = 'C5:3 Eb5:3 G5:2 C6:4 Bb5:2 G5:2 | Ab5:3 G5:3 Eb5:2 F5:4 G5:4 | C5:3 Eb5:3 Ab5:2 C6:4 Eb6:2 C6:2 | D6:3 C6:3 Bb5:2 F5:4 D5:4 | ' +
             'C5:3 Eb5:3 G5:2 C6:4 D6:2 Eb6:2 | F6:3 Eb6:3 D6:2 C6:4 G5:4 | Ab5:3 C6:3 Eb6:2 Ab5:2 G5:2 F5:2 Eb5:2 | D5:3 F5:3 G5:2 B5:4 D6:4';
    var mB = 'F5:4 Ab5:4 C6:6 Bb5:2 | G5:4 Eb5:4 C5:8 | F5:4 Ab5:4 C6:4 F6:4 | D6:6 B5:2 G5:8 | Eb6:3 C6:3 Ab5:2 Eb6:4 C6:4 | F6:3 D6:3 Bb5:2 F6:4 D6:4 | ' +
             'D6 F6 Ab6 B6 Ab6 F6 D6 B5 Ab5 F5 D5 B4 D5:2 F5:2 | G5:8 B4:4 D5:4';
    var dr = Dr('k..k..k.s..k..s.'), fill = Dr('k..k..k.T.T.ttss'), hat = Dr('hhohhhohhhohhhoh');
    var organ = I('vlead', { w: 'q4', v: 0.13, vib: 12, vibD: 0.1, vibR: 6.5 });
    return {
      bpm: 172, room: 0.12,
      inst: { p1: I('lead', { v: 0.12 }), p2: 'arp', tr: 'bass', v1: organ, v2: 'vpad', sw: I('sawS', { gate: 0.5 }), sb: 'timp' },
      parts: {
        A: { v1: mA, p1: T(mA, -12), p2: CP('3210321032103210', chA, 4), v2: CP('1-------2-------', chA, 4), tr: CP('0-0-0-0-0-0-3-0-', chA, 2),
          sw: CP('0..0..0.0..0..0.', chA, 2), dm: B(RB(dr, 7), fill), nz: hat, sb: 'C2:16 | .:16 | .:16 | .:16 | C2:16 | .:16 | .:16 | G1:4 G1:4 G1:4 G1:4' },
        B: { v1: mB, p1: HC(mB, chB, 16), sw: '@sawL ' + T(mB, -12), p2: CP('3210321032103210', chB, 4), v2: CP('1-------2-------', chB, 4),
          tr: CP('0-0-0-0-0-0-3-0-', chB, 2), dm: B(RB(dr, 3), fill, RB(dr, 3), fill), nz: hat, sb: 'F2:16 | C2:16 | F2:16 | G1:16 | Ab1:16 | Bb1:16 | B1:4 B1:4 B1:4 B1:4 | G1 G1 G1 G1 G1 G1 G1 G1 G1! G1! G1! G1! G1:4' },
        A2: { v1: mA, p1: HC(mA, chA, 16), p2: CP('3210321032103210', chA, 4), v2: CP('1-------2-------', chA, 4), tr: CP('0-0-0-0-0-0-3-0-', chA, 2),
          sw: CP('0..0..0.0..0..0.', chA, 2), dm: B(RB(dr, 7), fill), nz: hat, sb: 'C2:16 | .:16 | Ab1:16 | Bb1:16 | C2:16 | .:16 | Ab1:16 | G1:4 G1:4 G1:4 G1:4' }
      },
      mix: { sw: 0.9 },
      seq: ['A', 'B', 'A2', 'B']
    };
  });

  // BOSS - heavy boss battle: pedal-tone riff on saw + triangle, orchestra hits, timpani, D minor
  song('boss', function () {
    var chA = ['Dm', 'Dm', 'Bb', 'A', 'Dm', 'Dm', 'Gm', 'A'], chB = ['Bb', 'C', 'Dm', 'Dm', 'Bb', 'C', 'E7', 'A'], chC = ['Dm', 'Dm', 'Bb', 'A'];
    var rD = 'D2 D2 D3 D2 C3 D2 Bb2 D2 A2 D2 G#2 D2 A2 D2 C3 D2';
    var riff = B(rD, rD, T(rD, -4), T(rD, -5), rD, rD, T(rD, -7), T(rD, -5));
    var mA = 'A5:3 D5 A5:2 Bb5:2 A5:4 F5:2 E5:2 | D5:3 E5 F5:2 G5:2 A5:8 | Bb5:3 F5 Bb5:2 C6:2 Bb5:4 A5:2 G5:2 | A5:3 G#5 A5:2 B5:2 C#6:8 | ' +
             'D6:3 A5 D6:2 E6:2 F6:4 E6:2 D6:2 | C6:3 A5 F5:2 A5:2 D6:8 | Bb5:3 A5 G5:2 Bb5:2 D6:2 C6:2 Bb5:2 G5:2 | A5:4 E5:4 C#5:4 A4:4';
    var mB = 'F5:6 G5:2 Bb5:8 | C6:6 Bb5:2 G5:8 | A5:4 F5:4 D5:4 F5:4 | A5:12 .:4 | D6:6 C6:2 Bb5:4 F5:4 | E6:6 D6:2 C6:4 G5:4 | G#5:4 B5:4 E6:4 D6:4 | C#6:4 A5:4 E5:4 C#5:4';
    var dr = Dr('k.k.s..kk.k.s.k.'), fill = Dr('k.s.k.ssk.s.ssss'), hat = Dr('h.h.h.h.h.h.h.h.'), hatC = Dr('c.h.h.h.h.h.h.h.');
    return {
      bpm: 160, room: 0.13,
      inst: { p1: 'lead', p2: 'arp', tr: 'bassS', v1: 'vlead', v2: 'vpad', sw: I('sawB', { gate: 0.75 }), sb: 'ostab' },
      parts: {
        A: { p1: mA, v1: T(mA, -12), p2: CP('3210321032103210', chA, 4), v2: CP('1-------2-------', chA, 4), tr: riff, sw: riff,
          dm: B(RB(dr, 7), fill), nz: B(hatC, RB(hat, 7)), sb: CP('0...............', chA.slice(0, 7), 4) + ' | ' + P('0...0...0...0...', 'A', 3) },
        B: { sw: '@sawL ' + mB, v1: HC(mB, chB, 16), p1: T(mB, 12), p2: CP('0-2-3-2-0-2-3-2-', chB, 4), v2: CP('1---------------', chB, 4),
          tr: CP('0-------0-------', chB, 2), dm: RB(Dr('k.......s.......'), 3) + ' | ' + Dr('k.....k.s...s.ss') + ' | ' + RB(Dr('k.......s.......'), 3) + ' | ' + Dr('k.k.s.k.ssssS!.S!.'),
          nz: B(hatC, RB(Dr('h...h...h...h...'), 7)), sb: '@timp ' + CP('0...........0...', chB, 2) },
        A2: { p1: mA, v1: HC(mA, chA, 16), p2: CP('0123012301230123', chA, 4), v2: CP('1-------2-------', chA, 4), tr: riff, sw: riff,
          dm: B(RB(dr, 7), fill), nz: B(hatC, RB(hat, 7)), sb: CP('0.......0.......', chA.slice(0, 7), 4) + ' | ' + P('0...0...0...0...', 'A', 3) },
        C: { p2: R('D5+1:16', 1) + ' | ' + 'D5+1:16 | Bb4+1:16 | A4+1:16', tr: B(rD, rD, T(rD, -4), T(rD, -5)), sw: B(rD, rD, T(rD, -4), T(rD, -5)),
          v1: 'D5:8 C#5:8 | D5:8 F5:8 | E5:8 D5:8 | C#5:8 E5:8', dm: B(Dr('K..K..K.s...s...'), Dr('K..K..K.s...s...'), Dr('K..K..K.s...s...'), Dr('K.T.T.u.u.t.t!t!t!t!')),
          nz: B(hatC, hat, hat, hat), sb: 'D4:4 .:4 D4:4 .:4 | D4:4 .:4 D4:4 .:4 | Bb3:4 .:4 Bb3:4 .:4 | A3:2 .:2 A3:2 .:2 A3:2 A3:2 A3:4' }
      },
      seq: ['A', 'B', 'A2', 'C']
    };
  });

  // SETTLEMENT - the Medium Skyfowl Settlement: regal bird town. Bb major, dotted fanfares in thirds, timpani, harpsichord, chirps
  song('settlement', function () {
    var chA = ['Bb', 'F', 'Gm', 'Eb', 'Bb', 'Cm F', 'Bb', 'F7'], chB = ['Eb', 'Bb', 'Cm', 'F', 'Gm', 'Eb', 'Cm F', 'Bb'];
    var mA = 'F5:3 F5 Bb5:4 D6:3 C6 Bb5:4 | C6:3 Bb5 A5:4 F5:8 | G5:3 A5 Bb5:4 D6:3 Eb6 D6:4 | C6:3 Bb5 G5:4 Eb5:8 | ' +
             'F5:3 F5 Bb5:4 D6:3 F6 D6:4 | Eb6:3 D6 C6:4 A5:3 Bb5 C6:4 | D6:4 Bb5:4 F5:4 D5:4 | C5:3 D5 Eb5:4 F5:4 A5:4';
    var mB = 'G5:2 Bb5:2 Eb6:4 D6:2 Eb6:2 G6:4 | F6:6 D6:2 Bb5:8 | Eb6:2 D6:2 C6:2 G5:2 Eb5:4 G5:4 | A5:6 C6:2 F6:8 | ' +
             'D6:2 Bb5:2 G5:2 Bb5:2 D6:4 G6:4 | G6:4 F6:2 Eb6:2 Bb5:8 | C6:2 Eb6:2 G6:4 F6:2 Eb6:2 C6:2 A5:2 | Bb5:12 .:4';
    var regal = function (ch) { return CP('0--00---2--22---', ch, 2); }, harp = function (ch) { return CP('0212021202120212', ch, 4); };
    var dr = Dr('k.......s.......'), drF = Dr('k.......s...s.ss'), nzA = Dr('h.h.h.hzh.h.h.zz');
    return {
      bpm: 100, room: 0.18,
      inst: { p1: 'brass', p2: I('pluck', { v: 0.075, gate: 0.7 }), tr: 'bass', v1: 'vbrass', v2: 'vpad', sw: I('sawB', { v: 0.09 }), sb: 'timp' },
      parts: {
        A: { p1: mA, v1: HC(mA, chA, 16), p2: harp(chA), v2: CP('1-------1-------', chA, 4), tr: regal(chA), sw: regal(chA),
          sb: CP('0.......2.......', chA.slice(0, 7), 2) + ' | C3 C3 C3 C3 C3 C3 C3 C3 F2 F2 F2 F2 F2:2 F2:2', dm: B(RB(dr, 3), drF, RB(dr, 3), drF), nz: nzA },
        B: { p1: mB, v1: HC(mB, chB, 16), p2: harp(chB), v2: '@chirp ' + CP('......2.2.....4.', chB, 6), tr: regal(chB), sw: regal(chB),
          sb: CP('0...............', chB, 2), dm: B(RB(dr, 3), drF, RB(dr, 3), drF), nz: nzA },
        A2: { p1: mA, v1: HC(mA, chA, 16, 5), p2: harp(chA), v2: '@chirp ' + CP('..4.........2.2.', chA, 6), tr: regal(chA), sw: '@sawL ' + T(mA, -12),
          sb: CP('0.......2.......', chA.slice(0, 7), 2) + ' | C3 C3 C3 C3 C3 C3 C3 C3 F2 F2 F2 F2 F2:2 F2:2', dm: B(RB(dr, 3), drF, RB(dr, 3), drF), nz: nzA }
      },
      mix: { sw: 0.85 },
      seq: ['A', 'B', 'A2', 'B']
    };
  });

  // MARKET - the Silk Road Market bazaar: D Hijaz, darbuka maqsum, zurna lead, oud, riq
  song('market', function () {
    var chA = ['D', 'D', 'Gm', 'D', 'Eb', 'D', 'Cm Gm', 'D'], chB = ['Gm', 'D', 'Gm', 'D', 'Cm', 'Eb', 'Cm', 'D'];
    var mA = 'A4:2 Bb4 A4 F#4:2 G4:2 A4:4 .:2 D5:2 | C5:2 Bb4 C5 A4:2 Bb4:2 G4:2 F#4:2 Eb4:2 D4:2 | G4:2 A4 Bb4 C5:2 D5:2 Eb5:4 D5:2 C5:2 | D5:2 Eb5 D5 C5:2 Bb4:2 A4:8 | ' +
             'Bb4:2 C5 D5 Eb5:2 G5:2 F#5:4 Eb5:2 D5:2 | D5:2 C5 D5 Eb5:2 F#5:2 A5:4 G5:2 F#5:2 | G5:2 Eb5:2 C5:2 Eb5:2 D5:2 Bb4:2 G4:2 Bb4:2 | A4:6 Bb4 A4 F#4:4 D4:4';
    var mB = 'D5:4 G5:4 Bb5:2 A5:2 G5:4 | A5:2 Bb5:2 A5:2 G5:2 F#5:8 | G5:2 Bb5:2 D6:4 C6:2 Bb5:2 A5:4 | Bb5:2 A5:2 G5:2 F#5:2 Eb5:2 D5:2 Eb5:4 | ' +
             'C5:2 Eb5:2 G5:4 F#5:2 G5:2 Eb5:4 | G5:2 Bb5:2 Eb6:4 D6:2 C6:2 Bb5:4 | C6:2 Bb5:2 A5:2 G5:2 F#5:2 G5:2 A5:2 Bb5:2 | A5:8 D5:8';
    var dar = Dr('T.t...t.T...t.tt?'), darF = Dr('T.t.ttt.T.tttttt'), riq = Dr('j.h.j.h.j.h.j.hh');
    var oud = function (ch) { return CP('0.20.20.0.20.2.0', ch, 3); }, doum = function (ch) { return CP('0-......0-.0....', ch, 2); };
    return {
      bpm: 112, room: 0.15,
      inst: { p1: I('lead50', { v: 0.08 }), p2: I('pluck', { v: 0.1 }), tr: 'bass', v1: I('vreed', { v: 0.135 }), v2: 'vpad', sw: I('sawP', { v: 0.045 }), dm: 'slap', sb: 'slap' },
      parts: {
        A: { v1: mA, p2: oud(chA), tr: doum(chA), sw: RB('D3:16', 8), v2: CP('1---------------', chA, 4), dm: B(RB(dar, 7), darF), nz: riq },
        B: { v1: mB, p1: T(mB, 12), p2: oud(chB), tr: doum(chB), sw: RB('D3:16', 8), v2: CP('1---------------', chB, 4), dm: B(RB(dar, 3), darF, RB(dar, 3), darF), nz: riq,
          sb: RB(Dr('....c.......c...'), 8) },
        A2: { v1: mA, p1: HC(mA, chA, 16), p2: oud(chA), tr: doum(chA), sw: RB('D3:16', 8), v2: CP('1---------------', chA, 4), dm: B(RB(dar, 7), darF), nz: riq,
          sb: CP('0..0..0.0.......', chA, 2) }
      },
      seq: ['A', 'B', 'A2', 'B']
    };
  });

  // CLUB - the Desperado Club: 70s disco in chip form. Four on the floor, slap octaves, strings, scratch guitar, saw synth hook
  song('club', function () {
    var chA = ['Am7', 'Dm7', 'Am7', 'Dm7', 'Fmaj7', 'Em7', 'Dm7', 'E7'], chB = ['Fmaj7', 'G', 'Em7', 'Am7', 'Fmaj7', 'G', 'E7', 'Am7'];
    var mA = '.:2 E5:2 G5:2 A5:2 .:2 C6:2 A5:4 | .:2 F5:2 A5:2 C6:2 .:2 D6:2 C6:2 A5:2 | .:2 E5:2 G5:2 A5:2 .:2 E6:2 D6:2 C6:2 | D6:4 C6:2 A5:2 F5:4 G5:4 | ' +
             'A5:3 G5 A5:2 C6:2 E6:4 C6:4 | B5:3 A5 G5:2 E5:2 B5:4 D6:4 | C6:2 A5:2 F5:2 A5:2 D6:2 C6:2 A5:2 F5:2 | G#5:4 B5:4 D6:4 E6:4';
    var mB = 'A5:6 C6:2 F6:8 | G6:6 F6:2 D6:8 | E6:6 D6:2 B5:8 | C6:4 B5:4 A5:8 | A5:6 C6:2 F6:4 E6:4 | D6:6 B5:2 G5:4 B5:4 | E6:4 D6:4 B5:4 G#5:4 | A5:12 .:4';
    var four = Dr('k...C...k...C...', { C: 'k&c' }), fourF = Dr('k...C...k...C.CC', { C: 'k&c' }), hat = Dr('h.ohh.ohh.ohh.oh');
    var slap = function (ch) { return CP('7-3-7-3-7-3-7-3-', ch, 3); }, gtr = function (ch) { return CP('.x.xx.x..x.xx.x.', ch, 4); };
    var stabs = function (ch) { return CP('....x-....x-..x.', ch, 4); };
    return {
      bpm: 120, room: 0.14,
      inst: { p1: I('brass', { v: 0.1, gate: 0.7 }), p2: I('stab', { v: 0.065, gate: 0.4 }), tr: 'bass', v1: 'vstr', v2: 'vstr', sw: 'sawL', sb: I('slap', { v: 0.46 }) },
      parts: {
        A: { sw: mA, p1: stabs(chA), p2: gtr(chA), v1: CP('1---------------', chA, 4), v2: CP('6---------------', chA, 4), sb: slap(chA), tr: CP('0---0---0---0---', chA, 2),
          dm: B(RB(four, 7), fourF), nz: hat },
        B: { v1: mB, v2: T(mB, -12), p1: stabs(chB), p2: gtr(chB), sw: '@sawP ' + CP('0---------------', chB, 3), sb: slap(chB), tr: CP('0---0---0---0---', chB, 2),
          dm: B(RB(four, 7), fourF), nz: hat },
        A2: { sw: mA, p1: HC(mA, chA, 16), p2: gtr(chA), v1: CP('1---------------', chA, 4), v2: CP('6---------------', chA, 4), sb: slap(chA), tr: CP('0---0---0---0---', chA, 2),
          dm: B(RB(four, 7), fourF), nz: Dr('hhohhhohhhohhhoh') }
      },
      mix: { sw: 0.95, v1: 0.9, v2: 0.9 },
      seq: ['A', 'B', 'A2', 'B']
    };
  });

  // SHOW - Danger Zone with Ripper Wonton: a cheesy brassy talk-show theme (once), then a soft lounge bed under the talking
  song('show', function () {
    var chT = ['Bb6', 'Gm7', 'Cm7', 'F7', 'Bb6', 'Gm7', 'Cm7 F7', 'Bb'];
    var mT = 'F5:2 G5:2 Bb5:2 D6:6 C6:2 Bb5:2 | D6:2 C6:2 Bb5:2 G5:6 F5:4 | Eb5:2 G5:2 Bb5:2 Eb6:6 D6:2 C6:2 | A5:4 C6:4 Eb6:6 D6:2 | ' +
             'D6:2 C6:2 Bb5:2 G5:2 F5:2 G5:2 Bb5:4 | Bb5:2 A5:2 G5:2 F5:2 D5:4 G5:4 | Eb5:2 G5:2 C6:4 A5:2 C6:2 Eb6:4 | D6:2 .:2 F6:2 .:2 Bb6:8';
    var chBed = ['Bbmaj7', 'Gm7', 'Cm7', 'F7', 'Dm7', 'G7', 'Cm7', 'F7'];
    var walk = 'Bb1:4 D2:4 F2:4 A2:4 | G1:4 Bb1:4 D2:4 F2:4 | C2:4 Eb2:4 G2:4 Bb2:4 | F1:4 A1:4 C2:4 Eb2:4 | D2:4 F2:4 A2:4 C3:4 | G1:4 B1:4 D2:4 F2:4 | C2:4 Eb2:4 G2:4 A2:4 | F2:4 Eb2:4 C2:4 A1:4';
    var vib1 = '.:8 F5:2 G5:2 Bb5:4 | D6:8 .:8 | .:8 Eb5:2 G5:2 Bb5:4 | C6:8 .:8 | .:8 F5:2 A5:2 C6:4 | B5:8 .:8 | .:8 Eb6:2 D6:2 C6:2 Bb5:2 | A5:8 .:8';
    var vib2 = '.:16 | .:8 D6:2 C6:2 Bb5:4 | .:16 | .:8 A5:2 C6:2 Eb6:4 | .:16 | .:8 D6:2 F6:2 B5:4 | .:16 | .:8 A5:2 G5:2 F5:4';
    var ride = Dr('o...o.h.o...o.h.'), brush = Dr('h...h.h.h...h.h.');
    return {
      bpm: 132, loopFrom: 1, swing: 0.16, swingUnit: 2, room: 0.16,
      inst: { p1: 'brass', p2: I('stab', { v: 0.07 }), tr: 'bass', v1: 'vbrass', v2: 'vpad', sw: I('sawB', { v: 0.1 }), sb: 'ostab' },
      parts: {
        I: { p1: mT, v1: HC(mT, chT, 16), sw: CP('0---2---3---2---', chT, 2), tr: CP('0---1---2---3---', chT, 2), p2: CP('....x.......x...', chT, 4),
          v2: CP('6---------------', chT, 4), dm: B(Dr('k...s...k.k.s...'), RB(Dr('k...s...k.k.s...'), 6), Dr('k.s.k.s.K.......')), nz: B(Dr('c...o.h.o...o.h.'), RB(ride, 6), Dr('o.o.o.o.c.......')),
          sb: 'y .:15 | ' + bars(6) + ' | D4:2 .:2 F4:2 .:2 Bb4:8' },
        bed: { vel: 0.75, v1: '@vbell ' + vib1, tr: walk, p2: CP('......x-....x...', chBed, 4), v2: CP('1---------------', chBed, 4),
          dm: RB(Dr('k?.......k?.......'), 8), nz: brush },
        bed2: { vel: 0.75, v1: '@vbell ' + vib2, tr: walk, p2: CP('..x.......x-....', chBed, 4), v2: CP('6---------------', chBed, 4),
          dm: RB(Dr('k?.......k?.......'), 8), nz: brush }
      },
      seq: ['I', 'bed', 'bed2']
    };
  });

  // DARK - horror: Krasue nest, Featherfall's corpse, darkness. C minor, minor-second clusters, music box, demonic whoa groans
  song('dark', function () {
    var chA = ['Cm', 'Cm', 'Ab', 'Ab', 'Fm', 'G', 'Cm', 'Db'], chB = ['Fm', 'Cm', 'Db', 'G', 'Fm', 'Cm', 'Ab', 'G'];
    var box = '.:16 | G5:2 .:2 Eb5:2 .:2 D5:2 .:2 Db5:4 | C5:8 .:8 | .:16 | Ab5:2 .:2 G5:2 .:2 Eb5:2 .:2 D5:4 | B4:8 .:8 | .:16 | F#5:4 G5:4 .:8';
    var wail = 'C6:8 B5:8 | Bb5:8 A5:8 | Ab5:16 | G5:16 | F5:8 E5:8 | Eb5:8 D5:8 | Db5:16 | B4:16';
    var hb = Dr('k?.k?.............');
    return {
      bpm: 72, room: 0.32,
      inst: { p1: I('bell', { v: 0.11, echo: { steps: 3, v: 0.4 } }), p2: I('thin', { v: 0.05 }), tr: 'bassS', v1: I('vpad', { v: 0.045, vib: 25, vibD: 0.5, vibR: 3.1 }),
        v2: I('vpad', { v: 0.045, vib: 25, vibD: 0.5, vibR: 2.6 }), sw: I('sawP', { v: 0.05, a: 0.6 }), sb: I('whoa', { v: 0.42 }) },
      parts: {
        A: { p1: box, v1: 'G5:16 | G5:16 | Ab5:16 | Ab5:16 | Ab5:16 | B5:16 | G5:16 | Ab5:16', v2: 'Ab5:16 | Ab5:16 | A5:16 | G5:16 | G5:16 | C6:16 | Ab5:16 | A5:16',
          sw: 'C2:16 | C2:16 | Ab1:16 | Ab1:16 | F1:16 | G1:16 | C2:16 | Db2:16', tr: CP('0.0.............', chA, 2), dm: hb,
          sb: '.:16 | .:16 | C3:16 | .:16 | .:16 | .:16 | G2:16 | .:16', nz: B(Dr('w...............'), Dr('......m?.........'), Dr('w...............'), Dr('...........m?....')) },
        B: { v1: '@wail ' + wail, p2: 'B4+1:16 | C5+1:16 | Db5+1:16 | B4+1:16 | C5+1:16 | B4+1:16 | Ab4+1:16 | G4+1:16',
          sw: '@sawB F2:4 .:12 | C2:4 .:12 | Db2:4 .:12 | G1:4 .:4 G1:4 .:4 | F2:4 .:12 | C2:4 .:12 | Ab1:4 .:12 | G1:4 .:4 G1:4 G1:4',
          tr: CP('0.0.............', chB, 2), dm: hb,
          sb: '@timp ' + bars(3) + ' | ' + R('G1?', 12) + ' G1 G1 G1! G1! | ' + bars(3) + ' | ' + R('G1?', 8) + ' ' + R('G1', 4) + ' ' + R('G1!', 4),
          nz: B(Dr('w...............'), Dr('......m?.........'), Dr('w...............'), Dr('...........m?....')) }
      },
      insts: { wail: I('vlead', { v: 0.1, vib: 38, vibD: 0.3, vibR: 4.5 }) },
      seq: ['A', 'B']
    };
  });

  // CLIMB - tense ascent up the admin district: 3-against-4 ostinato, pedal bass, each pass climbs higher. A minor
  song('climb', function () {
    var chA = ['Am', 'Am', 'F', 'F', 'G', 'G', 'E', 'E'], chB = ['Dm', 'Am', 'Bb', 'F', 'Dm', 'E', 'F', 'E7'];
    var mA = 'E5:8 A5:8 | G5:4 A5:4 B5:4 C6:4 | C6:8 A5:8 | G5:4 A5:4 C6:4 F6:4 | D6:8 B5:8 | A5:4 B5:4 D6:4 G6:4 | G#6:8 E6:8 | D6:4 B5:4 G#5:4 E5:4';
    var mB = 'F6:6 E6:2 D6:8 | E6:6 D6:2 C6:8 | D6:6 C6:2 Bb5:4 F6:4 | A6:6 G6:2 F6:8 | F6:4 E6:4 D6:4 A5:4 | B5:4 G#5:4 E5:4 B5:4 | C6:4 A5:4 F5:4 C6:4 | B5:4 D6:4 G#6:8';
    var dr = Dr('k...s...k.k.s...'), fill = Dr('k...s...ttuuTTT!T!'), hat = Dr('h.h.h.h.h.h.h.hh');
    return {
      bpm: 144, room: 0.14,
      inst: { p1: 'lead', p2: I('arp', { v: 0.07 }), tr: 'bassS', v1: 'vlead', v2: 'vpad', sw: I('sawS', { v: 0.09, gate: 0.4 }), sb: 'timp' },
      parts: {
        A: { p1: mA, v1: T(mA, -12), p2: CP('0120120120120120', chA, 4), tr: CP('0-0-0-0-0-0-0-0-', chA, 2), sw: CP('.0.0.0.0.0.0.0.0', chA, 3),
          v2: CP('2---------------', chA, 4), sb: CP('0...............', chA, 2), dm: B(RB(dr, 3), fill, RB(dr, 3), fill), nz: hat },
        B: { p1: mB, v1: T(mB, -12), p2: CP('0120120120120120', chB, 4), tr: CP('0-0-0-0-0-0-0-0-', chB, 2), sw: CP('.0.0.0.0.0.0.0.0', chB, 3),
          v2: CP('1---------------', chB, 4), sb: CP('0.......0.......', chB, 2), dm: B(RB(dr, 3), fill, RB(dr, 3), fill), nz: hat }
      },
      seq: ['A', 'A+3', 'B', 'B+2']
    };
  });

  // ESCAPE - The Fools Who Broke the Glass: the countdown run. G minor, sirens, ticking, 3+3+2 melody, pumping bass,
  // orchestra hits; climbs a semitone mid-loop and the whole loop speeds up a little every time round
  song('escape', function () {
    var chA = ['Gm', 'Gm', 'Eb', 'F', 'Gm', 'Gm', 'Eb', 'D'], chB = ['Eb', 'F', 'D', 'Gm', 'Eb', 'F', 'Bb A', 'D'], chC = ['Gm', 'Gm', 'Ab', 'D'];
    var mA = 'G5:2 .:1 G5:1 D6:3 C6:3 Bb5:2 A5:2 Bb5:2 | G5:3 D5:3 G5:2 A5:3 Bb5:3 C6:2 | Bb5:2 .:1 Bb5:1 Eb6:3 D6:3 C6:2 Bb5:2 G5:2 | A5:3 F5:3 C6:2 F6:8 | ' +
             'G6:2 .:1 G6:1 D6:3 Bb5:3 G5:2 A5:2 Bb5:2 | C6:3 Bb5:3 A5:2 Bb5:3 G5:3 D5:2 | Eb5:3 G5:3 Bb5:2 Eb6:3 D6:3 Eb6:2 | F#6:4 D6:4 A5:4 F#5:4';
    var mB = 'G5:4 Bb5:4 Eb6:6 D6:2 | C6:4 A5:4 F5:6 G5:2 | A5:4 F#5:4 D6:6 C6:2 | Bb5:4 G5:4 D5:8 | Eb6:3 D6:3 C6:2 Bb5:3 C6:3 D6:2 | F6:3 Eb6:3 D6:2 C6:3 D6:3 Eb6:2 | ' +
             'D6:4 F6:4 E6:4 C#6:4 | D6:2 A5:2 F#5:2 D5:2 F#5:2 A5:2 D6:2 F#6:2';
    var mC = 'G5:2 D5:2 G5:2 A5:2 Bb5:2 A5:2 G5:2 D5:2 | G5:2 D5:2 G5:2 A5:2 Bb5:2 C6:2 D6:4 | Ab5:2 Eb5:2 Ab5:2 Bb5:2 C6:2 Bb5:2 Ab5:2 Eb5:2 | F#5:2 A5:2 D6:2 F#6:2 A6:8';
    var dr = Dr('k.k.s..kk.k.s.ks'), fill = Dr('k.s.k.s.ssssttTT'), tik = Dr('mhehmhehmhehmheh');
    var pump = function (ch) { return CP('0000000000000000', ch, 2); }, kick = function (ch) { return CP('0..3..0.3..0..3.', ch, 2); };
    var siren = 'D6:8 G#5:8';
    return {
      bpm: 184, loopFrom: 1, room: 0.12, accel: 1.025, accelMax: 1.1,
      inst: { p1: 'lead', p2: I('arp', { v: 0.065 }), tr: 'bassS', v1: 'vlead', v2: I('vlead', { w: 'q4', v: 0.07, vib: 30, vibD: 0, vibR: 9 }), sw: I('sawS', { v: 0.11, gate: 0.5 }), sb: 'ostab' },
      parts: {
        I: { v2: RB(siren, 4), nz: RB(Dr('m.e.m.e.m.e.m.e.'), 4), tr: bars(2) + ' | ' + R('G2', 16) + ' | ' + R('G2', 16), sw: bars(2) + ' | ' + R('G2', 16) + ' | ' + R('G2', 16),
          sb: '@timp ' + bars(2) + ' | ' + R('G1?', 16) + ' | ' + R('G1', 12) + ' G1! G1! G1! G1!', dm: bars(3) + ' | ' + R('s', 14) + ' s! s!', p1: bars(3) + ' | .:12 D5:2 F#5:2' },
        A: { p1: mA, v1: T(mA, -12), p2: CP('0123432101234321', chA, 4), v2: CP('1-------2-------', chA, 4), tr: pump(chA), sw: kick(chA),
          dm: B(RB(dr, 7), fill), nz: tik, sb: 'G3:2 .:14 | .:16 | .:16 | .:8 F3:2 .:2 F3:4 | G3:2 .:14 | .:16 | .:16 | D4:4 D4:4 D4:4 D4:4' },
        B: { p1: mB, v1: HC(mB, chB, 16), sw: '@sawL ' + T(mB, -12), p2: CP('0123432101234321', chB, 4), v2: CP('1---------------', chB, 4), tr: pump(chB),
          dm: B(RB(dr, 3), fill, RB(dr, 3), fill), nz: tik, sb: '@whoa G3:8 .:8 | ' + bars(3) + ' | G3:8 .:8 | ' + bars(2) + ' | @ostab D4:4 D4:4 D4:4 D4:4' },
        A2: { p1: mA, v1: HC(mA, chA, 16), p2: CP('3210321032103210', chA, 4), v2: CP('1-------2-------', chA, 4), tr: pump(chA), sw: kick(chA),
          dm: B(RB(dr, 7), fill), nz: tik, sb: 'G3:2 .:14 | .:16 | Eb3:2 .:14 | .:8 F3:2 .:2 F3:4 | G3:2 .:14 | .:16 | Eb3:2 .:14 | D4:4 D4:4 D4:4 D4:4' },
        C: { p1: mC, v1: T(mC, -12), v2: 'D6:8 G#5:8 | D6:8 G#5:8 | Eb6:8 A5:8 | D6:4 C#6:4 D6:4 F#6:4', tr: pump(chC), sw: kick(chC),
          dm: B(Dr('k..k..k.T.T.TTTT'), Dr('k..k..k.T.T.TTTT'), Dr('k..k..k.T.T.TTTT'), Dr('k.s.s.ssssssS!S!S!S!')), nz: B(Dr('c.e.m.e.m.e.m.e.'), RB(tik, 3)),
          sb: 'G3:4 .:12 | G3:4 .:12 | Ab3:4 .:12 | D4:2 D4:2 D4:2 D4:2 D4:2 D4:2 D4:2 D4:2' }
      },
      seq: ['I', 'A', 'B', 'A2+1', 'B+1', 'C']
    };
  });

  // INN - village inn safe room (Renaissance-fair pub): cozy 3/4 tavern tune, F major, recorder + lute + frame drum
  song('inn', function () {
    var chA = ['F', 'C', 'Dm', 'Bb', 'F', 'C', 'Bb C', 'F'], chB = ['Bb', 'F', 'Gm', 'C', 'Am', 'Dm', 'Gm C', 'F'];
    var mA = 'A4:2 C5:2 F5:4 E5:2 F5:2 | G5:6 E5:2 C5:4 | D5:2 E5:2 F5:4 A5:2 F5:2 | D5:6 C5:2 Bb4:4 | A4:2 C5:2 F5:4 G5:2 A5:2 | Bb5:4 A5:2 G5:2 E5:4 | F5:2 D5:2 Bb4:2 C5:2 E5:2 G5:2 | F5:12';
    var mB = 'D6:4 C6:4 Bb5:4 | A5:6 G5:2 F5:4 | G5:2 A5:2 Bb5:4 D6:4 | C6:6 Bb5:2 G5:4 | A5:4 C6:4 E6:4 | D6:6 C6:2 A5:4 | Bb5:2 A5:2 G5:2 E5:2 G5:2 Bb5:2 | F5:8 .:4';
    var fd = Dr('T?...t?...t?...'), sh = Dr('h?.h?.h?.h?.h?.h?.');
    var lute = function (ch) { return CP('0-1-2-3-2-1-', ch, 4); }, wb = function (ch) { return CP('0---.---2---', ch, 2); };
    return {
      bpm: 92, bar: 12, room: 0.2,
      inst: { p1: I('lead50', { v: 0.11, vib: 14, vibD: 0.2 }), p2: I('pluck', { v: 0.105 }), tr: 'bass', v1: I('vlead', { w: 'q2', v: 0.09 }), v2: I('vpad', { v: 0.045 }) },
      parts: {
        A: { p1: mA, p2: lute(chA), tr: wb(chA), v2: CP('1-----------', chA, 4), dm: fd, nz: sh },
        B: { p1: mB, v1: HC(mB, chB, 12), p2: lute(chB), tr: wb(chB), v2: CP('1-----------', chB, 4), dm: fd, nz: sh },
        A2: { p1: mA, v1: HC(mA, chA, 12), p2: lute(chA), tr: wb(chA), v2: CP('1-----------', chA, 4), dm: fd, nz: sh }
      },
      seq: ['A', 'B', 'A2', 'B']
    };
  });

  // CUTSCENE - neutral story underscore that sits under typewriter text. D minor / F major
  song('cutscene', function () {
    var chA = ['Dm', 'Bb', 'F', 'C', 'Dm', 'Bb', 'Gm', 'A'], chB = ['Bb', 'C', 'Am', 'Dm', 'Gm', 'C', 'F', 'A'];
    var mA = '.:16 | D5:8 F5:8 | A5:12 G5:4 | E5:16 | D5:8 F5:8 | Bb5:8 A5:4 G5:4 | G5:8 F5:4 E5:4 | C#5:16';
    var mB = 'F5:8 D5:8 | E5:8 G5:8 | C6:8 A5:8 | F5:16 | D5:8 G5:8 | E5:8 C5:8 | F5:8 A5:8 | E5:16';
    var dr = Dr('k?...............'), hh = Dr('....h?.......h?...');
    return {
      bpm: 88, room: 0.22,
      inst: { p1: I('lead50', { v: 0.08 }), p2: I('arp', { v: 0.06 }), tr: 'bass', v1: I('vlead', { v: 0.11, echo: { steps: 3, v: 0.28 } }), v2: 'vpad', sw: I('sawP', { v: 0.04 }) },
      parts: {
        A: { v1: mA, p2: CP('0-2-1-2-3-2-1-2-', chA, 4), tr: CP('0-------0-------', chA, 2), v2: CP('2---------------', chA, 4), sw: CP('1---------------', chA, 3), dm: dr, nz: hh },
        B: { v1: mB, p2: CP('0-2-1-2-3-2-1-2-', chB, 4), tr: CP('0-------0-------', chB, 2), v2: CP('2---------------', chB, 4), sw: CP('1---------------', chB, 3), dm: dr, nz: hh },
        A2: { v1: mA, p1: HC(mA, chA, 16), p2: CP('0-2-1-2-3-2-1-2-', chA, 4), tr: CP('0-------0-------', chA, 2), v2: CP('2---------------', chA, 4), sw: CP('1---------------', chA, 3), dm: dr, nz: hh }
      },
      seq: ['A', 'B', 'A2', 'B']
    };
  });

  // SAD - GumGum, Burgundy, Heather's last moments: slow and tender, A minor
  song('sad', function () {
    var chA = ['Am', 'F', 'C', 'G', 'Am', 'F', 'Dm', 'E'], chB = ['F', 'G', 'Em', 'Am', 'Dm', 'G', 'C', 'E'];
    var mA = 'E5:6 D5:2 C5:4 B4:4 | A4:8 C5:8 | G5:6 F5:2 E5:4 D5:4 | D5:16 | E5:6 F5:2 E5:4 C5:4 | A5:8 G5:4 F5:4 | F5:6 E5:2 D5:4 C5:4 | B4:16';
    var mB = 'A5:6 G5:2 F5:4 C6:4 | B5:8 G5:8 | G5:6 F5:2 E5:4 B4:4 | C5:8 E5:8 | F5:6 E5:2 D5:4 A5:4 | G5:8 D5:8 | E5:6 D5:2 C5:4 E5:4 | B4:8 G#4:8';
    return {
      bpm: 66, room: 0.26,
      inst: { p1: I('thin', { v: 0.06 }), p2: I('pluck', { v: 0.08, echo: { steps: 3, v: 0.3 } }), tr: 'bass', v1: I('vlead', { vib: 18, v: 0.12 }), v2: I('vpad', { v: 0.05 }),
        sw: I('sawP', { v: 0.04 }), sb: I('timp', { v: 0.3 }) },
      parts: {
        A: { v1: mA, p2: CP('0-2-3-2-1-2-3-2-', chA, 4), tr: CP('0-------2-------', chA, 2), v2: CP('1---------------', chA, 4), sb: bars(7) + ' | E2:16' },
        B: { v1: mB, p2: CP('0-2-3-2-1-2-3-2-', chB, 4), tr: CP('0-------2-------', chB, 2), v2: CP('1---------------', chB, 4), sw: CP('0---------------', chB, 3),
          sb: bars(7) + ' | E2:16' },
        A2: { v1: mA, p1: T(mA, 12), p2: CP('0-2-3-2-1-2-3-2-', chA, 4), tr: CP('0-------2-------', chA, 2), v2: CP('1---------------', chA, 4), sw: CP('0---------------', chA, 3),
          sb: bars(7) + ' | E2:16' }
      },
      seq: ['A', 'B', 'A2']
    };
  });

  // RESULTS - victory jingle (one-shot), F major
  song('results', function () {
    var p1 = 'C5 F5 A5 C6:2 A5 C6 F6:3 .:2 E6 F6 G6:2 | A6:2 G6:2 F6:2 E6:2 F6:8';
    return {
      bpm: 150, loop: false, room: 0.16,
      inst: { p1: 'brass', p2: 'arp', tr: 'bass', v1: 'vbrass', sw: 'sawB', sb: 'ostab' },
      parts: {
        A: { p1: p1, v1: HC(p1, ['F', 'C7 F'], 16), p2: 'F4+47:8 F4+47:8 | C4+47a:8 F4+47:8', tr: 'F2:4 .:4 F2:4 .:4 | C2:4 C3:4 F2:8', sw: 'F3:4 .:4 F3:4 .:4 | C3:4 E3:4 F3:8',
          dm: Dr('k...s...k...s...') + ' | ' + Dr('k.s.k.s.Y.......', { Y: 'K&y' }), nz: Dr('c...h...h...h...') + ' | ' + Dr('h.h.h.h.c.......'), sb: '.:16 | .:8 F4:8' }
      },
      seq: ['A']
    };
  });

  // GAMEOVER - sad descending jingle in parallel fourths, ends on a low groan (one-shot)
  song('gameover', function () {
    return {
      bpm: 84, loop: false, room: 0.24,
      inst: { p1: I('lead50', { vib: 22, vibD: 0.2 }), v1: I('vlead', { v: 0.09, vib: 0 }), tr: 'bass', sw: 'sawP', sb: I('whoa', { v: 0.4 }) },
      parts: {
        A: { p1: 'A4:4 G#4:4 G4:4 F#4:4 | F4:6 E4:2 D#4:4 E4:4 | A3:16', v1: 'E4:4 D#4:4 D4:4 C#4:4 | C4:6 B3:2 A3:4 G#3:4 | E3:16',
          tr: 'A2:16 | D2:8 E2:8 | A1:16', sw: 'A2:16 | F2:8 E2:8 | A1:16', sb: '.:16 | .:16 | A2:16', dm: '.:16 | .:16 | K .:15', nz: Dr('k?...............') + ' | .:16 | .:16' }
      },
      seq: ['A']
    };
  });

  // LOOTBOX - suspense roll (about the 1.9 s shake) into a game-show reveal (one-shot)
  song('lootbox', function () {
    return {
      bpm: 120, spb: 8, bar: 32, loop: false, room: 0.18,
      inst: { p1: I('thin', { v: 0.075, vib: 28, vibD: 0.05, vibR: 9 }), v1: I('vlead', { v: 0.07, vib: 20, vibD: 0.05 }), p2: 'arp', tr: 'bass', sw: 'sawP', sb: 'timp' },
      parts: {
        A: {
          p1: 'G5:8 G#5:8 A5:8 A#5:8 | E6:2 G6:2 C7:4 .:4 E6:2 G6:2 C7:16', v1: 'C5:8 C#5:8 D5:8 D#5:8 | C6:2 E6:2 G6:4 .:4 C6:2 E6:2 G6:16',
          tr: 'C2:8 C#2:8 D2:8 D#2:8 | C3:4 .:4 G2:4 .:4 C2:16', sw: 'C3:32 | C3:32', p2: '.:32 | .:12 C5+47:20',
          sb: R('G2?', 16) + ' ' + R('A2', 8) + ' ' + R('B2', 8) + ' | @ostab C4:8 .:24',
          dm: R('s?', 16) + ' ' + R('s', 12) + ' ' + R('s!', 4) + ' | ' + Dr('Y...............................', { Y: 'K&y' }), nz: '.:32 | c .:31'
        }
      },
      seq: ['A']
    };
  });

  // ENDING - bittersweet epilogue in Odette's green room: the Doomsday motif in D major, borrowed minor iv
  song('ending', function () {
    var chA = ['D', 'F#m', 'G', 'Gm', 'D', 'Bm', 'Em A', 'D'], chB = ['Bm', 'G', 'D', 'A', 'Bm', 'G', 'Gm', 'D'];
    var mA = 'D5:6 A4:2 D5:4 F#5:4 | E5:8 C#5:8 | D5:6 B4:2 D5:4 G5:4 | F#5:8 E5:4 D5:4 | D5:6 A4:2 D5:4 A5:4 | B5:8 F#5:4 D5:4 | G5:4 F#5:4 E5:4 C#5:4 | D5:16';
    var mB = 'F#5:6 E5:2 D5:4 B4:4 | D5:8 G5:8 | F#5:6 A5:2 D6:8 | C#6:8 A5:8 | D6:6 C#6:2 B5:4 F#5:4 | G5:8 B5:4 D6:4 | D6:6 Bb5:2 G5:4 A5:4 | F#5:12 .:4';
    var arps = function (ch) { return CP('0-1-2-3-2-1-2-1-', ch, 4); };
    return {
      bpm: 76, room: 0.26,
      inst: { p1: I('lead50', { v: 0.1, vib: 16 }), p2: I('arp', { v: 0.06 }), tr: 'bass', v1: I('vlead', { v: 0.12, echo: { steps: 3, v: 0.25 } }), v2: 'vpad', sw: I('sawP', { v: 0.045 }), sb: I('timp', { v: 0.35 }) },
      parts: {
        A: { v1: mA, p2: arps(chA), tr: CP('0-------2-------', chA, 2), v2: CP('1---------------', chA, 4) },
        B: { v1: mB, p2: arps(chB), tr: CP('0-------2-------', chB, 2), v2: CP('1---------------', chB, 4), sw: CP('0---------------', chB, 3),
          dm: RB(Dr('k?...............'), 8), nz: RB(Dr('........h?.......'), 8) },
        A2: { p1: mA, v1: HC(mA, chA, 16), p2: arps(chA), tr: CP('0-------2-------', chA, 2), v2: CP('1---------------', chA, 4), sw: CP('0---------------', chA, 3),
          dm: RB(Dr('k?.......k?.......'), 8), nz: RB(Dr('....h?.......h?...'), 8), sb: CP('0...............', chA, 2) },
        B2: { p1: mB, v1: HC(mB, chB, 16), p2: arps(chB), tr: CP('0-------2-------', chB, 2), v2: CP('1---------------', chB, 4), sw: CP('0---------------', chB, 3),
          dm: RB(Dr('k?.......s?.......'), 8), nz: B(Dr('c...h?.......h?...'), RB(Dr('....h?.......h?...'), 7)), sb: CP('0...............', chB, 2) }
      },
      seq: ['A', 'B', 'A2', 'B2']
    };
  });

  // CREDITS - upbeat roll: the Doomsday motif turned triumphant in D major, a bright G major chorus, slap bass, full band
  song('credits', function () {
    var chA = ['D', 'Bm', 'G', 'A', 'D', 'Bm', 'Em A', 'D'], chB = ['G', 'D', 'Em', 'C', 'G', 'D', 'C D', 'A7'];
    var mA = 'D5:3 A4 D5:2 F#5:4 E5:2 D5:2 C#5:2 | D5:6 B4:2 F#5:4 D5:4 | G5:3 D5 G5:2 B5:4 A5:2 G5:2 F#5:2 | E5:6 C#5:2 A4:4 E5:4 | ' +
             'D5:3 A4 D5:2 F#5:4 A5:2 B5:2 C#6:2 | D6:6 C#6:2 B5:4 F#5:4 | G5:3 F#5 E5:2 G5:2 C#6:4 E6:4 | D6:12 .:4';
    var mB = 'B5:2 A5:2 G5:2 D5:2 G5:4 B5:4 | A5:2 G5:2 F#5:2 D5:2 A5:8 | G5:2 F#5:2 E5:2 B4:2 E5:4 G5:4 | E5:6 D5:2 C5:8 | ' +
             'B5:2 C6:2 D6:2 B5:2 G5:4 D6:4 | F#6:6 E6:2 D6:8 | E6:4 C6:4 D6:4 A5:4 | G5:4 A5:4 C#6:4 E6:4';
    var dr = Dr('k...s..kk.k.s...'), fill = Dr('k...s..ks.s.ssss'), hat = Dr('h.hoh.hhh.hoh.hh');
    var slap = function (ch) { return CP('0..0..3.0.0..3.2', ch, 2); };
    return {
      bpm: 132, room: 0.15,
      inst: { p1: 'lead', p2: 'arp', tr: 'bass', v1: 'vlead', v2: 'vpad', sw: 'sawL', sb: 'slap' },
      parts: {
        A: { p1: mA, v1: T(mA, -12), p2: CP('0123432101234321', chA, 4), v2: CP('1---------------', chA, 4), tr: CP('0-------0-------', chA, 2), sb: slap(chA),
          dm: B(RB(dr, 7), fill), nz: hat },
        B: { sw: mB, v1: HC(mB, chB, 16), p2: CP('0123432101234321', chB, 4), v2: CP('1---------------', chB, 4), tr: CP('0-------0-------', chB, 2), sb: slap(chB),
          dm: B(RB(dr, 3), fill, RB(dr, 3), fill), nz: hat },
        A2: { p1: mA, v1: HC(mA, chA, 16), sw: '@sawB ' + T(mA, -12), p2: CP('3210321032103210', chA, 4), v2: CP('1---------------', chA, 4), tr: CP('0-------0-------', chA, 2),
          sb: slap(chA), dm: B(RB(dr, 7), fill), nz: hat },
        B2: { p1: mB, sw: T(mB, -12), v1: HC(mB, chB, 16), p2: CP('0123432101234321', chB, 4), v2: CP('1---------------', chB, 4), tr: CP('0-------0-------', chB, 2), sb: slap(chB),
          dm: B(RB(dr, 3), fill, RB(dr, 3), Dr('k.s.k.s.ssssS!S!S!S!')), nz: hat }
      },
      mix: { sw: 0.9 },
      seq: ['A', 'B', 'A2', 'B2']
    };
  });

  // Book 1 track names other modules may still ask for during the move to book 2 (resolved silently).
  var ALIAS = { safe: 'inn', boss_final: 'boss', floor1: 'ruins', floor2: 'ruins', floor3: 'circus', floor4: 'ruins', floor5: 'ruins_night',
    floor6: 'heather', floor7: 'dark', floor8: 'ruins_night', floor9: 'boss', floor10: 'heather', floor11: 'bigtop',
    ow3: 'village', ow4: 'village', ow5: 'village', ow6: 'village_night', ow7: 'village_night', ow8: 'village_night', ow9: 'settlement', ow10: 'settlement', ow11: 'circus' };
  /* ================================================================== SFX */
  var SFX = {
    jump: function (e, o, t, p) { return tone(e, o, t, { w: 'p25', f: 300 * p, f2: 760 * p, ft: 0.1, dur: 0.15, v: 0.3, sus: 0.3 }); },
    land: function (e, o, t, p) { noise(e, o, t, { hz: 3500 * p, dur: 0.05, v: 0.14 }); return tone(e, o, t, { w: 'tri', f: 140 * p, f2: 60, dur: 0.06, v: 0.3 }); },
    punch: function (e, o, t, p) {
      noise(e, o, t, { hz: 9000 * p, hz2: 1800, dur: 0.08, v: 0.34 });
      tone(e, o, t, { w: 'p50', f: 260 * p, f2: 70, dur: 0.08, v: 0.18 });
      return tone(e, o, t, { w: 'tri', f: 210 * p, f2: 50, dur: 0.09, v: 0.45 });
    },
    kick: function (e, o, t, p) {
      noise(e, o, t, { hz: 6500 * p, hz2: 900, dur: 0.13, v: 0.38 });
      tone(e, o, t, { w: 'p50', f: 190 * p, f2: 45, dur: 0.12, v: 0.2 });
      return tone(e, o, t, { w: 'tri', f: 170 * p, f2: 40, dur: 0.15, v: 0.55 });
    },
    hit: function (e, o, t, p) {
      noise(e, o, t, { hz: 30000 * p, hz2: 7000, dur: 0.07, v: 0.4 });
      return tone(e, o, t, { w: 'p12', f: 950 * p, f2: 240, dur: 0.08, v: 0.22 });
    },
    crit: function (e, o, t, p) {
      noise(e, o, t, { hz: 44000, hz2: 15000, dur: 0.1, v: 0.3 });
      tone(e, o, t, { w: 'p12', f: 1400 * p, f2: 2900 * p, dur: 0.07, v: 0.15 });
      tone(e, o, t, { w: 'tri', f: 320 * p, f2: 70, dur: 0.12, v: 0.45 });
      return run(e, o, t + 0.045, 'p25', [2093 * p, 3136 * p, 4186 * p], 0.035, 0.11, { tail: 0.08 });
    },
    enemy_die: function (e, o, t, p) {
      var f = [], i; for (i = 0; i < 9; i++) f.push(820 * p * Math.pow(0.78, i));
      noise(e, o, t, { hz: 6000, hz2: 700, dur: 0.32, v: 0.22 });
      return run(e, o, t, 'p50', f, 0.03, 0.18, { tail: 0.03, sus: 0.6 });
    },
    hurt: function (e, o, t, p) {
      noise(e, o, t, { hz: 3200, hz2: 1200, dur: 0.16, v: 0.24 });
      return tone(e, o, t, { w: 'p50', f: 560 * p, f2: 150 * p, dur: 0.3, v: 0.22, vib: 140, vibR: 28, sus: 0.3 });
    },
    coin: function (e, o, t, p) {
      tone(e, o, t, { w: 'p25', f: 988 * p, dur: 0.07, v: 0.26, sus: 0.95 });
      return tone(e, o, t + 0.07, { w: 'p25', f: 1319 * p, dur: 0.38, v: 0.26, sus: 0.25 });
    },
    pickup: function (e, o, t, p) { return run(e, o, t, 'p25', [1047 * p, 1319 * p, 1568 * p, 2093 * p], 0.04, 0.24, { tail: 0.08 }); },
    bomb_throw: function (e, o, t, p) {
      noise(e, o, t, { hz: 3000, hz2: 14000, dur: 0.17, v: 0.1, a: 0.04 });
      return tone(e, o, t, { w: 'p12', f: 280 * p, f2: 950 * p, dur: 0.17, v: 0.18 });
    },
    explosion: function (e, o, t, p) {
      noise(e, o, t, { hz: 30000, hz2: 9000, dur: 0.12, v: 0.3 });
      noise(e, o, t, { hz: 3800 * p, hz2: 220, dur: 1.1, v: 0.6, sus: 0.05 });
      noise(e, o, t + 0.02, { hz: 900, hz2: 120, dur: 0.9, v: 0.25, short: true });
      tone(e, o, t, { w: 'tri', f: 120 * p, f2: 28, dur: 0.6, v: 0.6 });
      return t + 1.1;
    },
    missile: function (e, o, t, p) {
      tone(e, o, t, { w: 'p12', f: 2600 * p, f2: 520 * p, dur: 0.15, v: 0.2 });
      run(e, o, t + 0.01, 'p25', [3200 * p, 2300 * p, 3600 * p, 2600 * p, 4100 * p, 3000 * p], 0.022, 0.09, { tail: 0.04 });
      return noise(e, o, t, { hz: 26000, dur: 0.07, v: 0.08, short: true });
    },
    bite: function (e, o, t, p) {
      noise(e, o, t, { hz: 15000 * p, dur: 0.035, v: 0.3 });
      noise(e, o, t + 0.07, { hz: 13000 * p, dur: 0.045, v: 0.3 });
      return tone(e, o, t, { w: 'p50', f: 340 * p, f2: 120, dur: 0.12, v: 0.17 });
    },
    shield: function (e, o, t, p) {
      noise(e, o, t, { hz: 18000, dur: 0.08, v: 0.08, short: true });
      tone(e, o, t, { w: 'p12', f: 990 * p, dur: 0.36, v: 0.09, vib: 60, vibR: 18, sus: 0.4 });
      return tone(e, o, t, { w: 'p25', f: 660 * p, dur: 0.36, v: 0.2, vib: 50, vibR: 18, sus: 0.4 });
    },
    menu_move: function (e, o, t, p) { return tone(e, o, t, { w: 'p25', f: 1200 * p, dur: 0.035, v: 0.15, sus: 0.6 }); },
    menu_select: function (e, o, t, p) {
      tone(e, o, t, { w: 'p25', f: 880 * p, dur: 0.05, v: 0.19, sus: 0.85 });
      return tone(e, o, t + 0.05, { w: 'p25', f: 1320 * p, dur: 0.12, v: 0.19, sus: 0.4 });
    },
    menu_back: function (e, o, t, p) {
      tone(e, o, t, { w: 'p25', f: 880 * p, dur: 0.05, v: 0.18, sus: 0.85 });
      return tone(e, o, t + 0.05, { w: 'p25', f: 587 * p, dur: 0.11, v: 0.18, sus: 0.4 });
    },
    lootbox_shake: function (e, o, t, p) {
      var end = t;
      for (var i = 0; i < 11; i++) {
        var tt = t + i * 0.04 + Math.random() * 0.012;
        noise(e, o, tt, { hz: (7000 + Math.random() * 14000) * p, dur: 0.028, v: 0.17, short: true });
        end = tone(e, o, tt, { w: 'p12', f: (140 + Math.random() * 180) * p, dur: 0.025, v: 0.07 });
      }
      return end;
    },
    lootbox_open: function (e, o, t, p) {
      noise(e, o, t, { hz: 22000, hz2: 6000, dur: 0.14, v: 0.28 });
      tone(e, o, t, { w: 'tri', f: 200, f2: 900, dur: 0.25, v: 0.3 });
      var cas = ['C8', 'A7', 'G7', 'E7', 'D7', 'C7', 'A6', 'G6', 'E6', 'G6', 'C7', 'E7', 'G7', 'C8'].map(function (n) { return nf(n) * p * 0.5; });
      run(e, o, t + 0.05, 'p12', cas, 0.04, 0.11, { tail: 0.15 });
      return run(e, o, t + 0.09, 'p25', cas, 0.04, 0.05, { tail: 0.2 });
    },
    unlock: function (e, o, t, p) {
      var s = 0.085;
      run(e, o, t, 'p25', ['G5', 'C6', 'E6', 'G6'].map(function (n) { return nf(n) * p; }), s, 0.15, { tail: 0.35 });
      run(e, o, t, 'p50', ['E5', 'G5', 'C6', 'E6'].map(function (n) { return nf(n) * p; }), s, 0.08, { tail: 0.35 });
      tone(e, o, t, { w: 'tri', f: nf('C3') * p, dur: 0.24, v: 0.35, sus: 0.8 });
      tone(e, o, t + 0.255, { w: 'tri', f: nf('C4') * p, dur: 0.4, v: 0.35, sus: 0.5 });
      noise(e, o, t + 0.255, { hz: 30000, dur: 0.5, v: 0.08 });
      return t + 0.7;
    },
    level_up: function (e, o, t, p) {
      var sc = ['C5', 'D5', 'E5', 'G5', 'A5', 'C6', 'D6', 'E6', 'G6', 'C7'].map(function (n) { return nf(n) * p; });
      run(e, o, t, 'p25', sc, 0.035, 0.13, { tail: 0 });
      var t2 = t + sc.length * 0.035, ch = [], f0 = nf('C6') * p, k;
      for (k = 0; k < 30; k++) ch.push([k / 60, f0 * Math.pow(2, [0, 4, 7, 12][k % 4] / 12)]);
      tone(e, o, t2, { w: 'p12', f: f0, steps: ch, dur: 0.5, v: 0.13, sus: 0.5 });
      tone(e, o, t2, { w: 'p50', f: nf('G5') * p, dur: 0.5, v: 0.08, sus: 0.5, vib: 25, vibR: 7 });
      tone(e, o, t2, { w: 'tri', f: nf('C4') * p, dur: 0.5, v: 0.35, sus: 0.5 });
      return t2 + 0.5;
    },
    door: function (e, o, t, p) {
      tone(e, o, t, { w: 'tri', f: 120 * p, f2: 70, dur: 0.14, v: 0.45 });
      noise(e, o, t, { hz: 1600, hz2: 700, dur: 0.16, v: 0.2 });
      return tone(e, o, t + 0.05, { w: 'p12', f: 180 * p, steps: [[0.05, 230 * p], [0.1, 200 * p], [0.15, 250 * p], [0.2, 210 * p]], dur: 0.27, v: 0.05, sus: 0.6 });
    },
    boss_roar: function (e, o, t, p) {
      noise(e, o, t, { hz: 3000 * p, hz2: 700, dur: 1.35, v: 0.45, a: 0.06, sus: 0.3, trem: { rate: 23, depth: 0.7 } });
      noise(e, o, t, { hz: 6000, hz2: 2000, dur: 1.0, v: 0.08, short: true, a: 0.05 });
      tone(e, o, t, { w: 'p50', f: 150 * p, f2: 70 * p, dur: 1.35, v: 0.2, vib: 160, vibR: 9, sus: 0.3, a: 0.05 });
      return tone(e, o, t, { w: 'p25', f: 100 * p, f2: 55 * p, dur: 1.35, v: 0.14, vib: 220, vibR: 11, sus: 0.3, a: 0.05 });
    },
    boss_die: function (e, o, t, p) {
      [0, 0.28, 0.55, 0.9, 1.3].forEach(function (d, i) {
        noise(e, o, t + d, { hz: (3600 - i * 400) * p, hz2: 200, dur: 0.7, v: 0.42 });
        tone(e, o, t + d, { w: 'tri', f: 110 - i * 8, f2: 30, dur: 0.45, v: 0.45 });
      });
      var f = [], i; for (i = 0; i < 40; i++) f.push(900 * p * Math.pow(0.94, i) * (i % 2 ? 1.06 : 1));
      run(e, o, t, 'p50', f, 0.045, 0.15, { tail: 0.2, sus: 0.7 });
      return t + 2.1;
    },
    achievement: function (e, o, t, p) {
      function ding(tt, f) {
        tone(e, o, tt, { w: 'p12', f: f, dur: 0.6, v: 0.22, a: 0.001 });
        tone(e, o, tt, { w: 'p25', f: f * 2, dur: 0.25, v: 0.06, a: 0.001 });
        tone(e, o, tt, { w: 'tri', f: f / 2, dur: 0.2, v: 0.2 });
      }
      ding(t, 1568 * p); ding(t + 0.16, 2093 * p);
      run(e, o, t + 0.34, 'p12', [nf('E7') * p, nf('G7') * p, nf('C8') * p], 0.03, 0.04, { tail: 0.1 });
      return t + 0.8;
    },
    stairs: function (e, o, t, p) {
      var sc = ['C6', 'B5', 'A5', 'G5', 'F5', 'E5', 'D5', 'C5'];
      for (var i = 0; i < sc.length; i++) {
        tone(e, o, t + i * 0.065, { w: 'p25', f: nf(sc[i]) * p, dur: 0.06, v: 0.13, sus: 0.5 });
        noise(e, o, t + i * 0.065, { hz: 5000, dur: 0.03, v: 0.1 });
      }
      return t + sc.length * 0.065 + 0.05;
    },
    death: function (e, o, t, p) {
      noise(e, o, t, { hz: 2400, hz2: 180, dur: 1.0, v: 0.22 });
      var f = [], i; for (i = 0; i < 24; i++) f.push(720 * p * Math.pow(0.9, i) * (i % 2 ? 0.93 : 1));
      run(e, o, t, 'p50', f, 0.045, 0.2, { tail: 0.1, sus: 0.7, vib: 60, vibR: 12 });
      return tone(e, o, t + 1.05, { w: 'tri', f: 65, f2: 40, dur: 0.5, v: 0.45 });
    },
    heal: function (e, o, t, p) {
      var sc = ['C5', 'E5', 'G5', 'C6', 'E6', 'G6'].map(function (n) { return nf(n) * p; });
      run(e, o, t, 'p12', sc, 0.05, 0.2, { tail: 0.12, vib: 25, vibR: 10 });
      return run(e, o, t + 0.08, 'p12', sc, 0.05, 0.08, { tail: 0.15 });
    },
    block: function (e, o, t, p) {
      noise(e, o, t, { hz: 26000, dur: 0.12, v: 0.3, short: true });
      tone(e, o, t, { w: 'p12', f: 2200 * p, dur: 0.16, v: 0.16 });
      return tone(e, o, t, { w: 'p25', f: 1650 * p, dur: 0.11, v: 0.1 });
    },
    buy: function (e, o, t, p) {
      tone(e, o, t, { w: 'p25', f: 1319 * p, dur: 0.05, v: 0.2, sus: 0.9 });
      tone(e, o, t + 0.05, { w: 'p25', f: 1760 * p, dur: 0.05, v: 0.2, sus: 0.9 });
      noise(e, o, t + 0.1, { hz: 22000, dur: 0.06, v: 0.14, short: true });
      return tone(e, o, t + 0.1, { w: 'p25', f: 2637 * p, dur: 0.3, v: 0.2, sus: 0.2 });
    },
    error: function (e, o, t, p) {
      tone(e, o, t, { w: 'p50', f: 155 * p, dur: 0.1, v: 0.17, sus: 0.9 });
      tone(e, o, t, { w: 'p25', f: 147 * p, dur: 0.1, v: 0.1, sus: 0.9 });
      tone(e, o, t + 0.13, { w: 'p50', f: 155 * p, dur: 0.15, v: 0.17, sus: 0.9 });
      return tone(e, o, t + 0.13, { w: 'p25', f: 147 * p, dur: 0.15, v: 0.1, sus: 0.9 });
    },
    text_blip: function (e, o, t, p) { return tone(e, o, t, { w: 'p12', f: (640 + Math.random() * 70) * p, dur: 0.022, v: 0.06, sus: 0.5 }); },
    pause: function (e, o, t, p) { return run(e, o, t, 'p25', [1319 * p, 1047 * p, 1319 * p, 1047 * p], 0.055, 0.18, { tail: 0.08 }); },
    checkpoint: function (e, o, t, p) {
      tone(e, o, t, { w: 'tri', f: nf('G4') * p, dur: 0.25, v: 0.3, sus: 0.5 });
      return run(e, o, t, 'p25', [nf('G5') * p, nf('D6') * p, nf('G6') * p], 0.06, 0.2, { tail: 0.22 });
    },
    crate_break: function (e, o, t, p) {
      noise(e, o, t, { hz: 11000 * p, hz2: 2500, dur: 0.2, v: 0.34 });
      noise(e, o, t + 0.02, { hz: 12000, dur: 0.1, v: 0.1, short: true });
      return run(e, o, t + 0.03, 'p12', [420 * p, 300 * p, 520 * p, 260 * p, 380 * p], 0.03, 0.07, { tail: 0.02 });
    },
    spawn: function (e, o, t, p) {
      tone(e, o, t + 0.05, { w: 'p25', f: 300 * p, f2: 1200 * p, dur: 0.25, v: 0.06 });
      return tone(e, o, t, { w: 'p12', f: 200 * p, f2: 900 * p, dur: 0.32, v: 0.18, vib: 90, vibR: 20, sus: 0.4 });
    },
    laser: function (e, o, t, p) {
      for (var i = 0; i < 3; i++) tone(e, o, t + i * 0.09, { w: 'p12', f: 2800 * p, f2: 700 * p, dur: 0.09, v: 0.19, sus: 0.5 });
      return tone(e, o, t, { w: 'p25', f: 1400 * p, f2: 350 * p, dur: 0.3, v: 0.06, sus: 0.6 });
    },
    warn: function (e, o, t, p) {
      for (var i = 0; i < 4; i++) tone(e, o, t + i * 0.1, { w: 'p50', f: (i % 2 ? 660 : 880) * p, dur: 0.095, v: 0.2, sus: 0.9 });
      return t + 0.4;
    },
    stomp: function (e, o, t, p) {
      noise(e, o, t, { hz: 5000 * p, hz2: 800, dur: 0.1, v: 0.34 });
      tone(e, o, t, { w: 'tri', f: 220 * p, f2: 55, dur: 0.13, v: 0.5 });
      return tone(e, o, t + 0.03, { w: 'p25', f: 400 * p, f2: 950 * p, dur: 0.09, v: 0.12 });
    },
    splash: function (e, o, t, p) {
      noise(e, o, t, { hz: 9000 * p, hz2: 2200, dur: 0.42, v: 0.28, a: 0.01 });
      for (var i = 0; i < 4; i++) tone(e, o, t + 0.05 + i * 0.06 + Math.random() * 0.02, { w: 'p12', f: (600 + Math.random() * 800) * p, f2: (1000 + Math.random() * 900) * p, dur: 0.04, v: 0.06 });
      return t + 0.42;
    },
    fanfare: function (e, o, t, p) {
      var s = 0.1, mel = [['G5', 1], ['G5', 1], ['G5', 1], ['C6', 3], ['A5', 1.5], ['C6', 4]], har = ['E5', 'E5', 'E5', 'G5', 'F5', 'E5'],
          bas = ['C3', 'C3', 'C3', 'C3', 'F2', 'C3'], tt = t, i;
      for (i = 0; i < mel.length; i++) {
        var d = mel[i][1] * s, last = i === mel.length - 1;
        tone(e, o, tt, { w: 'p25', f: nf(mel[i][0]) * p, dur: d * (last ? 1 : 0.92), v: 0.16, sus: last ? 0.4 : 0.8, vib: last ? 18 : 0, vibR: 6 });
        tone(e, o, tt, { w: 'p50', f: nf(har[i]) * p, dur: d * (last ? 1 : 0.92), v: 0.08, sus: last ? 0.4 : 0.8 });
        tone(e, o, tt, { w: 'tri', f: nf(bas[i]) * p, dur: d * 0.9, v: 0.32, sus: 0.8 });
        if (i === 3 || last) noise(e, o, tt, { hz: 30000, hz2: 16000, dur: last ? 0.7 : 0.3, v: 0.12 });
        else noise(e, o, tt, { hz: 13000, dur: 0.08, v: 0.12 });
        tt += d;
      }
      return tt;
    },
    views: function (e, o, t, p) { // crowd cheer swell
      var bands = [[650, 0.22, 7], [1300, 0.18, 11], [2500, 0.12, 9]];
      bands.forEach(function (b) {
        noise(e, o, t, { hz: 42000, dur: 1.5, v: b[1], a: 0.38, sus: 0.15, filter: { type: 'bandpass', f: b[0], q: 1.4 }, trem: { rate: b[2], depth: 0.5, type: 'sine' } });
      });
      tone(e, o, t + 0.2, { w: 'p12', f: 1300 * p, f2: 2100 * p, dur: 0.3, v: 0.04, a: 0.05 });
      tone(e, o, t + 0.45, { w: 'p12', f: 1500 * p, f2: 2400 * p, dur: 0.28, v: 0.035, a: 0.05 });
      return t + 1.5;
    },
    engine: function (e, o, t, p) { // short rev: stepped pitch rise + sag, putt-putt noise; soft ends so ~0.4s retriggers overlap cleanly
      var d = 0.4, st = [], k;
      for (k = 0; k < 20; k++) { var x = k / 20; st.push([x * d, (x < 0.65 ? 60 + 46 * (x / 0.65) : 106 - 18 * ((x - 0.65) / 0.35)) * p]); }
      tone(e, o, t, { w: 'p25', f: st[0][1], steps: st, dur: d, v: 0.11, a: 0.02, sus: 0.65 });
      tone(e, o, t, { w: 'tri', f: st[0][1], steps: st, dur: d, v: 0.22, a: 0.02, sus: 0.65 });
      noise(e, o, t, { hz: 2200 * p, hz2: 3600 * p, ft: 0.26, dur: d, v: 0.09, a: 0.02, sus: 0.6, short: true, trem: { rate: 26 * p, depth: 0.85 } });
      return t + d;
    },
    boost: function (e, o, t, p) {
      noise(e, o, t, { hz: 6000 * p, hz2: 40000, dur: 0.62, v: 0.34, a: 0.06, sus: 0.35, filter: { type: 'bandpass', f: 700, f2: 6500, q: 0.8 } });
      tone(e, o, t, { w: 'p25', f: 220 * p, f2: 1760 * p, ft: 0.45, dur: 0.58, v: 0.15, vib: 40, vibR: 16, sus: 0.5 });
      tone(e, o, t + 0.04, { w: 'p12', f: 440 * p, f2: 3520 * p, ft: 0.45, dur: 0.5, v: 0.06, sus: 0.4 });
      tone(e, o, t, { w: 'tri', f: 110 * p, f2: 440 * p, dur: 0.4, v: 0.3, sus: 0.5 });
      return t + 0.62;
    },
    horn: function (e, o, t, p) { // comic two-tone truck horn: "hon-HONK" (slightly sour pairs, last note sags)
      function honk(tt, f1, f2, d, sag) {
        tone(e, o, tt, { w: 'p50', f: f1 * p, steps: [[0.025, f1 * 1.03 * p], [d * 0.7, f1 * sag * p]], dur: d, v: 0.16, a: 0.01, sus: 0.85 });
        tone(e, o, tt, { w: 'p25', f: f2 * p, steps: [[0.025, f2 * 1.03 * p], [d * 0.7, f2 * sag * p]], dur: d, v: 0.12, a: 0.01, sus: 0.85 });
        tone(e, o, tt, { w: 'tri', f: f1 * 0.5 * p, dur: d, v: 0.28, a: 0.01, sus: 0.85 });
      }
      honk(t, 302, 362, 0.15, 1.03);
      honk(t + 0.19, 404, 482, 0.36, 0.95);
      return t + 0.55;
    },
    countdown: function (e, o, t, p) {
      tone(e, o, t, { w: 'p50', f: 880 * p, dur: 0.2, v: 0.2, a: 0.003, sus: 0.85 });
      tone(e, o, t, { w: 'p25', f: 440 * p, dur: 0.2, v: 0.08, a: 0.003, sus: 0.85 });
      return t + 0.2;
    },
    go: function (e, o, t, p) {
      tone(e, o, t, { w: 'p50', f: 1760 * p, dur: 0.6, v: 0.19, a: 0.003, sus: 0.8, vib: 12, vibR: 9 });
      tone(e, o, t, { w: 'p25', f: 880 * p, dur: 0.6, v: 0.1, a: 0.003, sus: 0.8 });
      tone(e, o, t, { w: 'tri', f: 440 * p, dur: 0.5, v: 0.25, sus: 0.7 });
      noise(e, o, t, { hz: 30000, hz2: 16000, dur: 0.25, v: 0.06 });
      return t + 0.6;
    },
    skid: function (e, o, t, p) {
      noise(e, o, t, { hz: 17000 * p, hz2: 11000 * p, dur: 0.55, v: 0.24, a: 0.015, sus: 0.6, short: true, filter: { type: 'bandpass', f: 2600, f2: 1700, q: 1.6 } });
      noise(e, o, t, { hz: 30000, hz2: 14000, dur: 0.5, v: 0.12, a: 0.015, sus: 0.5, filter: { type: 'highpass', f: 2500 } });
      return tone(e, o, t, { w: 'p12', f: 1900 * p, f2: 1350 * p, dur: 0.55, v: 0.08, a: 0.015, vib: 90, vibR: 23, sus: 0.6 });
    },
    crash: function (e, o, t, p) { // heavy crunch + metal clang + tumbling debris
      noise(e, o, t, { hz: 20000 * p, hz2: 3000, dur: 0.25, v: 0.45 });
      noise(e, o, t, { hz: 2600 * p, hz2: 260, dur: 0.6, v: 0.45, sus: 0.1 });
      noise(e, o, t + 0.01, { hz: 9000 * p, hz2: 5000, dur: 0.22, v: 0.14, short: true });
      tone(e, o, t, { w: 'tri', f: 140 * p, f2: 35, dur: 0.35, v: 0.6 });
      tone(e, o, t, { w: 'p50', f: 210 * p, f2: 60, dur: 0.15, v: 0.17 });
      for (var i = 0; i < 10; i++) {
        var tt = t + 0.13 + i * 0.065 + Math.random() * 0.03, fade = 1 - i / 12;
        noise(e, o, tt, { hz: (5000 + Math.random() * 15000) * p, dur: 0.03, v: 0.15 * fade, short: true });
        tone(e, o, tt, { w: 'p12', f: (280 + Math.random() * 700) * p, dur: 0.026, v: 0.055 * fade });
      }
      return t + 0.85;
    }
  };

  /* ---------------------------------------------------------------- book 2 SFX */
  function bellStrike(e, o, t, f, v, dec) { // inharmonic bell partials
    [[1, 1, 'tri'], [2, 0.5, 'q2'], [2.4, 0.35, 'q1'], [3, 0.25, 'q1'], [4.2, 0.18, 'q1'], [5.4, 0.1, 'q1']].forEach(function (pt, i) {
      tone(e, o, t, { w: pt[2], f: f * pt[0], dur: dec * (1 - i * 0.12), v: v * pt[1] * (pt[2] === 'tri' ? 1.6 : 1), a: 0.001 });
    });
    tone(e, o, t, { w: 'q8', f: f * 1.003, dur: dec, v: v * 0.35, a: 0.001, vib: 6, vibR: 3 });
    noise(e, o, t, { hz: 30000, dur: 0.03, v: v * 0.6 });
  }
  assign(SFX, {
    plant: function (e, o, t, p) { // dynamite set down, then two arming chirps
      noise(e, o, t, { hz: 3000 * p, hz2: 900, dur: 0.07, v: 0.22 });
      tone(e, o, t, { w: 'tri', f: 160 * p, f2: 70, dur: 0.08, v: 0.4 });
      tone(e, o, t + 0.12, { w: 'q2', f: 1760 * p, dur: 0.05, v: 0.13, sus: 0.9 });
      return tone(e, o, t + 0.2, { w: 'q2', f: 2349 * p, dur: 0.08, v: 0.13, sus: 0.9 });
    },
    detonate: function (e, o, t, p) { // detonator click + beep, then a big DPCM-backed blast with debris
      tone(e, o, t, { w: 'p50', f: 2000 * p, dur: 0.03, v: 0.12 });
      tone(e, o, t + 0.04, { w: 'p25', f: 1500 * p, dur: 0.08, v: 0.12, sus: 0.9 });
      var tb = t + 0.14, i;
      samp(e, o, tb, 'kick', { rate: 0.55 * p, v: 0.85 });
      samp(e, o, tb + 0.01, 'timp', { rate: 0.5 * p, v: 0.55 });
      noise(e, o, tb, { hz: 30000, hz2: 8000, dur: 0.15, v: 0.32 });
      noise(e, o, tb, { hz: 3500 * p, hz2: 160, dur: 1.5, v: 0.6, sus: 0.08 });
      noise(e, o, tb + 0.03, { hz: 800, hz2: 100, dur: 1.2, v: 0.28, short: true });
      tone(e, o, tb, { w: 'tri', f: 110 * p, f2: 25, dur: 0.8, v: 0.6 });
      for (i = 0; i < 8; i++) noise(e, o, tb + 0.25 + i * 0.09 + Math.random() * 0.04, { hz: (4000 + Math.random() * 12000) * p, dur: 0.03, v: 0.12 * (1 - i / 10), short: true });
      return tb + 1.5;
    },
    fuse: function (e, o, t, p) { // sizzling lit fuse
      noise(e, o, t, { hz: 20000 * p, dur: 0.7, v: 0.13, a: 0.02, sus: 0.8, trem: { rate: 31, depth: 0.8 }, filter: { type: 'highpass', f: 3000 } });
      for (var i = 0; i < 9; i++) noise(e, o, t + Math.random() * 0.65, { hz: 9000 + Math.random() * 20000, dur: 0.015, v: 0.12, short: true });
      return t + 0.7;
    },
    fire_burst: function (e, o, t, p) { // whoomp of flame (Jug O'Boom, flaming skull)
      noise(e, o, t, { hz: 2500 * p, hz2: 9000 * p, ft: 0.18, dur: 0.75, v: 0.42, a: 0.03, sus: 0.2, filter: { type: 'bandpass', f: 500, f2: 2600, q: 0.7 } });
      noise(e, o, t, { hz: 1200, hz2: 300, dur: 0.6, v: 0.25, short: true });
      tone(e, o, t, { w: 'tri', f: 90 * p, f2: 45, dur: 0.4, v: 0.45 });
      for (var i = 0; i < 6; i++) noise(e, o, t + 0.15 + Math.random() * 0.5, { hz: 15000 + Math.random() * 15000, dur: 0.02, v: 0.1, short: true });
      return t + 0.75;
    },
    launch: function (e, o, t, p) { // xistera fling: thwip + rising tone
      noise(e, o, t, { hz: 2000 * p, hz2: 14000 * p, dur: 0.16, v: 0.24, a: 0.01, filter: { type: 'bandpass', f: 1200, f2: 5000, q: 1 } });
      tone(e, o, t, { w: 'q3', f: 380 * p, f2: 1500 * p, dur: 0.14, v: 0.16 });
      return tone(e, o, t, { w: 'tri', f: 150 * p, f2: 60, dur: 0.08, v: 0.35 });
    },
    smoke_puff: function (e, o, t, p) {
      noise(e, o, t, { hz: 2500 * p, hz2: 700, dur: 0.38, v: 0.3, a: 0.02, filter: { type: 'lowpass', f: 1600, f2: 500 } });
      return tone(e, o, t, { w: 'tri', f: 95 * p, f2: 55, dur: 0.2, v: 0.25 });
    },
    fear: function (e, o, t, p) { // Carl's Fear spell: sour falling cluster under a reverse swell
      noise(e, o, t, { hz: 6000, hz2: 1500, dur: 0.6, v: 0.12, a: 0.45, filter: { type: 'bandpass', f: 900, q: 1.5 } });
      [1, 1.06, 1.414].forEach(function (k, i) {
        tone(e, o, t + 0.05, { w: i ? 'q2' : 'q4', f: 620 * k * p, f2: 240 * k * p, ft: 0.8, dur: 0.85, v: 0.1, a: 0.04, sus: 0.4, vib: 45, vibR: 7 + i });
      });
      return tone(e, o, t + 0.05, { w: 'tri', f: 110 * p, f2: 55, dur: 0.85, v: 0.3, sus: 0.5 });
    },
    clockwork: function (e, o, t, p) { // wind-up key ratchet, tick-tock, spring boing (Clockwork Triplicate)
      for (var i = 0; i < 7; i++) noise(e, o, t + i * (0.07 - i * 0.006), { hz: 14000 * p, dur: 0.018, v: 0.17, short: true });
      tone(e, o, t + 0.42, { w: 'q2', f: 1900 * p, dur: 0.03, v: 0.12 });
      tone(e, o, t + 0.52, { w: 'q2', f: 1400 * p, dur: 0.03, v: 0.12 });
      return tone(e, o, t + 0.6, { w: 'tri', f: 300 * p, f2: 520 * p, dur: 0.32, v: 0.3, vib: 220, vibR: 18, sus: 0.3 });
    },
    teleport: function (e, o, t, p) { // Puddle Jumper: sparkle up, pop, shimmer down
      var up = [], dn = [], i;
      for (i = 0; i < 10; i++) up.push(500 * p * Math.pow(1.19, i));
      for (i = 0; i < 8; i++) dn.push(3000 * p * Math.pow(0.85, i));
      run(e, o, t, 'q1', up, 0.025, 0.15, { tail: 0.02, vib: 40, vibR: 20 });
      run(e, o, t + 0.01, 'q5', up.map(function (f) { return f * 0.5; }), 0.025, 0.06);
      noise(e, o, t + 0.25, { hz: 30000, dur: 0.06, v: 0.2 });
      run(e, o, t + 0.28, 'q2', dn, 0.03, 0.08, { tail: 0.1 });
      return t + 0.62;
    },
    krasue_shriek: function (e, o, t, p) {
      samp(e, o, t, 'shriek', { rate: 1.05 * p, v: 0.7 });
      tone(e, o, t, { w: 'q1', f: 1400 * p, f2: 1900 * p, ft: 0.3, dur: 0.7, v: 0.07, vib: 70, vibR: 19, sus: 0.6 });
      noise(e, o, t, { hz: 20000, dur: 0.6, v: 0.08, a: 0.05, filter: { type: 'bandpass', f: 3000, q: 2 } });
      return t + 0.85;
    },
    urchin_roll: function (e, o, t, p) { // spiky tumbleweed rattling along
      noise(e, o, t, { hz: 9000 * p, dur: 0.55, v: 0.2, a: 0.04, sus: 0.6, short: true, trem: { rate: 19 * p, depth: 0.9 } });
      tone(e, o, t, { w: 'tri', f: 70 * p, dur: 0.5, v: 0.2, a: 0.04, sus: 0.6, vib: 80, vibR: 19 });
      for (var i = 0; i < 6; i++) noise(e, o, t + i * 0.08 + Math.random() * 0.03, { hz: 18000 + Math.random() * 14000, dur: 0.012, v: 0.1, short: true });
      return t + 0.55;
    },
    psionic: function (e, o, t, p) { // Brain Boiler psionic pulse: warbling ring-mod rise
      tone(e, o, t, { w: 'q8', f: 300 * p, f2: 900 * p, dur: 0.6, v: 0.15, vib: 260, vibR: 31, sus: 0.6 });
      tone(e, o, t, { w: 'q3', f: 450 * p, f2: 1350 * p, dur: 0.6, v: 0.08, vib: 300, vibR: 23, sus: 0.6 });
      return tone(e, o, t, { w: 'tri', f: 150 * p, f2: 75 * p, dur: 0.6, v: 0.22, vib: 150, vibR: 13, sus: 0.6 });
    },
    guard_alarm: function (e, o, t, p) { // village guard klaxon
      for (var i = 0; i < 4; i++) {
        var f = (i % 2 ? 392 : 523) * p;
        tone(e, o, t + i * 0.24, { w: 'saw', f: f, dur: 0.22, v: 0.16, a: 0.01, sus: 0.85 });
        tone(e, o, t + i * 0.24, { w: 'q4', f: f * 1.5, dur: 0.22, v: 0.08, a: 0.01, sus: 0.85 });
      }
      return t + 0.96;
    },
    crime: function (e, o, t, p) { // guard law stinger: two low tritone hits
      samp(e, o, t, 'ostab', { rate: 0.6 * p, v: 0.55 });
      samp(e, o, t, 'timp', { rate: 0.8 * p, v: 0.45 });
      tone(e, o, t, { w: 'saw', f: nf('Eb2') * p, dur: 0.3, v: 0.16, sus: 0.6 });
      samp(e, o, t + 0.38, 'ostab', { rate: 0.85 * p, v: 0.6 });
      samp(e, o, t + 0.38, 'timp', { rate: 0.57 * p, v: 0.5 });
      tone(e, o, t + 0.38, { w: 'saw', f: nf('A1') * p, dur: 0.6, v: 0.18, sus: 0.5 });
      return t + 1.0;
    },
    bell_day: function (e, o, t, p) { // dawn: bright town bell, three strikes
      bellStrike(e, o, t, nf('E6') * p, 0.12, 1.2); bellStrike(e, o, t + 0.32, nf('C6') * p, 0.12, 1.2); bellStrike(e, o, t + 0.64, nf('G5') * p, 0.13, 1.4);
      return t + 2.0;
    },
    bell_night: function (e, o, t, p) { // nightfall: deep toll, twice
      bellStrike(e, o, t, nf('A3') * p, 0.2, 2.0); tone(e, o, t, { w: 'tri', f: nf('A2') * p, dur: 1.8, v: 0.3, vib: 5, vibR: 1.5 });
      bellStrike(e, o, t + 1.1, nf('A3') * p * 0.998, 0.16, 2.0); tone(e, o, t + 1.1, { w: 'tri', f: nf('A2') * p, dur: 1.8, v: 0.26 });
      return t + 3.0;
    },
    applause: function (e, o, t, p) {
      samp(e, o, t, 'cheer', { v: 0.32, rate: p });
      for (var i = 0; i < 46; i++) {
        var tt = t + Math.random() * 1.8, env = Math.min(1, (tt - t) / 0.3) * Math.max(0.15, 1 - (tt - t) / 2.0);
        noise(e, o, tt, { hz: (9000 + Math.random() * 16000) * p, dur: 0.018, v: 0.17 * env, filter: { type: 'bandpass', f: 1100 + Math.random() * 1400, q: 0.7 } });
      }
      return t + 2.0;
    },
    laugh: function (e, o, t, p) { var v = samp(e, o, t, 'laugh', { v: 0.85, rate: p }); return v.end; },
    boo: function (e, o, t, p) { var v = samp(e, o, t, 'boo', { v: 0.85, rate: p }); return v.end; },
    meter: function (e, o, t, p) { // views meter tick up
      tone(e, o, t, { w: 'q4', f: 880 * p, f2: 1320 * p, ft: 0.05, dur: 0.07, v: 0.13, sus: 0.6 });
      return noise(e, o, t, { hz: 30000, dur: 0.02, v: 0.06, short: true });
    },
    burst: function (e, o, t, p) { // precursor magic burst: suck-in swell, whoomp, shattering shimmer
      noise(e, o, t, { hz: 3000, hz2: 20000, dur: 0.3, v: 0.2, a: 0.27, filter: { type: 'bandpass', f: 600, f2: 4000, q: 1 } });
      var tb = t + 0.3, dn = [], i;
      samp(e, o, tb, 'kick', { rate: 0.5 * p, v: 0.8 });
      noise(e, o, tb, { hz: 4000 * p, hz2: 200, dur: 0.9, v: 0.42, sus: 0.05 });
      tone(e, o, tb, { w: 'saw', f: 220 * p, f2: 55, dur: 0.5, v: 0.18 });
      for (i = 0; i < 14; i++) dn.push(4000 * p * Math.pow(0.88, i) * (i % 2 ? 1.12 : 1));
      run(e, o, tb + 0.05, 'q1', dn, 0.035, 0.1, { tail: 0.2 });
      for (i = 0; i < 6; i++) tone(e, o, tb + 0.1 + Math.random() * 0.5, { w: 'q1', f: 3000 + Math.random() * 3000, dur: 0.05, v: 0.06 });
      return tb + 0.95;
    },
    glass_crack: function (e, o, t, p) { // the Glass: tink, spidering crackle, groan
      tone(e, o, t, { w: 'q1', f: 4200 * p, dur: 0.25, v: 0.13, a: 0.001 });
      tone(e, o, t, { w: 'q2', f: 3100 * p, dur: 0.18, v: 0.08, a: 0.001 });
      for (var i = 0; i < 10; i++) noise(e, o, t + 0.05 + i * (0.05 - i * 0.003) + Math.random() * 0.01, { hz: (12000 + Math.random() * 20000) * p, dur: 0.014, v: 0.16, short: true });
      return tone(e, o, t + 0.1, { w: 'saw', f: 120 * p, f2: 90 * p, dur: 0.45, v: 0.07, vib: 40, vibR: 9 });
    },
    countdown_tick: function (e, o, t, p) {
      noise(e, o, t, { hz: 9000 * p, dur: 0.02, v: 0.22, short: true });
      return tone(e, o, t, { w: 'q2', f: 2400 * p, dur: 0.035, v: 0.12 });
    },
    skate_roll: function (e, o, t, p) { // Heather's roller skates: wheel rumble with clicks
      noise(e, o, t, { hz: 1500 * p, dur: 0.6, v: 0.3, a: 0.05, sus: 0.7, filter: { type: 'bandpass', f: 420 * p, q: 1.2 }, trem: { rate: 14 * p, depth: 0.6, type: 'sine' } });
      tone(e, o, t, { w: 'tri', f: 62 * p, dur: 0.6, v: 0.18, a: 0.05, sus: 0.7 });
      for (var i = 0; i < 8; i++) noise(e, o, t + i * 0.07, { hz: 20000, dur: 0.01, v: 0.07, short: true });
      return t + 0.6;
    },
    calliope_stab: function (e, o, t, p) { // circus organ sting, slightly sour
      ['A4', 'C5', 'E5', 'Eb6'].forEach(function (n, i) {
        tone(e, o, t, { w: i === 3 ? 'q2' : 'p50', f: nf(n) * p, dur: 0.55, v: 0.09, a: 0.004, sus: 0.5, vib: 30, vibR: 6 });
        tone(e, o, t, { w: 'q4', f: nf(n) * p * 1.012, dur: 0.55, v: 0.05, a: 0.004, sus: 0.5 });
      });
      tone(e, o, t, { w: 'tri', f: nf('A2') * p, dur: 0.4, v: 0.3 });
      noise(e, o, t, { hz: 30000, dur: 0.05, v: 0.1 });
      return t + 0.55;
    },
    worm_squish: function (e, o, t, p) {
      noise(e, o, t, { hz: 5000 * p, hz2: 1200, dur: 0.22, v: 0.3, filter: { type: 'bandpass', f: 700, f2: 1600, q: 3 }, trem: { rate: 28, depth: 0.7, type: 'sine' } });
      return tone(e, o, t, { w: 'q8', f: 220 * p, f2: 90 * p, dur: 0.22, v: 0.14, vib: 120, vibR: 25 });
    },
    ticket_scratch: function (e, o, t, p) { // scratch-off ticket: scr-scr-scraaatch
      var at = [0, 0.09, 0.18, 0.3], dur = [0.06, 0.06, 0.08, 0.2];
      for (var i = 0; i < at.length; i++) noise(e, o, t + at[i], { hz: (14000 + i * 2000) * p, hz2: 9000 * p, dur: dur[i], v: 0.22, a: 0.01, filter: { type: 'bandpass', f: 3800, q: 1.5 } });
      return t + 0.5;
    },
    drunk_hiccup: function (e, o, t, p) { // "hic!"
      noise(e, o, t, { hz: 6000, dur: 0.03, v: 0.1 });
      tone(e, o, t + 0.01, { w: 'q8', f: 240 * p, f2: 620 * p, ft: 0.05, dur: 0.08, v: 0.2, sus: 0.8 });
      tone(e, o, t + 0.01, { w: 'q2', f: 480 * p, f2: 1240 * p, ft: 0.05, dur: 0.08, v: 0.08, sus: 0.8 });
      return t + 0.12;
    }
  });
  var DUCK = { fanfare: 1, unlock: 1, level_up: 1, achievement: 1, boss_die: 1, detonate: 1, burst: 1, crime: 1, bell_day: 1, bell_night: 1, applause: 1 };

  /* ================================================================== live state + API */
  var ctx = null, E = null, unlocked = false, inited = false, timer = null;
  var cur = null, fadingOut = [], voices = [], lastPlay = {}, compiled = {}, warned = {};
  var MAX_VOICES = 16, LOOKAHEAD = 0.18;

  function getSong(name) { if (!compiled[name]) compiled[name] = compileSong(name, SONGS[name]); return compiled[name]; }
  function warnOnce(k, msg) { if (!warned[k]) { warned[k] = 1; try { console.warn('[audio] ' + msg); } catch (e) { /* ignore */ } } }
  function volCurve(v) { v = Math.max(0, Math.min(1, +v)); return Math.pow(v, 1.5); }
  function settings() { return (DCW.save && DCW.save.settings) || {}; }

  A.current = null;
  A.tracks = Object.keys(SONGS);
  A.sfxNames = Object.keys(SFX);
  A.aliases = assign({}, ALIAS);
  A.unlocked = function () { return unlocked; };

  A.init = function () {
    if (inited) return;
    inited = true;
    // engine.js unlocks on pointerdown; keyboard/touch players need a gesture hook too
    var un = function () { if (!unlocked || (ctx && ctx.state === 'suspended' && !document.hidden)) A.unlock(); };
    try {
      window.addEventListener('keydown', un, true);
      window.addEventListener('touchend', un, true);
      window.addEventListener('pointerdown', un, true);
    } catch (e) { /* ignore */ }
  };

  A.unlock = function () {
    try {
      if (!AC) return;
      if (!ctx) { ctx = new AC(); E = makeEngine(ctx); A.setVolumes(); }
      if (ctx.state === 'suspended' && !document.hidden) { var pr = ctx.resume(); if (pr && pr.catch) pr.catch(function () {}); }
      if (!timer) timer = setInterval(tick, 25);
      if (!unlocked) {
        unlocked = true;
        if (A.current && !cur) startTrack(A.current);
      }
    } catch (err) { warnOnce('unlock', 'unlock failed: ' + err.message); }
  };

  A.setVolumes = function () {
    if (!E) return;
    try {
      var s = settings(), now = ctx.currentTime;
      var mv = typeof s.music === 'number' ? s.music : 0.55, sv = typeof s.sfx === 'number' ? s.sfx : 0.8;
      E.musicBus.gain.setTargetAtTime(volCurve(mv), now, 0.02);
      E.sfxBus.gain.setTargetAtTime(volCurve(sv), now, 0.02);
    } catch (err) { /* ignore */ }
  };

  function startTrack(name) {
    var song = getSong(name), now = ctx.currentTime, g = ctx.createGain();
    g.connect(E.musicBus);
    var t0 = now + 0.06;
    g.gain.setValueAtTime(0, now); g.gain.linearRampToValueAtTime(1, t0 + 0.04);
    if (E.roomSend) { try { E.roomSend.gain.setTargetAtTime(song.room, now, 0.3); } catch (e) { /* ignore */ } }
    cur = new Player(E, song, g, t0); cur.name = name; cur.gain = g;
    cur.pump(now + LOOKAHEAD, now);
  }
  function stopCur(fade) {
    if (!cur) return;
    var now = ctx.currentTime, g = cur.gain;
    try { g.gain.cancelScheduledValues(now); g.gain.setValueAtTime(g.gain.value, now); g.gain.linearRampToValueAtTime(0, now + fade); } catch (e) { /* ignore */ }
    fadingOut.push({ g: g, until: now + fade + LOOKAHEAD + 1.6 });
    cur = null;
  }

  A.music = function (name) {
    try {
      if (name === undefined || name === '') name = null;
      if (name !== null && !SONGS[name] && ALIAS[name] && SONGS[ALIAS[name]]) name = ALIAS[name];
      if (name !== null && !SONGS[name]) { warnOnce('m:' + name, 'unknown music track: ' + name); return; }
      if (name === A.current) { // same track: never restart a loop; a finished one-shot may replay
        if (name && unlocked && E && (!cur || (cur.done && !cur.song.loop && ctx.currentTime > cur.t0 + cur.song.totalSec + 0.3))) { stopCur(0.05); startTrack(name); }
        return;
      }
      A.current = name;
      if (!E || !unlocked) return; // remembered; starts on unlock
      stopCur(0.3);
      if (name) startTrack(name);
    } catch (err) { warnOnce('music', 'music error: ' + err.message); }
  };
  A.stopMusic = function () { A.music(null); };

  A.sfx = function (name, opts) {
    if (!E || !unlocked) return;
    try {
      var fn = SFX[name];
      if (!fn) { warnOnce('s:' + name, 'unknown sfx: ' + name); return; }
      if (ctx.state === 'closed' || document.hidden) return; // a just-unlocked ctx may still be resuming: let it queue
      var now = ctx.currentTime, lim = name === 'text_blip' ? 0.035 : 0.03;
      if (lastPlay[name] != null && now - lastPlay[name] < lim && now >= lastPlay[name]) return;
      lastPlay[name] = now;
      while (voices.length >= MAX_VOICES) {
        var old = voices.shift();
        try { old.g.gain.cancelScheduledValues(now); old.g.gain.setTargetAtTime(0, now, 0.01); } catch (e) { /* ignore */ }
        (function (gn) { setTimeout(function () { try { gn.disconnect(); } catch (e) { /* ignore */ } }, 120); })(old.g);
      }
      opts = opts || {};
      var g = ctx.createGain();
      g.gain.value = opts.vol != null ? Math.max(0, +opts.vol) : 1;
      g.connect(E.sfxBus);
      var end = fn(E, g, now + 0.005, opts.pitch > 0 ? +opts.pitch : 1);
      if (typeof end !== 'number' || !isFinite(end)) end = now + 1;
      voices.push({ g: g, end: end, name: name });
      if (DUCK[name]) {
        var dg = E.duck.gain;
        dg.cancelScheduledValues(now); dg.setTargetAtTime(0.35, now, 0.03); dg.setTargetAtTime(1, end, 0.25);
      }
    } catch (err) { warnOnce('sfx', 'sfx error: ' + err.message); }
  };

  A.suspend = function () { try { if (ctx && ctx.state === 'running') ctx.suspend(); } catch (e) { /* ignore */ } };
  A.resume = function () { try { if (ctx && unlocked && ctx.state === 'suspended') { var pr = ctx.resume(); if (pr && pr.catch) pr.catch(function () {}); } } catch (e) { /* ignore */ } };

  function tick() {
    if (!ctx) return;
    try {
      var now = ctx.currentTime, ahead = document.hidden ? 1.2 : LOOKAHEAD;
      if (cur) cur.pump(now + ahead, now);
      if (voices.length) voices = voices.filter(function (v) { if (v.end < now - 0.2) { try { v.g.disconnect(); } catch (e) { /* ignore */ } return false; } return true; });
      if (fadingOut.length) fadingOut = fadingOut.filter(function (f) { if (f.until < now) { try { f.g.disconnect(); } catch (e) { /* ignore */ } return false; } return true; });
    } catch (err) { warnOnce('tick', 'scheduler error: ' + err.message); }
  }

  /* ================================================================== test / tooling hooks */
  A.songInfo = function (name) {
    if (!SONGS[name]) return null;
    var s = getSong(name), chans = {};
    s.evs.forEach(function (ev) { chans[ev.ch] = (chans[ev.ch] || 0) + 1; });
    return { name: name, loop: s.loop, introSec: s.introSec, loopSec: s.loopSec, totalSec: s.totalSec, events: s.evs.length, bars: s.totalSteps / s.bar,
      gain: s.gain, room: s.room, accel: s.accel, chans: chans, warns: s.warns.slice() };
  };
  A.sampleInfo = function () {
    var out = {};
    Object.keys(SMP).forEach(function (n) { var d = smpSource(n); out[n] = { rate: SMP[n].rate, sec: +(d.length / SMP[n].rate).toFixed(2), root: SMP[n].root || null }; });
    return out;
  };
  A.debugSample = function (name, o) { // test page: play one raw DPCM sample on the sfx bus
    if (!E || !unlocked || !SMP[name]) return;
    try { var g = ctx.createGain(); g.connect(E.sfxBus); samp(E, g, ctx.currentTime + 0.005, name, { v: 0.8, rate: (o && o.rate) || 1 }); } catch (err) { /* ignore */ }
  };
  A.debugState = function () {
    return { unlocked: unlocked, state: ctx && ctx.state, current: A.current, playing: cur && cur.name, voices: voices.length, fading: fadingOut.length };
  };
  // Render a track or sfx into an OfflineAudioContext using the same graph code.
  // Resolves to {name, kind, sec, peak, rms, clipped, longestSilence, firstSound, seamRms, ...}.
  // opts: {secs, sr, raw (skip the master dynamics), vol (bus gain, default 1), from (seconds to skip in stats), wav (return samples)}
  A.renderOffline = function (kind, name, opts) {
    if (!OAC) return Promise.reject(new Error('no OfflineAudioContext'));
    opts = opts || {};
    var sr = opts.sr || 22050, secs = opts.secs;
    var info = kind === 'music' ? A.songInfo(name) : null;
    if (kind === 'music' && !info) return Promise.reject(new Error('no track ' + name));
    if (kind === 'sfx' && !SFX[name]) return Promise.reject(new Error('no sfx ' + name));
    if (!secs) secs = kind === 'music' ? (info.loop ? info.introSec + info.loopSec * 2 + 0.5 : info.totalSec + 1.5) : 3.2;
    var oc = new OAC(2, Math.ceil(sr * secs), sr), e = makeEngine(oc, !!opts.raw), sfxEnd = 0, wall = Date.now();
    var vol = opts.vol != null ? opts.vol : 1;
    e.musicBus.gain.value = vol; e.sfxBus.gain.value = vol;
    if (kind === 'music') {
      if (e.roomSend) e.roomSend.gain.value = info.room;
      // schedule in 0.5s windows like the live lookahead scheduler, so only a few nodes exist at once
      var pl = new Player(e, getSong(name), e.musicBus, 0.01), CH = 0.5;
      pl.pump(CH + LOOKAHEAD, null);
      for (var ts = CH; ts < secs; ts += CH) {
        (function (tsv) { oc.suspend(tsv).then(function () { pl.pump(tsv + CH + LOOKAHEAD, null); oc.resume(); }); })(ts);
      }
    } else sfxEnd = SFX[name](e, e.sfxBus, 0.01, 1);
    return oc.startRendering().then(function (buf) {
      var d = buf.getChannelData(0), d1 = buf.getChannelData(1), n = d.length, peak = 0, sum = 0, clipped = 0, i, from = Math.floor((opts.from || 0) * sr);
      for (i = 0; i < n; i++) { var x = d[i], ax = Math.max(x < 0 ? -x : x, Math.abs(d1[i])); if (ax > peak) peak = ax; if (ax > 0.999) clipped++; if (i >= from) sum += x * x; }
      var win = Math.round(sr * 0.02), nw = Math.floor(n / win), wr = new Float32Array(nw), w, k;
      for (w = 0; w < nw; w++) { var s2 = 0; for (k = w * win; k < (w + 1) * win; k++) s2 += d[k] * d[k]; wr[w] = Math.sqrt(s2 / win); }
      var first = -1, lastW = -1; for (w = 0; w < nw; w++) if (wr[w] > 1e-3) { if (first < 0) first = w; lastW = w; }
      var longest = 0, runw = 0;
      for (w = Math.max(0, first); w <= lastW; w++) { if (wr[w] < 1e-3) { runw++; if (runw > longest) longest = runw; } else runw = 0; }
      // loudness: mean of the louder half of 400 ms windows (ignores gaps and fades)
      var lw = Math.round(sr * 0.4), lr = [];
      for (i = from; i + lw <= n; i += lw) { var s3 = 0; for (k = i; k < i + lw; k++) s3 += d[k] * d[k]; lr.push(Math.sqrt(s3 / lw)); }
      lr.sort(function (a, b) { return b - a; });
      var top = lr.slice(0, Math.max(1, Math.floor(lr.length / 2))), loud = top.reduce(function (a, b) { return a + b; }, 0) / top.length;
      var res = { kind: kind, name: name, sec: +secs.toFixed(2), renderMs: Date.now() - wall, peak: +peak.toFixed(3), rms: +Math.sqrt(sum / Math.max(1, n - from)).toFixed(4), loud: +loud.toFixed(4), clipped: clipped,
        firstSound: first < 0 ? null : +(first * 0.02).toFixed(2), lastSound: lastW < 0 ? null : +(lastW * 0.02).toFixed(2), longestSilence: +(longest * 0.02).toFixed(2) };
      if (info) {
        res.introSec = +info.introSec.toFixed(2); res.loopSec = +info.loopSec.toFixed(2); res.loop = info.loop; res.warns = info.warns;
        if (info.loop) { // RMS around the first loop seam vs overall
          var seam = 0.01 + info.introSec + info.loopSec, a = Math.floor((seam - 0.3) / 0.02), b = Math.floor((seam + 0.3) / 0.02), ss = 0, c = 0;
          for (w = Math.max(0, a); w < Math.min(nw, b); w++) { ss += wr[w]; c++; }
          res.seamRms = +(ss / Math.max(1, c)).toFixed(4);
        }
      } else res.dur = +(sfxEnd - 0.01).toFixed(2);
      if (opts.wav) res.samples = Array.prototype.slice.call(d);
      return res;
    });
  };
})();

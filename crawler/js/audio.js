/* audio.js - DCW chiptune engine: NES-style SFX + music tracker, all synthesized with WebAudio.
 * Voices: 2 pulse (12.5/25/50% duty PeriodicWaves), stepped 4-bit triangle, LFSR noise (long/short mode).
 * Music is compact pattern data compiled to event lists and scheduled ahead against
 * AudioContext.currentTime by a lookahead timer. The same graph-building code renders into an
 * OfflineAudioContext for tests (DCW.audio.renderOffline).
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
  var triCoef = null;
  function triWave(c) { // NES 32-step, 4-bit quantized triangle
    if (!triCoef) {
      var N = 48, S = 1024, re = new Float32Array(N), im = new Float32Array(N);
      for (var s = 0; s < S; s++) {
        var st = Math.floor(s / S * 32), val = st < 16 ? 15 - st : st - 16, v = val / 7.5 - 1;
        for (var n = 1; n < N; n++) {
          var ph = 2 * Math.PI * n * s / S;
          re[n] += v * Math.cos(ph) * 2 / S; im[n] += v * Math.sin(ph) * 2 / S;
        }
      }
      triCoef = [re, im];
    }
    return c.createPeriodicWave(triCoef[0], triCoef[1]);
  }
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

  /* ================================================================== engine (per context) */
  function makeEngine(c, raw) {
    var e = { ctx: c, sr: c.sampleRate };
    e.waves = { p12: pulseWave(c, 0.125), p25: pulseWave(c, 0.25), p50: pulseWave(c, 0.5), tri: triWave(c) };
    e.nz = {
      L1: lfsrBuffer(c, 32767, false, 1, 1), L8: lfsrBuffer(c, 32767, false, 8, 1),
      S1: lfsrBuffer(c, 93, true, 1, 64), S4: lfsrBuffer(c, 93, true, 4, 16)
    };
    // master chain: buses -> master -> hp -> lp -> compressor -> limiter -> out
    var hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 32;
    var lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = Math.min(13500, c.sampleRate * 0.45); lp.Q.value = 0.5;
    var comp = c.createDynamicsCompressor();
    comp.threshold.value = -16; comp.knee.value = 10; comp.ratio.value = 5; comp.attack.value = 0.004; comp.release.value = 0.2;
    var lim = c.createDynamicsCompressor();
    lim.threshold.value = -4; lim.knee.value = 0; lim.ratio.value = 20; lim.attack.value = 0.001; lim.release.value = 0.08;
    e.master = c.createGain(); e.master.gain.value = 0.95;
    if (raw) e.master.connect(c.destination);
    else { e.master.connect(hp); hp.connect(lp); lp.connect(comp); comp.connect(lim); lim.connect(c.destination); }
    e.duck = c.createGain(); e.duck.connect(e.master);
    e.musicBus = c.createGain(); e.musicBus.connect(e.duck);
    e.sfxBus = c.createGain(); e.sfxBus.connect(e.master);
    return e;
  }

  /* ================================================================== primitives */
  // tone: one pulse/triangle voice. o: w f f2 ft lin steps dur v a sus vib vibR
  function tone(e, out, t, o) {
    var c = e.ctx, osc = c.createOscillator(), g = c.createGain(), dur = o.dur, fr = osc.frequency;
    osc.setPeriodicWave(e.waves[o.w || 'p50']);
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

  /* ================================================================== instruments */
  var INST = {
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
    bassS:  { w: 'tri', v: 0.3, a: 0.003, d: 1, s: 1, r: 0.015, gate: 0.6 }
  };
  function I(base, o) { return assign({ base: base }, o); }

  function playNote(e, out, t, dur, midi, inst, arp, vel, stepDur, isEcho) {
    var c = e.ctx, f = mtof(midi), osc = c.createOscillator(), g = c.createGain(), fr = osc.frequency;
    var r = inst.r || 0.03, off = t + Math.max(inst.a + 0.01, dur * (inst.gate || 0.92)), end = off + r * 3 + 0.02;
    osc.setPeriodicWave(e.waves[inst.w]);
    if (arp) {
      var at = inst.arpT || 1 / 60, k = 0;
      for (var tt = t; tt < end; tt += at, k++) fr.setValueAtTime(f * Math.pow(2, arp[k % arp.length] / 12), tt);
    } else if (inst.slide) {
      fr.setValueAtTime(f * Math.pow(2, -inst.slide / 12), t);
      fr.exponentialRampToValueAtTime(f, t + inst.slideT);
    } else fr.setValueAtTime(f, t);
    if (inst.vib && dur > inst.vibD + 0.08) {
      var lfo = c.createOscillator(), lg = c.createGain();
      lfo.frequency.value = inst.vibR || 5;
      lg.gain.setValueAtTime(0, t); lg.gain.setValueAtTime(0, t + inst.vibD);
      lg.gain.linearRampToValueAtTime(inst.vib, t + inst.vibD + 0.15);
      lfo.connect(lg); lg.connect(osc.detune); lfo.start(t); lfo.stop(end);
    }
    var pk = inst.v * vel, gg = g.gain;
    gg.setValueAtTime(0, t);
    gg.linearRampToValueAtTime(pk, t + inst.a);
    if (inst.s < 1) gg.setTargetAtTime(pk * inst.s, t + inst.a, inst.d / 3);
    gg.setTargetAtTime(0, off, r / 3);
    osc.connect(g); g.connect(out);
    osc.start(t); osc.stop(end);
    if (inst.echo && !isEcho) playNote(e, out, t + inst.echo.steps * stepDur, dur, midi, inst, arp, vel * inst.echo.v, stepDur, true);
  }

  /* ================================================================== drum kit (noise channel) */
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
    // engine hat: buzzy short-mode (periodic) noise tick
    e: function (e, o, t, v) { noise(e, o, t, { hz: 11000, dur: 0.04, v: 0.065 * v, short: true }); },
    // rev sweep: rising short-mode noise swell into the next downbeat
    v: function (e, o, t, v) { noise(e, o, t, { hz: 2500, hz2: 15000, dur: 0.55, v: 0.1 * v, a: 0.42, short: true }); },
    // buzz-roll stroke: three quick snare taps per step (march rolls)
    z: function (e, o, t, v) { for (var i = 0; i < 3; i++) noise(e, o, t + i * 0.042, { hz: 14000 - i * 900, hz2: 8000, dur: 0.045, v: (0.1 + i * 0.025) * v }); }
  };

  /* ================================================================== tracker */
  // Pattern syntax (one token = one step unless ':n' given):
  //   C4  F#3  Bb5      note            C4:4   note lasting 4 steps
  //   C4+47             arpeggio offsets (hex semitones, 0 implied), e.g. +37a = minor 7th
  //   .   .:8           rest            -  -:3   hold previous note longer
  //   k s h ...         drum (noise channel)      trailing ! accent, ? ghost
  //   @inst             switch instrument         |  bar line (validated against song.bar)
  //   [ ... ]n          repeat group n times
  function R(s, n) { var a = []; for (var i = 0; i < n; i++) a.push(s); return a.join(' '); }
  function B() { return Array.prototype.slice.call(arguments).join(' | '); }
  function RB(s, n) { var a = []; for (var i = 0; i < n; i++) a.push(s); return a.join(' | '); } // repeat whole bars
  function T(s, k) {
    return s.replace(/(^|\s)([A-G][#b]?-?\d)/g, function (_, sp, n) { var m = noteNum(n) + k; return sp + NN[m % 12] + (Math.floor(m / 12) - 1); });
  }
  function ob(n, o) { o = o || 2; return R(n + o + ':2 ' + n + (o + 1) + ':2', 4); } // octave bounce bass bar
  function st(x) { return R('.:2 ' + x + ':2', 4); }                               // offbeat stabs bar
  function s2(x) { return '.:2 ' + x + ' .:3 ' + x + ' .:3 ' + x + ' .:2 ' + x + ' .:2'; }
  function ap(a, b, c, d) { return R(a + ':2 ' + b + ':2 ' + c + ':2 ' + d + ':2', 2); } // 8th arp bar
  function a16(a, b, c, d) { return R(a + ' ' + b + ' ' + c + ' ' + d, 4); }              // 16th arp bar
  function wb(r, t, f) { return r + ':4 ' + t + ':4 ' + f + ':4 ' + t + ':4'; }
  function rb(r, f) { return r + ':6 ' + r + ':2 ' + f + ':8'; }
  function pu(n) { return R(n + ':2', 8); }

  var CHANS = ['p1', 'p2', 'tr', 'nz'];
  var DEF_INST = { p1: 'lead', p2: 'stab', tr: 'bass', nz: null };

  function resolveInst(def, x) {
    if (!x) return null;
    if (typeof x === 'object') { var b = resolveInst(def, x.base) || INST.lead; var o = assign({}, b, x); delete o.base; return o; }
    if (def.insts && def.insts[x]) return resolveInst(def, def.insts[x]);
    return INST[x] || INST.lead;
  }

  function parseChannel(def, str, inst, barLen, warn) {
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
      var nm = /^([A-G][#b]?-?\d)(?:\+([0-9a-f]+))?$/.exec(body);
      if (nm) {
        ev.m = noteNum(nm[1]);
        if (nm[2]) ev.arp = [0].concat(nm[2].split('').map(function (h) { return parseInt(h, 16); }));
      } else if (KIT[body]) ev.drum = body;
      else { warn('bad token ' + tok); pos += len; continue; }
      evs.push(ev); last = ev; pos += len;
    }
    if (bars && pos - barStart !== barLen) warn('last bar has ' + (pos - barStart) + ' steps');
    return { evs: evs, len: pos };
  }

  function compileSong(name, def) {
    var bar = def.bar || 16, warns = [], parts = {};
    Object.keys(def.parts).forEach(function (pn) {
      var p = def.parts[pn], chans = {}, plen = 0;
      CHANS.forEach(function (ch) {
        if (!p[ch]) return;
        var inst = resolveInst(def, (def.inst && def.inst[ch]) || DEF_INST[ch]);
        chans[ch] = parseChannel(def, p[ch], inst, bar, function (msg) { warns.push(name + '.' + pn + '.' + ch + ': ' + msg); });
        plen = Math.max(plen, chans[ch].len);
      });
      var evs = [];
      Object.keys(chans).forEach(function (ch) {
        var cdat = chans[ch];
        if (!cdat.len) return;
        if (plen % cdat.len) warns.push(name + '.' + pn + '.' + ch + ': length ' + cdat.len + ' does not divide part length ' + plen);
        for (var off = 0; off < plen; off += cdat.len) {
          cdat.evs.forEach(function (ev) { if (ev.s + off < plen) evs.push(assign({}, ev, { s: ev.s + off, ch: ch })); });
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
      introSec: introSteps * stepDur, loopSec: (pos - introSteps) * stepDur, totalSec: pos * stepDur
    };
  }

  function playEvent(e, out, ev, t, stepDur) {
    if (ev.drum) KIT[ev.drum](e, out, t, ev.vel);
    else playNote(e, out, t, ev.d * stepDur, ev.m, ev.inst, ev.arp, ev.vel, stepDur, false);
  }

  function Player(e, song, out, t0) {
    this.e = e; this.song = song; this.out = out; this.t0 = t0; this.i = 0; this.iter = 0; this.done = false;
  }
  Player.prototype.pump = function (until, now) {
    var S = this.song, evs = S.evs;
    while (!this.done) {
      if (this.i >= evs.length) {
        if (!S.loop || S.firstLoop < 0 || S.loopSteps <= 0) { this.done = true; break; }
        this.iter++; this.i = S.firstLoop;
      }
      var ev = evs[this.i], abs = ev.s + (ev.s >= S.introSteps ? this.iter * S.loopSteps : 0);
      var t = this.t0 + abs * S.stepDur;
      if (t >= until) break;
      if (now == null || t >= now - 0.02) playEvent(this.e, this.out, ev, t, S.stepDur);
      this.i++;
    }
  };

  /* ================================================================== songs */
  var SONGS = {};

  // TITLE - bombastic game-show theme
  (function () {
    var g = 'k:2 h:2 s:2 h:2 k:2 k:2 s:2 h:2';
    SONGS.title = {
      bpm: 150, loopFrom: 1, inst: { p1: 'brass', p2: 'stab', tr: 'bass' },
      parts: {
        I: {
          p1: 'C5:3 C5 G4:2 C5:2 E5:4 G5:4 | F5:3 F5 E5:2 D5:2 C5:4 G5:4',
          p2: '@lead50 E4:3 E4 E4:2 E4:2 G4:4 C5:4 | A4:3 A4 G4:2 F4:2 E4:4 B4:4',
          tr: 'C3:2 C3 . C3:2 C3 . C3:4 E3:4 | F3:4 F3:4 G3:4 G3:4',
          nz: 'c:4 s:2 s s s:4 k:4 | k:2 s:2 k:2 s:2 s s s s s:2 s!:2'
        },
        A: {
          p1: 'G4:2 C5:2 E5:2 G5:4 E5:2 G5:2 A5:2 | G5:6 E5:2 C5:4 .:2 E5:2 | F5:2 F5:2 A5:2 F5:2 C6:4 A5:4 | G5:4 F5:2 E5:2 D5:4 B4:4 | ' +
              'C5:2 E5:2 G5:2 C6:4 B5:2 A5:2 G5:2 | A5:4 E5:2 A5:2 C6:4 A5:4 | A5:2 G5:2 F5:2 A5:2 G5:2 F5:2 E5:2 D5:2 | C5:4 G4:2 C5:2 E5:2 .:2 C5:4',
          p2: B(st('C4+47'), st('A3+37'), st('F3+47'), st('G3+47'), st('C4+47'), st('A3+37'), '.:2 F3+47:2 .:2 F3+47:2 .:2 G3+47:2 .:2 G3+47:2', st('C4+47')),
          tr: B(ob('C'), ob('A'), ob('F'), ob('G'), ob('C'), ob('A'), 'F2:2 F3:2 F2:2 F3:2 G2:2 G3:2 G2:2 G3:2', ob('C')),
          nz: 'c:2 h:2 s:2 h:2 k:2 k:2 s:2 h:2 | ' + RB(g, 7)
        },
        B: {
          p1: 'A5:3 G5:3 F5:2 C5:4 F5:4 | G5:3 F5:3 D5:2 B4:4 D5:4 | E5:3 D5:3 B4:2 G4:4 E5:4 | D5:2 E5:2 F5:2 G5:2 A5:2 B5:2 C6:2 D6:2',
          p2: B(st('F3+47'), st('G3+47'), st('E3+37'), st('G3+47')),
          tr: B(ob('F'), ob('G'), ob('E'), 'G2:2 G2:2 A2:2 A2:2 B2:2 B2:2 C3:2 D3:2'),
          nz: B(g, g, g, 's s s s k:2 s:2 s s s s s:2 s!:2')
        }
      },
      seq: ['I', 'A', 'A', 'B']
    };
  })();

  // INTRO - ominous build for the story crawl
  (function () {
    var dm = ap('D4', 'F4', 'A4', 'F4'), bb = ap('D4', 'F4', 'Bb4', 'F4'), gm = ap('D4', 'G4', 'Bb4', 'G4'), aa = ap('C#4', 'E4', 'A4', 'E4');
    var p2 = B(dm, dm, bb, bb, gm, gm, aa, aa);
    SONGS.intro = {
      bpm: 90, inst: { p1: I('lead50', { vib: 20 }), p2: 'arp', tr: 'bass' },
      parts: {
        A: {
          p1: '.:16 | .:16 | .:16 | .:16 | G4:8 Bb4:4 A4:4 | G4:6 F4:2 D4:8 | E4:8 C#4:4 E4:4 | A4:16',
          p2: p2,
          tr: 'D2:16 | D2:16 | Bb1:16 | Bb1:16 | G1:16 | G1:16 | A1:16 | A1:16',
          nz: 'k:3 k?:13'
        },
        B: {
          p1: 'D5:8 F5:4 E5:4 | D5:6 C5:2 A4:8 | Bb4:8 D5:4 C5:4 | Bb4:6 A4:2 F4:8 | G4:8 Bb4:4 D5:4 | G5:8 F5:4 D5:4 | E5:8 C#5:4 E5:4 | A5:16',
          p2: p2,
          tr: B(pu('D2'), pu('D2'), pu('Bb1'), pu('Bb1'), pu('G1'), pu('G1'), pu('A1'), pu('A1')),
          nz: B(RB('k:4 h:2 h:2 s:4 h:2 k:2', 7), 's s s s s s s s s:2 s:2 c:4')
        }
      },
      seq: ['A', 'B']
    };
  })();

  // FLOOR 1 - sewers / tutorial: bouncy, tense, A minor
  (function () {
    function bn(n) { return R(n + '2 . ' + n + '3 . ' + n + '2 ' + n + '2 ' + n + '3 .', 2); }
    var g = 'k . h . s . h k . k h . s . h .';
    SONGS.floor1 = {
      bpm: 132, inst: { p1: I('pluck', { v: 0.17, echo: { steps: 3, v: 0.3 } }), p2: 'stab', tr: 'bassS' },
      parts: {
        A: {
          p1: 'A4 . C5 . E5 . D5 C5 B4 . C5 . A4:4 | .:2 A4 . B4 . C5 . D5 . E5:2 C5:4 | F5 . E5 . D5 . C5 . A4:2 C5:2 F5:4 | G5 . F5 . E5 . D5 . B4:4 G4:4 | ' +
              'A4 . C5 . E5 . D5 C5 B4 . C5 . A4:4 | .:2 A4 . B4 . C5 . E5 . A5:2 G5:4 | G#5:2 F5:2 E5:2 D5:2 C5:2 B4:2 G#4:4 | E4 . G#4 . B4 . E5:2 .:8',
          p2: B(s2('A3+37'), s2('A3+37'), s2('F3+47'), s2('G3+47'), s2('A3+37'), s2('A3+37'), s2('E3+47'), s2('E3+47')),
          tr: B(bn('A'), bn('A'), bn('F'), bn('G'), bn('A'), bn('A'), bn('E'), bn('E')),
          nz: g
        },
        B: {
          p1: 'D5:4 F5:4 A5:4 F5:4 | E5:4 C5:4 A4:8 | D5:2 E5:2 F5:2 G5:2 A5:4 F5:4 | E5:4 G#5:4 B5:4 E6:4',
          p2: B(s2('D4+37'), s2('A3+37'), s2('D4+37'), s2('E3+47')),
          tr: B(bn('D'), bn('A'), bn('D'), bn('E')),
          nz: B(g, g, g, 'k . s . k . s . s s s s s:2 c:2')
        }
      },
      seq: ['A', 'A', 'B']
    };
  })();

  // FLOOR 2 - goblin warrens: tribal drums + low triangle riff, E phrygian
  (function () {
    var r1 = 'E2:2 E2 E2 G2:2 E2:2 F2:2 E2:2 D2:2 B1:2', r2 = 'E2:2 E2 E2 G2:2 A2:2 Bb2:2 A2:2 G2:2 F2:2';
    SONGS.floor2 = {
      bpm: 140, inst: { p1: 'horn', p2: 'stab', tr: 'bass' },
      parts: {
        A: {
          p1: '.:16 | .:16 | .:16 | .:16 | E4:4 G4:4 A4:4 B4:4 | C5:6 B4:2 A4:4 G4:4 | A4:4 B4:2 A4:2 G4:4 F4:4 | E4:16',
          p2: '.:4 E4+7:2 .:6 E4+7:2 .:2',
          tr: B(r1, r1, r1, r2, r1, r1, r1, r2),
          nz: 'k:2 t t k:2 T:2 k:2 t t T:2 s:2'
        },
        B: {
          p1: 'B4:2 B4:2 E5:4 D5:2 B4:2 G4:4 | A4:2 B4:2 C5:4 B4:2 A4:2 F4:4 | B4:2 B4:2 E5:4 D5:2 E5:2 G5:4 | F5:4 E5:4 D5:4 B4:4 | ' +
              'E5:4 D5:4 C5:4 B4:4 | A4:4 G4:4 F4:4 G4:4 | E4:8 F4:4 G4:4 | E4:16',
          p2: '.:4 E4+7:2 .:6 E4+7:2 .:2',
          tr: B(r1, r1, r1, r2, r1, r1, r1, r2),
          nz: 'k:2 t t s:2 T:2 k:2 t t s:2 s s'
        },
        C: {
          p1: '.:64',
          p2: '.:4 E4+7:2 .:6 E4+7:2 .:2',
          tr: B(r2, r2, r1, r2),
          nz: B('t t T T k:2 t t T T k:2 s s s s', 't t T T k:2 t t T T k:2 s s s s', 't t T T k:2 t t T T k:2 s s s s', 's s s s s s s s s:2 s!:2 c:4')
        }
      },
      seq: ['A', 'B', 'C']
    };
  })();

  // OW3 - jaunty overworld walk, F major
  (function () {
    var F = wb('F2', 'A2', 'C3'), Bb = wb('Bb1', 'D2', 'F2'), C = wb('C2', 'E2', 'G2'), D = wb('D2', 'F2', 'A2'), G = wb('G2', 'Bb2', 'D3');
    SONGS.ow3 = {
      bpm: 120, inst: { p1: 'lead', p2: 'stab', tr: 'bass' },
      parts: {
        A: {
          p1: 'C5:3 A4 F4:3 A4 C5:4 F5:4 | D5:3 C5 Bb4:3 D5 F5:8 | C5:3 A4 F4:3 A4 C5:2 D5:2 C5:2 A4:2 | G4:3 A4 Bb4:3 C5 G4:8 | ' +
              'C5:3 A4 F4:3 A4 C5:4 F5:4 | D5:3 E5 F5:3 G5 A5:4 F5:4 | G5:3 F5 E5:3 D5 C5:2 D5:2 E5:2 G5:2 | F5:4 C5:4 F5:4 .:4',
          p2: B(st('F4+47'), st('Bb3+47'), st('F4+47'), st('C4+47'), st('F4+47'), st('Bb3+47'), st('C4+47'), st('F4+47')),
          tr: B(F, Bb, F, C, F, Bb, C, F),
          nz: 'k:2 h:2 s:2 h h k:2 h:2 s:2 h:2'
        },
        B: {
          p1: 'A5:6 F5:2 D5:4 F5:4 | F5:6 D5:2 Bb4:4 D5:4 | G5:4 F5:2 E5:2 D5:4 Bb4:4 | C5:2 D5:2 E5:2 F5:2 G5:4 E5:4 | ' +
              'A5:6 F5:2 D5:4 A5:4 | Bb5:6 A5:2 F5:4 D5:4 | E5:4 G5:4 C6:4 Bb5:4 | A5:2 G5:2 F5:2 E5:2 D5:2 E5:2 F5:2 G5:2',
          p2: B(st('D4+37'), st('Bb3+47'), st('G3+37'), st('C4+47'), st('D4+37'), st('Bb3+47'), st('C4+47'), st('C4+47a')),
          tr: B(D, Bb, G, C, D, Bb, C, C),
          nz: B(RB('k:2 h:2 s:2 h h k:2 h:2 s:2 h:2', 7), 'k:2 h:2 s:2 h h s s s s s:2 s:2')
        }
      },
      seq: ['A', 'B']
    };
  })();

  // FLOOR 3 - sinister circus waltz (3/4, step = 8th), D minor
  (function () {
    function wz(x) { return '.:2 ' + x + ' . ' + x + ' .'; }
    function bw(n) { return n + ':2 .:4'; }
    var Dm = 'D4+37', Am = 'A3+47a', Gm = 'G3+37';
    var mel = 'A4:2 G#4 A4 F5:2 | D5:4 A4:2 | G4:2 F#4 G4 E5:2 | C#5:4 .:2 | E5:2 D#5 E5 G5:2 | F5:2 E5:2 C#5:2 | D5:2 C#5 D5 A4:2 | F4:4 .:2 | ' +
              'A4:2 G#4 A4 D5:2 | F5:4 E5:2 | D5:2 C#5 D5 Bb5:2 | G5:4 .:2 | F5:2 E5 F5 A5:2 | G5:2 F5:2 E5:2 | D5:2 E5:2 C#5:2 | D5:4 .:2';
    var chA = [Dm, Dm, Am, Am, Am, Am, Dm, Dm, Dm, Dm, Gm, Gm, Dm, Am, Dm, Dm];
    var bsA = ['D2', 'D2', 'A1', 'A1', 'A1', 'A1', 'D2', 'D2', 'D2', 'D2', 'G1', 'G1', 'D2', 'A1', 'D2', 'D2'];
    var chB = [Gm, Dm, Gm, Dm, Am, Am, Am, Am], bsB = ['G1', 'D2', 'G1', 'D2', 'A1', 'A1', 'A1', 'A1'];
    var trA = B.apply(null, bsA.map(bw)), trB = B.apply(null, bsB.map(bw));
    SONGS.floor3 = {
      bpm: 168, spb: 2, bar: 6, inst: { p1: I('thin', { w: 'p25', v: 0.17, vib: 28, vibD: 0.08, vibR: 7 }), p2: I('stab', { v: 0.11 }), tr: 'bassS' },
      parts: {
        A: { p1: mel, p2: B.apply(null, chA.map(wz)), tr: trA, nz: 'k:2 h:2 h:2' },
        A2: { p1: mel, p2: '@pluck ' + T(mel, -12), tr: trA, nz: 'k:2 h:2 h:2 | k:2 h:2 s?:2' },
        B: {
          p1: 'Bb4 A4 Bb4 B4 C5 C#5 | D5:6 | Bb4 A4 Bb4 B4 C5 C#5 | D5:2 F5:2 A5:2 | G#5:2 A5:2 G#5:2 | G5:2 F5:2 E5:2 | C#5:2 D5:2 E5:2 | A4:6',
          p2: B.apply(null, chB.map(wz)), tr: trB,
          nz: B(RB('k:2 s:2 s:2', 7), 's s s s s! s!')
        }
      },
      seq: ['A', 'B', 'A2', 'B']
    };
  })();

  // FLOOR 4 - rail tangle: fast chugging, E minor
  (function () {
    var Em = a16('E4', 'B4', 'G4', 'B4'), C = a16('E4', 'C5', 'G4', 'C5'), D = a16('F#4', 'D5', 'A4', 'D5'), Bm = a16('F#4', 'B4', 'D#5', 'B4'), Am = a16('E4', 'A4', 'C5', 'A4');
    var chug = 'k g h g s g h g k g h g s g h g';
    SONGS.floor4 = {
      bpm: 160, inst: { p1: 'lead', p2: 'arp', tr: 'bassS' },
      parts: {
        A: {
          p1: 'E5:2 .:2 E5:2 G5:2 B5:4 A5:2 G5:2 | F#5:4 E5:2 D5:2 E5:8 | E5:2 .:2 E5:2 G5:2 C6:4 B5:2 A5:2 | B5:4 A5:2 F#5:2 D5:8 | ' +
              'E5:2 .:2 E5:2 G5:2 B5:4 A5:2 G5:2 | B5:2 C6:2 B5:2 A5:2 G5:4 F#5:4 | G5:2 A5:2 G5:2 F#5:2 E5:4 C5:4 | D#5:4 F#5:4 B5:8',
          p2: B(Em, Em, C, D, Em, Em, C, Bm),
          tr: B(ob('E'), ob('E'), ob('C'), ob('D'), ob('E'), ob('E'), ob('C'), ob('B', 1)),
          nz: chug
        },
        B: {
          p1: 'A5:6 G5:2 E5:4 C5:4 | B4:6 C5:2 E5:4 G5:4 | A5:4 C6:4 B5:2 A5:2 G5:2 A5:2 | F#5:4 D#5:4 B4:4 F#5:4',
          p2: B(Am, Em, Am, Bm),
          tr: B(ob('A'), ob('E'), ob('A'), ob('B', 1)),
          nz: B(chug, chug, chug, 'k g s g k g s g s s s s s! s! c:2')
        }
      },
      seq: ['A', 'B', 'A', 'B']
    };
  })();

  // OW4 - rail overworld: steady clacking travel theme, D mixolydian
  (function () {
    SONGS.ow4 = {
      bpm: 128, inst: { p1: 'lead', p2: 'stab', tr: 'bass' },
      parts: {
        A: {
          p1: 'A4:2 D5:2 F#5:2 A5:6 F#5:2 A5:2 | G5:4 E5:2 C5:2 G4:8 | B4:2 D5:2 G5:2 B5:6 A5:2 G5:2 | F#5:4 E5:2 D5:2 A4:8 | ' +
              'A4:2 D5:2 F#5:2 A5:6 F#5:2 A5:2 | C6:4 B5:2 A5:2 G5:4 E5:4 | D5:2 E5:2 G5:2 A5:2 B5:4 G5:4 | A5:8 .:8',
          p2: B(st('D4+47'), st('C4+47'), st('G3+47'), st('D4+47'), st('D4+47'), st('C4+47'), st('G3+47'), st('D4+47')),
          tr: B(ob('D'), ob('C'), ob('G'), ob('D'), ob('D'), ob('C'), ob('G'), ob('D')),
          nz: 'k:2 m h s:2 m h k:2 m h s:2 m m'
        },
        B: {
          p1: 'F#5:6 D5:2 B4:8 | G5:6 D5:2 B4:8 | A5:4 G5:2 F#5:2 E5:4 C#5:4 | E5:2 F#5:2 G5:2 A5:2 C#6:4 A5:4',
          p2: B(st('B3+37'), st('G3+47'), st('A3+47'), st('A3+47a')),
          tr: B(ob('B', 1), ob('G'), ob('A'), ob('A')),
          nz: B('k:2 m h s:2 m h k:2 m h s:2 m m', 'k:2 m h s:2 m h k:2 m h s:2 m m', 'k:2 m h s:2 m h k:2 m h s:2 m m', 'k:2 m h s:2 m h s s s s s:2 o:2')
        }
      },
      seq: ['A', 'B', 'A', 'B']
    };
  })();

  // FLOOR 5 - bubble sea: slow watery arpeggios with echo, C minor
  (function () {
    var echoP1 = I('lead50', { echo: { steps: 3, v: 0.4 }, vib: 18, v: 0.11 });
    var echoP2 = I('arp', { echo: { steps: 2, v: 0.45 }, v: 0.065 });
    var Cm = a16('C4', 'G4', 'Eb5', 'G4'), Ab = a16('C4', 'Ab4', 'Eb5', 'Ab4'), Eb = a16('Bb3', 'G4', 'Eb5', 'G4'), Bb = a16('Bb3', 'F4', 'D5', 'F4'),
        Fm = a16('C4', 'F4', 'Ab4', 'F4'), G = a16('B3', 'D4', 'G4', 'D4'), Bb2 = a16('D4', 'Bb4', 'F5', 'Bb4'), Gm = a16('D4', 'G4', 'Bb4', 'G4');
    var dr = 'k:6 h:2 h:4 s?:4';
    SONGS.floor5 = {
      bpm: 96, inst: { p1: echoP1, p2: echoP2, tr: 'bass' },
      parts: {
        A: {
          p1: 'G4:6 Eb5:2 D5:4 C5:4 | C5:6 Bb4:2 Ab4:4 Eb4:4 | G4:4 Bb4:4 Eb5:6 F5:2 | D5:12 .:4 | G5:6 F5:2 Eb5:4 D5:4 | C5:6 Eb5:2 Ab5:8 | G5:4 F5:4 Eb5:4 D5:4 | D5:4 B4:4 G4:8',
          p2: B(Cm, Ab, Eb, Bb, Cm, Ab, Fm, G),
          tr: B(rb('C2', 'G2'), rb('Ab1', 'Eb2'), rb('Eb2', 'Bb2'), rb('Bb1', 'F2'), rb('C2', 'G2'), rb('Ab1', 'Eb2'), rb('F2', 'C3'), rb('G1', 'D2')),
          nz: dr
        },
        B: {
          p1: 'Ab5:6 G5:2 Eb5:8 | F5:6 Eb5:2 D5:8 | D5:6 Eb5:2 F5:4 G5:4 | Eb5:12 .:4 | C6:6 Bb5:2 Ab5:4 Eb5:4 | D6:6 C6:2 Bb5:4 F5:4 | B5:4 D6:4 G5:8 | F5:4 D5:4 B4:8',
          p2: B(Ab, Bb2, Gm, Cm, Ab, Bb2, G, G),
          tr: B(rb('Ab1', 'Eb2'), rb('Bb1', 'F2'), rb('G1', 'D2'), rb('C2', 'G2'), rb('Ab1', 'Eb2'), rb('Bb1', 'F2'), rb('G1', 'D2'), rb('G1', 'D2')),
          nz: B(dr, dr, dr, dr, dr, dr, dr, 'k:6 h:2 s?:2 s?:2 s:2 s:2')
        }
      },
      seq: ['A', 'B']
    };
  })();

  // OW5 - bubble sea overworld: floaty lydian G major
  (function () {
    var G = a16('G4', 'B4', 'D5', 'B4'), Ach = a16('A4', 'C#5', 'E5', 'C#5'), Em = a16('E4', 'G4', 'B4', 'G4'), C = a16('E4', 'G4', 'C5', 'G4'),
        D = a16('F#4', 'A4', 'D5', 'A4'), Bm = a16('F#4', 'B4', 'D5', 'B4');
    var dr = 'k:4 h:2 h:2 s:4 h:2 h:2';
    SONGS.ow5 = {
      bpm: 108, inst: { p1: I('lead', { echo: { steps: 3, v: 0.35 } }), p2: I('arp', { echo: { steps: 2, v: 0.4 }, v: 0.06 }), tr: 'bass' },
      parts: {
        A: {
          p1: 'D5:4 G5:4 F#5:2 G5:2 D5:4 | C#5:4 E5:4 A5:8 | B5:4 A5:2 G5:2 F#5:2 G5:2 D5:4 | E5:12 .:4 | G5:4 B5:4 A5:2 G5:2 E5:4 | G5:4 E5:4 C5:8 | D5:2 E5:2 F#5:2 A5:2 D6:4 C#6:4 | A5:12 .:4',
          p2: B(G, Ach, G, Ach, Em, C, D, D),
          tr: B(rb('G2', 'D3'), rb('A2', 'E3'), rb('G2', 'D3'), rb('A2', 'E3'), rb('E2', 'B2'), rb('C2', 'G2'), rb('D2', 'A2'), rb('D2', 'A2')),
          nz: dr
        },
        B: {
          p1: 'E5:6 G5:2 C6:8 | F#5:6 A5:2 D6:8 | D6:4 C#6:4 B5:4 F#5:4 | G5:12 .:4 | E5:4 F#5:4 G5:4 C6:4 | A5:4 G5:4 F#5:4 E5:4 | D5:4 G5:4 B5:8 | G5:12 .:4',
          p2: B(C, D, Bm, Em, C, D, G, G),
          tr: B(rb('C2', 'G2'), rb('D2', 'A2'), rb('B1', 'F#2'), rb('E2', 'B2'), rb('C2', 'G2'), rb('D2', 'A2'), rb('G2', 'D3'), rb('G2', 'D3')),
          nz: B(dr, dr, dr, dr, dr, dr, dr, 'k:4 h:2 h:2 s:2 s:2 s:2 s:2')
        }
      },
      seq: ['A', 'B']
    };
  })();

  // FLOOR 6 - hunting grounds: tense gallop chase with horn calls, D minor
  (function () {
    function gal(n) { return R(n + '2:2 ' + n + '2 ' + n + '3', 4); }
    var dr = 'k:2 h h s:2 h h k:2 h h s:2 h s';
    SONGS.floor6 = {
      bpm: 168, inst: { p1: 'horn', p2: 'stab', tr: 'bassS' },
      parts: {
        A: {
          p1: 'A4:2 D5:2 A5:8 F5:2 D5:2 | A4:2 D5:2 A5:4 C6:4 A5:4 | Bb5:6 A5:2 F5:4 D5:4 | C6:6 Bb5:2 G5:4 E5:4 | ' +
              'A4:2 D5:2 A5:8 F5:2 D5:2 | F5:2 G5:2 A5:4 D6:4 C6:4 | Bb5:4 A5:4 G5:4 F5:4 | E5:4 C#5:4 A4:8',
          p2: B(st('D4+37'), st('D4+37'), st('Bb3+47'), st('C4+47'), st('D4+37'), st('D4+37'), st('Bb3+47'), st('A3+47')),
          tr: B(gal('D'), gal('D'), gal('Bb'), gal('C'), gal('D'), gal('D'), gal('Bb'), gal('A')),
          nz: dr
        },
        B: {
          p1: '@lead G5 A5 Bb5 A5 G5 F5 E5 F5 G5:4 D5:4 | A5 Bb5 A5 G5 F5 E5 D5 E5 C#5:4 A4:4 | D5 E5 F5 G5 A5 G5 F5 E5 D5:4 A5:4 | D6:8 A5:4 F5:4 | ' +
              'G5 A5 Bb5 A5 G5 F5 E5 F5 G5:4 Bb5:4 | A5 Bb5 A5 G5 F5 E5 D5 E5 C#5:4 E5:4 | F5 G5 F5 E5 D5:4 Bb4:4 D5:4 | E5:4 A5:4 C#6:4 E6:4',
          p2: B(st('G3+37'), st('A3+47'), st('D4+37'), st('D4+37'), st('G3+37'), st('A3+47'), st('Bb3+47'), st('A3+47a')),
          tr: B(gal('G'), gal('A'), gal('D'), gal('D'), gal('G'), gal('A'), gal('Bb'), gal('A')),
          nz: B(dr, dr, dr, dr, dr, dr, dr, 's s s s s s s s s! s! s! s! c:4')
        },
        C: {
          p1: 'D5:2 A5:6 .:8 | D5:2 A5:6 .:8 | F5:2 C6:6 .:8 | E5:2 A5:6 C#6:8',
          p2: '.:64',
          tr: B(gal('D'), gal('D'), gal('F'), gal('A')),
          nz: B('k:4 T:2 T:2 k:4 t:2 t:2', 'k:4 T:2 T:2 k:4 t:2 t:2', 'k:4 T:2 T:2 k:4 t:2 t:2', 't t t t T T T T s s s s s! s! s! s!')
        }
      },
      seq: ['A', 'B', 'C']
    };
  })();

  // OW6 - hunting grounds overworld: tense creeping walk, distant horns, A minor
  (function () {
    function sn(n) { return R(n + '2:2 .:2', 3) + ' ' + n + '3:2 .:2'; }
    var dr = 'k:4 h:4 k:2 k:2 h:4';
    SONGS.ow6 = {
      bpm: 116, inst: { p1: I('horn', { echo: { steps: 4, v: 0.3 } }), p2: 'stab', tr: 'bassS' },
      parts: {
        A: {
          p1: 'E5:2 A5:6 .:8 | E5:2 A5:4 B5:2 C6:4 B5:4 | A5:6 F5:2 C5:8 | B4:4 E5:4 G#5:8 | E5:2 A5:6 .:8 | C6:4 B5:4 A5:4 E5:4 | F5:4 E5:4 D5:4 F5:4 | E5:12 .:4',
          p2: B(s2('A3+37'), s2('A3+37'), s2('F3+47'), s2('E3+47'), s2('A3+37'), s2('A3+37'), s2('D4+37'), s2('E3+47')),
          tr: B(sn('A'), sn('A'), sn('F'), sn('E'), sn('A'), sn('A'), sn('D'), sn('E')),
          nz: dr
        },
        B: {
          p1: 'C6:6 A5:2 F5:8 | D6:6 B5:2 G5:8 | E6:4 C6:4 A5:8 | A5:12 .:4 | F5:4 A5:4 C6:4 A5:4 | G5:4 B5:4 D6:4 B5:4 | G#5:4 B5:4 E6:8 | E6:4 D6:4 B5:4 G#5:4',
          p2: B(s2('F3+47'), s2('G3+47'), s2('A3+37'), s2('A3+37'), s2('F3+47'), s2('G3+47'), s2('E3+47'), s2('E3+47a')),
          tr: B(sn('F'), sn('G'), sn('A'), sn('A'), sn('F'), sn('G'), sn('E'), sn('E')),
          nz: B(dr, dr, dr, dr, dr, dr, dr, 'k:4 h:4 s:2 s:2 s:2 s:2')
        }
      },
      seq: ['A', 'B']
    };
  })();

  // FLOOR 7 - bedlam manor: gothic organ arpeggios, D minor
  (function () {
    var Dm = a16('D4', 'F4', 'A4', 'F4'), Gm = a16('D4', 'G4', 'Bb4', 'G4'), Aa = a16('C#4', 'E4', 'A4', 'E4'), A7 = a16('C#4', 'E4', 'G4', 'E4'),
        Bb = a16('D4', 'F4', 'Bb4', 'F4'), Eb = a16('Eb4', 'G4', 'Bb4', 'G4');
    SONGS.floor7 = {
      bpm: 112, inst: { p1: 'organ', p2: 'organ2', tr: 'bass' },
      parts: {
        A: {
          p1: 'D5:8 A5:8 | Bb5:6 A5:2 G5:8 | E5:8 C#5:4 E5:4 | F5:8 D5:8 | D6:6 C6:2 Bb5:8 | G5:6 A5:2 Bb5:8 | A5:4 G5:4 F5:4 E5:4 | C#5:16',
          p2: B(Dm, Gm, Aa, Dm, Bb, Gm, Aa, A7),
          tr: 'D2:8 D3:8 | D2:8 D3:8 | C#2:8 C#3:8 | D2:8 D3:8 | Bb1:8 Bb2:8 | G1:8 G2:8 | A1:8 A2:8 | A1:8 A2:8',
          nz: 'K:8 S?:8'
        },
        B: {
          p1: 'G5:4 Bb5:4 D6:8 | F5:4 A5:4 D6:8 | Eb6:6 D6:2 Bb5:8 | C#6:8 A5:8 | Bb5:4 A5:4 G5:4 F5:4 | F5:4 E5:4 D5:8 | E5:4 F5:4 G5:4 C#5:4 | D5:16',
          p2: B(Gm, Dm, Eb, Aa, Gm, Dm, A7, Dm),
          tr: 'G1:8 G2:8 | D2:8 D3:8 | Eb2:8 Eb3:8 | A1:8 A2:8 | G1:8 G2:8 | D2:8 D3:8 | A1:8 A2:8 | D2:8 D3:8',
          nz: B('K:8 S:8', 'K:8 S:8', 'K:8 S:8', 'K:8 S:4 S:4', 'K:8 S:8', 'K:8 S:8', 'K:4 K:4 S:4 S:4', 'K:8 c:8')
        }
      },
      seq: ['A', 'B']
    };
  })();

  // OW7 - manor grounds: slow gothic 3/4, E minor
  (function () {
    function a3(a, b, c) { return a + ':2 ' + b + ':2 ' + c + ':2 ' + b + ':2 ' + c + ':2 ' + b + ':2'; }
    function wb3(r, f) { return r + ':4 ' + f + ':4 ' + f + ':4'; }
    var Em = a3('E4', 'G4', 'B4'), Am = a3('A3', 'C4', 'E4'), Bc = a3('B3', 'D#4', 'F#4'), C = a3('C4', 'E4', 'G4'), D = a3('D4', 'F#4', 'A4'), Bm = a3('B3', 'D4', 'F#4');
    var tE = wb3('E2', 'B2'), tA = wb3('A1', 'E2'), tB = wb3('B1', 'F#2'), tC = wb3('C2', 'G2'), tD = wb3('D2', 'A2');
    SONGS.ow7 = {
      bpm: 100, bar: 12, inst: { p1: I('lead50', { vib: 22, echo: { steps: 3, v: 0.3 } }), p2: 'arp', tr: 'bass' },
      parts: {
        A: {
          p1: 'B4:4 E5:4 G5:4 | F#5:8 E5:4 | A5:4 C6:4 B5:2 A5:2 | F#5:12 | G5:4 B5:4 E6:4 | E6:4 D6:2 C6:2 G5:4 | A5:4 F#5:4 E5:4 | D#5:12',
          p2: B(Em, Em, Am, Bc, Em, C, Am, Bc),
          tr: B(tE, tE, tA, tB, tE, tC, tA, tB),
          nz: 'k:4 h:4 h:4'
        },
        B: {
          p1: 'E5:6 G5:2 C6:4 | D6:6 C6:2 A5:4 | B5:4 F#5:4 D5:4 | E5:12 | C6:6 B5:2 A5:4 | B5:4 A5:4 F#5:4 | G5:4 F#5:4 D#5:4 | E5:12',
          p2: B(C, D, Bm, Em, Am, Bc, Em, Em),
          tr: B(tC, tD, tB, tE, tA, tB, tE, tE),
          nz: B('k:4 h:4 h:4', 'k:4 h:4 h:4', 'k:4 h:4 h:4', 'k:4 s?:4 h:4', 'k:4 h:4 h:4', 'k:4 h:4 h:4', 'k:4 h:4 h:4', 'k:4 s:2 s:2 s:2 s:2')
        }
      },
      seq: ['A', 'B']
    };
  })();

  // FLOOR 8 - the ruin: bleak, heavy, slow, F minor
  (function () {
    function hv(r) { return r + ':6 ' + r + ':2 ' + r + ':8'; }
    SONGS.floor8 = {
      bpm: 80, inst: { p1: I('lead50', { vib: 20, vibD: 0.3 }), p2: 'pad', tr: 'bass' },
      parts: {
        A: {
          p1: 'C5:8 Ab4:4 G4:4 | F4:12 .:4 | C5:6 Db5:2 C5:4 Ab4:4 | G4:12 .:4 | F5:8 Eb5:4 C5:4 | Db5:8 C5:4 Ab4:4 | Bb4:6 C5:2 Db5:4 F5:4 | E5:12 .:4',
          p2: 'Ab4+4:16 | F4+3:16 | Ab4+4:16 | E4+3:16 | Ab4+4:16 | F4+3:16 | F4+4:16 | E4+3:16',
          tr: B(hv('F1'), hv('Db2'), hv('F1'), hv('C2'), hv('F1'), hv('Db2'), hv('Bb1'), hv('C2')),
          nz: 'K:6 k:2 S:8'
        },
        B: {
          p1: 'Ab5:8 F5:8 | G5:8 Eb5:8 | F5:6 Ab4:2 C5:8 | F4:12 .:4',
          p2: 'F4+3:16 | G4+4:16 | Ab4+4:16 | Ab4+4:16',
          tr: B(hv('Db2'), hv('Eb2'), hv('F1'), hv('F1')),
          nz: B('K:6 k:2 S:8', 'K:6 k:2 S:8', 'K:6 k:2 S:4 S:4', 'w:16')
        }
      },
      seq: ['A', 'B']
    };
  })();

  // OW8 - wasteland overworld: lonely echoing melody, B minor
  (function () {
    var Bm = ap('B3', 'D4', 'F#4', 'D4'), G = ap('G3', 'B3', 'D4', 'B3'), D = ap('D4', 'F#4', 'A4', 'F#4'), Aa = ap('A3', 'C#4', 'E4', 'C#4'),
        Em = ap('E4', 'G4', 'B4', 'G4'), Fs = ap('F#3', 'A#3', 'C#4', 'A#3');
    function r2(r, f) { return r + ':8 ' + f + ':8'; }
    var dr = 'k:4 .:4 s?:4 h:4';
    SONGS.ow8 = {
      bpm: 92, inst: { p1: I('lead', { echo: { steps: 3, v: 0.35 }, vib: 16 }), p2: 'arp', tr: 'bass' },
      parts: {
        A: {
          p1: 'F#5:6 E5:2 D5:4 B4:4 | D5:6 E5:2 B4:8 | A4:4 D5:4 F#5:4 A5:4 | G5:6 F#5:2 E5:8 | F#5:6 E5:2 D5:4 F#5:4 | B5:6 A5:2 G5:4 D5:4 | E5:4 G5:4 F#5:4 E5:4 | C#5:4 A#4:4 F#4:8',
          p2: B(Bm, G, D, Aa, Bm, G, Em, Fs),
          tr: B(r2('B1', 'F#2'), r2('G1', 'D2'), r2('D2', 'A2'), r2('A1', 'E2'), r2('B1', 'F#2'), r2('G1', 'D2'), r2('E2', 'B2'), r2('F#1', 'C#2')),
          nz: dr
        },
        B: {
          p1: 'D6:6 B5:2 G5:8 | C#6:6 A5:2 E5:8 | D6:4 C#6:4 B5:4 F#5:4 | B5:12 .:4 | G5:4 B5:4 D6:4 B5:4 | A5:4 C#6:4 E6:4 C#6:4 | F#5:4 A#5:4 C#6:4 E6:4 | C#6:8 A#5:8',
          p2: B(G, Aa, Bm, Bm, G, Aa, Fs, Fs),
          tr: B(r2('G1', 'D2'), r2('A1', 'E2'), r2('B1', 'F#2'), r2('B1', 'F#2'), r2('G1', 'D2'), r2('A1', 'E2'), r2('F#1', 'C#2'), r2('F#1', 'C#2')),
          nz: B(dr, dr, dr, dr, dr, dr, dr, 'k:4 w:12')
        }
      },
      seq: ['A', 'B']
    };
  })();

  // FLOOR 9 - faction wars: epic martial march, C minor
  (function () {
    function mb(r, f) { return r + ':4 ' + f + ':4 ' + r + ':4 ' + f + ':2 ' + f + ':2'; }
    function ms(x) { return x + ':2 .:2 ' + x + ' ' + x + ' .:2 ' + x + ':2 .:2 ' + x + ':4'; }
    var dr = 'k:2 s s s:2 s:2 k:2 s s s:2 s? s?';
    SONGS.floor9 = {
      bpm: 120, inst: { p1: 'brass', p2: 'stab', tr: 'bassS' },
      parts: {
        A: {
          p1: 'G4:3 G4 C5:4 Eb5:4 G5:4 | F5:3 Eb5 D5:4 C5:8 | Ab5:3 G5 F5:4 Eb5:4 C5:4 | D5:3 Eb5 F5:4 Bb4:8 | ' +
              'G4:3 G4 C5:4 Eb5:4 G5:4 | C6:3 Bb5 G5:4 Eb5:8 | Ab5:3 G5 F5:3 Eb5 D5:4 C5:4 | B4:3 C5 D5:4 G4:8',
          p2: B(ms('C4+37'), ms('C4+37'), ms('Ab3+47'), ms('Bb3+47'), ms('C4+37'), ms('C4+37'), ms('Ab3+47'), ms('G3+47')),
          tr: B(mb('C2', 'G2'), mb('C2', 'G2'), mb('Ab1', 'Eb2'), mb('Bb1', 'F2'), mb('C2', 'G2'), mb('C2', 'G2'), mb('Ab1', 'Eb2'), mb('G1', 'D2')),
          nz: dr
        },
        B: {
          p1: 'C5:3 C5 F5:4 Ab5:4 C6:4 | Bb5:3 Ab5 G5:4 F5:8 | G5:3 G5 Eb5:4 C5:4 Eb5:4 | G5:12 .:4 | ' +
              'Ab5:3 Ab5 C6:4 Ab5:4 Eb5:4 | Bb5:3 Bb5 D6:4 Bb5:4 F5:4 | G5:3 Ab5 G5:4 Eb5:4 C5:4 | D5:4 G5:4 B5:4 D6:4',
          p2: B(ms('F3+37'), ms('F3+37'), ms('C4+37'), ms('C4+37'), ms('Ab3+47'), ms('Bb3+47'), ms('C4+37'), ms('G3+47')),
          tr: B(mb('F1', 'C2'), mb('F1', 'C2'), mb('C2', 'G2'), mb('C2', 'G2'), mb('Ab1', 'Eb2'), mb('Bb1', 'F2'), mb('C2', 'G2'), mb('G1', 'D2')),
          nz: B(dr, dr, dr, dr, dr, dr, dr, 's s s s s s s s s! s! s! s! c:4')
        }
      },
      seq: ['A', 'B']
    };
  })();

  // OW9 - war-torn overworld: lighter march, G minor
  (function () {
    function mb(r, f) { return r + ':4 ' + f + ':4 ' + r + ':4 ' + f + ':2 ' + f + ':2'; }
    var dr = 'k:2 h:2 s:2 h:2 k:2 k:2 s:2 h h';
    SONGS.ow9 = {
      bpm: 112, inst: { p1: 'lead', p2: 'stab', tr: 'bassS' },
      parts: {
        A: {
          p1: 'D5:2 G5:2 Bb5:4 A5:2 G5:2 D5:4 | Bb4:2 C5:2 D5:4 G4:8 | Eb5:2 G5:2 Bb5:4 G5:4 Eb5:4 | F5:2 A5:2 C6:4 A5:4 F5:4 | ' +
              'D5:2 G5:2 Bb5:4 A5:2 G5:2 D5:4 | D6:4 C6:2 Bb5:2 A5:4 G5:4 | G5:4 Bb5:4 Eb5:4 G5:4 | F#5:4 A5:4 D5:8',
          p2: B(st('G3+37'), st('G3+37'), st('Eb4+47'), st('F3+47'), st('G3+37'), st('G3+37'), st('Eb4+47'), st('D4+47')),
          tr: B(mb('G2', 'D2'), mb('G2', 'D2'), mb('Eb2', 'Bb1'), mb('F2', 'C2'), mb('G2', 'D2'), mb('G2', 'D2'), mb('Eb2', 'Bb1'), mb('D2', 'A1')),
          nz: dr
        },
        B: {
          p1: 'Eb5:6 D5:2 C5:4 G4:4 | F#5:6 E5:2 D5:8 | G5:4 A5:4 Bb5:4 D6:4 | G5:12 .:4 | C6:6 Bb5:2 G5:4 Eb5:4 | D6:6 C6:2 A5:4 F#5:4 | G5:4 F5:4 Eb5:4 Bb4:4 | A4:4 C5:4 D5:4 F#5:4',
          p2: B(st('C4+37'), st('D4+47'), st('G3+37'), st('G3+37'), st('C4+37'), st('D4+47'), st('Eb4+47'), st('D4+47a')),
          tr: B(mb('C2', 'G1'), mb('D2', 'A1'), mb('G2', 'D2'), mb('G2', 'D2'), mb('C2', 'G1'), mb('D2', 'A1'), mb('Eb2', 'Bb1'), mb('D2', 'A1')),
          nz: B(dr, dr, dr, dr, dr, dr, dr, 'k:2 h:2 s:2 h:2 s s s s s:2 s:2')
        }
      },
      seq: ['A', 'B']
    };
  })();

  // BOSS - aggressive fast boss battle, E minor
  (function () {
    var a = 'E2:2 E2:2 E3:2 E2:2 F2:2 E2:2 G2:2 F#2:2', b = 'E2:2 E2:2 E3:2 E2:2 Bb2:2 A2:2 G2:2 F#2:2';
    var c = 'C2:2 C2:2 C3:2 C2:2 C2:2 C3:2 D2:2 D#2:2', bb = 'B1:2 B2:2 B1:2 B2:2 B1:2 B2:2 D#2:2 F#2:2';
    var Em = a16('E4', 'G4', 'B4', 'G4'), C = a16('E4', 'G4', 'C5', 'G4'), Bc = a16('D#4', 'F#4', 'B4', 'F#4');
    var Am = a16('A4', 'C5', 'E5', 'C5'), F = a16('A4', 'C5', 'F5', 'C5'), B5 = a16('B4', 'D#5', 'F#5', 'D#5'), D = a16('F#4', 'A4', 'D5', 'A4');
    var dr = 'k h s h k k s h k h s h k k s s';
    SONGS.boss = {
      bpm: 176, inst: { p1: 'lead', p2: 'arp', tr: 'bassS' },
      parts: {
        A: {
          p1: 'E5:2 B4:2 E5:2 F5:2 E5:4 B4:4 | D5:2 E5:2 G5:2 F#5:2 E5:8 | E5:2 B4:2 E5:2 F5:2 E5:4 G5:4 | A#5:4 A5:4 G5:4 F#5:4 | ' +
              'B5:2 F#5:2 B5:2 C6:2 B5:4 F#5:4 | A5:2 B5:2 D6:2 C#6:2 B5:8 | G5:2 A5:2 B5:2 G5:2 F#5:2 G5:2 A5:2 F#5:2 | E5:4 D#5:4 E5:4 F#5:4',
          p2: B(Em, Em, Em, C, Em, Em, C, Bc),
          tr: B(a, b, a, c, a, b, c, bb),
          nz: dr
        },
        B: {
          p1: 'G5:4 C6:4 B5:4 G5:4 | A5:4 D6:4 C6:4 A5:4 | B5:4 D#6:4 F#6:4 D#6:4 | E6:2 B5:2 G5:2 E5:2 B4:2 G4:2 E4:4',
          p2: B(C, D, B5, Em),
          tr: B(ob('C'), ob('D'), ob('B', 1), ob('E')),
          nz: B(dr, dr, dr, 's s s s s s s s s! s! s! s! c:4')
        },
        C: {
          p1: 'A5:8 G5:4 E5:4 | C6:8 B5:4 A5:4 | B5:8 G5:4 E5:4 | B4:4 E5:4 G5:4 B5:4 | C6:8 A5:4 F5:4 | A5:4 C6:4 F6:8 | F#6:8 D#6:4 B5:4 | F#5:4 A5:4 B5:8',
          p2: B(Am, Am, Em, Em, F, F, B5, B5),
          tr: B(ob('A'), ob('A'), ob('E'), ob('E'), ob('F'), ob('F'), ob('B', 1), ob('B', 1)),
          nz: B(RB('k:2 h:2 s:2 h:2 k:2 k:2 s:2 h h', 7), 's s s s s s s s s! s! s! s! s! s! c:2')
        }
      },
      seq: ['A', 'B', 'A', 'C']
    };
  })();

  // BOSS FINAL - bigger, more chaotic: tritones, key shift up a semitone, C minor
  (function () {
    var riff = 'C2 C2 C3 C2 C2 F#2 C2 G2 C2 C2 C3 C2 Eb2:2 D2:2';
    var dr = 'k h s h k s s h k h s h k s c:2';
    var X1 = a16('C4', 'Eb4', 'F#4', 'G4'), X2 = a16('C4', 'Eb4', 'G4', 'Bb4');
    var Ab = a16('Ab4', 'C5', 'Eb5', 'C5'), Bb = a16('Bb4', 'D5', 'F5', 'D5'), Fd = a16('F#4', 'A4', 'C5', 'A4'), G = a16('G4', 'B4', 'D5', 'B4');
    SONGS.boss_final = {
      bpm: 184, inst: { p1: I('lead', { vib: 20, vibD: 0.12, vibR: 7 }), p2: 'arp', tr: 'bassS' },
      parts: {
        A: {
          p1: 'C5:2 G5:2 F#5:2 G5:2 Eb5:4 C5:4 | D5:2 Eb5:2 F#5:2 G5:2 Ab5:8 | G5:2 C6:2 B5:2 C6:2 G5:4 Eb5:4 | F#5:4 F5:4 Eb5:4 D5:4 | ' +
              'C6:2 G5:2 F#5:2 G5:2 Eb6:4 C6:4 | D6:2 Eb6:2 D6:2 C6:2 B5:8 | Ab5:2 G5:2 F#5:2 G5:2 Ab5:2 B5:2 C6:2 D6:2 | Eb6:4 D6:4 B5:4 G5:4',
          p2: B(X1, X2, X1, X2, X1, X2, X1, G),
          tr: riff,
          nz: dr
        },
        B: {
          p1: 'Ab5:2 .:2 Ab5:2 .:2 C6:4 Eb6:4 | Bb5:2 .:2 Bb5:2 .:2 D6:4 F6:4 | F#5 G5 F#5 G5 A5:4 C6:4 Eb6:4 | D6:4 B5:4 G5:4 D5:4 | ' +
              'Ab5:2 C6:2 Eb6:2 C6:2 Ab5:2 C6:2 Eb6:2 G6:2 | F6:4 D6:4 Bb5:4 F5:4 | F#5:2 A5:2 C6:2 Eb6:2 F#6:4 Eb6:4 | D6:2 C6:2 B5:2 G5:2 D5:2 B4:2 G4:4',
          p2: B(Ab, Bb, Fd, G, Ab, Bb, Fd, G),
          tr: B(ob('Ab', 1), ob('Bb', 1), ob('F#', 1), ob('G', 1), ob('Ab', 1), ob('Bb', 1), ob('F#', 1), 'G1 G1 G2 G1 G1 G2 G1 G2 B1 B1 B2 B1 D2 D2 D3 D2'),
          nz: B(dr, dr, dr, dr, dr, dr, dr, 's s s s s s s s s! s! s! s! s! s! s! s!')
        }
      },
      seq: ['A', 'B', 'A+1', 'B+1']
    };
  })();

  // SAFE - lounge bar tune: swung triplet feel, jazzy 7ths, Bb major
  (function () {
    function cp(x) { return '.:3 ' + x + ':2 .:1 .:3 ' + x + ':2 .:1'; }
    var Bb = 'Bb3+47b', Gm = 'G3+37a', Cm = 'C4+37a', F7 = 'F3+47a', Eb = 'Eb4+47b', Ab7 = 'Ab3+47a', Dm = 'D4+37a', G7 = 'G3+47a';
    var dr = 'k:3 h:2 h:1 s?:3 h:2 h:1';
    SONGS.safe = {
      bpm: 92, spb: 3, bar: 12, inst: { p1: I('lead50', { v: 0.11, vib: 18, vibD: 0.25 }), p2: I('stab', { v: 0.07, d: 0.2, s: 0.4 }), tr: 'bass' },
      parts: {
        A: {
          p1: 'D5:3 F5:2 A5:1 G5:6 | F5:3 D5:2 Bb4:1 D5:6 | Eb5:3 G5:2 Bb5:1 A5:3 G5:3 | F5:9 .:3 | D5:3 F5:2 A5:1 C6:6 | Bb5:3 A5:2 G5:1 F5:3 D5:3 | Eb5:2 F5:1 G5:2 A5:1 Bb5:3 G5:3 | A5:3 F5:3 .:6',
          p2: B(cp(Bb), cp(Gm), cp(Cm), cp(F7), cp(Bb), cp(Gm), cp(Cm), cp(F7)),
          tr: 'Bb1:3 D2:3 F2:3 A2:3 | G1:3 Bb1:3 D2:3 F2:3 | C2:3 Eb2:3 G2:3 Bb2:3 | F2:3 Eb2:3 C2:3 B1:3 | Bb1:3 D2:3 F2:3 A2:3 | G1:3 Bb1:3 D2:3 F2:3 | C2:3 Eb2:3 G2:3 Bb2:3 | F2:3 A2:3 C3:3 A2:3',
          nz: dr
        },
        B: {
          p1: 'G5:3 Bb5:2 D6:1 C6:6 | C6:3 Bb5:2 Ab5:1 Gb5:6 | F5:3 A5:2 C6:1 A5:6 | B5:3 A5:2 G5:1 F5:6 | Eb5:3 G5:2 Bb5:1 D6:6 | C6:3 A5:2 F5:1 Eb5:6 | D5:3 F5:2 Bb5:1 A5:6 | C5:3 Eb5:2 F5:1 A5:6',
          p2: B(cp(Eb), cp(Ab7), cp(Dm), cp(G7), cp(Cm), cp(F7), cp(Bb), cp(F7)),
          tr: 'Eb2:3 G2:3 Bb2:3 A2:3 | Ab1:3 C2:3 Eb2:3 C#2:3 | D2:3 F2:3 A2:3 Ab2:3 | G1:3 B1:3 D2:3 Db2:3 | C2:3 Eb2:3 G2:3 E2:3 | F1:3 A1:3 C2:3 B1:3 | Bb1:3 D2:3 F2:3 E2:3 | F2:3 Eb2:3 C2:3 B1:3',
          nz: B(dr, dr, dr, dr, dr, dr, dr, 'k:3 h:2 h:1 s?:2 s?:1 s:2 s:1')
        }
      },
      seq: ['A', 'B']
    };
  })();

  // RESULTS - short victory jingle (one-shot)
  SONGS.results = {
    bpm: 150, loop: false, inst: { p1: 'brass', p2: I('lead50', { v: 0.09 }), tr: 'bass' },
    parts: {
      A: {
        p1: 'C5 E5 G5 C6 . G5 C6 E6 . C6 E6 G6:5 | F6:2 E6:2 D6:2 E6:2 C6:8',
        p2: 'G4 C5 E5 G5 . E5 G5 C6 . G5 C6 E6:5 | A5:2 G5:2 F5:2 G5:2 E5:8',
        tr: 'C3:4 .:4 C3:4 .:4 | F2:4 G2:4 C3:8',
        nz: 'k:4 s:4 k:4 s:4 | s s s s s:2 s:2 c:8'
      }
    },
    seq: ['A']
  };

  // GAMEOVER - sad descending jingle (one-shot)
  SONGS.gameover = {
    bpm: 96, loop: false, inst: { p1: I('lead50', { vib: 22, vibD: 0.2 }), p2: I('lead', { v: 0.09, vib: 0 }), tr: 'bass' },
    parts: {
      A: {
        p1: 'C5:4 B4:4 Bb4:4 A4:4 | Ab4:6 G4:2 F#4:4 G4:4 | C4:16',
        p2: 'G4:4 F#4:4 F4:4 E4:4 | Eb4:6 D4:2 C4:4 B3:4 | G3:16',
        tr: 'C3:16 | Ab2:8 G2:8 | C2:16',
        nz: 'k?:16 | .:16 | K:16'
      }
    },
    seq: ['A']
  };

  // ENDING - triumphant + bittersweet credits, C major / A minor
  (function () {
    var C = ap('C4', 'E4', 'G4', 'E4'), G = ap('B3', 'D4', 'G4', 'D4'), Am = ap('A3', 'C4', 'E4', 'C4'), F = ap('A3', 'C4', 'F4', 'C4'),
        Em = ap('B3', 'E4', 'G4', 'E4'), Dm = ap('A3', 'D4', 'F4', 'D4');
    function r2(r, f) { return r + ':8 ' + f + ':8'; }
    var dr = 'k:4 h:4 s:4 h:2 h:2';
    SONGS.ending = {
      bpm: 100, inst: { p1: I('lead', { vib: 16 }), p2: 'arp', tr: 'bass' },
      parts: {
        A: {
          p1: 'E5:6 D5:2 C5:4 G5:4 | G5:6 F5:2 D5:8 | C5:6 B4:2 A4:4 E5:4 | F5:6 E5:2 C5:8 | E5:4 G5:4 C6:6 B5:2 | B5:4 A5:4 G5:8 | A5:4 G5:4 F5:4 E5:4 | D5:12 .:4',
          p2: B(C, G, Am, F, C, G, F, G),
          tr: B(r2('C2', 'G2'), r2('B1', 'G2'), r2('A1', 'E2'), r2('F1', 'C2'), r2('C2', 'G2'), r2('G1', 'D2'), r2('F1', 'C2'), r2('G1', 'D2')),
          nz: dr
        },
        B: {
          p1: '@brass C6:6 B5:2 A5:4 E5:4 | G5:6 F#5:2 E5:4 B4:4 | A5:6 G5:2 F5:4 C5:4 | E5:6 D5:2 C5:8 | D5:4 F5:4 A5:4 C6:4 | B5:4 D6:4 G5:8 | E6:6 D6:2 C6:8 | C6:12 .:4',
          p2: B(Am, Em, F, C, Dm, G, C, C),
          tr: B(r2('A1', 'E2'), r2('E2', 'B2'), r2('F1', 'C2'), r2('C2', 'G2'), r2('D2', 'A2'), r2('G1', 'D2'), r2('C2', 'G2'), r2('C2', 'G2')),
          nz: B(dr, dr, dr, dr, dr, dr, 'k:2 k:2 s:4 k:2 k:2 s:2 s:2', 'c:8 s:2 s:2 s:2 s:2')
        }
      },
      seq: ['A', 'B']
    };
  })();

  // LOOTBOX - suspense drumroll loop (32nd-note roll, rising bass)
  SONGS.lootbox = {
    bpm: 110, spb: 8, bar: 32, inst: { p1: I('thin', { v: 0.06, vib: 30, vibD: 0.05, vibR: 9 }), p2: I('lead50', { v: 0.05, vib: 20, vibD: 0.05 }), tr: 'bass' },
    parts: {
      A: {
        p1: 'G5:32 | G#5:32 | A5:32 | A#5:32',
        p2: 'C5:32 | C#5:32 | D5:32 | D#5:32',
        tr: 'C2:32 | C#2:32 | D2:32 | D#2:32',
        nz: B('k ' + R('r?', 15) + ' ' + R('r', 16), 'k ' + R('r?', 15) + ' ' + R('r', 16), 'k ' + R('r', 31), 'k ' + R('r', 23) + ' ' + R('r!', 8))
      }
    },
    seq: ['A']
  };

  // FLOOR 10 - the races: high-octane driving theme, D mixolydian / B minor, engine-buzz hats
  (function () {
    function drv(n, o) { o = o || 2; return R(n + o + ' ' + n + o + ' ' + n + (o + 1) + ' ' + n + o, 4); } // 16th pumping bass bar
    var Dd = a16('D4', 'F#4', 'A4', 'D5'), Cc = a16('C4', 'E4', 'G4', 'C5'), Gg = a16('B3', 'D4', 'G4', 'B4'), Aa = a16('C#4', 'E4', 'A4', 'C#5'),
        Bm = a16('B3', 'D4', 'F#4', 'B4'), Ee = a16('B3', 'E4', 'G#4', 'B4'), Ff = a16('A3', 'C4', 'F4', 'A4');
    var g = 'k e h e s e h e k e k e s e h e';
    SONGS.floor10 = {
      bpm: 168, inst: { p1: I('lead', { vib: 10, vibD: 0.14 }), p2: 'arp', tr: 'bassS' },
      parts: {
        A: {
          p1: 'A4:2 D5:2 F#5:2 A5:4 F#5:2 A5:2 B5:2 | A5:6 F#5:2 D5:4 E5:4 | G5:2 E5:2 C5:2 G5:4 A5:2 G5:2 E5:2 | D5:6 E5:2 G5:4 B5:4 | ' +
              'A5:2 D6:2 C6:2 D6:4 A5:2 F#5:2 A5:2 | G5:4 E5:2 G5:2 C6:4 B5:2 A5:2 | B5:2 A5:2 G5:2 A5:2 B5:4 D6:4 | C#6:4 B5:2 A5:2 E5:4 A5:4',
          p2: B(Dd, Dd, Cc, Gg, Dd, Cc, Gg, Aa),
          tr: B(drv('D'), drv('D'), drv('C'), drv('G'), drv('D'), drv('C'), drv('G'), drv('A')),
          nz: B('c e h e s e h e k e k e s e h e', RB(g, 7))
        },
        B: {
          p1: 'F#5:6 D5:2 B4:4 D5:4 | G5:6 D5:2 B4:4 G5:4 | F#5:4 A5:4 D6:6 C#6:2 | E6:8 C#6:4 A5:4 | ' +
              'B5:2 A5:2 F#5:2 D5:2 B4:2 D5:2 F#5:2 B5:2 | D6:2 B5:2 G5:2 D5:2 G5:2 B5:2 D6:2 G6:2 | G#6:4 E6:4 B5:4 G#5:4 | A5:4 E5:2 A5:2 C#6:4 E6:4',
          p2: B(Bm, Gg, Dd, Aa, Bm, Gg, Ee, Aa),
          tr: B(drv('B', 1), drv('G'), drv('D'), drv('A'), drv('B', 1), drv('G'), drv('E'), drv('A')),
          nz: B(RB(g, 7), 's s s s s s s s s! s! s! s! v:4')
        },
        C: {
          p1: 'F5:2 A5:2 C6:2 F6:4 C6:2 A5:2 C6:2 | G5:2 B5:2 D6:2 G6:4 D6:2 B5:2 D6:2 | A5:2 C#6:2 E6:2 A6:4 E6:2 C#6:2 E6:2 | A6:2 G6:2 E6:2 C#6:2 A5:2 G5:2 E5:2 C#5:2',
          p2: B(Ff, Gg, Aa, Aa),
          tr: B(drv('F'), drv('G'), drv('A'), 'A2 A2 A3 A2 A2 A2 A3 A2 A2 A3 A2 A3 E2:2 C#2:2'),
          nz: B('k e s e k e s e k e s e k e s e', 'k e s e k e s e k e s e k e s e', 'k s k s k s k s s s s s s s s s', 's! s s s s! s s s s! s! s! s! v:4')
        }
      },
      seq: ['A', 'B', 'A', 'C']
    };
  })();

  // OW10 - suburban cul-de-sac: sunny, smug swung stroll (triplet shuffle), G major
  (function () {
    function ch(x) { return '.:3 ' + x + ':2 ' + x + ':1 .:3 ' + x + ':3'; }
    function ch2(x, y) { return '.:3 ' + x + ':2 ' + x + ':1 .:3 ' + y + ':3'; }
    var G = 'G3+47', Em = 'E4+37', Am = 'A3+37', D7 = 'D4+47a', E7 = 'E4+47a', A7 = 'A3+47a', C = 'C4+47', Cm = 'C4+37';
    var dr = 'k:2 h:1 h:2 h:1 s:2 h:1 h:2 k:1';
    SONGS.ow10 = {
      bpm: 112, spb: 3, bar: 12,
      inst: { p1: I('lead50', { v: 0.12, vib: 20, vibD: 0.15, vibR: 5.5, echo: { steps: 3, v: 0.25 } }), p2: I('stab', { v: 0.075, d: 0.15, s: 0.35 }), tr: 'bass' },
      parts: {
        A: {
          p1: 'B4:2 D5:1 G5:3 F#5:2 G5:1 E5:3 | D5:2 B4:1 G4:3 .:2 G4:1 B4:2 D5:1 | C5:2 E5:1 A5:3 G#5:2 A5:1 C6:3 | B5:3 A5:2 F#5:1 D5:6 | ' +
              'B4:2 D5:1 G5:3 F#5:2 G5:1 B5:3 | G#5:2 B5:1 D6:3 C6:2 B5:1 G#5:3 | A5:2 C6:1 E6:2 D6:1 C6:2 A5:1 F#5:3 | G5:3 D5:2 B4:1 G4:3 .:3',
          p2: B(ch(G), ch(Em), ch(Am), ch(D7), ch(G), ch(E7), ch2(Am, D7), ch(G)),
          tr: 'G2:3 B2:3 D3:3 B2:3 | E2:3 G2:3 B2:3 G2:3 | A2:3 C3:3 E3:3 C3:3 | D2:3 F#2:3 A2:3 C3:3 | ' +
              'G2:3 B2:3 D3:3 B2:3 | E2:3 G#2:3 B2:3 D3:3 | A2:3 E2:3 D2:3 F#2:3 | G2:3 D2:3 G2:3 B2:3',
          nz: dr
        },
        B: {
          p1: 'E5:2 G5:1 C6:3 B5:2 C6:1 E6:3 | Eb6:3 D6:2 C6:1 G5:6 | D5:2 G5:1 B5:3 A5:2 G5:1 D5:3 | E5:2 G#5:1 B5:3 D6:6 | ' +
              'C#6:2 B5:1 A5:3 G5:2 A5:1 E5:3 | F#5:2 A5:1 C6:3 B5:2 A5:1 F#5:3 | G5:2 B5:1 D6:3 E6:2 D6:1 B5:3 | C6:2 B5:1 A5:2 G5:1 F#5:2 E5:1 D5:3',
          p2: B(ch(C), ch(Cm), ch(G), ch(E7), ch(A7), ch(D7), ch2(G, Em), ch2(Am, D7)),
          tr: 'C2:3 E2:3 G2:3 E2:3 | C2:3 Eb2:3 G2:3 Eb2:3 | G2:3 B2:3 D3:3 B2:3 | E2:3 G#2:3 B2:3 D3:3 | ' +
              'A2:3 C#3:3 E3:3 C#3:3 | D2:3 F#2:3 A2:3 C3:3 | G2:3 B2:3 E2:3 G2:3 | A2:3 C3:3 D3:3 F#2:3',
          nz: B(RB(dr, 7), 'k:2 h:1 s:2 s:1 s:2 s:1 s:2 s:1')
        }
      },
      seq: ['A', 'B']
    };
  })();

  // FLOOR 11 - the parade: big brassy march (oom-pah, snare rolls), Bb major with a trio in Eb
  (function () {
    function op(r, f) { return r + ':3 . ' + f + ':3 . ' + r + ':3 . ' + f + ':3 .'; }    // staccato oom-pah bass bar
    function pah(x) { return '.:4 ' + x + ':3 .:1 .:4 ' + x + ':3 .:1'; }                 // afterbeats on 2 and 4
    var dr = 'K:2 s? s? s:2 s?:2 K:2 s? s? z z z s!';
    var dr2 = 'K:2 s:2 K:2 s:2 K:2 s s z z s!:2';
    var roll = 'z? z? z? z? z z z z z z z z s! . s! .';
    var Bb = 'Bb3+47', F7 = 'A3+36', Eb = 'Eb4+47', Gm = 'G3+37', Dm = 'D4+37', Cm = 'C4+37';
    SONGS.floor11 = {
      bpm: 120, loopFrom: 1, inst: { p1: I('brass', { v: 0.17 }), p2: I('horn', { v: 0.085 }), tr: 'bass' },
      parts: {
        I: {
          p1: 'F4 . F4 . F4 . Bb4:6 D5:4 | F5:12 .:4',
          p2: 'D4 . D4 . D4 . F4:6 Bb4:4 | A4:12 .:4',
          tr: 'Bb1:4 .:12 | F1:12 .:4',
          nz: 'z? z? z? z? z? z? z? z? z z z z z z z z | z z z z z z z z z z z z s! . K! .'
        },
        A: {
          p1: 'Bb4:2 .:1 Bb4:1 D5:2 F5:2 Bb5:6 A5:2 | G5:2 F5:2 D5:2 Bb4:2 F5:8 | A4:2 .:1 A4:1 C5:2 Eb5:2 A5:6 G5:2 | F5:2 Eb5:2 D5:2 C5:2 D5:8 | ' +
              'Eb5:2 .:1 Eb5:1 G5:2 Bb5:2 Eb6:6 D6:2 | D6:2 C6:2 Bb5:2 F5:2 D5:4 F5:4 | E5:2 G5:2 Bb5:2 C6:2 F5:2 A5:2 C6:2 Eb6:2 | D6:4 F6:4 Bb5:6 .:2',
          p2: B(pah(Bb), pah(Bb), pah(F7), pah(Bb), pah(Eb), pah(Bb), '.:4 E4+36:3 .:1 .:4 A3+36:3 .:1', pah(Bb)),
          tr: B(op('Bb1', 'F2'), op('Bb1', 'F2'), op('F1', 'C2'), op('Bb1', 'F2'), op('Eb2', 'Bb1'), op('Bb1', 'F2'), 'C2:3 . G1:3 . F1:3 . C2:3 .', 'Bb1:3 . F1:3 . Bb1:2 C2:2 D2:2 F2:2'),
          nz: B('c:2 s? s? s:2 s?:2 K:2 s? s? z z z s!', RB(dr, 6), roll)
        },
        B: {
          p1: 'D5:6 G5:2 Bb5:4 A5:4 | A5:6 F5:2 D5:8 | G5:6 Bb5:2 Eb6:4 D6:4 | D6:6 C6:2 Bb5:8 | ' +
              'C6:4 Eb6:4 G5:4 C6:4 | A5:4 C6:4 F6:4 Eb6:4 | D6:4 Bb5:4 B5:4 D6:4 | C6:2 Bb5:2 G5:2 Eb5:2 F5:2 Ab5:2 Bb5:2 D6:2',
          p2: B(st(Gm), st(Dm), st(Eb), st(Bb), st(Cm), st(F7), '.:2 Bb3+47:2 .:2 Bb3+47:2 .:2 B3+36:2 .:2 B3+36:2', '.:2 C4+37:2 .:2 C4+37:2 .:2 D4+36:2 .:2 D4+36:2'),
          tr: B(op('G1', 'D2'), op('D2', 'A1'), op('Eb2', 'Bb1'), op('Bb1', 'F2'), op('C2', 'G1'), op('F1', 'C2'), 'Bb1:3 . F2:3 . G1:3 . D2:3 .', 'C2:3 . G1:3 . Bb1:3 . F1:3 .'),
          nz: B(RB(dr2, 7), roll)
        },
        T: {
          p1: 'G5:6 Ab5:2 Bb5:8 | C6:6 Bb5:2 Ab5:4 C6:4 | Bb5:6 G5:2 Eb5:4 G5:4 | F5:4 Ab5:4 D6:4 C6:4 | ' +
              'Bb5:6 C6:2 Eb6:8 | Eb6:4 C6:4 Ab5:4 F5:4 | G5:4 Bb5:4 E6:4 C6:4 | F6:2 Eb6:2 C6:2 A5:2 F5:2 Eb5:2 C5:2 A4:2',
          p2: '@picc ' + B(ap('G6', 'Bb6', 'Eb7', 'Bb6'), ap('Ab6', 'C7', 'Eb7', 'C7'), ap('G6', 'Bb6', 'Eb7', 'Bb6'), ap('F6', 'Ab6', 'D7', 'Ab6'),
            ap('G6', 'Bb6', 'Eb7', 'Bb6'), ap('Ab6', 'C7', 'Eb7', 'C7'), 'G6:2 Bb6:2 Eb7:2 Bb6:2 G6:2 Bb6:2 E7:2 Bb6:2', 'F6:2 A6:2 C7:2 Eb7:2 C7:2 A6:2 F6:2 Eb6:2'),
          tr: B(op('Eb2', 'Bb1'), op('Ab1', 'Eb2'), op('Eb2', 'Bb1'), op('Bb1', 'F2'), op('Eb2', 'Bb1'), op('Ab1', 'Eb2'), 'Eb2:3 . Bb1:3 . C2:3 . G1:3 .', 'F1:3 . C2:3 . F2:2 Eb2:2 D2:2 C2:2'),
          nz: B('c:2 s:2 K:2 s:2 K:2 s s z z s!:2', RB(dr2, 6), roll)
        }
      },
      insts: { picc: I('thin', { v: 0.045, gate: 0.6, d: 0.12, s: 0.4 }) },
      seq: ['I', 'A', 'B', 'T']
    };
  })();

  // OW11 - parade staging grounds: festive fairground calliope waltz (3/4, step = 8th), C major
  (function () {
    function wz(x) { return '.:2 ' + x + ':2 ' + x + ':2'; }
    function bw(n) { return n + ':2 .:4'; }
    var C = 'C4+47', G7 = 'G3+47a', F = 'F3+47', Am = 'A3+37', Dm = 'D4+37', Gc = 'G3+47';
    function bars(chs, bass) { return { p2: B.apply(null, chs.map(wz)), tr: B.apply(null, bass.map(bw)) }; }
    var dA = B('k:2 h:2 h:2', 'k:2 h:2 h:1 m:1', 'k:2 h:2 h:2', 'k:2 s?:2 h:2');
    var hA = bars([C, C, G7, G7, G7, G7, C, C, C, C, F, F, C, G7, C, C],
      ['C2', 'G1', 'G1', 'D2', 'G1', 'D2', 'C2', 'G1', 'C2', 'G1', 'F1', 'C2', 'C2', 'G1', 'C2', 'G1']);
    var hB = bars([F, F, C, C, G7, G7, C, C, Am, Am, Dm, Dm, Gc, G7, C, C],
      ['F1', 'C2', 'C2', 'G1', 'G1', 'D2', 'C2', 'G1', 'A1', 'E2', 'D2', 'A1', 'G1', 'D2', 'C2', 'G1']);
    SONGS.ow11 = {
      bpm: 176, spb: 2, bar: 6,
      inst: { p1: I('organ', { v: 0.115, vib: 22, vibD: 0.06, vibR: 6.5, arpT: 1 / 30 }), p2: I('organ2', { v: 0.075, gate: 0.7 }), tr: 'bassS' },
      parts: {
        A: {
          p1: 'E5:2 G5:2 C6:2 | E6:4 D6:1 C6:1 | B5:2 G5:2 D5:2 | F5:4 E5:1 F5:1 | G5:2 F5:2 D5:2 | B4:4 C5:1 D5:1 | E5:2 G5:2 E5:2 | C5:4 .:2 | ' +
              'E5:2 G5:2 C6:2 | E6:4 F6:1 E6:1 | D6:2 C6:2 A5:2 | F5:4 A5:2 | G5:2 E5:2 C6:2 | B5:2 A5:2 G5:1 F5:1 | E5:2 C5:2 G4:2 | C5:4 .:2',
          p2: hA.p2, tr: hA.tr,
          nz: B(dA, dA, dA, 'k:2 h:2 h:2 | k:2 h:2 h:2 | k:2 s:2 s:2 | s s s s c:2')
        },
        B: {
          p1: 'A5:2 C6:2 F6:2 | F6+2:4 E6:1 D6:1 | C6:2 G5:2 E5:2 | C6:4 .:2 | B5:2 D6:2 F6:2 | F6+1:4 E6:1 D6:1 | E6:2 C6:2 G5:2 | E5:4 .:2 | ' +
              'A5:2 C6:2 E6:2 | E6+1:4 D6:1 C6:1 | D6:2 F6:2 A5:2 | F5:4 G5:1 A5:1 | B5:2 D6:2 G6:2 | F6:2 D6:2 B5:2 | C6:2 G5:2 E5:2 | C5:4 G4:2',
          p2: hB.p2, tr: hB.tr,
          nz: B(dA, dA, dA, 'k:2 h:2 h:2 | k:2 h:2 h:2 | k:2 h:2 m:1 m:1 | k:2 s:2 s s')
        }
      },
      seq: ['A', 'B']
    };
  })();

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
  var DUCK = { fanfare: 1, unlock: 1, level_up: 1, achievement: 1, boss_die: 1 };

  /* ================================================================== live state + API */
  var ctx = null, E = null, unlocked = false, inited = false, timer = null;
  var cur = null, fadingOut = [], voices = [], lastPlay = {}, compiled = {}, warned = {};
  var MAX_VOICES = 14, LOOKAHEAD = 0.18;

  function getSong(name) { if (!compiled[name]) compiled[name] = compileSong(name, SONGS[name]); return compiled[name]; }
  function warnOnce(k, msg) { if (!warned[k]) { warned[k] = 1; try { console.warn('[audio] ' + msg); } catch (e) { /* ignore */ } } }
  function volCurve(v) { v = Math.max(0, Math.min(1, +v)); return Math.pow(v, 1.5); }
  function settings() { return (DCW.save && DCW.save.settings) || {}; }

  A.current = null;
  A.tracks = Object.keys(SONGS);
  A.sfxNames = Object.keys(SFX);
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
    cur = new Player(E, song, g, t0); cur.name = name; cur.gain = g;
    cur.pump(now + LOOKAHEAD, now);
  }
  function stopCur(fade) {
    if (!cur) return;
    var now = ctx.currentTime, g = cur.gain;
    try { g.gain.cancelScheduledValues(now); g.gain.setValueAtTime(g.gain.value, now); g.gain.linearRampToValueAtTime(0, now + fade); } catch (e) { /* ignore */ }
    fadingOut.push({ g: g, until: now + fade + LOOKAHEAD + 0.1 });
    cur = null;
  }

  A.music = function (name) {
    try {
      if (name === undefined || name === '') name = null;
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
    var s = getSong(name);
    return { name: name, loop: s.loop, introSec: s.introSec, loopSec: s.loopSec, totalSec: s.totalSec, events: s.evs.length, warns: s.warns.slice() };
  };
  A.debugState = function () {
    return { unlocked: unlocked, state: ctx && ctx.state, current: A.current, playing: cur && cur.name, voices: voices.length, fading: fadingOut.length };
  };
  // Render a track or sfx into an OfflineAudioContext using the same graph code.
  // Resolves to {name, kind, sec, peak, rms, clipped, longestSilence, firstSound, loopSeamRms, ...}.
  // opts: {secs, sr, raw (skip compressor/limiter), vol (bus gain, default 1)}
  A.renderOffline = function (kind, name, opts) {
    if (!OAC) return Promise.reject(new Error('no OfflineAudioContext'));
    opts = opts || {};
    var sr = opts.sr || 22050, secs = opts.secs;
    var info = kind === 'music' ? A.songInfo(name) : null;
    if (kind === 'music' && !info) return Promise.reject(new Error('no track ' + name));
    if (kind === 'sfx' && !SFX[name]) return Promise.reject(new Error('no sfx ' + name));
    if (!secs) secs = kind === 'music' ? (info.loop ? info.introSec + info.loopSec * 2 + 0.5 : info.totalSec + 1.5) : 2.5;
    var oc = new OAC(2, Math.ceil(sr * secs), sr), e = makeEngine(oc, !!opts.raw), sfxEnd = 0, wall = Date.now();
    var vol = opts.vol != null ? opts.vol : 1;
    e.musicBus.gain.value = vol; e.sfxBus.gain.value = vol;
    if (kind === 'music') {
      // schedule in 0.5s windows like the live lookahead scheduler, so only a few nodes exist at once
      var pl = new Player(e, getSong(name), e.musicBus, 0.01), CH = 0.5;
      pl.pump(CH + LOOKAHEAD, null);
      for (var ts = CH; ts < secs; ts += CH) {
        (function (tsv) { oc.suspend(tsv).then(function () { pl.pump(tsv + CH + LOOKAHEAD, null); oc.resume(); }); })(ts);
      }
    } else sfxEnd = SFX[name](e, e.sfxBus, 0.01, 1);
    return oc.startRendering().then(function (buf) {
      var d = buf.getChannelData(0), n = d.length, peak = 0, sum = 0, clipped = 0, i;
      for (i = 0; i < n; i++) { var x = d[i], ax = x < 0 ? -x : x; if (ax > peak) peak = ax; if (ax > 0.999) clipped++; sum += x * x; }
      var win = Math.round(sr * 0.02), nw = Math.floor(n / win), wr = new Float32Array(nw), w, k;
      for (w = 0; w < nw; w++) { var s2 = 0; for (k = w * win; k < (w + 1) * win; k++) s2 += d[k] * d[k]; wr[w] = Math.sqrt(s2 / win); }
      var first = -1, lastW = -1; for (w = 0; w < nw; w++) if (wr[w] > 1e-3) { if (first < 0) first = w; lastW = w; }
      var longest = 0, runw = 0;
      for (w = Math.max(0, first); w <= lastW; w++) { if (wr[w] < 1e-3) { runw++; if (runw > longest) longest = runw; } else runw = 0; }
      var res = { kind: kind, name: name, sec: +secs.toFixed(2), renderMs: Date.now() - wall, peak: +peak.toFixed(3), rms: +Math.sqrt(sum / n).toFixed(4), clipped: clipped,
        firstSound: first < 0 ? null : +(first * 0.02).toFixed(2), lastSound: lastW < 0 ? null : +(lastW * 0.02).toFixed(2), longestSilence: +(longest * 0.02).toFixed(2) };
      if (info) {
        res.introSec = +info.introSec.toFixed(2); res.loopSec = +info.loopSec.toFixed(2); res.loop = info.loop; res.warns = info.warns;
        if (info.loop) { // RMS around the first loop seam vs overall
          var seam = 0.01 + info.introSec + info.loopSec, a = Math.floor((seam - 0.3) / 0.02), b = Math.floor((seam + 0.3) / 0.02), ss = 0, c = 0;
          for (w = Math.max(0, a); w < Math.min(nw, b); w++) { ss += wr[w]; c++; }
          res.seamRms = +(ss / Math.max(1, c)).toFixed(4);
        }
      } else res.dur = +(sfxEnd - 0.01).toFixed(2);
      return res;
    });
  };
})();

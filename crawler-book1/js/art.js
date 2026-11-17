/* ============================================================
   DCC BOOK ONE ART (art-world) - rasterizer + sprite API, tiles,
   parallax backgrounds, safe room interiors, cutscene backdrops,
   fx, projectiles, pickups, objects, HUD icons.
   See ../DESIGN.md "The 8-bit rules", "Art" and "Art contract".

   STRICT NES: every pixel this file produces is a 2C02 colour
   (the `Q` table below = the `C` table of art_actors.js). There is
   no alpha blending, no gradient and no glow anywhere: canvases are
   snapped to the palette (nesify) and alpha is binarised. Animated
   background bits (torches, TVs, neon) flicker by swapping 2 frames.

   Actor pixel data (Carl, companions, enemies, bosses, NPCs,
   portraits) lives in art_actors.js in DCW.artDefs / artProcs /
   artSkins; this file rasterizes everything into cached canvases.

   Notes / small extensions to the contract:
   - def.ox / def.oy shift the feet anchor inside the sprite: the
     anchor sits at (floor(w/2)+ox, h+oy) in sprite pixels, so oy=-2
     means "feet are 2px above the bottom edge". Flip mirrors ox.
   - procs may set `outline: '#000000'` to get an automatic 1px outline
     around their opaque pixels (leave a 1px transparent margin).
   - proc.draw(g, frame, pal) - pal is the skin palette for carl_* procs.
   - sprite({alpha}) never blends: alpha < 1 draws on every other frame
     (NES flicker), alpha <= 0 draws nothing.
   - HUD icons are stored as 'icon_<name>' (icon() also accepts a bare
     sprite name as a fallback).
   - tile() info may carry tx, ty (world tile coords) for texture
     variation; without them every tile uses variant 0. info.open (0..1)
     raises an 'L' gate. Unknown themes draw as `tunnels`.
   - background ids: the stage themes (art.themes) plus background-only
     ids (art.backdrops): safe room interiors and cutscene backdrops.
     Unknown ids draw as `tunnels`. Safe room ids also work as tile
     themes (each has its own floor), falling back to `safe`.
   - bgLights() is kept for compatibility and pushes nothing.
   - owTile() is a no-op (Book One has no overworld).
   - extra helpers: art.names(), art.refresh(name), art.themes,
     art.backdrops, art.sheet(name) -> {canvas,w,h,frames},
     art.prepare(theme), art.ownNames, art.NES, art.nes(color),
     art.tinyText(ctx, str, x, y, color) (3x5 font, uppercase).
   ============================================================ */
(function () {
  'use strict';
  var DCW = window.DCW = window.DCW || {};
  DCW.artDefs = DCW.artDefs || {};
  DCW.artProcs = DCW.artProcs || {};
  DCW.artSkins = DCW.artSkins || {};
  var art = DCW.art = DCW.art || {};

  /* ---------------- NES 2C02 palette ---------------- */
  var N = [
    '#7c7c7c', '#0000fc', '#0000bc', '#4428bc', '#940084', '#a80020', '#a81000', '#881400', '#503000', '#007800', '#006800', '#005800', '#004058', '#000000', '#000000', '#000000',
    '#bcbcbc', '#0078f8', '#0058f8', '#6844fc', '#d800cc', '#e40058', '#f83800', '#e45c10', '#ac7c00', '#00b800', '#00a800', '#00a844', '#008888', '#000000', '#000000', '#000000',
    '#f8f8f8', '#3cbcfc', '#6888fc', '#9878f8', '#f878f8', '#f85898', '#f87858', '#fca044', '#f8b800', '#b8f818', '#58d854', '#58f898', '#00e8d8', '#787878', '#000000', '#000000',
    '#fcfcfc', '#a4e4fc', '#b8b8f8', '#d8b8f8', '#f8b8f8', '#f8a4c0', '#f0d0b0', '#fce0a8', '#f8d878', '#d8f878', '#b8f8b8', '#b8f8d8', '#00fcfc', '#f8d8f8', '#000000', '#000000'
  ];
  art.NES = N;
  // named colours (same keys as the C table in art_actors.js)
  var Q = {
    K: '#000000', W: '#fcfcfc',
    g0: '#7c7c7c', g1: '#bcbcbc', g2: '#f8f8f8', g3: '#787878',
    b0: '#0000fc', b1: '#0000bc', b2: '#0078f8', b3: '#0058f8', b4: '#3cbcfc', b5: '#6888fc', b6: '#a4e4fc', b7: '#b8b8f8',
    p0: '#4428bc', p1: '#6844fc', p2: '#9878f8', p3: '#d8b8f8',
    m0: '#940084', m1: '#d800cc', m2: '#f878f8', m3: '#f8b8f8',
    r0: '#a80020', r1: '#e40058', r2: '#f85898', r3: '#f8a4c0',
    o0: '#a81000', o1: '#f83800', o2: '#f87858', o3: '#f0d0b0',
    n0: '#881400', n1: '#e45c10', n2: '#fca044', n3: '#fce0a8',
    y0: '#503000', y1: '#ac7c00', y2: '#f8b800', y3: '#f8d878',
    l0: '#007800', l1: '#00b800', l2: '#b8f818', l3: '#d8f878',
    G0: '#006800', G1: '#00a800', G2: '#58d854', G3: '#b8f8b8',
    t0: '#005800', t1: '#00a844', t2: '#58f898', t3: '#b8f8d8',
    c0: '#004058', c1: '#008888', c2: '#00e8d8', c3: '#00fcfc'
  };
  art.Q = Q;
  var K = Q.K, WH = Q.W, MAG = Q.m1;

  /* ---------------- small utils ---------------- */
  function mkCanvas(w, h) { var c = document.createElement('canvas'); c.width = Math.max(1, w | 0); c.height = Math.max(1, h | 0); return c; }
  function g2(c) { var g = c.getContext('2d'); g.imageSmoothingEnabled = false; return g; }
  function rng(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0; var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function hashStr(s) { var h = 2166136261; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function hash2(x, y) { var h = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263); h = Math.imul(h ^ (h >>> 13), 1274126177); return (h ^ (h >>> 16)) >>> 0; }
  var rgbCache = {};
  function parseColor(c) {
    var r = rgbCache[c];
    if (r) return r;
    var s = String(c).trim(), m;
    if (s.charAt(0) === '#') {
      if (s.length === 4) r = [parseInt(s[1] + s[1], 16), parseInt(s[2] + s[2], 16), parseInt(s[3] + s[3], 16), 255];
      else r = [parseInt(s.substr(1, 2), 16), parseInt(s.substr(3, 2), 16), parseInt(s.substr(5, 2), 16), s.length >= 9 ? parseInt(s.substr(7, 2), 16) : 255];
    } else if ((m = s.match(/rgba?\(([^)]+)\)/))) {
      var p = m[1].split(',').map(parseFloat);
      r = [p[0] | 0, p[1] | 0, p[2] | 0, p.length > 3 ? Math.round(p[3] * 255) : 255];
    } else r = [216, 0, 204, 255];
    rgbCache[c] = r;
    return r;
  }
  function hex(r, g, b) { return '#' + ((1 << 24) | (Math.max(0, Math.min(255, r | 0)) << 16) | (Math.max(0, Math.min(255, g | 0)) << 8) | Math.max(0, Math.min(255, b | 0))).toString(16).slice(1); }

  // ---- palette enforcement: snap any colour to the nearest 2C02 entry ----
  var NES_RGB = (function () {
    var seen = {}, out = [];
    for (var i = 0; i < N.length; i++) if (!seen[N[i]]) { seen[N[i]] = 1; var c = parseColor(N[i]); out.push([c[0], c[1], c[2], N[i]]); }
    return out;
  })();
  var nearCache = {};
  function nearest(r, g, b) {
    var key = (r << 16) | (g << 8) | b, hit = nearCache[key];
    if (hit) return hit;
    var best = NES_RGB[0], bd = 1e9;
    for (var i = 0; i < NES_RGB.length; i++) {
      var c = NES_RGB[i], dr = r - c[0], dg = g - c[1], db = b - c[2];
      var d = dr * dr * 3 + dg * dg * 4 + db * db * 2;
      if (d < bd) { bd = d; best = c; }
    }
    nearCache[key] = best;
    return best;
  }
  function nes(col) { var c = parseColor(col); return nearest(c[0], c[1], c[2])[3]; }
  art.nes = nes;
  // snap every pixel of a canvas to the palette and binarise alpha (NES: a pixel is there or not)
  // pixel readback goes through one shared canvas flagged willReadFrequently (no console warnings,
  // and the canvases that get drawn every frame stay GPU friendly)
  var RB = null;
  function readPixels(cv) {
    var W = cv.width, H = cv.height;
    if (!RB) { RB = document.createElement('canvas'); RB.g = RB.getContext('2d', { willReadFrequently: true }); }
    if (RB.width < W) RB.width = W;
    if (RB.height < H) RB.height = H;
    RB.g.clearRect(0, 0, W, H); RB.g.drawImage(cv, 0, 0);
    return RB.g.getImageData(0, 0, W, H);
  }
  function nesify(cv) {
    var g = g2(cv), W = cv.width, H = cv.height;
    var img = readPixels(cv), d = img.data;
    for (var i = 0; i < d.length; i += 4) {
      if (d[i + 3] < 128) { d[i] = d[i + 1] = d[i + 2] = d[i + 3] = 0; continue; }
      var c = nearest(d[i], d[i + 1], d[i + 2]);
      d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    return cv;
  }
  // kept for compatibility: a blend snapped back into the palette
  function mix(a, b, t) { var x = parseColor(a), y = parseColor(b); return nes(hex(x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t)); }
  function dk(a, t) { return mix(a, K, t); }
  art.mix = mix;

  // drawing helpers shared by all procedural art
  function R(g, x, y, w, h, c) { g.fillStyle = c; g.fillRect(x, y, w, h); }
  function P(g, x, y, c) { g.fillStyle = c; g.fillRect(x, y, 1, 1); }
  function PW(g, x, y, c) { g.fillStyle = c; g.fillRect(((x % 16) + 16) % 16, ((y % 16) + 16) % 16, 1, 1); }
  function disc(g, cx, cy, r, c) { // pixel disc
    g.fillStyle = c;
    for (var y = -r; y <= r; y++) { var w = Math.floor(Math.sqrt(r * r - y * y) + 0.35); g.fillRect(cx - w, cy + y, w * 2 + 1, 1); }
  }
  function ring(g, cx, cy, r, c, th) {
    th = th || 1; g.fillStyle = c;
    for (var a = 0; a < 360; a += 2) {
      var rad = a * Math.PI / 180;
      for (var t = 0; t < th; t++) g.fillRect(Math.round(cx + Math.cos(rad) * (r - t)), Math.round(cy + Math.sin(rad) * (r - t)), 1, 1);
    }
  }
  function line(g, x0, y0, x1, y1, c) {
    g.fillStyle = c; x0 |= 0; y0 |= 0; x1 |= 0; y1 |= 0;
    var dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1, e = dx + dy;
    for (var n = 0; n < 4000; n++) {
      g.fillRect(x0, y0, 1, 1);
      if (x0 === x1 && y0 === y1) break;
      var e2 = 2 * e; if (e2 >= dy) { e += dy; x0 += sx; } if (e2 <= dx) { e += dx; y0 += sy; }
    }
  }
  // filled ellipse (pixel exact, no anti-aliasing)
  function oval(g, cx, cy, rw, rh, c) {
    g.fillStyle = c;
    for (var dy = -rh; dy <= rh; dy++) { var ww = Math.round(rw * Math.sqrt(Math.max(0, 1 - (dy * dy) / ((rh + 0.5) * (rh + 0.5))))); g.fillRect(cx - ww, cy + dy, ww * 2 + 1, 1); }
  }
  // draw pixel rows: rows = ['..kk..', ...], pal = {k:'#000'}
  function rows(g, x, y, rs, pal) {
    for (var j = 0; j < rs.length; j++) {
      var s = rs[j];
      for (var i = 0; i < s.length; i++) { var ch = s.charAt(i); if (ch === '.' || ch === ' ') continue; var c = pal[ch]; if (c) { g.fillStyle = c; g.fillRect(x + i, y + j, 1, 1); } }
    }
  }
  // same, mirrored horizontally
  function rowsFlip(g, x, y, rs, pal) {
    for (var j = 0; j < rs.length; j++) {
      var s = rs[j], n = s.length;
      for (var i = 0; i < n; i++) { var ch = s.charAt(i); if (ch === '.' || ch === ' ') continue; var c = pal[ch]; if (c) { g.fillStyle = c; g.fillRect(x + n - 1 - i, y + j, 1, 1); } }
    }
  }
  art.helpers = { R: R, P: P, disc: disc, ring: ring, line: line, rows: rows, mix: mix, dk: dk, rng: rng, oval: oval, nes: nes };

  // add a 1px outline (4-neighbour) to opaque pixels, per frame cell
  function outlineCanvas(cv, fw, fh, n, color) {
    var g = g2(cv), W = cv.width, H = cv.height;
    var img = readPixels(cv), d = img.data, src = new Uint8Array(W * H), i, x, y;
    for (i = 0; i < W * H; i++) src[i] = d[i * 4 + 3] > 0 ? 1 : 0;
    var c = parseColor(color);
    for (var f = 0; f < n; f++) {
      var x0 = f * fw;
      for (y = 0; y < fh; y++) for (x = 0; x < fw; x++) {
        i = y * W + x0 + x;
        if (src[i]) continue;
        if ((x > 0 && src[i - 1]) || (x < fw - 1 && src[i + 1]) || (y > 0 && src[i - W]) || (y < fh - 1 && src[i + W])) {
          d[i * 4] = c[0]; d[i * 4 + 1] = c[1]; d[i * 4 + 2] = c[2]; d[i * 4 + 3] = 255;
        }
      }
    }
    g.putImageData(img, 0, 0);
  }

  /* ---------------- tiny 3x5 font for background lettering ---------------- */
  // each glyph: 5 rows of 3 bits (MSB = left). Uppercase, digits, a few marks.
  var TINY = {
    A: [2, 5, 7, 5, 5], B: [6, 5, 6, 5, 6], C: [3, 4, 4, 4, 3], D: [6, 5, 5, 5, 6], E: [7, 4, 6, 4, 7], F: [7, 4, 6, 4, 4],
    G: [3, 4, 5, 5, 3], H: [5, 5, 7, 5, 5], I: [7, 2, 2, 2, 7], J: [1, 1, 1, 5, 2], K: [5, 5, 6, 5, 5], L: [4, 4, 4, 4, 7],
    M: [5, 7, 7, 5, 5], N: [6, 5, 5, 5, 5], O: [2, 5, 5, 5, 2], P: [6, 5, 6, 4, 4], Q: [2, 5, 5, 6, 3], R: [6, 5, 6, 5, 5],
    S: [3, 4, 2, 1, 6], T: [7, 2, 2, 2, 2], U: [5, 5, 5, 5, 7], V: [5, 5, 5, 5, 2], W: [5, 5, 7, 7, 5], X: [5, 5, 2, 5, 5],
    Y: [5, 5, 2, 2, 2], Z: [7, 1, 2, 4, 7],
    '0': [7, 5, 5, 5, 7], '1': [2, 6, 2, 2, 7], '2': [6, 1, 2, 4, 7], '3': [6, 1, 2, 1, 6], '4': [5, 5, 7, 1, 1],
    '5': [7, 4, 6, 1, 6], '6': [3, 4, 7, 5, 7], '7': [7, 1, 2, 2, 2], '8': [7, 5, 7, 5, 7], '9': [7, 5, 7, 1, 6],
    '!': [2, 2, 2, 0, 2], '?': [6, 1, 2, 0, 2], '.': [0, 0, 0, 0, 2], ',': [0, 0, 0, 2, 4], '-': [0, 0, 7, 0, 0],
    "'": [2, 2, 0, 0, 0], ':': [0, 2, 0, 2, 0], '/': [1, 1, 2, 4, 4], '+': [0, 2, 7, 2, 0], '%': [5, 1, 2, 4, 5],
    '&': [2, 5, 2, 5, 3], '$': [3, 6, 2, 3, 6], '#': [5, 7, 5, 7, 5], '*': [5, 2, 7, 2, 5], '(': [1, 2, 2, 2, 1], ')': [4, 2, 2, 2, 4],
    '>': [4, 2, 1, 2, 4], '<': [1, 2, 4, 2, 1], '=': [0, 7, 0, 7, 0], '"': [5, 5, 0, 0, 0]
  };
  function tinyWidth(s) { return String(s).length * 4 - 1; }
  // draw 3x5 text; o.align 'center'|'right'; returns width
  function tiny(g, s, x, y, col, o) {
    s = String(s).toUpperCase();
    var w = tinyWidth(s);
    if (o && o.align === 'center') x = Math.round(x - w / 2); else if (o && o.align === 'right') x = Math.round(x - w);
    g.fillStyle = col;
    for (var i = 0; i < s.length; i++) {
      var gl = TINY[s.charAt(i)];
      if (!gl) continue;
      for (var j = 0; j < 5; j++) for (var b = 0; b < 3; b++) if (gl[j] & (4 >> b)) g.fillRect(x + i * 4 + b, y + j, 1, 1);
    }
    return w;
  }
  art.tinyText = function (ctx, s, x, y, col, o) { return tiny(ctx, s, x, y, col || WH, o); };
  // the engine's 5x7 font, drawn into an offscreen canvas
  function bigText(g, s, x, y, col, o) {
    if (!DCW.text) return 0;
    var old = DCW.ctx, res;
    DCW.ctx = g;
    try { res = DCW.text(s, x, y, col, o || { shadow: null }); } catch (e) { res = null; }
    DCW.ctx = old;
    return res ? res.w : 0;
  }

  /* ---------------- rasterizer + sprite cache ---------------- */
  var cache = {};      // name -> entry
  var SKIN_DEFAULT = 'carl_boxers';

  function normFrames(def) {
    var fr = def.frames || def.rows || [];
    if (fr.length && typeof fr[0] === 'string') fr = [fr];
    return fr;
  }
  function rasterDef(def, pal) {
    var frames = normFrames(def);
    var n = Math.max(1, frames.length);
    var h = def.h || (frames[0] ? frames[0].length : 1);
    var w = def.w || 1;
    if (!def.w) for (var q = 0; q < frames.length; q++) for (var r = 0; r < frames[q].length; r++) w = Math.max(w, frames[q][r].length);
    var cv = mkCanvas(w * n, h), g = g2(cv);
    var img = g.createImageData(w * n, h), d = img.data, W = w * n;
    var lut = {};
    for (var f = 0; f < frames.length; f++) {
      var fr = frames[f];
      for (var y = 0; y < h && y < fr.length; y++) {
        var row = fr[y];
        for (var x = 0; x < w && x < row.length; x++) {
          var ch = row.charAt(x);
          if (ch === '.' || ch === ' ') continue;
          var rgb = lut[ch];
          if (rgb === undefined) {
            var col = pal.hasOwnProperty(ch) ? pal[ch] : (ch === 'k' ? K : MAG);
            if (col === null || col === undefined || col === 'transparent') rgb = null;
            else { var pc = parseColor(col); rgb = pc[3] < 128 ? null : nearest(pc[0], pc[1], pc[2]); }
            lut[ch] = rgb;
          }
          if (!rgb) continue;
          var i = (y * W + f * w + x) * 4;
          d[i] = rgb[0]; d[i + 1] = rgb[1]; d[i + 2] = rgb[2]; d[i + 3] = 255;
        }
      }
    }
    g.putImageData(img, 0, 0);
    return { cv: cv, w: w, h: h, n: n };
  }
  function rasterProc(pr, pal) {
    var w = pr.w | 0 || 16, h = pr.h | 0 || 16, n = Math.max(1, pr.frames | 0 || 1);
    var cv = mkCanvas(w * n, h), g = g2(cv);
    for (var f = 0; f < n; f++) {
      g.save();
      g.translate(f * w, 0);
      g.beginPath(); g.rect(0, 0, w, h); g.clip();
      try { pr.draw(g, f, pal || null); } catch (e) { if (window.console) console.error('art proc failed', e); R(g, 0, 0, w, h, MAG); }
      g.restore();
    }
    nesify(cv);
    if (pr.outline) outlineCanvas(cv, w, h, n, pr.outline);
    return { cv: cv, w: w, h: h, n: n };
  }
  function makeEntry(name) {
    var def = DCW.artDefs[name], pr = !def && DCW.artProcs[name];
    if (!def && !pr) return null;
    var res;
    try { res = def ? rasterDef(def, def.pal || {}) : rasterProc(pr, null); } catch (e) { if (window.console) console.error('art raster failed: ' + name, e); return null; }
    var src = def || pr;
    var e = {
      name: name, w: res.w, h: res.h, n: res.n,
      ox: src.ox | 0, oy: src.oy | 0,
      v: [res.cv, null, null, null], skins: {},
      skinnable: name.indexOf('carl_') === 0, def: def, proc: pr
    };
    e.ax = (e.w >> 1) + e.ox; e.ay = e.h + e.oy;
    e.info = { w: e.w, h: e.h, frames: e.n };
    cache[name] = e;
    return e;
  }
  function get(name) { return cache[name] || makeEntry(name); }

  function flipStrip(src, w, h, n) {
    var cv = mkCanvas(w * n, h), g = g2(cv);
    for (var i = 0; i < n; i++) { g.save(); g.translate((i + 1) * w, 0); g.scale(-1, 1); g.drawImage(src, i * w, 0, w, h, 0, 0, w, h); g.restore(); }
    return cv;
  }
  function flashStrip(src) {
    var cv = mkCanvas(src.width, src.height), g = g2(cv);
    g.drawImage(src, 0, 0); g.globalCompositeOperation = 'source-in'; g.fillStyle = WH; g.fillRect(0, 0, cv.width, cv.height);
    return cv;
  }
  function variants(e, skin) {
    if (!skin || !e.skinnable) return e.v;
    var vs = e.skins[skin];
    if (vs) return vs;
    var sk = DCW.artSkins[skin];
    if (!sk || !sk.pal) { e.skins[skin] = e.v; return e.v; }
    var res;
    if (e.def) {
      var pal = {}, k;
      var base = e.def.pal || {};
      for (k in base) if (base.hasOwnProperty(k)) pal[k] = base[k];
      for (k in sk.pal) if (sk.pal.hasOwnProperty(k)) pal[k] = sk.pal[k];
      res = rasterDef(e.def, pal);
    } else res = rasterProc(e.proc, sk.pal);
    vs = e.skins[skin] = [res.cv, null, null, null];
    return vs;
  }
  function variant(e, vs, idx) {
    var c = vs[idx];
    if (c) return c;
    if (idx === 1) c = flipStrip(vs[0], e.w, e.h, e.n);
    else if (idx === 2) c = flashStrip(vs[0]);
    else c = flashStrip(variant(e, vs, 1));
    vs[idx] = c;
    return c;
  }

  function placeholder(ctx, x, y, s) {
    s = s || 1;
    var w = 10 * s, h = 12 * s, l = Math.round(x - w / 2), t = Math.round(y - h);
    ctx.fillStyle = K; ctx.fillRect(l - 1, t - 1, w + 2, h + 2);
    ctx.fillStyle = MAG; ctx.fillRect(l, t, w, h);
    ctx.fillStyle = K; ctx.fillRect(l + 2 * s, t + 2 * s, w - 4 * s, s); ctx.fillRect(l + 2 * s, t + h - 3 * s, w - 4 * s, s);
  }

  art.sprite = function (ctx, name, x, y, o) {
    var e = cache[name] || get(name);
    var scale = 1;
    if (!e) { placeholder(ctx, x, y, o && o.scale); return; }
    var frame = 0, idx = 0, vs = e.v;
    if (o) {
      if (o.frame) frame = o.frame | 0;
      if (o.flip) idx = 1;
      if (o.flash) idx |= 2;
      if (o.skin && e.skinnable) vs = variants(e, o.skin);
      if (o.alpha !== undefined && o.alpha < 1) {
        // NES has no translucency: a faded sprite flickers instead
        if (!(o.alpha > 0) || ((DCW.frame | 0) & 1)) return;
      }
      if (o.scale) scale = o.scale;
    }
    var n = e.n;
    frame = n > 1 ? ((frame % n) + n) % n : 0;
    var img = vs[idx] || variant(e, vs, idx);
    var ax = idx & 1 ? e.w - e.ax : e.ax;
    var w = e.w, h = e.h;
    if (scale === 1) ctx.drawImage(img, frame * w, 0, w, h, Math.round(x - ax), Math.round(y - e.ay), w, h);
    else ctx.drawImage(img, frame * w, 0, w, h, Math.round(x - ax * scale), Math.round(y - e.ay * scale), Math.round(w * scale), Math.round(h * scale));
  };
  art.has = function (name) { return !!(cache[name] || DCW.artDefs[name] || DCW.artProcs[name]); };
  art.info = function (name) { var e = get(name); return e ? e.info : { w: 10, h: 12, frames: 1, missing: true }; };
  art.sheet = function (name, skin) { var e = get(name); if (!e) return null; return { canvas: variants(e, skin)[0], w: e.w, h: e.h, frames: e.n }; };
  art.icon = function (ctx, name, x, y, o) {
    var e = cache['icon_' + name] || get('icon_' + name) || get(name);
    if (!e) { ctx.fillStyle = MAG; ctx.fillRect(Math.round(x), Math.round(y), 8, 8); return; }
    var frame = o && o.frame ? ((o.frame % e.n) + e.n) % e.n : 0;
    var vs = e.v, idx = o && o.flash ? 2 : 0, img = vs[idx] || variant(e, vs, idx);
    var s = (o && o.scale) || 1;
    ctx.drawImage(img, frame * e.w, 0, e.w, e.h, Math.round(x), Math.round(y), e.w * s, e.h * s);
  };
  art.portrait = function (ctx, name, x, y, o) {
    var e = get(name) || get('p_' + name);
    x = Math.round(x); y = Math.round(y);
    if (!e) { // static-screen fallback: black, green scanlines, a magenta "?"
      ctx.fillStyle = K; ctx.fillRect(x, y, 32, 32);
      ctx.fillStyle = Q.G1; for (var i = 0; i < 32; i += 4) ctx.fillRect(x, y + i, 32, 1);
      ctx.fillStyle = MAG; ctx.fillRect(x + 12, y + 8, 8, 3); ctx.fillRect(x + 17, y + 11, 3, 5); ctx.fillRect(x + 14, y + 16, 3, 4); ctx.fillRect(x + 14, y + 22, 3, 3);
      return;
    }
    var frame = o && o.frame ? ((o.frame % e.n) + e.n) % e.n : 0;
    var idx = o && o.flip ? 1 : 0, img = e.v[idx] || variant(e, e.v, idx);
    ctx.drawImage(img, frame * e.w, 0, e.w, e.h, x, y, e.w, e.h);
  };
  art.names = function () {
    var o = {}, k;
    for (k in DCW.artDefs) o[k] = 1;
    for (k in DCW.artProcs) o[k] = 1;
    return Object.keys(o);
  };
  art.refresh = function (name) { if (name) delete cache[name]; else cache = {}; };

  var BOX_COLORS = { bronze: Q.n1, silver: Q.g1, gold: Q.y2, platinum: Q.b6, legendary: Q.p2, fan: Q.m2, boss: Q.r1 };
  art.boxColor = function (tier) {
    var bt = DCW.data && DCW.data.boxTiers && DCW.data.boxTiers[tier];
    return (bt && bt.color) || BOX_COLORS[tier] || Q.g1;
  };

  // register own content without clobbering anything art_actors.js defined
  var OWN = art.ownNames = [];
  function proc(name, w, h, frames, draw, opt) {
    OWN.push(name);
    if (DCW.artDefs[name] || DCW.artProcs[name]) return;
    var p = { w: w, h: h, frames: frames, draw: draw };
    if (opt === undefined || opt === true) p.outline = K;
    else if (opt) { for (var k in opt) p[k] = opt[k]; }
    DCW.artProcs[name] = p;
  }
  function def(name, d) { OWN.push(name); if (!DCW.artDefs[name] && !DCW.artProcs[name]) DCW.artDefs[name] = d; }
  // an internal strip canvas (frames side by side) that is not a public sprite
  function strip(w, h, n, draw, outline) {
    var cv = mkCanvas(w * n, h), g = g2(cv);
    for (var f = 0; f < n; f++) { g.save(); g.translate(f * w, 0); g.beginPath(); g.rect(0, 0, w, h); g.clip(); draw(g, f); g.restore(); }
    nesify(cv);
    if (outline) outlineCanvas(cv, w, h, n, outline);
    return { cv: cv, w: w, h: h, n: n };
  }

  /* =====================================================================
     SIDE-SCROLL TILES  (16x16, chunk chars # X = ^ ~ H b L)
     Every tile is painted from ONE 4-colour sub-palette p = [p0..p3]
     (p0 is normally black), exactly like an NES background tile.
     '#' = body painter + (when nothing solid is above) a top painter that
     returns its height; exposed sides get a black edge.
     ===================================================================== */
  // ---------------- body painters (fill 16x16, seamless left/right) ----------------
  var BODY = {
    // gray hewn stone, two courses per tile, chunky NES brick read (p = K, face, light, -)
    hewn: function (g, p, v, r) {
      R(g, 0, 0, 16, 16, p[1]);
      var ja = [4, 11, 7, 13][v], jb = (ja + 7 + (v & 1) * 2) % 16, c, y0, j, x;
      for (c = 0; c < 2; c++) {
        y0 = c * 8; j = c ? jb : ja;
        R(g, 0, y0 + 7, 16, 1, p[0]);                        // bed joint
        R(g, j, y0, 1, 7, p[0]);                              // head joint
        for (x = 0; x < 16; x++) if (x !== j && x !== (j + 1) % 16) P(g, x, y0, p[2]); // lit top edge
        R(g, (j + 1) % 16, y0 + 1, 1, 4, p[2]);               // lit left edge
        PW(g, j - 1, y0 + 6, p[0]);                           // rounded corner
        // chisel marks
        var cx = (j + 3 + ((r() * 8) | 0)) % 16, cy = y0 + 2 + ((r() * 3) | 0);
        PW(g, cx, cy, p[0]); PW(g, cx + 1, cy + 1, p[2]);
        if (r() < 0.6) PW(g, cx + 5, cy + 2, p[2]);
      }
      if (v === 2) { P(g, 9, 9, p[0]); P(g, 10, 10, p[0]); P(g, 10, 11, p[0]); P(g, 11, 12, p[0]); } // crack
    },
    // cinderblock, 16x8 blocks in running bond (p = K mortar, shade/pores, face, light top)
    cinder: function (g, p, v, r) {
      R(g, 0, 0, 16, 16, p[0]);
      for (var c = 0; c < 2; c++) {
        var y = c * 8, off = c ? 8 : 0;
        for (var bx = -16; bx < 16; bx += 16) {
          var x = bx + off;
          R(g, x, y, 15, 7, p[2]); R(g, x, y, 15, 1, p[3]); R(g, x, y + 6, 15, 1, p[1]); R(g, x + 14, y + 1, 1, 5, p[1]);
        }
      }
      for (var i = 0; i < 6; i++) { var px = (r() * 16) | 0, py = (r() * 16) | 0; if (py % 8 > 0 && py % 8 < 6 && px !== 7 && px !== 15) PW(g, px, py, p[1]); }
      if (v === 3) { P(g, 4, 9, p[0]); P(g, 5, 10, p[0]); P(g, 5, 11, p[1]); P(g, 6, 12, p[0]); } // a crack (it cracks, never breaks)
    },
    // cinderblock with orange lichen blooms (p = K, shade, face, lichen)
    lichenBlock: function (g, p, v, r) {
      BODY.cinder(g, [p[0], p[1], p[2], p[2]], v, r);
      var spots = [[3, 4], [11, 11], [6, 13], [13, 3]], n = 1 + (v & 1) + (v >> 1);
      for (var s = 0; s < n; s++) {
        var sx = spots[(s + v) % 4][0], sy = spots[(s + v) % 4][1];
        PW(g, sx, sy, p[3]); PW(g, sx + 1, sy, p[3]); PW(g, sx - 1, sy + 1, p[3]); PW(g, sx, sy + 1, p[3]); PW(g, sx + 1, sy + 1, p[1]);
        PW(g, sx + 2, sy - 1, p[3]); PW(g, sx - 2, sy, p[3]); if (r() < 0.6) PW(g, sx + 1, sy + 2, p[3]);
      }
    },
    // stacked squared timbers (p = K, dark, wood, light)
    timber: function (g, p, v, r) {
      for (var c = 0; c < 2; c++) {
        var y = c * 8, j = c ? (v * 5 + 3) % 16 : (v * 5 + 11) % 16;
        R(g, 0, y, 16, 1, p[3]); R(g, 0, y + 1, 16, 5, p[2]); R(g, 0, y + 6, 16, 1, p[1]); R(g, 0, y + 7, 16, 1, p[0]);
        var gx = (r() * 8) | 0; R(g, gx, y + 2, 5, 1, p[1]); R(g, (gx + 8) % 13, y + 4, 4, 1, p[1]);
        R(g, j, y, 1, 7, p[0]); PW(g, j + 1, y + 1, p[3]);
      }
    },
    // compacted garbage (p = K, brown grime, gray junk, light glints)
    junk: function (g, p, v, r) {
      R(g, 0, 0, 16, 16, p[1]);
      for (var i = 0; i < 9; i++) {
        var x = (r() * 16) | 0, y = (r() * 16) | 0, w = 2 + ((r() * 5) | 0), h = 1 + ((r() * 3) | 0), c = r() < 0.55 ? p[2] : p[0];
        for (var a = 0; a < w; a++) for (var b = 0; b < h; b++) PW(g, x + a, y + b, c);
        if (c === p[2]) PW(g, x, y, p[3]);
      }
      for (i = 0; i < 4; i++) PW(g, (r() * 16) | 0, (r() * 16) | 0, p[3]);
    },
    // a stacked broken appliance per tile (p = K, mid, light, white)
    appliance: function (g, p, v) {
      R(g, 0, 0, 16, 16, p[0]);
      R(g, 1, 1, 14, 14, p[3]); R(g, 13, 1, 2, 14, p[2]); R(g, 1, 14, 14, 1, p[2]);
      if (v === 0) { // fridge
        R(g, 1, 6, 14, 1, p[0]); R(g, 11, 2, 1, 3, p[1]); R(g, 11, 8, 1, 4, p[1]); P(g, 3, 3, p[2]); P(g, 4, 10, p[1]);
      } else if (v === 1) { // washing machine
        R(g, 1, 3, 14, 1, p[2]); P(g, 3, 2, p[1]); P(g, 5, 2, p[1]); R(g, 11, 2, 2, 1, p[0]);
        oval(g, 7, 9, 4, 4, p[0]); oval(g, 7, 9, 3, 3, p[1]); P(g, 6, 7, p[3]); P(g, 5, 8, p[2]);
      } else if (v === 2) { // dead TV
        R(g, 2, 2, 10, 10, p[0]); R(g, 3, 3, 8, 8, p[1]); P(g, 4, 4, p[2]); P(g, 5, 4, p[2]); line(g, 6, 5, 9, 9, p[0]);
        P(g, 13, 4, p[0]); P(g, 13, 7, p[0]); R(g, 13, 10, 1, 2, p[1]);
      } else { // oven
        R(g, 1, 3, 14, 1, p[0]); for (var k = 3; k < 13; k += 3) P(g, k, 2, p[1]);
        R(g, 3, 6, 9, 6, p[0]); R(g, 4, 7, 7, 4, p[1]); R(g, 4, 5, 7, 1, p[2]); P(g, 5, 8, p[2]);
      }
      P(g, 2, 2, p[3]);
      if (v & 1) { P(g, 14, 12, p[0]); P(g, 13, 13, p[0]); } else { P(g, 1, 13, p[1]); P(g, 2, 12, p[1]); } // dents
    },
    // packed dirt with pebbles (p = K, dirt, mid, light)
    dirt: function (g, p, v, r) {
      R(g, 0, 0, 16, 16, p[1]);
      for (var i = 0; i < 7; i++) { var x = (r() * 16) | 0, y = (r() * 16) | 0; PW(g, x, y, p[0]); PW(g, x + 1, y, p[0]); PW(g, x, y - 1, p[2]); }
      for (i = 0; i < 5; i++) PW(g, (r() * 16) | 0, (r() * 16) | 0, p[2]);
      if (v === 1) { PW(g, 6, 9, p[2]); PW(g, 7, 9, p[3]); PW(g, 7, 10, p[2]); PW(g, 8, 10, p[0]); }
    },
    // vertical shanty planks with a cross brace (p = K, dark, wood, light)
    shanty: function (g, p, v, r) {
      for (var i = 0; i < 4; i++) {
        var x = i * 4;
        R(g, x, 0, 3, 16, p[2]); R(g, x, 0, 1, 16, p[3]); R(g, x + 3, 0, 1, 16, p[0]);
        var kn = (r() * 12) | 0; P(g, x + 1, kn, p[1]); P(g, x + 1, kn + 1, p[1]);
        if (((i + v) & 3) === 0) { R(g, x, 6 + (v & 3), 3, 1, p[1]); }
      }
      if (v & 1) line(g, 0, 15, 15, 0, p[1]); else line(g, 0, 0, 15, 15, p[1]);
      P(g, 2, 2, p[3]); P(g, 13, 13, p[3]);
    },
    // riveted metal plates, cylindrical shine (p = K, dark, mid, light)
    riveted: function (g, p, v) {
      R(g, 0, 0, 16, 16, p[2]);
      R(g, 0, 7, 16, 1, p[0]); R(g, 0, 15, 16, 1, p[0]); R(g, 0, 8, 16, 1, p[3]); R(g, 0, 0, 16, 1, p[3]);
      R(g, 3, 1, 1, 6, p[3]); R(g, 3, 9, 1, 6, p[3]); R(g, 12, 1, 2, 6, p[1]); R(g, 12, 9, 2, 6, p[1]);
      var rv = [[1, 2], [7, 2], [1, 12], [7, 12], [14, 4]];
      for (var i = 0; i < rv.length; i++) { P(g, rv[i][0] + (v & 1) * 2, rv[i][1], p[3]); P(g, rv[i][0] + 1 + (v & 1) * 2, rv[i][1] + 1, p[0]); }
      if (v === 2) { R(g, 6, 10, 3, 2, p[1]); P(g, 7, 10, p[0]); } // a patch
    },
    // horizontal floorboards / barn wood (p = K, dark, wood, light)
    boards: function (g, p, v, r) {
      for (var c = 0; c < 4; c++) {
        var y = c * 4, j = ((v * 7 + c * 5) % 16);
        R(g, 0, y, 16, 3, p[2]); R(g, 0, y + 3, 16, 1, p[0]); R(g, 0, y, 16, 1, p[2]);
        R(g, j, y, 1, 3, p[0]); P(g, (j + 2) % 16, y + 1, p[3]);
        P(g, (j + 9) % 16, y + 1, p[1]); P(g, (j + 10) % 16, y + 1, p[1]);
        if (r() < 0.5) P(g, (j + 13) % 16, y, p[3]);
      }
    },
    // poured concrete with formwork lines (p = K, mid, light, -)
    concrete: function (g, p, v, r) {
      R(g, 0, 0, 16, 16, p[1]);
      R(g, 0, 7, 16, 1, p[0]); R(g, 0, 8, 16, 1, p[2]);
      R(g, (v * 5 + 4) % 16, 0, 1, 7, p[0]);
      for (var i = 0; i < 6; i++) PW(g, (r() * 16) | 0, (r() * 16) | 0, i & 1 ? p[0] : p[2]);
    },
    // stacked bumper plates, side view (p = K, gray, light, red)
    plates: function (g, p, v) {
      R(g, 0, 0, 16, 16, p[0]);
      for (var c = 0; c < 2; c++) {
        var y = c * 8, col = (c + v) & 1 ? p[3] : p[1];
        R(g, 1, y + 1, 14, 6, col); R(g, 0, y + 2, 16, 4, col); R(g, 1, y + 1, 14, 1, p[2]);
        R(g, 6, y + 2, 4, 4, p[1]); R(g, 7, y + 3, 2, 2, p[0]); P(g, 2, y + 3, p[2]);
      }
    },
    // smooth sandstone ashlar (p = K, shade, face, light)
    ashlar: function (g, p, v) {
      R(g, 0, 0, 16, 16, p[2]);
      R(g, 0, 15, 16, 1, p[0]); R(g, (v & 1) ? 7 : 15, 0, 1, 15, p[0]);
      R(g, 0, 0, 16, 1, p[3]); R(g, 0, 14, 16, 1, p[1]);
      P(g, 4, 5, p[1]); P(g, 11, 9, p[1]); P(g, 12, 9, p[3]);
    },
    // big rounded stone blocks of the swine track walls (p = K, mid, light, white)
    rounded: function (g, p, v) {
      R(g, 0, 0, 16, 16, p[0]);
      R(g, 1, 0, 14, 16, p[1]); R(g, 0, 1, 16, 14, p[1]);
      R(g, 2, 1, 11, 2, p[2]); R(g, 1, 2, 2, 11, p[2]); P(g, 3, 3, p[3]); P(g, 4, 2, p[3]); P(g, 2, 4, p[3]);
      R(g, 14, 3, 1, 11, p[0]); R(g, 3, 14, 11, 1, p[0]);
      if (v & 1) { P(g, 9, 8, p[0]); P(g, 10, 9, p[0]); }
    },
    // Portuguese azulejo tiles, 2x2 per tile (p = K grout, blue, light blue, white)
    azulejo: function (g, p, v) {
      for (var ty = 0; ty < 2; ty++) for (var tx = 0; tx < 2; tx++) {
        var x = tx * 8, y = ty * 8;
        R(g, x, y, 8, 8, p[3]); R(g, x + 7, y, 1, 8, p[0]); R(g, x, y + 7, 8, 1, p[0]);
        // corner quarter-flowers meet at the grout crossings, a diamond in the middle
        P(g, x, y, p[1]); P(g, x + 6, y, p[1]); P(g, x, y + 6, p[1]); P(g, x + 6, y + 6, p[1]);
        P(g, x + 3, y + 1, p[1]); P(g, x + 2, y + 2, p[1]); P(g, x + 4, y + 2, p[1]); P(g, x + 1, y + 3, p[1]); P(g, x + 5, y + 3, p[1]);
        P(g, x + 2, y + 4, p[1]); P(g, x + 4, y + 4, p[1]); P(g, x + 3, y + 5, p[1]); P(g, x + 3, y + 3, p[2]);
      }
      if (v === 3) { R(g, 9, 9, 3, 2, p[2]); P(g, 10, 11, p[0]); } // a chipped tile
    },
    // two-tone checkered floor tiles (p = K grout, a, b, light)
    checker: function (g, p, v) {
      for (var ty = 0; ty < 2; ty++) for (var tx = 0; tx < 2; tx++) {
        var x = tx * 8, y = ty * 8; R(g, x, y, 8, 8, (tx + ty) & 1 ? p[1] : p[2]);
        P(g, x + 1, y + 1, p[3]);
      }
      R(g, 0, 15, 16, 1, p[0]);
    }
  };

  // ---------------- top painters (draw the lip, return its height) ----------------
  var TOP = {
    // stone lip with moss tufts hanging over (p3 = moss)
    ledge: function (g, p, v) {
      R(g, 0, 0, 16, 1, p[2]); R(g, 0, 1, 16, 2, p[1]); R(g, 0, 3, 16, 1, p[0]);
      P(g, 3 + v, 1, p[2]); P(g, 11 - v, 2, p[2]);
      if (v === 1 || v === 3) {
        var x0 = v === 1 ? 2 : 9;
        R(g, x0, 0, 5, 1, p[3]); P(g, x0, 1, p[3]); R(g, x0 + 2, 1, 2, 1, p[3]); P(g, x0 + 1, 2, p[3]); P(g, x0 + 3, 2, p[3]);
        P(g, x0 + 3, 3, p[3]); P(g, x0 + 3, 4, p[3]); P(g, x0 + 1, 3, p[3]);
      } else if (v === 2) { P(g, 13, 0, p[3]); P(g, 14, 0, p[3]); P(g, 13, 1, p[3]); }
      return 4;
    },
    // white poured-concrete slab, hairline cracks (p = K, gray, light, white)
    slab: function (g, p, v) {
      R(g, 0, 0, 16, 2, p[3]); R(g, 0, 2, 16, 2, p[2]); R(g, 0, 4, 16, 1, p[0]);
      var cx = [3, 10, 6, 13][v];
      P(g, cx, 1, p[1]); P(g, cx + 1, 2, p[1]); P(g, cx + 1, 3, p[0]); if (v & 1) { P(g, cx - 1, 2, p[1]); P(g, cx - 2, 3, p[1]); }
      P(g, (cx + 7) % 16, 3, p[1]);
      return 5;
    },
    // plank boardwalk / floorboards (p = K, dark, wood, light)
    boards: function (g, p, v) {
      R(g, 0, 0, 16, 1, p[3]); R(g, 0, 1, 16, 3, p[2]); R(g, 0, 4, 16, 1, p[0]);
      var j = (v * 5 + 6) % 16; R(g, j, 1, 1, 3, p[0]); P(g, (j + 2) % 16, 2, p[1]); P(g, (j + 3) % 16, 2, p[1]); P(g, (j + 9) % 16, 1, p[3]);
      P(g, (j + 1) % 16, 1, p[3]);
      return 5;
    },
    // rusty iron plate with rivets (p = K, dark, mid, light)
    plate: function (g, p, v) {
      R(g, 0, 0, 16, 1, p[3]); R(g, 0, 1, 16, 2, p[2]); R(g, 0, 3, 16, 1, p[1]); R(g, 0, 4, 16, 1, p[0]);
      P(g, 2 + v, 2, p[3]); P(g, 10 + v, 2, p[3]); if (v & 1) R(g, 15, 1, 1, 3, p[0]);
      return 5;
    },
    // garbage bags on top of the heap (p = K, -, bag, shine)
    bags: function (g, p, v) {
      R(g, 0, 0, 16, 1, p[3]); R(g, 0, 1, 16, 4, p[2]); R(g, 0, 5, 16, 1, p[0]);
      var n = (v * 3 + 7) % 16;
      P(g, n, 1, p[0]); P(g, n, 2, p[0]); P(g, n - 1, 3, p[0]); P(g, n + 1, 3, p[0]); P(g, n, 4, p[0]);
      P(g, (n + 4) % 16, 2, p[3]); P(g, (n + 11) % 16, 1, p[3]); P(g, (n + 12) % 16, 2, p[3]);
      if (v === 2) { R(g, 3, 1, 3, 3, p[1]); P(g, 4, 1, p[3]); } // a can
      return 6;
    },
    // blue gym mat (p = K, -, mat, light)
    mat: function (g, p, v) {
      R(g, 0, 0, 16, 1, p[3]); R(g, 0, 1, 16, 3, p[2]); R(g, 0, 4, 16, 1, p[0]);
      R(g, (v & 1) ? 7 : 15, 1, 1, 3, p[3]);
      return 5;
    },
    // grooved stone track (p = K, groove, face, light)
    grooves: function (g, p, v) {
      R(g, 0, 0, 16, 1, p[3]); R(g, 0, 1, 16, 4, p[2]); R(g, 0, 2, 16, 1, p[1]); R(g, 0, 4, 16, 1, p[1]); R(g, 0, 5, 16, 1, p[0]);
      if (v === 1) R(g, 8, 1, 1, 4, p[1]); // a wall line crossing the tracks
      return 6;
    },
    // concrete with a painted yellow curb line (p = K, gray, light, yellow)
    curb: function (g, p, v) {
      R(g, 0, 0, 16, 1, p[2]); R(g, 0, 1, 16, 2, p[3]); R(g, 0, 3, 16, 1, p[2]); R(g, 0, 4, 16, 1, p[0]);
      if (v === 2) { P(g, 5, 1, p[2]); P(g, 6, 2, p[1]); }
      return 5;
    },
    // plain: light line + mid (works with any body)
    plain: function (g, p) { R(g, 0, 0, 16, 1, p[3]); R(g, 0, 1, 16, 2, p[2]); R(g, 0, 3, 16, 1, p[0]); return 4; }
  };

  // ---------------- other tile kinds ----------------
  function platPaint(g, p, kind, L, Rt) {
    var k = p[0];
    if (kind === 'catwalk') { // steel catwalk, safety nosing (p = K, gray, light, yellow)
      R(g, 0, 0, 16, 1, p[3]); R(g, 0, 1, 16, 1, p[2]); R(g, 0, 2, 16, 2, p[1]);
      for (var x = 1; x < 16; x += 3) P(g, x, 2, k);
      R(g, 0, 4, 16, 1, k); R(g, 0, 5, 16, 1, p[1]); R(g, 0, 6, 16, 1, k);
      if (!L) { R(g, 0, 0, 1, 7, k); line(g, 1, 7, 4, 11, k); line(g, 2, 7, 5, 10, p[1]); }
      if (!Rt) { R(g, 15, 0, 1, 7, k); line(g, 14, 7, 11, 11, k); line(g, 13, 7, 10, 10, p[1]); }
      return;
    }
    if (kind === 'bench') { // padded gym bench (p = K, dark red, red, light)
      R(g, 0, 0, 16, 1, p[3]); R(g, 0, 1, 16, 3, p[2]); R(g, 0, 4, 16, 1, p[1]); R(g, 0, 5, 16, 1, k);
      P(g, 4, 2, p[3]); P(g, 12, 2, p[3]);
      if (!L) { R(g, 0, 0, 1, 6, k); R(g, 2, 6, 2, 7, k); R(g, 1, 13, 4, 1, k); }
      if (!Rt) { R(g, 15, 0, 1, 6, k); R(g, 12, 6, 2, 7, k); R(g, 11, 13, 4, 1, k); }
      return;
    }
    if (kind === 'grate') { // steel grate walkway (p = K, gray, light, white)
      R(g, 0, 0, 16, 1, p[3]); R(g, 0, 1, 16, 4, p[1]);
      for (x = 0; x < 16; x += 2) R(g, x, 2, 1, 2, k);
      R(g, 0, 1, 16, 1, p[2]); R(g, 0, 5, 16, 1, k);
      if (!L) { R(g, 0, 0, 1, 6, k); R(g, 1, 6, 1, 5, p[1]); R(g, 0, 6, 1, 5, k); R(g, 2, 6, 1, 5, k); }
      if (!Rt) { R(g, 15, 0, 1, 6, k); R(g, 14, 6, 1, 5, p[1]); R(g, 15, 6, 1, 5, k); R(g, 13, 6, 1, 5, k); }
      return;
    }
    // wooden beam / plank (default): p = K, dark, wood, light
    R(g, 0, 0, 16, 1, p[3]); R(g, 0, 1, 16, 3, p[2]); R(g, 0, 4, 16, 1, p[1]); R(g, 0, 5, 16, 1, k);
    R(g, 2, 2, 5, 1, p[1]); R(g, 10, 3, 3, 1, p[1]); P(g, 8, 1, p[3]);
    if (kind === 'lashed') { R(g, 3, 0, 1, 6, p[3]); R(g, 4, 0, 1, 6, p[1]); R(g, 12, 0, 1, 6, p[3]); R(g, 13, 0, 1, 6, p[1]); }
    if (!L) { R(g, 0, 0, 1, 6, k); line(g, 1, 6, 5, 10, k); line(g, 2, 6, 6, 10, p[1]); line(g, 3, 6, 6, 9, p[2]); }
    if (!Rt) { R(g, 15, 0, 1, 6, k); line(g, 14, 6, 10, 10, k); line(g, 13, 6, 9, 10, p[1]); line(g, 12, 6, 9, 9, p[2]); }
  }
  function spikePaint(g, p, kind) {
    var i, x, y;
    if (kind === 'rebar') { // rusty rebar out of a concrete chunk (p = K, rust dark, rust, concrete)
      R(g, 0, 12, 16, 4, p[3]); R(g, 0, 12, 16, 1, p[3]); P(g, 4, 14, p[0]); P(g, 11, 13, p[0]); P(g, 12, 14, p[0]);
      var rods = [[2, 3, -1], [6, 1, 0], [10, 2, 1], [13, 4, 0]];
      for (i = 0; i < rods.length; i++) {
        x = rods[i][0]; var top = rods[i][1], lean = rods[i][2];
        for (y = top; y < 12; y++) { var xx = x + (y < top + 3 ? lean : 0); P(g, xx, y, p[2]); P(g, xx + 1, y, p[1]); }
        P(g, x + lean, top, p[3]);
      }
      return;
    }
    if (kind === 'shards') { // glass / mirror / clay shards (p = K, dark, mid, glint)
      R(g, 0, 13, 16, 3, p[1]); R(g, 0, 13, 16, 1, p[2]);
      var sh = [[1, 6, 4], [5, 2, 5], [10, 4, 4], [13, 7, 3]];
      for (i = 0; i < sh.length; i++) {
        var sx = sh[i][0], st = sh[i][1], sw = sh[i][2];
        for (y = st; y < 13; y++) { var w = Math.max(1, Math.round((y - st + 1) * sw / (13 - st))); for (x = 0; x < w; x++) P(g, sx + x, y, x === 0 ? p[3] : p[2]); }
      }
      return;
    }
    if (kind === 'wire') { // coiled barbed wire on a concrete curb (p = K, gray, light, white)
      R(g, 0, 13, 16, 3, p[1]); R(g, 0, 13, 16, 1, p[2]);
      for (x = 0; x < 16; x++) {
        var yy = 7 + Math.round(Math.sin(x / 16 * Math.PI * 4) * 3);
        P(g, x, yy, p[2]); P(g, x, 14 - (yy - 4) / 2 | 0, p[1]);
      }
      for (x = 1; x < 16; x += 4) { P(g, x, 4, p[3]); P(g, x - 1, 3, p[2]); P(g, x + 1, 5, p[2]); P(g, x + 2, 10, p[3]); P(g, x + 1, 9, p[2]); P(g, x + 3, 11, p[2]); }
      return;
    }
    if (kind === 'tusks') { // curved bone tusks (p = K, dark, bone, white)
      R(g, 0, 13, 16, 3, p[1]);
      for (i = 0; i < 2; i++) {
        var bx = i * 8 + 1;
        for (y = 2; y < 13; y++) { var cw = Math.max(1, Math.round((y - 1) * 5 / 11)), off = Math.round((13 - y) * (13 - y) / 40); for (x = 0; x < cw; x++) P(g, bx + off + x, y, x === 0 ? p[3] : p[2]); }
      }
      return;
    }
    // iron spikes on a base plate (p = K, dark, light, tips)
    for (i = 0; i < 2; i++) {
      var cx = i * 8 + 4;
      for (y = 2; y < 13; y++) {
        var hw = Math.max(1, Math.round((y - 1) * 4 / 11));
        for (x = cx - hw; x < cx + hw; x++) P(g, x, y, x < cx ? p[2] : p[1]);
      }
      P(g, cx - 1, 2, p[3]); P(g, cx, 2, p[3]); P(g, cx - 1, 3, p[3]);
    }
    R(g, 0, 13, 16, 3, p[1]); R(g, 0, 13, 16, 1, p[2]);
  }
  // liquid: 2 frames (a), like NES palette cycling. p = [deep?, dark, mid, light]
  function liquidPaint(g, p, kind, surf, a) {
    var x, y;
    if (surf) {
      for (x = 0; x < 16; x++) {
        var hi = ((x + a * 4) & 7) < 4, yy = hi ? 3 : 4;
        R(g, x, yy, 1, 16 - yy, p[1]); P(g, x, yy, p[3]); P(g, x, yy + 1, p[2]);
      }
      if (kind === 'fire') { // flames licking off a burning pool
        var fx = a ? [2, 9] : [5, 12];
        for (var i = 0; i < 2; i++) { R(g, fx[i], 0, 2, 4, p[3]); P(g, fx[i], 0, p[2]); R(g, fx[i] - 1, 2, 4, 2, p[2]); }
      }
      if (kind === 'bubble') { var bx = a ? 4 : 11; P(g, bx, 1, p[3]); P(g, bx - 1, 2, p[3]); P(g, bx + 1, 2, p[3]); P(g, bx, 2, p[1]); }
    } else R(g, 0, 0, 16, 16, p[1]);
    for (y = 7; y < 16; y += 4) {
      var off = (a * 4 + y * 3) % 16;
      R(g, off, y, 4, 1, p[2]); R(g, (off + 9) % 16, y + 2, 3, 1, kind === 'fire' ? p[3] : p[2]);
    }
  }
  function ladderPaint(g, p, kind) {
    var y;
    if (kind === 'rope') { // knotted climbing rope / rope ladder (p = K, dark, rope, light)
      for (y = 0; y < 16; y++) { var s = (y >> 1) & 1; P(g, 3 + s, y, p[2]); P(g, 12 - s, y, p[2]); P(g, 4 - s, y, p[1]); P(g, 11 + s, y, p[1]); }
      for (y = 2; y < 16; y += 7) { R(g, 4, y, 8, 2, p[2]); R(g, 4, y, 8, 1, p[3]); }
      return;
    }
    if (kind === 'climb') { // a single gym climbing rope with knots
      for (y = 0; y < 16; y++) { P(g, 7, y, (y >> 1) & 1 ? p[2] : p[3]); P(g, 8, y, p[1]); }
      R(g, 6, 5, 4, 3, p[2]); R(g, 6, 5, 3, 1, p[3]); R(g, 6, 13, 4, 3, p[2]); R(g, 6, 13, 3, 1, p[3]);
      return;
    }
    R(g, 2, 0, 2, 16, p[2]); R(g, 12, 0, 2, 16, p[2]); R(g, 2, 0, 1, 16, p[3]); R(g, 13, 0, 1, 16, p[1]);
    for (y = 1; y < 16; y += 4) { R(g, 4, y, 8, 2, p[2]); R(g, 4, y, 8, 1, p[3]); }
  }
  function cratePaint(g, p) {
    R(g, 1, 1, 14, 14, p[2]);
    R(g, 1, 1, 14, 2, p[3]); R(g, 1, 13, 14, 2, p[1]); R(g, 1, 1, 2, 14, p[3]); R(g, 13, 1, 2, 14, p[1]);
    for (var i = 0; i < 10; i++) { P(g, 3 + i, 12 - i, p[3]); P(g, 4 + i, 12 - i, p[3]); P(g, 4 + i, 13 - i, p[1]); }
    R(g, 3, 3, 10, 1, p[1]);
    P(g, 13, 2, p[1]); P(g, 2, 13, p[1]); P(g, 13, 13, p[1]);
    R(g, 0, 1, 1, 14, p[0]); R(g, 15, 1, 1, 14, p[0]); R(g, 1, 0, 14, 1, p[0]); R(g, 1, 15, 14, 1, p[0]);
  }
  // 'L' gate: iron portcullis (p = K, dark, light, hazard). mask bits: 1 gate above (no header),
  // 2 gate below (no spiked foot), 4/8 gate left/right (no side frame). step 0..16 = raised px.
  var GATE_BARS = [1, 6, 11];
  function gatePaint(p, mask, step) {
    var cv = mkCanvas(16, 16), g = g2(cv);
    var up = mask & 1, dn = mask & 2, L = mask & 4, Rt = mask & 8;
    var top = up ? 0 : 6, foot = dn ? 16 : 13, s = step | 0, i, x, y;
    if (s < 16) {
      g.save(); g.beginPath(); g.rect(0, top, 16, 16 - top); g.clip();
      g.translate(0, -s);
      for (i = 0; i < GATE_BARS.length; i++) {
        x = GATE_BARS[i];
        R(g, x - 1, 0, 5, foot, p[0]); R(g, x, 0, 1, foot, p[2]); R(g, x + 1, 0, 2, foot, p[1]);
        if (!dn) { R(g, x - 1, 13, 5, 1, p[0]); R(g, x, 13, 3, 1, p[1]); P(g, x, 14, p[0]); P(g, x + 2, 14, p[0]); P(g, x + 1, 14, p[2]); P(g, x + 1, 15, p[0]); }
      }
      y = dn ? 7 : 6;
      R(g, 0, y - 1, 16, 5, p[0]); R(g, 0, y, 16, 1, p[2]); R(g, 0, y + 1, 16, 2, p[1]);
      for (i = 0; i < GATE_BARS.length; i++) P(g, GATE_BARS[i] + 1, y + 1, p[2]);
      g.restore();
      if (!L) R(g, 0, top, 1, Math.max(0, foot - top - s), p[0]);
      if (!Rt) R(g, 15, top, 1, Math.max(0, foot - top - s), p[0]);
    }
    if (!up) { // header: hazard-striped housing so a gate never reads as ground or a ladder
      R(g, 0, 0, 16, 6, p[0]);
      for (x = 0; x < 16; x++) for (y = 1; y < 4; y++) P(g, x, y, ((x + y) & 3) < 2 ? p[3] : p[0]);
      R(g, 0, 4, 16, 1, p[1]); P(g, 3, 4, p[2]); P(g, 12, 4, p[2]);
    }
    return nesify(cv);
  }

  // ---------------- theme tile specs ----------------
  // '#': {p, body, top}  'X': {p, body, top?}  '=': {p, k}  '^': {p, k}  '~': {p, k}  'H': {p, k}  'b': p  'L': p
  var WOOD = [K, Q.y0, Q.y1, Q.n2], IRONP = [K, Q.g0, Q.g1, Q.W];
  var TT = {
    tunnels: {
      '#': { p: [K, Q.g0, Q.g1, Q.t1], body: 'hewn', top: 'ledge' },
      'X': { p: WOOD, body: 'timber' },
      '=': { p: WOOD, k: 'beam' },
      '^': { p: [K, Q.g0, Q.g1, Q.W] },
      '~': { p: [K, Q.c0, Q.c1, Q.c2], k: 'water' },
      'H': { p: WOOD }, 'b': WOOD, 'L': [K, Q.g0, Q.g1, Q.y2]
    },
    cinder: {
      '#': { p: [K, Q.g0, Q.g1, Q.W], body: 'cinder', top: 'slab' },
      'X': { p: [K, Q.g0, Q.g1, Q.n1], body: 'lichenBlock', top: 'plain' },
      '=': { p: [K, Q.g0, Q.g1, Q.y2], k: 'catwalk' },
      '^': { p: [K, Q.n0, Q.n1, Q.g1], k: 'rebar' },
      '~': { p: [K, Q.t0, Q.G1, Q.l2], k: 'bubble' },
      'H': { p: IRONP }, 'b': WOOD, 'L': [K, Q.g0, Q.g1, Q.y2]
    },
    hoard: {
      '#': { p: [K, Q.y0, Q.g0, Q.g1], body: 'junk', top: 'bags' },
      'X': { p: [K, Q.g0, Q.g1, Q.W], body: 'appliance' },
      '=': { p: WOOD, k: 'beam' },
      '^': { p: [K, Q.G0, Q.G2, Q.W], k: 'shards' },
      '~': { p: [K, Q.y0, Q.y1, Q.l3], k: 'bubble' },
      'H': { p: WOOD }, 'b': WOOD, 'L': [K, Q.g0, Q.g1, Q.y2]
    },
    goblin: {
      '#': { p: [K, Q.y0, Q.n1, Q.n2], body: 'dirt', top: 'plate' },
      'X': { p: [K, Q.y0, Q.y1, Q.n3], body: 'shanty', top: 'plain' },
      '=': { p: [K, Q.y0, Q.y1, Q.n3], k: 'lashed' },
      '^': { p: [K, Q.g0, Q.g1, Q.W] },
      '~': { p: [K, Q.o1, Q.n2, Q.y3], k: 'fire' },
      'H': { p: [K, Q.y0, Q.y1, Q.n3], k: 'rope' }, 'b': WOOD, 'L': [K, Q.g0, Q.g1, Q.y2]
    },
    gym: {
      '#': { p: [K, Q.g0, Q.b3, Q.b4], body: 'concrete', top: 'mat' },
      'X': { p: [K, Q.g0, Q.g1, Q.o1], body: 'plates' },
      '=': { p: [K, Q.r0, Q.r1, Q.r2], k: 'bench' },
      '^': { p: [K, Q.b3, Q.b6, Q.W], k: 'shards' },
      '~': { p: [K, Q.r1, Q.r2, Q.r3], k: 'bubble' },
      'H': { p: [K, Q.y1, Q.y3, Q.n3], k: 'climb' }, 'b': WOOD, 'L': [K, Q.g0, Q.g1, Q.y2]
    },
    swine: {
      '#': { p: [K, Q.y0, Q.y1, Q.n3], body: 'ashlar', top: 'grooves' },
      'X': { p: [K, Q.g0, Q.g1, Q.W], body: 'rounded' },
      '=': { p: WOOD, k: 'beam' },
      '^': { p: [K, Q.y0, Q.n3, Q.W], k: 'tusks' },
      '~': { p: [K, Q.y0, Q.y1, Q.l3], k: 'bubble' },
      'H': { p: WOOD }, 'b': WOOD, 'L': [K, Q.g0, Q.g1, Q.r1]
    },
    distillery: {
      '#': { p: [K, Q.y0, Q.y1, Q.y3], body: 'boards', top: 'boards' },
      'X': { p: [K, Q.n0, Q.n1, Q.n2], body: 'riveted' },
      '=': { p: [K, Q.y0, Q.y1, Q.n3], k: 'beam' },
      '^': { p: [K, Q.y0, Q.n1, Q.n3], k: 'shards' },
      '~': { p: [K, Q.y1, Q.y3, Q.W], k: 'bubble' },
      'H': { p: WOOD }, 'b': WOOD, 'L': [K, Q.g0, Q.g1, Q.y2]
    },
    pound: {
      '#': { p: [K, Q.g0, Q.g1, Q.y2], body: 'concrete', top: 'curb' },
      'X': { p: [K, Q.b3, Q.b4, Q.W], body: 'azulejo', top: 'plain' },
      '=': { p: IRONP, k: 'grate' },
      '^': { p: IRONP, k: 'wire' },
      '~': { p: [K, Q.c0, Q.c1, Q.c2], k: 'water' },
      'H': { p: IRONP }, 'b': WOOD, 'L': [K, Q.g0, Q.g1, Q.y2]
    },
    // safe room floors (the UI draws theme 'safe' or the room's own id)
    safe: {
      '#': { p: WOOD, body: 'boards', top: 'boards' },
      'X': { p: [K, Q.n0, Q.n1, Q.n2], body: 'boards' },
      '=': { p: WOOD, k: 'beam' }, '^': { p: IRONP }, '~': { p: [K, Q.c0, Q.c1, Q.c2], k: 'water' },
      'H': { p: WOOD }, 'b': WOOD, 'L': [K, Q.g0, Q.g1, Q.y2]
    }
  };
  // safe room floors: each room id is also a tile theme
  var SAFE_FLOORS = {
    safe_guild: { p: [K, Q.y0, Q.n0, Q.y1], body: 'boards', top: 'boards' },
    safe_tally: { p: [K, Q.r3, Q.W, Q.W], body: 'checker', top: 'plain' },
    safe_cookie: { p: [K, Q.g0, Q.g1, Q.W], body: 'checker', top: 'plain' },
    safe_shelter: { p: [K, Q.n0, Q.n1, Q.n2], body: 'checker', top: 'plain' },
    safe_bugaboo: { p: [K, Q.y0, Q.y1, Q.n2], body: 'boards', top: 'boards' }
  };
  Object.keys(SAFE_FLOORS).forEach(function (id) {
    var o = {}; for (var k in TT.safe) o[k] = TT.safe[k];
    o['#'] = SAFE_FLOORS[id];
    TT[id] = o;
  });
  TT.gym_red = TT.gym;
  art.themes = ['tunnels', 'cinder', 'hoard', 'goblin', 'gym', 'gym_red', 'swine', 'distillery', 'pound', 'safe'];
  function tileTheme(theme) { return TT[theme] ? theme : (/^safe/.test(theme || '') ? 'safe' : 'tunnels'); }

  function paintTile(spec, ch, mask, v, a) {
    var cv = mkCanvas(16, 16), g = g2(cv), t = spec[ch];
    var r = rng(hashStr(ch + (t.body || t.k || '')) + v * 7919 + 13);
    var up = mask & 1, L = mask & 4, Rt = mask & 8, dn = mask & 2, p = t.p || t;
    if (ch === '#' || ch === 'X') {
      var th = 0;
      BODY[t.body || 'hewn'](g, p, v, r);
      if (!up) th = TOP[t.top || 'plain'](g, p, v, r);
      var k = p[0];
      if (!L) R(g, 0, th, 1, 16 - th, k);
      if (!Rt) R(g, 15, th, 1, 16 - th, k);
      if (!dn) R(g, 0, 15, 16, 1, k);
      if (!up && !L) { R(g, 0, 0, 1, th, k); g.clearRect(0, 0, 1, 1); }
      if (!up && !Rt) { R(g, 15, 0, 1, th, k); g.clearRect(15, 0, 1, 1); }
      if (!dn && !L) g.clearRect(0, 15, 1, 1);
      if (!dn && !Rt) g.clearRect(15, 15, 1, 1);
    } else if (ch === '=') {
      platPaint(g, p, t.k, L, Rt);
    } else if (ch === '^') {
      spikePaint(g, p, t.k); outlineCanvas(cv, 16, 16, 1, K);
    } else if (ch === '~') {
      liquidPaint(g, p, t.k || 'water', !up, a);
    } else if (ch === 'H') {
      ladderPaint(g, p, t.k); outlineCanvas(cv, 16, 16, 1, K);
    } else if (ch === 'b') {
      cratePaint(g, p);
    } else return null;
    return nesify(cv);
  }

  var tileCache = {};
  art.tile = function (ctx, theme, ch, x, y, info) {
    theme = tileTheme(theme);
    var spec = TT[theme];
    var mask = 0, v = 0, a = 0;
    if (info) {
      mask = (info.up ? 1 : 0) | (info.down ? 2 : 0) | (info.left ? 4 : 0) | (info.right ? 8 : 0);
      if (info.tx !== undefined) v = hash2(info.tx | 0, (info.ty | 0) * 3 + 1) & 3;
    }
    if (ch === 'L') {
      var op = info && info.open > 0 ? Math.min(16, Math.round(+info.open * 16)) : 0;
      if (op >= 16 && (mask & 1)) return; // fully raised: only the header beam stays
      var gk = theme + 'L', gc = tileCache[gk] || (tileCache[gk] = {}), gid = (mask << 5) | op;
      var gcv = gc[gid] || (gc[gid] = gatePaint(spec.L || TT.tunnels.L, mask, op));
      ctx.drawImage(gcv, Math.round(x), Math.round(y));
      return;
    }
    if (!spec[ch]) return;
    if (ch === '=') { mask &= 12; v = 0; }
    else if (ch === '~') { mask &= 1; v = 0; a = Math.floor(((info && info.t !== undefined) ? info.t : (DCW.t || 0)) * 4) & 1; }
    else if (ch === '^' || ch === 'H' || ch === 'b') { mask = 0; v = 0; }
    var key = theme + ch, tc = tileCache[key] || (tileCache[key] = {});
    var id = (mask << 4) | (v << 2) | a;
    var cv = tc[id];
    if (cv === undefined) cv = tc[id] = paintTile(spec, ch, mask, v, a);
    if (cv) ctx.drawImage(cv, Math.round(x), Math.round(y));
  };

  /* =====================================================================
     PARALLAX BACKGROUNDS  (NES: a flat back colour + at most two
     repeating layers, pre-rendered once; small 2-frame "props" such as
     torch flames, TV screens and neon flicker at their layer positions)
     ===================================================================== */
  var BGH = 200; // layer canvas height (screen is 180; extra for camY parallax)
  function rep(g, w, fn) { for (var k = -1; k <= 1; k++) { g.save(); g.translate(k * w, 0); fn(); g.restore(); } }
  function layer(w, rate, draw) { return { w: w, rate: rate, draw: draw }; }
  // irregular stone courses (rough-hewn wall), seamless across w. hiP = chance a stone gets a lit top edge
  function hewnWall(g, w, y0, y1, seed, face, mortar, hi, hiP) {
    var r = rng(seed), y = y0;
    R(g, 0, y0, w, y1 - y0, mortar);
    while (y < y1) {
      var h = 9 + ((r() * 5) | 0), x = (r() * 12) | 0, s0 = x;
      if (y + h > y1) h = y1 - y;
      while (x < s0 + w) {
        var bw = 14 + ((r() * 16) | 0); if (s0 + w - (x + bw) < 10) bw = s0 + w - x;
        var lit = r() < hiP, xx = x % w;
        for (var k = 0; k < 2; k++) {
          var bx = xx - k * w;
          R(g, bx, y, bw - 1, h - 1, face);
          if (lit) { R(g, bx + 1, y, bw - 3, 1, hi); R(g, bx, y + 1, 1, h - 3, hi); }
          P(g, bx + bw - 2, y + h - 2, mortar);
        }
        x += bw;
      }
      y += h;
    }
  }
  // regular block wall (running bond), seamless when w is a multiple of bw
  function blockWall(g, x0, y0, w, h, bw, bh, face, mortar, hi, lit) {
    R(g, x0, y0, w, h, mortar);
    for (var row = 0; row * bh < h; row++) {
      var y = y0 + row * bh, off = row & 1 ? bw >> 1 : 0, hh = Math.min(bh - 1, h - row * bh);
      for (var bx = -bw + off; bx < w; bx += bw) {
        var a = Math.max(0, bx), b = Math.min(w, bx + bw - 1);
        if (b > a && hh > 0) {
          R(g, x0 + a, y, b - a, hh, face);
          if (hi && lit) { R(g, x0 + a, y, b - a, 1, hi); if (bx >= 0) R(g, x0 + a, y, 1, hh, hi); }
        }
      }
    }
  }
  // arched opening (semicircular top) filled with c
  function archFill(g, cx, top, hw, bot, c) {
    for (var y = top; y < bot; y++) {
      var dy = top + hw - y, ww = dy > 0 ? Math.round(Math.sqrt(Math.max(0, hw * hw - dy * dy))) : hw;
      if (ww > 0) R(g, cx - ww, y, ww * 2, 1, c);
    }
  }
  // a ring of voussoir stones around an arch
  function archStones(g, cx, top, hw, th, bot, c1, c2, k) {
    archFill(g, cx, top - th, hw + th, bot, k);
    var n = Math.max(5, Math.round(hw / 4)), cy = top + hw;
    for (var i = 0; i <= n; i++) {
      var a0 = Math.PI * i / (n + 1), a1 = Math.PI * (i + 1) / (n + 1);
      for (var a = a0 + 0.04; a < a1 - 0.04; a += 0.02) for (var rr = hw + 1; rr < hw + th; rr++) P(g, Math.round(cx + Math.cos(a) * rr), Math.round(cy - Math.sin(a) * rr), i & 1 ? c1 : c2);
    }
    // jambs below the springing line
    for (var y = cy; y < bot; y += 9) { R(g, cx - hw - th + 1, y + 1, th - 1, 7, (y >> 3) & 1 ? c1 : c2); R(g, cx + hw + 1, y + 1, th - 1, 7, (y >> 3) & 1 ? c2 : c1); }
  }
  // a maze passage seen through a wall opening: receding block frames, floor seams, a lit crossing far away
  function corridor(g, x0, y0, w, h, c) {
    R(g, x0, y0, w, h, K);
    for (var k = 1; k <= 4; k++) {
      var ix = Math.round(w * 0.11 * k), iy = Math.round(h * 0.09 * k), fx = x0 + ix, fw = w - ix * 2, fy = y0 + iy, fb = y0 + h - Math.round(h * 0.06 * k);
      if (fw < 6) break;
      R(g, fx, fy, fw, 1, c.line); R(g, fx, fy, 1, fb - fy, c.line); R(g, fx + fw - 1, fy, 1, fb - fy, c.line);
      R(g, fx, fb, fw, 1, c.floor);
    }
    var cx = x0 + (w >> 1), ty = y0 + Math.round(h * 0.42);
    R(g, cx - 3, ty, 6, Math.round(h * 0.3), c.far); R(g, cx - 3, ty + Math.round(h * 0.3) - 1, 6, 1, c.tube);
  }
  // pre-rendered 2-frame props (NES flicker by frame swap)
  var PROPS = {
    torch: function () { // wall torch flame 7x11
      return strip(7, 11, 2, function (g, f) {
        if (f === 0) rows(g, 0, 0, ['...r...', '...r...', '..rr...', '..ror..', '.rooor.', '.royor.', 'rooyyor', 'royyyor', '.roywr.', '..ryr..', '...r...'], { r: Q.o1, o: Q.n2, y: Q.y3, w: Q.W });
        else rows(g, 0, 0, ['.......', '....r..', '...rr..', '..ror..', '..roor.', '.royyor', '.royyor', 'roywyor', '.royyr.', '..ryr..', '...r...'], { r: Q.o1, o: Q.n2, y: Q.y3, w: Q.W });
      });
    },
    torchS: function () { // distant torch 3x5
      return strip(3, 5, 2, function (g, f) {
        if (f === 0) rows(g, 0, 0, ['.r.', '.o.', 'roo', 'oyo', '.r.'], { r: Q.o1, o: Q.n2, y: Q.y3 });
        else rows(g, 0, 0, ['...', 'r..', 'ro.', 'oyo', '.r.'], { r: Q.o1, o: Q.n2, y: Q.y3 });
      });
    },
    eyes: function () { // a pair of eyes in the dark that blinks
      return strip(7, 2, 2, function (g, f) { if (f === 0) { R(g, 0, 0, 2, 2, Q.y2); R(g, 5, 0, 2, 2, Q.y2); P(g, 1, 0, Q.W); P(g, 6, 0, Q.W); } else { R(g, 0, 1, 2, 1, Q.y1); R(g, 5, 1, 2, 1, Q.y1); } });
    },
    lichen: function () { // a glowing lichen bloom that pulses
      return strip(9, 6, 2, function (g, f) {
        var a = f ? Q.t1 : Q.t0, b = f ? Q.t2 : Q.t1;
        rows(g, 0, 0, ['...a.....', '..aba..a.', '.abba.aba', '..aa..aa.', '.a..a....', '.........'], { a: a, b: b });
      });
    },
    fireplace: function () { // hearth fire 24x12
      return strip(24, 12, 2, function (g, f) {
        var p = { r: Q.o1, o: Q.n2, y: Q.y3, w: Q.W, l: Q.y0, k: Q.n0 };
        R(g, 1, 10, 22, 2, p.l); R(g, 3, 9, 18, 1, p.k);
        if (f === 0) rows(g, 2, 0, ['.....r.......r......', '....rr......rr...r..', '...ror..r...ror..rr..', '..roor.rr..roor.ror..', '.rooyorror.rooyoroor.', '.roywyoooorroywyoyor.', 'rooyyyoyoooooyyyyyorr', 'royyyyyyyooyyyyyyyyor', 'rryyyyyyyyyyyyyyyyyrr'], p);
        else rows(g, 2, 0, ['..r..........r.....', '..rr....r....rr.....', '.ror...rr...rorr..r.', '.roor.ror..roooor.rr.', 'rooyorroor.royyoroor.', 'royyyooyoorrooyyyoyor', 'royywyoyyoooyyywyyyor', 'royyyyyyyooyyyyyyyyor', 'rryyyyyyyyyyyyyyyyyrr'], p);
      });
    },
    stillfire: function () { // burner flames under the still 16x6
      return strip(16, 6, 2, function (g, f) {
        var p = { b: Q.b3, c: Q.b4, w: Q.W, y: Q.y3, r: Q.o1 };
        if (f === 0) rows(g, 0, 0, ['..y....y....y...', '.yry..yry..yry..', '.yry..yry..yry..', 'yrrry.yrry.yrryy', 'rrrrrrrrrrrrrrrr', 'gggggggggggggggg'], { y: Q.y3, r: Q.o1, g: Q.g0 });
        else rows(g, 0, 0, ['.....y....y....y', '...y.yy..yry..y.', '..yry.yry.yry.yr', '.yrrryrrryrrryrr', 'rrrrrrrrrrrrrrrr', 'gggggggggggggggg'], { y: Q.y3, r: Q.o1, g: Q.g0 });
      });
    },
    neon24: function () { // OPEN 24 HOURS neon, flickers off now and then (frame 1 = off)
      return strip(46, 15, 2, function (g, f) {
        R(g, 0, 0, 46, 15, K); R(g, 0, 0, 46, 1, Q.g0); R(g, 0, 14, 46, 1, Q.g0); R(g, 0, 0, 1, 15, Q.g0); R(g, 45, 0, 1, 15, Q.g0);
        tiny(g, 'OPEN', 23, 2, f ? Q.r0 : Q.r2, { align: 'center' });
        tiny(g, '24 HOURS', 23, 8, f ? Q.r0 : Q.W, { align: 'center' });
      });
    },
    onair: function () { // ON AIR light (trailer)
      return strip(24, 9, 2, function (g, f) {
        R(g, 0, 0, 24, 9, K); R(g, 1, 1, 22, 7, f ? Q.r0 : Q.r1); tiny(g, 'ON AIR', 12, 2, f ? Q.n0 : Q.W, { align: 'center' });
      });
    },
    tvA: function () { return tvStrip(0); }, tvB: function () { return tvStrip(1); }, tvC: function () { return tvStrip(2); },
    seal: function () { // magically sealed portcullis shimmer 20x30
      return strip(20, 30, 2, function (g, f) {
        for (var y = 0; y < 30; y++) for (var x = 0; x < 20; x++) if (((x + y + f) & 3) === 0 && ((x * 7 + y * 3) % 5)) P(g, x, y, Q.m0);
      });
    },
    field: function () { // red force field around the stairwell 48x60
      return strip(48, 60, 2, function (g, f) {
        for (var y = 0; y < 60; y++) for (var x = 0; x < 48; x++) {
          var dx = x - 24, dy = y - 34, d = dx * dx / 576 + dy * dy / 900;
          if (d > 1 || y > 58) continue;
          if (d > 0.82) P(g, x, y, f ? Q.r1 : Q.r2);
          else if (((x + y * 2 + f * 2) & 7) === 0) P(g, x, y, Q.r0);
        }
      });
    },
    bulbs: function () { // marquee / ring lights that chase (row of 2 frames)
      return strip(8, 3, 2, function (g, f) { R(g, f ? 4 : 0, 0, 3, 3, Q.y3); P(g, (f ? 4 : 0) + 1, 1, Q.W); R(g, f ? 0 : 4, 1, 3, 1, Q.y0); });
    },
    stagelight: function () { // can light, lens blinks
      return strip(10, 8, 2, function (g, f) { R(g, 1, 0, 8, 6, Q.g0); R(g, 0, 1, 10, 4, Q.g0); R(g, 2, 1, 6, 4, f ? Q.y2 : Q.y3); P(g, 3, 2, Q.W); R(g, 4, 6, 2, 2, Q.g0); }, K);
    },
    cagebark: function () { // a pair of eyes in a reward cage
      return strip(6, 3, 2, function (g, f) { if (!f) { P(g, 0, 1, Q.y3); P(g, 5, 1, Q.y3); P(g, 1, 1, Q.W); } else { R(g, 0, 2, 2, 1, Q.y1); R(g, 4, 2, 2, 1, Q.y1); } });
    }
  };
  // safe-room TV screens: three different shows, 2 frames each (28x18)
  function tvStrip(kind) {
    return strip(28, 18, 2, function (g, f) {
      R(g, 0, 0, 28, 18, K);
      if (kind === 0) { // the System AI's crawler count
        R(g, 1, 1, 26, 16, Q.b1); tiny(g, 'ALIVE', 14, 3, Q.b6, { align: 'center' }); tiny(g, f ? '1.29M' : '1.28M', 14, 10, Q.W, { align: 'center' });
      } else if (kind === 1) { // recap: a cat and fire
        R(g, 1, 1, 26, 16, f ? Q.r0 : Q.o0);
        tiny(g, 'RECAP', 14, 2, Q.y3, { align: 'center' });
        rows(g, 3, 10, ['w.w....', 'wwww...', 'wkwkwww', 'wwwwwww', '.w..w..'], { w: f ? Q.n3 : Q.n2, k: K });
        for (var x = 15; x < 26; x += 3) R(g, x, 12 - ((x + f) & 1) * 2, 2, 4 + ((x + f) & 1) * 2, Q.y2);
      } else { // static
        for (var y = 1; y < 17; y++) for (var x2 = 1; x2 < 27; x2++) if (((x2 * 13 + y * 7 + f * 5) % 7) < 3) P(g, x2, y, ((x2 + y + f) % 3) ? Q.g1 : Q.W); else P(g, x2, y, Q.g0);
      }
    });
  }
  var propCache = {};
  function prop(k) { return propCache[k] || (propCache[k] = PROPS[k]()); }
  // irregular 2-frame flicker for flames: stays on a frame for a random 2-6 ticks
  function flickF(t, ph) { var q = Math.floor(t * 9 + ph * 7.3); return (hash2(q, (ph * 977) | 0) >>> 3) % 5 < 2 ? 1 : 0; }

  var BG = {};

  /* ---------------- FIRST FLOOR: torchlit hewn-stone tunnels ---------------- */
  BG.tunnels = {
    back: K,
    layers: [
      // far: rough wall, a pitch-black side alley, a lichen-lit alley, an easy-to-miss guild sign
      layer(384, 0.25, function (g, w) {
        hewnWall(g, w, 20, 150, 302, Q.y0, K, Q.n0, 0.08);
        var r = rng(303), x;
        R(g, 0, 0, w, 20, K);
        for (x = 0; x < w; x += 5 + ((r() * 9) | 0)) { var cw = 3 + ((r() * 6) | 0); R(g, x, 20, cw, 1 + ((r() * 4) | 0), K); }
        rep(g, w, function () {
          // pitch-black alley
          archStones(g, 72, 62, 26, 6, 150, Q.n0, Q.y0, K);
          archFill(g, 72, 62, 26, 150, K);
          // lichen-lit alley: dark green jambs speckled with lichen, a long way down
          archStones(g, 268, 74, 22, 6, 150, Q.n0, Q.y0, K);
          archFill(g, 268, 74, 22, 150, K);
          archFill(g, 268, 76, 20, 150, Q.t0); archFill(g, 268, 78, 18, 150, K);
          var rl = rng(304);
          for (var i = 0; i < 26; i++) { var yy = 90 + ((rl() * 58) | 0), side = rl() < 0.5 ? -1 : 1, xx = 268 + side * (13 + ((rl() * 4) | 0)); P(g, xx, yy, rl() < 0.3 ? Q.t2 : Q.t1); }
          R(g, 263, 140, 10, 1, Q.t1); R(g, 265, 139, 6, 1, Q.t0);
          // official dungeon sign, blends into the wall
          R(g, 206, 94, 30, 11, K); R(g, 207, 95, 28, 9, Q.n0); R(g, 207, 95, 28, 1, Q.y1);
          tiny(g, 'GUILD', 218, 97, Q.y0, { align: 'center' }); rows(g, 229, 97, ['.y..', 'yyyy', '.y..'].map(function (s) { return s.split('').reverse().join(''); }), { y: Q.y0 });
          // dim lichen crusts on the far wall
          var spots = [[150, 46], [182, 128], [340, 60], [20, 112]];
          for (i = 0; i < spots.length; i++) for (var k = 0; k < 7; k++) P(g, spots[i][0] + ((rl() * 10) | 0), spots[i][1] + ((rl() * 6) | 0), k < 5 ? Q.t0 : Q.t1);
        });
        R(g, 0, 150, w, BGH - 150, K);
      }),
      // near: timber support sets with iron wall torches, rubble along the foot of the wall
      layer(320, 0.5, function (g, w) {
        rep(g, w, function () {
          var r = rng(311), i, x;
          // cap beam under the roof
          R(g, 0, 2, w, 11, K); R(g, 0, 3, w, 8, Q.n0); R(g, 0, 3, w, 1, Q.y1);
          for (x = 4; x < w; x += 22) { R(g, x, 6, 7, 1, Q.y0); R(g, x + 12, 8, 5, 1, Q.y0); }
          var posts = [30, 190];
          for (i = 0; i < posts.length; i++) {
            var px = posts[i];
            // knee braces
            for (var k = 0; k < 15; k++) { R(g, px - 2 - k, 12 + k, 4, 3, K); R(g, px + 8 + k, 12 + k, 4, 3, K); }
            for (k = 0; k < 14; k++) { R(g, px - 2 - k, 13 + k, 2, 1, Q.n0); P(g, px - 1 - k, 12 + k, Q.y1); R(g, px + 9 + k, 13 + k, 2, 1, Q.n0); P(g, px + 9 + k, 12 + k, Q.y1); }
            // post
            R(g, px, 11, 10, 147, K); R(g, px + 1, 11, 8, 147, Q.n0); R(g, px + 1, 11, 1, 147, Q.y1); R(g, px + 7, 11, 1, 147, Q.y0);
            for (var y = 26; y < 150; y += 23) { R(g, px + 3, y, 3, 1, Q.y0); P(g, px + 4, y + 9, Q.y0); }
            R(g, px + 1, 14, 8, 2, Q.g0); P(g, px + 2, 14, Q.g1); P(g, px + 7, 14, Q.g1);
            // iron torch sconce (flame is a prop)
            R(g, px + 10, 84, 7, 3, K); R(g, px + 10, 85, 6, 1, Q.g0);
            R(g, px + 14, 72, 4, 14, K); R(g, px + 15, 72, 2, 13, Q.y0); P(g, px + 15, 72, Q.n0);
            R(g, px + 13, 70, 6, 3, K); R(g, px + 14, 71, 4, 1, Q.g0);
          }
          // rubble
          for (x = 0; x < w; x += 7 + ((r() * 20) | 0)) { var rw = 4 + ((r() * 7) | 0); R(g, x, 154 - (rw >> 1), rw, (rw >> 1) + 6, K); R(g, x + 1, 155 - (rw >> 1), rw - 2, (rw >> 1) + 4, Q.y0); P(g, x + 1, 155 - (rw >> 1), Q.n0); }
        });
      })
    ],
    props: [
      { L: 0, x: 72, y: 128, k: 'eyes', fps: 0.7, blink: true },
      { L: 0, x: 286, y: 96, k: 'torchS', flick: 1 },
      { L: 1, x: 46, y: 61, k: 'torch', flick: 2, cx: true },
      { L: 1, x: 206, y: 61, k: 'torch', flick: 3, cx: true },
      { L: 0, x: 254, y: 120, k: 'lichen', fps: 1.1 },
      { L: 0, x: 276, y: 136, k: 'lichen', fps: 0.9, ph: 1 }
    ]
  };

  /* ---------------- SECOND FLOOR: cinderblock maze, ambient lit ---------------- */
  // a bloom of lichen: overlapping little blobs, brighter centres
  function bloom(g, x, y, n, c1, c2, seed) {
    var r = rng(seed);
    for (var i = 0; i < n; i++) { var bx = x + ((r() * n * 2.2) | 0) - n, by = y + ((r() * n * 1.2) | 0) - (n >> 1), rr = 1 + ((r() * 2) | 0); oval(g, bx, by, rr + 1, rr, c1); if (rr > 1 || r() < 0.5) P(g, bx, by, c2); }
  }
  // Floor 2 background palette: gray cinderblock in shadow, rust lichen
  var CN = { face: Q.g0, mortar: K, hi: Q.g1, lich: Q.n0, lich2: Q.n1, cor: { floor: Q.g0, far: Q.g0, line: Q.g0, tube: Q.g1 } };
    BG.cinder = {
    back: K,
    layers: [
      // far: endless cinderblock with maze passages branching off, rust-orange lichen, a bathroom door
      layer(384, 0.25, function (g, w) {
        R(g, 0, 0, w, BGH, K);
        blockWall(g, 0, 14, w, 138, 16, 8, CN.face, CN.mortar);
        rep(g, w, function () {
          R(g, 0, 10, w, 4, K);
          var cs = [[36, 58, 52], [180, 72, 38], [300, 54, 56]];
          for (var i = 0; i < cs.length; i++) { var c = cs[i]; R(g, c[0] - 2, c[1] - 2, c[2] + 4, 152 - c[1] + 2, K); corridor(g, c[0], c[1], c[2], 152 - c[1], CN.cor); }
          // bathroom door (do NOT pee in the hall)
          R(g, 114, 112, 24, 40, K); R(g, 116, 114, 20, 38, Q.y0); R(g, 118, 116, 16, 14, Q.n0); R(g, 118, 133, 16, 16, Q.n0); P(g, 132, 132, Q.y1);
          R(g, 117, 100, 18, 9, K); R(g, 118, 101, 16, 7, Q.g1);
          rows(g, 120, 102, ['.k...k..k.', 'kkk.kkk.k.', '.k..kkk.k.', '.k...k..k.', 'k.k.k.k.k.'], { k: K });
          // rust-orange lichen blooms
          var sp = [[100, 30, 5], [160, 122, 4], [250, 40, 6], [356, 128, 5], [14, 70, 4], [226, 100, 3]];
          for (i = 0; i < sp.length; i++) bloom(g, sp[i][0], sp[i][1], sp[i][2], CN.lich, CN.lich2, 405 + i);
        });
        R(g, 0, 152, w, BGH - 152, K);
      }),
      // near: cinderblock pillars catching the ambient light, a conduit along the ceiling
      layer(320, 0.5, function (g, w) {
        rep(g, w, function () {
          R(g, 0, 4, w, 7, K); R(g, 0, 5, w, 4, CN.face); R(g, 0, 5, w, 1, CN.hi);
          for (var x = 20; x < w; x += 64) { R(g, x, 2, 4, 11, K); R(g, x + 1, 3, 2, 9, CN.hi); }
          var pil = [96, 256];
          for (var i = 0; i < pil.length; i++) {
            var px = pil[i], pw = 32;
            R(g, px - 2, 11, pw + 4, 149, K);
            blockWall(g, px, 11, pw, 147, 16, 8, CN.face, K, CN.hi, true);
            R(g, px, 11, 1, 147, CN.hi); R(g, px + pw - 3, 11, 3, 147, K);
            bloom(g, px + 10, 46 + i * 50, 5, CN.lich2, Q.n2, 412 + i);
            bloom(g, px + 20, 112 - i * 30, 3, CN.lich, CN.lich2, 420 + i);
          }
        });
      })
    ]
  };

  /* ---------------- the Hoarder's chamber ---------------- */
  function mound(g, cx, base, hw, h, c) {
    for (var x = -hw; x <= hw; x++) { var t = x / hw, yy = Math.round(base - h * (1 - t * t)); R(g, cx + x, yy, 1, base - yy + 60, c); }
  }
  BG.hoard = {
    back: K,
    layers: [
      layer(384, 0.2, function (g, w) {
        hewnWall(g, w, 0, 150, 501, Q.y0, K, Q.n0, 0.05);
        rep(g, w, function () {
          var r = rng(502), i;
          var ms = [[60, 150, 80, 92], [210, 150, 64, 70], [330, 150, 58, 104]];
          for (i = 0; i < ms.length; i++) { mound(g, ms[i][0], ms[i][1] - 1, ms[i][2] + 1, ms[i][3] + 1, Q.n0); mound(g, ms[i][0], ms[i][1], ms[i][2], ms[i][3], K); }
          for (i = 0; i < ms.length; i++) { // junk outlines inside the mounds
            var m = ms[i];
            for (var k = 0; k < 16; k++) {
              var jx = m[0] - m[2] + 10 + ((r() * (m[2] * 2 - 20)) | 0), t = (jx - m[0]) / m[2], top = m[1] - m[3] * (1 - t * t);
              var jy = Math.round(top + 6 + r() * (m[1] - top - 8)), kind = (r() * 4) | 0;
              if (kind === 0) { R(g, jx, jy, 8, 11, Q.y0); R(g, jx + 1, jy + 1, 6, 9, K); R(g, jx + 1, jy + 4, 6, 1, Q.y0); }
              else if (kind === 1) { ring(g, jx, jy, 4, Q.y0); }
              else if (kind === 2) { oval(g, jx, jy, 5, 3, Q.y0); oval(g, jx, jy, 4, 2, K); P(g, jx - 2, jy - 1, Q.y0); }
              else { line(g, jx, jy, jx + 7, jy - 3, Q.y0); }
            }
          }
        });
        R(g, 0, 150, w, BGH - 150, K);
      }),
      layer(320, 0.45, function (g, w) {
        rep(g, w, function () {
          var r = rng(511), i;
          // nearer heaps along the floor
          mound(g, 40, 160, 46, 30, K); mound(g, 40, 160, 44, 28, Q.y0);
          mound(g, 196, 160, 60, 38, K); mound(g, 196, 160, 58, 36, Q.y0);
          for (i = 0; i < 70; i++) { // packed junk: cans, boxes, bottles, rags
            var jx = ((r() * w) | 0), jy = 126 + ((r() * 30) | 0), kk = (r() * 4) | 0;
            if (kk === 0) { R(g, jx, jy, 3, 4, K); R(g, jx, jy, 2, 3, Q.g0); }
            else if (kk === 1) { R(g, jx, jy, 6, 4, K); R(g, jx + 1, jy, 4, 3, Q.y1); }
            else if (kk === 2) { R(g, jx, jy, 2, 5, K); P(g, jx, jy, Q.G0); }
            else R(g, jx, jy, 2 + ((r() * 4) | 0), 1, Q.y0);
          }
          // a stained mattress leaning on the heap
          R(g, 120, 104, 28, 46, K); R(g, 121, 105, 26, 44, Q.g0);
          for (var y = 108; y < 148; y += 6) for (var x = 124; x < 146; x += 6) P(g, x, y, K);
          oval(g, 130, 122, 6, 4, Q.y0); oval(g, 140, 136, 4, 3, Q.y0); R(g, 121, 105, 26, 1, Q.g1);
          // garbage bags
          var bags = [[86, 148], [100, 152], [250, 146], [266, 152], [290, 150]];
          for (i = 0; i < bags.length; i++) { oval(g, bags[i][0], bags[i][1], 8, 6, K); oval(g, bags[i][0], bags[i][1], 7, 5, Q.g0); P(g, bags[i][0] - 3, bags[i][1] - 3, Q.g1); R(g, bags[i][0] - 1, bags[i][1] - 7, 2, 2, K); }
          // a tire
          ring(g, 64, 144, 7, K, 3); ring(g, 64, 144, 5, Q.g0);
          // skull torches on poles
          var sk = [84, 244];
          for (i = 0; i < sk.length; i++) {
            var sx = sk[i];
            R(g, sx - 1, 64, 4, 90, K); R(g, sx, 64, 2, 90, Q.y0);
            rows(g, sx - 5, 54, ['..kkkkkk..', '.kwwwwwwk.', 'kwwwwwwwwk', 'kwkkwwkkwk', 'kwkkwwkkwk', 'kwwwkkwwwk', '.kwwwwwwk.', '..kwkwkk..', '..kkkkkk..'], { k: K, w: Q.g1 });
          }
        });
      })
    ],
    props: [{ L: 1, x: 84, y: 43, k: 'torch', flick: 4, cx: true }, { L: 1, x: 244, y: 43, k: 'torch', flick: 5, cx: true }]
  };

  /* ---------------- goblin town + the goblin workshop ---------------- */
  BG.goblin = {
    back: K,
    layers: [
      layer(384, 0.2, function (g, w) {
        hewnWall(g, w, 0, 150, 601, Q.y0, K, Q.n0, 0.05);
        rep(g, w, function () {
          var r = rng(602), i;
          // shacks with lit windows
          var sh = [[20, 92, 50, 58], [96, 104, 40, 46], [170, 84, 56, 66], [250, 100, 44, 50], [320, 90, 52, 60]];
          for (i = 0; i < sh.length; i++) {
            var s = sh[i], x0 = s[0], y0 = s[1], sw = s[2];
            R(g, x0 - 1, y0 - 1, sw + 2, 152 - y0, K); R(g, x0, y0, sw, 152 - y0, Q.n0);
            for (var x = x0 + 4; x < x0 + sw; x += 5) R(g, x, y0, 1, 152 - y0, K);
            for (x = x0 - 3; x < x0 + sw + 3; x++) { var ry = y0 - 1 - Math.round(Math.max(0, 8 - Math.abs(x - x0 - sw / 2) * 16 / sw)); R(g, x, ry, 1, y0 - ry, K); }
            R(g, x0 + 6, y0 + 10, 6, 6, K); R(g, x0 + 7, y0 + 11, 4, 4, Q.y2); R(g, x0 + 9, y0 + 11, 1, 4, K);
            if (sw > 45) { R(g, x0 + sw - 14, y0 + 14, 6, 6, K); R(g, x0 + sw - 13, y0 + 15, 4, 4, Q.y1); }
          }
          // gear wheel
          ring(g, 140, 44, 16, Q.n0, 4); ring(g, 140, 44, 6, Q.n0, 2);
          for (i = 0; i < 10; i++) { var a = i * Math.PI / 5; R(g, Math.round(140 + Math.cos(a) * 18) - 2, Math.round(44 + Math.sin(a) * 18) - 2, 4, 4, Q.n0); }
          for (i = 0; i < 4; i++) { var b = i * Math.PI / 2 + 0.4; line(g, 140, 44, Math.round(140 + Math.cos(b) * 12), Math.round(44 + Math.sin(b) * 12), Q.n0); }
          // bunting strung across
          for (x = 0; x < 384; x += 8) { var yy = 30 + Math.round(Math.sin(x / 384 * Math.PI * 6) * 6); P(g, x, yy, Q.y1); tri(g, x + 4, yy + 1, 5, 5, [Q.r0, Q.y1, Q.t0][(x >> 3) % 3], true); }
        });
        R(g, 0, 150, w, BGH - 150, K);
      }),
      layer(320, 0.45, function (g, w) {
        rep(g, w, function () {
          var i;
          // copper steam pipe with a valve
          R(g, 0, 18, w, 7, K); R(g, 0, 19, w, 5, Q.n1); R(g, 0, 19, w, 1, Q.n2); R(g, 0, 23, w, 1, Q.n0);
          for (var x = 10; x < w; x += 48) { R(g, x, 17, 4, 9, K); R(g, x + 1, 18, 2, 7, Q.n2); }
          ring(g, 128, 14, 5, K, 2); ring(g, 128, 14, 4, Q.r1); R(g, 127, 14, 3, 6, K);
          // scaffold: poles, planks, braces, lashing
          var poles = [52, 212];
          for (i = 0; i < poles.length; i++) {
            var px = poles[i];
            R(g, px, 25, 7, 135, K); R(g, px + 1, 25, 5, 135, Q.n0); R(g, px + 1, 25, 1, 135, Q.y1);
            R(g, px - 30, 60, 67, 6, K); R(g, px - 29, 61, 65, 4, Q.y1); R(g, px - 29, 61, 65, 1, Q.n2);
            line(g, px + 6, 66, px + 34, 110, K); line(g, px + 7, 66, px + 35, 110, Q.n0);
            line(g, px, 66, px - 26, 108, K); line(g, px + 1, 66, px - 25, 108, Q.n0);
            R(g, px - 1, 59, 9, 2, Q.n3); R(g, px - 1, 65, 9, 1, Q.n3);
            // goblin banner hanging from the plank
            R(g, px + 14, 66, 16, 26, K); R(g, px + 15, 66, 14, 24, Q.r0);
            P(g, px + 15, 90, K); P(g, px + 22, 90, K); P(g, px + 28, 90, K); P(g, px + 18, 89, K); P(g, px + 25, 89, K);
            rows(g, px + 18, 71, ['.yyyy.', 'yyyyyy', 'yky.ky', 'yyyyyy', '.y.y.y', '......', 'y....y', '.yyyy.'], { y: Q.y1, k: Q.r0 });
            // torch bracket
            R(g, px + 7, 98, 6, 2, Q.g0); R(g, px + 10, 88, 3, 11, K); R(g, px + 11, 88, 1, 10, Q.y0);
          }
        });
      })
    ],
    props: [{ L: 1, x: 63, y: 77, k: 'torch', flick: 6, cx: true }, { L: 1, x: 223, y: 77, k: 'torch', flick: 7, cx: true }, { L: 0, x: 60, y: 98, k: 'torchS', flick: 8 }]
  };
  function tri(g, x, y, w, h, c, down) { // isoceles triangle, apex up (or apex down when down)
    g.fillStyle = c;
    for (var j = 0; j < h; j++) { var ww = Math.max(1, Math.round(w * (j + 1) / h)); g.fillRect(Math.round(x - ww / 2), down ? y + h - 1 - j : y + j, ww, 1); }
  }

  /* ---------------- the Juicer's 24-hour gym ---------------- */
  function poster(g, x, y, w, h, bg, fg, lines, big) {
    R(g, x - 1, y - 1, w + 2, h + 2, K); R(g, x, y, w, h, bg); R(g, x + 1, y + 1, w - 2, 1, fg);
    for (var i = 0; i < lines.length; i++) {
      if (big) bigText(g, lines[i], x + (w >> 1), y + 4 + i * 9, fg, { align: 'center', shadow: null });
      else tiny(g, lines[i], x + (w >> 1), y + 4 + i * 7, fg, { align: 'center' });
    }
  }
  BG.gym = {
    back: K,
    layers: [
      // far: mirror wall, ceiling strip lights, motivational posters
      layer(384, 0.2, function (g, w) {
        R(g, 0, 0, w, BGH, K);
        rep(g, w, function () {
          for (var x = 0; x < 384; x += 48) { R(g, x + 4, 2, 40, 4, Q.g0); R(g, x + 5, 3, 38, 2, Q.W); }
          var mir = [0, 64, 128, 192, 256, 320];
          for (var i = 0; i < mir.length; i++) {
            var mx = mir[i];
            R(g, mx + 2, 60, 60, 92, Q.g0); R(g, mx + 4, 62, 56, 88, Q.c0);
            line(g, mx + 10, 140, mx + 40, 70, Q.c1); line(g, mx + 14, 146, mx + 50, 76, Q.c1); line(g, mx + 30, 146, mx + 56, 96, Q.c0);
            R(g, mx + 4, 140, 56, 10, Q.c0);
          }
          poster(g, 14, 12, 66, 38, Q.r0, Q.y3, ['TODAY IS', 'THE DAY', 'YOU GAIN'], true);
          poster(g, 150, 18, 52, 30, Q.b1, Q.W, ['RELEASE', 'THE BEAST'], true);
          poster(g, 268, 16, 44, 30, Q.y1, K, ['EXCUSES', "DON'T", 'LOSE', 'CALORIES'], false);
          R(g, 110, 20, 18, 18, K); ring(g, 118, 28, 8, Q.g1); P(g, 118, 22, Q.g1); line(g, 118, 28, 118, 23, Q.W); line(g, 118, 28, 122, 30, Q.W);
        });
        R(g, 0, 152, w, BGH - 152, K);
      }),
      // near: squat rack with a loaded bar, dumbbell rack
      layer(320, 0.45, function (g, w) {
        rep(g, w, function () {
          // squat rack
          var sx = 40;
          R(g, sx, 56, 7, 104, K); R(g, sx + 1, 57, 5, 103, Q.g0); R(g, sx + 1, 57, 1, 103, Q.g1);
          R(g, sx + 50, 56, 7, 104, K); R(g, sx + 51, 57, 5, 103, Q.g0); R(g, sx + 51, 57, 1, 103, Q.g1);
          R(g, sx, 52, 57, 6, K); R(g, sx + 1, 53, 55, 4, Q.g0); R(g, sx + 1, 53, 55, 1, Q.g1);
          for (var y = 64; y < 150; y += 8) { P(g, sx + 3, y, K); P(g, sx + 53, y, K); }
          R(g, sx - 26, 82, 110, 4, K); R(g, sx - 25, 83, 108, 2, Q.g1);
          var plates = [sx - 18, sx - 12, sx + 66, sx + 72];
          for (var i = 0; i < plates.length; i++) { R(g, plates[i], 66, 6, 36, K); R(g, plates[i] + 1, 67, 4, 34, i & 1 ? Q.g0 : Q.o0); P(g, plates[i] + 2, 69, Q.g1); }
          // dumbbell rack
          var rx = 180;
          R(g, rx, 112, 110, 4, K); R(g, rx, 112, 110, 1, Q.g1); R(g, rx, 113, 110, 2, Q.g0);
          R(g, rx, 132, 110, 4, K); R(g, rx, 132, 110, 1, Q.g1); R(g, rx, 133, 110, 2, Q.g0);
          R(g, rx + 2, 112, 4, 48, K); R(g, rx + 3, 113, 2, 47, Q.g0); R(g, rx + 104, 112, 4, 48, K); R(g, rx + 105, 113, 2, 47, Q.g0);
          for (i = 0; i < 8; i++) {
            var dx = rx + 10 + i * 12, big = 3 + (i >> 2);
            R(g, dx, 110 - big * 2, 10, big * 2, K); R(g, dx + 1, 109 - big * 2 + 2, 2, big * 2 - 2, Q.g0); R(g, dx + 7, 109 - big * 2 + 2, 2, big * 2 - 2, Q.g0); R(g, dx + 3, 109 - big, 4, 1, Q.g1);
            R(g, dx, 130 - 4, 10, 4, K); R(g, dx + 1, 127, 2, 2, Q.g0); R(g, dx + 7, 127, 2, 2, Q.g0);
          }
        });
      })
    ],
    props: [{ L: 0, x: 225, y: 26, k: 'neon24', flick: 9, rare: true }]
  };
  // the room turns red when the boss doors shut
  BG.gym_red = { back: K, base: 'gym', recolor: function (rgb) {
    var l = rgb[0] * 0.3 + rgb[1] * 0.55 + rgb[2] * 0.15;
    return l < 30 ? K : l < 100 ? Q.r0 : l < 170 ? Q.o1 : Q.o2;
  } };

  /* ---------------- the Ball of Swine lair ---------------- */
  BG.swine = {
    back: K,
    layers: [
      // far: curved track walls of dark stone, sealed round portcullises, the stairwell behind a red force field
      layer(384, 0.2, function (g, w) {
        R(g, 0, 0, w, BGH, K);
        blockWall(g, 0, 22, w, 130, 32, 12, K, K, Q.p0, true);
        rep(g, w, function () {
          for (var x = 0; x < 384; x += 32) { R(g, x, 18, 30, 4, Q.p0); P(g, x, 18, K); P(g, x + 29, 18, K); }
          var ports = [64, 192];
          for (var i = 0; i < ports.length; i++) {
            var cx = ports[i];
            archStones(g, cx, 82, 18, 5, 152, Q.p0, Q.p1, K);
            archFill(g, cx, 82, 18, 152, K);
            for (var bx = cx - 15; bx < cx + 16; bx += 6) { R(g, bx, 84, 2, 68, Q.g0); P(g, bx, 84, Q.g1); }
            R(g, cx - 18, 106, 36, 2, Q.g0); R(g, cx - 18, 128, 36, 2, Q.g0);
          }
          // the stairwell under its force field
          archFill(g, 318, 92, 24, 152, Q.p0); archFill(g, 318, 96, 20, 152, K);
          for (var s = 0; s < 6; s++) R(g, 302 + s * 3, 112 + s * 7, 34 - s * 6, 3, s & 1 ? Q.g0 : Q.p1);
          bigText(g, '▼', 318, 98, Q.G1, { align: 'center', shadow: null });
        });
        R(g, 0, 152, w, BGH - 152, K);
      }),
      // near: rounded wall caps along the track, grooved floor lines, torches
      layer(320, 0.45, function (g, w) {
        rep(g, w, function () {
          var walls = [[10, 64], [150, 48], [250, 56]];
          for (var i = 0; i < walls.length; i++) {
            var x0 = walls[i][0], ww = walls[i][1];
            R(g, x0, 122, ww, 40, K); R(g, x0 + 2, 118, ww - 4, 4, K);
            R(g, x0 + 1, 123, ww - 2, 38, Q.p0); R(g, x0 + 3, 119, ww - 6, 4, Q.p0); R(g, x0 + 3, 119, ww - 6, 1, Q.p1); R(g, x0 + 1, 123, 1, 30, Q.p1);
            for (var y = 130; y < 160; y += 10) R(g, x0 + 1, y, ww - 2, 1, K);
          }
          for (var t = 0; t < 2; t++) { var tx = 100 + t * 160; R(g, tx, 70, 6, 2, Q.g0); R(g, tx + 2, 60, 2, 11, K); R(g, tx + 2, 61, 1, 9, Q.y0); }
        });
      })
    ],
    props: [{ L: 0, x: 64, y: 120, k: 'seal', fps: 3, cx: true }, { L: 0, x: 192, y: 120, k: 'seal', fps: 3, cx: true, ph: 1 },
      { L: 0, x: 318, y: 124, k: 'field', fps: 6, cx: true }, { L: 1, x: 103, y: 49, k: 'torch', flick: 10, cx: true }, { L: 1, x: 263, y: 49, k: 'torch', flick: 11, cx: true }]
  };

  /* ---------------- the Rev-Up distillery ---------------- */
  function jug(g, x, y, c, cork) { rows(g, x, y, ['.kk..', 'kcck.', 'kbbbk', 'kbbbk', 'kbbbk', '.kkk.'], { k: K, c: cork, b: c }); }
  BG.distillery = {
    back: K,
    layers: [
      layer(384, 0.2, function (g, w) {
        R(g, 0, 0, w, BGH, K);
        blockWall(g, 0, 10, w, 142, 16, 8, Q.g0, K);
        rep(g, w, function () {
          // shelves of moonshine jugs (60 full, 80 empty)
          var shelves = [[10, 44, 120], [10, 74, 120], [150, 54, 70]];
          for (var i = 0; i < shelves.length; i++) {
            var s = shelves[i];
            R(g, s[0], s[1], s[2], 4, K); R(g, s[0], s[1], s[2], 2, Q.y1); R(g, s[0], s[1] + 2, s[2], 1, Q.y0);
            for (var x = s[0] + 2; x < s[0] + s[2] - 5; x += 7) jug(g, x, s[1] - 6, (x >> 3) & 1 ? Q.y0 : Q.n0, Q.n3);
          }
          // the boss door with the cutout letters over it
          R(g, 282, 88, 44, 64, K); R(g, 285, 92, 38, 60, Q.y0); for (var bx = 288; bx < 322; bx += 6) R(g, bx, 92, 1, 60, K); R(g, 285, 108, 38, 2, Q.g0); R(g, 285, 132, 38, 2, Q.g0); R(g, 316, 120, 3, 3, Q.y2);
          R(g, 248, 62, 112, 22, K); R(g, 250, 64, 108, 18, Q.y0);
          bigText(g, 'LIVE LAUGH', 304, 65, Q.n3, { align: 'center', shadow: null });
          bigText(g, 'LOVE', 304, 74, Q.n3, { align: 'center', shadow: null });
          P(g, 252, 66, Q.y1); P(g, 355, 66, Q.y1);
          // REV-UP flyer
          R(g, 206, 92, 30, 36, K); R(g, 207, 93, 28, 34, Q.l2); tiny(g, 'REV', 221, 96, K, { align: 'center' }); tiny(g, 'UP!', 221, 103, Q.r0, { align: 'center' });
          tiny(g, 'BE', 221, 112, K, { align: 'center' }); tiny(g, 'YOUR', 221, 118, K, { align: 'center' });
        });
        R(g, 0, 152, w, BGH - 152, K);
      }),
      layer(320, 0.45, function (g, w) {
        rep(g, w, function () {
          // copper still: pot on a burner, coil, condenser barrel
          oval(g, 64, 98, 30, 26, K); oval(g, 64, 98, 28, 24, Q.n0); oval(g, 56, 90, 10, 9, Q.n1); P(g, 52, 86, Q.n2); P(g, 53, 85, Q.n2);
          R(g, 58, 64, 12, 10, K); R(g, 59, 65, 10, 9, Q.n0); R(g, 61, 54, 6, 11, K); R(g, 62, 55, 4, 10, Q.n1);
          R(g, 62, 50, 54, 5, K); R(g, 63, 51, 52, 3, Q.n0); R(g, 63, 51, 52, 1, Q.n1);
          for (var c = 0; c < 4; c++) { oval(g, 116, 64 + c * 9, 9, 3, K); oval(g, 116, 64 + c * 9, 8, 2, Q.n0); P(g, 110, 63 + c * 9, Q.n1); }
          R(g, 126, 96, 24, 52, K); R(g, 127, 97, 22, 51, Q.y0); R(g, 127, 104, 22, 2, Q.g0); R(g, 127, 136, 22, 2, Q.g0); R(g, 128, 97, 2, 51, Q.y1);
          R(g, 40, 122, 50, 4, K); R(g, 44, 126, 4, 34, K); R(g, 82, 126, 4, 34, K); R(g, 45, 126, 2, 34, Q.g0); R(g, 83, 126, 2, 34, Q.g0);
          // bicycle blender
          var bx = 200;
          ring(g, bx, 140, 12, K, 3); ring(g, bx, 140, 11, Q.g0); ring(g, bx + 40, 140, 12, K, 3); ring(g, bx + 40, 140, 11, Q.g0);
          line(g, bx, 140, bx + 18, 118, Q.r1); line(g, bx + 18, 118, bx + 40, 140, Q.r1); line(g, bx + 18, 118, bx + 34, 116, Q.r1); line(g, bx + 18, 140, bx, 140, Q.r1); line(g, bx + 18, 140, bx + 18, 118, Q.r1);
          R(g, bx + 14, 113, 9, 3, K); R(g, bx + 30, 108, 2, 10, Q.g0);
          R(g, bx + 32, 92, 12, 18, K); R(g, bx + 33, 93, 10, 16, Q.b6); R(g, bx + 33, 101, 10, 8, Q.r2); R(g, bx + 32, 88, 12, 4, Q.g0);
          // metal tub bolted to the floor
          R(g, 268, 128, 46, 30, K); R(g, 269, 129, 44, 29, Q.g0); R(g, 269, 129, 44, 2, Q.g1); R(g, 271, 131, 40, 3, Q.y3);
          P(g, 272, 156, Q.g1); P(g, 310, 156, Q.g1);
        });
      })
    ],
    props: [{ L: 1, x: 64, y: 128, k: 'stillfire', flick: 12, cx: true }]
  };

  /* ---------------- the kobold dog pound (a Portuguese municipal kennel) ---------------- */
  BG.pound = {
    back: K,
    layers: [
      layer(384, 0.2, function (g, w) {
        R(g, 0, 0, w, BGH, K);
        blockWall(g, 0, 12, w, 140, 32, 16, K, K, Q.b1, true);
        // azulejo band
        R(g, 0, 92, w, 18, K);
        for (var x = 0; x < w; x += 8) for (var y = 93; y < 109; y += 8) {
          R(g, x, y, 7, 7, Q.b1); P(g, x + 3, y + 1, Q.b3); P(g, x + 1, y + 3, Q.b3); P(g, x + 5, y + 3, Q.b3); P(g, x + 3, y + 5, Q.b3); P(g, x + 3, y + 3, Q.b4); P(g, x, y, Q.b3);
        }
        rep(g, w, function () {
          // CANIL MUNICIPAL plaque
          R(g, 140, 16, 64, 16, K); R(g, 141, 17, 62, 14, Q.b3); R(g, 142, 18, 60, 12, Q.W);
          tiny(g, 'CANIL', 172, 19, Q.b1, { align: 'center' }); tiny(g, 'MUNICIPAL', 172, 25, Q.b1, { align: 'center' });
          // kobold banners
          var bn = [40, 260, 340];
          for (var i = 0; i < bn.length; i++) {
            var bx = bn[i];
            R(g, bx - 2, 14, 24, 3, Q.y0); R(g, bx, 16, 20, 44, K); R(g, bx + 1, 16, 18, 42, Q.r0);
            tri(g, bx + 10, 52, 18, 8, K, false);
            rows(g, bx + 4, 24, ['y........y', 'yy......yy', '.yyyyyyyy.', '.ykyyyyky.', '..yyyyyy..', '...yyyy...', '....yy....'], { y: Q.y1, k: Q.r0 });
          }
        });
        R(g, 0, 152, w, BGH - 152, K);
      }),
      // near: chain-link fence with posts, barbed wire on top, a kennel gate
      layer(320, 0.45, function (g, w) {
        var x, y;
        for (y = 45; y < 160; y++) for (x = 0; x < w; x++) if (((x + y) % 12 === 0) || ((x - y + 1200) % 12 === 0)) P(g, x, y, Q.g0);
        rep(g, w, function () {
          R(g, 0, 42, w, 3, K); R(g, 0, 43, w, 1, Q.g1);
          for (x = 0; x < w; x += 4) { P(g, x, 36 + ((x >> 2) & 1) * 2, Q.g0); P(g, x + 1, 38, Q.g0); P(g, x + 2, 37, Q.g1); }
          var posts = [0, 106, 212];
          for (var i = 0; i < posts.length; i++) { var px = posts[i]; R(g, px, 34, 5, 126, K); R(g, px + 1, 34, 3, 126, Q.g0); R(g, px + 1, 34, 1, 126, Q.g1); }
          // kennel gate with a padlock
          R(g, 140, 70, 2, 90, Q.g1); R(g, 176, 70, 2, 90, Q.g1); R(g, 140, 70, 38, 2, Q.g1); R(g, 140, 112, 38, 2, Q.g1);
          R(g, 170, 104, 6, 6, K); R(g, 171, 105, 4, 4, Q.y2); R(g, 172, 101, 2, 3, Q.g1);
          tiny(g, 'CAO', 158, 76, Q.g1, { align: 'center' });
        });
      })
    ]
  };

  /* =====================================================================
     SAFE ROOM INTERIORS (drawn at camX 0; the UI puts stations and NPCs
     on a floor line at y=150, so the lower wall stays quiet: only a
     wainscot / baseboard below y~110)
     ===================================================================== */
  function bottle(g, x, y, c) { rows(g, x, y, ['.kk.', '.kk.', 'kcck', 'kcwk', 'kcck', 'kcck', '.kk.'], { k: K, c: c, w: Q.W }); }
  function book(g, x, y, h, c) { R(g, x, y, 4, h, K); R(g, x + 1, y + 1, 2, h - 1, c); P(g, x + 1, y + 2, Q.W); }
  function shelf(g, x, y, w, c1, c2) { R(g, x, y, w, 4, K); R(g, x, y, w, 2, c1); R(g, x, y + 2, w, 1, c2); }
  function monitorBank(g, cx, y, props) { R(g, cx - 52, y, 104, 26, K); R(g, cx - 51, y + 1, 102, 1, Q.g0); }
  function wainscot(g, y0, face, rail, line) {
    R(g, 0, y0, 320, 150 - y0, face); R(g, 0, y0, 320, 2, rail); R(g, 0, y0 + 2, 320, 1, K);
    for (var x = 12; x < 320; x += 40) { R(g, x, y0 + 8, 28, 150 - y0 - 14, line); R(g, x + 1, y0 + 9, 26, 150 - y0 - 16, face); }
    R(g, 0, 146, 320, 4, K); R(g, 0, 146, 320, 1, rail);
  }
  function tvSlot(g, x, y) { R(g, x - 2, y - 2, 32, 22, K); R(g, x - 1, y - 1, 30, 20, Q.g0); R(g, x + 12, y + 20, 4, 4, Q.g0); }

  // Mordecai's tutorial guild hall: a homey stone room, a hearth, potion shelves, keepsakes, the guild banner
  BG.safe_guild = {
    back: K,
    layers: [layer(320, 0, function (g) {
      hewnWall(g, 320, 0, 150, 701, Q.y0, K, Q.n0, 0.3);
      // ceiling beams
      R(g, 0, 0, 320, 12, K); R(g, 0, 1, 320, 9, Q.n0); R(g, 0, 1, 320, 1, Q.y1);
      for (var x = 20; x < 320; x += 60) { R(g, x, 10, 8, 8, K); R(g, x + 1, 10, 6, 7, Q.n0); }
      wainscot(g, 112, Q.n0, Q.y1, Q.y0);
      // hearth
      R(g, 10, 64, 70, 86, K); blockWall(g, 11, 70, 68, 80, 16, 8, Q.g0, K, Q.g1, true);
      R(g, 6, 62, 78, 8, K); R(g, 7, 63, 76, 5, Q.y1); R(g, 7, 63, 76, 1, Q.n2);
      archFill(g, 45, 100, 18, 150, K); R(g, 27, 140, 36, 10, Q.y0);
      // keepsakes on the mantel: a skull, candles, a framed ratkin
      rows(g, 14, 52, ['.kkkk.', 'kwwwwk', 'kwkkwk', 'kwwwwk', '.kwwk.', '.kkkk.'], { k: K, w: Q.g1 });
      for (var c = 0; c < 3; c++) { R(g, 30 + c * 6, 54 - c * 2, 3, 8 + c * 2, K); R(g, 31 + c * 6, 55 - c * 2, 1, 7 + c * 2, Q.n3); P(g, 31 + c * 6, 52 - c * 2, Q.y3); }
      R(g, 54, 42, 22, 20, K); R(g, 55, 43, 20, 18, Q.y1); R(g, 57, 45, 16, 14, Q.c0);
      rows(g, 58, 47, ['.k....k...', 'kkk..kkk..', '.kkkkkk...', '..kwkwk...', '..kkkkk...', '...kkk....', '..kkkkk...'], { k: Q.g0, w: Q.y3 });
      // potion shelves
      shelf(g, 98, 46, 100, Q.y1, Q.y0); shelf(g, 98, 78, 100, Q.y1, Q.y0);
      var pc = [Q.r1, Q.b4, Q.G2, Q.m2, Q.y2, Q.r1, Q.c2, Q.o1, Q.b4, Q.G2, Q.r2, Q.y2];
      for (var i = 0; i < 12; i++) { bottle(g, 102 + i * 8, 39, pc[i]); bottle(g, 104 + i * 8, 71, pc[(i + 5) % 12]); }
      R(g, 100, 50, 3, 26, K); R(g, 193, 50, 3, 26, K);
      // the guild banner
      R(g, 214, 14, 32, 3, Q.y1); R(g, 216, 17, 28, 50, K); R(g, 217, 17, 26, 48, Q.r0);
      tri(g, 230, 62, 26, 10, K, true); tri(g, 230, 62, 24, 8, Q.r0, true);
      rows(g, 220, 24, ['yyyyyyyyyyyyyyyyyy', 'yW..............Wy', 'y.W............W.y', 'y..W..........W..y', 'y...W........W...y', '.y...W......W...y.', '.y....W....W....y.', '..y....W..W....y..', '..y.....WW.....y..', '...y...W..W...y...', '....y.W....W.y....', '.....yy....yy.....', '......yy..yy......', '........yy........'], { y: Q.y2, W: Q.W });
      // bookshelf of keepsakes
      R(g, 262, 26, 52, 84, K); R(g, 263, 27, 50, 82, Q.y0);
      var bc = [Q.r0, Q.t1, Q.b3, Q.y1, Q.n1, Q.m0];
      for (var row = 0; row < 3; row++) {
        shelf(g, 263, 52 + row * 26, 50, Q.y1, Q.n0);
        for (var b = 0; b < 9; b++) book(g, 265 + b * 5, 38 + row * 26 - (b * 3 + row) % 4, 14 + (b * 3 + row) % 4, bc[(b + row) % 6]);
      }
      // the dark trestle table along the back wall
      R(g, 100, 118, 96, 5, K); R(g, 101, 119, 94, 2, Q.y0); R(g, 106, 123, 4, 23, K); R(g, 186, 123, 4, 23, K);
    })],
    props: [{ L: 0, x: 45, y: 129, k: 'fireplace', flick: 13, cx: true }]
  };

  // Tally's safe room: a Polish fast-food place with a kids' play area and plastic-toy posters
  BG.safe_tally = {
    back: K,
    layers: [layer(320, 0, function (g) {
      R(g, 0, 0, 320, 150, Q.r3);
      for (var x = 0; x < 320; x += 16) R(g, x, 0, 8, 112, Q.m3);
      R(g, 0, 0, 320, 10, K); R(g, 0, 10, 320, 2, Q.r1);
      // tiled wainscot
      R(g, 0, 112, 320, 38, Q.r1); for (x = 0; x < 320; x += 8) R(g, x, 112, 1, 38, Q.W); for (var y = 112; y < 150; y += 8) R(g, 0, y, 320, 1, Q.W);
      R(g, 0, 110, 320, 3, K); R(g, 0, 146, 320, 4, K);
      // the menu board: three monitors where a menu would be
      R(g, 92, 14, 136, 30, K); R(g, 93, 15, 134, 1, Q.g0);
      tvSlot(g, 98, 20); tvSlot(g, 146, 20); tvSlot(g, 194, 20);
      R(g, 112, 48, 96, 14, K); R(g, 113, 49, 94, 12, Q.r1); bigText(g, 'SMACZNEGO!', 160, 51, Q.W, { align: 'center', shadow: null });
      // plastic toy posters: the hippo and the ferret
      R(g, 12, 30, 38, 48, K); R(g, 13, 31, 36, 46, Q.W); tiny(g, 'HIPOPOTAM', 31, 33, Q.r1, { align: 'center' });
      oval(g, 30, 56, 13, 8, K); oval(g, 30, 56, 12, 7, Q.b5); oval(g, 20, 53, 6, 5, Q.b5); P(g, 19, 51, K); R(g, 22, 63, 3, 4, Q.b5); R(g, 36, 63, 3, 4, Q.b5); P(g, 16, 55, K);
      tiny(g, 'GRATIS!', 31, 70, Q.r0, { align: 'center' });
      R(g, 56, 30, 30, 48, K); R(g, 57, 31, 28, 46, Q.y3); tiny(g, 'FRETKA', 71, 33, Q.r0, { align: 'center' });
      R(g, 61, 52, 18, 5, Q.y0); oval(g, 78, 52, 4, 3, Q.y0); P(g, 79, 51, K); R(g, 58, 50, 4, 2, Q.y0); R(g, 63, 57, 2, 3, Q.y0); R(g, 74, 57, 2, 3, Q.y0);
      tiny(g, 'GRATIS!', 71, 70, Q.r0, { align: 'center' });
      // kids' play area: a tube slide tower and a ball pit
      R(g, 248, 36, 6, 114, K); R(g, 249, 36, 4, 114, Q.y2); R(g, 304, 36, 6, 114, K); R(g, 305, 36, 4, 114, Q.y2);
      R(g, 244, 30, 70, 8, K); R(g, 245, 31, 68, 6, Q.b3); tiny(g, 'PLAC ZABAW', 279, 32, Q.W, { align: 'center' });
      R(g, 250, 70, 58, 4, K); R(g, 251, 71, 56, 2, Q.r1);
      for (x = 254; x < 304; x += 6) line(g, x, 74, x + 4, 110, Q.W);
      for (var s = 0; s < 36; s++) { var a = s / 36, sx2 = Math.round(250 - Math.sin(a * Math.PI * 0.5) * 30); R(g, sx2 - 3, 72 + s * 2, 7, 3, K); R(g, sx2 - 2, 72 + s * 2, 5, 2, Q.G2); P(g, sx2 - 2, 72 + s * 2, Q.G3); }
      R(g, 250, 120, 58, 30, K); R(g, 251, 121, 56, 28, Q.b4); R(g, 251, 121, 56, 2, Q.W);
      var bc = [Q.r1, Q.y2, Q.G1, Q.b3, Q.m2, Q.o1];
      for (y = 124; y < 146; y += 4) for (x = 253 + ((y >> 2) & 1) * 2; x < 305; x += 4) { R(g, x, y, 3, 3, bc[(x * 7 + y * 3) % 6]); P(g, x, y, Q.W); }
    })],
    props: [{ L: 0, x: 98, y: 20, k: 'tvA', fps: 1.3 }, { L: 0, x: 146, y: 20, k: 'tvB', fps: 2 }, { L: 0, x: 194, y: 20, k: 'tvC', fps: 6 }]
  };

  // an unstaffed safe room: three TVs, a plate of Experience Cookies, plastic chairs
  BG.safe_cookie = {
    back: K,
    layers: [layer(320, 0, function (g) {
      blockWall(g, 0, 0, 320, 112, 32, 16, Q.c0, K, Q.c1, true);
      R(g, 0, 0, 320, 8, K);
      wainscot(g, 108, Q.c0, Q.g1, K);
      tvSlot(g, 70, 30); tvSlot(g, 146, 30); tvSlot(g, 222, 30);
      // the cookie plate on a wall shelf
      shelf(g, 262, 96, 44, Q.g1, Q.g0);
      oval(g, 284, 94, 16, 3, K); oval(g, 284, 94, 15, 2, Q.W);
      for (var c = 0; c < 4; c++) { oval(g, 274 + c * 7, 91 - (c & 1), 3, 2, K); oval(g, 274 + c * 7, 91 - (c & 1), 2, 1, Q.y1); P(g, 273 + c * 7, 90 - (c & 1), Q.y0); }
      tiny(g, 'TAKE ONE', 284, 76, Q.c1, { align: 'center' });
      // a wall clock and a SAFE ROOM plaque
      oval(g, 30, 40, 11, 11, K); oval(g, 30, 40, 9, 9, Q.W); line(g, 30, 40, 30, 33, K); line(g, 30, 40, 35, 42, K);
      R(g, 8, 70, 46, 12, K); R(g, 9, 71, 44, 10, Q.G1); tiny(g, 'SAFE ROOM', 31, 73, Q.W, { align: 'center' });
    })],
    props: [{ L: 0, x: 70, y: 30, k: 'tvA', fps: 1.1 }, { L: 0, x: 146, y: 30, k: 'tvB', fps: 2.2 }, { L: 0, x: 222, y: 30, k: 'tvC', fps: 5 }]
  };

  // Qwist's safe room: a little restaurant with red vinyl booths (and a French restroom sign)
  BG.safe_shelter = {
    back: K,
    layers: [layer(320, 0, function (g) {
      R(g, 0, 0, 320, 150, Q.y0);
      for (var x = 0; x < 320; x += 10) { R(g, x, 12, 1, 100, K); P(g, x + 4, 30 + (x * 7) % 60, Q.n0); }
      R(g, 0, 0, 320, 12, K); R(g, 0, 10, 320, 2, Q.n0);
      wainscot(g, 112, Q.n0, Q.y1, Q.y0);
      // pendant lamps
      var lamps = [40, 120, 200, 280];
      for (var i = 0; i < lamps.length; i++) { R(g, lamps[i], 12, 1, 14, K); tri(g, lamps[i], 26, 14, 6, K); tri(g, lamps[i], 26, 12, 5, Q.y2); R(g, lamps[i] - 1, 31, 3, 2, Q.W); }
      // windows that show nothing
      var win = [24, 216];
      for (i = 0; i < win.length; i++) {
        R(g, win[i], 40, 56, 40, K); R(g, win[i] + 2, 42, 52, 36, Q.g0);
        R(g, win[i] + 4, 44, 48, 32, K); R(g, win[i] + 27, 42, 2, 36, Q.g0); R(g, win[i] + 2, 59, 52, 2, Q.g0);
      }
      // menu monitors + the restroom sign
      R(g, 110, 30, 100, 26, K); tvSlot(g, 116, 34); tvSlot(g, 146, 34); tvSlot(g, 176, 34);
      R(g, 128, 64, 64, 12, K); R(g, 129, 65, 62, 10, Q.b3); tiny(g, 'TOILETTES', 160, 67, Q.W, { align: 'center' });
      rows(g, 192, 66, ['.k..k.', 'kkkkkk', '.k..k.', 'k.k.kk'], { k: Q.W });
      // booth backs along the wall (kept low and dark)
      var bx = [8, 92, 230];
      for (i = 0; i < bx.length; i++) { R(g, bx[i], 116, 70, 34, K); R(g, bx[i] + 1, 117, 68, 32, Q.r0); R(g, bx[i] + 1, 117, 68, 2, Q.r1); for (var s = bx[i] + 8; s < bx[i] + 68; s += 12) R(g, s, 120, 1, 28, Q.n0); }
    })],
    props: [{ L: 0, x: 116, y: 34, k: 'tvA', fps: 1.2 }, { L: 0, x: 146, y: 34, k: 'tvC', fps: 6 }, { L: 0, x: 176, y: 34, k: 'tvB', fps: 2 }]
  };

  // Mordecai's second-floor guild hall: cinderblock, a pinned-up floor map, a chalkboard, a potion rack
  BG.safe_bugaboo = {
    back: K,
    layers: [layer(320, 0, function (g) {
      blockWall(g, 0, 0, 320, 150, 16, 8, Q.c0, K, Q.c1, true);
      R(g, 0, 0, 320, 6, K);
      wainscot(g, 114, Q.y0, Q.y1, Q.n0);
      // the floor map
      R(g, 18, 22, 92, 66, K); R(g, 19, 23, 90, 64, Q.n3);
      for (var x = 23; x < 108; x += 10) R(g, x, 25, 1, 60, Q.y1); for (var y = 27; y < 86; y += 10) R(g, 21, y, 86, 1, Q.y1);
      R(g, 33, 37, 31, 21, Q.g1); R(g, 73, 47, 21, 31, Q.g1); line(g, 30, 30, 100, 80, Q.r1); line(g, 31, 30, 101, 80, Q.r1);
      rows(g, 92, 70, ['r...r', '.r.r.', '..r..', '.r.r.', 'r...r'], { r: Q.r1 }); P(g, 30, 30, Q.r1);
      // chalkboard
      R(g, 128, 26, 82, 50, K); R(g, 129, 27, 80, 48, Q.y1); R(g, 132, 30, 74, 42, Q.t0);
      tiny(g, 'RULE 1:', 169, 33, Q.W, { align: 'center' }); tiny(g, "DON'T DIE", 169, 40, Q.W, { align: 'center' }); tiny(g, 'RULE 2:', 169, 51, Q.W, { align: 'center' }); tiny(g, 'SEE RULE 1', 169, 58, Q.W, { align: 'center' });
      R(g, 150, 66, 10, 2, Q.W);
      // potion rack
      R(g, 228, 24, 76, 78, K); R(g, 229, 25, 74, 76, Q.y0);
      var pc = [Q.r1, Q.b4, Q.G2, Q.m2, Q.y2, Q.c2, Q.o1];
      for (var row = 0; row < 3; row++) { shelf(g, 229, 46 + row * 24, 74, Q.y1, Q.n0); for (var i = 0; i < 8; i++) bottle(g, 232 + i * 9, 39 + row * 24, pc[(i + row * 3) % 7]); }
      // a desk lamp glow spot is just a lamp, no glow
      R(g, 140, 100, 70, 4, K); R(g, 141, 100, 68, 2, Q.y1); R(g, 146, 104, 4, 42, K); R(g, 200, 104, 4, 42, K);
      rows(g, 190, 90, ['..kkk', '.kyyk', 'kyyyk', '..k..', '..k..', '..k..', '.kkk.'], { k: K, y: Q.y2 });
    })]
  };
  BG.safe = { back: K, base: 'safe_guild' };

  /* =====================================================================
     CUTSCENE BACKDROPS. Every background shares one floor line: y=150
     (stages, safe rooms, and these). The cutscene player puts y=150 on its
     picture floor and shows roughly y 60..160, so each backdrop is
     composed for y 16..112 and drawn shifted down by 38 (spec.shift).
     ===================================================================== */
  var CUT_SHIFT = 38;
  // the Transformation: a freezing night street, buildings sinking, one ornate wrought-iron stairwell
  BG.surface = {
    back: K, shift: CUT_SHIFT,
    layers: [layer(320, 0, function (g) {
      var r = rng(801), i, x;
      for (i = 0; i < 70; i++) P(g, (r() * 320) | 0, 14 + ((r() * 50) | 0), r() < 0.25 ? Q.W : Q.g0);
      oval(g, 274, 32, 8, 8, Q.g1); oval(g, 278, 30, 7, 7, K);
      // sinking buildings (tilted, bottoms swallowed by the street)
      var bl = [[0, 40, 50, 0], [46, 58, 40, -6], [92, 30, 48, 9], [148, 66, 34, -3], [270, 46, 50, 5]];
      for (i = 0; i < bl.length; i++) {
        var b = bl[i], x0 = b[0], top = b[1], bw = b[2], tilt = b[3] * 2;
        for (x = 0; x < bw; x++) {
          var yy = top + Math.round(tilt * x / bw);
          R(g, x0 + x, yy, 1, 112 - yy, x === 0 || x === bw - 1 ? K : Q.b1);
          P(g, x0 + x, yy, Q.W); if ((x & 3) !== 1) P(g, x0 + x, yy + 1, Q.W);
          for (var wy = yy + 6; wy < 106; wy += 8) if ((x % 7) > 2 && (x % 7) < 5) R(g, x0 + x, wy, 1, 4, ((x * 3 + wy) % 11) === 0 ? Q.y1 : K);
        }
      }
      // the street, deep in snow
      R(g, 0, 104, 320, 8, Q.W); for (x = 0; x < 320; x += 6) R(g, x, 103 - ((x * 7) % 3), 4, 2, Q.W);
      R(g, 0, 112, 320, 68, Q.g0); for (x = 0; x < 320; x += 24) R(g, x + 6, 118, 12, 2, Q.g1);
      for (i = 0; i < 16; i++) R(g, (r() * 300) | 0, 112 + ((r() * 30) | 0), 6 + ((r() * 10) | 0), 1, Q.W);
      // the ornate wrought-iron stairwell
      var sx = 196;
      R(g, sx + 8, 96, 64, 16, K); for (var st = 0; st < 5; st++) R(g, sx + 14 + st * 2, 98 + st * 3, 52 - st * 4, 2, st & 1 ? Q.g0 : Q.g1);
      for (x = sx; x < sx + 82; x += 5) { R(g, x, 80, 1, 24, Q.g0); P(g, x, 79, Q.g1); }
      R(g, sx, 80, 82, 1, Q.g1); R(g, sx, 86, 82, 1, Q.g0);
      for (x = sx + 2; x < sx + 80; x += 10) { ring(g, x + 3, 93, 3, Q.g0); }
      // the arch with its sign and two lamp posts
      for (var a = 0; a <= 60; a++) { var t = a / 60, ax = Math.round(sx + 4 + t * 74), ay = Math.round(58 - Math.sin(t * Math.PI) * 16); R(g, ax, ay, 2, 2, Q.g0); if (a % 6 === 3) ring(g, ax, ay + 5, 2, Q.g0); }
      R(g, sx + 22, 46, 38, 11, K); R(g, sx + 23, 47, 36, 9, Q.t0); tiny(g, 'DUNGEON', sx + 41, 49, Q.y3, { align: 'center' });
      var lp = [sx + 4, sx + 76];
      for (i = 0; i < 2; i++) {
        R(g, lp[i], 52, 3, 52, Q.g0); R(g, lp[i] + 1, 52, 1, 52, Q.g1); R(g, lp[i] - 1, 100, 5, 4, Q.g0);
        ring(g, lp[i] + 1 + (i ? -4 : 4), 56, 3, Q.g0); oval(g, lp[i] + 1, 46, 3, 4, Q.g0); oval(g, lp[i] + 1, 46, 2, 3, Q.y3); P(g, lp[i], 45, Q.W);
      }
    })]
  };

  // the descent: stone stairs down to the great double doors
  BG.stairwell = {
    back: K, shift: CUT_SHIFT,
    layers: [layer(320, 0, function (g) {
      hewnWall(g, 320, 0, 112, 811, Q.y0, K, Q.n0, 0.25);
      // stairs coming down from the upper left
      for (var s = 0; s < 14; s++) {
        var x = s * 12, y = 40 + s * 5;
        R(g, 0, y, x + 14, 112 - y, K); R(g, 0, y + 1, x + 13, 4, Q.g0); R(g, 0, y, x + 13, 1, Q.g1);
      }
      R(g, 0, 110, 200, 2, Q.g1);
      // the great double doors
      archStones(g, 252, 30, 40, 8, 112, Q.g0, Q.g1, K);
      archFill(g, 252, 30, 40, 112, K);
      archFill(g, 252, 33, 37, 112, Q.n0);
      R(g, 251, 33, 2, 79, K);
      for (var y = 50; y < 112; y += 18) { R(g, 215, y, 74, 3, Q.g0); for (var bx = 220; bx < 290; bx += 8) P(g, bx, y + 1, Q.g1); }
      for (x = 222; x < 284; x += 8) R(g, x, 34, 1, 78, Q.y0);
      ring(g, 242, 80, 4, Q.y2, 2); ring(g, 262, 80, 4, Q.y2, 2);
      // sconces either side
      R(g, 196, 70, 8, 2, Q.g0); R(g, 199, 60, 3, 11, K); R(g, 200, 61, 1, 9, Q.y0);
      R(g, 300, 70, 8, 2, Q.g0); R(g, 303, 60, 3, 11, K); R(g, 304, 61, 1, 9, Q.y0);
      R(g, 0, 112, 320, 68, K); R(g, 0, 112, 320, 1, Q.g0);
      for (x = 0; x < 320; x += 20) R(g, x, 113, 1, 6, Q.g0);
    })],
    props: [{ L: 0, x: 200, y: 49, k: 'torch', flick: 14, cx: true }, { L: 0, x: 304, y: 49, k: 'torch', flick: 15, cx: true }]
  };

  // a cramped production trailer
  BG.trailer = {
    back: K, shift: CUT_SHIFT,
    layers: [layer(320, 0, function (g) {
      R(g, 0, 0, 320, 112, Q.y0);
      for (var x = 0; x < 320; x += 8) { R(g, x, 18, 1, 94, K); P(g, x + 3, 30 + (x * 5) % 70, Q.y1); }
      R(g, 0, 0, 320, 18, K); R(g, 40, 14, 120, 3, Q.W); R(g, 200, 14, 90, 3, Q.W); R(g, 0, 17, 320, 1, Q.g0);
      // window with blinds
      R(g, 22, 34, 62, 44, K); R(g, 24, 36, 58, 40, Q.g1); for (var y = 38; y < 76; y += 3) R(g, 24, y, 58, 1, Q.g0); R(g, 52, 36, 1, 40, Q.g0);
      // the door
      R(g, 100, 40, 34, 72, K); R(g, 102, 42, 30, 70, Q.g0); R(g, 102, 42, 30, 1, Q.g1); R(g, 106, 48, 22, 22, Q.g1); R(g, 107, 49, 20, 20, K); R(g, 126, 78, 3, 3, Q.y2);
      // call sheet + clipboard on the wall
      R(g, 146, 34, 26, 34, K); R(g, 147, 35, 24, 32, Q.W); R(g, 154, 32, 10, 4, Q.g0);
      for (y = 40; y < 64; y += 4) R(g, 149, y, 6 + ((y * 7) % 13), 1, Q.g0);
      tiny(g, 'CALL', 159, 36, K, { align: 'center' });
      // desk with monitors
      R(g, 186, 84, 124, 6, K); R(g, 187, 85, 122, 3, Q.y1); R(g, 190, 90, 6, 22, K); R(g, 300, 90, 6, 22, K);
      var mon = [196, 248];
      for (var i = 0; i < 2; i++) {
        R(g, mon[i], 52, 44, 30, K); R(g, mon[i] + 2, 54, 40, 24, Q.b1);
        for (y = 57; y < 76; y += 3) R(g, mon[i] + 4, y, 10 + ((y * 3 + i * 7) % 24), 1, Q.c1);
        R(g, mon[i] + 18, 82, 8, 2, K);
      }
      R(g, 296, 76, 8, 8, K); R(g, 297, 77, 6, 7, Q.r1); P(g, 298, 78, Q.W); // coffee
      R(g, 0, 112, 320, 68, Q.g0); for (x = 0; x < 320; x += 4) P(g, x, 114 + ((x * 3) % 5), Q.g1);
      R(g, 0, 112, 320, 1, K);
    })],
    props: [{ L: 0, x: 105, y: 28, k: 'onair', fps: 1 }]
  };

  // Odette's talk-show set
  BG.studio = {
    back: K, shift: CUT_SHIFT,
    layers: [layer(320, 0, function (g) {
      var i, x;
      // light beams as flat shapes
      var beams = [40, 120, 200, 280];
      for (i = 0; i < beams.length; i++) for (var y = 26; y < 112; y++) { var hw = 3 + Math.round((y - 26) * 0.24); for (var bx = beams[i] - hw; bx < beams[i] + hw; bx++) if (((bx + y) & 1) === 0) P(g, bx, y, Q.p0); }
      // logo backdrop
      R(g, 84, 26, 152, 54, K); R(g, 86, 28, 148, 50, Q.m0); R(g, 88, 30, 144, 46, Q.p0);
      var r = rng(831); for (i = 0; i < 26; i++) P(g, 90 + ((r() * 140) | 0), 32 + ((r() * 42) | 0), r() < 0.3 ? Q.W : Q.m2);
      bigText(g, 'DUNGEON CRAWLER', 160, 38, Q.y3, { align: 'center', shadow: null });
      bigText(g, 'AFTER HOURS', 160, 52, Q.m2, { align: 'center', shadow: null, scale: 1 });
      tiny(g, 'WITH ODETTE', 160, 66, Q.W, { align: 'center' });
      // the truss
      R(g, 0, 16, 320, 8, K); R(g, 0, 17, 320, 1, Q.g0); R(g, 0, 22, 320, 1, Q.g0); for (x = 0; x < 320; x += 6) line(g, x, 17, x + 5, 22, Q.g0);
      // audience bleachers at the sides
      var aud = [[0, 66], [256, 66]];
      for (i = 0; i < 2; i++) for (var row = 0; row < 4; row++) {
        var ay = 80 + row * 8;
        R(g, aud[i][0], ay + 4, aud[i][1], 4, Q.b1);
        for (x = aud[i][0] + 3 + (row & 1) * 3; x < aud[i][0] + aud[i][1] - 3; x += 7) { oval(g, x, ay + 2, 2, 2, Q.p0); R(g, x - 2, ay + 4, 5, 3, Q.p0); }
      }
      // couch (left) and desk (right)
      R(g, 70, 86, 70, 26, K); R(g, 72, 88, 66, 10, Q.m0); R(g, 72, 98, 66, 10, Q.m1); R(g, 70, 92, 8, 18, K); R(g, 132, 92, 8, 18, K); R(g, 71, 93, 6, 16, Q.m0); R(g, 133, 93, 6, 16, Q.m0); R(g, 72, 88, 66, 1, Q.m2);
      R(g, 190, 82, 64, 30, K); R(g, 192, 84, 60, 28, Q.y0); R(g, 192, 84, 60, 3, Q.y2); R(g, 196, 92, 52, 16, Q.n0); tiny(g, 'DCW', 222, 97, Q.y2, { align: 'center' });
      R(g, 238, 76, 6, 8, K); R(g, 239, 77, 4, 6, Q.W);
      // glossy stage floor
      R(g, 0, 112, 320, 68, K); R(g, 0, 112, 320, 1, Q.m0); for (x = 0; x < 320; x += 16) R(g, x, 114, 8, 1, Q.p0);
    })],
    props: [{ L: 0, x: 40, y: 22, k: 'stagelight', fps: 1.5, cx: true }, { L: 0, x: 120, y: 22, k: 'stagelight', fps: 1.5, cx: true, ph: 1 },
      { L: 0, x: 200, y: 22, k: 'stagelight', fps: 1.5, cx: true }, { L: 0, x: 280, y: 22, k: 'stagelight', fps: 1.5, cx: true, ph: 1 }]
  };

  // the pet reward room: ten cages
  BG.reward_room = {
    back: K, shift: CUT_SHIFT,
    layers: [layer(320, 0, function (g) {
      blockWall(g, 0, 0, 320, 112, 16, 8, Q.c0, K);
      R(g, 112, 22, 96, 10, K); R(g, 113, 23, 94, 8, Q.y1); tiny(g, 'REWARD ROOM', 160, 25, K, { align: 'center' });
      for (var row = 0; row < 2; row++) for (var c = 0; c < 5; c++) {
        var x = 12 + c * 60, y = 36 + row * 38;
        R(g, x, y, 56, 34, K); R(g, x + 1, y + 1, 54, 32, Q.g0); R(g, x + 3, y + 3, 50, 28, K);
        for (var b = x + 6; b < x + 53; b += 5) R(g, b, y + 3, 1, 28, Q.g1);
        R(g, x + 3, y + 16, 50, 1, Q.g0); R(g, x + 22, y + 30, 12, 4, Q.y2);
      }
      R(g, 0, 112, 320, 68, Q.g0); for (var gx = 0; gx < 320; gx += 16) R(g, gx, 112, 1, 68, K); R(g, 0, 112, 320, 1, K); R(g, 0, 128, 320, 1, K);
    })],
    props: [{ L: 0, x: 37, y: 52, k: 'cagebark', fps: 0.6, blink: true }, { L: 0, x: 157, y: 90, k: 'cagebark', fps: 0.5, blink: true, ph: 0.5 }, { L: 0, x: 217, y: 52, k: 'cagebark', fps: 0.8, blink: true, ph: 0.3 }]
  };

  // a safe-room TV close-up: a big bezel; the cutscene draws the recap on the black screen (y 30..100 before the shift)
  BG.tvroom = {
    back: K, shift: CUT_SHIFT,
    layers: [layer(320, 0, function (g) {
      R(g, 0, 0, 320, 180, K);
      R(g, 12, 24, 296, 90, Q.g0); R(g, 12, 24, 296, 2, Q.g1); R(g, 12, 24, 2, 90, Q.g1); R(g, 306, 24, 2, 90, K);
      R(g, 24, 30, 272, 70, K);
      tiny(g, 'BORANT', 30, 104, Q.g1); R(g, 286, 105, 3, 3, Q.r1); P(g, 286, 105, Q.r3);
      for (var x = 120; x < 200; x += 4) R(g, x, 104, 2, 5, K);
      R(g, 140, 114, 40, 6, Q.g0); R(g, 120, 120, 80, 3, Q.g0);
    })]
  };

  // Death Watch Extreme Dungeon Mayhem: the round-table set under its ring of light
  BG.deathwatch = {
    back: K, shift: CUT_SHIFT,
    layers: [layer(320, 0, function (g) {
      var i;
      // ring of light
      for (i = 0; i < 360; i++) { var a = i / 360 * Math.PI * 2; R(g, Math.round(160 + Math.cos(a) * 114) - 1, Math.round(32 + Math.sin(a) * 12), 3, 2, Q.g0); }
      for (i = 0; i < 44; i++) { var a2 = i / 44 * Math.PI * 2, x = Math.round(160 + Math.cos(a2) * 114), y = Math.round(32 + Math.sin(a2) * 12); R(g, x - 1, y - 1, 3, 3, K); R(g, x, y - 1, 2, 2, i & 1 ? Q.y3 : Q.W); }
      R(g, 100, 14, 2, 8, Q.g0); R(g, 218, 14, 2, 8, Q.g0);
      // logo
      bigText(g, 'DEATH WATCH', 160, 50, Q.r1, { align: 'center', shadow: null, scale: 1 });
      tiny(g, 'EXTREME DUNGEON MAYHEM', 160, 61, Q.g1, { align: 'center' });
      // chairs and the round table
      for (i = 0; i < 4; i++) { var cx = 70 + i * 60; R(g, cx - 8, 72, 16, 24, K); R(g, cx - 7, 73, 14, 22, Q.r0); R(g, cx - 7, 73, 14, 1, Q.r1); }
      oval(g, 160, 96, 108, 10, K); oval(g, 160, 95, 106, 9, Q.g1); oval(g, 160, 94, 100, 7, Q.W); oval(g, 160, 95, 96, 5, Q.g1);
      R(g, 54, 96, 213, 16, K); R(g, 56, 98, 209, 14, Q.r0); R(g, 56, 98, 209, 1, Q.r1);
      for (i = 70; i < 260; i += 24) R(g, i, 102, 12, 2, Q.y2);
      R(g, 0, 112, 320, 68, K); for (i = 0; i < 320; i += 10) R(g, i, 112, 6, 1, Q.r0);
    })],
    props: [{ L: 0, x: 48, y: 31, k: 'bulbs', fps: 4 }, { L: 0, x: 264, y: 31, k: 'bulbs', fps: 4, ph: 1 }, { L: 0, x: 156, y: 41, k: 'bulbs', fps: 4 }]
  };

  art.backdrops = ['safe_guild', 'safe_tally', 'safe_cookie', 'safe_shelter', 'safe_bugaboo', 'surface', 'stairwell', 'trailer', 'studio', 'reward_room', 'tvroom', 'deathwatch'];

  /* ---------------- background renderer ---------------- */
  var bgCache = {};
  function bgId(theme) { return BG[theme] ? theme : (/^safe/.test(theme || '') ? 'safe' : 'tunnels'); }
  function recolorCanvas(src, fn) {
    var cv = mkCanvas(src.width, src.height), g = g2(cv);
    var img = readPixels(src), d = img.data, memo = {};
    for (var i = 0; i < d.length; i += 4) {
      if (!d[i + 3]) continue;
      var key = (d[i] << 16) | (d[i + 1] << 8) | d[i + 2], c = memo[key];
      if (!c) c = memo[key] = parseColor(fn([d[i], d[i + 1], d[i + 2]]));
      d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2];
    }
    g.putImageData(img, 0, 0);
    return cv;
  }
  function buildBg(theme) {
    var spec = BG[theme], src = spec.base ? BG[spec.base] : spec;
    var b = { back: spec.back || K, anim: src.anim || null, layers: [], props: [], shift: src.shift || 0 }, i;
    for (i = 0; i < src.layers.length; i++) {
      var L = src.layers[i], cv = mkCanvas(L.w, BGH), lg = g2(cv);
      if (b.shift) { R(lg, 0, 0, L.w, b.shift, src.back || K); lg.translate(0, b.shift); }
      try { L.draw(lg, L.w, BGH); } catch (e) { if (window.console) console.error('art bg layer failed: ' + theme, e); }
      nesify(cv);
      if (spec.recolor) cv = recolorCanvas(cv, spec.recolor);
      b.layers.push({ cv: cv, L: L });
    }
    var ps = src.props || [];
    for (i = 0; i < ps.length; i++) {
      var s = prop(ps[i].k);
      if (spec.recolor) s = { cv: recolorCanvas(s.cv, spec.recolor), w: s.w, h: s.h, n: s.n };
      b.props.push({ p: ps[i], s: s });
    }
    bgCache[theme] = b;
    return b;
  }
  function propFrame(p, t) {
    if (p.flick !== undefined) {
      var f = flickF(t, p.flick);
      return p.rare ? (f && (Math.floor(t * 0.7 + p.flick) % 5 === 0) ? 1 : 0) : f;
    }
    if (p.blink) return ((t * (p.fps || 1) + (p.ph || 0)) % 1) < 0.12 ? 1 : 0;
    return Math.floor(t * (p.fps || 2) + (p.ph || 0)) & 1;
  }
  art.background = function (ctx, theme, camX, camY) {
    theme = bgId(theme);
    var b = bgCache[theme] || buildBg(theme);
    camX = camX || 0; camY = camY || 0;
    var t = DCW.t || 0, cy = camY < 0 ? 0 : camY > 160 ? 160 : camY, i, x, k;
    ctx.fillStyle = b.back; ctx.fillRect(0, 0, 320, 180);
    var oys = [];
    for (i = 0; i < b.layers.length; i++) {
      var Ly = b.layers[i], L = Ly.L, w = L.w;
      var ox = L.rate ? Math.floor(((camX * L.rate) % w + w) % w) : 0;
      var oy = L.rate ? -Math.round(Math.min(BGH - 180, cy * L.rate * 0.5)) : 0;
      for (x = -ox; x < 320; x += w) ctx.drawImage(Ly.cv, x, oy);
      oys.push(oy);
    }
    for (i = 0; i < b.props.length; i++) {
      var pr = b.props[i], p = pr.p, s = pr.s, lay = b.layers[p.L] || b.layers[0], rate = lay.L.rate, lw = lay.L.w;
      var fr = propFrame(p, t), px = p.x - (p.cx ? s.w >> 1 : 0), py = p.y + b.shift + (oys[p.L] || 0);
      var sx = rate ? ((px - camX * rate) % lw + lw) % lw : px;
      for (k = -1; k <= 1; k++) {
        var xx = Math.round(sx + k * lw);
        if (xx > 320 || xx + s.w < 0 || (!rate && k)) continue;
        ctx.drawImage(s.cv, fr * s.w, 0, s.w, s.h, xx, py, s.w, s.h);
      }
    }
    if (b.anim) b.anim(ctx, camX, camY, t, oys);
  };
  // true when art.js has a real background for this id (unknown ids fall back to tunnels / safe)
  art.hasBackground = function (theme) { return !!(theme && BG.hasOwnProperty(theme)); };
  // kept for compatibility: Book One has no light map, so backgrounds contribute no lights
  art.bgLights = function (theme, camX, camY, out) { return out || []; };
  // optional: pre-build a theme's background layers (e.g. on stage enter) to avoid a first-frame hitch
  art.prepare = function (theme) { var id = bgId(theme); if (!bgCache[id]) buildBg(id); };
  // no overworld in Book One
  art.owTile = function () { };
  art.owThemes = [];

  /* =====================================================================
     FX, PROJECTILES, PICKUPS, OBJECTS, QUEST ITEMS, ICONS
     (registered as procs in DCW.artProcs unless art_actors.js already
     defined the same name; every proc is snapped to the NES palette)
     ===================================================================== */
  // pixel-row proc: frames = [[rows...], ...]; ol: true (black outline) | false | colour
  function pix(name, pal, frames, ol) {
    var h = frames[0].length, w = 0;
    for (var f = 0; f < frames.length; f++) for (var i = 0; i < frames[f].length; i++) w = Math.max(w, frames[f][i].length);
    proc(name, w, h, frames.length, function (g, fr) { rows(g, 0, 0, frames[fr], pal); }, ol === false ? false : (typeof ol === 'string' ? { outline: ol } : true));
  }
  function noisyDisc(g, cx, cy, r, c, r2, amt) {
    g.fillStyle = c;
    for (var y = -r - 2; y <= r + 2; y++) for (var x = -r - 2; x <= r + 2; x++) {
      var d = Math.sqrt(x * x + y * y) + (amt ? (r2() - 0.5) * amt : 0);
      if (d <= r) g.fillRect(cx + x, cy + y, 1, 1);
    }
  }

  /* ---- projectiles (parent set) ---- */
  pix('arrow', { b: Q.y1, s: Q.g1, f: Q.W, r: Q.r1 }, [[
    '..............',
    '.ff.......s...',
    '..rbbbbbbbsss.',
    '.ff.......s...',
    '..............']]);
  pix('rock', { g: Q.g0, l: Q.g1, d: Q.g3 }, [[
    '..........',
    '...gggg...',
    '..gllggg..',
    '.glggggdd.',
    '.gggggddd.',
    '..ggdddd..',
    '...ddd....',
    '..........']]);
  proc('fireball', 14, 10, 2, function (g, f) {
    var r = rng(5 + f);
    for (var i = 0; i < 6; i++) P(g, 1 + ((r() * 6) | 0), 3 + ((r() * 4) | 0), i & 1 ? Q.o1 : Q.o0);
    R(g, 4, 3, 4, 4, Q.o1); R(g, 2 + f, 4, 3, 2, Q.o1);
    disc(g, 9, 5, 3, Q.o1); disc(g, 9, 5, 2, Q.n2); R(g, 9, 4, 2, 2, Q.y3); P(g, 10, 4, Q.W);
    P(g, 6, 2 + f, Q.n2); P(g, 5, 7 - f, Q.n2);
  }, { outline: Q.n0 });
  proc('bubble', 10, 10, 2, function (g, f) {
    if (f === 0) { ring(g, 5, 5, 3, Q.b4); P(g, 3, 3, Q.W); P(g, 4, 3, Q.W); P(g, 3, 4, Q.W); }
    else { for (var x = -4; x <= 4; x++) { var hh = Math.round(3 * Math.sqrt(1 - (x * x) / 20.25)); P(g, 5 + x, 5 - hh, Q.b4); P(g, 5 + x, 5 + hh, Q.b4); } P(g, 3, 3, Q.W); P(g, 4, 3, Q.W); }
  }, { outline: Q.b3 });
  pix('bolt', { y: Q.y3, w: Q.W, o: Q.n2 }, [[
    '..............',
    '.......yy.....',
    '..yy..ywwy..y.',
    '.ywwyywoowyywy',
    'ywooowwy..ywoy',
    '.yy..yy....yy.',
    '..............'], [
    '..............',
    '.yy......yy...',
    'ywwy....ywwy..',
    '.ywoyy.ywoowy.',
    '..yywwywwy.ywy',
    '.....yyy....y.',
    '..............']], Q.p0);
  pix('bottle', { g: Q.G1, l: Q.G2, c: Q.y1, w: Q.W, d: Q.t0 }, [[
    '..........',
    '....cc....',
    '....gg....',
    '....gl....',
    '...gglg...',
    '..ggwlgg..',
    '..ggwggd..',
    '..gggggd..',
    '..gggggd..',
    '...dddd...',
    '..........'], [
    '...........',
    '...........',
    '...........',
    '..gggggg...',
    '.gwwlgggglc',
    '.ggggggggdc',
    '.ddggggdd..',
    '...dddd....',
    '...........',
    '...........',
    '...........']]);
  proc('laser_orb', 12, 12, 2, function (g, f) {
    var r = 4 + f;
    disc(g, 6, 6, r, Q.r0); disc(g, 6, 6, r - 1, Q.r1); disc(g, 6, 6, r - 2, Q.r3); disc(g, 6, 6, 1, Q.W);
  }, false);
  pix('knife', { s: Q.W, g: Q.g0, h: Q.y0, y: Q.y2 }, [[
    '............',
    '.hhhy.......',
    '.hhhygssssg.',
    '.hhhyggggg..',
    '............']]);
  proc('spore', 10, 10, 2, function (g, f) {
    disc(g, 5, 5, 3, Q.l0); disc(g, 5, 5, 2, Q.l1);
    P(g, 4, 4, Q.l3); P(g, 6, 6, Q.G0);
    var o = f ? 1 : 0;
    P(g, 1 + o, 2, Q.l3); P(g, 8 - o, 1 + o, Q.l3); P(g, 8, 8 - o, Q.l2); P(g, 1, 8 - o, Q.l2);
  }, { outline: Q.t0 });
  pix('note', { p: Q.m2, l: Q.m3 }, [[
    '..........',
    '....pppp..',
    '....plll..',
    '....p..p..',
    '....p..p..',
    '..ppp..p..',
    '.pllp.pp..',
    '.pppppllp.',
    '..pp..ppp.',
    '..........']]);
  proc('missile', 16, 10, 2, function (g, f) {
    // Princess Donut's magic missile: hot pink core, violet trail, sparkles
    R(g, 1, 4 - f, 2, 1, Q.p1); R(g, 2, 6 + f, 2, 1, Q.p1);
    R(g, 3, 4, 5, 2, Q.p2); R(g, 5, 3, 4, 4, Q.m1);
    disc(g, 11, 5, 3, Q.m1); disc(g, 11, 5, 2, Q.m2); R(g, 11, 4, 2, 2, Q.W); P(g, 10, 5, Q.m3);
    P(g, 14, 5, Q.m3);
    if (f) { P(g, 4, 1, Q.W); P(g, 7, 8, Q.m3); } else { P(g, 6, 1, Q.m3); P(g, 3, 8, Q.W); }
  }, { outline: Q.p0 });
  // Carl's thrown bomb on Floor 1 is a bundle of goblin dynamite (fuse spark flickers)
  pix('bomb', { r: Q.r1, R: Q.r0, w: Q.W, f: Q.y1, s: Q.y3, o: Q.o1, b: Q.y0 }, [[
    '.......s..',
    '......so..',
    '.....f....',
    '....f.....',
    '.rrRrrRrr.',
    '.rwRrwRrw.',
    '.rrRrrRrr.',
    '.bbbbbbbb.',
    '.rrRrrRrr.',
    '.rrRrrRrr.',
    '..........'], [
    '......o.s.',
    '.......s..',
    '......f...',
    '....ff....',
    '.rrRrrRrr.',
    '.rwRrwRrw.',
    '.rrRrrRrr.',
    '.bbbbbbbb.',
    '.rrRrrRrr.',
    '.rrRrrRrr.',
    '..........']]);

  /* ---- Book One projectiles ---- */
  // bad llama lava spit (arcs a bit)
  pix('lava_spit', { r: Q.o1, o: Q.n2, y: Q.y3, w: Q.W, d: Q.o0 }, [[
    '..........',
    '....ooo...',
    '.r.oyywo..',
    'rr.oyyyor.',
    '.d.royyor.',
    '....rrrr..',
    '..........'], [
    '..........',
    '...rooo...',
    '..roywwo..',
    'd.oyyyyor.',
    '..rooyor..',
    '.d..rrr...',
    '..........']]);
  // krakaren taint snot
  pix('snot', { g: Q.l1, l: Q.l2, w: Q.l3, d: Q.G0 }, [[
    '..........',
    '...gggg...',
    '..glwllg..',
    '.gllllllg.',
    '.gglllggd.',
    '..ddgg.d..',
    '.......d..'], [
    '..........',
    '..ggggg...',
    '.glwwllg..',
    '.glllllgg.',
    '..ggllggd.',
    '...dd.d...',
    '...d......']]);
  // brindled vespa acid
  pix('acid', { g: Q.G2, l: Q.l2, w: Q.W, d: Q.G1 }, [[
    '........',
    '...l....',
    '..lgl...',
    '.lgwgl..',
    '.lgggd..',
    '..ldd...',
    '........'], [
    '........',
    '..l.....',
    '..gl....',
    '.lwgl...',
    '.lgggd..',
    '..lgd...',
    '...d....']]);
  // clurichaun slingshot pebble
  pix('pebble', { g: Q.g0, l: Q.g1, w: Q.W }, [[
    '.......',
    '..ggg..',
    '.glwgg.',
    '.glggg.',
    '..ggg..',
    '.......'], [
    '.......',
    '..ggg..',
    '.ggglg.',
    '.gggwg.',
    '..ggg..',
    '.......']]);
  // troglodyte virtuoso tongue lash (long, wet, pink)
  pix('tongue', { p: Q.r2, l: Q.r3, d: Q.r0, w: Q.W }, [[
    '....................',
    '..............ll....',
    'ppppppppppppppplpp..',
    'dddpppddddpppppppwp.',
    '...ddd....ddddddpp..',
    '....................'], [
    '....................',
    '....ll........l.....',
    'pppplppppppppplpppp.',
    'ddppppppdddpppppwpp.',
    '..dddddd...ddddpp...',
    '....................']]);
  // goblin bomb bard dynamite: one stick, tumbling, fuse spitting sparks
  pix('dynamite', { r: Q.r1, R: Q.r0, w: Q.W, f: Q.y1, s: Q.y3, o: Q.o1 }, [[
    '..........',
    '.......s..',
    '......so..',
    '.....f....',
    '....rr....',
    '...rrwR...',
    '..rrwRR...',
    '.rrwRR....',
    '.rRRR.....',
    '..RR......',
    '..........'], [
    '..........',
    '..s.......',
    '.os.......',
    '...f......',
    '....rr....',
    '....RwRR..',
    '....RRwRr.',
    '.....RRwRr',
    '......RRrr',
    '.......rr.',
    '..........']]);
  // junk thrown by the goblins riding the dozer: a rusty gear on a bolt
  proc('junk', 9, 9, 2, function (g, f) {
    disc(g, 4, 4, 3, Q.n1); disc(g, 4, 4, 1, K); P(g, 3, 2, Q.n2);
    var teeth = f ? [[4, 0], [8, 4], [4, 8], [0, 4]] : [[1, 1], [7, 1], [7, 7], [1, 7]];
    for (var i = 0; i < 4; i++) R(g, teeth[i][0], teeth[i][1], 1, 1, Q.n0);
    if (f) { P(g, 5, 6, Q.n0); } else { P(g, 6, 5, Q.n0); }
  });
  // the juicer's flaming weight plate
  proc('plate', 10, 10, 2, function (g, f) {
    // flames wrapping the top of the plate, then the plate (black iron, gray rim)
    if (f) rows(g, 1, 0, ['.o...o..', 'oyo.oyo.', 'oyyoyyo.', '.oooooo.'], { o: Q.o1, y: Q.y3 });
    else rows(g, 1, 0, ['..o...o.', '.oyo.oyo', '.oyyoyyo', '.oooooo.'], { o: Q.o1, y: Q.y3 });
    disc(g, 5, 6, 3, Q.g0); P(g, 3, 4, Q.g1); P(g, 4, 4, Q.g1); P(g, 3, 5, Q.g1); P(g, 5, 6, K);
  });
  // Carl's Jug O'Boom: a clay jug with a burning rag for a cork (2-frame tumble)
  var JUG_ROWS = ['...fy...', '...yf...', '...nn...', '..kook..', '.kooYok.', 'kooYoook', 'kooooodk', 'kooooodk', '.koodok.', '..kkkk..'];
  proc('jug', 8, 10, 2, function (g, f) {
    var pal = { f: Q.o1, y: Q.y3, n: Q.n3, k: K, o: Q.y1, Y: Q.n3, d: Q.y0 };
    if (f === 0) rows(g, 0, 0, JUG_ROWS, pal);
    else rows(g, 0, 0, JUG_ROWS.slice().reverse().map(function (s) { return s.split('').reverse().join(''); }), pal);
  }, false);
  // burning blue puddle left by a Jug O'Boom
  proc('blue_fire', 16, 10, 2, function (g, f) {
    R(g, 1, 8, 14, 2, Q.b1); R(g, 0, 9, 16, 1, Q.b1); R(g, 3, 8, 10, 1, Q.b3);
    var fl = f ? [[2, 4], [6, 1], [10, 3], [13, 5]] : [[3, 2], [7, 4], [10, 0], [12, 4]];
    for (var i = 0; i < fl.length; i++) {
      var x = fl[i][0], top = fl[i][1];
      R(g, x, top + 1, 2, 8 - top, Q.b3); R(g, x - 1, top + 3, 4, 6 - top, Q.b3); P(g, x, top, Q.b4);
      R(g, x, top + 3, 2, 5 - top, Q.b4); P(g, x, top + 5, Q.b6); P(g, x + 1, top + 6, Q.W);
    }
  }, false);
  // the chase stage's wall of fire (32x180): orange body full of rising yellow flame tongues,
  // a red licking front edge on the right; frame 1 = tongues risen half a step (2-frame flicker)
  proc('fire_wall', 32, 180, 2, function (g, f) {
    var y, x, edge = [];
    for (y = 0; y < 180; y++) edge[y] = Math.round(21 + Math.sin(y * 0.14 + f * 2.1) * 5 + Math.sin(y * 0.41 + f * 1.3) * 3);
    for (y = 0; y < 180; y++) { var e = edge[y]; R(g, 0, y, e + 1, 1, Q.n2); R(g, e - 1, y, 2, 1, Q.o1); }
    for (var row = -1; row < 14; row++) for (var c = 0; c < 3; c++) {
      var cx = 3 + c * 8 + (row & 1) * 4 + ((row * 5 + c) % 3) - 1, base = row * 14 + 12 - (f ? 7 : 0), th = 8 + ((row * 7 + c * 3 + 20) % 6);
      for (var j = 0; j < th; j++) {
        var yy = base - th + 1 + j; if (yy < 0 || yy >= 180) continue;
        var hw = Math.round((2 + ((row + c) & 1)) * Math.pow(j / (th - 1), 0.7));
        for (x = cx - hw; x <= cx + hw; x++) if (x < edge[yy] - 1) P(g, x, yy, j > th * 0.6 && Math.abs(x - cx) < hw ? Q.W : Q.y3);
        if (j === 0 && cx < edge[yy] - 1) P(g, cx, yy - 1, Q.o1);
      }
    }
    var r = rng(77 + f * 13);
    for (var i = 0; i < 14; i++) { // loose tongues of flame ahead of the wall
      var ty = (r() * 176) | 0, tx = edge[ty] + 2 + ((r() * 4) | 0);
      if (tx > 30) tx = 30;
      P(g, tx, ty, Q.o1); P(g, tx, ty + 1, Q.n2); P(g, tx + 1, ty + 1, Q.o1); P(g, tx, ty + 2, Q.o1);
    }
  }, false);
  pix('ember', { r: Q.o1, o: Q.n2, y: Q.y3, w: Q.W }, [['.r..', 'ryo.', '.or.', '....'], ['....', '.o..', 'ryr.', '..r.']], false);

  // Meadow Lark allies: Brandon and Chris's shotgun pellets, Yolanda's pistol bullet
  pix('pellet', { w: Q.W, g: Q.g1 }, [['.....', '.gw..', '.wg..', '.....']]);
  pix('bullet', { y: Q.y2, Y: Q.y3, o: Q.y1 }, [['......', '.oyYY.', '.oyyy.', '......']]);
  // a generic 2-frame flame (burning ground, fire fx)
  pix('fire', { r: Q.o1, o: Q.n2, y: Q.y3, w: Q.W }, [[
    '....r...',
    '...rr...',
    '..ror.r.',
    '..rorrr.',
    '.rooyor.',
    '.royyor.',
    'rooywyor',
    'royyyyor',
    '.rooyor.',
    '..rrrr..'], [
    '........',
    '.r...r..',
    '.rr.ror.',
    '.ror.ror',
    '.rooroor',
    'roooyyor',
    'royywyor',
    'royyyyor',
    '.rooyor.',
    '..rrrr..']], false);

  /* ---- fx ---- */
  proc('explosion', 32, 32, 5, function (g, f) {
    var r = rng(41 + f), i;
    if (f === 0) { noisyDisc(g, 16, 16, 6, Q.n2, r, 2); noisyDisc(g, 16, 16, 4, Q.y3, r, 1); disc(g, 16, 16, 2, Q.W); return; }
    if (f === 1) { noisyDisc(g, 16, 16, 11, Q.o1, r, 3); noisyDisc(g, 16, 16, 9, Q.n2, r, 3); noisyDisc(g, 16, 16, 6, Q.y3, r, 2); disc(g, 16, 16, 3, Q.W); return; }
    if (f === 2) {
      noisyDisc(g, 16, 16, 14, Q.o0, r, 4); noisyDisc(g, 16, 16, 12, Q.o1, r, 4); noisyDisc(g, 16, 15, 8, Q.n2, r, 4); noisyDisc(g, 16, 14, 4, Q.y3, r, 2);
      for (i = 0; i < 8; i++) { var a = r() * 6.28; P(g, 16 + Math.round(Math.cos(a) * 15), 16 + Math.round(Math.sin(a) * 15), Q.y3); }
      return;
    }
    if (f === 3) {
      noisyDisc(g, 16, 14, 14, Q.g0, r, 6); noisyDisc(g, 16, 15, 11, Q.o0, r, 6); noisyDisc(g, 15, 16, 7, Q.o1, r, 5);
      for (i = 0; i < 7; i++) { var bx = 4 + ((r() * 24) | 0), by = 4 + ((r() * 24) | 0); disc(g, bx, by, 2, Q.g1); }
      return;
    }
    for (i = 0; i < 9; i++) { var px = 6 + ((r() * 20) | 0), py = 4 + ((r() * 20) | 0); disc(g, px, py, 2 + ((r() * 3) | 0), i & 1 ? Q.g0 : Q.g1); }
    for (i = 0; i < 4; i++) P(g, 4 + ((r() * 24) | 0), 4 + ((r() * 24) | 0), Q.o1);
  }, false);
  pix('hit', { w: Q.W, y: Q.y3, o: Q.n2 }, [[
    '................',
    '................',
    '................',
    '................',
    '.......w........',
    '.....w.w.w......',
    '......www.......',
    '....wwwwwww.....',
    '......www.......',
    '.....w.w.w......',
    '.......w........',
    '................',
    '................',
    '................',
    '................',
    '................'], [
    '................',
    '.......w........',
    '..w....y....w...',
    '...y...y...y....',
    '....y.yyy.y.....',
    '.....yywyy......',
    '....yywwwyy.....',
    '.wyyywwwwwyyyw..',
    '....yywwwyy.....',
    '.....yywyy......',
    '....y.yyy.y.....',
    '...y...y...y....',
    '..w....y....w...',
    '.......w........',
    '................',
    '................'], [
    '.......o........',
    '..o.........o...',
    '................',
    '................',
    '.......y........',
    '................',
    '.....y...y......',
    'o..y.......y..o.',
    '.....y...y......',
    '................',
    '.......y........',
    '................',
    '................',
    '..o.........o...',
    '.......o........',
    '................']], false);
  proc('dust', 14, 9, 3, function (g, f) {
    var c = [Q.n3, Q.g1, Q.g0][f], rr = [1, 2, 2][f], sp = [1, 3, 5][f];
    disc(g, 7 - sp, 6 - f, rr, c); disc(g, 7 + sp, 6 - f, rr, c); disc(g, 7, 5 - f, rr + (f === 1 ? 1 : 0), c);
    if (f === 0) P(g, 7, 7, Q.W);
  }, false);
  pix('sparkle', { w: Q.W, y: Q.y3, o: Q.n2 }, [[
    '.........',
    '.........',
    '.........',
    '....y....',
    '...ywy...',
    '....y....',
    '.........',
    '.........',
    '.........'], [
    '.........',
    '.........',
    '....y....',
    '....w....',
    '..ywwwy..',
    '....w....',
    '....y....',
    '.........',
    '.........'], [
    '....y....',
    '....y....',
    '....w....',
    '...www...',
    'yywwwwwyy',
    '...www...',
    '....w....',
    '....y....',
    '....y....'], [
    '.........',
    '.........',
    '.o.....o.',
    '....y....',
    '...y.y...',
    '....y....',
    '.o.....o.',
    '.........',
    '.........']], false);
  proc('shockwave', 32, 10, 2, function (g, f) {
    var c1 = f ? Q.b4 : Q.W, c2 = f ? Q.b3 : Q.b6;
    for (var x = 0; x < 32; x++) {
      var d = Math.abs(x - 15.5) / 16, h = Math.round((1 - d * d) * (f ? 5 : 8));
      if (f && Math.abs(x - 15.5) < 6) h = Math.max(0, h - 4);
      if (h > 0) { R(g, x, 10 - h, 1, 1, c1); R(g, x, 10 - h + 1, 1, Math.max(0, h - 2), c2); }
    }
  }, false);
  proc('smoke', 16, 16, 3, function (g, f) {
    var r = rng(91 + f), c = [Q.g1, Q.g0, Q.g0][f], hl = [Q.W, Q.g1, Q.g1][f];
    var n = 3 + f, rad = 2 + f;
    for (var i = 0; i < n; i++) { var x = 8 + ((r() * 8 - 4) | 0) * (f + 1) / 2, y = 10 - f * 2 + ((r() * 6 - 3) | 0); disc(g, Math.round(x), y, rad - (i & 1), c); P(g, Math.round(x) - 1, y - 1, hl); }
  }, false);

  /* ---- pickups ---- */
  pix('coin', { y: Q.y2, l: Q.y3, w: Q.W, d: Q.y1 }, [[
    '..........',
    '...yyyy...',
    '..ylllyy..',
    '.ylwyyyyd.',
    '.ylyddyyd.',
    '.ylyddyyd.',
    '.yyyyyyyd.',
    '..yyyydd..',
    '...dddd...',
    '..........'], [
    '..........',
    '....yy....',
    '...ylyy...',
    '...lwyd...',
    '...lyyd...',
    '...lyyd...',
    '...yyyd...',
    '...yydd...',
    '....dd....',
    '..........'], [
    '..........',
    '....y.....',
    '....l.....',
    '....w.....',
    '....l.....',
    '....l.....',
    '....y.....',
    '....d.....',
    '....d.....',
    '..........'], [
    '..........',
    '....yy....',
    '...yyly...',
    '...dywl...',
    '...dyyl...',
    '...dyyl...',
    '...dyyy...',
    '...ddyy...',
    '....dd....',
    '..........']]);
  // health snack: a roast drumstick
  pix('snack', { m: Q.n0, l: Q.n1, h: Q.n2, b: Q.W, g: Q.g1, d: Q.y0 }, [[
    '..............',
    '...mmmmm......',
    '..mlhhlmm.....',
    '.mlhhllmmm....',
    '.mlhlllmmm....',
    '.mlllllmmd....',
    '.mmlllmmmdbb..',
    '..mmmmmmdbgbb.',
    '...ddmmdd.gbbg',
    '.......bb..bg.',
    '..............']]);
  // goblin dynamite bundle pickup (fuse spark flickers)
  pix('bomb_pickup', { r: Q.r1, R: Q.r0, w: Q.W, f: Q.y1, s: Q.y3, o: Q.o1, b: Q.n3 }, [[
    '.........s..',
    '........so..',
    '.......f....',
    '......f.....',
    '..rRrrRrrR..',
    '..rwrrwrrw..',
    '..rRrrRrrR..',
    '..bbbbbbbb..',
    '..rRrrRrrR..',
    '..rRrrRrrR..',
    '..rRrrRrrR..',
    '............'], [
    '........o.s.',
    '.........s..',
    '........f...',
    '......ff....',
    '..rRrrRrrR..',
    '..rwrrwrrw..',
    '..rRrrRrrR..',
    '..bbbbbbbb..',
    '..rRrrRrrR..',
    '..rRrrRrrR..',
    '..rRrrRrrR..',
    '............']]);
  pix('potion', { c: Q.y1, g: Q.b6, r: Q.r1, l: Q.r2, w: Q.W, d: Q.r0 }, [[
    '..........',
    '....cc....',
    '....cc....',
    '....gg....',
    '....gg....',
    '...grrg...',
    '..grwlrg..',
    '.grwlrrrg.',
    '.grlrrrdg.',
    '.grrrrrdg.',
    '..grrddg..',
    '...gggg...',
    '..........']]);
  // enhanced pet biscuit: a little bone-shaped treat that twinkles
  pix('biscuit', { b: Q.n2, l: Q.n3, d: Q.n1, w: Q.W }, [[
    '..............',
    '.bb.......bb..',
    'blbb.....bblb.',
    'bllbbbbbbblld.',
    '.blllllllllb..',
    'bllbbbbbbbbld.',
    'bdbd.....bdbd.',
    '.dd.......dd..',
    '..............'], [
    '...........w..',
    '.bb.......bb..',
    'bwbb.....bblb.',
    'bllbbbbbbblld.',
    '.blllllllllb..',
    'bllbbbbbbbbld.',
    'bdbd.....bdbd.',
    '.dd.......dd..',
    '..............']]);

  var TIERS = {
    bronze: { b: Q.n1, l: Q.n2, d: Q.n0, r: Q.y3 },
    silver: { b: Q.g1, l: Q.W, d: Q.g0, r: Q.b4 },
    gold: { b: Q.y2, l: Q.y3, d: Q.y1, r: Q.r1 },
    platinum: { b: Q.b6, l: Q.W, d: Q.b4, r: Q.p2 },
    legendary: { b: Q.p2, l: Q.p3, d: Q.p0, r: Q.y2 },
    fan: { b: Q.m2, l: Q.m3, d: Q.m0, r: Q.W },
    boss: { b: Q.r0, l: Q.r1, d: Q.n0, r: Q.W }
  };
  var RAINBOW = [Q.o1, Q.n2, Q.y3, Q.G2, Q.b4, Q.b5, Q.m2];
  function drawBox(g, f, tier) {
    var c = TIERS[tier];
    R(g, 2, 8, 12, 7, c.b); R(g, 2, 8, 1, 7, c.l); R(g, 13, 8, 1, 7, c.d); R(g, 2, 14, 12, 1, c.d);
    if (tier === 'legendary') for (var y = 9; y < 14; y++) R(g, 3, y, 10, 1, RAINBOW[(y + f) % 7]);
    if (tier === 'fan') { rows(g, 3, 10, ['h.h', 'hhh', '.h.'], { h: Q.r1 }); rows(g, 10, 10, ['h.h', 'hhh', '.h.'], { h: Q.r1 }); }
    R(g, 1, 5, 14, 3, c.b); R(g, 1, 5, 14, 1, c.l); R(g, 1, 7, 14, 1, c.d);
    if (tier === 'boss') { R(g, 7, 5, 2, 3, c.r); rows(g, 5, 8, ['.wwww.', 'wkwwkw', 'wkwwkw', 'wwwwww', '.wkkw.', '.w.ww.'], { w: Q.W, k: Q.r0 }); P(g, 3, 9, c.r); P(g, 12, 9, c.r); P(g, 3, 12, c.r); P(g, 12, 12, c.r); }
    else { R(g, 7, 5, 2, 10, c.r); P(g, 7, 6, Q.W); }
    R(g, 3, 2, 3, 3, c.r); R(g, 10, 2, 3, 3, c.r); P(g, 4, 3, c.d); P(g, 11, 3, c.d); R(g, 6, 3, 4, 2, c.r); P(g, 7, 3, Q.W);
    if (tier === 'boss') { P(g, 1, 4, c.r); P(g, 14, 4, c.r); }
    if (f === 1) { P(g, 3, 13, Q.W); P(g, 4, 12, Q.W); P(g, 5, 11, Q.W); }
    if (f === 2) { P(g, 9, 13, Q.W); P(g, 10, 12, Q.W); P(g, 11, 11, Q.W); P(g, 12, 10, Q.W); }
    if (f === 3) { P(g, 14, 1, Q.W); P(g, 13, 1, Q.y3); P(g, 15, 1, Q.y3); P(g, 14, 0, Q.y3); P(g, 14, 2, Q.y3); }
  }
  Object.keys(TIERS).forEach(function (tier) {
    proc('box_' + tier, 17, 16, 4, function (g, f) { drawBox(g, f, tier); });
  });

  /* ---- level objects ---- */
  var EXIT_ROWS = ['eee.x.x.i.ttt', 'e...x.x.i..t.', 'ee...x..i..t.', 'e...x.x.i..t.', 'eee.x.x.i..t.'];
  function doorFrame(g) {
    R(g, 1, 9, 24, 29, Q.g0); R(g, 1, 9, 24, 1, Q.g1); R(g, 1, 9, 1, 29, Q.g1); R(g, 24, 9, 1, 29, K);
  }
  function exitSign(g, lit) {
    R(g, 5, 1, 16, 7, lit ? Q.G1 : Q.t0); R(g, 5, 1, 16, 1, lit ? Q.G2 : Q.G0);
    var c = lit ? Q.W : Q.l2;
    rows(g, 7, 2, EXIT_ROWS, { e: c, x: c, i: c, t: c });
    R(g, 12, 8, 2, 1, Q.g0);
  }
  function doorLeaf(g) {
    R(g, 4, 13, 18, 25, Q.n0); R(g, 4, 13, 18, 1, Q.n1); R(g, 4, 13, 1, 25, Q.n1);
    R(g, 6, 16, 6, 9, Q.y0); R(g, 14, 16, 6, 9, Q.y0); R(g, 6, 27, 6, 9, Q.y0); R(g, 14, 27, 6, 9, Q.y0);
    R(g, 12, 13, 2, 25, K);
  }
  proc('door', 26, 38, 1, function (g) {
    doorFrame(g); doorLeaf(g); R(g, 10, 25, 2, 2, Q.y2); R(g, 14, 25, 2, 2, Q.y2);
    exitSign(g, false);
  });
  proc('door_open', 26, 38, 1, function (g) {
    doorFrame(g);
    R(g, 4, 13, 18, 25, K);
    for (var i = 0; i < 5; i++) R(g, 6 + i * 2, 34 - i * 3, 14 - i * 2, 1, i < 2 ? Q.g1 : Q.g0);
    R(g, 4, 13, 3, 25, Q.n0); R(g, 4, 13, 1, 25, Q.n1);
    exitSign(g, true);
  });
  // checkpoint: frame 0 = not reached (grey, drooped), frame 1 = activated (green, waving)
  var CP_POLE = ['..p........', '..p........', '..p........', '..p........', '..p........', '..p........', '..p........', '..p........', '..p........', '..p........', '..p........', '..p........', '.bbb.......', 'bbbbb......', '...........'];
  pix('checkpoint', { p: Q.g1, g: Q.G1, l: Q.G2, y: Q.y3, b: Q.g0, q: Q.g1, m: Q.g0, n: Q.g1 }, [
    ['...........', '..p........', '..pm.......', '..pnm......', '..pnnm.....', '..pnnnm....', '..pnnmm....'].concat(CP_POLE),
    ['...........', '..y........', '..pgggg....', '..plllgg...', '..pllyggg..', '..plllgg...', '..pgggg....'].concat(CP_POLE)
  ]);
  pix('checkpoint_off', { p: Q.g1, g: Q.g0, l: Q.g1, b: Q.g0 }, [[
    '...........', '..p........', '..pg.......', '..plg......', '..pllg.....', '..plllg....', '..pllgg....', '..pgg......',
    '..p........', '..p........', '..p........', '..p........', '..p........', '..p........', '..p........', '..p........',
    '..p........', '..p........', '..p........', '.bbb.......', 'bbbbb......', '...........']]);
  // an official dungeon sign
  pix('sign', { w: Q.n1, l: Q.n2, d: Q.n0, t: Q.y0, p: Q.y0 }, [[
    '..................',
    '.wwwwwwwwwwwwwwww.',
    '.wllllllllllllllw.',
    '.wlttttlttlttttdw.',
    '.wllllllllllllldw.',
    '.wlttlttttttlltdw.',
    '.wllllllllllllldw.',
    '.wlttttttlltttldw.',
    '.wdddddddddddddddw',
    '.wwwwwwwwwwwwwwww.',
    '.......pp.........',
    '.......pp.........',
    '.......pp.........',
    '.......pp.........',
    '.......pp.........',
    '..................']]);
  function chestBase(g) {
    R(g, 1, 7, 16, 8, Q.n0); R(g, 1, 7, 16, 1, Q.n1); R(g, 1, 14, 16, 1, Q.y0);
    R(g, 1, 7, 2, 8, Q.y2); R(g, 15, 7, 2, 8, Q.y2); R(g, 1, 7, 1, 8, Q.y3);
  }
  proc('chest', 18, 16, 1, function (g) {
    chestBase(g);
    R(g, 1, 2, 16, 5, Q.n1); R(g, 2, 1, 14, 1, Q.n1); R(g, 2, 2, 14, 1, Q.n2); R(g, 1, 6, 16, 1, Q.y0);
    R(g, 1, 2, 2, 5, Q.y2); R(g, 15, 2, 2, 5, Q.y2);
    R(g, 7, 5, 4, 5, Q.y2); R(g, 8, 7, 2, 2, K); P(g, 7, 5, Q.y3);
  });
  proc('chest_open', 18, 18, 1, function (g) {
    g.translate(0, 2);
    R(g, 1, -1, 16, 4, Q.y0); R(g, 2, -2, 14, 1, Q.n0); R(g, 1, -1, 2, 4, Q.y2); R(g, 15, -1, 2, 4, Q.y2);
    R(g, 2, 3, 14, 4, K);
    R(g, 3, 4, 12, 3, Q.y2); P(g, 4, 4, Q.W); P(g, 9, 3, Q.y3); P(g, 12, 4, Q.W); P(g, 6, 3, Q.y3);
    chestBase(g);
    R(g, 7, 7, 4, 3, Q.y2);
  });
  proc('crate', 18, 18, 1, function (g) { g.translate(1, 1); cratePaint(g, WOOD); });
  proc('stairs', 34, 26, 1, function (g) {
    R(g, 1, 6, 32, 20, Q.g0); R(g, 3, 2, 28, 4, Q.g0); R(g, 1, 6, 32, 1, Q.g1); R(g, 3, 2, 28, 1, Q.g1);
    R(g, 5, 7, 24, 19, K);
    for (var i = 0; i < 6; i++) R(g, 6 + i * 2, 23 - i * 3, 22 - i * 4, 2, i < 2 ? Q.g1 : i < 4 ? Q.g0 : Q.g3);
    R(g, 13, 3, 8, 3, Q.G1); P(g, 16, 3, Q.l2); P(g, 17, 3, Q.l2); R(g, 15, 4, 4, 1, Q.l2); P(g, 16, 5, Q.l2); P(g, 17, 5, Q.l2);
  });
  // the descending stairwell (48x40): an ornate wrought-iron entrance over stone steps going down
  proc('stairwell', 48, 40, 1, function (g) {
    var i, x;
    // the pit and the steps receding down into the dark
    R(g, 6, 22, 36, 18, K);
    for (var s2 = 0; s2 < 6; s2++) { var y = 23 + s2 * 3; R(g, 8 + s2 * 2, y, 32 - s2 * 4, 2, s2 < 2 ? Q.g1 : s2 < 4 ? Q.g0 : Q.g3); }
    // railing: posts, a top rail and a band of iron rings
    for (x = 5; x <= 42; x += 4) R(g, x, 25, 1, 14, Q.g0);
    R(g, 4, 24, 40, 1, Q.g1); R(g, 4, 31, 40, 1, Q.g0);
    for (x = 7; x < 42; x += 8) ring(g, x + 2, 28, 2, Q.g0);
    // lamp posts
    R(g, 2, 9, 3, 31, Q.g0); R(g, 3, 9, 1, 31, Q.g1); R(g, 43, 9, 3, 31, Q.g0); R(g, 44, 9, 1, 31, Q.g1);
    R(g, 1, 37, 5, 3, Q.g0); R(g, 42, 37, 5, 3, Q.g0);
    oval(g, 3, 5, 2, 3, Q.g0); oval(g, 3, 5, 1, 2, Q.y3); P(g, 3, 4, Q.W);
    oval(g, 44, 5, 2, 3, Q.g0); oval(g, 44, 5, 1, 2, Q.y3); P(g, 44, 4, Q.W);
    // the arch with curls and its sign
    for (i = 0; i <= 40; i++) { var t = i / 40, ax = Math.round(5 + t * 37), ay = Math.round(13 - Math.sin(t * Math.PI) * 9); R(g, ax, ay, 2, 1, Q.g0); P(g, ax, ay - 1, Q.g1); }
    ring(g, 10, 14, 2, Q.g0); ring(g, 37, 14, 2, Q.g0);
    R(g, 14, 5, 20, 9, K); R(g, 15, 6, 18, 7, Q.t0);
    rows(g, 20, 7, ['wwwwwww', '.wwwww.', '..www..', '...w...'], { w: Q.G2 });
  });
  // Mordecai's guild hall door (26x38): heavy oak, iron bands, a shield over it
  proc('guild_door', 26, 38, 1, function (g) {
    // stone frame
    R(g, 0, 8, 26, 30, K); R(g, 1, 9, 24, 29, Q.g0);
    for (var y = 12; y < 38; y += 6) { R(g, 1, y, 3, 1, K); R(g, 22, y + 3, 3, 1, K); }
    archFill(g, 13, 10, 9, 38, K); archFill(g, 13, 11, 8, 38, Q.y0);
    for (var x = 7; x < 20; x += 3) R(g, x, 12, 1, 26, Q.y1);
    R(g, 13, 11, 1, 27, K);
    R(g, 5, 20, 16, 2, Q.g1); R(g, 5, 31, 16, 2, Q.g1); for (x = 6; x < 21; x += 4) { P(g, x, 20, Q.W); P(g, x, 31, Q.W); }
    ring(g, 11, 27, 1, Q.y2); ring(g, 16, 27, 1, Q.y2);
    // the guild shield
    R(g, 7, 0, 12, 9, K); R(g, 8, 1, 10, 6, Q.r0); R(g, 9, 7, 8, 1, Q.r0); R(g, 11, 8, 4, 1, Q.r0);
    line(g, 9, 2, 16, 6, Q.y2); line(g, 16, 2, 9, 6, Q.y2); P(g, 12, 4, Q.W);
  }, false);

  /* ---- cage / egg / lever / padlocked door (kept from the parent, restyled) ---- */
  var IRON = { l: Q.g1, m: Q.g0, d: Q.g3, k: K, y: Q.y2, Y: Q.y3, o: Q.y1 };
  function bar(g, x, y0, y1) { R(g, x, y0, 1, y1 - y0, IRON.l); R(g, x + 1, y0, 1, y1 - y0, IRON.d); }
  function cageTop(g, dx) {
    R(g, 10 + dx, 0, 4, 1, K); R(g, 9 + dx, 1, 1, 2, K); R(g, 14 + dx, 1, 1, 2, K); R(g, 10 + dx, 1, 4, 1, IRON.l); R(g, 10 + dx, 2, 1, 1, IRON.m); R(g, 13 + dx, 2, 1, 1, IRON.m);
    R(g, 3 + dx, 3, 18, 1, K); R(g, 1 + dx, 4, 22, 1, K); R(g, 0 + dx, 5, 24, 3, K);
    R(g, 4 + dx, 4, 16, 1, IRON.m); R(g, 2 + dx, 5, 20, 1, IRON.l); R(g, 1 + dx, 6, 22, 1, IRON.m);
    for (var x = 3; x < 22; x += 4) P(g, x + dx, 6, IRON.l);
  }
  function cageBase(g) { R(g, 0, 25, 24, 3, K); R(g, 1, 26, 22, 1, IRON.l); for (var x = 3; x < 22; x += 5) P(g, x, 26, IRON.m); }
  var CAGE_BARS = [1, 6, 11, 16, 21];
  function cagePadlock(g, x, y) {
    R(g, x, y + 2, 6, 5, K); R(g, x + 1, y, 4, 1, K); P(g, x, y + 1, K); P(g, x + 5, y + 1, K);
    P(g, x + 1, y + 1, IRON.l); P(g, x + 4, y + 1, IRON.m);
    R(g, x + 1, y + 3, 4, 3, IRON.y); R(g, x + 1, y + 3, 4, 1, IRON.Y); P(g, x + 2, y + 4, K); P(g, x + 4, y + 5, IRON.o);
  }
  function cageBody(g, sway) {
    for (var i = 0; i < CAGE_BARS.length; i++) { var x = CAGE_BARS[i]; bar(g, x, 16, 25); bar(g, x + sway, 8, 16); }
    R(g, 0, 16, 1, 9, K); R(g, 23, 16, 1, 9, K); R(g, sway, 8, 1, 8, K); R(g, 23 + sway, 8, 1, 8, K);
    R(g, 1 + sway, 10, 22, 1, IRON.l); R(g, 1 + sway, 11, 22, 1, IRON.d);
    cagePadlock(g, 15, 14);
  }
  proc('cage', 24, 28, 2, function (g, f) { cageBody(g, f); cageTop(g, f); cageBase(g); }, false);
  proc('cage_broken', 30, 28, 1, function (g) {
    g.translate(1, 0);
    R(g, 1, 6, 22, 3, K); R(g, 3, 5, 18, 1, K); R(g, 6, 4, 12, 1, K);
    R(g, 2, 7, 20, 1, IRON.m); R(g, 4, 6, 16, 1, IRON.l); R(g, 7, 5, 10, 1, IRON.m);
    R(g, 0, 8, 1, 17, K); bar(g, 1, 8, 25); bar(g, 6, 8, 25);
    R(g, 1, 10, 7, 1, IRON.l); R(g, 1, 11, 7, 1, IRON.d);
    var bent = [[11, -1], [16, 1]];
    for (var i = 0; i < 2; i++) {
      var bx = bent[i][0], dir = bent[i][1];
      for (var y = 9; y < 25; y++) { var off = Math.round(Math.sin((y - 9) / 16 * Math.PI) * 3) * dir; P(g, bx + off, y, IRON.l); P(g, bx + off + 1, y, IRON.d); }
    }
    bar(g, 21, 8, 25); R(g, 23, 8, 1, 17, K);
    for (var c = 0; c < 6; c++) { var dy = Math.round(c * 0.8); if (c === 0 || c === 5 || c === 3) R(g, 23 + c, 14 + dy, 1, 10, c === 5 ? IRON.m : IRON.l); }
    cageBase(g);
    R(g, 14, 22, 6, 4, K); R(g, 15, 23, 4, 2, IRON.y); P(g, 15, 23, IRON.Y); P(g, 16, 24, K);
  }, false);
  var EGG = { b: Q.G3, m: Q.G2, d: Q.G1, s: Q.G0, w: Q.W, n: Q.y1, N: Q.n2, D: Q.y0 };
  var EGG_ROWS = ['.....bbbb.....', '....bbwbbb....', '...bbwbbsbb...', '..bbwbbbbbbb..', '..bbbbbsbbmb..', '.bsbbbbbbbbmb.', '.bbbbbsbbbbmb.', '.bbsbbbbbsbmb.', '.bbbbbbbbbmmb.', '.bbbbsbbbbmmb.', '..bsbbbbbmmb..', '..bbbbbsmmdb..', '...bbmmmmdd...', '....dddddd....'];
  function nest(g) {
    R(g, 1, 14, 14, 3, EGG.n);
    for (var x = 1; x < 15; x += 2) { P(g, x, 14, EGG.N); P(g, x + 1, 16, EGG.D); }
    P(g, 0, 15, EGG.n); P(g, 15, 15, EGG.n); P(g, 0, 13, EGG.N); P(g, 15, 13, EGG.N);
  }
  proc('egg', 16, 18, 2, function (g, f) {
    if (f === 0) rows(g, 1, 1, EGG_ROWS, EGG); else for (var j = 0; j < EGG_ROWS.length; j++) rows(g, 1 + (j < 5 ? 1 : 0), 1 + j, [EGG_ROWS[j]], EGG);
    nest(g);
  });
  proc('egg_broken', 20, 14, 1, function (g) {
    rows(g, 1, 3, ['b.b..b.b..', 'bbsbbbdbbb', 'bsssssssmb', 'bbbbbbbbmb', 'bsbbbbsmmb', '.bbbbbmmd.', '..ddddd...'], EGG);
    rows(g, 12, 3, ['...bb...', '..bwbb..', '.bwbbsb.', 'bbbbbbmb', '.b.b.b.b'], EGG);
    R(g, 1, 10, 18, 2, EGG.n); for (var x = 1; x < 19; x += 2) { P(g, x, 10, EGG.N); P(g, x + 1, 11, EGG.D); }
  });
  // lever (16x16): frame 0 = handle up-left (off, red light), frame 1 = down-right (on, green)
  proc('lever', 16, 16, 2, function (g, f) {
    R(g, 2, 10, 12, 5, Q.g0); R(g, 2, 10, 12, 1, Q.g1); R(g, 5, 9, 6, 2, Q.g3);
    R(g, 4, 12, 3, 1, K);
    R(g, 10, 12, 2, 2, f ? Q.G2 : Q.r0); P(g, 10, 12, f ? Q.l2 : Q.r2);
    if (f === 0) { line(g, 7, 9, 3, 3, Q.g1); line(g, 8, 9, 4, 3, Q.g0); disc(g, 3, 3, 2, Q.r1); P(g, 2, 2, Q.r3); }
    else { line(g, 8, 8, 12, 6, Q.g1); line(g, 8, 9, 12, 7, Q.g0); disc(g, 13, 6, 2, Q.r1); P(g, 12, 5, Q.r3); }
    R(g, 7, 9, 2, 1, Q.g1);
  });
  // door_locked: the exit door with chains across it and a big padlock
  proc('door_locked', 26, 38, 1, function (g) {
    doorFrame(g); doorLeaf(g); exitSign(g, false);
    R(g, 21, 2, 2, 2, Q.r1); P(g, 21, 2, Q.r3);
    function chain(x0, y0, x1, y1) {
      var n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)), i, x, y;
      for (i = 0; i <= n; i++) { if (i % 4 === 3) continue; x = Math.round(x0 + (x1 - x0) * i / n); y = Math.round(y0 + (y1 - y0) * i / n); R(g, x - 1, y - 1, 3, 3, K); }
      for (i = 0; i <= n; i++) { var ph = i % 4; if (ph === 3) continue; x = Math.round(x0 + (x1 - x0) * i / n); y = Math.round(y0 + (y1 - y0) * i / n); P(g, x, y, ph === 1 ? Q.W : (ph === 0 ? Q.g1 : Q.g0)); }
    }
    chain(3, 15, 22, 34); chain(22, 15, 3, 34);
    [[2, 14], [23, 14], [2, 35], [23, 35]].forEach(function (b) { R(g, b[0] - 1, b[1] - 1, 3, 3, K); P(g, b[0], b[1], Q.g1); });
    R(g, 9, 19, 8, 3, K); R(g, 10, 18, 6, 1, K);
    R(g, 10, 19, 1, 4, Q.g1); R(g, 15, 19, 1, 4, Q.g0); R(g, 11, 19, 4, 1, Q.g1); R(g, 11, 20, 4, 2, K);
    R(g, 7, 22, 12, 10, K);
    R(g, 8, 23, 10, 8, Q.y2); R(g, 8, 23, 10, 1, Q.y3); R(g, 8, 23, 1, 8, Q.y3); R(g, 8, 30, 10, 1, Q.y1); R(g, 17, 23, 1, 8, Q.y1);
    R(g, 12, 25, 2, 2, K); R(g, 12, 27, 2, 2, K); P(g, 12, 26, K);
    P(g, 9, 24, Q.W);
  });

  /* ---- ride stage track objects (the chopper reuses the parent race engine) ---- */
  proc('boost_pad', 16, 6, 2, function (g, f) {
    R(g, 0, 0, 16, 6, K); R(g, 1, 1, 14, 4, Q.b1); R(g, 1, 1, 14, 1, Q.b3);
    var cols = f ? [Q.c0, Q.c2, Q.b6] : [Q.b6, Q.c0, Q.c2];
    for (var i = 0; i < 3; i++) { var x = 2 + i * 4, c = cols[i]; R(g, x, 1, 2, 1, c); R(g, x + 1, 2, 2, 2, c); R(g, x, 4, 2, 1, c); }
    P(g, 15, 2, f ? Q.W : Q.c2); P(g, 15, 3, f ? Q.W : Q.c2);
  }, false);
  proc('jump_pad', 16, 8, 2, function (g, f) {
    R(g, 0, 6, 16, 2, K); R(g, 1, 6, 14, 1, Q.g0);
    var top = f ? 0 : 2;
    for (var x = 0; x < 16; x++) {
      var yy = Math.round(4 - (x / 15) * (4 - top));
      for (var y = yy + 2; y < 6; y++) {
        if (x >= 8 && x <= 13) P(g, x, y, (((y + x) >> 1) & 1) ? Q.r1 : Q.r2);
        else P(g, x, y, x < 8 ? Q.g0 : K);
      }
      P(g, x, yy, ((x + 16 - yy) >> 1) & 1 ? Q.y2 : K); P(g, x, yy + 1, K);
    }
    R(g, 14, top + 1, 2, 5 - top, K); P(g, 15, top, Q.W);
  }, false);
  proc('oil_slick', 16, 4, 1, function (g) {
    R(g, 4, 0, 8, 1, K); R(g, 1, 1, 14, 1, K); R(g, 0, 2, 16, 1, K); R(g, 2, 3, 12, 1, K);
    R(g, 5, 1, 3, 1, Q.p0); P(g, 8, 1, Q.t2); P(g, 9, 1, Q.m2); R(g, 3, 2, 2, 1, Q.b1); P(g, 11, 2, Q.b5); P(g, 6, 0, Q.p0);
  }, false);
  proc('finish_line', 32, 48, 2, function (g, f) {
    [1, 28].forEach(function (x) {
      R(g, x - 1, 0, 5, 48, K); R(g, x, 1, 3, 47, Q.g1); R(g, x, 1, 1, 47, Q.W);
      for (var y = 22; y < 44; y += 6) R(g, x, y, 3, 3, Q.r1);
      R(g, x - 2, 44, 7, 4, K); R(g, x - 1, 45, 5, 2, Q.g0);
      var dir = x < 16 ? 1 : -1, x0 = x < 16 ? x + 4 : x - 2;
      for (var j = 0; j < 5; j++) { var len = 7 - Math.abs(j - 2) * 3; for (var q = 0; q < len; q++) P(g, x0 + dir * q, 1 + j + (q > 3 ? f : 0), q === len - 1 || j === 0 || j === 4 ? K : (x < 16 ? Q.y2 : Q.b4)); }
    });
    R(g, 0, 7, 32, 12, K);
    for (var cy = 0; cy < 3; cy++) for (var cx = 0; cx < 10; cx++) R(g, 1 + cx * 3, 8 + cy * 3, 3, 3, ((cx + cy) & 1) ? K : Q.W);
    for (var bx = 2; bx < 31; bx += 4) P(g, bx, 18, ((bx >> 2) + f) & 1 ? Q.y3 : Q.y1);
  }, false);
  pix('mine', { k: K, g: Q.g0, G: Q.g1, r: Q.o0, w: Q.W, R: Q.o1, y: Q.y2 }, [
    ['...kk...', '..krrk..', '.kgGGgk.', 'kgGGggGk', 'kyykkyyk', 'kkkkkkkk'],
    ['..wRRw..', '..kRRk..', '.kgGGgk.', 'kgGGggGk', 'kkyykkyk', 'kkkkkkkk']
  ], false);

  /* ---- quest items (16x16, 2 frames): a pixel aura that pulses + twinkles ---- */
  function qiItem(name, pal, rs, glow) {
    var h = rs.length, w = 0;
    for (var i = 0; i < h; i++) w = Math.max(w, rs[i].length);
    var ox = (16 - w) >> 1, oy = ((16 - h) >> 1);
    glow = glow || Q.y3;
    var fill = new Uint8Array(256), ol = new Uint8Array(256), aura = new Uint8Array(256), q, nx, ny, kx, ky;
    for (ky = 0; ky < h; ky++) for (kx = 0; kx < rs[ky].length; kx++) {
      var c0 = rs[ky].charAt(kx);
      if (c0 !== '.' && c0 !== ' ' && pal[c0]) fill[(oy + ky) * 16 + ox + kx] = 1;
    }
    function grow(src, dst, block) {
      for (ny = 0; ny < 16; ny++) for (nx = 0; nx < 16; nx++) {
        q = ny * 16 + nx;
        if (src[q] || block[q]) continue;
        if ((nx > 0 && src[q - 1]) || (nx < 15 && src[q + 1]) || (ny > 0 && src[q - 16]) || (ny < 15 && src[q + 16])) dst[q] = 1;
      }
    }
    grow(fill, ol, fill);
    var both = new Uint8Array(256); for (q = 0; q < 256; q++) both[q] = fill[q] | ol[q];
    grow(ol, aura, both);
    proc(name, 16, 16, 2, function (g, f) {
      for (var ay = 0; ay < 16; ay++) for (var ax = 0; ax < 16; ax++) if (aura[ay * 16 + ax] && (f === 1 || ((ax + ay) & 1) === 0)) P(g, ax, ay, glow);
      for (q = 0; q < 256; q++) if (ol[q]) P(g, q & 15, q >> 4, K);
      if (f === 1) {
        for (var j = 0; j < h; j++) for (var i2 = 0; i2 < rs[j].length; i2++) {
          var ch = rs[j].charAt(i2), col = pal[ch];
          if (!col || ch === '.') continue;
          var d = (ox + i2) + (oy + j), rgb = parseColor(col);
          if ((d === 13 || d === 14) && rgb[0] + rgb[1] + rgb[2] > 200) col = Q.W;
          P(g, ox + i2, oy + j, col);
        }
      } else rows(g, ox, oy, rs, pal);
      var sp = f ? [[13, 2], [2, 12]] : [[2, 2], [13, 12]];
      for (var s = 0; s < sp.length; s++) { var x = sp[s][0], y = sp[s][1]; P(g, x, y, Q.W); P(g, x - 1, y, glow); P(g, x + 1, y, glow); P(g, x, y - 1, glow); P(g, x, y + 1, glow); }
    }, false);
  }
  qiItem('qi_key', { y: Q.y2, Y: Q.y3, o: Q.y1, w: Q.W, r: Q.r1 }, [
    '.YYy.......', 'YyyyY......', 'yy.yo......', 'yyyyr......', '.yooyy.....', '.....yy....',
    '......yy...', '.......yy..', '......yyyy.', '.......o.yy', '........yo.', '.........o.']);
  // Baggie of Trailer-Park-Grade Meth: a zip baggie of blue-white crystals
  qiItem('qi_meth', { b: Q.b6, w: Q.W, c: Q.b4, r: Q.r1, R: Q.r0, g: Q.g1 }, [
    'rrrrrrrrrr', 'RRRRRRRRRR', 'b........b', 'b.w......b', 'bw..c.w..b', 'b.wcwbcw.b',
    'bcwbwcwbcb', 'bwcwbwcwbb', 'bcwbcwbwcb', 'bbcwbwcbbb', '.bbbbbbbb.'], Q.b6);

  /* ---- HUD icons 8x8 (outline drawn in the rows) ---- */
  var IP = {
    k: K, r: Q.r1, R: Q.r2, w: Q.W, d: Q.r0, y: Q.y2, Y: Q.y3, o: Q.y1, g: Q.g0, G: Q.g1, b: Q.g3, B: Q.b3, L: Q.b4,
    c: Q.n1, C: Q.n2, p: Q.m2, P: Q.m3, n: Q.n0, e: Q.b2, f: Q.o1, t: Q.n3, v: Q.t1, V: Q.G0, q: Q.p0, Q: Q.p2, s: Q.o3, S: Q.o2, u: Q.y0
  };
  function icon(name, rs) { def('icon_' + name, { w: 8, h: 8, pal: IP, frames: [rs] }); }
  icon('heart', ['.kk.kk..', 'kRrkrrk.', 'kwRrrrk.', 'kRrrrrk.', '.krrrk..', '..krk...', '...k....', '........']);
  icon('heart_half', ['.kk.kk..', 'kRrkddk.', 'kwRrddk.', 'kRrrddk.', '.krrdk..', '..krk...', '...k....', '........']);
  icon('heart_empty', ['.kk.kk..', 'kddkddk.', 'kdddddk.', 'kdddddk.', '.kdddk..', '..kdk...', '...k....', '........']);
  icon('coin', ['..kkkk..', '.kYYyyk.', 'kYwyyyok', 'kYyyyyok', 'kYyyyyok', 'kyyyyook', '.kyooko.', '..kkkk..']);
  icon('bomb', ['.....Yf.', '....kY..', '...kok..', '.kkkkk..', 'kwGgggk.', 'kGgggbk.', 'kgggbbk.', '.kkkkk..']);
  icon('potion', ['..kkk...', '..kok...', '..kLk...', '.kLrLk..', 'kLrwrLk.', 'kLrrrLk.', 'kLrrrLk.', '.kkkkk..']);
  icon('star', ['...k....', '..kYk...', 'kkkYkkk.', 'kYYyyyk.', '.kyyyk..', '.kyyyk..', 'kyk.kyk.', 'kk...kk.']);
  icon('skull', ['.kkkkkk.', 'kwwwwwwk', 'kwkwwkwk', 'kwkwwkwk', 'kwwwwwwk', '.kwwwwk.', '.kwkkwk.', '..kkkk..']);
  icon('box', ['.kk.kk..', 'krrkrrk.', 'kkkrkkk.', 'kyYrYyk.', 'kkkrkkk.', 'kyyryyk.', 'koorook.', 'kkkkkkk.']);
  icon('key', ['.kkk....', 'kYyyk...', 'kykyk...', 'kYyykkkk', '.kkkyyyk', '....kykk', '....kk..', '........']);
  icon('sword', ['......kk', '.....kwk', '....kwGk', '.k.kwGk.', '.kkwGk..', '..kok...', '.kokk...', 'kkk.....']);
  icon('shield', ['kkkkkkk.', 'kLLyLek.', 'kLLyeek.', 'kyyyyyk.', 'kLeyeek.', '.keyek..', '..kek...', '...k....']);
  icon('boot', ['.kkkk...', '.kCck...', '.kCck...', '.kCck...', '.kCcckk.', 'kCcccck.', 'knnnnnk.', 'kkkkkkk.']);
  icon('brain', ['..kkkk..', '.kPPpPk.', 'kPpPPpPk', 'kPPpPPpk', 'kpPPpPPk', '.kPPPPk.', '..kpk...', '...k....']);
  icon('quest', ['.kkkkkk.', 'kYYYYYok', '.kYrYok.', '.kYrYk..', '.kYYYk..', '.kYrYok.', 'kYYYYYok', '.kkkkkk.']);
  icon('eye', ['........', '..kkkk..', '.kwwwwk.', 'kwwekwwk', 'kwekkwwk', '.kwwwwk.', '..kkkk..', '........']);
  // Book One items and gear
  icon('biscuit', ['.kk..kk.', 'kttkkttk', 'kttttttk', '.kttttk.', '.kCCCCk.', 'kCCCCCCk', 'kCCkkCck', '.kk..kk.']);
  icon('jug', ['...Yf...', '...ff...', '...kk...', '..kook..', '.koYook.', '.kooooku', '.kooouk.', '..kkkk..']);
  icon('dynamite', ['......Y.', '.....Yf.', '....kk..', '...krrk.', '..krwrk.', '.krrrk..', 'krRrk...', '.kkk....']);
  icon('shirt', ['.kk..kk.', 'kgvkkvgk', 'kvgvvgvk', '.kgvgvk.', '.kvggvk.', '.kgvvgk.', '.kvgvgk.', '.kkkkkk.']);
  icon('cloak', ['..kkkk..', '.kqQqqk.', '.kkkkqk.', '.kqQqqk.', 'kqqQqqqk', 'kqqQqqqk', 'kqqQqqqk', 'kkkkkkkk']);
  icon('ring', ['...kk...', '..krrk..', '.kkRkkk.', 'kyYkkyyk', 'kYk..kyk', 'kyk..kok', '.kyyook.', '..kkkk..']);
  icon('club', ['.....kk.', '....kVvk', '...kvVvk', '...kvvk.', '..kck...', '.kCk....', 'kCk.....', 'kk......']);
  icon('gauntlet', ['.k.k.k..', 'kGkGkGk.', 'kGkGkGkk', 'kGGGGGwk', 'kGgGGgk.', '.kGGGk..', '.kgggk..', '.kkkkk..']);
  icon('boxers', ['kkkkkkkk', 'kqyqyqyk', 'kyyyyyyk', 'kyQyyQyk', 'kyyykyyk', 'kyyk.kyk', 'kqqk.kqk', 'kkk...kk']);
  icon('foot', ['.kkk....', '.ksk....', '.ksk....', '.kssk...', '.kSsskkk', '.kSssssk', '.kSswsws', '..kkkkkk']);
  icon('crown', ['........', 'k.k..k.k', 'kykkkyk.', 'kyYyyYyk', 'kyrVyryk', 'kyyyyyyk', 'kooooook', 'kkkkkkkk']);
  icon('talisman', ['.y....y.', '..y..y..', 'PPkyykPP', 'PpPyyPpP', 'PPPyyPPP', '.PpyypP.', '.PPkkPP.', '..k..k..']);
  icon('brush', ['.kkkkk..', 'kwGwGwk.', 'kGwGwGk.', 'kkkkkkk.', '..kck...', '..kck...', '..kCk...', '..kkk...']);
  icon('skirt', ['..kkkk..', '..kppk..', '.kpPppk.', '.kppPpk.', 'kpPppPpk', 'kppPpppk', 'kPkPkPkk', 'kk.k.k..']);

  art.init = function () {
    var names = art.names();
    for (var i = 0; i < names.length; i++) if (!cache[names[i]]) get(names[i]);
  };
})();

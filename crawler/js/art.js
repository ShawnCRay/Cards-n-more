/* ============================================================
   DCW ART (art-core) - rasterizer + sprite API, tiles, parallax
   backgrounds, overworld tiles, fx, projectiles, pickups, objects,
   overworld markers, HUD icons. See ../DESIGN.md "Art contract".

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
   - HUD icons are stored as 'icon_<name>' (icon() also accepts a bare
     sprite name as a fallback).
   - tile()/owTile() info may carry tx, ty (world tile coords) for
     texture variation; without them every tile uses variant 0.
   - extra helpers: art.names(), art.refresh(name), art.themes, art.owThemes,
     art.sheet(name) -> {canvas,w,h,frames} (frame i at x=i*w), art.prepare(theme),
     art.ownNames (names registered by this file), extra sprite 'checkpoint_off'.
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
  var K = '#000000', WH = '#fcfcfc', MAG = '#ff00ff';

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
    } else r = [255, 0, 255, 255];
    rgbCache[c] = r;
    return r;
  }
  function hex(r, g, b) { return '#' + ((1 << 24) | (Math.max(0, Math.min(255, r | 0)) << 16) | (Math.max(0, Math.min(255, g | 0)) << 8) | Math.max(0, Math.min(255, b | 0))).toString(16).slice(1); }
  function mix(a, b, t) { var x = parseColor(a), y = parseColor(b); return hex(x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t); }
  function dk(a, t) { return mix(a, '#000000', t); }
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
    for (var n = 0; n < 2000; n++) {
      g.fillRect(x0, y0, 1, 1);
      if (x0 === x1 && y0 === y1) break;
      var e2 = 2 * e; if (e2 >= dy) { e += dy; x0 += sx; } if (e2 <= dx) { e += dx; y0 += sy; }
    }
  }
  // draw pixel rows inside a proc: rows = ['..kk..', ...], pal = {k:'#000'}
  function rows(g, x, y, rs, pal) {
    for (var j = 0; j < rs.length; j++) {
      var s = rs[j];
      for (var i = 0; i < s.length; i++) { var ch = s.charAt(i); if (ch === '.' || ch === ' ') continue; var c = pal[ch]; if (c) { g.fillStyle = c; g.fillRect(x + i, y + j, 1, 1); } }
    }
  }
  art.helpers = { R: R, P: P, disc: disc, ring: ring, line: line, rows: rows, mix: mix, dk: dk, rng: rng };

  // add a 1px outline (4-neighbour) to opaque pixels, per frame cell
  function outlineCanvas(cv, fw, fh, n, color) {
    var g = g2(cv), W = cv.width, H = cv.height;
    var img = g.getImageData(0, 0, W, H), d = img.data, src = new Uint8Array(W * H), i, x, y;
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
            rgb = lut[ch] = (col === null || col === undefined || col === 'transparent') ? null : parseColor(col);
          }
          if (!rgb) continue;
          var i = (y * W + f * w + x) * 4;
          d[i] = rgb[0]; d[i + 1] = rgb[1]; d[i + 2] = rgb[2]; d[i + 3] = rgb[3];
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
    var frame = 0, idx = 0, vs = e.v, alpha = 1;
    if (o) {
      if (o.frame) frame = o.frame | 0;
      if (o.flip) idx = 1;
      if (o.flash) idx |= 2;
      if (o.skin && e.skinnable) vs = variants(e, o.skin);
      if (o.alpha !== undefined && o.alpha < 1) alpha = o.alpha;
      if (o.scale) scale = o.scale;
    }
    if (alpha <= 0) return;
    var n = e.n;
    frame = n > 1 ? ((frame % n) + n) % n : 0;
    var img = vs[idx] || variant(e, vs, idx);
    var ax = idx & 1 ? e.w - e.ax : e.ax;
    var w = e.w, h = e.h;
    if (alpha < 1) { var pa = ctx.globalAlpha; ctx.globalAlpha = pa * alpha; }
    if (scale === 1) ctx.drawImage(img, frame * w, 0, w, h, Math.round(x - ax), Math.round(y - e.ay), w, h);
    else ctx.drawImage(img, frame * w, 0, w, h, Math.round(x - ax * scale), Math.round(y - e.ay * scale), Math.round(w * scale), Math.round(h * scale));
    if (alpha < 1) ctx.globalAlpha = pa;
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
    if (!e) {
      ctx.fillStyle = '#202020'; ctx.fillRect(x, y, 32, 32);
      ctx.fillStyle = '#58d854'; for (var i = 0; i < 32; i += 4) ctx.fillRect(x, y + i, 32, 1);
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

  var BOX_COLORS = { bronze: '#c87838', silver: '#bcbcbc', gold: '#f8b800', platinum: '#a4e4fc', legendary: '#9878f8', fan: '#f878f8', boss: '#e40058' };
  art.boxColor = function (tier) {
    var bt = DCW.data && DCW.data.boxTiers && DCW.data.boxTiers[tier];
    return (bt && bt.color) || BOX_COLORS[tier] || '#bcbcbc';
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

  /* =====================================================================
     SIDE-SCROLL TILES  (16x16, chunk chars # X = ^ ~ H b)
     ===================================================================== */
  // theme specs: body/top/alt/plat/spike/liquid/ladder/crate colour + style
  var TT = {
    sewer: {
      ol: '#0c1810', sh: '#24342c',
      body: { k: 'brick', m: '#1c2c28', a: '#6c7468', b: '#58685c', h: '#9ca494', s: '#3c4c44' },
      top: { k: 'slime', d: '#006800', m: '#00a800', l: '#58d854', x: '#b8f818' },
      alt: { k: 'blocks', m: '#102020', a: '#2c6c64', b: '#286058', h: '#58a49c', s: '#14403c' },
      plat: { k: 'grate', d: '#2c2c2c', m: '#7c7c7c', l: '#bcbcbc', x: '#ac7c00' },
      spike: { l: '#fca044', m: '#ac7c00', d: '#503000', b: '#3c3c3c' },
      liq: { k: 'water', d: '#004000', m: '#00a800', l: '#58d854', x: '#b8f818' },
      lad: { k: 'metal', m: '#7c7c7c', l: '#bcbcbc', d: '#3c3c3c' },
      crate: { d: '#503000', m: '#ac7c00', l: '#fca044' }
    },
    cave: {
      ol: '#140800', sh: '#2c1408',
      body: { k: 'rock', base: '#4c2410', a: '#6c3818', h: '#9c5c28', s: '#2c1408', d: '#843c18' },
      top: { k: 'ledge', d: '#4c2410', m: '#ac7c00', l: '#fca044', x: '#d8b8f8' },
      alt: { k: 'timber', d: '#2c1408', m: '#7c4c18', l: '#ac7c00', x: '#bcbcbc' },
      plat: { k: 'plank', d: '#503000', m: '#ac7c00', l: '#fca044', x: '#3c3c3c' },
      spike: { l: '#d8b8f8', m: '#9878f8', d: '#4428bc', b: '#2c1408' },
      liq: { k: 'water', d: '#00007c', m: '#0058f8', l: '#3cbcfc', x: '#a4e4fc' },
      lad: { k: 'wood', m: '#ac7c00', l: '#fca044', d: '#503000' },
      crate: { d: '#503000', m: '#ac7c00', l: '#fca044' }
    },
    city: {
      ol: '#141414', sh: '#3c3c3c',
      body: { k: 'concrete', base: '#6c6c6c', h: '#8c8c8c', s: '#3c3c3c', d: '#7c7c7c', x: '#a81000' },
      top: { k: 'curb', d: '#3c3c3c', m: '#bcbcbc', l: '#fcfcfc', x: '#f8b800' },
      alt: { k: 'brick', m: '#3c1408', a: '#a81000', b: '#881400', h: '#e45c10', s: '#581000' },
      plat: { k: 'girder', d: '#881400', m: '#e45c10', l: '#fca044', x: '#3c1408' },
      spike: { l: '#a4e4fc', m: '#3cbcfc', d: '#0058f8', b: '#3c3c3c' },
      liq: { k: 'water', d: '#200868', m: '#6844fc', l: '#9878f8', x: '#d8b8f8' },
      lad: { k: 'metal', m: '#5c5c5c', l: '#9c9c9c', d: '#242424' },
      crate: { d: '#503000', m: '#ac7c00', l: '#fca044' }
    },
    circus: {
      ol: '#1c0010', sh: '#3c0828',
      body: { k: 'diamond', a: '#6c1c6c', b: '#8c1030', h: '#f8b800', s: '#3c0828' },
      top: { k: 'trim', d: '#881400', m: '#e40058', l: '#fcfcfc', x: '#f8b800' },
      alt: { k: 'star', m: '#0058f8', l: '#3cbcfc', d: '#00007c', x: '#f8d878' },
      plat: { k: 'stripe', d: '#881400', m: '#e40058', l: '#fcfcfc', x: '#f8b800' },
      spike: { l: '#fcfcfc', m: '#bcbcbc', d: '#7c7c7c', b: '#881400' },
      liq: { k: 'water', d: '#880040', m: '#f85898', l: '#f8a4c0', x: '#fcfcfc' },
      lad: { k: 'rope', m: '#e4a050', l: '#fce0a8', d: '#7c4c18' },
      crate: { d: '#881400', m: '#e40058', l: '#f8b800' }
    },
    swamp: {
      ol: '#0c0c04', sh: '#241c08',
      body: { k: 'mud', base: '#3c2c10', a: '#4c3c18', h: '#6c5424', s: '#241808', d: '#5c7018' },
      top: { k: 'moss', d: '#304410', m: '#6c8c20', l: '#b8c838', x: '#d8f878' },
      alt: { k: 'log', d: '#2c1c08', m: '#6c4c20', l: '#9c7438', x: '#d8b878' },
      plat: { k: 'log', d: '#2c1c08', m: '#6c4c20', l: '#9c7438', x: '#d8b878' },
      spike: { l: '#d8f878', m: '#7c8c18', d: '#384410', b: '#241808' },
      liq: { k: 'water', d: '#0c2418', m: '#1c4c34', l: '#3c8c54', x: '#a4e4a0' },
      lad: { k: 'vine', m: '#007800', l: '#58d854', d: '#003800' },
      crate: { d: '#3c2c10', m: '#7c5c28', l: '#ac8c48' }
    },
    train: {
      ol: '#100404', sh: '#3c0c04',
      body: { k: 'ribbed', base: '#881400', h: '#a82c10', s: '#501000', x: '#f8b800' },
      top: { k: 'plate', d: '#2c2c2c', m: '#9c9c9c', l: '#dcdcdc', x: '#f8b800' },
      alt: { k: 'metal', base: '#5c5c5c', h: '#9c9c9c', s: '#2c2c2c', r: '#dcdcdc' },
      plat: { k: 'pipe', d: '#2c2c2c', m: '#7c7c7c', l: '#bcbcbc', x: '#ac7c00' },
      spike: { l: '#fcfcfc', m: '#9c9c9c', d: '#4c4c4c', b: '#2c2c2c' },
      liq: { k: 'lava', d: '#881400', m: '#f83800', l: '#fca044', x: '#f8d878' },
      lad: { k: 'metal', m: '#7c7c7c', l: '#bcbcbc', d: '#2c2c2c' },
      crate: { d: '#3c3c3c', m: '#7c7c7c', l: '#bcbcbc' }
    },
    bubble: {
      ol: '#08041c', sh: '#1c103c',
      body: { k: 'rock', base: '#2c1c5c', a: '#3c2c7c', h: '#6844fc', s: '#180c38', d: '#4428bc' },
      top: { k: 'sand', d: '#8c6c3c', m: '#e4c088', l: '#fce0a8', x: '#00a844' },
      alt: { k: 'coral', base: '#e45878', h: '#f8a4c0', s: '#a80020', d: '#ffd8e8' },
      plat: { k: 'plank', d: '#4c4c44', m: '#9c9484', l: '#d0c8b4', x: '#00a844' },
      spike: { l: '#d8b8f8', m: '#9878f8', d: '#3c1c7c', b: '#180c38' },
      liq: { k: 'water', d: '#004058', m: '#00a8a0', l: '#00e8d8', x: '#a4e4fc' },
      lad: { k: 'vine', m: '#00a844', l: '#58f898', d: '#004020' },
      crate: { d: '#3c3c34', m: '#7c7464', l: '#b0a890' }
    },
    forest: {
      ol: '#0c0800', sh: '#241404',
      body: { k: 'dirt', base: '#4c2c0c', a: '#6c4418', h: '#8c5c24', s: '#2c1804', d: '#7c7c7c' },
      top: { k: 'grass', d: '#005800', m: '#00a800', l: '#58d854', x: '#f8f8f8' },
      alt: { k: 'log', d: '#2c1804', m: '#7c4c18', l: '#ac7c40', x: '#f0d0b0' },
      plat: { k: 'branch', d: '#2c1804', m: '#7c4c18', l: '#ac7c40', x: '#00a800' },
      spike: { l: '#f0d0b0', m: '#ac7c00', d: '#503000', b: '#2c1804' },
      liq: { k: 'water', d: '#00003c', m: '#0038a8', l: '#3c7cf8', x: '#a4e4fc' },
      lad: { k: 'vine', m: '#007800', l: '#58d854', d: '#003800' },
      crate: { d: '#503000', m: '#ac7c00', l: '#fca044' }
    },
    castle: {
      ol: '#08080c', sh: '#24242c',
      body: { k: 'blocks', m: '#1c1c24', a: '#5c5c70', b: '#50506a', h: '#8c8ca4', s: '#30303c' },
      top: { k: 'stonecap', d: '#30303c', m: '#9c9cb4', l: '#d8d8ec', x: '#7c7c94' },
      alt: { k: 'panel', d: '#2c0c18', m: '#5c1830', l: '#8c3050', x: '#ac7c00' },
      plat: { k: 'shelf', d: '#2c1408', m: '#6c3418', l: '#9c5c28', x: '#ac7c00' },
      spike: { l: '#bcbcbc', m: '#7c7c7c', d: '#3c3c3c', b: '#1c1c24' },
      liq: { k: 'water', d: '#400010', m: '#a80020', l: '#e40058', x: '#f8a4c0' },
      lad: { k: 'wood', m: '#7c4c18', l: '#ac7c40', d: '#3c2008' },
      crate: { d: '#3c1c08', m: '#6c3c18', l: '#9c6c38' }
    },
    ruin: {
      ol: '#100800', sh: '#3c200c',
      body: { k: 'rock', base: '#6c3c18', a: '#8c5028', h: '#b87038', s: '#3c200c', d: '#7c7c7c' },
      top: { k: 'rust', d: '#6c3c18', m: '#d87830', l: '#fca044', x: '#9c9c9c' },
      alt: { k: 'hazard', base: '#7c5030', h: '#b07848', s: '#3c200c', r: '#f8b800' },
      plat: { k: 'girder', d: '#4c2810', m: '#8c5c34', l: '#c08850', x: '#2c1408' },
      spike: { l: '#bcbcbc', m: '#8c6c50', d: '#4c2810', b: '#3c200c' },
      liq: { k: 'water', d: '#2c4000', m: '#88c800', l: '#d8f878', x: '#fcfcfc' },
      lad: { k: 'metal', m: '#8c5c34', l: '#c08850', d: '#3c200c' },
      crate: { d: '#4c2810', m: '#8c5c34', l: '#c08850' }
    },
    warzone: {
      ol: '#080604', sh: '#1c140c',
      body: { k: 'dirt', base: '#3c2c20', a: '#4c3a2c', h: '#64503c', s: '#20160e', d: '#7c7c7c' },
      top: { k: 'sandbag', d: '#5c4428', m: '#b89868', l: '#e8d0a0', x: '#3c2c18' },
      alt: { k: 'bunker', base: '#5c5c58', h: '#8c8c84', s: '#2c2c28', r: '#f8b800' },
      plat: { k: 'grate', d: '#242420', m: '#5c6450', l: '#8c9478', x: '#3c4430' },
      spike: { l: '#bcbcbc', m: '#6c6c6c', d: '#2c2c2c', b: '#1c140c' },
      liq: { k: 'lava', d: '#881400', m: '#e45c10', l: '#fca044', x: '#f8d878' },
      lad: { k: 'metal', m: '#5c6450', l: '#8c9478', d: '#242420' },
      crate: { d: '#2c3418', m: '#5c6c30', l: '#8c9c50' }
    },
    safe: {
      ol: '#100400', sh: '#2c1004',
      body: { k: 'boards', base: '#6c3410', a: '#7c4018', h: '#a05c28', s: '#341404' },
      top: { k: 'floor', d: '#503000', m: '#c87838', l: '#f0b070', x: '#7c2c08' },
      alt: { k: 'panel', d: '#2c1004', m: '#5c2808', l: '#8c4c20', x: '#f8b800' },
      plat: { k: 'shelf', d: '#2c1004', m: '#7c4018', l: '#a86030', x: '#f8b800' },
      spike: { l: '#bcbcbc', m: '#7c7c7c', d: '#3c3c3c', b: '#2c1004' },
      liq: { k: 'water', d: '#7c5000', m: '#f8b800', l: '#fce0a8', x: '#fcfcfc' },
      lad: { k: 'wood', m: '#ac7c00', l: '#fca044', d: '#503000' },
      crate: { d: '#503000', m: '#ac7c00', l: '#fca044' }
    }
  };
  art.themes = Object.keys(TT);

  /* ---- body textures (fill the whole tile, seamless at 16px) ---- */
  function ellW(g, cx, cy, rw, rh, c) {
    for (var dy = -rh; dy <= rh; dy++) for (var dx = -rw; dx <= rw; dx++) {
      if ((dx * dx) / ((rw + 0.5) * (rw + 0.5)) + (dy * dy) / ((rh + 0.5) * (rh + 0.5)) <= 1) PW(g, cx + dx, cy + dy, c);
    }
  }
  var BODY = {
    brick: function (g, c, r) {
      R(g, 0, 0, 16, 16, c.m);
      for (var row = 0; row < 4; row++) {
        var y = row * 4, off = row & 1 ? 4 : 0;
        for (var bx = -8; bx < 16; bx += 8) {
          var x = bx + off, col = (hash2(((x + 16) % 16) + row * 3, row) % 3 === 0) ? c.b : c.a;
          R(g, x, y, 7, 3, col); R(g, x, y, 7, 1, c.h); P(g, x + 6, y + 2, c.s); P(g, x + 5, y + 2, c.s);
        }
      }
      for (var i = 0; i < 3; i++) PW(g, (r() * 16) | 0, ((r() * 4) | 0) * 4 + 1 + ((r() * 2) | 0), c.s);
    },
    blocks: function (g, c, r) {
      R(g, 0, 0, 16, 16, c.m);
      for (var row = 0; row < 2; row++) {
        var y = row * 8, off = row ? 4 : 0;
        for (var bx = -8; bx < 16; bx += 8) {
          var x = bx + off, col = r() < 0.35 ? c.b : c.a;
          R(g, x, y, 7, 7, col); R(g, x, y, 7, 1, c.h); R(g, x, y, 1, 7, c.h);
          R(g, x + 1, y + 6, 6, 1, c.s); R(g, x + 6, y + 1, 1, 6, c.s);
        }
      }
      for (var i = 0; i < 4; i++) PW(g, (r() * 16) | 0, (r() * 16) | 0, c.s);
    },
    rock: function (g, c, r) {
      R(g, 0, 0, 16, 16, c.base);
      for (var i = 0; i < 5; i++) {
        var cx = (r() * 16) | 0, cy = (r() * 16) | 0, rw = 2 + ((r() * 2) | 0), rh = 1 + ((r() * 2) | 0);
        ellW(g, cx + 1, cy + 1, rw, rh, c.s);
        ellW(g, cx, cy, rw, rh, i & 1 ? c.a : c.d);
        PW(g, cx - 1, cy - rh + 1, c.h); PW(g, cx, cy - rh + 1, c.h);
      }
      for (i = 0; i < 6; i++) PW(g, (r() * 16) | 0, (r() * 16) | 0, i & 1 ? c.s : c.h);
    },
    dirt: function (g, c, r) {
      R(g, 0, 0, 16, 16, c.base);
      for (var i = 0; i < 12; i++) PW(g, (r() * 16) | 0, (r() * 16) | 0, c.a);
      for (i = 0; i < 7; i++) PW(g, (r() * 16) | 0, (r() * 16) | 0, c.s);
      for (i = 0; i < 2; i++) { var x = (r() * 16) | 0, y = (r() * 16) | 0; PW(g, x, y, c.d); PW(g, x + 1, y, c.d); PW(g, x, y + 1, c.s); PW(g, x + 1, y + 1, c.s); PW(g, x, y - 1, c.h); }
      if (r() < 0.6) { x = (r() * 16) | 0; y = (r() * 10) | 0; for (i = 0; i < 5; i++) { PW(g, x, y + i, c.h); if (r() < 0.4) x += r() < 0.5 ? -1 : 1; } }
    },
    concrete: function (g, c, r) {
      R(g, 0, 0, 16, 16, c.base);
      for (var i = 0; i < 10; i++) PW(g, (r() * 16) | 0, (r() * 16) | 0, i & 1 ? c.h : c.d);
      var x = (r() * 16) | 0, y = (r() * 16) | 0;
      for (i = 0; i < 7; i++) { PW(g, x, y, c.s); x += r() < 0.6 ? 1 : 0; y += r() < 0.7 ? 1 : -1; }
      R(g, 0, 7, 16, 1, c.d);
      if (r() < 0.5) { x = (r() * 12) | 0; y = 9 + ((r() * 5) | 0); PW(g, x, y, c.s); PW(g, x + 1, y, c.x); PW(g, x + 2, y + 1, c.x); }
    },
    boards: function (g, c, r) {
      for (var row = 0; row < 4; row++) {
        var y = row * 4;
        R(g, 0, y, 16, 4, row & 1 ? c.a : c.base); R(g, 0, y + 3, 16, 1, c.s); R(g, 0, y, 16, 1, c.h);
        var j = (row * 7 + 3) % 16; R(g, j, y, 1, 3, c.s);
        PW(g, j + 2, y + 1, c.s); PW(g, (j + 9) % 16, y + 2, c.h);
      }
    },
    metal: function (g, c) {
      R(g, 0, 0, 16, 16, c.base); R(g, 0, 0, 16, 1, c.h); R(g, 0, 0, 1, 16, c.h); R(g, 0, 15, 16, 1, c.s); R(g, 15, 0, 1, 16, c.s);
      var rv = [[3, 3], [12, 3], [3, 12], [12, 12]];
      for (var i = 0; i < 4; i++) { P(g, rv[i][0], rv[i][1], c.r); P(g, rv[i][0] + 1, rv[i][1] + 1, c.s); }
    },
    ribbed: function (g, c) {
      R(g, 0, 0, 16, 16, c.base);
      for (var x = 1; x < 16; x += 4) { R(g, x, 0, 1, 16, c.h); R(g, x + 1, 0, 1, 16, c.s); }
      R(g, 0, 7, 16, 1, c.s); R(g, 0, 8, 16, 1, c.h);
      P(g, 3, 9, c.x); P(g, 11, 9, c.x);
    },
    mud: function (g, c, r) {
      R(g, 0, 0, 16, 16, c.base);
      for (var i = 0; i < 4; i++) ellW(g, (r() * 16) | 0, (r() * 16) | 0, 2, 1, c.a);
      for (i = 0; i < 8; i++) PW(g, (r() * 16) | 0, (r() * 16) | 0, i & 1 ? c.s : c.h);
      for (i = 0; i < 2; i++) { var x = (r() * 16) | 0, y = (r() * 16) | 0; PW(g, x, y, c.d); PW(g, x + 1, y + 1, c.d); }
    },
    diamond: function (g, c) {
      for (var y = 0; y < 16; y++) for (var x = 0; x < 16; x++) {
        var u = (x + y) & 15, w = (x - y + 32) & 15;
        var col = (((x + y) >> 3) ^ ((x - y + 32) >> 3)) & 1 ? c.a : c.b;
        if (u === 0 || w === 0) col = c.s;
        P(g, x, y, col);
      }
      P(g, 0, 8, c.h); P(g, 8, 0, c.h);
    }
  };

  /* ---- surface tops (only where nothing solid is above) ---- */
  var TOP = {
    slime: function (g, c, r) {
      R(g, 0, 0, 16, 4, c.m); R(g, 0, 0, 16, 1, c.l);
      for (var x = 0; x < 16; x++) { if (r() < 0.5) P(g, x, 4, c.m); if (r() < 0.25) P(g, x, 1, c.x); }
      R(g, 0, 4, 16, 1, c.d);
      for (var i = 0; i < 2; i++) { x = 1 + ((r() * 13) | 0); var len = 2 + ((r() * 5) | 0); R(g, x, 4, 2, len, c.m); P(g, x, 4 + len, c.l); P(g, x + 1, 4 + len - 1, c.d); }
      return 4;
    },
    grass: function (g, c, r) {
      for (var x = 0; x < 16; x++) {
        var d = 3 + ((r() * 3) | 0);
        R(g, x, 1, 1, d, c.m); P(g, x, 1 + d, c.d);
        if ((x + ((r() * 2) | 0)) % 3 !== 0) P(g, x, 0, c.l);
        if (r() < 0.5) P(g, x, 1, c.l);
      }
      if (r() < 0.5) { x = 2 + ((r() * 12) | 0); P(g, x, 0, c.x); P(g, x, 1, '#f8b800'); }
      return 4;
    },
    moss: function (g, c, r) {
      R(g, 0, 0, 16, 5, c.m); R(g, 0, 0, 16, 1, c.l);
      for (var x = 0; x < 16; x++) { if (r() < 0.35) P(g, x, 1, c.l); if (r() < 0.2) P(g, x, 2, c.x); if (r() < 0.6) P(g, x, 5, c.m); if (r() < 0.2) P(g, x, 3, c.d); }
      R(g, 0, 6, 16, 1, c.d);
      for (var i = 0; i < 4; i++) { x = (r() * 15) | 0; var len = 2 + ((r() * 7) | 0); R(g, x, 5, 1, len, c.m); P(g, x + 1, 6, c.d); P(g, x, 5 + len, c.l); }
      return 6;
    },
    ledge: function (g, c, r) {
      R(g, 0, 0, 16, 4, c.m); R(g, 0, 0, 16, 1, c.l);
      for (var x = 0; x < 16; x++) { if (r() < 0.45) P(g, x, 4, c.m); if (r() < 0.2) P(g, x, 2, c.l); if (r() < 0.2) P(g, x, 3, c.d); }
      R(g, 0, 5, 16, 1, c.d);
      if (r() < 0.6) { x = 2 + ((r() * 11) | 0); P(g, x, 0, c.x); P(g, x + 1, 0, c.x); P(g, x, 1, '#fcfcfc'); }
      return 5;
    },
    curb: function (g, c, r) {
      R(g, 0, 0, 16, 5, c.m); R(g, 0, 0, 16, 1, c.l); R(g, 0, 4, 16, 1, '#7c7c7c'); R(g, 0, 5, 16, 1, c.d);
      R(g, 15, 1, 1, 4, '#7c7c7c');
      R(g, 2, 2, 4, 1, c.x); R(g, 10, 2, 4, 1, c.x);
      if (r() < 0.5) { var x = (r() * 12) | 0; P(g, x, 3, '#7c7c7c'); P(g, x + 1, 2, '#7c7c7c'); }
      return 5;
    },
    trim: function (g, c) {
      for (var y = 1; y < 5; y++) for (var x = 0; x < 16; x++) P(g, x, y, ((x + y) >> 2) & 1 ? c.m : c.l);
      R(g, 0, 0, 16, 1, c.x); R(g, 0, 5, 16, 1, c.x); R(g, 0, 6, 16, 1, c.d);
      P(g, 4, 5, '#fcfcfc'); P(g, 12, 5, '#fcfcfc');
      return 6;
    },
    plate: function (g, c) {
      R(g, 0, 0, 16, 6, c.m); R(g, 0, 0, 16, 1, c.l);
      for (var y = 2; y < 5; y++) for (var x = 0; x < 16; x++) P(g, x, y, ((x + y) & 4) ? c.x : '#202020');
      R(g, 0, 6, 16, 1, c.d); P(g, 1, 1, c.d); P(g, 14, 1, c.d);
      return 6;
    },
    sand: function (g, c, r) {
      R(g, 0, 0, 16, 4, c.m); R(g, 0, 0, 16, 1, c.l);
      for (var x = 0; x < 16; x++) { if (r() < 0.5) P(g, x, 4, c.m); if (r() < 0.3) P(g, x, 2, c.l); if (r() < 0.15) P(g, x, 3, c.d); }
      R(g, 0, 5, 16, 1, c.d);
      if (r() < 0.6) { x = 3 + ((r() * 10) | 0); P(g, x, 0, c.x); P(g, x, 1, c.x); P(g, x + 1, 0, c.x); }
      if (r() < 0.4) { x = 2 + ((r() * 12) | 0); P(g, x, 2, '#f85898'); P(g, x + 1, 2, '#f8a4c0'); }
      return 5;
    },
    sandbag: function (g, c, r) {
      for (var i = -1; i < 2; i++) {
        var x = i * 8 + 4;
        R(g, x + 1, 0, 6, 1, c.d); R(g, x, 1, 8, 5, c.d);
        R(g, x + 1, 1, 6, 4, c.m); R(g, x + 1, 1, 5, 1, c.l); P(g, x + 4, 3, c.d); P(g, x + 4, 2, c.d);
      }
      R(g, 0, 6, 16, 1, c.x);
      return 6;
    },
    rust: function (g, c, r) {
      R(g, 0, 0, 16, 3, c.m); R(g, 0, 0, 16, 1, c.l);
      for (var x = 0; x < 16; x++) { if (r() < 0.55) P(g, x, 3, c.m); if (r() < 0.2) P(g, x, 4, c.m); if (r() < 0.2) P(g, x, 1, c.l); }
      R(g, 0, 4, 16, 1, c.d);
      if (r() < 0.5) { x = 2 + ((r() * 12) | 0); R(g, x, 5, 1, 4, c.x); P(g, x, 9, '#4c4c4c'); }
      return 4;
    },
    floor: function (g, c) {
      R(g, 0, 0, 16, 4, c.m); R(g, 0, 0, 16, 1, c.l); R(g, 0, 4, 16, 1, c.d); R(g, 0, 5, 16, 1, c.x);
      P(g, 7, 1, c.d); P(g, 7, 2, c.d); P(g, 7, 3, c.d); P(g, 3, 2, c.l); P(g, 11, 2, c.l);
      return 5;
    },
    stonecap: function (g, c) {
      R(g, 0, 0, 16, 5, c.m); R(g, 0, 0, 16, 1, c.l); R(g, 0, 1, 16, 1, c.l); R(g, 0, 4, 16, 1, c.x); R(g, 0, 5, 16, 1, c.d);
      R(g, 7, 2, 1, 3, c.x); P(g, 3, 3, c.x); P(g, 12, 2, c.x);
      return 5;
    }
  };

  /* ---- alternate solid 'X' ---- */
  var ALT = {
    timber: function (g, c) {
      R(g, 0, 0, 16, 16, c.d);
      R(g, 2, 0, 5, 16, c.m); R(g, 2, 0, 1, 16, c.l); R(g, 6, 0, 1, 16, c.d);
      R(g, 9, 0, 5, 16, c.m); R(g, 9, 0, 1, 16, c.l); R(g, 13, 0, 1, 16, c.d);
      R(g, 0, 6, 16, 4, c.m); R(g, 0, 6, 16, 1, c.l); R(g, 0, 9, 16, 1, c.d);
      P(g, 4, 7, c.x); P(g, 11, 7, c.x); P(g, 4, 3, c.d); P(g, 11, 13, c.d);
    },
    star: function (g, c) {
      R(g, 0, 0, 16, 16, c.m); R(g, 0, 0, 16, 1, c.l); R(g, 0, 0, 1, 16, c.l); R(g, 0, 15, 16, 1, c.d); R(g, 15, 0, 1, 16, c.d);
      rows(g, 3, 3, ['....y.....', '....y.....', '...yyy....', 'yyyyyyyyy.', '.yyyyyyy..', '..yyyyy...', '..yy.yy...', '.yy...yy..', '.y.....y..'], { y: c.x });
      P(g, 2, 2, c.l); P(g, 13, 13, c.d);
    },
    log: function (g, c) {
      R(g, 0, 0, 16, 16, c.m);
      for (var x = 0; x < 16; x += 4) { R(g, x, 0, 1, 16, c.d); R(g, x + 2, 0, 1, 16, c.l); }
      P(g, 1, 4, c.d); P(g, 9, 10, c.d); P(g, 5, 12, c.d); P(g, 13, 3, c.d);
      R(g, 4, 7, 3, 2, c.d); P(g, 5, 7, c.x);
    },
    coral: function (g, c, r) {
      R(g, 0, 0, 16, 16, c.base);
      for (var i = 0; i < 9; i++) { var x = (r() * 16) | 0, y = (r() * 16) | 0; PW(g, x, y, c.s); PW(g, x + 1, y, c.s); PW(g, x, y - 1, c.h); PW(g, x + 1, y + 1, c.d); }
      R(g, 0, 0, 16, 1, c.h);
    },
    panel: function (g, c) {
      R(g, 0, 0, 16, 16, c.m);
      R(g, 0, 0, 16, 2, c.x); R(g, 0, 2, 16, 1, c.d);
      R(g, 2, 4, 12, 10, c.d); R(g, 3, 5, 10, 8, c.m); R(g, 3, 5, 10, 1, c.l); R(g, 3, 5, 1, 8, c.l);
      R(g, 0, 15, 16, 1, c.d); P(g, 7, 8, c.x); P(g, 8, 9, c.x);
    },
    bunker: function (g, c) {
      R(g, 0, 0, 16, 16, c.base); R(g, 0, 0, 16, 1, c.h); R(g, 0, 15, 16, 1, c.s);
      for (var y = 9; y < 13; y++) for (var x = 0; x < 16; x++) P(g, x, y, ((x + y) & 4) ? c.r : '#202020');
      P(g, 3, 3, c.s); P(g, 11, 5, c.s); P(g, 12, 5, c.s); P(g, 6, 6, c.h); P(g, 2, 7, c.h);
    },
    hazard: function (g, c, r) {
      BODY.metal(g, c);
      for (var y = 6; y < 10; y++) for (var x = 1; x < 15; x++) P(g, x, y, ((x - y + 16) & 4) ? c.r : '#202020');
      for (var i = 0; i < 6; i++) P(g, 1 + ((r() * 14) | 0), 1 + ((r() * 14) | 0), '#c05010');
    }
  };
  ALT.brick = BODY.brick; ALT.blocks = BODY.blocks; ALT.metal = BODY.metal;

  /* ---- one-way platforms '=' ---- */
  var PLAT = {
    plank: function (g, c, L, Rt) {
      R(g, 0, 0, 16, 5, c.m); R(g, 0, 0, 16, 1, c.l); R(g, 0, 4, 16, 1, c.d); R(g, 0, 5, 16, 1, '#000000');
      P(g, 5, 2, c.d); P(g, 6, 2, c.d); P(g, 12, 3, c.l); P(g, 2, 2, c.x); P(g, 13, 2, c.x);
      if (!L) { R(g, 0, 0, 1, 6, '#000000'); R(g, 2, 6, 2, 4, c.d); R(g, 2, 6, 1, 4, c.m); }
      if (!Rt) { R(g, 15, 0, 1, 6, '#000000'); R(g, 12, 6, 2, 4, c.d); R(g, 12, 6, 1, 4, c.m); }
      if (L && Rt) R(g, 15, 1, 1, 3, c.d);
    },
    grate: function (g, c, L, Rt) {
      R(g, 0, 0, 16, 4, c.m); R(g, 0, 0, 16, 1, c.l); R(g, 0, 3, 16, 1, c.d);
      for (var x = 1; x < 16; x += 3) P(g, x, 2, c.d);
      R(g, 0, 4, 16, 1, '#000000');
      line(g, 0, 5, 7, 8, c.d); line(g, 8, 8, 15, 5, c.d); R(g, 0, 9, 16, 1, c.d);
      if (!L) R(g, 0, 0, 1, 10, '#000000');
      if (!Rt) R(g, 15, 0, 1, 10, '#000000');
    },
    girder: function (g, c, L, Rt) {
      R(g, 0, 0, 16, 2, c.m); R(g, 0, 0, 16, 1, c.l); R(g, 0, 2, 16, 3, c.d); R(g, 0, 5, 16, 2, c.m); R(g, 0, 7, 16, 1, '#000000');
      R(g, 3, 3, 2, 1, c.x); R(g, 11, 3, 2, 1, c.x); R(g, 0, 2, 16, 1, c.x);
      if (!L) R(g, 0, 0, 1, 8, '#000000');
      if (!Rt) R(g, 15, 0, 1, 8, '#000000');
    },
    stripe: function (g, c, L, Rt) {
      for (var y = 1; y < 4; y++) for (var x = 0; x < 16; x++) P(g, x, y, ((x + y) >> 2) & 1 ? c.m : c.l);
      R(g, 0, 0, 16, 1, c.x); R(g, 0, 4, 16, 1, c.x); R(g, 0, 5, 16, 1, '#000000');
      if (!L) { R(g, 0, 0, 1, 6, '#000000'); R(g, 3, 6, 1, 3, c.x); }
      if (!Rt) { R(g, 15, 0, 1, 6, '#000000'); R(g, 12, 6, 1, 3, c.x); }
    },
    log: function (g, c, L, Rt) {
      R(g, 0, 0, 16, 6, c.m); R(g, 0, 0, 16, 1, c.l); R(g, 0, 4, 16, 2, c.d); R(g, 0, 6, 16, 1, '#000000');
      P(g, 3, 2, c.d); P(g, 4, 2, c.d); P(g, 10, 3, c.d); P(g, 12, 1, c.l); P(g, 7, 2, c.l);
      if (!L) { R(g, 0, 0, 4, 7, '#000000'); R(g, 1, 1, 3, 5, c.x); P(g, 2, 3, c.m); }
      if (!Rt) { R(g, 12, 0, 4, 7, '#000000'); R(g, 12, 1, 3, 5, c.x); P(g, 13, 3, c.m); }
    },
    branch: function (g, c, L, Rt) {
      R(g, 0, 1, 16, 4, c.m); R(g, 0, 1, 16, 1, c.l); R(g, 0, 4, 16, 1, c.d); R(g, 0, 5, 16, 1, '#000000');
      R(g, 2, 0, 3, 1, c.x); R(g, 10, 0, 2, 1, c.x); P(g, 3, 5, c.x); P(g, 11, 6, c.x); P(g, 12, 5, c.x);
      if (!L) { R(g, 0, 1, 1, 5, '#000000'); }
      if (!Rt) { R(g, 15, 1, 1, 5, '#000000'); R(g, 13, 0, 3, 1, c.x); }
    },
    pipe: function (g, c, L, Rt) {
      R(g, 0, 0, 16, 6, c.m); R(g, 0, 1, 16, 1, c.l); R(g, 0, 0, 16, 1, c.d); R(g, 0, 4, 16, 2, c.d); R(g, 0, 6, 16, 1, '#000000');
      R(g, 14, 0, 2, 6, c.d); P(g, 14, 1, c.l);
      if (!L) { R(g, 0, 0, 2, 7, '#000000'); R(g, 1, 1, 2, 4, c.x); }
      if (!Rt) { R(g, 14, 0, 2, 7, '#000000'); R(g, 13, 1, 2, 4, c.x); }
    },
    shelf: function (g, c, L, Rt) {
      R(g, 0, 0, 16, 4, c.m); R(g, 0, 0, 16, 1, c.l); R(g, 0, 3, 16, 1, c.d); R(g, 0, 4, 16, 1, '#000000');
      R(g, 6, 5, 4, 1, c.x); P(g, 7, 6, c.x); P(g, 8, 6, c.x); P(g, 7, 7, c.x);
      if (!L) R(g, 0, 0, 1, 5, '#000000');
      if (!Rt) R(g, 15, 0, 1, 5, '#000000');
    }
  };

  function paintSpikes(g, c) {
    for (var i = 0; i < 2; i++) {
      var cx = i * 8 + 4;
      for (var y = 2; y < 13; y++) {
        var hw = Math.max(1, Math.round((y - 1) * 4 / 11));
        for (var x = cx - hw; x < cx + hw; x++) P(g, x, y, x === cx - hw ? c.l : x < cx ? c.m : c.d);
      }
      P(g, cx - 1, 2, c.l); P(g, cx, 2, c.l);
    }
    R(g, 0, 13, 16, 3, c.b); R(g, 0, 13, 16, 1, c.m); P(g, 3, 14, c.l); P(g, 11, 14, c.l);
  }
  function paintLiquid(g, c, surf, a) {
    var lava = c.k === 'lava', x, y;
    if (surf) {
      for (x = 0; x < 16; x++) {
        var yy = 3 + Math.round(Math.sin((x + a * 4) / 16 * Math.PI * 2) * 1.2);
        R(g, x, yy, 1, 16 - yy, c.m); P(g, x, yy, c.x); P(g, x, yy + 1, c.l);
      }
    } else R(g, 0, 0, 16, 16, c.m);
    for (y = 7; y < 16; y += 4) { // moving streaks
      var off = (a * 2 + y * 3) % 16;
      R(g, off, y, 4, 1, lava ? c.l : c.d); R(g, (off + 9) % 16, y + 2, 3, 1, lava ? c.x : c.l);
    }
    if (surf) {
      if (lava) { var bx = (a * 5 + 3) % 14; P(g, bx, 1 + (a & 1), c.x); P(g, bx + 1, 2, c.l); }
      else if (a & 1) P(g, (a * 7) % 16, 8, c.x);
    }
  }
  function paintLadder(g, c) {
    var k = c.k;
    if (k === 'vine' || k === 'rope') {
      for (var y = 0; y < 16; y++) { var sx = (y >> 1) & 1; P(g, 3 + sx, y, c.m); P(g, 12 - sx, y, c.m); P(g, 4 - sx, y, c.d); P(g, 11 + sx, y, c.d); }
      for (y = 2; y < 16; y += 5) { R(g, 4, y, 8, 1, c.m); R(g, 4, y, 8, 1, k === 'rope' ? c.l : c.m); P(g, 5, y + 1, c.d); }
      if (k === 'vine') { P(g, 2, 4, c.l); P(g, 13, 9, c.l); P(g, 2, 13, c.l); P(g, 13, 1, c.l); }
      return;
    }
    R(g, 2, 0, 2, 16, c.m); R(g, 12, 0, 2, 16, c.m); R(g, 2, 0, 1, 16, c.l); R(g, 12, 0, 1, 16, c.l);
    for (y = 1; y < 16; y += 4) { R(g, 4, y, 8, 2, c.m); R(g, 4, y, 8, 1, c.l); }
  }
  function paintCrate(g, c) {
    R(g, 1, 1, 14, 14, c.m);
    R(g, 1, 1, 14, 2, c.l); R(g, 1, 13, 14, 2, c.d); R(g, 1, 1, 2, 14, c.l); R(g, 13, 1, 2, 14, c.d);
    for (var i = 0; i < 10; i++) { P(g, 3 + i, 12 - i, c.l); P(g, 4 + i, 12 - i, c.l); P(g, 4 + i, 13 - i, c.d); }
    R(g, 3, 3, 10, 1, c.d);
    P(g, 2, 2, '#fcfcfc'); P(g, 13, 2, c.d); P(g, 2, 13, c.d); P(g, 13, 13, c.d);
  }

  function paintTile(spec, ch, mask, v, a, theme) {
    var cv = mkCanvas(16, 16), g = g2(cv);
    var r = rng(hashStr(theme + ch) + v * 7919);
    var up = mask & 1, L = mask & 4, Rt = mask & 8, dn = mask & 2;
    if (ch === '#' || ch === 'X') {
      var th = 0;
      if (ch === '#') BODY[spec.body.k](g, spec.body, r);
      else ALT[spec.alt.k](g, spec.alt, r);
      if (!up) {
        if (ch === '#') th = TOP[spec.top.k](g, spec.top, rng(hashStr(theme) + v * 131));
        else { R(g, 0, 0, 16, 1, spec.top.l); R(g, 0, 1, 16, 1, mix(spec.top.l, spec.top.m, 0.5)); th = 2; }
      }
      if (!L) { R(g, 0, th, 1, 16 - th, spec.ol); R(g, 1, th + 1, 1, 15 - th, spec.sh); }
      if (!Rt) { R(g, 15, th, 1, 16 - th, spec.ol); R(g, 14, th + 1, 1, 15 - th, spec.sh); }
      if (!dn) { R(g, 0, 15, 16, 1, spec.ol); R(g, L ? 0 : 1, 14, L && Rt ? 16 : 14 + (L ? 1 : 0) + (Rt ? 1 : 0), 1, spec.sh); }
      if (!up && !L) { g.clearRect(0, 0, 1, 1); P(g, 0, 1, spec.ol); }
      if (!up && !Rt) { g.clearRect(15, 0, 1, 1); P(g, 15, 1, spec.ol); }
      if (!dn && !L) g.clearRect(0, 15, 1, 1);
      if (!dn && !Rt) g.clearRect(15, 15, 1, 1);
    } else if (ch === '=') {
      PLAT[spec.plat.k](g, spec.plat, L, Rt);
    } else if (ch === '^') {
      paintSpikes(g, spec.spike); outlineCanvas(cv, 16, 16, 1, K);
    } else if (ch === '~') {
      paintLiquid(g, spec.liq, !up, a);
    } else if (ch === 'H') {
      paintLadder(g, spec.lad); outlineCanvas(cv, 16, 16, 1, K);
    } else if (ch === 'b') {
      paintCrate(g, spec.crate); R(g, 0, 1, 1, 14, K); R(g, 15, 1, 1, 14, K); R(g, 1, 0, 14, 1, K); R(g, 1, 15, 14, 1, K);
    } else return null;
    return cv;
  }

  var tileCache = {};
  art.tile = function (ctx, theme, ch, x, y, info) {
    var spec = TT[theme] || TT.sewer;
    var mask = 0, v = 0, a = 0;
    if (info) {
      mask = (info.up ? 1 : 0) | (info.down ? 2 : 0) | (info.left ? 4 : 0) | (info.right ? 8 : 0);
      if (info.tx !== undefined) v = hash2(info.tx | 0, (info.ty | 0) * 3 + 1) & 3;
    }
    if (ch === '=') { mask &= 12; v = 0; }
    else if (ch === '~') { mask &= 1; v = 0; a = Math.floor(((info && info.t !== undefined) ? info.t : (DCW.t || 0)) * 5) & 3; }
    else if (ch === '^' || ch === 'H' || ch === 'b') { mask = 0; v = 0; }
    else if (ch !== '#' && ch !== 'X') return;
    var key = (TT[theme] ? theme : 'sewer') + ch, tc = tileCache[key] || (tileCache[key] = {});
    var id = (mask << 4) | (v << 2) | a;
    var cv = tc[id];
    if (cv === undefined) cv = tc[id] = paintTile(spec, ch, mask, v, a, TT[theme] ? theme : 'sewer');
    if (cv) ctx.drawImage(cv, Math.round(x), Math.round(y));
  };

  /* =====================================================================
     PARALLAX BACKGROUNDS  (pre-rendered layers, tiled horizontally)
     ===================================================================== */
  var BGH = 200; // layer canvas height (screen is 180; extra for camY parallax)
  function rep(g, w, fn) { for (var k = -1; k <= 1; k++) { g.save(); g.translate(k * w, 0); fn(); g.restore(); } }
  function bands(g, w, y0, y1, cols) {
    var n = cols.length, bh = (y1 - y0) / n;
    for (var i = 0; i < n; i++) {
      var a = Math.round(y0 + i * bh), b = Math.round(y0 + (i + 1) * bh);
      R(g, 0, a, w, b - a, cols[i]);
      if (i > 0) { g.fillStyle = cols[i - 1]; for (var x = 0; x < w; x += 2) { g.fillRect(x, a, 1, 1); if ((x & 3) === 0) g.fillRect(x + 1, a + 1, 1, 1); } }
    }
  }
  function stars(g, w, h, n, seed, cols) {
    var r = rng(seed);
    for (var i = 0; i < n; i++) { var x = (r() * w) | 0, y = (r() * h) | 0; P(g, x, y, cols[(r() * cols.length) | 0]); if (r() < 0.08) { P(g, x - 1, y, cols[0]); P(g, x + 1, y, cols[0]); P(g, x, y - 1, cols[0]); P(g, x, y + 1, cols[0]); } }
  }
  function tri(g, x, y, w, h, c, down) { // isoceles triangle, apex up (or down)
    g.fillStyle = c;
    for (var j = 0; j < h; j++) { var ww = Math.max(1, Math.round(w * (j + 1) / h)); g.fillRect(Math.round(x - ww / 2), down ? y + h - 1 - j : y + j, ww, 1); }
  }
  function pine(g, x, base, h, c, c2) {
    var w = Math.round(h * 0.55);
    R(g, x - 1, base - Math.round(h * 0.2), 2, Math.round(h * 0.2) + 1, c);
    for (var k = 0; k < 3; k++) {
      var top = base - h + Math.round(k * h * 0.25), th = Math.round(h * 0.45);
      tri(g, x, top, Math.round(w * (0.55 + k * 0.22)), th, c);
      if (c2) { R(g, x - Math.round(w * (0.55 + k * 0.22) / 2), top + th - 1, Math.round(w * (0.55 + k * 0.22) / 2), 1, c2); }
    }
  }
  function deadTree(g, x, base, h, c, r) {
    R(g, x - 2, base - h, 4, h, c); R(g, x - 3, base - 3, 6, 3, c);
    function br(bx, by, len, dir, depth) {
      var ex = bx + dir * len, ey = by - Math.round(len * 0.7);
      line(g, bx, by, ex, ey, c); line(g, bx + 1, by, ex + 1, ey, c);
      if (depth > 0) { br(ex, ey, Math.round(len * 0.6), dir, depth - 1); br(ex, ey, Math.round(len * 0.5), -dir, depth - 1); }
    }
    br(x, base - Math.round(h * 0.6), Math.round(h * 0.35), -1, 2);
    br(x, base - Math.round(h * 0.8), Math.round(h * 0.3), 1, 2);
    br(x, base - h, Math.round(h * 0.2), r() < 0.5 ? 1 : -1, 1);
  }
  function blob(g, cx, cy, rw, rh, c) {
    g.fillStyle = c;
    for (var dy = -rh; dy <= rh; dy++) { var ww = Math.round(rw * Math.sqrt(1 - (dy * dy) / ((rh + 0.5) * (rh + 0.5)))); g.fillRect(cx - ww, cy + dy, ww * 2 + 1, 1); }
  }
  function skyline(g, w, base, seed, o) {
    var r = rng(seed), x = (r() * 10) | 0;
    while (x < w) {
      var bw = o.minW + ((r() * (o.maxW - o.minW)) | 0), bh = o.minH + ((r() * (o.maxH - o.minH)) | 0);
      var top = base - bh;
      R(g, x, top, bw, BGH - top, o.col);
      if (o.broken && r() < 0.7) { // jagged broken top
        var n = 2 + ((r() * 3) | 0);
        for (var i = 0; i < n; i++) { var bx = x + ((r() * bw) | 0), d = 2 + ((r() * 8) | 0); g.clearRect(bx, top, 2 + ((r() * 4) | 0), d); }
        if (r() < 0.5) { line(g, x + 2, top, x + 2 - 3, top - 6, o.col); }
      } else if (o.antenna && r() < 0.4) { R(g, x + (bw >> 1), top - 8, 1, 8, o.col); }
      if (o.win) {
        for (var wy = top + 4; wy < base + 30; wy += 5) for (var wx = x + 2; wx < x + bw - 2; wx += 4) if (r() < o.winP) R(g, wx, wy, 2, 2, o.win);
      }
      if (o.rim) R(g, x, top, 1, BGH - top, o.rim);
      x += bw + ((r() * o.gap) | 0);
    }
  }
  function layer(w, rate, draw, extra) {
    var L = { w: w, rate: rate, speed: 0, draw: draw, y: 0 };
    if (extra) for (var k in extra) L[k] = extra[k];
    return L;
  }

  var BG = {};
  BG.sewer = {
    sky: function (g) {
      R(g, 0, 0, 320, BGH, '#060c0a');
      for (var row = 0; row < 25; row++) for (var bx = -16; bx < 320; bx += 16) { var x = bx + (row & 1 ? 8 : 0); R(g, x, row * 8, 15, 7, (row + bx) % 3 ? '#0e1814' : '#101c18'); R(g, x, row * 8, 15, 1, '#14221c'); }
      bands(g, 320, 150, 200, ['#08180e', '#0a2412', '#0c2c14']);
      for (var i = 0; i < 20; i++) R(g, (i * 37) % 320, 156 + (i * 7) % 40, 6, 1, '#164020');
    },
    layers: [
      layer(320, 0.25, function (g, w) {
        rep(g, w, function () {
          R(g, 0, 0, w, 150, '#18241e');
          for (var row = 0; row < 19; row++) for (var bx = -16; bx < w; bx += 16) { var x = bx + (row & 1 ? 8 : 0); R(g, x, row * 8, 15, 7, '#1c2c24'); R(g, x, row * 8, 15, 1, '#24382e'); }
          for (var a = 0; a < 2; a++) {
            var cx = 80 + a * 160;
            blob(g, cx, 96, 58, 58, '#2a3e34'); blob(g, cx, 98, 52, 54, '#040806'); R(g, cx - 52, 98, 105, 60, '#040806');
            for (var k = -6; k <= 6; k++) { var ang = Math.PI / 2 + k * 0.24; R(g, Math.round(cx + Math.cos(ang) * 55) - 2, Math.round(98 - Math.sin(ang) * 55) - 2, 4, 4, '#34483e'); }
            R(g, cx - 54, 140, 108, 12, '#0a1a10');
          }
          R(g, 0, 150, w, 6, '#2a3e34'); R(g, 0, 150, w, 1, '#3c5448'); R(g, 0, 156, w, BGH - 156, '#0c1a12');
        });
      }),
      layer(320, 0.5, function (g, w) {
        rep(g, w, function () {
          R(g, 0, 24, w, 9, '#1c2a24'); R(g, 0, 25, w, 2, '#34463c'); R(g, 0, 31, w, 2, '#0c1410');
          for (var x = 20; x < w; x += 64) { R(g, x, 22, 5, 13, '#2c3c34'); R(g, x, 22, 5, 1, '#46584c'); }
          var pipes = [[56, 34, 70], [200, 34, 96], [268, 34, 52]];
          for (var i = 0; i < pipes.length; i++) {
            var p = pipes[i];
            R(g, p[0], p[1], 10, p[2], '#1c2a24'); R(g, p[0] + 2, p[1], 2, p[2], '#34463c'); R(g, p[0] + 8, p[1], 2, p[2], '#0c1410');
            R(g, p[0] - 2, p[1] + p[2], 14, 6, '#24342c'); R(g, p[0] - 2, p[1] + p[2], 14, 1, '#46584c'); R(g, p[0], p[1] + p[2] + 4, 10, 2, '#040806');
            R(g, p[0] + 3, p[1] + p[2] + 6, 4, 150 - (p[1] + p[2] + 6), '#1c5c24'); R(g, p[0] + 4, p[1] + p[2] + 6, 1, 150 - (p[1] + p[2] + 6), '#2c7c30');
          }
          for (var c = 0; c < 2; c++) { var cx = 130 + c * 30; for (var y = 0; y < 50 + c * 14; y += 3) R(g, cx, y, 2, 2, '#141c18'); }
        });
      })
    ],
    anim: function (ctx, camX, camY, t, oy) {
      var mouths = [61, 205, 273], ly = [110, 136, 92];
      for (var i = 0; i < 3; i++) {
        var x = ((mouths[i] - camX * 0.5) % 320 + 320) % 320;
        for (var k = 0; k < 2; k++) {
          var ph = (t * 1.3 + i * 0.37 + k * 0.5) % 1;
          ctx.fillStyle = '#3c9c3c'; ctx.fillRect(Math.round(x + (k ? 3 : -3)), Math.round(oy + ly[i] + ph * 40), 1, 2);
        }
      }
    }
  };

  BG.cave = {
    sky: function (g) {
      bands(g, 320, 0, BGH, ['#0a0406', '#100608', '#14080a', '#180a0a', '#140808']);
      var r = rng(77);
      for (var i = 0; i < 60; i++) R(g, (r() * 320) | 0, (r() * BGH) | 0, 2 + ((r() * 6) | 0), 1, '#1c0c0c');
    },
    layers: [
      layer(384, 0.2, function (g, w) {
        rep(g, w, function () {
          var r = rng(11);
          for (var x = 0; x < w; x += 10 + ((r() * 14) | 0)) { var h = 20 + ((r() * 50) | 0); tri(g, x, 0, 8 + ((r() * 10) | 0), h, '#22100c', true); }
          for (x = 5; x < w; x += 14 + ((r() * 20) | 0)) { var h2 = 16 + ((r() * 40) | 0); tri(g, x, 172 - h2, 10 + ((r() * 12) | 0), h2, '#22100c'); }
          R(g, 0, 168, w, BGH - 168, '#22100c');
          for (var i = 0; i < 8; i++) { var cx = (r() * w) | 0, cy = 40 + ((r() * 110) | 0); P(g, cx, cy, '#3c2468'); P(g, cx, cy - 1, '#2c1c54'); P(g, cx + 1, cy, '#2c1c54'); }
        });
      }),
      layer(320, 0.45, function (g, w) {
        rep(g, w, function () {
          var r = rng(23);
          for (var x = 0; x < w; x += 16 + ((r() * 30) | 0)) { var h = 26 + ((r() * 46) | 0), ww = 12 + ((r() * 14) | 0); tri(g, x, 0, ww, h, '#140806', true); tri(g, x - 2, 0, 3, h - 6, '#2c160c', true); }
          for (x = 30; x < w; x += 70 + ((r() * 40) | 0)) { var h2 = 30 + ((r() * 40) | 0); tri(g, x, 182 - h2, 18, h2, '#140806'); }
          // mine supports + lanterns
          var bx = 100;
          R(g, bx, 60, 5, 130, '#24140a'); R(g, bx + 60, 60, 5, 130, '#24140a'); R(g, bx - 4, 56, 74, 6, '#2c180c'); R(g, bx - 4, 56, 74, 1, '#3c2210');
          R(g, bx + 30, 62, 1, 10, '#141414'); R(g, bx + 28, 72, 5, 6, '#3c2008');
          R(g, 0, 178, w, BGH - 178, '#140806');
        });
      })
    ],
    anim: function (ctx, camX, camY, t, oy) {
      var x = ((130 - camX * 0.45) % 320 + 320) % 320;
      var f = (Math.sin(t * 9) + Math.sin(t * 23)) > 0.4 ? 1 : 0;
      ctx.fillStyle = '#fca044'; ctx.globalAlpha = 0.07; ctx.beginPath(); ctx.arc(Math.round(x) + 1, Math.round(oy) + 75, 14 + f, 0, 6.283); ctx.fill();
      ctx.globalAlpha = 0.12; ctx.beginPath(); ctx.arc(Math.round(x) + 1, Math.round(oy) + 75, 7, 0, 6.283); ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillStyle = f ? '#f8d878' : '#fca044'; ctx.fillRect(Math.round(x) - 1, Math.round(oy) + 73, 3, 3);
      var r = rng(5);
      for (var i = 0; i < 10; i++) {
        var sx = ((r() * 384 - camX * 0.2) % 384 + 384) % 384, sy = 30 + r() * 130, ph = r() * 6;
        if (Math.sin(t * 2 + ph) > 0.85) { ctx.fillStyle = '#9878f8'; ctx.fillRect(Math.round(sx), Math.round(oy + sy), 1, 1); }
      }
    }
  };

  BG.city = {
    sky: function (g) {
      bands(g, 320, 0, 150, ['#0c0418', '#140624', '#1c0830', '#28103c', '#3c1448', '#501c50', '#5c2c4c']);
      R(g, 0, 150, 320, BGH - 150, '#5c2c4c');
      stars(g, 320, 110, 60, 3, ['#6c4c8c', '#9c84b8', '#d8b8f8']);
      blob(g, 262, 30, 14, 14, '#4c2c5c'); blob(g, 262, 30, 12, 12, '#6c4874'); blob(g, 258, 27, 4, 3, '#7c5c84'); P(g, 266, 34, '#5c3c64');
      for (var a = -24; a <= 24; a++) P(g, 262 + a, 30 + Math.round(a * 0.2), '#8c6c9c');
      blob(g, 36, 52, 5, 5, '#5c3c6c'); blob(g, 35, 51, 2, 2, '#7c5c8c');
    },
    layers: [
      layer(400, 0.18, function (g, w) {
        rep(g, w, function () { skyline(g, w, 120, 31, { minW: 14, maxW: 34, minH: 20, maxH: 70, col: '#1c1030', gap: 6, broken: true, antenna: true, win: '#3c2c48', winP: 0.12 }); });
      }),
      layer(320, 0.42, function (g, w) {
        rep(g, w, function () {
          skyline(g, w, 150, 57, { minW: 24, maxW: 52, minH: 28, maxH: 90, col: '#0e0818', gap: 18, broken: true, win: '#6c5c1c', winP: 0.07, rim: '#1c1428' });
          R(g, 0, 168, w, BGH - 168, '#0a0610');
          // a broken billboard
          R(g, 168, 90, 2, 40, '#0e0818'); R(g, 196, 94, 2, 36, '#0e0818'); R(g, 160, 74, 46, 20, '#0e0818'); R(g, 162, 76, 30, 16, '#2c1c3c'); R(g, 164, 80, 12, 2, '#5c4c6c');
        });
      })
    ],
    anim: function (ctx, camX, camY, t, oy) {
      // giant floating screen (the System AI is watching)
      var bob = Math.round(Math.sin(t * 0.8) * 2);
      var x = Math.round(((120 - camX * 0.08) % 400 + 400) % 400) - 40, y = 14 + bob + Math.round(oy * 0.5);
      if (x > 320) x -= 400;
      ctx.fillStyle = '#08040c'; ctx.fillRect(x - 2, y - 2, 84, 52);
      ctx.fillStyle = '#2c2434'; ctx.fillRect(x - 1, y - 1, 82, 50);
      var flick = Math.sin(t * 13) > 0.92;
      ctx.fillStyle = flick ? '#18404c' : '#0a2c40'; ctx.fillRect(x + 2, y + 2, 76, 44);
      ctx.fillStyle = '#10465a'; for (var sl = 0; sl < 44; sl += 3) ctx.fillRect(x + 2, y + 2 + ((sl + Math.floor(t * 20)) % 44), 76, 1);
      ctx.fillStyle = '#2c8cbc';
      ctx.fillRect(x + 24, y + 14, 6, 6); ctx.fillRect(x + 50, y + 14, 6, 6);
      ctx.fillRect(x + 22, y + 30, 36, 2); ctx.fillRect(x + 20, y + 27, 3, 3); ctx.fillRect(x + 57, y + 27, 3, 3);
      ctx.fillStyle = '#7cc4e4'; ctx.fillRect(x + 25, y + 15, 2, 2); ctx.fillRect(x + 51, y + 15, 2, 2);
      ctx.fillStyle = '#1c1428'; ctx.fillRect(x + 36, y + 48, 8, 4); ctx.fillRect(x + 10, y + 48, 4, 3); ctx.fillRect(x + 66, y + 48, 4, 3);
      if (Math.floor(t * 2) % 2) { ctx.fillStyle = '#f83800'; ctx.fillRect(x + 11, y + 51, 2, 2); ctx.fillRect(x + 67, y + 51, 2, 2); }
      ctx.globalAlpha = 0.07; ctx.fillStyle = '#3cbcfc'; ctx.fillRect(x - 8, y - 8, 96, 64); ctx.globalAlpha = 1;
      // red blinkers on far towers
      if (Math.floor(t * 1.5) % 2) {
        ctx.fillStyle = '#a81000';
        for (var i = 0; i < 4; i++) { var bx = (((i * 97 + 30) - camX * 0.18) % 400 + 400) % 400; ctx.fillRect(Math.round(bx), Math.round(oy) + 62 + (i * 13) % 30, 1, 1); }
      }
    }
  };

  BG.circus = {
    sky: function (g) {
      for (var x = 0; x < 320; x += 20) { R(g, x, 0, 10, BGH, '#3a0c18'); R(g, x + 10, 0, 10, BGH, '#2c2418'); }
      g.globalAlpha = 0.5; R(g, 0, 0, 320, 30, '#0a0206'); g.globalAlpha = 0.3; R(g, 0, 30, 320, 30, '#0a0206'); g.globalAlpha = 1;
      for (x = 0; x < 320; x += 40) { for (var k = 0; k < 40; k++) { var yy = 60 + Math.round(Math.sin(k / 40 * Math.PI) * 8); R(g, x + k, yy, 1, 2, '#4c1420'); } }
      R(g, 0, 0, 320, 4, '#14040a');
    },
    layers: [
      layer(320, 0.22, function (g, w) {
        rep(g, w, function () {
          R(g, 60, 0, 6, BGH, '#1c0810'); R(g, 61, 0, 1, BGH, '#2c1018'); R(g, 220, 0, 6, BGH, '#1c0810'); R(g, 221, 0, 1, BGH, '#2c1018');
          var cols = ['#7c1c1c', '#1c4c7c', '#7c6c1c', '#1c6c2c'];
          for (var s = 0; s < 2; s++) {
            var x0 = 63 + s * 160, sag = 26;
            for (var k = 0; k <= 160; k++) { var y = 20 + s * 8 + Math.round(Math.sin(k / 160 * Math.PI) * sag); P(g, x0 + k, y, '#3c2c24'); if (k % 10 === 5) { tri(g, x0 + k, y + 1, 6, 6, cols[(k / 10 | 0) % 4], true); } }
          }
        });
      }),
      layer(320, 0.5, function (g, w) {
        rep(g, w, function () {
          for (var row = 0; row < 5; row++) {
            var y = 120 + row * 13;
            R(g, 0, y, w, BGH - y, row & 1 ? '#160812' : '#1c0a16'); R(g, 0, y, w, 1, '#2c1020');
            var r = rng(row * 13 + 3);
            for (var x = 2; x < w; x += 7 + ((r() * 4) | 0)) { if (r() < 0.82) { blob(g, x, y - 3, 3, 3, '#24101c'); R(g, x - 3, y - 1, 7, 2, '#24101c'); if (r() < 0.1) { P(g, x - 1, y - 4, '#5c4c3c'); P(g, x + 1, y - 4, '#5c4c3c'); } } }
          }
        });
      })
    ],
    anim: function (ctx, camX, camY, t, oy) {
      var cols = ['#f83800', '#f8b800', '#3cbcfc', '#58d854', '#f878f8'];
      for (var s = 0; s < 2; s++) {
        var x0 = 63 + s * 160;
        for (var k = 0; k < 160; k += 8) {
          var sx = ((x0 + k - camX * 0.22) % 320 + 320) % 320;
          var y = 20 + s * 8 + Math.round(Math.sin(k / 160 * Math.PI) * 26);
          var on = ((k / 8 | 0) + Math.floor(t * 4)) % 3 !== 0;
          ctx.fillStyle = on ? cols[(k / 8 | 0) % 5] : '#3c2c24';
          ctx.fillRect(Math.round(sx), Math.round(oy + y), 2, 2);
        }
      }
      // sweeping spotlight
      var ang = Math.sin(t * 0.6) * 0.5;
      ctx.globalAlpha = 0.06; ctx.fillStyle = '#f8f8d8';
      ctx.beginPath(); ctx.moveTo(160, -4); ctx.lineTo(160 + Math.sin(ang - 0.15) * 260, 200); ctx.lineTo(160 + Math.sin(ang + 0.15) * 260, 200); ctx.closePath(); ctx.fill();
      ctx.globalAlpha = 1;
    }
  };

  BG.swamp = {
    sky: function (g) {
      bands(g, 320, 0, 140, ['#060c06', '#0a1208', '#0e180a', '#121e0c', '#182610', '#1e2e14']);
      R(g, 0, 140, 320, BGH - 140, '#1e2e14');
      g.globalAlpha = 0.25; blob(g, 230, 46, 26, 26, '#4c5c34'); g.globalAlpha = 1;
      blob(g, 230, 46, 15, 15, '#5c6c40'); blob(g, 226, 42, 4, 3, '#6c7c4c'); P(g, 234, 50, '#4c5c34');
    },
    layers: [
      layer(400, 0.18, function (g, w) {
        rep(g, w, function () {
          var r = rng(41);
          R(g, 0, 128, w, BGH - 128, '#101a0a');
          for (var x = 0; x < w; x += 6) { var h = 4 + ((r() * 10) | 0); R(g, x, 128 - h, 6, h, '#101a0a'); }
          for (x = 10; x < w; x += 40 + ((r() * 40) | 0)) deadTree(g, x, 130, 40 + ((r() * 30) | 0), '#101a0a', r);
        });
      }),
      layer(320, 0.45, function (g, w) {
        rep(g, w, function () {
          var r = rng(43);
          for (var x = 30; x < w; x += 90 + ((r() * 60) | 0)) {
            deadTree(g, x, 172, 90 + ((r() * 40) | 0), '#080e04', r);
            for (var m = 0; m < 6; m++) { var mx = x - 30 + ((r() * 60) | 0), my = 70 + ((r() * 40) | 0); R(g, mx, my, 1, 6 + ((r() * 12) | 0), '#18260c'); }
          }
          R(g, 0, 172, w, BGH - 172, '#080e04');
          for (x = 0; x < w; x += 3 + ((r() * 5) | 0)) { var h = 8 + ((r() * 20) | 0); R(g, x, 172 - h, 1, h, '#0c1406'); if (r() < 0.3) R(g, x - 1, 172 - h, 3, 4, '#2c1c08'); }
        });
      })
    ],
    fog: null,
    anim: function (ctx, camX, camY, t, oy) {
      var fog = BG.swamp.fog;
      if (!fog) {
        fog = BG.swamp.fog = mkCanvas(320, 24); var fg = g2(fog), r = rng(9);
        for (var i = 0; i < 28; i++) { var x = (r() * 320) | 0, y = 8 + ((r() * 8) | 0); rep(fg, 320, function () { blob(fg, x, y, 14 + ((r() * 10) | 0), 4 + ((r() * 3) | 0), '#7c8c6c'); }); }
      }
      ctx.globalAlpha = 0.16;
      for (var b = 0; b < 2; b++) {
        var ox = Math.floor(((camX * (0.3 + b * 0.3) + t * (6 + b * 5)) % 320 + 320) % 320);
        for (var xx = -ox; xx < 320; xx += 320) ctx.drawImage(fog, xx, Math.round(oy) + 118 + b * 36);
      }
      ctx.globalAlpha = 1;
      for (var k = 0; k < 3; k++) { // will-o-wisps
        var wx = ((k * 120 + 40 - camX * 0.45 + Math.sin(t * 0.7 + k) * 20) % 320 + 320) % 320, wy = 120 + Math.sin(t * 1.3 + k * 2) * 10;
        if (Math.sin(t * 3 + k) > -0.3) { ctx.fillStyle = '#88c800'; ctx.fillRect(Math.round(wx), Math.round(oy + wy), 2, 2); ctx.globalAlpha = 0.25; ctx.fillRect(Math.round(wx) - 2, Math.round(oy + wy) - 2, 6, 6); ctx.globalAlpha = 1; }
      }
    }
  };

  BG.train = {
    sky: function (g) {
      bands(g, 320, 0, 120, ['#100818', '#1c0c24', '#2c1028', '#44182a', '#5c2428', '#743424', '#8c4c20']);
      R(g, 0, 120, 320, BGH - 120, '#8c4c20');
      blob(g, 90, 112, 16, 16, '#a86420'); blob(g, 90, 112, 13, 13, '#c47c28'); for (var y = 100; y < 126; y += 4) R(g, 74, y, 34, 1, '#8c4c20');
      stars(g, 320, 50, 30, 8, ['#4c3c5c', '#6c5c7c']);
    },
    layers: [
      layer(480, 0.05, function (g, w) {
        rep(g, w, function () {
          var r = rng(61), y = 110;
          for (var x = 0; x < w; x++) { if (x % 3 === 0) y += Math.round((r() - 0.5) * 6); y = Math.max(70, Math.min(120, y)); R(g, x, y, 1, BGH - y, '#3c1828'); }
          for (x = 0; x < w; x += 2) { var yy = 124 + Math.round(Math.sin(x / 30) * 4); R(g, x, yy, 2, BGH - yy, '#2c1020'); }
        });
      }, { speed: 14 }),
      layer(320, 0.3, function (g, w) {
        rep(g, w, function () {
          for (var x = 0; x < w; x++) { var y = 140 + Math.round(Math.sin(x / 50) * 6 + Math.sin(x / 13) * 2); R(g, x, y, 1, BGH - y, '#1c0c14'); }
          for (x = 20; x < w; x += 80) {
            R(g, x, 96, 2, 50, '#14080e'); R(g, x - 6, 100, 14, 2, '#14080e'); R(g, x - 4, 106, 10, 1, '#14080e');
            for (var k = 0; k < 80; k++) P(g, x + k, 101 + Math.round(Math.sin(k / 80 * Math.PI) * 6), '#24101a');
          }
        });
      }, { speed: 160 }),
      layer(256, 0.8, function (g, w) {
        rep(g, w, function () {
          var r = rng(63);
          R(g, 0, 166, w, BGH - 166, '#160a0a');
          for (var i = 0; i < 26; i++) { var y = 168 + ((r() * 30) | 0); R(g, (r() * w) | 0, y, 10 + ((r() * 40) | 0), 1, r() < 0.5 ? '#2c1810' : '#24140e'); }
          for (var x = 0; x < w; x += 64) { R(g, x, 150, 3, 20, '#0c0606'); }
        });
      }, { speed: 700 })
    ]
  };

  BG.bubble = {
    sky: function (g) {
      bands(g, 320, 0, BGH, ['#0c3058', '#0a2850', '#082248', '#061c40', '#041838', '#041430', '#031028']);
    },
    rays: null,
    layers: [
      layer(400, 0.18, function (g, w) {
        rep(g, w, function () {
          var r = rng(71);
          for (var x = 0; x < w; x += 3) { var h = 20 + Math.round(Math.sin(x / 37) * 10 + Math.sin(x / 11) * 4); R(g, x, 170 - h, 3, BGH, '#06223c'); }
          for (x = 20; x < w; x += 70 + ((r() * 50) | 0)) { blob(g, x, 140, 18, 30, '#06223c'); blob(g, x, 150, 10, 16, '#041830'); }
        });
      }),
      layer(320, 0.42, function (g, w) {
        rep(g, w, function () {
          var r = rng(73);
          for (var k = 0; k < 9; k++) {
            var x = (r() * w) | 0, h = 60 + ((r() * 70) | 0), ph = r() * 6;
            for (var y = 0; y < h; y++) { var sx = x + Math.round(Math.sin(y / 9 + ph) * 3); R(g, sx, 190 - y, 3, 1, '#05302a'); if (y % 9 === 4) R(g, sx + 3, 190 - y, 3, 2, '#05302a'); }
          }
          for (k = 0; k < 4; k++) { var fx = 30 + k * 80 + ((r() * 30) | 0); for (var b = 0; b < 7; b++) line(g, fx, 186, fx - 14 + b * 5, 156 + Math.abs(b - 3) * 4, '#2a0c34'); }
          R(g, 0, 184, w, BGH - 184, '#041018');
        });
      })
    ],
    anim: function (ctx, camX, camY, t, oy) {
      ctx.globalAlpha = 0.06; ctx.fillStyle = '#a4e4fc';
      for (var i = 0; i < 5; i++) {
        var x0 = ((i * 74 + 20 - camX * 0.1) % 370 + 370) % 370 - 30 + Math.sin(t * 0.5 + i) * 6;
        ctx.beginPath(); ctx.moveTo(x0, -2); ctx.lineTo(x0 + 18, -2); ctx.lineTo(x0 + 70, 190); ctx.lineTo(x0 + 40, 190); ctx.closePath(); ctx.fill();
      }
      ctx.globalAlpha = 1;
      var r = rng(19);
      for (i = 0; i < 16; i++) {
        var bx = r() * 320, sp = 14 + r() * 20, ph = r() * 200, sz = r() < 0.3 ? 2 : 1;
        var y = 196 - ((t * sp + ph) % 210);
        var x = ((bx - camX * 0.3 + Math.sin(t * 2 + ph) * 3) % 320 + 320) % 320;
        ctx.fillStyle = '#3c7cbc';
        if (sz === 2) { ctx.fillRect(Math.round(x) - 1, Math.round(oy + y) - 2, 3, 1); ctx.fillRect(Math.round(x) - 2, Math.round(oy + y) - 1, 1, 3); ctx.fillRect(Math.round(x) + 2, Math.round(oy + y) - 1, 1, 3); ctx.fillRect(Math.round(x) - 1, Math.round(oy + y) + 2, 3, 1); ctx.fillStyle = '#a4e4fc'; ctx.fillRect(Math.round(x) - 1, Math.round(oy + y) - 1, 1, 1); }
        else ctx.fillRect(Math.round(x), Math.round(oy + y), 1, 1);
      }
    }
  };

  BG.forest = {
    sky: function (g) {
      bands(g, 320, 0, 150, ['#02020e', '#040616', '#060a1e', '#0a0e28', '#0e1430', '#121a38']);
      R(g, 0, 150, 320, BGH - 150, '#121a38');
      stars(g, 320, 120, 90, 4, ['#4c5480', '#8c94b8', '#c8c8e0']);
      g.globalAlpha = 0.2; blob(g, 84, 44, 26, 26, '#8c8c74'); g.globalAlpha = 1;
      blob(g, 84, 44, 17, 17, '#c8c4a4'); blob(g, 78, 40, 4, 3, '#aca88c'); blob(g, 90, 50, 3, 3, '#aca88c'); blob(g, 92, 38, 2, 2, '#aca88c');
    },
    layers: [
      layer(400, 0.15, function (g, w) {
        rep(g, w, function () { var r = rng(81); R(g, 0, 140, w, BGH, '#0c1c2c'); for (var x = 0; x < w; x += 7 + ((r() * 8) | 0)) pine(g, x, 146, 26 + ((r() * 26) | 0), '#0c1c2c'); });
      }),
      layer(320, 0.35, function (g, w) {
        rep(g, w, function () { var r = rng(83); R(g, 0, 160, w, BGH, '#081420'); for (var x = 0; x < w; x += 14 + ((r() * 16) | 0)) pine(g, x, 166, 50 + ((r() * 40) | 0), '#081420', '#0c1c2c'); });
      }),
      layer(320, 0.6, function (g, w) {
        rep(g, w, function () { var r = rng(87); R(g, 0, 182, w, BGH, '#030a0c'); for (var x = 0; x < w; x += 40 + ((r() * 50) | 0)) pine(g, x, 190, 90 + ((r() * 50) | 0), '#030a0c'); });
      })
    ],
    anim: function (ctx, camX, camY, t, oy) {
      var r = rng(29);
      for (var i = 0; i < 12; i++) {
        var bx = r() * 320, by = 100 + r() * 70, ph = r() * 7;
        if (Math.sin(t * 2.2 + ph) < 0.2) continue;
        var x = ((bx - camX * 0.5 + Math.sin(t * 0.5 + ph) * 12) % 320 + 320) % 320, y = by + Math.sin(t * 0.9 + ph) * 6;
        ctx.fillStyle = '#d8f878'; ctx.fillRect(Math.round(x), Math.round(oy + y), 1, 1);
        ctx.globalAlpha = 0.25; ctx.fillRect(Math.round(x) - 1, Math.round(oy + y) - 1, 3, 3); ctx.globalAlpha = 1;
      }
    }
  };

  BG.castle = {
    sky: function (g) {
      R(g, 0, 0, 320, BGH, '#0a0610');
      for (var row = 0; row < 17; row++) for (var bx = -24; bx < 320; bx += 24) { var x = bx + (row & 1 ? 12 : 0); R(g, x, row * 12, 23, 11, (row * 7 + bx) % 5 ? '#140c1c' : '#170e20'); R(g, x, row * 12, 23, 1, '#1c1428'); }
    },
    layers: [
      layer(320, 0.22, function (g, w) {
        rep(g, w, function () {
          for (var k = 0; k < 2; k++) {
            var cx = 80 + k * 160, top = 22, ww = 40, hh = 100;
            blob(g, cx, top + 20, 24, 24, '#2c2038'); R(g, cx - 24, top + 20, 49, hh, '#2c2038');
            blob(g, cx, top + 20, 20, 20, '#121a3c'); R(g, cx - 20, top + 20, 41, hh - 4, '#121a3c');
            R(g, cx - 1, top, 2, hh + 16, '#2c2038'); R(g, cx - 20, top + 50, 41, 2, '#2c2038'); R(g, cx - 20, top + 84, 41, 2, '#2c2038');
            R(g, cx - 12, top + 10, 1, hh, '#1c2048'); R(g, cx + 11, top + 10, 1, hh, '#1c2048');
            R(g, cx - 17, top + 24, 6, 20, '#1c2c5c'); R(g, cx + 5, top + 56, 6, 22, '#1c2c5c');
            R(g, cx - 28, top + 6, 8, hh + 14, '#3c0818'); R(g, cx + 21, top + 6, 8, hh + 14, '#3c0818'); R(g, cx - 26, top + 6, 1, hh + 14, '#580c20'); R(g, cx + 23, top + 6, 1, hh + 14, '#580c20');
            R(g, cx - 30, top + 2, 61, 4, '#24182c'); R(g, cx - 26, top + hh + 16, 53, 4, '#24182c');
          }
        });
      }),
      layer(320, 0.48, function (g, w) {
        rep(g, w, function () {
          for (var x = 0; x < w; x += 160) {
            R(g, x, 0, 18, BGH, '#0e0814'); R(g, x + 2, 0, 2, BGH, '#1c1426'); R(g, x - 4, 40, 26, 6, '#0e0814'); R(g, x - 4, 150, 26, 8, '#0e0814');
            R(g, x + 30, 30, 22, 46, '#2c0610'); tri(g, x + 41, 76, 22, 6, '#2c0610', true); R(g, x + 38, 44, 6, 8, '#5c4810'); R(g, x + 30, 30, 22, 2, '#4c3c0c');
            R(g, x + 120, 120, 3, 60, '#0e0814'); R(g, x + 112, 118, 19, 2, '#0e0814'); R(g, x + 112, 114, 2, 4, '#0e0814'); R(g, x + 121, 112, 2, 6, '#0e0814'); R(g, x + 129, 114, 2, 4, '#0e0814');
            R(g, x + 112, 112, 2, 2, '#c8c0a0'); R(g, x + 121, 110, 2, 2, '#c8c0a0'); R(g, x + 129, 112, 2, 2, '#c8c0a0');
          }
        });
      })
    ],
    anim: function (ctx, camX, camY, t, oy) {
      var fl = [[112, 109], [121, 107], [129, 109]];
      for (var b = 0; b < 2; b++) {
        var base = ((b * 160 - camX * 0.48) % 320 + 320) % 320;
        for (var i = 0; i < 3; i++) {
          var x = Math.round(base + fl[i][0]) % 320, y = Math.round(oy + fl[i][1]);
          var f = (Math.sin(t * 11 + i * 2 + b) + Math.sin(t * 17 + i)) > 0 ? 1 : 0;
          ctx.fillStyle = '#fca044'; ctx.globalAlpha = 0.08; ctx.beginPath(); ctx.arc(x + 1, y - 1, 9 + f, 0, 6.283); ctx.fill();
          ctx.globalAlpha = 0.12; ctx.beginPath(); ctx.arc(x + 1, y - 1, 5, 0, 6.283); ctx.fill(); ctx.globalAlpha = 1;
          ctx.fillStyle = '#fca044'; ctx.fillRect(x, y - 1 - f, 2, 2 + f); ctx.fillStyle = '#f8d878'; ctx.fillRect(x, y, 1, 1);
        }
      }
    }
  };

  BG.ruin = {
    sky: function (g) {
      bands(g, 320, 0, 130, ['#1c0c06', '#2c1408', '#3c1c0a', '#4c240c', '#5c2e10', '#6c3814', '#7c4418']);
      R(g, 0, 130, 320, BGH - 130, '#7c4418');
      g.globalAlpha = 0.3; blob(g, 200, 70, 36, 36, '#a85c24'); g.globalAlpha = 1;
      blob(g, 200, 70, 22, 22, '#b86c2c'); for (var y = 56; y < 92; y += 5) R(g, 176, y, 48, 1, '#9c5420');
    },
    layers: [
      layer(400, 0.15, function (g, w) {
        rep(g, w, function () { skyline(g, w, 130, 91, { minW: 10, maxW: 26, minH: 30, maxH: 96, col: '#4c2410', gap: 30, broken: true }); R(g, 0, 140, w, BGH, '#4c2410'); });
      }),
      layer(320, 0.42, function (g, w) {
        rep(g, w, function () {
          var r = rng(93);
          for (var x = 0; x < w; x += 2) { var y = 160 + Math.round(Math.sin(x / 23) * 8 + Math.sin(x / 7) * 2); R(g, x, y, 2, BGH, '#2c1408'); }
          for (var k = 0; k < 4; k++) {
            var gx = 20 + k * 80 + ((r() * 20) | 0), gh = 30 + ((r() * 40) | 0);
            R(g, gx, 160 - gh, 4, gh, '#2c1408'); line(g, gx + 2, 160 - gh, gx + 18, 150 - gh, '#2c1408'); line(g, gx + 2, 161 - gh, gx + 18, 151 - gh, '#2c1408');
            R(g, gx + 1, 166 - gh, 2, 2, '#4c2410'); R(g, gx + 1, 176 - gh, 2, 2, '#4c2410');
          }
          R(g, 140, 120, 30, 16, '#2c1408'); R(g, 142, 122, 26, 12, '#4c2a14'); R(g, 150, 136, 2, 30, '#2c1408');
        });
      })
    ],
    anim: function (ctx, camX, camY, t, oy) {
      var r = rng(39);
      ctx.fillStyle = '#c87838';
      for (var i = 0; i < 18; i++) {
        var x = ((r() * 320 - camX * 0.6 - t * (10 + r() * 20)) % 320 + 320) % 320, y = r() * 180 + Math.sin(t + i) * 4;
        ctx.fillRect(Math.round(x), Math.round(y), 1, 1);
      }
      ctx.globalAlpha = 0.07 + Math.sin(t * 0.7) * 0.03; ctx.fillStyle = '#e45c10'; ctx.fillRect(0, Math.round(oy) + 100, 320, 60); ctx.globalAlpha = 1;
    }
  };

  BG.warzone = {
    sky: function (g) {
      bands(g, 320, 0, 140, ['#080202', '#100404', '#180606', '#200808', '#2c0c08', '#3c140a', '#4c1c0c']);
      R(g, 0, 140, 320, BGH - 140, '#4c1c0c');
      var r = rng(101);
      g.globalAlpha = 0.5;
      for (var i = 0; i < 18; i++) rep(g, 320, function () { blob(g, (r() * 320) | 0, 10 + ((r() * 70) | 0), 20 + ((r() * 30) | 0), 6 + ((r() * 8) | 0), '#1c0a08'); });
      g.globalAlpha = 1;
    },
    layers: [
      layer(400, 0.2, function (g, w) {
        rep(g, w, function () {
          skyline(g, w, 140, 103, { minW: 16, maxW: 40, minH: 16, maxH: 60, col: '#1c0a06', gap: 20, broken: true });
          R(g, 0, 150, w, BGH, '#1c0a06');
          var r = rng(107);
          for (var i = 0; i < 6; i++) { var x = (r() * w) | 0, y = 120 + ((r() * 30) | 0); R(g, x, y, 3, 2, '#c84c10'); P(g, x + 1, y - 1, '#f8b800'); }
        });
      }),
      layer(320, 0.5, function (g, w) {
        rep(g, w, function () {
          R(g, 0, 176, w, BGH, '#0c0604');
          for (var x = 0; x < w; x += 40) { R(g, x, 146, 2, 34, '#0c0604'); }
          for (var s = 0; s < 3; s++) for (x = 0; x < w; x++) { var y = 152 + s * 8 + Math.round(Math.sin((x % 40) / 40 * Math.PI) * 3); P(g, x, y, '#1c1410'); if (x % 5 === 0) { P(g, x, y - 1, '#1c1410'); P(g, x, y + 1, '#1c1410'); } }
          for (var k = 0; k < 3; k++) { var tx = 30 + k * 110; line(g, tx - 7, 186, tx + 7, 168, '#140a06'); line(g, tx + 7, 186, tx - 7, 168, '#140a06'); line(g, tx - 6, 186, tx + 8, 168, '#140a06'); line(g, tx + 8, 186, tx - 6, 168, '#140a06'); }
          for (k = 0; k < 2; k++) { var sx = 70 + k * 160; for (var b = 0; b < 4; b++) { blob(g, sx + b * 9, 176, 5, 3, '#1c140c'); } for (b = 0; b < 3; b++) blob(g, sx + 4 + b * 9, 171, 5, 3, '#1c140c'); }
        });
      })
    ],
    anim: function (ctx, camX, camY, t, oy) {
      // searchlights
      ctx.globalAlpha = 0.07; ctx.fillStyle = '#f8f8c8';
      for (var i = 0; i < 2; i++) {
        var bx = ((i * 190 + 80 - camX * 0.2) % 400 + 400) % 400 - 40, ang = Math.sin(t * 0.45 + i * 2.1) * 0.7;
        var by = Math.round(oy) + 150;
        ctx.beginPath(); ctx.moveTo(bx - 2, by); ctx.lineTo(bx + 2, by);
        ctx.lineTo(bx + Math.sin(ang + 0.09) * 220, by - Math.cos(ang + 0.09) * 220); ctx.lineTo(bx + Math.sin(ang - 0.09) * 220, by - Math.cos(ang - 0.09) * 220); ctx.closePath(); ctx.fill();
      }
      ctx.globalAlpha = 1;
      // distant explosions
      var period = 1.9, n = Math.floor(t / period), ph = (t % period) / period;
      if (ph < 0.35) {
        var hr = hash2(n, 77);
        var ex = ((hr % 400) - camX * 0.2) % 400; ex = ((ex % 400) + 400) % 400 - 40;
        var ey = Math.round(oy) + 128 + (hr >> 9) % 18, rad = 2 + Math.round(ph * 30);
        ctx.globalAlpha = (0.35 - ph) * 2.4; ctx.fillStyle = '#fca044';
        ctx.beginPath(); ctx.arc(ex, ey, rad, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#f8d878'; ctx.beginPath(); ctx.arc(ex, ey, rad * 0.5, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = (0.35 - ph) * 0.3; ctx.fillStyle = '#f83800'; ctx.fillRect(0, ey - 40, 320, 60);
        ctx.globalAlpha = 1;
      }
      // smoke plumes from fires
      for (i = 0; i < 3; i++) {
        var fx = ((i * 133 + 50 - camX * 0.2) % 400 + 400) % 400 - 40;
        for (var k = 0; k < 5; k++) {
          var q = (t * 0.25 + k / 5 + i * 0.3) % 1;
          ctx.globalAlpha = 0.18 * (1 - q); ctx.fillStyle = '#3c3030';
          var sr = 3 + q * 10; ctx.beginPath(); ctx.arc(fx + q * 14, Math.round(oy) + 128 - q * 90, sr, 0, Math.PI * 2); ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
    }
  };

  BG.safe = {
    sky: function (g) {
      for (var x = 0; x < 320; x += 8) { R(g, x, 0, 4, 110, '#132a22'); R(g, x + 4, 0, 4, 110, '#10241e'); P(g, x + 2, (x * 3) % 100 + 4, '#1c3c30'); }
      R(g, 0, 104, 320, 6, '#3c1c0c'); R(g, 0, 104, 320, 1, '#6c3418'); R(g, 0, 109, 320, 1, '#1c0c04');
      R(g, 0, 110, 320, BGH - 110, '#2c1408');
      for (x = 4; x < 320; x += 40) { R(g, x, 118, 32, 46, '#1c0c04'); R(g, x + 1, 119, 30, 44, '#3c1c0a'); R(g, x + 1, 119, 30, 1, '#4c240c'); }
      R(g, 0, 170, 320, BGH - 170, '#1c0c04');
    },
    neon: null,
    layers: [
      layer(320, 0.3, function (g, w) {
        rep(g, w, function () {
          var bc = ['#5c1c1c', '#1c5c2c', '#7c6c1c', '#2c3c7c', '#6c2c6c', '#7c4c1c'];
          for (var s = 0; s < 2; s++) {
            var sx = 180 + s * 0, sy = 40 + s * 30;
            R(g, sx, sy, 120, 3, '#4c240c'); R(g, sx, sy, 120, 1, '#7c4018'); R(g, sx + 4, sy + 3, 2, 4, '#2c1408'); R(g, sx + 112, sy + 3, 2, 4, '#2c1408');
            for (var b = 0; b < 13; b++) {
              var bx = sx + 4 + b * 9, bh = 8 + ((b * 7 + s * 3) % 5), c = bc[(b + s * 2) % bc.length];
              R(g, bx, sy - bh, 5, bh, c); R(g, bx + 1, sy - bh - 3, 3, 3, c); R(g, bx + 1, sy - bh + 2, 1, bh - 4, '#8c8c8c');
            }
          }
          // framed picture of a very important cat
          R(g, 30, 40, 34, 28, '#7c5c18'); R(g, 32, 42, 30, 24, '#1c2c3c');
          blob(g, 47, 56, 8, 6, '#c8c8c8'); blob(g, 47, 50, 5, 4, '#c8c8c8'); P(g, 43, 46, '#c8c8c8'); P(g, 51, 46, '#c8c8c8'); P(g, 45, 50, '#2c5c2c'); P(g, 49, 50, '#2c5c2c');
          R(g, 43, 43, 9, 2, '#a88c18'); P(g, 45, 42, '#a88c18'); P(g, 47, 41, '#a88c18'); P(g, 49, 42, '#a88c18');
        });
      })
    ],
    anim: function (ctx, camX, camY, t, oy) {
      var B = BG.safe;
      if (!B.neon && DCW.text) {
        B.neon = [];
        for (var v = 0; v < 2; v++) {
          var cv = mkCanvas(84, 22), g = g2(cv), old = DCW.ctx;
          DCW.ctx = g;
          try {
            R(g, 1, 1, 82, 20, '#140808');
            var col = v ? '#f85898' : '#3c1828', glow = v ? '#880c40' : '#200c14';
            R(g, 2, 2, 80, 1, glow); R(g, 2, 19, 80, 1, glow); R(g, 2, 2, 1, 18, glow); R(g, 81, 2, 1, 18, glow);
            DCW.text('SAFE ROOM', 42, 8, glow, { align: 'center', shadow: null });
            DCW.text('SAFE ROOM', 41, 7, col, { align: 'center', shadow: null });
          } catch (e) { /* font not ready */ }
          DCW.ctx = old;
          B.neon.push(cv);
        }
      }
      var x = Math.round(((70 - camX * 0.3) % 320 + 320) % 320) - 0;
      var on = !((Math.sin(t * 7.3) > 0.97 && Math.sin(t * 0.9) > 0.3) || (t % 7 > 6.7 && Math.sin(t * 40) > 0));
      if (B.neon) {
        for (var k = -1; k <= 0; k++) {
          var xx = x + k * 320;
          if (xx > 320 || xx + 84 < 0) continue;
          if (on) { ctx.globalAlpha = 0.12; ctx.fillStyle = '#f85898'; ctx.fillRect(xx - 8, Math.round(oy) + 72, 100, 38); ctx.globalAlpha = 1; }
          ctx.drawImage(B.neon[on ? 1 : 0], xx, Math.round(oy) + 80);
        }
      }
    }
  };

  var bgCache = {};
  function buildBg(theme) {
    var spec = BG[theme];
    var b = { spec: spec, sky: mkCanvas(320, BGH), layers: [] };
    spec.sky(g2(b.sky), 320, BGH);
    for (var i = 0; i < spec.layers.length; i++) {
      var L = spec.layers[i], cv = mkCanvas(L.w, BGH);
      L.draw(g2(cv), L.w, BGH);
      b.layers.push({ cv: cv, L: L });
    }
    bgCache[theme] = b;
    return b;
  }
  art.background = function (ctx, theme, camX, camY) {
    if (!BG[theme]) theme = 'sewer';
    var b = bgCache[theme] || buildBg(theme);
    camX = camX || 0; camY = camY || 0;
    var t = DCW.t || 0;
    var cy = camY < 0 ? 0 : camY > 160 ? 160 : camY;
    ctx.drawImage(b.sky, 0, -Math.round(cy * 0.06));
    var oyLast = 0;
    for (var i = 0; i < b.layers.length; i++) {
      var Ly = b.layers[i], L = Ly.L, w = L.w;
      var ox = Math.floor(((camX * L.rate + t * L.speed) % w + w) % w);
      var oy = -Math.round(Math.min(BGH - 180, cy * L.rate * 0.5));
      for (var x = -ox; x < 320; x += w) ctx.drawImage(Ly.cv, x, oy);
      oyLast = oy;
    }
    if (b.spec.anim) b.spec.anim(ctx, camX, camY, t, oyLast);
  };
  // optional: pre-build a theme's background layers (e.g. on stage enter) to avoid a first-frame hitch
  art.prepare = function (theme) { if (BG[theme] && !bgCache[theme]) buildBg(theme); };

  /* =====================================================================
     OVERWORLD TILES  (top-down 16x16: # . , = ~ T)
     ===================================================================== */
  var OW = {
    ow_city: {
      ground: { k: 'pave', base: '#7c7c7c', a: '#888888', s: '#5c5c5c' },
      decor: { k: 'grass', base: '#3c6c1c', a: '#58a028', s: '#284c10', x: '#f8d878' },
      road: { k: 'asphalt', base: '#3c3c40', a: '#48484c', s: '#2c2c30', line: '#f8b800', edge: '#9c9c9c' },
      block: { k: 'building', roof: '#5c5c64', rh: '#8c8c94', rs: '#3c3c44', front: '#a81000', fh: '#e45c10', fs: '#581000', win: '#202838', lit: '#f8d878' },
      water: { k: 'water', d: '#0028a0', m: '#0058f8', l: '#3cbcfc', x: '#a4e4fc', shore: '#5c5c5c' },
      tree: { k: 'round', d: '#005800', m: '#00a800', l: '#58d854', t: '#503000' }
    },
    ow_rail: {
      ground: { k: 'gravel', base: '#6c5c4c', a: '#887868', s: '#4c3c30' },
      decor: { k: 'grass', base: '#6c6c2c', a: '#9c9c3c', s: '#4c4c1c', x: '#c8c858' },
      road: { k: 'rail', base: '#5c4c3c', a: '#7c5c34', s: '#3c2c1c', line: '#bcbcbc', edge: '#7c7c7c' },
      block: { k: 'warehouse', roof: '#7c3c1c', rh: '#a85c2c', rs: '#4c200c', front: '#5c5c5c', fh: '#8c8c8c', fs: '#2c2c2c', win: '#202020', lit: '#f8b800' },
      water: { k: 'oil', d: '#08080c', m: '#18141c', l: '#3c2c4c', x: '#6c4c7c', shore: '#3c3028' },
      tree: { k: 'crates', d: '#503000', m: '#ac7c00', l: '#fca044', t: '#3c3c3c' }
    },
    ow_reef: {
      ground: { k: 'sand', base: '#e4c088', a: '#fce0a8', s: '#c09c68' },
      decor: { k: 'weed', base: '#d8b47c', a: '#00a844', s: '#006820', x: '#f85898' },
      road: { k: 'planks', base: '#9c7448', a: '#c09060', s: '#5c3c1c', line: '#3c2410', edge: '#5c3c1c' },
      block: { k: 'coral', roof: '#c84c78', rh: '#f8a4c0', rs: '#801c48', front: '#6c2c5c', fh: '#9c4c7c', fs: '#3c103c', win: '#28082c', lit: '#f878f8' },
      water: { k: 'water', d: '#00287c', m: '#0068c8', l: '#3cbcfc', x: '#d8f8f8', shore: '#fce0a8' },
      tree: { k: 'coraltree', d: '#a80020', m: '#f85898', l: '#f8a4c0', t: '#6c2c5c' }
    },
    ow_woods: {
      ground: { k: 'dirt', base: '#5c7c24', a: '#6c8c2c', s: '#3c5c18' },
      decor: { k: 'grass', base: '#3c7c18', a: '#58b828', s: '#245810', x: '#f8f8f8' },
      road: { k: 'trail', base: '#a07848', a: '#c09868', s: '#785430', line: '#785430', edge: '#4c6c1c' },
      block: { k: 'cliff', roof: '#4c8c28', rh: '#78b840', rs: '#2c5c18', front: '#6c6c6c', fh: '#9c9c9c', fs: '#3c3c3c', win: '#2c2c2c', lit: '#9c9c9c' },
      water: { k: 'water', d: '#002868', m: '#0050b0', l: '#3c9cf8', x: '#a4e4fc', shore: '#785430' },
      tree: { k: 'pine', d: '#003c10', m: '#007820', l: '#38a838', t: '#503000' }
    },
    ow_manor: {
      ground: { k: 'flag', base: '#5c5868', a: '#706c7c', s: '#3c3848' },
      decor: { k: 'deadgrass', base: '#4c4838', a: '#6c6448', s: '#2c2820', x: '#8c2c4c' },
      road: { k: 'cobble', base: '#4c4454', a: '#7c7484', s: '#2c2834', line: '#2c2834', edge: '#2c2834' },
      block: { k: 'manor', roof: '#2c2c48', rh: '#4c4c6c', rs: '#18182c', front: '#5c5c70', fh: '#8c8ca4', fs: '#30303c', win: '#141428', lit: '#f8b800' },
      water: { k: 'water', d: '#081408', m: '#14281c', l: '#2c4c34', x: '#4c7c54', shore: '#3c3848' },
      tree: { k: 'deadtree', d: '#1c1410', m: '#3c2c20', l: '#5c4834', t: '#3c2c20' }
    },
    ow_waste: {
      ground: { k: 'crack', base: '#a86430', a: '#c07840', s: '#784020' },
      decor: { k: 'scrub', base: '#9c5c2c', a: '#7c7c2c', s: '#5c3c18', x: '#c8a858' },
      road: { k: 'highway', base: '#4c4440', a: '#5c5450', s: '#2c2420', line: '#c8a040', edge: '#784020' },
      block: { k: 'ruin', roof: '#6c645c', rh: '#9c948c', rs: '#3c3430', front: '#7c7068', fh: '#a89c90', fs: '#3c3430', win: '#1c1410', lit: '#3c3430' },
      water: { k: 'toxic', d: '#2c4000', m: '#58a000', l: '#a8e030', x: '#e8fc98', shore: '#784020' },
      tree: { k: 'boulder', d: '#3c3430', m: '#7c7068', l: '#a89c90', t: '#3c3430' }
    },
    ow_war: {
      ground: { k: 'mud', base: '#5c4430', a: '#6c5038', s: '#3c2c1c' },
      decor: { k: 'crater', base: '#544030', a: '#2c2018', s: '#3c2c1c', x: '#7c6448' },
      road: { k: 'tracks', base: '#6c5840', a: '#7c6850', s: '#4c3c28', line: '#3c2c1c', edge: '#4c3c28' },
      block: { k: 'bunker', roof: '#b89868', rh: '#e8d0a0', rs: '#6c5030', front: '#5c5c58', fh: '#8c8c84', fs: '#2c2c28', win: '#0c0c0c', lit: '#f8b800' },
      water: { k: 'chasm', d: '#0c0404', m: '#1c0808', l: '#c83800', x: '#f8b800', shore: '#3c2c1c' },
      tree: { k: 'hedgehog', d: '#2c2c2c', m: '#5c5c5c', l: '#9c9c9c', t: '#3c2c1c' }
    }
  };
  art.owThemes = Object.keys(OW);

  var OWG = { // ground painters (fill whole tile)
    pave: function (g, c, r) {
      R(g, 0, 0, 16, 16, c.base); R(g, 0, 0, 16, 1, c.s); R(g, 0, 0, 1, 16, c.s); R(g, 8, 0, 1, 16, c.s); R(g, 0, 8, 16, 1, c.s);
      R(g, 1, 1, 7, 1, c.a); R(g, 9, 9, 7, 1, c.a); R(g, 9, 1, 7, 1, c.a); R(g, 1, 9, 7, 1, c.a);
      for (var i = 0; i < 4; i++) P(g, (r() * 16) | 0, (r() * 16) | 0, c.s);
      if (r() < 0.4) { var x = 2 + ((r() * 10) | 0), y = 2 + ((r() * 10) | 0); P(g, x, y, c.s); P(g, x + 1, y + 1, c.s); P(g, x + 1, y + 2, c.s); }
    },
    gravel: function (g, c, r) { R(g, 0, 0, 16, 16, c.base); for (var i = 0; i < 26; i++) P(g, (r() * 16) | 0, (r() * 16) | 0, i & 1 ? c.a : c.s); },
    sand: function (g, c, r) { R(g, 0, 0, 16, 16, c.base); for (var i = 0; i < 10; i++) P(g, (r() * 16) | 0, (r() * 16) | 0, i & 1 ? c.a : c.s); var y = (r() * 12) | 0; R(g, 2, y, 4, 1, c.s); R(g, 6, y + 1, 3, 1, c.s); },
    dirt: function (g, c, r) { R(g, 0, 0, 16, 16, c.base); for (var i = 0; i < 14; i++) P(g, (r() * 16) | 0, (r() * 16) | 0, i & 1 ? c.a : c.s); },
    flag: function (g, c, r) {
      R(g, 0, 0, 16, 16, c.s);
      var st = [[0, 0, 7, 5], [8, 0, 7, 7], [0, 6, 5, 9], [6, 6, 9, 4], [6, 11, 9, 4], [8, 8, 0, 0]];
      for (var i = 0; i < 5; i++) { var s = st[i]; R(g, s[0] + 1, s[1] + 1, s[2], s[3], i & 1 ? c.a : c.base); R(g, s[0] + 1, s[1] + 1, s[2], 1, c.a); }
    },
    crack: function (g, c, r) {
      R(g, 0, 0, 16, 16, c.base);
      for (var i = 0; i < 8; i++) P(g, (r() * 16) | 0, (r() * 16) | 0, c.a);
      var x = (r() * 16) | 0, y = 0; for (i = 0; i < 16; i++) { P(g, x, y, c.s); y++; x += r() < 0.5 ? -1 : 1; x = (x + 16) % 16; }
      x = 0; y = (r() * 16) | 0; for (i = 0; i < 8; i++) { P(g, x, y, c.s); x++; y += r() < 0.3 ? 1 : 0; }
    },
    mud: function (g, c, r) { R(g, 0, 0, 16, 16, c.base); for (var i = 0; i < 6; i++) { var x = (r() * 15) | 0, y = (r() * 15) | 0; R(g, x, y, 2, 1, c.a); P(g, x, y + 1, c.s); } for (i = 0; i < 6; i++) P(g, (r() * 16) | 0, (r() * 16) | 0, c.s); }
  };
  var OWD = { // decor painters (',') - ground + detail
    grass: function (g, c, r) {
      R(g, 0, 0, 16, 16, c.base);
      for (var i = 0; i < 9; i++) { var x = (r() * 15) | 0, y = 1 + ((r() * 14) | 0); P(g, x, y, c.a); P(g, x + 1, y - 1, c.a); P(g, x + 1, y, c.s); }
      if (r() < 0.5) { x = 2 + ((r() * 11) | 0); y = 2 + ((r() * 11) | 0); P(g, x, y, c.x); P(g, x - 1, y, c.x); P(g, x + 1, y, c.x); P(g, x, y - 1, c.x); P(g, x, y + 1, c.x); P(g, x, y, '#f8b800'); }
    },
    weed: function (g, c, r) {
      R(g, 0, 0, 16, 16, c.base);
      for (var i = 0; i < 3; i++) { var x = 2 + ((r() * 12) | 0), y = 4 + ((r() * 10) | 0); R(g, x, y - 3, 1, 4, c.a); P(g, x - 1, y - 2, c.a); P(g, x + 1, y - 4, c.a); P(g, x, y + 1, c.s); }
      if (r() < 0.6) { x = 2 + ((r() * 11) | 0); y = 3 + ((r() * 10) | 0); P(g, x, y, c.x); P(g, x + 1, y, c.x); P(g, x, y - 1, '#fcfcfc'); }
    },
    deadgrass: function (g, c, r) {
      R(g, 0, 0, 16, 16, c.base);
      for (var i = 0; i < 10; i++) { var x = (r() * 15) | 0, y = 1 + ((r() * 14) | 0); P(g, x, y, c.a); P(g, x + 1, y - 1, c.a); P(g, x, y + 1, c.s); }
      if (r() < 0.4) { x = 3 + ((r() * 10) | 0); y = 3 + ((r() * 10) | 0); P(g, x, y, c.x); P(g, x + 1, y, c.x); P(g, x, y + 1, '#2c4c1c'); }
    },
    scrub: function (g, c, r) {
      R(g, 0, 0, 16, 16, c.base);
      for (var i = 0; i < 2; i++) { var x = 3 + ((r() * 10) | 0), y = 4 + ((r() * 9) | 0); P(g, x, y, c.a); P(g, x - 1, y - 1, c.a); P(g, x + 1, y - 1, c.a); P(g, x - 2, y - 2, c.a); P(g, x + 2, y - 2, c.a); P(g, x, y + 1, c.s); }
      for (i = 0; i < 6; i++) P(g, (r() * 16) | 0, (r() * 16) | 0, c.x);
    },
    crater: function (g, c, r) {
      R(g, 0, 0, 16, 16, c.base);
      var x = 6 + ((r() * 4) | 0), y = 6 + ((r() * 4) | 0);
      blob(g, x, y, 5, 4, c.x); blob(g, x, y + 1, 4, 3, c.s); blob(g, x, y + 1, 2, 2, c.a);
      for (var i = 0; i < 5; i++) P(g, (r() * 16) | 0, (r() * 16) | 0, c.x);
    }
  };

  function owRoad(g, c, mask, r) {
    var up = mask & 1, dn = mask & 2, L = mask & 4, Rt = mask & 8;
    var horiz = (L || Rt) && !(up || dn), vert = (up || dn) && !(L || Rt);
    if (!horiz && !vert && !(L || Rt || up || dn)) horiz = true;
    var k = c.k;
    R(g, 0, 0, 16, 16, c.base);
    if (k === 'rail') {
      for (var i = 0; i < 16; i++) P(g, (r() * 16) | 0, (r() * 16) | 0, i & 1 ? c.s : '#7c6c5c');
      if (horiz || (!vert)) { for (var x = 1; x < 16; x += 4) { R(g, x, 2, 2, 12, c.a); P(g, x, 2, '#9c7c4c'); } R(g, 0, 4, 16, 1, c.line); R(g, 0, 5, 16, 1, '#5c5c5c'); R(g, 0, 11, 16, 1, c.line); R(g, 0, 12, 16, 1, '#5c5c5c'); }
      if (vert || (!horiz)) { for (var y = 1; y < 16; y += 4) { R(g, 2, y, 12, 2, c.a); P(g, 2, y, '#9c7c4c'); } R(g, 4, 0, 1, 16, c.line); R(g, 5, 0, 1, 16, '#5c5c5c'); R(g, 11, 0, 1, 16, c.line); R(g, 12, 0, 1, 16, '#5c5c5c'); }
      return;
    }
    if (k === 'planks') {
      if (vert) { for (y = 0; y < 16; y += 4) { R(g, 0, y, 16, 3, c.a); R(g, 0, y + 3, 16, 1, c.s); P(g, 2, y + 1, c.s); P(g, 13, y + 1, c.s); } }
      else { for (x = 0; x < 16; x += 4) { R(g, x, 0, 3, 16, c.a); R(g, x + 3, 0, 1, 16, c.s); P(g, x + 1, 2, c.s); P(g, x + 1, 13, c.s); } }
      if (!up && !horiz) R(g, 0, 0, 16, 1, c.edge); if (!dn && !horiz) R(g, 0, 15, 16, 1, c.edge);
      if (horiz) { if (!up) R(g, 0, 0, 16, 1, c.edge); if (!dn) R(g, 0, 15, 16, 1, c.edge); }
      if (!L && !horiz) R(g, 0, 0, 1, 16, c.edge); if (!Rt && !horiz) R(g, 15, 0, 1, 16, c.edge);
      return;
    }
    if (k === 'cobble') {
      R(g, 0, 0, 16, 16, c.s);
      for (y = 0; y < 16; y += 4) for (x = (y & 4) ? -2 : 0; x < 16; x += 4) { R(g, x + 1, y + 1, 3, 3, (x + y) % 3 ? c.base : c.a); P(g, x + 1, y + 1, c.a); }
      return;
    }
    if (k === 'trail') {
      for (i = 0; i < 10; i++) P(g, (r() * 16) | 0, (r() * 16) | 0, i & 1 ? c.a : c.s);
      if (!up) { R(g, 0, 0, 16, 2, c.edge); for (x = 0; x < 16; x += 3) P(g, x, 2, c.edge); }
      if (!dn) { R(g, 0, 14, 16, 2, c.edge); for (x = 1; x < 16; x += 3) P(g, x, 13, c.edge); }
      if (!L) { R(g, 0, 0, 2, 16, c.edge); for (y = 0; y < 16; y += 3) P(g, 2, y, c.edge); }
      if (!Rt) { R(g, 14, 0, 2, 16, c.edge); for (y = 1; y < 16; y += 3) P(g, 13, y, c.edge); }
      return;
    }
    if (k === 'tracks') {
      for (i = 0; i < 10; i++) P(g, (r() * 16) | 0, (r() * 16) | 0, i & 1 ? c.a : c.s);
      if (!vert) { for (x = 0; x < 16; x += 2) { P(g, x, 4, c.line); P(g, x + 1, 5, c.line); P(g, x, 10, c.line); P(g, x + 1, 11, c.line); } }
      if (!horiz) { for (y = 0; y < 16; y += 2) { P(g, 4, y, c.line); P(g, 5, y + 1, c.line); P(g, 10, y, c.line); P(g, 11, y + 1, c.line); } }
      return;
    }
    // asphalt / highway
    for (i = 0; i < 8; i++) P(g, (r() * 16) | 0, (r() * 16) | 0, i & 1 ? c.a : c.s);
    if (horiz) { R(g, 2, 7, 5, 1, c.line); R(g, 10, 7, 5, 1, c.line); }
    if (vert) { R(g, 7, 2, 1, 5, c.line); R(g, 7, 10, 1, 5, c.line); }
    if (!up) { R(g, 0, 0, 16, 1, c.edge); R(g, 0, 1, 16, 1, c.s); }
    if (!dn) { R(g, 0, 15, 16, 1, c.edge); R(g, 0, 14, 16, 1, c.s); }
    if (!L) { R(g, 0, 0, 1, 16, c.edge); R(g, 1, 0, 1, 16, c.s); }
    if (!Rt) { R(g, 15, 0, 1, 16, c.edge); R(g, 14, 0, 1, 16, c.s); }
    if (k === 'highway') { var cx = (r() * 10) | 0, cy = (r() * 10) | 0; for (i = 0; i < 6; i++) { P(g, cx + i, cy + (i >> 1), '#1c1410'); } if (r() < 0.5) blob(g, 4 + ((r() * 8) | 0), 4 + ((r() * 8) | 0), 2, 1, '#1c1410'); }
  }

  function owBlock(g, c, mask, r, v) {
    var up = mask & 1, dn = mask & 2, L = mask & 4, Rt = mask & 8, k = c.k;
    if (dn) { // ROOF / top surface
      R(g, 0, 0, 16, 16, c.roof);
      if (k === 'building') { for (var i = 0; i < 3; i++) P(g, (r() * 16) | 0, (r() * 16) | 0, c.rs); if (v === 1) { R(g, 4, 4, 6, 5, c.rs); R(g, 4, 4, 6, 4, c.rh); R(g, 5, 5, 4, 1, c.rs); } if (v === 2) { R(g, 9, 3, 3, 3, c.rs); P(g, 10, 3, c.rh); } }
      else if (k === 'warehouse') { for (var x = 0; x < 16; x += 3) { R(g, x, 0, 1, 16, c.rh); R(g, x + 2, 0, 1, 16, c.rs); } }
      else if (k === 'coral' || k === 'cliff') { for (i = 0; i < 10; i++) { var px = (r() * 15) | 0, py = (r() * 15) | 0; P(g, px, py, c.rh); P(g, px + 1, py + 1, c.rs); } if (k === 'coral') for (i = 0; i < 3; i++) { px = (r() * 14) | 0; py = (r() * 14) | 0; R(g, px, py, 2, 2, c.rs); P(g, px, py, '#28082c'); } }
      else if (k === 'manor') { for (var y = 0; y < 16; y += 4) for (x = (y & 4) ? 2 : 0; x < 16; x += 4) { R(g, x, y, 3, 3, c.rh); R(g, x, y + 2, 3, 1, c.rs); } }
      else if (k === 'ruin') { for (i = 0; i < 6; i++) P(g, (r() * 16) | 0, (r() * 16) | 0, c.rs); if (v & 1) { blob(g, 8, 8, 3, 2, '#1c1410'); P(g, 6, 6, '#a84c20'); P(g, 10, 7, '#a84c20'); } }
      else if (k === 'bunker') { for (y = 0; y < 16; y += 4) for (x = (y & 4) ? -4 : 0; x < 16; x += 8) { R(g, x + 1, y, 6, 3, c.roof); R(g, x + 1, y, 6, 1, c.rh); R(g, x, y + 3, 8, 1, c.rs); P(g, x, y + 1, c.rs); } }
      if (!up) { R(g, 0, 0, 16, 2, c.rh); R(g, 0, 0, 16, 1, K); }
      if (!L) { R(g, 0, 0, 1, 16, K); R(g, 1, 0, 1, 16, c.rh); }
      if (!Rt) { R(g, 15, 0, 1, 16, K); R(g, 14, 0, 1, 16, c.rs); }
      return;
    }
    // FRONT / facade (nothing of the same kind below)
    var rt = up ? 0 : 4; // a strip of roof if this is a 1-tall wall
    R(g, 0, 0, 16, 16, c.front);
    if (k === 'building') {
      R(g, 0, rt, 16, 1, c.fh);
      for (y = rt + 2; y < 16; y += 3) R(g, 0, y, 16, 1, c.fs);
      R(g, 3, rt + 3, 4, 5, K); R(g, 4, rt + 4, 2, 3, ((v + 1) & 2) ? c.lit : c.win); R(g, 9, rt + 3, 4, 5, K); R(g, 10, rt + 4, 2, 3, (v & 1) ? c.lit : c.win);
    } else if (k === 'warehouse') {
      R(g, 0, rt, 16, 1, c.fh); R(g, 2, rt + 3, 12, 12 - rt, c.fs); for (y = rt + 4; y < 15; y += 2) R(g, 3, y, 10, 1, c.fh);
    } else if (k === 'coral' || k === 'cliff') {
      for (x = 1; x < 16; x += 4 + ((r() * 2) | 0)) R(g, x, rt + 1, 1, 14 - rt, c.fs);
      for (i = 0; i < 6; i++) P(g, (r() * 16) | 0, rt + ((r() * (16 - rt)) | 0), c.fh);
      R(g, 0, rt, 16, 1, c.fh);
    } else if (k === 'manor') {
      for (y = rt; y < 16; y += 4) { R(g, 0, y, 16, 1, c.fs); for (x = (y & 4) ? 3 : 7; x < 16; x += 8) R(g, x, y, 1, 4, c.fs); }
      R(g, 5, rt + 3, 6, 9, K); R(g, 6, rt + 4, 4, 8, (v & 1) ? c.lit : c.win); P(g, 6, rt + 4, K); P(g, 9, rt + 4, K); R(g, 7, rt + 4, 2, 8, K); R(g, 6, rt + 8, 4, 1, K);
    } else if (k === 'ruin') {
      R(g, 0, rt, 16, 1, c.fh); R(g, 3, rt + 3, 4, 5, c.win); R(g, 10, rt + 3, 3, 6, c.win); P(g, 3, rt + 3, c.front); P(g, 6, rt + 7, c.front); P(g, 12, rt + 3, c.front);
      for (i = 0; i < 4; i++) P(g, (r() * 16) | 0, rt + 2 + ((r() * (13 - rt)) | 0), c.fs);
    } else if (k === 'bunker') {
      R(g, 0, rt, 16, 1, c.fh); R(g, 2, rt + 4, 12, 3, K); R(g, 3, rt + 5, 10, 1, '#3c3c3c');
      for (y = 13; y < 16; y++) for (x = 0; x < 16; x++) P(g, x, y, ((x + y) & 4) ? c.lit : '#202020');
    }
    if (!up) { // roof strip on top of a single-tile-tall wall
      R(g, 0, 0, 16, rt, c.roof); R(g, 0, 0, 16, 1, K); R(g, 0, 1, 16, 1, c.rh); R(g, 0, rt - 1, 16, 1, c.rs);
    }
    R(g, 0, 15, 16, 1, K);
    if (!L) R(g, 0, 0, 1, 16, K);
    if (!Rt) R(g, 15, 0, 1, 16, K);
    if (k === 'cliff' || k === 'coral') { if (!L) g.clearRect(0, 15, 1, 1); if (!Rt) g.clearRect(15, 15, 1, 1); }
  }

  function owWater(g, c, mask, a, r) {
    var up = mask & 1, dn = mask & 2, L = mask & 4, Rt = mask & 8, k = c.k;
    R(g, 0, 0, 16, 16, c.m);
    if (k === 'chasm') {
      R(g, 0, 0, 16, 16, c.d);
      if (!L) R(g, 0, 0, 2, 16, c.shore); if (!Rt) R(g, 14, 0, 2, 16, c.shore); if (!dn) R(g, 0, 14, 16, 2, c.m);
      if (!up) { R(g, 0, 0, 16, 3, c.shore); R(g, 0, 3, 16, 3, c.m); for (var x = 0; x < 16; x += 2) P(g, x, 3, (x + a * 2) % 6 ? c.l : c.x); }
      for (var i = 0; i < 3; i++) { var px = (i * 5 + a * 3) % 16; P(g, px, 9 + i * 2, a & 1 ? c.l : c.m); }
    } else {
      for (var y = 2; y < 16; y += 5) { var off = (y * 3 + a * 2) % 16; R(g, off, y, 4, 1, c.l); R(g, (off + 8) % 16, y + 2, 3, 1, c.d); }
      if (k === 'toxic' && (a & 1)) { P(g, 4 + a, 6, c.x); P(g, 11, 10 + a, c.x); }
      if (k === 'oil') { P(g, 3 + a, 4, '#4c7c7c'); P(g, 4 + a, 4, '#7c4c6c'); }
      var sh = c.shore, f = c.x;
      if (!up) { R(g, 0, 0, 16, 2, sh); for (x = 0; x < 16; x++) if (((x + a) & 3) !== 0) P(g, x, 2, f); }
      if (!dn) { R(g, 0, 15, 16, 1, sh); for (x = 0; x < 16; x++) if (((x + a) & 3) === 1) P(g, x, 14, f); }
      if (!L) { R(g, 0, 0, 1, 16, sh); for (y = 0; y < 16; y++) if (((y + a) & 3) !== 0) P(g, 1, y, f); }
      if (!Rt) { R(g, 15, 0, 1, 16, sh); for (y = 0; y < 16; y++) if (((y + a) & 3) !== 0) P(g, 14, y, f); }
    }
  }

  function owTreeObj(g, c) {
    var k = c.k;
    if (k === 'round') {
      R(g, 7, 11, 2, 4, c.t); blob(g, 8, 7, 6, 5, c.d); blob(g, 8, 6, 5, 4, c.m); blob(g, 6, 5, 2, 2, c.l); P(g, 10, 4, c.l);
    } else if (k === 'pine') {
      R(g, 7, 12, 2, 3, c.t); tri(g, 8, 1, 11, 6, c.m); tri(g, 8, 4, 13, 6, c.m); tri(g, 8, 7, 15, 6, c.d); tri(g, 8, 7, 9, 4, c.m); P(g, 7, 3, c.l); P(g, 6, 7, c.l); P(g, 5, 10, c.l);
    } else if (k === 'crates') {
      R(g, 1, 7, 7, 7, c.m); R(g, 8, 7, 7, 7, c.m); R(g, 4, 1, 7, 6, c.m);
      R(g, 1, 7, 7, 1, c.l); R(g, 8, 7, 7, 1, c.l); R(g, 4, 1, 7, 1, c.l);
      line(g, 1, 13, 7, 8, c.d); line(g, 8, 13, 14, 8, c.d); line(g, 4, 6, 10, 2, c.d);
    } else if (k === 'coraltree') {
      R(g, 7, 9, 2, 6, c.t); line(g, 8, 10, 3, 4, c.m); line(g, 8, 10, 13, 3, c.m); line(g, 8, 9, 8, 1, c.m); line(g, 5, 7, 2, 6, c.m); line(g, 11, 6, 14, 6, c.m);
      P(g, 3, 4, c.l); P(g, 13, 3, c.l); P(g, 8, 1, c.l); P(g, 2, 6, c.l); P(g, 14, 6, c.l); P(g, 7, 12, c.d);
    } else if (k === 'deadtree') {
      R(g, 7, 6, 2, 9, c.m); R(g, 6, 13, 4, 2, c.m); line(g, 7, 8, 3, 4, c.m); line(g, 8, 6, 12, 2, c.m); line(g, 3, 4, 2, 2, c.m); line(g, 12, 2, 14, 3, c.m); line(g, 8, 6, 9, 1, c.m);
      P(g, 7, 7, c.l); P(g, 7, 10, c.l);
    } else if (k === 'boulder') {
      blob(g, 8, 10, 6, 4, c.m); blob(g, 7, 9, 4, 3, c.l); blob(g, 10, 12, 3, 1, c.d); P(g, 5, 8, '#c8bcb0');
    } else if (k === 'hedgehog') {
      line(g, 2, 14, 13, 3, c.m); line(g, 3, 14, 14, 3, c.d); line(g, 2, 3, 13, 14, c.m); line(g, 3, 3, 14, 14, c.l); R(g, 7, 2, 2, 12, c.m); P(g, 7, 2, c.l);
    }
  }

  var owCache = {};
  art.owTile = function (ctx, theme, ch, x, y, info) {
    var spec = OW[theme] || OW.ow_city; if (!OW[theme]) theme = 'ow_city';
    var mask = 0, v = 0, a = 0;
    if (info) {
      mask = (info.up ? 1 : 0) | (info.down ? 2 : 0) | (info.left ? 4 : 0) | (info.right ? 8 : 0);
      if (info.tx !== undefined) v = hash2((info.tx | 0) + 11, (info.ty | 0) * 5 + 3) & 3;
    }
    if (ch === '~') a = Math.floor(((info && info.t !== undefined) ? info.t : (DCW.t || 0)) * 3) & 3;
    else if (ch === '.' || ch === ',' || ch === 'T') mask = 0;
    else if (ch !== '#' && ch !== '=') { ch = '.'; mask = 0; }
    var key = theme + ch, oc = owCache[key] || (owCache[key] = {});
    var id = (mask << 4) | (v << 2) | a;
    var cv = oc[id];
    if (!cv) {
      cv = oc[id] = mkCanvas(16, 16);
      var g = g2(cv), r = rng(hashStr(key) + v * 977 + (ch === '=' ? 0 : mask * 13));
      if (ch === '.') OWG[spec.ground.k](g, spec.ground, r);
      else if (ch === ',') OWD[spec.decor.k](g, spec.decor, r);
      else if (ch === '=') owRoad(g, spec.road, mask, r);
      else if (ch === '#') owBlock(g, spec.block, mask, r, v);
      else if (ch === '~') owWater(g, spec.water, mask, a, r);
      else if (ch === 'T') {
        OWG[spec.ground.k](g, spec.ground, r);
        var oc2 = mkCanvas(16, 16), og = g2(oc2);
        owTreeObj(og, spec.tree); outlineCanvas(oc2, 16, 16, 1, K);
        g.globalAlpha = 0.35; R(g, 3, 13, 11, 2, '#000000'); g.globalAlpha = 1;
        g.drawImage(oc2, 0, 0);
      }
    }
    ctx.drawImage(cv, Math.round(x), Math.round(y));
  };

  /* =====================================================================
     FX, PROJECTILES, PICKUPS, OBJECTS, OVERWORLD MARKERS, ICONS
     (registered as procs in DCW.artProcs unless art_actors.js already
     defined the same name)
     ===================================================================== */
  // pixel-row proc: frames = [[rows...], ...]; ol: true (black outline) | false | colour
  function pix(name, pal, frames, ol) {
    var h = frames[0].length, w = 0;
    for (var i = 0; i < frames[0].length; i++) w = Math.max(w, frames[0][i].length);
    proc(name, w, h, frames.length, function (g, f) { rows(g, 0, 0, frames[f], pal); }, ol === false ? false : (typeof ol === 'string' ? { outline: ol } : true));
  }
  function noisyDisc(g, cx, cy, r, c, r2, amt) {
    g.fillStyle = c;
    for (var y = -r - 2; y <= r + 2; y++) for (var x = -r - 2; x <= r + 2; x++) {
      var d = Math.sqrt(x * x + y * y) + (amt ? (r2() - 0.5) * amt : 0);
      if (d <= r) g.fillRect(cx + x, cy + y, 1, 1);
    }
  }

  /* ---- projectiles ---- */
  pix('arrow', { b: '#ac7c00', s: '#dcdcdc', f: '#fcfcfc', r: '#e40058' }, [[
    '..............',
    '.ff.......s...',
    '..rbbbbbbbsss.',
    '.ff.......s...',
    '..............']]);
  pix('rock', { g: '#7c7c7c', l: '#bcbcbc', d: '#3c3c3c' }, [[
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
    for (var i = 0; i < 6; i++) P(g, 1 + ((r() * 6) | 0), 3 + ((r() * 4) | 0), i & 1 ? '#f83800' : '#a81000');
    R(g, 4, 3, 4, 4, '#f83800'); R(g, 2 + f, 4, 3, 2, '#f83800');
    disc(g, 9, 5, 3, '#f83800'); disc(g, 9, 5, 2, '#fca044'); R(g, 9, 4, 2, 2, '#f8d878'); P(g, 10, 4, '#fcfcfc');
    P(g, 6, 2 + f, '#fca044'); P(g, 5, 7 - f, '#fca044');
  }, { outline: '#881400' });
  proc('bubble', 10, 10, 2, function (g, f) {
    if (f === 0) { ring(g, 5, 5, 3, '#3cbcfc'); disc(g, 5, 5, 2, 'rgba(164,228,252,0.35)'); P(g, 3, 3, '#fcfcfc'); P(g, 4, 3, '#fcfcfc'); P(g, 3, 4, '#fcfcfc'); }
    else { for (var x = -4; x <= 4; x++) { var hh = Math.round(3 * Math.sqrt(1 - (x * x) / 20.25)); P(g, 5 + x, 5 - hh, '#3cbcfc'); P(g, 5 + x, 5 + hh, '#3cbcfc'); } R(g, 2, 4, 6, 3, 'rgba(164,228,252,0.35)'); P(g, 3, 3, '#fcfcfc'); P(g, 4, 3, '#fcfcfc'); }
  }, { outline: '#0058f8' });
  pix('bolt', { y: '#f8d878', w: '#fcfcfc', o: '#fca044' }, [[
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
    '..............']], '#4428bc');
  pix('bottle', { g: '#00a800', l: '#58d854', c: '#ac7c00', w: '#fcfcfc', d: '#005800' }, [[
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
    disc(g, 6, 6, r, '#a80020'); disc(g, 6, 6, r - 1, '#e40058'); disc(g, 6, 6, r - 2, '#f8a4c0'); disc(g, 6, 6, 1, '#fcfcfc');
  }, false);
  pix('knife', { s: '#fcfcfc', g: '#9c9c9c', h: '#7c4c18', y: '#f8b800' }, [[
    '............',
    '.hhhy.......',
    '.hhhygssssg.',
    '.hhhyggggg..',
    '............']]);
  proc('spore', 10, 10, 2, function (g, f) {
    disc(g, 5, 5, 3, '#7c8c18'); disc(g, 5, 5, 2, '#b8c838');
    P(g, 4, 4, '#d8f878'); P(g, 6, 6, '#58a000');
    var o = f ? 1 : 0;
    P(g, 1 + o, 2, '#d8f878'); P(g, 8 - o, 1 + o, '#d8f878'); P(g, 8, 8 - o, '#b8c838'); P(g, 1, 8 - o, '#b8c838');
  }, { outline: '#304410' });
  pix('note', { p: '#f878f8', l: '#f8b8f8' }, [[
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
    var t = f ? 1 : 0;
    R(g, 1, 4 - t, 2, 1, '#6844fc'); R(g, 2, 6 + t, 2, 1, '#6844fc');
    R(g, 3, 4, 5, 2, '#9878f8'); R(g, 5, 3, 4, 4, '#d800cc');
    disc(g, 11, 5, 3, '#d800cc'); disc(g, 11, 5, 2, '#f878f8'); R(g, 11, 4, 2, 2, '#fcfcfc'); P(g, 10, 5, '#f8d8f8');
    P(g, 14, 5, '#f8d8f8');
    if (f) { P(g, 4, 1, '#fcfcfc'); P(g, 7, 8, '#f8b8f8'); } else { P(g, 6, 1, '#f8b8f8'); P(g, 3, 8, '#fcfcfc'); }
  }, { outline: '#4428bc' });
  pix('bomb', { b: '#3c3c3c', l: '#7c7c7c', w: '#bcbcbc', f: '#ac7c00', s: '#f8d878', o: '#f83800', x: '#fcfcfc' }, [[
    '.......s..',
    '......sxo.',
    '......f...',
    '.....f....',
    '...bbbb...',
    '..bwlbbb..',
    '.bwlbbbbb.',
    '.blbbbbbb.',
    '.bbbbbbbb.',
    '..bbbbbb..',
    '...bbbb...'], [
    '......o.s.',
    '.......x..',
    '......fs..',
    '.....f....',
    '...bbbb...',
    '..bwlbbb..',
    '.bwlbbbbb.',
    '.blbbbbbb.',
    '.bbbbbbbb.',
    '..bbbbbb..',
    '...bbbb...']]);

  /* ---- fx ---- */
  proc('explosion', 32, 32, 5, function (g, f) {
    var r = rng(41 + f);
    if (f === 0) { noisyDisc(g, 16, 16, 6, '#fca044', r, 2); noisyDisc(g, 16, 16, 4, '#f8d878', r, 1); disc(g, 16, 16, 2, '#fcfcfc'); return; }
    if (f === 1) { noisyDisc(g, 16, 16, 11, '#f83800', r, 3); noisyDisc(g, 16, 16, 9, '#fca044', r, 3); noisyDisc(g, 16, 16, 6, '#f8d878', r, 2); disc(g, 16, 16, 3, '#fcfcfc'); return; }
    if (f === 2) {
      noisyDisc(g, 16, 16, 14, '#a81000', r, 4); noisyDisc(g, 16, 16, 12, '#f83800', r, 4); noisyDisc(g, 16, 15, 8, '#fca044', r, 4); noisyDisc(g, 16, 14, 4, '#f8d878', r, 2);
      for (var i = 0; i < 8; i++) { var a = r() * 6.28; P(g, 16 + Math.round(Math.cos(a) * 15), 16 + Math.round(Math.sin(a) * 15), '#f8d878'); }
      return;
    }
    if (f === 3) {
      noisyDisc(g, 16, 14, 14, '#3c3c3c', r, 6); noisyDisc(g, 16, 15, 11, '#a81000', r, 6); noisyDisc(g, 15, 16, 7, '#f83800', r, 5);
      for (i = 0; i < 7; i++) { var bx = 4 + ((r() * 24) | 0), by = 4 + ((r() * 24) | 0); disc(g, bx, by, 2, '#5c5c5c'); }
      return;
    }
    for (i = 0; i < 9; i++) { var px = 6 + ((r() * 20) | 0), py = 4 + ((r() * 20) | 0); disc(g, px, py, 2 + ((r() * 3) | 0), i & 1 ? '#3c3c3c' : '#5c5c5c'); }
    for (i = 0; i < 4; i++) P(g, 4 + ((r() * 24) | 0), 4 + ((r() * 24) | 0), '#f83800');
  }, false);
  pix('hit', { w: '#fcfcfc', y: '#f8d878', o: '#fca044' }, [[
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
    var c = ['#d8c8a8', '#bcac8c', '#8c7c6c'][f], rr = [1, 2, 2][f];
    var sp = [1, 3, 5][f];
    disc(g, 7 - sp, 6 - f, rr, c); disc(g, 7 + sp, 6 - f, rr, c); disc(g, 7, 5 - f, rr + (f === 1 ? 1 : 0), c);
    if (f === 0) { P(g, 7, 7, '#fcfcfc'); }
  }, false);
  pix('sparkle', { w: '#fcfcfc', y: '#f8d878', o: '#fca044' }, [[
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
    var c1 = f ? '#3cbcfc' : '#fcfcfc', c2 = f ? '#0058f8' : '#a4e4fc';
    for (var x = 0; x < 32; x++) {
      var d = Math.abs(x - 15.5) / 16, h = Math.round((1 - d * d) * (f ? 5 : 8));
      if (f && Math.abs(x - 15.5) < 6) h = Math.max(0, h - 4);
      if (h > 0) { R(g, x, 10 - h, 1, 1, c1); R(g, x, 10 - h + 1, 1, Math.max(0, h - 2), c2); }
    }
  }, false);
  proc('smoke', 16, 16, 3, function (g, f) {
    var r = rng(91 + f), c = ['#9c9c9c', '#7c7c7c', '#5c5c5c'][f], hl = ['#cccccc', '#9c9c9c', '#6c6c6c'][f];
    var n = 3 + f, rad = 2 + f;
    for (var i = 0; i < n; i++) { var x = 8 + ((r() * 8 - 4) | 0) * (f + 1) / 2, y = 10 - f * 2 + ((r() * 6 - 3) | 0); disc(g, Math.round(x), y, rad - (i & 1), c); P(g, Math.round(x) - 1, y - 1, hl); }
  }, false);

  /* ---- pickups ---- */
  pix('coin', { y: '#f8b800', l: '#f8d878', w: '#fcfcfc', d: '#ac7c00' }, [[
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
  pix('snack', { m: '#a84c18', l: '#e48c48', h: '#fca044', b: '#fcfcfc', g: '#bcbcbc', d: '#6c2c08' }, [[
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
  pix('bomb_pickup', { b: '#3c3c3c', l: '#7c7c7c', w: '#bcbcbc', f: '#ac7c00', s: '#f8d878', o: '#f83800', x: '#fcfcfc', r: '#e40058' }, [[
    '..........s.',
    '.........sxo',
    '.........f..',
    '........f...',
    '....bbbbb...',
    '...bwlbbbb..',
    '..bwlbbbbbb.',
    '..blbbbbbbb.',
    '..bbbrrrbbb.',
    '..bbbbbbbbb.',
    '...bbbbbbb..',
    '....bbbbb...'], [
    '.........o..',
    '..........x.',
    '.........fs.',
    '........f...',
    '....bbbbb...',
    '...bwlbbbb..',
    '..bwlbbbbbb.',
    '..blbbbbbbb.',
    '..bbbrrrbbb.',
    '..bbbbbbbbb.',
    '...bbbbbbb..',
    '....bbbbb...']]);
  pix('potion', { c: '#ac7c00', g: '#a4e4fc', r: '#e40058', l: '#f85898', w: '#fcfcfc', d: '#a80020' }, [[
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

  var TIERS = {
    bronze: { b: '#c87838', l: '#fca044', d: '#7c3c14', r: '#f8d878' },
    silver: { b: '#bcbcbc', l: '#fcfcfc', d: '#6c6c6c', r: '#3cbcfc' },
    gold: { b: '#f8b800', l: '#f8d878', d: '#ac7c00', r: '#e40058' },
    platinum: { b: '#a4e4fc', l: '#fcfcfc', d: '#3c9cc8', r: '#9878f8' },
    legendary: { b: '#9878f8', l: '#d8b8f8', d: '#4428bc', r: '#f8b800' },
    fan: { b: '#f878f8', l: '#f8b8f8', d: '#940084', r: '#fcfcfc' },
    boss: { b: '#2c2c2c', l: '#5c5c5c', d: '#141414', r: '#e40058' }
  };
  var RAINBOW = ['#f83800', '#fca044', '#f8d878', '#58d854', '#3cbcfc', '#6888fc', '#f878f8'];
  function drawBox(g, f, tier) {
    var c = TIERS[tier];
    // body
    R(g, 2, 8, 12, 7, c.b); R(g, 2, 8, 1, 7, c.l); R(g, 13, 8, 1, 7, c.d); R(g, 2, 14, 12, 1, c.d);
    if (tier === 'legendary') for (var y = 9; y < 14; y++) R(g, 3, y, 10, 1, RAINBOW[(y + f) % 7]);
    if (tier === 'fan') { rows(g, 3, 10, ['h.h', 'hhh', '.h.'], { h: '#e40058' }); rows(g, 10, 10, ['h.h', 'hhh', '.h.'], { h: '#e40058' }); }

    // lid
    R(g, 1, 5, 14, 3, c.b); R(g, 1, 5, 14, 1, c.l); R(g, 1, 7, 14, 1, c.d);
    // ribbon + bow
    if (tier === 'boss') { R(g, 7, 5, 2, 3, c.r); rows(g, 5, 8, ['.wwww.', 'wkwwkw', 'wkwwkw', 'wwwwww', '.wkkw.', '.w.ww.'], { w: '#fcfcfc', k: '#a80020' }); P(g, 3, 9, c.r); P(g, 12, 9, c.r); P(g, 3, 12, c.r); P(g, 12, 12, c.r); }
    else { R(g, 7, 5, 2, 10, c.r); P(g, 7, 6, '#fcfcfc'); }
    R(g, 3, 2, 3, 3, c.r); R(g, 10, 2, 3, 3, c.r); P(g, 4, 3, c.d); P(g, 11, 3, c.d); R(g, 6, 3, 4, 2, c.r); P(g, 7, 3, '#fcfcfc');
    if (tier === 'boss') { P(g, 1, 4, c.r); P(g, 14, 4, c.r); }
    // glint
    if (f === 1) { P(g, 3, 13, '#fcfcfc'); P(g, 4, 12, '#fcfcfc'); P(g, 5, 11, '#fcfcfc'); }
    if (f === 2) { P(g, 9, 13, '#fcfcfc'); P(g, 10, 12, '#fcfcfc'); P(g, 11, 11, '#fcfcfc'); P(g, 12, 10, '#fcfcfc'); }
    if (f === 3) { P(g, 14, 1, '#fcfcfc'); P(g, 13, 1, '#f8d878'); P(g, 15, 1, '#f8d878'); P(g, 14, 0, '#f8d878'); P(g, 14, 2, '#f8d878'); }
  }
  Object.keys(TIERS).forEach(function (tier) {
    proc('box_' + tier, 17, 16, 4, function (g, f) { g.translate(0, 0); drawBox(g, f, tier); });
  });

  /* ---- level objects ---- */
  var EXIT_ROWS = ['eee.x.x.i.ttt', 'e...x.x.i..t.', 'ee...x..i..t.', 'e...x.x.i..t.', 'eee.x.x.i..t.'];
  function doorFrame(g) {
    R(g, 1, 9, 24, 29, '#5c5c64'); R(g, 1, 9, 24, 1, '#8c8c94'); R(g, 1, 9, 1, 29, '#8c8c94'); R(g, 24, 9, 1, 29, '#3c3c44');
  }
  function exitSign(g, lit) {
    R(g, 5, 1, 16, 7, lit ? '#005800' : '#004000'); R(g, 5, 1, 16, 1, lit ? '#00a800' : '#006800');
    rows(g, 7, 2, EXIT_ROWS, { e: lit ? '#fcfcfc' : '#b8f818', x: lit ? '#fcfcfc' : '#b8f818', i: lit ? '#fcfcfc' : '#b8f818', t: lit ? '#fcfcfc' : '#b8f818' });
    R(g, 12, 8, 2, 1, '#3c3c44');
  }
  proc('door', 26, 38, 1, function (g) {
    doorFrame(g);
    R(g, 4, 13, 18, 25, '#7c2c08'); R(g, 4, 13, 18, 1, '#a84c18'); R(g, 4, 13, 1, 25, '#a84c18');
    R(g, 6, 16, 6, 9, '#5c1c04'); R(g, 14, 16, 6, 9, '#5c1c04'); R(g, 6, 27, 6, 9, '#5c1c04'); R(g, 14, 27, 6, 9, '#5c1c04');
    R(g, 6, 16, 6, 1, '#4c1404'); R(g, 14, 16, 6, 1, '#4c1404');
    R(g, 12, 13, 2, 25, '#3c1004'); R(g, 10, 25, 2, 2, '#f8b800'); R(g, 14, 25, 2, 2, '#f8b800');
    exitSign(g, false);
  });
  proc('door_open', 26, 38, 1, function (g) {
    doorFrame(g);
    R(g, 4, 13, 18, 25, '#000000');
    for (var i = 0; i < 6; i++) R(g, 6 + i * 2, 34 - i * 3, 14 - i * 2, 1, ['#5c5c5c', '#4c4c4c', '#3c3c3c', '#2c2c2c', '#202020', '#141414'][i]);
    R(g, 4, 13, 3, 25, '#7c2c08'); R(g, 4, 13, 1, 25, '#a84c18');
    g.globalAlpha = 0.3; R(g, 7, 13, 15, 25, '#58d854'); g.globalAlpha = 1;
    exitSign(g, true);
  });
  // checkpoint: frame 0 = not reached (grey, drooped), frame 1 = activated (green, waving)
  var CP_POLE = ['..p........', '..p........', '..p........', '..p........', '..p........', '..p........', '..p........', '..p........', '..p........', '..p........', '..p........', '..p........', '.bbb.......', 'bbbbb......', '...........'];
  pix('checkpoint', { p: '#bcbcbc', g: '#00a800', l: '#58d854', y: '#f8d878', b: '#3c3c3c', q: '#9c9c9c', m: '#5c5c5c', n: '#7c7c7c' }, [
    ['...........', '..p........', '..pm.......', '..pnm......', '..pnnm.....', '..pnnnm....', '..pnnmm....'].concat(CP_POLE),
    ['...........', '..y........', '..pgggg....', '..plllgg...', '..pllyggg..', '..plllgg...', '..pgggg....'].concat(CP_POLE)
  ]);
  pix('checkpoint_off', { p: '#9c9c9c', g: '#5c5c5c', l: '#7c7c7c', b: '#3c3c3c' }, [[
    '...........',
    '..p........',
    '..pg.......',
    '..plg......',
    '..pllg.....',
    '..plllg....',
    '..pllgg....',
    '..pgg......',
    '..p........',
    '..p........',
    '..p........',
    '..p........',
    '..p........',
    '..p........',
    '..p........',
    '..p........',
    '..p........',
    '..p........',
    '..p........',
    '.bbb.......',
    'bbbbb......',
    '...........']]);
  pix('sign', { w: '#c87838', l: '#fca044', d: '#7c3c14', t: '#3c1c08', p: '#7c4c18' }, [[
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
    R(g, 1, 7, 16, 8, '#7c3c14'); R(g, 1, 7, 16, 1, '#a85c28'); R(g, 1, 14, 16, 1, '#4c1c04');
    R(g, 1, 7, 2, 8, '#f8b800'); R(g, 15, 7, 2, 8, '#f8b800'); R(g, 1, 7, 1, 8, '#f8d878');
  }
  proc('chest', 18, 16, 1, function (g) {
    chestBase(g);
    R(g, 1, 2, 16, 5, '#a85c28'); R(g, 2, 1, 14, 1, '#a85c28'); R(g, 2, 2, 14, 1, '#c87838'); R(g, 1, 6, 16, 1, '#4c1c04');
    R(g, 1, 2, 2, 5, '#f8b800'); R(g, 15, 2, 2, 5, '#f8b800');
    R(g, 7, 5, 4, 5, '#f8b800'); R(g, 8, 7, 2, 2, '#000000'); P(g, 7, 5, '#f8d878');
  });
  proc('chest_open', 18, 18, 1, function (g) {
    g.translate(0, 2);
    R(g, 1, -1, 16, 4, '#4c1c04'); R(g, 2, -2, 14, 1, '#7c3c14'); R(g, 1, -1, 2, 4, '#f8b800'); R(g, 15, -1, 2, 4, '#f8b800');
    R(g, 2, 3, 14, 4, '#000000');
    R(g, 3, 4, 12, 3, '#f8b800'); P(g, 4, 4, '#fcfcfc'); P(g, 9, 3, '#f8d878'); P(g, 12, 4, '#fcfcfc'); P(g, 6, 3, '#f8d878');
    chestBase(g);
    R(g, 7, 7, 4, 3, '#f8b800');
  });
  proc('crate', 18, 18, 1, function (g) { g.translate(1, 1); paintCrate(g, { d: '#503000', m: '#ac7c00', l: '#fca044' }); });
  proc('stairs', 34, 26, 1, function (g) {
    R(g, 1, 6, 32, 20, '#5c5c64'); R(g, 3, 2, 28, 4, '#5c5c64'); R(g, 1, 6, 32, 1, '#8c8c94'); R(g, 3, 2, 28, 1, '#8c8c94');
    R(g, 5, 7, 24, 19, '#000000');
    for (var i = 0; i < 6; i++) R(g, 6 + i * 2, 23 - i * 3, 22 - i * 4, 2, ['#7c7c7c', '#5c5c5c', '#4c4c4c', '#3c3c3c', '#2c2c2c', '#1c1c1c'][i]);
    R(g, 13, 3, 8, 3, '#00a800'); P(g, 16, 3, '#b8f818'); P(g, 17, 3, '#b8f818'); R(g, 15, 4, 4, 1, '#b8f818'); P(g, 16, 5, '#b8f818'); P(g, 17, 5, '#b8f818');
  });

  /* ---- overworld markers (16x16 + outline) ---- */
  proc('ow_door', 18, 18, 1, function (g) {
    R(g, 3, 3, 12, 14, '#5c5c64'); R(g, 2, 2, 14, 3, '#a81000'); for (var x = 2; x < 16; x += 4) R(g, x, 2, 2, 3, '#fcfcfc');
    R(g, 5, 6, 8, 11, '#7c2c08'); R(g, 5, 6, 8, 1, '#a84c18'); R(g, 8, 6, 2, 11, '#4c1404'); P(g, 11, 11, '#f8b800');
  });
  proc('ow_manhole', 18, 18, 1, function (g) {
    blob(g, 9, 10, 7, 5, '#3c3c3c'); blob(g, 9, 10, 6, 4, '#7c7c7c');
    for (var x = 4; x < 15; x += 2) R(g, x, 7, 1, 7, '#5c5c5c');
    R(g, 4, 10, 11, 1, '#5c5c5c'); P(g, 6, 7, '#bcbcbc'); P(g, 7, 7, '#bcbcbc');
  });
  proc('ow_tent', 18, 18, 1, function (g) {
    for (var y = 0; y < 11; y++) { var hw = Math.round(1 + y * 0.72); for (var x = -hw; x <= hw; x++) P(g, 9 + x, 5 + y, (((x + 20) >> 1) & 1) ? '#e40058' : '#fcfcfc'); }
    R(g, 2, 15, 15, 1, '#a80020'); R(g, 8, 11, 3, 5, '#000000'); R(g, 9, 1, 1, 5, '#bcbcbc'); R(g, 10, 1, 3, 2, '#f8b800');
  });
  proc('ow_cave', 18, 18, 1, function (g) {
    blob(g, 9, 12, 8, 6, '#6c4c2c'); blob(g, 8, 10, 6, 5, '#8c6c44'); R(g, 1, 13, 16, 4, '#6c4c2c');
    blob(g, 9, 14, 4, 4, '#000000'); R(g, 5, 14, 9, 3, '#000000');
    P(g, 6, 7, '#ac8c64'); P(g, 11, 8, '#ac8c64'); P(g, 7, 12, '#ac8c64');
  });
  proc('ow_safe', 18, 18, 1, function (g) {
    R(g, 3, 7, 12, 10, '#7c4c18'); R(g, 3, 7, 12, 1, '#a86c30');
    for (var y = 0; y < 5; y++) R(g, 3 - y + 4, 2 + y, 2 * y + 4, 1, '#3c6c3c');
    R(g, 2, 7, 14, 1, '#285028');
    R(g, 7, 11, 4, 6, '#58d854'); R(g, 8, 12, 2, 5, '#b8f818');
    R(g, 4, 9, 2, 2, '#f8d878'); R(g, 12, 9, 2, 2, '#f8d878');
  });
  function bossGate(g, locked) {
    R(g, 2, 6, 14, 11, locked ? '#3c0c14' : '#5c0818'); blob(g, 9, 6, 7, 4, locked ? '#3c0c14' : '#5c0818');
    R(g, 5, 9, 8, 8, '#000000'); blob(g, 9, 9, 4, 2, '#000000');
    rows(g, 6, 1, ['.www..', 'wwwww.', 'wkwkw.', 'wwwww.', '.w.w..'], { w: locked ? '#9c9c9c' : '#fcfcfc', k: locked ? '#3c0c14' : '#e40058' });
    if (!locked) { P(g, 2, 6, '#f83800'); P(g, 15, 6, '#f83800'); P(g, 2, 5, '#f8b800'); P(g, 15, 5, '#f8b800'); }
    else {
      for (var i = 0; i < 9; i++) { P(g, 4 + i, 10 + (i >> 1), '#9c9c9c'); P(g, 13 - i, 10 + (i >> 1), '#9c9c9c'); }
      R(g, 7, 12, 4, 4, '#f8b800'); R(g, 8, 10, 2, 2, '#bcbcbc'); P(g, 8, 13, '#000000'); P(g, 8, 14, '#000000');
    }
  }
  proc('ow_boss', 18, 18, 1, function (g) { bossGate(g, false); });
  proc('ow_boss_locked', 18, 18, 1, function (g) { bossGate(g, true); });
  function owStairs(g, locked) {
    R(g, 1, 4, 16, 13, '#5c5c64'); R(g, 1, 4, 16, 1, '#8c8c94');
    R(g, 3, 6, 12, 10, '#000000');
    for (var i = 0; i < 4; i++) R(g, 4 + i, 14 - i * 2, 10 - i * 2, 1, ['#7c7c7c', '#5c5c5c', '#3c3c3c', '#2c2c2c'][i]);
    R(g, 6, 1, 6, 3, locked ? '#a80020' : '#00a800'); R(g, 7, 2, 4, 1, locked ? '#f87858' : '#b8f818');
    if (locked) { for (var x = 4; x < 15; x += 3) R(g, x, 6, 1, 10, '#9c9c9c'); }
  }
  proc('ow_stairs', 18, 18, 1, function (g) { owStairs(g, false); });
  proc('ow_stairs_locked', 18, 18, 1, function (g) { owStairs(g, true); });
  pix('ow_flag', { p: '#bcbcbc', g: '#00a800', l: '#58d854', w: '#fcfcfc', b: '#5c5c5c' }, [[
    '...........',
    '..pggggg...',
    '..pllllwg..',
    '..plllwlg..',
    '..pwlwllg..',
    '..pllwlgg..',
    '..pgggg....',
    '..p........',
    '..p........',
    '..p........',
    '..p........',
    '.bbb.......',
    '...........']]);

  /* ---- HUD icons 8x8 (outline drawn in the rows) ---- */
  var IP = { k: '#000000', r: '#e40058', R: '#f85898', w: '#fcfcfc', d: '#3c1420', y: '#f8b800', Y: '#f8d878', o: '#ac7c00', g: '#7c7c7c', G: '#bcbcbc', b: '#3c3c3c', B: '#0058f8', L: '#3cbcfc', c: '#a84c18', C: '#e48c48', p: '#f878f8', P: '#f8b8f8', n: '#7c2c08', e: '#0078f8', f: '#f83800' };
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
  icon('eye', ['........', '..kkkk..', '.kwwwwk.', 'kwwekwwk', 'kwekkwwk', '.kwwwwk.', '..kkkk..', '........']);

  art.init = function () {
    var names = art.names();
    for (var i = 0; i < names.length; i++) if (!cache[names[i]]) get(names[i]);
  };
})();

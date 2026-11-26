/* ============================================================
   DCW ART (art-core), BOOK 2: the Over City.
   Rasterizer + sprite API (unchanged from book 1), side-view
   themes (tiles + parallax backgrounds, day and night), UI /
   cinema backdrops, cutscene panels, raster wobble, objects,
   doors, fx, projectiles, pickups, key items, HUD icons.
   See ../DESIGN.md section 12 (and book 1's art contract).

   Actor pixel data (Carl, companions, enemies, bosses, NPCs,
   portraits) lives in art_actors.js in DCW.artDefs / artProcs /
   artSkins; this file rasterizes everything into cached canvases.

   API (book 1 + book 2 additions):
   - sprite(ctx, name, x, y, {frame, flip, skin, alpha, flash, scale})  x,y = bottom-center
   - has(name), info(name) -> {w,h,frames}, sheet(name), icon(ctx, name, x, y), portrait(...)
   - tile(ctx, theme, ch, x, y, info)   ch in # X = ^ ~ H b L; info {up,down,left,right,tx,ty,t,night,open}
   - background(ctx, theme, camX, camY, {night, t})   side-view themes and backdrops
   - panel(ctx, id, x, y, t), hasPanel(id), panelSize(id) -> {w,h}   cutscene panels (256x112)
   - wobble(ctx, y0, y1, amp, freq, t)   per-scanline x offsets of what is on the canvas
   - boxColor(tier), prepare(theme, night), themes, backdrops, panels, names(), refresh(name)

   Notes / small extensions to the contract:
   - def.ox / def.oy shift the feet anchor inside the sprite: the
     anchor sits at (floor(w/2)+ox, h+oy) in sprite pixels, so oy=-2
     means "feet are 2px above the bottom edge". Flip mirrors ox.
   - procs may set `outline: '#000000'` to get an automatic 1px outline
     around their opaque pixels (leave a 1px transparent margin).
   - proc.draw(g, frame, pal) - pal is the skin palette for carl_* procs.
   - HUD icons are stored as 'icon_<name>' (icon() also accepts a bare
     sprite name as a fallback).
   - tile() info may carry tx, ty (world tile coords) for texture
     variation; without them every tile uses variant 0.
   - an unknown 'box_<tier>' sprite is generated on the fly from
     boxColor(tier), so new loot tiers in data.js always draw a box.
   - street themes (village ruins circus settlement admin) draw their
     nearest facade layer locked 1:1 to the world (ground line at world
     y 160), so door sprites stand in the facade's plain ground floor.
   - unknown theme ids fall back through aliases (book 1 ids map to the
     closest book 2 theme), then to 'ruins'.
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
    if (!def && !pr && name.indexOf('box_') === 0 && typeof autoBox === 'function') pr = autoBox(name.slice(4));
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
  art.has = function (name) { return !!(cache[name] || DCW.artDefs[name] || DCW.artProcs[name] || (typeof name === 'string' && name.indexOf('box_') === 0 && name.length > 4)); };
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
     SIDE-SCROLL TILES  (16x16, chunk chars # X = ^ ~ H b L), day + night
     ===================================================================== */
  // theme specs: outline/shade + body/top/alt/plat/spike/liquid/ladder/crate painters and colours.
  // smoke: wisps rise from the slat gaps of top ground tiles. nk: night strength (interiors are milder).
  var TT = {
    village: {
      ol: '#140a04', sh: '#2c1808', smoke: '#9c8c74', nk: 1,
      body: { k: 'cribbing', base: '#5c3418', a: '#4c2c14', h: '#7c4c24', s: '#1c0c04', g: '#c84010' },
      top: { k: 'slats', d: '#3c2410', m: '#a8743c', l: '#e0b070', x: '#1c0c04' },
      alt: { k: 'halftimber', p: '#b8a080', P: '#9c8466', m: '#5c3418', l: '#8c5c2c', d: '#2c1808' },
      plat: { k: 'plank', d: '#4c2c10', m: '#a8743c', l: '#e0b070', x: '#5c5c5c' },
      spike: { k: 'stake', l: '#e0b070', m: '#a8743c', d: '#4c2c10', b: '#2c1808' },
      liq: { k: 'lava', d: '#881400', m: '#e45c10', l: '#fca044', x: '#f8d878' },
      lad: { k: 'wood', m: '#a8743c', l: '#e0b070', d: '#4c2c10' },
      crate: { k: 'barrel', d: '#4c2c10', m: '#9c6430', l: '#d0985c', h: '#5c5c5c' }
    },
    ruins: {
      ol: '#0c0a06', sh: '#241c14', nk: 1,
      body: { k: 'mossbrick', m: '#2c2018', a: '#6c4c3c', b: '#5c3c30', h: '#8c6c58', s: '#3c2c24', g: '#3c6c20', G: '#5c9430' },
      top: { k: 'moss', d: '#284410', m: '#4c7c20', l: '#88b838', x: '#c8e070' },
      alt: { k: 'blocks', m: '#24201c', a: '#5c5850', b: '#4c4840', h: '#7c786c', s: '#302c28', g: '#3c6c20' },
      plat: { k: 'plank', d: '#3c2c1c', m: '#7c6448', l: '#a88c68', x: '#3c6c20' },
      spike: { k: 'spike', l: '#bcbcbc', m: '#8c6c50', d: '#4c2810', b: '#3c2c24' },
      liq: { k: 'water', d: '#2c4000', m: '#58a000', l: '#a8d838', x: '#e0f8a0' },
      lad: { k: 'vine', m: '#3c7c18', l: '#70b830', d: '#1c3c08' },
      crate: { k: 'crate', d: '#4c3418', m: '#8c6c3c', l: '#bc9c64' }
    },
    circus: {
      ol: '#0c0804', sh: '#20140a', nk: 1,
      body: { k: 'dirt', base: '#3c2814', a: '#4c3418', h: '#6c4c24', s: '#24180c', d: '#7c7464' },
      top: { k: 'grass', d: '#1c4c10', m: '#2c7c18', l: '#58b830', x: '#f878f8' },
      alt: { k: 'wagon', base: '#8c1830', h: '#c83c48', s: '#4c0818', y: '#f8b800', Y: '#f8d878' },
      plat: { k: 'stripe', d: '#881400', m: '#c81830', l: '#e8e0d0', x: '#f8b800' },
      spike: { k: 'spike', l: '#fcfcfc', m: '#bcbcbc', d: '#7c7c7c', b: '#881400' },
      liq: { k: 'water', d: '#1c2c10', m: '#3c5428', l: '#6c8c48', x: '#a8c888' },
      lad: { k: 'rope', m: '#e4a050', l: '#fce0a8', d: '#7c4c18' },
      crate: { k: 'crate', d: '#881400', m: '#c81830', l: '#f8b800' }
    },
    basement: {
      ol: '#08080a', sh: '#1c1a20', nk: 0.6,
      body: { k: 'blocks', m: '#141418', a: '#4c4850', b: '#403c48', h: '#6c6874', s: '#28242c' },
      top: { k: 'wet', d: '#28242c', m: '#6c6874', l: '#9c98a4', x: '#58a8d8' },
      alt: { k: 'brick', m: '#2c140c', a: '#7c3420', b: '#6c2c1c', h: '#9c4c30', s: '#3c180c' },
      plat: { k: 'shelf', d: '#2c1808', m: '#6c4420', l: '#9c6c38', x: '#7c7c7c' },
      spike: { k: 'spike', l: '#a4e4fc', m: '#3cbcfc', d: '#0058f8', b: '#28242c' },
      liq: { k: 'water', d: '#002848', m: '#0058a8', l: '#3c9cf8', x: '#a4e4fc' },
      lad: { k: 'metal', m: '#7c5c48', l: '#a88870', d: '#3c2c20' },
      crate: { k: 'crate', d: '#3c2810', m: '#7c5830', l: '#a8804c' }
    },
    settlement: {
      ol: '#100a08', sh: '#2c2018', smoke: '#a89c88', nk: 1,
      body: { k: 'cobble', base: '#3c3438', a: '#6c6064', h: '#8c8084', s: '#1c1418', d: '#544a4e' },
      top: { k: 'slats', d: '#3c2410', m: '#b88448', l: '#ecc080', x: '#1c0c04' },
      alt: { k: 'blocks', m: '#2c2420', a: '#8c7460', b: '#7c6450', h: '#b09878', s: '#4c3c30' },
      plat: { k: 'awning', d: '#0c3c3c', m: '#188c7c', l: '#e8d8b0', x: '#6c4420' },
      spike: { k: 'stake', l: '#e8d8b0', m: '#a89878', d: '#4c3c30', b: '#2c2420' },
      liq: { k: 'lava', d: '#881400', m: '#e45c10', l: '#fca044', x: '#f8d878' },
      lad: { k: 'wood', m: '#a8743c', l: '#e0b070', d: '#4c2c10' },
      crate: { k: 'crate', d: '#503000', m: '#ac7c00', l: '#fca044' }
    },
    alley: {
      ol: '#060404', sh: '#1c1010', nk: 1,
      body: { k: 'brick', m: '#140c0c', a: '#4c2c28', b: '#3c2420', h: '#6c403c', s: '#24140c' },
      top: { k: 'grime', d: '#1c1414', m: '#4c4444', l: '#7c7070', x: '#3c6c8c' },
      alt: { k: 'boarded', d: '#24140a', m: '#5c3c20', l: '#8c6434', x: '#9c9c9c' },
      plat: { k: 'plank', d: '#3c2410', m: '#7c5430', l: '#a87c4c', x: '#7c7c7c' },
      spike: { k: 'glass', l: '#b8f8b8', m: '#58a858', d: '#1c5c1c', b: '#24140c' },
      liq: { k: 'water', d: '#1c2410', m: '#3c5420', l: '#6c8c38', x: '#a8c878' },
      lad: { k: 'metal', m: '#6c6c6c', l: '#9c9c9c', d: '#2c2c2c' },
      crate: { k: 'barrel', d: '#3c2410', m: '#7c5430', l: '#a87c4c', h: '#4c4c4c' }
    },
    admin: {
      ol: '#0c0a10', sh: '#2c2834', nk: 1,
      body: { k: 'marble', base: '#8c8494', a: '#7c7484', h: '#b0a8b8', s: '#4c4454', d: '#a49cac', v: '#5c5468' },
      top: { k: 'stonecap', d: '#4c4454', m: '#c0b8c8', l: '#ece4f0', x: '#9c94a4' },
      alt: { k: 'blocks', m: '#4c4454', a: '#a098a8', b: '#948ca0', h: '#d0c8d8', s: '#6c6478' },
      plat: { k: 'shelf', d: '#4c4454', m: '#a098a8', l: '#d8d0e0', x: '#c8a040' },
      spike: { k: 'spike', l: '#f8d878', m: '#c8a040', d: '#7c5c18', b: '#4c4454' },
      liq: { k: 'water', d: '#003c6c', m: '#0070c0', l: '#58b8f8', x: '#d8f0fc' },
      lad: { k: 'metal', m: '#a88c48', l: '#d8bc70', d: '#5c4818' },
      crate: { k: 'crate', d: '#4c4454', m: '#8c8494', l: '#c0b8c8' }
    },
    office: {
      ol: '#0c0402', sh: '#200c04', nk: 0.55,
      body: { k: 'boards', base: '#5c3014', a: '#4c2810', h: '#7c4420', s: '#200c04' },
      top: { k: 'floor', d: '#3c1c08', m: '#b06430', l: '#e09450', x: '#5c2c10' },
      alt: { k: 'cabinet', base: '#5c6c6c', h: '#8c9c9c', s: '#2c3434', y: '#c8a040' },
      plat: { k: 'plushshelf', d: '#2c1404', m: '#6c3818', l: '#9c5c30', x: '#c8a040' },
      spike: { k: 'spike', l: '#fcfcfc', m: '#bcbcbc', d: '#5c5c5c', b: '#200c04' },
      liq: { k: 'water', d: '#04041c', m: '#141448', l: '#2c2c7c', x: '#7c7cc8' },
      lad: { k: 'wood', m: '#7c4420', l: '#a86c38', d: '#3c1c08' },
      crate: { k: 'box', d: '#5c4020', m: '#a8844c', l: '#d8b878' }
    },
    nest: {
      ol: '#0c0204', sh: '#280408', nk: 0.6,
      body: { k: 'flesh', base: '#4c1018', a: '#6c1820', h: '#9c3038', s: '#280408', d: '#c8b090', v: '#7c2c58' },
      top: { k: 'gore', d: '#3c0408', m: '#8c1018', l: '#c82830', x: '#f8a4a4' },
      alt: { k: 'ribs', base: '#2c0c10', h: '#e0d0b0', m: '#b0a080', s: '#605040' },
      plat: { k: 'bone', d: '#605040', m: '#b0a080', l: '#e8dcc0', x: '#8c1018' },
      spike: { k: 'spike', l: '#e8dcc0', m: '#b0a080', d: '#605040', b: '#3c0408' },
      liq: { k: 'water', d: '#3c0008', m: '#8c0818', l: '#c82030', x: '#f87878' },
      lad: { k: 'vine', m: '#8c1c28', l: '#c84858', d: '#3c0408' },
      crate: { k: 'sac', d: '#5c2c3c', m: '#a85c6c', l: '#e0a0a8' }
    },
    ymca: {
      ol: '#0c0c10', sh: '#24242c', nk: 0.6,
      body: { k: 'concrete', base: '#5c5c6c', h: '#7c7c8c', s: '#3c3c48', d: '#6c6c7c', x: '#a81000' },
      top: { k: 'court', d: '#5c3410', m: '#c88c48', l: '#f0c078', x: '#e40058' },
      alt: { k: 'lockers', base: '#2c4c8c', h: '#4c74c0', s: '#18284c', y: '#bcbcbc' },
      plat: { k: 'bleacher', d: '#3c2410', m: '#a87c48', l: '#d8b078', x: '#7c7c7c' },
      spike: { k: 'spike', l: '#fcfcfc', m: '#bcbcbc', d: '#7c7c7c', b: '#3c3c48' },
      liq: { k: 'water', d: '#004c8c', m: '#0088d8', l: '#58c8f8', x: '#d8f8fc' },
      lad: { k: 'rope', m: '#e4c890', l: '#fcf0c8', d: '#8c6c38' },
      crate: { k: 'crate', d: '#503000', m: '#ac7c00', l: '#fca044' }
    },
    school: {
      ol: '#0c0604', sh: '#2c140c', nk: 0.6,
      body: { k: 'brick', m: '#3c140c', a: '#8c3424', b: '#7c2c1c', h: '#ac5038', s: '#4c1c10' },
      top: { k: 'checker', d: '#2c2c38', m: '#c8c0b0', l: '#f0e8d8', x: '#3c3c4c' },
      alt: { k: 'lockers', base: '#2c6c4c', h: '#48987c', s: '#143424', y: '#bcbcbc' },
      plat: { k: 'shelf', d: '#3c2410', m: '#8c6438', l: '#b88c58', x: '#5c5c5c' },
      spike: { k: 'spike', l: '#f8d878', m: '#e4a050', d: '#7c4c18', b: '#3c140c' },
      liq: { k: 'water', d: '#2c0c4c', m: '#6c2ca8', l: '#a868e8', x: '#e8c8fc' },
      lad: { k: 'wood', m: '#8c6438', l: '#b88c58', d: '#3c2410' },
      crate: { k: 'box', d: '#5c4020', m: '#a8844c', l: '#d8b878' }
    },
    depot: {
      ol: '#08080c', sh: '#1c2028', nk: 0.7,
      body: { k: 'metal', base: '#3c4048', h: '#646c78', s: '#1c2028', r: '#8c949c' },
      top: { k: 'plate', d: '#1c2028', m: '#7c848c', l: '#bcc4cc', x: '#c8a040' },
      alt: { k: 'blocks', m: '#18181c', a: '#4c4c54', b: '#44444c', h: '#6c6c78', s: '#2c2c34' },
      plat: { k: 'grate', d: '#1c2028', m: '#5c646c', l: '#9ca4ac', x: '#c8a040' },
      spike: { k: 'spike', l: '#d8e0e8', m: '#8c949c', d: '#3c4048', b: '#1c2028' },
      liq: { k: 'water', d: '#08304c', m: '#1880b0', l: '#40d0f0', x: '#c8f8fc' },
      lad: { k: 'metal', m: '#7c848c', l: '#bcc4cc', d: '#2c3038' },
      crate: { k: 'crate', d: '#283018', m: '#4c5c2c', l: '#7c8c48' }
    },
    escape: {
      ol: '#080404', sh: '#1c100c', smoke: '#c898d8', nk: 1,
      body: { k: 'cracked', base: '#3c2418', a: '#2c1c14', h: '#5c3c2c', s: '#100806', g: '#d860f8', G: '#fcd8fc' },
      top: { k: 'slats', d: '#1c1008', m: '#8c5c34', l: '#c08850', x: '#2c0c3c' },
      alt: { k: 'rock', base: '#3c3438', a: '#4c4448', h: '#6c6468', s: '#1c1418', d: '#5c3c6c' },
      plat: { k: 'plank', d: '#2c1c10', m: '#6c4c30', l: '#9c7448', x: '#d860f8' },
      spike: { k: 'spike', l: '#f8d8f8', m: '#d878f8', d: '#6c28a8', b: '#2c1c18' },
      liq: { k: 'lava', d: '#4c0874', m: '#9838d8', l: '#e078f8', x: '#fcfcfc' },
      lad: { k: 'metal', m: '#6c5c5c', l: '#9c8c8c', d: '#2c2020' },
      crate: { k: 'crate', d: '#3c2410', m: '#7c5430', l: '#a87c4c' }
    },
    restroom: {
      ol: '#080c0a', sh: '#243028', nk: 0.6,
      body: { k: 'tilewall', base: '#8c9890', a: '#78867c', h: '#b4c0b8', s: '#4c5850', g: '#5c6a60', x: '#6c5420' },
      top: { k: 'tiles', d: '#2c3c34', m: '#5c8c74', l: '#9cc8b0', x: '#e0ece4' },
      alt: { k: 'lockers', base: '#4c7c8c', h: '#6c9cac', s: '#284c58', y: '#bcbcbc' },
      plat: { k: 'shelf', d: '#4c5850', m: '#b4c0b8', l: '#e4ece8', x: '#9c9c9c' },
      spike: { k: 'glass', l: '#fcfcfc', m: '#d0d8d4', d: '#7c8880', b: '#4c5850' },
      liq: { k: 'water', d: '#3c2c08', m: '#7c5c18', l: '#ac8c38', x: '#e0d090' },
      lad: { k: 'metal', m: '#9c9c9c', l: '#d0d0d0', d: '#4c4c4c' },
      crate: { k: 'box', d: '#5c4020', m: '#a8844c', l: '#d8b878' }
    },
    temple: {
      ol: '#060408', sh: '#1c1424', nk: 0.6,
      body: { k: 'obsidian', base: '#1c1424', a: '#281c34', h: '#4c3c5c', s: '#0c0810', v: '#9838d8' },
      top: { k: 'altar', d: '#281c34', m: '#6c5c7c', l: '#a898b8', x: '#c8a040' },
      alt: { k: 'runes', m: '#140c1c', a: '#3c2c4c', b: '#342844', h: '#5c4c6c', s: '#201828', g: '#b858f8' },
      plat: { k: 'shelf', d: '#281c34', m: '#7c6c8c', l: '#b0a0c0', x: '#c8a040' },
      spike: { k: 'spike', l: '#f8d8f8', m: '#b858f8', d: '#4c1c7c', b: '#140c1c' },
      liq: { k: 'lava', d: '#28083c', m: '#6c18a8', l: '#b058f8', x: '#f0c8fc' },
      lad: { k: 'chain', m: '#7c7484', l: '#b0a8b8', d: '#2c2834' },
      crate: { k: 'crate', d: '#2c1c34', m: '#5c4c6c', l: '#8c7c9c' }
    }
  };
  art.themes = Object.keys(TT);
  // ids that are not themes resolve here first (book 1 ids, backdrops, typos), then to 'ruins'
  var ALIAS = {
    sewer: 'basement', cave: 'basement', bubble: 'basement', city: 'settlement', town: 'village', street: 'village',
    swamp: 'ruins', forest: 'circus', park: 'circus', circus_park: 'circus', ruin: 'ruins', ruins_w: 'ruins', ruins_e: 'ruins',
    train: 'depot', castle: 'temple', warzone: 'escape', raceway: 'settlement', parade: 'settlement', east_stairs: 'escape',
    bigtop: 'circus', lair: 'basement', tower: 'admin', climb: 'admin', gym: 'ymca', apito: 'school', market: 'settlement',
    safe: 'inn_pug', inn: 'inn_pug', pug: 'inn_pug', narwhal: 'inn_narwhal', desperado: 'club', show: 'studio', danger_zone: 'studio', green_room: 'greenroom', guide: 'guide_room'
  };
  // tiles for backdrop ids (UI scenes draw a floor under an inn backdrop)
  var TILE_OF_BACKDROP = { inn_pug: 'office', inn_narwhal: 'office', club: 'temple', studio: 'school', greenroom: 'office', guide_room: 'admin' };
  function resolveTheme(theme, table) {
    if (table[theme]) return theme;
    var a = ALIAS[theme];
    if (a && table[a]) return a;
    if (a && TILE_OF_BACKDROP[a] && table === TT) return TILE_OF_BACKDROP[a];
    if (TILE_OF_BACKDROP[theme] && table === TT) return TILE_OF_BACKDROP[theme];
    return null;
  }
  art.resolveTheme = function (theme) { return resolveTheme(theme, TT) || resolveTheme(theme, BG2) || resolveTheme(theme, BD) || 'ruins'; };

  // night: darker, cooler. k = strength (0..1)
  function nightCol(c, k) {
    if (typeof c !== 'string' || c.charAt(0) !== '#') return c;
    var p = parseColor(c);
    return hex(p[0] * (1 - 0.46 * k) + 3 * k, p[1] * (1 - 0.40 * k) + 5 * k, p[2] * (1 - 0.16 * k) + 16 * k);
  }
  var nightSpecs = {};
  function nightSpec(theme) {
    var s = nightSpecs[theme];
    if (s) return s;
    var src = TT[theme], k = src.nk === undefined ? 1 : src.nk;
    function map(o) {
      var r = {};
      for (var key in o) if (o.hasOwnProperty(key)) r[key] = (key === 'k' || key === 'nk') ? o[key] : (typeof o[key] === 'object' && o[key] ? map(o[key]) : nightCol(o[key], k));
      return r;
    }
    s = nightSpecs[theme] = map(src);
    if (src.liq.k === 'lava') s.liq = src.liq; // embers and magic fire glow just as bright at night
    s.night = true;
    return s;
  }

  /* ---- body textures (fill the whole tile, seamless at 16px) ---- */
  function ellW(g, cx, cy, rw, rh, c) {
    for (var dy = -rh; dy <= rh; dy++) for (var dx = -rw; dx <= rw; dx++) {
      if ((dx * dx) / ((rw + 0.5) * (rw + 0.5)) + (dy * dy) / ((rh + 0.5) * (rh + 0.5)) <= 1) PW(g, cx + dx, cy + dy, c);
    }
  }
  function RW(g, x, y, w, h, c) { // rect that wraps horizontally inside a 16px tile
    x = ((x % 16) + 16) % 16;
    R(g, x, y, Math.min(w, 16 - x), h, c);
    if (x + w > 16) R(g, 0, y, x + w - 16, h, c);
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
      if (c.g) for (i = 0; i < 5; i++) { var mx = (r() * 16) | 0, my = (r() * 16) | 0; PW(g, mx, my, c.g); PW(g, mx + 1, my, c.g); if (r() < 0.5) PW(g, mx, my + 1, c.g); }
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
    // under-street timber cribbing: heavy beams, dark gaps with ember glow from the volcano below
    cribbing: function (g, c, r) {
      R(g, 0, 0, 16, 16, c.s);
      for (var row = 0; row < 2; row++) {
        var y = row * 8, sx = (row ? 9 : 3) + ((r() * 3) | 0);
        R(g, 0, y, 16, 7, row ? c.a : c.base); R(g, 0, y, 16, 1, c.h); R(g, 0, y + 6, 16, 1, c.s);
        RW(g, sx, y, 1, 7, c.s); PW(g, sx + 1, y + 1, c.h); PW(g, sx - 1, y + 5, c.s);
        RW(g, sx + 4, y + 3, 5, 1, row ? c.base : c.a); RW(g, sx + 10, y + 2, 3, 1, c.s);
        PW(g, sx + 2, y + 4, c.s);
      }
      for (var x = 0; x < 16; x++) { if (r() < 0.22) P(g, x, 7, c.g); if (r() < 0.12) P(g, x, 15, c.g); }
    },
    mossbrick: function (g, c, r) {
      BODY.brick(g, c, r);
      for (var i = 0; i < 4; i++) {
        var x = (r() * 16) | 0, y = (r() * 14) | 0, n = 2 + ((r() * 4) | 0);
        for (var k = 0; k < n; k++) { PW(g, x + k, y, c.g); if (r() < 0.6) PW(g, x + k, y + 1, k & 1 ? c.G : c.g); if (r() < 0.25) PW(g, x + k, y + 2, c.g); }
      }
      if (r() < 0.5) { var vx = (r() * 16) | 0; for (var vy = 0; vy < 7; vy++) PW(g, vx + ((vy >> 1) & 1), vy, vy & 1 ? c.G : c.g); }
    },
    cobble: function (g, c, r) {
      R(g, 0, 0, 16, 16, c.s);
      for (var row = 0; row < 4; row++) {
        var y = row * 4, off = (row & 1) ? 3 : 0;
        for (var bx = 0; bx < 16; bx += 6) {
          var x = bx + off + ((r() * 2) | 0), w = 4 + ((r() * 2) | 0), col = r() < 0.4 ? c.d : c.a;
          RW(g, x + 1, y, w - 2, 1, col); RW(g, x, y + 1, w, 2, col);
          RW(g, x + 1, y, w - 2, 1, c.h); PW(g, x, y + 1, c.h); RW(g, x + 1, y + 2, w - 1, 1, c.base);
        }
      }
    },
    marble: function (g, c, r) {
      R(g, 0, 0, 16, 16, c.base);
      for (var row = 0; row < 2; row++) {
        var y = row * 8, sx = row ? 11 : 3;
        R(g, 0, y, 16, 1, c.h); R(g, 0, y + 7, 16, 1, c.s); RW(g, sx, y, 1, 8, c.s); RW(g, sx + 1, y + 1, 1, 6, c.h);
        if (r() < 0.6) R(g, 0, y + 1, 16, 6, c.a), R(g, 0, y + 1, 16, 1, c.d);
      }
      var x = (r() * 16) | 0, yy = 1;
      for (var i = 0; i < 14; i++) { PW(g, x, yy, c.v); yy++; if (r() < 0.55) x += r() < 0.6 ? 1 : -1; if (yy === 7 || yy === 8) continue; }
      for (i = 0; i < 4; i++) PW(g, (r() * 16) | 0, (r() * 16) | 0, c.d);
    },
    flesh: function (g, c, r) {
      R(g, 0, 0, 16, 16, c.base);
      for (var i = 0; i < 5; i++) ellW(g, (r() * 16) | 0, (r() * 16) | 0, 2 + ((r() * 2) | 0), 1 + ((r() * 2) | 0), i & 1 ? c.a : c.s);
      for (i = 0; i < 3; i++) { var x = (r() * 16) | 0, y = (r() * 16) | 0; PW(g, x, y, c.h); PW(g, x + 1, y, c.h); PW(g, x, y + 1, c.a); }
      var vx = (r() * 16) | 0, vy = 0;
      for (i = 0; i < 18; i++) { PW(g, vx, vy, c.v); vy++; if (r() < 0.5) vx += r() < 0.5 ? 1 : -1; if (vy > 15) break; }
      if (r() < 0.4) { x = 2 + ((r() * 10) | 0); y = 3 + ((r() * 9) | 0); R(g, x, y, 4, 1, c.d); P(g, x - 1, y - 1, c.d); P(g, x - 1, y + 1, c.d); P(g, x + 4, y - 1, c.d); P(g, x + 4, y + 1, c.d); }
    },
    tilewall: function (g, c, r) {
      R(g, 0, 0, 16, 16, c.g);
      for (var ty = 0; ty < 4; ty++) for (var tx = 0; tx < 4; tx++) {
        var col = ((tx + ty) & 1) ? c.a : c.base;
        R(g, tx * 4, ty * 4, 3, 3, col); P(g, tx * 4, ty * 4, c.h);
      }
      for (var i = 0; i < 3; i++) { var x = (r() * 15) | 0, y = 6 + ((r() * 10) | 0); PW(g, x, y, c.x); PW(g, x, y + 1, c.x); }
      if (r() < 0.35) { x = (r() * 12) | 0; y = (r() * 12) | 0; line(g, x, y, x + 3, y + 3, c.s); }
    },
    obsidian: function (g, c, r) {
      R(g, 0, 0, 16, 16, c.base);
      for (var row = 0; row < 2; row++) {
        var y = row * 8, sx = row ? 10 : 2;
        R(g, 0, y, 16, 1, c.h); R(g, 0, y + 7, 16, 1, c.s); RW(g, sx, y, 1, 8, c.s);
        RW(g, sx + 2, y + 2, 3, 1, c.a); RW(g, sx + 1, y + 1, 1, 2, c.h);
      }
      if (r() < 0.75) {
        var x = (r() * 16) | 0, yy = (r() * 6) | 0;
        for (var i = 0; i < 9; i++) { PW(g, x, yy, c.v); yy++; x += r() < 0.5 ? 1 : (r() < 0.5 ? -1 : 0); }
      }
    },
    cracked: function (g, c, r) {
      BODY.cribbing(g, { base: c.base, a: c.a, h: c.h, s: c.s, g: c.g }, r);
      var x = (r() * 16) | 0, y = 0;
      for (var i = 0; i < 16; i++) { PW(g, x, y, i & 1 ? c.g : c.G); y++; if (r() < 0.6) x += r() < 0.5 ? 1 : -1; }
    }
  };

  /* ---- surface tops (only where nothing solid is above); return thickness ---- */
  var TOP = {
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
    floor: function (g, c) {
      R(g, 0, 0, 16, 4, c.m); R(g, 0, 0, 16, 1, c.l); R(g, 0, 4, 16, 1, c.d); R(g, 0, 5, 16, 1, c.x);
      P(g, 7, 1, c.d); P(g, 7, 2, c.d); P(g, 7, 3, c.d); P(g, 3, 2, c.l); P(g, 11, 2, c.l);
      return 5;
    },
    stonecap: function (g, c) {
      R(g, 0, 0, 16, 5, c.m); R(g, 0, 0, 16, 1, c.l); R(g, 0, 1, 16, 1, c.l); R(g, 0, 4, 16, 1, c.x); R(g, 0, 5, 16, 1, c.d);
      R(g, 7, 2, 1, 3, c.x); P(g, 3, 3, c.x); P(g, 12, 2, c.x);
      return 5;
    },
    plate: function (g, c) {
      R(g, 0, 0, 16, 6, c.m); R(g, 0, 0, 16, 1, c.l);
      for (var y = 2; y < 5; y++) for (var x = 0; x < 16; x++) P(g, x, y, ((x + y) & 4) ? c.x : '#202020');
      R(g, 0, 6, 16, 1, c.d); P(g, 1, 1, c.d); P(g, 14, 1, c.d);
      return 6;
    },
    // the Over City street: ends of wooden slats with dark gaps between (smoke rises through them)
    slats: function (g, c, r) {
      R(g, 0, 0, 16, 6, c.m); R(g, 0, 0, 16, 1, c.l);
      for (var x = 0; x < 16; x += 4) {
        R(g, x + 3, 0, 1, 6, c.x); P(g, x, 1, c.l); P(g, x + 2, 4, c.d);
        if (r() < 0.5) P(g, x + 1, 2 + ((r() * 3) | 0), c.d);
      }
      R(g, 0, 5, 16, 1, c.d); R(g, 0, 6, 16, 1, c.x);
      P(g, 1, 3, c.d);
      return 6;
    },
    wet: function (g, c, r) {
      R(g, 0, 0, 16, 5, c.m); R(g, 0, 0, 16, 1, c.l);
      for (var x = 0; x < 16; x++) { if (r() < 0.25) P(g, x, 2, c.l); if (r() < 0.2) P(g, x, 3, c.d); }
      var px = 2 + ((r() * 8) | 0); R(g, px, 0, 4 + ((r() * 3) | 0), 1, c.x); P(g, px + 1, 1, c.x);
      R(g, 0, 5, 16, 1, c.d);
      return 5;
    },
    grime: function (g, c, r) {
      R(g, 0, 0, 16, 5, c.m); R(g, 0, 0, 16, 1, c.l);
      for (var x = 0; x < 16; x += 4) { R(g, x + 3, 1, 1, 3, c.d); }
      for (x = 0; x < 16; x++) if (r() < 0.2) P(g, x, 2 + ((r() * 2) | 0), c.d);
      if (r() < 0.5) { var px = (r() * 10) | 0; R(g, px, 0, 5, 1, c.x); }
      if (r() < 0.4) { px = (r() * 13) | 0; P(g, px, 1, '#a8a898'); P(g, px + 1, 1, '#6c6c5c'); }
      R(g, 0, 5, 16, 1, c.d);
      return 5;
    },
    gore: function (g, c, r) {
      R(g, 0, 0, 16, 4, c.m); R(g, 0, 0, 16, 1, c.l);
      for (var x = 0; x < 16; x++) { if (r() < 0.5) P(g, x, 4, c.m); if (r() < 0.25) P(g, x, 1, c.x); }
      R(g, 0, 4, 16, 1, c.d);
      for (var i = 0; i < 3; i++) { x = 1 + ((r() * 13) | 0); var len = 2 + ((r() * 7) | 0); R(g, x, 4, 1 + (i & 1), len, c.m); P(g, x, 4 + len, c.l); }
      return 4;
    },
    court: function (g, c, r) {
      R(g, 0, 0, 16, 5, c.m); R(g, 0, 0, 16, 1, c.l); R(g, 0, 2, 16, 1, c.x);
      R(g, 5, 1, 1, 4, c.d); R(g, 13, 1, 1, 4, c.d); P(g, 2, 3, c.l); P(g, 9, 4, c.l);
      R(g, 0, 5, 16, 1, c.d);
      return 5;
    },
    checker: function (g, c) {
      for (var x = 0; x < 16; x++) for (var y = 1; y < 5; y++) P(g, x, y, ((x >> 2) + ((y - 1) >> 1)) & 1 ? c.x : c.m);
      R(g, 0, 0, 16, 1, c.l); R(g, 0, 5, 16, 1, c.d);
      return 5;
    },
    tiles: function (g, c, r) {
      for (var x = 0; x < 16; x++) for (var y = 1; y < 5; y++) P(g, x, y, ((x >> 2) + (y >> 2)) & 1 ? c.m : c.l);
      for (x = 3; x < 16; x += 4) R(g, x, 1, 1, 4, c.d);
      R(g, 0, 0, 16, 1, c.x); R(g, 0, 5, 16, 1, c.d);
      if (r() < 0.5) { var px = (r() * 12) | 0; P(g, px, 2, '#7c5c18'); P(g, px + 1, 3, '#7c5c18'); }
      return 5;
    },
    altar: function (g, c, r) {
      R(g, 0, 0, 16, 5, c.m); R(g, 0, 0, 16, 1, c.l); R(g, 0, 3, 16, 1, c.x);
      P(g, 4, 1, c.l); P(g, 12, 2, c.l); P(g, 8, 4, '#9838d8');
      R(g, 0, 5, 16, 1, c.d);
      return 5;
    }
  };

  /* ---- alternate solid 'X' ---- */
  var ALT = {
    halftimber: function (g, c) { // plaster panel in a timber frame with a brace
      R(g, 0, 0, 16, 16, c.p);
      for (var y = 1; y < 15; y += 3) { P(g, 3 + (y % 5), y, c.P); P(g, 10 + (y % 3), y + 1, c.P); }
      R(g, 0, 0, 16, 2, c.m); R(g, 0, 14, 16, 2, c.m); R(g, 0, 0, 2, 16, c.m); R(g, 14, 0, 2, 16, c.m);
      R(g, 0, 0, 16, 1, c.l); R(g, 0, 0, 1, 16, c.l); R(g, 0, 15, 16, 1, c.d); R(g, 15, 0, 1, 16, c.d);
      for (var i = 0; i < 12; i++) { P(g, 2 + i, 13 - i, c.m); P(g, 3 + i, 13 - i, c.m); P(g, 3 + i, 14 - i, c.d); }
      P(g, 4, 4, c.d); P(g, 11, 11, c.d);
    },
    wagon: function (g, c) { // circus wagon side panel: red with gold trim and a scroll
      R(g, 0, 0, 16, 16, c.base); R(g, 0, 0, 16, 2, c.y); R(g, 0, 14, 16, 2, c.y); R(g, 0, 0, 16, 1, c.Y);
      R(g, 0, 2, 16, 1, c.s); R(g, 0, 13, 16, 1, c.s); R(g, 1, 3, 1, 10, c.h);
      rows(g, 4, 5, ['.yyy..', 'y...y.', 'y.y.y.', 'y..y..', '.y....', '..yyyy'], { y: c.y });
      P(g, 11, 6, c.Y); P(g, 12, 9, c.y); P(g, 13, 7, c.y);
    },
    column: function (g, c) { // fluted column section
      R(g, 0, 0, 16, 16, c.s); R(g, 1, 0, 14, 16, c.base);
      for (var x = 3; x < 14; x += 3) { R(g, x, 0, 1, 16, c.s); R(g, x - 1, 0, 1, 16, c.h); }
      R(g, 1, 0, 1, 16, c.h); R(g, 14, 0, 1, 16, c.s);
      R(g, 0, 7, 16, 1, c.y); R(g, 0, 8, 16, 1, c.s);
    },
    cabinet: function (g, c) { // filing cabinet: two drawers
      R(g, 0, 0, 16, 16, c.s); R(g, 1, 0, 14, 16, c.base);
      for (var d = 0; d < 2; d++) {
        var y = d * 8; R(g, 2, y + 1, 12, 6, c.h); R(g, 3, y + 2, 10, 4, c.base);
        R(g, 6, y + 3, 4, 1, c.y); R(g, 5, y + 5, 6, 1, c.s); P(g, 4, y + 2, '#fcfcfc');
      }
    },
    ribs: function (g, c) { // a wall of bones
      R(g, 0, 0, 16, 16, c.base);
      for (var y = 1; y < 16; y += 5) {
        for (var x = 0; x < 16; x++) { var yy = y + Math.round(Math.sin(x / 15 * Math.PI) * -2); P(g, x, yy, c.h); P(g, x, yy + 1, c.m); P(g, x, yy + 2, c.s); }
      }
      R(g, 7, 0, 2, 16, c.m); R(g, 7, 0, 1, 16, c.h); P(g, 3, 4, c.s); P(g, 12, 9, c.s);
    },
    lockers: function (g, c) { // two lockers / stall panels
      R(g, 0, 0, 16, 16, c.s);
      for (var i = 0; i < 2; i++) {
        var x = i * 8; R(g, x + 1, 0, 6, 16, c.base); R(g, x + 1, 0, 1, 16, c.h);
        for (var v = 2; v < 7; v += 2) R(g, x + 2, v, 4, 1, c.s);
        R(g, x + 5, 9, 1, 2, c.y); P(g, x + 2, 13, c.h);
      }
    },
    boarded: function (g, c) { // boarded-up planks with a diagonal brace
      R(g, 0, 0, 16, 16, c.d);
      for (var y = 0; y < 16; y += 4) { R(g, 0, y, 16, 3, c.m); R(g, 0, y, 16, 1, c.l); P(g, 2, y + 1, c.x); P(g, 13, y + 1, c.x); }
      for (var i = 0; i < 14; i++) { P(g, 1 + i, 1 + i, c.l); P(g, 2 + i, 1 + i, c.m); P(g, 2 + i, 2 + i, c.d); }
    },
    runes: function (g, c, r) { // temple block with a glowing corrupt rune
      BODY.blocks(g, c, r);
      rows(g, 5, 4, ['.g.g.', 'ggggg', '..g..', '.g.g.', 'g...g'], { g: c.g });
    },
    panel: function (g, c) {
      R(g, 0, 0, 16, 16, c.m);
      R(g, 0, 0, 16, 2, c.x); R(g, 0, 2, 16, 1, c.d);
      R(g, 2, 4, 12, 10, c.d); R(g, 3, 5, 10, 8, c.m); R(g, 3, 5, 10, 1, c.l); R(g, 3, 5, 1, 8, c.l);
      R(g, 0, 15, 16, 1, c.d); P(g, 7, 8, c.x); P(g, 8, 9, c.x);
    }
  };
  ALT.brick = BODY.brick; ALT.blocks = BODY.blocks; ALT.metal = BODY.metal; ALT.rock = BODY.rock;

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
    stripe: function (g, c, L, Rt) {
      for (var y = 1; y < 4; y++) for (var x = 0; x < 16; x++) P(g, x, y, ((x + y) >> 2) & 1 ? c.m : c.l);
      R(g, 0, 0, 16, 1, c.x); R(g, 0, 4, 16, 1, c.x); R(g, 0, 5, 16, 1, '#000000');
      if (!L) { R(g, 0, 0, 1, 6, '#000000'); R(g, 3, 6, 1, 3, c.x); }
      if (!Rt) { R(g, 15, 0, 1, 6, '#000000'); R(g, 12, 6, 1, 3, c.x); }
    },
    shelf: function (g, c, L, Rt) {
      R(g, 0, 0, 16, 4, c.m); R(g, 0, 0, 16, 1, c.l); R(g, 0, 3, 16, 1, c.d); R(g, 0, 4, 16, 1, '#000000');
      R(g, 6, 5, 4, 1, c.x); P(g, 7, 6, c.x); P(g, 8, 6, c.x); P(g, 7, 7, c.x);
      if (!L) R(g, 0, 0, 1, 5, '#000000');
      if (!Rt) R(g, 15, 0, 1, 5, '#000000');
    },
    awning: function (g, c, L, Rt) { // market awning: striped canvas with a scalloped edge
      R(g, 0, 0, 16, 1, c.x);
      for (var x = 0; x < 16; x++) { var col = (x >> 2) & 1 ? c.m : c.l; R(g, x, 1, 1, 4, col); }
      for (x = 0; x < 16; x += 4) { R(g, x, 5, 4, 1, (x >> 2) & 1 ? c.m : c.l); R(g, x + 1, 6, 2, 1, (x >> 2) & 1 ? c.m : c.l); P(g, x, 6, '#000000'); P(g, x + 3, 6, '#000000'); P(g, x + 1, 7, '#000000'); P(g, x + 2, 7, '#000000'); }
      R(g, 0, 4, 16, 1, c.d);
      if (!L) R(g, 0, 0, 1, 6, '#000000');
      if (!Rt) R(g, 15, 0, 1, 6, '#000000');
    },
    plushshelf: function (g, c, L, Rt) { // Quill's shelving: a plank, and stuffed figures crammed on the rail below
      R(g, 0, 0, 16, 4, c.m); R(g, 0, 0, 16, 1, c.l); R(g, 0, 3, 16, 1, c.d); R(g, 0, 4, 16, 1, '#000000');
      var cols = ['#e45878', '#58a8e8', '#f8b800', '#78c850', '#b878e8'];
      for (var i = 0; i < 3; i++) {
        var x = 1 + i * 5, col = cols[(i + (L ? 1 : 0) + (Rt ? 2 : 0)) % 5];
        R(g, x, 6, 3, 3, col); R(g, x, 9, 4, 2, col); P(g, x + 1, 7, '#000000'); P(g, x, 5, col); P(g, x + 2, 5, col);
      }
      R(g, 0, 11, 16, 1, c.d);
      if (!L) R(g, 0, 0, 1, 12, '#000000');
      if (!Rt) R(g, 15, 0, 1, 12, '#000000');
    },
    bone: function (g, c, L, Rt) {
      R(g, 0, 1, 16, 3, c.m); R(g, 0, 1, 16, 1, c.l); R(g, 0, 3, 16, 1, c.d); R(g, 0, 4, 16, 1, '#000000');
      R(g, 6, 5, 4, 2, c.x); P(g, 7, 7, c.x);
      if (!L) { R(g, 0, 0, 3, 5, c.l); R(g, 0, 0, 1, 5, '#000000'); P(g, 2, 2, c.d); }
      if (!Rt) { R(g, 13, 0, 3, 5, c.l); R(g, 15, 0, 1, 5, '#000000'); P(g, 13, 2, c.d); }
    },
    bleacher: function (g, c, L, Rt) {
      R(g, 0, 0, 16, 4, c.m); R(g, 0, 0, 16, 1, c.l); R(g, 0, 3, 16, 1, c.d); R(g, 0, 4, 16, 1, '#000000');
      R(g, 3, 5, 1, 7, c.x); R(g, 12, 5, 1, 7, c.x); line(g, 4, 5, 11, 11, c.x);
      if (!L) R(g, 0, 0, 1, 5, '#000000');
      if (!Rt) R(g, 15, 0, 1, 5, '#000000');
    }
  };

  function paintSpikes(g, c) {
    var stake = c.k === 'stake', glass = c.k === 'glass';
    for (var i = 0; i < 2; i++) {
      var cx = i * 8 + 4;
      for (var y = 2; y < 13; y++) {
        var hw = stake ? (y < 5 ? Math.max(1, y - 2) : 2) : Math.max(1, Math.round((y - 1) * 4 / 11));
        if (glass) hw = Math.max(1, Math.round((y - 1) * 3 / 11) + ((y + i) % 3 === 0 ? 1 : 0));
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
    for (y = 7; y < 16; y += 4) {
      var off = (a * 2 + y * 3) % 16;
      R(g, off, y, 4, 1, lava ? c.l : c.d); R(g, (off + 9) % 16, y + 2, 3, 1, lava ? c.x : c.l);
    }
    if (surf) {
      if (lava) { var bx = (a * 5 + 3) % 14; P(g, bx, 1 + (a & 1), c.x); P(g, bx + 1, 2, c.l); }
      else if (a & 1) P(g, (a * 7) % 16, 8, c.x);
    }
  }
  function paintLadder(g, c) {
    var k = c.k, y;
    if (k === 'vine' || k === 'rope') {
      for (y = 0; y < 16; y++) { var sx = (y >> 1) & 1; P(g, 3 + sx, y, c.m); P(g, 12 - sx, y, c.m); P(g, 4 - sx, y, c.d); P(g, 11 + sx, y, c.d); }
      for (y = 2; y < 16; y += 5) { R(g, 4, y, 8, 1, k === 'rope' ? c.l : c.m); P(g, 5, y + 1, c.d); }
      if (k === 'vine') { P(g, 2, 4, c.l); P(g, 13, 9, c.l); P(g, 2, 13, c.l); P(g, 13, 1, c.l); }
      return;
    }
    if (k === 'chain') {
      for (y = 0; y < 16; y += 4) { R(g, 6, y, 4, 3, c.m); R(g, 7, y + 1, 2, 1, c.d); P(g, 6, y, c.l); R(g, 7, y + 3, 2, 1, c.l); }
      R(g, 3, 0, 1, 16, c.d); R(g, 12, 0, 1, 16, c.d);
      for (y = 2; y < 16; y += 7) R(g, 3, y, 10, 1, c.m);
      return;
    }
    R(g, 2, 0, 2, 16, c.m); R(g, 12, 0, 2, 16, c.m); R(g, 2, 0, 1, 16, c.l); R(g, 12, 0, 1, 16, c.l);
    for (y = 1; y < 16; y += 4) { R(g, 4, y, 8, 2, c.m); R(g, 4, y, 8, 1, c.l); }
  }
  function paintCrate(g, c) {
    if (c.k === 'barrel') {
      R(g, 3, 1, 10, 14, c.m); R(g, 2, 3, 12, 10, c.m); R(g, 3, 1, 2, 14, c.l); R(g, 11, 1, 2, 14, c.d);
      R(g, 7, 1, 1, 14, c.d); R(g, 9, 1, 1, 14, c.l);
      R(g, 2, 3, 12, 1, c.h); R(g, 2, 12, 12, 1, c.h); R(g, 3, 1, 10, 1, c.l); R(g, 3, 14, 10, 1, c.d);
      P(g, 4, 3, '#fcfcfc'); return;
    }
    if (c.k === 'sac') {
      blob(g, 8, 8, 6, 6, c.m); blob(g, 7, 7, 4, 4, c.l); blob(g, 9, 9, 3, 3, c.m);
      line(g, 3, 6, 6, 10, c.d); line(g, 10, 3, 12, 9, c.d); P(g, 5, 4, '#fcfcfc'); P(g, 6, 5, '#fcfcfc'); return;
    }
    if (c.k === 'box') {
      R(g, 1, 3, 14, 12, c.m); R(g, 1, 3, 14, 1, c.l); R(g, 1, 14, 14, 1, c.d); R(g, 14, 3, 1, 12, c.d);
      R(g, 1, 1, 6, 2, c.l); R(g, 9, 1, 6, 2, c.m); R(g, 7, 3, 2, 12, c.d); R(g, 3, 9, 4, 3, c.l); P(g, 4, 10, c.d); P(g, 5, 10, c.d);
      return;
    }
    R(g, 1, 1, 14, 14, c.m);
    R(g, 1, 1, 14, 2, c.l); R(g, 1, 13, 14, 2, c.d); R(g, 1, 1, 2, 14, c.l); R(g, 13, 1, 2, 14, c.d);
    for (var i = 0; i < 10; i++) { P(g, 3 + i, 12 - i, c.l); P(g, 4 + i, 12 - i, c.l); P(g, 4 + i, 13 - i, c.d); }
    R(g, 3, 3, 10, 1, c.d);
    P(g, 2, 2, '#fcfcfc'); P(g, 13, 2, c.d); P(g, 2, 13, c.d); P(g, 13, 13, c.d);
  }

  function paintTile(spec, ch, mask, v, a, seed) {
    var cv = mkCanvas(16, 16), g = g2(cv);
    var r = rng(hashStr(seed + ch) + v * 7919);
    var up = mask & 1, L = mask & 4, Rt = mask & 8, dn = mask & 2;
    if (ch === '#' || ch === 'X') {
      var th = 0;
      if (ch === '#') BODY[spec.body.k](g, spec.body, r);
      else ALT[spec.alt.k](g, spec.alt, r);
      if (!up) {
        if (ch === '#') th = TOP[spec.top.k](g, spec.top, rng(hashStr(seed) + v * 131));
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
      paintCrate(g, spec.crate);
      if (spec.crate.k === 'crate' || spec.crate.k === 'box') { R(g, 0, 1, 1, 14, K); R(g, 15, 1, 1, 14, K); R(g, 1, 0, 14, 1, K); R(g, 1, 15, 14, 1, K); }
      else outlineCanvas(cv, 16, 16, 1, K);
    } else return null;
    return cv;
  }

  // 'L' gate: iron portcullis bars (theme-tinted). mask bits: 1 = gate above (no header beam),
  // 2 = gate below (no spiked foot), 4/8 = gate left/right (no side frame). step 0..16 = raised px.
  var GATE_BARS = [1, 6, 11];
  function paintGate(spec, mask, step) {
    var cv = mkCanvas(16, 16), g = g2(cv);
    var tint = spec.lad.m, up = mask & 1, dn = mask & 2, L = mask & 4, Rt = mask & 8;
    var il = mix('#bcbcbc', tint, 0.3), im = mix('#7c7c7c', tint, 0.4), id = mix('#3c3c3c', tint, 0.3), ix = mix('#fcfcfc', tint, 0.1);
    var hb = mix('#4c4c54', spec.body.m || spec.body.base || tint, 0.35), hl = mix(hb, '#fcfcfc', 0.3);
    var top = up ? 0 : 5, foot = dn ? 16 : 13, s = step | 0, i, x, y;
    if (s >= 16) foot = top;
    else { g.globalAlpha = 0.6; R(g, 0, top, 16, (dn ? 16 : 14) - top, '#000000'); g.globalAlpha = 1; }
    g.save(); g.beginPath(); g.rect(0, top, 16, 16 - top); g.clip();
    g.translate(0, -s);
    for (i = 0; i < GATE_BARS.length; i++) {
      x = GATE_BARS[i];
      R(g, x - 1, 0, 5, foot, K);
      R(g, x, 0, 1, foot, il); R(g, x + 1, 0, 1, foot, im); R(g, x + 2, 0, 1, foot, id);
      if (!dn) {
        R(g, x - 1, 11, 5, 3, K); R(g, x, 11, 1, 2, il); R(g, x + 1, 11, 1, 3, im); R(g, x + 2, 11, 1, 2, id);
        P(g, x, 13, K); P(g, x + 2, 13, K); P(g, x + 1, 14, ix); P(g, x, 14, K); P(g, x + 2, 14, K); P(g, x + 1, 15, K);
      }
    }
    y = dn ? 7 : 6;
    R(g, 0, y - 1, 16, 5, K); R(g, 0, y, 16, 1, il); R(g, 0, y + 1, 16, 1, im); R(g, 0, y + 2, 16, 1, id);
    for (i = 0; i < GATE_BARS.length; i++) { P(g, GATE_BARS[i] + 1, y + 1, ix); P(g, GATE_BARS[i] + 1, y + 2, K); }
    g.restore();
    if (!L && foot > top) { R(g, 0, top, 1, foot - top, K); }
    if (!Rt && foot > top) { R(g, 15, top, 1, foot - top, K); }
    if (!up) {
      R(g, 0, 0, 16, 6, K);
      for (x = 0; x < 16; x++) for (y = 1; y < 4; y++) P(g, x, y, ((x + y) & 3) < 2 ? '#f8b800' : '#202020');
      R(g, 0, 4, 16, 1, hb); P(g, 3, 4, hl); P(g, 12, 4, hl);
      if (!L) { R(g, 0, 0, 1, 6, K); } if (!Rt) { R(g, 15, 0, 1, 6, K); }
    }
    return cv;
  }

  var tileCache = {};
  art.tile = function (ctx, theme, ch, x, y, info) {
    var th = resolveTheme(theme, TT) || 'ruins';
    var night = !!(info && info.night);
    var spec = night ? nightSpec(th) : TT[th];
    var mask = 0, v = 0, a = 0, base = th + (night ? '~n' : '');
    if (info) {
      mask = (info.up ? 1 : 0) | (info.down ? 2 : 0) | (info.left ? 4 : 0) | (info.right ? 8 : 0);
      if (info.tx !== undefined) v = hash2(info.tx | 0, (info.ty | 0) * 3 + 1) & 3;
    }
    x = Math.round(x); y = Math.round(y);
    if (ch === 'L') {
      var op = info && info.open > 0 ? Math.min(16, Math.round(+info.open * 16)) : 0;
      if (op >= 16 && (mask & 1)) return;
      var gk = base + 'L', gc = tileCache[gk] || (tileCache[gk] = {}), gid = (mask << 5) | op;
      var gcv = gc[gid] || (gc[gid] = paintGate(spec, mask, op));
      ctx.drawImage(gcv, x, y);
      return;
    }
    if (ch === '=') { mask &= 12; v = 0; }
    else if (ch === '~') { mask &= 1; v = 0; a = Math.floor(((info && info.t !== undefined) ? info.t : (DCW.t || 0)) * 5) & 3; }
    else if (ch === '^' || ch === 'H' || ch === 'b') { mask = 0; v = 0; }
    else if (ch !== '#' && ch !== 'X') return;
    var tc = tileCache[base + ch] || (tileCache[base + ch] = {});
    var id = (mask << 4) | (v << 2) | a;
    var cv = tc[id];
    if (cv === undefined) cv = tc[id] = paintTile(spec, ch, mask, v, a, th);
    if (cv) ctx.drawImage(cv, x, y);
    // smoke drifting up through the gaps of the slat street (top ground tiles only)
    if (ch === '#' && !(mask & 1) && spec.smoke && info && info.tx !== undefined) {
      var hv = hash2(info.tx | 0, 911);
      if (hv % 4 === 0) {
        var t = info.t !== undefined ? info.t : (DCW.t || 0), pa = ctx.globalAlpha;
        ctx.fillStyle = spec.smoke;
        for (var k = 0; k < 2; k++) {
          var ph = (t * 0.32 + ((hv >> 6) % 100) / 100 + k * 0.5) % 1;
          var gx = x + 3 + ((hv >> 3) % 4) * 4 + Math.round(Math.sin(ph * 5 + (hv & 7)) * 2.5 * ph);
          ctx.globalAlpha = pa * 0.42 * (1 - ph);
          ctx.fillRect(gx, Math.round(y + 2 - ph * 30), ph < 0.25 ? 1 : 2, ph < 0.5 ? 2 : 3);
        }
        ctx.globalAlpha = pa;
      }
    }
  };

  /* =====================================================================
     PARALLAX BACKGROUNDS (side-view themes, day + night)
     Each theme: sky (static canvas) + layers (pre-rendered, tiled
     horizontally) + anim (cheap per-frame overlay). Layer options:
       rate   horizontal parallax factor (1 = locked to the world)
       world  true: canvas y = world y (ground line at y 160), follows camY 1:1
       speed  px/s time drift
       lines  [y0, y1, r0, r1]: only rows y0..y1 are drawn, in 2px strips whose
              rate runs r0 -> r1 (NES line-scroll parallax)
       wob    [y0, y1, amp, freq]: art.wobble() those rows after this layer
     ===================================================================== */
  var BGH = 200, GROUND = 160;
  function rep(g, w, fn) { for (var k = -1; k <= 1; k++) { g.save(); g.translate(k * w, 0); fn(k); g.restore(); } }
  function bands(g, w, y0, y1, cols) {
    var n = cols.length, bh = (y1 - y0) / n;
    for (var i = 0; i < n; i++) {
      var a = Math.round(y0 + i * bh), b = Math.round(y0 + (i + 1) * bh);
      R(g, 0, a, w, b - a, cols[i]);
      if (i > 0) { g.fillStyle = cols[i - 1]; for (var x = 0; x < w; x += 2) { g.fillRect(x, a, 1, 1); if ((x & 3) === 0) g.fillRect(x + 1, a + 1, 1, 1); } }
    }
  }
  function bandColAt(y, y0, y1, cols) { var i = Math.floor((y - y0) / ((y1 - y0) / cols.length)); return cols[Math.max(0, Math.min(cols.length - 1, i))]; }
  function stars(g, w, h, n, seed, cols, y0) {
    var r = rng(seed); y0 = y0 || 0;
    for (var i = 0; i < n; i++) { var x = (r() * w) | 0, y = y0 + ((r() * h) | 0); P(g, x, y, cols[(r() * cols.length) | 0]); if (r() < 0.06) { P(g, x - 1, y, cols[0]); P(g, x + 1, y, cols[0]); P(g, x, y - 1, cols[0]); P(g, x, y + 1, cols[0]); } }
  }
  function tri(g, x, y, w, h, c, down) { // isoceles triangle, apex up (or down)
    g.fillStyle = c;
    for (var j = 0; j < h; j++) { var ww = Math.max(1, Math.round(w * (j + 1) / h)); g.fillRect(Math.round(x - ww / 2), down ? y + h - 1 - j : y + j, ww, 1); }
  }
  function blob(g, cx, cy, rw, rh, c) {
    g.fillStyle = c;
    for (var dy = -rh; dy <= rh; dy++) { var ww = Math.round(rw * Math.sqrt(Math.max(0, 1 - (dy * dy) / ((rh + 0.5) * (rh + 0.5))))); g.fillRect(cx - ww, cy + dy, ww * 2 + 1, 1); }
  }
  var BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  function dith(x, y, lvl) { return BAYER[((y & 3) << 2) | (x & 3)] < lvl; } // lvl 0..16
  function dither(g, x, y, w, h, c, lvl) {
    g.fillStyle = c;
    for (var j = 0; j < h; j++) for (var i = 0; i < w; i++) if (dith(x + i, y + j, lvl)) g.fillRect(x + i, y + j, 1, 1);
  }
  function ditherBlob(g, cx, cy, rw, rh, c, lvl) {
    g.fillStyle = c;
    for (var dy = -rh; dy <= rh; dy++) { var ww = Math.round(rw * Math.sqrt(Math.max(0, 1 - (dy * dy) / ((rh + 0.5) * (rh + 0.5))))); for (var dx = -ww; dx <= ww; dx++) if (dith(cx + dx, cy + dy, lvl)) g.fillRect(cx + dx, cy + dy, 1, 1); }
  }
  // smooth value noise in [0,1]
  function vnoise(seed) {
    var sx = seed * 131, sy = seed * 71;
    function lat(ix, iy) { return (hash2(ix + sx, iy - sy) & 1023) / 1023; }
    function sm(t) { return t * t * (3 - 2 * t); }
    return function (x, y) {
      var ix = Math.floor(x), iy = Math.floor(y), fx = sm(x - ix), fy = sm(y - iy);
      var a = lat(ix, iy), b = lat(ix + 1, iy), c = lat(ix, iy + 1), d = lat(ix + 1, iy + 1);
      return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
    };
  }
  // quantised ordered-dither cloud painted straight into image data. cols[0] = faintest
  function noiseCloud(g, x0, y0, w, h, seed, cols, shape, scale) {
    var n1 = vnoise(seed), n2 = vnoise(seed + 7), n3 = vnoise(seed + 19), sc = scale || 1;
    var tmp = mkCanvas(w, h), tg = g2(tmp), img = tg.createImageData(w, h), d = img.data, L = cols.length, pc = cols.map(parseColor);
    for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) {
      var X = x0 + x, Y = y0 + y;
      var f = 0.58 * n1(X / (46 * sc), Y / (28 * sc)) + 0.3 * n2(X / (17 * sc), Y / (11 * sc)) + 0.12 * n3(X / 6, Y / 5);
      f = f * shape(X, Y);
      if (f <= 0) continue;
      var v = f * (L + 1) - 1, i = Math.floor(v);
      if (BAYER[((Y & 3) << 2) | (X & 3)] < (v - i) * 16) i++;
      if (i < 0) continue;
      if (i >= L) i = L - 1;
      var c = pc[i], o = (y * w + x) * 4;
      d[o] = c[0]; d[o + 1] = c[1]; d[o + 2] = c[2]; d[o + 3] = 255;
    }
    tg.putImageData(img, 0, 0);
    g.drawImage(tmp, x0, y0);
  }

  /* ---- skies ---- */
  // the illusory day sky: crimson bands, a huge red sun with cut stripes, sulfur haze
  function skyDay(g, o) {
    var hz = o.hz || 120, cols = o.cols || ['#22040a', '#38070e', '#520b12', '#6c1216', '#841c16', '#982a18', '#a83c1c', '#b0501e'];
    bands(g, 320, 0, hz, cols);
    R(g, 0, hz, 320, BGH - hz, cols[cols.length - 1]);
    var s = o.sun;
    if (s) {
      ditherBlob(g, s.x, s.y, s.r + 12, s.r + 12, o.glow || '#8c1c16', 4);
      ditherBlob(g, s.x, s.y, s.r + 6, s.r + 6, o.glow || '#8c1c16', 9);
      blob(g, s.x, s.y, s.r + 2, s.r + 2, o.glow2 || '#a82418');
      blob(g, s.x, s.y, s.r, s.r, o.sunC || '#d8341c');
      blob(g, s.x - (s.r >> 2), s.y - (s.r >> 2), (s.r * 0.62) | 0, (s.r * 0.62) | 0, o.sunL || '#f05a30');
      blob(g, s.x - (s.r >> 1), s.y - (s.r >> 1), (s.r * 0.22) | 0, (s.r * 0.22) | 0, '#f88858');
      for (var k = 0, y = s.y + 3; y < s.y + s.r + 3; k++) { // horizontal cuts, thicker toward the bottom
        var th = 1 + (k >> 1);
        R(g, s.x - s.r - 3, y, 2 * s.r + 7, th, bandColAt(y, 0, hz, cols));
        y += th + Math.max(1, 4 - k);
      }
    }
    var r = rng(o.seed || 5);
    for (var i = 0; i < (o.haze === undefined ? 26 : o.haze); i++) { // sulfur haze streaks
      var hy = hz - 46 + ((r() * 50) | 0), hx = (r() * 320) | 0, len = 20 + ((r() * 60) | 0);
      dither(g, hx, hy, len, 1, o.hazeC || '#c06c30', 8); if (r() < 0.4) dither(g, hx + 8, hy + 1, len - 16, 1, o.hazeC || '#c06c30', 4);
    }
  }
  // the illusory night sky: deep blue, stars, a colourful dithered nebula
  function skyNight(g, o) {
    var hz = o.hz || 120, cols = o.cols || ['#03030a', '#050616', '#07091e', '#0a0c26', '#0e102e', '#121434', '#18163a', '#1e183e'];
    bands(g, 320, 0, hz, cols);
    R(g, 0, hz, 320, BGH - hz, cols[cols.length - 1]);
    var a = o.neb === undefined ? 1 : o.neb, sl = o.slope === undefined ? 0.28 : o.slope, cy = o.nebY === undefined ? hz * 0.42 : o.nebY;
    if (a > 0) {
      var fam = vnoise((o.seed || 3) + 50);
      // magenta river
      noiseCloud(g, 0, 0, 320, hz, o.seed || 3, o.nebA || ['#1c0e34', '#2e1246', '#4a1858', '#6c2068', '#943074'], function (x, y) {
        var dd = Math.abs(y - (cy + (x - 160) * sl)) / (o.nebW || 40); return a * Math.max(0, 1.25 - dd) * (fam(x / 70, y / 50) > 0.42 ? 1 : 0.55);
      });
      // teal edges
      noiseCloud(g, 0, 0, 320, hz, (o.seed || 3) + 9, o.nebB || ['#0c1830', '#10283e', '#14404e', '#1c5c62'], function (x, y) {
        var dd = Math.abs(y - (cy + 14 + (x - 160) * sl)) / ((o.nebW || 40) * 1.3); return a * 0.9 * Math.max(0, 1.1 - dd) * (fam(x / 70, y / 50) <= 0.42 ? 1 : 0.35);
      }, 1.3);
    }
    stars(g, 320, hz - 6, o.stars || 110, (o.seed || 3) + 1, ['#5c5c8c', '#8484b0', '#b0b0d8', '#e0e0f8']);
    stars(g, 320, hz - 6, 8, (o.seed || 3) + 2, ['#fcfcfc']);
  }
  function sky(g, Q, night, o) { o = o || {}; if (night) skyNight(g, merge(o, o.n || {})); else skyDay(g, merge(o, o.d || {})); }
  function merge(a, b) { var r = {}, k; for (k in a) r[k] = a[k]; for (k in b) r[k] = b[k]; return r; }

  /* ---- silhouettes ---- */
  // ruined skyline: broken towers, holes, mossy tops
  function skyline(g0, w, base, seed, o) {
    var tmpS = mkCanvas(w + 16, BGH), g = g2(tmpS);
    g.translate(8, 0);
    skylineDraw(g, w, base, seed, o);
    g0.drawImage(tmpS, -8, 0);
  }
  function skylineDraw(g, w, base, seed, o) {
    var r = rng(seed), x = (r() * 10) | 0;
    while (x < w) {
      var bw = o.minW + ((r() * (o.maxW - o.minW)) | 0), bh = o.minH + ((r() * (o.maxH - o.minH)) | 0);
      var top = base - bh;
      R(g, x, top, bw, BGH - top, o.col);
      if (o.broken && r() < 0.75) {
        var n = 2 + ((r() * 3) | 0);
        for (var i = 0; i < n; i++) { var bx = x + ((r() * bw) | 0), d = 2 + ((r() * 9) | 0); g.clearRect(bx, top, 2 + ((r() * 5) | 0), d); }
        if (r() < 0.5) { line(g, x + 2, top, x - 1, top - 6, o.col); line(g, x + 3, top, x, top - 6, o.col); }
      } else if (o.spire && r() < 0.35) { tri(g, x + (bw >> 1), top - 12, bw - 2, 12, o.col); R(g, x + (bw >> 1), top - 18, 1, 6, o.col); }
      if (o.win) for (var wy = top + 4; wy < base + 30; wy += 6) for (var wx = x + 2; wx < x + bw - 2; wx += 4) if (r() < o.winP) R(g, wx, wy, 2, 2, o.win);
      if (o.rim) R(g, x, top, 1, BGH - top, o.rim);
      if (o.moss) for (var m = 0; m < bw; m++) if (r() < 0.45) P(g, x + m, top + ((r() * 2) | 0), o.moss);
      x += bw + ((r() * o.gap) | 0);
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
  // leafy overgrown tree: trunk + lumpy dithered canopy
  function bushTree(g, x, base, h, Q, r) {
    R(g, x - 2, base - Math.round(h * 0.5), 4, Math.round(h * 0.5), Q.trunk);
    line(g, x, base - Math.round(h * 0.45), x - 6, base - Math.round(h * 0.62), Q.trunk);
    var cy = base - Math.round(h * 0.7), n = 5;
    for (var i = 0; i < n; i++) blob(g, x - 10 + ((r() * 20) | 0), cy - 6 + ((r() * 12) | 0), 6 + ((r() * 5) | 0), 5 + ((r() * 3) | 0), Q.leaf);
    for (i = 0; i < 4; i++) ditherBlob(g, x - 8 + ((r() * 16) | 0), cy - 8 + ((r() * 8) | 0), 4 + ((r() * 3) | 0), 3, Q.leafL, 8);
  }
  function vines(g, x0, x1, y, Q, r, maxLen) {
    for (var x = x0; x < x1; x += 2 + ((r() * 5) | 0)) {
      var len = 3 + ((r() * maxLen) | 0), xx = x;
      for (var k = 0; k < len; k++) { P_(g, xx, y + k, k % 3 === 2 ? Q.vineL : Q.vine); if (r() < 0.3) xx += r() < 0.5 ? 1 : -1; }
    }
  }
  function P_(g, x, y, c) { g.fillStyle = c; g.fillRect(x, y, 1, 1); }

  /* ---- building facades (street themes) ---- */
  function win(g, x, y, w, h, Q, lit, o) {
    o = o || {};
    R(g, x - 1, y - 1, w + 2, h + 2, Q.frame);
    if (o.arch) { R(g, x, y + 2, w, h - 2, lit ? Q.lit : Q.glass); R(g, x + 1, y, w - 2, 2, lit ? Q.lit : Q.glass); R(g, x - 1, y - 1, 2, 1, o.wallC || Q.wall); R(g, x + w - 1, y - 1, 2, 1, o.wallC || Q.wall); P(g, x, y, Q.frame); P(g, x + w - 1, y, Q.frame); }
    else R(g, x, y, w, h, lit ? Q.lit : Q.glass);
    if (lit) { R(g, x + 1, y + 1, w - 2, Math.max(1, h - 3), Q.litL); }
    else P(g, x + 1, y + 1, Q.glassL);
    R(g, x + (w >> 1), y, 1, h, Q.frame); R(g, x, y + (h >> 1), w, 1, Q.frame);
    if (o.shutters) { R(g, x - 3, y - 1, 2, h + 2, Q.shutter); R(g, x + w + 1, y - 1, 2, h + 2, Q.shutter); }
    if (o.box) { R(g, x - 1, y + h + 1, w + 2, 2, Q.boxC || Q.frame); for (var i = 0; i < w; i += 2) P(g, x + i, y + h, i & 2 ? Q.flowerA : Q.flowerB); }
  }
  function gableRoof(g, x, w, eave, h, Q, r, st) { // front gable: triangle with shingle rows
    tri(g, x + w / 2, eave - h, w + 4, h + 1, Q.roofD);
    tri(g, x + w / 2, eave - h + 2, w, h - 1, Q.roof);
    for (var y = eave - h + 5; y < eave; y += 3) { var hw = Math.round((w / 2) * (y - (eave - h + 2)) / (h - 1)); R(g, Math.round(x + w / 2 - hw), y, hw * 2, 1, Q.roofD); }
    line(g, Math.round(x + w / 2), eave - h + 1, x - 1, eave, Q.roofL);
  }
  function sideRoof(g, x, w, eave, h, Q, r, st, night) { // eaves facing the street: sloped band
    for (var j = 0; j < h; j++) { var inset = Math.round((h - j) * 0.35); R(g, x + inset - 2, eave - h + j, w - inset * 2 + 4, 1, j % 3 === 0 ? Q.roofD : Q.roof); }
    R(g, x - 2, eave - 1, w + 4, 1, Q.roofD); R(g, x + Math.round(h * 0.35) - 2, eave - h, w - Math.round(h * 0.35) * 2 + 4, 1, Q.roofL);
    if (w > 50 && r() < 0.7) { // dormer
      var dx = x + (w >> 1) - 5, dy = eave - h + 2;
      tri(g, dx + 5, dy - 6, 14, 7, Q.roofD); R(g, dx + 1, dy, 9, 8, Q.wall); win(g, dx + 3, dy + 1, 5, 5, Q, night && r() < 0.6);
    }
  }
  function chimney(g, x, y, Q, st, layerW) {
    R(g, x, y, 6, 14, Q.stone); R(g, x, y, 1, 14, Q.stoneL); R(g, x - 1, y - 2, 8, 3, Q.stoneD); R(g, x + 1, y + 4, 4, 1, Q.stoneD);
    if (st) st.chim.push([x + 3, y - 2]);
  }
  function lantern(g, x, y, Q, st) {
    R(g, x - 4, y - 6, 5, 1, Q.iron); R(g, x, y - 6, 1, 3, Q.iron);
    R(g, x - 1, y - 3, 3, 1, Q.iron); R(g, x - 1, y - 2, 3, 4, Q.lantern); R(g, x - 1, y + 2, 3, 1, Q.iron); P(g, x, y - 1, Q.lanternL);
    if (st) st.lamps.push([x, y]);
  }
  function plinth(g, x, w, Q) { R(g, x, GROUND - 7, w, 7, Q.plinth); R(g, x, GROUND - 7, w, 1, Q.plinthL); for (var i = x + 6; i < x + w; i += 11) R(g, i, GROUND - 6, 1, 6, Q.plinthD); }
  function courses(g, x, y0, y1, w, Q, step) { // stone/brick courses on a wall area
    step = step || 5;
    for (var y = y0; y < y1; y += step) { R(g, x, y, w, 1, Q.course); var off = ((y / step) & 1) ? 0 : 7; for (var i = x + off; i < x + w; i += 14) R(g, i, y, 1, step, Q.course); }
  }
  // split a strip of width w into n building widths that sum exactly to w
  function splitWidths(w, avg, r) {
    var n = Math.max(1, Math.round(w / avg)), ws = [], sum = 0, i;
    for (i = 0; i < n; i++) { var v = 0.7 + r() * 0.6; ws.push(v); sum += v; }
    var out = [], acc = 0;
    for (i = 0; i < n; i++) { var bw = i === n - 1 ? w - acc : Math.round(ws[i] / sum * w); out.push(bw); acc += bw; }
    return out;
  }
  // medieval street facades. kind: 'village' (half-timber, 2 storeys) | 'settlement' (taller, stone base, balconies, banners)
  function townRow(g, w, Q, night, st, kind, seed) {
    var r = rng(seed), ws = splitWidths(w, kind === 'settlement' ? 76 : 64, r), x = 0;
    for (var b = 0; b < ws.length; b++) {
      var bw = ws[b], tall = kind === 'settlement';
      var eave = tall ? 44 + ((r() * 20) | 0) : 66 + ((r() * 18) | 0);
      var jetty = tall ? 100 : 104, gable = r() < 0.5;
      var wallC = r() < 0.5 ? Q.wall : Q.wall2;
      // walls
      R(g, x, eave, bw, GROUND - eave, wallC);
      R(g, x, jetty, bw, GROUND - jetty, Q.stone); courses(g, x, jetty + 2, GROUND - 7, bw, Q, 6);
      // timber framing on the upper storeys
      R(g, x, jetty - 3, bw, 3, Q.timber); R(g, x, jetty - 3, bw, 1, Q.timberL); R(g, x, jetty, bw, 1, Q.timberD);
      var floorH = tall ? 19 : 18, fy;
      for (fy = jetty - 3 - floorH; fy > eave + 6; fy -= floorH) { R(g, x, fy, bw, 2, Q.timber); R(g, x, fy, bw, 1, Q.timberL); }
      var posts = [];
      for (var px = x + 2; px <= x + bw - 4; px += 12 + ((r() * 4) | 0)) posts.push(px);
      for (var i = 0; i < posts.length; i++) R(g, posts[i], eave, 2, jetty - eave - 3, Q.timber);
      // windows between posts, one per bay per storey; braces in the others
      var top0 = eave + 3;
      for (fy = jetty - 3; fy - floorH >= eave; fy -= floorH) {
        for (i = 0; i < posts.length - 1; i++) {
          var bx = posts[i] + 2, bw2 = posts[i + 1] - bx;
          if (bw2 < 7) continue;
          if (r() < 0.62) win(g, bx + ((bw2 - 6) >> 1), fy - floorH + 5, 6, 8, Q, night && r() < 0.55, { shutters: bw2 >= 11 && r() < 0.5, box: tall && r() < 0.4 });
          else { line(g, bx, fy - 2, bx + bw2 - 1, fy - floorH + 2, Q.timber); line(g, bx + 1, fy - 2, bx + bw2, fy - floorH + 2, Q.timberD); }
        }
      }
      if (tall && r() < 0.6) { // balcony
        var by = jetty - floorH - 2, bx0 = x + 8, bx1 = x + bw - 8;
        R(g, bx0, by, bx1 - bx0, 2, Q.timber); for (var q = bx0; q < bx1; q += 3) R(g, q, by - 5, 1, 5, Q.timberD); R(g, bx0, by - 6, bx1 - bx0, 1, Q.timber);
      }
      if (tall && r() < 0.55) { // hanging banner with the skyfowl crest
        var nx = x + 6 + ((r() * (bw - 18)) | 0), ny = eave + 6;
        R(g, nx, ny - 1, 8, 1, Q.iron); R(g, nx, ny, 8, 20, Q.banner); R(g, nx, ny, 1, 20, Q.bannerL);
        tri(g, nx + 4, ny + 20, 8, 4, Q.banner, true); rows(g, nx + 1, ny + 5, ['.y.y..', 'yyyyy.', '.yyy..', '..y...'], { y: Q.crest });
      }
      // corner posts + plinth
      R(g, x, eave, 2, GROUND - eave, Q.timberD); R(g, x + bw - 1, eave, 1, GROUND - eave, Q.timberD);
      plinth(g, x, bw, Q);
      // roof
      var rh = tall ? 16 + ((r() * 6) | 0) : 18 + ((r() * 8) | 0);
      if (gable) {
        gableRoof(g, x, bw, eave, rh, Q, r, st);
        if (r() < 0.6) win(g, x + (bw >> 1) - 3, eave - (rh >> 1) - 1, 6, 6, Q, night && r() < 0.5);
        if (r() < 0.45) chimney(g, x + bw - 12, eave - rh + 4, Q, st);
      } else {
        sideRoof(g, x, bw, eave, Math.min(rh, 16), Q, r, st, night);
        if (r() < 0.8) chimney(g, x + 6 + ((r() * (bw - 18)) | 0), eave - 22, Q, st);
      }
      // lanterns and hanging signs live above the door zone (y < 104)
      if (r() < 0.55) lantern(g, x + 5, jetty - 6, Q, st);
      if (r() < 0.35) { var sx = x + bw - 14; R(g, sx, jetty - 12, 10, 1, Q.iron); R(g, sx + 2, jetty - 11, 1, 2, Q.iron); R(g, sx + 7, jetty - 11, 1, 2, Q.iron); R(g, sx + 1, jetty - 9, 8, 6, Q.sign); R(g, sx + 1, jetty - 9, 8, 1, Q.signL); R(g, sx + 3, jetty - 7, 4, 2, Q.signD); }
      if (tall && r() < 0.35) { // awning over the ground floor
        var ax = x + 6, aw = bw - 12;
        for (var ay = 0; ay < 5; ay++) for (var axx = 0; axx < aw; axx++) P(g, ax + axx - (ay >> 1), jetty + 1 + ay, ((axx >> 2) & 1) ? Q.awnA : Q.awnB);
        for (axx = 0; axx < aw; axx += 4) { R(g, ax + axx - 2, jetty + 6, 3, 1, ((axx >> 2) & 1) ? Q.awnA : Q.awnB); }
      }
      x += bw;
    }
  }
  // moss-covered brick ruins: broken tops, dark empty windows, vines, rubble
  function ruinRow(g, w, Q, night, st, seed) {
    var r = rng(seed), ws = splitWidths(w, 70, r), x = 0;
    for (var b = 0; b < ws.length; b++) {
      var bw = ws[b], top = 52 + ((r() * 40) | 0);
      // jagged top profile
      var prof = [], yy = top;
      for (var i = 0; i < bw; i++) { if (i % 3 === 0) yy = Math.max(top - 8, Math.min(top + 18, yy + (((r() * 7) | 0) - 3))); prof.push(yy); }
      if (r() < 0.5) for (i = (bw * 0.3) | 0; i < bw * 0.6; i++) prof[i] += 12 + ((r() * 4) | 0); // collapsed chunk
      for (i = 0; i < bw; i++) { R(g, x + i, prof[i], 1, GROUND - prof[i], Q.wall); }
      // brick courses
      for (var y = top - 6; y < GROUND - 7; y += 5) for (i = 0; i < bw; i++) { if (y > prof[i] + 1) { if (i % 10 === ((y / 5) & 1) * 5) { P(g, x + i, y + 1, Q.course); P(g, x + i, y + 2, Q.course); } if (hash2(x + i, y) % 5) P(g, x + i, y, Q.course); } }
      for (i = 0; i < bw; i++) { P(g, x + i, prof[i], Q.wallL); if (r() < 0.55) P(g, x + i, prof[i] + 1, Q.moss); if (r() < 0.25) P(g, x + i, prof[i] + 2, Q.mossL); }
      // windows: dark broken holes on the upper storeys
      for (var wy = top + 8; wy < 92; wy += 20) {
        for (var wx = x + 6; wx < x + bw - 10; wx += 14 + ((r() * 4) | 0)) {
          if (wy < prof[wx - x] + 4 || r() < 0.25) continue;
          var ww = 6 + ((r() * 2) | 0), wh = 9;
          R(g, wx - 1, wy - 1, ww + 2, wh + 2, Q.frame); R(g, wx, wy, ww, wh, Q.hole);
          P(g, wx + ww - 1, wy, Q.frame); P(g, wx, wy + wh - 1, Q.frame);
          if (r() < 0.3) { R(g, wx, wy + 3, ww, 1, Q.board); R(g, wx, wy + 6, ww, 1, Q.board); }
          else st.holes.push([wx + (ww >> 1), wy + 3]);
          if (night && r() < 0.12) { R(g, wx + 1, wy + 2, ww - 2, wh - 3, Q.lit); }
        }
      }
      // moss patches + hanging vines
      for (i = 0; i < 4; i++) ditherBlob(g, x + ((r() * bw) | 0), top + 20 + ((r() * 60) | 0), 4 + ((r() * 6) | 0), 2 + ((r() * 3) | 0), Q.moss, 9);
      vines(g, x + 2, x + bw - 2, top + 2, Q, r, 22);
      // cracks
      for (i = 0; i < 2; i++) { var cx = x + ((r() * bw) | 0), cy = top + 30 + ((r() * 50) | 0); for (var k = 0; k < 10; k++) { P(g, cx, cy, Q.crack); cy++; cx += r() < 0.5 ? 1 : -1; } }
      R(g, x, top - 8, 1, GROUND - top + 8, Q.seam);
      plinth(g, x, bw, Q);
      // rubble at the base
      for (i = 0; i < 3; i++) { var rx = x + ((r() * bw) | 0); blob(g, rx, GROUND - 3, 3 + ((r() * 3) | 0), 2, Q.rubble); P(g, rx - 1, GROUND - 5, Q.wallL); }
      if (r() < 0.4) { line(g, x + ((bw * 0.4) | 0), prof[(bw * 0.4) | 0], x + ((bw * 0.4) | 0) + 4, prof[(bw * 0.4) | 0] - 8, Q.rebar); }
      x += bw;
    }
  }
  // circus perimeter: striped canvas sidewall on poles with pennants, hedges at the foot
  function circusWall(g, w, Q, night, st, seed) {
    var r = rng(seed), top = 108;
    for (var x = 0; x < w; x++) { var s = ((x >> 3) & 1); R(g, x, top, 1, GROUND - top, s ? Q.canA : Q.canB); if ((x & 7) === 0) R(g, x, top, 1, GROUND - top, Q.canD); }
    for (x = 0; x < w; x += 4) { var y = top + 6 + ((x >> 2) % 3 === 1 ? 1 : 0); R(g, x, y, 4, 1, Q.canD); }
    // scalloped valance
    for (x = 0; x < w; x += 8) { R(g, x, top - 4, 8, 4, Q.val); R(g, x + 1, top, 6, 2, Q.val); R(g, x + 2, top + 2, 4, 1, Q.val); P(g, x + 4, top - 3, Q.valL); R(g, x, top - 4, 8, 1, Q.valL); }
    // poles + pennant strings
    for (x = 16; x < w; x += 64) {
      R(g, x, top - 30, 3, GROUND - top + 30, Q.pole); R(g, x, top - 30, 1, GROUND - top + 30, Q.poleL); R(g, x - 1, top - 32, 5, 2, Q.poleL);
      st.flags.push([x + 3, top - 30]);
      for (var k = 0; k < 64; k += 8) { var py = top - 22 + Math.round(Math.sin(k / 64 * Math.PI) * 6); tri(g, x + 3 + k + 4, py, 6, 5, [Q.pnA, Q.pnB, Q.pnC][(k >> 3) % 3], true); }
    }
    // bushes along the foot of the wall
    for (x = 0; x < w; x += 10 + ((r() * 18) | 0)) { var bwid = 6 + ((r() * 8) | 0); blob(g, x, GROUND - 4, bwid, 5, Q.hedge); ditherBlob(g, x - 2, GROUND - 7, bwid - 3, 2, Q.hedgeL, 8); }
  }
  // the administrative district: marble civic buildings, pilasters, arched windows, eagles on the cornice
  function civicRow(g, w, Q, night, st, seed) {
    var r = rng(seed), ws = splitWidths(w, 106, r), x = 0;
    for (var b = 0; b < ws.length; b++) {
      var bw = ws[b], top = 56 + ((r() * 16) | 0);
      R(g, x, top, bw, GROUND - top, Q.wall);
      courses(g, x, 100, GROUND - 8, bw, Q, 7);
      // frieze + cornice
      R(g, x, 94, bw, 5, Q.wallL); R(g, x, 98, bw, 1, Q.wallD); for (var i = x + 2; i < x + bw; i += 4) R(g, i, 95, 2, 2, Q.wallD);
      R(g, x - 1, top - 3, bw + 2, 4, Q.wallL); R(g, x - 1, top, bw + 2, 1, Q.wallD); for (i = x + 1; i < x + bw; i += 3) P(g, i, top + 2, Q.wallD);
      // balustrade on the roofline
      R(g, x, top - 9, bw, 1, Q.wallL); for (i = x + 2; i < x + bw - 1; i += 4) R(g, i, top - 8, 2, 5, Q.wallD);
      // pilasters
      var nP = Math.max(2, Math.round(bw / 34)), step = bw / nP;
      for (i = 0; i <= nP; i++) {
        var px = Math.round(x + i * step) - 3; if (px < x) px = x; if (px > x + bw - 6) px = x + bw - 6;
        R(g, px, top + 1, 6, GROUND - top - 8, Q.pil); R(g, px, top + 1, 1, GROUND - top - 8, Q.pilL); R(g, px + 5, top + 1, 1, GROUND - top - 8, Q.pilD);
        R(g, px - 1, top + 1, 8, 2, Q.pilL); R(g, px - 1, GROUND - 10, 8, 3, Q.pilL);
        if (r() < 0.45 && i > 0 && i < nP) { // eagle statue on the cornice
          var ex = px + 3, ey = top - 9;
          rows(g, ex - 5, ey - 9, ['....dd.....', '...dddd....', 'd..ddd...d.', 'dd.ddd..dd.', '.ddddddddd.', '..ddddddd..', '....ddd....', '...ddddd...', '..ddddddd..'], { d: Q.statue });
        }
      }
      // tall arched windows between pilasters
      for (i = 0; i < nP; i++) {
        var cx = Math.round(x + (i + 0.5) * step);
        win(g, cx - 4, top + 10, 8, 22, Q, night && r() < 0.6, { arch: true });
        if (r() < 0.35 && bw > 60) { // red banner with the gold bird
          R(g, cx - 5, top + 36, 10, 22, Q.banner); R(g, cx - 5, top + 36, 1, 22, Q.bannerL); tri(g, cx, top + 58, 10, 4, Q.banner, true);
          rows(g, cx - 3, top + 42, ['.y.y..', 'yyyyy.', '.yyy..', '..y...'], { y: Q.crest });
        } else win(g, cx - 4, top + 42, 8, 10, Q, night && r() < 0.5);
      }
      if (r() < 0.35) { // pediment
        tri(g, x + bw / 2, top - 22, bw * 0.7, 14, Q.wallD); tri(g, x + bw / 2, top - 20, bw * 0.6, 12, Q.wallL);
        disc(g, Math.round(x + bw / 2), top - 13, 3, Q.crest);
      }
      if (r() < 0.6) { st.lamps.push([x + 10, 90]); R(g, x + 8, 90, 5, 4, Q.iron); R(g, x + 9, 86, 3, 4, Q.brazier); }
      plinth(g, x, bw, Q);
      R(g, x, top - 3, 1, GROUND - top + 3, Q.wallD);
      x += bw;
    }
  }

  /* ---- interior helpers (used by the non-street themes) ---- */
  function brickWall(g, x0, y0, w, h, Q, step) {
    step = step || 6; R(g, x0, y0, w, h, Q.wall);
    for (var y = y0; y < y0 + h; y += step) { R(g, x0, y, w, 1, Q.course); var off = ((y / step) & 1) ? 0 : 6; for (var x = x0 + off; x < x0 + w; x += 12) R(g, x, y, 1, step, Q.course); }
  }
  function windowSky(g, x, y, w, h, night, Q, seed) { // a window that shows the floor's sky
    R(g, x - 2, y - 2, w + 4, h + 4, Q.frame);
    var cols = night ? ['#05061a', '#0a0c26', '#121434'] : ['#4c0a12', '#781418', '#a0301c'];
    for (var j = 0; j < h; j++) R(g, x, y + j, w, 1, cols[Math.min(2, Math.floor(j / h * 3))]);
    var r = rng(seed || 1);
    if (night) { for (var i = 0; i < w * h / 40; i++) P(g, x + ((r() * w) | 0), y + ((r() * h) | 0), r() < 0.3 ? '#e0e0f8' : '#6c6c9c'); ditherBlob(g, x + (w >> 1), y + (h >> 2), w >> 2, h >> 3, '#4a1858', 6); }
    else { blob(g, x + w - 6, y + 6, 4, 4, '#d8341c'); }
    R(g, x + (w >> 1) - 1, y, 2, h, Q.frame); R(g, x, y + (h >> 1) - 1, w, 2, Q.frame);
  }
  function candle(g, x, y, Q, st) { R(g, x, y, 2, 5, Q.wax || '#d8d0b8'); R(g, x - 1, y + 5, 4, 1, Q.iron || '#3c3c3c'); if (st) st.flames.push([x, y - 1]); }
  function drawFlame(ctx, x, y, t, i, big) {
    var f = (Math.sin(t * 11 + i * 1.7) + Math.sin(t * 23 + i)) > 0.3 ? 1 : 0;
    ctx.fillStyle = '#f8b800'; ctx.fillRect(x, y - 1 - f, 2, 2 + f);
    ctx.fillStyle = '#fcfcfc'; ctx.fillRect(x + (f ? 1 : 0), y, 1, 1);
    if (big) { ctx.globalAlpha = 0.1 + f * 0.03; ctx.fillStyle = '#f8a040'; ctx.fillRect(x - 6, y - 7, 14, 13); ctx.globalAlpha = 1; }
  }
  function glow(ctx, x, y, r, col, a) {
    ctx.fillStyle = col;
    for (var i = 0; i < 3; i++) { ctx.globalAlpha = a * (0.6 + i * 0.5); ctx.beginPath(); ctx.arc(Math.round(x), Math.round(y), Math.max(1, r * (1 - i * 0.3)), 0, 6.2832); ctx.fill(); }
    ctx.globalAlpha = 1;
  }
  // iterate a feature's screen positions for a tiled layer (feature x in layer space)
  function wrapX(fx, ox, w, fn) { for (var k = -1; k <= 1; k++) { var sx = fx - ox + k * w; if (sx > -48 && sx < 368) fn(Math.round(sx)); } }

  /* ---- theme palettes: day given, night derived (darker, bluer) + overrides ---- */
  function nightBg(c) {
    if (typeof c !== 'string' || c.charAt(0) !== '#') return c;
    var p = parseColor(c);
    return hex(p[0] * 0.34 + 4, p[1] * 0.38 + 6, p[2] * 0.62 + 22);
  }
  var NIGHT_LIGHTS = { lit: '#c88c30', litL: '#f8c860', lantern: '#f8b800', lanternL: '#fcf0b0', glass: '#0a0a16', glassL: '#24243c', brazier: '#f87800' };
  function nb(c, kk) { if (c && c.map) return c.map(function (x) { return nb(x, kk); }); return kk === undefined ? nightBg(c) : mix(c, nightBg(c), kk); }
  function pal(d, nOver, kk) {
    var n = {}, k;
    for (k in d) n[k] = nb(d[k], kk);
    for (k in NIGHT_LIGHTS) if (d[k] !== undefined) n[k] = NIGHT_LIGHTS[k];
    for (k in nOver || {}) n[k] = nOver[k];
    return { d: d, n: n };
  }
  var TOWN = { // shared village/settlement facade colours (crimson daylight)
    wall: '#7c5048', wall2: '#6c4844', stone: '#5c4440', stoneL: '#6c544c', stoneD: '#3c2c2c', course: '#4c3836',
    timber: '#3c1c14', timberL: '#5c2c1c', timberD: '#24100c', roof: '#4c1818', roofD: '#2c0c0c', roofL: '#6c2c24',
    frame: '#24100c', glass: '#2c1418', glassL: '#7c4c48', lit: '#a86c28', litL: '#c88c38', shutter: '#4c2418',
    plinth: '#4c3c38', plinthL: '#6c5850', plinthD: '#2c2020', iron: '#1c1414', lantern: '#3c2c20', lanternL: '#5c4c30',
    sign: '#6c4428', signL: '#8c5c34', signD: '#3c2414', banner: '#6c1c24', bannerL: '#8c2c30', crest: '#b08838',
    flowerA: '#a84c6c', flowerB: '#4c7c3c', boxC: '#3c1c14', awnA: '#6c2c2c', awnB: '#9c8c6c',
    far: '#5c1a1c', farRim: '#6c2620', farMoss: '#4c3c20', mid: '#3c1214', midL: '#4c1c18', smoke: '#8c7c70', ember: '#f8a040',
    leaf: '#2c1c10', leafL: '#3c2c14', trunk: '#1c0c08'
  };
  function stx(st, k) { return k === 0 ? st : { chim: [], lamps: [], holes: [], flags: [], flames: [], bulbs: [], misc: [] }; }
  // little rooftops for distant village / town layers
  function roofline(g, w, base, Q, r, night, o) {
    var x = -10;
    while (x < w + 10) {
      var bw = (o.minW || 18) + ((r() * (o.maxW || 30)) | 0), h = (o.minH || 10) + ((r() * (o.maxH || 16)) | 0), top = base - h;
      R(g, x, top, bw, BGH - top, o.col);
      if (r() < 0.6) tri(g, x + bw / 2, top - 9, bw + 2, 10, o.col);
      else if (r() < 0.3) { R(g, x + (bw >> 1) - 3, top - 18, 6, 18, o.col); tri(g, x + (bw >> 1), top - 30, 8, 12, o.col); }
      if (r() < 0.4) R(g, x + bw - 6, top - 14, 3, 8, o.col);
      if (o.lit && night) for (var wy = top + 3; wy < base + 10; wy += 7) for (var wx = x + 3; wx < x + bw - 3; wx += 6) if (r() < 0.16) R(g, wx, wy, 2, 2, o.lit);
      x += bw - 2 + ((r() * 6) | 0);
    }
  }

  var BG2 = {};
  /* ---------------- village: the starting tiny village ---------------- */
  BG2.village = {
    pal: pal(TOWN, { far: '#0e1028', farRim: '#141634', mid: '#0a0c1c', midL: '#101226', smoke: '#34365a', ember: '#d86018' }),
    sky: function (g, Q, night) { sky(g, Q, night, { hz: 118, sun: { x: 238, y: 44, r: 20 }, seed: 11 }); },
    layers: [
      { w: 400, rate: 0.1, draw: function (g, w, Q, night) {
        rep(g, w, function () {
          skyline(g, w, 122, 31, { minW: 10, maxW: 26, minH: 24, maxH: 74, col: Q.far, gap: 16, broken: true, rim: Q.farRim, moss: night ? null : Q.farMoss, win: night ? '#3c3420' : null, winP: 0.03 });
        });
      } },
      { w: 480, rate: 0.3, draw: function (g, w, Q, night) {
        rep(g, w, function () {
          var r = rng(77);
          roofline(g, w, 120, Q, r, night, { col: Q.mid, lit: '#6c5020' });
          for (var x = 30; x < w; x += 90 + ((r() * 60) | 0)) bushTree(g, x, 122, 30 + ((r() * 16) | 0), { trunk: Q.mid, leaf: Q.mid, leafL: Q.midL }, r);
          // the guildhall tower
          R(g, 300, 54, 18, 80, Q.mid); tri(g, 309, 30, 22, 26, Q.mid); R(g, 308, 22, 2, 9, Q.mid); R(g, 304, 66, 10, 10, Q.midL); disc(g, 309, 71, 3, Q.mid);
        });
      } },
      { w: 640, rate: 1, world: true, draw: function (g, w, Q, night, st) { rep(g, w, function (k) { townRow(g, w, Q, night, stx(st, k), 'village', 401); }); } }
    ],
    anim: function (ctx, v, Q, night, st) {
      smokePuffs(ctx, v, st[2].chim, 2, 640, Q.smoke, night ? 0.35 : 0.5);
      embers(ctx, v, Q.ember, 10, 3);
      if (night) lamps(ctx, v, st[2].lamps, 2, 640);
    },
    wob: [0, 56, 1, 0.3]
  };
  /* ---------------- ruins: moss-covered brick, overgrown parks, fog ---------------- */
  var RUIN = {
    wall: '#462c28', wallL: '#5a3c34', course: '#3a2420', moss: '#2e4020', mossL: '#40542a', vine: '#24381a', vineL: '#384c22',
    frame: '#24140f', hole: '#100808', board: '#4c3828', crack: '#24140f', seam: '#341e1a', plinth: '#3c2c26', plinthL: '#523c32', plinthD: '#24140f',
    rubble: '#3c2e28', rebar: '#5c4034', lit: '#8c6028',
    far: '#4c1a1c', farRim: '#5a2422', farMoss: '#3c4020', mid: '#2c1410', leaf: '#2a2414', leafL: '#3a341c', trunk: '#1c0c08',
    fog: '#8c5048', fog2: '#a06858', spore: '#a8c860', eye: '#f83800'
  };
  BG2.ruins = {
    pal: pal(RUIN, { far: '#0c0e24', farRim: '#121430', mid: '#0a0a18', leaf: '#0c1418', leafL: '#121c22', fog: '#2c3050', fog2: '#3c4064', spore: '#88c8a0' }),
    sky: function (g, Q, night) { sky(g, Q, night, { hz: 112, sun: { x: 76, y: 50, r: 17 }, seed: 23, haze: 40, d: { cols: ['#1e060a', '#300a0e', '#461012', '#5c1814', '#702416', '#80341c', '#8c4424', '#94542c'] }, n: { neb: 0.8, nebY: 40, slope: -0.22 } }); },
    layers: [
      { w: 400, rate: 0.08, draw: function (g, w, Q, night) {
        rep(g, w, function () {
          skyline(g, w, 118, 91, { minW: 12, maxW: 30, minH: 30, maxH: 92, col: Q.far, gap: 10, broken: true, rim: Q.farRim, moss: Q.farMoss });
          dither(g, 0, 96, w, 30, Q.fog, 4);
        });
      } },
      { w: 480, rate: 0.24, draw: function (g, w, Q, night) {
        rep(g, w, function () {
          var r = rng(93);
          skyline(g, w, 132, 57, { minW: 20, maxW: 44, minH: 16, maxH: 56, col: Q.mid, gap: 40, broken: true });
          for (var x = 10; x < w; x += 34 + ((r() * 40) | 0)) {
            if (r() < 0.6) bushTree(g, x, 134, 34 + ((r() * 24) | 0), { trunk: Q.trunk, leaf: Q.leaf, leafL: Q.leafL }, r);
            else deadTree(g, x, 134, 30 + ((r() * 20) | 0), Q.mid, r);
          }
          R(g, 0, 132, w, BGH - 132, Q.mid);
        });
      } },
      { w: 320, rate: 0.4, speed: 5, lines: [94, 128, 0.32, 0.62], draw: function (g, w, Q) {
        var r = rng(5);
        for (var i = 0; i < 26; i++) { var x = (r() * w) | 0, y = 100 + ((r() * 22) | 0), rw = 14 + ((r() * 18) | 0); rep(g, w, function () { ditherBlob(g, x, y, rw, 3 + ((rw / 8) | 0), Q.fog, 6); ditherBlob(g, x + 4, y - 1, rw >> 1, 2, Q.fog2, 5); }); }
      } },
      { w: 640, rate: 1, world: true, draw: function (g, w, Q, night, st) { rep(g, w, function (k) { ruinRow(g, w, Q, night, stx(st, k), 611); }); } },
      { w: 320, rate: 1, speed: 7, lines: [132, 162, 0.92, 1.08], draw: function (g, w, Q) {
        var r = rng(15);
        for (var i = 0; i < 22; i++) { var x = (r() * w) | 0, y = 144 + ((r() * 14) | 0), rw = 12 + ((r() * 20) | 0); rep(g, w, function () { ditherBlob(g, x, y, rw, 4, Q.fog, 5); }); }
      } }
    ],
    anim: function (ctx, v, Q, night, st) {
      motes(ctx, v, Q.spore, 14, 0.6, 7);
      if (night) eyes(ctx, v, st[3].holes, 3, 640, Q.eye);
    }
  };
  /* ---------------- circus: the overgrown park outside Grimaldi's circus ---------------- */
  var CIRC = {
    far: '#4c181c', farRim: '#5a2222', tentA: '#7c1c24', tentB: '#9c8468', tent2A: '#4c2860', tent2B: '#9c7838', tent3A: '#1c3864', tent3B: '#8c8894',
    tentD: '#2c0c10', flag: '#c8a038', string: '#2c1814', wagon: '#5c1c24', wagonL: '#7c2c2c', trim: '#8c6c28', wheel: '#24140c', bars: '#3c3434',
    giraffe: '#4a2c1a', spot: '#2c180c', leaf: '#1c2c14', leafL: '#2c3c18', trunk: '#1c100c', mid: '#24100e', post: '#1c1414',
    canA: '#6c1c24', canB: '#8c7c64', canD: '#3c1418', val: '#7c6420', valL: '#9c8030', pole: '#4c3c30', poleL: '#6c5c48',
    pnA: '#8c2c30', pnB: '#8c8040', pnC: '#2c4c7c', hedge: '#1c3414', hedgeL: '#2c4c1c', bulbOff: '#3c2c24'
  };
  BG2.circus = {
    pal: pal(CIRC, { flag: '#a88838', bulbOff: '#24202c', canB: '#3c3c58', tentB: '#40405c', tent3B: '#3c3c5c' }),
    sky: function (g, Q, night) { sky(g, Q, night, { hz: 116, sun: { x: 60, y: 38, r: 16 }, seed: 31, n: { nebY: 36, slope: 0.18, nebW: 46 } }); },
    layers: [
      { w: 400, rate: 0.08, draw: function (g, w, Q) { rep(g, w, function () { skyline(g, w, 120, 41, { minW: 10, maxW: 24, minH: 14, maxH: 46, col: Q.far, gap: 22, broken: true, rim: Q.farRim }); }); } },
      { w: 640, rate: 0.2, draw: function (g, w, Q, night, st) {
        rep(g, w, function (k) {
          var s = stx(st, k);
          bigTop(g, 110, 176, 36, 124, Q.tentA, Q.tentB, Q, s);
          bigTop(g, 330, 142, 52, 124, Q.tent2A, Q.tent2B, Q, s);
          bigTop(g, 530, 158, 44, 124, Q.tent3A, Q.tent3B, Q, s);
          stringLights(g, 110, 36, 330, 52, Q, s); stringLights(g, 330, 52, 530, 44, Q, s); stringLights(g, 530, 44, 750, 36, Q, s);
        });
      } },
      { w: 480, rate: 0.5, draw: function (g, w, Q, night) {
        rep(g, w, function () {
          var r = rng(61);
          for (var x = 0; x < w; x += 26 + ((r() * 30) | 0)) bushTree(g, x, 136, 30 + ((r() * 26) | 0), { trunk: Q.trunk, leaf: Q.leaf, leafL: Q.leafL }, r);
          cageWagon(g, 40, 128, Q); cageWagon(g, 250, 128, Q);
          giraffe(g, 150, 130, Q, 0); giraffe(g, 176, 130, Q, 1); giraffe(g, 380, 130, Q, 0);
          for (x = 96; x < w; x += 160) { R(g, x, 86, 2, 50, Q.post); R(g, x - 3, 84, 8, 3, Q.post); R(g, x - 2, 80, 6, 4, night ? '#c8a050' : Q.post); }
          R(g, 0, 134, w, BGH - 134, Q.mid);
        });
      } },
      { w: 640, rate: 1, world: true, draw: function (g, w, Q, night, st) { rep(g, w, function (k) { circusWall(g, w, Q, night, stx(st, k), 77); }); } }
    ],
    anim: function (ctx, v, Q, night, st) {
      bulbs(ctx, v, st[1].bulbs, 1, 640, night);
      if (night) {
        for (var s = 0; s < 2; s++) { // spotlights behind the tents
          var ang = Math.sin(v.t * 0.5 + s * 2.1) * 0.5, bx = ((s ? 420 : 210) - v.ox[1] + 640) % 640;
          if (bx > 400) bx -= 640;
          ctx.globalAlpha = 0.07; ctx.fillStyle = '#d8d0f8';
          ctx.beginPath(); ctx.moveTo(bx, 130 + v.oy[1]); ctx.lineTo(bx + Math.sin(ang - 0.09) * 220, -10); ctx.lineTo(bx + Math.sin(ang + 0.09) * 220, -10); ctx.closePath(); ctx.fill();
          ctx.globalAlpha = 1;
        }
      }
      flags(ctx, v, st[3].flags, 3, 640, v.t, Q);
    }
  };
  function bigTop(g, cx, w, peak, base, cA, cB, Q, st) {
    var eave = base - 30, hw = w >> 1;
    // sidewall
    for (var x = -hw; x < hw; x++) R(g, cx + x, eave, 1, base - eave, ((x + 200) >> 3) & 1 ? cA : cB);
    for (x = -hw; x < hw; x += 8) R(g, cx + x, eave, 1, base - eave, Q.tentD);
    // roof: curved cone, stripes radiating from the peak
    for (var y = peak; y <= eave; y++) {
      var f = (y - peak) / (eave - peak), half = Math.round(hw * (0.12 + 0.88 * Math.pow(f, 0.62)));
      for (x = -half; x <= half; x++) { var a = x / Math.max(1, half); P(g, cx + x, y, (Math.floor((a + 1) * 6) & 1) ? cA : cB); }
      P(g, cx - half, y, Q.tentD); P(g, cx + half, y, Q.tentD);
    }
    for (x = -hw; x < hw; x += 6) { R(g, cx + x, eave, 6, 2, cA); R(g, cx + x + 1, eave + 2, 4, 1, cA); }
    R(g, cx - 1, peak - 14, 2, 14, Q.tentD); tri(g, cx + 6, peak - 14, 1, 1, Q.flag);
    for (var j = 0; j < 4; j++) R(g, cx + 1, peak - 14 + j, 8 - j * 2, 1, Q.flag);
    R(g, cx - 6, base - 16, 12, 16, Q.tentD); // entrance
    st.bulbs.push([cx, peak - 14]);
  }
  function stringLights(g, x0, y0, x1, y1, Q, st) {
    for (var k = 0; k <= 40; k++) {
      var t = k / 40, x = Math.round(x0 + (x1 - x0) * t), y = Math.round(y0 + (y1 - y0) * t + Math.sin(t * Math.PI) * 28);
      P(g, x, y, Q.string);
      if (k % 3 === 1) { st.bulbs.push([x, y + 1]); P(g, x, y + 1, Q.bulbOff); }
    }
  }
  function cageWagon(g, x, base, Q) {
    R(g, x, base - 30, 54, 24, Q.wagon); R(g, x, base - 30, 54, 2, Q.trim); R(g, x, base - 8, 54, 2, Q.trim); R(g, x - 2, base - 33, 58, 3, Q.wagonL);
    for (var b = x + 4; b < x + 52; b += 5) R(g, b, base - 28, 2, 20, Q.bars);
    R(g, x + 6, base - 22, 14, 14, Q.mid); // something big in the cage
    disc(g, x + 10, base - 4, 5, Q.wheel); disc(g, x + 44, base - 4, 5, Q.wheel); P(g, x + 10, base - 4, Q.trim); P(g, x + 44, base - 4, Q.trim);
  }
  function giraffe(g, x, base, Q, pose) { // artillery giraffes: long necks, launch harness
    R(g, x, base - 26, 18, 10, Q.giraffe); R(g, x + 1, base - 16, 2, 16, Q.giraffe); R(g, x + 15, base - 16, 2, 16, Q.giraffe);
    var nx = x + 15, ny = base - 26;
    for (var i = 0; i < 40; i++) R(g, nx + (pose ? Math.round(i * 0.2) : Math.round(i * 0.08)), ny - i, 4, 1, Q.giraffe);
    var hx = nx + (pose ? 8 : 3), hy = ny - 40;
    R(g, hx, hy - 3, 8, 4, Q.giraffe); P(g, hx + 1, hy - 5, Q.giraffe); P(g, hx + 3, hy - 5, Q.giraffe);
    P(g, x + 4, base - 24, Q.spot); P(g, x + 9, base - 22, Q.spot); P(g, x + 13, base - 25, Q.spot); P(g, nx + 1, ny - 8, Q.spot); P(g, nx + 2, ny - 15, Q.spot);
    R(g, x + 4, base - 30, 8, 4, Q.bars); R(g, x + 6, base - 34, 2, 4, Q.bars); // the sling on its back
  }
  /* ---------------- settlement: the Medium Skyfowl Settlement main street ---------------- */
  var SETT = merge(TOWN, {
    wall: '#80584c', wall2: '#74604c', stone: '#64544c', stoneL: '#786458', course: '#504440', banner: '#24544c', bannerL: '#346c60', crest: '#c8a040',
    awnA: '#24544c', awnB: '#a89878', far: '#4c1820', farRim: '#5c2226', mid: '#3a1216', cliff: '#2c0e10', cliffL: '#3c1414'
  });
  BG2.settlement = {
    pal: pal(SETT, { far: '#0e1028', farRim: '#14163a', mid: '#0a0c1e', cliff: '#080a16', cliffL: '#0e1020', smoke: '#34365a', ember: '#d86018' }),
    sky: function (g, Q, night) { sky(g, Q, night, { hz: 114, sun: { x: 120, y: 40, r: 22 }, seed: 41, n: { nebY: 34, slope: 0.1, nebW: 34 } }); },
    layers: [
      { w: 400, rate: 0.07, draw: function (g, w, Q) { rep(g, w, function () { skyline(g, w, 116, 17, { minW: 8, maxW: 20, minH: 12, maxH: 40, col: Q.far, gap: 20, broken: true, rim: Q.farRim }); }); } },
      { w: 640, rate: 0.2, draw: function (g, w, Q, night) { // the elevated administrative district on its rise, Quill's tower
        rep(g, w, function () {
          var r = rng(9);
          for (var x = 0; x < w; x++) { var y = 92 + Math.round(Math.sin(x / 60) * 4 + Math.sin(x / 17) * 2); if (x > 260 && x < 560) y -= 26; R(g, x, y, 1, BGH - y, Q.cliff); if (r() < 0.2) P(g, x, y + 2 + ((r() * 8) | 0), Q.cliffL); }
          for (x = 270; x < 550; x += 22 + ((r() * 14) | 0)) { var bh = 10 + ((r() * 18) | 0); R(g, x, 66 - bh, 18, bh + 2, Q.far); R(g, x + 2, 64 - bh, 14, 2, Q.farRim); if (night) for (var wy = 70 - bh; wy < 64; wy += 5) for (var wx = x + 3; wx < x + 16; wx += 4) if (r() < 0.25) P(g, wx, wy, '#8c6c30'); }
          R(g, 400, 6, 14, 60, Q.far); R(g, 397, 18, 20, 4, Q.farRim); tri(g, 407, -6, 16, 14, Q.far); R(g, 403, 26, 3, 5, night ? '#c89038' : Q.cliff); R(g, 408, 40, 3, 5, night ? '#c89038' : Q.cliff);
          disc(g, 480, 46, 10, Q.far); R(g, 470, 46, 21, 10, Q.far); R(g, 479, 30, 2, 8, Q.far);
        });
      } },
      { w: 480, rate: 0.45, draw: function (g, w, Q, night) {
        rep(g, w, function () { var r = rng(88); roofline(g, w, 118, Q, r, night, { col: Q.mid, lit: '#6c5020', minW: 22, maxW: 30 }); R(g, 0, 116, w, BGH - 116, Q.mid); });
      } },
      { w: 640, rate: 1, world: true, draw: function (g, w, Q, night, st) { rep(g, w, function (k) { townRow(g, w, Q, night, stx(st, k), 'settlement', 5150); }); } }
    ],
    anim: function (ctx, v, Q, night, st) {
      smokePuffs(ctx, v, st[3].chim, 3, 640, Q.smoke, night ? 0.35 : 0.5);
      if (!night) birds(ctx, v, '#2c0c10', 5);
      else lamps(ctx, v, st[3].lamps, 3, 640);
      embers(ctx, v, Q.ember, 6, 9);
    }
  };
  /* ---------------- admin: the elevated administrative district ---------------- */
  var ADM = {
    wall: '#5a4c56', wallL: '#72626c', wallD: '#3e3240', course: '#4e424c', pil: '#685a64', pilL: '#807078', pilD: '#463a44', statue: '#2c2028',
    frame: '#3c2c34', glass: '#3c2430', glassL: '#7c5c6c', lit: '#a87030', litL: '#c89040', banner: '#7c1c24', bannerL: '#9c2c30', crest: '#c8a040',
    iron: '#2c2428', brazier: '#6c2c18', plinth: '#5a4a54', plinthL: '#74646e', plinthD: '#34262e',
    far: '#4c1a22', farRim: '#5c2428', cloud: '#a86050', cloud2: '#c07c60', mid: '#3a141a'
  };
  BG2.admin = {
    pal: pal(ADM, { far: '#0e1028', farRim: '#161838', cloud: '#30345a', cloud2: '#40446c', mid: '#0a0c1e', statue: '#08080e' }),
    sky: function (g, Q, night) { sky(g, Q, night, { hz: 96, sun: { x: 250, y: 30, r: 24 }, seed: 53, n: { nebY: 26, slope: -0.12, nebW: 30 } }); },
    layers: [
      { w: 400, rate: 0.06, draw: function (g, w, Q) { rep(g, w, function () { skyline(g, w, 70, 63, { minW: 10, maxW: 22, minH: 6, maxH: 30, col: Q.far, gap: 26, spire: true, rim: Q.farRim }); R(g, 0, 70, w, BGH, Q.far); }); } },
      { w: 320, rate: 0.2, speed: 4, lines: [38, 70, 0.1, 0.34], draw: function (g, w, Q) {
        var r = rng(21);
        for (var i = 0; i < 24; i++) { var x = (r() * w) | 0, y = 44 + ((r() * 22) | 0), rw = 16 + ((r() * 22) | 0); rep(g, w, function () { blob(g, x, y, rw, 3, Q.cloud); ditherBlob(g, x - 3, y - 3, rw - 6, 2, Q.cloud2, 8); }); }
      } },
      { w: 480, rate: 0.3, draw: function (g, w, Q, night) { // Quill's tower and the 201st temple dome
        rep(g, w, function () {
          R(g, 120, 4, 24, 120, Q.mid); R(g, 116, 20, 32, 5, Q.mid); tri(g, 132, -14, 30, 18, Q.mid);
          for (var y = 30; y < 90; y += 12) R(g, 128, y, 6, 7, night ? '#a87830' : '#24080c');
          disc(g, 330, 60, 22, Q.mid); R(g, 308, 60, 45, 70, Q.mid); R(g, 329, 30, 3, 10, Q.mid); disc(g, 330, 30, 3, Q.mid);
          R(g, 0, 90, w, BGH, Q.mid);
        });
      } },
      { w: 640, rate: 1, world: true, draw: function (g, w, Q, night, st) { rep(g, w, function (k) { civicRow(g, w, Q, night, stx(st, k), 2201); }); } }
    ],
    anim: function (ctx, v, Q, night, st) {
      if (night) braziers(ctx, v, st[3].lamps, 3, 640);
      else birds(ctx, v, '#2c0c14', 3);
    }
  };

  /* ---- shared anim pieces ---- */
  function smokePuffs(ctx, v, list, li, w, col, a) {
    ctx.fillStyle = col;
    for (var i = 0; i < list.length; i++) {
      var c = list[i], h = (hash2(c[0], c[1]) & 255) / 255;
      wrapX(c[0], v.ox[li], w, function (sx) {
        for (var k = 0; k < 4; k++) {
          var p = (v.t * 0.22 + h + k / 4) % 1, rr = 1 + Math.round(p * 3);
          var px = sx + Math.round(Math.sin(p * 4 + h * 6) * 2 + p * 10), py = Math.round(c[1] + v.oy[li] - p * 38);
          ctx.globalAlpha = a * (1 - p);
          ctx.fillRect(px - rr, py - rr + 1, rr * 2 + 1, rr * 2 - 1); ctx.fillRect(px - rr + 1, py - rr, rr * 2 - 1, rr * 2 + 1);
        }
      });
    }
    ctx.globalAlpha = 1;
  }
  function embers(ctx, v, col, n, seed) {
    var r = rng(seed);
    for (var i = 0; i < n; i++) {
      var sp = 10 + r() * 16, ph = r() * 200, bx = r() * 360;
      var y = 170 - ((v.t * sp + ph) % 170), x = ((bx - v.camX * 0.7 + Math.sin(v.t * 0.8 + i) * 8) % 340 + 340) % 340 - 10;
      if (Math.sin(v.t * 6 + i * 2) > -0.4) { ctx.fillStyle = (i & 1) ? col : '#e45c10'; ctx.fillRect(Math.round(x), Math.round(y), 1, 1); }
    }
  }
  function motes(ctx, v, col, n, rate, seed) {
    var r = rng(seed);
    ctx.fillStyle = col;
    for (var i = 0; i < n; i++) {
      var bx = r() * 340, by = 20 + r() * 140, ph = r() * 6;
      var x = ((bx - v.camX * rate + Math.sin(v.t * 0.5 + ph) * 14) % 340 + 340) % 340 - 10, y = by + Math.sin(v.t * 0.7 + ph * 2) * 8;
      if (Math.sin(v.t * 2 + ph) > -0.2) ctx.fillRect(Math.round(x), Math.round(y), 1, 1);
    }
  }
  function lamps(ctx, v, list, li, w) {
    for (var i = 0; i < list.length; i++) {
      var c = list[i];
      wrapX(c[0], v.ox[li], w, function (sx) {
        var y = c[1] + v.oy[li], f = Math.sin(v.t * 7 + i * 1.3) + Math.sin(v.t * 17 + i) > 1.2 ? 0.7 : 1;
        glow(ctx, sx, y, 10, '#f8a040', 0.08 * f);
        ctx.fillStyle = f < 1 ? '#f8b800' : '#fcf0b0'; ctx.fillRect(sx - 1, y - 2, 3, 3);
      });
    }
  }
  function braziers(ctx, v, list, li, w) {
    for (var i = 0; i < list.length; i++) {
      var c = list[i];
      wrapX(c[0], v.ox[li], w, function (sx) { var y = c[1] + v.oy[li]; glow(ctx, sx + 2, y - 2, 12, '#f87800', 0.09); drawFlame(ctx, sx + 1, y - 3, v.t, i, false); ctx.fillStyle = '#f83800'; ctx.fillRect(sx, y - 1, 4, 1); });
    }
  }
  function eyes(ctx, v, list, li, w, col) {
    for (var i = 0; i < list.length; i++) {
      var c = list[i], h = hash2(c[0], c[1]);
      if (h % 3) continue;
      var ph = (v.t * 0.3 + (h & 255) / 255) % 1;
      if (ph > 0.55 || (ph > 0.3 && ph < 0.33)) continue;
      wrapX(c[0], v.ox[li], w, function (sx) { var y = c[1] + v.oy[li] + 2; ctx.fillStyle = col; ctx.fillRect(sx - 2, y, 1, 1); ctx.fillRect(sx + 1, y, 1, 1); });
    }
  }
  function bulbs(ctx, v, list, li, w, night) {
    var cols = ['#f83800', '#f8b800', '#3cbcfc', '#58d854', '#f878f8'], step = Math.floor(v.t * 3);
    for (var i = 0; i < list.length; i++) {
      var c = list[i], on = ((i + step) % 3) !== 0;
      if (!on && !night) continue;
      wrapX(c[0], v.ox[li], w, function (sx) {
        var y = c[1] + v.oy[li];
        ctx.fillStyle = on ? cols[i % 5] : '#24202c'; ctx.globalAlpha = night ? 1 : 0.75; ctx.fillRect(sx, y, 1, 1);
        if (night && on) { ctx.globalAlpha = 0.18; ctx.fillRect(sx - 1, y - 1, 3, 3); }
        ctx.globalAlpha = 1;
      });
    }
  }
  function flags(ctx, v, list, li, w, t, Q) {
    for (var i = 0; i < list.length; i++) {
      var c = list[i];
      wrapX(c[0], v.ox[li], w, function (sx) {
        var y = c[1] + v.oy[li], f = Math.floor(t * 4 + i) & 1;
        ctx.fillStyle = Q.pnA; ctx.fillRect(sx, y, 7, 2); ctx.fillRect(sx, y + 2, 5 - f, 2); ctx.fillRect(sx + 7, y + f, 2, 1);
      });
    }
  }
  function birds(ctx, v, col, n) {
    ctx.fillStyle = col;
    for (var i = 0; i < n; i++) {
      var sp = 14 + i * 5, x = ((i * 97 + v.t * sp - v.camX * 0.15) % 400 + 400) % 400 - 40, y = 18 + i * 9 + Math.sin(v.t * 1.4 + i) * 4;
      var f = Math.floor(v.t * 5 + i) & 1;
      x = Math.round(x); y = Math.round(y);
      ctx.fillRect(x, y, 1, 1); ctx.fillRect(x - 2, y - 1 + f, 2, 1); ctx.fillRect(x + 1, y - 1 + f, 2, 1); ctx.fillRect(x - 3, y - f, 1, 1); ctx.fillRect(x + 3, y - f, 1, 1);
    }
  }

  /* ---------------- alley: back alleys of the settlement ---------------- */
  var ALLEYP = {
    wall: '#3c2420', wallL: '#4c302a', course: '#2c1814', far: '#2c1014', farL: '#3c181a', pipe: '#2c2c2c', pipeL: '#4c4c4c',
    wood: '#3c2414', woodL: '#5c3c20', woodD: '#24140a', frame: '#1c0c08', glass: '#200c0c', glassL: '#5c3434', lit: '#8c5c20', litL: '#a87030',
    clothA: '#5c3c5c', clothB: '#3c5c5c', clothC: '#7c6c4c', rope: '#1c1410', trash: '#24241c', trashL: '#3c3c2c', barrel: '#4c2c14', barrelL: '#6c4020', hoop: '#2c2c2c',
    iron: '#1c1414', lantern: '#3c2c20', lanternL: '#5c4c30', steam: '#8c7c78', grate: '#1c1c1c'
  };
  BG2.alley = {
    pal: pal(ALLEYP, { steam: '#3c3c58' }),
    sky: function (g, Q, night) { sky(g, Q, night, { hz: 70, seed: 61, haze: 6, n: { nebY: 20, slope: 0.05, nebW: 18, stars: 60 } }); },
    layers: [
      { w: 400, rate: 0.15, draw: function (g, w, Q, night) {
        rep(g, w, function () {
          var r = rng(3), x = 0;
          while (x < w) { var bw = 18 + ((r() * 26) | 0), top = 24 + ((r() * 30) | 0); R(g, x, top, bw, BGH, Q.far); R(g, x, top, 1, BGH, Q.farL); if (night && r() < 0.5) R(g, x + 4 + ((r() * (bw - 8)) | 0), top + 10 + ((r() * 30) | 0), 3, 4, '#5c4820'); x += bw + 1; }
        });
      } },
      { w: 480, rate: 0.45, draw: function (g, w, Q, night) {
        rep(g, w, function () {
          var r = rng(17);
          brickWall(g, 0, 30, w, BGH - 30, Q, 5);
          for (var x = 0; x < w; x += 96) R(g, x, 30, 3, BGH, Q.course); // building seams
          for (x = 14; x < w; x += 48 + ((r() * 20) | 0)) win(g, x, 46 + ((r() * 2) | 0) * 22, 8, 10, Q, night && r() < 0.4, { shutters: r() < 0.5 });
          for (x = 40; x < w; x += 120) { R(g, x, 30, 3, BGH, Q.pipe); R(g, x, 30, 1, BGH, Q.pipeL); for (var y = 40; y < 160; y += 24) R(g, x - 1, y, 5, 2, Q.pipeL); }
          for (x = 70; x < w; x += 160) { // wooden balcony walkway
            R(g, x, 90, 60, 3, Q.wood); R(g, x, 90, 60, 1, Q.woodL); for (var q = x; q <= x + 60; q += 5) R(g, q, 82, 1, 8, Q.woodD); R(g, x, 81, 61, 1, Q.wood);
            line(g, x, 93, x + 10, 103, Q.woodD); line(g, x + 60, 93, x + 50, 103, Q.woodD);
          }
          for (x = 0; x < w; x += 80) { // laundry lines
            var y0 = 34 + ((r() * 10) | 0), y1 = 34 + ((r() * 10) | 0);
            for (var k = 0; k <= 80; k++) { var yy = Math.round(y0 + (y1 - y0) * k / 80 + Math.sin(k / 80 * Math.PI) * 8); P(g, x + k, yy, Q.rope); if (k % 14 === 6 && r() < 0.8) { var cw = 5 + ((r() * 4) | 0); R(g, x + k, yy + 1, cw, 6 + ((r() * 5) | 0), [Q.clothA, Q.clothB, Q.clothC][(r() * 3) | 0]); } }
          }
        });
      } },
      { w: 640, rate: 0.8, draw: function (g, w, Q, night, st) {
        rep(g, w, function (k) {
          var s = stx(st, k), r = rng(29);
          for (var x = 20; x < w; x += 50 + ((r() * 60) | 0)) {
            var kind = (r() * 3) | 0;
            if (kind === 0) { R(g, x, 136, 14, 22, Q.barrel); R(g, x, 136, 3, 22, Q.barrelL); R(g, x, 140, 14, 2, Q.hoop); R(g, x, 152, 14, 2, Q.hoop); }
            else if (kind === 1) { blob(g, x + 8, 154, 10, 6, Q.trash); blob(g, x + 4, 150, 5, 4, Q.trashL); blob(g, x + 14, 151, 4, 4, Q.trash); P(g, x + 5, 147, Q.trashL); }
            else { R(g, x, 146, 18, 14, Q.wood); R(g, x, 146, 18, 1, Q.woodL); line(g, x, 146, x + 17, 159, Q.woodD); }
          }
          for (x = 100; x < w; x += 210) lantern(g, x, 100, Q, s);
          for (x = 160; x < w; x += 300) { R(g, x, 156, 20, 4, Q.grate); for (var q = x + 1; q < x + 20; q += 3) R(g, q, 156, 1, 4, Q.pipeL); s.misc.push([x + 10, 154]); }
        });
      } }
    ],
    anim: function (ctx, v, Q, night, st) {
      if (night) lamps(ctx, v, st[2].lamps, 2, 640);
      steam(ctx, v, st[2].misc, 2, 640, Q.steam);
      drips(ctx, v, '#5c7c9c', 4, 0.45, 32, 120);
    }
  };
  function steam(ctx, v, list, li, w, col) {
    ctx.fillStyle = col;
    for (var i = 0; i < list.length; i++) {
      var c = list[i];
      wrapX(c[0], v.ox[li], w, function (sx) {
        for (var k = 0; k < 3; k++) { var p = (v.t * 0.4 + k / 3 + i * 0.13) % 1, rr = 1 + Math.round(p * 4); ctx.globalAlpha = 0.35 * (1 - p); ctx.fillRect(sx - rr + Math.round(Math.sin(p * 5) * 3), Math.round(c[1] + v.oy[li] - p * 30), rr * 2, rr * 2); }
      });
    }
    ctx.globalAlpha = 1;
  }
  function drips(ctx, v, col, n, rate, y0, len) {
    ctx.fillStyle = col;
    for (var i = 0; i < n; i++) {
      var bx = (i * 83 + 37) % 340, p = (v.t * 0.6 + i * 0.37) % 1;
      var x = ((bx - v.camX * rate) % 340 + 340) % 340 - 10, y = y0 + p * p * len;
      ctx.fillRect(Math.round(x), Math.round(y), 1, 2);
    }
  }
  /* ---------------- basement: Signet's lair under the collapsed building ---------------- */
  var BASEP = {
    wall: '#2c2830', wallL: '#3c3842', course: '#1c1a20', dark: '#0c0a10', arch: '#100e14', archL: '#34303c', beam: '#2c1c10', beamL: '#4c3018', beamD: '#180c06',
    chain: '#3c3c44', water: '#102840', waterL: '#28507c', moss: '#24341c', shell: '#8c7468', shellL: '#a88c7c', lily: '#3c7c3c', lilyP: '#c860c0', wax: '#c8c0a8', iron: '#24242c',
    shaft: '#d8a080', drip: '#4c88b8', tat: '#2c5c5c'
  };
  BG2.basement = {
    pal: pal(BASEP, { shaft: '#5c6c9c' }, 0.55),
    sky: function (g, Q) { R(g, 0, 0, 320, BGH, Q.dark); },
    layers: [
      { w: 320, rate: 0.25, draw: function (g, w, Q) { // far vaulted arcade receding into the dark
        rep(g, w, function () {
          brickWall(g, 0, 0, w, BGH, { wall: Q.arch, course: Q.dark }, 7);
          for (var x = 0; x < w; x += 64) { R(g, x + 22, 40, 20, 140, Q.dark); blob(g, x + 32, 40, 10, 10, Q.dark); for (var a = 0; a < 10; a++) P(g, x + 32 + Math.round(Math.cos(Math.PI * a / 9) * 11), 40 - Math.round(Math.sin(Math.PI * a / 9) * 11), Q.archL); }
        });
      } },
      { w: 384, rate: 0.55, draw: function (g, w, Q, night, st) {
        rep(g, w, function (k) {
          var s = stx(st, k), r = rng(44);
          for (var x = 0; x < w; x += 128) {
            // a big arch: columns + vault
            brickWall(g, x, 0, 24, BGH, Q, 6); R(g, x, 0, 2, BGH, Q.wallL); R(g, x + 22, 0, 2, BGH, Q.course);
            for (var a = 0; a <= 104; a++) { var yy = Math.round(30 - Math.sin(a / 104 * Math.PI) * 22); R(g, x + 24 + a, 0, 1, yy, Q.wall); P(g, x + 24 + a, yy, Q.wallL); P(g, x + 24 + a, yy + 1, Q.course); }
            // support beam (from the collapse) + hanging chain + candles
            line(g, x + 30, 0, x + 96, 120, Q.beamD); line(g, x + 31, 0, x + 97, 120, Q.beam); line(g, x + 32, 0, x + 98, 120, Q.beamL);
            for (var c = 0; c < 30; c += 3) { R(g, x + 70, 8 + c, 2, 2, Q.chain); }
            R(g, x + 66, 38, 10, 3, Q.iron);
            candle(g, x + 4, 92, Q, s); candle(g, x + 16, 96, Q, s);
            // seashell niche (Signet is half naiad)
            blob(g, x + 12, 60, 7, 6, Q.shell); for (var q = -6; q <= 6; q += 3) line(g, x + 12, 66, x + 12 + q, 55, Q.shellL); R(g, x + 6, 66, 13, 2, Q.shellL);
            s.misc.push([x + 60, 0]);
          }
          // dark pool with water lilies at the foot
          R(g, 0, 140, w, BGH - 140, Q.water); for (x = 0; x < w; x += 7) P(g, x, 141 + (x % 3), Q.waterL);
          for (x = 30; x < w; x += 90) { blob(g, x, 143, 6, 2, Q.lily); P(g, x, 141, Q.lilyP); P(g, x + 1, 140, Q.lilyP); P(g, x - 1, 141, Q.lilyP); }
        });
      } }
    ],
    anim: function (ctx, v, Q, night, st) {
      if (!night) { // light shafts from the cracks in the collapsed ceiling
        var list = st[1].misc;
        for (var i = 0; i < list.length; i++) wrapX(list[i][0], v.ox[1], 384, function (sx) {
          ctx.globalAlpha = 0.07 + Math.sin(v.t * 0.7 + i) * 0.02; ctx.fillStyle = Q.shaft;
          ctx.beginPath(); ctx.moveTo(sx - 4, 0); ctx.lineTo(sx + 4, 0); ctx.lineTo(sx + 26, 170); ctx.lineTo(sx + 4, 170); ctx.closePath(); ctx.fill(); ctx.globalAlpha = 1;
        });
        motes(ctx, v, '#c8a088', 10, 0.55, 13);
      }
      flames(ctx, v, st[1].flames, 1, 384, true);
      drips(ctx, v, Q.drip, 5, 0.55, 30, 110);
    }
  };
  function flames(ctx, v, list, li, w, big) {
    for (var i = 0; i < list.length; i++) { var c = list[i]; wrapX(c[0], v.ox[li], w, function (sx) { drawFlame(ctx, sx, c[1] + v.oy[li], v.t, i, big); }); }
  }
  /* ---------------- office: Quill's office, the shelves of stuffed figures ---------------- */
  var OFFP = {
    panel: '#4c2814', panelL: '#5c3418', panelD: '#2c1408', wains: '#3c1c0c', shelf: '#3c1c0c', shelfL: '#5c2c14', frame: '#24100a',
    curtain: '#5c1420', curtainL: '#7c1c28', gold: '#a88038', cab: '#3c4444', cabL: '#5c6464', perch: '#2c1808', wax: '#c8c0a8', iron: '#24140c',
    plush: ['#6c3440', '#34506c', '#6c5c28', '#3c5c34', '#5c4070', '#7c5030', '#6c6c70'], paint: '#3c2c24', paintL: '#6c5440', bird: '#8c8070'
  };
  BG2.office = {
    pal: pal(OFFP, { plush: ['#52304a', '#2c4060', '#5c5028', '#30483a', '#46345e', '#604030', '#585868'] }, 0.5),
    sky: function (g, Q) {
      R(g, 0, 0, 320, BGH, Q.panel);
      for (var x = 0; x < 320; x += 20) { R(g, x, 0, 1, BGH, Q.panelD); R(g, x + 1, 0, 1, BGH, Q.panelL); }
      R(g, 0, 120, 320, BGH - 120, Q.wains); R(g, 0, 120, 320, 2, Q.gold);
    },
    layers: [
      { w: 480, rate: 0.3, draw: function (g, w, Q, night) {
        rep(g, w, function () {
          for (var x = 20; x < w; x += 160) {
            windowSky(g, x, 18, 30, 64, night, { frame: Q.frame }, x);
            R(g, x - 8, 10, 8, 84, Q.curtain); R(g, x + 30, 10, 8, 84, Q.curtain); R(g, x - 8, 10, 2, 84, Q.curtainL); R(g, x + 36, 10, 2, 84, Q.curtainL); R(g, x - 10, 8, 50, 3, Q.gold);
            // portrait of a stern old skyfowl
            R(g, x + 72, 30, 26, 32, Q.gold); R(g, x + 74, 32, 22, 28, Q.paint); blob(g, x + 85, 44, 6, 7, Q.paintL); tri(g, x + 92, 42, 6, 4, Q.gold); R(g, x + 78, 52, 14, 8, Q.paintL); P(g, x + 86, 42, '#000000');
          }
        });
      } },
      { w: 480, rate: 0.6, draw: function (g, w, Q, night, st) {
        rep(g, w, function (k) {
          var s = stx(st, k), r = rng(71);
          for (var x = 0; x < w; x += 120) {
            // a tall bookcase crammed with stuffed figures
            R(g, x + 4, 20, 70, 140, Q.shelf); R(g, x + 4, 20, 70, 2, Q.shelfL);
            for (var sy = 36; sy < 160; sy += 22) {
              R(g, x + 6, sy, 66, 3, Q.shelfL); R(g, x + 6, sy + 3, 66, 1, Q.frame);
              for (var px = x + 8; px < x + 70; px += 5) { var c = Q.plush[(r() * Q.plush.length) | 0], ph = 7 + ((r() * 5) | 0); R(g, px, sy - ph, 4, ph, c); R(g, px + 1, sy - ph - 2, 2, 2, c); P(g, px + 1, sy - ph + 2, Q.frame); }
            }
            R(g, x + 4, 20, 2, 140, Q.frame); R(g, x + 72, 20, 2, 140, Q.frame);
            // filing cabinet + candle
            R(g, x + 84, 112, 22, 48, Q.cab); for (var d = 0; d < 3; d++) { R(g, x + 86, 114 + d * 15, 18, 13, Q.cabL); R(g, x + 93, 119 + d * 15, 4, 1, Q.gold); }
            candle(g, x + 93, 105, Q, s);
          }
        });
      } }
    ],
    anim: function (ctx, v, Q, night, st) {
      flames(ctx, v, st[1].flames, 1, 480, true);
      if (!night) motes(ctx, v, '#c89c78', 8, 0.3, 21);
    }
  };
  /* ---------------- nest: the Krasue nest ---------------- */
  var NESTP = {
    dark: '#0c0406', wall: '#140608', panel: '#1c0c0a', mem: '#28080e', memL: '#3a0c14', vein: '#4a1430', organ: '#6c1c24', organL: '#8c2c30',
    gut: '#7c3c3c', gutL: '#a05050', bone: '#8c8070', boneD: '#4c4038', blood: '#5c0810', sac: '#4c2030', sacL: '#7c3c50', frame: '#3c2c24'
  };
  BG2.nest = {
    pal: pal(NESTP, {}, 0.5),
    sky: function (g, Q) {
      R(g, 0, 0, 320, BGH, Q.wall);
      for (var x = 0; x < 320; x += 24) R(g, x, 0, 1, BGH, Q.panel);
      noiseCloud(g, 0, 0, 320, BGH, 77, [Q.mem, Q.memL], function () { return 0.9; }, 0.6);
    },
    layers: [
      { w: 400, rate: 0.25, draw: function (g, w, Q) {
        rep(g, w, function () {
          var r = rng(19);
          for (var i = 0; i < 14; i++) { // veins across the wall
            var x = (r() * w) | 0, y = 0;
            while (y < BGH) { P(g, x, y, Q.vein); P(g, x + 1, y, Q.vein); y++; if (r() < 0.4) x += r() < 0.5 ? 1 : -1; }
          }
          // Featherfall's round frame, empty, in the gloom
          ring(g, 200, 70, 26, Q.frame, 3); line(g, 174, 70, 226, 70, Q.frame); line(g, 200, 44, 200, 96, Q.frame);
          for (var b = 0; b < 4; b++) { var bx = 30 + b * 96; for (var rr = 0; rr < 5; rr++) { var yy = 100 + rr * 7; for (var q = -10; q <= 10; q++) P(g, bx + q, yy + Math.round(q * q / 22), Q.boneD); } R(g, bx - 1, 96, 2, 36, Q.boneD); }
        });
      } },
      { w: 480, rate: 0.55, draw: function (g, w, Q, night, st) {
        rep(g, w, function (k) {
          var s = stx(st, k), r = rng(37);
          for (var x = 6; x < w; x += 18 + ((r() * 26) | 0)) { // hanging entrails
            var len = 30 + ((r() * 70) | 0), xx = x;
            for (var y = 0; y < len; y++) { R(g, xx, y, 2, 1, (y % 7 < 4) ? Q.gut : Q.organ); if (y % 7 === 0) P(g, xx + 2, y, Q.gutL); if (r() < 0.12) xx += r() < 0.5 ? 1 : -1; }
            if (r() < 0.5) { blob(g, xx + 1, len + 3, 3, 4, Q.organ); P(g, xx, len + 1, Q.organL); }
          }
          for (x = 40; x < w; x += 110) { // egg-sac clusters
            for (var e = 0; e < 4; e++) { var ex = x + e * 7 - 10, ey = 130 + (e & 1) * 6; blob(g, ex, ey, 5, 6, Q.sac); P(g, ex - 2, ey - 3, Q.sacL); P(g, ex - 1, ey - 4, Q.sacL); s.misc.push([ex, ey]); }
          }
          for (x = 90; x < w; x += 140) { blob(g, x, 156, 16, 6, Q.boneD); for (var bb = 0; bb < 6; bb++) { var bx = x - 12 + bb * 5; R(g, bx, 150 - (bb & 1) * 3, 6, 2, Q.bone); } disc(g, x + 6, 146, 3, Q.bone); P(g, x + 5, 146, Q.dark); }
        });
      } }
    ],
    anim: function (ctx, v, Q, night, st) {
      var list = st[1].misc, pulse = 0.08 + Math.sin(v.t * 2.2) * 0.05;
      ctx.fillStyle = '#c83c5c';
      for (var i = 0; i < list.length; i++) wrapX(list[i][0], v.ox[1], 480, function (sx) { ctx.globalAlpha = pulse; ctx.fillRect(sx - 4, list[i][1] + v.oy[1] - 4, 8, 9); });
      ctx.globalAlpha = 1;
      drips(ctx, v, '#8c0818', 6, 0.55, 20, 140);
      motes(ctx, v, '#a88c8c', 8, 0.4, 41);
    }
  };
  /* ---------------- ymca: the YMCA-like gym in the Dispenser's neighborhood ---------------- */
  var GYMP = {
    lo: '#1e2c50', loL: '#26365c', hi: '#565046', hiL: '#625a50', course: '#16203c', courseHi: '#48423a', stripe: '#7c2c24',
    wood: '#6c4828', woodL: '#8c5c34', woodD: '#3c2414', hoop: '#c84c18', board: '#8c8c8c', boardD: '#5c5c5c', pad: '#2c3c6c', padL: '#3c4c7c',
    frame: '#1c1c24', light: '#c8c8a8', lightD: '#5c5c4c', score: '#141414', digit: '#c83818', pen: ['#7c2c2c', '#2c5c7c', '#7c6c2c', '#2c6c3c'], graffiti: '#5c7c2c'
  };
  BG2.ymca = {
    pal: pal(GYMP, { digit: '#f83800', light: '#3c3c34' }, 0.55),
    sky: function (g, Q) {
      R(g, 0, 0, 320, BGH, Q.hi);
      for (var y = 0; y < 100; y += 6) { R(g, 0, y, 320, 1, Q.courseHi); for (var x = ((y / 6) & 1) * 8; x < 320; x += 16) R(g, x, y, 1, 6, Q.courseHi); }
      R(g, 0, 100, 320, BGH - 100, Q.lo);
      for (y = 100; y < BGH; y += 6) { R(g, 0, y, 320, 1, Q.course); for (x = ((y / 6) & 1) * 8; x < 320; x += 16) R(g, x, y, 1, 6, Q.course); }
      R(g, 0, 96, 320, 4, Q.stripe);
    },
    layers: [
      { w: 480, rate: 0.3, draw: function (g, w, Q, night) {
        rep(g, w, function () {
          for (var x = 10; x < w; x += 60) windowSky(g, x, 10, 30, 14, night, { frame: Q.frame }, x);
          for (x = 0; x < w; x += 24) { tri(g, x + 12, 34, 10, 10, Q.pen[(x / 24) % 4], true); } R(g, 0, 33, w, 1, Q.frame);
          R(g, 200, 44, 60, 26, Q.score); R(g, 200, 44, 60, 2, Q.boardD);
          rows(g, 208, 50, ['ddd.ddd...ddd.ddd', 'd.d...d...d.d.d.d', 'd.d.ddd...d.d.ddd', 'd.d.d.....d.d...d', 'ddd.ddd...ddd.ddd'], { d: Q.digit });
          R(g, 228, 60, 4, 4, Q.digit);
          R(g, 80, 60, 30, 3, Q.graffiti); R(g, 84, 63, 3, 10, Q.graffiti); R(g, 100, 63, 3, 8, Q.graffiti);
        });
      } },
      { w: 480, rate: 0.6, draw: function (g, w, Q, night) {
        rep(g, w, function () {
          // bleachers
          for (var s = 0; s < 5; s++) { R(g, 20 - s * 0, 112 + s * 10, 180, 4, Q.wood); R(g, 20, 112 + s * 10, 180, 1, Q.woodL); R(g, 20, 116 + s * 10, 180, 6, Q.woodD); }
          for (var x = 24; x < 200; x += 30) R(g, x, 116, 2, 50, Q.frame);
          // basketball hoop on the wall
          R(g, 300, 40, 44, 30, Q.board); R(g, 302, 42, 40, 26, Q.boardD); R(g, 314, 52, 16, 12, Q.board); R(g, 317, 70, 10, 2, Q.hoop);
          for (var n = 0; n < 6; n++) line(g, 317 + n * 2, 72, 319 + n, 82, '#bcbcbc');
          R(g, 320, 70, 4, 40, Q.frame);
          // wall pads
          for (x = 380; x < 470; x += 22) { R(g, x, 104, 20, 50, Q.pad); R(g, x, 104, 20, 1, Q.padL); R(g, x, 104, 1, 50, Q.padL); }
          // broken hanging light
          R(g, 240, 0, 1, 20, Q.frame); R(g, 232, 20, 18, 4, Q.lightD); R(g, 233, 24, 16, 1, Q.light);
        });
      } }
    ],
    anim: function (ctx, v, Q, night) {
      var x = ((240 - v.camX * 0.6) % 480 + 480) % 480, on = Math.sin(v.t * 13) + Math.sin(v.t * 3.1) > 0.6;
      if (x > 360) x -= 480;
      if (on) { ctx.globalAlpha = night ? 0.06 : 0.1; ctx.fillStyle = '#e8e8c8'; ctx.beginPath(); ctx.moveTo(x - 8, 25); ctx.lineTo(x + 26, 25); ctx.lineTo(x + 60, 170); ctx.lineTo(x - 40, 170); ctx.closePath(); ctx.fill(); ctx.globalAlpha = 1; }
      motes(ctx, v, '#a8a090', 6, 0.5, 33);
    }
  };
  /* ---------------- school: the Apito Education Center ---------------- */
  var SCHP = {
    wall: '#6c2c20', course: '#4c1c14', plaster: '#5c4c44', plasterL: '#6c5c50', chalk: '#1c2c24', chalkL: '#7c8c80', frame: '#3c2410', frameL: '#5c3c1c',
    locker: '#2c5c44', lockerL: '#3c7c5c', lockerD: '#183424', cork: '#6c4c2c', paper: ['#a8a088', '#8c9cb0', '#b09878'], banner: '#3c2460', bannerL: '#5c3c84', gold: '#a88038',
    portrait: '#2c2430', skin: '#a89878', sparkle: '#b878f8'
  };
  BG2.school = {
    pal: pal(SCHP, { sparkle: '#d8a8fc' }, 0.5),
    sky: function (g, Q) {
      R(g, 0, 0, 320, BGH, Q.plaster); for (var x = 0; x < 320; x += 4) if ((x * 7) % 13 < 2) R(g, x, 0, 1, 120, Q.plasterL);
      brickWall(g, 0, 110, 320, BGH - 110, Q, 5); R(g, 0, 108, 320, 3, Q.frame); R(g, 0, 108, 320, 1, Q.frameL);
    },
    layers: [
      { w: 480, rate: 0.3, draw: function (g, w, Q, night) {
        rep(g, w, function () {
          for (var x = 16; x < w; x += 120) {
            windowSky(g, x, 16, 28, 40, night, { frame: Q.frame }, x + 3);
            R(g, x + 50, 8, 16, 34, Q.banner); R(g, x + 50, 8, 2, 34, Q.bannerL); tri(g, x + 58, 42, 16, 6, Q.banner, true);
            line(g, x + 53, 34, x + 63, 16, Q.gold); P(g, x + 63, 15, '#fcfcfc'); P(g, x + 62, 14, Q.gold); P(g, x + 64, 16, Q.gold);
            R(g, x + 80, 20, 20, 26, Q.gold); R(g, x + 82, 22, 16, 22, Q.portrait); blob(g, x + 90, 31, 4, 5, Q.skin); P(g, x + 85, 26, Q.skin); P(g, x + 95, 26, Q.skin); R(g, x + 85, 38, 10, 6, Q.banner);
          }
        });
      } },
      { w: 480, rate: 0.6, draw: function (g, w, Q) {
        rep(g, w, function () {
          var r = rng(101);
          for (var x = 0; x < w; x += 160) {
            // chalkboard with spell diagrams
            R(g, x + 10, 40, 80, 50, Q.frame); R(g, x + 12, 42, 76, 46, Q.chalk); R(g, x + 10, 90, 80, 3, Q.frameL);
            ring(g, x + 32, 62, 12, Q.chalkL); line(g, x + 20, 62, x + 44, 62, Q.chalkL); line(g, x + 32, 50, x + 32, 74, Q.chalkL); tri(g, x + 32, 54, 14, 14, Q.chalk);
            for (var l = 0; l < 4; l++) R(g, x + 52, 50 + l * 8, 20 + ((r() * 12) | 0), 1, Q.chalkL);
            line(g, x + 54, 84, x + 80, 76, Q.chalkL);
            // cork board
            R(g, x + 100, 46, 30, 26, Q.frame); R(g, x + 102, 48, 26, 22, Q.cork);
            for (var p = 0; p < 4; p++) R(g, x + 104 + ((r() * 18) | 0), 50 + ((r() * 14) | 0), 6, 5, Q.paper[(r() * 3) | 0]);
            // lockers
            for (var lk = 0; lk < 4; lk++) { var lx = x + 100 + lk * 12; R(g, lx, 106, 11, 54, Q.locker); R(g, lx, 106, 1, 54, Q.lockerL); R(g, lx + 10, 106, 1, 54, Q.lockerD); for (var vv = 110; vv < 118; vv += 2) R(g, lx + 2, vv, 7, 1, Q.lockerD); R(g, lx + 8, 128, 1, 3, Q.gold); }
          }
        });
      } }
    ],
    anim: function (ctx, v, Q) { motes(ctx, v, Q.sparkle, 12, 0.5, 51); }
  };
  /* ---------------- depot: the guard depot, the soul crystal ---------------- */
  var DEPP = {
    stone: '#2c2c34', stoneL: '#3c3c48', course: '#1c1c24', dark: '#101016', iron: '#3c4048', ironL: '#5c646c', rack: '#3c2c1c', rackL: '#5c4428', blade: '#8c949c', bladeL: '#bcc4cc',
    banner: '#5c1c24', bannerL: '#7c2c30', gold: '#a88038', crystal: '#2898b8', crystalL: '#8ce4f4', crystalD: '#14485c', chain: '#4c4c54', statue: '#34343c', statueL: '#4c4c58', glowC: '#40d0f0'
  };
  BG2.depot = {
    pal: pal(DEPP, {}, 0.55),
    sky: function (g, Q) { brickWall(g, 0, 0, 320, BGH, { wall: Q.stone, course: Q.course }, 8); dither(g, 0, 0, 320, 30, Q.dark, 8); },
    layers: [
      { w: 480, rate: 0.25, draw: function (g, w, Q, night, st) {
        rep(g, w, function (k) {
          var s = stx(st, k);
          for (var x = 0; x < w; x += 96) { // vault ribs
            for (var a = 0; a <= 96; a++) { var yy = Math.round(36 - Math.sin(a / 96 * Math.PI) * 26); R(g, x + a, 0, 1, yy, Q.dark); P(g, x + a, yy, Q.stoneL); }
            R(g, x, 0, 6, BGH, Q.stoneL); R(g, x + 5, 0, 1, BGH, Q.course);
          }
          // the soul crystal in its niche, chained (Remex is tied to it)
          var cx = 240;
          R(g, cx - 26, 30, 52, 110, Q.dark); blob(g, cx, 30, 26, 14, Q.dark);
          for (var y = 0; y < 50; y++) { var hw = Math.round(10 * Math.sin(Math.min(1, y / 18) * Math.PI / 2) * (y > 30 ? (50 - y) / 20 : 1)); R(g, cx - hw, 48 + y, hw * 2, 1, y % 9 < 2 ? Q.crystalL : Q.crystal); P(g, cx - hw, 48 + y, Q.crystalD); }
          line(g, cx - 2, 52, cx - 6, 80, Q.crystalL);
          for (var c = 0; c < 4; c++) { line(g, cx - 26 + c * 2, 34 + c * 22, cx - 8, 60 + c * 8, Q.chain); line(g, cx + 26 - c * 2, 34 + c * 22, cx + 8, 60 + c * 8, Q.chain); }
          R(g, cx - 16, 100, 32, 8, Q.iron); R(g, cx - 16, 100, 32, 1, Q.ironL); R(g, cx - 10, 108, 20, 30, Q.iron);
          s.misc.push([cx, 74]);
        });
      } },
      { w: 480, rate: 0.55, draw: function (g, w, Q) {
        rep(g, w, function () {
          for (var x = 0; x < w; x += 160) {
            // weapon rack
            R(g, x + 10, 100, 60, 4, Q.rack); R(g, x + 10, 140, 60, 4, Q.rack); R(g, x + 10, 100, 60, 1, Q.rackL);
            for (var b = 0; b < 6; b++) { var bx = x + 16 + b * 9; R(g, bx, 70, 2, 74, Q.blade); R(g, bx, 70, 1, 74, Q.bladeL); R(g, bx - 2, 96, 6, 2, Q.gold); tri(g, bx + 1, 64, 4, 6, Q.blade); }
            // guard statue silhouette in an alcove
            R(g, x + 90, 60, 36, 100, Q.dark); blob(g, x + 108, 60, 18, 10, Q.dark);
            R(g, x + 100, 74, 16, 50, Q.statue); R(g, x + 102, 64, 12, 12, Q.statueL); R(g, x + 104, 68, 8, 2, Q.dark); R(g, x + 98, 124, 8, 30, Q.statue); R(g, x + 110, 124, 8, 30, Q.statue);
            R(g, x + 120, 50, 3, 100, Q.blade); R(g, x + 116, 96, 11, 3, Q.gold);
            // banner
            R(g, x + 136, 20, 18, 50, Q.banner); R(g, x + 136, 20, 2, 50, Q.bannerL); tri(g, x + 145, 70, 18, 6, Q.banner, true); disc(g, x + 145, 40, 4, Q.gold);
          }
        });
      } }
    ],
    anim: function (ctx, v, Q, night, st) {
      var list = st[0].misc, p = 0.1 + Math.sin(v.t * 1.8) * 0.05 + (night ? 0.04 : 0);
      for (var i = 0; i < list.length; i++) wrapX(list[i][0], v.ox[0], 480, function (sx) { glow(ctx, sx, list[i][1] + v.oy[0], 30, Q.glowC, p); });
      motes(ctx, v, '#8ce4f4', 10, 0.25, 61);
    }
  };
  /* ---------------- escape: The Fools Who Broke the Glass ---------------- */
  var ESCP = { far: '#3c0c14', farL: '#5c1418', mid: '#2c080c', near: '#1c0608', fire: '#c83810', fireL: '#f8a040', smoke: '#24141c', crack: '#f8d8f8', crackG: '#c058f8', winF: '#a84818' };
  BG2.escape = {
    pal: pal(ESCP, { far: '#140a2c', farL: '#201040', mid: '#0c061c', near: '#080412', smoke: '#100c1c', fire: '#c83810', fireL: '#f8a040', crack: '#fcfcfc', crackG: '#d878f8', winF: '#a84818' }),
    sky: function (g, Q, night) {
      sky(g, Q, night, { hz: 120, seed: 71, haze: 14, d: { cols: ['#1c0408', '#2c060c', '#440a10', '#5c1014', '#781818', '#901c18', '#a82c18', '#c04018'] }, n: { neb: 1, nebY: 50, slope: 0.32, nebW: 50 } });
      // the glass of the sky cracking: white-violet fracture lines from the west
      var r = rng(19);
      for (var k = 0; k < 7; k++) {
        var x = 10 + ((r() * 60) | 0), y = 20 + ((r() * 60) | 0), ang = -0.8 + r() * 1.6;
        for (var s = 0; s < 18; s++) { var nx = x + Math.cos(ang) * 8, ny = y + Math.sin(ang) * 8; line(g, x, y, nx, ny, s < 6 ? Q.crack : Q.crackG); x = nx; y = ny; ang += (r() - 0.5) * 0.9; if (x > 320 || y < 0 || y > 120) break; }
      }
      ditherBlob(g, 0, 100, 70, 50, '#f8d8f8', 3); ditherBlob(g, 0, 100, 44, 34, '#f8d8f8', 6);
    },
    layers: [
      { w: 400, rate: 0.1, draw: function (g, w, Q) { rep(g, w, function () { skyline(g, w, 124, 81, { minW: 10, maxW: 26, minH: 20, maxH: 70, col: Q.far, gap: 8, broken: true, rim: Q.farL }); }); } },
      { w: 480, rate: 0.3, draw: function (g, w, Q, night, st) {
        rep(g, w, function (k) {
          var s = stx(st, k), r = rng(83);
          roofline(g, w, 130, Q, r, night, { col: Q.mid, minW: 20, maxW: 26 });
          for (var x = 30; x < w; x += 80 + ((r() * 40) | 0)) { // smoke columns rising from fires
            for (var y = 120; y > 10; y -= 4) ditherBlob(g, x + Math.round((120 - y) * 0.25) + Math.round(Math.sin(y / 9) * 3), y, 6 + Math.round((120 - y) / 12), 3, Q.smoke, 10);
            s.flames.push([x, 122]);
          }
        });
      } },
      { w: 640, rate: 0.62, draw: function (g, w, Q, night) {
        rep(g, w, function () {
          var r = rng(97), x = 0;
          while (x < w) {
            var bw = 40 + ((r() * 40) | 0), top = 70 + ((r() * 40) | 0);
            for (var i = 0; i < bw; i++) { var yy = top + ((i * 7 + bw) % 9 < 3 ? 4 : 0) + (i > bw * 0.6 ? Math.round((i - bw * 0.6) * 0.6) : 0); R(g, x + i, yy, 1, BGH - yy, Q.near); }
            for (var wy = top + 10; wy < 150; wy += 14) for (var wx = x + 6; wx < x + bw - 8; wx += 12) if (r() < 0.45) R(g, wx, wy, 5, 7, r() < 0.4 ? Q.winF : Q.mid);
            x += bw + 6 + ((r() * 10) | 0);
          }
        });
      } }
    ],
    anim: function (ctx, v, Q, night, st) {
      flames(ctx, v, st[1].flames, 1, 480, true);
      embers(ctx, v, '#f8d878', 22, 7);
      if (Math.sin(v.t * 2.3) + Math.sin(v.t * 5.9) > 1.55) { ctx.globalAlpha = 0.12; ctx.fillStyle = '#f8d8f8'; ctx.fillRect(0, 0, 320, 180); ctx.globalAlpha = 1; }
      var p = (v.t * 0.5) % 1; ctx.globalAlpha = 0.1 * (1 - p); ctx.fillStyle = '#f8d8f8'; ctx.fillRect(0, 0, Math.round(40 + p * 30), 180); ctx.globalAlpha = 1;
    },
    wob: [0, 110, 1, 0.22]
  };
  /* ---------------- restroom: a dungeon restroom out in the ruins ---------------- */
  var RESP = {
    tile: '#4e5a52', tileL: '#64726a', grout: '#38423c', tileD: '#3a4640', stall: '#2c4c58', stallL: '#3a5e6c', stallD: '#1c3038', porc: '#7c8480', porcD: '#4c5450',
    mirror: '#34404c', mirrorL: '#5c6c7c', pipe: '#444444', pipeL: '#646464', grime: '#5c4c28', light: '#d8e8d8', graffiti: '#8c2c48', frame: '#2c3430'
  };
  BG2.restroom = {
    pal: pal(RESP, { light: '#4c584c' }, 0.55),
    sky: function (g, Q) {
      R(g, 0, 0, 320, BGH, Q.grout);
      for (var y = 0; y < BGH; y += 8) for (var x = 0; x < 320; x += 8) { R(g, x, y, 7, 7, (((x + y) >> 3) & 1) && y > 100 ? Q.tileD : Q.tile); P(g, x, y, Q.tileL); }
      for (var i = 0; i < 40; i++) { var r = rng(i); dither(g, (r() * 320) | 0, 90 + ((r() * 90) | 0), 6, 4, Q.grime, 6); }
      R(g, 0, 98, 320, 3, Q.tileD);
    },
    layers: [
      { w: 384, rate: 0.3, draw: function (g, w, Q, night) {
        rep(g, w, function () {
          for (var x = 20; x < w; x += 64) {
            R(g, x, 40, 28, 30, Q.frame); R(g, x + 1, 41, 26, 28, Q.mirror); line(g, x + 4, 60, x + 14, 44, Q.mirrorL); line(g, x + 18, 66, x + 24, 56, Q.mirrorL);
            if (x % 128 === 20) { line(g, x + 3, 42, x + 25, 67, Q.mirrorL); }
            R(g, x - 2, 82, 32, 6, Q.porc); R(g, x - 2, 82, 32, 1, '#d8e0dc'); R(g, x + 10, 88, 8, 14, Q.porcD); R(g, x + 12, 76, 4, 6, Q.pipeL);
          }
          windowSky(g, 300, 6, 30, 12, night, { frame: Q.frame }, 7); dither(g, 300, 6, 30, 12, '#a8b0ac', 8);
          rows(g, 140, 18, ['g...g.ggg.g..g', 'g...g.g...g..g', 'ggggg.gg..gg.g', 'g...g.g...g.gg', 'g...g.ggg.g..g'], { g: Q.graffiti });
        });
      } },
      { w: 480, rate: 0.62, draw: function (g, w, Q) {
        rep(g, w, function () {
          for (var x = 0; x < w; x += 40) { // stalls
            R(g, x, 76, 4, 84, Q.stallD); R(g, x + 4, 80, 32, 72, Q.stall); R(g, x + 4, 80, 32, 1, Q.stallL); R(g, x + 4, 80, 1, 72, Q.stallL);
            R(g, x + 30, 112, 3, 6, Q.pipeL); R(g, x + 6, 152, 30, 8, Q.grout);
            if ((x / 40) % 3 === 1) { R(g, x + 4, 80, 10, 72, Q.stallD); R(g, x + 14, 80, 1, 72, Q.stallL); }
          }
          R(g, 0, 72, w, 4, Q.pipe); R(g, 0, 72, w, 1, Q.pipeL);
        });
      } }
    ],
    anim: function (ctx, v, Q, night) {
      if (Math.sin(v.t * 31) > 0.7 && Math.sin(v.t * 1.3) > 0) { ctx.globalAlpha = 0.08; ctx.fillStyle = '#000000'; ctx.fillRect(0, 0, 320, 180); ctx.globalAlpha = 1; }
      drips(ctx, v, '#8cb8a8', 3, 0.62, 76, 80);
    }
  };
  /* ---------------- temple: a corrupt temple in the ruins (and the 201st's) ---------------- */
  var TEMP = {
    wall: '#1c1424', wallL: '#2c2038', course: '#120c18', col: '#2c2438', colL: '#4c3c5c', colD: '#140c1c', glowC: '#7c28b8', glowL: '#b858f8', gold: '#8c6c28',
    glass: ['#6c1c3c', '#1c3c6c', '#6c5c1c', '#2c5c3c', '#4c2c6c'], lead: '#0c0810', altar: '#24182c', altarL: '#3c2c48', idol: '#3c2c48', idolL: '#5c4c6c', wax: '#c8c0a8', iron: '#2c2430'
  };
  BG2.temple = {
    pal: pal(TEMP, { glass: ['#2c0c24', '#0c1c3c', '#2c2810', '#10281c', '#201434'] }, 0.55),
    sky: function (g, Q) {
      brickWall(g, 0, 0, 320, BGH, { wall: Q.wall, course: Q.course }, 9);
      var r = rng(5);
      for (var i = 0; i < 9; i++) { var x = (r() * 320) | 0, y = 0; while (y < BGH) { P(g, x, y, Q.glowC); y++; if (r() < 0.45) x += r() < 0.5 ? 1 : -1; if (r() < 0.02) break; } }
    },
    layers: [
      { w: 480, rate: 0.25, draw: function (g, w, Q) {
        rep(g, w, function () {
          var r = rng(15);
          for (var x = 40; x < w; x += 160) { // tall stained-glass window
            R(g, x - 2, 16, 44, 96, Q.lead); blob(g, x + 20, 16, 22, 14, Q.lead);
            for (var y = 6; y < 110; y += 6) for (var q = 0; q < 40; q += 8) { if (y < 18 && Math.abs(q + 4 - 20) > Math.sqrt(Math.max(0, 400 - (18 - y) * (18 - y) * 2.4))) continue; R(g, x + q, y, 7, 5, Q.glass[(r() * 5) | 0]); }
            R(g, x + 18, 6, 4, 106, Q.lead); R(g, x, 60, 40, 3, Q.lead);
          }
        });
      } },
      { w: 480, rate: 0.55, draw: function (g, w, Q, night, st) {
        rep(g, w, function (k) {
          var s = stx(st, k);
          for (var x = 0; x < w; x += 120) { // obsidian columns
            R(g, x, 0, 20, BGH, Q.col); R(g, x + 2, 0, 3, BGH, Q.colL); R(g, x + 16, 0, 4, BGH, Q.colD); R(g, x - 3, 20, 26, 6, Q.colL); R(g, x - 3, 140, 26, 8, Q.colL);
            for (var y = 30; y < 140; y += 22) { P(g, x + 9, y, Q.glowL); P(g, x + 10, y + 1, Q.glowC); }
          }
          for (x = 40; x < w; x += 240) { // altar with a skyfowl idol and candles
            R(g, x, 124, 44, 36, Q.altar); R(g, x, 124, 44, 2, Q.altarL); R(g, x + 4, 130, 36, 2, Q.gold);
            R(g, x + 16, 92, 12, 32, Q.idol); blob(g, x + 22, 88, 7, 7, Q.idol); tri(g, x + 31, 86, 6, 4, Q.gold); R(g, x + 6, 100, 10, 12, Q.idolL); R(g, x + 28, 100, 10, 12, Q.idolL); P(g, x + 24, 86, Q.glowL);
            candle(g, x + 4, 116, Q, s); candle(g, x + 38, 116, Q, s);
            s.misc.push([x + 22, 100]);
          }
          for (x = 160; x < w; x += 240) { R(g, x, 0, 1, 50, Q.iron); R(g, x - 4, 50, 9, 7, Q.iron); R(g, x - 3, 51, 7, 5, Q.gold); s.misc.push([x, 60]); }
        });
      } }
    ],
    anim: function (ctx, v, Q, night, st) {
      flames(ctx, v, st[1].flames, 1, 480, true);
      var list = st[1].misc, p = 0.07 + Math.sin(v.t * 1.5) * 0.04;
      for (var i = 0; i < list.length; i++) wrapX(list[i][0], v.ox[1], 480, function (sx) { glow(ctx, sx, list[i][1] + v.oy[1], 16, Q.glowL, p); });
      motes(ctx, v, Q.glowL, 12, 0.4, 71);
    }
  };

  /* ---- background() ---- */
  var bgCache = {};
  function newState() { return { chim: [], lamps: [], holes: [], flags: [], flames: [], bulbs: [], misc: [] }; }
  function buildBg(id, night) {
    var spec = BG2[id], Q = night ? spec.pal.n : spec.pal.d;
    var b = { spec: spec, Q: Q, night: night, sky: mkCanvas(320, BGH), layers: [], st: [] };
    try { spec.sky(g2(b.sky), Q, night); } catch (e) { if (window.console) console.error('art sky failed: ' + id, e); }
    for (var i = 0; i < spec.layers.length; i++) {
      var L = spec.layers[i], cv = mkCanvas(L.w, BGH), st = newState();
      try { L.draw(g2(cv), L.w, Q, night, st); } catch (e2) { if (window.console) console.error('art bg layer failed: ' + id + ' #' + i, e2); }
      b.layers.push({ cv: cv, L: L }); b.st.push(st);
    }
    bgCache[id + (night ? '~n' : '')] = b;
    // the clock will flip day/night sooner or later: build the other variant when the browser is idle
    if (!bgCache[id + (night ? '' : '~n')] && !b.queued) {
      b.queued = true;
      var later = function () { if (!bgCache[id + (night ? '' : '~n')]) buildBg(id, !night); };
      if (window.requestIdleCallback) window.requestIdleCallback(later, { timeout: 4000 }); else setTimeout(later, 1500);
    }
    return b;
  }
  function drawLines(ctx, cv, L, camX, t, oy) {
    var y0 = L.lines[0], y1 = L.lines[1], r0 = L.lines[2], r1 = L.lines[3], w = L.w;
    for (var sy = y0; sy < y1; sy += 2) {
      var f = (sy - y0) / Math.max(1, y1 - y0), rate = r0 + (r1 - r0) * f;
      var ox = Math.floor(((camX * rate + t * (L.speed || 0) * (0.6 + f * 0.8)) % w + w) % w);
      for (var x = -ox; x < 320; x += w) ctx.drawImage(cv, 0, sy, w, 2, x, sy + oy, w, 2);
    }
  }
  var view = { camX: 0, camY: 0, t: 0, ox: [], oy: [] };
  function bgId(theme) { return BG2[theme] ? theme : BD[theme] ? theme : (ALIAS[theme] && (BG2[ALIAS[theme]] || BD[ALIAS[theme]])) ? ALIAS[theme] : 'ruins'; }
  art.background = function (ctx, theme, camX, camY, opts) {
    var night = !!(opts && opts.night), t = (opts && opts.t !== undefined) ? +opts.t : (DCW.t || 0);
    var id = bgId(theme);
    if (BD[id]) { drawBackdrop(ctx, id, night, t); return; }
    var b = bgCache[id + (night ? '~n' : '')] || buildBg(id, night);
    camX = +camX || 0; camY = +camY || 0;
    var cy = camY < 0 ? 0 : camY > 160 ? 160 : camY;
    ctx.drawImage(b.sky, 0, -Math.round(cy * 0.06));
    view.camX = camX; view.camY = camY; view.t = t;
    for (var i = 0; i < b.layers.length; i++) {
      var Ly = b.layers[i], L = Ly.L, w = L.w;
      var oy = L.world ? -Math.round(camY < 0 ? 0 : camY > BGH - 180 ? BGH - 180 : camY) : -Math.round(Math.min(BGH - 180, cy * L.rate * 0.5));
      var ox = Math.floor(((camX * L.rate + t * (L.speed || 0)) % w + w) % w);
      view.ox[i] = ox; view.oy[i] = oy;
      if (L.lines) drawLines(ctx, Ly.cv, L, camX, t, oy);
      else for (var x = -ox; x < 320; x += w) ctx.drawImage(Ly.cv, x, oy);
      if (L.wob) art.wobble(ctx, L.wob[0], L.wob[1], L.wob[2], L.wob[3], t);
    }
    if (b.spec.anim) { try { b.spec.anim(ctx, view, b.Q, night, b.st); } catch (e) { if (window.console) console.error('art bg anim failed: ' + id, e); b.spec.anim = null; } }
    if (b.spec.wob) art.wobble(ctx, b.spec.wob[0], b.spec.wob[1], b.spec.wob[2], b.spec.wob[3], t);
  };
  // optional: pre-build a theme's layers (e.g. on stage enter) to avoid a first-frame hitch
  art.prepare = function (theme, night) {
    var id = bgId(theme);
    if (BG2[id] && !bgCache[id + (night ? '~n' : '')]) buildBg(id, !!night);
    else if (BD[id]) backdropCanvas(id, !!night);
  };

  /* ---- raster wobble: per-scanline x offsets of what is already on the canvas ----
     amp px, freq = radians per scanline (0.15-0.6 reads well), t seconds (phase runs at 6 rad/s). */
  var wobCv = null, wobG = null;
  art.wobble = function (ctx, y0, y1, amp, freq, t) {
    if (!ctx || !ctx.canvas || !amp) return;
    var cv = ctx.canvas, W = cv.width, H = cv.height;
    var m = ctx.getTransform ? ctx.getTransform() : null, sx = m ? m.a : 1, sy = m ? m.d : 1, ty = m ? m.f : 0;
    var a = Math.max(0, Math.floor(y0 * sy + ty)), b = Math.min(H, Math.ceil(y1 * sy + ty));
    if (b <= a) return;
    var h = b - a;
    if (!wobCv || wobCv.width < W || wobCv.height < h) { wobCv = mkCanvas(Math.max(W, wobCv ? wobCv.width : 0), Math.max(h, wobCv ? wobCv.height : 0)); wobG = g2(wobCv); }
    wobG.clearRect(0, 0, W, h);
    wobG.drawImage(cv, 0, a, W, h, 0, 0, W, h);
    t = t === undefined ? (DCW.t || 0) : t;
    var f = freq || 0.3, A = amp * sx;
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.imageSmoothingEnabled = false; ctx.globalAlpha = 1;
    for (var y = 0; y < h; y++) {
      var off = Math.round(Math.sin(((a + y) / sy) * f + t * 6) * A);
      if (off) ctx.drawImage(wobCv, 0, y, W, 1, off, a + y, W, 1);
    }
    ctx.restore();
  };

  /* =====================================================================
     BACKDROPS (background() only; UI and cinema): static 320x180 + anim
     ===================================================================== */
  var BD = {};
  var bdCache = {};
  function withText(g, fn) { // DCW.text draws to DCW.ctx: point it at g for a moment
    if (!DCW.text) return;
    var old = DCW.ctx; DCW.ctx = g;
    try { fn(); } catch (e) { /* font not ready */ }
    DCW.ctx = old;
  }
  function backdropCanvas(id, night) {
    var key = id + (night ? '~n' : ''), c = bdCache[key];
    if (c) return c;
    var cv = mkCanvas(320, 180), st = newState();
    try { BD[id].draw(g2(cv), night, st, 320, 180); } catch (e) { if (window.console) console.error('art backdrop failed: ' + id, e); }
    c = bdCache[key] = { cv: cv, st: st };
    return c;
  }
  function drawBackdrop(ctx, id, night, t) {
    var c = backdropCanvas(id, night);
    ctx.drawImage(c.cv, 0, 0);
    if (BD[id].anim) { try { BD[id].anim(ctx, t, night, c.st, 0, 0); } catch (e) { if (window.console) console.error('art backdrop anim failed: ' + id, e); } }
  }
  art.backdrops = ['inn_pug', 'inn_narwhal', 'club', 'studio', 'greenroom', 'guide_room'];

  // three TV screens on a safe-room wall (the System AI's feed)
  function tvs(g, x0, y, Q, st) {
    for (var i = 0; i < 3; i++) {
      var x = x0 + i * 46;
      R(g, x - 2, y - 2, 40, 30, '#000000'); R(g, x - 1, y - 1, 38, 28, Q.tvF || '#2c2c2c'); R(g, x, y, 36, 26, '#0a1c2c');
      R(g, x + 16, y + 28, 4, 4, '#1c1c1c'); R(g, x + 10, y - 6, 1, 4, Q.iron || '#1c1414'); R(g, x + 26, y - 6, 1, 4, Q.iron || '#1c1414');
      st.misc.push([x, y, i]);
    }
  }
  function tvAnim(ctx, t, list) {
    for (var i = 0; i < list.length; i++) {
      var x = list[i][0], y = list[i][1], k = list[i][2], ph = Math.floor(t * 0.4 + k * 0.7) % 4;
      ctx.fillStyle = '#0a1c2c'; ctx.fillRect(x, y, 36, 26);
      if (ph === 0) { // the AI's face
        ctx.fillStyle = '#2c8cbc'; ctx.fillRect(x + 10, y + 7, 4, 4); ctx.fillRect(x + 22, y + 7, 4, 4); ctx.fillRect(x + 10, y + 17, 16, 2);
        if (Math.floor(t * 3) & 1) ctx.fillRect(x + 12, y + 19, 12, 2);
      } else if (ph === 1) { // a crawler on the feed (Carl, probably)
        ctx.fillStyle = '#7c4c18'; ctx.fillRect(x + 14, y + 10, 8, 9); ctx.fillStyle = '#f0c8a0'; ctx.fillRect(x + 15, y + 5, 6, 5); ctx.fillStyle = '#2858c8'; ctx.fillRect(x + 14, y + 19, 8, 4);
        ctx.fillStyle = '#a81000'; ctx.fillRect(x + 2, y + 2, 4, 3);
      } else if (ph === 2) { // views ticker
        ctx.fillStyle = '#58d854'; for (var b = 0; b < 6; b++) { var hgt = 4 + ((b * 7 + Math.floor(t * 2)) % 14); ctx.fillRect(x + 3 + b * 5, y + 23 - hgt, 4, hgt); }
      } else { ctx.fillStyle = '#f878f8'; ctx.fillRect(x + 6, y + 8, 24, 10); ctx.fillStyle = '#fcfcfc'; ctx.fillRect(x + 8, y + 10, 4, 6); ctx.fillRect(x + 14, y + 10, 4, 6); ctx.fillRect(x + 20, y + 10, 8, 2); }
      ctx.globalAlpha = 0.25; ctx.fillStyle = '#000000';
      for (var s = (Math.floor(t * 30) & 1); s < 26; s += 2) ctx.fillRect(x, y + s, 36, 1);
      ctx.globalAlpha = 1;
    }
  }
  function hearthFire(ctx, x, y, t, w) {
    for (var i = 0; i < w; i += 3) {
      var h = 6 + Math.round((Math.sin(t * 9 + i * 1.3) + Math.sin(t * 15 + i * 0.7) + 2) * 3);
      ctx.fillStyle = '#c83810'; ctx.fillRect(x + i, y - h, 3, h);
      ctx.fillStyle = '#f8a040'; ctx.fillRect(x + i + 1, y - Math.round(h * 0.7), 1, Math.round(h * 0.7));
      if (h > 14) { ctx.fillStyle = '#f8d878'; ctx.fillRect(x + i + 1, y - 4, 1, 3); }
    }
    ctx.globalAlpha = 0.08 + Math.sin(t * 7) * 0.02; ctx.fillStyle = '#f8a040'; ctx.fillRect(x - 30, y - 60, w + 60, 90); ctx.globalAlpha = 1;
  }
  function pubRoom(g, night, st, o) { // shared Renaissance-fair pub: timber, plaster, bar, kegs, hearth, 3 TVs
    var Q = o.Q, r = rng(o.seed);
    R(g, 0, 0, 320, 180, Q.plaster); for (var i = 0; i < 160; i++) P(g, (r() * 320) | 0, 20 + ((r() * 120) | 0), Q.plasterD);
    // timber frame
    R(g, 0, 0, 320, 16, Q.beam); R(g, 0, 14, 320, 2, Q.beamD); for (var x = 0; x < 320; x += 40) { R(g, x, 0, 6, 150, Q.beam); R(g, x, 0, 1, 150, Q.beamL); R(g, x + 5, 0, 1, 150, Q.beamD); }
    R(g, 0, 70, 320, 4, Q.beam); R(g, 0, 70, 320, 1, Q.beamL);
    for (x = 6; x < 320; x += 40) { line(g, x, 74, x + 34, 112, Q.beam); line(g, x + 1, 74, x + 35, 112, Q.beamD); }
    // pennant garland (Renaissance fair)
    for (x = 0; x < 320; x++) { var y = 22 + Math.round(Math.sin((x % 80) / 80 * Math.PI) * 6); P(g, x, y, Q.beamD); if (x % 10 === 2) tri(g, x + 3, y + 1, 7, 7, Q.flags[((x / 10) | 0) % Q.flags.length], true); }
    // hearth on the left
    R(g, 8, 76, 74, 76, Q.stone); for (var sy = 78; sy < 150; sy += 6) { R(g, 8, sy, 74, 1, Q.stoneD); for (x = 8 + ((sy / 6) & 1) * 6; x < 82; x += 12) R(g, x, sy, 1, 6, Q.stoneD); }
    R(g, 4, 72, 82, 6, Q.beamL); R(g, 4, 76, 82, 2, Q.beamD);
    R(g, 20, 104, 50, 48, '#0c0604'); blob(g, 45, 104, 25, 10, '#0c0604');
    R(g, 24, 146, 42, 4, '#2c1c14'); line(g, 26, 146, 40, 138, '#3c2414'); line(g, 64, 146, 48, 138, '#3c2414');
    st.flames.push([24, 146, 42]);
    for (x = 12; x < 82; x += 14) { R(g, x, 64, 8, 8, Q.mug); R(g, x + 8, 66, 2, 4, Q.mug); R(g, x, 64, 8, 1, '#fcfcfc'); }
    // kegs rack + bar counter
    R(g, 196, 82, 116, 40, Q.beamD);
    for (var k = 0; k < 5; k++) { var kx = 200 + k * 22; blob(g, kx + 9, 98, 9, 9, Q.keg); R(g, kx, 94, 18, 1, Q.hoop); R(g, kx, 102, 18, 1, Q.hoop); disc(g, kx + 9, 98, 3, Q.kegL); R(g, kx + 8, 106, 2, 6, '#bcbcbc'); }
    R(g, 196, 74, 116, 4, Q.beamL);
    for (x = 200; x < 308; x += 7) { R(g, x, 64, 4, 10, Q.bottles[((x / 7) | 0) % Q.bottles.length]); R(g, x + 1, 60, 2, 4, Q.bottles[((x / 7) | 0) % Q.bottles.length]); }
    R(g, 150, 122, 170, 30, Q.bar); R(g, 150, 120, 170, 4, Q.barL); R(g, 150, 124, 170, 1, Q.beamD); for (x = 160; x < 320; x += 26) { R(g, x, 128, 18, 18, Q.barD); R(g, x + 1, 129, 16, 1, Q.barL); }
    // floor
    R(g, 0, 150, 320, 30, Q.floor); for (y = 150; y < 180; y += 5) R(g, 0, y, 320, 1, Q.floorD); for (y = 150; y < 180; y += 5) for (x = ((y / 5) & 1) * 23; x < 320; x += 46) R(g, x, y, 1, 5, Q.floorD);
    R(g, 0, 150, 320, 1, Q.floorL);
    // chandelier: a wagon wheel of candles
    R(g, 159, 16, 1, 18, Q.iron); R(g, 130, 34, 60, 3, Q.beam); R(g, 130, 34, 60, 1, Q.beamL);
    for (x = 134; x < 190; x += 11) candle(g, x, 28, { wax: '#e0d8c0', iron: Q.iron }, st);
    tvs(g, 108, 36, Q, st);
  }
  /* ---- the Belly-Rubbed Pug (Gordo the Bopca's inn) ---- */
  BD.inn_pug = {
    draw: function (g, night, st) {
      var Q = {
        plaster: '#7c6040', plasterD: '#6c5034', beam: '#3c2010', beamL: '#5c3418', beamD: '#24100a', stone: '#4c4448', stoneD: '#2c2830',
        flags: ['#a82020', '#c8a030', '#2858a8', '#3c8c3c'], mug: '#a87c48', keg: '#6c4020', kegL: '#8c5428', hoop: '#2c2c2c',
        bottles: ['#3c7c3c', '#7c3c1c', '#3c5c8c', '#8c7c2c'], bar: '#5c3014', barL: '#8c5028', barD: '#4c2810', floor: '#4c2c14', floorD: '#341c0c', floorL: '#6c4020', iron: '#1c1414', tvF: '#3c3c3c'
      };
      if (night) { Q.plaster = '#5c4834'; Q.plasterD = '#4c3c2c'; }
      pubRoom(g, night, st, { Q: Q, seed: 3 });
      // the inn's plaque: a pug lying on its back, legs up
      R(g, 250, 26, 52, 34, '#24100a'); R(g, 252, 28, 48, 30, '#a87c48'); R(g, 252, 28, 48, 1, '#c89c60');
      blob(g, 276, 46, 14, 7, '#c8a070'); blob(g, 266, 42, 7, 6, '#c8a070'); blob(g, 266, 43, 4, 3, '#3c2414'); P(g, 264, 40, '#000000'); P(g, 268, 40, '#000000');
      R(g, 280, 34, 2, 6, '#c8a070'); R(g, 286, 35, 2, 6, '#c8a070'); R(g, 272, 34, 2, 6, '#c8a070'); blob(g, 278, 47, 5, 3, '#e8c8a0');
      R(g, 291, 44, 4, 2, '#c8a070'); R(g, 294, 42, 2, 2, '#c8a070');
      // small window
      windowSky(g, 98, 90, 30, 30, night, { frame: '#24100a' }, 9);
    },
    anim: function (ctx, t, night, st) {
      var f = st.flames;
      hearthFire(ctx, f[0][0], f[0][1], t, f[0][2]);
      for (var i = 1; i < f.length; i++) drawFlame(ctx, f[i][0], f[i][1], t, i, true);
      tvAnim(ctx, t, st.misc);
    }
  };
  /* ---- the One-Eyed Narwhal (Fitz's inn in the settlement) ---- */
  BD.inn_narwhal = {
    draw: function (g, night, st) {
      var Q = {
        plaster: '#3c5c5c', plasterD: '#2c4c4c', beam: '#2c1c10', beamL: '#4c3018', beamD: '#180c06', stone: '#4c4448', stoneD: '#2c2830',
        flags: ['#2858a8', '#c8a030', '#fcfcfc', '#a82020'], mug: '#bcbcbc', keg: '#5c3c20', kegL: '#7c5028', hoop: '#a88038',
        bottles: ['#3c8c7c', '#8c3c3c', '#c8a030', '#3c5c8c'], bar: '#3c2414', barL: '#6c4424', barD: '#2c180c', floor: '#3c2814', floorD: '#24180c', floorL: '#5c3c20', iron: '#1c1414', tvF: '#5c4c2c'
      };
      if (night) { Q.plaster = '#2c4048'; Q.plasterD = '#24343c'; }
      pubRoom(g, night, st, { Q: Q, seed: 7 });
      // the mounted narwhal, eyepatch and all
      R(g, 238, 34, 2, 2, '#24100a');
      blob(g, 270, 44, 22, 8, '#8c9cac'); blob(g, 270, 46, 20, 5, '#bcc8d0'); tri(g, 294, 42, 8, 8, '#8c9cac'); R(g, 244, 40, 6, 1, '#e8e0c8'); line(g, 250, 40, 226, 34, '#e8e0c8'); line(g, 250, 41, 226, 35, '#c8c0a8');
      R(g, 256, 40, 5, 4, '#000000'); line(g, 254, 38, 266, 46, '#000000'); P(g, 262, 44, '#3c3c3c');
      for (var i = 0; i < 4; i++) P(g, 266 + i * 6, 41, '#5c6c7c');
      // ship's wheel + porthole + net with floats
      ring(g, 108, 104, 14, '#6c4424', 2); disc(g, 108, 104, 3, '#6c4424'); for (var a = 0; a < 8; a++) { var an = a * Math.PI / 4; line(g, 108, 104, 108 + Math.round(Math.cos(an) * 19), 104 + Math.round(Math.sin(an) * 19), '#6c4424'); }
      ring(g, 22, 40, 10, '#a88038', 2); disc(g, 22, 40, 8, night ? '#0a0c26' : '#781418'); P(g, 19, 37, '#fcfcfc');
      for (var x = 40; x < 100; x += 5) line(g, x, 16, x + 8, 60, '#5c4c3c'); for (var y = 20; y < 60; y += 6) R(g, 40, y, 62, 1, '#5c4c3c');
      disc(g, 52, 50, 3, '#c83820'); disc(g, 84, 38, 3, '#c8a030');
    },
    anim: BD.inn_pug.anim
  };
  /* ---- the Desperado Club: Vegas strip + Mardi Gras + 70s disco, Blade Runner main room ---- */
  BD.club = {
    draw: function (g, night, st) {
      bands(g, 320, 0, 180, ['#06020c', '#0a0414', '#10061c', '#140824', '#10061c']);
      // the big rain-streaked window onto a neon city (Blade Runner)
      R(g, 92, 14, 136, 74, '#000000'); R(g, 94, 16, 132, 70, '#0c0c24');
      var r = rng(31);
      for (var x = 94; x < 226; x += 6 + ((r() * 8) | 0)) { var h = 14 + ((r() * 44) | 0); R(g, x, 86 - h, 6 + ((r() * 6) | 0), h, '#141430'); for (var wy = 88 - h; wy < 86; wy += 4) if (r() < 0.5) P(g, x + 2 + ((r() * 3) | 0), wy, ['#f878f8', '#3cbcfc', '#f8b800'][(r() * 3) | 0]); }
      R(g, 140, 30, 18, 6, '#f85898'); R(g, 180, 44, 12, 4, '#3cbcfc'); for (x = 94; x < 226; x += 33) R(g, x, 16, 2, 70, '#000000'); R(g, 94, 50, 132, 2, '#000000');
      // neon sign over the window
      R(g, 96, 92, 128, 18, '#000000'); R(g, 97, 93, 126, 16, '#14081c');
      withText(g, function () { DCW.text('DESPERADO CLUB', 161, 98, '#880c40', { align: 'center', shadow: null }); DCW.text('DESPERADO CLUB', 160, 97, '#f85898', { align: 'center', shadow: null }); });
      st.misc.push(['sign', 96, 92]);
      // Vegas marquee bulbs around the sign
      for (x = 96; x < 224; x += 4) { st.bulbs.push([x, 91]); st.bulbs.push([x, 110]); }
      // Mardi Gras bead strings + masks
      var beadC = ['#7c2cb8', '#2c9c3c', '#c8a030'];
      for (var s = 0; s < 6; s++) { var bx0 = s * 54; for (var k = 0; k <= 54; k += 2) { var yy = 4 + Math.round(Math.sin(k / 54 * Math.PI) * 10); P(g, bx0 + k, yy, beadC[(s + (k >> 2)) % 3]); } }
      function mask(mx, my, c1, c2) { blob(g, mx, my, 8, 4, c1); blob(g, mx - 4, my - 1, 2, 1, '#000000'); blob(g, mx + 4, my - 1, 2, 1, '#000000'); tri(g, mx - 6, my - 10, 5, 7, c2); tri(g, mx + 6, my - 10, 5, 7, c2); R(g, mx - 1, my + 3, 2, 8, c2); }
      mask(40, 50, '#7c2cb8', '#c8a030'); mask(280, 46, '#2c9c3c', '#7c2cb8');
      // neon outlines: cowboy hat (desperado) left, star right
      rows(g, 20, 76, ['.....nnnnnnn.....', '....n.......n....', '....n.......n....', '...n.........n...', 'nnnnnnnnnnnnnnnnn', '.nn...........nn.'], { n: '#3cbcfc' });
      rows(g, 274, 70, ['.....n.....', '....n.n....', 'nnnn...nnnn', '.n.......n.', '..n.....n..', '.n...n...n.', 'n..n...n..n', 'nn.......nn'], { n: '#f8b800' });
      // the bar and its bottles on the right, the DJ booth left
      R(g, 240, 118, 80, 22, '#1c0c24'); R(g, 240, 116, 80, 3, '#f878f8'); for (x = 244; x < 316; x += 6) { R(g, x, 102, 3, 12, ['#3cbcfc', '#f878f8', '#58d854', '#f8b800'][(x / 6) % 4 | 0]); }
      R(g, 0, 118, 70, 22, '#1c0c24'); R(g, 0, 116, 70, 3, '#3cbcfc'); disc(g, 20, 112, 5, '#2c2c3c'); disc(g, 46, 112, 5, '#2c2c3c');
      // disco ball
      R(g, 159, 0, 1, 2, '#bcbcbc');
      for (var dy = -8; dy <= 8; dy++) for (var dx = -8; dx <= 8; dx++) if (dx * dx + dy * dy <= 64) P(g, 160 + dx, 2 + 8 + dy, ((dx + 20) >> 1 & 1) ^ ((dy + 20) >> 1 & 1) ? '#bcbcbc' : '#5c5c6c');
      st.misc.push(['ball', 160, 10]);
      // dance floor (drawn lit in anim)
      R(g, 0, 140, 320, 40, '#08040c');
      for (var ty = 0; ty < 4; ty++) for (var tx = 0; tx < 16; tx++) st.flags.push([tx * 20, 140 + ty * 10]);
    },
    anim: function (ctx, t, night, st) {
      var cols = ['#940084', '#0058f8', '#e40058', '#00a844', '#f8b800', '#6844fc'], fl = st.flags, beat = Math.floor(t * 4);
      for (var i = 0; i < fl.length; i++) {
        var c = (i * 7 + ((i >> 4) * 3) + beat) % 6, x = fl[i][0], y = fl[i][1];
        ctx.fillStyle = cols[c]; ctx.globalAlpha = ((i + beat) % 3 === 0) ? 0.95 : 0.45; ctx.fillRect(x + 1, y + 1, 18, 8);
      }
      ctx.globalAlpha = 1;
      var bl = st.bulbs, ph = Math.floor(t * 8);
      for (i = 0; i < bl.length; i++) { ctx.fillStyle = ((i >> 1) + ph) % 4 === 0 ? '#fcfcfc' : '#a88038'; ctx.fillRect(bl[i][0], bl[i][1], 1, 1); }
      // disco ball sparkles sweeping the walls
      for (i = 0; i < 18; i++) {
        var a = i * 0.7 + t * 0.9, rr = 40 + (i * 37) % 120, sx = 160 + Math.cos(a) * rr * 1.4, sy = 10 + Math.abs(Math.sin(a)) * rr * 0.8;
        if (sx < 0 || sx > 320 || sy > 178) continue;
        ctx.fillStyle = i % 3 ? '#fcfcfc' : '#f8b8f8'; ctx.fillRect(Math.round(sx), Math.round(sy), 1, 1); if (i % 4 === 0) { ctx.fillRect(Math.round(sx) - 1, Math.round(sy), 3, 1); ctx.fillRect(Math.round(sx), Math.round(sy) - 1, 1, 3); }
      }
      // rain on the window
      ctx.fillStyle = '#3c3c6c';
      for (i = 0; i < 30; i++) { var rx = 94 + ((i * 47) % 132), ry = 16 + ((i * 13 + t * 90) % 70); ctx.fillRect(rx, Math.round(ry), 1, 3); }
      // neon flicker
      if (Math.sin(t * 9.1) > 0.94) { ctx.fillStyle = '#14081c'; ctx.fillRect(140, 96, 40, 10); }
    }
  };
  /* ---- Danger Zone with Ripper Wonton: the talk show set ---- */
  BD.studio = {
    draw: function (g, night, st) {
      bands(g, 320, 0, 130, ['#04041c', '#06062a', '#0a0a38', '#100c44', '#180e4c', '#22104c']);
      // painted backdrop: sunset skyline, a jet streaking past (Top Gun, obviously)
      R(g, 20, 20, 280, 84, '#000000');
      var cols = ['#2c0c4c', '#5c0c5c', '#8c1c4c', '#c83c3c', '#f8783c', '#f8b860'];
      for (var y = 0; y < 82; y++) R(g, 21, 21 + y, 278, 1, cols[Math.min(5, Math.floor(y / 82 * 6))]);
      blob(g, 160, 92, 22, 22, '#f8d878'); for (y = 82; y < 104; y += 3) R(g, 138, y, 46, 1, '#f8783c');
      var r = rng(4), x = 21;
      while (x < 299) { var bw = 8 + ((r() * 14) | 0), bh = 8 + ((r() * 30) | 0); R(g, x, 103 - bh, Math.min(bw, 299 - x), bh, '#1c0c2c'); x += bw + 1; }
      rows(g, 230, 36, ['....k......', 'kkkkkkkkk..', '.kkkkkkkkkk', '...kk......'], { k: '#1c0c2c' }); for (x = 160; x < 229; x += 2) P(g, x, 38, '#fce0a8');
      // DANGER ZONE neon logo
      R(g, 92, 6, 136, 26, '#000000'); R(g, 93, 7, 134, 24, '#0c0418');
      withText(g, function () { DCW.text('DANGER ZONE', 161, 12, '#7c0c3c', { align: 'center', scale: 2, shadow: null }); DCW.text('DANGER ZONE', 160, 11, '#f85898', { align: 'center', scale: 2, shadow: null }); });
      rows(g, 98, 9, ['..yy', '.yy.', 'yyyy', '..y.', '.y..'], { y: '#f8d878' }); rows(g, 216, 9, ['..yy', '.yy.', 'yyyy', '..y.', '.y..'], { y: '#f8d878' });
      // light rig
      R(g, 0, 0, 320, 4, '#1c1c24'); for (x = 12; x < 320; x += 36) { R(g, x, 4, 8, 6, '#2c2c34'); R(g, x + 1, 10, 6, 2, '#5c5c6c'); st.lamps.push([x + 4, 12]); }
      // marquee bulbs frame the backdrop
      for (x = 20; x < 300; x += 6) { st.bulbs.push([x, 18]); st.bulbs.push([x, 105]); }
      for (y = 22; y < 104; y += 6) { st.bulbs.push([18, y]); st.bulbs.push([301, y]); }
      // glossy stage floor
      R(g, 0, 110, 320, 70, '#14102c'); for (y = 112; y < 180; y += 6) R(g, 0, y, 320, 1, '#1c1838'); R(g, 0, 110, 320, 2, '#f85898'); R(g, 0, 112, 320, 1, '#7c0c3c');
      for (x = 0; x < 320; x += 40) line(g, 160 + (x - 160) * 0.3, 113, x, 180, '#1c1838');
      dither(g, 120, 114, 80, 20, '#3c2c5c', 4);
    },
    anim: function (ctx, t, night, st) {
      var bl = st.bulbs, ph = Math.floor(t * 10);
      for (var i = 0; i < bl.length; i++) { ctx.fillStyle = (i + ph) % 3 === 0 ? '#fcfcfc' : '#a88038'; ctx.fillRect(bl[i][0], bl[i][1], 1, 1); }
      var cols = ['#f85898', '#3cbcfc', '#f8d878'];
      for (i = 0; i < st.lamps.length; i++) {
        var L = st.lamps[i], sw = Math.sin(t * 0.8 + i * 1.1) * 40;
        ctx.globalAlpha = 0.05; ctx.fillStyle = cols[i % 3];
        ctx.beginPath(); ctx.moveTo(L[0] - 2, L[1]); ctx.lineTo(L[0] + 2, L[1]); ctx.lineTo(L[0] + sw + 20, 160); ctx.lineTo(L[0] + sw - 20, 160); ctx.closePath(); ctx.fill();
        ctx.globalAlpha = 1; ctx.fillStyle = cols[i % 3]; ctx.fillRect(L[0] - 1, L[1] - 1, 3, 1);
      }
      if (Math.sin(t * 7.7) > 0.95) { ctx.fillStyle = '#0c0418'; ctx.fillRect(100, 10, 120, 18); }
    }
  };
  /* ---- Odette's green room (Dungeon Crawler After Hours) ---- */
  BD.greenroom = {
    draw: function (g, night, st) {
      R(g, 0, 0, 320, 180, '#1c3c2c');
      for (var x = 0; x < 320; x += 12) { R(g, x, 0, 6, 140, '#234634'); for (var y = 6; y < 140; y += 16) { P(g, x + 3, y, '#3c6c4c'); P(g, x + 2, y + 1, '#3c6c4c'); P(g, x + 4, y + 1, '#3c6c4c'); P(g, x + 3, y + 2, '#3c6c4c'); } }
      R(g, 0, 120, 320, 20, '#3c2414'); R(g, 0, 120, 320, 2, '#5c3c20');
      // makeup mirror ringed with bulbs
      R(g, 30, 24, 80, 60, '#a88038'); R(g, 34, 28, 72, 52, '#2c4c5c'); line(g, 40, 70, 60, 34, '#5c8c9c'); line(g, 70, 76, 92, 40, '#5c8c9c');
      for (x = 32; x < 110; x += 8) { st.bulbs.push([x, 25]); st.bulbs.push([x, 82]); } for (y = 32; y < 80; y += 8) { st.bulbs.push([31, y]); st.bulbs.push([108, y]); }
      R(g, 26, 86, 90, 6, '#5c3c20'); R(g, 26, 86, 90, 1, '#7c5430'); R(g, 40, 82, 6, 4, '#c83c6c'); R(g, 54, 80, 4, 6, '#a8a8a8'); R(g, 90, 81, 8, 5, '#f8b8f8');
      // monitor: tonight's leaderboard draft
      R(g, 140, 20, 72, 50, '#000000'); R(g, 142, 22, 68, 46, '#0a1c2c');
      for (var i = 0; i < 6; i++) { R(g, 146, 26 + i * 7, 6, 5, '#58d854'); R(g, 154, 26 + i * 7, 10 + ((i * 17) % 40), 5, i === 5 ? '#f8b800' : i === 4 ? '#f878f8' : '#3c7cbc'); }
      R(g, 172, 70, 8, 8, '#1c1c1c');
      // couch
      R(g, 210, 108, 100, 40, '#5c2c6c'); R(g, 206, 100, 12, 48, '#4c2058'); R(g, 302, 100, 12, 48, '#4c2058'); R(g, 216, 96, 88, 16, '#6c3c7c'); R(g, 214, 120, 92, 4, '#7c4c8c');
      for (x = 228; x < 300; x += 24) R(g, x, 112, 1, 10, '#4c2058');
      // potted fern
      R(g, 124, 120, 16, 20, '#7c3c1c'); R(g, 122, 118, 20, 4, '#9c5028');
      for (i = 0; i < 9; i++) { var a = -2.6 + i * 0.65; line(g, 132, 118, 132 + Math.round(Math.cos(a) * 18), 118 + Math.round(Math.sin(a) * 16) - 4, '#3c8c3c'); }
      // costume rack + poster
      R(g, 252, 20, 50, 2, '#7c7c7c'); R(g, 252, 20, 2, 76, '#7c7c7c'); R(g, 300, 20, 2, 76, '#7c7c7c'); R(g, 262, 22, 16, 40, '#c8a030'); R(g, 282, 22, 14, 34, '#2c5c9c'); tri(g, 270, 22, 12, 6, '#a88028');
      R(g, 222, 30, 22, 30, '#c83c3c'); R(g, 224, 32, 18, 26, '#2c1c3c'); disc(g, 233, 42, 5, '#f8d878');
      // floor + rug
      R(g, 0, 140, 320, 40, '#2c1c14'); for (y = 144; y < 180; y += 6) R(g, 0, y, 320, 1, '#24160e');
      R(g, 60, 150, 200, 22, '#6c1c2c'); R(g, 64, 153, 192, 16, '#8c2c3c'); for (x = 70; x < 252; x += 12) R(g, x, 158, 6, 6, '#c8a030');
    },
    anim: function (ctx, t, night, st) {
      for (var i = 0; i < st.bulbs.length; i++) { var b = st.bulbs[i]; ctx.fillStyle = (Math.sin(t * 3 + i) > 0.92) ? '#c8a050' : '#fcf4d0'; ctx.fillRect(b[0], b[1], 2, 2); }
      ctx.globalAlpha = 0.05; ctx.fillStyle = '#fcf4d0'; ctx.fillRect(24, 18, 92, 72); ctx.globalAlpha = 1;
    }
  };
  /* ---- the game guide's room: golden-brick hallway, fake starry ceiling, red carpet to a door ---- */
  function guideHall(g, w, h, st) {
    var vx = w / 2, vy = h * 0.46, fw = w * 0.2, fh = h * 0.4;
    var fx0 = Math.round(vx - fw / 2), fx1 = Math.round(vx + fw / 2), fy0 = Math.round(vy - fh / 2), fy1 = Math.round(vy + fh / 2);
    function lerp(a, b, t) { return a + (b - a) * t; }
    // ceiling (fake night sky) and floor
    for (var y = 0; y < fy0; y++) { var t0 = y / fy0, xl = Math.round(lerp(0, fx0, t0)), xr = Math.round(lerp(w, fx1, t0)); R(g, xl, y, xr - xl, 1, y < fy0 * 0.5 ? '#06061c' : '#0a0a26'); }
    var r = rng(9);
    for (var i = 0; i < w * 0.5; i++) { var sx = (r() * w) | 0, sy = (r() * fy0) | 0, tt = sy / fy0; if (sx > lerp(0, fx0, tt) + 1 && sx < lerp(w, fx1, tt) - 1) { P(g, sx, sy, r() < 0.3 ? '#fcfcfc' : '#9c9cd0'); if (st && r() < 0.15) st.misc.push([sx, sy]); } }
    for (y = fy1; y < h; y++) { var t1 = (h - y) / (h - fy1), xl2 = Math.round(lerp(0, fx0, t1)), xr2 = Math.round(lerp(w, fx1, t1)); R(g, xl2, y, xr2 - xl2, 1, ((y - fy1) >> 2) & 1 ? '#2c1c14' : '#342018'); }
    // golden brick walls in perspective
    function wall(side) {
      var x0 = side < 0 ? 0 : fx1, x1 = side < 0 ? fx0 : w, N = 9, zPrev = -1;
      function zAt(x) { var d = side < 0 ? x / fx0 : (w - x) / (w - fx1); return 1 / (1 - d * (1 - fw / w)); }
      for (var x = x0; x < x1; x++) {
        var d = side < 0 ? x / fx0 : (w - x) / (w - fx1); // 0 = near edge, 1 = far
        var top = Math.round(lerp(0, fy0, d)), bot = Math.round(lerp(h, fy1, d)), z = zAt(x), zn = zAt(x + 1);
        R(g, x, top, 1, bot - top, '#a07424');
        for (var k = 0; k <= N; k++) P(g, x, Math.round(top + (bot - top) * k / N), '#5c3c10');
        for (k = 0; k < N; k++) {
          var off = (k & 1) * 0.5, y0k = Math.round(top + (bot - top) * k / N), y1k = Math.round(top + (bot - top) * (k + 1) / N);
          if (Math.floor(z * 3 + off) !== Math.floor(zn * 3 + off)) R(g, x, y0k, 1, Math.max(1, y1k - y0k), '#5c3c10');
          else if (y1k - y0k > 3) P(g, x, y0k + 1, '#b88c34');
        }
        if (d > 0.5) { g.fillStyle = '#000000'; for (var yy = top; yy < bot; yy++) if (dith(x, yy, Math.round((d - 0.5) * 20))) g.fillRect(x, yy, 1, 1); }
      }
    }
    wall(-1); wall(1);
    // far wall + the door, light leaking around it
    R(g, fx0, fy0, fx1 - fx0, fy1 - fy0, '#6c4c18');
    var dw = Math.round(fw * 0.45), dh = Math.round(fh * 0.75), dx = Math.round(vx - dw / 2), dy = fy1 - dh;
    R(g, dx - 2, dy - 2, dw + 4, dh + 2, '#f8e8b0'); R(g, dx, dy, dw, dh, '#5c2c10'); R(g, dx + 1, dy + 1, dw - 2, 1, '#7c4018'); P(g, dx + dw - 3, dy + (dh >> 1), '#f8b800');
    if (st) st.lamps.push([dx - 2, dy - 2, dw + 4, dh + 2]);
    // red carpet from the viewer to the door, gold trim
    for (y = fy1; y < h; y++) {
      var t2 = (y - fy1) / (h - fy1), half = lerp(dw / 2 + 1, w * 0.24, t2);
      R(g, Math.round(vx - half), y, Math.round(half * 2), 1, '#a01020');
      P(g, Math.round(vx - half), y, '#c89c40'); P(g, Math.round(vx + half) - 1, y, '#c89c40');
      if (((y - fy1) % 6) === 0) R(g, Math.round(vx - half) + 2, y, Math.round(half * 2) - 4, 1, '#880c18');
    }
    // sconces on the walls
    var sc = [0.25, 0.55];
    for (i = 0; i < sc.length; i++) for (var sd = -1; sd <= 1; sd += 2) {
      var d2 = sc[i], xs = sd < 0 ? Math.round(fx0 * d2) : Math.round(w - (w - fx1) * d2), ys = Math.round(lerp(h * 0.42, vy - fh * 0.05, d2));
      R(g, xs - 1, ys, 3, 4, '#5c3c10'); if (st) st.flames.push([xs, ys - 1]);
    }
  }
  BD.guide_room = {
    draw: function (g, night, st) { guideHall(g, 320, 180, st); },
    anim: function (ctx, t, night, st) {
      for (var i = 0; i < st.misc.length; i++) if (Math.sin(t * 3 + i * 2.3) > 0.8) { ctx.fillStyle = '#fcfcfc'; var s = st.misc[i]; ctx.fillRect(s[0] - 1, s[1], 3, 1); ctx.fillRect(s[0], s[1] - 1, 1, 3); }
      var d = st.lamps[0]; if (d) { ctx.globalAlpha = 0.08 + Math.sin(t * 2) * 0.04; ctx.fillStyle = '#f8e8b0'; ctx.fillRect(d[0] - 6, d[1] - 6, d[2] + 12, d[3] + 8); ctx.globalAlpha = 1; }
      flames(ctx, { ox: [0], oy: [0], t: t }, st.flames, 0, 99999, true);
    }
  };

  /* =====================================================================
     CUTSCENE PANELS (256x112): late-NES cinema scenes. Static art is cached
     per id; anim(ctx, t, st) draws the moving bits in panel coordinates.
     ===================================================================== */
  var PW_ = 256, PH_ = 112, PN = {}, pnCache = {};
  function panelCanvas(id) {
    var c = pnCache[id];
    if (c) return c;
    var p = PN[id], cv = mkCanvas(p.w || PW_, p.h || PH_), st = newState();
    try { p.draw(g2(cv), st, cv.width, cv.height); } catch (e) { if (window.console) console.error('art panel failed: ' + id, e); }
    var fg = null;
    if (p.fg) { fg = mkCanvas(cv.width, cv.height); try { p.fg(g2(fg), st); } catch (e2) { if (window.console) console.error('art panel fg failed: ' + id, e2); } }
    c = pnCache[id] = { cv: cv, st: st, fg: fg };
    return c;
  }
  art.hasPanel = function (id) { return !!PN[id]; };
  art.panelSize = function (id) { var p = PN[id]; return { w: (p && p.w) || PW_, h: (p && p.h) || PH_ }; };
  art.panel = function (ctx, id, x, y, t) {
    x = Math.round(x || 0); y = Math.round(y || 0); t = t === undefined ? (DCW.t || 0) : t;
    var p = PN[id];
    if (!p) { ctx.fillStyle = '#000000'; ctx.fillRect(x, y, PW_, PH_); ctx.fillStyle = '#202040'; ctx.fillRect(x + 2, y + 2, PW_ - 4, PH_ - 4); return; }
    var c = panelCanvas(id);
    ctx.drawImage(c.cv, x, y);
    if (p.anim) {
      ctx.save(); ctx.beginPath(); ctx.rect(x, y, c.cv.width, c.cv.height); ctx.clip(); ctx.translate(x, y);
      try { p.anim(ctx, t, c.st); } catch (e) { if (window.console) console.error('art panel anim failed: ' + id, e); p.anim = null; }
      ctx.restore();
    }
    if (c.fg) ctx.drawImage(c.fg, x, y);
  };
  // crop of a full sky (day: crimson + red sun, night: nebula) into the panel
  function pSky(g, night, o) {
    var tmp = mkCanvas(320, BGH), tg = g2(tmp);
    if (night) skyNight(tg, o); else skyDay(tg, o);
    g.drawImage(tmp, o.ox === undefined ? 32 : o.ox, o.oy || 0, PW_, PH_, 0, 0, PW_, PH_);
  }
  function pBackdrop(g, id, ox, oy, night) { var c = backdropCanvas(id, !!night); g.drawImage(c.cv, ox, oy, PW_, PH_, 0, 0, PW_, PH_); }
  function pBackdropAnim(ctx, id, ox, oy, t, night) { var c = backdropCanvas(id, !!night); ctx.save(); ctx.translate(-ox, -oy); BD[id].anim(ctx, t, night, c.st); ctx.restore(); }
  function vignette(g, w, h, c) { dither(g, 0, 0, w, 6, c, 8); dither(g, 0, h - 6, w, 6, c, 8); dither(g, 0, 0, 8, h, c, 6); dither(g, w - 8, 0, 8, h, c, 6); }

  /* ---- silhouette figures (one colour, strong shapes) ---- */
  function fig(g, kind, x, y, c, o) { // x = centre, y = feet
    o = o || {};
    var hi = o.hi;
    if (kind === 'carl_back') { // Carl from behind: cloak, bare legs, Donut on his shoulder
      R(g, x - 3, y - 12, 2, 12, c); R(g, x + 1, y - 12, 2, 12, c);
      tri(g, x, y - 30, 16, 20, c); R(g, x - 6, y - 26, 12, 14, c);
      blob(g, x, y - 32, 3, 4, c); R(g, x - 1, y - 28, 2, 2, c);
      R(g, x - 8, y - 24, 2, 9, c); R(g, x + 6, y - 24, 3, 9, c);
      blob(g, x + 5, y - 30, 3, 2, c); R(g, x + 3, y - 35, 1, 2, c); R(g, x + 7, y - 35, 1, 2, c); R(g, x + 4, y - 33, 4, 2, c); line(g, x + 2, y - 29, x - 1, y - 24, c);
      if (hi) { R(g, x + 9, y - 24, 1, 8, hi); P(g, x + 3, y - 34, hi); P(g, x + 6, y - 35, hi); }
    } else if (kind === 'carl_run') { // running right, cloak streaming, Donut on the shoulder
      var f = o.f || 0;
      blob(g, x + 1, y - 26, 3, 3, c); R(g, x - 2, y - 22, 6, 9, c); tri(g, x - 6, y - 22, 6, 10, c);
      line(g, x - 2, y - 21, x - 9, y - 16, c); line(g, x - 2, y - 20, x - 10, y - 14, c);
      line(g, x + 3, y - 20, x + 7, y - 15 + f, c);
      line(g, x, y - 13, x - 4 + f * 2, y, c); line(g, x + 1, y - 13, x - 3 + f * 2, y, c); line(g, x + 2, y - 13, x + 6 - f * 2, y - 1, c); line(g, x + 3, y - 13, x + 7 - f * 2, y - 1, c);
      blob(g, x - 1, y - 30, 2, 2, c); R(g, x - 2, y - 33, 1, 2, c); R(g, x + 1, y - 33, 1, 2, c);
    } else if (kind === 'mongo') { // velociraptor, small or big
      var s = o.big ? 2 : 1;
      R(g, x - 4 * s, y - 9 * s, 9 * s, 4 * s, c); R(g, x + 3 * s, y - 13 * s, 3 * s, 5 * s, c); R(g, x + 4 * s, y - 14 * s, 5 * s, 3 * s, c);
      line(g, x - 4 * s, y - 8 * s, x - 10 * s, y - 10 * s, c); line(g, x - 4 * s, y - 7 * s, x - 10 * s, y - 9 * s, c);
      line(g, x - 1 * s, y - 5 * s, x - 3 * s, y, c); line(g, x + 2 * s, y - 5 * s, x + 4 * s, y, c);
      if (s > 1) { R(g, x - 2, y - 5 * s, 2, 5 * s, c); R(g, x + 4, y - 5 * s, 2, 5 * s, c); }
    } else if (kind === 'katia_run') {
      blob(g, x + 1, y - 22, 3, 3, c); R(g, x - 2, y - 19, 6, 8, c); R(g, x - 3, y - 25, 6, 3, c);
      line(g, x, y - 11, x - 4, y, c); line(g, x + 2, y - 11, x + 6, y, c); line(g, x + 3, y - 18, x + 7, y - 14, c); line(g, x - 2, y - 18, x - 5, y - 13, c);
    } else if (kind === 'bautista_run') { // tiger man, curved sword
      blob(g, x + 1, y - 28, 3, 3, c); P(g, x - 1, y - 32, c); P(g, x + 3, y - 32, c); R(g, x - 3, y - 25, 7, 11, c);
      line(g, x - 1, y - 14, x - 5, y, c); line(g, x + 2, y - 14, x + 6, y, c); line(g, x - 3, y - 16, x - 9, y - 12, c);
      line(g, x + 4, y - 23, x + 10, y - 28, c); for (var i = 0; i < 8; i++) P(g, x + 10 + i, y - 29 - Math.round(i * i / 12), c);
    } else if (kind === 'signet') { // very thin, horns, long limbs
      blob(g, x, y - 34, 2, 3, c); P(g, x - 2, y - 38, c); P(g, x + 2, y - 38, c); P(g, x - 3, y - 39, c); P(g, x + 3, y - 39, c); P(g, x - 3, y - 34, c); P(g, x + 3, y - 34, c);
      R(g, x - 2, y - 30, 4, 12, c); R(g, x - 1, y - 18, 1, 18, c); R(g, x + 1, y - 18, 1, 18, c);
      line(g, x - 2, y - 29, x - 5, y - 18, c); line(g, x + 2, y - 29, x + (o.reach ? 8 : 5), y - (o.reach ? 36 : 18), c);
    } else if (kind === 'crowd') { // a row of club-goers / audience heads
      var r = rng(o.seed || 1);
      for (var cx = x; cx < x + (o.w || 100); cx += 5 + ((r() * 4) | 0)) { var hh = 8 + ((r() * 8) | 0); R(g, cx - 2, y - hh, 5, hh, c); blob(g, cx, y - hh - 2, 2, 2, c); if (o.arms && r() < 0.4) line(g, cx + 2, y - hh, cx + 4, y - hh - 6, c); }
    }
  }
  function sparks(ctx, t, x, y, n, col, spread) {
    ctx.fillStyle = col;
    for (var i = 0; i < n; i++) { var p = (t * 1.7 + i * 0.37) % 1, a = (i * 2.4) % 6.28; ctx.fillRect(Math.round(x + Math.cos(a) * p * spread), Math.round(y - Math.abs(Math.sin(a)) * p * spread * 0.6 + p * p * 10), 1, 1); }
  }
  function panelFlame(ctx, x, y, w, h, t, seed) {
    for (var i = 0; i < w; i += 2) {
      var edge = 1 - Math.abs(i - w / 2) / (w / 2 + 2);
      var hh = Math.round(h * edge * (0.45 + 0.35 * Math.abs(Math.sin(t * 7 + i * 1.7 + seed)) + 0.3 * Math.abs(Math.sin(t * 13 + i * 0.6))));
      ctx.fillStyle = '#c83810'; ctx.fillRect(x + i, y - hh, 2, hh);
      ctx.fillStyle = '#f8a040'; ctx.fillRect(x + i, y - Math.round(hh * 0.6), 1, Math.round(hh * 0.6));
      ctx.fillStyle = '#f8d878'; ctx.fillRect(x + i, y - Math.round(hh * 0.25), 1, Math.round(hh * 0.25));
    }
  }

  /* 1. guide_room: the golden hallway, the party walking the red carpet to the guide's door */
  PN.guide_room = {
    draw: function (g, st) {
      guideHall(g, PW_, PH_, st);
      fig(g, 'carl_back', 128, 108, '#0c0408', { hi: '#5c2c18' });
    },
    anim: function (ctx, t, st) { BD.guide_room.anim(ctx, t, false, st); }
  };
  /* 2. arrival: out of the stairwell door into a village under the red sun */
  PN.arrival = {
    draw: function (g, st) {
      pSky(g, false, { hz: 96, sun: { x: 180, y: 46, r: 24 }, seed: 5, ox: 32 });
      skyline(g, PW_, 80, 7, { minW: 8, maxW: 18, minH: 6, maxH: 28, col: '#5c1a1c', gap: 10, broken: true });
      R(g, 0, 80, PW_, 40, '#5c1a1c');
      var r = rng(12);
      roofline(g, PW_, 92, {}, r, false, { col: '#3c1214', minW: 14, maxW: 24, minH: 6, maxH: 12 });
      for (var x = 40; x < 220; x += 34) st.chim.push([x + ((r() * 10) | 0), 72 + ((r() * 8) | 0)]);
      // the wooden-slat street running to the horizon
      for (var y = 92; y < PH_; y++) { var f = (y - 92) / 20; R(g, 0, y, PW_, 1, (y & 1) ? '#4c2c14' : '#5c3418'); }
      for (var k = -12; k <= 12; k++) line(g, 128 + k * 4, 92, 128 + k * 40, PH_, '#24100a');
      // dark doorway frame we are looking out of
      R(g, 0, 0, 40, PH_, '#0c0404'); R(g, 216, 0, 40, PH_, '#0c0404'); R(g, 0, 0, PW_, 8, '#0c0404'); R(g, 40, 8, 4, PH_, '#24100a'); R(g, 212, 8, 4, PH_, '#24100a'); R(g, 40, 8, 176, 3, '#24100a');
      fig(g, 'carl_back', 120, 110, '#080204', { hi: '#a83018' });
      fig(g, 'mongo', 150, 110, '#080204');
    },
    anim: function (ctx, t, st) {
      ctx.save(); ctx.beginPath(); ctx.rect(44, 11, 168, 101); ctx.clip();
      for (var i = 0; i < st.chim.length; i++) { var c = st.chim[i]; for (var k = 0; k < 3; k++) { var p = (t * 0.25 + k / 3 + i * 0.21) % 1; ctx.globalAlpha = 0.4 * (1 - p); ctx.fillStyle = '#8c7c70'; ctx.fillRect(Math.round(c[0] + p * 8), Math.round(c[1] - p * 30), 2 + Math.round(p * 3), 2 + Math.round(p * 2)); } }
      ctx.globalAlpha = 1;
      embers(ctx, { t: t, camX: 0 }, '#f8a040', 8, 4);
      ctx.restore();
    }
  };
  /* 3. circus_night: Grimaldi's circus under the nebula */
  PN.circus_night = {
    draw: function (g, st) {
      pSky(g, true, { hz: 110, seed: 31, nebY: 30, slope: 0.18, ox: 40 });
      var Q = BG2.circus.pal.n;
      skyline(g, PW_, 92, 41, { minW: 8, maxW: 18, minH: 8, maxH: 30, col: Q.far, gap: 18, broken: true });
      bigTop(g, 48, 110, 34, 98, '#4c1028', '#3c3c5c', Q, st);
      bigTop(g, 196, 120, 30, 98, '#2c1848', '#5c4c28', Q, st);
      bigTop(g, 124, 150, 14, 100, '#5c1424', '#4c4864', Q, st);
      stringLights(g, 48, 34, 124, 14, Q, st); stringLights(g, 124, 14, 196, 30, Q, st);
      R(g, 0, 98, PW_, 14, '#06060e');
      cageWagon(g, 10, 106, Q); giraffe(g, 200, 104, Q, 1); giraffe(g, 226, 104, Q, 0);
      for (var x = 0; x < PW_; x += 6) { R(g, x, 100, 1, 12, '#020206'); } R(g, 0, 102, PW_, 1, '#020206'); R(g, 0, 107, PW_, 1, '#020206');
    },
    anim: function (ctx, t, st) {
      bulbs(ctx, { ox: [0, 0], oy: [0, 0], t: t }, st.bulbs, 0, 99999, true);
      for (var s = 0; s < 2; s++) { var ang = Math.sin(t * 0.6 + s * 2) * 0.5, bx = s ? 196 : 48; ctx.globalAlpha = 0.07; ctx.fillStyle = '#d8d0f8'; ctx.beginPath(); ctx.moveTo(bx, 90); ctx.lineTo(bx + Math.sin(ang - 0.1) * 140, -10); ctx.lineTo(bx + Math.sin(ang + 0.1) * 140, -10); ctx.closePath(); ctx.fill(); ctx.globalAlpha = 1; }
    }
  };
  /* 4. signet_tattoos: Tsarina Signet, the ink moving on her skin */
  PN.signet_tattoos = {
    draw: function (g, st) {
      bands(g, PW_, 0, PH_, ['#020c14', '#04121c', '#061824', '#08202c', '#0a2430']);
      noiseCloud(g, 0, 0, PW_, PH_, 13, ['#0c2c38', '#123c48'], function (x, y) { return 0.55 + 0.35 * Math.sin(x / 19 + y / 13); }, 0.7);
      var skin = '#9cc8c0', sk2 = '#7ca8a4', skL = '#c8ece4', ink = '#1c3c4c';
      // shoulders and arms (cropped at the collarbone), long neck, narrow face
      var mask = mkCanvas(PW_, PH_), mg = g2(mask);
      [g, mg].forEach(function (q) {
        blob(q, 128, 106, 62, 16, skin); R(q, 66, 100, 124, 12, skin); R(q, 120, 62, 16, 36, skin);
        blob(q, 128, 44, 15, 21, skin); tri(q, 128, 58, 22, 9, skin, true);
        tri(q, 106, 36, 1, 1, skin); line(q, 113, 40, 100, 30, skin); line(q, 113, 41, 100, 31, skin); line(q, 113, 42, 102, 33, skin);
        line(q, 143, 40, 156, 30, skin); line(q, 143, 41, 156, 31, skin); line(q, 143, 42, 154, 33, skin);
      });
      st.misc.push(mask);
      R(g, 119, 62, 2, 30, sk2); R(g, 136, 62, 1, 30, sk2); blob(g, 122, 38, 4, 6, skL);
      // hair swept back, small horns, the face
      blob(g, 128, 27, 15, 9, '#0c1018'); R(g, 113, 26, 4, 22, '#0c1018'); R(g, 139, 26, 4, 22, '#0c1018');
      line(g, 121, 22, 117, 13, '#e8e0c8'); line(g, 122, 22, 118, 13, '#c8c0a8'); line(g, 134, 22, 138, 13, '#e8e0c8'); line(g, 135, 22, 139, 13, '#c8c0a8');
      R(g, 120, 40, 6, 2, '#0c1018'); R(g, 130, 40, 6, 2, '#0c1018'); st.lamps.push([121, 40], [131, 40]);
      R(g, 127, 44, 2, 6, sk2); R(g, 123, 54, 10, 1, '#3c1c24'); P(g, 124, 55, '#fcfcfc'); P(g, 131, 55, '#fcfcfc');
      R(g, 112, 66, 1, 1, ink);
    },
    anim: function (ctx, t, st) {
      // tattoos: sharks, a dragon, an oni mask, a sea serpent, swimming over the skin
      var mask = st.misc[0], tmp = PN.signet_tattoos._tmp || (PN.signet_tattoos._tmp = mkCanvas(PW_, PH_)), tg = g2(tmp);
      tg.globalCompositeOperation = 'source-over'; tg.clearRect(0, 0, PW_, PH_);
      var ink = '#0c2430', red = '#7c1c2c', wh = '#e8fcfc';
      function shark(x, y, d) { x = Math.round(x); R(tg, x, y, 12, 4, ink); R(tg, x + 2, y + 4, 8, 1, ink); tri(tg, x + (d > 0 ? 5 : 7), y - 4, 4, 4, ink); if (d > 0) { R(tg, x - 4, y - 1, 4, 2, ink); R(tg, x - 4, y + 3, 4, 2, ink); P(tg, x + 9, y + 1, wh); R(tg, x + 8, y + 3, 3, 1, wh); } else { R(tg, x + 12, y - 1, 4, 2, ink); R(tg, x + 12, y + 3, 4, 2, ink); P(tg, x + 2, y + 1, wh); R(tg, x + 1, y + 3, 3, 1, wh); } }
      shark(((t * 14) % 170) + 44, 97, 1); shark(250 - ((t * 11 + 60) % 190), 104, -1);
      for (var i = 0; i < 18; i++) { var a = t * 1.1 - i * 0.16, dx = 128 + Math.cos(a) * 50, dy = 101 + Math.sin(a * 2) * 6; tg.fillStyle = i === 0 ? red : ink; tg.fillRect(Math.round(dx), Math.round(dy), i === 0 ? 5 : 4, i === 0 ? 4 : 3); if (i === 0) { tg.fillStyle = wh; tg.fillRect(Math.round(dx) + 3, Math.round(dy) + 1, 1, 1); } if (i % 3 === 1) { tg.fillStyle = red; tg.fillRect(Math.round(dx) + 1, Math.round(dy) - 1, 2, 1); } }
      var ox = Math.round(86 + ((t * 9) % 90)), oy = 92;
      R(tg, ox, oy, 9, 8, red); R(tg, ox + 1, oy + 2, 2, 2, wh); R(tg, ox + 6, oy + 2, 2, 2, wh); R(tg, ox + 2, oy + 6, 5, 1, wh); P(tg, ox, oy - 2, red); P(tg, ox + 8, oy - 2, red); P(tg, ox, oy - 1, red); P(tg, ox + 8, oy - 1, red);
      for (i = 0; i < 9; i++) { var py = 70 + ((t * 8 + i * 4) % 34); tg.fillStyle = ink; tg.fillRect(i & 1 ? 123 : 131, Math.round(py), 2, 2); }
      tg.globalCompositeOperation = 'destination-in'; tg.drawImage(mask, 0, 0); tg.globalCompositeOperation = 'source-over';
      ctx.drawImage(tmp, 0, 0);
      var gl = 0.6 + Math.sin(t * 3) * 0.4;
      for (i = 0; i < st.lamps.length; i++) { var e = st.lamps[i]; ctx.fillStyle = '#e8fcfc'; ctx.fillRect(e[0], e[1], 5, 2); ctx.globalAlpha = 0.25 * gl; ctx.fillStyle = '#58f8f8'; ctx.fillRect(e[0] - 3, e[1] - 2, 11, 6); ctx.globalAlpha = 1; }
    }
  };
  /* 5. heather_skates: Heather the Bear charging on roller skates */
  PN.heather_skates = {
    draw: function (g, st) {
      pSky(g, false, { hz: 70, seed: 9, ox: 40, d: { cols: ['#1c0408', '#30060c', '#480a10', '#601014', '#781a16', '#8c2818'] } });
      skyline(g, PW_, 74, 33, { minW: 10, maxW: 30, minH: 10, maxH: 50, col: '#3c0e10', gap: 4, broken: true });
      R(g, 0, 74, PW_, 40, '#2c0c08');
      for (var k = -14; k <= 14; k++) line(g, 128 + k * 2, 74, 128 + k * 30, PH_, '#1c0604');
      for (var y = 76; y < PH_; y += 4 + ((y - 74) >> 3)) R(g, 0, y, PW_, 1, '#3c1408');
      // the bear: a black mass with a skull face on fire
      var bx = 128, by = 106;
      blob(g, bx, by - 44, 34, 30, '#080404'); blob(g, bx - 34, by - 52, 10, 18, '#080404'); blob(g, bx + 34, by - 52, 10, 18, '#080404');
      blob(g, bx - 40, by - 30, 9, 8, '#080404'); blob(g, bx + 40, by - 30, 9, 8, '#080404');
      for (var c = 0; c < 4; c++) { line(g, bx - 44 + c * 3, by - 24, bx - 46 + c * 3, by - 20, '#e8e0c8'); line(g, bx + 37 + c * 3, by - 24, bx + 39 + c * 3, by - 20, '#e8e0c8'); }
      blob(g, bx, by - 64, 14, 14, '#080404');
      blob(g, bx, by - 62, 9, 10, '#e8e0c8'); R(g, bx - 6, by - 56, 12, 5, '#e8e0c8'); blob(g, bx - 4, by - 64, 3, 3, '#000000'); blob(g, bx + 4, by - 64, 3, 3, '#000000');
      tri(g, bx, by - 59, 3, 3, '#000000'); for (var tt = -5; tt <= 5; tt += 2) R(g, bx + tt, by - 54, 1, 3, '#000000');
      st.misc.push([bx, by - 70]);
      // roller skates in the foreground
      for (var s = -1; s <= 1; s += 2) { var sx = bx + s * 22; R(g, sx - 9, by - 16, 18, 10, '#e8e0d0'); R(g, sx - 9, by - 16, 18, 2, '#fcfcfc'); R(g, sx - 9, by - 8, 20, 3, '#5c5c64'); disc(g, sx - 6, by - 3, 3, '#c81c2c'); disc(g, sx + 6, by - 3, 3, '#c81c2c'); P(g, sx - 6, by - 3, '#f8a0a0'); P(g, sx + 6, by - 3, '#f8a0a0'); st.flags.push([sx, by]); }
    },
    anim: function (ctx, t, st) {
      var h = st.misc[0];
      panelFlame(ctx, h[0] - 16, h[1] + 4, 32, 18, t, 0);
      for (var i = 0; i < st.flags.length; i++) sparks(ctx, t, st.flags[i][0], st.flags[i][1] - 2, 8, '#f8d878', 26);
      ctx.fillStyle = '#e8c8a8'; ctx.globalAlpha = 0.5;
      for (i = 0; i < 10; i++) { var p = (t * 2 + i * 0.13) % 1, a = i * 0.63; ctx.fillRect(Math.round(128 + Math.cos(a) * (40 + p * 120)), Math.round(60 + Math.sin(a) * (20 + p * 60)), 2, 1); }
      ctx.globalAlpha = 1;
    }
  };
  /* 6. bigtop_vine: Grimaldi, a giant vine in the centre ring */
  PN.bigtop_vine = {
    draw: function (g, st) {
      for (var y = 0; y < PH_; y++) for (var x = 0; x < PW_; x++) { var a = Math.atan2(y + 30, x - 128); P(g, x, y, (Math.floor(a * 9) & 1) ? '#3c0c18' : '#2c2420'); }
      dither(g, 0, 0, PW_, PH_, '#000000', 6);
      blob(g, 128, 98, 100, 14, '#5c3c1c'); blob(g, 128, 98, 90, 11, '#8c6430');
      for (var x2 = 30; x2 < 230; x2 += 3) P(g, x2, 98 + ((x2 * 7) % 5) - 2, '#a87c48');
      blob(g, 128, 104, 104, 8, '#c81c2c'); blob(g, 128, 104, 96, 5, '#8c6430');
      // the vine: thick trunk, coiling tendrils, thorns, a maw at the top
      var V = '#1c3c14', VL = '#3c6c24', VD = '#0c1c08';
      for (var k = 0; k < 7; k++) {
        var px = 128, py = 98, ang = -Math.PI / 2 + (k - 3) * 0.42, len = 40 + (k % 3) * 18;
        for (var s = 0; s < len; s++) { px += Math.cos(ang); py += Math.sin(ang); ang += Math.sin(s * 0.12 + k) * 0.05; var wdt = Math.max(1, Math.round((len - s) / 9)); R(g, Math.round(px - wdt / 2), Math.round(py), wdt, 2, V); if (s % 7 === 3) P(g, Math.round(px + wdt), Math.round(py), '#c8c0a0'); P(g, Math.round(px - wdt / 2), Math.round(py), VL); }
        st.misc.push([Math.round(px), Math.round(py)]);
      }
      R(g, 118, 50, 20, 50, V); R(g, 118, 50, 3, 50, VL); R(g, 134, 50, 4, 50, VD);
      blob(g, 128, 44, 16, 12, V); blob(g, 128, 46, 10, 6, '#3c0810'); for (var tth = -8; tth <= 8; tth += 3) { tri(g, 128 + tth, 40, 2, 3, '#e8e0c8', true); tri(g, 128 + tth, 50, 2, 3, '#e8e0c8'); }
      blob(g, 120, 38, 3, 2, VL);
    },
    anim: function (ctx, t, st) {
      var ang = Math.sin(t * 0.5) * 0.4;
      ctx.globalAlpha = 0.08; ctx.fillStyle = '#f8f0c8';
      ctx.beginPath(); ctx.moveTo(128, -10); ctx.lineTo(128 + Math.sin(ang - 0.18) * 150, 112); ctx.lineTo(128 + Math.sin(ang + 0.18) * 150, 112); ctx.closePath(); ctx.fill(); ctx.globalAlpha = 1;
      for (var i = 0; i < st.misc.length; i++) { var m = st.misc[i], sw = Math.round(Math.sin(t * 2 + i) * 3); ctx.fillStyle = '#1c3c14'; ctx.fillRect(m[0] + sw - 1, m[1] - 3, 3, 4); ctx.fillStyle = '#3c6c24'; ctx.fillRect(m[0] + sw, m[1] - 4, 1, 2); }
      ctx.fillStyle = '#e8e0c8';
      for (i = 0; i < 6; i++) { var wx = ((i * 41 + t * (8 + i)) % 200) + 28, wy = 98 + (i % 3) * 3; ctx.fillRect(Math.round(wx), wy, 3, 1); ctx.fillRect(Math.round(wx) + 1, wy - 1 + (Math.floor(t * 6 + i) & 1), 1, 1); }
    }
  };
  /* 7. grimaldi_peace: the cured vine flowers; Signet reaches up to it in the dawn light */
  function figScaled(g, kind, x, y, c, o, sc) {
    var tmp = mkCanvas(64, 64), tg = g2(tmp);
    fig(tg, kind, 32, 63, c, o);
    g.drawImage(tmp, 0, 0, 64, 64, Math.round(x - 32 * sc), Math.round(y - 63 * sc), 64 * sc, 64 * sc);
  }
  PN.grimaldi_peace = {
    draw: function (g, st) {
      for (var y = 0; y < PH_; y++) for (var x = 0; x < PW_; x++) { var a = Math.atan2(y + 40, x - 128); P(g, x, y, (Math.floor(a * 10) & 1) ? '#8c4c44' : '#b08868'); }
      for (y = 0; y < PH_; y++) for (x = 0; x < PW_; x++) { var d = Math.abs(x - 128) / 128; if (dith(x, y, Math.round(d * 14))) P(g, x, y, '#2c1418'); }
      // dawn light through the tent flap at the left
      for (y = 0; y < PH_; y++) { var x0 = Math.round(y * 0.6), x1 = x0 + 46; for (x = x0; x < x1; x++) if (dith(x, y, 5)) P(g, x, y, '#f8e0a8'); }
      blob(g, 128, 106, 120, 10, '#6c4c2c'); blob(g, 128, 106, 110, 7, '#a87c48'); for (x = 20; x < 236; x += 3) P(g, x, 104 + ((x * 7) % 5) - 2, '#c89c60');
      // the vine: an S curve out of the ring, leaves, a big bloom at the top
      function bez(t, a0, a1, a2, a3) { var u = 1 - t; return u * u * u * a0 + 3 * u * u * t * a1 + 3 * u * t * t * a2 + t * t * t * a3; }
      var pts = [176, 106, 214, 40, 84, 76, 128, 26];
      for (var i = 0; i <= 160; i++) {
        var t = i / 160, vx = bez(t, pts[0], pts[2], pts[4], pts[6]), vy = bez(t, pts[1], pts[3], pts[5], pts[7]), wd = Math.round(8 - t * 6);
        blob(g, Math.round(vx), Math.round(vy), Math.max(1, wd >> 1), Math.max(1, wd >> 1), '#2c4c1c');
        P(g, Math.round(vx - (wd >> 1)), Math.round(vy), '#5c8c3c');
        if (i % 22 === 11) { var side = (i / 22) & 1 ? 1 : -1; blob(g, Math.round(vx + side * 7), Math.round(vy - 2), 4, 2, '#3c6c24'); P(g, Math.round(vx + side * 6), Math.round(vy - 3), '#7cac4c'); }
      }
      var fx = pts[6], fy = pts[7];
      for (var k = 0; k < 8; k++) { var an = k * Math.PI / 4; blob(g, Math.round(fx + Math.cos(an) * 8), Math.round(fy + Math.sin(an) * 6), 5, 4, k & 1 ? '#e05898' : '#f888b8'); }
      for (k = 0; k < 8; k++) { var an2 = k * Math.PI / 4 + 0.4; P(g, Math.round(fx + Math.cos(an2) * 11), Math.round(fy + Math.sin(an2) * 8), '#fcc8e0'); }
      disc(g, fx, fy, 4, '#f8b800'); disc(g, fx, fy, 2, '#f8e878');
      st.misc.push([fx, fy]);
      figScaled(g, 'signet', 98, 106, '#1c0c10', { reach: true }, 2);
    },
    anim: function (ctx, t, st) {
      var m = st.misc[0];
      glow(ctx, m[0], m[1], 18, '#fcf0c8', 0.08 + Math.sin(t * 2) * 0.03);
      ctx.fillStyle = '#f8a4c8';
      for (var i = 0; i < 10; i++) { var p = (t * 0.12 + i / 10) % 1; ctx.fillRect(Math.round(m[0] - 30 + i * 7 + Math.sin(t * 1.3 + i) * 8), Math.round(m[1] + 6 + p * 78), 2, 1); }
    }
  };
  /* 8. settlement_view: the Medium Skyfowl Settlement from the road */
  PN.settlement_view = {
    draw: function (g, st) {
      pSky(g, false, { hz: 80, sun: { x: 92, y: 30, r: 20 }, seed: 41, ox: 32 });
      var Q = BG2.settlement.pal.d;
      for (var x = 0; x < PW_; x++) { var y = 60 + Math.round(Math.sin(x / 40) * 3); if (x > 120 && x < 230) y -= 20; R(g, x, y, 1, PH_, Q.cliff); }
      for (x = 128; x < 222; x += 14) { var bh = 6 + ((x * 7) % 12); R(g, x, 40 - bh, 12, bh + 2, Q.far); }
      R(g, 180, 6, 10, 36, Q.far); tri(g, 185, -4, 12, 12, Q.far); R(g, 183, 14, 2, 4, '#24080c');
      var r = rng(5);
      roofline(g, PW_, 84, Q, r, false, { col: Q.mid, minW: 12, maxW: 18, minH: 6, maxH: 14 });
      R(g, 0, 78, PW_, 14, '#4c2c24'); for (x = 0; x < PW_; x += 8) { R(g, x, 74, 6, 4, '#4c2c24'); } R(g, 0, 78, PW_, 1, '#6c4434');
      R(g, 112, 72, 32, 20, '#2c1410'); blob(g, 128, 72, 16, 8, '#2c1410'); R(g, 118, 74, 20, 18, '#0c0404'); blob(g, 128, 74, 10, 5, '#0c0404');
      R(g, 106, 58, 4, 16, '#24544c'); R(g, 146, 58, 4, 16, '#24544c');
      // the road
      for (y = 92; y < PH_; y++) { var hw = 10 + (y - 92) * 3; R(g, 0, y, PW_, 1, '#3c1410'); R(g, 128 - hw, y, hw * 2, 1, (y & 2) ? '#6c4424' : '#7c5028'); }
      fig(g, 'carl_back', 128, 111, '#0c0404'); fig(g, 'mongo', 146, 111, '#0c0404');
    },
    anim: function (ctx, t) { birds(ctx, { t: t, camX: 0 }, '#2c0c10', 4); }
  };
  /* 9. desperado: the Desperado Club's main room */
  PN.desperado = {
    draw: function (g) {
      pBackdrop(g, 'club', 32, 40, false);
    },
    fg: function (g) {
      fig(g, 'crowd', 0, 112, '#0a0410', { w: 256, seed: 3, arms: true });
      // Clarabelle the crocodilian bouncer at the rope
      R(g, 220, 70, 16, 34, '#0a0410'); blob(g, 228, 64, 8, 7, '#0a0410'); R(g, 228, 62, 16, 6, '#0a0410'); for (var i = 0; i < 4; i++) P(g, 231 + i * 3, 68, '#e8e0c8'); P(g, 230, 61, '#f8d878');
      R(g, 200, 92, 1, 20, '#c8a040'); R(g, 200, 92, 20, 1, '#c8102c'); R(g, 200, 93, 20, 1, '#880818');
    },
    anim: function (ctx, t) { pBackdropAnim(ctx, 'club', 32, 40, t, false); }
  };
  /* 10. danger_zone: live from the set of Danger Zone with Ripper Wonton */
  PN.danger_zone = {
    draw: function (g) {
      pBackdrop(g, 'studio', 32, 2, false);
    },
    fg: function (g) {
      // the host desk, Ripper Wonton behind it (four feet tall, fuzzy, orange ascot), the couch
      R(g, 160, 80, 70, 24, '#2c1c4c'); R(g, 160, 80, 70, 3, '#f85898'); R(g, 164, 86, 62, 1, '#4c3c7c');
      blob(g, 194, 66, 11, 11, '#6c4428'); blob(g, 194, 70, 8, 6, '#8c6038'); P(g, 189, 63, '#000000'); P(g, 198, 63, '#000000'); P(g, 190, 63, '#fcfcfc'); P(g, 199, 63, '#fcfcfc');
      blob(g, 186, 56, 3, 3, '#6c4428'); blob(g, 202, 56, 3, 3, '#6c4428'); R(g, 189, 75, 10, 4, '#f87800'); tri(g, 194, 79, 6, 5, '#f87800', true);
      R(g, 30, 84, 80, 20, '#5c1c3c'); R(g, 26, 76, 10, 28, '#4c1430'); R(g, 104, 76, 10, 28, '#4c1430'); R(g, 34, 78, 72, 10, '#6c2c4c');
      fig(g, 'carl_back', 70, 96, '#120818');
      for (var c = 0; c < 2; c++) { var cx = c ? 240 : 6; R(g, cx, 96, 14, 10, '#141418'); R(g, cx + 4, 106, 4, 6, '#141418'); disc(g, cx + (c ? 0 : 14), 101, 3, '#141418'); }
    },
    anim: function (ctx, t) { pBackdropAnim(ctx, 'studio', 32, 2, t, false); }
  };
  /* 11. trailer_blast: the pulse destroys Manasa's trailer */
  PN.trailer_blast = {
    draw: function (g, st) {
      pSky(g, true, { hz: 100, seed: 61, ox: 20, nebY: 30 });
      skyline(g, PW_, 84, 19, { minW: 10, maxW: 24, minH: 8, maxH: 36, col: '#0a0c1c', gap: 6 });
      R(g, 0, 84, PW_, 28, '#0c0c14'); R(g, 0, 98, PW_, 14, '#141420');
      // neighbouring trailers, the doomed one in the middle (torn open)
      for (var k = 0; k < 2; k++) { var tx = k ? 196 : 10; R(g, tx, 76, 50, 20, '#3c3c48'); R(g, tx, 84, 50, 2, '#6c2c2c'); disc(g, tx + 14, 96, 4, '#141418'); }
      R(g, 96, 80, 64, 18, '#2c2028'); line(g, 96, 80, 110, 70, '#2c2028'); line(g, 160, 80, 150, 66, '#2c2028'); disc(g, 116, 98, 4, '#141418'); disc(g, 144, 98, 4, '#141418');
      st.misc.push([128, 70]);
      fig(g, 'carl_run', 40, 110, '#000000', { f: 1 }); fig(g, 'mongo', 22, 110, '#000000');
    },
    anim: function (ctx, t, st) {
      var c = st.misc[0], p = (t * 0.45) % 1, R0 = 8 + p * 46;
      ctx.globalAlpha = 0.18 * (1 - p); ctx.fillStyle = '#fcf0c8'; ctx.fillRect(0, 0, PW_, PH_); ctx.globalAlpha = 1;
      var cols = ['#a81000', '#f83800', '#fca044', '#f8d878', '#fcfcfc'];
      for (var i = 0; i < 5; i++) { var rr = Math.round(R0 * (1 - i * 0.18)); ctx.fillStyle = cols[i]; for (var dy = -rr; dy <= rr; dy++) { var ww = Math.round(Math.sqrt(rr * rr - dy * dy) * (1 + 0.1 * Math.sin(dy + t * 9))); ctx.fillRect(c[0] - ww, c[1] + Math.round(dy * 0.8), ww * 2, 1); } }
      ctx.fillStyle = '#2c2028';
      for (i = 0; i < 9; i++) { var a = -0.3 - i * 0.33, d = p * 110; ctx.fillRect(Math.round(c[0] + Math.cos(a) * d), Math.round(c[1] + Math.sin(a) * d * 0.7 + p * p * 40), 3, 2); }
      ring(ctx, c[0], c[1] + 20, Math.round(10 + p * 120), '#fcfcfc');
    }
  };
  /* 12. quill_desk: Miss Quill behind her desk, the stuffed figures, a fresh corpse on the blotter */
  PN.quill_desk = {
    draw: function (g, st) {
      R(g, 0, 0, PW_, PH_, '#2c1408');
      var r = rng(81), plush = ['#7c3440', '#34506c', '#7c6c28', '#3c6c34', '#6c4884', '#8c5030', '#6c6c70', '#a85c6c'];
      for (var sy = 14; sy < 90; sy += 15) {
        R(g, 0, sy, PW_, 3, '#5c3018'); R(g, 0, sy + 3, PW_, 1, '#1c0c04');
        for (var x = 2; x < PW_; x += 6) { var c = plush[(r() * plush.length) | 0], ph = 6 + ((r() * 4) | 0); R(g, x, sy - ph, 5, ph, c); blob(g, x + 2, sy - ph - 1, 2, 2, c); P(g, x + 1, sy - ph + 1, '#000000'); P(g, x + 3, sy - ph + 1, '#000000'); if (r() < 0.4) { P(g, x, sy - ph - 3, c); P(g, x + 4, sy - ph - 3, c); } }
      }
      dither(g, 0, 0, PW_, PH_, '#000000', 5);
      // Miss Quill on her perch: elderly eagle-woman, grey-tinged feathers
      var qx = 128, qy = 66;
      R(g, qx - 22, qy + 6, 44, 3, '#3c2010');
      blob(g, qx, qy - 6, 16, 16, '#5c4c3c'); blob(g, qx, qy - 26, 10, 10, '#d8d0c0'); blob(g, qx - 3, qy - 30, 7, 6, '#e8e4d8');
      tri(g, qx + 12, qy - 28, 8, 7, '#c8a040'); R(g, qx + 9, qy - 25, 9, 3, '#c8a040'); P(g, qx + 16, qy - 22, '#7c5c18');
      R(g, qx + 1, qy - 30, 4, 3, '#f8d878'); P(g, qx + 3, qy - 29, '#000000'); line(g, qx - 2, qy - 33, qx + 6, qy - 31, '#7c7468');
      for (var f2 = 0; f2 < 6; f2++) line(g, qx - 14 + f2 * 2, qy - 14, qx - 18 + f2 * 3, qy + 4, '#8c8478');
      st.misc.push([qx + 2, qy - 30]);
      // the desk and the body dumped on it
      R(g, 40, 76, 176, 36, '#4c2410'); R(g, 40, 76, 176, 3, '#7c4420'); R(g, 48, 82, 160, 1, '#2c1408'); R(g, 60, 86, 40, 22, '#3c1c0c'); R(g, 156, 86, 40, 22, '#3c1c0c');
      R(g, 70, 70, 70, 7, '#8c8c7c'); blob(g, 70, 72, 6, 5, '#a89c8c'); R(g, 136, 68, 4, 9, '#8c8c7c'); R(g, 140, 68, 8, 3, '#6c4c38'); line(g, 100, 76, 98, 92, '#a89c8c'); line(g, 101, 76, 99, 92, '#8c8070');
      R(g, 84, 74, 3, 2, '#8c0c18'); R(g, 92, 76, 6, 1, '#8c0c18'); P(g, 98, 93, '#8c0c18');
      candle(g, 196, 66, { wax: '#d8d0b8', iron: '#2c1408' }, st);
    },
    anim: function (ctx, t, st) {
      flames(ctx, { ox: [0], oy: [0], t: t }, st.flames, 0, 99999, true);
      var e = st.misc[0];
      if ((t % 4) < 0.15) { ctx.fillStyle = '#d8d0c0'; ctx.fillRect(e[0] - 1, e[1], 4, 3); }
    }
  };
  /* 13. featherfall: the Magistrate, mummified, strapped upside down to a wheel */
  PN.featherfall = {
    draw: function (g, st) {
      R(g, 0, 0, PW_, PH_, '#0c0806');
      noiseCloud(g, 0, 0, PW_, PH_, 33, ['#140c08', '#1c120c'], function (x, y) { return 0.8 - Math.abs(x - 128) / 300; });
      var cx = 128, cy = 54;
      ring(g, cx, cy, 44, '#3c2414', 4); ring(g, cx, cy, 44, '#5c3820', 1);
      for (var a = 0; a < 8; a++) { var an = a * Math.PI / 4; line(g, cx, cy, cx + Math.round(Math.cos(an) * 42), cy + Math.round(Math.sin(an) * 42), '#2c1a0e'); }
      // featherless grey wings spread, body upside down, head at the bottom
      for (var s = -1; s <= 1; s += 2) { for (var k = 0; k < 5; k++) line(g, cx + s * 6, cy + 2, cx + s * (24 + k * 3), cy - 22 + k * 8, '#6c6458'); line(g, cx + s * 6, cy, cx + s * 36, cy - 26, '#8c8474'); }
      R(g, cx - 6, cy - 24, 12, 30, '#7c7464'); R(g, cx - 6, cy - 24, 2, 30, '#9c9484'); line(g, cx - 3, cy - 24, cx - 6, cy - 40, '#6c6458'); line(g, cx + 3, cy - 24, cx + 6, cy - 40, '#6c6458');
      R(g, cx - 8, cy - 42, 4, 2, '#4c4438'); R(g, cx + 4, cy - 42, 4, 2, '#4c4438');
      blob(g, cx, cy + 12, 7, 7, '#7c7464'); tri(g, cx, cy + 18, 6, 10, '#a89870', true); line(g, cx - 1, cy + 20, cx + 1, cy + 25, '#3c3428');
      R(g, cx - 5, cy + 10, 3, 2, '#d8e0d8'); R(g, cx + 2, cy + 10, 3, 2, '#d8e0d8'); st.misc.push([cx - 5, cy + 10], [cx + 2, cy + 10]);
      R(g, cx - 12, cy - 8, 24, 3, '#3c2010'); R(g, cx - 12, cy - 30, 24, 3, '#3c2010');
      candle(g, 40, 92, { wax: '#d8d0b8', iron: '#2c1408' }, st); candle(g, 214, 90, { wax: '#d8d0b8', iron: '#2c1408' }, st);
      R(g, 0, 100, PW_, 12, '#140c08');
    },
    anim: function (ctx, t, st) {
      var fl = 0.06 + Math.sin(t * 9) * 0.015 + Math.sin(t * 23) * 0.01;
      glow(ctx, 41, 88, 26, '#f8a040', fl); glow(ctx, 215, 86, 26, '#f8a040', fl);
      flames(ctx, { ox: [0], oy: [0], t: t }, st.flames, 0, 99999, false);
      if (Math.sin(t * 1.3) > 0.9) { ctx.fillStyle = '#fcfcfc'; for (var i = 0; i < st.misc.length; i++) ctx.fillRect(st.misc[i][0] + 1, st.misc[i][1], 1, 1); }
    }
  };
  /* 14. remex: Quill's husband, an undead skyfowl bound to the soul crystal */
  PN.remex = {
    draw: function (g, st) {
      R(g, 0, 0, PW_, PH_, '#08080e'); brickWall(g, 0, 0, PW_, PH_, { wall: '#10101a', course: '#06060a' }, 8);
      var cx = 150;
      for (var y = 0; y < 70; y++) { var hw = Math.round(18 * Math.sin(Math.min(1, y / 24) * Math.PI / 2) * (y > 46 ? (70 - y) / 24 : 1)); R(g, cx - hw, 14 + y, hw * 2, 1, y % 11 < 2 ? '#8ce4f4' : '#2898b8'); P(g, cx - hw, 14 + y, '#14485c'); P(g, cx + hw - 1, 14 + y, '#14485c'); }
      line(g, cx - 4, 20, cx - 10, 60, '#c8f8fc'); line(g, cx + 6, 28, cx + 2, 66, '#58c8e0');
      R(g, cx - 22, 84, 44, 8, '#3c4048'); R(g, cx - 22, 84, 44, 1, '#6c747c'); R(g, cx - 14, 92, 28, 20, '#2c3038');
      // Remex: hunched, skeletal bird, tubes into the crystal
      var rx = 84, ry = 104;
      R(g, rx - 8, ry - 36, 16, 26, '#3c3c34'); blob(g, rx + 2, ry - 40, 8, 7, '#5c5c4c'); tri(g, rx + 12, ry - 42, 8, 6, '#8c8460'); R(g, rx + 3, ry - 43, 3, 2, '#c8f8fc');
      line(g, rx - 4, ry - 10, rx - 8, ry, '#3c3c34'); line(g, rx + 4, ry - 10, rx + 6, ry, '#3c3c34');
      for (var k = 0; k < 6; k++) line(g, rx - 8, ry - 34 + k * 4, rx - 18, ry - 26 + k * 5, '#2c2c24');
      for (k = 0; k < 3; k++) { var y0 = ry - 30 + k * 7; for (var x = rx + 8; x < cx - 14; x += 2) P(g, x, y0 - Math.round(Math.sin((x - rx) / (cx - rx) * Math.PI) * (8 + k * 3)), '#4c5c64'); }
      st.misc.push([rx + 8, ry - 30], [cx, 50]);
    },
    anim: function (ctx, t, st) {
      var a = st.misc[0], c = st.misc[1];
      glow(ctx, c[0], c[1], 36, '#40d0f0', 0.1 + Math.sin(t * 2) * 0.05);
      ctx.fillStyle = '#a4f0fc';
      for (var i = 0; i < 8; i++) { var p = (t * 0.5 + i / 8) % 1; ctx.globalAlpha = 0.8 * (1 - p * 0.5); ctx.fillRect(Math.round(a[0] + (c[0] - 18 - a[0]) * p), Math.round(a[1] - Math.sin(p * Math.PI) * (10 + (i % 3) * 4) + (i % 3) * 7), 2, 1); }
      ctx.globalAlpha = 1;
    }
  };
  /* 15. glass_case: Carl's Doomsday Scenario, sealed in a Sheol Glass Reaper Case */
  PN.glass_case = {
    draw: function (g, st) {
      bands(g, PW_, 0, PH_, ['#06020c', '#0a0414', '#10061c', '#0a0414', '#06020c']);
      var cx = 128, cy = 56;
      R(g, cx - 34, cy - 30, 68, 64, '#1c1c24'); R(g, cx - 30, cy - 26, 60, 56, '#28283a');
      R(g, cx - 28, cy - 24, 56, 52, '#141c2c'); dither(g, cx - 28, cy - 24, 56, 52, '#3c4c6c', 3);
      line(g, cx - 26, cy + 24, cx - 6, cy - 22, '#6c7c9c'); line(g, cx - 20, cy + 26, cx - 2, cy - 14, '#4c5c7c');
      R(g, cx - 36, cy - 34, 72, 6, '#5c5c68'); R(g, cx - 36, cy - 34, 72, 1, '#9c9ca8'); R(g, cx - 36, cy + 32, 72, 8, '#3c3c48'); R(g, cx - 36, cy + 32, 72, 1, '#7c7c88');
      for (var x = cx - 32; x < cx + 32; x += 8) rows(g, x, cy + 35, ['.r.', 'r.r', '.r.'], { r: '#8c48c8' });
      // the soul crystal inside
      for (var y = 0; y < 40; y++) { var hw = Math.round(10 * Math.sin(Math.min(1, y / 14) * Math.PI / 2) * (y > 26 ? (40 - y) / 14 : 1)); R(g, cx - hw, cy - 20 + y, hw * 2, 1, y % 8 < 2 ? '#f8d8f8' : '#c058f8'); P(g, cx - hw, cy - 20 + y, '#5c1c8c'); }
      st.misc.push([cx, cy]);
      // the gauntleted hand holding it up
      R(g, cx - 44, cy + 40, 88, 30, '#3c3428'); R(g, cx - 44, cy + 40, 88, 2, '#6c5c44'); for (var f = 0; f < 4; f++) { R(g, cx - 40 + f * 20, cy + 30, 14, 14, '#5c4c3c'); R(g, cx - 40 + f * 20, cy + 30, 14, 2, '#8c7c5c'); }
    },
    anim: function (ctx, t, st) {
      var c = st.misc[0], p = 0.12 + Math.sin(t * 3) * 0.06;
      glow(ctx, c[0], c[1], 26, '#d878f8', p);
      if (Math.sin(t * 4.3) > 0.6) { ctx.fillStyle = '#fcfcfc'; ctx.fillRect(c[0] - 2, c[1] - 6, 1, 6); ctx.fillRect(c[0] - 1, c[1], 2, 1); ctx.fillRect(c[0] + 1, c[1], 1, 5); }
      sparks(ctx, t, c[0], c[1], 6, '#f8d8f8', 20);
    }
  };
  /* 16. doomsday: the blast building over the city, the sky cracking like glass */
  PN.doomsday = {
    draw: function (g, st) {
      pSky(g, true, { hz: 100, seed: 71, ox: 0, nebY: 40, slope: 0.3 });
      var r = rng(4);
      for (var k = 0; k < 9; k++) { var x = 120 + ((r() * 30) | 0), y = 60, ang = -Math.PI / 2 + (r() - 0.5) * 2.6; for (var s = 0; s < 14; s++) { var nx = x + Math.cos(ang) * 9, ny = y + Math.sin(ang) * 9; line(g, x, y, nx, ny, s < 4 ? '#fcfcfc' : '#c058f8'); x = nx; y = ny; ang += (r() - 0.5) * 0.8; } }
      st.misc.push([136, 84]);
      skyline(g, PW_, 96, 81, { minW: 8, maxW: 22, minH: 8, maxH: 40, col: '#06040e', gap: 2, broken: true, win: '#5c4c20', winP: 0.08 });
      R(g, 0, 96, PW_, 16, '#06040e');
    },
    anim: function (ctx, t, st) {
      var c = st.misc[0], p = (Math.sin(t * 1.6) + 1) / 2, rr = 30 + p * 6;
      ctx.globalAlpha = 0.18; ctx.fillStyle = '#c058f8'; ctx.beginPath(); ctx.arc(c[0], c[1], rr + 16, Math.PI, 0); ctx.fill();
      ctx.globalAlpha = 0.35; ctx.fillStyle = '#f8d8f8'; ctx.beginPath(); ctx.arc(c[0], c[1], rr, Math.PI, 0); ctx.fill();
      ctx.globalAlpha = 0.9; ctx.fillStyle = '#fcfcfc'; ctx.beginPath(); ctx.arc(c[0], c[1], rr * 0.45, Math.PI, 0); ctx.fill(); ctx.globalAlpha = 1;
      if (Math.sin(t * 7) > 0.9) { ctx.globalAlpha = 0.15; ctx.fillStyle = '#f8d8f8'; ctx.fillRect(0, 0, PW_, PH_); ctx.globalAlpha = 1; }
    }
  };
  /* 17. bursts: precursor bursts sweep the rooftops, Donut's crown crumbles */
  PN.bursts = {
    draw: function (g, st) {
      pSky(g, false, { hz: 90, seed: 23, ox: 50, d: { cols: ['#1c0408', '#2c060c', '#440a10', '#5c1014', '#781818', '#901c18'] } });
      var r = rng(9), x = 0;
      while (x < PW_) { var bw = 18 + ((r() * 20) | 0), top = 62 + ((r() * 20) | 0); R(g, x, top, bw, PH_, '#1c0608'); tri(g, x + bw / 2, top - 8, bw + 2, 9, '#1c0608'); x += bw; }
      R(g, 0, 96, PW_, 16, '#120406');
      fig(g, 'carl_run', 92, 108, '#000000', { f: 0 }); fig(g, 'mongo', 70, 108, '#000000', { big: true }); fig(g, 'katia_run', 118, 108, '#000000'); fig(g, 'bautista_run', 144, 108, '#000000');
      st.misc.push([91, 74]);
    },
    anim: function (ctx, t, st) {
      for (var k = 0; k < 2; k++) {
        var p = ((t * 0.5) + k * 0.5) % 1, rr = Math.round(p * 230);
        ctx.globalAlpha = 0.85 * (1 - p * 0.7); ring(ctx, -10, 60, rr, '#fcfcfc'); ring(ctx, -10, 60, rr - 2, '#f8d8f8', 2); ring(ctx, -10, 60, rr - 5, '#c058f8', 2);
        ctx.globalAlpha = 0.12 * (1 - p); ctx.fillStyle = '#f8d8f8'; ctx.beginPath(); ctx.arc(-10, 60, Math.max(1, rr - 4), 0, 6.2832); ctx.fill(); ctx.globalAlpha = 1;
      }
      var c = st.misc[0];
      ctx.fillStyle = '#f8b800';
      for (var i = 0; i < 7; i++) { var q = (t * 0.7 + i * 0.14) % 1; ctx.fillRect(Math.round(c[0] - 3 + i - q * 14), Math.round(c[1] + q * q * 34), 2, 1); }
      ctx.fillStyle = '#f8d878'; ctx.fillRect(c[0] - 2, c[1], 2, 1); ctx.fillRect(c[0] + 1, c[1] - 1, 1, 2);
    }
  };
  /* 18. stairwell: the eastern stairwell, the depot going up behind them */
  PN.stairwell = {
    draw: function (g, st) {
      pSky(g, true, { hz: 96, seed: 77, ox: 64, nebY: 30 });
      skyline(g, PW_, 88, 51, { minW: 10, maxW: 24, minH: 8, maxH: 34, col: '#0a0818', gap: 4, broken: true });
      R(g, 0, 88, PW_, 24, '#0a0818');
      for (var y = 92; y < PH_; y++) R(g, 0, y, PW_, 1, (y & 2) ? '#1c140c' : '#24180e');
      // the stairwell kiosk, glowing green
      R(g, 196, 58, 48, 38, '#4c4c58'); R(g, 192, 54, 56, 6, '#6c6c78'); R(g, 192, 54, 56, 1, '#9c9ca8'); R(g, 204, 64, 32, 32, '#000000');
      for (var i = 0; i < 5; i++) R(g, 206 + i * 2, 90 - i * 5, 28 - i * 4, 3, ['#3c3c48', '#2c2c38', '#202028', '#18181c', '#101014'][i]);
      R(g, 208, 44, 24, 8, '#00a800'); R(g, 210, 46, 20, 4, '#58d854'); st.misc.push([220, 70]);
      fig(g, 'carl_run', 150, 108, '#000000', { f: 1 }); fig(g, 'mongo', 128, 108, '#000000', { big: true }); fig(g, 'katia_run', 174, 108, '#000000');
      st.lamps.push([24, 84]);
    },
    anim: function (ctx, t, st) {
      var d = st.lamps[0], p = (t * 0.3) % 1;
      ctx.globalAlpha = 0.6; ctx.fillStyle = '#f83800'; ctx.beginPath(); ctx.arc(d[0], d[1], 30 + p * 10, Math.PI, 0); ctx.fill();
      ctx.fillStyle = '#fca044'; ctx.beginPath(); ctx.arc(d[0], d[1], 20 + p * 8, Math.PI, 0); ctx.fill();
      ctx.fillStyle = '#f8d878'; ctx.beginPath(); ctx.arc(d[0], d[1], 10 + p * 5, Math.PI, 0); ctx.fill(); ctx.globalAlpha = 1;
      var m = st.misc[0]; glow(ctx, m[0], m[1], 22, '#58d854', 0.1 + Math.sin(t * 3) * 0.04);
      embers(ctx, { t: t, camX: 0 }, '#f8a040', 10, 12);
    }
  };
  /* 19. greenroom: Odette's green room, after the floor */
  PN.greenroom = {
    draw: function (g) {
      pBackdrop(g, 'greenroom', 40, 50, false);
    },
    fg: function (g) {
      // Odette, in costume on the couch: a big hat, a glamorous silhouette
      blob(g, 222, 52, 7, 8, '#1c0c24'); R(g, 210, 44, 26, 3, '#1c0c24'); tri(g, 222, 34, 12, 10, '#1c0c24'); R(g, 214, 60, 16, 22, '#1c0c24'); R(g, 230, 62, 10, 3, '#1c0c24');
      P(g, 224, 50, '#f8d878'); R(g, 214, 64, 16, 2, '#c8a040');
      fig(g, 'carl_back', 150, 108, '#100c14'); fig(g, 'mongo', 176, 108, '#100c14', { big: true });
    },
    anim: function (ctx, t) { pBackdropAnim(ctx, 'greenroom', 40, 50, t, false); }
  };
  art.panels = Object.keys(PN);

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
  // the Incubus's charm: a pink heart that wobbles
  pix('charm', { p: '#f878f8', P: '#d800cc', w: '#fcfcfc' }, [[
    '..........',
    '.PPP..PPP.',
    'PppwPPppPP',
    'PpwppppppP',
    'PppppppppP',
    '.PppppppP.',
    '..PppppP..',
    '...PppP...',
    '....PP....'], [
    '..........',
    '..PP..PP..',
    '.PpwPPppP.',
    '.PwpppppP.',
    '.PpppppPP.',
    '..PppppP..',
    '...PppP...',
    '....PP....',
    '..........']]);
  // Vincente's Meat Hooks: a rusty hook on a chain
  pix('meat_hook', { g: '#9c9c9c', d: '#5c5c5c', r: '#a81000', w: '#fcfcfc' }, [[
    '...dd...',
    '...gd...',
    '...dd...',
    '...gd...',
    '..gwgg..',
    '.gg..gg.',
    '.g....g.',
    '.gr...g.',
    '.ggr.gg.',
    '..ggg...']]);
  // where a clockwork Mongo decoy can be left (plant levels): a brass gear marker on the floor
  proc('decoy_spot', 16, 6, 2, function (g, f) {
    var c = f ? '#f8b800' : '#ac7c00';
    R(g, 2, 3, 12, 2, '#000000'); R(g, 3, 3, 10, 1, c);
    R(g, 6, 1, 4, 4, '#000000'); R(g, 7, 2, 2, 2, c);
    P(g, 4, 2, c); P(g, 11, 2, c);
  }, false);
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

  /* =====================================================================
     UPDATE 2: rescue cage, dino egg, lever, padlocked door, quest items,
     overworld lock badge
     ===================================================================== */
  // ---- cage (24x28): thin bars with wide gaps so the companion drawn behind stays visible ----
  var IRON = { l: '#bcbcbc', m: '#7c7c7c', d: '#3c3c3c', k: '#000000', y: '#f8b800', Y: '#f8d878', o: '#ac7c00' };
  function bar(g, x, y0, y1) { R(g, x, y0, 1, y1 - y0, IRON.l); R(g, x + 1, y0, 1, y1 - y0, IRON.d); }
  function cageTop(g, dx) {
    // hanging ring + domed top band
    R(g, 10 + dx, 0, 4, 1, K); R(g, 9 + dx, 1, 1, 2, K); R(g, 14 + dx, 1, 1, 2, K); R(g, 10 + dx, 1, 4, 1, IRON.l); R(g, 10 + dx, 2, 1, 1, IRON.m); R(g, 13 + dx, 2, 1, 1, IRON.m);
    R(g, 3 + dx, 3, 18, 1, K); R(g, 1 + dx, 4, 22, 1, K); R(g, 0 + dx, 5, 24, 3, K);
    R(g, 4 + dx, 4, 16, 1, IRON.m); R(g, 2 + dx, 5, 20, 1, IRON.l); R(g, 1 + dx, 6, 22, 1, IRON.m);
    for (var x = 3; x < 22; x += 4) P(g, x + dx, 6, IRON.l);
  }
  function cageBase(g) {
    R(g, 0, 25, 24, 3, K); R(g, 1, 26, 22, 1, IRON.l);
    for (var x = 3; x < 22; x += 5) P(g, x, 26, IRON.m);
  }
  var CAGE_BARS = [1, 6, 11, 16, 21];
  function cagePadlock(g, x, y) { // hangs on the door bar; stage.js draws the prisoner flipped (facing left), so this sits behind its head
    R(g, x, y + 2, 6, 5, K); R(g, x + 1, y, 4, 1, K); P(g, x, y + 1, K); P(g, x + 5, y + 1, K);
    P(g, x + 1, y + 1, IRON.l); P(g, x + 4, y + 1, IRON.m);
    R(g, x + 1, y + 3, 4, 3, IRON.y); R(g, x + 1, y + 3, 4, 1, IRON.Y); P(g, x + 2, y + 4, K); P(g, x + 4, y + 5, IRON.o);
  }
  function cageBody(g, sway) {
    // sway: the upper half of the cage leans 1px (frame 1 = rattle)
    for (var i = 0; i < CAGE_BARS.length; i++) {
      var x = CAGE_BARS[i];
      bar(g, x, 16, 25);
      bar(g, x + sway, 8, 16);
    }
    // outer posts get a black edge so the cage silhouette reads
    R(g, 0, 16, 1, 9, K); R(g, 23, 16, 1, 9, K); R(g, sway, 8, 1, 8, K); R(g, 23 + sway, 8, 1, 8, K);
    // thin band high up, above a small companion's head
    R(g, 1 + sway, 10, 22, 1, IRON.l); R(g, 1 + sway, 11, 22, 1, IRON.d);
    cagePadlock(g, 15, 14);
  }
  proc('cage', 24, 28, 2, function (g, f) {
    cageBody(g, f); cageTop(g, f); cageBase(g);
  }, false);
  proc('cage_broken', 30, 28, 1, function (g) {
    g.translate(1, 0);
    // dented top band tilted down to the left
    R(g, 1, 6, 22, 3, K); R(g, 3, 5, 18, 1, K); R(g, 6, 4, 12, 1, K);
    R(g, 2, 7, 20, 1, IRON.m); R(g, 4, 6, 16, 1, IRON.l); R(g, 7, 5, 10, 1, IRON.m);
    P(g, 9, 6, IRON.d); P(g, 10, 7, IRON.d); P(g, 11, 6, K);
    // left post + bar intact
    R(g, 0, 8, 1, 17, K);
    bar(g, 1, 8, 25); bar(g, 6, 8, 25);
    R(g, 1, 10, 7, 1, IRON.l); R(g, 1, 11, 7, 1, IRON.d);
    // centre bars pried apart (punched open)
    var bent = [[11, -1], [16, 1]];
    for (var i = 0; i < 2; i++) {
      var bx = bent[i][0], dir = bent[i][1];
      for (var y = 9; y < 25; y++) {
        var off = Math.round(Math.sin((y - 9) / 16 * Math.PI) * 3) * dir;
        P(g, bx + off, y, IRON.l); P(g, bx + off + 1, y, IRON.d);
      }
    }
    // right post (the hinge side)
    bar(g, 21, 8, 25); R(g, 23, 8, 1, 17, K);
    // the door: torn off its top hinge, swung out and hanging askew to the right
    var tmp = mkCanvas(30, 28), tg = g2(tmp);
    for (var c = 0; c < 6; c++) {
      var dy = Math.round(c * 0.8);
      if (c === 0 || c === 5 || c === 3) R(tg, 23 + c, 14 + dy, 1, 10, c === 5 ? IRON.m : IRON.l);
      P(tg, 23 + c, 14 + dy, IRON.l); P(tg, 23 + c, 23 + dy, IRON.m);
    }
    outlineCanvas(tmp, 30, 28, 1, K);
    g.drawImage(tmp, 0, 0);
    // floor plate; the snapped padlock lies in front
    cageBase(g);
    R(g, 14, 22, 6, 4, K); R(g, 15, 23, 4, 2, IRON.y); P(g, 15, 23, IRON.Y); P(g, 16, 24, K);
    P(g, 13, 21, IRON.l); P(g, 12, 20, IRON.l); P(g, 12, 21, K); P(g, 13, 20, K);
    // flying bits
    P(g, 14, 2, IRON.l); P(g, 20, 2, IRON.m); P(g, 4, 1, IRON.m);
  }, false);

  // ---- dino egg (16x18): speckled green, sits in a straw nest; frame 1 wobbles ----
  var EGG = { b: '#b8f8b8', m: '#58d854', d: '#00a800', s: '#006800', w: '#fcfcfc', n: '#ac7c00', N: '#fca044', D: '#503000' };
  var EGG_ROWS = [
    '.....bbbb.....',
    '....bbwbbb....',
    '...bbwbbsbb...',
    '..bbwbbbbbbb..',
    '..bbbbbsbbmb..',
    '.bsbbbbbbbbmb.',
    '.bbbbbsbbbbmb.',
    '.bbsbbbbbsbmb.',
    '.bbbbbbbbbmmb.',
    '.bbbbsbbbbmmb.',
    '..bsbbbbbmmb..',
    '..bbbbbsmmdb..',
    '...bbmmmmdd...',
    '....dddddd....'
  ];
  function nest(g) {
    R(g, 1, 14, 14, 3, EGG.n);
    for (var x = 1; x < 15; x += 2) { P(g, x, 14, EGG.N); P(g, x + 1, 16, EGG.D); }
    P(g, 0, 15, EGG.n); P(g, 15, 15, EGG.n); P(g, 0, 13, EGG.N); P(g, 15, 13, EGG.N); P(g, 3, 13, EGG.N); P(g, 12, 13, EGG.N);
  }
  proc('egg', 16, 18, 2, function (g, f) {
    var tmp = mkCanvas(16, 18), tg = g2(tmp);
    if (f === 0) rows(tg, 1, 1, EGG_ROWS, EGG);
    else for (var j = 0; j < EGG_ROWS.length; j++) rows(tg, 1 + (j < 5 ? 1 : 0), 1 + j, [EGG_ROWS[j]], EGG);
    nest(tg);
    outlineCanvas(tmp, 16, 18, 1, K);
    g.drawImage(tmp, 0, 0);
    if (f === 1) { P(g, 0, 2, EGG.w); P(g, 15, 4, EGG.w); P(g, 1, 1, EGG.m); }
  }, false);
  proc('egg_broken', 20, 14, 1, function (g) {
    var tmp = mkCanvas(20, 14), tg = g2(tmp);
    // bottom half of the shell: jagged rim, dark empty inside
    rows(tg, 1, 3, [
      'b.b..b.b..',
      'bbsbbbdbbb',
      'bsssssssmb',
      'bbbbbbbbmb',
      'bsbbbbsmmb',
      '.bbbbbmmd.',
      '..ddddd...'], EGG);
    // top half: a little dome lying tipped over on the right
    rows(tg, 12, 3, [
      '...bb...',
      '..bwbb..',
      '.bwbbsb.',
      'bbbbbbmb',
      '.b.b.b.b'], EGG);
    R(tg, 1, 10, 18, 2, EGG.n); for (var x = 1; x < 19; x += 2) { P(tg, x, 10, EGG.N); P(tg, x + 1, 11, EGG.D); }
    outlineCanvas(tmp, 20, 14, 1, K);
    g.drawImage(tmp, 0, 0);
    // shell crumbs
    P(g, 1, 3, EGG.b); P(g, 16, 2, EGG.b); P(g, 12, 1, EGG.m);
  }, false);

  // ---- lever (16x16): frame 0 = handle up-left (off, red light), frame 1 = down-right (on, green) ----
  proc('lever', 16, 16, 2, function (g, f) {
    var tmp = mkCanvas(16, 16), tg = g2(tmp);
    // base box
    R(tg, 2, 10, 12, 5, '#5c5c64'); R(tg, 2, 10, 12, 1, '#8c8c94'); R(tg, 2, 14, 12, 1, '#3c3c44');
    R(tg, 5, 9, 6, 2, '#3c3c44');
    // slot + status light
    R(tg, 4, 12, 3, 1, '#202020');
    R(tg, 10, 12, 2, 2, f ? '#58d854' : '#a80020'); P(tg, 10, 12, f ? '#b8f818' : '#f85898');
    P(tg, 3, 13, '#8c8c94'); P(tg, 12, 11, '#8c8c94');
    // handle shaft from the pivot (8,9) + red ball grip
    if (f === 0) { line(tg, 7, 9, 3, 3, '#9c9c9c'); line(tg, 8, 9, 4, 3, '#5c5c5c'); disc(tg, 3, 3, 2, '#e40058'); P(tg, 2, 2, '#f8a4c0'); }
    else { line(tg, 8, 8, 12, 6, '#9c9c9c'); line(tg, 8, 9, 12, 7, '#5c5c5c'); disc(tg, 13, 6, 2, '#e40058'); P(tg, 12, 5, '#f8a4c0'); }
    R(tg, 7, 9, 2, 1, '#bcbcbc');
    outlineCanvas(tmp, 16, 16, 1, K);
    g.drawImage(tmp, 0, 0);
    if (f) { P(g, 15, 2, '#b8f818'); P(g, 14, 1, '#58d854'); }
  }, false);

  // ---- door_locked: the exit door with chains across it and a big padlock ----
  proc('door_locked', 26, 38, 1, function (g) {
    doorFrame(g);
    R(g, 4, 13, 18, 25, '#7c2c08'); R(g, 4, 13, 18, 1, '#a84c18'); R(g, 4, 13, 1, 25, '#a84c18');
    R(g, 6, 16, 6, 9, '#5c1c04'); R(g, 14, 16, 6, 9, '#5c1c04'); R(g, 6, 27, 6, 9, '#5c1c04'); R(g, 14, 27, 6, 9, '#5c1c04');
    R(g, 6, 16, 6, 1, '#4c1404'); R(g, 14, 16, 6, 1, '#4c1404');
    R(g, 12, 13, 2, 25, '#3c1004');
    exitSign(g, false);
    // red "locked" lamp over the sign
    R(g, 21, 2, 2, 2, '#e40058'); P(g, 21, 2, '#f8a4c0');
    // chains: an X of links bolted to the frame
    function chain(x0, y0, x1, y1) {
      var n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
      for (var i = 0; i <= n; i++) {
        var x = Math.round(x0 + (x1 - x0) * i / n), y = Math.round(y0 + (y1 - y0) * i / n);
        var ph = i % 4;
        if (ph === 3) continue;
        R(g, x - 1, y - 1, 3, 3, K);
      }
      for (i = 0; i <= n; i++) {
        x = Math.round(x0 + (x1 - x0) * i / n); y = Math.round(y0 + (y1 - y0) * i / n);
        ph = i % 4;
        if (ph === 3) continue;
        P(g, x, y, ph === 1 ? '#fcfcfc' : (ph === 0 ? '#bcbcbc' : '#7c7c7c'));
      }
    }
    chain(3, 15, 22, 34); chain(22, 15, 3, 34);
    // bolts on the frame where the chains anchor
    [[2, 14], [23, 14], [2, 35], [23, 35]].forEach(function (b) { R(g, b[0] - 1, b[1] - 1, 3, 3, K); P(g, b[0], b[1], '#bcbcbc'); });
    // big padlock in the middle
    R(g, 9, 19, 8, 3, K); R(g, 10, 18, 6, 1, K);
    R(g, 10, 19, 1, 4, '#bcbcbc'); R(g, 15, 19, 1, 4, '#7c7c7c'); R(g, 11, 19, 4, 1, '#bcbcbc'); R(g, 11, 20, 4, 2, K);
    R(g, 7, 22, 12, 10, K);
    R(g, 8, 23, 10, 8, '#f8b800'); R(g, 8, 23, 10, 1, '#f8d878'); R(g, 8, 23, 1, 8, '#f8d878'); R(g, 8, 30, 10, 1, '#ac7c00'); R(g, 17, 23, 1, 8, '#ac7c00');
    R(g, 12, 25, 2, 2, K); R(g, 12, 27, 2, 2, K); P(g, 12, 26, K);
    P(g, 9, 24, '#fcfcfc');
  });

  // ---- quest items (16x16, 2 frames): golden halo + sparkles, glint on frame 1 ----
  function qiItem(name, pal, rs, glow) {
    var h = rs.length, w = 0;
    for (var i = 0; i < h; i++) w = Math.max(w, rs[i].length);
    var ox = (16 - w) >> 1, oy = ((16 - h) >> 1);
    glow = glow || '#f8d878';
    // masks: item fill -> black outline ring -> aura ring (no canvas readback needed)
    var fill = new Uint8Array(256), ol = new Uint8Array(256), aura = new Uint8Array(256), q, nx, ny, kx, ky;
    for (ky = 0; ky < h; ky++) for (kx = 0; kx < rs[ky].length; kx++) {
      var c0 = rs[ky].charAt(kx);
      if (c0 !== '.' && c0 !== ' ' && pal[c0]) fill[(oy + ky) * 16 + ox + kx] = 1;
    }
    function ring(src, dst, block) {
      for (ny = 0; ny < 16; ny++) for (nx = 0; nx < 16; nx++) {
        q = ny * 16 + nx;
        if (src[q] || block[q]) continue;
        if ((nx > 0 && src[q - 1]) || (nx < 15 && src[q + 1]) || (ny > 0 && src[q - 16]) || (ny < 15 && src[q + 16])) dst[q] = 1;
      }
    }
    ring(fill, ol, fill);
    var both = new Uint8Array(256); for (q = 0; q < 256; q++) both[q] = fill[q] | ol[q];
    ring(ol, aura, both);
    proc(name, 16, 16, 2, function (g, f) {
      // pixel aura just outside the black outline: dithered on frame 0, solid on frame 1 (pulse)
      for (var ay = 0; ay < 16; ay++) for (var ax = 0; ax < 16; ax++) {
        if (aura[ay * 16 + ax] && (f === 1 || ((ax + ay) & 1) === 0)) P(g, ax, ay, glow);
      }
      var tmp = mkCanvas(16, 16), tg = g2(tmp);
      if (f === 1) { // glint: a diagonal white streak across the item's lighter colours
        for (var j = 0; j < h; j++) for (var i2 = 0; i2 < rs[j].length; i2++) {
          var ch = rs[j].charAt(i2), col = pal[ch];
          if (!col || ch === '.') continue;
          var d = (ox + i2) + (oy + j), rgb = parseColor(col);
          if ((d === 13 || d === 14) && rgb[0] + rgb[1] + rgb[2] > 200) col = '#fcfcfc';
          P(tg, ox + i2, oy + j, col);
        }
      } else rows(tg, ox, oy, rs, pal);
      outlineCanvas(tmp, 16, 16, 1, K);
      g.drawImage(tmp, 0, 0);
      // twinkles (plus-shaped), alternate corners per frame
      var sp = f ? [[13, 2], [2, 12]] : [[2, 2], [13, 12]];
      for (var s = 0; s < sp.length; s++) {
        var x = sp[s][0], y = sp[s][1];
        P(g, x, y, '#fcfcfc'); P(g, x - 1, y, glow); P(g, x + 1, y, glow); P(g, x, y - 1, glow); P(g, x, y + 1, glow);
      }
    }, false);
  }
  var GOLD = { y: '#f8b800', Y: '#f8d878', o: '#ac7c00', w: '#fcfcfc', d: '#503000' };
  function qpal(extra) { var o = {}, k; for (k in GOLD) o[k] = GOLD[k]; for (k in extra) o[k] = extra[k]; return o; }
  qiItem('qi_key', qpal({ r: '#e40058' }), [
    '.YYy.......',
    'YyyyY......',
    'yy.yo......',
    'yyyyr......',
    '.yooyy.....',
    '.....yy....',
    '......yy...',
    '.......yy..',
    '......yyyy.',
    '.......o.yy',
    '........yo.',
    '.........o.'
  ]);
  qiItem('qi_valve', { r: '#e40058', R: '#f85898', d: '#a80020', g: '#bcbcbc', G: '#7c7c7c', w: '#fcfcfc' }, [
    '....rRRr....',
    '..rRd..drr..',
    '.rd..rr..dr.',
    '.R...rr...r.',
    'rd...rr...dr',
    'Rrrrrggrrrrr',
    'rrrrrGGrrrrd',
    'rd...rr...dr',
    '.r...rr...d.',
    '.rd..rr..dd.',
    '..rrd..ddd..',
    '....rddd....'
  ], '#f8a4c0');
  qiItem('qi_gear', { g: '#bcbcbc', G: '#7c7c7c', w: '#fcfcfc', d: '#3c3c3c', y: '#f8b800' }, [
    '....gg.gg...',
    '....gg.gG...',
    '.gwgggggggG.',
    '.wggggggggG.',
    '..ggg..gGG..',
    'gggg.yy.gGGG',
    'gggg.yy.gGGd',
    '..ggg..gGG..',
    '.gggggggGGd.',
    '.GggggggGGd.',
    '....GG.Gd...',
    '....Gd.dd...'
  ], '#a4e4fc');
  qiItem('qi_shell', { p: '#f8a4c0', P: '#fce0f0', m: '#e45878', d: '#a80020', w: '#fcfcfc' }, [
    '...PpPpPp...',
    '.pPpPpPpPpm.',
    'pPpPpPpPpPpm',
    'pPpPpPpPpPmm',
    'pmPpPpPpPmPm',
    '.pmPpPpPmPm.',
    '..pmPpPmPd..',
    '...pmPpmd...',
    '..mmpPpmdd..',
    '..ddmmmddd..'
  ], '#f8b8f8');
  qiItem('qi_horn', { i: '#fce0a8', I: '#f0d0b0', s: '#c8a070', y: '#f8b800', o: '#ac7c00', w: '#fcfcfc' }, [
    'yy..........',
    'oy..........',
    '.is......iy.',
    '.iis....iiiy',
    '..iisssiiwiy',
    '..yiiiiiiwiy',
    '...oiiyiiiiy',
    '....ssoiiiy.',
    '.......sooy.'
  ]);
  qiItem('qi_mask', { p: '#9878f8', P: '#d8b8f8', m: '#4428bc', y: '#f8b800', Y: '#f8d878', w: '#fcfcfc', r: '#e40058', f: '#f878f8' }, [
    '...........f',
    '..........ff',
    '.pPPp..pPPpf',
    'pPPPPppPPPPp',
    'pP..Ppp..Pp.',
    'p...ppp...p.',
    'pp..pYp..pp.',
    '.ppppYYpppm.',
    '..mmy..ymm..',
    '...y....y...'
  ], '#d8b8f8');
  qiItem('qi_crown', qpal({ r: '#e40058', b: '#3cbcfc', g: '#58d854' }), [
    'w....w....w.',
    'y...yYy...y.',
    'yy..yyy..yy.',
    'yYy.yyy.yyy.',
    'yyyyyyyyyyy.',
    'yyryybyygyo.',
    'yYyyyyyyyyo.',
    'yyyyyyyyyyo.',
    'Yoooooooooo.'
  ]);
  qiItem('qi_badge', qpal({ b: '#0058f8', B: '#3cbcfc', r: '#e40058', R: '#a80020' }), [
    '.....Y......',
    '.....y......',
    '....yYy.....',
    'yyyyyyyyyyy.',
    '.yyYYyyyyy..',
    '..yyYbbyy...',
    '..yyybyyy...',
    '.yyyyyyyyy..',
    '.yyo...oyy..',
    'yo.......oy.',
    '...rR.Rr....',
    '...r...r....'
  ]);
  qiItem('qi_map', { p: '#fce0a8', P: '#f0d0b0', s: '#c8a070', d: '#7c4c18', r: '#e40058', b: '#3cbcfc', g: '#58d854', w: '#fcfcfc' }, [
    'dd........dd',
    'dPpppppppPdd',
    'dpgg.ppbbpd.',
    '.pgggppbbp..',
    '.ppg.pp.rp.r',
    '.pp..p.p.rr.',
    '.p..ppp.rpr.',
    '.pbbppppppr.',
    'dpbbpgg.ppd.',
    'dPppppppppdd',
    'dd........dd'
  ]);
  qiItem('qi_lens', { y: '#f8b800', o: '#ac7c00', c: '#a4e4fc', C: '#3cbcfc', w: '#fcfcfc', b: '#7c4c18', B: '#503000' }, [
    '...yyyyy....',
    '..yccccCy...',
    '.ywwcccCCy..',
    'ycwccccCCy..',
    'yccccccCCo..',
    'ycccccCCCo..',
    'yCcccCCCCo..',
    '.oCCCCCCo...',
    '..oooooobb..',
    '........bb..',
    '.........bB.',
    '..........B.'
  ], '#a4e4fc');
  qiItem('qi_bolt', { y: '#f8d878', Y: '#f8b800', o: '#fca044', w: '#fcfcfc' }, [
    '......wyy',
    '.....wyyo',
    '....wyyo.',
    '...wyyo..',
    '..wyyyyyy',
    '.wyyyyyo.',
    '....yyo..',
    '...yyo...',
    '..yyo....',
    '.yyo.....',
    'yyo......',
    'yo.......'
  ], '#f8f8a0');

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
  icon('quest', ['.kkkkkk.', 'kYYYYYok', '.kYrYok.', '.kYrYk..', '.kYYYk..', '.kYrYok.', 'kYYYYYok', '.kkkkkk.']);
  icon('eye', ['........', '..kkkk..', '.kwwwwk.', 'kwwekwwk', 'kwekkwwk', '.kwwwwk.', '..kkkk..', '........']);


  /* =====================================================================
     BOOK 2: street doors, plant-and-detonate kit, stage objects,
     new projectiles, fx, key items, HUD icons
     ===================================================================== */
  var WOOD = { d: '#3c1c08', m: '#7c4418', l: '#a86c30', h: '#c8904c' };
  var STONE = { d: '#3c3438', m: '#6c6468', l: '#948c90', h: '#bcb4b8' };
  function studs(g, x, y, w, h, c, step) { for (var j = y; j < y + h; j += step) for (var i = x; i < x + w; i += step) P(g, i, j, c); }
  function stoneArch(g, x, y, w, h, c) { // stone door surround with an arched top
    R(g, x, y + 6, w, h - 6, c.m); blob(g, x + (w >> 1), y + 7, w >> 1, 7, c.m);
    for (var j = y + 10; j < y + h; j += 5) { R(g, x, j, 3, 1, c.d); R(g, x + w - 3, j, 3, 1, c.d); }
    R(g, x, y + 6, 1, h - 6, c.l); P(g, x + (w >> 1), y, c.l);
  }
  function plankDoor(g, x, y, w, h, arch) {
    R(g, x, y + (arch ? 4 : 0), w, h - (arch ? 4 : 0), WOOD.m);
    if (arch) blob(g, x + (w >> 1), y + 5, (w >> 1) - 1, 5, WOOD.m);
    for (var i = x + 3; i < x + w; i += 4) R(g, i, y + (arch ? 2 : 0), 1, h, WOOD.d);
    R(g, x, y + (arch ? 4 : 0), 1, h, WOOD.l);
  }
  // ---- the inn: arched plank door in a stone surround, iron straps, a hanging tankard sign, lantern ----
  proc('door_inn', 32, 46, 2, function (g, f) {
    stoneArch(g, 3, 8, 26, 38, STONE);
    plankDoor(g, 7, 13, 18, 33, true);
    R(g, 7, 22, 18, 2, '#2c2c2c'); R(g, 7, 36, 18, 2, '#2c2c2c'); studs(g, 8, 22, 18, 2, '#9c9c9c', 4); studs(g, 8, 36, 18, 2, '#9c9c9c', 4);
    R(g, 21, 29, 2, 3, '#f8b800'); P(g, 21, 29, '#f8d878');
    // bracket + sign: a frothy tankard
    R(g, 13, 0, 1, 3, '#1c1c1c'); R(g, 18, 0, 1, 3, '#1c1c1c'); R(g, 10, 3, 12, 8, '#a86c30'); R(g, 10, 3, 12, 1, '#c8904c'); R(g, 10, 10, 12, 1, '#5c3010');
    R(g, 13, 5, 5, 5, '#e8e0d0'); R(g, 13, 4, 5, 2, '#fcfcfc'); R(g, 18, 6, 2, 3, '#e8e0d0'); P(g, 14, 7, '#c89c40'); P(g, 16, 8, '#c89c40');
    // lantern on the right of the frame
    R(g, 28, 18, 3, 1, '#1c1c1c'); R(g, 28, 19, 3, 5, f ? '#f8d878' : '#f8b800'); R(g, 28, 24, 3, 1, '#1c1c1c'); P(g, 29, 21, '#fcfcfc');
  });
  // ---- a shop: glazed door under a striped awning, coin-purse sign ----
  proc('door_shop', 32, 44, 1, function (g) {
    R(g, 4, 10, 24, 34, '#5c3818'); R(g, 4, 10, 24, 1, '#7c5028');
    R(g, 7, 14, 18, 30, WOOD.m); R(g, 7, 14, 1, 30, WOOD.l);
    R(g, 9, 16, 14, 12, '#24324c'); R(g, 15, 16, 2, 12, WOOD.d); R(g, 9, 21, 14, 1, WOOD.d); P(g, 10, 17, '#7c9cbc'); P(g, 18, 17, '#7c9cbc');
    R(g, 9, 31, 14, 11, WOOD.d); R(g, 10, 32, 12, 9, WOOD.m); P(g, 20, 34, '#f8b800');
    for (var x = 1; x < 31; x++) { R(g, x, 4, 1, 5, ((x >> 2) & 1) ? '#2c7c6c' : '#e8d8b0'); }
    for (x = 1; x < 31; x += 4) { R(g, x, 9, 4, 1, ((x >> 2) & 1) ? '#2c7c6c' : '#e8d8b0'); P(g, x + 1, 10, ((x >> 2) & 1) ? '#2c7c6c' : '#e8d8b0'); P(g, x + 2, 10, ((x >> 2) & 1) ? '#2c7c6c' : '#e8d8b0'); }
    R(g, 1, 3, 30, 1, '#1c3c34');
    R(g, 11, 0, 10, 4, '#a86c30'); blob(g, 16, 1, 2, 1, '#f8b800'); P(g, 15, 0, '#f8d878');
  });
  // ---- the pub (the Desperado Club is down its back stairs): heavy double door, round window, tankard bracket ----
  proc('door_pub', 32, 46, 2, function (g, f) {
    R(g, 3, 10, 26, 36, '#2c1c14'); R(g, 3, 10, 26, 2, '#4c3020');
    R(g, 6, 14, 20, 32, '#5c2c10'); R(g, 16, 14, 1, 32, '#24100a'); for (var y = 18; y < 46; y += 6) { R(g, 6, y, 20, 1, '#3c1c08'); }
    R(g, 6, 14, 1, 32, '#8c4c20'); R(g, 17, 14, 1, 32, '#8c4c20');
    disc(g, 11, 22, 3, '#24100a'); disc(g, 11, 22, 2, f ? '#f8c050' : '#c88c30'); disc(g, 21, 22, 3, '#24100a'); disc(g, 21, 22, 2, f ? '#c88c30' : '#f8c050');
    R(g, 14, 32, 1, 3, '#f8b800'); R(g, 18, 32, 1, 3, '#f8b800');
    R(g, 6, 45, 20, 1, f ? '#f8b800' : '#c88c30');
    R(g, 3, 4, 26, 6, '#5c2c10'); R(g, 3, 4, 26, 1, '#8c4c20'); R(g, 7, 6, 3, 2, '#e8e0d0'); R(g, 12, 6, 3, 2, '#c89c40'); R(g, 17, 6, 3, 2, '#e8e0d0'); R(g, 22, 6, 3, 2, '#c89c40');
    R(g, 0, 0, 32, 2, '#1c1c1c');
  });
  // ---- the Desperado Club: red tufted door, gold studs, neon star, glitter that moves ----
  proc('door_club', 32, 48, 3, function (g, f) {
    R(g, 2, 12, 28, 36, '#1c0814'); R(g, 3, 13, 26, 35, '#c8a040');
    R(g, 5, 15, 22, 33, '#a8102c');
    for (var y = 15; y < 48; y += 5) for (var x = 5 + (((y - 15) / 5) & 1) * 3; x < 27; x += 6) { P(g, x, y, '#600818'); P(g, x + 1, y + 1, '#d83048'); P(g, x, y + 2, '#600818'); }
    R(g, 15, 15, 2, 33, '#600818'); R(g, 13, 30, 2, 4, '#f8d878'); R(g, 17, 30, 2, 4, '#f8d878');
    var sp = [[7, 18], [22, 22], [10, 40], [24, 36], [18, 44], [8, 28], [20, 17], [25, 44]];
    for (var i = 0; i < sp.length; i++) if ((i + f) % 3 === 0) { P(g, sp[i][0], sp[i][1], '#fcfcfc'); P(g, sp[i][0] - 1, sp[i][1], '#f8b8f8'); P(g, sp[i][0] + 1, sp[i][1], '#f8b8f8'); P(g, sp[i][0], sp[i][1] - 1, '#f8b8f8'); P(g, sp[i][0], sp[i][1] + 1, '#f8b8f8'); } else if ((i + f) % 3 === 1) P(g, sp[i][0], sp[i][1], '#f878f8');
    rows(g, 10, 0, ['.....n.....', '....nnn....', 'nnnnnnnnnnn', '.nnnnnnnnn.', '..nnnnnnn..', '.nnn...nnn.', 'nn.......nn'], { n: f === 1 ? '#f8d878' : '#f878f8' });
    R(g, 2, 9, 28, 2, '#f85898');
  });
  // ---- a plain plank door in a broken stone frame (ruins, back doors) ----
  proc('door_wood', 26, 42, 1, function (g) {
    stoneArch(g, 1, 4, 24, 38, { d: '#2c2428', m: '#4c4448', l: '#6c6468' });
    R(g, 2, 4, 3, 2, '#3c5c24'); R(g, 20, 8, 4, 2, '#3c5c24');
    plankDoor(g, 5, 9, 16, 33, true);
    R(g, 5, 18, 16, 2, '#2c2c2c'); R(g, 5, 32, 16, 2, '#2c2c2c'); R(g, 17, 25, 2, 2, '#9c9c9c');
    line(g, 6, 12, 19, 40, '#3c1c08');
  });
  // ---- the Apito Education Center: double door, arched transom, bell, wand crest ----
  proc('door_school', 36, 48, 1, function (g) {
    R(g, 2, 12, 32, 36, '#6c2c20'); for (var y = 14; y < 48; y += 4) R(g, 2, y, 32, 1, '#4c1c14');
    R(g, 6, 16, 24, 32, '#d8d0c0'); blob(g, 18, 17, 12, 7, '#d8d0c0');
    blob(g, 18, 17, 10, 5, '#34284c'); R(g, 8, 17, 20, 3, '#34284c'); for (var a = -2; a <= 2; a++) line(g, 18, 22, 18 + a * 4, 13, '#d8d0c0');
    R(g, 8, 22, 20, 26, '#2c4c3c'); R(g, 17, 22, 2, 26, '#183424'); R(g, 8, 22, 20, 1, '#3c6c54');
    R(g, 10, 25, 6, 8, '#24324c'); R(g, 20, 25, 6, 8, '#24324c'); P(g, 11, 26, '#7c9cbc'); P(g, 21, 26, '#7c9cbc');
    R(g, 15, 36, 1, 3, '#c8a040'); R(g, 20, 36, 1, 3, '#c8a040');
    // bell + crest
    R(g, 17, 0, 2, 3, '#3c3c3c'); tri(g, 18, 3, 8, 6, '#c8a040'); P(g, 18, 9, '#7c5c18'); R(g, 15, 8, 7, 1, '#a88030');
    R(g, 28, 18, 6, 10, '#5c3c84'); line(g, 29, 26, 32, 19, '#f8d878'); P(g, 32, 18, '#fcfcfc');
  });
  // ---- the administrative district: grand double door, pillars, eagle crest, steps ----
  proc('door_admin', 40, 50, 1, function (g) {
    R(g, 0, 46, 40, 4, '#8c7c84'); R(g, 0, 46, 40, 1, '#b4a4ae'); R(g, 2, 43, 36, 3, '#a09098'); R(g, 2, 43, 36, 1, '#c8b8c0');
    R(g, 2, 8, 6, 35, '#a09098'); R(g, 32, 8, 6, 35, '#a09098'); R(g, 2, 8, 1, 35, '#c8b8c0'); R(g, 7, 8, 1, 35, '#6c5c66'); R(g, 37, 8, 1, 35, '#6c5c66');
    R(g, 1, 6, 38, 3, '#c8b8c0'); tri(g, 20, 0, 38, 7, '#a09098'); tri(g, 20, 2, 30, 4, '#c8b8c0');
    R(g, 9, 12, 22, 31, '#4c1c18'); R(g, 19, 12, 2, 31, '#2c0c0a');
    for (var y = 14; y < 43; y += 9) { R(g, 11, y, 7, 7, '#5c2820'); R(g, 22, y, 7, 7, '#5c2820'); R(g, 11, y, 7, 1, '#7c3c30'); R(g, 22, y, 7, 1, '#7c3c30'); }
    rows(g, 13, 13, ['...yy...yy...', '..yyy...yyy..', 'yyyyyy.yyyyyy', '.yyyyyyyyyyy.', '...yyyyyyy...', '.....yyy.....', '....yyyyy....'], { y: '#c8a040' });
    R(g, 17, 28, 2, 4, '#c8a040'); R(g, 21, 28, 2, 4, '#c8a040');
  });
  // ---- manhole: cover in the street, steam puffs out (2 frames) ----
  proc('manhole', 26, 14, 2, function (g, f) {
    R(g, 1, 9, 24, 5, '#2c2c2c'); R(g, 2, 9, 22, 1, '#7c7c7c'); for (var x = 3; x < 23; x += 3) R(g, x, 10, 2, 3, '#4c4c4c'); R(g, 2, 13, 22, 1, '#1c1c1c');
    R(g, 11, 10, 4, 1, '#9c9c9c');
    var c = 'rgba(200,190,180,0.55)';
    if (f) { blob(g, 9, 5, 3, 2, c); blob(g, 15, 3, 3, 2, c); } else { blob(g, 13, 6, 3, 2, c); blob(g, 17, 2, 2, 1, c); }
  }, false);
  // ---- circus tent flap: striped canvas, dark entrance, flap tied back (sways) ----
  proc('tent_flap', 34, 46, 2, function (g, f) {
    for (var y = 0; y < 46; y++) { var hw = Math.round(4 + y * 0.32); for (var x = -hw; x <= hw; x++) P(g, 17 + x, y, (((x + 40) >> 2) & 1) ? '#a8182c' : '#e8dcc0'); }
    for (y = 14; y < 46; y++) { var ow = Math.round((y - 14) * 0.28); R(g, 17 - ow, y, ow * 2 + 1, 1, '#0c0408'); }
    for (y = 18; y < 46; y += 2) { var w2 = Math.round((y - 14) * 0.28); P(g, 17 - w2 - 1 - f, y, '#e8dcc0'); P(g, 17 + w2 + 1 + f, y, '#a8182c'); }
    R(g, 8 - f, 30, 4, 2, '#c8a040'); R(g, 23 + f, 30, 4, 2, '#c8a040');
    R(g, 16, 0, 2, 3, '#c8a040'); R(g, 3, 44, 28, 2, '#5c0c18');
  });
  // ---- the village gate: timber gate in a log frame, torches either side ----
  proc('gate', 48, 54, 2, function (g, f) {
    R(g, 3, 6, 6, 48, WOOD.d); R(g, 39, 6, 6, 48, WOOD.d); R(g, 4, 6, 2, 48, WOOD.m); R(g, 40, 6, 2, 48, WOOD.m);
    R(g, 0, 6, 48, 6, WOOD.m); R(g, 0, 6, 48, 1, WOOD.h); R(g, 0, 11, 48, 1, WOOD.d); tri(g, 6, 0, 6, 6, WOOD.d); tri(g, 42, 0, 6, 6, WOOD.d);
    R(g, 14, 2, 20, 4, '#a86c30'); R(g, 16, 3, 16, 2, '#5c3010');
    for (var x = 9; x < 39; x += 5) { R(g, x, 12, 4, 42, WOOD.m); R(g, x, 12, 1, 42, WOOD.l); tri(g, x + 2, 9, 4, 3, WOOD.m); }
    R(g, 9, 20, 30, 3, '#2c2c2c'); R(g, 9, 40, 30, 3, '#2c2c2c'); line(g, 10, 42, 37, 22, WOOD.d);
    for (var s = 0; s < 2; s++) { var tx = s ? 45 : 1; R(g, tx, 16, 2, 8, '#2c1c10'); R(g, tx - 1, 13 - f, 4, 4, f ? '#f8b800' : '#f87800'); P(g, tx, 12 - f, '#f8d878'); }
  });
  // ---- Danger Zone trailer lot: a camper trailer with a star on the door ----
  proc('trailer', 64, 36, 1, function (g) {
    R(g, 4, 4, 54, 26, '#bcbcbc'); blob(g, 8, 10, 6, 6, '#bcbcbc'); R(g, 4, 4, 54, 1, '#fcfcfc'); R(g, 4, 16, 54, 3, '#c83c3c'); R(g, 4, 19, 54, 1, '#f8b800');
    R(g, 12, 8, 14, 7, '#24324c'); P(g, 13, 9, '#7c9cbc'); R(g, 44, 8, 10, 6, '#24324c');
    R(g, 30, 8, 10, 21, '#9c9c9c'); R(g, 30, 8, 10, 1, '#dcdcdc'); rows(g, 32, 11, ['...y..', '..yyy.', 'yyyyyy', '.yyyy.', '.y..y.'], { y: '#f8b800' }); P(g, 38, 20, '#2c2c2c');
    R(g, 4, 29, 54, 1, '#5c5c5c'); disc(g, 20, 30, 5, '#2c2c2c'); disc(g, 20, 30, 2, '#9c9c9c'); R(g, 58, 26, 6, 2, '#5c5c5c'); R(g, 31, 30, 8, 4, '#5c5c5c');
  });
  // ---- stairwell down (the Floor 4 stairs): stone kiosk, steps into the dark, glowing sign ----
  proc('stairs_down', 44, 44, 2, function (g, f) {
    R(g, 2, 12, 40, 32, '#4c4c58'); R(g, 4, 8, 36, 4, '#5c5c68'); R(g, 2, 12, 40, 1, '#8c8c98'); R(g, 4, 8, 36, 1, '#8c8c98');
    R(g, 7, 15, 30, 29, '#000000');
    for (var i = 0; i < 6; i++) R(g, 8 + i * 2, 40 - i * 4, 28 - i * 4, 3, ['#7c7c88', '#5c5c68', '#4c4c58', '#3c3c44', '#2c2c34', '#1c1c24'][i]);
    R(g, 14, 0, 16, 7, f ? '#00a800' : '#007800'); R(g, 15, 1, 14, 5, f ? '#58d854' : '#00a800');
    rows(g, 17, 2, ['..w..ww..', '.www.ww..', 'wwwwww...'], { w: f ? '#fcfcfc' : '#b8f818' });
  });
  // ---- alley mouth: a dark passage between two buildings ----
  proc('alley_mouth', 34, 56, 1, function (g) {
    for (var y = 0; y < 56; y++) R(g, 5, y, 24, 1, y < 10 ? '#1c1418' : '#0c080a');
    for (y = 2; y < 56; y += 4) { R(g, 0, y, 6, 1, '#2c1814'); R(g, 28, y, 6, 1, '#2c1814'); }
    R(g, 0, 0, 6, 56, '#4c2c28'); R(g, 28, 0, 6, 56, '#4c2c28'); for (y = 0; y < 56; y += 4) { R(g, 0, y, 6, 1, '#2c1814'); R(g, 28, y, 6, 1, '#2c1814'); P(g, ((y / 4) & 1) ? 3 : 1, y + 2, '#2c1814'); P(g, ((y / 4) & 1) ? 31 : 29, y + 2, '#2c1814'); }
    R(g, 5, 0, 1, 56, '#000000'); R(g, 28, 0, 1, 56, '#000000');
    for (var x = 8; x < 26; x++) P(g, x, 14 + ((x * 3) % 4), '#3c2c34');
    R(g, 8, 44, 8, 12, '#3c2414'); R(g, 8, 44, 8, 1, '#5c3c20'); blob(g, 21, 53, 5, 3, '#24241c'); R(g, 14, 54, 10, 2, '#1c2c3c');
    R(g, 12, 6, 10, 1, '#5c4c3c'); R(g, 13, 7, 3, 5, '#5c4c5c'); R(g, 18, 7, 3, 4, '#3c5c5c');
  });
  // ---- signpost rock: a discoloured stone; signpost_on raises a hologram signpost ----
  function rock(g, ox, oy) {
    blob(g, ox + 12, oy + 8, 10, 6, '#6c6468'); blob(g, ox + 10, oy + 6, 7, 4, '#8c8488'); R(g, ox + 2, oy + 10, 20, 4, '#5c5458');
    P(g, ox + 7, oy + 4, '#bcb4b8'); P(g, ox + 8, oy + 4, '#bcb4b8');
    blob(g, ox + 15, oy + 8, 3, 2, '#3c8c8c'); P(g, ox + 6, oy + 9, '#8c3c9c'); P(g, ox + 7, oy + 10, '#8c3c9c'); P(g, ox + 18, oy + 5, '#3c8c8c'); P(g, ox + 11, oy + 11, '#5c8c3c');
  }
  proc('signpost', 26, 16, 1, function (g) { rock(g, 1, 2); });
  proc('signpost_on', 44, 58, 2, function (g, f) {
    rock(g, 10, 42);
    var c = f ? '#a4e4fc' : '#3cbcfc', d = f ? '#3cbcfc' : '#0078a8';
    g.globalAlpha = 0.85;
    R(g, 21, 6, 2, 38, c);
    for (var b = 0; b < 3; b++) {
      var y = 8 + b * 11, right = b !== 1;
      R(g, right ? 23 : 5, y, 16, 7, d); R(g, right ? 23 : 5, y, 16, 1, c);
      if (right) tri(g, 41, y, 1, 7, d), R(g, 39, y + 1, 2, 5, d); else R(g, 3, y + 1, 2, 5, d);
      for (var k = 0; k < 4; k++) R(g, (right ? 25 : 7) + k * 3, y + 3, 2, 1, c);
    }
    g.globalAlpha = 0.35; R(g, 2, 4, 40, 1, c); g.globalAlpha = 1;
    for (var s = 0; s < 4; s++) P(g, 6 + ((s * 11 + f * 5) % 34), 4 + ((s * 13 + f * 7) % 36), '#fcfcfc');
  }, false);

  /* ---- plant and detonate kit ---- */
  // planted dynamite: three red sticks taped, a blinking light
  proc('charge', 14, 14, 2, function (g, f) {
    for (var i = 0; i < 3; i++) { R(g, 2 + i * 3, 3, 3, 10, '#c81c1c'); R(g, 2 + i * 3, 3, 1, 10, '#f85858'); R(g, 2 + i * 3, 3, 3, 1, '#e8d8b0'); }
    R(g, 1, 6, 11, 2, '#8c8c7c'); R(g, 1, 10, 11, 2, '#8c8c7c');
    R(g, 9, 0, 4, 4, '#2c2c2c'); P(g, 10, 1, f ? '#f83800' : '#5c0c0c'); P(g, 11, 1, f ? '#fcfcfc' : '#5c0c0c');
    line(g, 11, 4, 11, 7, '#3c3c3c');
  });
  // where a charge goes: chalk X + pulsing brackets
  proc('charge_spot', 18, 18, 2, function (g, f) {
    var c = f ? '#f8d878' : '#c8a040';
    line(g, 4, 10, 13, 16, '#e8e8e0'); line(g, 13, 10, 4, 16, '#e8e8e0');
    var o = f ? 0 : 1;
    R(g, 1 + o, 1 + o, 4, 1, c); R(g, 1 + o, 1 + o, 1, 4, c); R(g, 13 - o, 1 + o, 4, 1, c); R(g, 16 - o, 1 + o, 1, 4, c);
    tri(g, 9, 2 + o * 2, 6, 4, c, true);
  });
  // clockwork Mongo decoy: brass wind-up raptor, the key turns
  proc('decoy_mongo', 22, 20, 2, function (g, f) {
    var b = '#c8a040', bl = '#f8d878', bd = '#7c5c18';
    R(g, 4, 8, 12, 6, b); R(g, 4, 8, 12, 1, bl); R(g, 14, 4, 4, 6, b); R(g, 15, 2, 6, 4, b); R(g, 15, 2, 6, 1, bl); P(g, 18, 3, '#2c2c2c'); R(g, 19, 5, 2, 1, bd);
    R(g, 0, 8, 5, 2, b); R(g, 6, 14, 2, 4, bd); R(g, 12, 14, 2, 4, bd); R(g, 5, 18, 4, 1, bd); R(g, 11, 18, 4, 1, bd);
    for (var i = 5; i < 15; i += 3) P(g, i, 11, bd);
    R(g, 8, 4, 2, 4, '#9c9c9c');
    if (f) { R(g, 6, 2, 6, 2, '#bcbcbc'); } else { R(g, 8, 1, 2, 4, '#bcbcbc'); R(g, 7, 2, 4, 1, '#9c9c9c'); }
    P(g, 1, 7, '#f87858'); P(g, 0, 7, '#58a8f8');
  });
  // detonator: a plunger box (frame 1 = pushed)
  proc('detonator', 18, 18, 2, function (g, f) {
    R(g, 2, 9, 14, 8, '#c83c1c'); R(g, 2, 9, 14, 1, '#f87858'); R(g, 2, 16, 14, 1, '#7c1c0c'); R(g, 4, 12, 10, 2, '#f8d878'); rows(g, 5, 12, ['t.n.t', '.....'], { t: '#2c2c2c', n: '#2c2c2c' });
    var top = f ? 6 : 1;
    R(g, 8, top + 1, 2, 9 - top, '#9c9c9c'); R(g, 4, top, 10, 2, '#5c5c5c'); R(g, 4, top, 10, 1, '#9c9c9c');
    R(g, 15, 14, 3, 1, '#3c3c3c'); P(g, 17, 13, '#3c3c3c');
    if (f) { P(g, 1, 4, '#f8d878'); P(g, 16, 3, '#f8d878'); P(g, 2, 2, '#fcfcfc'); }
  });
  // a Krasue's body: limp, headless, slumped where it was left. Bare-chested, sarong, blood.
  proc('krasue_body', 32, 22, 2, function (g, f) {
    var s = '#c89878', sd = '#9c6c50', bl = '#8c0c18', bL = '#c82030';
    blob(g, 16, 20, 14, 2, '#5c0810'); // blood pool
    // legs stretched out to the right, sarong over the hips
    R(g, 14, 15, 14, 3, s); R(g, 14, 17, 14, 1, sd); R(g, 27, 13, 2, 5, s); R(g, 28, 12, 2, 2, s);
    R(g, 8, 13, 10, 6, '#5c2c6c'); R(g, 8, 13, 10, 1, '#7c4c8c'); P(g, 11, 15, '#c8a040'); P(g, 14, 16, '#c8a040'); P(g, 10, 17, '#c8a040');
    // torso leaning back against nothing, arms limp
    R(g, 7, 4, 6, 10, s); R(g, 7, 4, 1, 10, sd); R(g, 12, 6, 1, 8, sd); P(g, 10, 7, sd); P(g, 9, 8, sd);
    R(g, 4, 6, 2, 8, s); R(g, 3, 13, 2, 2, s); R(g, 13, 7, 2, 7, s); R(g, 14, 13, 2, 2, sd);
    // the neck stump: torn, wet, trailing
    R(g, 8, 2, 4, 2, bl); R(g, 9, 1, 2, 1, bL); P(g, 8, 4, bl); P(g, 11, 5, bl); R(g, 9, 4, 1, 3, bL);
    line(g, 10, 1, 13 + f, -1, '#a85050');
    if (f) { P(g, 7, 9, bl); P(g, 7, 10, bl); P(g, 12, 11, bl); } else { P(g, 8, 6, bl); P(g, 12, 8, bl); }
  });
  // trash pile (urchins love it)
  proc('trash', 22, 13, 1, function (g) {
    blob(g, 11, 9, 9, 4, '#3c3c30'); blob(g, 7, 7, 5, 4, '#4c4c3c'); blob(g, 15, 6, 5, 4, '#2c2c34'); P(g, 6, 5, '#6c6c5c'); P(g, 15, 3, '#4c4c5c');
    R(g, 17, 8, 2, 4, '#2c7c3c'); P(g, 17, 7, '#58d854'); R(g, 3, 10, 6, 1, '#d8d0b8'); P(g, 2, 9, '#d8d0b8'); P(g, 9, 9, '#d8d0b8');
    R(g, 11, 4, 3, 2, '#9c9c9c'); P(g, 12, 3, '#bcbcbc');
  });
  // barricade: overturned cart, planks, barrels (survival guard object)
  function barricadeBody(g, broken) {
    if (!broken) {
      R(g, 4, 10, 36, 12, WOOD.m); R(g, 4, 10, 36, 1, WOOD.h); for (var x = 8; x < 40; x += 6) R(g, x, 10, 1, 12, WOOD.d);
      disc(g, 10, 22, 6, WOOD.d); disc(g, 10, 22, 4, WOOD.m); disc(g, 10, 22, 1, '#2c2c2c'); for (var a = 0; a < 4; a++) line(g, 10, 22, 10 + Math.round(Math.cos(a * 0.8) * 5), 22 + Math.round(Math.sin(a * 0.8) * 5), WOOD.d);
      line(g, 2, 26, 30, 2, WOOD.l); line(g, 3, 26, 31, 2, WOOD.d); line(g, 14, 27, 42, 6, WOOD.l); line(g, 15, 27, 43, 6, WOOD.d);
      R(g, 30, 14, 10, 14, '#5c3014'); R(g, 30, 16, 10, 2, '#2c2c2c'); R(g, 30, 24, 10, 2, '#2c2c2c'); R(g, 30, 14, 2, 14, '#7c4418');
      R(g, 18, 22, 12, 6, WOOD.d); R(g, 18, 22, 12, 1, WOOD.l);
    } else {
      line(g, 2, 27, 16, 20, WOOD.l); line(g, 2, 28, 16, 21, WOOD.d); line(g, 26, 27, 42, 23, WOOD.l);
      R(g, 6, 22, 14, 6, WOOD.m); R(g, 6, 22, 14, 1, WOOD.h); rows(g, 6, 19, ['m.m.mm..m.mm.m', 'mmmmmmmmmmmmmm'], { m: WOOD.m });
      disc(g, 32, 24, 4, WOOD.d); disc(g, 32, 24, 2, WOOD.m); R(g, 22, 25, 6, 3, '#5c3014');
      P(g, 12, 15, WOOD.l); P(g, 26, 14, WOOD.l); P(g, 36, 18, WOOD.m);
    }
  }
  proc('barricade', 44, 30, 1, function (g) { barricadeBody(g, false); });
  proc('barricade_broken', 44, 30, 1, function (g) { barricadeBody(g, true); });
  // a Village Guard Swordsman in stasis: full plate, long blade point-down, stasis glow
  proc('guard_statue', 28, 50, 2, function (g, f) {
    var m = '#8c949c', l = '#c8d0d8', d = '#4c545c';
    R(g, 6, 46, 16, 4, '#5c5c64'); R(g, 6, 46, 16, 1, '#8c8c94');
    R(g, 8, 30, 5, 16, m); R(g, 15, 30, 5, 16, m); R(g, 8, 30, 1, 16, l); R(g, 12, 30, 1, 16, d); R(g, 7, 43, 7, 3, d); R(g, 14, 43, 7, 3, d);
    R(g, 6, 14, 16, 17, m); R(g, 6, 14, 2, 17, l); R(g, 19, 14, 3, 17, d); R(g, 7, 22, 14, 2, d); R(g, 3, 12, 6, 6, m); R(g, 19, 12, 6, 6, m); R(g, 3, 12, 6, 1, l); R(g, 19, 12, 6, 1, l);
    R(g, 9, 3, 10, 11, m); R(g, 9, 3, 10, 2, l); R(g, 10, 7, 8, 2, '#141418'); R(g, 13, 9, 2, 3, d); R(g, 13, 0, 2, 4, '#a81c1c');
    R(g, 3, 18, 4, 14, m); R(g, 21, 18, 4, 14, m);
    R(g, 13, 28, 2, 4, '#5c3c18'); R(g, 9, 32, 10, 2, '#c8a040'); R(g, 13, 34, 2, 14, l); R(g, 14, 34, 1, 14, m); // the blade, point down
    if (f) { g.globalAlpha = 0.35; R(g, 2, 1, 24, 46, '#58b8f8'); g.globalAlpha = 1; }
    else { P(g, 2, 10, '#a4e4fc'); P(g, 25, 26, '#a4e4fc'); P(g, 5, 40, '#a4e4fc'); }
  });
  // Big Top tent pole: tall barber stripes; frames 0-3 = intact, cracked, splitting, about to snap
  proc('tent_pole', 24, 120, 4, function (g, f) {
    R(g, 2, 112, 20, 8, '#5c5c64'); R(g, 2, 112, 20, 1, '#9c9ca4'); R(g, 4, 108, 16, 4, '#7c7c84'); R(g, 4, 108, 16, 1, '#9c9ca4');
    var lean = f >= 3 ? 1 : 0;
    for (var y = 10; y < 108; y++) {
      var off = lean && y < 60 ? Math.round((60 - y) / 25) : 0;
      for (var x = 6; x < 18; x++) P(g, x + off, y, (((x + y * 0.6) | 0) >> 2) & 1 ? '#c81c2c' : '#e8dcc0');
      P(g, 6 + off, y, '#fcfcfc'); P(g, 17 + off, y, '#5c0c14'); P(g, 16 + off, y, (((16 + y * 0.6) | 0) >> 2) & 1 ? '#8c1020' : '#b0a488');
    }
    var o2 = lean ? 2 : 0;
    R(g, 4 + o2, 4, 16, 6, '#c8a040'); R(g, 4 + o2, 4, 16, 1, '#f8d878'); R(g, 4 + o2, 9, 16, 1, '#7c5c18'); R(g, 11 + o2, 0, 2, 4, '#7c7c84'); R(g, 13 + o2, 0, 7, 3, '#a8182c');
    R(g, 5, 60, 14, 3, '#c8a040'); R(g, 5, 60, 14, 1, '#f8d878');
    var K2 = '#1c0404';
    if (f >= 1) { line(g, 8, 38, 14, 50, K2); line(g, 14, 50, 10, 58, K2); line(g, 15, 72, 9, 84, K2); P(g, 13, 45, K2); }
    if (f >= 2) { line(g, 7, 64, 16, 70, K2); line(g, 16, 70, 8, 78, K2); line(g, 9, 24, 15, 34, K2); R(g, 18, 66, 3, 1, '#e8dcc0'); P(g, 4, 74, '#c81c2c'); P(g, 19, 62, '#e8dcc0'); }
    if (f >= 3) { R(g, 6, 66, 12, 2, K2); line(g, 6, 88, 17, 96, K2); R(g, 19, 64, 4, 1, '#e8dcc0'); R(g, 1, 69, 4, 1, '#c81c2c'); P(g, 21, 60, '#e8dcc0'); P(g, 2, 74, '#e8dcc0'); P(g, 20, 70, '#c81c2c'); }
  });
  // the Fireball-or-Custard scratch ticket
  proc('scratch_ticket', 16, 12, 2, function (g, f) {
    R(g, 1, 1, 14, 10, '#f8d878'); R(g, 1, 1, 14, 1, '#fce0a8'); R(g, 1, 10, 14, 1, '#c8a040');
    R(g, 3, 3, 4, 3, '#f83800'); P(g, 4, 2, '#f8b800'); R(g, 9, 3, 4, 3, '#f8d878'); R(g, 9, 5, 4, 1, '#c88c30'); R(g, 8, 3, 1, 3, '#e8e0d0');
    R(g, 3, 7, 10, 2, '#9c9ca4'); P(g, 3 + f * 6, 7, '#fcfcfc'); P(g, 4 + f * 6, 8, '#fcfcfc');
  });
  // a dish of custard
  proc('custard', 14, 12, 2, function (g, f) {
    R(g, 2, 7, 10, 3, '#a4e4fc'); R(g, 3, 10, 8, 1, '#6cb4d4'); R(g, 4, 11, 6, 1, '#a4e4fc');
    blob(g, 7, 5 + (f ? 0 : 1), 4, 2, '#f8d878'); R(g, 3, 6, 8, 2, '#f8d878'); R(g, 5, 3 + (f ? 0 : 1), 4, 1, '#c87c30'); P(g, 5, 5, '#fce0a8');
  });
  // ring junk Carl throws into the screen: 0 bottle, 1 shoe, 2 pie, 3 juggling pin
  proc('ring_junk', 12, 12, 4, function (g, f) {
    if (f === 0) { R(g, 5, 0, 2, 3, '#3c8c3c'); R(g, 4, 3, 4, 8, '#2c7c3c'); R(g, 4, 3, 1, 8, '#58d854'); R(g, 4, 6, 4, 3, '#e8d8b0'); P(g, 5, 7, '#c81c2c'); R(g, 5, 0, 2, 1, '#a87c48'); }
    else if (f === 1) { R(g, 1, 6, 6, 4, '#7c4418'); R(g, 6, 7, 5, 3, '#7c4418'); R(g, 1, 10, 10, 1, '#2c1c10'); R(g, 1, 6, 6, 1, '#a86c30'); P(g, 8, 7, '#e8d8b0'); P(g, 9, 8, '#e8d8b0'); R(g, 2, 4, 4, 2, '#5c3010'); }
    else if (f === 2) { R(g, 1, 7, 10, 3, '#c8a070'); R(g, 0, 8, 12, 1, '#a87c48'); blob(g, 6, 6, 4, 2, '#fcfcfc'); P(g, 6, 3, '#e40058'); P(g, 4, 6, '#e8e8e8'); R(g, 2, 9, 8, 1, '#7c5c30'); }
    else { R(g, 5, 1, 2, 2, '#e40058'); R(g, 4, 3, 4, 4, '#fcfcfc'); R(g, 4, 5, 4, 1, '#e40058'); R(g, 5, 7, 2, 4, '#fcfcfc'); P(g, 5, 4, '#bcbcbc'); R(g, 4, 10, 4, 1, '#e40058'); }
  });
  // fire strip (the Jug O'Boom aftermath), 3 frames
  proc('fire', 16, 18, 3, function (g, f) {
    var hs = [[9, 12, 8, 13], [12, 8, 13, 9], [8, 13, 10, 12]][f];
    for (var i = 0; i < 4; i++) {
      var x = 1 + i * 4, h = hs[i];
      R(g, x, 18 - h, 3, h, '#c83810'); R(g, x + 1, 18 - h - 1, 1, 1, '#c83810');
      R(g, x + 1, 18 - Math.round(h * 0.7), 1, Math.round(h * 0.7), '#f8a040'); R(g, x, 15, 3, 3, '#f8d878');
    }
    P(g, 3 + f * 4, 2 + f, '#f8a040');
  }, { outline: '#881400' });
  // a City Elf darkness orb (2 frames swirl)
  proc('darkness_orb', 22, 22, 2, function (g, f) {
    disc(g, 11, 11, 9, '#2c0c4c'); disc(g, 11, 11, 7, '#08040c');
    for (var k = 0; k < 3; k++) { var a = f * 0.6 + k * 2.1; for (var t = 0; t < 6; t++) P(g, 11 + Math.round(Math.cos(a + t * 0.25) * (3 + t)), 11 + Math.round(Math.sin(a + t * 0.25) * (3 + t)), '#6c28a8'); }
    P(g, 7, 6, '#b858f8'); P(g, 15 - f, 16, '#b858f8');
  }, { outline: '#000000' });
  // padlock badge for locked doors
  pix('lock', { s: '#bcbcbc', S: '#7c7c7c', y: '#f8b800', Y: '#f8d878', o: '#ac7c00', k: '#000000' }, [[
    '..ssss..', '.s....S.', '.s....S.', 'YYYYYYYo', 'Yyyyyyyo', 'Yyykkyyo', 'Yyykkyyo', 'Yyyykyyo', 'yooooooo']]);

  /* ---- book 2 projectiles ---- */
  proc('worm', 12, 6, 2, function (g, f) { // parasite worm, wriggling
    for (var x = 1; x < 11; x++) { var y = 2 + Math.round(Math.sin(x * 0.9 + f * 2) * 1.2); R(g, x, y, 1, 2, x > 8 ? '#fcfcfc' : (x & 1 ? '#e8e0c8' : '#c8c0a8')); }
    P(g, 10, 2 + Math.round(Math.sin(9 + f * 2) * 1.2), '#8c1c1c');
  }, { outline: '#2c2418' });
  proc('spit', 10, 10, 2, function (g, f) { // a glob of acid spit
    disc(g, 5, 5, 3 + f, '#58a000'); disc(g, 5, 5, 2, '#a8d838'); P(g, 4, 3, '#e0f8a0'); if (f) { P(g, 1, 8, '#58a000'); P(g, 9, 2, '#a8d838'); }
  }, { outline: '#1c3c00' });
  proc('dyn_stick', 14, 8, 2, function (g, f) { // goblin dynamite, lit
    R(g, 1, 3, 9, 4, '#c81c1c'); R(g, 1, 3, 9, 1, '#f85858'); R(g, 1, 3, 1, 4, '#e8d8b0'); R(g, 9, 3, 1, 4, '#e8d8b0');
    R(g, 10, 4, 2, 1, '#8c7c5c'); P(g, 12, 3 + f, '#f8d878'); P(g, 13, 2 + f * 2, '#fcfcfc'); P(g, 11, 2 - f + 1, '#f8a040');
  });
  proc('hob', 9, 9, 2, function (g, f) { // Hob-Lobber: smaller than a baseball, fused
    disc(g, 4, 5, 3, '#4c5c2c'); P(g, 3, 4, '#8c9c58'); P(g, 2, 5, '#6c7c40'); R(g, 4, 1, 1, 2, '#8c7c5c'); P(g, 5 - f, 0, '#f8d878'); P(g, 5, 0, f ? '#fcfcfc' : '#f8a040');
  });
  proc('jug', 12, 14, 2, function (g, f) { // Carl's Jug O'Boom: moonshine jug, burning rag
    blob(g, 6, 9, 4, 4, '#a87c48'); R(g, 3, 6, 6, 6, '#a87c48'); R(g, 4, 4, 4, 2, '#c89c60'); R(g, 3, 8, 6, 2, '#5c3c20'); P(g, 4, 9, '#e8d8b0'); P(g, 7, 9, '#e8d8b0'); P(g, 9, 6, '#d8b878');
    R(g, 5, 2, 2, 2, '#e8e0d0'); R(g, 5 - f, 0, 2, 2, '#f8a040'); P(g, 6, 0, '#f8d878'); P(g, 7 + f, 1, '#f83800');
  });
  proc('psionic', 18, 18, 3, function (g, f) { // Brain Boiler pulse ring
    var r0 = 3 + f * 3;
    ring(g, 9, 9, r0, '#d878f8'); ring(g, 9, 9, r0 - 1, '#9838d8');
    if (f < 2) disc(g, 9, 9, 1, '#f8d8f8');
  }, false);
  proc('smoke_bomb', 10, 10, 2, function (g, f) {
    disc(g, 5, 6, 3, '#5c5c64'); P(g, 4, 5, '#9c9ca4'); R(g, 4, 1, 2, 2, '#3c3c3c'); P(g, 7, 1 + f, '#bcbcbc'); P(g, 8, f, '#9c9c9c');
  });
  // a big detonation (plant levels, the Divider's corpse, the depot): 64x64, 5 frames
  proc('blast', 64, 64, 5, function (g, f) {
    var r = rng(77 + f);
    if (f === 0) { noisyDisc(g, 32, 34, 12, '#fca044', r, 3); noisyDisc(g, 32, 34, 8, '#f8d878', r, 2); disc(g, 32, 34, 5, '#fcfcfc'); return; }
    if (f === 1) { noisyDisc(g, 32, 32, 26, '#f83800', r, 5); noisyDisc(g, 32, 32, 21, '#fca044', r, 5); noisyDisc(g, 32, 32, 14, '#f8d878', r, 3); disc(g, 32, 32, 8, '#fcfcfc'); return; }
    if (f === 2) { noisyDisc(g, 32, 30, 30, '#a81000', r, 6); noisyDisc(g, 32, 30, 25, '#f83800', r, 6); noisyDisc(g, 32, 28, 17, '#fca044', r, 5); noisyDisc(g, 32, 26, 8, '#f8d878', r, 3); for (var i = 0; i < 14; i++) { var a = r() * 6.28; P(g, 32 + Math.round(Math.cos(a) * 30), 32 + Math.round(Math.sin(a) * 30), '#f8d878'); } return; }
    if (f === 3) { noisyDisc(g, 32, 26, 28, '#3c3c3c', r, 8); noisyDisc(g, 32, 28, 21, '#a81000', r, 8); noisyDisc(g, 31, 30, 12, '#f83800', r, 6); return; }
    for (i = 0; i < 14; i++) { var px = 10 + ((r() * 44) | 0), py = 6 + ((r() * 40) | 0); disc(g, px, py, 3 + ((r() * 5) | 0), i & 1 ? '#3c3c3c' : '#5c5c5c'); }
    for (i = 0; i < 6; i++) P(g, 8 + ((r() * 48) | 0), 8 + ((r() * 48) | 0), '#f83800');
  }, false);

  /* ---- book 2 key items (16x16, glowing) ---- */
  qiItem('qi_ticket', { r: '#c81c2c', R: '#f85858', y: '#f8d878', Y: '#fce0a8', o: '#ac7c00', w: '#fcfcfc', k: '#5c0c14' }, [ // the Big Top Ticket
    'rrrrrrrrrrrrr',
    'rYYYYYYYYYYYr',
    'rYkk.ykk.kkYr',
    'rYk..yk..kYYr',
    'rYkk.yk..kYYr',
    'rYYYYYYYYYYYr',
    'rYy.yyy.y.yYr',
    'rYYYYYYYYYYYr',
    'rrrrrrrrrrrrr'
  ]);
  qiItem('qi_letter', { p: '#f0e8d8', P: '#c8c0a8', d: '#8c8070', r: '#c81c2c', R: '#f85858' }, [
    'ppppppppppppp',
    'pPppppppppPPp',
    'ppPPppppPPPpp',
    'pppPPpPPPpppp',
    'ppppPrRPppppp',
    'pppppRrpppppp',
    'ppppppppppppp',
    'ddddddddddddd'
  ], '#fce0a8');
  qiItem('qi_pass', qpal({ p: '#e8d8b0', P: '#c8b890', b: '#2858a8', r: '#c81c2c' }), [ // gate pass: a sealed writ
    '.pppppppppp.',
    'pPppppppppPp',
    'pbbbbbbbbbbp',
    'pppppppppppp',
    'pPPPPPPPPppp',
    'ppppppppPPPp',
    'pPPPPppprrpp',
    'ppppppprrrrp',
    '.ppppppprr..',
    '........r.r.'
  ]);
  qiItem('qi_ring', qpal({ r: '#c81c2c', R: '#f85858' }), [ // +2 STR ring
    '....rRr....',
    '...rrRrr...',
    '....yyy....',
    '..yy...yy..',
    '.yY.....yo.',
    '.y.......o.',
    '.y.......o.',
    '..yo...oo..',
    '...ooooo...'
  ]);
  qiItem('qi_anklet', qpal({ b: '#3cbcfc', g: '#58d854' }), [
    '..y.y.y.y..',
    '.y.......y.',
    'y.........y',
    'y.........y',
    '.y.......y.',
    '..y.y.y.y..',
    '....b.g....',
    '....b.g....',
    '.....b.....'
  ]);
  qiItem('qi_case', { k: '#2c2c34', K: '#5c5c68', g: '#a4e4fc', G: '#d8f4fc', c: '#d878f8', C: '#f8d8f8', y: '#c8a040' }, [ // Sheol Glass Reaper Case
    'KKKKKKKKKKKK',
    'KgGggggggggK',
    'Kg...cc...gK',
    'Kg..cCCc..gK',
    'Kg..cCCc..gK',
    'Kg...cc...gK',
    'KgggggggggGK',
    'kkkkkkkkkkkk',
    'k.y......y.k',
    'kkkkkkkkkkkk'
  ], '#d878f8');
  qiItem('qi_crystal', { c: '#40d0f0', C: '#c8f8fc', d: '#1880b0', D: '#0c4c6c', w: '#fcfcfc' }, [ // soul crystal
    '.....C.....',
    '....CCc....',
    '...CCccd...',
    '..Cwcccdd..',
    '.CCccccddd.',
    '.Ccccccddd.',
    '..ccccddD..',
    '...ccddD...',
    '....cdD....',
    '.....D.....'
  ], '#a4f0fc');
  qiItem('qi_moonshine', { j: '#a87c48', J: '#c89c60', d: '#5c3c20', w: '#e8e0d0', k: '#2c1c10', x: '#c81c2c' }, [
    '....ww.....',
    '....dd.....',
    '...jJJj....',
    '..jJJjjj...',
    '.jJjjjjjjj.',
    '.jJxkxkxjj.',
    '.jJjxjxjjj.',
    '.jjxkxkxjd.',
    '..jjjjjjd..',
    '...dddddd..'
  ]);
  qiItem('qi_custard', { y: '#f8d878', Y: '#fce0a8', o: '#c87c30', g: '#a4e4fc', G: '#6cb4d4', s: '#bcbcbc' }, [
    '........s..',
    '.......s...',
    '...oooso...',
    '..oYYYsYo..',
    '.yYYyyyyyy.',
    '.yyyyyyyyy.',
    'gGggggggggg',
    '.ggggggggg.',
    '..GGGGGGG..'
  ]);
  qiItem('qi_scroll', { p: '#e8d8b0', P: '#c8b890', d: '#8c7858', r: '#c81c2c', s: '#9c9c9c' }, [ // scroll of Meat Hooks
    '.dPPPPPPPd.',
    'dpPPPPPPPpd',
    '.pppppppp..',
    '.ps.ssspp..',
    '.pps..pp...',
    '.pspps.p...',
    '.prrrrrpp..',
    'dpPrrPPPpd.',
    '.dPPPPPPPd.'
  ]);
  qiItem('qi_carrier', { b: '#c83c3c', B: '#f87858', d: '#7c1c1c', s: '#bcbcbc', S: '#7c7c7c', k: '#2c2c2c' }, [ // the pet carrier Mongo hates
    '...ssssss...',
    '...s....s...',
    'bbbbbbbbbbbb',
    'bBBBBBBBBBBb',
    'bBs.s.s.sBdb',
    'bBs.s.s.sBdb',
    'bBs.s.s.sBdb',
    'bBBBBBBBBBdb',
    'dddddddddddd'
  ]);
  qiItem('qi_caps', { w: '#fcfcfc', W: '#d8d8d8', r: '#e40058', b: '#0058f8', y: '#f8b800', g: '#00a844' }, [ // Fang Caps (Lego-ish)
    'r.r.b.b.y.y.',
    'rrr.bbb.yyy.',
    'www.www.www.',
    'wWw.wWw.wWw.',
    '.w...w...w..',
    '.w...w...w..',
    '....g.g.....',
    '....ggg.....',
    '....www.....',
    '.....w......'
  ], '#fcfcfc');

  /* ---- book 2 HUD icons (8x8) ---- */
  IP.j = '#a87c48'; IP.J = '#d8b878'; IP.h = '#4c5c2c'; IP.H = '#8c9c58'; IP.m = '#5c5c64'; IP.M = '#9c9ca4'; IP.v = '#2858a8'; IP.V = '#58a8f8'; IP.q = '#c8a070'; IP.Q = '#e8d8b0'; IP.x = '#58d854'; IP.z = '#2c7c3c';
  icon('sun', ['f..f..f.', '..kkk...', '.kYffk..', 'fkfffkf.', '.kfffk..', '..kkk...', 'f..f..f.', '........']);
  icon('moon', ['..kkk...', '.kYYk...', 'kYYk....', 'kYYk....', 'kYYYk...', '.kYYYkk.', '..kkkk..', '........']);
  icon('jug', ['..kYk...', '..kfk...', '.kjJjk..', 'kjJjjjk.', 'kjrkrjk.', 'kjjjjjk.', '.kkkkk..', '........']);
  icon('hob', ['....Yk..', '...kok..', '..kkk...', '.khHhk..', 'khHhhhk.', 'khhhhhk.', '.kkkkk..', '........']);
  icon('dyn', ['......Y.', '.....kY.', 'kkkkkk..', 'kRrrrrk.', 'kwrrrwk.', 'kRrrrrk.', 'kkkkkkk.', '........']);
  icon('smoke', ['..kkk...', '.kMMMkk.', 'kMMMMMMk', 'kMmMMmMk', '.kmmmmk.', '..kkkk..', '........', '........']);
  icon('clock', ['..kkk...', '.kwkwk..', 'kwwkwwk.', 'kwwkkwk.', 'kwwwwwk.', '.kwwwk..', '..kkk...', '........']);
  icon('map', ['kkkkkkk.', 'kQqQQqk.', 'kQrQqQk.', 'kqQrQQk.', 'kQQQrxk.', 'kqQQQqk.', 'kkkkkkk.', '........']);
  icon('donut', ['k.....k.', 'kk.y.kk.', 'kqkykqk.', 'kQqqqQk.', 'kYkqkYk.', 'kQqrqQk.', '.kQQQk..', '..kkk...']);
  icon('mongo', ['.kkkk...', 'kPPPPk..', 'kPkPPPk.', 'kPPPPrk.', '.kVVk...', 'kVVVVk..', 'kVkkVk..', 'kk..kk..']);
  icon('katia', ['.kkkk...', 'kYYYYk..', 'kYqqYk..', 'kqkqqk..', 'kqqqqk..', '.kvvk...', 'kvvvvk..', 'kkkkkk..']);

  // unknown loot tiers from data.js get a box tinted with boxColor(tier)
  function autoBox(tier) {
    if (!TIERS[tier]) { var b = art.boxColor(tier); TIERS[tier] = { b: b, l: mix(b, '#fcfcfc', 0.45), d: dk(b, 0.45), r: '#f8d878' }; }
    return { w: 17, h: 16, frames: 4, outline: K, draw: function (g, f) { drawBox(g, f, tier); } };
  }

  art.init = function () {
    var names = art.names();
    for (var i = 0; i < names.length; i++) if (!cache[names[i]]) get(names[i]);
  };
})();

/* ============================================================
   DCW ROOMS (book 2, scenes owner) - the into-the-screen room mode.
   The Big Top: Carl seen from behind at the bottom of the screen,
   three rings with a tent pole each on the back wall, then
   Grimaldi's vine in the center ring with a POISON meter.
   Contract: ../DESIGN.md section 9. Everything external is
   feature-detected; missing art falls back to local pixel procs.
   DCW.rooms = { init(), scene, state, debugClear(), debugGod() }
   ============================================================ */
(function () {
  'use strict';
  var DCW = window.DCW = window.DCW || {};
  var W = 320, H = 180;

  /* ---------------- plumbing ---------------- */
  function D() { return DCW.data || {}; }
  function gfn(name) { return !!(DCW.game && typeof DCW.game[name] === 'function'); }
  function gcall(name) {
    if (!gfn(name)) return undefined;
    try { return DCW.game[name].apply(DCW.game, [].slice.call(arguments, 1)); } catch (e) { console.error('[rooms] game.' + name, e); return undefined; }
  }
  function ufn(name) { return !!(DCW.ui && typeof DCW.ui[name] === 'function'); }
  function ucall(name) {
    if (!ufn(name)) return undefined;
    try { return DCW.ui[name].apply(DCW.ui, [].slice.call(arguments, 1)); } catch (e) { console.error('[rooms] ui.' + name, e); return undefined; }
  }
  function sfx(n, o) { try { if (DCW.audio && DCW.audio.sfx) DCW.audio.sfx(n, o); } catch (e) { /* optional */ } }
  function music(t) { try { if (DCW.audio && DCW.audio.music) DCW.audio.music(t); } catch (e) { /* optional */ } }
  function inp() { return DCW.input || { pressed: function () { return false; }, down: function () { return false; } }; }
  function P(b) { return inp().pressed(b); }
  function Dn(b) { return inp().down(b); }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function rand(a, b) { return a + Math.random() * (b - a); }
  function randi(a, b) { return a + Math.floor(Math.random() * (b - a + 1)); }
  function pick(a) { return a && a.length ? a[Math.floor(Math.random() * a.length)] : null; }
  function num(v, d) { return typeof v === 'number' && isFinite(v) ? v : d; }
  function weighted(pairs) {
    var tot = 0, i; for (i = 0; i < pairs.length; i++) tot += Math.max(0, num(pairs[i][1], 1));
    var r = Math.random() * tot;
    for (i = 0; i < pairs.length; i++) { r -= Math.max(0, num(pairs[i][1], 1)); if (r <= 0) return pairs[i][0]; }
    return pairs[pairs.length - 1][0];
  }

  var LOCAL_RUN = null;
  function run() {
    var r = null;
    try { r = DCW.game ? DCW.game.run : null; } catch (e) { r = null; }
    if (!r && DCW.save && DCW.save.run) r = DCW.save.run;
    if (!r) {
      if (!LOCAL_RUN) LOCAL_RUN = { hp: 20, level: 15, xp: 0, gold: 0, views: 0, potions: 2, items: { jug: 3, hob: 2, dyn: 1, smoke: 1 }, selected: 'jug', flags: {}, stats: { str: 5, con: 4, dex: 4, int: 4 } };
      r = LOCAL_RUN;
    }
    if (!r.items) r.items = {};
    return r;
  }
  function stats() {
    var s = gcall('playerStats');
    if (s && typeof s === 'object') return s;
    var r = run(), L = Math.max(1, (r.level || 13) - 12);
    return { maxHp: 16 + (L - 1) * 2, dmg: 3 + Math.floor((L - 1) / 2), crit: 0.05, speedMul: 1, def: 0,
      hobDmg: 10 + L * 2, dynDmg: 22 + L * 3, jugDmg: 8 + L * 2, missileDmg: 3 + Math.floor((L - 1) / 2), biteDmg: 2 + L };
  }
  function itemCount(id) {
    var c = gcall('itemCount', id);
    if (typeof c === 'number') return c;
    return run().items[id] || 0;
  }
  function useItem(id) {
    if (gfn('useItem')) return !!gcall('useItem', id, 1);
    var r = run(); if ((r.items[id] || 0) <= 0) return false; r.items[id]--; return true;
  }
  function party() {
    var p = gcall('party');
    return Array.isArray(p) ? p : ['donut', 'mongo'];
  }
  function flag(n) { var f = gcall('flag', n); if (typeof f === 'boolean') return f; var r = run(); return !!(r.flags && r.flags[n]); }
  function track(ev, n) { gcall('track', ev, n); }
  function xpNeed(level) { var v = gcall('xpNeed', level); if (typeof v === 'number' && v > 0) return v; var L = Math.max(1, (level || 13) - 12); return Math.round(25 * Math.pow(L, 1.5)); }

  /* ================================================================
     FALLBACK PIXEL KIT (only used when DCW.art lacks a sprite)
     Procs draw into a w x h cell per frame; a 1px black outline is
     added automatically. Anchor = bottom-center, like DCW.art.sprite.
     ================================================================ */
  var FB = {};
  function R(g, x, y, w, h, c) { g.fillStyle = c; g.fillRect(x, y, w, h); }
  function PX(g, x, y, c) { g.fillStyle = c; g.fillRect(x, y, 1, 1); }
  function disc(g, cx, cy, r, c) { g.fillStyle = c; for (var y = -r; y <= r; y++) { var w = Math.floor(Math.sqrt(r * r - y * y) + 0.35); g.fillRect(cx - w, cy + y, w * 2 + 1, 1); } }
  function ell(g, cx, cy, rx, ry, c) { g.fillStyle = c; for (var y = -ry; y <= ry; y++) { var w = Math.floor(rx * Math.sqrt(Math.max(0, 1 - (y * y) / (ry * ry))) + 0.35); g.fillRect(cx - w, cy + y, w * 2 + 1, 1); } }
  function defProc(name, w, h, n, draw, opts) { FB[name] = { w: w, h: h, n: n, draw: draw, outline: !(opts && opts.outline === false), v: [] }; }
  function mk(w, h) { var c = document.createElement('canvas'); c.width = Math.max(1, w); c.height = Math.max(1, h); var g = c.getContext('2d'); g.imageSmoothingEnabled = false; return c; }
  function outline(cv, fw, fh, n) {
    var g = cv.getContext('2d'), Wd = cv.width, Ht = cv.height;
    var img = g.getImageData(0, 0, Wd, Ht), d = img.data, src = new Uint8Array(Wd * Ht), i, x, y;
    for (i = 0; i < Wd * Ht; i++) src[i] = d[i * 4 + 3] > 0 ? 1 : 0;
    for (var f = 0; f < n; f++) for (y = 0; y < fh; y++) for (x = 0; x < fw; x++) {
      i = y * Wd + f * fw + x; if (src[i]) continue;
      if ((x > 0 && src[i - 1]) || (x < fw - 1 && src[i + 1]) || (y > 0 && src[i - Wd]) || (y < fh - 1 && src[i + Wd])) { d[i * 4] = 0; d[i * 4 + 1] = 0; d[i * 4 + 2] = 0; d[i * 4 + 3] = 255; }
    }
    g.putImageData(img, 0, 0);
  }
  function fbBuild(e) {
    var cv = mk(e.w * e.n, e.h), g = cv.getContext('2d');
    for (var f = 0; f < e.n; f++) {
      g.save(); g.translate(f * e.w, 0); g.beginPath(); g.rect(0, 0, e.w, e.h); g.clip();
      try { e.draw(g, f); } catch (er) { R(g, 0, 0, e.w, e.h, '#ff00ff'); }
      g.restore();
    }
    if (e.outline) outline(cv, e.w, e.h, e.n);
    e.v[0] = cv;
  }
  function fbVariant(e, idx) {
    if (!e.v[0]) fbBuild(e);
    if (e.v[idx]) return e.v[idx];
    var src = (idx & 1) ? null : e.v[0], cv, g, i;
    if (idx & 1) { // flipped strip
      var base = e.v[0]; cv = mk(base.width, base.height); g = cv.getContext('2d');
      for (i = 0; i < e.n; i++) { g.save(); g.translate((i + 1) * e.w, 0); g.scale(-1, 1); g.drawImage(base, i * e.w, 0, e.w, e.h, 0, 0, e.w, e.h); g.restore(); }
      src = cv;
      if (!(idx & 2)) { e.v[idx] = cv; return cv; }
    }
    cv = mk(src.width, src.height); g = cv.getContext('2d');
    g.drawImage(src, 0, 0); g.globalCompositeOperation = 'source-in'; g.fillStyle = '#fcfcfc'; g.fillRect(0, 0, cv.width, cv.height);
    e.v[idx] = cv; return cv;
  }
  function fbDraw(ctx, name, x, y, o) {
    var e = FB[name]; if (!e) return false;
    o = o || {};
    var idx = (o.flip ? 1 : 0) | (o.flash ? 2 : 0), img = fbVariant(e, idx);
    var fr = ((o.frame | 0) % e.n + e.n) % e.n, sc = o.scale || 1;
    var w = Math.round(e.w * sc), h = Math.round(e.h * sc);
    var pa = ctx.globalAlpha; if (o.alpha !== undefined) ctx.globalAlpha = pa * o.alpha;
    ctx.drawImage(img, fr * e.w, 0, e.w, e.h, Math.round(x - w / 2), Math.round(y - h), w, h);
    ctx.globalAlpha = pa;
    return true;
  }
  function artHas(name) { try { return !!(DCW.art && DCW.art.has && DCW.art.has(name)); } catch (e) { return false; } }
  // draw a sprite: art first, then the fallback proc, then alternates
  function spr(ctx, name, x, y, o) {
    if (artHas(name)) { try { DCW.art.sprite(ctx, name, x, y, o); return true; } catch (e) { /* fall through */ } }
    if (FB[name]) return fbDraw(ctx, name, x, y, o);
    var alt = o && o.alt;
    if (alt) for (var i = 0; i < alt.length; i++) { if (artHas(alt[i])) { DCW.art.sprite(ctx, alt[i], x, y, o); return true; } if (FB[alt[i]]) return fbDraw(ctx, alt[i], x, y, o); }
    return false;
  }
  function sprInfo(name) {
    if (artHas(name)) { try { var i = DCW.art.info(name); if (i && !i.missing) return i; } catch (e) { /* ignore */ } }
    var e = FB[name]; return e ? { w: e.w, h: e.h, frames: e.n } : null;
  }
  function anySprite(names) { for (var i = 0; i < names.length; i++) if (artHas(names[i]) || FB[names[i]]) return names[i]; return null; }

  /* ---------------- fallback art: Carl from behind ---------------- */
  var CP = { hair: '#503000', hairL: '#881400', skin: '#fce0a8', skinS: '#fca044', cloak: '#004058', cloakS: '#000000', cloakL: '#008888',
    jacket: '#881400', jacketS: '#503000', box: '#fcfcfc', heart: '#f83800', gaunt: '#bcbcbc', gauntS: '#7c7c7c', gold: '#f8b800' };
  function carlBack(g, o) {
    var b = o.bob || 0, cr = o.crouch ? 7 : 0, by = b + cr;
    // legs + bare glittery feet
    if (!o.crouch) {
      var lL = o.legL || 0, lR = o.legR || 0;
      R(g, 5, 22 + by, 3, 6 - lL - by, CP.skin); R(g, 12, 22 + by, 3, 6 - lR - by, CP.skin);
      R(g, 7, 23 + by, 1, 4 - lL - by, CP.skinS); R(g, 14, 23 + by, 1, 4 - lR - by, CP.skinS);
      R(g, 4, 28 - lL, 4, 2, CP.skin); R(g, 12, 28 - lR, 4, 2, CP.skin);
      PX(g, 5, 28 - lL, '#f8f8f8'); PX(g, 14, 28 - lR, '#f8f8f8');
      R(g, 4, 29 - lL, 4, 1, CP.skinS); R(g, 12, 29 - lR, 4, 1, CP.skinS);
    } else {
      R(g, 3, 27, 5, 3, CP.skin); R(g, 12, 27, 5, 3, CP.skin); R(g, 3, 29, 5, 1, CP.skinS); R(g, 12, 29, 5, 1, CP.skinS);
    }
    // boxers (white, red hearts)
    R(g, 4, 18 + by, 12, 5, CP.box);
    PX(g, 6, 19 + by, CP.heart); PX(g, 10, 21 + by, CP.heart); PX(g, 13, 19 + by, CP.heart); PX(g, 8, 20 + by, CP.heart);
    R(g, 9, 19 + by, 1, 4, '#bcbcbc');
    // cloak over the jacket
    R(g, 4, 8 + by, 12, 2, CP.cloak);
    R(g, 3, 9 + by, 14, 7, CP.cloak);
    R(g, 2, 15 + by, 16, 4, CP.cloak);
    R(g, 7, 11 + by, 1, 7, CP.cloakS); R(g, 12, 11 + by, 1, 7, CP.cloakS);
    R(g, 4, 9 + by, 1, 9, CP.cloakL);
    R(g, 6, 8 + by, 8, 1, CP.jacket);
    // left arm: leather sleeve
    var aL = o.armL || 0;
    if (o.armLOut) { R(g, 0, 7 + by, 3, 6, CP.jacket); R(g, 0, 12 + by, 3, 1, CP.jacketS); R(g, 0, 13 + by, 3, 2, CP.skin); }
    else { R(g, 1, 9 + by + aL, 3, 8, CP.jacket); R(g, 1, 15 + by + aL, 3, 1, CP.jacketS); R(g, 1, 17 + by + aL, 3, 2, CP.skin); }
    // right arm: bare, War Gauntlet
    var arm = o.armR || 'down';
    if (arm === 'up') {
      R(g, 15, 3 + cr, 3, 7, CP.skin); R(g, 17, 4 + cr, 1, 5, CP.skinS);
      R(g, 14, 0 + cr, 5, 4, CP.gaunt); R(g, 14, 3 + cr, 5, 1, CP.gauntS); PX(g, 15, 0 + cr, CP.gold); PX(g, 17, 0 + cr, CP.gold);
    } else if (arm === 'out') {
      R(g, 16, 7 + by, 3, 5, CP.skin); R(g, 16, 11 + by, 3, 1, CP.skinS);
      R(g, 16, 12 + by, 4, 3, CP.gaunt); R(g, 16, 14 + by, 4, 1, CP.gauntS);
    } else {
      R(g, 16, 9 + by, 3, 7, CP.skin); R(g, 18, 10 + by, 1, 6, CP.skinS);
      R(g, 15, 16 + by, 5, 3, CP.gaunt); R(g, 15, 18 + by, 5, 1, CP.gauntS); PX(g, 16, 16 + by, CP.gold); PX(g, 18, 16 + by, CP.gold);
    }
    // head from behind
    var hx = o.tilt || 0;
    R(g, 8 + hx, 6 + by, 4, 3, CP.skin);
    R(g, 7 + hx, 0 + by, 6, 1, CP.hair);
    R(g, 6 + hx, 1 + by, 8, 6, CP.hair);
    R(g, 7 + hx, 1 + by, 3, 1, CP.hairL);
    R(g, 5 + hx, 3 + by, 1, 2, CP.skin); R(g, 14 + hx, 3 + by, 1, 2, CP.skin);
  }
  defProc('rooms_carl_back_idle', 20, 30, 2, function (g, f) { carlBack(g, { bob: f }); });
  defProc('rooms_carl_back_run', 20, 30, 2, function (g, f) { carlBack(g, { legL: f ? 0 : 2, legR: f ? 2 : 0, armL: f ? 1 : -1, bob: 0 }); });
  defProc('rooms_carl_back_throw', 20, 30, 1, function (g) { carlBack(g, { armR: 'up', armL: 1 }); });
  defProc('rooms_carl_back_jump', 20, 30, 1, function (g) { carlBack(g, { legL: 3, legR: 3, armR: 'out', armLOut: true }); });
  defProc('rooms_carl_back_hurt', 20, 30, 1, function (g) { carlBack(g, { armR: 'out', armLOut: true, tilt: 1, legL: 1 }); });
  defProc('rooms_carl_back_duck', 20, 30, 1, function (g) { carlBack(g, { crouch: true }); });
  // Princess Donut riding on Carl's left shoulder, seen from behind
  defProc('rooms_donut_back', 12, 13, 2, function (g, f) {
    var b = f;
    ell(g, 6, 10, 5, 3, '#fce0a8'); R(g, 1, 10, 2, 2, '#fcfcfc'); R(g, 9, 10, 2, 2, '#fcfcfc');   // fluffy body
    disc(g, 6, 6 + b, 3, '#503000'); R(g, 4, 7 + b, 5, 2, '#881400');                             // back of the head
    R(g, 2, 3 + b, 2, 3, '#503000'); R(g, 8, 3 + b, 2, 3, '#503000'); PX(g, 2, 2 + b, '#000'); PX(g, 9, 2 + b, '#000');
    R(g, 4, 1 + b, 4, 2, '#f8b800'); PX(g, 4, 0 + b, '#f8b800'); PX(g, 7, 0 + b, '#f8b800'); PX(g, 5, 2 + b, '#e40058'); PX(g, 6, 1 + b, '#fcfcfc');
    R(g, 10, 7, 2, 5, '#503000');                                                                 // tail over the shoulder
  });
  function mongoSide(g, f, run) {
    var lg = run ? (f ? 2 : -2) : 0;
    R(g, 0, 6, 4, 2, '#f878f8'); R(g, 1, 5, 2, 1, '#3cbcfc');                 // tail
    ell(g, 7, 8, 4, 3, '#f878f8'); R(g, 5, 6, 4, 1, '#3cbcfc'); PX(g, 8, 10, '#f83800'); PX(g, 6, 10, '#f83800');
    R(g, 10, 2, 2, 5, '#f878f8'); R(g, 10, 1, 5, 3, '#f878f8'); R(g, 13, 3, 2, 1, '#fcfcfc'); PX(g, 12, 2, '#000'); PX(g, 10, 0, '#f83800'); PX(g, 11, 0, '#3cbcfc');
    R(g, 6 + lg, 11, 2, 3, '#f8a4c0'); R(g, 9 - lg, 11, 2, 3, '#f8a4c0'); R(g, 5 + lg, 13, 3, 1, '#fca044'); R(g, 8 - lg, 13, 3, 1, '#fca044');
  }
  defProc('rooms_mongo_idle', 16, 14, 2, function (g, f) { mongoSide(g, f, false); });
  defProc('rooms_mongo_run', 16, 14, 2, function (g, f) { mongoSide(g, f, true); });

  /* ---------------- fallback art: circus enemies (face right) ---------------- */
  defProc('rooms_fat_clown_walk', 24, 22, 2, function (g, f) {
    var b = f;
    R(g, 7, 19, 3, 3 - b, '#f878f8'); R(g, 14, 19 - b, 3, 3, '#f878f8'); R(g, 6, 21 - (b ? 0 : 0), 4, 1, '#d800cc'); R(g, 14, 21, 4, 1, '#d800cc');
    ell(g, 12, 13 + b, 10, 7 - b, '#f878f8');
    ell(g, 12, 15 + b, 8, 4, '#f8b8f8');
    PX(g, 6, 12 + b, '#3cbcfc'); PX(g, 16, 14 + b, '#3cbcfc'); PX(g, 10, 17 + b, '#3cbcfc'); PX(g, 18, 11 + b, '#3cbcfc'); PX(g, 13, 11 + b, '#ac7c00'); PX(g, 8, 16 + b, '#ac7c00');
    for (var i = 4; i < 21; i += 2) { R(g, i, 6 + b, 2, 2, '#fcfcfc'); PX(g, i + 1, 8 + b, '#fcfcfc'); }
    disc(g, 12, 3 + b, 3, '#fcfcfc');
    PX(g, 10, 2 + b, '#0058f8'); PX(g, 14, 2 + b, '#0058f8'); R(g, 11, 3 + b, 3, 1, '#f83800');
    R(g, 10, 5 + b, 5, 1, '#a81000'); PX(g, 11, 5 + b, '#fcfcfc'); PX(g, 13, 5 + b, '#fcfcfc');
    R(g, 1, 11 + b, 3, 3, '#f878f8'); R(g, 20, 11 + b, 3, 3, '#f878f8');
  });
  defProc('rooms_fat_clown_attack', 26, 22, 1, function (g) {
    ell(g, 13, 14, 12, 6, '#f878f8'); ell(g, 13, 16, 9, 3, '#f8b8f8');
    PX(g, 6, 13, '#3cbcfc'); PX(g, 18, 15, '#3cbcfc'); PX(g, 12, 18, '#3cbcfc');
    for (var i = 3; i < 23; i += 2) R(g, i, 7, 2, 2, '#fcfcfc');
    disc(g, 13, 4, 3, '#fcfcfc'); R(g, 11, 4, 5, 2, '#a81000'); PX(g, 12, 4, '#fcfcfc'); PX(g, 14, 4, '#fcfcfc');
    PX(g, 11, 2, '#0058f8'); PX(g, 15, 2, '#0058f8');
    R(g, 0, 8, 3, 3, '#f878f8'); R(g, 23, 8, 3, 3, '#f878f8'); R(g, 7, 20, 4, 2, '#d800cc'); R(g, 15, 20, 4, 2, '#d800cc');
  });
  defProc('rooms_stilt_clown_walk', 16, 46, 2, function (g, f) {
    var a = f ? 1 : -1;
    R(g, 6 + a, 30, 2, 15, '#881400'); R(g, 9 - a, 30, 2, 15, '#881400'); R(g, 5 + a, 44, 3, 2, '#503000'); R(g, 8 - a, 44, 3, 2, '#503000');
    R(g, 5, 22, 7, 9, '#f83800'); R(g, 5, 24, 7, 1, '#fcfcfc'); R(g, 5, 27, 7, 1, '#fcfcfc');
    R(g, 4, 12, 9, 11, '#f8b800'); R(g, 4, 12, 9, 2, '#fcfcfc'); PX(g, 8, 16, '#f83800'); PX(g, 8, 19, '#f83800');
    R(g, 12, 13, 2, 8, '#f0d0b0'); R(g, 13, 19, 2, 1, '#7c7c7c'); R(g, 14, 15, 1, 7, '#bcbcbc'); R(g, 14, 15, 2, 2, '#fcfcfc');
    R(g, 2, 13, 2, 7, '#f0d0b0');
    R(g, 5, 4, 7, 8, '#f0d0b0'); PX(g, 6, 5, '#bcbcbc'); PX(g, 10, 6, '#bcbcbc');
    R(g, 5, 8, 7, 3, '#a81000'); R(g, 6, 8, 5, 1, '#fcfcfc'); R(g, 6, 10, 5, 1, '#fcfcfc'); PX(g, 12, 10, '#f878f8'); PX(g, 13, 11, '#f878f8');
    R(g, 3, 4, 2, 5, '#f83800'); R(g, 12, 4, 2, 5, '#f83800'); R(g, 4, 3, 9, 2, '#f83800');
    R(g, 5, 1, 7, 2, '#0058f8'); R(g, 7, 0, 3, 1, '#0058f8'); PX(g, 11, 0, '#f8b800'); PX(g, 12, 1, '#f8b800');
  });
  defProc('rooms_stilt_clown_attack', 18, 46, 1, function (g) {
    R(g, 6, 30, 2, 15, '#881400'); R(g, 9, 30, 2, 15, '#881400'); R(g, 5, 44, 3, 2, '#503000'); R(g, 8, 44, 3, 2, '#503000');
    R(g, 5, 22, 7, 9, '#f83800'); R(g, 5, 24, 7, 1, '#fcfcfc'); R(g, 5, 27, 7, 1, '#fcfcfc');
    R(g, 4, 12, 9, 11, '#f8b800'); R(g, 4, 12, 9, 2, '#fcfcfc');
    R(g, 12, 4, 2, 9, '#f0d0b0'); R(g, 13, 0, 2, 5, '#bcbcbc'); R(g, 15, 0, 2, 3, '#fcfcfc');
    R(g, 2, 13, 2, 7, '#f0d0b0');
    R(g, 5, 4, 7, 8, '#f0d0b0'); R(g, 5, 7, 7, 4, '#a81000'); R(g, 6, 7, 5, 1, '#fcfcfc'); R(g, 6, 10, 5, 1, '#fcfcfc');
    R(g, 3, 4, 2, 5, '#f83800'); R(g, 12, 4, 1, 3, '#f83800'); R(g, 4, 3, 8, 2, '#f83800'); R(g, 5, 1, 7, 2, '#0058f8');
  });
  defProc('rooms_lemur_walk', 18, 15, 2, function (g, f) {
    var b = f;
    for (var i = 0; i < 6; i++) PX(g, 1 + (i > 2 ? 1 : 0), 2 + i, i % 2 ? '#fcfcfc' : '#000');
    R(g, 1, 8, 4, 2, '#a81000');
    ell(g, 9, 9 + b, 5, 3, '#f83800');
    R(g, 6, 7 + b, 7, 1, '#881400'); PX(g, 8, 7 + b, '#bcbcbc'); PX(g, 10, 7 + b, '#bcbcbc');
    R(g, 6, 12, 2, 3 - b, '#a81000'); R(g, 11, 12 - b, 2, 3, '#a81000');
    disc(g, 14, 6 + b, 3, '#f83800'); R(g, 13, 4 + b, 4, 4, '#fcfcfc'); PX(g, 14, 5 + b, '#000'); PX(g, 16, 5 + b, '#000'); R(g, 14, 7 + b, 3, 1, '#7c7c7c');
    PX(g, 12, 2 + b, '#f83800'); PX(g, 16, 2 + b, '#f83800');
  });
  defProc('rooms_lemur_attack', 18, 16, 1, function (g) {
    for (var i = 0; i < 6; i++) PX(g, 1, 3 + i, i % 2 ? '#fcfcfc' : '#000');
    ell(g, 8, 10, 5, 3, '#f83800'); R(g, 5, 8, 7, 1, '#881400');
    R(g, 5, 13, 2, 3, '#a81000'); R(g, 10, 13, 2, 3, '#a81000');
    disc(g, 13, 7, 3, '#f83800'); R(g, 12, 5, 4, 4, '#fcfcfc'); PX(g, 13, 6, '#000'); PX(g, 15, 6, '#000');
    R(g, 15, 1, 2, 4, '#f83800'); R(g, 16, 0, 2, 2, '#bcbcbc');
  });
  defProc('rooms_mold_lion_walk', 28, 19, 2, function (g, f) {
    var b = f;
    R(g, 1, 6, 2, 1, '#e45c10'); R(g, 0, 4, 2, 2, '#58d854');
    R(g, 3, 6, 15, 7, '#e45c10'); R(g, 3, 7, 9, 5, '#00a800'); PX(g, 5, 8, '#58f898'); PX(g, 8, 10, '#58f898'); PX(g, 10, 8, '#b8f818');
    R(g, 4, 13, 3, 5 - b, '#ac7c00'); R(g, 8, 13, 3, 5, '#e45c10'); R(g, 14, 13, 3, 5, '#e45c10'); R(g, 18, 13, 3, 5 - b, '#ac7c00');
    disc(g, 21, 7, 6, '#f878f8');
    for (var i = 0; i < 10; i++) PX(g, 16 + (i * 7) % 11, 2 + (i * 5) % 10, i % 2 ? '#58d854' : '#d800cc');
    R(g, 20, 5, 6, 6, '#fca044'); R(g, 24, 8, 3, 2, '#e45c10'); PX(g, 23, 6, '#58f898'); PX(g, 22, 6, '#00fcfc'); R(g, 24, 10, 3, 1, '#a81000');
  });
  defProc('rooms_mold_lion_attack', 30, 18, 1, function (g) {
    R(g, 1, 4, 4, 1, '#e45c10');
    R(g, 3, 5, 17, 6, '#e45c10'); R(g, 3, 6, 10, 4, '#00a800'); PX(g, 6, 7, '#58f898');
    R(g, 1, 10, 5, 2, '#ac7c00'); R(g, 6, 11, 4, 2, '#e45c10'); R(g, 18, 11, 4, 2, '#e45c10'); R(g, 23, 12, 5, 2, '#ac7c00');
    disc(g, 23, 6, 6, '#f878f8');
    for (var i = 0; i < 10; i++) PX(g, 18 + (i * 7) % 11, 1 + (i * 5) % 10, i % 2 ? '#58d854' : '#d800cc');
    R(g, 22, 4, 6, 6, '#fca044'); R(g, 25, 8, 4, 3, '#a81000'); PX(g, 26, 8, '#fcfcfc'); PX(g, 24, 5, '#58f898');
  });
  defProc('rooms_worm', 10, 6, 2, function (g, f) {
    for (var i = 0; i < 5; i++) R(g, 1 + i * 2 - (f && i % 2 ? 0 : 0), 2 + ((i + f) % 2), 2, 2, i === 4 ? '#f8a4c0' : '#f878f8');
    PX(g, 9, 2 + ((4 + f) % 2), '#000');
  });
  defProc('rooms_knife', 8, 8, 2, function (g, f) {
    if (f) { R(g, 1, 3, 4, 2, '#fcfcfc'); R(g, 5, 3, 2, 2, '#881400'); }
    else { R(g, 3, 1, 2, 4, '#fcfcfc'); R(g, 3, 5, 2, 2, '#881400'); }
  });
  defProc('rooms_ring_junk', 10, 10, 4, function (g, f) {
    if (f === 0) { ell(g, 5, 6, 4, 2, '#fcfcfc'); R(g, 1, 6, 9, 2, '#f8b800'); PX(g, 5, 4, '#f83800'); } // cream pie
    else if (f === 1) { R(g, 4, 1, 2, 2, '#fcfcfc'); R(g, 3, 3, 4, 2, '#f83800'); R(g, 3, 5, 4, 4, '#fcfcfc'); } // juggling pin
    else if (f === 2) { R(g, 2, 3, 6, 4, '#f8d878'); R(g, 7, 2, 2, 2, '#f8d878'); PX(g, 9, 3, '#f83800'); R(g, 3, 7, 1, 2, '#fca044'); R(g, 6, 7, 1, 2, '#fca044'); } // rubber chicken
    else { disc(g, 5, 5, 3, '#3cbcfc'); PX(g, 4, 3, '#fcfcfc'); R(g, 2, 5, 7, 1, '#f8b800'); } // juggling ball
  });
  defProc('rooms_mold_heap', 18, 8, 2, function (g, f) {
    ell(g, 9, 5, 8, 3, '#00a800'); ell(g, 9, 4, 5, 2, '#58d854');
    for (var i = 0; i < 6; i++) PX(g, 3 + i * 2, 2 + ((i + f) % 3), i % 2 ? '#f878f8' : '#b8f818');
  });
  defProc('rooms_apollon', 24, 36, 2, function (g, f) {
    R(g, 6, 26, 5, 10, '#58d854'); R(g, 13, 26, 5, 10, '#58d854'); R(g, 5, 34, 6, 2, '#007800'); R(g, 13, 34, 6, 2, '#007800');
    R(g, 4, 12, 16, 15, '#f8b800'); for (var i = 0; i < 8; i++) PX(g, 5 + (i * 5) % 14, 13 + (i * 3) % 13, '#503000');
    R(g, 12, 11, 4, 9, '#f8b800');
    R(g, 1, 12, 4, 11, '#58d854'); R(g, 19, 12 - (f ? 3 : 0), 4, 11, '#58d854'); R(g, 19, 22 - (f ? 3 : 0), 4, 3, '#00a800');
    R(g, 6, 2, 12, 10, '#58d854'); R(g, 7, 9, 10, 2, '#00a800'); PX(g, 9, 5, '#000'); PX(g, 14, 5, '#000'); R(g, 9, 9, 6, 1, '#000'); PX(g, 10, 10, '#fcfcfc'); PX(g, 13, 10, '#fcfcfc');
    R(g, 8, 3, 1, 1, '#a81000'); R(g, 9, 2, 1, 1, '#a81000'); R(g, 10, 3, 1, 1, '#a81000'); R(g, 11, 2, 1, 1, '#a81000');
    R(g, 17, 9, 2, 3, '#007800'); R(g, 18, 6, 2, 3, '#00a800'); PX(g, 20, 5, '#58f898');
  });
  defProc('rooms_icecream_stand', 30, 28, 2, function (g, f) {
    R(g, 3, 14, 24, 12, '#fcfcfc'); R(g, 3, 14, 24, 2, '#f878f8'); R(g, 5, 18, 20, 5, '#f8b8f8');
    R(g, 5, 25, 4, 3, '#7c7c7c'); R(g, 21, 25, 4, 3, '#7c7c7c');
    R(g, 14, 2, 2, 12, '#bcbcbc');
    for (var i = 0; i < 6; i++) R(g, 2 + i * 4, 1 + (i === 0 || i === 5 ? 2 : i === 1 || i === 4 ? 1 : 0), 4, 4, i % 2 ? '#fcfcfc' : '#f83800');
    for (var j = 0; j < 3; j++) { R(g, 7 + j * 6, 11, 3, 3, '#fca044'); R(g, 7 + j * 6, 9 - ((j + f) % 2), 3, 2, '#f878f8'); PX(g, 8 + j * 6, 8 - ((j + f) % 2), '#f878f8'); }
  });
  defProc('rooms_cone', 8, 10, 1, function (g) { R(g, 2, 4, 4, 2, '#fca044'); R(g, 3, 6, 2, 3, '#fca044'); R(g, 1, 1, 6, 3, '#f878f8'); PX(g, 2, 0, '#f878f8'); PX(g, 5, 0, '#f878f8'); });
  defProc('rooms_jug', 9, 10, 2, function (g, f) { R(g, 1, 4, 7, 6, '#ac7c00'); R(g, 3, 2, 3, 2, '#ac7c00'); R(g, 2, 5, 2, 3, '#f8d878'); R(g, 3, 0, 3, 2, f ? '#f8b800' : '#f83800'); });
  defProc('rooms_hob', 7, 7, 2, function (g, f) { disc(g, 3, 4, 2, '#7c7c7c'); PX(g, 2, 3, '#bcbcbc'); PX(g, 4, 0 + f, '#f8b800'); R(g, 3, 1, 1, 1, '#503000'); });
  defProc('rooms_dyn', 6, 10, 2, function (g, f) { R(g, 1, 3, 4, 7, '#f83800'); R(g, 1, 5, 4, 1, '#a81000'); R(g, 2, 1, 1, 2, '#fcfcfc'); PX(g, 3, 0, f ? '#f8b800' : '#fcfcfc'); });
  defProc('rooms_smokeball', 7, 7, 1, function (g) { disc(g, 3, 4, 2, '#bcbcbc'); PX(g, 2, 3, '#fcfcfc'); R(g, 3, 1, 1, 1, '#503000'); });
  defProc('rooms_missile', 7, 7, 2, function (g, f) { disc(g, 3, 3, 2, f ? '#f878f8' : '#d800cc'); PX(g, 3, 3, '#fcfcfc'); }, { outline: false });

  /* ================================================================
     PERSPECTIVE
     z: 0 = back wall, 1 = Carl's plane. X: world lateral px at the
     front plane. s(z) is the projection scale (0.45 .. 1).
     ================================================================ */
  var VY = 22, FY = 176, ZD0 = 2.2, ZD1 = 1.0, WALLX = 180, WALLH = 108;
  function sOf(z) { return 1 / (ZD0 - (ZD0 - ZD1) * z); }
  function dOf(z) { return ZD0 - (ZD0 - ZD1) * z; }
  function zOfD(d) { return (ZD0 - d) / (ZD0 - ZD1); }
  function yOf(z) { return VY + (FY - VY) * sOf(z); }
  function xOf(X, z) { return 160 + X * sOf(z); }
  function qScale(s) { return s < 0.62 ? 0.5 : s < 0.86 ? 0.75 : 1; } // nearest-neighbour steps
  var BACK_Y = Math.round(yOf(0)), BACK_X0 = Math.round(xOf(-WALLX, 0)), BACK_X1 = Math.round(xOf(WALLX, 0));
  var BACK_TOP = Math.round(BACK_Y - WALLH * sOf(0));
  var Z_FRONT = 0.9, DEPTH_PX = 260; // depth units to world px for blast distances

  /* ---------------- ring styles ---------------- */
  var STYLES = [
    { a: '#a81000', b: '#fcfcfc', aD: '#881400', bD: '#bcbcbc', curbA: '#f83800', curbB: '#fcfcfc', floorA: '#ac7c00', floorB: '#e45c10', ring: '#fca044', crowd: '#000000', seat: '#503000', light: '#f8d878', wall: '#a81000', wallB: '#fcfcfc' },
    { a: '#0058f8', b: '#f8b800', aD: '#0000bc', bD: '#ac7c00', curbA: '#3cbcfc', curbB: '#f8d878', floorA: '#ac7c00', floorB: '#e45c10', ring: '#fca044', crowd: '#000000', seat: '#004058', light: '#a4e4fc', wall: '#0058f8', wallB: '#f8b800' },
    { a: '#6844fc', b: '#00a800', aD: '#4428bc', bD: '#007800', curbA: '#d800cc', curbB: '#58d854', floorA: '#887000', floorB: '#ac7c00', ring: '#e45c10', crowd: '#000000', seat: '#4428bc', light: '#d8b8f8', wall: '#6844fc', wallB: '#00a800' },
    { a: '#005800', b: '#000000', aD: '#004058', bD: '#000000', curbA: '#a81000', curbB: '#503000', floorA: '#503000', floorB: '#881400', ring: '#007800', crowd: '#000000', seat: '#000000', light: '#f87858', wall: '#005800', wallB: '#004058' }
  ];
  STYLES[2].floorA = '#ac7c00'; STYLES[2].floorB = '#a85010'; // keep to the NES set

  /* ================================================================
     DATA
     ================================================================ */
  var DEFAULT_ROOM = {
    rooms: [
      { name: 'RING ONE', target: { kind: 'pole', hp: 60 }, waves: [['fat_clown', 3], ['lemur', 2]], rate: 1.8, max: 4 },
      { name: 'RING TWO', target: { kind: 'pole', hp: 75 }, waves: [['fat_clown', 2], ['stilt_clown', 2], ['lemur', 2]], rate: 1.6, max: 5 },
      { name: 'RING THREE', target: { kind: 'pole', hp: 90 }, waves: [['stilt_clown', 2], ['mold_lion', 2], ['lemur', 2], ['fat_clown', 1]], rate: 1.4, max: 6 }
    ],
    finale: { kind: 'vine', seconds: 45 }
  };
  var ENEMY_DEF = {
    fat_clown: { name: 'CLAMMY-TYPE CLOWN', hp: 14, dmg: 3, xp: 9, gold: [1, 4], ai: 'jumper', hw: 11 },
    stilt_clown: { name: 'TERROR THE CLOWN', hp: 22, dmg: 4, xp: 14, gold: [2, 5], ai: 'stilt', hw: 8, fearImmune: true },
    lemur: { name: 'FORMER CIRCUS LEMUR', hp: 8, dmg: 2, xp: 7, gold: [1, 3], ai: 'perch', hw: 7 },
    mold_lion: { name: 'MOLD LION', hp: 18, dmg: 4, xp: 15, gold: [2, 6], ai: 'charger', hw: 12, regrow: true },
    worm: { name: 'PARASITE WORM', hp: 2, dmg: 1, xp: 1, gold: [0, 0], ai: 'worm', hw: 5 }
  };
  var AI_OF = { jumper: 'hop', stilt: 'stilt', perch: 'perch', charger: 'charger', worm: 'worm', walker: 'walker', chaser: 'walker' };
  function enemyDef(id) {
    var base = ENEMY_DEF[id] || { name: String(id).toUpperCase(), hp: 12, dmg: 2, xp: 6, gold: [0, 2], ai: 'walker', hw: 9 };
    var d = (D().enemies || {})[id] || {};
    var o = {}, k;
    for (k in base) o[k] = base[k];
    for (k in d) if (d[k] !== undefined && d[k] !== null) o[k] = d[k];
    o.id = id; o.sprite = d.sprite || id;
    o.mode = AI_OF[o.ai] || (ENEMY_DEF[id] ? AI_OF[ENEMY_DEF[id].ai] : 'walker') || 'walker';
    if (ENEMY_DEF[id]) o.mode = AI_OF[ENEMY_DEF[id].ai]; // the room behaviour follows the circus role
    o.hw = num(base.hw, 9);
    return o;
  }
  function roomData(lv) {
    var rm = (lv && lv.room) || {};
    var rooms = Array.isArray(rm.rooms) && rm.rooms.length ? rm.rooms : DEFAULT_ROOM.rooms;
    var fin = rm.finale === null ? null : (rm.finale || DEFAULT_ROOM.finale);
    return { rooms: rooms, finale: fin };
  }

  /* ================================================================
     STATE
     ================================================================ */
  var S = null;
  function newState(params) {
    var id = (params && params.levelId) || (run().levelId) || 'a1_bigtop';
    var lv = gcall('levelDef', id) || (D().levels || {})[id] || null;
    var rd = roomData(lv);
    var st = stats();
    var r = run();
    if (!(r.hp > 0)) r.hp = st.maxHp;
    var pt = party();
    return {
      id: id, lv: lv || {}, rd: rd, ri: -1, phase: 'start', pt: 0, t: 0,
      carl: { X: 0, h: 0, vh: 0, duck: false, inv: 1.2, hurtT: 0, throwT: 0, cool: 0, runT: 0, face: 1, dead: false, deadT: 0, moving: false },
      donut: pt.indexOf('donut') >= 0 ? { cd: 1.2, t: 0 } : null,
      mongo: pt.indexOf('mongo') >= 0 ? { state: 'side', X: 24, z: 1, cd: 2.5, target: null, t: 0, big: flag('mongo_big') } : null,
      enemies: [], proj: [], eproj: [], blasts: [], fires: [], smokes: [], heaps: [], fx: [], pops: [], shocks: [], tend: [],
      target: null, spawnT: 2, alive: 0, kills: 0, views: 0, gold: 0, damageTaken: 0, combo: 0, comboT: 0, maxCombo: 0,
      special: 0, fearT: 0, flashT: 0, flashC: '#fcfcfc', scroll: 0, cheer: 0, boo: 0, god: !!r.god,
      trapezes: makeTrapezes(), style: STYLES[0], finale: null, done: false, sent: false, apollon: null, quipT: 6
    };
  }
  function makeTrapezes() {
    return [
      { X: -70, z: 0.35, len: 104, top: 206, amp: 0.55, ph: 0, w: 0.9, lemur: null },
      { X: 75, z: 0.55, len: 110, top: 214, amp: 0.5, ph: 2.1, w: 1.05, lemur: null },
      { X: 0, z: 0.18, len: 96, top: 200, amp: 0.4, ph: 4.0, w: 0.8, lemur: null }
    ];
  }
  function trapPos(tp, t) {
    var a = tp.amp * Math.sin(t * tp.w * 2 + tp.ph);
    return { X: tp.X + Math.sin(a) * tp.len, h: tp.top - Math.cos(a) * tp.len, a: a };
  }

  /* ---------------- flow ---------------- */
  function enter(params) {
    S = newState(params);
    music((S.lv && S.lv.music) || 'bigtop');
    var nm = (S.lv && S.lv.name) || 'THE BIG TOP';
    ucall('announce', nm, { sub: "GRIMALDI'S CIRCUS", color: '#f8b800', time: 2 });
    // level intro lines (a cinema id is played by game.enterLevel before we get here)
    var intro = S.lv && S.lv.intro, cin = D().cinema || {};
    if (Array.isArray(intro) && intro.length) S.introPending = intro;
    else if (typeof intro === 'string' && !cin[intro]) S.introPending = [intro];
    nextRoom();
  }
  function exit() { if (S) S.exited = true; }
  function nextRoom() {
    S.ri++;
    S.enemies.length = 0; S.eproj.length = 0; S.fires.length = 0; S.smokes.length = 0; S.heaps.length = 0; S.shocks.length = 0;
    S.trapezes.forEach(function (tp) { tp.lemur = null; });
    if (S.ri < S.rd.rooms.length) {
      var rm = S.rd.rooms[S.ri] || {};
      var tg = rm.target || {};
      S.room = rm;
      S.style = STYLES[Math.min(S.ri, 2)];
      S.target = { kind: tg.kind || 'pole', hp: num(tg.hp, 60), maxHp: num(tg.hp, 60), flash: 0, shake: 0, broken: false, stage: 0 };
      S.phase = 'intro'; S.pt = 0; S.spawnT = 1.8;
      ucall('announce', rm.name || ('RING ' + (S.ri + 1)), { sub: S.ri === 0 ? hintLine() : 'BREAK THE TENT POLE', color: '#f8d878', time: 2.2 });
      sfx('calliope_stab');
    } else if (S.rd.finale) {
      startFinale();
    } else finishLevel();
  }
  function keyFor(action, fb) {
    try {
      var I = DCW.input;
      if (I && I.lastDevice && I.lastDevice !== 'keyboard') return action === 'attack' ? 'B' : action === 'bomb' ? 'BOMB' : fb;
      var b = I && I.bindings ? I.bindings()[action] : null, code = b && (b[0] || b[1]);
      return code && I.keyName ? String(I.keyName(code)) : fb;
    } catch (e) { return fb; }
  }
  function hintLine() {
    return keyFor('attack', 'X') + ' THROWS JUNK. ' + keyFor('bomb', 'C') + ' THROWS ' + expName(selected()) + '. BREAK THE POLE!';
  }
  function expName(id) {
    var it = (D().items || {})[id];
    if (it && it.name) return String(it.name).toUpperCase();
    return { jug: "JUG O'BOOM", hob: 'HOB-LOBBER', dyn: 'DYNAMITE', smoke: 'SMOKE BOMB' }[id] || String(id || 'BOMB').toUpperCase();
  }
  var FINALE_LINES = [
    { who: 'CARL', text: 'OKAY. POISONED MY OWN BLOOD, DRIPPED IT ON THE ROOT. NOW I JUST HAVE TO NOT DIE WHILE IT WORKS.' },
    { who: 'DONUT', text: 'CARL, THE GIANT EVIL SALAD IS LOOKING AT US. I DID NOT AGREE TO SALAD.' },
    { who: 'SYSTEM AI', text: 'RINGMASTER GRIMALDI. LEVEL 85 CITY BOSS. HE IS A PLANT NOW. THE AUDIENCE HAS QUESTIONS.' }
  ];
  var FINALE_DONE = [
    { who: 'SYSTEM AI', text: 'THE VINE IS WILTING. CARL HAS POISONED A CITY BOSS WITH HIS OWN BODILY FLUIDS. RATINGS ARE THROUGH THE TENT.' }
  ];
  var APOLLON_LINES = ['WORM CONE! ONE GOLD!', 'TWO SCOOPS OF WIGGLE!', 'NOW WITH MORE WORM!', 'THEY ARE FRESH. THEY ARE ALIVE.', 'FREE SPRINKLES. THE SPRINKLES ARE WORMS.', 'NO REFUNDS. NO SURVIVORS.'];
  function startFinale() {
    var f = S.rd.finale || {};
    S.room = { name: f.name || 'THE CENTER RING' };
    S.style = STYLES[3];
    S.target = null;
    S.finale = { seconds: Math.max(10, num(f.seconds, 45)), t: 0, poison: 0, attackT: 2.4, wormT: 3, maxWorms: num(f.worms, 6), rate: num(f.rate, 2.2), dieT: 0, rise: 0 };
    S.apollon = { X: -128, z: 0.12, lineT: 2, line: null, lineShow: 0, throwT: 0, hits: 0 };
    S.phase = 'finaleIntro'; S.pt = 0;
    music(f.music || (S.lv && S.lv.bossMusic) || 'boss');
    sfx('boss_roar');
    DCW.shake(3, 0.6);
    var lines = Array.isArray(f.lines) && f.lines.length ? f.lines : FINALE_LINES;
    S.pendingSay = lines;
  }
  function finishLevel() {
    if (S.sent) return;
    S.sent = true; S.done = true;
    music(null);
    var r = run();
    r.hp = Math.max(1, r.hp);
    var res = { levelId: S.id, kills: S.kills, time: Math.round(S.t * 10) / 10, damageTaken: S.damageTaken, maxCombo: S.maxCombo,
      views: Math.round(S.views), gold: S.gold, secrets: 0 };
    track('bigtop_clear');
    if (gfn('levelCleared')) gcall('levelCleared', res);
    else { S.fallbackMsg = 'LEVEL CLEAR'; S.result = res; }
  }
  function killCarl(cause) {
    var C = S.carl;
    if (C.dead) return;
    C.dead = true; C.deadT = 0; C.cause = cause || 'DAMAGE';
    sfx('death'); DCW.shake(4, 0.4); DCW.freeze(10);
    flash('#f83800', 0.12);
    music(null);
  }

  /* ================================================================
     UPDATE
     ================================================================ */
  function update(dt) {
    if (!S || S.exited) return;
    S.t += dt; S.pt += dt;
    gcall('tick', dt);
    if (S.flashT > 0) S.flashT -= dt;
    if (S.cheer > 0) S.cheer -= dt;
    if (S.boo > 0) S.boo -= dt;
    if (S.comboT > 0) { S.comboT -= dt; if (S.comboT <= 0) S.combo = 0; }
    if (S.fearT > 0) S.fearT -= dt;
    if (S.introPending && S.t > 0.6) { var il = S.introPending; S.introPending = null; ucall('say', il); return; }
    if (S.pendingSay) { var ps = S.pendingSay; S.pendingSay = null; ucall('say', ps); return; }
    if (P('start') && !S.done && !S.carl.dead && ufn('openPause')) { ucall('openPause', { canFlee: true }); return; }
    if (S.done) { tickFx(dt); return; }

    updCarl(dt);
    if (S.carl.dead) { tickFx(dt); updEnemies(dt * 0.3); return; }
    switch (S.phase) {
      case 'intro': if (S.pt > 1.4) { S.phase = 'fight'; S.pt = 0; } break;
      case 'fight': updSpawns(dt); break;
      case 'poleDown': updPoleDown(dt); break;
      case 'advance': S.scroll += dt * 9; if (S.pt > 1.5) nextRoom(); break;
      case 'finaleIntro': S.finale.rise = Math.min(1, S.finale.rise + dt * 0.8); if (S.pt > 1.6) { S.phase = 'finale'; S.pt = 0; } break;
      case 'finale': updFinale(dt); break;
      case 'vineDie': updVineDie(dt); break;
    }
    updCompanions(dt);
    updEnemies(dt);
    updProj(dt);
    updEnemyProj(dt);
    updHazards(dt);
    tickFx(dt);
    S.special = Math.min(1, S.special + dt * 0.012);
    if (S.target) { if (S.target.flash > 0) S.target.flash -= dt; if (S.target.shake > 0) S.target.shake -= dt; }
  }
  function idle(dt) { /* a modal is open: keep the crowd breathing, nothing else moves */ }

  /* ---------------- Carl ---------------- */
  function updCarl(dt) {
    var C = S.carl, st = stats(), r = run();
    C.inv -= dt; C.hurtT -= dt; C.throwT -= dt; C.cool -= dt;
    if (C.dead) {
      C.deadT += dt;
      if (C.deadT > 1.9 && !S.sent) {
        S.sent = true; S.done = true;
        var res = { levelId: S.id, cause: C.cause || 'DAMAGE' };
        if (gfn('playerDied')) gcall('playerDied', res); else S.fallbackMsg = 'YOU DIED';
      }
      return;
    }
    var locked = S.phase === 'advance' || S.phase === 'vineDie';
    // ducking: only on the ground, no walking
    C.duck = !locked && Dn('down') && C.h <= 0 && C.hurtT <= 0;
    var ax = locked ? 0 : (Dn('right') ? 1 : 0) - (Dn('left') ? 1 : 0);
    if (C.duck || C.hurtT > 0.25) ax = 0;
    var sp = 128 * num(st.speedMul, 1);
    C.X = clamp(C.X + ax * sp * dt, -150, 150);
    C.moving = ax !== 0; if (ax) C.face = ax;
    if (C.moving) C.runT += dt;
    // jump
    if (!locked && P('jump') && C.h <= 0 && !C.duck) { C.vh = 250; sfx('jump'); }
    if (C.h > 0 || C.vh > 0) {
      C.vh -= 900 * dt; C.h += C.vh * dt;
      if (C.h <= 0) { C.h = 0; C.vh = 0; sfx('land', { vol: 0.5 }); }
    }
    if (locked) return;
    // attack: ring junk, hold to keep throwing
    var junk = S.proj.filter(function (p) { return p.kind === 'junk'; }).length;
    if ((P('attack') || (Dn('attack') && C.cool <= -0.08)) && C.cool <= 0 && junk < 4) throwJunk();
    // bomb: selected explosive; up+bomb cycles
    if (P('bomb')) { if (Dn('up')) cycleExplosive(); else throwExplosive(); }
    if (P('special')) doSpecial();
    if (P('potion')) {
      if (gfn('usePotion')) { if (gcall('usePotion')) pop(xOf(C.X, 1), 140, 'POTION!', '#58f898'); }
      else if ((r.potions || 0) > 0 && r.hp < st.maxHp) { r.potions--; r.hp = Math.min(st.maxHp, r.hp + Math.ceil(st.maxHp / 2)); sfx('heal'); }
    }
  }
  function throwJunk() {
    var C = S.carl;
    C.cool = 0.2; C.throwT = 0.16;
    S.proj.push({ kind: 'junk', X: C.X + 7, z: 1, z0: 1, h0: C.duck ? 8 : 20 + C.h, vz: -2.1, frame: randi(0, 3), spin: 0 });
    sfx('bomb_throw', { vol: 0.5, pitch: rand(1.3, 1.6) });
  }
  var EXPLOSIVES = ['jug', 'hob', 'dyn', 'smoke'];
  function selected() {
    var r = run(); var s = r.selected || 'jug';
    if (EXPLOSIVES.indexOf(s) < 0) s = 'jug';
    return s;
  }
  function cycleExplosive() {
    var r = run(), cur = selected(), i0 = EXPLOSIVES.indexOf(cur);
    for (var k = 1; k <= EXPLOSIVES.length; k++) {
      var id = EXPLOSIVES[(i0 + k) % EXPLOSIVES.length];
      if (itemCount(id) > 0) { r.selected = id; sfx('menu_move'); pop(xOf(S.carl.X, 1), 140, expName(id), '#f8d878'); return; }
    }
    sfx('error');
  }
  function throwExplosive() {
    var C = S.carl, id = selected();
    if (itemCount(id) <= 0) {
      // auto-switch to anything owned
      var alt = EXPLOSIVES.filter(function (e) { return itemCount(e) > 0; })[0];
      if (!alt) { sfx('error'); popOnce('noexp', xOf(C.X, 1), 140, 'NO EXPLOSIVES', '#f83800'); return; }
      run().selected = id = alt;
    }
    if (!useItem(id)) { sfx('error'); return; }
    C.throwT = 0.25; C.cool = 0.3;
    // lands on the nearest enemy in Carl's lane, else on the back wall
    var tz = 0, best = null;
    S.enemies.forEach(function (e) {
      if (e.dead || e.dying) return;
      if (Math.abs(e.X - C.X) < e.hw + 14 && e.z < 0.97 && (!best || e.z > best.z)) best = e;
    });
    if (best) tz = clamp(best.z + 0.02, 0, 0.95);
    if (S.finale) tz = Math.max(tz, best ? tz : 0.3);
    var T = 0.42 + (1 - tz) * 0.4;
    S.proj.push({ kind: 'bomb', type: id, X: C.X + 6, tX: best ? best.X : C.X + 6, z: 1, tz: tz, h: 22, t: 0, T: T, fuse: -1, landed: false });
    sfx('bomb_throw');
    track('throw:' + id);
  }
  function doSpecial() {
    if (S.special < 1) { sfx('error'); return; }
    S.special = 0;
    S.fearT = 2.5;
    sfx('fear');
    flash('#d8b8f8', 0.15);
    ucall('announce', 'PANIC!', { sub: 'FEAR + MAGIC MISSILE', color: '#d8b8f8', time: 1.2 });
    S.enemies.forEach(function (e) { if (!e.def.fearImmune) e.stun = 2.5; });
    if (S.donut) {
      var tg = S.enemies.filter(function (e) { return !e.dead && !e.dying; });
      for (var i = 0; i < 6; i++) {
        var e = tg.length ? tg[i % tg.length] : null;
        S.proj.push({ kind: 'missile', X: S.carl.X - 8, z: 1, h: 34, t: -i * 0.08, tgt: e, dmg: Math.round(num(stats().missileDmg, 4) * 1.2), seekX: e ? e.X : rand(-100, 100), seekZ: e ? e.z : rand(0.2, 0.6) });
      }
    }
    track('panic');
  }

  function hurtCarl(dmg, cause) {
    var C = S.carl, r = run(), st = stats();
    if (C.dead || C.inv > 0 || S.done) return false;
    if (S.god) { C.inv = 0.4; return false; }
    var n = Math.max(1, Math.round(dmg - num(st.def, 0)));
    if (DCW.save && DCW.save.settings && DCW.save.settings.easy === true) n = Math.max(1, Math.ceil(n / 2));
    if (gfn('damageTaken')) gcall('damageTaken', n); else r.hp = Math.max(0, r.hp - n);
    if (r.hp < 0) r.hp = 0;
    S.damageTaken += n;
    C.inv = 1.1; C.hurtT = 0.4;
    S.combo = 0; S.comboT = 0;
    sfx('hurt'); DCW.shake(3, 0.18); DCW.freeze(3);
    flash('#f83800', 0.06);
    pop(xOf(C.X, 1), 142, '-' + n, '#f83800');
    S.boo = 0.6;
    if (r.hp <= 0) killCarl(cause);
    return true;
  }

  /* ---------------- spawning ---------------- */
  function updSpawns(dt) {
    var rm = S.room || {};
    S.spawnT -= dt;
    var alive = S.enemies.filter(function (e) { return !e.dead; }).length;
    var max = num(rm.max, 3 + S.ri);
    if (S.spawnT <= 0 && alive < max) {
      S.spawnT = clamp(num(rm.rate, 1.6), 0.5, 8) * rand(0.8, 1.25);
      var waves = Array.isArray(rm.waves) && rm.waves.length ? rm.waves : [['fat_clown', 1]];
      spawnEnemy(weighted(waves));
    }
  }
  var FLAPS = [-112, 112];
  function spawnEnemy(id, at) {
    var def = enemyDef(id);
    var e = { id: id, def: def, mode: def.mode, hp: num(def.hp, 10), maxHp: num(def.hp, 10), hw: def.hw, X: 0, z: 0.02, h: 0,
      t: 0, st: 'walk', stT: 0, flash: 0, stun: 0, anim: Math.random() * 2, face: 1, dead: false, dying: 0, hitCd: 0, lunge: 0 };
    if (at) { e.X = at.X; e.z = at.z; if (at.regrown) e.regrown = true; }
    else e.X = pick(FLAPS) + rand(-6, 6);
    if (e.mode === 'perch' && !at) {
      var free = S.trapezes.filter(function (tp) { return !tp.lemur; });
      if (free.length) { var tp = pick(free); tp.lemur = e; e.trap = tp; e.st = 'drop'; e.h = 200; e.z = tp.z; e.throws = randi(2, 3); e.stT = 0.9; }
    }
    if (e.mode === 'worm') { e.z = at ? at.z : 0.22; e.h = 0; }
    S.enemies.push(e);
    sfx('spawn', { vol: 0.5 });
    return e;
  }

  /* ---------------- enemies ---------------- */
  function scared(e) { // inside a smoke cloud: lost track of Carl
    for (var i = 0; i < S.smokes.length; i++) { var s = S.smokes[i]; if (Math.abs(e.X - s.X) < s.r && Math.abs(e.z - s.z) * DEPTH_PX < s.r) return true; }
    return false;
  }
  function updEnemies(dt) {
    var C = S.carl;
    for (var i = 0; i < S.enemies.length; i++) {
      var e = S.enemies[i];
      if (e.dead) continue;
      e.t += dt; e.anim += dt; e.flash -= dt; e.hitCd -= dt; if (e.lunge > 0) e.lunge -= dt;
      if (e.dying > 0) { e.dying -= dt; e.h = Math.max(0, e.h - 200 * dt); if (e.dying <= 0) e.dead = true; continue; }
      if (e.stun > 0) { e.stun -= dt; if (e.st !== 'trap' && e.st !== 'drop') e.h = Math.max(0, e.h - 300 * dt); continue; }
      var lost = scared(e);
      var dx = C.X - e.X;
      if (Math.abs(dx) > 2) e.face = dx > 0 ? 1 : -1;
      var spd = num(e.def.zspeed, 0);
      switch (e.mode) {
        case 'hop': updHop(e, dt, dx, lost); break;
        case 'stilt': updStilt(e, dt, dx, lost); break;
        case 'perch': updPerch(e, dt, dx, lost); break;
        case 'charger': updCharger(e, dt, dx, lost); break;
        case 'worm': updWorm(e, dt, dx, lost); break;
        default: updWalker(e, dt, dx, lost, spd || 0.3);
      }
      e.X = clamp(e.X, -165, 165);
    }
    S.enemies = S.enemies.filter(function (e) { return !e.dead; });
  }
  function approach(e, dt, zs, xs, dx, zmax) {
    e.z = Math.min(zmax === undefined ? Z_FRONT : zmax, e.z + zs * dt);
    e.X += clamp(dx, -xs * dt, xs * dt);
  }
  function frontAttack(e, dt, windup, cool, kind, reach) {
    // at the front line: telegraph, strike, cool down
    if (e.st === 'walk') { e.st = 'wind'; e.stT = windup; sfx('warn', { vol: 0.5 }); }
    else if (e.st === 'wind') { e.stT -= dt; e.lunge = 0; if (e.stT <= 0) { strike(e, kind, reach); e.st = 'cool'; e.stT = cool; e.lunge = 0.3; } }
    else if (e.st === 'cool') { e.stT -= dt; if (e.stT <= 0) e.st = 'walk'; }
  }
  function strike(e, kind, reach) {
    var C = S.carl, dmg = num(e.def.dmg, 2);
    var inLane = Math.abs(C.X - e.X) < reach;
    if (!inLane) return;
    if (kind === 'high' && C.duck) { pop(xOf(C.X, 1), 140, 'DUCKED!', '#58d854'); return; }
    if (kind === 'low' && C.h > 6) return;
    hurtCarl(dmg, String(e.def.name || e.id).toUpperCase());
  }
  function updWalker(e, dt, dx, lost, zs) {
    if (lost) { e.X += Math.sin(e.t * 2) * 30 * dt; return; }
    if (e.z < Z_FRONT) { approach(e, dt, zs, 50, dx, Z_FRONT); e.st = 'walk'; }
    else { e.X += clamp(dx, -40 * dt, 40 * dt); frontAttack(e, dt, 0.4, 1.2, 'lane', e.hw + 16); }
  }
  function updHop(e, dt, dx, lost) {
    // fat clown: belly hops toward the camera, then belly-slams the front (jump the shockwave)
    if (e.z < Z_FRONT) {
      e.stT -= dt;
      if (e.stT <= 0) { e.stT = 0.62; e.hopZ = e.z; e.hopX = e.X; e.hopT = 0; }
      if (e.hopT !== undefined && e.hopT < 0.5) {
        e.hopT += dt; var k = Math.min(1, e.hopT / 0.5);
        e.h = Math.sin(k * Math.PI) * 22;
        if (!lost) { e.z = Math.min(Z_FRONT, e.hopZ + 0.1 * k); e.X = e.hopX + clamp(dx, -26, 26) * k * 0.5; }
        if (k >= 1) { e.hopT = 9; sfx('land', { vol: 0.3, pitch: 0.7 }); }
      }
      e.st = 'walk';
      return;
    }
    if (lost) return;
    if (e.st === 'walk') { e.st = 'wind'; e.stT = 0.55; e.h = 0; sfx('warn', { vol: 0.5 }); }
    else if (e.st === 'wind') { e.stT -= dt; if (e.stT <= 0) { e.st = 'air'; e.stT = 0.45; e.lunge = 0.6; sfx('jump', { pitch: 0.6 }); } }
    else if (e.st === 'air') {
      e.stT -= dt; e.h = Math.sin(clamp(1 - e.stT / 0.45, 0, 1) * Math.PI) * 44;
      if (e.stT <= 0) { e.h = 0; e.st = 'cool'; e.stT = 1.6; S.shocks.push({ X: e.X, r: 0, dmg: num(e.def.dmg, 3), hit: false, src: e.def.name }); DCW.shake(3, 0.2); sfx('stomp'); }
    } else if (e.st === 'cool') { e.stT -= dt; e.X += clamp(dx, -24 * dt, 24 * dt); if (e.stT <= 0) e.st = 'walk'; }
  }
  function updStilt(e, dt, dx, lost) {
    if (lost) { e.X += Math.sin(e.t * 1.5) * 20 * dt; return; }
    if (e.z < Z_FRONT) { approach(e, dt, 0.13, 34, dx, Z_FRONT); e.st = 'walk'; return; }
    e.X += clamp(dx, -30 * dt, 30 * dt);
    frontAttack(e, dt, 0.65, 1.5, 'high', 56);
  }
  function updCharger(e, dt, dx, lost) {
    // mold lion: walk to mid ring, crouch (telegraph), charge down a lane, back off, repeat
    var mid = 0.5;
    if (e.st === 'walk') {
      if (lost) { e.X += Math.sin(e.t) * 25 * dt; return; }
      if (e.z < mid) approach(e, dt, 0.22, 40, dx, mid);
      else { e.st = 'wind'; e.stT = 0.75; e.aimX = clamp(S.carl.X, -150, 150); sfx('boss_roar', { vol: 0.4, pitch: 1.6 }); }
    } else if (e.st === 'wind') {
      e.stT -= dt; e.X += clamp(e.aimX - e.X, -60 * dt, 60 * dt);
      if (e.stT <= 0) { e.st = 'charge'; e.lunge = 0.5; }
    } else if (e.st === 'charge') {
      e.z += 1.5 * dt;
      if (e.z >= 0.97) { e.z = 0.97; strike(e, 'lane', e.hw + 10); e.st = 'back'; e.lunge = 0.25; }
    } else if (e.st === 'back') {
      e.z -= 0.55 * dt;
      if (e.z <= mid) { e.z = mid; e.st = 'walk'; }
    }
  }
  function updPerch(e, dt, dx, lost) {
    var tp = e.trap;
    if (e.st === 'drop' && tp) { // dropping in from the tent roof onto a trapeze
      var p = trapPos(tp, S.t); e.X = p.X; e.z = tp.z; e.h = Math.max(p.h, e.h - 260 * dt);
      if (e.h <= p.h + 0.5) { e.st = 'trap'; e.stT = 0.8; }
      return;
    }
    if (e.st === 'trap' && tp) {
      var q = trapPos(tp, S.t); e.X = q.X; e.h = q.h; e.z = tp.z;
      if (lost) return;
      e.stT -= dt;
      if (e.stT <= 0) {
        if (e.throws > 0) { e.throws--; e.stT = 1.3; e.lunge = 0.3; throwKnife(e); }
        else { e.st = 'fall'; tp.lemur = null; e.trap = null; e.vh = 60; }
      }
      return;
    }
    if (e.st === 'fall') { e.vh -= 600 * dt; e.h += e.vh * dt; if (e.h <= 0) { e.h = 0; e.st = 'walk'; sfx('land', { vol: 0.4 }); } return; }
    updWalker(e, dt, dx, lost, 0.36);
  }
  function updWorm(e, dt, dx, lost) {
    if (lost) return;
    e.z = Math.min(0.98, e.z + 0.17 * dt);
    e.X += clamp(dx, -22 * dt, 22 * dt);
    if (e.z >= 0.95 && Math.abs(dx) < 12 && S.carl.h < 6) {
      hurtCarl(num(e.def.dmg, 1), 'WORMS');
      killEnemy(e, { kind: 'self', quiet: true });
      sfx('worm_squish');
    } else if (e.z >= 0.98) { e.z = 0.98; }
  }
  function throwKnife(e) {
    var C = S.carl;
    S.eproj.push({ kind: 'knife', X0: e.X, z0: e.z, h0: e.h, X1: C.X + rand(-6, 6), t: 0, T: 0.95, dmg: num(e.def.dmg, 2), src: e.def.name, sprite: 'knife' });
    sfx('bomb_throw', { vol: 0.4, pitch: 1.8 });
  }

  /* ---------------- damage to enemies ---------------- */
  function hitEnemy(e, dmg, opts) {
    opts = opts || {};
    if (e.dead || e.dying > 0) return false;
    var st = stats();
    var crit = opts.kind === 'junk' && Math.random() < num(st.crit, 0.05);
    if (crit) dmg *= 2;
    e.hp -= dmg; e.flash = 0.12;
    if (opts.kind === 'junk' && e.st !== 'trap') e.z = Math.max(0.02, e.z - 0.025);
    var p = enemyScreen(e);
    pop(p.x, p.y - 8, (crit ? 'CRIT ' : '') + Math.round(dmg), crit ? '#f8d878' : '#fcfcfc');
    S.combo++; S.comboT = 2; if (S.combo > S.maxCombo) S.maxCombo = S.combo;
    S.special = Math.min(1, S.special + 0.035);
    sfx(opts.kind === 'junk' ? 'hit' : 'punch', { vol: 0.6 });
    if (e.hp <= 0) killEnemy(e, opts);
    return true;
  }
  function killEnemy(e, opts) {
    opts = opts || {};
    if (e.dying > 0 || e.dead) return;
    e.dying = 0.35; e.flash = 0.35; e.stun = 0;
    if (e.trap) { e.trap.lemur = null; e.trap = null; }
    if (opts.kind === 'self') { e.dead = true; return; }
    var p = enemyScreen(e);
    addFx('explosion', e.X, e.z, e.h + 8, 0.4, 0.8);
    sfx('enemy_die');
    S.kills++;
    S.cheer = 1;
    var d = e.def;
    var xp = num(d.xp, 5);
    if (e.regrown) xp = Math.round(xp / 2);
    gcall('addXP', xp);
    var gr = Array.isArray(d.gold) ? d.gold : [0, 2];
    var gold = randi(num(gr[0], 0), num(gr[1], 2));
    if (gold > 0) { var got = gfn('addGold') ? gcall('addGold', gold) : gold; S.gold += num(got, gold); }
    var v = Math.max(1, Math.round(num(d.views, 6 + num(d.xp, 1) * 3) * (1 + Math.min(S.combo, 60) * 0.05) * (e.regrown ? 0.5 : 1)));
    S.views += v;
    // the odd snack or explosive tumbles out of the crowd
    if (!opts.quiet && e.id !== 'worm') {
      var rr = Math.random();
      if (rr < 0.05) { var xid = weighted([['jug', 3], ['hob', 2], ['smoke', 2], ['dyn', 1]]); if (gfn('giveItem')) gcall('giveItem', xid, 1); else run().items[xid] = (run().items[xid] || 0) + 1; pop(p.x, p.y - 28, '+1 ' + expName(xid), '#f8d878'); sfx('pickup'); }
      else if (rr < 0.12) { if (gfn('heal')) gcall('heal', 4); else run().hp = Math.min(stats().maxHp, run().hp + 4); pop(p.x, p.y - 28, 'SNACK +4', '#58d854'); sfx('heal', { vol: 0.5 }); }
    }
    if (!opts.quiet) pop(p.x, p.y - 18, '+' + v + ' VIEWS', '#f878f8');
    track('kill'); track('kill:' + e.id);
    if (opts.kind === 'bomb') track('bomb_kill');
    // mold lions regrow once unless the fire got them
    if ((d.regrow || e.id === 'mold_lion') && !e.regrown && opts.kind !== 'fire' && opts.fire !== true) {
      S.heaps.push({ X: e.X, z: Math.min(e.z, Z_FRONT), t: 6, id: e.id });
      pop(p.x, p.y - 28, 'IT WILL REGROW', '#58d854');
    }
  }
  function enemyScreen(e) { var s = sOf(e.z); return { x: xOf(e.X, e.z), y: yOf(e.z) - e.h * s, s: s }; }

  /* ---------------- Carl's projectiles ---------------- */
  function updProj(dt) {
    for (var i = 0; i < S.proj.length; i++) {
      var p = S.proj[i];
      if (p.done) continue;
      if (p.kind === 'junk') updJunk(p, dt);
      else if (p.kind === 'bomb') updBomb(p, dt);
      else if (p.kind === 'missile') updMissile(p, dt);
    }
    S.proj = S.proj.filter(function (p) { return !p.done; });
  }
  function updJunk(p, dt) {
    var z0 = p.z;
    p.z += p.vz * dt; p.spin += dt * 14;
    // closest enemy crossed this step in the lane
    var hit = null;
    for (var i = 0; i < S.enemies.length; i++) {
      var e = S.enemies[i];
      if (e.dead || e.dying > 0) continue;
      if (e.z <= z0 + 0.03 && e.z >= p.z - 0.03 && Math.abs(e.X - p.X) < e.hw + 5 && (!hit || e.z > hit.z)) hit = e;
    }
    if (hit) { hitEnemy(hit, num(stats().dmg, 3), { kind: 'junk' }); addFx('hit', hit.X, hit.z, hit.h + 10, 0.2, 1); p.done = true; return; }
    // Apollon's stand in the finale
    if (S.apollon && p.z <= S.apollon.z + 0.03 && z0 >= S.apollon.z - 0.03 && Math.abs(p.X - S.apollon.X) < 22) { heckleApollon(); p.done = true; addFx('hit', p.X, p.z, 14, 0.2, 1); return; }
    // the vine trunk
    if (S.finale && p.z <= 0.26 && Math.abs(p.X) < 22) { p.done = true; addFx('hit', p.X, 0.26, 40, 0.2, 1); var vs = enemyScreen({ X: 0, z: 0.26, h: 40 }); popOnce('immune', vs.x, vs.y, 'IMMUNE', '#58d854'); sfx('block', { vol: 0.4 }); return; }
    if (p.z <= 0) {
      p.done = true;
      if (S.target && !S.target.broken && Math.abs(p.X) < 22) {
        var d = Math.max(1, Math.round(num(stats().dmg, 3) * 0.35));
        damageTarget(d);
        addFx('hit', p.X, 0, 50, 0.2, 1);
      } else addFx('dust', p.X, 0, 30, 0.3, 0.8);
    }
  }
  function updBomb(p, dt) {
    if (!p.landed) {
      p.t += dt;
      var k = Math.min(1, p.t / p.T);
      p.z = lerp(1, p.tz, k);
      p.X = lerp(p.X0 === undefined ? (p.X0 = p.X) : p.X0, p.tX, k);
      p.h = lerp(22, p.tz < 0.05 ? 46 : 6, k) + Math.sin(k * Math.PI) * 70;
      if (k >= 1) {
        p.landed = true;
        if (p.type === 'dyn') { p.fuse = 1.2; p.h = p.tz < 0.05 ? 46 : 2; sfx('fuse'); }
        else { detonate(p); p.done = true; }
      }
    } else if (p.fuse > 0) {
      p.fuse -= dt;
      if (p.fuse <= 0) { detonate(p); p.done = true; }
    }
  }
  function detonate(p) {
    var st = stats(), type = p.type;
    if (type === 'smoke') {
      S.smokes.push({ X: p.X, z: p.z, r: 60, t: 4 });
      addFx('smoke', p.X, p.z, 10, 0.6, 2);
      sfx('smoke_puff');
      return;
    }
    var r = type === 'dyn' ? 72 : type === 'jug' ? 40 : 32;
    var dmg = type === 'dyn' ? num(st.dynDmg, 30) : type === 'jug' ? num(st.jugDmg, 14) : num(st.hobDmg, 16);
    blast(p.X, p.z, r, dmg, { kind: 'bomb', fire: type === 'jug' });
    addFx('explosion', p.X, p.z, 8, type === 'dyn' ? 0.6 : 0.45, type === 'dyn' ? 2.4 : 1.5);
    sfx('explosion'); DCW.shake(type === 'dyn' ? 5 : 3, type === 'dyn' ? 0.35 : 0.2);
    if (type === 'dyn') flash('#fcfcfc', 0.08);
    if (type === 'jug') { S.fires.push({ X: p.X, z: p.z, hw: 58, t: 3, tick: 0 }); sfx('fire_burst'); }
    S.cheer = 1.2;
  }
  function blast(X, z, r, dmg, opts) {
    var k = 0;
    S.enemies.forEach(function (e) {
      if (e.dead || e.dying > 0) return;
      var dd = Math.sqrt(Math.pow(e.X - X, 2) + Math.pow((e.z - z) * DEPTH_PX, 2));
      if (dd < r + e.hw) { hitEnemy(e, dmg, opts); if (e.hp <= 0) k++; }
    });
    if (k >= 3) track('multi_bomb');
    if (S.target && !S.target.broken && z < 0.06 && Math.abs(X) < r + 16) damageTarget(dmg);
    if (S.finale) {
      // explosions shred tendrils and scare the vine back a little
      S.tend.forEach(function (t) { if (t.kind === 'lane' && Math.abs(t.X - X) < r + 20) { t.st = 'retract'; t.k = Math.min(t.k || 0, 1); } });
      if (z < 0.3 && Math.abs(X) < r + 20) { var vs = enemyScreen({ X: 0, z: 0.26, h: 50 }); popOnce('immune', vs.x, vs.y, 'IMMUNE', '#58d854'); }
    }
  }
  function updMissile(p, dt) {
    p.t += dt;
    if (p.t < 0) return;
    var e = p.tgt;
    if (e && (e.dead || e.dying > 0)) e = p.tgt = null;
    var tx = e ? e.X : p.seekX, tz = e ? e.z : p.seekZ, th = e ? e.h + 12 : 30;
    var k = Math.min(1, dt * 4.5);
    p.X = lerp(p.X, tx, k); p.z = lerp(p.z, tz, k); p.h = lerp(p.h, th, k);
    if (Math.abs(p.X - tx) < 6 && Math.abs(p.z - tz) < 0.04) {
      p.done = true;
      if (e) { hitEnemy(e, p.dmg, { kind: 'missile' }); addFx('hit', e.X, e.z, e.h + 10, 0.2, 1); sfx('missile', { vol: 0.5 }); }
    }
    if (p.t > 2.5) p.done = true;
  }

  /* ---------------- enemy projectiles + hazards ---------------- */
  function updEnemyProj(dt) {
    var C = S.carl;
    S.eproj.forEach(function (q) {
      if (q.done) return;
      q.t += dt;
      var k = Math.min(1, q.t / q.T);
      q.X = lerp(q.X0, q.X1, k); q.z = lerp(q.z0, 1, k); q.h = lerp(q.h0, 14, k) + Math.sin(k * Math.PI) * 18;
      if (k >= 1) {
        q.done = true;
        if (Math.abs(C.X - q.X) < 13 && !(q.kind === 'knife' && C.h > 26)) hurtCarl(q.dmg, String(q.src || 'A KNIFE').toUpperCase());
        else { addFx('dust', q.X, 1, 2, 0.25, 0.8); }
      }
    });
    S.eproj = S.eproj.filter(function (q) { return !q.done; });
  }
  function updHazards(dt) {
    var C = S.carl;
    // belly-slam shockwaves along the front line
    S.shocks.forEach(function (w) {
      w.r += 300 * dt;
      if (!w.hit && Math.abs(C.X - w.X) <= w.r && Math.abs(C.X - w.X) >= w.r - 24) { w.hit = true; if (C.h < 6) hurtCarl(w.dmg, String(w.src || 'A CLOWN').toUpperCase()); else pop(xOf(C.X, 1), 140, 'JUMPED!', '#58d854'); }
    });
    S.shocks = S.shocks.filter(function (w) { return w.r < 260; });
    // jug fire strips
    S.fires.forEach(function (f) {
      f.t -= dt; f.tick -= dt;
      if (f.tick <= 0) {
        f.tick = 0.25;
        S.enemies.forEach(function (e) { if (!e.dead && !e.dying && e.h < 10 && Math.abs(e.X - f.X) < f.hw && Math.abs(e.z - f.z) * DEPTH_PX < 22) hitEnemy(e, 1, { kind: 'fire', fire: true }); });
      }
      S.heaps.forEach(function (hp) { if (!hp.burned && Math.abs(hp.X - f.X) < f.hw && Math.abs(hp.z - f.z) * DEPTH_PX < 30) { hp.burned = true; var p = enemyScreen({ X: hp.X, z: hp.z, h: 4 }); pop(p.x, p.y - 8, 'BURNED!', '#f8b800'); addFx('smoke', hp.X, hp.z, 6, 0.5, 1); track('mold_burned'); } });
    });
    S.fires = S.fires.filter(function (f) { return f.t > 0; });
    S.smokes.forEach(function (s) { s.t -= dt; }); S.smokes = S.smokes.filter(function (s) { return s.t > 0; });
    // regrowing mold heaps
    S.heaps.forEach(function (hp) {
      if (hp.burned) { hp.dead = true; return; }
      hp.t -= dt;
      if (hp.t <= 0 && !S.done && S.phase === 'fight') { hp.dead = true; spawnEnemy(hp.id, { X: hp.X, z: hp.z, regrown: true }); var p = enemyScreen({ X: hp.X, z: hp.z, h: 0 }); pop(p.x, p.y - 20, 'REGROWN!', '#58d854'); }
      else if (hp.t <= 0) hp.dead = true;
    });
    S.heaps = S.heaps.filter(function (h) { return !h.dead; });
    updTendrils(dt);
  }

  /* ---------------- the tent pole ---------------- */
  function damageTarget(n) {
    var T = S.target; if (!T || T.broken || S.phase === 'intro' && S.pt < 0.3) return;
    T.hp -= n; T.flash = 0.1; T.shake = 0.12;
    var fr = T.hp / T.maxHp, stage = fr > 0.75 ? 0 : fr > 0.5 ? 1 : fr > 0.25 ? 2 : 3;
    if (stage > T.stage) { T.stage = stage; sfx('glass_crack'); DCW.shake(2, 0.2); S.cheer = 1; addFx('dust', rand(-8, 8), 0, rand(30, 80), 0.4, 1.2); }
    sfx('hit', { vol: 0.4, pitch: 0.7 });
    S.special = Math.min(1, S.special + 0.01);
    if (T.hp <= 0) breakTarget();
  }
  function breakTarget() {
    var T = S.target; T.hp = 0; T.broken = true;
    S.phase = 'poleDown'; S.pt = 0;
    S.views += 150;
    sfx('boss_die'); DCW.shake(5, 0.8); flash('#fcfcfc', 0.12);
    track('tent_pole');
    // the crowd panics: every clown in the ring goes down
    S.enemies.forEach(function (e) { if (!e.dead && !e.dying) killEnemy(e, { kind: 'bomb', fire: true, quiet: true }); });
    S.eproj.length = 0; S.shocks.length = 0;
  }
  function updPoleDown(dt) {
    if (S.pt < 1.2 && Math.random() < dt * 14) addFx('explosion', rand(-14, 14), 0, rand(10, 120), 0.4, rand(0.8, 1.4));
    if (S.pt > 1.4 && !S.clearShown) {
      S.clearShown = true;
      ucall('announce', ((S.room && S.room.name) || 'RING') + ' CLEAR!', { color: '#58d854', time: 1.6, sub: '+150 VIEWS' });
      sfx('fanfare');
    }
    if (S.pt > 3.2) { S.clearShown = false; S.phase = 'advance'; S.pt = 0; sfx('door'); }
  }

  /* ---------------- the finale: Grimaldi's vine ---------------- */
  function updFinale(dt) {
    var F = S.finale, C = S.carl;
    F.t += dt;
    F.poison = clamp(F.t / F.seconds, 0, 1);
    var angry = 1 - F.poison * 0.45;
    // attacks
    F.attackT -= dt;
    if (F.attackT <= 0) {
      F.attackT = F.rate * angry * rand(0.8, 1.15);
      var r = Math.random();
      if (r < 0.55) S.tend.push({ kind: 'lane', X: clamp(C.X + rand(-20, 20), -140, 140), st: 'warn', t: 0, k: 0, hit: false, dmg: 3 });
      else S.tend.push({ kind: 'sweep', side: Math.random() < 0.5 ? -1 : 1, low: Math.random() < 0.55, st: 'warn', t: 0, x: 0, hit: false, dmg: 3 });
      if (F.poison > 0.5 && Math.random() < 0.35) S.tend.push({ kind: 'lane', X: clamp(-C.X * 0.6 + rand(-40, 40), -140, 140), st: 'warn', t: -0.3, k: 0, hit: false, dmg: 3 });
    }
    // worms crawl out of the sawdust
    F.wormT -= dt;
    var worms = S.enemies.filter(function (e) { return !e.dead && e.id === 'worm'; }).length;
    if (F.wormT <= 0 && worms < F.maxWorms) {
      F.wormT = rand(0.9, 1.8) * angry;
      var at = Math.random() < 0.5 ? { X: rand(-30, 30), z: 0.24 } : { X: rand(-140, 140), z: rand(0.3, 0.6) };
      var w = spawnEnemy('worm', at);
      addFx('dust', w.X, w.z, 2, 0.3, 0.8);
    }
    // Apollon sells ice cream through all of it
    var A = S.apollon;
    if (A) {
      A.lineT -= dt; if (A.lineShow > 0) A.lineShow -= dt;
      if (A.lineT <= 0) { A.lineT = rand(5, 8); A.line = pick(APOLLON_LINES); A.lineShow = 2.6; }
      if (A.throwT > 0) { A.throwT -= dt; if (A.throwT <= 0) S.eproj.push({ kind: 'cone', X0: A.X + 10, z0: A.z, h0: 30, X1: C.X, t: 0, T: 1.1, dmg: 2, src: 'APOLLON THE MIGHTY', sprite: 'cone' }); }
    }
    if (F.poison >= 1) {
      S.phase = 'vineDie'; S.pt = 0;
      S.tend.forEach(function (t) { t.st = 'retract'; });
      S.enemies.forEach(function (e) { if (!e.dead && !e.dying) killEnemy(e, { kind: 'fire', fire: true, quiet: true }); });
      S.eproj.length = 0;
      sfx('boss_die'); DCW.shake(4, 1.2);
      S.views += 400;
      track('grimaldi_poisoned');
    }
  }
  function heckleApollon() {
    var A = S.apollon; if (!A) return;
    A.hits++;
    A.line = A.hits >= 3 ? 'FINE. ON THE HOUSE.' : pick(['HEY! NO THROWING AT THE MERCHANDISE!', 'YOU BREAK IT, YOU EAT IT!', 'RUDE. CONE FOR YOU.']);
    A.lineShow = 2.2; A.lineT = 5;
    if (A.hits < 3) A.throwT = 0.5;
    sfx('worm_squish');
    track('apollon_heckle');
    if (A.hits === 3) { S.views += 50; S.cheer = 1.5; sfx('laugh'); }
  }
  function updTendrils(dt) {
    var C = S.carl;
    S.tend.forEach(function (t) {
      t.t += dt;
      if (t.kind === 'lane') {
        if (t.st === 'warn') { if (t.t > 0.85) { t.st = 'lash'; t.t = 0; sfx('boss_roar', { vol: 0.3, pitch: 2 }); } }
        else if (t.st === 'lash') {
          t.k = Math.min(1, t.t / 0.16);
          if (t.k >= 1 && !t.hit) { t.hit = true; if (Math.abs(C.X - t.X) < 22) hurtCarl(t.dmg, "GRIMALDI'S VINE"); DCW.shake(2, 0.12); }
          if (t.t > 0.55) { t.st = 'retract'; t.t = 0; }
        } else if (t.st === 'retract') { t.k = Math.max(0, (t.k || 1) - dt / 0.3); if (t.k <= 0) t.dead = true; }
      } else {
        if (t.st === 'warn') { if (t.t > 0.8) { t.st = 'sweep'; t.t = 0; sfx('laser', { vol: 0.4 }); } }
        else if (t.st === 'sweep') {
          var k = t.t / 0.6; t.x = k;
          var tipX = t.side < 0 ? lerp(-200, 200, k) : lerp(200, -200, k);
          if (!t.hit && ((t.side < 0 && tipX >= C.X) || (t.side > 0 && tipX <= C.X))) {
            t.hit = true;
            var safe = t.low ? C.h > 7 : C.duck;
            if (!safe) hurtCarl(t.dmg, "GRIMALDI'S VINE"); else pop(xOf(C.X, 1), 140, t.low ? 'JUMPED!' : 'DUCKED!', '#58d854');
          }
          if (k >= 1.2) t.dead = true;
        } else t.dead = true;
      }
    });
    S.tend = S.tend.filter(function (t) { return !t.dead; });
  }
  function updVineDie(dt) {
    if (S.pt < 2.2 && Math.random() < dt * 10) addFx('smoke', rand(-30, 30), rand(0.1, 0.3), rand(20, 140), 0.6, rand(1, 1.6));
    if (S.pt > 1.2 && !S.vineSaid) {
      S.vineSaid = true;
      ucall('announce', 'THE BLOOD PLAN IS WORKING', { color: '#58d854', time: 2.2, sub: 'SURVIVED +400 VIEWS' });
      sfx('fanfare');
    }
    if (S.pt > 3.4 && !S.doneSaid) {
      S.doneSaid = true;
      var f = S.rd.finale || {};
      var lines = Array.isArray(f.doneLines) ? f.doneLines : FINALE_DONE;
      if (lines.length && ufn('say')) { ucall('say', lines, { onDone: finishLevel }); return; }
      finishLevel();
    }
  }

  /* ---------------- companions ---------------- */
  function updCompanions(dt) {
    var C = S.carl, st = stats();
    var fighting = S.phase === 'fight' || S.phase === 'finale';
    if (S.donut && fighting) {
      S.donut.cd -= dt;
      if (S.donut.cd <= 0) {
        var tg = null;
        S.enemies.forEach(function (e) { if (!e.dead && !e.dying && e.z > 0.15 && (!tg || e.z > tg.z)) tg = e; });
        if (tg) {
          S.donut.cd = 1.4;
          S.proj.push({ kind: 'missile', X: C.X - 8, z: 1, h: 34, t: 0, tgt: tg, dmg: num(st.missileDmg, 4), seekX: tg.X, seekZ: tg.z });
          sfx('missile', { vol: 0.35 });
        } else S.donut.cd = 0.3;
      }
    }
    var M = S.mongo;
    if (M) {
      M.t += dt;
      if (M.state === 'side') {
        M.X = lerp(M.X, C.X + 26, Math.min(1, dt * 8)); M.z = 1;
        M.cd -= dt;
        if (M.cd <= 0 && fighting) {
          var best = null;
          S.enemies.forEach(function (e) { if (!e.dead && !e.dying && e.h < 12 && e.z > 0.55 && (!best || e.z > best.z)) best = e; });
          if (best) { M.state = 'go'; M.target = best; sfx('bite', { vol: 0.4, pitch: 1.4 }); } else M.cd = 0.5;
        }
      } else if (M.state === 'go') {
        var e2 = M.target;
        if (!e2 || e2.dead || e2.dying > 0) { M.state = 'back'; }
        else {
          M.X = lerp(M.X, e2.X, Math.min(1, dt * 6)); M.z -= dt * 1.6;
          if (M.z <= e2.z + 0.03) { hitEnemy(e2, num(st.biteDmg, 5), { kind: 'bite' }); sfx('bite'); M.state = 'back'; }
        }
      } else if (M.state === 'back') {
        M.z += dt * 1.8; M.X = lerp(M.X, C.X + 26, Math.min(1, dt * 4));
        if (M.z >= 1) { M.z = 1; M.state = 'side'; M.cd = rand(2.5, 3.5); }
      }
    }
  }

  /* ---------------- fx + popups ---------------- */
  function addFx(name, X, z, h, dur, size) { S.fx.push({ name: name, X: X, z: z, h: h, t: 0, dur: dur || 0.4, size: size || 1 }); }
  function popOnce(key, x, y, text, color) { S.popKeys = S.popKeys || {}; if ((S.popKeys[key] || 0) > S.t) return; S.popKeys[key] = S.t + 0.7; pop(x, y, text, color); }
  function pop(x, y, text, color) { S.pops.push({ x: x, y: y, text: String(text), color: color || '#fcfcfc', t: 0 }); if (S.pops.length > 14) S.pops.shift(); }
  function flash(c, t) { S.flashC = c; S.flashT = t; }
  function tickFx(dt) {
    S.fx.forEach(function (f) { f.t += dt; }); S.fx = S.fx.filter(function (f) { return f.t < f.dur; });
    S.pops.forEach(function (p) { p.t += dt; p.y -= dt * 18; }); S.pops = S.pops.filter(function (p) { return p.t < 0.9; });
  }

  /* ================================================================
     DRAW
     ================================================================ */
  function draw(ctx) {
    if (!S) { R(ctx, 0, 0, W, H, '#000'); return; }
    var st = S.style;
    drawTent(ctx, st);
    drawSides(ctx, st);
    drawFloor(ctx, st);
    drawBackWall(ctx, st);
    if (S.finale) drawVine(ctx);
    else drawPole(ctx);
    drawSpotlights(ctx, st);
    drawWorld(ctx);
    drawCarl(ctx);
    drawFrontFx(ctx);
    if (S.flashT > 0) { ctx.globalAlpha = 0.6; R(ctx, 0, 0, W, H, S.flashC); ctx.globalAlpha = 1; }
    if (S.phase === 'advance') { var a = clamp(1 - Math.abs(S.pt - 0.75) / 0.75, 0, 1); ctx.globalAlpha = a * 0.85; R(ctx, 0, 0, W, H, '#000'); ctx.globalAlpha = 1; }
    drawHud(ctx);
    if (S.fallbackMsg) { DCW.box(90, 70, 140, 36); DCW.text(S.fallbackMsg, 160, 84, '#f8d878', { align: 'center' }); }
    if (S.god) DCW.text('GOD', 4, H - 10, '#f8d878');
  }

  /* --- the big top canvas (ceiling) --- */
  function drawTent(ctx, st) {
    R(ctx, 0, 0, W, 120, '#000');
    // stripes radiating from the peak behind the HUD
    var px = 160, py = -60;
    for (var i = -12; i <= 12; i++) {
      var x0 = 160 + i * 34, x1 = 160 + (i + 1) * 34;
      ctx.fillStyle = (i & 1) ? st.aD : st.a;
      ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(x0, 70); ctx.lineTo(x1, 70); ctx.closePath(); ctx.fill();
    }
    // scalloped trim where the canvas meets the walls
    for (var x = 0; x < W; x += 12) { R(ctx, x, 40, 12, 2, st.b); disc(ctx, x + 6, 42, 4, (x / 12) & 1 ? st.b : st.a); }
    R(ctx, 0, 36, W, 4, '#000');
    // rigging lines
    ctx.fillStyle = '#000';
    for (var k = 0; k < 6; k++) { var lx = 30 + k * 52; R(ctx, lx, 14, 1, 22, '#503000'); }
  }
  /* --- side walls with bleachers and the crowd --- */
  function drawSides(ctx, st) {
    var cheer = S.cheer > 0 ? 1 : 0, boo = S.boo > 0 ? 1 : 0;
    for (var side = -1; side <= 1; side += 2) {
      // wall plane X = side*WALLX, from d=ZD0 (back) to the screen edge
      var dEdge = WALLX / 160; // where the wall leaves the screen
      var steps = 18;
      for (var j = 0; j < steps; j++) {
        var d0 = lerp(ZD0, dEdge, j / steps), d1 = lerp(ZD0, dEdge, (j + 1) / steps);
        var s0 = 1 / d0, s1 = 1 / d1;
        var x0 = 160 + side * WALLX * s0, x1 = 160 + side * WALLX * s1;
        var fy0 = VY + (FY - VY) * s0, fy1 = VY + (FY - VY) * s1;
        // tent wall stripe column
        ctx.fillStyle = (j & 1) ? st.wall : st.wallB;
        quad(ctx, x0, fy0 - WALLH * s0, x1, fy1 - WALLH * s1, x1, fy1, x0, fy0);
      }
      // bleachers: tiers up the wall
      var tiers = 6;
      for (var t = 0; t < tiers; t++) {
        var hA = 6 + t * 12, hB = hA + 12;
        for (var j2 = 0; j2 < steps; j2++) {
          var e0 = lerp(ZD0, dEdge, j2 / steps), e1 = lerp(ZD0, dEdge, (j2 + 1) / steps);
          var q0 = 1 / e0, q1 = 1 / e1;
          var a0 = 160 + side * WALLX * q0, a1 = 160 + side * WALLX * q1;
          var g0 = VY + (FY - VY) * q0, g1 = VY + (FY - VY) * q1;
          ctx.fillStyle = st.seat;
          quad(ctx, a0, g0 - hB * q0, a1, g1 - hB * q1, a1, g1 - hA * q1, a0, g0 - hA * q0);
          ctx.fillStyle = '#000';
          quad(ctx, a0, g0 - hA * q0 - 2 * q0, a1, g1 - hA * q1 - 2 * q1, a1, g1 - hA * q1, a0, g0 - hA * q0);
        }
        // crowd heads on this tier
        var n = 14;
        for (var c = 0; c < n; c++) {
          var dd = lerp(ZD0 - 0.04, dEdge + 0.02, (c + 0.5) / n);
          var sc = 1 / dd;
          var hx = 160 + side * (WALLX - 6) * sc, hy = VY + (FY - VY) * sc - (hA + 8) * sc;
          var seed = (c * 7 + t * 13 + (side > 0 ? 5 : 0)) % 11;
          if (S.finale && seed % 4) continue;
          var bob = cheer ? Math.round(Math.abs(Math.sin(DCW.t * 9 + seed)) * 3 * sc) : boo ? Math.round(Math.sin(DCW.t * 14 + seed) * 1.5) : 0;
          var hr = Math.max(1, Math.round(3.4 * sc));
          var col = seed === 3 ? '#a81000' : seed === 7 ? '#0000bc' : st.crowd;
          disc(ctx, Math.round(hx), Math.round(hy - bob), hr, col);
          R(ctx, Math.round(hx - hr - 1), Math.round(hy + hr - bob), hr * 2 + 3, Math.round(4 * sc) + 1, col);
          if (cheer && seed % 3 === 0) R(ctx, Math.round(hx + side * hr), Math.round(hy - hr * 2 - bob), 1, hr + 1, col);
          if (seed === 5) PX(ctx, Math.round(hx), Math.round(hy - hr - bob), '#f8b800'); // popcorn hat
        }
      }
    }
  }
  function quad(ctx, x0, y0, x1, y1, x2, y2, x3, y3) {
    ctx.beginPath(); ctx.moveTo(Math.round(x0), Math.round(y0)); ctx.lineTo(Math.round(x1), Math.round(y1)); ctx.lineTo(Math.round(x2), Math.round(y2)); ctx.lineTo(Math.round(x3), Math.round(y3)); ctx.closePath(); ctx.fill();
  }
  /* --- sawdust floor: depth bands + the ring curb --- */
  var RING_DC = 1.62, RING_R = 84;
  function drawFloor(ctx, st) {
    for (var y = BACK_Y; y < H; y++) {
      var s = (y + 0.5 - VY) / (FY - VY), d = 1 / s;
      var hw = WALLX * s;
      var band = Math.floor(d * 7 - S.scroll) & 1;
      var far = d > 1.8;
      var col = band ? st.floorA : st.floorB;
      if (far && band) col = st.floorB === '#881400' ? '#503000' : '#a85010';
      R(ctx, Math.round(160 - hw), y, Math.round(hw * 2) + 1, 1, col);
      // inside the ring
      var dz = (d - RING_DC) * 154;
      if (Math.abs(dz) < RING_R) {
        var ex = Math.sqrt(RING_R * RING_R - dz * dz);
        R(ctx, Math.round(160 - ex * s), y, Math.round(ex * s * 2), 1, band ? st.ring : st.floorA);
      }
    }
    // sawdust specks
    for (var i = 0; i < 70; i++) {
      var sx = (i * 97) % 320, sy = BACK_Y + 2 + ((i * 53) % (H - BACK_Y - 2));
      var ss = (sy - VY) / (FY - VY);
      if (Math.abs(sx - 160) < WALLX * ss) PX(ctx, sx, sy, '#fce0a8');
    }
    // ring curb: red / white blocks on the circle
    var N = 40;
    for (var k = 0; k < N; k++) {
      var a0 = k / N * Math.PI * 2, a1 = (k + 1) / N * Math.PI * 2;
      var X0 = Math.cos(a0) * RING_R, D0 = RING_DC + Math.sin(a0) * RING_R / 154;
      var X1 = Math.cos(a1) * RING_R, D1 = RING_DC + Math.sin(a1) * RING_R / 154;
      var s0 = 1 / D0, s1 = 1 / D1;
      var px0 = 160 + X0 * s0, py0 = VY + (FY - VY) * s0, px1 = 160 + X1 * s1, py1 = VY + (FY - VY) * s1;
      var th0 = Math.max(2, 6 * s0), th1 = Math.max(2, 6 * s1);
      ctx.fillStyle = (k & 1) ? st.curbA : st.curbB;
      quad(ctx, px0, py0 - th0, px1, py1 - th1, px1, py1, px0, py0);
      ctx.fillStyle = '#000';
      quad(ctx, px0, py0, px1, py1, px1, py1 + 1, px0, py0 + 1);
    }
  }
  /* --- back wall: stripes, flaps --- */
  function drawBackWall(ctx, st) {
    var y0 = BACK_TOP, y1 = BACK_Y;
    for (var x = BACK_X0, i = 0; x < BACK_X1; x += 8, i++) R(ctx, x, y0, Math.min(8, BACK_X1 - x), y1 - y0, (i & 1) ? st.wall : st.wallB);
    R(ctx, BACK_X0, y0, BACK_X1 - BACK_X0, 2, '#000');
    R(ctx, BACK_X0, y1 - 3, BACK_X1 - BACK_X0, 3, '#000');
    // tent flaps where the clowns come out
    FLAPS.forEach(function (X) {
      var cx = Math.round(xOf(X, 0)), w = 20, h = 30, top = y1 - h;
      // dark doorway with a rounded top
      R(ctx, cx - w / 2 - 1, top + 3, w + 2, h - 3, '#000'); R(ctx, cx - w / 2 + 2, top, w - 4, 4, '#000');
            // drapes tied back at the sides
      for (var sd = -1; sd <= 1; sd += 2) {
        var ox = cx + sd * (w / 2 + 1);
        ctx.fillStyle = '#000';
        ctx.beginPath(); ctx.moveTo(ox, top - 1); ctx.lineTo(cx + sd * 1, top - 1); ctx.lineTo(ox - sd * 3, y1 - 12); ctx.lineTo(ox + sd * 1, y1); ctx.lineTo(ox + sd * 2, y1); ctx.lineTo(ox + sd * 2, top - 1); ctx.closePath(); ctx.fill();
        ctx.fillStyle = st.a;
        ctx.beginPath(); ctx.moveTo(ox + sd * 1, top); ctx.lineTo(cx + sd * 3, top); ctx.lineTo(ox - sd * 2, y1 - 12); ctx.lineTo(ox + sd * 1, y1 - 1); ctx.closePath(); ctx.fill();
        R(ctx, ox - sd * 3 - 1, y1 - 13, 3, 2, '#f8b800'); // tie-back
      }
      // valance with scallops
      R(ctx, cx - w / 2 - 4, top - 4, w + 8, 4, st.b); R(ctx, cx - w / 2 - 4, top - 5, w + 8, 1, '#000');
      for (var vx = cx - w / 2 - 3; vx < cx + w / 2 + 3; vx += 4) R(ctx, vx, top, 3, 1, st.b);
      // eyes in the dark
      if ((Math.floor(DCW.t * 0.7 + X) & 3) === 0) { PX(ctx, cx - 3, y1 - 14, '#f8d878'); PX(ctx, cx + 1, y1 - 14, '#f8d878'); }
    });
  }
  /* --- the target: a giant tent pole with crack stages --- */
  function drawPole(ctx) {
    var T = S.target; if (!T) return;
    var cx = 160 + (T.shake > 0 ? Math.round(rand(-2, 2)) : 0), base = BACK_Y;
    var broken = T.broken, fall = broken ? clamp(S.pt / 1.2, 0, 1) : 0;
    var topY = broken ? Math.round(lerp(0, base - 26, fall)) : 0;
    var art = artHas('tent_pole') ? sprInfo('tent_pole') : null;
    if (art && !broken) {
      var fr = art.frames >= 4 ? T.stage : 0;
      DCW.art.sprite(ctx, 'tent_pole', cx, base, { frame: fr, flash: T.flash > 0 });
      if (art.frames < 4) drawCracks(ctx, cx, base, T.stage);
      return;
    }
    var w = 14;
    // candy-striped pole
    for (var y = topY; y < base; y++) {
      var band = Math.floor((y - DCW.t * 0) / 6) & 1;
      R(ctx, cx - w / 2, y, w, 1, T.flash > 0 ? '#fcfcfc' : band ? '#f83800' : '#fcfcfc');
    }
    R(ctx, cx - w / 2 - 1, topY, 1, base - topY, '#000'); R(ctx, cx + w / 2, topY, 1, base - topY, '#000');
    R(ctx, cx + w / 2 - 3, topY, 2, base - topY, 'rgba(0,0,0,0.25)');
    // brass bands + base collar
    for (var b = 0; b < 3; b++) { var by = 30 + b * 22; if (by > topY) R(ctx, cx - w / 2 - 1, by, w + 2, 3, '#f8b800'); }
    R(ctx, cx - w / 2 - 4, base - 8, w + 8, 8, '#7c7c7c'); R(ctx, cx - w / 2 - 4, base - 8, w + 8, 2, '#bcbcbc'); R(ctx, cx - w / 2 - 5, base - 1, w + 10, 1, '#000');
    if (!broken) drawCracks(ctx, cx, base, T.stage);
    else { // splintered stump
      for (var k = 0; k < 5; k++) R(ctx, cx - w / 2 + k * 3, topY - (k % 2 ? 3 : 6), 2, 6, '#fce0a8');
    }
    // weak point marker so the player knows what to hit
    if (!broken && S.phase === 'fight' && Math.floor(DCW.t * 2) % 2 === 0) DCW.text('▼', cx, base - 52, '#f8d878', { align: 'center' });
  }
  function drawCracks(ctx, cx, base, stage) {
    if (stage <= 0) return;
    var pts = [[0, 60], [-3, 54], [2, 48], [-2, 40], [3, 34], [-1, 26], [2, 18]];
    var n = Math.min(pts.length, 2 + stage * 2);
    for (var i = 0; i < n; i++) { R(ctx, cx + pts[i][0], base - pts[i][1], 2, 6, '#000'); if (stage >= 2) R(ctx, cx + pts[i][0] + 2, base - pts[i][1] + 2, 2, 1, '#000'); }
    if (stage >= 3) { R(ctx, cx - 7, base - 44, 14, 2, '#000'); R(ctx, cx - 5, base - 47, 3, 3, '#503000'); }
  }
  /* --- Grimaldi's vine --- */
  function drawVine(ctx) {
    var F = S.finale, die = S.phase === 'vineDie' ? clamp(S.pt / 2.5, 0, 1) : 0;
    var rise = F ? F.rise : 1;
    var z = 0.26, s = sOf(z), bx = 160, by = Math.round(yOf(z));
    var green = die > 0.5 ? '#887000' : '#00a800', dark = die > 0.5 ? '#503000' : '#005800', light = die > 0.5 ? '#ac7c00' : '#58d854';
    var top = Math.round(lerp(by, 14, rise));
    var sway = Math.sin(DCW.t * 1.3) * (4 - die * 3);
    // roots spreading over the ring
    for (var r = 0; r < 7; r++) {
      var ang = (r / 7) * Math.PI * 2 + 0.3;
      var rx = Math.cos(ang) * 46, rz = Math.sin(ang) * 0.12;
      var ex = xOf(rx, z + rz), ey = yOf(z + rz);
      thickLine(ctx, bx, by - 2, ex, ey, Math.max(2, Math.round(5 * s)), dark);
    }
    // trunk: three braided strands, the back halves first
    var pts = [[], []];
    for (var i = 0; i < 3; i++) {
      var ph = i * 2.094;
      for (var y = by; y > top; y -= 2) {
        var k = (by - y) / Math.max(1, by - 14);
        var wd = lerp(12, 5, k) * (1 - die * 0.3);
        var ang = y * 0.06 + ph + DCW.t * 1.1;
        var x = bx + Math.sin(ang) * wd + sway * k;
        var rr = Math.max(2, Math.round(lerp(7, 3, k) - die * 1.5));
        pts[Math.cos(ang) >= 0 ? 1 : 0].push([Math.round(x), y, rr, i, (y >> 1) % 9 === i * 3]);
      }
    }
    for (var pass = 0; pass < 2; pass++) {
      var L = pts[pass];
      for (var a = 0; a < L.length; a++) disc(ctx, L[a][0], L[a][1], L[a][2] + 1, '#000');
      for (var b2 = 0; b2 < L.length; b2++) {
        var q = L[b2];
        disc(ctx, q[0], q[1], q[2], pass ? green : dark);
        if (pass) PX(ctx, q[0] - q[2] + 1, q[1], light);
        if (pass && q[4]) { // leaves and thorns
          R(ctx, q[0] + q[2], q[1] - 2, 3, 2, light); R(ctx, q[0] + q[2] + 2, q[1] - 3, 2, 1, light);
          PX(ctx, q[0] - q[2] - 1, q[1] + 1, '#fce0a8');
        }
      }
    }
    // pulsing bulbs + Grimaldi's face in the bark
    var fy = Math.round(lerp(by, top, 0.35));
    if (rise > 0.5) {
      if (artHas('grimaldi_face')) DCW.art.sprite(ctx, 'grimaldi_face', bx + Math.round(sway * 0.4), fy + 12, { frame: Math.floor(DCW.t * 2) });
      else {
        var eyeC = die > 0.3 ? '#7c7c7c' : (Math.floor(DCW.t * 3) & 1 ? '#f83800' : '#f8d878');
        ell(ctx, bx, fy + 2, 11, 9, '#000'); ell(ctx, bx, fy + 2, 10, 8, dark); R(ctx, bx - 8, fy - 5, 16, 1, light);
        R(ctx, bx - 6, fy - 2, 4, 3, '#000'); R(ctx, bx + 2, fy - 2, 4, 3, '#000');
        R(ctx, bx - 5, fy - 1, 2, 1, eyeC); R(ctx, bx + 3, fy - 1, 2, 1, eyeC);
        R(ctx, bx - 5, fy + 5, 10, 3, '#000'); for (var tq = 0; tq < 5; tq++) PX(ctx, bx - 4 + tq * 2, fy + 5, '#fce0a8');
      }
      for (var bl = 0; bl < 4; bl++) {
        var bly = Math.round(lerp(by, top, 0.2 + bl * 0.18)), blx = bx + (bl & 1 ? 12 : -12) + Math.round(Math.sin(DCW.t + bl) * 2);
        var pr = 3 + Math.round((Math.sin(DCW.t * 4 + bl) + 1) * 0.8);
        disc(ctx, blx, bly, pr + 1, '#000'); disc(ctx, blx, bly, pr, die > 0.5 ? '#7c7c7c' : '#d800cc'); PX(ctx, blx - 1, bly - 1, '#f8b8f8');
      }
    }
    // poison creeping up the trunk
    if (F && F.poison > 0) {
      var ph = Math.round((by - top) * F.poison);
      for (var py = by; py > by - ph; py -= 4) { var po = Math.round(Math.sin(py * 0.09 + DCW.t * 1.6) * 3); PX(ctx, bx + po - 3 + ((py >> 2) % 5), py - 2, '#9878f8'); PX(ctx, bx + po + 4 - ((py >> 2) % 4), py - 1, '#d8b8f8'); }
    }
  }
  function thickLine(ctx, x0, y0, x1, y1, th, col) {
    var n = Math.max(1, Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) / 2));
    for (var i = 0; i <= n; i++) { var k = i / n; var x = Math.round(lerp(x0, x1, k)), y = Math.round(lerp(y0, y1, k)); R(ctx, x - (th >> 1), y - (th >> 1), th, th, col); }
  }
  /* --- spotlights --- */
  function drawSpotlights(ctx, st) {
    var t = DCW.t;
    ctx.globalAlpha = 0.13;
    ctx.fillStyle = st.light;
    for (var i = 0; i < 2; i++) {
      var sx = i ? 300 : 20, tx = 160 + Math.sin(t * 0.6 + i * 2.2) * 110, ty = 150 + Math.sin(t * 0.9 + i) * 14;
      ctx.beginPath(); ctx.moveTo(sx - 4, 14); ctx.lineTo(sx + 4, 14); ctx.lineTo(tx + 34, ty); ctx.lineTo(tx - 34, ty); ctx.closePath(); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  /* --- everything with a depth, back to front --- */
  function drawWorld(ctx) {
    var items = [];
    S.trapezes.forEach(function (tp) { items.push({ z: tp.z - 0.001, f: drawTrapeze, o: tp }); });
    S.heaps.forEach(function (hp) { items.push({ z: hp.z - 0.002, f: drawHeap, o: hp }); });
    S.fires.forEach(function (f) { items.push({ z: f.z - 0.003, f: drawFire, o: f }); });
    S.enemies.forEach(function (e) { items.push({ z: e.z, f: drawEnemy, o: e }); });
    S.proj.forEach(function (p) { items.push({ z: p.z + 0.001, f: drawProj, o: p }); });
    S.eproj.forEach(function (q) { items.push({ z: q.z + 0.001, f: drawEProj, o: q }); });
    S.fx.forEach(function (f) { if (f.z < 0.99) items.push({ z: f.z + 0.002, f: drawFx, o: f }); });
    S.smokes.forEach(function (s) { items.push({ z: s.z + 0.004, f: drawSmoke, o: s }); });
    if (S.apollon) items.push({ z: S.apollon.z, f: drawApollon, o: S.apollon });
    S.tend.forEach(function (t) { if (t.kind === 'lane') items.push({ z: 0.3, f: drawLaneTendril, o: t }); });
    if (S.mongo && S.mongo.state !== 'side') items.push({ z: S.mongo.z, f: drawMongo, o: S.mongo });
    items.sort(function (a, b) { return a.z - b.z; });
    items.forEach(function (it) { it.f(ctx, it.o); });
    // shockwaves on the front line
    S.shocks.forEach(function (w) {
      var y = Math.round(yOf(Z_FRONT)) + 6;
      for (var sd = -1; sd <= 1; sd += 2) {
        var x = Math.round(xOf(w.X + sd * w.r, 1));
        R(ctx, x - 6, y - 3, 12, 3, '#fcfcfc'); R(ctx, x - 4, y - 6, 8, 3, '#f8d878'); R(ctx, x - 7, y, 14, 1, '#000');
      }
    });
  }
  function drawTrapeze(ctx, tp) {
    var p = trapPos(tp, S.t), s = sOf(tp.z);
    var ax = xOf(tp.X, tp.z), ay = yOf(tp.z) - tp.top * s;
    var bx = xOf(p.X, tp.z), by = yOf(tp.z) - p.h * s;
    var bw = Math.round(22 * s);
    thinLine(ctx, ax - bw / 2, ay, bx - bw / 2, by, '#bcbcbc');
    thinLine(ctx, ax + bw / 2, ay, bx + bw / 2, by, '#bcbcbc');
    R(ctx, Math.round(bx - bw / 2) - 1, Math.round(by) - 1, bw + 2, 4, '#000');
    R(ctx, Math.round(bx - bw / 2), Math.round(by), bw, 2, '#f8b800');
  }
  function thinLine(ctx, x0, y0, x1, y1, col) {
    var n = Math.max(1, Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))));
    ctx.fillStyle = col;
    for (var i = 0; i <= n; i += 1) { var k = i / n; ctx.fillRect(Math.round(lerp(x0, x1, k)), Math.round(lerp(y0, y1, k)), 1, 1); }
  }
  function drawShadow(ctx, X, z, w) {
    var s = sOf(z), x = Math.round(xOf(X, z)), y = Math.round(yOf(z));
    var rw = Math.max(2, Math.round(w * s)), rh = Math.max(1, Math.round(3 * s));
    ctx.globalAlpha = 0.45; ell(ctx, x, y, rw, rh, '#000'); ctx.globalAlpha = 1;
  }
  var ENEMY_FB = { fat_clown: 'rooms_fat_clown', stilt_clown: 'rooms_stilt_clown', lemur: 'rooms_lemur', mold_lion: 'rooms_mold_lion', worm: 'rooms_worm' };
  function enemySprite(e, kind) {
    var base = e.def.sprite || e.id;
    var n = base + '_' + kind;
    if (artHas(n)) return n;
    if (e.id === 'worm' && artHas('worm')) return 'worm';
    if (kind !== 'walk' && artHas(base + '_walk')) return base + '_walk';
    var fb = ENEMY_FB[e.id];
    if (fb) { if (e.id === 'worm') return 'rooms_worm'; if (FB[fb + '_' + kind]) return fb + '_' + kind; return fb + '_walk'; }
    return null;
  }
  function drawEnemy(ctx, e) {
    var p = enemyScreen(e);
    var sc = qScale(p.s) * (e.lunge > 0 ? 1.25 : 1);
    if (e.h > 2 && !e.trap) drawShadow(ctx, e.X, e.z, e.hw);
    var kind = e.flash > 0 && e.dying <= 0 ? 'hurt' : (e.st === 'wind' || e.st === 'charge' || e.st === 'air' || e.lunge > 0) ? 'attack' : 'walk';
    var name = enemySprite(e, kind);
    var o = { frame: Math.floor(e.anim * (e.mode === 'worm' ? 6 : 5)), flip: e.face < 0, scale: sc, flash: e.flash > 0 && Math.floor(DCW.t * 30) % 2 === 0 };
    var y = p.y;
    if (e.trap) { var hi = name ? sprInfo(name) : null; y += Math.round((hi ? hi.h : 16) * sc) - 1; } // hanging under the bar
    if (e.dying > 0) o.alpha = clamp(e.dying / 0.35, 0, 1);
    if (e.st === 'wind' && Math.floor(DCW.t * 16) % 2 === 0) o.flash = true;
    if (!(name && spr(ctx, name, p.x, y, o))) {
      var w = Math.round(e.hw * 2 * sc), h = Math.round(18 * sc);
      R(ctx, p.x - w / 2 - 1, y - h - 1, w + 2, h + 2, '#000'); R(ctx, p.x - w / 2, y - h, w, h, '#f878f8');
    }
    if (e.stun > 0 && e.dying <= 0) DCW.text('?', p.x, y - 40 * sc, '#d8b8f8', { align: 'center' });
    if (e.st === 'wind' && e.dying <= 0) DCW.text('!', p.x, y - (e.mode === 'stilt' ? 52 : 30) * sc, '#f83800', { align: 'center' });
  }
  function drawHeap(ctx, hp) {
    var s = sOf(hp.z), x = xOf(hp.X, hp.z), y = yOf(hp.z);
    var o = { frame: Math.floor(DCW.t * 4), scale: qScale(s) * (1 + (6 - hp.t) * 0.05) };
    if (hp.t < 1.5 && Math.floor(DCW.t * 12) % 2) o.flash = true;
    spr(ctx, 'rooms_mold_heap', x, y, o);
  }
  function drawFire(ctx, f) {
    var s = sOf(f.z), y = Math.round(yOf(f.z)), x0 = xOf(f.X - f.hw, f.z), x1 = xOf(f.X + f.hw, f.z);
    var useArt = artHas('fire');
    for (var x = x0; x < x1; x += Math.max(4, 9 * s)) {
      var fr = Math.floor(DCW.t * 10 + x);
      if (useArt) DCW.art.sprite(ctx, 'fire', Math.round(x), y, { frame: fr, scale: qScale(s) });
      else {
        var hh = Math.round((6 + (fr % 3) * 3) * s * 1.6);
        R(ctx, Math.round(x) - 2, y - hh, 5, hh, '#f83800'); R(ctx, Math.round(x) - 1, y - hh + 2, 3, hh - 2, '#f8b800'); PX(ctx, Math.round(x), y - hh, '#fcfcfc');
      }
    }
  }
  function drawSmoke(ctx, sm) {
    var s = sOf(sm.z), x = xOf(sm.X, sm.z), y = yOf(sm.z);
    ctx.globalAlpha = clamp(sm.t / 1.2, 0, 0.75);
    for (var i = 0; i < 7; i++) disc(ctx, Math.round(x + Math.cos(i * 0.9 + DCW.t) * sm.r * s * 0.7), Math.round(y - 10 * s - Math.abs(Math.sin(i * 1.7 + DCW.t * 0.7)) * 26 * s), Math.round((12 + (i % 3) * 4) * s), i % 2 ? '#bcbcbc' : '#7c7c7c');
    ctx.globalAlpha = 1;
  }
  var PROJ_ART = { jug: ['jug', 'rooms_jug'], hob: ['hob', 'rooms_hob'], dyn: ['dyn_stick', 'rooms_dyn'], smoke: ['smoke_bomb', 'rooms_smokeball'] };
  function drawProj(ctx, p) {
    var s = sOf(p.z), x = xOf(p.X, p.z), y = yOf(p.z) - (p.h !== undefined ? p.h : lerp(18, 60, 1 - p.z)) * s;
    if (p.kind === 'junk') {
      var hh = lerp(p.h0, 58, 1 - p.z);
      y = yOf(p.z) - hh * s;
      var nm = artHas('ring_junk') ? 'ring_junk' : 'rooms_ring_junk';
      spr(ctx, nm, x, y, { frame: p.frame, scale: qScale(s), flip: Math.floor(p.spin) % 2 === 0 });
    } else if (p.kind === 'bomb') {
      if (!p.landed || p.fuse > 0) drawShadow(ctx, p.X, p.z, 5);
      var names = PROJ_ART[p.type] || PROJ_ART.jug;
      var o = { frame: Math.floor(DCW.t * 10), scale: qScale(s), flash: p.fuse > 0 && Math.floor(DCW.t * 12) % 2 === 0 };
      if (!spr(ctx, names[0], x, y, o)) spr(ctx, names[1], x, y, o);
    } else if (p.kind === 'missile') {
      if (p.t < 0) return;
      if (!spr(ctx, 'missile', x, y, { frame: Math.floor(DCW.t * 12), scale: qScale(s) })) spr(ctx, 'rooms_missile', x, y, { frame: Math.floor(DCW.t * 12), scale: 1 });
    }
  }
  function drawEProj(ctx, q) {
    var s = sOf(q.z), x = xOf(q.X, q.z), y = yOf(q.z) - q.h * s;
    // landing marker so the player can dodge
    var mx = Math.round(xOf(q.X1, 1)), my = FY - 2;
    if (Math.floor(DCW.t * 10) % 2) { R(ctx, mx - 7, my, 14, 2, '#f83800'); R(ctx, mx - 1, my - 3, 2, 2, '#f83800'); }
    var name = q.sprite === 'cone' ? 'rooms_cone' : (artHas('knife') ? 'knife' : 'rooms_knife');
    spr(ctx, name, x, y, { frame: Math.floor(DCW.t * 12), scale: qScale(s) });
  }
  function drawFx(ctx, f) {
    var s = sOf(f.z), x = xOf(f.X, f.z), y = yOf(f.z) - f.h * s;
    var k = f.t / f.dur, sc = qScale(s) * f.size;
    var info = sprInfo(f.name);
    if (info && artHas(f.name)) { DCW.art.sprite(ctx, f.name, x, y + info.h * sc / 2, { frame: Math.floor(k * info.frames), scale: sc }); return; }
    if (f.name === 'explosion') {
      var r = Math.round((4 + k * 14) * sc);
      disc(ctx, Math.round(x), Math.round(y), r + 1, '#000'); disc(ctx, Math.round(x), Math.round(y), r, k < 0.5 ? '#fcfcfc' : '#f83800'); disc(ctx, Math.round(x), Math.round(y), Math.max(1, r - 3), k < 0.5 ? '#f8d878' : '#f8b800');
    } else if (f.name === 'hit') {
      var a = Math.round((2 + k * 6) * sc);
      R(ctx, x - a, y, a * 2, 1, '#fcfcfc'); R(ctx, x, y - a, 1, a * 2, '#fcfcfc'); R(ctx, x - 1, y - 1, 3, 3, '#f8d878');
    } else {
      var rr = Math.round((3 + k * 8) * sc); ctx.globalAlpha = 1 - k;
      disc(ctx, Math.round(x), Math.round(y), rr, f.name === 'smoke' ? '#7c7c7c' : '#fce0a8'); ctx.globalAlpha = 1;
    }
  }
  function drawApollon(ctx, A) {
    var s = sOf(A.z), x = xOf(A.X, A.z), y = yOf(A.z), sc = qScale(s) < 0.75 ? 0.75 : qScale(s);
    var a = anySprite(['apollon']); if (!a) a = 'rooms_apollon';
    spr(ctx, a, Math.round(x - 10 * sc), Math.round(y), { frame: Math.floor(DCW.t * 2), scale: sc });
    spr(ctx, 'rooms_icecream_stand', Math.round(x + 10 * sc), Math.round(y), { frame: Math.floor(DCW.t * 3), scale: sc });
    if (A.lineShow > 0 && A.line) {
      var tw = DCW.textWidth(A.line), bx = clamp(Math.round(x - 8), 4, W - tw - 12), by = Math.round(y - 38 * sc - 14);
      DCW.box(bx, by, tw + 8, 13, { fill: '#fcfcfc', border: '#000', border2: '#000' });
      DCW.text(A.line, bx + 4, by + 3, '#000', { shadow: null });
    }
  }
  function drawLaneTendril(ctx, t) {
    var baseZ = 0.27;
    if (t.st === 'warn') {
      if (Math.floor(DCW.t * 12) % 2) for (var z = baseZ; z < 1; z += 0.05) { var s = sOf(z); R(ctx, Math.round(xOf(t.X - 14, z)), Math.round(yOf(z)) - 1, Math.round(28 * s), 2, '#005800'); }
      return;
    }
    var k = t.k || 0, endZ = lerp(baseZ, 1.0, k);
    var steps = 26, pts = [];
    for (var i = 0; i <= steps; i++) {
      var u = i / steps, zz = lerp(baseZ, endZ, u), X = lerp(0, t.X, u) + Math.sin(u * 9 + DCW.t * 12) * 6 * u;
      var ss = sOf(zz);
      pts.push([Math.round(xOf(X, zz)), Math.round(yOf(zz) - (8 + Math.sin(u * Math.PI) * 26) * ss), Math.max(1, Math.round(lerp(6, 2, u) * ss * 1.3))]);
    }
    for (var a = 0; a < pts.length; a++) disc(ctx, pts[a][0], pts[a][1], pts[a][2] + 1, '#000');
    for (var b = 0; b < pts.length; b++) {
      disc(ctx, pts[b][0], pts[b][1], pts[b][2], b % 4 < 2 ? '#00a800' : '#007800');
      PX(ctx, pts[b][0] - pts[b][2] + 1, pts[b][1] - 1, '#58d854');
      if (b % 5 === 2) { R(ctx, pts[b][0] + pts[b][2], pts[b][1] - 2, 2, 1, '#fce0a8'); R(ctx, pts[b][0] - pts[b][2] - 2, pts[b][1] + 1, 2, 1, '#fce0a8'); }
    }
    var tip = pts[pts.length - 1];
    if (k > 0.5) { R(ctx, tip[0] - 1, tip[1] - 5, 3, 4, '#fce0a8'); R(ctx, tip[0] - 3, tip[1] - 3, 2, 2, '#fce0a8'); R(ctx, tip[0] + 2, tip[1] - 3, 2, 2, '#fce0a8'); }
  }
  function drawMongo(ctx, M) {
    var s = sOf(M.z), x = xOf(M.X, M.z), y = yOf(M.z);
    var base = M.big ? 'mongo_big' : 'mongo';
    var nm = M.state === 'side' ? base + '_idle' : base + '_run';
    var o = { frame: Math.floor(M.t * 8), scale: qScale(s), flip: M.state === 'back' };
    if (!spr(ctx, nm, x, y, o)) spr(ctx, M.state === 'side' ? 'rooms_mongo_idle' : 'rooms_mongo_run', x, y, o);
  }
  /* --- Carl, from behind --- */
  function carlSprite(C) {
    var k;
    if (C.dead || C.hurtT > 0) k = 'hurt';
    else if (C.throwT > 0) k = 'throw';
    else if (C.h > 0) k = 'jump';
    else if (C.duck) k = 'duck';
    else if (C.moving || S.phase === 'advance') k = 'run';
    else k = 'idle';
    return k;
  }
  function drawCarl(ctx) {
    var C = S.carl;
    var k = carlSprite(C);
    var x = Math.round(xOf(C.X, 1)), y = FY + 3 - Math.round(C.h);
    if (C.dead) y += Math.round(Math.min(40, C.deadT * 30));
    // shadow
    ctx.globalAlpha = 0.45; ell(ctx, x, FY + 2, 10, 2, '#000'); ctx.globalAlpha = 1;
    if (S.mongo && S.mongo.state === 'side') drawMongo(ctx, S.mongo);
    var skin = (DCW.save && DCW.save.equipped && DCW.save.equipped.skin) || null;
    var flick = C.inv > 0 && !C.dead && Math.floor(DCW.t * 20) % 2 === 0;
    var o = { frame: Math.floor((k === 'run' ? C.runT + S.t * (S.phase === 'advance' ? 1 : 0) : S.t) * (k === 'run' ? 8 : 2)), skin: skin, alpha: flick ? 0.35 : 1 };
    var drewDuck = false;
    if (k === 'duck') {
      if (artHas('carl_back_duck')) DCW.art.sprite(ctx, 'carl_back_duck', x, y, o);
      else if (artHas('carl_back_idle')) { DCW.art.sprite(ctx, 'carl_back_idle', x, y + 9, o); drewDuck = true; }
      else fbDraw(ctx, 'rooms_carl_back_duck', x, y, o);
    } else {
      var nm = 'carl_back_' + k;
      if (!artHas(nm)) { if (k === 'jump' && artHas('carl_back_idle')) nm = 'carl_back_idle'; }
      if (artHas(nm)) DCW.art.sprite(ctx, nm, x, y, o);
      else fbDraw(ctx, 'rooms_carl_back_' + k, x, y, o);
    }
    // Princess Donut on the left shoulder
    if (S.donut && !C.dead) {
      var info = artHas('carl_back_idle') ? sprInfo('carl_back_idle') : { w: 20, h: 30 };
      var sy = y - Math.round(info.h * 0.52) + (k === 'duck' ? (artHas('carl_back_duck') ? 8 : 9) : 0) + (drewDuck ? 9 : 0);
      var sx = x - Math.round(info.w * 0.36);
      if (artHas('donut_back')) DCW.art.sprite(ctx, 'donut_back', sx, sy, { frame: Math.floor(S.t * 2), alpha: o.alpha });
      else fbDraw(ctx, 'rooms_donut_back', sx, sy, { frame: Math.floor(S.t * 2), alpha: o.alpha });
    }
  }
  function drawFrontFx(ctx) {
    S.fx.forEach(function (f) { if (f.z >= 0.99) drawFx(ctx, f); });
    // sweeping side tendrils (front line)
    S.tend.forEach(function (t) {
      if (t.kind !== 'sweep') return;
      var yy = t.low ? FY - 4 : FY - 30;
      if (t.st === 'warn') {
        var ex = t.side < 0 ? 8 : W - 8;
        var poke = Math.round(Math.sin(t.t * 20) * 3) + 8;
        R(ctx, t.side < 0 ? 0 : W - poke, yy - 4, poke, 8, '#00a800');
        if (Math.floor(DCW.t * 8) % 2) {
          DCW.text(t.low ? '↑ JUMP' : '↓ DUCK', t.side < 0 ? 22 : W - 22, yy - 16, '#f8d878', { align: t.side < 0 ? 'left' : 'right' });
          DCW.text('!', ex, yy - 18, '#f83800', { align: 'center' });
        }
        return;
      }
      var k = t.x, tip = t.side < 0 ? lerp(-20, W + 20, k) : lerp(W + 20, -20, k);
      var from = t.side < 0 ? -10 : W + 10;
      var x0 = Math.min(from, tip), x1 = Math.max(from, tip);
      for (var x = x0; x < x1; x += 6) {
        var wy = yy + Math.round(Math.sin(x * 0.12 + DCW.t * 20) * 2);
        R(ctx, Math.round(x) - 1, wy - 5, 8, 10, '#000'); R(ctx, Math.round(x), wy - 4, 6, 8, ((x / 6) | 0) % 2 ? '#00a800' : '#005800');
        if (((x / 6) | 0) % 3 === 0) R(ctx, Math.round(x) + 2, wy - 7, 2, 2, '#58d854');
      }
    });
    // popups
    S.pops.forEach(function (p) { DCW.text(p.text, Math.round(p.x), Math.round(p.y), p.color, { align: 'center' }); });
  }
  /* --- HUD --- */
  var hud = {};
  var meterHud = null;
  function hudDrawsMeters() {
    if (meterHud !== null) return meterHud;
    try { meterHud = !!(DCW.ui && (DCW.ui.hudMeters === true || String(DCW.ui.drawHUD).indexOf('meters') >= 0)); } catch (e) { meterHud = false; }
    return meterHud;
  }
  function drawHud(ctx) {
    var r = run(), st = stats(), sel = selected();
    hud.hp = Math.max(0, r.hp); hud.maxHp = st.maxHp; hud.special = S.special;
    hud.bombs = itemCount(sel); hud.potions = r.potions || 0; hud.gold = r.gold || 0;
    hud.level = r.level || 13; hud.xpFrac = clamp((r.xp || 0) / xpNeed(r.level), 0, 1);
    hud.views = (r.views || 0) + Math.round(S.views); hud.combo = S.combo; hud.companion = 'donut';
    hud.explosive = { id: sel, count: itemCount(sel), name: expName(sel) };
    hud.party = party();
    var ck = gcall('clock'); hud.clock = ck || null;
    hud.stageName = (S.room && S.room.name) || '';
    hud.time = null; hud.timer = null; hud.par = null;
    // no bossHp: the boss bar sits at the bottom of the screen, where Carl stands
    hud.bossHp = null; hud.bossName = null;
    var m = null;
    if (S.target && !S.target.broken && (S.phase === 'fight' || S.phase === 'intro')) m = { id: 'pole', label: 'TENT POLE', value: Math.max(0, S.target.hp / S.target.maxHp), color: '#f83800' };
    if (S.finale) {
      m = { id: 'poison', label: 'POISON', value: S.finale.poison, color: '#9878f8' };
      hud.timer = Math.max(0, S.finale.seconds - S.finale.t); hud.timerLabel = 'SURVIVE';
    }
    if (m) m.frac = m.value;
    hud.meters = m ? [m] : null;
    if (ufn('drawHUD')) ucall('drawHUD', ctx, hud);
    else DCW.text('♥' + Math.ceil(hud.hp) + '/' + hud.maxHp + '  ' + hud.explosive.name + ' ' + hud.bombs, 4, 3, '#fcfcfc');
    if (m && !hudDrawsMeters()) {
      // our own meter under the HUD until ui.drawHUD draws h.meters
      var x = 104, y = 18, w = 112;
      DCW.box(x - 4, y - 2, w + 8, 15, { fill: '#000' });
      DCW.text(m.label === 'TENT POLE' ? 'POLE' : m.label, x, y + 2, m.id === 'pole' ? '#f8d878' : '#d8b8f8');
      var lx = x + (m.id === 'pole' ? 28 : 40);
      DCW.bar(lx, y + 3, x + w - lx, 5, m.value, m.color, m.id === 'pole' ? '#3a1020' : '#200828');
    }
  }

  /* ---------------- debug + test hooks ---------------- */
  function debugClear() {
    if (!S || S.done) return;
    if (S.target && !S.target.broken && (S.phase === 'fight' || S.phase === 'intro')) { S.phase = 'fight'; damageTarget(S.target.hp + 1); }
    else if (S.finale && (S.phase === 'finale' || S.phase === 'finaleIntro')) { S.phase = 'finale'; S.finale.t = S.finale.seconds; }
  }
  function debugGod() { if (!S) return; S.god = !S.god; var r = run(); r.god = S.god; ucall('toast', S.god ? 'GOD MODE ON' : 'GOD MODE OFF', {}); }

  var scene = { enter: enter, exit: exit, update: update, idle: idle, draw: draw };
  var inited = false;
  DCW.rooms = {
    scene: scene,
    init: function () {
      if (inited) return; inited = true;
      window.addEventListener('keydown', function (e) {
        if (!DCW.debug || DCW.scene !== scene || !S) return;
        if (e.code === 'Digit9') debugClear();
        else if (e.code === 'Digit0') debugGod();
      });
    },
    get state() { return S; },
    debugClear: debugClear, debugGod: debugGod,
    spawn: function (id, X, z) { return S ? spawnEnemy(id, X === undefined ? null : { X: X, z: z || 0.1 }) : null; },
    fallbackArt: FB,
    proj: { sOf: sOf, yOf: yOf, xOf: xOf, qScale: qScale }
  };
})();

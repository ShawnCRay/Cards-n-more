/* art_actors.js - BOOK 2 (Carl's Doomsday Scenario, the Third Floor) actor pixel data:
 * Carl (Floor 3 look + skins + back view), Donut, Mongo (small, big, clockwork), Katia,
 * NPCs, enemies, bosses (Heather, the Dispenser in pieces, Vincente, big Terror), portraits.
 * Owner: art-actors. Pure data: fills DCW.artDefs / DCW.artProcs / DCW.artSkins.
 * art.js (loaded after this file) rasterizes everything at init().
 *
 * Authoring notes
 *  - Small sprites are FILL-ONLY pixel strings; a 1px black ('k') outline is added
 *    automatically around the silhouette (outlined()).
 *  - Big sprites (NPCs, bosses, portraits) are painted on char grids with integer
 *    primitives (rect / oval / line / tri / px) and then outlined - same result as hand
 *    pixel art, but compact to write.
 *  - Carl is composed per frame (body rows + stamped head + a cloak painted BEHIND the
 *    body). Skins are palette overrides; per-skin accessories (crowns, hats, the
 *    magistrate's sash) are baked into generated palette chars so a plain palette swap
 *    shows them. Book 1 skin ids keep working on the new sprite.
 *  - Portraits are 32x32 with exactly 3 frames: 0 neutral, 1 mouth open, 2 blink.
 *  - Everything faces right; anchor is bottom-centre (feet).
 */
(function () {
  'use strict';
  var DCW = window.DCW = window.DCW || {};
  var defs = DCW.artDefs = DCW.artDefs || {};
  DCW.artProcs = DCW.artProcs || {};
  var skins = DCW.artSkins = DCW.artSkins || {};

  /* ------------------------------------------------------------------ *
   * NES 2C02 palette (same values as art.NES)
   * ------------------------------------------------------------------ */
  var C = {
    K: '#000000', W: '#fcfcfc',
    g0: '#7c7c7c', g1: '#bcbcbc', g2: '#f8f8f8', g3: '#787878',
    // blues
    b0: '#0000fc', b1: '#0000bc', b2: '#0078f8', b3: '#0058f8', b4: '#3cbcfc', b5: '#6888fc', b6: '#a4e4fc', b7: '#b8b8f8',
    // purples
    p0: '#4428bc', p1: '#6844fc', p2: '#9878f8', p3: '#d8b8f8',
    // magentas / pinks
    m0: '#940084', m1: '#d800cc', m2: '#f878f8', m3: '#f8b8f8',
    // reds
    r0: '#a80020', r1: '#e40058', r2: '#f85898', r3: '#f8a4c0',
    o0: '#a81000', o1: '#f83800', o2: '#f87858', o3: '#f0d0b0',
    // browns / oranges / yellows
    n0: '#881400', n1: '#e45c10', n2: '#fca044', n3: '#fce0a8',
    y0: '#503000', y1: '#ac7c00', y2: '#f8b800', y3: '#f8d878',
    // greens
    l0: '#007800', l1: '#00b800', l2: '#b8f818', l3: '#d8f878',
    G0: '#006800', G1: '#00a800', G2: '#58d854', G3: '#b8f8b8',
    t0: '#005800', t1: '#00a844', t2: '#58f898', t3: '#b8f8d8',
    c0: '#004058', c1: '#008888', c2: '#00e8d8', c3: '#00fcfc',
    pk: '#f8d8f8'
  };

  /* ------------------------------------------------------------------ *
   * Grid helpers. A grid is an array of rows, each row an array of chars.
   * '.' (or ' ') is transparent.
   * ------------------------------------------------------------------ */
  function T(ch) { return ch === '.' || ch === ' ' || ch === undefined || ch === null; }
  function blank(w, h) { var g = []; for (var y = 0; y < h; y++) { var r = []; for (var x = 0; x < w; x++) r.push('.'); g.push(r); } return g; }
  function P(rows, w, h) { // parse rows (pads short rows / missing rows)
    var W = w || 0, H = h || rows.length, y, x;
    if (!w) for (y = 0; y < rows.length; y++) W = Math.max(W, rows[y].length);
    var g = blank(W, H);
    for (y = 0; y < Math.min(H, rows.length); y++) for (x = 0; x < Math.min(W, rows[y].length); x++) if (!T(rows[y][x])) g[y][x] = rows[y][x];
    return g;
  }
  function GW(g) { return g[0] ? g[0].length : 0; }
  function GH(g) { return g.length; }
  function clone(g) { return g.map(function (r) { return r.slice(); }); }
  function rows(g) { return g.map(function (r) { return r.join(''); }); }
  function stamp(dst, src, x, y, flip) {
    if (!src.length) src = [];
    if (typeof src[0] === 'string') src = P(src);
    for (var j = 0; j < src.length; j++) for (var i = 0; i < src[j].length; i++) {
      var c = src[j][flip ? src[j].length - 1 - i : i];
      if (T(c)) continue;
      var X = x + i, Y = y + j;
      if (Y >= 0 && Y < dst.length && X >= 0 && X < dst[0].length) dst[Y][X] = c;
    }
    return dst;
  }
  // stamp only into transparent cells (paint "behind")
  function under(dst, src, x, y) {
    if (typeof src[0] === 'string') src = P(src);
    for (var j = 0; j < src.length; j++) for (var i = 0; i < src[j].length; i++) {
      var c = src[j][i]; if (T(c)) continue;
      var X = x + i, Y = y + j;
      if (Y >= 0 && Y < dst.length && X >= 0 && X < dst[0].length && T(dst[Y][X])) dst[Y][X] = c;
    }
    return dst;
  }
  function shift(g, dx, dy) { var o = blank(GW(g), GH(g)); stamp(o, g, dx, dy); return o; }
  function flipH(g) { return g.map(function (r) { return r.slice().reverse(); }); }
  function rotCW(g) { var w = GW(g), h = GH(g), o = blank(h, w); for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) o[x][h - 1 - y] = g[y][x]; return o; }
  function rotCCW(g) { var w = GW(g), h = GH(g), o = blank(h, w); for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) o[w - 1 - x][y] = g[y][x]; return o; }
  function recolor(g, map) { return g.map(function (r) { return r.map(function (c) { return map[c] !== undefined ? map[c] : c; }); }); }
  function resize(g, w, h, ox, oy) { var o = blank(w, h); stamp(o, g, ox || 0, oy || 0); return o; }
  // auto outline: every transparent cell 4-adjacent to an opaque non-outline cell becomes ch
  function outlined(g, ch, diag) {
    ch = ch || 'k';
    var w = GW(g), h = GH(g), o = clone(g);
    for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) {
      if (!T(g[y][x])) continue;
      var hit = false;
      for (var dy = -1; dy <= 1 && !hit; dy++) for (var dx = -1; dx <= 1 && !hit; dx++) {
        if (!dx && !dy) continue;
        if (!diag && dx && dy) continue;
        var yy = y + dy, xx = x + dx;
        if (yy < 0 || yy >= h || xx < 0 || xx >= w) continue;
        var c = g[yy][xx];
        if (!T(c) && c !== ch) hit = true;
      }
      if (hit) o[y][x] = ch;
    }
    return o;
  }
  // primitives (integer, no AA)
  function px(g, x, y, c) { x = Math.round(x); y = Math.round(y); if (y >= 0 && y < g.length && x >= 0 && x < g[0].length) g[y][x] = c; }
  function rect(g, x, y, w, h, c) { for (var j = 0; j < h; j++) for (var i = 0; i < w; i++) px(g, x + i, y + j, c); }
  function oval(g, cx, cy, rx, ry, c) { // filled ellipse centred at (cx,cy) (may be .5)
    for (var y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) for (var x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      var dx = (x - cx) / (rx + 0.25), dy = (y - cy) / (ry + 0.25);
      if (dx * dx + dy * dy <= 1) px(g, x, y, c);
    }
  }
  function line(g, x0, y0, x1, y1, c, th) {
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    var dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1, dy = -Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1, err = dx + dy;
    for (;;) {
      if (th > 1) rect(g, x0 - ((th - 1) >> 1), y0 - ((th - 1) >> 1), th, th, c); else px(g, x0, y0, c);
      if (x0 === x1 && y0 === y1) break;
      var e2 = 2 * err; if (e2 >= dy) { err += dy; x0 += sx; } if (e2 <= dx) { err += dx; y0 += sy; }
    }
  }
  function tri(g, x0, y0, x1, y1, x2, y2, c) { // filled triangle (integer scanlines)
    var minY = Math.min(y0, y1, y2), maxY = Math.max(y0, y1, y2);
    for (var y = minY; y <= maxY; y++) {
      var xs = [];
      [[x0, y0, x1, y1], [x1, y1, x2, y2], [x2, y2, x0, y0]].forEach(function (e) {
        if ((y >= e[1] && y <= e[3]) || (y >= e[3] && y <= e[1])) { if (e[1] === e[3]) { xs.push(e[0], e[2]); } else xs.push(e[0] + (y - e[1]) * (e[2] - e[0]) / (e[3] - e[1])); }
      });
      if (xs.length) { var a = Math.round(Math.min.apply(null, xs)), b = Math.round(Math.max.apply(null, xs)); for (var x = a; x <= b; x++) px(g, x, y, c); }
    }
  }
  // replace one char with another inside a rect where test(x,y) holds
  function dots(g, x, y, w, h, from, to, test) { for (var j = y; j < y + h; j++) for (var i = x; i < x + w; i++) if (g[j] && g[j][i] === from && test(i, j)) g[j][i] = to; }
  // replace chars inside a rect only
  function swapIn(g, x, y, w, h, map) { for (var j = y; j < y + h; j++) for (var i = x; i < x + w; i++) if (g[j] && g[j][i] !== undefined && map[g[j][i]] !== undefined) g[j][i] = map[g[j][i]]; }
  // vertical strip of pixels (polyline of points), each point a [x,y]
  function poly(g, pts, c, th) { for (var i = 1; i < pts.length; i++) line(g, pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1], c, th); }

  // register a def. frames: array of grids (or row-string arrays). Each frame is fitted to w x h.
  function def(name, pal, frames, opt) {
    opt = opt || {};
    var gs = frames.map(function (f) { return typeof f[0] === 'string' ? P(f) : f; });
    var w = opt.w || GW(gs[0]), h = opt.h || GH(gs[0]);
    var out = gs.map(function (g) { return rows(GW(g) === w && GH(g) === h ? g : resize(g, w, h, 0, 0)); });
    var d = { w: w, h: h, pal: pal, frames: out };
    if (opt.ox) d.ox = opt.ox;
    if (opt.oy) d.oy = opt.oy;
    defs[name] = d;
    return d;
  }
  // simple lighten map for hurt palettes (one NES luma row up)
  var LIGHT = {};
  (function () {
    var rowsN = [
      ['#7c7c7c', '#0000fc', '#0000bc', '#4428bc', '#940084', '#a80020', '#a81000', '#881400', '#503000', '#007800', '#006800', '#005800', '#004058'],
      ['#bcbcbc', '#0078f8', '#0058f8', '#6844fc', '#d800cc', '#e40058', '#f83800', '#e45c10', '#ac7c00', '#00b800', '#00a800', '#00a844', '#008888'],
      ['#f8f8f8', '#3cbcfc', '#6888fc', '#9878f8', '#f878f8', '#f85898', '#f87858', '#fca044', '#f8b800', '#b8f818', '#58d854', '#58f898', '#00e8d8'],
      ['#fcfcfc', '#a4e4fc', '#b8b8f8', '#d8b8f8', '#f8b8f8', '#f8a4c0', '#f0d0b0', '#fce0a8', '#f8d878', '#d8f878', '#b8f8b8', '#b8f8d8', '#00fcfc']];
    for (var r = 0; r < 3; r++) for (var i = 0; i < rowsN[r].length; i++) LIGHT[rowsN[r][i]] = rowsN[r + 1][i];
  })();
  function lightPal(pal) { var o = {}; for (var k in pal) o[k] = (k === 'k' || !pal[k]) ? pal[k] : (LIGHT[pal[k]] || pal[k]); return o; }
  function hurtPal(pal) { var p = lightPal(pal); if (p.e !== undefined) p.e = C.W; return p; }
  function withK(pal) { var o = { k: C.K }; for (var q in pal) o[q] = pal[q]; return o; }
  function merge(a, b) { var o = {}, k; for (k in a) o[k] = a[k]; for (k in b) o[k] = b[k]; return o; }

  // fill-only art -> padded + outlined grids (all frames padded to a common size, + pad px each side)
  function build(frames, pad) {
    pad = pad === undefined ? 1 : pad;
    var gs = frames.map(function (f) { return typeof f[0] === 'string' ? P(f) : f; });
    var w = 0, h = 0;
    gs.forEach(function (g) { w = Math.max(w, GW(g)); h = Math.max(h, GH(g)); });
    return gs.map(function (g) { return outlined(resize(g, w + pad * 2, h + pad * 2, pad, pad)); });
  }
  function spr(name, pal, frames, opt) { return def(name, withK(pal), build(frames, opt && opt.pad), opt); }
  // replace rows from index i
  function alt(base, i, newRows) { var r = base.slice(); for (var j = 0; j < newRows.length; j++) r[i + j] = newRows[j]; return r; }
  // replace rows counting from the bottom (n rows)
  function legs(base, newRows) { return alt(base, base.length - newRows.length, newRows); }
  // per-pixel char swap inside a row-string frame
  function swap(base, map) { return base.map(function (r) { var o = ''; for (var i = 0; i < r.length; i++) o += map[r[i]] !== undefined ? map[r[i]] : r[i]; return o; }); }
  // enemy: walk(n) attack hurt from row-string frames. hurtRows optional (defaults to walk0, lightened)
  function enemy(id, pal, walkFrames, attack, hurtRows, opt) {
    var all = walkFrames.concat([attack, hurtRows || walkFrames[0]]);
    var fr = build(all, opt && opt.pad), n = walkFrames.length;
    var P2 = withK(pal);
    def(id + '_walk', P2, fr.slice(0, n), opt);
    def(id + '_attack', P2, [fr[n]], opt);
    def(id + '_hurt', withK(hurtPal(pal)), [fr[n + 1]], opt);
  }
  // painted sprite: draw(g, i) for each frame i on a W x H grid, outlined. Returns grids.
  function paint(W, H, n, draw) { var out = []; for (var i = 0; i < n; i++) { var g = blank(W, H); draw(g, i); out.push(outlined(g)); } return out; }
  function pspr(name, pal, W, H, n, draw, opt) { return def(name, withK(pal), paint(W, H, n, draw), opt); }
  // painted enemy: draw(g, pose, i) with pose 'walk'|'attack'|'hurt'
  function penemy(id, pal, W, H, nWalk, draw, opt) {
    var P2 = withK(pal);
    def(id + '_walk', P2, paint(W, H, nWalk, function (g, i) { draw(g, 'walk', i); }), opt);
    def(id + '_attack', P2, paint(W, H, 1, function (g) { draw(g, 'attack', 0); }), opt);
    def(id + '_hurt', withK(hurtPal(pal)), paint(W, H, 1, function (g) { draw(g, 'hurt', 0); }), opt);
  }
  // bosses: <id>_idle(2) _walk(2) _attack _hurt _special ; draw(g, p) p = { a, i }
  function boss(id, pal, W, H, draw, opt) {
    var poses = { idle: 2, walk: 2, attack: 1, hurt: 1, special: 1 };
    Object.keys(poses).forEach(function (a) {
      var frames = [];
      for (var i = 0; i < poses[a]; i++) { var g = blank(W, H); draw(g, { a: a, i: i }); frames.push(outlined(g)); }
      def(id + '_' + a, withK(a === 'hurt' ? hurtPal(pal) : pal), frames, opt);
    });
  }
  function alias(name, src) { if (defs[src]) defs[name] = defs[src]; }

  // expose helpers for the later sections of this file and for debugging tools
  var KIT = DCW.artActorsKit = {
    C: C, T: T, blank: blank, P: P, GW: GW, GH: GH, clone: clone, rows: rows, stamp: stamp, under: under, shift: shift,
    flipH: flipH, rotCW: rotCW, rotCCW: rotCCW, recolor: recolor, resize: resize, outlined: outlined,
    px: px, rect: rect, oval: oval, line: line, tri: tri, dots: dots, swapIn: swapIn, poly: poly,
    def: def, lightPal: lightPal, hurtPal: hurtPal, withK: withK, merge: merge, build: build, spr: spr,
    alt: alt, legs: legs, swap: swap, enemy: enemy, paint: paint, pspr: pspr, penemy: penemy, boss: boss, alias: alias
  };
})();


/* ================================================================== *
 *  CARL - Floor 3 look
 *  Leather jacket with the RIGHT sleeve gone (the leading arm is bare), trollskin
 *  shirt, dark Nightgaunt cloak over the jacket, War Gauntlet on the right hand,
 *  spiked kneepads, BigBoi boxers, bare glittery feet.
 * ================================================================== */
(function () {
  'use strict';
  var DCW = window.DCW, K = DCW.artActorsKit, C = K.C, T = K.T, blank = K.blank, P = K.P, GW = K.GW, GH = K.GH;
  var stamp = K.stamp, under = K.under, rows = K.rows, flipH = K.flipH, rotCW = K.rotCW, rotCCW = K.rotCCW;
  var rect = K.rect, px = K.px, line = K.line;
  var defs = DCW.artDefs, skins = DCW.artSkins;

  // Canvas for every side-view carl frame: 24 x 28, feet on the bottom row, body centred on x=12.
  // Rows 0-3 are headroom for skin accessories (crowns, hats, wigs).
  var CW = 24, CH = 28;

  // Base palette chars (fill colours). Outline 'k' is added per skin automatically.
  // Book 1 chars keep their meaning so book 1 skins still recolour the same regions.
  var CARL_PAL = {
    k: C.K,
    s: '#fce0a8',  // skin (face, far hand)
    S: '#fca044',  // skin shade / stubble / ear
    n: '#fce0a8',  // nose (skin) - clown turns it red
    h: '#503000',  // hair
    e: C.K,        // pupils
    w: C.W,        // eye whites / teeth
    m: C.K,        // mouth line
    j: '#881400',  // jacket body (brown leather)
    J: '#503000',  // jacket shade
    v: '#881400',  // far (left) sleeve - the one that survived
    V: '#503000',  // sleeve shade
    q: '#503000',  // jacket inner edge / lapel line
    t: '#007800',  // torso under jacket: Trollskin Shirt of Pummeling (book 1: bare chest)
    T: '#00a800',  // trollskin mottle
    b: C.W,        // boxers
    B: '#f83800',  // boxer hearts
    l: '#fce0a8',  // lower legs (bare)
    f: '#fce0a8',  // feet (bare)
    F: '#fca044',  // toes / sole shade
    // ---- new on floor 3 ----
    u: '#fce0a8',  // bare right arm (sleeve dissolved by a slime on floor 1)
    U: '#fca044',  // bare arm shade
    g: '#bcbcbc',  // War Gauntlet of the Exalted Grull
    G: '#7c7c7c',  // gauntlet shade / knuckle plates
    c: '#004058',  // Nightgaunt Cloak of Stoutness
    C: '#008888',  // cloak fold highlight
    p: '#7c7c7c',  // spiked kneepads (Shade Gnoll Riot Forces)
    P: C.W,        // kneepad spikes
    i: '#a4e4fc',  // glitter on the bare feet (Pedicure Kit of the Sylph)
    x: '#fca044',  // xistera wicker scoop
    X: '#881400',  // xistera weave / strap
    y: '#004058',  // cloak seen from behind, covering the back (falls back to the jacket if a skin drops the cloak)
    Y: '#008888',  // its folds
    a: null, A: null // accessory layer (off by default; skins paint real accessories)
  };

  // ---- Heads (fill only, 12x12, facing right) ----
  var HEAD_SIDE = [
    '..hhhhhhh...',
    '.hhhhhhhhhh.',
    'hhhhhhhhhhhh',
    'hhhhhhshhshh',
    'hhhSshhsshh.',
    'hhSsswesswe.',
    'hSkSswesswe.',
    'hSSssssssssn',
    '.hSssssssss.',
    '..SsssmmmSs.',
    '..SSsSsSsS..',
    '...SSSSSS...'
  ];
  function headVar(r5, r6, r9, r10) { var g = HEAD_SIDE.slice(); if (r5) g[5] = r5; if (r6) g[6] = r6; if (r9) g[9] = r9; if (r10) g[10] = r10; return g; }
  var HEAD_SIDE_OPEN = headVar(null, null, '..SsssmwwmS.', '..SSsSmmmS..');
  var HEAD_SIDE_HURT = headVar('hhSssmsssms.', 'hSkSsseSsse.', '..SssmmmmmS.', null);
  var HEAD_SIDE_HAPPY = headVar('hhSsssmssms.', 'hSkSsmsmmsm.', '..SssmwwwmS.', '..SSsSmmmS..');
  var HEAD_SIDE_GRIT = headVar('hhSssmmssmm.', null, '..SsssmwmwS.', null);
  var HEAD_BACK = [
    '..hhhhhhhh..',
    '.hhhhhhhhhh.',
    'hhhhhhhhhhhh',
    'hhhhhhhhhhhh',
    'hhhhhhhhhhhh',
    'Shhhhhhhhhhs',
    'SkhhhhhhhhkS',
    'SShhhhhhhhSS',
    '.shhhhhhhhs.',
    '..sssssSss..',
    '..ssssssss..',
    '...SSSSSS...'
  ];
  var HEADS = {
    side: { g: HEAD_SIDE, view: 'side' },
    open: { g: HEAD_SIDE_OPEN, view: 'side' },
    hurt: { g: HEAD_SIDE_HURT, view: 'side' },
    happy: { g: HEAD_SIDE_HAPPY, view: 'side' },
    grit: { g: HEAD_SIDE_GRIT, view: 'side' },
    back: { g: HEAD_BACK, view: 'back' }
  };

  // ---- Side bodies: 24-wide rows for frame rows 14..27 (unless noted) ----
  var B_IDLE = [
    '.........jjtttjj........',
    '........vjqtttqjuu......',
    '.......vvjqtttqjuu......',
    '.......vVjqtTtqjuU......',
    '.......vVjqtttqjgg......',
    '.......ssjqtttqjggG.....',
    '.......ssjjbbbjjgGG.....',
    '.........bBbbbBb........',
    '.........bbbBbbb........',
    '.........bbb.bbb........',
    '.........ppp.pppP.......',
    '.........lll.lll........',
    '.........lll.lll........',
    '........fiFF.fiFF.......'
  ];
  var B_RUN = [[
    '.........jjtttjj........',
    '........vjqtttqjuu......',
    '.......vvjqtTtqjuUgg....',
    '......vVvjqtttqj.ggG....',
    '......ss.jqtTtqj.GG.....',
    '......ss.jqtttqj........',
    '.........jjbbbjj........',
    '.........bBbbbBb........',
    '........bbbbBbbbb.......',
    '.......bbb...bbbl.......',
    '.......pppP...pppP......',
    '......lll......llfi.....',
    '.....lll.......fFF......',
    '....fiFF................'
  ], [
    '.........jjtttjj........',
    '........vjqtttqju.......',
    '.......vvjqtttqjuu......',
    '.......vVjqtttqjUu......',
    '.......ssjqtTtqjgg......',
    '.......ssjqtttqjggG.....',
    '.........jjbbbjjGG......',
    '.........bBbbbBb........',
    '.........bbbBbbb........',
    '.........bbb.bbb........',
    '.........lllpppP........',
    '..........lll.fiF.......',
    '..........lll...........',
    '.........fiFF...........'
  ], [
    '.........jjtttjj........',
    '.......vvjqtttqju.......',
    '......sVvjqtTtqjuu......',
    '......ss.jqtttqjUuu.....',
    '.........jqtTtqj.ggG....',
    '.........jqtttqj.gGG....',
    '.........jjbbbjj........',
    '.........bBbbbBb........',
    '........bbbbBbbbb.......',
    '........lbbb..bbbl......',
    '.......pppP.....pppP....',
    '......lll.......lll.....',
    '.....fiF.........ll.....',
    '......F.........fiFF....'
  ], [
    '.........jjtttjj........',
    '........vjqtttqju.......',
    '.......vvjqtttqjuu......',
    '.......vVjqtttqjUu......',
    '.......ssjqtTtqjgg......',
    '.......ssjqtttqjggG.....',
    '.........jjbbbjjGG......',
    '.........bBbbbBb........',
    '.........bbbBbbb........',
    '.........bbb.bbb........',
    '.........lllpppP........',
    '.......fiFlll...........',
    '.............lll........',
    '.............fiFF.......'
  ]];
  var B_JUMP = [
    '......ss.jjtttjj.ggG....',
    '......vv.jqtttqj.gg.....',
    '......vVvjqtTtqjuUu.....',
    '.......vvjqtttqjuu......',
    '.........jqtTtqj........',
    '.........jqtttqj........',
    '.........jjbbbjj........',
    '.........bBbbbBb........',
    '........bbbbBbbbbb......',
    '........bbb..lllppP.....',
    '........pppP..fiFp......',
    '.......lll.....FF.......',
    '.......fiF..............',
    '........................'
  ];
  var B_FALL = [
    '.........jjtttjj........',
    '.......vvjqtttqjuu......',
    '......vVvjqtTtqjuUu.....',
    '.....ss..jqtttqj..ggG...',
    '.....ss..jqtTtqj..gGG...',
    '.........jqtttqj........',
    '.........jjbbbjj........',
    '.........bBbbbBb........',
    '.........bbbBbbb........',
    '.........bbb.bbb........',
    '.........ppp.pppP.......',
    '.........lll..lll.......',
    '........fiFF..fiFF......',
    '........................'
  ];
  var B_PUNCH1 = [
    '.........jjtttjj........',
    '........vjqtttqju.......',
    '.......vVjqtTtqjuuggG...',
    '......ssVjqtttqjUuggG...',
    '......ss.jqtTtqj........',
    '.........jqtttqj........',
    '.........jjbbbjj........',
    '.........bBbbbBb........',
    '........bbbbBbbbb.......',
    '........bbb...bbb.......',
    '........pppP...pppP.....',
    '.......lll......lll.....',
    '.......lll......lll.....',
    '......fiFF......fiFF....'
  ];
  var B_PUNCH2 = [
    '.........jjtttjj........',
    '........vjqtttqju.......',
    '.......vVjqtttqjuuuugggG',
    '......ssVjqtttqjUUuugGGG',
    '......ss.jqtTtqj........',
    '.........jqtttqj........',
    '.........jjbbbjj........',
    '.........bBbbbBb........',
    '........bbbbBbbbb.......',
    '........bbb...bbb.......',
    '........pppP...pppP.....',
    '.......lll......lll.....',
    '.......lll......lll.....',
    '......fiFF......fiFF....'
  ];
  var B_KICK1 = [
    '.........jjtttjj........',
    '........vjqtttqju.......',
    '.......vVjqtttqjUu......',
    '.......ss.qtttqjUu......',
    '.......ss.jqtTtqjggG....',
    '.........jqtttqjgGG.....',
    '.........jjbbbjj........',
    '.........bBbbbBbb.......',
    '........bbbbBbbbbppP....',
    '........bbb....llll.....',
    '........pppP....fiFF....',
    '........lll.............',
    '........lll.............',
    '.......fiFF.............'
  ];
  var B_KICK2 = [
    '........jjtttjj.........',
    '.......vjqtttqju........',
    '......vVjqtttqjUu.......',
    '.....ss.jqtttqjUu.......',
    '.....ss.jqtTtqj.ggG.....',
    '........jqtttqj.gGG.....',
    '........jjbbbjj...P.....',
    '........bBbbbBbbbppllfi.',
    '.......bbbbBbbbbllllfFF.',
    '.......bbb...........FF.',
    '.......pppP.............',
    '.......lll..............',
    '.......lll..............',
    '......fiFF..............'
  ];
  var B_THROW = [
    '.........jjtttjj..ggG...',
    '........vjqtttqjuuggG...',
    '.......vVjqtTtqjuUu.....',
    '......ssVjqtttqjj.......',
    '......ss.jqtTtqj........',
    '.........jqtttqj........',
    '.........jjbbbjj........',
    '.........bBbbbBb........',
    '........bbbbBbbbb.......',
    '........bbb...bbb.......',
    '.......pppP.....pppP....',
    '.......lll......lll.....',
    '......lll.......lll.....',
    '.....fiFF.......fiFF....'
  ];
  var B_HURT = [
    '........jjtttjj.........',
    '......vvjqtttqjuu.......',
    '.....vVvjqtTtqjuUu......',
    '....ss..jqtttqj..ggG....',
    '....ss..jqtTtqj..gGG....',
    '........jqtttqj.........',
    '........jjbbbjj.........',
    '........bBbbbBb.........',
    '........bbbBbbbb........',
    '.......bbb...bbb........',
    '.......pppP...pppP......',
    '......lll......lll......',
    '......lll......lll......',
    '.....fiFF.......fiFF....'
  ];
  // victory: 18 rows (frame rows 10..27), gauntlet fist pumped up beside the head
  var B_VICTORY = [
    '...................ggG..',
    '...................gGG..',
    '...................gg...',
    '..................uU....',
    '.........jjtttjj.uU.....',
    '........vjqtttqjuu......',
    '.......vvjqtttqj........',
    '.......vVjqtTtqj........',
    '.......vVjqtttqj........',
    '.......ssjqtttqj........',
    '.......ssjjbbbjj........',
    '.........bBbbbBb........',
    '.........bbbBbbb........',
    '........bbb...bbb.......',
    '........pppP..pppP......',
    '.......lll.....lll......',
    '.......lll.....lll......',
    '......fiFF.....fiFF.....'
  ];
  var B_AIRKICK = [
    '......vvjjtttjj.........',
    '.....ssVjqtttqju........',
    '.....ss.jqtTtqjuu.......',
    '........jqtttqjUugg.....',
    '........jqtTtqj..gGG....',
    '........jjbbbjj.........',
    '........bBbbbBbb........',
    '.......bbbbBbbbbb.......',
    '......pbbb....bbbpP.....',
    '.....ppll......ppll.....',
    '....fiFF........llll....',
    '.................llll...',
    '..................lfiF..',
    '...................fFF..'
  ];
  // xistera shot: 32 wide canvas (body offset +4 so the centre stays on the anchor)
  var B_LAUNCH = [
    '.............jjtttjj............',
    '............vjqtttqjuu..........',
    '...........vVjqtTtqjuUuuggG.xxx.',
    '..........ssVjqtttqj..UuggGxXxxx',
    '..........ss.jqtTtqj....XXxXx.xX',
    '.............jqtttqj.......xx...',
    '.............jjbbbjj............',
    '.............bBbbbBb............',
    '............bbbbBbbbb...........',
    '...........bbb....bbb...........',
    '..........pppP.....pppP.........',
    '.........lll........lll.........',
    '........lll.........lll.........',
    '.......fiFF.........fiFF........'
  ];
  // planting a charge: down on one knee, the gauntlet hand at the ground in front (painted)
  function plantBody() {
    var g = blank(CW, CH);
    rect(g, 7, 18, 2, 4, 'v'); px(g, 8, 19, 'V'); px(g, 8, 20, 'V'); rect(g, 7, 22, 2, 2, 's');        // far arm hangs back
    rect(g, 9, 16, 7, 6, 'j'); px(g, 10, 17, 'q'); px(g, 14, 17, 'q'); rect(g, 11, 16, 3, 5, 't'); px(g, 12, 18, 'T'); rect(g, 10, 18, 1, 3, 'q'); rect(g, 14, 18, 1, 3, 'q');
    rect(g, 9, 22, 8, 2, 'b'); px(g, 10, 22, 'B'); px(g, 14, 23, 'B');                                    // boxers
    rect(g, 9, 24, 3, 2, 'l'); rect(g, 9, 26, 3, 1, 'p'); rect(g, 4, 26, 5, 1, 'l'); rect(g, 2, 25, 2, 2, 'F'); px(g, 3, 25, 'i'); // back leg kneeling, shin along the floor
    rect(g, 13, 23, 5, 2, 'l'); rect(g, 17, 23, 2, 2, 'p'); px(g, 19, 23, 'P');                          // front thigh + kneepad
    rect(g, 16, 25, 3, 2, 'l'); rect(g, 15, 27, 5, 1, 'f'); px(g, 16, 27, 'i'); rect(g, 18, 27, 2, 1, 'F'); // front shin + foot
    line(g, 15, 18, 19, 22, 'u', 2); px(g, 20, 22, 'U');                                                   // bare arm reaching down
    rect(g, 19, 23, 3, 3, 'g'); rect(g, 19, 25, 3, 1, 'G'); px(g, 21, 23, 'G');                            // gauntlet at the ground
    return g;
  }

  // ---- cloak templates, painted BEHIND the body. a = template column on the attach point ----
  var CAPES = {
    hang: { a: 7, rows: [
      '......cc',
      '.....ccc',
      '....cCcc',
      '....cCcc',
      '...ccCcc',
      '...cCccc',
      '...cCccc',
      '..ccCccc',
      '..cCcccc',
      '..cCcccc',
      '.ccCcccc',
      'cCcccCcc'] },
    lean: { a: 7, rows: [
      '......cc',
      '....cccc',
      '...cCccc',
      '..ccCccc',
      '..cCcccc',
      '.ccCcccc',
      '.cCccccc',
      'ccCccccc',
      'cCcccccc',
      'Cccc.ccc'] },
    runA: { a: 8, rows: [
      '.......cc',
      '.....cccc',
      '...ccCccc',
      '.cccccccc',
      'ccCccccc.',
      '.ccccCc..',
      '..cccc...',
      '....c....'] },
    runB: { a: 8, rows: [
      '.......cc',
      '....ccccc',
      '.cccCcccc',
      'ccCcccccc',
      '.ccccCcc.',
      '..ccccc..',
      '....cc...'] },
    up: { a: 6, rows: [   // falling: cloak lifts above the shoulders
      'c.......',
      'cc......',
      '.cc.....',
      '.cCc....',
      '..cCcc..',
      '..ccCcc.',
      '...cccccc',
      '....ccccc'] },
    down: { a: 7, rows: [ // jumping: cloak trails straight down
      '......cc',
      '.....ccc',
      '.....Ccc',
      '....cCcc',
      '....cCcc',
      '....cCcc',
      '...ccCcc',
      '...cCccc',
      '...cCccc',
      '...cCccc',
      '..cCcccc',
      '..c.cc.c'] },
    blown: { a: 4, rows: [ // hurt: blown forward over the shoulder
      '..ccccc..',
      '.ccCcccc.',
      'ccccCcccc',
      'cc..ccccc',
      'c....cccc',
      '......ccc'] },
    kneel: { a: 7, rows: [
      '......cc',
      '.....ccc',
      '....cCcc',
      '...ccCcc',
      '...cCccc',
      '..ccCccc',
      '..cCcccc',
      '.ccCcccc',
      'cCcccCcc'] }
  };
  function cape(g, kind, ax, ay) { var t = CAPES[kind]; if (!t) return; under(g, t.rows, ax - t.a, ay); }

  function headGrid(key, rot, flip) {
    var g = P(HEADS[key].g, 12, HEADS[key].h || 12);
    if (flip) g = flipH(g);
    if (rot === 1) g = rotCW(g); else if (rot === -1) g = rotCCW(g);
    return g;
  }
  // frame builder: body rows at (bx, by), head at (hx, hy), cloak behind at (cx, cy)
  function carlFrame(headKey, hx, hy, bodyRows, bx, by, capeKind, cx, cy, size) {
    var w = size ? size[0] : CW, h = size ? size[1] : CH;
    var g = blank(w, h);
    stamp(g, bodyRows, bx, by);
    stamp(g, headGrid(headKey), hx, hy);
    if (capeKind) cape(g, capeKind, cx, cy);
    return { base: g, heads: [{ key: headKey, x: hx, y: hy, rot: 0, flip: false }] };
  }

  /* ---- back view (into-the-screen rooms): painted with primitives on a 24x28 grid ----
   * o: { hy: head y, dy: body drop, sway: cloak hem shift, armL / armR: 'down'|'fwd'|'back'|'up'|'out',
   *      legs: 'stand'|'runA'|'runB'|'tuck'|'wide'|'crouch', hem: 'flare' } */
  function backFrame(o) {
    var g = blank(CW, CH), dy = o.dy || 0, sw = o.sway || 0;
    var hy = (o.hy === undefined ? 3 : o.hy) + dy;
    var top = 15 + dy;                       // shoulder row
    // legs
    var L = o.legs || 'stand';
    function leg(x, y0, y1, sole) {
      rect(g, x, y0, 3, y1 - y0 + 1, 'l');
      rect(g, x, y0, 3, 1, 'p');             // kneepad strap seen from behind
      rect(g, x, y1 + 1, 3, 1, sole ? 'F' : 'f');
      if (sole) px(g, x + 1, y1 + 1, 'i'); else px(g, x + 1, y1 + 1, 'i');
    }
    if (L === 'stand') { leg(8, 23 + dy, 26, 1); leg(13, 23 + dy, 26, 1); }
    else if (L === 'runA') { leg(8, 23 + dy, 24, 1); leg(13, 23 + dy, 26, 1); }
    else if (L === 'runB') { leg(8, 23 + dy, 26, 1); leg(13, 23 + dy, 24, 1); }
    else if (L === 'tuck') { leg(7, 22 + dy, 23 + dy, 1); leg(14, 22 + dy, 23 + dy, 1); }
    else if (L === 'wide') { leg(6, 23 + dy, 26, 1); leg(15, 23 + dy, 26, 1); }
    else if (L === 'crouch') { rect(g, 6, 23 + dy, 4, 2, 'l'); rect(g, 14, 23 + dy, 4, 2, 'l'); rect(g, 6, 23 + dy, 4, 1, 'p'); rect(g, 14, 23 + dy, 4, 1, 'p'); rect(g, 6, 25 + dy, 4, 1, 'F'); rect(g, 14, 25 + dy, 4, 1, 'F'); px(g, 7, 25 + dy, 'i'); px(g, 16, 25 + dy, 'i'); }
    // boxers peeking under the cloak hem
    rect(g, 8, 21 + dy, 8, 2, 'b'); px(g, 9, 22 + dy, 'B'); px(g, 13, 21 + dy, 'B');
    if (L === 'wide') rect(g, 7, 21 + dy, 10, 2, 'b');
    // arms (behind the cloak edge)
    function arm(side, pose) {
      var left = side === 'L';
      var x = left ? 4 : 18, sl = left ? 'v' : 'u', sh = left ? 'V' : 'U', hd = left ? 's' : 'g', hs = left ? 's' : 'G';
      var hw = left ? 2 : 3, hx = left ? x : x;
      if (pose === 'down') { rect(g, x, top, 2, 5, sl); rect(g, left ? x : x + 1, top + 1, 1, 4, sh); rect(g, hx, top + 5, hw, 2, hd); px(g, hx + hw - 1, top + 6, hs); }
      else if (pose === 'fwd') { rect(g, x, top, 2, 3, sl); rect(g, hx, top + 3, hw, 2, hd); px(g, hx + hw - 1, top + 4, hs); }
      else if (pose === 'back') { rect(g, x + (left ? -1 : 1), top, 2, 6, sl); rect(g, hx + (left ? -1 : 1), top + 6, hw, 2, hd); }
      else if (pose === 'out') { rect(g, left ? x - 2 : x, top - 1, 4, 2, sl); rect(g, left ? x - 3 : x + 3, top - 3, hw, 2, hd); px(g, left ? x - 3 : x + 3, top - 2, hs); }
      else if (pose === 'up') { rect(g, left ? x : x, top - 9, 2, 10, sl); rect(g, left ? x : x + 1, top - 8, 1, 8, sh); rect(g, left ? x - 1 : x, top - 12, hw, 3, hd); px(g, left ? x : x + 2, top - 10, hs); }
    }
    arm('L', o.armL || 'down'); arm('R', o.armR || 'down');
    // the Nightgaunt cloak covers the whole back: shoulders to hips, folds + ragged hem
    for (var y = top; y <= 21 + dy; y++) {
      var k = y - top, wd = Math.min(12 + (k >> 1), 14), x0 = 12 - (wd >> 1) + (k > 3 ? sw : 0);
      if (o.hem === 'flare' && k > 3) { wd += k - 3; x0 -= (k - 3) >> 1; }
      rect(g, x0, y, wd, 1, 'y');
      px(g, x0 + 3, y, 'Y'); px(g, x0 + wd - 4, y, 'Y');
      if (k > 2) px(g, x0 + (wd >> 1), y, 'Y');
    }
    var hb = 22 + dy; for (var i = 0; i < 14; i += 3) px(g, 5 + i + sw, hb, 'c');
    stamp(g, headGrid('back'), 6, hy);
    return { base: g, heads: [{ key: 'back', x: 6, y: hy, rot: 0, flip: false }] };
  }
  // climbing a ladder seen from behind: one arm up, the other gripping at shoulder height
  function climbFrame(leftUp) {
    var g = blank(CW, CH);
    var f = backFrame({ hy: 6, dy: 0, armL: leftUp ? 'up' : 'fwd', armR: leftUp ? 'fwd' : 'up', legs: leftUp ? 'runA' : 'runB' });
    return f;
  }

  // ---- top-down Carl (book 1's overworld frames, kept for map markers etc.): 16x20 canvas ----
  var OWW = 16, OWH = 20;
  HEADS.owf = { view: 'front', h: 10, g: [
    '..hhhhhhhh..', '.hhhhhhhhhh.', 'hhhhhhhhhhhh', 'hhhhshhshhhh', 'hhsssssssshh',
    'SsswwsswwssS', 'SsseesseessS', '.ssssSSssss.', '..sSsmmsSs..', '...SsSsSS...'] };
  HEADS.owb = { view: 'back', h: 10, g: [
    '..hhhhhhhh..', '.hhhhhhhhhh.', 'hhhhhhhhhhhh', 'hhhhhhhhhhhh', 'hhhhhhhhhhhh',
    'Shhhhhhhhhhs', 'Shhhhhhhhhhs', '.hhhhhhhhhh.', '..ssssssss..', '...SSSSSS...'] };
  HEADS.ows = { view: 'side', h: 10, g: [
    '..hhhhhhh...', '.hhhhhhhhhh.', 'hhhhhhhhhhhh', 'hhhhhhshhsh.', 'hhSssssssss.',
    'hSkSsssswes.', 'hSSssssswes.', '.hSssssssssn', '..SssssmmmS.', '...SSSSSSS..'] };
  var OW_BODY = {
    down: [[
      '.cujqtttqjvc', 'cuUjqtTtqjVv', '.ggjqtttqjss', '...bBbbBb...', '...bbb.bbb..', '...pl...pl..', '..fiF...fiF.'
    ], [
      '.cujqtttqjvc', 'cuUjqtTtqjVv', '.ggjqtttqjss', '...bBbbBb...', '..bbb.bbb...', '..pl...pl...', '..fiF..fiF..'
    ]],
    up: [[
      '.cvyyyyyyuc.', '.vVyyyYyyuU.', '.ssyYyyyygg.', '..cyyyyYyc..', '...bbb.bbb..', '...ll...ll..', '...FF...FF..'
    ], [
      '.cvyyyyyyuc.', '.vVyyyYyyuU.', '.ssyYyyyygg.', '..cyyyyYyc..', '..bbb.bbb...', '..ll...ll...', '..FF...FF...'
    ]],
    side: [[
      '..cjjttj....', '.ccujqTj....', '.cCuUttjj...', '.cc.ggbBb...', '...bbb.bbb..', '..pl....pl..', '.fiF....fiF.'
    ], [
      '..cjjttj....', '..cujqTj....', '.ccuUttj....', '.cCcggbB....', '..c.bbbb....', '....ppll....', '....fiFF....'
    ]]
  };
  function owFrame(headKey, bodyRows, headDy) {
    var g = blank(OWW, OWH), hy = 2 + (headDy || 0);
    stamp(g, bodyRows, 2, 12);
    stamp(g, P(HEADS[headKey].g, 12, 10), 2, hy);
    return { base: g, heads: [{ key: headKey, x: 2, y: hy, rot: 0, flip: false }] };
  }

  // ---- all carl frames ----
  var CARL = {};
  (function () {
    var HX = 7, HY = 4, BY = 14;
    CARL.carl_idle = [
      carlFrame('side', HX, HY, B_IDLE, 0, BY, 'hang', 9, 14),
      carlFrame('side', HX, HY + 1, B_IDLE.slice(0, 6).concat(B_IDLE.slice(7)), 0, BY + 1, 'hang', 9, 15)
    ];
    CARL.carl_run = [
      carlFrame('side', HX + 1, HY, B_RUN[0], 0, BY, 'runA', 9, 14),
      carlFrame('side', HX + 1, HY - 1, B_RUN[1], 0, BY - 1, 'runB', 9, 13),
      carlFrame('side', HX + 1, HY, B_RUN[2], 0, BY, 'runA', 9, 14),
      carlFrame('side', HX + 1, HY - 1, B_RUN[3], 0, BY - 1, 'runB', 9, 13)
    ];
    CARL.carl_jump = [carlFrame('open', HX, HY - 2, B_JUMP, 0, BY - 2, 'down', 9, 12)];
    CARL.carl_fall = [carlFrame('open', HX, HY - 1, B_FALL, 0, BY - 1, 'up', 9, 6)];
    CARL.carl_punch = [carlFrame('grit', HX + 1, HY, B_PUNCH1, 0, BY, 'lean', 9, 14), carlFrame('open', HX + 2, HY, B_PUNCH2, 0, BY, 'lean', 9, 14)];
    CARL.carl_kick = [carlFrame('grit', HX, HY, B_KICK1, 0, BY, 'lean', 9, 14), carlFrame('open', HX - 1, HY + 1, B_KICK2, 0, BY, 'lean', 8, 15)];
    CARL.carl_airkick = [carlFrame('open', HX - 2, HY - 1, B_AIRKICK, 0, BY, 'up', 8, 6)];
    CARL.carl_throw = [carlFrame('open', HX + 1, HY, B_THROW, 0, BY, 'lean', 9, 14)];
    CARL.carl_launch = [carlFrame('grit', HX + 5, HY, B_LAUNCH, 0, BY, 'lean', 13, 14, [32, 28])];
    CARL.carl_hurt = [carlFrame('hurt', HX - 2, HY + 1, B_HURT, 0, BY, 'blown', 8, 9)];
    CARL.carl_plant = [carlFrame('grit', HX + 1, HY + 2, rows(plantBody()), 0, 0, 'kneel', 10, 17)];
    CARL.carl_victory = [carlFrame('happy', HX, HY, B_VICTORY, 0, 10, 'hang', 9, 14)];
    CARL.carl_climb = [climbFrame(true), climbFrame(false)];
    // dead: lying on his back, head on the left, cloak spread under him
    CARL.carl_dead = [(function () {
      var g = blank(CW, CH);
      var lying = [
        '............fi',
        '...........PpF',
        'vvVvvjj....pll',
        'jqtttqjbBbblll',
        'jqtTtqjbbbBlll',
        'jjjjjjjbbbbll.',
        'uuUuugg.......'
      ];
      stamp(g, lying, 10, 20);
      under(g, ['cccccccccccccc', 'cCcccCcccccccc'], 8, 26);
      var f = { base: g, heads: [] };
      var hx = 0, hy = CH - 12;
      f.heads.push({ key: 'hurt', x: hx, y: hy, rot: -1, flip: false });
      stamp(g, headGrid('hurt', -1), hx, hy);
      return f;
    })()];
    CARL.carl_ow_down = [owFrame('owf', OW_BODY.down[0], 0), owFrame('owf', OW_BODY.down[1], 1)];
    CARL.carl_ow_up = [owFrame('owb', OW_BODY.up[0], 0), owFrame('owb', OW_BODY.up[1], 1)];
    CARL.carl_ow_side = [owFrame('ows', OW_BODY.side[0], 0), owFrame('ows', OW_BODY.side[1], 0)];
    // back view set (rooms.js)
    CARL.carl_back_idle = [backFrame({}), backFrame({ dy: 1, sway: 0 })];
    CARL.carl_back_run = [
      backFrame({ armL: 'fwd', armR: 'back', legs: 'runA', sway: -1, dy: -1 }),
      backFrame({ armL: 'back', armR: 'fwd', legs: 'runB', sway: 1, dy: -1 })
    ];
    CARL.carl_back_throw = [backFrame({ armL: 'out', armR: 'up', legs: 'wide', sway: -1 })];
    CARL.carl_back_jump = [backFrame({ dy: -2, armL: 'out', armR: 'out', legs: 'tuck', hem: 'flare' })];
    CARL.carl_back_hurt = [backFrame({ hy: 4, dy: 1, armL: 'out', armR: 'back', legs: 'wide', sway: 2 })];
  })();

  /* ---------------- Carl skins ----------------
   * pal: base char recolours. pat(c, k): per-pixel pattern colour (k = pattern class).
   * acc(o, H): accessory painter on a colour overlay around the head (H.view side|back|front|dead).
   * body(col, f): painter over the whole composed frame (f.base = char grid) - sashes etc.
   */
  var SKIN_DEFS = {};
  SKIN_DEFS.carl_f3 = { pal: {} };
  // book 1's classic look: both sleeves, bare chest, no cloak / gauntlet / kneepads
  SKIN_DEFS.carl_boxers = { pal: { t: '#fce0a8', T: '#fca044', u: '#881400', U: '#503000', g: '#fce0a8', G: '#fca044', c: null, C: null, p: '#fce0a8', P: null } };
  SKIN_DEFS.carl_jacket = {
    pal: { t: C.W, T: C.g1, b: C.b3, B: C.b1, l: C.b3, f: C.W, F: C.g1, u: '#881400', U: '#503000', p: C.b1, i: C.W },
    pat: function (c, k) { if (c === 'b' && k === 'd') return C.b4; }
  };
  SKIN_DEFS.carl_bodyguard = {
    pal: { j: C.g1, J: C.g0, v: C.g1, V: C.g0, u: C.g1, U: C.g0, q: C.b1, t: C.b3, T: C.y2, b: C.g0, B: C.g1, l: C.g1, f: C.g0, F: C.g3, i: C.g0, s: '#fce0a8', c: C.b1, C: C.b3 },
    pat: function (c, k) {
      if ((c === 'j' || c === 'v' || c === 'u') && (k === 'b' || k === 'x')) return C.g2;
      if (c === 'l' && (k === 'b' || k === 'x')) return C.g0;
    },
    acc: function (o, H) { // steel helm with a gold crown band
      var x = H.x, y = H.y, w = H.w;
      if (H.view === 'back') {
        rectO(o, x, y - 1, w, 6, C.g1); rectO(o, x + 1, y - 1, w - 2, 1, C.g2);
        crownO(o, x + 1, y - 3, w - 2, C.y2);
        rectO(o, x, y + 4, w, 1, C.y2);
        return;
      }
      if (H.view === 'front') {
        rectO(o, x, y - 1, w, 4, C.g1); rectO(o, x, y + 3, w, 1, C.y2); crownO(o, x + 1, y - 3, w - 2, C.y2);
        pxO(o, x + (w >> 1), y - 1, C.o1); pxO(o, x + (w >> 1) - 1, y - 1, C.o1);
        return;
      }
      if (H.view === 'dead') { rectO(o, x - 2, y, 6, H.h, C.g1); rectO(o, x + 3, y, 1, H.h, C.y2); return; }
      rectO(o, x, y - 1, w - 1, 5, C.g1); rectO(o, x + 1, y - 2, w - 3, 1, C.g1);
      rectO(o, x + 2, y - 2, w - 6, 1, C.g2);
      rectO(o, x, y + 4, 3, 5, C.g1); rectO(o, x, y + 4, 1, 5, C.g0);
      rectO(o, x, y + 3, w - 1, 1, C.y2);
      crownO(o, x + 1, y - 4, w - 3, C.y2);
      pxO(o, x + 6, y + 3, C.o1);
    }
  };
  SKIN_DEFS.carl_kilt = {
    pal: { j: '#fce0a8', J: '#fca044', v: '#fce0a8', V: '#fca044', q: '#fca044', t: '#fce0a8', T: '#fca044', b: C.r0, B: C.G0, f: '#fce0a8', F: '#fca044', c: C.G0, C: C.r0 },
    pat: function (c, k) {
      if (c === 'b' || c === 'B') { // tartan
        if (k === 'x') return C.y2;
        if (k === 'b' || k === 's') return C.G0;
        return C.r0;
      }
    },
    acc: function (o, H) { // blue tam o' shanter with red pom-pom
      var x = H.x, y = H.y, w = H.w;
      if (H.view === 'dead') { rectO(o, x - 3, y + 1, 4, H.h - 2, C.b1); pxO(o, x - 4, y + (H.h >> 1), C.o1); return; }
      rectO(o, x - 1, y - 1, w + 1, 3, C.b1);
      rectO(o, x, y - 2, w - 1, 1, C.b1);
      rectO(o, x - 1, y + 1, w + 1, 1, C.r0);
      if (H.view !== 'front' && H.view !== 'back') { pxO(o, x + 2, y + 1, C.G0); pxO(o, x + 5, y + 1, C.G0); pxO(o, x + 8, y + 1, C.G0); }
      rectO(o, x + (w >> 1) - 1, y - 4, 2, 2, C.o1);
    }
  };
  SKIN_DEFS.carl_hazmat = {
    pal: { j: C.y2, J: C.y1, v: C.y2, V: C.y1, u: C.y2, U: C.y1, q: C.y1, t: C.y2, T: C.K, b: C.y2, B: C.y1, l: C.y2, f: C.G0, F: C.t0, i: C.G0, s: C.G1, S: C.G0, n: C.G1, g: C.G1, G: C.G0, c: C.y1, C: C.y2 },
    pat: function (c, k) { if ((c === 'b' || c === 'j') && (k === 'b' || k === 'x')) return C.y1; },
    acc: function (o, H) { // yellow hood with a big cyan visor; covers the whole head
      var x = H.x, y = H.y, w = H.w, h = H.h;
      if (H.view === 'dead') { rectO(o, x - 1, y - 1, w + 2, h + 2, C.y2); rectO(o, x + 3, y + 2, 5, h - 4, C.b6); rectO(o, x + 4, y + 3, 3, 2, C.W); return; }
      rectO(o, x - 1, y - 1, w + 1, h + 1, C.y2);
      rectO(o, x, y - 2, w - 1, 1, C.y2);
      if (H.view === 'back') { rectO(o, x + 2, y + 2, w - 4, 1, C.y1); return; }
      if (H.view === 'front') { rectO(o, x + 1, y + 3, w - 2, h - 5, C.b6); rectO(o, x + 2, y + 4, 2, 1, C.W); return; }
      rectO(o, x + 4, y + 4, w - 3, h - 6, C.b6);
      rectO(o, x + 5, y + 4, 3, 1, C.W);
      pxO(o, x + 6, y + 6, C.K); pxO(o, x + 10, y + 6, C.K); pxO(o, x + 6, y + 7, C.K); pxO(o, x + 10, y + 7, C.K);
      rectO(o, x, y + h - 2, 4, 2, C.y1);
    }
  };
  SKIN_DEFS.carl_pajamas = {
    pal: { j: C.b4, J: C.b2, v: C.b4, V: C.b2, u: C.b4, U: C.b2, q: C.b2, t: C.b4, T: C.W, b: C.b4, B: C.b2, l: C.b4, f: C.b2, F: C.b1, i: C.b2, c: C.b1, C: C.b2 },
    pat: function (c, k) {
      if ('jvutblc'.indexOf(c) >= 0 && k === 'x') return C.y3; // little stars
    },
    acc: function (o, H) { // striped nightcap flopping backwards with a pom-pom
      var x = H.x, y = H.y, w = H.w;
      if (H.view === 'dead') { rectO(o, x - 2, y, 3, H.h, C.b2); for (var d = 0; d < H.h; d += 2) pxO(o, x - 1, y + d, C.W); pxO(o, x - 3, y + H.h + 1, C.W); return; }
      for (var i = 0; i < w + 1; i++) { pxO(o, x - 1 + i, y, i % 2 ? C.W : C.b2); pxO(o, x - 1 + i, y - 1, i % 2 ? C.b2 : C.W); }
      rectO(o, x + 1, y - 2, w - 3, 1, C.b2);
      if (H.view === 'front' || H.view === 'back') { rectO(o, x + 3, y - 3, w - 6, 1, C.W); pxO(o, x + 2, y - 4, C.W); pxO(o, x + 1, y - 4, C.W); return; }
      rectO(o, x - 1, y - 3, w - 5, 1, C.W); rectO(o, x - 2, y - 2, 3, 1, C.b2);
      rectO(o, x - 3, y + 1, 2, 3, C.b2); pxO(o, x - 3, y + 2, C.W);
      rectO(o, x - 4, y + 4, 2, 2, C.W);
    }
  };
  SKIN_DEFS.carl_clown = {
    pal: { s: C.W, S: C.m3, n: C.o1, h: C.o1, j: C.m1, J: C.m0, v: C.y2, V: C.y1, u: C.y2, U: C.y1, q: C.m0, t: C.y2, T: C.o1, b: C.G1, B: C.y2, l: C.W, f: C.o1, F: C.o0, i: C.y2, c: C.m1, C: C.y2 },
    pat: function (c, k) {
      if ((c === 'j' || c === 't' || c === 'b' || c === 'c') && k === 'd') return c === 't' ? C.b3 : C.W;
      if (c === 'l' && (k === 'b' || k === 'x')) return C.o1;
      if ((c === 'v' || c === 'u') && (k === 's' || k === 'x')) return C.G1;
    },
    acc: function (o, H) { // rainbow afro wig + red nose + red smile
      var x = H.x, y = H.y, w = H.w;
      var rb = [C.o1, C.n2, C.y2, C.G1, C.b3, C.m1];
      if (H.view === 'dead') { for (var d = 0; d < 6; d++) rectO(o, x - 3 + (d % 3), y - 1 + d * 2, 4, 2, rb[d]); return; }
      var puffs = H.view === 'side' ? [[-3, 1], [-2, -2], [1, -3], [5, -3], [9, -2], [-3, 5], [-2, 8]] :
        [[-3, 1], [-2, -2], [1, -3], [5, -3], [9, -2], [12, 1], [-3, 5], [12, 5]];
      for (var i = 0; i < puffs.length; i++) rectO(o, x + puffs[i][0], y + puffs[i][1], 4, 4, rb[i % rb.length]);
      if (H.view === 'side') { pxO(o, x + 11, y + 8, C.o1); pxO(o, x + 12, y + 8, C.o1); pxO(o, x + 11, y + 9, C.o1); rectO(o, x + 6, y + 10, 5, 1, C.o1); }
      if (H.view === 'front') { pxO(o, x + 5, y + 7, C.o1); pxO(o, x + 6, y + 7, C.o1); rectO(o, x + 3, y + 8, 6, 1, C.o1); }
    }
  };
  SKIN_DEFS.carl_toga = {
    pal: { j: C.W, J: C.g1, v: '#fce0a8', V: '#fca044', q: C.g1, t: C.W, T: C.g1, b: C.W, B: C.g1, f: C.y1, F: C.y0, i: C.y2, c: C.r0, C: C.o0 },
    pat: function (c, k) {
      if ('tjbB'.indexOf(c) >= 0 && (k === 's' || k === 'x')) return C.g1; // drape folds
    },
    acc: function (o, H) { // laurel wreath
      var x = H.x, y = H.y, w = H.w;
      if (H.view === 'dead') { for (var d = 0; d < H.h; d += 2) { pxO(o, x - 1, y + d, C.G1); pxO(o, x - 2, y + d + 1, C.G2); } return; }
      for (var i = -1; i < w; i++) { pxO(o, x + i, y + 1 + (i % 2 ? 0 : 1), i % 3 ? C.G1 : C.G2); pxO(o, x + i, y, (i % 2) ? C.G2 : C.G1); }
      pxO(o, x - 1, y - 1, C.G2); pxO(o, x + w - 1, y - 1, C.G2);
      if (H.view === 'side') { pxO(o, x - 2, y + 2, C.G1); pxO(o, x - 2, y + 3, C.G2); pxO(o, x + 3, y + 2, C.G2); }
    }
  };
  SKIN_DEFS.carl_gold = {
    pal: { s: C.y2, S: C.y1, n: C.y2, h: C.y3, e: C.y0, m: C.y0, j: C.y2, J: C.y1, v: C.y2, V: C.y1, u: C.y2, U: C.y1, q: C.y1, t: C.y3, T: C.y1, b: C.y2, B: C.W, l: C.y2, f: C.y1, F: C.y0, i: C.W, g: C.y3, G: C.y1, c: C.y1, C: C.y2, p: C.y1, P: C.W, x: C.y3, X: C.y1 },
    pat: function (c, k) {
      if (k === 'x') return C.W;            // shine glints
      if (k === 'd') return C.y3;
    },
    acc: function (o, H) { // little floating sparkles around the head
      var x = H.x, y = H.y;
      if (H.view === 'dead') return;
      pxO(o, x - 2, y - 1, C.W); pxO(o, x - 3, y, C.y3); pxO(o, x - 1, y, C.y3); pxO(o, x - 2, y + 1, C.y3);
      pxO(o, x + H.w, y - 3, C.W);
    }
  };
  // Magistrate of the Medium Skyfowl Settlement: red sash + a ridiculous plumed bicorne
  SKIN_DEFS.carl_magistrate = {
    pal: { c: C.p0, C: C.p1 },
    body: function (col, f) { // diagonal sash over the torso (shoulder to hip), red with a gold edge
      var bb = bbox(f.base, 'jqtTJ');
      if (!bb) return;
      for (var y = bb.y0; y <= bb.y1; y++) for (var x = bb.x0; x <= bb.x1; x++) {
        var c = f.base[y][x]; if ('jqtTJ'.indexOf(c) < 0) continue;
        var d = (x - bb.x0) - Math.round((y - bb.y0) * (bb.x1 - bb.x0) / Math.max(1, bb.y1 - bb.y0));
        if (d === 0 || d === 1) col[y][x] = C.o1; else if (d === 2) col[y][x] = C.y2;
      }
    },
    acc: function (o, H) {
      var x = H.x, y = H.y, w = H.w;
      if (H.view === 'dead') { rectO(o, x - 3, y - 1, 3, H.h + 2, C.p0); rectO(o, x - 4, y + 2, 1, H.h - 4, C.y2); rectO(o, x - 6, y + 3, 2, 5, C.W); return; }
      // a huge purple bicorne with gold trim and an absurd white plume flopping back over the hat
      rectO(o, x - 2, y, w + 4, 2, C.p0); rectO(o, x - 3, y + 1, 2, 2, C.p0); rectO(o, x + w + 1, y + 1, 2, 2, C.p0);
      rectO(o, x, y - 2, w, 2, C.p0); rectO(o, x + 2, y - 3, w - 4, 1, C.p0);
      rectO(o, x - 2, y + 2, w + 4, 1, C.y2);
      pxO(o, x + (w >> 1), y - 1, C.y2); pxO(o, x + (w >> 1), y - 2, C.o1);
      if (H.view === 'back') { rectO(o, x + 1, y - 4, w - 2, 1, C.W); pxO(o, x, y - 3, C.W); pxO(o, x + w - 1, y - 3, C.W); return; }
      rectO(o, x + 3, y - 4, 6, 1, C.W); rectO(o, x - 1, y - 3, 5, 1, C.W); rectO(o, x - 4, y - 2, 4, 1, C.W); rectO(o, x - 5, y - 1, 2, 2, C.W); pxO(o, x - 6, y + 1, C.W); pxO(o, x - 3, y - 1, C.g1); pxO(o, x + 1, y - 4, C.g1);
    }
  };
  // Primal: fur pelt instead of the jacket, fur loincloth, a fur cloak, blue war paint, bone + feathers
  SKIN_DEFS.carl_primal = {
    pal: { j: C.n2, J: C.y1, v: C.n2, V: C.y1, q: C.y1, t: '#fce0a8', T: '#fca044', b: C.y1, B: C.y0, c: C.y0, C: C.y1, h: C.n0 },
    pat: function (c, k) {
      if ((c === 'j' || c === 'v' || c === 'b') && k === 'd') return C.y0; // pelt spots
      if ((c === 'u' || c === 't') && k === 'b') return C.b3;               // war paint stripes
    },
    acc: function (o, H) { // wild mane + bone through it + two feathers
      var x = H.x, y = H.y, w = H.w;
      if (H.view === 'dead') { rectO(o, x - 3, y + 1, 3, H.h - 2, C.n0); rectO(o, x - 4, y + 3, 1, 5, C.W); return; }
      rectO(o, x - 2, y, 3, 6, C.n0); rectO(o, x - 1, y - 2, w - 2, 2, C.n0); pxO(o, x - 3, y + 2, C.n0); pxO(o, x - 3, y + 5, C.n0);
      if (H.view === 'side') { rectO(o, x + 1, y - 3, 8, 1, C.W); pxO(o, x, y - 4, C.W); pxO(o, x, y - 2, C.W); pxO(o, x + 9, y - 4, C.W); pxO(o, x + 9, y - 2, C.W); }
      else rectO(o, x + 2, y - 3, w - 4, 1, C.W);
      rectO(o, x - 3, y - 5, 1, 4, C.o1); pxO(o, x - 4, y - 6, C.o1); rectO(o, x - 1, y - 6, 1, 4, C.b3); pxO(o, x - 1, y - 7, C.y2);
    }
  };

  function bbox(g, chars) {
    var b = null;
    for (var y = 0; y < g.length; y++) for (var x = 0; x < g[0].length; x++) if (chars.indexOf(g[y][x]) >= 0) {
      if (!b) b = { x0: x, x1: x, y0: y, y1: y }; else { b.x0 = Math.min(b.x0, x); b.x1 = Math.max(b.x1, x); b.y0 = Math.min(b.y0, y); b.y1 = Math.max(b.y1, y); }
    }
    return b;
  }
  var PATCH = 'jJvVtbBluUcCyY';
  function patClass(x, y) {
    if ((x + 2 * y) % 5 === 0) return 'd';
    var b = y % 3 === 0, s = x % 3 === 0;
    return b && s ? 'x' : b ? 'b' : s ? 's' : '';
  }
  // overlay paint helpers (o is a colour grid; undefined = untouched)
  function pxO(o, x, y, c) { if (y >= 0 && y < o.length && x >= 0 && x < o[0].length) o[y][x] = c; }
  function rectO(o, x, y, w, h, c) { for (var j = 0; j < h; j++) for (var i = 0; i < w; i++) pxO(o, x + i, y + j, c); }
  function crownO(o, x, y, w, c) { for (var i = 0; i < w; i++) { pxO(o, x + i, y + 2, c); if (i % 3 === 0) { pxO(o, x + i, y + 1, c); pxO(o, x + i, y, c); } } pxO(o, x + 1, y + 2, C.o1); pxO(o, x + w - 2, y + 2, C.b4); }

  /* Encode: compose each carl frame per skin into colour grids, then assign palette chars
   * so that the default palette shows the base look and each skin's palette shows its own. */
  (function encodeCarl() {
    var skinIds = Object.keys(SKIN_DEFS); // carl_f3 first = default look
    var used = {}; Object.keys(CARL_PAL).forEach(function (k) { used[k] = 1; }); used['.'] = 1; used[' '] = 1;
    var pool = [];
    var cand = '0123456789DEHIKLMNOQRWYZdoryz!#$%&()*+,-/:;<=>?@[]^_{|}~`';
    for (var i = 0; i < cand.length; i++) if (!used[cand[i]] && pool.indexOf(cand[i]) < 0) pool.push(cand[i]);
    for (i = 0xC0; i <= 0xFF; i++) if (i !== 0xD7 && i !== 0xF7) pool.push(String.fromCharCode(i));
    for (i = 0x100; i < 0x2B0; i++) pool.push(String.fromCharCode(i));
    for (i = 0x400; i < 0x530; i++) pool.push(String.fromCharCode(i));
    var sigMap = {}, genPal = {}; // sig -> char ; char -> {skin: colour}
    skinIds.forEach(function (s) { genPal[s] = {}; });
    function palColor(s, c) { var sp = SKIN_DEFS[s].pal; return sp[c] !== undefined ? sp[c] : CARL_PAL[c]; } // what art.js renders
    function resolved(s, c) {                                                                                       // what the skin means
      var sp = SKIN_DEFS[s].pal;
      if (sp[c] !== undefined) return sp[c];
      if (c === 'y' || c === 'Y') { var cl = resolved(s, c === 'y' ? 'c' : 'C'); return cl !== null && cl !== undefined ? cl : resolved(s, c === 'y' ? 'j' : 'J'); }
      return CARL_PAL[c];
    }

    function composeSkin(f, s, w, h) {
      var sd = SKIN_DEFS[s];
      var col = [];
      for (var y = 0; y < h; y++) {
        var r = [];
        for (var x = 0; x < w; x++) {
          var c = f.base[y][x], v = null;
          if (!T(c)) {
            v = resolved(s, c);
            if (v && sd.pat && PATCH.indexOf(c) >= 0) { var pv = sd.pat(c, patClass(x, y)); if (pv !== undefined && pv !== null) v = pv; }
          }
          r.push(v);
        }
        col.push(r);
      }
      if (sd.body) sd.body(col, f);
      // accessories around each head
      if (sd.acc) f.heads.forEach(function (hd) {
        var hh = HEADS[hd.key].h || 12;
        var M = 10, LW = 12 + M * 2, LH = hh + M * 2;
        var o = []; for (var y2 = 0; y2 < LH; y2++) { var rr = []; for (var x2 = 0; x2 < LW; x2++) rr.push(undefined); o.push(rr); }
        var view = hd.rot ? 'dead' : HEADS[hd.key].view;
        sd.acc(o, { x: M, y: M, w: 12, h: hh, view: view, key: hd.key });
        var ow = LW, oh = LH, get = function (i, j) { return o[j][i]; };
        if (hd.rot === -1) { ow = LH; oh = LW; get = function (i, j) { return o[i][LW - 1 - j]; }; }
        else if (hd.rot === 1) { ow = LH; oh = LW; get = function (i, j) { return o[LH - 1 - i][j]; }; }
        for (var j = 0; j < oh; j++) for (var i = 0; i < ow; i++) {
          var v = get(i, j); if (v === undefined) continue;
          var X = hd.x - M + i, Y = hd.y - M + j;
          if (Y >= 0 && Y < h && X >= 0 && X < w) col[Y][X] = v;
        }
      });
      // outline
      var out = col.map(function (r) { return r.slice(); });
      for (y = 0; y < h; y++) for (x = 0; x < w; x++) {
        if (col[y][x]) continue;
        if ((y > 0 && col[y - 1][x]) || (y < h - 1 && col[y + 1][x]) || (x > 0 && col[y][x - 1]) || (x < w - 1 && col[y][x + 1])) out[y][x] = C.K;
      }
      return out;
    }

    Object.keys(CARL).forEach(function (name) {
      var frames = CARL[name];
      var w = GW(frames[0].base), h = GH(frames[0].base);
      var outFrames = frames.map(function (f) {
        var per = {}; skinIds.forEach(function (s) { per[s] = composeSkin(f, s, w, h); });
        var g = blank(w, h);
        for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) {
          var c = f.base[y][x];
          var sig = [], allSame = true, any = false;
          for (var si = 0; si < skinIds.length; si++) {
            var s = skinIds[si], v = per[s][y][x] || null;
            if (v) any = true;
            sig.push(v || '-');
            if ((v || null) !== (T(c) ? null : palColor(s, c))) allSame = false;
          }
          if (!any) continue;
          if (!T(c) && allSame) { g[y][x] = c; continue; }
          if (sig.every(function (q) { return q === C.K; })) { g[y][x] = 'k'; continue; }
          var key = sig.join('|');
          var ch = sigMap[key];
          if (!ch) {
            ch = pool.shift();
            if (!ch) throw new Error('art_actors: out of palette chars');
            sigMap[key] = ch;
            for (si = 0; si < skinIds.length; si++) genPal[skinIds[si]][ch] = sig[si] === '-' ? null : sig[si];
          }
          g[y][x] = ch;
        }
        return g;
      });
      CARL[name].encoded = outFrames;
    });

    var basePal = {}; for (var k in CARL_PAL) basePal[k] = CARL_PAL[k];
    var def0 = genPal.carl_f3;
    for (var ch in def0) basePal[ch] = def0[ch];
    Object.keys(CARL).forEach(function (name) {
      var fr = CARL[name].encoded;
      defs[name] = { w: GW(fr[0]), h: GH(fr[0]), pal: basePal, frames: fr.map(rows) };
    });
    skinIds.forEach(function (s) {
      var p = {}, sp = SKIN_DEFS[s].pal;
      for (var k2 in sp) p[k2] = sp[k2];
      var gp = genPal[s];
      for (var c2 in gp) if (gp[c2] !== basePal[c2]) p[c2] = gp[c2];
      skins[s] = { pal: p };
    });
    K.carlCharsUsed = Object.keys(sigMap).length;
  })();

  /* derived frames (same encoded chars, so skins apply): crouches */
  function squash(src, drop) {
    var blankRow = new Array(src.w + 1).join('.');
    var frames = src.frames.map(function (rws) {
      var kept = rws.filter(function (r, i) { return !drop[i]; });
      while (kept.length < src.h) kept.unshift(blankRow);
      return kept;
    });
    return { w: src.w, h: src.h, pal: src.pal, frames: [frames[0]] };
  }
  defs.carl_crouch = squash(defs.carl_idle, { 16: 1, 17: 1, 19: 1, 24: 1, 25: 1 });
  defs.carl_back_duck = squash(defs.carl_back_idle, { 16: 1, 17: 1, 19: 1, 24: 1, 25: 1 });
  K.CARL_PAL = CARL_PAL;
  // where Donut sits, as offsets from Carl's feet anchor (sprite x, y passed to art.sprite), facing right
  K.carlShoulder = { side: { dx: -7, dy: -12 }, back: { dx: -7, dy: -12 }, note: 'draw donut_shoulder / donut_back with its bottom-centre at (carlX + dx, carlY + dy); mirror dx when Carl faces left' };
})();


/* ================================================================== *
 *  COMPANIONS: Princess Donut, Mongo (small / big / clockwork), Katia
 * ================================================================== */
(function () {
  'use strict';
  var DCW = window.DCW, K = DCW.artActorsKit, C = K.C;
  var rect = K.rect, px = K.px, oval = K.oval, line = K.line, tri = K.tri, poly = K.poly, dots = K.dots;
  var pspr = K.pspr, spr = K.spr, alt = K.alt, legs = K.legs, alias = K.alias, def = K.def, paint = K.paint, withK = K.withK, hurtPal = K.hurtPal;

  /* ---- Princess Donut: fluffy tortoiseshell Persian (black, beige, white), yellow eyes, crown ---- */
  var DP = { o: C.n3, O: C.n2, d: C.y0, w: C.W, W: C.g1, e: C.y2, x: C.K, n: C.m2, y: C.y2, Y: C.y1, r: C.r1, m: C.r0, s: C.b6, S: C.W, z: C.g1 };
  function donut(g, o) {
    var pose = o.pose || 'stand', bx = o.bx || 0, by = o.by || 0;
    var sit = pose === 'sit', down = pose === 'down';
    if (down) { // knocked out: flat on her side, legs out, crown off
      oval(g, 9, 11, 7, 2.5, 'o'); oval(g, 12, 12, 3, 1.5, 'w'); rect(g, 5, 10, 3, 2, 'd'); rect(g, 10, 9, 2, 1, 'd');
      line(g, 1, 12, 0, 9, 'o', 2); px(g, 0, 9, 'd');
      oval(g, 17, 10, 3.5, 3, 'o'); rect(g, 15, 8, 2, 3, 'd'); px(g, 19, 7, 'd'); px(g, 15, 7, 'd');
      px(g, 16, 10, 'x'); px(g, 18, 9, 'x'); px(g, 18, 11, 'x'); px(g, 17, 10, 'x'); px(g, 19, 10, 'x'); px(g, 18, 10, 'x');
      px(g, 20, 11, 'n'); line(g, 10, 14, 14, 14, 'o'); line(g, 6, 14, 8, 14, 'o');
      rect(g, 19, 13, 3, 1, 'y'); px(g, 20, 12, 'y'); px(g, 20, 13, 'r');
      return;
    }
    // tail
    var tl = o.tail || 0;
    if (sit) { poly(g, [[4 + bx, 13 + by], [2 + bx, 15 + by], [2 + bx, 18 + by], [3 + bx - tl, 20 + by]], 'o', 2); px(g, 2 + bx, 17 + by, 'd'); px(g, 3 + bx - tl, 19 + by, 'd'); }
    else { poly(g, [[4 + bx, 9 + by], [2 + bx, 7 + by - tl], [1 + bx, 4 + by - tl], [2 + bx, 2 + by - tl]], 'o', 2); px(g, 1 + bx, 5 + by - tl, 'd'); px(g, 2 + bx, 3 + by - tl, 'd'); px(g, 1 + bx, 2 + by - tl, 'd'); }
    // body
    if (sit) { oval(g, 8 + bx, 13 + by, 5.5, 4.5, 'o'); oval(g, 10 + bx, 14 + by, 2.5, 3, 'w'); oval(g, 5 + bx, 12 + by, 2, 2.5, 'd'); px(g, 3 + bx, 15 + by, 'O'); }
    else { oval(g, 8 + bx, 10 + by, 6.5, 3.6, 'o'); oval(g, 12 + bx, 11 + by, 2.5, 2.5, 'w'); oval(g, 6 + bx, 8 + by, 3, 1.5, 'd'); px(g, 3 + bx, 11 + by, 'O'); px(g, 9 + bx, 8 + by, 'O'); }
    // legs
    var L = { stand: [[4, 13], [6, 13], [10, 13], [12, 13]], run0: [[2, 12], [4, 13], [12, 13], [14, 12]], run1: [[6, 13], [7, 13], [9, 13], [10, 13]], cast: [[4, 13], [6, 13], [10, 13]], sit: [[9, 17], [11, 17]] }[pose] || [];
    L.forEach(function (q, k) { rect(g, q[0] + bx, q[1] + by, 2, 2, k % 2 ? 'O' : 'o'); px(g, q[0] + bx, q[1] + 1 + by, 'w'); });
    // head: big round flat-faced Persian head (stamped pixel art), tortie mask over one eye
    var hx = (sit ? 4 : 7) + bx, hy = (sit ? 0 : 1) + by;
    var H = [
      '..d.......o..',
      '.ddd.....ooo.',
      'ddddooooooooo',
      'dddddoooooooo',
      'dddeexooooeex',
      'ddoeexooooeex',
      'dooooowwnwwoo',
      '.ooooowwwwwo.',
      '..oooowwwwo..',
      '....oooooo...'
    ];
    if (o.blink) { H[4] = 'dddxxxooooxxx'; H[5] = 'ddooooooooooo'; }
    if (o.mouth) { H[7] = '.ooooowmmmwo.'; H[8] = '..oooowmmwo..'; }
    K.stamp(g, H, hx, hy);
    // crown (Crown of the Sepsis Whore)
    K.stamp(g, ['y.y.y', 'yyryy'], hx + 4, hy - 1);
    if (o.paw) { line(g, hx + 9, hy + 9, hx + 13, hy + 7, 'o', 2); px(g, hx + 14, hy + 5, 'S'); px(g, hx + 15, hy + 4, 's'); px(g, hx + 14, hy + 3, 's'); px(g, hx + 16, hy + 6, 's'); px(g, hx + 13, hy + 4, 's'); }
  }
  var DW = 24, DH = 17;
  pspr('donut_idle', DP, DW, DH, 2, function (g, i) { donut(g, { pose: 'stand', bx: 2, by: 1, tail: i, blink: i === 1 }); });
  pspr('donut_run', DP, DW, DH, 2, function (g, i) { donut(g, { pose: i ? 'run1' : 'run0', bx: 2, by: i ? 0 : 1, tail: i ? 0 : 1 }); });
  pspr('donut_cast', DP, DW, DH, 1, function (g) { donut(g, { pose: 'cast', bx: 1, by: 1, mouth: true, paw: true }); });
  // riding on Carl's shoulder: a compact sitting Donut (sized to perch beside his head)
  function donutSmall(g, i, back) {
    var tl = i ? 1 : 0;
    poly(g, [[3, 11], [1, 13], [2 - tl, 15]], 'o', 2); px(g, 1, 14, 'd'); px(g, 2 - tl, 15, 'd');                  // tail hanging down
    oval(g, 6.5, 11.5, 4.5, 3.5, 'o'); oval(g, 4.5, 10.5, 2, 1.5, 'd');
    if (!back) { oval(g, 8.5, 12, 2, 2.5, 'w'); rect(g, 6, 15, 2, 1, 'w'); rect(g, 9, 15, 2, 1, 'w'); }
    else { px(g, 9, 13, 'O'); rect(g, 4, 15, 2, 1, 'w'); rect(g, 8, 15, 2, 1, 'w'); }
    oval(g, 7, 5.5, 4.6, 3.8, 'o');
    tri(g, 3, 3, 4, 0 - (back && i ? 1 : 0), 6, 2, 'd'); tri(g, 11, 3, 10, 0, 8, 2, 'O');                           // ears
    if (back) { oval(g, 5, 5, 2.5, 3, 'd'); px(g, 9, 4, 'O'); px(g, 10, 7, 'O'); px(g, 2, 7, 'o'); px(g, 12, 7, 'o'); }
    else {
      rect(g, 3, 4, 3, 4, 'd');                                                                                     // tortie mask
      if (i) { rect(g, 4, 5, 2, 1, 'x'); rect(g, 9, 5, 2, 1, 'x'); }
      else { px(g, 4, 5, 'e'); px(g, 5, 5, 'x'); px(g, 9, 5, 'e'); px(g, 10, 5, 'x'); }
      rect(g, 6, 7, 4, 2, 'w'); px(g, 7, 7, 'n'); px(g, 12, 6, 'o');
    }
    K.stamp(g, ['y.y.y', 'yyryy'], 5, -1);                                                                         // crown
  }
  pspr('donut_shoulder', DP, 15, 17, 2, function (g, i) { var t = K.blank(15, 17); donutSmall(t, i, false); K.stamp(g, t, 0, 1); });
  pspr('donut_down', DP, 24, 16, 1, function (g) { donut(g, { pose: 'down', bx: 0, by: 0 }); });
  alias('donut_act', 'donut_cast');
  // Donut seen from behind, sitting on Carl's shoulder in the into-the-screen rooms: back of the fluffy head,
  // ears, the crown on top, tail draped down over his shoulder. Frame 1: tail swish + ear twitch.
  pspr('donut_back', DP, 15, 17, 2, function (g, i) { var t = K.blank(15, 17); donutSmall(t, i, true); K.stamp(g, t, 0, 1); });

  /* ---- Mongo: velociraptor with pink, red and blue feathers, beady eyes, black collar ----
   * One painter at any size: k = scale (1 small, 1.7 big). Unit coords are for a 22x16 raptor. */
  var MP = { p: C.m2, P: C.m3, q: C.m1, r: C.r1, R: C.r0, b: C.b4, e: C.K, w: C.W, c: C.K, y: C.y2, Y: C.y1, z: C.o1, Z: C.y3 };
  var MCLOCK = { p: C.y2, P: C.y3, q: C.y1, r: C.n1, R: C.n0, b: C.g1, e: C.o1, w: C.W, c: C.y0, y: C.g1, Y: C.g0, z: C.y0, Z: C.W };
  function mongo(g, k, o) {
    var pose = o.pose || 'stand', ox = o.ox || 0, oy = o.oy || 0;
    function X(v) { return Math.round(v * k) + ox; } function Y(v) { return Math.round(v * k) + oy; } function S(v) { return Math.max(1, Math.round(v * k)); }
    var lift = pose === 'jump' ? -2 : pose === 'hurt' ? -1 : 0;
    var lean = pose === 'act' ? 2 : 0;
    // tail: tapering from the hips back and up
    var ty = pose === 'run1' ? 1 : pose === 'jump' ? -2 : 0;
    poly(g, [[X(8), Y(8 + lift)], [X(4), Y(7 + lift + ty)], [X(1), Y(5 + lift + ty)]], 'p', S(2.6));
    line(g, X(1), Y(5 + lift + ty), X(0), Y(4 + lift + ty), 'p', S(1));
    line(g, X(6), Y(7 + lift + ty), X(2), Y(5 + lift + ty), 'r', S(0.8));
    // legs (behind + front)
    var legsP = {
      stand: [[9, 11, 8, 14], [12, 11, 12, 14]], act: [[9, 11, 7, 14], [12, 11, 13, 14]],
      run0: [[9, 11, 5, 13], [12, 11, 15, 13]], run1: [[10, 11, 11, 14], [11, 11, 10, 14]],
      run2: [[9, 11, 6, 14], [12, 11, 14, 12]], run3: [[10, 11, 12, 14], [11, 11, 9, 12]],
      jump: [[9, 10, 7, 12], [12, 10, 14, 11]], hurt: [[9, 11, 7, 14], [12, 11, 14, 13]]
    }[pose] || [[9, 11, 8, 14], [12, 11, 12, 14]];
    legsP.forEach(function (l, n) {
      line(g, X(l[0]), Y(l[1] + lift), X(l[2]), Y(l[3] + lift), n ? 'p' : 'q', S(1.6));
      rect(g, X(l[2]) - S(0.5), Y(l[3] + lift), S(2.4), S(1), 'Y'); px(g, X(l[2]) - S(1), Y(l[3] + lift) - 1, 'w'); // foot + sickle claw
    });
    // body
    oval(g, X(11 + lean * 0.3), Y(8 + lift), 4.8 * k, 3.5 * k, 'p');
    oval(g, X(12.5 + lean * 0.3), Y(9.5 + lift), 2.6 * k, 1.6 * k, 'P');
    line(g, X(7.5), Y(6.5 + lift), X(13), Y(5.6 + lift), 'r', S(1));     // the red feather line
    line(g, X(8), Y(7.6 + lift), X(12), Y(7 + lift), 'R', S(0.6));
    // neck + head
    var hx = 15 + lean, hy = 3 + lift + (pose === 'run1' || pose === 'run3' ? 1 : 0);
    line(g, X(13), Y(7 + lift), X(hx), Y(hy + 2), 'p', S(2.4));
    rect(g, X(hx), Y(hy), S(5), S(3), 'p');                               // head block
    rect(g, X(hx + 4), Y(hy + 1), S(3), S(2), 'p');                       // snout
    rect(g, X(hx), Y(hy - 1), S(3), S(1), 'r');                           // crest feathers
    px(g, X(hx - 1), Y(hy - 1), 'r');
    rect(g, X(hx + 1), Y(hy + 0.5), S(2), S(1.4), 'b');                   // bluish skin round the eye
    px(g, X(hx + 1.6), Y(hy + 0.7), 'e');
    if (k > 1.3) px(g, X(hx + 1.6) + 1, Y(hy + 0.7), 'e');
    var jaw = pose === 'act' || pose === 'hurt';
    if (jaw) { rect(g, X(hx + 4), Y(hy + 3), S(3), S(1), 'p'); for (var t = 0; t < 3 * k; t += 2) px(g, X(hx + 4) + t, Y(hy + 3) - 1, 'w'); px(g, X(hx + 6), Y(hy + 2), 'z'); }
    else { line(g, X(hx + 4), Y(hy + 2.5), X(hx + 7) - 1, Y(hy + 2.5), 'R'); }
    if (o.fangs) { px(g, X(hx + 5), Y(hy + 3), 'Z'); px(g, X(hx + 6) , Y(hy + 3), 'Z'); }
    // little feathered arm
    var ay = pose === 'act' ? -1 : 0;
    line(g, X(13.5), Y(8 + lift), X(15.5), Y(9.5 + lift + ay), 'P', S(1)); px(g, X(15.5) + 1, Y(9.5 + lift + ay), 'w');
    px(g, X(13), Y(9 + lift), 'b'); px(g, X(14), Y(10 + lift), 'r');
    // collar
    line(g, X(13), Y(6 + lift), X(14), Y(6.8 + lift), 'c', S(1)); px(g, X(14) + 1, Y(7 + lift) + S(0.8), 'y');
    // clockwork extras: wind-up key on the back, rivets
    if (o.clock) {
      rect(g, X(10), Y(3.5 + lift), S(1), S(1.4), 'Y'); rect(g, X(9), Y(2.2 + lift), S(3), S(1.2), 'y');
      dots(g, 0, 0, g[0].length, g.length, 'p', 'q', function (x, y) { return (x * 3 + y * 5) % 11 === 0; });
    }
  }
  var MW = 22, MH = 16;
  pspr('mongo_idle', MP, MW, MH, 2, function (g, i) { mongo(g, 1, { pose: 'stand', oy: i }); });
  pspr('mongo_run', MP, MW, MH, 2, function (g, i) { mongo(g, 1, { pose: i ? 'run1' : 'run0' }); });
  pspr('mongo_act', MP, MW + 2, MH, 1, function (g) { mongo(g, 1, { pose: 'act' }); });
  pspr('mongo_jump', MP, MW, MH, 1, function (g) { mongo(g, 1, { pose: 'jump', oy: 0 }); });
  def('mongo_hurt', withK(hurtPal(MP)), paint(MW, MH, 1, function (g) { mongo(g, 1, { pose: 'hurt' }); }));
  // pony-sized Mongo (after he levels up), Fang Caps glinting
  var BK = 1.7, BW = 40, BH = 28;
  pspr('mongo_big_idle', MP, BW, BH, 2, function (g, i) { mongo(g, BK, { pose: 'stand', oy: i, fangs: true }); });
  pspr('mongo_big_run', MP, BW, BH, 4, function (g, i) { mongo(g, BK, { pose: ['run0', 'run1', 'run2', 'run3'][i], oy: i % 2 ? -1 : 0, fangs: true }); });
  pspr('mongo_big_act', MP, BW + 3, BH, 1, function (g) { mongo(g, BK, { pose: 'act', fangs: true }); });
  pspr('mongo_big_jump', MP, BW, BH, 1, function (g) { mongo(g, BK, { pose: 'jump', fangs: true }); });
  def('mongo_big_hurt', withK(hurtPal(MP)), paint(BW, BH, 1, function (g) { mongo(g, BK, { pose: 'hurt', fangs: true }); }));
  // brass clockwork Mongo (Clockwork Triplicate: decoys and the Boomy Boy)
  pspr('mongo_clock_run', MCLOCK, MW, MH + 2, 2, function (g, i) { mongo(g, 1, { pose: i ? 'run1' : 'run0', clock: true, oy: 2 }); });
  pspr('mongo_clock_idle', MCLOCK, MW, MH + 2, 2, function (g, i) { mongo(g, 1, { pose: 'stand', clock: true, oy: 2 + i }); });

  /* ---- Katia Grim: her first human disguise is "off": blond, eyes set too high, crooked nose.
   *      Plain tunic, belt, boots and a big round shield (she blocks projectiles) ---- */
  var KP = { h: C.y3, H: C.y2, s: C.n3, S: C.n2, w: C.W, e: C.b2, m: C.o0, n: C.n2, t: C.c1, T: C.c0, d: C.y0, D: C.y1, b: C.n0, B: C.y0, r: C.g1, R: C.g0, i: C.n1, I: C.y1 };
  function katia(g, o) {
    var pose = o.pose || 'idle', i = o.i || 0, by = o.by || 0;
    // legs + boots
    var lp = pose === 'run' ? (i ? [[5, 3], [8, -1]] : [[4, -1], [9, 3]]) : [[5, 0], [8, 0]];
    lp.forEach(function (q) { rect(g, q[0], 18 + by, 2, 3, 'T'); rect(g, q[0] + (q[1] > 0 ? 1 : 0), 21 + by, 2, 2, 'b'); px(g, q[0] + (q[1] > 0 ? 2 : 1), 22 + by, 'B'); });
    // torso tunic
    rect(g, 4, 10 + by, 7, 8, 't'); rect(g, 4, 10 + by, 1, 8, 'T'); rect(g, 4, 15 + by, 7, 1, 'd'); px(g, 7, 15 + by, 'D');
    rect(g, 3, 17 + by, 9, 1, 't');
    // head: chunky blond bob, eyes way up high, nose off to one side
    rect(g, 5, 8 + by, 3, 2, 's');
    oval(g, 7, 4 + by, 4, 4, 's');
    rect(g, 3, 0 + by, 8, 3, 'h'); rect(g, 2, 1 + by, 2, 7, 'h'); rect(g, 11, 1 + by, 1, 2, 'h'); px(g, 3, 8 + by, 'H'); px(g, 2, 7 + by, 'H');
    rect(g, 4, 3 + by, 2, 2, 'h');
    if (o.blink) rect(g, 8, 2 + by, 2, 1, 'S'); else { rect(g, 8, 2 + by, 2, 2, 'w'); px(g, 9, 3 + by, 'e'); }
    px(g, 10, 5 + by, 'n'); px(g, 11, 6 + by, 'n'); px(g, 10, 6 + by, 'S');   // the crooked nose
    rect(g, 8, 7 + by, 2, 1, 'm');
    // arms + shield
    if (pose === 'act') {
      rect(g, 10, 11 + by, 3, 2, 's');
      oval(g, 14, 12 + by, 3, 5, 'r'); oval(g, 14, 12 + by, 2, 4, 'i'); rect(g, 14, 8 + by, 1, 9, 'I'); px(g, 14, 12 + by, 'R');
    } else {
      rect(g, 10, 11 + by, 2, 5, 't'); rect(g, 10, 16 + by, 2, 1, 's');
      oval(g, 3, 13 + by, 3, 4, 'r'); oval(g, 3, 13 + by, 2, 3, 'i'); px(g, 3, 13 + by, 'R'); rect(g, 3, 10 + by, 1, 7, 'I');
    }
  }
  pspr('katia_idle', KP, 18, 25, 2, function (g, i) { katia(g, { pose: 'idle', blink: i === 1, by: 1 }); });
  pspr('katia_run', KP, 18, 25, 2, function (g, i) { katia(g, { pose: 'run', i: i, by: i ? 0 : 1 }); });
  pspr('katia_act', KP, 18, 25, 1, function (g) { katia(g, { pose: 'act', by: 1 }); });
  K.donutPaint = donut; K.mongoPaint = mongo; K.DP = DP; K.MP = MP;
})();


/* ================================================================== *
 *  NPCs (idle 2 frames each: frame 1 blinks / breathes / sways)
 * ================================================================== */
(function () {
  'use strict';
  var DCW = window.DCW, K = DCW.artActorsKit, C = K.C;
  var rect = K.rect, px = K.px, oval = K.oval, line = K.line, tri = K.tri, poly = K.poly, dots = K.dots, stamp = K.stamp;
  var pspr = K.pspr, spr = K.spr, alt = K.alt, legs = K.legs, alias = K.alias, def = K.def, paint = K.paint, withK = K.withK;

  // ---- shared little painters ----
  function eye(g, x, y, blink, w, ch) { // 2x2 eye looking right (white + pupil), or a lid line
    if (blink) { rect(g, x, y + 1, w || 2, 1, ch || 'e'); return; }
    rect(g, x, y, w || 2, 2, 'w'); px(g, x + (w || 2) - 1, y, ch || 'e'); px(g, x + (w || 2) - 1, y + 1, ch || 'e');
  }
  function legs2(g, x, top, bot, gap, c, shoe, lw) { // two straight legs + shoes
    lw = lw || 2;
    rect(g, x, top, lw, bot - top, c); rect(g, x + lw + gap, top, lw, bot - top, c);
    if (shoe) { rect(g, x, bot, lw + 1, 1, shoe); rect(g, x + lw + gap, bot, lw + 1, 1, shoe); }
  }

  /* ---- skyfowl: eagle head + hooked beak, no arms: wings with finger bones at the middle joint, big talons ----
   * unit coords for a 20x28 figure scaled by k. chars: f feathers, F shade, h head, H head shade, b beak, B beak shade,
   * e eye, w white, c clothes, C clothes shade, t legs, T claws, z finger bones */
  function fowl(g, k, o) {
    o = o || {};
    var ox = o.ox || 0, oy = o.oy || 0, pose = o.pose || 'idle';
    function X(v) { return Math.round(v * k) + ox; } function Y(v) { return Math.round(v * k) + oy; } function S(v) { return Math.max(1, Math.round(v * k)); }
    var bob = pose === 'walk1' ? 1 : 0, lean = pose === 'attack' ? 2 : 0;
    // legs + talons
    var lg = pose === 'walk0' ? [[7, 5], [11, 14]] : pose === 'walk1' ? [[8, 8], [10, 11]] : pose === 'attack' ? [[7, 6], [11, 13]] : [[8, 7], [11, 12]];
    lg.forEach(function (l) {
      line(g, X(l[0] + 1), Y(21), X(l[1] - (l[1] > l[0] ? 2 : 0) + 1), Y(25.5), 't', S(1.2));
      rect(g, X(l[1] - 1), Y(26), S(3.4), S(1.2), 't'); px(g, X(l[1] + 2.4), Y(26.5), 'T'); px(g, X(l[1] - 1.4), Y(26.5), 'T');
    });
    // body: tunic / robe
    oval(g, X(10 + lean * 0.3), Y(16 + bob), 4.6 * k, 6 * k, o.noClothes ? 'f' : 'c');
    if (!o.noClothes) { rect(g, X(6), Y(19.5 + bob), S(8.5), S(1.2), 'C'); if (o.apron) rect(g, X(10), Y(13 + bob), S(4.5), S(8), o.apron); }
    // folded wing at the side (the "arm"), feather tips at the bottom, finger bones poking forward from the joint
    var wy = pose === 'attack' ? -3 : 0;
    if (!o.wisps) {
      oval(g, X(8 + lean * 0.3), Y(15 + bob + wy * 0.5), 2.8 * k, 5.6 * k, 'f');
      line(g, X(7), Y(18 + bob + wy * 0.5), X(9), Y(21 + bob), 'F', S(1));
      for (var t = 0; t < 3; t++) px(g, X(6 + t * 1.4), Y(21 + bob) + (t % 2), 'F');
      var jx = X(10.6 + lean * 0.3), jy = Y(13 + bob + wy);
      line(g, jx, jy, jx + S(2.4), jy - S(0.6), 'z'); line(g, jx, jy + 1, jx + S(2.6), jy + 1, 'z'); if (k > 0.8) line(g, jx, jy + 2, jx + S(2.2), jy + 2 + S(0.6), 'z');
    }
    // neck + head
    oval(g, X(11 + lean * 0.5), Y(7 + bob), 4.2 * k, 4.2 * k, 'h');
    rect(g, X(8.5), Y(9 + bob), S(5), S(3), 'h');
    px(g, X(7.4), Y(6 + bob), 'H'); px(g, X(7), Y(8 + bob), 'H'); px(g, X(8), Y(4 + bob), 'H');   // ruffled crown feathers
    if (o.crest) { line(g, X(8), Y(3.5 + bob), X(6), Y(2 + bob), 'H', S(1)); }
    // hooked beak
    var bx = X(14.4 + lean * 0.5), by = Y(5.5 + bob);
    rect(g, bx, by, S(3.2), S(2.4), 'b'); px(g, bx + S(3.2), by + S(1), 'b'); px(g, bx + S(3.2), by + S(2.2), 'B'); px(g, bx + S(2.6), by + S(2.4), 'B');
    if (pose === 'attack' || o.open) rect(g, bx + 1, by + S(2.4), S(2), 1, 'B');
    if (o.crack) { px(g, bx + 1, by, 'B'); px(g, bx + 2, by + 1, 'B'); }
    // eye
    var ex = X(12.6 + lean * 0.5), ey = Y(5 + bob);
    if (o.eyeFn) o.eyeFn(g, ex, ey); else if (o.blink) rect(g, ex, ey + 1, S(1.6), 1, 'e'); else { rect(g, ex, ey, S(1.6), S(1.6), 'w'); px(g, ex + S(1.6) - 1, ey + S(0.8), 'e'); }
    if (o.glasses) { rect(g, ex - 1, ey - 1, S(1.6) + 2, 1, 'G'); px(g, ex - 1, ey, 'G'); px(g, ex + S(1.6), ey, 'G'); rect(g, ex - 1, ey + S(1.6), S(1.6) + 2, 1, 'G'); }
  }
  K.fowl = fowl;

  /* ---- Mordecai: Level 50 Incubus. Dusky gray skin, long gray-black ponytail, short horns, barbed tail,
   *      black bat wings, tuxedo shirt (jacket and tie off), a drink in hand ---- */
  pspr('mordecai', { s: C.g1, S: C.g0, h: C.p0, H: C.b1, r: C.r0, R: C.r1, v: C.p0, V: C.m0, z: C.g0, w: C.W, W: C.g1, e: C.K, m: C.g0, p: C.b1, P: C.p0, o: C.K, y: C.y2, Y: C.y1, g: C.b6 }, 30, 34, 2, function (g, i) {
    var f = i;
    // wings (behind): two ribbed bat wings spread up from the shoulders
    tri(g, 9, 13, 0, 3 + f, 3, 16, 'v'); tri(g, 9, 13, 3, 16, 7, 20 - f, 'v');
    line(g, 9, 13, 1, 4 + f, 'V'); line(g, 9, 14, 4, 15, 'V'); line(g, 8, 15, 6, 19 - f, 'V');
    tri(g, 18, 13, 26, 2 + f, 25, 14, 'v'); line(g, 18, 13, 26, 3 + f, 'V'); line(g, 19, 14, 24, 13, 'V');
    // tail (behind), barbed tip
    poly(g, [[11, 24], [6, 27], [4, 30], [6, 32 - f]], 'v', 1); tri(g, 5, 31 - f, 8, 32 - f, 6, 33 - f, 'r');
    // legs: black trousers, shoes
    rect(g, 11, 24, 3, 9, 'p'); rect(g, 15, 24, 3, 9, 'p'); rect(g, 14, 24, 1, 3, 'p'); rect(g, 11, 33, 4, 1, 'P'); rect(g, 15, 33, 4, 1, 'P');
    // torso: white tuxedo shirt, collar open, black studs, sleeves rolled
    rect(g, 10, 14, 9, 10, 'w'); rect(g, 10, 14, 1, 10, 'W'); px(g, 14, 17, 'o'); px(g, 14, 19, 'o'); px(g, 14, 21, 'o');
    rect(g, 13, 14, 3, 2, 's'); px(g, 14, 16, 's'); rect(g, 10, 23, 9, 1, 'P');
    // arms: far arm on hip, near arm holding a glass
    rect(g, 8, 15, 2, 5, 'w'); rect(g, 8, 20, 2, 2, 's');
    rect(g, 19, 15, 2, 4, 'w'); rect(g, 19, 19, 2, 2, 's'); rect(g, 21, 18 - f, 2, 2, 's');
    rect(g, 22, 14 - f, 3, 4, 'g'); rect(g, 22, 16 - f, 3, 2, 'y'); px(g, 23, 18 - f, 'Y');
    // head
    rect(g, 13, 11, 3, 3, 's');
    oval(g, 15, 7, 4.5, 4.5, 's');
    rect(g, 10, 2, 9, 3, 'h'); rect(g, 10, 2, 3, 8, 'h'); px(g, 18, 5, 'h'); px(g, 13, 5, 'h');
    poly(g, [[10, 5], [8, 8], [7, 13], [7, 18 + f]], 'h', 2); px(g, 9, 6, 'H'); px(g, 7, 15, 'H');   // long ponytail
    tri(g, 15, 2, 17, 2, 16, -1, 'r'); tri(g, 18, 3, 20, 3, 20, 0, 'r');                            // short horns
    if (f) rect(g, 17, 7, 2, 1, 'm'); else { rect(g, 17, 6, 2, 2, 'w'); px(g, 18, 6, 'e'); px(g, 18, 7, 'e'); }
    line(g, 16, 5, 19, 5, 'h');                                                                       // smouldering brow
    px(g, 20, 8, 's'); px(g, 20, 9, 'S'); rect(g, 17, 10, 3, 1, 'm'); px(g, 12, 8, 'S');
  });

  /* ---- Gordo: Bopca safe-room keeper of the Belly-Rubbed Pug: stout, shaggy, green-tinted ---- */
  pspr('gordo', { f: C.G2, F: C.G1, d: C.G0, w: C.W, e: C.K, n: C.o2, a: C.n3, A: C.n2, m: C.n0, y: C.y1, s: C.l3 }, 22, 22, 2, function (g, i) {
    oval(g, 11, 12, 8, 8, 'f');
    for (var k = 0; k < 8; k++) { px(g, 4 + k * 2, 3 + (k % 2), 'f'); px(g, 3, 6 + k * 2, 'F'); px(g, 19, 6 + k * 2, 'F'); }
    for (k = 0; k < 6; k++) { px(g, 5 + k * 2, 18 + (k % 2), 'd'); px(g, 7 + k * 2, 9 + (k % 3), 'F'); }
    eye(g, 10, 8, i === 1, 2); eye(g, 15, 8, i === 1, 2);
    rect(g, 13, 12, 2, 2, 'n'); rect(g, 11, 15, 6, 1, 'm'); px(g, 12, 15, 'w'); px(g, 15, 15, 'w');
    rect(g, 6, 15, 10, 5, 'a'); rect(g, 6, 15, 10, 1, 'A'); px(g, 10, 17, 'A');                       // apron
    rect(g, 16, 14, 3, 3, 'f'); rect(g, 18, 12 - i, 3, 3, 's'); px(g, 19, 11 - i, 'y');               // ladle wave
    rect(g, 6, 20, 4, 2, 'd'); rect(g, 13, 20, 4, 2, 'd');
  });

  /* ---- Fitz: human innkeeper of the One-Eyed Narwhal: burly, bald, big moustache, apron, rag ---- */
  pspr('fitz', { s: C.n3, S: C.n2, h: C.n0, w: C.W, e: C.K, m: C.n0, c: C.b3, C: C.b1, a: C.W, A: C.g1, p: C.y0, P: C.K, r: C.g1, y: C.y2 }, 20, 30, 2, function (g, i) {
    legs2(g, 6, 22, 29, 2, 'p', 'P', 3);
    rect(g, 4, 13, 12, 10, 'c'); rect(g, 4, 13, 1, 10, 'C'); rect(g, 6, 15, 8, 9, 'a'); rect(g, 6, 15, 8, 1, 'A');
    rect(g, 2, 14, 2, 6, 'c'); rect(g, 2, 20, 2, 2, 's'); rect(g, 16, 14, 2, 5, 'c'); rect(g, 16, 19, 2, 2, 's');
    rect(g, 15, 21 - i, 3, 3, 'r');                                                                    // bar rag
    rect(g, 8, 10, 4, 3, 's');
    oval(g, 10, 6, 5, 5, 's'); rect(g, 5, 4, 2, 4, 'h'); px(g, 6, 3, 'h');                            // bald, fringe at the back
    px(g, 11, 1, 'w');                                                                                 // shine
    eye(g, 12, 5, i === 1);
    rect(g, 11, 9, 5, 2, 'h'); px(g, 15, 11, 'h'); px(g, 10, 11, 'h');                                // moustache
    px(g, 15, 7, 'S'); px(g, 15, 8, 'S'); px(g, 6, 7, 'S');
  });

  /* ---- skyfowl townsfolk / merchants ---- */
  var FOWL_BASE = { f: C.n1, F: C.n0, h: C.n2, H: C.n1, b: C.y2, B: C.y1, e: C.K, w: C.W, c: C.G1, C: C.G0, t: C.y2, T: C.W, z: C.W, G: C.y1, a: C.W, A: C.g1, y: C.y2 };
  // Edge Dancer runs Lucky's General Goods: golden eagle, green merchant tabard, pencil behind... feathers
  pspr('edge_dancer', FOWL_BASE, 22, 30, 2, function (g, i) { fowl(g, 1, { ox: 1, oy: 2, blink: i === 1, crest: true }); px(g, 7, 6, 'y'); px(g, 6, 5, 'y'); });
  // Talon Strong: white-headed, burly, leather apron
  pspr('talon', K.merge(FOWL_BASE, { h: C.W, H: C.g1, f: C.y0, F: C.n0, c: C.n0, C: C.y0, b: C.y2, a: C.y1 }), 24, 30, 2, function (g, i) { fowl(g, 1.1, { ox: 0, oy: 0, blink: i === 1, apron: 'a' }); });
  // Lucky: the shop's cheerful chickadee clerk, green visor, a four-leaf clover pin
  pspr('lucky', K.merge(FOWL_BASE, { h: C.g2, H: C.g1, f: C.K, F: C.g0, c: C.y3, C: C.y1, b: C.g0, B: C.K, t: C.n2, y: C.G1, v: C.G1, V: C.G0 }), 16, 20, 2, function (g, i) {
    fowl(g, 0.68, { ox: 1, oy: 1, blink: i === 1, open: i === 0 });
    rect(g, 6, 2, 6, 1, 'v'); rect(g, 10, 3, 4, 1, 'V'); px(g, 7, 12, 'y'); px(g, 8, 11, 'y'); px(g, 8, 13, 'y'); px(g, 9, 12, 'y');
  });
  // Miss Quill: elderly skyfowl Dark Cleric, gray-tinged feathers, cracked beak, spectacles, on her perch
  pspr('quill', K.merge(FOWL_BASE, { f: C.g0, F: C.g3, h: C.g1, H: C.g0, c: C.p0, C: C.m0, b: C.y3, B: C.y1, t: C.y1, G: C.y2, p: C.n0, P: C.y0, r: C.r0 }), 26, 34, 2, function (g, i) {
    rect(g, 4, 30, 18, 2, 'p'); rect(g, 12, 32, 3, 2, 'P'); rect(g, 4, 29, 2, 1, 'P'); rect(g, 20, 29, 2, 1, 'P');   // the perch
    fowl(g, 1.05, { ox: 2, oy: 1, blink: i === 1, glasses: true, crack: true });
    rect(g, 11, 14, 4, 1, 'r'); px(g, 13, 15, 'r');                                                                  // cleric brooch
  });
  // Remex: zombified featherless skyfowl, black swirling eyes, smoke rising, ghostly worm-wisps for wings
  pspr('remex', K.merge(FOWL_BASE, { f: C.g0, F: C.g3, h: C.g1, H: C.g0, c: C.g0, C: C.g3, b: C.g1, B: C.g0, t: C.g1, T: C.g0, z: C.g1, q: C.p2, Q: C.p3, x: C.p0 }), 26, 32, 2, function (g, i) {
    // wisps (behind)
    for (var n = 0; n < 4; n++) { var y0 = 10 + n * 3; poly(g, [[8, y0 + 2], [5 - (i + n) % 2, y0], [2, y0 + 1 + (i + n) % 2], [0, y0 - 1]], n % 2 ? 'q' : 'Q', 1); }
    for (n = 0; n < 3; n++) poly(g, [[15, 12 + n * 3], [19, 10 + n * 3 + (i + n) % 2], [23, 11 + n * 3], [25, 9 + n * 3 + (i % 2)]], n % 2 ? 'Q' : 'q', 1);
    fowl(g, 1, { ox: 3, oy: 3, noClothes: true, wisps: true, eyeFn: function (g2, ex, ey) { rect(g2, ex - 1, ey, 3, 3, 'x'); px(g2, ex, ey + 1, 'Q'); px(g2, ex + i, ey + 2 - i, 'q'); } });
    // smoke curling up from the head
    px(g, 13 + i, 2, 'x'); px(g, 12 + i, 1, 'x'); px(g, 14 - i, 0, 'x'); px(g, 16, 3 - i, 'x');
    dots(g, 0, 0, 26, 32, 'f', 'F', function (x, y) { return (x + y * 2) % 7 === 0; });
  });
  // Magistrate Featherfall: mummified, strapped upside down to a round frame, featherless gray wings, milky eyes
  pspr('featherfall', { r: C.y1, R: C.y0, s: C.g1, S: C.g0, b: C.y3, B: C.y1, w: C.W, W: C.b6, o: C.n2, O: C.n0, c: C.p0, C: C.m0, d: C.b6 }, 34, 34, 2, function (g, i) {
    // round frame (wheel): rim + spokes
    oval(g, 16, 16, 15, 15, 'r'); oval(g, 16, 16, 13, 13, '.');
    for (var a = 0; a < 8; a++) { var an = a * Math.PI / 4; line(g, 16, 16, 16 + Math.round(Math.cos(an) * 13), 16 + Math.round(Math.sin(an) * 13), 'R'); }
    oval(g, 16, 16, 2, 2, 'R');
    // body upside down: talons at the top, head at the bottom
    rect(g, 13, 7, 7, 13, 'c'); rect(g, 13, 7, 1, 13, 'C');                                    // his old robe, hanging "up"
    line(g, 14, 7, 12, 2, 's', 2); line(g, 18, 7, 20, 2, 's', 2); rect(g, 10, 1, 4, 2, 'b'); rect(g, 19, 1, 4, 2, 'b');
    // featherless wings spread on the frame, gray goosebumped skin
    tri(g, 13, 10, 3, 6, 5, 17, 's'); tri(g, 19, 10, 29, 6, 27, 17, 's');
    dots(g, 0, 0, 34, 34, 's', 'S', function (x, y) { return (x * 3 + y) % 5 === 0; });
    // head at the bottom, cracked beak pointing down, milky eyes leaking
    oval(g, 16, 23, 4, 4, 's');
    rect(g, 15, 27, 3, 4, 'b'); px(g, 16, 31, 'B'); px(g, 16, 28, 'B'); px(g, 15, 29, 'B');
    rect(g, 13, 22, 2, 2, 'W'); rect(g, 18, 22, 2, 2, 'W'); px(g, 13, 24 + i, 'd'); px(g, 19, 25 - i, 'd');
    // ropes
    line(g, 12, 9, 20, 9, 'o'); line(g, 12, 15, 20, 15, 'o'); line(g, 12, 20, 20, 20, 'o'); px(g, 12, 9, 'O'); px(g, 20, 15, 'O');
  });

  /* ---- System AI: floating retro TV with a grinning pixel face (kept from book 1) ---- */
  (function () {
    var ap = { c: C.y1, C: C.y0, s: C.c0, g: C.l2, G: C.G2, a: C.g1, r: C.o1, d: C.g3, w: C.W };
    var a0 = [
      '....a........a....', '.....a......a.....', '......a....a......', '.......arra.......',
      'cccccccccccccccccc', 'cssssssssssssssccc', 'csssggsssssggsscrc', 'csssggsssssggsscCc',
      'cssssssssssssssccc', 'csgsssssssssssgcdc', 'cssggggggggggsscdc', 'csssgwgwgwgwsssccc',
      'cssssggggggssssccc', 'cssssssssssssssccc', 'cccccccccccccccccc', '.CC............CC.'
    ];
    var a1 = alt(a0, 6, ['csssggsssssssssccc', 'csssggssssGGGsscCc', 'cssssssssssssssccc', 'csgsssssssssssgcdc', 'cssggggggggggsscdc', 'csssggggggggsssccc', 'cssssgwgwgwssssccc']);
    a1 = alt(a1, 0, ['...a..........a...', '....a........a....']);
    spr('ai_screen', ap, [a0, a1]);
  })();
  K.eye = eye; K.legs2 = legs2;
})();


(function () {
  'use strict';
  var DCW = window.DCW, K = DCW.artActorsKit, C = K.C;
  var rect = K.rect, px = K.px, oval = K.oval, line = K.line, tri = K.tri, poly = K.poly, dots = K.dots, stamp = K.stamp;
  var pspr = K.pspr, spr = K.spr, alt = K.alt, legs = K.legs, alias = K.alias, eye = K.eye, legs2 = K.legs2;

  // Pustule: six-foot muscular hobgoblin, oozing sore, threadbare pink tee with a unicorn in sunglasses
  pspr('pustule', { s: C.l1, S: C.l0, h: C.y0, w: C.W, e: C.y2, m: C.l0, o: C.G0, O: C.l2, t: C.m3, T: C.m2, u: C.W, p: C.y0, P: C.n0, c: C.r1 }, 22, 32, 2, function (g, i) {
    legs2(g, 6, 23, 31, 3, 'p', 'P', 3);
    rect(g, 3, 12, 14, 11, 't'); rect(g, 3, 12, 1, 11, 'T'); dots(g, 3, 12, 14, 11, 't', 'T', function (x, y) { return (x * 7 + y * 3) % 11 === 0; });
    rect(g, 8, 15, 4, 3, 'u'); rect(g, 9, 15, 3, 1, 'h'); px(g, 12, 14, 'O'); px(g, 7, 18, 'c'); px(g, 12, 17, 'u');   // unicorn + shades
    rect(g, 1, 13, 3, 7, 's'); rect(g, 1, 20, 3, 2, 's'); rect(g, 16, 13, 3, 7, 's'); rect(g, 16, 20, 3, 2, 's');
    rect(g, 1, 15, 2, 2, 'S'); rect(g, 17, 15, 2, 2, 'S');                                                         // biceps
    rect(g, 8, 9, 5, 3, 's');
    oval(g, 11, 5, 5.5, 5, 's');
    tri(g, 6, 3, 2, 0, 6, 6, 's'); px(g, 3, 1, 'S');                                                               // big pointed ear
    rect(g, 7, 0, 6, 2, 'h'); px(g, 6, 1, 'h');
    eye(g, 13, 4, i === 1);
    rect(g, 15, 7, 2, 2, 'S'); rect(g, 12, 9, 4, 1, 'm'); px(g, 13, 10, 'w');
    oval(g, 9, 7, 1.5, 1.5, 'o'); px(g, 9, 7, 'O'); px(g, 9, 9 + i, 'o'); px(g, 10, 10 + i, 'o');                  // the oozing sore
  });

  // Clarabelle: Level 40 crocodilian bouncer of the Desperado Club: black tee, gold chain, arms folded
  pspr('clarabelle', { s: C.G1, S: C.G0, b: C.l3, w: C.W, e: C.y2, t: C.K, T: C.g0, y: C.y2, p: C.b1, P: C.K, r: C.r1 }, 30, 36, 2, function (g, i) {
    poly(g, [[8, 27], [4, 30], [1, 34]], 's', 3);                                                                   // tail
    legs2(g, 9, 26, 35, 3, 'p', 'P', 4);
    rect(g, 6, 13, 16, 14, 'T'); rect(g, 6, 13, 16, 13, 'T'); rect(g, 7, 14, 14, 12, 'T');
    rect(g, 6, 13, 3, 13, 'T'); rect(g, 8, 13, 13, 1, 'T');
    rect(g, 9, 18, 12, 4, 's'); rect(g, 9, 18, 12, 1, 'S'); rect(g, 8, 19, 2, 3, 's'); rect(g, 20, 19, 2, 3, 's');  // folded arms
    line(g, 10, 14, 15, 17, 'y'); line(g, 19, 14, 15, 17, 'y'); px(g, 15, 17, 'r');                               // gold chain
    rect(g, 12, 10, 6, 4, 's');
    // long crocodile head with snout pointing right
    rect(g, 10, 3, 9, 8, 's'); rect(g, 18, 5, 10, 5, 's'); rect(g, 18, 9, 10, 1, 'b'); rect(g, 10, 9, 8, 2, 'b');
    for (var x = 19; x < 28; x += 2) px(g, x, 8, 'w');                                                             // teeth
    px(g, 27, 5, 'S'); px(g, 26, 5, 'S');
    rect(g, 14, 2, 4, 2, 's'); if (i) rect(g, 15, 3, 2, 1, 'S'); else { rect(g, 15, 2, 2, 2, 'e'); px(g, 16, 3, 'P'); }
    dots(g, 10, 3, 18, 8, 's', 'S', function (x, y) { return (x + y) % 4 === 0 && y < 6; });
  });

  // Quint: half Djinn, half Garbage Scowl: an opossum on top, a little tornado below
  pspr('quint', { f: C.g1, F: C.g0, w: C.W, n: C.m2, e: C.K, a: C.K, t: C.g1, T: C.g3, d: C.y1, D: C.n0, j: C.b6, v: C.p1 }, 24, 32, 2, function (g, i) {
    // tornado: stacked swirling bands, narrowing to a point; litter caught in it
    var wid = [10, 9, 8, 7, 6, 5, 4, 3, 2, 2, 1];
    for (var k = 0; k < wid.length; k++) { var y = 18 + k, w = wid[k], sh = ((k + i) % 3) - 1; rect(g, 12 - (w >> 1) + sh, y, w, 1, k % 2 ? 'T' : 't'); px(g, 12 - (w >> 1) + sh + ((k * 3 + i) % w), y, 'j'); }
    px(g, 6 + i * 2, 20, 'd'); px(g, 17 - i, 22, 'D'); px(g, 9, 25 - i, 'd');
    // opossum torso + arms
    oval(g, 12, 14, 5, 5, 'f'); rect(g, 8, 13, 9, 6, 'F'); rect(g, 9, 12, 7, 6, 'f');
    rect(g, 5, 12, 3, 5, 'f'); rect(g, 4, 16, 2, 2, 'n'); rect(g, 17, 12, 3, 4, 'f'); rect(g, 19, 11, 2, 2, 'n');
    // opossum head: white pointy face, black ears, pink nose, beady eyes
    oval(g, 12, 6, 5, 4, 'f'); oval(g, 15, 7, 4, 2.5, 'w'); rect(g, 18, 7, 3, 2, 'w'); px(g, 21, 8, 'n'); px(g, 20, 7, 'n');
    oval(g, 8, 2, 2, 2, 'a'); oval(g, 13, 1.5, 1.6, 1.6, 'a');
    if (i) rect(g, 14, 5, 2, 1, 'e'); else rect(g, 14, 5, 2, 2, 'e');
    px(g, 18, 10, 'w'); px(g, 19, 10, 'w');
    px(g, 4, 6 + i, 'v'); px(g, 21, 3 - i, 'v');                                                                   // djinn sparkle
  });

  // GumGum: older muscular orc woman in a blood-covered medieval shirt
  pspr('gumgum', { s: C.G1, S: C.G0, h: C.g1, H: C.g0, w: C.W, e: C.K, m: C.G0, t: C.n3, T: C.n2, r: C.o0, R: C.r0, p: C.y0, P: C.K, b: C.n0 }, 20, 28, 2, function (g, i) {
    legs2(g, 5, 21, 27, 3, 'p', 'P', 3);
    rect(g, 3, 11, 13, 11, 't'); rect(g, 3, 11, 1, 11, 'T'); rect(g, 3, 18, 13, 1, 'b');
    px(g, 7, 13, 'r'); rect(g, 8, 14, 2, 2, 'r'); px(g, 12, 16, 'R'); rect(g, 5, 19, 2, 2, 'r'); px(g, 13, 12, 'r'); px(g, 10, 20, 'R');
    rect(g, 1, 12, 2, 7, 's'); rect(g, 1, 19, 2, 2, 's'); rect(g, 16, 12, 2, 6, 's'); rect(g, 16, 18, 2, 2, 's');
    rect(g, 7, 9, 5, 2, 's');
    oval(g, 10, 5, 5, 4.5, 's');
    oval(g, 7, 1.5, 4, 2, 'h'); rect(g, 4, 2, 3, 4, 'h'); oval(g, 4, 1, 1.5, 1.5, 'H');                            // gray bun
    eye(g, 11, 4, i === 1);
    rect(g, 10, 8, 5, 1, 'm'); px(g, 11, 7, 'w'); px(g, 14, 7, 'w');                                               // tusks
    px(g, 15, 5, 'S'); px(g, 7, 6, 'S');
  });

  // Tsarina Signet: very thin half Naiad / half High Elf. Pointed ears, small horns, fangs, faintly glowing
  // skin covered head to toe in moving old-school tattoos (sea monsters, oni, dragons, sharks). Wears only a thong.
  var SIGP = { s: C.b6, S: C.b4, h: C.c0, H: C.c1, w: C.W, e: C.c3, m: C.r0, f: C.W, o: C.r0, n: C.b1, d: C.G0, q: C.o1, x: C.p0, y: C.y2 };
  function signetTattoos(g, x0, y0, w, h, i) { // ink over skin pixels only, pattern drifts between frames
    for (var y = y0; y < y0 + h; y++) for (var x = x0; x < x0 + w; x++) {
      if (g[y] === undefined || (g[y][x] !== 's' && g[y][x] !== 'S')) continue;
      var v = (x * 5 + (y + i * 2) * 3) % 13, u = (x * 2 + y * 7 + i * 3) % 17;
      if (v === 0 || v === 6) g[y][x] = 'n';        // indigo line work
      else if (u === 3) g[y][x] = 'o';              // red oni / dragon accents
      else if (u === 9) g[y][x] = 'd';              // green sea-monster scales
      else if (v === 10 && (x + y) % 2) g[y][x] = 'x';
    }
  }
  function signet(g, i, pose) {
    var walk = pose === 'run', act = pose === 'act';
    // legs: thin
    if (walk) { line(g, 8, 18, 6, 26, 's', 2); line(g, 10, 18, 12, 26, 's', 2); }
    else { rect(g, 7, 18, 2, 9, 's'); rect(g, 10, 18, 2, 9, 's'); }
    // thong
    rect(g, 7, 17, 5, 1, 'o'); px(g, 9, 18, 'o');
    // torso: very thin; chest drawn plainly
    rect(g, 7, 10, 5, 7, 's'); rect(g, 8, 16, 3, 1, 's'); px(g, 10, 12, 'S'); px(g, 11, 12, 'S');
    // arms
    if (act) { line(g, 11, 11, 15, 7, 's', 1); line(g, 12, 11, 16, 8, 's', 1); px(g, 16, 6, 'y'); px(g, 17, 7, 'y'); px(g, 15, 5, 'y'); line(g, 7, 11, 5, 16, 's'); }
    else { line(g, 7, 11, 5, 17, 's'); line(g, 11, 11, 13, 17 - (walk ? 1 : 0), 's'); }
    // head
    rect(g, 8, 8, 3, 2, 's');
    oval(g, 10, 5, 3.5, 3.5, 's');
    tri(g, 6, 5, 3, 2, 7, 7, 's');                                                                     // long pointed ear
    rect(g, 7, 1, 6, 2, 'h'); rect(g, 6, 2, 2, 8, 'h'); px(g, 5, 9, 'H'); px(g, 6, 10, 'h'); px(g, 5, 11, 'h');
    px(g, 10, 0, 'f'); px(g, 12, 0, 'f'); px(g, 10, 1, 'f'); px(g, 12, 1, 'f');                         // small horns
    if (i === 1 && !act) rect(g, 11, 4, 2, 1, 'x'); else { rect(g, 11, 4, 2, 1, 'e'); px(g, 12, 5, 'e'); }
    rect(g, 11, 7, 2, 1, 'm'); px(g, 12, 8, 'f');                                                       // fang
  }
  ['idle', 'run', 'act'].forEach(function (pose) {
    var n = pose === 'act' ? 1 : 2, frames = [];
    for (var i = 0; i < n; i++) { var g = K.blank(19, 28); signet(g, pose === 'run' ? 0 : i, pose); signetTattoos(g, 0, 3, 19, 25, i); frames.push(K.outlined(g)); }
    K.def(pose === 'idle' ? 'signet' : 'signet_' + pose, K.withK(SIGP), frames);
  });
  alias('signet_idle', 'signet');

  // Grimaldi as the Pestiferous Vine: a pale green bush with the old dwarf's face in it
  pspr('grimaldi_face', { v: C.l3, V: C.l2, d: C.G1, D: C.G0, s: C.o3, S: C.n2, w: C.W, e: C.K, h: C.g1, m: C.r0, r: C.r1 }, 40, 36, 2, function (g, i) {
    oval(g, 20, 18, 18, 16, 'v');
    for (var k = 0; k < 14; k++) { var a = k * 0.45; px(g, 20 + Math.round(Math.cos(a) * 17), 18 + Math.round(Math.sin(a) * 15), 'V'); }
    for (k = 0; k < 9; k++) { poly(g, [[4 + k * 4, 34], [5 + k * 4 + (k + i) % 3 - 1, 28], [3 + k * 4, 24]], k % 2 ? 'd' : 'D', 1); }
    dots(g, 0, 0, 40, 36, 'v', 'V', function (x, y) { return (x * 3 + y * 5) % 9 === 0; });
    // the dwarf's face
    oval(g, 20, 15, 7, 7, 's'); rect(g, 13, 18, 14, 9, 'h'); oval(g, 20, 25, 6, 4, 'h');                     // big gray beard
    for (k = 0; k < 6; k++) px(g, 15 + k * 2, 22 + k % 2, 'g' === 'g' ? 'w' : 'h');
    eye(g, 16, 13, i === 1); eye(g, 22, 13, i === 1);
    rect(g, 19, 15, 2, 3, 'S'); rect(g, 17, 20, 6, 2, 'm'); px(g, 18, 20, 'r');
    poly(g, [[13, 9], [16, 7], [19, 8], [22, 6], [27, 9]], 'd', 1);                                         // vine across the brow
  });

  // Apollon the Mighty: circus strongman turned ogre: jagged head scar, a vine sprouting from his neck,
  // leopard-skin leotard, an ice-cream cone of writhing white worms
  pspr('apollon', { s: C.n2, S: C.n1, h: C.y0, w: C.W, e: C.K, m: C.n0, l: C.y2, L: C.y0, c: C.r0, v: C.G1, V: C.G0, y: C.n3, Y: C.y1, z: C.W, Z: C.g1 }, 32, 40, 2, function (g, i) {
    legs2(g, 9, 30, 39, 4, 's', 'm', 4);
    oval(g, 15, 22, 9, 9, 'l'); dots(g, 5, 13, 21, 18, 'l', 'L', function (x, y) { return (x * 2 + y * 3) % 7 === 0; });   // leotard
    rect(g, 14, 12, 7, 6, 's'); line(g, 7, 15, 14, 13, 'l', 2);                                                        // bare shoulder + strap
    rect(g, 3, 15, 4, 11, 's'); rect(g, 3, 26, 4, 3, 's'); rect(g, 23, 14, 4, 8, 's'); rect(g, 25, 21, 4, 3, 's');
    // cone of worms
    tri(g, 27, 21 - i, 31, 21 - i, 29, 27 - i, 'y'); px(g, 29, 23 - i, 'Y'); oval(g, 29, 19 - i, 2.5, 2, 'z'); px(g, 28, 17 - i, 'z'); px(g, 31, 17 + i, 'z'); px(g, 30, 18, 'Z');
    // head: small for the body, heavy brow, the scar
    oval(g, 16, 7, 6, 6, 's'); rect(g, 13, 11, 6, 3, 's');
    rect(g, 11, 1, 8, 2, 'h');
    poly(g, [[12, 3], [14, 5], [13, 7], [15, 9]], 'c', 1);                                                            // jagged scar
    eye(g, 18, 6, i === 1); rect(g, 16, 5, 5, 1, 'S');
    rect(g, 18, 10, 4, 1, 'm'); px(g, 21, 9, 'w'); px(g, 18, 9, 'w');
    poly(g, [[12, 12], [9, 10], [8, 6], [10, 3 + i]], 'v', 1); px(g, 9, 8, 'V'); px(g, 11, 4 + i, 'V'); px(g, 8, 5, 'v'); // vine from the neck
  });

  // Daniel Bautista: six-foot shirtless tiger man (Siberian stripes), shaggy tail, clawed bare feet, curved sword on his belt
  pspr('bautista', { f: C.n1, F: C.n0, w: C.W, s: C.K, e: C.l2, n: C.r3, p: C.p0, P: C.b1, b: C.y0, B: C.y1, x: C.g1, X: C.g0, c: C.W }, 26, 32, 2, function (g, i) {
    poly(g, [[7, 20], [3, 22], [2, 26], [4 - i, 29]], 'f', 2); px(g, 3, 24, 's'); px(g, 3, 28 - i, 'w');          // shaggy tail
    rect(g, 8, 21, 4, 8, 'p'); rect(g, 13, 21, 4, 8, 'p'); rect(g, 12, 21, 1, 4, 'p');                              // loose trousers
    rect(g, 7, 29, 5, 2, 'f'); rect(g, 13, 29, 5, 2, 'f'); px(g, 12, 30, 'c'); px(g, 18, 30, 'c'); px(g, 10, 30, 'c'); // clawed feet
    // torso: bare, striped, pale belly
    rect(g, 7, 11, 11, 10, 'f'); oval(g, 13, 16, 3, 4, 'w');
    for (var k = 0; k < 4; k++) { line(g, 7, 12 + k * 2, 9, 13 + k * 2, 's'); line(g, 17, 12 + k * 2, 15, 13 + k * 2, 's'); }
    rect(g, 7, 20, 11, 1, 'b'); px(g, 12, 20, 'B');                                                                 // belt
    line(g, 16, 21, 22, 27, 'x'); line(g, 17, 21, 23, 26, 'X'); rect(g, 15, 20, 2, 2, 'B');                        // curved sword in its scabbard
    rect(g, 5, 12, 2, 7, 'f'); rect(g, 5, 19, 2, 2, 'f'); rect(g, 18, 12, 2, 6, 'f'); rect(g, 18, 18, 2, 2, 'f');
    px(g, 5, 14, 's'); px(g, 19, 14, 's');
    // head: big cat head with a human nose and mouth, slit pupils
    oval(g, 13, 6, 5.5, 5, 'f'); oval(g, 16, 8, 3, 2.5, 'w');
    tri(g, 8, 0, 10, 3, 7, 4, 'f'); tri(g, 14, 0, 16, 2, 12, 2, 'f');
    line(g, 9, 4, 11, 6, 's'); line(g, 9, 7, 11, 8, 's'); px(g, 13, 2, 's'); px(g, 12, 3, 's');
    if (i) rect(g, 14, 5, 2, 1, 's'); else { rect(g, 14, 4, 2, 2, 'e'); px(g, 15, 4, 's'); px(g, 15, 5, 's'); }
    rect(g, 18, 7, 2, 1, 'n'); rect(g, 16, 10, 3, 1, 's');
    oval(g, 8, 8, 2, 3, 'w');                                                                                        // ruff
  });

  // Burgundy: young dark-haired clerk; one pale blue eye, one brown (husky eyes). Burgundy dress, white blouse.
  pspr('burgundy', { s: C.n3, S: C.n2, h: C.y0, H: C.n0, w: C.W, e: C.b4, E: C.y0, m: C.r0, d: C.r0, D: C.o0, c: C.W, p: C.K, b: C.y0 }, 18, 28, 2, function (g, i) {
    rect(g, 6, 22, 2, 5, 's'); rect(g, 9, 22, 2, 5, 's'); rect(g, 5, 27, 3, 1, 'p'); rect(g, 9, 27, 3, 1, 'p');
    tri(g, 4, 22, 13, 22, 8, 14, 'd'); rect(g, 5, 13, 7, 9, 'd'); rect(g, 5, 13, 1, 9, 'D');
    rect(g, 6, 11, 5, 3, 'c'); px(g, 8, 14, 'c');
    rect(g, 3, 12, 2, 7, 'c'); rect(g, 3, 19, 2, 1, 's'); rect(g, 12, 12, 2, 5, 'c'); rect(g, 12, 17, 3, 2, 'b');     // clipboard
    rect(g, 7, 9, 3, 2, 's');
    oval(g, 9, 5, 4, 4, 's');
    rect(g, 5, 1, 8, 3, 'h'); rect(g, 4, 2, 3, 11, 'h'); px(g, 4, 13, 'H'); rect(g, 10, 1, 3, 2, 'h');
    if (i) { rect(g, 9, 5, 4, 1, 'H'); } else { px(g, 9, 4, 'w'); px(g, 9, 5, 'E'); px(g, 11, 4, 'w'); px(g, 12, 5, 'e'); px(g, 12, 4, 'w'); px(g, 10, 5, 'w'); }
    px(g, 13, 7, 'S'); rect(g, 10, 8, 2, 1, 'm');
  });

  // Hekla: leader of Brynhild's Daughters. About seven feet of Amazonian muscle, blonde braids, sapphire eyes,
  // winged Valkyrie helmet, a glittering breastplate, round shield.
  pspr('hekla', { s: C.n3, S: C.n2, h: C.y3, H: C.y2, w: C.W, e: C.b2, m: C.o0, a: C.g1, A: C.g0, x: C.W, l: C.n0, L: C.y0, r: C.r0, R: C.y2 }, 28, 40, 2, function (g, i) {
    rect(g, 9, 28, 4, 10, 's'); rect(g, 15, 28, 4, 10, 's'); rect(g, 8, 36, 5, 3, 'l'); rect(g, 15, 36, 5, 3, 'l');   // boots
    rect(g, 7, 24, 14, 5, 'l'); for (var k = 0; k < 7; k++) px(g, 7 + k * 2, 28, 'L');                              // leather war skirt
    rect(g, 7, 13, 14, 11, 'a'); rect(g, 7, 13, 1, 11, 'A'); oval(g, 11, 17, 3, 2.5, 'a'); oval(g, 17, 17, 3, 2.5, 'a');
    px(g, 10, 15, 'x'); px(g, 18, 19, 'x'); px(g, 14, 21, 'x'); px(g, 12, 22, 'A'); px(g, 16, 15 + i, 'x');        // glitter
    rect(g, 4, 14, 3, 9, 's'); rect(g, 21, 14, 3, 8, 's'); rect(g, 4, 15, 2, 3, 'S'); rect(g, 22, 15, 2, 3, 'S');
    oval(g, 23, 23, 4, 5, 'r'); oval(g, 23, 23, 2, 3, 'R'); px(g, 23, 23, 'r');                                      // round shield
    rect(g, 11, 10, 6, 3, 's');
    oval(g, 14, 6, 5, 5, 's');
    rect(g, 8, 6, 3, 10, 'h'); rect(g, 8, 15, 2, 4, 'H'); px(g, 9, 19, 'h');                                         // braid
    rect(g, 9, 1, 11, 4, 'a'); rect(g, 9, 4, 11, 1, 'A'); px(g, 14, 0, 'a');                                         // helmet
    tri(g, 9, 2, 4, -1 + i, 6, 4, 'x'); tri(g, 19, 2, 24, -1 + i, 22, 4, 'x');                                       // wings on it
    eye(g, 15, 6, i === 1); rect(g, 16, 10, 3, 1, 'm'); px(g, 19, 8, 'S');
  });

  // Ripper Wonton: four-foot pudgy fuzzy brown Setonix, giant eyes, massive cheeks, nothing on but an orange ascot
  pspr('ripper', { f: C.n0, F: C.y0, c: C.n1, w: C.W, e: C.K, n: C.K, o: C.o1, O: C.n1, b: C.n2 }, 22, 22, 2, function (g, i) {
    oval(g, 11, 16, 7, 6, 'f'); oval(g, 12, 17, 4, 4, 'b');
    rect(g, 6, 20, 4, 2, 'F'); rect(g, 13, 20, 4, 2, 'F');
    rect(g, 3, 14, 3, 4, 'f'); rect(g, 17, 13 - i, 3, 4, 'f');
    oval(g, 11, 7, 7.5, 6, 'f'); oval(g, 6, 9, 3, 2.5, 'c'); oval(g, 16, 9, 3, 2.5, 'c');                           // massive cheeks
    oval(g, 5, 1.5, 2, 2, 'f'); oval(g, 16, 1.5, 2, 2, 'f'); px(g, 5, 1, 'F'); px(g, 16, 1, 'F');
    if (i) { rect(g, 7, 6, 3, 1, 'e'); rect(g, 13, 6, 3, 1, 'e'); }
    else { oval(g, 8, 5.5, 1.8, 1.8, 'e'); oval(g, 14, 5.5, 1.8, 1.8, 'e'); px(g, 8, 4, 'w'); px(g, 14, 4, 'w'); }
    rect(g, 10, 8, 3, 2, 'n'); rect(g, 10, 11, 3, 1, 'e');
    rect(g, 7, 12, 9, 2, 'o'); tri(g, 9, 13, 14, 13, 11, 17, 'o'); px(g, 11, 14, 'O');                              // the ascot, Fred style
  });

  // Manasa: Valtay-controlled pop singer, big hair, sequined gown, microphone
  pspr('manasa', { s: C.r3, S: C.r2, h: C.m1, H: C.m0, w: C.W, e: C.K, m: C.r0, d: C.c2, D: C.c1, x: C.W, g: C.g0, y: C.y2 }, 20, 30, 2, function (g, i) {
    tri(g, 3, 29, 15, 29, 9, 14, 'd'); rect(g, 6, 12, 6, 8, 'd'); rect(g, 6, 12, 1, 14, 'D');
    dots(g, 0, 10, 20, 20, 'd', 'x', function (x, y) { return (x * 3 + y * 2 + i) % 7 === 0; });
    rect(g, 7, 10, 4, 2, 's'); rect(g, 4, 13, 2, 6, 's'); rect(g, 12, 12, 2, 3, 's'); rect(g, 13, 9, 2, 3, 's'); rect(g, 14, 7, 2, 3, 'g'); oval(g, 15, 6, 1.5, 1.5, 'g');
    oval(g, 9, 5, 4, 4, 's');
    oval(g, 7, 3, 6, 4, 'h'); rect(g, 2, 3, 4, 9, 'h'); px(g, 3, 12, 'H'); px(g, 6, 0, 'H');
    eye(g, 10, 4, i === 1); rect(g, 11, 8, 2, 1, 'm'); px(g, 12, 6, 'S');
    px(g, 17, 2 + i, 'y'); px(g, 18, 4 - i, 'y');
  });

  // Tucker: the political pundit: slick side part, blue blazer, red tie, smug little grin
  pspr('tucker', { s: C.n3, S: C.n2, h: C.y3, H: C.y2, w: C.W, e: C.K, m: C.o0, c: C.b1, C: C.p0, t: C.r1, p: C.g0, P: C.K }, 18, 30, 2, function (g, i) {
    legs2(g, 5, 22, 29, 2, 'p', 'P', 3);
    rect(g, 4, 12, 10, 11, 'c'); rect(g, 4, 12, 1, 11, 'C'); rect(g, 8, 12, 3, 6, 'w'); rect(g, 9, 12, 1, 7, 't');
    rect(g, 2, 13, 2, 7, 'c'); rect(g, 2, 20, 2, 2, 's'); rect(g, 14, 13, 2, 6, 'c'); rect(g, 14, 19, 2, 2, 's');
    rect(g, 8, 10, 3, 2, 's');
    oval(g, 10, 6, 4.5, 4.5, 's');
    rect(g, 6, 1, 9, 3, 'h'); rect(g, 5, 2, 3, 6, 'h'); line(g, 8, 2, 14, 2, 'H');
    eye(g, 11, 5, i === 1); line(g, 10, 4, 13, 4, 'H');
    line(g, 11, 9, 14, 8, 'm'); px(g, 15, 7, 'S');
  });

  // Princess D'nadia of the Prism Kingdom: crystal skin catching the light, prism tiara, iridescent gown
  pspr('dnadia', { s: C.b6, S: C.b4, x: C.W, h: C.p3, H: C.p2, w: C.W, e: C.p0, m: C.m1, d: C.m3, D: C.p2, q: C.c3, y: C.y2, r: C.r2 }, 20, 30, 2, function (g, i) {
    tri(g, 2, 29, 16, 29, 9, 13, 'd'); rect(g, 6, 12, 6, 8, 'd'); line(g, 4, 28, 9, 14, 'D'); line(g, 14, 28, 10, 16, 'q');
    rect(g, 7, 10, 4, 2, 's'); rect(g, 4, 13, 2, 6, 's'); rect(g, 12, 13, 2, 6, 's');
    oval(g, 9, 5, 4, 4, 's'); px(g, 7, 4, 'x'); px(g, 11, 7, 'x'); px(g, 8, 7, 'S');                                  // facets
    rect(g, 5, 1, 7, 3, 'h'); rect(g, 4, 2, 2, 9, 'h'); px(g, 4, 11, 'H');
    tri(g, 6, 1, 12, 1, 9, -3, 'q'); px(g, 9, -1, 'r'); px(g, 8, 0, 'y'); px(g, 10, 0, 'x');                          // prism tiara
    eye(g, 10, 4, i === 1); rect(g, 11, 8, 2, 1, 'm');
    px(g, 15, 3 + i, 'x'); px(g, 2, 15 - i, 'q'); px(g, 17, 20, 'r');
  }, { });

  // Zev: two-foot Kua-Tin PR handler from Borant (fish person), headset + clipboard (book 1 art)
  (function () {
    var zp = { b: C.c1, B: C.c2, f: C.b4, w: C.W, e: C.K, h: C.g3, m: C.g1, c: C.m1, C: C.m0, W: C.W, y: C.y2, x: C.K };
    var z0 = ['....fff.....', '...bbbbbb...', '..bbbbbwwb..', '..bbbbbweb..', '.hbbbbbbbbm.', '.hhbbbbbbxm.', '..bbbbbBBB..', '...ccCccc...', '..cccCcyy...', '..ccCcWWWb..', '..cccCWWWb..', '...bb..bb...', '..fff..fff..'];
    var z1 = alt(z0, 0, ['.....fff....']); z1 = alt(z1, 2, ['..bbbbbbbb..', '..bbbbbbeb..']);
    var zr0 = legs(z0, ['..bb....bb..', '.fff....fff.']);
    var zr1 = legs(z0, ['....bbbb....', '...ffffff...']);
    var zact = alt(z0, 7, ['...ccCccc.y.', '..cccCcc.yWW', '..ccCcccbWWW', '..cccCcc.WWW']);
    zact = alt(zact, 2, ['..bbbbbwwb..', '..bbbbbweb..', '.hbbbbbbbbm.', '.hhbbbbbxxm.']);
    spr('zev', zp, [z0, z1]);
    alias('zev_idle', 'zev');
    spr('zev_run', zp, [zr0, zr1]);
    spr('zev_act', zp, [zact]);
  })();

  // Odette on air: black triangular praying-mantis helmet with mirrored compound eyes and long antennae,
  // a plus-sized upper body, and a king crab the size of a brown bear where her legs should be
  pspr('odette', { h: C.K, H: C.g0, x: C.b6, X: C.W, s: C.y0, S: C.n0, d: C.p0, D: C.m0, c: C.o1, C: C.o0, y: C.y2, w: C.W, a: C.g1 }, 40, 38, 2, function (g, i) {
    // crab body + legs
    oval(g, 20, 30, 12, 5, 'c'); oval(g, 20, 29, 9, 3, 'C'); dots(g, 8, 25, 26, 10, 'c', 'C', function (x, y) { return (x + y * 2) % 5 === 0; });
    for (var k = 0; k < 4; k++) { var lx = 9 + k * 2, rx = 31 - k * 2, up = (k + i) % 2; poly(g, [[lx, 30], [lx - 4, 27 - up], [lx - 6, 37]], 'c', 1); poly(g, [[rx, 30], [rx + 4, 27 - up], [rx + 6, 37]], 'c', 1); }
    oval(g, 33, 24, 3, 2, 'c'); px(g, 35, 22, 'C'); px(g, 36, 23, 'c');                                                // claw
    // upper body
    oval(g, 20, 21, 8, 6, 'd'); oval(g, 17, 22, 3, 2.5, 'D'); oval(g, 23, 22, 3, 2.5, 'D'); rect(g, 12, 25, 16, 1, 'y');
    rect(g, 10, 17, 3, 8, 's'); rect(g, 27, 17, 3, 7, 's'); rect(g, 28, 23, 3, 2, 's'); px(g, 31, 24, 'y');
    rect(g, 17, 13, 6, 4, 's'); oval(g, 20, 17, 7, 2, 's');
    // mantis helmet: inverted triangle, two mirrored compound eyes, antennae
    tri(g, 11, 3, 29, 3, 20, 15, 'H'); tri(g, 12, 4, 28, 4, 20, 14, 'h'); rect(g, 13, 2, 14, 2, 'H');
    oval(g, 15, 6, 3, 2.5, 'x'); oval(g, 25, 6, 3, 2.5, 'x'); px(g, 14, 5, 'X'); px(g, 24, 5, 'X'); if (i) { px(g, 16, 7, 'a'); px(g, 26, 7, 'a'); }
    poly(g, [[16, 2], [12, -1 + i], [6, 0]], 'H', 1); poly(g, [[24, 2], [28, -1 + i], [34, 0]], 'H', 1);
    rect(g, 18, 11, 4, 1, 'H');
  });

  // Lucia Mar (about 13): oversized yellow soccer jersey with a thick blue stripe worn over glowing silver armour, mace
  pspr('lucia', { s: C.n2, S: C.n1, h: C.p0, H: C.b1, w: C.W, e: C.K, m: C.o0, j: C.y2, J: C.y1, b: C.b2, a: C.g1, A: C.b6, x: C.g0, X: C.g1 }, 22, 26, 2, function (g, i) {
    rect(g, 6, 19, 2, 6, 'a'); rect(g, 10, 19, 2, 6, 'a'); px(g, 6, 21, 'A'); px(g, 10, 22, 'A'); rect(g, 5, 25, 3, 1, 'x'); rect(g, 10, 25, 3, 1, 'x');
    rect(g, 4, 11, 10, 9, 'j'); rect(g, 4, 14, 10, 3, 'b'); rect(g, 4, 11, 1, 9, 'J');
    rect(g, 2, 12, 2, 6, 'a'); rect(g, 2, 18, 2, 2, 's'); rect(g, 14, 12, 2, 5, 'a'); rect(g, 14, 17, 2, 2, 's'); px(g, 15, 14, 'A');
    line(g, 15, 17, 19, 11 + i, 'X'); oval(g, 19, 10 + i, 2, 2, 'x'); px(g, 21, 10 + i, 'X'); px(g, 19, 8 + i, 'X'); px(g, 17, 10 + i, 'X');   // mace
    rect(g, 7, 9, 3, 2, 's');
    oval(g, 9, 5, 4, 4, 's');
    rect(g, 5, 1, 8, 3, 'h'); rect(g, 4, 2, 3, 9, 'h'); px(g, 4, 11, 'H');
    eye(g, 10, 4, i === 1); rect(g, 11, 8, 2, 1, 'm');
    px(g, 3, 20 - i, 'A'); px(g, 15, 21, 'A');                                                                         // the armour glows
  });

  // Fathom dwarves: Eunice (pregnant, Level 30) and her son Ricky Joe (Level 2)
  var FD = { s: C.c1, S: C.c0, h: C.y0, H: C.n0, w: C.W, e: C.K, m: C.c0, d: C.b5, D: C.p0, a: C.n3, A: C.n2, p: C.y0, f: C.t2, o: C.o1, O: C.y2 };
  pspr('eunice', FD, 22, 24, 2, function (g, i) {
    rect(g, 6, 21, 4, 3, 'p'); rect(g, 12, 21, 4, 3, 'p');
    oval(g, 11, 16, 7, 6, 'd'); oval(g, 14, 17, 5, 4.5, 'd'); oval(g, 15, 17, 3, 3, 'a');                          // dress over the big belly + apron
    rect(g, 3, 11, 3, 7, 'd'); rect(g, 3, 18, 3, 2, 's'); rect(g, 17, 12, 2, 4, 's'); px(g, 18, 16, 's');
    rect(g, 8, 8, 6, 3, 's');
    oval(g, 11, 5, 5, 4.5, 's'); px(g, 5, 5, 'f'); px(g, 5, 6, 'f'); px(g, 6, 7, 'S');                              // fin ear, gill
    rect(g, 6, 0, 10, 3, 'h'); rect(g, 5, 1, 3, 6, 'h'); poly(g, [[5, 6], [4, 10], [5, 13]], 'H', 2);              // braid
    eye(g, 12, 4, i === 1); rect(g, 12, 8, 3, 1, 'm'); px(g, 16, 6, 'S');
  });
  pspr('ricky_joe', FD, 16, 18, 2, function (g, i) {
    rect(g, 4, 15, 3, 3, 'p'); rect(g, 8, 15, 3, 3, 'p');
    rect(g, 3, 9, 9, 7, 'D'); rect(g, 4, 9, 2, 3, 'a'); rect(g, 9, 9, 2, 3, 'a');                                    // overalls
    rect(g, 1, 10, 2, 4, 's'); rect(g, 12, 10, 2, 2, 's'); rect(g, 12, 9 - i, 3, 1, 'o'); px(g, 14, 8 - i, 'O');      // pet salamander
    oval(g, 7, 5, 4.5, 4, 's'); px(g, 2, 5, 'f'); px(g, 2, 4, 'f');
    rect(g, 3, 0, 8, 2, 'h'); px(g, 3, 2, 'h'); px(g, 10, 1, 'H');
    eye(g, 8, 4, i === 1); rect(g, 8, 7, 2, 1, 'm');
  });
})();


/* ================================================================== *
 *  ENEMIES  (<id>_walk x2+, <id>_attack, <id>_hurt) - painted, auto outline
 * ================================================================== */
(function () {
  'use strict';
  var DCW = window.DCW, K = DCW.artActorsKit, C = K.C;
  var rect = K.rect, px = K.px, oval = K.oval, line = K.line, tri = K.tri, poly = K.poly, dots = K.dots, stamp = K.stamp;
  var penemy = K.penemy, eye = K.eye, legs2 = K.legs2, fowl = K.fowl;

  // ---- Former Circus Lemur (L8): red fur, a painted human skull worn as a mask, bandolier of throwing knives ----
  penemy('lemur', { f: C.o1, F: C.o0, d: C.n0, w: C.W, W: C.g1, r: C.r1, y: C.y2, b: C.y0, x: C.g1, X: C.W }, 20, 20, 2, function (g, pose, i) {
    var at = pose === 'attack', hu = pose === 'hurt', hop = pose === 'walk' && i === 1 ? -1 : 0;
    // ringed tail curling up behind
    poly(g, [[6, 14 + hop], [3, 12 + hop], [2, 8 + hop], [3, 4 + hop], [5, 2 + hop]], 'f', 2);
    [[2, 10], [2, 6], [4, 3]].forEach(function (q) { px(g, q[0], q[1] + hop, 'd'); px(g, q[0] + 1, q[1] + hop, 'd'); });
    // legs (crouched)
    if (pose === 'walk' && i === 0) { line(g, 7, 15, 5, 18, 'f', 2); line(g, 11, 15, 13, 18, 'f', 2); }
    else { rect(g, 7, 15 + hop, 2, 3, 'f'); rect(g, 11, 15 + hop, 2, 3, 'f'); }
    rect(g, 6, 18 + (hop ? 0 : 0), 3, 1, 'F'); rect(g, 11, 18, 3, 1, 'F');
    // body + bandolier with knives
    oval(g, 10, 12 + hop, 4, 4, 'f'); line(g, 7, 9 + hop, 13, 15 + hop, 'b'); px(g, 9, 11 + hop, 'x'); px(g, 11, 13 + hop, 'x'); px(g, 8, 10 + hop, 'X');
    // arms
    if (at) { line(g, 12, 10, 16, 5, 'f', 2); line(g, 17, 4, 19, 1, 'x'); px(g, 18, 2, 'X'); }
    else if (hu) { line(g, 12, 10, 16, 7, 'f', 2); line(g, 8, 10, 4, 8, 'f', 2); }
    else { line(g, 12, 11 + hop, 14, 14 + hop, 'f', 2); }
    // head: skull mask (white, black sockets, red war paint), bulging bloodshot eyes inside
    oval(g, 12, 5 + hop, 4, 4, 'f'); px(g, 9, 1 + hop, 'f'); px(g, 15, 1 + hop, 'f');
    oval(g, 13, 5 + hop, 3.5, 3.5, 'w'); rect(g, 14, 8 + hop, 3, 2, 'W'); px(g, 15, 9 + hop, 'k'); px(g, 14, 10 + hop, 'w'); px(g, 16, 10 + hop, 'w');
    rect(g, 12, 4 + hop, 2, 2, 'k'); rect(g, 15, 4 + hop, 2, 2, 'k');
    px(g, 12, 4 + hop, hu ? 'W' : 'y'); px(g, 15, 4 + hop, hu ? 'W' : 'y'); px(g, 13, 5 + hop, 'r');
    line(g, 11, 2 + hop, 13, 3 + hop, 'r'); px(g, 16, 2 + hop, 'r');
  }, { });

  // ---- Terror the Clown (L10): eleven feet tall, fused to its stilts, spindly arms to the ground, bone-white
  //      blotchy skin, no eyes or nose, a huge red toothy mouth with a forked tongue, curly red wig, a little
  //      flower hat, a butcher knife, tattered bloody clown clothes ----
  function terror(g, pose, i, s) {
    s = s || 1;
    function X(v) { return Math.round(v * s); } function S(v) { return Math.max(1, Math.round(v * s)); }
    var at = pose === 'attack' || pose === 'special', hu = pose === 'hurt';
    var st = pose === 'walk' ? (i % 2 ? 1 : -1) : 0, bob = pose === 'walk' && i % 2 ? 1 : 0;
    // stilt legs (striped trousers fused to poles)
    var lx0 = 9 + st * 2, lx1 = 13 - st * 2;
    line(g, X(10), X(25 + bob), X(lx0), X(46), 'p', S(2)); line(g, X(13), X(25 + bob), X(lx1), X(46), 'P', S(2));
    for (var y = 27; y < 46; y += 3) { px(g, X(10 + (lx0 - 10) * (y - 25) / 21), X(y), 'q'); px(g, X(13 + (lx1 - 13) * (y - 25) / 21), X(y), 'q'); }
    rect(g, X(lx0) - S(1), X(46) - S(1) + 1, S(3), S(1), 'b'); rect(g, X(lx1) - S(1), X(46) - S(1) + 1, S(3), S(1), 'b');
    // torso: tattered polka-dot tunic, blood
    rect(g, X(8), X(14 + bob), S(8), S(12), 'c'); rect(g, X(8), X(14 + bob), S(1), S(12), 'C');
    for (var k = 0; k < 4; k++) px(g, X(8 + k * 2 + 1), X(25 + bob) + (k % 2), 'c');
    dots(g, X(8), X(14), S(8), S(12), 'c', 'd', function (x, y) { return (x * 3 + y * 5) % 9 === 0; });
    px(g, X(10), X(18 + bob), 'r'); px(g, X(11), X(19 + bob), 'r'); px(g, X(13), X(22 + bob), 'r');
    rect(g, X(7), X(13 + bob), S(10), S(2), 'w'); for (k = 0; k < 5; k++) px(g, X(7 + k * 2), X(15 + bob), 'w');   // ruff
    // spindly arms, hanging almost to the ground; knife hand
    if (at) { line(g, X(15), X(15 + bob), X(19), X(8), 's', S(1)); rect(g, X(18), X(4), S(2), S(5), 'x'); rect(g, X(18), X(8), S(2), S(2), 'b'); }
    else { line(g, X(15), X(15 + bob), X(17), X(34), 's', S(1)); rect(g, X(17), X(34), S(2), S(2), 's'); line(g, X(18), X(35), X(18), X(41), 'x', S(2)); px(g, X(18), X(34), 'b'); }
    line(g, X(8), X(15 + bob), X(5 - (hu ? 2 : 0)), X(33 - (hu ? 10 : 0)), 's', S(1)); rect(g, X(4 - (hu ? 2 : 0)), X(33 - (hu ? 10 : 0)), S(2), S(2), 's');
    // head: bone white, blotchy, no eyes, no nose, the mouth
    oval(g, X(12), X(8 + bob), 4.5 * s, 5 * s, 's'); px(g, X(10), X(6 + bob), 'S'); px(g, X(14), X(10 + bob), 'S'); px(g, X(9), X(10 + bob), 'S');
    var mo = at ? 1 : 0;
    rect(g, X(12), X(8 + bob), S(5), S(3 + mo), 'm'); for (k = 0; k < 5; k++) { px(g, X(12 + k), X(8 + bob), 'w'); px(g, X(12 + k), X(10 + mo + bob), 'w'); }
    if (at || hu) { line(g, X(16), X(10 + bob), X(19), X(11 + bob), 'R'); px(g, X(19), X(10 + bob), 'R'); px(g, X(20), X(12 + bob), 'R'); }
    // curly red wig + little hat with a flower
    rect(g, X(7), X(4 + bob), S(3), S(6), 'h'); oval(g, X(8), X(3 + bob), 2 * s, 2 * s, 'h'); oval(g, X(14), X(2.5 + bob), 2.5 * s, 1.6 * s, 'h'); px(g, X(6), X(8 + bob), 'h'); px(g, X(6), X(5 + bob), 'H'); px(g, X(8), X(7 + bob), 'H');
    rect(g, X(10), X(0 + bob), S(4), S(2), 'a'); rect(g, X(9), X(2 + bob), S(6), S(1), 'a'); px(g, X(13), X(0 + bob), 'y'); px(g, X(14), X(0 + bob), 'Y');
  }
  var TERP = { p: C.m1, P: C.m0, q: C.W, b: C.y0, c: C.y2, C: C.y1, d: C.b3, r: C.r0, w: C.W, s: C.g2, S: C.g1, m: C.r0, R: C.r1, x: C.g1, h: C.o1, H: C.o0, a: C.b1, y: C.y2, Y: C.r1 };
  penemy('stilt_clown', TERP, 24, 48, 2, function (g, pose, i) { terror(g, pose, i, 1); });
  K.terror = terror; K.TERP = TERP;

  // ---- Clammy-type fat clown (L9): short, three times as wide, filthy pink-and-blue gown with a white neck
  //      ruffle, pointed teeth, red-white-blue greasepaint, long overgrown fingernails ----
  penemy('fat_clown', { g: C.m2, G: C.m1, b: C.b4, B: C.b2, d: C.y1, w: C.W, s: C.o3, S: C.n2, r: C.o1, u: C.b3, m: C.r0, n: C.y3, h: C.G1, H: C.G0, f: C.y0 }, 30, 26, 2, function (g, pose, i) {
    var at = pose === 'attack', hu = pose === 'hurt', sq = at ? 3 : 0, wb = pose === 'walk' ? i : 0;
    rect(g, 9 - wb, 23 - 0, 4, 2, 'f'); rect(g, 17 + wb, 23, 4, 2, 'f');
    // gown: huge round body
    oval(g, 15, 16 + sq * 0.5, 13 + sq * 0.7, 7 - sq * 0.5, 'g');
    dots(g, 1, 9, 28, 15, 'g', 'b', function (x, y) { return ((x >> 2) + (y >> 2)) % 2 === 0 && (x + y) % 2 === 0; });
    dots(g, 1, 9, 28, 15, 'g', 'd', function (x, y) { return (x * 7 + y * 3) % 13 === 0; });                     // filth
    rect(g, 8, 9 + sq, 14, 2, 'w'); for (var k = 0; k < 7; k++) px(g, 8 + k * 2, 11 + sq, 'w');                // ruffle
    // arms with long nails
    var ay = at ? -3 : hu ? -4 : 0;
    rect(g, 0, 13 + sq + ay, 3, 4, 'g'); rect(g, 27, 13 + sq + ay, 3, 4, 'g');
    line(g, 0, 17 + sq + ay, 0, 20 + sq + ay, 'n'); line(g, 2, 17 + sq + ay, 2, 20 + sq + ay, 'n'); line(g, 28, 17 + sq + ay, 28, 20 + sq + ay, 'n'); line(g, 29, 17 + sq + ay, 29, 20 + sq + ay, 'n');
    // head with greasepaint
    oval(g, 16, 5 + sq, 5, 4.5, 's');
    rect(g, 13, 3 + sq, 3, 2, 'w'); rect(g, 18, 3 + sq, 3, 2, 'u'); px(g, 15, 4 + sq, 'm'); px(g, 20, 4 + sq, 'm');
    rect(g, 13, 7 + sq, 8, 2, 'r'); for (k = 0; k < 4; k++) px(g, 14 + k * 2, 7 + sq, 'w');                       // pointed teeth
    px(g, 21, 5 + sq, 'r');
    rect(g, 11, 0 + sq, 3, 3, 'h'); rect(g, 19, 0 + sq, 3, 3, 'h'); px(g, 12, 2 + sq, 'H');
  });

  // ---- Mold Lion (L15): mane of waving pink and green worms, a glowing emerald eye, half the body splattered
  //      with pulsing glowing green fungus ----
  penemy('mold_lion', { f: C.y2, F: C.y1, d: C.n0, m: C.m2, M: C.G2, n: C.m1, N: C.G1, e: C.t2, E: C.c3, w: C.W, r: C.r0, g: C.l2, G: C.G2, t: C.y0 }, 34, 22, 4, function (g, pose, i) {
    var at = pose === 'attack', hu = pose === 'hurt';
    var lift = at ? -3 : 0, st = pose === 'walk' ? [[-2, 2], [0, 0], [2, -2], [0, 0]][i] : [0, 0];
    // tail with tuft
    poly(g, [[6, 11 + lift], [3, 9 + lift], [2, 5 + lift]], 'f', 1); oval(g, 2, 4 + lift, 1.5, 1.5, 'd');
    // legs
    var LG = at ? [[7, -2], [11, -1], [20, 3], [24, 3]] : [[7 + st[0], 0], [11 - st[0], 0], [20 + st[1], 0], [24 - st[1], 0]];
    LG.forEach(function (l, k) {
      if (at && k > 1) { line(g, l[0], 14 + lift, l[0] + 4, 12 + lift, 'f', 2); px(g, l[0] + 6, 12 + lift, 'w'); px(g, l[0] + 6, 13 + lift, 'w'); }
      else { rect(g, l[0], 14 + lift + l[1], 3, 6 - l[1], k % 2 ? 'F' : 'f'); rect(g, l[0], 20 + lift, 4, 1, 'd'); }
    });
    // body
    oval(g, 15, 11 + lift, 10, 5, 'f'); rect(g, 7, 13 + lift, 16, 2, 'F');
    // fungus over the back half: lumpy glowing green
    oval(g, 10, 10 + lift, 5, 4, 'g'); oval(g, 13, 13 + lift, 3, 2, 'G'); oval(g, 7, 13 + lift, 2, 2, 'G'); px(g, 9, 8 + lift, 'G'); px(g, 12, 9 + lift, 'G');
    if (i % 2) { px(g, 8, 10 + lift, 'G'); px(g, 11, 12 + lift, 'g'); }
    // mane of worms (pink + green), waving between frames
    oval(g, 25, 8 + lift, 6, 6, 'm');
    for (var k = 0; k < 9; k++) {
      var a = -1.9 + k * 0.42, wv = (k + i) % 2;
      var x1 = 25 + Math.round(Math.cos(a) * (6 + wv)), y1 = 8 + lift + Math.round(Math.sin(a) * (6 + wv));
      var x2 = 25 + Math.round(Math.cos(a + 0.2 * (wv ? 1 : -1)) * (8 + wv)), y2 = 8 + lift + Math.round(Math.sin(a + 0.2) * (8 + wv));
      line(g, x1, y1, x2, y2, k % 2 ? 'N' : 'n');
    }
    dots(g, 18, 1, 14, 15, 'm', 'M', function (x, y) { return (x + y * 2 + i) % 3 === 0; });
    // face
    oval(g, 28, 9 + lift, 3.5, 3, 'f'); rect(g, 29, 10 + lift, 4, 2, 'F'); px(g, 32, 10 + lift, 'd');
    rect(g, 28, 7 + lift, 2, 2, hu ? 'w' : 'e'); px(g, 29, 7 + lift, 'E');                                          // the glowing emerald eye
    if (at || hu) { rect(g, 29, 12 + lift, 4, 1, 'r'); px(g, 30, 11 + lift, 'w'); px(g, 32, 11 + lift, 'w'); }
  });

  // ---- artillery giraffe: a circus giraffe in a harness with a catapult basket on its head; flings lemurs ----
  penemy('giraffe', { f: C.y2, F: C.y1, d: C.n0, D: C.y0, w: C.W, e: C.K, h: C.n1, b: C.n0, B: C.y0, r: C.r0, R: C.r1, x: C.g0, l: C.o1, L: C.W }, 34, 46, 2, function (g, pose, i) {
    var at = pose === 'attack', hu = pose === 'hurt', st = pose === 'walk' ? (i ? 1 : -1) : 0;
    // legs
    [[6, st], [10, -st], [19, -st], [23, st]].forEach(function (l, k) { line(g, l[0], 34, l[0] + l[1], 44, k % 2 ? 'F' : 'f', 2); rect(g, l[0] + l[1], 44, 2, 2, 'd'); });
    // body + harness
    oval(g, 15, 31, 11, 5, 'f'); rect(g, 11, 26, 3, 10, 'r'); rect(g, 19, 26, 3, 10, 'r'); rect(g, 4, 30, 22, 1, 'R');
    poly(g, [[4, 30], [1, 34], [2, 38]], 'f', 1); px(g, 2, 38, 'd');
    // neck: upright, or whipped forward to fling
    var nx = at ? 30 : 23, ny = at ? 14 : 6;
    line(g, 21, 28, nx, ny + 4, 'f', 4); line(g, 24, 28, nx + 2, ny + 5, 'F', 1);
    dots(g, 0, 0, 34, 46, 'f', 'd', function (x, y) { return ((x >> 2) + (y >> 2) * 3) % 4 === 0 && (x + y) % 3 !== 0; });
    // head
    rect(g, nx - 1, ny, 7, 4, 'f'); rect(g, nx + 4, ny + 1, 3, 3, 'F'); px(g, nx + 6, ny + 2, 'd');
    px(g, nx + 1, ny - 1, 'D'); px(g, nx + 1, ny - 2, 'd'); px(g, nx + 3, ny - 1, 'D'); px(g, nx + 3, ny - 2, 'd');   // ossicones
    if (hu) { px(g, nx + 2, ny + 1, 'w'); } else { px(g, nx + 2, ny + 1, 'e'); }
    // catapult basket strapped behind the head (a lemur in it when loaded)
    var cx = at ? nx - 4 : nx - 6, cy = at ? ny - 6 : ny - 3;
    rect(g, cx, cy, 6, 3, 'b'); rect(g, cx, cy + 3, 6, 1, 'B'); line(g, cx + 5, cy + 3, nx, ny + 2, 'x');
    if (!at) { oval(g, cx + 3, cy - 1, 2, 1.5, 'l'); px(g, cx + 3, cy - 2, 'L'); }
    else { oval(g, cx + 8, cy - 5, 2, 2, 'l'); px(g, cx + 9, cy - 6, 'L'); }
  });

  // ---- Street Urchin (L8): knee-high spiky tumbleweed janitor, rolls; night only ----
  penemy('street_urchin', { t: C.y1, T: C.y0, s: C.n2, S: C.n3, e: C.W, p: C.K, r: C.r1 }, 20, 18, 3, function (g, pose, i) {
    var at = pose === 'attack', R = at ? 7.5 : 6;
    oval(g, 10, 10, R, R - 0.5, 't');
    var rot = (pose === 'walk' ? i : 0) * 0.35;
    for (var k = 0; k < 12; k++) {
      var a = rot + k * Math.PI / 6, r1 = R - 1, r2 = R + (at ? 3 : 2);
      line(g, 10 + Math.round(Math.cos(a) * r1), 10 + Math.round(Math.sin(a) * r1), 10 + Math.round(Math.cos(a) * r2), 10 + Math.round(Math.sin(a) * r2), k % 2 ? 's' : 'S');
    }
    for (k = 0; k < 6; k++) { var b = rot * 2 + k; px(g, 10 + Math.round(Math.cos(b) * 3), 10 + Math.round(Math.sin(b) * 3), 'T'); }
    rect(g, 11, 7, 2, 2, 'e'); rect(g, 14, 7, 2, 2, 'e'); px(g, 12, 8, 'p'); px(g, 15, 8, 'p');
    if (at) { line(g, 10, 6, 13, 7, 'p'); line(g, 17, 6, 15, 7, 'p'); rect(g, 12, 11, 4, 1, 'r'); }
  });

  // ---- Brain Boiler: a floating squid crossed with an umbrella; psionic ring pulse ----
  penemy('brain_boiler', { b: C.r3, B: C.r2, u: C.p2, U: C.p1, t: C.m3, T: C.m2, e: C.y2, E: C.o1, p: C.c3, P: C.b4, w: C.W, h: C.y0 }, 26, 28, 2, function (g, pose, i) {
    var at = pose === 'attack', bob = pose === 'walk' ? i : 0;
    // umbrella canopy with brain folds
    oval(g, 13, 7 + bob, 11, 6, 'u'); rect(g, 2, 8 + bob, 23, 6, '.');
    for (var k = 0; k < 6; k++) tri(g, 2 + k * 4, 7 + bob, 6 + k * 4, 7 + bob, 4 + k * 4, 10 + bob, 'U');
    oval(g, 13, 5 + bob, 7, 3.5, 'b'); poly(g, [[8, 5 + bob], [10, 3 + bob], [12, 6 + bob], [14, 3 + bob], [16, 6 + bob], [18, 4 + bob]], 'B', 1);
    rect(g, 12, 0 + bob, 2, 2, 'h');
    // squid body + eyes
    oval(g, 13, 13 + bob, 4, 3.5, 't'); rect(g, 11, 12 + bob, 2, 2, 'e'); rect(g, 15, 12 + bob, 2, 2, 'e'); px(g, 12, 13 + bob, 'E'); px(g, 16, 13 + bob, 'E');
    // tentacles hanging like the umbrella shaft
    for (k = 0; k < 5; k++) { var x0 = 9 + k * 2, sw = ((k + i) % 2) * 2 - 1; poly(g, [[x0, 16 + bob], [x0 + sw, 20 + bob], [x0, 24 + bob], [x0 - sw, 26 + bob]], k % 2 ? 'T' : 't', 1); }
    poly(g, [[13, 16], [13, 24], [15, 26]], 'T', 1);
    if (at) { oval(g, 13, 13, 12, 12, 'p'); oval(g, 13, 13, 11, 11, '.'); for (k = 0; k < 8; k++) px(g, 13 + Math.round(Math.cos(k) * 9), 13 + Math.round(Math.sin(k) * 9), 'P'); oval(g, 13, 7, 9, 5, 'u'); oval(g, 13, 5, 7, 3.5, 'b'); oval(g, 13, 13, 4, 3.5, 't'); rect(g, 11, 12, 2, 2, 'w'); rect(g, 15, 12, 2, 2, 'w'); }
  });

  // ---- Shambling Berserker (L12): a thirteen-foot pile of stitched-together body parts, slow (until the dark) ----
  penemy('berserker', { a: C.n2, A: C.n1, b: C.g1, B: C.g0, c: C.r2, C: C.r0, d: C.n1, s: C.K, w: C.W, e: C.o1, r: C.r0, g: C.g0, y: C.y3 }, 38, 46, 3, function (g, pose, i) {
    var at = pose === 'attack', hu = pose === 'hurt', bob = pose === 'walk' ? [0, 1, 0][i] : 0, st = pose === 'walk' ? [-1, 0, 1][i] : 0;
    // legs: one fat, one thin, mismatched
    rect(g, 11 + st, 34, 6, 10, 'a'); rect(g, 21 - st, 34, 4, 10, 'b'); rect(g, 10 + st, 43, 8, 3, 'A'); rect(g, 20 - st, 43, 6, 3, 'g');
    // huge lumpy torso of patches
    oval(g, 18, 24 + bob, 13, 12, 'a');
    oval(g, 12, 20 + bob, 6, 6, 'b'); oval(g, 24, 28 + bob, 6, 5, 'c'); oval(g, 22, 16 + bob, 5, 4, 'A'); oval(g, 11, 30 + bob, 4, 4, 'C');
    // stitches between patches
    poly(g, [[6, 24 + bob], [12, 26 + bob], [18, 23 + bob], [24, 22 + bob], [30, 25 + bob]], 's', 1); for (var k = 6; k < 30; k += 2) px(g, k, 23 + bob + (k % 4 ? 0 : 1), 's');
    poly(g, [[18, 13 + bob], [17, 20 + bob], [19, 28 + bob], [17, 34 + bob]], 's', 1); for (k = 14; k < 34; k += 3) { px(g, 16, k + bob, 's'); px(g, 20, k + bob, 's'); }
    // arms: three of them, one ending in an extra hand
    var ay = at ? -8 : hu ? -4 : 0;
    line(g, 29, 20 + bob, 35, 30 + bob + ay, 'b', 4); rect(g, 33, 30 + bob + ay, 5, 4, 'B');
    line(g, 7, 19 + bob, 2, 32 + bob, 'c', 3); rect(g, 0, 32 + bob, 4, 4, 'C');
    line(g, 26, 26 + bob, 31, 37 + bob + (at ? -10 : 0), 'a', 3); rect(g, 30, 37 + bob + (at ? -10 : 0), 4, 3, 'A');
    // little heads stuck on top, crooked
    oval(g, 16, 8 + bob, 5, 5, 'b'); rect(g, 17, 6 + bob, 2, 2, 'w'); px(g, 18, 7 + bob, 'e'); rect(g, 14, 7 + bob, 2, 2, 'w'); px(g, 15, 7 + bob, 'e'); rect(g, 15, 11 + bob, 4, 1, 'r');
    oval(g, 26, 9 + bob, 3.5, 3.5, 'A'); rect(g, 27, 8 + bob, 2, 1, 's'); px(g, 28, 10 + bob, 'r');
    poly(g, [[13, 4 + bob], [16, 3 + bob], [20, 5 + bob]], 's', 1);
    if (at) { rect(g, 14, 11 + bob, 6, 2, 'r'); px(g, 15, 11, 'w'); px(g, 18, 11, 'w'); }
  });

  // ---- City Elf of the 201st Security Group (L16): black shirt with a hand-sewn arm patch and a name patch;
  //      casts darkness orbs ----
  function elf(g, pose, i, o) {
    var at = pose === 'attack', hu = pose === 'hurt', st = pose === 'walk' ? (i ? 1 : -1) : 0;
    // legs
    if (pose === 'walk') { line(g, 7, 17, 7 + st * 2, 24, 'p', 2); line(g, 10, 17, 10 - st * 2, 24, 'p', 2); }
    else { rect(g, 6, 17, 2, 7, 'p'); rect(g, 10, 17, 2, 7, 'p'); }
    rect(g, 5 + (pose === 'walk' ? st * 2 : 0), 24, 3, 1, 'P'); rect(g, 10 - (pose === 'walk' ? st * 2 : 0), 24, 3, 1, 'P');
    // torso
    if (o.robe) { tri(g, 3, 23, 14, 23, 8, 9, 'c'); rect(g, 5, 9, 7, 9, 'c'); rect(g, 5, 9, 1, 14, 'C'); rect(g, 5, 15, 7, 1, 'y'); }
    else { rect(g, 5, 9, 7, 8, 'c'); rect(g, 5, 9, 1, 8, 'C'); rect(g, 8, 11, 3, 1, 'n'); rect(g, 5, 16, 7, 1, 'b'); }
    // arms
    if (at) { line(g, 11, 11, 15, 9, 'c', 2); o.cast(g, 16, 7, i); }
    else if (hu) { line(g, 11, 11, 14, 7, 'c', 2); line(g, 5, 11, 2, 8, 'c', 2); }
    else { rect(g, 11, 10, 2, 5, 'c'); rect(g, 11, 15, 2, 1, 's'); if (o.wand) line(g, 12, 15, 15, 12, 'u'); }
    rect(g, 4, 10, 2, 5, 'c'); rect(g, 4, 11, 2, 2, o.robe ? 'y' : 'a'); rect(g, 4, 15, 2, 1, 's');
    // head with long pointed ear
    rect(g, 7, 7, 3, 2, 's');
    oval(g, 9, 4, 3.5, 3.5, 's');
    tri(g, 6, 3, 2, 0, 6, 6, 's');
    rect(g, 6, 0, 6, 2, 'h'); rect(g, 5, 1, 2, 5, 'h'); if (o.long) { rect(g, 5, 5, 2, 5, 'h'); }
    if (hu) rect(g, 10, 3, 2, 1, 'e'); else { rect(g, 10, 3, 2, 2, 'w'); px(g, 11, 3, 'e'); px(g, 11, 4, 'e'); }
    rect(g, 10, 6, 2, 1, 'm');
  }
  var ELFP = { s: C.n3, S: C.n2, h: C.y0, w: C.W, e: C.K, m: C.o0, c: C.g0, C: C.K, a: C.y2, n: C.W, b: C.y0, p: C.y0, P: C.K, o: C.p0, O: C.m0, q: C.p2 };
  penemy('city_elf', K.merge(ELFP, { c: '#787878', C: C.g0, p: C.c0 }), 22, 26, 2, function (g, pose, i) {
    elf(g, pose, i, { cast: function (g2, x, y) { K.oval(g2, x + 2, y + 1, 3, 3, 'o'); px(g2, x + 1, y, 'q'); px(g2, x + 3, y + 2, 'O'); px(g2, x + 5, y - 2, 'q'); px(g2, x, y + 4, 'q'); } });
  });
  // Wand Bearers of the Apito Education Center (Salvatore / Carmine look): oak-green robes, long hair, wands
  penemy('wand_bearer', K.merge(ELFP, { c: C.l0, C: C.G0, y: C.y2, h: C.p0, u: C.y1, z: C.l3, Z: C.W }), 22, 26, 2, function (g, pose, i) {
    elf(g, pose, i, { robe: true, wand: true, long: true, cast: function (g2, x, y) { line(g2, x - 2, y + 3, x + 1, y, 'u'); px(g2, x + 2, y - 1, 'Z'); px(g2, x + 3, y - 2, 'z'); px(g2, x + 1, y - 2, 'z'); px(g2, x + 3, y, 'z'); px(g2, x + 4, y - 1, 'Z'); } });
  });
  K.elf = elf; K.ELFP = ELFP;

  // ---- Krasue (L16): a floating woman's head, long black hair, her organs dangling beneath: heart, lungs,
  //      stomach, a rope of intestines, dripping. Ghost-class. ----
  function krasue(g, pose, i, ox, oy) {
    ox = ox || 0; oy = oy || 0;
    var at = pose === 'attack', hu = pose === 'hurt', sw = pose === 'walk' ? (i ? 1 : -1) : at ? -2 : 0;
    function L(pts, c, th) { poly(g, pts.map(function (q) { return [q[0] + ox, q[1] + oy]; }), c, th); }
    // trailing organs (behind the head)
    L([[9, 12], [8 + sw, 16], [10 + sw, 19], [9 + sw * 2, 23], [11 + sw * 2, 27], [10 + sw * 2, 30]], 'i', 2);   // intestines
    L([[12, 12], [13 - sw, 17], [12 - sw, 21]], 'v', 1);                                                         // arteries
    oval(g, 8 + sw + ox, 15 + oy, 2.5, 3, 'l'); oval(g, 12 + sw + ox, 15 + oy, 2.5, 3, 'l'); px(g, 8 + sw + ox, 14 + oy, 'L');   // lungs
    oval(g, 10 + sw + ox, 17 + oy, 2, 2, 'r'); px(g, 10 + sw + ox, 16 + oy, 'R');                               // heart
    oval(g, 13 - sw + ox, 21 + oy, 2.5, 2, 'o'); px(g, 12 - sw + ox, 21 + oy, 'O');                             // stomach
    px(g, 9 + sw * 2 + ox, 31 + oy + i, 'R'); px(g, 13 - sw + ox, 24 + oy - i, 'R');                            // drips
    // the head: long black hair streaming, pale face
    oval(g, 10 + ox, 7 + oy, 5, 5.5, 'h');
    L([[6, 5], [3, 9 + i], [2, 14 + i]], 'h', 2); L([[7, 9], [5, 13], [5, 17 - i]], 'H', 1);
    if (at) { L([[13, 3], [17, 1]], 'h', 1); L([[6, 3], [2, 1]], 'h', 1); }
    oval(g, 11 + ox, 7 + oy, 3.5, 4, 's'); px(g, 14 + ox, 7 + oy, 's'); rect(g, 9 + ox, 2 + oy, 6, 2, 'h');
    if (hu) { rect(g, 11 + ox, 6 + oy, 2, 1, 'e'); rect(g, 14 + ox, 6 + oy, 1, 1, 'e'); }
    else { rect(g, 11 + ox, 5 + oy, 2, 2, 'w'); px(g, 12 + ox, 6 + oy, 'e'); rect(g, 14 + ox, 5 + oy, 1, 2, 'w'); }
    if (at) { rect(g, 11 + ox, 9 + oy, 4, 2, 'm'); px(g, 11 + ox, 9 + oy, 'w'); px(g, 14 + ox, 9 + oy, 'w'); px(g, 12 + ox, 11 + oy, 'w'); }
    else { rect(g, 12 + ox, 9 + oy, 2, 1, 'm'); px(g, 12 + ox, 10 + oy, 'R'); }
  }
  var KRP = { h: C.p0, H: C.K, s: C.g2, S: C.g1, w: C.W, e: C.o1, m: C.r0, i: C.r3, I: C.r2, l: C.m3, L: C.m2, r: C.r0, R: C.r1, o: C.r2, O: C.r0, v: C.r1 };
  penemy('krasue', KRP, 22, 34, 2, function (g, pose, i) { krasue(g, pose, i, 2, 1); });
  K.krasue = krasue; K.KRP = KRP;

  // ---- Shadow Leak (L14): smoke-like ghost, stinging cold; ghost-class ----
  penemy('shadow_leak', { d: C.p0, D: C.b1, s: C.g0, e: C.b6, E: C.W, c: C.b4 }, 20, 22, 2, function (g, pose, i) {
    var at = pose === 'attack', hu = pose === 'hurt', lean = at ? 3 : 0;
    oval(g, 10 + lean, 8, 6, 6, 'd');
    for (var k = 0; k < 5; k++) { var x0 = 5 + k * 2 + lean, w = (k + i) % 2; poly(g, [[x0, 12], [x0 - 1 - w, 16], [x0 + w, 19], [x0 - 2, 21 - w]], k % 2 ? 'D' : 'd', 2); }
    dots(g, 0, 0, 20, 22, 'd', 's', function (x, y) { return (x * 5 + y * 3 + i * 2) % 11 === 0; });
    rect(g, 9 + lean, 6, 2, 2, hu ? 'E' : 'e'); rect(g, 13 + lean, 6, 2, 2, hu ? 'E' : 'e'); px(g, 10 + lean, 7, 'E'); px(g, 14 + lean, 7, 'E');
    if (at) { rect(g, 10 + lean, 10, 4, 1, 'D'); px(g, 18, 6, 'c'); px(g, 19, 9, 'c'); px(g, 18, 12, 'E'); line(g, 15, 9, 18, 9, 'd', 2); }
  });

  // ---- Incubus (night streets): gray skin, horns, bat wings, barbed tail; charms (flips your left/right) ----
  penemy('incubus', { s: C.g1, S: C.g0, h: C.p0, r: C.r0, R: C.r1, v: C.p0, V: C.m0, c: C.o0, C: C.r0, p: C.K, P: C.y0, w: C.W, e: C.m2, m: C.g0, H: C.m2 }, 30, 32, 2, function (g, pose, i) {
    var at = pose === 'attack', st = pose === 'walk' ? (i ? 1 : -1) : 0, f = pose === 'walk' ? i : at ? 1 : 0;
    tri(g, 9, 12, 0, 2 + f * 2, 4, 15, 'v'); tri(g, 9, 12, 4, 15, 7, 19, 'v'); line(g, 9, 12, 1, 3 + f * 2, 'V'); line(g, 9, 13, 5, 15, 'V');
    poly(g, [[10, 22], [5, 25], [4, 29]], 'v', 1); tri(g, 3, 29, 6, 29, 4, 31, 'r');
    line(g, 11, 22, 11 + st * 2, 30, 'p', 3); line(g, 15, 22, 15 - st * 2, 30, 'p', 3); rect(g, 10 + st * 2, 30, 4, 1, 'P'); rect(g, 14 - st * 2, 30, 4, 1, 'P');
    rect(g, 10, 12, 8, 10, 'c'); rect(g, 12, 12, 4, 7, 's'); rect(g, 13, 14, 2, 1, 'S'); rect(g, 10, 12, 1, 10, 'C');     // shirt open to the waist
    if (at) { line(g, 18, 13, 22, 9, 's', 2); px(g, 23, 7, 'H'); px(g, 25, 7, 'H'); rect(g, 23, 8, 3, 1, 'H'); px(g, 24, 9, 'H'); px(g, 27, 4, 'H'); px(g, 26, 5, 'H'); }
    else { rect(g, 18, 13, 2, 6, 'c'); rect(g, 18, 19, 2, 2, 's'); }
    rect(g, 8, 13, 2, 6, 'c'); rect(g, 8, 19, 2, 2, 's');
    rect(g, 12, 9, 3, 3, 's'); oval(g, 14, 6, 4, 4.5, 's');
    rect(g, 10, 1, 8, 3, 'h'); rect(g, 10, 2, 2, 6, 'h'); tri(g, 13, 1, 15, 1, 14, -2, 'r'); tri(g, 17, 2, 19, 2, 19, -1, 'r');
    rect(g, 16, 5, 2, 2, 'w'); px(g, 17, 5, 'e'); px(g, 17, 6, 'e'); line(g, 15, 4, 18, 4, 'h');
    rect(g, 15, 9, 3, 1, at ? 'R' : 'm'); px(g, 19, 7, 'S');
  });

  // ---- Ruin Flocker (escape swarm, original design): ragged feathered ruin bats ----
  penemy('ruin_flocker', { f: C.y0, F: C.n0, g: C.g0, e: C.o1, E: C.y2, w: C.W, t: C.y1 }, 26, 18, 2, function (g, pose, i) {
    var at = pose === 'attack', up = pose === 'walk' ? i === 0 : at ? false : true;
    oval(g, 13, 9, 4, 3.5, 'f'); px(g, 11, 7, 'g'); px(g, 14, 11, 'g');
    var wy = up ? -6 : 5;
    tri(g, 10, 8, 0, 8 + wy, 4, 11, 'F'); tri(g, 16, 8, 26, 8 + wy, 22, 11, 'F');
    for (var k = 0; k < 4; k++) { px(g, 2 + k * 2, 8 + wy + (up ? k : -k) + (k % 2), 'g'); px(g, 24 - k * 2, 8 + wy + (up ? k : -k) + (k % 2), 'g'); }
    tri(g, 10, 9, 5, 9 + wy * 0.5, 7, 12, 'f'); tri(g, 16, 9, 21, 9 + wy * 0.5, 19, 12, 'f');
    rect(g, 15, 7, 2, 2, 'e'); px(g, 16, 7, 'E'); px(g, 18, 8, 't'); px(g, 18, 9, 't'); px(g, 12, 5, 'f'); px(g, 14, 5, 'f');
    if (at) { line(g, 12, 12, 11, 16, 't'); line(g, 14, 12, 15, 16, 't'); px(g, 10, 16, 'w'); px(g, 16, 16, 'w'); }
    else { px(g, 12, 13, 't'); px(g, 14, 13, 't'); }
  });

  // ---- Village Guard Swordsman (L75): tall, bulky, plate armour head to toe, long steel blade ----
  penemy('guard', { a: C.g1, A: C.g0, x: C.W, d: C.g3, s: C.g2, S: C.g1, b: C.y0, B: C.y1, r: C.r0, h: C.o1 }, 34, 40, 2, function (g, pose, i) {
    var at = pose === 'attack', hu = pose === 'hurt', st = pose === 'walk' ? (i ? 1 : -1) : 0;
    // legs (greaves)
    rect(g, 10 + st, 27, 5, 11, 'a'); rect(g, 17 - st, 27, 5, 11, 'A'); rect(g, 9 + st, 37, 7, 2, 'd'); rect(g, 16 - st, 37, 7, 2, 'd');
    rect(g, 10 + st, 30, 5, 1, 'x'); rect(g, 17 - st, 30, 5, 1, 'A');
    // tabard over the breastplate
    rect(g, 8, 13, 16, 15, 'a'); rect(g, 8, 13, 2, 15, 'A'); rect(g, 13, 15, 6, 13, 'r'); rect(g, 15, 17, 2, 5, 'B'); rect(g, 14, 18, 4, 1, 'B');
    rect(g, 8, 26, 16, 2, 'b');
    // pauldrons
    oval(g, 8, 14, 3, 2.5, 'a'); oval(g, 24, 14, 3, 2.5, 'a'); px(g, 7, 13, 'x'); px(g, 23, 13, 'x');
    // sword arm
    if (at) { line(g, 24, 15, 28, 12, 'a', 3); line(g, 28, 11, 33, 0, 's', 2); line(g, 26, 13, 31, 12, 'B', 1); }
    else { rect(g, 24, 15, 4, 7, 'a'); rect(g, 24, 22, 4, 3, 'A'); line(g, 26, 25, 26, 38, 's', 2); rect(g, 24, 24, 6, 1, 'B'); px(g, 26, 38, 'S'); }
    rect(g, 5, 15, 4, 8, 'A'); rect(g, 5, 23, 4, 3, 'A');
    // great helm with visor slit and plume
    rect(g, 11, 2, 10, 11, 'a'); rect(g, 11, 2, 2, 11, 'A'); rect(g, 14, 6, 7, 1, 'k'); rect(g, 17, 8, 1, 3, 'k'); rect(g, 19, 8, 1, 3, 'k');
    rect(g, 12, 1, 8, 1, 'x'); poly(g, [[16, 1], [13, -1], [9, 1]], 'h', 2);
    if (hu) { px(g, 16, 6, 'x'); px(g, 18, 6, 'x'); }
  });

  // ---- citizens of the guarded streets (1 hp, hurting one is a crime) ----
  penemy('citizen_human', { s: C.n3, S: C.n2, h: C.n0, w: C.W, e: C.K, m: C.o0, c: C.b5, C: C.b1, a: C.n3, p: C.y0, P: C.K, b: C.y1 }, 18, 26, 2, function (g, pose, i) {
    var at = pose === 'attack', hu = pose === 'hurt', st = pose === 'walk' ? (i ? 1 : -1) : 0;
    line(g, 7, 17, 7 + st * 2, 24, 'p', 2); line(g, 10, 17, 10 - st * 2, 24, 'p', 2); rect(g, 6 + st * 2, 24, 3, 1, 'P'); rect(g, 10 - st * 2, 24, 3, 1, 'P');
    rect(g, 5, 9, 7, 9, 'c'); rect(g, 5, 9, 1, 9, 'C'); rect(g, 5, 16, 7, 1, 'b');
    if (at || hu) { line(g, 11, 10, 14, 5, 'c', 2); line(g, 5, 10, 2, 5, 'c', 2); px(g, 14, 4, 's'); px(g, 2, 4, 's'); }
    else { rect(g, 4, 10, 2, 5, 'c'); rect(g, 11, 10, 2, 5, 'c'); px(g, 4, 15, 's'); px(g, 12, 15, 's'); rect(g, 12, 13 - i, 3, 3, 'a'); }   // shopping basket
    rect(g, 7, 7, 3, 2, 's'); oval(g, 9, 4, 3.5, 3.5, 's'); rect(g, 6, 0, 6, 2, 'h'); rect(g, 5, 1, 2, 4, 'h');
    if (at || hu) { rect(g, 10, 2, 2, 3, 'w'); px(g, 11, 3, 'e'); rect(g, 10, 6, 2, 2, 'm'); }
    else { rect(g, 10, 3, 2, 2, 'w'); px(g, 11, 3, 'e'); px(g, 11, 4, 'e'); rect(g, 10, 6, 2, 1, 'm'); }
  });
  var CFOWL = { f: C.y1, F: C.y0, h: C.n3, H: C.n2, b: C.y2, B: C.y1, e: C.K, w: C.W, c: C.r2, C: C.r0, t: C.y2, T: C.W, z: C.W, G: C.y1 };
  penemy('citizen_skyfowl', CFOWL, 22, 30, 2, function (g, pose, i) { fowl(g, 1, { ox: 1, oy: 2, pose: pose === 'walk' ? (i ? 'walk1' : 'walk0') : pose === 'attack' ? 'attack' : 'idle', open: pose !== 'walk', blink: pose === 'hurt' }); });
  penemy('chickadee', K.merge(CFOWL, { h: C.g2, H: C.K, f: C.g0, F: C.K, c: C.n3, C: C.n2, b: C.K, B: C.g0, t: C.n2 }), 16, 20, 2, function (g, pose, i) {
    fowl(g, 0.62, { ox: 1, oy: 2, pose: pose === 'walk' ? (i ? 'walk1' : 'walk0') : pose === 'attack' ? 'attack' : 'idle', open: pose !== 'walk', blink: pose === 'hurt' });
    rect(g, 7, 3, 4, 1, 'H'); px(g, 6, 4, 'H');
  });
})();


/* ================================================================== *
 *  BOSSES - painted on char grids with integer primitives, then outlined.
 *  <id>_idle(2) _walk(2) _attack _hurt _special ; draw(g, p) with p = { a: pose, i: frame }
 * ================================================================== */
(function () {
  'use strict';
  var DCW = window.DCW, K = DCW.artActorsKit, C = K.C;
  var rect = K.rect, px = K.px, oval = K.oval, line = K.line, tri = K.tri, poly = K.poly, dots = K.dots, stamp = K.stamp;
  var boss = K.boss, def = K.def, withK = K.withK, outlined = K.outlined, blank = K.blank;

  /* ---- HEATHER THE BEAR (L19 neighborhood boss): eight-foot black bear on roller skates, a flaming skull for a
   *      face with round red eyes, a tattered pink clown hat cockeyed on the skull, a pleated ruff, a pink tutu,
   *      and front paws replaced by dozens of glowing white worms ---- */
  var HP = { f: C.K, F: C.b1, G: C.g0, h: C.K, d: C.K, s: C.W, S: C.g1, r: C.r1, R: C.o1, o: C.o1, y: C.y2, Y: C.y3, p: C.m2, P: C.m1, q: C.m3, w: C.W, W: C.g1, z: C.W, Z: C.t3, b: C.o3, B: C.n2, x: C.r1, X: C.g1, t: C.y1 };
  function heather(g, p) {
    var a = p.a, i = p.i;
    var lean = a === 'attack' ? 4 : a === 'hurt' ? -3 : a === 'walk' ? 2 : 0;
    var dy = a === 'special' ? 4 : 0;               // crouched for the jump slam
    var st = a === 'walk' ? (i ? 1 : -1) : 0;
    // ---- skates + legs ----
    function leg(x0, y0, x1, back) {
      line(g, x0, y0 + dy, x1, 48, back ? 'h' : 'f', 6);
      rect(g, x1 - 4, 47, 10, 6, 'b'); rect(g, x1 - 4, 47, 10, 1, 'B'); rect(g, x1 + 3, 49, 3, 4, 'b'); px(g, x1 - 1, 49, 'B'); px(g, x1 + 1, 49, 'B'); // boot + laces
      rect(g, x1 - 5, 53, 12, 1, 'X');
      [x1 - 3, x1 + 1, x1 + 5].forEach(function (wx) { oval(g, wx, 55, 1.5, 1.5, 'x'); px(g, wx, 55, 'w'); });
    }
    leg(22, 38, 20 - st * 5, true); leg(32, 38, 34 + st * 5, false);
    // ---- body ----
    oval(g, 27 + lean * 0.5, 27 + dy, 15, 13, 'f');
    // tutu: tattered pink frills
    var ty = 37 + dy;
    oval(g, 27 + lean * 0.5, ty, 17, 4, 'p'); for (var k = 0; k < 9; k++) { tri(g, 10 + k * 4 + lean * 0.5, ty + 1, 14 + k * 4 + lean * 0.5, ty + 1, 12 + k * 4 + lean * 0.5, ty + 5 + (k % 2), k % 2 ? 'P' : 'q'); }
    // ---- worm arms ----
    function worms(x0, y0, dx, dy2, n, spread) {
      for (var w = 0; w < n; w++) {
        var ang = Math.atan2(dy2, dx) + (w - (n - 1) / 2) * spread, len = Math.sqrt(dx * dx + dy2 * dy2) * (0.7 + ((w * 7) % 4) * 0.1);
        var pts = [], seg = 5;
        for (var q = 0; q <= seg; q++) { var t = q / seg, wob = Math.sin(t * 6 + w + i * 2) * 1.6 * t; pts.push([x0 + Math.cos(ang) * len * t - Math.sin(ang) * wob, y0 + Math.sin(ang) * len * t + Math.cos(ang) * wob]); }
        poly(g, pts, w % 3 ? 'z' : 'Z', 1);
        px(g, pts[seg][0], pts[seg][1], 'Z');
      }
    }
    var sx = 36 + lean, sy = 20 + dy;
    if (a === 'attack') { line(g, sx - 4, sy, sx + 6, sy + 2, 'f', 6); worms(sx + 8, sy + 2, 18, 0, 9, 0.13); }
    else if (a === 'special') { line(g, sx - 4, sy, sx + 2, sy - 10, 'f', 6); worms(sx + 2, sy - 12, 4, -12, 9, 0.22); line(g, 16, sy, 10, sy - 10, 'h', 5); worms(10, sy - 12, -4, -12, 7, 0.22); }
    else if (a === 'hurt') { line(g, sx - 4, sy, sx + 4, sy - 8, 'f', 6); worms(sx + 4, sy - 9, 8, -8, 7, 0.25); }
    else { line(g, sx - 4, sy, sx + 4, sy + 8, 'f', 6); worms(sx + 5, sy + 10, 9, 4 + i * 2, 8, 0.2); }
    line(g, 16, 22 + dy, 12, 31 + dy, 'h', 5); if (a !== 'special') worms(12, 33 + dy, 4, 6, 5, 0.3);
    // ---- black fur: rim light (gray on top edges, dark blue on the sides) so she reads against dark backgrounds ----
    var W = g[0].length, Hh = g.length, fur = function (c) { return c === 'f' || c === 'h'; }, tr = function (x, y) { return y < 0 || y >= Hh || x < 0 || x >= W || K.T(g[y][x]); };
    var rim = [];
    for (var y = 0; y < Hh; y++) for (var x = 0; x < W; x++) if (fur(g[y][x])) {
      if (tr(x, y - 1)) rim.push([x, y, 'G']); else if (tr(x - 1, y) || tr(x + 1, y)) rim.push([x, y, 'F']);
      else if ((x * 5 + y * 3) % 11 === 0) rim.push([x, y, 'F']);
    }
    rim.forEach(function (r) { g[r[1]][r[0]] = r[2]; });
    // ---- ruff ----
    var hx = 37 + lean, hy = 8 + dy;
    for (k = 0; k < 8; k++) { tri(g, hx - 13 + k * 3, hy + 13, hx - 10 + k * 3, hy + 13, hx - 11 + k * 3, hy + 18, k % 2 ? 'w' : 'W'); }
    rect(g, hx - 13, hy + 12, 23, 2, 'w');
    // ---- flames wreathing the skull (behind it), flickering between frames ----
    var fl = [[-9, 9, 5], [-9, 3, 6], [-6, -1, 7], [-2, -3, 7], [2, -3, 6], [6, -1, 5], [-10, 13, 4]];
    fl.forEach(function (f, n) {
      var h = f[2] + ((n + i) % 2) * 2, sway = ((n + i) % 3) - 1;
      tri(g, hx + f[0] - 3, hy + f[1] + 3, hx + f[0] + 3, hy + f[1] + 3, hx + f[0] + sway, hy + f[1] - h + 3, n % 2 ? 'o' : 'y');
      tri(g, hx + f[0] - 1, hy + f[1] + 3, hx + f[0] + 1, hy + f[1] + 3, hx + f[0] + sway, hy + f[1] - h + 6, 'Y');
    });
    // ---- small round black ears ----
    oval(g, hx - 5, hy + 1, 2, 2, 'f'); px(g, hx - 5, hy, 'G'); px(g, hx - 5, hy + 1, 'F');
    oval(g, hx + 2, hy, 2, 2, 'f'); px(g, hx + 2, hy - 1, 'G'); px(g, hx + 2, hy, 'F');
    // ---- bear skull: round cranium, deep eye socket with a red ember, short heavy muzzle, teeth ----
    oval(g, hx - 1, hy + 7, 6.5, 6, 's');
    rect(g, hx + 3, hy + 6, 7, 6, 's'); rect(g, hx + 9, hy + 7, 1, 4, 'S');
    px(g, hx - 5, hy + 9, 'S'); px(g, hx - 6, hy + 6, 'S'); px(g, hx - 2, hy + 12, 'S'); line(g, hx - 3, hy + 2, hx - 1, hy + 4, 'S');   // sutures
    oval(g, hx + 1, hy + 6, 2.3, 2.3, 'd');                                                                // eye socket
    if (a === 'hurt') px(g, hx + 1, hy + 6, 'Y'); else { rect(g, hx + 1, hy + 6, 2, 1, 'r'); px(g, hx + 1, hy + 5, 'R'); }
    rect(g, hx + 8, hy + 6, 2, 2, 'd'); px(g, hx + 7, hy + 7, 'd');                                        // nasal cavity at the muzzle tip
    var open = a === 'attack' || a === 'special' ? 2 : 0;
    rect(g, hx + 3, hy + 11, 7, 1, 'd');                                                                   // mouth line
    for (k = 0; k < 4; k++) px(g, hx + 3 + k * 2, hy + 11, 'w');                                          // upper teeth
    rect(g, hx + 2, hy + 12 + open, 7, 2, 's'); rect(g, hx + 2, hy + 12 + open, 7, 1, 'S');                // lower jaw
    if (open) { rect(g, hx + 3, hy + 12, 6, open, 'd'); for (k = 0; k < 3; k++) px(g, hx + 4 + k * 2, hy + 12 + open - 1, 'w'); px(g, hx + 9, hy + 12, 'w'); }
    // ---- tattered pink clown hat, cockeyed over one ear ----
    tri(g, hx - 9, hy + 2, hx - 4, hy, hx - 11, hy - 6, 'p'); line(g, hx - 9, hy + 2, hx - 4, hy, 'P'); px(g, hx - 8, hy - 1, 'q');
    oval(g, hx - 11, hy - 6, 1.5, 1.5, 'w');
  }
  boss('heather', HP, 64, 58, heather);

  /* ---- VINCENTE: City Elf of the 201st with a burning hand and a Meat Hooks scroll's chains ---- */
  var VP = { s: C.n3, S: C.n2, h: C.y0, H: C.n0, w: C.W, e: C.K, m: C.o0, c: '#787878', C: C.g0, a: C.y2, n: C.W, b: C.y0, p: C.c0, P: C.K, x: C.g1, X: C.W, o: C.o1, y: C.y2, Y: C.y3, d: C.p0, D: C.m0, q: C.p2 };
  function vincente(g, p) {
    var a = p.a, i = p.i;
    var st = a === 'walk' ? (i ? 2 : -2) : 0, lean = a === 'attack' ? 2 : a === 'hurt' ? -2 : 0;
    // legs
    line(g, 15, 28, 14 + st, 40, 'p', 4); line(g, 21, 28, 22 - st, 40, 'p', 4);
    rect(g, 12 + st, 40, 6, 2, 'P'); rect(g, 20 - st, 40, 6, 2, 'P');
    // torso: black militia shirt, hand-sewn arm patch, name patch, belt
    rect(g, 12 + lean, 15, 13, 14, 'c'); rect(g, 12 + lean, 15, 2, 14, 'C'); rect(g, 18 + lean, 18, 5, 2, 'n'); px(g, 19 + lean, 18, 'C'); px(g, 21 + lean, 18, 'C');
    rect(g, 12 + lean, 27, 13, 2, 'b'); px(g, 18 + lean, 27, 'a');
    // left arm: meat hook chain coiled / thrown
    rect(g, 9 + lean, 16, 3, 8, 'c'); rect(g, 9 + lean, 18, 3, 3, 'a');
    if (a === 'attack') { // the hook flies out on its chain
      line(g, 11, 23, 30, 22, 'x', 1); for (var k = 12; k < 30; k += 3) px(g, k, 22 + (k % 2), 'X');
      poly(g, [[30, 22], [34, 22], [35, 25], [33, 28], [31, 26]], 'X', 1); px(g, 34, 27, 'x');
      rect(g, 10, 24, 3, 2, 's');
    } else {
      rect(g, 9 + lean, 24, 3, 2, 's');
      poly(g, [[10 + lean, 26], [8 + lean, 30], [10 + lean, 33 + i], [8 + lean, 35 + i]], 'x', 1);
      poly(g, [[8 + lean, 35 + i], [6 + lean, 36 + i], [6 + lean, 33 + i]], 'X', 1);
    }
    // right arm: the burning hand
    var fx = a === 'special' ? 22 : 27 + lean, fy = a === 'special' ? 2 : a === 'hurt' ? 11 : 20;
    line(g, 24 + lean, 17, fx, fy + 2, 'c', 3); rect(g, fx - 1, fy, 3, 3, 's');
    var fh = 4 + (i % 2) * 2;
    tri(g, fx - 3, fy + 1, fx + 3, fy + 1, fx + (i ? 1 : -1), fy - fh, 'o'); tri(g, fx - 1, fy + 1, fx + 2, fy + 1, fx, fy - fh + 2, 'y'); px(g, fx, fy - 1, 'Y');
    if (a === 'special') { oval(g, fx, fy - 9, 5, 5, 'd'); oval(g, fx - 1, fy - 10, 2, 2, 'D'); px(g, fx + 3, fy - 13, 'q'); px(g, fx - 4, fy - 6, 'q'); }
    // head
    rect(g, 16 + lean, 12, 5, 3, 's');
    oval(g, 19 + lean, 7, 5.5, 5.5, 's');
    tri(g, 14 + lean, 6, 8 + lean, 1, 15 + lean, 10, 's'); px(g, 11 + lean, 4, 'S');
    rect(g, 14 + lean, 1, 11, 3, 'h'); rect(g, 13 + lean, 2, 3, 6, 'h'); px(g, 24 + lean, 4, 'h');
    if (a === 'hurt') { line(g, 20 + lean, 6, 22 + lean, 8, 'e'); line(g, 22 + lean, 6, 20 + lean, 8, 'e'); }
    else { rect(g, 21 + lean, 6, 2, 2, 'w'); px(g, 22 + lean, 6, 'e'); px(g, 22 + lean, 7, 'e'); line(g, 20 + lean, 5, 23 + lean, 5, 'h'); }
    rect(g, 21 + lean, 10, 3, 1, 'm'); if (a === 'attack' || a === 'special') px(g, 22 + lean, 11, 'm');
    px(g, 24 + lean, 8, 'S');
  }
  boss('vincente', VP, 38, 42, vincente);

  /* ---- TERROR (big): a giant Terror the Clown miniboss, same anatomy as the stilt clowns, scaled up ---- */
  boss('terror_big', K.TERP, 36, 70, function (g, p) {
    var a = p.a, pose = a === 'idle' ? 'idle' : a;
    K.terror(g, pose === 'idle' ? 'walk' : pose, a === 'idle' ? 0 : p.i, 1.48);
    if (a === 'idle' && p.i) { rect(g, 17, 12, 7, 1, 'm'); }
    if (a === 'special') { // the jaw unhinges, tongue lashes
      rect(g, 17, 11, 9, 7, 'm'); for (var k = 0; k < 9; k += 2) { px(g, 17 + k, 11, 'w'); px(g, 17 + k, 17, 'w'); }
      poly(g, [[22, 15], [28, 18], [32, 16], [35, 18]], 'R', 2); px(g, 35, 15, 'R');
    }
  });

  /* ---- THE DISPENSER: a building-sized manta ray that blends into the wall. Drawn in pieces so the facade
   *      stage can reveal parts one at a time. Body is wall-coloured with a soft dark-brown edge (no black
   *      outline) so it can sit faint over the building front. Layout (offsets from the body's top-left) is in
   *      DCW.artActorsKit.dispenserLayout. ---- */
  var DSP = { k: C.y0, a: C.g1, A: C.g0, b: C.o3, B: C.n2, m: C.y1, M: C.y0, l: C.g2, e: C.y2, E: C.o1, x: C.K, w: C.W, r: C.r0, R: C.r1, g: C.t3, G: C.c1, t: C.y3 };
  var BW = 140, BH = 60;
  function mantaBody(g, i, sc, ox, oy) { // sc: scale (1 = full 140x60 body)
    sc = sc || 1; ox = ox || 0; oy = oy || 0;
    function X(v) { return Math.round(v * sc) + ox; } function Y(v) { return Math.round(v * sc) + oy; }
    var cx = 70, ri = i ? 1 : 0;
    // wings: a wide diamond, wing tips curling back a little
    tri(g, X(cx), Y(6), X(2), Y(30 + ri), X(cx), Y(50), 'a');
    tri(g, X(cx), Y(6), X(138), Y(30 + ri), X(cx), Y(50), 'a');
    tri(g, X(2), Y(30 + ri), X(14), Y(26), X(16), Y(36), 'A'); tri(g, X(138), Y(30 + ri), X(126), Y(26), X(124), Y(36), 'A');
    // body ridge + tail
    oval(g, X(cx), Y(28), 22 * sc, 20 * sc, 'a');
    rect(g, X(cx - 1), Y(46), Math.max(1, Math.round(3 * sc)), Math.round(14 * sc), 'A');
    // cephalic fins (the "horns" at the front, top)
    tri(g, X(cx - 16), Y(10), X(cx - 8), Y(4), X(cx - 20), Y(0), 'a'); tri(g, X(cx + 16), Y(10), X(cx + 8), Y(4), X(cx + 20), Y(0), 'a');
    // wall camouflage: brick courses + mortar and grime, so a faint body reads as part of the building
    for (var y = 0; y < g.length; y++) for (var x = 0; x < g[0].length; x++) {
      if (g[y][x] !== 'a') continue;
      var ly = Math.round((y - oy) / sc), lx = Math.round((x - ox) / sc);
      var row = Math.floor(ly / 5), off = (row % 2) * 6;
      if (ly % 5 === 0) g[y][x] = 'A';
      else if ((lx + off) % 12 === 0) g[y][x] = 'A';
      else if (((lx * 7 + ly * 13) % 23) === 0) g[y][x] = 'b';
      else if (((lx * 5 + ly * 3 + row) % 29) === 0) g[y][x] = 'B';
    }
    // gill slits (wall cracks) under the head
    for (var k = 0; k < 4; k++) { line(g, X(cx - 14 + k * 3), Y(32), X(cx - 15 + k * 3), Y(36), 'M'); line(g, X(cx + 14 - k * 3), Y(32), X(cx + 15 - k * 3), Y(36), 'M'); }
  }
  function camo(g) { return outlined(g, 'k'); }
  var body = [0, 1].map(function (i) { var g = blank(BW, BH + 2); mantaBody(g, i, 1, 0, 1); return camo(g); });
  def('dispenser_body', DSP, body);
  // eye: a big glaring eye set in the wall (frame 0 open, slit pupil; frame 1 narrowed / blinking)
  def('dispenser_eye', withK(DSP), [0, 1].map(function (i) {
    var g = blank(14, 12);
    oval(g, 7, 6, 6, 4.5, 'm'); oval(g, 7, 6, 5, 3.5, i ? 'M' : 'e'); if (!i) { rect(g, 7, 3, 1, 6, 'x'); px(g, 5, 4, 'w'); px(g, 9, 7, 'E'); } else { rect(g, 2, 6, 11, 1, 'x'); px(g, 7, 5, 'E'); }
    return outlined(g);
  }));
  // mouth: a long slit (closed) / a gaping maw with gill rakers and a ring of teeth (open)
  def('dispenser_mouth', withK(DSP), [0, 1].map(function (i) {
    var g = blank(32, 16);
    if (!i) { oval(g, 16, 8, 14, 3, 'm'); rect(g, 3, 8, 26, 1, 'x'); px(g, 3, 7, 'M'); px(g, 28, 7, 'M'); }
    else { oval(g, 16, 8, 15, 7, 'm'); oval(g, 16, 8, 12, 5, 'r'); oval(g, 16, 9, 8, 3, 'x'); for (var k = 0; k < 11; k++) { px(g, 6 + k * 2, 4 + (k % 2), 'w'); px(g, 6 + k * 2, 12 - (k % 2), 'w'); } line(g, 11, 8, 21, 8, 'R'); }
    return outlined(g);
  }));
  // wing: the right wing tip peeling away from the wall (flip for the left), underside darker, ribbed
  def('dispenser_wing', withK(DSP), [(function () {
    var g = blank(60, 34);
    tri(g, 0, 2, 58, 18, 0, 32, 'a'); tri(g, 4, 20, 58, 18, 8, 31, 'B');
    for (var k = 0; k < 6; k++) line(g, 2, 6 + k * 4, 52, 18, k % 2 ? 'A' : 'b');
    line(g, 0, 2, 58, 18, 'l'); px(g, 57, 18, 'w');
    return outlined(g);
  })()]);
  K.dispenserLayout = { body: { w: BW, h: BH + 2 }, eyes: [[48, 14], [78, 14]], mouth: [54, 26], wings: [{ x: 78, y: 12, flip: false }, { x: 2, y: 12, flip: true }],
    note: 'offsets are top-left of each piece relative to the body top-left; the body has no black outline (k = dark brown) so it can be drawn faint over a wall' };
  // whole-manta poses (cinema / fallbacks), at half scale, pieces composited in
  boss('dispenser', DSP, 74, 36, function (g, p) {
    mantaBody(g, p.i || (p.a === 'walk' ? 1 : 0), 0.5, 2, 2);
    var op = p.a === 'attack' || p.a === 'special';
    oval(g, 28, 10, 3, 2, 'm'); oval(g, 46, 10, 3, 2, 'm'); rect(g, 28, 9, 1, 3, 'x'); rect(g, 46, 9, 1, 3, 'x'); px(g, 27, 9, 'e'); px(g, 45, 9, 'e');
    if (op) { oval(g, 37, 17, 7, 3, 'r'); oval(g, 37, 17, 4, 1.5, 'x'); for (var k = 0; k < 6; k++) px(g, 32 + k * 2, 15, 'w'); }
    else rect(g, 31, 17, 13, 1, 'x');
    if (p.a === 'special') { for (k = 0; k < 5; k++) px(g, 30 + k * 3, 23 + (k % 2) * 2, 'G'); }
  });
  defs_fix();
  function defs_fix() { // the whole-manta poses use the camouflage edge too (no hard black outline)
    ['idle', 'walk', 'attack', 'hurt', 'special'].forEach(function (a) { var d = DCW.artDefs['dispenser_' + a]; if (d) d.pal = K.merge(d.pal, { k: C.y0 }); });
  }
})();


/* ================================================================== *
 *  PORTRAITS 32x32, exactly 3 frames: 0 neutral, 1 mouth open, 2 blink.
 *  draw(g, f) paints the bust; E() / M() handle the eye and mouth states.
 * ================================================================== */
(function () {
  'use strict';
  var DCW = window.DCW, K = DCW.artActorsKit, C = K.C, T = K.T;
  var rect = K.rect, px = K.px, oval = K.oval, line = K.line, tri = K.tri, poly = K.poly, dots = K.dots, stamp = K.stamp;
  var def = K.def, withK = K.withK, outlined = K.outlined, blank = K.blank;

  var BG_HERO = ['#000000', '#004058'], BG_FOE = ['#000000', '#503000'], BG_NPC = ['#000000', '#0000bc'], BG_TV = ['#000000', '#940084'];
  function portrait(name, pal, bg, draw) {
    var frames = [0, 1, 2].map(function (f) {
      var g = blank(32, 32);
      draw(g, f);
      g = outlined(g);
      for (var y = 0; y < 32; y++) for (var x = 0; x < 32; x++) if (T(g[y][x])) g[y][x] = ((x + y) % 8 === 0 && y < 20) ? 'Z' : 'z';
      return g;
    });
    var P2 = withK(pal); P2.z = bg[0]; P2.Z = bg[1]; if (!P2.w) P2.w = C.W; if (!P2.K) P2.K = C.K; if (!P2.r) P2.r = C.r0;
    def(name, P2, frames);
  }
  // eye: white w x h with an iris block and a pupil; blink (f==2) paints the lid colour with a lash line
  function E(g, f, x, y, w, h, iris, lid, look) {
    if (f === 2) { rect(g, x, y, w, h, lid || 's'); rect(g, x, y + h - 1, w, 1, 'K'); return; }
    rect(g, x, y, w, h, 'w');
    var iw = Math.max(1, w - 1), ih = Math.max(1, h - 1), ix = look === 'l' ? x : x + w - iw;
    rect(g, ix, y + h - ih, iw, ih, iris || 'e'); px(g, look === 'l' ? ix : ix + iw - 1, y + h - 1, 'K');
  }
  // mouth: closed line, or (f==1) open with teeth on top and a tongue
  function M(g, f, x, y, w, c, teeth) {
    if (f === 1) { rect(g, x, y - 1, w, 3, 'K'); rect(g, x + 1, y + 1, Math.max(1, w - 2), 1, 'r'); if (teeth !== false) rect(g, x, y - 1, w, 1, 'w'); return; }
    rect(g, x, y, w, 1, c || 'm');
  }
  K.portrait3 = portrait; K.E = E; K.M = M;

  // ---- heroes ----
  portrait('p_carl', { s: '#fce0a8', S: '#fca044', h: '#503000', e: C.y0, m: C.n0, r: C.r0, j: '#881400', J: '#503000', t: '#007800', T: '#00a800', c: '#004058', C: '#008888', g: C.g1, G: C.g0 }, BG_HERO, function (g, f) {
    rect(g, 2, 25, 28, 7, 'c'); rect(g, 2, 25, 28, 1, 'C'); rect(g, 10, 25, 12, 7, 'j'); rect(g, 13, 25, 6, 7, 't'); px(g, 15, 28, 'T'); px(g, 17, 30, 'T');
    rect(g, 2, 27, 6, 5, 's'); rect(g, 2, 27, 1, 5, 'S'); rect(g, 26, 27, 4, 5, 'j');                        // the bare right shoulder
    line(g, 13, 25, 14, 31, 'J'); line(g, 18, 25, 17, 31, 'J'); rect(g, 22, 25, 2, 2, 'C');               // cloak clasp
    rect(g, 13, 21, 7, 5, 's');
    oval(g, 16, 14, 10, 10, 's');
    rect(g, 6, 3, 21, 6, 'h'); oval(g, 15, 6, 11, 4, 'h'); rect(g, 5, 7, 4, 7, 'h');
    px(g, 13, 9, 'h'); px(g, 19, 9, 'h'); px(g, 25, 8, 'h');
    rect(g, 4, 13, 3, 4, 'S'); px(g, 5, 14, 'K');
    line(g, 11, 11, 14, 11, 'h'); line(g, 18, 11, 21, 11, 'h');
    E(g, f, 12, 12, 2, 3, 'e', 's'); E(g, f, 19, 12, 2, 3, 'e', 's');
    rect(g, 22, 16, 2, 2, 'S');
    for (var x = 9; x < 25; x += 2) { px(g, x, 21, 'S'); px(g, x + 1, 22, 'S'); px(g, x, 23, 'S'); }
    M(g, f, 14, 20, 6, 'K'); if (f !== 1) px(g, 20, 19, 'K');
  });
  portrait('p_donut', { o: C.n3, O: C.n2, d: C.y0, w: C.W, e: C.y2, n: C.m2, y: C.y2, Y: C.y1, r: C.r1, m: C.n0, s: C.n3 }, BG_HERO, function (g, f) {
    oval(g, 16, 28, 14, 6, 'o'); oval(g, 16, 29, 7, 4, 'w'); oval(g, 6, 28, 4, 3, 'd');
    oval(g, 16, 17, 12, 10, 'o');
    oval(g, 9, 14, 6, 7, 'd');                                                                              // tortie mask over one eye
    tri(g, 4, 3, 10, 9, 4, 12, 'd'); tri(g, 28, 3, 22, 9, 28, 12, 'O'); tri(g, 5, 6, 8, 9, 5, 10, 'n'); tri(g, 27, 6, 24, 9, 27, 10, 'n');
    for (var k = 0; k < 6; k++) { px(g, 3 + k, 22 + k % 2, 'o'); px(g, 28 - k, 22 + k % 2, 'o'); }
    oval(g, 16, 22, 6, 4, 'w');
    E(g, f, 8, 14, 5, 4, 'e', 'd'); E(g, f, 19, 14, 5, 4, 'e', 'o');
    if (f !== 2) { rect(g, 8, 13, 5, 1, 'd'); rect(g, 19, 13, 5, 1, 'O'); }                                 // haughty lids
    rect(g, 15, 20, 3, 2, 'n'); line(g, 16, 22, 16, 23, 'K');
    if (f === 1) { rect(g, 14, 24, 5, 2, 'K'); rect(g, 15, 25, 3, 1, 'r'); } else { line(g, 13, 24, 15, 23, 'K'); line(g, 17, 23, 19, 24, 'K'); }
    line(g, 4, 20, 10, 21, 'w'); line(g, 22, 21, 28, 20, 'w');
    rect(g, 11, 5, 11, 3, 'y'); for (k = 0; k < 4; k++) { px(g, 11 + k * 3 + 1, 3, 'y'); px(g, 11 + k * 3 + 1, 4, 'y'); } px(g, 16, 2, 'y'); px(g, 16, 6, 'r'); rect(g, 11, 7, 11, 1, 'Y');
  });
  portrait('p_mongo', { p: C.m2, P: C.m3, q: C.m1, r: C.r1, R: C.r0, b: C.b4, e: C.K, m: C.r0, c: C.K, y: C.y2, s: C.b4 }, BG_HERO, function (g, f) {
    oval(g, 12, 28, 10, 7, 'p'); oval(g, 14, 30, 5, 3, 'P'); line(g, 4, 25, 18, 24, 'r', 2);
    rect(g, 8, 22, 9, 2, 'c'); px(g, 13, 24, 'y');                                                          // collar + tag
    oval(g, 13, 14, 10, 8, 'p'); rect(g, 15, 10, 16, 8, 'p');
    rect(g, 4, 5, 10, 3, 'r'); px(g, 3, 6, 'r'); rect(g, 6, 3, 6, 2, 'R');                                   // crest
    oval(g, 15, 11, 4, 3, 'b'); E(g, f, 14, 10, 3, 3, 'e', 'b');
    if (f === 1) { rect(g, 16, 18, 15, 5, 'K'); for (var x = 16; x < 31; x += 2) { px(g, x, 18, 'w'); px(g, x + 1, 22, 'w'); } px(g, 20, 18, 'y'); px(g, 26, 18, 'y'); rect(g, 18, 20, 8, 1, 'm'); }
    else { rect(g, 16, 18, 15, 2, 'm'); for (x = 17; x < 31; x += 2) { px(g, x, 18, 'w'); px(g, x + 1, 19, 'w'); } px(g, 21, 18, 'y'); }
    px(g, 29, 12, 'q'); px(g, 27, 12, 'q');
    for (x = 4; x < 13; x += 3) rect(g, x, 16, 2, 2, 'q');
  });
  portrait('p_mordecai', { s: C.g1, S: C.g0, h: C.p0, H: C.b1, r: C.r0, R: C.r1, e: C.m2, w: C.W, W: C.g1, m: C.g0, v: C.p0, V: C.m0, y: C.y2 }, BG_NPC, function (g, f) {
    tri(g, 0, 20, 6, 4, 9, 26, 'v'); tri(g, 31, 20, 25, 4, 22, 26, 'v'); line(g, 6, 5, 3, 22, 'V'); line(g, 25, 5, 28, 22, 'V');   // wings behind
    rect(g, 4, 25, 24, 7, 'w'); rect(g, 4, 25, 24, 1, 'W'); tri(g, 12, 25, 20, 25, 16, 31, 's'); px(g, 16, 28, 'K'); px(g, 16, 30, 'K');
    rect(g, 13, 20, 7, 6, 's');
    oval(g, 16, 13, 9, 10, 's');
    rect(g, 7, 2, 18, 6, 'h'); rect(g, 6, 5, 4, 10, 'h'); px(g, 24, 8, 'h'); px(g, 23, 8, 'h');
    poly(g, [[7, 13], [4, 18], [3, 24], [5, 30]], 'h', 3); px(g, 4, 20, 'H');                               // ponytail over the shoulder
    tri(g, 10, 4, 13, 4, 10, -1, 'r'); tri(g, 20, 4, 23, 4, 23, -1, 'r'); px(g, 11, 1, 'R'); px(g, 22, 1, 'R');   // horns
    line(g, 10, 10, 14, 11, 'h'); line(g, 18, 11, 22, 10, 'h');                                             // smouldering brows
    E(g, f, 11, 12, 3, 2, 'e', 's'); E(g, f, 18, 12, 3, 2, 'e', 's');
    rect(g, 16, 14, 2, 4, 'S'); M(g, f, 13, 20, 7, 'm');
    px(g, 25, 15, 'S'); px(g, 7, 15, 'S');
  });
  portrait('p_katia', { s: C.n3, S: C.n2, h: C.y3, H: C.y2, e: C.b2, m: C.o0, t: C.c1, T: C.c0, r: C.g1, i: C.n1 }, BG_HERO, function (g, f) {
    rect(g, 4, 25, 24, 7, 't'); rect(g, 4, 25, 24, 1, 'T'); rect(g, 13, 21, 7, 5, 's');
    oval(g, 26, 29, 5, 5, 'r'); oval(g, 26, 29, 3, 3, 'i');                                                 // shield rim at the shoulder
    oval(g, 16, 14, 9, 10, 's');
    oval(g, 15, 6, 11, 5, 'h'); rect(g, 5, 6, 5, 16, 'h'); rect(g, 22, 6, 5, 12, 'h'); px(g, 6, 22, 'H'); px(g, 24, 18, 'H');
    E(g, f, 11, 8, 3, 3, 'e', 's'); E(g, f, 18, 8, 3, 3, 'e', 's');                                         // eyes set way too high
    rect(g, 17, 13, 2, 3, 'S'); px(g, 19, 15, 'S'); px(g, 19, 16, 'S'); px(g, 20, 16, 'S');                 // crooked nose
    M(g, f, 13, 20, 5, 'm');
  });
  portrait('p_signet', { s: C.b6, S: C.b4, h: C.c0, H: C.c1, e: C.c3, m: C.r0, f: C.W, n: C.b1, o: C.r0, d: C.G0, x: C.p0, y: C.y2 }, BG_FOE, function (g, f) {
    rect(g, 7, 25, 18, 7, 's'); rect(g, 13, 20, 6, 6, 's');
    oval(g, 16, 13, 8, 10, 's');
    tri(g, 9, 12, 1, 4, 8, 17, 's'); tri(g, 23, 12, 31, 4, 24, 17, 's');                                   // long pointed ears
    rect(g, 8, 2, 16, 4, 'h'); rect(g, 7, 4, 3, 16, 'h'); rect(g, 22, 4, 3, 16, 'h'); px(g, 8, 20, 'H'); px(g, 23, 20, 'H');
    rect(g, 12, 0, 2, 3, 'f'); rect(g, 18, 0, 2, 3, 'f');                                                   // small horns
    // moving tattoos: indigo line work, red oni, green scales; shift between frames
    for (var y = 6; y < 32; y++) for (var x = 0; x < 32; x++) {
      if (g[y][x] !== 's') continue;
      var v = (x * 5 + (y + f) * 3) % 13, u = (x * 2 + y * 7 + f * 3) % 17;
      if ((x >= 10 && x <= 22 && y >= 9 && y <= 20)) { if (u === 3 && (x < 12 || x > 20)) g[y][x] = 'o'; continue; }   // keep the face mostly clear
      if (v === 0 || v === 6) g[y][x] = 'n'; else if (u === 3) g[y][x] = 'o'; else if (u === 9) g[y][x] = 'd';
    }
    E(g, f, 11, 12, 3, 2, 'e', 's'); E(g, f, 18, 12, 3, 2, 'e', 's');
    if (f !== 2) { px(g, 10, 11, 'e'); px(g, 21, 11, 'e'); }                                                // the eyes glow
    rect(g, 16, 15, 1, 2, 'S');
    M(g, f, 13, 19, 6, 'm', false); px(g, 14, 20, 'f'); px(g, 18, 20, 'f');                                // fangs
  });

  // ---- circus ----
  portrait('p_grimaldi', { v: C.l3, V: C.l2, d: C.G1, D: C.G0, s: C.o3, S: C.n2, e: C.K, h: C.g1, H: C.g0, m: C.r0 }, BG_FOE, function (g, f) {
    oval(g, 16, 16, 16, 16, 'v'); dots(g, 0, 0, 32, 32, 'v', 'V', function (x, y) { return (x * 3 + y * 5) % 7 === 0; });
    for (var k = 0; k < 6; k++) poly(g, [[k * 6, 32], [k * 6 + 2, 26 + k % 2], [k * 6, 22]], k % 2 ? 'd' : 'D', 1);
    oval(g, 16, 13, 8, 8, 's'); rect(g, 8, 17, 16, 9, 'h'); oval(g, 16, 25, 7, 5, 'h'); px(g, 12, 22, 'H'); px(g, 20, 24, 'H');
    poly(g, [[7, 7], [11, 5], [16, 6], [21, 4], [26, 7]], 'd', 1); poly(g, [[8, 11], [6, 16], [8, 22]], 'D', 1);
    E(g, f, 11, 11, 3, 3, 'e', 's'); E(g, f, 18, 11, 3, 3, 'e', 's');
    rect(g, 15, 14, 2, 3, 'S'); M(g, f, 13, 19, 6, 'm');
  });
  portrait('p_apollon', { s: C.n2, S: C.n1, h: C.y0, m: C.n0, l: C.y2, L: C.y0, c: C.r0, v: C.G1, V: C.G0, e: C.K }, BG_FOE, function (g, f) {
    rect(g, 2, 24, 28, 8, 's'); rect(g, 6, 26, 20, 6, 'l'); dots(g, 6, 26, 20, 6, 'l', 'L', function (x, y) { return (x * 2 + y * 3) % 5 === 0; }); line(g, 22, 24, 26, 31, 'l', 2);
    rect(g, 11, 19, 10, 6, 's');
    oval(g, 16, 12, 10, 10, 's');
    rect(g, 7, 2, 18, 4, 'h'); rect(g, 6, 8, 20, 2, 'S');                                                   // heavy brow
    poly(g, [[8, 6], [10, 9], [8, 12], [11, 15], [9, 18]], 'c', 1);                                         // jagged scar
    E(g, f, 11, 11, 3, 2, 'e', 's'); E(g, f, 18, 11, 3, 2, 'e', 's');
    rect(g, 15, 13, 3, 4, 'S'); M(g, f, 12, 19, 8, 'm'); if (f !== 1) { px(g, 12, 18, 'w'); px(g, 19, 18, 'w'); }
    poly(g, [[24, 22], [27, 18], [29, 12], [27, 7]], 'v', 2); px(g, 29, 15, 'V'); px(g, 26, 9, 'V'); px(g, 30, 11, 'v');   // the vine from his neck
  });
  portrait('p_clammy', { s: C.o3, S: C.n2, g: C.m2, G: C.m1, b: C.b4, u: C.b3, r: C.r1, m: C.r0, R: C.o1, h: C.G1, e: C.K }, BG_FOE, function (g, f) {
    oval(g, 16, 30, 16, 6, 'g'); dots(g, 0, 24, 32, 8, 'g', 'b', function (x, y) { return ((x >> 2) + (y >> 2)) % 2 === 0; });
    rect(g, 3, 22, 26, 3, 'w'); for (var k = 0; k < 13; k++) px(g, 3 + k * 2, 25, 'w');                     // ruffle
    oval(g, 16, 13, 12, 10, 's');
    oval(g, 5, 6, 3, 3, 'h'); oval(g, 27, 6, 3, 3, 'h');
    rect(g, 9, 10, 5, 4, 'w'); rect(g, 19, 10, 5, 4, 'u');                                                   // red-white-blue greasepaint
    E(g, f, 10, 11, 3, 2, 'e', 'w'); E(g, f, 20, 11, 3, 2, 'e', 'u');
    rect(g, 15, 14, 3, 3, 'R');
    if (f === 1) { rect(g, 9, 18, 15, 4, 'K'); for (k = 0; k < 7; k++) { tri(g, 9 + k * 2, 18, 10 + k * 2, 18, 9 + k * 2, 20, 'w'); } }
    else { rect(g, 9, 18, 15, 2, 'r'); for (k = 0; k < 7; k++) px(g, 10 + k * 2, 19, 'w'); }
  });
  portrait('p_heather', { f: C.g0, F: C.y0, s: C.W, S: C.g1, r: C.r1, R: C.o1, o: C.o1, y: C.y2, Y: C.y3, p: C.m2, P: C.m1, q: C.m3, e: C.K }, BG_FOE, function (g, f) {
    oval(g, 16, 30, 15, 6, 'f'); for (var k = 0; k < 8; k++) tri(g, 2 + k * 4, 24, 6 + k * 4, 24, 4 + k * 4, 29, k % 2 ? 'w' : 'S');
    var fl = [[5, 10], [8, 4], [13, 2], [19, 2], [24, 5], [27, 11]];
    fl.forEach(function (q, n) { tri(g, q[0] - 3, q[1] + 6, q[0] + 3, q[1] + 6, q[0] + (n % 2 ? 1 : -1), q[1] - 3 - (f === 2 ? 1 : 0), n % 2 ? 'o' : 'y'); px(g, q[0], q[1] + 3, 'Y'); });
    oval(g, 16, 14, 10, 9, 's'); rect(g, 9, 18, 14, 5, 's'); rect(g, 9, 21, 14, 2, 'S');
    oval(g, 11, 12, 3.5, 3.5, 'K'); oval(g, 21, 12, 3.5, 3.5, 'K');
    if (f !== 2) { oval(g, 11, 12, 2, 2, 'r'); oval(g, 21, 12, 2, 2, 'r'); px(g, 10, 11, 'R'); px(g, 20, 11, 'R'); }
    rect(g, 15, 16, 3, 2, 'K');
    if (f === 1) { rect(g, 10, 21, 13, 3, 'K'); for (k = 0; k < 6; k++) { px(g, 11 + k * 2, 21, 'w'); px(g, 11 + k * 2, 23, 'w'); } }
    else for (k = 0; k < 6; k++) px(g, 11 + k * 2, 21, 'K');
    tri(g, 3, 9, 13, 4, 2, -4, 'p'); line(g, 3, 9, 13, 4, 'P'); px(g, 6, 2, 'q'); oval(g, 2, -3, 2, 2, 'w'); px(g, 7, 6, 'P');   // cockeyed hat
  });

  // ---- inns, shops, club ----
  portrait('p_gordo', { f: C.G2, F: C.G1, d: C.G0, e: C.K, n: C.o2, a: C.n3, A: C.n2, m: C.n0, s: C.G2 }, BG_NPC, function (g, f) {
    oval(g, 16, 18, 14, 13, 'f');
    for (var k = 0; k < 10; k++) { px(g, 3 + k * 3, 5 + (k % 2), 'f'); px(g, 2, 9 + k * 2, 'F'); px(g, 30, 9 + k * 2, 'F'); px(g, 5 + k * 2, 8 + (k % 3), 'F'); }
    rect(g, 6, 27, 20, 5, 'a'); rect(g, 6, 27, 20, 1, 'A');
    oval(g, 10, 14, 4, 4, 'w'); oval(g, 22, 14, 4, 4, 'w');
    if (f === 2) { oval(g, 10, 14, 4, 4, 'F'); oval(g, 22, 14, 4, 4, 'F'); rect(g, 7, 15, 7, 1, 'K'); rect(g, 19, 15, 7, 1, 'K'); }
    else { rect(g, 11, 14, 3, 3, 'e'); rect(g, 23, 14, 3, 3, 'e'); px(g, 11, 14, 'w'); px(g, 23, 14, 'w'); }
    rect(g, 15, 19, 3, 2, 'n');
    if (f === 1) { rect(g, 11, 22, 10, 4, 'K'); rect(g, 13, 24, 6, 1, 'r'); px(g, 12, 22, 'w'); px(g, 19, 22, 'w'); }
    else { rect(g, 10, 22, 12, 2, 'm'); px(g, 13, 22, 'w'); px(g, 18, 22, 'w'); }
  });
  portrait('p_fitz', { s: C.n3, S: C.n2, h: C.n0, e: C.K, m: C.n0, c: C.b3, C: C.b1, a: C.W }, BG_NPC, function (g, f) {
    rect(g, 2, 24, 28, 8, 'c'); rect(g, 9, 25, 14, 7, 'a'); rect(g, 12, 20, 8, 5, 's');
    oval(g, 16, 13, 10, 10, 's'); px(g, 12, 5, 'w'); px(g, 13, 4, 'w');
    rect(g, 5, 10, 3, 8, 'h'); rect(g, 24, 10, 3, 8, 'h');
    E(g, f, 11, 12, 3, 2, 'e', 's'); E(g, f, 18, 12, 3, 2, 'e', 's'); line(g, 10, 10, 14, 10, 'h'); line(g, 18, 10, 22, 10, 'h');
    rect(g, 15, 14, 3, 3, 'S');
    rect(g, 9, 18, 15, 3, 'h'); px(g, 8, 21, 'h'); px(g, 24, 21, 'h');                                       // the moustache
    if (f === 1) { rect(g, 13, 21, 7, 2, 'K'); rect(g, 14, 22, 5, 1, 'r'); }
  });
  var FOWLP = { f: C.n1, F: C.n0, h: C.n2, H: C.n1, b: C.y2, B: C.y1, e: C.K, c: C.G1, C: C.G0, s: C.n2, G: C.y1, z: C.W };
  function birdBust(g, f, o) { // shared skyfowl bust facing right
    rect(g, 4, 24, 24, 8, o.coat || 'c'); rect(g, 4, 24, 24, 1, 'C');
    oval(g, 6, 27, 4, 5, 'f'); px(g, 9, 26, 'z'); px(g, 10, 25, 'z'); px(g, 9, 28, 'z');                       // wing with finger bones
    oval(g, 14, 14, 10, 10, 'h'); rect(g, 8, 18, 12, 8, 'h');
    for (var k = 0; k < 5; k++) px(g, 5 + k, 8 + k * 3, 'H');
    if (o.crest) { line(g, 7, 5, 3, 1, 'H', 2); line(g, 9, 4, 6, 0, 'H', 2); }
    // beak: big hooked
    rect(g, 22, 12, 7, 5, 'b'); rect(g, 28, 13, 2, 5, 'b'); px(g, 29, 18, 'B'); px(g, 28, 18, 'B'); rect(g, 22, 16, 6, 1, 'B');
    if (f === 1) { rect(g, 22, 17, 6, 2, 'K'); rect(g, 22, 19, 5, 1, 'b'); }
    if (o.crack) { px(g, 24, 12, 'B'); px(g, 25, 13, 'B'); px(g, 25, 14, 'B'); px(g, 26, 15, 'B'); }
    E(g, f, 17, 10, 3, 3, o.iris || 'e', 'h');
    if (o.glasses) { rect(g, 16, 9, 5, 1, 'G'); rect(g, 16, 13, 5, 1, 'G'); px(g, 16, 10, 'G'); px(g, 20, 10, 'G'); px(g, 16, 12, 'G'); px(g, 20, 12, 'G'); line(g, 16, 10, 11, 9, 'G'); }
  }
  portrait('p_edge_dancer', K.merge(FOWLP, { y: C.y2 }), BG_NPC, function (g, f) { birdBust(g, f, { crest: true }); px(g, 8, 3, 'y'); });
  portrait('p_talon', K.merge(FOWLP, { h: C.W, H: C.g1, f: C.y0, F: C.n0, c: C.n0, C: C.y0, a: C.y1 }), BG_NPC, function (g, f) { birdBust(g, f, {}); rect(g, 12, 24, 10, 8, 'a'); });
  portrait('p_lucky', K.merge(FOWLP, { h: C.g2, H: C.g1, f: C.K, F: C.g0, b: C.g0, B: C.K, c: C.y3, C: C.y1, v: C.G1, V: C.G0, y: C.G1 }), BG_NPC, function (g, f) {
    birdBust(g, f, {}); rect(g, 6, 2, 20, 6, 'K'); rect(g, 4, 6, 18, 3, 'v'); rect(g, 14, 8, 12, 2, 'V'); px(g, 12, 27, 'y'); px(g, 13, 26, 'y'); px(g, 13, 28, 'y'); px(g, 14, 27, 'y');
  });
  portrait('p_quill', K.merge(FOWLP, { f: C.g0, F: C.g3, h: C.g1, H: C.g0, c: C.p0, C: C.m0, b: C.y3, B: C.y1, r: C.r0 }), BG_FOE, function (g, f) {
    birdBust(g, f, { glasses: true, crack: true }); rect(g, 14, 25, 4, 2, 'r');
    if (f !== 1) line(g, 22, 17, 27, 18, 'B');                                                              // permanently sour
  });
  portrait('p_pustule', { s: C.l1, S: C.l0, h: C.y0, e: C.y2, m: C.l0, o: C.G0, O: C.l2, t: C.m3, T: C.m2, u: C.W }, BG_NPC, function (g, f) {
    rect(g, 2, 24, 28, 8, 't'); rect(g, 12, 26, 7, 4, 'u'); rect(g, 13, 26, 5, 1, 'K'); px(g, 18, 25, 'O'); rect(g, 13, 20, 7, 5, 's');
    oval(g, 16, 13, 10, 10, 's');
    tri(g, 7, 10, 0, 1, 8, 16, 's'); tri(g, 25, 10, 31, 1, 24, 16, 's');
    rect(g, 8, 2, 16, 4, 'h');
    E(g, f, 11, 11, 3, 3, 'e', 's'); E(g, f, 18, 11, 3, 3, 'e', 's');
    rect(g, 15, 14, 3, 4, 'S'); M(g, f, 12, 20, 8, 'm');
    oval(g, 9, 17, 2.5, 2.5, 'o'); px(g, 9, 17, 'O'); px(g, 9, 20, 'o'); px(g, 10, 21 + (f === 2 ? 1 : 0), 'o');   // the sore
  });
  portrait('p_clarabelle', { s: C.G1, S: C.G0, b: C.l3, e: C.y2, t: C.g0, y: C.y2, r: C.r1 }, BG_NPC, function (g, f) {
    rect(g, 2, 25, 28, 7, 't'); line(g, 8, 25, 15, 30, 'y'); line(g, 22, 25, 15, 30, 'y'); px(g, 15, 30, 'r');
    rect(g, 8, 6, 12, 19, 's'); rect(g, 18, 11, 14, 8, 's'); rect(g, 18, 17, 14, 2, 'b');
    for (var x = 19; x < 32; x += 2) px(g, x, f === 1 ? 19 : 16, 'w');
    if (f === 1) { rect(g, 18, 19, 14, 3, 'K'); rect(g, 18, 22, 14, 2, 's'); for (x = 19; x < 32; x += 2) px(g, x, 21, 'w'); }
    px(g, 30, 12, 'S'); px(g, 28, 12, 'S'); dots(g, 8, 6, 24, 14, 's', 'S', function (x, y) { return (x + y) % 4 === 0 && y < 10; });
    rect(g, 12, 4, 6, 4, 's'); E(g, f, 13, 5, 4, 3, 'e', 'S');
  });
  portrait('p_quint', { f: C.g1, F: C.g0, n: C.m2, e: C.K, a: C.K, t: C.g1, T: C.g3, j: C.b6, v: C.p1 }, BG_NPC, function (g, f) {
    for (var k = 0; k < 6; k++) rect(g, 8 + k + ((k + f) % 2), 26 + k, 16 - k * 2, 1, k % 2 ? 'T' : 't');
    oval(g, 15, 21, 9, 6, 'f'); oval(g, 14, 12, 9, 8, 'f'); oval(g, 19, 14, 7, 4, 'w'); rect(g, 24, 13, 6, 3, 'w'); rect(g, 29, 14, 2, 2, 'n');
    oval(g, 7, 4, 3.5, 3.5, 'a'); oval(g, 17, 3, 3, 3, 'a');
    E(g, f, 15, 9, 3, 3, 'e', 'f');
    if (f === 1) { rect(g, 22, 17, 7, 2, 'K'); px(g, 23, 17, 'w'); px(g, 27, 17, 'w'); } else line(g, 22, 17, 28, 17, 'F');
    px(g, 3, 9, 'v'); px(g, 28, 5, 'v'); px(g, 27, 4, 'j');
  });
  portrait('p_gumgum', { s: C.G1, S: C.G0, h: C.g1, H: C.g0, e: C.K, m: C.G0, t: C.n3, r: C.o0, R: C.r0 }, BG_NPC, function (g, f) {
    rect(g, 2, 24, 28, 8, 't'); px(g, 8, 26, 'r'); rect(g, 10, 27, 3, 2, 'r'); px(g, 20, 28, 'R'); rect(g, 22, 25, 2, 2, 'r'); rect(g, 13, 20, 7, 5, 's');
    oval(g, 16, 13, 10, 10, 's');
    oval(g, 16, 3, 9, 3, 'h'); oval(g, 9, 2, 3, 3, 'h'); px(g, 9, 1, 'H'); rect(g, 6, 3, 3, 8, 'h');
    E(g, f, 11, 11, 3, 2, 'e', 's'); E(g, f, 18, 11, 3, 2, 'e', 's'); line(g, 10, 10, 14, 9, 'H'); line(g, 18, 9, 22, 10, 'H');
    rect(g, 15, 13, 3, 4, 'S'); M(g, f, 12, 20, 8, 'm', false);
    rect(g, 12, 17, 2, 3, 'w'); rect(g, 19, 17, 2, 3, 'w');                                                  // tusks
    px(g, 8, 17, 'S'); px(g, 24, 16, 'S'); px(g, 23, 18, 'S');
  });

  // ---- the settlement, the cult, the admin district ----
  portrait('p_vincente', { s: C.n3, S: C.n2, h: C.y0, e: C.K, m: C.o0, c: '#787878', C: C.g0, n: C.W, o: C.o1, y: C.y2, Y: C.y3, a: C.y2 }, BG_FOE, function (g, f) {
    rect(g, 2, 24, 28, 8, 'c'); rect(g, 2, 24, 4, 8, 'C'); rect(g, 4, 26, 3, 3, 'a'); rect(g, 18, 27, 6, 2, 'n'); rect(g, 13, 20, 6, 5, 's');
    oval(g, 15, 13, 9, 10, 's');
    tri(g, 7, 12, 0, 2, 8, 17, 's'); px(g, 3, 5, 'S');
    rect(g, 6, 2, 18, 5, 'h'); rect(g, 6, 4, 3, 9, 'h');
    E(g, f, 11, 11, 3, 2, 'e', 's'); E(g, f, 18, 11, 3, 2, 'e', 's'); line(g, 10, 9, 14, 10, 'h'); line(g, 17, 10, 21, 9, 'h');
    rect(g, 15, 14, 2, 4, 'S');
    if (f === 1) { rect(g, 13, 19, 7, 3, 'K'); rect(g, 13, 19, 7, 1, 'w'); } else { line(g, 13, 20, 19, 19, 'm'); }   // smirk
    var fh = f === 1 ? 2 : 0;                                                                                 // the burning hand
    rect(g, 25, 22, 4, 5, 's'); tri(g, 23, 22, 31, 22, 27 + (f % 2), 12 - fh, 'o'); tri(g, 25, 22, 29, 22, 27, 15 - fh, 'y'); px(g, 27, 19, 'Y');
  });
  portrait('p_burgundy', { s: C.n3, S: C.n2, h: C.y0, H: C.n0, e: C.b4, E: C.y0, m: C.r0, d: C.r0, D: C.o0, c: C.W }, BG_NPC, function (g, f) {
    rect(g, 4, 25, 24, 7, 'd'); rect(g, 11, 25, 10, 3, 'c'); rect(g, 13, 20, 6, 6, 's');
    rect(g, 6, 6, 20, 22, 'h');
    oval(g, 16, 13, 8, 10, 's');
    rect(g, 8, 2, 16, 5, 'h'); rect(g, 7, 4, 3, 10, 'h'); rect(g, 20, 3, 5, 3, 'h');
    E(g, f, 11, 12, 3, 3, 'E', 's'); E(g, f, 18, 12, 3, 3, 'e', 's');                                       // one brown eye, one pale blue
    rect(g, 15, 15, 2, 3, 'S'); M(g, f, 13, 20, 5, 'm');
  });
  portrait('p_remex', { s: C.g0, S: C.g3, h: C.g1, H: C.g0, b: C.g1, B: C.g0, x: C.p0, q: C.p2, Q: C.p3, e: C.K, c: C.g0, C: C.g3, f: C.g0, F: C.g3, z: C.g1 }, BG_FOE, function (g, f) {
    for (var n = 0; n < 5; n++) poly(g, [[6, 20 + n * 2], [3, 18 + n * 2 + (n + f) % 2], [0, 21 + n * 2]], n % 2 ? 'q' : 'Q', 1);
    for (n = 0; n < 3; n++) { px(g, 12 + n * 4 + f, 2 - (n % 2), 'x'); px(g, 13 + n * 4, 1, 'x'); }
    birdBust(g, f === 2 ? 0 : f, { coat: 'c' });
    dots(g, 0, 0, 32, 32, 'h', 'H', function (x, y) { return (x * 3 + y * 2) % 5 === 0; });
    rect(g, 16, 9, 5, 5, 'x'); px(g, 17 + (f % 2), 10, 'q'); px(g, 19, 12 - (f % 2), 'Q'); px(g, 18, 11, 'q');   // black swirling eyes
  });
  portrait('p_bautista', { f: C.n1, F: C.n0, s: C.K, e: C.l2, n: C.r3, m: C.K, c: C.W }, BG_HERO, function (g, f) {
    rect(g, 3, 25, 26, 7, 'f'); oval(g, 16, 29, 6, 4, 'w'); for (var k = 0; k < 4; k++) { line(g, 4 + k * 2, 26, 6 + k * 2, 31, 's'); line(g, 27 - k * 2, 26, 25 - k * 2, 31, 's'); }
    oval(g, 16, 15, 12, 11, 'f');
    tri(g, 4, 1, 10, 6, 4, 10, 'f'); tri(g, 28, 1, 22, 6, 28, 10, 'f'); tri(g, 5, 4, 8, 7, 5, 8, 'n'); tri(g, 27, 4, 24, 7, 27, 8, 'n');
    oval(g, 16, 21, 7, 5, 'w'); oval(g, 6, 19, 3, 5, 'w'); oval(g, 26, 19, 3, 5, 'w');
    line(g, 13, 4, 14, 8, 's'); line(g, 16, 3, 16, 7, 's'); line(g, 19, 4, 18, 8, 's'); line(g, 5, 13, 9, 14, 's'); line(g, 27, 13, 23, 14, 's'); line(g, 5, 16, 8, 17, 's'); line(g, 27, 16, 24, 17, 's');
    if (f === 2) { rect(g, 10, 12, 4, 1, 's'); rect(g, 19, 12, 4, 1, 's'); }
    else { rect(g, 10, 11, 4, 3, 'e'); rect(g, 19, 11, 4, 3, 'e'); rect(g, 12, 11, 1, 3, 's'); rect(g, 21, 11, 1, 3, 's'); }   // slit pupils
    rect(g, 15, 17, 3, 2, 'n'); line(g, 16, 19, 16, 20, 's');
    if (f === 1) { rect(g, 13, 21, 7, 3, 'K'); rect(g, 14, 23, 5, 1, 'n'); } else { line(g, 13, 21, 15, 22, 's'); line(g, 17, 22, 19, 21, 's'); }
  });
  portrait('p_eunice', { s: C.c1, S: C.c0, h: C.y0, H: C.n0, e: C.K, m: C.c0, d: C.b5, a: C.n3, f: C.t2 }, BG_NPC, function (g, f) {
    rect(g, 3, 24, 26, 8, 'd'); rect(g, 10, 25, 12, 7, 'a'); rect(g, 13, 20, 6, 5, 's');
    oval(g, 16, 13, 10, 10, 's');
    tri(g, 6, 12, 1, 8, 6, 17, 'f'); tri(g, 26, 12, 31, 8, 26, 17, 'f');                                     // fin ears
    rect(g, 7, 2, 18, 5, 'h'); rect(g, 5, 5, 4, 10, 'h'); poly(g, [[6, 15], [4, 20], [5, 26]], 'H', 3);
    E(g, f, 11, 12, 3, 2, 'e', 's'); E(g, f, 18, 12, 3, 2, 'e', 's');
    rect(g, 15, 14, 3, 4, 'S'); M(g, f, 13, 20, 6, 'm');
    line(g, 8, 18, 10, 20, 'S'); line(g, 24, 18, 22, 20, 'S');                                              // gills
  });
  portrait('p_ricky_joe', { s: C.c1, S: C.c0, h: C.y0, e: C.K, m: C.c0, d: C.p0, a: C.n3, f: C.t2, o: C.o1 }, BG_NPC, function (g, f) {
    rect(g, 4, 25, 24, 7, 'd'); rect(g, 8, 25, 3, 7, 'a'); rect(g, 21, 25, 3, 7, 'a'); rect(g, 13, 21, 6, 5, 's');
    oval(g, 16, 14, 10, 9, 's');
    tri(g, 6, 13, 1, 9, 6, 18, 'f'); tri(g, 26, 13, 31, 9, 26, 18, 'f');
    rect(g, 7, 3, 18, 5, 'h'); px(g, 12, 2, 'h'); px(g, 17, 1, 'h');
    E(g, f, 11, 12, 3, 3, 'e', 's'); E(g, f, 18, 12, 3, 3, 'e', 's');
    rect(g, 15, 16, 2, 2, 'S'); M(g, f, 13, 20, 6, 'm');
  });

  // ---- the talk show ----
  portrait('p_hekla', { s: C.n3, S: C.n2, h: C.y3, H: C.y2, e: C.b2, m: C.o0, a: C.g1, A: C.g0, x: C.W }, BG_FOE, function (g, f) {
    rect(g, 2, 24, 28, 8, 'a'); rect(g, 2, 24, 28, 1, 'A'); px(g, 8, 27, 'x'); px(g, 22, 29, 'x'); px(g, 15, 26 + (f % 2), 'x'); rect(g, 12, 20, 8, 5, 's');
    oval(g, 16, 14, 9, 9, 's');
    rect(g, 5, 10, 4, 18, 'h'); rect(g, 23, 10, 4, 18, 'h'); px(g, 6, 28, 'H'); px(g, 24, 28, 'H');
    rect(g, 6, 3, 20, 7, 'a'); rect(g, 6, 9, 20, 2, 'A'); rect(g, 15, 3, 2, 10, 'A');
    tri(g, 6, 5, 0, -2, 2, 9, 'x'); tri(g, 26, 5, 32, -2, 30, 9, 'x');                                       // helmet wings
    E(g, f, 11, 13, 3, 2, 'e', 's'); E(g, f, 18, 13, 3, 2, 'e', 's');
    rect(g, 15, 15, 2, 3, 'S'); M(g, f, 13, 20, 6, 'm');
  });
  portrait('p_ripper', { f: C.n0, F: C.y0, c: C.n1, e: C.K, n: C.K, o: C.o1, O: C.n1, b: C.n2, m: C.y0 }, BG_TV, function (g, f) {
    oval(g, 16, 30, 13, 6, 'f'); rect(g, 8, 23, 16, 4, 'o'); tri(g, 12, 25, 20, 25, 16, 31, 'o'); px(g, 16, 27, 'O');
    oval(g, 16, 13, 14, 11, 'f');
    oval(g, 5, 3, 4, 4, 'f'); oval(g, 27, 3, 4, 4, 'f'); oval(g, 5, 3, 2, 2, 'F'); oval(g, 27, 3, 2, 2, 'F');
    oval(g, 7, 17, 5, 4, 'c'); oval(g, 25, 17, 5, 4, 'c');                                                   // massive cheeks
    if (f === 2) { rect(g, 8, 11, 6, 1, 'K'); rect(g, 18, 11, 6, 1, 'K'); }
    else { oval(g, 11, 10, 3.5, 3.5, 'K'); oval(g, 21, 10, 3.5, 3.5, 'K'); px(g, 10, 8, 'w'); px(g, 11, 8, 'w'); px(g, 20, 8, 'w'); px(g, 21, 8, 'w'); px(g, 12, 11, 'w'); px(g, 22, 11, 'w'); }   // giant eyes
    rect(g, 14, 15, 4, 3, 'n');
    if (f === 1) { rect(g, 13, 19, 6, 3, 'K'); rect(g, 14, 21, 4, 1, 'r'); } else { line(g, 13, 19, 15, 20, 'K'); line(g, 17, 20, 19, 19, 'K'); }
  });
  portrait('p_manasa', { s: C.r3, S: C.r2, h: C.m1, H: C.m0, e: C.K, m: C.r0, d: C.c2, D: C.c1, x: C.W, g: C.g0 }, BG_TV, function (g, f) {
    rect(g, 4, 25, 24, 7, 'd'); dots(g, 4, 25, 24, 7, 'd', 'x', function (x, y) { return (x * 3 + y * 2 + f) % 5 === 0; }); rect(g, 13, 20, 6, 6, 's');
    oval(g, 16, 10, 15, 10, 'h'); rect(g, 2, 10, 6, 16, 'h'); rect(g, 24, 10, 6, 16, 'h'); px(g, 3, 26, 'H'); px(g, 28, 26, 'H');
    oval(g, 16, 14, 8, 9, 's');
    E(g, f, 11, 12, 3, 3, 'e', 's'); E(g, f, 18, 12, 3, 3, 'e', 's'); px(g, 10, 11, 'K'); px(g, 21, 11, 'K');
    rect(g, 15, 15, 2, 2, 'S'); M(g, f, 13, 19, 6, 'm');
    rect(g, 24, 18, 3, 7, 'g'); oval(g, 25, 16, 2.5, 2.5, 'g');
  });
  portrait('p_tucker', { s: C.n3, S: C.n2, h: C.y3, H: C.y2, e: C.K, m: C.o0, c: C.b1, t: C.r1 }, BG_TV, function (g, f) {
    rect(g, 2, 24, 28, 8, 'c'); tri(g, 11, 24, 21, 24, 16, 31, 'w'); rect(g, 15, 25, 2, 7, 't'); rect(g, 13, 20, 6, 5, 's');
    oval(g, 16, 13, 9, 10, 's');
    rect(g, 7, 2, 18, 6, 'h'); rect(g, 6, 4, 3, 9, 'h'); line(g, 10, 3, 23, 3, 'H');                         // side part
    E(g, f, 11, 12, 3, 2, 'e', 's'); E(g, f, 18, 12, 3, 2, 'e', 's'); line(g, 10, 10, 14, 11, 'h'); line(g, 18, 10, 22, 9, 'h');
    rect(g, 15, 14, 3, 3, 'S');
    if (f === 1) { rect(g, 13, 19, 7, 3, 'K'); rect(g, 13, 19, 7, 1, 'w'); } else { line(g, 12, 20, 18, 19, 'm'); px(g, 19, 18, 'm'); }   // smug
  });
  portrait('p_dnadia', { s: C.b6, S: C.b4, x: C.W, h: C.p3, H: C.p2, e: C.p0, m: C.m1, d: C.m3, q: C.c3, r: C.r2, y: C.y2 }, BG_TV, function (g, f) {
    rect(g, 4, 25, 24, 7, 'd'); line(g, 6, 31, 12, 25, 'q'); line(g, 20, 25, 26, 31, 'H'); rect(g, 13, 20, 6, 6, 's');
    rect(g, 6, 6, 20, 20, 'h');
    oval(g, 16, 14, 8, 9, 's'); px(g, 11, 9, 'x'); px(g, 21, 17, 'x'); px(g, 12, 18, 'S'); px(g, 20, 9, 'S');
    tri(g, 8, 6, 24, 6, 16, -4, 'q'); px(g, 16, 1, 'r'); px(g, 13, 4, 'y'); px(g, 19, 4, 'x');
    E(g, f, 11, 12, 3, 3, 'e', 's'); E(g, f, 18, 12, 3, 3, 'e', 's');
    M(g, f, 14, 19, 4, 'm');
  });
  portrait('p_zev', { b: C.c1, B: C.c2, f: C.b4, e: C.K, h: C.g3, m: C.g1, c: C.m1, x: C.K, s: C.c1 }, BG_HERO, function (g, f) {
    rect(g, 4, 26, 24, 6, 'c'); tri(g, 13, 26, 19, 26, 16, 31, 'w');
    oval(g, 16, 15, 12, 11, 'b'); oval(g, 18, 20, 8, 4, 'B');
    tri(g, 10, 1, 20, 4, 12, 7, 'f'); tri(g, 3, 14, 6, 10, 6, 20, 'f');
    if (f === 2) { rect(g, 15, 8, 7, 7, 'b'); rect(g, 15, 13, 7, 1, 'K'); } else { rect(g, 15, 8, 7, 7, 'w'); rect(g, 19, 10, 3, 4, 'e'); px(g, 20, 10, 'w'); }
    if (f === 1) { rect(g, 18, 19, 9, 4, 'K'); rect(g, 19, 21, 7, 1, 'r'); } else { rect(g, 18, 19, 9, 2, 'x'); px(g, 26, 18, 'x'); }
    rect(g, 3, 6, 3, 3, 'h'); rect(g, 4, 3, 16, 2, 'h'); rect(g, 4, 9, 2, 12, 'h'); line(g, 5, 20, 14, 23, 'm'); rect(g, 13, 22, 3, 2, 'h');
  });
  portrait('p_odette', { h: C.K, H: C.g0, x: C.b6, X: C.W, s: C.y0, S: C.n0, d: C.p0, D: C.m0, y: C.y2, a: C.g1, c: C.o1 }, BG_TV, function (g, f) {
    oval(g, 16, 31, 15, 5, 'd'); oval(g, 11, 30, 5, 3, 'D'); oval(g, 21, 30, 5, 3, 'D'); rect(g, 12, 22, 8, 5, 's');
    tri(g, 3, 4, 29, 4, 16, 24, 'H'); tri(g, 5, 5, 27, 5, 16, 22, 'h'); rect(g, 5, 2, 22, 3, 'H'); rect(g, 6, 3, 20, 2, 'h');
    oval(g, 10, 9, 5, 4, 'x'); oval(g, 22, 9, 5, 4, 'x');
    if (f === 2) { oval(g, 10, 9, 5, 4, 'a'); oval(g, 22, 9, 5, 4, 'a'); }                                   // the mirrored lenses shimmer
    else { px(g, 8, 7, 'X'); px(g, 9, 7, 'X'); px(g, 20, 7, 'X'); px(g, 21, 7, 'X'); dots(g, 5, 5, 23, 9, 'x', 'a', function (x, y) { return (x + y * 2) % 4 === 0; }); }
    poly(g, [[12, 2], [7, -2], [1, 0]], 'H', 1); poly(g, [[20, 2], [25, -2], [31, 0]], 'H', 1);
    if (f === 1) { rect(g, 14, 18, 4, 3, 'c'); } else rect(g, 14, 19, 4, 1, 'H');
  });
  portrait('p_lucia', { s: C.n2, S: C.n1, h: C.p0, H: C.b1, e: C.y0, m: C.o0, j: C.y2, b: C.b2, a: C.g1, A: C.b6 }, BG_FOE, function (g, f) {
    rect(g, 3, 24, 26, 8, 'j'); rect(g, 3, 27, 26, 3, 'b'); rect(g, 2, 24, 4, 8, 'a'); rect(g, 26, 24, 4, 8, 'a'); px(g, 3, 26, 'A'); px(g, 28, 28, 'A');
    rect(g, 13, 20, 6, 5, 's');
    rect(g, 7, 5, 18, 20, 'h');
    oval(g, 16, 13, 8, 9, 's');
    rect(g, 8, 2, 16, 5, 'h'); rect(g, 7, 4, 3, 8, 'h');
    E(g, f, 11, 12, 3, 2, 'e', 's'); E(g, f, 18, 12, 3, 2, 'e', 's'); line(g, 10, 10, 14, 11, 'h'); line(g, 18, 11, 22, 10, 'h');   // glare
    rect(g, 15, 14, 2, 3, 'S'); M(g, f, 13, 19, 6, 'm');
  });

  // ---- the System AI (kept from book 1, now talks and blinks) ----
  portrait('p_ai', { c: C.y1, C: C.y0, s: C.c0, g: C.l2, G: C.G2, a: C.g1, r: C.o1 }, BG_NPC, function (g, f) {
    line(g, 9, 0, 13, 5, 'a'); line(g, 23, 0, 19, 5, 'a'); rect(g, 14, 4, 4, 2, 'r');
    rect(g, 1, 6, 30, 24, 'c'); rect(g, 3, 8, 22, 19, 's'); rect(g, 26, 10, 3, 3, 'r'); rect(g, 26, 15, 3, 3, 'C'); rect(g, 26, 20, 3, 6, 'C');
    if (f === 2) { rect(g, 7, 13, 4, 1, 'g'); rect(g, 17, 13, 4, 1, 'g'); }
    else { rect(g, 7, 11, 4, 4, 'g'); rect(g, 17, 11, 4, 4, 'g'); px(g, 9, 12, 'G'); px(g, 19, 12, 'G'); }
    rect(g, 5, 18, 2, 2, 'g'); rect(g, 21, 18, 2, 2, 'g'); rect(g, 7, 20, 14, 2, 'g'); rect(g, 9, 22, 10, f === 1 ? 4 : 2, 'g');
    for (var x = 8; x < 20; x += 3) rect(g, x, 20, 2, 1, 'w');
    if (f === 1) rect(g, 11, 23, 6, 2, 's');
    rect(g, 4, 30, 4, 2, 'C'); rect(g, 24, 30, 4, 2, 'C');
  });

  // ---- bosses (for boss intros) ----
  portrait('p_terror_big', K.merge(K.TERP, { e: C.K }), BG_FOE, function (g, f) {
    rect(g, 4, 25, 24, 7, 'c'); dots(g, 4, 25, 24, 7, 'c', 'd', function (x, y) { return (x * 3 + y * 5) % 7 === 0; }); rect(g, 3, 23, 26, 3, 'w'); px(g, 9, 28, 'r'); px(g, 20, 27, 'r');
    oval(g, 16, 14, 10, 10, 's'); px(g, 10, 10, 'S'); px(g, 21, 16, 'S'); px(g, 12, 18, 'S');
    oval(g, 5, 9, 4, 6, 'h'); oval(g, 27, 9, 4, 6, 'h'); oval(g, 16, 3, 8, 3, 'h'); px(g, 4, 6, 'H'); px(g, 28, 12, 'H');
    rect(g, 12, 0, 8, 3, 'a'); px(g, 18, 0, 'y');
    var mo = f === 1 ? 3 : f === 2 ? 1 : 0;                                                                  // no eyes: it "blinks" by twitching its jaw
    rect(g, 8, 13 - mo, 17, 6 + mo * 2, 'm'); for (var k = 0; k < 9; k++) { px(g, 8 + k * 2, 13 - mo, 'w'); px(g, 8 + k * 2, 18 + mo, 'w'); }
    if (f === 1) poly(g, [[16, 16], [20, 19], [24, 18], [27, 20]], 'R', 2);
  });
  portrait('p_dispenser', K.merge({ a: C.g1, A: C.g0, m: C.y1, M: C.y0, e: C.y2, E: C.o1, x: C.K, r: C.r0, R: C.r1 }, {}), BG_FOE, function (g, f) {
    tri(g, 16, 2, 0, 18, 16, 30, 'a'); tri(g, 16, 2, 32, 18, 16, 30, 'a'); oval(g, 16, 16, 9, 9, 'a');
    for (var y = 0; y < 32; y++) for (var x = 0; x < 32; x++) if (g[y][x] === 'a' && (y % 5 === 0 || (x + (Math.floor(y / 5) % 2) * 4) % 8 === 0)) g[y][x] = 'A';
    tri(g, 9, 7, 13, 4, 7, 0, 'a'); tri(g, 23, 7, 19, 4, 25, 0, 'a');
    oval(g, 10, 11, 3, 2.5, 'm'); oval(g, 22, 11, 3, 2.5, 'm');
    if (f === 2) { rect(g, 7, 11, 7, 1, 'x'); rect(g, 19, 11, 7, 1, 'x'); } else { oval(g, 10, 11, 2, 1.5, 'e'); oval(g, 22, 11, 2, 1.5, 'e'); rect(g, 10, 10, 1, 3, 'x'); rect(g, 22, 10, 1, 3, 'x'); }
    if (f === 1) { oval(g, 16, 19, 7, 4, 'r'); oval(g, 16, 20, 4, 2, 'x'); for (var k = 0; k < 6; k++) px(g, 11 + k * 2, 16, 'w'); } else rect(g, 9, 19, 15, 1, 'x');
  });
})();



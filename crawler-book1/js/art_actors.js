/* art_actors.js - pixel data for Carl (+skins), companions, enemies, bosses, NPCs, portraits.
 * Owner: art-actors. Pure data: fills DCW.artDefs / DCW.artProcs / DCW.artSkins.
 * art.js (loaded after this file) rasterizes everything at init().
 *
 * Authoring notes
 *  - Most sprites are written as FILL-ONLY pixel strings; a 1px black ('k') outline is
 *    added automatically around the silhouette (outlined()).
 *  - Big sprites (bosses, portraits) are painted on char grids with integer primitives
 *    (rect / oval / line / px) and then outlined - same result as hand pixel art.
 *  - Carl is composed per frame (body + stamped head). Skins are palette overrides; the
 *    per-skin accessories (crown, nightcap, wig...) and body patterns (tartan, polka dots)
 *    are baked into extra generated palette chars so a plain palette swap shows them.
 */
(function () {
  'use strict';
  var DCW = window.DCW = window.DCW || {};
  var defs = DCW.artDefs = DCW.artDefs || {};
  DCW.artProcs = DCW.artProcs || {};
  var skins = DCW.artSkins = DCW.artSkins || {};

  /* ------------------------------------------------------------------ *
   * NES 2C02 palette (common FCEUX-style values)
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
    c0: '#004058', c1: '#008888', c2: '#00e8d8', c3: '#00fcfc'
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
  function px(g, x, y, c) { x |= 0; y |= 0; if (y >= 0 && y < g.length && x >= 0 && x < g[0].length) g[y][x] = c; }
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
  // replace chars inside a rect only
  function swapIn(g, x, y, w, h, map) { for (var j = y; j < y + h; j++) for (var i = x; i < x + w; i++) if (g[j] && g[j][i] !== undefined && map[g[j][i]] !== undefined) g[j][i] = map[g[j][i]]; }

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

  // expose helpers for debugging / other tools (harmless)
  DCW.artActorsKit = { P: P, rows: rows, outlined: outlined, C: C };

  /* ================================================================== *
   *  CARL
   * ================================================================== */
  // Canvas for every side-view carl frame: 24 x 28, feet on the bottom row, body centred on x=12.
  // Rows 0-3 are headroom for skin accessories (crowns, nightcaps, wigs).
  var CW = 24, CH = 28;

  // Base palette chars (fill colours). Outline 'k' is added per skin automatically.
  var CARL_PAL = {
    k: C.K,
    s: '#fca044',  // skin (face, hands): the NES's warm skin tone (pale peach washes out to white on TVs)
    S: '#e45c10',  // skin shade / stubble / ear
    n: '#fca044',  // nose (skin) - clown turns it red
    h: '#503000',  // hair
    e: C.K,        // pupils
    w: C.W,        // eye whites / teeth
    m: C.K,        // mouth line
    j: '#881400',  // jacket body (brown leather)
    J: '#503000',  // jacket shade
    v: '#881400',  // sleeves
    V: '#503000',  // sleeve shade
    q: '#503000',  // jacket inner edge / lapel line
    t: '#fca044',  // torso under jacket (bare chest by default)
    T: '#e45c10',  // torso detail (navel, pec shadow)
    b: C.W,        // boxers
    B: '#f83800',  // boxer hearts
    l: '#fce0a8',  // lower legs (bare)
    L: '#fca044',  // far leg (shaded, sits behind the near leg in stride poses)
    f: '#fce0a8',  // feet (bare)
    F: '#fca044',  // toes / sole shade
    a: null, A: null // accessory layer (off by default; skins below paint real accessories)
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
  var HEAD_SIDE_BLINK = headVar('hhSssssssss.', 'hSkSseessee.', null, null);
  var HEAD_SIDE_LOOK = headVar('hhSssewssew.', 'hSkSsewssew.', null, null);
  var HEAD_SIDE_GRIT = headVar('hhSsseSsseS.', 'hSkSswesswe.', '..SsswwwwmS.', '..SSsmmmmS..');
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

  // head metrics for accessory painters (local to the 12x12 head)
  // view: side | back ; eye row, nose, mouth, ear
  var HEADS = {
    side: { g: HEAD_SIDE, view: 'side' },
    open: { g: HEAD_SIDE_OPEN, view: 'side' },
    hurt: { g: HEAD_SIDE_HURT, view: 'side' },
    happy: { g: HEAD_SIDE_HAPPY, view: 'side' },
    blink: { g: HEAD_SIDE_BLINK, view: 'side' },
    look: { g: HEAD_SIDE_LOOK, view: 'side' },
    grit: { g: HEAD_SIDE_GRIT, view: 'side' },
    back: { g: HEAD_BACK, view: 'back' }
  };

  // ---- Bodies: 16 wide strings, authored for rows 14..27 of the frame (14 rows) ----
  // Placed at x=4 inside the 24-wide canvas. Use '.' where empty.
  function body(rowsArr) { return rowsArr; }

  var B_IDLE = body([
    '.....jjtttjj....',
    '....vjqtttqjv...',
    '...vvjqtttqjvv..',
    '...vVjqtttqjVv..',
    '...vVjqtttqjVv..',
    '...ssjqtttqjss..',
    '...ssjjbbbjjss..',
    '.....bBbbbBb....',
    '.....bbbBbbb....',
    '.....bbb.bbb....',
    '.....lll.lll....',
    '.....lll.lll....',
    '.....lll.lll....',
    '....ffFF.ffFF...'
  ]);
  var B_IDLE2 = body([
    '.....jjtttjj....',
    '....vjqtttqjv...',
    '...vvjqtttqjvv..',
    '...vVjqtttqjVv..',
    '...vVjqtttqjVv..',
    '...ssjqtttqjss..',
    '...ssjjbbbjjss..',
    '.....bBbbbBb....',
    '.....bbbBbbb....',
    '.....bbb.bbb....',
    '.....lll.lll....',
    '.....lll.lll....',
    '.....lll.lll....',
    '....ffFF.ffFF...'
  ]);

  /* ---- Full-canvas pose bodies (24 wide, stamped at x=0). Each pose is { y: top canvas row, r: rows }.
   * Depth: near limbs use the bright chars (v sleeve, s hand, l leg, f foot); far limbs use the
   * shade chars (V sleeve, S hand, L leg, F foot) so every skin shows which limb is in front. */
  function pose(y, r) { return { y: y, r: r }; }

  // RUN: 8 frames. 0 contact (near leg forward), 1 down, 2 pass, 3 up/flight, 4-7 the same with
  // the far leg leading. Torso leans forward 1px; bob = [0, +1, 0, -1].
  var RUN = [
    pose(14, [ // contact, near leg leading
      '..........jjtttjj.......',
      '........vvjqtttqjV......',
      '.......vVvjqtTtqjVSS....',
      '......vV..jqtttqj.SS....',
      '......ss..jqtTtqj.......',
      '......ss..jqtttqj.......',
      '..........jjbbbjj.......',
      '..........bBbbbBb.......',
      '.........bbbbBbbbb......',
      '.........LLL...lll......',
      '........LLL.....lll.....',
      '........LL.......lll....',
      '.......FFL........lll...',
      '..................ffff..'
    ]),
    pose(15, [ // down, near leg leading
      '..........jjtttjj.......',
      '.........vjqtttqjV......',
      '........vVjqtTtqjVSS....',
      '.......vV.jqtttqj.SS....',
      '.......ss.jqtTtqj.......',
      '.......ss.jqtttqj.......',
      '..........jjbbbjj.......',
      '..........bBbbbBb.......',
      '.....FF..bbbbBbbbb......',
      '......FFL.LL..lll.......',
      '........LLL....lll......',
      '...............lll......',
      '..............ffFF......'
    ]),
    pose(14, [ // pass, near leg leading
      '..........jjtttjj.......',
      '.........Vjqtttqjv......',
      '........VVjqtTtqjvV.....',
      '........VVjqtttqjvv.....',
      '........SSjqtTtqj.ss....',
      '..........jqtttqj.ss....',
      '..........jjbbbjj.......',
      '..........bBbbbBb.......',
      '..........bbbBbbbbL.....',
      '............lllLLL......',
      '............lll.LLL.....',
      '............lll.FF......',
      '............lll.........',
      '...........ffFF.........'
    ]),
    pose(13, [ // flight, near leg leading
      '..........jjtttjj.......',
      '.........Vjqtttqjv..ss..',
      '........VVjqtTtqjvvvss..',
      '.......VV.jqtttqjVv.....',
      '......SS..jqtTtqj.......',
      '......SS..jqtttqj.......',
      '..........jjbbbjj.......',
      '..........bBbbbBb.......',
      '.........bbbbBbbbbLL....',
      '.........ll......LLL....',
      '....ff...ll.......LLL...',
      '......llll.........LL...',
      '..................FFF...',
      '........................',
      '........................'
    ]),
    pose(14, [ // contact, far leg leading
      '..........jjtttjj.......',
      '.........Vjqtttqjv......',
      '........VVjqtTtqjvvss...',
      '.......VV.jqtttqjVvss...',
      '.......SS.jqtTtqj.......',
      '.......SS.jqtttqj.......',
      '..........jjbbbjj.......',
      '..........bBbbbBb.......',
      '.........bbbbBbbbb......',
      '.........lll...LLL......',
      '........lll.....LLL.....',
      '........ll.......LLL....',
      '.......ffl........LLL...',
      '..................FFFF..'
    ]),
    pose(15, [ // down, far leg leading
      '..........jjtttjj.......',
      '.........Vjqtttqjv......',
      '........VVjqtTtqjvvss...',
      '.......VV.jqtttqjVvss...',
      '.......SS.jqtTtqj.......',
      '.......SS.jqtttqj.......',
      '..........jjbbbjj.......',
      '..........bBbbbBb.......',
      '.....ff..bbbbBbbbb......',
      '......ffl.ll..LLL.......',
      '........lll....LLL......',
      '...............LLL......',
      '..............FFff......'
    ]),
    pose(14, [ // pass, far leg leading
      '..........jjtttjj.......',
      '.........vjqtttqjV......',
      '........vVjqtTtqjVV.....',
      '........vvjqtttqjVV.....',
      '........ssjqtTtqj.SS....',
      '..........jqtttqj.SS....',
      '..........jjbbbjj.......',
      '..........bBbbbBb.......',
      '..........bbbBbbbbl.....',
      '............LLLlll......',
      '............LLL.lll.....',
      '............LLL.ff......',
      '............LLL.........',
      '...........FFff.........'
    ]),
    pose(13, [ // flight, far leg leading
      '..........jjtttjj.......',
      '.........vjqtttqjV..SS..',
      '........vvjqtTtqjVVVSS..',
      '.......vV.jqtttqj.......',
      '......ss..jqtTtqj.......',
      '......ss..jqtttqj.......',
      '..........jjbbbjj.......',
      '..........bBbbbBb.......',
      '.........bbbbBbbbbll....',
      '.........LL......lll....',
      '....FF...LL.......lll...',
      '......LLLL.........ll...',
      '..................fff...',
      '........................',
      '........................'
    ])
  ];
  var RUN_BOB = [0, 1, 0, -1, 0, 1, 0, -1];

  // JUMP: 0 takeoff/rise (stretched, fist up), 1 apex (tucked, arms out for balance)
  var JUMP_RISE = pose(6, [
    '....................ss..',
    '....................ss..',
    '....................vv..',
    '...................vVv..',
    '..................vvv...',
    '................vvv.....',
    '.........jjtttjjvv......',
    '........VjqtttqjV.......',
    '.......VVjqtTtqj........',
    '......VV.jqtttqj........',
    '......SS.jqtTtqj........',
    '.........jqtttqj........',
    '.........jjbbbjj........',
    '.........bBbbbBb........',
    '........bbbbBbbbbl......',
    '........Lbbb...llll.....',
    '........LLL......ll.....',
    '.........LLL....ffF.....',
    '..........LLL...........',
    '...........FFF..........'
  ]);
  var JUMP_APEX = pose(12, [
    '.........jjtttjj........',
    '....ss.vvjqtttqjvv.ss...',
    '....ssVVVjqtTtqjvvvss...',
    '.........jqtttqj........',
    '.........jqtTtqj........',
    '.........jqtttqj........',
    '.........jjbbbjj........',
    '.........bBbbbBb........',
    '........bbbbBbbbbll.....',
    '.......LLLbb...lllll....',
    '......LLLL.......lll....',
    '.......FF.......fFF.....'
  ]);
  // FALL: 0 early fall (legs reaching down), 1 fast fall (arms flung up, flail)
  var FALL_A = pose(10, [
    '.....ss..........ss.....',
    '.....SS..........ss.....',
    '......VV........vv......',
    '.......VVjjtttjjvv......',
    '........VjqtttqjV.......',
    '.........jqtTtqj........',
    '.........jqtttqj........',
    '.........jqtTtqj........',
    '.........jqtttqj........',
    '.........jjbbbjj........',
    '.........bBbbbBb........',
    '.........bbbBbbb........',
    '........LLbb.bbll.......',
    '.......LLL....lll.......',
    '.......LL.....lll.......',
    '......FFF.....lll.......',
    '.............ffFF.......'
  ]);
  var FALL_B = pose(9, [
    '....ss............ss....',
    '....SS............ss....',
    '.....VV..........vv.....',
    '......VV........vv......',
    '.......VVjjtttjjvv......',
    '........VjqtttqjV.......',
    '.........jqtTtqj........',
    '.........jqtttqj........',
    '.........jqtTtqj........',
    '.........jqtttqj........',
    '.........jjbbbjj........',
    '.........bBbbbBb........',
    '.........bbbBbbb........',
    '........LLbb.bbl........',
    '.......LLL....lll.......',
    '......LLL.....lll.......',
    '.....FFF......lll.......',
    '.............ffFF.......'
  ]);
  // LAND: 0 squash (knees out, arms down for balance), 1 recover
  var LAND_SQUASH = pose(17, [
    '.........jjtttjj........',
    '........vjqtttqjv.......',
    '......vvVjqtTtqjVvv.....',
    '.....ss..jqtttqj..ss....',
    '.....ss..jjbbbjj..ss....',
    '........bbBbbbBbb.......',
    '.......bbbbbBbbbbb......',
    '......LLLl.....llll.....',
    '.....LLL.........lll....',
    '.....LLL.........lll....',
    '....FFFF.........ffFF...'
  ]);
  // SKID: Carl already faces the new direction while momentum drags him backwards; he leans in,
  // the back leg braces and the front knee bends.
  var SKID = pose(15, [
    '...........jjtttjj......',
    '..........vjqtttqjvvss..',
    '.........vVjqtTtqjvvss..',
    '........VV.jqtttqj......',
    '.......SS..jqtTtqj......',
    '.......SS..jjbbbjj......',
    '...........bBbbbBb......',
    '..........bbbbBbbbb.....',
    '........LLbbb...bblll...',
    '......LLL........lll....',
    '....LLL..........lll....',
    '..FLL...........ffFF....',
    '.FFF....................'
  ]);
  // PUNCH extras: cross (far arm) and the 3rd-hit haymaker with a lean-back windup and a lunge.
  var CROSS = pose(14, [
    '..........jjtttjj.......',
    '........vvjqtttqjVVVVSS.',
    '.......vVsjqtTtqjVVVVSS.',
    '.......ss.jqtttqj.......',
    '..........jqtTtqj.......',
    '..........jqtttqj.......',
    '..........jjbbbjj.......',
    '..........bBbbbBb.......',
    '.........bbbbBbbbb......',
    '........LLL....lll......',
    '.......LLL......lll.....',
    '.......LLL......lll.....',
    '......FFFF......ffFF....'
  ]);
  var HAY_WIND = pose(14, [
    '.....ss..jjtttjj........',
    '.....ssvvjqtttqjV.......',
    '.......vVjqtTtqjVSS.....',
    '.........jqtttqj.SS.....',
    '.........jqtTtqj........',
    '.........jqtttqj........',
    '.........jjbbbjj........',
    '.........bBbbbBb........',
    '........bbbbBbbbb.......',
    '.......LLL....lll.......',
    '......LLL.....lll.......',
    '......LLL......lll......',
    '.....FFFF......ffFF.....'
  ]);
  var HAY_HIT = pose(15, [
    '...........jjtttjj......',
    '.........VVjqtttqjvvvsss',
    '........VVSjqtTtqjvvvsss',
    '...........jqtttqj...sss',
    '...........jqtTtqj......',
    '...........jjbbbjj......',
    '...........bBbbbBb......',
    '..........bbbbBbbbb.....',
    '........LLbbb....bll....',
    '......LLL.........lll...',
    '....LLL...........lll...',
    '...FFF...........ffFF...'
  ]);
  // KICK anticipation: weight back, guard up, near knee starting to lift
  var KICK_PREP = pose(14, [
    '........jjtttjj.........',
    '.......vjqtttqjv........',
    '......vVjqtTtqjvv.......',
    '......ss.jqtttqj.ss.....',
    '......ss.jqtTtqj.ss.....',
    '.........jqtttqj........',
    '.........jjbbbjj........',
    '.........bBbbbBb........',
    '........bbbbBbbbb.......',
    '.......LLL....lll.......',
    '......LLL.....lll.......',
    '......LLL.....lll.......',
    '.....FFFF.....ffFF......'
  ]);
  // punch: canvas-wide (24) bodies so the fist can reach out. rows 14..27
  var B_PUNCH1 = [
    '.........jjtttjj........',
    '........vjqtttqjv.......',
    '.......vVjqtTtqjvvss....',
    '......ssVjqtttqjVvss....',
    '......ss.jqtTtqj........',
    '.........jqtttqj........',
    '.........jjbbbjj........',
    '.........bBbbbBb........',
    '........bbbbBbbbb.......',
    '........bbb...bbb.......',
    '........lll....lll......',
    '.......lll......lll.....',
    '.......lll......lll.....',
    '......ffFF......ffFF....'
  ];
  var B_PUNCH2 = [
    '.........jjtttjj........',
    '........vjqtttqjv.......',
    '.......vVjqtttqjvvvvVss.',
    '......ssVjqtttqjvvvvVss.',
    '......ss.jqtTtqj........',
    '.........jqtttqj........',
    '.........jjbbbjj........',
    '.........bBbbbBb........',
    '........bbbbBbbbb.......',
    '........bbb...bbb.......',
    '........lll....lll......',
    '.......lll......lll.....',
    '.......lll......lll.....',
    '......ffFF......ffFF....'
  ];
  var B_KICK1 = [
    '.........jjtttjj........',
    '........vjqtttqjv.......',
    '.......vVjqtttqjVv......',
    '.......ss.qtttqjVv......',
    '.......ss.jqtTtqjss.....',
    '.........jqtttqjss......',
    '.........jjbbbjj........',
    '.........bBbbbBbb.......',
    '........bbbbBbbbbll.....',
    '........bbb....llll.....',
    '........lll.....ffFF....',
    '........lll.............',
    '........lll.............',
    '.......ffFF.............'
  ];
  var B_KICK2 = [
    '........jjtttjj.........',
    '.......vjqtttqjv........',
    '......vVjqtttqjVv.......',
    '.....ss.jqtttqjVv.......',
    '.....ss.jqtTtqj.ss......',
    '........jqtttqj.ss......',
    '........jjbbbjj.........',
    '........bBbbbBbbbllllff.',
    '.......bbbbBbbbbllllfFF.',
    '.......bbb...........FF.',
    '.......lll..............',
    '.......lll..............',
    '.......lll..............',
    '......ffFF..............'
  ];
  var B_THROW = [
    '.........jjtttjj..ss....',
    '........vjqtttqjvvss....',
    '.......vVjqtTtqjvVv.....',
    '......ssVjqtttqjj.......',
    '......ss.jqtTtqj........',
    '.........jqtttqj........',
    '.........jjbbbjj........',
    '.........bBbbbBb........',
    '........bbbbBbbbb.......',
    '........bbb...bbb.......',
    '.......lll.....lll......',
    '.......lll......lll.....',
    '......lll.......lll.....',
    '.....ffFF.......ffFF....'
  ];
  var B_HURT = [
    '........jjtttjj.........',
    '......vvjqtttqjvv.......',
    '.....vVvjqtTtqjvVv......',
    '....ss..jqtttqj..ss.....',
    '....ss..jqtTtqj..ss.....',
    '........jqtttqj.........',
    '........jjbbbjj.........',
    '........bBbbbBb.........',
    '........bbbBbbbb........',
    '.......bbb...bbb........',
    '.......lll....lll.......',
    '......lll......lll......',
    '......lll......lll......',
    '.....ffFF.......ffFF....'
  ];
  var B_CLIMB = [
    [
      '.....ss....ss...',
      '.....vv....vv...',
      '.....vv....vV...',
      '.....vJjjjjjV...',
      '.....jjjjjjjj...',
      '.....jjjJJjjj...',
      '.....jjjjjjjj...',
      '.....bbbbbbbb...',
      '.....bBbbbbBb...',
      '.....bbb..bbb...',
      '.....lll..lll...',
      '.....lll..fFF...',
      '.....lll........',
      '.....fFF........'
    ],
    [
      '.....ss....ss...',
      '.....vv....vv...',
      '.....Vv....vv...',
      '.....VjjjjjJv...',
      '.....jjjjjjjj...',
      '.....jjjJJjjj...',
      '.....jjjjjjjj...',
      '.....bbbbbbbb...',
      '.....bBbbbbBb...',
      '.....bbb..bbb...',
      '.....lll..lll...',
      '.....fFF..lll...',
      '..........lll...',
      '..........fFF...'
    ]
  ];
  var B_VICTORY = [
    '...........ss....',
    '...........ss....',
    '....jjtttjjvv....',
    '...vjqtttqjvV....',
    '..vVjqtTtqj......',
    '..ssjqtttqj......',
    '..ssjqtTtqj......',
    '....jjbbbjj......',
    '....bBbbbBb......',
    '....bbbBbbb......',
    '...bbb...bbb.....',
    '...lll...lll.....',
    '..lll.....lll....',
    '.ffFF.....ffFF...'
  ];
  // diving stomp kick: body angled, near foot points down-forward
  var B_AIRKICK = [
    '......vvjjtttjj.........',
    '.....ssVjqtttqjv........',
    '.....ss.jqtTtqjvv.......',
    '........jqtttqjVvss.....',
    '........jqtTtqj..ss.....',
    '........jjbbbjj.........',
    '........bBbbbBbb........',
    '.......bbbbBbbbbb.......',
    '......lbbb....bbbl......',
    '.....llll......llll.....',
    '....ffFF........llll....',
    '.................llll...',
    '..................lffF..',
    '...................fFF..'
  ];
  // dead: lying on back (whole body built rotated)

  // frame builder: [{head:'side', hx, hy}, body rows, bodyX, bodyY]
  function carlFrame(headKey, hx, hy, bodyRows, bx, by, opt) {
    opt = opt || {};
    var g = blank(CW, CH);
    if (opt.headUnder) stampHeadRef(g, headKey, hx, hy, opt);
    stamp(g, bodyRows, bx, by);
    var f = { base: g, heads: [] };
    f.heads.push({ key: headKey, x: hx, y: hy, rot: opt.rot || 0, flip: !!opt.flip, under: !!opt.headUnder });
    if (!opt.headUnder) stampHeadRef(g, headKey, hx, hy, opt);
    return f;
  }
  function headGrid(key, rot, flip) {
    var g = P(HEADS[key].g, 12, 12);
    if (flip) g = flipH(g);
    if (rot === 1) g = rotCW(g); else if (rot === -1) g = rotCCW(g);
    return g;
  }
  function stampHeadRef(g, key, x, y, opt) { stamp(g, headGrid(key, opt.rot || 0, opt.flip), x, y); }

  // ---- overworld (top-down) Carl: 16x20 canvas ----
  var OWW = 16, OWH = 20;
  var OW_HEAD_FRONT = [
    '..hhhhhhhh..',
    '.hhhhhhhhhh.',
    'hhhhhhhhhhhh',
    'hhhhshhshhhh',
    'hhsssssssshh',
    'SsswwsswwssS',
    'SsseesseessS',
    '.ssssSSssss.',
    '..sSsmmsSs..',
    '...SsSsSS...'
  ];
  var OW_HEAD_BACK = [
    '..hhhhhhhh..',
    '.hhhhhhhhhh.',
    'hhhhhhhhhhhh',
    'hhhhhhhhhhhh',
    'hhhhhhhhhhhh',
    'Shhhhhhhhhhs',
    'Shhhhhhhhhhs',
    '.hhhhhhhhhh.',
    '..ssssssss..',
    '...SSSSSS...'
  ];
  var OW_HEAD_SIDE = [
    '..hhhhhhh...',
    '.hhhhhhhhhh.',
    'hhhhhhhhhhhh',
    'hhhhhhshhsh.',
    'hhSssssssss.',
    'hSkSsssswes.',
    'hSSssssswes.',
    '.hSssssssssn',
    '..SssssmmmS.',
    '...SSSSSSS..'
  ];
  HEADS.owf = { g: OW_HEAD_FRONT, view: 'front', h: 10 };
  HEADS.owb = { g: OW_HEAD_BACK, view: 'back', h: 10 };
  HEADS.ows = { g: OW_HEAD_SIDE, view: 'side', h: 10 };

  var OW_BODY_DOWN = [
    [
      '..vjqtttqjv.',
      '.vVjqtttqjVv',
      '.ssjqtttqjss',
      '...bBbbBb...',
      '...bbb.bbb..',
      '...ll...ll..',
      '..ffF...fF..',
      '............'
    ],
    [
      '..vjqtttqjv.',
      '.vVjqtttqjVv',
      '.ssjqtttqjss',
      '...bBbbBb...',
      '..bbb.bbb...',
      '..ll...ll...',
      '..fF...fFf..',
      '............'
    ]
  ];
  var OW_BODY_UP = [
    [
      '..vjjjjjjv..',
      '.vVjjJJjjVv.',
      '.ssjjjjjjss.',
      '...bbbbbb...',
      '...bbb.bbb..',
      '...ll...ll..',
      '...ff...ff..',
      '............'
    ],
    [
      '..vjjjjjjv..',
      '.vVjjJJjjVv.',
      '.ssjjjjjjss.',
      '...bbbbbb...',
      '..bbb.bbb...',
      '..ll...ll...',
      '..ff...ff...',
      '............'
    ]
  ];
  var OW_BODY_SIDE = [
    [
      '...jjttj....',
      '..vjqtTj....',
      '..vVjttjj...',
      '..ss.bBbb...',
      '...bbb.bbb..',
      '..ll....ll..',
      '.ffF....fFf.',
      '............'
    ],
    [
      '...jjttj....',
      '...vjqTj....',
      '...vVttj....',
      '...ssbBb....',
      '....bbbb....',
      '....llll....',
      '....ffFF....',
      '............'
    ]
  ];
  function owFrame(headKey, bodyRows, headDy, bodyDx) {
    var g = blank(OWW, OWH);
    var hy = 2 + (headDy || 0);
    stamp(g, bodyRows, 2 + (bodyDx || 0), 11);
    stamp(g, P(HEADS[headKey].g, 12, 10), 2, hy);
    return { base: g, heads: [{ key: headKey, x: 2, y: hy, rot: 0, flip: false }] };
  }

  // ---- all carl frames ----
  var CARL = {};
  (function () {
    var BX = 4, BY = 14;     // body offset in canvas (16-wide bodies)
    var HX = 7, HY = 4;      // head position for standing frames
    CARL.carl_idle = [carlFrame('side', HX, HY, B_IDLE, BX, BY), carlFrame('side', HX, HY + 1, B_IDLE2, BX, BY + 1)];
    // idle 2: body squats 1px (breathing) - drop the top row of body to keep feet planted
    CARL.carl_idle[1] = (function () {
      var g = blank(CW, CH);
      stamp(g, B_IDLE2.slice(0, 6).concat(B_IDLE2.slice(7)), BX, BY + 1);
      var f = { base: g, heads: [{ key: 'side', x: HX, y: HY + 1, rot: 0, flip: false }] };
      stamp(g, headGrid('side'), HX, HY + 1);
      return f;
    })();
    // idle 1: inhale (chest and shoulders rise 1px); 3: blink; 4: glance back over the shoulder
    CARL.carl_idle.push(
      carlFrame('side', HX, HY - 1, B_IDLE.slice(0, 3).concat(B_IDLE.slice(2)), BX, BY - 1),
      carlFrame('blink', HX, HY, B_IDLE, BX, BY),
      carlFrame('look', HX, HY, B_IDLE, BX, BY)
    );
    CARL.carl_idle = [CARL.carl_idle[0], CARL.carl_idle[2], CARL.carl_idle[1], CARL.carl_idle[3], CARL.carl_idle[4]];
    function P2(head, hx, hy, p) { return carlFrame(head, hx, hy, p.r, 0, p.y); }
    CARL.carl_run = RUN.map(function (p, i) { return P2('side', HX + 1, HY + RUN_BOB[i], p); });
    CARL.carl_jump = [P2('open', HX, HY - 2, JUMP_RISE), P2('open', HX, HY - 2, JUMP_APEX)];
    CARL.carl_fall = [P2('open', HX, HY - 1, FALL_A), P2('hurt', HX, HY - 1, FALL_B)];
    CARL.carl_land = [P2('side', HX, HY + 3, LAND_SQUASH), CARL.carl_idle[2]];
    CARL.carl_skid = [P2('grit', HX + 2, HY + 1, SKID)];
    // punch: 0 jab chamber, 1 jab, 2 cross (far fist), 3 haymaker windup, 4 haymaker
    CARL.carl_punch = [carlFrame('side', HX + 1, HY, B_PUNCH1, 0, BY), carlFrame('open', HX + 2, HY, B_PUNCH2, 0, BY),
      P2('grit', HX + 1, HY, CROSS), P2('grit', HX - 1, HY, HAY_WIND), P2('open', HX + 2, HY + 1, HAY_HIT)];
    // kick: 0 chamber, 1 extended, 2 anticipation
    CARL.carl_kick = [carlFrame('side', HX, HY, B_KICK1, 0, BY), carlFrame('open', HX - 1, HY + 1, B_KICK2, 0, BY),
      P2('grit', HX - 1, HY, KICK_PREP)];
    CARL.carl_airkick = [carlFrame('open', HX - 2, HY - 1, B_AIRKICK, 0, BY)];
    CARL.carl_throw = [carlFrame('open', HX + 1, HY, B_THROW, 0, BY)];
    CARL.carl_hurt = [carlFrame('hurt', HX - 2, HY + 1, B_HURT, 0, BY)];
    CARL.carl_climb = (function () {
      var A = ['', '', '.....ss', '.....ss'];
      for (var i = 4; i < 14; i++) A.push('.....vv');
      A = A.concat([
        '.....vVjjjjjjjjjjvss....',
        '.....vVjjjjjjjjjjvss....',
        '.......jjjjJJjjjj.......',
        '.......jjjjJJjjjj.......',
        '.......jjjjjjjjjj.......',
        '.......jjjjjjjjjj.......',
        '........bbbbbbbb........',
        '........bBbbbbBb........',
        '........bbb..bbb........',
        '........lll..lll........',
        '........lll..lll........',
        '........lll..fFF........',
        '........lll.............',
        '........fFF.............'
      ]);
      var bodyA = P(A, CW, CH);
      function mk(flip) {
        var g = blank(CW, CH);
        stamp(g, headGrid('back', 0, flip), 6, 6);
        stamp(g, flip ? flipH(bodyA) : bodyA, 0, 0);
        return { base: g, heads: [{ key: 'back', x: 6, y: 6, rot: 0, flip: flip }] };
      }
      return [mk(false), mk(true)];
    })();
    CARL.carl_victory = [carlFrame('happy', HX, HY, B_VICTORY, BX, BY)];
    // dead: lying on his back, head on the left. Build an upright body then rotate.
    CARL.carl_dead = [(function () {
      var g = blank(CW, CH);
      var lying = [
        '............fF',
        '............ff',
        'vvVvvjj.....ll',
        'jqtttqjbBbblll',
        'jqtTtqjbbbBlll',
        'jjjjjjjbbbbll.',
        'vvVvvss.......'
      ];
      stamp(g, lying, 10, 20);
      var f = { base: g, heads: [] };
      var hx = 0, hy = CH - 12;
      f.heads.push({ key: 'hurt', x: hx, y: hy, rot: -1, flip: false });
      stamp(g, headGrid('hurt', -1), hx, hy);
      return f;
    })()];
    CARL.carl_ow_down = [owFrame('owf', OW_BODY_DOWN[0], 0), owFrame('owf', OW_BODY_DOWN[1], 1)];
    CARL.carl_ow_up = [owFrame('owb', OW_BODY_UP[0], 0), owFrame('owb', OW_BODY_UP[1], 1)];
    CARL.carl_ow_side = [owFrame('ows', OW_BODY_SIDE[0], 0), owFrame('ows', OW_BODY_SIDE[1], 0)];
  })();

  /* ---------------- Carl skins ----------------
   * Each skin: pal (base char recolours), pat(c, x, y) optional per-pixel pattern colour,
   * acc(o, view, H) optional accessory painter on a colour overlay (local head canvas).
   */
  function H_side(o) { /* helper no-op */ return o; }

  var SKIN_DEFS = {};
  SKIN_DEFS.carl_boxers = { pal: {} };
  // Book One skins. carl_trollskin: the Enchanted Trollskin Shirt of Pummeling (mottled gray-green,
  // form-fitting) shows under the open jacket. carl_bigboi: the shirt + the Enchanted BigBoi Boxers
  // (gold-and-purple).
  var TROLL = { t: C.g0, T: C.G0 };
  function trollPat(c, k) { if (c === 't' && (k === 'd' || k === 'x')) return C.G0; }
  SKIN_DEFS.carl_trollskin = { pal: { t: TROLL.t, T: TROLL.T }, pat: trollPat };
  SKIN_DEFS.carl_bigboi = {
    pal: { t: TROLL.t, T: TROLL.T, b: C.p0, B: C.y2 },
    pat: function (c, k) {
      var tp = trollPat(c, k); if (tp) return tp;
      if (c === 'b' && k === 'd') return C.y2;     // gold sparkle bits on the purple
    }
  };
  var PATCH = 'jJvVtbBl';
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
    var skinIds = Object.keys(SKIN_DEFS);
    var used = {}; Object.keys(CARL_PAL).forEach(function (k) { used[k] = 1; }); used['.'] = 1; used[' '] = 1;
    var pool = [];
    var cand = '0123456789DGHIKLMNOPQRUWXYZcdgiopruxyz!#$%&()*+,-/:;<=>?@[]^_{|}~`';
    for (var i = 0; i < cand.length; i++) if (!used[cand[i]] && pool.indexOf(cand[i]) < 0) pool.push(cand[i]);
    for (i = 0xC0; i <= 0xFF; i++) if (i !== 0xD7 && i !== 0xF7) pool.push(String.fromCharCode(i));
    for (i = 0x100; i < 0x250; i++) pool.push(String.fromCharCode(i));
    var sigMap = {}, genPal = {}; // sig -> char ; char -> {skin: colour}
    skinIds.forEach(function (s) { genPal[s] = {}; });
    function resolved(s, c) { var sp = SKIN_DEFS[s].pal; return sp[c] !== undefined ? sp[c] : CARL_PAL[c]; }

    function composeSkin(f, s, w, h) {
      var sd = SKIN_DEFS[s];
      var col = [];
      for (var y = 0; y < h; y++) {
        var r = [];
        for (var x = 0; x < w; x++) {
          var c = f.base[y][x], v = null;
          if (!T(c)) {
            v = resolved(s, c);
            if (sd.pat && PATCH.indexOf(c) >= 0) { var pv = sd.pat(c, patClass(x, y)); if (pv !== undefined && pv !== null) v = pv; }
          }
          r.push(v);
        }
        col.push(r);
      }
      // accessories
      if (sd.acc) f.heads.forEach(function (hd) {
        var hh = HEADS[hd.key].h || 12;
        var M = 6, LW = 12 + M * 2, LH = hh + M * 2;
        var o = []; for (var y2 = 0; y2 < LH; y2++) { var rr = []; for (var x2 = 0; x2 < LW; x2++) rr.push(undefined); o.push(rr); }
        var view = HEADS[hd.key].view;
        sd.acc(o, { x: M, y: M, w: 12, h: hh, view: view, key: hd.key });
        // place (rotation for the dead pose)
        var ow = LW, oh = LH, get = function (i, j) { return o[j][i]; };
        if (hd.rot === -1) { ow = LH; oh = LW; get = function (i, j) { return o[i][LW - 1 - j]; }; }
        else if (hd.rot === 1) { ow = LH; oh = LW; get = function (i, j) { return o[LH - 1 - i][j]; }; }
        for (var j = 0; j < oh; j++) for (var i = 0; i < ow; i++) {
          var v = get(i, j); if (v === undefined) continue;
          var X = hd.x - M + i, Y = hd.y - M + j;
          if (hd.rot) { X = hd.x - M + i; Y = hd.y - M + j; }
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
            var expect = T(c) ? (v === C.K ? C.K : null) : resolved(s, c);
            if (T(c) && v === C.K) { /* outline */ }
            if ((v || null) !== (T(c) ? null : expect)) allSame = false;
          }
          if (!any) continue;
          if (!T(c) && allSame) { g[y][x] = c; continue; }
          // pure outline everywhere?
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
    var def0 = genPal.carl_boxers;
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
    DCW.artActorsKit.carlCharsUsed = Object.keys(sigMap).length;
    // Donut mode: Carl follows as a companion, whose sprite set is <id>_idle / _run / _act
    if (defs.carl_punch) defs.carl_act = { w: defs.carl_punch.w, h: defs.carl_punch.h, pal: defs.carl_punch.pal, frames: [defs.carl_punch.frames[1], defs.carl_punch.frames[2]], ox: defs.carl_punch.ox || 0, oy: defs.carl_punch.oy || 0 };
  })();

  /* ================================================================== *
   *  Generic sprite helpers (fill-only art -> padded + outlined defs)
   * ================================================================== */
  // frames: arrays of row strings. All frames padded to a common size, then +pad px each side, outlined.
  function build(frames, pad) {
    pad = pad === undefined ? 1 : pad;
    var gs = frames.map(function (f) { return typeof f[0] === 'string' ? P(f) : f; });
    var w = 0, h = 0;
    gs.forEach(function (g) { w = Math.max(w, GW(g)); h = Math.max(h, GH(g)); });
    return gs.map(function (g) { return outlined(resize(g, w + pad * 2, h + pad * 2, pad, pad)); });
  }
  function withK(pal) { var o = { k: C.K }; for (var q in pal) o[q] = pal[q]; return o; }
  // Princess Donut is a tortoiseshell Persian: "fuzzy, black and beige and white" with big
  // yellow eyes. tortie() mottles her dark base fur ('o') with blocky beige ('t'), black ('x')
  // and a little warm brown ('O'). The pattern is fixed per cell so idle frames keep the same coat.
  var TORTIE = { o: C.y0, t: C.n3, O: C.y1, c: C.W, w: C.y3, e: C.K };
  function tortieCell(x, y, cell, seed) {
    var h = Math.imul(Math.floor(x / cell) + 31, 73856093) ^ Math.imul(Math.floor(y / cell) + 17, 19349663) ^ seed;
    h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16;
    var v = (h >>> 0) % 100;
    return v < 24 ? 't' : v < 42 ? 'x' : v < 50 ? 'O' : 'o';
  }
  function tortieGrid(g, cell, seed) {
    for (var y = 0; y < g.length; y++) for (var x = 0; x < g[y].length; x++) if (g[y][x] === 'o') g[y][x] = tortieCell(x, y, cell, seed);
    return g;
  }
  function tortie(frames, cell, seed) {
    return frames.map(function (f) { return tortieGrid(typeof f[0] === 'string' ? P(f) : f.map(function (r) { return r.slice(); }), cell || 2, seed || 7); });
  }
  function spr(name, pal, frames, opt) { return def(name, withK(pal), build(frames, opt && opt.pad), opt); }
  // replace rows from index i
  function alt(base, i, newRows) { var r = base.slice(); for (var j = 0; j < newRows.length; j++) r[i + j] = newRows[j]; return r; }
  // replace rows counting from the bottom (n rows)
  function legs(base, newRows) { return alt(base, base.length - newRows.length, newRows); }
  // per-pixel char swap inside a row-string frame
  function swap(base, map) { return base.map(function (r) { var o = ''; for (var i = 0; i < r.length; i++) o += map[r[i]] !== undefined ? map[r[i]] : r[i]; return o; }); }
  function hurtPal(pal) { var p = lightPal(pal); if (p.e !== undefined) p.e = C.W; return p; }
  // enemy: walk(2) attack hurt. hurtRows optional (defaults to walk0 with lightened palette)
  function enemy(id, pal, walk0, walk1, attack, hurtRows, opt) {
    var fr = build([walk0, walk1, attack, hurtRows || walk0], opt && opt.pad);
    var P2 = withK(pal);
    def(id + '_walk', P2, [fr[0], fr[1]], opt);
    def(id + '_attack', P2, [fr[2]], opt);
    def(id + '_hurt', withK(hurtPal(pal)), [fr[3]], opt);
  }

  /* ================================================================== *
   *  COMPANIONS (face right)
   * ================================================================== */
  (function () {
    // ---- Princess Donut: Persian show cat with a purple-jeweled tiara ----
    var dp = { o: TORTIE.o, t: TORTIE.t, c: TORTIE.c, O: TORTIE.O, e: TORTIE.e, w: TORTIE.w, p: C.m2, y: C.y2, j: C.p1, m: C.m2, x: C.K };
    var d0 = [
      '........j.j.j.',
      '........yyjyy.',
      'o......OoooooO',
      'oo.....ooOooOo',
      'oo.....oweowe.',
      '.o.....cccpcc.',
      '.ooooooccxcc..',
      'oooooooocccc..',
      'ooooooooocc...',
      'oocccccoooo...',
      '.cccccccooo...',
      '.O.O....O.O...'
    ];
    var dact = alt(d0, 2, ['o......OoooooO', 'oo.....oooooom', 'oo.....omeome.', '.o.....cccpccm', '.ooooooccxxc.m']);
    dact = alt(dact, 0, ['......m.j.j.j.', '.....m..yyjyy.']);
    // idle: 0 rest, 1 breath in (back rises), 2 tail curls over, 3 tail flicks back,
    // 4 right ear twitches flat, 5 slow blink. stage.js plays them on a long timeline.
    var dI = [
      d0,
      alt(d0, 5, ['.o.oooocccpcc.']),
      alt(d0, 0, ['........j.j.j.', '.oo.....yyjyy.', 'oo.....OoooooO', 'o......ooOooOo', 'oo.....oweowe.', '.o.....cccpcc.']),
      alt(d0, 0, ['o.......j.j.j.', 'oo......yyjyy.', '.o.....OoooooO', '.o.....ooOooOo', '.o.....oweowe.', '.o.....cccpcc.']),
      alt(d0, 2, ['o......Ooooooo', 'oo.....ooOoooO']),
      alt(d0, 4, ['oo.....oOOoOO.'])
    ];
    // run: a bounding gallop built from a body oval, line legs and a fluffy tail, with the
    // idle head (tiara included, colours untouched) stamped on top. 18 x 13 fill.
    var DHEAD = P(d0.slice(0, 9).map(function (r) { return r.slice(7); }), 7, 9);
    for (var hy = 0; hy < 9; hy++) for (var hx = 0; hx < 7; hx++) {
      // keep only the head (cut the tail and back that share these rows)
      if (hy >= 6 && hx < 1) DHEAD[hy][hx] = '.';
    }
    function gallop(f) {
      var g = blank(18, 13), i;
      function leg(L, near) { line(g, L[0], L[1], L[2], L[3], near ? 'o' : 'O'); if (near) px(g, L[2], L[3], 'c'); }
      leg(f.ff, false); leg(f.hf, false);
      line(g, f.t[0], f.t[1], f.t[2], f.t[3], 'o', 2);
      px(g, f.t[2], f.t[3], 'c');
      oval(g, f.cx, f.cy, f.rx, f.ry, 'o');
      for (i = Math.round(f.cx - f.rx + 2); i <= Math.round(f.cx + f.rx - 1); i++) px(g, i, Math.round(f.cy + f.ry), 'c');
      leg(f.fn, true); leg(f.hn, true);
      stamp(g, DHEAD, 11, f.dy);
      return g;
    }
    var DR = [
      // extended suspension: front reaching, hind trailing
      { dy: 0, cx: 9, cy: 7, rx: 4.5, ry: 1.5, fn: [12, 9, 15, 11], ff: [12, 9, 16, 10], hn: [5, 8, 2, 10], hf: [5, 8, 1, 9], t: [4, 6, 1, 3] },
      // front feet land ahead
      { dy: 1, cx: 9, cy: 8, rx: 4.5, ry: 1.5, fn: [12, 9, 13, 12], ff: [12, 9, 14, 12], hn: [5, 9, 3, 11], hf: [5, 9, 2, 10], t: [4, 7, 1, 5] },
      // front legs push under the chest, hind legs swing forward
      { dy: 2, cx: 9, cy: 8, rx: 4, ry: 2, fn: [12, 10, 11, 12], ff: [12, 10, 12, 12], hn: [6, 10, 9, 11], hf: [6, 10, 8, 11], t: [5, 7, 2, 4] },
      // gathered suspension: all four tucked, back arched
      { dy: 0, cx: 9, cy: 7, rx: 3.5, ry: 2, fn: [12, 9, 10, 11], ff: [12, 9, 11, 11], hn: [6, 9, 9, 11], hf: [6, 9, 8, 10], t: [5, 6, 2, 2] },
      // hind feet land under the belly, front lift
      { dy: 1, cx: 9, cy: 8, rx: 4, ry: 2, fn: [12, 10, 14, 11], ff: [12, 10, 15, 10], hn: [6, 10, 8, 12], hf: [6, 10, 7, 12], t: [5, 7, 2, 4] },
      // hind push-off, body stretching out again
      { dy: 0, cx: 9, cy: 7, rx: 4.5, ry: 1.5, fn: [12, 8, 15, 10], ff: [12, 8, 16, 9], hn: [5, 8, 3, 12], hf: [5, 8, 2, 12], t: [4, 6, 1, 4] }
    ].map(gallop);
    spr('donut_idle', dp, tortie(dI));
    spr('donut_run', dp, tortie(DR));
    spr('donut_act', dp, tortie([dact]));

    // ---- Mongo: baby velociraptor ----
    var mp = { g: C.G1, G: C.l2, S: C.G0, w: C.W, e: C.K, x: C.K, O: C.y1, r: C.o1 };
    var m0 = [
      '..........ggggg.',
      '.........ggweggg',
      '.........ggggggg',
      '.........ggwxwxw',
      '........gGGGGGG.',
      'g......gggg.....',
      'gg...gSgSggg....',
      '.ggSgSgSgGGgg...',
      '..ggggggggGg.g..',
      '....ggggggg.....',
      '.....gg..gg.....',
      '.....OO..OO.....'
    ];
    var m1 = legs(alt(m0, 5, ['.g.....gggg.....', 'gg...gSgSggg....']), ['....ggggggg.....', '....gg....gg....', '...OO......OO...']);
    var m2 = legs(m0, ['....ggggggg.....', '......ggg.......', '......OOO.......']);
    var mact = alt(m0, 0, [
      '..........ggggg.',
      '.........ggweggg',
      '.........gggwxwx',
      '.........gg.....',
      '........gGwxwxw.']);
    spr('mongo_idle', mp, [m0, alt(m0, 0, ['................', '..........ggggg.', '.........ggweggg', '.........ggggggg', '.........ggwxwxw'])]);
    spr('mongo_run', mp, [m1, m2]);
    spr('mongo_act', mp, [mact]);

    // ---- Zev: Kua-Tin PR handler (fish person) with headset + clipboard ----
    var zp = { b: C.c1, B: C.c2, f: C.b4, w: C.W, e: C.K, h: C.g3, m: C.g1, c: C.m1, C: C.m0, W: C.W, y: C.y2, x: C.K };
    var z0 = [
      '....fff.....',
      '...bbbbbb...',
      '..bbbbbwwb..',
      '..bbbbbweb..',
      '.hbbbbbbbbm.',
      '.hhbbbbbbxm.',
      '..bbbbbBBB..',
      '...ccCccc...',
      '..cccCcyy...',
      '..ccCcWWWb..',
      '..cccCWWWb..',
      '...bb..bb...',
      '..fff..fff..'
    ];
    var z1 = alt(z0, 0, ['.....fff....']);
    z1 = alt(z1, 2, ['..bbbbbbbb..', '..bbbbbbeb..']);
    var zr0 = legs(z0, ['..bb....bb..', '.fff....fff.']);
    var zr1 = legs(z0, ['....bbbb....', '...ffffff...']);
    var zact = alt(z0, 7, ['...ccCccc.y.', '..cccCcc.yWW', '..ccCcccbWWW', '..cccCcc.WWW']);
    zact = alt(zact, 2, ['..bbbbbwwb..', '..bbbbbweb..', '.hbbbbbbbbm.', '.hhbbbbbxxm.']);
    spr('zev_idle', zp, [z0, z1]);
    spr('zev_run', zp, [zr0, zr1]);
    spr('zev_act', zp, [zact]);

  })();

  /* ================================================================== *
   *  NPCs
   * ================================================================== */
  (function () {
    // System AI: floating retro TV with a grinning pixel face
    var ap = { c: C.y1, C: C.y0, s: C.c0, g: C.l2, G: C.G2, a: C.g1, r: C.o1, d: C.g3, w: C.W };
    var a0 = [
      '....a........a....',
      '.....a......a.....',
      '......a....a......',
      '.......arra.......',
      'cccccccccccccccccc',
      'cssssssssssssssccc',
      'csssggsssssggsscrc',
      'csssggsssssggsscCc',
      'cssssssssssssssccc',
      'csgsssssssssssgcdc',
      'cssggggggggggsscdc',
      'csssgwgwgwgwsssccc',
      'cssssggggggssssccc',
      'cssssssssssssssccc',
      'cccccccccccccccccc',
      '.CC............CC.'
    ];
    var a1 = alt(a0, 6, [
      'csssggsssssssssccc',
      'csssggssssGGGsscCc',
      'cssssssssssssssccc',
      'csgsssssssssssgcdc',
      'cssggggggggggsscdc',
      'csssggggggggsssccc',
      'cssssgwgwgwssssccc']);
    a1 = alt(a1, 0, ['...a..........a...', '....a........a....']);
    spr('ai_screen', ap, [a0, a1]);
  })();

  /* ================================================================== *
   *  BOOK ONE STORY NPCs: <id>_idle (2 frames: rest + breath/blink), and
   *  <id>_attack for the Meadow Lark fighters. Fill-only, auto-outlined.
   * ================================================================== */
  function rep(ch, n) { return new Array(n + 1).join(ch); }
  // rows above `waist` drop 1px (the feet stay planted): a breathing frame
  function breathe(rows, waist) { var o = rows.slice(); o.splice(waist, 1); o.unshift(rep('.', rows[0].length)); return o; }
  function setPx(rows, list, ch) { var o = rows.slice(); list.forEach(function (q) { var r = o[q[1]]; if (r) o[q[1]] = r.slice(0, q[0]) + ch + r.slice(q[0] + 1); }); return o; }
  function gridOf(rows, w, h) { return P(rows, w || rows[0].length, h || rows.length); }
  // npc(id, pal, frame0, {f1, attack, cx}) : cx = the body's centre column in the fill art, so
  // wide frames (a levelled gun) keep the feet anchor on the body
  function npc(id, pal, f0, opt) {
    opt = opt || {};
    var frames = [f0, opt.f1 || f0];
    if (opt.attack) frames.push(opt.attack);
    var fr = build(frames), W = fr[0][0].length;
    var o = {}; if (opt.cx !== undefined) o.ox = (opt.cx + 1) - (W >> 1);
    def(id + '_idle', withK(pal), [fr[0], fr[1]], o);
    if (opt.attack) def(id + '_attack', withK(pal), [fr[2]], o);
  }
  function flash(g, x, y) { px(g, x, y, 'F'); px(g, x + 1, y, 'F'); px(g, x + 2, y, 'Y'); px(g, x + 1, y - 1, 'Y'); px(g, x + 1, y + 1, 'Y'); }

  // ---- MORDECAI, FLOOR 1: the Rat Hooligan. Bearded rat-man a head shorter than Carl, black vest,
  //      blue pants, worn sandals, a gnarled cane. Master Splinter energy. ----
  var MORD1_PAL = { g: C.g0, W: C.W, p: C.r3, v: C.K, b: C.b3, y: C.y1, x: C.K };
  var MORD1 = [
    '.ggg............',
    'gpppg..........y',
    'gppgggg.......yy',
    '.ggggggggg....yy',
    '..ggggWWWgg....y',
    '..gggggxgggg...y',
    '..gggggggggggp.y',
    '..gggggggggW...y',
    '...gWWWWWgg....y',
    '....WWWWWWv....y',
    '...vvWWWWWvv...y',
    '..gvvvWWWvvvggpy',
    '..gvvvvWWvvv...y',
    '..gvvvvvWvvv...y',
    '..p.vvvvvvv....y',
    '...pbbbbbbb....y',
    '..p.bbbbbbb....y',
    '.p..bbb.bbb....y',
    '.p..bbb.bbb....y',
    'p...bbb.bbb....y',
    '...ppyy.ppyy...y',
    '...yyyy.yyyy..yy'];
  npc('mordecai_f1', MORD1_PAL, MORD1, { f1: setPx(breathe(MORD1, 15), [[7, 6]], 'g') });

  // ---- MORDECAI, FLOOR 2: the Bugaboo. 7-ft neckless black-furred bear shape, huge owl eyes,
  //      comically skinny arms and legs ----
  var MORD2_PAL = { f: C.p0, F: C.K, w: C.W, y: C.y2, x: C.K, n: C.g0, c: C.g1 };
  function bugaboo(f) {
    var g = blank(24, 36), b = f;
    // skinny legs + feet
    line(g, 9, 28, 8, 33, 'f'); line(g, 15, 28, 16, 33, 'f');
    rect(g, 6, 34, 4, 1, 'f'); rect(g, 15, 34, 4, 1, 'f');
    // body: one shaggy mass, no neck
    oval(g, 12, 15 + b, 11, 14, 'f');
    for (var k = 0; k < 9; k++) { var x = 3 + k * 2.3; px(g, Math.round(x), 2 + b + (k % 3 === 1 ? -1 : 0), 'f'); line(g, Math.round(x), 18 + b + (k % 2), Math.round(x) + 1, 22 + b + (k % 2), 'F'); }
    for (k = 0; k < 6; k++) { px(g, 1, 10 + k * 3 + b, 'f'); px(g, 23, 11 + k * 3 + b, 'f'); }
    for (k = 0; k < 10; k++) px(g, 3 + k * 2, 29 + b - (k % 2), 'f');
    // huge owl eyes, a little grey snout
    oval(g, 9, 9 + b, 3.6, 3.6, 'w'); oval(g, 17, 9 + b, 3.6, 3.6, 'w');
    oval(g, 10, 9 + b, 2, 2, 'y'); oval(g, 18, 9 + b, 2, 2, 'y');
    rect(g, 10, 9 + b, 2, 2, 'x'); rect(g, 18, 9 + b, 2, 2, 'x'); px(g, 10, 9 + b, 'w'); px(g, 18, 9 + b, 'w');
    if (f === 1) { rect(g, 6, 6 + b, 7, 3, 'f'); rect(g, 14, 6 + b, 7, 3, 'f'); }
    tri(g, 12, 13 + b, 15, 13 + b, 14, 16 + b, 'n');
    line(g, 11, 18 + b, 17, 18 + b, 'F');
    // absurdly thin arms, little claws
    line(g, 2, 15 + b, 0, 25 + b, 'f'); px(g, 0, 26 + b, 'c'); px(g, 1, 26 + b, 'c');
    line(g, 22, 15 + b, 23, 25 + b, 'f'); px(g, 23, 26 + b, 'c'); px(g, 22, 26 + b, 'c');
    return g;
  }
  def('mordecai_f2_idle', withK(MORD2_PAL), build([bugaboo(0), bugaboo(1)]));

  // ---- TALLY the Bopca Protector: barely counter-high, all hair (brown with a green tinge), black
  //      eyes, red bulbous nose, blue apron, paper hat ----
  var TALLY_PAL = { h: C.y1, H: C.y0, x: C.K, r: C.o1, R: C.r2, b: C.b3, B: C.b1, w: C.W, W: C.g1 };
  var TALLY = [
    '....wwwwwww...',
    '...wWwwwwwww..',
    '...hhhhhhhhhh.',
    '..hhHhhhhhhhh.',
    '.hhhhhxwhhxwh.',
    'hhHhhhxxhhxxh.',
    'hhhhhhhhRrrrh.',
    'hhhhHhhhrrrrr.',
    'hhhhhhHhhrrrhh',
    'hhhbbbbbbbbhhh',
    'hh.bbbbbbbb.hh',
    'hh.bbwwBbbb.hh',
    '...bbbbbbbb...',
    '...bBbbbBbb...',
    '...hhh..hhh...',
    '..hhhh..hhhh..'];
  npc('tally', TALLY_PAL, TALLY, { f1: setPx(TALLY, [[6, 4], [7, 4], [10, 4], [11, 4]], 'h') });
  // ---- QWIST: another Bopca (Second Floor shelter): mossier fur, red apron, tall cook's toque ----
  var QWIST = ['....wwwwww....', '...wwwwwwww...', '...wWwwwwWw...'].concat(TALLY.slice(2));
  npc('qwist', { h: C.y1, H: C.l0, x: C.K, r: C.o1, R: C.r2, b: C.o0, B: C.n0, w: C.W, W: C.g1 }, QWIST, { f1: setPx(QWIST, [[6, 5], [7, 5], [10, 5], [11, 5]], 'h') });

  // ---- RORY + LORELAI: goblin shamanka sisters. Jet-black robes, pineapple-topped staffs. Rory:
  //      muscular, a face full of piercings, filed teeth. Lorelai: younger, a few piercings, bone necklace ----
  var RORY_PAL = { g: C.G1, G: C.G0, r: C.p0, R: C.K, m: C.W, w: C.W, y: C.y2, Y: C.y1, l: C.G0, x: C.K };
  var RORY = [
    '............l.l.',
    '.............l..',
    '....gggg....yYy.',
    'g..gggggg...YyY.',
    'gggggmgmgg..yYy.',
    '.gggmgxgxgg..Y..',
    '..ggggggggmg.Y..',
    '...gmxmxmgg..Y..',
    '....gggggg...Y..',
    '...rrrrrrrr..Y..',
    '..rrrrrrrrrrgY..',
    '.grrRrrrrrrggY..',
    '.ggrRrrrrrr..Y..',
    '.gg.rRrrrrr..Y..',
    '....rRrrrrr..Y..',
    '....rrRrrrr..Y..',
    '...rrrRrrrrr.Y..',
    '...rrrRrrrrr.Y..',
    '...rrrrRrrrr.Y..',
    '..rrrrrRrrrrrY..',
    '..rrrrrrrrrrrY..',
    '...gg....gg..Y..',
    '..ggg...ggg.YYY.'];
  npc('rory', RORY_PAL, RORY, { f1: breathe(RORY, 12) });
  var LORELAI = [
    '............l.l.',
    '.....xx......l..',
    '....gxxg....yYy.',
    'g..gggggg...YyY.',
    'gggggggggg..yYy.',
    '.gggggwgwgg..Y..',
    '..ggggggggmg.Y..',
    '...gggxmxgg..Y..',
    '....gggggg...Y..',
    '...rmrmrmrr..Y..',
    '..rrmmmmmrrrgY..',
    '.grrRrrrrrrggY..',
    '.g.rRrrrrrr..Y..',
    '.g..rRrrrrr..Y..',
    '....rRrrrrr..Y..',
    '....rrRrrrr..Y..',
    '...rrrRrrrr..Y..',
    '...rrrrRrrrr.Y..',
    '..rrrrrRrrrr.Y..',
    '..rrrrrrrrrrrY..',
    '...gg....gg..Y..',
    '..ggg...ggg.YYY.'];
  npc('lorelai', RORY_PAL, LORELAI, { f1: setPx(LORELAI, [[6, 5], [8, 5]], 'g') });

  // ---- FRANK Q: lean 40-ish player killer. Seahawks beanie, stubble, black tee, spiked glowing
  //      black shoulder pads, ripped jeans, heavy boots, iron battle axe ----
  var FRANK_PAL = { s: C.n2, S: C.n1, h: C.b1, H: C.l2, t: C.K, T: C.g3, a: C.p2, j: C.b3, J: C.b6, f: C.y0, m: C.g1, M: C.g0, y: C.y1, x: C.K };
  var FRANK = [
    '....hhhhhh......',
    '...hhhhhhhh.....',
    '...HHHHHHHHH....',
    '...ssssssss.....',
    '..Sssssxssx.....',
    '..SsssssssSs....',
    '...SSsSsSsS.....',
    '....SsxxxsS.....',
    '.....SSSS.......',
    '.aa.ttttt.aa.m..',
    'aaattttttaaaMmm.',
    '.attttttttatMmm.',
    '.sTttttttttsym..',
    '.s.tttttttt.y...',
    '.s.ttttttttsy...',
    '...jjjjjjjj.y...',
    '...jjjjjjjj.y...',
    '...jJjj.jjj.y...',
    '...jjj..jJj.y...',
    '...jjj..jjj.y...',
    '...jjJ..jjj.y...',
    '...fff..fff.y...',
    '..ffff..ffff....'];
  npc('frank_q', FRANK_PAL, FRANK, { f1: breathe(FRANK, 15) });

  // ---- MAGGIE MY: athletic, fierce, close-cropped brown hair, leather jacket, metallic pants and
  //      boots, a black dagger with a purple halo ----
  var MAG_PAL = { s: C.n2, S: C.n1, h: C.y0, l: C.n0, L: C.y0, t: C.r1, m: C.g1, M: C.g0, d: C.K, D: C.m2, x: C.K };
  var MAGGIE = [
    '....hhhhh.......',
    '...hhhhhhh......',
    '...hhssssss.....',
    '..hhsxssxsss....',
    '..hSsssssssS....',
    '..hSssssssSs....',
    '...SssxxxssS....',
    '....SsssssS.....',
    '.....SSSS.......',
    '...llltttlll....',
    '..llLltttlLll.D.',
    '..llLltttlLlDdD.',
    '..llLlttllLsd.D.',
    '..ss.lllll.s....',
    '..s..mmmmmm.....',
    '.....mmmmmm.....',
    '.....mmM.mmm....',
    '.....mmm.mMm....',
    '.....mmm.mmm....',
    '.....mMm.mmm....',
    '.....MMM.MMM....',
    '....MMMM.MMMM...'];
  npc('maggie_my', MAG_PAL, MAGGIE, { f1: breathe(MAGGIE, 14) });

  // ---- MEADOW LARK: the Andrews brothers (shotguns), Imani (crossbow), Yolanda (pistol), Agatha
  //      (a bubbling potion). Attack frames fire (muzzle flash) or wind up the throw. ----
  var GUNPAL = { m: C.g0, M: C.g1, y: C.y1, F: C.W, Y: C.y2 };
  function merge2(a, b) { var o = {}, k; for (k in a) o[k] = a[k]; for (k in b) o[k] = b[k]; return o; }
  // brandon: chubby, shorter, heavy red puffer jacket
  var BRANDON_PAL = merge2(GUNPAL, { s: C.n0, S: C.y0, h: C.K, j: C.o1, J: C.o0, b: C.b1, f: C.K, w: C.W, x: C.K });
  var BRANDON = [
    '................',
    '................',
    '.....hhhhhh.....',
    '....hhhhhhhh....',
    '....hhssssssh...',
    '...Shsssxssxs...',
    '...Ssssssssss...',
    '....sssssssSs...',
    '....ssswwwwss...',
    '.....hhhhhhh....',
    '...jjjjjjjjjj...',
    '..jjjjjjjjjjjj..',
    '.jjJjjjjjjjjJjj.',
    '.jjjJJJJJJJJjjj.',
    '.jjjjjjjjjjjjjj.',
    '.jjjJJJJJJJJjjj.',
    '.ssjjjjjjjjjjss.',
    '..sjjjjjjjjjjs..',
    '...bbbbbbbbbb...',
    '...bbbb..bbbb...',
    '...bbbb..bbbb...',
    '...bbb....bbb...',
    '..ffff...ffff...'];
  function longGun(rows, x0, y0, x1, y1, W, fire) {
    var g = gridOf(rows, W, rows.length);
    line(g, x0, y0, x0 + Math.round((x1 - x0) * 0.35), y0 + Math.round((y1 - y0) * 0.35), 'y', 2);
    line(g, x0 + Math.round((x1 - x0) * 0.3), y0 + Math.round((y1 - y0) * 0.3), x1, y1, 'm', 2);
    line(g, x0 + Math.round((x1 - x0) * 0.4), y0 + Math.round((y1 - y0) * 0.4) - 1, x1 - 1, y1 - 1, 'M');
    if (fire) flash(g, x1 + 1, y1);
    return g;
  }
  npc('brandon', BRANDON_PAL, longGun(BRANDON, 3, 18, 15, 8, 22), {
    f1: longGun(breathe(BRANDON, 18), 3, 18, 15, 9, 22),
    attack: longGun(setPx(BRANDON, [[9, 5], [12, 5]], 'x'), 4, 14, 18, 14, 22, true), cx: 8 });
  // chris: taller, quieter, metal skullcap
  var CHRIS_PAL = merge2(GUNPAL, { s: C.n0, S: C.y0, h: C.K, c: C.g1, C: C.g0, j: C.c1, J: C.c0, b: C.y0, f: C.K, w: C.W, x: C.K });
  var CHRIS = [
    '.....cccccc.....',
    '....ccCcccccc...',
    '....cccccccc....',
    '....hssssssss...',
    '....Ssssxsssx...',
    '....Ssssssssss..',
    '.....sssssssS...',
    '.....sssxxxss...',
    '......sssss.....',
    '....jjjjjjjj....',
    '...jjjjjjjjjj...',
    '..jjjJjjjjJjjj..',
    '..jjjJjjjjJjjj..',
    '..jjjJjjjjJjjj..',
    '..sssjjjjjjsss..',
    '..ss.jjjjjj.ss..',
    '.....bbbbbb.....',
    '.....bbbbbb.....',
    '.....bbb.bbb....',
    '.....bbb.bbb....',
    '.....bbb.bbb....',
    '.....bbb.bbb....',
    '.....bbb.bbb....',
    '....ffff.ffff...'];
  npc('chris', CHRIS_PAL, longGun(CHRIS, 3, 16, 15, 6, 22), {
    f1: longGun(breathe(CHRIS, 16), 3, 16, 15, 7, 22),
    attack: longGun(CHRIS, 4, 12, 19, 12, 22, true), cx: 8 });
  // imani: calm, slight, teal nurse scrubs, enchanted cloak, crossbow
  var IMANI_PAL = { s: C.n2, S: C.n1, h: C.K, c: C.c1, C: C.c0, k: C.p1, q: C.p0, y: C.y1, m: C.g1, w: C.W, x: C.K, F: C.W, Y: C.y2 };
  var IMANI = [
    '.....hhhh.......',
    '....hhhhhh......',
    '...hhhhhhhh.....',
    '...hhssssss.....',
    '..hhsssxssx.....',
    '..hhSssssssS....',
    '..hh.SssssS.....',
    '..h...sxxs......',
    '.....kkssk......',
    '....kkccccck....',
    '...kqcccCcck....',
    '...kqcccCcck....',
    '...kqccccccs....',
    '..kkqcccccc.....',
    '..kkqcccccc.....',
    '..kq.ccc.ccc....',
    '..k..ccc.ccc....',
    '.....ccc.ccc....',
    '.....ccc.ccc....',
    '.....www.www....',
    '....wwww.wwww...'];
  function crossbow(rows, x, y, W, fire) {
    var g = gridOf(rows, W, rows.length);
    line(g, x - 3, y, x + 4, y, 'y', 1); line(g, x + 2, y - 3, x + 4, y, 'm'); line(g, x + 4, y, x + 2, y + 3, 'm');
    px(g, x - 1, y + 1, 's'); px(g, x + 1, y + 1, 's');
    if (fire) { line(g, x + 6, y, x + 9, y, 'F'); px(g, x + 10, y, 'Y'); }
    return g;
  }
  npc('imani', IMANI_PAL, crossbow(IMANI, 11, 13, 20), { f1: crossbow(breathe(IMANI, 15), 11, 14, 20), attack: crossbow(IMANI, 12, 11, 20, true), cx: 7 });
  // yolanda: 4'11", round, tough, pink scrubs with an ID badge, pistol
  var YOL_PAL = { s: C.n2, S: C.n1, h: C.y0, H: C.g1, c: C.m2, C: C.m0, w: C.W, b: C.b4, m: C.g0, M: C.g1, x: C.K, F: C.W, Y: C.y2, y: C.y1 };
  var YOL = [
    '...hhh..........',
    '..hhHhhhh.......',
    '..hhhhhhhh......',
    '.hhhssssssS.....',
    '.hhssxssxss.....',
    '.hhSssssssSS....',
    '..hSssxxxsS.....',
    '...SssssssS.....',
    '...cccccccc.....',
    '..ccccccccccc...',
    '.ccCcccbwcCcc...',
    '.ccCccccccCcc...',
    '.sscccccccccss..',
    '.ss.ccccccc.ss..',
    '....ccccccc.....',
    '....ccc.ccc.....',
    '....ccc.ccc.....',
    '....www.www.....',
    '...wwww.wwww....'];
  function pistol(rows, x, y, W, fire) {
    var g = gridOf(rows, W, rows.length);
    rect(g, x, y, 4, 2, 'm'); px(g, x + 1, y + 2, 'm'); px(g, x, y, 'M');
    if (fire) flash(g, x + 4, y);
    return g;
  }
  npc('yolanda', YOL_PAL, pistol(YOL, 13, 12, 20), { f1: pistol(breathe(YOL, 14), 13, 13, 20), attack: pistol(setPx(YOL, [[11, 12], [12, 11], [13, 10]], 's'), 14, 9, 20, true), cx: 7 });
  // agatha: tiny, ancient, wrapped in scarves, red-checkered trapper hat askew, unsettling smile,
  //         a bubbling potion
  var AG_PAL = { s: C.n2, S: C.n1, r: C.o1, R: C.W, a: C.p1, A: C.l1, B: C.y2, x: C.K, w: C.W, p: C.G2, P: C.l3, g: C.g1 };
  var AGATHA = [
    '...rRrRr......',
    '..RrRrRrR.....',
    '.rRrRrRrRr....',
    'rRaasssssr....',
    'Rr.sxsssx.....',
    'r..sssssss....',
    '...SsxwxwS....',
    '..aaaAAaaa....',
    '.aaAAaaaBBa...',
    '.aaaaBBaaaa...',
    '.AAaaaaaaAA...',
    '.aaaBBaaaas...',
    '.aaaaaAAaa.g..',
    '..aAAaaaaa.p..',
    '..aaaaBBaa.p..',
    '...aaaaaa.....',
    '...ss..ss.....',
    '..xxx.xxx.....'];
  var AG1 = setPx(AGATHA, [[11, 11], [11, 12], [12, 11]], 'P');
  var AGATK = gridOf(AGATHA.map(function (r) { return r + '....'; }), 18, 18);
  rect(AGATK, 10, 11, 3, 3, '.'); rect(AGATK, 10, 7, 2, 4, 's'); rect(AGATK, 10, 4, 3, 3, 'p'); px(AGATK, 11, 3, 'g'); px(AGATK, 11, 2, 'P'); px(AGATK, 13, 1, 'P');
  npc('agatha', AG_PAL, AGATHA, { f1: AG1, attack: AGATK, cx: 6 });

  // ---- ELLE McGIBBONS: 99 years old, white hair, cardigan, anti-slip socks, a wheelchair, attitude ----
  var ELLE_PAL = { s: C.n2, S: C.n1, h: C.W, H: C.g1, c: C.m0, C: C.p0, d: C.b6, x: C.K, m: C.g1, M: C.g0, t: C.K, y: C.y2, r: C.r1 };
  function elle(f) {
    var g = blank(22, 24);
    // wheelchair: big wheel, frame, push handle
    oval(g, 9, 17, 6, 6, 't'); oval(g, 9, 17, 4.5, 4.5, 'M');
    for (var k = 0; k < 4; k++) { var an = k * Math.PI / 4 + f * Math.PI / 8; line(g, 9 - Math.round(Math.cos(an) * 4), 17 - Math.round(Math.sin(an) * 4), 9 + Math.round(Math.cos(an) * 4), 17 + Math.round(Math.sin(an) * 4), 't'); }
    oval(g, 9, 17, 1, 1, 'm');
    line(g, 3, 4, 3, 14, 'm'); line(g, 1, 4, 3, 4, 'm');
    line(g, 4, 14, 16, 14, 'm'); line(g, 16, 14, 18, 21, 'm'); oval(g, 18, 22, 1.5, 1.5, 't');
    // Elle: sitting, cardigan, legs forward, socks
    rect(g, 5, 8, 7, 6, 'c'); rect(g, 6, 9, 1, 5, 'C'); line(g, 9, 8, 9, 13, 'C');
    rect(g, 8, 12, 7, 3, 'd'); rect(g, 13, 14, 3, 6, 'd'); rect(g, 13, 20, 5, 2, 'h'); px(g, 14, 21, 'r'); px(g, 16, 21, 'r');
    rect(g, 11, 10, 3, 2, 's');
    // head: wrinkled, sharp eye, white curls
    oval(g, 9, 4, 4, 4, 's'); oval(g, 7, 2, 4, 3, 'h'); px(g, 4, 4, 'h'); px(g, 5, 6, 'h'); px(g, 12, 1, 'h'); px(g, 6, 0, 'H');
    px(g, 11, 4, f ? 'S' : 'x'); line(g, 10, 3, 12, 3, 'H'); px(g, 13, 5, 'S'); line(g, 10, 7, 12, 6, 'S');
    return g;
  }
  def('elle_idle', withK(ELLE_PAL), build([elle(0), elle(1)]));

  // ---- JACK: old man, bald with white tufts, hospital gown, pants down round the ankles. Trouble. ----
  var JACK_PAL = { s: C.n2, S: C.n1, h: C.W, g: C.b6, G: C.b4, b: C.y1, x: C.K, y: C.y2 };
  var JACK = [
    '....sssss.......',
    '...sssssss......',
    '..hssssssss.....',
    '..hhssxsssx.....',
    '..hSsssssssS....',
    '...SsssssSS.....',
    '....SsxxxsS.....',
    '.....SSSSS......',
    '....ggggggg.....',
    '...gggGggggg....',
    '..ggggGgggggs...',
    '..sggggGgggs....',
    '..s.gggGgggs....',
    '....ggggGgg.....',
    '....gggggGg.....',
    '.....ss.ss......',
    '.....ss.ss......',
    '.....ss.ss......',
    '....bbbbbbb.....',
    '....xxx.xxx.....'];
  var JACK1 = setPx(JACK, [[12, 19], [13, 19], [14, 19], [13, 18]], 'y');
  npc('jack', JACK_PAL, JACK, { f1: JACK1, cx: 7 });

  // ---- ODETTE (on air): black mantis helmet with mirrored compound eyes and antennae, the upper
  //      body of a plus-sized woman in an armoured breastplate, and a king crab where her legs
  //      should be ----
  // The book's on-air costume: a plus-sized woman in a gold breastplate with comically oversized
  // prosthetic breasts (it's armour, and the joke is how enormous it is). Frame 1 bounces.
  var ODE_PAL = { s: C.n0, S: C.y0, k: C.K, e: C.b6, E: C.W, a: C.g1, A: C.g0, c: C.o1, C: C.o0, n: C.m2, x: C.K, w: C.W,
    b: C.y2, B: C.y1, h: C.y3, r: C.r1 };
  function odette(f) {
    var g = blank(38, 39), k;
    // king crab body where her legs should be: wide red shell, four legs a side, a claw reaching forward
    for (k = 0; k < 4; k++) {
      var lx = 7 + k * 7, up = (k + f) % 2;
      line(g, lx, 30, lx - 3, 33 - up, 'c', 2); line(g, lx - 3, 33 - up, lx - 4, 38, 'c', 2);
      line(g, lx + 3, 30, lx + 6, 34 - up, 'C', 2); line(g, lx + 6, 34 - up, lx + 7, 38, 'C');
    }
    oval(g, 18, 29, 15, 5, 'c'); oval(g, 18, 28, 12, 3, 'C');
    for (k = 0; k < 7; k++) px(g, 7 + k * 4, 27 + (k % 2), 'c');
    line(g, 31, 28, 35, 24, 'c', 2); oval(g, 35, 21, 2.5, 2.5, 'c'); px(g, 37, 19, 'c'); px(g, 36, 18, 'c');
    // plus-sized torso and the black belt from her crawl
    oval(g, 18, 21, 8, 5, 's'); rect(g, 11, 24, 15, 2, 'k'); px(g, 18, 24, 'b');
    // arms: one on the hip, one waving with long claw nails
    line(g, 9, 14, 5, 21, 's', 2); line(g, 5, 21, 9, 24, 's', 2); px(g, 10, 24, 'n');
    line(g, 27, 14, 31, 9 - f, 's', 2); line(g, 31, 9 - f, 33, 6 - f, 'n'); px(g, 33, 8 - f, 'n'); px(g, 32, 5 - f, 'n');
    // the breastplate: two enormous gold domes, far wider than she is
    var by = 17 + f;
    oval(g, 12, by, 6.5, 5.5, 'b'); oval(g, 24, by, 6.5, 5.5, 'b');
    oval(g, 13, by + 2, 5, 3, 'B'); oval(g, 25, by + 2, 5, 3, 'B'); oval(g, 12, by, 5, 3.5, 'b'); oval(g, 24, by, 5, 3.5, 'b');
    rect(g, 10, by - 3, 2, 2, 'h'); rect(g, 22, by - 3, 2, 2, 'h');
    line(g, 18, by - 5, 18, by + 5, 'k'); px(g, 18, by - 6, 'r');
    // neck and the black mantis helmet with mirrored compound eyes and antennae
    rect(g, 16, 10, 5, 3, 's');
    tri(g, 10, 1, 27, 1, 18, 11, 'k');
    oval(g, 12, 3, 3.5, 2.5, 'e'); oval(g, 24, 3, 3.5, 2.5, 'e'); px(g, 11, 2, 'E'); px(g, 23, 2, 'E');
    rect(g, 16, 8, 5, 2, 's'); line(g, 17, 9, 19, 9, 'r');
    line(g, 15, 1, 10 - f, 0, 'A'); line(g, 21, 1, 27 + f, 0, 'A');
    return g;
  }
  def('odette_idle', withK(ODE_PAL), build([odette(0), odette(1)]));
  // Mid-turn, in profile (facing right; flip for left): the breastplate sticks out about as far as
  // her interview desk is long. Her body sits in the middle of a symmetric frame so the bottom-centre
  // anchor doesn't move her when this frame swaps in. Frame 1 is the wobble.
  function odetteTurn(f) {
    var W = 150, m = 75, g = blank(W, 39), k;
    for (k = 0; k < 3; k++) { // crab legs from the side
      var lx = m - 8 + k * 7, up = (k + f) % 2;
      line(g, lx, 30, lx - 2, 34 - up, 'c', 2); line(g, lx - 2, 34 - up, lx - 3, 38, 'C', 2);
    }
    oval(g, m, 29, 11, 5, 'c'); oval(g, m, 28, 8, 3, 'C');
    line(g, m + 10, 28, m + 14, 24, 'c', 2); oval(g, m + 14, 21, 2.5, 2.5, 'c');
    oval(g, m, 21, 5, 5, 's'); rect(g, m - 5, 24, 10, 2, 'k'); // torso and belt
    line(g, m - 3, 14, m - 7, 21, 's', 2); px(g, m - 7, 22, 'n'); // the arm swinging back
    // the breastplate, sideways: one enormous gold dome running ~60px out in front of her
    var by = 17 + f, x0 = m + 3, x1 = m + 62, cx0 = (x0 + x1) / 2;
    oval(g, cx0, by, (x1 - x0) / 2, 5.5, 'b');
    oval(g, cx0 + 1, by + 2, (x1 - x0) / 2 - 2, 3, 'B');
    oval(g, cx0, by - 1, (x1 - x0) / 2 - 3, 3, 'b');
    line(g, x0 + 4, by - 4, x1 - 10, by - 4, 'h'); px(g, x1 - 3, by - 1, 'h');
    line(g, x0 + 2, by, x1 - 2, by + f, 'k'); // the seam where the two domes meet
    px(g, x1, by, 'r');
    // neck and the mantis helmet in profile, eye forward, antennae streaming back
    rect(g, m - 1, 10, 4, 3, 's');
    tri(g, m - 6, 1, m + 5, 1, m + 1, 11, 'k');
    oval(g, m + 3, 3, 2.5, 2, 'e'); px(g, m + 3, 2, 'E');
    rect(g, m, 8, 4, 2, 's'); line(g, m + 2, 9, m + 3, 9, 'r');
    line(g, m - 3, 1, m - 10, 0 + f, 'A'); line(g, m, 1, m - 7, 0, 'A');
    return g;
  }
  def('odette_turn', withK(ODE_PAL), build([odetteTurn(0), odetteTurn(1)]));

  // ---- LEXIS: willowy production assistant, blonde hair in a tight bun, simple black dress, clipboard ----
  var LEX_PAL = { s: C.n2, S: C.n1, h: C.y3, H: C.y2, d: C.K, D: C.g3, c: C.y1, w: C.W, x: C.K };
  var LEXIS = [
    '..hh........',
    '.hHhh.......',
    '.hhhhhhh....',
    '..hhhhhhh...',
    '..hhssssss..',
    '..hhsxsssx..',
    '...hsssssS..',
    '....SsssS...',
    '.....sss....',
    '....ddddd...',
    '...dddDddd..',
    '...dDdDddcww',
    '...ddDdddcww',
    '...sdDdddsww',
    '....dDddd...',
    '....dddDd...',
    '...ddDdddd..',
    '...dddDddd..',
    '..dddddDddd.',
    '.....s.s....',
    '.....s.s....',
    '.....s.s....',
    '....xx.xx...'];
  npc('lexis', LEX_PAL, LEXIS, { f1: setPx(LEXIS, [[5, 5], [9, 5]], 's') });

  // ---- THE MAESTRO: orc host of Death Watch Extreme Dungeon Mayhem. Green, tusks, slick hair, tux ----
  var MAE_PAL = { s: C.t1, S: C.t0, h: C.K, w: C.W, r: C.o1, d: C.K, D: C.g3, x: C.K, y: C.y2, m: C.g1 };
  var MAESTRO = [
    '....hhhhh.......',
    '...hhhhhhhh.....',
    '..hhhhhhhhhh....',
    '..hhsssssssss...',
    '..hsssxsssxss...',
    '..sSsssssssss...',
    '..sSssssssSsS...',
    '...SssxxxxxS....',
    '...Sswsssws.....',
    '.....SSSSS......',
    '....ddwrrwdd....',
    '...dddwrrwddd...',
    '..dddDwwwwDddd..',
    '..ddDdwwwwdDdd..',
    '..dd.dwywwd.dd..',
    '..ss.dwwwwd.ss..',
    '.....dddddd..m..',
    '.....dddddd.mym.',
    '.....ddd.ddd.m..',
    '.....ddd.ddd....',
    '.....ddd.ddd....',
    '.....ddd.ddd....',
    '....dddd.dddd...'];
  npc('maestro', MAE_PAL, MAESTRO, { f1: breathe(MAESTRO, 16) });

  // allies duck when hit: <id>_duck = the idle pose squatted 3px (legs shortened, feet planted)
  ['brandon', 'chris', 'imani', 'yolanda', 'agatha'].forEach(function (id) {
    var d = defs[id + '_idle']; if (!d) return;
    var h = d.h, cut = { }; cut[h - 7] = 1; cut[h - 5] = 1; cut[h - 3] = 1;
    var fr = d.frames[0].filter(function (r, y) { return !cut[y]; });
    while (fr.length < h) fr.unshift(rep('.', d.w));
    var o = { w: d.w, h: h, pal: d.pal, frames: [fr] }; if (d.ox) o.ox = d.ox;
    defs[id + '_duck'] = o;
  });
  // legacy names other modules may still ask for
  defs.mordecai = defs.mordecai_f1_idle; defs.mordecai_f1 = defs.mordecai_f1_idle; defs.mordecai_f2 = defs.mordecai_f2_idle; defs.bopca = defs.tally_idle;

  /* ================================================================== *
   *  ENEMIES  (<id>_walk x2, <id>_attack, <id>_hurt) - fill-only, auto outline
   * ================================================================== */
  (function () {
    var w0, w1, at;
    // ---- rat ----
    w0 = [
      '........gg....',
      '.......gpgg...',
      '...ggggggegg..',
      '.ggggggggggggp',
      't.gggggggGGG..',
      '.tGGggggggg...',
      '..gg..gg.gg...',
      '..pp..pp.pp...'];
    w1 = legs(w0, ['...gg.gg..gg..', '...pp.pp..pp..']);
    at = [
      '..............',
      '........gg....',
      '...gggggpggg..',
      '.ggggggggggegg',
      't.gggggggggww.',
      '.tGGggggggg.ww',
      '.gg...gg.gg...',
      '.pp...pp.pp...'];
    enemy('rat', { g: C.g0, G: C.g1, e: C.o1, p: C.m3, t: C.m2, w: C.W }, w0, w1, at);

    // ---- roach ----
    w0 = [
      '..........a..a',
      '...........aa.',
      '...bbbbbbb.hh.',
      '.bbBbBbBbbbhhe',
      'bbBbBbBbBbbhhh',
      '.bbbbbbbbbbbh.',
      '.l.l..l..l.l..',
      'l..l...l..l..l'];
    w1 = legs(w0, ['..l.l..l.l..l.', '.l...l...l..l.']);
    at = alt(w0, 0, ['.........a....', '.........a.a..', '...bbbbbbb.hha', '.bbBbBbBbbbhhe', 'bbBbBbBbBbbhhhw']);
    enemy('roach', { b: C.n0, B: C.n1, h: C.y0, e: C.o1, a: C.y1, l: C.y0, w: C.W }, w0, w1, at);

    // ---- goblin ----
    var gp = { g: C.G1, G: C.G0, e: C.y2, w: C.W, m: C.K, c: C.y1, C: C.y0, l: C.n0, s: C.y0 };
    w0 = [
      '....gggg....',
      'g..gggggg..g',
      'gggggegegggg',
      '.ggggggggggg',
      '...gwmwmgg..',
      '....gggg....',
      '...cccccc.s.',
      '..gccCccgss.',
      '..g.cccc.ss.',
      '....llll.s..',
      '....g..g....',
      '...gg..gg...'];
    w1 = legs(w0, ['....llll....', '...g....g...', '..gg....gg..']);
    at = alt(w0, 4, ['...gwmwmgg..', '....gggg..s.', '...ccccccss.', '..gccCcccgs.', '..g.cccc..ss', '....llll....']);
    enemy('goblin', gp, w0, w1, at);

    /* ---------------- BOOK ONE MOBS ---------------- */
    var DG_TOP, DG_LEG;
    // ---- scatterer: the parent roach art under the book's name ----
    ['walk', 'attack', 'hurt'].forEach(function (a) { defs['scatterer_' + a] = defs['roach_' + a]; });

    // ---- goblin shamanka: goblin woman, black hair, purple robe, bone beads, skull-topped bone staff ----
    var shp = { g: C.G1, r: C.m0, w: C.W, x: C.K };
    w0 = [
      '...xxxx......ww.',
      'g.xxxxxxx...wwww',
      'ggxggggggg..wxwx',
      '.gxgggwgwgg...w.',
      '..xggggggggg..w.',
      '..x.gwxwxgg...w.',
      '.....gggg.....w.',
      '...rwrwrwrr..gwg',
      '..grrrrrrrrgggw.',
      '..g.rrrrrrr...w.',
      '...rrrrrrrr...w.',
      '..rrrrwrrrrr..w.',
      '..rrrrrrrrrr..w.',
      '...gg....gg..www'];
    w1 = legs(w0, ['...rrrrrrrrr..w.', '....gg..gg...www']);
    at = alt(w0, 0, [
      '...xxxx.....w..w',
      'g.xxxxxxx...wwww',
      'ggxggggggg..wwww',
      '.gxgggwgwgg..ww.',
      '..xggggggggg.gwg',
      '..x.gwwwwgg.g.w.',
      '.....gggg..g..w.',
      '...rwrwrwrr...w.',
      '..grrrrrrrr...w.']);
    enemy('goblin_shamanka', shp, w0, w1, at);

    // ---- goblin bomb bard: red cap + tunic, lute on the back, lit dynamite stick ----
    var gbp = { g: C.G1, r: C.o1, c: C.y1, w: C.W, x: C.K };
    w0 = [
      '..........w.w',
      '....rrrr...w.',
      'g..rrrrrr..x.',
      'ggggggggg..r.',
      '.ggggwgwgg.r.',
      '...gxwxwgg.r.',
      '.c..gggg..grg',
      '.c..rrrrggg..',
      'ccc.rrrrrr...',
      'cxcgrrrrrr...',
      'ccc.rrrr.....',
      '.c..g..g.....',
      '...gg..gg....'];
    w1 = legs(w0, ['.c..g...g....', '...gg...gg...']);
    at = alt(w0, 0, [
      '.........w.ww',
      '....rrrr..w.w',
      'g..rrrrrr..x.',
      'ggggggggg..r.',
      '.ggggwgwgg.r.',
      '...gwwwwgg.r.']);
    enemy('goblin_bomber', gbp, w0, w1, at);

    // ---- scatterer brood guardian: cat-sized, red-brown, big pale mandibles, red eye ----
    var bgp = { b: C.o0, B: C.n1, h: C.n0, l: C.n0, m: C.y3, e: C.o1 };
    w0 = [
      '..............l...l.',
      '...............l.l..',
      '....bbbbbbbbbb..ll..',
      '..bbBbBbBbBbBbbhhhh.',
      '.bBbBbBbBbBbBbbhheh.',
      'bBbBbBbBbBbBbBbhhhhm',
      'bbbbbbbbbbbbbbbhhhm.',
      '.hhhhhhhhhhhhhh.hmm.',
      '..l.l..l.l..l.l..m..',
      '.l..l.l..l.l..l.....',
      'l..l..l..l..l..l....'];
    w1 = legs(w0, ['..l..l.l..l.l..l....', '...l.l..l.l..l.l....', '..l..l..l..l..l.....']);
    at = alt(w0, 0, [
      '...............l..l.',
      '..............l..l..',
      '....bbbbbbbbbb.ll..m',
      '..bbBbBbBbBbBbbhhhm.',
      '.bBbBbBbBbBbBbbhheh.',
      'bBbBbBbBbBbBbBbhhhh.',
      'bbbbbbbbbbbbbbbhhhh.',
      '.hhhhhhhhhhhhhh.hhm.',
      '..l.l..l.l..l.l...mm']);
    enemy('brood_guardian', bgp, w0, w1, at);

    // ---- bad llama: horse-sized, tan wool, yellow buckteeth, mean eyes; attack = glowing throat pouch ----
    var llp = { f: C.n3, F: C.n2, t: C.y2, x: C.K, p: C.o1, P: C.y2 };
    var LL_HEAD = [
      '................F..F....',
      '................FF.FF...',
      '...............ffFffFf..',
      '...............ffffffff.',
      '...............fFFFxfff.',
      '...............fffxxffff',
      '...............ffffffffF',
      '...............fffffxFFx',
      '...............ffffftt..',
      '...............ffff.tt..',
      '...............fffff....',
      '...............fffff....',
      '..............ffffff....'];
    var LL_BODY = [
      'FF...FfFfFfFfFfffff.....',
      'ffFffffffffffffffff.....',
      '.fffffffffffffffffF.....',
      '..ffffffffffffffffF.....',
      '..fFfFfFfffffffFfF......',
      '..fF.FfF.....FfF.F......'];
    var LL_LEGS = [
      ['...ff.ff......ff.ff.....', '...ff.ff......ff.ff.....', '...ff.ff......ff.ff.....', '...ff.ff......ff.ff.....', '...ff.ff......ff.ff.....', '...ff.ff......ff.ff.....', '..xxx.xx.....xx.xxx.....'],
      ['...ff.ff......ff.ff.....', '...ff..ff....ff..ff.....', '..ff...ff....ff...ff....', '..ff....ff..ff....ff....', '.ff.....ff..ff.....ff...', '.ff.....ff..ff.....ff...', 'xxx.....xxxxxx.....xxx..']
    ];
    var LL_EMPTY = '........................';
    function llama(head, legs, bob) {
      if (!bob) return head.concat(LL_BODY, legs);
      return [LL_EMPTY].concat(head, LL_BODY, legs.slice(0, 2), legs.slice(3));
    }
    w0 = llama(LL_HEAD, LL_LEGS[0]);
    w1 = llama(LL_HEAD, LL_LEGS[1], 1);
    var LL_ATK = alt(LL_HEAD, 4, [
      '...............ffFFFFff.',
      '...............fffxxFfff',
      '...............ffffffff.',
      '...............fffffxxxx',
      '...............fffffxttt',
      '...............ffffpp...',
      '...............fffpPpp..',
      '...............fffpPPp..',
      '..............ffffpp....']);
    at = llama(LL_ATK, LL_LEGS[0]);
    enemy('bad_llama', llp, w0, w1, at);

    // ---- rot sticker: black ravioli with a crimped gray rim, one big white eye; attack = blinks red ----
    var rsp = { b: C.K, c: C.g0, w: C.W, x: C.K, r: C.o1 };
    w0 = [
      '.cbcbcb.',
      'cbbbbwwc',
      'bbbbbwxb',
      'cbbbbbbc',
      '.cbcbcb.',
      '.c.c.c..'];
    w1 = legs(w0, ['..c.c.c.']);
    at = swap(alt(w0, 1, ['cbbbbrrc', 'bbbbbrxb']), { c: 'r' });
    enemy('rot_sticker', rsp, w0, w1, at);

    // ---- troglodytes: komodo-dragon heads, scaly olive hides, loincloths, kangaroo legs ----
    var trp = { s: C.y1, S: C.y0, b: C.y3, c: C.n0, x: C.K, w: C.W };
    // pygmy: 3 ft, drags a crude club
    var TRG = [
      '....ssss...',
      '...sssxss..',
      '...sssssssS',
      '....sxxxxx.',
      '...sssbbb..',
      '..sSsbbs...',
      '.sSSsbbss..',
      'sSs.cccs.s.',
      's..ccccc.sc',
      's...sss..c.',
      '...sssss.c.',
      '..ss...ss.c',
      '.ss....ss.c',
      'ssss..ssss.'];
    var TRG_W1 = ['...sssss.c.', '...ss.ss.c.', '..ss..ss..c', '.ssss.ssssc'];
    w0 = TRG; w1 = legs(TRG, TRG_W1);
    at = alt(TRG, 0, [
      '....ssss..c',
      '...sssxss.c',
      '...ssssssc.',
      '....sxwwxc.',
      '...sssbbs..',
      '..sSsbbss..',
      '.sSSsbbs...',
      'sSs.cccs...',
      's..ccccc...',
      's...sss....']);
    enemy('trog_pygmy', trp, w0, w1, at);

    // basher: almost human-sized, straighter legs, huge fists
    w0 = [
      '.....ssss.......',
      '....sssssss.....',
      '...ssssssbss....',
      '...sSsssssssss..',
      '....ssbbbbbss...',
      '.....sssss......',
      '...sssbbsss.....',
      '..ssssbbbssss...',
      '.sss.sbbbs.sss..',
      '.ss.ssbbbss.ss..',
      '.ss..sbbbs..ss..',
      'sss..sssss..sss.',
      'SSS.cccccc..SSS.',
      's...cccccc.....s',
      's...cc..cc......',
      'ss..ss..ss......',
      '.s..ss..ss......',
      '....ss..ss......',
      '...sss..ss......',
      '...ss...sss.....',
      '...ss....ss.....',
      '..sss...sss.....'];
    w1 = legs(w0, ['...ss..ss.......', '..sss..sss......', '..ss....ss......', '..ss....ss......', '.sss...sss......']);
    at = alt(w0, 0, [
      '.....ssss.......',
      '....sssssss.....',
      '...ssssssbss....',
      '...sSsssssssss..',
      '....ssbxbxbss...',
      '.....sssss......',
      '...sssbbsssssSSS',
      '..ssssbbbsssssss',
      '.sss.sbbbs...sss',
      '.ss.ssbbbs......',
      '.ss..sbbbs......',
      'sss..sssss......']);
    enemy('trog_basher', trp, w0, w1, at);

    // virtuoso: small, greener; attack = a 15-ft wet pink tongue
    var tvp = { s: C.l0, S: C.t0, b: C.l3, c: C.p0, x: C.K, t: C.r2, T: C.r3 };
    function noClub(rows) { return rows.map(function (r, y) { return y >= 7 ? r.slice(0, 8).replace(/c/g, y > 9 ? 's' : 'c') + r.slice(8).replace(/c/g, '.') : r; }); }
    w0 = noClub(TRG); w1 = noClub(legs(TRG, TRG_W1));
    var TONGUE = P(alt(w0, 0, ['....ssss...', '...sssxsss.', '...sssssss.', '....s......', '...sssbbb..']), 38, 14);
    line(TONGUE, 6, 3, 33, 3, 't'); line(TONGUE, 6, 2, 32, 2, 't');
    for (var tx = 8; tx < 32; tx += 3) px(TONGUE, tx, 2, 'T');
    px(TONGUE, 34, 1, 't'); px(TONGUE, 35, 0, 't'); px(TONGUE, 34, 4, 't'); px(TONGUE, 35, 5, 't'); px(TONGUE, 33, 2, 't'); px(TONGUE, 33, 3, 't');
    px(TONGUE, 20, 4, 'T'); px(TONGUE, 27, 4, 'T');
    enemy('trog_virtuoso', tvp, w0, w1, w0);
    (function () { // attack frame on its own wide canvas; anchor kept on the body
      var fr = build([TONGUE]);
      def('trog_virtuoso_attack', withK(tvp), fr, { ox: 6 - (fr[0][0].length >> 1) });
    })();

    // ---- tuskling (knight): pink warthog-headed orc aristocrat, dented helmet, navy tux, dazed ----
    var tkp = { p: C.r3, P: C.r2, w: C.W, n: C.b1, x: C.K, g: C.g1 };
    w0 = [
      '...gggggg...',
      '..ggggggxg..',
      '..gggxgggg..',
      '.gggggggggg.',
      'Pppppppppp..',
      'PPpppwxppp..',
      '.pppppppPPPP',
      '.ppppppwPxPx',
      '.pppppwwPPPP',
      'nnnnnnwwnnnn',
      'nnnnnwwwnnnn',
      'pnnnnnwnnnnp',
      'pnnnnnwnnnnp',
      '.nnnnnnnnnn.',
      '..pp....pp..',
      '.xxx...xxx..'];
    w1 = alt(legs(w0, ['..pp...pp...', '..xxx.xxx...']), 5, ['PPppxwpppp..']);
    at = alt(w0, 5, ['PPpppwxppp..', '.pppppppPPPP', '.ppppppwPxPx', '.ppppxwwxxx.', 'nnnnnnwwnnpp', 'nnnnnwwwnnpp']);
    var tkHurt = alt(w0, 5, ['PPpppxpppp..']);
    enemy('tuskling', tkp, w0, w1, at, tkHurt);

    // ---- brindle grub: fuzzy fat worm, tortoiseshell black / brown / orange ----
    var grp = { o: C.n1, b: C.n0, x: C.K, w: C.W };
    w0 = [
      '..o.b.o.b.o.....',
      '.obobxbobobob...',
      'obxbobobxboboow.',
      'boboxobobobxobox',
      'obobobxbobobobo.',
      '.bobobobobobob..',
      '..o.b.o.b.o.b...'];
    w1 = [
      '................',
      '...o.b.o.b.o....',
      '.obobxbobobobo..',
      'obxbobobxbobooow',
      'bobobxobobobxbox',
      'obobobobobobobo.',
      '.o.b.o.b.o.b.o..'];
    at = alt(w0, 1, ['.obobxbobobob.w.', 'obxbobobxboboxww', 'boboxobobobxob.x']);
    enemy('brindle_grub', grp, w0, w1, at);

    // ---- cow grub: bigger, black-and-white cow spots, pink snout, a cow tail ----
    var cgp = { w: C.W, x: C.K, p: C.r3, g: C.g1 };
    w0 = [
      '...w.w.w.w.w.w......',
      '..wwxxwwwwxxwwwww...',
      'x.wxxxwwwwxxxwwwwww.',
      'gwwxxwwxxwwxwwwwxwwp',
      '..wwwwwxxxwwwwwwwwpp',
      '..wwxwwxxwwwwxxwwwp.',
      '..wxxxwwwwwwxxxwww..',
      '...wwwwwwwwwwwwww...',
      '...g.g.g.g.g.g.g....'];
    w1 = [
      '....................',
      '....w.w.w.w.w.w.....',
      '.x.wwxxwwwwxxwwwww..',
      'x.wxxxwwwwxxxwwwwwwp',
      '.gwxxwwxxwwxwwwwxwpp',
      '..wwwwwxxxwwwwwwwwwp',
      '..wxxxwwxxwwwxxxwww.',
      '..wwwwwwwwwwwwwwwww.',
      '..g.g.g.g.g.g.g.g...'];
    at = alt(w0, 3, ['.xwxxwwxxwwxwwwwxwwx', '..wwwwwxxxwwwwwwwwpp', '..wwxwwxxwwwwxxwwwwp']);
    enemy('cow_grub', cgp, w0, w1, at);
    // ---- brindled vespa: human-sized hornet, brindled stripes, clawed hands, buzzing wings ----
    var vsp = { y: C.y2, n: C.n0, a: C.b6, x: C.K, e: C.o1 };
    function vespa(f) {
      var g = blank(22, 18), up = f === 1;
      // wings (behind)
      if (up) { oval(g, 8, 3, 6, 2.5, 'a'); oval(g, 4, 5, 4, 2, 'a'); }
      else { oval(g, 7, 7, 6, 2, 'a'); oval(g, 3, 9, 4, 1.5, 'a'); }
      // abdomen (stinger pointing down-left)
      oval(g, 6, 11, 4.5, 4, 'y');
      for (var x = 2; x < 11; x += 3) line(g, x, 8, x + 1, 15, 'n');
      line(g, 3, 14, 1, 17, 'x'); px(g, 2, 15, 'n');
      // thorax + head
      oval(g, 12, 8, 3.2, 3.2, 'n');
      px(g, 11, 6, 'y'); px(g, 13, 7, 'y'); px(g, 12, 10, 'y');
      oval(g, 17, 6, 3.5, 3.2, 'y');
      oval(g, 18, 5, 1.8, 1.8, 'e'); px(g, 19, 4, 'x');
      line(g, 20, 8, 21, 9, 'n'); line(g, 18, 9, 19, 10, 'n');
      line(g, 16, 3, 18, 0, 'n'); line(g, 17, 3, 20, 1, 'n');
      // arms with claws
      if (f === 2) { line(g, 13, 10, 18, 12, 'n'); line(g, 18, 12, 21, 11, 'y'); line(g, 18, 12, 21, 13, 'y'); }
      else { line(g, 13, 10, 15, 14, 'n'); line(g, 15, 14, 17, 13, 'y'); line(g, 15, 14, 16, 16, 'y'); }
      // dangling legs
      line(g, 11, 11, 10, 16, 'n'); line(g, 13, 11, 13, 16, 'n');
      return g;
    }
    enemy('vespa', vsp, vespa(0), vespa(1), vespa(2));

    // ---- danger dingo: mastiff-sized, ginger fur, black-metal corpse paint, absurd fangs ----
    var dgp = { f: C.n1, F: C.n0, w: C.W, x: C.K, r: C.o1 };
    DG_TOP = [
      '...............ff.....',
      '..............fff.f...',
      '...............wwwww..',
      'F.............wxwwxww.',
      'FF...........wwxwwwwwx',
      '.FF..ffffffffwwwwwwxxx',
      '..ffffffffffffwxxxxw..',
      '..ffffffffffffwwxw.w..',
      '..fffffffffffffw...w..',
      '..fFFFFFFFFFFFFf......'];
    DG_LEG = [
      ['..fff.fff...fff.ff....', '..ff...ff....ff..ff...', '..ff....ff..ff...ff...', '.FF.....FF.FF....FF...'],
      ['..fff.fff...fff.ff....', '...ff.ff.....ff.ff....', '...ff.ff.....ff.ff....', '..FF.FF.....FF.FF.....']];
    w0 = DG_TOP.concat(DG_LEG[0]);
    w1 = DG_TOP.concat(DG_LEG[1]);
    at = alt(w0, 2, [
      '...............wwwww..',
      'F.............wxwwxww.',
      'FF...........wwxwwwwwx',
      '.FF..ffffffffwwwwwwxxx',
      '..ffffffffffffwxr.....',
      '..ffffffffffffwwxxxw..',
      '..fffffffffffffw..w...']);
    enemy('dingo', dgp, w0, w1, at);

    // ---- kobold: upright chihuahua man, spiked steel cap, beer-tab chainmail ----
    var kbp = { f: C.n2, m: C.g1, w: C.W, x: C.K };
    w0 = [
      '....m....',
      '...mmm...',
      'f.mmmmm.f',
      'ffffffffx',
      '.fwxffwxf',
      '..fffffff',
      '...ffxff.',
      '..mwmwm..',
      '.fmmwmmf.',
      '.fmwmwmf.',
      '..f...f..',
      '.ff..ff..'];
    w1 = legs(w0, ['...f.f...', '..ff.ff..']);
    at = alt(w0, 4, ['.fwxffwxf', '..fffffff', '...fwwww.', '..mwmwm..']);
    enemy('kobold', kbp, w0, w1, at);
    // ---- mind horror: floating brain-jellyfish, dangling tentacles ----
    var mhp = { b: C.m3, B: C.m2, f: C.m1, t: C.p2, x: C.K, w: C.W };
    function horror(f) {
      var g = blank(14, 18), d = f === 1 ? 1 : 0;
      for (var k = 0; k < 5; k++) { var x0 = 2 + k * 2.5, sw = ((k + f) % 2 ? 1 : -1); line(g, x0, 8, x0 + sw, 12, 't'); line(g, x0 + sw, 12, x0 - sw, 16 - (k % 2) + d, 't'); }
      oval(g, 6.5, 5 + d, 6.3, 4.6, 'b');
      line(g, 1, 9 + d, 12, 9 + d, 'B'); line(g, 0, 8 + d, 13, 8 + d, 'B');
      line(g, 6, 1 + d, 7, 8 + d, 'f');
      [[3, 3], [4, 6], [9, 2], [10, 5], [2, 5], [11, 7]].forEach(function (q) { line(g, q[0], q[1] + d, q[0] + 1, q[1] + 1 + d, 'f'); px(g, q[0] + 2, q[1] + d, 'f'); });
      if (f === 2) { rect(g, 9, 4 + d, 2, 2, 'w'); px(g, 10, 5 + d, 'x'); rect(g, 3, 4 + d, 2, 2, 'w'); px(g, 4, 5 + d, 'x'); }
      return g;
    }
    enemy('mind_horror', mhp, horror(0), horror(1), horror(2));

    // ---- clurichaun: hillbilly leprechaun, curly black hair, ruddy hooked nose, snot, patched overalls ----
    var clp = { s: C.n2, r: C.o2, g: C.G1, x: C.K, l: C.l2, y: C.y1 };
    w0 = [
      '.xxxxxx...',
      'xxxxxxxx..',
      'xxsssssx..',
      'xssxssxsr.',
      'xsrsssssrr',
      '.ssssssrl.',
      '..sxsxss.l',
      '...ssss...',
      '.ggsggsggy',
      'sg.gggg.yy',
      '..gglgg.y.',
      '..gg.gg...',
      '..x..x....',
      '.xxy.xxy..'];
    w1 = legs(w0, ['..gg..gg..', '.x....x...', 'xxy..xxy..']);
    at = alt(w0, 8, ['.ggsggsgss', 'sg.gggg.yy', '..gglgg.yy']);
    enemy('clurichaun', clp, w0, w1, at);

    // ---- laminak: fat soccer-mom fairy, hummingbird wings, inverted blonde bob, leaf pantsuit ----
    var lmp = { s: C.n2, h: C.y2, g: C.G1, a: C.b6, x: C.K, r: C.o1 };
    w0 = [
      'aa..hhhh....',
      'aaahhhhhh...',
      '.aahhssxss..',
      '..ahhsssss..',
      '.aahh.ssxs..',
      'aaa...gss...',
      'aa..gggggs..',
      '...ggggggs..',
      '...gggggg...',
      '....gg.gg...',
      '....g...g...',
      '............'];
    w1 = alt(w0, 0, ['....hhhh....', '...hhhhhh...', '.a.hhssxss..', 'aaahhsssss..', 'aaahh.ssxs..', '.aa...gss...', '....gggggs..']);
    at = alt(w0, 5, ['aaa...gss.rr', 'aa..gggggsrr', '...ggggggs..']);
    enemy('laminak', lmp, w0, w1, at);
    // ---- kobold rider: a kobold with a long feathered lance on a danger dingo ----
    var krp = { f: C.n1, F: C.n0, w: C.W, x: C.K, c: C.n2, m: C.g1, r: C.o1 };
    var KB_SIT = [
      '....m....',
      '...mmm...',
      'c.mmmmm.c',
      'ccccccccx',
      '.cwxccwxc',
      '..ccccccc',
      '...mwmw..',
      '..mmmmmcc',
      '..mwmwm..',
      '..cccc...',
      '....c....'];
    function rider(legs, f) {
      var g = blank(26, 22);
      stamp(g, P(DG_TOP.concat(legs)), 0, 8);
      if (f === 2) stamp(g, P(['wwwww', 'xxxwx', 'xr..w']), 14, 13); // jaws snapping
      stamp(g, P(KB_SIT), 5, 3 + (f === 1 ? 1 : 0));
      var ly = f === 1 ? 1 : 0, lx = f === 2 ? 1 : 0;
      line(g, 8, 12 + ly, 24 + lx, 4 + ly, 'F');
      line(g, 23 + lx, 5 + ly, 25 + lx, 4 + ly, 'm');
      px(g, 20 + lx, 5 + ly, 'r'); px(g, 21 + lx, 5 + ly, 'r'); px(g, 20 + lx, 7 + ly, 'r'); px(g, 19 + lx, 7 + ly, 'r');
      return g;
    }
    w0 = rider(DG_LEG[0], 0); w1 = rider(DG_LEG[1], 1); at = rider(DG_LEG[0], 2);
    enemy('kobold_rider', krp, w0, w1, at);

  })();

  /* ================================================================== *
   *  BOSSES - painted on char grids with integer primitives, then outlined.
   *  draw(g, p): p = { a: 'idle'|'walk'|'attack'|'hurt'|'special', i: frame index }
   * ================================================================== */
  function boss(id, pal, W, H, draw) {
    var poses = { idle: 2, walk: 2, attack: 1, hurt: 1, special: 1 };
    Object.keys(poses).forEach(function (a) {
      var frames = [];
      for (var i = 0; i < poses[a]; i++) { var g = blank(W, H); draw(g, { a: a, i: i }); frames.push(outlined(g)); }
      def(id + '_' + a, withK(a === 'hurt' ? hurtPal(pal) : pal), frames);
    });
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
  function dots(g, x, y, w, h, from, to, test) { for (var j = y; j < y + h; j++) for (var i = x; i < x + w; i++) if (g[j] && g[j][i] === from && test(i, j)) g[j][i] = to; }
  function eyes2(g, x, y, c, pupil) { rect(g, x, y, 2, 2, c); px(g, x + 1, y + 1, pupil || 'K'); }

  // polar helper for round/rotating boss parts
  function pol(cx, cy, r, an) { return [Math.round(cx + Math.cos(an) * r), Math.round(cy + Math.sin(an) * r)]; }
  function puff(g, x, y, r, c, c2) { oval(g, x, y, r, r - 0.5, c); if (c2) { px(g, x - 1, y - 1, c2); px(g, x, y - 1, c2); } }

  // ---- THE GOBLIN MURDER DOZER: rusty steam tractor on treads, spiked wheel in front, smoke pipes,
  //      fur-lined pit of goblins on top, ladder + glowing boiler on the back (left) ----
  boss('murder_dozer', { r: C.n0, R: C.n1, g: C.g0, G: C.g1, f: C.n3, q: C.G1, o: C.y2, O: C.o1, K: C.K, w: C.W }, 72, 44, function (g, p) {
    var mv = (p.a === 'walk' || p.a === 'attack') ? p.i : 0, y0 = p.a === 'idle' ? p.i : 0;
    var atk = p.a === 'attack', sp = p.a === 'special', hurt = p.a === 'hurt';
    // smoke from the stacks
    var puffs = (p.i ? [[13, 4, 3], [18, 1, 2], [9, 1, 2]] : [[14, 2, 3], [9, 4, 2], [19, 3, 2]]);
    if (atk || sp) puffs = puffs.concat([[4, 3, 3], [23, 1, 2], [1, 0, 2]]);
    puffs.forEach(function (q) { puff(g, q[0], q[1] + y0, q[2], 'g', 'G'); px(g, q[0] + 1, q[1] + y0 + 1, 'K'); });
    // stacks
    rect(g, 11, 6 + y0, 3, 12, 'g'); rect(g, 11, 6 + y0, 1, 12, 'G'); rect(g, 10, 6 + y0, 5, 2, 'G');
    rect(g, 17, 8 + y0, 2, 10, 'g'); rect(g, 16, 8 + y0, 4, 1, 'G');
    // hull: riveted rust plates with a sloped prow
    rect(g, 8, 18 + y0, 44, 15, 'r');
    tri(g, 51, 18 + y0, 57, 25 + y0, 51, 32 + y0, 'r');
    line(g, 8, 18 + y0, 52, 18 + y0, 'R'); line(g, 52, 19 + y0, 56, 24 + y0, 'R');
    [21, 33, 45].forEach(function (x) { line(g, x, 19 + y0, x, 32 + y0, 'K'); for (var yy = 20; yy < 32; yy += 3) px(g, x - 1, yy + y0, 'R'); });
    for (var x = 9; x < 52; x += 3) px(g, x, 31 + y0, 'R');
    line(g, 24, 21 + y0, 27, 29 + y0, 'R'); line(g, 40, 20 + y0, 42, 27 + y0, 'R');
    // crude skull painted on the flank
    oval(g, 39, 24 + y0, 3, 2.5, 'G'); rect(g, 38, 26 + y0, 3, 2, 'G'); px(g, 38, 24 + y0, 'K'); px(g, 40, 24 + y0, 'K'); px(g, 39, 27 + y0, 'r');
    // fur-lined pit with goblins
    rect(g, 18, 14 + y0, 28, 4, 'K');
    var heads = [[23, 0], [31, 1], [39, 0]];
    heads.forEach(function (H, k) {
      var hx = H[0], hy = 13 + y0 + (p.i ? H[1] : 1 - H[1]);
      if (hurt) hy += 2;
      oval(g, hx, hy, 2.5, 2.5, 'q'); px(g, hx - 3, hy - 1, 'q'); px(g, hx + 3, hy - 1, 'q'); px(g, hx - 4, hy - 2, 'q'); px(g, hx + 4, hy - 2, 'q');
      px(g, hx, hy, hurt ? 'w' : 'o'); px(g, hx + 2, hy, hurt ? 'w' : 'o');
      if (atk || (sp && k === 1)) { line(g, hx - 2, hy + 1, hx - 3, hy - 4, 'q'); line(g, hx + 2, hy + 1, hx + 3, hy - 4, 'q'); }
    });
    for (x = 17; x < 47; x++) px(g, x, 17 + y0, 'f');
    for (x = 17; x < 47; x += 2) px(g, x, 16 + y0, 'f');
    // back: boiler drum + ladder
    rect(g, 5, 19 + y0, 6, 13, 'g'); oval(g, 6, 19 + y0, 3, 1.5, 'G'); line(g, 5, 20 + y0, 5, 31 + y0, 'G');
    var glow = sp ? 3.5 : 2.5;
    oval(g, 7, 25 + y0, glow, glow + 0.5, 'O'); oval(g, 7, 25 + y0, glow - 1.2, glow - 0.8, 'o');
    line(g, 5, 25 + y0, 9, 25 + y0, 'K'); px(g, 7, 23 + y0, 'K'); px(g, 7, 27 + y0, 'K');
    line(g, 1, 14 + y0, 1, 34, 'G'); line(g, 3, 14 + y0, 3, 34, 'G');
    for (var yy = 16; yy < 34; yy += 3) px(g, 2, yy + y0, 'G');
    if (sp) { [[1, 22], [0, 26], [2, 19], [1, 29]].forEach(function (f, k) { line(g, 4, f[1] + y0, f[0], f[1] - 2 + (k & 1) + y0, 'O'); px(g, f[0], f[1] - 2 + y0, 'o'); }); }
    if (hurt) { [[9, 21], [4, 27], [13, 23]].forEach(function (s2) { px(g, s2[0], s2[1], 'w'); px(g, s2[0] - 1, s2[1], 'o'); px(g, s2[0] + 1, s2[1], 'o'); px(g, s2[0], s2[1] - 1, 'o'); px(g, s2[0], s2[1] + 1, 'o'); }); }
    // treads
    rect(g, 10, 33, 44, 10, 'K'); oval(g, 10, 37.5, 4.6, 4.6, 'K'); oval(g, 54, 37.5, 4.6, 4.6, 'K');
    for (var wx = 11; wx <= 54; wx += 7) { oval(g, wx, 38, 2.6, 2.6, 'g'); px(g, wx, 38, 'G'); px(g, wx + (mv ? 1 : 0), 37 + (mv ? 0 : -0), 'K'); }
    for (x = 8 + (mv ? 2 : 0); x < 57; x += 4) { px(g, x, 33, 'g'); px(g, x + 2, 42, 'g'); }
    // front spiked wheel on an arm
    var cx = 61, cy = 31, r = 7, rot = mv * Math.PI / 10 + (atk ? Math.PI / 20 : 0);
    line(g, 52, 26 + y0, cx, cy, 'r', 3);
    for (var k = 0; k < 10; k++) {
      var an = rot + k * Math.PI / 5;
      var t = pol(cx, cy, r + 3.5, an), b1 = pol(cx, cy, r - 0.5, an - 0.28), b2 = pol(cx, cy, r - 0.5, an + 0.28);
      tri(g, t[0], t[1], b1[0], b1[1], b2[0], b2[1], 'G');
    }
    oval(g, cx, cy, r, r, 'g'); oval(g, cx, cy, r - 1.5, r - 1.5, 'r');
    for (k = 0; k < 4; k++) { var e = pol(cx, cy, r - 1, rot + k * Math.PI / 2); line(g, cx, cy, e[0], e[1], 'K'); }
    oval(g, cx, cy, 1.5, 1.5, 'G');
    if (atk) { [[46, 24], [44, 29], [47, 35]].forEach(function (s2) { line(g, s2[0], s2[1], s2[0] - 5, s2[1], 'G'); }); }
  });

  // ---- THE HOARDER: 15-ft obese woman, matted black hair, sores, one crooked tooth, ripped filthy
  //      t-shirt, tight blue sweatpants with PINK down the leg, barefoot ----
  boss('hoarder', { s: C.n2, S: C.n1, h: C.K, w: C.g1, W: C.g0, b: C.b3, B: C.b1, p: C.m2, r: C.o0, K: C.K, n: C.n0, N: C.n1, e: C.K }, 52, 58, function (g, p) {
    var b = p.a === 'idle' ? p.i : 0, st = p.a === 'walk' ? (p.i ? 1 : -1) : 0, sp = p.a === 'special', atk = p.a === 'attack';
    var cx = 25;
    // legs: tight blue sweatpants with the PINK stripe down the leg, bare feet
    [[cx - 13, -st], [cx + 2, st]].forEach(function (L, k) {
      var lx = L[0], ly = L[1];
      oval(g, lx + 5, 41, 6, 4, 'b'); rect(g, lx + 1, 41, 10, 12 + ly, 'b');
      var ex = k ? lx + 10 : lx + 1; rect(g, ex - (k ? 1 : 0), 39, 2, 14 + ly, 'p');
      line(g, lx + (k ? 1 : 9), 43, lx + (k ? 1 : 9), 52 + ly, 'B');
      oval(g, lx + 6 + (k ? 1 : -1), 55 + ly, 5.5, 2, 's');
      for (var t = 0; t < 4; t++) px(g, lx + (k ? 6 : 2) + t * 2, 56 + ly, 'S');
    });
    // far arm
    oval(g, cx - 18, 28 + b, 5, 9, 's'); oval(g, cx - 19, 37 + b, 4, 3.5, 's'); line(g, cx - 21, 24 + b, cx - 20, 34 + b, 'S');
    // body: pear-shaped mass; ripped t-shirt over the top, belly hanging out over the waistband
    oval(g, cx, 31 + b, 20, 11, 's');
    oval(g, cx, 22 + b, 17, 8, 'w'); oval(g, cx, 27 + b, 20, 7, 'w');
    for (var x = cx - 20; x <= cx + 20; x++) { var e = 31 + b + ((x * 7) % 5 === 0 ? 2 : (x % 3 === 0 ? -1 : 0)); for (var y = e; y < 44 + b; y++) if (g[y] && g[y][x] === 'w') g[y][x] = 's'; }
    oval(g, cx + 3, 37 + b, 1, 1, 'S');
    line(g, cx - 12, 41 + b, cx + 13, 41 + b, 'S'); line(g, cx - 10, 42 + b, cx + 10, 42 + b, 'S');
    [[cx - 9, 21], [cx + 7, 26], [cx - 3, 28], [cx + 11, 20]].forEach(function (q) { rect(g, q[0], q[1] + b, 3, 2, 'W'); });
    line(g, cx - 13, 25 + b, cx - 10, 30 + b, 'K'); line(g, cx + 10, 21 + b, cx + 12, 25 + b, 'K');
    [[cx - 14, 35], [cx + 14, 36], [cx - 5, 39], [cx + 6, 38]].forEach(function (q) { px(g, q[0], q[1] + b, 'r'); px(g, q[0] + 1, q[1] + b, 'S'); });
    // near arm: hangs, or grabs forward
    if (atk) {
      oval(g, cx + 18, 22 + b, 6, 5, 's'); rect(g, cx + 18, 19 + b, 7, 7, 's'); oval(g, cx + 23, 22 + b, 3.5, 3.5, 's');
      for (var f = 0; f < 4; f++) line(g, cx + 24, 19 + b + f * 2, cx + 25, 18 + b + f * 2, 's');
      px(g, cx + 20, 20 + b, 'r'); px(g, cx + 21, 20 + b, 'S');
    } else {
      oval(g, cx + 18, 28 + b, 5, 9, 's'); oval(g, cx + 19, 37 + b, 4, 3.5, 's'); line(g, cx + 21, 24 + b, cx + 21, 33 + b, 'S');
      px(g, cx + 17, 30 + b, 'r'); px(g, cx + 18, 30 + b, 'S');
    }
    oval(g, cx + 15, 20 + b, 5, 4, 'w'); oval(g, cx - 15, 20 + b, 5, 4, 'w');
    // head: round face turned right, double chin, matted black mop of hair
    var hx = cx + 2, hy = 7 + b;
    oval(g, hx - 1, hy + 9, 9, 4, 's'); oval(g, hx, hy + 3, 9, 9, 's');
    line(g, hx - 5, hy + 12, hx + 5, hy + 12, 'S');
    oval(g, hx - 3, hy - 3, 9, 5, 'h'); rect(g, hx - 10, hy - 2, 6, 15, 'h'); oval(g, hx - 7, hy + 12, 3, 3, 'h');
    [[hx - 9, 17], [hx - 6, 18], [hx - 3, 14], [hx + 2, 3], [hx + 6, 2]].forEach(function (q) { line(g, q[0], hy, q[0] + (q[1] & 1), hy + q[1] - 1, 'h'); });
    px(g, hx + 7, hy - 3, 'h'); px(g, hx + 8, hy - 2, 'h'); px(g, hx + 5, hy - 5, 'h'); px(g, hx - 1, hy - 7, 'h');
    // face
    rect(g, hx + 3, hy + 2, 2, 2, 'e'); line(g, hx + 2, hy + 1, hx + 5, hy, 'h');
    rect(g, hx + 8, hy + 3, 2, 4, 'S'); px(g, hx + 9, hy + 6, 'S');
    if (sp) {
      oval(g, hx + 4, hy + 9, 4, 3.5, 'K'); px(g, hx + 6, hy + 6, 'w');
      oval(g, hx + 7, hy + 9, 3, 2, 'n'); line(g, hx + 5, hy + 8, hx + 9, hy + 8, 'N'); px(g, hx + 10, hy + 9, 'N');
      line(g, hx + 9, hy + 7, hx + 13, hy + 3, 'N'); line(g, hx + 9, hy + 11, hx + 12, hy + 14, 'n'); line(g, hx + 6, hy + 11, hx + 7, hy + 14, 'n');
    } else {
      line(g, hx + 2, hy + 8, hx + 8, hy + 7, 'K'); px(g, hx + 6, hy + 9, 'w'); px(g, hx + 7, hy + 9, 'w'); px(g, hx + 7, hy + 10, 'w');
    }
    px(g, hx - 1, hy + 5, 'r'); px(g, hx + 5, hy + 5, 'r'); px(g, cx - 19, 31 + b, 'r'); px(g, cx - 17, 25 + b, 'r');
    if (p.a === 'hurt') { rect(g, hx + 3, hy + 2, 2, 1, 'S'); px(g, hx + 2, hy + 1, 'K'); }
  });

  // ---- THE GOBLIN WAR CHIEFTAIN: big goblin, bone crown, red war paint, huge cleaver, dynamite belt ----
  boss('chieftain', { q: C.G1, Q: C.G0, w: C.W, r: C.o1, m: C.g1, M: C.g0, n: C.n0, e: C.y2, K: C.K }, 30, 32, function (g, p) {
    var b = p.a === 'idle' ? p.i : 0, st = p.a === 'walk' ? (p.i ? 1 : -1) : 0, atk = p.a === 'attack', sp = p.a === 'special';
    var cx = 13;
    // legs
    rect(g, cx - 5 + st, 25, 4, 5, 'q'); rect(g, cx + 2 - st, 25, 4, 5, 'q');
    rect(g, cx - 6 + st, 29, 5, 2, 'Q'); rect(g, cx + 2 - st, 29, 5, 2, 'Q');
    // body
    oval(g, cx, 18 + b, 8, 7, 'q');
    rect(g, cx - 6, 21 + b, 13, 4, 'n'); for (var x = cx - 6; x < cx + 7; x += 3) px(g, x, 24 + b, 'K');
    // dynamite belt: red sticks across the chest (bandolier) + at the waist
    line(g, cx - 6, 13 + b, cx + 5, 21 + b, 'n');
    for (var k = 0; k < 4; k++) { var dx = cx - 5 + k * 3, dy = 14 + b + k * 2; rect(g, dx, dy - 1, 2, 3, 'r'); px(g, dx, dy - 2, 'w'); }
    rect(g, cx - 6, 20 + b, 13, 1, 'r'); for (x = cx - 5; x < cx + 7; x += 2) px(g, x, 21 + b, 'r');
    // back arm
    oval(g, cx - 8, 17 + b, 3, 4, 'q'); rect(g, cx - 10, 19 + b, 3, 4, 'q');
    // head
    var hy = 7 + b;
    oval(g, cx + 1, hy, 7, 6, 'q');
    tri(g, cx - 6, hy - 2, cx - 12, hy - 6, cx - 5, hy + 2, 'q'); tri(g, cx + 6, hy - 3, cx + 12, hy - 7, cx + 7, hy, 'q');
    px(g, cx - 10, hy - 5, 'Q'); px(g, cx + 10, hy - 6, 'Q');
    // war paint stripes + eyes
    line(g, cx - 3, hy - 2, cx + 7, hy - 2, 'r'); line(g, cx - 2, hy + 2, cx + 1, hy + 4, 'r'); line(g, cx + 4, hy + 2, cx + 6, hy + 4, 'r');
    rect(g, cx + 1, hy - 1, 2, 2, 'e'); rect(g, cx + 5, hy - 1, 2, 2, 'e'); px(g, cx + 2, hy, 'K'); px(g, cx + 6, hy, 'K');
    // mouth: tusky grin (roar when special)
    if (sp) { rect(g, cx + 1, hy + 3, 7, 3, 'K'); px(g, cx + 2, hy + 3, 'w'); px(g, cx + 6, hy + 3, 'w'); px(g, cx + 4, hy + 5, 'w'); }
    else { line(g, cx + 1, hy + 4, cx + 7, hy + 4, 'K'); px(g, cx + 2, hy + 3, 'w'); px(g, cx + 6, hy + 3, 'w'); }
    // bone crown
    rect(g, cx - 4, hy - 7, 10, 2, 'w'); [cx - 4, cx - 1, cx + 2, cx + 5].forEach(function (x2, k2) { line(g, x2, hy - 8, x2, hy - 10 - (k2 & 1), 'w'); });
    px(g, cx, hy - 6, 'K'); px(g, cx + 3, hy - 6, 'K');
    // front arm + cleaver
    if (atk) { // swung down and forward
      oval(g, cx + 8, 16 + b, 3, 3, 'q'); rect(g, cx + 9, 17 + b, 4, 3, 'q');
      rect(g, cx + 12, 17 + b, 2, 3, 'n');
      rect(g, cx + 13, 19, 9, 10, 'm'); tri(g, cx + 13, 28, cx + 21, 28, cx + 21, 30, 'm');
      line(g, cx + 14, 29, cx + 21, 30, 'w'); line(g, cx + 21, 19, cx + 21, 29, 'M'); px(g, cx + 19, 21, 'K');
      line(g, cx + 15, 16, cx + 22, 17, 'm'); line(g, cx + 16, 14, cx + 22, 15, 'M');
    } else if (sp) { // lit dynamite held high
      oval(g, cx + 8, 15 + b, 3, 3, 'q'); line(g, cx + 9, 14 + b, cx + 11, 6 + b, 'q', 3);
      rect(g, cx + 10, 1 + b, 3, 5, 'r'); line(g, cx + 11, 0, cx + 13, 0, 'K'); px(g, cx + 14, 0, 'e'); px(g, cx + 15, 1, 'w'); px(g, cx + 14, 2, 'e');
      rect(g, cx - 12, 22, 2, 2, 'n'); rect(g, cx - 14, 24, 6, 6, 'm'); line(g, cx - 14, 29, cx - 9, 29, 'w');
    } else { // cleaver raised over the shoulder
      oval(g, cx + 8, 16 + b, 3, 4, 'q'); rect(g, cx + 8, 18 + b, 3, 4, 'q');
      rect(g, cx + 10, 19 + b, 2, 3, 'n'); line(g, cx + 11, 19 + b, cx + 14, 13 + b, 'n', 2);
      rect(g, cx + 14, 2 + b, 9, 12, 'm'); tri(g, cx + 14, 2 + b, cx + 22, 2 + b, cx + 22, 0, 'm');
      line(g, cx + 22, 1 + b, cx + 22, 13 + b, 'w'); line(g, cx + 14, 13 + b, cx + 21, 13 + b, 'M'); px(g, cx + 16, 4 + b, 'K');
      px(g, cx + 18, 8 + b, 'r'); px(g, cx + 19, 9 + b, 'r');
    }
    if (p.a === 'hurt') { rect(g, cx + 1, hy - 1, 6, 2, 'q'); line(g, cx + 1, hy, cx + 2, hy - 1, 'K'); line(g, cx + 5, hy - 1, cx + 6, hy, 'K'); }
  });

  // ---- THE JUICER: troglodyte bodybuilder. Tiny lizard head, zits round beady eyes, absurd veiny
  //      muscles, arms too big to lower, waddling wide stance, tiny black shorts, a tail ----
  boss('juicer', { s: C.G1, S: C.G0, v: C.p0, V: C.o1, z: C.o2, e: C.y2, K: C.K, w: C.W, m: C.g1, M: C.g0, f: C.o1, F: C.y2 }, 44, 48, function (g, p) {
    var b = p.a === 'idle' ? p.i : 0, st = p.a === 'walk' ? (p.i ? 1 : -1) : 0;
    var flex = p.a === 'special', atk = p.a === 'attack', vein = flex ? 'V' : 'v';
    var cx = 21 + st;
    // tail (behind)
    line(g, cx - 4, 33, cx - 13, 41, 's', 3); line(g, cx - 13, 41, cx - 19, 45, 's', 2); px(g, cx - 20, 46, 's');
    // legs: huge thighs, wide stance, clawed feet
    var lt = st;
    oval(g, cx - 7 - lt, 37, 5, 6, 's'); oval(g, cx + 7 + lt, 37, 5, 6, 's');
    rect(g, cx - 13 - lt, 40, 5, 4, 's'); rect(g, cx + 9 + lt, 40, 5, 4, 's');
    rect(g, cx - 15 - lt, 44, 7, 3, 'S'); rect(g, cx + 9 + lt, 44, 7, 3, 'S');
    px(g, cx - 16 - lt, 46, 'w'); px(g, cx + 16 + lt, 46, 'w');
    line(g, cx - 9 - lt, 34, cx - 11 - lt, 40, vein); line(g, cx + 9 + lt, 34, cx + 11 + lt, 40, vein);
    // tiny black shorts
    rect(g, cx - 8, 30 + b, 17, 5, 'K'); rect(g, cx - 9, 33 + b, 6, 3, 'K'); rect(g, cx + 4, 33 + b, 6, 3, 'K');
    // torso: V shape, pecs, abs
    tri(g, cx - 15, 11 + b, cx + 16, 11 + b, cx, 33 + b, 's');
    rect(g, cx - 8, 18 + b, 17, 13, 's');
    oval(g, cx - 5, 16 + b, 6, 4, 's'); oval(g, cx + 6, 16 + b, 6, 4, 's');
    line(g, cx - 10, 20 + b, cx - 1, 20 + b, 'S'); line(g, cx + 2, 20 + b, cx + 11, 20 + b, 'S'); line(g, cx, 14 + b, cx, 30 + b, 'S');
    for (var k = 0; k < 3; k++) { line(g, cx - 4, 23 + b + k * 3, cx - 1, 23 + b + k * 3, 'S'); line(g, cx + 2, 23 + b + k * 3, cx + 5, 23 + b + k * 3, 'S'); }
    line(g, cx - 7, 15 + b, cx - 3, 21 + b, vein); line(g, cx + 9, 14 + b, cx + 6, 19 + b, vein);
    // traps + neck
    tri(g, cx - 10, 11 + b, cx + 11, 11 + b, cx + 1, 5 + b, 's');
    rect(g, cx - 3, 6 + b, 9, 6, 's');
    // tiny lizard head (on a beefy neck), long snout right, zits circling the beady eye
    var hx = cx + 2, hy = 5 + b;
    oval(g, hx, hy, 4.5, 4, 's'); rect(g, hx + 1, hy - 2, 8, 5, 's'); oval(g, hx + 9, hy, 1.5, 2, 's');
    line(g, hx + 3, hy + 2, hx + 10, hy + 2, 'K'); px(g, hx + 9, hy - 1, 'K');
    line(g, hx + 4, hy + 3, hx + 9, hy + 3, 'S');
    rect(g, hx + 1, hy - 2, 2, 2, 'e'); px(g, hx + 2, hy - 1, 'K'); line(g, hx, hy - 3, hx + 3, hy - 3, 'S');
    [[hx - 1, hy - 3], [hx + 4, hy - 3], [hx - 1, hy], [hx + 4, hy], [hx + 1, hy - 4], [hx - 3, hy - 1]].forEach(function (q) { px(g, q[0], q[1], 'z'); });
    // arms: can't lower them. lat-spread / throw / double-biceps flex
    function delt(side) { oval(g, cx + side * 15, 13 + b, 5, 5, 's'); }
    function armOut(side) {
      var sx = cx + side * 15;
      oval(g, sx + side * 3, 20 + b, 4, 6, 's'); // biceps hanging out
      oval(g, sx + side * 5, 28 + b, 3.5, 4, 's'); // forearm
      oval(g, sx + side * 5, 32 + b, 3, 2.5, 'S'); // fist
      line(g, sx + side * 2, 15 + b, sx + side * 4, 24 + b, vein); line(g, sx + side * 4, 25 + b, sx + side * 6, 30 + b, vein);
    }
    function armFlex(side) {
      var sx = cx + side * 15;
      oval(g, sx + side * 4, 10 + b, 5, 4, 's'); // upper arm straight out
      oval(g, sx + side * 6, 3 + b, 3.5, 4, 's'); // forearm up
      oval(g, sx + side * 6, 0 + b, 2.5, 2, 'S');
      oval(g, sx + side * 3, 8 + b, 3.5, 3, 's'); // the peak
      line(g, sx + side * 1, 9 + b, sx + side * 6, 7 + b, vein); line(g, sx + side * 6, 6 + b, sx + side * 6, 1 + b, vein);
    }
    delt(-1); delt(1);
    if (flex) { armFlex(-1); armFlex(1); }
    else if (atk) {
      armOut(-1);
      var sx = cx + 15; // throwing arm: cocked overhead with a flaming weight plate
      oval(g, sx + 3, 9 + b, 4, 4, 's'); oval(g, sx + 4, 3 + b, 3, 4, 's');
      oval(g, sx + 1, 2, 5, 5, 'M'); oval(g, sx + 1, 2, 3, 3, 'm'); px(g, sx + 1, 2, 'K');
      [[-4, -4], [0, -5], [4, -3], [-6, 0]].forEach(function (q) { px(g, sx + 1 + q[0], 2 + q[1], 'f'); px(g, sx + 1 + q[0], 3 + q[1], 'F'); });
      line(g, sx + 1, 8 + b, sx + 4, 3 + b, vein);
    } else { armOut(-1); armOut(1); }
    if (p.a === 'hurt') { px(g, hx + 1, hy - 1, 'K'); px(g, hx + 2, hy - 2, 'K'); }
  });

  // ---- THE BALL OF SWINE (a.k.a. the Porkchop Express): a sphere of fused tuskling nobles. Faces,
  //      hooves, helmets and scraps of formal wear ride the rim; the rolling frames rotate them ----
  function swineFace(g, x, y, dazed) {
    oval(g, x, y, 4.2, 3.4, 'P'); oval(g, x, y, 3.4, 2.6, 'p');
    oval(g, x + 1, y + 1, 1.8, 1.2, 'P'); px(g, x, y + 1, 'K'); px(g, x + 2, y + 1, 'K');
    if (dazed) { px(g, x - 2, y - 2, 'w'); px(g, x + 3, y - 2, 'w'); px(g, x - 2, y - 1, 'K'); px(g, x + 3, y - 1, 'K'); }
    else { px(g, x - 2, y - 1, 'K'); px(g, x + 3, y - 1, 'K'); }
    px(g, x - 2, y + 2, 'w'); px(g, x - 3, y + 1, 'w'); px(g, x + 4, y + 2, 'w'); px(g, x + 5, y + 1, 'w');
  }
  function swineBall(g, rot, o) {
    o = o || {};
    var cx = o.cx || 28, cy = o.cy || 28, rx = o.rx || 25, ry = o.ry || 25;
    // limbs poking out of the rim: stubby legs with black hooves, arms with pink hands
    for (var k = 0; k < 10; k++) {
      var an = rot + k * Math.PI * 2 / 10 + 0.2, L = k % 3 === 1 ? 3.5 : 2;
      var a = [cx + Math.cos(an) * (rx - 3), cy + Math.sin(an) * (ry - 3)], e = [cx + Math.cos(an + (k % 2 ? 0.08 : -0.08)) * (rx + L), cy + Math.sin(an + (k % 2 ? 0.08 : -0.08)) * (ry + L)];
      line(g, a[0], a[1], e[0], e[1], 'p', 3);
      rect(g, Math.round(e[0]) - 1, Math.round(e[1]) - 1, 2, 2, k % 2 ? 'K' : 'P');
      if (k % 3 === 0) { var t2 = pol(cx, cy, rx - 1, an + 0.3); px(g, t2[0], t2[1], 'w'); }
    }
    oval(g, cx, cy, rx, ry, 'p');
    // shading crescent (lower right) + highlight (upper left)
    for (var y = cy - ry; y <= cy + ry; y++) for (var x = cx - rx; x <= cx + rx; x++) {
      if (!g[y] || g[y][x] !== 'p') continue;
      var dx = (x - cx) / rx, dy = (y - cy) / ry;
      if (dx * dx + dy * dy > 0.62 && dx * 0.5 + dy * 0.85 > 0.35) g[y][x] = 'P';
    }
    oval(g, cx - 9, cy - 11, 5, 2.5, 'q');
    // rim features (rotate with the ball)
    var feats = ['face', 'cloth', 'helm', 'face', 'hair', 'face', 'cloth', 'helm'];
    feats.forEach(function (f, k) {
      var an = rot + k * Math.PI / 4, r = (k % 2 ? 0.62 : 0.72);
      var x = Math.round(cx + Math.cos(an) * rx * r), y = Math.round(cy + Math.sin(an) * ry * r);
      if (f === 'face') swineFace(g, x, y, o.dazed);
      else if (f === 'helm') { oval(g, x, y, 3.5, 2.5, 'g'); line(g, x - 3, y + 2, x + 3, y + 2, 'K'); px(g, x - 1, y - 1, 'K'); px(g, x + 1, y - 2, 'w'); }
      else if (f === 'cloth') { tri(g, x - 3, y - 2, x + 3, y - 2, x, y + 3, 'K'); px(g, x - 1, y - 1, 'r'); px(g, x + 1, y, 'r'); px(g, x + 2, y - 1, 'r'); }
      else { line(g, x - 2, y - 1, x - 1, y + 1, 'K'); line(g, x + 1, y - 2, x + 2, y, 'K'); px(g, x + 3, y + 1, 'w'); }
    });
    swineFace(g, Math.round(cx + Math.cos(rot + 0.4) * 3), Math.round(cy + Math.sin(rot + 0.4) * 3), o.dazed);
    // a red-sequin gown scrap and a tux tail draped across
    var sa = rot + Math.PI * 0.85;
    for (var s2 = 0; s2 < 5; s2++) { var q = pol(cx, cy, 10 + s2 * 2.2, sa + s2 * 0.12); px(g, q[0], q[1], 'r'); px(g, q[0] + 1, q[1], s2 % 2 ? 'R' : 'r'); }
  }
  boss('ball_of_swine', { p: C.r3, P: C.r2, q: C.m3, w: C.W, K: C.K, g: C.g1, r: C.o1, R: C.y2 }, 56, 56, function (g, p) {
    if (p.a === 'walk') swineBall(g, p.i * Math.PI / 8);
    else if (p.a === 'attack') {
      swineBall(g, Math.PI / 16);
      [[3, 18], [1, 28], [3, 38]].forEach(function (s2) { line(g, s2[0], s2[1], s2[0] + 2, s2[1], 'w'); });
    } else if (p.a === 'special') { // slammed into the wall: squashed, dazed, seeing stars
      swineBall(g, 0, { cx: 26, cy: 31, rx: 25, ry: 22, dazed: true });
      [[16, 4], [28, 2], [40, 5]].forEach(function (s2) { sparkle(g, s2[0], s2[1], 'R', 'w'); });
    } else swineBall(g, 0, { ry: p.a === 'idle' && p.i ? 24 : 25, cy: p.a === 'idle' && p.i ? 29 : 28 });
  });

  // ---- THE TUSKLING DOMINATRIX: pig-orc noblewoman, red gown under a black leather harness, whip ----
  boss('dominatrix', { p: C.r3, P: C.r2, w: C.W, K: C.K, r: C.o1, R: C.o0, n: C.n0, y: C.y2 }, 22, 30, function (g, p) {
    var b = p.a === 'idle' ? p.i : 0, st = p.a === 'walk' ? (p.i ? 1 : -1) : 0, atk = p.a === 'attack', sp = p.a === 'special';
    var cx = 10;
    // stubby legs + hooves
    rect(g, cx - 4 + st, 25, 3, 3, 'p'); rect(g, cx + 2 - st, 25, 3, 3, 'p');
    rect(g, cx - 5 + st, 28, 4, 2, 'K'); rect(g, cx + 2 - st, 28, 4, 2, 'K');
    // gown (wide torso, flared skirt) + harness straps
    tri(g, cx - 8, 26, cx + 9, 26, cx, 14 + b, 'r'); rect(g, cx - 6, 14 + b, 13, 8, 'r');
    line(g, cx - 7, 25, cx + 8, 25, 'R');
    for (var x = cx - 6; x < cx + 8; x += 3) px(g, x, 21 + b, 'y');
    line(g, cx - 5, 14 + b, cx + 5, 21 + b, 'K'); line(g, cx + 5, 14 + b, cx - 5, 21 + b, 'K'); rect(g, cx - 6, 18 + b, 13, 1, 'K'); px(g, cx, 17 + b, 'y');
    // back arm
    rect(g, cx - 9, 15 + b, 3, 7, 'p');
    // head: wide warthog head sitting on the shoulders, four tusks, hair in a bun
    var hy = 9 + b;
    oval(g, cx + 1, hy, 7, 5, 'p');
    oval(g, cx + 7, hy + 1, 3, 2.5, 'P'); px(g, cx + 8, hy + 1, 'K'); px(g, cx + 9, hy + 2, 'K');
    rect(g, cx + 2, hy - 2, 2, 2, 'K'); line(g, cx + 1, hy - 3, cx + 4, hy - 4, 'K');
    line(g, cx + 5, hy + 4, cx + 6, hy + 1, 'w'); line(g, cx + 9, hy + 4, cx + 10, hy + 2, 'w'); px(g, cx + 3, hy + 4, 'w');
    px(g, cx + 6, hy + 3, 'y'); // pierced tusk
    oval(g, cx - 3, hy - 5, 4, 3, 'K'); oval(g, cx - 5, hy - 8, 2, 2, 'K'); px(g, cx - 3, hy - 7, 'y');
    rect(g, cx - 6, hy - 1, 2, 3, 'P'); // ear
    // whip arm
    if (atk) { // lash forward
      rect(g, cx + 6, 15 + b, 4, 3, 'p'); rect(g, cx + 10, 14 + b, 2, 3, 'n');
      line(g, cx + 11, 14 + b, cx + 11, 2, 'n'); line(g, cx + 11, 2, 21, 4, 'n'); line(g, 21, 4, 21, 10, 'n'); px(g, 20, 11, 'w'); px(g, 21, 12, 'w');
    } else if (sp) { // crack overhead
      line(g, cx + 6, 15 + b, cx + 9, 9 + b, 'p', 3); rect(g, cx + 9, 6 + b, 2, 3, 'n');
      line(g, cx + 10, 6 + b, cx + 6, 1, 'n'); line(g, cx + 6, 1, cx - 3, 1, 'n'); line(g, cx - 3, 1, cx - 7, 3, 'n'); sparkle(g, cx - 8, 3, 'y', 'w');
    } else {
      rect(g, cx + 6, 15 + b, 3, 6, 'p'); rect(g, cx + 7, 21 + b, 2, 3, 'n');
      line(g, cx + 8, 23 + b, cx + 11, 27, 'n'); line(g, cx + 11, 27, cx + 9, 29, 'n'); line(g, cx + 9, 29, cx + 5, 29, 'n');
    }
    if (p.a === 'hurt') { rect(g, cx + 2, hy - 2, 2, 1, 'p'); px(g, cx + 2, hy - 1, 'K'); px(g, cx + 3, hy - 2, 'K'); }
  });

  // ---- THE KRAKAREN CLONE: 20-ft pink octopus with a suburban-mom blonde bob, clusters of eyes, a
  //      beak, and tentacles covered in screaming red-lipped mouths ----
  function lipsMouth(g, x, y, open, big) {
    var w = big ? 3 : 2;
    oval(g, x, y, w + 0.6, open ? 2.2 : 1.4, 'l');
    if (open) { oval(g, x, y, w - 0.6, 1, 'K'); px(g, x - 1, y - 1, 'w'); px(g, x + 1, y - 1, 'w'); }
    else line(g, x - w + 1, y, x + w - 1, y, 'K');
  }
  function tentacle(g, pts, r0, r1, mouths, phase) {
    // pts: polyline; radius tapers r0 -> r1; mouths: list of t values
    var segs = [], total = 0, i;
    for (i = 1; i < pts.length; i++) { var L = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); segs.push(L); total += L; }
    function at(t) { var d = t * total; for (var j = 0; j < segs.length; j++) { if (d <= segs[j] || j === segs.length - 1) { var u = segs[j] ? Math.min(1, d / segs[j]) : 0; return [pts[j][0] + (pts[j + 1][0] - pts[j][0]) * u, pts[j][1] + (pts[j + 1][1] - pts[j][1]) * u]; } d -= segs[j]; } }
    var n = Math.ceil(total * 1.5);
    for (i = 0; i <= n; i++) { var t = i / n, q = at(t), r = r0 + (r1 - r0) * t; oval(g, q[0], q[1], r, r, 'p'); }
    for (i = 0; i <= n; i++) { var t2 = i / n, q2 = at(t2), r2 = r0 + (r1 - r0) * t2; if (r2 > 1.6) px(g, Math.round(q2[0] - r2 * 0.4), Math.round(q2[1] + r2 * 0.6), 'P'); }
    (mouths || []).forEach(function (t3, k) { var q3 = at(t3); lipsMouth(g, Math.round(q3[0]), Math.round(q3[1]), (k + phase) % 2 === 0, r0 + (r1 - r0) * t3 > 4); });
  }
  boss('krakaren', { p: C.r3, P: C.r2, l: C.r1, K: C.K, w: C.W, y: C.y2, Y: C.y1, e: C.K }, 80, 72, function (g, p) {
    var ph = p.i, atk = p.a === 'attack', sp = p.a === 'special', wv = (p.a === 'idle' || p.a === 'walk') ? (p.i ? 2 : 0) : 1;
    var cx = 40;
    // back tentacles (spread wide, resting on the floor)
    tentacle(g, [[cx - 8, 40], [cx - 22, 48 - wv], [cx - 34, 60], [cx - 37, 69], [cx - 31, 70]], 6, 2, [0.35, 0.65], ph);
    tentacle(g, [[cx + 8, 40], [cx + 22, 47 + wv], [cx + 33, 58], [cx + 37, 68], [cx + 31, 70]], 6, 2, [0.3, 0.62], ph + 1);
    // mantle + head
    oval(g, cx, 24, 17, 19, 'p');
    for (var y = 6; y < 44; y++) for (var x = cx - 17; x <= cx + 17; x++) if (g[y] && g[y][x] === 'p' && (x - cx) * 0.7 + (y - 24) * 0.7 > 13) g[y][x] = 'P';
    // the blonde bob: crown, sides cut level at the jaw, flipped-under tips, side-swept bangs
    oval(g, cx, 12, 19, 11, 'y');
    rect(g, cx - 20, 12, 7, 17, 'y'); rect(g, cx + 14, 12, 7, 17, 'y');
    oval(g, cx - 17, 29, 4, 2, 'y'); oval(g, cx + 17, 29, 4, 2, 'y');
    oval(g, cx + 1, 21, 13, 10, 'p');
    tri(g, cx - 13, 9, cx + 14, 9, cx - 13, 17, 'y');
    for (x = cx - 18; x <= cx + 18; x += 4) line(g, x, 4 + Math.abs(x - cx) / 3, x + 1, 26, 'Y');
    line(g, cx - 12, 16, cx + 12, 10, 'Y');
    // cluster of eyes
    [[cx - 7, 18, 3], [cx + 1, 15, 2], [cx + 7, 18, 3], [cx - 1, 21, 2], [cx + 4, 23, 1], [cx - 9, 23, 1], [cx + 10, 23, 1]].forEach(function (E, k) {
      oval(g, E[0], E[1], E[2], E[2] - (E[2] > 1 ? 0.4 : 0), 'w'); px(g, E[0] + (k % 2), E[1], 'e'); if (E[2] > 2) px(g, E[0] + 1, E[1] + 1, 'e');
      if (p.a === 'hurt') line(g, E[0] - E[2], E[1], E[0] + E[2], E[1], 'e');
    });
    // beak
    tri(g, cx - 3, 27, cx + 3, 27, cx, 33, 'Y'); line(g, cx - 2, 28, cx + 2, 28, 'K');
    // front tentacles: two curl to the floor in front, two reach toward Carl
    tentacle(g, [[cx - 6, 38], [cx - 12, 50], [cx - 14, 62 + (wv >> 1)], [cx - 10, 70], [cx - 5, 69]], 6, 2, [0.3, 0.6], ph);
    tentacle(g, [[cx + 6, 38], [cx + 10, 52], [cx + 9, 63], [cx + 13, 70], [cx + 18, 68]], 6, 2, [0.25, 0.55], ph + 1);
    if (sp) tentacle(g, [[cx + 12, 34], [cx + 24, 26], [cx + 30, 12], [cx + 32, 2], [cx + 36, 1]], 6, 2, [0.25, 0.55, 0.8], ph);
    else if (atk) tentacle(g, [[cx + 12, 34], [cx + 26, 36], [cx + 36, 30], [cx + 39, 26]], 6, 2.5, [0.3, 0.7], 0);
    else tentacle(g, [[cx + 12, 34], [cx + 24, 40 + wv], [cx + 32, 48], [cx + 38, 46 - wv], [cx + 38, 41]], 5, 2, [0.3, 0.65], ph);
    tentacle(g, [[cx - 12, 34], [cx - 24, 40 - wv], [cx - 32, 48], [cx - 38, 46 + wv], [cx - 38, 41]], 5, 2, [0.35, 0.7], ph + 1);
  });
  // the vertical slam piece (drawn at Carl's x, tip on the floor)
  (function () {
    var pal = withK({ p: C.r3, P: C.r2, l: C.r1, K: C.K, w: C.W });
    var fr = [0, 1].map(function (f) {
      var g = blank(16, 96);
      var pts = [[8, 0], [8 + (f ? 1 : -1), 30], [8, 60], [8 + (f ? -1 : 1), 84], [7, 94]];
      tentacle(g, pts, 6.5, 2, [0.18, 0.38, 0.58, 0.76], f);
      return outlined(g);
    });
    def('krakaren_tentacle', pal, fr);
  })();

  // ---- RALPH THE FRENZIED GERBIL: absurdly cute ... until the mouth opens ----
  var RALPH_PAL = { f: C.n2, F: C.n1, b: C.n3, p: C.m3, w: C.W, K: C.K, r: C.o0, R: C.r2 };
  boss('ralph', RALPH_PAL, 16, 14, function (g, p) {
    var hop = p.a === 'walk' && p.i ? -2 : 0, atk = p.a === 'attack', b = p.a === 'idle' ? p.i : 0;
    var y0 = hop;
    // tail
    line(g, 3, 9 + y0, 1, 5 + y0, 'f'); px(g, 1, 4 + y0, 'F'); px(g, 0, 3 + y0, 'F');
    // body
    oval(g, 7, 9 + y0, 5, 3.5, 'f'); oval(g, 8, 10 + y0, 3, 2, 'b');
    // feet
    if (hop) { line(g, 4, 12 + y0, 2, 13, 'p'); line(g, 10, 12 + y0, 12, 13, 'p'); }
    else { rect(g, 4, 12, 3, 1, 'p'); rect(g, 9, 12, 3, 1, 'p'); }
    // head
    var hx = atk ? 12 : 11, hy = 6 + y0;
    oval(g, hx, hy, 3.5, 3, 'f'); oval(g, hx + 1, hy + 1, 2.5, 2, 'b');
    oval(g, hx - 2, hy - 3, 1.5, 1.5, 'f'); px(g, hx - 2, hy - 3, 'p');
    rect(g, hx, hy - 1, 2, 2, 'K'); px(g, hx, hy - 1, 'w');
    px(g, hx + 4, hy + b, 'p');
    if (atk) { rect(g, hx + 2, hy + 1, 3, 2, 'r'); px(g, hx + 3, hy + 1, 'w'); px(g, hx + 4, hy + 2, 'w'); }
    if (p.a === 'hurt') { line(g, hx, hy, hx + 1, hy - 1, 'K'); }
    // paws
    px(g, hx - 1, hy + 4, 'p'); px(g, hx + 1, hy + 4, 'p');
  });
  (function () { // ralph_special: the mouth opened wider than physics, hiding the body (48x40)
    var g = blank(48, 40);
    oval(g, 24, 21, 23, 18, 'f');
    oval(g, 24, 22, 20, 15, 'r');
    oval(g, 24, 25, 12, 9, 'K');
    oval(g, 24, 32, 9, 4, 'R'); line(g, 24, 29, 24, 35, 'r');
    for (var k = 0; k < 13; k++) { // ring of needle teeth
      var x = 6 + k * 3; var up = Math.round(22 - Math.sqrt(Math.max(0, 1 - Math.pow((x - 24) / 21, 2))) * 14);
      tri(g, x - 1, up, x + 1, up, x, up + 4, 'w');
      var dn = Math.round(22 + Math.sqrt(Math.max(0, 1 - Math.pow((x - 24) / 21, 2))) * 14);
      tri(g, x - 1, dn, x + 1, dn, x, dn - 4, 'w');
    }
    // tiny ears + eyes stretched to the rim, little paws at the bottom: still technically cute
    oval(g, 9, 4, 3, 3, 'f'); px(g, 9, 4, 'p'); oval(g, 39, 4, 3, 3, 'f'); px(g, 39, 4, 'p');
    rect(g, 15, 3, 3, 3, 'K'); px(g, 15, 3, 'w'); rect(g, 31, 3, 3, 3, 'K'); px(g, 31, 3, 'w');
    rect(g, 14, 38, 4, 2, 'p'); rect(g, 30, 38, 4, 2, 'p');
    def('ralph_special', withK(RALPH_PAL), [outlined(g)]);
  })();

  // ---- THE RAGE ELEMENTAL: 15-ft mass of black and purple smoke, a flickering badger skull with
  //      goat horns and fire eyes, six obsidian rake claws, galloping ----
  boss('rage_elemental', { d: C.p0, D: C.m0, s: C.p1, K: C.K, w: C.W, W: C.g1, f: C.o1, F: C.y2 }, 72, 60, function (g, p) {
    var ph = p.i, gal = p.a === 'walk', atk = p.a === 'attack', sp = p.a === 'special';
    var cx = 32, cy = 28;
    // rear legs (four, galloping) - obsidian with purple sheen, rake claws
    function leg(x0, y0, x1, y1, x2, y2) {
      line(g, x0, y0, x1, y1, 'K', 3); line(g, x1, y1, x2, y2, 'K', 2);
      line(g, x0 + 1, y0, x1 + 1, y1, 'D');
      for (var t = -1; t <= 2; t++) line(g, x2, y2, x2 + t * 2 + 2, 59, 'K');
    }
    var L = gal ? (ph ? [[-14, -3], [-6, 4], [2, -4], [10, 3]] : [[-12, 4], [-4, -3], [4, 4], [12, -2]]) : [[-14, 0], [-6, 0], [2, 0], [10, 0]];
    L.forEach(function (q, k) { var x = cx + q[0]; leg(x, 40, x + q[1] - 2, 49, x + q[1] * 2, 56); });
    // smoke body: dark purple mass, lumpy, with wisps rising and black cores
    oval(g, cx, cy + 4, 24, 14, 'd');
    [[cx - 18, cy - 4, 9], [cx - 6, cy - 8, 11], [cx + 8, cy - 7, 10], [cx + 17, cy + 1, 8], [cx - 22, cy + 8, 6]].forEach(function (q) { oval(g, q[0], q[1], q[2], q[2] * 0.8, 'd'); });
    var wisps = ph ? [[cx - 20, 8], [cx - 8, 4], [cx + 4, 6], [cx - 14, 2]] : [[cx - 18, 6], [cx - 6, 2], [cx + 6, 8], [cx - 24, 10]];
    if (sp) wisps = wisps.concat([[cx - 2, 0], [cx + 12, 2], [cx - 28, 4]]);
    wisps.forEach(function (q) { oval(g, q[0], q[1] + 3, 3, 3, 'd'); oval(g, q[0] + 1, q[1], 2, 2, 'D'); });
    // dark churning underside, lighter puff tops
    for (var yy = cy + 8; yy < cy + 20; yy++) for (var xx = cx - 26; xx < cx + 26; xx++) if (g[yy] && g[yy][xx] === 'd' && ((xx * 3 + yy * 5 + ph * 4) % 7 < 3 || yy > cy + 12 + ((xx + ph) % 3))) g[yy][xx] = 'K';
    [[cx - 18, cy - 10, 5], [cx - 6, cy - 16, 6], [cx + 8, cy - 14, 5], [cx + 17, cy - 5, 4]].forEach(function (q) { line(g, q[0] - q[2], q[1] + 2, q[0] + q[2] - 2, q[1] - 1, 's'); px(g, q[0] - q[2] + 1, q[1] + 1, 's'); });
    [[cx - 16, cy - 8], [cx + 2, cy - 10], [cx + 12, cy - 2], [cx - 6, cy + 12], [cx + 16, cy + 10]].forEach(function (q, k) {
      line(g, q[0], q[1], q[0] + 4, q[1] + (k + ph) % 2 * 2 - 1, 'D'); px(g, q[0] - 1, q[1] + 1, 's');
    });
    // forward claws: long jointed, finger-like
    function claw(x0, y0, x1, y1, x2, y2) {
      line(g, x0, y0, x1, y1, 'K', 3); line(g, x1, y1, x2, y2, 'K', 2); line(g, x0, y0 - 1, x1, y1 - 1, 'D');
      for (var t = -1; t <= 1; t++) line(g, x2, y2, x2 + 5, y2 + t * 3 + 2, 'K');
    }
    if (atk || sp) { claw(cx + 18, 26, cx + 26, 12, cx + 34, 6); claw(cx + 14, 30, cx + 28, 22, cx + 36, 18); }
    else { var r = gal && ph ? 2 : 0; claw(cx + 18, 30, cx + 28, 36 - r, cx + 34, 46 - r); claw(cx + 14, 34, cx + 22, 42 + r, cx + 30, 52); }
    // badger skull with curved goat horns, fire in the sockets
    var sx = cx + 20, sy = 16 + (gal ? ph : 0);
    line(g, sx - 3, sy - 3, sx - 10, sy - 9, 'W', 3); line(g, sx - 10, sy - 9, sx - 16, sy - 6, 'W', 2); line(g, sx - 16, sy - 6, sx - 17, sy - 2, 'W');
    for (var hk = 0; hk < 4; hk++) px(g, sx - 5 - hk * 3, sy - 5 - (hk < 2 ? hk * 2 : 4 - hk), 'K');
    oval(g, sx, sy, 6, 5, 'w'); rect(g, sx + 2, sy - 2, 9, 6, 'w'); oval(g, sx + 11, sy + 1, 2, 2.5, 'w');
    line(g, sx - 5, sy + 2, sx + 12, sy + 3, 'W'); line(g, sx + 3, sy + 4, sx + 12, sy + 4, 'w');
    for (var tx = sx + 4; tx < sx + 13; tx += 2) px(g, tx, sy + 3, 'K');
    px(g, sx + 12, sy - 1, 'K');
    var big = sp ? 1 : 0;
    oval(g, sx + 3, sy - 1, 2 + big, 2 + big, 'K'); px(g, sx + 3, sy - 1, 'f'); px(g, sx + 4, sy - 1, 'F'); px(g, sx + 3, sy, 'f');
    if (sp) { oval(g, sx + 3, sy - 1, 1.5, 1.5, 'f'); px(g, sx + 3, sy - 1, 'F'); }
    line(g, sx + 3, sy - 4, sx + 1, sy - 8 - ph, 'f'); px(g, sx + 1, sy - 9 - ph, 'F');
    if (p.a === 'hurt') { px(g, sx + 3, sy - 1, 'w'); px(g, sx + 4, sy - 1, 'w'); }
  });


  /* ================================================================== *
   *  PORTRAITS 32x32 (bust shots on a dark backdrop)
   * ================================================================== */
  function portrait(name, pal, bg, draw) {
    var g = blank(32, 32);
    draw(g);
    g = outlined(g);
    // backdrop: dark fill + a lighter stripe band behind the head for depth
    for (var y = 0; y < 32; y++) for (var x = 0; x < 32; x++) if (T(g[y][x])) g[y][x] = ((x + y) % 8 === 0 && y < 20) ? 'Z' : 'z';
    var P2 = withK(pal); P2.z = bg[0]; P2.Z = bg[1];
    def(name, P2, [g]);
  }
  var BG_HERO = ['#000000', '#004058'], BG_FOE = ['#000000', '#503000'], BG_NPC = ['#000000', '#0000bc'];
  // generic humanoid face helpers
  function eyeP(g, x, y, look) { rect(g, x, y, 2, 3, 'w'); rect(g, x + (look || 1), y + 1, 1, 2, 'e'); }

  portrait('p_carl', { K: C.K, s: '#fca044', S: '#e45c10', h: '#503000', e: C.K, w: C.W, m: C.K, j: '#881400', J: '#503000', t: '#fca044' }, BG_HERO, function (g) {
    rect(g, 4, 26, 24, 6, 'j'); rect(g, 12, 26, 9, 6, 't'); line(g, 12, 26, 14, 31, 'J'); line(g, 20, 26, 18, 31, 'J');
    rect(g, 13, 22, 7, 5, 's');
    oval(g, 16, 14, 10, 10, 's');
    rect(g, 6, 3, 21, 6, 'h'); oval(g, 15, 6, 11, 4, 'h'); rect(g, 5, 7, 4, 7, 'h');
    px(g, 13, 9, 'h'); px(g, 19, 9, 'h'); px(g, 25, 8, 'h');
    rect(g, 4, 13, 3, 4, 'S'); px(g, 5, 14, 'K');
    line(g, 11, 11, 14, 11, 'h'); line(g, 18, 11, 21, 11, 'h');
    eyeP(g, 12, 12, 1); eyeP(g, 19, 12, 1);
    rect(g, 22, 16, 2, 2, 'S');
    for (var x = 9; x < 25; x += 2) { px(g, x, 21, 'S'); px(g, x + 1, 22, 'S'); px(g, x, 23, 'S'); }
    rect(g, 14, 20, 6, 1, 'm'); px(g, 20, 19, 'm');
  });
  portrait('p_donut', { o: TORTIE.o, t: TORTIE.t, x: C.K, O: TORTIE.O, c: TORTIE.c, e: TORTIE.e, w: TORTIE.w, p: C.m2, y: C.y2, j: C.p1, J: C.p3, K: C.K }, BG_HERO, function (g) {
    oval(g, 16, 27, 13, 6, 'o'); oval(g, 16, 28, 7, 4, 'c');
    oval(g, 16, 17, 12, 10, 'o');
    tri(g, 4, 3, 10, 9, 4, 12, 'o'); tri(g, 28, 3, 22, 9, 28, 12, 'o'); tri(g, 5, 6, 8, 9, 5, 10, 'p'); tri(g, 27, 6, 24, 9, 27, 10, 'p');
    for (var k = 0; k < 6; k++) { px(g, 3 + k, 22 + k % 2, 'o'); px(g, 28 - k, 22 + k % 2, 'o'); }
    oval(g, 16, 22, 6, 4, 'c');
    rect(g, 8, 14, 5, 3, 'w'); rect(g, 19, 14, 5, 3, 'w'); rect(g, 10, 15, 2, 2, 'e'); rect(g, 21, 15, 2, 2, 'e'); px(g, 11, 15, 'K'); px(g, 22, 15, 'K');
    rect(g, 8, 13, 5, 2, 'O'); rect(g, 19, 13, 5, 2, 'O'); // haughty lids
    rect(g, 15, 20, 3, 2, 'p'); line(g, 16, 22, 16, 23, 'K'); line(g, 13, 24, 15, 23, 'K'); line(g, 17, 23, 19, 24, 'K');
    line(g, 4, 20, 10, 21, 'c'); line(g, 22, 21, 28, 20, 'c');
    rect(g, 11, 5, 11, 3, 'y'); for (k = 0; k < 4; k++) { px(g, 11 + k * 3 + 1, 3, 'j'); px(g, 11 + k * 3 + 1, 4, 'y'); } px(g, 16, 2, 'j'); px(g, 15, 5, 'j'); px(g, 16, 5, 'J'); px(g, 17, 5, 'j');
    tortieGrid(g, 3, 11);
  });
  portrait('p_mongo', { g: C.G1, G: C.l2, S: C.G0, w: C.W, e: C.K, m: C.o0 }, BG_HERO, function (g) {
    oval(g, 14, 26, 10, 7, 'g'); oval(g, 16, 28, 5, 4, 'G');
    oval(g, 15, 14, 11, 9, 'g'); rect(g, 16, 10, 15, 9, 'g'); rect(g, 16, 18, 14, 4, 'G');
    rect(g, 17, 18, 14, 2, 'm'); for (var x = 17; x < 31; x += 2) { px(g, x, 18, 'w'); px(g, x + 1, 19, 'w'); }
    rect(g, 13, 8, 6, 5, 'w'); rect(g, 15, 9, 3, 3, 'e'); px(g, 15, 9, 'w');
    for (x = 5; x < 14; x += 3) rect(g, x, 12, 2, 2, 'S');
    px(g, 28, 12, 'S'); px(g, 26, 12, 'S');
  });
  portrait('p_zev', { b: C.c1, B: C.c2, f: C.b4, w: C.W, e: C.K, h: C.g3, m: C.g1, c: C.m1, x: C.K }, BG_HERO, function (g) {
    rect(g, 4, 26, 24, 6, 'c'); tri(g, 13, 26, 19, 26, 16, 31, 'w');
    oval(g, 16, 15, 12, 11, 'b'); oval(g, 18, 20, 8, 4, 'B');
    tri(g, 10, 1, 20, 4, 12, 7, 'f'); tri(g, 3, 14, 6, 10, 6, 20, 'f');
    rect(g, 15, 8, 7, 7, 'w'); rect(g, 19, 10, 3, 4, 'e'); px(g, 20, 10, 'w');
    rect(g, 18, 19, 9, 2, 'x'); px(g, 26, 18, 'x');
    rect(g, 3, 6, 3, 3, 'h'); rect(g, 4, 3, 16, 2, 'h'); rect(g, 4, 9, 2, 12, 'h'); line(g, 5, 20, 14, 23, 'm'); rect(g, 13, 22, 3, 2, 'h');
  });
  portrait('p_ai', { c: C.y1, C: C.y0, s: C.c0, g: C.l2, G: C.G2, a: C.g1, r: C.o1, w: C.W }, BG_NPC, function (g) {
    line(g, 9, 0, 13, 5, 'a'); line(g, 23, 0, 19, 5, 'a'); rect(g, 14, 4, 4, 2, 'r');
    rect(g, 1, 6, 30, 24, 'c'); rect(g, 3, 8, 22, 19, 's'); rect(g, 26, 10, 3, 3, 'r'); rect(g, 26, 15, 3, 3, 'C'); rect(g, 26, 20, 3, 6, 'C');
    rect(g, 7, 11, 4, 4, 'g'); rect(g, 17, 11, 4, 4, 'g'); px(g, 9, 12, 'G'); px(g, 19, 12, 'G');
    rect(g, 5, 18, 2, 2, 'g'); rect(g, 21, 18, 2, 2, 'g'); rect(g, 7, 20, 14, 2, 'g'); rect(g, 9, 22, 10, 2, 'g');
    for (var x = 8; x < 20; x += 3) rect(g, x, 20, 2, 1, 'w');
    rect(g, 4, 30, 4, 2, 'C'); rect(g, 24, 30, 4, 2, 'C');
  });

  /* ---------------- BOOK ONE PORTRAITS (32x32) ---------------- */
  // expressions for the heroes
  portrait('p_carl_mad', { K: C.K, s: C.n2, S: C.n1, h: C.y0, e: C.K, w: C.W, m: C.K, j: C.n0, J: C.y0, t: C.n2, r: C.o1 }, BG_HERO, function (g) {
    rect(g, 4, 26, 24, 6, 'j'); rect(g, 12, 26, 9, 6, 't'); line(g, 12, 26, 14, 31, 'J'); line(g, 20, 26, 18, 31, 'J');
    rect(g, 13, 22, 7, 5, 's');
    oval(g, 16, 14, 10, 10, 's');
    rect(g, 6, 3, 21, 6, 'h'); oval(g, 15, 6, 11, 4, 'h'); rect(g, 5, 7, 4, 7, 'h');
    px(g, 13, 9, 'h'); px(g, 19, 9, 'h'); px(g, 25, 8, 'h');
    rect(g, 4, 13, 3, 4, 'S'); px(g, 5, 14, 'K');
    line(g, 10, 10, 14, 12, 'h'); line(g, 18, 12, 22, 10, 'h'); line(g, 10, 11, 14, 13, 'h'); line(g, 18, 13, 22, 11, 'h');
    rect(g, 12, 13, 2, 2, 'w'); px(g, 13, 14, 'e'); rect(g, 19, 13, 2, 2, 'w'); px(g, 19, 14, 'e');
    rect(g, 22, 16, 2, 2, 'S');
    for (var x = 9; x < 25; x += 2) { px(g, x, 21, 'S'); px(g, x + 1, 22, 'S'); px(g, x, 23, 'S'); }
    rect(g, 12, 19, 9, 3, 'm'); line(g, 13, 20, 19, 20, 'w'); px(g, 16, 19, 'w'); px(g, 16, 21, 'w');
    line(g, 27, 6, 29, 4, 'r'); line(g, 28, 8, 31, 7, 'r'); line(g, 26, 4, 26, 1, 'r');
  });
  portrait('p_donut_smug', { o: TORTIE.o, t: TORTIE.t, x: C.K, O: TORTIE.O, c: TORTIE.c, e: TORTIE.e, w: TORTIE.w, p: C.m2, y: C.y2, j: C.p1, J: C.p3, K: C.K }, BG_HERO, function (g) {
    oval(g, 16, 27, 13, 6, 'o'); oval(g, 16, 28, 7, 4, 'c');
    oval(g, 16, 16, 12, 10, 'o');
    tri(g, 4, 2, 10, 8, 4, 11, 'o'); tri(g, 28, 2, 22, 8, 28, 11, 'o'); tri(g, 5, 5, 8, 8, 5, 9, 'p'); tri(g, 27, 5, 24, 8, 27, 9, 'p');
    for (var k = 0; k < 6; k++) { px(g, 3 + k, 21 + k % 2, 'o'); px(g, 28 - k, 21 + k % 2, 'o'); }
    oval(g, 16, 21, 6, 4, 'c');
    // half-lidded, looking down her nose
    rect(g, 8, 13, 5, 3, 'w'); rect(g, 19, 13, 5, 3, 'w'); rect(g, 10, 14, 2, 2, 'e'); rect(g, 21, 14, 2, 2, 'e'); px(g, 11, 15, 'K'); px(g, 22, 15, 'K');
    rect(g, 8, 12, 5, 3, 'O'); rect(g, 19, 12, 5, 3, 'O'); line(g, 7, 12, 13, 13, 'K'); line(g, 19, 13, 25, 12, 'K');
    rect(g, 15, 18, 3, 2, 'p'); line(g, 16, 20, 16, 21, 'K'); line(g, 13, 22, 15, 21, 'K'); line(g, 17, 21, 20, 21, 'K'); px(g, 21, 20, 'K');
    line(g, 4, 19, 10, 20, 'c'); line(g, 22, 20, 28, 19, 'c');
    rect(g, 11, 4, 11, 3, 'y'); for (k = 0; k < 4; k++) { px(g, 11 + k * 3 + 1, 2, 'j'); px(g, 11 + k * 3 + 1, 3, 'y'); } px(g, 16, 1, 'j'); px(g, 15, 4, 'j'); px(g, 16, 4, 'J'); px(g, 17, 4, 'j');
    tortieGrid(g, 3, 11);
  });

  // Mordecai: the Rat Hooligan (floor 1) and the Bugaboo (floor 2)
  portrait('p_mordecai_f1', { g: C.g0, G: C.g1, p: C.r3, P: C.r2, w: C.W, e: C.K, v: C.K, b: C.b3, K: C.K }, BG_NPC, function (g) {
    rect(g, 3, 25, 26, 7, 'v'); rect(g, 12, 25, 8, 7, 'G');
    oval(g, 14, 14, 9, 9, 'g');
    tri(g, 18, 9, 31, 17, 18, 22, 'g'); oval(g, 30, 17, 1.5, 1.5, 'p');
    oval(g, 7, 6, 5, 5, 'g'); oval(g, 7, 6, 3, 3, 'p');
    // bushy brows, tired eyes
    rect(g, 15, 9, 6, 2, 'G'); rect(g, 16, 11, 4, 3, 'w'); rect(g, 18, 12, 2, 2, 'e'); line(g, 16, 11, 19, 11, 'g');
    // long wispy beard to the chest + whiskers
    tri(g, 14, 19, 28, 20, 18, 31, 'G'); tri(g, 10, 19, 18, 21, 14, 31, 'G');
    line(g, 15, 23, 17, 30, 'w'); line(g, 21, 21, 20, 28, 'w');
    line(g, 24, 16, 31, 13, 'G'); line(g, 24, 18, 31, 19, 'G');
    line(g, 21, 19, 27, 19, 'K');
  });
  portrait('p_mordecai_f2', { f: C.p0, F: C.K, w: C.W, y: C.y2, Y: C.y1, x: C.K, n: C.g0 }, BG_NPC, function (g) {
    oval(g, 16, 18, 15, 15, 'f');
    for (var k = 0; k < 11; k++) { px(g, 2 + k * 3, 3 + (k % 2), 'f'); line(g, 3 + k * 3, 22 + (k % 3), 4 + k * 3, 27 + (k % 3), 'F'); }
    oval(g, 9, 13, 7, 7, 'w'); oval(g, 23, 13, 7, 7, 'w');
    oval(g, 10, 13, 4.5, 4.5, 'y'); oval(g, 24, 13, 4.5, 4.5, 'y'); oval(g, 10, 13.5, 3, 3, 'Y');
    oval(g, 10, 13, 2.5, 2.5, 'x'); oval(g, 24, 13, 2.5, 2.5, 'x'); px(g, 9, 12, 'w'); px(g, 23, 12, 'w');
    tri(g, 14, 19, 19, 19, 16, 23, 'n');
    line(g, 12, 26, 20, 26, 'F');
  });

  // Bopca Protectors
  function bopcaPort(g, apron, hat) {
    oval(g, 16, 18, 14, 13, 'h');
    for (var k = 0; k < 9; k++) { px(g, 2, 9 + k * 2, 'h'); px(g, 30, 9 + k * 2, 'h'); line(g, 5 + k * 3, 14, 6 + k * 3, 30, 'H'); }
    oval(g, 16, 18, 10, 9, 'h');
    rect(g, 10, 13, 3, 3, 'x'); rect(g, 20, 13, 3, 3, 'x'); px(g, 10, 13, 'w'); px(g, 20, 13, 'w');
    oval(g, 17, 19, 4, 3.5, 'r'); px(g, 15, 18, 'R'); px(g, 18, 20, 'R'); px(g, 16, 21, 'R'); px(g, 15, 17, 'w');
    for (k = 0; k < 5; k++) line(g, 11 + k * 2, 23, 11 + k * 2, 27, 'H');
    rect(g, 5, 28, 22, 4, apron); rect(g, 13, 29, 4, 2, 'w');
    hat(g);
  }
  portrait('p_tally', { h: C.y1, H: C.y0, x: C.K, r: C.o1, R: C.r1, b: C.b3, w: C.W, W: C.g1 }, BG_NPC, function (g) {
    bopcaPort(g, 'b', function (g2) { tri(g2, 6, 6, 26, 6, 16, 0, 'w'); rect(g2, 6, 5, 21, 3, 'w'); line(g2, 6, 7, 26, 7, 'W'); });
  });
  portrait('p_qwist', { h: C.y1, H: C.l0, x: C.K, r: C.o1, R: C.r1, b: C.o0, w: C.W, W: C.g1 }, BG_NPC, function (g) {
    bopcaPort(g, 'b', function (g2) { rect(g2, 8, 0, 16, 7, 'w'); oval(g2, 10, 2, 4, 3, 'w'); oval(g2, 22, 2, 4, 3, 'w'); line(g2, 8, 6, 23, 6, 'W'); line(g2, 13, 1, 13, 5, 'W'); line(g2, 18, 1, 18, 5, 'W'); });
  });

  // goblin shamanka sisters
  function gobPort(g, pierced) {
    rect(g, 4, 25, 24, 7, 'r'); tri(g, 12, 25, 20, 25, 16, 31, 'g');
    oval(g, 15, 15, 10, 10, 'g');
    tri(g, 6, 12, 0, 4, 7, 17, 'g'); tri(g, 25, 11, 31, 3, 24, 17, 'g'); px(g, 2, 6, 'G'); px(g, 29, 5, 'G');
    rect(g, 14, 12, 3, 2, 'y'); rect(g, 20, 12, 3, 2, 'y'); px(g, 16, 13, 'K'); px(g, 22, 13, 'K');
    line(g, 13, 10, 17, 11, 'G'); line(g, 19, 11, 23, 10, 'G');
    line(g, 21, 15, 23, 17, 'G');
    if (pierced) {
      rect(g, 13, 20, 10, 3, 'K'); for (var x = 13; x < 23; x += 2) { px(g, x, 20, 'w'); px(g, x + 1, 22, 'w'); }
      [[13, 9], [15, 9], [20, 9], [22, 9], [24, 16], [24, 18], [12, 23], [16, 23], [20, 23], [5, 9], [4, 11], [27, 8], [28, 10], [10, 16], [11, 19], [19, 16]].forEach(function (q) { px(g, q[0], q[1], 'm'); });
    } else {
      line(g, 14, 21, 21, 20, 'K'); px(g, 21, 19, 'K'); px(g, 15, 22, 'w'); px(g, 24, 16, 'm'); px(g, 5, 9, 'm');
    }
  }
  portrait('p_rory', { g: C.G1, G: C.G0, r: C.p0, y: C.y2, Y: C.y1, w: C.W, m: C.g1, K: C.K, l: C.G0 }, BG_FOE, function (g) {
    gobPort(g, true);
    rect(g, 28, 8, 2, 24, 'Y'); oval(g, 29, 5, 2, 3, 'y'); px(g, 28, 4, 'Y'); px(g, 30, 6, 'Y'); line(g, 29, 2, 28, 0, 'l'); line(g, 29, 2, 31, 0, 'l');
  });
  portrait('p_lorelai', { g: C.G1, G: C.G0, r: C.p0, y: C.y2, w: C.W, m: C.g1, K: C.K, h: C.K }, BG_FOE, function (g) {
    gobPort(g, false);
    oval(g, 15, 4, 4, 3, 'h'); rect(g, 13, 0, 4, 3, 'h');
    for (var k = 0; k < 6; k++) { rect(g, 9 + k * 3, 26 + (k === 0 || k === 5 ? 0 : 1), 2, 2, 'w'); }
  });

  // player killers
  portrait('p_frank_q', { s: C.n2, S: C.n1, h: C.b1, H: C.l2, t: C.K, a: C.p2, A: C.p0, e: C.K, w: C.W, r: C.o1, K: C.K }, BG_FOE, function (g) {
    rect(g, 3, 26, 26, 6, 't');
    tri(g, 0, 31, 8, 22, 12, 31, 'A'); tri(g, 31, 31, 24, 22, 20, 31, 'A'); line(g, 3, 24, 1, 21, 'a'); line(g, 8, 23, 8, 19, 'a'); line(g, 28, 24, 30, 21, 'a'); line(g, 24, 23, 24, 19, 'a');
    rect(g, 13, 21, 7, 6, 's');
    oval(g, 16, 14, 9, 10, 's');
    oval(g, 16, 7, 10, 6, 'h'); rect(g, 6, 7, 21, 4, 'h'); rect(g, 6, 10, 21, 2, 'H');
    // narrow eyes, reddened, stubble
    rect(g, 12, 14, 3, 2, 'w'); px(g, 14, 15, 'e'); px(g, 12, 14, 'r'); rect(g, 19, 14, 3, 2, 'w'); px(g, 21, 15, 'e'); px(g, 19, 14, 'r');
    line(g, 11, 13, 15, 13, 'S'); line(g, 18, 13, 22, 13, 'S');
    rect(g, 16, 16, 2, 4, 'S');
    for (var x = 9; x < 24; x += 2) { px(g, x, 21, 'S'); px(g, x + 1, 23, 'S'); }
    line(g, 13, 21, 19, 21, 'K');
  });
  portrait('p_maggie_my', { s: C.n2, S: C.n1, h: C.y0, l: C.n0, L: C.y0, t: C.r1, e: C.K, w: C.W, d: C.K, D: C.m2, K: C.K }, BG_FOE, function (g) {
    rect(g, 3, 25, 26, 7, 'l'); tri(g, 12, 25, 20, 25, 16, 31, 't'); line(g, 11, 25, 14, 31, 'L'); line(g, 21, 25, 18, 31, 'L');
    rect(g, 13, 21, 7, 5, 's');
    oval(g, 16, 14, 9, 10, 's');
    oval(g, 15, 7, 10, 5, 'h'); rect(g, 6, 6, 4, 9, 'h'); for (var x = 7; x < 25; x += 3) px(g, x, 3, 'h');
    // a glare
    line(g, 11, 11, 15, 13, 'h'); line(g, 18, 13, 23, 11, 'h');
    rect(g, 12, 14, 3, 2, 'w'); px(g, 14, 15, 'e'); rect(g, 19, 14, 3, 2, 'w'); px(g, 19, 15, 'e');
    rect(g, 16, 16, 2, 3, 'S');
    line(g, 13, 21, 19, 20, 'K'); px(g, 13, 22, 'K');
    // the dagger with the purple halo
    line(g, 28, 30, 28, 14, 'd'); line(g, 29, 30, 29, 15, 'd'); rect(g, 26, 25, 6, 1, 'd');
    [[27, 13], [30, 13], [26, 17], [31, 18], [26, 22], [31, 22]].forEach(function (q) { px(g, q[0], q[1], 'D'); });
  });

  // Meadow Lark
  function manPort(g, o) {
    rect(g, 3, 25, 26, 7, 'j'); if (o.collar) o.collar(g);
    rect(g, 12, 20, 9, 7, 's');
    oval(g, 16, 14, o.fat ? 11 : 9, 10, 's');
    rect(g, 12, 13, 3, 2, 'w'); px(g, 14, 14, 'e'); rect(g, 19, 13, 3, 2, 'w'); px(g, 21, 14, 'e');
    rect(g, 16, 15, 2, 4, 'S');
  }
  portrait('p_brandon', { s: C.n0, S: C.y0, h: C.K, j: C.o1, J: C.o0, w: C.W, e: C.K, K: C.K }, BG_HERO, function (g) {
    manPort(g, { fat: true, collar: function (g2) { rect(g2, 2, 23, 28, 4, 'j'); line(g2, 2, 26, 29, 26, 'J'); line(g2, 4, 29, 27, 29, 'J'); } });
    oval(g, 16, 6, 10, 4, 'h'); rect(g, 5, 6, 3, 8, 'h'); rect(g, 25, 6, 3, 8, 'h');
    oval(g, 16, 21, 7, 3, 'h'); rect(g, 13, 19, 7, 2, 'w'); line(g, 13, 19, 19, 19, 'K');
    line(g, 11, 11, 15, 11, 'h'); line(g, 18, 11, 22, 11, 'h');
  });
  portrait('p_chris', { s: C.n0, S: C.y0, h: C.K, c: C.g1, C: C.g0, j: C.c1, J: C.c0, w: C.W, e: C.K, K: C.K }, BG_HERO, function (g) {
    manPort(g, { collar: function (g2) { line(g2, 3, 27, 28, 27, 'J'); } });
    oval(g, 16, 7, 10, 6, 'c'); rect(g, 6, 7, 21, 3, 'c'); line(g, 6, 9, 26, 9, 'C'); px(g, 10, 5, 'C'); px(g, 20, 4, 'C'); px(g, 15, 3, 'w');
    line(g, 12, 12, 15, 12, 'h'); line(g, 18, 12, 22, 12, 'h');
    line(g, 14, 21, 19, 21, 'K');
  });
  portrait('p_imani', { s: C.n2, S: C.n1, h: C.y0, c: C.c1, C: C.c0, k: C.p1, w: C.W, e: C.K, K: C.K, m: C.r2 }, BG_HERO, function (g) {
    rect(g, 3, 25, 26, 7, 'k'); tri(g, 10, 25, 22, 25, 16, 31, 'c'); line(g, 16, 25, 16, 31, 'C');
    rect(g, 13, 20, 7, 6, 's');
    oval(g, 16, 14, 8, 10, 's');
    oval(g, 16, 7, 9, 5, 'h'); rect(g, 7, 7, 4, 10, 'h'); rect(g, 22, 7, 3, 6, 'h'); oval(g, 9, 3, 4, 3, 'h');
    rect(g, 12, 13, 3, 2, 'w'); px(g, 14, 14, 'e'); rect(g, 18, 13, 3, 2, 'w'); px(g, 20, 14, 'e');
    rect(g, 16, 15, 1, 3, 'S'); line(g, 14, 20, 18, 20, 'm');
  });
  portrait('p_yolanda', { s: C.n2, S: C.n1, h: C.y0, H: C.g1, c: C.m2, C: C.m0, w: C.W, b: C.b4, e: C.K, K: C.K }, BG_HERO, function (g) {
    rect(g, 2, 25, 28, 7, 'c'); rect(g, 20, 27, 5, 3, 'w'); rect(g, 21, 28, 2, 1, 'b'); line(g, 16, 25, 16, 31, 'C');
    rect(g, 12, 20, 9, 6, 's');
    oval(g, 16, 15, 10, 10, 's');
    oval(g, 16, 6, 10, 5, 'h'); oval(g, 16, 1, 5, 3, 'h'); rect(g, 6, 6, 4, 8, 'h'); line(g, 12, 3, 18, 6, 'H');
    line(g, 11, 12, 15, 13, 'h'); line(g, 18, 13, 22, 12, 'h');
    rect(g, 12, 14, 3, 2, 'w'); px(g, 14, 15, 'e'); rect(g, 19, 14, 3, 2, 'w'); px(g, 21, 15, 'e');
    rect(g, 16, 16, 2, 3, 'S'); line(g, 13, 21, 19, 21, 'K'); line(g, 9, 18, 10, 20, 'S'); line(g, 23, 18, 22, 20, 'S');
  });
  portrait('p_agatha', { s: C.n2, S: C.n1, r: C.o1, R: C.W, a: C.p1, A: C.l1, B: C.y2, x: C.K, w: C.W, K: C.K }, BG_FOE, function (g) {
    rect(g, 2, 24, 28, 8, 'a'); for (var x = 2; x < 30; x += 4) { line(g, x, 24, x + 3, 31, 'A'); px(g, x + 2, 26, 'B'); }
    oval(g, 16, 16, 8, 9, 's');
    // trapper hat askew, red checks, ear flaps
    tri(g, 4, 9, 28, 3, 26, 11, 'r'); oval(g, 15, 6, 11, 5, 'r'); rect(g, 4, 9, 5, 10, 'r'); rect(g, 24, 8, 5, 8, 'r');
    for (var y = 1; y < 19; y += 2) for (x = 3; x < 30; x += 2) if (g[y][x + (y >> 1) % 2] === 'r') px(g, x + (y >> 1) % 2, y, 'R');
    // wrinkles, black eyes, too-wide smile
    line(g, 11, 12, 14, 12, 'S'); line(g, 18, 12, 21, 12, 'S');
    rect(g, 12, 14, 2, 2, 'x'); rect(g, 19, 14, 2, 2, 'x'); px(g, 12, 14, 'w');
    line(g, 10, 17, 11, 19, 'S'); line(g, 22, 17, 21, 19, 'S');
    rect(g, 11, 20, 11, 2, 'x'); px(g, 10, 19, 'x'); px(g, 22, 19, 'x'); px(g, 13, 20, 'w'); px(g, 18, 20, 'w'); px(g, 20, 21, 'w');
    line(g, 12, 23, 20, 23, 'S');
  });
  portrait('p_elle', { s: C.n2, S: C.n1, h: C.W, H: C.g1, c: C.m0, C: C.p0, e: C.K, w: C.W, r: C.r1, K: C.K, y: C.y2 }, BG_HERO, function (g) {
    rect(g, 3, 25, 26, 7, 'c'); line(g, 16, 25, 16, 31, 'C'); px(g, 15, 27, 'y'); px(g, 15, 29, 'y');
    rect(g, 13, 21, 7, 5, 's');
    oval(g, 16, 15, 9, 10, 's');
    [[8, 6], [13, 3], [19, 3], [24, 6], [7, 11], [26, 11], [6, 16], [10, 4], [22, 4]].forEach(function (q) { oval(g, q[0], q[1], 3, 3, 'h'); px(g, q[0], q[1], 'H'); });
    // one eyebrow raised: unimpressed
    line(g, 11, 10, 15, 12, 'H'); line(g, 18, 11, 22, 9, 'H');
    rect(g, 12, 13, 3, 2, 'w'); px(g, 14, 14, 'e'); rect(g, 19, 13, 3, 2, 'w'); px(g, 21, 14, 'e');
    line(g, 11, 16, 13, 16, 'S'); line(g, 20, 16, 22, 16, 'S'); rect(g, 16, 15, 2, 4, 'S');
    line(g, 14, 21, 19, 20, 'r'); px(g, 20, 19, 'r');
    line(g, 12, 23, 20, 23, 'S');
  });
  portrait('p_jack', { s: C.n2, S: C.n1, h: C.W, g: C.b6, G: C.b4, e: C.K, w: C.W, K: C.K, r: C.r2 }, BG_HERO, function (g) {
    rect(g, 3, 25, 26, 7, 'g'); for (var x = 5; x < 28; x += 4) { px(g, x, 27, 'G'); px(g, x + 2, 30, 'G'); }
    rect(g, 13, 21, 7, 5, 's');
    oval(g, 16, 14, 10, 11, 's');
    oval(g, 6, 13, 3, 4, 'h'); oval(g, 26, 13, 3, 4, 'h'); px(g, 14, 3, 'h'); px(g, 17, 2, 'h'); px(g, 16, 4, 'h');
    line(g, 10, 7, 13, 8, 'S'); line(g, 18, 8, 22, 7, 'S');
    rect(g, 12, 12, 3, 3, 'w'); px(g, 13, 13, 'e'); rect(g, 19, 12, 3, 3, 'w'); px(g, 21, 14, 'e');
    rect(g, 15, 15, 3, 4, 'S'); px(g, 17, 18, 'r');
    // a sly, gummy grin
    line(g, 11, 20, 13, 22, 'K'); line(g, 13, 22, 20, 22, 'K'); line(g, 20, 22, 22, 19, 'K'); px(g, 18, 21, 'w');
    line(g, 9, 17, 10, 19, 'S'); line(g, 23, 17, 22, 19, 'S');
  });

  // showbiz
  portrait('p_odette', { s: C.n0, S: C.y0, k: C.K, q: C.g3, e: C.b6, E: C.W, b: C.b4, a: C.g1, A: C.g0, r: C.r1, w: C.W, K: C.K,
    g: C.y2, G: C.y1, h: C.y3 }, BG_NPC, function (g) {
    // shoulders, then the breastplate: two gold domes so big they don't fit in the frame
    rect(g, 1, 23, 30, 9, 's');
    oval(g, 8, 31, 8.5, 7, 'g'); oval(g, 24, 31, 8.5, 7, 'g');
    oval(g, 9, 33, 7, 4, 'G'); oval(g, 25, 33, 7, 4, 'G'); oval(g, 8, 31, 6.5, 5, 'g'); oval(g, 24, 31, 6.5, 5, 'g');
    rect(g, 5, 26, 3, 2, 'h'); rect(g, 21, 26, 3, 2, 'h'); line(g, 16, 24, 16, 31, 'K');
    rect(g, 13, 19, 7, 5, 's');
    // her face under the helmet: chin, red lips, a TV smile
    oval(g, 16, 19, 7, 5, 's'); line(g, 12, 20, 20, 20, 'r'); line(g, 13, 21, 19, 21, 'r'); line(g, 13, 20, 19, 20, 'w'); px(g, 12, 19, 'S'); px(g, 20, 19, 'S');
    // the black mantis helmet (grey sheen so it reads), mirrored compound eyes, antennae
    tri(g, 2, 4, 30, 4, 16, 17, 'k'); rect(g, 4, 2, 24, 4, 'k');
    line(g, 2, 4, 16, 17, 'q'); line(g, 30, 4, 16, 17, 'q'); line(g, 4, 2, 27, 2, 'q'); line(g, 14, 6, 16, 15, 'A');
    oval(g, 8, 8, 5.5, 4.5, 'e'); oval(g, 24, 8, 5.5, 4.5, 'e');
    for (var y = 5; y < 13; y++) for (var x = 3; x < 30; x++) if (g[y][x] === 'e' && (x + 2 * y) % 5 === 0) px(g, x, y, 'b');
    rect(g, 5, 6, 2, 2, 'E'); rect(g, 21, 6, 2, 2, 'E');
    line(g, 11, 2, 5, 0, 'A'); line(g, 21, 2, 27, 0, 'A');
    line(g, 12, 15, 13, 18, 'A'); line(g, 20, 15, 19, 18, 'A');
  });
  portrait('p_lexis', { s: C.n2, S: C.n1, h: C.y3, H: C.y2, d: C.K, D: C.g3, e: C.K, w: C.W, m: C.r2, c: C.y1, K: C.K, p: C.p3 }, BG_NPC, function (g) {
    rect(g, 4, 26, 24, 6, 'd'); tri(g, 13, 26, 19, 26, 16, 29, 's');
    rect(g, 14, 21, 5, 6, 's');
    oval(g, 16, 14, 8, 10, 's');
    oval(g, 16, 7, 9, 5, 'h'); oval(g, 16, 1, 4, 3, 'h'); px(g, 15, 0, 'H'); rect(g, 7, 7, 3, 7, 'h'); rect(g, 23, 7, 2, 5, 'h'); line(g, 10, 5, 20, 8, 'H');
    // tired, efficient
    rect(g, 12, 13, 3, 2, 'w'); px(g, 14, 14, 'e'); rect(g, 18, 13, 3, 2, 'w'); px(g, 20, 14, 'e');
    line(g, 12, 12, 14, 12, 'e'); line(g, 18, 12, 20, 12, 'e'); line(g, 12, 16, 14, 16, 'p'); line(g, 18, 16, 20, 16, 'p');
    line(g, 14, 20, 18, 20, 'm');
    // headset mic + clipboard corner
    line(g, 8, 14, 12, 19, 'D'); rect(g, 12, 19, 2, 1, 'D');
    rect(g, 24, 22, 8, 10, 'c'); rect(g, 25, 24, 6, 8, 'w'); line(g, 26, 26, 30, 26, 'D'); line(g, 26, 28, 30, 28, 'D'); rect(g, 26, 21, 4, 2, 'D');
  });
  portrait('p_maestro', { s: C.t1, S: C.t0, h: C.K, w: C.W, r: C.o1, d: C.K, e: C.y2, K: C.K, m: C.g1 }, BG_FOE, function (g) {
    rect(g, 3, 25, 26, 7, 'd'); tri(g, 11, 25, 21, 25, 16, 31, 'w'); tri(g, 12, 26, 16, 28, 12, 30, 'r'); tri(g, 20, 26, 16, 28, 20, 30, 'r'); px(g, 16, 28, 'r');
    rect(g, 12, 21, 9, 5, 's');
    oval(g, 16, 14, 10, 10, 's');
    oval(g, 16, 6, 10, 4, 'h'); rect(g, 6, 6, 4, 6, 'h'); line(g, 8, 3, 26, 5, 'm');
    tri(g, 6, 12, 1, 7, 6, 16, 's'); tri(g, 26, 12, 31, 7, 26, 16, 's');
    line(g, 11, 11, 15, 12, 'h'); line(g, 18, 12, 22, 11, 'h');
    rect(g, 12, 13, 3, 2, 'e'); px(g, 13, 14, 'K'); rect(g, 19, 13, 3, 2, 'e'); px(g, 20, 14, 'K');
    rect(g, 15, 15, 3, 3, 'S');
    // showman grin with tusks
    rect(g, 11, 19, 11, 3, 'K'); line(g, 12, 19, 21, 19, 'w'); px(g, 11, 17, 'w'); px(g, 11, 18, 'w'); px(g, 21, 17, 'w'); px(g, 21, 18, 'w');
  });

  // ---- boss portraits ----
  portrait('p_murder_dozer', { r: C.n0, R: C.n1, g: C.g0, G: C.g1, f: C.n3, q: C.G1, o: C.y2, O: C.o1, K: C.K }, BG_FOE, function (g) {
    puff(g, 4, 3, 3, 'g', 'G'); puff(g, 9, 1, 2, 'g', 'G'); rect(g, 4, 5, 3, 7, 'g');
    rect(g, 2, 11, 28, 13, 'r'); line(g, 2, 11, 29, 11, 'R'); for (var x = 4; x < 29; x += 4) px(g, x, 22, 'R');
    rect(g, 7, 8, 18, 3, 'K'); for (x = 7; x < 25; x += 2) px(g, x, 10, 'f');
    [[10, 7], [16, 6], [22, 7]].forEach(function (q) { oval(g, q[0], q[1], 2, 2, 'q'); px(g, q[0] - 3, q[1] - 1, 'q'); px(g, q[0] + 3, q[1] - 1, 'q'); px(g, q[0] - 1, q[1], 'o'); px(g, q[0] + 1, q[1], 'o'); });
    // the spiked wheel head-on
    for (var k = 0; k < 12; k++) { var an = k * Math.PI / 6, t = pol(16, 22, 11, an), b1 = pol(16, 22, 7, an - 0.25), b2 = pol(16, 22, 7, an + 0.25); tri(g, t[0], t[1], b1[0], b1[1], b2[0], b2[1], 'G'); }
    oval(g, 16, 22, 7, 7, 'g'); oval(g, 16, 22, 5, 5, 'r'); line(g, 11, 22, 21, 22, 'K'); line(g, 16, 17, 16, 27, 'K'); oval(g, 16, 22, 1.5, 1.5, 'G');
  });
  portrait('p_hoarder', { s: C.n2, S: C.n1, h: C.K, H: C.g0, w: C.g1, r: C.o0, e: C.K, K: C.K, W: C.W }, BG_FOE, function (g) {
    oval(g, 16, 31, 15, 4, 'w'); line(g, 6, 29, 9, 31, 'H');
    // matted black mop behind the head
    oval(g, 16, 10, 15, 10, 'h'); rect(g, 1, 10, 30, 14, 'h');
    // a round, fat face, double chin
    oval(g, 17, 16, 10, 11, 's'); oval(g, 17, 26, 8, 4, 's'); line(g, 11, 25, 23, 25, 'S');
    oval(g, 16, 5, 10, 4, 'h'); tri(g, 7, 5, 13, 5, 8, 13, 'h'); tri(g, 21, 4, 27, 6, 26, 12, 'h');
    [[3, 6, 4, 26], [6, 4, 6, 28], [27, 8, 28, 24], [11, 2, 9, 8], [20, 2, 23, 7], [29, 10, 30, 22]].forEach(function (q) { line(g, q[0], q[1], q[2], q[3], 'H'); });
    // beady eyes, piggy nose, the one crooked tooth, sores
    rect(g, 12, 14, 2, 2, 'e'); rect(g, 20, 14, 2, 2, 'e'); px(g, 12, 14, 'W');
    line(g, 11, 12, 14, 13, 'h'); line(g, 19, 13, 22, 12, 'h');
    oval(g, 17, 18, 2, 1.5, 'S'); px(g, 16, 18, 'K'); px(g, 18, 18, 'K');
    line(g, 12, 22, 22, 21, 'K'); rect(g, 18, 22, 2, 3, 'W'); px(g, 20, 24, 'W');
    [[9, 19], [24, 18], [14, 10], [23, 24], [10, 23]].forEach(function (q) { px(g, q[0], q[1], 'r'); px(g, q[0] + 1, q[1], 'S'); });
  });
  portrait('p_chieftain', { q: C.G1, Q: C.G0, w: C.W, r: C.o1, m: C.g1, M: C.g0, n: C.n0, e: C.y2, K: C.K }, BG_FOE, function (g) {
    rect(g, 3, 26, 26, 6, 'q'); line(g, 3, 27, 28, 31, 'n'); for (var k = 0; k < 5; k++) rect(g, 5 + k * 5, 26 + k, 2, 4, 'r');
    oval(g, 16, 16, 11, 10, 'q');
    tri(g, 6, 13, 0, 3, 7, 19, 'q'); tri(g, 26, 13, 31, 2, 25, 19, 'q');
    rect(g, 7, 5, 18, 4, 'w'); [7, 11, 15, 19, 23].forEach(function (x2, k2) { rect(g, x2, 1 + (k2 & 1), 2, 4, 'w'); }); px(g, 12, 6, 'K'); px(g, 19, 6, 'K');
    line(g, 7, 11, 25, 11, 'r'); line(g, 9, 17, 12, 20, 'r'); line(g, 21, 17, 24, 20, 'r');
    rect(g, 11, 13, 4, 3, 'e'); rect(g, 18, 13, 4, 3, 'e'); px(g, 13, 14, 'K'); px(g, 20, 14, 'K');
    rect(g, 11, 21, 11, 3, 'K'); px(g, 12, 21, 'w'); px(g, 20, 21, 'w'); px(g, 12, 20, 'w'); px(g, 20, 20, 'w'); px(g, 15, 23, 'w'); px(g, 17, 23, 'w');
  });
  portrait('p_juicer', { s: C.G1, S: C.G0, v: C.p0, z: C.o2, Z: C.W, e: C.y2, K: C.K }, BG_FOE, function (g) {
    tri(g, 0, 31, 16, 12, 32, 31, 's'); rect(g, 0, 24, 32, 8, 's');
    line(g, 3, 29, 9, 21, 'v'); line(g, 28, 29, 23, 21, 'v'); line(g, 5, 31, 7, 26, 'v');
    rect(g, 10, 14, 13, 12, 's');
    oval(g, 14, 10, 8, 7, 's'); rect(g, 14, 6, 17, 9, 's'); oval(g, 30, 10, 2, 4, 's');
    line(g, 17, 14, 31, 14, 'K'); line(g, 18, 15, 30, 15, 'S'); px(g, 28, 8, 'K'); px(g, 27, 8, 'K');
    rect(g, 13, 7, 4, 3, 'e'); rect(g, 15, 8, 2, 2, 'K');
    [[11, 6], [18, 5], [12, 11], [19, 9], [15, 4], [10, 9]].forEach(function (q) { px(g, q[0], q[1], 'z'); px(g, q[0], q[1] - 1, 'Z'); });
    line(g, 10, 17, 12, 24, 'v'); line(g, 22, 17, 20, 24, 'v');
  });
  portrait('p_ball_of_swine', { p: C.r3, P: C.r2, q: C.m3, w: C.W, K: C.K, g: C.g1, r: C.o1, R: C.y2 }, BG_FOE, function (g) {
    oval(g, 16, 16, 16, 16, 'p');
    for (var y = 0; y < 32; y++) for (var x = 0; x < 32; x++) if (g[y][x] === 'p' && (x - 16) * 0.5 + (y - 16) * 0.85 > 9) g[y][x] = 'P';
    swineFace(g, 10, 11); swineFace(g, 22, 9); swineFace(g, 16, 20); swineFace(g, 6, 23); swineFace(g, 26, 22);
    oval(g, 16, 3, 3.5, 2.5, 'g'); line(g, 13, 5, 19, 5, 'K');
    tri(g, 27, 13, 31, 13, 29, 17, 'K'); px(g, 29, 14, 'r');
    rect(g, 1, 14, 2, 2, 'K'); rect(g, 29, 28, 2, 2, 'K');
  });
  portrait('p_dominatrix', { p: C.r3, P: C.r2, w: C.W, K: C.K, r: C.o1, R: C.o0, n: C.n0, y: C.y2, e: C.K }, BG_FOE, function (g) {
    rect(g, 2, 25, 28, 7, 'r'); line(g, 4, 25, 14, 31, 'K'); line(g, 28, 25, 18, 31, 'K'); px(g, 16, 28, 'y');
    oval(g, 16, 16, 13, 10, 'p');
    oval(g, 16, 5, 8, 4, 'K'); oval(g, 16, 1, 3, 2, 'K'); px(g, 16, 2, 'y');
    rect(g, 3, 9, 4, 6, 'P'); rect(g, 25, 9, 4, 6, 'P');
    rect(g, 10, 12, 3, 3, 'e'); rect(g, 20, 12, 3, 3, 'e'); line(g, 9, 10, 13, 11, 'K'); line(g, 19, 11, 23, 10, 'K');
    oval(g, 16, 18, 5, 3.5, 'P'); rect(g, 14, 17, 1, 2, 'K'); rect(g, 18, 17, 1, 2, 'K');
    line(g, 9, 23, 7, 15, 'w'); line(g, 23, 23, 25, 15, 'w'); px(g, 11, 22, 'w'); px(g, 21, 22, 'w'); px(g, 8, 19, 'y');
    line(g, 11, 23, 21, 23, 'K');
  });
  portrait('p_krakaren', { p: C.r3, P: C.r2, l: C.r1, K: C.K, w: C.W, y: C.y2, Y: C.y1, e: C.K }, BG_FOE, function (g) {
    oval(g, 16, 10, 15, 11, 'y'); rect(g, 1, 10, 6, 18, 'y'); rect(g, 25, 10, 6, 18, 'y'); oval(g, 3, 28, 3, 2, 'y'); oval(g, 29, 28, 3, 2, 'y');
    oval(g, 16, 19, 10, 12, 'p');
    tri(g, 6, 7, 26, 7, 6, 14, 'y');
    for (var x = 3; x < 30; x += 4) line(g, x, 2 + Math.abs(x - 16) / 4, x + 1, 22, 'Y');
    [[11, 14, 3], [21, 14, 3], [16, 11, 2], [16, 18, 2], [8, 20, 1], [24, 20, 1]].forEach(function (E) { oval(g, E[0], E[1], E[2], E[2], 'w'); px(g, E[0], E[1], 'e'); if (E[2] > 2) px(g, E[0] + 1, E[1], 'e'); });
    tri(g, 13, 22, 19, 22, 16, 27, 'Y'); line(g, 14, 23, 18, 23, 'K');
    lipsMouth(g, 8, 29, true, true); lipsMouth(g, 24, 29, true, true);
  });
  portrait('p_ralph', RALPH_PAL, BG_FOE, function (g) {
    oval(g, 16, 22, 13, 10, 'f'); oval(g, 17, 26, 8, 6, 'b');
    oval(g, 7, 7, 4, 5, 'f'); oval(g, 7, 7, 2, 3, 'p'); oval(g, 25, 7, 4, 5, 'f'); oval(g, 25, 7, 2, 3, 'p');
    oval(g, 16, 16, 11, 9, 'f'); oval(g, 16, 20, 7, 5, 'b');
    oval(g, 10, 14, 3.5, 4, 'K'); oval(g, 22, 14, 3.5, 4, 'K'); rect(g, 9, 12, 2, 2, 'w'); rect(g, 21, 12, 2, 2, 'w'); px(g, 11, 16, 'w'); px(g, 23, 16, 'w');
    oval(g, 16, 19, 1.5, 1, 'p'); line(g, 16, 20, 16, 21, 'K'); line(g, 14, 22, 15, 21, 'K'); line(g, 17, 21, 18, 22, 'K');
    px(g, 15, 22, 'w'); px(g, 17, 22, 'w');
    line(g, 3, 18, 9, 19, 'F'); line(g, 23, 19, 29, 18, 'F');
  });
  portrait('p_rage_elemental', { d: C.p0, D: C.m0, s: C.p1, K: C.K, w: C.W, W: C.g1, f: C.o1, F: C.y2 }, BG_FOE, function (g) {
    oval(g, 16, 18, 16, 14, 'd'); [[5, 6, 5], [15, 3, 6], [26, 7, 5]].forEach(function (q) { oval(g, q[0], q[1], q[2], q[2], 'd'); oval(g, q[0] - 1, q[1] - 1, q[2] - 3, q[2] - 3, 'D'); });
    for (var y = 24; y < 32; y++) for (var x = 0; x < 32; x++) if (g[y][x] === 'd' && (x * 3 + y * 5) % 7 < 3) g[y][x] = 'K';
    // horns
    line(g, 9, 11, 3, 4, 'W', 3); line(g, 3, 4, 1, 9, 'W', 2); line(g, 23, 11, 29, 4, 'W', 3); line(g, 29, 4, 31, 9, 'W', 2);
    // badger skull, head-on-ish
    oval(g, 16, 15, 8, 7, 'w'); tri(g, 9, 17, 23, 17, 16, 28, 'w'); line(g, 16, 8, 16, 24, 'W');
    oval(g, 12, 15, 2.5, 2.5, 'K'); oval(g, 20, 15, 2.5, 2.5, 'K'); px(g, 12, 15, 'F'); px(g, 20, 15, 'F'); px(g, 11, 15, 'f'); px(g, 21, 15, 'f'); px(g, 12, 14, 'f'); px(g, 20, 14, 'f');
    line(g, 11, 11, 10, 7, 'f'); line(g, 21, 11, 22, 7, 'f');
    for (x = 12; x < 21; x += 2) { px(g, x, 23, 'K'); px(g, x + 1, 25, 'K'); }
    px(g, 15, 21, 'K'); px(g, 17, 21, 'K');
  });
  defs.p_mordecai = defs.p_mordecai_f1; defs.p_bopca = defs.p_tally;

  /* ================================================================== *
   *  shared vehicle helpers
   * ================================================================== */
  // spoked wheel: tread marks + spokes rotate between frames
  function wheelP(g, cx, cy, r, f, c) {
    oval(g, cx, cy, r, r, c.t);
    for (var k = 0; k < 8; k++) { var an = (k + (f & 1) * 0.5) * Math.PI / 4; px(g, Math.round(cx + Math.cos(an) * (r - 0.4)), Math.round(cy + Math.sin(an) * (r - 0.4)), c.T); }
    var ri = Math.max(1, r - 2);
    oval(g, cx, cy, ri, ri, c.h);
    if (f & 1) { line(g, cx - ri + 1, cy - ri + 1, cx + ri - 1, cy + ri - 1, c.H); line(g, cx - ri + 1, cy + ri - 1, cx + ri - 1, cy - ri + 1, c.H); }
    else { line(g, cx - ri, cy, cx + ri, cy, c.H); line(g, cx, cy - ri, cx, cy + ri, c.H); }
    px(g, cx, cy, c.c || c.T);
  }
  function sparkle(g, x, y, c, c2) { px(g, x, y, c2 || c); px(g, x - 1, y, c); px(g, x + 1, y, c); px(g, x, y - 1, c); px(g, x, y + 1, c); }


  /* ================================================================== *
   *  BOOK ONE VEHICLE + ACTOR OBJECTS
   * ================================================================== */
  // disc wheel: sturdy black disc, copper hub, a rim mark that turns between frames
  function discWheel(g, cx, cy, r, f) {
    oval(g, cx, cy, r, r, 'K');
    oval(g, cx, cy, r - 1.5, r - 1.5, 'g');
    oval(g, cx, cy, r - 2.5, r - 2.5, 'K');
    oval(g, cx, cy, 1.2, 1.2, 'C');
    var an = f ? Math.PI / 4 : 0;
    for (var k = 0; k < 2; k++) { var q = pol(cx, cy, r - 1.5, an + k * Math.PI); px(g, q[0], q[1], 'G'); }
  }
  // ---- THE GOBLIN COPPER CHOPPER: mismatched copper scrap frame, thumping steam engine, alligator-
  //      skull seat with white fur, disc wheels, ape-hanger bars. Carl drives with his legs held out
  //      off the hot engine; Princess Donut rides the sidecar on her orc-skull seat (purple backrest) ----
  var CHOP_PAL = { c: C.n1, C: C.n2, d: C.n0, K: C.K, g: C.g0, G: C.g1, w: C.W, s: C.n2, S: C.n1, h: C.y0, j: C.n0, J: C.y0, r: C.o1,
    o: TORTIE.o, t: TORTIE.t, x: C.K, O: TORTIE.O, e: TORTIE.w, y: C.y2, p: C.p1, P: C.m2, f: C.g1 };
  function chopper(g, f, hurt) {
    var bob = f;          // the engine thumps: chassis bounces 1px
    // exhaust stack curling up behind the rider, smoke puffs
    line(g, 17, 16 + bob, 6, 12 + bob, 'c', 2); line(g, 6, 12 + bob, 4, 4 + bob, 'c', 2); rect(g, 3, 3 + bob, 3, 1, 'C');
    if (f) { puff(g, 3, 1, 2, 'G', 'w'); } else { puff(g, 5, 1, 1.6, 'G', 'w'); puff(g, 1, 3, 1.4, 'G'); }
    // wheels
    discWheel(g, 9, 23, 6, f);
    discWheel(g, 47, 23, 6, f);
    // frame: copper tubes, mismatched
    line(g, 9, 23, 14, 14 + bob, 'c', 2); line(g, 14, 14 + bob, 36, 11 + bob, 'C', 2); line(g, 12, 21, 30, 20 + bob, 'd', 2);
    line(g, 36, 9 + bob, 47, 23, 'c', 2); line(g, 37, 9 + bob, 47, 22, 'C');
    // boiler (the thumping engine), rivets + pressure gauge
    rect(g, 16, 14 + bob, 10, 7, 'c'); rect(g, 16, 14 + bob, 10, 1, 'C'); for (var x = 17; x < 26; x += 2) px(g, x, 20 + bob, 'd');
    oval(g, 19, 17 + bob, 1.5, 1.5, 'w'); px(g, 19, 17 + bob, 'K');
    // alligator-skull seat with white fur
    rect(g, 8, 12 + bob, 10, 3, 'G'); tri(g, 4, 13 + bob, 9, 12 + bob, 9, 15 + bob, 'G'); for (x = 5; x < 12; x += 2) px(g, x, 15 + bob, 'w');
    px(g, 9, 13 + bob, 'K'); rect(g, 10, 10 + bob, 8, 2, 'w');
    // ape-hanger bars
    line(g, 36, 9 + bob, 35, 3 + bob, 'g'); line(g, 35, 3 + bob, 32, 3 + bob, 'g'); rect(g, 31, 3 + bob, 2, 1, 'K');
    // CARL: seated, leather jacket, arms up to the bars, bare legs held straight out
    var cb = bob;
    rect(g, 12, 6 + cb, 6, 6, 'j'); rect(g, 14, 6 + cb, 2, 5, 's'); line(g, 12, 6 + cb, 12, 11 + cb, 'J');
    line(g, 16, 7 + cb, 31, 4 + cb, 'j', 2); px(g, 31, 3 + cb, 's'); px(g, 32, 4 + cb, 's');
    rect(g, 14, 11 + cb, 5, 2, 'w'); px(g, 15, 11 + cb, 'r'); px(g, 17, 12 + cb, 'r');
    line(g, 19, 12 + cb, 27, 11 + cb, 's', 2); rect(g, 27, 9 + cb, 2, 3, 's'); px(g, 28, 9 + cb, 'S');
    oval(g, 15, 3 + cb, 3.5, 3.5, 's'); oval(g, 14, 1 + cb, 4, 2.2, 'h'); rect(g, 11, 1 + cb, 3, 4, 'h');
    px(g, 17, 3 + cb, 'K'); px(g, 19, 4 + cb, 'S'); line(g, 16, 5 + cb, 18, 5 + cb, 'S');
    // the sidecar (near side): copper tub, fur trim, purple backrest; the wheel rides a massive spring
    for (var k = 0; k < 3; k++) { px(g, 31 + (k & 1) * 2, 23 + k, 'g'); px(g, 32, 23 + k, 'g'); }
    discWheel(g, 32, 26, 3.5, f);
    rect(g, 23, 21, 1, 3, 'K'); line(g, 23, 23, 32, 23, 'G');
    rect(g, 22, 15, 3, 7, 'p'); px(g, 23, 15, 'P'); for (k = 15; k < 22; k += 2) px(g, 22, k, 'w');
    // DONUT: tiara, haughty face, fluff over the rim
    var dy = 0;
    oval(g, 31, 13 + dy, 4, 3.5, 'o'); tri(g, 28, 11 + dy, 29, 7 + dy, 31, 10 + dy, 'o'); tri(g, 32, 10 + dy, 34, 7 + dy, 35, 11 + dy, 'o');
    px(g, 29, 9 + dy, 'P'); px(g, 34, 9 + dy, 'P');
    rect(g, 29, 9 + dy, 6, 1, 'y'); px(g, 30, 8 + dy, 'y'); px(g, 32, 7 + dy, 'p'); px(g, 33, 8 + dy, 'y');
    px(g, 31, 12 + dy, 'e'); px(g, 33, 12 + dy, 'e'); px(g, 34, 14 + dy, 'P'); oval(g, 33, 15 + dy, 2, 1, 's');
    if (f) px(g, 28, 10 + dy, 'O');
    tortieGrid(g, 2, 7);   // her tortoiseshell coat (only Donut uses 'o' here)
    oval(g, 33, 15 + dy, 2, 1, 's');
    rect(g, 24, 17, 18, 6, 'c'); oval(g, 41, 19.5, 2, 3, 'c'); rect(g, 24, 17, 18, 1, 'C'); line(g, 25, 22, 41, 22, 'd');
    for (x = 25; x < 41; x += 3) px(g, x, 17, 'w');
    px(g, 27, 19, 'd'); px(g, 33, 20, 'd'); px(g, 38, 19, 'd');
    if (hurt) { [[20, 9], [40, 14], [8, 18]].forEach(function (q) { sparkle(g, q[0], q[1], 'y', 'w'); }); rect(g, 16, 2, 2, 1, 'K'); }
  }
  def('chopper', withK(CHOP_PAL), [0, 1].map(function (f) { var g = blank(56, 30); chopper(g, f); return outlined(g); }));
  def('chopper_hurt', withK(hurtPal(CHOP_PAL)), [(function () { var g = blank(56, 30); chopper(g, 0, true); return outlined(g); })()]);

  // ---- KOBOLD POUND CAGES (24x24): frame 0 a snarling danger dingo behind the bars, frame 1 the same
  //      dingo fed and asleep. cage_open: the door hangs open, nobody home ----
  var CAGE_PAL = { b: C.g1, B: C.g0, n: C.y1, f: C.n1, F: C.n0, w: C.W, x: C.K, r: C.o1, z: C.b4, l: C.y2 };
  function cageFrame(g, open) {
    rect(g, 0, 0, 24, 2, 'B'); rect(g, 0, 22, 24, 2, 'B'); line(g, 0, 0, 23, 0, 'b');
    for (var x = 1; x < 24; x += 4) if (!open || x < 12) line(g, x, 2, x, 21, 'b');
    if (open) { // door swung out to the right, foreshortened
      for (var k = 0; k < 3; k++) line(g, 18 + k * 2, 2 + k, 18 + k * 2, 21 - k, 'b');
      line(g, 17, 2, 22, 4, 'B'); line(g, 17, 21, 22, 19, 'B');
      rect(g, 13, 2, 1, 20, 'B');
    } else { rect(g, 15, 10, 3, 3, 'n'); px(g, 16, 9, 'B'); px(g, 16, 11, 'x'); }
  }
  function dingoIn(g, calm) {
    if (calm) { // curled up asleep on the floor, tail round the nose
      oval(g, 11, 18, 8, 3.5, 'f'); line(g, 4, 20, 18, 20, 'F');
      oval(g, 16, 17, 3.5, 2.5, 'w'); px(g, 17, 17, 'x'); px(g, 15, 17, 'x'); line(g, 16, 18, 18, 18, 'x');
      line(g, 3, 18, 6, 21, 'f'); px(g, 7, 15, 'f'); px(g, 9, 14, 'f');
      px(g, 20, 12, 'z'); px(g, 21, 11, 'z'); px(g, 20, 10, 'z'); rect(g, 22, 7, 1, 1, 'z');
    } else { // up on its legs, corpse-paint snarl, fangs
      oval(g, 9, 13, 6, 4, 'f'); rect(g, 4, 15, 2, 6, 'f'); rect(g, 12, 15, 2, 6, 'f'); line(g, 3, 12, 1, 8, 'f');
      oval(g, 17, 10, 4, 3.5, 'w'); rect(g, 16, 6, 2, 2, 'f'); px(g, 19, 6, 'f');
      px(g, 16, 9, 'x'); px(g, 19, 9, 'x'); rect(g, 17, 12, 5, 1, 'x'); px(g, 21, 11, 'x');
      px(g, 18, 13, 'w'); px(g, 20, 13, 'w'); px(g, 18, 14, 'w'); px(g, 20, 14, 'w'); px(g, 19, 12, 'r');
    }
  }
  def('cage_dingo', withK(CAGE_PAL), [false, true].map(function (calm) {
    var g = blank(24, 24); dingoIn(g, calm); g = outlined(g); cageFrame(g, false); return g;
  }));
  def('cage_open', withK(CAGE_PAL), [(function () { var g = blank(24, 24); cageFrame(g, true); return g; })()]);

  DCW.artActorsKit.def = def;
})();

/* carl_crouch: derived from carl_idle (torso + shins squashed), same palette chars so skins apply. */
(function () {
  'use strict';
  var A = window.DCW && window.DCW.artDefs, src = A && A.carl_idle;
  if (!src || A.carl_crouch) return;
  var drop = { 16: 1, 17: 1, 19: 1, 24: 1, 25: 1 };
  var blank = new Array(src.w + 1).join('.');
  var frames = src.frames.map(function (rows) {
    var kept = rows.filter(function (r, i) { return !drop[i]; });
    while (kept.length < src.h) kept.unshift(blank);
    return kept;
  });
  A.carl_crouch = { w: src.w, h: src.h, pal: src.pal, frames: [frames[0]], ox: src.ox || 0, oy: src.oy || 0 };
})();

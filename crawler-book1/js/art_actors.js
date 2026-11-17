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
    s: '#fce0a8',  // skin (face, hands)
    S: '#fca044',  // skin shade / stubble / ear
    n: '#fce0a8',  // nose (skin) - clown turns it red
    h: '#503000',  // hair
    e: C.K,        // pupils
    w: C.W,        // eye whites / teeth
    m: C.K,        // mouth line
    j: '#881400',  // jacket body (brown leather)
    J: '#503000',  // jacket shade
    v: '#881400',  // sleeves
    V: '#503000',  // sleeve shade
    q: '#503000',  // jacket inner edge / lapel line
    t: '#fce0a8',  // torso under jacket (bare chest by default)
    T: '#fca044',  // torso detail (navel, pec shadow)
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
    var dp = { o: C.n2, c: C.n3, O: C.n1, e: C.G1, w: C.W, p: C.m2, y: C.y2, j: C.p1, m: C.m2, x: C.K };
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
    spr('donut_idle', dp, dI);
    spr('donut_run', dp, DR);
    spr('donut_act', dp, [dact]);

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

  portrait('p_carl', { K: C.K, s: '#fce0a8', S: '#fca044', h: '#503000', e: C.K, w: C.W, m: C.K, j: '#881400', J: '#503000', t: '#fce0a8' }, BG_HERO, function (g) {
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
  portrait('p_donut', { o: C.n2, O: C.n1, c: C.n3, e: C.G1, w: C.W, p: C.m2, y: C.y2, j: C.p1, J: C.p3, K: C.K }, BG_HERO, function (g) {
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

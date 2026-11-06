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

  // run frames (bodies authored with legs in stride)
  var B_RUN = [
    body([
      '.....jjtttjj....',
      '....vjqtttqjvv..',
      '...vvjqtTtqjvVs.',
      '..vVvjqtttqj.ss.',
      '..ss.jqtTtqj....',
      '..ss.jqtttqj....',
      '.....jjbbbjj....',
      '.....bBbbbBb....',
      '....bbbbBbbbb...',
      '...bbb...bbbl...',
      '...lll....lll...',
      '..lll......llff.',
      '.lll.......fFF..',
      'ffFF............'
    ]),
    body([
      '.....jjtttjj....',
      '....vjqtttqjv...',
      '...vvjqtttqjvv..',
      '...vVjqtttqjVv..',
      '...ssjqtTtqjss..',
      '...ssjqtttqjss..',
      '.....jjbbbjj....',
      '.....bBbbbBb....',
      '.....bbbBbbb....',
      '.....bbb.bbb....',
      '......llllll....',
      '......lll.fFF...',
      '......lll.......',
      '.....ffFF.......'
    ]),
    body([
      '.....jjtttjj....',
      '...vvjqtttqjv...',
      '..sVvjqtTtqjvv..',
      '..ss.jqtttqjVvv.',
      '.....jqtTtqj.ss.',
      '.....jqtttqj.ss.',
      '.....jjbbbjj....',
      '.....bBbbbBb....',
      '....bbbbBbbbb...',
      '....lbbb..bbbl..',
      '...lll.....lll..',
      '..lll.......lll.',
      '.ffF.........ll.',
      '..F.........ffFF'
    ]),
    body([
      '.....jjtttjj....',
      '....vjqtttqjv...',
      '...vvjqtttqjvv..',
      '...vVjqtttqjVv..',
      '...ssjqtTtqjss..',
      '...ssjqtttqjss..',
      '.....jjbbbjj....',
      '.....bBbbbBb....',
      '.....bbbBbbb....',
      '.....bbb.bbb....',
      '.....llllll.....',
      '...fFFlll.......',
      '.........lll....',
      '.........ffFF...'
    ])
  ];

  var B_JUMP = body([
    '..ss.jjtttjj.ss.',
    '..vv.jqtttqj.vv.',
    '..vVvjqtTtqjvVv.',
    '...vvjqtttqjvv..',
    '.....jqtTtqj....',
    '.....jqtttqj....',
    '.....jjbbbjj....',
    '.....bBbbbBb....',
    '....bbbbBbbbbb..',
    '....bbb..lllll..',
    '....lll...fFFl..',
    '...lll.....FF...',
    '...fFF..........',
    '................'
  ]);
  var B_FALL = body([
    '.....jjtttjj....',
    '...vvjqtttqjvv..',
    '..vVvjqtTtqjvVv.',
    '.ss..jqtttqj..ss',
    '.ss..jqtTtqj..ss',
    '.....jqtttqj....',
    '.....jjbbbjj....',
    '.....bBbbbBb....',
    '.....bbbBbbb....',
    '.....bbb.bbb....',
    '.....lll.lll....',
    '.....lll..lll...',
    '....ffFF..ffFF..',
    '................'
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
    CARL.carl_run = [
      carlFrame('side', HX + 1, HY, B_RUN[0], BX, BY),
      carlFrame('side', HX + 1, HY - 1, B_RUN[1], BX, BY - 1),
      carlFrame('side', HX + 1, HY, B_RUN[2], BX, BY),
      carlFrame('side', HX + 1, HY - 1, B_RUN[3], BX, BY - 1)
    ];
    CARL.carl_jump = [carlFrame('open', HX, HY - 2, B_JUMP, BX, BY - 2)];
    CARL.carl_fall = [carlFrame('open', HX, HY - 1, B_FALL, BX, BY - 1)];
    CARL.carl_punch = [carlFrame('side', HX + 1, HY, B_PUNCH1, 0, BY), carlFrame('open', HX + 2, HY, B_PUNCH2, 0, BY)];
    CARL.carl_kick = [carlFrame('side', HX, HY, B_KICK1, 0, BY), carlFrame('open', HX - 1, HY + 1, B_KICK2, 0, BY)];
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
  SKIN_DEFS.carl_jacket = {
    pal: { t: C.W, T: C.g1, b: C.b3, B: C.b1, l: C.b3, f: C.W, F: C.g1 },
    pat: function (c, k) { if (c === 'b' && k === 'd') return C.b4; }
  };
  SKIN_DEFS.carl_bodyguard = {
    pal: { j: C.g1, J: C.g0, v: C.g1, V: C.g0, q: C.b1, t: C.b3, T: C.y2, b: C.g0, B: C.g1, l: C.g1, f: C.g0, F: C.g3, s: '#fce0a8' },
    pat: function (c, k) {
      if ((c === 'j' || c === 'v') && (k === 'b' || k === 'x')) return C.g2;
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
      // side: dome over hair, cheek guard at back, gold crown band + jewel
      rectO(o, x, y - 1, w - 1, 5, C.g1); rectO(o, x + 1, y - 2, w - 3, 1, C.g1);
      rectO(o, x + 2, y - 2, w - 6, 1, C.g2);
      rectO(o, x, y + 4, 3, 5, C.g1); rectO(o, x, y + 4, 1, 5, C.g0);
      rectO(o, x, y + 3, w - 1, 1, C.y2);
      crownO(o, x + 1, y - 4, w - 3, C.y2);
      pxO(o, x + 6, y + 3, C.o1);
    }
  };
  SKIN_DEFS.carl_kilt = {
    pal: { j: '#fce0a8', J: '#fca044', v: '#fce0a8', V: '#fca044', q: '#fca044', b: C.r0, B: C.G0, f: '#fce0a8', F: '#fca044' },
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
    pal: { j: C.y2, J: C.y1, v: C.y2, V: C.y1, q: C.y1, t: C.y2, T: C.K, b: C.y2, B: C.y1, l: C.y2, f: C.G0, F: C.t0, s: C.G1, S: C.G0, n: C.G1 },
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
      rectO(o, x, y + h - 2, 4, 2, C.y1); // filter canister
    }
  };
  SKIN_DEFS.carl_pajamas = {
    pal: { j: C.b4, J: C.b2, v: C.b4, V: C.b2, q: C.b2, t: C.b4, T: C.W, b: C.b4, B: C.b2, l: C.b4, f: C.b2, F: C.b1 },
    pat: function (c, k) {
      if ('jvtbl'.indexOf(c) >= 0 && k === 'x') return C.y3; // little stars
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
    pal: { s: C.W, S: C.m3, n: C.o1, h: C.o1, j: C.m1, J: C.m0, v: C.y2, V: C.y1, q: C.m0, t: C.y2, T: C.o1, b: C.G1, B: C.y2, l: C.W, f: C.o1, F: C.o0 },
    pat: function (c, k) {
      if ((c === 'j' || c === 't' || c === 'b') && k === 'd') return c === 't' ? C.b3 : C.W;
      if (c === 'l' && (k === 'b' || k === 'x')) return C.o1;
      if (c === 'v' && (k === 's' || k === 'x')) return C.G1;
    },
    acc: function (o, H) { // rainbow afro wig + red nose + red smile
      var x = H.x, y = H.y, w = H.w, h = H.h;
      var rb = [C.o1, C.n2, C.y2, C.G1, C.b3, C.m1];
      if (H.view === 'dead') { for (var d = 0; d < 6; d++) rectO(o, x - 3 + (d % 3), y - 1 + d * 2, 4, 2, rb[d]); return; }
      var puffs = H.view === 'side' ? [[-3, 1], [-2, -2], [1, -3], [5, -3], [9, -2], [-3, 5], [-2, 8]] :
        [[-3, 1], [-2, -2], [1, -3], [5, -3], [9, -2], [12, 1], [-3, 5], [12, 5]];
      for (var i = 0; i < puffs.length; i++) rectO(o, x + puffs[i][0], y + puffs[i][1], 4, 4, rb[i % rb.length]);
      if (H.view === 'side') { pxO(o, x + 11, y + 8, C.o1); pxO(o, x + 12, y + 8, C.o1); pxO(o, x + 11, y + 9, C.o1); rectO(o, x + 6, y + 10, 5, 1, C.o1); pxO(o, x + 11, y + 9, C.o1); }
      if (H.view === 'front') { pxO(o, x + 5, y + 7, C.o1); pxO(o, x + 6, y + 7, C.o1); rectO(o, x + 3, y + 8, 6, 1, C.o1); }
    }
  };
  SKIN_DEFS.carl_toga = {
    pal: { j: C.W, J: C.g1, v: '#fce0a8', V: '#fca044', q: C.g1, t: C.W, T: C.g1, b: C.W, B: C.g1, f: C.y1, F: C.y0 },
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
    pal: { s: C.y2, S: C.y1, n: C.y2, h: C.y3, e: C.y0, m: C.y0, j: C.y2, J: C.y1, v: C.y2, V: C.y1, q: C.y1, t: C.y3, T: C.y1, b: C.y2, B: C.W, l: C.y2, f: C.y1, F: C.y0 },
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
    // ---- Princess Donut: Persian show cat with a tiara ----
    var dp = { o: C.n2, c: C.n3, O: C.n1, e: C.G1, w: C.W, p: C.m2, y: C.y2, r: C.r1, m: C.m2, x: C.K };
    var d0 = [
      '........y.y.y.',
      '........yyryy.',
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
    var d1 = alt(d0, 2, ['.o.....OoooooO', 'o......ooOooOo', 'oo.....oOOoOO.']);
    var dr0 = legs(alt(d0, 2, ['.......OoooooO', 'ooo....ooOooOo']), ['ooocccccoooo..', 'Occccc...ooo..', 'O.........OO..']);
    var dr1 = legs(alt(d0, 2, ['.......OoooooO', '.oo....ooOooOo', 'oo.....oweowe.']), ['.ooccccooo....', '.ccccccoooc...', '...OO.OO......']);
    var dact = alt(d0, 2, ['o......OoooooO', 'oo.....oooooom', 'oo.....omeome.', '.o.....cccpccm', '.ooooooccxxc.m']);
    dact = alt(dact, 0, ['......m.y.y.y.', '.....m..yyryy.']);
    spr('donut_idle', dp, [d0, d1]);
    spr('donut_run', dp, [dr0, dr1]);
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

    // ---- Katia: shapeshifter in battle armour, ponytail ----
    var kp = { h: C.o1, H: C.o0, s: C.n3, S: C.n2, w: C.W, e: C.K, m: C.o0, a: C.b5, A: C.b1, d: C.y1, c: C.c2, C: C.W };
    var k0 = [
      '....hhhhh...',
      '...hhhhhhh..',
      '..hhhhhhhhh.',
      'hhhhhhhssss.',
      'hhHhhhsswes.',
      'hH.hhsssss..',
      'h...hsssmss.',
      'h....ssss...',
      '.....aSSa...',
      '...aaaAaaa..',
      '..aAaaAaaAa.',
      '..aAaaAaaAa.',
      '..sAaaAaa.s.',
      '...aaaaaa...',
      '...ddddddd..',
      '...aa...aa..',
      '...aa...aa..',
      '...aa...aa..',
      '...AA...AA..',
      '..AAA...AAA.'
    ];
    var k1 = alt(k0, 3, ['hhhhhhhssss.', 'HhHhhhsswes.', '.H.hhsssss..', 'h...hsssmss.']);
    var kr0 = legs(k0, ['..aa.....aa.', '.aa......aa.', '.aa.......aa', 'AA........AA', 'AA.......AAA']);
    var kr1 = legs(alt(k0, 3, ['hhhhhhhssss.', 'hhHhhhsswes.', '.hHhhsssss..', '..h.hsssmss.']), ['....aaaa....', '....aa.aa...', '...aa..aa...', '...AA..AA...', '..AAA..AAA..']);
    var kact = alt(k0, 9, ['...aaaAaaa..', '..aAaaAaaAacc', '..aAaaAaaaccC', '..sAaaAaaaccc', '...aaaaaa.cc']);
    spr('katia_idle', kp, [k0, k1]);
    spr('katia_run', kp, [kr0, kr1]);
    spr('katia_act', kp, [kact]);

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

    // ---- Sir Squeaks: tiny brave rat, helmet, toothpick sword ----
    var qp = { g: C.g1, G: C.g0, H: C.g0, h: C.K, e: C.K, w: C.W, p: C.m3, t: C.m2, s: C.n0, y: C.n3, r: C.o1 };
    var q0 = [
      '.......r....',
      '......HHH...',
      '.....HHHHH..',
      '....phhhhh..',
      '....gggegpp.',
      '......gggg..',
      't..gggggg...',
      '.tgGgggggs..',
      '..gggggg.y..',
      '...g..g..y..',
      '...p..p.....'
    ];
    // sword held up
    var q1 = alt(q0, 0, ['.......r..y.', '......HHH.y.']);
    var qr0 = legs(q0, ['..g....g....', '..p....p....']);
    var qr1 = legs(q0, ['....gg......', '....pp......']);
    var qact = alt(q0, 4, ['.....ggegpp.', '......gggg..', 't..gggggg...', '.tgGggggggsyyyy', '..gggggg.....']);
    spr('squeaks_idle', qp, [q0, q1]);
    spr('squeaks_run', qp, [qr0, qr1]);
    spr('squeaks_act', qp, [qact]);
  })();

  /* ================================================================== *
   *  NPCs
   * ================================================================== */
  (function () {
    // Mordecai: tall grumpy heron-ish guide, apron, mug
    var mp = { f: C.g1, F: C.g0, B: C.y2, b: C.n1, w: C.W, e: C.K, x: C.K, r: C.o0, R: C.n0, a: C.W, A: C.g1, m: C.y1, M: C.y0, W: C.W, l: C.y2 };
    var m0 = [
      '.....FF.......',
      '....FfF.......',
      '...ffffff.....',
      '..ffffffff....',
      '..fFFFxxff....',
      '..ffffwexf....',
      '..fffffffBBB..',
      '..ffffffBBBBBB',
      '...fffffbbbb..',
      '....ffff......',
      '....fFff......',
      '...rrrrrr.....',
      '..rraaaarr....',
      '..frAaaaArf...',
      '.ffrAaaaAr fWW',
      '.ff.aaaaa.fmmmW',
      '.ff.aaaaa.fmmMm',
      '.ff.aaAaa..mmmm',
      '....aaaaa..mmm.',
      '....AaaaA......',
      '....RR..RR.....',
      '....ll..ll.....',
      '....ll..ll.....',
      '....ll..ll.....',
      '...lll..lll....',
      '..llll.llll....'
    ];
    var m1 = alt(m0, 4, ['..fFFFFFff....', '..ffffxxxf....']);
    m1 = alt(m1, 14, ['.ffrAaaaArfWWW.', '.ff.aaaaa.fmmmW', '.ff.aaaaa.fmmMm']);
    spr('mordecai', mp, [m0.map(function (r) { return r.replace(' ', 'r'); }), m1]);

    // Bopca: round fuzzy shopkeeper
    var bp = { f: C.m2, F: C.m1, w: C.W, e: C.K, n: C.r1, x: C.K, v: C.G1, V: C.G0, y: C.y2, t: C.m3 };
    var b0 = [
      '....F..F......',
      '...ftf.ftf....',
      '..ffffffffff..',
      '.ffffffffffff.',
      '.ffwwefffwwef.',
      'fffwwefffwwfff',
      'fffffffnfffff.',
      'ffffxxxxxxffff',
      'fffffwwwwffff.',
      '.ffvvvvvvvvff.',
      'ffvvVvyvVvvvff',
      'ff.vvVvvVvv.ff',
      '...vvvvvvvv...',
      '..ffff..ffff..'
    ];
    var b1 = alt(b0, 4, ['.ffxxxfffxxxf.', 'ffffffffffffff']);
    b1 = alt(b1, 9, ['.ffvvvvvvvvff.ff', 'ffvvVvyvVvvvfff.', 'ff.vvVvvVvv.....']);
    spr('bopca', bp, [b0, b1]);

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

    // ---- goblin archer (hooded, bow) ----
    var ap = { g: C.G1, G: C.G0, e: C.o1, w: C.W, m: C.K, h: C.t0, H: C.G0, c: C.y1, l: C.n0, b: C.n1, s: C.g2 };
    w0 = [
      '....hhhh.....',
      '...hhhhhh..b.',
      '..hhggggh...b',
      '..hggegeg...b',
      '..hggggggg..b',
      '...gwmwmg...b',
      '...hhhhhh..b.',
      '..hhHhhhhgb..',
      '..g.hhhh.....',
      '....llll.....',
      '....g..g.....',
      '...gg..gg....'];
    w1 = legs(w0, ['....llll.....', '...g....g....', '..gg....gg...']);
    at = alt(w0, 1, ['...hhhhhh.b..', '..hhggggh..b.', '..hggegeg..b.', '..hggggggg.bs', '...gwmwmg.sbs', '...hhhhhhssb.', '..hhHhhhgggb.']);
    enemy('goblin_archer', ap, w0, w1, at);

    // ---- goblin brute ----
    var bp = { g: C.G1, G: C.G0, e: C.o1, w: C.W, m: C.K, c: C.n0, C: C.y0, s: C.y1, S: C.g1, l: C.y0 };
    w0 = [
      '......gggg.........',
      '.g...gggggg...g....',
      '.ggggggeggeggg.....',
      '..ggggggggggg......',
      '.....gwwwwg........',
      '....ggggggggg...S..',
      '..ggggGggGgggg.SsS.',
      '.ggggggGGgggggg.s..',
      '.gg.gggggggg.gggs..',
      '.gg.ccccccccc.ggs..',
      '.ww.cccCCcccc..gs..',
      '....ccccccccc......',
      '....ggg...ggg......',
      '....ggg...ggg......',
      '...GGGG...GGGG.....'];
    w1 = legs(w0, ['...ggg.....ggg.....', '...ggg.....ggg.....', '..GGGG.....GGGG....']);
    at = alt(w0, 0, [
      '......gggg.......S.',
      '.g...gggggg.....SsS',
      '.ggggggeggeggg..ss.',
      '..ggggggggggg..ss..',
      '.....gwmmwg...ss...',
      '....gggggggggss....',
      '..ggggGggGggggg....',
      '.ggggggGGgggggg....',
      '.gg.gggggggg.......']);
    enemy('goblin_brute', bp, w0, w1, at);

    // ---- bat ----
    var tp = { p: C.p0, P: C.p1, e: C.o1, w: C.W, m: C.m1 };
    w0 = [
      'p..............p',
      'pp....p..p....pp',
      'pPp...pppp...pPp',
      'pPPp..pepe..pPPp',
      '.pPPppppppppPPp.',
      '..pPpppwwpppPp..',
      '...pp..pp..pp...',
      '......p..p......'];
    w1 = [
      '................',
      '................',
      '......p..p......',
      '......pppp......',
      '....pppepepp....',
      '..ppPPppppPPpp..',
      '.pPPPp.ww.pPPPp.',
      'pPPp..p..p..pPPp',
      'pp............pp'];
    at = alt(w0, 3, ['pPPp..pepe..pPPp', '.pPPppppppppPPp.', '..pPpppwmwppPp..', '...pp..ww...pp..']);
    enemy('bat', tp, w0, w1, at);

    // ---- grub ----
    var up = { y: C.n3, Y: C.y3, b: C.n2, e: C.K, m: C.o0, w: C.W };
    w0 = [
      '....yyy.yyy.....',
      '..yyyyyyyyyyyy..',
      '.yYyyYyyYyyYyyy.',
      'yyYyyYyyYyyYyeyy',
      'yyYyyYyyYyyYyyym',
      '.bbbbbbbbbbbbbb.'];
    w1 = [
      '................',
      '.....yyy.yyy....',
      '..yyyyyyyyyyyyy.',
      '.yYyyYyyYyyYyeyy',
      'yyYyyYyyYyyYyyym',
      'bbbbbbbbbbbbbbb.'];
    at = alt(w0, 2, ['.yYyyYyyYyyYyyyw', 'yyYyyYyyYyyYyeym', 'yyYyyYyyYyyYyywm']);
    enemy('grub', up, w0, w1, at);

    // ---- shaman (skull mask, robe, staff with orb) ----
    var sp = { g: C.G1, r: C.m0, R: C.p0, w: C.W, W: C.g1, e: C.K, o: C.c2, s: C.y1, f: C.o1 };
    w0 = [
      '.f..........o.',
      'ff.wwwww...ooo',
      '.fwwWwWww...o.',
      '..wweweww...s.',
      '..wwwwwww...s.',
      '...wWWWw....s.',
      '...rrrrrr..gs.',
      '..rrRrrRrrrgs.',
      '..g.rrRrr...s.',
      '...rrrRrrr..s.',
      '...rrrrrrr..s.',
      '....g...g...s.',
      '...gg...gg....'];
    w1 = legs(w0, ['...rrrRrrr..s.', '..rrrrrrrrr.s.', '...g.....g..s.', '..gg.....gg...']);
    at = alt(w0, 0, ['.f..........ooo', 'ff.wwwww...ooooo', '.fwwWwWww...ooo', '..wweweww...gs.', '..wwwwwww..gs..', '...wWWWw...s...', '...rrrrrrggs...']);
    enemy('shaman', sp, w0, w1, at);

    // ---- juicer minion (roided goblin in a tank top) ----
    var jp = { g: C.G1, G: C.G0, e: C.K, w: C.W, t: C.W, T: C.g1, b: C.b3, d: C.g3, D: C.g1, x: C.K };
    w0 = [
      '.....gggg.......',
      '..g.gggggg.g....',
      '..ggggegegg.....',
      '....gwxwxg......',
      '..gggggggggg....',
      '.ggggtttttggg...',
      'gggGgtTtttgGgg..',
      'gg..gtttttg.ggd.',
      'gg..gtttttg..dDd',
      'dd..bbbbbbb...d.',
      'DD..bbb.bbb.....',
      '....gg...gg.....',
      '...GGG...GGG....'];
    w1 = legs(w0, ['...gg.....gg....', '..GGG.....GGG...']);
    at = alt(w0, 4, ['..gggggggggg..d.', '.ggggtttttgggdDd', 'gggGgtTtttgGggd.', 'gg..gtttttg.....', 'dd..gtttttg.....']);
    enemy('juicer_minion', jp, w0, w1, at);

    // ---- clown ----
    var cp = { w: C.W, r: C.o1, h: C.G1, H: C.y2, e: C.K, s: C.m1, S: C.y2, d: C.b4, f: C.o1, x: C.K, b: C.b3 };
    w0 = [
      '..hH..Hh....',
      '.hHhwwwhHh..',
      '..hwwwwwwH..',
      '...wewwew...',
      '...wwwrrw...',
      '...wrxxxr...',
      '....wwww....',
      '..ssSsSsss..',
      '.wsdssdssdw.',
      '.w.sssdsss.w',
      '...bdbbdbb..',
      '...bb...bb..',
      '..fff...fff.'];
    w1 = legs(w0, ['...bdbbdbb..', '....bb.bb...', '...fffffff..']);
    at = alt(w0, 4, ['...wwwrrw...', '...wrxwxr...', '....wwww.ww.', '..ssSsSssww.', '.wsdssdss....']);
    enemy('clown', cp, w0, w1, at);

    // ---- clown brute (strongman with a mallet) ----
    var cbp = { w: C.W, r: C.o1, h: C.o1, e: C.K, x: C.K, s: C.o1, S: C.W, k2: C.K, m: C.y1, M: C.y0, l: C.W, b: C.K, n: C.n3 };
    w0 = [
      '.....hhhhhh.......MMM.',
      '....hhwwwwhh.....MMMMM',
      '.....wwewwe.......MMM.',
      '.....wwwwrrw.......m..',
      '.....wwrxxxw.......m..',
      '......wwwww........m..',
      '...nnnsSsSsSsnn....m..',
      '..nnnnSsSsSsSnnnn..m..',
      '..nn.nsSsSsSsn.nnnnm..',
      '..nn.nSsSsSsSn.....m..',
      '..ww.bbbbbbbbb........',
      '.....ssSs.sSss........',
      '.....ssS...Sss........',
      '.....nn.....nn........',
      '....rrrr...rrrr.......'];
    w1 = legs(w0, ['.....ssSs..sSss.......', '....ssS......Sss......', '....nn.......nn.......', '...rrrr.....rrrr......']);
    at = alt(w0, 0, [
      '.....hhhhhh...........',
      '....hhwwwwhh..........',
      '.....wwewwe...........',
      '.....wwwwrrw..........',
      '.....wwrxxxw..........',
      '......wwwww...........',
      '...nnnsSsSsSsnnnnmmmMM',
      '..nnnnSsSsSsSnnn.MMMMM',
      '..nn.nsSsSsSsn...MMMMM',
      '..nn.nSsSsSsSn....MMM.']);
    enemy('clown_brute', cbp, w0, w1, at);

    // ---- skyfowl ----
    var fp = { r: C.o1, R: C.o0, y: C.y2, w: C.W, e: C.K, b: C.n1, Y: C.y3 };
    w0 = [
      'rr..............',
      'rRr.......rrr...',
      'rRRr.....rrwer..',
      '.rRRr...rrrrryyy',
      '..rRRrrrrrrr.yy.',
      '...rRRrrrrRr....',
      '....rrrrrrr.....',
      '..RRRrrr.y.y....',
      '.......y..y.....'];
    w1 = [
      '................',
      '..........rrr...',
      '.........rrwer..',
      '........rrrrryyy',
      '..rrrrrrrrrr.yy.',
      '.rRRRRrrrrRr....',
      'rRRRRrrrrrr.....',
      'rRRr.rrr.y.y....',
      'rr.....y..y.....'];
    at = [
      '................',
      '........rrr.....',
      '.......rrrwer...',
      '..r...rrrrrryyy.',
      '.rRr.rrrrrrr.yy.',
      'rRRRrrrrrRr.....',
      'rRRRrrrrrr......',
      '.RR..rrr..yY....',
      '.........Y..Y...'];
    enemy('skyfowl', fp, w0, w1, at);

    // ---- swamp troll ----
    var trp = { g: C.l0, G: C.G0, m: C.l1, e: C.y2, w: C.W, x: C.K, b: C.y0, B: C.n0 };
    w0 = [
      '.......gggg.........',
      '.....mggggggm.......',
      '....gggegggeg.......',
      '....ggggggggggg.....',
      '.....gwxxxxwgg......',
      '...mmggggggggmm.....',
      '..gggmGgggGgmggg....',
      '.ggggggGGGGgggggg...',
      '.gg.gggggggggg.ggg..',
      'gg..gggggggggg..gg..',
      'gg..bbbbbbbbbb..gg..',
      'GG..bBbbBbbBbb..GG..',
      '....ggg....ggg......',
      '....ggg....ggg......',
      '...GGGG....GGGG.....'];
    w1 = legs(w0, ['...ggg......ggg.....', '..ggg........ggg....', '..GGGG.......GGGG...']);
    at = alt(w0, 5, [
      '...mmggggggggmm..gg.',
      '..gggmGgggGgmggggGG.',
      '.ggggggGGGGggggg....',
      '.gg.gggggggggg......',
      'gg..gggggggggg......']);
    enemy('swamp_troll', trp, w0, w1, at);

    // ---- gator ----
    var gtp = { g: C.l0, G: C.l1, y: C.l3, e: C.y2, w: C.W, x: C.K };
    w0 = [
      '..............ggg.......',
      '...G.G.G.G...gggegggg...',
      'g.ggggggggggggggggggggg.',
      'gggggggggggggggggwgwgwgg',
      '.ggyyyyyyyyyyyyyyyyyyyy.',
      '...gg...gg....gg..gg....',
      '..gg...gg....gg..gg.....'];
    w1 = legs(w0, ['....gg..gg...gg...gg....', '....gg...gg...gg...gg...']);
    at = [
      '..............ggggggg...',
      '...G.G.G.G...gggegggwgwg',
      'g.ggggggggggggggggg.....',
      'gggggggggggggggggg......',
      '.ggyyyyyyyyyyyyyyyywwwww',
      '...gg...gg....gg.yyyyyyy',
      '..gg...gg....gg.........'];
    enemy('gator', gtp, w0, w1, at);

    // ---- steam goblin (goggles, steam tank) ----
    var stp = { g: C.G1, G: C.G0, o: C.y2, O: C.K, w: C.W, x: C.K, c: C.n0, C: C.y0, t: C.g1, T: C.g0, s: C.g2, b: C.y1 };
    w0 = [
      '.s..........',
      's.s.gggg....',
      '.tTgggggg..g',
      '.tToOgoOggg.',
      '.tTgggggggg.',
      '.tT.gwxwg...',
      '.tTccccccc..',
      '.tgcCccccCg.',
      '..g.ccccc.g.',
      '....bbbbb...',
      '....g...g...',
      '...GG...GG..'];
    w1 = legs(w0, ['....bbbbb...', '...g.....g..', '..GG.....GG.']);
    at = alt(w0, 0, ['s.s..........', '.s.sgggg.....', '.tTgggggg..g.', '.tToOgoOggg..', '.tTgggggggg..', '.tT.gwxwg....', '.tTccccccc.ss', '.tgcCccccCgsss', '..g.ccccc..ss.']);
    enemy('steam_goblin', stp, w0, w1, at);

    // ---- conductor (cap, coat, lantern) ----
    var cdp = { g: C.G1, G: C.G0, c: C.b1, C: C.b3, y: C.y2, e: C.K, w: C.W, x: C.K, l: C.y2, L: C.o1, b: C.K, s: C.g1 };
    w0 = [
      '...ccccc....',
      '..cccyccc...',
      '.cccccccccc.',
      '...gggggg...',
      'g.ggeggegg.g',
      '.gggggggggg.',
      '...gwxxwg...',
      '..CCCCCCCC..',
      '.gCCyCCyCCs.',
      '.g.CCCCCC.s.',
      '...CCyCCC.L.',
      '...cc..cc.l.',
      '..bbb..bbb..'];
    w1 = legs(w0, ['...CCyCCC.L.', '..cc....cc..', '.bbb....bbb.']);
    at = alt(w0, 6, ['...gwxxwg..L', '..CCCCCCCCsl', '.gCCyCCyCCs.', '.g.CCCCCC...']);
    enemy('conductor', cdp, w0, w1, at);

    // ---- rail rat (bigger rat in a hard hat with a rail spike) ----
    var rrp = { g: C.y0, G: C.y1, e: C.o1, p: C.m3, t: C.m2, w: C.W, h: C.y2, H: C.y1, s: C.g1 };
    w0 = [
      '..........hhh...',
      '.........hhhhh..',
      '........HHHHHHH.',
      '...gggggggggegg.',
      '.gggggggggggggggp',
      't.ggGGGGGgggww..',
      '.t.gGGGGGgg.....',
      '..ggg.ggg.gg....',
      '..pp..pp..pp....'];
    w1 = legs(w0, ['...gg.gg..ggg...', '...pp.pp..pp....']);
    at = alt(w0, 3, ['...gggggggggegg.', '.gggggggggggggggps', 't.ggGGGGGgggwwsss', '.t.gGGGGGgg...s..']);
    enemy('rail_rat', rrp, w0, w1, at);

    // ---- fishman (spear) ----
    var fmp = { b: C.c1, B: C.c2, f: C.b2, e: C.y2, E: C.K, w: C.W, x: C.K, s: C.g1, y: C.y1 };
    w0 = [
      '...ff........s',
      '..fbbbb.....s.',
      '.fbbbbbb...s..',
      '.bbbbbwEb..y..',
      '.bbbbbbbbb.y..',
      '.fbbbbxwxw.y..',
      '..fbbbbbb..y..',
      '...bBBBBb.by..',
      '..bbBBBBbbby..',
      '..b.BBBBb..y..',
      '....bBBBb..y..',
      '....bb.bb..y..',
      '...fff.fff....'];
    w1 = legs(w0, ['....bBBBb..y..', '...bb...bb.y..', '..fff...fff...']);
    at = alt(w0, 0, ['...ff..........', '..fbbbb........', '.fbbbbbb.......', '.bbbbbwEb......', '.bbbbbbbbb.....', '.fbbbbxwxw.....', '..fbbbbbb......', '...bBBBBbbyyyyss', '..bbBBBBbb.....', '..b.BBBBb......']);
    enemy('fishman', fmp, w0, w1, at);

    // ---- jelly (floating jellyfish) ----
    var jlp = { p: C.m2, P: C.m3, w: C.W, e: C.m0, t: C.r2, T: C.m3 };
    w0 = [
      '....pppppp....',
      '..ppPPppppp...',
      '.pPPwpppppppp.',
      '.pPpppepppepp.',
      'pppppppppppppp',
      'p.pp.ppp.pp.pp',
      '..t..t.T..t...',
      '.t..t..T.t....',
      '..t..t.T..t...',
      '.t...t..T..t..',
      '..t.....T.....'];
    w1 = alt(w0, 0, ['..............', '....pppppp....', '..ppPPppppp...', '.pPPwpppppppp.', 'ppPpppepppeppp', 'pppppppppppppp', '.t.t..t.T.t.t.', 't...t.t.T..t..', '.t..t...T.t...', '..t.t...T..t..', '....t....T....']);
    at = alt(w0, 0, ['..T.pppppp.T..', 'T.ppPPppppp..T', '.pPPwpppppppp.', '.pPppeeppeepp.', 'pppppppppppppp', 'p.pp.ppp.pp.pp', 'Tt..t.T.T.tT..', '.tT.tT..TT..T.', 'T.t..t.T..t..T']);
    enemy('jelly', jlp, w0, w1, at);

    // ---- crab ----
    var crp = { r: C.o1, R: C.o0, w: C.W, e: C.K, y: C.n2 };
    w0 = [
      '.rr..........rr.',
      'rr.r..w..w..r.rr',
      'rrrr..e..e..rrrr',
      '.rr..rrrrrr..rr.',
      '..r.rrRrrRrr.r..',
      '...rrrrrrrrrrr..',
      '..rRrrrrrrrrRr..',
      '.r.r.r....r.r.r.',
      'r..r..r..r..r..r'];
    w1 = legs(w0, ['..r.r.r..r.r.r..', '.r..r.r..r.r..r.']);
    at = alt(w0, 0, ['rr............rr', 'r.r...w..w...r.r', 'rr.r..e..e..r.rr', '.rrr.rrrrrr.rrr.']);
    enemy('crab', crp, w0, w1, at);

    // ---- hunter (hooded, crossbow) ----
    var hp = { h: C.t0, H: C.G0, s: C.n3, e: C.K, c: C.y0, C: C.n0, b: C.y1, l: C.y0, w: C.g1, x: C.K };
    w0 = [
      '....hhhh.....',
      '...hhhhhh....',
      '..hhhssss....',
      '..hhsssess...',
      '..hhhssss....',
      '..Hhhhhhh....',
      '.hhhcccchh...',
      '.hhcCcccbbbbw',
      '.hhcCccsb....',
      '..hccccc.....',
      '..hhlllhh....',
      '...l...l.....',
      '..cc...cc....'];
    w1 = legs(w0, ['..hhlllhh....', '..l.....l....', '.cc.....cc...']);
    at = alt(w0, 6, ['.hhhcccchh.b..', '.hhcCcccbbbbbw', '.hhcCccsb..b..']);
    enemy('hunter', hp, w0, w1, at);

    // ---- hound ----
    var hdp = { b: C.n0, B: C.n1, y: C.y1, e: C.y2, w: C.W, x: C.K, c: C.o1 };
    w0 = [
      '............bb..',
      '..........bbbBb.',
      'b........bbbebbbx',
      '.b.......bbbbbbbb',
      '..bbbbbbbbbbbww..',
      '..bBBbbbbbbcc....',
      '..bbbbbbbbbb.....',
      '..bb.b....b.bb...',
      '.bb..b....b..bb..'];
    w1 = legs(w0, ['...bb.b..b.bb....', '...b..b..b..b....']);
    at = [
      '.................',
      '.............bb..',
      'b..........bbbBb.',
      '.b........bbbebbbx',
      '..bbbbbbbbbbbbbbbb',
      '..bBBbbbbbbbbwwww.',
      '..bbbbbbbbbbbbbb..',
      '.bb.......bbb.....',
      'bb..........bb....'];
    enemy('hound', hdp, w0, w1, at);

    // ---- masked noble (masquerade mask, fancy coat, rapier) ----
    var np = { s: C.n3, m: C.y2, M: C.m1, e: C.K, h: C.y3, c: C.p0, C: C.p1, w: C.W, g: C.y2, l: C.K, r: C.g1 };
    w0 = [
      '...hhhhh.....',
      '..hhhhhhh....',
      '..hhsssss....',
      '..hMmmemm....',
      '..hhMssss....',
      '...hsssw.....',
      '..wwwwww.....',
      '.cCcwwcCc....',
      '.cCcgcccc.r..',
      '.cCccgccss...',
      '.ccCcccc.r...',
      '.cCcccccc....',
      '...ll..ll....',
      '...ll..ll....',
      '..lll..lll...'];
    w1 = legs(w0, ['...ll...ll...', '..ll.....ll..', '.lll.....lll.']);
    at = alt(w0, 7, ['.cCcwwcCc....', '.cCcgccccss..', '.cCccgcc..rrrrr', '.ccCcccc......']);
    enemy('masked_noble', np, w0, w1, at);

    // ---- ghoul ----
    var ghp = { g: C.t3, G: C.G2, d: C.t1, e: C.o1, x: C.K, w: C.W, r: C.g3, R: C.g0 };
    w0 = [
      '.....gggg....',
      '....gggggg...',
      '....ggeggeg..',
      '....gggggggg.',
      '.....gxwxwg..',
      '...rrrgggrr..',
      '..rrRrrrrrrgg',
      '..rRrrrrrr.gw',
      '..grrRrrrr...',
      '.gw.rrrRrr...',
      '....rRrrrr...',
      '....gg..gg...',
      '...gg...gg...'];
    w1 = legs(w0, ['....rRrrrr...', '...gg....gg..', '..gg......gg.']);
    at = alt(w0, 4, ['.....gxxxxg..', '...rrrggggggw', '..rrRrrrrgggw', '..rRrrrrrr.gw']);
    enemy('ghoul', ghp, w0, w1, at);

    // ---- gargoyle (stone, flying) ----
    var gap = { s: C.g0, S: C.g3, d: C.g1, e: C.o1, w: C.W, x: C.K };
    w0 = [
      'S..............S',
      'SS....s..s....SS',
      'SdS...ssss...SdS',
      'SddS.ssesess.ddS',
      '.SddSssssssSddS.',
      '..SdSsxwwxsSdS..',
      '...SSssssssSS...',
      '.....sSsSss.....',
      '.....s.ss.s.....',
      '....ss....ss....'];
    w1 = [
      '................',
      '......s..s......',
      '......ssss......',
      '.....ssesess....',
      '..SSSssssssSSS..',
      '.SddSsxwwxsSddS.',
      'SddSSssssssSSddS',
      'SdS..sSsSss..SdS',
      'SS...s.ss.s...SS',
      'S...ss....ss...S'];
    at = alt(w0, 3, ['SddS.ssesess.ddS', '.SddSssssssSddS.', '..SdSsxxxxsSdS..', '...SSswwwwsSS...', '.....sSsSss.....', '....ss.ss.ss....', '...ss......ss...']);
    enemy('gargoyle', gap, w0, w1, at);

    // ---- skeleton ----
    var skp = { w: C.W, W: C.g1, e: C.K, x: C.K, s: C.g1, S: C.g0, h: C.n0 };
    w0 = [
      '...wwwww.....',
      '..wwwwwww....',
      '..wweweww....',
      '..wwwwwww....',
      '...wxwxw..S..',
      '....www...S..',
      '..wwwwwww.S..',
      '.w.WwWwW.wh..',
      '.w.wwwww..h..',
      '....WwW......',
      '...ww.ww.....',
      '...w...w.....',
      '..ww...ww....'];
    w1 = legs(w0, ['...ww.ww.....', '..w.....w....', '.ww.....ww...']);
    at = alt(w0, 4, ['...wxwxw.....', '....www......', '..wwwwwwwhSSSSS', '.w.WwWwW......', '.w.wwwww......']);
    enemy('skeleton', skp, w0, w1, at);

    // ---- mutant ----
    var mup = { p: C.r2, P: C.r1, g: C.l2, G: C.l1, e: C.K, w: C.W, x: C.K, b: C.y0 };
    w0 = [
      '.....ppp.......',
      '...ppppppg.....',
      '..ppweppwepp...',
      '..ppppppppppp..',
      '..pgpxwxwxpp...',
      '...pppppppp....',
      '.gpppPppPppgg..',
      'ggpgppppppppgg.',
      'gg.pppgpppp.pg.',
      'pp..bbbbbbb..pp',
      '....pp...pp....',
      '...ppp...gpp...'];
    w1 = legs(w0, ['...pp.....pp...', '..ppp.....gpp..']);
    at = alt(w0, 2, ['..ppweppwepp...', '..ppppppppppp..', '..pgpxwxwxppggg', '...ppppppppgggg', '.gpppPppPpp.gg.']);
    enemy('mutant', mup, w0, w1, at);

    // ---- drone ----
    var drp = { m: C.g1, M: C.g0, r: C.o1, R: C.y2, b: C.g3, w: C.W, p: C.g2 };
    w0 = [
      'ppppp....ppppp',
      '..b........b..',
      '..b.mmmmmm.b..',
      '.mmmmmmmmmmmm.',
      '.mMMmrrrmmMMm.',
      '.mMMmrRrmmMMm.',
      '..mmmmmmmmmm..',
      '....M....M....',
      '...MM....MM...'];
    w1 = alt(w0, 0, ['..ppp....ppp..']);
    w1 = alt(w1, 4, ['.mMMmmrrrmMMm.', '.mMMmmrRrmMMm.']);
    at = alt(w0, 4, ['.mMMmrrrmmMMm.', '.mMMmrwrmmMMm.', '..mmmmmmmmmm..', '....M.RR.M....', '...MM.RR.MM...']);
    enemy('drone', drp, w0, w1, at);

    // ---- golem (rubble) ----
    var gop = { s: C.y1, S: C.y0, d: C.n2, e: C.c3, x: C.K, m: C.l1 };
    w0 = [
      '.......ssss.........',
      '......ssssss........',
      '......sesses........',
      '......ssxxss........',
      '...SSssssssssSS.....',
      '..SssmssSssssssS....',
      '.SSsdssSssdsssSSS...',
      '.SssssssSsssss.SsS..',
      '.Ss.ssdsssmsss..SsS.',
      'SSS.ssssSssss...SSS.',
      'Sss..ssssssss...sss.',
      '.....sss..sss.......',
      '....ssss..ssss......',
      '....SSSS..SSSS......'];
    w1 = legs(w0, ['....sss....sss......', '...ssss....ssss.....', '...SSSS....SSSS.....']);
    at = alt(w0, 4, [
      '...SSssssssssSS.SSS.',
      '..SssmssSssssssSsss.',
      '.SSsdssSssdsssSSsSS.',
      '.SssssssSsssss......',
      '.Ss.ssdsssmsss......',
      'SSS.ssssSssss.......']);
    enemy('golem', gop, w0, w1, at);

    // ---- soldier (helmet, armour vest, blaster) ----
    var sop = { h: C.l0, H: C.G0, s: C.n3, e: C.K, v: C.G0, V: C.t0, g: C.g0, G: C.g3, b: C.y0, r: C.o1, l: C.l0 };
    w0 = [
      '...hhhhh.....',
      '..hhhhhhh....',
      '..HHHHHHHH...',
      '...sssess....',
      '...sssssss...',
      '....ssss.....',
      '..vvVvvvv....',
      '.vvvVvvsgggGr',
      '.s.vVvvvg....',
      '...vvvvvv....',
      '...ll..ll....',
      '...ll..ll....',
      '..bbb..bbb...'];
    w1 = legs(w0, ['...ll...ll...', '..ll.....ll..', '.bbb.....bbb.']);
    at = alt(w0, 6, ['..vvVvvvv..r.', '.vvvVvvsgggGrr', '.s.vVvvvg..r.']);
    enemy('soldier', sop, w0, w1, at);

    // ---- sniper (camo hood, long rifle, crouched) ----
    var snp = { c: C.y0, C: C.l0, s: C.n3, e: C.K, g: C.g3, G: C.g0, r: C.o1, b: C.y0, w: C.b6 };
    w0 = [
      '...cCcc..........',
      '..cCccCc.........',
      '..cccwwc.........',
      '..Ccsssss........',
      '...cssss.........',
      '..cCccCcsgggggGG.',
      '.cCcCccGg........',
      '.ccCccCc.........',
      '..cC.cCcc........',
      '..cc...cc........',
      '.bbb...bbb.......'];
    w1 = alt(w0, 2, ['..cccwrc.........']);
    at = alt(w0, 5, ['..cCccCcsgggggGGr', '.cCcCccGg......rr', '.ccCccCc.........']);
    enemy('sniper', snp, w0, w1, at);

    // ---- war beast (armoured rhino-thing) ----
    var wbp = { b: C.p0, B: C.p1, a: C.g1, A: C.g0, h: C.W, e: C.o1, x: C.K, y: C.y2 };
    w0 = [
      '.........aaaaaa.........',
      '......aaaAaaAaaaa...h...',
      '....aaAaaaaaaAaaaaa.hh..',
      '..bbbbbbbbbbbbbbbbbbbhh.',
      '.bbBbbBbbBbbBbbbbbbebbb.',
      'bbbBbbBbbBbbBbbbbbbbbbbb',
      'bb.bbbbbbbbbbbbbbbbbxxb.',
      '...bbbbbbbbbbbbbbbbbbb..',
      '...bbb..bbb...bbb..bbb..',
      '...bbb..bbb...bbb..bbb..',
      '..AAAA.AAAA..AAAA.AAAA..'];
    w1 = legs(w0, ['....bbb..bbb.bbb..bbb...', '...bbb....bbb.bbb..bbb..', '..AAAA...AAAA.AAAA.AAAA.']);
    at = alt(w0, 0, ['........................', '.........aaaaaa......h..', '......aaaAaaAaaaa....hh.', '....aaAaaaaaaAaaaaa...hhh', '..bbbbbbbbbbbbbbbbbbbbbh', '.bbBbbBbbBbbBbbbbbbebbb.']);
    enemy('war_beast', wbp, w0, w1, at);

    // ---- cultist ----
    var cup = { r: C.m0, R: C.p0, s: C.n3, e: C.o1, x: C.K, g: C.l2, G: C.G2, y: C.y2 };
    w0 = [
      '....rrrr....',
      '...rrrrrr...',
      '..rrRxxxrr..',
      '..rRxexexr..',
      '..rRxxxxxr..',
      '..rrRxxxrr..',
      '..rrrryrrr..',
      '.rrRrrrrRrr.',
      '.gRrrRrrrRg.',
      '..rrRrrRrrr.',
      '..rrrRrrrRr.',
      '.rrrrrrrrrrr',
      '..RR....RR..'];
    w1 = legs(w0, ['.rrrrrrrrrrr', '...RR..RR...']);
    at = alt(w0, 6, ['..rrrryrrr.G', '.rrRrrrrRrrgG', '.rRrrRrrrrgGg', '..rrRrrRrrrG.']);
    enemy('cultist', cup, w0, w1, at);
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

  // ---- THE HOARDER: giant cockroach queen with junk piled on her back ----
  boss('hoarder', { b: C.n0, B: C.y0, h: C.n1, d: C.y0, e: C.o1, E: C.y2, m: C.y1, a: C.y1, y: C.y2, l: C.y0, g: C.g1, G: C.g0, c: C.c2, o: C.y1, O: C.n2, v: C.G1, r: C.r1, t: C.g3, w: C.W, s: C.l2, K: C.K }, 62, 42, function (g, p) {
    var b = p.a === 'idle' ? p.i : 0, hurt = p.a === 'hurt';
    var hx = p.a === 'attack' ? 4 : hurt ? -2 : 0, hy = p.a === 'special' ? -4 : 0;
    // legs (behind body)
    var st = p.a === 'walk' ? (p.i ? 2 : -2) : 0;
    [[12, 1], [22, -1], [32, 1], [42, -1]].forEach(function (L, k) {
      var s = st * L[1];
      line(g, L[0], 30, L[0] - 4 + s, 34, 'l', 2); line(g, L[0] - 4 + s, 34, L[0] - 6 + s, 39, 'l', 2); px(g, L[0] - 7 + s, 40, 'l');
    });
    // abdomen
    oval(g, 24, 25 + b, 19, 10, 'b');
    oval(g, 22, 22 + b, 15, 6, 'h');
    oval(g, 22, 23 + b, 15, 5, 'b');
    for (var k = 0; k < 5; k++) line(g, 8 + k * 7, 28 + b, 12 + k * 7, 34 + b, 'B');
    // thorax + head
    oval(g, 44, 26 + b, 7, 7, 'b'); oval(g, 44, 24 + b, 5, 3, 'h');
    var X = 52 + hx, Y = 27 + b + hy;
    oval(g, X, Y, 6, 5, 'd');
    eyes2(g, X, Y - 3, 'e', 'E'); eyes2(g, X + 3, Y - 2, 'e', 'E');
    if (p.a === 'attack' || p.a === 'special') { line(g, X + 5, Y + 1, X + 9, Y - 2, 'm', 2); line(g, X + 5, Y + 3, X + 9, Y + 6, 'm', 2); rect(g, X + 5, Y + 1, 3, 3, 'r'); }
    else { line(g, X + 5, Y + 2, X + 8, Y + 1, 'm', 2); line(g, X + 5, Y + 4, X + 8, Y + 5, 'm', 2); }
    // antennae
    var ay = p.a === 'special' ? -6 : 0;
    line(g, X + 1, Y - 5, X + 7, Y - 18 + ay, 'a'); line(g, X - 1, Y - 5, X + 2, Y - 16 + ay, 'a');
    // tiny crown
    rect(g, X - 3, Y - 7, 6, 2, 'y'); px(g, X - 3, Y - 8, 'y'); px(g, X, Y - 8, 'y'); px(g, X + 2, Y - 8, 'y'); px(g, X - 1, Y - 7, 'r');
    // junk pile
    var jy = b;
    rect(g, 7, 10 + jy, 11, 9, 'g'); rect(g, 8, 11 + jy, 7, 6, 'c'); rect(g, 16, 12 + jy, 1, 4, 'G'); px(g, 9, 12 + jy, 'w'); line(g, 10, 10 + jy, 8, 6 + jy, 'G'); line(g, 13, 10 + jy, 15, 6 + jy, 'G');
    oval(g, 25, 12 + jy, 6, 3, 't'); oval(g, 25, 12 + jy, 3, 1, 'b'); oval(g, 25, 9 + jy, 6, 3, 't'); oval(g, 25, 9 + jy, 3, 1, 'b');
    rect(g, 31, 7 + jy, 9, 9, 'o'); rect(g, 31, 7 + jy, 9, 1, 'O'); line(g, 35, 7 + jy, 35, 15 + jy, 'O');
    rect(g, 19, 3 + jy, 3, 8, 'v'); rect(g, 20, 1 + jy, 1, 2, 'v'); px(g, 20, 5 + jy, 'w');
    rect(g, 28, 3 + jy, 4, 3, 'r'); px(g, 29, 2 + jy, 'r'); // old shoe
    line(g, 37, 6 + jy, 41, 0 + jy, 'G'); oval(g, 42, 1 + jy, 2, 1, 's'); // lamp
    if (p.a === 'special') { oval(g, 18, 36, 3, 2, 's'); oval(g, 27, 37, 3, 2, 's'); oval(g, 36, 36, 3, 2, 's'); }
  });

  // ---- THE JUICER: roided goblin bodybuilder in a tank top ----
  boss('juicer', { g: C.G1, G: C.G0, v: C.t0, w: C.W, W: C.g1, r: C.o1, R: C.o0, e: C.y2, K: C.K, y: C.y2, h: C.K, s: C.r1, S: C.m1, t: C.W, f: C.y1 }, 58, 54, function (g, p) {
    var b = p.a === 'idle' ? p.i : 0, cx = 26;
    var flex = p.a === 'special', punch = p.a === 'attack', hurt = p.a === 'hurt';
    var st = p.a === 'walk' ? (p.i ? 2 : -2) : 0;
    // legs
    rect(g, cx - 10 + st, 40, 8, 11, 'g'); rect(g, cx + 3 - st, 40, 8, 11, 'g');
    rect(g, cx - 11 + st, 50, 10, 3, 't'); rect(g, cx + 2 - st, 50, 10, 3, 't');
    rect(g, cx - 12, 34 + b, 25, 9, 's'); rect(g, cx - 12, 34 + b, 25, 1, 'S'); line(g, cx, 36 + b, cx, 42 + b, 'S');
    // torso V
    tri(g, cx - 18, 14 + b, cx + 19, 14 + b, cx, 38 + b, 'g');
    rect(g, cx - 10, 22 + b, 21, 14, 'g');
    // tank top
    tri(g, cx - 10, 16 + b, cx + 11, 16 + b, cx, 40 + b, 'w'); rect(g, cx - 9, 24 + b, 19, 11, 'w');
    rect(g, cx - 4, 16 + b, 9, 4, 'g'); // neckline
    line(g, cx - 9, 24 + b, cx - 9, 35 + b, 'W'); line(g, cx + 9, 24 + b, cx + 9, 35 + b, 'W');
    rect(g, cx - 3, 26 + b, 7, 3, 'r'); // logo
    // traps + head (small)
    oval(g, cx, 14 + b, 10, 4, 'g');
    var hy = 8 + b;
    oval(g, cx + 1, hy, 5, 6, flex ? 'R' : 'g');
    rect(g, cx - 4, hy - 6, 10, 3, 'h'); rect(g, cx - 4, hy - 3, 11, 1, 'r');
    rect(g, cx + 1, hy - 1, 2, 1, 'e'); rect(g, cx + 4, hy - 1, 2, 1, 'e'); px(g, cx + 2, hy - 1, 'K'); px(g, cx + 5, hy - 1, 'K');
    rect(g, cx + 1, hy + 2, 5, 2, 'w'); line(g, cx + 1, hy + 3, cx + 5, hy + 3, 'K');
    line(g, cx - 4, 14 + b, cx + 5, 17 + b, 'y'); line(g, cx + 5, 17 + b, cx + 9, 14 + b, 'y');
    // arms
    function arm(side, mode) {
      var sx = side < 0 ? cx - 17 : cx + 17;
      if (mode === 'down') { oval(g, sx, 22 + b, 6, 7, 'g'); oval(g, sx + side, 32 + b, 4, 6, 'g'); oval(g, sx + side, 38 + b, 4, 3, 'g'); line(g, sx - 2, 18 + b, sx + 1, 26 + b, 'v'); }
      else if (mode === 'flex') { oval(g, sx + side * 3, 16 + b, 6, 5, 'g'); oval(g, sx + side * 2, 7 + b, 4, 5, 'g'); oval(g, sx + side * 1, 2 + b, 3, 2, 'g'); oval(g, sx + side * 3, 14 + b, 3, 2, 'G'); line(g, sx + side * 2, 4 + b, sx + side * 3, 10 + b, 'v'); }
      else if (mode === 'punch') { oval(g, sx + 2, 20 + b, 6, 6, 'g'); rect(g, sx + 4, 17 + b, 16, 7, 'g'); oval(g, sx + 22, 20 + b, 5, 5, 'g'); line(g, sx + 6, 18 + b, sx + 16, 18 + b, 'v'); }
    }
    arm(-1, flex ? 'flex' : 'down');
    arm(1, flex ? 'flex' : punch ? 'punch' : 'down');
    if (hurt) { rect(g, cx + 1, hy - 1, 5, 1, 'K'); }
  });

  // ---- THE RINGMASTER: tall, top hat, whip ----
  boss('ringmaster', { h: C.m0, H: C.y2, f: C.o3, F: C.n2, e: C.y2, K: C.K, m: C.y0, c: C.o0, C: C.r0, y: C.y2, p: C.W, P: C.g1, b: C.y0, w: C.n0, W: C.W, g: C.W, r: C.o1 }, 52, 62, function (g, p) {
    var b = p.a === 'idle' ? p.i : 0, cx = 22, st = p.a === 'walk' ? (p.i ? 2 : -2) : 0;
    var atk = p.a === 'attack', sp = p.a === 'special';
    // legs
    rect(g, cx - 5 + st, 40, 4, 18, 'p'); rect(g, cx + 2 - st, 40, 4, 18, 'p');
    line(g, cx - 3 + st, 41, cx - 3 + st, 56, 'P');
    rect(g, cx - 6 + st, 55, 6, 5, 'b'); rect(g, cx + 1 - st, 55, 7, 5, 'b');
    // coat with tails
    rect(g, cx - 7, 22 + b, 15, 20, 'c');
    tri(g, cx - 7, 34 + b, cx - 1, 34 + b, cx - 10, 50, 'c');
    tri(g, cx + 1, 34 + b, cx + 7, 34 + b, cx + 9, 48, 'C');
    rect(g, cx - 2, 22 + b, 5, 12, 'g'); // shirt front
    px(g, cx, 24 + b, 'r'); px(g, cx - 1, 23 + b, 'r'); px(g, cx + 1, 23 + b, 'r'); // bow tie
    line(g, cx - 3, 22 + b, cx - 5, 32 + b, 'y'); line(g, cx + 3, 22 + b, cx + 5, 32 + b, 'y');
    for (var k = 0; k < 3; k++) { px(g, cx - 4, 34 + b + k * 2, 'y'); px(g, cx + 4, 34 + b + k * 2, 'y'); }
    rect(g, cx - 7, 37 + b, 15, 1, 'C');
    // head: long pale face
    var hy = 12 + b;
    rect(g, cx - 4, hy, 9, 10, 'f'); rect(g, cx - 3, hy + 10, 7, 2, 'f');
    line(g, cx - 4, hy + 5, cx - 4, hy + 9, 'F');
    rect(g, cx, hy + 3, 2, 1, sp ? 'r' : 'e'); rect(g, cx + 3, hy + 3, 2, 1, sp ? 'r' : 'e'); px(g, cx + 1, hy + 3, 'K'); px(g, cx + 4, hy + 3, 'K');
    line(g, cx - 1, hy + 2, cx + 2, hy + 1, 'K'); line(g, cx + 3, hy + 1, cx + 5, hy + 2, 'K');
    px(g, cx + 5, hy + 5, 'F');
    // curled mustache + grin
    rect(g, cx, hy + 7, 6, 1, 'm'); px(g, cx - 1, hy + 6, 'm'); px(g, cx + 6, hy + 6, 'm'); px(g, cx - 2, hy + 5, 'm'); px(g, cx + 7, hy + 5, 'm');
    rect(g, cx + 1, hy + 9, 4, 1, 'K'); px(g, cx + 5, hy + 8, 'K');
    // top hat
    var ty = hy - 11 + (sp ? -2 : 0);
    rect(g, cx - 4, ty, 10, 10, 'h'); rect(g, cx - 4, ty + 7, 10, 2, 'H'); rect(g, cx - 7, ty + 10, 16, 2, 'h');
    rect(g, cx - 3, ty + 1, 1, 5, 'C');
    // arms
    if (atk) {
      rect(g, cx + 6, 24 + b, 10, 4, 'c'); rect(g, cx + 16, 24 + b, 3, 3, 'W');
      line(g, cx + 18, 25 + b, 51, 30 + b, 'w', 1); line(g, cx + 18, 26 + b, 50, 31 + b, 'w', 1); px(g, 51, 31 + b, 'r');
      rect(g, cx - 10, 24 + b, 4, 12, 'c'); rect(g, cx - 10, 36 + b, 3, 3, 'W');
    } else if (sp) {
      line(g, cx - 7, 24 + b, cx - 13, 12 + b, 'c', 3); rect(g, cx - 15, 9 + b, 3, 3, 'W');
      line(g, cx + 7, 24 + b, cx + 13, 12 + b, 'c', 3); rect(g, cx + 12, 9 + b, 3, 3, 'W');
      for (k = 0; k < 6; k++) px(g, cx - 14 + k * 6, 4 + (k % 2) * 3, 'y');
    } else {
      rect(g, cx - 10, 24 + b, 4, 12, 'c'); rect(g, cx - 10, 36 + b, 3, 3, 'W');
      rect(g, cx + 7, 24 + b, 4, 12, 'c'); rect(g, cx + 7, 36 + b, 3, 3, 'W');
      // coiled whip
      line(g, cx + 9, 38 + b, cx + 13, 44, 'w'); oval(g, cx + 14, 50, 4, 5, 'w'); oval(g, cx + 14, 50, 2, 3, null || '.');
      line(g, cx + 16, 54, cx + 20, 58, 'w');
    }
  });

  // ---- THE ENGINEER: goblin in a steam locomotive mech ----
  boss('engineer', { t: C.t0, T: C.G1, y: C.y2, Y: C.y1, r: C.o1, R: C.o0, g: C.G1, G: C.G0, o: C.y2, O: C.K, s: C.g1, S: C.g0, w: C.W, W: C.g2, l: C.y3, K: C.K }, 64, 52, function (g, p) {
    var b = p.a === 'idle' ? p.i : 0, sp = p.a === 'special', atk = p.a === 'attack';
    // cab (back) with goblin
    rect(g, 6, 12 + b, 18, 24, 't'); rect(g, 4, 10 + b, 22, 3, 'R');
    rect(g, 9, 15 + b, 12, 9, 'S');
    oval(g, 15, 19 + b, 5, 4, 'g'); px(g, 9, 17 + b, 'g'); px(g, 21, 17 + b, 'g');
    rect(g, 12, 17 + b, 3, 2, 'o'); rect(g, 16, 17 + b, 3, 2, 'o'); px(g, 13, 18 + b, 'O'); px(g, 17, 18 + b, 'O'); rect(g, 15, 17 + b, 1, 1, 'S');
    rect(g, 13, 21 + b, 5, 1, 'O'); px(g, 14, 22 + b, 'w');
    rect(g, 10, 13 + b, 10, 2, 'S'); // cap
    // boiler
    rect(g, 22, 20 + b, 30, 16, 't'); rect(g, 22, 21 + b, 30, 3, 'T');
    for (var k = 0; k < 3; k++) rect(g, 28 + k * 8, 20 + b, 2, 16, 'y');
    rect(g, 52, 18 + b, 4, 20, 'S'); oval(g, 56, 26 + b, 2, 3, 'l'); // front plate + headlight
    // smokestack
    rect(g, 43, 8 + b, 6, 12, 'S'); rect(g, 41, 5 + b, 10, 4, 'S'); rect(g, 42, 5 + b, 8, 1, 'R');
    rect(g, 33, 14 + b, 5, 6, 'y'); oval(g, 35, 13 + b, 3, 2, 'y'); // dome
    // chassis + cowcatcher
    rect(g, 4, 36, 54, 4, 'R');
    for (k = 0; k < 5; k++) line(g, 52 + k, 40, 56 + k, 48, 'r');
    tri(g, 52, 38, 62, 48, 52, 48, 'r'); for (k = 0; k < 3; k++) line(g, 54 + k * 3, 40 + k * 2, 54 + k * 3, 48, 'R');
    // wheels (spokes rotate on walk)
    [[14, 44, 6], [30, 44, 6], [44, 46, 4]].forEach(function (wv) {
      oval(g, wv[0], wv[1], wv[2], wv[2], 'r'); oval(g, wv[0], wv[1], wv[2] - 2, wv[2] - 2, 'R');
      if ((p.a === 'walk' && p.i) || p.a === 'idle' && p.i) { line(g, wv[0] - wv[2] + 1, wv[1], wv[0] + wv[2] - 1, wv[1], 'r'); line(g, wv[0], wv[1] - wv[2] + 1, wv[0], wv[1] + wv[2] - 1, 'r'); }
      else { line(g, wv[0] - wv[2] + 2, wv[1] - wv[2] + 2, wv[0] + wv[2] - 2, wv[1] + wv[2] - 2, 'r'); line(g, wv[0] - wv[2] + 2, wv[1] + wv[2] - 2, wv[0] + wv[2] - 2, wv[1] - wv[2] + 2, 'r'); }
      rect(g, wv[0] - 1, wv[1] - 1, 2, 2, 'y');
    });
    line(g, 14, 44, 30, 44, 'S', 2);
    // piston arm
    if (atk) { rect(g, 36, 28 + b, 20, 4, 'S'); rect(g, 56, 25 + b, 6, 10, 'y'); rect(g, 58, 27 + b, 4, 6, 'Y'); }
    else { rect(g, 30, 28 + b, 4, 10, 'S'); rect(g, 28, 36 + b, 8, 3, 'y'); }
    // steam
    var puff = sp ? 4 : p.a === 'walk' ? (p.i ? 1 : 0) : 0;
    if (sp) { oval(g, 46, 2, 5, 2, 'w'); oval(g, 38, 1, 4, 1, 'W'); oval(g, 56, 2, 4, 2, 'W'); line(g, 0, 30, 6, 30, 'w'); oval(g, 3, 28, 3, 2, 'w'); }
    else oval(g, 44 - puff * 3, 2 + b, 3, 1, 'W');
  });

  // ---- THE TIDEMOTHER: sea-witch octopus queen ----
  boss('tidemother', { p: C.m0, P: C.m3, q: C.m1, s: C.t3, S: C.t2, h: C.c1, H: C.c0, y: C.y2, w: C.W, e: C.y2, K: C.K, c: C.c3, C: C.b4, m: C.o2, r: C.o1, t: C.y1 }, 66, 62, function (G0, p) {
    var g = G0.slice(6); // shared rows: draw the figure 6px lower, headroom above for the orb
    var b = p.a === 'idle' ? p.i : 0, sw = p.a === 'walk' ? (p.i ? 2 : -2) : (p.a === 'idle' ? p.i : 0);
    var atk = p.a === 'attack', sp = p.a === 'special', cx = 30;
    // tentacles
    function tent(x0, dir, len, ph) {
      var x = x0, y = 36;
      for (var k = 0; k < len; k++) {
        var th = k < len - 5 ? 4 : k < len - 2 ? 3 : 2;
        rect(g, x, y, th, th, 'p'); if (k % 3 === 1) px(g, x + (dir > 0 ? 0 : th - 1), y + th - 1, 'P');
        x += dir; if (k < 6) y += 2; else if (k < len - 2) y += (k % 2 ? 0 : 1); else y -= 1;
      }
      px(g, x, y - 1, 'p'); px(g, x - dir, y - 2, 'p');
    }
    tent(cx - 8, -1, 17 + sw, 0); tent(cx - 4, -1, 13 - sw, 1); tent(cx + 3, 1, 13 + sw, 0);
    if (atk) { for (var k = 0; k < 30; k++) { rect(g, cx + 6 + k, 34 - (k > 24 ? (k - 24) : 0), 3, 3, 'p'); if (k % 3 === 0) px(g, cx + 6 + k, 36 - (k > 24 ? (k - 24) : 0), 'P'); } }
    else tent(cx + 7, 1, 17 - sw, 1);
    tent(cx, 1, 7, 0); tent(cx - 1, -1, 7, 0);
    // mantle
    oval(g, cx, 36, 17, 8, 'p'); oval(g, cx - 3, 33, 10, 3, 'q');
    for (k = 0; k < 4; k++) px(g, cx - 9 + k * 6, 39, 'P');
    // torso
    var ty = 18 + b;
    rect(g, cx - 5, ty, 11, 13, 's'); oval(g, cx, ty + 12, 7, 3, 's');
    oval(g, cx - 2, ty + 4, 2, 2, 'm'); oval(g, cx + 3, ty + 4, 2, 2, 'm'); // shell top
    rect(g, cx - 5, ty + 9, 11, 2, 'y'); px(g, cx, ty + 10, 'r');
    // hair (long, flowing back)
    rect(g, cx - 10, ty - 10, 8, 22, 'h'); rect(g, cx - 13, ty - 2, 4, 16, 'H'); rect(g, cx - 8, ty - 13, 14, 5, 'h');
    // head
    oval(g, cx + 1, ty - 6, 5, 6, 's');
    rect(g, cx + 1, ty - 8, 2, 1, 'e'); rect(g, cx + 4, ty - 8, 2, 1, 'e'); px(g, cx + 2, ty - 8, 'K'); px(g, cx + 5, ty - 8, 'K');
    line(g, cx, ty - 10, cx + 2, ty - 9, 'K'); line(g, cx + 4, ty - 9, cx + 6, ty - 10, 'K');
    rect(g, cx + 2, ty - 4, 4, 1, sp ? 'K' : 'r'); px(g, cx + 6, ty - 5, 'r');
    rect(g, cx - 4, ty - 12, 4, 6, 'h'); // fringe side
    // crown
    rect(g, cx - 3, ty - 14, 9, 2, 'y'); for (k = 0; k < 3; k++) { px(g, cx - 3 + k * 4, ty - 16, 'y'); px(g, cx - 3 + k * 4, ty - 15, 'y'); } px(g, cx + 1, ty - 14, 'w');
    // arms + trident / orb
    if (sp) {
      line(g, cx - 5, ty + 1, cx - 9, ty - 12, 's', 2); line(g, cx + 5, ty + 1, cx + 9, ty - 12, 's', 2);
      oval(G0, cx, 6 + ty - 20, 5, 4, 'C'); oval(G0, cx - 1, 6 + ty - 21, 2, 1, 'c'); px(G0, cx + 2, 6 + ty - 19, 'w');
    } else {
      line(g, cx + 5, ty + 1, cx + 10, ty + 6, 's', 2);
      line(g, cx + 11, ty - 12, cx + 11, ty + 18, 't', 1); rect(g, cx + 9, ty - 13, 5, 1, 't'); px(g, cx + 9, ty - 15, 't'); px(g, cx + 9, ty - 14, 't'); px(g, cx + 11, ty - 16, 't'); px(g, cx + 11, ty - 15, 't'); px(g, cx + 13, ty - 15, 't'); px(g, cx + 13, ty - 14, 't');
      line(g, cx - 5, ty + 1, cx - 7, ty + 9, 's', 2);
    }
  });

  // ---- THE BUTCHER: masked hunter-butcher with a cleaver ----
  boss('butcher', { s: C.n2, S: C.n1, a: C.g2, A: C.g1, r: C.r0, R: C.o0, m: C.y2, M: C.m0, f: C.m1, c: C.g1, C: C.W, h: C.n0, l: C.y0, L: C.n0, K: C.K, b: C.y0, e: C.o1 }, 54, 54, function (g, p) {
    var b = p.a === 'idle' ? p.i : 0, cx = 24, st = p.a === 'walk' ? (p.i ? 2 : -2) : 0;
    var atk = p.a === 'attack', sp = p.a === 'special';
    // legs
    rect(g, cx - 9 + st, 40, 7, 12, 'l'); rect(g, cx + 3 - st, 40, 7, 12, 'l');
    rect(g, cx - 10 + st, 49, 9, 4, 'b'); rect(g, cx + 2 - st, 49, 10, 4, 'b');
    // body
    oval(g, cx, 30 + b, 14, 12, 'L');
    // apron
    rect(g, cx - 8, 22 + b, 17, 22, 'a'); rect(g, cx - 6, 18 + b, 13, 4, 'a');
    line(g, cx - 8, 22 + b, cx - 8, 43 + b, 'A'); line(g, cx, 26 + b, cx, 43 + b, 'A');
    px(g, cx + 3, 28 + b, 'r'); px(g, cx + 4, 29 + b, 'r'); px(g, cx - 4, 34 + b, 'r'); px(g, cx + 5, 37 + b, 'r'); px(g, cx - 3, 40 + b, 'r'); px(g, cx - 2, 40 + b, 'r');
    rect(g, cx - 8, 30 + b, 17, 1, 'h');
    // head: hood + masquerade mask
    var hy = 12 + b;
    oval(g, cx + 1, hy, 7, 7, 'h'); rect(g, cx - 1, hy - 3, 9, 9, 's'); oval(g, cx + 3, hy + 4, 5, 3, 's');
    rect(g, cx - 1, hy - 2, 10, 4, 'm'); px(g, cx + 9, hy - 3, 'm'); px(g, cx - 2, hy - 3, 'm');
    rect(g, cx + 1, hy - 1, 2, 2, 'K'); rect(g, cx + 5, hy - 1, 2, 2, 'K'); px(g, cx + 2, hy - 1, sp ? 'e' : 'K'); px(g, cx + 6, hy - 1, sp ? 'e' : 'K');
    line(g, cx - 2, hy - 3, cx - 5, hy - 10, 'f', 2); px(g, cx - 6, hy - 11, 'M'); px(g, cx - 4, hy - 8, 'M');
    if (sp) rect(g, cx + 3, hy + 4, 5, 3, 'K'); else rect(g, cx + 3, hy + 5, 4, 1, 'K');
    rect(g, cx - 1, hy + 3, 2, 3, 'S');
    // arms + cleaver
    if (atk) { // swing forward-down
      line(g, cx + 10, 22 + b, cx + 20, 30 + b, 's', 4); oval(g, cx + 21, 31 + b, 3, 3, 's');
      rect(g, cx + 22, 31 + b, 3, 4, 'h'); rect(g, cx + 20, 35 + b, 12, 12, 'c'); rect(g, cx + 20, 46 + b, 12, 2, 'C'); px(g, cx + 29, 37 + b, 'K');
      line(g, cx - 10, 22 + b, cx - 13, 34 + b, 's', 4);
    } else if (sp) { // cleaver raised high
      line(g, cx + 10, 22 + b, cx + 15, 8 + b, 's', 4); oval(g, cx + 15, 7 + b, 3, 3, 's');
      rect(g, cx + 14, 0, 3, 6, 'h'); rect(g, cx + 17, 0, 12, 11, 'c'); rect(g, cx + 28, 0, 2, 11, 'C');
      line(g, cx - 10, 22 + b, cx - 16, 14 + b, 's', 4); oval(g, cx - 16, 13 + b, 3, 3, 's');
    } else {
      line(g, cx + 10, 22 + b, cx + 14, 34 + b, 's', 4); oval(g, cx + 14, 35 + b, 3, 3, 's');
      rect(g, cx + 13, 28 + b, 3, 6, 'h'); rect(g, cx + 16, 22 + b, 11, 12, 'c'); rect(g, cx + 26, 22 + b, 2, 12, 'C'); px(g, cx + 18, 24 + b, 'K');
      line(g, cx - 10, 22 + b, cx - 13, 34 + b, 's', 4); oval(g, cx - 13, 35 + b, 3, 3, 's');
    }
  });

  // ---- THE BEDLAM BRIDE: floating ghost bride, veil, tattered gown ----
  boss('bride', { w: C.W, W: C.b6, v: C.b7, V: C.p2, s: C.b6, S: C.b4, e: C.p0, E: C.o1, K: C.K, f: C.p1, F: C.G0, r: C.m2 }, 44, 56, function (g, p) {
    var b = p.a === 'idle' || p.a === 'walk' ? (p.i ? -2 : 0) : 0, cx = 20;
    var atk = p.a === 'attack', sp = p.a === 'special';
    var y0 = 1 + b;
    // veil flowing back
    tri(g, cx - 2, y0 + 2, cx - 16 - (sp ? 4 : 0), y0 + 30, cx + 2, y0 + 26, 'v');
    tri(g, cx - 4, y0 + 6, cx - 18 - (sp ? 4 : 0), y0 + 40, cx - 6, y0 + 34, 'V');
    // gown
    tri(g, cx, y0 + 16, cx - 14, y0 + 46, cx + 14, y0 + 46, 'w');
    rect(g, cx - 5, y0 + 16, 11, 10, 'w');
    for (var k = 0; k < 7; k++) { // tattered hem
      var hx = cx - 14 + k * 4;
      tri(g, hx, y0 + 46, hx + 4, y0 + 46, hx + 1 + (k % 2), y0 + 50 + (k % 3), 'w');
    }
    for (k = 0; k < 5; k++) line(g, cx - 8 + k * 4, y0 + 30, cx - 10 + k * 5, y0 + 45, 'W');
    rect(g, cx - 5, y0 + 22, 11, 2, 'W');
    // head + veil cap
    oval(g, cx + 1, y0 + 9, 5, 6, 's');
    rect(g, cx - 4, y0 + 1, 9, 5, 'v'); rect(g, cx - 5, y0 + 3, 3, 12, 'v');
    px(g, cx - 1, y0, 'w'); px(g, cx + 1, y0 + 1, 'w'); px(g, cx + 3, y0, 'w'); // tiara
    rect(g, cx + 1, y0 + 8, 2, 2, sp ? 'E' : 'e'); rect(g, cx + 4, y0 + 8, 2, 2, sp ? 'E' : 'e');
    if (sp) rect(g, cx + 2, y0 + 12, 4, 3, 'K'); else rect(g, cx + 2, y0 + 12, 3, 1, 'e');
    line(g, cx - 1, y0 + 6, cx - 1, y0 + 13, 'S');
    // arms
    if (atk) {
      line(g, cx + 4, y0 + 18, cx + 18, y0 + 18, 's', 2); line(g, cx + 4, y0 + 21, cx + 17, y0 + 23, 's', 2);
      for (k = 0; k < 3; k++) { px(g, cx + 20, y0 + 16 + k * 2, 's'); px(g, cx + 19, y0 + 22 + k, 's'); }
    } else if (sp) {
      line(g, cx - 4, y0 + 18, cx - 12, y0 + 8, 's', 2); line(g, cx + 5, y0 + 18, cx + 14, y0 + 8, 's', 2);
      px(g, cx - 13, y0 + 6, 's'); px(g, cx + 15, y0 + 6, 's');
    } else {
      line(g, cx - 4, y0 + 18, cx + 4, y0 + 26, 's', 2); line(g, cx + 5, y0 + 18, cx + 6, y0 + 26, 's', 2);
      oval(g, cx + 6, y0 + 27, 3, 2, 'f'); px(g, cx + 4, y0 + 26, 'r'); px(g, cx + 8, y0 + 26, 'r'); line(g, cx + 6, y0 + 29, cx + 6, y0 + 33, 'F');
    }
  });

  // ---- THE OVERSEER: hulking alien in power armour ----
  boss('overseer', { a: C.g1, A: C.g0, d: C.g3, p: C.p1, P: C.p0, g: C.l2, G: C.l1, c: C.b6, C: C.b4, s: C.m2, S: C.m0, e: C.y2, K: C.K, r: C.o1, y: C.y2, w: C.W }, 58, 62, function (g, p) {
    var b = p.a === 'idle' ? p.i : 0, cx = 26, st = p.a === 'walk' ? (p.i ? 3 : -3) : 0;
    var atk = p.a === 'attack', sp = p.a === 'special';
    // legs
    rect(g, cx - 12 + st, 42, 9, 14, 'a'); rect(g, cx + 4 - st, 42, 9, 14, 'a');
    rect(g, cx - 12 + st, 47, 9, 2, 'p'); rect(g, cx + 4 - st, 47, 9, 2, 'p');
    rect(g, cx - 14 + st, 55, 12, 5, 'A'); rect(g, cx + 3 - st, 55, 13, 5, 'A');
    // torso
    rect(g, cx - 13, 20 + b, 27, 24, 'a'); rect(g, cx - 13, 20 + b, 27, 2, 'd');
    tri(g, cx - 13, 38 + b, cx + 14, 38 + b, cx, 46 + b, 'A');
    oval(g, cx, 30 + b, 4, 4, 'p'); oval(g, cx, 30 + b, 2, 2, sp ? 'w' : 'g'); px(g, cx, 30 + b, 'w');
    rect(g, cx - 11, 26 + b, 4, 10, 'A'); rect(g, cx + 8, 26 + b, 4, 10, 'A');
    // shoulders
    oval(g, cx - 15, 22 + b, 8, 6, 'a'); oval(g, cx + 16, 22 + b, 8, 6, 'a');
    rect(g, cx - 22, 22 + b, 15, 2, 'p'); rect(g, cx + 9, 22 + b, 15, 2, 'p');
    if (sp) { rect(g, cx - 22, 10 + b, 10, 8, 'A'); rect(g, cx + 12, 10 + b, 10, 8, 'A'); for (var k = 0; k < 3; k++) { rect(g, cx - 21 + k * 3, 8 + b, 2, 3, 'r'); rect(g, cx + 13 + k * 3, 8 + b, 2, 3, 'r'); } }
    // helmet dome with alien inside
    var hy = 10 + b;
    oval(g, cx + 1, hy, 9, 8, 'c'); oval(g, cx + 1, hy + 1, 7, 6, 's');
    rect(g, cx - 2, hy - 2, 2, 2, 'e'); rect(g, cx + 2, hy - 3, 2, 2, 'e'); rect(g, cx + 6, hy - 2, 2, 2, 'e');
    px(g, cx - 1, hy - 1, 'K'); px(g, cx + 3, hy - 2, 'K'); px(g, cx + 7, hy - 1, 'K');
    rect(g, cx, hy + 3, 7, 1, 'S'); px(g, cx + 1, hy + 4, 'S'); px(g, cx + 5, hy + 4, 'S');
    px(g, cx - 5, hy - 5, 'w'); px(g, cx - 4, hy - 6, 'w');
    rect(g, cx - 8, hy + 6, 19, 3, 'A');
    // arms
    rect(g, cx - 23, 26 + b, 8, 14, 'a'); rect(g, cx - 24, 38 + b, 10, 6, 'A');
    if (atk) { rect(g, cx + 16, 24 + b, 22, 8, 'a'); rect(g, cx + 36, 23 + b, 4, 10, 'A'); rect(g, cx + 40, 25 + b, 2, 6, 'y'); px(g, cx + 42, 27 + b, 'w'); px(g, cx + 42, 28 + b, 'w'); rect(g, cx + 18, 26 + b, 16, 1, 'G'); }
    else { rect(g, cx + 16, 26 + b, 8, 12, 'a'); rect(g, cx + 15, 37 + b, 11, 9, 'A'); rect(g, cx + 17, 45 + b, 7, 2, 'G'); }
  });

  // ---- THE SHOWRUNNER: alien game-show host, mic, sequins, many eyes, big grin ----
  boss('showrunner', { g: C.G2, G: C.G1, q: C.y2, Q: C.y1, W: C.W, l: C.p1, L: C.p0, r: C.o1, w: C.W, e: C.y3, K: C.K, m: C.g0, M: C.g3, p: C.K, s: C.m2, t: C.W, b: C.K, h: C.y0 }, 56, 64, function (g, p) {
    var b = p.a === 'idle' ? p.i : 0, cx = 24, st = p.a === 'walk' ? (p.i ? 2 : -2) : 0;
    var atk = p.a === 'attack', sp = p.a === 'special';
    // legs
    rect(g, cx - 6 + st, 44, 5, 15, 'q'); rect(g, cx + 2 - st, 44, 5, 15, 'q');
    rect(g, cx - 8 + st, 58, 8, 4, 'L'); rect(g, cx + 1 - st, 58, 9, 4, 'L');
    // jacket
    rect(g, cx - 10, 26 + b, 21, 20, 'q');
    tri(g, cx - 3, 26 + b, cx + 4, 26 + b, cx, 38 + b, 'w');
    line(g, cx - 3, 26 + b, cx - 1, 38 + b, 'l', 2); line(g, cx + 4, 26 + b, cx + 2, 38 + b, 'l', 2);
    rect(g, cx - 2, 27 + b, 5, 2, 'r'); px(g, cx, 27 + b, 'L');
    dots(g, 0, 0, 56, 64, 'q', 'Q', function (x, y) { return (x + 2 * y) % 5 === 0; });
    dots(g, 0, 0, 56, 64, 'q', 'W', function (x, y) { return (x * 3 + y * 2) % 13 === (p.i ? 4 : 0); });
    // neck + huge head
    rect(g, cx - 2, 22 + b, 5, 5, 'G');
    var hy = 12 + b;
    oval(g, cx + 1, hy, 12, 10, 'g'); oval(g, cx - 2, hy - 4, 7, 4, 'G');
    // slicked hair crest
    rect(g, cx - 8, hy - 11, 16, 3, 'l'); rect(g, cx - 4, hy - 13, 12, 2, 'l'); px(g, cx + 8, hy - 12, 'l');
    // five eyes
    [[-6, -4], [-1, -6], [4, -5], [-3, 0], [7, 0]].forEach(function (E, k) {
      rect(g, cx + E[0], hy + E[1], 3, 3, 'w'); px(g, cx + E[0] + 2, hy + E[1] + 1, sp ? 'r' : 'K'); px(g, cx + E[0] + 2, hy + E[1] + 2, 'K');
    });
    if (p.a === 'idle' && p.i) rect(g, cx - 1, hy - 6, 3, 3, 'G'); // a blink
    // grin
    var gw = sp ? 22 : 18;
    rect(g, cx - (gw >> 1) + 2, hy + 4, gw, 5, 'K');
    for (var k = 0; k < gw; k += 2) { px(g, cx - (gw >> 1) + 2 + k, hy + 4, 't'); px(g, cx - (gw >> 1) + 3 + k, hy + 8, 't'); }
    rect(g, cx - 2, hy + 6, 7, 2, 's');
    // arms + mic
    if (atk) {
      rect(g, cx + 10, 28 + b, 14, 4, 'q'); rect(g, cx + 24, 28 + b, 4, 4, 'w'); rect(g, cx + 28, 29 + b, 4, 1, 'w');
      rect(g, cx - 14, 28 + b, 4, 12, 'q'); rect(g, cx - 14, 40 + b, 4, 3, 'w'); rect(g, cx - 13, 36 + b, 2, 4, 'm'); oval(g, cx - 12, 34 + b, 2, 2, 'M');
    } else if (sp) {
      line(g, cx - 10, 28 + b, cx - 20, 18 + b, 'q', 4); rect(g, cx - 24, 14 + b, 4, 4, 'w');
      line(g, cx + 10, 28 + b, cx + 20, 18 + b, 'q', 4); rect(g, cx + 20, 14 + b, 4, 4, 'w'); rect(g, cx + 21, 9 + b, 2, 5, 'm'); oval(g, cx + 22, 7 + b, 2, 2, 'M');
      [[2, 4], [50, 6], [6, 40], [48, 40], [28, 0]].forEach(function (s2) { px(g, s2[0], s2[1], 'e'); px(g, s2[0] - 1, s2[1], 'e'); px(g, s2[0] + 1, s2[1], 'e'); px(g, s2[0], s2[1] - 1, 'e'); px(g, s2[0], s2[1] + 1, 'e'); });
    } else {
      rect(g, cx - 14, 28 + b, 4, 12, 'q'); rect(g, cx - 14, 40 + b, 4, 3, 'w');
      rect(g, cx + 11, 28 + b, 4, 6, 'q'); rect(g, cx + 13, 32 + b, 7, 4, 'q'); rect(g, cx + 19, 30 + b, 4, 4, 'w');
      rect(g, cx + 20, 24 + b, 2, 6, 'm'); oval(g, cx + 21, 22 + b, 2, 2, 'M'); px(g, cx + 20, 21 + b, 'w');
    }
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
  portrait('p_donut', { o: C.n2, O: C.n1, c: C.n3, e: C.G1, w: C.W, p: C.m2, y: C.y2, r: C.r1, K: C.K }, BG_HERO, function (g) {
    oval(g, 16, 27, 13, 6, 'o'); oval(g, 16, 28, 7, 4, 'c');
    oval(g, 16, 17, 12, 10, 'o');
    tri(g, 4, 3, 10, 9, 4, 12, 'o'); tri(g, 28, 3, 22, 9, 28, 12, 'o'); tri(g, 5, 6, 8, 9, 5, 10, 'p'); tri(g, 27, 6, 24, 9, 27, 10, 'p');
    for (var k = 0; k < 6; k++) { px(g, 3 + k, 22 + k % 2, 'o'); px(g, 28 - k, 22 + k % 2, 'o'); }
    oval(g, 16, 22, 6, 4, 'c');
    rect(g, 8, 14, 5, 3, 'w'); rect(g, 19, 14, 5, 3, 'w'); rect(g, 10, 15, 2, 2, 'e'); rect(g, 21, 15, 2, 2, 'e'); px(g, 11, 15, 'K'); px(g, 22, 15, 'K');
    rect(g, 8, 13, 5, 2, 'O'); rect(g, 19, 13, 5, 2, 'O'); // haughty lids
    rect(g, 15, 20, 3, 2, 'p'); line(g, 16, 22, 16, 23, 'K'); line(g, 13, 24, 15, 23, 'K'); line(g, 17, 23, 19, 24, 'K');
    line(g, 4, 20, 10, 21, 'c'); line(g, 22, 21, 28, 20, 'c');
    rect(g, 11, 5, 11, 3, 'y'); for (k = 0; k < 4; k++) { px(g, 11 + k * 3 + 1, 3, 'y'); px(g, 11 + k * 3 + 1, 4, 'y'); } px(g, 16, 2, 'y'); px(g, 16, 5, 'r');
  });
  portrait('p_mongo', { g: C.G1, G: C.l2, S: C.G0, w: C.W, e: C.K, m: C.o0 }, BG_HERO, function (g) {
    oval(g, 14, 26, 10, 7, 'g'); oval(g, 16, 28, 5, 4, 'G');
    oval(g, 15, 14, 11, 9, 'g'); rect(g, 16, 10, 15, 9, 'g'); rect(g, 16, 18, 14, 4, 'G');
    rect(g, 17, 18, 14, 2, 'm'); for (var x = 17; x < 31; x += 2) { px(g, x, 18, 'w'); px(g, x + 1, 19, 'w'); }
    rect(g, 13, 8, 6, 5, 'w'); rect(g, 15, 9, 3, 3, 'e'); px(g, 15, 9, 'w');
    for (x = 5; x < 14; x += 3) rect(g, x, 12, 2, 2, 'S');
    px(g, 28, 12, 'S'); px(g, 26, 12, 'S');
  });
  portrait('p_katia', { s: C.n3, S: C.n2, h: C.o1, H: C.o0, w: C.W, e: C.b3, m: C.o0, a: C.b5, A: C.b1 }, BG_HERO, function (g) {
    rect(g, 3, 25, 26, 7, 'a'); rect(g, 3, 25, 26, 2, 'A'); rect(g, 12, 22, 8, 5, 's');
    oval(g, 16, 14, 9, 10, 's');
    oval(g, 15, 7, 11, 6, 'h'); rect(g, 5, 7, 5, 12, 'h'); rect(g, 1, 9, 5, 16, 'H'); rect(g, 2, 7, 4, 3, 'h');
    rect(g, 17, 6, 8, 3, 'h');
    eyeP(g, 13, 13, 1); eyeP(g, 20, 13, 1); line(g, 12, 12, 14, 11, 'H'); line(g, 20, 11, 22, 12, 'H');
    rect(g, 22, 17, 1, 2, 'S'); rect(g, 16, 20, 5, 1, 'm');
  });
  portrait('p_zev', { b: C.c1, B: C.c2, f: C.b4, w: C.W, e: C.K, h: C.g3, m: C.g1, c: C.m1, x: C.K }, BG_HERO, function (g) {
    rect(g, 4, 26, 24, 6, 'c'); tri(g, 13, 26, 19, 26, 16, 31, 'w');
    oval(g, 16, 15, 12, 11, 'b'); oval(g, 18, 20, 8, 4, 'B');
    tri(g, 10, 1, 20, 4, 12, 7, 'f'); tri(g, 3, 14, 6, 10, 6, 20, 'f');
    rect(g, 15, 8, 7, 7, 'w'); rect(g, 19, 10, 3, 4, 'e'); px(g, 20, 10, 'w');
    rect(g, 18, 19, 9, 2, 'x'); px(g, 26, 18, 'x');
    rect(g, 3, 6, 3, 3, 'h'); rect(g, 4, 3, 16, 2, 'h'); rect(g, 4, 9, 2, 12, 'h'); line(g, 5, 20, 14, 23, 'm'); rect(g, 13, 22, 3, 2, 'h');
  });
  portrait('p_squeaks', { g: C.g1, G: C.g0, H: C.g0, h: C.g3, e: C.K, w: C.W, p: C.m3, r: C.o1, y: C.n3 }, BG_HERO, function (g) {
    oval(g, 15, 27, 11, 6, 'g');
    oval(g, 14, 17, 9, 8, 'g'); tri(g, 18, 13, 30, 19, 18, 23, 'g'); rect(g, 28, 17, 3, 3, 'p');
    oval(g, 7, 12, 4, 4, 'g'); oval(g, 7, 12, 2, 2, 'p');
    oval(g, 15, 9, 9, 5, 'H'); rect(g, 6, 9, 19, 3, 'H'); rect(g, 6, 11, 19, 1, 'h'); line(g, 15, 4, 15, 1, 'r'); rect(g, 14, 0, 3, 2, 'r');
    rect(g, 17, 15, 3, 3, 'e'); px(g, 17, 15, 'w');
    line(g, 22, 22, 29, 23, 'G'); line(g, 22, 20, 30, 19, 'G');
    line(g, 26, 31, 31, 24, 'y');
  });
  portrait('p_ai', { c: C.y1, C: C.y0, s: C.c0, g: C.l2, G: C.G2, a: C.g1, r: C.o1, w: C.W }, BG_NPC, function (g) {
    line(g, 9, 0, 13, 5, 'a'); line(g, 23, 0, 19, 5, 'a'); rect(g, 14, 4, 4, 2, 'r');
    rect(g, 1, 6, 30, 24, 'c'); rect(g, 3, 8, 22, 19, 's'); rect(g, 26, 10, 3, 3, 'r'); rect(g, 26, 15, 3, 3, 'C'); rect(g, 26, 20, 3, 6, 'C');
    rect(g, 7, 11, 4, 4, 'g'); rect(g, 17, 11, 4, 4, 'g'); px(g, 9, 12, 'G'); px(g, 19, 12, 'G');
    rect(g, 5, 18, 2, 2, 'g'); rect(g, 21, 18, 2, 2, 'g'); rect(g, 7, 20, 14, 2, 'g'); rect(g, 9, 22, 10, 2, 'g');
    for (var x = 8; x < 20; x += 3) rect(g, x, 20, 2, 1, 'w');
    rect(g, 4, 30, 4, 2, 'C'); rect(g, 24, 30, 4, 2, 'C');
  });
  portrait('p_mordecai', { f: C.g1, F: C.g0, B: C.y2, b: C.n1, w: C.W, e: C.K, a: C.W, r: C.o0, m: C.y1 }, BG_NPC, function (g) {
    rect(g, 4, 25, 22, 7, 'r'); rect(g, 10, 25, 10, 7, 'a'); rect(g, 9, 25, 1, 7, 'F'); rect(g, 20, 25, 1, 7, 'F');
    rect(g, 11, 19, 8, 7, 'f');
    oval(g, 14, 12, 10, 9, 'f'); tri(g, 8, 0, 14, 4, 10, 6, 'F'); tri(g, 13, 1, 17, 4, 14, 6, 'F');
    tri(g, 21, 11, 31, 16, 21, 18, 'B'); line(g, 22, 15, 30, 16, 'b');
    rect(g, 14, 9, 5, 4, 'w'); rect(g, 16, 10, 2, 3, 'e');
    line(g, 12, 7, 19, 9, 'F'); line(g, 12, 8, 19, 10, 'F');
    rect(g, 24, 24, 7, 8, 'm'); rect(g, 24, 23, 7, 2, 'w');
  });
  portrait('p_bopca', { f: C.m2, F: C.m1, w: C.W, e: C.K, n: C.r1, v: C.G1, t: C.m3 }, BG_NPC, function (g) {
    oval(g, 16, 18, 14, 13, 'f');
    for (var k = 0; k < 9; k++) { px(g, 3 + k * 3, 5 + (k % 2), 'f'); px(g, 2, 9 + k * 2, 'f'); px(g, 30, 9 + k * 2, 'f'); }
    tri(g, 6, 0, 10, 6, 4, 6, 'F'); tri(g, 26, 0, 28, 6, 22, 6, 'F');
    oval(g, 10, 14, 4, 4, 'w'); oval(g, 22, 14, 4, 4, 'w'); rect(g, 11, 14, 3, 3, 'e'); rect(g, 23, 14, 3, 3, 'e'); px(g, 11, 14, 'w'); px(g, 23, 14, 'w');
    rect(g, 15, 19, 3, 2, 'n');
    rect(g, 10, 22, 12, 2, 'e'); rect(g, 12, 24, 8, 1, 'e'); rect(g, 13, 22, 2, 1, 'w'); rect(g, 18, 22, 2, 1, 'w');
    rect(g, 6, 27, 20, 5, 'v'); rect(g, 6, 27, 20, 1, 'F');
    oval(g, 6, 20, 2, 2, 't'); oval(g, 26, 20, 2, 2, 't');
  });
  // ---- boss portraits ----
  portrait('p_hoarder', { b: C.n0, h: C.n1, d: C.y0, e: C.o1, E: C.y2, m: C.y1, y: C.y2, r: C.r1, g: C.g1, c: C.c2 }, BG_FOE, function (g) {
    oval(g, 16, 25, 15, 8, 'b'); oval(g, 14, 22, 9, 3, 'h');
    oval(g, 16, 16, 10, 9, 'd');
    oval(g, 10, 14, 4, 4, 'e'); oval(g, 22, 14, 4, 4, 'e'); px(g, 9, 13, 'E'); px(g, 21, 13, 'E'); px(g, 11, 15, 'E'); px(g, 23, 15, 'E');
    line(g, 11, 23, 7, 30, 'm', 2); line(g, 21, 23, 25, 30, 'm', 2); rect(g, 13, 22, 6, 3, 'r');
    line(g, 12, 7, 4, 0, 'm'); line(g, 20, 7, 28, 0, 'm');
    rect(g, 11, 5, 11, 3, 'y'); for (var k = 0; k < 4; k++) { px(g, 11 + k * 3 + 1, 3, 'y'); px(g, 11 + k * 3 + 1, 4, 'y'); } px(g, 16, 6, 'r');
    rect(g, 0, 22, 5, 5, 'g'); rect(g, 1, 23, 3, 3, 'c');
  });
  portrait('p_juicer', { g: C.G1, G: C.G0, w: C.W, r: C.o1, e: C.y2, K: C.K, y: C.y2, h: C.K, v: C.t0 }, BG_FOE, function (g) {
    tri(g, 0, 31, 16, 14, 32, 31, 'g'); rect(g, 0, 24, 32, 8, 'g'); tri(g, 9, 32, 16, 22, 23, 32, 'w'); rect(g, 10, 26, 13, 6, 'w');
    line(g, 4, 28, 9, 22, 'v'); line(g, 27, 28, 23, 22, 'v');
    oval(g, 17, 12, 8, 9, 'g');
    rect(g, 9, 2, 16, 4, 'h'); rect(g, 9, 6, 17, 2, 'r');
    rect(g, 13, 10, 4, 2, 'e'); rect(g, 19, 10, 4, 2, 'e'); px(g, 15, 11, 'K'); px(g, 21, 11, 'K'); line(g, 12, 9, 16, 10, 'K'); line(g, 19, 10, 23, 9, 'K');
    rect(g, 14, 16, 8, 3, 'w'); line(g, 14, 17, 21, 17, 'K'); px(g, 17, 16, 'K'); px(g, 17, 18, 'K');
    line(g, 9, 22, 16, 25, 'y'); line(g, 16, 25, 24, 22, 'y');
  });
  portrait('p_ringmaster', { h: C.m0, H: C.y2, f: C.o3, F: C.n2, e: C.y2, K: C.K, m: C.y0, c: C.o0, g: C.W, y: C.y2, r: C.o1 }, BG_FOE, function (g) {
    rect(g, 3, 27, 26, 5, 'c'); tri(g, 12, 27, 20, 27, 16, 31, 'g'); rect(g, 14, 27, 5, 2, 'r'); line(g, 11, 27, 13, 31, 'y'); line(g, 21, 27, 19, 31, 'y');
    rect(g, 10, 10, 13, 15, 'f'); rect(g, 12, 25, 9, 2, 'f'); line(g, 10, 14, 10, 23, 'F');
    rect(g, 13, 14, 3, 2, 'e'); rect(g, 18, 14, 3, 2, 'e'); px(g, 14, 15, 'K'); px(g, 19, 15, 'K');
    line(g, 12, 13, 16, 11, 'K'); line(g, 18, 11, 22, 13, 'K');
    rect(g, 13, 19, 9, 1, 'm'); px(g, 11, 18, 'm'); px(g, 23, 18, 'm'); px(g, 10, 17, 'm'); px(g, 24, 17, 'm'); px(g, 10, 16, 'm'); px(g, 24, 16, 'm');
    rect(g, 14, 22, 6, 1, 'K'); px(g, 20, 21, 'K'); px(g, 13, 21, 'K');
    rect(g, 9, 0, 16, 8, 'h'); rect(g, 9, 6, 16, 2, 'H'); rect(g, 5, 8, 24, 2, 'h'); rect(g, 10, 1, 1, 4, 'c');
  });
  portrait('p_engineer', { g: C.G1, G: C.G0, o: C.y2, O: C.K, w: C.W, s: C.g0, S: C.g1, t: C.t0, r: C.o1, y: C.y2, K: C.K }, BG_FOE, function (g) {
    rect(g, 2, 26, 28, 6, 't'); rect(g, 2, 26, 28, 1, 'y'); rect(g, 10, 28, 3, 3, 'y');
    oval(g, 16, 16, 10, 9, 'g'); tri(g, 1, 10, 8, 14, 5, 19, 'g'); tri(g, 31, 10, 24, 14, 27, 19, 'g');
    rect(g, 6, 3, 21, 6, 's'); rect(g, 4, 8, 25, 2, 's'); rect(g, 7, 4, 19, 1, 'S');
    rect(g, 7, 11, 18, 2, 'O'); oval(g, 12, 13, 3, 3, 'o'); oval(g, 20, 13, 3, 3, 'o'); rect(g, 11, 12, 3, 3, 'O'); rect(g, 19, 12, 3, 3, 'O'); px(g, 11, 12, 'w'); px(g, 19, 12, 'w');
    rect(g, 11, 20, 11, 3, 'K'); for (var x = 11; x < 22; x += 2) px(g, x, 20, 'w');
    px(g, 3, 1, 'S'); px(g, 5, 0, 'S');
  });
  portrait('p_tidemother', { s: C.t3, S: C.t2, h: C.c1, H: C.c0, y: C.y2, w: C.W, e: C.y2, K: C.K, m: C.o2, r: C.o1, p: C.m0 }, BG_FOE, function (g) {
    rect(g, 2, 5, 9, 27, 'h'); rect(g, 22, 8, 8, 24, 'H');
    rect(g, 6, 27, 20, 5, 's'); oval(g, 12, 30, 3, 2, 'm'); oval(g, 20, 30, 3, 2, 'm');
    rect(g, 12, 21, 8, 7, 's');
    oval(g, 16, 14, 9, 10, 's');
    rect(g, 6, 5, 20, 5, 'h'); rect(g, 5, 8, 5, 12, 'h');
    rect(g, 13, 13, 3, 2, 'e'); rect(g, 19, 13, 3, 2, 'e'); px(g, 15, 14, 'K'); px(g, 21, 14, 'K'); line(g, 12, 11, 16, 12, 'K'); line(g, 19, 12, 23, 11, 'K');
    rect(g, 16, 19, 5, 1, 'r'); px(g, 21, 18, 'r'); px(g, 15, 18, 'r'); rect(g, 23, 16, 1, 2, 'S');
    rect(g, 8, 2, 16, 3, 'y'); for (var k = 0; k < 5; k++) { px(g, 8 + k * 4, 0, 'y'); px(g, 8 + k * 4, 1, 'y'); } px(g, 16, 3, 'w'); px(g, 12, 3, 'p'); px(g, 20, 3, 'p');
  });
  portrait('p_butcher', { s: C.n2, S: C.n1, a: C.g2, r: C.r0, m: C.y2, f: C.m1, M: C.m0, h: C.n0, K: C.K }, BG_FOE, function (g) {
    rect(g, 1, 24, 30, 8, 'h'); rect(g, 9, 24, 14, 8, 'a'); px(g, 14, 27, 'r'); px(g, 18, 29, 'r'); px(g, 12, 30, 'r');
    oval(g, 16, 14, 12, 12, 'h'); oval(g, 17, 15, 9, 9, 's');
    rect(g, 7, 10, 20, 6, 'm'); px(g, 6, 9, 'm'); px(g, 27, 9, 'm'); px(g, 5, 8, 'm'); px(g, 28, 8, 'm');
    rect(g, 10, 12, 5, 3, 'K'); rect(g, 19, 12, 5, 3, 'K'); px(g, 12, 13, 'r'); px(g, 21, 13, 'r');
    line(g, 7, 9, 3, 1, 'f', 2); px(g, 2, 0, 'M'); px(g, 5, 4, 'M');
    rect(g, 13, 20, 8, 2, 'K'); px(g, 14, 20, 'a'); px(g, 19, 20, 'a');
    rect(g, 16, 16, 2, 3, 'S');
  });
  portrait('p_bride', { s: C.b6, S: C.b4, v: C.b7, V: C.p2, w: C.W, e: C.p0, K: C.K, r: C.m2 }, BG_FOE, function (g) {
    tri(g, 16, 0, 0, 32, 32, 32, 'v'); tri(g, 16, 4, 2, 32, 8, 32, 'V');
    rect(g, 8, 26, 16, 6, 'w');
    oval(g, 16, 15, 8, 10, 's');
    rect(g, 11, 12, 4, 4, 'e'); rect(g, 18, 12, 4, 4, 'e'); px(g, 12, 13, 'r'); px(g, 19, 13, 'r');
    rect(g, 14, 20, 5, 3, 'K'); line(g, 10, 17, 10, 21, 'S'); line(g, 22, 17, 22, 21, 'S');
    rect(g, 10, 4, 13, 3, 'w'); px(g, 12, 3, 'w'); px(g, 16, 2, 'w'); px(g, 20, 3, 'w');
    for (var y = 8; y < 30; y += 3) { px(g, 6, y, 'w'); px(g, 26, y + 1, 'w'); }
  });
  portrait('p_overseer', { a: C.g1, A: C.g0, p: C.p1, c: C.b6, s: C.m2, S: C.m0, e: C.y2, K: C.K, w: C.W, g: C.l2 }, BG_FOE, function (g) {
    rect(g, 0, 24, 32, 8, 'a'); rect(g, 0, 24, 32, 2, 'p'); oval(g, 16, 29, 3, 2, 'g'); rect(g, 3, 27, 6, 5, 'A'); rect(g, 23, 27, 6, 5, 'A');
    oval(g, 16, 13, 13, 12, 'c'); oval(g, 16, 14, 10, 9, 's');
    rect(g, 8, 10, 4, 4, 'e'); rect(g, 14, 7, 4, 4, 'e'); rect(g, 20, 10, 4, 4, 'e');
    rect(g, 10, 11, 2, 2, 'K'); rect(g, 16, 8, 2, 2, 'K'); rect(g, 22, 11, 2, 2, 'K');
    rect(g, 11, 18, 11, 2, 'S'); for (var x = 11; x < 22; x += 3) rect(g, x, 20, 1, 3, 'S');
    px(g, 7, 4, 'w'); px(g, 6, 5, 'w'); px(g, 8, 3, 'w');
    rect(g, 5, 22, 22, 3, 'A');
  });
  portrait('p_showrunner', { g: C.G2, G: C.G1, q: C.y2, Q: C.y1, W: C.W, l: C.p1, r: C.o1, w: C.W, K: C.K, s: C.m2 }, BG_FOE, function (g) {
    rect(g, 2, 26, 28, 6, 'q'); tri(g, 12, 26, 20, 26, 16, 31, 'w'); rect(g, 13, 26, 7, 2, 'r'); line(g, 12, 26, 14, 31, 'l'); line(g, 20, 26, 18, 31, 'l');
    dots(g, 0, 26, 32, 6, 'q', 'W', function (x, y) { return (x * 3 + y) % 5 === 0; });
    oval(g, 16, 14, 15, 11, 'g'); oval(g, 12, 8, 7, 4, 'G');
    rect(g, 6, 1, 20, 3, 'l'); rect(g, 10, 0, 14, 1, 'l');
    [[5, 8], [13, 5], [21, 7], [8, 13], [24, 13]].forEach(function (E) { rect(g, E[0], E[1], 4, 4, 'w'); rect(g, E[0] + 2, E[1] + 1, 2, 2, 'K'); });
    rect(g, 4, 18, 25, 6, 'K'); for (var x = 4; x < 29; x += 2) { px(g, x, 18, 'w'); px(g, x + 1, 23, 'w'); } rect(g, 13, 21, 8, 2, 's');
  });

  /* ================================================================== *
   *  more sections appended below
   * ================================================================== */
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

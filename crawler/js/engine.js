/* ============================================================
   DCW ENGINE - canvas, fixed-step loop, input, bitmap font,
   scenes, fades, shake/hitstop, save, utilities.
   Every other module hangs off window.DCW. See ../DESIGN.md.
   ============================================================ */
(function () {
  'use strict';
  var DCW = window.DCW = window.DCW || {};

  DCW.W = 320; DCW.H = 180; DCW.TILE = 16;
  DCW.dt = 1 / 60;
  DCW.t = 0; DCW.frame = 0;
  var qs = new URLSearchParams(location.search);
  DCW.params = qs;
  DCW.debug = qs.has('debug');

  /* ---------------- utilities ---------------- */
  var U = DCW.U = {
    clamp: function (v, a, b) { return v < a ? a : v > b ? b : v; },
    lerp: function (a, b, t) { return a + (b - a) * t; },
    sign: function (v) { return v < 0 ? -1 : v > 0 ? 1 : 0; },
    rand: function (a, b) { return a + Math.random() * (b - a); },
    randi: function (a, b) { return a + Math.floor(Math.random() * (b - a + 1)); },
    chance: function (p) { return Math.random() < p; },
    pick: function (arr) { return arr[Math.floor(Math.random() * arr.length)]; },
    shuffle: function (arr, rnd) {
      rnd = rnd || Math.random;
      for (var i = arr.length - 1; i > 0; i--) { var j = Math.floor(rnd() * (i + 1)); var t = arr[i]; arr[i] = arr[j]; arr[j] = t; }
      return arr;
    },
    rng: function (seed) { // mulberry32
      var a = seed >>> 0;
      return function () {
        a = (a + 0x6D2B79F5) >>> 0; var t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    },
    hash: function (str) { var h = 2166136261; for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; },
    overlap: function (a, b) { return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y; },
    approach: function (v, target, step) { return v < target ? Math.min(v + step, target) : Math.max(v - step, target); },
    weighted: function (pairs, rnd) { // [[item, weight], ...]
      rnd = rnd || Math.random; var tot = 0, i;
      for (i = 0; i < pairs.length; i++) tot += pairs[i][1];
      var r = rnd() * tot;
      for (i = 0; i < pairs.length; i++) { r -= pairs[i][1]; if (r <= 0) return pairs[i][0]; }
      return pairs[pairs.length - 1][0];
    },
    fmtTime: function (sec) { sec = Math.max(0, Math.floor(sec)); var m = Math.floor(sec / 60), s = sec % 60; return m + ':' + (s < 10 ? '0' : '') + s; },
    fmtNum: function (n) { n = Math.floor(n); if (n >= 1e6) return (n / 1e6).toFixed(n >= 1e7 ? 0 : 1) + 'M'; if (n >= 1e4) return Math.floor(n / 1e3) + 'K'; return String(n); }
  };

  /* ---------------- canvas ---------------- */
  var canvas, ctx;
  function setupCanvas() {
    canvas = document.getElementById('screen');
    canvas.width = DCW.W; canvas.height = DCW.H;
    ctx = canvas.getContext('2d', { alpha: false });
    ctx.imageSmoothingEnabled = false;
    DCW.canvas = canvas; DCW.ctx = ctx;
    window.addEventListener('resize', fit);
    window.addEventListener('orientationchange', function () { setTimeout(fit, 200); });
    fit();
  }
  function fit() {
    var wrap = document.getElementById('wrap');
    var vw = window.innerWidth, vh = window.innerHeight;
    var s = Math.min(vw / DCW.W, vh / DCW.H);
    if (s >= 2) s = Math.floor(s); // crisp integer scale when there is room
    var w = Math.floor(DCW.W * s), h = Math.floor(DCW.H * s);
    wrap.style.width = w + 'px'; wrap.style.height = h + 'px';
    DCW.scale = s;
  }

  /* ---------------- bitmap font (5x7 in a 6x8 cell) ---------------- */
  var GLYPHS = {
    'A': '.XXX. X...X X...X XXXXX X...X X...X X...X',
    'B': 'XXXX. X...X X...X XXXX. X...X X...X XXXX.',
    'C': '.XXX. X...X X.... X.... X.... X...X .XXX.',
    'D': 'XXXX. X...X X...X X...X X...X X...X XXXX.',
    'E': 'XXXXX X.... X.... XXXX. X.... X.... XXXXX',
    'F': 'XXXXX X.... X.... XXXX. X.... X.... X....',
    'G': '.XXX. X...X X.... X.XXX X...X X...X .XXXX',
    'H': 'X...X X...X X...X XXXXX X...X X...X X...X',
    'I': '.XXX. ..X.. ..X.. ..X.. ..X.. ..X.. .XXX.',
    'J': '..XXX ...X. ...X. ...X. ...X. X..X. .XX..',
    'K': 'X...X X..X. X.X.. XX... X.X.. X..X. X...X',
    'L': 'X.... X.... X.... X.... X.... X.... XXXXX',
    'M': 'X...X XX.XX X.X.X X.X.X X...X X...X X...X',
    'N': 'X...X X...X XX..X X.X.X X..XX X...X X...X',
    'O': '.XXX. X...X X...X X...X X...X X...X .XXX.',
    'P': 'XXXX. X...X X...X XXXX. X.... X.... X....',
    'Q': '.XXX. X...X X...X X...X X.X.X X..X. .XX.X',
    'R': 'XXXX. X...X X...X XXXX. X.X.. X..X. X...X',
    'S': '.XXXX X.... X.... .XXX. ....X ....X XXXX.',
    'T': 'XXXXX ..X.. ..X.. ..X.. ..X.. ..X.. ..X..',
    'U': 'X...X X...X X...X X...X X...X X...X .XXX.',
    'V': 'X...X X...X X...X X...X X...X .X.X. ..X..',
    'W': 'X...X X...X X...X X.X.X X.X.X X.X.X .X.X.',
    'X': 'X...X X...X .X.X. ..X.. .X.X. X...X X...X',
    'Y': 'X...X X...X .X.X. ..X.. ..X.. ..X.. ..X..',
    'Z': 'XXXXX ....X ...X. ..X.. .X... X.... XXXXX',
    '0': '.XXX. X...X X..XX X.X.X XX..X X...X .XXX.',
    '1': '..X.. .XX.. ..X.. ..X.. ..X.. ..X.. .XXX.',
    '2': '.XXX. X...X ....X ...X. ..X.. .X... XXXXX',
    '3': 'XXXXX ...X. ..X.. ...X. ....X X...X .XXX.',
    '4': '...X. ..XX. .X.X. X..X. XXXXX ...X. ...X.',
    '5': 'XXXXX X.... XXXX. ....X ....X X...X .XXX.',
    '6': '..XX. .X... X.... XXXX. X...X X...X .XXX.',
    '7': 'XXXXX ....X ...X. ..X.. .X... .X... .X...',
    '8': '.XXX. X...X X...X .XXX. X...X X...X .XXX.',
    '9': '.XXX. X...X X...X .XXXX ....X ...X. .XX..',
    '.': '..... ..... ..... ..... ..... .XX.. .XX..',
    ',': '..... ..... ..... ..... .XX.. ..X.. .X...',
    '!': '..X.. ..X.. ..X.. ..X.. ..X.. ..... ..X..',
    '?': '.XXX. X...X ....X ...X. ..X.. ..... ..X..',
    "'": '..X.. ..X.. .X... ..... ..... ..... .....',
    '"': '.X.X. .X.X. ..... ..... ..... ..... .....',
    ':': '..... .XX.. .XX.. ..... .XX.. .XX.. .....',
    ';': '..... .XX.. .XX.. ..... .XX.. ..X.. .X...',
    '-': '..... ..... ..... .XXX. ..... ..... .....',
    '+': '..... ..X.. ..X.. XXXXX ..X.. ..X.. .....',
    '/': '....X ....X ...X. ..X.. .X... X.... X....',
    '\\': 'X.... X.... .X... ..X.. ...X. ....X ....X',
    '(': '...X. ..X.. .X... .X... .X... ..X.. ...X.',
    ')': '.X... ..X.. ...X. ...X. ...X. ..X.. .X...',
    '%': 'XX..X XX..X ...X. ..X.. .X... X..XX X..XX',
    '*': '..... X.X.X .XXX. XXXXX .XXX. X.X.X .....',
    '#': '.X.X. .X.X. XXXXX .X.X. XXXXX .X.X. .X.X.',
    '$': '..X.. .XXXX X.X.. .XXX. ..X.X XXXX. ..X..',
    '<': '...X. ..X.. .X... X.... .X... ..X.. ...X.',
    '>': '.X... ..X.. ...X. ....X ...X. ..X.. .X...',
    '=': '..... ..... XXXXX ..... XXXXX ..... .....',
    '_': '..... ..... ..... ..... ..... ..... XXXXX',
    '&': '.XX.. X..X. X.X.. .X... X.X.X X..X. .XX.X',
    '@': '.XXX. X...X X.XXX X.X.X X.XXX X.... .XXXX',
    '[': '.XXX. .X... .X... .X... .X... .X... .XXX.',
    ']': '.XXX. ...X. ...X. ...X. ...X. ...X. .XXX.',
    '~': '..... ..... .X... X.X.X ...X. ..... .....',
    '|': '..X.. ..X.. ..X.. ..X.. ..X.. ..X.. ..X..',
    '♥': '..... .X.X. XXXXX XXXXX .XXX. ..X.. .....', // heart
    '▶': '.X... .XX.. .XXX. .XXXX .XXX. .XX.. .X...', // cursor right
    '◀': '...X. ..XX. .XXX. XXXX. .XXX. ..XX. ...X.', // cursor left
    '▼': '..... ..... XXXXX .XXX. ..X.. ..... .....', // continue
    '▲': '..... ..... ..X.. .XXX. XXXXX ..... .....',
    '★': '..X.. ..X.. XXXXX .XXX. .XXX. .X.X. X...X', // star
    '×': '..... X...X .X.X. ..X.. .X.X. X...X .....', // times
    '↑': '..X.. .XXX. X.X.X ..X.. ..X.. ..X.. ..X..',
    '↓': '..X.. ..X.. ..X.. ..X.. X.X.X .XXX. ..X..',
    '←': '..... ..X.. .X... XXXXX .X... ..X.. .....',
    '→': '..... ..X.. ...X. XXXXX ...X. ..X.. .....',
    '●': '..... .XXX. XXXXX XXXXX XXXXX .XXX. .....', // dot / coin
    '☠': '.XXX. XXXXX X.X.X XXXXX .XXX. .X.X. .....', // skull
    '✓': '..... ....X ...XX X.XX. XXX.. .X... .....'  // check
  };
  var CHARS = Object.keys(GLYPHS);
  var GW = 6, GH = 8; // cell
  var fontWhite = null, fontCache = {}, glyphIndex = {};
  function buildFont() {
    fontWhite = document.createElement('canvas');
    fontWhite.width = CHARS.length * GW; fontWhite.height = GH;
    var g = fontWhite.getContext('2d');
    g.fillStyle = '#fff';
    CHARS.forEach(function (ch, i) {
      glyphIndex[ch] = i;
      var rows = GLYPHS[ch].split(' ');
      for (var y = 0; y < 7; y++) for (var x = 0; x < 5; x++) if (rows[y].charAt(x) === 'X') g.fillRect(i * GW + x, y, 1, 1);
    });
  }
  function fontFor(color) {
    var c = fontCache[color];
    if (c) return c;
    c = document.createElement('canvas'); c.width = fontWhite.width; c.height = fontWhite.height;
    var g = c.getContext('2d');
    g.drawImage(fontWhite, 0, 0);
    g.globalCompositeOperation = 'source-in';
    g.fillStyle = color; g.fillRect(0, 0, c.width, c.height);
    fontCache[color] = c;
    return c;
  }
  DCW.textWidth = function (str, scale) { scale = scale || 1; return String(str).length * GW * scale - scale; };
  DCW.wrapText = function (str, maxWidth, scale) {
    scale = scale || 1;
    var maxChars = Math.max(1, Math.floor((maxWidth + scale) / (GW * scale)));
    var out = [];
    String(str).split('\n').forEach(function (para) {
      var words = para.split(' '), line = '';
      words.forEach(function (w) {
        while (w.length > maxChars) { // hard-break very long words
          if (line) { out.push(line); line = ''; }
          out.push(w.slice(0, maxChars)); w = w.slice(maxChars);
        }
        var test = line ? line + ' ' + w : w;
        if (test.length > maxChars) { out.push(line); line = w; } else line = test;
      });
      out.push(line);
    });
    return out;
  };
  // DCW.text(str, x, y, color, {align, shadow, scale, wrap, lineH})
  DCW.text = function (str, x, y, color, opts) {
    opts = opts || {};
    var c = DCW.ctx, scale = opts.scale || 1;
    var lines = opts.wrap ? DCW.wrapText(str, opts.wrap, scale) : String(str).split('\n');
    var lineH = (opts.lineH || GH + 2) * scale;
    var maxW = 0;
    for (var li = 0; li < lines.length; li++) {
      var s = lines[li].toUpperCase();
      var w = DCW.textWidth(s, scale); if (w > maxW) maxW = w;
      var sx = x;
      if (opts.align === 'center') sx = Math.round(x - w / 2);
      else if (opts.align === 'right') sx = Math.round(x - w);
      var sy = Math.round(y + li * lineH);
      if (opts.shadow !== null && opts.shadow !== false) drawLine(c, s, sx + scale, sy + scale, opts.shadow || '#000', scale);
      drawLine(c, s, sx, sy, color || '#fff', scale);
    }
    return { w: maxW, h: lines.length * lineH };
  };
  function drawLine(c, s, x, y, color, scale) {
    var atlas = fontFor(color);
    for (var i = 0; i < s.length; i++) {
      var gi = glyphIndex[s.charAt(i)];
      if (gi === undefined) continue; // space / unknown
      c.drawImage(atlas, gi * GW, 0, GW, GH, x + i * GW * scale, y, GW * scale, GH * scale);
    }
  }

  /* ---------------- draw helpers ---------------- */
  DCW.rect = function (x, y, w, h, color) { DCW.ctx.fillStyle = color; DCW.ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };
  // NES-style window: dark fill, light outer border, darker inner border
  DCW.box = function (x, y, w, h, o) {
    o = o || {};
    var c = DCW.ctx; x = Math.round(x); y = Math.round(y); w = Math.round(w); h = Math.round(h);
    c.fillStyle = o.border2 || '#000'; c.fillRect(x - 1, y - 1, w + 2, h + 2);
    c.fillStyle = o.border || '#fcfcfc'; c.fillRect(x, y, w, h);
    c.fillStyle = o.border2 || '#000'; c.fillRect(x + 1, y + 1, w - 2, h - 2);
    c.fillStyle = o.fill || '#0f1630'; c.fillRect(x + 2, y + 2, w - 4, h - 4);
  };
  DCW.bar = function (x, y, w, h, frac, color, back) {
    DCW.rect(x - 1, y - 1, w + 2, h + 2, '#000');
    DCW.rect(x, y, w, h, back || '#3a1020');
    DCW.rect(x, y, Math.round(w * U.clamp(frac, 0, 1)), h, color || '#e83030');
  };

  /* ---------------- input ---------------- */
  var BUTTONS = ['left', 'right', 'up', 'down', 'jump', 'attack', 'bomb', 'special', 'potion', 'start', 'select', 'confirm', 'back'];
  // Rebindable keyboard. Each gameplay action holds two key slots; menus derive from them:
  // confirm = jump keys (+ Enter), back = attack keys (+ Esc / Backspace). Enter, Esc and
  // Backspace are reserved so menus can never become unreachable.
  var ACTIONS = ['left', 'right', 'up', 'down', 'jump', 'attack', 'bomb', 'special', 'potion', 'start', 'select'];
  var PRESETS = {
    classic: { left: ['ArrowLeft', 'KeyA'], right: ['ArrowRight', 'KeyD'], up: ['ArrowUp', 'KeyW'], down: ['ArrowDown', 'KeyS'],
      jump: ['KeyZ', 'Space'], attack: ['KeyX', 'KeyJ'], bomb: ['KeyC', 'KeyL'], special: ['KeyV', 'ShiftLeft'],
      potion: ['KeyQ', 'KeyU'], start: ['KeyP', null], select: ['Tab', 'KeyM'] },
    wasd: { left: ['KeyA', 'ArrowLeft'], right: ['KeyD', 'ArrowRight'], up: ['KeyW', 'ArrowUp'], down: ['KeyS', 'ArrowDown'],
      jump: ['Space', 'KeyK'], attack: ['KeyJ', null], bomb: ['KeyL', null], special: ['KeyI', 'ShiftLeft'],
      potion: ['KeyQ', 'KeyU'], start: ['KeyP', null], select: ['Tab', 'KeyM'] },
    arrows: { left: ['ArrowLeft', null], right: ['ArrowRight', null], up: ['ArrowUp', null], down: ['ArrowDown', null],
      jump: ['Space', 'KeyA'], attack: ['KeyF', 'KeyS'], bomb: ['KeyD', null], special: ['KeyE', 'ShiftLeft'],
      potion: ['KeyQ', null], start: ['KeyP', null], select: ['Tab', 'KeyM'] }
  };
  var RESERVED = { Enter: ['start', 'confirm'], Escape: ['back', 'start'], Backspace: ['back'] };
  var KEYMAP = {};
  function copyBinds(src) { var o = {}; ACTIONS.forEach(function (a) { var v = (src && src[a]) || [null, null]; o[a] = [v[0] || null, v[1] || null]; }); return o; }
  function currentBinds() {
    var st = DCW.save && DCW.save.settings;
    return copyBinds((st && st.keys) || PRESETS.classic);
  }
  function rebuildKeymap() {
    var b = currentBinds();
    KEYMAP = {};
    Object.keys(RESERVED).forEach(function (c) { KEYMAP[c] = RESERVED[c].slice(); });
    ACTIONS.forEach(function (a) {
      b[a].forEach(function (code) {
        if (!code || RESERVED[code]) return;
        var list = KEYMAP[code] = KEYMAP[code] || [];
        if (list.indexOf(a) < 0) list.push(a);
        if (a === 'jump' && list.indexOf('confirm') < 0) list.push('confirm');
        if (a === 'attack' && list.indexOf('back') < 0) list.push('back');
      });
    });
    // drop anything held under the old map so no button sticks down
    heldKeys = {}; BUTTONS.forEach(function (bt) { kb[bt] = 0; });
  }
  var KEY_NAMES = { Space: 'SPACE', ShiftLeft: 'L-SHIFT', ShiftRight: 'R-SHIFT', ControlLeft: 'L-CTRL', ControlRight: 'R-CTRL',
    AltLeft: 'L-ALT', AltRight: 'R-ALT', Tab: 'TAB', CapsLock: 'CAPS', Enter: 'ENTER', Escape: 'ESC', Backspace: 'BKSP',
    ArrowLeft: '\u2190', ArrowRight: '\u2192', ArrowUp: '\u2191', ArrowDown: '\u2193', Semicolon: ';', Quote: "'", Comma: ',',
    Period: '.', Slash: '/', Backslash: '\\', BracketLeft: '[', BracketRight: ']', Minus: '-', Equal: '=', Backquote: '~',
    Insert: 'INS', Delete: 'DEL', Home: 'HOME', End: 'END', PageUp: 'PGUP', PageDown: 'PGDN', ContextMenu: 'MENU' };
  function keyName(code) {
    if (!code) return '---';
    if (KEY_NAMES[code]) return KEY_NAMES[code];
    var m = /^Key([A-Z])$/.exec(code); if (m) return m[1];
    m = /^Digit(\d)$/.exec(code); if (m) return m[1];
    m = /^Numpad(.+)$/.exec(code); if (m) return 'NUM' + (m[1].length > 3 ? m[1].slice(0, 3).toUpperCase() : m[1].toUpperCase());
    return code.toUpperCase().slice(0, 7);
  }
  var captureCb = null;
  var kb = {}, kbHit = {}, touch = {}, pad = {}, cur = {}, prev = {};
  BUTTONS.forEach(function (b) { kb[b] = 0; kbHit[b] = false; touch[b] = false; pad[b] = false; cur[b] = false; prev[b] = false; });
  var input = DCW.input = {
    locked: false,
    down: function (b) { return !input.locked && cur[b]; },
    pressed: function (b) { return !input.locked && cur[b] && !prev[b]; },
    released: function (b) { return !input.locked && !cur[b] && prev[b]; },
    any: function () { if (input.locked) return false; for (var i = 0; i < BUTTONS.length; i++) if (cur[BUTTONS[i]] && !prev[BUTTONS[i]]) return true; return false; },
    axisX: function () { return (input.down('right') ? 1 : 0) - (input.down('left') ? 1 : 0); },
    axisY: function () { return (input.down('down') ? 1 : 0) - (input.down('up') ? 1 : 0); },
    consume: function () { BUTTONS.forEach(function (b) { prev[b] = cur[b]; }); }, // swallow presses this frame
    usingTouch: false,
    lastDevice: 'keyboard',
    actions: ACTIONS,
    presets: PRESETS,
    keyName: keyName,
    bindings: function () { return currentBinds(); },
    rebuild: function () { rebuildKeymap(); },
    // bind code to action slot; the code is removed from wherever else it was bound
    setBinding: function (action, slot, code) {
      var b = currentBinds();
      if (code) ACTIONS.forEach(function (a) { for (var i = 0; i < 2; i++) if (b[a][i] === code) b[a][i] = null; });
      b[action][slot] = code || null;
      if (DCW.save) { DCW.save.settings.keys = b; DCW.persist(); }
      rebuildKeymap();
    },
    applyPreset: function (name) {
      if (!PRESETS[name]) return;
      if (DCW.save) { DCW.save.settings.keys = copyBinds(PRESETS[name]); DCW.save.settings.keyPreset = name; DCW.persist(); }
      rebuildKeymap();
    },
    captureNext: function (cb) { captureCb = cb; },
    cancelCapture: function () { captureCb = null; },
    capturing: function () { return !!captureCb; }
  };
  var heldKeys = {};
  window.addEventListener('keydown', function (e) {
    unlockAudio();
    if (captureCb) {
      e.preventDefault();
      if (e.repeat) return;
      var cb = captureCb; captureCb = null;
      if (e.code === 'Escape') cb(null, 'cancel');
      else if (e.code === 'Backspace' || e.code === 'Delete') cb(null, 'clear');
      else if (e.code === 'Enter' || e.code.indexOf('Meta') === 0 || e.code.indexOf('OS') === 0) { captureCb = cb; }
      else cb(e.code, 'set');
      return;
    }
    var m = KEYMAP[e.code];
    if (!m) return;
    e.preventDefault();
    input.lastDevice = 'keyboard';
    if (heldKeys[e.code]) return;
    heldKeys[e.code] = true;
    m.forEach(function (b) { kb[b]++; kbHit[b] = true; });
  });
  window.addEventListener('keyup', function (e) {
    var m = KEYMAP[e.code];
    if (!m) return;
    e.preventDefault();
    if (!heldKeys[e.code]) return;
    heldKeys[e.code] = false;
    m.forEach(function (b) { kb[b] = Math.max(0, kb[b] - 1); });
  });
  window.addEventListener('blur', function () {
    heldKeys = {}; BUTTONS.forEach(function (b) { kb[b] = 0; touch[b] = false; });
  });
  function pollPad() {
    BUTTONS.forEach(function (b) { pad[b] = false; });
    if (!navigator.getGamepads) return;
    var pads = navigator.getGamepads();
    for (var i = 0; i < pads.length; i++) {
      var p = pads[i]; if (!p || !p.connected) continue;
      var B = function (n) { return p.buttons[n] && p.buttons[n].pressed; };
      var ax = p.axes[0] || 0, ay = p.axes[1] || 0;
      if (B(14) || ax < -0.4) pad.left = true;
      if (B(15) || ax > 0.4) pad.right = true;
      if (B(12) || ay < -0.5) pad.up = true;
      if (B(13) || ay > 0.5) pad.down = true;
      if (B(0)) { pad.jump = true; pad.confirm = true; }
      if (B(2)) pad.attack = true;
      if (B(1)) { pad.bomb = true; pad.back = true; }
      if (B(3)) pad.special = true;
      if (B(4) || B(5) || B(6) || B(7)) pad.potion = true;
      if (B(9)) { pad.start = true; }
      if (B(8)) pad.select = true;
      for (var k = 0; k < p.buttons.length; k++) if (p.buttons[k] && p.buttons[k].pressed) { input.lastDevice = 'pad'; break; }
    }
  }
  function sampleInput() {
    pollPad();
    BUTTONS.forEach(function (b) {
      prev[b] = cur[b];
      cur[b] = kb[b] > 0 || kbHit[b] || touch[b] || pad[b];
      kbHit[b] = false;
    });
    // a key tapped and released between two frames still registers once
  }

  /* ---------------- touch controls (DOM overlay) ---------------- */
  function setupTouch() {
    var root = document.getElementById('touch');
    if (!root) return;
    var isTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0 && matchMedia('(pointer: coarse)').matches);
    DCW.applyTouchSetting = function () {
      var mode = (DCW.save && DCW.save.settings && DCW.save.settings.touch) || 'auto';
      var show = mode === 'on' || (mode === 'auto' && (isTouch || input.usingTouch));
      root.style.display = show ? 'block' : 'none';
    };
    var active = {}; // pointerId -> [buttons]
    function setFrom() {
      BUTTONS.forEach(function (b) { touch[b] = false; });
      Object.keys(active).forEach(function (id) { active[id].forEach(function (b) { touch[b] = true; }); });
    }
    function btnsAt(el, cx, cy) {
      if (!el) return [];
      if (el.dataset.pad) {
        var r = el.getBoundingClientRect();
        var dx = cx - (r.left + r.width / 2), dy = cy - (r.top + r.height / 2);
        var out = [], dead = r.width * 0.14;
        if (Math.abs(dx) > dead && Math.abs(dx) > Math.abs(dy) * 0.45) out.push(dx < 0 ? 'left' : 'right');
        if (Math.abs(dy) > dead && Math.abs(dy) > Math.abs(dx) * 0.45) out.push(dy < 0 ? 'up' : 'down');
        return out;
      }
      return (el.dataset.btn || '').split(',').filter(Boolean);
    }
    function targetAt(x, y) {
      var el = document.elementFromPoint(x, y);
      while (el && el !== root && !(el.dataset && (el.dataset.btn || el.dataset.pad))) el = el.parentElement;
      return el === root ? null : el;
    }
    function onDown(e) {
      unlockAudio();
      input.usingTouch = true; input.lastDevice = 'touch';
      var t = targetAt(e.clientX, e.clientY);
      if (!t) return;
      e.preventDefault();
      var list = btnsAt(t, e.clientX, e.clientY); list.el = t;
      active[e.pointerId] = list;
      list.forEach(function (b) { kbHit[b] = true; });
      setFrom();
      try { root.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    }
    function onMove(e) {
      if (!active[e.pointerId]) return;
      e.preventDefault();
      var el = active[e.pointerId].el;
      var t = el && el.dataset.pad ? el : targetAt(e.clientX, e.clientY);
      var list = btnsAt(t, e.clientX, e.clientY); list.el = el;
      active[e.pointerId] = list;
      setFrom();
    }
    function onUp(e) { if (active[e.pointerId]) { delete active[e.pointerId]; setFrom(); } }
    root.addEventListener('pointerdown', onDown, { passive: false });
    root.addEventListener('pointermove', onMove, { passive: false });
    root.addEventListener('pointerup', onUp);
    root.addEventListener('pointercancel', onUp);
    root.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    DCW.applyTouchSetting();
  }

  /* ---------------- audio unlock hook ---------------- */
  var audioUnlocked = false;
  function unlockAudio() {
    if (audioUnlocked) return;
    if (DCW.audio && DCW.audio.unlock) { try { DCW.audio.unlock(); audioUnlocked = true; } catch (e) { /* retry next gesture */ } }
  }
  window.addEventListener('pointerdown', unlockAudio);

  /* ---------------- save ---------------- */
  var SAVE_KEY = 'dcw_save_v1';
  function defaultSave() {
    return {
      version: 1,
      unlocks: { skins: ['carl_boxers'], companions: ['donut'] },
      equipped: { skin: 'carl_boxers', companion: 'donut' },
      run: null,
      meta: { achievements: {}, counters: {}, bestFloor: 0, runs: 0, wins: 0, deaths: 0, boxesOpened: 0, seenIntro: false },
      settings: { music: 0.55, sfx: 0.8, shake: true, crt: true, touch: 'auto', easy: false }
    };
  }
  function merge(base, over) {
    if (!over || typeof over !== 'object') return base;
    Object.keys(over).forEach(function (k) {
      if (base[k] && typeof base[k] === 'object' && !Array.isArray(base[k]) && over[k] && typeof over[k] === 'object' && !Array.isArray(over[k])) merge(base[k], over[k]);
      else base[k] = over[k];
    });
    return base;
  }
  DCW.loadSave = function () {
    var s = defaultSave();
    try { var raw = localStorage.getItem(SAVE_KEY); if (raw) s = merge(s, JSON.parse(raw)); } catch (e) { /* storage blocked: play without saving */ }
    DCW.save = s;
    return s;
  };
  DCW.persist = function () { try { localStorage.setItem(SAVE_KEY, JSON.stringify(DCW.save)); } catch (e) { /* ignore */ } };
  DCW.resetSave = function () { DCW.save = defaultSave(); DCW.persist(); if (DCW.input && DCW.input.rebuild) DCW.input.rebuild(); };

  /* ---------------- scenes, fade, shake, hitstop ---------------- */
  DCW.scene = null;
  DCW.setScene = function (scene, params) {
    var old = DCW.scene;
    if (old && old.exit) { try { old.exit(); } catch (e) { console.error(e); } }
    DCW.scene = scene;
    if (scene && scene.enter) scene.enter(params || {});
  };
  var fade = { a: 0, dir: 0, cb: null, speed: 4, color: '#000' };
  DCW.fade = function (cb, opts) {
    opts = opts || {};
    fade.dir = 1; fade.cb = cb; fade.speed = 1 / (opts.time || 0.25); fade.color = opts.color || '#000';
    input.locked = true;
  };
  DCW.fading = function () { return fade.dir !== 0; };
  var shake = { mag: 0, t: 0 };
  DCW.shake = function (mag, time) {
    if (DCW.save && DCW.save.settings && DCW.save.settings.shake === false) return;
    if (mag >= shake.mag || shake.t <= 0) { shake.mag = mag; shake.t = time || 0.2; }
  };
  var freezeFrames = 0;
  DCW.freeze = function (frames) { freezeFrames = Math.max(freezeFrames, frames); };

  /* ---------------- loop ---------------- */
  var acc = 0, last = 0, fpsT = 0, fpsN = 0, fps = 60;
  function step() {
    sampleInput();
    var ui = DCW.ui;
    if (ui && ui.update) { try { ui.update(DCW.dt); } catch (e) { console.error(e); } }
    var blocked = ui && ui.blocking && ui.blocking();
    if (freezeFrames > 0) freezeFrames--;
    else if (!blocked && DCW.scene && DCW.scene.update) DCW.scene.update(DCW.dt);
    else if (blocked && DCW.scene && DCW.scene.idle) DCW.scene.idle(DCW.dt);
    if (fade.dir === 1) {
      fade.a += fade.speed * DCW.dt;
      if (fade.a >= 1) { fade.a = 1; fade.dir = -1; var cb = fade.cb; fade.cb = null; if (cb) cb(); }
    } else if (fade.dir === -1) {
      fade.a -= fade.speed * DCW.dt;
      if (fade.a <= 0) { fade.a = 0; fade.dir = 0; input.locked = false; }
    }
    if (shake.t > 0) shake.t -= DCW.dt;
    DCW.t += DCW.dt; DCW.frame++;
  }
  function render() {
    var c = ctx;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.globalAlpha = 1;
    c.fillStyle = '#000'; c.fillRect(0, 0, DCW.W, DCW.H);
    c.save();
    if (shake.t > 0) c.translate(Math.round(U.rand(-shake.mag, shake.mag)), Math.round(U.rand(-shake.mag, shake.mag)));
    if (DCW.scene && DCW.scene.draw) DCW.scene.draw(c);
    c.restore();
    c.globalAlpha = 1;
    if (DCW.ui && DCW.ui.draw) DCW.ui.draw(c);
    if (fade.a > 0) { c.globalAlpha = fade.a; c.fillStyle = fade.color; c.fillRect(0, 0, DCW.W, DCW.H); c.globalAlpha = 1; }
    if (DCW.debug) DCW.text(fps + 'FPS', DCW.W - 2, DCW.H - 9, '#0f0', { align: 'right' });
  }
  function loop(ts) {
    requestAnimationFrame(loop);
    if (!last) last = ts;
    var el = Math.min(0.25, (ts - last) / 1000); last = ts;
    acc += el;
    var n = 0;
    while (acc >= DCW.dt && n < 5) {
      try { step(); } catch (e) { console.error(e); }
      acc -= DCW.dt; n++;
    }
    if (n === 5) acc = 0;
    try { render(); } catch (e) { console.error(e); }
    fpsN++; fpsT += el; if (fpsT >= 1) { fps = fpsN; fpsN = 0; fpsT = 0; }
  }
  // Headless test hook: advance the simulation n frames synchronously.
  DCW.stepFrames = function (n) { for (var i = 0; i < n; i++) step(); render(); };
  DCW.pressKey = function (btn, frames) { // test helper: hold a logical button for N frames
    kb[btn]++; kbHit[btn] = true; DCW.stepFrames(frames || 1); kb[btn] = Math.max(0, kb[btn] - 1);
  };

  DCW.boot = function () {
    setupCanvas();
    buildFont();
    DCW.loadSave();
    rebuildKeymap();
    setupTouch();
    applyCrt();
    if (DCW.art && DCW.art.init) DCW.art.init();
    if (DCW.audio && DCW.audio.init) DCW.audio.init();
    if (DCW.ui && DCW.ui.init) DCW.ui.init();
    if (DCW.stage && DCW.stage.init) DCW.stage.init();
    if (DCW.overworld && DCW.overworld.init) DCW.overworld.init();
    if (DCW.game && DCW.game.init) DCW.game.init();
    else DCW.setScene({ draw: function () { DCW.text('ENGINE OK', 160, 86, '#fff', { align: 'center' }); } });
    requestAnimationFrame(loop);
  };
  function applyCrt() {
    DCW.applyCrt = function () {
      var on = DCW.save.settings.crt !== false;
      document.body.classList.toggle('crt', on);
    };
    DCW.applyCrt();
  }
  document.addEventListener('visibilitychange', function () {
    if (document.hidden && DCW.audio && DCW.audio.suspend) DCW.audio.suspend();
    else if (!document.hidden && DCW.audio && DCW.audio.resume) DCW.audio.resume();
    last = 0;
  });
})();

/* ============================================================
   DUNGEON CRAWLER CARL: BOOK ONE - UI
   Modal stack, dialog, toasts, banners, menus, HUD, pause +
   sub-screens (character, loot boxes, gear, achievements,
   settings, controls, shop, how-to) and the non-gameplay scenes
   (title, cutscene player, intro, name entry, floor card,
   results, death, safe room, ending).
   Strict 8-bit: NES 2C02 colors only, NES windows, no alpha
   (DCW.fade is the only fade), no gradients, no smooth shapes.
   Contract: ../DESIGN.md "UI (ui.js, ui)" + inherited UI contract.
   Every call into game/art/audio/data is feature-detected.
   ============================================================ */
(function () {
  'use strict';
  var DCW = window.DCW = window.DCW || {};
  var ui = DCW.ui = DCW.ui || {};
  var U = DCW.U || {};
  var W = 320, H = 180;

  /* ---------------- NES palette ---------------- */
  // the FCEUX-style 2C02 table (same values as C in art_actors.js); nothing else is drawn
  var NES = ['#000000', '#fcfcfc', '#7c7c7c', '#bcbcbc', '#f8f8f8', '#787878',
    '#0000fc', '#0000bc', '#0078f8', '#0058f8', '#3cbcfc', '#6888fc', '#a4e4fc', '#b8b8f8',
    '#4428bc', '#6844fc', '#9878f8', '#d8b8f8', '#940084', '#d800cc', '#f878f8', '#f8b8f8',
    '#a80020', '#e40058', '#f85898', '#f8a4c0', '#a81000', '#f83800', '#f87858', '#f0d0b0',
    '#881400', '#e45c10', '#fca044', '#fce0a8', '#503000', '#ac7c00', '#f8b800', '#f8d878',
    '#007800', '#00b800', '#b8f818', '#d8f878', '#006800', '#00a800', '#58d854', '#b8f8b8',
    '#005800', '#00a844', '#58f898', '#b8f8d8', '#004058', '#008888', '#00e8d8', '#00fcfc'];
  var C = {
    white: '#fcfcfc', lgray: '#f8f8f8', gray: '#bcbcbc', dgray: '#7c7c7c', ddgray: '#004058', black: '#000000',
    red: '#f83800', dred: '#a81000', crimson: '#a80020', gold: '#f8b800', yellow: '#f8d878', green: '#58d854', dgreen: '#00a800', ddgreen: '#005800',
    blue: '#3cbcfc', dblue: '#0058f8', navy: '#0000bc', purple: '#d800cc', dpurple: '#4428bc', violet: '#9878f8', pink: '#f878f8', orange: '#fca044',
    rust: '#e45c10', brown: '#881400', dbrown: '#503000', tan: '#ac7c00', skin: '#fce0a8', cyan: '#00e8d8', teal: '#008888',
    fill: '#000000', sel: '#0000bc', line: '#0000bc'
  };
  ui.colors = C;
  ui.NES = NES;
  // snap any css color (data-provided box colors etc.) to the nearest NES entry
  var nesCache = {};
  function nes(c) {
    if (!c || typeof c !== 'string') return C.white;
    var k = c.toLowerCase();
    if (nesCache[k]) return nesCache[k];
    var m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/.exec(k);
    if (!m) { nesCache[k] = C.white; return C.white; }
    var h = m[1].length === 3 ? m[1].replace(/(.)/g, '$1$1') : m[1];
    var r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
    var best = NES[0], bd = 1e9;
    NES.forEach(function (n) {
      var nr = parseInt(n.slice(1, 3), 16), ng = parseInt(n.slice(3, 5), 16), nb = parseInt(n.slice(5, 7), 16);
      var d = (nr - r) * (nr - r) * 3 + (ng - g) * (ng - g) * 4 + (nb - b) * (nb - b) * 2;
      if (d < bd) { bd = d; best = n; }
    });
    nesCache[k] = best;
    return best;
  }
  ui.nes = nes;

  /* ---------------- defensive plumbing ---------------- */
  var MISSING = { missing: true };
  function tryCall(obj, name, args) {
    if (!obj || typeof obj[name] !== 'function') return MISSING;
    try { return obj[name].apply(obj, args || []); } catch (e) { console.error('[ui] ' + name + ' failed', e); return MISSING; }
  }
  function G(name) { var r = tryCall(DCW.game, name, [].slice.call(arguments, 1)); return r === MISSING ? undefined : r; }
  function hasG(name) { return !!(DCW.game && typeof DCW.game[name] === 'function'); }
  function sfx(n, o) { tryCall(DCW.audio, 'sfx', [n, o]); }
  function music(t) { tryCall(DCW.audio, 'music', [t]); }
  function curMusic() { try { return (DCW.audio && DCW.audio.current) || null; } catch (e) { return null; } }
  function D(k) { return (DCW.data && DCW.data[k]) || null; }
  function getRun() {
    var r = null;
    try { r = DCW.game ? DCW.game.run : null; } catch (e) { r = null; }
    if (r === undefined || r === null) r = (DCW.save && DCW.save.run) || null;
    return r;
  }
  function floorDef(n) {
    var f = G('floorDef', n);
    if (f) return f;
    var run = getRun(), fl = D('floors');
    n = n || (run ? run.floor : 1);
    return (fl && fl[n - 1]) || null;
  }
  function stageDef(id) { var s = D('stages'); return (s && s[id]) || null; }
  function pick(arr) { return arr && arr.length ? arr[Math.floor(Math.random() * arr.length)] : null; }
  function aiLine(key, fb) { var ai = D('ai'); var l = ai && pick(ai[key]); return l || fb; }
  function persist() { if (typeof DCW.persist === 'function') DCW.persist(); }
  function fmtNum(n) { n = +n || 0; return U.fmtNum ? U.fmtNum(n) : String(Math.floor(n)); }
  function fmtTime(s) { return U.fmtTime ? U.fmtTime(s || 0) : String(Math.floor(s || 0)); }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function hash(s) { if (U.hash) return U.hash(String(s)); var h = 7; s = String(s); for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h; }
  function save() { return DCW.save || { unlocks: { skins: ['carl_boxers'], companions: ['donut'] }, equipped: { skin: 'carl_boxers', companion: 'donut' }, meta: { achievements: {}, counters: {} }, settings: {} }; }
  function equipped(kind) { var s = save(); return (s.equipped && s.equipped[kind]) || (kind === 'skin' ? 'carl_boxers' : 'donut'); }
  function flag(id) { return !!G('flag', id); }
  function viewersOn() { var v = G('viewersOn'); if (v === undefined) { var f = floorDef(); return !(f && f.viewers === false); } return !!v; }
  function biscuits() { var b = G('biscuits'); if (typeof b === 'number') return b; var r = getRun(); return (r && r.biscuits) || 0; }

  /* ---------------- input ---------------- */
  function I() { return DCW.input || { pressed: function () { return false; }, down: function () { return false; } }; }
  function P(b) { return I().pressed(b); }
  // Enter is both START and CONFIRM. Skipping a whole cutscene or dialog needs START on its own
  // (Esc, P, a gamepad Start, the touch START button), so Enter only ever advances the text.
  function skipP() { return P('start') && !P('confirm'); }
  function skipName() { var dev = (DCW.input && DCW.input.lastDevice) || 'keyboard'; return dev === 'keyboard' ? 'ESC' : 'START'; }
  function Dn(b) { return I().down(b); }
  function consume() { if (DCW.input && DCW.input.consume) DCW.input.consume(); }
  // pressed, or auto-repeat while held
  function rep(m, b, dt) {
    m._rep = m._rep || {};
    if (P(b)) { m._rep[b] = 0; return true; }
    if (Dn(b)) { m._rep[b] = (m._rep[b] || 0) + dt; if (m._rep[b] > 0.36) { m._rep[b] -= 0.085; return true; } }
    else m._rep[b] = 0;
    return false;
  }
  function listNav(m, n, dt, wrap, skip) {
    if (n <= 0) { m.sel = 0; return 0; }
    var d = 0;
    if (rep(m, 'up', dt)) d = -1; else if (rep(m, 'down', dt)) d = 1;
    if (d) {
      var s = m.sel || 0;
      for (var k = 0; k < n; k++) {
        s += d;
        if (wrap === false) s = clamp(s, 0, n - 1); else s = (s + n) % n;
        if (!skip || !skip(s)) break;
      }
      if (skip && skip(s)) s = m.sel;
      if (s !== m.sel) sfx('menu_move');
      m.sel = s;
    }
    if (m.sel >= n) m.sel = n - 1;
    if (m.sel < 0) m.sel = 0;
    return d;
  }
  function scrollTo(m, vis, n) {
    m.scroll = m.scroll || 0;
    if (m.sel < m.scroll) m.scroll = m.sel;
    if (m.sel >= m.scroll + vis) m.scroll = m.sel - vis + 1;
    m.scroll = clamp(m.scroll, 0, Math.max(0, n - vis));
  }
  function backPressed() { return P('back'); }
  // button names for prompts, by last used device
  function bn(b) {
    var dev = (DCW.input && DCW.input.lastDevice) || 'keyboard';
    var map = dev === 'keyboard'
      ? { confirm: kbName('jump', 'Z'), back: kbName('attack', 'X'), start: 'ENTER', select: kbName('select', 'TAB'), special: kbName('special', 'V'), down: '↓', up: '↑' }
      : dev === 'touch'
        ? { confirm: 'A', back: 'B', start: 'START', select: 'SELECT', special: 'SPC', down: '↓', up: '↑' }
        : { confirm: 'A', back: 'B', start: 'START', select: 'SELECT', special: 'Y', down: '↓', up: '↑' };
    return map[b] || b.toUpperCase();
  }
  ui.buttonName = bn;
  function kbName(action, dflt) {
    var inp = DCW.input;
    if (!inp || !inp.bindings || !inp.keyName) return dflt;
    var b = inp.bindings()[action] || [];
    var code = b[0] || b[1];
    return code ? inp.keyName(code) : dflt;
  }
  function kbBoth(action) {
    var inp = DCW.input;
    if (!inp || !inp.bindings) return '';
    var b = inp.bindings()[action] || [];
    return b.filter(Boolean).map(inp.keyName).join(' / ') || '---';
  }

  /* ---------------- text + window helpers ---------------- */
  function T(s, x, y, col, o) { return DCW.text(s === null || s === undefined ? '' : String(s), x, y, col || C.white, o); }
  function tw(s, sc) { return DCW.textWidth(String(s), sc || 1); }
  function fitText(s, px) { s = String(s === undefined || s === null ? '' : s); var max = Math.max(1, Math.floor((px + 1) / 6)); return s.length > max ? s.slice(0, Math.max(1, max - 1)) + '.' : s; }
  function wrap(s, px) { return DCW.wrapText(String(s === undefined || s === null ? '' : s), px); }
  function blink(rate) { return Math.floor((DCW.t || 0) * (rate || 3)) % 2 === 0; }
  function cursor(x, y, col) { T('▶', x + (Math.floor((DCW.t || 0) * 4) % 2), y, col || C.white); }
  function R(x, y, w, h, c) { DCW.rect(x, y, w, h, c); }
  // NES window: black fill, white border (DCW.box with NES colors filled in)
  function BOX(x, y, w, h, o) {
    o = o || {};
    DCW.box(x, y, w, h, { fill: o.fill || C.fill, border: o.border || C.white, border2: o.border2 || C.black });
  }
  function BAR(x, y, w, h, frac, col, back) { DCW.bar(x, y, w, h, frac, col || C.red, back || C.dbrown); }
  function sep(x, y, w) { R(x, y, w, 1, C.line); }
  // full-screen sub-screen window (opaque: NES has no translucency)
  function frame(ctx, title, o) {
    o = o || {};
    R(0, 0, W, H, C.black);
    var x = o.x === undefined ? 4 : o.x, y = o.y === undefined ? 4 : o.y, w = o.w || 312, h = o.h || 172;
    BOX(x, y, w, h, { fill: o.fill, border: o.border });
    if (title) {
      T('★ ' + String(title) + ' ★', x + w / 2, y + 5, o.titleColor || C.gold, { align: 'center' });
      sep(x + 6, y + 15, w - 12);
    }
    if (o.footer) T(o.footer, x + w / 2, y + h - 11, C.dgray, { align: 'center', shadow: null });
  }
  function scrollArrows(x, yTop, yBot, scroll, vis, n) {
    if (scroll > 0) T('▲', x, yTop + (blink(4) ? 0 : -1), C.gray);
    if (scroll + vis < n) T('▼', x, yBot + (blink(4) ? 0 : 1), C.gray);
  }

  /* ---------------- art helpers (all with fallbacks) ---------------- */
  function artOK() { return !!(DCW.art && typeof DCW.art.sprite === 'function'); }
  function hasArt(name) {
    if (!name || !artOK()) return false;
    if (typeof DCW.art.has === 'function') { try { return !!DCW.art.has(name); } catch (e) { return false; } }
    return true;
  }
  function artInfo(name) {
    if (hasArt(name) && typeof DCW.art.info === 'function') { try { var i = DCW.art.info(name); if (i && i.w && !i.missing) return i; } catch (e) { /* fall through */ } }
    return null;
  }
  function firstArt(list) { for (var i = 0; i < list.length; i++) if (list[i] && hasArt(list[i])) return list[i]; return null; }
  // does art know this background theme? (art.background silently swaps unknown themes for another one)
  var bgKnownCache = {};
  function bgKnown(theme) {
    if (!theme || !DCW.art || typeof DCW.art.background !== 'function') return false;
    var A = DCW.art;
    if (typeof A.hasBackground === 'function') { try { return !!A.hasBackground(theme); } catch (e) { return false; } }
    if (A.backgrounds && typeof A.backgrounds === 'object') return !!A.backgrounds[theme];
    if (bgKnownCache[theme] !== undefined) return bgKnownCache[theme];
    // last resort: draw it and the art module's fallback theme once, compare a sample of pixels
    var ok = true;
    try {
      var a = document.createElement('canvas'), b = document.createElement('canvas');
      a.width = b.width = W; a.height = b.height = H;
      var ga = a.getContext('2d'), gb = b.getContext('2d');
      A.background(ga, theme, 0, 0); A.background(gb, '__none__', 0, 0);
      var da = ga.getImageData(0, 0, W, H).data, db = gb.getImageData(0, 0, W, H).data, same = 0, n = 0;
      for (var i = 0; i < da.length; i += 4 * 97) { n++; if (da[i] === db[i] && da[i + 1] === db[i + 1] && da[i + 2] === db[i + 2]) same++; }
      ok = same < n * 0.97;
    } catch (e) { ok = true; }
    bgKnownCache[theme] = ok;
    return ok;
  }
  ui.bgKnown = bgKnown;
  function drawBg(ctx, theme, camX, camY) {
    if (!bgKnown(theme)) return false;
    try { DCW.art.background(ctx, theme, camX || 0, camY || 0); return true; } catch (e) { return false; }
  }
  var COMP_COL = { donut: ['#fcfcfc', '#f878f8'], mongo: ['#58d854', '#00a800'] };
  // simple block stand-ins so screens stay readable before/without real art (never character art)
  function fallbackSprite(g, name, x, y, o) {
    o = o || {};
    x = Math.round(x); y = Math.round(y);
    var flash = !!o.flash, f = o.frame || 0;
    function r(px, py, w, h, c) { g.fillStyle = flash ? '#fcfcfc' : c; g.fillRect(x + px, y + py, w, h); }
    var n = String(name);
    if (n.indexOf('carl') === 0) {
      if (n.indexOf('dead') >= 0) { r(-12, -7, 24, 7, '#000000'); r(-11, -6, 6, 5, '#fce0a8'); r(-5, -6, 8, 5, '#881400'); r(3, -6, 5, 5, '#fcfcfc'); return; }
      var bob = (f % 2) ? 1 : 0;
      r(-6, -24 + bob, 12, 24 - bob, '#000000');
      r(-5, -23 + bob, 10, 6, '#fce0a8'); r(-5, -23 + bob, 10, 2, '#881400');
      var by = -17 + bob;
      r(-5, by, 10, 7, '#881400'); r(-2, by, 4, 7, '#fce0a8');
      r(-5, by + 7, 10, 4, '#fcfcfc');
      r(-4, by + 11, 3, Math.max(1, -(by + 11) - 1), '#fce0a8'); r(1, by + 11, 3, Math.max(1, -(by + 11) - 1), '#fce0a8');
      return;
    }
    var comp = n.split('_')[0];
    if (COMP_COL[comp]) {
      var cc = COMP_COL[comp], hop = (f % 2) && n.indexOf('run') >= 0 ? -1 : 0;
      r(-7, -9 + hop, 14, 8, '#000000'); r(-6, -8 + hop, 12, 6, cc[0]); r(2, -12 + hop, 6, 7, '#000000'); r(3, -11 + hop, 4, 5, cc[0]);
      r(-6, -3 + hop, 12, 1, cc[1]);
      return;
    }
    if (n.indexOf('ai_screen') === 0) {
      r(-12, -20, 24, 18, '#000000'); r(-11, -19, 22, 16, '#7c7c7c'); r(-9, -17, 18, 12, '#0058f8');
      r(-6, -14, 3, 3, '#fcfcfc'); r(3, -14, 3, 3, '#fcfcfc'); r(-5, -9, 10, 1, '#fcfcfc');
      return;
    }
    if (n.indexOf('box_') === 0) {
      var bc2 = boxColor(n.slice(4));
      r(-8, -13, 16, 13, '#000000'); r(-7, -12, 14, 11, bc2); r(-7, -9, 14, 1, '#000000'); r(-1, -12, 2, 11, '#fcfcfc');
      return;
    }
    if (n.indexOf('door') >= 0) { r(-10, -34, 20, 34, '#000000'); r(-9, -33, 18, 33, '#881400'); r(-9, -20, 18, 1, '#503000'); r(4, -17, 2, 2, '#f8b800'); return; }
    if (n.indexOf('stairwell') === 0) { r(-24, -20, 48, 20, '#000000'); for (var s = 0; s < 4; s++) r(-22 + s * 3, -18 + s * 5, 44 - s * 6, 4, s % 2 ? '#7c7c7c' : '#bcbcbc'); return; }
    // generic standing figure, tinted by name
    var tint = ['#e45c10', '#0058f8', '#00a800', '#940084', '#ac7c00', '#008888'][hash(n.replace(/_(idle|walk|run|act|attack)$/, '')) % 6];
    var hh = 22;
    r(-6, -hh, 12, hh, '#000000'); r(-5, -hh + 1, 10, 7, '#fce0a8'); r(-3, -hh + 4, 1, 1, '#000000'); r(2, -hh + 4, 1, 1, '#000000');
    r(-5, -hh + 8, 10, hh - 9, tint);
  }
  function spr(ctx, name, x, y, o) {
    if (hasArt(name)) { try { DCW.art.sprite(ctx, name, Math.round(x), Math.round(y), o || {}); return true; } catch (e) { /* fall back */ } }
    fallbackSprite(ctx, name, x, y, o);
    return false;
  }
  // integer-scaled and/or silhouetted sprite via an offscreen canvas (bottom-center anchor)
  var tmpC = null;
  function bigSprite(ctx, name, x, y, o) {
    o = o || {};
    var s = o.scale || 2, inf = artInfo(name) || { w: 30, h: 32 };
    var w = Math.max(16, (inf.w | 0) + 8), h = Math.max(16, (inf.h | 0) + 6);
    if (!tmpC) tmpC = document.createElement('canvas');
    tmpC.width = w; tmpC.height = h;
    var g = tmpC.getContext('2d'); g.imageSmoothingEnabled = false;
    g.clearRect(0, 0, w, h);
    spr(g, name, (w / 2) | 0, h - 3, { frame: o.frame, flip: o.flip, skin: o.skin, flash: o.flash });
    if (o.silhouette) { g.globalCompositeOperation = 'source-in'; g.fillStyle = o.silhouette; g.fillRect(0, 0, w, h); g.globalCompositeOperation = 'source-over'; }
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(tmpC, 0, 0, w, h, Math.round(x - (w / 2 | 0) * s), Math.round(y - (h - 3) * s), w * s, h * s);
  }
  function portraitName(name) {
    if (!name) return null;
    if (hasArt(name)) return name;
    var m = /^(p_[a-z0-9]+(?:_f\d+)?)_[a-z]+$/.exec(name); // p_carl_mad -> p_carl
    if (m && hasArt(m[1])) return m[1];
    return name;
  }
  function portrait(ctx, name, x, y, o) {
    x = Math.round(x); y = Math.round(y);
    var nm = portraitName(name);
    if (nm && DCW.art && typeof DCW.art.portrait === 'function' && hasArt(nm)) { try { DCW.art.portrait(ctx, nm, x, y, o); return; } catch (e) { /* fall back */ } }
    // fallback: tinted panel with a simple face (drawn into the given ctx)
    withCtx(ctx, function () {
      var key = String(name || 'x').replace('p_', '');
      var cols = ['#0058f8', '#a81000', '#00a800', '#940084', '#ac7c00', '#008888'];
      R(x, y, 32, 32, C.black); R(x + 1, y + 1, 30, 30, cols[hash(key) % cols.length]);
      if (key === 'ai') { R(x + 5, y + 6, 22, 18, C.black); R(x + 6, y + 7, 20, 16, C.dgray); R(x + 8, y + 9, 16, 12, C.dblue); R(x + 11, y + 12, 3, 3, C.white); R(x + 18, y + 12, 3, 3, C.white); R(x + 12, y + 17, 8, 1, C.white); return; }
      R(x + 7, y + 7, 18, 20, C.black); R(x + 8, y + 8, 16, 18, C.skin);
      R(x + 8, y + 8, 16, 4, C.brown);
      R(x + 11, y + 15, 3, 3, C.black); R(x + 18, y + 15, 3, 3, C.black); R(x + 13, y + 22, 6, 1, C.dred);
      R(x + 4, y + 27, 24, 4, C.dbrown);
    });
  }
  // draw with DCW.rect/DCW.text into another context
  function withCtx(ctx, fn) {
    var old = DCW.ctx; DCW.ctx = ctx;
    try { fn(); } finally { DCW.ctx = old; }
  }
  // 8x8 icons (art.icon if it knows the name, else built-in bitmaps)
  var ICON_PAL = { k: '#000000', r: '#f83800', R: '#a81000', w: '#fcfcfc', y: '#f8b800', Y: '#ac7c00', G: '#004058', g: '#7c7c7c', o: '#fca044', p: '#d800cc', P: '#940084', n: '#881400', N: '#e45c10', b: '#3cbcfc', B: '#0058f8', e: '#58d854', s: '#fce0a8' };
  var ICONS = {
    heart: ['.kk.kk..', 'krrkrrk.', 'krwrrrk.', 'krrrrrk.', '.krrrk..', '..krk...', '...k....', '........'],
    heart_empty: ['.kk.kk..', 'kggkggk.', 'kgggggk.', 'kgggggk.', '.kgggk..', '..kgk...', '...k....', '........'],
    coin: ['..kkkk..', '.kyyyyk.', 'kyywyyYk', 'kyywyyYk', 'kyywyyYk', 'kyyyyYYk', '.kYYYYk.', '..kkkk..'],
    bomb: ['.....yo.', '....k...', '..kkkk..', '.kGGGGk.', 'kGwGGGGk', 'kGGGGGGk', '.kGGGGk.', '..kkkk..'],
    jug: ['...ro...', '...yr...', '..kNNk..', '.kNnnNk.', 'kNwnnnNk', 'kNnnnnNk', '.kNnnNk.', '..kkkk..'],
    biscuit: ['........', '.kkkkkk.', 'kYyyyyYk', 'kyYyyYyk', 'kyyYyyyk', 'kYyyyyYk', '.kkkkkk.', '........'],
    potion: ['..kkk...', '..kwk...', '.kkwkk..', 'kppwppk.', 'kpwpppk.', 'kppppPk.', '.kPPPk..', '..kkk...'],
    star: ['...k....', '..kyk...', 'kkkykkk.', 'kyyyyyk.', '.kyyyk..', '.kykyk..', 'kyk.kyk.', 'kk...kk.'],
    skull: ['.kkkkk..', 'kwwwwwk.', 'kwkwkwk.', 'kwwwwwk.', '.kwkwk..', '.kkkkk..', '........', '........'],
    box: ['kkkkkkkk', 'knnynnnk', 'kyyyyyyk', 'knnynnnk', 'knnynnnk', 'knnynnnk', 'kkkkkkkk', '........'],
    sword: ['......kk', '.....kwk', '....kwk.', '.k.kwk..', '..kwk...', '..nk....', '.n.k....', 'n.......'],
    shield: ['kkkkkkk.', 'kbbwbbk.', 'kbbwbbk.', 'kwwwwwk.', 'kbbwbbk.', '.kbwbk..', '..kbk...', '...k....'],
    boot: ['.kkk....', '.knnk...', '.knnk...', '.knnk...', '.knnnkk.', 'knnnnnnk', 'kkkkkkkk', '........'],
    brain: ['.kkkkk..', 'kppPppk.', 'kpPppPpk', 'kpppPppk', 'kPppppPk', '.kpppkk.', '..kkk...', '........'],
    eye: ['........', '..kkkk..', '.kwwwwk.', 'kwwbbwwk', 'kwwbkwwk', '.kwwwwk.', '..kkkk..', '........'],
    lock: ['..kkk...', '.kgGgk..', '.kg.gk..', 'kkkkkkk.', 'kyyyyyk.', 'kyykyyk.', 'kyyyyyk.', 'kkkkkkk.'],
    gear: ['...kk...', '.kkyykk.', '.kyYYyk.', 'kyYkkYyk', 'kyYkkYyk', '.kyYYyk.', '.kkyykk.', '...kk...'],
    clock: ['..kkkk..', '.kwwwwk.', 'kwwkwwwk', 'kwwkwwwk', 'kwwkkkwk', 'kwwwwwwk', '.kwwwwk.', '..kkkk..']
  };
  var iconCache = {};
  function iconCanvas(name) {
    if (iconCache[name]) return iconCache[name];
    var rows = ICONS[name]; if (!rows) return null;
    var c = document.createElement('canvas'); c.width = 8; c.height = 8;
    var g = c.getContext('2d');
    for (var y = 0; y < 8; y++) for (var x = 0; x < 8; x++) { var ch = rows[y].charAt(x); if (ICON_PAL[ch]) { g.fillStyle = ICON_PAL[ch]; g.fillRect(x, y, 1, 1); } }
    iconCache[name] = c; return c;
  }
  function icon(ctx, name, x, y) {
    if (!name) return;
    x = Math.round(x); y = Math.round(y);
    if (DCW.art && typeof DCW.art.icon === 'function' && (hasArt('icon_' + name) || (hasArt(name) && !ICONS[name]))) { try { DCW.art.icon(ctx, name, x, y); return; } catch (e) { /* fall back */ } }
    var c = iconCanvas(name) || iconCanvas('gear');
    if (c) ctx.drawImage(c, x, y);
  }
  var BOX_FB = { bronze: '#e45c10', silver: '#bcbcbc', gold: '#f8b800', platinum: '#a4e4fc', legendary: '#9878f8', fan: '#f878f8', boss: '#e40058' };
  function boxColor(tier) {
    var c = null;
    if (DCW.art && typeof DCW.art.boxColor === 'function') { try { c = DCW.art.boxColor(tier); } catch (e) { c = null; } }
    if (!c) { var bt = D('boxTiers'); c = (bt && bt[tier] && bt[tier].color) || BOX_FB[tier] || C.gray; }
    return nes(c);
  }
  function tierName(tier) {
    var n = G('tierName', tier); if (n) return n;
    var bt = D('boxTiers'); return (bt && bt[tier] && bt[tier].name) || (String(tier || 'mystery').toUpperCase() + ' BOX');
  }
  // tiny cropped portrait for the HUD (nearest-neighbour 2x downscale of the face area)
  var miniC = {};
  function miniPortrait(ctx, name, x, y) {
    var c = miniC[name];
    if (!c) {
      c = document.createElement('canvas'); c.width = 32; c.height = 32;
      var g = c.getContext('2d'); g.imageSmoothingEnabled = false;
      portrait(g, name, 0, 0);
      if (hasArt(portraitName(name))) miniC[name] = c;
    }
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(c, 4, 2, 24, 24, x, y, 12, 12);
  }

  /* ---------------- data helpers ---------------- */
  var STATS = ['str', 'con', 'dex', 'int'];
  var STAT_INFO = {
    str: { name: 'STRENGTH', short: 'STR', icon: 'sword', desc: 'PUNCH, KICK AND BOMB DAMAGE.' },
    con: { name: 'CONSTITUTION', short: 'CON', icon: 'heart', desc: '+2 MAX HP PER POINT. DIE LESS.' },
    dex: { name: 'DEXTERITY', short: 'DEX', icon: 'boot', desc: 'CRIT CHANCE AND MOVE SPEED.' },
    int: { name: 'INTELLIGENCE', short: 'INT', icon: 'brain', desc: 'DONUT\'S SPELL POWER. SMART CATS HIT HARDER.' }
  };
  function xpNeed(level) { var r = G('xpNeed', level); if (typeof r === 'number' && r > 0) return r; return Math.round(18 * Math.pow(level || 1, 1.5)); }
  function pStats() {
    var s = G('playerStats');
    if (s && typeof s === 'object') return s;
    var run = getRun() || {}; var st = run.stats || { str: 3, con: 3, dex: 3, int: 3 }; var lv = run.level || 1;
    var dmg = 2 + (st.str - 3) + Math.floor((lv - 1) / 2);
    return { maxHp: 10 + (st.con - 3) * 2 + (lv - 1) + ((run.bonus && run.bonus.hp) || 0), dmg: dmg, kickDmg: Math.round(dmg * 1.5),
      crit: 0.04 + (st.dex - 3) * 0.02, speedMul: 1 + (st.dex - 3) * 0.03, bombDmg: 8 + lv * 2 + (st.str - 3), bombRadius: 28,
      compPower: 1 + (st.int - 3) * 0.15 + (lv - 1) * 0.04, def: 0 };
  }
  function titleFor(views) {
    var t = D('titles'), best = null;
    if (Array.isArray(t)) t.forEach(function (e) { if (e && views >= (e.views || 0) && (!best || (e.views || 0) >= (best.views || 0))) best = e; });
    return best ? best.name : 'NOBODY';
  }
  function skinDef(id) { var s = D('skins'); return (s && s[id]) || null; }
  function compDef(id) { var s = D('companions'); return (s && s[id]) || null; }
  function skinName(id) { var d = skinDef(id); return (d && d.name) || String(id || '').replace('carl_', '').toUpperCase(); }
  function compName(id) { var d = compDef(id); return (d && d.name) || String(id || '').toUpperCase(); }
  function gearDef(id) { var g = G('gearDef', id); if (g) return g; var d = D('gear'); return (d && d[id]) || null; }
  function gearName(id) { var d = gearDef(id); return (d && d.name) || String(id || '').replace(/_/g, ' ').toUpperCase(); }
  function gearIcon(id) { var d = gearDef(id); return (d && d.icon) || 'gear'; }
  function inSafe() {
    if (hasG('inSafeRoom')) return !!G('inSafeRoom');
    return !!(ui.scenes && DCW.scene === ui.scenes.safeRoom);
  }
  // Mordecai's body for the current floor (Rat Hooligan on 1, Bugaboo on 2)
  function mordForm() {
    var run = getRun() || {}, n = run.floor || 1;
    var f = (D('mordecaiForms') || {})[n] || {};
    return { n: n, name: f.name || '', line: f.line || '',
      sprite: firstArt(['mordecai_f' + n + '_idle', 'mordecai_f' + n, 'mordecai_idle', 'mordecai']) || 'mordecai',
      portrait: firstArt(['p_mordecai_f' + n, 'p_mordecai']) || 'p_mordecai' };
  }
  function compSprite(id) { var d = compDef(id); return (d && d.sprite) || id || 'donut'; }
  // who speaks -> portrait name (data may omit portraits)
  var WHO_PORTRAIT = { 'SYSTEM AI': 'p_ai', 'AI': 'p_ai', 'THE AI': 'p_ai', 'CARL': 'p_carl', 'DONUT': 'p_donut', 'PRINCESS DONUT': 'p_donut',
    'MONGO': 'p_mongo', 'ZEV': 'p_zev', 'TALLY': 'p_tally', 'QWIST': 'p_qwist', 'FRANK': 'p_frank_q', 'FRANK Q': 'p_frank_q',
    'MAGGIE': 'p_maggie_my', 'MAGGIE MY': 'p_maggie_my', 'ELLE': 'p_elle', 'ELLE MCGIBBONS': 'p_elle', 'MAESTRO': 'p_maestro', 'THE MAESTRO': 'p_maestro' };
  function whoPortrait(who) {
    var k = String(who || '').toUpperCase().trim();
    if (!k) return null;
    if (k === 'MORDECAI' || /^MORDECAI\b/.test(k)) return mordForm().portrait;
    if (WHO_PORTRAIT[k] && (hasArt(WHO_PORTRAIT[k]) || k === 'SYSTEM AI' || k === 'CARL' || k === 'DONUT' || k === 'PRINCESS DONUT')) return WHO_PORTRAIT[k];
    var id = 'p_' + k.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
    if (hasArt(id)) return id;
    var fw = 'p_' + k.split(/\s+/)[0].toLowerCase().replace(/[^a-z0-9]/g, '');
    if (hasArt(fw)) return fw;
    return WHO_PORTRAIT[k] || null;
  }
  ui.whoPortrait = whoPortrait;
  // perk objects -> readable text (gear perks, skin perks)
  function pctOf(v) { v = +v; return Math.round((Math.abs(v) < 1 ? v : v - 1) * 100); }
  function perkLines(p) {
    if (!p) return [];
    var out = [];
    if (p.hp) out.push('+' + p.hp + ' MAX HP');
    if (p.dmg) out.push('+' + p.dmg + ' PUNCH DAMAGE');
    if (p.kick) out.push('+' + p.kick + ' KICK DAMAGE');
    if (p.stomp) out.push('+' + pctOf(p.stomp) + '% STOMP DAMAGE');
    if (p.def) out.push('+' + p.def + ' DEFENSE');
    if (p.crit) out.push('+' + pctOf(p.crit) + '% CRIT');
    if (p.speed) out.push('+' + pctOf(p.speed) + '% SPEED');
    if (p.regen) out.push('REGEN ' + p.regen + ' HP / 8S');
    if (p.missile) out.push('+' + p.missile + ' MISSILE DAMAGE');
    if (p.missileCd) out.push('-' + Math.abs(p.missileCd) + 'S MISSILE COOLDOWN');
    if (p.special) out.push('+' + (Math.abs(p.special) < 1 ? pctOf(p.special) : Math.round(p.special)) + '% SPECIAL FILL');
    if (p.stun) out.push(pctOf(p.stun) + '% STUN CHANCE');
    if (p.bombs) out.push('+' + p.bombs + ' MAX BOMBS');
    if (p.gold) out.push('+' + pctOf(p.gold) + '% GOLD');
    if (p.views) out.push('+' + pctOf(p.views) + '% VIEWS');
    if (p.doubleJump) out.push('DOUBLE JUMP');
    return out;
  }
  function perkText(p) { return perkLines(p).join(', '); }
  function itemName(id, n) {
    if (id === 'bomb') return flag('jugs') ? "JUG O'BOOM" : 'DYNAMITE';
    if (id === 'potion') return 'POTION';
    if (id === 'biscuit') return 'PET BISCUIT';
    var nm = G('itemName', id);
    return nm || String(id || 'ITEM').toUpperCase();
  }
  function rewardInfo(r) {
    if (r === null || r === undefined) return { text: 'NOTHING. WOW.', icon: 'skull', color: C.dgray };
    if (typeof r === 'string') return { text: r, icon: 'star', color: C.white };
    var n;
    switch (r.kind) {
      case 'gold': return { text: (r.converted === 'skin' ? 'OUTFIT OWNED: +' : r.converted === 'gear' ? 'GEAR OWNED: +' : '+') + (r.amount || 0) + ' GOLD', icon: 'coin', color: C.gold };
      case 'item':
        n = r.count || 1;
        var nm = itemName(r.id);
        return { text: '+' + n + ' ' + nm + (n > 1 && !/S$/.test(nm) ? 'S' : ''), icon: r.id === 'bomb' ? (flag('jugs') ? 'jug' : 'bomb') : r.id === 'biscuit' ? 'biscuit' : r.id === 'potion' ? 'potion' : 'star', color: C.white };
      case 'gear': return { text: gearName(r.id), icon: gearIcon(r.id), color: C.gold, unlock: r.isNew !== false, gear: true };
      case 'skin': return { text: (r.isNew ? 'NEW OUTFIT: ' : 'OUTFIT: ') + skinName(r.id), icon: 'star', color: r.isNew ? C.yellow : C.gray, unlock: !!r.isNew };
      case 'companion': return { text: (r.isNew ? 'NEW PAL: ' : 'PAL: ') + compName(r.id), icon: 'star', color: r.isNew ? C.yellow : C.gray, unlock: !!r.isNew };
      case 'stat': var si = STAT_INFO[r.stat] || { short: String(r.stat || '?').toUpperCase(), icon: 'star' }; return { text: '+' + (r.amount || 1) + ' ' + si.short, icon: si.icon, color: C.green };
      case 'xp': return { text: '+' + (r.amount || 0) + ' XP', icon: 'star', color: C.green };
      case 'hp': return { text: '+' + (r.amount || 1) + ' MAX HP', icon: 'heart', color: C.red };
      case 'box': return { text: tierName(r.tier), icon: 'box', color: boxColor(r.tier) };
      case 'views': return { text: '+' + fmtNum(r.amount) + (r.note ? ' ' + r.note : '') + ' VIEWS', icon: 'eye', color: C.pink };
      case 'revival': n = r.count || 1; return { text: '+' + n + ' SPONSOR REVIVAL' + (n > 1 ? 'S' : ''), icon: 'heart', color: C.pink };
      case 'flag': return { text: String(r.text || r.id || 'NEW ABILITY').toUpperCase(), icon: 'star', color: C.green };
      case 'achieve': var ad = (D('achievements') || {})[r.id]; return { text: (ad && ad.name) || String(r.id || '').toUpperCase(), icon: 'star', color: C.gold };
      default: return { text: r.text || String(r.kind || '?').toUpperCase(), icon: r.icon || 'star', color: C.white };
    }
  }
  ui.rewardInfo = rewardInfo;

  /* ================================================================
     MODAL STACK
     ================================================================ */
  var stack = [];
  function push(m) { m.t = 0; stack.push(m); consume(); return m; }
  function close(m) {
    var i = stack.indexOf(m);
    if (i >= 0) stack.splice(i, 1);
    consume();
    if (m && m.onClose) { var f = m.onClose; m.onClose = null; try { f(); } catch (e) { console.error(e); } }
  }
  function closeAll() { while (stack.length) close(stack[stack.length - 1]); }
  function top() { return stack[stack.length - 1] || null; }
  ui.push = push; ui.close = close; ui.closeAll = closeAll; ui.top = top;
  ui.isOpen = function (kind) { for (var i = 0; i < stack.length; i++) if (stack[i].kind === kind) return true; return false; };
  ui.blocking = function () { return stack.length > 0; };

  /* ================================================================
     DIALOG (say)
     ================================================================ */
  function paginate(lines, opts) {
    opts = opts || {};
    if (lines === null || lines === undefined) return [];
    if (!Array.isArray(lines)) lines = [lines];
    var pages = [];
    lines.forEach(function (l) {
      if (l === null || l === undefined || l === '') return;
      var o = typeof l === 'object' ? l : { text: String(l) };
      var who = o.who !== undefined ? o.who : (opts.who !== undefined ? opts.who : 'SYSTEM AI');
      var por;
      if (o.portrait !== undefined) por = o.portrait;
      else if (o.who !== undefined) por = whoPortrait(o.who);
      else por = opts.portrait !== undefined ? opts.portrait : (opts.who !== undefined ? whoPortrait(opts.who) : 'p_ai');
      var wl = wrap(String(o.text === undefined ? '' : o.text).toUpperCase(), por ? 256 : 296);
      for (var i = 0; i < wl.length; i += 4) pages.push({ who: who ? String(who).toUpperCase() : '', portrait: por, lines: wl.slice(i, i + 4), color: o.color ? nes(o.color) : null });
    });
    return pages;
  }
  function pageLen(p) { var n = 0; p.lines.forEach(function (l) { n += l.length; }); return n; }
  // the NES text window: portrait frame, name tab, typewriter text, blinking ▼
  function drawTextBox(ctx, page, shown, y, done) {
    var x = 4, w = 312, h = 50;
    BOX(x, y, w, h);
    var tx = x + 8;
    if (page.portrait) {
      R(x + 5, y + 8, 34, 34, C.white); R(x + 6, y + 9, 32, 32, C.black);
      portrait(ctx, page.portrait, x + 6, y + 9, { frame: done ? 0 : Math.floor((DCW.t || 0) * 6) });
      tx = x + 44;
    }
    var left = shown;
    for (var i = 0; i < page.lines.length && left > 0; i++) {
      var s = page.lines[i].slice(0, Math.max(0, Math.floor(left)));
      T(s, tx, y + 7 + i * 10, page.color || C.white);
      left -= page.lines[i].length;
    }
    if (page.who) {
      var nw = tw(page.who) + 10;
      BOX(x + 6, y - 9, nw, 12, { fill: C.dred });
      T(page.who, x + 11, y - 7, C.white);
    }
    if (done && blink(2.5)) T('▼', x + w - 12, y + h - 10, C.gold);
  }
  ui.say = function (lines, opts) {
    opts = opts || {};
    var pages = paginate(lines, opts);
    if (!pages.length) { if (opts.onDone) opts.onDone(); return null; }
    var m = { kind: 'say', pages: pages, i: 0, shown: 0, blip: 0 };
    function finish() { if (m.done) return; m.done = true; close(m); if (opts.onDone) opts.onDone(); }
    m.update = function (dt) {
      var p = m.pages[m.i], total = pageLen(p);
      if (m.shown < total) {
        var before = Math.floor(m.shown);
        m.shown = Math.min(total, m.shown + dt * (opts.speed || 55));
        var now = Math.floor(m.shown);
        if (now !== before) { m.blip += now - before; if (m.blip >= 3) { m.blip = 0; sfx('text_blip'); } }
      }
      if (skipP() && opts.skippable !== false && m.t > 0.15) { finish(); return; }
      if ((P('confirm') || P('back')) && m.t > 0.08) {
        if (m.shown < total) m.shown = total;
        else { m.i++; m.shown = 0; if (m.i >= m.pages.length) finish(); }
      }
      m.t += dt;
    };
    m.draw = function (ctx) {
      var p = m.pages[Math.min(m.i, m.pages.length - 1)];
      drawTextBox(ctx, p, m.shown, opts.pos === 'top' ? 18 : 126, m.shown >= pageLen(p));
    };
    return push(m);
  };

  /* ================================================================
     TOASTS + ANNOUNCE (non-blocking)
     ================================================================ */
  var toasts = [], toastQ = [];
  ui.toast = function (text, o) {
    o = o || {};
    var ach = !!(o.achievement || (o.title && /ACHIEVEMENT/i.test(o.title)));
    var col = o.color ? nes(o.color) : (ach ? C.gold : C.white);
    var t = { text: String(text === undefined || text === null ? '' : text).toUpperCase(), title: o.title ? String(o.title).toUpperCase() : (ach ? 'NEW ACHIEVEMENT!' : ''),
      icon: o.icon || (ach ? 'star' : null), color: col, time: o.time || (ach ? 4 : 2.6),
      sub: o.sub || o.desc ? String(o.sub || o.desc).toUpperCase() : '', ach: ach, t: 0, y: null };
    var iw = t.icon ? 12 : 0, maxIn = 176 - iw;
    t.lines = wrap(t.text, maxIn).slice(0, 4);
    t.subLines = t.sub ? wrap(t.sub, maxIn).slice(0, 3) : [];
    var inner = Math.max(t.title ? tw(t.title) : 0, 0);
    t.lines.concat(t.subLines).forEach(function (l) { inner = Math.max(inner, tw(l)); });
    t.w = Math.max(64, inner + iw + 12);
    t.h = 7 + (t.title ? 10 : 0) + t.lines.length * 10 + t.subLines.length * 10;
    if (o.sfx) sfx(o.sfx);
    if (toasts.length < 3) toasts.push(t); else toastQ.push(t);
    return t;
  };
  ui.achievement = function (a) {
    if (typeof a === 'string') { var d = D('achievements'); a = (d && d[a]) || { name: a }; }
    a = a || {};
    return ui.toast(a.name || 'SOMETHING', { title: 'NEW ACHIEVEMENT!', sub: a.desc, achievement: true });
  };
  function updateToasts(dt) {
    var y = 17;
    for (var i = 0; i < toasts.length; i++) {
      var t = toasts[i];
      t.t += dt;
      if (t.y === null) t.y = y;
      t.y += (y - t.y) * Math.min(1, dt * 12);
      y += t.h + 4;
    }
    toasts = toasts.filter(function (t) { return t.t < t.time; });
    // a backlog (a cutscene or safe room handing out five rewards at once) moves along faster
    if (toastQ.length) toasts.forEach(function (t) { t.time = Math.min(t.time, Math.max(t.t + 0.6, 1.8)); });
    while (toasts.length < 3 && toastQ.length) toasts.push(toastQ.shift());
  }
  function drawToasts(ctx) {
    toasts.forEach(function (t) {
      // slide in from the right edge and out again in 8px steps (no fades on the NES)
      var a = t.t < 0.2 ? t.t / 0.2 : t.t > t.time - 0.25 ? (t.time - t.t) / 0.25 : 1;
      a = clamp(a, 0, 1);
      var off = Math.round((1 - a) * (t.w + 8) / 8) * 8;
      var x = Math.round(W - 4 - t.w + off), y = Math.round(t.y);
      BOX(x, y, t.w, t.h, { fill: t.ach ? C.dbrown : C.fill, border: t.ach ? C.gold : t.color });
      var tx = x + 5;
      if (t.icon) { icon(ctx, t.icon, x + 5, y + 4); tx += 12; }
      var ty = y + 4;
      if (t.title) { T(t.title, tx, ty, t.ach ? (blink(4) ? C.gold : C.yellow) : t.color); ty += 10; }
      t.lines.forEach(function (l) { T(l, tx, ty, t.title ? C.white : t.color); ty += 10; });
      t.subLines.forEach(function (l) { T(l, tx, ty, C.gray); ty += 10; });
      if (t.ach) { // a star sparkle running around the border
        var ph = ((DCW.t || 0) * 1.3) % 1, per = 2 * (t.w + t.h), d = Math.floor(ph * per / 2) * 2, sx, sy;
        if (d < t.w) { sx = x + d; sy = y; } else if (d < t.w + t.h) { sx = x + t.w; sy = y + d - t.w; } else if (d < 2 * t.w + t.h) { sx = x + t.w - (d - t.w - t.h); sy = y + t.h; } else { sx = x; sy = y + t.h - (d - 2 * t.w - t.h); }
        R(sx - 1, sy, 3, 1, C.white); R(sx, sy - 1, 1, 3, C.white);
      }
    });
  }
  var banner = null;
  ui.announce = function (text, o) {
    o = o || {};
    banner = { text: String(text === undefined ? '' : text).toUpperCase(), sub: o.sub ? String(o.sub).toUpperCase() : '', color: o.color ? nes(o.color) : C.gold, time: o.time || 2.2, t: 0, y: o.y || 60 };
    if (o.sfx) sfx(o.sfx);
    return banner;
  };
  function drawBanner(ctx) {
    var b = banner; if (!b) return;
    var inT = clamp(b.t / 0.18, 0, 1), outT = clamp((b.time - b.t) / 0.22, 0, 1);
    var big = tw(b.text, 2) <= 300;
    var subL = b.sub ? wrap(b.sub, 296) : [];
    var hh = (big ? 20 : 12) + subL.length * 10 + 10;
    var bh = Math.round(hh * Math.min(inT, outT) / 2) * 2;
    var cy = Math.round(b.y + hh / 2);
    if (bh <= 0) return;
    R(0, cy - bh / 2, W, bh, C.black);
    R(0, cy - bh / 2, W, 1, b.color); R(0, cy + bh / 2 - 1, W, 1, b.color);
    if (inT < 1 || outT < 1) return;
    var slide = b.t < 0.35 ? Math.round((1 - (b.t - 0.18) / 0.17) * 5) * 8 : 0;
    var ty = Math.round(b.y + 5);
    if (big) { T(b.text, 160 + Math.max(0, slide), ty, b.color, { align: 'center', scale: 2, shadow: C.black }); ty += 20; }
    else { T(b.text, 160 + Math.max(0, slide), ty, b.color, { align: 'center' }); ty += 12; }
    subL.forEach(function (l) { T(l, 160 - Math.max(0, slide), ty, C.white, { align: 'center' }); ty += 10; });
  }

  /* ================================================================
     GENERIC MENU + CONFIRM
     ================================================================ */
  function itemsOf(items) { var a = typeof items === 'function' ? items() : items; return (a || []).filter(function (it) { return it && !it.hidden; }); }
  function labelOf(it) { return typeof it.label === 'function' ? it.label() : String(it.label === undefined ? '' : it.label); }
  ui.menu = function (items, opts) {
    opts = opts || {};
    var m = { kind: opts.kind || 'menu', sel: opts.sel || 0, msg: '', msgT: 0 };
    m.update = function (dt) {
      m.t += dt;
      var its = itemsOf(items);
      listNav(m, its.length, dt);
      if (m.msgT > 0) m.msgT -= dt;
      if (P('confirm') && its.length) {
        var it = its[m.sel];
        if (it.disabled) { sfx('error'); m.msg = it.why || it.hint || 'NOT NOW'; m.msgT = 1.6; return; }
        sfx('menu_select');
        if (!(it.keep || opts.keep)) close(m);
        if (it.action) it.action(m);
      } else if ((backPressed() || (opts.startCloses && P('start'))) && opts.cancel !== false) {
        sfx('menu_back'); close(m); if (opts.onBack) opts.onBack();
      }
    };
    m.draw = function (ctx) {
      var its = itemsOf(items);
      var maxTitle = opts.w ? opts.w - 16 : 240;
      var tl = opts.title ? wrap(String(opts.title).toUpperCase(), maxTitle) : [];
      var iw = 0; its.forEach(function (it) { iw = Math.max(iw, tw(labelOf(it)) + (it.right ? tw(it.right) + 12 : 0)); });
      var w = opts.w || Math.max(80, iw + 30, tl.reduce(function (a, l) { return Math.max(a, tw(l) + 16); }, 0));
      var hint = (m.msgT > 0 && m.msg) ? m.msg : (its[m.sel] && its[m.sel].hint) || '';
      var hl = hint ? wrap(String(hint).toUpperCase(), w - 12).slice(0, 2) : [];
      var h = 8 + tl.length * 10 + (tl.length ? 4 : 0) + its.length * 12 + (hl.length ? hl.length * 10 + 4 : 0);
      var x = opts.x !== undefined ? opts.x : Math.round(160 - w / 2), y = opts.y !== undefined ? opts.y : Math.round(90 - h / 2);
      BOX(x, y, w, h, { fill: opts.fill, border: opts.border });
      var yy = y + 5;
      tl.forEach(function (l) { T(l, x + w / 2, yy, opts.titleColor || C.gold, { align: 'center' }); yy += 10; });
      if (tl.length) { sep(x + 6, yy, w - 12); yy += 4; }
      its.forEach(function (it, i) {
        var col = it.disabled ? C.dgray : (i === m.sel ? (it.color || C.white) : (it.color || C.gray));
        if (i === m.sel) cursor(x + 6, yy + 1);
        T(labelOf(it), x + 16, yy + 1, col);
        if (it.right) T(it.right, x + w - 8, yy + 1, it.rightColor || C.gold, { align: 'right' });
        yy += 12;
      });
      if (hl.length) { yy += 2; hl.forEach(function (l) { T(l, x + w / 2, yy, m.msgT > 0 ? C.red : C.dgray, { align: 'center', shadow: null }); yy += 10; }); }
    };
    return push(m);
  };
  ui.confirm = function (text, onYes, opts) {
    opts = opts || {};
    return ui.menu([
      { label: opts.yes || 'YES', action: function () { if (onYes) onYes(); } },
      { label: opts.no || 'NO', action: function () { if (opts.onNo) opts.onNo(); } }
    ], { title: text, sel: opts.def === 'yes' ? 0 : 1, onBack: opts.onNo, kind: 'confirm', titleColor: opts.color || C.white, border: opts.border });
  };

  /* ================================================================
     HUD
     ================================================================ */
  var hudS = { combo: 0, pop: 0, trail: null, bossTrail: null, lastT: 0 };
  ui.drawHUD = function (ctx, h) {
    h = h || {};
    var now = DCW.t || 0, dt = clamp(now - hudS.lastT, 0, 0.1); hudS.lastT = now;
    R(0, 0, W, 13, C.black); R(0, 13, W, 1, C.line);
    // companion mini portrait
    var comp = h.companion || equipped('companion');
    R(0, 0, 14, 14, C.dgray); R(1, 1, 12, 12, C.black);
    miniPortrait(ctx, 'p_' + comp, 1, 1);
    // hp bar + numbers
    var hp = Math.max(0, +h.hp || 0), mx = Math.max(1, +h.maxHp || hp || 1);
    if (hudS.trail === null || hudS.trail < hp) hudS.trail = hp;
    else hudS.trail = Math.max(hp, hudS.trail - dt * Math.max(2, mx * 0.6));
    var bx = 17, bw = 56, low = hp <= mx * 0.25, tainted = (+h.taint || 0) > 0;
    var hpCol = tainted ? '#00a800' : C.red, hpHi = tainted ? '#58d854' : '#f87858';
    BAR(bx, 2, bw, 4, hudS.trail / mx, C.gold, C.dbrown);
    var fillW = Math.round(bw * clamp(hp / mx, 0, 1));
    R(bx, 2, fillW, 4, low && blink(5) ? C.white : hpCol);
    R(bx, 2, fillW, 1, low && blink(5) ? C.white : hpHi);
    var step = mx <= 20 ? 1 : mx <= 60 ? 5 : 10;
    for (var s = step; s < mx; s += step) R(bx + Math.round(bw * s / mx), 2, 1, 4, C.black);
    if (h.special !== undefined && h.special !== null) {
      var full = h.special >= 1;
      BAR(bx, 9, bw, 2, h.special, full ? (blink(6) ? C.white : C.yellow) : C.purple, C.ddgray);
    }
    var hpStr = Math.ceil(hp) + '/' + mx;
    T(hpStr, 77, 3, low ? C.red : tainted ? C.green : C.white);
    var x = Math.max(111, 77 + tw(hpStr) + 4); // 3-digit HP pushes the row right instead of overlapping
    function counter(ic, val, col) { icon(ctx, ic, x, 2); var s2 = String(val === undefined ? '-' : val); T(s2, x + 9, 3, col || C.white); x += 9 + tw(s2) + 5; }
    counter(h.jugs ? 'jug' : 'bomb', h.bombs);
    counter('potion', h.potions);
    if (h.biscuits > 0) counter('biscuit', h.biscuits);
    counter('coin', fitText(h.gold || 0, 30), C.gold);
    var lvS = 'LV' + (h.level || 1);
    T(lvS, x, 2, C.green);
    BAR(x, 11, Math.max(18, tw(lvS)), 1, h.xpFrac || 0, C.green, C.ddgreen);
    x += Math.max(18, tw(lvS)) + 5;
    if (h.viewersOff) { R(x, 4, 3, 3, blink(1) ? C.dred : C.crimson); T('OFF AIR', x + 5, 3, C.dgray); x += 5 + tw('OFF AIR'); }
    else { icon(ctx, 'eye', x, 2); var vs = fmtNum(h.views || 0); T(vs, x + 9, 3, C.pink); x += 9 + tw(vs); }
    // timer vs par (or stage name), only if it still fits
    if (h.time !== undefined && h.time !== null) {
      var ts = fmtTime(h.time), over = h.par && h.time > h.par;
      if (x + 4 <= 318 - tw(ts)) {
        T(ts, 318, 2, over ? C.red : C.white, { align: 'right' });
        if (h.par) BAR(318 - tw(ts), 11, tw(ts), 1, clamp(h.time / h.par, 0, 1), over ? C.red : C.green, C.ddgray);
      }
    } else if (h.stageName) { var nm0 = String(h.stageName).toUpperCase(); if (x + 6 <= 318 - tw(nm0)) T(nm0, 318, 3, C.gray, { align: 'right' }); }
    // TAINTED tag (no healing while it lasts)
    if (tainted) {
      var tt = 'TAINTED ' + Math.ceil(h.taint), tW = tw(tt) + 14;
      BOX(318 - tW, 16, tW, 12, { fill: C.ddgreen, border: h.taint < 2 && blink(6) ? C.white : C.green });
      R(318 - tW + 4, 20, 4, 4, blink(3) ? C.green : '#b8f818');
      T(tt, 318 - tW + 10, 18, '#b8f818', { shadow: null });
    }
    // pursuer distance bar (chase/ride): the dot on the left closes in on Carl at the right
    if (h.pursuer !== undefined && h.pursuer !== null) {
      var pf = clamp(+h.pursuer || 0, 0, 1), danger = pf > 0.75;
      var px0 = 120, pw = 80, py = 16;
      BOX(px0 - 14, py, pw + 20, 12, { border: danger && blink(6) ? C.red : C.dgray });
      icon(ctx, 'skull', px0 - 11, py + 2);
      R(px0, py + 5, pw, 2, C.ddgray);
      for (var k = 8; k < pw; k += 8) R(px0 + k, py + 4, 1, 4, C.ddgray);
      R(px0 + pw - 3, py + 2, 4, 8, C.white); R(px0 + pw - 2, py + 3, 2, 2, C.skin);
      var mxp = px0 + Math.round((pw - 8) * pf);
      R(mxp, py + 2, 5, 8, C.black); R(mxp + 1, py + 3, 3, 6, danger ? (blink(8) ? C.white : C.red) : C.red);
    }
    // combo popup
    var combo = h.combo || 0;
    if (combo > hudS.combo && combo > 1) hudS.pop = 0.18;
    hudS.combo = combo; if (hudS.pop > 0) hudS.pop -= dt;
    if (combo > 1) {
      var cc = combo >= 25 ? (blink(8) ? C.pink : C.gold) : combo >= 10 ? C.gold : C.white;
      var cy = hudS.pop > 0 ? -2 : 0;
      var r1 = T(combo, 6, 18 + cy, cc, { scale: 2 });
      T('HIT', 9 + r1.w, 18 + cy, cc); T('COMBO!', 9 + r1.w, 26 + cy, combo >= 10 ? C.white : C.gray);
    }
    // boss bar
    if (h.bossHp !== undefined && h.bossHp !== null) {
      var bf = clamp(h.bossHp, 0, 1);
      if (hudS.bossTrail === null || hudS.bossTrail < bf) hudS.bossTrail = bf; else hudS.bossTrail = Math.max(bf, hudS.bossTrail - dt * 0.35);
      R(0, 160, W, 20, C.black); R(0, 160, W, 1, C.line);
      icon(ctx, 'skull', 6, 163);
      T(fitText(h.bossName || 'BOSS', 290), 17, 163, C.gold);
      BAR(8, 173, 304, 4, hudS.bossTrail, C.white, C.dbrown);
      R(8, 173, Math.round(304 * bf), 4, C.red); R(8, 173, Math.round(304 * bf), 1, '#f87858');
    } else hudS.bossTrail = null;
  };
  ui.hudFromRun = function (extra) {
    var run = getRun() || {}, st = pStats(), lv = run.level || 1;
    var h = { hp: run.hp, maxHp: st.maxHp || run.hp, special: null, bombs: run.bombs, potions: run.potions, gold: run.gold,
      level: lv, xpFrac: (run.xp || 0) / xpNeed(lv), views: run.views, combo: 0, companion: equipped('companion'), bossHp: null, time: null, par: null,
      viewersOff: !viewersOn(), biscuits: biscuits(), jugs: flag('jugs'), taint: 0, pursuer: null };
    if (extra) for (var k in extra) h[k] = extra[k];
    return h;
  };

  /* ================================================================
     PAUSE
     ================================================================ */
  function toTitle() {
    closeAll();
    var r = tryCall(DCW.game, 'quitToTitle', []);
    if (r === MISSING) DCW.fade(function () { DCW.setScene(ui.scenes.title, {}); });
  }
  ui.toTitle = toTitle;
  ui.openPause = function (o) {
    o = o || {};
    if (ui.isOpen('pause')) return null;
    sfx('pause');
    var m = { kind: 'pause', sel: 0, canFlee: !!o.canFlee };
    function items() {
      var run = getRun(), n = run && run.boxes ? run.boxes.length : 0;
      return [
        { label: 'RESUME', action: function () { close(m); } },
        { label: 'CHARACTER', action: ui.openCharacter, badge: run && run.statPoints > 0 },
        { label: 'GEAR', action: function () { ui.openGear(); } },
        { label: 'LOOT BOXES (' + n + ')', action: ui.openBoxes, badge: n > 0 },
        { label: 'ACHIEVEMENTS', action: ui.openAchievements },
        { label: 'SETTINGS', action: ui.openSettings },
        m.canFlee ? { label: 'FLEE AREA', color: C.orange, action: function () {
          ui.confirm('FLEE THIS AREA? NO REWARDS. THE AUDIENCE WILL BOO.', function () { closeAll(); G('fleeStage'); });
        } } : null,
        { label: 'QUIT TO TITLE', action: function () { ui.confirm('QUIT TO TITLE? YOUR PROGRESS IS SAVED.', toTitle); } }
      ].filter(Boolean);
    }
    m.update = function (dt) {
      m.t += dt;
      var its = items();
      listNav(m, its.length, dt);
      if (P('confirm')) { sfx('menu_select'); var it = its[m.sel]; if (it && it.action) it.action(); }
      else if ((P('back') || P('start')) && m.t > 0.1) { sfx('menu_back'); close(m); }
    };
    m.draw = function (ctx) {
      var its = items(), run = getRun() || {}, fd = floorDef() || {};
      var h = 26 + its.length * 12 + 4;
      var y0 = Math.round(90 - h / 2);
      BOX(12, y0, 120, h);
      T('PAUSED', 72, y0 + 6, blink(1.5) ? C.gold : C.yellow, { align: 'center' });
      sep(18, y0 + 17, 108);
      its.forEach(function (it, i) {
        var yy = y0 + 22 + i * 12;
        if (i === m.sel) cursor(18, yy);
        T(it.label, 28, yy, i === m.sel ? (it.color || C.white) : (it.color || C.gray));
        if (it.badge && blink(2)) T('●', 124, yy, C.red, { shadow: null });
      });
      // right info panel
      var px = 140, py = 18, pw = 168, ph = 144;
      BOX(px, py, pw, ph);
      if (viewersOn()) {
        T('● LIVE', px + 8, py + 6, blink(1.2) ? C.red : C.dred);
        T(fmtNum(run.views || 0) + ' VIEWERS', px + pw - 8, py + 6, C.pink, { align: 'right' });
      } else {
        T('● OFF AIR', px + 8, py + 6, C.dgray);
        T('NOT LIVE YET', px + pw - 8, py + 6, C.dgray, { align: 'right' });
      }
      sep(px + 6, py + 16, pw - 12);
      var yy = py + 21;
      T('FLOOR ' + (run.floor || 1), px + 8, yy, C.gold);
      if (fd.days) T('COLLAPSE: ' + fd.days + ' DAYS', px + pw - 8, yy, C.red, { align: 'right' });
      yy += 10;
      wrap(fd.name || '', pw - 16).slice(0, 1).forEach(function (l) { T(l, px + 8, yy, C.white); yy += 10; });
      yy += 3;
      var st = pStats(), bis = biscuits();
      var rows = [
        ['LEVEL', String(run.level || 1), C.green],
        ['HP', Math.ceil(run.hp || 0) + '/' + (st.maxHp || '?'), C.red],
        ['GOLD', String(run.gold || 0), C.gold],
        [(flag('jugs') ? 'JUGS' : 'BOMBS') + ' / POTIONS', (run.bombs || 0) + ' / ' + (run.potions || 0), C.white],
        ['PET BISCUITS', String(bis), bis ? C.yellow : C.dgray],
        ['REVIVALS', String(run.revivals === undefined ? '-' : run.revivals), C.pink],
        ['FLOOR TIME', fmtTime(run.floorTime || 0) + (fd.par ? ' / ' + fmtTime(fd.par) : ''), fd.par && run.floorTime > fd.par ? C.red : C.white]
      ];
      rows.forEach(function (r) { T(r[0], px + 8, yy, C.gray); T(r[1], px + pw - 8, yy, r[2], { align: 'right' }); yy += 10; });
      sep(px + 6, py + ph - 25, pw - 12);
      T('FAN TITLE', px + 8, py + ph - 21, C.dgray);
      T(fitText(viewersOn() ? titleFor(run.views || 0) : 'NOBODY (YET)', pw - 70), px + pw - 8, py + ph - 21, C.pink, { align: 'right' });
      T(bn('select') + ': GEAR', px + 8, py + ph - 11, C.dgray, { shadow: null });
    };
    return push(m);
  };

  /* ================================================================
     CHARACTER
     ================================================================ */
  ui.openCharacter = function () {
    var m = { kind: 'character', sel: 0, msg: '', msgT: 0, pop: 0, popI: -1 };
    m.update = function (dt) {
      m.t += dt; if (m.msgT > 0) m.msgT -= dt; if (m.pop > 0) m.pop -= dt;
      var run = getRun();
      listNav(m, 4, dt);
      if (P('confirm')) {
        if (!run) { sfx('error'); m.msg = 'NO CRAWL IN PROGRESS.'; m.msgT = 1.6; }
        else if (!inSafe()) { sfx('error'); m.msg = 'STAT POINTS CAN ONLY BE SPENT IN A SAFE ROOM.'; m.msgT = 1.8; }
        else if (!(run.statPoints > 0)) { sfx('error'); m.msg = 'NO STAT POINTS. LEVEL UP FIRST.'; m.msgT = 1.6; }
        else {
          var stat = STATS[m.sel], ok;
          if (hasG('spendStat')) ok = G('spendStat', stat);
          else { run.stats[stat]++; run.statPoints--; ok = true; sfx('menu_select'); persist(); }
          if (ok) { m.pop = 0.4; m.popI = m.sel; } else { m.msg = 'CAN\'T DO THAT.'; m.msgT = 1.4; }
        }
      } else if (P('select')) { sfx('menu_select'); ui.openGear(); }
      else if (backPressed() || P('start')) { sfx('menu_back'); close(m); }
    };
    m.draw = function (ctx) {
      var run = getRun() || { level: 1, xp: 0, statPoints: 0, stats: { str: 3, con: 3, dex: 3, int: 3 }, views: 0 };
      var safeNow = inSafe();
      frame(ctx, 'CRAWLER PROFILE', { footer: safeNow ? '↑↓:STAT  ' + bn('confirm') + ':SPEND POINT  ' + bn('back') + ':BACK' : 'SPEND POINTS IN A SAFE ROOM  ' + bn('back') + ':BACK' });
      // left: portrait column
      BOX(10, 22, 110, 70, { fill: C.black, border: C.dgray });
      R(12, 80, 106, 10, C.dbrown); R(12, 80, 106, 1, C.tan);
      bigSprite(ctx, 'carl_idle', 46, 84, { scale: 2, skin: equipped('skin'), frame: Math.floor((DCW.t || 0) * 2) % 2 });
      bigSprite(ctx, compSprite(equipped('companion')) + '_idle', 94, 84, { scale: 2, frame: Math.floor((DCW.t || 0) * 2) % 2 });
      var lv = run.level || 1, need = xpNeed(lv);
      T('CARL  LEVEL ' + lv, 12, 98, C.green);
      BAR(12, 109, 106, 4, (run.xp || 0) / need, C.green, C.ddgreen);
      T('XP ' + (run.xp || 0) + '/' + need, 12, 116, C.gray);
      T('CRAWLER TITLE', 12, 128, C.dgray);
      wrap(viewersOn() ? titleFor(run.views || 0) : 'NOBODY. YOU ARE OFF AIR.', 108).slice(0, 2).forEach(function (l, i) { T(l, 12, 138 + i * 10, C.pink); });
      // right: stats
      var px = 128;
      var pts = run.statPoints || 0;
      T('STAT POINTS: ' + pts, px, 24, pts > 0 ? (blink(2) ? C.gold : C.yellow) : C.dgray);
      STATS.forEach(function (s, i) {
        var yy = 37 + i * 11, inf = STAT_INFO[s];
        if (i === m.sel) cursor(px, yy);
        icon(ctx, inf.icon, px + 9, yy - 1);
        T(inf.short, px + 20, yy, i === m.sel ? C.white : C.gray);
        var v = (run.stats && run.stats[s]) || 0;
        T(v, px + 66, yy, m.pop > 0 && m.popI === i ? C.gold : C.white, { align: 'right' });
        if (pts > 0 && safeNow) T('[+]', px + 72, yy, i === m.sel ? C.gold : C.dgray);
      });
      var st = pStats();
      var d = [
        ['MAX HP', st.maxHp], ['DEFENSE', st.def || 0],
        ['PUNCH', st.dmg], ['KICK', st.kickDmg],
        ['CRIT', Math.round((st.crit || 0) * 100) + '%'], ['SPEED', Math.round((st.speedMul || 1) * 100) + '%'],
        [flag('jugs') ? 'JUG' : 'BOMB', st.bombDmg], ['DONUT', Math.round((st.compPower || 1) * 100) + '%']
      ];
      sep(px, 83, 180);
      d.forEach(function (r, i) {
        var cx = px + (i % 2) * 92, cy = 88 + Math.floor(i / 2) * 10;
        T(r[0], cx, cy, C.dgray); T(r[1] === undefined ? '-' : r[1], cx + 84, cy, C.white, { align: 'right' });
      });
      sep(px, 130, 180);
      var inf2 = STAT_INFO[STATS[m.sel]];
      var msg = m.msgT > 0 ? m.msg : inf2.name + ': ' + inf2.desc;
      wrap(msg, 178).slice(0, 2).forEach(function (l, i) { T(l, px, 135 + i * 10, m.msgT > 0 ? C.red : C.gray); });
    };
    return push(m);
  };

  /* ================================================================
     LOOT BOXES
     ================================================================ */
  function darken(col) {
    var c = nes(col), r = parseInt(c.slice(1, 3), 16), g = parseInt(c.slice(3, 5), 16), b = parseInt(c.slice(5, 7), 16);
    var f = 0.42, hx = function (v) { var s = Math.round(v * f).toString(16); return s.length < 2 ? '0' + s : s; };
    var d = nes('#' + hx(r) + hx(g) + hx(b));
    return d === C.black ? C.navy : d;
  }
  // chunky NES sunburst: 4x4 blocks, solid color, no anti-aliased polygons
  function rays(ctx, cx, cy, col, spin, x0, y0, w, h) {
    ctx.fillStyle = col;
    var N = 12, seg = Math.PI * 2 / N;
    for (var by = y0; by < y0 + h; by += 4) for (var bx = x0; bx < x0 + w; bx += 4) {
      var a = Math.atan2(by + 2 - cy, bx + 2 - cx) - spin;
      var k = ((a % seg) + seg) % seg;
      if (k < seg * 0.38) ctx.fillRect(bx, by, 4, 4);
    }
  }
  function bigIcon(ctx, name, x, y, s) {
    var c = document.createElement('canvas'); c.width = 8; c.height = 8;
    var g = c.getContext('2d'); g.imageSmoothingEnabled = false;
    icon(g, name, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(c, 0, 0, 8, 8, Math.round(x), Math.round(y), 8 * s, 8 * s);
  }
  ui.openBoxes = function () {
    var m = { kind: 'boxes', sel: 0, scroll: 0, mode: 'list', parts: [], rewards: [], shown: 0, prevMusic: null, quip: '' };
    function boxes() { var r = getRun(); return (r && r.boxes) || []; }
    function startOpen() {
      var list = boxes(); if (!list.length) return;
      var b = list[m.sel] || list[0];
      m.tier = b.tier; m.from = b.from; m.boxName = b.name || null;
      var rw = G('openLootBox', m.sel);
      if (!Array.isArray(rw)) {
        if (!hasG('openLootBox')) { list.splice(m.sel, 1); rw = [{ kind: 'gold', amount: 0 }]; }
        else rw = [];
      }
      m.rewards = rw.map(function (r) { var inf = rewardInfo(r); inf.r = r; inf.t = -1; return inf; });
      m.mode = 'shake'; m.mt = 0; m.shk = 0; m.shown = 0; m.revealT = 0; m.parts = [];
      if (m.prevMusic === null) m.prevMusic = curMusic() || '';
      music('lootbox');
      m.quip = aiLine('lootbox', 'ANOTHER BOX! THE SPONSORS ADORE YOU. OR PITY YOU. HARD TO TELL.');
    }
    function burst() {
      m.mode = 'reveal'; m.mt = 0; m.revealT = 0.25;
      sfx('lootbox_open'); if (DCW.shake) DCW.shake(3, 0.3);
      var col = boxColor(m.tier);
      for (var i = 0; i < 46; i++) {
        var a = Math.random() * Math.PI * 2, sp = 40 + Math.random() * 130;
        m.parts.push({ x: 160, y: 96, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 40, life: 0.6 + Math.random() * 0.8, c: Math.random() < 0.5 ? col : (Math.random() < 0.5 ? C.white : C.yellow) });
      }
    }
    m.onClose = function () { if (m.prevMusic !== null) music(m.prevMusic || null); };
    m.update = function (dt) {
      m.t += dt; m.mt = (m.mt || 0) + dt;
      m.parts.forEach(function (p) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 160 * dt; p.life -= dt; });
      m.parts = m.parts.filter(function (p) { return p.life > 0; });
      if (m.mode === 'list') {
        var n = boxes().length;
        listNav(m, n, dt); scrollTo(m, 6, n);
        if (m.lockT > 0) m.lockT -= dt;
        if (P('confirm')) {
          if (!n) sfx('error');
          else if (!inSafe()) { sfx('error'); m.lockT = 1.8; }
          else { sfx('menu_select'); startOpen(); }
        }
        else if (backPressed() || P('start')) { sfx('menu_back'); close(m); }
      } else if (m.mode === 'shake') {
        m.shk -= dt;
        if (m.shk <= 0) { sfx('lootbox_shake', { pitch: 1 + m.mt * 0.3 }); m.shk = Math.max(0.12, 0.34 - m.mt * 0.12); }
        if (m.mt >= 1.9 || (P('confirm') && m.mt > 0.3)) burst();
      } else if (m.mode === 'reveal') {
        m.revealT -= dt;
        if (m.shown < m.rewards.length && m.revealT <= 0) {
          var rw = m.rewards[m.shown]; rw.t = 0; m.shown++;
          if (rw.unlock) { m.mode = 'card'; m.card = rw; m.mt = 0; sfx('unlock'); sfx('fanfare'); }
          else { sfx(rw.r && rw.r.kind === 'gold' ? 'coin' : 'pickup'); m.revealT = 0.5; }
        }
        m.rewards.forEach(function (r) { if (r.t >= 0) r.t += dt; });
        if (m.shown >= m.rewards.length && m.revealT <= -0.4) { m.mode = 'done'; m.mt = 0; }
        if (P('confirm')) m.revealT = Math.min(m.revealT, 0);
      } else if (m.mode === 'card') {
        m.rewards.forEach(function (r) { if (r.t >= 0) r.t += dt; });
        if (P('confirm') && m.mt > 0.5) { sfx('menu_select'); m.mode = 'reveal'; m.revealT = 0.35; }
      } else if (m.mode === 'done') {
        if ((P('confirm') || backPressed()) && m.mt > 0.25) {
          sfx('menu_back'); m.mode = 'list'; m.sel = clamp(m.sel, 0, Math.max(0, boxes().length - 1));
          if (m.prevMusic !== null) { music(m.prevMusic || null); m.prevMusic = null; }
        }
      }
    };
    m.draw = function (ctx) {
      var list = boxes();
      if (m.mode === 'list') {
        var canOpen = inSafe();
        frame(ctx, 'LOOT BOXES', { footer: !list.length ? bn('back') + ':BACK' : canOpen ? bn('confirm') + ':OPEN  ' + bn('back') + ':BACK' : 'OPEN BOXES IN A SAFE ROOM  ' + bn('back') + ':BACK' });
        if (!list.length) {
          bigSprite(ctx, 'box_bronze', 160, 82, { scale: 3, silhouette: C.navy });
          T('NO UNOPENED BOXES.', 160, 92, C.white, { align: 'center' });
          if (!m.empty) m.empty = aiLine('boxEmpty', 'NO BOXES? GO HIT SOMETHING. THE SPONSORS ARE WATCHING.');
          wrap(String(m.empty).toUpperCase(), 270).slice(0, 4).forEach(function (l, i) { T(l, 160, 108 + i * 10, C.gray, { align: 'center' }); });
        } else {
          T(list.length + ' UNOPENED', 300, 21, C.dgray, { align: 'right', shadow: null });
          var vis = 6;
          for (var i = m.scroll; i < Math.min(list.length, m.scroll + vis); i++) {
            var b = list[i], yy = 32 + (i - m.scroll) * 21;
            if (i === m.sel) { R(10, yy - 2, 300, 20, C.sel); cursor(13, yy + 4); }
            spr(ctx, 'box_' + b.tier, 32, yy + 16, { frame: i === m.sel ? Math.floor((DCW.t || 0) * 6) : 0 });
            T(fitText(b.name || tierName(b.tier), 250), 46, yy, boxColor(b.tier));
            T(fitText('FROM: ' + (b.from || 'THE SPONSORS'), 250), 46, yy + 9, i === m.sel ? C.gray : C.dgray, { shadow: null });
          }
          scrollArrows(300, 30, 152, m.scroll, vis, list.length);
        }
        if (m.lockT > 0 && list.length) {
          BOX(50, 70, 220, 34, { border: C.red });
          T('BOXES ONLY OPEN IN A SAFE ROOM', 160, 77, C.red, { align: 'center' });
          T('THE SPONSORS WANT IT ON CAMERA.', 160, 89, C.gray, { align: 'center', shadow: null });
        }
        return;
      }
      // opening animation
      R(0, 0, W, H, C.black);
      var col = boxColor(m.tier);
      var spin = Math.floor((DCW.t || 0) * (m.mode === 'shake' ? 6 + m.mt * 6 : 4)) * 0.05;
      rays(ctx, 160, 92, darken(col), spin, 0, 28, W, H - 28);
      T(fitText(m.boxName || tierName(m.tier), 312), 160, 8, col, { align: 'center' });
      if (m.from) T(fitText('FROM: ' + m.from, 300), 160, 18, C.gray, { align: 'center', shadow: null });
      if (m.mode === 'shake') {
        var amp = 1 + m.mt * 2.2;
        var ox = Math.round((Math.random() * 2 - 1) * amp), oy = Math.round((Math.random() * 2 - 1) * amp * 0.5);
        bigSprite(ctx, 'box_' + m.tier, 160 + ox, 118 + oy, { scale: 3, flash: m.mt > 1.5 && blink(12) });
        T('OPENING...', 160, 140, blink(3) ? C.white : C.gray, { align: 'center' });
      }
      m.parts.forEach(function (p) { R(Math.round(p.x), Math.round(p.y), 2, 2, p.c); });
      // the burst: two full white frames, NES style
      if (m.mode === 'reveal' && m.shown <= 1 && (m.mt < 0.05 || (m.mt > 0.1 && m.mt < 0.15))) R(0, 0, W, H, C.white);
      // reward rows
      var n = m.rewards.length, rowH = 13, y0 = Math.round(Math.max(30, 86 - n * rowH / 2));
      if (m.mode !== 'shake' && m.shown > 0) {
        var pw = 0; m.rewards.forEach(function (r) { if (r.t >= 0) pw = Math.max(pw, tw(r.text) + 24); });
        BOX(160 - pw / 2 - 2, y0 - 5, pw + 4, m.shown * rowH + 8, { border: col });
      }
      m.rewards.forEach(function (r, i) {
        if (r.t < 0) return;
        var k = clamp(r.t / 0.3, 0, 1), e = 1 - Math.pow(1 - k, 3);
        var wdt = tw(r.text) + 12, tx = Math.round(160 - wdt / 2), ty = y0 + i * rowH;
        var x = Math.round(160 + (tx - 160) * e), y = Math.round(96 + (ty - 96) * e);
        icon(ctx, r.icon, x, y);
        T(r.text, x + 12, y + 1, r.color);
      });
      if (m.mode === 'card' && m.card) {
        var c = m.card, rr = c.r || {};
        BOX(60, 26, 200, 128, { border: C.gold });
        var head = rr.kind === 'gear' ? 'NEW GEAR!' : rr.kind === 'companion' ? 'NEW COMPANION!' : 'NEW OUTFIT UNLOCKED!';
        T(head, 160, 32, blink(3) ? C.gold : C.yellow, { align: 'center' });
        ctx.save(); ctx.beginPath(); ctx.rect(62, 44, 196, 62); ctx.clip(); rays(ctx, 160, 76, C.dbrown, Math.floor((DCW.t || 0) * 4) * 0.05, 62, 44, 196, 62); ctx.restore();
        var gd = null;
        if (rr.kind === 'gear') {
          gd = gearDef(rr.id) || {};
          bigIcon(ctx, gearIcon(rr.id), 144, 58 + (blink(2) ? 0 : -1), 4);
        } else if (rr.kind === 'companion') bigSprite(ctx, compSprite(rr.id) + '_idle', 160, 102, { scale: 3, frame: Math.floor((DCW.t || 0) * 2) % 2 });
        else bigSprite(ctx, 'carl_idle', 160, 102, { scale: 2, skin: rr.id, frame: Math.floor((DCW.t || 0) * 2) % 2 });
        for (var s = 0; s < 6; s++) { var sa = Math.floor((DCW.t || 0) * 8) / 4 + s; R(160 + Math.round(Math.cos(sa) * 40), 76 + Math.round(Math.sin(sa * 1.3) * 22), 2, 2, C.white); }
        var nm = rr.kind === 'gear' ? gearName(rr.id) : rr.kind === 'companion' ? compName(rr.id) : skinName(rr.id);
        var nl = wrap(nm, 190).slice(0, 2);
        nl.forEach(function (l, i) { T(l, 160, 108 + i * 9 - (nl.length - 1) * 4, C.white, { align: 'center' }); });
        var def = rr.kind === 'gear' ? gd : rr.kind === 'companion' ? compDef(rr.id) : skinDef(rr.id);
        var extra = rr.kind === 'gear' ? perkText(def && def.perk) : rr.kind === 'companion' ? (def && def.desc) : (def && (perkText(def.perk) ? 'PERK: ' + perkText(def.perk) : def.desc));
        wrap(String(extra || '').toUpperCase(), 186).slice(0, 2).forEach(function (l, i) { T(l, 160, 122 + i * 9, rr.kind === 'gear' ? C.green : C.gray, { align: 'center' }); });
        if (m.mt > 0.5 && blink(2)) T(bn('confirm') + ': SWEET', 160, 142, C.gold, { align: 'center' });
      }
      if (m.mode === 'done') {
        BOX(4, 134, 312, 42);
        R(9, 138, 34, 34, C.white); R(10, 139, 32, 32, C.black); portrait(ctx, 'p_ai', 10, 139);
        wrap(String(m.quip).toUpperCase(), 262).slice(0, 3).forEach(function (l, i) { T(l, 48, 140 + i * 10, C.white); });
        if (blink(2.5)) T('▼', 304, 166, C.gold);
      }
    };
    return push(m);
  };

  /* ================================================================
     READER - full text, scrollable (descriptions that don't fit a panel)
     ================================================================ */
  // o = { title, titleColor, border, blocks: [{ head, text, color }] }
  ui.readMore = function (o) {
    o = o || {};
    var m = { kind: 'reader', scroll: 0 };
    var lines = [];
    (o.blocks || []).forEach(function (b) {
      if (!b || (!b.text && !b.head)) return;
      if (lines.length) lines.push(['', C.gray]);
      if (b.head) lines.push([String(b.head).toUpperCase(), b.headColor || C.gold]);
      if (b.text) wrap(String(b.text).toUpperCase(), 284).forEach(function (t) { lines.push([t, b.color || C.white]); });
    });
    var VIS = 13;
    var maxScroll = Math.max(0, lines.length - VIS);
    m.update = function (dt) {
      m.t += dt;
      if (rep(m, 'down', dt)) { if (m.scroll < maxScroll) { m.scroll++; sfx('menu_move'); } }
      else if (rep(m, 'up', dt)) { if (m.scroll > 0) { m.scroll--; sfx('menu_move'); } }
      else if (P('right')) { m.scroll = Math.min(maxScroll, m.scroll + VIS - 1); }
      else if (P('left')) { m.scroll = Math.max(0, m.scroll - VIS + 1); }
      else if (m.t > 0.1 && (backPressed() || P('confirm') || P('start') || P('special') || P('select'))) { sfx('menu_back'); close(m); }
    };
    m.draw = function (ctx) {
      frame(ctx, o.title || 'DETAILS', { titleColor: o.titleColor, border: o.border,
        footer: maxScroll ? '↑↓:SCROLL  ◀▶:PAGE  ' + bn('back') + ':CLOSE' : bn('back') + ':CLOSE' });
      for (var i = 0; i < VIS && i + m.scroll < lines.length; i++) {
        var ln = lines[i + m.scroll];
        T(ln[0], 14, 24 + i * 10, ln[1]);
      }
      if (maxScroll) {
        scrollArrows(302, 20, 152, m.scroll, VIS, lines.length);
        var trackH = VIS * 10 - 8, thumb = Math.max(8, Math.round(trackH * VIS / lines.length));
        R(304, 30, 2, trackH, C.line);
        R(304, 30 + Math.round((trackH - thumb) * m.scroll / maxScroll), 2, thumb, C.gray);
      }
    };
    return push(m);
  };

  /* ================================================================
     GEAR - the run's book loot, perk totals, outfits
     ================================================================ */
  function runGear() {
    var l = G('gearList');
    if (!Array.isArray(l)) {
      var r = getRun(), tab = D('gear') || {}, order = Object.keys(tab);
      l = (r && r.gear) ? Object.keys(r.gear).filter(function (k) { return r.gear[k]; }).map(function (id) { return { id: id, def: tab[id] }; }) : [];
      l.sort(function (a, b) { return order.indexOf(a.id) - order.indexOf(b.id); });
    }
    return l.filter(function (e) { return e && e.id; }).map(function (e) { return { id: e.id, def: e.def || gearDef(e.id) || { name: String(e.id).toUpperCase() } }; });
  }
  ui.gearList = runGear;
  function gearTotals() {
    var t = G('gearPerks');
    if (t && typeof t === 'object') return t;
    var out = {};
    runGear().forEach(function (g) {
      var p = g.def.perk || {};
      Object.keys(p).forEach(function (k) { if (typeof p[k] === 'number') out[k] = (out[k] || 0) + p[k]; else if (p[k]) out[k] = p[k]; });
    });
    return out;
  }
  function outfits() {
    var tab = D('skins') || {}, s = save(), known = Object.keys(tab).length > 0, out = ['carl_boxers'];
    var add = function (id) { if (id && out.indexOf(id) < 0 && (!known || tab[id])) out.push(id); };
    ((s.unlocks && s.unlocks.skins) || []).forEach(add);
    runGear().forEach(function (g) { add(g.def.skin); });
    if (known) out = out.filter(function (id) { return tab[id] || id === 'carl_boxers'; });
    // keep the data's order (boxers, trollskin, bigboi)
    if (known) { var ord = Object.keys(tab); out.sort(function (a, b) { return (ord.indexOf(a) + 99) % 99 - (ord.indexOf(b) + 99) % 99; }); }
    return out;
  }
  ui.openGear = function () {
    if (ui.isOpen('gear')) return null;
    var m = { kind: 'gear', sel: 0, scroll: 0, msg: '', msgT: 0, skinI: -1 };
    function rows() {
      var list = runGear(), out = [{ type: 'sum' }];
      var carl = list.filter(function (g) { return g.def.who !== 'donut'; }), donut = list.filter(function (g) { return g.def.who === 'donut'; });
      if (carl.length) { out.push({ type: 'head', text: 'CARL' }); carl.forEach(function (g) { out.push({ type: 'gear', g: g }); }); }
      if (donut.length) { out.push({ type: 'head', text: 'PRINCESS DONUT' }); donut.forEach(function (g) { out.push({ type: 'gear', g: g }); }); }
      var sk = outfits();
      if (sk.length > 1) out.push({ type: 'outfit', skins: sk });
      return out;
    }
    function textBlocks(row) {
      if (!row) return [];
      if (row.type === 'sum') {
        var pl = perkLines(gearTotals()), n = runGear().length;
        return [{ head: n ? n + ' PIECE' + (n > 1 ? 'S' : '') + ' OF GEAR' : 'NO GEAR YET', text: n ? '' : 'THE DUNGEON PROVIDES. EVENTUALLY. MOSTLY BOXERS.', color: C.gray },
          { head: 'TOTAL PERKS', headColor: C.green, text: pl.length ? pl.join('\n') : 'NONE. YOU ARE RUNNING ON SPITE.', color: pl.length ? C.green : C.dgray }];
      }
      if (row.type === 'outfit') {
        var id = row.skins[m.skinI] || row.skins[0], sd = skinDef(id) || {};
        return [{ head: skinName(id), text: sd.desc || '', color: C.gray },
          sd.perk ? { head: 'PERK', headColor: C.green, text: perkText(sd.perk), color: C.green } : null].filter(Boolean);
      }
      var d = row.g.def || {}, pk = perkLines(d.perk);
      return [{ head: d.name || row.g.id, text: '', color: C.white },
        pk.length ? { text: pk.join('\n'), color: C.green } : null,
        d.desc ? { text: d.desc, color: C.gray } : null,
        d.skin ? { text: 'OUTFIT: ' + skinName(d.skin), color: C.blue } : null].filter(Boolean);
    }
    function selectable(rs, i) { return rs[i] && rs[i].type !== 'head'; }
    function syncSkin(rs) { var r = rs[m.sel]; if (r && r.type === 'outfit' && m.skinI < 0) m.skinI = Math.max(0, r.skins.indexOf(equipped('skin'))); }
    m.update = function (dt) {
      m.t += dt; if (m.msgT > 0) m.msgT -= dt;
      var rs = rows();
      listNav(m, rs.length, dt, true, function (i) { return !selectable(rs, i); });
      if (!selectable(rs, m.sel)) m.sel = 0;
      scrollTo(m, 12, rs.length);
      syncSkin(rs);
      var row = rs[m.sel];
      if (row && row.type === 'outfit') {
        if (rep(m, 'left', dt)) { m.skinI = (m.skinI + row.skins.length - 1) % row.skins.length; sfx('menu_move'); }
        else if (rep(m, 'right', dt)) { m.skinI = (m.skinI + 1) % row.skins.length; sfx('menu_move'); }
        else if (P('confirm')) {
          var id = row.skins[m.skinI];
          if (equipped('skin') === id) { sfx('menu_move'); m.msg = 'ALREADY WEARING IT.'; m.msgT = 1.0; }
          else {
            var ok = hasG('equip') ? G('equip', 'skin', id) : (function () { var s = save(); s.equipped.skin = id; persist(); return true; })();
            if (ok !== false) { sfx('menu_select'); m.msg = 'LOOKING GOOD, CARL.'; m.msgT = 1.2; } else { m.msg = 'CAN\'T WEAR THAT.'; m.msgT = 1.2; }
          }
        }
      } else if (P('confirm') && row) {
        sfx('menu_select');
        var bl = textBlocks(row);
        ui.readMore({ title: row.type === 'sum' ? 'GEAR' : (row.g.def.name || row.g.id), titleColor: C.gold, blocks: bl.map(function (b, i) { return row.type === 'gear' && i === 0 ? { head: (row.g.def.who === 'donut' ? 'DONUT' : 'CARL') + '\'S GEAR', text: '', headColor: C.dgray } : b; }) });
        return;
      }
      if (row && row.type !== 'outfit') m.skinI = -1;
      if ((backPressed() || P('start') || P('select')) && m.t > 0.1) { sfx('menu_back'); close(m); }
    };
    m.draw = function (ctx) {
      var rs = rows(), row = rs[m.sel] || rs[0];
      var outfitRow = row && row.type === 'outfit';
      frame(ctx, 'GEAR', { footer: outfitRow ? '◀▶:OUTFIT  ' + bn('confirm') + ':WEAR  ' + bn('back') + ':BACK' : '↑↓:PICK  ' + bn('confirm') + ':READ  ' + bn('back') + ':BACK' });
      // list
      var vis = 12;
      for (var i = m.scroll; i < Math.min(rs.length, m.scroll + vis); i++) {
        var r = rs[i], yy = 22 + (i - m.scroll) * 11, act = i === m.sel;
        if (act) R(9, yy - 2, 136, 11, C.sel);
        if (r.type === 'head') { T(r.text, 12, yy, C.dgray, { shadow: null }); sep(12 + tw(r.text) + 4, yy + 3, 128 - tw(r.text) - 4); continue; }
        if (r.type === 'sum') { icon(ctx, 'star', 12, yy - 1); T('ALL PERKS', 23, yy, act ? C.gold : C.yellow); continue; }
        if (r.type === 'outfit') {
          var cur = r.skins[act ? m.skinI : r.skins.indexOf(equipped('skin'))] || r.skins[0];
          icon(ctx, 'shield', 12, yy - 1);
          T(act ? '◀' : '', 23, yy, C.gold); T(fitText(skinName(cur), 96), 31, yy, act ? C.white : C.gray); if (act) T('▶', 136, yy, C.gold, { align: 'right' });
          continue;
        }
        icon(ctx, r.g.def.icon || 'gear', 12, yy - 1);
        T(fitText(r.g.def.name || r.g.id, 118), 23, yy, act ? C.white : C.gray);
      }
      scrollArrows(140, 18, 152, m.scroll, vis, rs.length);
      // preview
      var px = 150, pw = 158;
      BOX(px, 20, pw, 56, { border: C.dgray });
      R(px + 2, 64, pw - 4, 10, C.dbrown); R(px + 2, 64, pw - 4, 1, C.tan);
      var fr = Math.floor((DCW.t || 0) * 2) % 2;
      var skin = outfitRow ? (row.skins[m.skinI] || equipped('skin')) : equipped('skin');
      var who = row && row.type === 'gear' ? (row.g.def.who === 'donut' ? 'donut' : 'carl') : 'both';
      if (who !== 'donut') bigSprite(ctx, 'carl_idle', px + (who === 'both' ? 50 : 60), 66, { scale: 2, skin: skin, frame: fr });
      if (who !== 'carl' || outfitRow) bigSprite(ctx, compSprite(equipped('companion')) + '_idle', px + (who === 'donut' ? 60 : 108), 66, { scale: 2, frame: fr, flip: who !== 'donut' });
      if (row && row.type === 'gear') bigIcon(ctx, row.g.def.icon || 'gear', px + 104, 32 + (blink(1.5) ? 0 : -2), 3);
      if (outfitRow && equipped('skin') === skin) T('WEARING', px + pw - 6, 24, C.green, { align: 'right', shadow: null });
      // text
      var lines = [];
      textBlocks(row).forEach(function (b) {
        if (b.head) wrap(String(b.head).toUpperCase(), pw - 10).forEach(function (t) { lines.push([t, b.headColor || C.gold]); });
        if (b.text) wrap(String(b.text).toUpperCase(), pw - 10).forEach(function (t) { lines.push([t, b.color || C.gray]); });
      });
      var FIT = 7;
      if (lines.length > FIT) { lines = lines.slice(0, FIT - 1); lines.push([(blink(2) ? '▼ ' : '  ') + bn('confirm') + ': READ MORE', C.white]); }
      lines.forEach(function (ln, k) { T(ln[0], px + 2, 82 + k * 10, ln[1]); });
      if (m.msgT > 0) { BOX(80, 74, 160, 18, { border: /GOOD|ALREADY/.test(m.msg) ? C.green : C.red }); T(fitText(m.msg, 150), 160, 79, /GOOD|ALREADY/.test(m.msg) ? C.green : C.red, { align: 'center' }); }
    };
    return push(m);
  };
  // the old wardrobe and map buttons now lead to the gear screen (Book One has no overworld)
  ui.openWardrobe = function () { return ui.openGear(); };
  ui.openMap = function () { return ui.openGear(); };

  /* ================================================================
     ACHIEVEMENTS
     ================================================================ */
  function achReward(a) {
    var s = String(a.box || 'bronze').toUpperCase() + ' BOX';
    if (a.gear) s += ' + ' + gearName(a.gear);
    return s;
  }
  ui.openAchievements = function () {
    var m = { kind: 'achievements', sel: 0, scroll: 0 };
    function list() { var d = D('achievements') || {}; return Object.keys(d).map(function (id) { var a = d[id] || {}; return { id: id, a: a }; }); }
    function got(id) { var s = save(); return !!(s.meta && s.meta.achievements && s.meta.achievements[id]); }
    var LOCKED = '??? KEEP CRAWLING. THE AI WILL TELL YOU WHEN YOU DO SOMETHING DUMB ENOUGH.';
    m.update = function (dt) {
      m.t += dt;
      var l = list();
      listNav(m, l.length, dt); scrollTo(m, 12, l.length);
      if ((P('confirm') || P('special')) && l[m.sel]) {
        var e = l[m.sel], a = e.a, g = got(e.id);
        var cnt = (save().meta && save().meta.counters && save().meta.counters[a.event]) || 0;
        sfx('menu_select');
        ui.readMore({ title: g ? (a.name || e.id) : 'LOCKED ACHIEVEMENT', titleColor: g ? C.gold : C.dgray, border: g ? C.gold : C.dgray, blocks: [
          { text: g ? (a.desc || '') : LOCKED, color: g ? C.white : C.dgray },
          (!g && (a.count || 1) > 1) ? { head: 'PROGRESS', text: Math.min(cnt, a.count) + ' / ' + a.count, color: C.gray } : null,
          { head: 'REWARD', text: achReward(a), color: boxColor(a.box || 'bronze') }
        ].filter(Boolean) });
      } else if (backPressed() || P('start')) { sfx('menu_back'); close(m); }
    };
    m.draw = function (ctx) {
      var l = list(), n = l.filter(function (e) { return got(e.id); }).length;
      frame(ctx, 'ACHIEVEMENTS', { footer: '↑↓:BROWSE  ' + bn('confirm') + ':READ  ' + bn('back') + ':BACK' });
      T('UNLOCKED ' + n + '/' + l.length, 12, 21, C.white);
      BAR(110, 23, 44, 3, l.length ? n / l.length : 0, C.gold, C.dbrown);
      if (!l.length) { T('NO ACHIEVEMENTS LOADED.', 160, 90, C.gray, { align: 'center' }); return; }
      var vis = 12;
      for (var i = m.scroll; i < Math.min(l.length, m.scroll + vis); i++) {
        var e = l[i], yy = 33 + (i - m.scroll) * 10, g = got(e.id);
        if (i === m.sel) R(10, yy - 1, 148, 10, C.sel);
        icon(ctx, g ? 'star' : 'lock', 13, yy);
        T(fitText(g ? (e.a.name || e.id) : '???', 128), 24, yy + 1, g ? (i === m.sel ? C.gold : C.yellow) : (i === m.sel ? C.gray : C.dgray));
      }
      scrollArrows(150, 29, 153, m.scroll, vis, l.length);
      var e2 = l[m.sel]; if (!e2) return;
      var g2 = got(e2.id), a = e2.a;
      var px = 164, pw = 144;
      BOX(px, 20, pw, 138, { fill: g2 ? C.dbrown : C.black, border: g2 ? C.gold : C.dgray });
      bigSprite(ctx, 'box_' + (a.box || 'bronze'), px + 20, 46, { scale: 1, silhouette: g2 ? null : C.ddgray });
      var yy2 = 26;
      wrap(g2 ? (a.name || e2.id) : '???', pw - 44).slice(0, 2).forEach(function (t) { T(t, px + 36, yy2, g2 ? C.gold : C.dgray); yy2 += 10; });
      yy2 = Math.max(yy2, 50) + 4;
      var dl = wrap(String(g2 ? (a.desc || '') : LOCKED).toUpperCase(), pw - 12);
      if (dl.length > 6) { dl = dl.slice(0, 5); dl.push((blink(2) ? '▼ ' : '  ') + bn('confirm') + ': READ ALL'); }
      dl.forEach(function (t, i) { T(t, px + 6, yy2, i === 5 && t.indexOf('READ ALL') >= 0 ? C.gold : g2 ? C.white : C.dgray); yy2 += 10; });
      var cnt = (save().meta && save().meta.counters && save().meta.counters[a.event]) || 0;
      if (!g2 && (a.count || 1) > 1) {
        T('PROGRESS ' + Math.min(cnt, a.count) + '/' + a.count, px + 6, 124, C.gray);
        BAR(px + 6, 135, pw - 12, 2, cnt / a.count, C.green, C.ddgreen);
      }
      T(fitText('REWARD: ' + achReward(a), pw - 12), px + 6, 145, g2 ? boxColor(a.box || 'bronze') : C.dgray, { shadow: null });
    };
    return push(m);
  };

  /* ================================================================
     SETTINGS
     ================================================================ */
  function settings() { var s = save(); s.settings = s.settings || {}; return s.settings; }
  function applySettings() {
    if (typeof DCW.applyCrt === 'function') { try { DCW.applyCrt(); } catch (e) { /* ignore */ } }
    if (typeof DCW.applyTouchSetting === 'function') { try { DCW.applyTouchSetting(); } catch (e) { /* ignore */ } }
    tryCall(DCW.audio, 'setVolumes', []);
  }
  ui.openSettings = function () {
    var m = { kind: 'settings', sel: 0 };
    var TOUCH = ['auto', 'on', 'off'];
    function rows() {
      var s = settings();
      return [
        { label: 'MUSIC', type: 'vol', key: 'music' },
        { label: 'SOUND FX', type: 'vol', key: 'sfx' },
        { label: 'SCREEN SHAKE', type: 'bool', key: 'shake', val: s.shake !== false },
        { label: 'CRT FILTER', type: 'bool', key: 'crt', val: s.crt !== false },
        { label: 'TOUCH CONTROLS', type: 'touch', key: 'touch', val: String(s.touch || 'auto').toUpperCase() },
        { label: 'EASY MODE (HALF DAMAGE)', type: 'bool', key: 'easy', val: s.easy === true },
        { label: 'KEYBOARD CONTROLS', type: 'controls' },
        { label: 'ERASE THIS SAVE SLOT', type: 'reset' },
        { label: 'BACK', type: 'back' }
      ];
    }
    function change(r, d) {
      var s = settings();
      if (r.type === 'vol') { var v = Math.round(clamp((s[r.key] === undefined ? 0.6 : s[r.key]) + d * 0.1, 0, 1) * 10) / 10; s[r.key] = v; applySettings(); sfx(r.key === 'sfx' ? 'coin' : 'menu_move'); }
      else if (r.type === 'bool') { s[r.key] = r.key === 'easy' ? !(s.easy === true) : !(s[r.key] !== false); applySettings(); sfx('menu_move'); if (r.key === 'shake' && s.shake && DCW.shake) DCW.shake(2, 0.2); }
      else if (r.type === 'touch') { var i = TOUCH.indexOf(s.touch || 'auto'); s.touch = TOUCH[(i + (d || 1) + 3) % 3]; applySettings(); sfx('menu_move'); }
      else return;
      persist();
    }
    m.update = function (dt) {
      m.t += dt;
      var rs = rows();
      listNav(m, rs.length, dt);
      var r = rs[m.sel];
      if (rep(m, 'left', dt)) change(r, -1);
      else if (rep(m, 'right', dt)) change(r, 1);
      else if (P('confirm')) {
        if (r.type === 'back') { sfx('menu_back'); close(m); }
        else if (r.type === 'controls') { sfx('menu_select'); ui.openControls(); }
        else if (r.type === 'reset') {
          sfx('menu_select');
          ui.confirm('ERASE SLOT ' + (DCW.slot || 1) + '? ITS CRAWL, UNLOCKS AND ACHIEVEMENTS ALL GO. OTHER SLOTS ARE SAFE.', function () {
            ui.confirm('REALLY? THE AI WILL REMEMBER THIS. FOREVER.', function () {
              if (typeof DCW.resetSave === 'function') DCW.resetSave();
              applySettings();
              closeAll();
              DCW.fade(function () { DCW.setScene(ui.scenes.title, {}); });
              setTimeout(function () { ui.toast('SLOT ' + (DCW.slot || 1) + ' ERASED. FRESH MEAT!', { icon: 'skull', color: C.red }); }, 400);
            }, { yes: 'ERASE IT', no: 'NO WAIT', color: C.red, border: C.red });
          }, { color: C.red });
        } else if (r.type !== 'vol') change(r, 1);
      } else if (backPressed() || P('start')) { sfx('menu_back'); close(m); }
    };
    m.draw = function (ctx) {
      var rs = rows(), s = settings();
      frame(ctx, 'SETTINGS', { footer: '◀▶:CHANGE  ' + bn('confirm') + ':TOGGLE  ' + bn('back') + ':BACK' });
      rs.forEach(function (r, i) {
        var yy = 26 + i * 14 + (i >= 7 ? 6 : 0), act = i === m.sel;
        if (act) { R(14, yy - 3, 292, 13, C.sel); cursor(18, yy); }
        T(r.label, 30, yy, r.type === 'reset' ? (act ? C.red : C.dred) : act ? C.white : C.gray);
        if (r.type === 'vol') {
          var v = s[r.key] === undefined ? 0.6 : s[r.key];
          T('◀', 150, yy, act ? C.white : C.dgray);
          for (var b = 0; b < 10; b++) { var on = b < Math.round(v * 10); R(160 + b * 9, yy, 7, 7, on ? (act ? C.green : C.dgreen) : C.ddgray); }
          T('▶', 252, yy, act ? C.white : C.dgray);
          T(Math.round(v * 100) + '%', 300, yy, C.white, { align: 'right' });
        } else if (r.type === 'bool') {
          T('◀ ' + (r.val ? 'ON' : 'OFF') + ' ▶', 205, yy, r.val ? C.green : C.dgray, { align: 'center' });
        } else if (r.type === 'touch') {
          T('◀ ' + r.val + ' ▶', 205, yy, C.blue, { align: 'center' });
        } else if (r.type === 'controls') {
          T('REBIND ▶', 205, yy, act ? C.gold : C.dgray, { align: 'center' });
        }
      });
    };
    return push(m);
  };

  /* ================================================================
     BOSS VERSUS CARD - fighters slide in, VS slams down (NES: solid
     panels, stepped diagonal, white flash frames)
     ================================================================ */
  // o = { bossId, name, title, portrait, onDone }
  ui.versus = function (o) {
    o = o || {};
    var compId = equipped('companion');
    var m = { kind: 'versus', slam: false, done: false };
    var DUR = 3.2;
    var bossName = String(o.name || 'THE BOSS').toUpperCase();
    var bossTitle = String(o.title || '').toUpperCase();
    var bossPortrait = o.portrait || ('p_' + (o.bossId || ''));
    var streaks = [];
    for (var i = 0; i < 22; i++) streaks.push({ y: Math.floor(Math.random() * 45) * 4, x: Math.random() * W, w: 16 + Math.floor(Math.random() * 6) * 8, sp: 260 + Math.random() * 320, left: i % 2 === 0 });
    function ease(t) { t = clamp(t, 0, 1); return 1 - Math.pow(1 - t, 3); }
    function finish() {
      if (m.done) return;
      m.done = true; close(m);
      if (o.onDone) { try { o.onDone(); } catch (e) { console.error(e); } }
    }
    sfx('warn');
    m.update = function (dt) {
      m.t += dt;
      streaks.forEach(function (st) { st.x += (st.left ? 1 : -1) * st.sp * dt; if (st.x > W + 80) st.x = -80; if (st.x < -80) st.x = W + 80; });
      if (!m.slam && m.t >= 0.62) { m.slam = true; sfx('explosion'); sfx('boss_roar'); if (DCW.shake) DCW.shake(4, 0.35); }
      if (m.t > 0.9 && (P('confirm') || P('start') || P('attack'))) m.t = Math.max(m.t, DUR - 0.25);
      if (m.t >= DUR) finish();
    };
    m.draw = function (ctx) {
      var t = m.t, outT = clamp((t - (DUR - 0.25)) / 0.25, 0, 1);
      // two halves wipe in on a stepped diagonal (2px rows), wipe back out at the end
      var wipe = ease(t / 0.3) * (1 - outT);
      if (wipe > 0) {
        for (var y = 0; y < H; y += 2) {
          var seam = Math.round(W * (0.56 - 0.12 * y / H));
          var lw = Math.round(seam * wipe), rw = Math.round((W - seam) * wipe);
          R(0, y, lw, 2, C.navy); R(W - rw, y, rw, 2, C.crimson);
          if (wipe > 0.95) R(seam - 1, y, 2, 2, C.white);
        }
        streaks.forEach(function (st) { var sx = Math.round(st.x); if (wipe > 0.95) R(sx, st.y, st.w, 1, st.left ? C.blue : C.orange); });
      }
      // fighter panels slide in
      var inL = ease((t - 0.12) / 0.4), inR = ease((t - 0.22) / 0.4);
      var lx = Math.round(-120 + (26 + 120) * inL - outT * 160);
      var rx = Math.round(W + 20 - (W + 20 - 194) * inR + outT * 160);
      var py = 22;
      function panel(x, pname, border, fill) {
        BOX(x, py, 100, 100, { fill: fill, border: border });
        ctx.save(); ctx.translate(x + 2, py + 2); ctx.scale(3, 3);
        portrait(ctx, pname, 0, 0);
        ctx.restore();
      }
      panel(lx, 'p_carl', C.blue, C.navy);
      panel(rx, bossPortrait, C.red, C.crimson);
      if (inL > 0.95 && outT === 0) {
        BOX(lx + 70, py + 72, 34, 34, { fill: C.navy, border: C.gold });
        portrait(ctx, 'p_' + compId, lx + 71, py + 73);
      }
      if (t > 0.75 && outT === 0) {
        T('CARL', lx + 50, py + 108, C.gold, { align: 'center', scale: 2 });
        T('& ' + compName(compId), lx + 50, py + 128, C.blue, { align: 'center', shadow: null });
        if (DCW.textWidth(bossName, 2) <= 148) T(bossName, rx + 50, py + 108, C.red, { align: 'center', scale: 2 });
        else if (/^THE /.test(bossName) && DCW.textWidth(bossName.slice(4), 2) <= 148) {
          T('THE', rx + 50, py + 102, C.red, { align: 'center', shadow: null });
          T(bossName.slice(4), rx + 50, py + 110, C.red, { align: 'center', scale: 2 });
        } else T(fitText(bossName, 150), rx + 50, py + 112, C.red, { align: 'center' });
        wrap(bossTitle, 150).slice(0, 2).forEach(function (l, i) { T(l, rx + 50, py + 128 + i * 9, C.gray, { align: 'center', shadow: null }); });
      }
      // VS slam with two white flash frames
      if (t >= 0.55 && outT === 0) {
        var k = clamp((t - 0.55) / 0.12, 0, 1);
        var sc = Math.max(3, Math.round(7 - 4 * k));
        var vy = 58 - (sc - 3) * 4;
        if ((t > 0.62 && t < 0.66) || (t > 0.7 && t < 0.74)) R(0, 0, W, H, C.white);
        T('VS', 160 + 1, vy + 1, C.red, { align: 'center', scale: sc, shadow: null });
        T('VS', 160, vy, blink(6) ? C.gold : C.yellow, { align: 'center', scale: sc, shadow: C.black });
      }
      if (t > 1.2 && outT === 0) T('BOSS BATTLE', 160, 6, blink(2.5) ? C.red : C.dred, { align: 'center' });
    };
    return push(m);
  };

  /* ================================================================
     KEYBOARD CONTROLS (rebinding)
     ================================================================ */
  var CTRL_LABELS = { left: 'MOVE LEFT', right: 'MOVE RIGHT', up: 'UP / TALK / CLIMB', down: 'DOWN / CROUCH', jump: 'JUMP / OK',
    attack: 'ATTACK / BACK', bomb: 'BOMB', special: 'SPECIAL', potion: 'POTION', start: 'PAUSE', select: 'GEAR' };
  var PRESET_ORDER = [['classic', 'CLASSIC Z X C'], ['wasd', 'WASD + SPACE J'], ['arrows', 'ARROWS + SPACE F']];
  ui.openControls = function () {
    var inp = DCW.input;
    if (!inp || !inp.bindings) { ui.toast('KEY BINDING UNAVAILABLE', {}); return null; }
    var acts = inp.actions || ['left', 'right', 'up', 'down', 'jump', 'attack', 'bomb', 'special', 'potion', 'start', 'select'];
    var m = { kind: 'controls', sel: 0, col: 0, cap: null, msg: '', msgT: 0, preset: 0 };
    var cur = (DCW.save && DCW.save.settings && DCW.save.settings.keyPreset) || 'classic';
    PRESET_ORDER.forEach(function (p, i) { if (p[0] === cur) m.preset = i; });
    var N = acts.length + 2; // actions, preset, back
    function say2(t, col) { m.msg = t; m.msgCol = col || C.gold; m.msgT = 2.2; }
    function startCapture(action, slot) {
      m.cap = { action: action, slot: slot };
      sfx('menu_select');
      inp.captureNext(function (code, kind) {
        var a = m.cap ? m.cap.action : action, sl = m.cap ? m.cap.slot : slot;
        m.cap = null;
        if (kind === 'cancel') { sfx('menu_back'); return; }
        if (kind === 'clear') { inp.setBinding(a, sl, null); sfx('menu_back'); say2(CTRL_LABELS[a] + ': CLEARED', C.gray); return; }
        var b = inp.bindings(), moved = null;
        acts.forEach(function (o) { for (var i = 0; i < 2; i++) if (b[o][i] === code && !(o === a && i === sl)) moved = o; });
        inp.setBinding(a, sl, code);
        sfx('menu_select');
        say2(CTRL_LABELS[a] + ' = ' + inp.keyName(code) + (moved && moved !== a ? '  (REMOVED FROM ' + CTRL_LABELS[moved] + ')' : ''), moved && moved !== a ? C.orange : C.green);
      });
    }
    m.onClose = function () { if (inp.cancelCapture) inp.cancelCapture(); };
    m.update = function (dt) {
      m.t += dt; if (m.msgT > 0) m.msgT -= dt;
      if (m.cap) { if (inp.capturing && !inp.capturing()) m.cap = null; else if (P('back') || P('start')) { inp.cancelCapture(); m.cap = null; consume(); } return; }
      listNav(m, N, dt);
      if (m.sel < acts.length) {
        if (P('left') || P('right')) { m.col = 1 - m.col; sfx('menu_move'); }
        else if (P('confirm')) startCapture(acts[m.sel], m.col);
        else if (backPressed() || P('start')) { sfx('menu_back'); close(m); }
      } else if (m.sel === acts.length) {
        if (P('left')) { m.preset = (m.preset + PRESET_ORDER.length - 1) % PRESET_ORDER.length; sfx('menu_move'); }
        else if (P('right')) { m.preset = (m.preset + 1) % PRESET_ORDER.length; sfx('menu_move'); }
        else if (P('confirm')) { inp.applyPreset(PRESET_ORDER[m.preset][0]); sfx('menu_select'); say2('LAYOUT SET: ' + PRESET_ORDER[m.preset][1], C.green); }
        else if (backPressed() || P('start')) { sfx('menu_back'); close(m); }
      } else if (P('confirm') || backPressed() || P('start')) { sfx('menu_back'); close(m); }
    };
    m.draw = function (ctx) {
      var b = inp.bindings();
      frame(ctx, 'KEYBOARD CONTROLS', { footer: (m.cap || m.msgT > 0) ? '' : '▲▼:PICK  ◀▶:SLOT  ENTER:REBIND  ESC:BACK' });
      T('ACTION', 18, 21, C.dgray, { shadow: null }); T('KEY 1', 192, 21, C.dgray, { align: 'center', shadow: null }); T('KEY 2', 264, 21, C.dgray, { align: 'center', shadow: null });
      acts.forEach(function (a, i) {
        var yy = 32 + i * 10, act = m.sel === i;
        if (act) { R(10, yy - 2, 300, 10, C.sel); cursor(10, yy); }
        T(CTRL_LABELS[a] || a.toUpperCase(), 22, yy, act ? C.white : C.gray, { shadow: null });
        for (var sl = 0; sl < 2; sl++) {
          var cx2 = sl ? 264 : 192, on = act && m.col === sl;
          if (on) R(cx2 - 31, yy - 2, 62, 10, m.cap ? C.gold : C.dblue);
          var code = b[a][sl];
          var label = (m.cap && on) ? (blink(5) ? '...' : '') : inp.keyName(code);
          var col = (m.cap && on) ? C.black : !code ? (sl === 0 && (a === 'jump' || a === 'attack' || a === 'left' || a === 'right') ? C.red : C.dgray) : on ? C.white : C.lgray;
          T(label, cx2, yy, col, { align: 'center', shadow: null });
        }
      });
      var py = 32 + acts.length * 10 + 4, pAct = m.sel === acts.length;
      if (pAct) { R(10, py - 2, 300, 10, C.sel); cursor(10, py); }
      T('PRESET', 22, py, pAct ? C.white : C.gray, { shadow: null });
      T('◀ ' + PRESET_ORDER[m.preset][1] + ' ▶', 228, py, pAct ? C.gold : C.dgray, { align: 'center', shadow: null });
      var by = py + 11, bAct = m.sel === acts.length + 1;
      if (bAct) { R(10, by - 2, 300, 10, C.sel); cursor(10, by); }
      T('BACK', 22, by, bAct ? C.white : C.gray, { shadow: null });
      if (m.msgT > 0 && !m.cap) T(fitText(m.msg, 296), 160, 166, m.msgCol, { align: 'center', shadow: null });
      if (m.cap) {
        BOX(60, 64, 200, 46, { border: C.gold });
        T('PRESS A KEY FOR', 160, 71, C.gray, { align: 'center', shadow: null });
        T(CTRL_LABELS[m.cap.action] + '  (KEY ' + (m.cap.slot + 1) + ')', 160, 83, C.gold, { align: 'center' });
        T('ESC: CANCEL   DEL: CLEAR', 160, 97, C.dgray, { align: 'center', shadow: null });
      }
    };
    return push(m);
  };

  /* ================================================================
     SHOP  (o = { keeper, portrait, lines } from the safe room's npc)
     ================================================================ */
  ui.openShop = function (o) {
    o = o || {};
    var m = { kind: 'shop', sel: 0, scroll: 0, flash: 0 };
    var sk = D('shopkeeper') || {};
    var keeper = String(o.keeper || sk.name || 'THE SHOP').toUpperCase();
    var lines = (o.lines && o.lines.length) ? o.lines : sk.lines;
    var por = o.portrait || 'p_bopca';
    m.line = String(pick(lines) || 'WELCOME, CRAWLER! EVERYTHING IS FOR SALE.').toUpperCase();
    m.lineCol = C.white;
    function items() { var s = D('shop'); return Array.isArray(s) ? s : []; }
    function price(it) { var p = G('price', it.id); return typeof p === 'number' ? p : (it.price || 0); }
    m.update = function (dt) {
      m.t += dt; if (m.flash > 0) m.flash -= dt;
      var l = items();
      listNav(m, l.length, dt); scrollTo(m, 6, l.length);
      if ((P('special') || P('select')) && l.length) {
        var iti = l[m.sel]; sfx('menu_select');
        ui.readMore({ title: iti.name || iti.id, titleColor: C.orange, blocks: [{ text: iti.desc || '', color: C.white }, { head: 'PRICE', text: price(iti) + ' GOLD', color: C.gold }] });
      } else if (P('confirm') && l.length) {
        var it = l[m.sel], res;
        if (hasG('buy')) res = G('buy', it.id) || { ok: false, msg: 'SOMETHING WENT WRONG.' };
        else { res = { ok: false, msg: 'THE REGISTER IS BROKEN. COME BACK LATER.' }; sfx('error'); }
        m.flash = 0.35;
        if (res.ok) { m.line = (res.msg ? res.msg + '! ' : '') + (pick(lines) || 'PLEASURE DOING BUSINESS.'); m.lineCol = C.green; }
        else { m.line = res.msg || 'NO.'; m.lineCol = C.red; }
        m.line = String(m.line).toUpperCase();
      } else if (backPressed() || P('start')) { sfx('menu_back'); close(m); }
    };
    m.draw = function (ctx) {
      var l = items(), run = getRun() || {};
      frame(ctx, fitText(keeper.replace(/^THE /, '') + "'S SHOP", 260), { footer: bn('confirm') + ':BUY  ' + bn('special') + ':INFO  ' + bn('back') + ':LEAVE' });
      R(11, 21, 34, 34, C.white); R(12, 22, 32, 32, C.black);
      portrait(ctx, por, 12, 22, { frame: Math.floor((DCW.t || 0) * 3) });
      BOX(50, 20, 260, 36, { border: C.orange });
      R(47, 34, 4, 4, C.orange);
      wrap(m.line, 248).slice(0, 3).forEach(function (t, i) { T(t, 56, 24 + i * 10, m.lineCol); });
      icon(ctx, 'coin', 12, 60); T(run.gold || 0, 22, 61, C.gold);
      T((flag('jugs') ? 'JUGS ' : 'BOMBS ') + (run.bombs || 0) + '  POTIONS ' + (run.potions || 0) + '  BISCUITS ' + biscuits(), 300, 61, C.dgray, { align: 'right' });
      sep(10, 71, 300);
      if (!l.length) { T('SOLD OUT. EVERYTHING. SOMEHOW.', 160, 100, C.gray, { align: 'center' }); return; }
      var vis = 6;
      for (var i = m.scroll; i < Math.min(l.length, m.scroll + vis); i++) {
        var it = l[i], yy = 76 + (i - m.scroll) * 11, p = price(it), afford = (run.gold || 0) >= p;
        if (i === m.sel) { R(10, yy - 2, 300, 11, m.flash > 0 ? C.dbrown : C.sel); cursor(13, yy); }
        T(fitText(it.name || it.id, 200), 24, yy, i === m.sel ? C.white : C.gray);
        T(p, 298, yy, afford ? C.gold : C.red, { align: 'right' });
        icon(ctx, 'coin', 298 - tw(p) - 10, yy - 1);
      }
      scrollArrows(302, 72, 136, m.scroll, vis, l.length);
      sep(10, 143, 300);
      var d = l[m.sel] && l[m.sel].desc;
      var sl = wrap(String(d || '').toUpperCase(), 296);
      if (sl.length > 2) { sl = sl.slice(0, 1); sl.push((blink(2) ? '▼ ' : '  ') + bn('special') + ': READ MORE'); }
      sl.forEach(function (t, i) { T(t, 12, 146 + i * 9, i === 1 && t.indexOf('READ MORE') >= 0 ? C.white : C.gray, { shadow: null }); });
    };
    return push(m);
  };

  /* ================================================================
     HOW TO PLAY (Book One: no map; SELECT = gear)
     ================================================================ */
  var HOWTO = [
    { title: 'KEYBOARD', rows: function () {
      var mv = ['left', 'right', 'up', 'down'].map(function (a) { return kbName(a, '?'); }).join(' ');
      return [['MOVE', mv], ['JUMP / OK', kbBoth('jump')], ['ATTACK / BACK', kbBoth('attack')], ['BOMB', kbBoth('bomb')],
        ['DONUT SPECIAL', kbBoth('special')], ['POTION', kbBoth('potion')], ['PAUSE', 'ENTER / ESC' + (kbName('start', '') ? ' / ' + kbName('start', '') : '')],
        ['GEAR', kbBoth('select')]];
    } },
    { title: 'GAMEPAD', rows: [['MOVE', 'D-PAD / STICK'], ['JUMP / OK', 'A (BOTTOM)'], ['ATTACK', 'X (LEFT)'], ['BOMB / BACK', 'B (RIGHT)'], ['DONUT SPECIAL', 'Y (TOP)'], ['POTION', 'BUMPERS / TRIGGERS'], ['PAUSE', 'START'], ['GEAR', 'SELECT']] },
    { title: 'TOUCH', rows: [['MOVE', 'LEFT PAD'], ['JUMP / OK', 'A BUTTON'], ['ATTACK / BACK', 'B BUTTON'], ['BOMB', 'BOMB BUTTON'], ['DONUT SPECIAL', 'SPC BUTTON'], ['POTION', 'POT BUTTON'], ['PAUSE', 'START (TOP RIGHT)'], ['GEAR', 'GEAR (TOP RIGHT)']] },
    { title: 'MOVES', rows: [['PUNCH COMBO', 'TAP ATTACK'], ['KICK', 'DOWN + ATTACK'], ['STOMP KICK', 'DOWN + ATTACK IN AIR'], ['HEAD BOUNCE', 'LAND ON ENEMIES'], ['DROP DOWN', 'DOWN + JUMP'], ['LADDERS', 'UP / DOWN'], ['TALK / READ / FEED', 'UP NEXT TO IT'], ['DONUT SPECIAL', 'WHEN METER IS FULL']] },
    { title: 'SAFE ROOMS', rows: [['WALK', '◀ ▶'], ['USE A STATION', 'A OR UP'], ['PET DONUT', 'DOWN NEXT TO HER'], ['LOOT BOXES', 'ONLY OPEN HERE'], ['STAT POINTS', 'ONLY SPEND HERE'], ['REST', 'ONCE PER VISIT'], ['GEAR', 'SELECT'], ['LEAVE', 'THE DOOR ON THE RIGHT']] }
  ];
  ui.openHowTo = function () {
    var m = { kind: 'howto', page: 0 };
    var dev = (DCW.input && DCW.input.lastDevice) || 'keyboard';
    m.page = dev === 'pad' ? 1 : dev === 'touch' ? 2 : 0;
    m.update = function (dt) {
      m.t += dt;
      if (P('left')) { m.page = (m.page + HOWTO.length - 1) % HOWTO.length; sfx('menu_move'); }
      else if (P('right') || P('confirm')) { m.page = (m.page + 1) % HOWTO.length; sfx('menu_move'); }
      else if (backPressed() || P('start')) { sfx('menu_back'); close(m); }
    };
    m.draw = function (ctx) {
      var pg = HOWTO[m.page];
      frame(ctx, 'HOW TO PLAY', { footer: '◀▶:PAGE  ' + bn('back') + ':BACK' });
      T('◀ ' + pg.title + ' ▶', 160, 22, C.white, { align: 'center' });
      for (var d = 0; d < HOWTO.length; d++) R(160 - HOWTO.length * 4 + d * 8, 33, 5, 2, d === m.page ? C.gold : C.ddgray);
      var rowsList = typeof pg.rows === 'function' ? pg.rows() : pg.rows;
      rowsList.forEach(function (r, i) {
        var yy = 41 + i * 12;
        T(r[0], 24, yy, C.gold); T(r[1], 296, yy, C.white, { align: 'right' });
        var a = 24 + tw(r[0]) + 4, b = 296 - tw(r[1]) - 4;
        for (var dx = a; dx < b; dx += 4) R(dx, yy + 6, 1, 1, C.line);
      });
      var tip = m.page === 0 ? 'REBIND KEYS IN SETTINGS > KEYBOARD CONTROLS' : m.page === 4 ? 'SAFE ROOMS ARE SAFE. MOSTLY.' : 'GET TO THE STAIRS BEFORE THE FLOOR COLLAPSES.';
      T(tip, 160, 140, C.pink, { align: 'center' });
    };
    return push(m);
  };

  /* ================================================================
     UPDATE / DRAW (called by engine every frame)
     ================================================================ */
  ui.init = function () {
    stack.length = 0; toasts.length = 0; toastQ.length = 0; banner = null;
  };
  ui.update = function (dt) {
    updateToasts(dt);
    if (banner) { banner.t += dt; if (banner.t >= banner.time) banner = null; }
    var m = top();
    if (m && m.update) {
      try { m.update(dt); } catch (e) { console.error('[ui] modal crashed, closing it', e); close(m); }
    }
  };
  ui.draw = function (ctx) {
    // banners belong to the playfield: draw them under any open menu, toasts stay on top
    if (stack.length) drawBanner(ctx);
    for (var i = 0; i < stack.length; i++) {
      var m = stack[i];
      if (m.draw) { try { ctx.save(); m.draw(ctx); } catch (e) { console.error('[ui] modal draw', e); } finally { ctx.restore(); ctx.globalAlpha = 1; } }
    }
    if (!stack.length) drawBanner(ctx);
    drawToasts(ctx);
  };

  /* ================================================================
     SHARED SCENE BITS
     ================================================================ */
  var scenes = ui.scenes = {};
  var STARS = null;
  function stars(ctx, t, y0, y1, n) {
    if (!STARS) { STARS = []; for (var i = 0; i < 120; i++) STARS.push({ x: hash('sx' + i) % W, y: hash('sy' + i) % 1000 / 1000, k: hash('sk' + i) % 7 }); }
    n = n || 80;
    for (var k = 0; k < n; k++) {
      var st = STARS[k];
      if ((Math.floor(t * 2) + st.k) % 9 === 0) continue; // twinkle = a missing frame, not a fade
      R(st.x, Math.round(y0 + st.y * (y1 - y0)), 1, 1, st.k === 0 ? C.white : st.k < 3 ? C.gray : C.dgray);
    }
  }
  function prand(n) { var s = Math.sin(n * 12.9898) * 43758.5453; return s - Math.floor(s); }
  // a row of floor tiles from a theme (art.tile), with a flat fallback
  function floorRow(ctx, theme, y, camX, rows) {
    var tileOk = !!(DCW.art && typeof DCW.art.tile === 'function');
    var ox = -Math.floor(((camX || 0) % 16 + 16) % 16);
    for (var r = 0; r < (rows || 1); r++) for (var x = ox; x < W; x += 16) {
      var yy = y + r * 16, drawn = false;
      if (tileOk) { try { DCW.art.tile(ctx, theme, '#', x, yy, { up: r > 0, down: true, left: true, right: true, t: DCW.t || 0, tx: Math.floor((x + (camX || 0)) / 16), ty: r }); drawn = true; } catch (e) { drawn = false; } }
      if (!drawn) { R(x, yy, 16, 16, C.dbrown); R(x, yy, 16, r ? 1 : 2, r ? C.brown : C.tan); R(x + 15, yy, 1, 16, C.black); }
    }
  }

  /* ================================================================
     CUTSCENE PLAYER - Ninja Gaiden style story panels
     A letterboxed picture (panel.bg via DCW.art.background, actors on
     the picture floor, NES fx) over an NES text window with portrait,
     name tab and typewriter text. confirm advances, start skips all.
     ================================================================ */
  var CUT = { top: 10, bot: 110, floor: 100, box: 122 };
  var WIPE = 0.16;
  var FLOOR_THEMES = ['tunnels', 'hoard', 'goblin', 'gym', 'swine', 'cinder', 'distillery', 'pound', 'safe'];
  function cutDef(id) { var d = D('cutscenes'); var c = (d && id && d[id]) || null; if (!c && hasG('cutsceneDef') && id) c = G('cutsceneDef', id) || null; return c; }
  ui.cutsceneDef = cutDef;
  function fxList(fx) { if (!fx) return []; return (Array.isArray(fx) ? fx : String(fx).split(/[\s,+]+/)).filter(Boolean).map(function (f) { return String(f).toLowerCase(); }); }
  function floorThemeFor(p) {
    if (p.floor === false || !p.bg) return null;
    if (typeof p.floor === 'string') return p.floor;
    if (/^safe/.test(p.bg)) return 'safe';
    var th = D('themes');
    if (FLOOR_THEMES.indexOf(p.bg) >= 0 || (Array.isArray(th) && th.indexOf(p.bg) >= 0)) return p.bg;
    return null;
  }
  function cutPanels(def, id) {
    var src = def && Array.isArray(def.panels) ? def.panels : (def && (def.lines || def.bg) ? [def] : []);
    var out = [];
    src.forEach(function (p) {
      if (!p) return;
      if (typeof p === 'string') p = { lines: [p] };
      var lines = p.lines !== undefined ? p.lines : p.text;
      out.push({ p: p, pages: paginate(lines, {}), fx: fxList(p.fx),
        actors: Array.isArray(p.actors) ? p.actors.filter(function (a) { return a && a.sprite; }) : [] });
    });
    if (!out.length) {
      out.push({ p: { bg: null }, fx: ['static'], actors: [],
        pages: paginate([{ text: 'WE ARE EXPERIENCING TECHNICAL DIFFICULTIES. THIS SCENE IS STILL BEING FILMED.' + (DCW.debug && id ? ' (' + String(id).toUpperCase() + ')' : '') }], {}) });
    }
    return out;
  }
  var STATIC_COLS = ['#000000', '#7c7c7c', '#bcbcbc', '#fcfcfc'];
  function fxSnow(ctx, t) {
    var bh = CUT.bot - CUT.top;
    for (var i = 0; i < 70; i++) {
      var sp = 10 + (i % 5) * 5;
      var x = Math.round(((i * 53.7 + Math.sin(t * 0.9 + i) * 5 - t * 7) % W + W) % W);
      var y = CUT.top + Math.round((i * 37.3 + t * sp) % bh);
      var big = i % 7 === 0;
      R(x, y, big ? 2 : 1, big ? 2 : 1, i % 3 ? C.white : C.gray);
    }
  }
  function fxConfetti(ctx, t) {
    var bh = CUT.bot - CUT.top, cols = [C.red, C.gold, C.green, C.blue, C.pink, C.white];
    for (var i = 0; i < 64; i++) {
      var sp = 24 + (i % 6) * 7;
      var x = Math.round(((i * 41.3 + Math.sin(t * 2 + i) * 6) % W + W) % W);
      var y = CUT.top + Math.round((i * 29.1 + t * sp) % bh);
      var flip = (Math.floor(t * 6) + i) % 2;
      R(x, y, flip ? 3 : 2, flip ? 2 : 3, cols[i % cols.length]);
    }
  }
  function fxFire(ctx, t) {
    var fr = Math.floor(t * 8), bh = CUT.bot - CUT.top;
    for (var x = 0; x < W; x += 8) {
      var hsh = hash('f' + x), h = 10 + (hsh % 4) * 5 + ((fr + (x >> 3)) % 2 ? 5 : 0);
      var outer = (fr + (x >> 3)) % 2 ? C.red : C.dred, mid = (fr + (x >> 3)) % 2 ? C.orange : C.red;
      R(x, CUT.bot - h, 8, h, outer); R(x + 2, CUT.bot - h - 3, 4, 3, outer);
      R(x + 2, CUT.bot - Math.round(h * 0.7), 4, Math.round(h * 0.7), mid);
      R(x + 3, CUT.bot - Math.round(h * 0.4), 2, Math.round(h * 0.4), C.yellow);
    }
    for (var i = 0; i < 16; i++) {
      var ex = Math.round(((i * 41 + Math.sin(t * 2 + i) * 5) % W + W) % W), ey = CUT.bot - 8 - Math.round((t * 30 + i * 23) % (bh - 8));
      R(ex, ey, 1, 1, (fr + i) % 2 ? C.yellow : C.orange);
    }
  }
  function fxStatic(ctx, pt) {
    var bh = CUT.bot - CUT.top;
    var full = pt < 0.45 || Math.floor(pt * 30) % 75 === 0;
    if (full) {
      for (var y = CUT.top; y < CUT.bot; y += 2) for (var x = 0; x < W; x += 4) R(x, y, 4, 2, STATIC_COLS[(Math.random() * 4) | 0]);
      return;
    }
    var by = CUT.top + Math.round((pt * 36) % bh);
    for (var r = 0; r < 3; r++) for (var x2 = 0; x2 < W; x2 += 4) R(x2, by + r * 2, 4, 2, STATIC_COLS[(Math.random() * 4) | 0]);
    for (var s = 0; s < 24; s++) R((Math.random() * W) | 0, CUT.top + ((Math.random() * bh) | 0), 2, 1, STATIC_COLS[1 + ((Math.random() * 3) | 0)]);
  }
  function fxCollapse(ctx, pt) {
    for (var i = 0; i < 7; i++) {
      var hsh = hash('bld' + i), bw = 28 + hsh % 18, bh = 40 + (hsh >>> 5) % 44;
      var bx = i * 48 - 8 + (hsh >>> 9) % 10;
      var start = 0.2 + ((i * 5) % 7) * 0.32;
      var sink = Math.floor(Math.max(0, pt - start) * 16 / 2) * 2;
      var topY = CUT.floor - bh + sink;
      if (topY >= CUT.floor) continue;
      var hh = CUT.floor - topY;
      R(bx, topY, bw, hh, C.black);
      R(bx + 1, topY + 1, bw - 2, hh - 1, i % 2 ? C.ddgray : C.dpurple);
      for (var wy = topY + 4; wy < CUT.floor - 3; wy += 7) for (var wx = bx + 4; wx < bx + bw - 5; wx += 6) {
        var lit = hash(i * 977 + (wx - bx) * 7 + (wy - topY) * 13) % 3 === 0;
        R(wx, wy, 3, 4, lit ? C.yellow : C.black);
      }
      if (sink > 0) for (var d = 0; d < 6; d++) {
        var dx = bx - 4 + ((d * 13 + Math.floor(pt * 12)) % (bw + 8));
        R(dx, CUT.floor - 3 - (d % 2) * 3, 4, 3, d % 2 ? C.gray : C.dgray);
      }
    }
  }
  function makePlayer(def, id, onDone) {
    var pl = { panels: cutPanels(def, id), pi: 0, gi: 0, shown: 0, blip: 0, t: 0, pt: 0, done: false, wipe: { phase: 'in', t: 0 } };
    function finish() { if (pl.done) return; pl.done = true; if (onDone) { try { onDone(); } catch (e) { console.error('[ui] cutscene onDone', e); } } }
    function startPanel() {
      var p = pl.panels[pl.pi].p;
      pl.pt = 0; pl.gi = 0; pl.shown = 0;
      if (p.music) music(p.music);
      if (p.sfx) sfx(p.sfx);
    }
    function nextPanel() {
      if (pl.pi >= pl.panels.length - 1) { finish(); return; }
      pl.wipe = { phase: 'out', t: 0 };
    }
    startPanel();
    pl.skip = finish;
    pl.update = function (dt) {
      pl.t += dt; pl.pt += dt;
      if (pl.done) return;
      if (skipP() && pl.t > 0.25) { sfx('menu_back'); finish(); return; }
      if (pl.wipe) {
        pl.wipe.t += dt;
        if (pl.wipe.t >= WIPE) {
          if (pl.wipe.phase === 'out') { pl.pi++; startPanel(); pl.wipe = { phase: 'in', t: 0 }; }
          else pl.wipe = null;
        }
        return;
      }
      var pn = pl.panels[pl.pi], pg = pn.pages[pl.gi];
      if (!pg) {
        var hold = pn.p.hold !== undefined ? pn.p.hold : 2.4;
        if (pl.pt > hold || ((P('confirm') || P('back')) && pl.pt > 0.25)) nextPanel();
        return;
      }
      var total = pageLen(pg);
      if (pl.shown < total) {
        var before = Math.floor(pl.shown);
        pl.shown = Math.min(total, pl.shown + dt * 48);
        var now = Math.floor(pl.shown);
        if (now !== before) { pl.blip += now - before; if (pl.blip >= 3) { pl.blip = 0; sfx('text_blip'); } }
      }
      if ((P('confirm') || P('back')) && pl.pt > 0.12) {
        if (pl.shown < total) pl.shown = total;
        else { pl.gi++; pl.shown = 0; if (pl.gi >= pn.pages.length) nextPanel(); }
      }
    };
    function drawPicture(ctx, pn) {
      var p = pn.p, pt = pl.pt, t = pl.t, bh = CUT.bot - CUT.top;
      var has = function (f) { return pn.fx.indexOf(f) >= 0; };
      var camX = Math.round((p.camX || 0) + (p.pan || 0) * pt);
      var drew = false;
      if (p.bg) {
        ctx.save(); ctx.translate(0, CUT.floor - (p.bgY !== undefined ? p.bgY : 150));
        drew = drawBg(ctx, p.bg, camX, p.camY || 0);
        ctx.restore();
      }
      if (!drew) {
        R(-4, CUT.top - 4, W + 8, bh + 8, p.color ? nes(p.color) : C.black);
        if (p.bg && !p.color) stars(ctx, t, CUT.top + 2, CUT.floor - 30, 40);
      }
      var ft = floorThemeFor(p);
      if (ft) floorRow(ctx, ft, CUT.floor, camX, 1);
      if (has('collapse')) fxCollapse(ctx, pt);
      pn.actors.forEach(function (a) {
        var name = a.sprite, inf = artInfo(name), frames = inf ? (inf.frames || 1) : 2;
        var fr = a.frame !== undefined ? a.frame : (frames > 1 ? Math.floor(t * (a.fps || 2)) % Math.min(frames, a.frames || 2) : 0);
        var x = (a.x !== undefined ? a.x : 160) + (a.vx || 0) * pt;
        var o = { frame: fr, flip: !!a.flip };
        if (/^carl_/.test(name)) o.skin = a.skin || equipped('skin');
        spr(ctx, name, Math.round(x), CUT.floor - (a.y || 0), o);
      });
      if (has('snow')) fxSnow(ctx, t);
      if (has('confetti')) fxConfetti(ctx, t);
      if (has('fire')) fxFire(ctx, t);
      if (has('static')) fxStatic(ctx, pt);
      if (has('flash') && (pt < 0.05 || (pt > 0.1 && pt < 0.15) || (pt > 0.2 && pt < 0.24))) R(-4, CUT.top - 4, W + 8, bh + 8, C.white);
      if (p.caption) {
        var cap = String(p.caption).toUpperCase(), cw = tw(cap) + 10;
        BOX(6, CUT.top + 4, cw, 12);
        T(cap, 11, CUT.top + 6, C.gold, { shadow: null });
      }
    }
    pl.draw = function (ctx) {
      R(0, 0, W, H, C.black);
      var pn = pl.panels[Math.min(pl.pi, pl.panels.length - 1)], pt = pl.pt;
      var has = function (f) { return pn.fx.indexOf(f) >= 0; };
      // picture shake: NES style integer jolts, picture band only
      var sx = 0, sy = 0, fr = Math.floor(pt * 30);
      if (has('shake') && pt < 0.7) { sx = Math.round(prand(fr) * 6 - 3); sy = Math.round(prand(fr + 99) * 4 - 2); }
      else if (has('shake') || has('collapse')) { if (fr % 4 === 0) sx = prand(fr) < 0.5 ? -1 : 1; }
      ctx.save(); ctx.beginPath(); ctx.rect(0, CUT.top, W, CUT.bot - CUT.top); ctx.clip();
      ctx.translate(sx, sy);
      try { drawPicture(ctx, pn); } catch (e) { console.error('[ui] cutscene picture', e); }
      ctx.restore();
      // venetian-blind wipe between panels (8px strips, like a tile-row update)
      if (pl.wipe) {
        var k = clamp(pl.wipe.t / WIPE, 0, 1); if (pl.wipe.phase === 'in') k = 1 - k;
        var hh = Math.round(k * 8);
        if (hh > 0) for (var y = CUT.top; y < CUT.bot; y += 8) R(0, y, W, Math.min(hh, CUT.bot - y), C.black);
      }
      // text window
      var pg = pn.pages[Math.min(pl.gi, pn.pages.length - 1)];
      if (pn.pages.length) {
        if (pl.wipe || pl.gi >= pn.pages.length) BOX(4, CUT.box, 312, 50);
        else drawTextBox(ctx, pg, pl.shown, CUT.box, pl.shown >= pageLen(pg));
      }
      // top bar: panel dots + skip hint
      var n = pl.panels.length;
      if (n > 1) for (var d = 0; d < n; d++) R(316 - (n - d) * 6, 3, 4, 3, d === pl.pi ? C.gold : d < pl.pi ? C.dgray : C.ddgray);
      if (pl.t < 4 || blink(0.5)) T(skipName() + ': SKIP', 4, 1, C.dgray, { shadow: null });
    };
    return pl;
  }
  ui.cutscenePlayer = makePlayer;

  scenes.cutscene = {
    enter: function (p) {
      p = p || {};
      this.p = p; this.id = p.id;
      var def = p.def || cutDef(p.id);
      if (def && def.music) music(def.music);
      this.player = makePlayer(def, p.id, function () {
        if (p.onDone) p.onDone();
        else toTitle();
      });
    },
    update: function (dt) { if (this.player) this.player.update(dt); },
    idle: function (dt) { if (this.player) this.player.t += dt; },
    draw: function (ctx) { if (this.player) this.player.draw(ctx); else R(0, 0, W, H, C.black); }
  };

  /* ================================================================
     TITLE - a 1987 cartridge title screen
     ================================================================ */
  function drawPillar(ctx, x, t, flip) {
    // stone pillar (16 wide) with an iron torch, 2-frame flame
    for (var y = 0; y < 156; y += 8) {
      var off = (y / 8) % 2 ? 0 : 8;
      R(x, y, 16, 8, C.black);
      R(x + (off ? 1 : 0), y + 1, off ? 6 : 15, 6, C.dgray);
      if (off) R(x + 9, y + 1, 7, 6, C.dgray);
      R(x + (off ? 1 : 0), y + 1, off ? 6 : 15, 1, C.gray);
      if (off) R(x + 9, y + 1, 7, 1, C.gray);
    }
    var tx = flip ? x + 2 : x + 10, fr = Math.floor(t * 6 + (flip ? 1 : 0)) % 2;
    R(tx - 1, 92, 6, 2, C.black); R(tx, 92, 4, 1, C.dgray); R(tx + 1, 94, 2, 6, C.brown);
    R(tx, 84 - fr, 4, 8 + fr, fr ? C.red : C.orange); R(tx + 1, 86 - fr, 2, 5, fr ? C.yellow : C.white);
    R(tx + (fr ? 0 : 3), 82 - fr, 1, 2, C.red);
  }
  function drawLogo(ctx, t) {
    var drop = Math.round(Math.max(0, 1 - t / 0.6) * 15) * 4;
    var y0 = 7 - drop;
    // DUNGEON CRAWLER
    T('DUNGEON CRAWLER', 162, y0 + 2, C.dred, { align: 'center', scale: 2, shadow: null });
    T('DUNGEON CRAWLER', 160, y0, C.white, { align: 'center', scale: 2, shadow: null });
    // CARL: chunky two-tone letters with a black outline and red drop shadow
    var cy = y0 + 20, s = 5, word = 'CARL';
    var o = [[-2, 0], [2, 0], [0, -2], [0, 2], [-2, -2], [2, 2], [-2, 2], [2, -2]];
    T(word, 164, cy + 4, C.crimson, { align: 'center', scale: s, shadow: null });
    o.forEach(function (d) { T(word, 160 + d[0], cy + d[1], C.black, { align: 'center', scale: s, shadow: null }); });
    T(word, 160, cy, C.gold, { align: 'center', scale: s, shadow: null });
    ctx.save(); ctx.beginPath(); ctx.rect(0, cy + 20, W, 20); ctx.clip();
    T(word, 160, cy, C.orange, { align: 'center', scale: s, shadow: null });
    ctx.restore();
    ctx.save(); ctx.beginPath(); ctx.rect(0, cy + 25, W, 15); ctx.clip();
    T(word, 160, cy, C.rust, { align: 'center', scale: s, shadow: null });
    ctx.restore();
    // a glint that runs across the letters every few seconds
    var gl = (t % 4) / 0.5;
    if (gl < 1 && t > 0.6) { var gx = Math.round(100 + gl * 120); ctx.save(); ctx.beginPath(); ctx.rect(gx, cy, 4, 35); ctx.clip(); T(word, 160, cy, C.white, { align: 'center', scale: s, shadow: null }); ctx.restore(); }
    // BOOK ONE ribbon
    var ry = y0 + 62, rw = tw('BOOK ONE') + 22, rx = 160 - rw / 2;
    R(rx - 10, ry + 3, 12, 11, C.black); R(rx - 9, ry + 4, 10, 9, C.dred); R(rx - 9, ry + 8, 3, 1, C.black); R(rx - 9, ry + 7, 2, 3, C.black);
    R(rx + rw - 2, ry + 3, 12, 11, C.black); R(rx + rw - 1, ry + 4, 10, 9, C.dred); R(rx + rw + 6, ry + 7, 2, 3, C.black);
    BOX(rx, ry, rw, 13, { fill: C.red, border: C.gold });
    T('BOOK ONE', 160, ry + 3, C.white, { align: 'center', shadow: C.dred });
  }
  scenes.title = {
    enter: function () {
      closeAll();
      this.t = 0; this.sel = 0; this.cool = 0.25; this.state = 'press'; this.st = 0;
      music('title');
    },
    items: function () {
      var hasRun = !!(DCW.save && DCW.save.run);
      return [
        hasRun ? { label: 'CONTINUE', action: function () { start('continueRun'); } } : null,
        { label: 'NEW CRAWL', action: function () {
          if (DCW.save && DCW.save.run) ui.confirm('START OVER IN SLOT ' + (DCW.slot || 1) + '? THIS SLOT\'S CURRENT CRAWL WILL BE LOST.', function () { start('newRun'); });
          else start('newRun');
        } },
        { label: 'SAVE SLOT ' + (DCW.slot || 1), action: function () { ui.openSlots(); } },
        { label: 'ACHIEVEMENTS', action: ui.openAchievements },
        { label: 'SETTINGS', action: ui.openSettings },
        { label: 'HOW TO PLAY', action: ui.openHowTo }
      ].filter(Boolean);
      function start(fn) { sfx('fanfare'); if (tryCall(DCW.game, fn, []) === MISSING) ui.toast('GAME MODULE MISSING', { color: C.red }); }
    },
    update: function (dt) {
      this.t += dt; this.st += dt;
      if (this.cool > 0) { this.cool -= dt; return; }
      if (this.state === 'press') {
        if (P('start') || P('confirm')) { sfx('menu_select'); this.state = 'menu'; this.st = 0; this.sel = 0; }
        return;
      }
      var its = this.items();
      listNav(this, its.length, dt);
      if ((P('confirm') || P('start')) && this.st > 0.1) { var it = its[this.sel]; sfx('menu_select'); if (it && it.action) it.action(); }
      else if (P('back')) { sfx('menu_back'); this.state = 'press'; this.st = 0; }
    },
    idle: function (dt) { this.t += dt; },
    draw: function (ctx) {
      var t = this.t || 0, self = this;
      R(0, 0, W, H, C.black);
      drawPillar(ctx, 0, t, false); drawPillar(ctx, 304, t, true);
      drawLogo(ctx, t);
      // the ledge they stand on
      floorRow(ctx, 'tunnels', 156, 0, 1);
      R(0, 172, W, 8, C.black);
      var fr = Math.floor(t * 2) % 2;
      bigSprite(ctx, 'carl_idle', 52, 157, { scale: 2, skin: equipped('skin'), frame: fr });
      bigSprite(ctx, compSprite(equipped('companion')) + '_idle', 88, 157, { scale: 2, frame: fr });
      // the System AI hovering on the right, live
      var bob = Math.floor(t * 2) % 2 ? -2 : 0;
      bigSprite(ctx, 'ai_screen', 266, 140 + bob, { scale: 2, frame: Math.floor(t * 2) });
      if (Math.floor(t / 4) % 3 === 1) {
        BOX(224, 76, 78, 22, { fill: C.white, border: C.black });
        R(260, 98, 4, 2, C.white); R(262, 100, 2, 2, C.white);
        T('WE\'RE LIVE,', 263, 79, C.black, { align: 'center', shadow: null }); T('BABY!', 263, 88, C.red, { align: 'center', shadow: null });
      }
      if (this.state === 'press') {
        if (t > 0.7 && Math.floor(t * 2) % 2 === 0) T('PUSH START BUTTON', 160, 110, C.white, { align: 'center' });
        if (t > 0.7) T(DCW.save && DCW.save.run ? 'A CRAWL IS IN PROGRESS' : 'THE DUNGEON IS OPEN', 160, 126, C.dgray, { align: 'center', shadow: null });
      } else {
        var its = this.items(), rowH = 10, mh = its.length * rowH + 8, my = 154 - mh;
        BOX(108, my, 104, mh);
        its.forEach(function (it, k) {
          var yy = my + 4 + k * rowH;
          if (k === self.sel) cursor(114, yy);
          T(it.label, 124, yy, k === self.sel ? C.white : C.gray);
        });
      }
      T('A FAN GAME. NOT FOR SALE.', 160, 173, C.dgray, { align: 'center', shadow: null });
    }
  };

  /* ================================================================
     INTRO (new crawl): the prologue cutscene, or an original fallback
     ================================================================ */
  var INTRO_FB = { music: 'intro', panels: [
    { bg: 'surface', fx: 'snow', actors: [{ sprite: 'carl_idle', x: 140 }, { sprite: 'donut_idle', x: 164 }],
      lines: [{ text: 'GOOD EVENING, EARTH! CONGRATULATIONS. YOUR PLANET HAS BEEN SELECTED FOR A VERY SPECIAL EPISODE.' }] },
    { bg: 'surface', fx: ['collapse', 'snow'], actors: [{ sprite: 'carl_idle', x: 140 }, { sprite: 'donut_idle', x: 164 }],
      lines: [{ text: 'EVERY BUILDING ON THE PLANET IS NOW GOING INTO THE GROUND. IF YOU ARE INDOORS, WELL. THANKS FOR WATCHING.' }] },
    { bg: 'surface', fx: 'snow', actors: [{ sprite: 'carl_idle', x: 140 }, { sprite: 'donut_idle', x: 164, flip: true }],
      lines: [{ who: 'CARL', text: 'I STEPPED OUTSIDE FOR TWO MINUTES. TWO.' }, { who: 'DONUT', text: 'AND I AM VERY GRATEFUL, CARL. NOW FIND ME SOMETHING WARM TO SIT ON.' }] },
    { bg: 'stairwell', actors: [{ sprite: 'carl_idle', x: 120 }, { sprite: 'donut_idle', x: 144 }],
      lines: [{ text: 'THE STAIRWELLS ARE OPEN, CRAWLERS. GO DOWN. THE AUDIENCE IS WAITING, AND THEY ARE SO HUNGRY.' }] }
  ] };
  scenes.intro = {
    enter: function (p) {
      p = p || {};
      var def = cutDef('prologue') || INTRO_FB;
      music(def.music || 'intro');
      this.player = makePlayer(def, 'prologue', function () {
        if (p.onDone) p.onDone(); else tryCall(DCW.game, 'continueRun', []);
      });
    },
    update: function (dt) { this.player.update(dt); },
    idle: function (dt) { this.player.t += dt; },
    draw: function (ctx) { this.player.draw(ctx); }
  };

  /* ================================================================
     NAME ENTRY (new run): you type a name, the AI calls you Carl anyway
     ================================================================ */
  var NAME_MAX = 10, NAME_ROWS = ['ABCDEFGHIJ', 'KLMNOPQRST', "UVWXYZ.'-!"], NAME_CMDS = ['SPACE', 'DEL', 'DONE'];
  function carlLines(name, tries) {
    var ai = function (t) { return { who: 'SYSTEM AI', portrait: 'p_ai', text: t }; };
    var pk = function (a) { return a[Math.floor(Math.random() * a.length)]; };
    var n = name.replace(/^\s+|\s+$/g, '');
    if (!n) return [ai('NOTHING? YOU CANNOT EVEN COMMIT TO A NAME. THAT IS THE MOST CARL THING I HAVE EVER SEEN.'), ai('YOU ARE CARL. CONGRATULATIONS, CARL.')];
    if (/^CARL\b/.test(n)) return [ai('...OH. YOU ACTUALLY ARE A CARL.'), ai('THAT IS DEEPLY DISAPPOINTING. I HAD A WHOLE BIT PREPARED. FINE. CARL IT IS.')];
    if (/DONUT/.test(n)) return [ai(n + '? THAT NAME IS TAKEN. BY A CAT. A VERY LITIGIOUS CAT.'), ai('YOU LOOK LIKE A CARL TO ME. I AM GONNA CALL YOU CARL.')];
    if (tries > 1) return [ai(n + '. WE HAVE BEEN OVER THIS.'), ai(pk(['YOU ARE CARL. YOU WERE CARL LAST TIME. YOU WILL BE CARL NEXT TIME.', 'THE NAME FIELD IS DECORATIVE. IT ALWAYS HAS BEEN. HELLO AGAIN, CARL.', 'I DID NOT EVEN READ THAT. WELCOME BACK, CARL.']))];
    return [ai(n + '. ' + n + '. HMM. LET ME LOOK AT YOU.'),
      ai(pk(['NAH. YOU LOOK LIKE A CARL TO ME. I AM GONNA CALL YOU CARL.', 'NO. ABSOLUTELY NOT. YOU HAVE A CARL FACE. YOU ARE CARL NOW.', 'THAT IS A LOVELY NAME FOR SOMEONE ELSE. YOU, HOWEVER, ARE A CARL.'])),
      ai('THE PAPERWORK IS ALREADY FILED, CARL. THE AUDIENCE LOVES IT. MOVING ON.')];
  }
  scenes.nameEntry = {
    enter: function (p) {
      var self = this;
      this.p = p || {}; this.t = 0; this.name = ''; this.row = 0; this.col = 0; this.done = false; this.said = false;
      tryCall(I(), 'textCapture', [function (kind, ch) {
        if (self.said) return;
        if (kind === 'char') self.add(ch); else if (kind === 'del') self.del(); else if (kind === 'done') self.finish();
      }]);
    },
    exit: function () { tryCall(I(), 'textCapture', [null]); },
    add: function (ch) {
      if (this.name.length >= NAME_MAX || (ch === ' ' && (!this.name || / $/.test(this.name)))) { sfx('error'); return; }
      this.name += ch; sfx('menu_move');
    },
    del: function () { if (!this.name) return; this.name = this.name.slice(0, -1); sfx('menu_back'); },
    finish: function () {
      if (this.said || this.t < 0.3) return;
      this.said = true; sfx('menu_select');
      tryCall(I(), 'textCapture', [null]);
      var s = save(), self = this;
      s.meta = s.meta || {};
      s.meta.nameTries = (s.meta.nameTries || 0) + 1;
      s.meta.typedName = this.name.replace(/\s+$/, '');
      var run = getRun(); if (run) run.typedName = s.meta.typedName;
      tryCall(DCW, 'persist', []);
      ui.say(carlLines(s.meta.typedName, s.meta.nameTries), { onDone: function () {
        if (self.done) return; self.done = true;
        if (self.p.onDone) self.p.onDone(); else tryCall(DCW.game, 'startFloor', [1]);
      } });
    },
    update: function (dt) {
      this.t += dt;
      if (this.said) return;
      var rows = NAME_ROWS.length + 1, cols;
      if (P('up') || P('down')) {
        var fromCmd = this.row === NAME_ROWS.length;
        this.row = (this.row + (P('down') ? 1 : rows - 1)) % rows;
        var toCmd = this.row === NAME_ROWS.length;
        if (fromCmd && !toCmd) this.col = [1, 5, 8][this.col] || 0;
        else if (!fromCmd && toCmd) this.col = this.col < 4 ? 0 : this.col < 7 ? 1 : 2;
        sfx('menu_move');
      }
      cols = this.row < NAME_ROWS.length ? NAME_ROWS[0].length : NAME_CMDS.length;
      if (P('left')) { this.col = (this.col + cols - 1) % cols; sfx('menu_move'); }
      if (P('right')) { this.col = (this.col + 1) % cols; sfx('menu_move'); }
      if (P('start')) { this.finish(); return; }
      if (P('back')) this.del();
      if (P('confirm') && this.t > 0.3) {
        if (this.row < NAME_ROWS.length) this.add(NAME_ROWS[this.row].charAt(this.col));
        else if (this.col === 0) this.add(' ');
        else if (this.col === 1) this.del();
        else this.finish();
      }
    },
    idle: function (dt) { this.t += dt; },
    draw: function (ctx) {
      var self = this;
      R(0, 0, W, H, C.black);
      BOX(8, 6, 304, 40);
      R(12, 9, 34, 34, C.white); R(13, 10, 32, 32, C.black); portrait(ctx, 'p_ai', 13, 10);
      T('SYSTEM AI', 52, 11, C.gold);
      T('PLEASE ENTER YOUR NAME, CRAWLER.', 52, 22, C.white);
      T('IT IS FOR THE PAPERWORK.', 52, 31, C.gray);
      var fx = 160 - 66;
      BOX(fx, 52, 132, 22);
      var shown = this.name + (this.name.length < NAME_MAX && !this.said && blink(2.5) ? '_' : '');
      T(shown, fx + 6, 57, C.yellow, { scale: 2 });
      var gx = 160 - 5 * 18 + 3, gy = 82;
      NAME_ROWS.forEach(function (row, r) {
        for (var c = 0; c < row.length; c++) {
          var sel = !self.said && self.row === r && self.col === c, x = gx + c * 18, y = gy + r * 14;
          if (sel) R(x - 4, y - 3, 14, 12, C.dblue);
          T(row.charAt(c), x, y, sel ? C.white : C.gray);
        }
      });
      var cy = gy + NAME_ROWS.length * 14 + 4, cw = 54, cx0 = 160 - Math.round((NAME_CMDS.length * cw - 8) / 2);
      NAME_CMDS.forEach(function (lbl, k) {
        var sel = !self.said && self.row === NAME_ROWS.length && self.col === k, x = cx0 + k * cw;
        R(x, cy - 3, cw - 8, 12, sel ? C.dblue : C.navy);
        T(lbl, x + (cw - 8) / 2, cy, sel ? C.white : (k === 2 ? C.green : C.gray), { align: 'center' });
      });
      var kbd = ((DCW.input && DCW.input.lastDevice) || 'keyboard') === 'keyboard';
      if (!this.said) T(kbd ? 'TYPE YOUR NAME.  ENTER: DONE  BKSP: DELETE' : 'PICK LETTERS.  ' + bn('start') + ': DONE  ' + bn('back') + ': DELETE', 160, 168, C.dgray, { align: 'center', shadow: null });
    }
  };

  /* ================================================================
     SAVE SLOTS (title menu): each slot is its own profile
     ================================================================ */
  function agoText(ms) {
    if (!ms) return '';
    var m = Math.floor((Date.now() - ms) / 60000);
    return m < 1 ? 'PLAYED JUST NOW' : m < 60 ? 'PLAYED ' + m + 'M AGO' : m < 1440 ? 'PLAYED ' + Math.floor(m / 60) + 'H AGO' : 'PLAYED ' + Math.floor(m / 1440) + 'D AGO';
  }
  function slotSummary(i) {
    if (i.empty) return { right: 'EMPTY', color: C.dgray, hint: 'A FRESH START. NEW ACHIEVEMENTS, SAME CONTROLS.' };
    var right = i.won ? 'BOOK CLEARED' : i.floor ? 'FLOOR ' + i.floor + ' LV' + i.level : 'NO CRAWL';
    var bits = ['RUNS ' + i.runs, 'BEST FLOOR ' + i.bestFloor];
    if (i.wins) bits.push('WINS ' + i.wins);
    if (i.achievements) bits.push(i.achievements + ' ACHIEVEMENTS');
    var ago = agoText(i.lastPlayed);
    return { right: right, color: i.won ? C.gold : C.white, hint: bits.join('. ') + '.' + (ago ? ' ' + ago + '.' : '') };
  }
  function switchSlot(n, erased) {
    if (n !== DCW.slot) DCW.useSlot(n);
    applySettings();
    closeAll();
    DCW.fade(function () { DCW.setScene(ui.scenes.title, {}); });
    setTimeout(function () { ui.toast(erased ? 'SLOT ' + n + ' ERASED. FRESH MEAT!' : 'SLOT ' + n + ' LOADED', { icon: erased ? 'skull' : 'star', color: erased ? C.red : C.gold }); }, 400);
  }
  ui.openSlots = function (sel) {
    var items = [];
    for (var n = 1; n <= (DCW.SLOTS || 3); n++) (function (n) {
      var i = DCW.slotInfo ? DCW.slotInfo(n) : { n: n, empty: true }, sm = slotSummary(i);
      items.push({ label: (i.current ? '★ ' : '') + 'SLOT ' + n, right: sm.right, rightColor: i.current ? C.gold : sm.color, color: i.current ? C.gold : null, hint: sm.hint,
        action: function () {
          ui.menu([
            { label: i.current ? 'PLAYING THIS SLOT' : i.empty ? 'START IN THIS SLOT' : 'LOAD THIS SLOT', disabled: i.current, why: 'ALREADY LOADED', action: function () { switchSlot(n); } },
            { label: 'ERASE THIS SLOT', disabled: i.empty, why: 'NOTHING TO ERASE', color: C.red, action: function () {
              ui.confirm('ERASE SLOT ' + n + '? ITS CRAWL, UNLOCKS AND ACHIEVEMENTS ALL GO. OTHER SLOTS ARE SAFE.', function () {
                DCW.eraseSlot(n);
                if (n === DCW.slot) { DCW.persist(); switchSlot(n, true); } else ui.openSlots(n - 1);
              }, { yes: 'ERASE IT', no: 'NO WAIT', color: C.red, border: C.red, onNo: function () { ui.openSlots(n - 1); } });
            } },
            { label: 'BACK', action: function () { ui.openSlots(n - 1); } }
          ], { title: 'SLOT ' + n + (i.empty ? '' : ': ' + sm.right), onBack: function () { ui.openSlots(n - 1); } });
        } });
    })(n);
    return ui.menu(items, { title: 'SAVE SLOTS', sel: sel !== undefined ? sel : (DCW.slot || 1) - 1, w: 230 });
  };

  /* ================================================================
     FLOOR CARD: FLOOR N / NAME / COLLAPSE IN <DAYS> DAYS / intro lines
     ================================================================ */
  scenes.floorCard = {
    enter: function (p) {
      p = p || {};
      this.p = p; this.t = 0; this.said = false; this.done = false;
      var n = typeof p.floor === 'number' ? p.floor : (getRun() || {}).floor || 1;
      this.fd = (typeof p.floor === 'object' && p.floor) || floorDef(n) || { name: 'FLOOR ' + n };
      this.n = typeof p.floor === 'object' ? (this.fd.n || 1) : n;
      sfx('fanfare');
    },
    next: function () {
      if (this.said) return; this.said = true;
      var self = this, intro = this.fd.intro;
      var finish = function () { if (self.done) return; self.done = true; if (self.p.onDone) self.p.onDone(); };
      if (intro && (!Array.isArray(intro) || intro.length)) ui.say(intro, { onDone: finish });
      else finish();
    },
    update: function (dt) {
      this.t += dt;
      if (this.t > 3.2 || ((P('confirm') || P('start')) && this.t > 0.5)) this.next();
    },
    idle: function (dt) { this.t += dt; },
    draw: function (ctx) {
      var t = this.t, fd = this.fd;
      R(0, 0, W, H, C.black);
      // NES double-line frame
      R(6, 6, W - 12, 1, C.dgray); R(6, H - 7, W - 12, 1, C.dgray); R(6, 6, 1, H - 12, C.dgray); R(W - 7, 6, 1, H - 12, C.dgray);
      R(8, 8, W - 16, 1, C.dred); R(8, H - 9, W - 16, 1, C.dred); R(8, 8, 1, H - 16, C.dred); R(W - 9, 8, 1, H - 16, C.dred);
      if (t > 0.15) T('FLOOR', 160, 10, C.white, { align: 'center', scale: 2 });
      if (t > 0.4) {
        var ny = t < 0.55 ? 26 : 29;
        T(String(this.n), 162, ny + 2, C.dred, { align: 'center', scale: 5, shadow: null });
        T(String(this.n), 160, ny, C.gold, { align: 'center', scale: 5, shadow: null });
      }
      if (t > 0.8) {
        var nm = String(fd.name || '').toUpperCase(), big = tw(nm, 2) <= 284;
        T(nm, 160, big ? 69 : 73, C.white, { align: 'center', scale: big ? 2 : 1 });
      }
      if (t > 1.2 && fd.days) {
        var ct = 'COLLAPSE IN ' + fd.days + ' DAYS', cw = tw(ct) + 22;
        BOX(160 - cw / 2, 88, cw, 14, { border: blink(2) ? C.red : C.dred });
        icon(ctx, 'clock', 160 - cw / 2 + 4, 91);
        T(ct, 160 - cw / 2 + 15, 91, C.red);
      }
      if (t > 1.5 && fd.tagline) T(fitText(String(fd.tagline).toUpperCase(), 296), 160, 106, C.yellow, { align: 'center' });
      if (t > 1.6 && !this.said && blink(2)) T(bn('confirm'), 312, 168, C.dgray, { align: 'right', shadow: null });
    }
  };

  /* ================================================================
     RESULTS
     ================================================================ */
  function rankOf(r) {
    var pts = 0;
    if (!r.damageTaken) pts += 2; else if (r.damageTaken <= 4) pts += 1;
    if ((r.maxCombo || 0) >= 25) pts += 2; else if ((r.maxCombo || 0) >= 10) pts += 1;
    if (r.secrets) pts += 1;
    if ((r.kills || 0) >= 15) pts += 1;
    return pts >= 5 ? 'S' : pts >= 3 ? 'A' : pts >= 2 ? 'B' : pts >= 1 ? 'C' : 'D';
  }
  scenes.results = {
    enter: function (p) {
      p = p || {};
      this.p = p; this.r = p.result || {}; this.rw = (p.rewards || []).map(rewardInfo);
      this.t = 0; this.step = 0; this.stepT = 0; this.done = false;
      var sd = stageDef(this.r.stageId) || {};
      this.name = sd.name || this.r.stageName || 'STAGE';
      this.boss = sd.kind === 'boss' || !!this.r.boss;
      this.quip = aiLine('stageClear', 'THAT WAS ADEQUATE. THE AUDIENCE IS MILDLY ENTERTAINED.');
      var r = this.r, off = !viewersOn();
      this.rows = [
        ['KILLS', r.kills || 0, function (v) { return String(Math.round(v)); }],
        ['TIME', r.time || 0, function (v) { return fmtTime(v); }],
        ['DAMAGE TAKEN', r.damageTaken || 0, function (v) { return String(Math.round(v)); }],
        ['MAX COMBO', r.maxCombo || 0, function (v) { return Math.round(v) + '×'; }],
        off ? ['VIEWS', 0, function () { return 'OFF AIR'; }] : ['VIEWS GAINED', r.views || 0, function (v) { return fmtNum(v); }],
        ['GOLD', r.gold || 0, function (v) { return String(Math.round(v)); }]
      ];
      this.rank = rankOf(r);
      music('results');
    },
    total: function () { return this.rows.length + this.rw.length + 2; },
    update: function (dt) {
      this.t += dt; this.stepT += dt;
      var tot = this.total();
      if (this.step < tot && this.stepT > (this.step < this.rows.length ? 0.32 : 0.4)) {
        this.step++; this.stepT = 0;
        if (this.step <= this.rows.length) sfx('coin'); else if (this.step < tot) sfx('pickup'); else sfx('fanfare');
      }
      if (P('confirm') || P('start')) {
        if (this.step < tot) { this.step = tot; this.stepT = 1; sfx('menu_select'); }
        else if (!this.done && this.t > 0.6) { this.done = true; sfx('menu_select'); if (this.p.onDone) this.p.onDone(); else tryCall(DCW.game, 'resumeFloor', []); }
      }
    },
    idle: function (dt) { this.t += dt; },
    draw: function (ctx) {
      var self = this;
      R(0, 0, W, H, C.black);
      stars(ctx, this.t, 0, H, 50);
      T(this.boss ? 'BOSS DEFEATED!' : 'STAGE CLEAR!', 160, 5, blink(2) ? C.gold : C.yellow, { align: 'center', scale: 2 });
      T(fitText(String(this.name).toUpperCase(), 300), 160, 24, C.white, { align: 'center' });
      BOX(8, 36, 150, 96);
      this.rows.forEach(function (r, k) {
        if (self.step <= k) return;
        var yy = 42 + k * 11, frac = self.step === k + 1 ? clamp(self.stepT / 0.28, 0, 1) : 1;
        T(r[0], 14, yy, C.gray);
        T(r[2](r[1] * frac), 152, yy, k === 2 && !r[1] ? C.green : r[0] === 'VIEWS' ? C.dgray : C.white, { align: 'right' });
      });
      if (this.step > this.rows.length) {
        T('RANK', 14, 112, C.gray);
        var rc = { S: C.gold, A: C.green, B: C.blue, C: C.white, D: C.dgray }[this.rank];
        T(this.rank, 150, 108, rc, { align: 'right', scale: 2 });
      }
      BOX(164, 36, 148, 96);
      T('REWARDS', 238, 41, C.gold, { align: 'center' });
      if (!this.rw.length && this.step > this.rows.length) T('NOTHING. HARSH.', 238, 60, C.dgray, { align: 'center' });
      this.rw.slice(0, 7).forEach(function (r, k) {
        if (self.step <= self.rows.length + k) return;
        var yy = 53 + k * 11;
        icon(ctx, r.icon, 169, yy - 1);
        T(fitText(r.text, 128), 180, yy, r.color);
      });
      if (this.step >= this.total()) {
        BOX(4, 136, 312, 40);
        R(8, 139, 34, 34, C.white); R(9, 140, 32, 32, C.black); portrait(ctx, 'p_ai', 9, 140);
        wrap(String(this.quip).toUpperCase(), 262).slice(0, 3).forEach(function (l, k) { T(l, 47, 141 + k * 10, C.white); });
        if (blink(2.5)) T('▼', 304, 165, C.gold);
      }
    }
  };

  /* ================================================================
     DEATH
     ================================================================ */
  scenes.death = {
    enter: function (p) {
      p = p || {};
      this.r = p.result || {}; this.t = 0; this.sel = 0; this.busy = false;
      this.quip = aiLine('death', 'OH NO. ANYWAY. THE RATINGS FOR THAT WERE INCREDIBLE.');
      var run = getRun();
      this.revivals = run && run.revivals > 0 ? run.revivals : 0;
      if (hasG('canRevive')) this.revivals = G('canRevive') ? Math.max(1, this.revivals) : 0;
      music('gameover');
      sfx('death');
    },
    items: function () {
      var self = this;
      var out = [];
      if (this.revivals > 0) out.push({ label: 'SPONSOR REVIVAL (' + this.revivals + ' LEFT)', color: C.pink, action: function () {
        self.busy = true; sfx('heal');
        var ok = G('revive');
        if (!ok) { self.busy = false; ui.toast('THE SPONSORS HUNG UP.', { icon: 'skull', color: C.red }); self.revivals = 0; }
      } });
      out.push({ label: 'RETURN TO TITLE', action: function () {
        self.busy = true;
        var run = getRun();
        var noRevive = !(self.revivals > 0);
        if (noRevive && run && tryCall(DCW.game, 'endRun', []) !== MISSING) return; // endRun clears the run + goes to title
        toTitle();
      } });
      return out;
    },
    update: function (dt) {
      this.t += dt;
      if (this.busy || this.t < 1.6) return;
      var its = this.items();
      listNav(this, its.length, dt);
      if (P('confirm')) {
        var it = its[this.sel];
        if (it.label === 'RETURN TO TITLE' && this.revivals > 0) { var self = this; ui.confirm('GIVE UP FOR NOW? YOUR CRAWL IS SAVED.', function () { self.busy = true; toTitle(); }); return; }
        sfx('menu_select'); it.action();
      }
    },
    idle: function (dt) { this.t += dt; },
    draw: function (ctx) {
      var t = this.t, self = this;
      R(0, 0, W, H, C.black);
      for (var i = 0; i < 30; i++) { var ax = (i * 41) % W, ay = Math.round((t * (8 + i % 5) + i * 23) % H); R(ax, ay, 1, 2, C.dred); }
      var msg = 'YOU HAVE DIED', mw = tw(msg, 2), mx = 160 - mw / 2;
      for (var k = 0; k < msg.length; k++) {
        var lt = clamp((t - k * 0.06) / 0.3, 0, 1);
        if (lt <= 0) continue;
        var ly = Math.round(-20 + 44 * (1 - Math.pow(1 - lt, 2)));
        T(msg.charAt(k), mx + k * 12, ly, C.red, { scale: 2 });
      }
      var run = getRun() || {};
      R(128, 84, 64, 3, C.dred);
      bigSprite(ctx, 'carl_dead', 160, 86, { scale: 2, skin: equipped('skin') });
      if (t > 0.8) {
        T(fitText('CAUSE: ' + String(this.r.cause || 'MISADVENTURE').toUpperCase(), 300), 160, 48, C.gray, { align: 'center' });
        BOX(4, 92, 312, 38);
        R(8, 95, 34, 32, C.black); portrait(ctx, 'p_ai', 9, 95);
        wrap(String(this.quip).toUpperCase(), 262).slice(0, 3).forEach(function (l, i) { T(l, 47, 97 + i * 10, C.white); });
      }
      if (t > 1.6) {
        var its = this.items();
        if (!(this.revivals > 0)) T('NO SPONSORS LEFT. THIS CRAWL IS OVER.', 160, 136, C.red, { align: 'center' });
        var y0 = this.revivals > 0 ? 140 : 152;
        its.forEach(function (it, i) {
          var yy = y0 + i * 12, w = tw(it.label);
          if (i === self.sel) cursor(150 - w / 2, yy);
          T(it.label, 160 - w / 2 + 6, yy, i === self.sel ? (it.color || C.white) : C.dgray);
        });
        T((viewersOn() ? 'VIEWS ' + fmtNum(run.views || 0) + '  ' : '') + 'LV ' + (run.level || 1) + '  FLOOR ' + (run.floor || 1), 160, 172, C.dgray, { align: 'center', shadow: null });
      }
    }
  };

  /* ================================================================
     SAFE ROOM - driven by D.safeRooms[room]
     stations (left to right) from def.services + the exit door,
     the npc behind the counter, greet on first visit, extras.
     ================================================================ */
  var GROUND = 150;
  var SERVICES = ['shop', 'mordecai', 'boxes', 'rest', 'cookies', 'tv', 'mailbox'];
  var SR_LABEL = { shop: 'SHOP', mordecai: 'MORDECAI', boxes: 'LOOT BOXES', rest: 'REST', cookies: 'EXPERIENCE COOKIES', tv: 'TV', mailbox: 'MAILBOX', door: 'EXIT' };
  var SR_VERB = { shop: 'SHOP', mordecai: 'TALK', boxes: 'OPEN', rest: 'REST', cookies: 'EAT ONE', tv: 'WATCH', mailbox: 'CHECK', door: 'LEAVE', extra: 'TALK' };
  var SR_H = { shop: 36, mordecai: 38, boxes: 32, rest: 24, cookies: 26, tv: 42, mailbox: 36, door: 44 };
  var NPC_NAME = { mordecai: 'MORDECAI', tally: 'TALLY', qwist: 'QWIST' };
  var TV_FB = ['RECAP TONIGHT: A CRAWLER PUNCHED A RAT TO DEATH WITH HIS BARE FEET. THE AUDIENCE GAVE IT A NINE.',
    'PATCH NOTES: BATHROOM DOORS NO LONGER EXPLODE. YOU ARE WELCOME.',
    'CRAWLERS REMAINING: FEWER THAN THIS MORNING. MORE THAN TOMORROW.',
    'SPONSOR MESSAGE: HAVE YOU TRIED NOT DYING? ASK YOUR CRAWL GUIDE.'];
  var MAIL_FB = ['THE MAILBOX IS EMPTY. A SPIDER HAS FILED A COMPLAINT ABOUT YOU.', 'A FLYER: "HAVE YOU CONSIDERED A CAREER IN BEING EATEN?"'];
  function roomDef(p) {
    var id = p && p.room, def = null;
    if (hasG('safeRoomDef')) def = G('safeRoomDef', id);
    if (!def) {
      var run = getRun() || {}, d = D('safeRooms') || {};
      id = id || run.room;
      def = {}; var src = (id && d[id]) || {};
      Object.keys(src).forEach(function (k) { def[k] = src[k]; });
      def.id = id || 'safe';
    }
    if (!def.name) def.name = 'SAFE ROOM';
    if (!def.theme) def.theme = 'safe';
    if (!Array.isArray(def.services)) def.services = ['mordecai', 'boxes', 'rest'];
    return def;
  }
  function npcSprite(id) {
    if (!id) return null;
    if (id === 'mordecai') return mordForm().sprite;
    return firstArt([id + '_idle', id, 'bopca']) || id + '_idle';
  }
  function npcPortrait(id) {
    if (!id) return 'p_ai';
    if (id === 'mordecai') return mordForm().portrait;
    return firstArt(['p_' + id, 'p_bopca']) || 'p_' + id;
  }
  function npcLabel(id, def) { return String((def && def.npcName) || NPC_NAME[id] || String(id || '').replace(/_/g, ' ')).toUpperCase(); }
  function extraName(ex) {
    if (ex.name) return String(ex.name).toUpperCase();
    return String(ex.sprite || 'STRANGER').replace(/_(idle|walk|run|act|attack)$/, '').replace(/_/g, ' ').toUpperCase();
  }
  scenes.safeRoom = {
    enter: function (p) {
      p = p || {};
      var self = this, run = getRun() || {};
      var def = this.def = roomDef(p);
      this.t = 0; this.x = 276; this.face = -1; this.moving = false;
      this.cx = 294; this.cface = -1; this.cmoving = false;
      this.pet = 0; this.hearts = []; this.near = null; this.leaving = false; this.mailI = 0; this.mailRead = false;
      var svc = def.services.filter(function (s) { return SERVICES.indexOf(s) >= 0; });
      var n = svc.length, span = 238, step = n ? span / n : 0;
      this.npc = def.npc || null;
      this.objs = svc.map(function (s, i) { return { id: s, x: Math.round(28 + step * (i + 0.5)), label: SR_LABEL[s], verb: SR_VERB[s], h: SR_H[s] }; });
      // where the npc stands: behind the shop counter, or at their own station
      this.npcAt = null;
      if (this.npc && this.npc !== 'mordecai') {
        this.npcAt = this.objs.filter(function (o) { return o.id === 'shop'; })[0] || this.objs.filter(function (o) { return o.id === 'rest'; })[0] || null;
      }
      this.objs.forEach(function (o) {
        if (o.id === 'shop') o.label = self.npcAt === o ? npcLabel(self.npc, def) + '\'S SHOP' : 'VENDING MACHINE';
        if (o.id === 'mordecai') { var mf = mordForm(); o.label = 'MORDECAI'; o.sprite = mf.sprite; }
        if (o.id === 'rest') o.label = String(def.restName || (self.npcAt && self.npc !== 'mordecai' ? 'A HOT MEAL' : 'REST')).toUpperCase();
        if (o.id === 'rest') o.verb = def.restVerb ? String(def.restVerb).toUpperCase() : (self.npcAt && self.npc !== 'mordecai' ? 'EAT' : 'REST');
      });
      (Array.isArray(def.extras) ? def.extras : []).forEach(function (ex) {
        if (!ex || !ex.sprite) return;
        var inf = artInfo(ex.sprite);
        self.objs.push({ id: 'extra', ex: ex, x: clamp(ex.x || 200, 12, 300), label: extraName(ex), verb: 'TALK', h: (inf ? inf.h : 24) + 8 });
      });
      this.objs.push({ id: 'door', x: 302, label: 'EXIT', verb: 'LEAVE', h: SR_H.door });
      // greet on the first visit (game.js says so; else remember it ourselves)
      run.roomGreeted = run.roomGreeted || {};
      var greet = Array.isArray(def.greet) ? def.greet : def.greet ? [def.greet] : [];
      this.greetPending = greet.length && (p.firstVisit === true || (p.firstVisit === undefined && !run.roomGreeted[def.id])) ? greet : null;
      if (this.greetPending) { run.roomGreeted[def.id] = true; persist(); }
      music(def.music || 'safe');
      if (DCW.art && typeof DCW.art.prepare === 'function') { try { DCW.art.prepare(def.theme); } catch (e) { /* optional */ } }
    },
    interact: function (o) {
      var self = this, def = this.def, run = getRun() || {};
      var npcWho = this.npc && this.npc !== 'mordecai' ? npcLabel(this.npc, def) : null;
      function line(text, who) { return typeof text === 'object' ? text : { who: who || 'SYSTEM AI', text: text }; }
      sfx('menu_select');
      if (o.id === 'shop') {
        ui.openShop(this.npcAt === o ? { keeper: npcLabel(this.npc, def), portrait: npcPortrait(this.npc), lines: def.shopLines } : { keeper: 'VENDING MACHINE', portrait: 'p_ai', lines: def.shopLines || ['INSERT GOLD. RECEIVE ITEM. DO NOT SHAKE THE MACHINE.'] });
      } else if (o.id === 'boxes') ui.openBoxes();
      else if (o.id === 'mordecai') this.mordecai();
      else if (o.id === 'rest') {
        if (run.restedHere) { ui.say([line(def.restedLine || 'YOU ALREADY RESTED THIS VISIT. THE DUNGEON IS NOT A SPA.', npcWho || 'SYSTEM AI')]); return; }
        run.restedHere = true;
        if (hasG('heal')) G('heal', 9999); else run.hp = pStats().maxHp || run.hp;
        persist(); sfx('heal');
        ui.toast('FULLY HEALED', { icon: 'heart', color: C.green });
        ui.say([line(def.restLine || (npcWho ? 'EAT. ALL OF IT. YOU LOOK LIKE A SKELETON WITH OPINIONS.' : 'YOU SLEEP LIKE THE DEAD. DOWN HERE THAT IS A COMPLIMENT.'), npcWho || 'SYSTEM AI')]);
      } else if (o.id === 'cookies') {
        var xp = G('eatCookie');
        if (typeof xp !== 'number') { // no game support: once per visit, by hand
          if (run.cookieHere) xp = 0; else { run.cookieHere = true; xp = def.cookieXp || 30; G('addXP', xp); persist(); }
        }
        if (xp > 0) {
          ui.toast('+' + xp + ' XP', { title: 'EXPERIENCE COOKIE', icon: 'star', color: C.green });
          ui.say([line(pick(def.cookieLines) || 'CRUNCHY. YOU FEEL SMARTER. YOU ARE NOT, BUT THE NUMBERS WENT UP.')]);
        } else ui.say([line('ONE COOKIE PER VISIT, CARL. I COUNTED. I ALWAYS COUNT.')]);
      } else if (o.id === 'tv') {
        var tl = pick(def.tvLines) || pick(TV_FB);
        ui.say([typeof tl === 'object' ? tl : { who: 'TV', portrait: 'p_ai', text: tl }]);
      } else if (o.id === 'mailbox') {
        var ml = (def.mailLines && def.mailLines.length) ? def.mailLines : MAIL_FB;
        var msg = ml[this.mailI % ml.length]; this.mailI++;
        if (this.mailI >= ml.length) this.mailRead = true;
        ui.say([typeof msg === 'object' ? msg : { who: 'MAIL', portrait: null, text: msg }]);
      } else if (o.id === 'extra') {
        var ex = o.ex, nm = extraName(ex), por = ex.portrait !== undefined ? ex.portrait : (whoPortrait(nm) || firstArt(['p_' + String(ex.sprite).replace(/_(idle|walk|run|act|attack)$/, '')]));
        var ls = Array.isArray(ex.lines) ? ex.lines : ex.lines ? [ex.lines] : ['...'];
        ex._i = ex._i || 0;
        // a talkable NPC says its lines in order, one bit per talk, then loops
        var chunk = ex.all ? ls : [ls[ex._i % ls.length]]; ex._i++;
        ui.say(chunk.map(function (l) { return typeof l === 'object' ? l : { who: nm, portrait: por || null, text: l }; }));
      } else if (o.id === 'door') {
        ui.confirm('LEAVE THE SAFE ROOM?', function () {
          self.leaving = true; sfx('door');
          if (tryCall(DCW.game, 'leaveSafeRoom', []) === MISSING) { self.leaving = false; ui.toast('NOWHERE TO GO', { color: C.red }); }
        });
      }
    },
    mordecai: function () {
      var run = getRun() || {}, mf = mordForm(), def = this.def;
      var fl = floorDef() || {};
      var rumorPool = (fl.hints || []).slice();
      var hasRest = this.objs.some(function (o) { return o.id === 'rest'; });
      var who = function (t) { return { who: 'MORDECAI', portrait: mf.portrait, text: t }; };
      var tip = function () {
        var pool = (def.tips && def.tips.length) ? def.tips : (rumorPool.length && Math.random() < 0.5 ? rumorPool : D('mordecai'));
        ui.say([who(pick(pool) || 'KEEP YOUR HEAD DOWN AND YOUR FISTS UP. AND FEED THE CAT.')]);
      };
      var openMenu = function () {
        ui.menu([
          { label: 'ASK FOR A TIP', action: tip },
          { label: (run.statPoints > 0 ? 'TRAIN (' + run.statPoints + ' STAT POINT' + (run.statPoints > 1 ? 'S' : '') + ')' : 'TRAIN'), disabled: !(run.statPoints > 0), why: 'NO STAT POINTS. GO LEVEL UP.', action: function () { ui.openCharacter(); } },
          hasRest ? null : { label: 'REST (FULL HEAL)', disabled: !!run.restedHere, why: 'YOU ALREADY RESTED THIS VISIT.', action: function () {
            var r = getRun(); if (r) r.restedHere = true;
            if (hasG('heal')) G('heal', 9999); else if (r) r.hp = pStats().maxHp || r.hp;
            persist(); sfx('heal');
            ui.say([who('SLEEP. I\'LL WATCH THE DOOR. NOTHING GETS IN HERE ANYWAY. MOSTLY.')]);
            ui.toast('FULLY HEALED', { icon: 'heart', color: C.green });
          } },
          { label: 'NEVERMIND', action: function () {} }
        ].filter(Boolean), { title: mf.name ? 'MORDECAI THE ' + mf.name : 'MORDECAI', titleColor: C.green });
      };
      run.mordecaiMet = run.mordecaiMet || {};
      if (mf.line && !run.mordecaiMet[mf.n]) {
        run.mordecaiMet[mf.n] = true; persist();
        ui.say([who(mf.line)], { onDone: openMenu });
      } else openMenu();
    },
    update: function (dt) {
      this.t += dt;
      if (this.leaving) return;
      tryCall(DCW.game, 'tick', [dt]);
      if (this.greetPending && this.t > 0.45) { var g = this.greetPending; this.greetPending = null; ui.say(g); return; }
      var ax = (Dn('right') ? 1 : 0) - (Dn('left') ? 1 : 0);
      this.moving = ax !== 0 && this.pet <= 0;
      if (this.moving) { this.face = ax; this.x = clamp(this.x + ax * 70 * dt, 12, 308); }
      var tx = this.x - this.face * 20, d = tx - this.cx;
      this.cmoving = Math.abs(d) > 2;
      if (this.cmoving) { this.cface = d > 0 ? 1 : -1; this.cx += clamp(d, -80 * dt, 80 * dt); }
      else this.cface = this.x > this.cx ? 1 : -1;
      var self = this, best = 99; this.near = null;
      this.objs.forEach(function (o) { var dd = Math.abs(o.x - self.x); if (dd < (o.id === 'shop' ? 18 : 14) && dd < best) { best = dd; self.near = o; } });
      if (this.pet > 0) this.pet -= dt;
      this.hearts.forEach(function (h) { h.y -= 20 * dt; h.life -= dt; });
      this.hearts = this.hearts.filter(function (h) { return h.life > 0; });
      if (P('start')) { ui.openPause({ canFlee: false }); return; }
      if (P('select')) { sfx('menu_select'); ui.openGear(); return; }
      if (P('down') && !this.moving && Math.abs(this.cx - this.x) < 26 && this.pet <= 0) {
        this.pet = 1.0; sfx('heal', { pitch: 1.5 });
        for (var i = 0; i < 4; i++) this.hearts.push({ x: this.cx - 9 + i * 5, y: GROUND - 20 - i * 4, life: 0.9 + i * 0.15 });
        var comp = equipped('companion');
        G('track', comp === 'donut' ? 'pet_donut' : 'pet_' + comp);
        return;
      }
      if ((P('confirm') || P('up')) && this.near) this.interact(this.near);
    },
    idle: function (dt) { this.t += dt; },
    drawStation: function (ctx, o, t) {
      var x = o.x, g = GROUND, run = getRun() || {}, self = this;
      if (o.id === 'shop') {
        if (this.npcAt === o) {
          var nsp = npcSprite(this.npc), inf = artInfo(nsp), nh = inf ? inf.h : 24;
          spr(ctx, nsp, x, Math.min(g, g - 31 + nh), { frame: Math.floor(t * 2) % 2, flip: this.x < x });
          // the counter
          R(x - 23, g - 19, 46, 19, C.black); R(x - 22, g - 18, 44, 3, C.tan); R(x - 22, g - 15, 44, 15, C.brown);
          for (var px = x - 18; px < x + 22; px += 8) R(px, g - 13, 1, 12, C.dbrown);
          icon(ctx, 'potion', x - 21, g - 27); icon(ctx, flag('jugs') ? 'jug' : 'bomb', x + 12, g - 27);
        } else { // vending machine
          R(x - 13, g - 36, 26, 36, C.black); R(x - 12, g - 35, 24, 35, C.dred); R(x - 12, g - 35, 24, 2, C.red);
          R(x - 9, g - 31, 14, 18, C.black); R(x - 8, g - 30, 12, 16, C.navy);
          icon(ctx, 'potion', x - 7, g - 30); icon(ctx, 'biscuit', x - 7, g - 22);
          R(x + 7, g - 30, 3, 6, C.gray); R(x + 7, g - 22, 3, 2, (Math.floor(t * 2) % 2) ? C.green : C.ddgreen);
          R(x - 9, g - 10, 14, 5, C.black);
        }
      } else if (o.id === 'mordecai') {
        var tx2 = x + 18;
        R(tx2 - 10, g - 14, 20, 3, C.black); R(tx2 - 9, g - 14, 18, 2, C.tan); R(tx2 - 8, g - 12, 2, 12, C.brown); R(tx2 + 6, g - 12, 2, 12, C.brown);
        icon(ctx, 'potion', tx2 - 8, g - 22);
        var cf = Math.floor(t * 6) % 2; R(tx2 + 4, g - 20, 2, 5, C.white); R(tx2 + 4, g - 23 - cf, 2, 2 + cf, cf ? C.yellow : C.orange);
        spr(ctx, o.sprite || mordForm().sprite, x, g, { frame: Math.floor(t * 1.5) % 2, flip: this.x < x });
      } else if (o.id === 'boxes') {
        var bx = run.boxes || [];
        if (!bx.length) spr(ctx, 'box_bronze', x, g, { frame: 0, flash: false });
        bx.slice(0, 3).forEach(function (b, i) { spr(ctx, 'box_' + b.tier, x - 6 + (i % 2) * 12, g - Math.floor(i / 2) * 13, { frame: i === 0 ? Math.floor(t * 4) : 0 }); });
        if (!bx.length) { R(x - 9, g - 15, 18, 15, C.black); T('0', x, g - 11, C.dgray, { align: 'center', shadow: null }); }
        else { BOX(x + 8, g - 32, tw(bx.length) + 8, 11, { fill: C.red }); T(bx.length, x + 12, g - 30, C.white); }
      } else if (o.id === 'rest') {
        var food = this.npcAt && this.npc !== 'mordecai';
        if (food) { // a booth table with a steaming bowl
          R(x - 16, g - 14, 32, 3, C.black); R(x - 15, g - 14, 30, 2, C.tan); R(x - 2, g - 12, 4, 12, C.brown);
          R(x - 6, g - 19, 12, 5, C.black); R(x - 5, g - 18, 10, 3, C.rust); R(x - 5, g - 19, 10, 1, C.orange);
          if (!run.restedHere) { var sf = Math.floor(t * 3) % 2; R(x - 3 + sf, g - 24, 1, 3, C.gray); R(x + 2 - sf, g - 26, 1, 3, C.white); }
          R(x - 24, g - 22, 6, 22, C.black); R(x - 23, g - 21, 4, 21, C.dred); R(x + 18, g - 22, 6, 22, C.black); R(x + 19, g - 21, 4, 21, C.dred);
        } else { // a cot
          R(x - 20, g - 10, 40, 6, C.black); R(x - 19, g - 9, 38, 4, C.gray); R(x - 19, g - 11, 9, 4, C.white);
          R(x - 8, g - 10, 27, 5, run.restedHere ? C.dpurple : C.dblue); R(x - 8, g - 10, 27, 1, C.blue);
          R(x - 19, g - 4, 2, 4, C.brown); R(x + 17, g - 4, 2, 4, C.brown);
          if (run.restedHere) T('Z', x + 12, g - 22 - (Math.floor(t * 2) % 2) * 2, C.dgray, { shadow: null });
        }
      } else if (o.id === 'cookies') {
        R(x - 12, g - 14, 24, 3, C.black); R(x - 11, g - 14, 22, 2, C.tan); R(x - 1, g - 12, 2, 12, C.brown); R(x - 6, g - 1, 12, 1, C.brown);
        R(x - 9, g - 17, 18, 3, C.black); R(x - 8, g - 17, 16, 2, C.white);
        var left = run.cookieHere ? 2 : 3;
        for (var c = 0; c < left; c++) { var cx = x - 7 + c * 5; R(cx, g - 20, 5, 3, C.black); R(cx + 1, g - 20, 3, 2, C.tan); R(cx + 2, g - 20, 1, 1, C.dbrown); }
      } else if (o.id === 'tv') {
        R(x - 8, g - 12, 2, 12, C.black); R(x + 6, g - 12, 2, 12, C.black); R(x - 10, g - 13, 20, 2, C.dgray);
        R(x - 15, g - 36, 30, 24, C.black); R(x - 14, g - 35, 28, 22, C.dgray); R(x - 14, g - 35, 28, 1, C.gray);
        R(x - 12, g - 33, 20, 16, C.black);
        var mode = Math.floor(t / 1.6) % 3;
        if (mode === 0) { R(x - 11, g - 32, 18, 14, C.dblue); R(x - 8, g - 29, 3, 3, C.white); R(x + 1, g - 29, 3, 3, C.white); R(x - 6, g - 23, 8 + (Math.floor(t * 6) % 2) * 2 - 2, 1, C.white); }
        else if (mode === 1) { var bars = [C.white, C.yellow, C.cyan, C.green, C.pink, C.red]; for (var b = 0; b < 6; b++) R(x - 11 + b * 3, g - 32, 3, 14, bars[b]); }
        else for (var sy = 0; sy < 14; sy += 2) for (var sx = 0; sx < 18; sx += 3) R(x - 11 + sx, g - 32 + sy, 3, 2, STATIC_COLS[(Math.random() * 4) | 0]);
        R(x + 10, g - 31, 2, 2, C.dbrown); R(x + 10, g - 27, 2, 2, C.dbrown);
        R(x - 4, g - 40, 1, 4, C.gray); R(x - 5, g - 43, 1, 3, C.gray); R(x + 3, g - 40, 1, 4, C.gray); R(x + 4, g - 43, 1, 3, C.gray);
      } else if (o.id === 'mailbox') {
        R(x - 1, g - 16, 3, 16, C.black); R(x, g - 16, 1, 16, C.brown);
        R(x - 9, g - 27, 18, 12, C.black); R(x - 8, g - 26, 16, 10, C.dblue); R(x - 7, g - 27, 14, 1, C.black); R(x - 8, g - 26, 16, 1, C.blue);
        R(x - 6, g - 22, 6, 1, C.black);
        if (!this.mailRead) { R(x + 8, g - 33, 2, 9, C.black); R(x + 8, g - 33, 6, 4, C.black); R(x + 9, g - 32, 4, 2, C.red); }
        else { R(x + 8, g - 24, 6, 2, C.black); R(x + 9, g - 23, 4, 1, C.red); }
      } else if (o.id === 'door') {
        spr(ctx, firstArt(['guild_door', 'door']) || 'door', x, g, {});
      } else if (o.id === 'extra') {
        var ex = o.ex;
        spr(ctx, ex.sprite, x, g - (ex.y || 0), { frame: ex.frame !== undefined ? ex.frame : Math.floor(t * 2) % 2, flip: ex.flip !== undefined ? !!ex.flip : self.x < x });
      }
    },
    draw: function (ctx) {
      var t = this.t, self = this, def = this.def || roomDef({});
      R(0, 0, W, H, C.black);
      if (!drawBg(ctx, def.theme, 0, 0) && !drawBg(ctx, 'safe', 0, 0)) {
        R(0, 0, W, GROUND, C.dbrown);
        for (var wx = 0; wx < W; wx += 32) R(wx, 0, 1, GROUND, C.black);
        R(0, 30, W, 3, C.brown); R(0, 104, W, 2, C.tan);
      }
      floorRow(ctx, (DCW.art && DCW.art.hasBackground && def.theme && DCW.art.hasBackground(def.theme)) ? def.theme : 'safe', GROUND, 0, 2);
      this.objs.forEach(function (o) { if (o.id !== 'door') try { self.drawStation(ctx, o, t); } catch (e) { /* never let a prop kill the room */ } });
      this.objs.forEach(function (o) { if (o.id === 'door') self.drawStation(ctx, o, t); });
      // companion + carl
      var comp = compSprite(equipped('companion'));
      var cs = this.cmoving ? comp + '_run' : comp + '_idle';
      if (this.pet > 0 && hasArt(comp + '_act')) cs = comp + '_act';
      spr(ctx, cs, this.cx, GROUND, { frame: Math.floor(t * (this.cmoving ? 8 : 2)), flip: this.cface < 0 });
      spr(ctx, this.moving ? 'carl_run' : 'carl_idle', this.x, GROUND, { frame: Math.floor(t * (this.moving ? 10 : 2)), flip: this.face < 0, skin: equipped('skin') });
      this.hearts.forEach(function (h) { T('♥', Math.round(h.x), Math.round(h.y), (Math.floor(h.life * 8) % 2) ? C.red : C.pink, { shadow: null }); });
      if (this.pet > 0.2) { var pw2 = tw('PURR'); BOX(this.cx - pw2 / 2 - 4, GROUND - 46, pw2 + 8, 12, { fill: C.white, border: C.black }); T('PURR', this.cx, GROUND - 44, C.black, { align: 'center', shadow: null }); }
      // room name plate (entering)
      if (t < 3.2) {
        var nm = String(def.name || 'SAFE ROOM').toUpperCase(), nw = tw(nm) + 16;
        BOX(160 - nw / 2, 18, nw, 13, { border: C.gold });
        T(nm, 160, 21, C.gold, { align: 'center' });
      }
      // prompt
      if (this.near && !ui.blocking()) {
        var o = this.near, by = GROUND - (o.h || 34) + (Math.floor(t * 4) % 2);
        var lw = tw(o.label) + 8, lx = clamp(o.x - lw / 2, 4, W - 4 - lw);
        BOX(lx, by - 13, lw, 12);
        T(o.label, lx + 4, by - 11, C.gold);
        T('▼', clamp(o.x, 8, W - 8), by, C.white, { align: 'center' });
        BOX(60, 164, 200, 13);
        T(bn('confirm') + ': ' + o.verb, 160, 167, C.white, { align: 'center' });
      } else if (!ui.blocking()) {
        BOX(28, 164, 264, 13);
        T('◀▶ WALK  ' + bn('down') + ' PET  ' + bn('select') + ' GEAR  ' + bn('start') + ' MENU', 160, 167, C.gray, { align: 'center', shadow: null });
      }
      ui.drawHUD(ctx, ui.hudFromRun({ stageName: def.name }));
    }
  };

  /* ================================================================
     ENDING: (story pages) -> THE END OF BOOK ONE -> credits -> teaser
     -> final stats -> title
     ================================================================ */
  var CREDITS_FB = ['DUNGEON CRAWLER CARL', 'BOOK ONE', '', 'A PERSONAL FAN GAME', 'NOT FOR SALE. NOT OFFICIAL.', 'BASED ON THE BOOKS BY MATT DINNIMAN', '',
    'STARRING', 'CARL', 'PRINCESS DONUT', '', 'HOSTED BY', 'THE SYSTEM AI', '', 'THANKS FOR PLAYING!'];
  scenes.ending = {
    enter: function () {
      var self = this;
      this.t = 0; this.ct = 0; this.done = false; this.player = null;
      music('ending');
      var st = D('story'), cr = st && st.credits;
      this.credits = (Array.isArray(cr) && cr.length ? cr : CREDITS_FB).map(function (l) { return String(l).toUpperCase(); });
      // the Book One epilogue is the f2_descent cutscene (played by game.js before this scene);
      // story pages only play here if data asks for them with D.story.endingPages
      var pages = st && Array.isArray(st.endingPages) && st.endingPages.length ? st.endingPages : null;
      if (pages) {
        var panels = pages.map(function (pg) {
          if (typeof pg === 'string') pg = { text: pg };
          if (pg.panels || pg.lines) return pg;
          var who = pg.who !== undefined ? pg.who : (pg.portrait === 'p_ai' ? 'SYSTEM AI' : '');
          return { bg: pg.bg || null, fx: pg.fx || null, actors: pg.actors, lines: [{ who: who, portrait: pg.portrait || null, text: pg.text || '' }] };
        });
        this.phase = 'story';
        this.player = makePlayer({ panels: panels }, 'ending', function () { self.go('end'); });
      } else this.go('end');
    },
    go: function (ph) { this.phase = ph; this.ct = 0; if (ph === 'teaser' || ph === 'stats') sfx('fanfare'); },
    update: function (dt) {
      this.t += dt; this.ct += dt;
      var ph = this.phase, adv = (P('confirm') || P('start')) && this.ct > 0.8;
      if (ph === 'story') { this.player.update(dt); return; }
      if (ph === 'end') { if (adv || this.ct > 9) this.go('credits'); return; }
      if (ph === 'credits') {
        this.cs = (this.cs || 0) + dt * (Dn('confirm') || Dn('jump') ? 5 : 1);
        if (skipP() || this.cs * 18 > this.credits.length * 14 + H + 20) { this.cs = 0; this.go('teaser'); }
        return;
      }
      if (ph === 'teaser') { if (adv || this.ct > 10) this.go('stats'); return; }
      if (adv && !this.done) {
        this.done = true; sfx('menu_select');
        if (tryCall(DCW.game, 'quitToTitle', []) === MISSING) DCW.fade(function () { DCW.setScene(scenes.title, {}); });
      }
    },
    idle: function (dt) { this.t += dt; },
    draw: function (ctx) {
      var t = this.t, ct = this.ct, ph = this.phase;
      if (ph === 'story') { this.player.draw(ctx); return; }
      R(0, 0, W, H, C.black);
      if (ph === 'end') {
        // Carl and Donut walk to the stairwell and go down; THE END OF BOOK ONE
        var top = 24, bot = 112, fl = 104;
        ctx.save(); ctx.beginPath(); ctx.rect(0, top, W, bot - top); ctx.clip();
        ctx.save(); ctx.translate(0, fl - 150);
        var drew = drawBg(ctx, 'stairwell', 0, 0) || drawBg(ctx, 'cinder', 0, 0);
        ctx.restore();
        if (!drew) stars(ctx, t, top, fl - 20, 50);
        floorRow(ctx, bgKnown('stairwell') ? 'cinder' : 'tunnels', fl, 0, 1);
        var sx = 236;
        spr(ctx, firstArt(['stairwell']) || 'stairwell', sx, fl + 6, {});
        var walkX = Math.min(sx - 8, 40 + ct * 44), sink = Math.max(0, ct - 4.3) * 18;
        ctx.save(); ctx.beginPath(); ctx.rect(0, top, W, fl + 2 - top); ctx.clip();
        var moving = walkX < sx - 8;
        spr(ctx, moving ? compSprite(equipped('companion')) + '_run' : compSprite(equipped('companion')) + '_idle', walkX - 22, fl + Math.max(0, sink - 6), { frame: Math.floor(t * 8) });
        spr(ctx, moving ? 'carl_run' : 'carl_idle', walkX, fl + sink, { frame: Math.floor(t * (moving ? 10 : 2)), skin: equipped('skin') });
        ctx.restore();
        ctx.restore();
        R(0, top, W, 1, C.dgray); R(0, bot - 1, W, 1, C.dgray);
        if (ct > 0.6) T('THE END', 160, 126, C.white, { align: 'center', scale: 3, shadow: C.dred });
        if (ct > 1.2) T('OF BOOK ONE', 160, 152, C.gold, { align: 'center', scale: 2 });
        if (ct > 2 && blink(2)) T(bn('confirm'), 312, 170, C.dgray, { align: 'right', shadow: null });
        return;
      }
      if (ph === 'credits') {
        stars(ctx, t, 0, H, 90);
        var y0 = H + 10 - (this.cs || 0) * 18;
        this.credits.forEach(function (l, i) {
          var yy = Math.round(y0 + i * 14); if (yy < -10 || yy > H) return;
          var hdr = i === 0 || /^(STARRING|HOSTED BY|MUSIC|ART|CODE|THANKS|WITH|AND|ALSO|CAST)/.test(l);
          T(l, 160, yy, i === 0 ? C.gold : hdr ? C.pink : C.white, { align: 'center', scale: i === 0 ? 2 : 1 });
        });
        R(0, 168, W, 12, C.black);
        var rx = 30 + ((t * 40) % 300);
        spr(ctx, 'carl_run', Math.round(rx), 177, { frame: Math.floor(t * 10), skin: equipped('skin') });
        spr(ctx, compSprite(equipped('companion')) + '_run', Math.round(rx - 20), 177, { frame: Math.floor(t * 10) });
        return;
      }
      if (ph === 'teaser') {
        stars(ctx, t, 0, H, 40);
        if (ct > 0.3) T('CARL AND DONUT', 160, 34, C.white, { align: 'center', scale: 2 });
        if (ct > 1.0) T('WILL RETURN IN', 160, 58, C.gray, { align: 'center' });
        if (ct > 1.8) {
          T("CARL'S DOOMSDAY", 160, 78, C.gold, { align: 'center', scale: 2, shadow: C.crimson });
          T('SCENARIO', 160, 98, C.gold, { align: 'center', scale: 2, shadow: C.crimson });
        }
        if (ct > 2.6) T('TO BE CONTINUED...', 160, 136, blink(1.5) ? C.white : C.gray, { align: 'center' });
        if (ct > 3 && blink(2)) T(bn('confirm'), 312, 170, C.dgray, { align: 'right', shadow: null });
        return;
      }
      // final stats
      var run = getRun() || {}, meta = (DCW.save && DCW.save.meta) || {};
      var achs = D('achievements') || {}, an = Object.keys(meta.achievements || {}).length;
      frame(ctx, 'FINAL STATS', { footer: bn('confirm') + ': BACK TO TITLE' });
      var gearN = runGear().length;
      var rows = [
        ['FLOORS CLEARED', String(Math.max(2, Math.min(2, meta.bestFloor || 2)))],
        ['LEVEL', String(run.level || '-')],
        ['FOLLOWERS', fmtNum(run.views || 0)],
        ['CRAWLER TITLE', titleFor(run.views || 0)],
        ['KILLS', String(run.kills || 0)],
        ['GEAR FOUND', String(gearN)],
        ['TOTAL TIME', fmtTime((run.totalTime || 0) + (run.floorTime || 0))],
        ['DEATHS (ALL TIME)', String(meta.deaths || 0)],
        ['ACHIEVEMENTS', an + '/' + Object.keys(achs).length]
      ];
      rows.forEach(function (r, i) { var yy = 24 + i * 13; T(r[0], 20, yy, C.gray); T(fitText(r[1], 160), 300, yy, i === 3 ? C.pink : C.white, { align: 'right' }); });
      spr(ctx, 'ai_screen', 286, 160 + (Math.floor(t * 2) % 2 ? -2 : 0), { frame: Math.floor(t * 2) });
    }
  };

  /* ---------------- exports for friends (stage.js, tools) ---------------- */
  ui._h = { tryCall: tryCall, G: G, hasG: hasG, sfx: sfx, music: music, D: D, getRun: getRun, floorDef: floorDef, stageDef: stageDef,
    spr: spr, bigSprite: bigSprite, portrait: portrait, icon: icon, hasArt: hasArt, artInfo: artInfo, T: T, tw: tw, fitText: fitText, wrap: wrap,
    blink: blink, equipped: equipped, compSprite: compSprite, pStats: pStats, bn: bn, persist: persist, aiLine: aiLine, clamp: clamp, MISSING: MISSING,
    C: C, nes: nes, box: BOX, perkText: perkText, perkLines: perkLines, whoPortrait: whoPortrait, bgKnown: bgKnown };
})();

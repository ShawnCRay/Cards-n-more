/* ============================================================
   DCW UI - modal stack, dialog, toasts, banners, menus, HUD,
   pause + sub-screens (character, loot boxes, wardrobe,
   achievements, settings, shop, map, how-to) and the
   non-gameplay scenes (title, intro, floor card, results,
   death, safe room, ending). Contract: ../DESIGN.md "UI contract".
   Every call into game/art/audio/data is feature-detected.
   ============================================================ */
(function () {
  'use strict';
  var DCW = window.DCW = window.DCW || {};
  var ui = DCW.ui = DCW.ui || {};
  var U = DCW.U || {};
  var W = 320, H = 180;

  /* ---------------- palette ---------------- */
  var C = {
    white: '#fcfcfc', gray: '#bcbcbc', dgray: '#7c7c7c', ddgray: '#3c3c3c', black: '#000000',
    red: '#f83800', dred: '#a81000', gold: '#f8b800', yellow: '#f8d878', green: '#58d854', dgreen: '#00a800',
    blue: '#3cbcfc', dblue: '#0058f8', purple: '#d800cc', pink: '#f878f8', orange: '#fca044',
    fill: '#0f1630', cyan: '#00e8d8', brown: '#a85010'
  };
  ui.colors = C;

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
  function save() { return DCW.save || { unlocks: { skins: ['carl_boxers'], companions: ['donut'] }, equipped: { skin: 'carl_boxers', companion: 'donut' }, meta: { achievements: {}, counters: {} }, settings: {} }; }
  function equipped(kind) { var s = save(); return (s.equipped && s.equipped[kind]) || (kind === 'skin' ? 'carl_boxers' : 'donut'); }
  function owned(kind, id) {
    var s = save();
    if (kind !== 'skin') { // companions are rescued per crawl
      if (id === 'donut') return true;
      if (DCW.game && typeof DCW.game.hasCompanion === 'function') return !!DCW.game.hasCompanion(id);
    }
    var l = s.unlocks && s.unlocks[kind === 'skin' ? 'skins' : 'companions']; return !!(l && l.indexOf(id) >= 0);
  }

  /* ---------------- input ---------------- */
  function I() { return DCW.input || { pressed: function () { return false; }, down: function () { return false; } }; }
  function P(b) { return I().pressed(b); }
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
  function listNav(m, n, dt, wrap) {
    if (n <= 0) { m.sel = 0; return 0; }
    var d = 0;
    if (rep(m, 'up', dt)) d = -1; else if (rep(m, 'down', dt)) d = 1;
    if (d) {
      var s = (m.sel || 0) + d;
      if (wrap === false) s = clamp(s, 0, n - 1); else s = (s + n) % n;
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
        ? { confirm: 'A', back: 'B', start: 'START', select: 'MAP', special: 'SPC', down: '↓', up: '↑' }
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

  /* ---------------- text helpers ---------------- */
  function T(s, x, y, col, o) { return DCW.text(s === null || s === undefined ? '' : String(s), x, y, col || C.white, o); }
  function tw(s, sc) { return DCW.textWidth(String(s), sc || 1); }
  function fitText(s, px) { s = String(s === undefined || s === null ? '' : s); var max = Math.max(1, Math.floor((px + 1) / 6)); return s.length > max ? s.slice(0, Math.max(1, max - 1)) + '.' : s; }
  function wrap(s, px) { return DCW.wrapText(String(s === undefined || s === null ? '' : s), px); }
  function blink(rate) { return Math.floor((DCW.t || 0) * (rate || 3)) % 2 === 0; }
  function cursor(x, y, col) { T('▶', x + (Math.floor((DCW.t || 0) * 4) % 2), y, col || C.white); }
  function R(x, y, w, h, c) { DCW.rect(x, y, w, h, c); }
  function dim(ctx, a) { ctx.globalAlpha = a === undefined ? 0.6 : a; ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; }
  function frame(ctx, title, o) {
    o = o || {};
    if (o.dim !== false) dim(ctx, o.dim === undefined ? 0.65 : o.dim);
    var x = o.x === undefined ? 4 : o.x, y = o.y === undefined ? 4 : o.y, w = o.w || 312, h = o.h || 172;
    DCW.box(x, y, w, h, { fill: o.fill || C.fill, border: o.border });
    if (title) {
      var t = String(title);
      T('★ ' + t + ' ★', x + w / 2, y + 5, o.titleColor || C.gold, { align: 'center' });
      R(x + 6, y + 15, w - 12, 1, '#2c3c7c');
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
    if (!artOK()) return false;
    if (typeof DCW.art.has === 'function') { try { return !!DCW.art.has(name); } catch (e) { return false; } }
    return true;
  }
  function artInfo(name) {
    if (hasArt(name) && typeof DCW.art.info === 'function') { try { var i = DCW.art.info(name); if (i && i.w && !i.missing) return i; } catch (e) { /* fall through */ } }
    return null;
  }
  var COMP_COL = { donut: ['#fcfcfc', '#f878f8'], mongo: ['#58d854', '#00a800'], katia: ['#bcbcbc', '#7c7c7c'], zev: ['#3cbcfc', '#0058f8'], squeaks: ['#9c9c9c', '#f8b8f8'] };
  // simple pixel stand-ins so screens stay readable before/without real art
  function fallbackSprite(g, name, x, y, o) {
    o = o || {};
    x = Math.round(x); y = Math.round(y);
    var flash = !!o.flash, f = o.frame || 0;
    function r(px, py, w, h, c) { g.fillStyle = flash ? '#fcfcfc' : c; g.fillRect(x + px, y + py, w, h); }
    var n = String(name);
    if (n.indexOf('carl') === 0) {
      if (n.indexOf('dead') >= 0) { r(-12, -7, 24, 7, '#000'); r(-11, -6, 6, 5, '#fcd8a8'); r(-5, -6, 8, 5, '#7c3c18'); r(3, -6, 5, 5, '#fcfcfc'); r(8, -6, 3, 5, '#fcd8a8'); return; }
      var ow = n.indexOf('_ow_') >= 0, sh = ow ? 0.7 : 1;
      var hh = Math.round(24 * sh), bob = (f % 2) ? 1 : 0;
      r(-6, -hh + bob, 12, hh - bob, '#000');
      r(-5, -hh + 1 + bob, 10, 6, '#fcd8a8'); r(-5, -hh + 1 + bob, 10, 2, '#7c3c18');
      if (n.indexOf('up') < 0) { r(-3, -hh + 4 + bob, 1, 1, '#000'); r(2, -hh + 4 + bob, 1, 1, '#000'); }
      var by = -hh + 7 + bob, bh = Math.round(7 * sh);
      r(-5, by, 10, bh, '#7c3c18'); r(-2, by, 4, bh, '#fcd8a8');
      var sk = o.skin || 'carl_boxers', bc = sk === 'carl_kilt' ? '#d82800' : sk === 'carl_gold' ? '#f8b800' : sk === 'carl_hazmat' ? '#f8d878' : sk === 'carl_clown' ? '#f878f8' : '#fcfcfc';
      r(-5, by + bh, 10, 4, bc); r(-3, by + bh + 1, 1, 1, '#d82800'); r(2, by + bh + 2, 1, 1, '#d82800');
      r(-4, by + bh + 4, 3, Math.max(1, -(by + bh + 4) - 1), '#fcd8a8'); r(1, by + bh + 4, 3, Math.max(1, -(by + bh + 4) - 1), '#fcd8a8');
      return;
    }
    var comp = n.split('_')[0];
    if (COMP_COL[comp]) {
      var cc = COMP_COL[comp], hop = (f % 2) && n.indexOf('run') >= 0 ? -1 : 0;
      r(-7, -9 + hop, 14, 8, '#000'); r(-6, -8 + hop, 12, 6, cc[0]); r(2, -12 + hop, 6, 7, '#000'); r(3, -11 + hop, 4, 5, cc[0]);
      r(3, -13 + hop, 1, 2, '#000'); r(6, -13 + hop, 1, 2, '#000'); r(5, -9 + hop, 1, 1, '#000'); r(-6, -3 + hop, 12, 1, cc[1]);
      r(-5, -2, 2, 2, '#000'); r(3, -2, 2, 2, '#000');
      return;
    }
    if (n.indexOf('ai_screen') === 0) {
      r(-12, -20, 24, 18, '#000'); r(-11, -19, 22, 16, '#7c7c7c'); r(-9, -17, 18, 12, '#0058f8');
      r(-6, -14, 3, 3, '#fcfcfc'); r(3, -14, 3, 3, '#fcfcfc'); r(-5, -9, 10, 1, '#fcfcfc'); r(-1, -2, 2, 2, '#3c3c3c');
      return;
    }
    if (n.indexOf('mordecai') === 0) { r(-6, -28, 12, 28, '#000'); r(-5, -27, 10, 9, '#a8a8a8'); r(-3, -24, 2, 2, '#f8b800'); r(1, -24, 2, 2, '#f8b800'); r(-5, -18, 10, 17, '#5c7c3c'); return; }
    if (n.indexOf('bopca') === 0) { r(-8, -20, 16, 20, '#000'); r(-7, -19, 14, 18, '#c87838'); r(-4, -15, 2, 2, '#000'); r(2, -15, 2, 2, '#000'); r(-3, -10, 6, 2, '#a81000'); return; }
    if (n.indexOf('box_') === 0) {
      var tier = n.slice(4), bc2 = boxColor(tier);
      r(-8, -13, 16, 13, '#000'); r(-7, -12, 14, 11, bc2); r(-7, -9, 14, 1, '#000'); r(-1, -12, 2, 11, '#fcfcfc'); r(-2, -10, 4, 3, '#f8d878');
      return;
    }
    if (n.indexOf('door') === 0) { r(-9, -30, 18, 30, '#000'); r(-8, -29, 16, 29, n.indexOf('open') >= 0 ? '#1c0c00' : '#7c3c18'); r(4, -16, 2, 2, '#f8b800'); return; }
    if (n.indexOf('ow_') === 0) {
      var mc = { ow_safe: '#3cbcfc', ow_boss: '#f83800', ow_boss_locked: '#7c0800', ow_stairs: '#d800cc', ow_stairs_locked: '#5c2c5c', ow_flag: '#58d854', ow_tent: '#f878f8', ow_cave: '#7c7c7c', ow_manhole: '#5c5c5c' }[n] || '#c87838';
      if (n === 'ow_flag') { r(-1, -16, 1, 12, '#000'); r(0, -16, 6, 4, mc); return; }
      r(-7, -14, 14, 13, '#000'); r(-6, -13, 12, 11, mc); r(-3, -10, 6, 8, '#000');
      return;
    }
    // generic critter
    r(-6, -12, 12, 12, '#000'); r(-5, -11, 10, 10, '#d82800'); r(-3, -8, 2, 2, '#fcfcfc'); r(1, -8, 2, 2, '#fcfcfc');
  }
  function spr(ctx, name, x, y, o) {
    if (hasArt(name)) { try { DCW.art.sprite(ctx, name, Math.round(x), Math.round(y), o || {}); return true; } catch (e) { /* fall back */ } }
    fallbackSprite(ctx, name, x, y, o);
    return false;
  }
  // scaled and/or silhouetted sprite via an offscreen canvas (bottom-center anchor)
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
    var pa = ctx.globalAlpha; if (o.alpha !== undefined) ctx.globalAlpha = pa * o.alpha;
    ctx.drawImage(tmpC, 0, 0, w, h, Math.round(x - (w / 2 | 0) * s), Math.round(y - (h - 3) * s), w * s, h * s);
    ctx.globalAlpha = pa;
  }
  function portrait(ctx, name, x, y, o) {
    x = Math.round(x); y = Math.round(y);
    if (name && DCW.art && typeof DCW.art.portrait === 'function' && hasArt(name)) { try { DCW.art.portrait(ctx, name, x, y, o); return; } catch (e) { /* fall back */ } }
    // fallback: tinted panel with a simple face (drawn into the given ctx)
    withCtx(ctx, function () {
      var key = String(name || 'x').replace('p_', '');
      var hsh = U.hash ? U.hash(key) : 7;
      var cols = ['#0058f8', '#a81000', '#00a800', '#881488', '#ac7c00', '#005878'];
      R(x, y, 32, 32, '#000'); R(x + 1, y + 1, 30, 30, cols[hsh % cols.length]);
      for (var i = 3; i < 32; i += 4) R(x + 1, y + i, 30, 1, 'rgba(0,0,0,0.18)');
      if (key === 'ai') { R(x + 5, y + 6, 22, 18, '#000'); R(x + 6, y + 7, 20, 16, '#7c7c7c'); R(x + 8, y + 9, 16, 12, '#0058f8'); R(x + 11, y + 12, 3, 3, '#fcfcfc'); R(x + 18, y + 12, 3, 3, '#fcfcfc'); R(x + 12, y + 17, 8, 1, '#fcfcfc'); R(x + 14, y + 24, 4, 4, '#3c3c3c'); return; }
      var cc = COMP_COL[key];
      if (cc) { // animal-ish face
        R(x + 7, y + 6, 5, 7, '#000'); R(x + 20, y + 6, 5, 7, '#000'); R(x + 8, y + 7, 3, 5, cc[0]); R(x + 21, y + 7, 3, 5, cc[0]);
        R(x + 6, y + 11, 20, 16, '#000'); R(x + 7, y + 12, 18, 14, cc[0]);
        R(x + 11, y + 16, 3, 3, '#000'); R(x + 18, y + 16, 3, 3, '#000'); R(x + 15, y + 20, 2, 2, cc[1]);
        if (key === 'donut') { R(x + 12, y + 8, 8, 3, '#f8b800'); R(x + 13, y + 6, 2, 2, '#f8b800'); R(x + 17, y + 6, 2, 2, '#f8b800'); }
        return;
      }
      var skin = key === 'mordecai' ? '#a8a8a8' : key === 'bopca' ? '#c87838' : '#fcd8a8';
      R(x + 7, y + 7, 18, 20, '#000'); R(x + 8, y + 8, 16, 18, skin);
      R(x + 8, y + 8, 16, 4, key === 'carl' ? '#7c3c18' : '#3c3c3c');
      R(x + 11, y + 15, 3, 3, '#000'); R(x + 18, y + 15, 3, 3, '#000'); R(x + 13, y + 22, 6, 1, '#7c0800');
      R(x + 4, y + 27, 24, 4, key === 'carl' ? '#7c3c18' : '#3c3c3c');
    });
  }
  // draw with DCW.rect/DCW.text into another context
  function withCtx(ctx, fn) {
    var old = DCW.ctx; DCW.ctx = ctx;
    try { fn(); } finally { DCW.ctx = old; }
  }
  // small 8x8 icons (art.icon if it knows the name, else built-in bitmaps)
  var ICON_PAL = { k: '#000000', r: '#f83800', R: '#a81000', w: '#fcfcfc', y: '#f8b800', Y: '#ac7c00', G: '#3c3c3c', g: '#5c5c5c', o: '#fca044', p: '#d800cc', P: '#881488', n: '#a85010', b: '#3cbcfc', e: '#58d854' };
  var ICONS = {
    heart: ['.kk.kk..', 'krrkrrk.', 'krwrrrk.', 'krrrrrk.', '.krrrk..', '..krk...', '...k....', '........'],
    heart_half: ['.kk.kk..', 'krrkggk.', 'krwrggk.', 'krrrggk.', '.krrgk..', '..krk...', '...k....', '........'],
    heart_empty: ['.kk.kk..', 'kggkggk.', 'kgggggk.', 'kgggggk.', '.kgggk..', '..kgk...', '...k....', '........'],
    coin: ['..kkkk..', '.kyyyyk.', 'kyywyyYk', 'kyywyyYk', 'kyywyyYk', 'kyyyyYYk', '.kYYYYk.', '..kkkk..'],
    bomb: ['.....yo.', '....k...', '..kkkk..', '.kGGGGk.', 'kGwGGGGk', 'kGGGGGGk', '.kGGGGk.', '..kkkk..'],
    potion: ['..kkk...', '..kwk...', '.kkwkk..', 'kppwppk.', 'kpwpppk.', 'kppppPk.', '.kPPPk..', '..kkk...'],
    star: ['...k....', '..kyk...', 'kkkykkk.', 'kyyyyyk.', '.kyyyk..', '.kykyk..', 'kyk.kyk.', 'kk...kk.'],
    skull: ['.kkkkk..', 'kwwwwwk.', 'kwkwkwk.', 'kwwwwwk.', '.kwkwk..', '.kkkkk..', '........', '........'],
    box: ['kkkkkkkk', 'knnynnnk', 'kyyyyyyk', 'knnynnnk', 'knnynnnk', 'knnynnnk', 'kkkkkkkk', '........'],
    key: ['.kkk....', 'kyyyk...', 'ky.yk...', 'kyyykkkk', '.kkkyyyk', '....kyky', '.....k.k', '........'],
    sword: ['......kk', '.....kwk', '....kwk.', '.k.kwk..', '..kwk...', '..nk....', '.n.k....', 'n.......'],
    shield: ['kkkkkkk.', 'kbbwbbk.', 'kbbwbbk.', 'kwwwwwk.', 'kbbwbbk.', '.kbwbk..', '..kbk...', '...k....'],
    boot: ['.kkk....', '.knnk...', '.knnk...', '.knnk...', '.knnnkk.', 'knnnnnnk', 'kkkkkkkk', '........'],
    brain: ['.kkkkk..', 'kppPppk.', 'kpPppPpk', 'kpppPppk', 'kPppppPk', '.kpppkk.', '..kkk...', '........'],
    eye: ['........', '..kkkk..', '.kwwwwk.', 'kwwbbwwk', 'kwwbkwwk', '.kwwwwk.', '..kkkk..', '........'],
    lock: ['..kkk...', '.kgGgk..', '.kg.gk..', 'kkkkkkk.', 'kyyyyyk.', 'kyykyyk.', 'kyyyyyk.', 'kkkkkkk.']
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
    var c = iconCanvas(name);
    if (c) ctx.drawImage(c, x, y);
    else T('●', x + 1, y, C.gray, { shadow: null });
  }
  var BOX_FB = { bronze: '#c87838', silver: '#bcbcbc', gold: '#f8b800', platinum: '#a4e4fc', legendary: '#9878f8', fan: '#f878f8', boss: '#e40058' };
  function boxColor(tier) {
    if (DCW.art && typeof DCW.art.boxColor === 'function') { try { var c = DCW.art.boxColor(tier); if (c) return c; } catch (e) { /* fall back */ } }
    var bt = D('boxTiers'); return (bt && bt[tier] && bt[tier].color) || BOX_FB[tier] || C.gray;
  }
  function tierName(tier) {
    var n = G('tierName', tier); if (n) return n;
    var bt = D('boxTiers'); return (bt && bt[tier] && bt[tier].name) || (String(tier || 'mystery').toUpperCase() + ' BOX');
  }
  // tiny cropped portrait for the HUD (2x downscale of the face area)
  var miniC = {};
  function miniPortrait(ctx, name, x, y) {
    var c = miniC[name];
    if (!c) {
      c = document.createElement('canvas'); c.width = 32; c.height = 32;
      var g = c.getContext('2d'); g.imageSmoothingEnabled = false;
      portrait(g, name, 0, 0);
      miniC[name] = c;
    }
    ctx.drawImage(c, 4, 2, 24, 24, x, y, 12, 12);
  }

  /* ---------------- data helpers ---------------- */
  var STATS = ['str', 'con', 'dex', 'int'];
  var STAT_INFO = {
    str: { name: 'STRENGTH', short: 'STR', icon: 'sword', desc: 'PUNCH, KICK AND BOMB DAMAGE.' },
    con: { name: 'CONSTITUTION', short: 'CON', icon: 'heart', desc: '+2 MAX HP PER POINT. DIE LESS.' },
    dex: { name: 'DEXTERITY', short: 'DEX', icon: 'boot', desc: 'CRIT CHANCE AND MOVE SPEED.' },
    int: { name: 'INTELLIGENCE', short: 'INT', icon: 'brain', desc: 'COMPANION POWER. SMART PETS HIT HARDER.' }
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
  function inSafe() {
    if (hasG('inSafeRoom')) return !!G('inSafeRoom');
    return !!(ui.scenes && DCW.scene === ui.scenes.safeRoom);
  }
  // Mordecai's body for the current floor
  function mordForm() {
    var run = getRun() || {}, n = run.floor || 1;
    var f = (D('mordecaiForms') || {})[n] || {};
    return { n: n, name: f.name || '', line: f.line || '',
      sprite: hasArt('mordecai_f' + n) ? 'mordecai_f' + n : 'mordecai',
      portrait: hasArt('p_mordecai_f' + n) ? 'p_mordecai_f' + n : 'p_mordecai' };
  }
  function compSprite(id) { var d = compDef(id); return (d && d.sprite) || id || 'donut'; }
  function perkText(p) {
    if (!p) return '';
    var out = [];
    function pct(v) { v = +v; return Math.round((v < 1 ? v : v - 1) * 100); }
    if (p.dmg) out.push('+' + p.dmg + ' DAMAGE');
    if (p.def) out.push('+' + p.def + ' DEFENSE');
    if (p.hp) out.push('+' + p.hp + ' MAX HP');
    if (p.speed) out.push('+' + pct(p.speed) + '% SPEED');
    if (p.gold) out.push('+' + pct(p.gold) + '% GOLD');
    if (p.views) out.push('+' + pct(p.views) + '% VIEWS');
    if (p.bombs) out.push('+' + p.bombs + ' BOMBS PER FLOOR');
    if (p.crit) out.push('+' + Math.round(p.crit * 100) + '% CRIT');
    if (p.doubleJump) out.push('DOUBLE JUMP');
    return out.join(', ');
  }
  function rewardInfo(r) {
    if (r === null || r === undefined) return { text: 'NOTHING. WOW.', icon: 'skull', color: C.dgray };
    if (typeof r === 'string') return { text: r, icon: 'star', color: C.white };
    var n;
    switch (r.kind) {
      case 'gold': return { text: (r.converted === 'skin' ? 'SKIN OWNED: +' : '+') + (r.amount || 0) + ' GOLD', icon: 'coin', color: C.gold };
      case 'item':
        n = r.count || 1;
        var nm = r.id === 'bomb' ? 'BOMB' : r.id === 'potion' ? 'POTION' : String(r.id || 'ITEM').toUpperCase();
        return { text: '+' + n + ' ' + nm + (n > 1 ? 'S' : ''), icon: r.id === 'bomb' ? 'bomb' : 'potion', color: C.white };
      case 'skin': return { text: (r.isNew ? 'NEW SKIN: ' : 'SKIN: ') + skinName(r.id), icon: 'star', color: r.isNew ? C.yellow : C.gray, unlock: !!r.isNew };
      case 'companion': return { text: (r.isNew ? 'NEW PAL: ' : 'PAL: ') + compName(r.id), icon: 'star', color: r.isNew ? C.yellow : C.gray, unlock: !!r.isNew };
      case 'stat': var si = STAT_INFO[r.stat] || { short: String(r.stat || '?').toUpperCase(), icon: 'star' }; return { text: '+' + (r.amount || 1) + ' ' + si.short, icon: si.icon, color: C.green };
      case 'xp': return { text: '+' + (r.amount || 0) + ' XP', icon: 'star', color: C.green };
      case 'hp': return { text: '+' + (r.amount || 1) + ' MAX HP', icon: 'heart', color: C.red };
      case 'box': return { text: tierName(r.tier), icon: 'box', color: boxColor(r.tier) };
      case 'views': return { text: '+' + fmtNum(r.amount) + (r.note ? ' ' + r.note : '') + ' VIEWS', icon: 'eye', color: C.pink }; // fits the 21-char results column
      case 'place': return { text: (r.place === 1 ? '1ST' : r.place === 2 ? '2ND' : r.place === 3 ? '3RD' : r.place + 'TH') + ' PLACE' + (r.of ? ' OF ' + r.of : ''), icon: 'star', color: r.place === 1 ? C.gold : C.white };
      case 'revival': n = r.count || 1; return { text: '+' + n + ' SPONSOR REVIVAL' + (n > 1 ? 'S' : ''), icon: 'heart', color: C.pink };
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
  var WHO_PORTRAIT = { 'SYSTEM AI': 'p_ai', 'AI': 'p_ai', 'THE AI': 'p_ai', 'CARL': 'p_carl', 'DONUT': 'p_donut', 'PRINCESS DONUT': 'p_donut',
    'MORDECAI': 'p_mordecai', 'BOPCA': 'p_bopca', 'MONGO': 'p_mongo', 'KATIA': 'p_katia', 'ZEV': 'p_zev', 'SIR SQUEAKS': 'p_squeaks', 'SQUEAKS': 'p_squeaks' };
  function paginate(lines, opts) {
    if (lines === null || lines === undefined) return [];
    if (!Array.isArray(lines)) lines = [lines];
    var pages = [];
    lines.forEach(function (l) {
      if (l === null || l === undefined || l === '') return;
      var o = typeof l === 'object' ? l : { text: String(l) };
      var who = o.who !== undefined ? o.who : (opts.who !== undefined ? opts.who : 'SYSTEM AI');
      var por;
      if (o.portrait !== undefined) por = o.portrait;
      else if (o.who !== undefined) por = WHO_PORTRAIT[String(o.who).toUpperCase()] || null;
      else por = opts.portrait !== undefined ? opts.portrait : 'p_ai';
      var wl = wrap(String(o.text === undefined ? '' : o.text).toUpperCase(), por ? 256 : 296);
      for (var i = 0; i < wl.length; i += 4) pages.push({ who: who, portrait: por, lines: wl.slice(i, i + 4), color: o.color });
    });
    return pages;
  }
  function pageLen(p) { var n = 0; p.lines.forEach(function (l) { n += l.length; }); return n; }
  function drawDialogBox(ctx, page, shown, pos, done) {
    var y = pos === 'top' ? 18 : 126, x = 4, w = 312, h = 50;
    DCW.box(x, y, w, h);
    var tx = x + 8;
    if (page.portrait) {
      R(x + 5, y + 8, 34, 34, C.white); R(x + 6, y + 9, 32, 32, '#000');
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
      DCW.box(x + 6, y - 9, nw, 12, { fill: '#a81000' });
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
      if (P('start') && opts.skippable !== false && m.t > 0.15) { finish(); return; }
      if ((P('confirm') || P('back')) && m.t > 0.08) {
        if (m.shown < total) m.shown = total;
        else { m.i++; m.shown = 0; if (m.i >= m.pages.length) finish(); }
      }
      m.t += dt;
    };
    m.draw = function (ctx) {
      var p = m.pages[Math.min(m.i, m.pages.length - 1)];
      drawDialogBox(ctx, p, m.shown, opts.pos, m.shown >= pageLen(p));
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
    var t = { text: String(text === undefined || text === null ? '' : text).toUpperCase(), title: o.title ? String(o.title).toUpperCase() : (ach ? 'NEW ACHIEVEMENT!' : ''),
      icon: o.icon || (ach ? 'star' : null), color: o.color || (ach ? C.gold : C.white), time: o.time || (ach ? 4 : 2.6),
      sub: o.sub || o.desc ? String(o.sub || o.desc).toUpperCase() : '', ach: ach, t: 0, y: null };
    var iw = t.icon ? 12 : 0, maxIn = 176 - iw;
    t.lines = wrap(t.text, maxIn).slice(0, 4);
    t.subLines = t.sub ? wrap(t.sub, maxIn).slice(0, 3) : [];
    var inner = Math.max(t.title ? tw(t.title) : 0, 0);
    t.lines.concat(t.subLines).forEach(function (l) { inner = Math.max(inner, tw(l)); });
    t.w = Math.max(64, inner + iw + 12);
    t.h = 7 + (t.title ? 10 : 0) + t.lines.length * 10 + t.subLines.length * 10;
    if (o.sfx) sfx(o.sfx);
    if (toasts.length < 4) toasts.push(t); else toastQ.push(t);
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
    while (toasts.length < 4 && toastQ.length) toasts.push(toastQ.shift());
  }
  function drawToasts(ctx) {
    toasts.forEach(function (t) {
      var a = t.t < 0.2 ? t.t / 0.2 : t.t > t.time - 0.25 ? (t.time - t.t) / 0.25 : 1;
      a = clamp(a, 0, 1);
      var e = 1 - Math.pow(1 - a, 3);
      var x = Math.round(W - 4 - t.w + (1 - e) * (t.w + 8)), y = Math.round(t.y);
      DCW.box(x, y, t.w, t.h, { fill: t.ach ? '#3c1c00' : C.fill, border: t.ach ? C.gold : t.color === C.white ? C.white : t.color });
      var tx = x + 5;
      if (t.icon) { icon(ctx, t.icon, x + 5, y + 4); tx += 12; }
      var ty = y + 4;
      if (t.title) { T(t.title, tx, ty, t.ach ? C.gold : t.color); ty += 10; }
      t.lines.forEach(function (l) { T(l, tx, ty, t.title ? C.white : t.color); ty += 10; });
      t.subLines.forEach(function (l) { T(l, tx, ty, C.gray); ty += 10; });
      if (t.ach) { // sparkles on the border
        for (var k = 0; k < 4; k++) {
          var ph = ((DCW.t || 0) * 1.3 + k * 0.25) % 1;
          var per = 2 * (t.w + t.h), d = ph * per, sx, sy;
          if (d < t.w) { sx = x + d; sy = y; } else if (d < t.w + t.h) { sx = x + t.w; sy = y + d - t.w; } else if (d < 2 * t.w + t.h) { sx = x + t.w - (d - t.w - t.h); sy = y + t.h; } else { sx = x; sy = y + t.h - (d - 2 * t.w - t.h); }
          R(sx - 1, sy, 3, 1, C.white); R(sx, sy - 1, 1, 3, C.white);
        }
      }
    });
  }
  var banner = null;
  ui.announce = function (text, o) {
    o = o || {};
    banner = { text: String(text === undefined ? '' : text).toUpperCase(), sub: o.sub ? String(o.sub).toUpperCase() : '', color: o.color || C.gold, time: o.time || 2.2, t: 0, y: o.y || 60 };
    if (o.sfx) sfx(o.sfx);
    return banner;
  };
  function drawBanner(ctx) {
    var b = banner; if (!b) return;
    var inT = clamp(b.t / 0.18, 0, 1), outT = clamp((b.time - b.t) / 0.22, 0, 1);
    var big = tw(b.text, 2) <= 300;
    var subL = b.sub ? wrap(b.sub, 296) : [];
    var hh = (big ? 20 : 12) + subL.length * 10 + 10;
    var bh = Math.round(hh * Math.min(inT, 1) * (outT < 1 ? outT : 1));
    var cy = b.y + hh / 2;
    if (bh <= 0) return;
    ctx.globalAlpha = 0.85; R(0, Math.round(cy - bh / 2), W, bh, '#000'); ctx.globalAlpha = 1;
    R(0, Math.round(cy - bh / 2), W, 1, b.color); R(0, Math.round(cy + bh / 2) - 1, W, 1, b.color);
    if (inT < 1 || outT < 1) return;
    var slide = b.t < 0.35 ? Math.round((1 - (b.t - 0.18) / 0.17) * 40) : 0;
    var ty = Math.round(b.y + 5);
    if (big) { T(b.text, 160 + Math.max(0, slide), ty, b.color, { align: 'center', scale: 2, shadow: '#000' }); ty += 20; }
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
      if (opts.dim !== false) dim(ctx, opts.dim === undefined ? 0.45 : opts.dim);
      var maxTitle = opts.w ? opts.w - 16 : 240;
      var tl = opts.title ? wrap(String(opts.title).toUpperCase(), maxTitle) : [];
      var iw = 0; its.forEach(function (it) { iw = Math.max(iw, tw(labelOf(it)) + (it.right ? tw(it.right) + 12 : 0)); });
      var w = opts.w || Math.max(80, iw + 30, tl.reduce(function (a, l) { return Math.max(a, tw(l) + 16); }, 0));
      var hint = (m.msgT > 0 && m.msg) ? m.msg : (its[m.sel] && its[m.sel].hint) || '';
      var hl = hint ? wrap(String(hint).toUpperCase(), w - 12).slice(0, 2) : [];
      var h = 8 + tl.length * 10 + (tl.length ? 4 : 0) + its.length * 12 + (hl.length ? hl.length * 10 + 4 : 0);
      var x = opts.x !== undefined ? opts.x : Math.round(160 - w / 2), y = opts.y !== undefined ? opts.y : Math.round(90 - h / 2);
      DCW.box(x, y, w, h, { fill: opts.fill, border: opts.border });
      var yy = y + 5;
      tl.forEach(function (l) { T(l, x + w / 2, yy, opts.titleColor || C.gold, { align: 'center' }); yy += 10; });
      if (tl.length) { R(x + 6, yy, w - 12, 1, '#2c3c7c'); yy += 4; }
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
    ], { title: text, sel: opts.def === 'yes' ? 0 : 1, onBack: opts.onNo, kind: 'confirm', titleColor: opts.color || C.white, border: opts.border, dim: 0.55 });
  };

  /* ================================================================
     HUD
     ================================================================ */
  var hudS = { combo: 0, pop: 0, trail: null, bossTrail: null, lastT: 0 };
  ui.drawHUD = function (ctx, h) {
    h = h || {};
    var now = DCW.t || 0, dt = clamp(now - hudS.lastT, 0, 0.1); hudS.lastT = now;
    ctx.globalAlpha = 0.82; R(0, 0, W, 13, '#000'); ctx.globalAlpha = 1;
    R(0, 13, W, 1, '#1c1c3c');
    // companion mini portrait
    var comp = h.companion || equipped('companion');
    R(0, 0, 14, 14, '#000'); R(0, 0, 14, 1, C.dgray); R(0, 13, 14, 1, C.dgray); R(0, 0, 1, 14, C.dgray); R(13, 0, 1, 14, C.dgray);
    miniPortrait(ctx, 'p_' + comp, 1, 1);
    // hp bar (segmented) + numbers
    var hp = Math.max(0, +h.hp || 0), mx = Math.max(1, +h.maxHp || hp || 1);
    if (hudS.trail === null || hudS.trail < hp) hudS.trail = hp;
    else hudS.trail = Math.max(hp, hudS.trail - dt * Math.max(2, mx * 0.6));
    var bx = 17, bw = 56;
    var low = hp <= mx * 0.25;
    DCW.bar(bx, 2, bw, 4, hudS.trail / mx, C.gold, '#3a1020');
    R(bx, 2, Math.round(bw * clamp(hp / mx, 0, 1)), 4, low && blink(5) ? C.white : C.red);
    R(bx, 2, Math.round(bw * clamp(hp / mx, 0, 1)), 1, low && blink(5) ? C.white : '#fc7460');
    if (mx <= 60) { var step = mx <= 30 ? 1 : 2; for (var s = step; s < mx; s += step) R(bx + Math.round(bw * s / mx), 2, 1, 4, 'rgba(0,0,0,0.55)'); }
    if (h.special !== undefined && h.special !== null) {
      var full = h.special >= 1;
      DCW.bar(bx, 9, bw, 2, h.special, full ? (blink(6) ? C.white : C.yellow) : C.purple, '#200828');
    }
    var hpStr = Math.ceil(hp) + '/' + mx;
    T(hpStr, 77, 3, low ? C.red : C.white);
    var x = Math.max(113, 77 + tw(hpStr) + 4); // 3-digit HP pushes the row right instead of overlapping
    icon(ctx, 'bomb', x, 2); T(h.bombs === undefined ? '-' : h.bombs, x + 9, 3, C.white); x += 22;
    icon(ctx, 'potion', x, 2); T(h.potions === undefined ? '-' : h.potions, x + 9, 3, C.white); x += 22;
    icon(ctx, 'coin', x, 2); T(fitText(h.gold || 0, 30), x + 9, 3, C.gold); x += 44;
    T('LV' + (h.level || 1), x, 2, C.green);
    DCW.bar(x, 11, 24, 1, h.xpFrac || 0, C.green, '#002800');
    x += 30;
    icon(ctx, 'eye', x, 2); T(fmtNum(h.views || 0), x + 9, 3, C.pink);
    // timer vs par (or stage name)
    if (h.time !== undefined && h.time !== null) {
      var ts = fmtTime(h.time), over = h.par && h.time > h.par;
      T(ts, 318, 2, h.par ? (over ? C.red : C.white) : C.white, { align: 'right' });
      if (h.par) DCW.bar(318 - tw(ts), 11, tw(ts), 1, clamp(h.time / h.par, 0, 1), over ? C.red : C.green, '#202020');
    } else if (h.stageName) T(fitText(h.stageName, 58), 318, 3, C.gray, { align: 'right' });
    // combo popup
    var combo = h.combo || 0;
    if (combo > hudS.combo && combo > 1) hudS.pop = 0.18;
    hudS.combo = combo; if (hudS.pop > 0) hudS.pop -= dt;
    if (combo > 1) {
      var cc = combo >= 25 ? (blink(8) ? C.pink : C.gold) : combo >= 10 ? C.gold : C.white;
      var py = hudS.pop > 0 ? -2 : 0;
      var r1 = T(combo, 6, 18 + py, cc, { scale: 2 });
      T('HIT', 9 + r1.w, 18 + py, cc); T('COMBO!', 9 + r1.w, 26 + py, combo >= 10 ? C.white : C.gray);
    }
    // boss bar
    if (h.bossHp !== undefined && h.bossHp !== null) {
      var bf = clamp(h.bossHp, 0, 1);
      if (hudS.bossTrail === null || hudS.bossTrail < bf) hudS.bossTrail = bf; else hudS.bossTrail = Math.max(bf, hudS.bossTrail - dt * 0.35);
      ctx.globalAlpha = 0.6; R(0, 160, W, 20, '#000'); ctx.globalAlpha = 1;
      icon(ctx, 'skull', 6, 162);
      T(fitText(h.bossName || 'BOSS', 290), 17, 162, C.gold);
      DCW.bar(8, 173, 304, 4, hudS.bossTrail, C.white, '#3a1020');
      R(8, 173, Math.round(304 * bf), 4, '#d82800'); R(8, 173, Math.round(304 * bf), 1, '#fc7460');
    } else hudS.bossTrail = null;
  };
  ui.hudFromRun = function (extra) {
    var run = getRun() || {}, st = pStats(), lv = run.level || 1;
    var h = { hp: run.hp, maxHp: st.maxHp || run.hp, special: null, bombs: run.bombs, potions: run.potions, gold: run.gold,
      level: lv, xpFrac: (run.xp || 0) / xpNeed(lv), views: run.views, combo: 0, companion: equipped('companion'), bossHp: null, time: null, par: null };
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
      var run = getRun(), fd = floorDef(), n = run && run.boxes ? run.boxes.length : 0;
      return [
        { label: 'RESUME', action: function () { close(m); } },
        { label: 'CHARACTER', action: ui.openCharacter, badge: run && run.statPoints > 0 },
        { label: 'LOOT BOXES (' + n + ')', action: ui.openBoxes, badge: n > 0 },
        { label: 'WARDROBE', action: ui.openWardrobe },
        { label: 'ACHIEVEMENTS', action: ui.openAchievements },
        { label: fd && fd.overworld ? 'MAP' : 'OBJECTIVES', action: ui.openMap },
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
      dim(ctx, 0.55);
      var its = items(), run = getRun() || {}, fd = floorDef() || {};
      var h = 26 + its.length * 12 + 4;
      var y0 = Math.round(90 - h / 2);
      DCW.box(12, y0, 120, h);
      T('PAUSED', 72, y0 + 6, blink(1.5) ? C.gold : C.yellow, { align: 'center' });
      R(18, y0 + 17, 108, 1, '#2c3c7c');
      its.forEach(function (it, i) {
        var yy = y0 + 22 + i * 12;
        if (i === m.sel) cursor(18, yy);
        T(it.label, 28, yy, i === m.sel ? (it.color || C.white) : (it.color || C.gray));
        if (it.badge && blink(2)) T('●', 124, yy, C.red, { shadow: null });
      });
      // right info panel
      var px = 140, py = 18, pw = 168, ph = 144;
      DCW.box(px, py, pw, ph);
      T('● LIVE', px + 8, py + 6, blink(1.2) ? C.red : C.dred);
      T(fmtNum(run.views || 0) + ' VIEWERS', px + pw - 8, py + 6, C.pink, { align: 'right' });
      R(px + 6, py + 16, pw - 12, 1, '#2c3c7c');
      var yy = py + 21;
      T('FLOOR ' + (run.floor || 1), px + 8, yy, C.gold); yy += 10;
      wrap(fd.name || '', pw - 16).slice(0, 2).forEach(function (l) { T(l, px + 8, yy, C.white); yy += 10; });
      yy += 4;
      var st = pStats();
      var rows = [
        ['LEVEL', String(run.level || 1), C.green],
        ['HP', Math.ceil(run.hp || 0) + '/' + (st.maxHp || '?'), C.red],
        ['GOLD', String(run.gold || 0), C.gold],
        ['BOMBS / POTIONS', (run.bombs || 0) + ' / ' + (run.potions || 0), C.white],
        ['REVIVALS', String(run.revivals === undefined ? '-' : run.revivals), C.pink],
        ['FLOOR TIME', fmtTime(run.floorTime || 0) + (fd.par ? ' / ' + fmtTime(fd.par) : ''), fd.par && run.floorTime > fd.par ? C.red : C.white]
      ];
      rows.forEach(function (r) { T(r[0], px + 8, yy, C.gray); T(r[1], px + pw - 8, yy, r[2], { align: 'right' }); yy += 11; });
      R(px + 6, py + ph - 27, pw - 12, 1, '#2c3c7c');
      T('FAN TITLE', px + 8, py + ph - 23, C.dgray);
      T(fitText(titleFor(run.views || 0), pw - 16), px + 8, py + ph - 13, C.pink);
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
      } else if (backPressed() || P('start')) { sfx('menu_back'); close(m); }
    };
    m.draw = function (ctx) {
      var run = getRun() || { level: 1, xp: 0, statPoints: 0, stats: { str: 3, con: 3, dex: 3, int: 3 }, views: 0 };
      var safeNow = inSafe();
      frame(ctx, 'CRAWLER PROFILE', { footer: safeNow ? '↑↓:STAT  ' + bn('confirm') + ':SPEND POINT  ' + bn('back') + ':BACK' : 'SPEND POINTS IN A SAFE ROOM  ' + bn('back') + ':BACK' });
      // left: portrait column
      DCW.box(10, 22, 110, 70, { fill: '#1c0c34' });
      R(12, 80, 106, 10, '#2c1c4c');
      bigSprite(ctx, 'carl_idle', 46, 84, { scale: 2, skin: equipped('skin'), frame: Math.floor((DCW.t || 0) * 2) });
      bigSprite(ctx, compSprite(equipped('companion')) + '_idle', 94, 84, { scale: 2, frame: Math.floor((DCW.t || 0) * 2) });
      var lv = run.level || 1, need = xpNeed(lv);
      T('LEVEL ' + lv, 12, 98, C.green);
      DCW.bar(12, 109, 106, 4, (run.xp || 0) / need, C.green, '#002800');
      T('XP ' + (run.xp || 0) + '/' + need, 12, 116, C.gray);
      T('TITLE', 12, 128, C.dgray);
      wrap(titleFor(run.views || 0), 108).slice(0, 2).forEach(function (l, i) { T(l, 12, 138 + i * 10, C.pink); });
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
      // derived stats
      var st = pStats();
      var d = [
        ['MAX HP', st.maxHp], ['DEFENSE', st.def || 0],
        ['PUNCH', st.dmg], ['KICK', st.kickDmg],
        ['CRIT', Math.round((st.crit || 0) * 100) + '%'], ['SPEED', Math.round((st.speedMul || 1) * 100) + '%'],
        ['BOMB', st.bombDmg], ['PET PWR', Math.round((st.compPower || 1) * 100) + '%']
      ];
      R(px, 83, 180, 1, '#2c3c7c');
      d.forEach(function (r, i) {
        var cx = px + (i % 2) * 92, cy = 88 + Math.floor(i / 2) * 10;
        T(r[0], cx, cy, C.dgray); T(r[1] === undefined ? '-' : r[1], cx + 84, cy, C.white, { align: 'right' });
      });
      R(px, 130, 180, 1, '#2c3c7c');
      var inf2 = STAT_INFO[STATS[m.sel]];
      var msg = m.msgT > 0 ? m.msg : inf2.name + ': ' + inf2.desc;
      wrap(msg, 178).slice(0, 2).forEach(function (l, i) { T(l, px, 135 + i * 10, m.msgT > 0 ? C.red : C.gray); });
    };
    return push(m);
  };

  /* ================================================================
     LOOT BOXES
     ================================================================ */
  ui.openBoxes = function () {
    var m = { kind: 'boxes', sel: 0, scroll: 0, mode: 'list', parts: [], rewards: [], shown: 0, prevMusic: null, quip: '' };
    function boxes() { var r = getRun(); return (r && r.boxes) || []; }
    function startOpen() {
      var list = boxes(); if (!list.length) return;
      var b = list[m.sel] || list[0];
      m.tier = b.tier; m.from = b.from;
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
        var dur = 1.9;
        if (m.shk <= 0) { sfx('lootbox_shake', { pitch: 1 + m.mt * 0.3 }); m.shk = Math.max(0.12, 0.34 - m.mt * 0.12); }
        if (m.mt >= dur || (P('confirm') && m.mt > 0.3)) burst();
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
    function rays(ctx, cx, cy, col, spin, alpha) {
      ctx.save(); ctx.globalAlpha = alpha; ctx.fillStyle = col;
      for (var i = 0; i < 12; i++) {
        var a = spin + i * Math.PI / 6;
        ctx.beginPath(); ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(a - 0.12) * 260, cy + Math.sin(a - 0.12) * 260);
        ctx.lineTo(cx + Math.cos(a + 0.12) * 260, cy + Math.sin(a + 0.12) * 260);
        ctx.closePath(); ctx.fill();
      }
      ctx.restore();
    }
    m.draw = function (ctx) {
      var list = boxes();
      if (m.mode === 'list') {
        var canOpen = inSafe();
        frame(ctx, 'LOOT BOXES', { footer: !list.length ? bn('back') + ':BACK' : canOpen ? bn('confirm') + ':OPEN  ' + bn('back') + ':BACK' : 'OPEN BOXES IN A SAFE ROOM  ' + bn('back') + ':BACK' });
        if (!list.length) {
          bigSprite(ctx, 'box_bronze', 160, 82, { scale: 3, silhouette: '#1c2448' });
          T('NO UNOPENED BOXES.', 160, 92, C.white, { align: 'center' });
          if (!m.empty) m.empty = aiLine('boxEmpty', 'NO BOXES? GO HIT SOMETHING. THE SPONSORS ARE WATCHING.');
          wrap(m.empty, 270).slice(0, 4).forEach(function (l, i) { T(l, 160, 108 + i * 10, C.gray, { align: 'center' }); });
          return;
        }
        T(list.length + ' UNOPENED', 300, 21, C.dgray, { align: 'right', shadow: null });
        var vis = 6;
        for (var i = m.scroll; i < Math.min(list.length, m.scroll + vis); i++) {
          var b = list[i], yy = 32 + (i - m.scroll) * 21;
          if (i === m.sel) { R(10, yy - 2, 300, 20, '#1c2c5c'); cursor(13, yy + 4); }
          spr(ctx, 'box_' + b.tier, 32, yy + 16, { frame: i === m.sel ? Math.floor((DCW.t || 0) * 6) : 0 });
          T(fitText(tierName(b.tier), 250), 46, yy, boxColor(b.tier));
          T(fitText('FROM: ' + (b.from || 'THE SPONSORS'), 250), 46, yy + 9, C.dgray, { shadow: null });
        }
        scrollArrows(300, 30, 152, m.scroll, vis, list.length);
        return;
      }
      // opening animation
      R(0, 0, W, H, '#05030c');
      var col = boxColor(m.tier);
      var spin = (DCW.t || 0) * (m.mode === 'shake' ? 0.6 + m.mt : 0.4);
      rays(ctx, 160, 92, col, spin, m.mode === 'shake' ? Math.min(0.16, 0.06 + m.mt * 0.05) : 0.14);
      T(tierName(m.tier), 160, 8, col, { align: 'center' });
      if (m.from) T(fitText('FROM: ' + m.from, 300), 160, 18, C.dgray, { align: 'center', shadow: null });
      if (m.mode === 'shake') {
        var amp = 1 + m.mt * 2.2;
        var ox = Math.round((Math.random() * 2 - 1) * amp), oy = Math.round((Math.random() * 2 - 1) * amp * 0.5);
        bigSprite(ctx, 'box_' + m.tier, 160 + ox, 118 + oy, { scale: 3, flash: m.mt > 1.5 && blink(12) });
        T('OPENING...', 160, 140, blink(3) ? C.white : C.gray, { align: 'center' });
      }
      m.parts.forEach(function (p) { R(p.x, p.y, 2, 2, p.c); });
      if (m.mode !== 'shake' && m.mt < 0.35 && m.mode === 'reveal' && m.shown <= 1) { ctx.globalAlpha = clamp(1 - m.mt / 0.35, 0, 1); R(0, 0, W, H, C.white); ctx.globalAlpha = 1; }
      // reward rows
      var n = m.rewards.length, rowH = 13, y0 = Math.round(Math.max(30, 86 - n * rowH / 2));
      if (m.mode !== 'shake' && m.shown > 0) {
        var pw = 0; m.rewards.forEach(function (r) { if (r.t >= 0) pw = Math.max(pw, tw(r.text) + 24); });
        ctx.globalAlpha = 0.55; R(160 - pw / 2, y0 - 4, pw, m.shown * rowH + 6, '#000'); ctx.globalAlpha = 1;
      }
      m.rewards.forEach(function (r, i) {
        if (r.t < 0) return;
        var k = clamp(r.t / 0.3, 0, 1), e = 1 - Math.pow(1 - k, 3);
        var wdt = tw(r.text) + 12, tx = Math.round(160 - wdt / 2), ty = y0 + i * rowH;
        var x = Math.round(160 + (tx - 160) * e), y = Math.round(96 + (ty - 96) * e);
        ctx.globalAlpha = 0.6 + 0.4 * e;
        icon(ctx, r.icon, x, y);
        T(r.text, x + 12, y + 1, r.color);
        ctx.globalAlpha = 1;
      });
      if (m.mode === 'card' && m.card) {
        var c = m.card, rr = c.r || {};
        dim(ctx, 0.6);
        DCW.box(60, 26, 200, 128, { border: C.gold, fill: '#1c0c34' });
        T(rr.kind === 'companion' ? 'NEW COMPANION!' : 'NEW SKIN UNLOCKED!', 160, 32, blink(3) ? C.gold : C.yellow, { align: 'center' });
        var ang = (DCW.t || 0) * 0.8;
        ctx.save(); ctx.beginPath(); ctx.rect(62, 44, 196, 62); ctx.clip(); rays(ctx, 160, 92, C.gold, ang, 0.12); ctx.restore();
        if (rr.kind === 'companion') bigSprite(ctx, compSprite(rr.id) + '_idle', 160, 102, { scale: 3, frame: Math.floor((DCW.t || 0) * 3) });
        else bigSprite(ctx, 'carl_idle', 160, 102, { scale: 2, skin: rr.id, frame: Math.floor((DCW.t || 0) * 2) });
        for (var s = 0; s < 6; s++) { var sa = (DCW.t || 0) * 2 + s; R(160 + Math.cos(sa) * 40, 76 + Math.sin(sa * 1.3) * 22, 2, 2, C.white); }
        var def = rr.kind === 'companion' ? compDef(rr.id) : skinDef(rr.id);
        var nm = rr.kind === 'companion' ? compName(rr.id) : skinName(rr.id);
        T(fitText(nm, 190), 160, 110, C.white, { align: 'center' });
        var extra = rr.kind === 'companion' ? (def && def.desc) : (def && (perkText(def.perk) ? 'PERK: ' + perkText(def.perk) : def.desc));
        wrap(extra || '', 186).slice(0, 2).forEach(function (l, i) { T(l, 160, 121 + i * 10, C.gray, { align: 'center' }); });
        if (m.mt > 0.5 && blink(2)) T(bn('confirm') + ': SWEET', 160, 142, C.gold, { align: 'center' });
      }
      if (m.mode === 'done') {
        DCW.box(4, 134, 312, 42);
        R(9, 138, 34, 34, C.white); R(10, 139, 32, 32, '#000'); portrait(ctx, 'p_ai', 10, 139);
        wrap(m.quip, 262).slice(0, 3).forEach(function (l, i) { T(l, 48, 140 + i * 10, C.white); });
        if (blink(2.5)) T('▼', 304, 166, C.gold);
      }
    };
    var drawBoxes = m.draw;
    m.draw = function (ctx) {
      drawBoxes(ctx);
      if (m.mode === 'list' && m.lockT > 0 && boxes().length) {
        DCW.box(50, 70, 220, 34, { fill: '#2c0808', border: C.red });
        T('BOXES ONLY OPEN IN A SAFE ROOM', 160, 77, C.red, { align: 'center' });
        T('THE SPONSORS WANT IT ON CAMERA.', 160, 89, C.gray, { align: 'center', shadow: null });
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
    (o.blocks || []).forEach(function (b, bi) {
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
        R(304, 30, 2, trackH, '#1c2c5c');
        R(304, 30 + Math.round((trackH - thumb) * m.scroll / maxScroll), 2, thumb, C.gray);
      }
    };
    return push(m);
  };

  /* ================================================================
     WARDROBE
     ================================================================ */
  ui.openWardrobe = function () {
    var m = { kind: 'wardrobe', tab: 0, sel: 0, scroll: 0, msg: '', msgT: 0 };
    var DEF_SKINS = ['carl_boxers', 'carl_jacket', 'carl_bodyguard', 'carl_kilt', 'carl_hazmat', 'carl_pajamas', 'carl_clown', 'carl_toga', 'carl_gold'];
    var DEF_COMPS = ['donut', 'mongo', 'katia', 'zev', 'squeaks'];
    function ids() { var d = m.tab === 0 ? D('skins') : D('companions'); var l = d ? Object.keys(d) : (m.tab === 0 ? DEF_SKINS : DEF_COMPS); return l.length ? l : (m.tab === 0 ? DEF_SKINS : DEF_COMPS); }
    function kind() { return m.tab === 0 ? 'skin' : 'companion'; }
    function detailBlocks(k, id) {
      var dd = (k === 'skin' ? skinDef(id) : compDef(id)) || {}, own = owned(k, id), out = [];
      if (!own) {
        out.push({ head: 'HOW TO UNLOCK', text: dd.how || 'FIND IT IN A LOOT BOX.', color: C.yellow });
        return out;
      }
      if (dd.desc) out.push({ text: dd.desc, color: C.gray });
      if (k === 'skin') out.push({ head: 'PERK', text: dd.perk ? perkText(dd.perk) : 'NONE. PURE STYLE.', color: C.green, headColor: C.green });
      else {
        if (dd.ability) out.push({ head: 'ABILITY', text: String(dd.ability).toUpperCase() + (dd.cooldown ? ' (EVERY ' + dd.cooldown + 'S)' : ''), color: C.green, headColor: C.green });
        if (dd.special) out.push({ head: 'SPECIAL: ' + (dd.special.name || ''), text: dd.special.desc || '', color: C.blue, headColor: C.blue });
      }
      return out;
    }
    function openInfo() {
      var l = ids(), id = l[m.sel], k = kind(), own = owned(k, id);
      sfx('menu_select');
      ui.readMore({ title: own ? (k === 'skin' ? skinName(id) : compName(id)) : 'LOCKED', titleColor: own ? C.gold : C.dgray, blocks: detailBlocks(k, id) });
    }
    function selectEquipped() { var l = ids(), e = equipped(kind()); m.sel = Math.max(0, l.indexOf(e)); m.scroll = 0; scrollTo(m, 11, l.length); }
    selectEquipped();
    m.update = function (dt) {
      m.t += dt; if (m.msgT > 0) m.msgT -= dt;
      var l = ids();
      if (P('left') || P('right')) { m.tab = 1 - m.tab; m.msgT = 0; sfx('menu_move'); selectEquipped(); return; }
      listNav(m, l.length, dt); scrollTo(m, 11, l.length);
      if (P('special') || P('select')) { openInfo(); return; }
      if (P('confirm')) {
        var id = l[m.sel];
        if (!owned(kind(), id)) { openInfo(); return; }
        if (equipped(kind()) === id) { sfx('menu_move'); return; }
        var ok;
        if (hasG('equip')) ok = G('equip', kind(), id);
        else { var s = save(); s.equipped[kind()] = id; persist(); ok = true; }
        if (ok !== false) { sfx('menu_select'); m.msg = 'EQUIPPED!'; m.msgT = 1.0; }
      } else if (backPressed() || P('start')) { sfx('menu_back'); close(m); }
    };
    m.draw = function (ctx) {
      var l = ids(), k = kind();
      frame(ctx, 'WARDROBE', { footer: '◀▶:TAB  ' + bn('confirm') + ':EQUIP  ' + bn('special') + ':INFO  ' + bn('back') + ':BACK' });
      // tabs
      var tabs = ['SKINS', 'PALS'];
      tabs.forEach(function (t, i) {
        var tx = 14 + i * 62, act = i === m.tab;
        DCW.box(tx, 20, 58, 12, { fill: act ? '#a81000' : '#0f1630', border: act ? C.white : C.dgray });
        T(t, tx + 29, 22, act ? C.white : C.dgray, { align: 'center' });
      });
      var vis = 11;
      for (var i = m.scroll; i < Math.min(l.length, m.scroll + vis); i++) {
        var id = l[i], yy = 38 + (i - m.scroll) * 11, own = owned(k, id), eq = equipped(k) === id;
        if (i === m.sel) cursor(12, yy);
        var nm = own ? (k === 'skin' ? skinName(id) : compName(id)) : '? ? ? ? ?';
        T(fitText(nm, 96), 22, yy, own ? (i === m.sel ? C.white : C.gray) : C.ddgray);
        if (eq) T('✓', 124, yy, C.green);
      }
      scrollArrows(124, 34, 150, m.scroll, vis, l.length);
      // preview
      var id2 = l[m.sel], own2 = owned(k, id2);
      var pv = { x: 140, y: 20, w: 170, h: 72 };
      DCW.box(pv.x, pv.y, pv.w, pv.h, { fill: '#2c2450' });
      R(pv.x + 2, pv.y + 56, pv.w - 4, 14, '#1c1438');
      for (var s = 0; s < 6; s++) R(pv.x + 8 + s * 28, pv.y + 6 + (s % 2) * 4, 1, 1, C.gray);
      var fr = Math.floor((DCW.t || 0) * 2);
      var skin = k === 'skin' ? id2 : equipped('skin');
      var comp = k === 'companion' ? id2 : equipped('companion');
      var sil = !own2 ? '#000' : null;
      bigSprite(ctx, 'carl_idle', pv.x + 60, pv.y + 62, { scale: 2, skin: skin, frame: fr, silhouette: k === 'skin' ? sil : null });
      bigSprite(ctx, compSprite(comp) + '_idle', pv.x + 124, pv.y + 62, { scale: 2, frame: fr, silhouette: k === 'companion' ? sil : null });
      var dd = (k === 'skin' ? skinDef(id2) : compDef(id2)) || {};
      var yy2 = pv.y + pv.h + 5;
      T(fitText(own2 ? (k === 'skin' ? skinName(id2) : compName(id2)) : 'LOCKED', 168), pv.x, yy2, own2 ? C.gold : C.dgray);
      if (equipped(k) === id2) T('EQUIPPED', pv.x + pv.w, yy2, C.green, { align: 'right' });
      yy2 += 11;
      var lines = [];
      detailBlocks(k, id2).forEach(function (b) {
        if (b.head) lines.push([String(b.head).toUpperCase() + (b.text ? '' : ''), b.headColor || C.gold]);
        if (b.text) wrap(String(b.text).toUpperCase(), 168).forEach(function (t) { lines.push([t, b.color || C.gray]); });
      });
      var FIT = 5;
      if (lines.length > FIT) {
        lines = lines.slice(0, FIT - 1);
        lines.push([(blink(2) ? '▼ ' : '  ') + bn('special') + ': READ MORE', C.white]);
      }
      lines.forEach(function (ln, i) { T(ln[0], pv.x, yy2 + i * 10, ln[1]); });
      if (m.msgT > 0) { DCW.box(80, 74, 160, 18, { border: m.msg === 'EQUIPPED!' ? C.green : C.red }); T(fitText(m.msg, 150), 160, 79, m.msg === 'EQUIPPED!' ? C.green : C.red, { align: 'center' }); }
    };
    return push(m);
  };

  /* ================================================================
     ACHIEVEMENTS
     ================================================================ */
  ui.openAchievements = function () {
    var m = { kind: 'achievements', sel: 0, scroll: 0 };
    function list() { var d = D('achievements') || {}; return Object.keys(d).map(function (id) { var a = d[id] || {}; return { id: id, a: a }; }); }
    function got(id) { var s = save(); return !!(s.meta && s.meta.achievements && s.meta.achievements[id]); }
    m.update = function (dt) {
      m.t += dt;
      var l = list();
      listNav(m, l.length, dt); scrollTo(m, 12, l.length);
      if ((P('confirm') || P('special')) && l[m.sel]) {
        var e = l[m.sel], a = e.a, g = got(e.id);
        var cnt = (save().meta && save().meta.counters && save().meta.counters[a.event]) || 0;
        sfx('menu_select');
        ui.readMore({ title: g ? (a.name || e.id) : 'LOCKED ACHIEVEMENT', titleColor: g ? C.gold : C.dgray, border: g ? C.gold : C.dgray, blocks: [
          { text: g ? (a.desc || '') : '??? KEEP CRAWLING. THE AI WILL TELL YOU WHEN YOU DO SOMETHING DUMB ENOUGH.', color: g ? C.white : C.dgray },
          (!g && (a.count || 1) > 1) ? { head: 'PROGRESS', text: Math.min(cnt, a.count) + ' / ' + a.count, color: C.gray } : null,
          { head: 'REWARD', text: String(a.box || 'bronze').toUpperCase() + ' BOX', color: boxColor(a.box || 'bronze') }
        ].filter(Boolean) });
      } else if (backPressed() || P('start')) { sfx('menu_back'); close(m); }
    };
    m.draw = function (ctx) {
      var l = list(), n = l.filter(function (e) { return got(e.id); }).length;
      frame(ctx, 'ACHIEVEMENTS', { footer: '↑↓:BROWSE  ' + bn('confirm') + ':READ  ' + bn('back') + ':BACK' });
      T('UNLOCKED ' + n + '/' + l.length, 12, 21, C.white);
      DCW.bar(110, 23, 44, 3, l.length ? n / l.length : 0, C.gold, '#2c2000');
      if (!l.length) { T('NO ACHIEVEMENTS LOADED.', 160, 90, C.gray, { align: 'center' }); return; }
      var vis = 12;
      for (var i = m.scroll; i < Math.min(l.length, m.scroll + vis); i++) {
        var e = l[i], yy = 33 + (i - m.scroll) * 10, g = got(e.id);
        if (i === m.sel) { R(10, yy - 1, 148, 10, '#1c2c5c'); }
        icon(ctx, g ? 'star' : 'lock', 13, yy);
        T(fitText(g ? (e.a.name || e.id) : '???', 128), 24, yy + 1, g ? (i === m.sel ? C.gold : C.yellow) : C.dgray);
      }
      scrollArrows(150, 29, 153, m.scroll, vis, l.length);
      // detail
      var e2 = l[m.sel]; if (!e2) return;
      var g2 = got(e2.id), a = e2.a;
      var px = 164, pw = 144;
      DCW.box(px, 20, pw, 138, { fill: g2 ? '#2c1c00' : '#101018', border: g2 ? C.gold : C.dgray });
      bigSprite(ctx, g2 ? 'box_' + (a.box || 'bronze') : 'box_bronze', px + 20, 46, { scale: 1, silhouette: g2 ? null : '#000' });
      var yy2 = 26;
      wrap(g2 ? (a.name || e2.id) : '???', pw - 44).slice(0, 2).forEach(function (t) { T(t, px + 36, yy2, g2 ? C.gold : C.dgray); yy2 += 10; });
      yy2 = Math.max(yy2, 50) + 4;
      var dl = wrap(g2 ? (a.desc || '') : '??? KEEP CRAWLING. THE AI WILL TELL YOU WHEN YOU DO SOMETHING DUMB ENOUGH.', pw - 12);
      if (dl.length > 6) { dl = dl.slice(0, 5); dl.push((blink(2) ? '▼ ' : '  ') + bn('confirm') + ': READ ALL'); }
      dl.forEach(function (t, i) { T(t, px + 6, yy2, i === 5 && t.indexOf('READ ALL') >= 0 ? C.gold : g2 ? C.white : C.dgray); yy2 += 10; });
      var cnt = (save().meta && save().meta.counters && save().meta.counters[a.event]) || 0;
      if (!g2 && (a.count || 1) > 1) {
        T('PROGRESS ' + Math.min(cnt, a.count) + '/' + a.count, px + 6, 128, C.gray);
        DCW.bar(px + 6, 139, pw - 12, 2, cnt / a.count, C.green, '#002800');
      }
      T('REWARD: ' + String(a.box || 'bronze').toUpperCase() + ' BOX', px + 6, 146, g2 ? boxColor(a.box || 'bronze') : C.ddgray, { shadow: null });
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
        { label: 'RESET SAVE', type: 'reset' },
        { label: 'BACK', type: 'back' }
      ];
    }
    function change(r, d) {
      var s = settings();
      if (r.type === 'vol') { var v = Math.round(clamp((s[r.key] === undefined ? 0.6 : s[r.key]) + d * 0.1, 0, 1) * 10) / 10; s[r.key] = v; applySettings(); sfx(r.key === 'sfx' ? 'coin' : 'menu_move'); }
      else if (r.type === 'bool') { s[r.key] = !(s[r.key] !== false); applySettings(); sfx('menu_move'); if (r.key === 'shake' && s.shake && DCW.shake) DCW.shake(2, 0.2); }
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
          ui.confirm('ERASE ALL PROGRESS, UNLOCKS AND ACHIEVEMENTS?', function () {
            ui.confirm('REALLY? THE AI WILL REMEMBER THIS. FOREVER.', function () {
              if (typeof DCW.resetSave === 'function') DCW.resetSave();
              applySettings();
              closeAll();
              DCW.fade(function () { DCW.setScene(ui.scenes.title, {}); });
              setTimeout(function () { ui.toast('SAVE ERASED. FRESH MEAT!', { icon: 'skull', color: C.red }); }, 400);
            }, { yes: 'ERASE IT', no: 'NO WAIT', color: C.red, border: C.red });
          }, { color: C.red });
        } else if (r.type !== 'vol') change(r, 1);
      } else if (backPressed() || P('start')) { sfx('menu_back'); close(m); }
    };
    m.draw = function (ctx) {
      var rs = rows(), s = settings();
      frame(ctx, 'SETTINGS', { footer: '◀▶:CHANGE  ' + bn('confirm') + ':TOGGLE  ' + bn('back') + ':BACK' });
      rs.forEach(function (r, i) {
        var yy = 26 + i * 15 + (i >= 7 ? 5 : 0), act = i === m.sel;
        if (act) { R(14, yy - 3, 292, 13, '#1c2c5c'); cursor(18, yy); }
        T(r.label, 30, yy, r.type === 'reset' ? (act ? C.red : C.dred) : act ? C.white : C.gray);
        if (r.type === 'vol') {
          var v = s[r.key] === undefined ? 0.6 : s[r.key];
          T('◀', 150, yy, act ? C.white : C.ddgray);
          for (var b = 0; b < 10; b++) { var on = b < Math.round(v * 10); R(160 + b * 9, yy, 7, 7, on ? (act ? C.green : C.dgreen) : '#202838'); }
          T('▶', 252, yy, act ? C.white : C.ddgray);
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
     BOSS VERSUS CARD - fighters slide in, VS slams down
     ================================================================ */
  // o = { bossId, name, title, portrait, onDone }
  ui.versus = function (o) {
    o = o || {};
    var compId = equipped('companion');
    var m = { kind: 'versus', slam: false, done: false, out: 0 };
    var DUR = 3.2;
    var bossName = String(o.name || 'THE BOSS').toUpperCase();
    var bossTitle = String(o.title || '').toUpperCase();
    var bossPortrait = o.portrait || ('p_' + (o.bossId || ''));
    var streaks = [];
    for (var i = 0; i < 26; i++) streaks.push({ y: Math.random() * H, x: Math.random() * W, w: 20 + Math.random() * 60, sp: 260 + Math.random() * 320, left: i % 2 === 0 });
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
      // backdrop: two halves wipe in on a diagonal
      var wipe = ease(t / 0.3) * (1 - outT);
      ctx.save();
      ctx.globalAlpha = 0.92 * (1 - outT * 0.6);
      ctx.fillStyle = '#081440';
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(W * 0.56 * wipe, 0); ctx.lineTo(W * 0.44 * wipe, H); ctx.lineTo(0, H); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#3c0808';
      ctx.beginPath(); ctx.moveTo(W, 0); ctx.lineTo(W - W * 0.44 * wipe, 0); ctx.lineTo(W - W * 0.56 * wipe, H); ctx.lineTo(W, H); ctx.closePath(); ctx.fill();
      ctx.globalAlpha = 0.35 * wipe;
      streaks.forEach(function (st) { R(st.x, st.y, st.w, 1, st.left ? '#3cbcfc' : '#f83800'); });
      ctx.restore();
      // the diagonal seam
      if (wipe > 0.9) { ctx.save(); ctx.globalAlpha = 1 - outT; ctx.strokeStyle = '#fcfcfc'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(W * 0.56, 0); ctx.lineTo(W * 0.44, H); ctx.stroke(); ctx.restore(); }
      // fighter panels
      var inL = ease((t - 0.12) / 0.4), inR = ease((t - 0.22) / 0.4);
      var lx = Math.round(-120 + (26 + 120) * inL - outT * 160);
      var rx = Math.round(W + 20 - (W + 20 - 194) * inR + outT * 160);
      var py = 22;
      function panel(x, pname, border, fill) {
        DCW.box(x, py, 100, 100, { fill: fill, border: border });
        ctx.save(); ctx.translate(x + 2, py + 2); ctx.scale(3, 3);
        portrait(ctx, pname, 0, 0);
        ctx.restore();
      }
      panel(lx, 'p_carl', C.blue, '#081440');
      panel(rx, bossPortrait, C.red, '#3c0808');
      // companion badge on Carl's panel
      if (inL > 0.95 && outT === 0) {
        DCW.box(lx + 70, py + 72, 34, 34, { fill: '#081440', border: C.gold });
        portrait(ctx, 'p_' + compId, lx + 71, py + 73);
      }
      // names
      var nameA = Math.max(0, Math.min(1, (t - 0.7) / 0.2)) * (1 - outT);
      if (nameA > 0) {
        ctx.save(); ctx.globalAlpha = nameA;
        T('CARL', lx + 50, py + 108, C.gold, { align: 'center', scale: 2 });
        T('& ' + compName(compId), lx + 50, py + 128, C.blue, { align: 'center', shadow: null });
        if (DCW.textWidth(bossName, 2) <= 148) T(bossName, rx + 50, py + 108, C.red, { align: 'center', scale: 2 });
        else if (/^THE /.test(bossName) && DCW.textWidth(bossName.slice(4), 2) <= 148) {
          T('THE', rx + 50, py + 102, C.red, { align: 'center', shadow: null });
          T(bossName.slice(4), rx + 50, py + 110, C.red, { align: 'center', scale: 2 });
        } else T(bossName, rx + 50, py + 112, C.red, { align: 'center' });
        wrap(bossTitle, 150).slice(0, 2).forEach(function (l, i) { T(l, rx + 50, py + 128 + i * 9, C.gray, { align: 'center', shadow: null }); });
        ctx.restore();
      }
      // VS slam
      if (t >= 0.55 && outT < 1) {
        var k = clamp((t - 0.55) / 0.12, 0, 1);
        var sc = Math.max(3, Math.round(7 - 4 * k));
        var vy = 58 - (sc - 3) * 4;
        ctx.save(); ctx.globalAlpha = 1 - outT;
        if (t < 0.75) { ctx.globalAlpha = 0.5 * (1 - outT); R(0, 0, W, H, '#fcfcfc'); ctx.globalAlpha = 1 - outT; }
        T('VS', 160 + 1, vy + 1, C.red, { align: 'center', scale: sc, shadow: null });
        T('VS', 160, vy, blink(6) ? C.gold : C.yellow, { align: 'center', scale: sc, shadow: '#000' });
        ctx.restore();
      }
      if (t > 1.2 && outT === 0) T('BOSS BATTLE', 160, 6, blink(2.5) ? C.red : C.dred, { align: 'center' });
    };
    return push(m);
  };

  /* ================================================================
     KEYBOARD CONTROLS (rebinding)
     ================================================================ */
  var CTRL_LABELS = { left: 'MOVE LEFT', right: 'MOVE RIGHT', up: 'UP / CLIMB', down: 'DOWN / CROUCH', jump: 'JUMP / OK',
    attack: 'ATTACK / BACK', bomb: 'BOMB', special: 'SPECIAL', potion: 'POTION', start: 'PAUSE', select: 'MAP' };
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
        say2(CTRL_LABELS[a] + ' = ' + inp.keyName(code) + (moved && moved !== a ? '  (REMOVED FROM ' + CTRL_LABELS[moved] + ')' : ''), moved && moved !== a ? C.orange || C.gold : C.green);
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
        if (act) { R(10, yy - 2, 300, 10, '#1c2c5c'); cursor(10, yy); }
        T(CTRL_LABELS[a] || a.toUpperCase(), 22, yy, act ? C.white : C.gray, { shadow: null });
        for (var sl = 0; sl < 2; sl++) {
          var cx2 = sl ? 264 : 192, on = act && m.col === sl;
          if (on) R(cx2 - 31, yy - 2, 62, 10, m.cap ? C.gold : '#3050a0');
          var code = b[a][sl];
          var label = (m.cap && on) ? (blink(5) ? '...' : '') : inp.keyName(code);
          var col = (m.cap && on) ? '#000' : !code ? (sl === 0 && (a === 'jump' || a === 'attack' || a === 'left' || a === 'right') ? C.red : C.ddgray) : on ? C.white : C.lgray || C.white;
          T(label, cx2, yy, col, { align: 'center', shadow: null });
        }
      });
      var py = 32 + acts.length * 10 + 4, pAct = m.sel === acts.length;
      if (pAct) { R(10, py - 2, 300, 10, '#1c2c5c'); cursor(10, py); }
      T('PRESET', 22, py, pAct ? C.white : C.gray, { shadow: null });
      T('◀ ' + PRESET_ORDER[m.preset][1] + ' ▶', 228, py, pAct ? C.gold : C.dgray, { align: 'center', shadow: null });
      var by = py + 11, bAct = m.sel === acts.length + 1;
      if (bAct) { R(10, by - 2, 300, 10, '#1c2c5c'); cursor(10, by); }
      T('BACK', 22, by, bAct ? C.white : C.gray, { shadow: null });
      if (m.msgT > 0 && !m.cap) T(fitText(m.msg, 296), 160, 166, m.msgCol, { align: 'center', shadow: null });
      if (m.cap) {
        DCW.box(60, 64, 200, 46, { fill: '#101828', border: C.gold });
        T('PRESS A KEY FOR', 160, 71, C.gray, { align: 'center', shadow: null });
        T(CTRL_LABELS[m.cap.action] + '  (KEY ' + (m.cap.slot + 1) + ')', 160, 83, C.gold, { align: 'center' });
        T('ESC: CANCEL   DEL: CLEAR', 160, 97, C.dgray, { align: 'center', shadow: null });
      }
    };
    return push(m);
  };

  /* ================================================================
     SHOP
     ================================================================ */
  ui.openShop = function () {
    var m = { kind: 'shop', sel: 0, scroll: 0, flash: 0 };
    var sk = D('shopkeeper') || {};
    var keeper = sk.name || 'BOPCA';
    m.line = pick(sk.lines) || 'WELCOME, CRAWLER! EVERYTHING IS FOR SALE. EXCEPT ME. PROBABLY.';
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
        if (res.ok) { m.line = (res.msg ? res.msg + '! ' : '') + (pick(sk.lines) || 'PLEASURE DOING BUSINESS.'); m.lineCol = C.green; }
        else { m.line = res.msg || 'NO.'; m.lineCol = C.red; }
        m.line = String(m.line).toUpperCase();
      } else if (backPressed() || P('start')) { sfx('menu_back'); close(m); }
    };
    m.draw = function (ctx) {
      var l = items(), run = getRun() || {};
      frame(ctx, keeper + "'S SHOP", { footer: bn('confirm') + ':BUY  ' + bn('special') + ':INFO  ' + bn('back') + ':LEAVE' });
      R(11, 21, 34, 34, C.white); R(12, 22, 32, 32, '#000');
      portrait(ctx, 'p_bopca', 12, 22, { frame: Math.floor((DCW.t || 0) * 3) });
      DCW.box(50, 20, 260, 36, { fill: '#2c1c00', border: C.orange });
      R(47, 34, 4, 4, C.orange);
      wrap(m.line, 248).slice(0, 3).forEach(function (t, i) { T(t, 56, 24 + i * 10, m.lineCol); });
      // gold
      icon(ctx, 'coin', 12, 60); T(run.gold || 0, 22, 61, C.gold);
      T('BOMBS ' + (run.bombs || 0) + '  POTIONS ' + (run.potions || 0), 300, 61, C.dgray, { align: 'right' });
      R(10, 71, 300, 1, '#2c3c7c');
      if (!l.length) { T('SOLD OUT. EVERYTHING. SOMEHOW.', 160, 100, C.gray, { align: 'center' }); return; }
      var vis = 6;
      for (var i = m.scroll; i < Math.min(l.length, m.scroll + vis); i++) {
        var it = l[i], yy = 76 + (i - m.scroll) * 11, p = price(it), afford = (run.gold || 0) >= p;
        if (i === m.sel) { R(10, yy - 2, 300, 11, m.flash > 0 ? '#3c2c00' : '#1c2c5c'); cursor(13, yy); }
        T(fitText(it.name || it.id, 200), 24, yy, i === m.sel ? C.white : C.gray);
        T(p, 298, yy, afford ? C.gold : C.red, { align: 'right' });
        icon(ctx, 'coin', 298 - tw(p) - 10, yy - 1);
      }
      scrollArrows(302, 72, 136, m.scroll, vis, l.length);
      R(10, 143, 300, 1, '#2c3c7c');
      var d = l[m.sel] && l[m.sel].desc;
      var sl = wrap(d || '', 296);
      if (sl.length > 2) { sl = sl.slice(0, 1); sl.push((blink(2) ? '▼ ' : '  ') + bn('special') + ': READ MORE'); }
      sl.forEach(function (t, i) { T(t, 12, 146 + i * 9, i === 1 && t.indexOf('READ MORE') >= 0 ? C.white : C.gray, { shadow: null }); });
    };
    return push(m);
  };

  /* ================================================================
     MAP / OBJECTIVES
     ================================================================ */
  var MM_COL = { '#': '#5c5c6c', '.': '#4c3c2c', ',': '#2c5c24', '=': '#8c7c5c', '~': '#1c3c9c', 'T': '#1c3c14', 'P': '#4c3c2c' };
  function entranceInfo(ch, ow) {
    var st = G('entranceState', ch);
    if (st && typeof st === 'object') return st;
    var tgt = ow && ow.entrances && ow.entrances[ch];
    if (!tgt) return null;
    if (tgt === 'SAFE') return { kind: 'safe', name: 'SAFE ROOM' };
    if (tgt === 'STAIRS') { var r0 = getRun(); return { kind: 'stairs', name: 'STAIRWELL', locked: !(r0 && r0.bossDown), lockText: 'DEFEAT THE FLOOR BOSS FIRST' }; }
    var sd = stageDef(tgt) || {}, r = getRun();
    return { kind: sd.kind === 'boss' ? 'boss' : 'stage', side: sd.kind === 'side', stageId: tgt, name: sd.name || tgt, cleared: !!(r && r.cleared && r.cleared[tgt]), locked: false };
  }
  ui.entranceInfo = entranceInfo;
  function entranceColor(st) {
    if (!st) return C.white;
    if (st.kind === 'safe') return C.blue;
    if (st.kind === 'boss') return st.cleared ? C.green : st.locked ? C.dred : C.red;
    if (st.kind === 'stairs') return st.locked ? '#5c2c5c' : C.purple;
    return st.cleared ? C.green : st.side ? C.orange : C.yellow;
  }
  ui.entranceColor = entranceColor;
  function drawMinimap(ctx, ow, x, y, maxW, maxH) {
    var rows = ow.map || [];
    var mh = rows.length, mw = rows.reduce(function (a, r) { return Math.max(a, r.length); }, 0);
    if (!mw || !mh) return;
    var s = Math.max(1, Math.min(6, Math.floor(Math.min(maxW / mw, maxH / mh))));
    var ox = Math.round(x + (maxW - mw * s) / 2), oy = Math.round(y + (maxH - mh * s) / 2);
    R(ox - 2, oy - 2, mw * s + 4, mh * s + 4, '#000');
    var ents = ow.entrances || {}, marks = [];
    for (var ty = 0; ty < mh; ty++) for (var tx = 0; tx < mw; tx++) {
      var ch = rows[ty].charAt(tx) || '#';
      if (ents[ch]) { R(ox + tx * s, oy + ty * s, s, s, MM_COL['.']); marks.push([tx, ty, ch]); }
      else R(ox + tx * s, oy + ty * s, s, s, MM_COL[ch] || MM_COL['.']);
    }
    marks.forEach(function (mk) {
      var st = entranceInfo(mk[2], ow), c = entranceColor(st), sz = Math.max(3, s + 2);
      R(ox + mk[0] * s + s / 2 - sz / 2 - 1, oy + mk[1] * s + s / 2 - sz / 2 - 1, sz + 2, sz + 2, '#000');
      R(ox + mk[0] * s + s / 2 - sz / 2, oy + mk[1] * s + s / 2 - sz / 2, sz, sz, c);
    });
    var ow2 = DCW.overworld;
    var roam = ow2 && typeof ow2.roamerTiles === 'function' ? ow2.roamerTiles() : [];
    (roam || []).forEach(function (rp) { R(ox + rp.x * s + s / 2 - 1, oy + rp.y * s + s / 2 - 1, 2, 2, '#e40058'); });
    var pt = ow2 && typeof ow2.playerTile === 'function' ? ow2.playerTile() : null;
    var run = getRun();
    if (!pt && run && run.owPos) pt = run.owPos;
    if (!pt) { for (var yy = 0; yy < mh && !pt; yy++) { var xx = rows[yy].indexOf('P'); if (xx >= 0) pt = { x: xx, y: yy }; } }
    if (pt) { var ps = Math.max(3, s); R(ox + pt.x * s + s / 2 - ps / 2 - 1, oy + pt.y * s + s / 2 - ps / 2 - 1, ps + 2, ps + 2, blink(3) ? '#000' : C.white); R(ox + pt.x * s + s / 2 - ps / 2, oy + pt.y * s + s / 2 - ps / 2, ps, ps, blink(3) ? C.white : '#000'); }
  }
  ui.drawMinimap = drawMinimap;
  ui.openMap = function () {
    var m = { kind: 'map' };
    m.update = function (dt) { m.t += dt; if (backPressed() || P('start') || P('select') || P('confirm')) { sfx('menu_back'); close(m); } };
    m.draw = function (ctx) {
      var fd = floorDef() || {}, run = getRun() || {};
      var ow = fd.overworld;
      frame(ctx, ow ? 'MAP' : 'OBJECTIVES', { footer: bn('back') + ':BACK' });
      var obj = G('objectives');
      if (!Array.isArray(obj) || !obj.length) obj = ['FLOOR ' + (run.floor || 1) + ': ' + (fd.name || '???'), 'FIND THE STAIRWELL. TRY NOT TO DIE.'];
      function objLines(l, i, width, x, y, maxY, lh) {
        var col = i === 0 ? C.gold : /^✓/.test(l) ? C.green : /^▶/.test(l) ? C.white : C.gray;
        var ind = /^(✓|▶|-) /.test(l) ? 12 : 0;
        var first = wrap(l, width), lines = [first[0]];
        if (first.length > 1) lines = lines.concat(wrap(String(l).slice(first[0].length).trim(), width - ind));
        lines.forEach(function (t, k) { if (y <= maxY) { T(t, x + (k > 0 ? ind : 0), y, col); y += lh; } });
        return y;
      }
      if (ow) {
        DCW.box(8, 20, 164, 140, { fill: '#000' });
        drawMinimap(ctx, ow, 12, 24, 156, 132);
        var x = 180, y = 21;
        obj.forEach(function (l, i) { if (y <= 124) y = objLines(l, i, 126, x, y, 124, 9); });
        var leg = [[C.white, 'YOU'], [C.yellow, 'AREA'], [C.green, 'CLEARED'], [C.blue, 'SAFE'], [C.red, 'BOSS'], [C.purple, 'EXIT']];
        leg.forEach(function (lg, i) { var lx = x + (i % 2) * 66, ly = 132 + Math.floor(i / 2) * 9; R(lx, ly + 1, 5, 5, lg[0]); T(lg[1], lx + 8, ly, C.dgray, { shadow: null }); });
      } else {
        var y2 = 24;
        obj.forEach(function (l, i) { if (y2 < 150) y2 = objLines(l, i, 290, 16, y2, 150, 11); });
      }
    };
    return push(m);
  };

  /* ================================================================
     HOW TO PLAY
     ================================================================ */
  var HOWTO = [
    { title: 'KEYBOARD', rows: function () {
      var mv = ['left', 'right', 'up', 'down'].map(function (a) { return kbName(a, '?'); }).join(' ');
      return [['MOVE', mv], ['JUMP / OK', kbBoth('jump')], ['ATTACK / BACK', kbBoth('attack')], ['BOMB', kbBoth('bomb')],
        ['SPECIAL', kbBoth('special')], ['POTION', kbBoth('potion')], ['PAUSE', 'ENTER / ESC' + (kbName('start', '') ? ' / ' + kbName('start', '') : '')],
        ['MAP', kbBoth('select')]];
    } },
    { title: 'GAMEPAD', rows: [['MOVE', 'D-PAD / STICK'], ['JUMP / OK', 'A (BOTTOM)'], ['ATTACK', 'X (LEFT)'], ['BOMB / BACK', 'B (RIGHT)'], ['SPECIAL', 'Y (TOP)'], ['POTION', 'BUMPERS / TRIGGERS'], ['PAUSE', 'START'], ['MAP', 'SELECT']] },
    { title: 'TOUCH', rows: [['MOVE', 'LEFT PAD'], ['JUMP / OK', 'A BUTTON'], ['ATTACK / BACK', 'B BUTTON'], ['BOMB', 'BOMB BUTTON'], ['SPECIAL', 'SPC BUTTON'], ['POTION', 'POT BUTTON'], ['PAUSE', 'START (TOP RIGHT)'], ['MAP', 'MAP (TOP RIGHT)']] },
    { title: 'MOVES', rows: [['PUNCH COMBO', 'TAP ATTACK'], ['KICK', 'DOWN + ATTACK'], ['STOMP KICK', 'DOWN + ATTACK IN AIR'], ['HEAD BOUNCE', 'LAND ON ENEMIES'], ['DROP DOWN', 'DOWN + JUMP'], ['LADDERS', 'UP / DOWN'], ['PET SPECIAL', 'WHEN METER IS FULL'], ['ENTER DOOR', 'A ON OVERWORLD']] }
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
      rowsList.forEach(function (r, i) { var yy = 41 + i * 12; T(r[0], 24, yy, C.gold); T(r[1], 296, yy, C.white, { align: 'right' }); R(24 + tw(r[0]) + 4, yy + 6, 296 - tw(r[1]) - 4 - (24 + tw(r[0]) + 4) - 4, 1, '#2c3c7c'); });
      T(m.page === 0 ? 'REBIND KEYS IN SETTINGS > KEYBOARD CONTROLS' : 'BEAT FLOORS. OPEN BOXES. GET VIEWS. DON\'T DIE.', 160, 140, C.pink, { align: 'center' });
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
     BACKDROPS + VIGNETTES (shared by scenes)
     ================================================================ */
  var STARS = null;
  function stars(ctx, t, drift, n) {
    if (!STARS) { var rr = U.rng ? U.rng(1337) : Math.random; STARS = []; for (var i = 0; i < 120; i++) STARS.push({ x: rr() * W, y: rr() * H, s: rr(), p: rr() * 6.28 }); }
    n = n || 90;
    for (var k = 0; k < n; k++) {
      var st = STARS[k];
      var tw2 = Math.sin(t * (1 + st.s * 3) + st.p);
      if (tw2 < -0.6) continue;
      var x = ((st.x - t * drift * (0.3 + st.s)) % W + W) % W;
      R(x, st.y, 1, 1, st.s > 0.85 ? C.white : st.s > 0.5 ? C.gray : C.dgray);
      if (st.s > 0.95 && tw2 > 0.7) { R(x - 1, st.y, 3, 1, C.white); R(x, st.y - 1, 1, 3, C.white); }
    }
  }
  function bands(ctx, cols, y0, y1) {
    var n = cols.length, h = (y1 - y0) / n;
    for (var i = 0; i < n; i++) R(0, Math.round(y0 + i * h), W, Math.ceil(h) + 1, cols[i]);
  }
  function pdisc(ctx, cx, cy, r, col) {
    for (var y = -r; y <= r; y++) { var w = Math.round(Math.sqrt(r * r - y * y)); R(cx - w, cy + y, w * 2, 1, col); }
  }
  // disc clipped by a bigger disc (continents on a planet)
  function pdiscIn(ctx, cx, cy, r, px, py, pr, col) {
    for (var y = -r; y <= r; y++) {
      var yy = cy + y, dy = yy - py; if (Math.abs(dy) > pr) continue;
      var w = Math.sqrt(r * r - y * y), pw = Math.sqrt(pr * pr - dy * dy);
      var a = Math.max(cx - w, px - pw), b = Math.min(cx + w, px + pw);
      if (b > a) R(Math.round(a), yy, Math.round(b - a), 1, col);
    }
  }
  function skyline(ctx, y, seed, col, lit, t) {
    var rr = U.rng ? U.rng(seed) : Math.random, x = -4;
    while (x < W) {
      var bw = 12 + Math.floor(rr() * 22), bh = 14 + Math.floor(rr() * 40);
      R(x, y - bh, bw, bh + 40, col);
      if (lit) for (var wy = y - bh + 4; wy < y - 3; wy += 6) for (var wx = x + 3; wx < x + bw - 3; wx += 5) if (rr() < 0.35) R(wx, wy, 2, 3, ((wx * 7 + wy * 3 + Math.floor((t || 0) * 0.5)) % 11) < 2 ? C.white : lit);
      x += bw + Math.floor(rr() * 4);
    }
  }
  function saucer(ctx, x, y, beam) {
    x = Math.round(x); y = Math.round(y);
    if (beam) { ctx.globalAlpha = 0.22; ctx.fillStyle = C.yellow; ctx.beginPath(); ctx.moveTo(x - 3, y + 2); ctx.lineTo(x + 3, y + 2); ctx.lineTo(x + 14, y + beam); ctx.lineTo(x - 14, y + beam); ctx.fill(); ctx.globalAlpha = 1; }
    R(x - 8, y, 16, 3, '#000'); R(x - 7, y, 14, 2, C.gray); R(x - 3, y - 3, 6, 3, '#000'); R(x - 2, y - 3, 4, 3, C.blue);
    R(x - 5, y + 1, 1, 1, (Math.floor((DCW.t || 0) * 6) % 2) ? C.red : C.gold); R(x + 4, y + 1, 1, 1, (Math.floor((DCW.t || 0) * 6) % 2) ? C.gold : C.red);
  }
  var VIG = {
    earth: function (ctx, t, x, y, w, h) {
      R(x, y, w, h, '#05030c'); stars(ctx, t, 2);
      var cx = x + w / 2, cy = y + h / 2 + 4;
      pdisc(ctx, cx, cy, 36, '#000'); pdisc(ctx, cx, cy, 35, '#0058f8');
      [[-12, -10, 12], [10, 6, 14], [-4, 18, 8], [18, -16, 7]].forEach(function (c, i) { pdiscIn(ctx, cx + c[0] + Math.round(Math.sin(t * 0.2) * 2), cy + c[1], c[2], cx, cy, 35, i % 2 ? '#00a800' : '#58d854'); });
      pdiscIn(ctx, cx - 20, cy - 22, 20, cx, cy, 35, 'rgba(255,255,255,0.15)');
      for (var i = 0; i < 5; i++) { var a = t * 0.6 + i * 1.25; saucer(ctx, cx + Math.cos(a) * 62, cy + Math.sin(a) * 26 - 6, 0); }
    },
    city: function (ctx, t, x, y, w, h) {
      bands(ctx, ['#0b0420', '#140830', '#200c40', '#2c1048', '#3c1450'], y, y + h);
      stars(ctx, t, 1, 50);
      skyline(ctx, y + h - 10, 11, '#1c1030', null, t);
      [[x + 70, 0], [x + 200, 1.3], [x + 260, 2.2]].forEach(function (s) { saucer(ctx, s[0] + Math.sin(t + s[1]) * 6, y + 14 + s[1] * 3, h - 18); });
      skyline(ctx, y + h, 23, '#000', '#f8d878', t);
      for (var d = 0; d < 8; d++) { var dy = (t * 40 + d * 23) % (h - 20); R(x + 40 + d * 33, y + 18 + dy, 2, 2, C.gray); }
    },
    carl: function (ctx, t, x, y, w, h) {
      bands(ctx, ['#000820', '#001030', '#081840', '#102050'], y, y + h - 20);
      skyline(ctx, y + h - 20, 5, '#081028', '#3c3c00', t);
      R(x, y + h - 20, w, 20, '#dcdcfc'); R(x, y + h - 20, w, 2, C.white);
      bigSprite(ctx, 'carl_idle', x + w / 2 - 22, y + h - 8, { scale: 2, skin: 'carl_boxers', frame: Math.floor(t * 2) });
      bigSprite(ctx, compSprite('donut') + '_idle', x + w / 2 + 26, y + h - 8, { scale: 2, frame: Math.floor(t * 2), flip: true });
      for (var s = 0; s < 40; s++) { var sx = (s * 37 + Math.sin(t + s) * 6) % w, sy = (t * 14 + s * 29) % h; R(x + sx, y + sy, 1, 1, C.white); }
    },
    screen: function (ctx, t, x, y, w, h) {
      R(x, y, w, h, '#100018');
      for (var i = 0; i < 6; i++) { ctx.globalAlpha = 0.08; ctx.fillStyle = i % 2 ? C.purple : C.blue; ctx.beginPath(); var a = Math.sin(t * 0.7 + i) * 0.5; ctx.moveTo(x + w / 2, y - 10); ctx.lineTo(x + w / 2 + Math.sin(a + i) * 200 - 20, y + h); ctx.lineTo(x + w / 2 + Math.sin(a + i) * 200 + 20, y + h); ctx.fill(); ctx.globalAlpha = 1; }
      bigSprite(ctx, 'ai_screen', x + w / 2, y + h - 22 + Math.round(Math.sin(t * 2) * 3), { scale: 3, frame: Math.floor(t * 3) });
      T('● LIVE', x + 8, y + 6, blink(1.2) ? C.red : C.dred);
      T('VIEWERS ' + fmtNum(1203445 + Math.floor(t * 4321)), x + w - 6, y + 6, C.pink, { align: 'right' });
    },
    stairs: function (ctx, t, x, y, w, h) {
      R(x, y, w, h, '#0c0c10');
      R(x, y + h - 36, w, 36, '#2c2420'); R(x, y + h - 36, w, 2, '#4c3c30');
      var cx = x + w / 2 + 40, top = y + h - 30;
      var gl = 0.25 + 0.15 * Math.sin(t * 3);
      ctx.globalAlpha = gl; pdisc(ctx, cx, top + 8, 34, '#58d854'); ctx.globalAlpha = 1;
      for (var s = 0; s < 5; s++) R(cx - 22 + s * 2, top + s * 5, 44 - s * 4, 5, s % 2 ? '#1c1c1c' : '#2c2c2c');
      R(cx - 24, top - 2, 48, 2, '#7c7c7c');
      var wx = x + 30 + ((t * 18) % 80);
      spr(ctx, 'carl_run', wx, y + h - 10, { frame: Math.floor(t * 8), skin: equipped('skin') });
      spr(ctx, compSprite(equipped('companion')) + '_run', wx - 18, y + h - 10, { frame: Math.floor(t * 8) });
      T('▼', cx, top - 16 + Math.round(Math.sin(t * 4) * 2), C.green, { align: 'center' });
    },
    crowd: function (ctx, t, x, y, w, h) {
      bands(ctx, ['#1c0010', '#2c0018', '#3c0020'], y, y + h);
      for (var i = 0; i < 5; i++) { ctx.globalAlpha = 0.12; ctx.fillStyle = C.yellow; ctx.beginPath(); var sx = x + w / 2 + Math.sin(t + i * 1.7) * 140; ctx.moveTo(x + 40 + i * 60, y); ctx.lineTo(sx - 18, y + h); ctx.lineTo(sx + 18, y + h); ctx.fill(); ctx.globalAlpha = 1; }
      bigSprite(ctx, 'carl_victory', x + w / 2, y + h - 30, { scale: 2, skin: equipped('skin'), frame: Math.floor(t * 3) });
      for (var c = 0; c < 26; c++) {
        var hx = x + 6 + c * 12, hy = y + h - 12 + Math.round(Math.abs(Math.sin(t * 6 + c)) * -4);
        var hc = ['#58d854', '#3cbcfc', '#f878f8', '#fca044', '#d800cc'][c % 5];
        R(hx, hy, 9, 14, '#000'); R(hx + 1, hy + 1, 7, 7, hc); R(hx + 2, hy + 3, 1, 1, '#000'); R(hx + 5, hy + 3, 1, 1, '#000');
      }
      for (var k = 0; k < 30; k++) { var kx = (k * 53 + t * 20) % w, ky = (t * 30 + k * 17) % h; R(x + kx, y + ky, 2, 2, ['#f83800', '#f8b800', '#58d854', '#3cbcfc'][k % 4]); }
    }
  };
  ui.vignettes = VIG;
  function drawVignette(ctx, name, t) {
    var v = VIG[name] || VIG.earth;
    DCW.box(6, 6, 308, 112);
    ctx.save(); ctx.beginPath(); ctx.rect(8, 8, 304, 108); ctx.clip();
    try { v(ctx, t, 8, 8, 304, 108); } catch (e) { console.error(e); }
    ctx.restore();
  }

  /* ================================================================
     SCENES
     ================================================================ */
  var scenes = ui.scenes = {};

  /* ---------- story pages (intro + ending share this) ---------- */
  function storyPager(pages, vigOrder, onDone) {
    var p = { pages: pages, i: 0, shown: 0, blip: 0, t: 0, pt: 0, done: false };
    p.update = function (dt) {
      p.t += dt; p.pt += dt;
      var pg = p.pages[p.i]; if (!pg) { finish(); return; }
      var lines = pg._lines, total = lines.join('').length;
      if (p.shown < total) {
        var b = Math.floor(p.shown); p.shown = Math.min(total, p.shown + dt * 45);
        if (Math.floor(p.shown) !== b) { p.blip++; if (p.blip >= 3) { p.blip = 0; sfx('text_blip'); } }
      }
      if (P('start')) { finish(); return; }
      if ((P('confirm') || P('back')) && p.pt > 0.15) {
        if (p.shown < total) p.shown = total;
        else { p.i++; p.shown = 0; p.pt = 0; sfx('menu_move'); if (p.i >= p.pages.length) finish(); }
      }
    };
    function finish() { if (p.done) return; p.done = true; if (onDone) onDone(); }
    p.draw = function (ctx) {
      var pg = p.pages[Math.min(p.i, p.pages.length - 1)]; if (!pg) return;
      var vig = pg.vignette || pg.scene || vigOrder[Math.min(p.i, p.pages.length - 1) % vigOrder.length];
      drawVignette(ctx, vig, p.t);
      DCW.box(6, 124, 308, 52);
      var tx = 14;
      if (pg.portrait) { R(11, 129, 34, 34, C.white); R(12, 130, 32, 32, '#000'); portrait(ctx, pg.portrait, 12, 130); tx = 52; }
      var left = p.shown;
      pg._lines.forEach(function (l, i) { if (left <= 0) return; T(l.slice(0, Math.floor(left)), tx, 130 + i * 10, C.white); left -= l.length; });
      if (p.shown >= pg._lines.join('').length && blink(2.5)) T('▼', 302, 164, C.gold);
      // page dots
      for (var d = 0; d < p.pages.length; d++) R(160 - p.pages.length * 4 + d * 8, 120, 4, 2, d === p.i ? C.gold : C.ddgray);
      T(bn('start') + ':SKIP', 312, 9, C.dgray, { align: 'right', shadow: null });
    };
    pages.forEach(function (pg) { pg._lines = wrap(String(pg.text || '').toUpperCase(), pg.portrait ? 254 : 292).slice(0, 4); });
    return p;
  }
  function storyPages(key, fb) {
    var st = D('story'), arr = st && st[key];
    var out = [];
    (Array.isArray(arr) && arr.length ? arr : fb).forEach(function (pg) {
      if (typeof pg === 'string') pg = { text: pg };
      var txt = String(pg.text || '');
      var por = pg.portrait, vig = pg.vignette || pg.scene;
      var wl = wrap(txt.toUpperCase(), por ? 254 : 292);
      for (var i = 0; i < wl.length; i += 4) out.push({ text: wl.slice(i, i + 4).join(' '), portrait: por, vignette: vig });
    });
    return out;
  }

  /* ---------- TITLE ---------- */
  scenes.title = {
    enter: function () {
      closeAll();
      this.t = 0; this.sel = 0; this.cool = 0.25;
      music('title');
    },
    items: function () {
      var hasRun = !!(DCW.save && DCW.save.run);
      return [
        hasRun ? { label: 'CONTINUE', action: function () { start('continueRun'); } } : null,
        { label: 'NEW CRAWL', action: function () {
          if (DCW.save && DCW.save.run) ui.confirm('START OVER? YOUR CURRENT CRAWL WILL BE LOST.', function () { start('newRun'); });
          else start('newRun');
        } },
        { label: 'WARDROBE', action: ui.openWardrobe },
        { label: 'ACHIEVEMENTS', action: ui.openAchievements },
        { label: 'SETTINGS', action: ui.openSettings },
        { label: 'HOW TO PLAY', action: ui.openHowTo }
      ].filter(Boolean);
      function start(fn) { sfx('fanfare'); if (tryCall(DCW.game, fn, []) === MISSING) ui.toast('GAME MODULE MISSING', { color: C.red }); }
    },
    update: function (dt) {
      this.t += dt; if (this.cool > 0) { this.cool -= dt; return; }
      var its = this.items();
      listNav(this, its.length, dt);
      if (P('confirm') || P('start')) { var it = its[this.sel]; sfx('menu_select'); if (it && it.action) it.action(); }
    },
    idle: function (dt) { this.t += dt; },
    draw: function (ctx) {
      var t = this.t || 0;
      bands(ctx, ['#07021a', '#0b0424', '#12062e', '#1a0838', '#240a40', '#300c46', '#3c1048', '#4c1448'], 0, 172);
      stars(ctx, t, 3, 100);
      // alien planet with ring
      var px = 268, py = 34;
      pdisc(ctx, px, py, 23, '#000'); pdisc(ctx, px, py, 22, '#881488'); pdiscIn(ctx, px - 8, py - 8, 16, px, py, 22, '#b83cb8'); pdiscIn(ctx, px + 10, py + 6, 6, px, py, 22, '#5c0c5c');
      R(px - 40, py + 2, 80, 2, '#f8b800'); R(px - 34, py + 4, 68, 1, '#ac7c00');
      saucer(ctx, 40 + Math.sin(t * 0.7) * 20, 30 + Math.sin(t * 1.3) * 4, 0);
      skyline(ctx, 168, 99, '#120620', '#5c3c00', t);
      R(0, 168, W, 12, '#000'); R(0, 168, W, 1, '#3c1048');
      // logo
      var bob = Math.round(Math.sin(t * 2) * 1);
      T('DUNGEON CRAWLER', 162, 13, '#a81000', { align: 'center', scale: 2, shadow: null });
      T('DUNGEON CRAWLER', 160, 11, C.gold, { align: 'center', scale: 2, shadow: '#000' });
      var word = 'WORLD', wx = 160 - tw(word, 3) / 2;
      for (var i = 0; i < word.length; i++) {
        var ly = 31 + bob + Math.round(Math.sin(t * 3 + i * 0.8) * 1.5);
        T(word.charAt(i), wx + i * 18 + 2, ly + 2, '#a81000', { scale: 3, shadow: null });
        T(word.charAt(i), wx + i * 18, ly, C.white, { scale: 3, shadow: '#000' });
      }
      var rb = tw('EARTH EDITION') + 20;
      R(160 - rb / 2 - 6, 62, 6, 9, '#003c8c'); R(160 + rb / 2, 62, 6, 9, '#003c8c');
      DCW.box(160 - rb / 2, 59, rb, 13, { fill: C.dblue });
      T('EARTH EDITION', 160, 62, C.white, { align: 'center' });
      // AI host + Carl & Donut
      spr(ctx, 'ai_screen', 272, 132 + Math.round(Math.sin(t * 2.2) * 3), { frame: Math.floor(t * 2) });
      if (Math.floor(t / 4) % 3 === 1) { DCW.box(232, 84, 82, 22, { fill: C.white, border: '#000', border2: '#000' }); T('WE\'RE LIVE,', 273, 87, '#000', { align: 'center', shadow: null }); T('BABY!', 273, 96, C.red, { align: 'center', shadow: null }); }
      spr(ctx, 'carl_idle', 40, 169, { frame: Math.floor(t * 2), skin: equipped('skin') });
      spr(ctx, compSprite(equipped('companion')) + '_idle', 62, 169, { frame: Math.floor(t * 2), flip: true });
      // menu
      var its = this.items(), mh = its.length * 12 + 10, my = 166 - mh;
      DCW.box(104, my, 112, mh);
      var self = this;
      its.forEach(function (it, k) {
        var yy = my + 6 + k * 12;
        if (k === self.sel) cursor(110, yy);
        T(it.label, 120, yy, k === self.sel ? C.white : C.gray);
      });
      T('FAN GAME', 316, 172, '#3c2c5c', { align: 'right', shadow: null });
    }
  };

  /* ---------- INTRO ---------- */
  var INTRO_FB = [
    { text: 'ONE DAY, WITHOUT WARNING, EVERY BUILDING ON EARTH FOLDED INTO THE GROUND LIKE A BAD HAND OF CARDS.' },
    { text: 'THE GALAXY\'S MOST POPULAR GAME SHOW HAD ARRIVED. THE PLANET WAS NOW A SET.' },
    { text: 'CARL WAS OUTSIDE AT THE TIME. IN HIS BOXERS. CHASING HIS EX\'S CAT. SO HE SURVIVED.' },
    { text: 'WELCOME, CRAWLER! DESCEND. FIGHT. LOOT. ENTERTAIN THE AUDIENCE. TRY TO BE ALIVE AT THE END.', portrait: 'p_ai' },
    { text: 'THE STAIRWELL IS RIGHT THERE. THE CAT IS ALREADY JUDGING YOU. LET\'S GO.' }
  ];
  scenes.intro = {
    enter: function (p) {
      p = p || {};
      var self = this; this.done = false;
      music('intro');
      this.pager = storyPager(storyPages('intro', INTRO_FB), ['city', 'screen', 'carl', 'earth', 'stairs'], function () {
        if (self.done) return; self.done = true;
        if (p.onDone) p.onDone(); else tryCall(DCW.game, 'continueRun', []);
      });
    },
    update: function (dt) { if (!this.done) this.pager.update(dt); },
    idle: function (dt) { this.pager.t += dt; },
    draw: function (ctx) { R(0, 0, W, H, '#000'); this.pager.draw(ctx); }
  };

  /* ---------- FLOOR CARD ---------- */
  scenes.floorCard = {
    enter: function (p) {
      p = p || {};
      this.p = p; this.t = 0; this.said = false; this.done = false;
      var n = p.floor || (getRun() || {}).floor || 1;
      this.n = n;
      this.fd = (typeof p.floor === 'object' && p.floor) || floorDef(n) || { name: 'FLOOR ' + n, tagline: '' };
      if (typeof p.floor === 'object') this.n = this.fd.n || 1;
      this.conf = [];
      for (var i = 0; i < 50; i++) this.conf.push({ x: Math.random() * W, y: -Math.random() * 200, v: 30 + Math.random() * 50, c: [C.red, C.gold, C.green, C.blue, C.pink][i % 5], w: Math.random() * 6 });
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
      this.conf.forEach(function (c) { c.y += c.v * dt; if (c.y > H) c.y = -4; });
      if (this.t > 2.6 || ((P('confirm') || P('start')) && this.t > 0.5)) this.next();
    },
    idle: function (dt) { this.t += dt; this.conf.forEach(function (c) { c.y += c.v * dt; if (c.y > H) c.y = -4; }); },
    draw: function (ctx) {
      var t = this.t, fd = this.fd;
      R(0, 0, W, H, '#0c0418');
      // spotlights
      for (var i = 0; i < 2; i++) {
        var sx = 160 + Math.sin(t * 1.4 + i * 3) * 110;
        ctx.globalAlpha = 0.13; ctx.fillStyle = C.yellow; ctx.beginPath(); ctx.moveTo(i ? 300 : 20, 0); ctx.lineTo(sx - 30, H); ctx.lineTo(sx + 30, H); ctx.fill(); ctx.globalAlpha = 1;
      }
      // curtains opening
      var open = clamp(t / 0.6, 0, 1), cw = Math.round(162 * (1 - open * 0.82));
      for (var s = 0; s < 2; s++) {
        var x0 = s ? W - cw : 0;
        R(x0, 0, cw, H, '#7c0800');
        for (var f = 0; f < cw; f += 8) R(x0 + f + (s ? 0 : 4), 0, 2, H, '#a81000');
        R(s ? x0 : x0 + cw - 2, 0, 2, H, '#3c0000');
      }
      R(0, 0, W, 10, '#a81000'); for (var sc = 0; sc < W; sc += 16) R(sc, 8, 8, 4, '#7c0800');
      this.conf.forEach(function (c) { if (t > 0.4) R(c.x + Math.sin(t * 3 + c.w) * 3, c.y, 2, 3, c.c); });
      if (t > 0.35) {
        var k = clamp((t - 0.35) / 0.3, 0, 1);
        T('FLOOR', 160 - Math.round((1 - k) * 200), 18, C.white, { align: 'center', scale: 2 });
        var popS = t < 0.9 ? 5 : 4;
        if (t > 0.6) T(String(this.n), 160, popS === 5 ? 32 : 36, C.gold, { align: 'center', scale: popS });
      }
      if (t > 1.0) {
        var nm = String(fd.name || '').toUpperCase(), big = tw(nm, 2) <= 300;
        T(nm, 160, big ? 76 : 80, C.white, { align: 'center', scale: big ? 2 : 1, wrap: big ? null : 300 });
        if (t > 1.4 && fd.tagline) wrap(String(fd.tagline).toUpperCase(), 280).slice(0, 2).forEach(function (l, i) { T(l, 160, 96 + i * 10, C.yellow, { align: 'center' }); });
        if (!this.said) T('★ ★ ★', 160, 140, blink(2) ? C.gold : C.yellow, { align: 'center' });
      }
      if (t > 1.6 && !this.said && blink(2)) T(bn('confirm'), 312, 170, C.dgray, { align: 'right', shadow: null });
    }
  };

  /* ---------- RESULTS ---------- */
  function rankOf(r, par) {
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
      var r = this.r;
      this.rows = [
        ['KILLS', r.kills || 0, function (v) { return String(Math.round(v)); }],
        ['TIME', r.time || 0, function (v) { return fmtTime(v); }],
        ['DAMAGE TAKEN', r.damageTaken || 0, function (v) { return String(Math.round(v)); }],
        ['MAX COMBO', r.maxCombo || 0, function (v) { return Math.round(v) + '×'; }],
        ['VIEWS GAINED', r.views || 0, function (v) { return fmtNum(v); }],
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
      var t = this.t, self = this;
      bands(ctx, ['#0c0418', '#140828', '#1c0c34', '#240c3c'], 0, H);
      for (var i = 0; i < 3; i++) { ctx.globalAlpha = 0.1; ctx.fillStyle = C.yellow; ctx.beginPath(); var sx = 160 + Math.sin(t + i * 2) * 140; ctx.moveTo(60 + i * 100, 0); ctx.lineTo(sx - 25, H); ctx.lineTo(sx + 25, H); ctx.fill(); ctx.globalAlpha = 1; }
      T(this.boss ? 'BOSS DEFEATED!' : 'STAGE CLEAR!', 160, 5, blink(2) ? C.gold : C.yellow, { align: 'center', scale: 2 });
      T(fitText(this.name, 300), 160, 24, C.white, { align: 'center' });
      DCW.box(8, 36, 150, 96);
      this.rows.forEach(function (r, k) {
        if (self.step <= k) return;
        var yy = 42 + k * 11, frac = self.step === k + 1 ? clamp(self.stepT / 0.28, 0, 1) : 1;
        T(r[0], 14, yy, C.gray);
        T(r[2](r[1] * frac), 152, yy, k === 2 && !r[1] ? C.green : C.white, { align: 'right' });
      });
      if (this.step > this.rows.length) {
        T('RANK', 14, 112, C.gray);
        var rc = { S: C.gold, A: C.green, B: C.blue, C: C.white, D: C.dgray }[this.rank];
        T(this.rank, 150, 108, rc, { align: 'right', scale: 2 });
      }
      DCW.box(164, 36, 148, 96);
      T('REWARDS', 238, 41, C.gold, { align: 'center' });
      if (!this.rw.length && this.step > this.rows.length) T('NOTHING. HARSH.', 238, 60, C.dgray, { align: 'center' });
      this.rw.slice(0, 7).forEach(function (r, k) {
        if (self.step <= self.rows.length + k) return;
        var yy = 53 + k * 11;
        icon(ctx, r.icon, 169, yy - 1);
        T(fitText(r.text, 128), 180, yy, r.color);
      });
      if (this.step >= this.total()) {
        DCW.box(4, 136, 312, 40);
        R(8, 139, 34, 34, C.white); R(9, 140, 32, 32, '#000'); portrait(ctx, 'p_ai', 9, 140);
        wrap(String(this.quip).toUpperCase(), 262).slice(0, 3).forEach(function (l, k) { T(l, 47, 141 + k * 10, C.white); });
        if (blink(2.5)) T('▼', 304, 165, C.gold);
      }
    }
  };

  /* ---------- DEATH ---------- */
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
      bands(ctx, ['#000000', '#100000', '#200000', '#300404', '#3c0808'], 0, H);
      for (var i = 0; i < 30; i++) { var ax = (i * 41) % W, ay = (t * (8 + i % 5) + i * 23) % H; R(ax, ay, 1, 2, '#5c1010'); }
      var msg = 'YOU HAVE DIED', mw = tw(msg, 2), mx = 160 - mw / 2;
      for (var k = 0; k < msg.length; k++) {
        var lt = clamp((t - k * 0.06) / 0.3, 0, 1);
        if (lt <= 0) continue;
        var ly = Math.round(-20 + (24 - -20) * (1 - Math.pow(1 - lt, 2)));
        T(msg.charAt(k), mx + k * 12, ly, '#d82800', { scale: 2 });
      }
      var run = getRun() || {};
      ctx.globalAlpha = 0.35; R(120, 84, 80, 4, '#000'); ctx.globalAlpha = 1;
      bigSprite(ctx, 'carl_dead', 160, 86, { scale: 2, skin: equipped('skin') });
      if (t > 0.8) {
        T(fitText('CAUSE: ' + String(this.r.cause || 'MISADVENTURE').toUpperCase(), 300), 160, 48, C.gray, { align: 'center' });
        DCW.box(4, 92, 312, 38);
        R(8, 95, 34, 32, '#000'); portrait(ctx, 'p_ai', 9, 95);
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
        T('VIEWS ' + fmtNum(run.views || 0) + '  LV ' + (run.level || 1) + '  FLOOR ' + (run.floor || 1), 160, 172, C.ddgray, { align: 'center', shadow: null });
      }
    }
  };

  /* ---------- SAFE ROOM ---------- */
  var GROUND = 150;
  scenes.safeRoom = {
    enter: function () {
      this.t = 0; this.x = 270; this.face = -1; this.moving = false;
      this.cx = 290; this.cface = -1; this.cmoving = false;
      this.pet = 0; this.hearts = []; this.near = null; this.leaving = false;
      this.objs = [
        { id: 'shop', x: 44, label: 'SHOP', verb: 'SHOP' },
        { id: 'mordecai', x: 112, label: 'MORDECAI', verb: 'TALK' },
        { id: 'boxes', x: 174, label: 'LOOT BOXES', verb: 'OPEN' },
        { id: 'wardrobe', x: 228, label: 'WARDROBE', verb: 'CHANGE' },
        { id: 'door', x: 296, label: 'EXIT', verb: 'LEAVE' }
      ];
      music('safe');
    },
    interact: function (o) {
      var self = this;
      if (o.id === 'shop') { sfx('menu_select'); ui.openShop(); }
      else if (o.id === 'boxes') { sfx('menu_select'); ui.openBoxes(); }
      else if (o.id === 'wardrobe') { sfx('menu_select'); ui.openWardrobe(); }
      else if (o.id === 'mordecai') {
        sfx('menu_select');
        var run = getRun() || {}, mf = mordForm();
        var fl = (D('floors') || [])[(run.floor || 1) - 1] || {};
        var rumorPool = (fl.hints || []).slice();
        var tip = function () {
          var useRumor = rumorPool.length && Math.random() < 0.7;
          if (useRumor) { ui.say([{ who: 'MORDECAI', portrait: mf.portrait, text: pick(rumorPool) }]); return; }
          ui.say([{ who: 'MORDECAI', portrait: mf.portrait, text: pick(D('mordecai')) || 'KEEP YOUR HEAD DOWN AND YOUR FISTS UP. AND FEED THE CAT.' }]); };
        var openMenu = function () { ui.menu([
          { label: 'ASK FOR A TIP', action: tip },
          { label: (run.statPoints > 0 ? 'TRAIN (' + run.statPoints + ' STAT POINT' + (run.statPoints > 1 ? 'S' : '') + ')' : 'TRAIN'), disabled: !(run.statPoints > 0), why: 'NO STAT POINTS. GO LEVEL UP.', action: function () { ui.openCharacter(); } },
          { label: 'REST (FULL HEAL)', disabled: !!run.restedHere, why: 'YOU ALREADY RESTED THIS VISIT.', action: function () {
            var r = getRun(); if (r) r.restedHere = true;
            if (hasG('heal')) G('heal', 9999); else if (r) r.hp = pStats().maxHp || r.hp;
            persist(); sfx('heal');
            ui.say([{ who: 'MORDECAI', portrait: mf.portrait, text: 'SLEEP. I\'LL WATCH THE DOOR. NOBODY GETS IN HERE ANYWAY. MOSTLY.' }]);
            ui.toast('FULLY HEALED', { icon: 'heart', color: C.green });
          } },
          { label: 'NEVERMIND', action: function () {} }
        ], { title: mf.name ? 'MORDECAI THE ' + mf.name : 'MORDECAI', titleColor: C.green }); };
        run.mordecaiMet = run.mordecaiMet || {};
        if (mf.line && !run.mordecaiMet[mf.n]) {
          run.mordecaiMet[mf.n] = true; persist();
          ui.say([{ who: 'MORDECAI', portrait: mf.portrait, text: mf.line }], { onDone: openMenu });
        } else openMenu();
      } else if (o.id === 'door') {
        sfx('menu_select');
        ui.confirm('LEAVE THE SAFE ROOM?', function () {
          self.leaving = true; sfx('door');
          if (tryCall(DCW.game, 'leaveSafeRoom', []) === MISSING) { self.leaving = false; ui.toast('NOWHERE TO GO', { color: C.red }); }
        });
      }
    },
    update: function (dt) {
      this.t += dt;
      if (this.leaving) return;
      tryCall(DCW.game, 'tick', [dt]);
      var ax = (Dn('right') ? 1 : 0) - (Dn('left') ? 1 : 0);
      this.moving = ax !== 0 && this.pet <= 0;
      if (this.moving) { this.face = ax; this.x = clamp(this.x + ax * 70 * dt, 12, 306); }
      // companion follows
      var tx = this.x - this.face * 20, d = tx - this.cx;
      this.cmoving = Math.abs(d) > 2;
      if (this.cmoving) { this.cface = d > 0 ? 1 : -1; this.cx += clamp(d, -80 * dt, 80 * dt); }
      else this.cface = this.x > this.cx ? 1 : -1;
      // nearest interactable
      var self = this; this.near = null;
      this.objs.forEach(function (o) { if (Math.abs(o.x - self.x) < 14) self.near = o; });
      if (this.pet > 0) this.pet -= dt;
      this.hearts.forEach(function (h) { h.y -= 20 * dt; h.life -= dt; });
      this.hearts = this.hearts.filter(function (h) { return h.life > 0; });
      if (P('start')) { ui.openPause({ canFlee: false }); return; }
      if (P('select')) { ui.openMap(); return; }
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
    draw: function (ctx) {
      var t = this.t, self = this;
      var bgOk = false;
      if (DCW.art && typeof DCW.art.background === 'function') { try { DCW.art.background(ctx, 'safe', 0, 0); bgOk = true; } catch (e) { bgOk = false; } }
      if (!bgOk) {
        bands(ctx, ['#2c1c14', '#38241a', '#442c1c', '#4c3020'], 0, GROUND);
        for (var wx = 0; wx < W; wx += 32) R(wx, 0, 1, GROUND, '#24160e');
        R(0, 30, W, 3, '#5c3c24');
      }
      // floor
      var tileOk = !!(DCW.art && typeof DCW.art.tile === 'function');
      for (var fx = 0; fx < W; fx += 16) for (var fy = GROUND; fy < H; fy += 16) {
        var drawn = false;
        if (tileOk) { try { DCW.art.tile(ctx, 'safe', '#', fx, fy, { up: fy > GROUND, down: true, left: true, right: true, t: t, tx: fx / 16, ty: fy / 16 }); drawn = true; } catch (e) { drawn = false; } }
        if (!drawn) { R(fx, fy, 16, 16, '#5c3c24'); R(fx, fy, 16, 1, fy === GROUND ? '#a87850' : '#4c3020'); R(fx + 15, fy, 1, 16, '#3c2414'); }
      }
      // AI screen hovering
      spr(ctx, 'ai_screen', 160, 46 + Math.round(Math.sin(t * 2) * 3), { frame: Math.floor(t * 2) });
      if (!bgOk) T('SAFE ROOM', 160, 58, C.dgray, { align: 'center', shadow: null });
      // shop: bopca behind counter
      spr(ctx, 'bopca', 44, GROUND - 12, { frame: Math.floor(t * 2) });
      R(26, GROUND - 16, 38, 16, '#000'); R(27, GROUND - 15, 36, 15, '#7c4c24'); R(27, GROUND - 15, 36, 2, '#c87838');
      icon(ctx, 'coin', 31, GROUND - 11); icon(ctx, 'potion', 41, GROUND - 11); icon(ctx, 'bomb', 51, GROUND - 11);
      // mordecai
      spr(ctx, mordForm().sprite, 112, GROUND, { frame: Math.floor(t * 1.5), flip: this.x < 112 });
      // loot box pile
      var run = getRun() || {}, bx = run.boxes || [];
      if (!bx.length) spr(ctx, 'box_bronze', 174, GROUND, { alpha: 0.3 });
      bx.slice(0, 3).forEach(function (b, i) { spr(ctx, 'box_' + b.tier, 168 + (i % 2) * 12, GROUND - Math.floor(i / 2) * 13 - (i === 2 ? 0 : 0), { frame: i === 0 ? Math.floor(t * 4) : 0 }); });
      if (bx.length) { DCW.box(182, GROUND - 32, tw(bx.length) + 8, 11, { fill: C.red }); T(bx.length, 186, GROUND - 30, C.white); }
      // wardrobe (procedural)
      R(214, GROUND - 40, 28, 40, '#000'); R(215, GROUND - 39, 26, 39, '#7c3c18'); R(215, GROUND - 39, 26, 3, '#a85010');
      R(217, GROUND - 34, 10, 32, '#5c2c10'); R(229, GROUND - 34, 10, 32, '#5c2c10'); R(226, GROUND - 20, 1, 3, C.gold); R(229, GROUND - 20, 1, 3, C.gold);
      R(219, GROUND - 31, 5, 10, '#a4e4fc'); R(220, GROUND - 30, 1, 4, C.white);
      // door
      spr(ctx, 'door', 296, GROUND, {});
      // companion + carl
      var comp = compSprite(equipped('companion'));
      var cs = this.cmoving ? comp + '_run' : comp + '_idle';
      if (this.pet > 0 && hasArt(comp + '_act')) cs = comp + '_act';
      spr(ctx, cs, this.cx, GROUND, { frame: Math.floor(t * (this.cmoving ? 8 : 2)), flip: this.cface < 0 });
      spr(ctx, this.moving ? 'carl_run' : 'carl_idle', this.x, GROUND, { frame: Math.floor(t * (this.moving ? 10 : 2)), flip: this.face < 0, skin: equipped('skin') });
      this.hearts.forEach(function (h) { T('♥', h.x, h.y, (Math.floor(h.life * 8) % 2) ? C.red : '#fc7460'); });
      if (this.pet > 0.2) { var pw2 = tw('PURR'); DCW.box(this.cx - pw2 / 2 - 4, GROUND - 46, pw2 + 8, 12, { fill: C.white, border: '#000' }); T('PURR', this.cx, GROUND - 44, '#000', { align: 'center', shadow: null }); }
      // prompt
      if (this.near && !ui.blocking()) {
        var o = this.near, by = GROUND - (o.id === 'door' ? 44 : o.id === 'mordecai' ? 40 : 34) + Math.round(Math.sin(t * 5) * 1.5);
        var lw = tw(o.label) + 8;
        var lx = clamp(o.x - lw / 2, 4, W - 4 - lw);
        DCW.box(lx, by - 12, lw, 12, { fill: '#000' });
        T(o.label, lx + 4, by - 10, C.gold);
        T('▼', o.x, by + 1, C.white, { align: 'center' });
        DCW.box(60, 164, 200, 14, { fill: '#000' });
        T(bn('confirm') + ': ' + o.verb, 160, 167, C.white, { align: 'center' });
      } else if (!ui.blocking()) {
        T('◀ ▶ WALK   ' + bn('down') + ' PET   ' + bn('start') + ' MENU', 160, 168, C.dgray, { align: 'center', shadow: '#000' });
      }
      ui.drawHUD(ctx, ui.hudFromRun({ stageName: 'SAFE ROOM' }));
    }
  };

  /* ---------- ENDING ---------- */
  var ENDING_FB = [
    { text: 'THE LAST BOSS FELL. THE STUDIO LIGHTS FLICKERED. SOMEWHERE, A PRODUCER WEPT INTO A BUCKET OF SNACKS.' },
    { text: 'THE AUDIENCE ROARED. BILLIONS OF VIEWERS ACROSS A THOUSAND WORLDS CHANTED ONE NAME. MOSTLY CARL. SOMETIMES DONUT.', portrait: 'p_ai' },
    { text: 'THE DUNGEON GOES DEEPER, OF COURSE. IT ALWAYS DOES. BUT FOR TONIGHT, CARL AND DONUT HAVE WON.' }
  ];
  var CREDITS_FB = ['DUNGEON CRAWLER WORLD', 'EARTH EDITION', '', 'A PERSONAL FAN GAME', 'NOT FOR SALE. NOT OFFICIAL.', '', 'STARRING', 'CARL', 'PRINCESS DONUT', '', 'HOSTED BY', 'THE SYSTEM AI', '', 'THANKS FOR PLAYING!'];
  scenes.ending = {
    enter: function () {
      var self = this;
      this.t = 0; this.phase = 'story'; this.ct = 0; this.done = false;
      music('ending');
      this.pager = storyPager(storyPages('ending', ENDING_FB), ['crowd', 'screen', 'carl', 'earth'], function () { self.phase = 'credits'; self.ct = 0; });
      var st = D('story'), cr = st && st.credits;
      this.credits = (Array.isArray(cr) && cr.length ? cr : CREDITS_FB).map(function (l) { return String(l).toUpperCase(); });
    },
    update: function (dt) {
      this.t += dt;
      if (this.phase === 'story') { this.pager.update(dt); return; }
      if (this.phase === 'credits') {
        this.ct += dt * (Dn('confirm') || Dn('jump') ? 5 : 1);
        if (P('start') || this.ct * 18 > this.credits.length * 14 + H + 20) { this.phase = 'stats'; this.ct = 0; sfx('fanfare'); }
        return;
      }
      this.ct += dt;
      if ((P('confirm') || P('start')) && this.ct > 0.8 && !this.done) {
        this.done = true; sfx('menu_select');
        if (tryCall(DCW.game, 'quitToTitle', []) === MISSING) DCW.fade(function () { DCW.setScene(scenes.title, {}); });
      }
    },
    idle: function (dt) { this.t += dt; },
    draw: function (ctx) {
      var t = this.t;
      if (this.phase === 'story') { R(0, 0, W, H, '#000'); this.pager.draw(ctx); return; }
      R(0, 0, W, H, '#05030c'); stars(ctx, t, 6, 110);
      if (this.phase === 'credits') {
        var y0 = H + 10 - this.ct * 18;
        this.credits.forEach(function (l, i) {
          var yy = y0 + i * 14; if (yy < -10 || yy > H) return;
          var hdr = i === 0 || /^(STARRING|HOSTED BY|MUSIC|ART|CODE|THANKS)/.test(l);
          T(l, 160, yy, i === 0 ? C.gold : hdr ? C.pink : C.white, { align: 'center', scale: i === 0 ? 2 : 1 });
        });
        spr(ctx, 'carl_run', 30 + ((t * 40) % 300), 176, { frame: Math.floor(t * 10), skin: equipped('skin') });
        spr(ctx, compSprite(equipped('companion')) + '_run', 10 + ((t * 40) % 300), 176, { frame: Math.floor(t * 10) });
        return;
      }
      // stats summary
      var run = getRun() || {}, meta = (DCW.save && DCW.save.meta) || {};
      var achs = D('achievements') || {}, an = Object.keys(meta.achievements || {}).length;
      frame(ctx, 'FINAL STATS', { dim: false, footer: bn('confirm') + ': BACK TO TITLE' });
      var rows = [
        ['FLOORS CONQUERED', String(Math.max(meta.bestFloor || 0, run.floor || 0))],
        ['LEVEL', String(run.level || '-')],
        ['VIEWERS', fmtNum(run.views || 0)],
        ['FAN TITLE', titleFor(run.views || 0)],
        ['KILLS', String(run.kills || 0)],
        ['TOTAL TIME', fmtTime((run.totalTime || 0) + (run.floorTime || 0))],
        ['DEATHS (ALL TIME)', String(meta.deaths || 0)],
        ['ACHIEVEMENTS', an + '/' + Object.keys(achs).length],
        ['WINS', String(meta.wins || 1)]
      ];
      rows.forEach(function (r, i) { var yy = 26 + i * 13; T(r[0], 20, yy, C.gray); T(fitText(r[1], 200), 300, yy, i === 3 ? C.pink : C.white, { align: 'right' }); });
      spr(ctx, 'ai_screen', 286, 160 + Math.round(Math.sin(t * 2) * 2), { frame: Math.floor(t * 2) });
    }
  };

  /* ---------------- exports for overworld.js and friends ---------------- */
  ui._h = { tryCall: tryCall, G: G, hasG: hasG, sfx: sfx, music: music, D: D, getRun: getRun, floorDef: floorDef, stageDef: stageDef,
    spr: spr, bigSprite: bigSprite, portrait: portrait, icon: icon, hasArt: hasArt, artInfo: artInfo, T: T, tw: tw, fitText: fitText, wrap: wrap,
    blink: blink, equipped: equipped, compSprite: compSprite, pStats: pStats, bn: bn, persist: persist, aiLine: aiLine, clamp: clamp, MISSING: MISSING, C: C };
})();

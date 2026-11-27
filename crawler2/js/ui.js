/* ============================================================
   DCW UI (book 2) - modal stack, dialog with talking portraits,
   toasts, banners, menus, HUD (boss phase pips), pause + sub-screens
   (map, gear, quests, inventory, character, loot boxes, wardrobe,
   achievements, settings, controls, shops). SELECT: ui.onSelect()
   (map on streets, gear elsewhere). Non-gameplay scenes (title +
   book 1 import, class pick, cinema player, inn, Desperado Club,
   results, death, endings + credits).
   Contract: ../DESIGN.md section 11 (book 1's UI contract still applies).
   Every call into game/art/audio/data is feature-detected.
   ============================================================ */
(function () {
  'use strict';
  var DCW = window.DCW = window.DCW || {};
  var ui = DCW.ui = DCW.ui || {};
  var U = DCW.U || {};
  var W = 320, H = 180;

  /* ---------------- palette (NES 2C02 + a few UI darks) ---------------- */
  var C = {
    white: '#fcfcfc', lgray: '#dcdcdc', gray: '#bcbcbc', dgray: '#7c7c7c', ddgray: '#3c3c3c', black: '#000000',
    red: '#f83800', dred: '#a81000', gold: '#f8b800', yellow: '#f8d878', green: '#58d854', dgreen: '#00a800',
    blue: '#3cbcfc', dblue: '#0058f8', nblue: '#6888fc', purple: '#d800cc', pink: '#f878f8', orange: '#fca044',
    fill: '#0f1630', cyan: '#00e8d8', brown: '#a85010', skin: '#fcd8a8'
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
  function floorDef(n) { var f = G('floorDef', n); return f || { n: 3, name: 'THE OVER CITY' }; } // book 1 shim
  function levelDef(id) {
    if (!id) return null;
    var l = G('levelDef', id); if (l) return l;
    var d = D('levels'); if (d && d[id]) return d[id];
    var s = D('stages'); return (s && s[id]) || null;
  }
  var stageDef = levelDef;
  function areaDef(id) { if (!id) return null; var a = G('areaDef', id); if (a) return a; var d = D('areas'); return (d && d[id]) || null; }
  function itemDef(id) { var d = D('items'); return (d && d[id]) || null; }
  function itemName(id) {
    if (id === 'potion' && !itemDef('potion')) return 'HEALTH POTION';
    var d = itemDef(id); if (d && d.name) return String(d.name).toUpperCase();
    var n = G('itemName', id); if (n) return String(n).toUpperCase();
    return String(id || '').toUpperCase().replace(/_/g, ' ');
  }
  function itemCount(id) {
    var n = G('itemCount', id); if (typeof n === 'number') return n;
    var r = getRun(); if (!r) return 0;
    if (id === 'potion') return r.potions || 0;
    return (r.items && r.items[id]) || 0;
  }
  function flag(name) { var f = G('flag', name); if (typeof f === 'boolean') return f; var r = getRun(); return !!(r && r.flags && r.flags[name]); }
  function clockInfo() {
    var c = G('clock'); if (c && typeof c === 'object') return c;
    var r = getRun(); if (!r || r.hoursLeft === undefined) return null;
    var left = Math.max(0, Math.ceil(r.hoursLeft)), hour = Math.floor((((r.hour || 0) % 24) + 24) % 24), night = hour < 7 || hour >= 19;
    return { hoursLeft: left, hour: hour, day: Math.min(8, Math.floor((192 - left) / 24) + 1), phase: night ? 'night' : 'day', night: night, label: Math.floor(left / 24) + 'D ' + (left % 24) + 'H' };
  }
  function hourText(c) { if (!c) return '--:--'; var h = c.hour || 0, mi = c.minute || 0; return (h < 10 ? '0' : '') + h + ':' + (mi < 10 ? '0' : '') + mi; }
  function objectiveInfo() { var o = G('objective'); if (o && typeof o === 'object' && o.text) return o; if (typeof o === 'string') return { text: o }; return null; }
  function partyList() {
    var p = G('party'); if (Array.isArray(p)) return p;
    var r = getRun(); if (!r) return [];
    var out = ['donut', 'mongo']; if (r.flags && r.flags.katia_joined) out.push('katia');
    return out;
  }
  function actNum() { var a = G('act'); if (typeof a === 'number') return a; var r = getRun(); return (r && r.act) || 1; }
  function questDef(id) { var q = G('questDef', id); if (q && typeof q === 'object') return q; var d = D('quests'); return (d && d[id]) || { name: String(id || '').toUpperCase().replace(/_/g, ' ') }; }
  function pick(arr) { return arr && arr.length ? arr[Math.floor(Math.random() * arr.length)] : null; }
  function aiLine(key, fb) { var ai = D('ai'); var l = ai && pick(ai[key]); return l || fb; }
  function persist() { if (typeof DCW.persist === 'function') DCW.persist(); }
  function fmtNum(n) { n = +n || 0; return U.fmtNum ? U.fmtNum(n) : String(Math.floor(n)); }
  function fmtTime(s) { return U.fmtTime ? U.fmtTime(s || 0) : String(Math.floor(s || 0)); }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function arr(v) { return v === undefined || v === null ? [] : (Array.isArray(v) ? v : [v]); }
  function lineList(v) { // normalizes data line pools: 'text' | ['text', {who,text}] | {lines:[...]}
    if (!v) return [];
    if (typeof v === 'string') return [v];
    if (Array.isArray(v)) return v.filter(function (l) { return l !== null && l !== undefined && l !== ''; });
    if (v.lines) return lineList(v.lines);
    return [];
  }
  function save() { return DCW.save || { unlocks: { skins: ['carl_f3'] }, equipped: { skin: 'carl_f3' }, meta: { achievements: {}, counters: {} }, settings: {} }; }
  function equipped(kind) { var s = save(); return (s.equipped && s.equipped[kind]) || (kind === 'skin' ? 'carl_f3' : 'donut'); }
  function owned(kind, id) {
    if (kind !== 'skin') return partyList().indexOf(id) >= 0 || id === 'donut';
    var s = save(), l = s.unlocks && s.unlocks.skins;
    return id === 'carl_f3' || !!(l && l.indexOf(id) >= 0);
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
  function listNav(m, n, dt, wrapAround) {
    if (n <= 0) { m.sel = 0; return 0; }
    var d = 0;
    if (rep(m, 'up', dt)) d = -1; else if (rep(m, 'down', dt)) d = 1;
    if (d) {
      var s = (m.sel || 0) + d;
      if (wrapAround === false) s = clamp(s, 0, n - 1); else s = (s + n) % n;
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
  function up(s) { return String(s === undefined || s === null ? '' : s).toUpperCase(); }
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
  // small comic speech bubble (non-blocking flavor text above a character)
  function bubble(ctx, text, cx, by, o) {
    o = o || {};
    if (text && typeof text === 'object') text = text.text || ''; // data lines come as {who, text}
    var lines = wrap(up(text), o.w || 120).slice(0, o.lines || 3), w = 0;
    lines.forEach(function (l) { w = Math.max(w, tw(l)); });
    w += 8; var h = lines.length * 9 + 5;
    var x = clamp(Math.round(cx - w / 2), 2, W - 2 - w), y = Math.round(by - h - 4);
    R(x - 1, y - 1, w + 2, h + 2, '#000'); R(x, y, w, h, C.white);
    R(clamp(cx - 2, x + 2, x + w - 6), y + h, 4, 2, C.white); R(clamp(cx - 1, x + 3, x + w - 5), y + h + 2, 2, 2, C.white);
    lines.forEach(function (l, i) { T(l, x + 4, y + 3 + i * 9, o.color || '#000', { shadow: null }); });
  }

  /* ---------------- art helpers (all with fallbacks) ---------------- */
  function artOK() { return !!(DCW.art && typeof DCW.art.sprite === 'function'); }
  function hasArt(name) {
    if (!artOK() || !name) return false;
    if (typeof DCW.art.has === 'function') { try { return !!DCW.art.has(name); } catch (e) { return false; } }
    return true;
  }
  function artInfo(name) {
    if (hasArt(name) && typeof DCW.art.info === 'function') { try { var i = DCW.art.info(name); if (i && i.w && !i.missing) return i; } catch (e) { /* fall through */ } }
    return null;
  }
  function firstArt(list) { for (var i = 0; i < list.length; i++) if (hasArt(list[i])) return list[i]; return null; }
  // look table for code-drawn stand-ins (only used when the art module lacks a sprite)
  var LOOK = {
    carl: { skin: '#fcd8a8', hair: '#7c3c18', body: '#503000', legs: '#fcfcfc', h: 24 },
    mordecai: { skin: '#9c9c9c', hair: '#202020', body: '#fcfcfc', legs: '#202020', h: 28, horns: 1, wings: '#202020' },
    gordo: { skin: '#80d010', hair: '#3c5c10', body: '#7c4c24', legs: '#503000', h: 18, wide: 1 },
    bopca: { skin: '#c87838', hair: '#7c3c18', body: '#7c4c24', legs: '#503000', h: 18, wide: 1 },
    fitz: { skin: '#fcd8a8', hair: '#7c3c18', body: '#fcfcfc', legs: '#503000', h: 26 },
    clarabelle: { skin: '#3c8c30', hair: null, body: '#881488', legs: '#3c8c30', h: 32, wide: 1, snout: 1 },
    quint: { skin: '#6888fc', hair: '#202020', body: '#3c3c3c', legs: '#202020', h: 30 },
    pustule: { skin: '#58a830', hair: '#202020', body: '#f878f8', legs: '#503000', h: 30, wide: 1 },
    gumgum: { skin: '#7c9c3c', hair: '#bcbcbc', body: '#a81000', legs: '#503000', h: 24, wide: 1 },
    signet: { skin: '#a4e4fc', hair: '#fcfcfc', body: '#a4e4fc', legs: '#a4e4fc', h: 28, horns: 1 },
    lucky: { skin: '#fca044', hair: '#fcfcfc', body: '#0058f8', legs: '#503000', h: 24, beak: 1 },
    edge_dancer: { skin: '#bcbcbc', hair: '#7c7c7c', body: '#00a800', legs: '#503000', h: 24, beak: 1 },
    talon: { skin: '#a85010', hair: '#fcfcfc', body: '#a81000', legs: '#503000', h: 24, beak: 1 },
    quill: { skin: '#bcbcbc', hair: '#fcfcfc', body: '#3c3c3c', legs: '#3c3c3c', h: 26, beak: 1 },
    zev: { skin: '#3cbcfc', hair: null, body: '#0058f8', legs: '#0058f8', h: 16 },
    odette: { skin: '#fcd8a8', hair: '#a81000', body: '#d800cc', legs: '#202020', h: 26 },
    katia: { skin: '#fcd8a8', hair: '#f8d878', body: '#3c3c3c', legs: '#202020', h: 24 }
  };
  var COMP_COL = { donut: ['#fcfcfc', '#3c3c3c'], mongo: ['#f878f8', '#3cbcfc'], katia: ['#bcbcbc', '#7c7c7c'], zev: ['#3cbcfc', '#0058f8'] };
  // simple pixel stand-ins so screens stay readable before/without real art
  function fallbackSprite(g, name, x, y, o) {
    o = o || {};
    x = Math.round(x); y = Math.round(y);
    var flash = !!o.flash, f = o.frame || 0, flip = o.flip ? -1 : 1;
    function r(px, py, w, h, c) { g.fillStyle = flash ? '#fcfcfc' : c; g.fillRect(flip < 0 ? x - px - w : x + px, y + py, w, h); }
    var n = String(name), base = n.split('_')[0];
    var pa = g.globalAlpha; if (o.alpha !== undefined) g.globalAlpha = pa * o.alpha;
    try {
      if (n.indexOf('carl') === 0 && n.indexOf('dead') >= 0) { r(-12, -7, 24, 7, '#000'); r(-11, -6, 6, 5, '#fcd8a8'); r(-5, -6, 8, 5, '#503000'); r(3, -6, 5, 5, '#fcfcfc'); r(8, -6, 3, 5, '#fcd8a8'); return; }
      if (n.indexOf('donut_shoulder') === 0) { r(-4, -8, 9, 7, '#000'); r(-3, -7, 7, 5, '#fcfcfc'); r(2, -10, 4, 4, '#000'); r(2, -9, 3, 3, '#fcfcfc'); r(2, -11, 3, 1, '#f8b800'); return; }
      if (COMP_COL[base] && base !== 'katia') {
        var cc = COMP_COL[base], big = n.indexOf('mongo_big') === 0 ? 1.6 : 1, hop = (f % 2) && n.indexOf('run') >= 0 ? -1 : 0;
        var w2 = Math.round(14 * big), h2 = Math.round(8 * big);
        r(-w2 / 2, -h2 - 1 + hop, w2, h2, '#000'); r(-w2 / 2 + 1, -h2 + hop, w2 - 2, h2 - 2, cc[0]); r(w2 / 2 - 5, -h2 - 4 + hop, 6, 7, '#000'); r(w2 / 2 - 4, -h2 - 3 + hop, 4, 5, cc[0]);
        if (base === 'donut') { r(w2 / 2 - 4, -h2 - 5 + hop, 1, 2, '#000'); r(w2 / 2 - 1, -h2 - 5 + hop, 1, 2, '#000'); r(w2 / 2 - 4, -h2 - 6 + hop, 4, 1, '#f8b800'); }
        r(w2 / 2 - 2, -h2 - 1 + hop, 1, 1, '#000'); r(-w2 / 2 + 1, -3 + hop, w2 - 2, 1, cc[1]);
        r(-w2 / 2 + 1, -2, 2, 2, '#000'); r(w2 / 2 - 3, -2, 2, 2, '#000');
        return;
      }
      if (n.indexOf('ai_screen') === 0) {
        r(-12, -20, 24, 18, '#000'); r(-11, -19, 22, 16, '#7c7c7c'); r(-9, -17, 18, 12, '#0058f8');
        r(-6, -14, 3, 3, '#fcfcfc'); r(3, -14, 3, 3, '#fcfcfc'); r(-5, -9, 10, 1, '#fcfcfc'); r(-1, -2, 2, 2, '#3c3c3c');
        return;
      }
      if (n.indexOf('box_') === 0) {
        var tier = n.slice(4), bc2 = boxColor(tier);
        r(-8, -13, 16, 13, '#000'); r(-7, -12, 14, 11, bc2); r(-7, -9, 14, 1, '#000'); r(-1, -12, 2, 11, '#fcfcfc'); r(-2, -10, 4, 3, '#f8d878');
        return;
      }
      if (n.indexOf('door') === 0) { r(-9, -30, 18, 30, '#000'); r(-8, -29, 16, 29, n.indexOf('open') >= 0 ? '#1c0c00' : '#7c3c18'); r(-8, -29, 16, 2, '#a85010'); r(4, -16, 2, 2, '#f8b800'); return; }
      var lk = LOOK[base] || (base === 'carl' ? LOOK.carl : null);
      if (lk || n.indexOf('_idle') > 0 || n.indexOf('_walk') > 0 || n.indexOf('_run') > 0) {
        lk = lk || { skin: '#fcd8a8', hair: '#3c3c3c', body: ['#a81000', '#0058f8', '#00a800', '#881488', '#ac7c00'][(U.hash ? U.hash(base) : 3) % 5], legs: '#3c3c3c', h: 24 };
        var hh = lk.h, ww = lk.wide ? 16 : 12, bob = (f % 2) ? 1 : 0;
        if (lk.wings) { r(-ww / 2 - 5, -hh + 6, 5, 10, '#000'); r(ww / 2, -hh + 6, 5, 10, '#000'); r(-ww / 2 - 4, -hh + 7, 4, 8, lk.wings); r(ww / 2 + 1, -hh + 7, 4, 8, lk.wings); }
        r(-ww / 2, -hh + bob, ww, hh - bob, '#000');
        r(-ww / 2 + 1, -hh + 1 + bob, ww - 2, 7, lk.skin);
        if (lk.hair) r(-ww / 2 + 1, -hh + 1 + bob, ww - 2, 2, lk.hair);
        if (lk.horns) { r(-ww / 2 + 1, -hh - 2 + bob, 2, 3, '#000'); r(ww / 2 - 3, -hh - 2 + bob, 2, 3, '#000'); }
        if (lk.beak) { r(ww / 2 - 1, -hh + 4 + bob, 4, 2, '#000'); r(ww / 2 - 1, -hh + 4 + bob, 3, 1, '#f8b800'); }
        if (lk.snout) r(ww / 2 - 1, -hh + 5 + bob, 5, 3, lk.skin);
        r(-ww / 2 + 3, -hh + 4 + bob, 1, 1, '#000'); r(ww / 2 - 4, -hh + 4 + bob, 1, 1, '#000');
        var by = -hh + 8 + bob, bh = Math.max(4, Math.round((hh - 8) * 0.55));
        r(-ww / 2 + 1, by, ww - 2, bh, lk.body);
        if (base === 'carl') { r(-2, by, 4, bh, lk.skin); r(-ww / 2 + 1, by + bh, ww - 2, 3, '#fcfcfc'); r(-3, by + bh + 1, 1, 1, '#d82800'); r(2, by + bh + 2, 1, 1, '#d82800'); }
        var ly = by + bh + (base === 'carl' ? 3 : 0), lh = Math.max(1, -ly - 1);
        r(-ww / 2 + 2, ly, 3, lh, base === 'carl' ? lk.skin : lk.legs); r(ww / 2 - 5, ly, 3, lh, base === 'carl' ? lk.skin : lk.legs);
        return;
      }
      // generic critter
      r(-6, -12, 12, 12, '#000'); r(-5, -11, 10, 10, '#d82800'); r(-3, -8, 2, 2, '#fcfcfc'); r(1, -8, 2, 2, '#fcfcfc');
    } finally { g.globalAlpha = pa; }
  }
  function spr(ctx, name, x, y, o) {
    if (hasArt(name)) { try { DCW.art.sprite(ctx, name, Math.round(x), Math.round(y), o || {}); return true; } catch (e) { /* fall back */ } }
    fallbackSprite(ctx, name, x, y, o);
    return false;
  }
  // actor sprite with animation-name fallbacks: actorSprite('mordecai', 'idle') -> 'mordecai_idle' | 'mordecai'
  function actorName(base, anim) {
    base = String(base || 'carl');
    var tries = anim === 'walk' || anim === 'run' ? [base + '_run', base + '_walk', base + '_idle', base]
      : anim === 'talk' ? [base + '_talk', base + '_idle', base]
        : anim === 'act' ? [base + '_act', base + '_attack', base + '_idle', base]
          : [base + '_idle', base];
    return firstArt(tries) || tries[0];
  }
  // scaled and/or silhouetted sprite via an offscreen canvas (bottom-center anchor)
  var tmpC = null;
  function bigSprite(ctx, name, x, y, o) {
    o = o || {};
    var s = o.scale || 2, inf = artInfo(name) || { w: 30, h: 34 };
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
  // Donut riding on Carl's shoulder, same anchor as stage.js (x - 4*face, feet - 17); false if there is no such sprite
  function shoulderDonut(ctx, x, feetY, face, frame, scale, o) {
    if (!hasArt('donut_shoulder')) return false;
    var s = scale || 1, f = face < 0 ? -1 : 1, oo = { frame: frame, flip: f < 0, scale: s };
    if (o) for (var k in o) oo[k] = o[k];
    if (s > 1) bigSprite(ctx, 'donut_shoulder', x - 4 * s * f, feetY - 17 * s, oo);
    else { delete oo.scale; spr(ctx, 'donut_shoulder', x - 4 * f, feetY - 17, oo); }
    return true;
  }
  // stand-in faces: key = portrait name without 'p_'
  var FACE = {
    carl: { skin: '#fcd8a8', hair: '#7c3c18', bg: '#0058f8', shirt: '#503000' },
    mordecai: { skin: '#9c9c9c', hair: '#202020', bg: '#440028', horns: 1, eye: '#f8b800', shirt: '#fcfcfc', pony: 1 },
    katia: { skin: '#fcd8a8', hair: '#f8d878', bg: '#005878', shirt: '#3c3c3c' },
    signet: { skin: '#a4e4fc', hair: '#fcfcfc', bg: '#001c5c', horns: 1, eye: '#00e8d8', tattoo: '#0058f8', shirt: null },
    grimaldi: { skin: '#00a800', hair: '#005800', bg: '#203000', eye: '#f83800', vine: 1 },
    apollon: { skin: '#7c9c3c', hair: '#3c5c10', bg: '#5c3c00', shirt: '#f8b800', scar: 1 },
    clammy: { skin: '#fcfcfc', hair: '#3cbcfc', bg: '#5c0040', mouth: '#a81000', paint: '#f83800', shirt: '#f878f8' },
    heather: { skin: '#202020', hair: '#202020', bg: '#5c0000', skull: 1, eye: '#f83800' },
    gordo: { skin: '#80d010', hair: '#3c5c10', bg: '#3c2414', beard: '#3c5c10', shirt: '#7c4c24' },
    fitz: { skin: '#fcd8a8', hair: '#7c3c18', bg: '#203c5c', shirt: '#fcfcfc' },
    clarabelle: { skin: '#3c8c30', hair: null, bg: '#3c003c', snout: 1, eye: '#f8b800', shirt: '#881488' },
    quint: { skin: '#6888fc', hair: '#202020', bg: '#000c3c', eye: '#f8b800', shirt: '#3c3c3c' },
    pustule: { skin: '#58a830', hair: '#202020', bg: '#3c1c00', sore: 1, shirt: '#f878f8' },
    gumgum: { skin: '#7c9c3c', hair: '#bcbcbc', bg: '#3c1c00', tusk: 1, shirt: '#a81000' },
    vincente: { skin: '#fce0a8', hair: '#202020', bg: '#3c0000', ears: 1, shirt: '#203c5c' },
    quill: { skin: '#bcbcbc', hair: '#fcfcfc', bg: '#2c1c3c', beak: 1, eye: '#f8b800', shirt: '#3c3c3c' },
    burgundy: { skin: '#fcd8a8', hair: '#202020', bg: '#3c0010', eye2: '#3cbcfc', shirt: '#881400' },
    remex: { skin: '#9c9c9c', hair: '#5c5c5c', bg: '#001c1c', beak: 1, eye: '#00e8d8', shirt: '#203030' },
    featherfall: { skin: '#9c9c9c', hair: '#5c5c5c', bg: '#1c1c1c', beak: 1, eye: '#dcdcdc' },
    bautista: { skin: '#fca044', hair: '#202020', bg: '#5c2000', stripes: 1, ears: 1, shirt: null },
    hekla: { skin: '#fcd8a8', hair: '#f8d878', bg: '#003c5c', helm: 1, eye: '#0058f8', shirt: '#bcbcbc' },
    ripper: { skin: '#a85010', hair: '#7c3c18', bg: '#5c005c', big: 1, shirt: '#fca044' },
    zev: { skin: '#3cbcfc', hair: null, bg: '#00285c', fish: 1, shirt: '#0058f8' },
    odette: { skin: '#fcd8a8', hair: '#a81000', bg: '#3c003c', shirt: '#d800cc' },
    lucia: { skin: '#fcd8a8', hair: '#202020', bg: '#3c3c00', shirt: '#f8d878' },
    eunice: { skin: '#fcd8a8', hair: '#bcbcbc', bg: '#3c2c1c', shirt: '#7c3c18' },
    edge_dancer: { skin: '#bcbcbc', hair: '#7c7c7c', bg: '#1c3c1c', beak: 1, shirt: '#00a800' },
    talon: { skin: '#a85010', hair: '#fcfcfc', bg: '#3c1400', beak: 1, shirt: '#a81000' },
    lucky: { skin: '#fca044', hair: '#fcfcfc', bg: '#002c5c', beak: 1, shirt: '#0058f8' },
    bopca: { skin: '#c87838', hair: '#7c3c18', bg: '#3c2414', shirt: '#7c4c24' },
    manasa: { skin: '#f0d0b0', hair: '#9878f8', bg: '#2c003c', shirt: '#f878f8' },
    tucker: { skin: '#fcd8a8', hair: '#ac7c00', bg: '#002c2c', shirt: '#00a844' },
    dnadia: { skin: '#d8b8f8', hair: '#f8b800', bg: '#3c0030', shirt: '#f8b800' }
  };
  function portrait(ctx, name, x, y, o) {
    o = o || {};
    x = Math.round(x); y = Math.round(y);
    if (name && DCW.art && typeof DCW.art.portrait === 'function' && hasArt(name)) { try { DCW.art.portrait(ctx, name, x, y, o); return; } catch (e) { /* fall back */ } }
    // fallback: tinted panel with a simple face (drawn into the given ctx); frames 0 neutral, 1 mouth open, 2 blink
    var fr = o.frame || 0;
    withCtx(ctx, function () {
      var key = String(name || 'x').replace(/^p_/, '');
      var hsh = U.hash ? U.hash(key) : 7;
      var cols = ['#0058f8', '#a81000', '#00a800', '#881488', '#ac7c00', '#005878'];
      var fc = FACE[key];
      R(x, y, 32, 32, '#000'); R(x + 1, y + 1, 30, 30, fc ? fc.bg : cols[hsh % cols.length]);
      for (var i = 3; i < 32; i += 4) R(x + 1, y + i, 30, 1, 'rgba(0,0,0,0.18)');
      if (key === 'ai') {
        R(x + 5, y + 6, 22, 18, '#000'); R(x + 6, y + 7, 20, 16, '#7c7c7c'); R(x + 8, y + 9, 16, 12, '#0058f8');
        if (fr === 2) { R(x + 11, y + 13, 3, 1, '#fcfcfc'); R(x + 18, y + 13, 3, 1, '#fcfcfc'); } else { R(x + 11, y + 12, 3, 3, '#fcfcfc'); R(x + 18, y + 12, 3, 3, '#fcfcfc'); }
        if (fr === 1) R(x + 12, y + 16, 8, 3, '#fcfcfc'); else R(x + 12, y + 17, 8, 1, '#fcfcfc');
        R(x + 14, y + 24, 4, 4, '#3c3c3c');
        return;
      }
      var cc = COMP_COL[key];
      if (cc && key !== 'katia') { // animal-ish face
        R(x + 7, y + 6, 5, 7, '#000'); R(x + 20, y + 6, 5, 7, '#000'); R(x + 8, y + 7, 3, 5, cc[0]); R(x + 21, y + 7, 3, 5, cc[0]);
        R(x + 6, y + 11, 20, 16, '#000'); R(x + 7, y + 12, 18, 14, cc[0]);
        if (key === 'donut') { R(x + 7, y + 20, 5, 6, '#7c5c3c'); R(x + 20, y + 20, 5, 6, '#7c5c3c'); }
        if (fr === 2) { R(x + 10, y + 17, 4, 1, '#000'); R(x + 18, y + 17, 4, 1, '#000'); }
        else { R(x + 11, y + 16, 3, 3, '#000'); R(x + 18, y + 16, 3, 3, '#000'); if (key === 'donut') { R(x + 12, y + 17, 1, 1, '#f8d878'); R(x + 19, y + 17, 1, 1, '#f8d878'); } }
        R(x + 15, y + 20, 2, 2, cc[1]);
        if (fr === 1) R(x + 13, y + 23, 6, 2, '#a81000');
        if (key === 'donut') { R(x + 11, y + 6, 10, 4, '#f8b800'); R(x + 11, y + 4, 2, 2, '#f8b800'); R(x + 15, y + 4, 2, 2, '#f8b800'); R(x + 19, y + 4, 2, 2, '#f8b800'); R(x + 15, y + 7, 2, 2, '#f83800'); }
        return;
      }
      fc = fc || { skin: '#fcd8a8', hair: '#3c3c3c', shirt: '#3c3c3c' };
      var skin = fc.skin, ox = fc.big ? -2 : 0;
      if (fc.ears) { R(x + 5, y + 12, 3, 5, '#000'); R(x + 24, y + 12, 3, 5, '#000'); R(x + 5, y + 13, 2, 3, skin); R(x + 25, y + 13, 2, 3, skin); }
      R(x + 7 + ox, y + 7, 18 - ox * 2, 20, '#000'); R(x + 8 + ox, y + 8, 16 - ox * 2, 18, skin);
      if (fc.hair) R(x + 8 + ox, y + 8, 16 - ox * 2, 4, fc.hair);
      if (fc.pony) { R(x + 24, y + 10, 3, 16, '#000'); R(x + 24, y + 11, 2, 14, fc.hair); }
      if (fc.horns) { R(x + 8, y + 4, 3, 5, '#000'); R(x + 21, y + 4, 3, 5, '#000'); R(x + 9, y + 5, 1, 3, '#dcdcdc'); R(x + 22, y + 5, 1, 3, '#dcdcdc'); }
      if (fc.helm) { R(x + 7, y + 5, 18, 6, '#bcbcbc'); R(x + 4, y + 3, 4, 6, '#fcfcfc'); R(x + 24, y + 3, 4, 6, '#fcfcfc'); }
      if (fc.stripes) { R(x + 9, y + 13, 3, 1, '#202020'); R(x + 20, y + 13, 3, 1, '#202020'); R(x + 15, y + 9, 2, 3, '#202020'); }
      if (fc.tattoo) { R(x + 9, y + 20, 2, 4, fc.tattoo); R(x + 21, y + 19, 2, 5, fc.tattoo); }
      if (fc.skull) { R(x + 10, y + 11, 12, 12, '#dcdcdc'); R(x + 9, y + 6, 4, 4, '#f83800'); R(x + 19, y + 5, 4, 5, '#fca044'); }
      if (fc.vine) { R(x + 6, y + 22, 4, 9, '#005800'); R(x + 22, y + 20, 4, 11, '#005800'); }
      var ey = y + 15, e1 = fc.eye || '#000', e2 = fc.eye2 || e1;
      if (fr === 2) { R(x + 11, ey + 1, 3, 1, '#000'); R(x + 18, ey + 1, 3, 1, '#000'); }
      else { R(x + 11, ey, 3, 3, '#000'); R(x + 18, ey, 3, 3, '#000'); if (fc.eye) { R(x + 12, ey + 1, 1, 1, e1); R(x + 19, ey + 1, 1, 1, e2); } else if (fc.eye2) R(x + 19, ey + 1, 1, 1, e2); }
      if (fc.beak) { R(x + 14, y + 18, 5, 4, '#000'); R(x + 15, y + 19, 3, 2, '#f8b800'); }
      else if (fc.snout) { R(x + 12, y + 19, 12, 6, '#000'); R(x + 13, y + 20, 11, 4, skin); R(x + 22, y + 20, 1, 1, '#000'); }
      else if (fc.fish) { R(x + 6, y + 14, 2, 6, '#0058f8'); R(x + 24, y + 14, 2, 6, '#0058f8'); }
      if (fc.paint) { R(x + 10, y + 14, 5, 1, fc.paint); R(x + 17, y + 14, 5, 1, fc.paint); }
      if (fc.scar) R(x + 18, y + 9, 1, 8, '#a81000');
      if (fc.sore) R(x + 19, y + 19, 3, 3, '#f8d878');
      if (fc.tusk) { R(x + 11, y + 21, 1, 2, '#fcfcfc'); R(x + 20, y + 21, 1, 2, '#fcfcfc'); }
      if (fc.beard) R(x + 8, y + 21, 16, 6, fc.beard);
      if (!fc.beak) { if (fr === 1) R(x + 13, y + 21, 6, 3, '#5c0000'); else R(x + 13, y + 22, 6, 1, fc.mouth || '#7c0800'); }
      if (fc.shirt) R(x + 4, y + 27, 24, 4, fc.shirt);
    });
  }
  // which portrait frame to show: talking alternates 0/1, idle blinks (frame 2) now and then
  function faceFrame(name, talking, t, seed) {
    var inf = artInfo(name), n = inf ? (inf.frames || 1) : 3;
    t = t || 0;
    if (talking && n >= 2) return Math.floor(t * 9) % 2;
    if (n >= 3) { var ph = (t + (seed || 0) * 0.61) % 3.3; if (ph > 3.16) return 2; }
    return 0;
  }
  ui.faceFrame = faceFrame;
  // NES-style portrait slot (white rim) with a talking face
  function faceSlot(ctx, name, x, y, talking, seed) {
    R(x - 1, y - 1, 34, 34, C.white); R(x, y, 32, 32, '#000');
    portrait(ctx, name, x, y, { frame: faceFrame(name, talking, DCW.t || 0, seed) });
  }
  // draw with DCW.rect/DCW.text into another context
  function withCtx(ctx, fn) {
    var old = DCW.ctx; DCW.ctx = ctx;
    try { fn(); } finally { DCW.ctx = old; }
  }
  // backgrounds / panels / wobble from art.js, if it has them
  function hasBg(theme) {
    var a = DCW.art; if (!theme || !a || typeof a.background !== 'function') return false;
    if (typeof a.hasBackground === 'function') { try { return !!a.hasBackground(theme); } catch (e) { return false; } }
    var lists = [a.bgThemes, a.backgrounds, a.backdrops, a.themes];
    for (var i = 0; i < lists.length; i++) if (Array.isArray(lists[i]) && lists[i].indexOf(theme) >= 0) return true;
    return false;
  }
  function drawBg(ctx, theme, camX, camY, opts) {
    if (!hasBg(theme)) return false;
    try { DCW.art.background(ctx, theme, camX || 0, camY || 0, opts || { t: DCW.t || 0 }); return true; } catch (e) { return false; }
  }
  function hasPanel(id) {
    var a = DCW.art; if (!id || !a || typeof a.panel !== 'function') return false;
    if (typeof a.hasPanel === 'function') { try { return !!a.hasPanel(id); } catch (e) { return false; } }
    return true;
  }
  function drawPanel(ctx, id, x, y, t) { if (!hasPanel(id)) return false; try { DCW.art.panel(ctx, id, x, y, t || 0); return true; } catch (e) { return false; } }
  var wobC = null;
  function wobble(ctx, y0, y1, amp, freq, t) {
    if (!amp) return;
    if (DCW.art && typeof DCW.art.wobble === 'function') { try { DCW.art.wobble(ctx, y0, y1, amp, freq, t); return; } catch (e) { /* fall back */ } }
    var cv = ctx.canvas; if (!cv) return;
    var sc = cv.width / W;
    y0 = Math.max(0, Math.floor(y0)); y1 = Math.min(H, Math.ceil(y1)); var hh = y1 - y0; if (hh <= 0) return;
    if (!wobC) wobC = document.createElement('canvas');
    if (wobC.width !== cv.width || wobC.height !== Math.ceil(hh * sc)) { wobC.width = cv.width; wobC.height = Math.ceil(hh * sc); }
    var g = wobC.getContext('2d'); g.clearRect(0, 0, wobC.width, wobC.height); g.drawImage(cv, 0, y0 * sc, cv.width, hh * sc, 0, 0, cv.width, hh * sc);
    ctx.save(); ctx.setTransform(sc, 0, 0, sc, 0, 0); ctx.imageSmoothingEnabled = false;
    for (var y = y0; y < y1; y++) {
      var off = Math.round(Math.sin(y * (freq || 0.15) + (t || 0) * 5) * amp);
      if (off) ctx.drawImage(wobC, 0, (y - y0) * sc, cv.width, sc, off, y, W, 1);
    }
    ctx.restore();
  }
  ui.wobble = wobble;
  // small 8x8 icons (art.icon if it knows the name, else built-in bitmaps)
  var ICON_PAL = { k: '#000000', r: '#f83800', R: '#a81000', w: '#fcfcfc', y: '#f8b800', Y: '#ac7c00', G: '#3c3c3c', g: '#5c5c5c', o: '#fca044', p: '#d800cc', P: '#881488', n: '#a85010', N: '#503000', b: '#3cbcfc', B: '#0058f8', e: '#58d854', E: '#00a800', l: '#bcbcbc', c: '#a4e4fc', s: '#f8d878' };
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
    lock: ['..kkk...', '.kgGgk..', '.kg.gk..', 'kkkkkkk.', 'kyyyyyk.', 'kyykyyk.', 'kyyyyyk.', 'kkkkkkk.'],
    sun: ['...y....', '.y.k.y..', '..kok...', 'ykoyoky.', '..kok...', '.y.k.y..', '...y....', '........'],
    moon: ['..kkk...', '.kcck...', 'kcck....', 'kcck....', 'kccck...', '.kccckk.', '..kkk...', '........'],
    jug: ['..ko....', '..kr....', '.kkkk...', 'kNnnnk..', 'knnwnnk.', 'knnnnNk.', 'kNnnnNk.', '.kkkkk..'],
    hob: ['....o...', '...k....', '..kkk...', '.kgllk..', 'kgwlllk.', 'kglllgk.', '.kgggk..', '..kkk...'],
    dyn: ['......o.', '.....k..', '..kkkk..', '.krrrrk.', '.kRwrrk.', '.krrrrk.', '.krrrRk.', '..kkkk..'],
    smoke: ['..lll...', '.lwwll..', 'lwwlll..', '.llll...', '..kkk...', '.kGGGk..', '.kGGGk..', '..kkk...'],
    moonshine: ['..kkk...', '..kNk...', '.kkkkk..', 'kwwwwwk.', 'kwkwkwk.', 'kwwwwwk.', 'kwwwwwk.', '.kkkkk..'],
    clock: ['..kkkk..', '.kwwwwk.', 'kwwkwwwk', 'kwwkwwwk', 'kwwkkkwk', 'kwwwwwwk', '.kwwwwk.', '..kkkk..'],
    quest: ['.kkkkkk.', 'kswssssk', 'ksssssk.', '.kswsk..', '.ksssk..', 'ksswsssk', 'kssssssk', '.kkkkkk.'],
    map: ['kkkkkkkk', 'kssEsssk', 'ksEEssrk', 'ksssEssk', 'kssssEEk', 'krsssssk', 'kssssssk', 'kkkkkkkk'],
    ticket: ['........', 'kkkkkkkk', 'kyyyyyyk', '.yRyyRy.', '.yyyyyy.', 'kyyyyyyk', 'kkkkkkkk', '........'],
    bed: ['........', 'k.......', 'kww.....', 'kwwrrrrk', 'krrrrrrk', 'kkkkkkkk', 'k......k', '........'],
    bag: ['..kkk...', '.k...k..', 'kkkkkkk.', 'knnnnnk.', 'knnynnk.', 'knnnnnk.', 'kkkkkkk.', '........'],
    glass: ['kkkkkkk.', 'kpppppk.', '.kpppk..', '..kpk...', '...k....', '...k....', '.kkkkk..', '........'],
    stairs: ['......kk', '....kkwk', '....kwlk', '..kkwllk', '..kwlllk', 'kkwllllk', 'kwlllllk', 'kkkkkkkk'],
    check: ['........', '......ke', '.....kek', 'ke..kek.', 'keekek..', '.keek...', '..kk....', '........'],
    gear: ['..k.k...', '.kllllk.', 'klkkklk.', '.lk.kl..', 'klkkklk.', '.kllllk.', '..k.k...', '........'],
    door: ['.kkkkk..', 'knnnnnk.', 'knnnnnk.', 'knnnnyk.', 'knnnnnk.', 'knnnnnk.', 'knnnnnk.', 'kkkkkkk.']
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
  var ICON_ALIAS = { scratch_ticket: 'ticket', big_top_ticket: 'ticket', gate_pass: 'ticket', custard: 'ticket', potion_item: 'potion', snack: 'heart', dynamite: 'dyn' };
  function icon(ctx, name, x, y, o) {
    if (!name) return;
    x = Math.round(x); y = Math.round(y);
    var a = DCW.art;
    if (a && typeof a.icon === 'function' && (hasArt('icon_' + name) || (hasArt(name) && !ICONS[name] && /^(icon_|gear_|[a-z]+$)/.test(name) && (artInfo(name) || {}).w <= 10))) {
      try { a.icon(ctx, name, x, y, o); return; } catch (e) { /* fall back */ }
    }
    var c = iconCanvas(name) || iconCanvas(ICON_ALIAS[name]) || (/^gear_/.test(name) ? iconCanvas('gear') : null);
    if (!c) { var d = itemDef(name); if (d && d.icon && d.icon !== name) { icon(ctx, d.icon, x, y, o); return; } c = iconCanvas(d && d.kind === 'key' ? 'key' : d && d.kind === 'material' ? 'moonshine' : null); }
    if (c) { if (o && o.scale > 1) ctx.drawImage(c, 0, 0, 8, 8, x, y, 8 * o.scale, 8 * o.scale); else ctx.drawImage(c, x, y); }
    else T('●', x + 1, y, C.gray, { shadow: null });
  }
  function itemIcon(id) { var d = itemDef(id); return (d && d.icon) || id; }
  var BOX_FB = { bronze: '#c87838', silver: '#bcbcbc', gold: '#f8b800', platinum: '#a4e4fc', legendary: '#9878f8', fan: '#f878f8', boss: '#e40058', celestial: '#00fcfc' };
  function boxColor(tier) {
    var bt = D('boxTiers'); if (bt && bt[tier] && bt[tier].color) return bt[tier].color;
    if (DCW.art && typeof DCW.art.boxColor === 'function') { try { var c = DCW.art.boxColor(tier); if (c) return c; } catch (e) { /* fall back */ } }
    return BOX_FB[tier] || C.gray;
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
    str: { name: 'STRENGTH', short: 'STR', icon: 'sword', desc: 'PUNCH AND KICK DAMAGE.' },
    con: { name: 'CONSTITUTION', short: 'CON', icon: 'heart', desc: '+2 MAX HP A POINT. DIE LESS.' },
    dex: { name: 'DEXTERITY', short: 'DEX', icon: 'boot', desc: 'CRITS AND SPEED. RUN AWAY FASTER.' },
    int: { name: 'INTELLIGENCE', short: 'INT', icon: 'brain', desc: 'DONUT\'S MISSILES. SHE\'S THE BRAINS.' }
  };
  function xpNeed(level) {
    var r = G('xpNeed', level); if (typeof r === 'number' && r > 0) return r;
    var L = Math.max(1, (level || 13) - 12); return Math.round(25 * Math.pow(L, 1.5));
  }
  function pStats() {
    var s = G('playerStats');
    if (s && typeof s === 'object') return s;
    var run = getRun() || {}; var st = run.stats || { str: 5, con: 4, dex: 4, int: 4 }; var L = Math.max(1, (run.level || 13) - 12);
    var b = run.bonus || {}, fb = !!(run.flags && run.flags.freeballing);
    var dmg = 3 + (st.str - 5) + Math.floor((L - 1) / 2);
    return { maxHp: 16 + (st.con - 4) * 2 + (L - 1) * 2 + (b.hp || 0), dmg: dmg, kickDmg: Math.round(dmg * 1.5) * (fb ? 2 : 1),
      crit: 0.05 + (st.dex - 4) * 0.02, speedMul: 1 + (st.dex - 4) * 0.03, def: 0,
      hobDmg: 10 + L * 2, dynDmg: 22 + L * 3, jugDmg: 8 + L * 2, missileDmg: 3 + Math.floor(st.int / 2) + Math.floor((L - 1) / 2),
      biteDmg: 2 + L, freeballing: fb, party: partyList() };
  }
  function titleFor(views) {
    var t = D('titles'), best = null;
    if (Array.isArray(t)) t.forEach(function (e) { if (e && views >= (e.views || 0) && (!best || (e.views || 0) >= (best.views || 0))) best = e; });
    return best ? best.name : 'NOBODY';
  }
  function skinDef(id) { var s = D('skins'); return (s && s[id]) || null; }
  function skinName(id) { var d = skinDef(id); return (d && d.name) || String(id || '').replace('carl_', '').replace(/_/g, ' ').toUpperCase(); }
  var PAL_NAMES = { donut: 'PRINCESS DONUT', mongo: 'MONGO', katia: 'KATIA GRIM', zev: 'ZEV' };
  function compDef(id) { var s = D('companions'); return (s && s[id]) || null; }
  function compName(id) { var d = compDef(id); return (d && d.name) || PAL_NAMES[id] || String(id || '').toUpperCase(); }
  function compSprite(id) { var d = compDef(id); var s = (d && d.sprite) || id || 'donut'; if (s === 'mongo' && flag('mongo_big') && hasArt('mongo_big_idle')) s = 'mongo_big'; return s; }
  function inSafe() {
    if (hasG('inSafeRoom')) return !!G('inSafeRoom');
    return !!(ui.scenes && (DCW.scene === ui.scenes.inn || DCW.scene === ui.scenes.safeRoom));
  }
  // perk objects (gear + skins) -> readable text. Keys: Book One's (hp dmg kick stomp def crit speed regen
  // missile missileCd special stun bombs gold views doubleJump) + str con dex int (flat stats) + bite (Mongo)
  function pctOf(v) { v = +v; return Math.round((Math.abs(v) < 1 ? v : v - 1) * 100); }
  function sgn(v) { v = +v || 0; return (v < 0 ? '-' : '+') + Math.abs(v); }
  function perkLines(p) {
    if (!p || typeof p !== 'object') return [];
    var out = [];
    STATS.forEach(function (k) { if (p[k]) out.push(sgn(p[k]) + ' ' + STAT_INFO[k].name); });
    if (p.hp) out.push(sgn(p.hp) + ' MAX HP');
    if (p.dmg) out.push(sgn(p.dmg) + ' PUNCH DAMAGE');
    if (p.kick) out.push(sgn(p.kick) + ' KICK DAMAGE');
    if (p.stomp) out.push('+' + pctOf(p.stomp) + '% STOMP DAMAGE');
    if (p.def) out.push(sgn(p.def) + ' DEFENSE');
    if (p.crit) out.push('+' + pctOf(p.crit) + '% CRIT');
    if (p.speed) out.push('+' + pctOf(p.speed) + '% SPEED');
    if (p.regen) out.push('REGEN +' + p.regen + ' HP OVER TIME');
    if (p.missile) out.push(sgn(p.missile) + ' MISSILE DAMAGE');
    if (p.missileCd) out.push('FASTER MISSILES (-' + Math.abs(p.missileCd) + 'S)');
    if (p.special) out.push('+' + (Math.abs(p.special) < 1 ? pctOf(p.special) : Math.round(p.special)) + '% SPECIAL FILL');
    if (p.stun) out.push(pctOf(p.stun) + '% STUN CHANCE');
    if (p.bite) out.push(sgn(p.bite) + ' MONGO BITE DAMAGE');
    if (p.bombs) out.push(sgn(p.bombs) + ' EXPLOSIVES');
    if (p.gold) out.push('+' + pctOf(p.gold) + '% GOLD');
    if (p.views) out.push('+' + pctOf(p.views) + '% VIEWS');
    if (p.doubleJump) out.push('DOUBLE JUMP');
    return out;
  }
  function perkText(p) { return perkLines(p).join(', '); }
  // one short line for lists: "+4 HP  +2 DMG  REGEN"
  function perkShort(p) {
    if (!p || typeof p !== 'object') return '';
    var out = [];
    if (p.hp) out.push(sgn(p.hp) + ' HP');
    if (p.dmg) out.push(sgn(p.dmg) + ' DMG');
    if (p.kick) out.push(sgn(p.kick) + ' KICK');
    STATS.forEach(function (k) { if (p[k]) out.push(sgn(p[k]) + ' ' + STAT_INFO[k].short); });
    if (p.def) out.push(sgn(p.def) + ' DEF');
    if (p.crit) out.push('+' + pctOf(p.crit) + '% CRIT');
    if (p.stomp) out.push('STOMP+');
    if (p.speed) out.push('SPEED+');
    if (p.regen) out.push('REGEN');
    if (p.stun) out.push('STUN');
    if (p.missile) out.push(sgn(p.missile) + ' MISSILE');
    if (p.missileCd) out.push('FAST MISSILE');
    if (p.special) out.push('SPECIAL+');
    if (p.bite) out.push(sgn(p.bite) + ' BITE');
    if (p.bombs) out.push(sgn(p.bombs) + ' BOOM');
    if (p.gold) out.push('GOLD+');
    if (p.views) out.push('VIEWS+');
    if (p.doubleJump) out.push('2X JUMP');
    return out.join('  ');
  }
  // fit a perkShort line into px: drop whole entries from the end and mark the cut with "+"
  function fitPerks(s, px) {
    if (tw(s) <= px) return s;
    var parts = s.split('  ');
    while (parts.length > 1 && tw(parts.join('  ') + ' +') > px) parts.pop();
    var r = parts.join('  ') + ' +';
    return tw(r) <= px ? r : fitText(s, px);
  }
  function rewardInfo(r) {
    if (r === null || r === undefined) return { text: 'NOTHING. WOW.', icon: 'skull', color: C.dgray };
    if (typeof r === 'string') return { text: up(r), icon: 'star', color: C.white };
    var n;
    switch (r.kind) {
      case 'gold': return { text: '+' + (r.amount || 0) + ' GOLD' + (r.converted ? ' (DUPE)' : ''), icon: 'coin', color: C.gold };
      case 'item':
        n = r.count || r.n || 1;
        var id = r.id === 'bomb' ? 'dyn' : r.id;
        return { text: '+' + n + ' ' + itemName(id), icon: itemIcon(id), color: C.white };
      case 'skin': return { text: (r.isNew ? 'NEW SKIN: ' : 'SKIN: ') + skinName(r.id), icon: 'star', color: r.isNew ? C.yellow : C.gray, unlock: !!r.isNew };
      case 'companion': return { text: (r.isNew ? 'NEW PAL: ' : 'PAL: ') + compName(r.id), icon: 'star', color: r.isNew ? C.yellow : C.gray };
      case 'stat': var si = STAT_INFO[r.stat] || { short: String(r.stat || '?').toUpperCase(), icon: 'star' }; return { text: '+' + (r.amount || 1) + ' ' + si.short, icon: si.icon, color: C.green };
      case 'xp': return { text: '+' + (r.amount || 0) + ' XP', icon: 'star', color: C.green };
      case 'hp': return { text: '+' + (r.amount || 1) + ' MAX HP', icon: 'heart', color: C.red };
      case 'box': return { text: tierName(r.tier), icon: 'box', color: boxColor(r.tier) };
      case 'views': return { text: '+' + fmtNum(r.amount) + ' VIEWS' + (r.note ? ' (' + up(r.note) + ')' : ''), icon: 'eye', color: C.pink };
      case 'revival': n = r.count || 1; return { text: '+' + n + ' REVIVAL' + (n > 1 ? 'S' : ''), icon: 'heart', color: C.pink };
      case 'flag': return { text: up(r.text || r.name || 'SOMETHING HAPPENED'), icon: 'star', color: C.yellow };
      case 'nothing': return { text: up(r.text || 'ABSOLUTELY NOTHING'), icon: 'skull', color: C.dgray };
      case 'title': return { text: 'TITLE: ' + up(r.name || r.id), icon: 'star', color: C.pink };
      case 'gear': return { text: 'GEAR: ' + gearName(r.id), icon: gearIcon(r.id), gear: true, color: C.green };
      default: return { text: up(r.text || String(r.kind || '?')), icon: r.icon || 'star', color: C.white };
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
     DIALOG (say) with talking portraits
     ================================================================ */
  var WHO_PORTRAIT = {
    'SYSTEM AI': 'p_ai', 'AI': 'p_ai', 'THE AI': 'p_ai', 'SYSTEM': 'p_ai', 'ANNOUNCER': 'p_ai',
    'CARL': 'p_carl', 'DONUT': 'p_donut', 'PRINCESS DONUT': 'p_donut', 'MONGO': 'p_mongo',
    'MORDECAI': 'p_mordecai', 'KATIA': 'p_katia', 'KATIA GRIM': 'p_katia',
    'SIGNET': 'p_signet', 'TSARINA SIGNET': 'p_signet', 'TSARINA': 'p_signet',
    'GRIMALDI': 'p_grimaldi', 'RINGMASTER GRIMALDI': 'p_grimaldi', 'RINGMASTER': 'p_grimaldi',
    'APOLLON': 'p_apollon', 'APOLLON THE MIGHTY': 'p_apollon',
    'CLAMMY': 'p_clammy', 'CLAMMY THE CLOWN': 'p_clammy',
    'HEATHER': 'p_heather', 'HEATHER THE BEAR': 'p_heather',
    'GORDO': 'p_gordo', 'FITZ': 'p_fitz', 'CLARABELLE': 'p_clarabelle', 'QUINT': 'p_quint',
    'PUSTULE': 'p_pustule', 'GUMGUM': 'p_gumgum', 'GUM GUM': 'p_gumgum',
    'VINCENTE': 'p_vincente', 'QUILL': 'p_quill', 'MISS QUILL': 'p_quill',
    'BURGUNDY': 'p_burgundy', 'REMEX': 'p_remex',
    'BAUTISTA': 'p_bautista', 'DANIEL BAUTISTA': 'p_bautista', 'DANIEL BAUTISTA 2': 'p_bautista',
    'HEKLA': 'p_hekla', 'RIPPER': 'p_ripper', 'RIPPER WONTON': 'p_ripper',
    'ZEV': 'p_zev', 'ODETTE': 'p_odette', 'LUCIA': 'p_lucia', 'LUCIA MAR': 'p_lucia',
    'EUNICE': 'p_eunice', 'EDGE DANCER': 'p_edge_dancer', 'EDGE-DANCER': 'p_edge_dancer', 'TALON': 'p_talon', 'LUCKY': 'p_lucky',
    'MANASA': 'p_manasa', 'TUCKER': 'p_tucker', "PRINCESS D'NADIA": 'p_dnadia', "D'NADIA": 'p_dnadia', 'DNADIA': 'p_dnadia',
    'FEATHERFALL': 'p_featherfall', 'MAGISTRATE FEATHERFALL': 'p_featherfall', 'BOPCA': 'p_bopca',
    'RICKY JOE': 'p_ricky_joe', 'TALON STRONG': 'p_talon', 'TERROR THE CLOWN': 'p_terror_big'
  };
  ui.WHO_PORTRAIT = WHO_PORTRAIT;
  function portraitFor(who) {
    if (who === null || who === undefined || who === '') return null;
    var k = up(who).trim();
    if (WHO_PORTRAIT[k]) return WHO_PORTRAIT[k];
    var k2 = k.replace(/^THE /, '');
    if (WHO_PORTRAIT[k2]) return WHO_PORTRAIT[k2];
    var slug = k2.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
    if (!slug) return null;
    if (hasArt('p_' + slug)) return 'p_' + slug;
    var first = slug.split('_')[0];
    if (first && hasArt('p_' + first)) return 'p_' + first;
    return 'p_' + slug; // the fallback face is drawn for unknown names
  }
  ui.portraitFor = portraitFor;
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
      else if (o.who !== undefined) por = portraitFor(o.who);
      else if (opts.portrait !== undefined) por = opts.portrait;
      else por = portraitFor(who) || 'p_ai';
      var wl = wrap(up(o.text === undefined ? '' : o.text), por ? 256 : 296);
      for (var i = 0; i < wl.length; i += 4) pages.push({ who: who ? up(who) : '', portrait: por, lines: wl.slice(i, i + 4), color: o.color, seed: pages.length });
    });
    return pages;
  }
  function pageLen(p) { var n = 0; p.lines.forEach(function (l) { n += l.length; }); return n; }
  function drawDialogBox(ctx, page, shown, pos, done) {
    var y = pos === 'top' ? 18 : 126, x = 4, w = 312, h = 50;
    DCW.box(x, y, w, h);
    var tx = x + 8;
    if (page.portrait) { faceSlot(ctx, page.portrait, x + 6, y + 9, !done, page.seed); tx = x + 44; }
    var left = shown;
    for (var i = 0; i < page.lines.length && left > 0; i++) {
      var s = page.lines[i].slice(0, Math.max(0, Math.floor(left)));
      T(s, tx, y + 7 + i * 10, page.color || C.white);
      left -= page.lines[i].length;
    }
    if (page.who) {
      var nw = tw(page.who) + 10;
      DCW.box(x + 6, y - 9, nw, 12, { fill: page.portrait === 'p_ai' ? '#5c007c' : '#a81000' });
      T(page.who, x + 11, y - 7, C.white);
    }
    if (done && blink(2.5)) T('▼', x + w - 12, y + h - 10, C.gold);
  }
  // opts: { onDone, onSkip (START pressed; else START finishes like onDone), pos:'top'|'bottom', speed, who, portrait, skippable }
  ui.say = function (lines, opts) {
    opts = opts || {};
    var pages = paginate(lines, opts);
    if (!pages.length) { if (opts.onDone) opts.onDone(); return null; }
    var m = { kind: 'say', pages: pages, i: 0, shown: 0, blip: 0 };
    function finish(skipped) {
      if (m.done) return; m.done = true; close(m);
      if (skipped && opts.onSkip) opts.onSkip(); else if (opts.onDone) opts.onDone();
    }
    m.update = function (dt) {
      var p = m.pages[m.i], total = pageLen(p);
      if (m.shown < total) {
        var before = Math.floor(m.shown);
        m.shown = Math.min(total, m.shown + dt * (opts.speed || 55));
        var now = Math.floor(m.shown);
        if (now !== before) { m.blip += now - before; if (m.blip >= 3) { m.blip = 0; sfx('text_blip'); } }
      }
      if (P('start') && opts.skippable !== false && m.t > 0.15) { finish(true); return; }
      if ((P('confirm') || P('back')) && m.t > 0.08) {
        if (m.shown < total) m.shown = total;
        else { m.i++; m.shown = 0; if (m.i >= m.pages.length) finish(false); }
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
    var t = { text: up(text), title: o.title ? up(o.title) : (ach ? 'NEW ACHIEVEMENT!' : ''),
      icon: o.icon || (ach ? 'star' : null), color: o.color || (ach ? C.gold : C.white), time: o.time || (ach ? 4 : 2.6),
      sub: o.sub || o.desc ? up(o.sub || o.desc) : '', ach: ach, t: 0, y: null };
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
    banner = { text: up(text), sub: o.sub ? up(o.sub) : '', color: o.color || C.gold, time: o.time || 2.2, t: 0, y: o.y || 60 };
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
  function rightOf(it) { var r = typeof it.right === 'function' ? it.right() : it.right; return r === undefined || r === null ? '' : String(r); }
  // items [{label, action(m), disabled, why, hint, right, rightColor, color, keep, icon}], opts {title, titleColor, w, x, y, keep, cancel, onBack, startCloses, kind, fill, border, dim, portrait}
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
      var tl = opts.title ? wrap(up(opts.title), maxTitle) : [];
      var iw = 0; its.forEach(function (it) { var rt = rightOf(it); iw = Math.max(iw, tw(labelOf(it)) + (rt ? tw(rt) + 12 : 0) + (it.icon ? 11 : 0)); });
      var w = opts.w || Math.max(80, iw + 30, tl.reduce(function (a, l) { return Math.max(a, tw(l) + 16); }, 0));
      var hint = (m.msgT > 0 && m.msg) ? m.msg : (its[m.sel] && its[m.sel].hint) || '';
      var hl = hint ? wrap(up(hint), w - 12).slice(0, 2) : [];
      var h = 8 + tl.length * 10 + (tl.length ? 4 : 0) + its.length * 12 + (hl.length ? hl.length * 10 + 4 : 0);
      var x = opts.x !== undefined ? opts.x : Math.round(160 - w / 2), y = opts.y !== undefined ? opts.y : Math.round(90 - h / 2);
      DCW.box(x, y, w, h, { fill: opts.fill, border: opts.border });
      var yy = y + 5;
      tl.forEach(function (l) { T(l, x + w / 2, yy, opts.titleColor || C.gold, { align: 'center' }); yy += 10; });
      if (tl.length) { R(x + 6, yy, w - 12, 1, '#2c3c7c'); yy += 4; }
      its.forEach(function (it, i) {
        var col = it.disabled ? C.dgray : (i === m.sel ? (it.color || C.white) : (it.color || C.gray));
        if (i === m.sel) cursor(x + 6, yy + 1);
        var lx = x + 16;
        if (it.icon) { icon(ctx, it.icon, lx, yy); lx += 11; }
        T(labelOf(it), lx, yy + 1, col);
        var rt = rightOf(it); if (rt) T(rt, x + w - 8, yy + 1, it.disabled ? C.dgray : (it.rightColor || C.gold), { align: 'right' });
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
     h = { hp, maxHp, special 0..1, specialLocked, potions, gold, level, xpFrac, views, combo,
           player:'carl'|'mongo', explosive:'jug'|{id,count}|null (default run.selected), explosiveCount,
           clock: true(default)|false|{label,night}, objective: true|'text'|{text} (streets),
           party: true|['donut','mongo']|[{id, state:'ok'|'stunned'|'down'|'away'}],
           timer: seconds|{t, label, warn, color}, meters: [{label, value 0..1, color, text}],
           bossHp 0..1|null, bossName, bossPhases (count), bossPhase (0-based index; else read from
           DCW.stage.state.boss.phases/.phase), time|null, par|null (book 1), bombs (book 1) }
     ================================================================ */
  var hudS = { combo: 0, pop: 0, trail: null, bossTrail: null, bossShown: null, bossRefill: 0, bossPh: null, bossPhT: 0, lastT: 0, sel: null, selT: 0 };
  var EXPLOSIVES = ['jug', 'hob', 'dyn', 'smoke'];
  ui.EXPLOSIVES = EXPLOSIVES;
  function hudExplosive(h) {
    if (h.explosive === null || h.explosive === false) return null;
    var id, n;
    if (h.explosive && typeof h.explosive === 'object') { id = h.explosive.id; n = h.explosive.count !== undefined ? h.explosive.count : h.explosive.n; }
    else if (typeof h.explosive === 'string') id = h.explosive;
    else if (h.bombs !== undefined && !getRun()) return { id: 'bomb', icon: 'bomb', n: h.bombs };
    if (!id) { var r = getRun(); id = (r && r.selected) || 'jug'; }
    if (n === undefined) n = h.explosiveCount !== undefined ? h.explosiveCount : itemCount(id);
    return { id: id, icon: itemIcon(id), n: n };
  }
  ui.drawHUD = function (ctx, h) {
    h = h || {};
    var now = DCW.t || 0, dt = clamp(now - hudS.lastT, 0, 0.1); hudS.lastT = now;
    ctx.globalAlpha = 0.82; R(0, 0, W, 13, '#000'); ctx.globalAlpha = 1;
    R(0, 13, W, 1, '#1c1c3c');
    // player mini portrait
    var swapMongo = h.swap === 'mongo' || (h.explosive === null && h.companion === 'mongo');
    var who = h.player || (swapMongo ? 'mongo' : 'carl');
    R(0, 0, 14, 14, '#000'); R(0, 0, 14, 1, C.dgray); R(0, 13, 14, 1, C.dgray); R(0, 0, 1, 14, C.dgray); R(13, 0, 1, 14, C.dgray);
    miniPortrait(ctx, 'p_' + who, 1, 1);
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
      if (h.specialLocked) DCW.bar(bx, 9, bw, 2, 1, blink(3) ? C.ddgray : '#202020', '#200828');
      else { var full = h.special >= 1; DCW.bar(bx, 9, bw, 2, h.special, full ? (blink(6) ? C.white : C.yellow) : C.purple, '#200828'); }
    }
    T(Math.ceil(hp) + '/' + mx, 77, 3, low ? C.red : C.white);
    var x = 113;
    // selected explosive
    var ex = hudExplosive(h);
    if (ex) {
      if (hudS.sel !== null && hudS.sel !== ex.id) hudS.selT = 1.3;
      hudS.sel = ex.id;
      if (hudS.selT > 0) { hudS.selT -= dt; if (blink(10)) R(x - 1, 1, 10, 10, C.white); }
      icon(ctx, ex.icon, x, 2);
      T(ex.n, x + 9, 3, ex.n > 0 ? C.white : C.red);
    }
    x += 22;
    if (h.potions !== null && !(h.potions === undefined && swapMongo)) { icon(ctx, 'potion', x, 2); T(h.potions === undefined ? itemCount('potion') : h.potions, x + 9, 3, C.white); }
    x += 22;
    icon(ctx, 'coin', x, 2); T(fitText(h.gold || 0, 30), x + 9, 3, C.gold); x += 44;
    T('LV' + (h.level || 13), x, 2, C.green);
    DCW.bar(x, 11, 24, 1, h.xpFrac || 0, C.green, '#002800');
    x += 30;
    icon(ctx, 'eye', x, 2); T(fitText(fmtNum(h.views || 0), 24), x + 9, 3, C.pink);
    // clock (8-day floor timer) with sun/moon
    var ck = (h.clock === false || h.clock === null) ? null : (h.clock && typeof h.clock === 'object') ? h.clock : clockInfo();
    if (ck) {
      var lab = String(ck.label || ''), lw = tw(lab), urgent = ck.hoursLeft !== undefined && ck.hoursLeft <= 24;
      T(lab, 318, 3, urgent ? (blink(2) ? C.red : C.orange) : C.white, { align: 'right' });
      icon(ctx, ck.night ? 'moon' : 'sun', 318 - lw - 10, 2);
    } else if (h.time !== undefined && h.time !== null) { // book 1 style level timer
      var ts = fmtTime(h.time), over = h.par && h.time > h.par;
      T(ts, 318, 2, over ? C.red : C.white, { align: 'right' });
      if (h.par) DCW.bar(318 - tw(ts), 11, tw(ts), 1, clamp(h.time / h.par, 0, 1), over ? C.red : C.green, '#202020');
    }
    // ---- second row ----
    var party = h.party === true ? partyList() : (Array.isArray(h.party) ? h.party : null);
    var timer = h.timer;
    if (timer !== undefined && timer !== null && typeof timer !== 'object') timer = { t: +timer, label: h.timerLabel };
    var obj = h.objective === true ? objectiveInfo() : h.objective;
    if (obj && typeof obj === 'object') obj = obj.text;
    var partyW = party && party.length ? party.length * 13 + 4 : 0;
    if (obj) {
      var maxW = timer ? 112 : 312 - partyW - 14;
      var os = fitText(up(obj), maxW - 12);
      ctx.globalAlpha = 0.62; R(0, 14, tw(os) + 15, 11, '#000'); ctx.globalAlpha = 1;
      T('▶', 3, 16, C.gold, { shadow: null }); T(os, 11, 16, C.white);
    }
    if (party && party.length) {
      var px0 = 318 - party.length * 13 + 1;
      party.forEach(function (p, i) {
        var id = typeof p === 'string' ? p : (p && p.id), st = (p && p.state) || 'ok';
        if (!id) return;
        var ix = px0 + i * 13, iy = 15;
        R(ix - 1, iy - 1, 14, 14, '#000'); R(ix - 1, iy - 1, 14, 1, C.ddgray); R(ix - 1, iy + 12, 14, 1, C.ddgray);
        miniPortrait(ctx, 'p_' + id, ix, iy);
        if (st !== 'ok') { ctx.globalAlpha = 0.6; R(ix, iy, 12, 12, '#000'); ctx.globalAlpha = 1; T(st === 'stunned' ? 'Z' : st === 'away' ? '?' : '×', ix + 3, iy + 3, st === 'stunned' ? (blink(4) ? C.white : C.gray) : C.red, { shadow: null }); }
      });
    }
    if (timer && timer.t !== undefined && !isNaN(timer.t)) {
      var secs = Math.max(0, timer.t), urgent = typeof timer.warn === 'boolean' ? timer.warn : secs <= (timer.warn === undefined ? 30 : timer.warn);
      var tcol = timer.color || (urgent ? (blink(4) ? C.red : C.white) : C.white);
      T(fmtTime(Math.ceil(secs)), 160, 16, tcol, { align: 'center', scale: 2 });
      if (timer.label) T(up(timer.label), 160, 32, urgent ? C.red : C.gray, { align: 'center' });
    }
    var meters = Array.isArray(h.meters) ? h.meters : (h.meter ? [h.meter] : []);
    var my = party && party.length ? 30 : 16;
    meters.forEach(function (mt, i) {
      if (!mt) return;
      var v = clamp(+(mt.value !== undefined ? mt.value : mt.frac) || 0, 0, 1), yy = my + i * 10;
      var mc = mt.color || C.green, lab2 = up(mt.label || '');
      DCW.bar(264, yy + 2, 52, 4, v, mt.flash && blink(5) ? C.white : mc, '#202020');
      T(lab2, 260, yy, C.white, { align: 'right' });
      if (mt.text !== undefined) T(up(mt.text), 290, yy + 7, C.gray, { align: 'center', shadow: null });
    });
    // street law + incubus charm
    var flagY = timer ? 42 : obj ? 27 : 16;
    if (h.wanted) { var wt = 'WANTED! RUN FOR THE RUINS'; DCW.box(160 - tw(wt) / 2 - 5, flagY, tw(wt) + 10, 11, { fill: '#5c0000', border: blink(4) ? C.red : C.gold }); T(wt, 160, flagY + 2, C.white, { align: 'center' }); flagY += 13; }
    if (h.charmed) { var ct = '♥ CHARMED: ◀▶ SWAPPED ♥'; T(ct, 160, flagY + 2, blink(5) ? C.pink : C.purple, { align: 'center' }); }
    // explosive name popup after cycling
    if (ex && hudS.selT > 0) {
      var en = itemName(ex.id) + ' ×' + ex.n, ew = tw(en) + 8;
      var ey = timer ? 52 : 15; DCW.box(108, ey, ew, 11, { fill: '#000' }); T(en, 112, ey + 2, ex.n > 0 ? C.yellow : C.red);
    }
    // combo popup
    var combo = h.combo || 0;
    if (combo > hudS.combo && combo > 1) hudS.pop = 0.18;
    hudS.combo = combo; if (hudS.pop > 0) hudS.pop -= dt;
    if (combo > 1) {
      var cy0 = obj ? 28 : 18;
      var cc = combo >= 25 ? (blink(8) ? C.pink : C.gold) : combo >= 10 ? C.gold : C.white;
      var py = hudS.pop > 0 ? -2 : 0;
      var r1 = T(combo, 6, cy0 + py, cc, { scale: 2 });
      T('HIT', 9 + r1.w, cy0 + py, cc); T('COMBO!', 9 + r1.w, cy0 + 8 + py, combo >= 10 ? C.white : C.gray);
    }
    // boss bar: phase pips; each phase is a full bar that sweeps back up when the next one starts
    if (h.bossHp !== undefined && h.bossHp !== null) {
      var bf = clamp(+h.bossHp || 0, 0, 1), bph = bossPhaseInfo(h);
      if (hudS.bossShown === null) { hudS.bossShown = 0; hudS.bossTrail = 0; hudS.bossRefill = 0; } // first sight: fill in
      if (bph && hudS.bossPh !== null && bph.i > hudS.bossPh) hudS.bossPhT = 1.2; // new phase: its pip flashes
      hudS.bossPh = bph ? bph.i : null;
      if (bf < hudS.bossShown) { hudS.bossShown = bf; hudS.bossRefill = 0; }
      else if (bf > hudS.bossShown + 0.0001) { hudS.bossShown = Math.min(bf, hudS.bossShown + dt * 1.5); hudS.bossRefill = 0.35; hudS.bossTrail = hudS.bossShown; }
      else if (hudS.bossRefill > 0) hudS.bossRefill -= dt;
      if (hudS.bossTrail < hudS.bossShown) hudS.bossTrail = hudS.bossShown; else hudS.bossTrail = Math.max(hudS.bossShown, hudS.bossTrail - dt * 0.35);
      if (hudS.bossPhT > 0) hudS.bossPhT -= dt;
      var shown = hudS.bossShown, filling = hudS.bossRefill > 0;
      ctx.globalAlpha = 0.6; R(0, 160, W, 20, '#000'); ctx.globalAlpha = 1;
      icon(ctx, 'skull', 6, 162);
      var pipW = bph ? bph.n * 8 + 4 : 0;
      T(fitText(up(h.bossName || 'BOSS'), 290 - pipW), 17, 162, C.gold);
      if (bph) {
        for (var pp = 0; pp < bph.n; pp++) {
          var pxp = 312 - (bph.n - pp) * 8 + 2, done = pp < bph.i, curP = pp === bph.i;
          R(pxp - 1, 162, 7, 7, '#000');
          R(pxp, 163, 5, 5, done ? '#3a1020' : curP ? ((hudS.bossPhT > 0 && blink(8)) ? C.white : C.red) : '#a81000');
          if (!done) R(pxp, 163, 5, 1, curP ? '#fc7460' : '#d82800');
        }
      }
      DCW.bar(8, 173, 304, 4, hudS.bossTrail, C.white, '#3a1020');
      var fw = Math.round(304 * shown);
      R(8, 173, fw, 4, '#d82800'); R(8, 173, fw, 1, '#fc7460');
      if (filling && fw > 0) { R(8 + fw - 3, 172, 3, 6, C.white); if (blink(10)) { R(7, 172, 306, 1, C.white); R(7, 177, 306, 1, C.white); } }
    } else { hudS.bossTrail = null; hudS.bossShown = null; hudS.bossPh = null; hudS.bossPhT = 0; }
  };
  // boss phase count + current phase (0-based): hud.bossPhases / hud.bossPhase, else read from the stage's boss
  function bossPhaseInfo(h) {
    var n = +h.bossPhases, i = +h.bossPhase;
    if (!(n > 0)) {
      try {
        var st = DCW.stage, S = st && DCW.scene === st.scene ? st.state : null, B = S && S.boss;
        if (B && Array.isArray(B.phases)) { n = B.phases.length; if (!(i >= 0)) i = +B.phase; }
      } catch (e) { n = 0; }
    }
    if (!(n > 1)) return null;
    return { n: Math.min(8, Math.round(n)), i: clamp(Math.round(i >= 0 ? i : 0), 0, Math.min(8, Math.round(n)) - 1) };
  }
  ui.hudMeters = true; // drawHUD draws h.meters and h.timer (rooms.js / show.js check this)
  // a HUD object built from the run (for scenes that don't track their own numbers)
  ui.hudFromRun = function (extra) {
    var run = getRun() || {}, st = pStats(), lv = run.level || 13;
    var h = { hp: run.hp, maxHp: st.maxHp || run.hp, special: null, potions: run.potions, gold: run.gold,
      level: lv, xpFrac: (run.xp || 0) / xpNeed(lv), views: run.views, combo: 0, bossHp: null, clock: true };
    if (extra) for (var k in extra) h[k] = extra[k];
    return h;
  };

  /* ================================================================
     PAUSE  (RESUME, MAP, QUESTS, CHARACTER, GEAR, INVENTORY, SETTINGS, FLEE, QUIT)
     ================================================================ */
  function toTitle() {
    closeAll();
    var r = tryCall(DCW.game, 'quitToTitle', []);
    if (r === MISSING) DCW.fade(function () { DCW.setScene(ui.scenes.title, {}); });
  }
  ui.toTitle = toTitle;
  function placeName() {
    var run = getRun() || {};
    if (run.levelId) { var lv = levelDef(run.levelId); return up((lv && lv.name) || run.levelId); }
    if (run.inInn) { var inn = (D('inns') || {})[run.inInn]; return up((inn && inn.name) || 'THE INN'); }
    if (run.inClub) { var cl = (D('clubs') || {})[run.inClub]; return up((cl && cl.name) || 'THE DESPERADO CLUB'); }
    var a = areaDef(run.area); return up((a && a.name) || run.area || 'THE OVER CITY');
  }
  function activeQuests() { var r = getRun(); var q = (r && r.quests) || {}; return Object.keys(q).filter(function (k) { return q[k] === 'active'; }).length; }
  ui.openPause = function (o) {
    o = o || {};
    if (ui.isOpen('pause')) return null;
    sfx('pause');
    var m = { kind: 'pause', sel: 0, canFlee: !!o.canFlee };
    function items() {
      var run = getRun();
      return [
        { label: 'RESUME', action: function () { close(m); } },
        { label: 'MAP', action: mapScreen },
        { label: 'QUESTS', action: ui.openQuests, badge: activeQuests() > 0 && !m.seenQuests },
        { label: 'CHARACTER', action: ui.openCharacter, badge: run && run.statPoints > 0 && inSafe() },
        { label: 'GEAR', action: ui.openGear },
        { label: 'INVENTORY', action: ui.openInventory },
        { label: 'SETTINGS', action: ui.openSettings },
        m.canFlee ? { label: 'FLEE', color: C.orange, action: function () {
          ui.confirm('FLEE THIS LEVEL? NO REWARDS, IT COSTS AN HOUR, AND THE AUDIENCE WILL BOO.', function () {
            closeAll(); if (G('fleeLevel') === undefined && !hasG('fleeLevel')) G('fleeStage');
          });
        } } : null,
        { label: 'QUIT TO TITLE', action: function () { ui.confirm('QUIT TO TITLE? YOUR CRAWL IS SAVED.', toTitle); } }
      ].filter(Boolean);
    }
    m.update = function (dt) {
      m.t += dt;
      var its = items();
      listNav(m, its.length, dt);
      if (P('confirm')) { sfx('menu_select'); var it = its[m.sel]; if (it && it.label === 'QUESTS') m.seenQuests = true; if (it && it.action) it.action(); }
      else if ((P('back') || P('start')) && m.t > 0.1) { sfx('menu_back'); close(m); }
      else if (P('select') && m.t > 0.1) { mapScreen(); }
    };
    m.draw = function (ctx) {
      dim(ctx, 0.55);
      var its = items(), run = getRun() || {};
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
      var yy = py + 21, ck = clockInfo();
      if (ck) {
        T('DAY ' + (ck.day || 1), px + 8, yy, C.gold);
        T(hourText(ck), px + pw - 8, yy, ck.night ? C.nblue : C.orange, { align: 'right' });
        icon(ctx, ck.night ? 'moon' : 'sun', px + pw - 8 - tw(hourText(ck)) - 11, yy - 1);
        yy += 10;
        T(ck.label + ' UNTIL COLLAPSE', px + 8, yy, ck.hoursLeft <= 24 ? C.red : C.gray); yy += 11;
      }
      T(fitText(placeName(), pw - 16), px + 8, yy, C.white); yy += 13;
      var st = pStats();
      var rows = [
        ['LEVEL', String(run.level || 13), C.green],
        ['HP', Math.ceil(run.hp || 0) + '/' + (st.maxHp || '?'), C.red],
        ['GOLD', String(run.gold || 0), C.gold],
        ['POTIONS', String(run.potions || 0), C.white],
        ['REVIVALS', String(run.revivals === undefined ? '-' : run.revivals), C.pink]
      ];
      rows.forEach(function (r) { T(r[0], px + 8, yy, C.gray); T(r[1], px + pw - 8, yy, r[2], { align: 'right' }); yy += 10; });
      R(px + 6, py + ph - 37, pw - 12, 1, '#2c3c7c');
      var ob = objectiveInfo();
      T('OBJECTIVE', px + 8, py + ph - 33, C.dgray, { shadow: null });
      wrap(ob ? up(ob.text) : 'SURVIVE. ENTERTAIN. LOOT.', pw - 16).slice(0, 2).forEach(function (l, i) { T(l, px + 8, py + ph - 23 + i * 10, C.yellow); });
    };
    return push(m);
  };

  /* ================================================================
     CHARACTER
     ================================================================ */
  function raceClass() {
    var run = getRun() || {}, cp = D('classPick') || {};
    function nameOf(listKey, id, fb) {
      var l = cp[listKey] || [], e = null;
      l.forEach(function (x) { if (x && (x.id === id || (!id && !x.locked))) e = e || x; });
      return up((e && e.name) || fb);
    }
    return { race: nameOf('carlRaces', run.race, 'PRIMAL'), cls: nameOf('carlClasses', run.klass || run.cls || run['class'], 'COMPENSATED ANARCHIST') };
  }
  ui.openCharacter = function () {
    var m = { kind: 'character', sel: 0, msg: '', msgT: 0, pop: 0, popI: -1 };
    m.update = function (dt) {
      m.t += dt; if (m.msgT > 0) m.msgT -= dt; if (m.pop > 0) m.pop -= dt;
      var run = getRun();
      listNav(m, 4, dt);
      if (P('confirm')) {
        if (!run) { sfx('error'); m.msg = 'NO CRAWL IN PROGRESS.'; m.msgT = 1.6; }
        else if (!inSafe()) { sfx('error'); m.msg = 'STAT POINTS CAN ONLY BE SPENT AT AN INN.'; m.msgT = 1.8; }
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
      var run = getRun() || { level: 13, xp: 0, statPoints: 0, stats: { str: 5, con: 4, dex: 4, int: 4 }, views: 0 };
      var safeNow = inSafe(), t = DCW.t || 0;
      frame(ctx, 'CRAWLER PROFILE', { footer: safeNow ? '↑↓:STAT  ' + bn('confirm') + ':SPEND POINT  ' + bn('back') + ':BACK' : 'SPEND POINTS AT AN INN  ' + bn('back') + ':BACK' });
      // left: portrait column
      DCW.box(10, 22, 110, 70, { fill: '#1c0c34' });
      R(12, 80, 106, 10, '#2c1c4c');
      var fr = Math.floor(t * 2);
      bigSprite(ctx, actorName('carl', 'idle'), 50, 84, { scale: 2, skin: equipped('skin'), frame: fr });
      var party = partyList();
      if (party.indexOf('donut') >= 0 || !party.length) bigSprite(ctx, actorName('donut', 'idle'), 92, 84, { scale: 2, frame: fr, flip: true });
      if (party.indexOf('mongo') >= 0) spr(ctx, actorName(compSprite('mongo'), 'idle'), 22, 88, { frame: fr });
      if (party.indexOf('katia') >= 0) spr(ctx, actorName('katia', 'idle'), 110, 88, { frame: fr, flip: true });
      var lv = run.level || 13, need = xpNeed(lv), rc = raceClass();
      T('LEVEL ' + lv, 12, 97, C.green);
      DCW.bar(12, 107, 106, 3, (run.xp || 0) / need, C.green, '#002800');
      T('XP ' + (run.xp || 0) + '/' + need, 12, 113, C.gray);
      T(fitText(rc.race, 108), 12, 124, C.white);
      wrap(rc.cls, 108).slice(0, 2).forEach(function (l, i) { T(l, 12, 134 + i * 9, C.blue); });
      var ttl = (save().meta && save().meta.legacyTitle) || titleFor(run.views || 0);
      T(fitText(up(ttl), 108), 12, 154, C.pink);
      // right: stats
      var px = 128;
      var pts = run.statPoints || 0;
      T('STAT POINTS: ' + pts, px, 23, pts > 0 ? (blink(2) ? C.gold : C.yellow) : C.dgray);
      STATS.forEach(function (s, i) {
        var yy = 35 + i * 11, inf = STAT_INFO[s];
        if (i === m.sel) cursor(px, yy);
        icon(ctx, inf.icon, px + 9, yy - 1);
        T(inf.short, px + 20, yy, i === m.sel ? C.white : C.gray);
        var v = (run.stats && run.stats[s]) || 0, bonus = (run.bonus && run.bonus[s]) || 0;
        T(v + (bonus ? '+' + bonus : ''), px + 70, yy, m.pop > 0 && m.popI === i ? C.gold : C.white, { align: 'right' });
        if (pts > 0 && safeNow) T('[+]', px + 76, yy, i === m.sel ? C.gold : C.dgray);
      });
      // derived stats
      var st = pStats();
      var d = [
        ['MAX HP', st.maxHp], ['DEFENSE', st.def || 0],
        ['PUNCH', st.dmg], ['KICK', (st.kickDmg === undefined ? '-' : st.kickDmg) + (st.freeballing ? '★' : '')],
        ['CRIT', Math.round((st.crit || 0) * 100) + '%'], ['SPEED', Math.round((st.speedMul || 1) * 100) + '%'],
        ['JUG', st.jugDmg], ['DYNAMITE', st.dynDmg !== undefined ? st.dynDmg : st.bombDmg],
        ['MISSILE', st.missileDmg], ['BITE', (st.biteDmg === undefined ? '-' : st.biteDmg) + (st.mongoBig ? '★' : '')]
      ];
      R(px, 80, 180, 1, '#2c3c7c');
      d.forEach(function (r, i) {
        var cx = px + (i % 2) * 92, cy = 84 + Math.floor(i / 2) * 10;
        T(r[0], cx, cy, C.dgray); T(r[1] === undefined ? '-' : r[1], cx + 84, cy, C.white, { align: 'right' });
      });
      R(px, 135, 180, 1, '#2c3c7c');
      var perks = [];
      if (st.freeballing) perks.push('FREEBALLING'); if (st.xistera) perks.push('XISTERA'); if (st.fangCaps) perks.push('FANG CAPS'); if (st.mongoBig) perks.push('BIG MONGO');
      var inf2 = STAT_INFO[STATS[m.sel]];
      var msg = m.msgT > 0 ? m.msg : inf2.name + ': ' + inf2.desc;
      var ml = wrap(msg, 178).slice(0, perks.length && m.msgT <= 0 ? 1 : 2);
      ml.forEach(function (l, i) { T(l, px, 139 + i * 10, m.msgT > 0 ? C.red : C.gray); });
      if (perks.length && m.msgT <= 0) T(fitText('★ ' + perks.join(' ★ '), 180), px, 149, C.yellow);
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
        frame(ctx, 'LOOT BOXES', { footer: !list.length ? bn('back') + ':BACK' : canOpen ? bn('confirm') + ':OPEN  ' + bn('back') + ':BACK' : 'OPEN BOXES AT AN INN  ' + bn('back') + ':BACK' });
        if (!list.length) {
          bigSprite(ctx, 'box_bronze', 160, 82, { scale: 3, silhouette: '#1c2448' });
          T('NO UNOPENED BOXES.', 160, 92, C.white, { align: 'center' });
          if (!m.empty) m.empty = aiLine('boxEmpty', 'NO BOXES? GO HIT SOMETHING. THE SPONSORS ARE WATCHING.');
          wrap(up(m.empty), 270).slice(0, 4).forEach(function (l, i) { T(l, 160, 108 + i * 10, C.gray, { align: 'center' }); });
          return;
        }
        T(list.length + ' UNOPENED', 300, 21, C.dgray, { align: 'right', shadow: null });
        var vis = 6;
        for (var i = m.scroll; i < Math.min(list.length, m.scroll + vis); i++) {
          var b = list[i], yy = 32 + (i - m.scroll) * 21;
          if (i === m.sel) { R(10, yy - 2, 300, 20, '#1c2c5c'); cursor(13, yy + 4); }
          spr(ctx, 'box_' + b.tier, 32, yy + 16, { frame: i === m.sel ? Math.floor((DCW.t || 0) * 6) : 0 });
          T(fitText(up(tierName(b.tier)), 250), 46, yy, boxColor(b.tier));
          T(fitText('FROM: ' + up(b.from || 'THE SPONSORS'), 250), 46, yy + 9, C.dgray, { shadow: null });
        }
        scrollArrows(300, 30, 152, m.scroll, vis, list.length);
        return;
      }
      // opening animation
      R(0, 0, W, H, '#05030c');
      var col = boxColor(m.tier);
      var spin = (DCW.t || 0) * (m.mode === 'shake' ? 0.6 + m.mt : 0.4);
      rays(ctx, 160, 92, col, spin, m.mode === 'shake' ? Math.min(0.16, 0.06 + m.mt * 0.05) : 0.14);
      T(up(tierName(m.tier)), 160, 8, col, { align: 'center' });
      if (m.from) T(fitText('FROM: ' + up(m.from), 300), 160, 18, C.dgray, { align: 'center', shadow: null });
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
        T('NEW SKIN UNLOCKED!', 160, 32, blink(3) ? C.gold : C.yellow, { align: 'center' });
        var ang = (DCW.t || 0) * 0.8;
        ctx.save(); ctx.beginPath(); ctx.rect(62, 44, 196, 62); ctx.clip(); rays(ctx, 160, 92, C.gold, ang, 0.12); ctx.restore();
        bigSprite(ctx, actorName('carl', 'idle'), 160, 102, { scale: 2, skin: rr.id, frame: Math.floor((DCW.t || 0) * 2) });
        for (var s = 0; s < 6; s++) { var sa = (DCW.t || 0) * 2 + s; R(160 + Math.cos(sa) * 40, 76 + Math.sin(sa * 1.3) * 22, 2, 2, C.white); }
        var def = skinDef(rr.id);
        T(fitText(skinName(rr.id), 190), 160, 110, C.white, { align: 'center' });
        var extra = def && (perkText(def.perk) ? 'PERK: ' + perkText(def.perk) : def.desc);
        wrap(up(extra || ''), 186).slice(0, 2).forEach(function (l, i) { T(l, 160, 121 + i * 10, C.gray, { align: 'center' }); });
        if (m.mt > 0.5 && blink(2)) T(bn('confirm') + ': SWEET', 160, 142, C.gold, { align: 'center' });
      }
      if (m.mode === 'done') {
        DCW.box(4, 134, 312, 42);
        faceSlot(ctx, 'p_ai', 10, 139, m.mt < 1.2, 3);
        wrap(up(m.quip), 262).slice(0, 3).forEach(function (l, i) { T(l, 48, 140 + i * 10, C.white); });
        if (blink(2.5)) T('▼', 304, 166, C.gold);
      }
    };
    var drawBoxes = m.draw;
    m.draw = function (ctx) {
      drawBoxes(ctx);
      if (m.mode === 'list' && m.lockT > 0 && boxes().length) {
        DCW.box(50, 70, 220, 34, { fill: '#2c0808', border: C.red });
        T('BOXES ONLY OPEN AT AN INN', 160, 77, C.red, { align: 'center' });
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
    (o.blocks || []).forEach(function (b) {
      if (!b || (!b.text && !b.head)) return;
      if (lines.length) lines.push(['', C.gray]);
      if (b.head) lines.push([up(b.head), b.headColor || C.gold]);
      if (b.text) wrap(up(b.text), 284).forEach(function (t) { lines.push([t, b.color || C.white]); });
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
      frame(ctx, o.title ? up(o.title) : 'DETAILS', { titleColor: o.titleColor, border: o.border,
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
     WARDROBE (skins; the party is story-driven in book 2)
     ================================================================ */
  var DEF_SKINS = ['carl_f3', 'carl_primal', 'carl_magistrate', 'carl_boxers', 'carl_jacket', 'carl_bodyguard', 'carl_kilt', 'carl_hazmat', 'carl_pajamas', 'carl_clown', 'carl_toga', 'carl_gold'];
  ui.openWardrobe = function () {
    var m = { kind: 'wardrobe', sel: 0, scroll: 0, msg: '', msgT: 0 };
    var VIS = 12;
    function ids() { var d = D('skins'); var l = d ? Object.keys(d) : DEF_SKINS; return l.length ? l : DEF_SKINS; }
    function detailBlocks(id) {
      var dd = skinDef(id) || {}, own = owned('skin', id), out = [];
      if (!own) { out.push({ head: 'HOW TO UNLOCK', text: dd.how || 'FIND IT IN A LOOT BOX.', color: C.yellow }); return out; }
      if (dd.desc) out.push({ text: dd.desc, color: C.gray });
      out.push({ head: 'PERK', text: dd.perk ? perkText(dd.perk) || 'SECRET.' : 'NONE. PURE STYLE.', color: C.green, headColor: C.green });
      return out;
    }
    function openInfo() {
      var l = ids(), id = l[m.sel], own = owned('skin', id);
      sfx('menu_select');
      ui.readMore({ title: own ? skinName(id) : 'LOCKED', titleColor: own ? C.gold : C.dgray, blocks: detailBlocks(id) });
    }
    function selectEquipped() { var l = ids(), e = equipped('skin'); m.sel = Math.max(0, l.indexOf(e)); m.scroll = 0; scrollTo(m, VIS, l.length); }
    selectEquipped();
    m.update = function (dt) {
      m.t += dt; if (m.msgT > 0) m.msgT -= dt;
      var l = ids();
      listNav(m, l.length, dt); scrollTo(m, VIS, l.length);
      if (P('special') || P('select')) { openInfo(); return; }
      if (P('confirm')) {
        var id = l[m.sel];
        if (!owned('skin', id)) { openInfo(); return; }
        if (equipped('skin') === id) { sfx('menu_move'); return; }
        var ok;
        if (hasG('equip')) ok = G('equip', 'skin', id);
        else { var s = save(); s.equipped.skin = id; persist(); ok = true; }
        if (ok !== false) { sfx('menu_select'); m.msg = 'EQUIPPED!'; m.msgT = 1.0; }
      } else if (backPressed() || P('start')) { sfx('menu_back'); close(m); }
    };
    m.draw = function (ctx) {
      var l = ids(), have = l.filter(function (id) { return owned('skin', id); }).length;
      frame(ctx, 'WARDROBE', { footer: '↑↓:BROWSE  ' + bn('confirm') + ':EQUIP  ' + bn('special') + ':INFO  ' + bn('back') + ':BACK' });
      T('SKINS ' + have + '/' + l.length, 12, 21, C.white);
      for (var i = m.scroll; i < Math.min(l.length, m.scroll + VIS); i++) {
        var id = l[i], yy = 33 + (i - m.scroll) * 10, own = owned('skin', id), eq = equipped('skin') === id;
        if (i === m.sel) { R(10, yy - 1, 124, 10, '#1c2c5c'); cursor(12, yy); }
        T(fitText(own ? skinName(id) : '? ? ? ? ?', 98), 22, yy, own ? (i === m.sel ? C.white : C.gray) : C.ddgray);
        if (eq) T('✓', 124, yy, C.green);
      }
      scrollArrows(124, 29, 153, m.scroll, VIS, l.length);
      // preview
      var id2 = l[m.sel], own2 = owned('skin', id2);
      var pv = { x: 140, y: 20, w: 170, h: 72 };
      DCW.box(pv.x, pv.y, pv.w, pv.h, { fill: '#2c2450' });
      R(pv.x + 2, pv.y + 56, pv.w - 4, 14, '#1c1438');
      for (var s = 0; s < 6; s++) R(pv.x + 8 + s * 28, pv.y + 6 + (s % 2) * 4, 1, 1, C.gray);
      var fr = Math.floor((DCW.t || 0) * 2);
      bigSprite(ctx, actorName('carl', 'idle'), pv.x + 70, pv.y + 62, { scale: 2, skin: id2, frame: fr, silhouette: own2 ? null : '#000' });
      bigSprite(ctx, actorName('donut', 'idle'), pv.x + 128, pv.y + 62, { scale: 2, frame: fr, flip: true });
      var yy2 = pv.y + pv.h + 5;
      T(fitText(own2 ? skinName(id2) : 'LOCKED', 168), pv.x, yy2, own2 ? C.gold : C.dgray);
      if (equipped('skin') === id2) T('EQUIPPED', pv.x + pv.w, yy2, C.green, { align: 'right' });
      yy2 += 11;
      var lines = [];
      detailBlocks(id2).forEach(function (b) {
        if (b.head) lines.push([up(b.head), b.headColor || C.gold]);
        if (b.text) wrap(up(b.text), 168).forEach(function (t) { lines.push([t, b.color || C.gray]); });
      });
      var FIT = 5;
      if (lines.length > FIT) { lines = lines.slice(0, FIT - 1); lines.push([(blink(2) ? '▼ ' : '  ') + bn('special') + ': READ MORE', C.white]); }
      lines.forEach(function (ln, i) { T(ln[0], pv.x, yy2 + i * 10, ln[1]); });
      if (m.msgT > 0) { DCW.box(80, 74, 160, 18, { border: m.msg === 'EQUIPPED!' ? C.green : C.red }); T(fitText(m.msg, 150), 160, 79, m.msg === 'EQUIPPED!' ? C.green : C.red, { align: 'center' }); }
    };
    return push(m);
  };

  /* ================================================================
     GEAR - the crawl's gear (Carl's, then Donut's, then Mongo's), perk totals, outfits.
     Reads DCW.game.gearList() / gearPerks() / gearDef(id) when present, else run.gear + data.gear.
     ================================================================ */
  var GEAR_WHO = ['carl', 'donut', 'mongo'];
  var GEAR_HEAD = { carl: 'CARL', donut: 'PRINCESS DONUT', mongo: 'MONGO' };
  function gearDef(id) { var g = G('gearDef', id); if (g && typeof g === 'object') return g; var d = D('gear'); return (d && d[id]) || null; }
  function gearName(id) { var d = gearDef(id); return up((d && d.name) || String(id || '').replace(/_/g, ' ')); }
  function gearIcon(id) { var d = gearDef(id); return (d && d.icon) || 'gear_' + id; }
  // list name: data's short name, else drop ENCHANTED and whole trailing words until it fits (no "OF THE" stubs)
  function gearShort(def, id, px) {
    var n = up((def && (def.short || def.name)) || String(id || '').replace(/_/g, ' ')).replace(/^ENCHANTED\s+/, '');
    if (tw(n) <= px) return n;
    var w = n.split(/\s+/);
    while (w.length > 1 && (tw(w.join(' ')) > px || /^(OF|THE|AND|A)$/.test(w[w.length - 1]))) w.pop();
    var r = w.join(' ');
    return tw(r) <= px ? r : fitText(n, px);
  }
  function gearWho(def) { var w = def && String(def.who || '').toLowerCase(); return GEAR_WHO.indexOf(w) >= 0 ? w : 'carl'; }
  function runGear() {
    var l = G('gearList'), tab = D('gear') || {}, order = Object.keys(tab);
    if (!Array.isArray(l)) {
      var r = getRun(), g = r && r.gear;
      l = [];
      if (Array.isArray(g)) g.forEach(function (id) { l.push({ id: id }); });
      else if (g && typeof g === 'object') Object.keys(g).forEach(function (k) { if (g[k]) l.push({ id: k }); });
      l.sort(function (a, b) { return (order.indexOf(a.id) + 999) % 999 - (order.indexOf(b.id) + 999) % 999; });
    }
    var out = [];
    l.forEach(function (e) {
      if (typeof e === 'string') e = { id: e };
      if (!e || !e.id) return;
      var def = (e.def && typeof e.def === 'object') ? e.def : gearDef(e.id);
      out.push({ id: e.id, def: def || { name: up(String(e.id).replace(/_/g, ' ')) } });
    });
    // stable grouping: Carl's, then Donut's, then Mongo's
    return out.map(function (e, i) { return [e, i]; }).sort(function (a, b) {
      return (GEAR_WHO.indexOf(gearWho(a[0].def)) - GEAR_WHO.indexOf(gearWho(b[0].def))) || (a[1] - b[1]);
    }).map(function (p) { return p[0]; });
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
    Object.keys(out).forEach(function (k) { if (typeof out[k] === 'number') out[k] = Math.round(out[k] * 1000) / 1000; });
    return out;
  }
  // owned outfits, in data order (Book Two wardrobe rules: carl_f3 + save.unlocks.skins)
  function outfits() {
    var d = D('skins'), ids = d && Object.keys(d).length ? Object.keys(d) : DEF_SKINS;
    var out = ids.filter(function (id) { return owned('skin', id); });
    var eq = equipped('skin'); if (out.indexOf(eq) < 0) out.unshift(eq);
    return out;
  }
  // an 8x8 art icon by name (icon_<name> or <name>), optionally scaled; false when art has none
  function artIcon(ctx, name, x, y, s) {
    if (!name || !DCW.art || typeof DCW.art.icon !== 'function') return false;
    var pre = hasArt('icon_' + name);
    if (!pre && !hasArt(name)) return false;
    if (!pre) { var inf = artInfo(name); if (!inf || inf.w > 12 || inf.h > 12) return false; }
    try { DCW.art.icon(ctx, name, Math.round(x), Math.round(y), s > 1 ? { scale: s } : undefined); return true; } catch (e) { return false; }
  }
  function gearIconDraw(ctx, id, x, y, s) {
    var d = gearDef(id) || {}, tries = ['gear_' + id, d.icon];
    for (var i = 0; i < tries.length; i++) if (artIcon(ctx, tries[i], x, y, s)) return;
    icon(ctx, d.icon && ICONS[d.icon] ? d.icon : 'gear', x, y, s > 1 ? { scale: s } : null);
  }
  ui.drawGearIcon = gearIconDraw;
  ui.openGear = function () {
    if (ui.isOpen('gear')) return null;
    sfx('menu_select');
    var m = { kind: 'gear', sel: 0, scroll: 0, msg: '', msgT: 0, skinI: -1, msgOk: true };
    var TOP = 21, BOT = 156;
    function rows() {
      var list = runGear(), out = [{ type: 'sum' }];
      GEAR_WHO.forEach(function (w) {
        var mine = list.filter(function (g) { return gearWho(g.def) === w; });
        if (!mine.length) return;
        out.push({ type: 'head', text: GEAR_HEAD[w] });
        mine.forEach(function (g) { out.push({ type: 'gear', g: g, who: w }); });
      });
      var sk = outfits();
      if (sk.length > 1) out.push({ type: 'outfit', skins: sk });
      return out;
    }
    function rowH(r) { return r.type === 'head' ? 11 : r.type === 'sum' ? 13 : 20; }
    function perkBlockText(def) {
      if (def && typeof def.perkText === 'string' && def.perkText) return def.perkText;
      return perkLines(def && def.perk).join('\n');
    }
    function textBlocks(row) {
      if (!row) return [];
      if (row.type === 'sum') {
        var pl = perkLines(gearTotals()), n = runGear().length;
        return [{ head: n ? n + ' PIECE' + (n > 1 ? 'S' : '') + ' OF GEAR' : 'NO GEAR YET', text: n ? '' : 'YOU ARE FIGHTING IN YOUR GODDAMN UNDERWEAR. THE AUDIENCE IS THRILLED.', color: C.gray },
          { head: 'TOTAL PERKS', headColor: C.green, text: pl.length ? pl.join('\n') : 'NONE. YOU ARE RUNNING ON SPITE AND CHEAP COFFEE.', color: pl.length ? C.green : C.dgray }];
      }
      if (row.type === 'outfit') {
        var id = row.skins[m.skinI] || row.skins[0], sd = skinDef(id) || {};
        return [{ head: skinName(id), text: sd.desc || '', color: C.gray },
          sd.perk ? { head: 'PERK', headColor: C.green, text: perkText(sd.perk), color: C.green } : null].filter(Boolean);
      }
      var d = row.g.def || {}, pk = perkBlockText(d);
      return [{ head: d.name || gearName(row.g.id), text: '', color: C.white },
        pk ? { text: pk, color: C.green } : null,
        d.desc ? { text: d.desc, color: C.gray } : null,
        d.skin ? { text: 'OUTFIT: ' + skinName(d.skin), color: C.blue } : null].filter(Boolean);
    }
    function selectable(r) { return r && r.type !== 'head'; }
    function move(rs, d) {
      var n = rs.length, s = m.sel;
      for (var k = 0; k < n; k++) { s = (s + d + n) % n; if (selectable(rs[s])) break; }
      if (s !== m.sel) { m.sel = s; sfx('menu_move'); }
    }
    function fixScroll(rs) {
      if (m.sel < m.scroll) m.scroll = m.sel;
      if (m.scroll === m.sel && m.sel > 0 && rs[m.sel - 1] && rs[m.sel - 1].type === 'head') m.scroll = m.sel - 1;
      while (m.scroll < m.sel) {
        var h = 0; for (var i = m.scroll; i <= m.sel; i++) h += rowH(rs[i]);
        if (h <= BOT - TOP) break;
        m.scroll++;
      }
      m.scroll = clamp(m.scroll, 0, Math.max(0, rs.length - 1));
    }
    function say2(t, ok) { m.msg = t; m.msgOk = ok !== false; m.msgT = 1.2; }
    m.update = function (dt) {
      m.t += dt; if (m.msgT > 0) m.msgT -= dt;
      var rs = rows();
      if (m.sel >= rs.length || !selectable(rs[m.sel])) m.sel = 0;
      if (rep(m, 'up', dt)) move(rs, -1); else if (rep(m, 'down', dt)) move(rs, 1);
      fixScroll(rs);
      var row = rs[m.sel];
      if (row && row.type === 'outfit') {
        if (m.skinI < 0 || m.skinI >= row.skins.length) m.skinI = Math.max(0, row.skins.indexOf(equipped('skin')));
        if (rep(m, 'left', dt)) { m.skinI = (m.skinI + row.skins.length - 1) % row.skins.length; sfx('menu_move'); }
        else if (rep(m, 'right', dt)) { m.skinI = (m.skinI + 1) % row.skins.length; sfx('menu_move'); }
        else if (P('confirm')) {
          var id = row.skins[m.skinI];
          if (equipped('skin') === id) { sfx('menu_move'); say2('ALREADY WEARING IT, GENIUS.'); }
          else {
            var ok = hasG('equip') ? G('equip', 'skin', id) : (function () { var s = save(); s.equipped = s.equipped || {}; s.equipped.skin = id; persist(); return true; })();
            if (ok !== false) { sfx('menu_select'); say2('LOOKING GOOD, CARL.'); } else say2('CAN\'T WEAR THAT. NOT YET.', false);
          }
        }
      } else {
        m.skinI = -1;
        if (P('confirm') && row) {
          sfx('menu_select');
          var bl = textBlocks(row);
          if (row.type === 'gear') bl[0] = { head: GEAR_HEAD[row.who] + '\'S GEAR', text: '', headColor: C.dgray };
          ui.readMore({ title: row.type === 'sum' ? 'ALL GEAR PERKS' : (row.g.def.name || gearName(row.g.id)), titleColor: C.gold, blocks: bl });
          return;
        }
      }
      if ((backPressed() || P('start') || P('select')) && m.t > 0.1) { sfx('menu_back'); close(m); }
    };
    m.draw = function (ctx) {
      var rs = rows(), row = rs[m.sel] || rs[0], outfitRow = row && row.type === 'outfit';
      frame(ctx, 'GEAR', { footer: outfitRow ? '◀▶:OUTFIT  ' + bn('confirm') + ':WEAR  ' + bn('back') + ':BACK' : '↑↓:PICK  ' + bn('confirm') + ':READ  ' + bn('back') + ':BACK' });
      // ---- list ----
      var y = TOP, more = false;
      for (var i = m.scroll; i < rs.length; i++) {
        var r = rs[i], h = rowH(r), act = i === m.sel;
        if (y + h > BOT + 2) { more = true; break; }
        if (act) R(9, y - 2, 139, h, '#1c2c5c');
        if (r.type === 'head') {
          T(r.text, 12, y, C.dgray, { shadow: null });
          R(12 + tw(r.text) + 4, y + 3, Math.max(0, 134 - tw(r.text) - 4), 1, '#2c3c7c');
        } else if (r.type === 'sum') {
          icon(ctx, 'star', 12, y - 1);
          T('ALL PERKS', 23, y, act ? C.gold : C.yellow);
          var nG = runGear().length; T(nG ? String(nG) : 'NONE', 146, y, C.dgray, { align: 'right', shadow: null });
        } else if (r.type === 'outfit') {
          var cur = r.skins[act && m.skinI >= 0 ? m.skinI : r.skins.indexOf(equipped('skin'))] || r.skins[0];
          icon(ctx, 'star', 12, y - 1);
          T('OUTFIT', 23, y, act ? C.white : C.gray);
          T((r.skins.indexOf(cur) + 1) + '/' + r.skins.length, 146, y, C.dgray, { align: 'right', shadow: null });
          if (act) { T('◀', 23, y + 9, C.gold); T('▶', 146, y + 9, C.gold, { align: 'right' }); }
          T(fitText(skinName(cur), 108), 31, y + 9, cur === equipped('skin') ? C.green : (act ? C.white : C.gray), { shadow: null });
        } else {
          gearIconDraw(ctx, r.g.id, 12, y - 1);
          T(gearShort(r.g.def, r.g.id, 122), 23, y, act ? C.white : C.gray);
          var ps = perkShort(r.g.def.perk);
          if (ps) T(fitPerks(ps, 122), 23, y + 9, act ? C.green : C.dgreen, { shadow: null });
          else T('NO PERK. LOOKS COOL.', 23, y + 9, C.ddgray, { shadow: null });
        }
        y += h;
      }
      if (m.scroll > 0) T('▲', 149, TOP + (blink(4) ? 0 : -1), C.gray, { shadow: null });
      if (more) T('▼', 149, BOT - 8 + (blink(4) ? 0 : 1), C.gray, { shadow: null });
      // ---- preview ----
      var px = 156, pw = 154, pv = 20, ph = 66, feet = pv + ph - 5, fr = Math.floor((DCW.t || 0) * 2);
      DCW.box(px, pv, pw, ph, { fill: '#2c2450' });
      R(px + 2, feet - 1, pw - 4, ph - (feet - pv) - 1, '#1c1438');
      for (var s = 0; s < 4; s++) R(px + 10 + s * 28, pv + 6 + (s % 2) * 5, 1, 1, C.gray);
      var skin = outfitRow ? (row.skins[m.skinI] || equipped('skin')) : equipped('skin');
      var who = row && row.type === 'gear' ? row.who : 'all';
      var mongoS = actorName(compSprite('mongo'), 'idle');
      if (who === 'carl') bigSprite(ctx, actorName('carl', 'idle'), px + 52, feet, { scale: 2, skin: skin, frame: fr });
      else if (who === 'donut') bigSprite(ctx, actorName('donut', 'idle'), px + 56, feet, { scale: 2, frame: fr });
      else if (who === 'mongo') bigSprite(ctx, mongoS, px + 58, feet, { scale: 2, frame: fr });
      else {
        bigSprite(ctx, actorName('carl', 'idle'), px + 42, feet, { scale: 2, skin: skin, frame: fr });
        if (!shoulderDonut(ctx, px + 42, feet, 1, fr, 2)) bigSprite(ctx, actorName('donut', 'idle'), px + 82, feet, { scale: 2, frame: fr, flip: true });
        bigSprite(ctx, mongoS, px + 112, feet, { scale: 2, frame: fr, flip: true });
      }
      if (row && row.type === 'gear') {
        var bob = blink(1.5) ? 0 : -2;
        R(px + pw - 42, pv + 14 + bob, 28, 28, '#000'); R(px + pw - 41, pv + 15 + bob, 26, 26, '#1c1438');
        gearIconDraw(ctx, row.g.id, px + pw - 40, pv + 16 + bob, 3);
      }
      if (outfitRow && equipped('skin') === skin) T('WEARING', px + pw - 6, pv + 5, C.green, { align: 'right', shadow: null });
      // ---- text ----
      var lines = [];
      textBlocks(row).forEach(function (b) {
        if (b.head) wrap(up(b.head), pw - 4).forEach(function (t) { lines.push([t, b.headColor || C.gold]); });
        if (b.text) String(b.text).split('\n').forEach(function (part) { wrap(up(part), pw - 4).forEach(function (t) { lines.push([t, b.color || C.gray]); }); });
      });
      var FIT = 7;
      if (lines.length > FIT) { lines = lines.slice(0, FIT - 1); lines.push([bn('confirm') + ': READ MORE ' + (blink(2) ? '▼' : ' '), C.white]); }
      lines.forEach(function (ln, k) { T(ln[0], px + 2, pv + ph + 5 + k * 10, ln[1]); });
      if (m.msgT > 0) { var mc = m.msgOk ? C.green : C.red; DCW.box(px + 4, pv + ph - 24, pw - 8, 17, { border: mc }); T(fitText(m.msg, pw - 16), px + pw / 2, pv + ph - 19, mc, { align: 'center' }); }
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
    var LOCKED_TXT = '??? KEEP CRAWLING. THE AI WILL TELL YOU WHEN YOU DO SOMETHING DUMB ENOUGH.';
    m.update = function (dt) {
      m.t += dt;
      var l = list();
      listNav(m, l.length, dt); scrollTo(m, 12, l.length);
      if ((P('confirm') || P('special')) && l[m.sel]) {
        var e = l[m.sel], a = e.a, g = got(e.id);
        var cnt = (save().meta && save().meta.counters && save().meta.counters[a.event]) || 0;
        sfx('menu_select');
        ui.readMore({ title: g ? (a.name || e.id) : 'LOCKED ACHIEVEMENT', titleColor: g ? C.gold : C.dgray, border: g ? C.gold : C.dgray, blocks: [
          { text: g ? (a.desc || '') : (a.hint || LOCKED_TXT), color: g ? C.white : C.dgray },
          (!g && (a.count || 1) > 1) ? { head: 'PROGRESS', text: Math.min(cnt, a.count) + ' / ' + a.count, color: C.gray } : null,
          a.box !== null ? { head: 'REWARD', text: up(tierName(a.box || 'bronze')), color: boxColor(a.box || 'bronze') } : null
        ].filter(Boolean) });
      } else if (backPressed() || P('start')) { sfx('menu_back'); close(m); }
    };
    m.draw = function (ctx) {
      var l = list(), n = l.filter(function (e) { return got(e.id); }).length;
      frame(ctx, 'ACHIEVEMENTS', { footer: '↑↓:BROWSE  ' + bn('confirm') + ':READ  ' + bn('back') + ':BACK' });
      T('UNLOCKED ' + n + '/' + l.length, 12, 21, C.white);
      DCW.bar(110, 23, 44, 3, l.length ? n / l.length : 0, C.gold, '#2c2000');
      var imp = save().meta && save().meta.imported;
      if (imp && imp.achievements) T('BOOK 1: ' + imp.achievements, 308, 21, C.dgray, { align: 'right', shadow: null });
      if (!l.length) { T('NO ACHIEVEMENTS LOADED.', 160, 90, C.gray, { align: 'center' }); return; }
      var vis = 12;
      for (var i = m.scroll; i < Math.min(l.length, m.scroll + vis); i++) {
        var e = l[i], yy = 33 + (i - m.scroll) * 10, g = got(e.id);
        if (i === m.sel) { R(10, yy - 1, 148, 10, '#1c2c5c'); }
        icon(ctx, g ? 'star' : 'lock', 13, yy);
        T(fitText(g ? up(e.a.name || e.id) : '???', 128), 24, yy + 1, g ? (i === m.sel ? C.gold : C.yellow) : C.dgray);
      }
      scrollArrows(150, 29, 153, m.scroll, vis, l.length);
      var e2 = l[m.sel]; if (!e2) return;
      var g2 = got(e2.id), a = e2.a;
      var px = 164, pw = 144;
      DCW.box(px, 30, pw, 128, { fill: g2 ? '#2c1c00' : '#101018', border: g2 ? C.gold : C.dgray });
      bigSprite(ctx, 'box_' + (a.box || 'bronze'), px + 20, 56, { scale: 1, silhouette: g2 ? null : '#000' });
      var yy2 = 36;
      wrap(g2 ? up(a.name || e2.id) : '???', pw - 44).slice(0, 2).forEach(function (t) { T(t, px + 36, yy2, g2 ? C.gold : C.dgray); yy2 += 10; });
      yy2 = Math.max(yy2, 60) + 4;
      var dl = wrap(g2 ? up(a.desc || '') : up(a.hint || LOCKED_TXT), pw - 12);
      if (dl.length > 5) { dl = dl.slice(0, 4); dl.push((blink(2) ? '▼ ' : '  ') + bn('confirm') + ': READ ALL'); }
      dl.forEach(function (t, i) { T(t, px + 6, yy2, i === 4 && t.indexOf('READ ALL') >= 0 ? C.gold : g2 ? C.white : C.dgray); yy2 += 10; });
      var cnt = (save().meta && save().meta.counters && save().meta.counters[a.event]) || 0;
      if (!g2 && (a.count || 1) > 1) {
        T('PROGRESS ' + Math.min(cnt, a.count) + '/' + a.count, px + 6, 128, C.gray);
        DCW.bar(px + 6, 139, pw - 12, 2, cnt / a.count, C.green, '#002800');
      }
      if (a.box !== null) T(fitText('REWARD: ' + up(tierName(a.box || 'bronze')), pw - 12), px + 6, 146, g2 ? boxColor(a.box || 'bronze') : C.ddgray, { shadow: null });
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
        { label: 'GORE', type: 'bool', key: 'gore', val: s.gore !== false },
        { label: 'EASY MODE (HALF DAMAGE)', type: 'bool', key: 'easy', val: s.easy === true },
        { label: 'KEYBOARD CONTROLS', type: 'controls' },
        { label: 'RESET SAVE', type: 'reset' },
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
          ui.confirm('ERASE ALL BOOK 2 PROGRESS, UNLOCKS AND ACHIEVEMENTS? (BOOK 1 IS NOT TOUCHED.)', function () {
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
        var yy = 24 + i * 13 + (i >= rs.length - 3 ? 5 : 0), act = i === m.sel;
        if (act) { R(14, yy - 3, 292, 13, '#1c2c5c'); cursor(18, yy); }
        T(r.label, 30, yy, r.type === 'reset' ? (act ? C.red : C.dred) : act ? C.white : C.gray);
        if (r.type === 'vol') {
          var v = s[r.key] === undefined ? 0.6 : s[r.key];
          T('◀', 150, yy, act ? C.white : C.ddgray);
          for (var b = 0; b < 10; b++) { var on = b < Math.round(v * 10); R(160 + b * 9, yy, 7, 7, on ? (act ? C.green : C.dgreen) : '#202838'); }
          T('▶', 252, yy, act ? C.white : C.ddgray);
          T(Math.round(v * 100) + '%', 300, yy, C.white, { align: 'right' });
        } else if (r.type === 'bool') {
          T('◀ ' + (r.val ? 'ON' : 'OFF') + ' ▶', 230, yy, r.val ? C.green : C.dgray, { align: 'center' });
        } else if (r.type === 'touch') {
          T('◀ ' + r.val + ' ▶', 230, yy, C.blue, { align: 'center' });
        } else if (r.type === 'controls') {
          T('REBIND ▶', 230, yy, act ? C.gold : C.dgray, { align: 'center' });
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
    var pals = partyList();
    var compId = pals[0] || null;
    var m = { kind: 'versus', slam: false, done: false };
    var DUR = 3.2;
    var bossName = up(o.name || 'THE BOSS');
    var bossTitle = up(o.title || '');
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
      if (wipe > 0.9) { ctx.save(); ctx.globalAlpha = 1 - outT; ctx.strokeStyle = '#fcfcfc'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(W * 0.56, 0); ctx.lineTo(W * 0.44, H); ctx.stroke(); ctx.restore(); }
      var inL = ease((t - 0.12) / 0.4), inR = ease((t - 0.22) / 0.4);
      var lx = Math.round(-120 + (26 + 120) * inL - outT * 160);
      var rx = Math.round(W + 20 - (W + 20 - 194) * inR + outT * 160);
      var py = 22;
      function panel(x, pname, border, fill) {
        DCW.box(x, py, 100, 100, { fill: fill, border: border });
        ctx.save(); ctx.translate(x + 2, py + 2); ctx.scale(3, 3);
        portrait(ctx, pname, 0, 0, { frame: t > 0.7 && t < 1.4 ? Math.floor(t * 9) % 2 : 0 });
        ctx.restore();
      }
      panel(lx, 'p_carl', C.blue, '#081440');
      panel(rx, bossPortrait, C.red, '#3c0808');
      if (compId && inL > 0.95 && outT === 0) {
        DCW.box(lx + 70, py + 72, 34, 34, { fill: '#081440', border: C.gold });
        portrait(ctx, 'p_' + compId, lx + 71, py + 73);
      }
      var nameA = Math.max(0, Math.min(1, (t - 0.7) / 0.2)) * (1 - outT);
      if (nameA > 0) {
        ctx.save(); ctx.globalAlpha = nameA;
        T('CARL', lx + 50, py + 108, C.gold, { align: 'center', scale: 2 });
        if (compId) T('& ' + compName(compId), lx + 50, py + 128, C.blue, { align: 'center', shadow: null });
        if (DCW.textWidth(bossName, 2) <= 148) T(bossName, rx + 50, py + 108, C.red, { align: 'center', scale: 2 });
        else if (/^THE /.test(bossName) && DCW.textWidth(bossName.slice(4), 2) <= 148) {
          T('THE', rx + 50, py + 102, C.red, { align: 'center', shadow: null });
          T(bossName.slice(4), rx + 50, py + 110, C.red, { align: 'center', scale: 2 });
        } else T(bossName, rx + 50, py + 112, C.red, { align: 'center' });
        wrap(bossTitle, 150).slice(0, 2).forEach(function (l, i) { T(l, rx + 50, py + 128 + i * 9, C.gray, { align: 'center', shadow: null }); });
        ctx.restore();
      }
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
  var CTRL_LABELS = { left: 'MOVE LEFT', right: 'MOVE RIGHT', up: 'UP / DOOR', down: 'DOWN / CROUCH', jump: 'JUMP / OK',
    attack: 'PUNCH / BACK', bomb: 'THROW', special: 'SPECIAL', potion: 'POTION', start: 'PAUSE', select: 'MAP / GEAR' };
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
        if (act) { R(10, yy - 2, 300, 10, '#1c2c5c'); cursor(10, yy); }
        T(CTRL_LABELS[a] || a.toUpperCase(), 22, yy, act ? C.white : C.gray, { shadow: null });
        for (var sl = 0; sl < 2; sl++) {
          var cx2 = sl ? 264 : 192, on = act && m.col === sl;
          if (on) R(cx2 - 31, yy - 2, 62, 10, m.cap ? C.gold : '#3050a0');
          var code = b[a][sl];
          var label = (m.cap && on) ? (blink(5) ? '...' : '') : inp.keyName(code);
          var col = (m.cap && on) ? '#000' : !code ? (sl === 0 && (a === 'jump' || a === 'attack' || a === 'left' || a === 'right') ? C.red : C.ddgray) : on ? C.white : C.lgray;
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
     SHOPS  openShop(shopId) - buy list from data.shops[shopId] via DCW.game.buy(shopId, itemId)
     ================================================================ */
  var SHOP_HELLO = {
    lucky: 'LUCKY\'S GENERAL GOODS. IF IT ISN\'T NAILED DOWN, I SELL IT. IF IT IS NAILED DOWN, I SELL THE NAILS.',
    pustule: 'HOBGOBS AND BOOM STICKS! EVERYTHING HERE EXPLODES. THAT IS THE WHOLE BUSINESS MODEL, SWEETIE.',
    quint: 'YOU NEED SOMETHING. I HAVE SOMETHING. LET\'S NOT MAKE THIS WEIRD.',
    edge_dancer: 'FINE SILKS, FINER BLADES, AND A RETURN POLICY OF ABSOLUTELY NOT.',
    talon: 'FRESH FROM THE MARKET. MOSTLY FRESH. SOME OF IT IS STILL MOVING.'
  };
  function shopDef(id) { var s = D('shops') || {}; return s[id] || null; }
  function shopEntryGive(it) { var g = it.give; if (Array.isArray(g)) g = g[0]; return g || { item: it.id, n: 1 }; }
  function shopEntryName(it) {
    if (it.name) return up(it.name);
    var g = shopEntryGive(it);
    if (g.item) return itemName(g.item) + ((g.n || 1) > 1 ? ' ×' + g.n : '');
    if (g.potion) return 'HEALTH POTION' + (g.potion > 1 ? ' ×' + g.potion : '');
    if (g.skin) return 'OUTFIT: ' + skinName(g.skin);
    if (g.box) return up(tierName(g.box));
    return itemName(it.id);
  }
  function shopEntryDesc(it) {
    if (it.desc) return up(it.desc);
    var g = shopEntryGive(it), d = g.item ? itemDef(g.item) : g.skin ? skinDef(g.skin) : null;
    if (d && d.desc) return up(d.desc);
    if (g.potion || g.item === 'potion') return 'HEALS HALF YOUR HP. TASTES LIKE A GAS STATION SLUSHIE.';
    return '';
  }
  function shopEntryIcon(it) { var g = shopEntryGive(it); if (g.item) return itemIcon(g.item); if (g.potion) return 'potion'; if (g.box) return 'box'; if (g.skin) return 'star'; return itemIcon(it.id); }
  function shopOwned(it) {
    var g = shopEntryGive(it);
    if (g.item) return itemCount(g.item);
    if (g.potion) return itemCount('potion');
    if (g.skin) return owned('skin', g.skin) ? 'OWNED' : null;
    return null;
  }
  ui.openShop = function (shopId, o) {
    o = o || {};
    var all = D('shops') || {};
    if (!shopId || !all[shopId]) shopId = shopId && !all[shopId] ? shopId : (Object.keys(all)[0] || 'shop');
    var sh = shopDef(shopId) || { name: 'SHOP', items: [] };
    var keeper = sh.keeper || shopId;
    var keeperName = up(sh.keeperName || (sh.keeper ? String(sh.keeper).replace(/_/g, ' ') : 'SHOPKEEP'));
    var por = sh.portrait || ('p_' + keeper);
    var m = { kind: 'shop', sel: 0, scroll: 0, flash: 0, lineT: 0 };
    var lines = lineList(sh.lines || sh.hello);
    m.line = up(o.greet || pick(lines) || SHOP_HELLO[shopId] || 'WELCOME, CRAWLER. EVERYTHING IS FOR SALE. EXCEPT ME. PROBABLY.');
    m.lineCol = C.white;
    function items() { return Array.isArray(sh.items) ? sh.items.filter(function (it) { return it && (!it.showIf || flag(it.showIf)) && !(it.hideIf && flag(it.hideIf)); }) : []; }
    function price(it) { var p = G('price', shopId, it.id); return typeof p === 'number' ? p : (it.price || 0); }
    function soldOut(it) { var r = getRun(); return !!(it.limit && r && r.bought && (r.bought[shopId + ':' + it.id] || 0) >= it.limit); }
    function setLine(t, col) { m.line = up(t); m.lineCol = col || C.white; m.lineT = 0; }
    m.update = function (dt) {
      m.t += dt; m.lineT += dt; if (m.flash > 0) m.flash -= dt;
      var l = items();
      listNav(m, l.length, dt); scrollTo(m, 6, l.length);
      if ((P('special') || P('select')) && l.length) {
        var iti = l[m.sel]; sfx('menu_select');
        ui.readMore({ title: shopEntryName(iti), titleColor: C.orange, blocks: [{ text: shopEntryDesc(iti) || 'NO DESCRIPTION. LIVE A LITTLE.', color: C.white }, { head: 'PRICE', text: price(iti) + ' GOLD', color: C.gold }] });
      } else if (P('confirm') && l.length) {
        var it = l[m.sel], res;
        if (soldOut(it)) { sfx('error'); setLine('SOLD OUT. COME BACK NEVER.', C.red); return; }
        if (hasG('buy')) res = G('buy', shopId, it.id) || { ok: false, msg: 'SOMETHING WENT WRONG.' };
        else { res = { ok: false, msg: 'THE REGISTER IS BROKEN. COME BACK LATER.' }; sfx('error'); }
        m.flash = 0.35;
        if (res.ok) setLine((res.msg ? res.msg + '! ' : '') + (pick(lineList(sh.thanks)) || 'PLEASURE DOING BUSINESS.'), C.green);
        else setLine(res.msg || 'NO.', C.red);
      } else if (backPressed() || P('start')) { sfx('menu_back'); close(m); if (o.onClose) o.onClose(); }
    };
    m.draw = function (ctx) {
      var l = items(), run = getRun() || {};
      frame(ctx, fitText(up(sh.name || keeperName + "'S SHOP"), 280), { footer: bn('confirm') + ':BUY  ' + bn('special') + ':INFO  ' + bn('back') + ':LEAVE' });
      faceSlot(ctx, por, 12, 22, m.lineT < 1.4, 1);
      DCW.box(50, 20, 260, 36, { fill: '#2c1c00', border: C.orange });
      R(47, 34, 4, 4, C.orange);
      wrap(m.line, 248).slice(0, 3).forEach(function (t, i) { T(t, 56, 24 + i * 10, m.lineCol); });
      T(fitText(keeperName, 44), 28, 58, C.dgray, { align: 'center', shadow: null });
      icon(ctx, 'coin', 12, 66); T(run.gold || 0, 22, 67, C.gold);
      var ex = EXPLOSIVES.concat(['potion']), ix = 306 - ex.length * 26;
      ex.forEach(function (id, i) { icon(ctx, itemIcon(id), ix + i * 26, 66); T(itemCount(id), ix + i * 26 + 10, 67, C.gray, { shadow: null }); });
      R(10, 77, 300, 1, '#2c3c7c');
      if (!l.length) { T('SOLD OUT. EVERYTHING. SOMEHOW.', 160, 104, C.gray, { align: 'center' }); return; }
      var vis = 6;
      for (var i = m.scroll; i < Math.min(l.length, m.scroll + vis); i++) {
        var it = l[i], yy = 81 + (i - m.scroll) * 10, p = price(it), afford = (run.gold || 0) >= p, so = soldOut(it);
        if (i === m.sel) { R(10, yy - 1, 300, 10, m.flash > 0 ? '#3c2c00' : '#1c2c5c'); cursor(12, yy); }
        icon(ctx, shopEntryIcon(it), 21, yy - 1);
        T(fitText(shopEntryName(it), 172), 32, yy, so ? C.ddgray : i === m.sel ? C.white : C.gray);
        var ow = shopOwned(it);
        if (ow !== null && ow !== undefined && !so) T(ow === 'OWNED' ? 'OWNED' : 'HAVE ' + ow, 246, yy, C.dgray, { align: 'right', shadow: null });
        if (so) T('SOLD OUT', 298, yy, C.dred, { align: 'right' });
        else { T(p, 298, yy, afford ? C.gold : C.red, { align: 'right' }); icon(ctx, 'coin', 298 - tw(p) - 10, yy - 1); }
      }
      scrollArrows(302, 77, 139, m.scroll, vis, l.length);
      R(10, 143, 300, 1, '#2c3c7c');
      var d = l[m.sel] && shopEntryDesc(l[m.sel]);
      var sl = wrap(d || '', 296);
      if (sl.length > 2) { sl = sl.slice(0, 1); sl.push((blink(2) ? '▼ ' : '  ') + bn('special') + ': READ MORE'); }
      sl.forEach(function (t, i) { T(t, 12, 146 + i * 9, i === 1 && t.indexOf('READ MORE') >= 0 ? C.white : C.gray, { shadow: null }); });
    };
    return push(m);
  };

  /* ================================================================
     MAP  (schematic of the Over City: areas as boxes linked by roads)
     ================================================================ */
  var MAP_ROW = ['village', 'ruins_w', 'circus_park', 'ruins_e', 'settlement', 'east_stairs'];
  var MAP_UP = { admin: 'settlement' };           // boxes drawn above another
  var MAP_SHORT = { village: 'VILLAGE', ruins_w: 'RUINS W', circus_park: 'CIRCUS', ruins_e: 'RUINS E', settlement: 'SKYFOWL', admin: 'ADMIN', east_stairs: 'STAIRS' };
  function mapAreas() {
    var row = MAP_ROW.slice(), ups = {}, k;
    for (k in MAP_UP) ups[k] = MAP_UP[k];
    var all = D('areas');
    if (all) {
      Object.keys(all).forEach(function (id) {
        if (row.indexOf(id) >= 0 || ups[id]) return;
        var a = all[id] || {};
        if (a.mapAbove && row.indexOf(a.mapAbove) >= 0) ups[id] = a.mapAbove; else if (row.length < 7) row.push(id);
      });
      row = row.filter(function (id) { return all[id] || MAP_SHORT[id]; });
    }
    return { row: row, ups: ups };
  }
  function areaEvidence(id) {
    var r = getRun(); if (!r) return id === 'village';
    if (r.area === id) return true;
    if (flag('map_' + id) || flag('visited_' + id) || (r.visited && r.visited[id])) return true;
    var a = areaDef(id);
    if (a && a.doors) for (var ch in a.doors) { var d = a.doors[ch]; if (d && d.kind === 'level' && r.cleared && r.cleared[d.target]) return true; }
    return false;
  }
  // everything up to the furthest area with evidence counts as walked through (the story runs west to east)
  function knownAreas() {
    var lay = mapAreas(), known = {}, maxI = 0;
    lay.row.forEach(function (id, i) { if (areaEvidence(id)) maxI = Math.max(maxI, i); });
    Object.keys(lay.ups).forEach(function (id) { if (areaEvidence(id)) maxI = Math.max(maxI, lay.row.indexOf(lay.ups[id])); });
    lay.row.forEach(function (id, i) { if (i <= maxI) known[id] = true; });
    Object.keys(lay.ups).forEach(function (id) { if (areaEvidence(id)) known[id] = true; });
    return known;
  }
  ui.knownAreas = knownAreas;
  function doorInfo(areaId, ch) {
    var st = G('doorState', areaId, ch);
    var a = areaDef(areaId), d = a && a.doors && a.doors[ch];
    if (st && typeof st === 'object') { if (!st.kind && d) st.kind = d.kind; if (!st.target && d) st.target = d.target; return st; }
    if (!d) return null;
    var r = getRun(), lv = d.kind === 'level' ? levelDef(d.target) : null;
    var vis = !(d.showIf && !flag(d.showIf)) && !(d.hideIf && flag(d.hideIf));
    return { visible: vis, locked: !!(d.needs && !flag(d.needs)), lockText: d.lockText || '', label: d.label || (lv && lv.name) || '', kind: d.kind, target: d.target, cleared: !!(r && r.cleared && r.cleared[d.target]) };
  }
  function areaDoors(areaId) {
    var a = areaDef(areaId); if (!a || !a.doors) return [];
    var out = [];
    Object.keys(a.doors).forEach(function (ch) {
      var d = a.doors[ch]; if (!d || d.kind === 'npc' || d.kind === 'area' || d.kind === 'cinema') return;
      var st = doorInfo(areaId, ch); if (!st || !st.visible) return;
      var lv = d.kind === 'level' ? levelDef(d.target) : null;
      var label = up(st.label || d.label || (lv && lv.name) || d.target || ch);
      if (d.kind === 'shop') { var s = shopDef(d.target); label = up(d.label || (s && s.name) || label); }
      out.push({ ch: ch, kind: d.kind, label: label, st: st, optional: !!(lv && lv.optional) });
    });
    var order = { level: 0, stairs: 1, inn: 2, club: 3, shop: 4 };
    out.sort(function (x, y) { return (order[x.kind] || 5) - (order[y.kind] || 5); });
    return out;
  }
  ui.areaDoors = areaDoors;
  function doorColor(dd) {
    if (dd.kind === 'inn') return C.blue;
    if (dd.kind === 'shop') return C.orange;
    if (dd.kind === 'club') return C.pink;
    if (dd.kind === 'stairs') return dd.st.locked ? '#5c2c5c' : C.purple;
    if (dd.st.cleared) return C.green;
    if (dd.st.locked) return C.dred;
    return dd.optional ? C.orange : C.yellow;
  }
  // SELECT routing. On the streets SELECT opens the map (SELECT again flips to GEAR, again closes);
  // everywhere else (levels, inns, the club) it opens GEAR. The pause menu keeps MAP and GEAR.
  function stageMode() {
    var st = DCW.stage;
    if (!st || DCW.scene !== st.scene) return null;
    try { if (typeof st.mode === 'function') return st.mode() || null; var S = st.state; return (S && S.mode) || null; } catch (e) { return null; }
  }
  function onStreets() {
    var md = stageMode();
    if (md) return md === 'street';
    var run = getRun();
    return !!(DCW.stage && DCW.scene === DCW.stage.scene && run && !run.levelId && !run.inInn && !run.inClub);
  }
  ui.onStreets = onStreets;
  ui.onSelect = function () { return onStreets() ? mapScreen() : ui.openGear(); };
  // stage.js calls openMap() on SELECT; in a level that press means GEAR (call ui.onSelect() instead)
  ui.openMap = function () {
    if (P('select') && !stack.length && stageMode() && stageMode() !== 'street') return ui.openGear();
    return mapScreen();
  };
  ui.openMapScreen = function () { return mapScreen(); };
  function mapScreen() {
    if (ui.isOpen('map')) return null;
    var lay = mapAreas();
    var run = getRun() || {};
    var m = { kind: 'map', cur: run.area && (lay.row.indexOf(run.area) >= 0 || lay.ups[run.area]) ? run.area : lay.row[0], scroll: 0 };
    sfx('menu_select');
    function boxes() {
      var out = {}, bw = 46, gap = Math.floor((304 - bw * lay.row.length) / Math.max(1, lay.row.length - 1));
      gap = Math.min(gap, 14);
      var total = lay.row.length * bw + (lay.row.length - 1) * gap, x0 = Math.round(160 - total / 2);
      lay.row.forEach(function (id, i) { out[id] = { x: x0 + i * (bw + gap), y: 60, w: bw, h: 22 }; });
      Object.keys(lay.ups).forEach(function (id) { var b = out[lay.ups[id]]; if (b) out[id] = { x: b.x, y: 34, w: bw, h: 18 }; });
      return out;
    }
    m.update = function (dt) {
      m.t += dt;
      var i = lay.row.indexOf(m.cur), moved = null;
      if (rep(m, 'left', dt)) { if (lay.ups[m.cur]) moved = lay.row[Math.max(0, lay.row.indexOf(lay.ups[m.cur]) - 1)]; else if (i > 0) moved = lay.row[i - 1]; }
      else if (rep(m, 'right', dt)) { if (lay.ups[m.cur]) moved = lay.row[Math.min(lay.row.length - 1, lay.row.indexOf(lay.ups[m.cur]) + 1)]; else if (i < lay.row.length - 1) moved = lay.row[i + 1]; }
      else if (P('up')) { for (var k in lay.ups) if (lay.ups[k] === m.cur) moved = k; if (!moved && areaDoors(m.cur).length > 5) { m.scroll = Math.max(0, m.scroll - 1); } }
      else if (P('down')) { if (lay.ups[m.cur]) moved = lay.ups[m.cur]; else { var n = areaDoors(m.cur).length; if (n > 5) m.scroll = Math.min(n - 5, m.scroll + 1); } }
      if (moved && moved !== m.cur) { m.cur = moved; m.scroll = 0; sfx('menu_move'); }
      if (P('select') && m.t > 0.1) { close(m); ui.openGear(); return; }
      if ((backPressed() || P('start') || P('confirm')) && m.t > 0.1) { sfx('menu_back'); close(m); }
    };
    m.draw = function (ctx) {
      var known = knownAreas(), bx = boxes(), ck = clockInfo(), ob = objectiveInfo(), runNow = getRun() || {};
      frame(ctx, 'THE OVER CITY', { footer: '◀▶↑↓:AREA  ' + bn('select') + ':GEAR  ' + bn('back') + ':CLOSE' });
      if (ck) {
        T('DAY ' + (ck.day || 1) + ' ' + hourText(ck), 310, 9, ck.night ? C.nblue : C.orange, { align: 'right', shadow: null });
        T(ck.label + ' LEFT', 10, 9, ck.hoursLeft <= 24 ? C.red : C.gray, { shadow: null });
      }
      T(fitText('▶ ' + (ob ? up(ob.text) : 'FIND THE STAIRS. TRY NOT TO DIE.'), 300), 160, 22, C.yellow, { align: 'center' });
      // roads
      for (var i = 0; i < lay.row.length - 1; i++) {
        var a = bx[lay.row[i]], b = bx[lay.row[i + 1]];
        var both = known[lay.row[i]] && known[lay.row[i + 1]];
        for (var rx = a.x + a.w; rx < b.x; rx += both ? 1 : 3) R(rx, a.y + 10, 1, 3, both ? '#8c7c5c' : '#3c3428');
      }
      Object.keys(lay.ups).forEach(function (id) {
        var u = bx[id], d = bx[lay.ups[id]]; if (!u || !d) return;
        var kk = known[id] && known[lay.ups[id]];
        for (var ry = u.y + u.h; ry < d.y; ry += kk ? 1 : 3) R(u.x + u.w / 2 - 1, ry, 3, 1, kk ? '#8c7c5c' : '#3c3428');
      });
      // boxes
      Object.keys(bx).forEach(function (id) {
        var b = bx[id], kn = !!known[id], here = runNow.area === id, sel = m.cur === id;
        var ar = areaDef(id) || {};
        var border = sel ? (blink(4) ? C.white : C.gold) : here ? C.gold : kn ? C.gray : C.ddgray;
        DCW.box(b.x, b.y, b.w, b.h, { fill: kn ? (ar.guarded ? '#1c2c1c' : '#1c1c2c') : '#080808', border: border });
        T(kn ? fitText(up(ar.short || MAP_SHORT[id] || ar.name || id), b.w - 4) : '???', b.x + b.w / 2, b.y + 4, kn ? C.white : C.ddgray, { align: 'center', shadow: null });
        if (kn) {
          var ds = areaDoors(id).slice(0, 7), dx = b.x + Math.round((b.w - ds.length * 6 + 2) / 2);
          ds.forEach(function (dd, k) { R(dx + k * 6 - 1, b.y + b.h - 8, 6, 6, '#000'); R(dx + k * 6, b.y + b.h - 7, 4, 4, doorColor(dd)); });
        }
        if (here) { var bob = blink(3) ? 0 : -1; R(b.x + b.w - 11, b.y - 8 + bob, 14, 14, '#000'); miniPortrait(ctx, 'p_carl', b.x + b.w - 10, b.y - 7 + bob); }
        if (ob && ob.area === id) T('★', b.x + 1, b.y - 6, blink(2.5) ? C.gold : C.yellow);
      });
      // detail panel for the selected area
      var sb = { x: 8, y: 88, w: 304, h: 72 };
      DCW.box(sb.x, sb.y, sb.w, sb.h, { fill: '#0b1024' });
      var ad = areaDef(m.cur) || {}, kn2 = !!known[m.cur];
      T(kn2 ? fitText(up(ad.name || m.cur), 200) : 'UNEXPLORED', sb.x + 6, sb.y + 5, kn2 ? C.gold : C.dgray);
      var tags = [];
      if (kn2 && ad.guarded) tags.push(['GUARDED BY DAY', C.green]);
      if (runNow.banned && runNow.banned[m.cur] !== undefined && (runNow.hoursLeft || 0) > runNow.banned[m.cur]) tags.push(['BANNED', C.red]);
      if (runNow.wanted === m.cur) tags.push(['WANTED', C.red]);
      var tx = sb.x + sb.w - 6;
      tags.forEach(function (tg) { T(tg[0], tx, sb.y + 5, tg[1], { align: 'right', shadow: null }); tx -= tw(tg[0]) + 8; });
      R(sb.x + 5, sb.y + 15, sb.w - 10, 1, '#2c3c7c');
      if (!kn2) { T('NOBODY HAS DRAWN THIS PART OF THE MAP YET.', 160, sb.y + 30, C.dgray, { align: 'center' }); T('FIND A SIGNPOST ROCK, OR JUST WALK THERE.', 160, sb.y + 42, C.dgray, { align: 'center' }); return; }
      var ds2 = areaDoors(m.cur);
      if (!ds2.length) { T('NOTHING HERE BUT STREET. AND WHATEVER LIVES IN IT.', 160, sb.y + 34, C.gray, { align: 'center' }); return; }
      var VIS = 5; m.scroll = clamp(m.scroll, 0, Math.max(0, ds2.length - VIS));
      ds2.slice(m.scroll, m.scroll + VIS).forEach(function (dd, k) {
        var yy = sb.y + 19 + k * 10, col = doorColor(dd);
        R(sb.x + 7, yy + 1, 5, 5, col);
        var kindTxt = { inn: 'INN', shop: 'SHOP', club: 'CLUB', stairs: 'STAIRS' }[dd.kind];
        T(fitText(dd.label, 150), sb.x + 16, yy, C.white);
        var stTxt, stCol;
        if (kindTxt) { stTxt = dd.st.locked ? (dd.st.lockText || 'LOCKED') : kindTxt; stCol = dd.st.locked ? C.red : col; }
        else if (dd.st.cleared) { stTxt = dd.optional ? '✓ CLEARED (REPLAY OK)' : '✓ CLEARED'; stCol = C.green; }
        else if (dd.st.locked) { stTxt = dd.st.lockText || 'LOCKED'; stCol = C.red; }
        else { stTxt = dd.optional ? 'SIDE AREA' : 'OPEN'; stCol = col; }
        T(fitText(up(stTxt), 128), sb.x + sb.w - 6, yy, stCol, { align: 'right', shadow: null });
      });
      scrollArrows(sb.x + sb.w - 12, sb.y + 16, sb.y + 62, m.scroll, VIS, ds2.length);
    };
    return push(m);
  }

  /* ================================================================
     QUEST LOG
     ================================================================ */
  ui.openQuests = function () {
    var m = { kind: 'quests', sel: 0, scroll: 0 };
    var VIS = 9;
    function list() {
      var r = getRun(), q = (r && r.quests) || {};
      var ids = Object.keys(q);
      var act = ids.filter(function (id) { return q[id] !== 'done'; }), done = ids.filter(function (id) { return q[id] === 'done'; });
      return act.concat(done).map(function (id) { return { id: id, done: q[id] === 'done', def: questDef(id) }; });
    }
    m.update = function (dt) {
      m.t += dt;
      var l = list();
      listNav(m, l.length, dt); scrollTo(m, VIS, l.length);
      if (P('confirm') && l[m.sel]) {
        var e = l[m.sel]; sfx('menu_select');
        ui.readMore({ title: up(e.def.name || e.id), titleColor: e.done ? C.green : C.gold, blocks: [
          { text: e.def.desc || e.def.text || 'THE AI DIDN\'T WRITE A DESCRIPTION. IT\'S BUSY.', color: C.white },
          e.def.reward ? { head: 'REWARD', text: typeof e.def.reward === 'string' ? e.def.reward : 'SOMETHING SHINY', color: C.gold } : null,
          { head: 'STATUS', text: e.done ? 'COMPLETE' : 'IN PROGRESS', color: e.done ? C.green : C.yellow }
        ].filter(Boolean) });
      } else if (backPressed() || P('start')) { sfx('menu_back'); close(m); }
    };
    m.draw = function (ctx) {
      var l = list();
      frame(ctx, 'QUESTS', { footer: l.length ? '↑↓:BROWSE  ' + bn('confirm') + ':READ  ' + bn('back') + ':BACK' : bn('back') + ':BACK' });
      var ob = objectiveInfo();
      DCW.box(10, 21, 300, 24, { fill: '#2c1c00', border: C.gold });
      icon(ctx, 'quest', 15, 24);
      T('OBJECTIVE', 27, 25, C.gold, { shadow: null });
      var oa = ob && ob.area ? areaDef(ob.area) : null;
      if (oa) T(fitText(up(oa.name || ob.area), 150), 304, 25, C.dgray, { align: 'right', shadow: null });
      T(fitText(ob ? up(ob.text) : 'NOTHING RIGHT NOW. ENJOY IT. IT WON\'T LAST.', 290), 16, 35, C.white);
      if (!l.length) {
        T('NO QUESTS YET.', 160, 86, C.white, { align: 'center' });
        wrap('THE AI WILL HAND YOU SOME SOON. YOU WON\'T LIKE THEM.', 260).forEach(function (t, i) { T(t, 160, 100 + i * 10, C.gray, { align: 'center' }); });
        return;
      }
      var na = l.filter(function (e) { return !e.done; }).length;
      T('ACTIVE ' + na + '  DONE ' + (l.length - na), 12, 50, C.dgray, { shadow: null });
      for (var i = m.scroll; i < Math.min(l.length, m.scroll + VIS); i++) {
        var e = l[i], yy = 61 + (i - m.scroll) * 10;
        if (i === m.sel) R(10, yy - 1, 140, 10, '#1c2c5c');
        T(e.done ? '✓' : '▶', 13, yy, e.done ? C.green : C.yellow, { shadow: null });
        T(fitText(up(e.def.name || e.id), 124), 22, yy, e.done ? (i === m.sel ? C.green : C.dgreen) : (i === m.sel ? C.white : C.gray));
      }
      scrollArrows(140, 56, 151, m.scroll, VIS, l.length);
      var e2 = l[m.sel]; if (!e2) return;
      var px = 156, pw = 154;
      DCW.box(px, 50, pw, 108, { fill: e2.done ? '#0c2010' : '#101828', border: e2.done ? C.green : C.gray });
      var yy2 = 55;
      wrap(up(e2.def.name || e2.id), pw - 12).slice(0, 2).forEach(function (t) { T(t, px + 6, yy2, e2.done ? C.green : C.gold); yy2 += 10; });
      T(e2.done ? 'COMPLETE' : 'IN PROGRESS', px + 6, yy2, e2.done ? C.dgreen : C.orange, { shadow: null }); yy2 += 12;
      var dl = wrap(up(e2.def.desc || e2.def.text || ''), pw - 12);
      var room = Math.floor((152 - yy2) / 10);
      if (dl.length > room) { dl = dl.slice(0, room - 1); dl.push((blink(2) ? '▼ ' : '  ') + bn('confirm') + ': READ ALL'); }
      dl.forEach(function (t, i) { T(t, px + 6, yy2 + i * 10, t.indexOf('READ ALL') >= 0 ? C.gold : C.white); });
    };
    return push(m);
  };

  /* ================================================================
     INVENTORY  (explosives, consumables, materials, key items)
     ================================================================ */
  ui.openInventory = function () {
    var m = { kind: 'inventory', sel: 0, scroll: 0, msg: '', msgT: 0 };
    var VIS = 12;
    function rows() {
      var r = getRun() || {}, items = r.items || {}, defs = D('items') || {};
      var out = [{ head: 'EXPLOSIVES' }];
      EXPLOSIVES.forEach(function (id) { out.push({ id: id, kind: 'explosive', n: itemCount(id) }); });
      var groups = { consumable: [], material: [], key: [] };
      Object.keys(items).forEach(function (id) {
        if (EXPLOSIVES.indexOf(id) >= 0 || !(items[id] > 0)) return;
        var k = (defs[id] && defs[id].kind) || 'key';
        if (k === 'explosive') { out.splice(EXPLOSIVES.length + 1, 0, { id: id, kind: 'explosive', n: items[id] }); return; }
        (groups[k === 'consumable' || k === 'food' ? 'consumable' : k === 'material' ? 'material' : 'key']).push({ id: id, kind: k, n: items[id] });
      });
      out.push({ head: 'CONSUMABLES' }); out.push({ id: 'potion', kind: 'consumable', n: itemCount('potion') });
      groups.consumable.forEach(function (e) { out.push(e); });
      if (groups.material.length) { out.push({ head: 'MATERIALS' }); groups.material.forEach(function (e) { out.push(e); }); }
      out.push({ head: 'KEY ITEMS' });
      if (groups.key.length) groups.key.forEach(function (e) { out.push(e); }); else out.push({ none: true });
      return out;
    }
    function selectable(rs) { return rs.map(function (r, i) { return r.id ? i : -1; }).filter(function (i) { return i >= 0; }); }
    function say2(t, col) { m.msg = up(t); m.msgCol = col || C.green; m.msgT = 1.6; }
    m.update = function (dt) {
      m.t += dt; if (m.msgT > 0) m.msgT -= dt;
      var rs = rows(), sel = selectable(rs);
      listNav(m, sel.length, dt);
      var ri = sel[m.sel], row = rs[ri];
      // scroll by row index
      if (ri !== undefined) { var s0 = m.scroll; if (ri - 1 < s0) s0 = Math.max(0, ri - 1); if (ri >= s0 + VIS) s0 = ri - VIS + 1; m.scroll = clamp(s0, 0, Math.max(0, rs.length - VIS)); }
      if (P('confirm') && row) {
        var r = getRun();
        if (row.kind === 'explosive') {
          if (!r) { sfx('error'); return; }
          if (!(row.n > 0)) { sfx('error'); say2('NONE LEFT. BUY OR CRAFT MORE.', C.red); return; }
          if (hasG('selectExplosive')) G('selectExplosive', row.id); else { r.selected = row.id; persist(); }
          sfx('menu_select'); say2(itemName(row.id) + ' READY');
        } else if (row.id === 'potion') {
          if (G('usePotion')) say2('GULP. HP RESTORED.'); else { sfx('error'); say2(itemCount('potion') ? 'YOU\'RE FINE. SAVE IT.' : 'NO POTIONS.', C.red); }
        } else {
          var d = itemDef(row.id) || {}; sfx('menu_select');
          ui.readMore({ title: itemName(row.id), titleColor: C.gold, blocks: [{ text: d.desc || 'IT\'S A THING. YOU HAVE IT. CONGRATULATIONS.', color: C.white }] });
        }
      } else if ((P('special') || P('select')) && row) {
        var dd = itemDef(row.id) || {}; sfx('menu_select');
        ui.readMore({ title: itemName(row.id), titleColor: C.gold, blocks: [{ text: dd.desc || '', color: C.white }] });
      } else if (backPressed() || P('start')) { sfx('menu_back'); close(m); }
    };
    m.draw = function (ctx) {
      var rs = rows(), sel = selectable(rs), run = getRun() || {}, ri = sel[m.sel];
      frame(ctx, 'INVENTORY', { footer: bn('confirm') + ':USE / SELECT  ' + bn('special') + ':INFO  ' + bn('back') + ':BACK' });
      icon(ctx, 'coin', 12, 20); T(run.gold || 0, 22, 21, C.gold);
      icon(ctx, 'box', 70, 20); T((run.boxes || []).length, 80, 21, C.white);
      icon(ctx, 'heart', 104, 20); T(run.revivals === undefined ? '-' : run.revivals, 114, 21, C.pink);
      for (var i = m.scroll; i < Math.min(rs.length, m.scroll + VIS); i++) {
        var e = rs[i], yy = 33 + (i - m.scroll) * 10;
        if (e.head) { T(e.head, 12, yy, C.dgray, { shadow: null }); R(12 + tw(e.head) + 4, yy + 3, 136 - tw(e.head) - 4, 1, '#2c3c7c'); continue; }
        if (e.none) { T('NOTHING YET', 24, yy, C.ddgray, { shadow: null }); continue; }
        var on = i === ri;
        if (on) { R(10, yy - 1, 142, 10, '#1c2c5c'); cursor(12, yy); }
        icon(ctx, itemIcon(e.id), 21, yy - 1);
        var isSel = e.kind === 'explosive' && run.selected === e.id;
        var nmc = isSel ? C.gold : e.n > 0 ? (on ? C.white : C.gray) : C.ddgray;
        T(fitText(itemName(e.id), 98), 32, yy, nmc);
        T('×' + e.n, 150, yy, e.n > 0 ? C.white : C.dred, { align: 'right' });
      }
      scrollArrows(140, 28, 152, m.scroll, VIS, rs.length);
      var row = rs[ri]; if (!row) return;
      var px = 158, pw = 152, d = itemDef(row.id) || {};
      DCW.box(px, 20, pw, 138, { fill: '#101828' });
      R(px + 6, 26, 20, 20, '#000'); icon(ctx, itemIcon(row.id), px + 8, 28, { scale: 2 });
      wrap(itemName(row.id), pw - 40).slice(0, 2).forEach(function (t, k) { T(t, px + 32, 27 + k * 10, C.gold); });
      var kindTxt = row.id === 'potion' ? 'CONSUMABLE' : up(d.kind || row.kind || 'ITEM');
      T(kindTxt + '  ×' + row.n, px + 6, 52, C.dgray, { shadow: null });
      var yy2 = 64;
      if (row.kind === 'explosive') {
        var st = pStats(), dm = { jug: st.jugDmg, hob: st.hobDmg, dyn: st.dynDmg, smoke: 0 }[row.id];
        if (dm !== undefined) { T('DAMAGE ' + (dm || 'NONE'), px + 6, yy2, C.white); yy2 += 10; }
        T(run.selected === row.id ? '● SELECTED' : bn('confirm') + ': SELECT', px + 6, yy2, run.selected === row.id ? C.gold : C.dgray); yy2 += 12;
      }
      var desc = d.desc || (row.id === 'potion' ? 'HEALS HALF YOUR HP. CHERRY FLAVOR, ALLEGEDLY.' : '');
      var dl = wrap(up(desc), pw - 12), room = Math.floor((154 - yy2) / 10);
      if (dl.length > room) { dl = dl.slice(0, room - 1); dl.push((blink(2) ? '▼ ' : '  ') + bn('special') + ': READ MORE'); }
      dl.forEach(function (t, k) { T(t, px + 6, yy2 + k * 10, t.indexOf('READ MORE') >= 0 ? C.white : C.gray); });
      if (m.msgT > 0) { DCW.box(px + 3, 139, pw - 6, 16, { fill: '#000', border: m.msgCol }); T(fitText(m.msg, pw - 14), px + pw / 2, 143, m.msgCol, { align: 'center' }); }
    };
    return push(m);
  };

  /* ================================================================
     HOW TO PLAY
     ================================================================ */
  var HOWTO = [
    { title: 'KEYBOARD', rows: function () {
      var mv = ['left', 'right', 'up', 'down'].map(function (a) { return kbName(a, '?'); }).join(' ');
      return [['MOVE', mv], ['JUMP / OK', kbBoth('jump')], ['PUNCH / BACK', kbBoth('attack')], ['THROW', kbBoth('bomb')],
        ['SPECIAL', kbBoth('special')], ['POTION', kbBoth('potion')], ['PAUSE', 'ENTER / ESC' + (kbName('start', '') ? ' / ' + kbName('start', '') : '')],
        ['MAP / GEAR', kbBoth('select')]];
    } },
    { title: 'GAMEPAD', rows: [['MOVE', 'D-PAD / STICK'], ['JUMP / OK', 'A (BOTTOM)'], ['PUNCH', 'X (LEFT)'], ['THROW / BACK', 'B (RIGHT)'], ['SPECIAL', 'Y (TOP)'], ['POTION', 'BUMPERS / TRIGGERS'], ['PAUSE', 'START'], ['MAP / GEAR', 'SELECT']] },
    { title: 'TOUCH', rows: [['MOVE', 'LEFT PAD'], ['JUMP / OK', 'A BUTTON'], ['PUNCH / BACK', 'B BUTTON'], ['THROW', 'BOMB BUTTON'], ['SPECIAL', 'SPC BUTTON'], ['POTION', 'POT BUTTON'], ['PAUSE', 'START (TOP RIGHT)'], ['MAP / GEAR', 'MAP (TOP RIGHT)']] },
    { title: 'MOVES', rows: [['PUNCH COMBO', 'TAP PUNCH'], ['KICK', 'DOWN + PUNCH'], ['STOMP', 'DOWN + PUNCH IN AIR'], ['THROW EXPLOSIVE', 'THROW'], ['NEXT EXPLOSIVE', 'UP + THROW'], ['PANIC (FEAR + MISSILES)', 'SPECIAL'], ['BOOMY BOY', 'DOWN + SPECIAL'], ['MIC DROP', 'UP + SPECIAL']] },
    { title: 'THE OVER CITY', rows: [['DOORS, NPCS, SIGNS', 'UP'], ['DAY', 'GUARDS. NO CRIMES.'], ['NIGHT', 'NO GUARDS. WORSE SHIT.'], ['HURT A CITIZEN', 'DEATH PENALTY'], ['INNS', 'SLEEP, CRAFT, LEVEL, BOXES'], ['THE CLOCK', '8 DAYS, THEN COLLAPSE'], ['THE MAP', 'SIGNPOST ROCKS'], ['SELECT', 'STREETS: MAP. ELSEWHERE: GEAR']] }
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
        var yy = 41 + i * 12; T(r[0], 20, yy, C.gold); T(r[1], 300, yy, C.white, { align: 'right' });
        var lx = 20 + tw(r[0]) + 4, rx = 300 - tw(r[1]) - 4; if (rx - lx > 4) R(lx, yy + 6, rx - lx, 1, '#2c3c7c');
      });
      T(m.page === 0 ? 'REBIND KEYS IN SETTINGS > KEYBOARD CONTROLS' : '8 DAYS. ONE FLOOR. STILL NO GODDAMN PANTS.', 160, 142, C.pink, { align: 'center' });
    };
    return push(m);
  };

  /* ================================================================
     UPDATE / DRAW (called by engine every frame)
     ================================================================ */
  ui.init = function () {
    stack.length = 0; toasts.length = 0; toastQ.length = 0; banner = null; miniC = {};
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
     BACKDROPS + VIGNETTES (shared by scenes; used when art.js has no backdrop)
     ================================================================ */
  var STARS = null;
  function stars(ctx, t, drift, n, yMax) {
    if (!STARS) { var rr = U.rng ? U.rng(1337) : Math.random; STARS = []; for (var i = 0; i < 120; i++) STARS.push({ x: rr() * W, y: rr() * H, s: rr(), p: rr() * 6.28 }); }
    n = n || 90; yMax = yMax || H;
    for (var k = 0; k < n; k++) {
      var st = STARS[k]; if (st.y > yMax) continue;
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
  function pdiscIn(ctx, cx, cy, r, px, py, pr, col) {
    for (var y = -r; y <= r; y++) {
      var yy = cy + y, dy = yy - py; if (Math.abs(dy) > pr) continue;
      var w = Math.sqrt(r * r - y * y), pw = Math.sqrt(pr * pr - dy * dy);
      var a = Math.max(cx - w, px - pw), b = Math.min(cx + w, px + pw);
      if (b > a) R(Math.round(a), yy, Math.round(b - a), 1, col);
    }
  }
  // the fake Over City sky: nebula smears + stars (night) or crimson haze (day)
  function overSky(ctx, t, night, y1) {
    y1 = y1 || H;
    if (night) {
      bands(ctx, ['#05021a', '#0a0424', '#10062e', '#180838', '#200a40', '#2c0c44', '#3c0c40'], 0, y1);
      ctx.save();
      [[70, 30, 30, '#d800cc'], [120, 22, 22, '#00a8a8'], [230, 40, 34, '#881488'], [280, 18, 20, '#3c5cb8']].forEach(function (n, i) {
        for (var k = 0; k < 3; k++) { ctx.globalAlpha = 0.05; pdisc(ctx, n[0] + Math.round(Math.sin(t * 0.1 + i) * 4) + k * 6, n[1] + k * 3, Math.round(n[2] * (1 - k * 0.28)), n[3]); }
      });
      ctx.restore();
      stars(ctx, t, 1, 90, y1 - 20);
    } else {
      bands(ctx, ['#3c0808', '#581008', '#741408', '#901c08', '#a82808', '#c03810', '#d85818'], 0, y1);
      pdisc(ctx, 250, Math.round(y1 * 0.42), 20, '#f83800'); pdisc(ctx, 250, Math.round(y1 * 0.42), 15, '#fca044');
    }
  }
  function ruins(ctx, y, seed, col, t) {
    var rr = U.rng ? U.rng(seed) : Math.random, x = -6;
    while (x < W) {
      var bw = 14 + Math.floor(rr() * 24), bh = 18 + Math.floor(rr() * 44);
      R(x, y - bh, bw, bh + 60, col);
      for (var k = 0; k < 3; k++) R(x + Math.floor(rr() * bw), y - bh - 2 - Math.floor(rr() * 4), 2 + Math.floor(rr() * 3), 4, col);
      x += bw + Math.floor(rr() * 6);
    }
  }
  function rooftops(ctx, y, seed, col, lit, t) {
    var rr = U.rng ? U.rng(seed) : Math.random, x = -8;
    ctx.fillStyle = col;
    while (x < W) {
      var bw = 20 + Math.floor(rr() * 18), bh = 14 + Math.floor(rr() * 18), rh = 8 + Math.floor(rr() * 10);
      R(x, y - bh, bw, bh + 60, col);
      ctx.beginPath(); ctx.moveTo(x - 2, y - bh); ctx.lineTo(x + bw / 2, y - bh - rh); ctx.lineTo(x + bw + 2, y - bh); ctx.closePath(); ctx.fill();
      if (rr() < 0.5) R(x + bw - 7, y - bh - rh + 2, 3, rh, col);
      if (lit) for (var wy = y - bh + 4; wy < y - 4; wy += 7) for (var wx = x + 4; wx < x + bw - 4; wx += 7) if (rr() < 0.45) R(wx, wy, 2, 3, lit);
      x += bw + 2 + Math.floor(rr() * 5);
    }
  }
  function bigTop(ctx, cx, y, col, stripe) {
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.moveTo(cx - 44, y); ctx.lineTo(cx - 30, y - 22); ctx.lineTo(cx, y - 40); ctx.lineTo(cx + 30, y - 22); ctx.lineTo(cx + 44, y); ctx.closePath(); ctx.fill();
    if (stripe) { for (var i = -3; i <= 3; i++) { ctx.fillStyle = stripe; ctx.beginPath(); ctx.moveTo(cx, y - 40); ctx.lineTo(cx + i * 12 - 3, y); ctx.lineTo(cx + i * 12 + 3, y); ctx.closePath(); ctx.fill(); } }
    R(cx - 1, y - 50, 2, 11, col); R(cx + 1, y - 50, 7, 4, stripe || col);
  }
  function slats(ctx, y, t, smoke) {
    R(0, y, W, H - y, '#3c2414');
    for (var x = 0; x < W; x += 10) { R(x, y, 9, H - y, '#5c3c24'); R(x, y, 9, 1, '#7c5c3c'); }
    if (smoke) for (var s = 0; s < 8; s++) {
      var sx = (s * 43 + 17) % W, ph = (t * 0.4 + s * 0.37) % 1;
      ctx.globalAlpha = 0.25 * (1 - ph); R(sx + Math.sin(t + s) * 3, y - ph * 40, 3, 3, '#bcbcbc'); ctx.globalAlpha = 1;
    }
  }

  // procedural rooms (fallbacks for art backdrops)
  function drawGuideRoom(ctx, t) {
    R(0, 0, W, H, '#0c0820');
    // fake starry ceiling
    bands(ctx, ['#060420', '#0a0630', '#0e0838'], 0, 44); stars(ctx, t, 0, 60, 40);
    // golden brick walls
    for (var y = 44; y < 136; y += 6) for (var x = ((y / 6) % 2) * 8 - 8; x < W; x += 16) { R(x, y, 15, 5, (x * 7 + y) % 5 === 0 ? '#ac7c00' : '#c88c10'); R(x, y, 15, 1, '#f8b800'); }
    R(0, 44, W, 3, '#5c3c00');
    // the guide's door at the back center
    R(140, 70, 40, 66, '#000'); R(142, 72, 36, 64, '#7c3c18'); R(142, 72, 36, 3, '#a85010'); R(172, 102, 3, 3, C.gold);
    T('GUIDE', 160, 60, '#5c3c00', { align: 'center', shadow: null });
    // floor + red carpet in perspective
    R(0, 136, W, 44, '#3c2c10'); for (var fx = 0; fx < W; fx += 20) R(fx, 136, 1, 44, '#2c1c08');
    ctx.fillStyle = '#a81000'; ctx.beginPath(); ctx.moveTo(144, 136); ctx.lineTo(176, 136); ctx.lineTo(236, H); ctx.lineTo(84, H); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#f8b800'; ctx.fillRect(144, 136, 32, 1);
    // sconces
    [60, 260].forEach(function (sx) { R(sx - 2, 80, 4, 10, '#503000'); var fl = Math.sin(t * 9 + sx) > 0; R(sx - 2, 75 - (fl ? 1 : 0), 4, 5, fl ? C.yellow : C.orange); ctx.globalAlpha = 0.12; pdisc(ctx, sx, 78, 16, C.yellow); ctx.globalAlpha = 1; });
  }
  var INN_LOOK = {
    pug: { beam: '#3c2010', plaster: '#7c6040', shade: '#6c5034', floor: '#5c3418', floor2: '#4c2c14', banner: ['#a81000', '#f8b800', '#0058f8'] },
    narwhal: { beam: '#1c2434', plaster: '#3c5c6c', shade: '#30505c', floor: '#3c3c4c', floor2: '#2c2c3c', banner: ['#00a844', '#fcfcfc', '#0058f8'] }
  };
  // same layout as art.js's inn backdrops: hearth left, red window, three TVs, keg shelf + bar right (top y=120)
  function drawInnRoom(ctx, innId, t, ground) {
    var L = INN_LOOK[innId] || INN_LOOK.pug;
    R(0, 0, W, ground, L.plaster);
    for (var y = 30; y < ground; y += 12) R(0, y, W, 1, L.shade);
    R(0, 0, W, 20, L.beam); R(0, 20, W, 2, '#000');
    [0, 88, 168, 248].forEach(function (bx) { R(bx, 22, 6, ground - 22, L.beam); });
    R(0, 66, W, 4, L.beam);
    for (var px = 2; px < W; px += 12) {
      var sag = Math.round(Math.sin((px / W) * Math.PI * 3) * 3) + 24;
      ctx.fillStyle = L.banner[(px / 12 | 0) % 3]; ctx.beginPath(); ctx.moveTo(px, sag); ctx.lineTo(px + 10, sag); ctx.lineTo(px + 5, sag + 8); ctx.closePath(); ctx.fill();
    }
    // hearth
    R(5, 72, 80, 78, '#3e3331'); for (var sy = 74; sy < 150; sy += 6) for (var sx = 7 + ((sy / 6) % 2) * 6; sx < 83; sx += 12) R(sx, sy, 10, 4, '#5b4c47');
    R(3, 68, 84, 5, L.beam); R(20, 96, 50, 54, '#24100a');
    for (var f = 0; f < 8; f++) { var fh = 8 + Math.round(Math.abs(Math.sin(t * 9 + f * 1.7)) * 12); R(24 + f * 6, 150 - fh, 4, fh, f % 2 ? '#f8b800' : '#cc4114'); }
    for (var mg = 0; mg < 5; mg++) { R(12 + mg * 14, 62, 7, 6, '#fcfcfc'); R(13 + mg * 14, 63, 5, 5, '#a87c48'); }
    // red window
    R(96, 88, 34, 34, '#24100a'); R(98, 90, 30, 30, '#781418'); R(112, 90, 2, 30, '#24100a'); R(98, 104, 30, 2, '#24100a'); pdisc(ctx, 120, 97, 4, '#f83800');
    // three TVs
    for (var s = 0; s < 3; s++) {
      var tx = 106 + s * 46, ty = 34;
      R(tx, ty, 40, 30, '#000'); R(tx + 2, ty + 2, 36, 26, s === 0 ? '#0c1c3c' : '#071521');
      if (s === 0) { R(tx + 10, ty + 9, 5, 4, C.blue); R(tx + 25, ty + 9, 5, 4, C.blue); R(tx + 12, ty + 19, 16, 2, C.blue); }
      else { R(tx + 16, ty + 8, 8, 6, '#fcd8a8'); R(tx + 14, ty + 14, 12, 12, s === 1 ? '#7c3c18' : '#503000'); if (blink(1.2)) R(tx + 4, ty + 4, 3, 3, C.red); }
    }
    // wall trophy: a belly-up pug painting / a one-eyed narwhal head
    if (innId === 'narwhal') { R(252, 34, 30, 16, '#000'); R(253, 35, 28, 14, '#bcbcbc'); R(281, 40, 30, 2, '#fcfcfc'); R(256, 38, 5, 4, '#000'); R(262, 37, 3, 6, '#000'); }
    else { R(250, 26, 52, 34, '#ac7c00'); R(253, 29, 46, 28, '#c8a070'); R(262, 40, 28, 12, '#a87850'); R(266, 36, 8, 6, '#a87850'); R(268, 38, 2, 2, '#000'); R(280, 50, 8, 3, '#f8b8f8'); }
    // keg shelf + bar
    R(196, 82, 116, 30, '#24100a'); for (var k = 0; k < 5; k++) { R(200 + k * 22, 86, 20, 22, '#7c4c24'); R(200 + k * 22, 90, 20, 1, '#3c2010'); R(200 + k * 22, 102, 20, 1, '#3c2010'); R(209 + k * 22, 96, 3, 3, '#bcbcbc'); }
    R(150, 120, 170, 4, '#8c5028'); R(150, 124, 170, 26, '#5c3014'); for (var cp = 156; cp < 320; cp += 28) R(cp, 128, 22, 18, '#4c2810');
    R(0, ground, W, H - ground, L.floor);
    for (var fy = ground; fy < H; fy += 10) { R(0, fy, W, 1, L.floor2); for (var fx = ((fy / 10) % 2) * 24; fx < W; fx += 48) R(fx, fy, 1, 10, L.floor2); }
    R(0, ground, W, 2, '#784923');
  }
  // same layout as art.js's club backdrop: neon window center, sign under it, lounge ledge left, bar right, dance floor from y=140
  function drawClubRoom(ctx, t, hype, ground) {
    hype = hype || 0;
    bands(ctx, ['#08040c', '#0a0414', '#10061c', '#14081c'], 0, 140);
    stars(ctx, t, 0, 30, 110);
    for (var bx = 0; bx < W; bx += 4) { var by = 6 + Math.round(Math.sin(bx * 0.04) * 4 + 4); R(bx, by, 2, 2, ['#881488', '#f8b800', '#00a800'][(bx / 4 | 0) % 3]); }
    R(95, 15, 130, 74, '#000'); R(97, 17, 126, 70, '#04102c');
    for (var b = 0; b < 12; b++) { var hh = 16 + ((b * 13) % 36); R(99 + b * 10, 87 - hh, 8, hh, '#0c1c3c'); if ((b + Math.floor(t)) % 3) R(101 + b * 10, 87 - hh + 3, 2, 2, b % 2 ? C.pink : C.cyan); }
    for (var rn = 0; rn < 22; rn++) { var ry = (t * 90 + rn * 23) % 66; R(98 + (rn * 17) % 124, 18 + ry, 1, 4, '#3c5c9c'); }
    R(159, 15, 2, 74, '#000'); R(95, 50, 130, 2, '#000');
    pdisc(ctx, 160, 14, 7, '#bcbcbc'); for (var q = 0; q < 6; q++) R(155 + q * 2, 10 + ((q + Math.floor(t * 6)) % 3) * 3, 1, 1, C.white);
    R(96, 92, 126, 16, '#000'); R(97, 93, 124, 14, '#1c0c24');
    T('DESPERADO CLUB', 160, 97, Math.sin(t * 13) > -0.85 ? C.pink : '#5c003c', { align: 'center', shadow: null });
    [[30, 40, '#881488', '#f8b800'], [272, 38, '#00a800', '#d800cc']].forEach(function (mk) { R(mk[0], mk[1], 18, 8, mk[2]); R(mk[0] + 3, mk[1] + 2, 4, 3, '#000'); R(mk[0] + 11, mk[1] + 2, 4, 3, '#000'); R(mk[0] + 8, mk[1] + 8, 2, 7, mk[3]); });
    R(0, 116, 70, 2, C.cyan); R(0, 118, 70, 22, '#1c0c24'); pdisc(ctx, 20, 112, 4, '#2c2c3c'); pdisc(ctx, 46, 112, 4, '#2c2c3c');
    R(240, 116, 80, 2, C.pink); R(240, 118, 80, 22, '#1c0c24');
    for (var bt = 0; bt < 12; bt++) R(244 + bt * 6, 102, 3, 12, [C.cyan, C.yellow, C.pink, C.green][bt % 4]);
    for (var sp = 0; sp < 18 + hype * 22; sp++) { var a = t * (0.6 + hype) + sp * 0.9, r2 = 30 + (sp * 37) % 130; R(160 + Math.cos(a) * r2 * 1.3, 20 + Math.abs(Math.sin(a * 1.3)) * 110, 2, 1, [C.white, C.pink, C.cyan, C.yellow][sp % 4]); }
    R(0, 120, W, 20, '#08040c');
    for (var tx = 0; tx < W; tx += 20) for (var ty = 140; ty < H; ty += 10) {
      var lit = ((tx / 20 | 0) + (ty / 10 | 0) + Math.floor(t * (2 + hype * 6))) % 6;
      R(tx + 1, ty + 1, 18, 8, ['#745506', '#332178', '#8c007d', '#009f41', '#042a76', '#6b022e'][lit]);
    }
  }
  function drawStudio(ctx, t, green) {
    bands(ctx, green ? ['#0c1c0c', '#102410', '#142c14', '#183418'] : ['#1c0024', '#24002c', '#2c0034', '#34003c'], 0, 140);
    for (var i = 0; i < 4; i++) { ctx.globalAlpha = 0.1; ctx.fillStyle = C.yellow; ctx.beginPath(); var sx = 160 + Math.sin(t * 0.8 + i * 1.6) * 120; ctx.moveTo(40 + i * 80, 0); ctx.lineTo(sx - 20, 140); ctx.lineTo(sx + 20, 140); ctx.fill(); ctx.globalAlpha = 1; }
    if (green) { R(30, 60, 70, 40, '#2c2c2c'); R(32, 62, 66, 36, '#5c5c5c'); for (var b = 0; b < 8; b++) { pdisc(ctx, 36 + b * 8, 62, 2, C.yellow); } R(220, 90, 70, 30, '#7c3c18'); R(222, 86, 66, 6, '#a85010'); }
    else { T('DANGER ZONE', 160, 30, blink(1.5) ? C.red : C.orange, { align: 'center', scale: 2 }); }
    R(0, 140, W, 40, green ? '#203020' : '#3c1c3c'); R(0, 140, W, 1, C.gray);
  }
  // fallback for cinema backgrounds by theme
  var INTERIORS = { basement: '#1c1410', nest: '#1c0c0c', depot: '#141c24', restroom: '#1c2c2c', temple: '#1c1028', school: '#241c10', office: '#20202c', ymca: '#1c2024', admin: null };
  function themeBackdrop(ctx, theme, t, night, camX) {
    theme = theme || 'village';
    if (theme === 'guide_room') { drawGuideRoom(ctx, t); return; }
    if (/^inn/.test(theme)) { drawInnRoom(ctx, theme.replace(/^inn_?/, '') || 'pug', t, 150); return; }
    if (theme === 'club') { drawClubRoom(ctx, t, 0, 150); return; }
    if (theme === 'studio' || theme === 'greenroom') { drawStudio(ctx, t, theme === 'greenroom'); return; }
    if (INTERIORS[theme]) {
      R(0, 0, W, H, INTERIORS[theme]);
      for (var y = 10; y < 150; y += 10) for (var x = ((y / 10) % 2) * 12 - 12; x < W; x += 24) R(x - (camX || 0) % 24, y, 23, 9, 'rgba(255,255,255,0.04)');
      R(0, 150, W, 30, '#0c0808'); R(0, 150, W, 1, '#3c3c3c');
      return;
    }
    overSky(ctx, t, night, 150);
    var ox = -Math.round((camX || 0) * 0.3) % 40;
    ctx.save(); ctx.translate(ox, 0);
    if (theme === 'circus') { ruins(ctx, 150, 7, night ? '#140820' : '#2c0c08', t); bigTop(ctx, 170, 150, night ? '#0c0414' : '#1c0404', night ? '#2c0c2c' : '#3c0c08'); }
    else if (theme === 'village' || theme === 'settlement' || theme === 'admin') rooftops(ctx, 150, theme === 'village' ? 3 : 11, night ? '#0c0618' : '#2c0c08', night ? '#f8d878' : null, t);
    else ruins(ctx, 150, theme.length * 7 + 1, night ? '#0c0618' : '#2c0c08', t);
    ctx.restore();
    slats(ctx, 150, t, true);
  }
  ui.themeBackdrop = themeBackdrop;
  var VIG = {
    overcity: function (ctx, t, x, y, w, h) { overSky(ctx, t, false, y + h); ruins(ctx, y + h - 10, 5, '#2c0c08', t); rooftops(ctx, y + h, 9, '#140404', null, t); },
    night: function (ctx, t, x, y, w, h) { overSky(ctx, t, true, y + h); rooftops(ctx, y + h, 4, '#000', '#f8d878', t); },
    circus: function (ctx, t, x, y, w, h) { overSky(ctx, t, true, y + h); ruins(ctx, y + h, 7, '#140820', t); bigTop(ctx, x + w / 2, y + h, '#0c0414', '#3c0c2c'); },
    collapse: function (ctx, t, x, y, w, h) {
      overSky(ctx, t, false, y + h);
      for (var i = 0; i < 9; i++) { var fx = x + 12 + i * 34, fall = ((t * 30 + i * 17) % (h + 40)) - 20; R(fx, y + fall, 14 + (i % 3) * 6, 10, '#1c0404'); }
      ctx.save(); ctx.globalAlpha = 0.5; R(x, y + h - 26 + Math.round(Math.sin(t * 20) * 2), w, 26, '#000'); ctx.restore();
      for (var c = 0; c < 6; c++) { var cx = x + 20 + c * 50; R(cx, y + h - 26, 2, 26, C.orange); R(cx + 2, y + h - 16, 6, 2, C.orange); }
    },
    greenroom: function (ctx, t, x, y, w, h) { drawStudio(ctx, t, true); },
    studio: function (ctx, t, x, y, w, h) { drawStudio(ctx, t, false); },
    doomsday: function (ctx, t, x, y, w, h) {
      R(x, y, w, h, '#05030c'); stars(ctx, t, 0.5, 40);
      var cx = x + w / 2, cy = y + h / 2 + 6, gl = 0.25 + 0.2 * Math.sin(t * 5);
      ctx.globalAlpha = gl; pdisc(ctx, cx, cy, 36, C.cyan); ctx.globalAlpha = 1;
      R(cx - 18, cy - 26, 36, 44, '#a4e4fc'); R(cx - 16, cy - 24, 32, 40, '#0c1c2c');
      ctx.fillStyle = (Math.floor(t * 8) % 2) ? C.cyan : C.white; ctx.beginPath(); ctx.moveTo(cx, cy - 16); ctx.lineTo(cx + 8, cy - 2); ctx.lineTo(cx, cy + 12); ctx.lineTo(cx - 8, cy - 2); ctx.closePath(); ctx.fill();
      R(cx - 22, cy + 18, 44, 4, '#5c5c5c');
    },
    screen: function (ctx, t, x, y, w, h) {
      R(x, y, w, h, '#100018');
      for (var i = 0; i < 6; i++) { ctx.globalAlpha = 0.08; ctx.fillStyle = i % 2 ? C.purple : C.blue; ctx.beginPath(); var a = Math.sin(t * 0.7 + i) * 0.5; ctx.moveTo(x + w / 2, y - 10); ctx.lineTo(x + w / 2 + Math.sin(a + i) * 200 - 20, y + h); ctx.lineTo(x + w / 2 + Math.sin(a + i) * 200 + 20, y + h); ctx.fill(); ctx.globalAlpha = 1; }
      bigSprite(ctx, 'ai_screen', x + w / 2, y + h - 22 + Math.round(Math.sin(t * 2) * 3), { scale: 3, frame: Math.floor(t * 3) });
      T('● LIVE', x + 8, y + 6, blink(1.2) ? C.red : C.dred);
      T('VIEWERS ' + fmtNum(372000000 + Math.floor(t * 4321)), x + w - 6, y + 6, C.pink, { align: 'right' });
    },
    carl: function (ctx, t, x, y, w, h) {
      overSky(ctx, t, true, y + h - 20);
      rooftops(ctx, y + h - 20, 5, '#000', '#3c3c00', t);
      slats(ctx, y + h - 20, t, true);
      bigSprite(ctx, actorName('carl', 'idle'), x + w / 2 - 22, y + h - 8, { scale: 2, skin: equipped('skin'), frame: Math.floor(t * 2) });
      bigSprite(ctx, actorName('donut', 'idle'), x + w / 2 + 26, y + h - 8, { scale: 2, frame: Math.floor(t * 2), flip: true });
    },
    stairs: function (ctx, t, x, y, w, h) {
      R(x, y, w, h, '#0c0c10');
      R(x, y + h - 36, w, 36, '#2c2420'); R(x, y + h - 36, w, 2, '#4c3c30');
      var cx = x + w / 2 + 40, top2 = y + h - 30;
      var gl = 0.25 + 0.15 * Math.sin(t * 3);
      ctx.globalAlpha = gl; pdisc(ctx, cx, top2 + 8, 34, '#58d854'); ctx.globalAlpha = 1;
      for (var s = 0; s < 5; s++) R(cx - 22 + s * 2, top2 + s * 5, 44 - s * 4, 5, s % 2 ? '#1c1c1c' : '#2c2c2c');
      R(cx - 24, top2 - 2, 48, 2, '#7c7c7c');
      var wx = x + 30 + ((t * 18) % 80);
      spr(ctx, actorName('carl', 'walk'), wx, y + h - 10, { frame: Math.floor(t * 8), skin: equipped('skin') });
      spr(ctx, actorName(compSprite('mongo'), 'walk'), wx - 18, y + h - 10, { frame: Math.floor(t * 8) });
      T('▼', cx, top2 - 16 + Math.round(Math.sin(t * 4) * 2), C.green, { align: 'center' });
    },
    crowd: function (ctx, t, x, y, w, h) {
      bands(ctx, ['#1c0010', '#2c0018', '#3c0020'], y, y + h);
      for (var i = 0; i < 5; i++) { ctx.globalAlpha = 0.12; ctx.fillStyle = C.yellow; ctx.beginPath(); var sx = x + w / 2 + Math.sin(t + i * 1.7) * 140; ctx.moveTo(x + 40 + i * 60, y); ctx.lineTo(sx - 18, y + h); ctx.lineTo(sx + 18, y + h); ctx.fill(); ctx.globalAlpha = 1; }
      bigSprite(ctx, hasArt('carl_victory') ? 'carl_victory' : actorName('carl', 'idle'), x + w / 2, y + h - 30, { scale: 2, skin: equipped('skin'), frame: Math.floor(t * 3) });
      for (var c = 0; c < 26; c++) {
        var hx = x + 6 + c * 12, hy = y + h - 12 + Math.round(Math.abs(Math.sin(t * 6 + c)) * -4);
        var hc = ['#58d854', '#3cbcfc', '#f878f8', '#fca044', '#d800cc'][c % 5];
        R(hx, hy, 9, 14, '#000'); R(hx + 1, hy + 1, 7, 7, hc); R(hx + 2, hy + 3, 1, 1, '#000'); R(hx + 5, hy + 3, 1, 1, '#000');
      }
      for (var k = 0; k < 30; k++) { var kx = (k * 53 + t * 20) % w, ky = (t * 30 + k * 17) % h; R(x + kx, y + ky, 2, 2, ['#f83800', '#f8b800', '#58d854', '#3cbcfc'][k % 4]); }
    }
  };
  VIG.earth = VIG.overcity; VIG.city = VIG.night;
  ui.vignettes = VIG;
  function drawVignette(ctx, name, t, panelId) {
    DCW.box(6, 6, 308, 112);
    ctx.save(); ctx.beginPath(); ctx.rect(8, 8, 304, 108); ctx.clip();
    try {
      R(8, 8, 304, 108, '#000');
      if (!(panelId && drawPanel(ctx, panelId, 32, 6, t)) && !(hasPanel(name) && !VIG[name] && drawPanel(ctx, name, 32, 6, t))) (VIG[name] || VIG.overcity)(ctx, t, 8, 8, 304, 108);
    } catch (e) { console.error(e); }
    ctx.restore();
  }

  /* ================================================================
     SCENES
     ================================================================ */
  var scenes = ui.scenes = {};

  /* ---------- story pages (intro + endings share this) ---------- */
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
      drawVignette(ctx, vig, p.t, pg.panel);
      DCW.box(6, 124, 308, 52);
      var tx = 14, total = pg._lines.join('').length;
      if (pg.portrait) { faceSlot(ctx, pg.portrait, 12, 130, p.shown < total, p.i); tx = 52; }
      var left = p.shown;
      pg._lines.forEach(function (l, i) { if (left <= 0) return; T(l.slice(0, Math.floor(left)), tx, 130 + i * 10, C.white); left -= l.length; });
      if (p.shown >= total && blink(2.5)) T('▼', 302, 164, C.gold);
      for (var d = 0; d < p.pages.length; d++) R(160 - p.pages.length * 4 + d * 8, 120, 4, 2, d === p.i ? C.gold : C.ddgray);
      T(bn('start') + ':SKIP', 312, 9, C.dgray, { align: 'right', shadow: null });
    };
    pages.forEach(function (pg) { pg._lines = wrap(up(pg.text || ''), pg.portrait ? 254 : 292).slice(0, 4); });
    return p;
  }
  function storyPages(key, fb) {
    var st = D('story'), src = st && st[key];
    var out = [];
    (Array.isArray(src) && src.length ? src : fb).forEach(function (pg) {
      if (typeof pg === 'string') pg = { text: pg };
      var txt = String(pg.text || '');
      var por = pg.portrait !== undefined ? pg.portrait : (pg.who ? portraitFor(pg.who) : null), vig = pg.vignette || pg.scene || pg.bg;
      var wl = wrap(up(txt), por ? 254 : 292);
      for (var i = 0; i < wl.length; i += 4) out.push({ text: wl.slice(i, i + 4).join(' '), portrait: por, vignette: vig, panel: pg.panel });
    });
    return out;
  }

  /* ---------- TITLE (+ book 1 import) ---------- */
  function canImport() {
    var s = save();
    return !!(DCW.legacy && DCW.legacy.book1) && !(s.meta && s.meta.imported) && hasG('importLegacy');
  }
  ui.canImport = canImport;
  function showImport(sum, then) {
    sum = sum || {};
    var m = { kind: 'import' };
    var skins = Array.isArray(sum.skins) ? sum.skins : [];
    var nSkins = Array.isArray(sum.skins) ? sum.skins.length : (+sum.skins || 0);
    var boxes = Array.isArray(sum.boxes) ? sum.boxes : [];
    var ttl = sum.title || (save().meta && save().meta.legacyTitle) || ((D('legacy') || {}).title) || 'BOOK 1 VETERAN';
    var quip = aiLine('import', 'WELL, WELL. A RETURNING CONTESTANT. THE AUDIENCE REMEMBERS YOU. MOSTLY YOUR FEET.');
    m.update = function (dt) { m.t += dt; if ((P('confirm') || backPressed() || P('start')) && m.t > 0.4) { sfx('menu_select'); close(m); if (then) then(); } };
    m.draw = function (ctx) {
      frame(ctx, 'BOOK 1 SAVE IMPORTED', { footer: bn('confirm') + ': NICE', border: C.gold });
      var y = 23;
      T('THESE CAME OVER FROM FLOOR 1 TO 2:', 14, y, C.gray); y += 13;
      icon(ctx, 'star', 14, y - 1); T('SKINS UNLOCKED: ' + nSkins, 26, y, C.yellow); y += 10;
      var nmax = sum.carry ? 2 : 6;
      var nm = skins.slice(0, nmax).map(skinName);
      for (var i = 0; i < nm.length; i += 2) { T(fitText(nm[i], 136), 30, y, C.white); if (nm[i + 1]) T(fitText(nm[i + 1], 136), 170, y, C.white); y += 9; }
      if (skins.length > nmax) { T('AND ' + (skins.length - nmax) + ' MORE', 30, y, C.dgray); y += 9; }
      y += 3;
      icon(ctx, 'eye', 14, y - 1); T('BOOK 1 ACHIEVEMENTS ON RECORD: ' + (sum.achievements || 0), 26, y, C.white); y += 10;
      icon(ctx, 'star', 14, y - 1); T('BOOK 1 WINS: ' + (sum.wins || 0), 26, y, C.white); y += 12;
      if (boxes.length) {
        icon(ctx, 'box', 14, y - 1); T('VETERAN BOXES, IN EVERY NEW CRAWL:', 26, y, C.white); y += 10;
        var bx2 = 30;
        boxes.forEach(function (b) { var n2 = up(tierName(b)); if (bx2 + tw(n2) > 306) { bx2 = 30; y += 9; } T(n2, bx2, y, boxColor(b)); bx2 += tw(n2) + 10; });
        y += 12;
      }
      T('TITLE: ' + up(ttl), 14, y, C.pink); y += 10;
      var cr = sum.carry;
      if (cr) {
        T('YOUR CRAWLER CARRIES ON: LV ' + cr.level + '  ' + fmtNum(cr.views) + ' VIEWS', 14, y, C.green); y += 9;
        T('STR ' + cr.stats.str + ' CON ' + cr.stats.con + ' DEX ' + cr.stats.dex + ' INT ' + cr.stats.int + '  ' + cr.gold + ' GOLD' + (cr.boxes.length ? '  +' + cr.boxes.length + ' BOXES' : ''), 14, y, C.white, { shadow: null });
      } else T('NO BOOK ONE CRAWLER ON FILE. YOU START FRESH.', 14, y, C.dgray, { shadow: null });
      DCW.box(10, 128, 300, 32, { fill: '#1c0c34' });
      faceSlot(ctx, 'p_ai', 11, 128, m.t < 1.5, 4);
      wrap(up(quip), 260).slice(0, 2).forEach(function (l, k) { T(l, 48, 134 + k * 10, C.white); });
    };
    return push(m);
  }
  ui.showImport = showImport;
  function doImport(then) {
    var sum = G('importLegacy');
    if (!sum) { sfx('error'); ui.toast('NOTHING TO IMPORT. THE BOOK 1 SAVE IS EMPTY OR ALREADY USED.', { icon: 'skull', color: C.red, time: 3.5 }); if (then) then(); return; }
    sfx('unlock'); sfx('fanfare');
    showImport(sum, then);
  }
  // DUNGEON CRAWLER (small) over CARL (big, chunky two-tone letters), the BOOK TWO ribbon and the subtitle.
  // Strict NES colors; drops in from the top like Book One's cartridge title.
  var LOGO = { crimson: '#a80020', rust: '#e45c10', dred: '#a81000', red: '#f83800', gold: '#f8b800', orange: '#fca044', white: '#fcfcfc', black: '#000000', yellow: '#f8d878' };
  function outlined(s, x, y, col, o) {
    o = o || {}; var sc = o.scale || 1, a = o.align || 'center';
    [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, 1], [-1, 1], [1, -1]].forEach(function (d) { T(s, x + d[0], y + d[1], LOGO.black, { align: a, scale: sc, shadow: null }); });
    if (o.shadow) T(s, x + 1, y + 2, o.shadow, { align: a, scale: sc, shadow: null });
    T(s, x, y, col, { align: a, scale: sc, shadow: null });
  }
  function drawLogo2(ctx, t) {
    var drop = Math.round(Math.max(0, 1 - t / 0.6) * 15) * 4;
    var y0 = 4 - drop;
    // DUNGEON CRAWLER
    T('DUNGEON CRAWLER', 160, y0 - 1, LOGO.black, { align: 'center', scale: 2, shadow: null });
    T('DUNGEON CRAWLER', 160, y0 + 1, LOGO.black, { align: 'center', scale: 2, shadow: null });
    T('DUNGEON CRAWLER', 162, y0 + 2, LOGO.dred, { align: 'center', scale: 2, shadow: null });
    T('DUNGEON CRAWLER', 160, y0, LOGO.white, { align: 'center', scale: 2, shadow: null });
    // CARL: black outline, crimson drop shadow, gold over orange over rust, a glint every few seconds
    var cy = y0 + 19, s = 5, word = 'CARL';
    var o = [[-2, 0], [2, 0], [0, -2], [0, 2], [-2, -2], [2, 2], [-2, 2], [2, -2]];
    T(word, 164, cy + 4, LOGO.crimson, { align: 'center', scale: s, shadow: null });
    o.forEach(function (d) { T(word, 160 + d[0], cy + d[1], LOGO.black, { align: 'center', scale: s, shadow: null }); });
    T(word, 160, cy, LOGO.gold, { align: 'center', scale: s, shadow: null });
    ctx.save(); ctx.beginPath(); ctx.rect(0, cy + 20, W, 20); ctx.clip();
    T(word, 160, cy, LOGO.orange, { align: 'center', scale: s, shadow: null });
    ctx.restore();
    ctx.save(); ctx.beginPath(); ctx.rect(0, cy + 25, W, 15); ctx.clip();
    T(word, 160, cy, LOGO.rust, { align: 'center', scale: s, shadow: null });
    ctx.restore();
    var gl = (t % 4) / 0.5;
    if (gl < 1 && t > 0.6) { var gx = Math.round(100 + gl * 120); ctx.save(); ctx.beginPath(); ctx.rect(gx, cy, 4, 35); ctx.clip(); T(word, 160, cy, LOGO.white, { align: 'center', scale: s, shadow: null }); ctx.restore(); }
    // BOOK TWO ribbon with swallow-tail ends
    var ry = y0 + 58, rl = 'BOOK TWO', rw = tw(rl) + 22, rx = Math.round(160 - rw / 2);
    R(rx - 10, ry + 3, 12, 11, LOGO.black); R(rx - 9, ry + 4, 10, 9, LOGO.dred); R(rx - 9, ry + 7, 2, 3, LOGO.black);
    R(rx + rw - 2, ry + 3, 12, 11, LOGO.black); R(rx + rw - 1, ry + 4, 10, 9, LOGO.dred); R(rx + rw + 7, ry + 7, 2, 3, LOGO.black);
    DCW.box(rx, ry, rw, 13, { fill: LOGO.red, border: LOGO.gold });
    T(rl, 160, ry + 3, LOGO.white, { align: 'center', shadow: LOGO.dred });
    // subtitle
    outlined("CARL'S DOOMSDAY SCENARIO", 160, ry + 16, LOGO.yellow, { shadow: LOGO.dred });
  }
  ui.drawLogo = drawLogo2;
  scenes.title = {
    enter: function () {
      closeAll();
      this.t = 0; this.sel = 0; this.cool = 0.25; this.skipAsk = false;
      music('title');
    },
    items: function () {
      var self = this, hasRun = !!(DCW.save && DCW.save.run), imp = canImport();
      function start(fn) { sfx('fanfare'); if (tryCall(DCW.game, fn, []) === MISSING) ui.toast('GAME MODULE MISSING', { color: C.red }); }
      function newCrawl() {
        var go2 = function () {
          if (DCW.save && DCW.save.run) ui.confirm('START OVER? YOUR CURRENT CRAWL WILL BE LOST.', function () { start('newRun'); });
          else start('newRun');
        };
        if (canImport() && !self.skipAsk) {
          ui.menu([
            { label: 'IMPORT IT FIRST', action: function () { doImport(go2); } },
            { label: 'NO, START FRESH', action: function () { self.skipAsk = true; go2(); } }
          ], { title: 'A BOOK 1 SAVE IS SITTING RIGHT THERE. IMPORT IT FIRST?', w: 220, titleColor: C.gold, border: C.gold });
        } else go2();
      }
      return [
        hasRun ? { label: 'CONTINUE', action: function () { start('continueRun'); } } : null,
        imp ? { label: 'IMPORT BOOK 1 SAVE', color: C.gold, action: function () { doImport(null); } } : null,
        { label: 'NEW CRAWL', action: newCrawl },
        { label: 'WARDROBE', action: ui.openWardrobe },
        { label: 'ACHIEVEMENTS', action: ui.openAchievements },
        { label: 'SETTINGS', action: ui.openSettings },
        { label: 'HOW TO PLAY', action: ui.openHowTo }
      ].filter(Boolean);
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
      if (!drawBg(ctx, 'circus', 60 + t * 8, 0, { night: true, t: t })) {
        overSky(ctx, t, true, 150);
        ruins(ctx, 150, 21, '#1c0828', t);
        rooftops(ctx, 156, 99, '#0a0414', '#ac7c00', t);
        bigTop(ctx, 252, 158, '#2c0414', '#5c0c2c');
        slats(ctx, 162, t, true);
        R(0, 162, W, 1, '#7c5c3c');
      }
      // logo: Book One's cartridge treatment, BOOK TWO ribbon, subtitle
      drawLogo2(ctx, t);
      // the AI host + Carl, Donut and Mongo
      spr(ctx, 'ai_screen', 286, 132 + Math.round(Math.sin(t * 2.2) * 3), { frame: Math.floor(t * 2) });
      var quips = canImport() ? ['A BOOK ONE SAVE! IMPORT IT!', 'OOH, A RETURNING CRAWLER!'] : ['FLOOR THREE, BITCHES!', 'EIGHT DAYS. NO PRESSURE.', 'STILL NO PANTS. LOVE IT.', 'WE\'RE LIVE, BABY!'];
      if (Math.floor(t / 4) % 3 === 1) bubble(ctx, quips[Math.floor(t / 12) % quips.length], 286, 110, { w: 64 });
      var fr = Math.floor(t * 2);
      spr(ctx, actorName(compSprite('mongo'), 'idle'), 22, 166, { frame: fr });
      spr(ctx, actorName('carl', 'idle'), 46, 166, { frame: fr, skin: equipped('skin') });
      if (!shoulderDonut(ctx, 46, 166, 1, fr)) spr(ctx, actorName('donut', 'idle'), 66, 166, { frame: fr, flip: true });
      // menu
      var its = this.items(), rowH = 10, mh = its.length * rowH + 6, mw = 136, my = Math.max(89, 166 - mh);
      DCW.box(160 - mw / 2, my, mw, mh);
      var self = this;
      its.forEach(function (it, k) {
        var yy = my + 4 + k * rowH;
        if (k === self.sel) cursor(160 - mw / 2 + 6, yy);
        T(it.label, 160 - mw / 2 + 16, yy, k === self.sel ? (it.color || C.white) : (it.color ? (blink(1.5) ? it.color : C.yellow) : C.gray));
      });
      T('A FAN GAME. NOT FOR SALE.', 160, 172, C.dgray, { align: 'center', shadow: '#000' });
    }
  };

  /* ---------- CLASS PICK (the game guide's room) ---------- */
  var CP_FB = {
    intro: [
      { who: 'MORDECAI', text: 'WELCOME TO THE THIRD FLOOR. YES, I HAVE HORNS NOW. AND WINGS. AND A TAIL. DO NOT ASK ABOUT THE TAIL.' },
      { who: 'MORDECAI', text: 'THIS IS WHERE YOU PICK A RACE AND A CLASS. CHOOSE CAREFULLY. YOU LIVE WITH IT UNTIL YOU DIE, WHICH, FOR MOST CRAWLERS, IS TUESDAY.' }
    ],
    donutLines: [
      { who: 'DONUT', text: 'I\'VE ALREADY DECIDED. I\'M STAYING A CAT, OBVIOUSLY. AND MY CLASS IS FORMER CHILD ACTOR. IT SPEAKS TO MY JOURNEY.' },
      { who: 'MORDECAI', text: 'THAT CLASS IS GARBAGE. IT GIVES YOU A HEADSHOT, A SAD STORY AND A... WAIT. WHAT IS THAT CLAUSE.' },
      { who: 'SYSTEM AI', text: 'CLASS BENEFIT ACTIVATED! EVERY FORMER CHILD ACTOR NEEDS A MANAGER. MORDECAI HAS BEEN CONTRACTUALLY BOUND TO PRINCESS DONUT. CONGRATULATIONS!' }
    ],
    mordecaiLines: [
      { who: 'MORDECAI', text: 'YOU PLANNED THIS. THE BOTH OF YOU. I AM A GAME GUIDE, NOT A TALENT AGENT FOR A CAT.' },
      { who: 'DONUT', text: 'TEN PERCENT, MORDECAI. AND YOU GET TO WATCH ME BECOME A STAR. HONESTLY, YOU SHOULD BE THANKING ME.' },
      { who: 'CARL', text: 'DON\'T LOOK AT ME. I JUST NODDED WHEN SHE SAID NOD.' }
    ],
    carlRaces: [
      { id: 'human', name: 'HUMAN', desc: 'WHAT YOU ARE NOW. BORING, SOFT, AND PROVEN TO DIE TO RATS.', locked: 'YOU\'VE BEEN A HUMAN FOR YEARS AND LOOK WHERE IT GOT YOU. NO PANTS, NO HOUSE, NO. DENIED.' },
      { id: 'primal', name: 'PRIMAL', desc: 'STILL HUMAN, BUT MORE. YOUR BEST SKILLS CAN TRAIN ALL THE WAY TO LEVEL 20. THE AI CALLS IT THE LATE BLOOMER PACKAGE.' },
      { id: 'half_orc', name: 'HALF ORC', desc: 'TUSKS, MUSCLE, AND A GENUINE LOVE OF YELLING.', locked: 'THE ORC COUNCIL SAW YOUR FEET AND VOTED NO. UNANIMOUSLY. ONE OF THEM CRIED.' },
      { id: 'bopca', name: 'BOPCA', desc: 'STOUT, GREEN, SMELLS OF WET MOSS. RUNS SAFE ROOMS FOR A LIVING.', locked: 'REQUIRES SHOWING UP TO WORK. EVERY DAY. FOREVER. WE BOTH KNOW THAT\'S NOT HAPPENING.' },
      { id: 'skyfowl', name: 'SKYFOWL', desc: 'BIRD PEOPLE. FORMER RULERS OF THE OVER CITY. VERY JUDGMENTAL.', locked: 'YOU CAN\'T FLY. YOU CAN BARELY JUMP. THE BIRDS LAUGHED SO HARD ONE HAD TO SIT DOWN.' },
      { id: 'incubus', name: 'INCUBUS', desc: 'HANDSOME, HORNED, PROFESSIONALLY SEDUCTIVE.', locked: 'THAT ONE\'S TAKEN. ASK MORDECAI HOW IT\'S GOING. ACTUALLY, DON\'T.' }
    ],
    carlClasses: [
      { id: 'royal_bodyguard', name: 'ROYAL BODYGUARD', desc: 'PROTECT A MEMBER OF ROYALTY AT ALL COSTS.', locked: 'YOU ALREADY HAVE THIS JOB. IT DOESN\'T PAY. SHE KNOWS.' },
      { id: 'compensated_anarchist', name: 'COMPENSATED ANARCHIST', desc: 'TRAPS, BOMBS, FISTS AND A KNACK FOR THE CAMERA. BLADES HIT 25% WEAKER. YOU DON\'T USE BLADES ANYWAY.' },
      { id: 'monster_truck_driver', name: 'MONSTER TRUCK DRIVER', desc: 'BIG TRUCK. BIG WHEELS. BIG FEELINGS.', locked: 'SOMEBODY ELSE CALLED DIBS ON THIS ONE. YOU\'LL MEET HER. SHE\'S NICER THAN YOU.' },
      { id: 'bard', name: 'BARD', desc: 'SING, DANCE, DISTRACT.', locked: 'WE\'VE HEARD YOU SING IN THE SHOWER. THE SHOWER FILED A COMPLAINT.' },
      { id: 'necromancer', name: 'NECROMANCER', desc: 'RAISE THE DEAD. TALK TO THE DEAD. DATE THE DEAD.', locked: 'THE DEAD HAVE ASKED FOR A RESTRAINING ORDER.' },
      { id: 'paladin', name: 'PALADIN', desc: 'HOLY WARRIOR. STRICT CODE OF CONDUCT.', locked: 'THE APPLICATION ASKS ABOUT YOUR MORALS. YOU KICKED A GOBLIN IN THE GROIN YESTERDAY. FOR FUN.' }
    ],
    collapse: [
      { who: 'SYSTEM AI', text: 'ATTENTION, CRAWLERS! THE SECOND FLOOR HAS COLLAPSED. ANYONE STILL DOWN THERE IS NOW A FOND MEMORY.' },
      { who: 'SYSTEM AI', text: 'THE THIRD FLOOR TIMER HAS STARTED. YOU HAVE EIGHT DAYS. PLEASE CONTINUE CHOOSING YOUR CLASS. NO RUSH. KIDDING. RUSH.' }
    ],
    outro: [
      { who: 'MORDECAI', text: 'PRIMAL. COMPENSATED ANARCHIST. GODS HELP US, IT FITS YOU. NOW GET OUT THERE AND DON\'T TOUCH THE GUARDS.' },
      { who: 'DONUT', text: 'COME ALONG, MORDECAI. A STAR NEVER KEEPS HER PUBLIC WAITING.' }
    ]
  };
  function cpData() { return D('classPick') || {}; }
  function cpList(kind) {
    var d = cpData(), l = kind === 'race' ? (d.carlRaces || d.races) : (d.carlClasses || d.classes);
    if (!Array.isArray(l) || !l.length) l = kind === 'race' ? CP_FB.carlRaces : CP_FB.carlClasses;
    return l.filter(Boolean).map(function (e, i) { return typeof e === 'string' ? { id: e.toLowerCase().replace(/\W+/g, '_'), name: e } : e; });
  }
  function cpShortlist(list) {
    var marked = list.filter(function (e) { return e.recommended || e.shortlist || e.final; }).slice(0, 3);
    if (marked.length) {
      var hidden = list.filter(function (e) { return marked.indexOf(e) < 0 && !e.locked; });
      if (hidden.length && !marked.some(function (e) { return !e.locked; })) marked.push({ scroll: true, id: '__scroll', name: 'KEEP SCROLLING', found: hidden.filter(function (e) { return e.found; })[0] || hidden[0] });
      return marked;
    }
    if (list.length <= 3) return list.slice();
    var open = list.filter(function (e) { return !e.locked; }).slice(0, 3), needLocked = 3 - open.length, out = [];
    list.forEach(function (e) {
      if (!e.locked) { if (open.indexOf(e) >= 0) out.push(e); }
      else if (needLocked > 0) { out.push(e); needLocked--; }
    });
    return out;
  }
  function an(name) { return /^[AEIOU]/.test(up(name)) ? 'AN ' : 'A '; }
  scenes.classPick = {
    STEPS: ['intro', 'race', 'raceAi', 'class', 'classAi', 'donut', 'bind', 'mord', 'outro', 'done'],
    enter: function (p) {
      closeAll();
      this.p = p || {}; this.t = 0; this.phase = 'wait'; this.picked = {}; this.flash = 0; this.flashCol = C.white;
      this.cardShake = 0; this.pt = 0; this.collapsed = false; this.doneFlag = false; this.waitT = 0.6; this.step = -1;
      music('cutscene');
    },
    next: function () {
      var self = this, d = cpData();
      this.step++;
      var s = this.STEPS[this.step];
      var talk = function (lines) { self.phase = 'talk'; ui.say(lineList(lines), { pos: 'top', onDone: function () { self.next(); } }); };
      if (s === 'intro') talk(d.intro && lineList(d.intro).length ? d.intro : CP_FB.intro);
      else if (s === 'donut') talk(d.donutLines && lineList(d.donutLines).length ? d.donutLines : CP_FB.donutLines);
      else if (s === 'bind') { this.phase = 'bind'; this.pt = 0; }
      else if (s === 'mord') talk(d.mordecaiLines && lineList(d.mordecaiLines).length ? d.mordecaiLines : CP_FB.mordecaiLines);
      else if (s === 'race' || s === 'class') this.startPick(s);
      else if (s === 'raceAi' || s === 'classAi') { if (lineList(d[s]).length) talk(d[s]); else this.next(); }
      else if (s === 'outro') talk(d.outro && lineList(d.outro).length ? d.outro : CP_FB.outro);
      else this.finish();
    },
    startPick: function (kind) {
      this.kind = kind; this.list = cpList(kind); this.short = cpShortlist(this.list);
      this.phase = 'roll'; this.pt = 0; this.tick = 0; this.sel = 0;
      sfx('menu_select');
    },
    collapse: function () {
      var self = this; this.collapsed = true;
      if (DCW.shake) DCW.shake(5, 1.4);
      sfx('explosion'); sfx('boss_roar');
      this.flash = 1; this.flashCol = C.red;
      var d = cpData();
      ui.say(lineList(d.collapse && lineList(d.collapse).length ? d.collapse : CP_FB.collapse), { onDone: function () {
        ui.announce('FLOOR 2 HAS COLLAPSED', { color: C.red, sub: 'EIGHT DAYS ON THE CLOCK', time: 2.4 });
        sfx('bell_day');
        self.phase = 'cards';
      } });
    },
    choose: function () {
      var self = this, e = this.short[this.sel]; if (!e) return;
      if (e.scroll) { this.phase = 'scroll'; this.pt = 0; this.tick = 0; sfx('menu_select'); return; }
      if (e.locked) {
        sfx('error'); this.cardShake = 0.45;
        ui.say([{ who: 'SYSTEM AI', text: e.locked === true ? 'LOCKED. DON\'T TAKE IT PERSONALLY. ACTUALLY, DO.' : e.locked }]);
        return;
      }
      ui.confirm('BECOME ' + an(e.name) + up(e.name) + '? NO REFUNDS.', function () {
        self.picked[self.kind] = e.id || e.name;
        sfx('unlock'); sfx('fanfare');
        self.flash = 1; self.flashCol = C.white;
        ui.announce(self.kind === 'race' ? 'RACE CHOSEN' : 'CLASS CHOSEN', { sub: up(e.name), color: C.gold, time: 1.8 });
        self.phase = 'chosen'; self.waitT = 1.9;
      }, { yes: 'DO IT', no: 'HMM, WAIT', def: 'yes' });
    },
    finish: function () {
      if (this.doneFlag) return; this.doneFlag = true;
      var res = { race: this.picked.race || 'primal', klass: this.picked['class'] || 'compensated_anarchist' };
      var r = getRun(); if (r) { r.race = res.race; r.klass = res.klass; persist(); }
      G('pickClass', res.race, res.klass);
      if (this.p.onDone) this.p.onDone(res); else toTitle();
    },
    update: function (dt) {
      this.t += dt; if (this.flash > 0) this.flash = Math.max(0, this.flash - dt * 2.5); if (this.cardShake > 0) this.cardShake -= dt;
      if (this.phase === 'wait') { this.waitT -= dt; if (this.waitT <= 0) this.next(); return; }
      if (this.phase === 'chosen') { this.waitT -= dt; if (this.waitT <= 0) this.next(); return; }
      if (this.phase === 'bind') {
        var before = this.pt; this.pt += dt;
        if (before < 0.5 && this.pt >= 0.5) { sfx('unlock'); this.flash = 0.8; this.flashCol = C.gold; ui.announce('MANAGER BOUND', { sub: 'MORDECAI NOW WORKS FOR PRINCESS DONUT', color: C.gold, time: 2, y: 26 }); }
        if (this.pt >= 2.3 || (this.pt > 0.8 && P('confirm'))) this.next();
        return;
      }
      if (this.phase === 'roll') {
        this.pt += dt; this.tick -= dt;
        if (this.tick <= 0) { sfx('menu_move', { pitch: 1 + this.pt * 0.3 }); this.tick = 0.05 + this.pt * 0.06; }
        if (this.pt > 1.8 || (this.pt > 0.35 && P('confirm'))) { this.phase = 'narrow'; this.pt = 0; sfx('menu_select'); }
        return;
      }
      if (this.phase === 'narrow') {
        this.pt += dt;
        if (this.pt > 1.1 || (this.pt > 0.3 && P('confirm'))) {
          this.phase = 'cards'; this.pt = 0;
          var cd = cpData();
          if (this.kind === 'class' && !this.collapsed && (lineList(cd.collapse).length || !cd.carlClasses)) { this.phase = 'quake'; this.collapse(); }
        }
        return;
      }
      if (this.phase === 'scroll') {
        this.pt += dt; this.tick -= dt;
        if (this.tick <= 0) { sfx('menu_move', { pitch: 0.8 + this.pt * 0.4 }); this.tick = 0.04 + this.pt * this.pt * 0.08; }
        if (this.pt > 2.2) {
          var sc = this.short[this.sel], f = sc && sc.found;
          if (f) this.short[this.sel] = f;
          this.phase = 'cards'; sfx('unlock'); this.flash = 0.7; this.flashCol = C.gold;
          ui.announce('FOUND ONE', { sub: up((f && f.name) || ''), color: C.gold, time: 1.6 });
        }
        return;
      }
      if (this.phase === 'cards') {
        var n = this.short.length;
        if (rep(this, 'left', dt)) { this.sel = (this.sel + n - 1) % n; sfx('menu_move'); }
        else if (rep(this, 'right', dt)) { this.sel = (this.sel + 1) % n; sfx('menu_move'); }
        else if (P('confirm')) { sfx('menu_select'); this.choose(); }
        else if ((P('special') || P('select')) && this.short[this.sel] && !this.short[this.sel].scroll) {
          var ce = this.short[this.sel]; sfx('menu_select');
          ui.readMore({ title: up(ce.name), titleColor: ce.locked ? C.gray : C.gold, blocks: [{ text: ce.desc || '' }] });
        }
      }
    },
    idle: function (dt) { this.t += dt; if (this.flash > 0) this.flash = Math.max(0, this.flash - dt * 2.5); if (this.cardShake > 0) this.cardShake -= dt; },
    draw: function (ctx) {
      var t = this.t, self = this, GY = 150;
      if (!drawBg(ctx, 'guide_room', 0, 0, { t: t })) drawGuideRoom(ctx, t);
      var fr = Math.floor(t * 2);
      // the cast
      var mx = 254 + (this.phase === 'bind' && this.pt > 0.5 && this.pt < 1.6 ? Math.round(Math.sin(t * 50) * 2) : 0);
      R(226, GY - 22, 44, 22, '#000'); R(227, GY - 21, 42, 21, '#5c2c10'); R(227, GY - 21, 42, 3, '#a85010'); // podium
      spr(ctx, actorName('mordecai', 'idle'), mx, GY - 18, { frame: fr, flip: true });
      spr(ctx, actorName(compSprite('mongo'), 'idle'), 92, GY + 6, { frame: fr });
      spr(ctx, actorName('carl', 'idle'), 120, GY + 6, { frame: fr, skin: equipped('skin') });
      spr(ctx, actorName('donut', 'idle'), 146, GY + 6, { frame: fr });
      if (this.phase === 'bind') {
        var k = clamp(this.pt / 0.5, 0, 1), x0 = 150, y0 = GY - 4, x1 = 248, y1 = GY - 34;
        for (var i = 0; i <= 24 * k; i++) {
          var f = i / 24, cx = x0 + (x1 - x0) * f, cy = y0 + (y1 - y0) * f - Math.sin(f * Math.PI) * 18 + Math.round(Math.sin(t * 12 + i) * 1);
          R(cx - 1, cy - 1, 3, 3, '#000'); R(cx, cy, 2, 2, (i + Math.floor(t * 10)) % 2 ? C.gold : C.white);
        }
        if (this.pt > 0.5) { bubble(ctx, 'WHAT?!', 254, GY - 50, { w: 40 }); }
      }
      if (this.phase === 'roll' || this.phase === 'narrow' || this.phase === 'cards' || this.phase === 'quake' || this.phase === 'chosen' || this.phase === 'scroll') {
        dim(ctx, 0.55);
        var title = this.kind === 'race' ? 'CHOOSE YOUR RACE' : 'CHOOSE YOUR CLASS';
        if (this.phase === 'roll' || this.phase === 'narrow') {
          DCW.box(40, 34, 240, 80, { fill: '#1c0c34', border: C.gold });
          T(title, 160, 40, C.gold, { align: 'center' });
          if (this.phase === 'roll') {
            var nm = up(this.list[Math.floor(this.pt * 14) % this.list.length].name);
            var big = tw(nm, 2) <= 224;
            T(nm, 160, big ? 64 : 68, C.white, { align: 'center', scale: big ? 2 : 1 });
            T('THE AI IS SHUFFLING THE OPTIONS...', 160, 96, blink(3) ? C.gray : C.dgray, { align: 'center', shadow: null });
          } else {
            T('THE AI HAS NARROWED IT', 160, 60, C.white, { align: 'center' });
            T('DOWN TO THREE.', 160, 72, C.white, { align: 'center' });
            T('(IT DID NOT ASK YOU.)', 160, 92, C.dgray, { align: 'center', shadow: null });
          }
        } else {
          T(title, 160, 8, C.gold, { align: 'center' });
          var n = this.short.length, cw = n >= 4 ? 74 : 94, gap = n >= 4 ? 4 : 8, x0c = Math.round(160 - (n * cw + (n - 1) * gap) / 2);
          this.short.forEach(function (e, i) {
            var sel = i === self.sel, cx = x0c + i * (cw + gap), cy = 22 - (sel ? 3 : 0);
            if (sel && self.cardShake > 0) cx += Math.round(Math.sin(t * 60) * 3);
            var rolling = e.scroll && self.phase === 'scroll';
            DCW.box(cx, cy, cw, 82, { fill: e.scroll ? '#101830' : e.locked ? '#1c1018' : '#102010', border: sel ? (blink(4) ? C.white : C.gold) : e.scroll ? C.blue : e.locked ? C.ddgray : C.green });
            if (rolling) {
              var rn = up(self.list[Math.floor(self.pt * Math.max(4, 22 - self.pt * 9)) % self.list.length].name);
              wrap(rn, cw - 8).slice(0, 3).forEach(function (l, k) { T(l, cx + cw / 2, cy + 30 + k * 10, C.white, { align: 'center' }); });
              T('▼', cx + cw / 2, cy + 68, blink(6) ? C.gold : C.yellow, { align: 'center' });
              return;
            }
            if (e.scroll) T('?', cx + cw / 2, cy + 8, blink(2) ? C.blue : C.white, { align: 'center', scale: 3 });
            else if (e.locked) icon(ctx, 'lock', cx + cw / 2 - 12, cy + 6, { scale: 3 });
            else T('★', cx + cw / 2, cy + 8, blink(2) ? C.gold : C.yellow, { align: 'center', scale: 3 });
            wrap(up(e.name), cw - 6).slice(0, 3).forEach(function (l, k) { T(l, cx + cw / 2, cy + 36 + k * 10, e.locked ? C.gray : C.white, { align: 'center' }); });
            if (!e.scroll) {
              DCW.box(cx + 6, cy + 66, cw - 12, 11, { fill: e.locked ? '#5c0000' : '#005800', border: e.locked ? C.red : C.green });
              T(e.locked ? 'LOCKED' : cw < 90 ? 'OPEN' : 'AVAILABLE', cx + cw / 2, cy + 68, C.white, { align: 'center', shadow: null });
            }
          });
          var e2 = this.short[this.sel];
          if (!ui.isOpen('say')) DCW.box(10, 110, 300, 48, { fill: '#0f1630' });
          if (e2 && !ui.isOpen('say')) {
            var desc = e2.scroll ? 'THE AI RECOMMENDS THESE THREE. THE LIST HAS A LOT MORE. YOU COULD KEEP SCROLLING. THE AI WOULD RATHER YOU DIDN\'T.' : (e2.desc || '');
            T(up(e2.name), 18, 115, e2.scroll ? C.blue : e2.locked ? C.gray : C.gold);
            if (e2.recommended) T('AI RECOMMENDED', 302, 115, C.purple, { align: 'right', shadow: null });
            var dls = wrap(up(desc), 286);
            if (dls.length > 3) { dls = dls.slice(0, 2); dls.push((blink(2) ? '▼ ' : '  ') + bn('special') + ': READ MORE'); }
            dls.forEach(function (l, k) { T(l, 18, 126 + k * 10, l.indexOf('READ MORE') >= 0 ? C.gold : C.white); });
          }
          if (this.phase === 'cards') T('◀▶: CHOOSE   ' + bn('confirm') + ': PICK', 160, 164, C.gray, { align: 'center' });
        }
      } else if (!ui.isOpen('say')) T("THE GAME GUIDE'S ROOM", 4, 4, C.gold, { shadow: '#000' });
      if (this.flash > 0) { ctx.globalAlpha = clamp(this.flash, 0, 1) * 0.8; R(0, 0, W, H, this.flashCol); ctx.globalAlpha = 1; }
    }
  };

  /* ---------- CINEMA (letterboxed cutscene player, DESIGN 11.3) ---------- */
  function cineActor(a) {
    a = a || {};
    var o = { sprite: a.sprite || 'carl', x: a.x === undefined ? 160 : a.x, y: a.y === undefined ? 150 : a.y, flip: a.flip, frame: a.frame, anim: a.anim,
      scale: a.scale || 1, alpha: a.alpha, skin: a.skin, move: null, say: a.say || a.bubble, sayT: a.sayT || 2.5 };
    if (a.moveTo) o.move = { x0: o.x, y0: o.y, x1: a.moveTo.x === undefined ? o.x : a.moveTo.x, y1: a.moveTo.y === undefined ? o.y : a.moveTo.y, t: Math.max(0.01, a.moveTo.t || 1), d: a.moveTo.delay || 0 };
    return o;
  }
  function cineSprite(a, moving) {
    if (a.anim === undefined && !moving && hasArt(a.sprite)) return a.sprite;
    var base = a.sprite.replace(/_(idle|run|walk|talk|act)$/, '');
    var name = actorName(base, moving && (!a.anim || a.anim === 'idle') ? 'walk' : (a.anim || 'idle'));
    if (!hasArt(name) && hasArt(a.sprite)) name = a.sprite;
    return name;
  }
  scenes.cinema = {
    enter: function (p) {
      closeAll();
      p = p || {};
      this.p = p; this.t = 0; this.i = -1; this.done = false; this.actors = []; this.view = null; this.flash = 0; this.flashCol = C.white; this.fadeIn = 0; this.fadeOut = 0;
      var shots = p.shots;
      if (!shots && p.id) { var cin = D('cinema'); shots = cin && cin[p.id]; }
      if (shots && !Array.isArray(shots) && Array.isArray(shots.shots)) shots = shots.shots;
      this.shots = Array.isArray(shots) ? shots.filter(Boolean) : [];
      this.nextShot();
    },
    nextShot: function () {
      var self = this;
      this.i++;
      if (this.i >= this.shots.length) { this.finish(); return; }
      var s = this.shots[this.i] || {};
      this.shot = s; this.st = 0; this.talking = false; this.waitLeft = 0;
      if (s.actors !== undefined) this.actors = arr(s.actors).map(cineActor);
      else if (s.bg !== undefined && (!this.view || this.view.bg !== s.bg)) this.actors = [];
      else this.actors.forEach(function (a) { if (a.move) { a.x = a.move.x1; a.y = a.move.y1; a.move = null; } a.say = null; });
      if (s.bg !== undefined) this.view = { bg: s.bg, night: !!s.night, camX: s.camX || 0, camY: s.camY || 0, pan: s.pan || 0, t0: this.t };
      else if (this.view && s.night !== undefined) this.view.night = !!s.night;
      if (s.music !== undefined) { if (s.music) music(s.music); else tryCall(DCW.audio, 'stopMusic', []); }
      arr(s.sfx).forEach(function (n) { sfx(n); });
      if (s.shake && DCW.shake) DCW.shake(+s.shake < 1.5 ? Math.round(2 + s.shake * 5) : +s.shake, s.shakeTime || 0.5);
      if (s.flash) { this.flash = 1; this.flashCol = s.flash === true ? C.white : s.flash; }
      this.fadeIn = s.fade ? 1 : 0;
      var lines = lineList(s.lines);
      if (lines.length) {
        this.talking = true;
        var pos = s.pos || ((this.view && typeof this.view.bg === 'string' && this.view.bg.indexOf('panel:') !== 0 && this.actors.length) ? 'top' : 'bottom');
        ui.say(lines, { pos: pos, onDone: function () { self.talking = false; self.waitLeft = s.wait !== undefined ? +s.wait : 0.25; }, onSkip: function () { self.finish(); } });
      } else this.waitLeft = s.wait !== undefined ? +s.wait : 2;
    },
    finish: function () {
      if (this.done) return; this.done = true;
      closeAll();
      var cb = this.p.onDone;
      if (cb) { try { cb(); } catch (e) { console.error(e); } } else toTitle();
    },
    tickFx: function (dt) {
      this.t += dt; this.st = (this.st || 0) + dt;
      if (this.flash > 0) this.flash = Math.max(0, this.flash - dt * 3);
      if (this.fadeIn > 0) this.fadeIn = Math.max(0, this.fadeIn - dt * 2.5);
      var st = this.st;
      this.actors.forEach(function (a) {
        if (!a.move) { a.moving = false; return; }
        var mv = a.move, k = clamp((st - mv.d) / mv.t, 0, 1);
        a.moving = k > 0 && k < 1;
        if (a.moving && a.flip === undefined) a.autoFlip = mv.x1 < mv.x0;
        a.x = mv.x0 + (mv.x1 - mv.x0) * k; a.y = mv.y0 + (mv.y1 - mv.y0) * k;
      });
    },
    update: function (dt) {
      if (this.done) return;
      this.tickFx(dt);
      if (P('start') && this.p.skippable !== false && this.t > 0.2) { this.finish(); return; }
      if (!this.talking) {
        this.waitLeft -= dt;
        if (P('confirm') && this.st > 0.3) this.waitLeft = 0;
        if (this.waitLeft <= 0) this.nextShot();
      }
    },
    idle: function (dt) { if (!this.done) this.tickFx(dt); },
    draw: function (ctx) {
      var s = this.shot || {}, t = this.t, st = this.st || 0, v = this.view || {};
      R(0, 0, W, H, '#000');
      var bg = v.bg, camX = (v.camX || 0) + (v.pan || 0) * (t - (v.t0 || 0));
      if (typeof bg === 'string' && bg.indexOf('panel:') === 0) {
        var pid = bg.slice(6);
        if (!drawPanel(ctx, pid, 32, 22, t)) {
          DCW.box(32, 22, 256, 112, { fill: '#0c0418' });
          ctx.save(); ctx.beginPath(); ctx.rect(34, 24, 252, 108); ctx.clip();
          (VIG[pid] || VIG.overcity)(ctx, t, 34, 24, 252, 108);
          ctx.restore();
        }
      } else if (bg) {
        if (!drawBg(ctx, bg, camX, v.camY || 0, { night: !!v.night, t: t })) themeBackdrop(ctx, bg, t, !!v.night, camX);
      }
      // actors
      var self = this;
      this.actors.forEach(function (a) {
        var name = cineSprite(a, a.moving);
        var fr = a.frame !== undefined ? a.frame : Math.floor(t * (a.moving ? 8 : a.anim === 'talk' ? 6 : 2));
        var flip = a.flip !== undefined ? !!a.flip : !!a.autoFlip;
        var skin = a.skin || (/^carl/.test(name) ? equipped('skin') : undefined);
        if (a.scale > 1) bigSprite(ctx, name, a.x, a.y, { scale: a.scale | 0, frame: fr, flip: flip, skin: skin, alpha: a.alpha });
        else spr(ctx, name, a.x, a.y, { frame: fr, flip: flip, skin: skin, alpha: a.alpha });
        if (a.say && st < a.sayT) { var inf = artInfo(name); bubble(ctx, a.say, a.x, a.y - ((inf && inf.h) || 24) * (a.scale || 1) - 2, { w: 100 }); }
      });
      if (s.wobble) wobble(ctx, 16, 164, +s.wobble, s.wobbleFreq || 0.12, t);
      if (this.flash > 0) { ctx.globalAlpha = clamp(this.flash, 0, 1); R(0, 0, W, H, this.flashCol); ctx.globalAlpha = 1; }
      if (this.fadeIn > 0) { ctx.globalAlpha = clamp(this.fadeIn, 0, 1); R(0, 0, W, H, '#000'); ctx.globalAlpha = 1; }
      // letterbox
      R(0, 0, W, 16, '#000'); R(0, 164, W, 16, '#000');
      if (s.caption) T(up(s.caption), 6, 5, C.gold, { shadow: null });
      if (this.p.skippable !== false) T(bn('start') + ': SKIP', 314, 5, C.ddgray, { align: 'right', shadow: null });
      if (!this.talking && this.shots.length && !this.done && st > 0.6 && blink(2)) T('▼', 312, 168, C.dgray, { shadow: null });
    }
  };

  /* ---------- CARD (act / day title card; book 1's floor card, kept generic) ---------- */
  // enter({ head:'ACT', n:2, name:'THE MEDIUM SKYFOWL SETTLEMENT', tagline, intro:[lines], onDone }) ; book 1 {floor} still works
  scenes.card = {
    enter: function (p) {
      p = p || {};
      this.p = p; this.t = 0; this.said = false; this.done = false;
      var fd = typeof p.floor === 'object' ? p.floor : (p.floor ? floorDef(p.floor) : null);
      this.head = up(p.head || p.title || (fd ? 'FLOOR' : 'ACT'));
      this.n = p.n !== undefined ? p.n : (p.act !== undefined ? p.act : (fd ? fd.n || 3 : actNum()));
      this.name = up(p.name || (fd && fd.name) || '');
      this.tagline = up(p.tagline || (fd && fd.tagline) || '');
      this.intro = p.intro || (fd && fd.intro) || null;
      this.conf = [];
      for (var i = 0; i < 50; i++) this.conf.push({ x: Math.random() * W, y: -Math.random() * 200, v: 30 + Math.random() * 50, c: [C.red, C.gold, C.green, C.blue, C.pink][i % 5], w: Math.random() * 6 });
      sfx('fanfare');
    },
    next: function () {
      if (this.said) return; this.said = true;
      var self = this, intro = this.intro;
      var finish = function () { if (self.done) return; self.done = true; if (self.p.onDone) self.p.onDone(); else toTitle(); };
      if (intro && (!Array.isArray(intro) || intro.length)) ui.say(intro, { onDone: finish }); else finish();
    },
    update: function (dt) {
      this.t += dt;
      this.conf.forEach(function (c) { c.y += c.v * dt; if (c.y > H) c.y = -4; });
      if (this.t > 2.6 || ((P('confirm') || P('start')) && this.t > 0.5)) this.next();
    },
    idle: function (dt) { this.t += dt; this.conf.forEach(function (c) { c.y += c.v * dt; if (c.y > H) c.y = -4; }); },
    draw: function (ctx) {
      var t = this.t;
      R(0, 0, W, H, '#0c0418');
      for (var i = 0; i < 2; i++) {
        var sx = 160 + Math.sin(t * 1.4 + i * 3) * 110;
        ctx.globalAlpha = 0.13; ctx.fillStyle = C.yellow; ctx.beginPath(); ctx.moveTo(i ? 300 : 20, 0); ctx.lineTo(sx - 30, H); ctx.lineTo(sx + 30, H); ctx.fill(); ctx.globalAlpha = 1;
      }
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
        T(this.head, 160 - Math.round((1 - k) * 200), 18, C.white, { align: 'center', scale: 2 });
        var popS = t < 0.9 ? 5 : 4;
        if (t > 0.6 && this.n !== '' && this.n !== null) T(String(this.n), 160, popS === 5 ? 32 : 36, C.gold, { align: 'center', scale: popS });
      }
      if (t > 1.0) {
        var nm = this.name, big = tw(nm, 2) <= 300;
        T(nm, 160, big ? 76 : 80, C.white, { align: 'center', scale: big ? 2 : 1, wrap: big ? null : 300 });
        if (t > 1.4 && this.tagline) wrap(this.tagline, 280).slice(0, 2).forEach(function (l, i) { T(l, 160, 96 + i * 10, C.yellow, { align: 'center' }); });
        if (!this.said) T('★ ★ ★', 160, 140, blink(2) ? C.gold : C.yellow, { align: 'center' });
      }
      if (t > 1.6 && !this.said && blink(2)) T(bn('confirm'), 312, 170, C.dgray, { align: 'right', shadow: null });
    }
  };
  scenes.floorCard = scenes.card; // book 1 name

  /* ---------- INTRO (story pages; game.js uses cinema for book 2, this stays harmless) ---------- */
  var INTRO_FB = [
    { text: 'FLOOR TWO IS ABOUT TO FOLD UP LIKE A CHEAP LAWN CHAIR. ANYONE STILL ON IT WILL BE FOLDED TOO.', vignette: 'collapse' },
    { text: 'CARL AND PRINCESS DONUT MADE THE STAIRS. MONGO MADE THE STAIRS. CARL\'S PANTS DID NOT.', vignette: 'stairs' },
    { text: 'WELCOME TO THE THIRD FLOOR, CRAWLERS: THE OVER CITY! RUINS, VILLAGES, AND A RED SUN THAT IS DEFINITELY FAKE.', portrait: 'p_ai', vignette: 'overcity' },
    { text: 'EIGHT DAYS ON THE CLOCK. THE AUDIENCE IS WATCHING. THE CAT IS ALREADY JUDGING YOU.', vignette: 'night' }
  ];
  scenes.intro = {
    enter: function (p) {
      p = p || {};
      var self = this; this.done = false;
      music('intro');
      this.pager = storyPager(storyPages('intro', INTRO_FB), ['collapse', 'stairs', 'overcity', 'night'], function () {
        if (self.done) return; self.done = true;
        if (p.onDone) p.onDone(); else tryCall(DCW.game, 'continueRun', []);
      });
    },
    update: function (dt) { if (!this.done) this.pager.update(dt); },
    idle: function (dt) { this.pager.t += dt; },
    draw: function (ctx) { R(0, 0, W, H, '#000'); this.pager.draw(ctx); }
  };

  /* ---------- RESULTS ---------- */
  function rankOf(r) {
    var pts = 0;
    if (!r.damageTaken) pts += 2; else if (r.damageTaken <= 4) pts += 1;
    if ((r.maxCombo || 0) >= 25) pts += 2; else if ((r.maxCombo || 0) >= 10) pts += 1;
    if (r.secrets) pts += 1;
    if ((r.kills || 0) >= 15) pts += 1;
    return pts >= 5 ? 'S' : pts >= 3 ? 'A' : pts >= 2 ? 'B' : pts >= 1 ? 'C' : 'D';
  }
  var RESULT_HEAD = { boss: 'BOSS DEFEATED!', facade: 'BOSS DEFEATED!', survival: 'YOU SURVIVED!', escape: 'YOU ESCAPED!', plant: 'KA-BOOM!', show: "THAT'S A WRAP!", rooms: 'THE BIG TOP FALLS!', chase: 'OUTRAN IT!', climb: 'TOP OF THE WORLD!', drop: 'ROCK BOTTOM!' };
  scenes.results = {
    enter: function (p) {
      closeAll();
      p = p || {};
      this.p = p; this.r = p.result || {}; this.rw = (p.rewards || []).map(rewardInfo);
      this.t = 0; this.step = 0; this.stepT = 0; this.done = false;
      var lv = levelDef(this.r.levelId || this.r.stageId) || {};
      this.name = up(lv.name || this.r.levelName || this.r.stageName || 'LEVEL');
      this.boss = !!(lv.boss || this.r.boss);
      this.head = RESULT_HEAD[lv.kind] || (this.boss ? 'BOSS DEFEATED!' : 'LEVEL CLEAR!');
      this.quip = aiLine('stageClear', aiLine('levelClear', 'THAT WAS ADEQUATE. THE AUDIENCE IS MILDLY ENTERTAINED.'));
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
        else if (!this.done && this.t > 0.6) { this.done = true; sfx('menu_select'); if (this.p.onDone) this.p.onDone(); else tryCall(DCW.game, 'continueRun', []); }
      }
    },
    idle: function (dt) { this.t += dt; },
    draw: function (ctx) {
      var t = this.t, self = this;
      bands(ctx, ['#0c0418', '#140828', '#1c0c34', '#240c3c'], 0, H);
      for (var i = 0; i < 3; i++) { ctx.globalAlpha = 0.1; ctx.fillStyle = C.yellow; ctx.beginPath(); var sx = 160 + Math.sin(t + i * 2) * 140; ctx.moveTo(60 + i * 100, 0); ctx.lineTo(sx - 25, H); ctx.lineTo(sx + 25, H); ctx.fill(); ctx.globalAlpha = 1; }
      var hb = tw(this.head, 2) <= 300;
      T(this.head, 160, 5, blink(2) ? C.gold : C.yellow, { align: 'center', scale: hb ? 2 : 1 });
      T(fitText(this.name, 300), 160, 24, C.white, { align: 'center' });
      DCW.box(8, 36, 150, 96);
      this.rows.forEach(function (r, k) {
        if (self.step <= k) return;
        var yy = 42 + k * 11, frac = self.step === k + 1 ? clamp(self.stepT / 0.28, 0, 1) : 1;
        T(r[0], 14, yy, C.gray);
        T(r[2](r[1] * frac), 152, yy, k === 2 && !r[1] ? C.green : C.white, { align: 'right' });
      });
      if (this.step > this.rows.length) {
        T('RANK', 14, 110, C.gray);
        var rc = { S: C.gold, A: C.green, B: C.blue, C: C.white, D: C.dgray }[this.rank];
        T(this.rank, 150, 106, rc, { align: 'right', scale: 2 });
        var ck = clockInfo();
        if (ck) { icon(ctx, ck.night ? 'moon' : 'sun', 14, 119); T(ck.label + ' LEFT', 25, 120, ck.hoursLeft <= 24 ? C.red : C.dgray, { shadow: null }); }
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
        faceSlot(ctx, 'p_ai', 9, 140, this.stepT < 1.3, 2);
        wrap(up(this.quip), 262).slice(0, 3).forEach(function (l, k) { T(l, 47, 141 + k * 10, C.white); });
        if (blink(2.5)) T('▼', 304, 165, C.gold);
      }
    }
  };

  /* ---------- DEATH (revivals; guard kills are the DEATH PENALTY) ---------- */
  // result.cause is the killer's name (mob, shooter, boss) or a hazard word; a few raw ids get a readable name
  var CAUSE_NAMES = { pit: 'A BOTTOMLESS PIT', fall: 'A VERY LONG FALL', damage: 'MISADVENTURE', hazard: 'THE SCENERY', projectile: 'SOMETHING THAT GOT THROWN' };
  function causeName(c) {
    var raw = String(c === undefined || c === null || c === '' ? 'misadventure' : c).trim();
    return CAUSE_NAMES[raw.toLowerCase()] || up(raw.replace(/_/g, ' '));
  }
  scenes.death = {
    enter: function (p) {
      closeAll();
      p = p || {};
      this.r = p.result || {}; this.t = 0; this.sel = 0; this.busy = false;
      this.guard = this.r.cause === 'guard' || !!this.r.guard;
      this.quip = this.guard ? aiLine('crime', 'THE VILLAGE GUARD DOES NOT DO PAPERWORK. OR JAIL. OR SECOND CHANCES. WELL, ONE KIND.')
        : aiLine('death', 'OH NO. ANYWAY. THE RATINGS FOR THAT WERE INCREDIBLE.');
      var run = getRun();
      this.revivals = run && run.revivals > 0 ? run.revivals : 0;
      if (hasG('canRevive')) this.revivals = G('canRevive') ? Math.max(1, this.revivals) : 0;
      music('gameover');
      sfx('death');
    },
    items: function () {
      var self = this, out = [];
      if (this.revivals > 0) out.push({ id: 'revive', label: 'USE A REVIVAL (' + this.revivals + ' LEFT)', color: C.pink, action: function () {
        self.busy = true; sfx('heal');
        var ok = G('revive');
        if (!ok) { self.busy = false; ui.toast('THE SPONSORS HUNG UP.', { icon: 'skull', color: C.red }); self.revivals = 0; }
      } });
      out.push({ id: 'title', label: this.revivals > 0 ? 'GIVE UP FOR NOW' : 'END THIS CRAWL', action: function () {
        self.busy = true;
        if (!(self.revivals > 0) && getRun() && tryCall(DCW.game, 'endRun', []) !== MISSING) return; // endRun clears the run + goes to title
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
        var it = its[this.sel], self = this;
        if (it.id === 'title' && this.revivals > 0) { ui.confirm('GIVE UP FOR NOW? YOUR CRAWL IS SAVED.', function () { self.busy = true; toTitle(); }); return; }
        sfx('menu_select'); it.action();
      }
    },
    idle: function (dt) { this.t += dt; },
    draw: function (ctx) {
      var t = this.t, self = this;
      bands(ctx, ['#000000', '#100000', '#200000', '#300404', '#3c0808'], 0, H);
      for (var i = 0; i < 30; i++) { var ax = (i * 41) % W, ay = (t * (8 + i % 5) + i * 23) % H; R(ax, ay, 1, 2, '#5c1010'); }
      var msg = this.guard ? 'DEATH PENALTY' : 'YOU HAVE DIED', mw = tw(msg, 2), mx = 160 - mw / 2;
      for (var k = 0; k < msg.length; k++) {
        var lt = clamp((t - k * 0.06) / 0.3, 0, 1);
        if (lt <= 0) continue;
        var ly = Math.round(-20 + (20 - -20) * (1 - Math.pow(1 - lt, 2)));
        T(msg.charAt(k), mx + k * 12, ly, '#d82800', { scale: 2 });
      }
      var run = getRun() || {};
      ctx.globalAlpha = 0.35; R(120, 84, 80, 4, '#000'); ctx.globalAlpha = 1;
      bigSprite(ctx, 'carl_dead', 160, 86, { scale: 2, skin: equipped('skin') });
      if (this.guard) spr(ctx, firstArt(['guard_attack', 'guard_walk', 'guard_idle']) || 'guard_walk', 204, 88, { flip: true, frame: Math.floor(t * 2) });
      if (t > 0.8) {
        var cause = this.guard ? 'BY ORDER OF THE VILLAGE GUARD. NO JAIL. NO TRIAL.' : 'KILLED BY: ' + causeName(this.r.cause);
        var cl = wrap(cause, 300);
        if (cl.length > 2) cl = [cl[0], fitText(cl.slice(1).join(' '), 300)];
        cl.forEach(function (l, i) { T(l, 160, (cl.length > 1 ? 39 : 42) + i * 10, self.guard ? C.gold : (i === 0 && cl.length === 1) ? C.gray : C.white, { align: 'center' }); });
        DCW.box(4, 92, 312, 38);
        faceSlot(ctx, 'p_ai', 9, 95, t < 2.4, 5);
        wrap(up(this.quip), 262).slice(0, 3).forEach(function (l, i) { T(l, 47, 97 + i * 10, C.white); });
      }
      if (t > 1.6) {
        var its = this.items();
        if (!(this.revivals > 0)) T('NO REVIVALS LEFT. THIS CRAWL IS OVER.', 160, 136, C.red, { align: 'center' });
        else T('REVIVING COSTS 2 HOURS AND A QUARTER OF YOUR GOLD.', 160, 134, C.dgray, { align: 'center', shadow: null });
        var y0 = this.revivals > 0 ? 145 : 150;
        its.forEach(function (it, i) {
          var yy = y0 + i * 11, w = tw(it.label);
          if (i === self.sel) cursor(150 - w / 2, yy);
          T(it.label, 160 - w / 2 + 6, yy, i === self.sel ? (it.color || C.white) : C.dgray);
        });
        var ck = clockInfo();
        T('VIEWS ' + fmtNum(run.views || 0) + '  LV ' + (run.level || 13) + (ck ? '  DAY ' + ck.day : ''), 160, 172, C.ddgray, { align: 'center', shadow: null });
      }
    }
  };

  /* ---------- shared walk-around room logic (inn + club) ---------- */
  var GROUND = 150;
  function roomWalk(sc, dt, speedMul) {
    var ax = (Dn('right') ? 1 : 0) - (Dn('left') ? 1 : 0);
    sc.moving = ax !== 0 && !(sc.pet > 0) && !(sc.dance > 0);
    if (sc.moving) { sc.face = ax; sc.x = clamp(sc.x + ax * 70 * (speedMul || 1) * dt, 12, 306); }
    // Donut follows on the floor (she's off duty)
    var tx = sc.x - sc.face * 20, d = tx - sc.cx;
    sc.cmoving = Math.abs(d) > 2;
    if (sc.cmoving) { sc.cface = d > 0 ? 1 : -1; sc.cx += clamp(d, -80 * dt, 80 * dt); } else sc.cface = sc.x > sc.cx ? 1 : -1;
    // Mongo wanders and sniffs things
    sc.mT -= dt;
    if (sc.mT <= 0) { sc.mT = 1.5 + Math.random() * 2.5; sc.mTarget = 20 + Math.random() * 280; }
    var md = sc.mTarget - sc.mx; sc.mmoving = Math.abs(md) > 3;
    if (sc.mmoving) { sc.mface = md > 0 ? 1 : -1; sc.mx += clamp(md, -60 * dt, 60 * dt); }
    var near = null;
    sc.objs.forEach(function (o) { if (Math.abs(o.x - sc.x) < (o.r || 14) && (!near || Math.abs(o.x - sc.x) < Math.abs(near.x - sc.x))) near = o; });
    sc.near = near;
    if (sc.pet > 0) sc.pet -= dt;
    sc.hearts.forEach(function (h) { h.y -= 20 * dt; h.life -= dt; });
    sc.hearts = sc.hearts.filter(function (h) { return h.life > 0; });
  }
  function roomPet(sc) {
    if (P('down') && !sc.moving && Math.abs(sc.cx - sc.x) < 26 && !(sc.pet > 0) && partyList().indexOf('donut') >= 0) {
      sc.pet = 1.0; sfx('heal', { pitch: 1.5 });
      for (var i = 0; i < 4; i++) sc.hearts.push({ x: sc.cx - 9 + i * 5, y: GROUND - 20 - i * 4, life: 0.9 + i * 0.15 });
      G('track', 'pet_donut');
      return true;
    }
    return false;
  }
  function roomCast(ctx, sc, t) {
    var pl = partyList();
    if (pl.indexOf('mongo') >= 0) {
      var mb = compSprite('mongo');
      spr(ctx, actorName(mb, sc.mmoving || sc.dance > 0 ? 'walk' : 'idle'), sc.mx, GROUND - (sc.dance > 0 && blink(4) ? 3 : 0), { frame: Math.floor(t * (sc.mmoving ? 8 : 2)), flip: sc.mface < 0 });
    }
    if (pl.indexOf('katia') >= 0) spr(ctx, actorName('katia', 'idle'), sc.kx || 236, GROUND, { frame: Math.floor(t * 2), flip: sc.x < (sc.kx || 236) });
    if (pl.indexOf('donut') >= 0 || !pl.length) {
      var cs = actorName('donut', sc.cmoving ? 'walk' : 'idle');
      if (sc.pet > 0 && hasArt('donut_act')) cs = 'donut_act';
      spr(ctx, cs, sc.cx, GROUND, { frame: Math.floor(t * (sc.cmoving ? 8 : 2)), flip: sc.cface < 0 });
    }
    var cn;
    if (sc.dance > 0) cn = firstArt(Math.floor(t * 4) % 2 ? ['carl_victory', 'carl_idle'] : ['carl_punch', 'carl_kick', 'carl_idle']) || 'carl_idle';
    else cn = actorName('carl', sc.moving ? 'walk' : 'idle');
    spr(ctx, cn, sc.x, GROUND, { frame: Math.floor(t * (sc.moving ? 10 : sc.dance > 0 ? 4 : 2)), flip: sc.dance > 0 ? Math.floor(t * 2) % 2 === 0 : sc.face < 0, skin: equipped('skin') });
    sc.hearts.forEach(function (h) { T('♥', h.x, h.y, (Math.floor(h.life * 8) % 2) ? C.red : '#fc7460'); });
    if (sc.pet > 0.2) bubble(ctx, 'PURR', sc.cx, GROUND - 14, { w: 40 });
  }
  function roomPrompt(ctx, sc, t) {
    if (ui.blocking() || sc.leaving) return;
    if (sc.near) {
      var o = sc.near, by = GROUND - (o.h || 34) + Math.round(Math.sin(t * 5) * 1.5);
      var lw = tw(o.label) + 8;
      var lx = clamp(o.x - lw / 2, 4, W - 4 - lw);
      DCW.box(lx, by - 12, lw, 12, { fill: '#000' });
      T(o.label, lx + 4, by - 10, C.gold);
      T('▼', o.x, by + 1, C.white, { align: 'center' });
      DCW.box(60, 164, 200, 14, { fill: '#000' });
      T(bn('confirm') + ': ' + o.verb, 160, 167, C.white, { align: 'center' });
    } else T('◀ ▶ WALK   ' + bn('down') + ' PET   ' + bn('start') + ' MENU', 160, 168, C.gray, { align: 'center', shadow: '#000' });
  }
  function roomInit(sc, x) {
    sc.t = 0; sc.x = x; sc.face = -1; sc.moving = false;
    sc.cx = x + 20; sc.cface = -1; sc.cmoving = false;
    sc.mx = 200; sc.mTarget = 200; sc.mT = 1; sc.mface = -1; sc.mmoving = false; sc.kx = 236;
    sc.pet = 0; sc.hearts = []; sc.near = null; sc.leaving = false; sc.dance = 0;
  }
  // fade-to-black sleep with the clock jumping forward
  function sleepAnim(innId, until, keeperName) {
    var m = { kind: 'sleep', res: null, called: false, ck0: clockInfo() };
    m.update = function (dt) {
      m.t += dt;
      if (!m.called && m.t >= 0.6) {
        m.called = true;
        m.res = G('rest', innId, until);
        if (!m.res || typeof m.res !== 'object') m.res = { ok: false, msg: 'THE BEDS ARE BROKEN. COME BACK LATER.' };
        if (!m.res.ok) m.t = Math.max(m.t, 2.2);
        m.ck1 = clockInfo();
      }
      if (m.t >= 2.8 || (m.called && m.t > 1.3 && m.t < 2.2 && P('confirm'))) {
        if (m.t < 2.2) { m.t = 2.2; return; }
        close(m);
        if (m.res) {
          if (m.res.ok) ui.toast(m.res.msg || 'RESTED', { icon: until === 'night' ? 'moon' : 'sun', color: C.green, time: 3 });
          else ui.say([{ who: keeperName, text: m.res.msg || 'NOPE.' }]);
        }
      }
    };
    m.draw = function (ctx) {
      var a = m.t < 0.6 ? m.t / 0.6 : m.t > 2.2 ? clamp((2.8 - m.t) / 0.6, 0, 1) : 1;
      ctx.globalAlpha = a; R(0, 0, W, H, '#000'); ctx.globalAlpha = 1;
      if (a >= 1 && m.res && m.res.ok) {
        for (var i = 0; i < 3; i++) { var zt = (m.t * 0.8 + i * 0.33) % 1; T('Z', 150 + i * 8 + zt * 10, 70 - zt * 20, C.white, { scale: 1 + (i === 2 ? 1 : 0) }); }
        var ck = m.ck1 || clockInfo();
        if (ck) {
          T('DAY ' + ck.day + '  ' + hourText(ck), 160, 96, ck.night ? C.nblue : C.orange, { align: 'center', scale: 2 });
          T(ck.label + ' UNTIL COLLAPSE', 160, 116, ck.hoursLeft <= 24 ? C.red : C.gray, { align: 'center' });
        }
        T(until === 'night' ? 'YOU WAIT FOR DARK.' : 'YOU SLEEP LIKE THE DEAD. WHICH IS NEW.', 160, 132, C.dgray, { align: 'center', shadow: null });
      }
    };
    sfx(until === 'night' ? 'drunk_hiccup' : 'heal');
    return push(m);
  }

  /* ---------- INN (safe room: a Renaissance-fair pub) ---------- */
  var KEEPER_LINES = {
    gordo: ['WELCOME TO THE BELLY-RUBBED PUG! BEDS UPSTAIRS, ALE DOWN HERE, SMELL EVERYWHERE.', 'WIPE YOUR FEET. HM. NO SHOES. WIPE WHATEVER THOSE ARE.', 'THE PUG IN THE PAINTING WAS A VERY GOOD BOY. NOBODY KNOWS WHY HE\'S ALWAYS ON HIS BACK.'],
    fitz: ['ONE-EYED NARWHAL. BEDS ARE TWENTY. THE NARWHAL ON THE WALL SEES EVERYTHING. HALF OF EVERYTHING.', 'NO FIGHTING INDOORS. THE GUARDS DON\'T COME IN HERE, BUT MY COOK DOES.', 'HAD A SKYFOWL IN LAST WEEK. STILL FINDING FEATHERS IN THE STEW.']
  };
  var MORD_HELLO = ['I CAN\'T FIGHT, I CAN\'T LEAVE THIS ROOM, AND I CAN\'T DRINK FAST ENOUGH. WHAT DO YOU NEED?', 'YOU\'RE ALIVE. GOOD. I HAD MONEY ON IT. NOT MUCH, BUT SOME.', 'SIT. DRINK. TELL ME WHAT YOU BROKE TODAY.'];
  var MORD_TIPS = ['THE GUARDS ARE LEVEL 75 AND THEY DO NOT DO JAIL. HIT A CITIZEN IN DAYLIGHT AND YOU\'RE A STAIN.', 'NIGHT IS WHEN THE ALLEYS GET INTERESTING. INTERESTING MEANS LETHAL.', 'FIRE IS YOUR FRIEND. MOLD LIONS THAT BURN STAY DEAD.', 'BRING ME MOONSHINE AND I\'LL TURN IT INTO A JUG O\'BOOM. ALCHEMY. ALSO, DRINKING.', 'SPEND YOUR STAT POINTS HERE. THE DUNGEON DOESN\'T ACCEPT IOUS.'];
  // a sprite standing behind a counter: only the part above counterTop shows
  function behindCounter(ctx, name, x, counterTop, o) {
    var inf = artInfo(name) || { h: 26 };
    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W, counterTop); ctx.clip();
    spr(ctx, name, x, counterTop + Math.round(inf.h * 0.38), o);
    ctx.restore();
  }
  scenes.inn = {
    COUNTER: 121,
    enter: function (p) {
      closeAll();
      p = p || {};
      var run = getRun(), inns = D('inns') || {};
      this.innId = p.innId || (run && run.inInn) || 'pug';
      var dflt = this.innId === 'narwhal' ? { name: 'THE ONE-EYED NARWHAL', price: 20, keeper: 'fitz' } : { name: 'THE BELLY-RUBBED PUG', price: 10, keeper: 'gordo' };
      this.inn = inns[this.innId] || dflt;
      this.keeper = this.inn.keeper || dflt.keeper;
      this.keeperName = up(this.inn.keeperName || this.keeper.replace(/_/g, ' '));
      roomInit(this, 278);
      this.cx = 292; this.mx = 210; this.mTarget = 210; this.kx = 176;
      this.objs = [
        { id: 'wardrobe', x: 44, label: 'COSTUME TRUNK', verb: 'CHANGE', h: 30 },
        { id: 'mordecai', x: 110, label: 'MORDECAI', verb: 'TALK', h: 48 },
        { id: 'boxes', x: 150, label: 'LOOT BOXES', verb: 'OPEN', h: 30 },
        { id: 'board', x: 196, label: 'THE TV SCREENS', verb: 'ACHIEVEMENTS', h: 40 },
        { id: 'keeper', x: 246, label: this.keeperName, verb: 'ROOMS', h: 52 },
        { id: 'door', x: 302, label: 'EXIT', verb: 'LEAVE', h: 56 }
      ];
      this.telePlayed = false;
      this.greet = pick(lineList(this.inn.lines || this.inn.hello)) || pick(KEEPER_LINES[this.keeper]) || 'WELCOME. BEDS ARE UPSTAIRS. DON\'T STEAL THE MUGS.';
      this.greetT = 3.6;
      music(this.inn.music || 'inn');
    },
    price: function () {
      var p = G('innPrice', this.innId);
      if (typeof p === 'number') return p;
      return Math.round((this.inn.price || 10) * (1 + (actNum() - 1) * 0.4));
    },
    keeperLine: function () { return pick(lineList(this.inn.lines)) || pick(KEEPER_LINES[this.keeper]) || 'NEED A BED?'; },
    sleep: function (until) { sleepAnim(this.innId, until, this.keeperName); },
    keeperMenu: function () {
      var self = this, ck = clockInfo(), price = this.price(), run = getRun() || {};
      ui.menu([
        { label: 'SLEEP UNTIL MORNING', right: price + 'G', icon: 'bed', disabled: (run.gold || 0) < price, why: 'NOT ENOUGH GOLD. ' + price + ' A NIGHT. NO CREDIT.', hint: 'FULL HEAL. WAKE UP AT 07:00.', action: function () { self.sleep('morning'); } },
        { label: 'WAIT FOR NIGHT', right: 'FREE', icon: 'moon', disabled: !!(ck && ck.night), why: 'IT IS ALREADY NIGHT. THE URCHINS ARE OUT.', hint: 'SKIP TO 19:00. NO HEAL.', action: function () { self.sleep('night'); } },
        { label: 'CHAT', icon: 'eye', action: function () { ui.say([{ who: self.keeperName, text: self.keeperLine() }]); } },
        { label: 'NEVERMIND' }
      ], { title: up(this.inn.name), titleColor: C.gold, w: 210 });
    },
    craftMenu: function () {
      var rec = D('recipes') || {}, ids = Object.keys(rec);
      if (!ids.length) { ui.say([{ who: 'MORDECAI', text: 'I\'D CRAFT YOU SOMETHING, BUT NOBODY GAVE ME ANY RECIPES. OR GLASSWARE.' }]); return; }
      function need(rc) { var n = rc.needs || {}, parts = Object.keys(n).map(function (k) { return n[k] + ' ' + itemName(k); }); if (rc.gold) parts.push(rc.gold + ' GOLD'); return parts.join(' + ') || 'NOTHING'; }
      function gives(rc) { var g = rc.gives || {}; return Object.keys(g).map(function (k) { return g[k] + ' ' + itemName(k); }).join(' + ') || '?'; }
      function can(rc) { var n = rc.needs || {}, run = getRun() || {}; for (var k in n) if (itemCount(k) < n[k]) return false; return !(rc.gold && (run.gold || 0) < rc.gold); }
      var items = ids.map(function (id) {
        var rc = rec[id] || {}, g = Object.keys(rc.gives || {})[0];
        return { label: up(rc.name || id), icon: g ? itemIcon(g) : 'gear', right: function () { return can(rc) ? 'READY' : ''; }, keep: true,
          hint: need(rc) + ' → ' + gives(rc),
          action: function () {
            if (!can(rc)) { sfx('error'); ui.toast('NEEDS ' + need(rc), { icon: 'skull', color: C.red }); return; }
            var res = G('craft', id) || { ok: false, msg: 'MORDECAI IS TOO DRUNK TO CRAFT RIGHT NOW.' };
            ui.toast(res.msg || (res.ok ? 'CRAFTED' : 'FAILED'), { icon: res.ok && g ? itemIcon(g) : 'skull', color: res.ok ? C.green : C.red });
          } };
      });
      items.push({ label: 'DONE' });
      ui.menu(items, { title: 'ALCHEMY WITH MORDECAI', titleColor: C.green, w: 236 });
    },
    mordMenu: function () {
      var self = this, run = getRun() || {}, md = D('mordecai');
      var tips = lineList(md && !Array.isArray(md) && md.tips ? md.tips : md);
      var tip = function () { var tt = pick(tips) || pick(MORD_TIPS); ui.say(typeof tt === 'object' ? [tt] : [{ who: 'MORDECAI', text: tt }]); };
      var obj = function () { var o = objectiveInfo(); ui.say([{ who: 'MORDECAI', text: o ? 'HERE\'S THE JOB: ' + up(o.text) + '. TRY NOT TO DIE DOING IT.' : 'NOTHING URGENT. WHICH MEANS SOMETHING TERRIBLE IS ABOUT TO HAPPEN.' }]); };
      ui.menu([
        { label: 'ASK FOR A TIP', action: tip },
        { label: 'WHAT NOW?', action: obj },
        { label: 'CRAFT', action: function () { self.craftMenu(); }, hint: 'MOONSHINE GOES IN. EXPLOSIONS COME OUT.' },
        { label: run.statPoints > 0 ? 'TRAIN (' + run.statPoints + ' POINT' + (run.statPoints > 1 ? 'S' : '') + ')' : 'TRAIN', disabled: !(run.statPoints > 0), why: 'NO STAT POINTS. GO LEVEL UP.', action: function () { ui.openCharacter(); } },
        { label: 'NEVERMIND' }
      ], { title: 'MORDECAI, LEVEL 50 INCUBUS', titleColor: C.green });
    },
    innMenu: function () {
      var self = this, ck = clockInfo(), price = this.price(), run = getRun() || {}, nb = (run.boxes || []).length;
      ui.menu([
        { label: 'SLEEP UNTIL MORNING', right: price + 'G', disabled: (run.gold || 0) < price, why: 'NOT ENOUGH GOLD. ' + price + ' A NIGHT.', action: function () { self.sleep('morning'); } },
        { label: 'WAIT FOR NIGHT', right: 'FREE', disabled: !!(ck && ck.night), why: 'IT IS ALREADY NIGHT.', action: function () { self.sleep('night'); } },
        { label: 'TALK TO MORDECAI', action: function () { self.mordMenu(); } },
        { label: 'CRAFT', action: function () { self.craftMenu(); } },
        { label: 'LOOT BOXES', right: nb ? String(nb) : '', action: ui.openBoxes },
        { label: 'CHARACTER', right: run.statPoints > 0 ? '+' + run.statPoints : '', action: ui.openCharacter },
        { label: 'GEAR', right: runGear().length ? String(runGear().length) : '', action: ui.openGear },
        { label: 'WARDROBE', action: ui.openWardrobe },
        { label: 'ACHIEVEMENTS', action: ui.openAchievements },
        { label: 'LEAVE', color: C.orange, action: function () { self.leave(); } },
        { label: 'MORE...', action: function () { ui.openPause({ canFlee: false }); } }
      ], { title: up(this.inn.name), titleColor: C.gold, w: 196 });
    },
    leave: function () {
      var self = this;
      ui.confirm('LEAVE ' + up(this.inn.name) + '?', function () {
        self.leaving = true; sfx('door');
        if (tryCall(DCW.game, 'leaveInn', []) === MISSING && tryCall(DCW.game, 'leaveSafeRoom', []) === MISSING) { self.leaving = false; ui.toast('NOWHERE TO GO', { color: C.red }); }
      });
    },
    interact: function (o) {
      sfx('menu_select');
      if (o.id === 'keeper') this.keeperMenu();
      else if (o.id === 'mordecai') {
        var self = this;
        if (!this.mordSaid) { this.mordSaid = true; ui.say([{ who: 'MORDECAI', text: pick(MORD_HELLO) }], { onDone: function () { self.mordMenu(); } }); }
        else this.mordMenu();
      }
      else if (o.id === 'boxes') ui.openBoxes();
      else if (o.id === 'wardrobe') ui.openWardrobe();
      else if (o.id === 'board') ui.openAchievements();
      else if (o.id === 'door') this.leave();
    },
    update: function (dt) {
      this.t += dt; this.greetT -= dt;
      if (!this.telePlayed && this.t > 0.25) { this.telePlayed = true; sfx('teleport'); }
      if (this.leaving) return;
      tryCall(DCW.game, 'tick', [dt]);
      roomWalk(this, dt);
      if (P('start')) { sfx('pause'); this.innMenu(); return; }
      if (P('select')) { ui.openGear(); return; }
      if (roomPet(this)) return;
      if ((P('confirm') || P('up')) && this.near) this.interact(this.near);
    },
    idle: function (dt) { this.t += dt; this.greetT -= dt; },
    draw: function (ctx) {
      var t = this.t, id = this.innId, CT = this.COUNTER;
      if (!drawBg(ctx, this.inn.theme || ('inn_' + id), 0, 0, { t: t, night: !!(clockInfo() || {}).night })) drawInnRoom(ctx, id, t, GROUND);
      // costume trunk in front of the hearth
      R(31, GROUND - 14, 26, 14, '#000'); R(32, GROUND - 13, 24, 13, '#7c3c18'); R(32, GROUND - 13, 24, 2, '#a85010'); R(42, GROUND - 9, 4, 4, C.gold);
      R(30, GROUND - 20, 28, 6, '#000'); R(31, GROUND - 19, 26, 4, '#5c2c10');
      R(36, GROUND - 17, 4, 5, '#881488'); R(46, GROUND - 18, 3, 6, '#f8b800'); R(51, GROUND - 16, 4, 3, '#0058f8');
      // Mordecai (teleports in with a puff) at his little table
      R(82, GROUND - 16, 22, 4, '#000'); R(83, GROUND - 15, 20, 3, '#a85010'); R(91, GROUND - 12, 4, 12, '#5c3c24'); R(86, GROUND - 21, 4, 6, '#f8d878'); R(87, GROUND - 22, 2, 1, C.white); R(97, GROUND - 20, 3, 5, '#5c5c5c');
      var tk = clamp((t - 0.25) / 0.5, 0, 1);
      if (tk >= 0.5) spr(ctx, actorName('mordecai', 'idle'), 110, GROUND, { frame: Math.floor(t * 1.5), flip: this.x < 110 });
      if (tk > 0 && tk < 1) for (var pf = 0; pf < 10; pf++) { var pa = pf * 0.63 + t * 3, pr = 4 + tk * 16; ctx.globalAlpha = 1 - tk; R(110 + Math.cos(pa) * pr - 2, GROUND - 16 + Math.sin(pa) * pr * 0.8 - 2, 5, 5, pf % 2 ? '#d800cc' : '#bcbcbc'); ctx.globalAlpha = 1; }
      // loot box pile under the TVs
      var run = getRun() || {}, bx = run.boxes || [];
      if (!bx.length) spr(ctx, 'box_bronze', 150, GROUND, { alpha: 0.3 });
      bx.slice(0, 3).forEach(function (b, i) { spr(ctx, 'box_' + b.tier, 144 + (i % 2) * 12, GROUND - Math.floor(i / 2) * 13, { frame: i === 0 ? Math.floor(t * 4) : 0 }); });
      if (bx.length) { DCW.box(158, GROUND - 32, tw(bx.length) + 8, 11, { fill: C.red }); T(bx.length, 162, GROUND - 30, C.white); }
      // the keeper, behind the bar
      behindCounter(ctx, actorName(this.keeper, 'idle'), 246, CT, { frame: Math.floor(t * 2), flip: this.x < 246 });
      spr(ctx, firstArt(['door_inn', 'door_wood', 'door']) || 'door', 302, GROUND, { frame: Math.floor(t * 2) });
      roomCast(ctx, this, t);
      if (this.greetT > 0) bubble(ctx, this.greet, 246, CT - 18, { w: 136, lines: 5 });
      ui.drawHUD(ctx, ui.hudFromRun({ party: true }));
      T(fitText(up(this.inn.name), 200), 4, 16, C.gold, { shadow: '#000' });
      roomPrompt(ctx, this, t);
    }
  };
  scenes.safeRoom = scenes.inn; // book 1 name

  /* ---------- THE DESPERADO CLUB ---------- */
  var CLUB_FB = {
    door: ['I\'M CLARABELLE. NO FIGHTING, NO BITING, AND KEEP THE DINOSAUR ON A LEASH.', 'I EAT PEOPLE WHO START FIGHTS. IT\'S IN MY CONTRACT. AND MY DIET.', 'YOU\'RE NOT ON THE LIST. NOBODY IS ON THE LIST. THERE IS NO LIST. GO IN.'],
    quint: ['YOU NEED SOMETHING. I HAVE SOMETHING. LET\'S NOT MAKE THIS WEIRD.'],
    dance: [
      [{ who: 'DONUT', text: 'CARL. STOP. PEOPLE ARE FILMING. ACTUALLY EVERYONE IS ALWAYS FILMING. CARRY ON, I SUPPOSE.' }],
      [{ who: 'SYSTEM AI', text: 'VIEWERS IN FOURTEEN STAR SYSTEMS ARE REPORTING SECONDHAND EMBARRASSMENT. RATINGS ARE UP.' }],
      [{ who: 'DONUT', text: 'IT\'S LIKE WATCHING A BEAR GET ELECTROCUTED. BUT FESTIVE.' }, { who: 'CARL', text: 'THAT\'S THE NICEST THING YOU\'VE EVER SAID TO ME.' }]
    ],
    bar: [
      [{ who: 'DONUT', text: 'A DIRTY SHIRLEY, PLEASE. EXTRA CHERRIES. I\'M FAMOUS.' }, { who: 'CARL', text: 'BEER. WHATEVER\'S COLD AND NOT MOVING.' }],
      [{ who: 'CARL', text: 'THE BARTENDER IS WATCHING MONGO LIKE HE\'S A WALKING HEALTH CODE VIOLATION.' }, { who: 'DONUT', text: 'HE IS, CARL. HE\'S ADORABLE, BUT HE IS.' }]
    ]
  };
  scenes.club = {
    COUNTER: 129,
    enter: function (p) {
      closeAll();
      p = p || {};
      var run = getRun();
      this.clubId = p.clubId || (run && run.inClub) || 'desperado';
      this.club = (D('clubs') || {})[this.clubId] || {};
      this.name = up(this.club.name || 'THE DESPERADO CLUB');
      this.shopId = this.club.shop || 'quint';
      roomInit(this, 72);
      this.face = 1; this.cx = 56; this.mx = 200; this.mTarget = 200; this.kx = 228;
      this.objs = [
        { id: 'door', x: 16, label: 'EXIT', verb: 'LEAVE', h: 58 },
        { id: 'bouncer', x: 44, label: 'CLARABELLE', verb: 'TALK', h: 46 },
        { id: 'quint', x: 98, label: "QUINT'S PHARMACY", verb: 'SHOP', h: 44 },
        { id: 'dance', x: 168, r: 28, label: 'DANCE FLOOR', verb: 'DANCE', h: 34 },
        { id: 'bar', x: 278, r: 22, label: 'THE BAR', verb: 'ORDER', h: 44 }
      ];
      this.greet = pick(lineList(this.club.lines && this.club.lines.door)) || pick(CLUB_FB.door);
      this.greetT = 3.6; this.hype = 0; this.danced = false;
      music(this.club.music || 'club');
    },
    lines: function (key) { var l = this.club.lines && this.club.lines[key]; return lineList(l).length ? lineList(l) : CLUB_FB[key]; },
    leave: function () {
      this.leaving = true; sfx('door');
      if (tryCall(DCW.game, 'leaveClub', []) === MISSING) { this.leaving = false; ui.toast('THE DOOR IS STUCK. CLARABELLE IS LEANING ON IT.', { color: C.red }); }
    },
    startDance: function () {
      this.dance = 2.6; this.hype = 1; sfx('fanfare');
      if (!this.danced) { this.danced = true; G('track', 'dance'); }
    },
    clubMenu: function () {
      var self = this, o = {};
      this.objs.forEach(function (ob) { o[ob.id] = ob; });
      ui.menu([
        { label: "QUINT'S PHARMACY", action: function () { self.interact(o.quint); } },
        { label: 'DANCE', action: function () { self.startDance(); } },
        { label: 'TALK TO CLARABELLE', action: function () { self.interact(o.bouncer); } },
        { label: 'THE BAR', action: function () { self.interact(o.bar); } },
        { label: 'LEAVE', color: C.orange, action: function () { self.leave(); } },
        { label: 'MORE...', action: function () { ui.openPause({ canFlee: false }); } }
      ], { title: this.name, titleColor: C.pink, border: C.pink, w: 180 });
    },
    sayPick: function (key, who) {
      var l = pick(this.lines(key));
      if (!l) return;
      ui.say(Array.isArray(l) ? l : [typeof l === 'string' ? { who: who, text: l } : l]);
    },
    interact: function (o) {
      sfx('menu_select');
      if (o.id === 'door') this.leave();
      else if (o.id === 'bouncer') this.sayPick('door', 'CLARABELLE');
      else if (o.id === 'quint') { var ql = this.club.lines && lineList(this.club.lines.quint), q = ql && ql.length ? pick(ql) : (shopDef(this.shopId) ? null : pick(CLUB_FB.quint)); ui.openShop(this.shopId, q ? { greet: typeof q === 'string' ? q : q.text } : {}); }
      else if (o.id === 'dance') this.startDance();
      else if (o.id === 'bar') this.sayPick('bar', 'DONUT');
    },
    update: function (dt) {
      this.t += dt; this.greetT -= dt;
      if (this.leaving) return;
      tryCall(DCW.game, 'tick', [dt]);
      if (this.dance > 0) { this.dance -= dt; if (this.dance <= 0) { this.hype = 0; this.sayPick('dance', 'DONUT'); } }
      roomWalk(this, dt);
      if (this.dance > 0) return;
      if (P('start')) { sfx('pause'); this.clubMenu(); return; }
      if (P('select')) { ui.openGear(); return; }
      if (roomPet(this)) return;
      if ((P('confirm') || P('up')) && this.near) this.interact(this.near);
    },
    idle: function (dt) { this.t += dt; this.greetT -= dt; },
    draw: function (ctx) {
      var t = this.t, CT = this.COUNTER;
      if (!drawBg(ctx, this.club.theme || 'club', 0, 0, { t: t })) drawClubRoom(ctx, t, this.hype, GROUND);
      if (this.hype > 0) { ctx.globalAlpha = 0.18 + 0.12 * Math.sin(t * 20); R(0, 0, W, H, ['#d800cc', '#3cbcfc', '#f8b800'][Math.floor(t * 6) % 3]); ctx.globalAlpha = 1; }
      spr(ctx, firstArt(['door_club', 'door_pub', 'door']) || 'door', 16, GROUND, { frame: Math.floor(t * 3) });
      [60, 76].forEach(function (px) { R(px, GROUND - 14, 3, 14, '#ac7c00'); R(px - 1, GROUND - 16, 5, 3, C.gold); });
      R(62, GROUND - 12, 15, 2, '#a81000'); R(65, GROUND - 11, 9, 2, '#a81000');
      spr(ctx, actorName('clarabelle', 'idle'), 44, GROUND, { frame: Math.floor(t * 1.5), flip: this.x < 44 });
      // Quint's pharmacy counter (Quint stands behind it)
      behindCounter(ctx, actorName('quint', 'idle'), 98, CT, { frame: Math.floor(t * 2), flip: this.x < 98 });
      R(78, CT, 42, GROUND - CT, '#000'); R(79, CT + 1, 40, GROUND - CT - 1, '#2c2c3c'); R(79, CT + 1, 40, 2, '#7c7c9c');
      R(95, CT + 7, 8, 8, '#00a800'); R(98, CT + 8, 2, 6, C.white); R(96, CT + 10, 6, 2, C.white);
      for (var bt = 0; bt < 4; bt++) { R(82 + bt * 3, CT - 5, 2, 5, [C.green, C.purple, C.blue, C.yellow][bt]); R(108 + bt * 3, CT - 4, 2, 4, [C.yellow, C.blue, C.green, C.purple][bt]); }
      roomCast(ctx, this, t);
      if (this.greetT > 0) bubble(ctx, this.greet, 44, GROUND - 74, { w: 136, lines: 6 });
      ui.drawHUD(ctx, ui.hudFromRun({ party: true }));
      T(this.name, 4, 16, C.pink, { shadow: '#000' });
      roomPrompt(ctx, this, t);
    }
  };

  /* ---------- ENDINGS (win | early | collapse) + CREDITS ---------- */
  var ENDING_FB = {
    win: [
      { text: 'THE GUARD DEPOT WENT UP LIKE THE FOURTH OF JULY. THE BLAST SWALLOWED THE WORST OF THE GLASS. MOSTLY.', vignette: 'doomsday' },
      { text: 'THE EASTERN STAIRWELL SPAT THEM OUT IN ODETTE\'S GREEN ROOM: SINGED, LOUD, AND STILL ALIVE.', vignette: 'greenroom' },
      { text: 'CARL\'S DOOMSDAY SCENARIO IS STILL IN HIS INVENTORY. IT IS STILL GOING TO EXPLODE. SOMEDAY.', portrait: 'p_ai', vignette: 'screen' },
      { text: 'FLOOR FOUR IS WAITING. IT ALWAYS IS. BUT TONIGHT, THE OVER CITY IS A CRATER WITH CARL\'S NAME ON IT.', vignette: 'stairs' }
    ],
    early: [
      { text: 'CARL TOOK THE STAIRS IN THE CIRCUS PARK. THE OVER CITY SHRANK ABOVE HIM LIKE A BAD DREAM.', vignette: 'stairs' },
      { text: 'THE SETTLEMENT. THE KRASUE. THE GLASS. ALL OF IT HAPPENED TO SOMEBODY ELSE.', vignette: 'overcity' },
      { text: 'ACHIEVEMENT UNLOCKED: EARLY BIRD GETS TO SQUIRM. YOU MISSED THE BEST PART. WE HAD FIREWORKS PLANNED.', portrait: 'p_ai', vignette: 'screen' }
    ],
    collapse: [
      { text: 'THE CLOCK HIT ZERO. THE THIRD FLOOR FOLDED IN ON ITSELF, RUINS, VILLAGES, CIRCUS AND ALL.', vignette: 'collapse' },
      { text: 'SOMEWHERE ABOVE, THE AUDIENCE SIGHED, CHANGED THE CHANNEL AND ORDERED SNACKS.', vignette: 'night' },
      { text: 'TIME MANAGEMENT, CRAWLER. IT\'S A SKILL. YOU DIDN\'T HAVE IT.', portrait: 'p_ai', vignette: 'screen' }
    ]
  };
  var ENDING_KEYS = { win: ['ending', 'winEnding'], early: ['earlyEnding'], collapse: ['collapseEnding'] };
  var ENDING_VIG = { win: ['doomsday', 'greenroom', 'screen', 'stairs'], early: ['stairs', 'overcity', 'screen'], collapse: ['collapse', 'night', 'screen'] };
  var CREDITS_FB = ['DUNGEON CRAWLER CARL', 'BOOK TWO', "CARL'S DOOMSDAY SCENARIO", '', 'A PERSONAL FAN GAME', 'BASED ON THE DUNGEON CRAWLER CARL NOVELS', 'NOT FOR SALE. NOT OFFICIAL.', '', 'STARRING', 'CARL', 'PRINCESS DONUT', 'MONGO', 'KATIA GRIM', '', 'MANAGED BY', 'MORDECAI, LEVEL 50 INCUBUS', '', 'HOSTED BY', 'THE SYSTEM AI', '', 'NO PANTS WERE HARMED', 'IN THE MAKING OF THIS FLOOR', '', 'THANKS FOR PLAYING!'];
  var CREDIT_HEADS = /^(STARRING|HOSTED BY|MANAGED BY|MUSIC|ART|CODE|WRITTEN BY|THANKS|BASED ON|WITH|SPECIAL THANKS|PRODUCED BY|DIRECTED BY|CAST)/;
  scenes.ending = {
    enter: function (p) {
      closeAll();
      p = p || {};
      var self = this;
      this.kind = ENDING_KEYS[p.kind] ? p.kind : 'win';
      this.t = 0; this.ct = 0; this.done = false;
      this.phase = this.kind === 'collapse' ? 'card' : 'story';
      music(this.kind === 'win' ? 'ending' : this.kind === 'early' ? 'sad' : 'gameover');
      if (this.kind === 'collapse') { if (DCW.shake) DCW.shake(4, 1.6); sfx('explosion'); }
      var pages = null;
      ENDING_KEYS[this.kind].forEach(function (k) { if (!pages) { var st = D('story'); if (st && Array.isArray(st[k]) && st[k].length) pages = storyPages(k, []); } });
      if (!pages || !pages.length) pages = storyPages('__none__', ENDING_FB[this.kind]);
      this.pager = storyPager(pages, ENDING_VIG[this.kind], function () {
        if (self.kind === 'collapse') { self.phase = 'stats'; self.ct = 0; sfx('menu_select'); }
        else { self.phase = 'credits'; self.ct = 0; music('credits'); }
      });
      var st2 = D('story'), cr = st2 && st2.credits;
      this.credits = (Array.isArray(cr) && cr.length ? cr : CREDITS_FB).map(function (l) {
        if (l && typeof l === 'object') return { text: up(l.text), color: l.color, head: !!l.head, big: !!l.big };
        var s2 = up(l); return { text: s2, head: CREDIT_HEADS.test(s2) };
      });
    },
    finish: function () {
      if (this.done) return; this.done = true; sfx('menu_select');
      var fn = this.kind === 'win' ? 'quitToTitle' : 'endRun';
      if (tryCall(DCW.game, fn, []) === MISSING && tryCall(DCW.game, 'quitToTitle', []) === MISSING) DCW.fade(function () { DCW.setScene(scenes.title, {}); });
    },
    update: function (dt) {
      this.t += dt;
      if (this.phase === 'card') {
        this.ct += dt;
        if (this.ct > 3.2 || ((P('confirm') || P('start')) && this.ct > 0.8)) { this.phase = 'story'; this.ct = 0; sfx('menu_select'); }
        return;
      }
      if (this.phase === 'story') { this.pager.update(dt); return; }
      if (this.phase === 'credits') {
        this.ct += dt * (Dn('confirm') || Dn('jump') ? 5 : 1);
        if (P('start') || this.ct * 18 > this.credits.length * 14 + this.credits.filter(function (l) { return l.big; }).length * 10 + H + 40) { this.phase = 'stats'; this.ct = 0; sfx('fanfare'); }
        return;
      }
      this.ct += dt;
      if ((P('confirm') || P('start')) && this.ct > 0.8) this.finish();
    },
    idle: function (dt) { this.t += dt; },
    draw: function (ctx) {
      var t = this.t;
      if (this.phase === 'card') {
        bands(ctx, ['#000000', '#140000', '#280404', '#3c0808'], 0, H);
        VIG.collapse(ctx, t, 0, 30, W, 120);
        var k = clamp(this.ct / 0.5, 0, 1);
        ctx.globalAlpha = 0.7 * k; R(0, 32, W, 58, '#000'); if (this.ct > 1.2) R(0, 132, W, 26, '#000'); ctx.globalAlpha = 1;
        T('THE FLOOR HAS', 160, 40 - Math.round((1 - k) * 60), C.white, { align: 'center', scale: 2 });
        T('COLLAPSED', 160, 60 - Math.round((1 - k) * 60), C.red, { align: 'center', scale: 3 });
        if (this.ct > 1.2) T('GAME OVER', 160, 138, blink(2) ? C.red : C.orange, { align: 'center', scale: 2 });
        return;
      }
      if (this.phase === 'story') { R(0, 0, W, H, '#000'); this.pager.draw(ctx); return; }
      R(0, 0, W, H, '#05030c'); stars(ctx, t, 6, 110);
      if (this.phase === 'credits') {
        var yy = H + 10 - this.ct * 18;
        this.credits.forEach(function (l, i) {
          var first = i === 0, big = (first || l.big) && tw(l.text, 2) <= 300;
          if (yy > -20 && yy < H) T(l.text, 160, yy, l.color || (first ? C.gold : l.head ? C.pink : C.white), { align: 'center', scale: big ? 2 : 1 });
          yy += big ? 24 : 14;
        });
        var rx = (t * 40) % 360 - 20;
        spr(ctx, actorName(compSprite('mongo'), 'walk'), rx - 22, 176, { frame: Math.floor(t * 10) });
        spr(ctx, actorName('carl', 'walk'), rx, 176, { frame: Math.floor(t * 10), skin: equipped('skin') });
        if (!shoulderDonut(ctx, rx, 176, 1, Math.floor(t * 4))) spr(ctx, actorName('donut', 'walk'), rx + 18, 176, { frame: Math.floor(t * 10) });
        T(bn('start') + ': SKIP', 314, 4, C.ddgray, { align: 'right', shadow: null });
        return;
      }
      var run = getRun() || {}, meta = (DCW.save && DCW.save.meta) || {};
      var achs = D('achievements') || {}, an2 = Object.keys(meta.achievements || {}).length, ck = clockInfo();
      var head = this.kind === 'win' ? 'FINAL STATS' : this.kind === 'early' ? 'YOU LEFT EARLY' : 'GAME OVER';
      frame(ctx, head, { dim: false, footer: bn('confirm') + ': BACK TO TITLE', titleColor: this.kind === 'collapse' ? C.red : C.gold });
      var rows = [
        ['LEVEL', String(run.level || '-')],
        ['VIEWERS', fmtNum(run.views || 0)],
        ['FAN TITLE', up(titleFor(run.views || 0))],
        ['KILLS', String(run.kills || 0)],
        ['TIME LEFT ON THE FLOOR', ck ? ck.label : '-'],
        ['PLAY TIME', fmtTime(run.totalTime || 0)],
        ['DEATHS (ALL TIME)', String(meta.deaths || 0)],
        ['ACHIEVEMENTS', an2 + '/' + Object.keys(achs).length],
        ['WINS', String(meta.wins || 0)]
      ];
      rows.forEach(function (r, i) { var yy = 26 + i * 13; T(r[0], 20, yy, C.gray); T(fitText(r[1], 150), 300, yy, i === 2 ? C.pink : C.white, { align: 'right' }); });
      spr(ctx, 'ai_screen', 286, 160 + Math.round(Math.sin(t * 2) * 2), { frame: Math.floor(t * 2) });
    }
  };
  scenes.gameover = { enter: function (p) { var q = p || {}; DCW.setScene(scenes.ending, { kind: q.kind || 'collapse' }); } };

  /* ---------------- helpers for other modules (stage, rooms, show) ---------------- */
  ui._h = { tryCall: tryCall, G: G, hasG: hasG, sfx: sfx, music: music, D: D, getRun: getRun, floorDef: floorDef, stageDef: stageDef, levelDef: levelDef, areaDef: areaDef,
    spr: spr, bigSprite: bigSprite, portrait: portrait, faceSlot: faceSlot, faceFrame: faceFrame, icon: icon, itemIcon: itemIcon, itemName: itemName, itemCount: itemCount,
    hasArt: hasArt, artInfo: artInfo, actorName: actorName, T: T, tw: tw, fitText: fitText, wrap: wrap, blink: blink, bubble: bubble, cursor: cursor,
    equipped: equipped, compSprite: compSprite, pStats: pStats, bn: bn, persist: persist, aiLine: aiLine, clamp: clamp, clock: clockInfo, objective: objectiveInfo,
    party: partyList, wobble: wobble, drawBg: drawBg, drawPanel: drawPanel, themeBackdrop: themeBackdrop, MISSING: MISSING, C: C };
})();

/* ============================================================
   DCW OVERWORLD - TMNT-NES style top-down map for floors 3+.
   DCW.overworld.scene.enter({floor}) reads floor.overworld,
   run.owPos, and calls DCW.game.enterEntrance(ch) /
   DCW.game.enterEntrance('!ambush:' + roamerIndex).
   ============================================================ */
(function () {
  'use strict';
  var DCW = window.DCW = window.DCW || {};
  var OW = DCW.overworld = DCW.overworld || {};
  var W = 320, H = 180, TS = 16;
  var BLOCK = { '#': 1, '~': 1, 'T': 1 };
  var HUD_H = 14;

  /* ---------------- defensive helpers (prefer ui.js shared ones) ---------------- */
  var MISSING = { missing: true };
  function h() { return (DCW.ui && DCW.ui._h) || null; }
  function tryCall(obj, name, args) {
    if (!obj || typeof obj[name] !== 'function') return MISSING;
    try { return obj[name].apply(obj, args || []); } catch (e) { console.error('[overworld] ' + name + ' failed', e); return MISSING; }
  }
  function G(name) { var r = tryCall(DCW.game, name, [].slice.call(arguments, 1)); return r === MISSING ? undefined : r; }
  function sfx(n, o) { tryCall(DCW.audio, 'sfx', [n, o]); }
  function music(t) { tryCall(DCW.audio, 'music', [t]); }
  function D(k) { return (DCW.data && DCW.data[k]) || null; }
  function getRun() {
    var r = null;
    try { r = DCW.game ? DCW.game.run : null; } catch (e) { r = null; }
    if (r === undefined || r === null) r = (DCW.save && DCW.save.run) || null;
    return r;
  }
  function T(s, x, y, c, o) { return DCW.text(s === undefined || s === null ? '' : String(s), x, y, c || '#fcfcfc', o); }
  function tw(s) { return DCW.textWidth(String(s)); }
  function fit(s, px) { s = String(s || ''); var m = Math.max(1, Math.floor((px + 1) / 6)); return s.length > m ? s.slice(0, m - 1) + '.' : s; }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function blink(r) { return Math.floor((DCW.t || 0) * (r || 3)) % 2 === 0; }
  function P(b) { return DCW.input && DCW.input.pressed(b); }
  function Dn(b) { return DCW.input && DCW.input.down(b); }
  function spr(ctx, name, x, y, o) {
    var hh = h(); if (hh) return hh.spr(ctx, name, x, y, o);
    if (DCW.art && DCW.art.sprite) { try { DCW.art.sprite(ctx, name, Math.round(x), Math.round(y), o || {}); return true; } catch (e) { /* fall through */ } }
    DCW.rect(x - 6, y - 12, 12, 12, '#d82800'); return false;
  }
  function icon(ctx, name, x, y) { var hh = h(); if (hh) hh.icon(ctx, name, x, y); else T('●', x, y, '#f8b800'); }
  function hasArt(n) { var hh = h(); return hh ? hh.hasArt(n) : !!(DCW.art && DCW.art.has && DCW.art.has(n)); }
  function equippedComp() { return (DCW.save && DCW.save.equipped && DCW.save.equipped.companion) || 'donut'; }
  function compSprite() { var hh = h(); if (hh) return hh.compSprite(equippedComp()); return equippedComp(); }
  function skin() { return (DCW.save && DCW.save.equipped && DCW.save.equipped.skin) || 'carl_boxers'; }
  function bn(b) { var hh = h(); return hh ? hh.bn(b) : (b === 'confirm' ? 'A' : b.toUpperCase()); }
  function persist() { if (typeof DCW.persist === 'function') DCW.persist(); }
  function stageDef(id) { var s = D('stages'); return (s && s[id]) || null; }
  function entranceState(ch, ow) {
    if (DCW.ui && typeof DCW.ui.entranceInfo === 'function') return DCW.ui.entranceInfo(ch, ow);
    var st = G('entranceState', ch);
    return st || { kind: 'stage', name: String(ow.entrances[ch] || ch), cleared: false, locked: false };
  }

  /* ---------------- fallback overworld tiles ---------------- */
  var FB = {
    ow_city: { g: '#5c5048', g2: '#4c4038', grass: '#3c6c2c', road: '#3c3c44', line: '#c8b048', wall: '#6c6c7c', wall2: '#4c4c5c', win: '#f8d878', water: '#1c3c9c', tree: '#2c5c1c' },
    ow_rail: { g: '#6c5c44', g2: '#5c4c34', grass: '#5c6c2c', road: '#4c3c2c', line: '#a8a8a8', wall: '#7c5c3c', wall2: '#5c3c2c', win: '#fca044', water: '#2c2c3c', tree: '#4c4c2c' },
    ow_reef: { g: '#d8c888', g2: '#c8b878', grass: '#58a888', road: '#b8a868', line: '#f8f0c0', wall: '#e86888', wall2: '#a84868', win: '#f8d8f8', water: '#0858b8', tree: '#28a878' },
    ow_woods: { g: '#4c6c2c', g2: '#3c5c24', grass: '#2c7c2c', road: '#7c5c34', line: '#9c7c4c', wall: '#5c4c3c', wall2: '#3c2c1c', win: '#f8d878', water: '#1c4c7c', tree: '#14481c' },
    ow_manor: { g: '#3c3448', g2: '#2c2438', grass: '#2c4c3c', road: '#5c5c64', line: '#8c8c94', wall: '#5c4c6c', wall2: '#3c2c4c', win: '#d8f878', water: '#1c1c3c', tree: '#1c2c24' },
    ow_waste: { g: '#7c6c4c', g2: '#6c5c3c', grass: '#8c7c3c', road: '#5c5444', line: '#a89868', wall: '#6c645c', wall2: '#4c443c', win: '#58d854', water: '#4c7c1c', tree: '#4c3c2c' },
    ow_war: { g: '#5c4c3c', g2: '#4c3c2c', grass: '#4c5c2c', road: '#3c3434', line: '#c83c2c', wall: '#5c5c5c', wall2: '#3c3c3c', win: '#f83800', water: '#3c1c1c', tree: '#2c2c1c' }
  };
  function fbTile(ctx, theme, ch, x, y, info) {
    var p = FB[theme] || FB.ow_city, r = function (a, b, w, hh, c) { ctx.fillStyle = c; ctx.fillRect(x + a, y + b, w, hh); };
    var seed = ((info.tx * 73856093) ^ (info.ty * 19349663)) >>> 0;
    switch (ch) {
      case '#':
        r(0, 0, 16, 16, p.wall2); r(0, 0, 16, info.up ? 16 : 12, p.wall); if (!info.down) r(0, 12, 16, 4, p.wall2);
        if (!info.up) r(0, 0, 16, 2, '#000');
        if (seed % 3 === 0) { r(3, 4, 3, 4, p.win); r(10, 4, 3, 4, (seed >> 3) % 2 ? p.win : '#1c1c1c'); }
        break;
      case '~':
        r(0, 0, 16, 16, p.water);
        var o = Math.floor((info.t || 0) * 2 + info.tx) % 2;
        r(2 + o * 4, 5, 4, 1, 'rgba(255,255,255,0.35)'); r(8 - o * 3, 11, 5, 1, 'rgba(255,255,255,0.25)');
        if (!info.up) r(0, 0, 16, 1, 'rgba(0,0,0,0.4)');
        break;
      case 'T':
        r(0, 0, 16, 16, p.g);
        r(2, 12, 12, 3, 'rgba(0,0,0,0.3)'); r(7, 10, 3, 5, '#5c3c18');
        r(2, 1, 12, 11, '#000'); r(3, 2, 10, 9, p.tree); r(4, 3, 4, 3, 'rgba(255,255,255,0.18)');
        break;
      case '=':
        r(0, 0, 16, 16, p.road);
        if (!info.left || !info.right) { if (info.up || info.down) r(7, (seed % 2) * 8 + 2, 2, 4, p.line); }
        else r((seed % 2) * 8 + 2, 7, 4, 2, p.line);
        break;
      case ',':
        r(0, 0, 16, 16, p.grass);
        r(seed % 12, (seed >> 4) % 12, 1, 2, p.g2); r((seed >> 2) % 12 + 2, (seed >> 6) % 12 + 2, 1, 2, p.g2);
        break;
      default:
        r(0, 0, 16, 16, p.g);
        if (seed % 5 === 0) r(seed % 13, (seed >> 5) % 13, 2, 1, p.g2);
    }
  }

  /* ---------------- state ---------------- */
  var S = null;
  function parseMap(rows) {
    rows = (rows || []).map(String);
    var mw = rows.reduce(function (a, r) { return Math.max(a, r.length); }, 0);
    return { rows: rows.map(function (r) { while (r.length < mw) r += '#'; return r; }), w: mw, h: rows.length };
  }
  function charAt(tx, ty) { if (!S || tx < 0 || ty < 0 || tx >= S.mw || ty >= S.mh) return '#'; return S.map[ty].charAt(tx); }
  function baseAt(tx, ty) { if (!S || tx < 0 || ty < 0 || tx >= S.mw || ty >= S.mh) return '#'; return S.base[ty][tx]; }
  function solidT(tx, ty) { return !!BLOCK[baseAt(tx, ty)]; }
  function solidAt(px, py) { return solidT(Math.floor(px / TS), Math.floor(py / TS)); }
  function boxFree(x, y, hw, hh) {
    return !solidAt(x - hw, y - hh) && !solidAt(x + hw - 0.01, y - hh) && !solidAt(x - hw, y + hh - 0.01) && !solidAt(x + hw - 0.01, y + hh - 0.01);
  }
  // move a body along one axis with sub-stepping; returns true if blocked
  function moveAxis(b, dx, dy, hw, hh) {
    var dist = Math.abs(dx || dy), sx = Math.sign(dx), sy = Math.sign(dy), blocked = false;
    while (dist > 0) {
      var st = Math.min(1, dist);
      if (boxFree(b.x + sx * st, b.y + sy * st, hw, hh)) { b.x += sx * st; b.y += sy * st; }
      else { blocked = true; break; }
      dist -= st;
    }
    return blocked;
  }
  // corner assist: when bumping a wall, slide around a corner within 7px
  function nudge(b, dx, dy, hw, hh, amt) {
    var axisX = dx !== 0;
    for (var n = 1; n <= 7; n++) {
      for (var s = -1; s <= 1; s += 2) {
        var ox = axisX ? 0 : s * n, oy = axisX ? s * n : 0;
        if (boxFree(b.x + ox, b.y + oy, hw, hh) && boxFree(b.x + ox + Math.sign(dx), b.y + oy + Math.sign(dy), hw, hh)) {
          moveAxis(b, axisX ? 0 : s * Math.min(amt, n), axisX ? s * Math.min(amt, n) : 0, hw, hh);
          return true;
        }
      }
    }
    return false;
  }

  function tileOf(b) { return { x: clamp(Math.floor(b.x / TS), 0, S.mw - 1), y: clamp(Math.floor(b.y / TS), 0, S.mh - 1) }; }

  OW.playerTile = function () { return S && S.p ? tileOf(S.p) : null; };
  OW.roamerTiles = function () { return S ? S.roamers.filter(function (r) { return r.alive; }).map(function (r) { return tileOf(r); }) : []; };

  OW.init = function () { S = null; };

  function refreshEntrances() {
    if (!S) return;
    S.ents.forEach(function (e) { e.st = entranceState(e.ch, S.ow) || null; e.marker = markerFor(e); });
    S.entT = 0.5;
  }
  var THEME_MARK = { sewer: 'ow_manhole', city: 'ow_door', circus: 'ow_tent', swamp: 'ow_cave', cave: 'ow_cave', train: 'ow_door',
    bubble: 'ow_manhole', forest: 'ow_tent', castle: 'ow_door', ruin: 'ow_cave', warzone: 'ow_tent' };
  function markerFor(e) {
    var st = e.st;
    if (!st) return 'ow_door';
    if (st.kind === 'safe') return 'ow_safe';
    if (st.parade) return 'ow_float';
    if (st.kind === 'boss') return st.locked ? 'ow_boss_locked' : 'ow_boss';
    if (st.race) return 'ow_garage';
    if (st.kind === 'stairs') return st.locked ? 'ow_stairs_locked' : 'ow_stairs';
    var sd = stageDef(st.stageId), th = sd && sd.theme;
    if (sd && sd.owMarker) return sd.owMarker;
    return THEME_MARK[th] || (/[A-F]/.test(e.ch) ? 'ow_manhole' : 'ow_door');
  }

  function nextObjective() {
    var obj = G('objectives');
    if (!Array.isArray(obj)) return '';
    for (var i = 1; i < obj.length; i++) {
      var l = String(obj[i]);
      if (/^(-|▶)\s/.test(l)) return l.replace(/^(-|▶)\s*/, '');
    }
    return '';
  }

  /* ---------------- scene ---------------- */
  OW.scene = {
    enter: function (p) {
      p = p || {};
      var run = getRun();
      var n = typeof p.floor === 'number' ? p.floor : (run ? run.floor : 1);
      var fd = (typeof p.floor === 'object' && p.floor) || G('floorDef', n) || ((D('floors') || [])[n - 1]) || null;
      var ow = fd && fd.overworld;
      S = { t: 0, fd: fd, ow: ow, n: (fd && fd.n) || n, ok: !!(ow && ow.map && ow.map.length) };
      if (!S.ok) return;
      var pm = parseMap(ow.map);
      S.map = pm.rows; S.mw = pm.w; S.mh = pm.h;
      S.theme = ow.theme || 'ow_city';
      var ents = ow.entrances || {};
      S.ents = []; S.entAt = {};
      S.base = [];
      var start = null;
      for (var y = 0; y < S.mh; y++) {
        var row = [];
        for (var x = 0; x < S.mw; x++) {
          var ch = S.map[y].charAt(x);
          if (ch === 'P') { start = start || { x: x, y: y }; row.push('.'); continue; }
          if (ents[ch] !== undefined) { var e = { ch: ch, tx: x, ty: y }; S.ents.push(e); S.entAt[x + ',' + y] = e; row.push('E'); continue; }
          row.push(ch === ' ' ? '.' : ch);
        }
        S.base.push(row);
      }
      // entrance tiles take the ground of their neighbours (road or plain)
      S.ents.forEach(function (e) {
        var road = ['=', ','].filter(function (c) { return baseAt(e.tx - 1, e.ty) === c || baseAt(e.tx + 1, e.ty) === c || baseAt(e.tx, e.ty + 1) === c || baseAt(e.tx, e.ty - 1) === c; })[0];
        S.base[e.ty][e.tx] = road || '.';
      });
      // player position
      var pos = run && run.owPos && !solidT(run.owPos.x | 0, run.owPos.y | 0) && run.owPos.x < S.mw && run.owPos.y < S.mh ? run.owPos : start;
      if (!pos) { for (var yy = 0; yy < S.mh && !pos; yy++) for (var xx = 0; xx < S.mw; xx++) if (!solidT(xx, yy)) { pos = { x: xx, y: yy }; break; } }
      pos = pos || { x: 1, y: 1 };
      S.p = { x: (pos.x | 0) * TS + 8, y: (pos.y | 0) * TS + 10, dir: 'down', flip: false, moving: false, anim: 0, axis: 'y' };
      S.trail = [];
      for (var k = 0; k < 16; k++) S.trail.push({ x: S.p.x, y: S.p.y });
      S.c = { x: S.p.x, y: S.p.y + 0.01, flip: false, moving: false };
      // roamers
      var down = (run && run.roamersDown) || [];
      var edefs = D('enemies') || {};
      S.roamers = (ow.roamers || []).map(function (r, i) {
        if (!r || down.indexOf(i) >= 0) return null;
        var ed = edefs[r.enemy] || {};
        var hx = (r.x | 0) * TS + 8, hy = (r.y | 0) * TS + 10;
        if (solidT(r.x | 0, r.y | 0)) return null;
        return { i: i, enemy: r.enemy, name: ed.name || String(r.enemy || '').toUpperCase(), sprite: (ed.sprite || r.enemy) + '_walk',
          x: hx, y: hy, hx: hx, hy: hy, dx: 0, dy: 0, wt: Math.random() * 1.5, chase: false, flip: false, alive: true };
      }).filter(Boolean);
      // don't spawn a roamer on top of the player
      S.roamers.forEach(function (r) { if (Math.abs(r.x - S.p.x) < 48 && Math.abs(r.y - S.p.y) < 48) { r.x = r.hx; r.y = r.hy; if (Math.abs(r.x - S.p.x) < 40 && Math.abs(r.y - S.p.y) < 40) r.wt = 2.5; } });
      // rival racers / characters parked around the map (Floor 10 cul-de-sac)
      var rdefs = D('racers') || {};
      S.npcs = (ow.npcs || []).map(function (n) {
        if (!n || solidT(n.x | 0, n.y | 0)) return null;
        var rd = rdefs[n.racer] || {};
        return { id: n.racer, name: rd.name || String(n.racer || '').toUpperCase(), sprite: rd.sprite || ('racer_' + n.racer), portrait: 'p_racer_' + n.racer,
          lines: (n.lines && n.lines.length ? n.lines : rd.lines) || ['...'], li: 0, x: (n.x | 0) * TS + 8, y: (n.y | 0) * TS + 14, t: Math.random() * 3 };
      }).filter(Boolean);
      S.nearNpc = null;
      S.grace = 1.4; S.leaving = false; S.onEnt = null; S.bannerShake = 0; S.dust = []; S.dustT = 0;
      S.hint = ''; S.hintT = 0; S.ambush = null;
      refreshEntrances();
      S.cam = { x: 0, y: 0 }; camTarget(true);
      music(ow.music || (fd && fd.music) || null);
    },
    exit: function () { if (S) S.leaving = true; },
    update: function (dt) {
      if (!S || !S.ok) return;
      S.t += dt;
      if (S.ambush) { S.ambush.t += dt; if (S.ambush.t > 0.45 && !S.ambush.fired) fireAmbush(); return; }
      if (S.leaving) return;
      tryCall(DCW.game, 'tick', [dt]);
      if (S.grace > 0) S.grace -= dt;
      S.entT -= dt; if (S.entT <= 0) refreshEntrances();
      S.hintT -= dt; if (S.hintT <= 0) { S.hint = nextObjective(); S.hintT = 1.5; }
      if (S.bannerShake > 0) S.bannerShake -= dt;
      if (P('start')) { tryCall(DCW.ui, 'openPause', [{ canFlee: false }]); return; }
      if (P('select')) { tryCall(DCW.ui, 'openMap', []); return; }
      updatePlayer(dt);
      updateCompanion(dt);
      updateRoamers(dt);
      S.dust.forEach(function (d) { d.life -= dt; d.y -= 6 * dt; });
      S.dust = S.dust.filter(function (d) { return d.life > 0; });
      // entrance under feet
      var tp = tileOf(S.p), e = S.entAt[tp.x + ',' + tp.y] || null;
      if (e !== S.onEnt) { S.onEnt = e; if (e) sfx('menu_move'); }
      if (e && P('confirm')) enter(e);
      // talk to a nearby rival
      S.nearNpc = null;
      if (!e) for (var ni = 0; ni < (S.npcs || []).length; ni++) { var npc = S.npcs[ni]; npc.t += dt; if (Math.abs(npc.x - S.p.x) < 26 && Math.abs(npc.y - S.p.y) < 22) { S.nearNpc = npc; break; } }
      if (S.nearNpc && P('confirm') && DCW.ui && DCW.ui.say) {
        var nn = S.nearNpc, line = nn.lines[nn.li % nn.lines.length]; nn.li++;
        sfx('horn');
        DCW.ui.say([{ who: nn.name, portrait: nn.portrait, text: line }]);
      }
      camTarget(false, dt);
    },
    idle: function (dt) { if (S) S.t += dt; },
    draw: function (ctx) {
      if (!S || !S.ok) {
        DCW.rect(0, 0, W, H, '#000');
        T('NO OVERWORLD FOR THIS FLOOR', 160, 84, '#f83800', { align: 'center' });
        return;
      }
      drawWorld(ctx);
      drawStrip(ctx);
      drawBottom(ctx);
      if (S.ambush) {
        var a = clamp(S.ambush.t / 0.45, 0, 1);
        ctx.globalAlpha = 0.25 + 0.5 * a * (blink(12) ? 1 : 0.6); DCW.rect(0, 0, W, H, '#f83800'); ctx.globalAlpha = 1;
      }
    }
  };

  function camTarget(snap, dt) {
    var mwp = S.mw * TS, mhp = S.mh * TS;
    var tx = S.p.x - W / 2, ty = S.p.y - (H + HUD_H) / 2 - 4;
    tx = mwp <= W ? (mwp - W) / 2 : clamp(tx, 0, mwp - W);
    ty = mhp <= H - HUD_H ? (mhp - H - HUD_H) / 2 : clamp(ty, -HUD_H, mhp - H);
    if (snap) { S.cam.x = tx; S.cam.y = ty; return; }
    var k = Math.min(1, (dt || 0) * 9);
    S.cam.x += (tx - S.cam.x) * k; S.cam.y += (ty - S.cam.y) * k;
    if (Math.abs(tx - S.cam.x) < 0.3) S.cam.x = tx;
    if (Math.abs(ty - S.cam.y) < 0.3) S.cam.y = ty;
  }

  function updatePlayer(dt) {
    var p = S.p;
    var ax = (Dn('right') ? 1 : 0) - (Dn('left') ? 1 : 0), ay = (Dn('down') ? 1 : 0) - (Dn('up') ? 1 : 0);
    if (P('left') || P('right')) p.axis = 'x';
    if (P('up') || P('down')) p.axis = 'y';
    if (ax && !ay) p.axis = 'x'; else if (ay && !ax) p.axis = 'y';
    var mx = 0, my = 0;
    if (ax && ay) { if (p.axis === 'x') mx = ax; else my = ay; }
    else { mx = ax; my = ay; }
    var st = (DCW.ui && DCW.ui._h && DCW.ui._h.pStats) ? DCW.ui._h.pStats() : {};
    var sp = 70 * clamp(st.speedMul || 1, 0.8, 1.4);
    p.moving = !!(mx || my);
    if (mx) { p.dir = 'side'; p.flip = mx < 0; }
    else if (my) { p.dir = my < 0 ? 'up' : 'down'; }
    if (!p.moving) return;
    var d = sp * dt, ox = p.x, oy = p.y;
    var blocked = mx ? moveAxis(p, mx * d, 0, 5, 4) : moveAxis(p, 0, my * d, 5, 4);
    if (blocked) nudge(p, mx, my, 5, 4, Math.max(1, d));
    if (p.x !== ox || p.y !== oy) {
      p.anim += dt;
      S.trail.push({ x: p.x, y: p.y });
      if (S.trail.length > 40) S.trail.shift();
      S.dustT -= dt;
      if (S.dustT <= 0) { S.dustT = 0.22; S.dust.push({ x: p.x + (Math.random() * 4 - 2), y: p.y + 3, life: 0.35 }); }
    }
  }
  function updateCompanion(dt) {
    var c = S.c, tgt = S.trail[Math.max(0, S.trail.length - 14)];
    var dx = tgt.x - c.x, dy = tgt.y - c.y, dist = Math.sqrt(dx * dx + dy * dy);
    c.moving = dist > 0.6;
    if (c.moving) {
      var step = Math.min(dist, 90 * dt);
      c.x += dx / dist * step; c.y += dy / dist * step;
      if (Math.abs(dx) > 0.3) c.flip = dx < 0;
    }
  }
  function updateRoamers(dt) {
    var p = S.p;
    S.roamers.forEach(function (r) {
      if (!r.alive) return;
      var dx = p.x - r.x, dy = p.y - r.y, dist = Math.sqrt(dx * dx + dy * dy);
      if (S.grace <= 0 && dist < 80) r.chase = true;
      else if (dist > 112) r.chase = false;
      var sp, mx = 0, my = 0;
      if (r.chase && S.grace <= 0) {
        sp = 44;
        if (Math.abs(dx) > Math.abs(dy)) mx = Math.sign(dx); else my = Math.sign(dy);
        r.alert = (r.alert || 0) + dt;
      } else {
        r.alert = 0;
        sp = 26; r.wt -= dt;
        if (r.wt <= 0) {
          r.wt = 0.8 + Math.random() * 1.6;
          var hdx = r.hx - r.x, hdy = r.hy - r.y;
          if (Math.abs(hdx) + Math.abs(hdy) > 80) { if (Math.abs(hdx) > Math.abs(hdy)) { r.dx = Math.sign(hdx); r.dy = 0; } else { r.dx = 0; r.dy = Math.sign(hdy); } }
          else { var ch = Math.floor(Math.random() * 6); r.dx = [1, -1, 0, 0, 0, 0][ch]; r.dy = [0, 0, 1, -1, 0, 0][ch]; }
        }
        mx = r.dx; my = r.dy;
      }
      r.moving = !!(mx || my);
      if (r.moving) {
        var d = sp * dt;
        var blocked = mx ? moveAxis(r, mx * d, 0, 5, 4) : moveAxis(r, 0, my * d, 5, 4);
        if (blocked) {
          if (r.chase) { // try the other axis toward the player
            if (mx) moveAxis(r, 0, Math.sign(dy || 1) * d, 5, 4); else moveAxis(r, Math.sign(dx || 1) * d, 0, 5, 4);
          } else r.wt = 0;
        }
        if (mx) r.flip = mx < 0;
        r.anim = (r.anim || 0) + dt;
      }
      if (S.grace <= 0 && Math.abs(p.x - r.x) < 10 && Math.abs(p.y - r.y) < 9 && !S.ambush) startAmbush(r);
    });
  }
  function savePos() {
    var run = getRun();
    if (run) { var tp = tileOf(S.p); run.owPos = { x: tp.x, y: tp.y }; persist(); }
  }
  function startAmbush(r) {
    S.ambush = { r: r, t: 0, fired: false };
    sfx('warn'); sfx('hit');
    if (DCW.shake) DCW.shake(3, 0.3);
    savePos();
  }
  function fireAmbush() {
    var a = S.ambush; a.fired = true;
    S.leaving = true;
    var res = tryCall(DCW.game, 'enterEntrance', ['!ambush:' + a.r.i]);
    if (res === false || res === MISSING) {
      // no ambush stage (or no game module): the roamer just poofs
      a.r.alive = false;
      S.ambush = null; S.leaving = false; S.grace = 0.8;
      for (var i = 0; i < 6; i++) S.dust.push({ x: a.r.x + Math.random() * 12 - 6, y: a.r.y - Math.random() * 8, life: 0.5 });
    }
  }
  function enter(e) {
    var st = e.st || entranceState(e.ch, S.ow) || {};
    if (st.locked) { sfx('error'); if (!(S.bannerShake > 0) && st.lockFlavor && DCW.ui && DCW.ui.toast) DCW.ui.toast(st.lockFlavor, { icon: 'key', color: '#f83800', time: 3 }); S.bannerShake = 0.35; return; }
    savePos();
    S.leaving = true;
    var res = tryCall(DCW.game, 'enterEntrance', [e.ch]);
    if (res === false || res === MISSING) { S.leaving = false; if (res === MISSING) sfx('error'); refreshEntrances(); }
  }

  /* ---------------- drawing ---------------- */
  function drawWorld(ctx) {
    var cx = Math.round(S.cam.x), cy = Math.round(S.cam.y);
    var x0 = Math.floor(cx / TS), y0 = Math.floor(cy / TS), x1 = Math.floor((cx + W - 1) / TS), y1 = Math.floor((cy + H - 1) / TS);
    DCW.rect(0, 0, W, H, '#000');
    var art = DCW.art, useArt = !!(art && typeof art.owTile === 'function');
    for (var ty = y0; ty <= y1; ty++) for (var tx = x0; tx <= x1; tx++) {
      var ch = (tx < 0 || ty < 0 || tx >= S.mw || ty >= S.mh) ? '#' : S.base[ty][tx];
      var sx = tx * TS - cx, sy = ty * TS - cy;
      var info = { up: baseAt(tx, ty - 1) === ch, down: baseAt(tx, ty + 1) === ch, left: baseAt(tx - 1, ty) === ch, right: baseAt(tx + 1, ty) === ch, t: S.t, tx: tx, ty: ty };
      var drawn = false;
      if (useArt) { try { art.owTile(ctx, S.theme, ch, sx, sy, info); drawn = true; } catch (e) { drawn = false; } }
      if (!drawn) fbTile(ctx, S.theme, ch, sx, sy, info);
    }
    // entrance markers
    S.ents.forEach(function (e) {
      var sx = e.tx * TS - cx, sy = e.ty * TS - cy;
      if (sx < -24 || sx > W + 8 || sy < -24 || sy > H + 8) return;
      var on = S.onEnt === e;
      if (on) { ctx.globalAlpha = 0.35 + 0.25 * Math.sin(S.t * 6); DCW.rect(sx, sy, 16, 16, '#fcfcfc'); ctx.globalAlpha = 1; }
      spr(ctx, e.marker || 'ow_door', sx + 8, sy + 16, { frame: Math.floor(S.t * 3) });
      var st = e.st || {};
      if (st.itemLock || (st.locked && st.kind === 'stage')) spr(ctx, 'ow_lock', sx + 12, sy + 9, {});
      if (st.cleared) spr(ctx, 'ow_flag', sx + 13, sy + 9, { frame: Math.floor(S.t * 4) });
      else if (!st.locked && st.kind === 'stage' && !st.side && !on) T('!', sx + 8, sy - 9 + Math.round(Math.sin(S.t * 4 + e.tx) * 1.5), '#f8d878', { align: 'center' });
    });
    // actors, y-sorted
    var actors = [];
    S.roamers.forEach(function (r) { if (r.alive) actors.push({ y: r.y, f: function () { drawRoamer(ctx, r, cx, cy); } }); });
    (S.npcs || []).forEach(function (n) { actors.push({ y: n.y, f: function () {
      var x = Math.round(n.x - cx), y = Math.round(n.y - cy);
      if (x < -40 || x > W + 40 || y < -8 || y > H + 40) return;
      shadow(ctx, x, y, 18);
      spr(ctx, n.sprite, x, y, { frame: Math.floor(n.t * 2) });
      if (S.nearNpc === n) T((blink(3) ? '\u25BC ' : '  ') + bn('confirm') + ': TALK', x, y - 34, '#fcfcfc', { align: 'center' });
    } }); });
    actors.push({ y: S.c.y - 0.5, f: function () { drawCompanion(ctx, cx, cy); } });
    actors.push({ y: S.p.y, f: function () { drawPlayer(ctx, cx, cy); } });
    actors.sort(function (a, b) { return a.y - b.y; });
    S.dust.forEach(function (d) { ctx.globalAlpha = clamp(d.life / 0.35, 0, 1) * 0.7; DCW.rect(d.x - cx - 1, d.y - cy - 1, 3, 2, '#e0d8c8'); ctx.globalAlpha = 1; });
    actors.forEach(function (a) { a.f(); });
  }
  function shadow(ctx, x, y, w) { ctx.globalAlpha = 0.35; DCW.rect(x - w / 2, y - 1, w, 3, '#000'); DCW.rect(x - w / 2 + 1, y - 2, w - 2, 5, '#000'); ctx.globalAlpha = 1; }
  function drawPlayer(ctx, cx, cy) {
    var p = S.p, x = Math.round(p.x - cx), y = Math.round(p.y - cy) + 4;
    shadow(ctx, x, y, 10);
    var name = 'carl_ow_' + p.dir;
    if (!hasArt(name) && hasArt('carl_run')) { spr(ctx, p.moving ? 'carl_run' : 'carl_idle', x, y, { frame: Math.floor(p.anim * 8), flip: p.flip, skin: skin() }); return; }
    spr(ctx, name, x, y, { frame: p.moving ? Math.floor(p.anim * 7) : 0, flip: p.dir === 'side' && p.flip, skin: skin() });
  }
  function drawCompanion(ctx, cx, cy) {
    var c = S.c, x = Math.round(c.x - cx), y = Math.round(c.y - cy) + 4;
    var base = compSprite();
    shadow(ctx, x, y, 10);
    var n = c.moving ? base + '_run' : base + '_idle';
    if (!hasArt(n)) n = base + '_run';
    spr(ctx, n, x, y, { frame: Math.floor(S.t * (c.moving ? 8 : 2)), flip: c.flip });
  }
  function drawRoamer(ctx, r, cx, cy) {
    var x = Math.round(r.x - cx), y = Math.round(r.y - cy) + 4;
    if (x < -24 || x > W + 24 || y < -8 || y > H + 32) return;
    shadow(ctx, x, y, 12);
    var flash = S.ambush && S.ambush.r === r && blink(10);
    spr(ctx, r.sprite, x, y, { frame: Math.floor((r.anim || 0) * (r.chase ? 8 : 4)), flip: r.flip, flash: flash });
    if (r.chase && S.grace <= 0) {
      var by = y - 26 + (r.alert < 0.2 ? -2 : 0);
      DCW.rect(x - 3, by - 1, 7, 10, '#000'); DCW.rect(x - 2, by, 5, 8, '#fcfcfc');
      T('!', x - 2, by + 1, '#f83800', { shadow: null });
    }
  }
  function drawStrip(ctx) {
    var run = getRun() || {}, fd = S.fd || {};
    ctx.globalAlpha = 0.85; DCW.rect(0, 0, W, 13, '#000'); ctx.globalAlpha = 1;
    DCW.rect(0, 13, W, 1, '#1c1c3c');
    T('F' + S.n, 3, 3, '#f8b800');
    var nx = 9 + tw('F' + S.n) + 2;
    T(fit(fd.name || 'OVERWORLD', 150 - nx), nx, 3, '#fcfcfc');
    var st = (DCW.ui && DCW.ui._h && DCW.ui._h.pStats) ? DCW.ui._h.pStats() : {};
    var mx = st.maxHp || run.hp || 1, hp = Math.max(0, run.hp || 0), low = hp <= mx * 0.25;
    icon(ctx, 'heart', 154, 2);
    T(Math.ceil(hp) + '/' + mx, 164, 3, low && blink(4) ? '#fcfcfc' : low ? '#f83800' : '#fcfcfc');
    icon(ctx, 'coin', 204, 2);
    T(fit(run.gold || 0, 32), 214, 3, '#f8b800');
    var time = run.floorTime || 0, par = fd.par, over = par && time > par;
    var ts = DCW.U && DCW.U.fmtTime ? DCW.U.fmtTime(time) : String(Math.floor(time));
    var ps = par ? '/' + (DCW.U && DCW.U.fmtTime ? DCW.U.fmtTime(par) : par) : '';
    if (ps) T(ps, 318, 3, '#7c7c7c', { align: 'right' });
    var tx = 318 - (ps ? tw(ps) + 1 : 0);
    T(ts, tx, 2, over ? '#f83800' : par ? '#58d854' : '#fcfcfc', { align: 'right' });
    if (par) DCW.bar(tx - tw(ts), 11, tw(ts), 1, clamp(time / par, 0, 1), over ? '#f83800' : '#58d854', '#202020');
  }
  function drawBottom(ctx) {
    if (DCW.ui && DCW.ui.blocking && DCW.ui.blocking()) return;
    var e = S.onEnt;
    if (e) {
      var st = e.st || {};
      var shake = S.bannerShake > 0 ? Math.round(Math.sin(S.t * 60) * 3) : 0;
      var bx = 34 + shake, by = 146, bw = 252, bh = 30;
      DCW.box(bx, by, bw, bh, { fill: '#0f1630', border: st.locked ? '#f83800' : '#fcfcfc' });
      var nameCol = st.kind === 'boss' ? '#f83800' : st.kind === 'safe' ? '#3cbcfc' : st.kind === 'stairs' ? '#d800cc' : '#f8b800';
      var title = (st.name || 'AREA') + (st.side ? ' (SIDE AREA)' : '');
      T(fit(title, bw - 12), bx + bw / 2, by + 5, nameCol, { align: 'center' });
      var line, col = '#fcfcfc';
      if (st.locked) { line = st.lockText || 'LOCKED'; col = '#f83800'; }
      else if (st.kind === 'safe') line = 'PRESS ' + bn('confirm') + ' TO ENTER THE SAFE ROOM';
      else if (st.kind === 'stairs') line = 'PRESS ' + bn('confirm') + ' TO DESCEND';
      else if (st.kind === 'boss' && st.cleared) { line = '✓ BOSS DEFEATED'; col = '#58d854'; }
      else if (st.kind === 'boss') { line = 'PRESS ' + bn('confirm') + (st.parade ? ' TO START THE PARADE' : st.race ? ' FOR THE CHAMPIONSHIP' : ' TO FIGHT THE BOSS'); col = blink(3) ? '#fcfcfc' : '#f8d878'; }
      else if (st.race && !st.cleared) { line = 'PRESS ' + bn('confirm') + ' TO RACE'; col = '#f8d878'; }
      else if (st.cleared) { line = '✓ CLEARED  ' + bn('confirm') + ': REPLAY'; col = '#58d854'; }
      else if (st.note) { line = bn('confirm') + ': ENTER  (' + st.note + ')'; col = '#fca044'; }
      else line = 'PRESS ' + bn('confirm') + ' TO ENTER';
      if (st.locked) icon(ctx, 'lock', bx + bw / 2 - tw(fit(line, bw - 24)) / 2 - 11, by + 15);
      T(fit(line, bw - 24), bx + bw / 2 + (st.locked ? 5 : 0), by + 16, col, { align: 'center' });
    } else {
      if (S.hint) {
        var hl = fit('NEXT: ' + S.hint, 250);
        ctx.globalAlpha = 0.6; DCW.rect(0, 168, tw(hl) + 8, 12, '#000'); ctx.globalAlpha = 1;
        T(hl, 4, 170, '#bcbcbc');
      }
      T(bn('select') + ':MAP', 316, 170, '#7c7c7c', { align: 'right' });
    }
  }
})();

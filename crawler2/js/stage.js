/* ============================================================
   DCW STAGE (book 2) - every side-view mode of the Over City:
   streets (the playable overworld), side (+dark), chase, climb,
   drop, survival, plant, escape, boss, facade, swap (Mongo), solo.
   Physics, Carl's kit, the party (Donut, Mongo, Katia), enemies
   and their AIs, bosses and move primitives, pickups, juice.
   Contract: ../DESIGN.md sections 4-8 (+ book 1's stage contract).
   Every call into art/audio/ui/game/data is feature-detected so
   the stage runs standalone with fixture data (tools/stage_*).
   ============================================================ */
(function () {
  'use strict';
  var DCW = window.DCW = window.DCW || {};
  var U = DCW.U;
  var TS = 16, W = 320, H = 180;
  var PH = 22, PH_CROUCH = 14; // player hitbox height (sprite is 24x28, hitbox independent)

  /* ---------------- tuning ---------------- */
  var K = {
    gravity: 900, fallMax: 330, fallGravMul: 1.12,
    runMax: 95, accelGround: 1050, accelAir: 700, turnMul: 1.8, friction: 1200, airFriction: 260,
    jumpV: 318,            // sqrt(2*900*56) = 3.5 tiles
    jumpCut: 0.42, airJumpV: 285,
    coyote: 6, buffer: 6,  // frames
    climbSpeed: 66,
    stompBounce: 255, stompBounceHeld: 335,
    punchDur: 0.19, punch3Dur: 0.27, punchStep: 46, punchChain: 0.24,
    kickDur: 0.36, airkickVX: 160, airkickVY: 250, airkickBounce: 275,
    hurtDur: 0.3, iframes: 1.1, pitDamage: 3, pitIframes: 1.6,
    comboWindow: 2,
    camLook: 38, camLookSpeed: 110, camLerp: 9,
    throwVX: 125, throwVY: -175, throwGrav: 620, selfDmg: 2,
    hobFuse: 1.15, dynFuse: 1.6, xisteraVX: 300,
    hobR: 20, dynR: 40, jugR: 30,
    fireTick: 0.25, fireLife: 3, fireW: 48,
    smokeR: 36, smokeLife: 5, smokeLost: 4,
    specialPassive: 1 / 110, // meter per second
    fearTime: 2.5,
    missileEvery: 1.4, missileRange: 170, secondChance: 0.12, riseTime: 8,
    torchR: 56, torchSoloR: 26,
    mongoCd: 1.1, katiaCd: 6,
    plantTime: 1.0, decoyLife: 25, decoyLure: 120, plantSee: 64,
    regrowTime: 8, krasueRegrow: 8, krasueLeash: 96,
    escapeLock: 20, escapeRain: 30, escapeSelf: 5,
    swapSpeed: 1.35,
    updateMargin: W * 0.6,   // enemies update only within this of the screen
    maxParts: 320
  };
  var T_EMPTY = 0, T_SOLID = 1, T_ALT = 2, T_ONEWAY = 3, T_SPIKE = 4, T_LIQUID = 5, T_LADDER = 6, T_CRATE = 7, T_GATE = 8, T_DECO = 9;
  var TILE_OF = { '#': T_SOLID, 'X': T_ALT, '=': T_ONEWAY, '^': T_SPIKE, '~': T_LIQUID, 'H': T_LADDER, 'b': T_CRATE, 'L': T_GATE };
  var CH_OF = ['.', '#', 'X', '=', '^', '~', 'H', 'b', 'L', 'G'];
  var FALLBACK_TILE_COLOR = ['', '#7c4c2c', '#8c6c4c', '#c09060', '#d8d8d8', '#2c8c3c', '#c08828', '#a86c30', '#5c5c6c', ''];
  var EXPLOSIVES = ['jug', 'hob', 'dyn', 'smoke'];
  var XNAME = { jug: "JUG O'BOOM", hob: 'HOB-LOBBER', dyn: 'DYNAMITE', smoke: 'SMOKE BOMB' };
  var XCOLOR = { jug: '#f8b800', hob: '#7c7c7c', dyn: '#d82800', smoke: '#bcbcbc' };

  /* ---------------- built-in fallback chunks (used only when data is missing) ---------------- */
  var FB = {
    _fb_start: ['................', '................', '................', '................', '................', '................', '................', '................', '..n.............', '.P..............', '################', '################'],
    _fb_flat: ['................', '................', '................', '................', '................', '................', '.......o.o......', '......=====.....', '................', '...e........e...', '################', '################'],
    _fb_end: ['................', '................', '................', '................', '................', '................', '................', '................', '..........D.....', '................', '################', '################'],
    _fb_arena: ['X..............................X', 'X..............................X', 'X..............................X', 'X..............................X', 'X..............................X', 'X..............................X', 'X.....====............====.....X', '...............................X', '...............................X', '....................K..........X', '################################', '################################'],
    _fb_street: ['................................................................', '................................................................', '................................................................', '................................................................', '................................................................', '................................................................', '................................................................', '................................................................', '................................................................', '................................................................', '################################################################', '################################################################']
  };

  /* ---------------- safe external access ---------------- */
  function D() { return DCW.data || {}; }
  function G() { return DCW.game || {}; }
  function UI() { return DCW.ui || {}; }
  function ART() { return DCW.art || {}; }
  function call(obj, fn) {
    if (!obj || typeof obj[fn] !== 'function') return undefined;
    var args = Array.prototype.slice.call(arguments, 2);
    try { return obj[fn].apply(obj, args); } catch (e) { console.error('[stage] ' + fn + ' failed', e); return undefined; }
  }
  function has(obj, fn) { return !!(obj && typeof obj[fn] === 'function'); }
  function sfx(name, opts) { call(DCW.audio, 'sfx', name, opts); }
  function music(track) { if (track !== undefined) call(DCW.audio, 'music', track); }
  function track(ev, n) { call(G(), 'track', ev, n); }
  function toast(text, opts) { call(UI(), 'toast', text, opts || {}); }
  function announce(text, opts) { call(UI(), 'announce', text, opts || {}); }
  function say(lines, opts) {
    if (!lines || (Array.isArray(lines) && !lines.length)) return false;
    if (!has(UI(), 'say')) return false;
    call(UI(), 'say', lines, opts || {});
    return true;
  }
  function aiLine(pool) { var p = (D().ai || {})[pool]; return (p && p.length) ? U.pick(p) : null; }
  function arr(v) { return v === undefined || v === null ? [] : (Array.isArray(v) ? v : [v]); }
  function num(v, d) { return (typeof v === 'number' && !isNaN(v)) ? v : d; }
  var fallbackRun = null;
  function getRun() {
    var r = null;
    try { r = G().run; } catch (e) { r = null; }
    if (!r && DCW.save) r = DCW.save.run;
    if (!r) { // standalone fallback so the stage still works without a run (never written into the save)
      r = fallbackRun || (fallbackRun = { hoursLeft: 192, hour: 12, hp: 16, level: 13, xp: 0, stats: { str: 5, con: 4, dex: 4, int: 4 },
        bonus: { hp: 0 }, gold: 0, potions: 2, views: 0, seed: 12345, kills: 0, cleared: {}, flags: {}, items: { jug: 2, hob: 0, dyn: 0, smoke: 2 }, selected: 'jug' });
    }
    if (!r.items) r.items = {};
    if (!r.flags) r.flags = {};
    return r;
  }
  function flag(name) { if (has(G(), 'flag')) return !!call(G(), 'flag', name); var r = getRun(); return !!(r.flags && r.flags[name]); }
  function setFlag(name, v) { if (has(G(), 'setFlag')) { call(G(), 'setFlag', name, v); return; } var r = getRun(); if (v === false) delete r.flags[name]; else r.flags[name] = true; }
  function itemCount(id) {
    if (has(G(), 'itemCount')) return num(call(G(), 'itemCount', id), 0);
    var r = getRun(); if (id === 'potion') return r.potions || 0;
    return (r.items && r.items[id]) || 0;
  }
  function hasItem(id) { return itemCount(id) > 0; }
  function useItem(id, n) {
    n = n || 1;
    if (has(G(), 'useItem')) return !!call(G(), 'useItem', id, n);
    var r = getRun(); if (itemCount(id) < n) return false;
    if (id === 'potion') r.potions -= n; else r.items[id] -= n;
    return true;
  }
  function giveItem(id, n) {
    n = n === undefined ? 1 : n;
    if (has(G(), 'giveItem')) return call(G(), 'giveItem', id, n);
    var r = getRun(); if (id === 'potion') r.potions = (r.potions || 0) + n; else r.items[id] = (r.items[id] || 0) + n;
    return true;
  }
  function itemDef(id) { return (D().items || {})[id] || (D().questItems || {})[id] || null; }
  function itemName(id) { var q = itemDef(id); return (q && q.name) || XNAME[id] || String(id || '').toUpperCase().replace(/_/g, ' '); }
  function xpNeed(lv) { var n = call(G(), 'xpNeed', lv); return n || Math.round(25 * Math.pow(Math.max(1, (lv || 13) - 12), 1.5)); }
  function clock() {
    var c = call(G(), 'clock');
    if (c) return c;
    var r = getRun(), hr = Math.floor(num(r.hour, 12)), night = hr < 7 || hr >= 19, left = Math.ceil(num(r.hoursLeft, 192));
    if (DCW.params && DCW.params.has && DCW.params.has('night')) night = true;
    return { hoursLeft: left, day: 1, hour: hr, phase: night ? 'night' : 'day', night: night, label: Math.floor(left / 24) + 'D ' + (left % 24) + 'H' };
  }
  function partyList() {
    var p = has(G(), 'party') ? call(G(), 'party') : null;
    if (!Array.isArray(p)) {
      p = ['donut', 'mongo'];
      if (flag('katia_joined')) p.push('katia');
    }
    if (S && S.def && S.mode === 'level') {
      if (S.solo || S.swap) p = [];
      else if (Array.isArray(S.def.party)) p = S.def.party.slice();
    }
    return p;
  }

  /* ---------------- stats (cached per frame; escape bursts modify them) ---------------- */
  var statCache = null, statFrame = -1, statOwner = null;
  function fallbackStats() {
    var r = getRun(), st = r.stats || { str: 5, con: 4, dex: 4, int: 4 }, b = r.bonus || {};
    var L = Math.max(1, (r.level || 13) - 12), fb = flag('freeballing');
    var dmg = Math.max(1, 3 + (st.str - 5) + Math.floor((L - 1) / 2));
    return { maxHp: Math.max(8, 16 + (st.con - 4) * 2 + (L - 1) * 2 + (b.hp || 0)), dmg: dmg, kickDmg: Math.round(dmg * 1.5) * (fb ? 2 : 1),
      crit: 0.05 + (st.dex - 4) * 0.02, speedMul: 1 + (st.dex - 4) * 0.03, def: 0,
      hobDmg: 10 + L * 2, dynDmg: 22 + L * 3, jugDmg: 8 + L * 2,
      missileDmg: 3 + Math.floor(st.int / 2) + Math.floor((L - 1) / 2), biteDmg: Math.round((2 + L) * (flag('mongo_big') ? 1.8 : 1)),
      goldMul: 1, viewMul: 1, extraJump: false, skinPerk: null,
      freeballing: fb, xistera: flag('xistera'), fangCaps: flag('fang_caps'), mongoBig: flag('mongo_big'), party: null };
  }
  function stats() {
    if (statCache && statFrame === DCW.frame && statOwner === S) return statCache;
    var s = call(G(), 'playerStats') || fallbackStats();
    var o = {}, k;
    for (k in s) if (Object.prototype.hasOwnProperty.call(s, k)) o[k] = s[k];
    var L = Math.max(1, (getRun().level || 13) - 12);
    if (o.hobDmg === undefined) o.hobDmg = 10 + L * 2;
    if (o.dynDmg === undefined) o.dynDmg = 22 + L * 3;
    if (o.jugDmg === undefined) o.jugDmg = 8 + L * 2;
    if (o.missileDmg === undefined) o.missileDmg = 3 + Math.floor(L / 2) + 2;
    if (o.biteDmg === undefined) o.biteDmg = 2 + L;
    if (o.kickDmg === undefined) o.kickDmg = Math.round(num(o.dmg, 3) * 1.5);
    if (S) {
      if (S.maxHpMul && S.maxHpMul !== 1) o.maxHp = Math.max(1, Math.round(o.maxHp * S.maxHpMul));
      if (S.defZero) o.def = 0;
    }
    statCache = o; statFrame = DCW.frame; statOwner = S;
    return o;
  }

  /* ---------------- art helpers ---------------- */
  var artHas = {};
  function hasArt(name) {
    var c = artHas[name];
    if (c !== undefined) return c;
    var a = ART();
    c = has(a, 'sprite') && (has(a, 'has') ? !!call(a, 'has', name) : true);
    artHas[name] = c;
    return c;
  }
  function firstArt(list) { for (var i = 0; i < list.length; i++) if (list[i] && hasArt(list[i])) return list[i]; return list[list.length - 1]; }
  var sprOpts = { frame: 0, flip: false, skin: undefined, alpha: 1, flash: false, scale: 1 };
  // draw sprite with feet at screen (x, y); fall back to a colored box of (fw x fh)
  function spr(ctx, name, x, y, frame, flip, extra, fw, fh, color) {
    x = Math.round(x); y = Math.round(y);
    if (hasArt(name)) {
      sprOpts.frame = frame | 0; sprOpts.flip = !!flip;
      sprOpts.skin = extra && extra.skin; sprOpts.alpha = extra && extra.alpha !== undefined ? extra.alpha : 1;
      sprOpts.flash = !!(extra && extra.flash); sprOpts.scale = (extra && extra.scale) || 1;
      try { DCW.art.sprite(ctx, name, x, y, sprOpts); return; } catch (e) { artHas[name] = false; console.error('[stage] art.sprite ' + name, e); }
    }
    fw = fw || 10; fh = fh || 10;
    var a = extra && extra.alpha !== undefined ? extra.alpha : 1;
    if (a <= 0) return;
    ctx.globalAlpha = a;
    ctx.fillStyle = '#000'; ctx.fillRect(x - (fw >> 1) - 1, y - fh - 1, fw + 2, fh + 2);
    ctx.fillStyle = (extra && extra.flash) ? '#fff' : (color || '#f0f');
    ctx.fillRect(x - (fw >> 1), y - fh, fw, fh);
    if (!(extra && extra.flash)) { ctx.fillStyle = '#fff'; ctx.fillRect(x + (flip ? -(fw >> 1) + 1 : (fw >> 1) - 3), y - fh + 2, 2, 2); }
    ctx.globalAlpha = 1;
  }
  function artInfo(name) { var i = call(ART(), 'info', name); return i || null; }
  function artSize(name, dw, dh) { var i = hasArt(name) ? artInfo(name) : null; return (i && !i.missing) ? { w: i.w, h: i.h } : { w: dw, h: dh }; }
  function drawIcon(ctx, name, x, y, color) { // 8x8 top-left
    if (has(ART(), 'icon') && (hasArt('icon_' + name) || hasArt(name))) { try { DCW.art.icon(ctx, name, Math.round(x), Math.round(y)); return; } catch (e) { /* fall through */ } }
    ctx.fillStyle = '#000'; ctx.fillRect(Math.round(x), Math.round(y), 8, 8);
    ctx.fillStyle = color || '#f8b800'; ctx.fillRect(Math.round(x) + 1, Math.round(y) + 1, 6, 6);
  }

  /* ---------------- state ---------------- */
  var S = null;        // current stage state
  var I = null;        // DCW.input
  var lightCanvas = null;
  var tileInfo = { up: false, down: false, left: false, right: false, t: 0, tx: 0, ty: 0, night: false };

  /* ================================================================
     LEVEL ASSEMBLY
     levels: chunks (side, chase, survival, plant, escape, boss, facade)
             or layout rows (climb, drop); streets: area.rows
     ================================================================ */
  function chunkRows(id) {
    var c = (D().chunks || {})[id];
    var rows = c && (c.rows || (Array.isArray(c) ? c : null));
    if (!rows && FB[id]) rows = FB[id];
    if (!rows || !rows.length) return null;
    return rows;
  }
  function levelDef(id) { return (D().levels || {})[id] || (D().stages || {})[id] || null; }
  function areaDef(id) { return (D().areas || {})[id] || null; }
  function chunkList(def, rnd) {
    var cd = def.chunks || {};
    var ids = [];
    ids.push(cd.start && chunkRows(cd.start) ? cd.start : '_fb_start');
    var pool = (cd.pool || []).filter(function (id) { return !!chunkRows(id); });
    var count = num(cd.count, pool.length ? 3 : 0), last = null;
    for (var i = 0; i < count && pool.length; i++) {
      var pick, tries = 0;
      do { pick = pool[Math.floor(rnd() * pool.length)]; } while (pool.length > 1 && pick === last && ++tries < 12);
      ids.push(pick); last = pick;
    }
    var ins = (cd.insert || []).filter(function (id) { return !!chunkRows(id); });
    ins.forEach(function (id, k) { var pos = 1 + Math.round((k + 1) * (ids.length - 1) / (ins.length + 1)); ids.splice(Math.max(1, pos), 0, id); });
    var endId = cd.end && chunkRows(cd.end) ? cd.end : (S.isBoss ? '_fb_arena' : '_fb_end');
    if (cd.end !== null || S.isBoss) ids.push(endId);
    return ids.map(function (id) { return { id: id, rows: chunkRows(id) }; });
  }
  // lay chunks side by side (shorter chunks padded at the top so ground lines up)
  function buildGrid(chunks) {
    var LH = 0, LW = 0;
    chunks.forEach(function (c) { LH = Math.max(LH, c.rows.length); });
    chunks.forEach(function (c) { var w = 0; c.rows.forEach(function (r) { w = Math.max(w, r.length); }); c.w = w; c.x0 = LW; LW += w; });
    var L = { w: LW, h: LH, t: new Uint8Array(LW * LH), pxW: LW * TS, pxH: LH * TS };
    var spawns = [];
    chunks.forEach(function (c) {
      var pad = LH - c.rows.length;
      for (var ry = 0; ry < LH; ry++) {
        var row = ry < pad ? '' : c.rows[ry - pad];
        for (var rx = 0; rx < c.w; rx++) {
          var ch = row.charAt(rx) || '.';
          var tx = c.x0 + rx, ty = ry;
          if (S.doorChars && S.doorChars[ch]) { spawns.push({ ch: ch, tx: tx, ty: ty, chunk: c, door: true }); continue; }
          var tt = TILE_OF[ch];
          if (tt === T_GATE) (c.gates = c.gates || []).push(ty * LW + tx);
          if (tt) { L.t[ty * LW + tx] = tt; continue; }
          if (ch === '.' || ch === ' ') continue;
          spawns.push({ ch: ch, tx: tx, ty: ty, chunk: c });
        }
      }
    });
    return { L: L, spawns: spawns };
  }
  function newState(mode, def, id) {
    var run = getRun();
    return {
      mode: mode, id: id, def: def, kind: def.kind || 'side', theme: def.theme || 'ruins', L: null, rnd: null, chunks: [],
      isBoss: false, t: 0, cam: { x: 0, y: 0, look: 0, topY: 0 },
      enemies: [], eproj: [], pproj: [], haz: [], pickups: [], objects: [], platforms: [], parts: [], nums: [], allies: [],
      fires: [], clouds: [], orbs: [], corpses: [], regrows: [], lights: [], hooks: [],
      boss: null, arena: null, locked: false,
      combo: 0, comboT: 0, special: 0, specialLockT: 0, flashT: 0, flashColor: '#fff',
      kills: 0, damageTaken: 0, maxCombo: 0, views: 0, gold: 0, secrets: 0,
      god: !!run.god || !!(DCW.debug && DCW.params && DCW.params.has && DCW.params.has('god')),
      done: false, endT: -1, endKind: null, diedSent: false, clearedSent: false,
      introPending: null, lowHpQuipped: false, quipT: 0, dark: !!def.dark, darkT: 0, night: false,
      lastSafe: null, checkpoint: null, gates: [], party: {}, maxHpMul: 1, defZero: false, noMagic: false,
      npcIdx: 0, signIdx: 0, doorChars: null, immuneT: 0
    };
  }
  function buildLevel(levelId) {
    var def = levelDef(levelId);
    if (!def) def = { id: levelId || 'debug', name: 'UNKNOWN LEVEL', kind: 'side', theme: 'ruins', chunks: { start: '_fb_start', pool: ['_fb_flat'], count: 2, end: '_fb_end' }, enemies: [['lemur', 1]] };
    S = newState('level', def, def.id || levelId);
    var kind = S.kind;
    S.swap = kind === 'swap' || def.swap === 'mongo' || def.swap === true;
    S.solo = kind === 'solo' || !!def.solo;
    S.vertical = kind === 'climb' || kind === 'drop';
    S.isBoss = kind === 'boss' || kind === 'facade' || (!!def.boss && !S.vertical && kind !== 'survival' && kind !== 'plant' && kind !== 'escape');
    S.night = !!def.night || !!clock().night;
    var run = getRun();
    S.rnd = U.rng(((run.seed || 1) + U.hash(String(def.id || levelId))) >>> 0);
    var chunks;
    if (S.vertical && def.layout && def.layout.length) chunks = [{ id: 'layout', rows: def.layout }];
    else if (S.vertical) chunks = [{ id: '_fb_climb', rows: fallbackLayout(kind) }];
    else chunks = chunkList(def, S.rnd);
    S.chunks = chunks;
    var g = buildGrid(chunks);
    S.L = g.L;
    placeSpawns(g.spawns, def);
    // boss arena: the chunk holding K (or the last chunk)
    if (S.isBoss) {
      var arenaChunk = (S.bossSpawn && S.bossSpawn.chunk) || chunks[chunks.length - 1];
      S.arena = { x0: arenaChunk.x0 * TS, x1: (arenaChunk.x0 + arenaChunk.w) * TS, tx0: arenaChunk.x0 };
      if (!S.bossSpawn) S.bossSpawn = { x: S.arena.x0 + arenaChunk.w * TS * 0.7, y: groundBelow(S.arena.x0 + arenaChunk.w * TS * 0.7, 0) };
    }
    if (!S.start) {
      if (kind === 'drop') S.start = { x: 3 * TS, y: groundBelow(3 * TS, 0) };
      else if (kind === 'climb') S.start = { x: 3 * TS, y: streetGround(3 * TS) };
      else S.start = { x: 24, y: groundBelow(24, 0) };
    }
    var intro = def.intro;
    if (Array.isArray(intro)) S.introPending = intro;
    else if (typeof intro === 'string' && !((D().cinema || {})[intro])) S.introPending = intro;
    return S;
  }
  function fallbackLayout(kind) {
    var rows = [], w = 20, i;
    var blank = '.'.repeat ? '.'.repeat(w - 2) : '..................';
    for (i = 0; i < 30; i++) rows.push('#' + blank + '#');
    for (i = 4; i < 28; i += 4) rows[i] = '#' + (i % 8 ? '....======........' : '........======....') + '#';
    if (kind === 'climb') { rows[2] = '#........D.........#'; rows[27] = '#..P...............#'; }
    else { rows[1] = '#..P...............#'; rows[27] = '#........D.........#'; }
    rows[28] = '#' + '#'.repeat(w - 2) + '#'; rows[29] = rows[28];
    return rows;
  }
  function buildStreet(areaId) {
    var a = areaDef(areaId);
    if (!a) a = { id: areaId || 'debug', name: 'NOWHERE', theme: 'ruins', rows: FB._fb_street, doors: {}, edges: {} };
    S = newState('street', a, a.id || areaId);
    S.kind = 'street';
    S.areaId = a.id || areaId;
    S.night = !!clock().night;
    S.doorChars = a.doors || {};
    var run = getRun();
    S.rnd = U.rng(((run.seed || 1) + U.hash('area:' + S.areaId)) >>> 0);
    var rows = (a.rows && a.rows.length) ? a.rows : FB._fb_street;
    S.chunks = [{ id: 'street', rows: rows }];
    var g = buildGrid(S.chunks);
    S.L = g.L;
    placeSpawns(g.spawns, a);
    return S;
  }
  // NPC spot / sign texts in order
  function nextNpc(list) { var n = list[S.npcIdx]; S.npcIdx++; return n; }
  function placeSpawns(spawns, def) {
    var start = null, rnd = S.rnd, street = S.mode === 'street';
    var npcs = (def.npcs || []).filter(function (n) { return n && n.x === undefined; });
    spawns.forEach(function (s) {
      var x = s.tx * TS, y = s.ty * TS, fx = x + 8, fy = y + TS; // fy = feet line of this cell
      if (s.door) { addStreetDoor(s.ch, fx, fy); return; }
      switch (s.ch) {
        case 'P': if (!start) start = { x: fx, y: fy }; break;
        case 'D': S.objects.push({ kind: 'door', x: fx - 13, y: fy - 38, w: 26, h: 38, open: false, needs: def.exitNeeds || null }); break;
        case 'Q': if (def.questItem && !hasItem(def.questItem)) S.objects.push({ kind: 'qitem', id: def.questItem, x: x, y: fy - 18, w: 16, h: 16, t: 0 }); break;
        case 'R': if (def.rescue) S.objects.push({ kind: 'cage', comp: def.rescue, x: fx - 12, y: fy - 28, w: 24, h: 28, hp: 3, shakeT: 0, broken: false, t: 0 }); break;
        case 'S': S.objects.push({ kind: 'lever', x: x, y: fy - 16, w: 16, h: 16, on: false, chunk: s.chunk }); break;
        case 'K': S.bossSpawn = { x: fx, y: fy, chunk: s.chunk }; break;
        case 'e': case 'E': case 'f': {
          var eid = pickEnemyId(def, s.ch, rnd), ed = enemyDef(eid);
          var e = makeEnemy(eid, fx, fy, s.ch === 'E', s.ch === 'f');
          S.enemies.push(e);
          if (ed.ai === 'swarm') for (var gi = 1; gi < num(ed.group, 3); gi++) { var m = makeEnemy(eid, fx + U.rand(-14, 14), fy - U.rand(0, 16), false, true); S.enemies.push(m); }
          break;
        }
        case 'k': addKrasue(fx, fy); break;
        case 'o': addPickup('coin', fx, fy - 4, 0, 0, false); break;
        case 'h': addPickup('snack', fx, fy - 2, 0, 0, false); break;
        case 'm': addPickup('xpl', fx, fy - 2, 0, 0, false, U.weighted([['jug', 5], ['hob', 3], ['smoke', 2]], rnd)); break;
        case '?': addPickup('box', fx, fy - 2, 0, 0, false); break;
        case '<': case '>': S.platforms.push({ x: x - 16, y: y + 4, w: 48, h: 6, ox: x - 16, oy: y + 4, axis: 'x', dir: s.ch === '<' ? -1 : 1, range: 48, speed: 34, dx: 0, dy: 0, prevY: y + 4 }); break;
        case 'v': S.platforms.push({ x: x - 16, y: y + 4, w: 48, h: 6, ox: x - 16, oy: y + 4, axis: 'y', dir: -1, range: 48, speed: 30, dx: 0, dy: 0, prevY: y + 4 }); break;
        case 'c': S.objects.push({ kind: 'checkpoint', x: x + 2, y: fy - 24, w: 12, h: 24, on: false }); break;
        case 'n': S.objects.push({ kind: 'sign', x: x, y: fy - 16, w: 16, h: 16, idx: S.signIdx++ }); break;
        case '$': S.objects.push({ kind: 'chest', x: x, y: fy - 14, w: 16, h: 14, open: false }); break;
        case 'N': {
          var nd = nextNpc(npcs);
          if (nd) S.objects.push(makeNpcObj(nd, fx, fy));
          break;
        }
        case 'p': S.objects.push({ kind: 'signpost', x: x - 2, y: fy - 24, w: 20, h: 24 }); break;
        case 'C': S.objects.push({ kind: 'charge', x: x, y: fy - 16, w: 16, h: 16, planted: false, prog: 0, t: 0 }); break;
        case 'Y': S.objects.push({ kind: 'decoySpot', x: x, y: fy - 16, w: 16, h: 16, used: false }); break;
        case 'T': S.objects.push({ kind: 'detonator', x: x - 4, y: fy - 18, w: 24, h: 18 }); break;
        case 't': S.objects.push({ kind: 'trash', x: x + 1, y: fy - 10, w: 14, h: 10, gone: false }); break;
        case 'w': (S.waveSpots = S.waveSpots || []).push({ x: fx, y: fy }); break;
        case 'G': setTile(s.tx, s.ty, T_DECO); S.objects.push({ kind: 'statue', x: x, y: fy - 32, w: 16, h: 32 }); break;
        case 'B': S.objects.push({ kind: 'barricade', x: fx - 14, y: fy - 28, w: 28, h: 28, hp: 1, maxHp: 1, broken: false, shakeT: 0 }); break;
        default: break; // unknown chars are decoration-free empty space
      }
    });
    // street NPCs placed by x (tile column)
    (def.npcs || []).forEach(function (n) {
      if (!n || n.x === undefined) return;
      var px = n.x < S.L.w ? n.x * TS + 8 : n.x;
      S.objects.push(makeNpcObj(n, px, streetGround(px)));
    });
    S.start = start;
  }
  function makeNpcObj(n, fx, fy) {
    var sp = n.sprite === undefined ? n.id : n.sprite;
    var sz = sp ? artSize(firstArt([sp, sp + '_idle']), 16, 24) : { w: 16, h: 24 };
    return { kind: 'npc', npc: n, id: n.id, sprite: sp, x: fx - Math.max(8, sz.w / 2), y: fy - Math.max(16, sz.h), w: Math.max(16, sz.w), h: Math.max(16, sz.h), fy: fy, visible: true, face: n.face || -1 };
  }
  function addStreetDoor(ch, fx, fy) {
    var d = S.doorChars[ch] || {};
    var sprite = d.sprite || null;
    var sz = sprite ? artSize(sprite, 26, 38) : { w: 22, h: 30 };
    S.objects.push({ kind: 'sdoor', ch: ch, d: d, sprite: sprite, x: fx - sz.w / 2, y: fy - sz.h, w: sz.w, h: sz.h, fy: fy, st: null, stT: 0 });
  }
  function addKrasue(fx, fy) {
    var bodyId = enemyDef('krasue').body;
    if (typeof bodyId !== 'string') bodyId = 'krasue_body';
    var bd = enemyDef(bodyId);
    var body = makeEnemy(bodyId, fx, fy, false, false);
    body.ai = 'kbody'; body.isBody = true; body.hostile = false; body.objSprite = 'krasue_body';
    if (!(D().enemies || {})[bodyId]) { body.hp = body.maxHp = Math.max(6, num(bd.hp, 14)); body.w = 14; body.h = 20; body.x = fx - 7; body.y = fy - 20; }
    var head = makeEnemy('krasue', fx, fy - 40, false, true);
    head.body = body; body.head = head;
    head.y = fy - 44; head.baseY = head.y;
    S.enemies.push(body, head);
  }
  function pickEnemyId(def, ch, rnd) {
    var pool = ch === 'E' ? def.elite : ch === 'f' ? def.flyers : def.enemies;
    if (S.mode === 'street') { var ph = S.night ? 'night' : 'day'; pool = (def.enemies && def.enemies[ph]) || null; if (ch === 'f' && def.flyers) pool = def.flyers[ph] || def.flyers; }
    if (!pool || !pool.length) pool = Array.isArray(def.enemies) ? def.enemies : null;
    if (!pool || !pool.length) return 'lemur';
    var p = pool.map(function (e) { return Array.isArray(e) ? e : [e, 1]; });
    return U.weighted(p, rnd);
  }
  function groundBelow(px, py) {
    var L = S.L, tx = Math.floor(px / TS);
    for (var ty = Math.max(0, Math.floor(py / TS)); ty < L.h; ty++) {
      var t = tileAt(tx, ty);
      if (t === T_SOLID || t === T_ALT || t === T_ONEWAY || t === T_CRATE || t === T_GATE || t === T_DECO) {
        if (ty > 0 && isSolidT(tileAt(tx, ty - 1))) continue;
        return ty * TS;
      }
    }
    return (L.h - 2) * TS;
  }
  // the street level at x: the open cell right above the bottom solid stack (not a rooftop)
  function streetGround(px) {
    var L = S.L, tx = U.clamp(Math.floor(px / TS), 0, L.w - 1), ty = L.h - 1;
    while (ty > 0 && isSolidT(tileAt(tx, ty))) ty--;
    if (ty === L.h - 1) return groundBelow(px, 0);
    return (ty + 1) * TS;
  }

  /* ---------------- tile queries ---------------- */
  function tileAt(tx, ty) {
    var L = S.L;
    if (tx < 0 || tx >= L.w) return T_SOLID; // level edges are walls
    if (ty < 0 || ty >= L.h) return T_EMPTY;
    return L.t[ty * L.w + tx];
  }
  function setTile(tx, ty, v) { var L = S.L; if (tx >= 0 && tx < L.w && ty >= 0 && ty < L.h) L.t[ty * L.w + tx] = v; }
  function isSolidT(t) { return t === T_SOLID || t === T_ALT || t === T_CRATE || t === T_GATE || t === T_DECO; }
  function isLadderTop(tx, ty) { return tileAt(tx, ty) === T_LADDER && tileAt(tx, ty - 1) !== T_LADDER; }
  function solidAt(px, py) { return isSolidT(tileAt(Math.floor(px / TS), Math.floor(py / TS))); }
  function standableAt(px, py) {
    var tx = Math.floor(px / TS), ty = Math.floor(py / TS), t = tileAt(tx, ty);
    return isSolidT(t) || t === T_ONEWAY || (t === T_LADDER && isLadderTop(tx, ty));
  }

  /* ---------------- generic body physics ---------------- */
  // b: {x,y,w,h,vx,vy}. Sets b.onGround, b.hitWall, b.bonk, b.platform, b.standTile
  function moveBody(b, dt, noOneway) {
    var L = S.L, i, tx, ty, t;
    b.hitWall = 0; b.bonk = false;
    if (b.platform) {
      var pl = b.platform;
      if (b.x + b.w > pl.x - 2 && b.x < pl.x + pl.w + 2 && Math.abs((b.y + b.h) - (pl.y - pl.dy)) < 3) { b.x += pl.dx; b.y = pl.y - b.h; }
      b.platform = null;
    }
    var nx = b.x + b.vx * dt;
    if (b.vx > 0) {
      tx = Math.floor((nx + b.w - 0.01) / TS);
      for (ty = Math.floor(b.y / TS); ty <= Math.floor((b.y + b.h - 0.01) / TS); ty++) {
        if (isSolidT(tileAt(tx, ty))) { nx = tx * TS - b.w; b.hitWall = 1; break; }
      }
    } else if (b.vx < 0) {
      tx = Math.floor(nx / TS);
      for (ty = Math.floor(b.y / TS); ty <= Math.floor((b.y + b.h - 0.01) / TS); ty++) {
        if (isSolidT(tileAt(tx, ty))) { nx = (tx + 1) * TS; b.hitWall = -1; break; }
      }
    }
    if (b.hitWall) b.vx = 0;
    b.x = nx;
    var oldBottom = b.y + b.h;
    var ny = b.y + b.vy * dt;
    b.onGround = false; b.standTile = -1;
    if (b.vy >= 0) {
      ty = Math.floor((ny + b.h) / TS);
      var landed = false;
      if (ty >= 0 && ty < L.h) {
        var x0 = Math.floor((b.x + 0.5) / TS), x1 = Math.floor((b.x + b.w - 0.5) / TS);
        for (tx = x0; tx <= x1; tx++) {
          t = tileAt(tx, ty);
          if (isSolidT(t) || (!noOneway && oldBottom <= ty * TS + 0.5 && (t === T_ONEWAY || (t === T_LADDER && isLadderTop(tx, ty))))) { landed = true; b.standTile = ty * L.w + tx; break; }
        }
      }
      if (landed) { ny = ty * TS - b.h; b.vy = 0; b.onGround = true; }
      if (!landed && !noOneway) {
        for (i = 0; i < S.platforms.length; i++) {
          var p = S.platforms[i];
          if (b.x + b.w <= p.x || b.x >= p.x + p.w) continue;
          var top = p.y;
          if (oldBottom <= Math.max(top, p.prevY) + 1 && ny + b.h >= top) { ny = top - b.h; b.vy = 0; b.onGround = true; b.platform = p; break; }
        }
      }
    } else {
      ty = Math.floor(ny / TS);
      for (tx = Math.floor((b.x + 0.5) / TS); tx <= Math.floor((b.x + b.w - 0.5) / TS); tx++) {
        if (isSolidT(tileAt(tx, ty))) { ny = (ty + 1) * TS; b.vy = 0; b.bonk = true; break; }
      }
    }
    b.y = ny;
  }
  function groundAhead(e) {
    var fx = e.face > 0 ? e.x + e.w + 2 : e.x - 2;
    if (standableAt(fx, e.y + e.h + 2)) return true;
    for (var i = 0; i < S.platforms.length; i++) {
      var p = S.platforms[i];
      if (fx >= p.x && fx <= p.x + p.w && Math.abs(e.y + e.h - p.y) < 3) return true;
    }
    return false;
  }
  function groundAheadDir(e, dir) { var f = e.face; e.face = dir; var r = groundAhead(e); e.face = f; return r; }
  function overlap(a, b) { return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y; }
  function cx(o) { return o.x + o.w / 2; }
  function cy(o) { return o.y + o.h / 2; }
  function dist(ax, ay, bx, by) { var dx = ax - bx, dy = ay - by; return Math.sqrt(dx * dx + dy * dy); }
  function onScreen(o, m) { m = m || 0; return o.x + o.w > S.cam.x - m && o.x < S.cam.x + W + m && o.y + o.h > S.cam.y - m && o.y < S.cam.y + H + m; }
  function groundUnder(x, fromY) {
    var tx = Math.floor(x / TS);
    for (var ty = Math.max(0, Math.floor(fromY / TS)); ty < S.L.h; ty++) {
      var t = tileAt(tx, ty);
      if (isSolidT(t) || t === T_ONEWAY) return ty * TS;
    }
    return S.boss ? S.boss.groundY : S.L.pxH - 32;
  }

  /* ---------------- particles / numbers / fx ---------------- */
  function part(o) {
    if (S.parts.length >= K.maxParts) S.parts.shift();
    o.t = 0; o.life = o.life || 0.4; o.vx = o.vx || 0; o.vy = o.vy || 0; o.grav = o.grav || 0;
    S.parts.push(o); return o;
  }
  function fxSprite(name, x, y, life, opts) {
    opts = opts || {};
    var info = artInfo(name);
    return part({ kind: 'spr', name: name, x: x, y: y, life: life || 0.3, frames: (info && info.frames) || opts.frames || 3, vx: opts.vx, vy: opts.vy, grav: opts.grav,
      color: opts.color || '#fff', size: opts.size || 8, flip: opts.flip, scale: opts.scale || 1, front: opts.front });
  }
  function debris(x, y, n, color, spd) {
    spd = spd || 90;
    for (var i = 0; i < n; i++) {
      var a = Math.random() * Math.PI * 2, s = spd * (0.4 + Math.random() * 0.8);
      part({ kind: 'px', x: x, y: y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 40, grav: 500, life: 0.35 + Math.random() * 0.35, color: color || '#fff', size: Math.random() < 0.3 ? 2 : 1 });
    }
  }
  function dust(x, y, n) {
    for (var i = 0; i < (n || 1); i++) fxSprite('dust', x + U.rand(-4, 4), y, 0.3, { vx: U.rand(-20, 20), vy: -U.rand(5, 20), color: '#bcbcbc', size: 4 });
  }
  function smoke(x, y, n) {
    for (var i = 0; i < (n || 3); i++) fxSprite('smoke', x + U.rand(-6, 6), y + U.rand(-6, 6), 0.45, { vx: U.rand(-25, 25), vy: -U.rand(10, 40), color: '#9c9c9c', size: 7 });
  }
  function hitSpark(x, y, big) {
    fxSprite('hit', x, y + (big ? 16 : 8), big ? 0.24 : 0.16, { color: big ? '#f8d878' : '#fcfcfc', size: big ? 14 : 8, scale: big ? 2 : 1, front: true });
    debris(x, y, big ? 10 : 4, big ? '#f8d878' : '#fcfcfc', big ? 150 : 100);
  }
  function numText(x, y, text, color, scale) {
    for (var i = S.nums.length - 1; i >= 0; i--) {
      var o = S.nums[i];
      if (o.t < 0.25 && Math.abs(o.x - x) < 24 && Math.abs(o.y - y) < 9) y = o.y - 9;
    }
    S.nums.push({ x: x, y: y, vy: -42, t: 0, life: 0.8, text: String(text), color: color || '#fcfcfc', scale: scale || 1 });
    if (S.nums.length > 40) S.nums.shift();
  }
  function flash(color, t) { S.flashColor = color || '#fff'; S.flashT = t || 0.15; }

  /* ---------------- pickups ---------------- */
  // kinds: coin snack xpl (value = explosive id) potion box
  function addPickup(kind, x, y, vx, vy, dropped, value) {
    var p = { kind: kind, x: x - 4, y: y - 8, w: 8, h: 8, vx: vx || 0, vy: vy || 0, phys: !!dropped, delay: dropped ? 0.25 : 0,
      life: dropped ? 9 : -1, value: value || 0, bob: Math.random() * 6, magnet: false };
    if (kind === 'box') { p.w = 12; p.h = 12; p.x = x - 6; p.y = y - 12; }
    S.pickups.push(p);
    return p;
  }
  function spillCoins(x, y, gold, maxCoins) {
    gold = Math.max(0, Math.round(gold));
    if (!gold) return;
    var n = Math.min(maxCoins || 6, gold), per = Math.floor(gold / n), extra = gold - per * n;
    for (var i = 0; i < n; i++) addPickup('coin', x, y, U.rand(-70, 70), -U.rand(140, 230), true, per + (i < extra ? 1 : 0));
  }
  function spillCoinsReturn(x, y, gold, max) { var before = S.pickups.length; spillCoins(x, y, gold, max); return S.pickups.slice(before); }
  function randomExplosive() { return U.weighted([['jug', 5], ['hob', 3], ['smoke', 2], ['dyn', 1]]); }
  function collectPickup(p) {
    var run = getRun(), P = S.player;
    switch (p.kind) {
      case 'coin': {
        var v = p.value || U.randi(1, 3);
        var got = has(G(), 'addGold') ? call(G(), 'addGold', v) : (run.gold += v, v);
        got = num(got, v);
        S.gold += got;
        sfx('coin'); track('coin');
        fxSprite('sparkle', cx(p), p.y + p.h, 0.3, { color: '#f8d878', size: 6 });
        break;
      }
      case 'snack': {
        if (has(G(), 'heal')) call(G(), 'heal', 4); else run.hp = Math.min(stats().maxHp, run.hp + 4);
        sfx('heal'); numText(cx(P), P.y - 4, '+4', '#58f898');
        debris(cx(P), cy(P), 6, '#58f898', 60);
        break;
      }
      case 'xpl': {
        var id = p.value || 'jug';
        giveItem(id, 1);
        sfx('pickup'); numText(cx(P), P.y - 4, '+1 ' + itemName(id), '#fcfcfc');
        if (!(itemCount(run.selected) > 0)) run.selected = id;
        break;
      }
      case 'potion': giveItem('potion', 1); sfx('pickup'); numText(cx(P), P.y - 4, '+1 POTION', '#58f898'); break;
      case 'box': {
        if (has(G(), 'giveLootBox')) call(G(), 'giveLootBox', 'bronze', 'SECRET: ' + (S.def.name || 'LEVEL'));
        else toast('LOOT BOX!', { icon: 'box' });
        S.secrets++; track('secret'); sfx('unlock');
        flash('#f8d878', 0.1);
        break;
      }
    }
  }
  function addViews(v) {
    var got = has(G(), 'addViews') ? call(G(), 'addViews', v) : (getRun().views += v, v);
    S.views += num(got, v);
    return num(got, v);
  }
  function updPickups(dt) {
    var P = S.player;
    for (var i = S.pickups.length - 1; i >= 0; i--) {
      var p = S.pickups[i];
      if (p.delay > 0) p.delay -= dt;
      if (p.life > 0) { p.life -= dt; if (p.life <= 0) { S.pickups.splice(i, 1); continue; } }
      var dx = cx(P) - cx(p), dy = cy(P) - cy(p), d2 = dx * dx + dy * dy;
      if (p.delay <= 0 && p.magnet) {
        var d = Math.sqrt(d2) || 1, sp = 260;
        p.vx = dx / d * sp; p.vy = dy / d * sp; p.phys = false;
        p.x += p.vx * dt; p.y += p.vy * dt;
      } else if (p.phys) {
        var wasVy = p.vy;
        p.vy = Math.min(p.vy + 700 * dt, 300);
        moveBody(p, dt, false);
        if (p.onGround) {
          if (wasVy > 70) { p.vy = -wasVy * 0.45; p.onGround = false; if (p.kind === 'coin' && onScreen(p)) fxSprite('sparkle', cx(p), p.y + p.h, 0.2, { color: '#f8d878', size: 4 }); }
          p.vx *= 0.82; if (Math.abs(p.vx) < 4) p.vx = 0;
        }
        if (p.hitWall) p.vx = -p.vx * 0.5;
        if (p.y > S.L.pxH + 20) { S.pickups.splice(i, 1); continue; }
      }
      if (p.delay <= 0 && P.state !== 'dead' && overlap(P, p)) {
        if (S.swap && p.kind !== 'coin' && p.kind !== 'snack') continue; // Mongo only eats coins (and snacks)
        collectPickup(p); S.pickups.splice(i, 1);
      }
    }
  }

  /* ================================================================
     COMBAT CORE
     damage kinds: punch kick stomp bite (Mongo) missile (Donut) ally
                   bomb fire boomy (Boomy Boy) pit
     ================================================================ */
  function registerHit(dmg) {
    S.combo++; S.comboT = K.comboWindow;
    if (S.combo > S.maxCombo) S.maxCombo = S.combo;
    if (S.combo === 10) { track('combo10'); quip('bigCombo', 0.6); }
    if (S.combo === 25) { track('combo25'); quip('bigCombo', 1); announce(S.combo + ' HIT COMBO!', { color: '#f8d878', time: 1.4 }); }
    if (S.specialLockT > 0) return;
    var st = stats();
    S.special = Math.min(1, S.special + (dmg || 1) / Math.max(1, num(st.dmg, 3) * 22));
  }
  function comboMul() { return 1 + Math.min(S.combo, 60) * 0.05; }
  function quip(pool, chance) {
    if (S.quipT > 0 || Math.random() > (chance || 1)) return;
    var line = aiLine(pool);
    if (line) { toast(line, { title: 'SYSTEM AI', icon: 'eye', color: '#f878f8', time: 3.2 }); S.quipT = 8; }
  }
  function immuneTo(e, kind) {
    if (e.invuln || e.ai === 'guard') return 'IMMUNE';
    if (e.magicOnly) {
      if (kind === 'bomb' || kind === 'fire' || kind === 'boomy') return 'NO EFFECT';
      if (kind === 'bite' && !stats().fangCaps) return 'NO EFFECT';
    }
    return null;
  }
  function provoke(e) {
    if (e.hostile || e.citizen || e.isBody) return;
    e.hostile = true; e.target = null;
    numText(cx(e), e.y - 10, '!', '#f83800', 2);
    sfx(e.ai === 'urchin' ? 'urchin_roll' : 'warn', { vol: 0.6 });
  }
  // Generic damage to an enemy or the boss. opts: {kind, dir, kb, crit, noCombo, hitX}
  function damageActor(e, dmg, opts) {
    opts = opts || {};
    if (!e || e.dead) return false;
    if (e.isBoss) return damageBoss(e, dmg, opts);
    if (e.state === 'gone') return false;
    var im = immuneTo(e, opts.kind);
    if (im) {
      if (!(e.immT > S.t)) { e.immT = S.t + 0.45; numText(cx(e), e.y - 2, im, '#bcbcbc'); if (opts.kind !== 'fire') sfx('block', { vol: 0.5 }); }
      if (e.ai === 'guard') e.flash = 0.05;
      return false;
    }
    if (e.citizen) citizenHurt(e);
    else if (!e.hostile && !e.isBody) provoke(e);
    var armor = num(e.def.armor, 0);
    var n = Math.max(1, Math.round(dmg - armor));
    e.hp -= n;
    e.flash = e.elite ? 0.16 : 0.1; e.lastHit = S.t; e.lastKind = opts.kind;
    var dir = opts.dir || (cx(e) < cx(S.player) ? -1 : 1);
    var kb = num(e.def.kb, 1) * (opts.kb === undefined ? 80 : opts.kb);
    var anchored = e.ai === 'turret' || e.ai === 'spawner' || e.ai === 'launcher' || e.ai === 'kbody' || e.perched;
    if (!anchored && kb > 0) {
      e.vx = dir * kb; if (!e.flying) e.vy = Math.min(e.vy, -60 - kb * 0.3); else e.vy = -kb * 0.2;
      e.hurtT = 0.16 + Math.min(0.2, kb / 900);
    }
    if (opts.kind === 'fire') { debris(cx(e), cy(e), 2, '#f87858', 60); numText(cx(e), e.y - 2, n, '#f87858'); }
    else { hitSpark(cx(e), cy(e), opts.crit); numText(cx(e), e.y - 2, n, opts.crit ? '#f8d878' : '#fcfcfc', opts.crit ? 2 : 1); }
    if (!opts.noCombo && !e.citizen) registerHit(n);
    if (e.hp <= 0) {
      if (e.ai === 'krasue' && e.body && !e.body.dead) { krasueVanish(e); return true; }
      killEnemy(e, opts); return true;
    }
    return false;
  }
  function krasueVanish(e) {
    e.state = 'gone'; e.respawnT = K.krasueRegrow; e.hp = 0; e.vx = 0; e.vy = 0;
    sfx('krasue_shriek'); smoke(cx(e), cy(e), 6); debris(cx(e), cy(e), 10, '#a81000', 120);
    numText(cx(e), e.y - 10, 'SHRIEK!', '#f878f8');
    if (!S.krasueHinted) { S.krasueHinted = true; toast('THE HEAD WILL BE BACK. FIND THE BODY.', { title: 'KRASUE', icon: 'skull', color: '#f878f8', time: 3.5 }); }
  }
  function bodyXp() { var bd = (D().enemies || {}).krasue_body; return num(bd && bd.xp, num(enemyDef('krasue').xp, 8)); }
  function killEnemy(e, opts) {
    opts = opts || {};
    e.dead = true;
    var run = getRun(), d = e.def;
    if (e.parent) e.parent.kids = Math.max(0, (e.parent.kids || 1) - 1);
    // mold lions come back once unless burned
    if (e.regrow && !e.regrown && opts.kind !== 'fire' && !e.isAdd) {
      S.regrows.push({ id: e.id, x: cx(e), y: e.y + e.h, t: K.regrowTime, elite: e.elite, face: e.face, sprite: e.sprite });
      sfx('enemy_die', { pitch: 0.8 }); smoke(cx(e), cy(e), 3);
      debris(cx(e), cy(e), 10, '#58d854', 100); debris(cx(e), cy(e), 6, '#f878f8', 90);
      numText(cx(e), e.y - 12, 'IT TWITCHES...', '#58d854');
      if (!S.regrowHinted) { S.regrowHinted = true; toast('MOLD LIONS GROW BACK. BURN THE PILE.', { title: 'REGROW', icon: 'jug', color: '#58d854', time: 3.5 }); }
      return;
    }
    sfx('enemy_die');
    smoke(cx(e), cy(e), e.elite ? 6 : 3);
    if (e.citizen) { debris(cx(e), cy(e), 12, '#d82800', 110); return; }
    S.kills++; run.kills = (run.kills || 0) + 1;
    fxSprite('explosion', cx(e), e.y + e.h + 4, 0.3, { color: '#f8b800', size: 12, scale: e.elite ? 2 : 1 });
    debris(cx(e), cy(e), 8, e.magicOnly ? '#bcbcbc' : '#fcfcfc', 110);
    var loot = !e.isAdd && !e.noLoot;
    if (e.ai === 'krasue' && e.body) loot = false; // heads tied to a body pay out through the body
    if (e.isBody) {
      if (e.head && !e.head.dead) { e.head.dead = true; smoke(cx(e.head), cy(e.head), 6); sfx('krasue_shriek', { pitch: 0.7 }); numText(cx(e.head), e.head.y - 8, 'GONE FOR GOOD', '#f878f8'); }
      track('krasue_body');
    }
    if (loot) {
      var xp = (e.isBody ? bodyXp() : num(d.xp, 1)) * (e.elite ? 2.5 : 1);
      call(G(), 'addXP', Math.round(xp));
      var g = d.gold || [0, 1];
      var gold = U.randi(num(g[0], 0), num(g[1], 1)) * (e.elite ? 3 : 1);
      spillCoins(cx(e), cy(e), gold, e.elite ? 8 : 5);
      if (Math.random() < (e.elite ? 0.35 : 0.07)) addPickup('snack', cx(e), cy(e), U.rand(-40, 40), -200, true);
      if (Math.random() < (e.elite ? 0.25 : 0.04)) addPickup('xpl', cx(e), cy(e), U.rand(-40, 40), -220, true, randomExplosive());
      var base = num(d.views, 6 + num(d.xp, 1) * 3) * (e.elite ? 3 : 1);
      var got = addViews(Math.max(1, Math.round(base * comboMul())));
      numText(cx(e), e.y - 12, '+' + got + ' VIEWS', '#f878f8');
    }
    if (S.specialLockT <= 0) S.special = Math.min(1, S.special + 0.04);
    track('kill'); track('kill:' + e.id);
    if (opts.kind === 'bomb' || opts.kind === 'boomy') track('bomb_kill');
    if (opts.kind === 'fire') track('fire_kill');
    if (S.hasUrchins && !e.isBody && !e.flying) S.corpses.push({ kind: 'corpse', x: cx(e) - 6, y: e.y + e.h - 6, w: 12, h: 6, t: 9, sprite: e.sprite, face: e.face, gone: false });
    // Donut's Second Chance: the dead get up and fight for her
    if (S.party.donut && !S.noMagic && !e.isBody && !e.isAdd && e.ai !== 'krasue' && !e.regrow && Math.random() < K.secondChance) raiseAlly(e);
  }
  function citizenHurt(e) {
    if (S.mode !== 'street' || !S.street) return;
    var st = S.street;
    st.alarmT = 8;
    if (st.crimeCd > 0) return;
    st.crimeCd = 4;
    var ok = has(G(), 'crime') ? !!call(G(), 'crime', S.areaId) : !!(S.def.guarded && !S.night);
    if (ok) callGuards();
  }
  function bossHittable(B) { return B && B.active && !B.dying && !B.dead && !B.hidden && (B.facade || B.alpha > 0.5); }
  function bossRects(B, boomy) {
    if (!B.facade) return [B];
    if (boomy && B.alpha > 0.02) return [B];
    var out = [];
    for (var i = 0; i < B.parts.length; i++) { var p = B.parts[i]; if (p.open > 0.5) out.push(partRect(B, p)); }
    return out;
  }
  function partRect(B, p) { return { x: B.x + p.dx - p.w / 2, y: B.y + p.dy - p.h / 2, w: p.w, h: p.h, part: p }; }
  function bossRectHit(B, box) { var rs = bossRects(B); for (var i = 0; i < rs.length; i++) if (overlap(box, rs[i])) return rs[i]; return null; }
  // returns number of things hit. box in world px. opts: {kind, dmg, kb, crit, hitList, dir, breaks}
  function hitBox(box, dmg, opts) {
    var hits = 0, hl = opts.hitList, i, e;
    for (i = 0; i < S.enemies.length; i++) {
      e = S.enemies[i];
      if (e.dead || !e.active || e.state === 'gone' || (hl && hl.indexOf(e) >= 0)) continue;
      if (opts.friendly && (e.citizen || (!e.hostile && !e.isBody))) continue;
      if (overlap(box, e)) { if (hl) hl.push(e); damageActor(e, dmg, opts); hits++; }
    }
    var B = S.boss;
    if (bossHittable(B) && !(hl && hl.indexOf(B) >= 0)) {
      var r = bossRectHit(B, box);
      if (r) { if (hl) hl.push(B); opts.hitX = cx(r); opts.hitY = cy(r); damageActor(B, dmg, opts); hits++; }
    }
    for (i = 0; i < S.objects.length; i++) {
      var o = S.objects[i];
      if (o.kind === 'chest' && !o.open && overlap(box, o)) { openChest(o); hits++; }
      else if (o.kind === 'lever' && !o.on && overlap(box, o)) { pullLever(o); hits++; }
      else if (o.kind === 'cage' && !o.broken && overlap(box, o) && !(hl && hl.indexOf(o) >= 0)) { if (hl) hl.push(o); hitCage(o); hits++; }
    }
    if (opts.breaks !== false) {
      var x0 = Math.floor(box.x / TS), x1 = Math.floor((box.x + box.w) / TS), y0 = Math.floor(box.y / TS), y1 = Math.floor((box.y + box.h) / TS);
      for (var ty = y0; ty <= y1; ty++) for (var tx = x0; tx <= x1; tx++) if (tileAt(tx, ty) === T_CRATE) { breakCrate(tx, ty); hits++; }
    }
    if (opts.kind !== 'bomb' && opts.kind !== 'fire') {
      for (i = S.eproj.length - 1; i >= 0; i--) if (overlap(box, S.eproj[i])) { hitSpark(cx(S.eproj[i]), cy(S.eproj[i])); S.eproj.splice(i, 1); }
    }
    return hits;
  }
  function breakCrate(tx, ty) {
    setTile(tx, ty, T_EMPTY);
    var x = tx * TS + 8, y = ty * TS + 8;
    sfx('crate_break'); track('crate');
    debris(x, y, 12, '#c88848', 130);
    smoke(x, y, 2);
    var r = Math.random();
    if (r < 0.45) spillCoins(x, y, U.randi(2, 6), 3);
    else if (r < 0.62) addPickup('snack', x, y, 0, -180, true);
    else if (r < 0.70) addPickup('xpl', x, y, 0, -180, true, randomExplosive());
  }
  function openChest(o) {
    o.open = true;
    sfx('unlock'); sfx('coin');
    spillCoins(cx(o), o.y, U.randi(10, 22), 8);
    fxSprite('sparkle', cx(o), o.y + 4, 0.4, { color: '#f8d878', size: 8 });
  }
  function pullLever(o) {
    o.on = true;
    sfx('door'); sfx('checkpoint'); DCW.shake(2, 0.25);
    var gates = (o.chunk && o.chunk.gates) || [], L = S.L;
    gates.forEach(function (idx, k) {
      if (L.t[idx] !== T_GATE) return;
      L.t[idx] = T_EMPTY;
      var gx = (idx % L.w) * TS + 8, gy = Math.floor(idx / L.w) * TS + 8;
      if (k % 2 === 0) debris(gx, gy, 6, '#7c7c7c', 90);
      if (k % 3 === 0) smoke(gx, gy, 1);
    });
    numText(cx(o), o.y - 10, gates.length ? 'GATE OPEN!' : 'CLICK.', '#58f898');
    track('lever');
  }
  function hitCage(o) {
    o.hp--; o.shakeT = 0.25;
    sfx(o.hp > 0 ? 'hit' : 'crate_break');
    debris(cx(o), cy(o), o.hp > 0 ? 4 : 14, '#7c7c7c', 110);
    if (o.hp > 0) { numText(cx(o), o.y - 6, 'CLANG!', '#fcfcfc'); return; }
    o.broken = true;
    freeCompanion(o);
  }
  function freeCompanion(o) {
    var id = o.comp;
    flash('#fcfcfc', 0.25); DCW.shake(3, 0.3); DCW.freeze(8);
    sfx('unlock');
    fxSprite('sparkle', cx(o), cy(o), 0.6, { color: '#f8d878', size: 14 });
    track('rescue:' + id);
    if (S.def.rescueFlag) setFlag(S.def.rescueFlag);
    S.party[id] = makeCompanion(id, cx(o), o.y + o.h);
    if (S.party[id]) S.party[id].actT = 0.6;
    var lines = S.def.rescueLines;
    var nm = id === 'mongo' ? 'MONGO' : id === 'katia' ? 'KATIA' : id === 'donut' ? 'PRINCESS DONUT' : String(id).toUpperCase();
    if (lines && lines.length) say(lines);
    else toast(nm + ' IS FREE AND EXTREMELY UPSET.', { title: 'RESCUED', icon: 'star', color: '#f8b800', time: 3.2 });
  }
  function collectItem(o) {
    o.taken = true;
    var q = itemDef(o.id) || {};
    giveItem(o.id, 1);
    sfx('unlock'); flash('#f8d878', 0.2); DCW.freeze(6);
    fxSprite('sparkle', cx(o), cy(o), 0.6, { color: '#f8d878', size: 14 });
    announce('KEY ITEM', { color: '#f8d878', time: 1.6, sub: itemName(o.id) });
    say([{ who: 'SYSTEM AI', portrait: 'p_ai', text: 'KEY ITEM GET: ' + itemName(o.id) + '. ' + (q.desc || '') }]);
  }
  function rollCrit(dmg) {
    var c = Math.random() < num(stats().crit, 0.05);
    return { dmg: c ? dmg * 2 : dmg, crit: c };
  }
  function meleeHit(box, dmg, opts) {
    var r = rollCrit(dmg);
    opts.crit = r.crit;
    var n = hitBox(box, r.dmg, opts);
    if (n) {
      DCW.freeze(r.crit ? 5 : (opts.kind === 'kick' ? 4 : 3));
      sfx(r.crit ? 'crit' : 'hit');
      if (r.crit || opts.kind === 'kick') DCW.shake(r.crit ? 3 : 2, 0.12);
    }
    return n;
  }

  /* ---------------- explosions, fire, smoke, darkness ---------------- */
  function circHit(x, y, radius, o) { var nx = U.clamp(x, o.x, o.x + o.w), ny = U.clamp(y, o.y, o.y + o.h); return (nx - x) * (nx - x) + (ny - y) * (ny - y) <= radius * radius; }
  function explode(x, y, radius, dmg, fromPlayer, kind, opts) {
    kind = kind || 'bomb'; opts = opts || {};
    sfx(radius >= 40 ? 'detonate' : 'explosion'); if (radius >= 40) sfx('explosion');
    DCW.shake(radius >= 40 ? 5 : 4, 0.3); DCW.freeze(4);
    fxSprite('explosion', x, y + radius * 0.6, 0.42, { color: '#f8b800', size: radius, scale: radius >= 26 ? 2 : 1, front: true });
    part({ kind: 'ring', x: x, y: y, r: radius, life: 0.25, color: '#fcfcfc' });
    S.lights.push({ x: x, y: y, r: radius * 2, tmp: true });
    smoke(x, y, 5);
    debris(x, y, 14, '#f8b800', 170);
    var killsBefore = S.kills, i, e;
    if (fromPlayer) {
      for (i = 0; i < S.enemies.length; i++) {
        e = S.enemies[i];
        if (!e.dead && e.active && e.state !== 'gone' && circHit(x, y, radius, e)) damageActor(e, dmg, { kind: kind, kb: 220, dir: cx(e) < x ? -1 : 1 });
      }
      var B = S.boss;
      if (bossHittable(B)) {
        var rs = bossRects(B, kind === 'boomy');
        for (i = 0; i < rs.length; i++) if (circHit(x, y, radius, rs[i])) { damageActor(B, dmg * (B.facade && kind === 'boomy' ? 3 : 1), { kind: kind, hitX: cx(rs[i]), hitY: cy(rs[i]) }); break; }
      }
      for (i = 0; i < S.objects.length; i++) {
        var ob = S.objects[i];
        if (!circHit(x, y, radius, ob)) continue;
        if (ob.kind === 'chest' && !ob.open) openChest(ob);
        else if (ob.kind === 'lever' && !ob.on) pullLever(ob);
        else if (ob.kind === 'cage' && !ob.broken) { ob.hp = 1; hitCage(ob); }
      }
      var x0 = Math.floor((x - radius) / TS), x1 = Math.floor((x + radius) / TS), y0 = Math.floor((y - radius) / TS), y1 = Math.floor((y + radius) / TS);
      for (var ty = y0; ty <= y1; ty++) for (var tx = x0; tx <= x1; tx++) if (tileAt(tx, ty) === T_CRATE && circHit(x, y, radius, { x: tx * TS, y: ty * TS, w: TS, h: TS })) breakCrate(tx, ty);
      var k = S.kills - killsBefore;
      if (k >= 3) { track('multi_bomb'); numText(x, y - 20, k + 'X BOMB KILL!', '#f8d878', 1); }
      if (!opts.noSelf && circHit(x, y, radius, S.player) && S.player.state !== 'dead') hurtPlayer(K.selfDmg, x, { raw: true, cause: 'OWN BOMB' });
    } else {
      if (circHit(x, y, radius, S.player)) hurtPlayer(dmg, x, { cause: opts.cause || 'EXPLOSION' });
    }
    stunPartyNear(x, y, radius);
  }
  function addFire(x, y, w) {
    var gy = groundUnder(x, y - 10);
    w = w || K.fireW;
    S.fires.push({ x0: x - w / 2, x1: x + w / 2, y: gy, life: K.fireLife, tick: 0.05, t: 0 });
    sfx('fire_burst');
  }
  function updFires(dt) {
    for (var i = S.fires.length - 1; i >= 0; i--) {
      var f = S.fires[i];
      f.life -= dt; f.t += dt; f.tick -= dt;
      if (f.tick <= 0) {
        f.tick = K.fireTick;
        var box = { x: f.x0, y: f.y - 20, w: f.x1 - f.x0, h: 22 }, j;
        for (j = 0; j < S.enemies.length; j++) {
          var e = S.enemies[j];
          if (!e.dead && e.active && e.state !== 'gone' && !e.citizen && overlap(box, e)) damageActor(e, 1, { kind: 'fire', kb: 0, noCombo: true });
        }
        var B = S.boss;
        if (bossHittable(B) && !B.facade && overlap(box, B)) damageActor(B, 1, { kind: 'fire', noCombo: true, hitX: cx(B) });
        for (j = S.regrows.length - 1; j >= 0; j--) {
          var rg = S.regrows[j];
          if (rg.x > f.x0 - 6 && rg.x < f.x1 + 6 && Math.abs(rg.y - f.y) < 24) {
            S.regrows.splice(j, 1);
            var d = enemyDef(rg.id);
            call(G(), 'addXP', Math.round(num(d.xp, 4) * (rg.elite ? 2.5 : 1)));
            spillCoins(rg.x, rg.y - 6, U.randi(num((d.gold || [0, 1])[0], 0), num((d.gold || [0, 1])[1], 1)), 4);
            S.kills++; track('kill'); track('kill:' + rg.id); track('regrow_burn');
            numText(rg.x, rg.y - 16, 'BURNED FOR GOOD', '#f87858');
            smoke(rg.x, rg.y - 4, 4); sfx('fire_burst', { pitch: 1.3 });
          }
        }
      }
      if (Math.random() < 0.5) part({ kind: 'px', x: U.rand(f.x0, f.x1), y: f.y - U.rand(2, 10), vx: 0, vy: -U.rand(20, 50), life: 0.4, color: U.chance(0.5) ? '#f8b800' : '#f83800', size: 1 });
      if (f.life <= 0) S.fires.splice(i, 1);
    }
  }
  function addCloud(x, y, r, life) {
    S.clouds.push({ x: x, y: y, r: r || K.smokeR, life: life || K.smokeLife, t: 0 });
    sfx('smoke_puff'); smoke(x, y, 8);
  }
  function updClouds(dt) {
    for (var i = S.clouds.length - 1; i >= 0; i--) {
      var c = S.clouds[i];
      c.life -= dt; c.t += dt;
      for (var j = 0; j < S.enemies.length; j++) {
        var e = S.enemies[j];
        if (!e.dead && dist(cx(e), cy(e), c.x, c.y) < c.r) e.lostT = K.smokeLost;
      }
      if (c.life <= 0) S.clouds.splice(i, 1);
    }
  }
  function addOrb(x, y, r, life) { S.orbs.push({ x: x, y: y, r: 0, rmax: r || 44, life: life || 6, t: 0 }); sfx('fear', { pitch: 0.6, vol: 0.6 }); }
  function updOrbs(dt) {
    for (var i = S.orbs.length - 1; i >= 0; i--) {
      var o = S.orbs[i];
      o.t += dt; o.life -= dt;
      o.r = o.rmax * Math.min(1, o.t / 0.5) * Math.min(1, Math.max(0, o.life) / 0.5);
      if (o.life <= 0) S.orbs.splice(i, 1);
    }
  }
  function updRegrows(dt) {
    for (var i = S.regrows.length - 1; i >= 0; i--) {
      var r = S.regrows[i];
      r.t -= dt;
      if (Math.random() < 0.15) part({ kind: 'px', x: r.x + U.rand(-6, 6), y: r.y - U.rand(1, 6), vx: 0, vy: -10, life: 0.3, color: U.chance(0.5) ? '#58d854' : '#f878f8', size: 1 });
      if (r.t <= 0) {
        S.regrows.splice(i, 1);
        var e = spawnEnemy(r.id, r.x, r.y, { regrown: true });
        e.elite = !!r.elite; e.face = r.face || 1;
        numText(cx(e), e.y - 10, 'IT GREW BACK!', '#58d854'); sfx('spawn', { pitch: 0.7 });
      }
    }
  }
  // light / darkness queries (world px). dark = the level is dark (or the boss cast darkness)
  function darkNow() { return S.dark || S.darkT > 0; }
  function inOrb(x, y) { for (var i = 0; i < S.orbs.length; i++) { var o = S.orbs[i]; if (dist(x, y, o.x, o.y) < o.r) return true; } return false; }
  function isDarkAt(x, y) {
    if (inOrb(x, y)) return true;
    if (!darkNow()) return false;
    for (var i = 0; i < S.lights.length; i++) { var l = S.lights[i]; if (dist(x, y, l.x, l.y) < l.r * 0.8) return false; }
    return true;
  }
  function torchR() { return S.party.donut && !S.swap ? K.torchR : K.torchSoloR; }
  function computeLights() {
    var L = [], P = S.player, i;
    for (i = 0; i < S.lights.length; i++) if (S.lights[i].tmp && (S.lights[i].ttl = (S.lights[i].ttl === undefined ? 0.25 : S.lights[i].ttl) - 1 / 60) > 0) L.push(S.lights[i]);
    if (P && P.state !== 'dead') L.push({ x: cx(P), y: cy(P) - 4, r: torchR() + Math.sin(S.t * 3) * 2 });
    for (i = 0; i < S.fires.length; i++) { var f = S.fires[i]; L.push({ x: (f.x0 + f.x1) / 2, y: f.y - 8, r: 38 }); }
    for (i = 0; i < S.pproj.length; i++) L.push({ x: cx(S.pproj[i]), y: cy(S.pproj[i]), r: 20 });
    for (i = 0; i < S.objects.length; i++) { var o = S.objects[i]; if (o.kind === 'charge' && o.planted) L.push({ x: cx(o), y: cy(o), r: 14 }); }
    S.lights = L;
  }

  /* ---------------- player damage ---------------- */
  function hurtPlayer(dmg, srcX, opts) {
    opts = opts || {};
    var P = S.player, run = getRun();
    if (!P || P.state === 'dead' || P.state === 'victory' || P.state === 'pit' || S.done) return false;
    if (P.inv > 0 || P.invuln > 0) return false;
    if (S.god) { P.inv = 0.4; return false; }
    if (P.shield > 0 && opts.cause !== 'guard') {
      P.shield--; P.inv = 0.6;
      sfx('block'); debris(cx(P), cy(P), 12, '#78d8f8', 120);
      numText(cx(P), P.y - 4, 'BLOCK', '#78d8f8');
      if (S.party.katia) S.party.katia.actT = 0.4;
      return false;
    }
    var n = opts.raw ? dmg : Math.max(1, Math.round(dmg - num(stats().def, 0)));
    if (DCW.save && DCW.save.settings && DCW.save.settings.easy === true && opts.cause !== 'guard') n = Math.max(1, Math.ceil(n / 2));
    applyDamage(n);
    S.damageTaken += n;
    P.inv = K.iframes;
    if (P.state === 'plant') P.state = 'normal';
    var dir = srcX === undefined ? -P.face : (cx(P) < srcX ? -1 : 1);
    if (opts.knock !== false) {
      setCrouch(P, false);
      P.state = 'hurt'; P.st = 0;
      P.vx = dir * 130; P.vy = opts.kby !== undefined ? opts.kby : -170; P.onGround = false;
    }
    sfx('hurt'); DCW.shake(2, 0.15); DCW.freeze(3);
    numText(cx(P), P.y - 4, '-' + n, '#f83800');
    debris(cx(P), cy(P), 6, '#f83800', 90);
    S.combo = 0; S.comboT = 0;
    var mx = stats().maxHp;
    if (run.hp > 0 && run.hp <= mx * 0.25 && !S.lowHpQuipped) { S.lowHpQuipped = true; S.quipT = 0; quip('lowHp', 1); }
    if (run.hp <= 0) killPlayer(opts.cause || 'DAMAGE');
    return true;
  }
  function applyDamage(n) {
    var run = getRun();
    if (has(G(), 'damageTaken')) call(G(), 'damageTaken', n);
    else run.hp = Math.max(0, run.hp - n);
    if (run.hp < 0) run.hp = 0;
  }
  function killPlayer(cause) {
    var P = S.player;
    if (P.state === 'dead') return;
    setCrouch(P, false);
    P.state = 'dead'; P.st = 0; P.vx = 0; P.vy = -230; P.cause = cause;
    S.combo = 0;
    sfx('death'); DCW.freeze(10); DCW.shake(4, 0.4);
    flash('#f83800', 0.12);
    if (cause === 'guard') announce('DEATH PENALTY', { color: '#f83800', time: 2, sub: aiLine('guardKill') || 'THERE IS NO JAIL ON THIS FLOOR.' });
    music(null);
  }

  /* ================================================================
     PLAYER (Carl, or Mongo in a swap level)
     ================================================================ */
  function makePlayer(x, feetY) {
    var w = 10, h = PH;
    if (S.swap) { var big = !!stats().mongoBig; w = big ? 16 : 12; h = big ? 18 : 12; }
    return { x: x - w / 2, y: feetY - h, w: w, h: h, vx: 0, vy: 0, face: 1, onGround: false, state: 'normal', st: 0,
      coyote: 0, buffer: 0, jumping: false, airJumps: 0, inv: 0, invuln: 0, shield: 0, dropT: 0, crouch: false,
      pIdx: 0, chainT: 0, queued: false, hitList: [], throwT: 0, landT: 0, runT: 0, liqT: 0, platform: null, prevBottom: feetY,
      anim: 'idle', animT: 0, charmT: 0, launchT: 0, mongo: !!S.swap, standH: h };
  }
  function setCrouch(P, on) {
    if (on === P.crouch || P.mongo) return;
    var d = PH - PH_CROUCH;
    if (on) { P.y += d; P.h = PH_CROUCH; } else {
      if (solidAt(P.x + 1, P.y - d) || solidAt(P.x + P.w - 1, P.y - d)) return;
      P.y -= d; P.h = PH;
    }
    P.crouch = on;
  }
  function ladderAtPlayer(P, dy) {
    var tx = Math.floor(cx(P) / TS), ty = Math.floor((P.y + P.h + (dy || -2)) / TS);
    return tileAt(tx, ty) === T_LADDER ? { tx: tx, ty: ty } : null;
  }
  function startPunch(P, idx) {
    P.state = 'punch'; P.st = 0; P.pIdx = P.mongo ? 0 : idx; P.hitList = []; P.queued = false;
    if (P.onGround) P.vx += P.face * K.punchStep * (P.mongo ? 2.2 : idx === 2 ? 1.4 : 1);
    sfx(P.mongo ? 'bite' : 'punch', { pitch: 1 + idx * 0.08 });
  }

  /* ---------------- explosives ---------------- */
  function selectedX() {
    var run = getRun(), s = run.selected;
    if (EXPLOSIVES.indexOf(s) < 0) s = run.selected = 'jug';
    return s;
  }
  function ownedX() { return EXPLOSIVES.filter(function (id) { return itemCount(id) > 0; }); }
  function cycleX(P) {
    var run = getRun();
    if (!ownedX().length) { sfx('error'); numText(cx(P), P.y - 6, 'NO EXPLOSIVES', '#f83800'); return; }
    var i = EXPLOSIVES.indexOf(selectedX());
    for (var k = 1; k <= 4; k++) { var id = EXPLOSIVES[(i + k) % 4]; if (itemCount(id) > 0) { run.selected = id; break; } }
    sfx('menu_move');
    numText(cx(P), P.y - 8, itemName(run.selected) + ' X' + itemCount(run.selected), XCOLOR[run.selected] || '#fcfcfc');
  }
  function throwX(P) {
    var run = getRun(), id = selectedX();
    if (itemCount(id) <= 0) {
      var own = ownedX();
      if (!own.length) { sfx('error'); numText(cx(P), P.y - 6, 'NO EXPLOSIVES', '#f83800'); return false; }
      id = run.selected = own[0];
    }
    if (!useItem(id, 1)) { sfx('error'); return false; }
    launchX(P, id, I.down('down'));
    track('throw:' + id);
    return true;
  }
  function launchX(P, id, drop, opts) {
    opts = opts || {};
    P.throwT = 0.2;
    var st = stats(), x = cx(P) + P.face * 6, y = P.y + 2;
    var p = { kind: 'x', xid: id, x: x - 3, y: y, w: 6, h: 6, vx: drop ? P.face * 45 : P.face * K.throwVX + P.vx * 0.4,
      vy: drop ? -90 : K.throwVY + Math.min(0, P.vy * 0.3), fuse: id === 'dyn' ? K.dynFuse : id === 'hob' ? K.hobFuse : 4, spin: 0, t: 0, grav: K.throwGrav };
    if (opts.vx !== undefined) p.vx = opts.vx;
    if (opts.vy !== undefined) p.vy = opts.vy;
    if (id === 'hob' && st.xistera && !drop && !opts.vx) { p.vx = P.face * K.xisteraVX; p.vy = -18; p.grav = 110; p.straight = true; P.launchT = 0.25; sfx('launch'); track('xistera'); }
    else sfx('bomb_throw');
    S.pproj.push(p);
    return p;
  }
  function detonateX(p) {
    var st = stats(), x = cx(p), y = cy(p);
    switch (p.xid) {
      case 'jug': explode(x, y, K.jugR, num(st.jugDmg, 10), true, 'bomb'); addFire(x, y); break;
      case 'hob': explode(x, y, K.hobR, num(st.hobDmg, 12), true, 'bomb'); break;
      case 'dyn': explode(x, y, K.dynR, num(st.dynDmg, 25), true, 'bomb'); break;
      case 'smoke': addCloud(x, y - 8); break;
      case 'mic': explode(x, y, 56, Math.round(num(st.jugDmg, 10) * 2.5), true, 'bomb', { noSelf: true }); addFire(x, y, 96); flash('#f8b800', 0.2); DCW.shake(6, 0.5); break;
      case 'stray': explode(x, y, 26, 4, false, 'bomb', { cause: 'STORED MAGIC' }); break;
    }
  }
  function updXProj(p, i, dt) {
    p.t += dt; p.fuse -= dt; p.spin += dt * 12;
    var wvy = p.vy, wvx = p.vx;
    p.vy = Math.min(p.vy + p.grav * dt, 360);
    moveBody(p, dt, p.xid === 'mic' && p.vy < 0);
    var impact = p.onGround || p.hitWall || p.bonk;
    var touch = false, j;
    for (j = 0; j < S.enemies.length && !touch; j++) { var e = S.enemies[j]; if (!e.dead && e.active && e.state !== 'gone' && (e.hostile || e.isBody) && overlap(p, e)) touch = true; }
    if (!touch && bossHittable(S.boss) && bossRectHit(S.boss, p)) touch = true;
    var boom = false;
    switch (p.xid) {
      case 'jug': boom = impact || touch || p.fuse <= 0; break;
      case 'smoke': boom = impact || touch || p.fuse <= 0; break;
      case 'mic': boom = (p.onGround && p.t > 0.3) || p.fuse <= 0; break;
      case 'hob': boom = p.straight ? (impact || touch || p.fuse <= 0) : (touch || p.fuse <= 0); break;
      default: boom = p.fuse <= 0; break;
    }
    if (!boom && p.onGround && wvy > 80) { p.vy = -wvy * 0.4; p.onGround = false; }
    if (!boom && p.onGround) p.vx *= 0.8;
    if (!boom && p.hitWall) p.vx = -wvx * 0.5;
    if (p.y > S.L.pxH) { S.pproj.splice(i, 1); return; }
    if (boom) { S.pproj.splice(i, 1); detonateX(p); }
  }

  /* ---------------- specials ---------------- */
  function trySpecial() {
    var P = S.player;
    if (S.specialLockT > 0) { sfx('error'); numText(cx(P), P.y - 6, 'MAGIC LOCKED', '#bcbcbc'); return; }
    if (S.special < 1) { if (S.special < 0.98) sfx('error'); return; }
    var down = I.down('down'), up = I.down('up'), donut = !!S.party.donut && !S.noMagic;
    if (down || up) {
      var need = down ? 'dyn' : 'jug';
      if (!donut) { sfx('error'); numText(cx(P), P.y - 6, 'NO DONUT', '#f83800'); return; }
      if (!useItem(need, 1)) { sfx('error'); numText(cx(P), P.y - 6, 'NEEDS ' + itemName(need), '#f83800'); return; }
      S.special = 0;
      if (down) boomyBoy(P); else micDrop(P);
      return;
    }
    S.special = 0;
    panic(P);
  }
  function specialFx(name, sub) {
    announce(name, { color: '#f8d878', time: 1.6, sub: sub || '' });
    flash('#fcfcfc', 0.22); DCW.shake(3, 0.3); DCW.freeze(6);
  }
  function panic(P) {
    specialFx('PANIC!', S.party.donut && !S.noMagic ? 'FEAR + MAGIC MISSILE' : 'FEAR');
    sfx('fear');
    var i, e, targets = [];
    for (i = 0; i < S.enemies.length; i++) {
      e = S.enemies[i];
      if (e.dead || !onScreen(e, 8) || e.state === 'gone') continue;
      if (e.citizen) { if (S.street) S.street.alarmT = 6; continue; }
      if (e.hostile || e.isBody) targets.push(e);
      if (e.fearImmune || e.isBody || e.ai === 'guard') { numText(cx(e), e.y - 6, 'NOT SCARED', '#bcbcbc'); continue; }
      e.stun = K.fearTime; e.vx = 0; numText(cx(e), e.y - 6, 'FEAR', '#3cbcfc');
    }
    var B = S.boss;
    if (bossHittable(B)) { targets.push(B); if (!B.def.fearImmune && !B.facade) B.stun = 1.2; }
    if (S.party.donut && !S.noMagic) {
      S.missileQueue = S.missileQueue || [];
      for (i = 0; i < 12; i++) S.missileQueue.push({ at: 0.15 + i * 0.07, target: targets.length ? targets[i % targets.length] : null, dmg: Math.max(2, Math.round(num(stats().missileDmg, 4) * 1.2)) });
      if (S.party.donut) S.party.donut.castT = 1.0;
    }
    track('panic');
  }
  function boomyBoy(P) {
    specialFx('THE BOOMY BOY!', 'CLOCKWORK MONGOS WITH DYNAMITE');
    sfx('clockwork');
    for (var i = 0; i < 2; i++) S.allies.push({ kind: 'boomy', x: cx(P) - 7 + P.face * 6, y: P.y + P.h - 12, w: 14, h: 12, vx: P.face * (165 - i * 40), vy: 0, face: P.face, life: 3.4, t: 0, delay: i * 0.3, onGround: false });
    if (S.party.donut) S.party.donut.castT = 0.8;
    track('boomy_boy');
  }
  function freeBox(x, y, w, h) {
    for (var yy = y; yy < y + h; yy += 7) for (var xx = x; xx <= x + w; xx += Math.max(1, w / 2)) if (solidAt(xx, yy)) return false;
    return !solidAt(x, y + h - 1) && !solidAt(x + w, y + h - 1) && !solidAt(x, y);
  }
  function findLanding(px, py) {
    if (px < 8 || px > S.L.pxW - 8) return null;
    for (var yy = py; yy <= py + 56; yy += 4) {
      if (standableAt(px - 3, yy + 1) || standableAt(px + 3, yy + 1)) {
        var fy = Math.floor((yy + 1) / TS) * TS;
        if (freeBox(px - 5, fy - PH, 10, PH - 1)) return fy;
      }
    }
    return null;
  }
  function micDrop(P) {
    specialFx('MIC DROP!', 'JUG UP, PUDDLE JUMP OUT');
    var p = { kind: 'x', xid: 'mic', x: cx(P) - 3, y: P.y - 4, w: 6, h: 6, vx: 0, vy: -430, grav: K.throwGrav, fuse: 6, t: 0, spin: 0 };
    S.pproj.push(p);
    sfx('bomb_throw', { pitch: 0.8 });
    var feet = P.y + P.h, best = null;
    var dxs = [80, 72, 88, 64, 96, 56, 104, 48, 112], dys = [-64, -48, -80, -32, -16, 0, 16];
    for (var i = 0; i < dxs.length && !best; i++) for (var j = 0; j < dys.length && !best; j++) {
      var tx = cx(P) + P.face * dxs[i], fy = findLanding(tx, feet + dys[j] - 8);
      if (fy !== null && Math.abs(fy - (feet + dys[j])) < 24) best = { x: tx, y: fy };
    }
    if (!best) { for (i = 0; i < dxs.length && !best; i++) { var tx2 = cx(P) - P.face * dxs[i], fy2 = findLanding(tx2, feet - 32); if (fy2 !== null) best = { x: tx2, y: fy2 }; } }
    smoke(cx(P), cy(P), 6); sfx('teleport');
    if (best) { setCrouch(P, false); P.x = best.x - P.w / 2; P.y = best.y - P.h; P.vx = 0; P.vy = 0; P.platform = null; }
    smoke(cx(P), cy(P), 6);
    P.inv = Math.max(P.inv, 0.9);
    if (S.party.donut) S.party.donut.castT = 0.8;
    track('mic_drop');
  }
  function usePotion() {
    var run = getRun(), P = S.player;
    if (has(G(), 'usePotion')) {
      if (call(G(), 'usePotion')) { debris(cx(P), cy(P), 14, '#58f898', 80); numText(cx(P), P.y - 6, 'POTION!', '#58f898'); }
      return;
    }
    var mx = stats().maxHp;
    if ((run.potions || 0) <= 0 || run.hp >= mx) { sfx('error'); return; }
    run.potions--; run.hp = Math.min(mx, run.hp + Math.ceil(mx * 0.5)); sfx('heal'); track('potion');
  }

  /* ---------------- player update ---------------- */
  function updPlayer(dt) {
    var P = S.player, st = stats();
    P.prevBottom = P.y + P.h;
    P.inv -= dt; P.invuln -= dt; P.dropT -= dt; P.throwT -= dt; P.landT -= dt; P.chainT -= dt; P.animT += dt; P.charmT -= dt; P.launchT -= dt;
    if (P.coyote > 0) P.coyote--;
    if (P.buffer > 0) P.buffer--;

    if (P.state === 'dead') {
      P.st += dt;
      if (P.st > 0.35) { P.vy = Math.min(P.vy + K.gravity * 0.7 * dt, 260); P.y += P.vy * dt; }
      if (P.st > 1.9 && !S.diedSent) {
        S.diedSent = true; S.done = true;
        var res = { levelId: S.mode === 'level' ? S.id : null, areaId: S.areaId || null, cause: P.cause || 'DAMAGE' };
        if (has(G(), 'playerDied')) call(G(), 'playerDied', res); else S.fallbackMsg = 'YOU DIED';
      }
      return;
    }
    if (P.state === 'pit') { P.st -= dt; if (P.st <= 0) respawnFromPit(); return; }
    if (P.state === 'victory' || S.leaving) {
      P.vx = U.approach(P.vx, 0, K.friction * dt);
      P.vy = Math.min(P.vy + K.gravity * dt, K.fallMax);
      moveBody(P, dt, false);
      return;
    }

    var ax = I.axisX(), down = I.down('down'), up = I.down('up');
    if (P.charmT > 0) ax = -ax;
    if (I.pressed('jump')) P.buffer = K.buffer;
    if (!P.mongo) {
      if (I.pressed('potion')) usePotion();
      if (I.pressed('special')) trySpecial();
    }
    if (P.state === 'plant') { updPlant(P, dt); afterMove(P, dt); return; }

    // ---------- interactions take 'up' priority over ladders ----------
    var near = interactAt(P);
    if (near && I.pressed('up') && (P.onGround || P.state === 'climb') && P.state !== 'hurt') {
      if (interact(near)) { afterMove(P, dt); return; }
    }
    if (S.mode === 'level' && !S.plant) {
      var bossUp = S.isBoss && S.boss && !S.boss.dead;
      if (near && near.kind === 'door' && P.state === 'normal' && P.onGround && Math.abs(cx(P) - cx(near)) < 8 && !bossUp) { enterDoor(near); return; }
      if (!bossUp && P.state === 'normal' && P.x + P.w >= S.L.pxW - 1 && !S.vertical) {
        var lastDoor = null;
        for (var di = 0; di < S.objects.length; di++) if (S.objects[di].kind === 'door') lastDoor = S.objects[di];
        if (lastDoor) { enterDoor(lastDoor); return; }
      }
    }

    // ---------- ladder ----------
    if (P.state === 'climb') { updClimb(P, dt, ax); afterMove(P, dt); return; }
    if (P.state === 'normal' && !(near && up)) {
      var lad = null;
      if (up) lad = ladderAtPlayer(P, -6);
      else if (down && P.onGround) { var below = ladderAtPlayer(P, 4); if (below && isLadderTop(below.tx, below.ty)) lad = below; }
      else if (down && !P.onGround) lad = ladderAtPlayer(P, -6);
      if (lad) {
        P.state = 'climb'; P.vx = 0; P.vy = 0; setCrouch(P, false);
        P.x = lad.tx * TS + 8 - P.w / 2;
        if (down && P.onGround) P.y += 4;
        P.platform = null; P.jumping = false;
        updClimb(P, dt, ax); afterMove(P, dt);
        return;
      }
    }

    // ---------- state machine ----------
    if (P.state === 'punch' && P.buffer > 0 && P.st > 0.12 && (P.onGround || P.coyote > 0)) { P.state = 'normal'; P.chainT = 0; }
    var control = P.state === 'normal';
    if (P.state === 'hurt') { P.st += dt; if (P.st >= K.hurtDur) P.state = 'normal'; }
    if (P.state === 'punch') {
      P.st += dt;
      var dur = P.mongo ? 0.22 : P.pIdx === 2 ? K.punch3Dur : K.punchDur;
      if (P.st > 0.04 && P.st < 0.13) {
        if (P.mongo) meleeHit({ x: P.face > 0 ? P.x + P.w - 2 : P.x - 12, y: P.y + 1, w: 14, h: Math.max(10, P.h - 2) }, Math.round(num(st.biteDmg, 6)), { kind: 'bite', kb: 110, dir: P.face, hitList: P.hitList });
        else {
          var bx = P.face > 0 ? P.x + P.w - 2 : P.x - 14;
          var d = P.pIdx === 2 ? st.dmg * 1.35 : st.dmg;
          meleeHit({ x: bx, y: P.y + 3, w: 16, h: 11 }, Math.round(d), { kind: 'punch', kb: P.pIdx === 2 ? 170 : 75, dir: P.face, hitList: P.hitList });
        }
      }
      if (I.pressed('attack') && P.st > 0.05) P.queued = true;
      if (P.st >= dur) {
        if (P.queued && P.pIdx < 2 && !P.mongo) startPunch(P, P.pIdx + 1);
        else { P.state = 'normal'; P.chainT = P.pIdx < 2 ? K.punchChain : 0; P.lastPIdx = P.pIdx; }
      }
      if (P.onGround) P.vx = U.approach(P.vx, 0, K.friction * 0.8 * dt);
    } else if (P.state === 'kick') {
      P.st += dt;
      if (P.st > 0.1 && P.st < 0.24) {
        var kx = P.face > 0 ? P.x + P.w - 2 : P.x - 18;
        if (meleeHit({ x: kx, y: P.y + 8, w: 20, h: 10 }, st.kickDmg, { kind: 'kick', kb: 200, dir: P.face, hitList: P.hitList }) && !P.kickTracked) { P.kickTracked = true; track('kick'); }
      }
      P.vx = U.approach(P.vx, 0, K.friction * dt);
      if (P.st >= K.kickDur) P.state = 'normal';
    } else if (P.state === 'airkick') {
      P.st += dt;
      P.vx = P.face * K.airkickVX; P.vy = K.airkickVY;
      var ab = { x: P.face > 0 ? P.x + 2 : P.x - 6, y: P.y + P.h - 10, w: P.w + 4, h: 14 };
      var r = rollCrit(P.mongo ? num(st.biteDmg, 6) : st.kickDmg);
      var hits = hitBox(ab, r.dmg, { kind: P.mongo ? 'bite' : 'stomp', kb: 140, dir: P.face, crit: r.crit, hitList: P.hitList });
      if (hits) {
        P.vy = -K.airkickBounce; P.vx = -P.face * 50; P.state = 'normal'; P.airJumps = st.extraJump ? 1 : 0;
        P.jumping = false; P.inv = Math.max(P.inv, 0.12);
        sfx('stomp'); track('stomp'); DCW.freeze(r.crit ? 5 : 4); DCW.shake(2, 0.1);
        if (st.freeballing && !P.mongo) numText(cx(P), P.y - 10, 'FREEBALLING!', '#f8d878');
      }
    }

    if (control) {
      var crouchWant = P.onGround && down && !ax && P.chainT <= 0;
      setCrouch(P, crouchWant);
      var max = K.runMax * num(st.speedMul, 1) * (P.mongo ? K.swapSpeed : 1);
      if (P.crouch) P.vx = U.approach(P.vx, 0, K.friction * dt);
      else if (ax) {
        var acc = P.onGround ? K.accelGround : K.accelAir;
        if (P.vx * ax < 0) acc *= K.turnMul;
        P.vx = U.approach(P.vx, ax * max, acc * dt);
        P.face = ax;
      } else P.vx = U.approach(P.vx, 0, (P.onGround ? K.friction : K.airFriction) * dt);
      // attacks
      if (I.pressed('attack')) {
        if (P.mongo) { if (down && !P.onGround) { P.state = 'airkick'; P.st = 0; P.hitList = []; P.jumping = false; sfx('bite'); } else startPunch(P, 0); }
        else if (down && P.onGround) { setCrouch(P, false); P.state = 'kick'; P.st = 0; P.hitList = []; P.kickTracked = false; sfx('kick'); }
        else if (down && !P.onGround) { P.state = 'airkick'; P.st = 0; P.hitList = []; P.jumping = false; sfx('kick'); }
        else { setCrouch(P, false); startPunch(P, (P.chainT > 0 && P.lastPIdx < 2) ? P.lastPIdx + 1 : 0); }
      } else if (I.pressed('bomb') && !P.mongo) bombButton(P, up);
      // jumping
      if (P.buffer > 0 && P.state === 'normal') {
        if (P.onGround || P.coyote > 0) {
          if (down && P.onGround && standingOnPassable(P)) {
            P.dropT = 0.22; P.y += 3; P.onGround = false; P.platform = null; P.buffer = 0; setCrouch(P, false);
          } else {
            setCrouch(P, false);
            P.vy = -K.jumpV * (P.mongo ? 0.95 : 1); P.jumping = true; P.onGround = false; P.coyote = 0; P.buffer = 0; P.platform = null;
            if (P.mongo && ax) { P.vx = ax * max * 1.45; P.pounce = true; sfx('bite', { pitch: 1.4 }); }
            sfx('jump'); dust(cx(P), P.y + P.h, 2);
          }
        } else if (I.pressed('jump') && st.extraJump && P.airJumps > 0) {
          P.airJumps--; P.vy = -K.airJumpV; P.jumping = true; P.buffer = 0;
          sfx('jump', { pitch: 1.3 }); fxSprite('dust', cx(P), P.y + P.h, 0.25, { size: 6 }); debris(cx(P), P.y + P.h, 5, '#fcfcfc', 50);
        }
      }
    } else if (P.state === 'hurt') {
      P.vx = U.approach(P.vx, 0, K.airFriction * dt);
    }
    if (!control && P.state !== 'hurt' && P.state !== 'airkick' && I.pressed('bomb') && !P.mongo) bombButton(P, up);

    if (P.jumping && P.vy < 0 && !I.down('jump')) { P.vy *= K.jumpCut; P.jumping = false; }
    if (P.vy >= 0) P.jumping = false;
    if (P.state !== 'airkick') {
      var gm = P.vy > 0 ? K.fallGravMul : 1;
      P.vy = Math.min(P.vy + K.gravity * gm * dt, K.fallMax);
    }
    var wasGround = P.onGround, fallV = P.vy;
    moveBody(P, dt, P.dropT > 0);
    if (P.onGround) {
      P.coyote = K.coyote; P.airJumps = st.extraJump ? 1 : 0; P.pounce = false;
      if (!wasGround) {
        if (fallV > 160) { dust(cx(P), P.y + P.h, 3); sfx('land'); P.landT = 0.1; }
        if (P.state === 'airkick') { P.state = 'normal'; P.landT = 0.14; DCW.shake(1, 0.08); dust(cx(P), P.y + P.h, 4); }
      }
      if (Math.abs(P.vx) > 60 && P.state === 'normal') { P.runT += dt; if (P.runT > 0.22) { P.runT = 0; dust(cx(P) - P.face * 4, P.y + P.h, 1); } }
      if (S.kind === 'drop' && P.standTile >= 0) crumble(P.standTile);
    }
    afterMove(P, dt);
  }
  function bombButton(P, up) {
    // plant levels: bomb on the detonator with every charge set
    if (S.plant && !S.plant.detonated) {
      for (var i = 0; i < S.objects.length; i++) {
        var o = S.objects[i];
        if (o.kind === 'detonator' && overlap(P, { x: o.x - 4, y: o.y - 4, w: o.w + 8, h: o.h + 8 })) {
          if (S.plant.planted >= S.plant.need) { detonate(); return; }
          sfx('error'); numText(cx(o), o.y - 10, 'CHARGES ' + S.plant.planted + '/' + S.plant.need, '#f83800');
          return;
        }
      }
    }
    if (up) {
      if (S.esc && S.esc.fired >= 4) { dumpExplosives(P); return; }
      cycleX(P); return;
    }
    throwX(P);
  }
  function standingOnPassable(P) {
    if (P.platform) return true;
    var ty = Math.floor((P.y + P.h + 1) / TS), any = false;
    for (var tx = Math.floor((P.x + 0.5) / TS); tx <= Math.floor((P.x + P.w - 0.5) / TS); tx++) {
      var t = tileAt(tx, ty);
      if (isSolidT(t)) return false;
      if (t === T_ONEWAY || t === T_LADDER) any = true;
    }
    return any;
  }
  function updClimb(P, dt, ax) {
    var ay = I.axisY();
    P.vx = 0; P.vy = ay * K.climbSpeed;
    var tx = Math.floor(cx(P) / TS);
    if (P.buffer > 0) {
      P.state = 'normal'; P.buffer = 0;
      P.vy = I.down('down') ? 0 : -K.jumpV * 0.75; P.jumping = !I.down('down');
      P.vx = ax * K.runMax * 0.8; if (ax) P.face = ax;
      if (P.vy < 0) sfx('jump');
      return;
    }
    if (I.pressed('attack')) { P.state = 'normal'; startPunch(P, 0); return; }
    if (I.pressed('bomb') && !P.mongo) throwX(P);
    if (ay < 0) {
      var footTy = Math.floor((P.y + P.h + P.vy * dt - 1) / TS);
      if (tileAt(tx, footTy) !== T_LADDER) { P.y = (footTy + 1) * TS - P.h; P.vy = 0; P.state = 'normal'; P.onGround = true; return; }
      if (solidAt(cx(P), P.y + P.vy * dt)) P.vy = 0;
    } else if (ay > 0) {
      var nb = P.y + P.h + P.vy * dt, by = Math.floor(nb / TS);
      if (isSolidT(tileAt(tx, by)) || (tileAt(tx, by) === T_ONEWAY)) { P.y = by * TS - P.h; P.vy = 0; P.state = 'normal'; P.onGround = true; return; }
      if (tileAt(tx, by) !== T_LADDER && tileAt(tx, Math.floor((nb - P.h * 0.5) / TS)) !== T_LADDER) { P.state = 'normal'; return; }
    }
    P.y += P.vy * dt;
    if (ay) P.animT += dt * 0.5; else P.animT -= dt;
  }
  function updPlant(P, dt) {
    var o = P.plantObj;
    P.vx = 0; P.st += dt;
    P.vy = Math.min(P.vy + K.gravity * dt, K.fallMax);
    moveBody(P, dt, false);
    if (!o || o.planted || !I.down('up') || !overlap(P, { x: o.x - 4, y: o.y - 8, w: o.w + 8, h: o.h + 16 })) {
      P.state = 'normal'; if (o && !o.planted) o.prog = 0; return;
    }
    o.prog += dt;
    if (Math.random() < 0.25) part({ kind: 'px', x: cx(o) + U.rand(-3, 3), y: o.y + 4, vx: U.rand(-30, 30), vy: -U.rand(20, 60), grav: 300, life: 0.3, color: '#f8d878', size: 1 });
    if (o.prog >= K.plantTime) {
      o.planted = true; P.state = 'normal';
      var pl = S.plant || (S.plant = { need: 1, planted: 0 });
      pl.planted++;
      sfx('plant'); DCW.shake(1, 0.1);
      numText(cx(o), o.y - 10, 'PLANTED ' + pl.planted + '/' + pl.need, '#58f898');
      track('plant');
      if (pl.planted === pl.need) announce('ALL CHARGES SET', { color: '#58f898', time: 1.8, sub: 'GET TO THE DETONATOR. PRESS BOMB.' });
    }
  }
  function afterMove(P, dt) {
    var run = getRun();
    var x0 = Math.floor((P.x + 1) / TS), x1 = Math.floor((P.x + P.w - 1) / TS), y0 = Math.floor((P.y + 2) / TS), y1 = Math.floor((P.y + P.h + 0.5) / TS);
    var spike = false, liquid = false;
    for (var ty = y0; ty <= y1; ty++) for (var tx = x0; tx <= x1; tx++) {
      var t = tileAt(tx, ty);
      if (t === T_SPIKE && P.y + P.h > ty * TS + 6) spike = true;
      else if (t === T_LIQUID && P.y + P.h > ty * TS + 4) liquid = true;
    }
    if (spike && P.inv <= 0) { if (hurtPlayer(2, undefined, { kby: -280, cause: 'SPIKES' })) { P.vx *= 0.3; } else if (S.god) P.vy = Math.min(P.vy, -200); }
    if (liquid) {
      P.liqT -= dt;
      if (P.liqT <= 0) { P.liqT = 0.5; if (hurtPlayer(1, undefined, { knock: false, cause: 'HAZARD' })) { sfx('splash'); } P.inv = Math.min(P.inv, 0.45); }
      P.vx *= 0.92;
      if (P.vy > 70) P.vy = 70;
    } else P.liqT = 0;
    // pits (a climb kills you at the bottom of the screen)
    if (S.kind === 'climb' && P.y > S.cam.y + H + 8 && S.t > 0.5) { pitFall(); return; }
    if (P.y > S.L.pxH + 8) { pitFall(); return; }
    if (P.onGround && !P.platform && P.state === 'normal' && !spike && !liquid) {
      var fy = P.y + P.h + 1;
      if (safeAt(P.x - 2, fy) && safeAt(P.x + P.w + 2, fy) && !hazardNear(P)) S.lastSafe = { x: cx(P), y: P.y + P.h };
    }
    for (var i = 0; i < S.objects.length; i++) {
      var o = S.objects[i];
      if (o.kind === 'qitem' && !o.taken && overlap(P, o)) { collectItem(o); continue; }
      if (o.kind === 'ticket' && !o.taken && overlap(P, o)) { grabTicket(o); continue; }
      if (o.kind === 'checkpoint' && !o.on && overlap(P, o)) {
        o.on = true; S.checkpoint = { x: cx(o), y: o.y + o.h }; S.lastSafe = S.checkpoint;
        sfx('checkpoint'); fxSprite('sparkle', cx(o), o.y + 6, 0.4, { color: '#58f898', size: 10 });
        numText(cx(o), o.y - 8, 'CHECKPOINT', '#58f898');
      }
    }
    if (S.lockMsgT > 0) S.lockMsgT -= dt;
    // street edges: walk into the edge to leave the area
    if (S.mode === 'street' && !S.leaving && (P.state === 'normal' || P.state === 'hurt')) {
      var ax = I.axisX();
      if (P.x <= 0.5 && ax < 0) tryEdge('left');
      else if (P.x + P.w >= S.L.pxW - 0.5 && ax > 0) tryEdge('right');
    }
    if (P.x < 0) P.x = 0;
    if (P.x + P.w > S.L.pxW) P.x = S.L.pxW - P.w;
    if (S.locked && S.arena) { if (P.x < S.arena.x0 + TS) { P.x = S.arena.x0 + TS; if (P.vx < 0) P.vx = 0; } }
    if (S.chase && !S.chase.arrived && P.x < S.cam.x + 2) { P.x = S.cam.x + 2; if (P.vx < 0) P.vx = 0; }
    var mx = stats().maxHp;
    if (run.hp > mx) run.hp = mx;
  }
  function safeAt(px, py) { var t = tileAt(Math.floor(px / TS), Math.floor(py / TS)); return t === T_SOLID || t === T_ALT || (t === T_ONEWAY && S.kind !== 'drop'); }
  function hazardNear(P) {
    var ty = Math.floor((P.y + P.h + 1) / TS);
    for (var tx = Math.floor(P.x / TS) - 1; tx <= Math.floor((P.x + P.w) / TS) + 1; tx++) {
      var t = tileAt(tx, ty), t2 = tileAt(tx, ty - 1);
      if (t === T_SPIKE || t === T_LIQUID || t2 === T_SPIKE || t2 === T_LIQUID) return true;
    }
    return false;
  }
  function pitFall() {
    var P = S.player, run = getRun();
    if (P.state === 'pit' || P.state === 'dead') return;
    track('fall');
    sfx('hurt');
    setCrouch(P, false);
    if (!S.god) { applyDamage(K.pitDamage); S.damageTaken += K.pitDamage; }
    S.combo = 0;
    if (run.hp <= 0) { P.y = Math.min(P.y, S.L.pxH - 4); killPlayer('FELL'); return; }
    P.state = 'pit'; P.st = 0.55; P.vx = 0; P.vy = 0;
    numText(cx(P), S.cam.y + H - 20, '-' + K.pitDamage, '#f83800');
  }
  function respawnFromPit() {
    var P = S.player, sp = S.lastSafe || S.checkpoint || S.start;
    if (S.chase && !S.chase.arrived && sp.x < S.cam.x + 48) {
      var nx = S.cam.x + 64;
      for (var k = 0; k < 20; k++, nx += 16) { var gy = streetGround(nx); if (safeAt(nx, gy + 1)) { sp = { x: nx, y: gy }; break; } }
    }
    setCrouch(P, false);
    P.x = sp.x - P.w / 2; P.y = sp.y - P.h; P.vx = 0; P.vy = 0;
    P.state = 'normal'; P.inv = K.pitIframes; P.platform = null; P.onGround = false;
    smoke(cx(P), cy(P), 4);
    sfx('spawn');
    if (S.vertical) updCamera(0, true);
  }

  /* ---------------- interactions ---------------- */
  var INTERACT = { sign: 1, door: 1, sdoor: 1, npc: 1, signpost: 1, charge: 1, decoySpot: 1 };
  function interactAt(P) {
    for (var i = 0; i < S.objects.length; i++) {
      var o = S.objects[i];
      if (!INTERACT[o.kind]) continue;
      if (o.kind === 'sdoor' && !(o.st && o.st.visible)) continue;
      if (o.kind === 'npc' && !o.visible) continue;
      if (o.kind === 'charge' && o.planted) continue;
      if (o.kind === 'decoySpot' && o.used) continue;
      if (P.x < o.x + o.w + 2 && P.x + P.w > o.x - 2 && P.y < o.y + o.h && P.y + P.h > o.y - 4) return o;
    }
    return null;
  }
  function interact(o) {
    var P = S.player;
    switch (o.kind) {
      case 'sign': readSign(o); return false;
      case 'door': enterDoor(o); return true;
      case 'sdoor': useStreetDoor(o); return true;
      case 'npc': talkNpc(o); return true;
      case 'signpost': readSignpost(o); return false;
      case 'charge': if (P.onGround) { P.state = 'plant'; P.st = 0; P.plantObj = o; P.vx = 0; o.prog = 0; sfx('fuse'); return true; } return false;
      case 'decoySpot': o.used = true; dropDecoy(o); return false;
    }
    return false;
  }
  function readSign(o) {
    var signs = S.def.signs || [];
    var txt = signs[o.idx] || signs[signs.length - 1] || 'THIS SIGN HAS BEEN DEFACED. THE AI APOLOGIZES FOR NOTHING.';
    sfx('text_blip');
    if (!say(txt)) toast(txt, { time: 3 });
  }
  function readSignpost(o) {
    o.on = true;
    if (S.areaId) setFlag('map_' + S.areaId);
    sfx('unlock');
    toast(S.def.signpostText || 'THE ROCK HUMS AND PROJECTS A MAP. ESCAPE PLAN UPDATED.', { title: 'SIGNPOST', icon: 'map', color: '#58f898', time: 3 });
    track('signpost');
  }
  function talkNpc(o) {
    var n = o.npc || {};
    sfx('text_blip');
    if (S.mode === 'level' && n.lines && n.lines.length) {
      var who = n.name || String(n.id || '???').toUpperCase().replace(/_/g, ' ');
      say(n.lines.map(function (l) { return typeof l === 'string' ? { who: who, portrait: n.portrait || ('p_' + n.id), text: l } : l; }));
      return;
    }
    if (has(G(), 'talk')) { saveStreetPos(); call(G(), 'talk', n.id); return; }
    if (n.lines) say(n.lines);
  }
  function enterDoor(o) {
    var P = S.player;
    if (S.done || P.state === 'victory') return;
    if (S.isBoss && S.boss && !S.boss.dead) { numText(cx(o), o.y - 6, 'LOCKED', '#f83800'); sfx('error'); return; }
    if (S.plant && !S.plant.detonated) { if (!(S.lockMsgT > 0)) { S.lockMsgT = 2; sfx('error'); numText(cx(o), o.y - 6, 'NOT DONE HERE', '#f83800'); } return; }
    if (o.needs && !hasItem(o.needs)) {
      if (!(S.lockMsgT > 0)) {
        S.lockMsgT = 2.5;
        sfx('error'); numText(cx(o), o.y - 6, 'LOCKED', '#f83800');
        var q = itemDef(o.needs) || {};
        toast('EXIT LOCKED. NEEDS: ' + itemName(o.needs), { title: 'PADLOCKED', icon: 'lock', color: '#f83800', time: 3.5, sub: q.hint || '' });
      }
      return;
    }
    o.open = true;
    P.x = cx(o) - P.w / 2; P.vx = 0;
    startVictory('door');
  }
  function startVictory(kind) {
    var P = S.player;
    if (S.done) return;
    setCrouch(P, false);
    P.state = 'victory'; P.st = 0; P.inv = 99; P.vx = 0;
    S.done = true; S.endKind = kind; S.endT = kind === 'boss' ? 1.2 : 1.6;
    if (kind === 'door') sfx('door');
    music(null);
  }
  function finishStage() {
    if (S.clearedSent || S.mode !== 'level') return;
    S.clearedSent = true;
    var res = { levelId: S.id, stageId: S.id, kills: S.kills, time: Math.round(S.t * 10) / 10, damageTaken: S.damageTaken, maxCombo: S.maxCombo,
      views: S.views, gold: S.gold, secrets: S.secrets, kind: S.kind };
    if (S.boss) res.boss = S.boss.id;
    getRun().hp = Math.max(1, getRun().hp);
    if (has(G(), 'levelCleared')) call(G(), 'levelCleared', res);
    else if (has(G(), 'stageCleared')) call(G(), 'stageCleared', res);
    else S.fallbackMsg = 'LEVEL CLEAR';
  }

  /* ================================================================
     PARTY: Donut (shoulder caster), Mongo (runs alongside), Katia (shield)
     ================================================================ */
  function makeCompanion(id, x, feetY) {
    if (id === 'donut') return { id: 'donut', kind: 'donut', cd: 1.0, castT: 0, t: 0, x: x, y: feetY - 22, w: 10, h: 10 };
    if (id === 'mongo') {
      var big = !!stats().mongoBig;
      return { id: 'mongo', kind: 'mongo', big: big, x: x - 6, y: feetY - (big ? 16 : 10), w: big ? 16 : 12, h: big ? 16 : 10, vx: 0, vy: 0, face: 1, onGround: false,
        cd: 1, actT: 0, state: 'follow', stuckT: 0, target: null, t: 0, stunT: 0, heldT: 0, hitCd: 0, dt: 0 };
    }
    if (id === 'katia') return { id: 'katia', kind: 'katia', x: x - 6, y: feetY - 20, w: 12, h: 20, vx: 0, vy: 0, face: 1, onGround: false, cd: 2, actT: 0, state: 'follow', stuckT: 0, t: 0 };
    return null;
  }
  function setupParty() {
    S.party = {};
    if (S.swap) return;
    var P = S.player;
    partyList().forEach(function (id) { var c = makeCompanion(id, cx(P) - 16, P.y + P.h); if (c) S.party[id] = c; });
  }
  // a hostile target worth shooting at. opts: forBite (skip ghosts without Fang Caps)
  function targetable(e, forBite) {
    if (e.dead || !e.active || e.state === 'gone' || e.citizen || e.ai === 'guard') return false;
    if (!e.hostile && !e.isBody) return false;
    if (forBite && e.magicOnly && !stats().fangCaps) return false;
    return true;
  }
  function nearestEnemy(x, y, maxD, needScreen, forBite) {
    var best = null, bd = maxD * maxD;
    for (var i = 0; i < S.enemies.length; i++) {
      var e = S.enemies[i];
      if (!targetable(e, forBite) || (needScreen && !onScreen(e, 8))) continue;
      var dx = cx(e) - x, dy = cy(e) - y, d = dx * dx + dy * dy;
      if (d < bd) { bd = d; best = e; }
    }
    var B = S.boss;
    if (bossHittable(B)) {
      var rs = bossRects(B);
      for (var k = 0; k < rs.length; k++) { var bx = cx(rs[k]) - x, by = cy(rs[k]) - y, d2 = bx * bx + by * by; if (d2 < bd) { bd = d2; best = B; } }
    }
    return best;
  }
  function aimPoint(tg) {
    if (tg && tg.isBoss && tg.facade) { var rs = bossRects(tg); return rs.length ? { x: cx(rs[0]), y: cy(rs[0]) } : null; }
    return tg ? { x: cx(tg), y: cy(tg) } : null;
  }
  function teleportComp(C, P, off) {
    smoke(cx(C), cy(C), 2);
    C.x = cx(P) - P.face * (off || 16) - C.w / 2; C.y = P.y + P.h - C.h - 2; C.vx = 0; C.vy = 0; C.stuckT = 0; C.state = 'follow';
    smoke(cx(C), cy(C), 2);
  }
  function followPhys(C, dt, off, maxSp) {
    var P = S.player;
    if (C.state === 'follow') {
      var tx = cx(P) - P.face * off, dx = tx - cx(C);
      if (Math.abs(dx) > 5) C.vx = U.approach(C.vx, U.sign(dx) * Math.min(maxSp, 30 + Math.abs(dx) * 3.2), 700 * dt);
      else C.vx = U.approach(C.vx, 0, 700 * dt);
      C.face = Math.abs(dx) > 3 ? U.sign(dx) : P.face;
      if (C.onGround && ((C.hitWall && Math.abs(dx) > 8) || (P.y + P.h < C.y + C.h - 18 && Math.abs(dx) < 56 && P.onGround))) { C.vy = -310; C.onGround = false; }
    }
    C.vy = Math.min(C.vy + K.gravity * dt, K.fallMax);
    var wasG = C.onGround;
    moveBody(C, dt, P.dropT > 0 && cy(C) < cy(P) + 8);
    if (!wasG && C.onGround && Math.random() < 0.3) dust(cx(C), C.y + C.h, 1);
    var ddx = cx(P) - cx(C), ddy = cy(P) - cy(C);
    if (Math.abs(ddx) > 40 && Math.abs(C.vx) < 5 && C.state === 'follow') C.stuckT += dt; else C.stuckT = Math.max(0, C.stuckT - dt);
    if (ddx * ddx + ddy * ddy > 180 * 180 || C.y > S.L.pxH || C.stuckT > 1.2 || (S.kind === 'climb' && C.y > S.cam.y + H)) teleportComp(C, P, off);
  }
  function updDonut(C, dt) {
    var P = S.player;
    C.t += dt; C.castT -= dt;
    C.x = cx(P) - P.face * 5 - 5; C.y = P.y + P.h - (P.crouch ? 18 : 26);
    if (P.state === 'dead' || P.state === 'pit' || S.noMagic) return;
    C.cd -= dt;
    if (C.cd <= 0) {
      var e = nearestEnemy(cx(P), cy(P), K.missileRange, true);
      if (e) { fireMissile(C.x + 5, C.y, e, Math.max(1, Math.round(num(stats().missileDmg, 4))), P.face); C.castT = 0.3; C.cd = K.missileEvery; }
      else C.cd = 0.25;
    }
  }
  function updMongo(C, dt) {
    var P = S.player, st = stats();
    C.t += dt; C.actT -= dt; C.hitCd -= dt;
    if (!!st.mongoBig !== C.big) { var feet = C.y + C.h; C.big = !!st.mongoBig; C.w = C.big ? 16 : 12; C.h = C.big ? 16 : 10; C.y = feet - C.h; }
    if (C.heldT > 0) {
      C.heldT -= dt;
      var B = S.boss;
      if (B && !B.dead && !B.dying) { C.x = cx(B) + B.face * (B.w / 2 + 8) - C.w / 2; C.y = B.y + 6; C.vx = 0; C.vy = 0; C.face = -B.face; }
      if (C.heldT <= 0 || !B || B.dead || B.dying) { C.heldT = 0; teleportComp(C, P, 18); numText(cx(C), C.y - 8, 'MONGO BROKE FREE!', '#58d854'); sfx('bite'); }
      return;
    }
    if (P.state === 'dead' || P.state === 'pit') { C.vx = 0; return; }
    if (C.stunT > 0) {
      C.stunT -= dt; C.state = 'follow';
      C.vx = U.approach(C.vx, 0, 400 * dt); C.vy = Math.min(C.vy + K.gravity * dt, K.fallMax); moveBody(C, dt, false);
      if (C.y > S.L.pxH) teleportComp(C, P, 18);
      return;
    }
    var power = Math.max(1, Math.round(num(st.biteDmg, 6)));
    if (C.state === 'dash') {
      C.dt -= dt;
      var tg = C.target;
      if (!tg || tg.dead || tg.state === 'gone' || C.dt <= 0) C.state = 'follow';
      else {
        var ap = aimPoint(tg) || { x: cx(tg), y: cy(tg) };
        var dir = U.sign(ap.x - cx(C)) || C.face; C.face = dir;
        C.vx = dir * (C.big ? 250 : 230);
        var reach = { x: C.x - 4, y: C.y - (C.big ? 14 : 8), w: C.w + 8, h: C.h + (C.big ? 18 : 12) };
        var hit = tg.isBoss ? bossRectHit(tg, reach) : (overlap(reach, tg) ? tg : null);
        if (hit) {
          damageActor(tg, power, { kind: 'bite', kb: C.big ? 140 : 90, dir: dir, hitX: hit.x !== undefined ? cx(hit) : undefined });
          sfx('bite');
          C.state = 'follow'; C.vx = -dir * 80; C.vy = -150; C.actT = 0.25;
        }
      }
    }
    followPhys(C, dt, 18, C.big ? 170 : 150);
    C.cd -= dt;
    if (C.cd <= 0) {
      var b = nearestEnemy(cx(C), cy(C), C.big ? 110 : 90, true, true), used = false;
      if (b) { C.state = 'dash'; C.target = b; C.dt = 0.6; C.actT = 0.3; used = true; }
      C.cd = used ? K.mongoCd : 0.25;
    }
  }
  function stunMongo(C, srcX) {
    if (!C || C.stunT > 0 || C.hitCd > 0 || C.heldT > 0) return;
    C.stunT = 1.4; C.hitCd = 2.6; C.vy = -150; C.vx = (srcX !== undefined && cx(C) < srcX ? -1 : 1) * 90; C.onGround = false; C.state = 'follow';
    numText(cx(C), C.y - 6, 'YELP!', '#fcfcfc'); sfx('hurt', { pitch: 1.7, vol: 0.6 });
  }
  function stunPartyNear(x, y, r) { var M = S.party.mongo; if (M && dist(cx(M), cy(M), x, y) < r) stunMongo(M, x); }
  function updKatia(C, dt) {
    var P = S.player;
    C.t += dt; C.actT -= dt;
    if (P.state === 'dead' || P.state === 'pit') { C.vx = 0; return; }
    followPhys(C, dt, 32, 150);
    C.cd -= dt;
    if (C.cd <= 0) {
      if (P.shield <= 0) { P.shield = 1; sfx('shield'); C.actT = 0.5; numText(cx(P), P.y - 8, 'SHIELD', '#9878f8'); }
      C.cd = K.katiaCd;
    }
    for (var i = S.eproj.length - 1; i >= 0; i--) {
      var p = S.eproj[i];
      if (overlap({ x: C.x - 3, y: C.y - 2, w: C.w + 6, h: C.h + 4 }, p)) { S.eproj.splice(i, 1); sfx('block', { vol: 0.6 }); debris(cx(p), cy(p), 6, '#9878f8', 90); C.actT = 0.3; }
    }
  }
  function updParty(dt) {
    if (S.party.donut) updDonut(S.party.donut, dt);
    if (S.party.mongo) updMongo(S.party.mongo, dt);
    if (S.party.katia) updKatia(S.party.katia, dt);
  }
  function fireMissile(x, y, target, dmg, face) {
    S.pproj.push({ kind: 'missile', x: x - 3, y: y - 3, w: 6, h: 6, vx: (face || 1) * 40, vy: -110, target: target, life: 2.6, dmg: dmg, t: 0 });
    sfx('missile');
  }
  function updMissile(p, i, dt) {
    p.t += dt; p.life -= dt;
    var tg = p.target;
    if (!tg || tg.dead || tg.state === 'gone' || (tg.isBoss && !bossHittable(tg))) tg = p.target = (p.t > 0.15 ? nearestEnemy(cx(p), cy(p), 220, true) : null);
    var ap = aimPoint(tg);
    if (tg && ap && p.t > 0.12) {
      var dx = ap.x - cx(p), dy = ap.y - cy(p), d = Math.sqrt(dx * dx + dy * dy) || 1, sp = 210;
      var k = Math.min(1, 7 * dt);
      p.vx += (dx / d * sp - p.vx) * k; p.vy += (dy / d * sp - p.vy) * k;
    } else if (!tg) p.vy += 60 * dt;
    p.x += p.vx * dt; p.y += p.vy * dt;
    if (S.frameParity) part({ kind: 'px', x: cx(p), y: cy(p), life: 0.2, color: '#f878f8', size: 1 });
    var hit = null, hitR = null;
    for (var m = 0; m < S.enemies.length; m++) { var en = S.enemies[m]; if (targetable(en) && overlap(p, en)) { hit = en; break; } }
    if (!hit && bossHittable(S.boss)) { hitR = bossRectHit(S.boss, p); if (hitR) hit = S.boss; }
    if (hit) { damageActor(hit, p.dmg, { kind: 'missile', kb: 60, dir: U.sign(p.vx) || 1, hitX: hitR ? cx(hitR) : undefined }); S.pproj.splice(i, 1); return; }
    if (p.life <= 0 || solidAt(cx(p), cy(p))) { fxSprite('sparkle', cx(p), cy(p) + 4, 0.2, { color: '#f878f8', size: 5 }); S.pproj.splice(i, 1); }
  }

  /* ---------------- allies: Second Chance risen, Boomy Boys, decoys ---------------- */
  function raiseAlly(e) {
    var a = { kind: 'risen', id: e.id, sprite: e.sprite, objSprite: e.objSprite, x: e.x, y: e.y, w: e.w, h: e.h, vx: 0, vy: e.flying ? 0 : -140, face: e.face,
      flying: e.flying, life: K.riseTime, t: 0, hitCd: 0.4, dmg: Math.max(2, Math.round(num(stats().missileDmg, 4) * 0.8)), speed: Math.max(45, num(e.def.speed, 30) * 1.4), onGround: false };
    S.allies.push(a);
    numText(cx(e), e.y - 16, 'SECOND CHANCE!', '#58f898');
    sfx('spawn', { pitch: 1.4 }); fxSprite('sparkle', cx(e), cy(e), 0.5, { color: '#58f898', size: 12 });
    if (S.party.donut) S.party.donut.castT = 0.5;
    track('second_chance');
  }
  function dropDecoy(o) {
    var fy = o.y + o.h;
    S.allies.push({ kind: 'decoy', x: cx(o) - 7, y: fy - 12, w: 14, h: 12, life: K.decoyLife, t: 0, vx: 0, vy: 0 });
    sfx('clockwork'); numText(cx(o), o.y - 10, 'DECOY SET', '#f8d878');
    track('decoy');
  }
  function updAllies(dt) {
    var i;
    if (S.missileQueue && S.missileQueue.length) {
      var Dn = S.party.donut, P = S.player;
      for (var q = S.missileQueue.length - 1; q >= 0; q--) {
        var m = S.missileQueue[q]; m.at -= dt;
        if (m.at <= 0) {
          var ox = Dn ? Dn.x + 5 : cx(P), oy = Dn ? Dn.y : P.y;
          var tg = m.target && !m.target.dead ? m.target : nearestEnemy(ox, oy, 300, true);
          fireMissile(ox + U.rand(-6, 6), oy - 4, tg, m.dmg, U.chance(0.5) ? 1 : -1);
          S.missileQueue.splice(q, 1);
        }
      }
    }
    for (i = S.allies.length - 1; i >= 0; i--) {
      var a = S.allies[i];
      a.t += dt;
      if (a.delay > 0) { a.delay -= dt; continue; }
      a.life -= dt;
      if (a.kind === 'risen') {
        var t2 = nearestEnemy(cx(a), cy(a), 220, false);
        var ap = aimPoint(t2);
        if (a.flying) {
          if (ap) { a.vx = U.approach(a.vx, U.clamp((ap.x - cx(a)) * 3, -a.speed, a.speed), 300 * dt); a.vy = U.approach(a.vy, U.clamp((ap.y - cy(a)) * 3, -a.speed, a.speed), 300 * dt); }
          else { a.vx *= 0.95; a.vy = Math.sin(a.t * 3) * 10; }
          a.x += a.vx * dt; a.y += a.vy * dt;
        } else {
          if (ap) { a.face = U.sign(ap.x - cx(a)) || a.face; a.vx = U.approach(a.vx, a.face * a.speed, 500 * dt); }
          else a.vx = U.approach(a.vx, 0, 400 * dt);
          a.vy = Math.min(a.vy + K.gravity * dt, K.fallMax);
          moveBody(a, dt, false);
          if (a.hitWall && a.onGround) a.vy = -260;
        }
        a.hitCd -= dt;
        if (t2 && a.hitCd <= 0) {
          var box = { x: a.x - 3, y: a.y - 3, w: a.w + 6, h: a.h + 6 };
          var hitIt = t2.isBoss ? bossRectHit(t2, box) : (overlap(box, t2) ? t2 : null);
          if (hitIt) { damageActor(t2, a.dmg, { kind: 'ally', kb: 90, dir: U.sign(cx(t2) - cx(a)) || 1, hitX: cx(hitIt) }); a.hitCd = 0.5; }
        }
        if (a.life <= 0 || a.y > S.L.pxH) { smoke(cx(a), cy(a), 3); S.allies.splice(i, 1); }
        continue;
      }
      if (a.kind === 'boomy') {
        a.vy = Math.min(a.vy + K.gravity * dt, K.fallMax);
        var vx = a.vx;
        moveBody(a, dt, false);
        if (a.hitWall && a.onGround && !a.hopped) { a.vy = -280; a.hopped = true; a.vx = vx; } else a.vx = vx;
        if (a.onGround) a.hopped = false;
        if (Math.random() < 0.4) dust(cx(a) - a.face * 5, a.y + a.h, 1);
        var boom = a.life <= 0 || a.y > S.L.pxH;
        for (var j = 0; j < S.enemies.length && !boom; j++) if (targetable(S.enemies[j]) && overlap(a, S.enemies[j])) boom = true;
        var B = S.boss;
        if (!boom && bossHittable(B)) boom = B.facade ? (a.x + a.w > B.x + 8 && a.x < B.x + B.w - 8 && a.y < B.y + B.h + 12 && Math.abs(cx(a) - cx(B)) < B.w * 0.3) : overlap(a, B);
        if (boom) { S.allies.splice(i, 1); if (a.y <= S.L.pxH) explode(cx(a), cy(a), K.dynR, num(stats().dynDmg, 25), true, 'boomy', { noSelf: true }); }
        continue;
      }
      if (a.kind === 'decoy') {
        a.vy = Math.min(a.vy + K.gravity * dt, K.fallMax); moveBody(a, dt, false);
        if (a.life <= 0) { addCloud(cx(a), a.y, 30, 3); S.allies.splice(i, 1); }
        continue;
      }
      if (a.life <= 0) S.allies.splice(i, 1);
    }
  }

  /* ================================================================
     ENEMIES
     ================================================================ */
  var AI_COLORS = { walker: '#ac7c00', chaser: '#d82800', jumper: '#00a800', flyer: '#6844fc', shooter: '#0078f8', charger: '#a81000', turret: '#787878', spawner: '#881400',
    bomber: '#e45c10', hopper: '#008888', perch: '#d82800', stilt: '#fcfcfc', launcher: '#ac7c00', urchin: '#503000', floater: '#f878f8', berserker: '#7c7c7c',
    caster: '#0058f8', krasue: '#f8b8f8', swarm: '#9c9c9c', charm: '#e40058', guard: '#bcbcbc', citizen: '#f0d0b0', kbody: '#fca044', crawler: '#f8b8f8' };
  var BUILTIN = {
    worm: { name: 'PARASITE WORM', hp: 1, dmg: 1, speed: 46, w: 10, h: 5, ai: 'crawler', xp: 0, gold: [0, 0], sprite: 'worm', objSprite: 'worm', views: 2 },
    guard: { name: 'VILLAGE GUARD SWORDSMAN', hp: 999, dmg: 999, speed: 34, w: 14, h: 30, ai: 'guard', xp: 0, gold: [0, 0], sprite: 'guard' },
    krasue_body: { name: 'HEADLESS BODY', hp: 14, dmg: 0, speed: 0, w: 14, h: 20, ai: 'kbody', xp: 0, gold: [3, 6], sprite: 'krasue_body', objSprite: 'krasue_body' },
    citizen_human: { name: 'CITIZEN', hp: 1, dmg: 0, speed: 22, w: 10, h: 20, ai: 'citizen', citizen: true, xp: 0, gold: [0, 0], sprite: 'citizen_human' }
  };
  function enemyDef(id) {
    if (S && S.edefs && S.edefs[id]) return S.edefs[id];
    var data = D(), d = (data.enemies || {})[id] || BUILTIN[id];
    if (!d) d = { name: String(id).toUpperCase().replace(/_/g, ' '), hp: 4, dmg: 1, speed: 30, w: 12, h: 12, ai: 'walker', xp: 2, gold: [0, 2], sprite: id };
    if (S) { S.edefs = S.edefs || {}; S.edefs[id] = d; }
    return d;
  }
  function makeEnemy(id, fx, fy, elite, flyerSlot) {
    var d = enemyDef(id);
    var ai = d.ai || 'walker';
    var sname = d.objSprite || ((d.sprite || id) + '_walk');
    var ai0 = hasArt(sname) ? artInfo(sname) : null, okInfo = ai0 && !ai0.missing;
    var w = num(d.w, okInfo ? Math.max(8, ai0.w - 4) : 12), h = num(d.h, okInfo ? Math.max(6, ai0.h - 1) : 12);
    var flying = ai === 'flyer' || ai === 'floater' || ai === 'krasue' || ai === 'swarm' || !!d.flying;
    var hp = Math.max(1, Math.round(num(d.hp, 3) * (elite ? 1.6 : 1)));
    var neutral = !!d.neutral || (ai === 'urchin' && d.neutral !== false);
    var citizen = !!d.citizen || ai === 'citizen';
    var e = {
      id: id, def: d, ai: ai, elite: !!elite, x: fx - w / 2, y: flying ? fy - TS / 2 - h / 2 : fy - h, w: w, h: h, vx: 0, vy: 0,
      hp: hp, maxHp: hp, face: Math.random() < 0.5 ? -1 : 1, flying: flying, baseSpeed: num(d.speed, 30), speed: num(d.speed, 30),
      baseDmg: num(d.dmg, 1) + (elite ? 1 : 0), dmg: num(d.dmg, 1) + (elite ? 1 : 0),
      aggro: num(d.aggro, 96), st: 0, timer: 0.5 + Math.random(), state: 'patrol', flash: 0, stun: 0, hurtT: 0, active: false,
      onGround: false, baseY: 0, t: Math.random() * 6, kids: 0, sprite: d.sprite || id, objSprite: d.objSprite || null, color: AI_COLORS[ai] || '#ac7c00', tele: 0,
      hostile: !neutral && !citizen && ai !== 'kbody', citizen: citizen, magicOnly: !!d.magicOnly, fearImmune: !!d.fearImmune,
      darkMul: num(d.darkMul, 0), regrow: !!d.regrow, isBody: ai === 'kbody', lostT: 0, invuln: ai === 'guard'
    };
    e.baseY = e.y;
    if (flyerSlot && !flying) e.y = fy - h;
    if (ai === 'urchin') S.hasUrchins = true;
    return e;
  }
  function spawnEnemy(id, x, feetY, opts) {
    var e = makeEnemy(id, x, feetY, false, false);
    if (opts) for (var k in opts) e[k] = opts[k];
    e.active = true;
    S.enemies.push(e);
    smoke(cx(e), cy(e), 2);
    return e;
  }
  function projDef(id) {
    var p = (D().projectiles || {})[id];
    return p || { sprite: id, w: 6, h: 6, speed: 130, dmg: 1, gravity: 0, life: 3 };
  }
  function fireProj(id, x, y, tx, ty, opts) {
    opts = opts || {};
    var pd = projDef(id);
    var speed = num(opts.speed, num(pd.speed, 130)), grav = num(pd.gravity, 0);
    var w = num(pd.w, 6), h = num(pd.h, 6);
    var p = { id: id, sprite: pd.sprite || id, x: x - w / 2, y: y - h / 2, w: w, h: h, vx: 0, vy: 0, grav: grav, life: num(pd.life, 3), dmg: num(opts.dmg, num(pd.dmg, 1)), t: 0, ghost: !!opts.ghost, charm: opts.charm || 0, color: opts.color };
    if (opts.lob) {
      var g = grav > 0 ? grav : 420; p.grav = g;
      var T = U.clamp(Math.abs(tx - x) / 110, 0.55, 1.3);
      p.vx = (tx - x) / T; p.vy = (ty - y - 0.5 * g * T * T) / T;
    } else if (opts.angle !== undefined) {
      p.vx = Math.cos(opts.angle) * speed; p.vy = Math.sin(opts.angle) * speed;
    } else {
      var dx = tx - x, dy = ty - y, d = Math.sqrt(dx * dx + dy * dy) || 1;
      p.vx = dx / d * speed; p.vy = dy / d * speed;
      if (grav > 0) p.vy -= grav * 0.25;
    }
    if (opts.vx !== undefined) p.vx = opts.vx;
    if (opts.vy !== undefined) p.vy = opts.vy;
    S.eproj.push(p);
    return p;
  }
  function updEnemies(dt) {
    var P = S.player, camL = S.cam.x - K.updateMargin, camR = S.cam.x + W + K.updateMargin, camT = S.cam.y - H, camB = S.cam.y + H * 2;
    var pcx = cx(P), pcy = cy(P), M = S.party.mongo;
    for (var i = S.enemies.length - 1; i >= 0; i--) {
      var e = S.enemies[i];
      if (e.dead) { S.enemies.splice(i, 1); continue; }
      var far = e.x + e.w < camL || e.x > camR || (S.vertical && (e.y + e.h < camT || e.y > camB));
      if (far && !e.alwaysActive) { e.active = false; continue; }
      e.active = true;
      e.t += dt;
      if (e.flash > 0) e.flash -= dt;
      if (e.lostT > 0) e.lostT -= dt;
      if (e.life !== undefined) { e.life -= dt; if (e.life <= 0) { e.dead = true; smoke(cx(e), cy(e), 1); continue; } }
      e.inDark = e.darkMul > 1 && isDarkAt(cx(e), cy(e));
      var mul = e.inDark ? e.darkMul : 1;
      e.speed = e.baseSpeed * Math.min(mul, 2.5); e.dmg = Math.round(e.baseDmg * mul);
      var vis = onScreen(e, 24);
      var dx = pcx - cx(e), dy = pcy - cy(e), adx = Math.abs(dx);
      e.blind = e.lostT > 0 || P.state === 'dead';
      var near = vis && !e.blind && e.hostile && adx < e.aggro && Math.abs(dy) < (S.vertical ? 96 : 72);
      var harmless = !e.hostile || e.isBody || e.citizen;
      if (e.state === 'gone') { AI.krasue(e, dt, dx, dy, adx, false, vis); continue; }
      if (e.stun > 0) {
        e.stun -= dt; harmless = true;
        if (!e.flying) { e.vx = U.approach(e.vx, 0, 600 * dt); e.vy = Math.min(e.vy + K.gravity * dt, K.fallMax); moveBody(e, dt, false); }
        else { e.vx *= 0.9; e.vy *= 0.9; e.x += e.vx * dt; e.y += e.vy * dt; }
        if (Math.random() < 0.05) fxSprite('sparkle', cx(e), e.y, 0.25, { color: '#3cbcfc', size: 4 });
      } else if (e.hurtT > 0) {
        e.hurtT -= dt; harmless = true;
        if (e.flying) { e.x += e.vx * dt; e.y += e.vy * dt; e.vx *= 0.9; e.vy *= 0.9; }
        else { e.vx = U.approach(e.vx, 0, 500 * dt); e.vy = Math.min(e.vy + K.gravity * dt, K.fallMax); moveBody(e, dt, false); }
      } else {
        (AI[e.ai] || AI.walker)(e, dt, dx, dy, adx, near, vis);
      }
      if (e.y > S.L.pxH + 32) { if (e.lastHit !== undefined && S.t - e.lastHit < 2) killEnemy(e, { kind: 'pit' }); e.dead = true; continue; }
      if (e.flying) e.y = U.clamp(e.y, -8, S.L.pxH - e.h - 4);
      if (!e.dead && e.state !== 'gone' && P.state !== 'dead' && P.state !== 'pit' && overlap(P, e)) playerTouches(e, harmless);
      if (M && !harmless && !e.dead && overlap(M, e)) stunMongo(M, cx(e));
    }
  }
  function playerTouches(e, harmless) {
    var P = S.player;
    if (e.citizen) return; // walk through the crowd; only deliberate hits are crimes
    if (P.vy > 20 && P.prevBottom <= e.y + Math.max(7, P.vy / 60 + 4) && P.state !== 'airkick') {
      var st = stats(), r = rollCrit(P.mongo ? num(st.biteDmg, 6) : st.kickDmg);
      damageActor(e, r.dmg, { kind: P.mongo ? 'bite' : 'stomp', kb: 40, crit: r.crit, dir: P.face });
      P.vy = -(I.down('jump') ? K.stompBounceHeld : K.stompBounce); P.jumping = I.down('jump'); P.onGround = false;
      P.airJumps = st.extraJump ? 1 : 0; P.inv = Math.max(P.inv, 0.08);
      P.y = e.y - P.h - 1;
      sfx('stomp'); track('stomp'); DCW.freeze(r.crit ? 5 : 3);
      return;
    }
    if (P.state === 'airkick' || harmless) return;
    var guard = e.ai === 'guard';
    hurtPlayer(guard ? 999 : e.dmg, cx(e), { cause: guard ? 'guard' : (e.def.name || e.id), raw: guard });
    if (e.ai === 'krasue' || e.ai === 'swarm') e.atkCd = 1.3;
  }
  function patrol(e, dt, speed) {
    if (e.onGround && !groundAhead(e)) e.face = -e.face;
    e.vx = e.face * speed;
  }
  function gravMove(e, dt) {
    e.vy = Math.min(e.vy + K.gravity * dt, K.fallMax);
    moveBody(e, dt, false);
    if (e.hitWall) e.face = -e.hitWall;
  }
  function throwKnife(e) {
    var P = S.player;
    fireProj(e.def.projectile || 'knife', cx(e) + e.face * 6, e.y + e.h * 0.4, cx(P), cy(P));
    sfx('bomb_throw', { pitch: 1.6, vol: 0.5 });
  }
  function flyToward(e, tx, ty, sp, acc, dt) {
    var ddx = tx - cx(e), ddy = ty - cy(e), d = Math.sqrt(ddx * ddx + ddy * ddy) || 1, s = Math.min(sp, d * 4);
    e.vx = U.approach(e.vx, ddx / d * s, acc * dt); e.vy = U.approach(e.vy, ddy / d * s, acc * dt);
    e.x += e.vx * dt; e.y += e.vy * dt;
    if (solidAt(cx(e) + U.sign(e.vx) * e.w / 2, cy(e))) { e.x -= e.vx * dt; e.vx = 0; }
  }
  var AI = {
    walker: function (e, dt) { patrol(e, dt, e.speed); gravMove(e, dt); },
    kbody: function (e, dt) { e.vx = 0; gravMove(e, dt); },
    chaser: function (e, dt, dx, dy, adx, near) {
      if (near && adx > 4) {
        e.face = U.sign(dx);
        e.vx = U.approach(e.vx, e.face * e.speed * 1.5, 400 * dt);
        if (e.onGround && !groundAhead(e)) e.vx = 0;
        if (e.onGround && e.hitWallLast && dy < -8) e.vy = -num(e.def.jump, 220);
      } else patrol(e, dt, e.speed);
      gravMove(e, dt);
      e.hitWallLast = e.hitWall;
    },
    crawler: function (e, dt, dx) {
      e.face = U.sign(dx) || e.face;
      e.vx = U.approach(e.vx, e.face * e.speed, 300 * dt);
      gravMove(e, dt);
    },
    jumper: function (e, dt, dx, dy, adx, near) {
      if (e.onGround) {
        e.vx = U.approach(e.vx, 0, 600 * dt);
        e.timer -= dt;
        e.tele = e.timer < 0.25 ? 1 : 0;
        if (e.timer <= 0) {
          if (near) e.face = U.sign(dx) || e.face;
          else if (!groundAhead(e)) e.face = -e.face;
          e.vy = -num(e.def.jump, 230); e.vx = e.face * e.speed * (near ? 1.8 : 1.1);
          e.timer = 0.8 + Math.random() * 0.6;
          if (onScreen(e)) dust(cx(e), e.y + e.h, 1);
        }
      }
      var vx = e.vx;
      gravMove(e, dt);
      if (!e.onGround) e.vx = vx;
    },
    flyer: function (e, dt, dx, dy, adx, near) {
      e.swoopCd = (e.swoopCd || 1.2) - dt;
      if (e.state === 'swoop') {
        e.st += dt;
        e.x += e.vx * dt; e.y += e.vy * dt;
        if (e.st > 0.7 || e.y > e.ty) { e.state = 'return'; e.st = 0; }
      } else if (e.state === 'return') {
        e.vx = U.approach(e.vx, 0, 200 * dt);
        e.x += e.vx * dt; e.y -= num(e.speed, 40) * 1.6 * dt;
        if (e.y <= e.baseY) { e.y = e.baseY; e.state = 'patrol'; e.swoopCd = 1.4 + Math.random(); }
      } else {
        if (near) { e.face = U.sign(dx) || e.face; e.vx = U.approach(e.vx, e.face * e.speed, 120 * dt); }
        else { e.vx = e.face * e.speed * 0.6; if (Math.abs(e.x - (e.homeX = e.homeX || e.x)) > 64) e.face = e.x > e.homeX ? -1 : 1; }
        e.x += e.vx * dt;
        if (solidAt(e.face > 0 ? e.x + e.w : e.x, cy(e))) { e.face = -e.face; e.vx = -e.vx; }
        e.y = e.baseY + Math.sin(e.t * 3) * 8;
        e.tele = (near && e.swoopCd < 0.3) ? 1 : 0;
        if (near && e.swoopCd <= 0 && adx < 110) {
          var P = S.player, tx = cx(P), ty = cy(P);
          var ddx = tx - cx(e), ddy = ty - cy(e), d = Math.sqrt(ddx * ddx + ddy * ddy) || 1, sp = Math.max(110, e.speed * 3);
          e.vx = ddx / d * sp; e.vy = Math.max(30, ddy / d * sp); e.ty = ty; e.state = 'swoop'; e.st = 0;
        }
      }
    },
    shooter: function (e, dt, dx, dy, adx, near) {
      if (near || (onScreen(e) && !e.blind && e.hostile && adx < e.aggro * 1.5)) {
        e.face = U.sign(dx) || e.face;
        var want = 0;
        if (adx < 60) want = -e.face; else if (adx > 140) want = e.face;
        e.vx = U.approach(e.vx, want * e.speed, 300 * dt);
        if (e.onGround && want && !groundAheadDir(e, want)) e.vx = 0;
        e.timer -= dt;
        e.tele = e.timer < 0.35 ? 1 : 0;
        if (e.timer <= 0) {
          e.timer = num(e.def.shootEvery, 2);
          var P = S.player;
          fireProj(e.def.projectile || 'bolt', cx(e) + e.face * 6, e.y + e.h * 0.4, cx(P), cy(P));
          sfx('bomb_throw', { pitch: 1.5, vol: 0.5 });
        }
      } else { patrol(e, dt, e.speed * 0.6); e.tele = 0; }
      gravMove(e, dt);
    },
    charger: function (e, dt, dx, dy, adx, near) {
      if (e.state === 'tele') {
        e.st += dt; e.vx = 0; e.tele = 1;
        if (e.st > 0.55) { e.state = 'dash'; e.st = 0; sfx('kick', { pitch: 0.6 }); }
      } else if (e.state === 'dash') {
        e.st += dt; e.tele = 0;
        e.vx = e.face * num(e.def.chargeSpeed, 160);
        if (Math.random() < 0.4 && onScreen(e)) dust(cx(e) - e.face * 6, e.y + e.h, 1);
        if (e.st > 1.0 || (e.onGround && !groundAhead(e))) { e.state = 'rest'; e.st = 0; e.vx = 0; }
      } else if (e.state === 'rest') {
        e.st += dt; e.vx = U.approach(e.vx, 0, 600 * dt);
        if (e.st > 0.7) e.state = 'patrol';
      } else {
        e.tele = 0;
        if (near && Math.abs(dy) < 28) { e.face = U.sign(dx) || e.face; e.state = 'tele'; e.st = 0; e.vx = 0; if (onScreen(e)) sfx('warn', { vol: 0.4 }); }
        else patrol(e, dt, e.speed);
      }
      var st0 = e.state;
      gravMove(e, dt);
      if (st0 === 'dash' && e.hitWall) { e.state = 'rest'; e.st = 0; if (onScreen(e)) { DCW.shake(2, 0.12); dust(cx(e), e.y + e.h, 3); } }
    },
    turret: function (e, dt, dx, dy, adx, near, vis) {
      e.vx = 0;
      if (vis && !e.blind && e.hostile && adx < e.aggro * 1.6) {
        e.face = U.sign(dx) || e.face;
        e.timer -= dt;
        e.tele = e.timer < 0.4 ? 1 : 0;
        if (e.timer <= 0) {
          e.timer = num(e.def.shootEvery, 2);
          var P = S.player;
          fireProj(e.def.projectile || 'bolt', cx(e) + e.face * 6, e.y + e.h * 0.35, cx(P), cy(P));
        }
      } else e.tele = 0;
      if (!e.flying) gravMove(e, dt);
    },
    spawner: function (e, dt, dx, dy, adx, near, vis) {
      e.vx = 0;
      if (vis) {
        e.timer -= dt;
        e.tele = e.timer < 0.5 ? 1 : 0;
        if (e.timer <= 0) {
          e.timer = num(e.def.spawnEvery, 4);
          if ((e.kids || 0) < num(e.def.maxKids, 3)) {
            var kid = spawnEnemy(e.def.spawn || 'lemur', cx(e), e.y + e.h, { parent: e, noLoot: true, face: U.sign(dx) || 1 });
            kid.vy = -120; kid.vx = kid.face * 40; kid.init = true;
            e.kids = (e.kids || 0) + 1;
            sfx('spawn', { vol: 0.5 });
          }
        }
      }
      if (!e.flying) gravMove(e, dt);
    },
    bomber: function (e, dt, dx, dy, adx, near) {
      if (near || (onScreen(e) && !e.blind && e.hostile && adx < e.aggro * 1.6)) {
        e.face = U.sign(dx) || e.face;
        var want = 0;
        if (adx < 80) want = -e.face; else if (adx > 160) want = e.face;
        e.vx = U.approach(e.vx, want * e.speed, 300 * dt);
        if (e.onGround && want && !groundAheadDir(e, want)) e.vx = 0;
        e.timer -= dt;
        e.tele = e.timer < 0.4 ? 1 : 0;
        if (e.timer <= 0) {
          e.timer = num(e.def.shootEvery, 2.4);
          var P = S.player;
          fireProj(e.def.projectile || 'rock', cx(e), e.y, cx(P) + P.vx * 0.4, P.y + P.h - 4, { lob: true });
        }
      } else { patrol(e, dt, e.speed * 0.6); e.tele = 0; }
      if (e.flying) { e.x += e.vx * dt; e.y = e.baseY + Math.sin(e.t * 2) * 6; }
      else gravMove(e, dt);
    },
    hopper: function (e, dt, dx, dy, adx, near) {
      var wasAir = !e.onGround, fall = e.vy;
      if (e.onGround) {
        e.vx = U.approach(e.vx, 0, 800 * dt);
        e.timer -= dt;
        e.tele = e.timer < 0.3 ? 1 : 0;
        if (e.timer <= 0) {
          if (near) e.face = U.sign(dx) || e.face; else if (!groundAhead(e)) e.face = -e.face;
          e.vy = -num(e.def.jump, 220) * 1.3; e.vx = e.face * e.speed * (near ? 1.5 : 1);
          e.timer = 1.1 + Math.random() * 0.6; e.tele = 0;
        }
      }
      var vx = e.vx;
      gravMove(e, dt);
      if (!e.onGround) e.vx = vx;
      if (wasAir && e.onGround && fall > 150) {
        var fy = e.y + e.h;
        addHaz({ kind: 'wave', x: cx(e) - 4, y: fy - 8, w: 8, h: 8, vx: -120, life: 0.4, dmg: e.dmg });
        addHaz({ kind: 'wave', x: cx(e) - 4, y: fy - 8, w: 8, h: 8, vx: 120, life: 0.4, dmg: e.dmg });
        if (onScreen(e)) { DCW.shake(1.5, 0.1); dust(cx(e), fy, 3); sfx('stomp', { vol: 0.5, pitch: 0.7 }); }
      }
    },
    // ---- book 2 ----
    perch: function (e, dt, dx, dy, adx, near, vis) {
      var pd = e.def;
      if (!e.init) { e.init = true; e.perched = e.state !== 'flung'; e.hidden = e.perched; e.timer = 0.8 + Math.random(); }
      if (e.state === 'flung') { var v0 = e.vx; gravMove(e, dt); if (!e.onGround) e.vx = v0; else { e.state = 'patrol'; e.vx = 0; if (onScreen(e)) dust(cx(e), e.y + e.h, 2); } return; }
      if (e.perched) {
        e.vx = 0;
        if (vis && !e.blind && e.hostile) {
          e.face = U.sign(dx) || e.face;
          if (adx < 72 && Math.abs(dy) < 110) e.hidden = false;
          if (adx < num(pd.dropRange, 44) && dy > -16) { e.perched = false; e.hidden = false; e.vy = -90; e.vx = e.face * 55; e.state = 'flung'; sfx('warn', { vol: 0.4 }); }
          else if (adx < e.aggro * 1.8) { e.timer -= dt; e.tele = e.timer < 0.3 ? 1 : 0; if (e.timer <= 0) { e.timer = num(pd.shootEvery, 1.8); e.hidden = false; throwKnife(e); } }
        } else e.tele = 0;
        gravMove(e, dt);
        return;
      }
      if (near) {
        e.face = U.sign(dx) || e.face;
        if (adx > 18) { e.vx = U.approach(e.vx, e.face * e.speed * 1.5, 400 * dt); if (e.onGround && !groundAhead(e)) e.vx = 0; }
        else e.vx = U.approach(e.vx, 0, 400 * dt);
        e.timer -= dt; e.tele = e.timer < 0.25 ? 1 : 0;
        if (e.timer <= 0) { e.timer = num(pd.shootEvery, 1.8) * 1.3; if (adx > 36) throwKnife(e); }
      } else { patrol(e, dt, e.speed); e.tele = 0; }
      gravMove(e, dt);
    },
    stilt: function (e, dt, dx, dy, adx, near) {
      var reach = num(e.def.reach, 30);
      if (e.state === 'wind') {
        e.vx = 0; e.st += dt; e.tele = 1;
        if (e.st > 0.4) {
          e.state = 'stab'; e.st = 0;
          addHaz({ kind: 'stab', x: e.face > 0 ? e.x + e.w : e.x - reach, y: e.y + e.h * 0.45, w: reach, h: 10, life: 0.16, dmg: e.dmg, cause: e.def.name || 'STILTS' });
          sfx('punch', { pitch: 0.6 });
        }
      } else if (e.state === 'stab') {
        e.st += dt; e.vx = 0; e.tele = 0;
        if (e.st > 0.45) { e.state = 'patrol'; e.timer = 0.5; }
      } else {
        e.tele = 0; e.timer -= dt;
        if (near) {
          e.face = U.sign(dx) || e.face;
          if (adx < reach + e.w / 2 + 2 && Math.abs(dy) < 44 && e.timer <= 0) { e.state = 'wind'; e.st = 0; }
          else { e.vx = U.approach(e.vx, e.face * e.speed * 1.3, 300 * dt); if (e.onGround && !groundAhead(e)) e.vx = 0; }
        } else patrol(e, dt, e.speed);
      }
      gravMove(e, dt);
    },
    launcher: function (e, dt, dx, dy, adx, near, vis) {
      e.vx = 0;
      if (vis && !e.blind && e.hostile) {
        e.face = U.sign(dx) || e.face;
        e.timer -= dt; e.tele = e.timer < 0.5 ? 1 : 0;
        if (e.timer <= 0) {
          e.timer = num(e.def.spawnEvery, 3.5);
          if ((e.kids || 0) < num(e.def.maxKids, 3)) {
            var P = S.player, kid = spawnEnemy(e.def.spawn || 'lemur', cx(e), e.y + 8, { parent: e, noLoot: true, state: 'flung', init: true, perched: false, hidden: false });
            var T = U.clamp(adx / 120, 0.6, 1.3);
            kid.vx = (cx(P) - cx(e)) / T; kid.vy = (P.y - kid.y - 0.5 * K.gravity * T * T) / T; kid.face = U.sign(dx) || 1;
            e.kids = (e.kids || 0) + 1;
            sfx('launch');
          }
        }
      } else e.tele = 0;
      gravMove(e, dt);
    },
    urchin: function (e, dt, dx, dy, adx, near) {
      var P = S.player;
      if (e.hostile) {
        if (!e.blind) e.face = U.sign(dx) || e.face;
        e.vx = U.approach(e.vx, e.face * e.speed * 2.2, 500 * dt);
        if (e.onGround && e.hitWallLast) e.vy = -220;
        gravMove(e, dt); e.hitWallLast = e.hitWall;
        return;
      }
      var tg = e.target;
      if (!tg || tg.gone || tg.broken || tg.t <= 0) tg = e.target = urchinTarget(e);
      if (tg) {
        var tdx = cx(tg) - cx(e);
        if (Math.abs(tdx) > 8) { e.face = U.sign(tdx); e.vx = U.approach(e.vx, e.face * e.speed, 300 * dt); e.eatT = 0; }
        else {
          e.vx = U.approach(e.vx, 0, 400 * dt); e.eatT = (e.eatT || 0) + dt;
          if (tg.kind === 'barricade') { if (e.eatT > 0.8) { e.eatT = 0; hitBarricade(tg, Math.max(1, e.baseDmg)); } }
          else if (e.eatT > 1.6) { tg.gone = true; e.eatT = 0; e.target = null; smoke(cx(tg), cy(tg), 2); if (onScreen(e)) sfx('crate_break', { vol: 0.4, pitch: 1.4 }); }
        }
        // Carl standing in its way for a second makes it mad
        if (overlap(e, P) && P.state !== 'dead') { e.blockT = (e.blockT || 0) + dt; if (e.blockT > 1) provoke(e); }
        else e.blockT = Math.max(0, (e.blockT || 0) - dt * 0.5);
      } else patrol(e, dt, e.speed * 0.6);
      gravMove(e, dt);
    },
    floater: function (e, dt, dx, dy, adx, near) {
      var P = S.player;
      if (e.homeX === undefined) e.homeX = cx(e);
      if (near) { e.face = U.sign(dx) || e.face; e.vx = U.approach(e.vx, e.face * e.speed * 0.7, 60 * dt); e.baseY += U.clamp(P.y - 26 - e.baseY, -18 * dt, 18 * dt); }
      else { e.vx = U.approach(e.vx, e.face * e.speed * 0.35, 60 * dt); if (Math.abs(cx(e) - e.homeX) > 60) e.face = cx(e) > e.homeX ? -1 : 1; }
      e.x += e.vx * dt;
      if (solidAt(e.face > 0 ? e.x + e.w : e.x, cy(e))) { e.face = -e.face; e.vx = -e.vx * 0.5; }
      e.y = e.baseY + Math.sin(e.t * 1.6) * 6;
      e.timer -= dt; e.tele = near && e.timer < 0.5 ? 1 : 0;
      if (near && e.timer <= 0 && adx < 120) {
        e.timer = num(e.def.shootEvery, 3.2);
        addHaz({ kind: 'ring', cx: cx(e), cy: cy(e), r: 4, rmax: num(e.def.ringR, 56), speed: 90, x: 0, y: 0, w: 0, h: 0, life: 9, dmg: e.dmg, cause: e.def.name || 'PSIONIC' });
        sfx('psionic');
      }
    },
    berserker: function (e, dt, dx, dy, adx, near) {
      if (e.state === 'tele') { e.st += dt; e.vx = 0; e.tele = 1; if (e.st > 0.35) { e.state = 'dash'; e.st = 0; sfx('boss_roar', { pitch: 1.6, vol: 0.5 }); } }
      else if (e.state === 'dash') {
        e.st += dt; e.tele = 0; e.vx = e.face * num(e.def.chargeSpeed, 170);
        if (Math.random() < 0.4) dust(cx(e) - e.face * 8, e.y + e.h, 1);
        if (e.st > 0.8 || (e.onGround && !groundAhead(e)) || e.hitWall) { e.state = 'rest'; e.st = 0; e.vx = 0; }
      } else if (e.state === 'rest') { e.st += dt; e.vx = U.approach(e.vx, 0, 500 * dt); if (e.st > 0.6) e.state = 'patrol'; }
      else {
        e.tele = 0; e.dashCd = (e.dashCd || 1) - dt;
        if (near) {
          e.face = U.sign(dx) || e.face;
          if (e.inDark && e.dashCd <= 0 && Math.abs(dy) < 30) { e.state = 'tele'; e.st = 0; e.dashCd = 2.2; if (!e.roared) { e.roared = true; numText(cx(e), e.y - 8, 'BERSERK!', '#f83800'); } }
          else { e.vx = U.approach(e.vx, e.face * e.speed, 300 * dt); if (e.onGround && !groundAhead(e)) e.vx = 0; }
        } else patrol(e, dt, e.speed * 0.6);
      }
      gravMove(e, dt);
    },
    caster: function (e, dt, dx, dy, adx, near) {
      var P = S.player;
      if (near || (onScreen(e) && !e.blind && e.hostile && adx < e.aggro * 1.5)) {
        e.face = U.sign(dx) || e.face;
        var want = adx < 70 ? -e.face : adx > 150 ? e.face : 0;
        e.vx = U.approach(e.vx, want * e.speed, 300 * dt);
        if (e.onGround && want && !groundAheadDir(e, want)) e.vx = 0;
        e.timer -= dt; e.orbT = (e.orbT === undefined ? 2 + Math.random() * 2 : e.orbT) - dt;
        e.tele = (e.timer < 0.35 || e.orbT < 0.5) ? 1 : 0;
        if (e.orbT <= 0) { e.orbT = num(e.def.orbEvery, 7); addOrb(cx(P), cy(P), num(e.def.orbR, 44), num(e.def.orbTime, 6)); numText(cx(e), e.y - 8, 'DARKNESS', '#6844fc'); }
        else if (e.timer <= 0) { e.timer = num(e.def.shootEvery, 2.2); fireProj(e.def.projectile || 'bolt', cx(e) + e.face * 6, e.y + e.h * 0.35, cx(P), cy(P)); sfx('laser', { pitch: 1.8, vol: 0.4 }); }
      } else { patrol(e, dt, e.speed * 0.5); e.tele = 0; }
      gravMove(e, dt);
    },
    krasue: function (e, dt, dx, dy, adx, near) {
      var P = S.player, body = e.body && !e.body.dead ? e.body : null;
      if (e.state === 'gone') {
        e.respawnT -= dt;
        if (e.respawnT <= 0) {
          if (body) {
            e.state = 'patrol'; e.hp = e.maxHp; e.x = cx(body) - e.w / 2; e.y = body.y - e.h - 12; e.vx = 0; e.vy = -30;
            smoke(cx(e), cy(e), 4); sfx('krasue_shriek', { pitch: 1.3 }); numText(cx(e), e.y - 8, 'SHE IS BACK', '#f878f8');
          } else e.dead = true;
        }
        return;
      }
      e.atkCd = (e.atkCd || 0) - dt;
      var hx = body ? cx(body) : (e.homeX === undefined ? (e.homeX = cx(e)) : e.homeX), hy = body ? body.y - 28 : e.baseY;
      var lure = null, ld = K.decoyLure;
      for (var i = 0; i < S.allies.length; i++) { var a = S.allies[i]; if (a.kind !== 'decoy') continue; var d = dist(cx(a), cy(a), cx(e), cy(e)); if (d < ld) { ld = d; lure = a; } }
      var planting = P.state === 'plant' && dist(cx(P), cy(P), cx(e), cy(e)) < K.plantSee;
      var tx, ty, sp = e.speed;
      if (planting) { tx = cx(P); ty = cy(P); sp *= 1.7; e.tele = 1; e.hidden = false; }
      else if (lure) { tx = cx(lure); ty = lure.y - 22 + Math.sin(e.t * 3) * 4; e.tele = 0; }
      else if (near) {
        if (e.atkCd <= 0) { tx = cx(P); ty = cy(P) - 2; sp *= 1.5; e.tele = 1; }
        else { tx = cx(P) - (U.sign(dx) || 1) * 46; ty = P.y - 36; e.tele = 0; }
        if (body && dist(tx, ty, hx, hy) > K.krasueLeash * 1.7) { tx = hx + U.clamp(tx - hx, -K.krasueLeash, K.krasueLeash); ty = hy; }
      } else { tx = hx + Math.sin(e.t * 0.9) * 36; ty = hy + Math.sin(e.t * 2.1) * 8; e.tele = 0; }
      flyToward(e, tx, ty, sp, 260, dt);
      e.face = e.vx < -5 ? -1 : e.vx > 5 ? 1 : e.face;
    },
    swarm: function (e, dt, dx, dy, adx, near) {
      var P = S.player, tx, ty;
      if (e.seed === undefined) e.seed = Math.random() * 6;
      if (e.homeX === undefined) e.homeX = cx(e);
      e.atkCd = (e.atkCd || 0) - dt;
      if (near && e.atkCd <= 0) { tx = cx(P) + Math.sin(e.t * 2.6 + e.seed) * 18; ty = cy(P) - 2 + Math.cos(e.t * 2.1 + e.seed) * 12; }
      else if (near) { tx = cx(P) + Math.sin(e.t * 1.3 + e.seed) * 50; ty = P.y - 20 + Math.cos(e.t * 1.9 + e.seed) * 16; }
      else { tx = e.homeX + Math.sin(e.t + e.seed) * 30; ty = e.baseY + Math.cos(e.t * 1.7 + e.seed) * 10; }
      var sp = e.speed * (near ? 1.3 : 0.6);
      e.vx = U.approach(e.vx, U.clamp((tx - cx(e)) * 2.5, -sp, sp), 240 * dt);
      e.vy = U.approach(e.vy, U.clamp((ty - cy(e)) * 2.5, -sp, sp), 240 * dt);
      e.x += e.vx * dt; e.y += e.vy * dt; e.face = U.sign(e.vx) || e.face;
    },
    charm: function (e, dt, dx, dy, adx, near) {
      e.charmT = (e.charmT === undefined ? 2 : e.charmT) - dt;
      if (near) {
        e.face = U.sign(dx) || e.face;
        e.vx = U.approach(e.vx, adx > 30 ? e.face * e.speed * 1.2 : 0, 300 * dt);
        if (e.onGround && !groundAhead(e)) e.vx = 0;
        e.tele = e.charmT < 0.4 ? 1 : 0;
        if (e.charmT <= 0 && adx < 110) {
          e.charmT = num(e.def.charmEvery, 4);
          var P = S.player;
          fireProj(e.def.projectile || 'charm', cx(e) + e.face * 6, e.y + e.h * 0.35, cx(P), cy(P), { charm: num(e.def.charmTime, 2), dmg: 0, speed: 110, color: '#f878f8' });
          sfx('missile', { pitch: 1.6, vol: 0.5 });
        }
      } else { patrol(e, dt, e.speed * 0.6); e.tele = 0; }
      gravMove(e, dt);
    },
    guard: function (e, dt, dx, dy, adx) {
      if (e.state === 'wind') {
        e.vx = 0; e.st += dt; e.tele = 1;
        if (e.st > 0.45) {
          e.state = 'slash'; e.st = 0;
          addHaz({ kind: 'stab', x: e.face > 0 ? cx(e) : cx(e) - 42, y: e.y + 2, w: 42, h: e.h - 4, life: 0.2, dmg: 999, cause: 'guard', lethal: true });
          sfx('punch', { pitch: 0.5 }); DCW.shake(2, 0.15);
        }
      } else if (e.state === 'slash') { e.st += dt; e.vx = 0; e.tele = 0; if (e.st > 0.55) e.state = 'patrol'; }
      else {
        e.tele = 0;
        if (S.player.state !== 'dead') e.face = U.sign(dx) || e.face;
        if (adx < 36 && Math.abs(dy) < 34 && S.player.state !== 'dead') { e.state = 'wind'; e.st = 0; }
        else { e.vx = U.approach(e.vx, e.face * e.speed, 300 * dt); if (e.onGround && e.hitWallLast) e.vy = -300; }
      }
      gravMove(e, dt); e.hitWallLast = e.hitWall;
      if (e.hitWall) e.face = U.sign(dx) || e.face;
    },
    citizen: function (e, dt, dx, dy, adx) {
      var P = S.player;
      e.timer -= dt;
      var scared = ((P.state === 'punch' || P.state === 'kick') && adx < 64) || (S.street && S.street.alarmT > 0 && adx < 140);
      if (scared) { e.face = -(U.sign(dx) || 1); e.vx = U.approach(e.vx, e.face * e.speed * 2.4, 400 * dt); if (e.onGround && !groundAhead(e)) e.vx = 0; }
      else if (e.timer <= 0) { e.timer = U.rand(1, 3); e.walk = Math.random() < 0.65; if (e.walk) e.face = U.chance(0.5) ? 1 : -1; }
      else if (e.walk) { if (e.onGround && !groundAhead(e)) e.face = -e.face; e.vx = e.face * e.speed; }
      else e.vx = U.approach(e.vx, 0, 300 * dt);
      gravMove(e, dt);
    }
  };
  function urchinTarget(e) {
    var best = null, bd = 420, i, o, d;
    for (i = 0; i < S.objects.length; i++) {
      o = S.objects[i];
      if ((o.kind === 'trash' && !o.gone) || (o.kind === 'barricade' && !o.broken)) { d = Math.abs(cx(o) - cx(e)) + Math.abs(cy(o) - cy(e)) * 2; if (o.kind === 'barricade') d *= 0.5; if (d < bd) { bd = d; best = o; } }
    }
    for (i = 0; i < S.corpses.length; i++) { o = S.corpses[i]; if (o.gone || o.t <= 0) continue; d = Math.abs(cx(o) - cx(e)) + Math.abs(cy(o) - cy(e)) * 2; if (d < bd) { bd = d; best = o; } }
    return best;
  }
  function updCorpses(dt) { for (var i = S.corpses.length - 1; i >= 0; i--) { var c = S.corpses[i]; c.t -= dt; if (c.t <= 0 || c.gone) S.corpses.splice(i, 1); } }

  /* ---------------- hazards (waves, beams, spikes, rings, stabs, sweeps) ---------------- */
  function addHaz(h) { h.t = 0; h.tele = h.tele || 0; S.haz.push(h); return h; }
  function updHaz(dt) {
    var P = S.player;
    for (var i = S.haz.length - 1; i >= 0; i--) {
      var h = S.haz[i];
      h.t += dt;
      if (h.t < h.tele) continue;
      if (!h.fired) { h.fired = true; if (h.onFire) h.onFire(h); }
      if (h.kind === 'ring') {
        h.r += h.speed * dt;
        if (!h.hit && P.state !== 'dead') { var d = dist(cx(P), cy(P), h.cx, h.cy); if (Math.abs(d - h.r) < 8) { h.hit = true; hurtPlayer(h.dmg, h.cx, { cause: h.cause || 'PSIONIC' }); } }
        if (h.r >= h.rmax) S.haz.splice(i, 1);
        continue;
      }
      if (h.vx) {
        h.x += h.vx * dt;
        if (Math.random() < 0.5 && onScreen(h)) dust(cx(h), h.y + h.h, 1);
        var ahead = h.vx > 0 ? h.x + h.w : h.x;
        if (h.kind === 'wave' && solidAt(ahead, h.y + h.h - 2)) h.life = 0;
        if (S.arena && S.locked && (h.x + h.w < S.arena.x0 || h.x > S.arena.x1)) h.life = 0;
      }
      if (h.t - h.tele > h.life) { S.haz.splice(i, 1); continue; }
      if (!h.harmless && overlap(h, P) && P.state !== 'dead') hurtPlayer(h.dmg, cx(h), { cause: h.cause || 'BOSS', raw: !!h.lethal });
      if (h.stunsMongo && S.party.mongo && overlap(h, S.party.mongo)) stunMongo(S.party.mongo, cx(h));
    }
  }

  /* ---------------- projectiles ---------------- */
  function updProjectiles(dt) {
    var P = S.player, M = S.party.mongo, i, p;
    for (i = S.eproj.length - 1; i >= 0; i--) {
      p = S.eproj[i];
      p.t += dt; p.life -= dt;
      p.vy += p.grav * dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
      var dead = p.life <= 0 || p.y > S.L.pxH + 16 || p.x < S.cam.x - 80 || p.x > S.cam.x + W + 80 || p.y < S.cam.y - 120;
      if (!dead && !p.ghost && p.t > (p.ghostUntil || 0) && solidAt(cx(p), cy(p))) { dead = true; if (onScreen(p)) smoke(cx(p), cy(p), 1); }
      if (!dead && P.state !== 'dead' && overlap(p, P)) {
        dead = true;
        if (p.charm) {
          if (!(P.inv > 0) && !S.god) { P.charmT = p.charm; numText(cx(P), P.y - 8, 'CHARMED!', '#f878f8'); sfx('missile', { pitch: 0.6 }); track('charmed'); }
        } else { hurtPlayer(p.dmg, cx(p), { cause: 'PROJECTILE' }); hitSpark(cx(p), cy(p)); }
      }
      if (!dead && M && M.heldT <= 0 && overlap(p, M)) { dead = true; stunMongo(M, cx(p)); }
      if (dead) S.eproj.splice(i, 1);
    }
    for (i = S.pproj.length - 1; i >= 0; i--) {
      p = S.pproj[i];
      if (p.kind === 'x') updXProj(p, i, dt);
      else if (p.kind === 'missile') updMissile(p, i, dt);
    }
  }

  /* ================================================================
     BOSSES
     ================================================================ */
  function bossDef(id) {
    var b = (D().bosses || {})[id];
    return b || { name: String(id || 'BOSS').toUpperCase().replace(/_/g, ' '), hp: 60, dmg: 2, w: 40, h: 32, sprite: id, xp: 50, gold: [30, 50],
      phases: [{ below: 1, speed: 40, pattern: ['walk:2', 'charge', 'idle:1', 'jump_slam'] }], intro: ['A BOSS APPEARS.'], defeat: 'THE BOSS IS DOWN.' };
  }
  function sortPhases(d, fallback) {
    return (d.phases && d.phases.length) ? d.phases.slice().sort(function (a, b) { return num(b.below, 1) - num(a.below, 1); }) : [{ below: 1, speed: 40, pattern: fallback }];
  }
  function makeBoss() {
    var id = S.def.boss || (S.def.chase && S.def.chase.pursuer) || 'boss';
    var d = bossDef(id);
    if (S.kind === 'facade' || d.facade) return makeFacade(id, d);
    var bi = artInfo((d.sprite || id) + '_idle'), okB = bi && !bi.missing && hasArt((d.sprite || id) + '_idle');
    var w = num(d.w, okB ? Math.round(bi.w * 0.7) : 40), h = num(d.h, okB ? bi.h - 4 : 32), sp = S.bossSpawn;
    var hp = Math.max(1, Math.round(num(d.hp, 60)));
    var B = { isBoss: true, id: id, def: d, x: sp.x - w / 2, y: sp.y - h, w: w, h: h, vx: 0, vy: 0, face: -1, hp: hp, maxHp: hp,
      phases: sortPhases(d, ['walk:2', 'idle:1']), phase: 0, pIdx: 0, move: null, flash: 0, flying: !!d.flying, active: false, dying: false, dead: false, alpha: 1,
      sprite: d.sprite || id, onGround: false, stun: 0, pendingPhase: -1, adds: 0, anim: 'idle', t: 0, dmg: num(d.dmg, 2) };
    B.groundY = sp.y;
    B.homeY = B.flying ? sp.y - 72 - h / 2 : B.y;
    if (B.flying) B.y = B.homeY;
    return B;
  }
  function makeFacade(id, d) {
    var spName = (d.sprite || 'dispenser') + '_body';
    var bsz = artSize(spName, 176, 88);
    var w = num(d.w, bsz.w), h = num(d.h, bsz.h), sp = S.bossSpawn, a = S.arena;
    var hp = Math.max(1, Math.round(num(d.hp, 120)));
    var B = { isBoss: true, facade: true, id: id, def: d, x: U.clamp(sp.x - w / 2, a.x0 + TS, Math.max(a.x0 + TS, a.x1 - TS - w)), y: sp.y - 6 - h, w: w, h: h, vx: 0, vy: 0, face: -1,
      hp: hp, maxHp: hp, phases: sortPhases(d, ['reveal:3', 'spit:spit:3', 'reveal:3', 'sweep', 'cloak']), phase: 0, pIdx: 0, move: null, flash: 0, flying: true,
      active: false, dying: false, dead: false, baseAlpha: num(d.camo, 0.16), alpha: num(d.camo, 0.16), sprite: d.sprite || 'dispenser', onGround: false, stun: 0, pendingPhase: -1,
      anim: 'idle', t: 0, dmg: num(d.dmg, 2), groundY: sp.y, nextPart: null, lastPart: null };
    B.homeY = B.y;
    B.parts = [
      { id: 'eye_l', kind: 'eye', dx: w * 0.31, dy: h * 0.30, w: 18, h: 14, open: 0, tele: 0 },
      { id: 'eye_r', kind: 'eye', dx: w * 0.69, dy: h * 0.30, w: 18, h: 14, open: 0, tele: 0 },
      { id: 'mouth', kind: 'mouth', dx: w * 0.5, dy: h * 0.62, w: 24, h: 14, open: 0, tele: 0 },
      { id: 'wing_l', kind: 'wing', dx: w * 0.07, dy: h * 0.82, w: 22, h: 14, open: 0, tele: 0 },
      { id: 'wing_r', kind: 'wing', dx: w * 0.93, dy: h * 0.82, w: 22, h: 14, open: 0, tele: 0 }
    ];
    return B;
  }
  function partById(B, id) { for (var i = 0; i < B.parts.length; i++) if (B.parts[i].id === id) return B.parts[i]; return B.parts[0]; }
  function pickPart(B, avoid) {
    var pool = B.parts.filter(function (p) { return p.kind !== 'mouth' && p !== avoid && p !== B.lastPart; });
    if (!pool.length) pool = B.parts.filter(function (p) { return p.kind !== 'mouth'; });
    return U.pick(pool);
  }
  function closeParts(B) { if (B.parts) B.parts.forEach(function (p) { p.open = 0; p.tele = 0; }); }
  function bossSpeed(B) { var ph = B.phases[B.phase] || {}; return num(ph.speed, 40); }
  function damageBoss(B, dmg, opts) {
    if (B.dying || B.dead || !B.active || B.hidden) return false;
    if (B.move && B.move.invuln) { if (!(B.immT > S.t)) { B.immT = S.t + 0.4; numText(cx(B), B.y - 4, 'IMMUNE', '#bcbcbc'); } return false; }
    var mul = B.cured ? 2 : 1;
    var n = Math.max(1, Math.round(dmg * mul - num(B.def.armor, 0)));
    B.hp -= n; B.flash = 0.1;
    var hx = opts.hitX !== undefined ? opts.hitX : U.clamp(cx(S.player), B.x + 4, B.x + B.w - 4);
    var hy = opts.hitY !== undefined ? opts.hitY : cy(B) - 4 + U.rand(-6, 6);
    if (opts.kind === 'fire') debris(hx, hy, 2, '#f87858', 60);
    else hitSpark(hx, hy, opts.crit);
    numText(hx + U.rand(-6, 6), (opts.hitY !== undefined ? hy - 10 : B.y - 2), n, opts.crit ? '#f8d878' : (opts.kind === 'boomy' ? '#f8b800' : '#fcfcfc'), opts.crit || (opts.kind === 'boomy' && B.facade) ? 2 : 1);
    if (!opts.noCombo) registerHit(n);
    var frac = B.hp / B.maxHp;
    for (var i = B.phases.length - 1; i > B.phase; i--) {
      if (frac < num(B.phases[i].below, 0)) { if (B.pendingPhase < i) B.pendingPhase = i; break; }
    }
    if (B.hp > 0) checkTicket(B);
    if (B.hp <= 0) { B.hp = 0; bossDie(B); return true; }
    return false;
  }
  // Heather: at 25% a Fireball-or-Custard scratch ticket drops. Grab it: custard.
  function checkTicket(B) {
    if (B.ticketDropped || B.cured || !S.arena) return;
    var t = B.def.ticket || B.def.custard || (B.id === 'heather' ? {} : null);
    if (!t) return;
    if (typeof t !== 'object') t = {};
    if (B.hp / B.maxHp >= num(t.below, 0.25)) return;
    B.ticketDropped = true;
    var P = S.player;
    var x = U.clamp(cx(P) + (cx(B) > cx(P) ? -44 : 44), S.arena.x0 + 2 * TS, S.arena.x1 - 2 * TS);
    var y = groundUnder(x, S.cam.y + 24) - 30;
    S.objects.push({ kind: 'ticket', x: x - 8, y: y, w: 16, h: 16, t: 0, taken: false, sprite: t.sprite || 'custard', lines: t.lines || null });
    announce('A SCRATCH TICKET!', { color: '#f8d878', time: 2, sub: t.sub || 'FIREBALL OR CUSTARD? GRAB IT.' });
    sfx('ticket_scratch'); flash('#f8d878', 0.12);
  }
  function grabTicket(o) {
    o.taken = true;
    var B = S.boss;
    sfx('ticket_scratch'); flash('#fce0a8', 0.3); DCW.freeze(8);
    fxSprite('sparkle', cx(o), cy(o), 0.6, { color: '#fce0a8', size: 14 });
    announce('CUSTARD!', { color: '#fce0a8', time: 2.2, sub: 'THE WORMS ARE DYING' });
    track('custard');
    for (var i = 0; i < S.enemies.length; i++) { var e = S.enemies[i]; if (!e.dead && e.id === 'worm') { e.dead = true; smoke(cx(e), cy(e), 1); } }
    if (B && !B.dead && !B.dying) {
      B.cured = true;
      var sp = bossSpeed(B);
      B.phases = [{ below: 1, speed: Math.max(12, sp * 0.4), pattern: ['walk:2.5', 'idle:2'] }];
      B.phase = 0; B.pIdx = 0; B.pendingPhase = -1; B.move = null; B.dmg = 1;
      var lines = o.lines || B.def.curedLines;
      if (lines && lines.length) say(lines);
    }
  }
  function parseMove(str) {
    var parts = String(str || 'idle:1').split(':');
    return { name: parts[0], a: parts[1], b: parts[2], t: 0, sub: 0, st: 0, n: 0 };
  }
  function nextMove(B) {
    if (B.pendingPhase > B.phase) {
      B.phase = B.pendingPhase; B.pIdx = 0;
      B.move = { name: 'phase', t: 0, sub: 0, st: 0, invuln: true };
      closeParts(B);
      sfx('boss_roar'); DCW.shake(4, 0.6); flash('#f83800', 0.12);
      announce('PHASE ' + (B.phase + 1), { color: '#f83800', time: 1 });
      return;
    }
    var pat = (B.phases[B.phase] && B.phases[B.phase].pattern) || ['idle:1'];
    if (!pat.length) pat = ['idle:1'];
    B.move = parseMove(pat[B.pIdx % pat.length]);
    B.pIdx++;
    if (B.facade) {
      if (B.move.name === 'reveal') B.move.part = (B.nextPart && B.nextPart.kind !== 'mouth') ? B.nextPart : pickPart(B);
      var nx = parseMove(pat[B.pIdx % pat.length]);
      B.nextPart = nx.name === 'reveal' ? pickPart(B, B.move.part) : nx.name === 'spit' ? partById(B, 'mouth') : null;
    }
  }
  function arenaClampX(x, w) {
    var a = S.arena; if (!a) return x;
    return U.clamp(x, a.x0 + TS, a.x1 - TS - w);
  }
  function bossGround(B) { return B.groundY; }
  function updBoss(dt) {
    var B = S.boss, P = S.player;
    if (!B || B.dead) return;
    B.t += dt;
    if (B.flash > 0) B.flash -= dt;
    if (B.dying) { updBossDeath(B, dt); return; }
    if (B.hidden) return;
    if (!B.active) {
      B.anim = 'idle';
      if (!S.locked && S.arena && cx(P) > S.arena.x0 + 3 * TS) lockArena(B);
      if (S.locked && B.wake !== undefined) { B.wake -= dt; if (B.wake <= 0) { B.active = true; nextMove(B); } }
      if (!B.flying) { B.vy = Math.min(B.vy + K.gravity * dt, K.fallMax); moveBody(B, dt, true); }
      return;
    }
    if (B.stun > 0) { B.stun -= dt; B.vx = 0; if (!B.flying) { B.vy = Math.min(B.vy + K.gravity * dt, K.fallMax); moveBody(B, dt, true); } contactBoss(B); return; }
    var m = B.move;
    if (!m) { nextMove(B); m = B.move; }
    m.t += dt;
    var fn = (B.facade && FACADE[m.name]) || MOVES[m.name] || MOVES.idle;
    var done = fn(B, m, dt, P);
    if (!B.flying && !m.noGrav) {
      B.vy = Math.min(B.vy + K.gravity * dt, 420);
      var wasG = B.onGround;
      moveBody(B, dt, true);
      if (!wasG && B.onGround && m.onLand) m.onLand(B, m);
    } else if (!m.manual) {
      B.x += B.vx * dt; B.y += B.vy * dt;
      B.hitWall = 0;
      var cxl = arenaClampX(B.x, B.w);
      if (cxl !== B.x) { B.hitWall = B.x < cxl ? -1 : 1; B.x = cxl; }
      B.y = U.clamp(B.y, (S.cam.y || 0) + 14, bossGround(B) - B.h);
    }
    if (S.arena && !m.manual) { var c2 = arenaClampX(B.x, B.w); if (c2 !== B.x) { B.hitWall = B.hitWall || (B.x < c2 ? -1 : 1); B.x = c2; } }
    if (done) { B.vx = B.flying ? 0 : B.vx; nextMove(B); }
    contactBoss(B);
  }
  function contactBoss(B) {
    var P = S.player;
    if (B.facade || B.alpha < 0.6 || P.state === 'dead' || P.state === 'pit') return;
    var hb = { x: B.x + 3, y: B.y + 3, w: B.w - 6, h: B.h - 3 };
    if (S.party.mongo && overlap(S.party.mongo, hb)) stunMongo(S.party.mongo, cx(B));
    if (!overlap(P, hb)) return;
    if (P.vy > 20 && P.prevBottom <= B.y + 8 && P.state !== 'airkick') {
      var st = stats(), r = rollCrit(P.mongo ? num(st.biteDmg, 6) : st.kickDmg);
      damageBoss(B, r.dmg, { crit: r.crit, kind: 'stomp', hitX: cx(P) });
      P.vy = -(I.down('jump') ? K.stompBounceHeld : K.stompBounce); P.jumping = I.down('jump');
      P.vx = (cx(P) < cx(B) ? -1 : 1) * 70; P.y = B.y - P.h - 1; P.inv = Math.max(P.inv, 0.15);
      sfx('stomp'); track('stomp'); DCW.freeze(3);
      return;
    }
    if (P.state === 'airkick') return;
    hurtPlayer(B.dmg, cx(B), { cause: B.def.name || 'BOSS' });
  }
  function lockArena(B) {
    S.locked = true;
    var a = S.arena, L = S.L, tx = a.tx0;
    for (var ty = 0; ty < L.h; ty++) {
      if (tileAt(tx, ty) === T_EMPTY) { setTile(tx, ty, T_ALT); S.gates.push(ty * L.w + tx); }
    }
    smoke(tx * TS + 8, S.player.y, 4);
    var d = B.def;
    music(S.def.bossMusic || d.music || 'boss');
    sfx('boss_roar'); DCW.shake(3, 0.5);
    B.wake = 0.9;
    var intro = d.intro;
    if (typeof intro === 'string') intro = [intro];
    if (has(UI(), 'versus')) {
      UI().versus({ bossId: B.id, name: d.name, title: d.title, portrait: 'p_' + B.id,
        onDone: function () { if (intro && intro.length) say(intro); } });
    } else {
      if (intro && intro.length) say(intro);
      announce(d.name || 'BOSS', { color: '#f83800', time: 1.8, sub: d.title || '' });
    }
  }
  function unlockArena() {
    var L = S.L;
    S.gates.forEach(function (i) { L.t[i] = T_EMPTY; });
    S.gates = [];
    S.locked = false;
  }
  function bossDie(B) {
    B.dying = true; B.dt = 0; B.move = null; B.vx = 0;
    if (B.facade) { closeParts(B); B.alpha = 1; B.y = B.homeY; }
    sfx('boss_die'); DCW.freeze(18); DCW.shake(5, 1.6); flash('#fcfcfc', 0.25);
    S.eproj.length = 0; S.haz.length = 0; S.hooks.length = 0;
    for (var i = 0; i < S.enemies.length; i++) { var e = S.enemies[i]; if (!e.dead && e.isAdd) { e.dead = true; smoke(cx(e), cy(e), 3); } }
    var M = S.party.mongo; if (M && M.heldT > 0) M.heldT = 0.01;
    music(null);
  }
  function updBossDeath(B, dt) {
    B.dt += dt;
    if (!B.flying) { B.vy = Math.min(B.vy + K.gravity * dt, 420); moveBody(B, dt, true); }
    else if (!B.facade) { B.y = Math.min(B.y + 20 * dt, bossGround(B) - B.h); }
    B.flash = (Math.floor(B.dt * 20) % 2) ? 0.05 : 0;
    B.boomT = (B.boomT || 0) - dt;
    if (B.dt < 2.2 && B.boomT <= 0) {
      B.boomT = 0.11;
      fxSprite('explosion', B.x + Math.random() * B.w, B.y + Math.random() * B.h + 10, 0.4, { color: '#f8b800', size: 14, scale: Math.random() < 0.3 ? 2 : 1, front: true });
      debris(B.x + Math.random() * B.w, B.y + Math.random() * B.h, 4, '#f8b800', 140);
      if (Math.floor(B.dt * 4) !== B.lastBoomS) { B.lastBoomS = Math.floor(B.dt * 4); sfx('explosion', { vol: 0.6 }); }
    }
    if (B.dt >= 2.2 && !B.gone) {
      B.gone = true;
      flash('#fcfcfc', 0.3); DCW.shake(6, 0.5); DCW.freeze(8);
      for (var i = 0; i < 4; i++) fxSprite('explosion', cx(B) + U.rand(-16, 16), cy(B) + U.rand(-10, 20), 0.5, { scale: 2, size: 24, color: '#fcfcfc', front: true });
      smoke(cx(B), cy(B), 10);
      var d = B.def;
      call(G(), 'addXP', Math.round(num(d.xp, 50)));
      var g = d.gold || [20, 40];
      var coins = spillCoinsReturn(cx(B), B.facade ? B.y + B.h - 10 : cy(B), U.randi(num(g[0], 20), num(g[1], 40)), 14);
      coins.forEach(function (c) { c.delay = 0.6; });
      var v = Math.round(num(d.views, 1500) * comboMul());
      var got = addViews(v);
      numText(cx(B), B.y - 10, '+' + got + ' VIEWS', '#f878f8', 1);
      S.kills++;
      track('kill');
    }
    if (B.dt >= 3.0 && B.gone && !B.dead) {
      for (var j = 0; j < S.pickups.length; j++) { S.pickups[j].magnet = true; S.pickups[j].delay = 0; }
    }
    if (B.dt >= 3.6 && !B.dead) {
      B.dead = true;
      unlockArena();
      startVictory('boss');
      S.endT = 1.4;
      if (B.def.defeat) S.pendingDefeat = B.def.defeat;
    }
  }
  function faceP(B, P) { B.face = cx(P) < cx(B) ? -1 : 1; }
  function bossFire(B, projId, tx, ty, opts) {
    opts = opts || {};
    var pd = projDef(projId);
    if (opts.dmg === undefined) opts.dmg = Math.max(num(pd.dmg, 1), Math.ceil(B.dmg * 0.75));
    return fireProj(projId, cx(B) + B.face * (B.w * 0.35), B.y + B.h * 0.4, tx, ty, opts);
  }
  function tele(B, m, time) {
    if (!m.warned) { m.warned = true; sfx('warn'); }
    B.anim = 'attack';
    B.flash = (Math.floor(m.t * 16) % 2) ? 0.04 : 0;
    return m.t >= time;
  }
  var MOVES = {
    idle: function (B, m, dt, P) {
      var dur = num(parseFloat(m.a), 1);
      B.vx = U.approach(B.vx, 0, 600 * dt); B.anim = 'idle';
      if (B.flying) { B.vy = (B.homeY + Math.sin(B.t * 2.5) * (B.facade ? 2 : 6) - B.y) * 4; }
      if (!B.facade) faceP(B, P);
      return m.t >= dur;
    },
    phase: function (B, m, dt) {
      B.vx = 0; B.anim = 'special';
      B.flash = (Math.floor(m.t * 14) % 2) ? 0.05 : 0;
      if (B.flying) B.vy = (B.homeY - B.y) * 3;
      if (Math.random() < 0.3) debris(cx(B), cy(B), 2, '#f83800', 120);
      return m.t >= 1.0;
    },
    walk: function (B, m, dt, P) {
      var dur = num(parseFloat(m.a), 2);
      faceP(B, P);
      var sp = bossSpeed(B);
      if (Math.abs(cx(P) - cx(B)) > 12) B.vx = B.face * sp; else B.vx = 0;
      B.anim = 'walk';
      if (B.flying) B.vy = (B.homeY + Math.sin(B.t * 2.5) * 6 - B.y) * 4;
      return m.t >= dur;
    },
    hover: function (B, m, dt, P) {
      var dur = num(parseFloat(m.a), 2);
      faceP(B, P);
      if (B.flying) {
        B.vx = U.approach(B.vx, U.sign(cx(P) - cx(B)) * bossSpeed(B) * 0.8, 200 * dt);
        B.vy = (B.homeY + Math.sin(B.t * 3) * 10 - B.y) * 4;
        B.anim = 'walk';
      } else { B.vx = 0; B.anim = 'idle'; }
      return m.t >= dur;
    },
    charge: function (B, m, dt, P) {
      if (m.sub === 0) {
        B.vx = 0; faceP(B, P);
        if (B.flying) B.vy = ((P.y + P.h - B.h) - B.y) * 3;
        if (tele(B, m, 0.6)) { m.sub = 1; m.st = m.t; sfx(B.def.chargeSfx || 'boss_roar', { vol: 0.5, pitch: 1.3 }); }
        return false;
      }
      if (m.sub === 1) {
        B.anim = 'attack'; B.flash = 0;
        B.vx = B.face * Math.max(170, bossSpeed(B) * 3.6);
        if (B.flying) B.vy = 0;
        if (Math.random() < 0.5) dust(cx(B) - B.face * B.w / 2, B.y + B.h, 1);
        if (B.hitWall || m.t - m.st > 1.5) {
          if (B.hitWall) { DCW.shake(4, 0.25); sfx('explosion', { vol: 0.5 }); dust(cx(B) + B.face * B.w / 2, B.y + B.h, 5); B.stunHit = true; }
          m.sub = 2; m.st = m.t; B.vx = -B.face * 40;
        }
        return false;
      }
      B.vx = U.approach(B.vx, 0, 300 * dt); B.anim = 'idle';
      return m.t - m.st > (B.stunHit ? 0.8 : 0.4);
    },
    jump_slam: function (B, m, dt, P) {
      if (m.sub === 0) {
        B.vx = 0; faceP(B, P);
        if (tele(B, m, 0.35)) {
          m.sub = 1; m.st = m.t;
          var tx = U.clamp(cx(P), S.arena ? S.arena.x0 + TS + B.w / 2 : 0, S.arena ? S.arena.x1 - TS - B.w / 2 : S.L.pxW);
          if (B.flying) { m.tx = tx; }
          else { var T = 0.9; B.vy = -K.gravity * T / 2 * 0.98; B.vx = (tx - cx(B)) / T; B.onGround = false; sfx('jump', { pitch: 0.5 }); }
          m.onLand = slamLand;
        }
        return false;
      }
      if (m.sub === 1) {
        B.anim = 'special';
        if (B.flying) {
          if (m.t - m.st < 0.45) { B.vx = (m.tx - cx(B)) * 5; B.vy = (B.homeY - 20 - B.y) * 4; }
          else { B.vx = 0; B.vy = 380; if (B.y + B.h >= bossGround(B) - 1) slamLand(B, m); }
        } else if (B.onGround && m.t - m.st > 0.1 && !m.landed) slamLand(B, m);
        return false;
      }
      B.vx = 0; B.anim = 'idle';
      if (B.flying) B.vy = (B.homeY - B.y) * 2.5;
      return m.t - m.st > (B.flying ? 0.9 : 0.5);
    },
    shoot: function (B, m, dt, P) {
      var n = Math.max(1, parseInt(m.b || '3', 10) || 3), pid = m.a || 'rock';
      B.vx = U.approach(B.vx, 0, 600 * dt); faceP(B, P);
      if (B.flying) B.vy = (B.homeY + Math.sin(B.t * 2.5) * 6 - B.y) * 4;
      if (m.sub === 0) { if (tele(B, m, 0.45)) { m.sub = 1; m.st = m.t; m.n = 0; } return false; }
      B.anim = 'attack'; B.flash = 0;
      if (m.n < n && m.t - m.st >= m.n * 0.18) { bossFire(B, pid, cx(P), cy(P)); m.n++; sfx('bomb_throw', { pitch: 1.4, vol: 0.6 }); }
      return m.n >= n && m.t - m.st > n * 0.18 + 0.35;
    },
    spread: function (B, m, dt, P) {
      var n = Math.max(1, parseInt(m.b || '5', 10) || 5), pid = m.a || 'rock';
      B.vx = U.approach(B.vx, 0, 600 * dt); faceP(B, P);
      if (B.flying) B.vy = (B.homeY + Math.sin(B.t * 2.5) * 6 - B.y) * 4;
      if (m.sub === 0) { if (tele(B, m, 0.55)) { m.sub = 1; m.st = m.t; } return false; }
      if (m.sub === 1) {
        B.anim = 'attack'; B.flash = 0;
        var ox = cx(B) + B.face * B.w * 0.35, oy = B.y + B.h * 0.4;
        var base = Math.atan2(cy(P) - oy, cx(P) - ox), spreadA = n > 1 ? Math.min(1.9, 0.32 * (n - 1)) : 0;
        var pd = projDef(pid);
        for (var i = 0; i < n; i++) {
          var a = n > 1 ? base - spreadA / 2 + spreadA * i / (n - 1) : base;
          var p = bossFire(B, pid, 0, 0, { angle: a });
          if (num(pd.gravity, 0) > 0) p.vy -= 60;
        }
        sfx('laser', { pitch: 1.6, vol: 0.5 });
        m.sub = 2; m.st = m.t;
        return false;
      }
      return m.t - m.st > 0.5;
    },
    rain: function (B, m, dt, P) {
      var n = Math.max(1, parseInt(m.b || '6', 10) || 6), pid = m.a || 'rock';
      B.vx = U.approach(B.vx, 0, 600 * dt); if (!B.facade) faceP(B, P);
      if (B.flying) B.vy = (B.homeY + Math.sin(B.t * 2.5) * (B.facade ? 2 : 6) - B.y) * 4;
      if (m.sub === 0) {
        m.sub = 1; m.st = m.t; m.xs = [];
        var a0 = S.arena ? S.arena.x0 + TS + 8 : S.cam.x + 16, a1 = S.arena ? S.arena.x1 - TS - 8 : S.cam.x + W - 16;
        for (var i = 0; i < n; i++) m.xs.push(i === 0 ? U.clamp(cx(P), a0, a1) : U.rand(a0, a1));
        m.xs.forEach(function (x, k) { addHaz({ kind: 'marker', x: x - 6, y: S.cam.y + 2, w: 12, h: 4, life: 0, tele: 0.7 + k * 0.09, dmg: 0, harmless: true }); });
        sfx('warn');
        return false;
      }
      B.anim = 'special';
      if (m.sub === 1) {
        var el = m.t - m.st;
        while (m.n < n && el >= 0.7 + m.n * 0.09) {
          var p = fireProj(pid, m.xs[m.n], S.cam.y - 6, m.xs[m.n], S.cam.y + 100, { vx: 0, vy: 40, ghost: false, dmg: Math.max(num(projDef(pid).dmg, 1), Math.ceil(B.dmg * 0.75)) });
          if (p.grav <= 0) p.grav = 380;
          p.ghostUntil = 0.3; p.life = 3;
          m.n++;
        }
        return m.n >= n && el > 0.7 + n * 0.09 + 0.4;
      }
      return true;
    },
    spawn: function (B, m, dt, P) {
      var n = Math.max(1, parseInt(m.b || '2', 10) || 2), eid = m.a || 'lemur';
      B.vx = U.approach(B.vx, 0, 600 * dt);
      if (B.flying) B.vy = (B.homeY + Math.sin(B.t * 2.5) * (B.facade ? 2 : 6) - B.y) * 4;
      if (m.sub === 0) { if (tele(B, m, 0.45)) { m.sub = 1; m.st = m.t; } return false; }
      if (m.sub === 1) {
        B.anim = 'special'; B.flash = 0;
        var alive = 0;
        for (var i = 0; i < S.enemies.length; i++) if (S.enemies[i].isAdd && !S.enemies[i].dead) alive++;
        for (var k = 0; k < n && alive < 6; k++, alive++) {
          var x = arenaClampX(cx(B) + U.rand(-30, 30), 8) + 4;
          var e = spawnEnemy(eid, x, bossGround(B), { isAdd: true });
          if (e.flying) { e.y = B.facade ? B.y + B.h * 0.5 : B.y; e.baseY = Math.max(S.cam.y + 30, (B.facade ? B.groundY - 60 : B.homeY - 10)); }
          else { e.y = Math.min(B.y + B.h - e.h, bossGround(B) - e.h); e.vy = -180; e.vx = U.rand(-60, 60); }
          e.aggro = 400; e.init = true; e.perched = false; e.hidden = false;
        }
        sfx('spawn');
        m.sub = 2; m.st = m.t;
        return false;
      }
      return m.t - m.st > 0.5;
    },
    swoop: function (B, m, dt, P) {
      if (!B.flying) return MOVES.jump_slam(B, m, dt, P);
      m.manual = true;
      if (m.sub === 0) {
        B.vx = 0; faceP(B, P);
        B.y += ((B.homeY - 12) - B.y) * Math.min(1, 5 * dt);
        if (tele(B, m, 0.45)) {
          m.sub = 1; m.st = m.t; m.x0 = B.x; m.y0 = B.y; m.ty = P.y + P.h - B.h;
          m.x2 = arenaClampX(B.x + (cx(P) - cx(B)) * 2, B.w);
          sfx('boss_roar', { pitch: 1.5, vol: 0.5 });
        }
        return false;
      }
      if (m.sub === 1) {
        B.anim = 'attack'; B.flash = 0;
        var s = Math.min(1, (m.t - m.st) / 1.1);
        B.x = U.lerp(m.x0, m.x2, s);
        B.y = m.y0 + (Math.min(m.ty, bossGround(B) - B.h) - m.y0) * Math.sin(Math.PI * s);
        B.face = m.x2 > m.x0 ? 1 : -1;
        if (s >= 1) { m.sub = 2; m.st = m.t; }
        return false;
      }
      B.y += (B.homeY - B.y) * Math.min(1, 4 * dt);
      return m.t - m.st > 0.4;
    },
    teleport: function (B, m, dt, P) {
      B.vx = 0;
      m.manual = B.flying;
      if (m.sub === 0) {
        m.invuln = true;
        if (!m.warned) { m.warned = true; sfx('teleport'); smoke(cx(B), cy(B), 5); }
        B.alpha = Math.max(0, 1 - m.t / 0.4);
        if (m.t >= 0.45) {
          var a0 = S.arena ? S.arena.x0 + TS : S.cam.x, a1 = S.arena ? S.arena.x1 - TS - B.w : S.cam.x + W - B.w;
          var nx, tries = 0;
          do { nx = U.rand(a0, a1); } while (Math.abs(nx + B.w / 2 - cx(P)) < 70 && ++tries < 20);
          B.x = nx;
          if (B.flying) B.y = B.homeY; else { B.y = bossGround(B) - B.h; B.vy = 0; }
          faceP(B, P);
          smoke(cx(B), cy(B), 5);
          m.sub = 1; m.st = m.t;
        }
        return false;
      }
      B.alpha = Math.min(1, (m.t - m.st) / 0.35);
      B.flash = (Math.floor(m.t * 16) % 2) ? 0.04 : 0;
      if (B.alpha >= 1) m.invuln = false;
      return m.t - m.st > 0.55;
    },
    laser: function (B, m, dt, P) {
      B.vx = U.approach(B.vx, 0, 600 * dt);
      if (B.flying && m.sub === 0) B.vy = (B.homeY + Math.sin(B.t * 2.5) * 4 - B.y) * 4;
      else if (B.flying) B.vy = 0;
      if (m.sub === 0) {
        faceP(B, P);
        m.sub = 1; m.st = m.t;
        m.by = U.clamp(P.y + 6, S.cam.y + 20, bossGround(B) - 8);
        var a0 = S.arena ? S.arena.x0 : S.cam.x, a1 = S.arena ? S.arena.x1 : S.cam.x + W;
        addHaz({ kind: 'beam', x: a0, y: m.by - 5, w: a1 - a0, h: 10, tele: 0.85, life: 0.5, dmg: Math.max(2, B.dmg), cause: 'LASER',
          onFire: function () { sfx('laser'); DCW.shake(2, 0.4); } });
        sfx('warn');
        return false;
      }
      B.anim = (m.t - m.st) > 0.85 ? 'special' : 'attack';
      if ((m.t - m.st) < 0.85) B.flash = (Math.floor(m.t * 16) % 2) ? 0.04 : 0;
      return m.t - m.st > 0.85 + 0.5 + 0.35;
    },
    shockwave: function (B, m, dt, P) {
      B.vx = U.approach(B.vx, 0, 600 * dt);
      if (B.flying) B.vy = (B.homeY - B.y) * 3;
      if (m.sub === 0) { faceP(B, P); if (tele(B, m, 0.5)) { m.sub = 1; m.st = m.t; slamWaves(B, 150, 2.6); } return false; }
      B.anim = 'special'; B.flash = 0;
      return m.t - m.st > 0.6;
    },
    summon_spikes: function (B, m, dt, P) {
      B.vx = U.approach(B.vx, 0, 600 * dt);
      if (B.flying) B.vy = (B.homeY + Math.sin(B.t * 2.5) * 6 - B.y) * 4;
      if (m.sub === 0) {
        faceP(B, P);
        m.sub = 1; m.st = m.t;
        var a0 = S.arena ? S.arena.x0 + TS : S.cam.x, a1 = S.arena ? S.arena.x1 - TS - 24 : S.cam.x + W - 24;
        var gy = groundUnder(cx(P), P.y + P.h - 4);
        var xs = [U.clamp(cx(P) - 12, a0, a1), U.rand(a0, a1), U.rand(a0, a1)];
        xs.forEach(function (x) {
          var gyy = groundUnder(x + 12, gy - 4);
          addHaz({ kind: 'spikes', x: x, y: gyy - 22, w: 24, h: 22, tele: 0.8, life: 0.65, dmg: Math.max(2, B.dmg), cause: 'SPIKES',
            onFire: function (h) { if (onScreen(h)) { sfx('stomp', { pitch: 1.4 }); debris(h.x + 12, h.y + 20, 5, '#bcbcbc', 90); } } });
        });
        sfx('warn');
        return false;
      }
      B.anim = 'attack'; B.flash = (m.t - m.st < 0.8 && Math.floor(m.t * 16) % 2) ? 0.04 : 0;
      return m.t - m.st > 0.8 + 0.65 + 0.3;
    },
    // ---- book 2 primitives ----
    worms: function (B, m, dt, P) {
      var n = Math.max(1, parseInt(m.a || '4', 10) || 4);
      B.vx = U.approach(B.vx, 0, 600 * dt); faceP(B, P);
      if (B.cured) return true;
      if (m.sub === 0) { if (tele(B, m, 0.5)) { m.sub = 1; m.st = m.t; m.n = 0; } return false; }
      B.anim = 'special'; B.flash = 0;
      if (m.n < n && m.t - m.st >= m.n * 0.15) {
        var alive = 0; for (var i = 0; i < S.enemies.length; i++) if (!S.enemies[i].dead && S.enemies[i].id === 'worm') alive++;
        if (alive < 10) {
          var w = spawnEnemy('worm', cx(B) + U.rand(-B.w * 0.3, B.w * 0.3), B.y + B.h * 0.5, { isAdd: true, noLoot: true, life: 7, alwaysActive: true });
          w.vx = U.rand(-90, 90); w.vy = -U.rand(120, 220); w.hurtT = 0.35; w.face = U.sign(cx(P) - cx(w)) || 1;
        }
        m.n++; sfx('worm_squish', { vol: 0.6 });
      }
      return m.n >= n && m.t - m.st > n * 0.15 + 0.4;
    },
    meat_hooks: function (B, m, dt, P) {
      B.vx = U.approach(B.vx, 0, 600 * dt); faceP(B, P);
      if (B.flying) B.vy = (B.homeY + Math.sin(B.t * 2.5) * 6 - B.y) * 4;
      if (m.sub === 0) {
        if (tele(B, m, 0.5)) {
          m.sub = 1; m.st = m.t;
          var M = S.party.mongo, tg = (M && M.heldT <= 0) ? M : P;
          var ox = cx(B) + B.face * B.w * 0.4, oy = B.y + B.h * 0.35;
          var dx = cx(tg) - ox, dy = cy(tg) - oy, d = Math.sqrt(dx * dx + dy * dy) || 1;
          m.hook = { x: ox, y: oy, vx: dx / d * 280, vy: dy / d * 280, tg: tg, life: 1.1, boss: B, done: false };
          S.hooks.push(m.hook);
          sfx('launch', { pitch: 0.6 });
        }
        return false;
      }
      B.anim = 'attack'; B.flash = 0;
      return (!m.hook || m.hook.done) && m.t - m.st > 0.5;
    },
    darkness: function (B, m, dt, P) {
      B.vx = U.approach(B.vx, 0, 600 * dt); faceP(B, P);
      if (B.flying) B.vy = (B.homeY + Math.sin(B.t * 2.5) * 6 - B.y) * 4;
      if (m.sub === 0) {
        if (tele(B, m, 0.6)) {
          m.sub = 1; m.st = m.t;
          S.darkT = Math.max(S.darkT, num(parseFloat(m.a), 6));
          addOrb(cx(P) + U.rand(-30, 30), cy(P), 40, 6); addOrb(cx(B), cy(B), 48, 6);
          announce('DARKNESS', { color: '#6844fc', time: 1, sub: 'STAY IN THE LIGHT' });
        }
        return false;
      }
      B.anim = 'special'; B.flash = 0;
      return m.t - m.st > 0.6;
    },
    spit: function (B, m, dt, P) { if (!m.b) m.b = '3'; if (!m.a) m.a = 'spit'; return MOVES.shoot(B, m, dt, P); },
    cloak: function (B, m, dt, P) { return MOVES.teleport(B, m, dt, P); },
    reveal: function (B, m, dt, P) { return MOVES.idle(B, m, dt, P); },
    sweep: function (B, m, dt, P) { return MOVES.charge(B, m, dt, P); }
  };
  // the facade (Dispenser): camouflaged on the wall, parts open one at a time
  var FACADE = {
    reveal: function (B, m, dt, P) {
      var dur = num(parseFloat(m.a), 3);
      var part = m.part || (m.part = pickPart(B));
      B.vy = (B.homeY + Math.sin(B.t * 2.5) * 2 - B.y) * 4; B.vx = 0;
      if (m.sub === 0) {
        part.tele = 1;
        if (!m.warned) { m.warned = true; sfx('warn', { vol: 0.6 }); }
        if (m.t >= 0.7) { m.sub = 1; m.st = m.t; part.tele = 0; part.open = 1; B.lastPart = part; sfx('glass_crack', { pitch: 1.5, vol: 0.5 }); }
        return false;
      }
      if (m.sub === 1) { if (m.t - m.st >= dur) { part.open = 0; m.sub = 2; m.st = m.t; } return false; }
      return m.t - m.st > 0.3;
    },
    spit: function (B, m, dt, P) {
      var n = Math.max(1, parseInt(m.b || '3', 10) || 3), pid = m.a || 'spit', mouth = partById(B, 'mouth');
      B.vy = (B.homeY + Math.sin(B.t * 2.5) * 2 - B.y) * 4; B.vx = 0;
      if (m.sub === 0) {
        mouth.tele = 1;
        if (!m.warned) { m.warned = true; sfx('warn'); }
        if (m.t >= 0.6) { m.sub = 1; m.st = m.t; mouth.tele = 0; mouth.open = 1; m.n = 0; B.lastPart = mouth; }
        return false;
      }
      if (m.sub === 1) {
        if (m.n < n && m.t - m.st >= 0.25 + m.n * 0.32) {
          var r = partRect(B, mouth);
          fireProj(pid, cx(r), cy(r), cx(P), cy(P), { dmg: Math.max(1, Math.ceil(B.dmg * 0.75)) });
          m.n++; sfx('bomb_throw', { pitch: 0.7, vol: 0.6 });
        }
        if (m.n >= n && m.t - m.st > 0.25 + n * 0.32 + 0.9) { mouth.open = 0; m.sub = 2; m.st = m.t; }
        return false;
      }
      return m.t - m.st > 0.3;
    },
    sweep: function (B, m, dt, P) {
      m.manual = true;
      var a = S.arena, lowY = B.groundY - 14 - B.h;
      if (m.sub === 0) {
        closeParts(B);
        if (!m.warned) {
          m.warned = true; sfx('boss_roar', { pitch: 0.6 }); DCW.shake(2, 1.2);
          m.wallX = B.x; m.wallY = B.y;
          var fromLeft = cx(B) > (a.x0 + a.x1) / 2;
          m.fromX = fromLeft ? a.x0 - B.w * 0.4 : a.x1 - B.w * 0.6;
          m.toX = fromLeft ? a.x1 - B.w * 0.6 : a.x0 - B.w * 0.4;
          addHaz({ kind: 'band', x: a.x0 + TS, y: B.groundY - 14 - 44, w: a.x1 - a.x0 - 2 * TS, h: 44, tele: 1.2, life: 0, harmless: true });
        }
        B.alpha = U.lerp(B.baseAlpha, 0.95, Math.min(1, m.t / 0.9));
        B.x = m.wallX + ((Math.floor(m.t * 30) % 2) ? 1 : -1);
        if (m.t >= 1.2) { m.sub = 1; m.st = m.t; B.x = m.fromX; B.y = lowY; sfx('boss_roar', { pitch: 0.8 }); DCW.shake(3, 0.6); }
        return false;
      }
      if (m.sub === 1) {
        var s = Math.min(1, (m.t - m.st) / 1.4);
        B.x = U.lerp(m.fromX, m.toX, s); B.y = lowY;
        B.face = m.toX > m.fromX ? 1 : -1; B.anim = 'special';
        var hb = { x: B.x + 10, y: B.y + B.h * 0.5, w: B.w - 20, h: B.h * 0.5 };
        if (overlap(P, hb)) hurtPlayer(B.dmg + 1, cx(B), { cause: B.def.name || 'THE DISPENSER' });
        if (S.party.mongo && overlap(S.party.mongo, hb)) stunMongo(S.party.mongo, cx(B));
        if (Math.random() < 0.6) dust(U.rand(B.x, B.x + B.w), B.groundY, 1);
        if (s >= 1) { m.sub = 2; m.st = m.t; }
        return false;
      }
      var s2 = Math.min(1, (m.t - m.st) / 0.8);
      B.x = U.lerp(m.toX, m.wallX, s2); B.y = U.lerp(lowY, m.wallY, s2); B.alpha = U.lerp(0.95, B.baseAlpha, s2);
      if (s2 >= 1) { B.homeY = m.wallY; B.anim = 'idle'; }
      return s2 >= 1;
    },
    cloak: function (B, m, dt, P) {
      m.manual = true; m.invuln = true; closeParts(B);
      if (m.sub === 0) {
        B.alpha = Math.max(0, B.baseAlpha * (1 - m.t / 0.4));
        if (m.t >= 0.45) {
          var a0 = S.arena.x0 + TS, a1 = S.arena.x1 - TS - B.w;
          var nx = a1 > a0 ? U.rand(a0, a1) : a0, tries = 0;
          while (a1 - a0 > 60 && Math.abs(nx - B.x) < 50 && ++tries < 12) nx = U.rand(a0, a1);
          B.x = nx; B.y = B.homeY;
          m.sub = 1; m.st = m.t; sfx('teleport', { pitch: 0.7 });
        }
        return false;
      }
      B.alpha = B.baseAlpha * Math.min(1, (m.t - m.st) / 0.5);
      return m.t - m.st > 0.6;
    }
  };
  function slamLand(B, m) {
    if (m.landed) return;
    m.landed = true; m.sub = 2; m.st = m.t;
    if (B.flying) { B.y = bossGround(B) - B.h; B.vy = 0; }
    DCW.shake(5, 0.35); sfx('explosion', { vol: 0.7, pitch: 0.7 });
    dust(cx(B) - B.w / 2, B.y + B.h, 3); dust(cx(B) + B.w / 2, B.y + B.h, 3);
    slamWaves(B, 140, 0.7);
  }
  function slamWaves(B, speed, life) {
    var fy = B.y + B.h;
    var dmg = Math.max(1, B.dmg);
    addHaz({ kind: 'wave', x: B.x - 10, y: fy - 12, w: 10, h: 12, vx: -speed, life: life, dmg: dmg, cause: 'SHOCKWAVE', stunsMongo: true });
    addHaz({ kind: 'wave', x: B.x + B.w, y: fy - 12, w: 10, h: 12, vx: speed, life: life, dmg: dmg, cause: 'SHOCKWAVE', stunsMongo: true });
    sfx('stomp', { pitch: 0.6 });
  }
  function updHooks(dt) {
    var P = S.player;
    for (var i = S.hooks.length - 1; i >= 0; i--) {
      var h = S.hooks[i];
      h.life -= dt;
      h.x += h.vx * dt; h.y += h.vy * dt;
      var tg = h.tg, box = tg ? { x: tg.x - 3, y: tg.y - 3, w: tg.w + 6, h: tg.h + 6 } : null;
      if (box && h.x > box.x && h.x < box.x + box.w && h.y > box.y && h.y < box.y + box.h) {
        h.done = true;
        if (tg === S.party.mongo) { tg.heldT = 6; tg.stunT = 0; tg.state = 'follow'; numText(cx(tg), tg.y - 10, 'MEAT HOOKS!', '#f83800'); sfx('bite', { pitch: 0.6 }); track('mongo_hooked'); }
        else if (tg === P && !(P.inv > 0)) {
          if (hurtPlayer(Math.max(1, h.boss.dmg), cx(h.boss), { cause: h.boss.def.name || 'MEAT HOOKS' })) { P.vx = (cx(h.boss) < cx(P) ? -1 : 1) * 230; P.vy = -120; }
        }
      }
      if (h.life <= 0 || solidAt(h.x, h.y)) h.done = true;
      if (h.done) S.hooks.splice(i, 1);
    }
  }

  /* ================================================================
     STREETS (the playable overworld)
     ================================================================ */
  function flagsAll(v) { return arr(v).every(flag); }
  function flagsAny(v) { return arr(v).some(flag); }
  function phaseOk(ph) { return !ph || ph === 'any' || ph === (S.night ? 'night' : 'day'); }
  function doorStateFor(o) {
    var st = has(G(), 'doorState') ? call(G(), 'doorState', S.areaId, o.ch) : null;
    if (st) return st;
    var d = o.d || {};
    var vis = (!d.showIf || flagsAll(d.showIf)) && (!d.hideIf || !flagsAny(d.hideIf));
    var locked = !phaseOk(d.phase) || (d.needs && !flagsAll(d.needs));
    return { visible: vis, locked: !!locked, lockText: d.lockText || (locked ? 'LOCKED' : ''), label: d.label || '', kind: d.kind, target: d.target, cleared: false };
  }
  function refreshDoors() { for (var i = 0; i < S.objects.length; i++) { var o = S.objects[i]; if (o.kind === 'sdoor') o.st = doorStateFor(o) || { visible: false }; } }
  function refreshNpcs() {
    for (var i = 0; i < S.objects.length; i++) {
      var o = S.objects[i]; if (o.kind !== 'npc') continue;
      var n = o.npc || {};
      o.visible = phaseOk(n.phase) && (!n.showIf || flagsAll(n.showIf)) && (!n.hideIf || !flagsAny(n.hideIf));
    }
  }
  function streetList() {
    var a = S.def, ph = S.night ? 'night' : 'day', l = a.enemies && a.enemies[ph];
    return Array.isArray(l) ? l : (Array.isArray(a.enemies) ? a.enemies : []);
  }
  function streetDensity() {
    var d = S.def.density, ph = S.night ? 'night' : 'day';
    if (typeof d === 'number') return d;
    return num(d && d[ph], S.night ? 0.6 : 0.25);
  }
  function streetTarget() { var dens = streetDensity(); return dens > 0 ? Math.max(1, Math.round(dens * 2)) : 0; }
  function spawnStreetEnemy(x) {
    var list = streetList();
    if (!list.length) return null;
    var id = U.weighted(list.map(function (e) { return Array.isArray(e) ? e : [e, 1]; }));
    var d = enemyDef(id), ai = d.ai || 'walker';
    var gy = ai === 'perch' ? groundBelow(x, 0) : streetGround(x);
    var fly = ai === 'floater' || ai === 'flyer' || ai === 'swarm' || ai === 'krasue' || d.flying;
    var e = spawnEnemy(id, x, gy, { streetMob: true });
    if (fly) { e.y = gy - 52 - U.rand(0, 24); e.baseY = e.y; }
    if (ai === 'perch' && gy >= streetGround(x) - 1) { e.init = true; e.perched = false; e.hidden = false; }
    if (ai === 'swarm') for (var k = 1; k < num(d.group, 3); k++) { var m = spawnEnemy(id, x + U.rand(-14, 14), gy, { streetMob: true }); m.y = e.y + U.rand(-10, 10); m.baseY = m.y; }
    return e;
  }
  function populateStreet() {
    var P0 = S.start.x, n = Math.min(8, Math.round(streetDensity() * S.L.pxW / W)), i, x, tries;
    for (i = 0; i < n; i++) {
      tries = 0;
      do { x = U.rand(32, S.L.pxW - 32); } while (Math.abs(x - P0) < 170 && ++tries < 12);
      if (Math.abs(x - P0) >= 170) spawnStreetEnemy(x);
    }
    if (S.def.guarded && !S.night) {
      var list = S.def.citizens && S.def.citizens.length ? S.def.citizens : ['citizen_human'];
      var count = num(S.def.citizenCount, U.clamp(Math.round(S.L.pxW / 220), 3, 10));
      for (i = 0; i < count; i++) {
        x = U.rand(24, S.L.pxW - 24);
        var id = Array.isArray(list[0]) ? U.weighted(list) : U.pick(list);
        var c = spawnEnemy(id, x, streetGround(x), { citizenMob: true });
        c.citizen = true; c.hostile = false; c.face = U.chance(0.5) ? 1 : -1;
      }
    }
  }
  function setupStreet(params) {
    var run = getRun();
    S.street = { spawnT: 2.5, crimeCd: 0, alarmT: 0, doorCd: 0.4, edgeCd: 0.8, stT: 0, guardT: 0, guards: 0, eventsSent: false };
    var entry = params.entry, x = null, y = null, face = 1, i;
    if (entry && typeof entry === 'object' && entry.x !== undefined) x = +entry.x;
    else if (entry === 'right') { x = S.L.pxW - 24; face = -1; }
    else if (typeof entry === 'string' && entry !== 'left') {
      for (i = 0; i < S.objects.length; i++) { var o = S.objects[i]; if (o.kind === 'sdoor' && o.ch === entry) { x = cx(o); y = o.fy; break; } }
    }
    if (x === null && entry === undefined && run.areaX !== null && run.areaX !== undefined && run.area === S.areaId) x = run.areaX;
    if (x === null || isNaN(x)) x = 24;
    x = U.clamp(x, 12, S.L.pxW - 12);
    S.start = { x: x, y: y !== null ? y : streetGround(x), face: face };
    refreshDoors(); refreshNpcs();
    populateStreet();
    if (run.wanted === S.areaId && !S.night) callGuards();
  }
  function saveStreetPos() {
    if (S.mode !== 'street' || !S.player) return;
    call(G(), 'saveStreetPos', S.areaId, Math.round(cx(S.player)));
  }
  function useStreetDoor(o) {
    var P = S.player;
    if (S.street.doorCd > 0) return;
    S.street.doorCd = 0.8;
    o.st = doorStateFor(o);
    saveStreetPos();
    if (has(G(), 'useDoor')) { if (call(G(), 'useDoor', S.areaId, o.ch)) { P.vx = 0; S.lastDoor = o.ch; } }
    else { sfx(o.st && o.st.locked ? 'error' : 'door'); S.lastDoor = o.ch; S.fallbackMsg = (o.st && o.st.locked ? 'LOCKED: ' : 'DOOR ') + o.ch; }
  }
  function tryEdge(side) {
    var st = S.street;
    if (st.edgeCd > 0) return;
    st.edgeCd = 1.5;
    saveStreetPos();
    var ok = has(G(), 'edge') ? !!call(G(), 'edge', S.areaId, side) : false;
    if (ok) { S.leaving = true; S.player.vx = 0; }
    else if (!has(G(), 'edge')) S.fallbackMsg = 'EDGE ' + side.toUpperCase();
  }
  function callGuards() {
    var st = S.street; if (!st || S.night) return;
    spawnGuardPair();
    st.guardT = 9; st.alarmT = 10;
  }
  function spawnGuardPair() {
    [-1, 1].forEach(function (side) {
      var x = side < 0 ? Math.max(8, S.cam.x - 24) : Math.min(S.L.pxW - 8, S.cam.x + W + 24);
      var e = spawnEnemy('guard', x, streetGround(x), { alwaysActive: true, streetGuard: true });
      e.face = -side; e.hostile = true; e.invuln = true; e.aggro = 9999;
      S.street.guards++;
    });
    sfx('guard_alarm');
  }
  function updStreet(dt) {
    var st = S.street, P = S.player, run = getRun();
    st.crimeCd -= dt; st.alarmT -= dt; st.doorCd -= dt; st.edgeCd -= dt;
    st.stT -= dt; if (st.stT <= 0) { st.stT = 0.5; refreshDoors(); refreshNpcs(); }
    if (!st.eventsSent && S.t > 0.3) { st.eventsSent = true; call(G(), 'areaEvents', S.areaId); }
    st.spawnT -= dt;
    if (st.spawnT <= 0) {
      st.spawnT = U.rand(4, 7);
      var tgt = streetTarget(), alive = 0, mid = S.cam.x + W / 2;
      for (var i = 0; i < S.enemies.length; i++) { var e = S.enemies[i]; if (e.streetMob && !e.dead && Math.abs(cx(e) - mid) < W * 1.5) alive++; }
      if (alive < tgt) {
        var side = Math.random() < 0.6 ? P.face : -P.face;
        var x = side > 0 ? S.cam.x + W + 20 : S.cam.x - 20;
        if (x > 16 && x < S.L.pxW - 16) spawnStreetEnemy(x);
      }
    }
    var wanted = run.wanted === S.areaId || (!has(G(), 'crime') && st.guards > 0);
    if (st.guards > 0 && wanted && !S.night) {
      st.guardT -= dt;
      if (st.guardT <= 0 && st.guards < 4) { st.guardT = 9; spawnGuardPair(); }
    }
  }

  /* ================================================================
     CHASE: autoscroll, the pursuer lunges from the left edge
     ================================================================ */
  function setupChase() {
    var c = S.def.chase || {};
    var bid = c.pursuer || S.def.boss;
    var bd = bossDef(bid);
    S.chase = { speed: num(c.speed, 62), bossId: bid, catchDmg: num(c.catchDmg, 4), lungeT: 2.5, lunge: 0, ls: 'idle', arrived: false, sprite: bd.sprite || bid, name: bd.name || 'IT', t: 0 };
    if (S.boss) S.boss.hidden = true;
  }
  function chaseRect() { var C = S.chase; return { x: S.cam.x - 44, y: S.cam.y - 20, w: 48 + C.lunge, h: H + 40 }; }
  function updChase(dt) {
    var C = S.chase, P = S.player;
    C.t += dt;
    if (C.arrived) return;
    if (S.arena && cx(P) > S.arena.x0 + 3 * TS) {
      C.arrived = true;
      var B = S.boss;
      if (B) { B.hidden = false; B.x = S.arena.x0 + TS + 6; B.y = B.groundY - B.h; B.face = 1; smoke(cx(B), cy(B), 5); }
      return;
    }
    C.lungeT -= dt;
    if (C.ls === 'idle' && C.lungeT <= 0) { C.ls = 'out'; sfx(S.def.chase && S.def.chase.sfx || 'skate_roll'); }
    if (C.ls === 'out') { C.lunge = Math.min(60, C.lunge + 220 * dt); if (C.lunge >= 60) C.ls = 'back'; }
    else if (C.ls === 'back') { C.lunge = Math.max(0, C.lunge - 80 * dt); if (C.lunge <= 0) { C.ls = 'idle'; C.lungeT = U.rand(1.6, 3.0); } }
    if (P.state !== 'dead' && P.state !== 'pit' && P.state !== 'victory' && overlap(P, chaseRect())) {
      if (hurtPlayer(C.catchDmg, S.cam.x - 200, { cause: C.name, kby: -290 })) { P.vx = 250; track('caught'); }
      else { var r = chaseRect(); P.x = Math.max(P.x, r.x + r.w + 1); }
    }
  }

  /* ================================================================
     SURVIVAL: hold until dawn; the barricade takes the hits
     ================================================================ */
  function setupSurvival() {
    var sv = S.def.survival || {};
    var bar = null;
    for (var i = 0; i < S.objects.length; i++) if (S.objects[i].kind === 'barricade') { bar = S.objects[i]; break; }
    if (bar) { bar.hp = bar.maxHp = num(sv.barricadeHp, 40); }
    var spots = S.waveSpots && S.waveSpots.length ? S.waveSpots : [{ x: 24, y: streetGround(24) }, { x: S.L.pxW - 24, y: streetGround(S.L.pxW - 24) }];
    S.surv = { t: num(sv.seconds, 90), total: num(sv.seconds, 90), rate: num(sv.rate, 1.6), max: num(sv.max, 8), waves: sv.waves || S.def.enemies || [['street_urchin', 1]],
      spawnT: 1.5, spots: spots, bar: bar, broken: false, dawn: false };
  }
  function hitBarricade(o, dmg) {
    if (o.broken) return;
    o.hp -= dmg; o.shakeT = 0.2;
    debris(cx(o), cy(o), 3, '#c88848', 80);
    if (onScreen(o)) sfx('hit', { vol: 0.4, pitch: 0.7 });
    if (o.hp <= 0) {
      o.hp = 0; o.broken = true;
      sfx('crate_break'); DCW.shake(4, 0.4); smoke(cx(o), cy(o), 6); debris(cx(o), cy(o), 20, '#c88848', 160);
      if (S.surv) S.surv.broken = true;
      for (var i = 0; i < S.enemies.length; i++) { var e = S.enemies[i]; if (!e.dead && !e.citizen && !e.isBody) { e.hostile = true; e.target = null; } }
      var sv = S.def.survival || {}, lines = sv.breakLines;
      if (!lines) { var l = aiLine('cockroach'); lines = l ? [{ who: 'PRINCESS DONUT', portrait: 'p_donut', text: l }] : null; }
      if (lines) say(lines);
      announce('THE BARRICADE IS DOWN', { color: '#f83800', time: 2, sub: 'THEY WANT YOU NOW' });
      track('barricade_broken');
    }
  }
  function updSurvival(dt) {
    var sv = S.surv;
    if (S.done || sv.dawn) return;
    sv.t -= dt;
    if (sv.t <= 0) { dawn(); return; }
    sv.spawnT -= dt;
    var alive = 0;
    for (var i = 0; i < S.enemies.length; i++) if (!S.enemies[i].dead && !S.enemies[i].citizen) alive++;
    if (sv.spawnT <= 0 && alive < sv.max) {
      sv.spawnT = sv.rate * (0.55 + 0.45 * sv.t / sv.total) * U.rand(0.75, 1.25);
      var sp = U.pick(sv.spots), id = U.weighted(sv.waves.map(function (w) { return Array.isArray(w) ? w : [w, 1]; }));
      var e = spawnEnemy(id, sp.x + U.rand(-6, 6), sp.y, { alwaysActive: true });
      e.aggro = 600; e.init = true; e.perched = false; e.hidden = false;
      if (sv.broken && !e.citizen) e.hostile = true;
    }
  }
  function dawn() {
    var sv = S.surv; sv.dawn = true;
    flash('#fca044', 0.5);
    sfx('bell_day');
    announce('DAWN', { color: '#fca044', time: 2.2, sub: 'YOU SURVIVED THE NIGHT' });
    for (var i = 0; i < S.enemies.length; i++) { var e = S.enemies[i]; if (!e.dead) { e.dead = true; smoke(cx(e), cy(e), 3); } }
    track('dawn');
    startVictory('dawn'); S.endT = 2.2;
  }

  /* ================================================================
     PLANT AND DETONATE
     ================================================================ */
  function setupPlant() {
    var n = 0;
    for (var i = 0; i < S.objects.length; i++) if (S.objects[i].kind === 'charge') n++;
    var need = num((S.def.plant || {}).charges, n);
    S.plant = { need: Math.min(need, n), planted: 0, detonated: false, chain: null, boomT: 0 };
  }
  function detonate() {
    var pl = S.plant;
    if (pl.detonated) return;
    pl.detonated = true; pl.boomT = 0;
    flash('#fcfcfc', 0.6); DCW.shake(8, 1.8); DCW.freeze(10);
    sfx('detonate'); music(null);
    announce('KA-BOOM', { color: '#f8b800', time: 2.4, sub: S.def.detonateSub || '' });
    pl.chain = [];
    var k = 0;
    for (var i = 0; i < S.objects.length; i++) { var o = S.objects[i]; if (o.kind === 'charge' && o.planted) pl.chain.push({ at: 0.15 + (k++) * 0.22, x: cx(o), y: cy(o) }); }
    track('detonate');
  }
  function updPlantMode(dt) {
    var pl = S.plant;
    if (!pl.detonated || S.done) return;
    pl.boomT += dt;
    for (var i = pl.chain.length - 1; i >= 0; i--) {
      var c = pl.chain[i];
      if (pl.boomT >= c.at) {
        pl.chain.splice(i, 1);
        explode(c.x, c.y, 56, 99, true, 'bomb', { noSelf: true });
        for (var j = 0; j < 3; j++) fxSprite('explosion', c.x + U.rand(-30, 30), c.y + U.rand(-30, 20), 0.5, { scale: 2, size: 24, color: '#f8b800', front: true });
      }
    }
    if (!pl.chain.length && !pl.wiped) {
      pl.wiped = true;
      for (var e = 0; e < S.enemies.length; e++) { var en = S.enemies[e]; if (!en.dead && en.isBody) damageActor(en, 999, { kind: 'bomb', noCombo: true }); }
      for (e = 0; e < S.enemies.length; e++) { var en2 = S.enemies[e]; if (!en2.dead && onScreen(en2, 64) && !en2.magicOnly) damageActor(en2, 999, { kind: 'bomb', noCombo: true }); }
    }
    if (pl.boomT >= 2.6) startVictory('detonate');
  }

  /* ================================================================
     TIMED ESCAPE: the clock and the four bursts
     ================================================================ */
  function setupEscape() {
    var es = S.def.escape || {};
    var b = (es.bursts || [360, 270, 180, 90]).slice().sort(function (a, c) { return c - a; });
    S.esc = { t: num(es.seconds, 420), total: num(es.seconds, 420), bursts: b, fired: 0, rainT: 0, rainLeft: 0, selfT: K.escapeSelf, rainProj: es.rainProj || 'bolt' };
  }
  var BURST_TEXT = ['MAGIC STRIPPED', 'MAGIC WEAPONS GONE WILD', 'MAGIC ARMOR DESTROYED', 'STORED MAGIC GOING OFF'];
  function fireBurst(n) {
    var es = S.esc, P = S.player, run = getRun();
    flash('#f8f8f8', 0.4); DCW.shake(6, 0.8); DCW.freeze(10);
    sfx('burst');
    var lines = (S.def.escape || {}).burstText || BURST_TEXT;
    announce('BURST ' + n, { color: '#f878f8', time: 2.2, sub: lines[n - 1] || '' });
    if (n === 1) { S.noMagic = true; S.special = 0; S.specialLockT = K.escapeLock; S.missileQueue = []; }
    else if (n === 2) { es.rainLeft = K.escapeRain; es.rainT = 0.6; }
    else if (n === 3) { S.maxHpMul = 0.75; S.defZero = true; statCache = null; var mx = stats().maxHp; if (run.hp > mx) run.hp = mx; }
    else if (n === 4) { S.crownGone = true; es.selfT = K.escapeSelf; toast("DONUT'S CROWN CRUMBLES TO DUST.", { title: 'BURST 4', icon: 'skull', color: '#f878f8', time: 3 }); if (P) numText(cx(P), P.y - 14, 'UP+BOMB DUMPS IT ALL', '#f8d878'); }
    track('burst:' + n);
  }
  function dumpExplosives(P) {
    var n = 0;
    EXPLOSIVES.forEach(function (id) {
      var c = Math.min(itemCount(id), 8);
      for (var k = 0; k < c && n < 14; k++) { if (useItem(id, 1)) { launchX(P, id === 'smoke' ? 'smoke' : id, false, { vx: P.face * U.rand(60, 190), vy: -U.rand(160, 300) }); n++; } }
    });
    if (n) { numText(cx(P), P.y - 10, 'DUMPED ' + n + '!', '#f8d878'); track('dump'); } else sfx('error');
  }
  function updEscape(dt) {
    var es = S.esc, P = S.player;
    if (S.done || P.state === 'dead') return;
    es.t -= dt;
    while (es.fired < es.bursts.length && es.t <= es.bursts[es.fired]) { es.fired++; fireBurst(es.fired); }
    if (es.rainLeft > 0) {
      es.rainLeft -= dt; es.rainT -= dt;
      if (es.rainT <= 0) {
        es.rainT = 0.35;
        var x = cx(P) + U.rand(-150, 150), pid = es.rainProj;
        addHaz({ kind: 'marker', x: x - 6, y: S.cam.y + 2, w: 12, h: 4, life: 0, tele: 0.6, harmless: true,
          onFire: function (h) { var p = fireProj(pid, h.x + 6, S.cam.y - 6, h.x + 6, S.cam.y + H, { vx: 0, vy: 150 }); p.ghostUntil = 0.25; p.life = 3; } });
      }
    }
    if (es.fired >= 4) {
      es.selfT -= dt;
      if (es.selfT <= 0) {
        es.selfT = K.escapeSelf;
        var own = ownedX();
        if (own.length) {
          var id = U.pick(own);
          if (useItem(id, 1)) {
            var ex = cx(P) + U.rand(-26, 26), ey = cy(P) + U.rand(-8, 8);
            numText(cx(P), P.y - 12, itemName(id) + ' WENT OFF!', '#f83800');
            explode(ex, ey, 26, 3, false, 'bomb', { cause: 'STORED MAGIC' });
          }
        }
      }
    }
    if (es.t <= 0) {
      es.t = 0;
      if (S.god) { es.t = 1; return; }
      flash('#fcfcfc', 0.8); DCW.shake(8, 1.2);
      killPlayer((S.def.escape && S.def.escape.cause) || 'THE GLASS BROKE');
    }
  }

  /* ================================================================
     DROP: collapsing floors, falling rubble
     ================================================================ */
  function crumble(idx) {
    if (S.L.t[idx] !== T_ONEWAY) return;
    S.crumbles = S.crumbles || {};
    if (S.crumbles[idx] !== undefined) return;
    var L = S.L, ty = Math.floor(idx / L.w), tx = idx % L.w, x;
    for (x = tx; x >= 0 && L.t[ty * L.w + x] === T_ONEWAY && tx - x < 6; x--) S.crumbles[ty * L.w + x] = 0.45;
    for (x = tx + 1; x < L.w && L.t[ty * L.w + x] === T_ONEWAY && x - tx < 6; x++) S.crumbles[ty * L.w + x] = 0.45;
    sfx('glass_crack', { pitch: 0.6, vol: 0.5 });
  }
  function updDrop(dt) {
    var L = S.L, P = S.player;
    if (S.crumbles) {
      for (var k in S.crumbles) {
        if (!Object.prototype.hasOwnProperty.call(S.crumbles, k)) continue;
        S.crumbles[k] -= dt;
        var idx = +k, x = (idx % L.w) * TS + 8, y = Math.floor(idx / L.w) * TS + 4;
        if (Math.random() < 0.2) part({ kind: 'px', x: x + U.rand(-7, 7), y: y + 3, vx: 0, vy: 30, grav: 300, life: 0.4, color: '#8c6c4c', size: 1 });
        if (S.crumbles[k] <= 0) { L.t[idx] = T_EMPTY; delete S.crumbles[k]; debris(x, y, 6, '#8c6c4c', 80); }
      }
    }
    S.debrisT = (S.debrisT === undefined ? 3 : S.debrisT) - dt;
    if (S.debrisT <= 0 && !S.done) {
      S.debrisT = U.rand(2.2, 3.8);
      var rx = cx(P) + U.rand(-110, 110);
      addHaz({ kind: 'marker', x: rx - 6, y: S.cam.y + 2, w: 12, h: 4, life: 0, tele: 0.7, harmless: true,
        onFire: function (h) { var p = fireProj((S.def.debrisProj || 'rock'), h.x + 6, S.cam.y - 6, h.x + 6, S.cam.y + H, { vx: 0, vy: 60 }); if (p.grav <= 0) p.grav = 380; p.ghostUntil = 0.3; p.life = 3; } });
    }
  }

  /* ---------------- platforms ---------------- */
  function updPlatforms(dt) {
    for (var i = 0; i < S.platforms.length; i++) {
      var p = S.platforms[i];
      var ox = p.x, oy = p.y;
      p.prevY = p.y;
      if (p.axis === 'x') {
        p.x += p.dir * p.speed * dt;
        if (p.x > p.ox + p.range) { p.x = p.ox + p.range; p.dir = -1; }
        if (p.x < p.ox - p.range) { p.x = p.ox - p.range; p.dir = 1; }
      } else {
        p.y += p.dir * p.speed * dt;
        if (p.y > p.oy + p.range) { p.y = p.oy + p.range; p.dir = -1; }
        if (p.y < p.oy - p.range) { p.y = p.oy - p.range; p.dir = 1; }
      }
      p.dx = p.x - ox; p.dy = p.y - oy;
    }
  }
  function updParts(dt) {
    var i, p;
    for (i = S.parts.length - 1; i >= 0; i--) {
      p = S.parts[i];
      p.t += dt;
      if (p.t >= p.life) { S.parts.splice(i, 1); continue; }
      p.vy += p.grav * dt; p.x += p.vx * dt; p.y += p.vy * dt;
    }
    for (i = S.nums.length - 1; i >= 0; i--) {
      p = S.nums[i]; p.t += dt;
      if (p.t >= p.life) { S.nums.splice(i, 1); continue; }
      p.y += p.vy * dt; p.vy = Math.min(0, p.vy + 90 * dt);
    }
  }

  /* ---------------- camera ---------------- */
  function updCamera(dt, snap) {
    var P = S.player, c = S.cam, L = S.L;
    var minX = 0, maxX = L.pxW - W, maxY = L.pxH - H;
    if (S.chase && !S.chase.arrived) {
      if (snap) c.x = Math.max(0, cx(P) - 70);
      else c.x = Math.max(c.x + S.chase.speed * dt, cx(P) - W * 0.62);
      if (S.arena) maxX = Math.min(maxX, S.arena.x0);
      c.x = U.clamp(c.x, minX, Math.max(minX, maxX));
      var pyc = P.y + P.h / 2;
      if (pyc - c.y < 64) c.y = pyc - 64; else if (pyc - c.y > 118) c.y = pyc - 118;
      c.y = maxY < 0 ? maxY : U.clamp(c.y, 0, maxY);
      return;
    }
    if (P.state !== 'pit' && P.state !== 'dead') {
      c.look = snap ? P.face * K.camLook : U.approach(c.look, P.face * K.camLook, K.camLookSpeed * dt);
      var tx = cx(P) + c.look - W / 2;
      var B = S.boss;
      if (S.locked && B && !B.gone && !B.facade) {
        tx = tx * 0.6 + (cx(B) - W / 2) * 0.4;
        tx = U.clamp(tx, cx(P) - W + 56, cx(P) - 56);
      }
      var py = P.y + P.h / 2, ty = c.y;
      if (S.kind === 'drop') { if (py - c.y < 56) ty = py - 56; else if (py - c.y > 96) ty = py - 96; }
      else if (py - c.y < 64) ty = py - 64; else if (py - c.y > 118) ty = py - 118;
      if (snap && S.vertical) ty = py - (S.kind === 'drop' ? 70 : 110);
      if (S.kind === 'climb' && !snap) ty = Math.min(ty, c.y);
      if (snap) { c.x = tx; c.y = ty; }
      else { c.x += (tx - c.x) * Math.min(1, K.camLerp * dt); c.y += (ty - c.y) * Math.min(1, 7 * dt); }
    }
    if (S.locked && S.arena) { minX = S.arena.x0; maxX = S.arena.x1 - W; if (maxX < minX) minX = maxX = (S.arena.x0 + S.arena.x1 - W) / 2; }
    if (maxX < minX) maxX = minX = (L.pxW - W) / 2;
    if (snap) c.x = U.clamp(c.x, minX, maxX);
    else {
      if (c.x < minX) c.x = S.locked ? U.approach(c.x, minX, 380 * dt) : minX;
      if (c.x > maxX) c.x = S.locked ? U.approach(c.x, maxX, 380 * dt) : maxX;
    }
    c.y = maxY < 0 ? maxY : U.clamp(c.y, 0, maxY);
  }

  /* ================================================================
     SCENE
     ================================================================ */
  function firstLevelId() {
    var lv = D().levels || D().stages || {}, k = Object.keys(lv);
    return k.length ? k[0] : 'debug';
  }
  function enter(params) {
    params = params || {};
    I = DCW.input;
    artHas = {}; statCache = null; S = null;
    var run = getRun();
    var levelId = params.levelId || params.stageId;
    var areaId = params.areaId || (!levelId && !run.levelId ? run.area : null);
    if (areaId) { buildStreet(areaId); setupStreet(params); }
    else buildLevel(levelId || run.levelId || firstLevelId());
    S.player = makePlayer(S.start.x, S.start.y);
    if (S.start.face) S.player.face = S.start.face;
    S.lastSafe = { x: S.start.x, y: S.start.y };
    setupParty();
    if (S.isBoss) S.boss = makeBoss();
    if (S.mode === 'level') {
      if (S.kind === 'chase' || S.def.chase) setupChase();
      if (S.kind === 'survival' || S.def.survival) setupSurvival();
      if (S.kind === 'plant' || S.def.plant) setupPlant();
      if (S.kind === 'escape' || S.def.escape) setupEscape();
    }
    var mx = stats().maxHp;
    if (!(run.hp > 0)) run.hp = mx;
    if (run.hp > mx) run.hp = mx;
    if (has(ART(), 'prepare')) call(ART(), 'prepare', S.theme);
    updCamera(0, true);
    if (S.mode === 'street') {
      music((S.night && S.def.musicNight) || S.def.music);
      announce(S.def.name || 'THE OVER CITY', { time: 1.4, sub: clock().label || '' });
    } else {
      if (S.def.music) music(S.def.music);
      announce(S.def.name || 'LEVEL', { time: 1.6, sub: S.swap ? 'YOU ARE MONGO' : S.solo ? 'ALONE' : '' });
    }
  }
  function exit() { if (S) S.exited = true; }
  function update(dt) {
    if (!S || S.exited) return;
    var P = S.player;
    S.t += dt; S.frameParity = !S.frameParity;
    if (S.quipT > 0) S.quipT -= dt;
    if (S.flashT > 0) S.flashT -= dt;
    if (S.darkT > 0) S.darkT -= dt;
    if (S.specialLockT > 0) S.specialLockT -= dt;
    call(G(), 'tick', dt);
    if (S.introPending && S.t > 0.5) { var line = S.introPending; S.introPending = null; say(line); }
    if (I.pressed('start') && !S.done && P.state !== 'dead' && P.state !== 'pit' && !S.leaving) {
      if (has(UI(), 'openPause')) { call(UI(), 'openPause', { canFlee: S.mode === 'level' }); return; }
    }
    if (I.pressed('select') && !S.done && has(UI(), 'openMap')) { call(UI(), 'openMap'); return; }
    if (S.done && S.endT >= 0) {
      if (S.pendingDefeat) { var dl = S.pendingDefeat; S.pendingDefeat = null; say(dl); }
      S.endT -= dt;
      if (S.endT <= 0 && S.endKind) { S.endT = -1; finishStage(); }
    }
    updPlatforms(dt);
    if (S.street) updStreet(dt);
    if (S.chase) updChase(dt);
    if (S.surv) updSurvival(dt);
    if (S.plant) updPlantMode(dt);
    if (S.esc) updEscape(dt);
    if (S.kind === 'drop') updDrop(dt);
    updPlayer(dt);
    updParty(dt);
    updAllies(dt);
    updEnemies(dt);
    updBoss(dt);
    updHooks(dt);
    updProjectiles(dt);
    updHaz(dt);
    updFires(dt);
    updClouds(dt);
    updOrbs(dt);
    updRegrows(dt);
    updCorpses(dt);
    updPickups(dt);
    updParts(dt);
    if (S.comboT > 0) { S.comboT -= dt; if (S.comboT <= 0) S.combo = 0; }
    if (!S.done && !S.swap && S.specialLockT <= 0) S.special = Math.min(1, S.special + K.specialPassive * dt);
    computeLights();
    updCamera(dt, false);
  }
  function idle() { /* UI modal open: the world holds still */ }

  /* ================================================================
     DRAWING
     ================================================================ */
  var SOLIDISH = [false, true, true, false, false, false, false, true, true, false];
  function drawTiles(ctx, camX, camY) {
    var L = S.L, art = ART(), useArt = has(art, 'tile');
    var tx0 = Math.max(0, Math.floor(camX / TS)), tx1 = Math.min(L.w - 1, Math.floor((camX + W) / TS));
    var ty0 = Math.max(0, Math.floor(camY / TS)), ty1 = Math.min(L.h - 1, Math.floor((camY + H) / TS));
    tileInfo.t = S.t; tileInfo.night = S.night;
    for (var ty = ty0; ty <= ty1; ty++) {
      for (var tx = tx0; tx <= tx1; tx++) {
        var t = L.t[ty * L.w + tx];
        if (!t || t === T_DECO) continue;
        var x = tx * TS - camX, y = ty * TS - camY;
        if (S.crumbles && S.crumbles[ty * L.w + tx] !== undefined) x += (Math.floor(S.t * 30) % 2) ? 1 : -1;
        if (useArt) {
          var sol = SOLIDISH[t];
          var u = ty > 0 ? L.t[(ty - 1) * L.w + tx] : 0, d = ty < L.h - 1 ? L.t[(ty + 1) * L.w + tx] : (sol ? 1 : 0);
          var l = tx > 0 ? L.t[ty * L.w + tx - 1] : (sol ? 1 : 0), r = tx < L.w - 1 ? L.t[ty * L.w + tx + 1] : (sol ? 1 : 0);
          tileInfo.up = sol ? SOLIDISH[u] : u === t; tileInfo.down = sol ? SOLIDISH[d] : d === t;
          tileInfo.left = sol ? SOLIDISH[l] : l === t; tileInfo.right = sol ? SOLIDISH[r] : r === t;
          tileInfo.tx = tx; tileInfo.ty = ty;
          try { art.tile(ctx, S.theme, CH_OF[t], x, y, tileInfo); continue; } catch (e) { console.error('[stage] art.tile', e); useArt = false; }
        }
        drawFallbackTile(ctx, t, x, y);
      }
    }
  }
  function drawFallbackTile(ctx, t, x, y) {
    ctx.fillStyle = FALLBACK_TILE_COLOR[t] || '#888';
    if (t === T_ONEWAY) { ctx.fillRect(x, y, TS, 4); ctx.fillStyle = '#000'; ctx.fillRect(x, y + 4, TS, 1); return; }
    if (t === T_SPIKE) { for (var i = 0; i < 4; i++) ctx.fillRect(x + i * 4 + 1, y + 8 + (i % 2) * 2, 2, 8); return; }
    if (t === T_LIQUID) { ctx.fillRect(x, y + 4 + ((S.t * 4 + x / 16) % 2 | 0), TS, 12); return; }
    if (t === T_LADDER) { ctx.fillRect(x + 3, y, 2, TS); ctx.fillRect(x + 11, y, 2, TS); ctx.fillRect(x + 3, y + 3, 10, 2); ctx.fillRect(x + 3, y + 11, 10, 2); return; }
    ctx.fillRect(x, y, TS, TS);
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(x, y + TS - 2, TS, 2); ctx.fillRect(x + TS - 2, y, 2, TS);
    if (t === T_CRATE) { ctx.fillStyle = '#5c3010'; ctx.fillRect(x + 2, y + 7, 12, 2); ctx.fillRect(x + 7, y + 2, 2, 12); }
    if (t === T_GATE) { ctx.fillStyle = '#1c1c24'; ctx.fillRect(x + 2, y, 3, TS); ctx.fillRect(x + 7, y, 3, TS); ctx.fillRect(x + 12, y, 3, TS); ctx.fillRect(x, y + 3, TS, 2); }
  }
  function drawTileAt(ctx, ch, x, y, tx, ty) {
    var art = ART();
    if (has(art, 'tile')) {
      tileInfo.up = false; tileInfo.down = false; tileInfo.left = tx === undefined ? true : tx > 0; tileInfo.right = tx === undefined ? true : tx < 2; tileInfo.t = S.t;
      tileInfo.tx = tx || 0; tileInfo.ty = ty || 0; tileInfo.night = S.night;
      try { art.tile(ctx, S.theme, ch, x, y, tileInfo); return; } catch (e) { /* fall through */ }
    }
    drawFallbackTile(ctx, TILE_OF[ch] || 1, x, y);
  }
  var bgOpts = { night: false, t: 0 };
  function draw(ctx) {
    if (!S) return;
    var camX = Math.round(S.cam.x), camY = Math.round(S.cam.y), i, P = S.player;
    bgOpts.night = S.night; bgOpts.t = S.t;
    if (has(ART(), 'background')) { try { DCW.art.background(ctx, S.theme, camX, camY, bgOpts); } catch (e) { console.error('[stage] background', e); ctx.fillStyle = '#101828'; ctx.fillRect(0, 0, W, H); } }
    else { ctx.fillStyle = S.night ? '#080818' : '#301810'; ctx.fillRect(0, 0, W, H); }
    if (S.boss && S.boss.facade && !S.boss.gone) drawFacade(ctx, S.boss, camX, camY);
    drawTiles(ctx, camX, camY);
    for (i = 0; i < S.objects.length; i++) drawObject(ctx, S.objects[i], camX, camY);
    for (i = 0; i < S.platforms.length; i++) {
      var pl = S.platforms[i];
      if (pl.x + pl.w < camX || pl.x > camX + W) continue;
      for (var k = 0; k < 3; k++) drawTileAt(ctx, '=', Math.round(pl.x - camX) + k * 16, Math.round(pl.y - camY), k, i);
    }
    drawFires(ctx, camX, camY);
    drawGround(ctx, camX, camY);
    for (i = 0; i < S.haz.length; i++) drawHaz(ctx, S.haz[i], camX, camY);
    for (i = 0; i < S.pickups.length; i++) drawPickup(ctx, S.pickups[i], camX, camY);
    for (i = 0; i < S.enemies.length; i++) { var e = S.enemies[i]; if (!e.dead && onScreen(e, 24)) drawEnemy(ctx, e, camX, camY); }
    if (S.boss && !S.boss.gone && !S.boss.facade && !S.boss.hidden) drawBoss(ctx, S.boss, camX, camY);
    if (S.boss && S.boss.facade && !S.boss.gone) drawFacadeParts(ctx, S.boss, camX, camY);
    if (S.chase && !S.chase.arrived) drawPursuer(ctx, camX, camY);
    drawHooks(ctx, camX, camY);
    drawAllies(ctx, camX, camY);
    if (S.party.katia) drawFollower(ctx, S.party.katia, 'katia', camX, camY);
    if (S.party.mongo) drawMongo(ctx, S.party.mongo, camX, camY);
    if (S.party.donut) drawDonut(ctx, S.party.donut, P, camX, camY);
    drawPlayer(ctx, P, camX, camY);
    for (i = 0; i < S.eproj.length; i++) {
      var p = S.eproj[i];
      spr(ctx, p.sprite, cx(p) - camX, p.y + p.h - camY, Math.floor(p.t * 10), p.vx < 0, null, p.w, p.h, p.color || '#f83800');
    }
    for (i = 0; i < S.pproj.length; i++) drawPProj(ctx, S.pproj[i], camX, camY);
    drawClouds(ctx, camX, camY);
    for (i = 0; i < S.parts.length; i++) drawPart(ctx, S.parts[i], camX, camY);
    for (i = 0; i < S.nums.length; i++) {
      var n = S.nums[i];
      if (n.t > n.life - 0.15 && Math.floor(n.t * 30) % 2) continue;
      DCW.text(n.text, Math.round(n.x - camX), Math.round(n.y - camY - 8 * n.scale), n.color, { align: 'center', scale: n.scale });
    }
    drawLabels(ctx, camX, camY);
    drawDark(ctx, camX, camY);
    drawPips(ctx, camX, camY);
    if (S.flashT > 0) { ctx.globalAlpha = Math.min(0.7, S.flashT * 4); ctx.fillStyle = S.flashColor; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; }
    drawHud(ctx);
    if (S.god) DCW.text('GOD', 4, H - 10, '#f8d878');
    if (S.fallbackMsg) DCW.text(S.fallbackMsg, W / 2, 80, '#fcfcfc', { align: 'center', scale: 2 });
  }
  function itemSprite(id) { var q = itemDef(id) || {}; return firstArt([q.sprite, q.icon, id, 'qi_' + id, 'qi_key']); }
  function drawObject(ctx, o, camX, camY) {
    if (o.x + o.w < camX - 40 || o.x > camX + W + 40) return;
    if (o.y + o.h < camY - 40 || o.y > camY + H + 40) return;
    var x = cx(o) - camX, y = o.y + o.h - camY, t = S.t;
    switch (o.kind) {
      case 'door': {
        var locked = (o.needs && !hasItem(o.needs)) || (S.plant && !S.plant.detonated);
        spr(ctx, o.open ? 'door_open' : locked && hasArt('door_locked') ? 'door_locked' : 'door', x, y, 0, false, null, 24, 36, o.open ? '#000' : locked ? '#7c7c7c' : '#7c4c2c');
        break;
      }
      case 'sdoor': {
        if (!o.st || !o.st.visible) break;
        var sp = o.st.sprite || o.sprite;
        if (sp) spr(ctx, sp, x, o.fy - camY, Math.floor(t * 2), false, null, o.w, o.h, '#5c3c18');
        else if (o.d && o.d.target && hasArt(o.d.target)) spr(ctx, o.d.target, x, o.fy - camY, Math.floor(t * 2), cx(S.player) < cx(o), null, 14, 22, '#bcbcbc');
        if (o.st.locked && sp) spr(ctx, 'lock', x, Math.round(o.y + o.h * 0.55 - camY), 0, false, null, 8, 8, '#f8b800');
        break;
      }
      case 'npc': {
        if (!o.visible || !o.sprite) break;
        var nm = firstArt([o.sprite, o.sprite + '_idle']);
        spr(ctx, nm, x, o.fy - camY, Math.floor(t * 2), cx(S.player) < cx(o), null, 14, 22, '#f8b8f8');
        break;
      }
      case 'signpost': {
        var on = o.on || (S.areaId && flag('map_' + S.areaId));
        spr(ctx, on && hasArt('signpost_on') ? 'signpost_on' : 'signpost', x, y, Math.floor(t * 3), false, null, 16, 18, on ? '#58f898' : '#7c7c7c');
        break;
      }
      case 'charge': {
        if (o.planted) spr(ctx, 'charge', x, y, Math.floor(t * 4), false, null, 8, 12, Math.floor(t * 4) % 2 ? '#f83800' : '#881400');
        else {
          spr(ctx, 'charge_spot', x, y, Math.floor(t * 2), false, null, 14, 4, '#f8d878');
          if (o.prog > 0) { DCW.bar(Math.round(x - 10), Math.round(y - 26), 20, 3, o.prog / K.plantTime, '#58f898', '#000'); }
        }
        break;
      }
      case 'decoySpot': if (!o.used) spr(ctx, firstArt(['decoy_spot', 'charge_spot']), x, y, Math.floor(t * 2), false, null, 14, 4, '#58d854'); break;
      case 'detonator': spr(ctx, 'detonator', x, y, S.plant && S.plant.planted >= S.plant.need ? Math.floor(t * 4) : 0, false, null, 14, 14, '#d82800'); break;
      case 'trash': if (!o.gone) spr(ctx, 'trash', x, y, 0, false, null, 14, 10, '#7c7c7c'); break;
      case 'statue': spr(ctx, 'guard_statue', x, y, 0, false, null, 16, 32, '#7c7c7c'); break;
      case 'barricade': {
        var sx = o.shakeT > 0 ? ((Math.floor(t * 40) % 2) ? 1 : -1) : 0; if (o.shakeT > 0) o.shakeT -= 1 / 60;
        spr(ctx, o.broken ? 'barricade_broken' : 'barricade', x + sx, y, 0, false, null, 28, o.broken ? 8 : 28, o.broken ? '#503000' : '#a86c30');
        if (!o.broken && o.hp < o.maxHp) DCW.bar(Math.round(x - 12), Math.round(o.y - camY - 6), 24, 2, o.hp / o.maxHp, '#f8b800', '#000');
        break;
      }
      case 'ticket': {
        if (o.taken) break;
        o.t += 1 / 60;
        var bob = Math.round(Math.sin(o.t * 4) * 2);
        if (Math.floor(o.t * 6) % 3 === 0) { ctx.globalAlpha = 0.35; DCW.rect(x - 9, y - 18 + bob, 18, 18, '#fce0a8'); ctx.globalAlpha = 1; }
        spr(ctx, firstArt([o.sprite, 'custard', 'scratch_ticket']), x, y + bob, Math.floor(o.t * 4), false, null, 12, 12, '#fce0a8');
        break;
      }
      case 'lever': spr(ctx, 'lever', x, y, o.on ? 1 : 0, false, null, 8, 14, o.on ? '#58d854' : '#f83800'); break;
      case 'qitem': {
        if (o.taken) break;
        o.t += 1 / 60;
        var qb = Math.round(Math.sin(o.t * 3) * 2);
        if (Math.floor(o.t * 6) % 3 === 0) { ctx.globalAlpha = 0.35; DCW.rect(x - 9, y - 18 + qb, 18, 18, '#f8d878'); ctx.globalAlpha = 1; }
        spr(ctx, itemSprite(o.id), x, y + qb, Math.floor(o.t * 4), false, null, 12, 12, '#f8d878');
        break;
      }
      case 'cage': {
        o.t += 1 / 60; if (o.shakeT > 0) o.shakeT -= 1 / 60;
        var cs = o.shakeT > 0 ? Math.round(Math.sin(o.t * 60) * 2) : 0;
        if (!o.broken) spr(ctx, firstArt([o.comp + '_idle', o.comp]), x, y - 2, Math.floor(o.t * 2), true, null, 12, 12, '#f878f8');
        spr(ctx, o.broken ? 'cage_broken' : 'cage', x + cs, y, Math.floor(o.t * 1.5), false, null, 22, 26, '#7c7c7c');
        break;
      }
      case 'checkpoint': spr(ctx, 'checkpoint', x, y, o.on ? 1 : 0, false, null, 6, 24, o.on ? '#58f898' : '#f83800'); break;
      case 'sign': spr(ctx, 'sign', x, y, 0, false, null, 14, 14, '#c88848'); break;
      case 'chest': spr(ctx, o.open ? 'chest_open' : 'chest', x, y, 0, false, null, 16, 12, o.open ? '#7c4c2c' : '#f8b800'); break;
    }
  }
  function drawLabels(ctx, camX, camY) {
    var P = S.player, i, o;
    if (P.state !== 'normal' && P.state !== 'climb' && P.state !== 'plant') return;
    for (i = 0; i < S.objects.length; i++) {
      o = S.objects[i];
      if (o.kind !== 'sdoor' || !o.st || !o.st.visible) continue;
      var d = Math.abs(cx(o) - cx(P));
      if (d > 46 || Math.abs(o.fy - (P.y + P.h)) > 40) continue;
      var lx = Math.round(cx(o) - camX), ly = Math.round(o.y - camY - 11);
      var label = (o.st.label || (o.d && o.d.label) || '') + (o.st.cleared ? ' ✓' : '');
      if (label) {
        var tw = DCW.textWidth ? DCW.textWidth(label) : label.length * 6;
        lx = U.clamp(lx, tw / 2 + 2, W - tw / 2 - 2);
        ctx.globalAlpha = 0.65; DCW.rect(lx - tw / 2 - 2, ly - 1, tw + 4, 9, '#000'); ctx.globalAlpha = 1;
        DCW.text(label, lx, ly, o.st.locked ? '#bcbcbc' : '#f8d878', { align: 'center' });
      }
      if (o.st.locked && o.st.lockText && d < 30) DCW.text(o.st.lockText, U.clamp(lx, 60, W - 60), ly - 10, '#f83800', { align: 'center' });
    }
    var near = interactAt(P);
    if (near && Math.floor(S.t * 3) % 2 === 0) {
      var ay = near.kind === 'sdoor' ? near.y - 22 : near.y - 12;
      DCW.text('↑', Math.round(cx(near) - camX), Math.round(ay - camY), '#fcfcfc', { align: 'center' });
    }
  }
  function drawPips(ctx, camX, camY) {
    if (!S.party.donut || S.noMagic) return;
    var blink = Math.floor(S.t * 4) % 2 === 0;
    if (!blink) return;
    for (var i = 0; i < S.enemies.length; i++) {
      var e = S.enemies[i];
      if (e.dead || !e.hidden || !onScreen(e, 4)) continue;
      ctx.fillStyle = '#000'; ctx.fillRect(Math.round(cx(e) - camX) - 2, Math.round(e.y - camY) - 7, 4, 4);
      ctx.fillStyle = '#f8d878'; ctx.fillRect(Math.round(cx(e) - camX) - 1, Math.round(e.y - camY) - 6, 2, 2);
    }
    var B = S.boss;
    if (B && B.facade && B.nextPart && !B.dying && B.active) {
      var r = partRect(B, B.nextPart);
      ctx.fillStyle = '#000'; ctx.fillRect(Math.round(cx(r) - camX) - 3, Math.round(r.y - camY) - 9, 6, 6);
      ctx.fillStyle = '#f8d878'; ctx.fillRect(Math.round(cx(r) - camX) - 2, Math.round(r.y - camY) - 8, 4, 4);
    }
  }
  function drawPickup(ctx, p, camX, camY) {
    if (p.x + p.w < camX || p.x > camX + W) return;
    if (p.life > 0 && p.life < 2 && Math.floor(p.life * 10) % 2) return;
    var bob = p.phys || p.magnet ? 0 : Math.round(Math.sin(S.t * 4 + p.bob) * 1.5);
    var x = cx(p) - camX, y = p.y + p.h - camY + bob;
    switch (p.kind) {
      case 'coin': spr(ctx, 'coin', x, y, Math.floor(S.t * 10 + p.bob), false, null, 6, 7, '#f8d878'); break;
      case 'snack': spr(ctx, 'snack', x, y, 0, false, null, 8, 7, '#58f898'); break;
      case 'xpl': drawIcon(ctx, p.value || 'jug', x - 4, y - 8, XCOLOR[p.value] || '#f8b800'); break;
      case 'potion': spr(ctx, 'potion', x, y, 0, false, null, 6, 8, '#f83800'); break;
      case 'box': spr(ctx, 'box_bronze', x, y, Math.floor(S.t * 4), false, null, 12, 12, '#c87838'); break;
    }
  }
  function drawFires(ctx, camX, camY) {
    for (var i = 0; i < S.fires.length; i++) {
      var f = S.fires[i], fade = Math.min(1, f.life / 0.5);
      for (var x = f.x0 + 4; x < f.x1; x += 10) {
        var fr = Math.floor(S.t * 10 + x * 0.3);
        if (hasArt('fire')) spr(ctx, 'fire', x - camX, f.y - camY, fr, (x | 0) % 20 < 10, { alpha: fade });
        else {
          var hh = 6 + (fr % 3) * 3;
          ctx.globalAlpha = fade; ctx.fillStyle = '#f83800'; ctx.fillRect(Math.round(x - camX) - 3, Math.round(f.y - camY) - hh, 6, hh);
          ctx.fillStyle = '#f8b800'; ctx.fillRect(Math.round(x - camX) - 1, Math.round(f.y - camY) - hh + 3, 3, hh - 3); ctx.globalAlpha = 1;
        }
      }
    }
  }
  function drawGround(ctx, camX, camY) {
    var i;
    for (i = 0; i < S.regrows.length; i++) {
      var r = S.regrows[i], x = Math.round(r.x - camX), y = Math.round(r.y - camY), pulse = Math.floor(S.t * 6) % 2;
      ctx.fillStyle = '#000'; ctx.fillRect(x - 8, y - 5 - pulse, 16, 5 + pulse);
      ctx.fillStyle = '#58d854'; ctx.fillRect(x - 7, y - 4 - pulse, 6, 4 + pulse); ctx.fillStyle = '#f878f8'; ctx.fillRect(x - 1, y - 4, 7, 4);
      ctx.fillStyle = '#00a800'; ctx.fillRect(x + 2, y - 3 - pulse, 2, 2);
    }
    if (S.hasUrchins) for (i = 0; i < S.corpses.length; i++) {
      var c = S.corpses[i]; if (c.gone || !onScreen(c, 16)) continue;
      spr(ctx, c.sprite + '_hurt', cx(c) - camX, c.y + c.h - camY, 0, c.face < 0, { alpha: 0.5 }, 12, 5, '#7c4c2c');
    }
  }
  function drawClouds(ctx, camX, camY) {
    for (var i = 0; i < S.clouds.length; i++) {
      var c = S.clouds[i], a = Math.min(0.85, c.life / 1.2) * 0.85;
      for (var k = 0; k < 7; k++) {
        var ang = k * 0.9 + c.t * 0.4, rr = c.r * (0.35 + (k % 3) * 0.2);
        var px = c.x + Math.cos(ang) * rr * 0.8 - camX, py = c.y + Math.sin(ang) * rr * 0.45 - camY;
        if (hasArt('smoke')) spr(ctx, 'smoke', px, py + 8, k % 3, k % 2 === 0, { alpha: a, scale: 2 });
        else { ctx.globalAlpha = a; ctx.fillStyle = k % 2 ? '#bcbcbc' : '#7c7c7c'; ctx.beginPath(); ctx.arc(Math.round(px), Math.round(py), 9 + (k % 3) * 2, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1; }
      }
    }
  }
  function drawHaz(ctx, h, camX, camY) {
    var x = Math.round(h.x - camX), y = Math.round(h.y - camY), telegraph = h.t < h.tele;
    var blink = Math.floor(S.t * 16) % 2 === 0;
    switch (h.kind) {
      case 'marker':
        if (telegraph && blink) { DCW.text('▼', x + h.w / 2, y, '#f83800', { align: 'center' }); ctx.fillStyle = 'rgba(248,56,0,0.35)'; ctx.fillRect(x + 4, y + 10, 4, H); }
        break;
      case 'band':
        if (telegraph) { ctx.fillStyle = blink ? 'rgba(248,56,0,0.28)' : 'rgba(248,56,0,0.12)'; ctx.fillRect(x, y, h.w, h.h); if (blink) { ctx.fillStyle = '#f83800'; ctx.fillRect(x, y + h.h - 1, h.w, 1); DCW.text('DUCK!', x + h.w / 2, y + h.h + 2, '#f8d878', { align: 'center' }); } }
        break;
      case 'beam':
        if (telegraph) { if (blink) { ctx.fillStyle = '#f83800'; ctx.fillRect(x, y + h.h / 2 - 1, h.w, 1); } ctx.fillStyle = 'rgba(248,56,0,0.2)'; ctx.fillRect(x, y, h.w, h.h); }
        else { var j = Math.floor(S.t * 30) % 2; ctx.fillStyle = '#f83800'; ctx.fillRect(x, y - j, h.w, h.h + 2 * j); ctx.fillStyle = '#fcfcfc'; ctx.fillRect(x, y + 3, h.w, h.h - 6); }
        break;
      case 'spikes':
        if (telegraph) { if (blink) { ctx.fillStyle = '#f83800'; ctx.fillRect(x, y + h.h - 2, h.w, 2); DCW.text('!', x + h.w / 2, y + h.h - 12, '#f83800', { align: 'center' }); } }
        else {
          var grow = Math.min(1, (h.t - h.tele) / 0.08), sh = Math.round(h.h * grow);
          for (var i = 0; i < h.w; i += 6) {
            ctx.fillStyle = '#000'; ctx.fillRect(x + i, y + h.h - sh, 5, sh);
            ctx.fillStyle = '#d8d8d8'; ctx.fillRect(x + i + 1, y + h.h - sh + 2, 3, sh - 2); ctx.fillRect(x + i + 2, y + h.h - sh, 1, 2);
          }
        }
        break;
      case 'wave':
        if (!telegraph) spr(ctx, 'shockwave', x + h.w / 2, y + h.h, Math.floor(h.t * 12), h.vx < 0, null, h.w, h.h, '#fcfcfc');
        break;
      case 'stab':
        ctx.fillStyle = '#fcfcfc'; ctx.fillRect(x, y + (h.h >> 1) - 1, h.w, 2); ctx.fillStyle = '#bcbcbc'; ctx.fillRect(x, y + (h.h >> 1) + 1, h.w, 1);
        if (h.lethal) { ctx.globalAlpha = 0.35; ctx.fillStyle = '#fcfcfc'; ctx.fillRect(x, y, h.w, h.h); ctx.globalAlpha = 1; }
        break;
      case 'ring': {
        ctx.strokeStyle = blink ? '#f878f8' : '#d800cc'; ctx.globalAlpha = 1 - h.r / h.rmax * 0.6;
        ctx.beginPath(); ctx.arc(Math.round(h.cx - camX), Math.round(h.cy - camY), h.r, 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath(); ctx.arc(Math.round(h.cx - camX), Math.round(h.cy - camY), Math.max(1, h.r - 3), 0, Math.PI * 2); ctx.stroke();
        ctx.globalAlpha = 1;
        break;
      }
    }
  }
  function enemySprite(e) {
    var base = e.sprite;
    if (e.objSprite) return e.objSprite;
    if (e.hurtT > 0 && hasArt(base + '_hurt')) return base + '_hurt';
    if (e.tele || e.state === 'dash' || e.state === 'swoop' || e.state === 'stab' || e.state === 'slash' || e.state === 'wind') return hasArt(base + '_attack') ? base + '_attack' : base + '_walk';
    return base + '_walk';
  }
  function drawEnemy(ctx, e, camX, camY) {
    if (e.state === 'gone') return;
    var name = enemySprite(e), frame = Math.floor(e.t * (e.ai === 'urchin' && Math.abs(e.vx) > 5 ? 12 : 6));
    if (e.ai === 'turret' || e.ai === 'spawner' || e.ai === 'launcher' || e.perched) { if (!e.tele) frame = Math.floor(e.t * 2); }
    var x = cx(e) - camX, y = e.y + e.h - camY;
    var shake = (e.tele && (e.ai === 'charger' || e.ai === 'hopper' || e.ai === 'berserker' || e.ai === 'guard')) ? (Math.floor(e.t * 30) % 2 ? 1 : -1) : 0;
    var flip = e.face < 0;
    var alpha = e.hidden ? 0.3 : (e.ai === 'swarm' || e.magicOnly ? 0.78 : 1);
    if (e.state === 'flung') frame = Math.floor(e.t * 16);
    if (e.elite) {
      var a = 0.55 + Math.sin(S.t * 8) * 0.25;
      spr(ctx, name, x - 1, y, frame, flip, { flash: true, alpha: a }, e.w, e.h, '#fff');
      spr(ctx, name, x + 1, y, frame, flip, { flash: true, alpha: a }, e.w, e.h, '#fff');
      spr(ctx, name, x, y - 1, frame, flip, { flash: true, alpha: a }, e.w, e.h, '#fff');
      spr(ctx, name, x, y + 1, frame, flip, { flash: true, alpha: a }, e.w, e.h, '#fff');
    }
    spr(ctx, name, x + shake, y, frame, flip, { flash: e.flash > 0, alpha: alpha }, e.w, e.h, e.color);
    if (e.inDark && Math.floor(S.t * 8) % 2) { ctx.fillStyle = '#f83800'; ctx.fillRect(Math.round(x) - 2, Math.round(e.y - camY) + 3, 1, 1); ctx.fillRect(Math.round(x) + 2, Math.round(e.y - camY) + 3, 1, 1); }
    if (e.elite) DCW.text('★', Math.round(x), Math.round(e.y - camY - 10), '#f8d878', { align: 'center' });
    if (e.stun > 0 && Math.floor(S.t * 6) % 2) DCW.text('*', Math.round(x), Math.round(e.y - camY - 9), '#3cbcfc', { align: 'center' });
    if (e.lostT > 0 && Math.floor(S.t * 3) % 2) DCW.text('?', Math.round(x), Math.round(e.y - camY - 9), '#bcbcbc', { align: 'center' });
    if (!e.hostile && !e.citizen && !e.isBody && e.ai === 'urchin' && e.blockT > 0.3) DCW.text('!', Math.round(x), Math.round(e.y - camY - 9), '#f8b800', { align: 'center' });
    if (e.hp < e.maxHp && e.maxHp > 3 && !e.invuln) {
      var bw = Math.max(10, e.w);
      ctx.fillStyle = '#000'; ctx.fillRect(Math.round(x - bw / 2), Math.round(e.y - camY - 4), bw, 2);
      ctx.fillStyle = e.elite ? '#f8d878' : '#f83800'; ctx.fillRect(Math.round(x - bw / 2), Math.round(e.y - camY - 4), Math.round(bw * Math.max(0, e.hp) / e.maxHp), 2);
    }
  }
  function drawBoss(ctx, B, camX, camY) {
    var base = B.sprite, anim = B.anim || 'idle';
    if (B.flash > 0 && B.move && !B.move.warned && hasArt(base + '_hurt') && !B.dying) anim = 'hurt';
    if (B.dying) anim = hasArt(base + '_hurt') ? 'hurt' : 'idle';
    var name = base + '_' + anim;
    if (!hasArt(name)) name = anim === 'special' && hasArt(base + '_attack') ? base + '_attack' : base + '_idle';
    var frame = Math.floor(B.t * (anim === 'walk' ? 6 : 3));
    var x = cx(B) - camX + (B.dying ? U.randi(-2, 2) : 0), y = B.y + B.h - camY;
    spr(ctx, name, x, y, frame, B.face < 0, { flash: B.flash > 0, alpha: B.alpha }, B.w, B.h, B.cured ? '#7c4c2c' : '#a81000');
    if (B.stun > 0 && Math.floor(S.t * 6) % 2) DCW.text('* * *', Math.round(x), Math.round(B.y - camY - 10), '#3cbcfc', { align: 'center' });
  }
  function drawFacade(ctx, B, camX, camY) {
    var x = cx(B) - camX + (B.dying ? U.randi(-2, 2) : 0), y = B.y + B.h - camY;
    var name = B.sprite + '_body';
    if (hasArt(name)) spr(ctx, name, x, y, Math.floor(B.t * 2), B.face > 0 && B.anim === 'special', { alpha: B.alpha, flash: B.flash > 0 && B.alpha > 0.5 });
    else {
      ctx.globalAlpha = B.alpha;
      ctx.fillStyle = '#3c2c4c';
      ctx.beginPath(); ctx.ellipse(Math.round(x), Math.round(y - B.h / 2), B.w / 2, B.h / 2, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#5c4c6c'; ctx.fillRect(Math.round(x - B.w / 2), Math.round(y - B.h * 0.3), B.w, 6);
      ctx.globalAlpha = 1;
    }
  }
  function drawFacadeParts(ctx, B, camX, camY) {
    if (B.dying) return;
    for (var i = 0; i < B.parts.length; i++) {
      var p = B.parts[i];
      if (!(p.open > 0) && !p.tele) continue;
      if (p.tele && Math.floor(S.t * 12) % 2) continue;
      var r = partRect(B, p), x = cx(r) - camX, y = r.y + r.h - camY;
      var nm = B.sprite + '_' + p.kind, fr = p.open > 0 ? 1 : 0;
      var flip = p.id === 'wing_l' || p.id === 'eye_l';
      spr(ctx, nm, x, y + 2, fr, flip, { flash: B.flash > 0 && p.open > 0 }, p.w, p.h, p.kind === 'mouth' ? '#d82800' : p.kind === 'eye' ? '#fcfcfc' : '#5c4c6c');
      if (!hasArt(nm) && p.kind === 'eye') { ctx.fillStyle = '#000'; ctx.fillRect(Math.round(x) - 2, Math.round(y) - 9, 4, 4); }
    }
  }
  function drawPursuer(ctx, camX, camY) {
    var C = S.chase, nm = firstArt([C.sprite + '_walk', C.sprite + '_idle']);
    var x = S.cam.x + 10 + C.lunge, gy = groundUnder(x, S.cam.y + 20);
    var inf = artSize(nm, 40, 40);
    spr(ctx, C.ls === 'out' && hasArt(C.sprite + '_attack') ? C.sprite + '_attack' : nm, x - camX, gy - camY, Math.floor(C.t * 8), false, null, inf.w, inf.h, '#a81000');
    if (Math.random() < 0.5) dust(x - 12, gy, 1);
    if (C.ls === 'idle' && C.lungeT < 0.5 && Math.floor(S.t * 10) % 2) DCW.text('!', Math.round(x - camX + 16), Math.round(gy - camY - inf.h - 10), '#f83800', { align: 'center', scale: 2 });
  }
  function drawHooks(ctx, camX, camY) {
    var B = S.boss, M = S.party.mongo;
    ctx.strokeStyle = '#bcbcbc'; ctx.lineWidth = 1;
    var hx = B ? cx(B) + B.face * B.w * 0.4 - camX : 0, hy = B ? B.y + B.h * 0.35 - camY : 0;
    for (var i = 0; i < S.hooks.length; i++) {
      var h = S.hooks[i];
      ctx.beginPath(); ctx.moveTo(Math.round(hx) + 0.5, Math.round(hy) + 0.5); ctx.lineTo(Math.round(h.x - camX) + 0.5, Math.round(h.y - camY) + 0.5); ctx.stroke();
      spr(ctx, firstArt(['meat_hook', 'knife']), h.x - camX, h.y - camY + 3, 0, h.vx < 0, null, 5, 5, '#bcbcbc');
    }
    if (M && M.heldT > 0 && B) { ctx.beginPath(); ctx.moveTo(Math.round(hx) + 0.5, Math.round(hy) + 0.5); ctx.lineTo(Math.round(cx(M) - camX) + 0.5, Math.round(cy(M) - camY) + 0.5); ctx.stroke(); }
  }
  function drawAllies(ctx, camX, camY) {
    for (var i = 0; i < S.allies.length; i++) {
      var a = S.allies[i];
      if (a.delay > 0) continue;
      var x = cx(a) - camX, y = a.y + a.h - camY;
      if (a.kind === 'risen') {
        var nm = a.objSprite || (a.sprite + '_walk'), blink = Math.floor(S.t * 10) % 3 === 0;
        spr(ctx, nm, x, y, Math.floor(a.t * 8), a.face < 0, { alpha: 0.8, flash: blink }, a.w, a.h, '#58f898');
        if (a.life < 2 && Math.floor(S.t * 8) % 2) DCW.text('+', Math.round(x), Math.round(a.y - camY - 8), '#58f898', { align: 'center' });
      } else if (a.kind === 'boomy') {
        spr(ctx, firstArt(['mongo_clock_run', 'mongo_run']), x, y, Math.floor(a.t * 12), a.face < 0, null, a.w, a.h, '#f8b800');
        spr(ctx, 'dyn_stick', x - a.face * 2, y - a.h + 2, 0, a.face < 0, { flash: Math.floor(a.t * 10) % 2 === 0 }, 3, 6, '#d82800');
      } else if (a.kind === 'decoy') {
        spr(ctx, firstArt(['decoy_mongo', 'mongo_clock_run', 'mongo_idle']), x, y, Math.floor(a.t * 6), Math.floor(a.t) % 2 === 0, null, a.w, a.h, '#f8b800');
      }
    }
  }
  function drawFollower(ctx, C, base, camX, camY) {
    var name = base + (C.actT > 0 ? '_act' : (Math.abs(C.vx) > 12 || !C.onGround) ? '_run' : '_idle');
    if (!hasArt(name)) name = base + '_idle';
    var frame = Math.floor(C.t * (name.indexOf('_run') > 0 ? 8 : 2));
    spr(ctx, name, cx(C) - camX, C.y + C.h - camY, frame, C.face < 0, null, C.w, C.h, '#9878f8');
  }
  function drawMongo(ctx, C, camX, camY) {
    var base = C.big ? 'mongo_big' : 'mongo';
    var name;
    if (C.stunT > 0 || C.heldT > 0) name = firstArt([base + '_hurt', 'mongo_hurt', base + '_idle']);
    else name = base + (C.actT > 0 ? '_act' : (Math.abs(C.vx) > 12 || !C.onGround) ? '_run' : '_idle');
    if (!hasArt(name)) name = base + '_idle';
    var frame = Math.floor(C.t * (name.indexOf('_run') > 0 ? 10 : 2));
    if (C.stunT > 0 && Math.floor(S.t * 12) % 2) return;
    spr(ctx, name, cx(C) - camX, C.y + C.h - camY, frame, C.face < 0, null, C.w, C.h, '#58d854');
    if (C.stunT > 0) DCW.text('*', Math.round(cx(C) - camX), Math.round(C.y - camY - 9), '#fcfcfc', { align: 'center' });
  }
  function drawDonut(ctx, C, P, camX, camY) {
    if (P.state === 'pit' || P.state === 'dead' || P.mongo) return;
    var name = C.castT > 0 ? firstArt(['donut_cast', 'donut_shoulder', 'donut_idle']) : firstArt(['donut_shoulder', 'donut_idle']);
    // shoulder anchor: Carl's shoulder row sits 13 px above his feet (8 when crouched); she rides the back shoulder
    var feet = P.y + P.h;
    var y = feet - (P.crouch ? 8 : 13);
    var x = cx(P) - P.face * 5;
    var blink = (P.inv > 0 && P.state !== 'victory') && Math.floor(S.t * 20) % 2 === 0;
    spr(ctx, name, x - camX, y - camY, Math.floor(C.t * 2), P.face < 0, { alpha: blink ? 0.25 : 1 }, 9, 8, '#f8f8f8');
  }
  function playerSprite(P) {
    if (P.mongo) {
      var b = stats().mongoBig ? 'mongo_big' : 'mongo';
      if (P.state === 'dead' || P.state === 'hurt') return [firstArt([b + '_hurt', 'mongo_hurt', b + '_idle']), 0];
      if (P.state === 'punch' || P.state === 'airkick') return [firstArt([b + '_act', b + '_idle']), 0];
      if (!P.onGround) return [firstArt([b + '_jump', 'mongo_jump', b + '_run']), 1];
      if (Math.abs(P.vx) > 8) return [b + '_run', Math.floor(P.animT * 12)];
      return [b + '_idle', Math.floor(P.animT * 2)];
    }
    if (P.state === 'dead') return ['carl_dead', 0];
    if (P.state === 'victory') return ['carl_victory', 0];
    if (P.state === 'plant') return [firstArt(['carl_plant', 'carl_crouch', 'carl_idle']), Math.floor(P.animT * 4)];
    if (P.state === 'climb') return ['carl_climb', Math.floor(P.animT * 8)];
    if (P.state === 'hurt') return ['carl_hurt', 0];
    if (P.state === 'punch') return ['carl_punch', P.pIdx % 2];
    if (P.state === 'kick') return ['carl_kick', P.st > 0.09 ? 1 : 0];
    if (P.state === 'airkick') return ['carl_airkick', 0];
    if (P.launchT > 0) return [firstArt(['carl_launch', 'carl_throw']), 0];
    if (P.throwT > 0) return ['carl_throw', 0];
    if (!P.onGround) return [P.vy < 0 ? 'carl_jump' : 'carl_fall', 0];
    if (P.crouch) return [hasArt('carl_crouch') ? 'carl_crouch' : 'carl_idle', 0];
    if (Math.abs(P.vx) > 8) return ['carl_run', Math.floor(P.animT * 11)];
    return ['carl_idle', Math.floor(P.animT * 2)];
  }
  var skinOpt = { skin: 'carl_f3', flash: false, alpha: 1 };
  function drawPlayer(ctx, P, camX, camY) {
    if (P.state === 'pit') return;
    var blink = (P.inv > 0 && P.state !== 'victory' && P.state !== 'dead') && Math.floor(S.t * 20) % 2 === 0;
    var sp = playerSprite(P);
    skinOpt.skin = P.mongo ? undefined : ((DCW.save && DCW.save.equipped && DCW.save.equipped.skin) || 'carl_f3');
    skinOpt.flash = P.invuln > 0 && Math.floor(S.t * 12) % 3 === 0;
    skinOpt.alpha = blink ? 0.25 : 1;
    var x = cx(P) - camX, y = P.y + P.h - camY;
    spr(ctx, sp[0], x, y, sp[1], P.face < 0, skinOpt, P.mongo ? P.w : 12, P.h, P.mongo ? '#58d854' : '#fcd8a8');
    if (P.charmT > 0 && Math.floor(S.t * 6) % 2) DCW.text('♥', Math.round(x), Math.round(P.y - camY - 12), '#f878f8', { align: 'center' });
    if (P.shield > 0 || P.invuln > 0) {
      ctx.strokeStyle = P.invuln > 0 ? '#f8d878' : '#9878f8';
      ctx.globalAlpha = 0.6 + Math.sin(S.t * 10) * 0.2;
      ctx.beginPath(); ctx.arc(Math.round(x), Math.round(y - P.h / 2), P.mongo ? 11 : 15, 0, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }
  var XSPR = { jug: 'jug', hob: 'hob', dyn: 'dyn_stick', smoke: 'smoke_bomb', mic: 'jug' };
  function drawPProj(ctx, q, camX, camY) {
    if (q.kind === 'x') {
      var nm = XSPR[q.xid] || 'hob';
      if (q.xid === 'smoke' && !hasArt(nm)) nm = 'hob';
      var blink = q.xid === 'dyn' && q.fuse < 0.5 && Math.floor(q.fuse * 20) % 2 === 0;
      spr(ctx, nm, cx(q) - camX, q.y + q.h + 1 - camY, Math.floor(q.spin), q.vx < 0, { flash: blink }, 6, 6, XCOLOR[q.xid] || '#f8b800');
      if (q.xid === 'dyn' && Math.floor(S.t * 20) % 2) { ctx.fillStyle = '#f8d878'; ctx.fillRect(Math.round(cx(q) - camX), Math.round(q.y - camY) - 2, 1, 1); }
    } else spr(ctx, 'missile', cx(q) - camX, q.y + q.h + 1 - camY, Math.floor(q.t * 12), q.vx < 0, null, 6, 6, '#f878f8');
  }
  function drawPart(ctx, p, camX, camY) {
    var x = p.x - camX, y = p.y - camY;
    if (x < -40 || x > W + 40) return;
    if (p.kind === 'px') { ctx.fillStyle = p.color; ctx.fillRect(Math.round(x), Math.round(y), p.size, p.size); return; }
    if (p.kind === 'ring') {
      ctx.strokeStyle = p.color; ctx.globalAlpha = 1 - p.t / p.life;
      ctx.beginPath(); ctx.arc(Math.round(x), Math.round(y), p.r * (0.5 + p.t / p.life * 0.7), 0, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha = 1; return;
    }
    var fr = Math.min(p.frames - 1, Math.floor(p.t / p.life * p.frames));
    if (hasArt(p.name)) spr(ctx, p.name, x, y, fr, p.flip, p.scale > 1 ? { scale: p.scale } : null);
    else {
      var s = Math.max(1, Math.round(p.size * (1 - p.t / p.life)));
      ctx.fillStyle = p.color; ctx.fillRect(Math.round(x - s / 2), Math.round(y - s), s, s);
    }
  }
  function drawDark(ctx, camX, camY) {
    var dark = darkNow();
    if (!dark && !S.orbs.length) return;
    if (!lightCanvas) { lightCanvas = document.createElement('canvas'); lightCanvas.width = W; lightCanvas.height = H; }
    var g = lightCanvas.getContext('2d'), k, l, gr;
    g.globalCompositeOperation = 'source-over';
    g.clearRect(0, 0, W, H);
    if (dark) {
      g.fillStyle = S.darkT > 0 && !S.dark ? 'rgba(0,0,0,0.86)' : 'rgba(0,0,0,0.94)'; g.fillRect(0, 0, W, H);
      g.globalCompositeOperation = 'destination-out';
      for (k = 0; k < S.lights.length; k++) {
        l = S.lights[k];
        var lx = l.x - camX, ly = l.y - camY;
        if (lx < -l.r || lx > W + l.r || ly < -l.r || ly > H + l.r) continue;
        gr = g.createRadialGradient(lx, ly, l.r * 0.35, lx, ly, l.r);
        gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = gr; g.fillRect(lx - l.r, ly - l.r, l.r * 2, l.r * 2);
      }
      g.globalCompositeOperation = 'source-over';
    }
    for (k = 0; k < S.orbs.length; k++) {
      var o = S.orbs[k], ox = o.x - camX, oy = o.y - camY;
      if (o.r < 2) continue;
      gr = g.createRadialGradient(ox, oy, 0, ox, oy, o.r);
      gr.addColorStop(0, 'rgba(0,0,8,0.97)'); gr.addColorStop(0.75, 'rgba(0,0,8,0.92)'); gr.addColorStop(1, 'rgba(0,0,8,0)');
      g.fillStyle = gr; g.fillRect(ox - o.r, oy - o.r, o.r * 2, o.r * 2);
      g.strokeStyle = 'rgba(104,68,252,0.45)'; g.beginPath(); g.arc(Math.round(ox), Math.round(oy), Math.max(1, o.r - 2), 0, Math.PI * 2); g.stroke();
    }
    ctx.drawImage(lightCanvas, 0, 0);
  }

  /* ---------------- HUD ---------------- */
  var hud = {};
  function drawHud(ctx) {
    var run = getRun(), B = S.boss, sel = selectedX(), i;
    hud.hp = Math.max(0, run.hp); hud.maxHp = stats().maxHp;
    hud.special = S.swap ? null : S.special; hud.specialLocked = S.specialLockT > 0;
    hud.bombs = S.swap ? undefined : itemCount(sel); hud.potions = S.swap ? undefined : (run.potions || 0);
    hud.gold = run.gold || 0; hud.level = run.level || 13; hud.xpFrac = U.clamp((run.xp || 0) / xpNeed(run.level || 13), 0, 1);
    hud.views = run.views || 0; hud.combo = S.combo;
    hud.companion = S.swap ? 'mongo' : S.party.donut ? 'donut' : (S.party.mongo ? 'mongo' : null);
    hud.party = []; ['donut', 'mongo', 'katia'].forEach(function (id) { if (S.party[id]) hud.party.push(id); });
    hud.explosive = S.swap ? null : { id: sel, count: itemCount(sel), name: itemName(sel) };
    hud.explosives = {}; for (i = 0; i < EXPLOSIVES.length; i++) hud.explosives[EXPLOSIVES[i]] = itemCount(EXPLOSIVES[i]);
    hud.clock = clock();
    var ob = S.mode === 'street' ? call(G(), 'objective') : null;
    hud.objective = ob ? (ob.text || null) : null;
    hud.timer = null; hud.meters = [];
    if (S.esc) hud.timer = { label: 'ESCAPE', t: Math.max(0, S.esc.t), warn: S.esc.t < 60 };
    if (S.surv) hud.timer = { label: 'DAWN', t: Math.max(0, S.surv.t), warn: S.surv.t < 15 };
    if (S.surv && S.surv.bar) hud.meters.push({ label: 'BARRICADE', frac: S.surv.bar.hp / S.surv.bar.maxHp, color: '#f8b800' });
    if (S.plant) hud.meters.push({ label: 'CHARGES', frac: S.plant.need ? S.plant.planted / S.plant.need : 1, text: S.plant.planted + '/' + S.plant.need, color: '#58f898' });
    if (S.esc) hud.meters.push({ label: 'BURSTS', frac: S.esc.fired / 4, text: S.esc.fired + '/4', color: '#f878f8' });
    if (S.chase && !S.chase.arrived) hud.meters.push({ label: 'RUN!', frac: U.clamp(cx(S.player) / ((S.arena ? S.arena.x0 : S.L.pxW) || 1), 0, 1), color: '#f83800' });
    hud.bossHp = (B && S.locked && !B.gone) ? Math.max(0, B.hp / B.maxHp) : null;
    hud.bossName = hud.bossHp !== null ? (B.def.name || 'BOSS') : null;
    hud.time = null; hud.par = null;
    hud.stageName = S.def.name || ''; hud.areaName = S.mode === 'street' ? (S.def.name || '') : null;
    hud.mode = S.mode; hud.kind = S.kind; hud.night = S.night; hud.wanted = S.mode === 'street' && run.wanted === S.areaId;
    hud.charmed = S.player && S.player.charmT > 0;
    if (has(UI(), 'drawHUD')) { call(UI(), 'drawHUD', ctx, hud); return; }
    DCW.text('♥' + hud.hp + '/' + hud.maxHp + '  ' + (hud.explosive ? hud.explosive.id.toUpperCase() + 'X' + hud.explosive.count : '') + '  P' + (hud.potions || 0) + '  $' + hud.gold, 4, 4, '#fcfcfc');
    if (hud.special !== null) DCW.bar(4, 14, 40, 3, hud.special, '#f8d878');
    DCW.text(hud.clock.label || '', W - 4, 4, '#fcfcfc', { align: 'right' });
    if (hud.timer) DCW.text(hud.timer.label + ' ' + Math.ceil(hud.timer.t), W / 2, 4, hud.timer.warn ? '#f83800' : '#fcfcfc', { align: 'center' });
    if (hud.objective) DCW.text(hud.objective, W / 2, H - 10, '#f8d878', { align: 'center' });
    if (hud.combo > 1) DCW.text(hud.combo + ' HITS', W - 4, 14, '#f8d878', { align: 'right' });
    if (hud.bossHp !== null) { DCW.bar(60, H - 10, 200, 4, hud.bossHp, '#f83800'); DCW.text(hud.bossName, 160, H - 20, '#fcfcfc', { align: 'center' }); }
  }

  /* ---------------- debug / test hooks ---------------- */
  function debugClear() {
    if (!S || S.done || S.mode !== 'level') return;
    if (S.boss && !S.boss.dead) { S.boss.dead = true; S.boss.gone = true; unlockArena(); }
    if (S.plant) S.plant.detonated = true;
    if (S.surv) S.surv.dawn = true;
    startVictory('door'); S.endT = 0.3;
  }
  function debugGod() { if (!S) return; S.god = !S.god; getRun().god = S.god; toast(S.god ? 'GOD MODE ON' : 'GOD MODE OFF', {}); }
  function warpTo(x, feetY) {
    var P = S.player;
    P.x = x - P.w / 2; P.y = feetY - P.h - 1; P.vx = 0; P.vy = 0; P.state = 'normal';
    if (S.chase) S.cam.x = Math.max(0, x - 80);
    updCamera(0, true);
  }
  function debugWarp() {
    if (!S) return;
    if (S.arena) { var ax = S.arena.x0 + 4 * TS; warpTo(ax, groundBelow(ax, 6 * TS)); return; }
    for (var i = S.objects.length - 1; i >= 0; i--) {
      var o = S.objects[i];
      if (o.kind === 'door' || o.kind === 'detonator') { warpTo(cx(o) - 24, o.y + o.h); return; }
    }
  }

  var scene = { enter: enter, exit: exit, update: update, idle: idle, draw: draw };
  var inited = false;
  DCW.stage = {
    scene: scene,
    init: function () {
      if (inited) return; inited = true;
      window.addEventListener('keydown', function (e) {
        if (!DCW.debug || DCW.scene !== scene || !S) return;
        if (e.code === 'Digit9') debugClear();
        else if (e.code === 'Digit0') debugGod();
        else if (e.code === 'Digit7') debugWarp();
      });
    },
    get state() { return S; },
    K: K,
    playerX: function () { return S && S.player ? Math.round(cx(S.player)) : null; },
    mode: function () { return S ? S.mode : null; },
    debugClear: debugClear, debugGod: debugGod, debugWarp: debugWarp, debugWarpBoss: debugWarp,
    // test helpers (harmless in production)
    spawn: function (id, x, feetY, opts) { return S ? spawnEnemy(id, x, feetY, opts) : null; },
    detonate: function () { if (S && S.plant) detonate(); }
  };
})();

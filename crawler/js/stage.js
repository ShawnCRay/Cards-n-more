/* ============================================================
   DCW STAGE - the side-scrolling stage scene: level assembly,
   physics, player, companion, enemies, bosses, pickups, juice.
   Contract: ../DESIGN.md "Stage contract" / "Data contract".
   Every call into art/audio/ui/game/data is feature-detected.
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
    bombFuse: 1.15, bombVX: 125, bombVY: -175, bombGrav: 620, bombSelfDmg: 2,
    specialPassive: 1 / 110, // meter per second
    updateMargin: W * 0.6,   // enemies update only within this of the screen
    maxParts: 320
  };
  var T_EMPTY = 0, T_SOLID = 1, T_ALT = 2, T_ONEWAY = 3, T_SPIKE = 4, T_LIQUID = 5, T_LADDER = 6, T_CRATE = 7;
  var TILE_OF = { '#': T_SOLID, 'X': T_ALT, '=': T_ONEWAY, '^': T_SPIKE, '~': T_LIQUID, 'H': T_LADDER, 'b': T_CRATE };
  var CH_OF = ['.', '#', 'X', '=', '^', '~', 'H', 'b'];
  var FALLBACK_TILE_COLOR = ['', '#7c4c2c', '#8c6c4c', '#c09060', '#d8d8d8', '#2c8c3c', '#c08828', '#a86c30'];

  /* ---------------- built-in fallback chunks (used only when data is missing) ---------------- */
  var FB = {
    _fb_start: ['................', '................', '................', '................', '................', '................', '................', '................', '..n.............', '.P..............', '################', '################'],
    _fb_flat: ['................', '................', '................', '................', '................', '................', '.......o.o......', '......=====.....', '................', '...e........e...', '################', '################'],
    _fb_end: ['................', '................', '................', '................', '................', '................', '................', '................', '..........D.....', '................', '################', '################'],
    _fb_arena: ['X..............................X', 'X..............................X', 'X..............................X', 'X..............................X', 'X..............................X', 'X..............................X', 'X.....====............====.....X', '...............................X', '...............................X', '....................K..........X', '################################', '################################']
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
  function say(lines) { if (!lines || (Array.isArray(lines) && !lines.length)) return false; if (!has(UI(), 'say')) return false; call(UI(), 'say', lines, {}); return true; }
  function aiLine(pool) { var p = (D().ai || {})[pool]; return (p && p.length) ? U.pick(p) : null; }
  var fallbackRun = null;
  function getRun() {
    var r = null;
    try { r = G().run; } catch (e) { r = null; }
    if (!r && DCW.save) r = DCW.save.run;
    if (!r) { // standalone fallback so the stage still works without a run (never written into the save)
      r = fallbackRun || (fallbackRun = { floor: 1, hp: 12, level: 1, xp: 0, stats: { str: 3, con: 3, dex: 3, int: 3 }, bonus: { hp: 2 }, gold: 0, bombs: 3, potions: 1, views: 0, seed: 12345, floorTime: 0, kills: 0, cleared: {} });
    }
    return r;
  }
  function stats() {
    var s = call(G(), 'playerStats');
    if (s) return s;
    var r = getRun(), st = r.stats || { str: 3, con: 3, dex: 3, int: 3 }, lv = r.level || 1;
    var dmg = 2 + (st.str - 3) + Math.floor((lv - 1) / 2);
    return { maxHp: 10 + (st.con - 3) * 2 + (lv - 1) + ((r.bonus && r.bonus.hp) || 0), dmg: dmg, kickDmg: Math.round(dmg * 1.5),
      crit: 0.04 + (st.dex - 3) * 0.02, speedMul: 1 + (st.dex - 3) * 0.03, bombDmg: 8 + lv * 2 + (st.str - 3), bombRadius: 28,
      compPower: 1 + (st.int - 3) * 0.15 + (lv - 1) * 0.04, def: 0, goldMul: 1, viewMul: 1, extraJump: false, skinPerk: null };
  }
  function floorDef() {
    var f = call(G(), 'floorDef');
    if (f) return f;
    var r = getRun(), fl = D().floors || [];
    return fl[(r.floor || 1) - 1] || null;
  }
  function xpNeed(lv) { var n = call(G(), 'xpNeed', lv); return n || Math.round(18 * Math.pow(lv, 1.5)); }
  function num(v, d) { return (typeof v === 'number' && !isNaN(v)) ? v : d; }

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

  /* ---------------- state ---------------- */
  var S = null;        // current stage state
  var I = null;        // DCW.input
  var lightCanvas = null;
  var tileInfo = { up: false, down: false, left: false, right: false, t: 0, tx: 0, ty: 0 };

  /* ---------------- level assembly ---------------- */
  function chunkRows(id) {
    var c = (D().chunks || {})[id];
    var rows = c && (c.rows || (Array.isArray(c) ? c : null));
    if (!rows && FB[id]) rows = FB[id];
    if (!rows || !rows.length) return null;
    return rows;
  }
  function buildLevel(stageId) {
    var data = D();
    var def = (data.stages || {})[stageId];
    if (!def) {
      def = { id: stageId || 'debug', name: 'UNKNOWN STAGE', floor: 1, theme: 'sewer', kind: 'main', chunks: { start: '_fb_start', pool: ['_fb_flat'], count: 2, end: '_fb_end' }, enemies: [['rat', 1]] };
    }
    var run = getRun();
    var rnd = U.rng(((run.seed || 1) + U.hash(String(def.id || stageId))) >>> 0);
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
    var isBoss = def.kind === 'boss' || !!def.boss;
    var endId = cd.end && chunkRows(cd.end) ? cd.end : (isBoss ? '_fb_arena' : '_fb_end');
    ids.push(endId);

    var chunks = ids.map(function (id) { return { id: id, rows: chunkRows(id) }; });
    var LH = 0;
    chunks.forEach(function (c) { LH = Math.max(LH, c.rows.length); });
    var LW = 0;
    chunks.forEach(function (c) { var w = 0; c.rows.forEach(function (r) { w = Math.max(w, r.length); }); c.w = w; c.x0 = LW; LW += w; });

    var L = {
      w: LW, h: LH, t: new Uint8Array(LW * LH), pxW: LW * TS, pxH: LH * TS
    };
    var spawns = [];
    var signIdx = 0;
    chunks.forEach(function (c) {
      var pad = LH - c.rows.length; // pad at top so ground lines up
      for (var ry = 0; ry < LH; ry++) {
        var row = ry < pad ? '' : c.rows[ry - pad];
        for (var rx = 0; rx < c.w; rx++) {
          var ch = row.charAt(rx) || '.';
          var tx = c.x0 + rx, ty = ry;
          var tt = TILE_OF[ch];
          if (tt) { L.t[ty * LW + tx] = tt; continue; }
          if (ch === '.' || ch === ' ') continue;
          spawns.push({ ch: ch, tx: tx, ty: ty, chunk: c });
        }
      }
    });

    S = {
      id: def.id || stageId, def: def, floor: floorDef(), theme: def.theme || 'sewer', L: L, rnd: rnd,
      chunks: chunks, isBoss: isBoss,
      t: 0, cam: { x: 0, y: 0, look: 0 },
      enemies: [], eproj: [], pproj: [], haz: [], pickups: [], objects: [], platforms: [], parts: [], nums: [], allies: [],
      boss: null, arena: null, locked: false,
      combo: 0, comboT: 0, special: 0, flashT: 0, flashColor: '#fff',
      kills: 0, damageTaken: 0, maxCombo: 0, views: 0, gold: 0, secrets: 0,
      god: !!run.god, done: false, endT: -1, endKind: null, deathT: -1, diedSent: false, clearedSent: false,
      introPending: def.intro || null, doubleViewsT: 0, lowHpQuipped: false, quipT: 0, dark: !!def.dark,
      lastSafe: null, checkpoint: null, gates: []
    };
    var start = null;
    spawns.forEach(function (s) {
      var x = s.tx * TS, y = s.ty * TS, fx = x + 8, fy = y + TS; // fy = feet line of this cell
      switch (s.ch) {
        case 'P': if (!start) start = { x: fx, y: fy }; break;
        case 'D': S.objects.push({ kind: 'door', x: fx - 13, y: fy - 38, w: 26, h: 38, open: false }); break;
        case 'K': S.bossSpawn = { x: fx, y: fy, chunk: s.chunk }; break;
        case 'e': case 'E': case 'f': S.enemies.push(makeEnemy(pickEnemyId(def, s.ch, rnd), fx, fy, s.ch === 'E', s.ch === 'f')); break;
        case 'o': addPickup('coin', fx, fy - 4, 0, 0, false); break;
        case 'h': addPickup('snack', fx, fy - 2, 0, 0, false); break;
        case 'm': addPickup('bomb', fx, fy - 2, 0, 0, false); break;
        case '?': addPickup('box', fx, fy - 2, 0, 0, false); break;
        case '<': case '>': S.platforms.push({ x: x - 16, y: y + 4, w: 48, h: 6, ox: x - 16, oy: y + 4, axis: 'x', dir: s.ch === '<' ? -1 : 1, range: 48, speed: 34, dx: 0, dy: 0, prevY: y + 4 }); break;
        case 'v': S.platforms.push({ x: x - 16, y: y + 4, w: 48, h: 6, ox: x - 16, oy: y + 4, axis: 'y', dir: -1, range: 48, speed: 30, dx: 0, dy: 0, prevY: y + 4 }); break;
        case 'c': S.objects.push({ kind: 'checkpoint', x: x + 2, y: fy - 24, w: 12, h: 24, on: false }); break;
        case 'n': S.objects.push({ kind: 'sign', x: x, y: fy - 16, w: 16, h: 16, idx: signIdx++ }); break;
        case '$': S.objects.push({ kind: 'chest', x: x, y: fy - 14, w: 16, h: 14, open: false }); break;
        default: break; // unknown chars are decoration-free empty space
      }
    });
    if (!start) start = { x: 24, y: groundBelow(24, 0) };
    S.start = start;
    // boss arena
    if (S.isBoss) {
      var arenaChunk = (S.bossSpawn && S.bossSpawn.chunk) || chunks[chunks.length - 1];
      S.arena = { x0: arenaChunk.x0 * TS, x1: (arenaChunk.x0 + arenaChunk.w) * TS, tx0: arenaChunk.x0 };
      if (!S.bossSpawn) S.bossSpawn = { x: S.arena.x0 + arenaChunk.w * TS * 0.7, y: groundBelow(S.arena.x0 + arenaChunk.w * TS * 0.7, 0) };
    }
    return S;
  }
  function pickEnemyId(def, ch, rnd) {
    var pool = ch === 'E' ? def.elite : ch === 'f' ? def.flyers : def.enemies;
    if (!pool || !pool.length) pool = def.enemies;
    if (!pool || !pool.length) return 'rat';
    var p = pool.map(function (e) { return Array.isArray(e) ? e : [e, 1]; });
    return U.weighted(p, rnd);
  }
  function groundBelow(px, py) {
    var L = S.L, tx = Math.floor(px / TS);
    for (var ty = Math.max(0, Math.floor(py / TS)); ty < L.h; ty++) {
      var t = tileAt(tx, ty);
      if (t === T_SOLID || t === T_ALT || t === T_ONEWAY || t === T_CRATE) return ty * TS;
    }
    return (L.h - 2) * TS;
  }

  /* ---------------- tile queries ---------------- */
  function tileAt(tx, ty) {
    var L = S.L;
    if (tx < 0 || tx >= L.w) return T_SOLID; // level edges are walls
    if (ty < 0 || ty >= L.h) return T_EMPTY;
    return L.t[ty * L.w + tx];
  }
  function setTile(tx, ty, v) { var L = S.L; if (tx >= 0 && tx < L.w && ty >= 0 && ty < L.h) L.t[ty * L.w + tx] = v; }
  function isSolidT(t) { return t === T_SOLID || t === T_ALT || t === T_CRATE; }
  function isLadderTop(tx, ty) { return tileAt(tx, ty) === T_LADDER && tileAt(tx, ty - 1) !== T_LADDER; }
  function solidAt(px, py) { return isSolidT(tileAt(Math.floor(px / TS), Math.floor(py / TS))); }
  function standableAt(px, py) {
    var tx = Math.floor(px / TS), ty = Math.floor(py / TS), t = tileAt(tx, ty);
    return isSolidT(t) || t === T_ONEWAY || (t === T_LADDER && isLadderTop(tx, ty));
  }

  /* ---------------- generic body physics ---------------- */
  // b: {x,y,w,h,vx,vy}. Sets b.onGround, b.hitWall, b.bonk, b.platform. opts.noOneway, opts.noPlat
  function moveBody(b, dt, noOneway) {
    var L = S.L, i, tx, ty, t;
    b.hitWall = 0; b.bonk = false;
    // carried by moving platform
    if (b.platform) {
      var pl = b.platform;
      if (b.x + b.w > pl.x - 2 && b.x < pl.x + pl.w + 2 && Math.abs((b.y + b.h) - (pl.y - pl.dy)) < 3) { b.x += pl.dx; b.y = pl.y - b.h; }
      b.platform = null;
    }
    // X axis
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
    // Y axis
    var oldBottom = b.y + b.h;
    var ny = b.y + b.vy * dt;
    b.onGround = false;
    if (b.vy >= 0) {
      ty = Math.floor((ny + b.h) / TS);
      var landed = false;
      if (ty >= 0 && ty < L.h) {
        var x0 = Math.floor((b.x + 0.5) / TS), x1 = Math.floor((b.x + b.w - 0.5) / TS);
        for (tx = x0; tx <= x1; tx++) {
          t = tileAt(tx, ty);
          if (isSolidT(t) || (!noOneway && oldBottom <= ty * TS + 0.5 && (t === T_ONEWAY || (t === T_LADDER && isLadderTop(tx, ty))))) { landed = true; break; }
        }
      }
      if (landed) { ny = ty * TS - b.h; b.vy = 0; b.onGround = true; }
      // moving platforms
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
  function overlap(a, b) { return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y; }
  function cx(o) { return o.x + o.w / 2; }
  function cy(o) { return o.y + o.h / 2; }
  function onScreen(o, m) { m = m || 0; return o.x + o.w > S.cam.x - m && o.x < S.cam.x + W + m && o.y + o.h > S.cam.y - m && o.y < S.cam.y + H + m; }

  /* ---------------- particles / numbers / fx ---------------- */
  // kind: 'spr' (animated art sprite with fallback), 'px' (pixel debris), 'ring'
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
    // stagger numbers that spawn on top of each other (multi-kills, combos)
    for (var i = S.nums.length - 1; i >= 0; i--) {
      var o = S.nums[i];
      if (o.t < 0.25 && Math.abs(o.x - x) < 24 && Math.abs(o.y - y) < 9) y = o.y - 9;
    }
    S.nums.push({ x: x, y: y, vy: -42, t: 0, life: 0.8, text: String(text), color: color || '#fcfcfc', scale: scale || 1 });
    if (S.nums.length > 40) S.nums.shift();
  }
  function flash(color, t) { S.flashColor = color || '#fff'; S.flashT = t || 0.15; }

  /* ---------------- pickups ---------------- */
  function addPickup(kind, x, y, vx, vy, dropped, value) {
    var p = { kind: kind, x: x - 4, y: y - 8, w: 8, h: 8, vx: vx || 0, vy: vy || 0, phys: !!dropped, delay: dropped ? 0.25 : 0,
      life: dropped ? 9 : -1, value: value || 0, bob: Math.random() * 6, magnet: false };
    if (kind === 'box') { p.w = 12; p.h = 12; p.x = x - 6; p.y = y - 12; }
    S.pickups.push(p);
    return p;
  }
  function floorScale() { return 1 + ((getRun().floor || 1) - 1) * 0.5; }
  function spillCoins(x, y, gold, maxCoins) {
    gold = Math.max(0, Math.round(gold));
    if (!gold) return;
    var n = Math.min(maxCoins || 6, gold), per = Math.floor(gold / n), extra = gold - per * n;
    for (var i = 0; i < n; i++) {
      addPickup('coin', x, y, U.rand(-70, 70), -U.rand(140, 230), true, per + (i < extra ? 1 : 0));
    }
  }
  function collectPickup(p) {
    var run = getRun(), P = S.player;
    switch (p.kind) {
      case 'coin': {
        var v = p.value || Math.max(1, Math.round(U.randi(1, 3) * floorScale()));
        var got = has(G(), 'addGold') ? call(G(), 'addGold', v) : (run.gold += v, v);
        got = num(got, v);
        S.gold += got;
        sfx('coin');
        track('coin');
        fxSprite('sparkle', cx(p), p.y + p.h, 0.3, { color: '#f8d878', size: 6 });
        if (S.comp && S.comp.ability === 'magnet') { var bv = Math.max(1, Math.round(2 * floorScale())); addViews(bv); }
        break;
      }
      case 'snack': {
        if (has(G(), 'heal')) call(G(), 'heal', 3); else run.hp = Math.min(stats().maxHp, run.hp + 3);
        sfx('heal'); numText(cx(P), P.y - 4, '+3', '#58f898');
        debris(cx(P), cy(P), 6, '#58f898', 60);
        break;
      }
      case 'bomb': run.bombs = (run.bombs || 0) + 1; sfx('pickup'); numText(cx(P), P.y - 4, '+1 BOMB', '#fcfcfc'); break;
      case 'potion': run.potions = (run.potions || 0) + 1; sfx('pickup'); numText(cx(P), P.y - 4, '+1 POTION', '#58f898'); break;
      case 'box': {
        if (has(G(), 'giveLootBox')) call(G(), 'giveLootBox', 'bronze', 'SECRET: ' + (S.def.name || 'STAGE'));
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
    var P = S.player, C = S.comp, magnetR = 0;
    if (C && C.ability === 'magnet') magnetR = 64 * Math.sqrt(C.pw);
    for (var i = S.pickups.length - 1; i >= 0; i--) {
      var p = S.pickups[i];
      if (p.delay > 0) p.delay -= dt;
      if (p.life > 0) { p.life -= dt; if (p.life <= 0) { S.pickups.splice(i, 1); continue; } }
      var dx = cx(P) - cx(p), dy = cy(P) - cy(p), d2 = dx * dx + dy * dy;
      if (p.delay <= 0 && (p.magnet || (magnetR && d2 < magnetR * magnetR && p.kind !== 'box'))) {
        var d = Math.sqrt(d2) || 1, sp = p.magnet ? 260 : 170;
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
      if (p.delay <= 0 && P.state !== 'dead' && overlap(P, p)) { collectPickup(p); S.pickups.splice(i, 1); }
    }
  }

  /* ---------------- combat core ---------------- */
  function registerHit(dmg) {
    S.combo++; S.comboT = K.comboWindow;
    if (S.combo > S.maxCombo) S.maxCombo = S.combo;
    if (S.combo === 10) { track('combo10'); quip('bigCombo', 0.6); }
    if (S.combo === 25) { track('combo25'); quip('bigCombo', 1); announce(S.combo + ' HIT COMBO!', { color: '#f8d878', time: 1.4 }); }
    var st = stats();
    S.special = Math.min(1, S.special + (dmg || 1) / Math.max(1, st.dmg * 22));
  }
  function compViewMul() {
    var C = S.comp; if (!C) return 1;
    var b = C.def.bonus && C.def.bonus.views;
    if (typeof b === 'number') return b < 1 ? 1 + b : b;
    return C.ability === 'magnet' ? 1.25 : 1;
  }
  function comboMul() { return 1 + Math.min(S.combo, 60) * 0.05; }
  function quip(pool, chance) {
    if (S.quipT > 0 || Math.random() > (chance || 1)) return;
    var line = aiLine(pool);
    if (line) { toast(line, { title: 'SYSTEM AI', icon: 'eye', color: '#f878f8', time: 3.2 }); S.quipT = 8; }
  }
  // Generic damage to an enemy or the boss. opts: {kind, dir, kb, crit, noCombo}
  function damageActor(e, dmg, opts) {
    opts = opts || {};
    if (!e || e.dead) return false;
    if (e.isBoss) return damageBoss(e, dmg, opts);
    var armor = num(e.def.armor, 0);
    var n = Math.max(1, Math.round(dmg - armor));
    e.hp -= n;
    e.flash = e.elite ? 0.16 : 0.1; e.lastHit = S.t;
    var dir = opts.dir || (cx(e) < cx(S.player) ? -1 : 1);
    var kb = num(e.def.kb, 1) * (opts.kb || 80);
    if (e.ai !== 'turret' && e.ai !== 'spawner') {
      e.vx = dir * kb; if (!e.flying) e.vy = Math.min(e.vy, -60 - kb * 0.3); else e.vy = -kb * 0.2;
      e.hurtT = 0.16 + Math.min(0.2, kb / 900);
    }
    hitSpark(cx(e), cy(e), opts.crit);
    numText(cx(e), e.y - 2, n, opts.crit ? '#f8d878' : '#fcfcfc', opts.crit ? 2 : 1);
    if (!opts.noCombo) registerHit(n);
    if (e.hp <= 0) { killEnemy(e, opts); return true; }
    return false;
  }
  function killEnemy(e, opts) {
    opts = opts || {};
    e.dead = true;
    var run = getRun(), d = e.def;
    S.kills++; run.kills = (run.kills || 0) + 1;
    sfx('enemy_die');
    smoke(cx(e), cy(e), e.elite ? 6 : 3);
    fxSprite('explosion', cx(e), e.y + e.h + 4, 0.3, { color: '#f8b800', size: 12, scale: e.elite ? 2 : 1 });
    debris(cx(e), cy(e), 8, '#fcfcfc', 110);
    if (!e.isAdd && !e.noLoot) {
      var xp = num(d.xp, 1) * (e.elite ? 2.5 : 1);
      call(G(), 'addXP', Math.round(xp));
      var g = d.gold || [0, 1];
      var gold = U.randi(num(g[0], 0), num(g[1], 1)) * (e.elite ? 3 : 1);
      spillCoins(cx(e), cy(e), gold, e.elite ? 8 : 5);
      if (Math.random() < (e.elite ? 0.35 : 0.07)) addPickup('snack', cx(e), cy(e), U.rand(-40, 40), -200, true);
      if (Math.random() < (e.elite ? 0.25 : 0.04)) addPickup('bomb', cx(e), cy(e), U.rand(-40, 40), -220, true);
    }
    var base = num(d.views, 6 + num(d.xp, 1) * 3) * (e.elite ? 3 : 1);
    var v = Math.max(1, Math.round(base * comboMul() * (S.doubleViewsT > 0 ? 2 : 1) * compViewMul()));
    var got = addViews(v);
    numText(cx(e), e.y - 12, '+' + got + ' VIEWS', '#f878f8');
    S.special = Math.min(1, S.special + 0.04);
    track('kill');
    track('kill:' + e.id);
    if (opts.kind === 'bomb') { track('bomb_kill'); }
    if (e.parent) e.parent.kids = Math.max(0, (e.parent.kids || 1) - 1);
  }
  // returns number of things hit. box in world px. opts: {kind, dmg, kb, crit, hitList, dir, breaks}
  function hitBox(box, dmg, opts) {
    var hits = 0, hl = opts.hitList, i, e;
    for (i = 0; i < S.enemies.length; i++) {
      e = S.enemies[i];
      if (e.dead || !e.active || (hl && hl.indexOf(e) >= 0)) continue;
      if (overlap(box, e)) { if (hl) hl.push(e); damageActor(e, dmg, opts); hits++; }
    }
    var B = S.boss;
    if (B && !B.dead && B.active && !B.dying && B.alpha > 0.5 && !(hl && hl.indexOf(B) >= 0) && overlap(box, B)) { if (hl) hl.push(B); damageActor(B, dmg, opts); hits++; }
    // chests
    for (i = 0; i < S.objects.length; i++) {
      var o = S.objects[i];
      if (o.kind === 'chest' && !o.open && overlap(box, o)) { openChest(o); hits++; }
    }
    // crates
    if (opts.breaks !== false) {
      var x0 = Math.floor(box.x / TS), x1 = Math.floor((box.x + box.w) / TS), y0 = Math.floor(box.y / TS), y1 = Math.floor((box.y + box.h) / TS);
      for (var ty = y0; ty <= y1; ty++) for (var tx = x0; tx <= x1; tx++) if (tileAt(tx, ty) === T_CRATE) { breakCrate(tx, ty); hits++; }
    }
    // melee swats enemy projectiles
    if (opts.kind !== 'bomb') {
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
    if (r < 0.45) spillCoins(x, y, Math.max(2, Math.round(U.randi(2, 5) * floorScale())), 3);
    else if (r < 0.62) addPickup('snack', x, y, 0, -180, true);
    else if (r < 0.72) addPickup('bomb', x, y, 0, -180, true);
  }
  function openChest(o) {
    o.open = true;
    sfx('unlock'); sfx('coin');
    spillCoins(cx(o), o.y, Math.round(U.randi(8, 16) * floorScale()), 8);
    fxSprite('sparkle', cx(o), o.y + 4, 0.4, { color: '#f8d878', size: 8 });
  }
  function rollCrit(dmg) {
    var c = Math.random() < num(stats().crit, 0.04);
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
  /* ---------------- explosions ---------------- */
  function explode(x, y, radius, dmg, fromPlayer) {
    sfx('explosion');
    DCW.shake(4, 0.3); DCW.freeze(4);
    fxSprite('explosion', x, y + radius * 0.6, 0.42, { color: '#f8b800', size: radius, scale: radius >= 26 ? 2 : 1, front: true });
    part({ kind: 'ring', x: x, y: y, r: radius, life: 0.25, color: '#fcfcfc' });
    smoke(x, y, 5);
    debris(x, y, 14, '#f8b800', 170);
    var killsBefore = S.kills, i, e;
    var box = { x: x - radius, y: y - radius, w: radius * 2, h: radius * 2 };
    var circ = function (o) { var nx = U.clamp(x, o.x, o.x + o.w), ny = U.clamp(y, o.y, o.y + o.h); return (nx - x) * (nx - x) + (ny - y) * (ny - y) <= radius * radius; };
    if (fromPlayer) {
      for (i = 0; i < S.enemies.length; i++) {
        e = S.enemies[i];
        if (!e.dead && e.active && circ(e)) damageActor(e, dmg, { kind: 'bomb', kb: 220, dir: cx(e) < x ? -1 : 1 });
      }
      var B = S.boss;
      if (B && B.active && !B.dying && B.alpha > 0.5 && circ(B)) damageActor(B, dmg, { kind: 'bomb' });
      for (i = 0; i < S.objects.length; i++) if (S.objects[i].kind === 'chest' && !S.objects[i].open && circ(S.objects[i])) openChest(S.objects[i]);
      var x0 = Math.floor(box.x / TS), x1 = Math.floor((box.x + box.w) / TS), y0 = Math.floor(box.y / TS), y1 = Math.floor((box.y + box.h) / TS);
      for (var ty = y0; ty <= y1; ty++) for (var tx = x0; tx <= x1; tx++) if (tileAt(tx, ty) === T_CRATE && circ({ x: tx * TS, y: ty * TS, w: TS, h: TS })) breakCrate(tx, ty);
      var k = S.kills - killsBefore;
      if (k >= 3) { track('multi_bomb'); numText(x, y - 20, k + 'X BOMB KILL!', '#f8d878', 1); }
      if (circ(S.player) && S.player.state !== 'dead') hurtPlayer(K.bombSelfDmg, x, { raw: true, cause: 'OWN BOMB' });
    } else {
      if (circ(S.player)) hurtPlayer(dmg, x, { cause: 'EXPLOSION' });
    }
  }
  /* ---------------- player damage ---------------- */
  function hurtPlayer(dmg, srcX, opts) {
    opts = opts || {};
    var P = S.player, run = getRun();
    if (!P || P.state === 'dead' || P.state === 'victory' || P.state === 'pit' || S.done) return false;
    if (P.inv > 0 || P.invuln > 0) return false;
    if (S.god) { P.inv = 0.4; return false; }
    if (P.shield > 0) {
      P.shield--; P.inv = 0.6;
      sfx('block'); debris(cx(P), cy(P), 12, '#78d8f8', 120);
      numText(cx(P), P.y - 4, 'BLOCK', '#78d8f8');
      return false;
    }
    var n = opts.raw ? dmg : Math.max(1, Math.round(dmg - num(stats().def, 0)));
    applyDamage(n);
    S.damageTaken += n;
    P.inv = K.iframes;
    var dir = srcX === undefined ? -P.face : (cx(P) < srcX ? -1 : 1);
    if (opts.knock !== false) {
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
    if (has(G(), 'damageTaken')) call(G(), 'damageTaken', n); // game.js subtracts run.hp
    else run.hp = Math.max(0, run.hp - n);
    if (run.hp < 0) run.hp = 0;
  }
  function killPlayer(cause) {
    var P = S.player;
    if (P.state === 'dead') return;
    P.state = 'dead'; P.st = 0; P.vx = 0; P.vy = -230; P.cause = cause;
    S.combo = 0;
    sfx('death'); DCW.freeze(10); DCW.shake(4, 0.4);
    flash('#f83800', 0.12);
    music(null);
  }

  /* ---------------- player ---------------- */
  function makePlayer(x, feetY) {
    return { x: x - 5, y: feetY - PH, w: 10, h: PH, vx: 0, vy: 0, face: 1, onGround: false, state: 'normal', st: 0,
      coyote: 0, buffer: 0, jumping: false, airJumps: 0, inv: 0, invuln: 0, shield: 0, dropT: 0, crouch: false,
      pIdx: 0, chainT: 0, queued: false, hitList: [], throwT: 0, landT: 0, runT: 0, liqT: 0, platform: null, prevBottom: feetY,
      anim: 'idle', animT: 0 };
  }
  function setCrouch(P, on) {
    if (on === P.crouch) return;
    var d = PH - PH_CROUCH;
    if (on) { P.y += d; P.h = PH_CROUCH; } else {
      // stand up only if there is room
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
    P.state = 'punch'; P.st = 0; P.pIdx = idx; P.hitList = []; P.queued = false;
    if (P.onGround) P.vx += P.face * K.punchStep * (idx === 2 ? 1.4 : 1);
    sfx('punch', { pitch: 1 + idx * 0.08 });
  }
  function throwBomb(P) {
    var run = getRun();
    if ((run.bombs || 0) <= 0) { sfx('error'); numText(cx(P), P.y - 4, 'NO BOMBS', '#f83800'); return; }
    run.bombs--;
    P.throwT = 0.2;
    var drop = I.down('down'); // down+bomb: short toss at your feet
    S.pproj.push({ kind: 'bomb', x: cx(P) + P.face * 6 - 3, y: P.y + 2, w: 6, h: 6, vx: drop ? P.face * 45 : P.face * K.bombVX + P.vx * 0.4,
      vy: drop ? -90 : K.bombVY + Math.min(0, P.vy * 0.3), fuse: K.bombFuse, spin: 0 });
    sfx('bomb_throw');
  }
  function usePotion() {
    var run = getRun();
    if (has(G(), 'usePotion')) {
      if (call(G(), 'usePotion')) { var P = S.player; debris(cx(P), cy(P), 14, '#58f898', 80); numText(cx(P), P.y - 6, 'POTION!', '#58f898'); }
      return;
    }
    var mx = stats().maxHp;
    if ((run.potions || 0) <= 0 || run.hp >= mx) { sfx('error'); return; }
    run.potions--; run.hp = Math.min(mx, run.hp + Math.ceil(mx * 0.5)); sfx('heal'); track('potion');
  }
  function updPlayer(dt) {
    var P = S.player, st = stats(), run = getRun();
    P.prevBottom = P.y + P.h;
    P.inv -= dt; P.invuln -= dt; P.dropT -= dt; P.throwT -= dt; P.landT -= dt; P.chainT -= dt; P.animT += dt;
    if (P.coyote > 0) P.coyote--;
    if (P.buffer > 0) P.buffer--;

    if (P.state === 'dead') {
      P.st += dt;
      if (P.st > 0.35) { P.vy = Math.min(P.vy + K.gravity * 0.7 * dt, 260); P.y += P.vy * dt; }
      if (P.st > 1.9 && !S.diedSent) {
        S.diedSent = true;
        S.done = true;
        var res = { stageId: S.id, cause: P.cause || 'DAMAGE' };
        if (has(G(), 'playerDied')) call(G(), 'playerDied', res); else S.fallbackMsg = 'YOU DIED';
      }
      return;
    }
    if (P.state === 'pit') {
      P.st -= dt;
      if (P.st <= 0) respawnFromPit();
      return;
    }
    if (P.state === 'victory') {
      P.vx = U.approach(P.vx, 0, K.friction * dt);
      P.vy = Math.min(P.vy + K.gravity * dt, K.fallMax);
      moveBody(P, dt, false);
      return;
    }

    var ax = I.axisX(), down = I.down('down'), up = I.down('up');
    if (I.pressed('jump')) P.buffer = K.buffer;
    if (I.pressed('potion')) usePotion();
    if (I.pressed('special')) trySpecial();

    // ---------- interactions (signs, doors) take 'up' priority over ladders ----------
    var near = interactAt(P);
    if (near && I.pressed('up') && (P.onGround || P.state === 'climb')) {
      if (near.kind === 'sign') { readSign(near); }
      else if (near.kind === 'door') { enterDoor(near); return; }
    }
    // walking into the middle of the exit door also takes it
    var bossUp = S.isBoss && S.boss && !S.boss.dead;
    if (near && near.kind === 'door' && P.state === 'normal' && P.onGround && Math.abs(cx(P) - cx(near)) < 8 && !bossUp) { enterDoor(near); return; }
    if (!bossUp && P.state === 'normal' && P.x + P.w >= S.L.pxW - 1) { // walked past the exit: take the last door anyway
      var lastDoor = null;
      for (var di = 0; di < S.objects.length; di++) if (S.objects[di].kind === 'door') lastDoor = S.objects[di];
      if (lastDoor) { enterDoor(lastDoor); return; }
    }

    // ---------- ladder ----------
    if (P.state === 'climb') { updClimb(P, dt, ax); afterMove(P, dt); return; }
    if (P.state === 'normal' && !near) {
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
    if (P.state === 'hurt') {
      P.st += dt;
      if (P.st >= K.hurtDur) P.state = 'normal';
    }
    if (P.state === 'punch') {
      P.st += dt;
      var dur = P.pIdx === 2 ? K.punch3Dur : K.punchDur;
      if (P.st > 0.04 && P.st < 0.13) {
        var bx = P.face > 0 ? P.x + P.w - 2 : P.x - 14;
        var d = P.pIdx === 2 ? st.dmg * 1.35 : st.dmg;
        meleeHit({ x: bx, y: P.y + 3, w: 16, h: 11 }, Math.round(d), { kind: 'punch', kb: P.pIdx === 2 ? 170 : 75, dir: P.face, hitList: P.hitList });
      }
      if (I.pressed('attack') && P.st > 0.05) P.queued = true;
      if (P.st >= dur) {
        if (P.queued && P.pIdx < 2) startPunch(P, P.pIdx + 1);
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
      var r = rollCrit(st.kickDmg);
      var hits = hitBox(ab, r.dmg, { kind: 'stomp', kb: 140, dir: P.face, crit: r.crit, hitList: P.hitList });
      if (hits) {
        P.vy = -K.airkickBounce; P.vx = -P.face * 50; P.state = 'normal'; P.airJumps = st.extraJump ? 1 : 0;
        P.jumping = false; P.inv = Math.max(P.inv, 0.12);
        sfx('stomp'); track('stomp'); DCW.freeze(r.crit ? 5 : 4); DCW.shake(2, 0.1);
      }
    }

    if (control) {
      var crouchWant = P.onGround && down && !ax && P.chainT <= 0;
      setCrouch(P, crouchWant);
      var max = K.runMax * num(st.speedMul, 1);
      if (P.crouch) {
        P.vx = U.approach(P.vx, 0, K.friction * dt);
      } else if (ax) {
        var acc = P.onGround ? K.accelGround : K.accelAir;
        if (P.vx * ax < 0) acc *= K.turnMul;
        P.vx = U.approach(P.vx, ax * max, acc * dt);
        P.face = ax;
      } else {
        P.vx = U.approach(P.vx, 0, (P.onGround ? K.friction : K.airFriction) * dt);
      }
      // attacks
      if (I.pressed('attack')) {
        if (down && P.onGround) { setCrouch(P, false); P.state = 'kick'; P.st = 0; P.hitList = []; P.kickTracked = false; sfx('kick'); }
        else if (down && !P.onGround) { P.state = 'airkick'; P.st = 0; P.hitList = []; P.jumping = false; sfx('kick'); }
        else { setCrouch(P, false); startPunch(P, (P.chainT > 0 && P.lastPIdx < 2) ? P.lastPIdx + 1 : 0); }
      } else if (I.pressed('bomb')) {
        throwBomb(P);
      }
      // jumping
      if (P.buffer > 0 && P.state === 'normal') {
        if (P.onGround || P.coyote > 0) {
          if (down && P.onGround && standingOnPassable(P)) {
            P.dropT = 0.22; P.y += 3; P.onGround = false; P.platform = null; P.buffer = 0; setCrouch(P, false);
          } else {
            setCrouch(P, false);
            P.vy = -K.jumpV; P.jumping = true; P.onGround = false; P.coyote = 0; P.buffer = 0; P.platform = null;
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
    // throwing while in other states is allowed mid-air too
    if (!control && P.state !== 'hurt' && P.state !== 'airkick' && I.pressed('bomb')) throwBomb(P);

    // variable jump height
    if (P.jumping && P.vy < 0 && !I.down('jump')) { P.vy *= K.jumpCut; P.jumping = false; }
    if (P.vy >= 0) P.jumping = false;
    // gravity
    if (P.state !== 'airkick') {
      var gm = P.vy > 0 ? K.fallGravMul : 1;
      P.vy = Math.min(P.vy + K.gravity * gm * dt, K.fallMax);
    }
    var wasGround = P.onGround, fallV = P.vy;
    moveBody(P, dt, P.dropT > 0);
    if (P.onGround) {
      P.coyote = K.coyote; P.airJumps = st.extraJump ? 1 : 0;
      if (!wasGround) {
        if (fallV > 160) { dust(cx(P), P.y + P.h, 3); sfx('land'); P.landT = 0.1; }
        if (P.state === 'airkick') { P.state = 'normal'; P.landT = 0.14; DCW.shake(1, 0.08); dust(cx(P), P.y + P.h, 4); }
      }
      if (Math.abs(P.vx) > 60 && P.state === 'normal') { P.runT += dt; if (P.runT > 0.22) { P.runT = 0; dust(cx(P) - P.face * 4, P.y + P.h, 1); } }
    }
    afterMove(P, dt);
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
    if (P.buffer > 0) { // jump off
      P.state = 'normal'; P.buffer = 0;
      P.vy = I.down('down') ? 0 : -K.jumpV * 0.75; P.jumping = !I.down('down');
      P.vx = ax * K.runMax * 0.8; if (ax) P.face = ax;
      if (P.vy < 0) sfx('jump');
      return;
    }
    if (I.pressed('attack')) { P.state = 'normal'; startPunch(P, 0); return; }
    if (I.pressed('bomb')) throwBomb(P);
    if (ay < 0) {
      var footTy = Math.floor((P.y + P.h + P.vy * dt - 1) / TS);
      if (tileAt(tx, footTy) !== T_LADDER) { // climbed past the top: stand on it
        P.y = (footTy + 1) * TS - P.h; P.vy = 0; P.state = 'normal'; P.onGround = true; return;
      }
      if (solidAt(cx(P), P.y + P.vy * dt)) P.vy = 0;
    } else if (ay > 0) {
      var nb = P.y + P.h + P.vy * dt, by = Math.floor(nb / TS);
      if (isSolidT(tileAt(tx, by)) || (tileAt(tx, by) === T_ONEWAY)) { P.y = by * TS - P.h; P.vy = 0; P.state = 'normal'; P.onGround = true; return; }
      if (tileAt(tx, by) !== T_LADDER && tileAt(tx, Math.floor((nb - P.h * 0.5) / TS)) !== T_LADDER) { P.state = 'normal'; return; }
    }
    P.y += P.vy * dt;
    if (ay) P.animT += dt * 0.5; else P.animT -= dt;
  }
  function afterMove(P, dt) {
    var run = getRun();
    // hazards: spikes + liquid (feet / body overlap)
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
    // pits
    if (P.y > S.L.pxH + 8) { pitFall(); return; }
    // safe ground for respawn
    if (P.onGround && !P.platform && P.state === 'normal' && !spike && !liquid) {
      var fy = P.y + P.h + 1;
      if (safeAt(P.x - 2, fy) && safeAt(P.x + P.w + 2, fy) && !hazardNear(P)) S.lastSafe = { x: cx(P), y: P.y + P.h };
    }
    // checkpoints
    for (var i = 0; i < S.objects.length; i++) {
      var o = S.objects[i];
      if (o.kind === 'checkpoint' && !o.on && overlap(P, o)) {
        o.on = true; S.checkpoint = { x: cx(o), y: o.y + o.h }; S.lastSafe = S.checkpoint;
        sfx('checkpoint'); fxSprite('sparkle', cx(o), o.y + 6, 0.4, { color: '#58f898', size: 10 });
        numText(cx(o), o.y - 8, 'CHECKPOINT', '#58f898');
      }
    }
    // keep inside level horizontally
    if (P.x < 0) P.x = 0;
    if (P.x + P.w > S.L.pxW) P.x = S.L.pxW - P.w;
    // boss arena gate
    if (S.locked && S.arena) {
      if (P.x < S.arena.x0 + TS) { P.x = S.arena.x0 + TS; if (P.vx < 0) P.vx = 0; }
    }
    // run.hp sanity
    if (run.hp > stats().maxHp) run.hp = stats().maxHp;
  }
  function safeAt(px, py) { var t = tileAt(Math.floor(px / TS), Math.floor(py / TS)); return t === T_SOLID || t === T_ALT || t === T_ONEWAY; }
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
    if (!S.god) { applyDamage(K.pitDamage); S.damageTaken += K.pitDamage; }
    S.combo = 0;
    if (run.hp <= 0) { P.y = S.L.pxH - 4; killPlayer('FELL IN A PIT'); return; }
    P.state = 'pit'; P.st = 0.55; P.vx = 0; P.vy = 0;
    numText(cx(P), S.cam.y + H - 20, '-' + K.pitDamage, '#f83800');
  }
  function respawnFromPit() {
    var P = S.player, sp = S.lastSafe || S.checkpoint || S.start;
    setCrouch(P, false);
    P.x = sp.x - P.w / 2; P.y = sp.y - P.h; P.vx = 0; P.vy = 0;
    P.state = 'normal'; P.inv = K.pitIframes; P.platform = null; P.onGround = false;
    smoke(cx(P), cy(P), 4);
    sfx('spawn');
  }
  function interactAt(P) {
    for (var i = 0; i < S.objects.length; i++) {
      var o = S.objects[i];
      if ((o.kind === 'sign' || o.kind === 'door') && P.x < o.x + o.w + 2 && P.x + P.w > o.x - 2 && P.y < o.y + o.h && P.y + P.h > o.y) return o;
    }
    return null;
  }
  function readSign(o) {
    var signs = S.def.signs || [];
    var txt = signs[o.idx] || signs[signs.length - 1] || 'THIS SIGN HAS BEEN DEFACED. THE AI APOLOGIZES FOR NOTHING.';
    sfx('text_blip');
    if (!say(txt)) toast(txt, { time: 3 });
  }
  function enterDoor(o) {
    var P = S.player;
    if (S.done || P.state === 'victory') return;
    if (S.isBoss && S.boss && !S.boss.dead) { numText(cx(o), o.y - 6, 'LOCKED', '#f83800'); sfx('error'); return; }
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
    if (S.clearedSent) return;
    S.clearedSent = true;
    var res = { stageId: S.id, kills: S.kills, time: Math.round(S.t * 10) / 10, damageTaken: S.damageTaken, maxCombo: S.maxCombo,
      views: S.views, gold: S.gold, secrets: S.secrets };
    if (S.boss) res.boss = S.boss.id;
    getRun().hp = Math.max(1, getRun().hp);
    if (has(G(), 'stageCleared')) call(G(), 'stageCleared', res); else S.fallbackMsg = 'STAGE CLEAR';
  }

  /* ---------------- companion ---------------- */
  var COMP_DEFAULTS = {
    donut: { name: 'PRINCESS DONUT', ability: 'missile', cooldown: 1.6, power: 2, special: { name: 'MAGIC MISSILE BARRAGE' } },
    mongo: { name: 'MONGO', ability: 'bite', cooldown: 1.2, power: 3, special: { name: 'MONGO RAMPAGE' } },
    katia: { name: 'KATIA', ability: 'shield', cooldown: 7, power: 1, special: { name: 'IRON WALL' } },
    zev: { name: 'ZEV', ability: 'magnet', cooldown: 3, power: 1, special: { name: 'PRESS CONFERENCE' } },
    squeaks: { name: 'SIR SQUEAKS', ability: 'fetch', cooldown: 2.5, power: 1, special: { name: 'RAT SWARM' } }
  };
  var COMP_COLORS = { missile: '#f8f8f8', bite: '#58d854', shield: '#9878f8', magnet: '#3cbcfc', fetch: '#bcbcbc' };
  function makeCompanion(P) {
    var id = (DCW.save && DCW.save.equipped && DCW.save.equipped.companion) || 'donut';
    var def = (D().companions || {})[id] || COMP_DEFAULTS[id] || COMP_DEFAULTS.donut;
    if (!def) return null;
    var ability = def.ability || (COMP_DEFAULTS[id] && COMP_DEFAULTS[id].ability) || 'missile';
    return { id: id, def: def, ability: ability, sprite: def.sprite || id, x: P.x - 16, y: P.y + P.h - 10, w: 12, h: 10, vx: 0, vy: 0, face: 1,
      onGround: false, cd: 1, actT: 0, state: 'follow', stuckT: 0, pw: 1, target: null, t: 0, hitList: [], color: COMP_COLORS[ability] || '#fff' };
  }
  function nearestEnemy(x, y, maxD, needScreen) {
    var best = null, bd = maxD * maxD;
    for (var i = 0; i < S.enemies.length; i++) {
      var e = S.enemies[i];
      if (e.dead || !e.active || (needScreen && !onScreen(e, 8))) continue;
      var dx = cx(e) - x, dy = cy(e) - y, d = dx * dx + dy * dy;
      if (d < bd) { bd = d; best = e; }
    }
    var B = S.boss;
    if (B && B.active && !B.dying && B.alpha > 0.5) { var bx = cx(B) - x, by = cy(B) - y, d2 = bx * bx + by * by; if (d2 < bd) best = B; }
    return best;
  }
  function teleportComp(C, P) {
    smoke(cx(C), cy(C), 2);
    C.x = cx(P) - P.face * 16 - C.w / 2; C.y = P.y + P.h - C.h - 2; C.vx = 0; C.vy = 0; C.stuckT = 0; C.state = 'follow';
    smoke(cx(C), cy(C), 2);
  }
  function updComp(dt) {
    var C = S.comp, P = S.player;
    if (!C) return;
    var st = stats();
    C.pw = num(st.compPower, 1);
    C.t += dt; C.actT -= dt;
    if (P.state === 'dead' || P.state === 'pit') { C.vx = 0; return; }
    var def = C.def, power = num(def.power, 1) * C.pw;
    // ----- special: rampage -----
    if (C.state === 'rampage') {
      C.rt -= dt;
      C.x += C.face * 330 * dt; C.y = P.y + P.h - C.h;
      // stampede back and forth across the screen; each pass can bite everything again
      if ((C.face > 0 && C.x > S.cam.x + W - 8) || (C.face < 0 && C.x < S.cam.x - 4)) { C.face = -C.face; C.hitList = []; }
      C.actT = 0.1;
      if (Math.random() < 0.5) dust(cx(C), C.y + C.h, 1);
      hitBox({ x: C.x - 6, y: C.y - 24, w: C.w + 12, h: C.h + 30 }, Math.round(power * 4 + st.kickDmg), { kind: 'comp', kb: 160, dir: C.face, hitList: C.hitList, breaks: true, noCombo: false });
      if (C.rt <= 0) { teleportComp(C, P); }
      return;
    }
    if (C.state === 'dash') {
      C.dt -= dt;
      var tg = C.target;
      if (!tg || tg.dead || C.dt <= 0) { C.state = 'follow'; }
      else {
        var dir = U.sign(cx(tg) - cx(C)) || C.face; C.face = dir;
        C.vx = dir * 230;
        if (overlap({ x: C.x - 4, y: C.y - 4, w: C.w + 8, h: C.h + 8 }, tg)) {
          if (C.ability === 'bite') { damageActor(tg, Math.round(power * 1.5), { kind: 'comp', kb: 90, dir: dir }); sfx('bite'); }
          C.state = 'follow'; C.vx = -dir * 80; C.vy = -150; C.actT = 0.25;
        }
      }
    } else if (C.state === 'fetch') {
      C.dt -= dt;
      var pk = C.target;
      if (!pk || S.pickups.indexOf(pk) < 0 || C.dt <= 0) C.state = 'follow';
      else {
        var fd = U.sign(cx(pk) - cx(C)); C.face = fd || C.face; C.vx = C.face * 170;
        if (overlap({ x: C.x - 3, y: C.y - 6, w: C.w + 6, h: C.h + 12 }, pk) && pk.delay <= 0) {
          pk.magnet = true; pk.phys = false; C.state = 'follow'; C.actT = 0.25;
        }
      }
    }
    if (C.state === 'follow') {
      var tx = cx(P) - P.face * 18, dx = tx - cx(C);
      if (Math.abs(dx) > 5) C.vx = U.approach(C.vx, U.sign(dx) * Math.min(150, 30 + Math.abs(dx) * 3.2), 700 * dt);
      else C.vx = U.approach(C.vx, 0, 700 * dt);
      if (Math.abs(dx) > 3) C.face = U.sign(dx);
      else C.face = P.face;
      // hop up ledges / toward a higher player
      if (C.onGround && ((C.hitWall && Math.abs(dx) > 8) || (P.y + P.h < C.y + C.h - 18 && Math.abs(dx) < 56 && P.onGround))) { C.vy = -310; C.onGround = false; }
    }
    // physics
    C.vy = Math.min(C.vy + K.gravity * dt, K.fallMax);
    var wasG = C.onGround;
    moveBody(C, dt, P.dropT > 0 && cy(C) < cy(P) + 8);
    if (!wasG && C.onGround && C.vy === 0 && Math.random() < 0.3) dust(cx(C), C.y + C.h, 1);
    var ddx = cx(P) - cx(C), ddy = cy(P) - cy(C);
    if (Math.abs(ddx) > 40 && Math.abs(C.vx) < 5 && C.state === 'follow') C.stuckT += dt; else C.stuckT = Math.max(0, C.stuckT - dt);
    if (ddx * ddx + ddy * ddy > 180 * 180 || C.y > S.L.pxH || C.stuckT > 1.2) teleportComp(C, P);
    // ----- ability on cooldown -----
    var cool = num(def.cooldown, 2) / (0.5 + 0.5 * C.pw);
    C.cd -= dt;
    if (C.cd <= 0) {
      var used = false;
      switch (C.ability) {
        case 'missile': {
          var e = nearestEnemy(cx(C), cy(C), 170, true);
          if (e) { fireMissile(cx(C), C.y, e, Math.max(1, Math.round(power)), C.face); used = true; }
          break;
        }
        case 'bite': {
          var b = nearestEnemy(cx(C), cy(C), 80, true);
          if (b) { C.state = 'dash'; C.target = b; C.dt = 0.6; C.actT = 0.3; used = true; }
          break;
        }
        case 'shield': {
          if (P.shield <= 0) { P.shield = 1; sfx('shield'); C.actT = 0.4; numText(cx(P), P.y - 6, 'SHIELD', '#9878f8'); used = true; }
          break;
        }
        case 'magnet': {
          // pull everything nearby a lot harder, occasionally hype the crowd
          var pulled = 0;
          for (var i = 0; i < S.pickups.length; i++) {
            var p = S.pickups[i];
            if (p.kind !== 'box' && onScreen(p) && Math.abs(cx(p) - cx(P)) < 130) { p.magnet = true; p.delay = 0; pulled++; }
          }
          if (pulled) { C.actT = 0.3; used = true; sfx('pickup', { pitch: 1.4 }); }
          break;
        }
        case 'fetch': {
          var best = null, bd = 140;
          for (var j = 0; j < S.pickups.length; j++) {
            var q = S.pickups[j]; if (q.kind === 'box' || q.magnet) continue;
            var d = Math.abs(cx(q) - cx(C)) + Math.abs(cy(q) - cy(C)) * 0.5;
            if (d < bd) { bd = d; best = q; }
          }
          if (best) { C.state = 'fetch'; C.target = best; C.dt = 2; used = true; }
          if (Math.random() < num(def.bombChance, 0.06) * C.pw) {
            var bp = addPickup('bomb', cx(C), C.y, C.face * 30, -160, true);
            bp.magnet = false; C.actT = 0.4; used = true;
            numText(cx(C), C.y - 8, 'FOUND A BOMB!', '#fcfcfc');
          }
          break;
        }
      }
      C.cd = used ? cool : 0.25;
    }
  }
  function fireMissile(x, y, target, dmg, face) {
    S.pproj.push({ kind: 'missile', x: x - 3, y: y - 3, w: 6, h: 6, vx: (face || 1) * 40, vy: -110, target: target, life: 2.6, dmg: dmg, t: 0 });
    sfx('missile');
  }
  function trySpecial() {
    var C = S.comp, P = S.player;
    if (!C) return;
    if (S.special < 1) { if (S.special < 0.98) { sfx('error'); } return; }
    S.special = 0;
    var def = C.def, power = num(def.power, 1) * C.pw, st = stats();
    var name = (def.special && def.special.name) || 'SPECIAL';
    announce(name, { color: '#f8d878', time: 1.6, sub: (def.name || C.id).toUpperCase() });
    flash('#fcfcfc', 0.22);
    DCW.shake(3, 0.3); DCW.freeze(6);
    C.actT = 1;
    var i, e;
    switch (C.ability) {
      case 'missile': {
        sfx('missile', { pitch: 0.7 });
        var targets = [];
        for (i = 0; i < S.enemies.length; i++) { e = S.enemies[i]; if (!e.dead && e.active && onScreen(e)) targets.push(e); }
        if (S.boss && S.boss.active && !S.boss.dying) targets.push(S.boss);
        for (i = 0; i < 16; i++) {
          var tg = targets.length ? targets[i % targets.length] : null;
          S.missileQueue = S.missileQueue || [];
          S.missileQueue.push({ at: i * 0.06, target: tg, dmg: Math.max(2, Math.round(power * 1.6)) });
        }
        break;
      }
      case 'bite':
        C.state = 'rampage'; C.rt = num(def.special && def.special.time, 0) || 1.8; C.hitList = []; C.hitReset = 0;
        C.x = S.cam.x - 16; C.face = 1;
        smoke(cx(C), cy(C), 3);
        sfx('bite');
        break;
      case 'shield':
        P.invuln = num(def.special && def.special.time, 0) || 6; P.shield = Math.max(P.shield, 1);
        sfx('shield');
        break;
      case 'magnet':
        var stunT = num(def.special && def.special.time, 0) || 4;
        for (i = 0; i < S.enemies.length; i++) { e = S.enemies[i]; if (!e.dead && onScreen(e, 16)) { e.stun = stunT; e.vx = 0; numText(cx(e), e.y - 6, 'STUNNED', '#3cbcfc'); } }
        if (S.boss && S.boss.active && !S.boss.dying) S.boss.stun = Math.min(2, stunT);
        for (i = 0; i < S.pickups.length; i++) if (onScreen(S.pickups[i])) { S.pickups[i].magnet = true; S.pickups[i].delay = 0; }
        S.doubleViewsT = Math.max(8, stunT * 3);
        numText(cx(P), P.y - 16, 'DOUBLE VIEWS!', '#f878f8', 1);
        sfx('views');
        break;
      case 'fetch':
        for (i = 0; i < 12; i++) {
          S.allies.push({ x: S.cam.x - 20 - i * 14, y: P.y + P.h - 10 - (i % 3) * 2, w: 12, h: 8, vx: 210 + Math.random() * 60, vy: 0, life: 3.2, dmg: Math.max(1, Math.round(power * 2 + st.dmg)), hitList: [], onGround: false, t: Math.random() });
        }
        // ...and the favor he called in: goodies rain from above
        for (i = 0; i < 7; i++) {
          var kind = i === 0 ? 'snack' : i === 1 ? 'bomb' : 'coin';
          var pk = addPickup(kind, S.cam.x + 40 + Math.random() * (W - 80), S.cam.y + 4, U.rand(-20, 20), 40, true, kind === 'coin' ? Math.max(1, Math.round(2 * floorScale())) : 0);
          pk.delay = 0.1;
        }
        sfx('spawn');
        break;
    }
  }
  function updAllies(dt) {
    if (S.missileQueue && S.missileQueue.length) {
      for (var q = S.missileQueue.length - 1; q >= 0; q--) {
        var m = S.missileQueue[q]; m.at -= dt;
        if (m.at <= 0) {
          var C = S.comp, tg = m.target && !m.target.dead ? m.target : nearestEnemy(cx(C), cy(C), 300, true);
          fireMissile(cx(C) + U.rand(-6, 6), C.y - 4, tg, m.dmg, U.chance(0.5) ? 1 : -1);
          S.missileQueue.splice(q, 1);
        }
      }
    }
    for (var i = S.allies.length - 1; i >= 0; i--) {
      var a = S.allies[i];
      a.life -= dt; a.t += dt;
      a.vy = Math.min(a.vy + K.gravity * dt, K.fallMax);
      var vx = a.vx;
      moveBody(a, dt, false);
      if (a.hitWall && a.onGround) { a.vy = -260; a.vx = vx; }
      else a.vx = vx;
      hitBox(a, a.dmg, { kind: 'comp', kb: 120, dir: 1, hitList: a.hitList, breaks: false });
      if (a.life <= 0 || a.y > S.L.pxH || a.x > S.cam.x + W + 40) { if (a.life <= 0) smoke(cx(a), cy(a), 1); S.allies.splice(i, 1); }
    }
  }

  /* ---------------- enemies ---------------- */
  var AI_COLORS = { walker: '#ac7c00', chaser: '#d82800', jumper: '#00a800', flyer: '#6844fc', shooter: '#0078f8', charger: '#a81000', turret: '#787878', spawner: '#881400', bomber: '#e45c10', hopper: '#008888' };
  function enemyDef(id) {
    if (S && S.edefs && S.edefs[id]) return S.edefs[id];
    var data = D(), d = null;
    if (typeof data.enemyFor === 'function') { // floor-scaled copy when an enemy is reused on a later floor
      try { d = data.enemyFor(id, getRun().floor || (S && S.def && S.def.floor) || 1); } catch (e) { d = null; }
    }
    if (!d) d = (data.enemies || {})[id];
    if (!d) d = { name: String(id).toUpperCase(), hp: 4, dmg: 1, speed: 30, w: 12, h: 12, ai: 'walker', xp: 2, gold: [0, 2], sprite: id };
    if (S) { S.edefs = S.edefs || {}; S.edefs[id] = d; }
    return d;
  }
  function makeEnemy(id, fx, fy, elite, flyerSlot) {
    var d = enemyDef(id);
    var ai = d.ai || 'walker';
    var ai0 = artInfo((d.sprite || id) + '_walk'), okInfo = ai0 && !ai0.missing;
    var w = num(d.w, okInfo ? Math.max(8, ai0.w - 4) : 12), h = num(d.h, okInfo ? Math.max(6, ai0.h - 1) : 12);
    var flying = ai === 'flyer' || !!d.flying;
    var hp = Math.max(1, Math.round(num(d.hp, 3) * (elite ? 1.6 : 1)));
    var e = {
      id: id, def: d, ai: ai, elite: !!elite, x: fx - w / 2, y: flying ? fy - TS / 2 - h / 2 : fy - h, w: w, h: h, vx: 0, vy: 0,
      hp: hp, maxHp: hp, face: Math.random() < 0.5 ? -1 : 1, flying: flying, speed: num(d.speed, 30), dmg: num(d.dmg, 1) + (elite ? 1 : 0),
      aggro: num(d.aggro, 96), st: 0, timer: 0.5 + Math.random(), state: 'patrol', flash: 0, stun: 0, hurtT: 0, active: false,
      onGround: false, baseY: 0, t: Math.random() * 6, kids: 0, sprite: d.sprite || id, color: AI_COLORS[ai] || '#ac7c00', tele: 0
    };
    e.baseY = e.y;
    if (flyerSlot && !flying) e.y = fy - h; // a non-flyer in a flyer slot just stands there
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
  // fire an enemy projectile. aim: {x,y} target; lob: arc to target
  function fireProj(id, x, y, tx, ty, opts) {
    opts = opts || {};
    var pd = projDef(id);
    var speed = num(opts.speed, num(pd.speed, 130)), grav = num(pd.gravity, 0);
    var w = num(pd.w, 6), h = num(pd.h, 6);
    var p = { id: id, sprite: pd.sprite || id, x: x - w / 2, y: y - h / 2, w: w, h: h, vx: 0, vy: 0, grav: grav, life: num(pd.life, 3), dmg: num(opts.dmg, num(pd.dmg, 1)), t: 0, ghost: !!opts.ghost };
    if (opts.lob) {
      var g = grav > 0 ? grav : 420; p.grav = g;
      var T = U.clamp(Math.abs(tx - x) / 110, 0.55, 1.3);
      p.vx = (tx - x) / T; p.vy = (ty - y - 0.5 * g * T * T) / T;
    } else if (opts.angle !== undefined) {
      p.vx = Math.cos(opts.angle) * speed; p.vy = Math.sin(opts.angle) * speed;
    } else {
      var dx = tx - x, dy = ty - y, d = Math.sqrt(dx * dx + dy * dy) || 1;
      p.vx = dx / d * speed; p.vy = dy / d * speed;
      if (grav > 0) p.vy -= grav * 0.25; // arcing projectile aimed: give it some lift
    }
    if (opts.vx !== undefined) p.vx = opts.vx;
    if (opts.vy !== undefined) p.vy = opts.vy;
    S.eproj.push(p);
    return p;
  }
  function updEnemies(dt) {
    var P = S.player, camL = S.cam.x - K.updateMargin, camR = S.cam.x + W + K.updateMargin;
    var pcx = cx(P), pcy = cy(P);
    for (var i = S.enemies.length - 1; i >= 0; i--) {
      var e = S.enemies[i];
      if (e.dead) { S.enemies.splice(i, 1); continue; }
      if (e.x + e.w < camL || e.x > camR) { e.active = false; continue; }
      e.active = true;
      e.t += dt;
      if (e.flash > 0) e.flash -= dt;
      var vis = onScreen(e, 24);
      var dx = pcx - cx(e), dy = pcy - cy(e), adx = Math.abs(dx);
      var near = vis && adx < e.aggro && Math.abs(dy) < 72 && P.state !== 'dead';
      var harmless = false;
      if (e.stun > 0) {
        e.stun -= dt; harmless = true;
        if (!e.flying) { e.vx = U.approach(e.vx, 0, 600 * dt); e.vy = Math.min(e.vy + K.gravity * dt, K.fallMax); moveBody(e, dt, false); }
        if (Math.random() < 0.05) fxSprite('sparkle', cx(e), e.y, 0.25, { color: '#3cbcfc', size: 4 });
      } else if (e.hurtT > 0) {
        e.hurtT -= dt; harmless = true;
        if (e.flying) { e.x += e.vx * dt; e.y += e.vy * dt; e.vx *= 0.9; e.vy *= 0.9; }
        else { e.vx = U.approach(e.vx, 0, 500 * dt); e.vy = Math.min(e.vy + K.gravity * dt, K.fallMax); moveBody(e, dt, false); }
      } else {
        (AI[e.ai] || AI.walker)(e, dt, dx, dy, adx, near, vis);
      }
      if (e.y > S.L.pxH + 32) { if (e.lastHit !== undefined && S.t - e.lastHit < 2) killEnemy(e, { kind: 'pit' }); e.dead = true; continue; }
      if (e.flying) { e.y = U.clamp(e.y, -8, S.L.pxH - e.h - 4); }
      // contact with the player (stomps always work; hit-stunned enemies deal no contact damage)
      if (!e.dead && P.state !== 'dead' && P.state !== 'pit' && overlap(P, e)) playerTouches(e, harmless);
    }
  }
  function playerTouches(e, harmless) {
    var P = S.player;
    // stomp: falling onto the head
    if (P.vy > 20 && P.prevBottom <= e.y + Math.max(7, P.vy / 60 + 4) && P.state !== 'airkick') {
      var st = stats(), r = rollCrit(st.kickDmg);
      damageActor(e, r.dmg, { kind: 'stomp', kb: 40, crit: r.crit, dir: P.face });
      P.vy = -(I.down('jump') ? K.stompBounceHeld : K.stompBounce); P.jumping = I.down('jump'); P.onGround = false;
      P.airJumps = st.extraJump ? 1 : 0; P.inv = Math.max(P.inv, 0.08);
      P.y = e.y - P.h - 1;
      sfx('stomp'); track('stomp'); DCW.freeze(r.crit ? 5 : 3);
      return;
    }
    if (P.state === 'airkick' || harmless) return; // airkick handled by its own hitbox
    hurtPlayer(e.dmg, cx(e), { cause: (e.def.name || e.id) });
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
  var AI = {
    walker: function (e, dt) { patrol(e, dt, e.speed); gravMove(e, dt); },
    chaser: function (e, dt, dx, dy, adx, near) {
      if (near && adx > 4) {
        e.face = U.sign(dx);
        e.vx = U.approach(e.vx, e.face * e.speed * 1.5, 400 * dt);
        if (e.onGround && !groundAhead(e)) e.vx = 0;
        if (e.onGround && e.hitWallLast && dy < -8) { e.vy = -num(e.def.jump, 220); }
      } else patrol(e, dt, e.speed);
      gravMove(e, dt);
      e.hitWallLast = e.hitWall;
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
      if (near || (onScreen(e) && adx < e.aggro * 1.5)) {
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
          fireProj(e.def.projectile || 'arrow', cx(e) + e.face * 6, e.y + e.h * 0.4, cx(P), cy(P));
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
      if (vis && adx < e.aggro * 1.6) {
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
          if ((e.kids || 0) < 3) {
            var kid = spawnEnemy(e.def.spawn || 'roach', cx(e), e.y + e.h, { parent: e, noLoot: true, face: U.sign(dx) || 1 });
            kid.vy = -120; kid.vx = kid.face * 40;
            e.kids = (e.kids || 0) + 1;
            sfx('spawn', { vol: 0.5 });
          }
        }
      }
      if (!e.flying) gravMove(e, dt);
    },
    bomber: function (e, dt, dx, dy, adx, near) {
      if (near || (onScreen(e) && adx < e.aggro * 1.6)) {
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
          fireProj(e.def.projectile || 'bottle', cx(e), e.y, cx(P) + P.vx * 0.4, P.y + P.h - 4, { lob: true });
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
        // landing shockwave
        var fy = e.y + e.h;
        addHaz({ kind: 'wave', x: cx(e) - 4, y: fy - 8, w: 8, h: 8, vx: -120, life: 0.4, dmg: e.dmg, ownerEnemy: true });
        addHaz({ kind: 'wave', x: cx(e) - 4, y: fy - 8, w: 8, h: 8, vx: 120, life: 0.4, dmg: e.dmg, ownerEnemy: true });
        if (onScreen(e)) { DCW.shake(1.5, 0.1); dust(cx(e), fy, 3); sfx('stomp', { vol: 0.5, pitch: 0.7 }); }
      }
    }
  };
  function groundAheadDir(e, dir) { var f = e.face; e.face = dir; var r = groundAhead(e); e.face = f; return r; }

  /* ---------------- hazards (waves, beams, spikes) ---------------- */
  function addHaz(h) { h.t = 0; h.tele = h.tele || 0; S.haz.push(h); return h; }
  function updHaz(dt) {
    var P = S.player;
    for (var i = S.haz.length - 1; i >= 0; i--) {
      var h = S.haz[i];
      h.t += dt;
      if (h.t < h.tele) continue; // telegraph phase: harmless, drawn as a warning
      if (!h.fired) { h.fired = true; if (h.onFire) h.onFire(h); }
      if (h.vx) {
        h.x += h.vx * dt;
        if (Math.random() < 0.5 && onScreen(h)) dust(cx(h), h.y + h.h, 1);
        var ahead = h.vx > 0 ? h.x + h.w : h.x;
        if (solidAt(ahead, h.y + h.h - 2)) h.life = 0;
        if (S.arena && S.locked && (h.x < S.arena.x0 || h.x > S.arena.x1)) h.life = 0;
      }
      if (h.t - h.tele > h.life) { S.haz.splice(i, 1); continue; }
      if (!h.harmless && overlap(h, P) && P.state !== 'dead') hurtPlayer(h.dmg, cx(h), { cause: h.cause || 'BOSS' });
    }
  }

  /* ---------------- projectiles ---------------- */
  function updProjectiles(dt) {
    var P = S.player, i, p;
    for (i = S.eproj.length - 1; i >= 0; i--) {
      p = S.eproj[i];
      p.t += dt; p.life -= dt;
      p.vy += p.grav * dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
      var dead = p.life <= 0 || p.y > S.L.pxH + 16 || p.x < S.cam.x - 80 || p.x > S.cam.x + W + 80;
      if (!dead && !p.ghost && p.t > (p.ghostUntil || 0) && solidAt(cx(p), cy(p))) { dead = true; if (onScreen(p)) { smoke(cx(p), cy(p), 1); } }
      if (!dead && P.state !== 'dead' && overlap(p, P)) { hurtPlayer(p.dmg, cx(p), { cause: 'PROJECTILE' }); dead = true; hitSpark(cx(p), cy(p)); }
      if (dead) S.eproj.splice(i, 1);
    }
    for (i = S.pproj.length - 1; i >= 0; i--) {
      p = S.pproj[i];
      if (p.kind === 'bomb') {
        p.fuse -= dt; p.spin += dt * 12;
        var wvy = p.vy, wvx = p.vx;
        p.vy = Math.min(p.vy + K.bombGrav * dt, 360);
        moveBody(p, dt, false);
        if (p.onGround) { if (wvy > 80) { p.vy = -wvy * 0.4; p.onGround = false; } p.vx *= 0.8; }
        if (p.hitWall) p.vx = -wvx * 0.5;
        var boom = p.fuse <= 0 || p.y > S.L.pxH;
        if (!boom) {
          for (var j = 0; j < S.enemies.length; j++) { var e = S.enemies[j]; if (!e.dead && e.active && overlap(p, e)) { boom = true; break; } }
          if (S.boss && S.boss.active && !S.boss.dying && S.boss.alpha > 0.5 && overlap(p, S.boss)) boom = true;
        }
        if (boom) { S.pproj.splice(i, 1); if (p.y <= S.L.pxH) explode(cx(p), cy(p), num(stats().bombRadius, 28), num(stats().bombDmg, 10), true); }
      } else if (p.kind === 'missile') {
        p.t += dt; p.life -= dt;
        var tg = p.target;
        if (!tg || tg.dead || (tg.isBoss && (tg.dying || tg.alpha < 0.5))) tg = p.target = (p.t > 0.15 ? nearestEnemy(cx(p), cy(p), 220, true) : null);
        if (tg && p.t > 0.12) {
          var dx = cx(tg) - cx(p), dy = cy(tg) - cy(p), d = Math.sqrt(dx * dx + dy * dy) || 1, sp = 210;
          var k = Math.min(1, 7 * dt);
          p.vx += (dx / d * sp - p.vx) * k; p.vy += (dy / d * sp - p.vy) * k;
        } else if (!tg) { p.vy += 60 * dt; }
        p.x += p.vx * dt; p.y += p.vy * dt;
        if (S.frameParity) part({ kind: 'px', x: cx(p), y: cy(p), life: 0.2, color: '#f878f8', size: 1 });
        var hit = null;
        for (var m = 0; m < S.enemies.length; m++) { var en = S.enemies[m]; if (!en.dead && en.active && overlap(p, en)) { hit = en; break; } }
        if (!hit && S.boss && S.boss.active && !S.boss.dying && S.boss.alpha > 0.5 && overlap(p, S.boss)) hit = S.boss;
        if (hit) { damageActor(hit, p.dmg, { kind: 'missile', kb: 60, dir: U.sign(p.vx) || 1 }); S.pproj.splice(i, 1); continue; }
        if (p.life <= 0 || solidAt(cx(p), cy(p))) { fxSprite('sparkle', cx(p), cy(p) + 4, 0.2, { color: '#f878f8', size: 5 }); S.pproj.splice(i, 1); }
      }
    }
  }

  /* ---------------- boss ---------------- */
  function bossDef(id) {
    var b = (D().bosses || {})[id];
    return b || { name: String(id || 'BOSS').toUpperCase(), hp: 60, dmg: 2, w: 40, h: 32, sprite: id, xp: 50, gold: [30, 50],
      phases: [{ below: 1, speed: 40, pattern: ['walk:2', 'charge', 'idle:1', 'jump_slam'] }], intro: ['A BOSS APPEARS.'], defeat: 'THE BOSS IS DOWN.' };
  }
  function makeBoss() {
    var id = S.def.boss || 'boss';
    var d = bossDef(id);
    var bi = artInfo((d.sprite || id) + '_idle'), okB = bi && !bi.missing;
    var w = num(d.w, okB ? Math.round(bi.w * 0.7) : 40), h = num(d.h, okB ? bi.h - 4 : 32), sp = S.bossSpawn;
    var hp = Math.max(1, Math.round(num(d.hp, 60)));
    var phases = (d.phases && d.phases.length) ? d.phases.slice().sort(function (a, b) { return num(b.below, 1) - num(a.below, 1); }) : [{ below: 1, speed: 40, pattern: ['walk:2', 'idle:1'] }];
    var B = { isBoss: true, id: id, def: d, x: sp.x - w / 2, y: sp.y - h, w: w, h: h, vx: 0, vy: 0, face: -1, hp: hp, maxHp: hp,
      phases: phases, phase: 0, pIdx: 0, move: null, flash: 0, flying: !!d.flying, active: false, dying: false, dead: false, alpha: 1,
      sprite: d.sprite || id, onGround: false, stun: 0, pendingPhase: -1, adds: 0, anim: 'idle', t: 0, dmg: num(d.dmg, 2) };
    B.groundY = sp.y;
    B.homeY = B.flying ? sp.y - 72 - h / 2 : B.y;
    if (B.flying) B.y = B.homeY;
    return B;
  }
  function bossSpeed(B) { var ph = B.phases[B.phase] || {}; return num(ph.speed, 40); }
  function damageBoss(B, dmg, opts) {
    if (B.dying || B.dead || !B.active) return false;
    if (B.move && B.move.invuln) { numText(cx(B), B.y - 4, 'IMMUNE', '#bcbcbc'); return false; }
    var n = Math.max(1, Math.round(dmg - num(B.def.armor, 0)));
    B.hp -= n; B.flash = 0.1;
    hitSpark(opts.hitX !== undefined ? opts.hitX : U.clamp(cx(S.player), B.x + 4, B.x + B.w - 4), cy(B) - 4 + U.rand(-6, 6), opts.crit);
    numText(cx(B) + U.rand(-8, 8), B.y - 2, n, opts.crit ? '#f8d878' : '#fcfcfc', opts.crit ? 2 : 1);
    if (!opts.noCombo) registerHit(n);
    var frac = B.hp / B.maxHp;
    for (var i = B.phases.length - 1; i > B.phase; i--) {
      if (frac < num(B.phases[i].below, 0)) { if (B.pendingPhase < i) B.pendingPhase = i; break; }
    }
    if (B.hp <= 0) { B.hp = 0; bossDie(B); return true; }
    return false;
  }
  function parseMove(str) {
    var parts = String(str || 'idle:1').split(':');
    return { name: parts[0], a: parts[1], b: parts[2], t: 0, sub: 0, st: 0, n: 0 };
  }
  function nextMove(B) {
    if (B.pendingPhase > B.phase) {
      B.phase = B.pendingPhase; B.pIdx = 0;
      B.move = { name: 'phase', t: 0, sub: 0, st: 0, invuln: true };
      sfx('boss_roar'); DCW.shake(4, 0.6); flash('#f83800', 0.12);
      announce('PHASE ' + (B.phase + 1), { color: '#f83800', time: 1 });
      return;
    }
    var pat = (B.phases[B.phase] && B.phases[B.phase].pattern) || ['idle:1'];
    if (!pat.length) pat = ['idle:1'];
    B.move = parseMove(pat[B.pIdx % pat.length]);
    B.pIdx++;
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
    if (!B.active) {
      // idle until the player enters the arena
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
    var done = (MOVES[m.name] || MOVES.idle)(B, m, dt, P);
    // physics
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
    if (S.arena) { var c2 = arenaClampX(B.x, B.w); if (c2 !== B.x) { B.hitWall = B.hitWall || (B.x < c2 ? -1 : 1); B.x = c2; } }
    if (done) { B.vx = B.flying ? 0 : B.vx; nextMove(B); }
    contactBoss(B);
  }
  function contactBoss(B) {
    var P = S.player;
    if (B.alpha < 0.6 || P.state === 'dead' || P.state === 'pit') return;
    var hb = { x: B.x + 3, y: B.y + 3, w: B.w - 6, h: B.h - 3 };
    if (!overlap(P, hb)) return;
    if (P.vy > 20 && P.prevBottom <= B.y + 8 && P.state !== 'airkick') {
      var st = stats(), r = rollCrit(st.kickDmg);
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
    // drop a gate on the arena entrance
    for (var ty = 0; ty < L.h; ty++) {
      if (tileAt(tx, ty) === T_EMPTY) { setTile(tx, ty, T_ALT); S.gates.push(ty * L.w + tx); }
    }
    smoke(tx * TS + 8, S.player.y, 4);
    var d = B.def, f = S.floor || {};
    var bm = f.bossMusic || ((f.n === 9 || getRun().floor === 9) ? 'boss_final' : 'boss');
    music(S.def.bossMusic || bm);
    sfx('boss_roar'); DCW.shake(3, 0.5);
    B.wake = 0.9;
    var intro = d.intro;
    if (intro && intro.length) say(intro);
    announce(d.name || 'BOSS', { color: '#f83800', time: 1.8, sub: d.title || '' });
  }
  function unlockArena() {
    var L = S.L;
    S.gates.forEach(function (i) { L.t[i] = T_EMPTY; });
    S.gates = [];
    S.locked = false;
  }
  function bossDie(B) {
    B.dying = true; B.dt = 0; B.move = null; B.vx = 0;
    sfx('boss_die'); DCW.freeze(18); DCW.shake(5, 1.6); flash('#fcfcfc', 0.25);
    S.eproj.length = 0; S.haz.length = 0;
    for (var i = 0; i < S.enemies.length; i++) { var e = S.enemies[i]; if (!e.dead && e.isAdd) { e.dead = true; smoke(cx(e), cy(e), 3); } }
    music(null);
  }
  function updBossDeath(B, dt) {
    B.dt += dt;
    if (!B.flying) { B.vy = Math.min(B.vy + K.gravity * dt, 420); moveBody(B, dt, true); }
    else { B.y = Math.min(B.y + 20 * dt, bossGround(B) - B.h); }
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
      var coins = spillCoinsReturn(cx(B), cy(B), U.randi(num(g[0], 20), num(g[1], 40)), 14);
      coins.forEach(function (c) { c.delay = 0.6; c.magnetAt = 0.6; });
      S.bossCoins = coins;
      var v = Math.round(num(d.views, 500 * (getRun().floor || 1)) * comboMul());
      var got = addViews(v);
      numText(cx(B), B.y - 10, '+' + got + ' VIEWS', '#f878f8', 1);
      S.kills++;
      track('kill');
    }
    if (B.dt >= 3.0 && B.gone && !B.dead) {
      // everything magnets to Carl
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
  function spillCoinsReturn(x, y, gold, max) {
    var before = S.pickups.length;
    spillCoins(x, y, gold, max);
    return S.pickups.slice(before);
  }
  function faceP(B, P) { B.face = cx(P) < cx(B) ? -1 : 1; }
  function bossFire(B, projId, tx, ty, opts) {
    opts = opts || {};
    var pd = projDef(projId);
    if (opts.dmg === undefined) opts.dmg = Math.max(num(pd.dmg, 1), Math.ceil(B.dmg * 0.75));
    return fireProj(projId, cx(B) + B.face * (B.w * 0.35), B.y + B.h * 0.4, tx, ty, opts);
  }
  function tele(B, m, time) { // generic telegraph: flash + warn once
    if (!m.warned) { m.warned = true; sfx('warn'); }
    B.anim = 'attack';
    B.flash = (Math.floor(m.t * 16) % 2) ? 0.04 : 0;
    return m.t >= time;
  }
  var MOVES = {
    idle: function (B, m, dt, P) {
      var dur = num(parseFloat(m.a), 1);
      B.vx = U.approach(B.vx, 0, 600 * dt); B.anim = 'idle';
      if (B.flying) { B.vy = (B.homeY + Math.sin(B.t * 2.5) * 6 - B.y) * 4; }
      faceP(B, P);
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
        if (tele(B, m, 0.6)) { m.sub = 1; m.st = m.t; sfx('boss_roar', { vol: 0.5, pitch: 1.3 }); }
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
          if (B.flying) { m.tx = tx; m.manualFly = true; }
          else { var T = 0.9; B.vy = -K.gravity * T / 2 * 0.98; B.vx = (tx - cx(B)) / T; B.onGround = false; sfx('jump', { pitch: 0.5 }); }
          m.onLand = slamLand;
        }
        return false;
      }
      if (m.sub === 1) {
        B.anim = 'special';
        if (B.flying) {
          // glide over the target, then drop
          if (m.t - m.st < 0.45) { B.vx = (m.tx - cx(B)) * 5; B.vy = (B.homeY - 20 - B.y) * 4; }
          else { B.vx = 0; B.vy = 380; if (B.y + B.h >= bossGround(B) - 1) { slamLand(B, m); } }
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
      B.vx = U.approach(B.vx, 0, 600 * dt); faceP(B, P);
      if (B.flying) B.vy = (B.homeY + Math.sin(B.t * 2.5) * 6 - B.y) * 4;
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
      var n = Math.max(1, parseInt(m.b || '2', 10) || 2), eid = m.a || 'rat';
      B.vx = U.approach(B.vx, 0, 600 * dt);
      if (B.flying) B.vy = (B.homeY + Math.sin(B.t * 2.5) * 6 - B.y) * 4;
      if (m.sub === 0) { if (tele(B, m, 0.45)) { m.sub = 1; m.st = m.t; } return false; }
      if (m.sub === 1) {
        B.anim = 'special'; B.flash = 0;
        var alive = 0;
        for (var i = 0; i < S.enemies.length; i++) if (S.enemies[i].isAdd && !S.enemies[i].dead) alive++;
        for (var k = 0; k < n && alive < 6; k++, alive++) {
          var x = arenaClampX(cx(B) + U.rand(-30, 30), 8) + 4;
          var e = spawnEnemy(eid, x, bossGround(B), { isAdd: true });
          if (e.flying) { e.y = B.y; e.baseY = Math.max(S.cam.y + 30, B.homeY - 10); }
          else { e.y = Math.min(B.y + B.h - e.h, bossGround(B) - e.h); e.vy = -180; e.vx = U.rand(-60, 60); }
          e.aggro = 400;
        }
        sfx('spawn');
        m.sub = 2; m.st = m.t;
        return false;
      }
      return m.t - m.st > 0.5;
    },
    swoop: function (B, m, dt, P) {
      if (!B.flying) { // ground bosses leap instead
        return MOVES.jump_slam(B, m, dt, P);
      }
      m.manual = true;
      if (m.sub === 0) {
        B.vx = 0; faceP(B, P);
        B.y += ((B.homeY - 12) - B.y) * Math.min(1, 5 * dt);
        if (tele(B, m, 0.45)) {
          m.sub = 1; m.st = m.t; m.x0 = B.x; m.y0 = B.y; m.ty = P.y + P.h - B.h;
          var dx = cx(P) - cx(B);
          m.x2 = arenaClampX(B.x + dx * 2, B.w);
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
        if (!m.warned) { m.warned = true; sfx('spawn'); smoke(cx(B), cy(B), 5); }
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
        m.haz = addHaz({ kind: 'beam', x: a0, y: m.by - 5, w: a1 - a0, h: 10, tele: 0.85, life: 0.5, dmg: Math.max(2, B.dmg), cause: 'LASER',
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
    }
  };
  function groundUnder(x, fromY) {
    var tx = Math.floor(x / TS);
    for (var ty = Math.max(0, Math.floor(fromY / TS)); ty < S.L.h; ty++) {
      var t = tileAt(tx, ty);
      if (isSolidT(t) || t === T_ONEWAY) return ty * TS;
    }
    return S.boss ? bossGround(S.boss) : S.L.pxH - 32;
  }
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
    addHaz({ kind: 'wave', x: B.x - 10, y: fy - 12, w: 10, h: 12, vx: -speed, life: life, dmg: dmg, cause: 'SHOCKWAVE' });
    addHaz({ kind: 'wave', x: B.x + B.w, y: fy - 12, w: 10, h: 12, vx: speed, life: life, dmg: dmg, cause: 'SHOCKWAVE' });
    sfx('stomp', { pitch: 0.6 });
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
  /* ---------------- particles ---------------- */
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
    if (P.state !== 'pit' && P.state !== 'dead') {
      c.look = snap ? P.face * K.camLook : U.approach(c.look, P.face * K.camLook, K.camLookSpeed * dt);
      var tx = cx(P) + c.look - W / 2;
      var B = S.boss;
      if (S.locked && B && !B.gone) { // keep the boss in frame without losing the player
        tx = tx * 0.6 + (cx(B) - W / 2) * 0.4;
        tx = U.clamp(tx, cx(P) - W + 56, cx(P) - 56);
      }
      var py = P.y + P.h / 2, ty = c.y;
      if (py - c.y < 64) ty = py - 64; else if (py - c.y > 118) ty = py - 118;
      if (snap) { c.x = tx; c.y = ty; }
      else { c.x += (tx - c.x) * Math.min(1, K.camLerp * dt); c.y += (ty - c.y) * Math.min(1, 7 * dt); }
    }
    var minX = 0, maxX = L.pxW - W;
    if (S.locked && S.arena) { minX = S.arena.x0; maxX = S.arena.x1 - W; if (maxX < minX) minX = maxX = (S.arena.x0 + S.arena.x1 - W) / 2; }
    if (maxX < minX) maxX = minX;
    if (snap) c.x = U.clamp(c.x, minX, maxX);
    else {
      if (c.x < minX) c.x = S.locked ? U.approach(c.x, minX, 380 * dt) : minX;
      if (c.x > maxX) c.x = S.locked ? U.approach(c.x, maxX, 380 * dt) : maxX;
    }
    var maxY = L.pxH - H;
    c.y = maxY < 0 ? maxY : U.clamp(c.y, 0, maxY);
  }

  /* ---------------- scene ---------------- */
  function firstStageId() {
    var st = D().stages || {}, k = Object.keys(st);
    return k.length ? k[0] : 'debug';
  }
  function enter(params) {
    params = params || {};
    I = DCW.input;
    artHas = {};
    var run = getRun();
    buildLevel(params.stageId || (run && run.currentStage) || firstStageId());
    S.player = makePlayer(S.start.x, S.start.y);
    S.lastSafe = { x: S.start.x, y: S.start.y };
    S.comp = makeCompanion(S.player);
    if (S.isBoss) S.boss = makeBoss();
    var mx = stats().maxHp;
    if (!(run.hp > 0)) run.hp = mx;
    if (run.hp > mx) run.hp = mx;
    if (has(ART(), 'prepare')) call(ART(), 'prepare', S.theme);
    updCamera(0, true);
    var trk = S.def.music || (S.floor && S.floor.music);
    if (trk) music(trk);
    announce(S.def.name || 'STAGE', { time: 1.6, sub: S.floor && S.floor.name ? 'FLOOR ' + (S.floor.n || run.floor) : '' });
  }
  function exit() {
    if (S) S.exited = true;
  }
  function update(dt) {
    if (!S || S.exited) return;
    var P = S.player;
    S.t += dt; S.frameParity = !S.frameParity;
    if (S.quipT > 0) S.quipT -= dt;
    if (S.flashT > 0) S.flashT -= dt;
    if (S.doubleViewsT > 0) S.doubleViewsT -= dt;
    call(G(), 'tick', dt);
    if (S.introPending && S.t > 0.5) { var line = S.introPending; S.introPending = null; say(line); }
    if (I.pressed('start') && !S.done && P.state !== 'dead' && P.state !== 'pit') {
      var f = S.floor;
      var canFlee = !!(f && f.overworld) && S.def.kind !== 'boss';
      if (has(UI(), 'openPause')) { call(UI(), 'openPause', { canFlee: canFlee }); return; }
    }
    if (S.done && S.endT >= 0) {
      if (S.pendingDefeat) { var dl = S.pendingDefeat; S.pendingDefeat = null; say(dl); }
      S.endT -= dt;
      if (S.endT <= 0 && S.endKind) { S.endT = -1; finishStage(); }
    }
    updPlatforms(dt);
    updPlayer(dt);
    updComp(dt);
    updAllies(dt);
    updEnemies(dt);
    updBoss(dt);
    updProjectiles(dt);
    updHaz(dt);
    updPickups(dt);
    updParts(dt);
    if (S.comboT > 0) { S.comboT -= dt; if (S.comboT <= 0) S.combo = 0; }
    if (!S.done) S.special = Math.min(1, S.special + K.specialPassive * dt);
    updCamera(dt, false);
  }
  function idle() { /* UI modal open: the world holds still */ }

  /* ---------------- drawing ---------------- */
  var SOLIDISH = [false, true, true, false, false, false, false, true];
  function drawTiles(ctx, camX, camY) {
    var L = S.L, art = ART(), useArt = has(art, 'tile');
    var tx0 = Math.max(0, Math.floor(camX / TS)), tx1 = Math.min(L.w - 1, Math.floor((camX + W) / TS));
    var ty0 = Math.max(0, Math.floor(camY / TS)), ty1 = Math.min(L.h - 1, Math.floor((camY + H) / TS));
    tileInfo.t = S.t;
    for (var ty = ty0; ty <= ty1; ty++) {
      for (var tx = tx0; tx <= tx1; tx++) {
        var t = L.t[ty * L.w + tx];
        if (!t) continue;
        var x = tx * TS - camX, y = ty * TS - camY;
        if (useArt) {
          var sol = SOLIDISH[t];
          var u = ty > 0 ? L.t[(ty - 1) * L.w + tx] : 0, d = ty < L.h - 1 ? L.t[(ty + 1) * L.w + tx] : (sol ? 1 : 0);
          var l = tx > 0 ? L.t[ty * L.w + tx - 1] : (sol ? 1 : 0), r = tx < L.w - 1 ? L.t[ty * L.w + tx + 1] : (sol ? 1 : 0);
          tileInfo.up = sol ? SOLIDISH[u] : u === t; tileInfo.down = sol ? SOLIDISH[d] : d === t;
          tileInfo.left = sol ? SOLIDISH[l] : l === t; tileInfo.right = sol ? SOLIDISH[r] : r === t;
          tileInfo.tx = tx; tileInfo.ty = ty;
          try { art.tile(ctx, S.theme, CH_OF[t], x, y, tileInfo); continue; } catch (e) { console.error('[stage] art.tile', e); art = null; useArt = false; }
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
  }
  function drawTileAt(ctx, ch, x, y, tx, ty) {
    var art = ART();
    if (has(art, 'tile')) {
      tileInfo.up = false; tileInfo.down = false; tileInfo.left = tx === undefined ? true : tx > 0; tileInfo.right = tx === undefined ? true : tx < 2; tileInfo.t = S.t;
      tileInfo.tx = tx || 0; tileInfo.ty = ty || 0;
      try { art.tile(ctx, S.theme, ch, x, y, tileInfo); return; } catch (e) { /* fall through */ }
    }
    drawFallbackTile(ctx, TILE_OF[ch] || 1, x, y);
  }
  function draw(ctx) {
    if (!S) return;
    var camX = Math.round(S.cam.x), camY = Math.round(S.cam.y), i, P = S.player;
    // background
    if (has(ART(), 'background')) { try { DCW.art.background(ctx, S.theme, camX, camY); } catch (e) { console.error('[stage] background', e); ctx.fillStyle = '#101828'; ctx.fillRect(0, 0, W, H); } }
    else { ctx.fillStyle = '#101828'; ctx.fillRect(0, 0, W, H); }
    drawTiles(ctx, camX, camY);
    // back objects
    for (i = 0; i < S.objects.length; i++) drawObject(ctx, S.objects[i], camX, camY);
    for (i = 0; i < S.platforms.length; i++) {
      var pl = S.platforms[i];
      if (pl.x + pl.w < camX || pl.x > camX + W) continue;
      for (var k = 0; k < 3; k++) drawTileAt(ctx, '=', Math.round(pl.x - camX) + k * 16, Math.round(pl.y - camY), k, i);
    }
    // hazard telegraphs + hazards
    for (i = 0; i < S.haz.length; i++) drawHaz(ctx, S.haz[i], camX, camY);
    // pickups
    for (i = 0; i < S.pickups.length; i++) drawPickup(ctx, S.pickups[i], camX, camY);
    // enemies
    for (i = 0; i < S.enemies.length; i++) { var e = S.enemies[i]; if (!e.dead && onScreen(e, 24)) drawEnemy(ctx, e, camX, camY); }
    if (S.boss && !S.boss.gone) drawBoss(ctx, S.boss, camX, camY);
    // companion, allies, player
    drawAllies(ctx, camX, camY);
    if (S.comp) drawComp(ctx, S.comp, camX, camY);
    drawPlayer(ctx, P, camX, camY);
    // projectiles
    for (i = 0; i < S.eproj.length; i++) {
      var p = S.eproj[i];
      spr(ctx, p.sprite, cx(p) - camX, p.y + p.h - camY, Math.floor(p.t * 10), p.vx < 0, null, p.w, p.h, '#f83800');
    }
    for (i = 0; i < S.pproj.length; i++) {
      var q = S.pproj[i];
      if (q.kind === 'bomb') {
        var blink = q.fuse < 0.4 && Math.floor(q.fuse * 20) % 2 === 0;
        spr(ctx, 'bomb', cx(q) - camX, q.y + q.h + 1 - camY, Math.floor(q.spin), q.vx < 0, { flash: blink }, 7, 7, '#303030');
      } else spr(ctx, 'missile', cx(q) - camX, q.y + q.h + 1 - camY, Math.floor(q.t * 12), q.vx < 0, null, 6, 6, '#f878f8');
    }
    // particles
    for (i = 0; i < S.parts.length; i++) drawPart(ctx, S.parts[i], camX, camY);
    // floating numbers
    for (i = 0; i < S.nums.length; i++) {
      var n = S.nums[i];
      if (n.t > n.life - 0.15 && Math.floor(n.t * 30) % 2) continue;
      DCW.text(n.text, Math.round(n.x - camX), Math.round(n.y - camY - 8 * n.scale), n.color, { align: 'center', scale: n.scale });
    }
    // interaction prompt
    if (P.state === 'normal' || P.state === 'climb') {
      var o = interactAt(P);
      if (o && Math.floor(S.t * 3) % 2 === 0) DCW.text('↑', Math.round(cx(o) - camX), Math.round(o.y - camY - 12), '#fcfcfc', { align: 'center' });
    }
    if (S.dark) drawDark(ctx, camX, camY);
    if (S.flashT > 0) { ctx.globalAlpha = Math.min(0.7, S.flashT * 4); ctx.fillStyle = S.flashColor; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; }
    drawHud(ctx);
    if (S.god) DCW.text('GOD', 4, H - 10, '#f8d878');
    if (S.fallbackMsg) { DCW.text(S.fallbackMsg, W / 2, 80, '#fcfcfc', { align: 'center', scale: 2 }); }
  }
  function drawObject(ctx, o, camX, camY) {
    if (o.x + o.w < camX - 8 || o.x > camX + W + 8) return;
    var x = cx(o) - camX, y = o.y + o.h - camY;
    switch (o.kind) {
      case 'door': spr(ctx, o.open ? 'door_open' : 'door', x, y, 0, false, null, 24, 36, o.open ? '#000' : '#7c4c2c'); break;
      case 'checkpoint': spr(ctx, 'checkpoint', x, y, o.on ? 1 : 0, false, null, 6, 24, o.on ? '#58f898' : '#f83800'); break;
      case 'sign': spr(ctx, 'sign', x, y, 0, false, null, 14, 14, '#c88848'); break;
      case 'chest': spr(ctx, o.open ? 'chest_open' : 'chest', x, y, 0, false, null, 16, 12, o.open ? '#7c4c2c' : '#f8b800'); break;
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
      case 'bomb': spr(ctx, 'bomb_pickup', x, y, Math.floor(S.t * 4 + p.bob), false, null, 7, 7, '#303030'); break;
      case 'potion': spr(ctx, 'potion', x, y, 0, false, null, 6, 8, '#f83800'); break;
      case 'box': spr(ctx, 'box_bronze', x, y, Math.floor(S.t * 4), false, null, 12, 12, '#c87838'); break;
    }
  }
  function drawHaz(ctx, h, camX, camY) {
    var x = Math.round(h.x - camX), y = Math.round(h.y - camY), telegraph = h.t < h.tele;
    var blink = Math.floor(S.t * 16) % 2 === 0;
    switch (h.kind) {
      case 'marker':
        if (telegraph && blink) { DCW.text('▼', x + h.w / 2, y, '#f83800', { align: 'center' }); ctx.fillStyle = 'rgba(248,56,0,0.35)'; ctx.fillRect(x + 4, y + 10, 4, H); }
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
    }
  }
  function drawEnemy(ctx, e, camX, camY) {
    var base = e.sprite, name, frame = Math.floor(e.t * 6);
    if (e.hurtT > 0 && hasArt(base + '_hurt')) name = base + '_hurt';
    else if (e.tele || e.state === 'dash' || e.state === 'swoop') name = hasArt(base + '_attack') ? base + '_attack' : base + '_walk';
    else name = base + '_walk';
    if (e.ai === 'turret' || e.ai === 'spawner') { if (!e.tele) frame = Math.floor(e.t * 2); }
    var x = cx(e) - camX, y = e.y + e.h - camY;
    var shake = (e.tele && (e.ai === 'charger' || e.ai === 'hopper')) ? (Math.floor(e.t * 30) % 2 ? 1 : -1) : 0;
    var flip = e.face < 0;
    if (e.elite) {
      var a = 0.55 + Math.sin(S.t * 8) * 0.25;
      spr(ctx, name, x - 1, y, frame, flip, { flash: true, alpha: a }, e.w, e.h, '#fff');
      spr(ctx, name, x + 1, y, frame, flip, { flash: true, alpha: a }, e.w, e.h, '#fff');
      spr(ctx, name, x, y - 1, frame, flip, { flash: true, alpha: a }, e.w, e.h, '#fff');
      spr(ctx, name, x, y + 1, frame, flip, { flash: true, alpha: a }, e.w, e.h, '#fff');
    }
    spr(ctx, name, x + shake, y, frame, flip, { flash: e.flash > 0 }, e.w, e.h, e.color);
    if (e.elite) DCW.text('★', Math.round(x), Math.round(e.y - camY - 10), '#f8d878', { align: 'center' });
    if (e.stun > 0 && Math.floor(S.t * 6) % 2) DCW.text('*', Math.round(x), Math.round(e.y - camY - 9), '#3cbcfc', { align: 'center' });
    if (e.hp < e.maxHp && e.maxHp > 3) {
      var bw = Math.max(10, e.w);
      ctx.fillStyle = '#000'; ctx.fillRect(Math.round(x - bw / 2), Math.round(e.y - camY - 4), bw, 2);
      ctx.fillStyle = e.elite ? '#f8d878' : '#f83800'; ctx.fillRect(Math.round(x - bw / 2), Math.round(e.y - camY - 4), Math.round(bw * e.hp / e.maxHp), 2);
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
    spr(ctx, name, x, y, frame, B.face < 0, { flash: B.flash > 0, alpha: B.alpha }, B.w, B.h, '#a81000');
    if (B.stun > 0 && Math.floor(S.t * 6) % 2) DCW.text('* * *', Math.round(x), Math.round(B.y - camY - 10), '#3cbcfc', { align: 'center' });
  }
  function drawComp(ctx, C, camX, camY) {
    var name = C.sprite + (C.actT > 0 ? '_act' : (Math.abs(C.vx) > 12 || !C.onGround) ? '_run' : '_idle');
    if (!hasArt(name)) name = C.sprite + '_idle';
    var frame = Math.floor(C.t * (name.indexOf('_run') > 0 ? 8 : 2));
    spr(ctx, name, cx(C) - camX, C.y + C.h - camY, frame, C.face < 0, null, C.w, C.h, C.color);
  }
  function drawAllies(ctx, camX, camY) {
    if (!S.allies.length) return;
    var name = hasArt('squeaks_run') ? 'squeaks_run' : 'rat_walk';
    for (var i = 0; i < S.allies.length; i++) {
      var a = S.allies[i];
      spr(ctx, name, cx(a) - camX, a.y + a.h - camY, Math.floor(a.t * 10), false, null, a.w, a.h, '#bcbcbc');
    }
  }
  function playerSprite(P) {
    if (P.state === 'dead') return ['carl_dead', 0];
    if (P.state === 'victory') return ['carl_victory', 0];
    if (P.state === 'climb') return ['carl_climb', Math.floor(P.animT * 8)];
    if (P.state === 'hurt') return ['carl_hurt', 0];
    if (P.state === 'punch') return ['carl_punch', P.pIdx % 2];
    if (P.state === 'kick') return ['carl_kick', P.st > 0.09 ? 1 : 0];
    if (P.state === 'airkick') return ['carl_airkick', 0];
    if (P.throwT > 0) return ['carl_throw', 0];
    if (!P.onGround) return [P.vy < 0 ? 'carl_jump' : 'carl_fall', 0];
    if (P.crouch) return [hasArt('carl_crouch') ? 'carl_crouch' : 'carl_idle', 0];
    if (Math.abs(P.vx) > 8) return ['carl_run', Math.floor(P.animT * 11)];
    return ['carl_idle', Math.floor(P.animT * 2)];
  }
  var skinOpt = { skin: 'carl_boxers', flash: false, alpha: 1 };
  function drawPlayer(ctx, P, camX, camY) {
    if (P.state === 'pit') return;
    var blink = (P.inv > 0 && P.state !== 'victory' && P.state !== 'dead') && Math.floor(S.t * 20) % 2 === 0;
    var sp = playerSprite(P);
    skinOpt.skin = (DCW.save && DCW.save.equipped && DCW.save.equipped.skin) || 'carl_boxers';
    skinOpt.flash = P.invuln > 0 && Math.floor(S.t * 12) % 3 === 0;
    skinOpt.alpha = blink ? 0.25 : 1;
    var x = cx(P) - camX, y = P.y + P.h - camY;
    spr(ctx, sp[0], x, y, sp[1], P.face < 0, skinOpt, 12, P.h, '#fcd8a8');
    if (P.shield > 0 || P.invuln > 0) {
      ctx.strokeStyle = P.invuln > 0 ? '#f8d878' : '#9878f8';
      ctx.globalAlpha = 0.6 + Math.sin(S.t * 10) * 0.2;
      ctx.beginPath(); ctx.arc(Math.round(x), Math.round(y - 11), 15, 0, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha = 1;
    }
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
    if (!lightCanvas) { lightCanvas = document.createElement('canvas'); lightCanvas.width = W; lightCanvas.height = H; }
    var g = lightCanvas.getContext('2d'), P = S.player;
    g.globalCompositeOperation = 'source-over';
    g.clearRect(0, 0, W, H);
    g.fillStyle = 'rgba(0,0,0,0.94)'; g.fillRect(0, 0, W, H);
    g.globalCompositeOperation = 'destination-out';
    var lights = [[cx(P) - camX, cy(P) - camY, 78 + Math.sin(S.t * 3) * 2]];
    if (S.comp) lights.push([cx(S.comp) - camX, cy(S.comp) - camY, 30]);
    for (var i = 0; i < S.pproj.length; i++) lights.push([cx(S.pproj[i]) - camX, cy(S.pproj[i]) - camY, 22]);
    for (var j = 0; j < S.parts.length; j++) if (S.parts[j].name === 'explosion') lights.push([S.parts[j].x - camX, S.parts[j].y - camY, 60]);
    if (S.boss && S.locked) lights.push([cx(S.boss) - camX, cy(S.boss) - camY, 50]);
    for (var k = 0; k < lights.length; k++) {
      var l = lights[k], gr = g.createRadialGradient(l[0], l[1], l[2] * 0.35, l[0], l[1], l[2]);
      gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr; g.fillRect(l[0] - l[2], l[1] - l[2], l[2] * 2, l[2] * 2);
    }
    g.globalCompositeOperation = 'source-over';
    ctx.drawImage(lightCanvas, 0, 0);
  }
  var hud = { hp: 0, maxHp: 0, special: 0, bombs: 0, potions: 0, gold: 0, level: 1, xpFrac: 0, views: 0, combo: 0, companion: null, bossHp: null, bossName: null, time: null, par: null, stageName: '' };
  function drawHud(ctx) {
    var run = getRun(), st = stats(), B = S.boss;
    hud.hp = Math.max(0, run.hp); hud.maxHp = st.maxHp; hud.special = S.special; hud.bombs = run.bombs || 0; hud.potions = run.potions || 0;
    hud.gold = run.gold || 0; hud.level = run.level || 1; hud.xpFrac = U.clamp((run.xp || 0) / xpNeed(run.level || 1), 0, 1);
    hud.views = run.views || 0; hud.combo = S.combo; hud.companion = S.comp ? S.comp.id : null;
    hud.bossHp = (B && S.locked && !B.gone) ? Math.max(0, B.hp / B.maxHp) : null;
    hud.bossName = hud.bossHp !== null ? (B.def.name || 'BOSS') : null;
    hud.time = num(run.floorTime, S.t); hud.par = (S.floor && S.floor.par) || null; hud.stageName = S.def.name || '';
    if (has(UI(), 'drawHUD')) { call(UI(), 'drawHUD', ctx, hud); return; }
    // minimal fallback HUD
    DCW.text('♥' + hud.hp + '/' + hud.maxHp + '  B' + hud.bombs + '  P' + hud.potions + '  $' + hud.gold, 4, 4, '#fcfcfc');
    DCW.bar(4, 14, 40, 3, hud.special, '#f8d878');
    if (hud.combo > 1) DCW.text(hud.combo + ' HITS', W - 4, 4, '#f8d878', { align: 'right' });
    if (hud.bossHp !== null) { DCW.bar(60, H - 10, 200, 4, hud.bossHp, '#f83800'); DCW.text(hud.bossName, 160, H - 20, '#fcfcfc', { align: 'center' }); }
  }

  /* ---------------- debug / test hooks ---------------- */
  function debugClear() {
    if (!S || S.done) return;
    if (S.boss && !S.boss.dead) { S.boss.dead = true; S.boss.gone = true; unlockArena(); }
    startVictory('door'); S.endT = 0.3;
  }
  function debugGod() { if (!S) return; S.god = !S.god; getRun().god = S.god; toast(S.god ? 'GOD MODE ON' : 'GOD MODE OFF', {}); }
  function debugWarpBoss() {
    if (!S || !S.arena) return;
    var P = S.player;
    P.x = S.arena.x0 + 4 * TS; P.y = groundBelow(P.x + 4, 0) - P.h - 1; P.vx = 0; P.vy = 0; P.state = 'normal';
    updCamera(0, true);
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
        else if (e.code === 'Digit8') debugWarpBoss();
      });
    },
    get state() { return S; },
    K: K,
    debugClear: debugClear, debugGod: debugGod, debugWarpBoss: debugWarpBoss,
    // test helpers (harmless in production)
    spawn: function (id, x, feetY, opts) { return S ? spawnEnemy(id, x, feetY, opts) : null; }
  };
})();

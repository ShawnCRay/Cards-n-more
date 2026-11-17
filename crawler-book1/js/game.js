/* ============================================================
   DCC BOOK ONE - GAME FLOW. The crawl: two linear floors whose
   sequences mix stages, safe rooms and cutscenes; rewards, loot
   boxes, gear, story flags, achievements, progression.
   Contract: ../DESIGN.md ("Run flow", "Game API additions" and
   the inherited "Game flow API").
   ============================================================ */
(function () {
  'use strict';
  var DCW = window.DCW = window.DCW || {};
  var U = DCW.U;
  var G = DCW.game = {};

  Object.defineProperty(G, 'run', { get: function () { return DCW.save ? DCW.save.run : null; } });

  /* ---------------- small helpers ---------------- */
  function D() { return DCW.data || {}; }
  function S() { return (DCW.ui && DCW.ui.scenes) || {}; }
  function sfx(n, o) { try { if (DCW.audio && DCW.audio.sfx) DCW.audio.sfx(n, o); } catch (e) { /* audio optional */ } }
  function toast(t, o) { if (DCW.ui && DCW.ui.toast) DCW.ui.toast(t, o || {}); }
  function say(lines, opts) {
    opts = opts || {};
    if (DCW.ui && DCW.ui.say && lines && (!Array.isArray(lines) || lines.length)) DCW.ui.say(lines, opts);
    else if (opts.onDone) opts.onDone();
  }
  function pickLine(pool) { var p = (D().ai || {})[pool]; return p && p.length ? U.pick(p) : null; }
  function persist() { DCW.persist(); }
  function go(scene, params) {
    if (!scene) scene = fallbackScene('MISSING SCENE');
    DCW.fade(function () { DCW.setScene(scene, params || {}); });
  }
  function fallbackScene(msg, next) {
    return {
      enter: function () { this.t = 0; },
      update: function (dt) { this.t += dt; if (this.t > 0.3 && DCW.input.pressed('confirm') && next) next(); },
      draw: function () { DCW.text(msg, 160, 80, '#fcfcfc', { align: 'center', wrap: 300 }); if (next) DCW.text('PRESS A', 160, 110, '#f8b800', { align: 'center' }); }
    };
  }
  function floors() { return D().floors || []; }
  function stages() { return D().stages || {}; }
  G.floorDef = function (n) {
    var r = G.run; n = n || (r ? r.floor : 1);
    return floors().filter(function (f) { return f.n === n; })[0] || floors()[n - 1] || null;
  };
  G.stageDef = function (id) { return stages()[id] || null; };
  function floorScale() { var r = G.run; return 1 + ((r ? r.floor : 1) - 1) * 0.5; }

  // a sequence step: 'f1_hall' | 'SAFE' | 'SAFE:tally' | 'CUT:f1_mordecai'
  function parseStep(step) {
    if (step === undefined || step === null) return null;
    step = String(step);
    if (step === 'SAFE') return { kind: 'safe', id: null };
    if (step.indexOf('SAFE:') === 0) return { kind: 'safe', id: step.slice(5) };
    if (step.indexOf('CUT:') === 0) return { kind: 'cut', id: step.slice(4) };
    return { kind: 'stage', id: step };
  }
  G.parseStep = parseStep;
  function currentStep() { var r = G.run, f = G.floorDef(); return r && f ? parseStep((f.sequence || [])[r.seqIndex]) : null; }

  /* ---------------- run creation ---------------- */
  function makeRun() {
    return {
      floor: 1, cleared: {}, bossDown: false, seqIndex: 0, owPos: null, roamersDown: [],
      hp: 12, level: 1, xp: 0, statPoints: 0,
      stats: { str: 3, con: 3, dex: 3, int: 3 },
      bonus: { hp: 2 },
      gold: 0, bombs: 3, potions: 1, biscuits: 0, views: 0, fanTier: 0,
      boxes: [], revivals: 3, floorTime: 0, totalTime: 0, kills: 0, deaths: 0,
      currentStage: null, inSafe: false, room: null, seenRooms: {}, cookieHere: false, restedHere: false,
      pendingAmbush: null, won: false,
      companions: ['donut'], items: {}, gear: {}, flags: {},
      seed: (Math.random() * 1e9) >>> 0
    };
  }

  G.init = function () {
    var p = DCW.params;
    if (DCW.debug && (p.has('floor') || p.has('stage') || p.has('scene') || p.has('cut'))) { G.debugStart(); return; }
    G.toTitle(true);
  };

  G.toTitle = function (instant) {
    var sc = S().title || fallbackScene('DUNGEON CRAWLER CARL', function () { G.newRun(); });
    if (instant) DCW.setScene(sc, {}); else go(sc, {});
  };

  // New crawl: the Transformation on the surface, the name gag at the dungeon doors, then Floor 1.
  G.newRun = function () {
    var s = DCW.save;
    s.run = makeRun();
    s.equipped.companion = 'donut';
    s.equipped.skin = 'carl_boxers';
    s.meta.runs = (s.meta.runs || 0) + 1;
    persist();
    var floor1 = function () { G.startFloor(1); };
    var naming = function () { if (S().nameEntry) go(S().nameEntry, { onDone: floor1 }); else floor1(); };
    if (DCW.params.has('skipintro')) { floor1(); return; }
    G.cutscene('prologue', function () { s.meta.seenIntro = true; persist(); naming(); });
  };

  G.migrateRun = function () {
    var r = G.run; if (!r) return;
    var fresh = makeRun();
    Object.keys(fresh).forEach(function (k) { if (r[k] === undefined) r[k] = fresh[k]; });
    if (r.companions.indexOf(DCW.save.equipped.companion) < 0) DCW.save.equipped.companion = 'donut';
  };
  G.continueRun = function () {
    var r = G.run;
    if (!r) { G.newRun(); return; }
    G.migrateRun();
    if (r.won) { go(S().ending || fallbackScene('THE END OF BOOK ONE'), {}); return; }
    if (r.hp <= 0) { go(S().death || fallbackScene('YOU HAVE DIED', function () { G.revive() || G.endRun(); }), { result: r.lastDeath || {} }); return; }
    if (r.inSafe) { G.enterSafeRoom(r.room); return; }
    G.resumeFloor();
  };

  G.startFloor = function (n) {
    var r = G.run; if (!r) return;
    var f = G.floorDef(n);
    if (!f) { G.win(); return; }
    r.floor = n; r.cleared = {}; r.bossDown = false; r.seqIndex = 0; r.owPos = null;
    r.roamersDown = []; r.floorTime = 0; r.currentStage = null; r.inSafe = false; r.pendingAmbush = null;
    var m = DCW.save.meta; m.bestFloor = Math.max(m.bestFloor || 0, n);
    persist();
    G.track('floor:' + n);
    var card = S().floorCard;
    if (card) go(card, { floor: n, onDone: function () { G.resumeFloor(); } }); else G.resumeFloor();
  };

  // Where the player belongs right now: the current step of the floor sequence.
  G.resumeFloor = function () {
    var r = G.run, f = G.floorDef();
    if (!r || !f) { G.toTitle(); return; }
    var step = currentStep();
    if (!step) { G.floorEnd(); return; }
    if (step.kind === 'safe') { G.enterSafeRoom(step.id); return; }
    if (step.kind === 'cut') {
      r.currentStage = null; r.inSafe = false; persist();
      G.cutscene(step.id, function () { G.advance(); });
      return;
    }
    G.enterStage(step.id);
  };
  // move to the next step of the sequence
  G.advance = function () {
    var r = G.run; if (!r) return;
    r.seqIndex++;
    r.currentStage = null;
    persist();
    G.resumeFloor();
  };

  // End of a floor's sequence: down the stairs to the next floor, or the end of the book.
  G.floorEnd = function () {
    var r = G.run, f = G.floorDef(); if (!r) return;
    r.bossDown = true;
    sfx('stairs');
    if (f && f.par && r.floorTime <= f.par) G.giveLootBox('gold', 'UNDER PAR ON FLOOR ' + r.floor);
    G.track('floor_clear');
    r.totalTime += r.floorTime; r.floorTime = 0;
    var next = r.floor + 1;
    persist();
    if (!G.floorDef(next)) { G.win(); return; }
    G.startFloor(next);
  };
  G.takeStairs = function () { G.floorEnd(); };
  G.floorCleared = function () { G.resumeFloor(); };

  /* ---------------- cutscenes ---------------- */
  // Plays D.cutscenes[id] through the UI cutscene scene, then applies its give list and fires
  // 'story:<id>'. Missing cutscene or scene: the rewards still land and the flow continues.
  G.cutsceneDef = function (id) { return (D().cutscenes || {})[id] || null; };
  G.cutscene = function (id, onDone) {
    var def = G.cutsceneDef(id), sc = S().cutscene;
    var fired = false;
    var finish = function () {
      if (fired) return; fired = true;
      if (def && def.give) G.give(def.give, def.title || 'STORY');
      G.track('story:' + id);
      persist();
      if (onDone) onDone();
    };
    if (!def || !sc) { finish(); return; }
    go(sc, { id: id, onDone: finish });
  };

  /* ---------------- stages ---------------- */
  G.enterStage = function (stageId) {
    var r = G.run; if (!r) return;
    if (!G.stageDef(stageId)) {
      toast('STAGE MISSING: ' + stageId, { color: '#f83800' });
      // never strand the run on a missing stage: skip it
      var st = currentStep(); if (st && st.kind === 'stage' && st.id === stageId) setTimeout(function () { G.advance(); }, 600);
      return;
    }
    r.currentStage = stageId; r.inSafe = false; r.stageStartHp = r.hp;
    persist();
    var sc = DCW.stage && DCW.stage.scene;
    go(sc || fallbackScene('STAGE MODULE MISSING'), { stageId: stageId });
  };

  G.stageCleared = function (result) {
    var r = G.run; if (!r) return;
    result = result || {};
    var id = result.stageId || r.currentStage;
    var st = G.stageDef(id) || { reward: {} };
    var rewards = [];
    var first = !r.cleared[id];
    var rw = st.reward || {};
    r.cleared[id] = true;
    sfx('fanfare');
    var xp = rw.xp ? (first ? rw.xp : Math.round(rw.xp / 3)) : 0;
    if (xp) { G.addXP(xp); rewards.push({ kind: 'xp', amount: xp }); }
    if (rw.gold) {
      var g = Array.isArray(rw.gold) ? U.randi(rw.gold[0], rw.gold[1]) : rw.gold;
      if (!first) g = Math.round(g / 3);
      g = G.addGold(g); rewards.push({ kind: 'gold', amount: g });
    }
    if (first && rw.box) { G.giveLootBox(rw.box, st.name || 'STAGE CLEAR', true); rewards.push({ kind: 'box', tier: rw.box }); }
    if (first && rw.gear && G.giveGear(rw.gear, st.name, true)) rewards.push({ kind: 'gear', id: rw.gear, isNew: true });
    if (!result.damageTaken && st.kind !== 'ride') {
      G.track('no_damage_stage');
      var bonusViews = G.addViews(250 * r.floor);
      if (bonusViews) rewards.push({ kind: 'views', amount: bonusViews, note: 'FLAWLESS' });
    }
    if (result.maxCombo >= 25 && first) { G.giveLootBox('silver', 'COMBO ' + result.maxCombo, true); rewards.push({ kind: 'box', tier: 'silver' }); }
    var bossId = result.boss || st.boss;
    var isBoss = st.kind === 'boss' || !!result.boss;
    if (isBoss && bossId) {
      var b = (D().bosses || {})[bossId] || {};
      if (first) {
        G.giveLootBox(b.loot || 'boss', b.name || 'BOSS', true); rewards.push({ kind: 'box', tier: b.loot || 'boss' });
        if (b.loot && b.loot !== 'boss') { G.giveLootBox('boss', b.name || 'BOSS', true); rewards.push({ kind: 'box', tier: 'boss' }); }
        if (b.gear && G.giveGear(b.gear, b.name, true)) rewards.push({ kind: 'gear', id: b.gear, isNew: true });
        var un = b.unlock || {};
        if (un.skin) rewards.push({ kind: 'skin', id: un.skin, isNew: G.unlockSkin(un.skin, true) });
      }
      G.track('boss:' + bossId);
    }
    var step = currentStep();
    var advance = !!(step && step.kind === 'stage' && step.id === id);
    r.currentStage = null;
    var maxHp = G.playerStats().maxHp;
    r.hp = U.clamp(r.hp, 1, maxHp);
    if (advance) r.seqIndex++;
    persist();
    var res = S().results;
    if (res) go(res, { result: result, rewards: rewards, onDone: function () { G.resumeFloor(); } });
    else G.resumeFloor();
  };

  G.playerDied = function (result) {
    var r = G.run; if (!r) return;
    r.deaths++; DCW.save.meta.deaths = (DCW.save.meta.deaths || 0) + 1;
    r.lastDeath = result || {};
    G.track('death');
    persist();
    go(S().death || fallbackScene('YOU HAVE DIED', function () { G.revive() || G.endRun(); }), { result: result || {} });
  };

  G.canRevive = function () { var r = G.run; return !!(r && r.revivals > 0); };
  G.revive = function () {
    var r = G.run; if (!r || r.revivals <= 0) return false;
    r.revivals--;
    var lost = Math.floor(r.gold * 0.25); r.gold -= lost;
    r.hp = G.playerStats().maxHp;
    G.track('revive');
    var line = pickLine('revive');
    persist();
    var stageId = r.currentStage;
    if (stageId) G.enterStage(stageId); else G.resumeFloor();
    if (line) setTimeout(function () { toast(line, { icon: 'heart', color: '#f878f8', time: 4 }); }, 700);
    return true;
  };
  G.endRun = function () {
    var s = DCW.save;
    s.run = null; persist();
    G.toTitle();
  };

  // Linear floors have no map to flee to: "flee" restarts the stage from the top.
  G.fleeStage = function () {
    var r = G.run; if (!r) return;
    G.track('flee');
    var line = pickLine('flee');
    var stageId = r.currentStage;
    persist();
    if (stageId) G.enterStage(stageId); else G.resumeFloor();
    if (line) setTimeout(function () { toast(line, { icon: 'skull', time: 4 }); }, 700);
  };

  // overworld leftovers (Book One has no overworld)
  G.entranceState = function () { return null; };
  G.enterEntrance = function () { return false; };

  /* ---------------- safe rooms ---------------- */
  G.safeRoomDef = function (id) {
    var r = G.run;
    id = id || (r && r.room) || 'tally';
    var def = (D().safeRooms || {})[id];
    var out = {};
    if (def) Object.keys(def).forEach(function (k) { out[k] = def[k]; });
    out.id = id;
    if (!out.name) out.name = 'SAFE ROOM';
    if (!out.theme) out.theme = 'safe';
    if (!out.services) out.services = ['mordecai', 'boxes', 'rest'];
    return out;
  };
  G.enterSafeRoom = function (roomId) {
    var r = G.run; if (!r) return;
    if (!roomId) { var st = currentStep(); roomId = (st && st.kind === 'safe' && st.id) || r.room || 'tally'; }
    var fresh = r.room !== roomId || !r.inSafe;
    r.room = roomId; r.inSafe = true; r.currentStage = null;
    if (fresh) { r.restedHere = false; r.cookieHere = false; }
    r.seenRooms = r.seenRooms || {};
    var firstVisit = !r.seenRooms[roomId];
    if (firstVisit) {
      r.seenRooms[roomId] = true;
      var def = G.safeRoomDef(roomId);
      if (def.give) G.give(def.give, def.name);
      G.track('safe:' + roomId);
      G.track('safe_room');
    }
    persist();
    go(S().safeRoom || fallbackScene('SAFE ROOM', function () { G.heal(999); G.leaveSafeRoom(); }), { room: roomId, firstVisit: firstVisit });
  };
  G.leaveSafeRoom = function () {
    var r = G.run; if (!r) return;
    r.inSafe = false;
    var st = currentStep();
    if (st && st.kind === 'safe') r.seqIndex++;
    persist();
    G.resumeFloor();
  };
  // Experience cookies: once per visit, in rooms that have them.
  G.eatCookie = function () {
    var r = G.run; if (!r || r.cookieHere) return 0;
    r.cookieHere = true;
    var def = G.safeRoomDef(r.room);
    var xp = def.cookieXp || Math.round(25 * floorScale());
    G.addXP(xp);
    G.track('cookie');
    sfx('pickup');
    persist();
    return xp;
  };

  G.win = function () {
    var r = G.run, m = DCW.save.meta;
    if (r) r.won = true;
    m.wins = (m.wins || 0) + 1;
    G.track('win');
    persist();
    go(S().ending || fallbackScene('THE END OF BOOK ONE', function () { G.quitToTitle(); }), {});
  };

  G.quitToTitle = function () {
    var r = G.run;
    if (r && r.won) DCW.save.run = null;
    persist();
    G.toTitle();
  };

  G.tick = function (dt) { var r = G.run; if (r) r.floorTime += dt; };

  /* ---------------- story flags ---------------- */
  var FLAG_NOTES = {
    missile: 'DONUT CAN CAST MAGIC MISSILE',
    chopper: 'GOBLIN COPPER CHOPPER ACQUIRED',
    jugs: "BOMBS ARE NOW CARL'S JUG O'BOOMS"
  };
  G.flag = function (id) { var r = G.run; return !!(r && r.flags && r.flags[id]); };
  G.setFlag = function (id, quiet) {
    var r = G.run; if (!r) return false;
    r.flags = r.flags || {};
    if (r.flags[id]) return false;
    r.flags[id] = true;
    if (!quiet && FLAG_NOTES[id]) toast(FLAG_NOTES[id], { title: 'NEW ABILITY', icon: 'star', color: '#58d854', time: 3.5 });
    persist();
    return true;
  };

  /* ---------------- gear (book loot, permanent for the crawl) ---------------- */
  G.gearDef = function (id) { return (D().gear || {})[id] || null; };
  G.hasGear = function (id) { var r = G.run; return !!(r && r.gear && r.gear[id]); };
  G.gearList = function () {
    var r = G.run; if (!r || !r.gear) return [];
    var table = D().gear || {}, order = Object.keys(table);
    var ids = Object.keys(r.gear).filter(function (id) { return r.gear[id]; });
    ids.sort(function (a, b) {
      var wa = (table[a] && table[a].who === 'donut') ? 1 : 0, wb = (table[b] && table[b].who === 'donut') ? 1 : 0;
      if (wa !== wb) return wa - wb;
      var ia = order.indexOf(a), ib = order.indexOf(b);
      return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib);
    });
    return ids.map(function (id) { return { id: id, def: table[id] || { name: String(id).toUpperCase() } }; });
  };
  G.giveGear = function (id, from, quiet) {
    var r = G.run; if (!r || !id) return false;
    r.gear = r.gear || {};
    if (r.gear[id]) return false;
    r.gear[id] = true;
    var def = G.gearDef(id) || { name: String(id).toUpperCase() };
    var maxBefore = G.playerStats().maxHp;
    if (def.skin && (D().skins || {})[def.skin]) {
      G.unlockSkin(def.skin, true);
      DCW.save.equipped.skin = def.skin;    // put the new clothes on right away
    }
    var gain = G.playerStats().maxHp - maxBefore;
    if (gain > 0) r.hp += gain;
    if (!quiet) { sfx('unlock'); toast(def.name, { title: 'NEW GEAR', icon: def.icon || 'shield', color: '#f8b800', time: 3.5 }); }
    G.track('gear');
    persist();
    return true;
  };
  function gearPerks() {
    var r = G.run, out = {};
    if (!r || !r.gear) return out;
    Object.keys(r.gear).forEach(function (id) {
      if (!r.gear[id]) return;
      var p = (G.gearDef(id) || {}).perk || {};
      Object.keys(p).forEach(function (k) {
        if (typeof p[k] === 'number') out[k] = (out[k] || 0) + p[k];
        else if (p[k]) out[k] = p[k];
      });
    });
    return out;
  }
  G.gearPerks = gearPerks;

  /* ---------------- consumables ---------------- */
  G.biscuits = function () { var r = G.run; return r ? (r.biscuits || 0) : 0; };
  G.useBiscuit = function () {
    var r = G.run; if (!r || !(r.biscuits > 0)) { sfx('error'); return false; }
    r.biscuits--; persist();
    return true;
  };

  /* ---------------- reward lists (cutscenes, safe rooms) ---------------- */
  G.give = function (list, from) {
    if (!list) return;
    (Array.isArray(list) ? list : [list]).forEach(function (rw) {
      if (!rw) return;
      var r = G.run;
      switch (rw.kind) {
        case 'achieve': G.achieve(rw.id); break;
        case 'box': G.giveLootBox(rw.tier || 'bronze', rw.from || from || 'STORY'); break;
        case 'gear': G.giveGear(rw.id, rw.from || from); break;
        case 'flag': G.setFlag(rw.id, !!rw.quiet); break;
        case 'item': {
          var n = rw.count || 1;
          G.giveItem(rw.id, n);
          var nm = rw.id === 'biscuit' ? 'PET BISCUIT' : rw.id === 'potion' ? 'HEALTH POTION' : rw.id === 'bomb' ? (G.flag('jugs') ? "JUG O'BOOM" : 'GOBLIN DYNAMITE') : G.itemName(rw.id);
          toast(nm + (n > 1 ? ' X' + n : ''), { title: 'ITEM GET', icon: rw.id === 'bomb' ? (G.flag('jugs') ? 'jug' : 'bomb') : rw.id, color: '#58d854' });
          sfx('pickup');
          break;
        }
        case 'xp': G.addXP(rw.amount || 10); break;
        case 'gold': if (r) { var g = G.addGold(rw.amount || 10); toast(g + ' GOLD', { icon: 'coin', color: '#f8b800' }); } break;
        case 'hp': if (r) { r.bonus.hp += rw.amount || 1; r.hp += rw.amount || 1; } break;
        case 'skin': G.unlockSkin(rw.id); break;
        case 'companion':
          if (r) { r.companions = r.companions || ['donut']; if (r.companions.indexOf(rw.id) < 0) r.companions.push(rw.id); G.unlockCompanion(rw.id, true); }
          break;
        case 'stat': if (r) { var stat = rw.stat || 'str', a = rw.amount || 1; r.stats[stat] += a; if (stat === 'con') r.hp += 2 * a; } break;
        case 'heal': G.heal(999); break;
        default: break;
      }
    });
    persist();
  };

  /* ---------------- stats ---------------- */
  function skinPerk() {
    var sk = (D().skins || {})[DCW.save.equipped.skin];
    return (sk && sk.perk) || {};
  }
  function mul(v) { if (!v) return 1; return v < 1 ? 1 + v : v; } // 0.25 or 1.25 both mean +25%
  G.xpNeed = function (level) { return Math.round(18 * Math.pow(level, 1.5)); };
  G.playerStats = function () {
    var r = G.run || makeRun();
    var st = r.stats, lv = r.level, p = skinPerk(), g = gearPerks();
    var dmg = 2 + (st.str - 3) + Math.floor((lv - 1) / 2) + (p.dmg || 0) + (g.dmg || 0);
    var jugs = !!(r.flags && r.flags.jugs);
    return {
      maxHp: 10 + (st.con - 3) * 2 + (lv - 1) + ((r.bonus && r.bonus.hp) || 0) + (p.hp || 0) + (g.hp || 0),
      dmg: dmg,
      kickDmg: Math.round(dmg * 1.5) + (g.kick || 0),
      crit: Math.min(0.6, 0.04 + (st.dex - 3) * 0.02 + (p.crit || 0) + (g.crit || 0)),
      speedMul: (1 + (st.dex - 3) * 0.03) * mul(p.speed) * (1 + (g.speed || 0)),
      bombDmg: 8 + lv * 2 + (st.str - 3) + (jugs ? 4 : 0),
      bombRadius: jugs ? 36 : 28,
      compPower: 1 + (st.int - 3) * 0.15 + (lv - 1) * 0.04,
      def: (p.def || 0) + (g.def || 0),
      goldMul: mul(p.gold),
      viewMul: mul(p.views),
      extraJump: !!p.doubleJump,
      skinPerk: p,
      // Book One gear perks
      stompMul: 1 + (g.stomp || 0) + (G.hasAchievement('smush') ? 0.5 : 0),
      regen: g.regen || 0,
      stun: Math.min(0.5, g.stun || 0),
      missileDmg: g.missile || 0,
      missileCd: g.missileCd || 0,
      specialMul: 1 + (g.special || 0),
      maxBombs: 9 + (g.bombs || 0),
      jugs: jugs
    };
  };
  G.hasAchievement = function (id) { var m = DCW.save && DCW.save.meta; return !!(m && m.achievements && m.achievements[id]); };

  G.addXP = function (n) {
    var r = G.run; if (!r || !n) return;
    r.xp += Math.round(n);
    var leveled = false;
    while (r.xp >= G.xpNeed(r.level)) {
      r.xp -= G.xpNeed(r.level);
      r.level++;
      r.statPoints += (r.level % 5 === 0) ? 2 : 1;
      var mx = G.playerStats().maxHp;
      r.hp = Math.min(mx, r.hp + 1 + Math.ceil(mx * 0.3));
      leveled = true;
      G.track('level:' + r.level);
    }
    if (leveled) {
      sfx('level_up');
      toast('LEVEL ' + r.level + '! SPEND POINTS IN A SAFE ROOM', { title: 'LEVEL UP', icon: 'star', color: '#f8b800' });
      var q = pickLine('levelUp');
      if (q) toast(q, { icon: 'eye', time: 3.5 });
    }
  };
  G.addGold = function (n) {
    var r = G.run; if (!r || !n) return 0;
    var g = Math.max(1, Math.round(n * G.playerStats().goldMul));
    r.gold += g;
    return g;
  };
  // The First Floor is closed to live viewers (edited recaps only): views switch on with Floor 2.
  G.viewersOn = function () { var f = G.floorDef(); return !(f && f.viewers === false); };
  var FAN_TIERS = [1000, 5000, 15000, 40000, 100000, 250000, 500000, 1000000, 2500000, 5000000];
  G.addViews = function (n) {
    var r = G.run; if (!r || !n || !G.viewersOn()) return 0;
    var v = Math.max(1, Math.round(n * G.playerStats().viewMul));
    r.views += v;
    while (r.fanTier < FAN_TIERS.length && r.views >= FAN_TIERS[r.fanTier]) {
      var th = FAN_TIERS[r.fanTier]; r.fanTier++;
      G.giveLootBox('fan', U.fmtNum(th) + ' VIEWERS', true);
      toast(U.fmtNum(th) + ' VIEWERS! FAN BOX', { title: 'FAN MILESTONE', icon: 'eye', color: '#f878f8' });
      sfx('views');
    }
    return v;
  };
  G.heal = function (n) {
    var r = G.run; if (!r) return;
    r.hp = Math.min(G.playerStats().maxHp, r.hp + n);
  };
  G.damageTaken = function (n) { var r = G.run; if (r) r.hp = Math.max(0, r.hp - n); };

  G.usePotion = function () {
    var r = G.run; if (!r) return false;
    var mx = G.playerStats().maxHp;
    if (r.potions <= 0 || r.hp >= mx) { sfx('error'); return false; }
    r.potions--;
    G.heal(Math.ceil(mx * 0.5));
    sfx('heal');
    G.track('potion');
    return true;
  };

  // Loot boxes and stat points are safe-room business only.
  G.inSafeRoom = function () {
    var r = G.run;
    return !!(r && r.inSafe && DCW.ui && DCW.ui.scenes && DCW.scene === DCW.ui.scenes.safeRoom);
  };
  G.spendStat = function (stat) {
    var r = G.run;
    if (!G.inSafeRoom()) { sfx('error'); return false; }
    if (!r || r.statPoints <= 0 || !(stat in r.stats)) { sfx('error'); return false; }
    r.stats[stat]++; r.statPoints--;
    if (stat === 'con') r.hp += 2;
    sfx('menu_select');
    persist();
    return true;
  };

  /* ---------------- loot ---------------- */
  var TIER_NAMES = { bronze: 'BRONZE', silver: 'SILVER', gold: 'GOLD', platinum: 'PLATINUM', legendary: 'LEGENDARY', fan: 'FAN', boss: 'BOSS' };
  G.tierName = function (tier) {
    var t = (D().boxTiers || {})[tier];
    return (t && t.name) || ((TIER_NAMES[tier] || String(tier).toUpperCase()) + ' BOX');
  };
  G.giveLootBox = function (tier, from, quiet) {
    var r = G.run; if (!r) return;
    r.boxes.push({ tier: tier, from: from || '' });
    if (!quiet) {
      sfx('pickup');
      toast(G.tierName(tier), { title: 'LOOT BOX GET', icon: 'box', color: (DCW.art && DCW.art.boxColor) ? DCW.art.boxColor(tier) : '#f8b800' });
    }
  };

  function lockedSkins() {
    var table = D().skins || {}, owned = DCW.save.unlocks.skins;
    return Object.keys(table).filter(function (id) { return owned.indexOf(id) < 0; });
  }
  function resolveReward(rw) {
    var r = G.run;
    rw = rw || { kind: 'gold', min: 5, max: 15 };
    switch (rw.kind) {
      case 'gold': {
        var amt = rw.amount || U.randi(rw.min || 5, rw.max || rw.min || 15);
        amt = Math.round(amt * floorScale());
        r.gold += amt;
        return { kind: 'gold', amount: amt };
      }
      case 'item': {
        var c = rw.count || 1;
        G.giveItem(rw.id, c);
        return { kind: 'item', id: rw.id, count: c };
      }
      case 'gear': {
        var gid = rw.id;
        if (rw.any || !gid) {
          var pool = Object.keys(D().gear || {}).filter(function (k) { var gd = D().gear[k]; return !G.hasGear(k) && !(gd && gd.noBox); });
          gid = pool.length ? U.pick(pool) : null;
        }
        if (!gid || G.hasGear(gid)) {
          var gc = Math.round(40 * floorScale()); r.gold += gc;
          return { kind: 'gold', amount: gc, converted: 'gear' };
        }
        G.giveGear(gid, 'LOOT BOX', true);
        return { kind: 'gear', id: gid, isNew: true };
      }
      case 'companion': {
        var cg = Math.round(60 * floorScale()); r.gold += cg;
        return { kind: 'gold', amount: cg, converted: 'companion' };
      }
      case 'skin': {
        var id = rw.id;
        if (rw.any || !id) { var sp = lockedSkins(); id = sp.length ? U.pick(sp) : null; }
        if (!id || DCW.save.unlocks.skins.indexOf(id) >= 0) {
          var conv = Math.round(60 * floorScale()); r.gold += conv;
          return { kind: 'gold', amount: conv, converted: 'skin' };
        }
        G.unlockSkin(id, true);
        return { kind: 'skin', id: id, isNew: true };
      }
      case 'stat': {
        var keys = ['str', 'con', 'dex', 'int'];
        var stat = (rw.any || !rw.stat) ? U.pick(keys) : rw.stat;
        var a = rw.amount || 1;
        r.stats[stat] += a;
        if (stat === 'con') r.hp += 2 * a;
        return { kind: 'stat', stat: stat, amount: a };
      }
      case 'xp': { var x = Math.round((rw.amount || 20) * floorScale()); G.addXP(x); return { kind: 'xp', amount: x }; }
      case 'hp': { var h = rw.amount || 1; r.bonus.hp += h; r.hp += h; return { kind: 'hp', amount: h }; }
      case 'revival': { var n = rw.count || 1; r.revivals += n; return { kind: 'revival', count: n }; }
      case 'box': { G.giveLootBox(rw.tier || 'bronze', 'PURCHASE', true); return { kind: 'box', tier: rw.tier || 'bronze' }; }
      case 'flag': { G.setFlag(rw.id, true); return { kind: 'flag', id: rw.id }; }
      default: return { kind: 'gold', amount: 0 };
    }
  }
  G.openLootBox = function (index) {
    var r = G.run; if (!r || !r.boxes.length || !G.inSafeRoom()) return [];
    index = U.clamp(index || 0, 0, r.boxes.length - 1);
    var box = r.boxes.splice(index, 1)[0];
    var tables = D().lootTables || {};
    var table = tables[box.tier] || tables.bronze || { rolls: 2, entries: [[{ kind: 'gold', min: 10, max: 30 }, 1]] };
    var out = [];
    // a box can carry fixed contents (story boxes): box.contents = [reward, ...]
    var gu = box.contents || table.guaranteed || table.guarantee;
    var rolls = box.contents ? 0 : (table.rolls || 2);
    for (var i = 0; i < rolls; i++) {
      var entry = U.weighted(table.entries || [[{ kind: 'gold', min: 10, max: 30 }, 1]]);
      out.push(resolveReward(entry));
    }
    if (gu) (Array.isArray(gu) ? gu : [gu]).forEach(function (g) { out.push(resolveReward(g)); });
    DCW.save.meta.boxesOpened = (DCW.save.meta.boxesOpened || 0) + 1;
    r.hp = Math.min(r.hp, G.playerStats().maxHp);
    G.track('box_open');
    persist();
    return out;
  };

  G.unlockSkin = function (id, quiet) {
    var list = DCW.save.unlocks.skins;
    if (list.indexOf(id) >= 0) return false;
    list.push(id); persist();
    var sk = (D().skins || {})[id];
    if (!quiet) { sfx('unlock'); toast((sk && sk.name) || id, { title: 'NEW OUTFIT', icon: 'star', color: '#f8b800' }); }
    return true;
  };

  /* ---------------- items, key items, companions ---------------- */
  G.itemDef = function (id) { return (D().questItems || {})[id] || null; };
  G.itemName = function (id) { var q = G.itemDef(id); return (q && q.name) || String(id || '').toUpperCase(); };
  G.hasItem = function (id) { var r = G.run; return !!(r && r.items && r.items[id]); };
  // giveItem('potion'|'bomb'|'biscuit', n) adds consumables; any other id is a key item.
  G.giveItem = function (id, n) {
    var r = G.run; if (!r) return false;
    if (id === 'potion') { r.potions += (n || 1); persist(); return true; }
    if (id === 'bomb' || id === 'jug' || id === 'dynamite') { r.bombs = Math.min(G.playerStats().maxBombs, r.bombs + (n || 1)); persist(); return true; }
    if (id === 'biscuit') { r.biscuits = (r.biscuits || 0) + (n || 1); persist(); return true; }
    r.items = r.items || {};
    if (r.items[id]) return false;
    r.items[id] = true;
    G.track('quest_item');
    persist();
    return true;
  };
  G.hasCompanion = function (id) {
    if (id === 'donut') return true;
    var r = G.run;
    return !!(r && r.companions && r.companions.indexOf(id) >= 0);
  };
  G.rescueCompanion = function (id) {
    var r = G.run; if (!r) return false;
    r.companions = r.companions || ['donut'];
    if (r.companions.indexOf(id) >= 0) return false;
    r.companions.push(id);
    G.unlockCompanion(id, true);
    G.track('rescue'); G.track('rescue:' + id);
    persist();
    return true;
  };
  G.unlockCompanion = function (id, quiet) {
    var list = DCW.save.unlocks.companions;
    if (list.indexOf(id) >= 0) return false;
    list.push(id); persist();
    var c = (D().companions || {})[id];
    if (!quiet) { sfx('unlock'); toast((c && c.name) || id, { title: 'NEW COMPANION', icon: 'star', color: '#f8b800' }); }
    return true;
  };
  G.equip = function (kind, id) {
    var s = DCW.save;
    var ok = kind === 'skin' ? s.unlocks.skins.indexOf(id) >= 0 : (s.run ? G.hasCompanion(id) : id === 'donut');
    if (!ok) { sfx('error'); return false; }
    s.equipped[kind] = id;
    if (kind === 'skin' && s.run) s.run.hp = Math.min(s.run.hp, G.playerStats().maxHp);
    G.track(kind === 'skin' ? 'skin_equip' : 'companion_equip');
    persist();
    return true;
  };

  /* ---------------- shop ---------------- */
  function shopItem(id) { return (D().shop || []).filter(function (s) { return s.id === id; })[0]; }
  G.price = function (id) {
    var it = shopItem(id); if (!it) return 0;
    var r = G.run, f = r ? r.floor : 1;
    return Math.round(it.price * (1 + (f - 1) * 0.35));
  };
  G.buy = function (id) {
    var r = G.run, it = shopItem(id);
    if (!r || !it) return { ok: false, msg: 'SOLD OUT' };
    var p = G.price(id);
    if (r.gold < p) { sfx('error'); return { ok: false, msg: 'NOT ENOUGH GOLD' }; }
    if (it.limit && (r.bought = r.bought || {})[id] >= it.limit) { sfx('error'); return { ok: false, msg: 'SOLD OUT' }; }
    r.gold -= p;
    r.bought = r.bought || {}; r.bought[id] = (r.bought[id] || 0) + 1;
    var gives = Array.isArray(it.give) ? it.give : [it.give || { kind: 'item', id: it.id, count: 1 }];
    var got = gives.map(resolveReward);
    sfx('buy');
    G.track('shop');
    persist();
    return { ok: true, msg: 'BOUGHT ' + it.name, rewards: got };
  };

  /* ---------------- achievements ---------------- */
  // Achievements are remembered per profile, but every crawl re-earns them (the book replays):
  // their boxes and gear land in the current run once, counted with per-run counters.
  G.track = function (event, n) {
    var m = DCW.save.meta, run = G.run;
    m.counters = m.counters || {};
    m.counters[event] = (m.counters[event] || 0) + (n || 1);
    if (run) { run.counters = run.counters || {}; run.counters[event] = (run.counters[event] || 0) + (n || 1); }
    var achs = D().achievements || {};
    for (var id in achs) {
      if (!achs.hasOwnProperty(id)) continue;
      var a = achs[id];
      if (a.event !== event) continue;
      var need = a.count || 1;
      var lifetime = !m.achievements[id] && m.counters[event] >= need;
      var thisRun = run && !(run.achRewarded || {})[id] && run.counters[event] >= need;
      if (lifetime || thisRun) G.achieve(id);
    }
  };
  G.achieve = function (id) {
    var m = DCW.save.meta;
    var a = (D().achievements || {})[id] || { name: String(id).toUpperCase() };
    var run = G.run;
    var already = !!m.achievements[id];
    if (run) run.achRewarded = run.achRewarded || {};
    if (already && (!run || run.achRewarded[id])) return false;
    m.achievements[id] = true;
    sfx('achievement');
    toast(a.name, { title: already ? 'ACHIEVEMENT!' : 'NEW ACHIEVEMENT!', icon: 'star', color: '#f8d878', time: 3.5 });
    if (run && !run.achRewarded[id]) {
      run.achRewarded[id] = true;
      if (a.box !== null) G.giveLootBox(a.box || 'bronze', 'ACHIEVEMENT: ' + a.name, true);
      if (a.gear) G.giveGear(a.gear, a.name);
      if (a.give) G.give(a.give, a.name);
    }
    var un = a.unlock;
    if (typeof un === 'string') un = { skin: un };
    if (un && un.skin) G.unlockSkin(un.skin);
    persist();
    return true;
  };

  /* ---------------- objectives (pause / gear screens) ---------------- */
  G.stepName = function (step) {
    var p = typeof step === 'string' ? parseStep(step) : step;
    if (!p) return '';
    if (p.kind === 'safe') return (G.safeRoomDef(p.id).name || 'SAFE ROOM');
    if (p.kind === 'cut') { var c = G.cutsceneDef(p.id); return (c && c.title) || 'STORY'; }
    var st = G.stageDef(p.id); return (st && st.name) || p.id;
  };
  G.objectives = function () {
    var r = G.run, f = G.floorDef();
    if (!r || !f) return [];
    var out = ['FLOOR ' + r.floor + ': ' + (f.name || '')];
    (f.sequence || []).forEach(function (step, i) {
      var p = parseStep(step);
      if (!p || p.kind === 'cut') return;
      out.push((i < r.seqIndex ? '✓ ' : i === r.seqIndex ? '▶ ' : '- ') + G.stepName(p));
    });
    return out;
  };

  /* ---------------- debug entry ---------------- */
  // ?debug&floor=N            fresh run at the start of floor N with the story so far applied
  // ?debug&stage=ID           straight into a stage (flags/gear/level of the story up to that point)
  // ?debug&cut=ID             play one cutscene, then back to the title
  // ?debug&scene=safe&room=ID | ending | death | title
  // extras: &god  &level=N  &flags=jugs,missile  &gear=a,b
  // story state at a sequence position: flags + gear from earlier cutscenes, safe rooms and bosses
  function simulateStory(r, floorN, seqIdx) {
    var stagesBefore = 0;
    floors().forEach(function (f) {
      if (f.n > floorN) return;
      (f.sequence || []).forEach(function (step, i) {
        if (f.n === floorN && i >= seqIdx) return;
        var p = parseStep(step); if (!p) return;
        var gives = [];
        if (p.kind === 'cut') { var c = G.cutsceneDef(p.id); if (c && c.give) gives = c.give; }
        else if (p.kind === 'safe') { var sr = (D().safeRooms || {})[p.id]; if (sr && sr.give) gives = sr.give; r.seenRooms[p.id] = true; }
        else {
          stagesBefore++; r.cleared[p.id] = true;
          var sd = G.stageDef(p.id), bd = sd && sd.boss && (D().bosses || {})[sd.boss];
          if (bd && bd.gear) r.gear[bd.gear] = true;
          if (sd && sd.reward && sd.reward.gear) r.gear[sd.reward.gear] = true;
        }
        (gives || []).forEach(function (g) {
          if (g.kind === 'flag') r.flags[g.id] = true;
          else if (g.kind === 'gear') r.gear[g.id] = true;
          else if (g.kind === 'item' && g.id === 'biscuit') r.biscuits += g.count || 1;
          else if (g.kind === 'companion' && r.companions.indexOf(g.id) < 0) r.companions.push(g.id);
        });
      });
    });
    return stagesBefore;
  }
  G.debugStart = function () {
    var p = DCW.params, s = DCW.save;
    var stId = p.get('stage');
    var n = parseInt(p.get('floor') || '0', 10);
    if (stId && G.stageDef(stId)) n = G.stageDef(stId).floor || n || 1;
    n = n || 1;
    s.run = makeRun();
    var r = s.run;
    r.floor = n;
    var f = G.floorDef(n);
    var seqIdx = 0;
    if (stId && f) { var k = (f.sequence || []).indexOf(stId); if (k >= 0) seqIdx = k; }
    var before = simulateStory(r, n, seqIdx);
    r.seqIndex = seqIdx;
    var lvl = parseInt(p.get('level') || '0', 10) || Math.max(1, Math.round(1 + before * 0.45));
    for (var i = 1; i < lvl; i++) { r.level++; var pts = (r.level % 5 === 0) ? 2 : 1; r.stats[['str', 'con', 'dex', 'int'][i % 4]] += pts; }
    (p.get('flags') || '').split(',').filter(Boolean).forEach(function (fl) { r.flags[fl] = true; });
    (p.get('gear') || '').split(',').filter(Boolean).forEach(function (gid) { r.gear[gid] = true; });
    Object.keys(r.gear).forEach(function (gid) { var gd = G.gearDef(gid); if (gd && gd.skin && (D().skins || {})[gd.skin]) { G.unlockSkin(gd.skin, true); s.equipped.skin = gd.skin; } });
    r.hp = G.playerStats().maxHp; r.gold = 60 * n; r.bombs = 5; r.potions = 3; r.biscuits = Math.max(r.biscuits, 3);
    if (p.has('god')) r.god = true;
    var cut = p.get('cut');
    if (cut) { DCW.setScene(S().cutscene || fallbackScene('NO CUTSCENE SCENE'), { id: cut, onDone: function () { G.toTitle(); } }); return; }
    var scene = p.get('scene');
    if (scene === 'safe') { r.room = p.get('room') || 'tally'; r.inSafe = true; DCW.setScene(S().safeRoom, { room: r.room }); return; }
    if (scene === 'ending') { r.won = true; DCW.setScene(S().ending, {}); return; }
    if (scene === 'death') { DCW.setScene(S().death, { result: { cause: 'TESTING' } }); return; }
    if (scene === 'title') { DCW.setScene(S().title, {}); return; }
    if (scene && S()[scene]) { DCW.setScene(S()[scene], { floor: n, room: p.get('room') }); return; }
    if (stId) { r.currentStage = stId; DCW.setScene(DCW.stage.scene, { stageId: stId }); return; }
    G.resumeFloor();
  };
})();

/* ============================================================
   DCW GAME - the run: floors, stages, overworld entrances,
   rewards, loot boxes, unlocks, achievements, progression.
   Contract: ../DESIGN.md "Game flow API".
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
  function music(n) { try { if (DCW.audio && DCW.audio.music) DCW.audio.music(n); } catch (e) { /* optional */ } }
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
    return floors()[n - 1] || floors().filter(function (f) { return f.n === n; })[0] || null;
  };
  G.stageDef = function (id) { return stages()[id] || null; };
  function floorScale() { var r = G.run; return 1 + ((r ? r.floor : 1) - 1) * 0.5; }

  /* ---------------- run creation ---------------- */
  function makeRun() {
    return {
      floor: 1, cleared: {}, bossDown: false, seqIndex: 0, owPos: null, roamersDown: [],
      hp: 12, level: 1, xp: 0, statPoints: 0,
      stats: { str: 3, con: 3, dex: 3, int: 3 },
      bonus: { hp: 2 },
      gold: 0, bombs: 3, potions: 1, views: 0, fanTier: 0,
      boxes: [], revivals: 3, floorTime: 0, totalTime: 0, kills: 0, deaths: 0,
      currentStage: null, inSafe: false, pendingAmbush: null, won: false,
      seed: (Math.random() * 1e9) >>> 0
    };
  }

  G.init = function () {
    var p = DCW.params;
    if (DCW.debug && (p.has('floor') || p.has('stage') || p.has('scene'))) { G.debugStart(); return; }
    G.toTitle(true);
  };

  G.toTitle = function (instant) {
    var sc = S().title || fallbackScene('DUNGEON CRAWLER WORLD', function () { G.newRun(); });
    if (instant) DCW.setScene(sc, {}); else go(sc, {});
  };

  G.newRun = function () {
    var s = DCW.save;
    s.run = makeRun();
    s.meta.runs = (s.meta.runs || 0) + 1;
    persist();
    if (S().intro && !DCW.params.has('skipintro')) {
      go(S().intro, { onDone: function () { s.meta.seenIntro = true; persist(); G.startFloor(1); } });
    } else G.startFloor(1);
  };

  G.continueRun = function () {
    var r = G.run;
    if (!r) { G.newRun(); return; }
    if (r.won) { go(S().ending || fallbackScene('YOU WON'), {}); return; }
    if (r.hp <= 0) { go(S().death || fallbackScene('YOU HAVE DIED', function () { G.revive() || G.endRun(); }), { result: r.lastDeath || {} }); return; }
    if (r.inSafe) { G.enterSafeRoom(); return; }
    G.resumeFloor();
  };

  G.startFloor = function (n) {
    var r = G.run; if (!r) return;
    var f = G.floorDef(n);
    if (!f) { G.win(); return; }
    r.floor = n; r.cleared = {}; r.bossDown = false; r.seqIndex = 0; r.owPos = null;
    r.roamersDown = []; r.floorTime = 0; r.currentStage = null; r.inSafe = false; r.pendingAmbush = null;
    var perk = skinPerk();
    if (perk.bombs && n > 1) r.bombs += perk.bombs;
    var m = DCW.save.meta; m.bestFloor = Math.max(m.bestFloor || 0, n);
    persist();
    G.track('floor:' + n);
    var card = S().floorCard;
    if (card) go(card, { floor: n, onDone: function () { G.resumeFloor(); } });
    else G.resumeFloor();
  };

  // Decide where the player belongs on the current floor.
  G.resumeFloor = function () {
    var r = G.run, f = G.floorDef();
    if (!r || !f) { G.toTitle(); return; }
    if (f.overworld) {
      r.currentStage = null; persist();
      var ow = DCW.overworld && DCW.overworld.scene;
      go(ow || fallbackScene('OVERWORLD MISSING'), { floor: r.floor });
      return;
    }
    var seq = f.sequence || [];
    var step = seq[r.seqIndex];
    if (step === undefined) { r.bossDown = true; G.takeStairs(); return; }
    if (step === 'SAFE') { G.enterSafeRoom(); return; }
    G.enterStage(step);
  };

  /* ---------------- stages ---------------- */
  G.enterStage = function (stageId) {
    var r = G.run; if (!r) return;
    if (!G.stageDef(stageId)) { toast('STAGE MISSING: ' + stageId, { color: '#f83800' }); return; }
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
    var f = G.floorDef();
    var rewards = [];
    var first = !r.cleared[id];
    var rw = st.reward || {};
    r.cleared[id] = true;
    sfx('fanfare');
    // xp + gold for the clear
    var xp = rw.xp ? (first ? rw.xp : Math.round(rw.xp / 3)) : 0;
    if (xp) { G.addXP(xp); rewards.push({ kind: 'xp', amount: xp }); }
    if (rw.gold) {
      var g = Array.isArray(rw.gold) ? U.randi(rw.gold[0], rw.gold[1]) : rw.gold;
      if (!first) g = Math.round(g / 3);
      g = G.addGold(g); rewards.push({ kind: 'gold', amount: g });
    }
    if (first && rw.box) { G.giveLootBox(rw.box, st.name || 'STAGE CLEAR', true); rewards.push({ kind: 'box', tier: rw.box }); }
    if (!result.damageTaken) {
      G.track('no_damage_stage');
      var bonusViews = G.addViews(250 * r.floor);
      rewards.push({ kind: 'views', amount: bonusViews, note: 'FLAWLESS' });
    }
    if (result.maxCombo >= 25 && first) { G.giveLootBox('silver', 'COMBO ' + result.maxCombo, true); rewards.push({ kind: 'box', tier: 'silver' }); }
    // boss
    var bossId = result.boss || st.boss;
    var isBoss = st.kind === 'boss' || !!result.boss;
    if (isBoss) {
      r.bossDown = true;
      var b = (D().bosses || {})[bossId] || {};
      if (first) {
        G.giveLootBox(b.loot || 'boss', b.name || 'BOSS', true); rewards.push({ kind: 'box', tier: b.loot || 'boss' });
        if (b.loot && b.loot !== 'boss') { G.giveLootBox('boss', b.name || 'BOSS', true); rewards.push({ kind: 'box', tier: 'boss' }); }
        var un = b.unlock || {};
        if (un.skin) rewards.push({ kind: 'skin', id: un.skin, isNew: G.unlockSkin(un.skin, true) });
        if (un.companion) rewards.push({ kind: 'companion', id: un.companion, isNew: G.unlockCompanion(un.companion, true) });
      }
      G.track('boss:' + bossId);
    }
    // ambush roamer
    if (st.kind === 'ambush' && r.pendingAmbush !== null && r.pendingAmbush !== undefined) {
      if (r.roamersDown.indexOf(r.pendingAmbush) < 0) r.roamersDown.push(r.pendingAmbush);
      r.pendingAmbush = null;
    }
    if (f && !f.overworld && (f.sequence || [])[r.seqIndex] === id) r.seqIndex++;
    r.currentStage = null;
    var maxHp = G.playerStats().maxHp;
    r.hp = U.clamp(r.hp, 1, maxHp);
    persist();
    var after = function () {
      if (isBoss) G.floorCleared();
      else G.resumeFloor();
    };
    var res = S().results;
    if (res) go(res, { result: result, rewards: rewards, onDone: after });
    else after();
  };

  // Boss down: AI congratulates. Linear floors go straight down the stairs; overworld floors
  // send you back to walk to the stairwell (now open).
  G.floorCleared = function () {
    var r = G.run, f = G.floorDef();
    if (!r) return;
    if (f && f.overworld) {
      G.resumeFloor();
      setTimeout(function () { if (DCW.overworld && DCW.scene === DCW.overworld.scene) toast('THE STAIRWELL IS OPEN', { icon: 'key', color: '#f8b800' }); }, 900);
    } else {
      G.takeStairs();
    }
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

  G.fleeStage = function () {
    var r = G.run; if (!r) return;
    G.track('flee');
    r.pendingAmbush = null;
    r.currentStage = null; persist();
    var line = pickLine('flee');
    G.resumeFloor();
    if (line) setTimeout(function () { toast(line, { icon: 'skull', time: 4 }); }, 700);
  };

  /* ---------------- overworld entrances ---------------- */
  G.entranceState = function (code) {
    var r = G.run, f = G.floorDef();
    var ow = f && f.overworld;
    if (!ow) return null;
    var target = (ow.entrances || {})[code];
    if (!target) return null;
    var n = r ? r.floor : 1;
    if (target === 'SAFE') return { kind: 'safe', name: 'SAFE ROOM', cleared: false, locked: false };
    if (target === 'STAIRS') {
      var last = n >= floors().length;
      return { kind: 'stairs', name: last ? 'THE FINAL STAIRWELL' : 'STAIRWELL TO FLOOR ' + (n + 1), cleared: false,
        locked: !(r && r.bossDown), lockText: 'DEFEAT THE FLOOR BOSS FIRST' };
    }
    var st = G.stageDef(target);
    if (!st) return { kind: 'stage', name: '???', stageId: target, locked: true, lockText: 'UNDER CONSTRUCTION' };
    var out = { kind: st.kind === 'boss' ? 'boss' : 'stage', side: st.kind === 'side', stageId: target, name: st.name || target,
      cleared: !!(r && r.cleared[target]), locked: false };
    if (st.kind === 'boss') {
      var left = (f.required || []).filter(function (id) { return !(r && r.cleared[id]); }).length;
      if (left > 0) { out.locked = true; out.lockText = 'CLEAR ' + left + ' MORE AREA' + (left > 1 ? 'S' : '') + ' TO OPEN'; }
      if (r && r.bossDown) out.cleared = true;
    }
    return out;
  };

  G.enterEntrance = function (code) {
    var r = G.run, f = G.floorDef();
    if (!r || !f || !f.overworld) return false;
    if (typeof code === 'string' && code.indexOf('!ambush:') === 0) {
      var idx = parseInt(code.slice(8), 10);
      var amb = f.overworld.ambush;
      if (!amb || !G.stageDef(amb)) { if (r.roamersDown.indexOf(idx) < 0) r.roamersDown.push(idx); return false; }
      r.pendingAmbush = idx;
      if (DCW.ui && DCW.ui.announce) DCW.ui.announce('AMBUSH!', { color: '#f83800' });
      sfx('warn');
      G.enterStage(amb);
      return true;
    }
    var st = G.entranceState(code);
    if (!st) return false;
    if (st.locked) { sfx('error'); toast(st.lockText || 'LOCKED', { icon: 'key', color: '#f83800' }); return false; }
    sfx('door');
    if (st.kind === 'safe') G.enterSafeRoom();
    else if (st.kind === 'stairs') G.takeStairs();
    else G.enterStage(st.stageId);
    return true;
  };

  /* ---------------- safe room + stairs ---------------- */
  G.enterSafeRoom = function () {
    var r = G.run; if (!r) return;
    r.inSafe = true; r.restedHere = false; persist();
    go(S().safeRoom || fallbackScene('SAFE ROOM', function () { G.heal(999); G.leaveSafeRoom(); }), {});
  };
  G.leaveSafeRoom = function () {
    var r = G.run; if (!r) return;
    r.inSafe = false;
    var f = G.floorDef();
    if (f && !f.overworld && (f.sequence || [])[r.seqIndex] === 'SAFE') r.seqIndex++;
    persist();
    G.resumeFloor();
  };

  G.takeStairs = function () {
    var r = G.run, f = G.floorDef();
    if (!r) return;
    if (!r.bossDown) { toast('DEFEAT THE FLOOR BOSS FIRST', { color: '#f83800' }); return; }
    sfx('stairs');
    if (f && f.par && r.floorTime <= f.par) G.giveLootBox('gold', 'UNDER PAR ON FLOOR ' + r.floor);
    G.track('floor_clear');
    r.totalTime += r.floorTime;
    var line = pickLine('floorClear');
    var next = r.floor + 1;
    persist();
    if (!G.floorDef(next)) { G.win(); return; }
    var proceed = function () { G.startFloor(next); };
    if (line) {
      // show the quip over whatever scene is current, then descend
      say([{ who: 'SYSTEM AI', portrait: 'p_ai', text: line }], { onDone: proceed });
    } else proceed();
  };

  G.win = function () {
    var r = G.run, m = DCW.save.meta;
    if (r) r.won = true;
    m.wins = (m.wins || 0) + 1;
    G.unlockSkin('carl_gold', true);
    G.track('win');
    persist();
    go(S().ending || fallbackScene('YOU BEAT THE DUNGEON. FOR NOW.', function () { G.quitToTitle(); }), {});
  };

  G.quitToTitle = function () {
    var r = G.run;
    if (r && r.won) DCW.save.run = null;
    persist();
    G.toTitle();
  };

  G.tick = function (dt) { var r = G.run; if (r) r.floorTime += dt; };

  /* ---------------- stats ---------------- */
  function skinPerk() {
    var sk = (D().skins || {})[DCW.save.equipped.skin];
    return (sk && sk.perk) || {};
  }
  function mul(v) { if (!v) return 1; return v < 1 ? 1 + v : v; } // perk.gold: 0.25 or 1.25 both mean +25%
  G.xpNeed = function (level) { return Math.round(18 * Math.pow(level, 1.5)); };
  G.playerStats = function () {
    var r = G.run || makeRun();
    var st = r.stats, lv = r.level, p = skinPerk();
    var dmg = 2 + (st.str - 3) + Math.floor((lv - 1) / 2) + (p.dmg || 0);
    return {
      maxHp: 10 + (st.con - 3) * 2 + (lv - 1) + ((r.bonus && r.bonus.hp) || 0) + (p.hp || 0),
      dmg: dmg,
      kickDmg: Math.round(dmg * 1.5),
      crit: Math.min(0.6, 0.04 + (st.dex - 3) * 0.02 + (p.crit || 0)),
      speedMul: (1 + (st.dex - 3) * 0.03) * mul(p.speed),
      bombDmg: 8 + lv * 2 + (st.str - 3),
      bombRadius: 28,
      compPower: 1 + (st.int - 3) * 0.15 + (lv - 1) * 0.04,
      def: p.def || 0,
      goldMul: mul(p.gold),
      viewMul: mul(p.views),
      extraJump: !!p.doubleJump,
      skinPerk: p
    };
  };

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
  var FAN_TIERS = [1000, 5000, 15000, 40000, 100000, 250000, 500000, 1000000, 2500000, 5000000];
  G.addViews = function (n) {
    var r = G.run; if (!r || !n) return 0;
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

  function lockedOf(kind) {
    var table = kind === 'skin' ? (D().skins || {}) : (D().companions || {});
    var owned = kind === 'skin' ? DCW.save.unlocks.skins : DCW.save.unlocks.companions;
    return Object.keys(table).filter(function (id) { return owned.indexOf(id) < 0 && id !== 'carl_gold'; });
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
        if (rw.id === 'bomb') r.bombs += c; else if (rw.id === 'potion') r.potions += c;
        return { kind: 'item', id: rw.id, count: c };
      }
      case 'skin':
      case 'companion': {
        var id = rw.id;
        var owned = rw.kind === 'skin' ? DCW.save.unlocks.skins : DCW.save.unlocks.companions;
        if (rw.any || !id) { var pool = lockedOf(rw.kind); id = pool.length ? U.pick(pool) : null; }
        if (!id || owned.indexOf(id) >= 0) {
          var conv = Math.round(60 * floorScale()); r.gold += conv;
          return { kind: 'gold', amount: conv, converted: true };
        }
        if (rw.kind === 'skin') G.unlockSkin(id, true); else G.unlockCompanion(id, true);
        return { kind: rw.kind, id: id, isNew: true };
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
    var rolls = table.rolls || 2;
    for (var i = 0; i < rolls; i++) {
      var entry = U.weighted(table.entries || [[{ kind: 'gold', min: 10, max: 30 }, 1]]);
      out.push(resolveReward(entry));
    }
    var gu = table.guaranteed || table.guarantee;
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
    if (!quiet) { sfx('unlock'); toast((sk && sk.name) || id, { title: 'NEW SKIN', icon: 'star', color: '#f8b800' }); }
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
    var list = kind === 'skin' ? s.unlocks.skins : s.unlocks.companions;
    if (list.indexOf(id) < 0) { sfx('error'); return false; }
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
  G.track = function (event, n) {
    var m = DCW.save.meta;
    m.counters = m.counters || {};
    m.counters[event] = (m.counters[event] || 0) + (n || 1);
    var achs = D().achievements || {};
    for (var id in achs) {
      if (!achs.hasOwnProperty(id)) continue;
      var a = achs[id];
      if (a.event === event && !m.achievements[id] && m.counters[event] >= (a.count || 1)) G.achieve(id);
    }
  };
  G.achieve = function (id) {
    var m = DCW.save.meta;
    if (m.achievements[id]) return false;
    var a = (D().achievements || {})[id] || { name: id };
    m.achievements[id] = true;
    sfx('achievement');
    toast(a.name, { title: 'NEW ACHIEVEMENT!', icon: 'star', color: '#f8d878', time: 3.5 });
    if (G.run) G.giveLootBox(a.box || 'bronze', 'ACHIEVEMENT: ' + a.name, true);
    var un = a.unlock;
    if (typeof un === 'string') un = (D().skins || {})[un] ? { skin: un } : { companion: un };
    if (un && un.skin) G.unlockSkin(un.skin);
    if (un && un.companion) G.unlockCompanion(un.companion);
    persist();
    return true;
  };

  /* ---------------- objectives (MAP screen) ---------------- */
  G.objectives = function () {
    var r = G.run, f = G.floorDef();
    if (!r || !f) return [];
    var out = ['FLOOR ' + r.floor + ': ' + (f.name || '')];
    var st = stages();
    if (f.overworld) {
      (f.required || []).forEach(function (id) {
        out.push((r.cleared[id] ? '✓ ' : '- ') + ((st[id] && st[id].name) || id));
      });
      var b = st[f.boss];
      out.push((r.bossDown ? '✓ ' : '- ') + 'DEFEAT ' + ((b && b.boss && D().bosses && D().bosses[b.boss] && D().bosses[b.boss].name) || 'THE BOSS'));
      out.push((r.bossDown ? '▶ ' : '- ') + 'TAKE THE STAIRWELL');
      var sides = Object.keys(f.overworld.entrances || {}).map(function (k) { return f.overworld.entrances[k]; })
        .filter(function (id) { return st[id] && st[id].kind === 'side'; });
      if (sides.length) out.push('SIDE AREAS: ' + sides.filter(function (id) { return r.cleared[id]; }).length + '/' + sides.length);
    } else {
      (f.sequence || []).forEach(function (id, i) {
        var name = id === 'SAFE' ? 'SAFE ROOM' : ((st[id] && st[id].name) || id);
        out.push((i < r.seqIndex ? '✓ ' : i === r.seqIndex ? '▶ ' : '- ') + name);
      });
    }
    if (f.par) out.push('PAR ' + U.fmtTime(f.par) + '  TIME ' + U.fmtTime(r.floorTime));
    return out;
  };

  /* ---------------- debug entry ---------------- */
  // ?debug&floor=N            fresh run at floor N with a level-appropriate build
  // ?debug&stage=ID           straight into a stage (uses that stage's floor)
  // ?debug&scene=safe|ending|death|title|results
  G.debugStart = function () {
    var p = DCW.params, s = DCW.save;
    var stId = p.get('stage');
    var n = parseInt(p.get('floor') || '0', 10);
    if (stId && G.stageDef(stId)) n = G.stageDef(stId).floor || n || 1;
    n = n || 1;
    s.run = makeRun();
    var r = s.run;
    r.floor = n;
    var lvl = Math.max(1, Math.round(1 + (n - 1) * 2.5));
    for (var i = 1; i < lvl; i++) { r.level++; var pts = (r.level % 5 === 0) ? 2 : 1; r.stats[['str', 'con', 'dex', 'int'][i % 4]] += pts; }
    r.hp = G.playerStats().maxHp; r.gold = 100 * n; r.bombs = 5; r.potions = 3;
    if (p.has('god')) r.god = true;
    var scene = p.get('scene');
    if (scene === 'safe') { r.inSafe = true; DCW.setScene(S().safeRoom, {}); return; }
    if (scene === 'ending') { DCW.setScene(S().ending, {}); return; }
    if (scene === 'death') { DCW.setScene(S().death, { result: { cause: 'TESTING' } }); return; }
    if (scene === 'title') { DCW.setScene(S().title, {}); return; }
    var f = G.floorDef(n);
    if (f) { r.cleared = {}; r.bossDown = false; }
    if (stId) { r.currentStage = stId; DCW.setScene(DCW.stage.scene, { stageId: stId }); return; }
    if (p.has('bossdown')) r.bossDown = true;
    if (p.has('allclear') && f) (f.required || []).forEach(function (id) { r.cleared[id] = true; });
    if (f && f.overworld) DCW.setScene(DCW.overworld.scene, { floor: n });
    else G.resumeFloor();
  };
})();

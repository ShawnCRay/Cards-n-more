/* ============================================================
   DCW GAME (book 2) - the run on the Third Floor: the 8-day clock,
   street areas (the playable overworld), doors, levels and their
   kinds, story flags and events, quests, inns, shops, loot,
   achievements, the book 1 save import, endings.
   Contract: ../DESIGN.md sections 4 and 5.
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
  function announce(t, o) { if (DCW.ui && DCW.ui.announce) DCW.ui.announce(t, o || {}); }
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
      update: function () { this.t += DCW.dt; if (this.t > 0.3 && DCW.input.pressed('confirm') && next) next(); },
      draw: function () { DCW.text(msg, 160, 80, '#fcfcfc', { align: 'center', wrap: 300 }); if (next) DCW.text('PRESS A', 160, 110, '#f8b800', { align: 'center' }); }
    };
  }
  function arr(v) { return v === undefined || v === null ? [] : (Array.isArray(v) ? v : [v]); }
  function meta() { return D().meta || {}; }

  G.levelDef = function (id) { return (D().levels || {})[id] || null; };
  G.areaDef = function (id) { return (D().areas || {})[id] || null; };
  G.stageDef = G.levelDef; // book 1 shim
  G.floorDef = function () { return { n: 3, name: meta().floorName || 'THE OVER CITY', overworld: null }; }; // book 1 shim
  G.act = function () { var r = G.run; return (r && r.act) || 1; };
  function actScale() { return 1 + (G.act() - 1) * 0.4; }

  /* ---------------- run creation ---------------- */
  function makeRun() {
    var m = meta();
    return {
      hoursLeft: m.startHours || 192, hour: m.startHour === undefined ? 7 : m.startHour,
      act: 1, area: m.startArea || 'village', areaX: null, level: null, inInn: null, inClub: null,
      cleared: {}, flags: {}, quests: {}, events: {},
      items: { jug: 2, hob: 0, dyn: 0, smoke: 2 }, selected: 'jug',
      hp: 16, level: 13, xp: 0, statPoints: 0,
      stats: { str: 5, con: 4, dex: 4, int: 4 },
      bonus: { hp: 0, str: 0, con: 0, dex: 0, int: 0 },
      gold: 120, potions: 2, views: 0, fanTier: 0, boxes: [], revivals: 3,
      kills: 0, deaths: 0, totalTime: 0, banned: {}, wanted: null, bought: {},
      won: false, seed: (Math.random() * 1e9) >>> 0
    };
  }
  // the run keeps a 'level' number (Carl's level) and 'levelId' for the level in progress
  function curLevelId() { var r = G.run; return r ? r.levelId : null; }

  G.init = function () {
    var p = DCW.params;
    if (DCW.debug && (p.has('level') || p.has('area') || p.has('scene') || p.has('cinema'))) { G.debugStart(); return; }
    G.toTitle(true);
  };

  G.toTitle = function (instant) {
    var sc = S().title || fallbackScene('DUNGEON CRAWLER WORLD 2', function () { G.newRun(); });
    if (DCW.audio && DCW.audio.music) { try { DCW.audio.music('title'); } catch (e) { /* optional */ } }
    if (instant) DCW.setScene(sc, {}); else go(sc, {});
  };

  G.newRun = function () {
    var s = DCW.save;
    s.run = makeRun();
    s.meta.runs = (s.meta.runs || 0) + 1;
    var r = s.run;
    r.hp = G.playerStats().maxHp;
    // book 1 veterans get their bonus boxes in every new crawl
    (s.meta.legacyBoxes || []).forEach(function (t) { r.boxes.push({ tier: t, from: 'BOOK 1 VETERAN' }); });
    persist();
    var m = meta();
    var afterPick = function () {
      s.meta.seenIntro = true; persist();
      G.playCinema(m.afterClassCinema, function () { G.goArea(r.area, m.startEntry || 'left'); });
    };
    var pick = function () {
      if (S().classPick) go(S().classPick, { onDone: afterPick });
      else afterPick();
    };
    if (DCW.params.has('skipintro')) { G.goArea(r.area, m.startEntry || 'left'); return; }
    G.playCinema(m.startCinema || 'arrival', pick);
  };

  G.continueRun = function () {
    var r = G.run;
    if (!r) { G.newRun(); return; }
    if (r.won) { go(S().ending || fallbackScene('YOU WON'), { kind: 'win' }); return; }
    if (r.hoursLeft <= 0) { collapse(); return; }
    if (r.hp <= 0) { go(S().death || fallbackScene('YOU HAVE DIED', function () { G.revive() || G.endRun(); }), { result: r.lastDeath || {} }); return; }
    if (r.inInn) { G.enterInn(r.inInn); return; }
    if (r.levelId && G.levelDef(r.levelId)) { G.enterLevel(r.levelId); return; }
    G.goArea(r.area, r.areaX !== null && r.areaX !== undefined ? { x: r.areaX } : 'left');
  };

  /* ---------------- the clock ---------------- */
  function isNight(h) { return h < 7 || h >= 19; }
  G.clock = function () {
    var r = G.run || { hoursLeft: 192, hour: 7 };
    var left = Math.max(0, Math.ceil(r.hoursLeft));
    var hour = Math.floor(((r.hour % 24) + 24) % 24);
    var start = meta().startHours || 192;
    return {
      hoursLeft: left, hour: hour, minute: Math.floor((r.hour % 1) * 60),
      day: Math.min(8, Math.floor((start - left) / 24) + 1),
      phase: isNight(hour) ? 'night' : 'day', night: isNight(hour),
      label: Math.floor(left / 24) + 'D ' + (left % 24) + 'H'
    };
  };
  G.advanceClock = function (hours) {
    var r = G.run; if (!r || !hours) return;
    var wasNight = isNight(Math.floor(r.hour));
    r.hoursLeft = Math.max(0, r.hoursLeft - hours);
    r.hour = (r.hour + hours) % 24;
    var night = isNight(Math.floor(r.hour));
    if (night !== wasNight) {
      G.track(night ? 'night' : 'day');
      var line = pickLine(night ? 'night' : 'day');
      setTimeout(function () {
        announce(night ? 'NIGHT FALLS' : 'MORNING', { color: night ? '#6888fc' : '#fca044', sub: line || '' });
        sfx(night ? 'bell_night' : 'bell_day');
      }, 900);
    }
    // bans expire
    Object.keys(r.banned || {}).forEach(function (a) { if (r.hoursLeft <= r.banned[a]) delete r.banned[a]; });
    persist();
    if (r.hoursLeft <= 0) collapse();
  };
  function hoursUntil(targetHour) {
    var r = G.run; var h = r.hour % 24;
    var d = targetHour - h; if (d <= 0) d += 24;
    return d;
  }
  function collapse() {
    var r = G.run; if (!r) return;
    G.track('collapse');
    persist();
    var line = pickLine('collapse');
    var end = function () { go(S().ending || fallbackScene('THE FLOOR COLLAPSED', function () { G.endRun(); }), { kind: 'collapse' }); };
    if (line) say([{ who: 'SYSTEM AI', text: line }], { onDone: end }); else end();
  }
  G.debugFlipPhase = function () {
    var r = G.run; if (!r) return;
    r.hour = isNight(Math.floor(r.hour)) ? 9 : 21; persist();
    toast(isNight(r.hour) ? 'DEBUG: NIGHT' : 'DEBUG: DAY');
    if (DCW.stage && DCW.scene === DCW.stage.scene && r.area && !r.levelId) G.goArea(r.area, { x: r.areaX || 32 });
  };

  /* ---------------- flags, items, quests ---------------- */
  G.flag = function (name) { var r = G.run; return !!(r && r.flags && r.flags[name]); };
  G.setFlag = function (name, v) {
    var r = G.run; if (!r || !name) return;
    var on = v === undefined ? true : !!v;
    if (!!r.flags[name] === on) return;
    if (on) r.flags[name] = true; else delete r.flags[name];
    if (on) G.track('flag:' + name);
    if (on && /^act[23]$/.test(name)) r.act = Math.max(r.act, +name.slice(3));
    persist();
  };
  function flagsOk(when) {
    when = when || {};
    var ok = arr(when.flags).every(G.flag) && !arr(when.notFlags).some(G.flag);
    if (ok && when.phase && when.phase !== 'any') ok = G.clock().phase === when.phase;
    return ok;
  }
  G.itemDef = function (id) { return (D().items || {})[id] || null; };
  G.itemName = function (id) { var q = G.itemDef(id); return (q && q.name) || String(id || '').toUpperCase().replace(/_/g, ' '); };
  G.itemCount = function (id) {
    var r = G.run; if (!r) return 0;
    if (id === 'potion') return r.potions || 0;
    return (r.items && r.items[id]) || 0;
  };
  G.hasItem = function (id) { return G.itemCount(id) > 0; };
  G.giveItem = function (id, n) {
    var r = G.run; if (!r || !id) return false;
    n = n === undefined ? 1 : n;
    if (id === 'potion') { r.potions += n; persist(); return true; }
    r.items = r.items || {};
    var def = G.itemDef(id);
    var isKey = def && def.kind === 'key';
    if (isKey && r.items[id]) return false;
    r.items[id] = (r.items[id] || 0) + (isKey ? 1 : n);
    if (isKey) G.track('key_item');
    persist();
    return true;
  };
  G.useItem = function (id, n) {
    var r = G.run; n = n || 1;
    if (!r || G.itemCount(id) < n) return false;
    if (id === 'potion') r.potions -= n; else r.items[id] -= n;
    persist();
    return true;
  };
  G.questDef = function (id) { return (D().quests || {})[id] || { name: String(id).toUpperCase() }; };
  G.startQuest = function (id) {
    var r = G.run; if (!r || r.quests[id]) return;
    r.quests[id] = 'active';
    G.track('quest_start');
    sfx('unlock');
    toast(G.questDef(id).name, { title: 'NEW QUEST', icon: 'quest', color: '#f8d878', time: 3.5 });
    persist();
  };
  G.finishQuest = function (id) {
    var r = G.run; if (!r || r.quests[id] === 'done') return;
    r.quests[id] = 'done';
    G.track('quest_done'); G.track('quest_done:' + id);
    sfx('fanfare');
    toast(G.questDef(id).name, { title: 'QUEST COMPLETE', icon: 'star', color: '#f8b800', time: 3.5 });
    persist();
  };
  function applyQuest(q) {
    if (!q) return;
    if (q.start) arr(q.start).forEach(G.startQuest);
    if (q.done) arr(q.done).forEach(G.finishQuest);
  }
  function applyGives(gives) {
    arr(gives).forEach(function (g) {
      if (!g) return;
      if (g.item) { G.giveItem(g.item, g.n === undefined ? 1 : g.n); var nm = G.itemName(g.item); toast(nm + (g.n > 1 ? ' x' + g.n : ''), { title: 'GOT', icon: g.item, color: '#58d854' }); }
      else if (g.potion) { G.giveItem('potion', g.potion); toast('POTION x' + g.potion, { title: 'GOT', icon: 'potion' }); }
      else if (g.gold) { var got = G.addGold(g.gold); toast(got + ' GOLD', { icon: 'coin', color: '#f8b800' }); }
      else if (g.box) G.giveLootBox(g.box, g.from || 'STORY');
      else if (g.skin) G.unlockSkin(g.skin);
      else if (g.xp) G.addXP(g.xp);
      else if (g.kind) resolveReward(g);
    });
  }

  G.party = function () {
    var r = G.run; if (!r) return ['donut', 'mongo'];
    var lv = G.levelDef(r.levelId);
    if (lv && (lv.solo || lv.swap)) return [];
    if (lv && Array.isArray(lv.party)) return lv.party.slice();
    var p = ['donut', 'mongo'];
    if (G.flag('katia_joined')) p.push('katia');
    if (G.flag('mongo_away')) p.splice(p.indexOf('mongo'), 1);
    return p;
  };
  G.hasCompanion = function (id) { return G.party().indexOf(id) >= 0; }; // book 1 shim

  G.objective = function () {
    var list = D().objectives || [];
    for (var i = 0; i < list.length; i++) {
      var o = list[i];
      if (o.done && G.flag(o.done)) continue;
      if (o.showIf && !G.flag(o.showIf)) continue;
      return { text: o.text, area: o.area || null };
    }
    return null;
  };
  G.objectives = function () { // book 1 shim for any leftover map code
    var o = G.objective(); var c = G.clock();
    return ['THE OVER CITY  ' + c.label + ' LEFT'].concat(o ? ['▶ ' + o.text] : []);
  };

  /* ---------------- streets (the overworld) ---------------- */
  G.goArea = function (areaId, entry) {
    var r = G.run; if (!r) return;
    var a = G.areaDef(areaId);
    if (!a) { toast('AREA MISSING: ' + areaId, { color: '#f83800' }); return; }
    if (r.banned && r.banned[areaId] !== undefined && r.hoursLeft > r.banned[areaId]) {
      sfx('error');
      toast(pickLine('ban') || 'THE GUARDS REMEMBER YOUR FACE. COME BACK TOMORROW.', { icon: 'skull', color: '#f83800', time: 3.5 });
      return;
    }
    r.area = areaId; r.levelId = null; r.inInn = null; r.inClub = null;
    if (entry && typeof entry === 'object' && entry.x !== undefined) r.areaX = entry.x;
    r.flags['visited_' + areaId] = true;   // the map screen shows where you have been
    persist();
    var sc = DCW.stage && DCW.stage.scene;
    go(sc || fallbackScene('STREET MODULE MISSING'), { areaId: areaId, entry: entry || 'left' });
  };
  G.saveStreetPos = function (areaId, x) { var r = G.run; if (!r) return; r.area = areaId || r.area; r.areaX = x; };

  G.doorState = function (areaId, ch) {
    var a = G.areaDef(areaId), d = a && a.doors && a.doors[ch];
    if (!d) return null;
    var out = { visible: true, locked: false, lockText: '', label: d.label || '', kind: d.kind, target: d.target, sprite: d.sprite, cleared: false };
    if (d.showIf && !arr(d.showIf).every(G.flag)) out.visible = false;
    if (d.hideIf && arr(d.hideIf).some(G.flag)) out.visible = false;
    var r = G.run;
    if (d.kind === 'level') {
      var lv = G.levelDef(d.target);
      if (!lv) { out.locked = true; out.lockText = 'UNDER CONSTRUCTION'; return out; }
      if (!out.label) out.label = lv.name || d.target;
      out.cleared = !!(r && r.cleared[d.target]);
      if (out.cleared && !lv.optional) { out.locked = true; out.lockText = d.doneText || 'DONE. NOTHING LEFT IN THERE BUT REGRET.'; }
      if (lv.phase && !out.locked && lv.phase !== 'any' && G.clock().phase !== lv.phase) {
        out.locked = true; out.lockText = lv.phase === 'night' ? 'COME BACK AFTER DARK' : 'CLOSED UNTIL MORNING';
      }
    }
    if (!out.locked && d.phase && d.phase !== 'any' && G.clock().phase !== d.phase) {
      out.locked = true; out.lockText = d.lockText || (d.phase === 'night' ? 'COME BACK AFTER DARK' : 'CLOSED UNTIL MORNING');
    }
    if (!out.locked && d.needs && !arr(d.needs).every(G.flag)) { out.locked = true; out.lockText = d.lockText || 'NOT YET'; }
    if (!out.locked && d.needsItem && !G.hasItem(d.needsItem)) { out.locked = true; out.lockText = d.lockText || ('NEEDS: ' + G.itemName(d.needsItem)); }
    if (d.kind === 'area' && !out.locked && r && r.banned && r.banned[d.target] !== undefined && r.hoursLeft > r.banned[d.target]) {
      out.locked = true; out.lockText = 'BANNED UNTIL TOMORROW';
    }
    return out;
  };

  G.useDoor = function (areaId, ch) {
    var a = G.areaDef(areaId), d = a && a.doors && a.doors[ch];
    var st = G.doorState(areaId, ch);
    if (!d || !st || !st.visible) return false;
    if (st.locked) { sfx('error'); toast(st.lockText || 'LOCKED', { icon: 'lock', color: '#f83800' }); return false; }
    var r = G.run;
    if (r && DCW.stage && DCW.stage.playerX) { try { r.areaX = DCW.stage.playerX(); } catch (e) { /* optional */ } }
    persist();
    switch (d.kind) {
      case 'level': sfx('door'); G.enterLevel(d.target); return true;
      case 'area': sfx('door'); G.goArea(d.target, d.entry || 'left'); return true;
      case 'inn': sfx('door'); G.enterInn(d.target); return true;
      case 'shop': sfx('door'); if (DCW.ui && DCW.ui.openShop) DCW.ui.openShop(d.target); return true;
      case 'club': sfx('door'); G.enterClub(d.target); return true;
      case 'stairs': G.takeStairs(); return true;
      case 'npc': G.talk(d.target); return true;
      case 'cinema': G.playCinema(d.target, function () { G.goArea(areaId, { x: r ? r.areaX : 32 }); }); return true;
    }
    return false;
  };

  G.edge = function (areaId, side) {
    var a = G.areaDef(areaId); var r = G.run;
    var e = a && a.edges && a.edges[side];
    if (!e) {
      toast(pickLine('edge') || 'NOTHING THAT WAY BUT 300,000 SQUARE KILOMETERS OF RUINS.', { icon: 'map' });
      return false;
    }
    if (r && r.wanted === areaId && a.guarded) {
      // fled the guards into the ruins: that village won't have you back for a day
      r.banned = r.banned || {};
      r.banned[areaId] = r.hoursLeft - 24;
      r.wanted = null;
      G.track('banned');
      toast(pickLine('ban') || 'YOU ESCAPED. THE VILLAGE WILL REMEMBER YOU FOR A DAY.', { icon: 'skull', color: '#f83800', time: 4 });
    }
    G.goArea(e.area, e.entry || (side === 'right' ? 'left' : 'right'));
    return true;
  };

  G.crime = function (areaId) {
    var r = G.run, a = G.areaDef(areaId);
    if (!r || !a || !a.guarded || G.clock().night) return false;
    if (r.wanted === areaId) return true;
    r.wanted = areaId;
    G.track('crime');
    sfx('guard_alarm');
    announce('CRIME!', { color: '#f83800', sub: pickLine('crime') || 'THE GUARDS ARE COMING. THERE IS NO JAIL.' });
    persist();
    return true;
  };

  G.talk = function (npcId) {
    var r = G.run;
    // an npc-bound event wins
    var ev = (D().events || []).filter(function (e) { return e.npc === npcId && !(r && r.events[e.id] && e.once !== false) && flagsOk(e.when); })[0];
    if (ev) { runEvent(ev, function () { resumeStreet(); }); return; }
    var lines = null;
    var t = (D().talk || {})[npcId];
    if (Array.isArray(t)) {
      for (var i = 0; i < t.length; i++) {
        var opt = t[i];
        if (opt && opt.lines) { if (flagsOk(opt.when)) { lines = opt.lines; break; } }
        else { lines = t; break; }
      }
    }
    if (!lines && r) {
      var a = G.areaDef(r.area);
      var n = a && (a.npcs || []).filter(function (x) { return x.id === npcId; })[0];
      if (n && n.lines) lines = n.lines;
    }
    if (!lines) lines = [{ who: '???', text: '...' }];
    say(lines.map(function (l) { return typeof l === 'string' ? { who: npcId.toUpperCase(), text: l } : l; }), {});
  };

  function resumeStreet() {
    var r = G.run; if (!r) return;
    if (DCW.stage && DCW.scene === DCW.stage.scene && !r.levelId) return; // still standing in the street
    G.goArea(r.area, r.areaX !== null && r.areaX !== undefined ? { x: r.areaX } : 'left');
  }

  // Story events for the street just entered. Runs the first match, then looks again.
  var eventBusy = false;
  G.areaEvents = function (areaId) {
    var r = G.run; if (!r || eventBusy) return false;
    var ev = (D().events || []).filter(function (e) {
      return e.area === areaId && !e.npc && !(r.events[e.id] && e.once !== false) && flagsOk(e.when);
    })[0];
    if (!ev) return false;
    eventBusy = true;
    runEvent(ev, function () {
      eventBusy = false;
      if (ev.level || ev.cinema) return;   // the event moved us somewhere else
      G.areaEvents(areaId);
    });
    return true;
  };
  function runEvent(ev, done) {
    var r = G.run;
    r.events[ev.id] = true; persist();
    var finish = function () {
      arr(ev.sets).forEach(function (f) { G.setFlag(f); });
      applyGives(ev.gives);
      applyQuest(ev.quest);
      persist();
      if (ev.level) { done(); G.enterLevel(ev.level); return; }
      if (ev.cinema) { done(); resumeStreet(); return; }
      done();
    };
    if (ev.cinema && (D().cinema || {})[ev.cinema]) G.playCinema(ev.cinema, finish);
    else if (ev.lines) say(ev.lines, { onDone: finish });
    else finish();
  }

  /* ---------------- levels ---------------- */
  G.enterLevel = function (levelId) {
    var r = G.run; if (!r) return;
    var lv = G.levelDef(levelId);
    if (!lv) { toast('LEVEL MISSING: ' + levelId, { color: '#f83800' }); return; }
    r.levelId = levelId; r.inInn = null; r.inClub = null; r.levelStartHp = r.hp;
    persist();
    var start = function () {
      var sc;
      if (lv.kind === 'rooms') sc = DCW.rooms && DCW.rooms.scene;
      else if (lv.kind === 'show') sc = DCW.show && DCW.show.scene;
      else sc = DCW.stage && DCW.stage.scene;
      go(sc || fallbackScene('LEVEL MODULE MISSING: ' + lv.kind, function () { G.levelCleared({ levelId: levelId }); }), { levelId: levelId });
    };
    if (typeof lv.intro === 'string' && (D().cinema || {})[lv.intro] && !r.events['intro_' + levelId]) {
      r.events['intro_' + levelId] = true;
      G.playCinema(lv.intro, start);
    } else start();
  };

  G.levelCleared = function (result) {
    var r = G.run; if (!r) return;
    result = result || {};
    var id = result.levelId || result.stageId || r.levelId;
    var lv = G.levelDef(id) || { reward: {} };
    var rewards = [];
    var first = !r.cleared[id];
    var rw = lv.reward || {};
    r.cleared[id] = true;
    sfx('fanfare');
    var xp = rw.xp ? (first ? rw.xp : Math.round(rw.xp / 3)) : 0;
    if (xp) { G.addXP(xp); rewards.push({ kind: 'xp', amount: xp }); }
    if (rw.gold) {
      var g = Array.isArray(rw.gold) ? U.randi(rw.gold[0], rw.gold[1]) : rw.gold;
      g = Math.round(g * actScale());
      if (!first) g = Math.round(g / 3);
      g = G.addGold(g); rewards.push({ kind: 'gold', amount: g });
    }
    if (first && rw.box) { G.giveLootBox(rw.box, lv.name || 'LEVEL CLEAR', true); rewards.push({ kind: 'box', tier: rw.box }); }
    // stage.js adds views live as you play; rooms and the show only report them at the end
    if (result.views) {
      var v = (lv.kind === 'rooms' || lv.kind === 'show' || result.addViews) ? G.addViews(result.views) : result.views;
      rewards.push({ kind: 'views', amount: v });
    }
    if (!result.damageTaken && lv.kind !== 'show' && lv.kind !== 'cinema') {
      G.track('no_damage_stage');
      rewards.push({ kind: 'views', amount: G.addViews(400 * G.act()), note: 'FLAWLESS' });
    }
    if (result.maxCombo >= 25 && first) { G.giveLootBox('silver', 'COMBO ' + result.maxCombo, true); rewards.push({ kind: 'box', tier: 'silver' }); }
    var bossId = result.boss || lv.boss;
    if (bossId && first && lv.kind !== 'rooms') {
      var b = (D().bosses || {})[bossId] || {};
      G.giveLootBox(b.loot || 'boss', b.name || 'BOSS', true); rewards.push({ kind: 'box', tier: b.loot || 'boss' });
      var un = b.unlock || {};
      if (un.skin) rewards.push({ kind: 'skin', id: un.skin, isNew: G.unlockSkin(un.skin, true) });
      G.track('boss:' + bossId);
    }
    if (first) {
      arr(lv.sets).forEach(function (f) { G.setFlag(f); });
      arr(lv.gives).forEach(function (gv) { if (gv && gv.item) { G.giveItem(gv.item, gv.n === undefined ? 1 : gv.n); rewards.push({ kind: 'item', id: gv.item, count: gv.n || 1 }); } else applyGives([gv]); });
      applyQuest(lv.quest);
    }
    G.track('level_clear'); G.track('clear:' + id);
    r.levelId = null;
    if (lv.act) r.act = Math.max(r.act, lv.act);
    r.hp = U.clamp(r.hp, 1, G.playerStats().maxHp);
    persist();
    G.advanceClock(first ? (lv.hours === undefined ? 3 : lv.hours) : 1);
    if (r.hoursLeft <= 0) return;
    var after = function () {
      var then = function () {
        if (lv.win) { G.win(); return; }
        if (lv.next && G.levelDef(lv.next)) { G.enterLevel(lv.next); return; }
        G.goArea(lv.thenArea || r.area, lv.thenArea ? (lv.thenEntry || 'left') : (r.areaX !== null && r.areaX !== undefined ? { x: r.areaX } : 'left'));
      };
      if (first && lv.outro) G.playCinema(lv.outro, then); else then();
    };
    var res = S().results;
    if (res && lv.kind !== 'show') go(res, { result: result, rewards: rewards, onDone: after });
    else after();
  };
  G.stageCleared = G.levelCleared; // book 1 shim

  G.playerDied = function (result) {
    var r = G.run; if (!r) return;
    result = result || {};
    r.deaths++; DCW.save.meta.deaths = (DCW.save.meta.deaths || 0) + 1;
    r.lastDeath = result;
    r.diedIn = r.levelId || null;
    if (result.cause === 'guard') r.wanted = null;
    G.track('death');
    persist();
    go(S().death || fallbackScene('YOU HAVE DIED', function () { G.revive() || G.endRun(); }), { result: result });
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
    G.advanceClock(2);
    if (r.hoursLeft <= 0) return true;
    if (r.diedIn && G.levelDef(r.diedIn)) G.enterLevel(r.diedIn);
    else G.goArea(r.area, 'left');
    if (line) setTimeout(function () { toast(line, { icon: 'heart', color: '#f878f8', time: 4 }); }, 700);
    return true;
  };
  G.endRun = function () { DCW.save.run = null; persist(); G.toTitle(); };

  G.fleeLevel = function () {
    var r = G.run; if (!r) return;
    G.track('flee');
    r.levelId = null; persist();
    var line = pickLine('flee');
    G.advanceClock(1);
    if (r.hoursLeft <= 0) return;
    G.goArea(r.area, r.areaX !== null && r.areaX !== undefined ? { x: r.areaX } : 'left');
    if (line) setTimeout(function () { toast(line, { icon: 'skull', time: 4 }); }, 700);
  };
  G.fleeStage = G.fleeLevel; // book 1 shim

  /* ---------------- inns, clubs, crafting ---------------- */
  G.innDef = function (id) { return (D().inns || {})[id] || { name: 'INN', price: 10 }; };
  G.innPrice = function (id) { var r = G.run; return Math.round((G.innDef(id || (r && r.inInn)).price || 10) * actScale()); };
  G.pickClass = function (race, klass) {
    var r = G.run; if (!r) return;
    r.race = race || r.race; r.klass = klass || r.klass;
    G.track('class_pick');
    persist();
  };
  G.enterInn = function (innId) {
    var r = G.run; if (!r) return;
    r.inInn = innId || r.inInn || 'pug'; r.levelId = null; persist();
    G.track('inn');
    go(S().inn || S().safeRoom || fallbackScene('THE INN', function () { G.heal(999); G.leaveInn(); }), { innId: r.inInn });
  };
  G.enterSafeRoom = function () { G.enterInn((G.run && G.run.inInn) || 'pug'); }; // book 1 shim
  G.leaveInn = function () {
    var r = G.run; if (!r) return;
    r.inInn = null; persist();
    G.goArea(r.area, r.areaX !== null && r.areaX !== undefined ? { x: r.areaX } : 'left');
  };
  G.leaveSafeRoom = G.leaveInn; // book 1 shim
  G.inSafeRoom = function () {
    var r = G.run, sc = S();
    return !!(r && r.inInn && (DCW.scene === sc.inn || DCW.scene === sc.safeRoom));
  };
  G.rest = function (innId, until) {
    var r = G.run; if (!r) return { ok: false, msg: 'NO RUN' };
    var inn = G.innDef(innId || r.inInn);
    if (until === 'night') {
      if (G.clock().night) return { ok: false, msg: 'IT IS ALREADY NIGHT' };
      G.advanceClock(hoursUntil(19));
      G.track('rest');
      return { ok: true, msg: 'YOU DRINK UNTIL DARK. NIGHT FALLS.' };
    }
    var price = G.innPrice(innId || r.inInn);
    if (r.gold < price) { sfx('error'); return { ok: false, msg: 'NOT ENOUGH GOLD (' + price + ')' }; }
    r.gold -= price;
    G.advanceClock(hoursUntil(7));
    r.hp = G.playerStats().maxHp;
    G.track('rest');
    sfx('heal');
    persist();
    return { ok: true, msg: 'YOU SLEEP. ' + price + ' GOLD. MORNING.' };
  };
  G.craft = function (recipeId) {
    var r = G.run, rc = (D().recipes || {})[recipeId];
    if (!r || !rc) return { ok: false, msg: 'UNKNOWN RECIPE' };
    var needs = rc.needs || {};
    for (var k in needs) if (needs.hasOwnProperty(k) && G.itemCount(k) < needs[k]) { sfx('error'); return { ok: false, msg: 'NEEDS ' + needs[k] + ' ' + G.itemName(k) }; }
    if (rc.gold && r.gold < rc.gold) { sfx('error'); return { ok: false, msg: 'NEEDS ' + rc.gold + ' GOLD' }; }
    for (k in needs) if (needs.hasOwnProperty(k)) G.useItem(k, needs[k]);
    if (rc.gold) r.gold -= rc.gold;
    var gives = rc.gives || {};
    for (k in gives) if (gives.hasOwnProperty(k)) G.giveItem(k, gives[k]);
    G.track('craft');
    sfx('buy');
    persist();
    return { ok: true, msg: 'CRAFTED ' + (rc.name || recipeId) };
  };
  G.enterClub = function (clubId) {
    var r = G.run; if (!r) return;
    r.inClub = clubId || 'desperado'; persist();
    G.track('club');
    go(S().club || fallbackScene('THE DESPERADO CLUB', function () { G.leaveClub(); }), { clubId: r.inClub });
  };
  G.leaveClub = function () {
    var r = G.run; if (!r) return;
    r.inClub = null; persist();
    G.goArea(r.area, r.areaX !== null && r.areaX !== undefined ? { x: r.areaX } : 'left');
  };

  /* ---------------- cinema, stairs, endings ---------------- */
  G.playCinema = function (id, onDone) {
    onDone = onDone || function () {};
    var shots = id && (D().cinema || {})[id];
    if (!shots || !shots.length) { onDone(); return; }
    var sc = S().cinema;
    if (sc) go(sc, { id: id, shots: shots, onDone: onDone });
    else {
      var lines = [];
      shots.forEach(function (s) { (s.lines || []).forEach(function (l) { lines.push(l); }); });
      say(lines, { onDone: onDone });
    }
  };
  G.takeStairs = function () {
    var r = G.run; if (!r) return;
    var doIt = function () {
      sfx('stairs');
      G.achieveByEvent('early');
      G.track('early');
      persist();
      go(S().ending || fallbackScene('YOU LEFT EARLY. COWARD.', function () { G.quitToTitle(); }), { kind: 'early' });
    };
    var text = pickLine('earlyStairs') || 'TAKE THE STAIRS NOW? THE FLOOR IS STILL GOING. YOU WILL MISS EVERYTHING.';
    if (DCW.ui && DCW.ui.confirm) DCW.ui.confirm(text, doIt, {}); else doIt();
  };
  G.achieveByEvent = function () { /* achievements key off track(); kept for clarity */ };
  G.win = function () {
    var r = G.run, m = DCW.save.meta;
    if (r) r.won = true;
    m.wins = (m.wins || 0) + 1;
    G.unlockSkin('carl_primal', true);
    G.track('win');
    persist();
    go(S().ending || fallbackScene('YOU MADE IT TO THE FOURTH FLOOR.', function () { G.quitToTitle(); }), { kind: 'win' });
  };
  G.quitToTitle = function () {
    var r = G.run;
    if (r && r.won) DCW.save.run = null;
    persist();
    G.toTitle();
  };
  G.tick = function (dt) { var r = G.run; if (r) r.totalTime = (r.totalTime || 0) + dt; };

  /* ---------------- stats ---------------- */
  function skinPerk() {
    var sk = (D().skins || {})[DCW.save.equipped.skin];
    return (sk && sk.perk) || {};
  }
  function mul(v) { if (!v) return 1; return v < 1 ? 1 + v : v; }
  function Lof(r) { return Math.max(1, (r.level || 13) - 12); }
  G.xpNeed = function (level) { var L = Math.max(1, (level || 13) - 12); return Math.round(25 * Math.pow(L, 1.5)); };
  G.playerStats = function () {
    var r = G.run || makeRun();
    var b = r.bonus || {};
    var st = { str: r.stats.str + (b.str || 0), con: r.stats.con + (b.con || 0), dex: r.stats.dex + (b.dex || 0), int: r.stats.int + (b.int || 0) };
    var L = Lof(r), p = skinPerk();
    var dmg = 3 + (st.str - 5) + Math.floor((L - 1) / 2) + (p.dmg || 0);
    dmg = Math.max(1, dmg);
    var fb = !!(r.flags && r.flags.freeballing);
    return {
      maxHp: Math.max(8, 16 + (st.con - 4) * 2 + (L - 1) * 2 + (b.hp || 0) + (p.hp || 0)),
      dmg: dmg,
      kickDmg: Math.round(dmg * 1.5) * (fb ? 2 : 1),
      crit: Math.min(0.6, 0.05 + (st.dex - 4) * 0.02 + (p.crit || 0)),
      speedMul: (1 + (st.dex - 4) * 0.03) * mul(p.speed),
      def: p.def || 0,
      hobDmg: 10 + L * 2, dynDmg: 22 + L * 3, jugDmg: 8 + L * 2,
      bombDmg: 22 + L * 3, bombRadius: 40,          // book 1 names, = dynamite
      missileDmg: 3 + Math.floor(st.int / 2) + Math.floor((L - 1) / 2),
      biteDmg: Math.round((2 + L) * (r.flags && r.flags.mongo_big ? 1.8 : 1)),
      compPower: 1 + (st.int - 4) * 0.15 + (L - 1) * 0.04,
      goldMul: mul(p.gold), viewMul: mul(p.views),
      extraJump: !!p.doubleJump, skinPerk: p,
      freeballing: fb, xistera: !!(r.flags && r.flags.xistera), fangCaps: !!(r.flags && r.flags.fang_caps),
      mongoBig: !!(r.flags && r.flags.mongo_big),
      party: G.party(),
      stats: st
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
      toast('LEVEL ' + r.level + '! SPEND POINTS AT AN INN', { title: 'LEVEL UP', icon: 'star', color: '#f8b800' });
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
  var FAN_TIERS = [5000, 20000, 60000, 150000, 400000, 1000000, 2500000, 6000000, 15000000];
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
  G.heal = function (n) { var r = G.run; if (r) r.hp = Math.min(G.playerStats().maxHp, r.hp + n); };
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
  var TIER_NAMES = { bronze: 'BRONZE', silver: 'SILVER', gold: 'GOLD', platinum: 'PLATINUM', legendary: 'LEGENDARY', fan: 'FAN', boss: 'BOSS', celestial: 'CELESTIAL' };
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
    var owned = DCW.save.unlocks.skins;
    return Object.keys(D().skins || {}).filter(function (id) { return owned.indexOf(id) < 0 && !(D().skins[id] || {}).noBox; });
  }
  function resolveReward(rw) {
    var r = G.run;
    rw = rw || { kind: 'gold', min: 5, max: 15 };
    switch (rw.kind) {
      case 'gold': {
        var amt = rw.amount || U.randi(rw.min || 5, rw.max || rw.min || 15);
        amt = Math.round(amt * actScale());
        r.gold += amt;
        return { kind: 'gold', amount: amt };
      }
      case 'item': {
        var c = rw.count || rw.n || 1;
        var id = rw.id === 'bomb' ? 'dyn' : rw.id;
        G.giveItem(id, c);
        return { kind: 'item', id: id, count: c };
      }
      case 'skin': {
        var sid = rw.id;
        if (rw.any || !sid) { var pool = lockedSkins(); sid = pool.length ? U.pick(pool) : null; }
        if (!sid || DCW.save.unlocks.skins.indexOf(sid) >= 0) {
          var conv = Math.round(80 * actScale()); r.gold += conv;
          return { kind: 'gold', amount: conv, converted: true };
        }
        G.unlockSkin(sid, true);
        return { kind: 'skin', id: sid, isNew: true };
      }
      case 'companion': { var cg = Math.round(80 * actScale()); r.gold += cg; return { kind: 'gold', amount: cg, converted: true }; }
      case 'stat': {
        var keys = ['str', 'con', 'dex', 'int'];
        var stat = (rw.any || !rw.stat) ? U.pick(keys) : rw.stat;
        var a = rw.amount || 1;
        r.stats[stat] += a;
        if (stat === 'con') r.hp += 2 * a;
        return { kind: 'stat', stat: stat, amount: a };
      }
      case 'xp': { var x = Math.round((rw.amount || 30) * actScale()); G.addXP(x); return { kind: 'xp', amount: x }; }
      case 'hp': { var h = rw.amount || 1; r.bonus.hp += h; r.hp += h; return { kind: 'hp', amount: h }; }
      case 'revival': { var n = rw.count || 1; r.revivals += n; return { kind: 'revival', count: n }; }
      case 'box': { G.giveLootBox(rw.tier || 'bronze', rw.from || 'LOOT', true); return { kind: 'box', tier: rw.tier || 'bronze' }; }
      case 'views': { return { kind: 'views', amount: G.addViews(rw.amount || 1000) }; }
      case 'nothing': return { kind: 'nothing', text: rw.text || 'ABSOLUTELY NOTHING' };
      default: return { kind: 'gold', amount: 0 };
    }
  }
  G.resolveReward = resolveReward;
  G.openLootBox = function (index) {
    var r = G.run; if (!r || !r.boxes.length || !G.inSafeRoom()) return [];
    index = U.clamp(index || 0, 0, r.boxes.length - 1);
    var box = r.boxes.splice(index, 1)[0];
    var tables = D().lootTables || {};
    var table = tables[box.tier] || tables.bronze || { rolls: 2, entries: [[{ kind: 'gold', min: 10, max: 30 }, 1]] };
    var out = [];
    var rolls = table.rolls || 2;
    for (var i = 0; i < rolls; i++) out.push(resolveReward(U.weighted(table.entries || [[{ kind: 'gold', min: 10, max: 30 }, 1]])));
    var gu = table.guaranteed || table.guarantee;
    if (gu) arr(gu).forEach(function (g) { out.push(resolveReward(g)); });
    DCW.save.meta.boxesOpened = (DCW.save.meta.boxesOpened || 0) + 1;
    r.hp = Math.min(r.hp, G.playerStats().maxHp);
    G.track('box_open'); G.track('box_open:' + box.tier);
    persist();
    return out;
  };
  G.unlockSkin = function (id, quiet) {
    var list = DCW.save.unlocks.skins;
    if (!id || list.indexOf(id) >= 0) return false;
    list.push(id); persist();
    var sk = (D().skins || {})[id];
    if (!quiet) { sfx('unlock'); toast((sk && sk.name) || id, { title: 'NEW SKIN', icon: 'star', color: '#f8b800' }); }
    return true;
  };
  G.equip = function (kind, id) {
    var s = DCW.save;
    if (kind !== 'skin' || s.unlocks.skins.indexOf(id) < 0) { sfx('error'); return false; }
    s.equipped.skin = id;
    if (s.run) s.run.hp = Math.min(s.run.hp, G.playerStats().maxHp);
    G.track('skin_equip');
    persist();
    return true;
  };

  /* ---------------- shops ---------------- */
  function shopItem(shopId, itemId) {
    var sh = (D().shops || {})[shopId];
    return sh && (sh.items || []).filter(function (s) { return s.id === itemId; })[0];
  }
  G.price = function (shopId, itemId) {
    var it = shopItem(shopId, itemId); if (!it) return 0;
    return Math.round((it.price || 0) * (1 + (G.act() - 1) * 0.25));
  };
  G.buy = function (shopId, itemId) {
    var r = G.run, it = shopItem(shopId, itemId);
    if (!r || !it) return { ok: false, msg: 'SOLD OUT' };
    var p = G.price(shopId, itemId);
    var key = shopId + ':' + itemId;
    r.bought = r.bought || {};
    if (it.limit && (r.bought[key] || 0) >= it.limit) { sfx('error'); return { ok: false, msg: 'SOLD OUT' }; }
    if (r.gold < p) { sfx('error'); return { ok: false, msg: 'NOT ENOUGH GOLD' }; }
    r.gold -= p;
    r.bought[key] = (r.bought[key] || 0) + 1;
    var got = arr(it.give || { item: it.id, n: 1 }).map(function (g) {
      if (g.item) { G.giveItem(g.item, g.n === undefined ? 1 : g.n); return { kind: 'item', id: g.item, count: g.n || 1 }; }
      if (g.potion) { G.giveItem('potion', g.potion); return { kind: 'item', id: 'potion', count: g.potion }; }
      if (g.skin) { G.unlockSkin(g.skin, true); return { kind: 'skin', id: g.skin, isNew: true }; }
      if (g.box) { G.giveLootBox(g.box, 'PURCHASE', true); return { kind: 'box', tier: g.box }; }
      if (g.flag) { G.setFlag(g.flag); return { kind: 'flag', id: g.flag }; }
      return resolveReward(g);
    });
    sfx('buy');
    G.track('shop'); G.track('shop:' + shopId);
    persist();
    return { ok: true, msg: 'BOUGHT ' + (it.name || G.itemName(itemId)), rewards: got };
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
    if (DCW.ui && DCW.ui.achievement) DCW.ui.achievement(a);
    else toast(a.name, { title: 'NEW ACHIEVEMENT!', icon: 'star', color: '#f8d878', time: 3.5 });
    if (G.run && a.box !== null) G.giveLootBox(a.box || 'bronze', 'ACHIEVEMENT: ' + a.name, true);
    var un = a.unlock;
    if (typeof un === 'string') un = { skin: un };
    if (un && un.skin) G.unlockSkin(un.skin);
    persist();
    return true;
  };

  /* ---------------- book 1 save import ---------------- */
  G.importLegacy = function () {
    var old = DCW.legacy && DCW.legacy.book1;
    var s = DCW.save;
    if (!old || s.meta.imported) return null;
    var skins = ((old.unlocks && old.unlocks.skins) || []).filter(function (id) { return (D().skins || {})[id] && s.unlocks.skins.indexOf(id) < 0; });
    skins.forEach(function (id) { s.unlocks.skins.push(id); });
    var achs = Object.keys((old.meta && old.meta.achievements) || {}).length;
    var wins = (old.meta && old.meta.wins) || 0;
    var L = D().legacy || {};
    var boxes = [L.veteranBox || 'gold'];
    if (achs >= 20) boxes.push('platinum');
    if (wins > 0) boxes.push(L.championBox || 'legendary');
    s.meta.legacyBoxes = boxes;
    s.meta.imported = { skins: skins.length, achievements: achs, wins: wins };
    s.meta.legacyTitle = L.title || 'BOOK 1 VETERAN';
    G.track('import');
    persist();
    return { skins: skins, achievements: achs, wins: wins, boxes: boxes, title: s.meta.legacyTitle };
  };

  /* ---------------- debug entry ---------------- */
  // ?debug&level=ID | &area=ID | &cinema=ID | &scene=title|classPick|inn|club|map|ending|death|results
  // extras: &act=N (stats for that act), &night, &flags=a,b,c, &god
  G.debugStart = function () {
    var p = DCW.params, s = DCW.save;
    s.run = makeRun();
    var r = s.run;
    var act = parseInt(p.get('act') || '0', 10);
    var lvId = p.get('level');
    var lv = lvId && G.levelDef(lvId);
    if (!act) act = (lv && lv.act) || 1;
    r.act = act;
    var target = act === 1 ? 13 : act === 2 ? 18 : 22;
    for (var i = r.level; i < target; i++) { r.level++; r.stats[['str', 'con', 'dex', 'int'][i % 4]]++; }
    r.hp = G.playerStats().maxHp; r.gold = 300 * act; r.potions = 3;
    r.items = { jug: 4, hob: 6, dyn: 4, smoke: 3, moonshine: 1 };
    if (act >= 2) ['freeballing', 'xistera', 'fang_caps', 'act2'].forEach(function (f) { r.flags[f] = true; });
    if (act >= 3) ['katia_joined', 'mongo_big', 'act3'].forEach(function (f) { r.flags[f] = true; });
    (p.get('flags') || '').split(',').filter(Boolean).forEach(function (f) { r.flags[f] = true; });
    if (p.has('night')) r.hour = 21;
    if (p.has('god')) r.god = true;
    var areaId = p.get('area');
    if (areaId) r.area = areaId;
    persist();
    var scene = p.get('scene');
    var sc = S();
    if (scene) {
      if (scene === 'inn') { r.inInn = p.get('inn') || 'pug'; DCW.setScene(sc.inn || sc.safeRoom, { innId: r.inInn }); return; }
      if (scene === 'club') { r.inClub = 'desperado'; DCW.setScene(sc.club, { clubId: 'desperado' }); return; }
      if (scene === 'map') { DCW.setScene(DCW.stage.scene, { areaId: r.area, entry: 'left' }); setTimeout(function () { if (DCW.ui.openMap) DCW.ui.openMap(); }, 300); return; }
      if (scene === 'ending') { DCW.setScene(sc.ending, { kind: p.get('kind') || 'win' }); return; }
      if (scene === 'death') { DCW.setScene(sc.death, { result: { cause: p.get('cause') || 'TESTING' } }); return; }
      if (scene === 'classPick') { DCW.setScene(sc.classPick, { onDone: function () { G.goArea(r.area, 'left'); } }); return; }
      if (scene === 'results') { DCW.setScene(sc.results, { result: { levelId: 'a1_lemurs', kills: 12, time: 95, damageTaken: 3, maxCombo: 14 }, rewards: [{ kind: 'xp', amount: 40 }, { kind: 'box', tier: 'silver' }], onDone: function () { G.toTitle(); } }); return; }
      if (sc[scene]) { DCW.setScene(sc[scene], {}); return; }
      DCW.setScene(sc.title, {}); return;
    }
    var cin = p.get('cinema');
    if (cin) { G.playCinema(cin, function () { G.toTitle(); }); return; }
    if (lv) { r.levelId = lvId; persist(); DCW.setScene(lv.kind === 'rooms' ? DCW.rooms.scene : lv.kind === 'show' ? DCW.show.scene : DCW.stage.scene, { levelId: lvId }); return; }
    if (areaId) { DCW.setScene(DCW.stage.scene, { areaId: areaId, entry: 'left' }); return; }
    G.toTitle(true);
  };

  // debug key 8 flips day/night anywhere
  window.addEventListener('keydown', function (e) { if (DCW.debug && e.code === 'Digit8') G.debugFlipPhase(); });
})();

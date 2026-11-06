/* Test fixtures for stage.js: a tiny DCW.data, a DCW.game stub and a DCW.ui stub.
   Loaded by tools/stage_test.html only. */
(function () {
  'use strict';
  var DCW = window.DCW = window.DCW || {};
  function rows(list) {
    var w = list[0].length;
    list.forEach(function (r, i) { if (r.length !== w) console.error('fixture row ' + i + ' width ' + r.length + ' != ' + w + ': ' + r); });
    if (list.length !== 12) console.error('fixture chunk has ' + list.length + ' rows');
    return { rows: list };
  }
  var E40 = '........................................';
  DCW.data = {
    floors: [{ n: 1, name: 'TEST FLOOR', theme: 'sewer', music: 'floor1', par: 600, sequence: ['t_walk'], overworld: null }],
    stages: {
      t_walk: { id: 't_walk', name: 'TEST WALK', floor: 1, theme: 'sewer', kind: 'main',
        chunks: { start: 'tA', pool: ['tB'], count: 1, end: 'end_door' },
        enemies: [['rat', 1]], elite: [['goblin_brute', 1]], flyers: [['bat', 1]],
        signs: ['WELCOME TO THE TEST SEWER. PLEASE DO NOT LICK THE WALLS.'], intro: 'TEST INTRO LINE.' },
      t_empty: { id: 't_empty', name: 'TEST ARENA', floor: 1, theme: 'cave', kind: 'main',
        chunks: { start: 'tFlat', pool: ['tFlat'], count: 2, end: 'end_door' }, enemies: [['rat', 1]] },
      t_dark: { id: 't_dark', name: 'TEST DARK', floor: 1, theme: 'cave', kind: 'side', dark: true,
        chunks: { start: 'tA', pool: ['tB'], count: 1, end: 'end_door' }, enemies: [['rat', 1]], elite: [['goblin_brute', 1]], flyers: [['bat', 1]] },
      t_boss: { id: 't_boss', name: 'TEST BOSS', floor: 1, theme: 'sewer', kind: 'boss', boss: 'tboss',
        chunks: { start: 'tStart', pool: [], count: 0, end: 'tArena' }, enemies: [['rat', 1]] },
      t_boss2: { id: 't_boss2', name: 'TEST FLYER BOSS', floor: 1, theme: 'castle', kind: 'boss', boss: 'tflyer',
        chunks: { start: 'tStart', pool: [], count: 0, end: 'tArena' }, enemies: [['bat', 1]] }
    },
    chunks: {
      tA: rows([
        E40, E40, E40, E40, E40,
        '................................HXXXX...',
        '................................H.......',
        '..........====..................H.......',
        '...n.....................b......H....c..',
        '.P......o.o.o....$..............H.......',
        '########################################',
        '########################################']),
      tB: rows([
        E40, E40, E40, E40, E40, E40, E40, E40, E40,
        '...e..........<.........................',
        '##########......########...#############',
        '##########......########...#############']),
      tStart: rows([
        '................', '................', '................', '................', '................', '................',
        '................', '................', '................',
        '..P.............',
        '################', '################']),
      tFlat: rows([E40, E40, E40, E40, E40, E40, E40, E40, E40, E40,
        '########################################', '########################################']),
      end_door: rows([
        '................', '................', '................', '................', '................', '................',
        '................', '................', '................',
        '........D.......',
        '################', '################']),
      tArena: rows([
        'X..................................X',
        'X..................................X',
        'X..................................X',
        'X..................................X',
        'X..................................X',
        'X..................................X',
        'X.....====..............====.......X',
        '...................................X',
        '...................................X',
        '......................K............X',
        '####################################',
        '####################################'])
    },
    enemies: {
      rat: { name: 'TUTORIAL RAT', hp: 3, dmg: 1, speed: 28, w: 12, h: 8, ai: 'walker', xp: 2, gold: [0, 2], sprite: 'rat' },
      roach: { name: 'ROACH', hp: 2, dmg: 1, speed: 40, w: 10, h: 6, ai: 'walker', xp: 1, gold: [0, 1], sprite: 'roach' },
      goblin: { name: 'GOBLIN', hp: 5, dmg: 1, speed: 34, w: 12, h: 16, ai: 'chaser', xp: 3, gold: [1, 3], sprite: 'goblin' },
      grub: { name: 'GRUB', hp: 4, dmg: 1, speed: 30, w: 14, h: 10, ai: 'jumper', xp: 3, gold: [0, 2], sprite: 'grub' },
      bat: { name: 'BAT', hp: 2, dmg: 1, speed: 40, w: 12, h: 8, ai: 'flyer', xp: 2, gold: [0, 1], sprite: 'bat' },
      goblin_archer: { name: 'ARCHER', hp: 4, dmg: 1, speed: 26, w: 12, h: 16, ai: 'shooter', xp: 4, gold: [1, 3], sprite: 'goblin_archer', projectile: 'arrow', shootEvery: 1.5 },
      goblin_brute: { name: 'BRUTE', hp: 9, dmg: 2, speed: 22, w: 16, h: 20, ai: 'charger', xp: 6, gold: [2, 5], sprite: 'goblin_brute', chargeSpeed: 170, kb: 0.5 },
      gargoyle: { name: 'GARGOYLE', hp: 6, dmg: 1, speed: 0, w: 14, h: 14, ai: 'turret', xp: 4, gold: [1, 2], sprite: 'gargoyle', projectile: 'bolt', shootEvery: 1.6 },
      cultist: { name: 'CULTIST NEST', hp: 8, dmg: 1, speed: 0, w: 14, h: 18, ai: 'spawner', xp: 5, gold: [2, 4], sprite: 'cultist', spawn: 'roach', spawnEvery: 2 },
      steam_goblin: { name: 'STEAM GOBLIN', hp: 5, dmg: 1, speed: 24, w: 12, h: 16, ai: 'bomber', xp: 4, gold: [1, 3], sprite: 'steam_goblin', projectile: 'bottle', shootEvery: 1.8 },
      swamp_troll: { name: 'SWAMP TROLL', hp: 8, dmg: 2, speed: 30, w: 18, h: 20, ai: 'hopper', xp: 6, gold: [2, 4], sprite: 'swamp_troll', jump: 220 }
    },
    projectiles: {
      arrow: { sprite: 'arrow', w: 8, h: 3, speed: 150, dmg: 1, gravity: 0, life: 3 },
      rock: { sprite: 'rock', w: 6, h: 6, speed: 120, dmg: 1, gravity: 300, life: 3 },
      fireball: { sprite: 'fireball', w: 8, h: 8, speed: 110, dmg: 2, gravity: 0, life: 3 },
      bolt: { sprite: 'bolt', w: 6, h: 4, speed: 140, dmg: 1, gravity: 0, life: 3 },
      bottle: { sprite: 'bottle', w: 6, h: 8, speed: 120, dmg: 1, gravity: 400, life: 3 },
      laser_orb: { sprite: 'laser_orb', w: 8, h: 8, speed: 100, dmg: 2, gravity: 0, life: 4 }
    },
    bosses: {
      tboss: { name: 'THE TEST HOARDER', title: 'MOTHER OF UNIT TESTS', hp: 320, dmg: 2, w: 44, h: 30, sprite: 'hoarder', xp: 80, gold: [40, 60], flying: false,
        phases: [
          { below: 1.0, speed: 40, pattern: ['walk:1', 'idle:0.5', 'charge', 'jump_slam', 'shoot:rock:3', 'spread:fireball:5', 'rain:rock:5'] },
          { below: 0.66, speed: 55, pattern: ['spawn:rat:2', 'teleport', 'laser', 'shockwave', 'summon_spikes'] },
          { below: 0.33, speed: 70, pattern: ['swoop', 'hover:1', 'charge', 'laser', 'spread:laser_orb:7'] }
        ],
        intro: ['I AM THE TEST BOSS.', 'PREPARE TO BE ASSERTED.'], defeat: 'TEST BOSS DOWN. ALL GREEN.' },
      tflyer: { name: 'TEST SKY HAG', hp: 60, dmg: 2, w: 40, h: 32, sprite: 'tidemother', xp: 80, gold: [40, 60], flying: true,
        phases: [
          { below: 1.0, speed: 50, pattern: ['hover:1', 'swoop', 'shoot:bolt:3', 'jump_slam', 'charge', 'teleport', 'laser', 'spawn:bat:2', 'summon_spikes', 'shockwave', 'rain:rock:4', 'walk:1', 'idle:0.5', 'spread:fireball:3'] }
        ],
        intro: 'SKY HAG ONLINE.', defeat: 'SKY HAG OFFLINE.' }
    },
    companions: {
      donut: { name: 'PRINCESS DONUT', ability: 'missile', cooldown: 1.2, power: 2, special: { name: 'MAGIC MISSILE BARRAGE' }, sprite: 'donut' },
      mongo: { name: 'MONGO', ability: 'bite', cooldown: 1.2, power: 3, special: { name: 'MONGO RAMPAGE' }, sprite: 'mongo' },
      katia: { name: 'KATIA', ability: 'shield', cooldown: 6, power: 1, special: { name: 'IRON WALL' }, sprite: 'katia' },
      zev: { name: 'ZEV', ability: 'magnet', cooldown: 2, power: 1, special: { name: 'PRESS CONFERENCE' }, sprite: 'zev' },
      squeaks: { name: 'SIR SQUEAKS', ability: 'fetch', cooldown: 2, power: 1, special: { name: 'RAT SWARM' }, sprite: 'squeaks' }
    },
    ai: { bigCombo: ['THE CROWD GOES MILD.'], lowHp: ['YOU LOOK TERRIBLE. RATINGS ARE UP.'] }
  };

  /* ---------------- DCW.game stub ---------------- */
  var log = DCW.testLog = { calls: [], tracked: {}, say: [], toast: [], announce: [], pause: [], music: [], sfx: {} };
  function makeRun() {
    return { floor: 1, cleared: {}, hp: 12, level: 1, xp: 0, statPoints: 0, stats: { str: 3, con: 3, dex: 3, int: 3 }, bonus: { hp: 2 },
      gold: 0, bombs: 3, potions: 1, views: 0, boxes: [], revivals: 3, floorTime: 0, kills: 0, seed: 777 };
  }
  var G = DCW.game = {
    init: function () {
      DCW.save.run = makeRun();
      var p = DCW.params;
      if (p.get('comp')) DCW.save.equipped.companion = p.get('comp');
      DCW.setScene(DCW.stage.scene, { stageId: p.get('stage') || 't_walk' });
    },
    newRun: makeRun,
    floorDef: function () { return DCW.data.floors[0]; },
    playerStats: function () {
      var r = DCW.save.run, st = r.stats, lv = r.level, dmg = 2 + (st.str - 3) + Math.floor((lv - 1) / 2);
      return { maxHp: 10 + (st.con - 3) * 2 + (lv - 1) + r.bonus.hp, dmg: dmg, kickDmg: Math.round(dmg * 1.5), crit: 0.04 + (st.dex - 3) * 0.02,
        speedMul: 1 + (st.dex - 3) * 0.03, bombDmg: 8 + lv * 2 + (st.str - 3), bombRadius: 28, compPower: 1 + (st.int - 3) * 0.15 + (lv - 1) * 0.04,
        def: 0, goldMul: 1, viewMul: 1, extraJump: !!r.extraJump, skinPerk: null };
    },
    xpNeed: function (l) { return Math.round(18 * Math.pow(l, 1.5)); },
    addXP: function (n) { DCW.save.run.xp += n; },
    addGold: function (n) { DCW.save.run.gold += n; return n; },
    addViews: function (n) { DCW.save.run.views += n; return n; },
    heal: function (n) { var r = DCW.save.run; r.hp = Math.min(G.playerStats().maxHp, r.hp + n); },
    damageTaken: function (n) { var r = DCW.save.run; r.hp = Math.max(0, r.hp - n); },
    usePotion: function () { var r = DCW.save.run; if (r.potions <= 0) return false; r.potions--; G.heal(6); G.track('potion'); return true; },
    giveLootBox: function (tier, from) { DCW.save.run.boxes.push({ tier: tier, from: from }); },
    track: function (e, n) { log.tracked[e] = (log.tracked[e] || 0) + (n || 1); },
    stageCleared: function (r) { log.calls.push(['stageCleared', r]); },
    playerDied: function (r) { log.calls.push(['playerDied', r]); },
    tick: function (dt) { DCW.save.run.floorTime += dt; }
  };
  Object.defineProperty(G, 'run', { get: function () { return DCW.save ? DCW.save.run : null; } });

  /* ---------------- DCW.ui stub ---------------- */
  DCW.ui = {
    init: function () {}, update: function () {}, draw: function () {},
    blocking: function () { return false; },
    say: function (lines) { log.say.push(lines); },
    toast: function (t) { log.toast.push(t); },
    announce: function (t) { log.announce.push(t); },
    openPause: function (o) { log.pause.push(o); },
    drawHUD: function (ctx, h) {
      DCW.text('♥' + h.hp + '/' + h.maxHp + ' ●' + h.gold + ' B' + h.bombs + ' LV' + h.level + (h.combo > 1 ? ' ' + h.combo + 'HIT' : ''), 4, 4, '#fcfcfc');
      DCW.bar(4, 14, 50, 3, h.special, '#f8d878');
      if (h.bossHp !== null) { DCW.text(h.bossName, 160, 156, '#fcfcfc', { align: 'center' }); DCW.bar(60, 168, 200, 4, h.bossHp, '#f83800'); }
    }
  };
  /* ---------------- DCW.audio stub (records) ---------------- */
  DCW.audio = {
    sfx: function (n) { log.sfx[n] = (log.sfx[n] || 0) + 1; },
    music: function (t) { log.music.push(t); }
  };
})();

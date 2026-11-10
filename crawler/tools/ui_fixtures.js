/* UI test fixtures: minimal DCW.data + a DCW.game stub implementing the DESIGN.md API.
   Loaded by tools/ui_test.html instead of data.js/game.js. */
(function () {
  'use strict';
  var DCW = window.DCW = window.DCW || {};
  window.__calls = [];
  function log(name, args) { window.__calls.push(name + '(' + [].slice.call(args).map(function (a) { return JSON.stringify(a); }).join(',') + ')'); }

  var owMap = [
    '##############################',
    '#....,,,,....#######....TT..X#',
    '#.1..,,,,....#######.....T...#',
    '#....=========.........B.....#',
    '#....=..TT...=..~~~~.........#',
    '#,,,,=..TT...=..~~~~...###...#',
    '#,,,,=.......=..~~~~...#2#...#',
    '#....=...S...=.........#.#...#',
    '#....=.......================#',
    '#.P..=...,,,,,,,,..A.......3.#',
    '#....=...,,,,,,,,............#',
    '#....=...TTT......####...TT..#',
    '#....=............####.......#',
    '#....==============..........#',
    '#.........T.......,,,,,,.....#',
    '#.....###.....TT..,,,,,,..~~.#',
    '#.....###.........,,,,,,..~~.#',
    '##############################'
  ];
  DCW.data = {
    floors: [
      { n: 1, name: 'THE TUTORIAL DUNGEON', tagline: 'MIND THE RATS. AND THE OTHER RATS.', theme: 'sewer', music: 'floor1',
        intro: ['WELCOME TO FLOOR ONE, CRAWLERS! IT IS DAMP, IT SMELLS, AND EVERYTHING DOWN HERE WANTS TO EAT YOU.', 'HAVE FUN!'],
        sequence: ['f1_s1', 'f1_s2', 'SAFE', 'f1_boss'], overworld: null, required: [], boss: 'f1_boss', par: 600 },
      { n: 2, name: 'GOBLIN WARRENS', tagline: 'GOBLINS. SO MANY GOBLINS.', theme: 'cave', music: 'floor2', intro: ['FLOOR TWO.'], sequence: ['f2_s1'], overworld: null, required: [], par: 700 },
      { n: 3, name: 'THE OVER CITY', tagline: 'A WHOLE CITY. ON TOP OF A DUNGEON. SURE.', theme: 'city', music: 'floor3',
        intro: ['FLOOR THREE! THE OVER CITY. FIND THE AREAS, BEAT THE RINGMASTER, TAKE THE STAIRS.'],
        overworld: { theme: 'ow_city', music: 'ow3', map: owMap,
          entrances: { '1': 'f3_s1', '2': 'f3_s2', '3': 'f3_s3', 'A': 'f3_x1', 'S': 'SAFE', 'B': 'f3_boss', 'X': 'STAIRS' },
          roamers: [{ enemy: 'clown', x: 17, y: 12 }, { enemy: 'rat', x: 8, y: 14 }, { enemy: 'clown', x: 26, y: 2 }], ambush: 'f3_ambush' },
        required: ['f3_s1', 'f3_s2', 'f3_s3'], boss: 'f3_boss', par: 900 }
    ],
    stages: {
      f1_s1: { id: 'f1_s1', name: 'COLLAPSED STAIRWELL', floor: 1, theme: 'sewer', kind: 'main' },
      f1_s2: { id: 'f1_s2', name: 'THE DRIPPING HALLS', floor: 1, theme: 'sewer', kind: 'main' },
      f1_boss: { id: 'f1_boss', name: 'HOARDER\'S NEST', floor: 1, theme: 'sewer', kind: 'boss', boss: 'hoarder' },
      f3_s1: { id: 'f3_s1', name: 'BACK ALLEY BRAWL', floor: 3, theme: 'city', kind: 'main' },
      f3_s2: { id: 'f3_s2', name: 'THE BIG TOP', floor: 3, theme: 'circus', kind: 'main' },
      f3_s3: { id: 'f3_s3', name: 'SWAMPY UNDERPASS', floor: 3, theme: 'swamp', kind: 'main' },
      f3_x1: { id: 'f3_x1', name: 'STORM DRAIN', floor: 3, theme: 'sewer', kind: 'side' },
      f3_boss: { id: 'f3_boss', name: 'RINGMASTER\'S ARENA', floor: 3, theme: 'circus', kind: 'boss', boss: 'ringmaster' },
      f3_ambush: { id: 'f3_ambush', name: 'AMBUSH!', floor: 3, theme: 'city', kind: 'ambush' }
    },
    enemies: { clown: { name: 'SAD CLOWN', sprite: 'clown' }, rat: { name: 'TUTORIAL RAT', sprite: 'rat' } },
    bosses: { hoarder: { name: 'THE HOARDER' }, ringmaster: { name: 'THE RINGMASTER' } },
    boxTiers: { bronze: { name: 'BRONZE ADVENTURER BOX', color: '#c87838' }, silver: { name: 'SILVER ADVENTURER BOX', color: '#bcbcbc' },
      gold: { name: 'GOLD ADVENTURER BOX', color: '#f8b800' }, platinum: { name: 'PLATINUM BOX', color: '#a4e4fc' }, legendary: { name: 'LEGENDARY BOX', color: '#9878f8' },
      fan: { name: 'FAN BOX', color: '#f878f8' }, boss: { name: 'BOSS BOX', color: '#e40058' } },
    shop: [
      { id: 'potion', name: 'HEALTH POTION', desc: 'HEALS HALF YOUR HP. TASTES LIKE CHERRY COUGH SYRUP.', price: 30, give: { kind: 'item', id: 'potion', count: 1 } },
      { id: 'bomb', name: 'BOMB', desc: 'GOES BOOM. DO NOT HOLD.', price: 20, give: { kind: 'item', id: 'bomb', count: 1 } },
      { id: 'bomb3', name: 'BOMB 3-PACK', desc: 'THREE TIMES THE BOOM.', price: 50, give: { kind: 'item', id: 'bomb', count: 3 } },
      { id: 'box', name: 'MYSTERY BRONZE BOX', desc: 'WHAT IS IN IT? NOBODY KNOWS. PROBABLY GOLD.', price: 90, give: { kind: 'box', tier: 'bronze' } },
      { id: 'hp', name: 'PROTEIN SHAKE', desc: '+1 MAX HP, PERMANENTLY. BRO.', price: 150, give: { kind: 'hp', amount: 1 } },
      { id: 'rev', name: 'SPONSOR CONTRACT', desc: '+1 REVIVAL.', price: 400, give: { kind: 'revival', count: 1 } },
      { id: 'xp', name: 'SELF HELP BOOK', desc: '+40 XP.', price: 60, give: { kind: 'xp', amount: 40 } }
    ],
    shopkeeper: { name: 'BOPCA', lines: ['WELCOME, WELCOME! EVERYTHING IS FOR SALE. EVEN THAT. ESPECIALLY THAT.', 'NO REFUNDS. NO EXCHANGES. NO QUESTIONS.'] },
    skins: {
      carl_boxers: { name: 'BOXERS + JACKET', desc: 'THE CLASSIC. HEART-PATTERNED BOXERS AND A LEATHER JACKET. ICONIC.', perk: null, how: 'DEFAULT' },
      carl_jacket: { name: 'FULL LEATHER', desc: 'PANTS! FINALLY.', perk: { def: 1 }, how: 'FOUND IN LOOT BOXES.' },
      carl_bodyguard: { name: 'BODYGUARD', desc: 'SUIT AND SHADES.', perk: { hp: 2 }, how: 'BEAT THE BRIDE ON FLOOR 7.' },
      carl_kilt: { name: 'BATTLE KILT', desc: 'BREEZY.', perk: { dmg: 1 }, how: 'BEAT THE OVERSEER ON FLOOR 8.' },
      carl_hazmat: { name: 'HAZMAT', desc: 'SAFETY FIRST.', perk: { def: 1 }, how: 'BEAT THE TIDEMOTHER.' },
      carl_pajamas: { name: 'PAJAMAS', desc: 'COZY CRAWLING.', perk: { speed: 0.1 }, how: 'OPEN 25 LOOT BOXES.' },
      carl_clown: { name: 'CLOWN SUIT', desc: 'HONK HONK.', perk: { views: 0.25 }, how: 'BEAT THE RINGMASTER ON FLOOR 3.' },
      carl_toga: { name: 'TOGA', desc: 'VERY ROMAN.', perk: { gold: 0.2 }, how: 'LOOT BOX ONLY.' },
      carl_gold: { name: 'GOLDEN CHAMPION', desc: 'YOU WON.', perk: { dmg: 1, def: 1, doubleJump: true }, how: 'BEAT THE GAME.' }
    },
    companions: {
      donut: { name: 'PRINCESS DONUT', desc: 'A PERSIAN SHOW CAT WITH MAGIC MISSILES AND OPINIONS.', ability: 'missile', special: { name: 'MAGIC MISSILE BARRAGE' }, sprite: 'donut', how: 'DEFAULT' },
      mongo: { name: 'MONGO', desc: 'A BABY VELOCIRAPTOR. VERY GOOD BOY.', ability: 'bite', special: { name: 'RAPTOR RUSH' }, sprite: 'mongo', how: 'BEAT THE JUICER ON FLOOR 2.' },
      katia: { name: 'KATIA', desc: 'A SHAPESHIFTER. BLOCKS HITS.', ability: 'shield', special: { name: 'WALL FORM' }, sprite: 'katia', how: 'BEAT THE ENGINEER ON FLOOR 4.' },
      zev: { name: 'ZEV', desc: 'YOUR PR HANDLER. GOLD MAGNET.', ability: 'magnet', special: { name: 'PRESS RELEASE' }, sprite: 'zev', how: 'BEAT THE BUTCHER ON FLOOR 6.' },
      squeaks: { name: 'SIR SQUEAKS', desc: 'A TUTORIAL RAT YOU SPARED. FETCHES STUFF.', ability: 'fetch', special: { name: 'SQUEAK OF DOOM' }, sprite: 'squeaks', how: 'BEAT THE HOARDER ON FLOOR 1.' }
    },
    achievements: (function () {
      var o = {};
      var list = [['first_blood', 'FIRST BLOOD', 'KILL ANYTHING. CONGRATS ON BEING A MURDERER.', 'kill', 1], ['rat_king', 'RAT CATCHER', 'KILL 10 RATS. THE RATS HAVE FAMILIES, YOU KNOW.', 'kill:rat', 10],
        ['stomper', 'STOMPY', 'STOMP 25 THINGS.', 'stomp', 25], ['kicker', 'BOOT TO THE HEAD', 'KICK 50 THINGS.', 'kick', 50], ['boom', 'BOOM GOES THE DYNAMITE', 'KILL 3 WITH ONE BOMB.', 'multi_bomb', 1],
        ['potion', 'CHUG CHUG', 'DRINK A POTION.', 'potion', 1], ['crate', 'CRATE EXPECTATIONS', 'BREAK 20 CRATES.', 'crate', 20], ['coin', 'MONEY BAGS', 'GRAB 100 COINS.', 'coin', 100],
        ['fall', 'GRAVITY WINS', 'FALL IN A PIT.', 'fall', 1], ['death', 'FIRST OF MANY', 'DIE.', 'death', 1], ['revive', 'SPONSORED CONTENT', 'GET REVIVED.', 'revive', 1],
        ['box', 'UNBOXING VIDEO', 'OPEN A LOOT BOX.', 'box_open', 1], ['combo', 'COMBO BREAKER', 'HIT A 10 COMBO.', 'combo10', 1], ['pet', 'GOOD KITTY', 'PET DONUT.', 'pet_donut', 1],
        ['shop', 'CONSUMER', 'BUY SOMETHING.', 'shop', 1], ['flee', 'BRAVE SIR CARL', 'RUN AWAY.', 'flee', 1]];
      list.forEach(function (a, i) { o[a[0]] = { name: a[1], desc: a[2], event: a[3], count: a[4], box: ['bronze', 'silver', 'gold'][i % 3] }; });
      return o;
    })(),
    ai: {
      floorClear: ['FLOOR CLEARED! THE AUDIENCE IS CAUTIOUSLY OPTIMISTIC.'],
      stageClear: ['NICE WORK, CRAWLER. THE VIEWERS ALMOST LOOKED UP FROM THEIR SNACKS.', 'ANOTHER AREA DOWN. YOUR MOTHER WOULD BE PROUD. PROBABLY.'],
      death: ['AND HE\'S DOWN! THAT\'S GOING IN THE HIGHLIGHT REEL. THE BLOOPER ONE.'],
      levelUp: ['LEVEL UP! NUMBERS GO UP!'], lootbox: ['OOH, A BOX! WHAT COULD IT BE? I KNOW. I ALWAYS KNOW.', 'UNBOXING CONTENT! THE SPONSORS ARE THRILLED.'],
      revive: ['BACK FROM THE DEAD, COURTESY OF OUR SPONSORS.'], boxEmpty: ['NO BOXES? GO EARN SOME, CRAWLER. THEY DON\'T GROW ON TREES. MOSTLY.'],
      lowHp: ['YOU LOOK TERRIBLE.'], bigCombo: ['COMBO!'], flee: ['COWARD! I LOVE IT.']
    },
    mordecai: ['KICK THINGS WHEN THEY BLOCK. BOOTS BEAT SHIELDS.', 'THE STAIRWELL OPENS WHEN THE BOSS DIES. THAT IS THE RULE.'],
    story: {
      intro: [
        { text: 'ONE MORNING, EVERY BUILDING ON EARTH SANK INTO THE GROUND. NO WARNING. NO EXPLANATION.' },
        { text: 'ALIEN SHIPS FILLED THE SKY. THE PLANET HAD BEEN SELECTED FOR THE GALAXY\'S MOST POPULAR GAME SHOW.' },
        { text: 'CARL WAS OUTSIDE IN HIS BOXERS, CHASING HIS EX-GIRLFRIEND\'S CAT. THAT IS THE ONLY REASON HE LIVED.' },
        { text: 'HELLO, CRAWLERS! WELCOME TO THE DUNGEON! DESCEND, FIGHT, LOOT, AND ENTERTAIN US. MOSTLY ENTERTAIN US.', portrait: 'p_ai' },
        { text: 'THE STAIRWELL IS RIGHT THERE. LET\'S GO.' }
      ],
      ending: [{ text: 'THE SHOWRUNNER FELL. THE STUDIO WENT SILENT. THEN THE CROWD ERUPTED.' }, { text: 'YOU WIN, CRAWLER. FOR NOW. SEASON TWO IS ALREADY IN PRODUCTION.', portrait: 'p_ai' }],
      credits: ['DUNGEON CRAWLER WORLD', 'EARTH EDITION', '', 'A FAN GAME', '', 'STARRING', 'CARL', 'PRINCESS DONUT', '', 'THANKS FOR PLAYING']
    },
    titles: [{ views: 0, name: 'NOBODY' }, { views: 1000, name: 'LOCAL CURIOSITY' }, { views: 10000, name: 'RISING STAR OF THE SEWERS' }, { views: 100000, name: 'GALACTIC HEARTTHROB' }]
  };

  function makeRun() {
    return { floor: 3, cleared: { f3_s1: true }, bossDown: false, seqIndex: 1, owPos: null, roamersDown: [1], hp: 9, level: 4, xp: 20, statPoints: 2,
      stats: { str: 5, con: 4, dex: 3, int: 4 }, bonus: { hp: 2 }, gold: 345, bombs: 4, potions: 2, views: 12345,
      boxes: [{ tier: 'bronze', from: 'BACK ALLEY BRAWL' }, { tier: 'gold', from: 'ACHIEVEMENT: FIRST BLOOD' }, { tier: 'fan', from: '10K VIEWERS' }, { tier: 'boss', from: 'THE HOARDER' }, { tier: 'silver', from: 'COMBO 25' }, { tier: 'platinum', from: 'UNDER PAR' }, { tier: 'legendary', from: 'SECRET' }],
      revivals: 2, floorTime: 512, kills: 88, seed: 12345, restedHere: false };
  }
  window.__makeRun = makeRun;

  var G = DCW.game = {};
  Object.defineProperty(G, 'run', { get: function () { return DCW.save ? DCW.save.run : null; } });
  G.floorDef = function (n) { var r = G.run; n = n || (r ? r.floor : 1); return DCW.data.floors.filter(function (f) { return f.n === n; })[0] || null; };
  G.newRun = function () { log('newRun', arguments); DCW.save.run = makeRun(); DCW.fade(function () { DCW.setScene(DCW.ui.scenes.intro, { onDone: function () { DCW.setScene(DCW.ui.scenes.floorCard, { floor: 3, onDone: function () { DCW.setScene(DCW.overworld.scene, { floor: 3 }); } }); } }); }); };
  G.continueRun = function () { log('continueRun', arguments); DCW.fade(function () { DCW.setScene(DCW.overworld.scene, { floor: 3 }); }); };
  G.enterStage = function () { log('enterStage', arguments); };
  G.fleeStage = function () { log('fleeStage', arguments); };
  G.entranceState = function (code) {
    var r = G.run, f = G.floorDef(), ow = f && f.overworld; if (!ow) return null;
    var t = ow.entrances[code]; if (!t) return null;
    if (t === 'SAFE') return { kind: 'safe', name: 'SAFE ROOM', cleared: false, locked: false };
    if (t === 'STAIRS') return { kind: 'stairs', name: 'STAIRWELL TO FLOOR 4', locked: !r.bossDown, lockText: 'DEFEAT THE FLOOR BOSS FIRST' };
    var st = DCW.data.stages[t];
    var out = { kind: st.kind === 'boss' ? 'boss' : 'stage', side: st.kind === 'side', stageId: t, name: st.name, cleared: !!r.cleared[t], locked: false };
    if (st.kind === 'boss') { var left = f.required.filter(function (id) { return !r.cleared[id]; }).length; if (left) { out.locked = true; out.lockText = 'CLEAR ' + left + ' MORE AREAS TO OPEN'; } }
    return out;
  };
  G.enterEntrance = function (code) {
    log('enterEntrance', arguments);
    if (String(code).indexOf('!ambush:') === 0) { DCW.ui.announce('AMBUSH!', { color: '#f83800' }); return true; }
    var st = G.entranceState(code); if (st && st.locked) return false;
    if (st && st.kind === 'safe') { DCW.fade(function () { DCW.setScene(DCW.ui.scenes.safeRoom, {}); }); }
    return true;
  };
  G.enterSafeRoom = function () { log('enterSafeRoom', arguments); };
  G.leaveSafeRoom = function () { log('leaveSafeRoom', arguments); DCW.fade(function () { DCW.setScene(DCW.overworld.scene, { floor: 3 }); }); };
  G.takeStairs = function () { log('takeStairs', arguments); };
  G.quitToTitle = function () { log('quitToTitle', arguments); DCW.fade(function () { DCW.setScene(DCW.ui.scenes.title, {}); }); };
  G.tick = function (dt) { if (G.run) G.run.floorTime += dt; };
  G.xpNeed = function (l) { return Math.round(18 * Math.pow(l, 1.5)); };
  G.playerStats = function () {
    var r = G.run || makeRun(), st = r.stats, lv = r.level;
    var dmg = 2 + (st.str - 3) + Math.floor((lv - 1) / 2);
    return { maxHp: 10 + (st.con - 3) * 2 + (lv - 1) + r.bonus.hp, dmg: dmg, kickDmg: Math.round(dmg * 1.5), crit: 0.04 + (st.dex - 3) * 0.02, speedMul: 1 + (st.dex - 3) * 0.03,
      bombDmg: 8 + lv * 2 + (st.str - 3), bombRadius: 28, compPower: 1 + (st.int - 3) * 0.15 + (lv - 1) * 0.04, def: 0, goldMul: 1, viewMul: 1, extraJump: false, skinPerk: {} };
  };
  G.heal = function (n) { log('heal', arguments); var r = G.run; if (r) r.hp = Math.min(G.playerStats().maxHp, r.hp + n); };
  G.addXP = G.addGold = G.addViews = G.damageTaken = function () {};
  G.giveLootBox = function (tier, from) { G.run.boxes.push({ tier: tier, from: from }); };
  G.openLootBox = function (i) {
    log('openLootBox', arguments);
    var r = G.run; var b = r.boxes.splice(i, 1)[0];
    var out = [{ kind: 'gold', amount: 42 }, { kind: 'item', id: 'potion', count: 2 }];
    if (b && b.tier !== 'bronze') out.push({ kind: 'skin', id: 'carl_kilt', isNew: true });
    if (b && b.tier === 'gold') out.push({ kind: 'companion', id: 'mongo', isNew: true }, { kind: 'stat', stat: 'str', amount: 1 });
    out.forEach(function (rw) { if (rw.kind === 'skin' && DCW.save.unlocks.skins.indexOf(rw.id) < 0) DCW.save.unlocks.skins.push(rw.id); if (rw.kind === 'companion' && DCW.save.unlocks.companions.indexOf(rw.id) < 0) DCW.save.unlocks.companions.push(rw.id); });
    return out;
  };
  G.price = function (id) { var it = DCW.data.shop.filter(function (s) { return s.id === id; })[0]; return it ? Math.round(it.price * 1.7) : 0; };
  G.buy = function (id) { log('buy', arguments); var p = G.price(id); if (G.run.gold < p) return { ok: false, msg: 'NOT ENOUGH GOLD' }; G.run.gold -= p; return { ok: true, msg: 'BOUGHT ' + id.toUpperCase() }; };
  G.usePotion = function () { return false; };
  G.spendStat = function (s) { log('spendStat', arguments); var r = G.run; if (!r || r.statPoints <= 0) return false; r.stats[s]++; r.statPoints--; return true; };
  G.equip = function (kind, id) { log('equip', arguments); var l = kind === 'skin' ? DCW.save.unlocks.skins : DCW.save.unlocks.companions; if (l.indexOf(id) < 0) return false; DCW.save.equipped[kind] = id; return true; };
  G.track = function (ev) { log('track', arguments); };
  G.achieve = function () {};
  G.revive = function () { log('revive', arguments); G.run.revivals--; return true; };
  G.endRun = function () { log('endRun', arguments); DCW.save.run = null; DCW.fade(function () { DCW.setScene(DCW.ui.scenes.title, {}); }); };
  G.objectives = function () {
    var r = G.run, f = G.floorDef(); if (!r || !f) return [];
    var out = ['FLOOR ' + r.floor + ': ' + f.name];
    if (f.overworld) {
      f.required.forEach(function (id) { out.push((r.cleared[id] ? '✓ ' : '- ') + DCW.data.stages[id].name); });
      out.push('- DEFEAT THE RINGMASTER'); out.push('- TAKE THE STAIRWELL'); out.push('SIDE AREAS: 0/1');
    } else f.sequence.forEach(function (id, i) { out.push((i < r.seqIndex ? '✓ ' : i === r.seqIndex ? '▶ ' : '- ') + (id === 'SAFE' ? 'SAFE ROOM' : DCW.data.stages[id].name)); });
    out.push('PAR 15:00  TIME 8:32');
    return out;
  };

  // fake stage scene for HUD + modal backdrops
  var fakeStage = {
    enter: function (p) { this.t = 0; this.p = p || {}; },
    update: function (dt) { this.t += dt; if (DCW.input.pressed('start')) DCW.ui.openPause({ canFlee: true }); },
    draw: function (ctx) {
      for (var i = 0; i < 12; i++) DCW.rect(0, i * 15, 320, 15, ['#1c2c3c', '#203040', '#24343c'][i % 3]);
      DCW.rect(0, 148, 320, 32, '#5c3c24'); DCW.rect(0, 148, 320, 2, '#a87850');
      if (DCW.art && DCW.art.sprite) { DCW.art.sprite(ctx, 'carl_idle', 80, 148, { frame: 0 }); DCW.art.sprite(ctx, 'clown_walk', 200, 148, {}); }
      var r = DCW.save.run || makeRun();
      DCW.ui.drawHUD(ctx, { hp: r.hp, maxHp: this.p.maxHp || 15, special: this.p.special === undefined ? 0.6 : this.p.special, bombs: r.bombs, potions: r.potions, gold: r.gold, level: r.level, xpFrac: 0.4,
        views: r.views, combo: this.p.combo || 0, companion: 'donut', bossHp: this.p.boss ? 0.62 : null, bossName: 'THE RINGMASTER, MASTER OF CEREMONIES', time: 487, par: 600, stageName: 'THE BIG TOP' });
    }
  };

  G.init = function () {
    DCW.save.run = makeRun();
    DCW.save.meta.achievements = { first_blood: true, potion: true, box: true, death: true };
    DCW.save.meta.counters = { 'kill:rat': 4, stomp: 9, kick: 12, crate: 3, coin: 55 };
    var sc = DCW.params.get('screen') || 'title';
    var S = DCW.ui.scenes;
    window.__fakeStage = fakeStage;
    switch (sc) {
      case 'title': DCW.setScene(S.title, {}); break;
      case 'title_norun': DCW.save.run = null; DCW.setScene(S.title, {}); break;
      case 'intro': DCW.setScene(S.intro, { onDone: function () { window.__introDone = true; } }); break;
      case 'floorcard': DCW.setScene(S.floorCard, { floor: 3, onDone: function () { window.__cardDone = true; } }); break;
      case 'floorcard1': DCW.setScene(S.floorCard, { floor: 1, onDone: function () { window.__cardDone = true; } }); break;
      case 'results': DCW.setScene(S.results, { result: { stageId: 'f3_s2', kills: 23, time: 143, damageTaken: 3, maxCombo: 14, views: 2350, gold: 87, secrets: 1 },
        rewards: [{ kind: 'xp', amount: 40 }, { kind: 'gold', amount: 360, converted: 'skin' }, { kind: 'box', tier: 'silver' }, { kind: 'views', amount: 4263, note: 'FLAWLESS' }, { kind: 'skin', id: 'carl_clown', isNew: true }], onDone: function () { window.__resultsDone = true; } }); break;
      case 'death': DCW.setScene(S.death, { result: { stageId: 'f3_s2', cause: 'SAD CLOWN' } }); break;
      case 'death0': DCW.save.run.revivals = 0; DCW.setScene(S.death, { result: { cause: 'THE RINGMASTER' } }); break;
      case 'safe': DCW.setScene(S.safeRoom, {}); break;
      case 'ending': DCW.setScene(S.ending, {}); break;
      case 'overworld': DCW.setScene(DCW.overworld.scene, { floor: 3 }); break;
      case 'hud': DCW.setScene(fakeStage, { combo: 14, boss: true }); break;
      case 'hud2': DCW.save.run.hp = 2; DCW.setScene(fakeStage, { combo: 31, special: 1 }); break;
      case 'hud3': var rr = DCW.save.run; rr.bonus = rr.bonus || {}; rr.bonus.hp = 120; rr.hp = 105; rr.gold = 9999; rr.views = 1234567; DCW.setScene(fakeStage, { maxHp: 120 }); break; // 3-digit HP must not overlap the bomb count
      default:
        DCW.setScene(fakeStage, {});
        var map = { pause: function () { DCW.ui.openPause({ canFlee: true }); }, character: DCW.ui.openCharacter, boxes: DCW.ui.openBoxes, wardrobe: DCW.ui.openWardrobe,
          achievements: DCW.ui.openAchievements, settings: DCW.ui.openSettings, shop: DCW.ui.openShop, map: DCW.ui.openMap, howto: DCW.ui.openHowTo,
          dialog: function () { DCW.ui.say(['HELLO CRAWLER! THIS IS A VERY LONG LINE OF DIALOG THAT SHOULD WRAP NICELY ACROSS SEVERAL LINES AND MAYBE EVEN PAGINATE ONTO A SECOND PAGE IF IT IS LONG ENOUGH, WHICH IT NOW IS, BECAUSE I KEPT TYPING.', { who: 'CARL', text: 'WHERE ARE MY PANTS?' }, { who: 'PRINCESS DONUT', text: 'CARL, DARLING, NOBODY CARES ABOUT YOUR PANTS.' }]); },
          toasts: function () { DCW.ui.toast('LEVEL 5! +STAT POINT', { title: 'LEVEL UP', icon: 'star', color: '#f8b800' }); DCW.ui.toast('FIRST BLOOD', { title: 'NEW ACHIEVEMENT!', icon: 'star', color: '#f8d878', time: 9 }); DCW.ui.toast('THE AUDIENCE LOVES A GOOD KICK TO THE FACE. KEEP IT UP, CRAWLER.', { icon: 'eye', time: 9 }); DCW.ui.toast('SILVER ADVENTURER BOX', { title: 'LOOT BOX GET', icon: 'box', color: '#bcbcbc', time: 9 }); DCW.ui.toast('QUEUED ONE', { time: 9 }); DCW.ui.announce('AMBUSH!', { color: '#f83800', sub: 'A SAD CLOWN APPEARS', time: 9 }); },
          menu: function () { DCW.ui.menu([{ label: 'OPTION ONE', action: function () {} }, { label: 'DISABLED ONE', disabled: true, why: 'YOU CAN\'T DO THAT.' }, { label: 'OPTION THREE', hint: 'THIS HAS A HINT.' }], { title: 'GENERIC MENU' }); },
          confirm: function () { DCW.ui.confirm('QUIT TO TITLE? YOUR PROGRESS IS SAVED.', function () {}); },
          mapow: DCW.ui.openMap,
          maplinear: function () { DCW.save.run.floor = 1; DCW.ui.openMap(); }
        };
        if (map[sc]) map[sc]();
    }
  };
})();

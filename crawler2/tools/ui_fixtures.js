/* UI test fixtures (book 2): loaded after the real js/game.js. Builds a test run, logs
   game API calls into window.__calls and opens the screen named by ?screen=... */
(function () {
  'use strict';
  var DCW = window.DCW = window.DCW || {};
  window.__calls = [];
  var G = DCW.game;
  if (!G) { DCW.game = G = {}; }
  // log calls to the game API that the UI drives
  ['newRun', 'continueRun', 'importLegacy', 'rest', 'craft', 'buy', 'leaveInn', 'leaveClub', 'revive', 'endRun', 'quitToTitle', 'fleeLevel',
    'openLootBox', 'spendStat', 'equip', 'usePotion', 'goArea', 'pickClass', 'toTitle', 'enterInn', 'enterClub', 'playCinema'].forEach(function (n) {
    var f = G[n];
    G[n] = function () {
      window.__calls.push(n + '(' + [].slice.call(arguments).filter(function (a) { return typeof a !== 'function'; }).map(function (a) { return JSON.stringify(a); }).join(',') + ')');
      return f ? f.apply(G, arguments) : undefined;
    };
  });
  function makeRun() {
    return { hoursLeft: 150, hour: 14, act: 1, area: 'circus_park', areaX: 300, levelId: null, inInn: null, inClub: null,
      cleared: { a1_lemurs: true, a1_bodies: true, x_restroom: true }, flags: { map_village: true, circus_seen: false, signet_story: true }, quests: { show_must_go_on: 'active', fools_glass: 'done' }, events: {},
      items: { jug: 3, hob: 0, dyn: 2, smoke: 1, moonshine: 3, big_top_ticket: 1, scratch_ticket: 1 }, selected: 'jug',
      hp: 14, level: 15, xp: 30, statPoints: 2, stats: { str: 6, con: 5, dex: 4, int: 5 }, bonus: { hp: 0, str: 2, con: 0, dex: 0, int: 0 },
      gold: 345, potions: 2, views: 12345, fanTier: 1, boxes: [{ tier: 'bronze', from: 'COLLAPSED STREET' }, { tier: 'silver', from: 'ACHIEVEMENT: LAZARUS' }, { tier: 'gold', from: 'BOOK 1 VETERAN' }, { tier: 'celestial', from: 'THE BANDIT' }],
      revivals: 2, kills: 88, deaths: 1, totalTime: 1234, banned: {}, wanted: null, bought: {}, won: false, seed: 12345 };
  }
  window.__makeRun = makeRun;
  // stand-in street scene so modals and the HUD have something behind them
  var fakeStage = {
    enter: function (p) { this.t = 0; this.p = p || {}; },
    update: function (dt) { this.t += dt; if (DCW.input.pressed('start')) DCW.ui.openPause({ canFlee: !!this.p.level }); if (DCW.input.pressed('select')) DCW.ui.openMap(); },
    draw: function (ctx) {
      var night = this.p.night;
      if (DCW.ui && DCW.ui.themeBackdrop) DCW.ui.themeBackdrop(ctx, this.p.theme || 'village', this.t, night, this.t * 20);
      if (DCW.art && DCW.art.sprite) { DCW.art.sprite(ctx, 'carl_idle', 80, 150, { frame: 0 }); DCW.art.sprite(ctx, 'clown_walk', 200, 150, {}); }
      var r = DCW.save.run || makeRun();
      var h = DCW.ui.hudFromRun({ special: this.p.special === undefined ? 0.6 : this.p.special, combo: this.p.combo || 0, party: true, objective: this.p.level ? null : true });
      if (this.p.boss) { h.bossHp = 0.62; h.bossName = 'HEATHER THE BEAR, LEVEL 19 NEIGHBORHOOD BOSS'; }
      if (this.p.timer) h.timer = { t: this.p.timer, label: this.p.timerLabel || 'TO DAWN' };
      if (this.p.meters) h.meters = this.p.meters;
      if (this.p.party) h.party = this.p.party;
      if (this.p.locked) h.specialLocked = true;
      DCW.ui.drawHUD(ctx, h);
    }
  };
  window.__fakeStage = fakeStage;
  G.init = function () {
    var S = DCW.ui.scenes, sc = DCW.params.get('screen') || 'title', s = DCW.save;
    s.run = makeRun();
    s.meta.achievements = { first_blood: true, lazarus: true };
    s.meta.counters = { 'kill:street_urchin': 9, kill: 40 };
    s.unlocks.skins = ['carl_f3', 'carl_boxers'];
    if (DCW.params.has('night')) s.run.hour = 22;
    if (DCW.params.has('lowtime')) s.run.hoursLeft = 18;
    switch (sc) {
      case 'title': DCW.setScene(S.title, {}); break;
      case 'title_norun': s.run = null; DCW.setScene(S.title, {}); break;
      case 'title_import': s.run = null; s.meta.imported = false; DCW.legacy = { book1: { unlocks: { skins: ['carl_boxers', 'carl_kilt', 'carl_gold', 'carl_jacket'] }, meta: { achievements: { a: 1, b: 1, c: 1, d: 1, e: 1 }, wins: 1 } } }; DCW.setScene(S.title, {}); break;
      case 'classpick': DCW.setScene(S.classPick, { onDone: function (r) { window.__pickDone = r; } }); break;
      case 'classpick_empty': DCW.setScene(S.classPick, {}); break;
      case 'cinema': DCW.setScene(S.cinema, { id: 'test', shots: DCW.data.cinema.test, onDone: function () { window.__cineDone = true; } }); break;
      case 'cinema_empty': DCW.setScene(S.cinema, {}); break;
      case 'inn': s.run.inInn = 'pug'; DCW.setScene(S.inn, { innId: 'pug' }); break;
      case 'inn_narwhal': s.run.inInn = 'narwhal'; s.run.flags.katia_joined = true; s.run.flags.mongo_big = true; DCW.setScene(S.inn, { innId: 'narwhal' }); break;
      case 'inn_empty': s.run.inInn = 'pug'; DCW.setScene(S.inn, {}); break;
      case 'club': s.run.inClub = 'desperado'; s.run.area = 'settlement'; DCW.setScene(S.club, { clubId: 'desperado' }); break;
      case 'club_empty': DCW.setScene(S.club, {}); break;
      case 'results': DCW.setScene(S.results, { result: { levelId: 'a1_heather', kills: 23, time: 143, damageTaken: 3, maxCombo: 14, views: 2350, gold: 87, secrets: 1 },
        rewards: [{ kind: 'xp', amount: 40 }, { kind: 'gold', amount: 55 }, { kind: 'box', tier: 'silver' }, { kind: 'views', amount: 750, note: 'FLAWLESS' }, { kind: 'item', id: 'dyn', count: 3 }, { kind: 'skin', id: 'carl_kilt', isNew: true }], onDone: function () { window.__resultsDone = true; } }); break;
      case 'results_empty': DCW.setScene(S.results, {}); break;
      case 'death': DCW.setScene(S.death, { result: { levelId: 'a1_lemurs', cause: 'TERROR THE CLOWN' } }); break;
      case 'death_guard': DCW.setScene(S.death, { result: { cause: 'guard' } }); break;
      case 'death0': s.run.revivals = 0; DCW.setScene(S.death, { result: { cause: 'HEATHER THE BEAR' } }); break;
      case 'ending_win': DCW.setScene(S.ending, { kind: 'win' }); break;
      case 'ending_early': DCW.setScene(S.ending, { kind: 'early' }); break;
      case 'ending_collapse': s.run.hoursLeft = 0; DCW.setScene(S.ending, { kind: 'collapse' }); break;
      case 'ending_empty': DCW.setScene(S.ending, {}); break;
      case 'card': DCW.setScene(S.card, { head: 'ACT', n: 2, name: 'THE SKYFOWL SETTLEMENT', tagline: 'BIRDS, BOOZE AND A MURDER.', intro: ['ACT TWO! TRY TO KEEP UP.'], onDone: function () { window.__cardDone = true; } }); break;
      case 'hud': DCW.setScene(fakeStage, { combo: 14 }); break;
      case 'hud_night': s.run.hour = 22; s.run.flags.katia_joined = true; DCW.setScene(fakeStage, { theme: 'settlement', night: true, party: ['donut', { id: 'mongo', state: 'stunned' }, 'katia'] }); break;
      case 'hud_level': s.run.levelId = 'a1_heather'; s.run.selected = 'dyn'; DCW.setScene(fakeStage, { level: true, boss: true, combo: 31, special: 1, theme: 'circus', timer: 25, timerLabel: 'ESCAPE', meters: [{ label: 'POISON', value: 0.7, color: '#58d854' }, { label: 'VIEWS', value: 0.3, color: '#f878f8', text: '1.2K' }] }); break;
      case 'hud_low': s.run.hp = 2; s.run.hoursLeft = 18; s.run.items.jug = 0; DCW.setScene(fakeStage, { level: true, combo: 3, locked: true }); break;
      default:
        DCW.setScene(fakeStage, { level: /pause_level/.test(sc) });
        var U = DCW.ui;
        var map = {
          pause: function () { U.openPause({ canFlee: false }); }, pause_level: function () { s.run.levelId = 'a1_heather'; U.openPause({ canFlee: true }); },
          character: U.openCharacter, boxes: U.openBoxes, wardrobe: U.openWardrobe, achievements: U.openAchievements, settings: U.openSettings, controls: U.openControls,
          shop: function () { U.openShop('lucky'); }, shop_pustule: function () { U.openShop('pustule'); }, shop_missing: function () { U.openShop('nope'); }, shop_none: function () { U.openShop(); },
          map: U.openMap, map_settle: function () { s.run.area = 'settlement'; s.run.cleared.a2_dispenser = true; s.run.flags.circus_gone = true; s.run.wanted = 'settlement'; U.openMap(); },
          map_norun: function () { s.run = null; U.openMap(); },
          quests: U.openQuests, quests_none: function () { s.run.quests = {}; U.openQuests(); }, inventory: U.openInventory, howto: U.openHowTo,
          dialog: function () { U.say(['WELCOME BACK, CRAWLERS! THIS IS A VERY LONG LINE OF DIALOG THAT SHOULD WRAP NICELY ACROSS SEVERAL LINES AND PAGINATE ONTO A SECOND PAGE IF IT IS LONG ENOUGH, WHICH IT NOW IS, BECAUSE I KEPT TYPING. AND TYPING.', { who: 'CARL', text: 'WHERE ARE MY PANTS?' }, { who: 'PRINCESS DONUT', text: 'CARL, DARLING, NOBODY CARES ABOUT YOUR PANTS.' }, { who: 'MORDECAI', text: 'I CARE. A LITTLE.' }, { who: 'TSARINA SIGNET', text: 'MY TATTOOS ARE HUNGRY.' }, { who: 'RIPPER WONTON', text: 'WELCOME TO THE DANGER ZONE!' }, { who: 'SOME RANDO', text: 'I HAVE NO PORTRAIT.' }]); },
          toasts: function () { U.toast('LEVEL 16! SPEND POINTS AT AN INN', { title: 'LEVEL UP', icon: 'star', color: '#f8b800' }); U.achievement('lazarus'); U.toast('THE AUDIENCE LOVES A GOOD KICK TO THE FACE.', { icon: 'eye', time: 9 }); U.toast('GOBLIN DYNAMITE x3', { title: 'GOT', icon: 'dyn', color: '#58d854', time: 9 }); U.toast('QUEUED ONE', { time: 9 }); U.announce('NIGHT FALLS', { color: '#6888fc', sub: 'THE URCHINS ARE OUT', time: 9 }); },
          menu: function () { U.menu([{ label: 'OPTION ONE', action: function () {} }, { label: 'DISABLED ONE', disabled: true, why: 'YOU CAN\'T DO THAT.' }, { label: 'OPTION THREE', hint: 'THIS HAS A HINT.', icon: 'jug', right: '10G' }], { title: 'GENERIC MENU' }); },
          confirm: function () { U.confirm('QUIT TO TITLE? YOUR CRAWL IS SAVED.', function () {}); },
          import: function () { U.showImport({ skins: ['carl_boxers', 'carl_kilt', 'carl_gold', 'carl_jacket', 'carl_toga', 'carl_clown', 'carl_hazmat'], achievements: 23, wins: 1, boxes: ['gold', 'platinum', 'legendary'], title: 'BOOK 1 VETERAN' }); },
          versus: function () { U.versus({ bossId: 'heather', name: 'HEATHER THE BEAR', title: 'LEVEL 19 NEIGHBORHOOD BOSS' }); }
        };
        if (map[sc]) map[sc]();
    }
  };
})();

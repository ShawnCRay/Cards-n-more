/* Test fixtures for stage.js (book 2): a small DCW.data covering every stage mode, a DCW.ui stub
   that draws the book 2 HUD fields, and a DCW.audio stub. Loaded by tools/stage_test.html only.
   The real game.js runs on top of this data unless the page has ?nogame. */
(function () {
  'use strict';
  var DCW = window.DCW = window.DCW || {};
  function pad(list, h) {
    var w = 0; list.forEach(function (r) { w = Math.max(w, r.length); });
    var out = list.map(function (r) { while (r.length < w) r += '.'; return r; });
    if (h && out.length !== h) console.warn('fixture rows: ' + out.length + ' != ' + h);
    return out;
  }
  function chunk(list) { return { rows: pad(list, 12) }; }
  function sky(w, n) { var s = ''; while (s.length < w) s += '.'; var a = []; for (var i = 0; i < n; i++) a.push(s); return a; }
  function ground(w) { var s = ''; while (s.length < w) s += '#'; return [s, s]; }
  var E = sky(40, 1)[0];

  DCW.data = {
    meta: { startArea: 'village', startHours: 192, startHour: 9 },
    areas: {
      village: {
        id: 'village', name: 'TINY VILLAGE', theme: 'village', music: 'village', musicNight: 'village_night', guarded: true,
        rows: pad(sky(110, 5).concat([
          '..................................................XXXXXX........................................................',
          '..................................................XXXXXX........................................................',
          '.......................................====.......XXXXXX........................................................',
          '..................................................XXXXXX........................................................',
          '...n......1...........2...........3...........4...5XXXXX..t....7...........p.........6........t.......8.........',
        ]).concat(ground(110)), 12),
        doors: {
          '1': { kind: 'inn', target: 'pug', label: 'THE BELLY-RUBBED PUG', sprite: 'door_inn' },
          '2': { kind: 'level', target: 't_side', label: 'COLLAPSED STREET', sprite: 'manhole' },
          '3': { kind: 'shop', target: 'lucky', label: "LUCKY'S GENERAL GOODS", sprite: 'door_shop' },
          '4': { kind: 'area', target: 'ruins_w', entry: 'left', label: 'VILLAGE GATE', sprite: 'gate' },
          '5': { kind: 'club', target: 'desperado', label: 'PUB', sprite: 'door_pub', phase: 'night', lockText: 'OPENS AT NIGHT' },
          '6': { kind: 'stairs', label: 'STAIRWELL', sprite: 'stairs_down', showIf: 'circus_gone' },
          '7': { kind: 'npc', target: 'gumgum', sprite: null },
          '8': { kind: 'level', target: 't_nest', label: 'BACK ALLEY', sprite: 'alley_mouth', needs: 'never_set', lockText: 'THE ALLEY IS SEALED' }
        },
        edges: { left: null, right: { area: 'ruins_w', entry: 'left' } },
        npcs: [{ id: 'mordecai_tour', x: 16, sprite: 'mordecai', phase: 'day', lines: ['DO NOT TOUCH THE GUARDS. DO NOT TOUCH ANYTHING NEAR THE GUARDS.'] }],
        enemies: { day: [['lemur', 2]], night: [['street_urchin', 3], ['incubus', 1]] },
        density: { day: 0.3, night: 0.7 },
        citizens: ['citizen_human', 'citizen_skyfowl', 'chickadee'],
        signs: ['WELCOME TO THE TINY VILLAGE. POPULATION: SMALL. GUARDS: VERY LARGE.'],
        signpost: true
      },
      ruins_w: {
        id: 'ruins_w', name: 'THE WESTERN RUINS', theme: 'ruins', music: 'ruins', musicNight: 'ruins_night', guarded: false,
        rows: pad(sky(80, 6).concat([
          '...........................XXX..........................................',
          '..........====.............XXX..........................................',
          '...........................XXX.....b....................................',
          '.....n.......1.............XXX....bbb.........2..........p...............',
        ]).concat(ground(80)), 12),
        doors: {
          '1': { kind: 'level', target: 't_dark', label: 'DARK BASEMENT', sprite: 'manhole' },
          '2': { kind: 'level', target: 't_climb', label: 'TOWER STAIRS', sprite: 'door_wood' }
        },
        edges: { left: { area: 'village', entry: 'right' }, right: null },
        enemies: { day: [['lemur', 2], ['brain_boiler', 1]], night: [['street_urchin', 2], ['shadow_leak', 1]] },
        density: { day: 0.6, night: 0.8 },
        signs: ['RUINS AHEAD. ALSO BEHIND. RUINS ALL THE WAY DOWN.']
      }
    },
    levels: {
      t_side: { id: 't_side', name: 'COLLAPSED STREET', act: 1, kind: 'side', theme: 'ruins', music: 'ruins', hours: 3,
        chunks: { start: 'cStart', pool: ['cRoof', 'cLever'], count: 2, end: 'cEnd' },
        enemies: [['lemur', 2], ['fat_clown', 1], ['mold_lion', 1]], elite: [['stilt_clown', 1]], flyers: [['brain_boiler', 1]],
        signs: ['THE SHOW MUST GO ON. NOBODY ASKED THE SHOW.'], npcs: [{ id: 'gumgum', sprite: 'gumgum', lines: ['YOU LOOK LIKE A MAN WHO PUNCHES THINGS.'] }],
        questItem: 'scratch_ticket', intro: ['TEST INTRO LINE.'], reward: { xp: 40, gold: 30, box: 'silver' } },
      t_dark: { id: 't_dark', name: 'THE DIVIDER', act: 2, kind: 'side', dark: true, night: true, theme: 'alley', music: 'dark',
        chunks: { start: 'cStart', pool: ['cFlat'], count: 2, end: 'cEnd' },
        enemies: [['berserker', 1], ['city_elf', 1]], flyers: [['shadow_leak', 1]], elite: [['berserker', 1]] },
      t_chase: { id: 't_chase', name: 'SKATE OR DIE', act: 1, kind: 'chase', theme: 'ruins', music: 'heather', boss: 'heather',
        chase: { pursuer: 'heather', speed: 62, catchDmg: 4 }, chunks: { start: 'cStart', pool: ['cFlat', 'cGap'], count: 3, end: 'cArena' },
        enemies: [['lemur', 1]] },
      t_climb: { id: 't_climb', name: "QUILL'S TOWER", act: 3, kind: 'climb', night: true, theme: 'admin', music: 'climb',
        enemies: [['city_elf', 1], ['lemur', 1]],
        layout: pad([
          '#####################',
          '#.........D.........#',
          '#.....=======.......#',
          '#...................#',
          '#..e.............===#',
          '#=====..............#',
          '#...........c.......#',
          '#........=======....#',
          '#...................#',
          '#===..........e.....#',
          '#......=====........#',
          '#...................#',
          '#.............======#',
          '#...e...............#',
          '#=======............#',
          '#..........H........#',
          '#......####H####....#',
          '#..........H........#',
          '#..........H.....o..#',
          '#..P.......H........#',
          '#####################',
          '#####################'
        ]) },
      t_drop: { id: 't_drop', name: 'THE BASEMENT DROP', act: 1, kind: 'drop', theme: 'basement', music: 'ruins',
        enemies: [['lemur', 1], ['fat_clown', 1]],
        layout: pad([
          '#####################',
          '#..P................#',
          '#======.....========#',
          '#...................#',
          '#.......e...........#',
          '#bbbbbbbbbbbb==.....#',
          '#...................#',
          '#.....c.............#',
          '#=====......========#',
          '#...................#',
          '#............e......#',
          '#....bbbbbbbbbbbbbbb#',
          '#...................#',
          '#...................#',
          '#=========.....=====#',
          '#...................#',
          '#.........D.........#',
          '#####################',
          '#####################'
        ]) },
      t_survival: { id: 't_survival', name: 'THE BARRICADE', act: 1, kind: 'survival', night: true, theme: 'village', music: 'dark',
        chunks: { start: 'cSurv', pool: [], count: 0, end: null },
        survival: { seconds: 12, waves: [['street_urchin', 3]], rate: 1.0, max: 8, guard: 'barricade', barricadeHp: 20 } },
      t_plant: { id: 't_plant', name: "QUILL'S SHELVES", act: 3, kind: 'plant', night: true, theme: 'office', music: 'dark',
        chunks: { start: 'cPlant', pool: [], count: 0, end: null }, plant: { charges: 3 }, enemies: [['krasue', 1]] },
      t_escape: { id: 't_escape', name: 'THE FOOLS WHO BROKE THE GLASS', act: 3, kind: 'escape', theme: 'escape', music: 'escape',
        escape: { seconds: 40, bursts: [36, 30, 24, 18] }, chunks: { start: 'cStart', pool: ['cFlat'], count: 3, end: 'cEnd' }, enemies: [['ruin_flocker', 1]], flyers: [['ruin_flocker', 1]] },
      t_boss: { id: 't_boss', name: 'THE MEAT HOOK ALLEY', act: 2, kind: 'boss', theme: 'alley', music: 'boss', boss: 'vincente',
        chunks: { start: 'cStart', pool: [], count: 0, end: 'cArena' }, enemies: [['city_elf', 1]] },
      t_facade: { id: 't_facade', name: 'THE DISPENSER', act: 2, kind: 'facade', theme: 'ruins', music: 'boss', boss: 'dispenser',
        chunks: { start: 'cStart', pool: [], count: 0, end: 'cFacade' } },
      t_swap: { id: 't_swap', name: 'MONGO BOLTS', act: 2, kind: 'side', swap: 'mongo', theme: 'alley', music: 'ruins',
        chunks: { start: 'cStart', pool: ['cFlat'], count: 2, end: 'cEnd' }, enemies: [['city_elf', 1], ['lemur', 1]] },
      t_solo: { id: 't_solo', name: "SIGNET'S LAIR", act: 1, kind: 'side', solo: true, night: true, theme: 'basement', music: 'dark',
        chunks: { start: 'cStart', pool: ['cRescue'], count: 1, end: 'cEnd' }, rescue: 'mongo', enemies: [['mold_lion', 1]] },
      t_nest: { id: 't_nest', name: 'THE NEST', act: 3, kind: 'side', dark: true, theme: 'nest', music: 'dark',
        chunks: { start: 'cStart', pool: ['cNest'], count: 1, end: 'cEnd' }, enemies: [['incubus', 1], ['giraffe', 1]], flyers: [['brain_boiler', 1]] }
    },
    chunks: {
      cStart: chunk(sky(24, 8).concat(['...n....................', '.P.....o.o.o............']).concat(ground(24))),
      cFlat: chunk(sky(32, 6).concat(['.........ooo....................', '........=====...................', '................................', '...e..........f.........E.......']).concat(ground(32))),
      cRoof: chunk(sky(36, 3).concat([
        '..............e.....................',
        '.............XXXXX..................',
        '.............XXXXX......N...........',
        '.............XXXXX..................',
        '......b......XXXXX.........Q........',
        '.....bbb.....XXXXX..............$...',
        '...e.........XXXXX.....e............']).concat(ground(36))),
      cLever: chunk(sky(32, 6).concat(['...................L............', '...................L............', '..........S........L.....c......', '...e...............L.......e....']).concat(ground(32))),
      cGap: chunk(sky(32, 8).concat(['.........=====..................', '................................', '##########.......###############', '##########.......###############'])),
      cEnd: chunk(sky(20, 9).concat(['..........D.........']).concat(ground(20))),
      cArena: chunk([
        'X..................................X', 'X..................................X', 'X..................................X', 'X..................................X',
        'X..................................X', 'X..................................X', 'X.....====..............====.......X', '...................................X',
        '...................................X', '......................K............X'].concat(ground(36))),
      cFacade: chunk([
        'X......................................X', 'X......................................X', 'X......................................X', 'X......................................X',
        'X......................................X', 'X......................................X', 'X......................................X', '.......................................X',
        '.......................................X', '....................K..................X'].concat(ground(40))),
      cSurv: chunk(['X..................X', 'X..................X', 'X..................X', 'X..................X', 'X..................X', 'X..................X',
        'X....===.....===...X', 'X..................X', 'X..................X', 'Xw..t....B....t...wX'].concat(ground(20))),
      cPlant: chunk(sky(48, 4).concat([
        '................................................',
        '..........k.....................k...............',
        '.........====..................====.............',
        '................................................',
        '................................................',
        '.P....C.......Y........C.........Y.....C....T...']).concat(ground(48))),
      cRescue: chunk(sky(32, 9).concat(['..............R.......e.........']).concat(ground(32))),
      cNest: chunk(sky(40, 5).concat([
        '........................................',
        '...........f............................',
        '........................................',
        '.....................k..................',
        '...e...........E.......................e']).concat(ground(40)))
    },
    enemies: {
      lemur: { name: 'FORMER CIRCUS LEMUR', hp: 8, dmg: 2, speed: 40, w: 12, h: 12, ai: 'perch', xp: 6, gold: [1, 3], sprite: 'lemur', projectile: 'knife', shootEvery: 1.8 },
      stilt_clown: { name: 'TERROR THE CLOWN', hp: 20, dmg: 3, speed: 26, w: 14, h: 40, ai: 'stilt', xp: 14, gold: [3, 6], sprite: 'stilt_clown', fearImmune: true, reach: 30 },
      fat_clown: { name: 'CLAMMY-TYPE CLOWN', hp: 12, dmg: 2, speed: 30, w: 18, h: 18, ai: 'jumper', xp: 8, gold: [2, 4], sprite: 'fat_clown' },
      mold_lion: { name: 'MOLD LION', hp: 14, dmg: 3, speed: 34, w: 20, h: 14, ai: 'charger', xp: 12, gold: [2, 5], sprite: 'mold_lion', regrow: true, chargeSpeed: 170 },
      giraffe: { name: 'ARTILLERY GIRAFFE', hp: 26, dmg: 2, speed: 0, w: 20, h: 40, ai: 'launcher', xp: 16, gold: [4, 8], sprite: 'giraffe', spawn: 'lemur', spawnEvery: 3.5 },
      street_urchin: { name: 'STREET URCHIN', hp: 8, dmg: 2, speed: 36, w: 12, h: 12, ai: 'urchin', neutral: true, xp: 6, gold: [1, 2], sprite: 'street_urchin' },
      brain_boiler: { name: 'BRAIN BOILER', hp: 10, dmg: 2, speed: 24, w: 16, h: 16, ai: 'floater', xp: 8, gold: [1, 3], sprite: 'brain_boiler', fearImmune: true, shootEvery: 3 },
      berserker: { name: 'SHAMBLING BERSERKER', hp: 30, dmg: 2, speed: 18, w: 20, h: 40, ai: 'berserker', darkMul: 4, xp: 20, gold: [3, 6], sprite: 'berserker' },
      city_elf: { name: 'CITY ELF', hp: 14, dmg: 2, speed: 30, w: 12, h: 20, ai: 'caster', xp: 14, gold: [3, 6], sprite: 'city_elf', projectile: 'bolt', orbEvery: 6 },
      wand_bearer: { name: 'WAND BEARER', hp: 14, dmg: 2, speed: 30, w: 12, h: 20, ai: 'caster', xp: 14, gold: [3, 6], sprite: 'wand_bearer', projectile: 'bolt' },
      krasue: { name: 'KRASUE', hp: 12, dmg: 3, speed: 55, w: 14, h: 14, ai: 'krasue', magicOnly: true, xp: 30, gold: [3, 6], sprite: 'krasue', body: 'krasue_body' },
      krasue_body: { name: 'HEADLESS BODY', hp: 16, dmg: 0, speed: 0, w: 14, h: 22, ai: 'kbody', xp: 30, gold: [4, 8], sprite: 'krasue_body', objSprite: 'krasue_body' },
      shadow_leak: { name: 'SHADOW LEAK', hp: 5, dmg: 1, speed: 40, w: 12, h: 12, ai: 'swarm', magicOnly: true, xp: 10, gold: [0, 1], sprite: 'shadow_leak', group: 3 },
      incubus: { name: 'INCUBUS', hp: 14, dmg: 2, speed: 32, w: 12, h: 22, ai: 'charm', xp: 14, gold: [2, 5], sprite: 'incubus' },
      ruin_flocker: { name: 'RUIN FLOCKER', hp: 5, dmg: 1, speed: 50, w: 12, h: 10, ai: 'flyer', xp: 5, gold: [0, 1], sprite: 'ruin_flocker' },
      guard: { name: 'VILLAGE GUARD SWORDSMAN', hp: 999, dmg: 99, speed: 34, w: 14, h: 30, ai: 'guard', xp: 0, gold: [0, 0], sprite: 'guard' },
      citizen_human: { name: 'CITIZEN', hp: 1, dmg: 0, speed: 20, w: 10, h: 20, ai: 'citizen', citizen: true, xp: 0, gold: [0, 0], sprite: 'citizen_human' },
      citizen_skyfowl: { name: 'SKYFOWL', hp: 1, dmg: 0, speed: 20, w: 10, h: 20, ai: 'citizen', citizen: true, xp: 0, gold: [0, 0], sprite: 'citizen_skyfowl' },
      chickadee: { name: 'CHICKADEE', hp: 1, dmg: 0, speed: 26, w: 8, h: 10, ai: 'citizen', citizen: true, xp: 0, gold: [0, 0], sprite: 'chickadee' }
    },
    projectiles: {
      knife: { sprite: 'knife', w: 8, h: 3, speed: 150, dmg: 1, gravity: 0, life: 3 },
      bolt: { sprite: 'bolt', w: 6, h: 4, speed: 140, dmg: 2, gravity: 0, life: 3 },
      spit: { sprite: 'spit', w: 8, h: 6, speed: 120, dmg: 2, gravity: 200, life: 3 },
      rock: { sprite: 'rock', w: 6, h: 6, speed: 120, dmg: 1, gravity: 300, life: 3 },
      psionic: { sprite: 'psionic', w: 8, h: 8, speed: 90, dmg: 2, gravity: 0, life: 3 }
    },
    bosses: {
      heather: { name: 'HEATHER THE BEAR', title: 'NEIGHBORHOOD BOSS', hp: 160, dmg: 3, w: 36, h: 40, sprite: 'heather', xp: 120, gold: [40, 60],
        phases: [{ below: 1, speed: 60, pattern: ['walk:1', 'charge', 'worms:4', 'jump_slam'] }, { below: 0.5, speed: 80, pattern: ['charge', 'worms:6', 'charge', 'shockwave'] }],
        intro: ['HEATHER IS ON SKATES. HEATHER IS ON FIRE.'], defeat: 'HEATHER IS AT PEACE.', curedLines: [{ who: 'SYSTEM AI', text: 'CUSTARD. THE WORMS HATE CUSTARD.' }] },
      vincente: { name: 'VINCENTE', title: 'CITY ELF, 201ST', hp: 120, dmg: 3, w: 16, h: 24, sprite: 'vincente', xp: 100, gold: [30, 50],
        phases: [{ below: 1, speed: 40, pattern: ['walk:1', 'meat_hooks', 'shoot:bolt:3', 'darkness:6', 'idle:1'] }] },
      terror_big: { name: 'TERROR THE CLOWN', title: 'ELEVEN FEET OF NOPE', hp: 90, dmg: 3, w: 20, h: 46, sprite: 'terror_big', xp: 60, gold: [20, 30],
        phases: [{ below: 1, speed: 36, pattern: ['walk:2', 'charge', 'idle:1'] }] },
      dispenser: { name: 'THE DISPENSER', title: 'IT WAS THE WALL ALL ALONG', hp: 140, dmg: 3, sprite: 'dispenser', xp: 140, gold: [50, 80], facade: true,
        phases: [{ below: 1, pattern: ['reveal:3', 'spit:spit:3', 'reveal:3', 'sweep', 'cloak', 'spawn:brain_boiler:1'] }, { below: 0.5, pattern: ['reveal:2', 'sweep', 'spit:spit:5', 'cloak'] }] }
    },
    items: {
      jug: { name: "CARL'S JUG O'BOOM", kind: 'explosive', icon: 'jug' }, hob: { name: 'HOB-LOBBER', kind: 'explosive', icon: 'hob' },
      dyn: { name: 'GOBLIN DYNAMITE', kind: 'explosive', icon: 'dyn' }, smoke: { name: 'SMOKE BOMB', kind: 'explosive', icon: 'smoke' },
      scratch_ticket: { name: 'SCRATCH TICKET', kind: 'key', sprite: 'scratch_ticket', desc: 'FIREBALL OR CUSTARD.' }
    },
    objectives: [{ done: 'never_done', text: 'FIND OUT WHAT THE CIRCUS WANTS', area: 'circus_park' }],
    events: [{ id: 'ev_village_hello', area: 'village', when: {}, lines: [{ who: 'SYSTEM AI', text: 'WELCOME TO THE THIRD FLOOR.' }], sets: ['seen_village'], once: true }],
    talk: { gumgum: [{ who: 'GUMGUM', text: 'HELP ME. NOBODY HELPS ME.' }] },
    ai: { bigCombo: ['THE CROWD GOES MILD.'], lowHp: ['YOU LOOK TERRIBLE. RATINGS ARE UP.'], cockroach: ['I AM A COCKROACH, CARL. I CANNOT DIE.'], crime: ['THE GUARDS HAVE OPINIONS.'] }
  };

  /* ---------------- DCW.ui stub (draws the book 2 HUD fields) ---------------- */
  var log = DCW.testLog = { calls: [], say: [], toast: [], announce: [], pause: [], shop: [], map: [], music: [], sfx: {}, hud: null };
  function txt(l) { if (typeof l === 'string') return l; if (Array.isArray(l)) return l.map(txt).join(' | '); return (l && l.text) || ''; }
  DCW.ui = {
    scenes: {},
    init: function () {}, update: function () {}, draw: function () {},
    blocking: function () { return false; },
    say: function (lines, opts) { log.say.push(txt(lines)); if (opts && opts.onDone) setTimeout(opts.onDone, 0); },
    toast: function (t) { log.toast.push(String(t)); },
    announce: function (t, o) { log.announce.push(String(t) + (o && o.sub ? ' / ' + o.sub : '')); },
    openPause: function (o) { log.pause.push(o); },
    openShop: function (id) { log.shop.push(id); },
    openMap: function () { log.map.push(1); },
    confirm: function (t, yes) { log.calls.push(['confirm', t]); },
    drawHUD: function (ctx, h) {
      log.hud = JSON.parse(JSON.stringify(h));
      ctx.globalAlpha = 0.75; ctx.fillStyle = '#000'; ctx.fillRect(0, 0, 320, 12); ctx.globalAlpha = 1;
      DCW.bar(2, 2, 40, 4, h.hp / Math.max(1, h.maxHp), '#d82800', '#3a1020');
      if (h.special !== null && h.special !== undefined) DCW.bar(2, 8, 40, 2, h.special, h.specialLocked ? '#7c7c7c' : '#f8d878', '#200828');
      DCW.text(h.hp + '/' + h.maxHp, 45, 2, '#fcfcfc');
      if (h.explosive) DCW.text(h.explosive.id.toUpperCase() + 'x' + h.explosive.count, 92, 2, '#f8b800');
      DCW.text('P' + (h.potions === undefined ? '-' : h.potions) + ' $' + h.gold + ' LV' + h.level, 136, 2, '#fcfcfc');
      DCW.text((h.party || []).map(function (p) { return p.charAt(0).toUpperCase(); }).join(''), 216, 2, '#58d854');
      if (h.clock) DCW.text((h.clock.night ? 'N ' : 'D ') + h.clock.label, 318, 2, h.clock.night ? '#6888fc' : '#fca044', { align: 'right' });
      if (h.timer) DCW.text(h.timer.label + ' ' + Math.ceil(h.timer.t), 160, 14, h.timer.warn ? '#f83800' : '#fcfcfc', { align: 'center' });
      (h.meters || []).forEach(function (m, i) { DCW.text(m.label + (m.text ? ' ' + m.text : ''), 4, 14 + i * 9, m.color || '#fcfcfc'); DCW.bar(70, 16 + i * 9, 30, 3, m.frac || 0, m.color || '#fcfcfc', '#202020'); });
      if (h.objective) DCW.text(h.objective, 160, 170, '#f8d878', { align: 'center' });
      if (h.combo > 1) DCW.text(h.combo + ' HIT', 316, 14, '#f8d878', { align: 'right' });
      if (h.bossHp !== null && h.bossHp !== undefined) { DCW.text(h.bossName, 160, 158, '#fcfcfc', { align: 'center' }); DCW.bar(60, 168, 200, 4, h.bossHp, '#f83800', '#3a1020'); }
    }
  };
  DCW.audio = {
    init: function () {},
    sfx: function (n) { log.sfx[n] = (log.sfx[n] || 0) + 1; },
    music: function (t) { log.music.push(t); }
  };
})();

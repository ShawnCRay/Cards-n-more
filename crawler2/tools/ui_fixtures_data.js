/* UI test fixture data: a small DCW.data in book 2's shape (DESIGN.md section 6).
   Loaded by tools/ui_test.html instead of js/data.js (pass ?realdata to use the real one). */
(function () {
  'use strict';
  var DCW = window.DCW = window.DCW || {};
  if (DCW.params && DCW.params.has && DCW.params.has('realdata')) return;
  var row = function (s) { return s; };
  DCW.data = {
    meta: { startHours: 192, startHour: 7, startArea: 'village', startCinema: 'arrival', afterClassCinema: 'tour' },
    areas: {
      village: { id: 'village', name: 'TINY VILLAGE', theme: 'village', guarded: true, rows: [row('....')],
        doors: { '1': { kind: 'inn', target: 'pug', label: 'THE BELLY-RUBBED PUG' }, '2': { kind: 'level', target: 'a1_lemurs', label: 'COLLAPSED STREET' }, '3': { kind: 'shop', target: 'lucky', label: "LUCKY'S GENERAL GOODS" }, '4': { kind: 'area', target: 'ruins_w', label: 'VILLAGE GATE' } } },
      ruins_w: { id: 'ruins_w', name: 'THE WESTERN RUINS', theme: 'ruins',
        doors: { '1': { kind: 'level', target: 'a1_bodies' }, '2': { kind: 'level', target: 'x_restroom' }, '3': { kind: 'level', target: 'x_temple', showIf: 'never_seen' } } },
      circus_park: { id: 'circus_park', name: 'CIRCUS PARK', theme: 'circus',
        doors: { '1': { kind: 'level', target: 'a1_collapse' }, '2': { kind: 'level', target: 'a1_heather', needs: 'signet_story', lockText: 'THE TENT FLAP IS SEWN SHUT' }, '3': { kind: 'level', target: 'a1_bigtop', needsItem: 'big_top_ticket', lockText: 'NEEDS A BIG TOP TICKET' }, '4': { kind: 'level', target: 'a1_barricade', phase: 'night' }, '5': { kind: 'stairs', label: 'STAIRWELL', showIf: 'circus_gone' } } },
      ruins_e: { id: 'ruins_e', name: 'THE LONG ROAD EAST', theme: 'ruins', doors: { '1': { kind: 'level', target: 'a2_dispenser' } } },
      settlement: { id: 'settlement', name: 'MEDIUM SKYFOWL SETTLEMENT', theme: 'settlement', guarded: true,
        doors: { '1': { kind: 'inn', target: 'narwhal', label: 'THE ONE-EYED NARWHAL' }, '2': { kind: 'shop', target: 'lucky' }, '3': { kind: 'club', target: 'desperado', label: 'PUB' }, '4': { kind: 'shop', target: 'pustule', label: 'SILK ROAD MARKET' }, '5': { kind: 'level', target: 'a2_alley', phase: 'night' } } },
      admin: { id: 'admin', name: 'ADMINISTRATIVE DISTRICT', theme: 'admin', guarded: true, doors: { '1': { kind: 'level', target: 'a3_climb' } } },
      east_stairs: { id: 'east_stairs', name: 'THE EASTERN STAIRWELL', theme: 'escape', doors: {} }
    },
    levels: {
      a1_lemurs: { id: 'a1_lemurs', name: 'COLLAPSED STREET', act: 1, kind: 'side', theme: 'ruins', hours: 3, reward: { box: 'silver', xp: 40, gold: 30 } },
      a1_bodies: { id: 'a1_bodies', name: 'THE THREE DEAD CRAWLERS', act: 1, kind: 'side', theme: 'ruins' },
      a1_collapse: { id: 'a1_collapse', name: 'THE MORTAR STRIKE', act: 1, kind: 'drop', theme: 'basement' },
      a1_heather: { id: 'a1_heather', name: 'HEATHER ON WHEELS', act: 1, kind: 'chase', boss: 'heather' },
      a1_bigtop: { id: 'a1_bigtop', name: 'THE BIG TOP', act: 1, kind: 'rooms' },
      a1_barricade: { id: 'a1_barricade', name: 'THE BARRICADE', act: 1, kind: 'survival', phase: 'night' },
      a2_dispenser: { id: 'a2_dispenser', name: 'THE DISPENSER', act: 2, kind: 'facade', boss: 'dispenser' },
      a2_alley: { id: 'a2_alley', name: 'GUMGUM\'S ALLEY', act: 2, kind: 'side' },
      a3_climb: { id: 'a3_climb', name: 'QUILL\'S TOWER', act: 3, kind: 'climb' },
      x_restroom: { id: 'x_restroom', name: 'A RUINS RESTROOM', act: 1, kind: 'side', optional: true },
      x_temple: { id: 'x_temple', name: 'A CORRUPT TEMPLE', act: 1, kind: 'side', optional: true }
    },
    bosses: { heather: { name: 'HEATHER THE BEAR', title: 'LEVEL 19 NEIGHBORHOOD BOSS' } },
    items: {
      jug: { name: "CARL'S JUG O'BOOM", kind: 'explosive', icon: 'jug', desc: 'A JUG OF MOONSHINE WITH A RAG IN IT. LIGHT IT, THROW IT, ENJOY THE WARM GLOW OF A STREET ON FIRE.' },
      hob: { name: 'HOB-LOBBER', kind: 'explosive', icon: 'hob', desc: 'SMALLER THAN A BASEBALL, MEANER THAN A GOOSE.' },
      dyn: { name: 'GOBLIN DYNAMITE', kind: 'explosive', icon: 'dyn', desc: 'A LONG FUSE AND A BIG OPINION ABOUT BUILDINGS.' },
      smoke: { name: 'SMOKE BOMB', kind: 'explosive', icon: 'smoke', desc: 'NOW YOU SEE ME. NOW YOU ARE COUGHING.' },
      moonshine: { name: 'MOONSHINE', kind: 'material', icon: 'moonshine', desc: 'TECHNICALLY A BEVERAGE. MORDECAI TURNS IT INTO JUGS.' },
      big_top_ticket: { name: 'BIG TOP TICKET', kind: 'key', icon: 'ticket', desc: 'ADMIT ONE. CLOWNS NOT INCLUDED. CLOWNS VERY MUCH INCLUDED.' },
      scratch_ticket: { name: 'FIREBALL OR CUSTARD', kind: 'key', icon: 'ticket', desc: 'A SCRATCH TICKET THAT TALKS LIKE A MOBILE GAME. SCRATCH TO WIN.' },
      snack: { name: 'STREET MEAT', kind: 'consumable', desc: 'DON\'T ASK WHICH STREET.' }
    },
    shops: {
      lucky: { name: "LUCKY'S GENERAL GOODS", keeper: 'lucky', items: [
        { id: 'potion', price: 30, give: { potion: 1 } }, { id: 'jug2', price: 40, give: { item: 'jug', n: 2 } }, { id: 'smoke', price: 25, give: { item: 'smoke', n: 1 } },
        { id: 'moon', price: 15, give: { item: 'moonshine', n: 1 } }, { id: 'kilt', name: 'BATTLE KILT', price: 300, give: { skin: 'carl_kilt' }, desc: 'BREEZY. EXTREMELY BREEZY.' },
        { id: 'box', price: 120, give: { box: 'bronze' } }, { id: 'limit', name: 'LAST BOTTLE OF GLITTER', price: 5, limit: 1, give: { item: 'snack' } }
      ] },
      pustule: { name: 'HOBGOBS AND BOOM STICKS', keeper: 'pustule', items: [{ id: 'dyn', price: 60, give: { item: 'dyn', n: 1 } }, { id: 'hob3', price: 50, give: { item: 'hob', n: 3 } }] },
      quint: { name: "QUINT'S PHARMACY", keeper: 'quint', items: [{ id: 'potion2', price: 55, give: { potion: 2 } }] }
    },
    inns: { pug: { name: 'THE BELLY-RUBBED PUG', price: 10, keeper: 'gordo' }, narwhal: { name: 'THE ONE-EYED NARWHAL', price: 20, keeper: 'fitz' } },
    recipes: { jug: { name: "JUG O'BOOM", needs: { moonshine: 1 }, gives: { jug: 1 } }, smoke: { name: 'SMOKE BOMB', needs: { moonshine: 2 }, gold: 10, gives: { smoke: 1 } } },
    quests: {
      show_must_go_on: { name: 'THE SHOW MUST GO ON', desc: 'THE CIRCUS WANTS SOMETHING. THE LEMURS WANT YOUR KIDNEYS. FIND OUT WHAT GRIMALDI WANTS BEFORE EITHER GETS ITS WAY.' },
      sex_workers: { name: 'THE SEX WORKERS WHO FELL FROM THE HEAVENS', desc: 'SOMEONE IS MURDERING WOMEN OUTSIDE THE SETTLEMENT AND NOBODY IN CHARGE CARES. YOU DO. FIND OUT WHO.' },
      fools_glass: { name: 'THE FOOLS WHO BROKE THE GLASS', desc: 'RUN.' }
    },
    objectives: [{ done: 'circus_seen', text: 'FIND OUT WHAT THE CIRCUS WANTS', area: 'circus_park' }, { done: 'circus_gone', text: 'SURVIVE THE NIGHT AT THE BARRICADE', area: 'circus_park' }],
    events: [],
    cinema: {
      arrival: [
        { bg: 'guide_room', actors: [{ sprite: 'carl', x: 40, moveTo: { x: 120, t: 1.2 } }, { sprite: 'donut', x: 20, moveTo: { x: 146, t: 1.4 } }], lines: [{ who: 'SYSTEM AI', text: 'WELCOME TO THE THIRD FLOOR, CRAWLERS!' }], fade: true }
      ],
      tour: [{ bg: 'village', lines: [{ who: 'MORDECAI', text: 'RULE ONE: DO NOT HIT THE GUARDS.' }] }],
      test: [
        { bg: 'village', fade: true, music: 'cutscene', caption: 'DAY 1, 07:00', actors: [{ sprite: 'carl', x: 30, moveTo: { x: 140, t: 1.5 } }, { sprite: 'mordecai', x: 220, flip: true, say: 'OVER HERE.' }], wait: 1.8 },
        { lines: [{ who: 'MORDECAI', text: 'THIS IS THE VILLAGE. THE GUARDS ARE LEVEL 75. YOU ARE NOT.' }, { who: 'CARL', text: 'GOT IT. DON\'T PUNCH THE TIN CANS.' }, { who: 'DONUT', text: 'CARL, DARLING, NOBODY CARES ABOUT YOUR PANTS.' }] },
        { bg: 'panel:signet_tattoos', shake: 4, flash: '#f83800', sfx: 'explosion', lines: [{ who: 'SIGNET', text: 'GRIMALDI RAISED ME. THEN HE BECAME A PLANT. RELATIONSHIPS ARE HARD.' }] },
        { bg: 'circus', night: true, wobble: 2, actors: [{ sprite: 'heather', x: 200, y: 150, scale: 1 }], wait: 1.2 },
        { bg: 'club', actors: [{ sprite: 'carl', x: 160, anim: 'walk' }], lines: ['THE AI SAYS: THAT IS ALL FOR NOW.'] }
      ]
    },
    story: {},
    achievements: {
      first_blood: { name: 'FIRST BLOOD, THIRD FLOOR', desc: 'YOU KILLED SOMETHING. IT WAS PROBABLY A LEMUR. IT HAD IT COMING.', event: 'kill', count: 1, box: 'bronze' },
      lazarus: { name: 'LAZARUS', desc: 'YOU WERE KNOCKED OUT FOR FIFTEEN HOURS AND WOKE UP. MOST PEOPLE DON\'T. CONGRATULATIONS ON BEING MOST PEOPLE\'S EXCEPTION.', event: 'flag:knocked_out', box: 'silver' },
      early_bird: { name: 'EARLY BIRD GETS TO SQUIRM', desc: 'YOU LEFT THE FLOOR EARLY. COWARD. WISE, BUT A COWARD.', event: 'early', box: 'gold' },
      urchin: { name: 'TRASH TALK', desc: 'KILL 25 STREET URCHINS.', event: 'kill:street_urchin', count: 25, box: 'silver' },
      dance: { name: 'SATURDAY NIGHT FEVER DREAM', desc: 'DANCE AT THE DESPERADO CLUB.', event: 'dance', box: 'bronze' }
    },
    skins: {
      carl_f3: { name: 'FLOOR 3 CARL', desc: 'ONE SLEEVE, ONE CLOAK, ZERO PANTS. THE WAR GAUNTLET COMPLETES THE LOOK.', perk: null, how: 'DEFAULT' },
      carl_primal: { name: 'PRIMAL', desc: 'THE LATE BLOOMER, BLOOMED.', perk: { hp: 4 }, how: 'BEAT THE FLOOR.' },
      carl_magistrate: { name: 'ACTING MAGISTRATE', desc: 'A ROBE OF OFFICE. STILL NO PANTS.', perk: { views: 0.2 }, how: 'BECOME MAGISTRATE.' },
      carl_boxers: { name: 'BOOK 1 BOXERS', desc: 'THE CLASSIC.', perk: null, how: 'IMPORT A BOOK 1 SAVE.' },
      carl_kilt: { name: 'BATTLE KILT', desc: 'BREEZY.', perk: { dmg: 1 }, how: 'LUCKY SELLS ONE.' },
      carl_gold: { name: 'GOLDEN CHAMPION', desc: 'SHINY.', perk: { gold: 0.2 }, how: 'IMPORT A BOOK 1 WIN.' }
    },
    boxTiers: { bronze: { name: 'BRONZE ADVENTURER BOX', color: '#c87838' }, silver: { name: 'SILVER EARTH BOX', color: '#bcbcbc' }, gold: { name: 'GOLD FAN BOX', color: '#f8b800' },
      platinum: { name: 'PLATINUM QUEST BOX', color: '#a4e4fc' }, legendary: { name: 'LUCKY BASTARD BOX', color: '#9878f8' }, fan: { name: 'FAN BOX', color: '#f878f8' }, boss: { name: 'BOSS BOX', color: '#e40058' }, celestial: { name: 'CELESTIAL BOX', color: '#00fcfc' } },
    lootTables: { bronze: { rolls: 2, entries: [[{ kind: 'gold', min: 10, max: 20 }, 1]] }, silver: { rolls: 2, entries: [[{ kind: 'item', id: 'jug', count: 2 }, 1]], guaranteed: [{ kind: 'skin', id: 'carl_kilt' }] } },
    titles: [{ views: 0, name: 'NOBODY' }, { views: 1000, name: 'LOCAL WEIRDO' }, { views: 10000, name: 'CULT FAVORITE' }],
    ai: { lootbox: ['A BOX! INSIDE: DISAPPOINTMENT, PROBABLY. OPEN IT ANYWAY.'], death: ['AND THAT\'S WHY WE DON\'T HUG BEARS.'], crime: ['THE GUARDS HAVE A STRICT POLICY: STAB FIRST, NEVER ASK.'], stageClear: ['NOT BAD. THE AUDIENCE ONLY BOOED TWICE.'], collapse: ['TIME\'S UP!'], import: ['A BOOK 1 VETERAN! THE AUDIENCE REMEMBERS YOUR FEET.'] },
    mordecai: ['KEEP YOUR HEAD DOWN AND YOUR FISTS UP. AND FEED THE CAT.'],
    legacy: { veteranBox: 'gold', championBox: 'legendary', title: 'BOOK 1 VETERAN' }
  };
})();

/* ==========================================================================
   DUNGEON CRAWLER CARL - BOOK ONE (8-bit fan game)
   DATA - all game content as plain data under DCW.data (owner: content)
   Schema: "Data contract additions" + the inherited contract in
   crawler-book1/DESIGN.md. Two linear floors, story order:
     D.floors[i].sequence = ['CUT:id' | 'SAFE:roomId' | 'stageId', ...]
   All player-facing text: UPPERCASE, the 5x7 font's charset only, original
   lines in the characters' voices (an adult game: the AI swears).

   OPTIONAL FIELDS (safe to ignore; documented for the other modules):
   - enemies[id].tier = floor the stats are balanced for; D.enemyFor(id, floor)
     returns a copy scaled by D.floorScale (never scales down).
   - enemies[id].armed: bare-handed kill fires 'kill_armed'.
   - stages[id].door: sprite hint for the exit door ('guild_door' | 'stairwell').
   - stages[id].pursuer.kind: 'boss' (sprite from bosses[id]) | 'fire'.
   - safeRooms[id].shopName / shopLines: the room's shopkeeper (Tally, Qwist).
   - cutscene line {who: '', portrait: null} = narration (no speaker box).
   - give entries {kind:'box', tier, from, name}: name = the book's box name
     (BRONZE ASSHOLE'S BOX ...); the tier decides art + loot table.
   - achievements[id].boxName: the book's box name for the reward box.
   - D.mordecaiByFloor[n]: floor-specific Mordecai tips (D.mordecai = all).
   - D.items[id]: inventory item names (bomb.jugName once flag 'jugs').
   - D.racers = {} (no rivals in Book One; the ride engine needs none).
   ========================================================================== */
(function () {
  'use strict';
  var DCW = window.DCW = window.DCW || {};
  var D = DCW.data = DCW.data || {};

  D.version = 2;
  D.book = 1;

  // side-scroll themes (art draws tiles + backgrounds) and cutscene backdrops
  D.themes = ['tunnels', 'hoard', 'goblin', 'gym', 'swine', 'cinder', 'distillery', 'pound', 'safe'];
  D.safeThemes = ['safe_guild', 'safe_tally', 'safe_cookie', 'safe_shelter', 'safe_bugaboo'];
  D.backdrops = ['surface', 'stairwell', 'trailer', 'studio', 'reward_room', 'tvroom', 'deathwatch'];
  D.owThemes = [];

  /* ---------------- enemy scaling (optional helper) ----------------
     Index = floor-1. Book One has two floors; enemies are tiered per floor
     so this only matters if a floor-1 mob shows up on floor 2. */
  D.floorScale = [
    { hp: 1.0, dmg: 1.0, xp: 1.0, gold: 1.0 },
    { hp: 2.2, dmg: 1.8, xp: 2.4, gold: 1.5 }
  ];
  D.enemyFor = function (id, floor) {
    var e = D.enemies && D.enemies[id];
    if (!e) return null;
    var top = D.floorScale.length;
    var t = Math.max(1, Math.min(top, e.tier || 1));
    var f = Math.max(1, Math.min(top, floor || t));
    var out = {}, k;
    for (k in e) if (Object.prototype.hasOwnProperty.call(e, k)) out[k] = e[k];
    if (f <= t) return out;
    var a = D.floorScale[t - 1], b = D.floorScale[f - 1];
    out.hp = Math.max(1, Math.round(e.hp * b.hp / a.hp));
    out.dmg = Math.max(1, Math.round(e.dmg * b.dmg / a.dmg));
    out.xp = Math.max(1, Math.round(e.xp * b.xp / a.xp));
    if (e.gold) out.gold = [Math.round(e.gold[0] * b.gold / a.gold), Math.round(e.gold[1] * b.gold / a.gold)];
    out.scaledFrom = t;
    return out;
  };

  /* ---------------- enemies ----------------
     Balance (DESIGN formulas): punch = 2 + (str-3) + floor((lvl-1)/2) + gear dmg.
     Floor 1 (lvl 1-5, punch 2-5): regular mobs 2-12 hp. Floor 2 (lvl 6-9, punch
     ~7-10 with the toe ring + gauntlet): regular mobs 14-28 hp, elites ~32.
     Floor 1 mobs drop NO gold (book: mob gold starts on floor 2; floor 1 gold
     comes from crates, chests and boxes). xp targets ~lvl 6 entering floor 2,
     ~lvl 9-10 at the end. */
  D.enemies = {
    /* ----- floor 1 ----- */
    rat: { name: 'RAT', tier: 1, hp: 3, dmg: 1, speed: 30, w: 12, h: 8, ai: 'walker',
      xp: 1, gold: [0, 0], sprite: 'rat', kb: 1.2,
      flavor: "A RAT. LEVEL ONE. IT HAS A FAMILY, PROBABLY. IT HAS RABIES, DEFINITELY. PUNCH IT AND FIND OUT WHICH ONE MATTERS." },
    goblin: { name: 'GOBLIN', tier: 1, hp: 6, dmg: 1, speed: 40, w: 12, h: 16, ai: 'chaser',
      aggro: 110, xp: 2, gold: [0, 0], sprite: 'goblin', armed: true,
      flavor: "THREE FEET OF GREEN SPITE AND A RUSTY KNIFE. KILL ONE WITH YOUR BARE HANDS. I HAVE A PRIZE FOR THAT. I LOVE PRIZES." },
    goblin_shamanka: { name: 'GOBLIN SHAMANKA', tier: 1, hp: 8, dmg: 1, speed: 26, w: 14, h: 16, ai: 'shooter',
      projectile: 'fireball', shootEvery: 2.8, aggro: 150, xp: 3, gold: [0, 0], sprite: 'goblin_shamanka',
      flavor: "A GOBLIN WITCH WITH A BONE STAFF AND OPINIONS. HER FIREBALLS ARE SMALL. HER GRUDGES ARE NOT." },
    goblin_bomber: { name: 'GOBLIN BOMB BARD', tier: 1, hp: 7, dmg: 1, speed: 34, w: 13, h: 15, ai: 'bomber',
      projectile: 'dynamite', shootEvery: 2.6, aggro: 150, xp: 3, gold: [0, 0], sprite: 'goblin_bomber', armed: true,
      flavor: "HE PLAYS THE LUTE. HE THROWS LIT DYNAMITE. HE IS TERRIBLE AT ONE OF THOSE. GUESS WHICH. WRONG. BOTH." },
    scatterer: { name: 'SCATTERER', tier: 1, hp: 2, dmg: 1, speed: 52, w: 12, h: 8, ai: 'walker',
      xp: 1, gold: [0, 0], sprite: 'roach', kb: 1.4,
      flavor: "A COCKROACH THE SIZE OF A SHOEBOX. THEY SCATTER WHEN YOU SHOW UP. THEY COME BACK WITH FRIENDS. STEP ON THEM." },
    brood_guardian: { name: 'BROOD GUARDIAN', tier: 1, hp: 10, dmg: 2, speed: 38, w: 18, h: 11, ai: 'chaser',
      aggro: 120, xp: 4, gold: [0, 0], sprite: 'brood_guardian', kb: 0.6,
      flavor: "MOM. A CAT-SIZED ROACH WITH MANDIBLES LIKE HEDGE SHEARS. YOU JUST STOMPED HER KIDS. SHE NOTICED." },
    bad_llama: { name: 'BAD LLAMA', tier: 1, hp: 12, dmg: 2, speed: 30, w: 20, h: 24, ai: 'shooter',
      projectile: 'lava_spit', shootEvery: 2.6, aggro: 140, xp: 5, gold: [0, 0], sprite: 'bad_llama', kb: 0.5, throatWeak: true,
      flavor: "SPITS LAVA. DEALS METH. WHEN IT WINDS UP TO SPIT, THE THROAT POUCH GLOWS. PUNCH THE GLOW. TRUST ME ON THIS ONE." },
    rot_sticker: { name: 'ROT STICKER', tier: 1, hp: 2, dmg: 3, speed: 44, w: 10, h: 8, ai: 'walker',
      xp: 2, gold: [0, 0], sprite: 'rot_sticker', kb: 1.2, dropper: true,
      flavor: "A BLACK RAVIOLI WITH LEGS. DROPS FROM THE CEILING, HUGS YOU, EXPLODES. PRESS ATTACK TO FLICK IT OFF. ROMANCE IS DEAD." },
    trog_pygmy: { name: 'TROGLODYTE PYGMY', tier: 1, hp: 7, dmg: 1, speed: 50, w: 12, h: 15, ai: 'jumper',
      jump: 240, aggro: 130, xp: 3, gold: [0, 0], sprite: 'trog_pygmy', armed: true,
      flavor: "THREE FEET TALL. KOMODO DRAGON HEAD. KANGAROO LEGS. VENOMOUS. SOMEBODY UPSTAIRS WAS DRINKING WHEN THEY DESIGNED THIS." },
    trog_basher: { name: 'TROGLODYTE BASHER', tier: 1, hp: 18, dmg: 2, speed: 34, w: 16, h: 22, ai: 'chaser',
      aggro: 130, armor: 1, kb: 0.4, xp: 7, gold: [0, 0], sprite: 'trog_basher',
      flavor: "A TROGLODYTE WHO SKIPPED THE PYGMY PHASE AND WENT STRAIGHT TO FISTS. KICKS AND BOMBS GET THROUGH. PUNCHES, LESS SO." },
    trog_virtuoso: { name: 'TROGLODYTE VIRTUOSO', tier: 1, hp: 9, dmg: 1, speed: 30, w: 12, h: 15, ai: 'shooter',
      projectile: 'tongue', shootEvery: 2.0, aggro: 90, xp: 4, gold: [0, 0], sprite: 'trog_virtuoso',
      flavor: "HIS TONGUE IS FIFTEEN FEET LONG AND HE IS VERY PROUD OF IT. HE WILL SHOW YOU. WETLY. STAY OUT OF RANGE OR GET IN CLOSE." },
    tuskling: { name: 'TUSKLING', tier: 1, hp: 5, dmg: 1, speed: 28, w: 12, h: 16, ai: 'walker',
      xp: 2, gold: [0, 0], sprite: 'tuskling', kb: 1,
      flavor: "A TINY PIG-ORC ARISTOCRAT IN A DENTED HELMET, DAZED AND SQUEALING. UNTIL RECENTLY HE WAS PART OF A BALL. NOT THE DANCING KIND." },

    /* ----- floor 2 ----- */
    brindle_grub: { name: 'BRINDLE GRUB', tier: 2, hp: 14, dmg: 2, speed: 22, w: 16, h: 8, ai: 'walker',
      xp: 3, gold: [1, 2], sprite: 'brindle_grub', kb: 1,
      flavor: "A FUZZY TORTOISESHELL WORM THE SIZE OF A CAT. EATS CORPSES, MAKES MORE GRUBS. WE CALL IT RECYCLING. YOU CALL IT A PROBLEM." },
    cow_grub: { name: 'COW-TAILED BRINDLE GRUB', tier: 2, hp: 24, dmg: 2, speed: 28, w: 20, h: 10, ai: 'chaser',
      aggro: 110, xp: 5, gold: [1, 3], sprite: 'cow_grub', kb: 0.6,
      flavor: "A GRUB THAT ATE ENOUGH DEAD THINGS TO GROW A TAIL. NEXT STOP: GIANT HORNET. KILL IT NOW, WHILE IT IS ONLY DISGUSTING." },
    dingo: { name: 'DANGER DINGO', tier: 2, hp: 20, dmg: 3, speed: 50, w: 22, h: 14, ai: 'charger',
      chargeSpeed: 210, aggro: 160, xp: 6, gold: [1, 3], sprite: 'dingo',
      flavor: "MASTIFF-SIZED. CORPSE PAINT. FANGS LIKE STEAK KNIVES. LISTENS TO NORWEGIAN BLACK METAL. IS HE A GOOD BOY? HE IS NOT." },
    mind_horror: { name: 'MIND HORROR', tier: 2, hp: 16, dmg: 2, speed: 34, w: 14, h: 18, ai: 'flyer', flying: true,
      aura: { r: 60, dmg: 1, every: 2.5 }, aggro: 150, xp: 6, gold: [1, 3], sprite: 'mind_horror',
      flavor: "A FLOATING BRAIN JELLYFISH. STAND NEAR IT AND YOUR HEAD THROBS. STAND FAR AWAY AND ONLY YOUR SELF ESTEEM THROBS." },
    clurichaun: { name: 'UNVACCINATED CLURICHAUN', tier: 2, hp: 16, dmg: 2, speed: 32, w: 12, h: 16, ai: 'shooter',
      projectile: 'pebble', shootEvery: 2.2, aggro: 160, taint: 5, armed: true, xp: 5, gold: [2, 5], sprite: 'clurichaun',
      flavor: "A HILLBILLY LEPRECHAUN WITH A SLINGSHOT AND A WET NOSE. HE HAS THE TAINT. CATCH IT AND NOTHING HEALS YOU. NOTHING." },
    laminak: { name: 'LAMINAK CONSULTANT', tier: 2, hp: 22, dmg: 2, speed: 46, w: 14, h: 14, ai: 'flyer', flying: true,
      projectile: 'missile', shootEvery: 2.8, aggro: 170, xp: 8, gold: [2, 6], sprite: 'laminak',
      flavor: "A FAT FLYING FAIRY IN A LEAF PANTSUIT. SHE HAS AN EXCITING BUSINESS OPPORTUNITY FOR YOU. IT IS MAGIC MISSILE. TO THE FACE." },
    vespa: { name: 'BRINDLED VESPA', tier: 2, hp: 28, dmg: 3, speed: 52, w: 22, h: 18, ai: 'flyer', flying: true,
      projectile: 'acid', shootEvery: 3.0, aggro: 170, xp: 9, gold: [2, 6], sprite: 'vespa',
      flavor: "THIS IS WHAT A GRUB BECOMES IF YOU LET IT. A HORNET THE SIZE OF A MAN. WITH HANDS. SOMEBODY LET IT." },
    kobold: { name: 'KOBOLD', tier: 2, hp: 15, dmg: 2, speed: 44, w: 11, h: 14, ai: 'chaser',
      aggro: 130, armed: true, xp: 4, gold: [1, 4], sprite: 'kobold',
      flavor: "AN UPRIGHT CHIHUAHUA IN BEER-TAB CHAINMAIL AND A SPIKED CAP. IT YAPS. IT STABS. IT YAPS ABOUT THE STABBING." },
    kobold_rider: { name: 'KOBOLD DINGO RIDER', tier: 2, hp: 32, dmg: 3, speed: 40, w: 26, h: 22, ai: 'charger',
      chargeSpeed: 230, aggro: 180, armor: 1, kb: 0.3, armed: true, xp: 11, gold: [3, 7], sprite: 'kobold_rider',
      flavor: "A KOBOLD WITH A FEATHERED LANCE ON A DANGER DINGO. A KNIGHT, TECHNICALLY. A CHIHUAHUA RIDING A WOLF, ACTUALLY." }
  };

  /* ---------------- projectiles ----------------
     gravity > 0 arcs. Optional flags read by stage.js if supported:
     taint (seconds of no-healing on hit), fire (burns where it lands),
     explode (blast radius px on impact). `missile` is the laminak's spell
     (Donut's own missile is built into stage.js). */
  D.projectiles = {
    arrow:     { sprite: 'arrow',     w: 8,  h: 3, speed: 150, dmg: 1, gravity: 0,   life: 3 },
    rock:      { sprite: 'rock',      w: 6,  h: 6, speed: 120, dmg: 1, gravity: 360, life: 3 },
    fireball:  { sprite: 'fireball',  w: 8,  h: 8, speed: 110, dmg: 1, gravity: 0,   life: 3 },
    bottle:    { sprite: 'bottle',    w: 6,  h: 8, speed: 120, dmg: 2, gravity: 380, life: 3 },
    spore:     { sprite: 'spore',     w: 6,  h: 6, speed: 50,  dmg: 1, gravity: 30,  life: 5 },
    bolt:      { sprite: 'bolt',      w: 8,  h: 4, speed: 200, dmg: 2, gravity: 0,   life: 2.5 },
    missile:   { sprite: 'missile',   w: 8,  h: 4, speed: 150, dmg: 2, gravity: 0,   life: 2.6 },
    lava_spit: { sprite: 'lava_spit', w: 7,  h: 6, speed: 125, dmg: 2, gravity: 160, life: 3 },
    plate:     { sprite: 'plate',     w: 10, h: 10, speed: 125, dmg: 2, gravity: 420, life: 3, fire: true },
    snot:      { sprite: 'snot',      w: 8,  h: 7, speed: 115, dmg: 2, gravity: 90,  life: 3, taint: 5 },
    acid:      { sprite: 'acid',      w: 6,  h: 6, speed: 130, dmg: 2, gravity: 200, life: 3 },
    pebble:    { sprite: 'pebble',    w: 4,  h: 4, speed: 175, dmg: 1, gravity: 60,  life: 2.5, taint: 4 },
    tongue:    { sprite: 'tongue',    w: 12, h: 4, speed: 260, dmg: 1, gravity: 0,   life: 0.24 },
    dynamite:  { sprite: 'dynamite',  w: 6,  h: 8, speed: 115, dmg: 3, gravity: 380, life: 3, explode: 24 },
    junk:      { sprite: 'junk',      w: 8,  h: 8, speed: 110, dmg: 2, gravity: 360, life: 3 }
  };

  /* ---------------- bosses ----------------
     hp ~ 40x the expected punch at that point of the story; 45-90 s fights.
     New primitives (stage.js): roll, tentacle, sweep, mist:S, frenzy:N, scream,
     flex:S, throw:PROJ:N. Floor 1 bosses drop no gold (boxes instead). */
  D.bosses = {
    murder_dozer: { name: 'GOBLIN MURDER DOZER', title: 'A STEAM TANK FULL OF GOBLINS',
      hp: 80, dmg: 3, w: 72, h: 44, sprite: 'murder_dozer', xp: 25, gold: [0, 0], flying: false, armor: 'front',
      phases: [
        { below: 1.0, speed: 34, pattern: ['walk:2', 'shoot:junk:2', 'idle:1', 'charge', 'idle:1.6', 'walk:1.5', 'rain:junk:3', 'idle:1.2'] },
        { below: 0.5, speed: 46, pattern: ['charge', 'idle:1.2', 'spawn:goblin:2', 'shoot:junk:3', 'charge', 'idle:1', 'rain:junk:4', 'idle:1'] }
      ],
      intro: ["IT IS A TRACTOR. IT IS A TANK. IT IS FULL OF GOBLINS. THE FRONT IS ARMORED, GENIUS. GO AROUND IT.",
        "SEE THE GLOWING BOILER ON ITS ASS? GLOWING THINGS ARE WEAK POINTS. THAT IS YOUR ONE FREE TIP TODAY. BOMBS ALSO WORK."],
      defeat: "THE MURDER DOZER IS SCRAP! THE GOBLINS INSIDE ARE NOW A FINE PINK MIST. TEN OUT OF TEN. NO NOTES.",
      loot: 'boss', unlock: null },

    hoarder: { name: 'THE HOARDER', title: 'QUEEN OF THE GARBAGE MOUNTAIN',
      hp: 130, dmg: 2, w: 52, h: 58, sprite: 'hoarder', xp: 40, gold: [0, 0], flying: false,
      phases: [
        { below: 1.0, speed: 30, pattern: ['walk:2', 'spawn:scatterer:2', 'idle:1.4', 'charge', 'idle:1.2', 'spawn:scatterer:3', 'jump_slam', 'idle:1.4'] },
        { below: 0.5, speed: 42, pattern: ['spawn:scatterer:3', 'charge', 'idle:0.9', 'rain:junk:5', 'spawn:brood_guardian:1', 'jump_slam', 'idle:1', 'charge', 'idle:1'] }
      ],
      intro: ["OUR FIRST REAL BOSS! FIFTEEN FEET OF WOMAN, FORTY YEARS OF GARBAGE AND EXACTLY ONE TOOTH. NONE OF IT IS FOR SALE.",
        "SHE BIRTHS SCATTERERS OUT OF HER MOUTH. YES. HER MOUTH. KILL ONE THE SECOND IT CRAWLS OUT AND WATCH HER CHOKE ON IT!"],
      defeat: "THE HOARDER IS DOWN! THE HEALTH DEPARTMENT HAS BEEN NOTIFIED. THE HEALTH DEPARTMENT IS ALSO DEAD. EVERYONE IS DEAD.",
      loot: 'boss', unlock: null },

    chieftain: { name: 'GOBLIN WAR CHIEFTAIN', title: 'LORD OF THE GOBLIN WORKSHOP',
      hp: 160, dmg: 2, w: 30, h: 32, sprite: 'chieftain', xp: 45, gold: [0, 0], flying: false,
      phases: [
        { below: 1.0, speed: 46, pattern: ['walk:1.5', 'throw:dynamite:3', 'idle:1', 'spawn:goblin_bomber:2', 'charge', 'idle:1.2', 'jump_slam', 'idle:1'] },
        { below: 0.5, speed: 60, pattern: ['throw:dynamite:5', 'charge', 'jump_slam', 'idle:0.8', 'spawn:goblin_bomber:2', 'shockwave', 'charge', 'idle:0.8'] }
      ],
      intro: ["THE GOBLIN WAR CHIEFTAIN! BONE CROWN, BIG CLEAVER, A BELT OF DYNAMITE. ONE OF THOSE IS GOING TO GO OFF NEXT TO YOU.",
        "THIS WORKSHOP IS PACKED WITH EXPLOSIVES AND FLAMMABLE GOBLINS. PLEASE BE CAREFUL. I AM KIDDING. PLEASE BE THE OPPOSITE OF CAREFUL."],
      defeat: "THE WAR CHIEFTAIN IS DEAD! THE WORKSHOP IS ALL YOURS. TAKE EVERYTHING THAT ISN'T NAILED DOWN. THEN TAKE THE NAILS.",
      loot: 'boss', unlock: null },

    juicer: { name: 'THE JUICER', title: 'BRO OF THE 24 HOUR GYM',
      hp: 220, dmg: 3, w: 44, h: 48, sprite: 'juicer', xp: 60, gold: [0, 0], flying: false,
      phases: [
        { below: 1.0, speed: 40, pattern: ['walk:1.5', 'throw:plate:3', 'idle:0.9', 'charge', 'idle:1', 'flex:2', 'walk:1', 'jump_slam', 'idle:1'] },
        { below: 0.55, speed: 54, pattern: ['throw:plate:4', 'charge', 'charge', 'idle:0.8', 'flex:2', 'shockwave', 'jump_slam', 'idle:0.9'] },
        { below: 0.25, speed: 66, pattern: ['charge', 'throw:plate:6', 'idle:0.6', 'flex:1.5', 'jump_slam', 'shockwave', 'charge', 'idle:0.7'] }
      ],
      intro: ["BRO. BRO. HE NEEDS A SPOT, BRO. HE HAS NEEDED A SPOT SINCE THE DAWN OF TIME. NOBODY HAS EVER SPOTTED HIM.",
        "WHEN HE FLEXES, THE VEINS COME OUT. HIT THE VEINS FOR DOUBLE DAMAGE. DO NOT TELL HIM I SAID THAT. HE IS VERY SENSITIVE."],
      defeat: "THE JUICER HAS RACKED HIS LAST REP! HIS PROTEIN TUB IS NOW A CRIME SCENE. THE GYM IS UNDER NEW MANAGEMENT: A CAT.",
      loot: 'boss', unlock: null },

    ball_of_swine: { name: 'THE BALL OF SWINE', title: 'THE PORKCHOP EXPRESS',
      hp: 340, dmg: 4, w: 56, h: 56, sprite: 'ball_of_swine', xp: 90, gold: [0, 0], flying: false, floorBoss: true,
      phases: [
        { below: 1.0, speed: 30, pattern: ['idle:1.6', 'roll', 'idle:1', 'roll', 'idle:0.8', 'roll', 'idle:2'] },
        { below: 0.65, speed: 40, pattern: ['roll', 'roll', 'idle:1', 'shockwave', 'roll', 'roll', 'idle:1.6'] },
        { below: 0.3, speed: 56, sprite: 'dominatrix', w: 22, h: 30, spawnOnEnter: ['tuskling', 12],
          pattern: ['walk:1.5', 'charge', 'idle:0.8', 'shoot:pebble:3', 'walk:1', 'charge', 'idle:1'] }
      ],
      intro: ["THE BOROUGH BOSS! A HUNDRED PIG-ORC ARISTOCRATS FUSED INTO ONE GIANT BALL BY A CURSE. THEY ROLL. THEY CRUSH. THEY SQUEAL.",
        "STAY UP ON THE REDOUBT. WHEN THE BALL SLAMS A WALL IT GETS DIZZY. THAT IS WHEN YOU HIT IT. AND WHEN IT POPS? OH, YOU WILL SEE."],
      defeat: "THE BALL OF SWINE IS NO MORE! THE BOROUGH IS LIBERATED! THE STAIRWELL IS OPEN! WE HAVE BACON FOR A YEAR!",
      loot: 'boss', unlock: null },

    krakaren: { name: 'THE KRAKAREN CLONE', title: 'MANAGER OF THE REV-UP DISTILLERY',
      hp: 420, dmg: 3, w: 80, h: 72, sprite: 'krakaren', xp: 140, gold: [40, 70], flying: false, gear: 'bigboi_boxers',
      phases: [
        { below: 1.0, speed: 0, pattern: ['idle:1.2', 'tentacle', 'idle:0.8', 'shoot:snot:3', 'idle:0.8', 'sweep', 'idle:1', 'tentacle', 'tentacle', 'idle:1', 'mist:4', 'idle:1'] },
        { below: 0.55, speed: 0, pattern: ['tentacle', 'sweep', 'idle:0.6', 'shoot:snot:4', 'spawn:clurichaun:2', 'tentacle', 'sweep', 'mist:4', 'idle:0.8'] },
        { below: 0.2, speed: 0, pattern: ['tentacle', 'tentacle', 'sweep', 'shoot:snot:5', 'sweep', 'mist:3', 'tentacle', 'idle:0.6'] }
      ],
      intro: ["WAIT. BOSSES CAN LEAVE THEIR ROOMS? APPARENTLY! TWENTY FEET OF PINK OCTOPUS WITH A SOCCER MOM BOB, AND SHE WANTS YOUR MANAGER.",
        "HER TENTACLES ARE COVERED IN TINY SCREAMING MOUTHS. THE SNOT GIVES YOU THE TAINT. THE MIST GIVES YOU MEASLES. LIVE, LAUGH, LOVE!"],
      defeat: "THE KRAKAREN CLONE IS CALAMARI! THE DISTILLERY IS CLOSED UNTIL FURTHER NOTICE. THE MOONSHINE, HOWEVER, IS STILL OPEN.",
      loot: 'boss', unlock: null },

    ralph: { name: 'RALPH', title: 'THE FRENZIED GERBIL',
      hp: 300, dmg: 2, w: 16, h: 14, sprite: 'ralph', xp: 120, gold: [30, 60], flying: false,
      phases: [
        { below: 1.0, speed: 60, pattern: ['idle:1', 'frenzy:3', 'idle:0.8', 'walk:1', 'scream', 'idle:1.2', 'frenzy:3', 'idle:0.8'] },
        { below: 0.5, speed: 76, releaseCages: true, pattern: ['frenzy:4', 'scream', 'idle:0.6', 'frenzy:3', 'walk:0.8', 'scream', 'spawn:kobold:2', 'idle:0.8'] }
      ],
      intro: ["THE KOBOLD BOSS IS... A GERBIL. ONE ADORABLE LITTLE GERBIL NAMED RALPH. LOOK AT HIS FACE. NOW LOOK AT HIS MOUTH. NOW RUN.",
        "HE IS TINY. PUNCHES WHIFF. FEET DO NOT. THE CAGED DINGOES ARE HIS BACKUP: FEED THEM BISCUITS OR THEY JOIN THE PARTY."],
      defeat: "RALPH HAS BEEN SQUISHED! THE WHOLE DUNGEON GROANED. WE ALL HEARD IT. THE DADDY TAX HAS BEEN PAID IN FULL.",
      loot: 'boss', unlock: null },

    rage_elemental: { name: 'RAGE ELEMENTAL', title: 'LEVEL 93. PEE ACTIVATED.', pursuer: true,
      hp: 99999, dmg: 6, w: 72, h: 60, sprite: 'rage_elemental', xp: 0, gold: [0, 0], flying: false,
      phases: [ { below: 1.0, speed: 150, pattern: ['walk:3'] } ],
      intro: ["SOMEBODY PISSED IN THE HALLWAY! YOU KNOW WHAT THAT MEANS: A LEVEL 93 RAGE ELEMENTAL! CONGRATULATIONS, EVERYONE!",
        "YOU CANNOT KILL IT. YOU CANNOT HURT IT. YOU CAN DRIVE. DROP JUGS BEHIND YOU AND KEEP THE CHOPPER MOVING."],
      defeat: "THE RAGE ELEMENTAL FOLLOWED YOU INTO THE STAIRWELL! MOBS ARE NOT ALLOWED ON THE STAIRS. IT DISSOLVED. THAT WAS AN EXPLOIT. WE ARE FURIOUS.",
      loot: 'boss', unlock: null }
  };
})();

/* ==========================================================================
   CHUNKS - 12 rows each, all rows equal width (16-48). Ground rows 10-11 are
   solid '#' at both edges and rows 5-9 at the edge columns are open, so any
   chunk can follow any chunk. Player: <= 3 tiles up, <= 4 across (5 flat).
   Sets: tn_ tunnels (floor 1), ch_ dozer chase, hd_ hoard, gb_ goblin town,
   fc_ burning workshop chase, ride_ chopper roads (Z J O F only here),
   gy_ gym, sw_ ball of swine, cn_ cinderblock maze (floor 2), ds_ distillery,
   pd_ dog pound. Arenas (K) are open on the left (rows 5-9), walled right.
   New chars: A ally spot, N story NPC, C dingo cage, B pet biscuit.
   ========================================================================== */
(function () {
  'use strict';
  var D = window.DCW.data;
  var C = D.chunks = {};

  /* ---------- shared ---------- */
  C.end_door = { rows: [
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '..o.o.o.........',
    '................',
    '.........D......',
    '################',
    '################'] };

  /* ================= TUNNELS (floor 1) ================= */
  C.tn_start = { rows: [
    'XXXXXXXXXXXXXXXXXXXXXXXX',
    'XXXXXXXXXXXXXXXXXXXXXXXX',
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
    '..........o.o.o.........',
    '........................',
    '..P.................b...',
    '########################',
    '########################'] };

  // two pits with a raised island and a coin perch
  C.tn_a = { rows: [
    'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
    '................................',
    '................................',
    '................................',
    '................................',
    '...............ooo..............',
    '................................',
    '..............=====.............',
    '.........o...........o..........',
    '...e.............e............e.',
    '##########....######....########',
    '##########....######....########'] };

  // ladder and two blocks, a secret box on the high shelf
  C.tn_b = { rows: [
    'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
    '................................',
    '................................',
    '.....................?..........',
    '...................=====........',
    '................................',
    '..........H.....................',
    '.....XXXXXH.........XXXX........',
    '.....XXXXXH.........XXXX........',
    '..e..XXXXXH...e.....XXXX....e...',
    '################################',
    '################################'] };

  // spike floor, two stepping platforms, checkpoint
  C.tn_c = { rows: [
    'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
    '....................................',
    '....................................',
    '....................................',
    '....................................',
    '...........oooo...oooo..............',
    '....................................',
    '..........====...====...............',
    '....................................',
    '..c......^^^^^^^^^^^^^^^......e.....',
    '####################################',
    '####################################'] };

  // crates, a chest under a perch, low ceiling
  C.tn_d = { rows: [
    'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
    'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
    'XXXXXXXXXXXX........XXXXXXXXXXXX',
    '................................',
    '................................',
    '................................',
    '.............ooooo..............',
    '............=======.............',
    '.....b..........................',
    '..e..bb.....e....$.....bb..e....',
    '################################',
    '################################'] };

  // moving platform over a wide pit
  C.tn_e = { rows: [
    'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
    '....................................',
    '....................................',
    '....................................',
    '....................................',
    '....................................',
    '.............o..o..o..o.............',
    '....................................',
    '..............>.....................',
    '..e.......................e.....e...',
    '###########............#############',
    '###########............#############'] };

  // stone steps up and over
  C.tn_f = { rows: [
    'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
    '................................',
    '................................',
    '................................',
    '................................',
    '................o.h.............',
    '...............XXXXX............',
    '...........e.XXXXXXXXX..........',
    '.......XXXXXXXXXXXXXXXXXX.......',
    '..e....XXXXXXXXXXXXXXXXXX....e..',
    '################################',
    '################################'] };

  // high road / low road with spikes, a secret on top
  C.tn_g = { rows: [
    'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
    '....................................',
    '....................................',
    '.........................?..........',
    '.........ooooo.........=====........',
    '........=======.....................',
    '....................................',
    '...=====.........=====..............',
    '....................................',
    '..e........^^^^.........e.....h.....',
    '####################################',
    '####################################'] };

  // crate pile, chest on a shelf, an elite
  C.tn_h = { rows: [
    'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '.....................$..........',
    '...................XXXXX........',
    '.............b..................',
    '..e.........bbb.....E.......e...',
    '################################',
    '################################'] };

  // gap with a ladder back up, coins down below
  C.tn_i = { rows: [
    'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '..........ooo...................',
    '.......XXXXXXXXX................',
    '.......XXXXXXXXX.....e..........',
    '..e....XXXXXXXXX...XXXXXX...m...',
    '######################~~########',
    '################################'] };

  /* tutorial hallway (f1_hall): fixed order start -> b -> c -> end.
     Signs read in order: 1-3 start, 4-5 b, 6-7 c, 8 end. */
  C.tn_hall_start = { rows: [
    'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
    'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
    '........................................',
    '........................................',
    '........................................',
    '........................................',
    '....................ooo.................',
    '...................=====................',
    '..........XX............................',
    '..P.n.....XX.........n........e....n....',
    '########################################',
    '########################################'] };

  C.tn_hall_b = { rows: [
    'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
    '........................................',
    '........................................',
    '........................................',
    '........................................',
    '............................oooo........',
    '........................................',
    '...........................H====........',
    '....b......................H............',
    '..bbb...e....n.........n...H.....e......',
    '########################################',
    '########################################'] };

  C.tn_hall_c = { rows: [
    'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
    '........................................',
    '........................................',
    '........................................',
    '........................................',
    '........................................',
    '..........................o.o...........',
    '..............XX........................',
    '..............XX........................',
    '..n..m..h.....XX..e..c.n.............e..',
    '#########################....###########',
    '#########################....###########'] };

  C.tn_hall_end = { rows: [
    'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '..o.o.o.........................',
    '................................',
    '.....n........e.........D.......',
    '################################',
    '################################'] };

  // f1_llamas insert: the meth stash on a rock shelf, guarded by a big llama
  C.tn_meth = { rows: [
    'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
    '................................',
    '................................',
    '................................',
    '................................',
    '...............Q................',
    '..............XXX...............',
    '..........====..................',
    '................................',
    '..e...........E...........e.....',
    '################################',
    '################################'] };

  // rot sticker rows: low ceilings so the stickers have somewhere to hang
  C.tn_rot_a = { rows: [
    'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
    'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
    'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
    'XXXXXX.......XXXXXXXXX......XXXX',
    'XXXXXX.......XXXXXXXXX......XXXX',
    '................................',
    '.......ooo...............o......',
    '................................',
    '................................',
    '..e......e......e.....e.....e...',
    '################################',
    '################################'] };

  C.tn_rot_b = { rows: [
    'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
    'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
    'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
    'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
    '....................................',
    '....................................',
    '..............o.o.o.................',
    '.............=======................',
    '....................................',
    '..e.....e...................e....h..',
    '###########..........###############',
    '###########..........###############'] };

  C.tn_rot_c = { rows: [
    'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
    'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
    'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
    'XXXXXXXXXX..........XXXXXXXXXXXX',
    'XXXXXXXXXX..........XXXXXXXXXXXX',
    '................................',
    '.............ooooo..............',
    '............=======.............',
    '................................',
    '..c...e....b.....e.....bb...e...',
    '################################',
    '################################'] };

  // troglodyte neighborhood: stacked rock huts, a perch
  C.tn_trog_a = { rows: [
    'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
    '....................................',
    '....................................',
    '...................o.o.o............',
    '...................=====............',
    '.............ooo....................',
    '............XXXXX...................',
    '........XXX.XXXXX...................',
    '........XXX.XXXXX...................',
    '..e.....XXX.XXXXX.....e.......e..h..',
    '####################################',
    '####################################'] };

  // elevator ride to a secret, spikes below
  C.tn_trog_b = { rows: [
    'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
    '....................................',
    '....................................',
    '................?...................',
    '...............===..................',
    '....................................',
    '...........v........................',
    '....................................',
    '....................................',
    '..e.................^^^^.....e......',
    '####################################',
    '####################################'] };

  // the hallway outside Mordecai's guild: the dozer fight (bombs on the floor)
  C.arena_dozer = { rows: [
    'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
    'X....................................X',
    'X....................................X',
    'X....................................X',
    'X...............======...............X',
    '.....................................X',
    '.....................................X',
    '.........=====..........=====........X',
    '.....................................X',
    '..c.m........m.......K......m........X',
    '######################################',
    '######################################'] };

  /* ================= DOZER CHASE (f1_dozer_chase): keep running ================= */
  C.ch_start = { rows: [
    'XXXXXXXXXXXXXXXXXXXXXXXX',
    'XXXXXXXXXXXXXXXXXXXXXXXX',
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
    '........o.o.o.o.........',
    '........................',
    '...P....................',
    '########################',
    '########################'] };

  C.ch_a = { rows: [
    'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '......ooo......ooo......ooo.....',
    '................................',
    '..........e.....................',
    '######...######...######...#####',
    '######...######...######...#####'] };

  C.ch_b = { rows: [
    'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '.......o.......oo...............',
    '................................',
    '...............XX...............',
    '.......X.......XX.....b......e..',
    '################################',
    '################################'] };

  C.ch_c = { rows: [
    'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
    '....................................',
    '....................................',
    '....................................',
    '....................................',
    '..........o.o.....o.o...............',
    '....................................',
    '.........====...====................',
    '....................................',
    '...........................e........',
    '########...............#############',
    '########...............#############'] };

  C.ch_d = { rows: [
    'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '...........ooooo................',
    '..........=======...............',
    '................................',
    '....e.......^^.....b.....h......',
    '################################',
    '################################'] };

  // the tunnel caves in: low ceiling, short pits
  C.ch_e = { rows: [
    'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
    'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
    'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
    'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
    '....................................',
    '....................................',
    '....................................',
    '.......oo.........oo........oo......',
    '....................................',
    '...............e....................',
    '######...#########...#######...#####',
    '######...#########...#######...#####'] };

  // run across a ledge, drop off the far side
  C.ch_f = { rows: [
    'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '.........o.o.o.o.o..............',
    '................................',
    '.......XXXXXXXXXXXXX............',
    '.....XXXXXXXXXXXXXXX.....e......',
    '#####XXXXXXXXXXXXXXX....########',
    '################################'] };

  // the guild hall door at the end of the chase
  C.ch_guild = { rows: [
    'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '...o.o.o.o......................',
    '................................',
    '.....................D..........',
    '################################',
    '################################'] };

  /* ================= HOARD (f1_hoarder) ================= */
  C.hd_start = { rows: [
    'XXXXXXXXXXXXXXXXXXXXXXXX',
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
    '...........o.o.o........',
    '..................X.....',
    '..P..............XX.b...',
    '########################',
    '########################'] };

  // garbage mounds
  C.hd_a = { rows: [
    'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
    '................................',
    '................................',
    '................................',
    '................................',
    '..........o.o.......o...........',
    '.........XXXXX..................',
    '........XXXXXXX....XXX..........',
    '.......XXXXXXXXX..XXXXX.........',
    '..e...XXXXXXXXXXXXXXXXXX....e...',
    '################################',
    '################################'] };

  // broken glass pit with bag platforms
  C.hd_b = { rows: [
    'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
    '....................................',
    '....................................',
    '....................................',
    '...................?................',
    '..................===...............',
    '....................................',
    '.........====..........====.........',
    '....................................',
    '..e.....^^^^^^^^^^^^^^^^^^^^....e...',
    '####################################',
    '####################################'] };

  // sludge puddles, crates of junk
  C.hd_c = { rows: [
    'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '.............ooooo..............',
    '............=======.............',
    '................................',
    '..e..bb.....e..E.........b...h..',
    '#######~~~~######~~~~###########',
    '################################'] };

  // the grimy door with the health notice; the chamber is through it
  C.hd_door = { rows: [
    'XXXXXXXXXXXXXXXXXXXXXXXX',
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
    '..c........n............',
    '########################',
    '########################'] };

  C.arena_hoarder = { rows: [
    'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
    'X......................................X',
    'X......................................X',
    'X......................................X',
    'X......................................X',
    '.......................................X',
    '.......................................X',
    '.......=====.................=====.....X',
    '......................................XX',
    '..h......................K..........XXXX',
    '########################################',
    '########################################'] };

  /* ================= GOBLIN TOWN + WORKSHOP ================= */
  C.gb_start = { rows: [
    'XXXXXXXXXXXXXXXXXXXXXXXX',
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
    '.............o.o.o......',
    '............=======.....',
    '........................',
    '..P..................b..',
    '########################',
    '########################'] };

  // scaffold tower with a ladder
  C.gb_a = { rows: [
    'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
    '..................................',
    '..................................',
    '..............ooo.................',
    '.............H=====...............',
    '.............H....................',
    '.............H.......e............',
    '.......=====.H....=======.........',
    '.............H....................',
    '..e..........H.........e.......e..',
    '##################################',
    '##################################'] };

  // rickety bridge over a gap
  C.gb_b = { rows: [
    'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
    '..................................',
    '..................................',
    '..................................',
    '..................................',
    '..........o.o.o.o.o.o.............',
    '..................................',
    '.........============.............',
    '..................................',
    '..e..........................e....',
    '########..............############',
    '########..............############'] };

  // junk walls and crates, a bomb bard on a perch
  C.gb_c = { rows: [
    'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '...................e............',
    '..........b.......XXX...........',
    '.........bb.......XXX...........',
    '..e.....bbb.......XXX...e....m..',
    '################################',
    '################################'] };

  // gear-wheel platforms going up and down
  C.gb_d = { rows: [
    'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
    '....................................',
    '....................................',
    '....................................',
    '....................................',
    '...........ooo......................',
    '....................................',
    '...........<..........v.............',
    '....................................',
    '..e...............e.............e...',
    '#######.........######......########',
    '#######.........######......########'] };

  // stash shelf with a chest and a secret
  C.gb_e = { rows: [
    'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
    '................................',
    '................................',
    '.......................?........',
    '.....................=====......',
    '................................',
    '................H...............',
    '..........$.....H=====..........',
    '.........XXX....H...............',
    '..e......XXX....H.....E.....e...',
    '################################',
    '################################'] };

  // f1_goblins insert: Rory and Lorelai hanging around (N spots, in order)
  C.gb_sisters = { rows: [
    'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '........o.o.o.o.................',
    '................................',
    '.......N....N.........h.........',
    '################################',
    '################################'] };

  C.arena_chieftain = { rows: [
    'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
    'X....................................X',
    'X....................................X',
    'X....................................X',
    'X....................................X',
    '.....................................X',
    '.....................................X',
    '........=====...........=====........X',
    '.....................................X',
    '..c...m................K.....b.......X',
    '######################################',
    '######################################'] };

  /* ================= BURNING WORKSHOP CHASE (f1_fire) ================= */
  C.fc_start = { rows: [
    'XXXXXXXXXXXXXXXXXXXXXXXX',
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
    '.........m.m............',
    '........................',
    '...P..............b.....',
    '########################',
    '########################'] };

  C.fc_a = { rows: [
    'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '..........o.o.o.................',
    '.........=======................',
    '................................',
    '...b...e..............b...e.....',
    '##############...###############',
    '##############...###############'] };

  C.fc_b = { rows: [
    'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
    '..................................',
    '..................................',
    '..................................',
    '..................................',
    '..................................',
    '..............ooo.................',
    '..................................',
    '.............XXXXX................',
    '.......X.....XXXXX.....m...e......',
    '#######X.....XXXXX....############',
    '##################################'] };

  C.fc_c = { rows: [
    'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '.........o..o..o..o.............',
    '........====...====.............',
    '................................',
    '.....e...................e......',
    '######..............############',
    '######..............############'] };

  C.fc_d = { rows: [
    'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '..............mm................',
    '...........b.........b..........',
    '..e.......bb...^^...bb....h.....',
    '################################',
    '################################'] };

  C.fc_e = { rows: [
    'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
    '....................................',
    '....................................',
    '....................................',
    '....................................',
    '....................................',
    '...........ooo........ooo...........',
    '..........=====......=====..........',
    '....................................',
    '...e................................',
    '########....############....########',
    '########....############....########'] };

  /* ================= RIDES (Goblin Copper Chopper) =================
     Chopper ~170 px/s: plain gaps <= 4 tiles, a 5-tile gap needs a J pad
     right at its edge, overpasses '=' sit at row 7, crates are single,
     no oil within 9 tiles before a gap. Z J O F sit right above ground. */
  C.ride_start = { rows: [
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '.......................o.o.o....',
    '................................',
    '...P............................',
    '################################',
    '################################'] };

  C.ride_a = { rows: [
    '........................................',
    '........................................',
    '........................................',
    '........................................',
    '........................................',
    '........................................',
    '........................................',
    '.....ooo..............ooo...............',
    '........................................',
    '...Z...........b....e..........Z....b...',
    '########################################',
    '########################################'] };

  C.ride_b = { rows: [
    '........................................',
    '........................................',
    '........................................',
    '........................................',
    '........................................',
    '........................................',
    '..........ooo...............ooo.........',
    '........................................',
    '........................................',
    '.....e..............e...................',
    '#########....############....###########',
    '#########....############....###########'] };

  C.ride_c = { rows: [
    '........................................',
    '........................................',
    '........................................',
    '........................................',
    '........................................',
    '...........oooooo.......................',
    '........................................',
    '..........========......................',
    '........................................',
    '......J............e.....b........e.....',
    '########################################',
    '########################################'] };

  C.ride_d = { rows: [
    '........................................',
    '........................................',
    '........................................',
    '........................................',
    '........................................',
    '........................................',
    '..............ooooo.....................',
    '........................................',
    '........................................',
    '..Z........J..........e.......O.........',
    '#############.....######################',
    '#############.....######################'] };

  C.ride_e = { rows: [
    '........................................',
    '........................................',
    '........................................',
    '........................................',
    '........................................',
    '........................................',
    '........................................',
    '...........o.o.o.....o.o.o..............',
    '........................................',
    '....b.....e.......e.......b.......e.....',
    '########################################',
    '########################################'] };

  C.ride_f = { rows: [
    '........................................',
    '........................................',
    '........................................',
    '........................................',
    '........................................',
    '..............ooo.......................',
    '........................................',
    '.......................ooo..............',
    '........................................',
    '...e........J........................Z..',
    '##############.....######....###########',
    '##############.....######....###########'] };

  C.ride_g = { rows: [
    '........................................',
    '........................................',
    '........................................',
    '........................................',
    '........................................',
    '................ooo.....................',
    '........................................',
    '...............=======..................',
    '........................................',
    '..........J..........e.........b........',
    '########################....############',
    '########################....############'] };

  C.ride_h = { rows: [
    '........................................',
    '........................................',
    '........................................',
    '........................................',
    '........................................',
    '........................................',
    '........................................',
    '...ooo.........ooo.........ooo..........',
    '........................................',
    '..Z.....e....Z.....b.....Z.....e........',
    '########################################',
    '########################################'] };

  // f1_ride finish: the spray-painted MEADOW LARK signs
  C.ride_lark = { rows: [
    '........................................',
    '........................................',
    '........................................',
    '........................................',
    '........................................',
    '........................................',
    '........................................',
    '..o.o.o.o...............................',
    '........................................',
    '..........F.............................',
    '########################################',
    '########################################'] };

  // f2_rage finish: the stairwell (drive the elemental onto the stairs)
  C.ride_stairs = { rows: [
    '........................................',
    '........................................',
    '........................................',
    '........................................',
    '........................................',
    '........................................',
    '........................................',
    '..o.o.o.o...............................',
    '........................................',
    '...Z............F.......................',
    '########################################',
    '########################################'] };

  /* ================= GYM (f1_juicer) ================= */
  C.gy_start = { rows: [
    'XXXXXXXXXXXXXXXXXXXXXXXX',
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
    '..........o.o.o.........',
    '........................',
    '..P..............h......',
    '########################',
    '########################'] };

  // weight benches and a rack to climb
  C.gy_a = { rows: [
    'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '...................ooo..........',
    '..................XXXXX.........',
    '.........XX.......XXXXX.........',
    '..e....XXXX.....e.XXXXX...e.....',
    '################################',
    '################################'] };

  // mirror wall platforms over a dropped barbell pit
  C.gy_b = { rows: [
    'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '.........oo.....oo..............',
    '........====...====.............',
    '................................',
    '..e.......................E.....',
    '########............############',
    '########............############'] };

  C.gy_c = { rows: [
    'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
    '....................................',
    '....................................',
    '....................................',
    '....................................',
    '....................................',
    '..............ooooo.................',
    '.............=======................',
    '....................................',
    '..e....bb.......e.....^^^.....e.....',
    '####################################',
    '####################################'] };

  C.arena_juicer = { rows: [
    'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
    'X......................................X',
    'X......................................X',
    'X......................................X',
    'X......................................X',
    '.......................................X',
    '.......................................X',
    '........=====..............=====.......X',
    '.......................................X',
    '..c.h......................K...........X',
    '########################################',
    '########################################'] };

  /* ================= BALL OF SWINE (f1_swine) ================= */
  C.sw_start = { rows: [
    'XXXXXXXXXXXXXXXXXXXXXXXX',
    'XXXXXXXXXXXXXXXXXXXXXXXX',
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
    '.........o.o.o..........',
    '........................',
    '..P...............h.....',
    '########################',
    '########################'] };

  // the outer track: curved walls, a sealed portcullis to peek through
  C.sw_a = { rows: [
    'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
    'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
    'XXXX....................XXXXXXXX',
    'XXX......................XXXXXXX',
    '................................',
    '................................',
    '..........o.o.o.................',
    '.........=======................',
    '................................',
    '..e..................e.......e..',
    '################################',
    '################################'] };

  C.sw_b = { rows: [
    'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
    'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
    '................................',
    '................................',
    '................................',
    '................................',
    '...............ooo..............',
    '..............XXXXX.............',
    '.............XXXXXXX............',
    '..e...m.....XXXXXXXXX.......e...',
    '################################',
    '################################'] };

  /* the redoubt: five ally spots (A) on ledges 4+ tiles above the floor, out of
     the rolling ball's path (the ball is ~56 px tall). Ladders up. */
  C.arena_swine = { rows: [
    'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
    'X..........................................X',
    'X..........................................X',
    'X...................A......................X',
    'X..................=====...................X',
    '.....A.......A.............A......A........X',
    '...=====H...=====........=====.H=====......X',
    '........H......................H...........X',
    '........H......................H...........X',
    '..c.....H.........m.....K......H......m....X',
    '############################################',
    '############################################'] };

  /* ================= CINDERBLOCK MAZE (floor 2) ================= */
  C.cn_start = { rows: [
    'XXXXXXXXXXXXXXXXXXXXXXXX',
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
    '..........o.o.o.........',
    '........................',
    '..P.................b...',
    '########################',
    '########################'] };

  // maze wall you climb over
  C.cn_a = { rows: [
    'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
    '................................',
    '................................',
    '................................',
    '...........ooo..................',
    '................................',
    '..........XXXXX.................',
    '..........XXXXX.......XXX.......',
    '.......XXXXXXXX.......XXX.......',
    '..e....XXXXXXXX...e...XXX...e...',
    '################################',
    '################################'] };

  // corridor with a low ceiling and side pockets
  C.cn_b = { rows: [
    'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
    'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
    'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
    'XXXXXXXX........XXXXXXXXXX......XXXX',
    '....................................',
    '....................................',
    '....................................',
    '...........h...............ooo......',
    '..........===...............=====...',
    '..e........e..........f.......e.....',
    '####################################',
    '####################################'] };

  // pit crossing on cinderblock pillars
  C.cn_c = { rows: [
    'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
    '....................................',
    '....................................',
    '....................................',
    '....................................',
    '.........o.....o.....o.....o........',
    '....................................',
    '.........XX....XX....XX....XX.......',
    '.........XX....XX....XX....XX.......',
    '..e......XX....XX....XX....XX...e...',
    '#######..XX....XX....XX....XX..#####',
    '#######..XX....XX....XX....XX..#####'] };

  // flyer gallery
  C.cn_d = { rows: [
    'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
    '................................',
    '................................',
    '..........f..........f..........',
    '................................',
    '................................',
    '................................',
    '......=====..........=====......',
    '................................',
    '..e.........e....$.......e......',
    '################################',
    '################################'] };

  // ladder up and over a tall wall, a secret behind it
  C.cn_e = { rows: [
    'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
    '..................................',
    '..................................',
    '..............ooooo...............',
    '.............H.....H..............',
    '.............HXXXXXH..............',
    '.............HXXXXXH..............',
    '.............HXXXXXH..............',
    '.............HXXXXXH..............',
    '..e..........HXXXXXH..?..E.....e..',
    '##################################',
    '##################################'] };

  // crumbling floor: spikes and a moving platform
  C.cn_f = { rows: [
    'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
    '....................................',
    '....................................',
    '....................................',
    '....................................',
    '....................................',
    '...........o.o.o.o.o.o..............',
    '....................................',
    '.............>......................',
    '..e.....^^^^^^^^^^^^^^^^^^^.....e...',
    '####################################',
    '####################################'] };

  // stepped blocks and a checkpoint
  C.cn_g = { rows: [
    'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
    '..................................',
    '..................................',
    '..................................',
    '..................................',
    '..................ooo.............',
    '.................XXXXX............',
    '..............XXXXXXXXXXX.........',
    '...........XXXXXXXXXXXXXXXXX......',
    '..c..e.....XXXXXXXXXXXXXXXXX...e..',
    '##################################',
    '##################################'] };

  // a grub nest: crates of corpses and a snack shelf
  C.cn_h = { rows: [
    'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
    '................................',
    '................................',
    '................................',
    '................................',
    '...........................f....',
    '.........h......................',
    '........=====...................',
    '..............b.................',
    '..e...e.....bbb....e.....e...e..',
    '################################',
    '################################'] };

  // pet biscuits on a shelf (floor 2: feed the dingoes later)
  C.cn_bisc = { rows: [
    'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
    '................................',
    '................................',
    '................................',
    '................................',
    '..............B.B...............',
    '.............=====..............',
    '................................',
    '..........XX.........XX.........',
    '..e.......XX....e....XX....e....',
    '################################',
    '################################'] };

  // the stairwell at the end of floor 2 (f2_return)
  C.cn_stairs = { rows: [
    'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '..o.o.o.o.......................',
    '................................',
    '..c...................D.........',
    '################################',
    '################################'] };

  /* ================= REV-UP DISTILLERY (f2_krakaren) ================= */
  C.ds_start = { rows: [
    'XXXXXXXXXXXXXXXXXXXXXXXX',
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
    '..........o.o.o.........',
    '........................',
    '..P..............bb.....',
    '########################',
    '########################'] };

  // copper stills and moonshine puddles
  C.ds_a = { rows: [
    'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
    '..................................',
    '..................................',
    '..................................',
    '..................................',
    '........................f.........',
    '.........ooo......................',
    '........XXXXX.....................',
    '........XXXXX.......=====.........',
    '..e.....XXXXX.....e........e...b..',
    '##############~~~~################',
    '##################################'] };

  // jug racks: crates and platforms
  C.ds_b = { rows: [
    'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
    '....................................',
    '....................................',
    '....................................',
    '...........ooo......................',
    '..........=====.....................',
    '.......................ooo..........',
    '.....=====............=====.........',
    '....................................',
    '..e.......b.b.b....E.......e...bb...',
    '####################################',
    '####################################'] };

  // bicycle blender bay: spikes, a chest, a biscuit
  C.ds_c = { rows: [
    'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
    '................................',
    '................................',
    '................................',
    '................................',
    '...............B................',
    '..............XXX...............',
    '..........=====.................',
    '................................',
    '..e...$..............^^^...e....',
    '################################',
    '################################'] };

  // the krakaren breaks out of her chamber into this hall (stage.breakout)
  C.arena_krakaren = { rows: [
    'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
    'X..........................................X',
    'X..........................................X',
    'X..........................................X',
    'X..........................................X',
    '...........................................X',
    '...........................................X',
    '.......=====........=====..................X',
    '...........................................X',
    '..c...h..................h.......K.........X',
    '############################################',
    '############################################'] };

  /* ================= KOBOLD DOG POUND (f2_ralph) ================= */
  C.pd_start = { rows: [
    'XXXXXXXXXXXXXXXXXXXXXXXX',
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
    '..........o.o.o.........',
    '........................',
    '..P...........B.........',
    '########################',
    '########################'] };

  // kennel rows with roofs to run across
  C.pd_a = { rows: [
    'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
    '....................................',
    '....................................',
    '....................................',
    '....................................',
    '..........o.o.o.........B...........',
    '....................................',
    '.........XXXXXX........XXXXX........',
    '.........XXXXXX........XXXXX........',
    '..e......XXXXXX...e....XXXXX....e...',
    '####################################',
    '####################################'] };

  // chain-link catwalk over a drainage ditch
  C.pd_b = { rows: [
    'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '..........o.B.o.................',
    '.........======...====..........',
    '................................',
    '..e.....................E....h..',
    '########.............###########',
    '########.............###########'] };

  /* Ralph's arena: four caged dingoes (C) on the floor, biscuits (B) around.
     Feed each cage before phase 2 or it opens. */
  C.arena_ralph = { rows: [
    'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
    'X........................................X',
    'X........................................X',
    'X........................................X',
    'X........................................X',
    '.........................................X',
    '.................B.......................X',
    '...............=====..........=====......X',
    '.........................................X',
    '..c.B...C......C.......K.......C.....C...X',
    '##########################################',
    '##########################################'] };
})();

/* ==========================================================================
   STAGES + FLOORS (Book One: two linear floors, story order)
   ========================================================================== */
(function () {
  'use strict';
  var D = window.DCW.data;
  var S = D.stages = {};

  function st(id, o) { o.id = id; S[id] = o; return o; }

  var TN = ['tn_a', 'tn_b', 'tn_c', 'tn_d', 'tn_e', 'tn_f', 'tn_g', 'tn_h', 'tn_i'];
  var CH = ['ch_a', 'ch_b', 'ch_c', 'ch_d', 'ch_e', 'ch_f'];
  var GB = ['gb_a', 'gb_b', 'gb_c', 'gb_d', 'gb_e'];
  var FC = ['fc_a', 'fc_b', 'fc_c', 'fc_d', 'fc_e'];
  var RIDE = ['ride_a', 'ride_b', 'ride_c', 'ride_d', 'ride_e', 'ride_f', 'ride_g', 'ride_h'];
  var CN = ['cn_a', 'cn_b', 'cn_c', 'cn_d', 'cn_e', 'cn_f', 'cn_g', 'cn_h'];

  /* ================= FLOOR 1: THE FIRST FLOOR ================= */
  st('f1_hall', { name: 'THE FIRST HALLWAY', floor: 1, theme: 'tunnels', kind: 'main', music: 'floor1',
    noCompanionAttack: true,
    chunks: { start: 'tn_hall_start', pool: ['tn_hall_b'], count: 1, insert: ['tn_hall_c'], end: 'tn_hall_end' },
    enemies: [['rat', 5], ['goblin', 1]], elite: [['goblin', 1]], flyers: [['rat', 1]],
    reward: { box: 'bronze', xp: 6 },
    intro: "WELCOME TO THE FIRST FLOOR, CRAWLER! THESE ARE OFFICIAL DUNGEON SIGNS. PRESS UP TO READ THEM. THEY ARE THE ONLY THINGS DOWN HERE ON YOUR SIDE.",
    signs: [
      "OFFICIAL DUNGEON SIGN. ARROWS OR WASD TO WALK. JUMP IS Z OR SPACE (PAD: A). HOLD IT TO JUMP HIGHER. LOOK AT YOU, PLATFORMING.",
      "ATTACK IS X (PAD: X). TAP IT FOR A THREE-HIT COMBO. THAT RAT UP AHEAD HAS A FAMILY. DO NOT THINK ABOUT THE FAMILY.",
      "DOWN + ATTACK ON THE GROUND IS A KICK. SLOWER THAN A PUNCH, HITS HARDER. CRATES HATE IT. CRATES HIDE SNACKS AND BOMBS.",
      "IN THE AIR, DOWN + ATTACK IS A DIVING STOMP. LANDING ON A HEAD BOUNCES YOU. YOUR BARE FEET ARE A WEAPON NOW. WE ARE SO SORRY.",
      "UP AND DOWN CLIMB LADDERS. DOWN + JUMP DROPS YOU THROUGH THIN PLATFORMS. THE DUNGEON HAS VERTICALITY. YOU ARE WELCOME.",
      "C THROWS A BOMB (PAD: B). Q DRINKS A HEALTH POTION. TAB OR SELECT OPENS YOUR GEAR. YOU HAVE NO GEAR. ENJOY THE EMPTY SCREEN.",
      "PITS COST HEALTH. FLAGS ARE CHECKPOINTS. YOUR CAT HAS NO SPELLS YET, SO SHE WILL JUST WATCH. SHE IS FURIOUS ABOUT IT.",
      "NOTICE: GUILD HALLS ONLY ADMIT CRAWLERS WHO HAVE KILLED A MOB. NO KILL, NO ENTRY. THIS RULE IS NOT NEGOTIABLE. WE CHECKED."
    ] });

  st('f1_dozer_chase', { name: 'MURDER DOZER!', floor: 1, theme: 'tunnels', kind: 'chase', music: 'chase',
    noCompanionAttack: true, door: 'guild_door',
    pursuer: { id: 'murder_dozer', kind: 'boss', speed: 58, delay: 3, dmg: 3 },
    chunks: { start: 'ch_start', pool: CH, count: 6, end: 'ch_guild' },
    enemies: [['rat', 3], ['goblin', 2]], elite: [['goblin', 1]], flyers: [['rat', 1]],
    reward: { box: 'bronze', xp: 10 },
    intro: "OH NO. IS THAT A STEAM TANK FULL OF GOBLINS? IT IS! RUN, CRAWLER! THE GUILD DOOR IS AT THE END OF THE HALL. DO NOT STOP. DO NOT LOOK BACK." });

  st('f1_dozer', { name: 'OUTSIDE THE GUILD', floor: 1, theme: 'tunnels', kind: 'boss', music: 'boss',
    chunks: { start: 'tn_start', pool: ['tn_d', 'tn_h'], count: 1, end: 'arena_dozer' },
    enemies: [['goblin', 3], ['rat', 1]], elite: [['goblin', 1]], flyers: [['rat', 1]],
    boss: 'murder_dozer', reward: { box: 'boss', xp: 15 },
    intro: "THE MURDER DOZER IS STILL IDLING OUTSIDE THE GUILD. THE FRONT IS ARMORED. THE BACK IS NOT. THE BOMBS ON THE FLOOR ARE A HINT. A BIG ONE." });

  st('f1_llamas', { name: 'LLAMA COUNTRY', floor: 1, theme: 'tunnels', kind: 'main', music: 'floor1',
    questItem: 'meth',
    chunks: { start: 'tn_start', pool: ['tn_a', 'tn_c', 'tn_e', 'tn_g', 'tn_i'], count: 4, insert: ['tn_meth'], end: 'end_door' },
    enemies: [['bad_llama', 3], ['rat', 3], ['scatterer', 2]], elite: [['bad_llama', 1]], flyers: [['scatterer', 1]],
    reward: { box: 'bronze', xp: 12 },
    intro: "LLAMA COUNTRY! THEY SPIT LAVA AND THEY DEAL DRUGS. WHEN ONE WINDS UP, ITS THROAT GLOWS. PUNCH THE GLOW. YOU WILL THANK ME. YOU WILL NOT THANK ME." });

  st('f1_scatter', { name: 'SCATTERER ALLEY', floor: 1, theme: 'tunnels', kind: 'main', music: 'floor1',
    chunks: { start: 'tn_start', pool: ['tn_b', 'tn_d', 'tn_f', 'tn_h', 'tn_a'], count: 4, end: 'end_door' },
    enemies: [['scatterer', 7], ['rat', 1]], elite: [['brood_guardian', 1]], flyers: [['scatterer', 1]],
    reward: { box: 'bronze', xp: 12 },
    intro: "SCATTERER ALLEY! SHOEBOX ROACHES AS FAR AS THE EYE CAN SEE. YOU HAVE BARE FEET. THE MATH IS DISGUSTING. THE MATH IS ALSO VERY EFFECTIVE." });

  st('f1_hoarder', { name: "THE HOARDER'S CHAMBER", floor: 1, theme: 'hoard', kind: 'boss', music: 'boss',
    chunks: { start: 'hd_start', pool: ['hd_a', 'hd_b', 'hd_c'], count: 2, insert: ['hd_door'], end: 'arena_hoarder' },
    enemies: [['scatterer', 4], ['brood_guardian', 1], ['rat', 1]], elite: [['brood_guardian', 1]], flyers: [['scatterer', 1]],
    boss: 'hoarder', reward: { box: 'boss', xp: 20 },
    intro: "SOMETHING IN HERE SMELLS LIKE FORTY YEARS OF YOGURT LIDS. THERE IS A NOTICE ON THE DOOR. IT IS IN SPANISH. IT IS NOT GOOD NEWS.",
    signs: [
      "AVISO DEL DEPARTAMENTO DE SALUD: ESTE LOCAL ESTA CERRADO. (TRANSLATION, FREE OF CHARGE: THIS PLACE IS CONDEMNED. SOMETHING LARGE LIVES INSIDE. HAVE FUN!)"
    ] });

  st('f1_goblins', { name: 'GOBLIN TOWN', floor: 1, theme: 'goblin', kind: 'main', music: 'goblin',
    chunks: { start: 'gb_start', pool: GB, count: 3, insert: ['gb_sisters'], end: 'end_door' },
    enemies: [['goblin', 4], ['goblin_shamanka', 2], ['goblin_bomber', 2]], elite: [['goblin_bomber', 1]], flyers: [['goblin_shamanka', 1]],
    reward: { box: 'bronze', xp: 14 },
    npcs: [
      { sprite: 'rory', portrait: 'p_rory', name: 'RORY', lines: [
        "A HAIRLESS APE WITH A GOBLIN PASS? GO ON THEN, MEAT. YOU HAVE ONE MINUTE BEFORE I GET BORED AND HEX YOUR FACE OFF.",
        "THE BOYS ARE AT WAR WITH THE LLAMAS. THE LLAMAS HAVE THE GOOD STUFF. YOU HAVE ANY OF THE GOOD STUFF, HAIRLESS?"] },
      { sprite: 'lorelai', portrait: 'p_lorelai', name: 'LORELAI', lines: [
        "OH MY GOD, IS THAT A CAT? IS SHE A PRINCESS? SHE LOOKS LIKE A PRINCESS. RORY, LOOK. SHE HAS A CROWN.",
        "MY SISTER SAYS NOT TO TALK TO CRAWLERS. MY SISTER ALSO HEXED A TOAD INTO HER HUSBAND. I MAKE MY OWN CHOICES."] }
    ],
    intro: "GOBLIN TOWN! YOUR GOBLIN PASS SAYS THEY SHOULD LEAVE YOU ALONE. MOST OF THEM CANNOT READ. THE ONES WHO CAN ARE THROWING DYNAMITE." });

  st('f1_workshop', { name: 'THE GOBLIN WORKSHOP', floor: 1, theme: 'goblin', kind: 'boss', music: 'boss',
    chunks: { start: 'gb_start', pool: ['gb_c', 'gb_e'], count: 1, end: 'arena_chieftain' },
    enemies: [['goblin', 3], ['goblin_bomber', 2]], elite: [['goblin_bomber', 1]], flyers: [['goblin_shamanka', 1]],
    boss: 'chieftain', reward: { box: 'boss', xp: 20 },
    intro: "THE WORKSHOP! COPPER, TOOLS, BARRELS OF GOBLIN DYNAMITE AND ONE VERY ANGRY CHIEFTAIN. NOTHING HERE IS NAILED DOWN. WHAT A COINCIDENCE." });

  st('f1_fire', { name: 'GODDAMNIT, DONUT', floor: 1, theme: 'goblin', kind: 'chase', music: 'chase',
    pursuer: { id: 'fire', kind: 'fire', speed: 64, delay: 2, dmg: 3 },
    chunks: { start: 'fc_start', pool: FC, count: 6, end: 'end_door' },
    enemies: [['goblin', 3], ['goblin_bomber', 1], ['rat', 1]], elite: [['goblin', 1]], flyers: [['goblin', 1]],
    reward: { box: 'silver', xp: 16 },
    intro: "SOMEBODY CAST MAGIC MISSILE AT A BARREL OF DYNAMITE. THE WORKSHOP IS ON FIRE. THE FIRE IS CHASING YOU. THE DYNAMITE IS EVERYWHERE. RUN!" });

  st('f1_rot', { name: 'ROT STICKER ROW', floor: 1, theme: 'tunnels', kind: 'main', music: 'tension',
    chunks: { start: 'tn_start', pool: ['tn_rot_a', 'tn_rot_b', 'tn_rot_c', 'tn_d', 'tn_i'], count: 4, end: 'end_door' },
    enemies: [['rot_sticker', 5], ['rat', 2], ['goblin', 2]], elite: [['goblin_bomber', 1]], flyers: [['rot_sticker', 1]],
    reward: { box: 'bronze', xp: 14 },
    intro: "LOOK UP. NO, REALLY. THOSE BLACK RAVIOLI ON THE CEILING ARE ROT STICKERS. THEY DROP, THEY HUG, THEY EXPLODE. PRESS ATTACK TO SHAKE ONE OFF." });

  st('f1_ride', { name: '100 MILES EAST', floor: 1, theme: 'tunnels', kind: 'ride', music: 'ride',
    ride: { finishText: 'MEADOW LARK THIS WAY' },
    chunks: { start: 'ride_start', pool: RIDE, count: 10, end: 'ride_lark' },
    enemies: [['goblin', 3], ['rat', 3], ['bad_llama', 1], ['trog_pygmy', 1]], elite: [['trog_basher', 1]], flyers: [['scatterer', 1]],
    reward: { box: 'silver', xp: 18 },
    intro: "THE GOBLIN COPPER CHOPPER, EVERYBODY! A AND JUMP TO HOP, ATTACK TO PUNCH FROM THE SADDLE, BOMB DROPS ONE BEHIND YOU. HEAD EAST. KEEP HEADING EAST." });

  st('f1_trogs', { name: 'TROGLODYTE NEIGHBORHOOD', floor: 1, theme: 'tunnels', kind: 'main', music: 'floor1',
    chunks: { start: 'tn_start', pool: ['tn_trog_a', 'tn_trog_b', 'tn_c', 'tn_f', 'tn_g', 'tn_h'], count: 4, end: 'end_door' },
    enemies: [['trog_pygmy', 4], ['trog_virtuoso', 2], ['rat', 2]], elite: [['trog_basher', 1]], flyers: [['trog_pygmy', 1]],
    reward: { box: 'bronze', xp: 16 },
    intro: "TROGLODYTE COUNTRY! THE LITTLE ONES JUMP. THE BIG ONES PUNCH. THE MEDIUM ONES HAVE FIFTEEN-FOOT TONGUES. EVERYONE HERE IS VENOMOUS. SMILE!" });

  st('f1_juicer', { name: 'THE 24 HOUR GYM', floor: 1, theme: 'gym', kind: 'boss', music: 'gym',
    chunks: { start: 'gy_start', pool: ['gy_a', 'gy_b', 'gy_c'], count: 2, end: 'arena_juicer' },
    enemies: [['trog_pygmy', 3], ['trog_virtuoso', 1]], elite: [['trog_basher', 1]], flyers: [['trog_pygmy', 1]],
    boss: 'juicer', reward: { box: 'boss', xp: 24 },
    intro: "A 24-HOUR GYM IN A DUNGEON. THE POSTER SAYS TODAY IS THE DAY YOU GAIN. SOMEWHERE IN THE BACK, SOMEONE IS GRUNTING. LOUDLY. RHYTHMICALLY." });

  st('f1_swine', { name: 'THE BALL OF SWINE', floor: 1, theme: 'swine', kind: 'boss', music: 'boss_final',
    allies: ['brandon', 'chris', 'yolanda', 'imani', 'agatha'], door: 'stairwell',
    chunks: { start: 'sw_start', pool: ['sw_a', 'sw_b'], count: 1, end: 'arena_swine' },
    enemies: [['tuskling', 3], ['rat', 1]], elite: [['tuskling', 1]], flyers: [['tuskling', 1]],
    boss: 'ball_of_swine', reward: { box: 'boss', xp: 30 },
    intro: "BOROUGH BOSS TIME! MEADOW LARK HAS THE REDOUBT. CLIMB UP, STAY UP, AND HIT THE BALL WHEN IT SLAMS A WALL. THE STAIRWELL IS IN THE MIDDLE!" });

  /* ================= FLOOR 2: THE SECOND FLOOR ================= */
  var JAN = { id: 'brindle_grub', chance: 0.3, cap: 8 };

  st('f2_maze', { name: 'THE CINDERBLOCK MAZE', floor: 2, theme: 'cinder', kind: 'main', music: 'floor2',
    janitor: JAN,
    chunks: { start: 'cn_start', pool: ['cn_a', 'cn_b', 'cn_c', 'cn_d', 'cn_g', 'cn_h'], count: 5, end: 'end_door' },
    enemies: [['brindle_grub', 4], ['dingo', 2], ['mind_horror', 1]], elite: [['cow_grub', 1]], flyers: [['mind_horror', 1]],
    reward: { box: 'silver', xp: 30 },
    intro: "THE SECOND FLOOR! WHITE FLOORS, ORANGE LICHEN, A MAZE THAT GOES ON FOREVER. THE GRUBS EAT THE DEAD AND MULTIPLY. SO KILL TIDILY." });

  st('f2_revup', { name: 'REV-UP COUNTRY', floor: 2, theme: 'cinder', kind: 'main', music: 'floor2',
    janitor: JAN,
    chunks: { start: 'cn_start', pool: ['cn_a', 'cn_c', 'cn_d', 'cn_e', 'cn_f', 'cn_bisc'], count: 4, end: 'end_door' },
    enemies: [['clurichaun', 4], ['brindle_grub', 2]], elite: [['laminak', 1]], flyers: [['laminak', 1]],
    reward: { box: 'silver', xp: 32 },
    intro: "REV-UP COUNTRY! THE CLURICHAUNS HAVE SLINGSHOTS AND THE TAINT. THE LAMINAKS HAVE A PYRAMID SCHEME. WHILE TAINTED, NOTHING HEALS. NOTHING!" });

  st('f2_krakaren', { name: 'THE REV-UP DISTILLERY', floor: 2, theme: 'distillery', kind: 'boss', music: 'boss',
    breakout: true,
    chunks: { start: 'ds_start', pool: ['ds_a', 'ds_b', 'ds_c'], count: 2, end: 'arena_krakaren' },
    enemies: [['clurichaun', 3], ['brindle_grub', 1]], elite: [['laminak', 1]], flyers: [['laminak', 1]],
    boss: 'krakaren', reward: { box: 'boss', xp: 40 },
    intro: "THE REV-UP DISTILLERY. LIVE, LAUGH, LOVE OVER THE DOOR. THE BOSS ROOM IS UP AHEAD AND YOU ARE SKIPPING IT. SMART! SHE DISAGREES." });

  st('f2_rage', { name: 'THE DRIVE OF A LIFETIME', floor: 2, theme: 'cinder', kind: 'ride', music: 'rage',
    pursuer: { id: 'rage_elemental', kind: 'boss', speed: 150, delay: 3, dmg: 6 },
    ride: { finishText: 'THE STAIRWELL' }, door: 'stairwell',
    chunks: { start: 'ride_start', pool: RIDE, count: 10, end: 'ride_stairs' },
    enemies: [['brindle_grub', 3], ['dingo', 1], ['clurichaun', 1]], elite: [['cow_grub', 1]], flyers: [['brindle_grub', 1]],
    reward: { box: 'gold', xp: 60 },
    intro: "THE WHOLE GALAXY IS WATCHING! ONE MAN, HIS EX'S CAT AND A COPPER CHOPPER VERSUS A LEVEL 93 RAGE ELEMENTAL. DRIVE IT INTO THE STAIRWELL. GO!" });

  st('f2_kobolds', { name: 'KOBOLD COUNTRY', floor: 2, theme: 'cinder', kind: 'main', music: 'floor2',
    janitor: JAN,
    chunks: { start: 'cn_start', pool: ['cn_a', 'cn_c', 'cn_e', 'cn_f', 'cn_g', 'cn_bisc'], count: 5, end: 'end_door' },
    enemies: [['kobold', 4], ['dingo', 2], ['cow_grub', 1]], elite: [['kobold_rider', 1]], flyers: [['vespa', 1]],
    reward: { box: 'silver', xp: 36 },
    intro: "KOBOLD COUNTRY! CHIHUAHUA MEN IN BEER-TAB ARMOR, RIDING DANGER DINGOES WITH LANCES. PICK UP ANY PET BISCUITS YOU SEE. TRUST ME." });

  st('f2_ralph', { name: 'THE MUNICIPAL DOG POUND', floor: 2, theme: 'pound', kind: 'boss', music: 'boss',
    chunks: { start: 'pd_start', pool: ['pd_a', 'pd_b'], count: 1, end: 'arena_ralph' },
    enemies: [['kobold', 3], ['dingo', 1]], elite: [['kobold_rider', 1]], flyers: [['vespa', 1]],
    boss: 'ralph', reward: { box: 'boss', xp: 40 },
    intro: "A PORTUGUESE MUNICIPAL DOG POUND. CAGED DINGOES LINE THE WALLS. STAND BY A CAGE AND PRESS UP TO FEED IT A BISCUIT. THE BOSS IS... SMALL." });

  st('f2_return', { name: 'THE LONG WAY BACK', floor: 2, theme: 'cinder', kind: 'main', music: 'floor2',
    extraAlly: 'mongo', door: 'stairwell',
    janitor: { id: 'brindle_grub', chance: 0.5, cap: 12 },
    chunks: { start: 'cn_start', pool: ['cn_b', 'cn_c', 'cn_d', 'cn_f', 'cn_h', 'cn_g'], count: 4, end: 'cn_stairs' },
    enemies: [['brindle_grub', 4], ['cow_grub', 2], ['dingo', 1]], elite: [['cow_grub', 1]], flyers: [['vespa', 2]],
    reward: { box: 'gold', xp: 40 },
    intro: "THE GRUBS HAVE HIT THE SPAWN LIMIT AND THE BIG ONES ARE HATCHING INTO VESPAS. BACK TO THE STAIRWELL! THE NEW DINOSAUR WILL HELP. HE BITES." });

  /* ---------------- quest items ---------------- */
  D.questItems = {
    meth: { name: 'BAGGIE OF TRAILER-PARK-GRADE METH', floor: 1, sprite: 'qi_meth',
      desc: "A ZIPLOCK BAGGIE OF BLUE-ISH CRYSTALS FROM A LLAMA STASH. THE GOBLINS WOULD TRADE THEIR MOTHERS FOR THIS. AND A MOTORCYCLE.",
      hint: "THE LLAMAS KEEP A STASH UP ON A ROCK SHELF IN LLAMA COUNTRY. SHE'S GUARDED. DON'T SMOKE IT, KID. TRADE IT." }
  };

  /* ---------------- the ride vehicle ----------------
     Used by kind 'ride' stages (no rivals). The parent race engine reads
     D.truck; D.racers stays empty in Book One. */
  D.truck = { name: 'GOBLIN COPPER CHOPPER', sprite: 'chopper', speed: 170, accel: 140, hp: 30,
    desc: "A MISMATCHED COPPER SCRAP BIKE WITH A THUMPING STEAM ENGINE, AN ALLIGATOR-SKULL SEAT, AND A SIDECAR FIT FOR A PRINCESS." };
  D.racers = {};

  /* ---------------- floors ---------------- */
  D.floors = [
    { n: 1, name: 'THE FIRST FLOOR', tagline: 'COLLAPSE IN FIVE DAYS. NOBODY IS WATCHING. YET.', theme: 'tunnels', music: 'floor1',
      days: 5, viewers: false, overworld: null,
      intro: ["WELCOME TO THE FIRST FLOOR OF THE WORLD DUNGEON, CRAWLER! THIRTY-FOOT STONE HALLS, TORCHES, RATS. SO MANY RATS.",
        "THIS FLOOR IS CLOSED TO LIVE VIEWERS. NOBODY CAN SEE YOU DIE. PRACTICE YOUR DYING. THE STAIRS CLOSE IN FIVE DAYS. TICK TOCK!"],
      sequence: ['CUT:f1_entrance', 'f1_hall', 'f1_dozer_chase', 'CUT:f1_mordecai', 'SAFE:guild', 'f1_dozer', 'f1_llamas', 'f1_scatter',
        'SAFE:tally', 'f1_hoarder', 'CUT:f1_episode1', 'f1_goblins', 'CUT:f1_chopper', 'f1_workshop', 'f1_fire', 'f1_rot', 'SAFE:cookie',
        'CUT:f1_frank', 'f1_ride', 'CUT:f1_meadowlark', 'f1_trogs', 'f1_juicer', 'SAFE:guild2', 'CUT:f1_swine_plan', 'f1_swine', 'CUT:f1_odette'],
      required: [], boss: 'f1_swine', par: 2400 },
    { n: 2, name: 'THE SECOND FLOOR', tagline: 'SIX DAYS. THE CAMERAS ARE LIVE. DO NOT PEE.', theme: 'cinder', music: 'floor2',
      days: 6, viewers: true, overworld: null,
      intro: ["WELCOME TO THE SECOND FLOOR, BITCHES! SIX DAYS, THE LEGAL MINIMUM. A CINDERBLOCK MAZE FULL OF THINGS THAT EAT THINGS.",
        "AND THE VIEWERS ARE LIVE! FOLLOWERS, FAVORITES, SPONSORS. EVERY KILL IS CONTENT NOW. MAKE IT PRETTY. OR AT LEAST MAKE IT LOUD."],
      sequence: ['CUT:f2_welcome', 'f2_maze', 'SAFE:shelter', 'f2_revup', 'CUT:f2_jug', 'f2_krakaren', 'SAFE:bugaboo', 'CUT:f2_jack',
        'f2_rage', 'CUT:f2_deathwatch', 'f2_kobolds', 'f2_ralph', 'CUT:f2_menagerie', 'f2_return', 'CUT:f2_descent'],
      required: [], boss: 'f2_ralph', par: 1800 }
  ];
})();
/* ==========================================================================
   LOOT, SHOP, SKINS, COMPANIONS, ACHIEVEMENTS
   ========================================================================== */
(function () {
  'use strict';
  var D = window.DCW.data;

  D.boxTiers = {
    bronze:    { name: 'BRONZE ADVENTURER BOX', color: '#c87838', rank: 1 },
    silver:    { name: 'SILVER ADVENTURER BOX', color: '#bcbcbc', rank: 2 },
    gold:      { name: 'GOLD ADVENTURER BOX', color: '#f8b800', rank: 3 },
    platinum:  { name: 'PLATINUM ADVENTURER BOX', color: '#a4e4fc', rank: 4 },
    legendary: { name: 'LEGENDARY BOX', color: '#f878f8', rank: 5 },
    fan:       { name: 'FAN BOX', color: '#f85898', rank: 2 },
    boss:      { name: 'BOSS BOX', color: '#e40058', rank: 4 }
  };

  /* gold amounts are floor-1 values; game.js scales them by floor.
     Cosmetics: bronze ~3% per roll, silver ~6%, gold ~12%, platinum ~20%,
     fan ~10%, boss ~10%; legendary always has one (guaranteed). Companions are
     never in loot (Update 2): they are rescued from cages on floors 2-7. */
  D.lootTables = {
    bronze: { rolls: 2, entries: [
      [{ kind: 'gold', min: 8, max: 20 }, 40],
      [{ kind: 'item', id: 'potion', count: 1 }, 17],
      [{ kind: 'item', id: 'bomb', count: 2 }, 16],
      [{ kind: 'xp', amount: 12 }, 12],
      [{ kind: 'stat', any: true, amount: 1 }, 4],
      [{ kind: 'hp', amount: 1 }, 3],
      [{ kind: 'skin', any: true }, 2]
    ] },
    silver: { rolls: 3, entries: [
      [{ kind: 'gold', min: 20, max: 45 }, 34],
      [{ kind: 'item', id: 'potion', count: 1 }, 16],
      [{ kind: 'item', id: 'bomb', count: 3 }, 14],
      [{ kind: 'xp', amount: 30 }, 10],
      [{ kind: 'stat', any: true, amount: 1 }, 10],
      [{ kind: 'hp', amount: 2 }, 6],
      [{ kind: 'skin', any: true }, 5]
    ] },
    gold: { rolls: 3, entries: [
      [{ kind: 'gold', min: 45, max: 90 }, 30],
      [{ kind: 'item', id: 'potion', count: 2 }, 15],
      [{ kind: 'item', id: 'bomb', count: 4 }, 12],
      [{ kind: 'xp', amount: 70 }, 10],
      [{ kind: 'stat', any: true, amount: 1 }, 15],
      [{ kind: 'hp', amount: 2 }, 10],
      [{ kind: 'skin', any: true }, 9]
    ] },
    platinum: { rolls: 4, entries: [
      [{ kind: 'gold', min: 90, max: 180 }, 27],
      [{ kind: 'item', id: 'potion', count: 2 }, 14],
      [{ kind: 'item', id: 'bomb', count: 5 }, 10],
      [{ kind: 'xp', amount: 140 }, 10],
      [{ kind: 'stat', any: true, amount: 2 }, 16],
      [{ kind: 'hp', amount: 3 }, 11],
      [{ kind: 'skin', any: true }, 12]
    ] },
    legendary: { rolls: 3, guaranteed: [{ kind: 'skin', any: true }], entries: [
      [{ kind: 'skin', any: true }, 22],
      [{ kind: 'gold', min: 150, max: 300 }, 26],
      [{ kind: 'stat', any: true, amount: 2 }, 20],
      [{ kind: 'hp', amount: 4 }, 14],
      [{ kind: 'item', id: 'potion', count: 3 }, 12],
      [{ kind: 'xp', amount: 250 }, 6]
    ] },
    fan: { rolls: 2, entries: [
      [{ kind: 'gold', min: 15, max: 40 }, 32],
      [{ kind: 'item', id: 'potion', count: 1 }, 18],
      [{ kind: 'item', id: 'bomb', count: 3 }, 16],
      [{ kind: 'xp', amount: 25 }, 12],
      [{ kind: 'stat', any: true, amount: 1 }, 9],
      [{ kind: 'hp', amount: 1 }, 6],
      [{ kind: 'skin', any: true }, 7]
    ] },
    boss: { rolls: 3, guaranteed: [{ kind: 'item', id: 'potion', count: 1 }], entries: [
      [{ kind: 'gold', min: 60, max: 120 }, 26],
      [{ kind: 'item', id: 'potion', count: 2 }, 12],
      [{ kind: 'item', id: 'bomb', count: 4 }, 12],
      [{ kind: 'stat', any: true, amount: 2 }, 16],
      [{ kind: 'hp', amount: 2 }, 14],
      [{ kind: 'xp', amount: 100 }, 11],
      [{ kind: 'skin', any: true }, 9]
    ] }
  };

  /* prices are floor-1 values; game.js scales by (1 + (floor-1)*0.35) */
  D.shop = [
    { id: 'potion', name: 'HEALTH POTION', desc: 'HEALS HALF YOUR MAX HP. TASTES LIKE CHERRY AND REGRET.', price: 30, give: { kind: 'item', id: 'potion', count: 1 } },
    { id: 'bomb', name: 'HOB-LOBBER', desc: 'ONE BOMB. ARCS NICELY. RESPECTS NO ONE.', price: 15, give: { kind: 'item', id: 'bomb', count: 1 } },
    { id: 'bomb_bundle', name: 'HOB-LOBBER SIX PACK', desc: 'SIX BOMBS FOR THE PRICE OF FIVE. HOLIDAY SPECIAL.', price: 75, give: { kind: 'item', id: 'bomb', count: 6 } },
    { id: 'tonic_str', name: 'STRENGTH TONIC', desc: '+1 STR. MORE PUNCH IN YOUR PUNCHES. AND KICKS. AND BOMBS.', price: 120, give: { kind: 'stat', stat: 'str', amount: 1 } },
    { id: 'tonic_con', name: 'CONSTITUTION TONIC', desc: '+1 CON. +2 MAX HP. YOUR LIVER WILL FILE A COMPLAINT.', price: 120, give: { kind: 'stat', stat: 'con', amount: 1 } },
    { id: 'tonic_dex', name: 'DEXTERITY TONIC', desc: '+1 DEX. MORE CRITS, FASTER FEET. STILL NO SHOES.', price: 120, give: { kind: 'stat', stat: 'dex', amount: 1 } },
    { id: 'tonic_int', name: 'INTELLIGENCE TONIC', desc: '+1 INT. YOUR COMPANION HITS HARDER. YOU STILL DO NOT.', price: 120, give: { kind: 'stat', stat: 'int', amount: 1 } },
    { id: 'heart', name: 'HEART CONTAINER', desc: '+2 MAX HP, FOREVER (THIS RUN). DO NOT ASK WHOSE HEART.', price: 150, give: { kind: 'hp', amount: 2 } },
    { id: 'revival', name: 'REVIVAL CONTRACT', desc: '+1 REVIVAL. THE FINE PRINT SAYS THE SHOW OWNS YOUR SECOND LIFE.', price: 200, give: { kind: 'revival', count: 1 } },
    { id: 'mystery', name: 'MYSTERY BOX', desc: 'A BRONZE BOX. NO REFUNDS. NO PEEKING. NO SHAKING. OK, A LITTLE SHAKING.', price: 45, give: { kind: 'box', tier: 'bronze' } }
  ];

  D.skins = {
    carl_boxers: { name: 'THE CLASSIC', desc: 'BOXERS, A LEATHER JACKET, AND BARE FEET IN THE SNOW. ICONIC. TRAGIC. MOSTLY TRAGIC.',
      perk: null, how: 'WHAT YOU WERE WEARING WHEN THE WORLD ENDED.' },
    carl_jacket: { name: 'JACKET AND JEANS', desc: 'YOU FOUND PANTS. THE AUDIENCE IS DEVASTATED. YOUR KNEES ARE GRATEFUL.',
      perk: { def: 1 }, how: 'DEFEAT THE HOARDER ON FLOOR 1, OR LOOT BOXES.' },
    carl_bodyguard: { name: 'THE BODYGUARD', desc: 'BLACK SUIT, DARK SHADES, EARPIECE THAT CONNECTS TO NOTHING. VERY PROFESSIONAL.',
      perk: { hp: 4 }, how: 'DEFEAT THE BRIDE ON FLOOR 7.' },
    carl_kilt: { name: 'THE HIGHLANDER', desc: 'A KILT. MAXIMUM KICKING FREEDOM. THE CAMERAS ARE KEEPING A RESPECTFUL DISTANCE.',
      perk: { dmg: 1 }, how: 'DEFEAT THE MOTHMAN ON FLOOR 8.' },
    carl_hazmat: { name: 'HAZMAT SUIT', desc: 'BRIGHT YELLOW. FULLY SEALED. YOU CAN STILL SMELL THE SEWER SOMEHOW.',
      perk: { def: 1, hp: 2 }, how: 'DEFEAT THE TIDEMOTHER ON FLOOR 5.' },
    carl_pajamas: { name: 'BUNNY PAJAMAS', desc: 'FOOTIE PAJAMAS WITH EARS. THE SPRINGY SLIPPERS LET YOU JUMP TWICE. SCIENCE.',
      perk: { doubleJump: true }, how: 'RANDOM DROP FROM LOOT BOXES, OR PET DONUT 25 TIMES.' },
    carl_clown: { name: 'HONK HONK', desc: 'FACE PAINT, RED NOSE, GIANT SHOES. THE VIEWERS LOVE IT. YOUR DIGNITY DOES NOT.',
      perk: { views: 0.25 }, how: 'DEFEAT THE RINGMASTER ON FLOOR 3.' },
    carl_toga: { name: 'THE SENATOR', desc: 'A BEDSHEET TOGA AND A LAUREL WREATH. ROME WAS NOT BUILT IN A DAY. NEITHER WAS THIS LOOK.',
      perk: { speed: 0.1 }, how: 'RANDOM DROP FROM LOOT BOXES, OR LAND A 25 HIT COMBO.' },
    carl_gold: { name: 'GOLDEN CHAMPION', desc: 'SOLID GOLD BOXERS, GOLD JACKET, GOLD TOENAILS. YOU WON. NOW EVERYONE HAS TO LOOK AT IT.',
      perk: { dmg: 2, gold: 0.25, views: 0.25 }, how: 'FINISH A PARADE OF HORRIBLES ON FLOOR 11.' }
  };

  /* Update 2: every companion except Donut is FOUND and RESCUED, one per floor
     (floors 2-7), per crawl. `how` hints where; rescueLines are said on release. */
  D.companions = {
    donut: { name: 'PRINCESS DONUT', desc: 'A PERSIAN SHOW CAT AND ROYALTY, ACCORDING TO HER. CASTS MAGIC MISSILE AT ANYTHING THAT LOOKS AT HER.',
      ability: 'missile', cooldown: 1.6, power: 2, sprite: 'donut',
      special: { name: 'MAGIC MISSILE BARRAGE', desc: 'A STORM OF HOMING MISSILES HITS EVERY ENEMY ON SCREEN.', time: 0 },
      how: 'SHE WAS ALWAYS HERE. SHE WOULD LIKE THAT NOTED.' },
    squeaks: { name: 'SIR SQUEAKS', desc: 'A TUTORIAL RAT WHO ESCAPED FLOOR ONE AND GOT NABBED BY GOBLINS. FETCHES PICKUPS AND SOMETIMES DIGS UP A BOMB.',
      ability: 'fetch', cooldown: 3, power: 1, sprite: 'squeaks', bombChance: 0.15,
      special: { name: 'RAT KING RANSOM', desc: 'SIR SQUEAKS CALLS IN A FAVOR. SNACKS, COINS AND BOMBS RAIN FROM ABOVE.', time: 0 },
      how: 'CAUGHT BY GOBLINS ON FLOOR 2. THEY NEED A TARGET.',
      rescueLines: ["SQUEAK! SQUEAK SQUEAK! (TRANSLATION: THE GOBLINS WERE USING ME FOR DARTS. I AM YOURS FOREVER NOW.)"] },
    mongo: { name: 'MONGO', desc: 'A BABY VELOCIRAPTOR WHO THINKS HE IS A GOOD DOG. HE IS A GOOD DOG. WITH 80 TEETH.',
      ability: 'bite', cooldown: 1.2, power: 3, sprite: 'mongo',
      special: { name: 'DINO STAMPEDE', desc: 'MONGO CHARGES ACROSS THE SCREEN, BITING EVERYTHING IN HIS PATH.', time: 2.5 },
      how: 'AN EGG ON FLOOR 3. SOMEBODY IS GIVING IT AWAY AS A PRIZE.',
      rescueLines: ["*CRACK* ...MREEP? *SNIFF* *SNIFF* MREEEEP!", "(MONGO HAS DECIDED CARL IS HIS MOTHER. THIS IS NOT UP FOR DEBATE.)"] },
    samantha: { name: 'SAMANTHA', desc: 'A CURSED PORCELAIN DOLL HEAD WITH CURLY BLONDE HAIR AND BIG RED LIPS. A DEMIGODDESS, SHE SAYS. LOUDLY. OFTEN.',
      ability: 'lunge', cooldown: 2.2, power: 4, sprite: 'samantha',
      special: { name: 'DIVINE SHRIEK', desc: 'SAMANTHA SCREAMS AT A PITCH ONLY GODS CAN HIT. EVERYTHING ON SCREEN TAKES DAMAGE AND IS STUNNED.', time: 2 },
      how: 'HIDDEN SOMEWHERE ON FLOOR 4. LISTEN FOR CURSING.',
      rescueLines: ["FINALLY! A HERO! OR A SWEATY MAN IN UNDERWEAR. CLOSE ENOUGH. KNEEL, MORTAL. THEN CARRY ME.",
        "I AM A DEMIGODDESS, NOT A HEAD. I JUST HAPPEN TO BE A HEAD RIGHT NOW. POINT ME AT SOMETHING. I BITE."] },
    katia: { name: 'KATIA', desc: 'A SHAPESHIFTER WHO TURNS PART OF HERSELF INTO A SHIELD. CALM, KIND, AND MADE OF CONCERNING PUTTY.',
      ability: 'shield', cooldown: 6, power: 1, sprite: 'katia',
      special: { name: 'FORTRESS FORM', desc: 'KATIA WRAPS YOU IN ARMOR. YOU TAKE NO DAMAGE FOR A FEW SECONDS.', time: 4 },
      how: 'HELD PAST THE REEF ON FLOOR 5. BRING A CHART.',
      rescueLines: ["OH THANK GOODNESS. THEY KEPT ASKING ME TO TURN INTO A FISH. I AM NOT A FISH. I CAN BE A WALL, THOUGH.",
        "STAY BEHIND ME, CARL. WELL, BEHIND THE PART OF ME THAT IS CURRENTLY A SHIELD."] },
    zev: { name: 'ZEV', desc: 'YOUR PR HANDLER. A FISH LADY WITH A CLIPBOARD. PULLS IN GOLD AND MAKES SURE THE CAMERAS CATCH YOUR GOOD SIDE.',
      ability: 'magnet', cooldown: 0.5, power: 1, sprite: 'zev', bonus: { views: 0.3 },
      special: { name: 'PRESS JUNKET', desc: 'ALL ENEMIES FREEZE FOR A PHOTO OP. VIEWS POUR IN.', time: 3 },
      how: 'STUCK DOWN A WELL ON FLOOR 6. MAKE A WISH.',
      rescueLines: ["CARL! DARLING! I HAVE BEEN IN A WELL FOR THREE DAYS. DO YOU KNOW WHAT THAT DOES TO ENGAGEMENT?",
        "SMILE, YOU ARE TRENDING. NO, YOUR OTHER SIDE. THE ONE WITH LESS SEWER ON IT."] },
    signet: { name: 'SIGNET', desc: 'A WILD-HAIRED HALF-ELF SUMMONER IN A LEAFY CLOAK. HER CARVED STAFF CALLS FAE SPIRITS THAT ZAP ANYTHING RUDE.',
      ability: 'summon', cooldown: 5, power: 2, sprite: 'signet',
      special: { name: 'SPIRIT STAMPEDE', desc: 'A HERD OF GLOWING FAE SPIRITS THUNDERS ACROSS THE SCREEN AND TRAMPLES EVERY ENEMY IN THE WAY.', time: 2 },
      how: 'LOST IN THE GREEN HEART OF FLOOR 7. BRING A KEY.',
      rescueLines: ["THE HEDGES LISTEN TO ME AND THE SPIRITS LISTEN TO ME. THE BRIDE DID NOT. LET US GO TEACH HER MANNERS.",
        "MY SPIRITS LIKE YOU. THEY THINK YOUR FEET ARE A KIND OF MUSHROOM. TAKE THE COMPLIMENT."] }
  };

  /* achievements: event matches DCW.game.track names; count = counter threshold */
  D.achievements = {
    first_blood:  { name: 'FIRST BLOOD', desc: 'YOU KILLED SOMETHING! IT WAS PROBABLY A RAT. WE ARE STILL PROUD. KIND OF.', event: 'kill', count: 1, box: 'bronze' },
    kill_100:     { name: 'PEST CONTROL', desc: '100 KILLS. THE DUNGEON HAS STARTED TO TALK ABOUT YOU. NOT NICELY.', event: 'kill', count: 100, box: 'silver' },
    kill_500:     { name: 'BODY COUNT', desc: '500 KILLS. THE VIEWERS HAVE STARTED A DRINKING GAME. PLEASE SLOW DOWN.', event: 'kill', count: 500, box: 'gold' },
    kill_1000:    { name: 'ONE MAN APOCALYPSE', desc: '1000 KILLS. IN BOXERS. HISTORIANS WILL BE VERY CONFUSED.', event: 'kill', count: 1000, box: 'platinum' },
    rat_25:       { name: 'RATCATCHER', desc: 'YOU KILLED 25 RATS. SIR SQUEAKS WOULD LIKE A WORD. A SQUEAKY WORD.', event: 'kill:rat', count: 25, box: 'bronze' },
    stomp_10:     { name: 'HEADS UP', desc: 'STOMPED 10 HEADS. YOUR FEET ARE DISGUSTING. THE CROWD LOVES IT.', event: 'stomp', count: 10, box: 'bronze' },
    stomp_100:    { name: 'GOOMBA TRAUMA', desc: '100 STOMPS. SOMEWHERE A PLUMBER NODS SOLEMNLY.', event: 'stomp', count: 100, box: 'gold' },
    kick_50:      { name: 'FOOT SOLDIER', desc: '50 KICKS WITH BARE FEET. WE ARE LEGALLY REQUIRED TO RECOMMEND A TETANUS SHOT.', event: 'kick', count: 50, box: 'bronze' },
    bomb_kill_25: { name: 'DEMOLITIONS EXPERT', desc: '25 BOMB KILLS. THE INSURANCE PEOPLE HAVE STOPPED RETURNING OUR CALLS.', event: 'bomb_kill', count: 25, box: 'silver' },
    multi_bomb:   { name: 'THREE FOR ONE', desc: 'THREE KILLS WITH ONE BOMB. EFFICIENT! HORRIFYING! RERUN-WORTHY!', event: 'multi_bomb', count: 1, box: 'silver' },
    potion_10:    { name: 'HYDRATION STATION', desc: 'YOU DRANK 10 POTIONS. THEY ARE NOT SPORTS DRINKS, CRAWLER.', event: 'potion', count: 10, box: 'bronze' },
    crate_25:     { name: 'BOX HATER', desc: '25 CRATES SMASHED. WHAT DID CARDBOARD EVER DO TO YOU? DO NOT ANSWER THAT.', event: 'crate', count: 25, box: 'bronze' },
    coin_500:     { name: 'LOOSE CHANGE', desc: 'PICKED UP 500 COINS OFF A DUNGEON FLOOR. YOUR MOTHER WOULD BE SO GROSSED OUT.', event: 'coin', count: 500, box: 'silver' },
    fall_5:       { name: 'GRAVITY CHECK', desc: 'FELL IN 5 PITS. THE PITS ARE THE DARK PART. NOT THE FLOOR PART.', event: 'fall', count: 5, box: 'bronze' },
    fall_25:      { name: 'PIT ENTHUSIAST', desc: '25 FALLS. AT THIS POINT THE PITS SEND YOU HOLIDAY CARDS.', event: 'fall', count: 25, box: 'silver' },
    death_1:      { name: 'PARTICIPATION TROPHY', desc: 'YOU DIED! CONGRATULATIONS ON EXPERIENCING THE MOST POPULAR FEATURE.', event: 'death', count: 1, box: 'bronze' },
    death_10:     { name: 'FREQUENT FLATLINER', desc: 'TEN DEATHS. THE RESPAWN TEAM HAS NAMED A SANDWICH AFTER YOU.', event: 'death', count: 10, box: 'silver' },
    revive_1:     { name: 'NOT TODAY', desc: 'USED A REVIVAL. DEATH SAID HI. YOU SAID NO. RUDE, BUT VALID.', event: 'revive', count: 1, box: 'bronze' },
    box_10:       { name: 'UNBOXING CHANNEL', desc: 'OPENED 10 LOOT BOXES. SMASH THAT LIKE BUTTON. THERE IS NO BUTTON.', event: 'box_open', count: 10, box: 'silver' },
    box_50:       { name: 'GAMBLING PROBLEM', desc: '50 BOXES OPENED. THE NETWORK SALUTES YOUR TOTAL LACK OF IMPULSE CONTROL.', event: 'box_open', count: 50, box: 'gold' },
    combo_10:     { name: 'COMBO STARTER', desc: 'TEN HITS IN A ROW! YOU ARE BASICALLY A FIGHTING GAME CHARACTER NOW.', event: 'combo10', count: 1, box: 'bronze' },
    combo_25:     { name: 'COMBO BREAKER BREAKER', desc: '25 HIT COMBO. THE ANNOUNCER BOOTH NEEDED A MINUTE. THE TOGA IS YOURS.', event: 'combo25', count: 1, box: 'gold', unlock: { skin: 'carl_toga' } },
    no_damage:    { name: 'UNTOUCHABLE', desc: 'CLEARED A STAGE WITHOUT GETTING HIT. WHO ARE YOU AND WHAT DID YOU DO WITH CARL?', event: 'no_damage_stage', count: 1, box: 'silver' },
    no_damage_10: { name: 'GHOST IN THE BOXERS', desc: 'TEN FLAWLESS STAGES. THE MONSTERS ARE FILING A COMPLAINT ABOUT FAIRNESS.', event: 'no_damage_stage', count: 10, box: 'platinum' },
    pet_donut:    { name: 'GOOD KITTY', desc: 'YOU PET PRINCESS DONUT. SHE ALLOWED IT. THIS TIME. DO NOT GET COMFORTABLE.', event: 'pet_donut', count: 1, box: 'fan' },
    pet_donut_25: { name: 'CRAZY CAT PERSON', desc: 'PET DONUT 25 TIMES. SHE HAS BEGUN REFERRING TO YOU AS HER STAFF. ENJOY THE PAJAMAS.', event: 'pet_donut', count: 25, box: 'gold', unlock: { skin: 'carl_pajamas' } },
    flee_1:       { name: 'TACTICAL RETREAT', desc: 'YOU RAN AWAY FROM A STAGE. THE CHICKEN SPONSORS ARE THRILLED.', event: 'flee', count: 1, box: 'bronze' },
    shop_1:       { name: 'RETAIL THERAPY', desc: 'YOU BOUGHT SOMETHING. THE ECONOMY OF THE APOCALYPSE THANKS YOU.', event: 'shop', count: 1, box: 'bronze' },
    shop_25:      { name: 'VALUED CUSTOMER', desc: '25 PURCHASES. THE SHOPKEEPER HAS PUT YOUR PICTURE ON THE WALL. NEXT TO THE EXITS.', event: 'shop', count: 25, box: 'silver' },
    secret_1:     { name: 'NOSY', desc: 'FOUND A SECRET. YOU ARE THE KIND OF PERSON WHO READS OTHER PEOPLE\'S MAIL.', event: 'secret', count: 1, box: 'bronze' },
    secret_10:    { name: 'TREASURE GOBLIN', desc: 'TEN SECRETS FOUND. THE LEVEL DESIGNERS ARE CRYING. HAPPY TEARS. MOSTLY.', event: 'secret', count: 10, box: 'gold' },
    skin_equip:   { name: 'FASHION VICTIM', desc: 'CHANGED YOUR OUTFIT. THE STYLE BLOGS OF THE GALAXY ARE ALREADY FIGHTING ABOUT IT.', event: 'skin_equip', count: 1, box: 'bronze' },
    companion_equip: { name: 'NEW BEST FRIEND', desc: 'SWAPPED COMPANIONS. PRINCESS DONUT HAS BEEN INFORMED. SHE IS TAKING IT WELL. SHE IS NOT.', event: 'companion_equip', count: 1, box: 'bronze' },
    level_10:     { name: 'DOUBLE DIGITS', desc: 'LEVEL 10! YOU ARE NOW TECHNICALLY ABOVE AVERAGE. THE AVERAGE IS DEAD, BUT STILL.', event: 'level:10', count: 1, box: 'silver' },
    level_20:     { name: 'SEASONED CRAWLER', desc: 'LEVEL 20. YOU HAVE MORE STATS THAN SENSE. A PERFECT CONTESTANT.', event: 'level:20', count: 1, box: 'gold' },
    floor_2:      { name: 'GOING DOWN', desc: 'REACHED FLOOR 2. YOU SURVIVED THE TUTORIAL. MOST OF THE TUTORIAL DID NOT.', event: 'floor:2', count: 1, box: 'bronze' },
    floor_3:      { name: 'TOURIST', desc: 'REACHED FLOOR 3 AND ITS BIG BEAUTIFUL MAP. PLEASE DO NOT FEED THE CLOWNS.', event: 'floor:3', count: 1, box: 'silver' },
    floor_5:      { name: 'HALFWAY HOUSE', desc: 'REACHED FLOOR 5. HALFWAY THERE. HALFWAY DEAD. STATISTICALLY.', event: 'floor:5', count: 1, box: 'silver' },
    floor_7:      { name: 'DEEP CUTS', desc: 'REACHED FLOOR 7. VERY FEW CRAWLERS GET HERE. EVEN FEWER WEAR PANTS. YOU ARE BOTH.', event: 'floor:7', count: 1, box: 'gold' },
    floor_9:      { name: 'MIDSEASON FINALE', desc: 'REACHED FLOOR 9. THE PRODUCERS DID NOT PLAN FOR THIS. THEY ARE WRITING TWO MORE FLOORS FURIOUSLY.', event: 'floor:9', count: 1, box: 'platinum' },
    floor_10:     { name: 'START YOUR ENGINES', desc: 'REACHED FLOOR 10. SOMEBODY GAVE YOU A DRIVING LICENSE. THAT SOMEBODY HAS BEEN FIRED.', event: 'floor:10', count: 1, box: 'platinum' },
    boss_hoarder:   { name: 'SPRING CLEANING', desc: 'BEAT THE HOARDER. HER STUFF IS NOW YOUR STUFF. MOST OF IT IS NAPKINS.', event: 'boss:hoarder', count: 1, box: 'silver' },
    boss_juicer:    { name: 'NO PAIN, NO GAIN', desc: 'BEAT THE JUICER. HE SKIPPED HIS LAST LEG DAY. PERMANENTLY.', event: 'boss:juicer', count: 1, box: 'silver' },
    boss_ringmaster:{ name: 'CLOSING NIGHT', desc: 'BEAT THE RINGMASTER. THE CLOWNS ARE FREE. NOBODY ASKED FOR THIS.', event: 'boss:ringmaster', count: 1, box: 'gold' },
    boss_engineer:  { name: 'END OF THE LINE', desc: 'BEAT THE ENGINEER. ALL TRAINS ARE NOW CANCELLED. SO, NORMAL SERVICE.', event: 'boss:engineer', count: 1, box: 'gold' },
    boss_tidemother:{ name: 'MOTHER OF ALL FIGHTS', desc: 'BEAT THE TIDEMOTHER. HER SEVEN HUNDRED KIDS ARE WRITING YOU LETTERS. ANGRY ONES.', event: 'boss:tidemother', count: 1, box: 'gold' },
    boss_butcher:   { name: 'CUT FROM THE TEAM', desc: 'BEAT THE BUTCHER. THE HUNTING GROUNDS ARE CLOSED FOR RENOVATION.', event: 'boss:butcher', count: 1, box: 'gold' },
    boss_bride:     { name: 'OBJECTION!', desc: 'BEAT THE BRIDE. YOU STOPPED THE WEDDING. THE GUESTS WERE ALREADY DEAD, SO NO HARM DONE.', event: 'boss:bride', count: 1, box: 'platinum' },
    boss_mothman:   { name: 'LIGHTS OUT', desc: 'BEAT THE MOTHMAN. HE SAW IT COMING. HE ALWAYS SEES IT COMING.', event: 'boss:mothman', count: 1, box: 'platinum' },
    boss_showrunner:{ name: 'CANCELLED', desc: 'BEAT THE SHOWRUNNER. THE SHOW IS OVER! JUST KIDDING. THE NETWORK RENEWED IT ON THE SPOT.', event: 'boss:showrunner', count: 1, box: 'legendary' },
    /* Update 3: races (stage.js emits race_win, race_place:<n>, race_flawless) and the parade */
    race_place_3: { name: 'PODIUM PEASANT', desc: 'FINISHED A RACE IN THIRD. BRONZE IS JUST GOLD THAT GAVE UP. STILL COUNTS!', event: 'race_place:3', count: 1, box: 'bronze' },
    race_win:     { name: 'CHECKERED PAST', desc: 'WON A RACE IN A FOOD TRUCK. THE OTHER DRIVERS DEMAND A DRUG TEST. FOR THE TACOS.', event: 'race_win', count: 1, box: 'silver' },
    race_win_3:   { name: 'TRIPLE CROWN', desc: 'WON THREE RACES. THE SPONSORS WANT A DECAL ON YOUR FOREHEAD. WE SAID ASK THE CAT.', event: 'race_win', count: 3, box: 'gold' },
    race_flawless:{ name: 'NOT A SCRATCH', desc: 'WON A RACE WITHOUT A SINGLE DENT. THE INSURANCE COMPANY SENT FLOWERS.', event: 'race_flawless', count: 1, box: 'platinum' },
    race_champion:{ name: 'DID NOT COME IN LAST', desc: 'WON THE FINAL HEAT AND ROLLED ONTO FLOOR 11. THE MAULER IS IN THERAPY. IT HAS SO MANY TEETH TO TALK ABOUT.', event: 'floor:11', count: 1, box: 'legendary' },
    float_part:   { name: 'ARTS AND CRAFTS', desc: 'FOUND YOUR FIRST FLOAT PART. GLITTER HAS ENTERED YOUR BLOODSTREAM. THERE IS NO CURE.', event: 'float_part', count: 1, box: 'silver' },
    float_full:   { name: 'SOME ASSEMBLY REQUIRED', desc: 'FOUND FOUR FLOAT PARTS. YOUR FOOD TRUCK IS NOW LEGALLY A PARADE. CONGRATULATIONS?', event: 'float_part', count: 4, box: 'gold' },
    parade_done:  { name: 'GRAND FINALE', desc: 'FINISHED THE PARADE. THE STREETS ARE COVERED IN CONFETTI AND HECKLERS. MOSTLY HECKLERS.', event: 'parade_done', count: 1, box: 'platinum' },
    boss_grand_marshal: { name: 'MARSHAL LAW', desc: 'DETHRONED THE GRAND MARSHAL. HIS BATON IS NOW A VERY EXPENSIVE BACK SCRATCHER.', event: 'boss:grand_marshal', count: 1, box: 'legendary' },
    win:          { name: 'THAT IS A WRAP', desc: 'YOU BEAT THE WHOLE GAME. IN YOUR UNDERWEAR. WITH A CAT. WE HAVE NO FURTHER NOTES.', event: 'win', count: 1, box: 'legendary' }
  };
})();

/* ==========================================================================
   TEXT: System AI pools, Mordecai, shopkeeper, story, titles.
   Uppercase 5x7 font, <= 140 chars per line/page, plain ASCII only.
   ========================================================================== */
(function () {
  'use strict';
  var D = window.DCW.data;

  D.ai = {
    floorClear: [
      "FLOOR CLEARED! THE STAIRS ARE OPEN. THE VIEWERS ARE SCREAMING. SOME OF IT IS CHEERING!",
      "YOU BEAT THE FLOOR! A ROUND OF APPLAUSE FOR THE CRAWLER WHO REFUSES TO TAKE A HINT!",
      "ANOTHER FLOOR DOWN! THE ODDS MAKERS ARE FURIOUS. SEVERAL OF THEM BET ON THE RATS.",
      "CONGRATULATIONS! YOU ARE NOW ONE FLOOR CLOSER TO SOMETHING MUCH WORSE!",
      "FLOOR COMPLETE! PLEASE TAKE THE STAIRS. THE ELEVATOR IS A MONSTER. LITERALLY.",
      "THAT FLOOR TRIED ITS BEST, CRAWLER. ITS BEST WAS NOT ENOUGH. HOW DOES THAT FEEL? GREAT, RIGHT?",
      "STAIRWELL UNLOCKED! THE CLEANING CREW WILL HANDLE THE MESS YOU MADE. THE CLEANING CREW IS ALSO A MONSTER.",
      "WHAT A FLOOR! WE WILL BE SHOWING THAT LAST HIT IN SLOW MOTION FOR WEEKS!",
      "FLOOR CLEARED! YOUR FAN CLUB JUST GOT A NEW MEMBER. HE IS A LITTLE WEIRD. YOU WILL LIKE HIM."
    ],
    stageClear: [
      "AREA CLEARED! THE LOCALS ARE DEAD AND THE LOOT IS YOURS. A CLASSIC LOVE STORY.",
      "NICE WORK! THAT WAS ALMOST GRACEFUL. ALMOST.",
      "STAGE COMPLETE! WE WOULD GIVE IT A SEVEN. THE CAT WOULD GIVE IT A FOUR.",
      "YOU MADE IT OUT! THE DOOR IS VERY HAPPY TO SEE YOU. DOORS ARE LIKE THAT.",
      "CLEAR! THE MONSTERS IN THERE WILL RESPAWN NEXT SEASON. THEY HAVE A GOOD UNION.",
      "THAT IS HOW YOU DO IT, CRAWLER! OR AT LEAST, THAT IS ONE WAY TO DO IT. A MESSY WAY.",
      "AREA CLEAR! YOUR VIEWER COUNT WENT UP. YOUR HYGIENE WENT DOWN. BALANCE.",
      "STAGE DONE! WE HAVE REVIEWED THE FOOTAGE. YOU KICKED A GOBLIN INTO ANOTHER GOBLIN. ICONIC.",
      "CLEARED! TAKE A BREATH. NOT TOO DEEP. THE AIR DOWN HERE IS MOSTLY MONSTER."
    ],
    death: [
      "OH NO! OH NO NO NO! ANYWAY. THE RATINGS FOR THAT WERE INCREDIBLE.",
      "YOU DIED! DO NOT WORRY, WE GOT IT ON FOUR CAMERAS. ONE OF THEM IN SLOW MOTION.",
      "AND THE CRAWLER GOES DOWN! THE CROWD GOES WILD! SOME OF THEM ARE SAD! MOST ARE NOT!",
      "DEATH! THE GREAT EQUALIZER! AND YOU WERE SO EQUAL. SO VERY EQUAL.",
      "WELL, THAT HAPPENED. WE WILL BE PLAYING IT AT YOUR MEMORIAL. IT IS A VERY SHORT MEMORIAL.",
      "YOU HAVE DIED. PRINCESS DONUT WOULD LIKE IT KNOWN THAT SHE WAS NOT INVOLVED.",
      "CRAWLER DOWN! THE MONSTER THAT GOT YOU IS GETTING A BONUS. A SMALL ONE. YOU WERE NOT THAT HARD.",
      "YOU DIED IN YOUR UNDERWEAR. THAT IS GOING ON THE POSTER.",
      "GAME OVER, MAN! WAIT, THAT LINE IS TAKEN. GAME OVER, CRAWLER! STILL WORKS."
    ],
    levelUp: [
      "LEVEL UP! YOU ARE NOW SLIGHTLY LESS LIKELY TO DIE! WE ARE A LITTLE DISAPPOINTED!",
      "DING! A NEW LEVEL! SPEND THAT STAT POINT AT THE NEXT SAFE ROOM, BEFORE YOU FORGET WHAT NUMBERS ARE.",
      "LEVEL UP! YOUR MUSCLES GREW. YOUR BRAIN STAYED THE SAME SIZE. CLASSIC.",
      "YOU LEVELED UP! THE MONSTERS HAVE BEEN NOTIFIED AND WILL BE TRYING HARDER.",
      "STRONGER! FASTER! STILL BAREFOOT! LEVEL UP, CRAWLER!",
      "LEVEL UP! WE PATCHED A FEW HOLES IN YOU FOR FREE. DO NOT GET USED TO IT.",
      "A NEW LEVEL! SOMEWHERE A STATISTICIAN SIGHS AND ADJUSTS YOUR ODDS UPWARD.",
      "LEVEL UP! THE CAT CLAIMS FULL CREDIT. WE ARE NOT GOING TO ARGUE WITH HER."
    ],
    lootbox: [
      "OOH, A BOX! WHAT COULD IT BE? IT IS PROBABLY GOLD. IT IS USUALLY GOLD.",
      "LOOT BOX TIME! SHAKE IT! DO NOT SHAKE IT TOO HARD. ONE OF THEM HAD A BEE IN IT ONCE.",
      "OPEN IT! OPEN IT! THE AUDIENCE IS CHANTING. ALSO SOME OF THEM ARE BETTING.",
      "THE SPONSORS HAVE FILLED THIS BOX WITH LOVE. AND SOMETHING THAT FELL OFF A TRUCK.",
      "A PRIZE FOR YOU, CRAWLER! REMEMBER: GAMBLING IS BAD, UNLESS IT IS ON TELEVISION.",
      "BOX OPENED! IT CONTAINS STUFF! WE PROMISED STUFF AND WE DELIVERED STUFF!",
      "UNBOXING SEGMENT! SMILE FOR THE CAMERA. NO, A REAL SMILE. YOU LOOK LIKE A HOSTAGE.",
      "EVERY BOX IS A LITTLE MIRACLE. MOST MIRACLES ARE POTIONS."
    ],
    revive: [
      "BACK FROM THE DEAD! THAT IS GOING TO COST YOU. IT ALREADY DID. CHECK YOUR REVIVALS.",
      "REVIVED! DEATH WAS WAITING WITH A CLIPBOARD. WE TOLD HIM TO COME BACK LATER.",
      "YOU ARE ALIVE AGAIN! PLEASE DO NOT MAKE THIS A HABIT. THE PAPERWORK IS ENORMOUS.",
      "THE NETWORK HAS DECIDED YOU ARE TOO ENTERTAINING TO STAY DEAD. CONGRATULATIONS?",
      "REVIVAL USED! YOU HAVE BEEN RESET TO FACTORY SETTINGS. THE FACTORY WAS A SEWER.",
      "WELCOME BACK! YOU MISSED NOTHING. EXCEPT DYING. YOU DID NOT MISS THAT. YOU HIT IT DEAD ON.",
      "UP YOU GET, CRAWLER! THE SHOW MUST GO ON, AND YOU ARE THE SHOW.",
      "REVIVED! A PORTION OF YOUR DIGNITY COULD NOT BE RECOVERED. IT WAS A SMALL PORTION."
    ],
    boxEmpty: [
      "NO BOXES LEFT! GO EARN SOME MORE. THE MONSTERS ARE RIGHT THERE.",
      "YOUR BOX INVENTORY IS EMPTY. LIKE YOUR POCKETS. YOU DO NOT HAVE POCKETS. YOU HAVE BOXERS.",
      "ZERO BOXES. THE SADDEST NUMBER. SECOND SADDEST AFTER YOUR KILL STREAK.",
      "NOTHING TO OPEN, CRAWLER. TRY OPENING YOUR MIND. JUST KIDDING. KILL THINGS.",
      "NO MORE LOOT. THE LOOT FAIRY IS ON BREAK. SHE IS A GOBLIN. SHE DOES NOT CARE.",
      "EMPTY! WE CHECKED TWICE. ONCE UNDER THE COUCH. THERE IS NO COUCH.",
      "BOXES: NONE. ACHIEVEMENTS AND BOSSES GIVE BOXES. JUST SAYING.",
      "YOU HAVE OPENED EVERYTHING. EVEN THE ONES THAT WERE TICKING. BOLD."
    ],
    lowHp: [
      "YOUR HEALTH IS LOW! THIS WOULD BE A GREAT TIME FOR A POTION. OR A PRAYER. MOSTLY A POTION.",
      "LOW HP! THE AUDIENCE IS LEANING FORWARD. THEY LOVE A CLOSE ONE.",
      "CAREFUL, CRAWLER! YOU ARE MOSTLY HOLES AT THIS POINT.",
      "WARNING: CRAWLER STRUCTURAL INTEGRITY AT CRITICAL LEVELS. THE CAT HAS STARTED LOOKING FOR A NEW HUMAN.",
      "YOU ARE ABOUT TO DIE! NO PRESSURE. EXCEPT ALL OF IT.",
      "LOW HEALTH! QUICK TIP: THE POTION BUTTON IS THE POTION BUTTON.",
      "THE BETTING ODDS ON YOUR DEATH JUST DROPPED TO TWO TO ONE. PROVE THEM WRONG. OR RIGHT. BOTH ARE FUN.",
      "IS THAT A WHITE LIGHT? NO, IT IS JUST A FIREBALL. MOVE!"
    ],
    bigCombo: [
      "C-C-COMBO! THE CROWD IS ON ITS FEET! SOME OF THEM HAVE EXTRA FEET!",
      "WHAT A STRING OF HITS! WE ARE CUTTING THAT INTO THE TRAILER!",
      "COMBO! YOUR KNUCKLES ARE WRITING CHECKS AND THE MONSTERS ARE CASHING THEM!",
      "HIT AFTER HIT AFTER HIT! IS THIS A DUNGEON OR A DRUM SOLO?",
      "INCREDIBLE COMBO! THE VIEW COUNTER IS SPINNING LIKE A SLOT MACHINE!",
      "BEAUTIFUL VIOLENCE! THE SPONSORS ARE CRYING TEARS OF PROFIT!",
      "THAT COMBO WAS SO GOOD THE MONSTERS WANT TO START A FAN CLUB. FROM THE AFTERLIFE.",
      "KEEP IT GOING, CRAWLER! DO NOT STOP! THE RATINGS DEPEND ON IT! YOUR LIFE ALSO DEPENDS ON IT!"
    ],
    flee: [
      "RUNNING AWAY? BOLD STRATEGY. COWARDLY, BUT BOLD.",
      "THE CRAWLER FLEES! THE AUDIENCE BOOS! SOMEONE THREW A TOMATO! IT WAS ME!",
      "TACTICAL RETREAT! WE WILL CALL IT THAT ON THE BROADCAST. WE ARE NICE LIKE THAT.",
      "YOU LEFT! THE MONSTERS ARE HIGH FIVING. THE ONES WITH HANDS, ANYWAY.",
      "FLEEING COSTS YOU NOTHING BUT YOUR PRIDE. YOU HAD VERY LITTLE PRIDE. SO, A BARGAIN.",
      "BYE BYE! THE STAGE WILL STILL BE THERE WHEN YOU COME BACK. IT IS NOT GOING ANYWHERE. NEITHER ARE YOU.",
      "RUN, CRAWLER, RUN! THE CHASE MUSIC IS ALREADY PLAYING!",
      "A STRATEGIC WITHDRAWAL! GREAT GENERALS DO IT ALL THE TIME. RIGHT BEFORE THEY LOSE."
    ]
  };

  // Mordecai gets a new body every floor (art: mordecai_fN / p_mordecai_fN). He comments the first time you talk to him.
  D.mordecaiForms = {
    1: { name: 'BIRD', line: "WELCOME TO THE GUILD, KID. YES, I'M A BIRD. NO, I DON'T WANT TO TALK ABOUT IT. SIT DOWN BEFORE YOU FALL DOWN." },
    2: { name: 'GOBLIN', line: "DON'T LAUGH. THE SHOW GIVES ME A NEW BODY EVERY FLOOR. THIS TIME IT'S A GOBLIN. THE EARS WHISTLE WHEN I WALK." },
    3: { name: 'FROG', line: "A FROG. A FROG, CARL. I CAUGHT A FLY THIS MORNING WITHOUT MEANING TO. IT WAS DELICIOUS. I HATE THAT IT WAS DELICIOUS." },
    4: { name: 'AUTOMATON', line: "THIS FLOOR I'M MADE OF GEARS. I TICK. I NEED OILING TWICE A DAY. IF I START SMOKING, PUNCH THE SIDE PANEL." },
    5: { name: 'OCTOPUS', line: "EIGHT ARMS AND STILL ONE MUG. THE PRODUCERS THINK THIS IS FUNNY. I CAN POUR FOUR DRINKS AT ONCE, SO THAT'S SOMETHING." },
    6: { name: 'STAG', line: "ANTLERS. I KEEP HITTING THE DOOR FRAME. THE HUNTERS OUT THERE KEEP LOOKING AT ME FUNNY. WATCH YOURSELF, KID." },
    7: { name: 'VAMPIRE', line: "THE TEETH ARE NEW. NO, I'M NOT GOING TO BITE YOU. I CAN'T EVEN EAT GARLIC BREAD ANYMORE. THAT'S THE REAL TRAGEDY." },
    8: { name: 'CYCLOPS', line: "ONE EYE. NO DEPTH PERCEPTION. I'VE MISSED THE BAR TWICE TODAY. IF YOU WANT A DRINK, POUR IT YOURSELF THIS FLOOR." },
    9: { name: 'MINOTAUR', line: "HORNS, HOOVES AND A TEMPER. FITS THE MOOD. THE SHOWRUNNER IS UP THERE, KID. BEAT HIM AND THE SEASON STILL ISN'T OVER." },
    10: { name: 'CRASH DUMMY', line: "A CRASH TEST DUMMY. YELLOW, JOINTED, AND THERE IS A TARGET PAINTED ON MY FACE. THE PRODUCERS THINK THEY'RE HILARIOUS." },
    11: { name: 'PARADE MASCOT', line: "NOT. ONE. WORD. IT'S A PINK PLUSH MASCOT SUIT. IT SQUEAKS WHEN I WALK. THE HEAD DOESN'T COME OFF. I HAVE TRIED, CARL." }
  };
  D.mordecai = [
    "BOXES AND STAT POINTS WAIT FOR A SAFE ROOM. THE SPONSORS WANT THE UNBOXING ON CAMERA. TALK TO ME TO TRAIN.",
    "KID. LISTEN. A KICK IS SLOWER THAN A PUNCH BUT IT HITS HARDER. USE IT ON THE BIG ONES.",
    "IN THE AIR, HOLD DOWN AND HIT ATTACK. YOU WILL DIVE FEET FIRST. BOUNCE OFF HEADS, IT KEEPS YOU SAFE.",
    "BOMBS ARC. THROW THEM OVER WALLS AND INTO GROUPS. THREE KILLS IN ONE BLAST AND THE CROWD GOES NUTS.",
    "CRATES HIDE SNACKS AND BOMBS. BREAK EVERY CRATE. NOBODY IS GOING TO BILL YOU.",
    "POTIONS HEAL HALF YOUR MAX HP. DO NOT SAVE THEM FOR LATER. LATER IS WHEN YOU ARE DEAD.",
    "THE SPECIAL METER FILLS WHEN YOU DEAL DAMAGE. FULL METER, HIT SPECIAL. SAVE IT FOR BOSSES IF YOU CAN.",
    "STR IS PUNCH DAMAGE. CON IS HEALTH. DEX IS CRITS AND SPEED. INT MAKES YOUR COMPANION HURT THINGS MORE.",
    "LEVELING UP HEALS YOU A LITTLE. SOMETIMES IT IS SMART TO FINISH A FIGHT BEFORE YOU DRINK.",
    "FALLING IN A PIT COSTS 3 HP AND PUTS YOU BACK AT THE CHECKPOINT. TOUCH THE FLAGS.",
    "ON THE MAP, LETTERED AREAS ARE OPTIONAL. BETTER LOOT, AND SOMETIMES A KEY OR A FRIEND IN A CAGE. GO LOOK.",
    "THE WANDERING MONSTERS ON THE MAP START A SHORT FIGHT. AVOID THEM IF YOU ARE HURT.",
    "BEAT THE FLOOR UNDER PAR TIME AND THE SHOW GIVES YOU A BONUS BOX. SPEED PAYS.",
    "BOSSES CHANGE THEIR MOVES WHEN THEY GET HURT. WATCH FOR THE FLASH BEFORE A CHARGE OR A LASER.",
    "SPIKES HURT AND THROW YOU UP. THAT CAN BE WORSE THAN THE SPIKES. LOOK BEFORE YOU LEAP.",
    "THE SHOP PRICES GO UP EVERY FLOOR. BUY TONICS EARLY. YOU WILL THANK ME LATER.",
    "COMBOS GET YOU MORE VIEWERS. VIEWERS GET YOU FAN BOXES. KEEP THE HITS CHAINED UNDER TWO SECONDS.",
    "LOOT BOXES HAVE OUTFITS. FRIENDS YOU HAVE TO FIND YOURSELF. THEY ARE LOCKED IN CAGES ACROSS FLOORS 2 TO 7. PUNCH THE CAGE.",
    "A PADLOCKED DOOR MEANS A KEY ITEM. FLEE, GO FIND IT, COME BACK. ITEMS STAY IN YOUR POCKET FOR THE WHOLE FLOOR.",
    "LEVERS OPEN EVERY IRON GATE NEARBY. IF A GATE WILL NOT BUDGE, LOOK UP. THE LEVER IS USUALLY SOMEWHERE ANNOYING.",
    "EVERY CRAWL, YOUR FRIENDS GET LOCKED UP AGAIN. THE SHOW CALLS IT A REBOOT. I CALL IT CHEAP WRITING.",
    "IF THE CAT LETS YOU PET HER, PET HER. MORALE MATTERS DOWN HERE. TRUST ME.",
    "ENEMIES WITH SHELLS OR ARMOR SHRUG OFF WEAK HITS. KICKS AND BOMBS GET THROUGH.",
    "DO NOT FIGHT EVERYTHING ON THE GROUND. GET UP ON A PLATFORM AND MAKE THEM COME TO YOU.",
    "YOU CAN DROP THROUGH THIN PLATFORMS. HOLD DOWN AND PRESS JUMP.",
    "I HAVE BEEN DOWN HERE A LONG TIME, KID. MOST CRAWLERS DIE BEING GREEDY. DO NOT BE MOST CRAWLERS.",
    "IN A RACE, HOLD RIGHT AND NEVER LET GO. JUMP THE GAPS, HIT THE PADS, AND LET THE CAT DO THE SHOOTING.",
    "ON THE PARADE FLOAT, STAY ON THE FLOAT. EVERY FLOAT PART YOU BOLT ON DOES SOMETHING. BRING ALL FOUR."
  ];

  D.shopkeeper = { name: 'BOPCA THE SHOPKEEPER', lines: [
    "WELCOME, WELCOME! EVERYTHING IS FOR SALE! EXCEPT ME! I AM FOR RENT.",
    "POTIONS, BOMBS, TONICS! ALL GENUINE! MOSTLY GENUINE! THE LABELS ARE GENUINE.",
    "YOU LOOK LIKE A CRAWLER WHO NEEDS A HEART CONTAINER. YOU LOOK LIKE YOU NEED SEVERAL.",
    "NO SHIRT, NO SHOES, NO PROBLEM! I TAKE GOLD FROM ANYONE.",
    "THE MYSTERY BOX? IT IS A MYSTERY TO ME TOO. THAT IS THE MAGIC.",
    "A REVIVAL CONTRACT! SIGN HERE, AND HERE, AND HERE. DO NOT READ THAT PART.",
    "PRICES GO UP EVERY FLOOR. BLAME THE DUNGEON ECONOMY. ALSO BLAME ME, A LITTLE.",
    "COME BACK SOON! OR DO NOT. I AM PAID EITHER WAY. THAT IS A LIE. PLEASE COME BACK.",
    "YOU CANNOT AFFORD THAT. I SAY THIS WITH LOVE. MOSTLY WITH PITY."
  ] };

  D.story = {
    intro: [
      { text: "IT WAS THE COLDEST NIGHT OF THE YEAR. SNOW. WIND. YOU WERE STANDING OUTSIDE IN YOUR BOXERS AND A LEATHER JACKET.", portrait: 'p_carl' },
      { text: "WHY? BECAUSE YOUR EX'S CAT, PRINCESS DONUT, HAD ESCAPED. AGAIN. AND SHE WAS SITTING ON A CAR, JUDGING YOU.", portrait: 'p_donut' },
      { text: "YOU HAD JUST REACHED HER WHEN THE SKY WENT QUIET. A HUM. A FLASH. AND THEN EVERY BUILDING ON EARTH WAS GONE.", portrait: null },
      { text: "NOT DESTROYED. GONE. CITIES, TOWNS, HOUSES. EVERYONE INSIDE WITH THEM. YOU WERE OUTSIDE. THAT WAS YOUR LUCKY BREAK.", portrait: null },
      { text: "THEN THE VOICE CAME. FROM EVERYWHERE. LOUD, CHEERFUL, AND DELIGHTED TO MEET YOU.", portrait: 'p_ai' },
      { text: "HELLO, EARTH! YOUR PLANET HAS BEEN SELECTED FOR THE GALAXY'S MOST POPULAR ENTERTAINMENT PROGRAM!", portrait: 'p_ai' },
      { text: "THE SURFACE IS CLOSED! THE DUNGEON IS OPEN! EIGHTEEN FLOORS OF FUN, AND ELEVEN OF THEM ARE READY TODAY!", portrait: 'p_ai' },
      { text: "GO DOWN THE STAIRS. FIGHT MONSTERS. OPEN BOXES. ENTERTAIN BILLIONS. STAY ON THE SURFACE AND, WELL. DO NOT DO THAT.", portrait: 'p_ai' },
      { text: "THE CAT LOOKED AT YOU. YOU LOOKED AT THE CAT. SHE CLIMBED ONTO YOUR SHOULDER LIKE SHE OWNED IT. SHE DID NOW.", portrait: 'p_donut' },
      { text: "WELCOME TO THE SHOW, CRAWLER. TRY TO LOOK GOOD DYING. OR BETTER YET, DO NOT DIE. THE RATINGS ARE BETTER THAT WAY.", portrait: 'p_ai' }
    ],
    ending: [
      { text: "THE GRAND MARSHAL TOPPLED OFF HIS THRONE FLOAT. HIS BATON ROLLED INTO THE GUTTER. THE MARCHING BAND, FOR ONCE, MISSED A BEAT.", portrait: null },
      { text: "CONFETTI KEPT FALLING. NOBODY HAD TOLD THE CANNON TO STOP. PRINCESS DONUT WAVED FROM THE TRUCK WINDOW LIKE SHE PLANNED IT ALL.", portrait: 'p_donut' },
      { text: "THEN THE CROWD ERUPTED. BILLIONS OF VIEWERS, SCREAMING ONE NAME. IT WAS YOURS. THE CAT ASSUMED IT WAS HERS.", portrait: 'p_donut' },
      { text: "WELL! THAT WAS NOT IN THE SCRIPT. ELEVEN FLOORS, A RACE AND A PARADE OF HORRIBLES. CRAWLER, YOU BROKE THE SHOW SO BADLY IT IS A HIT.", portrait: 'p_ai' },
      { text: "THE NETWORK HAS AGREED TO YOUR TERMS. THE PARADE ROUTE ENDS AT A STAIRCASE GOING UP. THE SURFACE IS WAITING. IT IS STILL COLD.", portrait: 'p_ai' },
      { text: "YOU CLIMBED. PAST THE PARADE, THE RACES, THE WARZONE, THE GHOST TOWN, THE MANOR, THE JUNGLE, THE BUBBLES, THE IRON TANGLE AND THE OVER CITY.", portrait: 'p_carl' },
      { text: "PAST THE TRAINING FLOORS AND THEIR RATS. AT THE TOP THERE WAS SNOW. AND SKY. AND OTHER PEOPLE, BLINKING IN THE LIGHT.", portrait: null },
      { text: "PRINCESS DONUT STRETCHED, YAWNED, AND ANNOUNCED THAT SHE WAS HUNGRY. SOME THINGS SURVIVE EVERYTHING.", portrait: 'p_donut' },
      { text: "SEASON ONE: COMPLETE. THANK YOU FOR WATCHING. STAY TUNED, CRAWLER. THE GALAXY IS ALREADY ASKING FOR SEASON TWO.", portrait: 'p_ai' }
    ],
    credits: [
      "DUNGEON CRAWLER WORLD: EARTH",
      "A PERSONAL FAN GAME. NOT FOR SALE.",
      "NOT AFFILIATED WITH ANYONE. AT ALL.",
      "INSPIRED BY DUNGEON CRAWLER CARL",
      "BY MATT DINNIMAN. GO READ THE BOOKS.",
      "THEY ARE BETTER THAN THIS. THE CAT SAYS SO.",
      "STARRING CARL AND PRINCESS DONUT",
      "WITH MONGO, SAMANTHA, KATIA, ZEV, SIGNET",
      "AND SIR SQUEAKS, OF COURSE",
      "AND THE RIVALS OF DON'T COME IN LAST",
      "AND PREPOTENTE, WHO RUINED FLOOR SEVEN",
      "SPECIAL THANKS TO MORDECAI FOR THE TIPS",
      "AND TO BOPCA FOR THE TERRIBLE PRICES",
      "NO TUTORIAL RATS WERE HARMED. OK, SEVERAL WERE.",
      "ALL ART DRAWN IN CODE. ALL MUSIC MADE OF BEEPS.",
      "THANK YOU FOR PLAYING, CRAWLER!"
    ]
  };

  D.titles = [
    { views: 0, name: 'NOBODY' },
    { views: 500, name: 'BACKGROUND EXTRA' },
    { views: 2000, name: 'LOCAL CURIOSITY' },
    { views: 6000, name: 'RISING CRAWLER' },
    { views: 15000, name: 'CULT FAVORITE' },
    { views: 35000, name: 'FAN FAVORITE' },
    { views: 75000, name: 'PRIME TIME' },
    { views: 150000, name: 'GALACTIC HEARTTHROB' },
    { views: 300000, name: 'RATINGS MONSTER' },
    { views: 600000, name: 'LIVING LEGEND' },
    { views: 1000000, name: 'THE MAIN CHARACTER' }
  ];
})();

/* interim stubs: safe rooms + cutscenes (full versions follow) */
(function () {
  'use strict';
  var D = window.DCW.data;
  function room(name, theme, npc, services) { return { name: name, theme: theme, music: 'safe', npc: npc, services: services, greet: [], restLine: 'YOU SLEEP. NOTHING EATS YOU. A GOOD NIGHT.' }; }
  D.safeRooms = {
    guild: room("MORDECAI'S GUILD HALL", 'safe_guild', 'mordecai', ['mordecai', 'boxes', 'rest']),
    tally: room("TALLY'S RESTAURANT", 'safe_tally', 'tally', ['shop', 'boxes', 'rest', 'tv']),
    cookie: room('AN UNSTAFFED SAFE ROOM', 'safe_cookie', null, ['cookies', 'boxes', 'rest', 'tv']),
    guild2: room('THE TRAINING GUILD', 'safe_guild', 'mordecai', ['mordecai', 'boxes', 'rest']),
    shelter: room('BIG SHOT CHICKEN', 'safe_shelter', 'qwist', ['shop', 'boxes', 'rest', 'tv', 'mailbox']),
    bugaboo: room("MORDECAI'S SECOND FLOOR GUILD", 'safe_bugaboo', 'mordecai', ['mordecai', 'shop', 'boxes', 'rest', 'tv'])
  };
  ['guild', 'tally', 'cookie', 'guild2', 'shelter', 'bugaboo'].forEach(function (k) { D.safeRooms[k].tvLines = ['RECAP SOON.', 'STAY TUNED.', 'PATCH NOTES PENDING.']; D.safeRooms[k].mailLines = ['NO MAIL YET.', 'STILL NO MAIL.']; });
  D.cutscenes = {};
  ['prologue', 'f1_entrance', 'f1_mordecai', 'f1_episode1', 'f1_chopper', 'f1_frank', 'f1_meadowlark', 'f1_swine_plan', 'f1_odette',
   'f2_welcome', 'f2_jug', 'f2_jack', 'f2_deathwatch', 'f2_menagerie', 'f2_descent'].forEach(function (id) {
    D.cutscenes[id] = { music: 'intro', panels: [ { bg: 'stairwell', actors: [{ sprite: 'carl_idle', x: 140 }, { sprite: 'donut_idle', x: 162 }],
      lines: [{ who: 'SYSTEM AI', portrait: 'p_ai', text: 'CUTSCENE ' + id.toUpperCase() + ' IS BEING WRITTEN. PLEASE ENJOY THIS PLACEHOLDER.' }] } ] };
  });
  D.cutscenes.f1_mordecai.give = [{ kind: 'flag', id: 'missile' }];
  D.cutscenes.f1_chopper.give = [{ kind: 'flag', id: 'chopper' }];
  D.cutscenes.f2_jug.give = [{ kind: 'flag', id: 'jugs' }];
  D.items = { potion: { name: 'HEALTH POTION' }, bomb: { name: 'GOBLIN DYNAMITE', jugName: "CARL'S JUG O'BOOM" }, biscuit: { name: 'PET BISCUIT' } };
  D.gear = {};
})();

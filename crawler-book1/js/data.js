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
     hp ~ 40-60x the expected punch at that point of the story; 45-90 s fights.
     Measured with a god-mode brawler bot (no dodging, bombs + special): dozer ~45 s,
     the rest ~20-35 s; real players dodge, so roughly 2-3x that.
     New primitives (stage.js): roll, tentacle, sweep, mist:S, frenzy:N, scream,
     flex:S, throw:PROJ:N. Floor 1 bosses drop no gold (boxes instead). */
  D.bosses = {
    murder_dozer: { name: 'GOBLIN MURDER DOZER', title: 'A STEAM TANK FULL OF GOBLINS',
      hp: 70, dmg: 3, w: 72, h: 44, sprite: 'murder_dozer', xp: 25, gold: [0, 0], flying: false, armor: 'front',
      phases: [
        { below: 1.0, speed: 34, pattern: ['walk:2', 'shoot:junk:2', 'idle:1', 'charge', 'idle:1.6', 'walk:1.5', 'rain:junk:3', 'idle:1.2'] },
        { below: 0.5, speed: 46, name: 'ABANDON SHIP', sub: 'THE GOBLINS ARE CLIMBING OUT',
          line: "THE GOBLINS ARE CLIMBING OUT OF THE PIT TO HELP! THEY ARE VERY BAD AT HELPING. THEY ARE VERY GOOD AT STABBING.",
          pattern: ['charge', 'idle:1.2', 'spawn:goblin:2', 'shoot:junk:3', 'charge', 'idle:1', 'rain:junk:4', 'idle:1'] }
      ],
      intro: ["IT IS A TRACTOR. IT IS A TANK. IT IS FULL OF GOBLINS. IT IS COAL-POWERED AND IT HATES YOU.",
        "THE SPIKED WHEEL ON THE FRONT IS FOR CRAWLERS. THE LADDER ON THE BACK IS FOR GOBLINS. THE RESULT IS FOR THE HIGHLIGHT REEL."],
      defeat: "THE MURDER DOZER IS SCRAP! THE GOBLINS INSIDE ARE NOW A FINE PINK MIST. TEN OUT OF TEN. NO NOTES.",
      loot: 'boss', unlock: null },

    hoarder: { name: 'THE HOARDER', title: 'QUEEN OF THE GARBAGE MOUNTAIN',
      hp: 230, dmg: 2, w: 52, h: 58, sprite: 'hoarder', xp: 40, gold: [0, 0], flying: false,
      phases: [
        { below: 1.0, speed: 30, pattern: ['walk:2', 'spawn:scatterer:2', 'idle:1.4', 'charge', 'idle:1.2', 'spawn:scatterer:3', 'jump_slam', 'idle:1.4'] },
        { below: 0.5, speed: 42, name: 'SPRING CLEANING', sub: 'THE GARBAGE AVALANCHE',
          line: "NOW SHE'S MAD. HERE COMES THE GARBAGE. HIDE BEHIND SOMETHING THAT ISN'T ALSO GARBAGE. GOOD LUCK WITH THAT.",
          pattern: ['spawn:scatterer:3', 'charge', 'idle:0.9', 'rain:junk:5', 'spawn:brood_guardian:1', 'jump_slam', 'idle:1', 'charge', 'idle:1'] }
      ],
      intro: ["OUR FIRST REAL BOSS! FIFTEEN FEET OF WOMAN, FORTY YEARS OF GARBAGE AND EXACTLY ONE TOOTH. NONE OF IT IS FOR SALE.",
        "SHE BIRTHS SCATTERERS OUT OF HER MOUTH. YES. HER MOUTH. WE ARE AS UPSET ABOUT IT AS YOU ARE. ENJOY THE SHOW!"],
      defeat: "THE HOARDER IS DOWN! THE HEALTH DEPARTMENT HAS BEEN NOTIFIED. THE HEALTH DEPARTMENT IS ALSO DEAD. EVERYONE IS DEAD.",
      loot: 'boss', unlock: null },

    chieftain: { name: 'GOBLIN WAR CHIEFTAIN', title: 'LORD OF THE GOBLIN WORKSHOP',
      hp: 270, dmg: 2, w: 30, h: 32, sprite: 'chieftain', xp: 45, gold: [0, 0], flying: false,
      phases: [
        { below: 1.0, speed: 46, pattern: ['walk:1.5', 'throw:dynamite:3', 'idle:1', 'spawn:goblin_bomber:2', 'charge', 'idle:1.2', 'jump_slam', 'idle:1'] },
        { below: 0.5, speed: 60, name: 'BLOOD AND DYNAMITE', sub: 'THE CHIEFTAIN LIGHTS HIS BELT',
          pattern: ['throw:dynamite:5', 'charge', 'jump_slam', 'idle:0.8', 'spawn:goblin_bomber:2', 'shockwave', 'charge', 'idle:0.8'] }
      ],
      intro: ["THE GOBLIN WAR CHIEFTAIN! BONE CROWN, BIG CLEAVER, A BELT OF DYNAMITE. ONE OF THOSE IS GOING TO GO OFF NEXT TO YOU.",
        "THIS WORKSHOP IS PACKED WITH EXPLOSIVES AND FLAMMABLE GOBLINS. PLEASE BE CAREFUL. I AM KIDDING. PLEASE BE THE OPPOSITE OF CAREFUL."],
      defeat: "THE WAR CHIEFTAIN IS DEAD! THE WORKSHOP IS ALL YOURS. TAKE EVERYTHING THAT ISN'T NAILED DOWN. THEN TAKE THE NAILS.",
      loot: 'boss', unlock: null },

    juicer: { name: 'THE JUICER', title: 'BRO OF THE 24 HOUR GYM',
      hp: 380, dmg: 3, w: 44, h: 48, sprite: 'juicer', xp: 60, gold: [0, 0], flying: false,
      phases: [
        { below: 1.0, speed: 40, pattern: ['walk:1.5', 'throw:plate:3', 'idle:0.9', 'charge', 'idle:1', 'flex:2', 'walk:1', 'jump_slam', 'idle:1'] },
        { below: 0.55, speed: 54, name: 'PUMP IT UP', sub: 'NO DAYS OFF, BRO',
          pattern: ['throw:plate:4', 'charge', 'charge', 'idle:0.8', 'flex:2', 'shockwave', 'jump_slam', 'idle:0.9'] },
        { below: 0.25, speed: 66, name: 'FAILURE SET', sub: 'ONE MORE REP, BRO. ONE MORE.',
          line: "HE'S GOING TO FAILURE, FOLKS! THIS IS WHERE THE GAINS HAPPEN! OR THE DEATHS! USUALLY BOTH!",
          pattern: ['charge', 'throw:plate:6', 'idle:0.6', 'flex:1.5', 'jump_slam', 'shockwave', 'charge', 'idle:0.7'] }
      ],
      intro: ["BRO. BRO. HE NEEDS A SPOT, BRO. HE HAS NEEDED A SPOT SINCE THE DAWN OF TIME. NOBODY HAS EVER SPOTTED HIM.",
        "HE HAS NOT SKIPPED A LEG DAY IN FOUR HUNDRED YEARS. HE HAS NOT SKIPPED ANYTHING ELSE EITHER. HE IS VERY SENSITIVE ABOUT IT."],
      defeat: "THE JUICER HAS RACKED HIS LAST REP! HIS PROTEIN TUB IS NOW A CRIME SCENE. THE GYM IS UNDER NEW MANAGEMENT: A CAT.",
      loot: 'boss', unlock: null },

    ball_of_swine: { name: 'THE BALL OF SWINE', title: 'THE PORKCHOP EXPRESS',
      hp: 400, dmg: 4, w: 56, h: 56, sprite: 'ball_of_swine', xp: 90, gold: [0, 0], flying: false, floorBoss: true,
      phases: [
        { below: 1.0, speed: 30, pattern: ['idle:1.6', 'roll', 'idle:1', 'roll', 'idle:0.8', 'roll', 'idle:2'] },
        { below: 0.65, speed: 40, name: 'THE PORKCHOP EXPRESS', sub: 'ALL ABOARD',
          pattern: ['roll', 'roll', 'idle:1', 'shockwave', 'roll', 'roll', 'idle:1.6'] },
        { below: 0.3, speed: 56, sprite: 'dominatrix', w: 22, h: 30, spawnOnEnter: ['tuskling', 12], daze: 2.5,
          bossName: 'TUSKLING DOMINATRIX', name: 'THE BALL POPS!', sub: 'A DOZEN DAZED TUSKLINGS AND A WHIP',
          line: "THE BALL POPPED! PIGS EVERYWHERE! AND THE ONE IN LEATHER WITH THE WHIP WAS HOLDING IT ALL TOGETHER. FINISH HER!",
          pattern: ['walk:1.5', 'charge', 'idle:0.8', 'shoot:pebble:3', 'walk:1', 'charge', 'idle:1'] }
      ],
      intro: ["THE BOROUGH BOSS! A HUNDRED PIG-ORC ARISTOCRATS FUSED INTO ONE GIANT BALL BY A CURSE. THEY ROLL. THEY CRUSH. THEY SQUEAL.",
        "THIRTY KNIGHTS AND THEIR LADY LOVES, FUSED INTO ONE ROLLING NIGHTMARE. IT DOES NOT STOP. IT DOES NOT TURN. IT DOES NOT CARE. GOOD LUCK!"],
      defeat: "THE BALL OF SWINE IS NO MORE! THE BOROUGH IS LIBERATED! THE STAIRWELL IS OPEN! WE HAVE BACON FOR A YEAR!",
      loot: 'boss', unlock: null },

    krakaren: { name: 'THE KRAKAREN CLONE', title: 'MANAGER OF THE REV-UP DISTILLERY',
      hp: 460, dmg: 3, w: 80, h: 72, sprite: 'krakaren', xp: 140, gold: [40, 70], flying: false, gear: 'bigboi_boxers', mistTaint: 4,
      phases: [
        { below: 1.0, speed: 0, pattern: ['idle:1.2', 'tentacle', 'idle:0.8', 'shoot:snot:3', 'idle:0.8', 'sweep', 'idle:1', 'tentacle', 'tentacle', 'idle:1', 'mist:4', 'idle:1'] },
        { below: 0.55, speed: 0, name: 'MANAGER MODE', sub: 'SHE WANTS TO SPEAK TO YOUR SUPERVISOR',
          pattern: ['tentacle', 'sweep', 'idle:0.6', 'shoot:snot:4', 'spawn:clurichaun:2', 'tentacle', 'sweep', 'mist:4', 'idle:0.8'] },
        { below: 0.2, speed: 0, name: 'ONE STAR REVIEW', sub: 'SHE IS LEAVING A REVIEW. ON YOU.',
          pattern: ['tentacle', 'tentacle', 'sweep', 'shoot:snot:5', 'sweep', 'mist:3', 'tentacle', 'idle:0.6'] }
      ],
      intro: ["WAIT. BOSSES CAN LEAVE THEIR ROOMS? APPARENTLY! TWENTY FEET OF PINK OCTOPUS WITH A SOCCER MOM BOB, AND SHE WANTS YOUR MANAGER.",
        "HER TENTACLES ARE COVERED IN TINY SCREAMING MOUTHS. THE SNOT GIVES YOU THE TAINT. THE MIST GIVES YOU MEASLES. LIVE, LAUGH, LOVE!"],
      defeat: "THE KRAKAREN CLONE IS CALAMARI! THE DISTILLERY IS CLOSED UNTIL FURTHER NOTICE. THE MOONSHINE, HOWEVER, IS STILL OPEN.",
      loot: 'boss', unlock: null },

    ralph: { name: 'RALPH', title: 'THE FRENZIED GERBIL',
      hp: 540, dmg: 2, w: 16, h: 14, sprite: 'ralph', screamW: 104, xp: 120, gold: [30, 60], flying: false,
      phases: [
        { below: 1.0, speed: 60, pattern: ['idle:1', 'frenzy:3', 'idle:0.8', 'walk:1', 'scream', 'idle:1.2', 'frenzy:3', 'idle:0.8'] },
        { below: 0.5, speed: 76, releaseCages: true, name: 'FEEDING TIME', sub: 'EVERY HUNGRY CAGE OPENS',
          line: "RALPH SCREAMED FOR HIS DOGS! EVERY CAGE YOU DIDN'T FEED IS OPENING! I HOPE YOU BROUGHT BISCUITS. YOU DIDN'T, DID YOU?",
          pattern: ['frenzy:4', 'scream', 'idle:0.6', 'frenzy:3', 'walk:0.8', 'scream', 'spawn:kobold:2', 'idle:0.8'] }
      ],
      intro: ["THE KOBOLD BOSS IS... A GERBIL. ONE ADORABLE LITTLE GERBIL NAMED RALPH. LOOK AT HIS FACE. NOW LOOK AT HIS MOUTH. NOW RUN.",
        "HE IS FOUR INCHES OF PURE HATRED. HE HAS KILLED EVERY DOG IN THIS POUND IN A FAIR FIGHT. NONE OF THEM WERE FAIR. HE IS VERY PROUD."],
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
    '###########...######...#########',
    '###########...######...#########'] };

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
    '..............>.....==..............',
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
    '##########################..############',
    '##########################..############'] };

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
    '..e..................^^......e......',
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
    '..........o.o....o.o................',
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
    '.........====...====...====.........',
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
    '..e....bb.......e.....^^......e.....',
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
    '.........o....o....o....o...........',
    '....................................',
    '....................................',
    '.........XX...XX...XX...XX..........',
    '..e......XX...XX...XX...XX......e...',
    '#######..XX...XX...XX...XX..########',
    '#######..XX...XX...XX...XX..########'] };

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
    '.............>........<.............',
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
    '##############~~~#################',
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
    '..e...$..............^^....e....',
    '################################',
    '################################'] };

  // the krakaren breaks out of her chamber into this hall (stage.breakout)
  C.arena_krakaren = { rows: [
    'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
    'X..........................................X',
    'X..........................................X',
    'X..........................................X',
    'X............................X.............X',
    '.............................X.............X',
    '.............................X.............X',
    '.......=====........=====....X.......====..X',
    '.............................X.............X',
    '..c...h..................h...X...K.........X',
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
      "PITS KILL YOU. FLAGS ARE CHECKPOINTS: IF A SPONSOR REVIVES YOU, YOU START AT THE LAST ONE. YOUR CAT HAS NO SPELLS YET. SHE IS FURIOUS ABOUT IT.",
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
    intro: "THE MURDER DOZER IS STILL IDLING OUTSIDE THE GUILD. THE GOBLINS ON TOP HAVE STARTED A SECOND SONG. IT IS WORSE THAN THE FIRST." });

  st('f1_llamas', { name: 'LLAMA COUNTRY', floor: 1, theme: 'tunnels', kind: 'main', music: 'floor1',
    questItem: 'meth',
    chunks: { start: 'tn_start', pool: ['tn_a', 'tn_c', 'tn_e', 'tn_g', 'tn_i'], count: 4, insert: ['tn_meth'], end: 'end_door' },
    enemies: [['bad_llama', 3], ['rat', 3], ['scatterer', 2]], elite: [['bad_llama', 1]], flyers: [['scatterer', 1]],
    reward: { box: 'bronze', xp: 12 },
    intro: "LLAMA COUNTRY! THE LOCALS ARE TALL, FURRY AND DEEPLY UNPLEASANT. MAKE FRIENDS. OR DON'T. WE GET PAID EITHER WAY." });

  st('f1_scatter', { name: 'SCATTERER ALLEY', floor: 1, theme: 'tunnels', kind: 'main', music: 'floor1', dark: true,
    chunks: { start: 'tn_start', pool: ['tn_b', 'tn_d', 'tn_f', 'tn_h', 'tn_a'], count: 4, end: 'end_door' },
    enemies: [['scatterer', 7], ['rat', 1]], elite: [['brood_guardian', 1]], flyers: [['scatterer', 1]],
    reward: { box: 'bronze', xp: 12 },
    intro: "A PITCH-BLACK SIDE ALLEY. SOMETHING IN HERE IS SKITTERING. A LOT OF SOMETHINGS. YOU HAVE BARE FEET. GOOD LUCK, CRAWLER." });

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
    intro: "A NICE QUIET HALLWAY. LOW CEILINGS. GOOD VIBES. NOTHING TO WORRY ABOUT. ENJOY THE STROLL, CRAWLER." });

  st('f1_ride', { name: '100 MILES EAST', floor: 1, theme: 'tunnels', kind: 'ride', music: 'ride',
    ride: { finishText: 'MEADOW LARK THIS WAY', countdown: 1.6, pitDmg: 3 },
    chunks: { start: 'ride_start', pool: RIDE, count: 10, end: 'ride_lark' },
    enemies: [['goblin', 3], ['rat', 3], ['bad_llama', 1], ['trog_pygmy', 1]], elite: [['trog_basher', 1]], flyers: [['scatterer', 1]],
    reward: { box: 'silver', xp: 18 },
    intro: "THE GOBLIN COPPER CHOPPER, EVERYBODY! JUMP TO HOP (JUMP ON A RAMP FOR BIG AIR), ATTACK TO PUNCH FROM THE SADDLE, BOMB DROPS ONE BEHIND YOU. HEAD EAST!" });

  st('f1_trogs', { name: 'TROGLODYTE NEIGHBORHOOD', floor: 1, theme: 'tunnels', kind: 'main', music: 'floor1',
    chunks: { start: 'tn_start', pool: ['tn_trog_a', 'tn_trog_b', 'tn_c', 'tn_f', 'tn_g', 'tn_h'], count: 4, end: 'end_door' },
    enemies: [['trog_pygmy', 4], ['trog_virtuoso', 2], ['rat', 2]], elite: [['trog_basher', 1]], flyers: [['trog_pygmy', 1]],
    reward: { box: 'bronze', xp: 16 },
    intro: "TROGLODYTE COUNTRY! IT SMELLS LIKE A REPTILE HOUSE THAT GAVE UP ON ITSELF. THE NEIGHBORS ARE NOT FRIENDLY. SMILE!" });

  st('f1_juicer', { name: 'THE 24 HOUR GYM', floor: 1, theme: 'gym', arenaTheme: 'gym_red', kind: 'boss', music: 'gym',
    chunks: { start: 'gy_start', pool: ['gy_a', 'gy_b', 'gy_c'], count: 2, end: 'arena_juicer' },
    enemies: [['trog_pygmy', 3], ['trog_virtuoso', 1]], elite: [['trog_basher', 1]], flyers: [['trog_pygmy', 1]],
    boss: 'juicer', reward: { box: 'boss', xp: 24 },
    intro: "A 24-HOUR GYM IN A DUNGEON. THE POSTER SAYS TODAY IS THE DAY YOU GAIN. SOMEWHERE IN THE BACK, SOMEONE IS GRUNTING. LOUDLY. RHYTHMICALLY." });

  st('f1_swine', { name: 'THE BALL OF SWINE', floor: 1, theme: 'swine', kind: 'boss', music: 'boss_final',
    // allies in A-cell order; low dmg so Carl does most of the work (stage.js default guns are strong)
    allies: [{ id: 'brandon', dmg: 1 }, { id: 'chris', dmg: 1 }, { id: 'imani', dmg: 1 }, { id: 'yolanda', dmg: 1 }, { id: 'agatha', dmg: 1 }],
    door: 'stairwell',
    chunks: { start: 'sw_start', pool: ['sw_a', 'sw_b'], count: 1, end: 'arena_swine' },
    enemies: [['tuskling', 3], ['rat', 1]], elite: [['tuskling', 1]], flyers: [['tuskling', 1]],
    boss: 'ball_of_swine', reward: { box: 'boss', xp: 30 },
    intro: "BOROUGH BOSS TIME! MEADOW LARK IS UP ON THE REDOUBT. THE STAIRWELL IS IN THE MIDDLE. SOMETHING VERY ROUND IS IN THE WAY!" });

  /* ================= FLOOR 2: THE SECOND FLOOR ================= */
  var JAN = { id: 'brindle_grub', chance: 0.3, cap: 8 };

  st('f2_maze', { name: 'THE CINDERBLOCK MAZE', floor: 2, theme: 'cinder', kind: 'main', music: 'floor2',
    janitor: JAN,
    chunks: { start: 'cn_start', pool: ['cn_a', 'cn_b', 'cn_c', 'cn_d', 'cn_g', 'cn_h'], count: 5, end: 'end_door' },
    enemies: [['brindle_grub', 4], ['dingo', 2], ['mind_horror', 1]], elite: [['cow_grub', 1]], flyers: [['mind_horror', 1]],
    reward: { box: 'silver', xp: 30 },
    intro: "THE SECOND FLOOR! WHITE FLOORS, ORANGE LICHEN AND A MAZE THAT GOES ON FOREVER. EVERYTHING DOWN HERE IS HUNGRY. AND NOW THE AUDIENCE IS WATCHING!" });

  st('f2_revup', { name: 'REV-UP COUNTRY', floor: 2, theme: 'cinder', kind: 'main', music: 'floor2',
    janitor: JAN,
    chunks: { start: 'cn_start', pool: ['cn_a', 'cn_c', 'cn_d', 'cn_e', 'cn_f', 'cn_bisc'], count: 4, end: 'end_door' },
    enemies: [['clurichaun', 4], ['brindle_grub', 2]], elite: [['laminak', 1]], flyers: [['laminak', 1]],
    reward: { box: 'silver', xp: 32 },
    intro: "REV-UP COUNTRY! SOMEBODY DOWN HERE HAS AN EXCITING BUSINESS OPPORTUNITY FOR YOU. SAY NO. SAY NO LOUDLY. AND WASH YOUR HANDS." });

  st('f2_krakaren', { name: 'THE REV-UP DISTILLERY', floor: 2, theme: 'distillery', kind: 'boss', music: 'boss',
    breakout: true, bossMusic: 'boss',
    breakoutText: "WAIT. BOSSES CAN LEAVE THEIR ROOMS? THE KRAKAREN CLONE JUST CAME THROUGH SOLID CINDERBLOCK BECAUSE YOU WERE SKIPPING HER. RUDE!",
    chunks: { start: 'ds_start', pool: ['ds_a', 'ds_b', 'ds_c'], count: 2, end: 'arena_krakaren' },
    enemies: [['clurichaun', 3], ['brindle_grub', 1]], elite: [['laminak', 1]], flyers: [['laminak', 1]],
    boss: 'krakaren', reward: { box: 'boss', xp: 40 },
    intro: "THE REV-UP DISTILLERY. LIVE, LAUGH, LOVE OVER THE DOOR. THE BOSS ROOM IS UP AHEAD AND YOU ARE SKIPPING IT. SMART! SHE DISAGREES." });

  st('f2_rage', { name: 'THE DRIVE OF A LIFETIME', floor: 2, theme: 'cinder', kind: 'ride', music: 'rage',
    pursuer: { id: 'rage_elemental', kind: 'boss', speed: 150, delay: 3, dmg: 6, reverseEvery: 8 },
    ride: { finishText: 'THE STAIRWELL', countdown: 1.6, pitDmg: 3 }, door: 'stairwell',
    chunks: { start: 'ride_start', pool: RIDE, count: 10, end: 'ride_stairs' },
    enemies: [['brindle_grub', 3], ['dingo', 1], ['clurichaun', 1]], elite: [['cow_grub', 1]], flyers: [['brindle_grub', 1]],
    reward: { box: 'gold', xp: 60 },
    intro: "THE WHOLE GALAXY IS WATCHING! ONE MAN, HIS EX'S CAT AND A COPPER CHOPPER VERSUS A LEVEL 93 RAGE ELEMENTAL. DRIVE IT INTO THE STAIRWELL. GO!" });

  st('f2_kobolds', { name: 'KOBOLD COUNTRY', floor: 2, theme: 'cinder', kind: 'main', music: 'floor2',
    janitor: JAN,
    chunks: { start: 'cn_start', pool: ['cn_a', 'cn_c', 'cn_e', 'cn_f', 'cn_g', 'cn_bisc'], count: 5, end: 'end_door' },
    enemies: [['kobold', 4], ['dingo', 2], ['cow_grub', 1]], elite: [['kobold_rider', 1]], flyers: [['vespa', 1]],
    reward: { box: 'silver', xp: 36 },
    intro: "KOBOLD COUNTRY! HEAR THAT? THAT IS YAPPING. A LOT OF YAPPING. PICK UP ANY PET BISCUITS YOU SEE. TRUST ME." });

  st('f2_ralph', { name: 'THE MUNICIPAL DOG POUND', floor: 2, theme: 'pound', kind: 'boss', music: 'boss',
    chunks: { start: 'pd_start', pool: ['pd_a', 'pd_b'], count: 1, end: 'arena_ralph' },
    enemies: [['kobold', 3], ['dingo', 1]], elite: [['kobold_rider', 1]], flyers: [['vespa', 1]],
    boss: 'ralph', reward: { box: 'boss', xp: 40 },
    intro: "A PORTUGUESE MUNICIPAL DOG POUND. CAGED DINGOES LINE THE WALLS. THEY LOOK HUNGRY. SOMETHING IN THE BACK IS SCREAMING." });

  st('f2_return', { name: 'THE LONG WAY BACK', floor: 2, theme: 'cinder', kind: 'main', music: 'floor2',
    extraAlly: 'mongo', door: 'stairwell',
    janitor: { id: 'brindle_grub', chance: 0.5, cap: 12 },
    chunks: { start: 'cn_start', pool: ['cn_b', 'cn_c', 'cn_d', 'cn_f', 'cn_h', 'cn_g'], count: 4, end: 'cn_stairs' },
    enemies: [['brindle_grub', 4], ['cow_grub', 2], ['dingo', 1]], elite: [['cow_grub', 1]], flyers: [['vespa', 2]],
    reward: { box: 'gold', xp: 40 },
    intro: "THE GRUBS HAVE HIT THE SPAWN LIMIT AND SOMETHING BIGGER IS HATCHING. BACK TO THE STAIRWELL! THE NEW DINOSAUR WILL HELP. HE BITES." });

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
      required: [], boss: 'f1_swine', par: 2400,
      // mobs level up with the dungeon: HP multiplier and added hit damage, first stage -> last stage
      mobs: { hp: [1.0, 1.6], dmg: [0, 2] } },
    { n: 2, name: 'THE SECOND FLOOR', tagline: 'SIX DAYS. THE CAMERAS ARE LIVE. DO NOT PEE.', theme: 'cinder', music: 'floor2',
      days: 6, viewers: true, overworld: null,
      intro: ["WELCOME TO THE SECOND FLOOR, BITCHES! SIX DAYS, THE LEGAL MINIMUM. A CINDERBLOCK MAZE FULL OF THINGS THAT EAT THINGS.",
        "AND THE VIEWERS ARE LIVE! FOLLOWERS, FAVORITES, SPONSORS. EVERY KILL IS CONTENT NOW. MAKE IT PRETTY. OR AT LEAST MAKE IT LOUD."],
      sequence: ['CUT:f2_welcome', 'f2_maze', 'SAFE:shelter', 'f2_revup', 'CUT:f2_jug', 'f2_krakaren', 'SAFE:bugaboo', 'CUT:f2_jack',
        'f2_rage', 'CUT:f2_deathwatch', 'f2_kobolds', 'f2_ralph', 'CUT:f2_menagerie', 'f2_return', 'CUT:f2_descent'],
      required: [], boss: 'f2_ralph', par: 1800,
      mobs: { hp: [1.8, 2.4], dmg: [2, 3] } }
  ];
})();

/* ==========================================================================
   SAFE ROOMS + CUTSCENES
   Line speakers: default SYSTEM AI / p_ai. {who: '', portrait: null} is a
   narration box. Lines <= 170 chars; 1-5 lines per panel; 3-8 panels.
   ========================================================================== */
(function () {
  'use strict';
  var D = window.DCW.data;

  /* ---- speaker helpers ---- */
  function ai(t) { return { who: 'SYSTEM AI', portrait: 'p_ai', text: t }; }
  function nar(t) { return { who: '', portrait: null, text: t }; }
  function carl(t) { return { who: 'CARL', portrait: 'p_carl', text: t }; }
  function carlMad(t) { return { who: 'CARL', portrait: 'p_carl_mad', text: t }; }
  function donut(t) { return { who: 'DONUT', portrait: 'p_donut', text: t }; }
  function smug(t) { return { who: 'DONUT', portrait: 'p_donut_smug', text: t }; }
  function mord1(t) { return { who: 'MORDECAI', portrait: 'p_mordecai_f1', text: t }; }
  function mord2(t) { return { who: 'MORDECAI', portrait: 'p_mordecai_f2', text: t }; }
  function say(who, portrait, t) { return { who: who, portrait: portrait, text: t }; }
  function tally(t) { return say('TALLY', 'p_tally', t); }
  function qwist(t) { return say('QWIST', 'p_qwist', t); }

  /* ---- actor helpers (feet on the panel floor; x 0-320) ---- */
  function A(sprite, x, flip) { return { sprite: sprite, x: x, flip: !!flip, frame: 0 }; }
  var CD = [A('carl_idle', 118), A('donut_idle', 140)];

  /* ================= SAFE ROOMS ================= */
  D.safeRooms = {
    guild: { name: "MORDECAI'S GUILD HALL", theme: 'safe_guild', music: 'safe', npc: 'mordecai',
      services: ['mordecai', 'boxes', 'rest'],
      greet: [
        mord1("YOUR ACHIEVEMENTS CAME WITH BOXES. OPEN THEM AT THE TABLE. THE SHOW WANTS EVERY UNBOXING ON CAMERA, EVEN WHEN NOBODY'S WATCHING YET."),
        carl("A TROLLSKIN SHIRT. A HOODED CLOAK. A CLUB SHAPED LIKE A TOAD. NO SHOES. OF COURSE THERE ARE NO SHOES."),
        donut("A CROWN, CARL! A JEWELED CROWN! THE LABEL SAYS SOMETHING VERY RUDE ABOUT A SEPSIS WHORE, BUT THE GEMS ARE VERY REAL."),
        mord1("THAT NEW TATTOO ON YOUR ARM IS A GOBLIN PASS. GOBLINS AREN'T SUPPOSED TO ATTACK ON SIGHT. MOST OF THEM CAN'T READ, SO KEEP YOUR FISTS UP."),
        mord1("AND TWO PET BISCUITS. KEEP THOSE. YOU NEVER KNOW. TALK TO ME WHEN YOU'VE GOT STAT POINTS TO SPEND.")
      ],
      give: [{ kind: 'gear', id: 'trollskin_shirt' }, { kind: 'gear', id: 'nightgaunt_cloak' }, { kind: 'gear', id: 'toad_cudgel' },
        { kind: 'gear', id: 'crown_sepsis' }, { kind: 'item', id: 'biscuit', count: 2 }],
      restedLine: "YOU ALREADY SLEPT. MORDECAI IS GIVING YOU A LOOK. GET OUT THERE, KID.",
      restLine: "YOU SLEEP ON A GUILD BENCH. MORDECAI SNORES LIKE A WOOD CHIPPER ALL NIGHT. YOU WAKE UP FULLY HEALED AND DEEPLY ANNOYED." },

    tally: { name: "TALLY'S RESTAURANT", theme: 'safe_tally', music: 'safe', npc: 'tally',
      services: ['shop', 'boxes', 'rest', 'tv'],
      shopName: 'TALLY',
      shopLines: ["HELLO. YOU BUY. I SELL. GOOD.", "POTION IS RED. RED IS GOOD.", "NO SHOES. SORRY. I ASK EVERY DAY. NO SHOES.",
        "DYNAMITE. NOT INSIDE. PLEASE. I JUST MOP.", "PRINCESS WANT MORE PATE? I MAKE. ALWAYS I MAKE.", "NO GOLD? THEN NO. SORRY. RULES."],
      greet: [
        tally("WELCOME. SAFE ROOM. NO FIGHTING. YOU SIT. I COOK."),
        donut("CARL, IT'S A POLISH FAST FOOD RESTAURANT WITH A PLAY AREA AND A BALL PIT. I HAVE NEVER BEEN SO DELIGHTED AND SO HORRIFIED AT ONCE."),
        tally("FOR PRINCESS. SALMON PATE. AND THIS. A BUTTERFLY, MADE OF STONE. SHINY. FOR LUCK."),
        carl("TALLY, IS THAT A MURGH VINDALOO? IN A POLISH BURGER JOINT? AT THE END OF THE WORLD? I THINK I LOVE YOU."),
        tally("MANY YEARS I LEARN EARTH FOOD. NOBODY COMES. NOW EARTH PERSON EATS. GOOD. VERY GOOD.")
      ],
      give: [{ kind: 'gear', id: 'talisman_butterfly' }],
      restName: 'MURGH VINDALOO', restVerb: 'EAT', npcName: 'TALLY',
      restedLine: "TALLY SHAKES HIS HEAD. ONE BOWL. YOU EAT TWO, YOU EXPLODE. NO EXPLODING IN RESTAURANT.",
      restLine: "TALLY BRINGS A STEAMING BOWL OF MURGH VINDALOO. IT IS THE BEST THING YOU HAVE EVER EATEN. YOU SLEEP LIKE THE DEAD. THE GOOD KIND.",
      tvLines: [
        "CRAWLER COUNT: THIRTEEN MILLION ENTERED THE DUNGEON. THE COUNTER IS GOING DOWN. QUICKLY. THE COUNTER HAS A SAD LITTLE BEEP NOW.",
        "PROMO: DUNGEON CRAWLER WORLD: EARTH, EPISODE ONE, COMING SOON! WE HAVE SO MUCH FOOTAGE OF PEOPLE FALLING INTO PITS.",
        "PUBLIC SERVICE ANNOUNCEMENT: THE PLAY AREA IS FOR CHILDREN. YOU ARE NOT A CHILD. GET OUT OF THE BALL PIT, CRAWLER.",
        "TODAY'S TIP: SAFE ROOMS ARE SAFE. HALLWAYS ARE NOT. THE DIFFERENCE IS THE DOOR. LOVE YOUR DOOR.",
        "BOSS WATCH: SOMETHING ON THIS FLOOR HAS NOT THROWN ANYTHING AWAY SINCE THE EIGHTIES. SHE IS NEARBY. SHE IS HUNGRY."
      ] },

    cookie: { name: 'AN UNSTAFFED SAFE ROOM', theme: 'safe_cookie', music: 'safe', npc: null,
      services: ['cookies', 'boxes', 'rest', 'tv'], cookieXp: 30,
      greet: [
        ai("ACHIEVEMENT! WAR CRIMINAL! MORE THAN TWENTY NON-COMBATANTS IN ONE ATTACK. THAT WORKSHOP ROOM WAS A GOBLIN NURSERY. WAS. GOLD ASSHOLE'S BOX!"),
        ai("ACHIEVEMENT! YOU MONSTER! YOU KILLED A CHILD. SEVERAL. GOBLIN, BUT STILL. HERE IS A BRONZE ASSHOLE'S BOX. INSIDE: THE DESPERADO PASS!"),
        donut("CARL. YOU BLEW UP A NURSERY."),
        carlMad("I DIDN'T KNOW IT WAS A NURSERY! AND YOU CAST MAGIC MISSILE AT A ROOM FULL OF DYNAMITE AND SET THE WHOLE WORKSHOP ON FIRE."),
        smug("THAT WAS AN ACCIDENT, CARL. A GLORIOUS ACCIDENT. ALSO I GOT AN ARMORED SKIRT. IT'S A CRUPPER. HORSES WEAR THEM. I WILL ALLOW IT.")
      ],
      give: [{ kind: 'achieve', id: 'war_criminal' }, { kind: 'achieve', id: 'you_monster' }, { kind: 'gear', id: 'fae_crupper' }],
      cookieLines: ["STALE. CHEWY. DELICIOUS. A LITTLE WISER, OR AT LEAST A LITTLE MORE LEVELED.",
        "YOU ALREADY ATE YOUR COOKIE. THE PLATE REFILLS NEXT VISIT. DONUT IS GUARDING IT. DON'T."],
      restedLine: "YOU ALREADY SLEPT HERE. THE TVS ARE STILL TALKING. THEY NEVER STOP TALKING.",
      restLine: "THREE TVS MURMUR ALL NIGHT. YOU DREAM OF STALE COOKIES AND SMALL GREEN FACES. YOU WAKE UP HEALED. MOSTLY.",
      tvLines: [
        "TONIGHT ON THE RECAP: A CRAWLER IN BOXERS RIDES A COPPER CHOPPER AWAY FROM A BURNING GOBLIN WORKSHOP. NO, WE DO NOT KNOW EITHER.",
        "DESPERADO CLUB MEMBERS: YOUR PASS TATTOO IS PERMANENT AND VISIBLE THROUGH ALL ARMOR. YOU CANNOT USE IT YET. WEAR IT WITH SHAME.",
        "EXPERIENCE COOKIES: STALE, CHEWY, AND FULL OF XP. ONE PLATE PER VISIT. LICKING THE PLATE GIVES NOTHING. WE CHECKED. THE CAT CHECKED.",
        "GOBLIN NEWS: THE LLAMA WAR IS GOING VERY WELL FOR SOMEONE. NOT THE GOBLINS. NOT THE LLAMAS. PROBABLY THE METH.",
        "REMINDER: FLOOR ONE COLLAPSES IN A FEW DAYS. ANYONE STILL HERE BECOMES PART OF THE SCENERY. FIND THE STAIRS!"
      ] },

    guild2: { name: 'THE TRAINING GUILD', theme: 'safe_guild', music: 'safe', npc: 'mordecai',
      services: ['mordecai', 'boxes', 'rest'],
      greet: [
        mord1("THE JUICER, HUH? NOT BAD, KID. THERE'S A GAUNTLET IN THAT BOSS BOX. PUT IT ON. YOUR KNUCKLES LOOK LIKE GROUND BEEF."),
        carl("ENCHANTED WAR GAUNTLET OF THE EXALTED GRULL. FINALLY. SOMETHING BETWEEN MY HANDS AND THE MONSTERS."),
        smug("AND I LEARNED PUDDLE JUMPER. I CAN TELEPORT, CARL. I CAN LEAVE ANY CONVERSATION I WANT. INCLUDING THIS ONE."),
        mord1("LISTEN. ON THE THIRD FLOOR THE GODS START WATCHING. SOME OF THEM SPONSOR. SOME OF THEM SMITE. DON'T PRAY TO ANYTHING YOU HAVEN'T MET."),
        mord1("AND THAT BOROUGH BOSS UP THE ROAD IS A DIFFERENT ANIMAL. BIGGER. MEANER. IT SITS ON THE STAIRS. YOU'LL WANT FRIENDS FOR THAT ONE.")
      ],
      give: [{ kind: 'gear', id: 'war_gauntlet' }],
      restedLine: "YOU ALREADY NAPPED. MORDECAI SAYS THE MATS NEED TO AIR OUT. THEY WILL NEVER AIR OUT.",
      restLine: "MORDECAI LETS YOU NAP ON THE TRAINING MATS. THEY SMELL LIKE A HUNDRED DEAD CRAWLERS. YOU SLEEP GREAT ANYWAY. YOU ARE HEALED." },

    shelter: { name: 'BIG SHOT CHICKEN', theme: 'safe_shelter', music: 'safe', npc: 'qwist',
      services: ['shop', 'boxes', 'rest', 'tv', 'mailbox'],
      shopName: 'QWIST',
      shopLines: ["PRINCESS IS BACK! YOU BUY? I BRUSH HER AFTER.", "CHICKEN, NO. CHICKEN IS FOR EATING. POTIONS ARE FOR SELLING.",
        "JUGS? YOU MAKE JUGS? QWIST DOES NOT WANT TO KNOW.", "BISCUIT FOR DOGGIES. DOGGIES LIKE. DOGGIES STOP BITING.", "GOLD FIRST. THEN THING. SORRY."],
      greet: [
        qwist("WELCOME TO BIG SHOT CHICKEN. SAFE. CLEAN. MOSTLY CLEAN. PRINCESS, YOU WANT CUSTARD? I HAVE CUSTARD."),
        ai("ACHIEVEMENT! THIS LITTLE PIGGY WENT TO MARKET! DAYS OF BARE FEET ON DUNGEON STONE, AND SOMEBODY UP HERE APPRECIATES IT. A LOT."),
        ai("HERE IS A PLATINUM SHOE BOX! IT DOES NOT CONTAIN SHOES. IT CONTAINS A PEDICURE KIT. DADDY LIKES THOSE TOES SHINY."),
        carlMad("I HATE THIS PLACE. I HATE THIS ENTIRE PLACE SO MUCH."),
        donut("CARL, MAIL! I'VE BEEN INVITED INTO THE DUNGEON BOOK OF THE FLOOR CLUB! THE FIRST BOOK IS A SPELL: SECOND CHANCE. I CAN RAISE THE DEAD!")
      ],
      extras: [{ sprite: 'elle_idle', portrait: 'p_elle', name: 'ELLE', x: 262, flip: true, lines: [
        "HELP AN OLD LADY OVER THE THRESHOLD, HANDSOME? THE WHEELS STICK IN THE GROUT, AND I LIKE THE VIEW FROM BACK HERE.",
        "NINETY-NINE YEARS OLD AND I FINALLY GET TO WATCH A MAN IN HIS SKIVVIES FIGHT A GIANT WORM. WORTH THE WAIT, SUGAR.",
        "BRANDON SAYS MEADOW LARK GOES DOWN THE MOMENT WE CAN. I SAY WE GO DOWN IN STYLE. YOU, ME, A DANCE FLOOR. THINK ABOUT IT."] }],
      restName: 'FRIED CHICKEN', restVerb: 'EAT', npcName: 'QWIST',
      restedLine: "QWIST SAYS ONE CHICKEN PER CRAWLER PER NIGHT. QWIST IS VERY FIRM ABOUT THIS. QWIST HAS A SPATULA.",
      restLine: "QWIST BRUSHES DONUT FOR AN HOUR WHILE YOU SLEEP IN A RED BOOTH. IT SMELLS LIKE FRIED CHICKEN AND SAFETY. YOU ARE HEALED.",
      tvLines: [
        "FOLLOWERS ARE LIVE! TOP NEW CRAWLER THIS HOUR: A PERSIAN CAT IN A CROWN. HER HANDLER IS THE GUY IN BOXERS. NOBODY ASKED ABOUT HIM.",
        "RECAP: LAST FLOOR'S BOROUGH BOSS FIGHT, IN SLOW MOTION, WITH MUSIC. THE BALL OF SWINE NEVER LOOKED SO GOOD. OR SO FLAT.",
        "ANNOUNCEMENT: THE HALLWAY BATHROOMS ARE GONE. DO NOT URINATE IN THE HALLS. WE MEAN IT. WE HAVE SOMETHING SET UP FOR IT.",
        "MEADOW LARK UPDATE: THIRTY-SOME SENIORS AND THEIR STAFF ARE STILL ALIVE ON FLOOR TWO. THE BETTING POOLS HATE THEM. WE LOVE THEM.",
        "PATRONAGE NEWS: THREE GODS AND A FURNITURE COMPANY ARE INTERESTED IN SPONSORING A CRAWLER. NOT YOU. KEEP TRYING."
      ],
      mailLines: [
        "DUNGEON BOOK OF THE FLOOR CLUB: CONGRATULATIONS, PRINCESS DONUT! THIS FLOOR'S BOOK: SECOND CHANCE. RAISE A DEAD MOB AS YOUR MINION!",
        "FAN MAIL FOR DONUT: 'YOU ARE SO FLUFFY AND MURDERY.' FAN MAIL FOR CARL: NONE. ONE LETTER ASKING IF THE CAT IS SINGLE.",
        "A SPONSOR GIFT FOR CARL! IT IS A COUPON FOR PANTS. THE PANTS STORE IS ON A DIFFERENT PLANET. THE COUPON HAS EXPIRED.",
        "BORANT LEGAL: REMINDER THAT URINATING IN A HALLWAY VOIDS ALL WARRANTIES ON YOUR BODY. WE ARE NOT KIDDING. PLEASE STOP ASKING."
      ] },

    bugaboo: { name: "MORDECAI'S FLOOR TWO GUILD", theme: 'safe_bugaboo', music: 'safe', npc: 'mordecai',
      services: ['mordecai', 'boxes', 'rest', 'tv'],
      greet: [
        mord2("DON'T. SAY. A WORD. YES, I'M A BUGABOO NOW. SEVEN FEET OF HAIR, NO NECK, OWL EYES. THE PRODUCERS THINK IT'S HILARIOUS."),
        smug("MORDECAI, YOU LOOK LIKE A PUPPET THAT HAS DONE SEVERAL CRIMES."),
        mord2("THAT'S... FAIR. SIT DOWN BEFORE YOU FALL DOWN, KID. THAT OCTOPUS NEARLY TURNED YOU INTO SOUP."),
        carl("THE BOSS BOX HAD BOXERS IN IT. ENCHANTED BIGBOI BOXERS. THEY STRETCH IF I GROW. WHY WOULD I EVER GROW, MORDECAI?"),
        mord2("DON'T WORRY ABOUT IT. AND FOR THE PRINCESS: A FUR BRUSH. ENCHANTED. BRUSH HER EVERY DAY AND HER SPELLS HIT HARDER. DON'T ASK HOW.")
      ],
      give: [{ kind: 'gear', id: 'fur_brush' }],
      extras: [{ sprite: 'zev_idle', portrait: 'p_zev', name: 'ZEV', x: 262, flip: true, lines: [
        "HI! ZEV, BORANT COMMUNICATIONS, OUTREACH ASSOCIATE. I'M YOUR PR AGENT NOW! SURPRISE! SMILE, I'M ALWAYS RECORDING.",
        "THE FOCUS GROUPS LOVE THE CAT. THE FOCUS GROUPS ARE... DIVIDED ON THE BOXERS. ONE GROUP STARTED A FIRE. A SMALL ONE.",
        "WE DO A FINS-ON APPROACH AT BORANT. THAT MEANS I VISIT IN PERSON. WITH SNACKS. AND PAPERWORK. MOSTLY PAPERWORK.",
        "DONUT, SWEETIE, NEXT INTERVIEW: CHIN UP, TAIL HIGH, AND DO NOT TELL ANYONE YOU KNOW HOW TO OPEN DOORS."] }],
      restedLine: "YOU ALREADY SLEPT. MORDECAI IS PRETENDING TO READ. HIS EYES ARE TOO BIG TO PRETEND WITH.",
      restLine: "MORDECAI DOZES IN A CHAIR FAR TOO SMALL FOR HIM, OWL EYES HALF OPEN ALL NIGHT. YOU SLEEP ANYWAY. YOU ARE HEALED.",
      tvLines: [
        "BREAKING: A BOSS LEFT HER ROOM ON FLOOR TWO! THE KRAKAREN CLONE IS NOW CALAMARI. THE DISTILLERY IS CLOSED. THE BAR IS NOT.",
        "VIEWER POLL: SHOULD THE GUY IN BOXERS PUT ON PANTS? NO: 88 PERCENT. YES: 2 PERCENT. WHAT IS PANTS: 10 PERCENT.",
        "CRAWLER COUNT: FEWER THAN BEFORE. MUCH FEWER. WE STOPPED SHOWING THE NUMBER BECAUSE IT WAS BAD FOR MORALE. OURS.",
        "SPONSOR MESSAGE: REV-UP SMOOTHIES! NOW WITH SLIGHTLY FEWER CORPSES! ASK YOUR LOCAL LAMINAK ABOUT AN EXCITING OPPORTUNITY!",
        "THE RECAP AFTER THE RECAP: PRINCESS DONUT'S FOLLOWERS DOUBLED OVERNIGHT. CARL'S DOUBLED TOO. FROM SIX TO TWELVE."
      ] }
  };

  /* ================= CUTSCENES ================= */
  D.cutscenes = {
    /* the Transformation (played by game.js before name entry) */
    prologue: { music: 'intro', panels: [
      { bg: 'surface', fx: 'snow', actors: [A('carl_idle', 112)], lines: [
        nar("THE COLDEST NIGHT OF THE YEAR. A MAN STANDS ON AN EMPTY STREET IN HIS BOXERS, HIS LEATHER JACKET AND ABSOLUTELY NOTHING ON HIS FEET."),
        carl("IT'S TEN DEGREES OUT. I'M NOT WEARING PANTS. AND SOMEWHERE OUT HERE IS A CAT THAT DOESN'T EVEN LIKE ME.")] },
      { bg: 'surface', fx: 'snow', actors: [A('carl_idle', 100), A('donut_idle', 214, true)], lines: [
        nar("THE CAT IS PRINCESS DONUT, A CHAMPION PERSIAN SHOW CAT. SHE BELONGS TO BEA, CARL'S EX. BEA RAN OFF SOMEWHERE WARM. THE CAT STAYED."),
        carl("DONUT. PRINCESS. YOUR HIGHNESS. GET OFF THAT CAR BEFORE YOUR LITTLE FEET FREEZE TO THE HOOD."),
        donut("MREOW.")] },
      { bg: 'surface', fx: 'collapse', actors: [A('carl_idle', 120), A('donut_idle', 144)], lines: [
        nar("THEN THE GROUND HUMS. EVERY BUILDING ON THE BLOCK SLIDES DOWN INTO THE EARTH. NO EXPLOSIONS. NO SCREAMS. JUST... GONE."),
        nar("EVERYONE INDOORS WENT WITH THEM. CARL WAS OUTSIDE, CHASING A CAT IN HIS UNDERWEAR. THAT IS THE ONLY REASON HE IS ALIVE."),
        carl("...WHAT THE FUCK.")] },
      { bg: 'surface', fx: 'static', actors: [A('carl_idle', 120), A('donut_idle', 144), A('ai_screen', 230)], lines: [
        ai("HELLO, EARTH! THIS IS YOUR SYSTEM AI! YOUR PLANET HAS BEEN SELECTED TO HOST THE GALAXY'S FAVORITE PROGRAM: DUNGEON CRAWLER WORLD!"),
        ai("YOUR BUILDINGS HAVE BEEN RECYCLED. BUT GOOD NEWS! UNDER YOUR FEET IS AN EIGHTEEN-FLOOR DUNGEON. BEAT IT AND YOU GET YOUR PLANET BACK. PROBABLY!"),
        ai("STAIRWELLS ARE OPENING NOW. ANYONE STILL ON THE SURFACE WHEN THEY CLOSE WILL BE... LET'S NOT SPOIL IT. CHOP CHOP, SURVIVORS!")] },
      { bg: 'surface', fx: 'snow', actors: [A('carl_idle', 130), A('donut_idle', 152)], lines: [
        carl("OKAY. OKAY. STAIRS. THERE'S ALWAYS STAIRS. COME ON, DONUT. BEA WILL KILL ME IF I LOSE YOU AT THE END OF THE WORLD."),
        donut("MRRRP."),
        nar("THE CAT CLIMBS ONTO HIS SHOULDER LIKE SHE HAS ALWAYS OWNED IT. AHEAD, AN ORNATE WROUGHT-IRON STAIRWELL GLOWS THROUGH THE SNOW.")] },
      { bg: 'stairwell', actors: [A('carl_idle', 140), A('donut_idle', 162)], lines: [
        nar("DOWN. AND DOWN. AND DOWN. THE STAIRS END AT A PAIR OF ENORMOUS DOUBLE DOORS, ALREADY SCRATCHED BY A LOT OF NERVOUS HANDS."),
        ai("WELCOME, CRAWLER! BEFORE YOU ENTER, PLEASE STATE YOUR NAME FOR THE RECORD. WE WILL BE IGNORING IT.")] }
    ] },

    f1_entrance: { music: 'intro', panels: [
      { bg: 'stairwell', fx: 'flash', actors: CD, lines: [
        ai("DING DING DING! CRAWLER, YOU HAVE ENTERED THE WORLD DUNGEON! AND WOULD YOU LOOK AT THAT. ACHIEVEMENTS. SO MANY ACHIEVEMENTS."),
        ai("CRAZY CAT LADY! YOU BROUGHT A CAT INTO THE DUNGEON. SHE IS YOUR PET NOW. NO TAKEBACKS. HAVE A PET BOX!")] },
      { bg: 'stairwell', actors: CD, lines: [
        ai("WHY AREN'T YOU WEARING PANTS? SERIOUSLY. WE HAVE QUESTIONS. HERE IS A GOLD APPAREL BOX. IT IS NOT PANTS. IT IS NEVER PANTS."),
        ai("UNARMED COMBAT! NO WEAPON. BOLD. EMPTY POCKETS! NO SUPPLIES. BOLDER. EARLY ADOPTER! ONE OF THE FIRST FIVE THOUSAND THROUGH THE DOORS!")] },
      { bg: 'stairwell', actors: CD, lines: [
        carl("DONUT? YOU OKAY? YOU'RE MAKING A FACE."),
        nar("DONUT GLARES AT THE GLOWING ACHIEVEMENT TEXT HANGING IN THE AIR. THEN AT CARL. THEN SHE HISSES AT BOTH OF THEM."),
        donut("HSSSSSSSS."),
        carl("YEAH. ME TOO.")] },
      { bg: 'tunnels', actors: CD, lines: [
        ai("YOUR BOXES OPEN IN A GUILD HALL. GUILD HALLS ONLY ADMIT CRAWLERS WHO HAVE KILLED A MOB. SO GO KILL SOMETHING! THE RATS ARE RIGHT THERE!"),
        nar("A RAT THE SIZE OF A LOAF OF BREAD SQUEAKS AT THEM FROM THE DARK. DONUT'S TAIL GOES FULL BOTTLE BRUSH."),
        carl("STAY BEHIND ME. AND DON'T EAT ANYTHING DOWN HERE.")] }
    ],
      give: [{ kind: 'achieve', id: 'crazy_cat_lady' }, { kind: 'achieve', id: 'why_no_pants' }, { kind: 'achieve', id: 'unarmed_combat' },
        { kind: 'achieve', id: 'early_adopter' }, { kind: 'achieve', id: 'empty_pockets' }] },

    // Donut cannot talk until she eats the Enhanced Pet Biscuit from her pet box, here in the guild.
    f1_mordecai: { music: 'safe', panels: [
      { bg: 'safe_guild', fx: 'shake', actors: [A('carl_idle', 110), A('donut_idle', 132), A('mordecai_f1_idle', 214, true)], lines: [
        nar("THE GUILD DOOR SLAMS. OUTSIDE, THE MURDER DOZER GRINDS TO A STOP AND JUST... IDLES. WAITING. THE GOBLINS ON TOP ARE SINGING."),
        mord1("IN. SIT. TOUCH NOTHING. I'M MORDECAI. I RUN THIS TUTORIAL GUILD, AND YOU TWO ARE ALREADY THE WORST CRAWLERS I'VE HAD TODAY.")] },
      { bg: 'safe_guild', actors: [A('carl_idle', 110), A('donut_idle', 168), A('mordecai_f1_idle', 214, true)], lines: [
        nar("DONUT LEAPS OFF CARL'S SHOULDER, KNOCKS A BRASS URN OFF THE SHELF, AND STARTS DIGGING IN WHAT SPILLS OUT LIKE IT'S A FRESH LITTER BOX."),
        mord1("...THAT'S MY MOTHER."),
        carl("OH GOD. DONUT, NO. I'M SO SORRY. SHE'S A CAT. SHE DOESN'T KNOW WHAT AN URN IS.")] },
      { bg: 'safe_guild', actors: [A('carl_idle', 110), A('donut_idle', 132), A('mordecai_f1_idle', 214, true)], lines: [
        mord1("TUTORIAL. YOUR HUD IS ON NOW. HEALTH, LEVEL, INVENTORY. EVERYTHING YOU PICK UP GOES INTO A POCKET THAT ISN'T THERE. DON'T THINK ABOUT IT."),
        mord1("THIS FLOOR ISN'T LIVE. NOBODY'S WATCHING YET. ENJOY IT. ONCE THEY ARE, EVERY STUPID THING YOU DO IS FOR THEM."),
        mord1("NOW OPEN YOUR BOXES. THE PET BOX IS FOR HER. GOD HELP US ALL.")] },
      { bg: 'safe_guild', fx: 'flash', actors: [A('carl_idle', 110), A('donut_idle', 132), A('mordecai_f1_idle', 214, true)], lines: [
        nar("INSIDE THE BRONZE PET BOX: ONE ENHANCED PET BISCUIT. DONUT EATS IT BEFORE ANYONE CAN READ THE LABEL."),
        nar("HER EYES GO WIDE. HER EARS GO FLAT. SHE OPENS HER MOUTH."),
        donut("...CARL."),
        carl("DID THE CAT JUST SAY MY NAME?"),
        donut("CARL. CARL! I CAN TALK! OH MY GOD, CARL, I CAN TALK! I HAVE SO MANY THINGS TO SAY ABOUT YOUR APARTMENT.")] },
      { bg: 'safe_guild', actors: [A('carl_idle', 110), A('donut_idle', 132), A('mordecai_f1_idle', 214, true)], lines: [
        smug("AND YOU. MISTER RAT IN A VEST. I'M SORRY ABOUT YOUR MOTHER. SHE WAS VERY ABSORBENT."),
        mord1("...I LIKED YOU BETTER WHEN YOU COULDN'T TALK."),
        mord1("SMART PETS GET A SPELL. MAGIC MISSILE. POINT, CAST, SOMETHING DIES. DON'T CAST IT INDOORS. DON'T CAST IT AT ME.")] },
      { bg: 'safe_guild', fx: 'flash', actors: [A('carl_idle', 110), A('donut_idle', 132), A('mordecai_f1_idle', 214, true)], lines: [
        donut("OH, CARL. CARL! I CAN SHOOT THINGS NOW. MISS BEATRICE NEVER ONCE LET ME SHOOT THINGS."),
        ai("PRINCESS DONUT HAS LEARNED MAGIC MISSILE! YOUR PET IS NOW A RANGED WEAPON. PLEASE POINT HER RESPONSIBLY. OR DON'T. WE'RE NOT YOUR MOM.")] },
      { bg: 'safe_guild', actors: [A('carl_idle', 110), A('donut_idle', 132), A('mordecai_f1_idle', 214, true)], lines: [
        carl("SO. ABOUT THE STEAM TANK FULL OF GOBLINS PARKED OUTSIDE YOUR FRONT DOOR."),
        mord1("IT'S NOT GOING ANYWHERE AND NEITHER ARE YOU. YOU KILLED A RAT TO GET IN HERE. NOW GO KILL A TANK. EVERYTHING HAS A WEAK SPOT, KID. FIND IT.")] }
    ],
      give: [{ kind: 'flag', id: 'talks', quiet: true }, { kind: 'flag', id: 'missile' }, { kind: 'xp', amount: 10 }] },

    f1_episode1: { music: 'tension', panels: [
      { bg: 'tvroom', fx: 'static', actors: [], lines: [
        nar("THE SAFE ROOM TV FLICKERS ON BY ITSELF. A JINGLE. A LOGO. DUNGEON CRAWLER WORLD: EARTH. EPISODE ONE."),
        ai("PREVIOUSLY, ON EARTH: EVERYTHING WAS FINE! NOW, ON EARTH: BILLIONS DEAD IN THE FIRST HOUR! WHAT A PREMIERE, FOLKS!")] },
      { bg: 'tvroom', actors: [], lines: [
        ai("THIS WEEK'S HIGHLIGHTS: A MAN WHO PUNCHED A LLAMA TO DEATH, A LITTLE GIRL WITH TWO VERY LARGE DOGS WHO FRANKLY SCARES THE PRODUCERS..."),
        ai("...AND A LOT OF VERY BRAVE CORPSES. HONORABLE MENTION: THE GUY WHO TRIED TO PET A ROT STICKER. WE MISS YOU, GARY."),
        carl("WAS THAT ME? THE LLAMA GUY IS ME, RIGHT?"),
        smug("THEY DIDN'T SHOW MY GOOD SIDE, CARL. I HAVE TWO GOOD SIDES. THEY SHOWED NEITHER.")] },
      { bg: 'tvroom', fx: 'static', actors: [], lines: [
        ai("AND NOW, PATCH NOTES! ONE: HALLWAY BATHROOM DOORS NO LONGER EXPLODE THE CRAWLER INSIDE. WE HEARD YOU. WE THOUGHT IT WAS FUNNY. IT WAS."),
        ai("TWO: EVERY CRAWLER NOW RECEIVES ONE ROLL OF TOILET PAPER PER FLOOR. ONE. THIS IS THE MOST GENEROUS WE WILL EVER BE.")] },
      { bg: 'hoard', actors: CD, lines: [
        carl("THIRTEEN MILLION PEOPLE CAME DOWN THOSE STAIRS AND THEY'RE DOING BITS ABOUT TOILET PAPER."),
        donut("FOCUS, CARL. WHEN THE CAMERAS GO LIVE I WILL NEED BETTER LIGHTING. AND A BOW. DO YOU HAVE A BOW?"),
        carl("I HAVE BOXERS, DONUT. I HAVE BOXERS AND A JACKET. NEXT STOP IS GOBLIN TOWN. TRY NOT TO INSULT ANYONE'S MOTHER.")] }
    ] },

    f1_chopper: { music: 'goblin', panels: [
      { bg: 'goblin', actors: [A('carl_idle', 104), A('donut_idle', 126), A('rory_idle', 214, true), A('lorelai_idle', 242, true)], lines: [
        say('RORY', 'p_rory', "THE HAIRLESS APE AGAIN. AND THE CAT. WHAT DO YOU WANT, MEAT? THAT TATTOO GETS YOU IN THE DOOR. IT DOESN'T GET YOU LIKED."),
        donut("LADIES. LADIES! WHAT GORGEOUS BONE JEWELRY. IS THAT A FEMUR? IT'S A FEMUR. YOU HAVE WONDERFUL TASTE IN FEMURS."),
        say('LORELAI', 'p_lorelai', "RORY. RORY, SHE LIKES MY FEMUR.")] },
      { bg: 'goblin', actors: [A('carl_idle', 104), A('donut_idle', 126), A('rory_idle', 214, true), A('lorelai_idle', 242, true)], lines: [
        carl("I HEAR YOU'RE AT WAR WITH THE LLAMAS. I HEAR THE LLAMAS HAVE SOMETHING YOU WANT. FUNNY THING. SO DO I."),
        nar("CARL HOLDS UP THE BAGGIE OF TRAILER-PARK-GRADE METH. EVERY GOBLIN IN THE ROOM STOPS BREATHING."),
        say('RORY', 'p_rory', "...NAME YOUR PRICE.")] },
      { bg: 'goblin', actors: [A('carl_idle', 104), A('donut_idle', 126), A('rory_idle', 214, true), A('lorelai_idle', 242, true)], lines: [
        carl("A RIDE. SOMETHING WITH WHEELS. FAST. WITH A SIDECAR."),
        smug("A SIDECAR FIT FOR A PRINCESS. WITH A CUSHION. A SKULL IS ACCEPTABLE, AS LONG AS IT'S A NICE SKULL. FROM A RESPECTABLE ORC.")] },
      { bg: 'goblin', fx: 'shake', actors: [A('chopper', 160), A('lorelai_idle', 250, true)], lines: [
        nar("SIX HOURS OF HAMMERING LATER, THE GOBLINS ROLL OUT A MONSTER: COPPER SCRAP, A STEAM ENGINE THAT THUMPS LIKE A HEART, AN ALLIGATOR-SKULL SEAT."),
        ai("THE GOBLIN COPPER CHOPPER! A MOTOR VEHICLE! ON THE FIRST FLOOR! THE PRODUCERS ARE CHECKING THE RULES. THE RULES SAY... SURE. FINE. WHATEVER."),
        say('LORELAI', 'p_lorelai', "WE'RE GOING TO GO FIGHT THE LLAMAS NOW. VERY HIGH. BYE, PRINCESS! BYE, HAIRLESS!")] },
      { bg: 'goblin', actors: CD, lines: [
        carl("DONUT. MOST OF THE TRIBE JUST LEFT FOR THE LLAMA WAR. THE WORKSHOP IS GUARDED BY ONE CHIEFTAIN AND A FEW BARDS. IT'S FULL OF COPPER. AND DYNAMITE."),
        donut("CARL, ARE YOU SUGGESTING WE STEAL?"),
        carl("I'M SUGGESTING WE TAKE EVERYTHING THAT ISN'T NAILED DOWN.")] }
    ],
      give: [{ kind: 'flag', id: 'chopper' }] },

    f1_frank: { music: 'tension', panels: [
      { bg: 'safe_cookie', actors: [A('carl_idle', 104), A('donut_idle', 126), A('frank_q_idle', 222, true)], lines: [
        nar("THE COOKIE ROOM HAS A GUEST. AN OLD MAN WITH A WHITE BEARD, A FILTHY COAT AND EYES LIKE A ROAD MAP. HE SMILES A LITTLE TOO MUCH."),
        say('FRANK Q', 'p_frank_q', "WELL, HOWDY. NAME'S FRANK. NICE CAT. NICE BIKE OUT FRONT, TOO. LOT OF THINGS GOING YOUR WAY, SON."),
        carl("CARL. WE'RE JUST PASSING THROUGH.")] },
      { bg: 'tvroom', fx: 'static', actors: [], lines: [
        ai("RECAP NUMBER TWO! MEET HEKLA: A SIX-FOOT ICELANDIC WARRIOR BUILDING A WAR PARTY OF WOMEN WHO KILL THINGS. NOW RECRUITING!"),
        donut("SHE HAS VERY GOOD HAIR, CARL. AGGRESSIVELY GOOD HAIR. I DON'T TRUST IT.")] },
      { bg: 'tunnels', actors: [A('carl_idle', 104), A('donut_idle', 126), A('frank_q_idle', 214, true), A('maggie_my_idle', 244, true)], lines: [
        nar("OUTSIDE, FRANK IS WAITING. SO IS A WILD-HAIRED WOMAN WITH A LOADED CROSSBOW. MAGGIE MY. SHE IS NOT SMILING AT ALL."),
        say('MAGGIE MY', 'p_maggie_my', "THE BIKE. THE BOXES. THE CAT. LEAVE IT ALL ON THE FLOOR AND WALK AWAY."),
        donut("LEAVE THE CAT? EXCUSE ME? DO YOU HAVE ANY IDEA WHO I AM?")] },
      { bg: 'tunnels', actors: [A('carl_idle', 120), A('rat_walk', 150)], lines: [
        nar("CARL DOESN'T ARGUE. HE KNEELS BY A DEAD RAT, SLIPS SOMETHING INTO ITS INVENTORY, AND CLIMBS ONTO THE CHOPPER."),
        carl("ALL YOURS, FRANK. THAT RAT HAD SOME GOOD LOOT ON IT, BY THE WAY. CHECK IT OUT."),
        nar("THEY ARE HALF A MILE DOWN THE HALL WHEN THE RAT GOES BOOM. GOBLIN DYNAMITE KEEPS BEAUTIFULLY IN A CORPSE. SOMEONE SCREAMS. LOUDLY. NOT FATALLY.")] },
      { bg: 'tunnels', actors: [A('chopper', 160)], lines: [
        donut("CARL! DID YOU JUST BOOBY-TRAP A RAT?"),
        carl("THEY STARTED IT."),
        ai("THE NPC INVENTORY SYSTEM IS WORKING AS INTENDED. WE ARE TAKING NOTES, CRAWLER. WE ARE TAKING SO MANY NOTES.")] }
    ] },

    f1_meadowlark: { music: 'safe', panels: [
      { bg: 'tunnels', actors: [A('carl_idle', 96), A('donut_idle', 118), A('brandon_idle', 212, true), A('chris_idle', 240, true)], lines: [
        nar("A HUNDRED MILES EAST, THE SPRAY PAINT LEADS TO A BARRICADE. TWO BIG MEN WITH SHOTGUNS STEP OUT. BROTHERS, BY THE LOOK OF THEM."),
        say('BRANDON', 'p_brandon', "THAT'S CLOSE ENOUGH. NICE BIKE. YOU HUMAN UNDER THAT JACKET?"),
        carl("MOSTLY. I'M CARL. THIS IS DONUT. SHE'S A PRINCESS. DON'T ARGUE WITH HER ABOUT IT, YOU'LL LOSE."),
        say('CHRIS', 'p_chris', "BRANDON. IT'S A GUY IN HIS UNDERWEAR WITH A CAT. LET HIM IN.")] },
      { bg: 'tunnels', actors: [A('carl_idle', 96), A('donut_idle', 118), A('imani_idle', 206, true), A('yolanda_idle', 236, true)], lines: [
        say('IMANI', 'p_imani', "I'M IMANI. I WAS A NURSE AT THE MEADOW LARK ADULT CARE COMMUNITY. NOW I'M WHATEVER THIRTY-EIGHT OLD FOLKS IN A DUNGEON NEED ME TO BE."),
        say('YOLANDA', 'p_yolanda', "YOLANDA. I DO THE SHOOTING THE BOYS DON'T. YOU LOOK HALF STARVED, BABY. SIT DOWN AND EAT SOMETHING.")] },
      { bg: 'tunnels', actors: [A('carl_idle', 96), A('donut_idle', 118), A('agatha_idle', 250, true)], lines: [
        nar("IN THE CORNER, A TINY OLD WOMAN WITH A SHOPPING CART HUMS TO HERSELF AND SPRAY-PAINTS A SILVER SMILEY FACE ON THE WALL."),
        say('AGATHA', 'p_agatha', "AGATHA SEES YOU. AGATHA SEES THE CAT. THE CAT IS IMPORTANT. HEE HEE HEE."),
        donut("CARL, THAT WOMAN IS EITHER A WITCH OR A GENIUS, AND I CANNOT TELL WHICH. I LIKE HER.")] },
      { bg: 'tunnels', actors: [A('carl_idle', 96), A('donut_idle', 118), A('imani_idle', 206, true), A('brandon_idle', 236, true)], lines: [
        say('IMANI', 'p_imani', "THERE'S A BOROUGH BOSS UP THE ROAD, SITTING ON A STAIRWELL. MY PEOPLE CAN'T WALK FAR. THEY CAN WALK THAT FAR."),
        carl("THEN WE KILL IT. BUT I NEED TO GET STRONGER FIRST. THERE'S A TROGLODYTE NEIGHBORHOOD AND SOME KIND OF GYM BETWEEN HERE AND THERE."),
        say('BRANDON', 'p_brandon', "WE'LL HOLD THE ROAD. YOU GO DO THE CRAZY STUFF. YOU SEEM GOOD AT THE CRAZY STUFF.")] }
    ] },

    f1_swine_plan: { music: 'tension', panels: [
      { bg: 'swine', fx: 'shake', actors: [A('carl_idle', 104), A('donut_idle', 126), A('brandon_idle', 232, true)], lines: [
        nar("THE BOSS CHAMBER IS A HUGE ROUND TRACK BEHIND SEALED PORTCULLISES. SOMETHING ENORMOUS ROLLS PAST THE BARS. IT SQUEALS. IT HAS A LOT OF FACES."),
        ai("BOROUGH BOSS! THE BALL OF SWINE: A HUNDRED TUSKLING ARISTOCRATS FUSED BY A CURSE, ROLLING IN CIRCLES FOR CENTURIES. SO. ROYALTY.")] },
      { bg: 'swine', actors: [A('carl_idle', 104), A('donut_idle', 126), A('chris_idle', 232, true)], lines: [
        donut("CARL. THEY'RE PIGS. ROYAL PIGS. IN A BALL. I DON'T KNOW WHETHER TO BE OFFENDED OR FLATTERED."),
        carl("IT CAN'T CLIMB. IT ROLLS. SO WE BUILD UP: LEDGES, LADDERS, A REDOUBT. WE STAND ON TOP AND FIGURE OUT THE REST WHEN IT SHOWS UP."),
        say('CHRIS', 'p_chris', "AND THE STAIRWELL?"),
        carl("DEAD CENTER, BEHIND A RED FORCEFIELD. THE FIELD DROPS WHEN THE BALL DIES.")] },
      { bg: 'tvroom', fx: 'static', actors: [], lines: [
        ai("ON THIS WEEK'S RECAP: LE MOUVEMENT! A FRENCH CRAWLER FACTION THAT WANTS TO RUN THE DUNGEON LIKE A NATION. WITH A FLAG. AWW. SO CUTE."),
        carl("LE WHAT?"),
        donut("THEY HAVE A FLAG, CARL. WHY DON'T WE HAVE A FLAG? I WANT A FLAG WITH MY FACE ON IT. IN PROFILE.")] },
      { bg: 'swine', actors: [A('carl_idle', 96), A('imani_idle', 168, true), A('yolanda_idle', 196, true), A('agatha_idle', 240, true)], lines: [
        say('IMANI', 'p_imani', "EVERYONE KNOWS THEIR SPOT. BROTHERS LEFT, YOLANDA RIGHT, ME UP TOP. AGATHA... AGATHA, WHERE ARE YOU GOING?"),
        say('AGATHA', 'p_agatha', "AGATHA BROUGHT A POTION. IT BUBBLES. HEE HEE HEE."),
        carl("OKAY. EVERYBODY UP ON THE REDOUBT. LET'S GO MAKE BACON.")] }
    ],
      give: [{ kind: 'achieve', id: 'borough_boss' }] },

    f1_odette: { music: 'odette', panels: [
      { bg: 'stairwell', fx: 'flash', actors: CD, lines: [
        nar("THE BALL OF SWINE IS DEAD. THE FORCEFIELD DROPS. MEADOW LARK CHEERS. CARL AND DONUT TAKE THE STAIRS DOWN, AND HALFWAY, THE WORLD BLINKS."),
        ai("CONGRATULATIONS! YOU HAVE BEEN REQUESTED FOR AN INTERVIEW! TRANSPORTING NOW. PLEASE KEEP YOUR LIMBS INSIDE YOUR BODY.")] },
      { bg: 'trailer', actors: [A('carl_idle', 104), A('donut_idle', 126), A('lexis_idle', 214, true)], lines: [
        say('LEXIS', 'p_lexis', "HI. LEXIS. ASSOCIATE PRODUCER. YOU'RE ON IN FOUR MINUTES. DON'T TOUCH ANYTHING. DON'T STEAL ANYTHING. I SAW YOU LOOKING AT THE CHAIRS."),
        carl("WE'RE ON TV? WHO WATCHES THIS?"),
        say('LEXIS', 'p_lexis', "EVERYONE. DUNGEON CRAWLER AFTER HOURS IS THE BIGGEST PRIVATE SHOW IN THE GALAXY. THE HOST USED TO BE A CRAWLER. SHE SURVIVED. THINK ABOUT THAT.")] },
      { bg: 'studio', fx: 'confetti', actors: [A('carl_idle', 104), A('donut_idle', 128), A('odette_idle', 214, true)], lines: [
        say('ODETTE', 'p_odette', "DARLINGS! WELCOME! THE BOY WITH NO PANTS AND HIS PRINCESS! THE AUDIENCE IS DYING TO MEET YOU. SOME OF THEM LITERALLY."),
        smug("THANK YOU. THANK YOU. YES, I AM A CHAMPION. YES, THE CROWN IS REAL. NO, YOU MAY NOT TOUCH IT."),
        nar("THE CROWD ROARS. DONUT HAS THEM EATING OUT OF HER PAWS IN NINETY SECONDS. CARL SITS ON THE COUCH AND TRIES TO LOOK LIKE FURNITURE.")] },
      { bg: 'studio', actors: [A('carl_idle', 104), A('donut_idle', 128), A('odette_idle', 214, true)], lines: [
        say('ODETTE', 'p_odette', "OFF THE AIR NOW. LISTEN. ON THE THIRD FLOOR YOU PICK A RACE AND A CLASS. DON'T RUSH IT. DON'T PICK WHAT THE MENU WANTS YOU TO PICK."),
        say('ODETTE', 'p_odette', "AND THE LOOT? NOT AS RANDOM AS THEY SAY. THE AI HANDS OUT WHATEVER MAKES GOOD TELEVISION. REMEMBER THAT WHEN SOMETHING TOO GOOD FALLS IN YOUR LAP."),
        carl("WHY ARE YOU HELPING US?"),
        say('ODETTE', 'p_odette', "BECAUSE THE LONGER YOU LIVE, THE MORE MONEY I MAKE, SWEETIE. NEVER TRUST ANYONE UNTIL YOU KNOW WHAT THEY GET OUT OF IT.")] }
    ] },

    f2_welcome: { music: 'intro', panels: [
      { bg: 'cinder', fx: 'static', actors: [A('carl_idle', 118), A('donut_idle', 140), A('ai_screen', 236)], lines: [
        ai("WELCOME TO THE SECOND FLOOR, BITCHES! SIX DAYS UNTIL COLLAPSE, THE LEGAL MINIMUM. WE ARE NOTHING IF NOT LEGAL."),
        ai("BIG NEWS: THE CAMERAS ARE LIVE! VIEWERS CAN FOLLOW AND FAVORITE YOU, SPONSORS CAN SEND GIFTS. MAKE THEM LOVE YOU. OR AT LEAST DON'T BORE THEM.")] },
      { bg: 'cinder', actors: [A('carl_idle', 118), A('donut_idle', 140), A('ai_screen', 236)], lines: [
        ai("ALSO! THE HALLWAY BATHROOMS ARE GONE. IF YOU PEE IN A HALLWAY, A LEVEL 93 RAGE ELEMENTAL SPAWNS. THIS IS NOT A JOKE. WE TAKE HYGIENE VERY SERIOUSLY."),
        carl("LEVEL NINETY-THREE. WE'RE LEVEL... WHAT ARE WE?"),
        smug("I'M A PRINCESS, CARL. THAT'S THE ONLY LEVEL THAT MATTERS.")] },
      { bg: 'cinder', actors: [A('carl_idle', 118), A('donut_idle', 140)], lines: [
        donut("CARL! CARL, I HAVE FOLLOWERS! LOOK, THE NUMBER IS GOING UP! I MUST LOOK MY ABSOLUTE BEST AT ALL TIMES. FIX YOUR JACKET."),
        carl("IT'S THE ONLY THING I'M WEARING, DONUT. IT'S AS FIXED AS IT GETS."),
        ai("PATRONAGE IS OPEN TOO! GODS AND CORPORATIONS MAY SPONSOR CRAWLERS THEY LIKE. TIP: BE LIKABLE. OR BE ON FIRE. FIRE TESTS VERY WELL.")] }
    ] },

    f2_jug: { music: 'goblin', panels: [
      { bg: 'distillery', actors: CD, lines: [
        nar("A CLURICHAUN STILL. A CRATE OF EMPTY CLAY JUGS. A BARREL OF GOBLIN OIL FROM THE WORKSHOP. CARL HAS BEEN STARING AT THEM FOR TEN MINUTES."),
        donut("CARL, YOU HAVE YOUR THINKING FACE ON. I DON'T LIKE YOUR THINKING FACE. THE LAST TIME IT BLEW UP A NURSERY."),
        carl("AND THE TIME BEFORE THAT, YOU BURNED DOWN A WORKSHOP. WE'RE EVEN.")] },
      { bg: 'distillery', actors: CD, lines: [
        carl("MOONSHINE. GOBLIN OIL. SHAKE IT UP. A LIT TORCH FOR A CORK. THROW IT, THE JUG BREAKS, EVERYTHING NEARBY HAS A VERY BAD DAY."),
        nar("THE FIRST ONE TAKES OUT A WALL. THE SECOND TAKES OUT THREE CLURICHAUNS AND THE WALL BEHIND THE WALL.")] },
      { bg: 'distillery', fx: 'flash', actors: [A('carl_idle', 118), A('donut_idle', 140), A('jug', 170)], lines: [
        ai("ACHIEVEMENT! DUNGEONPRENEUR! YOU INVENTED A STACKABLE WEAPON! CARL'S JUG O'BOOM IS NOW IN THE OFFICIAL CATALOG. ROYALTIES ARE... BEING DISCUSSED."),
        donut("CARL'S JUG O'BOOM? WHY DOES IT HAVE YOUR NAME ON IT? I WAS IN THE ROOM."),
        carl("YOU CAN NAME THE NEXT ONE.")] },
      { bg: 'distillery', fx: 'fire', actors: CD, lines: [
        nar("FROM NOW ON, CARL'S BOMBS ARE JUG O'BOOMS: A BIGGER BLAST, PLUS A PUDDLE OF BLUE FIRE THAT LINGERS AND COOKS ANYTHING DUMB ENOUGH TO STAND IN IT."),
        carl("AND I STILL HAVE THE TAINT, SO NOTHING HEALS ME FOR A WHILE. NEW RULE: NOBODY GETS HIT. ESPECIALLY ME.")] }
    ],
      give: [{ kind: 'flag', id: 'jugs' }, { kind: 'item', id: 'bomb', count: 4 }] },

    f2_jack: { music: 'sad', panels: [
      { bg: 'cinder', actors: [A('carl_idle', 96), A('donut_idle', 118), A('elle_idle', 196, true), A('brandon_idle', 240, true)], lines: [
        nar("THE MEADOW LARK CARAVAN CREEPS TOWARD THE STAIRS: THIRTY-SOME RESIDENTS, TWO BROTHERS WITH SHOTGUNS, A NURSE, YOLANDA, AND A LOT OF WALKERS."),
        say('ELLE', 'p_elle', "CARL, HONEY, WHEN WE GET OUT OF HERE, YOU AND I ARE GOING DANCING. I'LL LEAD. YOU'LL CRY. IT'LL BE BEAUTIFUL."),
        carl("IT'S A DATE, ELLE."),
        smug("HE IS SPOKEN FOR, MADAM. HE BELONGS TO ME.")] },
      { bg: 'cinder', actors: [A('jack_idle', 200), A('yolanda_idle', 120)], lines: [
        nar("AND THEN JACK, WHO HAS NEVER ONCE IN HIS LONG LIFE DONE WHAT HE WAS TOLD, SHUFFLES OVER TO THE HALLWAY WALL, UNZIPS, AND PISSES ON IT."),
        say('YOLANDA', 'p_yolanda', "JACK! JACK, NO!"),
        ai("OH, JACK. OH, BUDDY.")] },
      { bg: 'cinder', fx: 'shake', actors: [A('yolanda_idle', 120), A('rage_elemental_idle', 236, true)], lines: [
        nar("THE AIR TEARS OPEN. A STORM OF BLACK AND PURPLE SMOKE. A BADGER SKULL WITH GOAT HORNS AND FIRE FOR EYES. SIX OBSIDIAN CLAWS."),
        ai("SOMEBODY PEED IN THE HALLWAY! YOU WERE ALL WARNED! THIS IS SO EXCITING! PLEASE WELCOME A LEVEL 93 RAGE ELEMENTAL!")] },
      { bg: 'cinder', fx: 'flash', actors: [A('rage_elemental_idle', 236, true)], lines: [
        nar("YOLANDA STEPS BETWEEN THE CLAWS AND A RESIDENT NAMED RANDALL. SHE BUYS HIM FOUR SECONDS. IT COSTS HER EVERYTHING."),
        say('IMANI', 'p_imani', "INSIDE! EVERYONE INTO THE SAFE ROOM! GO, GO, GO!"),
        nar("THEN THE ELEMENTAL CASTS REVERSE GRAVITY, AND THE WHOLE HALLWAY FALLS UP. CARL GRABS ELLE'S CHAIR BY ONE WHEEL AND DOES NOT LET GO.")] },
      { bg: 'safe_shelter', actors: [A('carl_idle', 110), A('donut_idle', 132), A('imani_idle', 220, true)], lines: [
        donut("CARL. YOLANDA SAVED ME THE GOOD CUSHION LAST NIGHT. SHE WAS NICE TO ME, CARL. PEOPLE AREN'T ALWAYS NICE TO ME."),
        carl("I KNOW, DONUT. I KNOW."),
        carl("IT CAN'T COME IN HERE. BUT MOBS CAN'T GO ON THE STAIRS EITHER. SO WE LEAD IT TO THE STAIRWELL. WITH THE CHOPPER, AND EVERY JUG I'VE GOT.")] },
      { bg: 'safe_shelter', actors: [A('carl_idle', 110), A('donut_idle', 132), A('imani_idle', 220, true)], lines: [
        say('IMANI', 'p_imani', "THAT'S INSANE, CARL."),
        carlMad("IT'S A LEVEL NINETY-THREE MONSTER AND I'M IN MY UNDERWEAR. EVERYTHING ABOUT THIS IS INSANE. DONUT, GET IN THE SIDECAR."),
        smug("FINALLY. A PLAN WITH A VEHICLE.")] }
    ] },

    f2_deathwatch: { music: 'tension', panels: [
      { bg: 'deathwatch', fx: 'flash', actors: [A('carl_idle', 100), A('donut_idle', 122), A('maestro_idle', 220, true)], lines: [
        nar("A FLASH, AND CARL AND DONUT ARE SITTING AT A ROUND TABLE UNDER A RING OF HOT LIGHTS. THE SHOW IS CALLED DEATH WATCH EXTREME DUNGEON MAYHEM."),
        say('MAESTRO', 'p_maestro', "GLURP, GLURP! WELCOME, MEAT! I AM THE MAESTRO. ON THIS SHOW WE WATCH CRAWLERS DIE LIVE AND WE BET ON THE ORDER. TRY TO STAY A GUEST.")] },
      { bg: 'deathwatch', actors: [A('carl_idle', 100), A('donut_idle', 122), A('maestro_idle', 220, true)], lines: [
        nar("ON THE BIG SCREEN, TWO CRAWLERS, LI JUN AND ZHANG, ARE CORNERED BY BRINDLED VESPAS. THE MAESTRO LAUGHS. THE CROWD STARTS TAKING BETS."),
        say('MAESTRO', 'p_maestro', "TEN TO ONE THE SKINNY ONE GOES FIRST! ANY TAKERS?"),
        carlMad("GET THEM OUT. I'M THE GUY EVERYONE TUNED IN FOR. KILL THEM ON MY EPISODE AND I DON'T SAY ANOTHER WORD ALL NIGHT.")] },
      { bg: 'deathwatch', actors: [A('carl_idle', 100), A('donut_idle', 122), A('maestro_idle', 220, true)], lines: [
        nar("IT'S A BLUFF. IT WORKS. THE PRODUCERS CAN'T AFFORD A SILENT CARL. A DOOR OPENS ON THE SCREEN, AND LI JUN AND ZHANG RUN THROUGH IT."),
        donut("CARL, THAT WAS EITHER VERY BRAVE OR VERY STUPID."),
        carl("YES.")] },
      { bg: 'deathwatch', fx: 'static', actors: [A('maestro_idle', 220, true)], lines: [
        nar("LATER IN THE SHOW: FRANK Q AND MAGGIE MY, ALIVE, SCORCHED, AND STILL VERY ANGRY ABOUT A CERTAIN RAT. MAGGIE STARES INTO THE CAMERA LIKE SHE SEES CARL."),
        say('MAESTRO', 'p_maestro', "AND THE NEWS! LE MOUVEMENT IS WIPED OUT TO THE LAST CRAWLER! THE COUNT IS UNDER ONE MILLION! WHAT A WEEK! GLURP!")] },
      { bg: 'safe_bugaboo', actors: [A('carl_idle', 104), A('donut_idle', 126), A('zev_idle', 222, true)], lines: [
        say('ZEV', 'p_zev', "CARL! DONUT! DARLINGS! NEWS FROM UPSTAIRS. THERE'S A SNICK CALLED PORK BOY GOING AROUND, AND EVERYONE WANTS YOUR OPINION ON IT."),
        donut("WHO IS PORK BOY, AND WHY DOES HE HAVE MY RATINGS?"),
        say('ZEV', 'p_zev', "SAY NOTHING. SMILE. THE KOBOLD BOSS IS NEXT AND THE AUDIENCE WANTS SOMETHING CUTE. I'M SURE IT'LL BE FINE.")] }
    ] },

    f2_menagerie: { music: 'safe', panels: [
      { bg: 'reward_room', fx: 'confetti', actors: CD, lines: [
        ai("ACHIEVEMENT! I'LL TAKE THE CERAMIC DALMATIAN, PAT! YOU FOUND A REWARD ROOM! PICK ONE PRIZE. ONE. WE CAN SEE YOU EYEING THE OTHERS."),
        ai("ACHIEVEMENT! MENAGERIE! IT'S A PET REWARD ROOM! TEN CAGES. TEN BABIES. TEN NEW WAYS TO GET BITTEN.")] },
      { bg: 'reward_room', actors: CD, lines: [
        donut("CARL. CARL! LOOK AT THEM ALL! A KITTEN WITH WINGS! A LITTLE BEAR! A... WHAT IS THAT? IT'S HIDEOUS. I LOVE IT."),
        nar("IN THE LAST CAGE: A BABY DINOSAUR. ALL LEGS AND TEETH, SCREAMING AT EVERYTHING. THE LITTLE PLATE SAYS MONGOLIENSIS.")] },
      { bg: 'reward_room', actors: [A('carl_idle', 104), A('donut_idle', 126), A('mongo_idle', 190)], lines: [
        smug("THAT ONE. HE'S ANGRY AND BEAUTIFUL, LIKE ME. HIS NAME IS MONGO. MONGO IS NOW A MEMBER OF THE ROYAL COURT."),
        carl("DONUT, HE'S TRYING TO EAT THE BARS."),
        donut("HE'S TEETHING, CARL.")] },
      { bg: 'reward_room', fx: 'shake', actors: [A('carl_idle', 104), A('donut_idle', 150), A('mongo_idle', 168, true)], lines: [
        nar("THE CAGE OPENS. MONGO SNIFFS DONUT. MONGO CHOMPS DONUT'S NOSE."),
        donut("OW! OW! CARL! HE BIT MY NOSE! MY BEAUTIFUL NOSE!"),
        carl("YOU PICKED HIM."),
        ai("MONGO HAS JOINED THE ROYAL COURT OF PRINCESS DONUT! HE IS NOT BONDED YET. HE WILL BITE YOU. HE WILL BITE EVERYTHING. HE IS PERFECT.")] }
    ],
      give: [{ kind: 'achieve', id: 'ceramic_dalmatian' }, { kind: 'achieve', id: 'menagerie' }] },

    f2_descent: { music: 'odette', panels: [
      { bg: 'stairwell', actors: [A('carl_idle', 110), A('donut_idle', 136), A('mongo_idle', 160)], lines: [
        nar("A FEW HOURS AND MANY CHOMPED NOSES LATER, MONGO FALLS ASLEEP ON DONUT'S BACK. THE BOND CLICKS INTO PLACE. SHE IS INSUFFERABLE ABOUT IT."),
        smug("HE CHOSE ME, CARL. OBVIOUSLY. EVERYONE CHOOSES ME EVENTUALLY.")] },
      { bg: 'stairwell', actors: [A('carl_idle', 110), A('donut_idle', 136), A('mongo_idle', 160), A('agatha_idle', 244, true)], lines: [
        nar("AT THE TOP OF THE STAIRWELL, A SHOPPING CART SQUEAKS. AGATHA. SHE SHOULDN'T BE HERE. NOBODY SAW HER COME."),
        say('AGATHA', 'p_agatha', "AGATHA GOES DOWN TOO. AGATHA ALWAYS GOES DOWN. THE CART KNOWS THE WAY. HEE HEE HEE."),
        carl("...GOOD TO SEE YOU, AGATHA.")] },
      { bg: 'stairwell', fx: 'flash', actors: [A('carl_idle', 110), A('donut_idle', 136), A('mongo_idle', 160)], lines: [
        ai("THE ROYAL COURT OF PRINCESS DONUT DESCENDS TO THE THIRD FLOOR! NEXT TIME: RACES! CLASSES! SO MUCH MORE DYING! STAY TUNED, CRAWLERS!"),
        carl("COME ON. ALL OF YOU. STAIRS.")] },
      { bg: 'studio', fx: 'confetti', actors: [A('carl_idle', 96), A('donut_idle', 120), A('mongo_idle', 144), A('odette_idle', 222, true)], lines: [
        say('ODETTE', 'p_odette', "DARLINGS, YOU'RE BACK! AND YOU BROUGHT A DINOSAUR! THE AUDIENCE WANTS TO KNOW: WHAT DO YOU THINK OF PORK BOY?"),
        carl("NO COMMENT."),
        donut("MONGO HAS A COMMENT. MONGO, NO. SPIT HER OUT.")] },
      { bg: 'studio', actors: [A('carl_idle', 96), A('donut_idle', 120), A('mongo_idle', 144), A('odette_idle', 222, true)], lines: [
        say('ODETTE', 'p_odette', "OFF THE AIR, ONE PIECE OF ADVICE, PRINCESS. ON THE THIRD FLOOR YOU PICK A CLASS. PICK ONE THAT KEEPS HIM ALIVE. HE KEEPS YOU ALIVE. THAT'S THE TRICK."),
        donut("I KNOW, ODETTE. I'VE ALWAYS KNOWN."),
        carl("GODDAMNIT, DONUT. NOW I'M GETTING SOMETHING IN MY EYE.")] }
    ] }
  };
})();

/* ==========================================================================
   GEAR, ITEMS, SKINS, COMPANIONS, LOOT, SHOP, ACHIEVEMENTS
   ========================================================================== */
(function () {
  'use strict';
  var D = window.DCW.data;

  /* ---------------- gear (permanent for the crawl; perks summed by game.js) ----------------
     Who gets it when: guild (trollskin, cloak, cudgel, crown), achievement podophilia (toe ring),
     tally (talisman), cookie (crupper), guild2 (gauntlet), krakaren kill (boxers),
     achievement little_piggy (pedicure kit), bugaboo (fur brush). */
  D.gear = {
    trollskin_shirt: { name: 'ENCHANTED TROLLSKIN SHIRT OF PUMMELING', who: 'carl', icon: 'shirt', skin: 'carl_trollskin',
      perk: { regen: 1 }, perkText: 'REGENERATION: +1 HP EVERY 8 SECONDS',
      desc: "MOTTLED GRAY-GREEN UNDERSHIRT MADE FROM AN ACTUAL TROLL. IT SLOWLY HEALS YOU. IT ALSO SMELLS LIKE A TROLL. TRADE-OFFS!" },
    nightgaunt_cloak: { name: 'ENCHANTED NIGHTGAUNT CLOAK OF STOUTNESS', who: 'carl', icon: 'cloak',
      perk: { hp: 4 }, perkText: '+4 MAX HP',
      desc: "A HOODED CLOAK OF DEMON-WING SKIN STRETCHED OVER FINGERBONES. VERY STURDY. IF A NIGHTGAUNT SEES YOU IN IT, RUN." },
    toad_cudgel: { name: 'TOAD CUDGEL', who: 'carl', icon: 'club',
      perk: { stun: 0.03 }, perkText: '+3% STUN CHANCE',
      desc: "A CLUB SHAPED LIKE A TOAD. UNENCHANTED. YOU TRIED IT ONCE AND WENT BACK TO PUNCHING. YOU CARRY IT FOR LUCK. IT IS NOT LUCKY." },
    toe_ring: { name: 'ENCHANTED TOE RING OF THE SPLATTER SKUNK', who: 'carl', icon: 'ring',
      perk: { dmg: 1, kick: 1 }, perkText: '+1 PUNCH, +1 KICK AND STOMP',
      desc: "A RING. FOR YOUR TOE. IT BOOSTS STRENGTH AND YOUR POWERFUL STRIKE. IT ALSO MAKES YOU LOOK LIKE A GUY WHO OWNS A HACKY SACK." },
    war_gauntlet: { name: 'ENCHANTED WAR GAUNTLET OF THE EXALTED GRULL', who: 'carl', icon: 'gauntlet',
      perk: { dmg: 2, stun: 0.04 }, perkText: '+2 PUNCH, +4% STUN CHANCE',
      desc: "AN IRON GAUNTLET BUILT FOR PUNCHING THINGS THAT HAVE IT COMING. FINALLY, SOMETHING BETWEEN YOUR KNUCKLES AND THE TEETH." },
    bigboi_boxers: { name: 'ENCHANTED BIGBOI BOXERS', who: 'carl', icon: 'boxers', skin: 'carl_bigboi',
      perk: { hp: 3, crit: 0.03 }, perkText: '+3 MAX HP, +3% CRIT',
      desc: "SHAPESHIFTER-PROOF UNDERWEAR. IF YOU EVER TURN INTO SOMETHING HUGE, THESE STRETCH WITH YOU. EVERYTHING ELSE RIPS. NOT THESE." },
    pedicure_kit: { name: 'ENCHANTED PEDICURE KIT OF THE SYLPH', who: 'carl', icon: 'foot',
      perk: { speed: 0.05, stomp: 0.5 }, perkText: '+5% SPEED, STOMPS HIT 50% HARDER',
      desc: "TWELVE SHINY FOOT TOOLS IN A ZIP FOLDER. NIMBLE, TIDY TOOTSIES. SOMEBODY IN THE AUDIENCE IS VERY INVESTED IN YOUR TOES." },
    crown_sepsis: { name: 'ENCHANTED CROWN OF THE SEPSIS WHORE', who: 'donut', icon: 'crown',
      perk: { missile: 1, special: 10 }, perkText: '+1 MISSILE DAMAGE, +10% SPECIAL METER',
      desc: "A CAT-SIZED TIARA WITH A STORMY PURPLE STONE. IT ALSO PUTS HER IN LINE FOR A THRONE SHE SHOULD NOT WANT. READ THE LABEL NEXT TIME." },
    talisman_butterfly: { name: 'TALISMAN OF THE SLATE BUTTERFLY', who: 'donut', icon: 'talisman',
      perk: { missileCd: 0.15, special: 5 }, perkText: 'FASTER MISSILES, +5% SPECIAL METER',
      desc: "A LITTLE STONE BUTTERFLY ON A CHAIN, A GIFT FROM TALLY. DONUT SAYS IT BRINGS OUT HER EYES. HER MISSILES DO SEEM PERKIER." },
    fae_crupper: { name: 'FAE SCALE CRUPPER', who: 'donut', icon: 'skirt',
      perk: { def: 1 }, perkText: '-1 DAMAGE TAKEN',
      desc: "ARMOR FOR A HORSE'S BACKSIDE, CAT-SIZED, MADE OF SHIMMERING FAE SCALES. DONUT CALLS IT A SKIRT. NOBODY CORRECTS HER." },
    fur_brush: { name: 'FUR BRUSH', who: 'donut', icon: 'brush',
      perk: { missile: 1, special: 10 }, perkText: '+1 MISSILE DAMAGE, +10% SPECIAL METER',
      desc: "AN ENCHANTED GROOMING BRUSH FROM MORDECAI. A BRUSHED PRINCESS IS A HAPPY PRINCESS. A HAPPY PRINCESS HITS HARDER." }
  };

  /* ---------------- inventory items ---------------- */
  D.items = {
    potion: { name: 'HEALTH POTION', icon: 'potion', desc: "HEALS HALF YOUR MAX HP. TASTES LIKE CHERRY COUGH SYRUP AND REGRET. USELESS WHILE TAINTED." },
    bomb: { name: 'GOBLIN DYNAMITE', icon: 'dynamite', jugName: "CARL'S JUG O'BOOM", jugIcon: 'jug',
      desc: "A STICK OF GOBLIN DYNAMITE. LIGHT, THROW, DUCK. THE GOBLINS MADE IT, SO THE FUSE LENGTH IS MORE OF A SUGGESTION.",
      jugDesc: "MOONSHINE, GOBLIN OIL AND A TORCH FOR A CORK. BIGGER BLAST, AND IT LEAVES BLUE FIRE BEHIND. DUNGEONPRENEUR CERTIFIED." },
    biscuit: { name: 'PET BISCUIT', icon: 'biscuit', desc: "A CRUMBLY BROWN PELLET THAT SMELLS LIKE A PET STORE. ANIMALS GO NUTS FOR THEM. DO NOT FEED THEM TO THE CAT." }
  };

  /* ---------------- loot ----------------
     Engine tiers; the book's box names ride along as give/achievement boxName.
     No skins in loot (skins come from gear), no companions. Gold is floor-1
     base (game.js scales by floor). */
  D.boxTiers = {
    bronze:    { name: 'BRONZE ADVENTURER BOX', color: '#c84c0c', rank: 1 },
    silver:    { name: 'SILVER ADVENTURER BOX', color: '#bcbcbc', rank: 2 },
    gold:      { name: 'GOLD ADVENTURER BOX', color: '#f8b800', rank: 3 },
    platinum:  { name: 'PLATINUM ADVENTURER BOX', color: '#a4e4fc', rank: 4 },
    legendary: { name: 'LEGENDARY BOX', color: '#f878f8', rank: 5 },
    fan:       { name: 'BRONZE FAN BOX', color: '#f85898', rank: 2 },
    boss:      { name: 'BRONZE BOSS BOX', color: '#d82800', rank: 4 }
  };
  D.lootTables = {
    bronze: { rolls: 2, entries: [
      [{ kind: 'gold', min: 6, max: 16 }, 38],
      [{ kind: 'item', id: 'potion', count: 1 }, 18],
      [{ kind: 'item', id: 'bomb', count: 2 }, 18],
      [{ kind: 'item', id: 'biscuit', count: 1 }, 6],
      [{ kind: 'xp', amount: 10 }, 12],
      [{ kind: 'stat', any: true, amount: 1 }, 5],
      [{ kind: 'hp', amount: 1 }, 3]
    ] },
    silver: { rolls: 3, entries: [
      [{ kind: 'gold', min: 15, max: 35 }, 32],
      [{ kind: 'item', id: 'potion', count: 1 }, 18],
      [{ kind: 'item', id: 'bomb', count: 3 }, 15],
      [{ kind: 'item', id: 'biscuit', count: 1 }, 6],
      [{ kind: 'xp', amount: 25 }, 11],
      [{ kind: 'stat', any: true, amount: 1 }, 11],
      [{ kind: 'hp', amount: 2 }, 7]
    ] },
    gold: { rolls: 3, entries: [
      [{ kind: 'gold', min: 35, max: 70 }, 28],
      [{ kind: 'item', id: 'potion', count: 2 }, 16],
      [{ kind: 'item', id: 'bomb', count: 4 }, 13],
      [{ kind: 'item', id: 'biscuit', count: 2 }, 5],
      [{ kind: 'xp', amount: 55 }, 11],
      [{ kind: 'stat', any: true, amount: 1 }, 16],
      [{ kind: 'hp', amount: 2 }, 11]
    ] },
    platinum: { rolls: 4, entries: [
      [{ kind: 'gold', min: 70, max: 140 }, 26],
      [{ kind: 'item', id: 'potion', count: 2 }, 15],
      [{ kind: 'item', id: 'bomb', count: 5 }, 11],
      [{ kind: 'xp', amount: 110 }, 11],
      [{ kind: 'stat', any: true, amount: 2 }, 22],
      [{ kind: 'hp', amount: 3 }, 15]
    ] },
    legendary: { rolls: 3, guaranteed: [{ kind: 'stat', any: true, amount: 2 }], entries: [
      [{ kind: 'gold', min: 120, max: 240 }, 26],
      [{ kind: 'stat', any: true, amount: 2 }, 26],
      [{ kind: 'hp', amount: 4 }, 20],
      [{ kind: 'item', id: 'potion', count: 3 }, 16],
      [{ kind: 'xp', amount: 200 }, 12]
    ] },
    fan: { rolls: 2, entries: [
      [{ kind: 'gold', min: 12, max: 30 }, 32],
      [{ kind: 'item', id: 'potion', count: 1 }, 20],
      [{ kind: 'item', id: 'bomb', count: 3 }, 18],
      [{ kind: 'item', id: 'biscuit', count: 1 }, 6],
      [{ kind: 'xp', amount: 20 }, 12],
      [{ kind: 'stat', any: true, amount: 1 }, 8],
      [{ kind: 'hp', amount: 1 }, 4]
    ] },
    boss: { rolls: 3, guaranteed: [{ kind: 'item', id: 'potion', count: 1 }], entries: [
      [{ kind: 'gold', min: 40, max: 90 }, 26],
      [{ kind: 'item', id: 'potion', count: 2 }, 12],
      [{ kind: 'item', id: 'bomb', count: 4 }, 14],
      [{ kind: 'stat', any: true, amount: 2 }, 18],
      [{ kind: 'hp', amount: 2 }, 16],
      [{ kind: 'xp', amount: 70 }, 14]
    ] }
  };

  /* prices are floor-1 values; game.js scales by (1 + (floor-1)*0.35).
     Shops: Tally (floor 1) and Qwist (floor 2). */
  D.shop = [
    { id: 'potion', name: 'HEALTH POTION', desc: 'HEALS HALF YOUR MAX HP. DOES NOTHING WHILE YOU HAVE THE TAINT. NOTHING DOES.', price: 30, give: { kind: 'item', id: 'potion', count: 1 } },
    { id: 'bomb', name: 'GOBLIN DYNAMITE', desc: "ONE STICK. ARCS NICELY. RESPECTS NOBODY. TURNS INTO A JUG O'BOOM ONCE CARL INVENTS THOSE.", price: 15, give: { kind: 'item', id: 'bomb', count: 1 } },
    { id: 'bomb_bundle', name: 'DYNAMITE SIX PACK', desc: 'SIX BOOMS FOR THE PRICE OF FIVE. A GOBLIN HOLIDAY SPECIAL. DO NOT STORE NEAR THE CAT.', price: 75, give: { kind: 'item', id: 'bomb', count: 6 } },
    { id: 'biscuit', name: 'PET BISCUIT', desc: 'FEEDS ONE CAGED DOG. TURNS A SNARL INTO A NAP. KEEP A FEW IN YOUR BOXERS FOR LATER.', price: 20, give: { kind: 'item', id: 'biscuit', count: 1 } },
    { id: 'pate', name: 'SALMON PATE', desc: "THE PRINCESS'S FAVORITE. NOT FOR YOU. +8 XP FOR KEEPING HER HAPPY. SHE TAKES THE PLATE TOO.", price: 10, give: { kind: 'xp', amount: 8 } },
    { id: 'tonic_str', name: 'POTION OF STRENGTH', desc: '+1 STR. MORE PUNCH IN THE PUNCHES AND THE KICKS AND THE BOMBS. TASTES LIKE A GYM SOCK.', price: 120, give: { kind: 'stat', stat: 'str', amount: 1 } },
    { id: 'tonic_con', name: 'POTION OF CONSTITUTION', desc: '+1 CON. +2 MAX HP. YOUR LIVER WILL FILE A FORMAL COMPLAINT.', price: 120, give: { kind: 'stat', stat: 'con', amount: 1 } },
    { id: 'tonic_dex', name: 'POTION OF DEXTERITY', desc: '+1 DEX. MORE CRITS, FASTER FEET. STILL NO SHOES THOUGH.', price: 120, give: { kind: 'stat', stat: 'dex', amount: 1 } },
    { id: 'tonic_int', name: 'POTION OF INTELLIGENCE', desc: "+1 INT. THE PRINCESS'S MISSILES HIT HARDER. YOURS DO NOT. YOU DON'T HAVE MISSILES.", price: 120, give: { kind: 'stat', stat: 'int', amount: 1 } },
    { id: 'heart', name: 'ELIXIR OF VIGOR', desc: '+2 MAX HP FOR THE REST OF THE CRAWL. DO NOT ASK WHAT THE CHUNKS ARE.', price: 150, give: { kind: 'hp', amount: 2 } },
    { id: 'revival', name: 'REVIVAL WAIVER', desc: '+1 REVIVAL. THE FINE PRINT SAYS BORANT OWNS YOUR SECOND LIFE. AND THE FOOTAGE.', price: 200, give: { kind: 'revival', count: 1 } },
    { id: 'mystery', name: 'MYSTERY BOX', desc: 'A BRONZE ADVENTURER BOX. NO REFUNDS. NO PEEKING. A LITTLE SHAKING IS FINE.', price: 45, give: { kind: 'box', tier: 'bronze' } }
  ];

  /* ---------------- skins (unlocked by gear; switch in the GEAR screen) ---------------- */
  D.skins = {
    carl_boxers: { name: 'THE CLASSIC', perk: null,
      desc: 'A LEATHER JACKET, BOXER SHORTS AND BARE FEET. WHAT YOU WERE WEARING WHEN THE WORLD ENDED. THE VIEWERS WILL NEVER LET IT GO.',
      how: 'WHAT YOU WERE WEARING WHEN THE BUILDINGS SANK.' },
    carl_trollskin: { name: 'TROLLSKIN SHIRT', perk: null,
      desc: 'THE SAME LOOK, PLUS A MOTTLED TROLLSKIN SHIRT UNDER THE JACKET. ALMOST DRESSED. THE AUDIENCE IS CONCERNED.',
      how: 'EQUIP THE ENCHANTED TROLLSKIN SHIRT OF PUMMELING. MORDECAI HAS YOUR FIRST BOXES.' },
    carl_bigboi: { name: 'BIGBOI', perk: null,
      desc: 'TROLLSKIN SHIRT, LEATHER JACKET, AND THE ENCHANTED BIGBOI BOXERS. PEAK DUNGEON FASHION. NOT A PANT IN SIGHT.',
      how: 'BEAT THE KRAKAREN CLONE ON THE SECOND FLOOR. THE BOSS BOX HAS UNDERWEAR IN IT.' }
  };

  /* ---------------- companions ---------------- */
  D.companions = {
    // Donut mode (after beating the book): Carl follows Princess Donut and punches things for her
    carl: { name: 'CARL', ability: 'bite', cooldown: 0.9, power: 3, sprite: 'carl',
      desc: "A MAN IN HIS BOXERS AND A LEATHER JACKET WHO HAS PUNCHED HIS WAY THROUGH TWO FLOORS. NOW HE WORKS FOR THE CAT. HE ALWAYS DID.",
      special: { name: 'GODDAMNIT, DONUT', desc: 'CARL CHARGES ACROSS THE SCREEN AND PUNCHES EVERYTHING IN HIS WAY.', time: 1.8 },
      how: 'BEAT BOOK ONE. THEN THE PRINCESS TAKES THE LEAD.' },
    donut: { name: 'PRINCESS DONUT', ability: 'missile', cooldown: 1.6, power: 2, sprite: 'donut',
      desc: 'A CHAMPION PERSIAN SHOW CAT, ROYALTY ACCORDING TO HER, AND THE DUNGEON AGREES. CASTS MAGIC MISSILE ONCE SHE LEARNS IT.',
      special: { name: 'MAGIC MISSILE BARRAGE', desc: 'A STORM OF HOMING MISSILES HITS EVERY ENEMY ON SCREEN.', time: 0 },
      how: 'SHE WAS ALWAYS HERE. SHE WOULD LIKE THAT NOTED.' },
    mongo: { name: 'MONGO', ability: 'bite', cooldown: 1.2, power: 3, sprite: 'mongo',
      desc: 'A BABY MONGOLIENSIS FROM A PET REWARD ROOM. ALL LEGS, TEETH AND SCREAMING. HE BITES MOBS. HE ALSO BITES DONUT. LOVINGLY.',
      special: { name: 'DINO STAMPEDE', desc: 'MONGO CHARGES ACROSS THE SCREEN, BITING EVERYTHING IN HIS PATH.', time: 2.5 },
      how: 'WON IN A PET REWARD ROOM AFTER THE KOBOLD BOSS ON THE SECOND FLOOR.',
      rescueLines: ["MREEP! MREEEEP! (MONGO HAS DECIDED DONUT IS HIS MOTHER. DONUT HAS DECIDED THIS IS CORRECT.)"] }
  };

  /* ---------------- achievements ----------------
     event = a DCW.game.track name (DESIGN list). box: engine tier, or null
     for none (the book gives nothing); boxName = the book's box name. */
  D.achievements = {
    /* entering the dungeon (CUT:f1_entrance) */
    crazy_cat_lady: { name: 'CRAZY CAT LADY!', event: 'story:f1_entrance', count: 1, box: 'bronze', boxName: 'BRONZE PET BOX',
      desc: 'YOU ENTERED THE DUNGEON WITH A CAT. SHE IS NOT YOUR CAT. SHE IS NOT ANYONE\'S CAT. SHE IS NOW YOUR PROBLEM.' },
    why_no_pants: { name: "WHY AREN'T YOU WEARING PANTS?", event: 'story:f1_entrance', count: 1, box: 'gold', boxName: 'GOLD APPAREL BOX',
      desc: 'YOU ENTERED THE DUNGEON IN YOUR UNDERWEAR. ON PURPOSE? WE ARE NOT ASKING. WE ARE JUST GIVING YOU A BOX. IT IS NOT PANTS.' },
    unarmed_combat: { name: 'UNARMED COMBAT', event: 'story:f1_entrance', count: 1, box: 'bronze', boxName: 'BRONZE WEAPON BOX',
      desc: 'YOU WALKED INTO A MONSTER DUNGEON WITHOUT A WEAPON. YOUR FISTS ARE BRAVE. YOUR FISTS ARE ALSO VERY SOFT.' },
    early_adopter: { name: 'EARLY ADOPTER', event: 'story:f1_entrance', count: 1, box: 'silver', boxName: 'SILVER ADVENTURER BOX',
      desc: 'ONE OF THE FIRST FIVE THOUSAND THROUGH THE DOORS. YOU WERE EAGER TO DIE! WE RESPECT THAT.' },
    empty_pockets: { name: 'EMPTY POCKETS', event: 'story:f1_entrance', count: 1, box: 'bronze', boxName: 'BRONZE ADVENTURER BOX',
      desc: 'NO SUPPLIES. NO FOOD. NO SHOES. NOT EVEN POCKETS, TECHNICALLY. BOXERS DO NOT HAVE POCKETS.' },

    /* the tutorial */
    read_sign: { name: "YOU'VE DISCOVERED AND READ AN OFFICIAL DUNGEON SIGN", event: 'sign', count: 1, box: null,
      desc: 'YOU READ A SIGN. IN A DUNGEON. ON PURPOSE. YOUR HUD AND MINIMAP THANK YOU. THE RATS ARE TERRIFIED OF YOUR LITERACY.' },
    entered_guild: { name: "YOU'VE ENTERED A GUILDHALL!", event: 'safe:guild', count: 1, box: null,
      desc: 'YOU FOUND A TUTORIAL GUILD HALL AND YOU GOT IN, BECAUSE YOU KILLED SOMETHING FIRST. LOOK AT YOU, FOLLOWING RULES.' },
    first_damage: { name: "YOU'VE INFLICTED DAMAGE ON A MOB", event: 'hit', count: 1, box: null,
      desc: 'YOU HURT SOMETHING! IT HURT BACK, PROBABLY. THAT IS HOW THIS WORKS. WELCOME TO THE CIRCLE OF LIFE.' },
    first_kill: { name: "YOU'VE KILLED A MOB!", event: 'kill', count: 1, box: 'bronze',
      desc: 'YOUR FIRST KILL! YOU CAN NOW EARN EXPERIENCE. YOU CAN ALSO NOW ENTER GUILD HALLS. AND HAVE NIGHTMARES. ALL UNLOCKED!' },
    bare_hands: { name: "YOU'VE KILLED AN ARMED MOB WITH YOUR BARE FUCKING HANDS!", event: 'kill_armed', count: 1, box: 'bronze', boxName: 'BRONZE WEAPON BOX',
      desc: 'IT HAD A KNIFE. YOU HAD KNUCKLES. THE KNUCKLES WON. THE AUDIENCE, HAD THERE BEEN ONE, WOULD HAVE LOST ITS MIND.' },
    podophilia: { name: 'PODOPHILIA!', event: 'stomp_kill', count: 1, box: 'gold', boxName: 'GOLD SHOE BOX', gear: 'toe_ring',
      desc: 'YOU CRUSHED A MOB TO DEATH WITH YOUR BARE FEET. SOMEBODY UP HERE HAD TO STEP AWAY FOR A MINUTE. HERE IS A TOE RING.' },
    boom: { name: 'BOOM!', event: 'bomb', count: 1, box: 'silver', boxName: 'SILVER GOBLIN BOX',
      desc: 'YOUR FIRST EXPLOSION! IT WILL NOT BE YOUR LAST. WE CAN TELL. YOU HAVE THAT LOOK IN YOUR EYE.' },
    boss_babe: { name: 'BOSS BABE', event: 'boss_hit', count: 1, box: null,
      desc: 'YOU HIT A BOSS! IT DID NOT CARE! IT WILL CARE LATER. YOU ARE A GIRLBOSS NOW. THOSE ARE THE RULES.' },
    smush: { name: 'SMUSH!', event: 'stomp', count: 10, box: 'bronze',
      desc: 'TEN THINGS STOMPED FLAT. YOUR FEET ARE DISGUSTING. YOUR FEET ARE ALSO A REGISTERED WEAPON IN FOUR SYSTEMS.' },
    level_up: { name: 'LEVEL-UP, BABY!', event: 'level:2', count: 1, box: null,
      desc: 'LEVEL TWO! YOU ARE NOW SLIGHTLY HARDER TO KILL. WE ARE ADJUSTING THE MONSTERS ACCORDINGLY. KIDDING. WE ALREADY DID.' },
    throat_punch: { name: 'THROAT PUNCH!', event: 'throat_punch', count: 1, box: 'bronze',
      desc: 'YOU PUNCHED A LLAMA IN THE THROAT AND IT DIED. THAT IS NOT HOW LLAMAS WORK ON EARTH. IT IS HOW THEY WORK HERE.' },
    fall_trap: { name: 'FALL INTO AN OBVIOUS TRAP', event: 'fall', count: 1, box: null,
      desc: 'THE HOLE WAS RIGHT THERE. IT WAS BLACK. THE FLOOR WAS NOT BLACK. YOU WENT IN ANYWAY. BOLD STRATEGY.' },
    two_chicks: { name: 'TWO CHICKS AT THE SAME TIME', event: 'double_kill', count: 1, box: 'gold', boxName: "GOLD BRAWLER'S BOX",
      desc: 'TWO KILLS IN LESS THAN HALF A SECOND. ONE GOBLIN, ONE GOBLIN-SHAPED PROJECTILE. MAN, THAT IS SO HOT.' },
    oooh_magic: { name: 'OOOH, MAGIC', event: 'gear', count: 1, box: 'bronze',
      desc: 'YOU PUT ON MAGICAL GEAR! IT GLOWS A LITTLE. YOU GLOW A LITTLE. THE GLOW IS PROBABLY FINE.' },

    /* the workshop (SAFE:cookie) */
    war_criminal: { name: 'WAR CRIMINAL', event: 'safe:cookie', count: 1, box: 'gold', boxName: "GOLD ASSHOLE'S BOX",
      desc: 'MORE THAN TWENTY NON-COMBATANTS IN ONE ATTACK. THE GENEVA CONVENTION DOES NOT APPLY DOWN HERE. WE CHECKED. TWICE.' },
    you_monster: { name: 'YOU MONSTER!', event: 'safe:cookie', count: 1, box: 'bronze', boxName: "BRONZE ASSHOLE'S BOX",
      desc: 'YOU KILLED A CHILD. GOBLIN, SURE. STILL. INSIDE THE BOX: THE DESPERADO PASS, A TATTOO FOR PEOPLE LIKE YOU.' },

    /* the floor boss */
    borough_boss: { name: 'BOROUGH BOSS!', event: 'story:f1_swine_plan', count: 1, box: null,
      desc: 'YOU FOUND A BOROUGH BOSS. IT IS SITTING ON THE STAIRS. IT IS MADE OF PIGS. NOBODY SAID THIS WOULD BE EASY.' },
    found_stairs: { name: 'YOU FOUND STAIRS!', event: 'boss:ball_of_swine', count: 1, box: 'silver', boxName: 'SILVER BOSS BOX',
      desc: 'THE STAIRWELL TO THE SECOND FLOOR! DOWN IS THE ONLY WAY OUT. THAT SENTENCE SHOULD WORRY YOU MORE THAN IT DOES.' },

    /* floor 2 */
    little_piggy: { name: 'THIS LITTLE PIGGY WENT TO MARKET!', event: 'safe:shelter', count: 1, box: 'platinum', boxName: 'PLATINUM SHOE BOX', gear: 'pedicure_kit',
      desc: 'YOU MADE DADDY VERY, VERY HAPPY. DO NOT ASK WHO DADDY IS. ENJOY YOUR PEDICURE KIT AND KEEP THOSE TOES SHINY.' },
    unvaccinated: { name: 'UNVACCINATED', event: 'taint', count: 1, box: 'bronze',
      desc: 'YOU CAUGHT THE TAINT FROM A CLURICHAUN. NOTHING HEALS YOU UNTIL IT WEARS OFF. SHOULD HAVE GOTTEN THE SHOT, CRAWLER.' },
    grease_monkey: { name: 'GREASE MONKEY', event: 'story:f2_jack', count: 1, box: 'silver', boxName: "SILVER MECHANIC'S BOX",
      desc: 'YOU BUILT A PLAN AROUND A WHEELED DEVICE. THE PLAN IS INSANE. THE DEVICE IS A STEAM MOTORCYCLE. WE APPROVE BOTH.' },
    bosses_leave: { name: 'WAIT, BOSSES CAN LEAVE THEIR ROOMS?', event: 'boss_breakout', count: 1, box: null,
      desc: 'YES. YES THEY CAN. IT IS IN THE TERMS OF SERVICE. PAGE NINE THOUSAND. YOU SHOULD HAVE READ IT.' },
    dungeonpreneur: { name: 'DUNGEONPRENEUR', event: 'story:f2_jug', count: 1, box: 'gold', boxName: "GOLD SAPPER'S BOX",
      desc: "YOU INVENTED A STACKABLE WEAPON. CARL'S JUG O'BOOM IS NOW IN THE CATALOG. EVERY CRAWLER WHO KILLS WITH ONE PAYS YOU. KIND OF." },
    what_goes_up: { name: 'WHAT GOES UP', event: 'reverse_gravity', count: 1, box: null,
      desc: 'YOU WERE HIT BY REVERSE GRAVITY AND YOU LIVED. THE CEILING SAYS HI. THE FLOOR WOULD LIKE YOU BACK EVENTUALLY.' },
    moth_flame: { name: 'LIKE A MOTH TO THE FLAME', event: 'pursuer_hit', count: 1, box: 'platinum', boxName: 'PLATINUM LUCKY BASTARD BOX',
      desc: 'YOU DAMAGED A MOB SEVENTY-FIVE LEVELS ABOVE YOU. IT DID NOT NOTICE. WE NOTICED. HERE IS A VERY LUCKY BOX.' },
    call_that_trap: { name: 'YOU CALL THAT A TRAP?', event: 'mine_hit', count: 1, box: 'gold', boxName: "GOLD SAPPER'S BOX",
      desc: 'YOU DROPPED A BOMB BEHIND YOU AND SOMETHING CHASING YOU RAN RIGHT INTO IT. CLASSIC. CARTOONISH. EFFECTIVE.' },
    ceramic_dalmatian: { name: "I'LL TAKE THE CERAMIC DALMATIAN, PAT!", event: 'story:f2_menagerie', count: 1, box: null,
      desc: 'YOU FOUND A REWARD ROOM! ONE PRIZE PER CUSTOMER. NO, YOU CANNOT HAVE THE DALMATIAN. THERE IS NO DALMATIAN.' },
    menagerie: { name: 'MENAGERIE', event: 'story:f2_menagerie', count: 1, box: null,
      desc: 'A PET REWARD ROOM! TEN CAGES, TEN BABIES, AND ONE CAT WITH VERY STRONG OPINIONS ABOUT ALL OF THEM.' },
    peta: { name: 'PETA ENTHUSIAST', event: 'cage_calm', count: 1, box: 'silver',
      desc: 'YOU FED A HOSTILE DOG THROUGH THE BARS AND NOW IT LIKES YOU. ON THIS SHOW, THAT COUNTS AS ANIMAL RIGHTS.' },
    janitor: { name: 'SPAWN LIMIT', event: 'janitor', count: 25, box: 'bronze',
      desc: 'TWENTY-FIVE BRINDLE GRUBS BORN ON YOUR CORPSES. YOU ARE NOT KILLING MOBS ANYMORE. YOU ARE FARMING THEM.' },
    sticker: { name: 'STICKY SITUATION', event: 'sticker', count: 1, box: null,
      desc: 'A ROT STICKER LATCHED ON. NEXT TIME, PRESS ATTACK. OR DO NOT, AND LET THE AUDIENCE WATCH. THEY WOULD LIKE THAT.' },
    breakout_boom: { name: 'THE CHOPPER SURVIVES', event: 'ride_jump', count: 25, box: 'bronze',
      desc: 'TWENTY-FIVE JUMPS ON THE GOBLIN COPPER CHOPPER. THE SIDECAR IS LOOSE. DONUT HAS NOTICED. DONUT HAS FEELINGS ABOUT IT.' },

    /* general */
    kill_100: { name: 'PEST CONTROL', event: 'kill', count: 100, box: 'silver',
      desc: 'A HUNDRED KILLS. IN BOXERS. THE DUNGEON HAS STARTED TALKING ABOUT YOU. NOT NICELY. BUT TALKING.' },
    kill_300: { name: 'BODY COUNT', event: 'kill', count: 300, box: 'gold',
      desc: 'THREE HUNDRED KILLS. THE VIEWERS HAVE A DRINKING GAME. SEVERAL OF THEM ARE IN THE HOSPITAL. GOOD JOB.' },
    combo_10: { name: 'COMBO STARTER', event: 'combo10', count: 1, box: 'bronze',
      desc: 'TEN HITS IN A ROW. YOU ARE BASICALLY A FIGHTING GAME CHARACTER NOW. A SAD, SHIRTLESS ONE.' },
    combo_25: { name: 'COMBO BREAKER BREAKER', event: 'combo25', count: 1, box: 'gold',
      desc: 'TWENTY-FIVE HITS WITHOUT A BREAK. THE ANNOUNCER BOOTH NEEDED A MOMENT. THE ANNOUNCER BOOTH IS ME.' },
    no_damage: { name: 'UNTOUCHABLE', event: 'no_damage_stage', count: 1, box: 'silver',
      desc: 'A WHOLE STAGE WITHOUT GETTING HIT. WHO ARE YOU AND WHAT DID YOU DO WITH THE GUY IN BOXERS?' },
    multi_bomb: { name: 'THREE FOR ONE', event: 'multi_bomb', count: 1, box: 'silver', boxName: 'SILVER GOBLIN BOX',
      desc: 'THREE KILLS WITH ONE BOMB. EFFICIENT! HORRIFYING! WE ARE PUTTING IT IN THE OPENING CREDITS!' },
    secret_1: { name: 'NOSY', event: 'secret', count: 1, box: 'bronze',
      desc: "YOU FOUND A HIDDEN BOX. YOU ARE THE KIND OF PERSON WHO READS OTHER PEOPLE'S MAIL. GOOD. THE DUNGEON REWARDS NOSY." },
    death_1: { name: 'PARTICIPATION TROPHY', event: 'death', count: 1, box: 'bronze',
      desc: 'YOU DIED! CONGRATULATIONS ON EXPERIENCING THE DUNGEON\'S MOST POPULAR FEATURE.' },
    pet_donut: { name: 'ROYAL GROOMER', event: 'pet_donut', count: 1, box: 'fan',
      desc: 'YOU PET PRINCESS DONUT. SHE ALLOWED IT. THIS TIME. DO NOT LET IT GO TO YOUR HEAD, PEASANT.' },
    shop_1: { name: 'RETAIL THERAPY', event: 'shop', count: 1, box: 'bronze',
      desc: 'YOU BOUGHT SOMETHING FROM A BOPCA. THE ECONOMY OF THE APOCALYPSE THANKS YOU. THE BOPCA THANKS YOU QUIETLY.' },
    cookie: { name: 'STALE BUT WORTH IT', event: 'cookie', count: 1, box: null,
      desc: 'YOU ATE AN EXPERIENCE COOKIE. IT WAS STALE. YOU FEEL SMARTER. YOU ARE NOT SMARTER. YOU ARE SLIGHTLY MORE LEVELED.' },
    level_5: { name: 'LEVEL FIVE, BABY!', event: 'level:5', count: 1, box: 'silver',
      desc: 'LEVEL FIVE. YOU ARE OFFICIALLY BETTER THAN MOST OF THE CORPSES ON THIS FLOOR. LOW BAR. STILL A BAR.' },
    level_10: { name: 'DOUBLE DIGITS', event: 'level:10', count: 1, box: 'gold',
      desc: 'LEVEL TEN! THE THIRD FLOOR IS GOING TO HAND YOU A RACE AND A CLASS. TRY NOT TO PICK SOMETHING STUPID.' },
    floor_2: { name: 'WELCOME TO THE SECOND FLOOR', event: 'floor:2', count: 1, box: 'silver',
      desc: 'YOU SURVIVED THE FIRST FLOOR. MOST PEOPLE DID NOT. THE CAMERAS ARE LIVE NOW. TRY TO LOOK LIKE YOU MEANT IT.' },
    win: { name: 'THE END OF BOOK ONE', event: 'win', count: 1, box: 'legendary',
      desc: 'TWO FLOORS, ONE CAT, ZERO PANTS. THE ROYAL COURT DESCENDS. CARL AND DONUT WILL RETURN. THE DUNGEON IS NOT DONE WITH THEM.' }
  };
})();

/* ==========================================================================
   TEXT: System AI pools, Mordecai, shopkeeper, story, titles.
   Uppercase 5x7 font, <= 140 chars per line, plain ASCII only.
   ========================================================================== */
(function () {
  'use strict';
  var D = window.DCW.data;

  D.ai = {
    floorClear: [
      "FLOOR CLEARED! THE STAIRS ARE OPEN AND YOU ARE STILL ALIVE. THE ODDSMAKERS ARE FURIOUS. SEVERAL OF THEM BET ON THE RATS.",
      "ANOTHER FLOOR DOWN! A ROUND OF APPLAUSE FOR THE CRAWLER WHO REFUSES TO TAKE A FUCKING HINT!",
      "CONGRATULATIONS! YOU ARE NOW ONE FLOOR CLOSER TO SOMETHING MUCH, MUCH WORSE. ENJOY THE STAIRS. THEY ARE THE NICE PART.",
      "THAT FLOOR TRIED ITS BEST, CRAWLER. ITS BEST WAS NOT ENOUGH. HOW DOES THAT FEEL? GREAT? IT SHOULD FEEL GREAT.",
      "FLOOR COMPLETE! THE COLLAPSE WILL TAKE CARE OF EVERYONE YOU LEFT BEHIND. DON'T LOOK BACK. SERIOUSLY. IT'S GROSS.",
      "WHAT A FLOOR! WE WILL BE REPLAYING THAT LAST HIT IN SLOW MOTION FOR WEEKS. WITH MUSIC. SAD VIOLIN MUSIC.",
      "STAIRWELL UNLOCKED! PLEASE MIND THE GAP, THE CORPSES, AND THE CAT. ESPECIALLY THE CAT."
    ],
    stageClear: [
      "AREA CLEARED! THE LOCALS ARE DEAD AND THE LOOT IS YOURS. A CLASSIC LOVE STORY.",
      "NICE WORK! THAT WAS ALMOST GRACEFUL. ALMOST. YOUR FEET WERE DOING SOMETHING WEIRD THE WHOLE TIME.",
      "STAGE COMPLETE! WE WOULD GIVE IT A SEVEN. THE CAT GIVES IT A FOUR. THE CAT IS A HARSH CRITIC.",
      "YOU MADE IT OUT! THE DOOR IS VERY HAPPY TO SEE YOU. DOORS DOWN HERE DON'T GET A LOT OF VISITORS. ALIVE ONES.",
      "CLEAR! THE MOBS IN THERE WILL RESPAWN EVENTUALLY. THEY HAVE A VERY GOOD UNION.",
      "THAT IS HOW YOU DO IT, CRAWLER! OR AT LEAST THAT IS ONE WAY. A MESSY, SHIRTLESS WAY.",
      "STAGE DONE! WE REVIEWED THE FOOTAGE. YOU KICKED A MOB INTO ANOTHER MOB. ICONIC. DEEPLY STUPID. ICONIC.",
      "CLEARED! TAKE A BREATH. NOT TOO DEEP. THE AIR DOWN HERE IS MOSTLY MONSTER."
    ],
    death: [
      "OH NO! OH NO NO NO! ANYWAY. THE NUMBERS ON THAT WERE INCREDIBLE.",
      "YOU DIED! DON'T WORRY, WE GOT IT ON FOUR CAMERAS. ONE OF THEM IS IN SLOW MOTION. ONE OF THEM IS ON YOUR ASS.",
      "AND THE CRAWLER GOES DOWN! THE CROWD GOES WILD! SOME OF THEM ARE SAD! MOST OF THEM ARE NOT!",
      "WELL, SHIT. WE WILL BE PLAYING THAT AT YOUR MEMORIAL. IT IS A VERY SHORT MEMORIAL.",
      "YOU HAVE DIED. PRINCESS DONUT WOULD LIKE IT ON THE RECORD THAT SHE WAS NOT INVOLVED AND THAT SHE LOOKED FABULOUS.",
      "CRAWLER DOWN! THE MOB THAT GOT YOU IS GETTING A BONUS. A SMALL ONE. YOU WEREN'T THAT HARD.",
      "YOU DIED IN YOUR UNDERWEAR. THAT IS GOING ON THE POSTER. THAT IS THE POSTER.",
      "DEATH! THE GREAT EQUALIZER! YOU WERE ALREADY PRETTY EQUAL. NOW YOU ARE VERY EQUAL."
    ],
    levelUp: [
      "LEVEL UP! YOU ARE NOW SLIGHTLY LESS LIKELY TO DIE! WE ARE A LITTLE DISAPPOINTED!",
      "DING! A NEW LEVEL! SPEND THAT STAT POINT WITH MORDECAI BEFORE YOU FORGET WHAT NUMBERS ARE.",
      "LEVEL UP! YOUR MUSCLES GREW. YOUR BRAIN STAYED EXACTLY THE SAME SIZE. CLASSIC.",
      "YOU LEVELED UP! THE MOBS HAVE BEEN NOTIFIED. THEY ARE NOT IMPRESSED. THEY ARE MOBS.",
      "STRONGER! FASTER! STILL BAREFOOT! LEVEL UP, CRAWLER!",
      "LEVEL UP! WE PATCHED A FEW OF YOUR HOLES FOR FREE. DON'T GET USED TO IT.",
      "A NEW LEVEL! THE CAT IS CLAIMING FULL CREDIT. WE ARE NOT GOING TO ARGUE WITH HER. NOBODY ARGUES WITH HER."
    ],
    lootbox: [
      "OOH, A BOX! WHAT COULD BE INSIDE? IT IS PROBABLY GOLD. IT IS USUALLY GOLD. IT IS NEVER PANTS.",
      "LOOT BOX TIME! SHAKE IT! NOT TOO HARD. ONE OF THEM HAD A BEE IN IT ONCE. A BIG BEE.",
      "OPEN IT! OPEN IT! SOMEWHERE OUT THERE, BILLIONS OF ALIENS ARE CHANTING. SOME OF THEM ARE BETTING.",
      "THE SPONSORS FILLED THIS BOX WITH LOVE, AND WITH SOMETHING THAT FELL OFF A TRUCK.",
      "A PRIZE FOR YOU, CRAWLER! REMEMBER: GAMBLING IS BAD, UNLESS IT IS ON TELEVISION.",
      "UNBOXING SEGMENT! SMILE FOR THE CAMERA. NO, A REAL SMILE. YOU LOOK LIKE A HOSTAGE. YOU ARE A HOSTAGE. SMILE ANYWAY.",
      "EVERY BOX IS A LITTLE MIRACLE. MOST MIRACLES ARE HEALTH POTIONS."
    ],
    revive: [
      "BACK FROM THE DEAD! THAT COST YOU A REVIVAL. CHECK YOUR WALLET. YOU DON'T HAVE A WALLET. YOU HAVE BOXERS.",
      "REVIVED! DEATH WAS WAITING WITH A CLIPBOARD. WE TOLD HIM TO COME BACK AFTER SWEEPS WEEK.",
      "YOU ARE ALIVE AGAIN! PLEASE DON'T MAKE THIS A HABIT. THE PAPERWORK IS ENORMOUS.",
      "THE NETWORK HAS DECIDED YOU ARE TOO ENTERTAINING TO STAY DEAD. CONGRATULATIONS? CONDOLENCES?",
      "WELCOME BACK! YOU MISSED NOTHING. EXCEPT DYING. YOU DID NOT MISS THAT. YOU NAILED THAT.",
      "UP YOU GET, CRAWLER! THE SHOW MUST GO ON, AND UNFORTUNATELY, YOU ARE THE SHOW.",
      "REVIVED! A SMALL PORTION OF YOUR DIGNITY COULD NOT BE RECOVERED. IT WAS A SMALL PORTION TO BEGIN WITH."
    ],
    boxEmpty: [
      "NO BOXES LEFT! GO EARN SOME MORE. THE MOBS ARE RIGHT OUTSIDE.",
      "YOUR BOX INVENTORY IS EMPTY. LIKE YOUR POCKETS. YOU DON'T HAVE POCKETS. YOU HAVE BOXERS.",
      "ZERO BOXES. THE SADDEST NUMBER. SECOND SADDEST AFTER YOUR VIEWER COUNT ON FLOOR ONE.",
      "NOTHING TO OPEN, CRAWLER. TRY OPENING YOUR MIND. KIDDING. GO KILL SOMETHING.",
      "EMPTY! WE CHECKED TWICE. ONCE UNDER THE TABLE. THE CAT CHECKED A THIRD TIME AND KNOCKED IT OVER.",
      "BOXES: NONE. ACHIEVEMENTS AND BOSSES GIVE BOXES. JUST SAYING. NO PRESSURE. ALL THE PRESSURE."
    ],
    lowHp: [
      "YOUR HEALTH IS LOW! THIS WOULD BE A GREAT TIME FOR A POTION. OR A PRAYER. MOSTLY A POTION.",
      "LOW HP! THE AUDIENCE IS LEANING FORWARD. THEY LOVE A CLOSE ONE. THEY LOVE A MESSY ONE MORE.",
      "CAREFUL, CRAWLER! YOU ARE MOSTLY HOLES AT THIS POINT.",
      "WARNING: CRAWLER STRUCTURAL INTEGRITY CRITICAL. THE CAT HAS STARTED BROWSING FOR A NEW HUMAN.",
      "YOU ARE ABOUT TO DIE! NO PRESSURE. EXCEPT ALL OF IT. ALL OF THE PRESSURE.",
      "LOW HEALTH! QUICK TIP: THE POTION BUTTON IS THE POTION BUTTON. UNLESS YOU HAVE THE TAINT. THEN YOU ARE FUCKED.",
      "THE BETTING ODDS ON YOUR DEATH JUST DROPPED TO TWO TO ONE. PROVE THEM WRONG. OR RIGHT. BOTH ARE GOOD TV."
    ],
    bigCombo: [
      "C-C-COMBO! THE CROWD IS ON ITS FEET! SOME OF THEM HAVE EXTRA FEET!",
      "WHAT A STRING OF HITS! WE ARE CUTTING THAT INTO THE TRAILER RIGHT NOW!",
      "COMBO! YOUR KNUCKLES ARE WRITING CHECKS AND THE MOBS ARE CASHING THEM!",
      "HIT AFTER HIT AFTER HIT! IS THIS A DUNGEON OR A DRUM SOLO?",
      "BEAUTIFUL VIOLENCE! THE SPONSORS ARE CRYING TEARS OF PURE PROFIT!",
      "KEEP IT GOING, CRAWLER! DON'T STOP! THE RATINGS DEPEND ON IT! ALSO YOUR LIFE! MOSTLY THE RATINGS!"
    ],
    flee: [
      "RUNNING AWAY? BOLD STRATEGY. COWARDLY, BUT BOLD.",
      "THE CRAWLER FLEES! THE AUDIENCE BOOS! SOMEONE THREW A TOMATO! IT WAS ME!",
      "TACTICAL RETREAT! THAT'S WHAT WE'LL CALL IT ON THE BROADCAST. WE ARE NICE LIKE THAT.",
      "YOU LEFT! THE MOBS ARE HIGH-FIVING. THE ONES WITH HANDS, ANYWAY.",
      "FLEEING COSTS YOU NOTHING BUT YOUR PRIDE. YOU HAD VERY LITTLE PRIDE. SO, A BARGAIN.",
      "RUN, CRAWLER, RUN! THE CHASE MUSIC IS ALREADY PLAYING!"
    ]
  };

  // Mordecai gets a new body every floor (art: mordecai_fN / p_mordecai_fN).
  D.mordecaiForms = {
    1: { name: 'RAT HOOLIGAN', line: "YES, I'M A RAT. A RAT HOOLIGAN, OFFICIALLY. BEARD, VEST, SANDALS. DON'T MAKE THE CHEESE JOKE. EVERYBODY MAKES THE CHEESE JOKE." },
    2: { name: 'BUGABOO', line: "A BUGABOO THIS TIME. SEVEN FEET OF FUR, NO NECK, EYES LIKE DINNER PLATES. I CAN'T REACH MY OWN FACE. SIT DOWN, KID. LET'S TALK." }
  };

  // floor-specific tips (safe rooms also carry their own `tips`; see below)
  D.mordecaiByFloor = {
    1: [
      "PUNCHES ARE FAST. KICKS ARE SLOW AND HIT HARDER. DOWN PLUS ATTACK. USE THE KICK ON THE BIG ONES, THE PUNCH ON EVERYTHING ELSE.",
      "IN THE AIR, HOLD DOWN AND HIT ATTACK. YOU DIVE FEET FIRST. BOUNCE OFF HEADS. IT KEEPS YOU OFF THE GROUND AND THE AUDIENCE LOVES IT.",
      "KILL AN ARMED MOB WITH YOUR BARE HANDS AND THE SYSTEM GIVES YOU A PRIZE. IT LIKES THAT KIND OF THING. SICK BASTARD.",
      "BAD LLAMAS LIGHT UP THEIR THROAT BEFORE THEY SPIT. HIT THE THROAT WHILE IT GLOWS AND THEY DROP. ONE PUNCH. TRUST ME.",
      "SCATTERERS DIE UNDER A FOOT. STOMP 'EM. THE BIG MOMMA ROACH DOESN'T. KICK HER.",
      "ROT STICKERS HANG FROM THE CEILING. IF ONE GRABS YOU, HIT ATTACK FAST AND FLICK IT OFF BEFORE IT POPS.",
      "BOMBS ARC. THROW THEM OVER WALLS AND INTO GROUPS. AND NOT AT YOUR OWN FEET. I'VE SEEN IT. MORE THAN ONCE.",
      "CRATES HIDE SNACKS AND BOMBS. CHESTS HAVE GOLD. MOBS ON THIS FLOOR DON'T CARRY ANY. BREAK EVERYTHING.",
      "THE CAT'S MISSILE IS ON A COOLDOWN. THE METER IN THE CORNER IS HER BIG SPELL. FULL METER, HIT SPECIAL. SAVE IT FOR BOSSES.",
      "POTIONS HEAL HALF YOUR HEALTH. DON'T SAVE THEM FOR LATER. LATER IS WHEN YOU'RE DEAD.",
      "STR IS PUNCH DAMAGE. CON IS HEALTH. DEX IS CRITS AND SPEED. INT MAKES THE CAT HIT HARDER. SHE'D WANT ME TO SAY THAT FIRST.",
      "TROGLODYTES ARE VENOMOUS AND THE LITTLE ONES JUMP. FIGHT THEM ON FLAT GROUND, NOT UNDER A LEDGE.",
      "BOSSES CHANGE THEIR MOVES WHEN THEY'RE HURT. WATCH FOR THE FLASH BEFORE A CHARGE. MOVE BEFORE IT, NOT AFTER.",
      "THE GODS ARE WATCHING FROM THE THIRD FLOOR ON. DON'T WORRY ABOUT THEM YET. WORRY ABOUT THE THING IN FRONT OF YOU."
    ],
    2: [
      "THE GRUBS EAT CORPSES AND MAKE MORE GRUBS. KILL FAST, MOVE ON. DON'T FARM THEM, THEY HATCH INTO VESPAS.",
      "THE TAINT MEANS NOTHING HEALS YOU. NOT POTIONS, NOT FOOD, NOT SLEEP. IF YOU'RE TAINTED, STOP GETTING HIT.",
      "MIND HORRORS HURT YOUR HEAD JUST BY FLOATING NEAR YOU. STOMP THEM OR KEEP YOUR DISTANCE. DON'T STAND AND CHAT.",
      "DANGER DINGOES TELEGRAPH THEIR CHARGE. JUMP IT. THEN PUNCH THE DOG IN THE ASS WHILE IT'S SKIDDING.",
      "YOUR JUGS LEAVE BLUE FIRE ON THE FLOOR. MOBS BURN IN IT. YOU DON'T. DROP ONE AND LET THEM WALK INTO IT.",
      "THE VIEWERS ARE LIVE NOW. COMBOS GET YOU FOLLOWERS. FOLLOWERS GET YOU FAN BOXES. KEEP THE HITS COMING.",
      "PET BISCUITS. COLLECT THEM. ANIMALS GO STUPID FOR THEM. SO DOES THE CAT. DON'T LET HER SEE WHERE YOU KEEP THEM.",
      "THAT RAGE ELEMENTAL CAN'T BE KILLED BY YOU. NOT AT YOUR LEVEL. NOT AT ANY LEVEL YOU'LL SEE THIS YEAR. OUTRUN IT.",
      "BOSSES ARE SUPPOSED TO STAY IN THEIR ROOMS. SUPPOSED TO. DON'T COUNT ON IT ON THIS FLOOR.",
      "THE NEW DINOSAUR BITES MOBS. IT ALSO BITES THE CAT. LET THEM WORK IT OUT. DON'T GET YOUR HAND IN THERE.",
      "ON THE THIRD FLOOR YOU PICK A RACE AND A CLASS. DON'T PANIC-PICK. TALK TO ME FIRST. I'VE SEEN A LOT OF BAD PICKS."
    ]
  };
  D.mordecai = D.mordecaiByFloor[1].concat(D.mordecaiByFloor[2]);
  // the Mordecai rooms carry their floor's tips (ui reads safeRooms[id].tips)
  if (D.safeRooms) {
    ['guild', 'guild2'].forEach(function (k) { if (D.safeRooms[k]) D.safeRooms[k].tips = D.mordecaiByFloor[1]; });
    if (D.safeRooms.bugaboo) D.safeRooms.bugaboo.tips = D.mordecaiByFloor[2];
  }

  D.shopkeeper = { name: 'TALLY', title: 'BOPCA PROTECTOR', lines: [
    "HELLO. YOU BUY. I SELL. GOOD.",
    "POTION IS RED. RED IS GOOD. DRINK.",
    "NO SHOES. SORRY. EVERY DAY I ASK. NO SHOES.",
    "DYNAMITE. NOT INSIDE. PLEASE. I JUST MOP.",
    "PRINCESS WANT MORE PATE? I MAKE. ALWAYS I MAKE.",
    "NO GOLD? THEN NO. SORRY. RULES.",
    "YOU COME BACK. I COOK. GOOD."
  ] };

  D.story = {
    // the prologue and the epilogue are cutscenes (D.cutscenes.prologue / f2_descent)
    intro: [
      { text: "THE COLDEST NIGHT OF THE YEAR. A MAN IN BOXERS. A CAT ON A CAR. AND THEN THE BUILDINGS SANK.", portrait: null }
    ],
    endingPages: [
      { text: "THE ROYAL COURT OF PRINCESS DONUT: ONE MAN IN BOXERS, ONE CHAMPION PERSIAN, AND ONE BABY DINOSAUR WHO BITES.", portrait: 'p_donut' },
      { text: "TWO FLOORS DOWN. SIXTEEN TO GO. THE GALAXY IS WATCHING NOW, AND IT LIKES WHAT IT SEES. THAT IS NOT GOOD NEWS.", portrait: 'p_ai' }
    ],
    teaser: "CARL AND DONUT WILL RETURN IN CARL'S DOOMSDAY SCENARIO",
    credits: [
      "DUNGEON CRAWLER CARL: BOOK ONE",
      "AN 8-BIT FAN GAME",
      "BASED ON DUNGEON CRAWLER CARL",
      "BY MATT DINNIMAN",
      "A PERSONAL FAN PROJECT. NOT FOR SALE.",
      "NOT AFFILIATED WITH OR ENDORSED BY",
      "THE AUTHOR OR HIS PUBLISHERS.",
      "GO READ THE BOOKS. THEY ARE BETTER.",
      "",
      "STARRING",
      "CARL",
      "PRINCESS DONUT",
      "",
      "WITH",
      "MORDECAI",
      "TALLY AND QWIST",
      "RORY AND LORELAI",
      "FRANK Q AND MAGGIE MY",
      "MEADOW LARK: IMANI, BRANDON, CHRIS,",
      "YOLANDA, ELLE, AGATHA AND THE RESIDENTS",
      "LEXIS AND ODETTE",
      "ZEV",
      "THE MAESTRO",
      "AND MONGO",
      "",
      "IN MEMORY OF YOLANDA MARTINEZ",
      "",
      "THE SYSTEM AI AS ITSELF",
      "ALL ART DRAWN IN CODE",
      "ALL MUSIC MADE OF BEEPS",
      "NO TUTORIAL RATS WERE SPARED",
      "",
      "THANK YOU FOR CRAWLING"
    ]
  };

  // fan ranks (floor 2 turns the viewers on)
  D.titles = [
    { views: 0, name: 'NOBODY' },
    { views: 300, name: 'BACKGROUND CORPSE' },
    { views: 1500, name: 'THE GUY WITH THE CAT' },
    { views: 5000, name: 'BOXER SHORTS GUY' },
    { views: 12000, name: 'CULT FAVORITE' },
    { views: 30000, name: 'FAN FAVORITE' },
    { views: 70000, name: 'TRENDING CRAWLER' },
    { views: 150000, name: 'PRIME TIME' },
    { views: 300000, name: 'ROYAL COURT MATERIAL' },
    { views: 600000, name: 'GALACTIC SENSATION' },
    { views: 1000000, name: 'BIGGER THAN THE CAT' }
  ];
})();

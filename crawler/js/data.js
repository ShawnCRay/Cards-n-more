/* ==========================================================================
   DCW DATA - all game content as plain data under DCW.data (owner: content)
   Schema is the "Data contract" in crawler/DESIGN.md. Validate with:
     node crawler/tools/data_validate.js        (structure, maps, chunks, text)
     node crawler/tools/data_render.js f3_s1    (ASCII render of a stage)

   OPTIONAL SCHEMA ADDITIONS (all safe to ignore):
   - enemies[id].tier: the floor the enemy's base stats are balanced for.
   - DCW.data.floorScale[n-1] = {hp, dmg, xp, gold} multipliers per floor, and
     DCW.data.enemyFor(id, floor) -> shallow copy of the enemy with hp/dmg/xp/gold
     scaled from its home `tier` to `floor` (never scales down). Gameplay may use
     it so a floor-1 bat is still a threat when it shows up on floor 7.
   - stages[id].owMarker: overworld marker sprite for the entrance
     ('ow_door' | 'ow_manhole' | 'ow_tent' | 'ow_cave'). Boss/safe/stairs use
     the fixed ow_boss / ow_safe / ow_stairs markers.
   - stages[id].reward.box may be absent (ambush stages give only xp).
   - lootTables[tier].guaranteed: [reward, ...] always granted on top of the
     rolls (legendary always has a cosmetic, boss always has a potion).
   - shop give kinds beyond the Reward list: {kind:'revival', count} adds run
     revivals; {kind:'box', tier} adds an unopened loot box to run.boxes.
   - skins[id].perk keys: dmg (+flat damage), def (+flat damage reduction),
     hp (+max hp), speed (+move multiplier, e.g. 0.1), gold / views (+multiplier,
     e.g. 0.2), bombs (+bombs at floor start), doubleJump (true).
   - companions[id].special.time: seconds the special lasts (0 = instant).
   - bosses[id].final: true on the last boss (beating it wins the game).
   - achievements[id].unlock: {skin:id} | {companion:id} granted with the box.
   - companions[id].bonus {views} (zev) / bombChance (squeaks): ability tuning hints.
   - boxTiers[tier].rank (1-5) for sorting; projectiles.missile (friendly:true)
     for Donut; D.version, D.themes, D.owThemes are informational.
   UPDATE 2 (quests, rescues, levers; binding spec in DESIGN.md):
   - D.questItems[id] = {name, floor, sprite:'qi_*', desc, hint}. hint says where
     the item is (shown on padlocked exit doors).
   - stages[id].questItem / .rescue / .exitNeeds, stages[id].chunks.insert:
     chunk ids spliced into the middle of the generated list (data_render.js
     assumes after start + floor(count/2) picks). Q and R only appear in insert
     chunks, never in pool chunks, so each stage has exactly one.
   - floor.locks[ch] = {needs, text}: text is optional flavor (<= 100 chars).
   - floor.companion (floors 2-7), floor.hints (Mordecai rumors, 3-5 lines).
   - companions[id].rescueLines: 1-2 lines said when freed from the cage/egg.
   - No companion rewards in loot tables, no companion boss/achievement unlocks.
   - Chunk chars S (lever, on ground) and L (gate, solid until any S in the
     same chunk is punched). lv_* chunks are general lever puzzles in pools.
     node crawler/tools/data_render.js --chain prints every floor's chain.
   Chunk notes: moving platforms '<' '>' 'v' are ONE char each, placed on the
   platform's starting (center) tile, with >= 3 free tiles of travel each way
   ('<' starts moving left, '>' right, 'v' down). Arena chunks (with 'K') are
   open on the left (rows 5-9) and walled on the right.
   Balance targets (see data_render.js --balance, assumes ~all kills, side
   areas done, ~2 ambushes per floor): enter F2 at ~L3, F4 ~L8, F9 ~L19, finish
   ~L21. Regular enemies take 2-4 punches at that level; bosses ~40-55 punches.
   Spawned adds (boss spawn:, cultist) are extra xp on top.
   UPDATE 3 (floor 10 races, floor 11 parade; binding spec in DESIGN.md):
   - D.racers[id] = {name, title, vehicle, sprite:'racer_<id>', portrait:'p_racer_<id>',
     speed, accel, hp, aggression 0..1, weapon: projectile id|null, skill 0..1,
     lines: [trash talk], boss?: true}. ids: goblin_bike skull_chariot
     beetle_mount steam_buggy champion (champion = the boss racer).
   - D.truck = {name, sprite:'truck', speed:170, accel:140, hp:30}. Truck upgrades
     are quest items with a `truck` field ({hp}|{speed}|{mines:true}); float parts
     are quest items with a `float` field ('confetti'|'spotlight'|'balloons'|'banner').
   - stages kind 'race': theme 'raceway', race:{rivals:[ids], place:N[, boss:id]}.
     Race chunks are named race_*; only they use r Z J O F. Rivals take the start
     chunk's r spots in reading order (left to right). One F in race_finish.
     Design rules (truck ~170 px/s; a held jump flies ~7 tiles and ~3.5 up; a J pad
     launch ~7+ tiles even when jump is not held): plain gaps <= 4 tiles, 5 tile gaps
     have a J pad right at the edge, overpasses '=' sit at row 7 (3 above the road,
     2 free rows under them) and are entered from a J pad, crates 'b' are single
     and get rammed, no oil within 9 tiles before a gap (a spin-out cannot jump).
     Checked by data_validate.js (truck reach), data3_race_sim.js (truck physics)
     and data3_race_play.js (the real engine, playwright).
     race_q_billboard holds a Q on its overpass (heat 2 truck upgrade).
   - stages kind 'parade': theme 'parade', boss, parade:{speed, waves:[[enemy,w]]};
     parade_* street chunks then arena_marshal (K). Floor 9's showrunner is no
     longer final: bosses.grand_marshal.final = true (ending + gold skin there).
   - floor.locks[ch] = {needs:'id'} | {needs:['id',...]} (all required) |
     {afterCleared:'stageId'}. floor.overworld.npcs = [{racer, x, y, lines}].
     Floor 11 has no stairs X. owMarker 'ow_garage' (race) / 'ow_float' (parade).
   - floorScale has 11 entries; enemyFor clamps to its length.
   ========================================================================== */
(function () {
  'use strict';
  var DCW = window.DCW = window.DCW || {};
  var D = DCW.data = DCW.data || {};

  D.version = 1;

  D.themes = ['sewer', 'cave', 'city', 'circus', 'swamp', 'train', 'bubble', 'forest', 'castle', 'ruin', 'ghosttown', 'ghostmine', 'warzone', 'safe', 'raceway', 'parade', 'tunnels', 'cinder'];
  D.owThemes = ['ow_city', 'ow_rail', 'ow_reef', 'ow_woods', 'ow_manor', 'ow_waste', 'ow_town', 'ow_war', 'ow_suburb', 'ow_parade'];

  /* ---------------- enemy scaling (optional helper) ----------------
     Index = floor-1. hp tracks expected punch damage at that floor's natural
     level; dmg tracks expected max hp; xp tracks the level curve. */
  D.floorScale = [
    { hp: 1.0, dmg: 1.0, xp: 1.0, gold: 1.0 },
    { hp: 1.8, dmg: 1.4, xp: 1.8, gold: 1.4 },
    { hp: 2.5, dmg: 1.8, xp: 2.2, gold: 1.8 },
    { hp: 3.4, dmg: 2.2, xp: 2.5, gold: 2.2 },
    { hp: 4.5, dmg: 2.7, xp: 3.1, gold: 2.6 },
    { hp: 5.4, dmg: 3.1, xp: 3.7, gold: 3.0 },
    { hp: 6.3, dmg: 3.5, xp: 5.1, gold: 3.4 },
    { hp: 7.0, dmg: 3.9, xp: 5.5, gold: 3.8 },
    { hp: 8.2, dmg: 4.4, xp: 5.8, gold: 4.2 },
    { hp: 9.0, dmg: 4.8, xp: 6.2, gold: 4.6 },
    { hp: 9.8, dmg: 5.2, xp: 6.6, gold: 5.0 }
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
     Balance: floor N regular enemy ~2-4 punches at the natural level
     (punch dmg F1 2, F2 4, F3 5-6, F4 7-8, F5 10, F6 12, F7 14, F8 15-16, F9 18).
     Contact dmg ~ maxHp/10. xp tuned for ~L3-4 by F2, ~L8 by F4, ~L20 by F9. */
  D.enemies = {
    /* floor 1 */
    rat: { name: 'TUTORIAL RAT', tier: 1, hp: 3, dmg: 1, speed: 28, w: 12, h: 8, ai: 'walker',
      xp: 1, gold: [0, 1], sprite: 'rat', kb: 1.2,
      flavor: "A RAT. IN A SEWER. GROUNDBREAKING. IT HAS SEEN THINGS AND IT WANTS TO SHOW YOU." },
    roach: { name: 'SEWER ROACH', tier: 1, hp: 2, dmg: 1, speed: 48, w: 10, h: 6, ai: 'walker',
      xp: 1, gold: [0, 1], sprite: 'roach', kb: 1.4,
      flavor: "SURVIVED THREE APOCALYPSES. WILL NOT SURVIVE YOUR FOOT. PROBABLY." },
    goblin: { name: 'GOBLIN GRUNT', tier: 1, hp: 6, dmg: 1, speed: 40, w: 12, h: 16, ai: 'chaser',
      aggro: 110, xp: 3, gold: [1, 3], sprite: 'goblin',
      flavor: "SMALL, GREEN, AND DEEPLY OFFENDED BY YOUR PANTS SITUATION." },
    bat: { name: 'DRIP BAT', tier: 1, hp: 3, dmg: 1, speed: 50, w: 12, h: 10, ai: 'flyer', flying: true,
      xp: 1, gold: [0, 1], sprite: 'bat',
      flavor: "FLAPS AT FACE HEIGHT ON PURPOSE. NOBODY KNOWS WHY. NOBODY LIKES IT." },

    /* floor 2 */
    goblin_archer: { name: 'GOBLIN ARCHER', tier: 2, hp: 9, dmg: 2, speed: 34, w: 12, h: 16, ai: 'shooter',
      projectile: 'arrow', shootEvery: 2.4, aggro: 150, xp: 4, gold: [1, 4], sprite: 'goblin_archer',
      flavor: "FAILED ARCHERY SCHOOL TWICE. STILL BETTER AT IT THAN YOU ARE AT DODGING." },
    goblin_brute: { name: 'GOBLIN BRUTE', tier: 2, hp: 26, dmg: 2, speed: 36, w: 18, h: 22, ai: 'charger',
      chargeSpeed: 150, aggro: 130, armor: 1, kb: 0.4, xp: 13, gold: [4, 9], sprite: 'goblin_brute',
      flavor: "HIS NECK IS WIDER THAN HIS HEAD. THIS IS NOT A COMPLIMENT, AND ALSO IT IS." },
    grub: { name: 'CAVE GRUB', tier: 2, hp: 6, dmg: 1, speed: 18, w: 12, h: 8, ai: 'walker',
      xp: 2, gold: [0, 2], sprite: 'grub', kb: 1.2,
      flavor: "SQUISHY. SLOW. DELICIOUS, ACCORDING TO GOBLINS. DO NOT ASK GOBLINS ABOUT FOOD." },
    shaman: { name: 'GOBLIN SHAMAN', tier: 2, hp: 12, dmg: 2, speed: 26, w: 12, h: 18, ai: 'shooter',
      projectile: 'fireball', shootEvery: 2.8, aggro: 160, xp: 7, gold: [2, 6], sprite: 'shaman',
      flavor: "TOOK ONE ONLINE COURSE IN FIRE MAGIC. PASSED. BARELY. AIMS FOR THE BOXERS." },
    juicer_minion: { name: 'JUICED GOBLIN', tier: 2, hp: 15, dmg: 2, speed: 46, w: 16, h: 20, ai: 'chaser',
      aggro: 140, jump: 200, xp: 6, gold: [2, 5], sprite: 'juicer_minion',
      flavor: "SKIPS LEG DAY. SKIPS EVERY DAY THAT IS NOT CHEST DAY. VEINS HAVE VEINS." },

    /* floor 3 */
    clown: { name: 'HOBO CLOWN', tier: 3, hp: 15, dmg: 2, speed: 40, w: 14, h: 20, ai: 'jumper',
      jump: 230, aggro: 140, xp: 5, gold: [2, 6], sprite: 'clown',
      flavor: "HONKS WHEN HIT. HONKS WHEN SAD. HONKS AT NIGHT. NOBODY SLEEPS ON FLOOR THREE." },
    clown_brute: { name: 'STRONGMAN CLOWN', tier: 3, hp: 42, dmg: 3, speed: 34, w: 20, h: 24, ai: 'hopper',
      jump: 260, aggro: 150, armor: 1, kb: 0.3, xp: 18, gold: [6, 14], sprite: 'clown_brute',
      flavor: "THE DUMBBELL IS PAINTED FOAM. THE FIST IS NOT. LEARN THE DIFFERENCE FAST." },
    skyfowl: { name: 'SKYFOWL', tier: 3, hp: 12, dmg: 2, speed: 62, w: 16, h: 12, ai: 'flyer', flying: true,
      xp: 5, gold: [1, 4], sprite: 'skyfowl',
      flavor: "A PIGEON THAT GOT INTO THE LOOT. NOW IT HAS TALONS AND OPINIONS." },
    swamp_troll: { name: 'SWAMP TROLL', tier: 3, hp: 38, dmg: 3, speed: 30, w: 20, h: 24, ai: 'chaser',
      aggro: 120, armor: 1, kb: 0.3, xp: 16, gold: [5, 12], sprite: 'swamp_troll',
      flavor: "SMELLS LIKE A GYM BAG LEFT IN A POND. BECAUSE THAT IS WHAT HE IS, MOSTLY." },
    gator: { name: 'BOG GATOR', tier: 3, hp: 18, dmg: 3, speed: 34, w: 22, h: 10, ai: 'charger',
      chargeSpeed: 170, aggro: 120, xp: 7, gold: [2, 6], sprite: 'gator',
      flavor: "ALL MOUTH, NO MANNERS. HAS NEVER ONCE SAID SEE YOU LATER." },

    /* floor 4 */
    steam_goblin: { name: 'STEAM GOBLIN', tier: 4, hp: 22, dmg: 3, speed: 34, w: 14, h: 18, ai: 'bomber',
      projectile: 'bottle', shootEvery: 2.6, aggro: 160, xp: 6, gold: [3, 8], sprite: 'steam_goblin',
      flavor: "BUILT HIS OWN BACKPACK BOILER. IT LEAKS. HE THROWS THE LEAKS AT YOU." },
    conductor: { name: 'THE CONDUCTOR', tier: 4, hp: 52, dmg: 3, speed: 36, w: 16, h: 22, ai: 'charger',
      chargeSpeed: 190, aggro: 170, armor: 1, kb: 0.3, xp: 17, gold: [8, 16], sprite: 'conductor',
      flavor: "TICKETS, PLEASE. NO TICKET? THEN YOU ARE THE TICKET. PUNCHED. HARD." },
    rail_rat: { name: 'RAIL RAT', tier: 4, hp: 18, dmg: 3, speed: 52, w: 14, h: 10, ai: 'jumper',
      jump: 210, aggro: 130, xp: 5, gold: [2, 5], sprite: 'rail_rat',
      flavor: "A RAT THAT LIVES ON TRAINS. FASTER THAN YOUR RAT. ANGRIER THAN YOUR RAT." },

    /* floor 5 */
    fishman: { name: 'DEEP FISHMAN', tier: 5, hp: 30, dmg: 3, speed: 42, w: 14, h: 20, ai: 'chaser',
      aggro: 140, jump: 220, xp: 7, gold: [3, 9], sprite: 'fishman',
      flavor: "HALF FISH, HALF MAN, ALL CARDIO. MOIST HANDSHAKE. AVOID THE HANDSHAKE." },
    jelly: { name: 'STING JELLY', tier: 5, hp: 22, dmg: 3, speed: 30, w: 14, h: 14, ai: 'flyer', flying: true,
      xp: 6, gold: [2, 7], sprite: 'jelly',
      flavor: "FLOATS. GLOWS. STINGS. HAS NO BRAIN AND IS STILL WINNING AGAINST YOU." },
    crab: { name: 'CHROME CRAB', tier: 5, hp: 64, dmg: 4, speed: 30, w: 18, h: 12, ai: 'walker',
      armor: 2, kb: 0.3, xp: 17, gold: [8, 18], sprite: 'crab',
      flavor: "ARMORED. SIDEWAYS. FURIOUS. KICK IT FROM ABOVE, THE SHELL IS ALL BRAG." },

    /* floor 6 */
    hunter: { name: 'TROPHY HUNTER', tier: 6, hp: 34, dmg: 4, speed: 36, w: 14, h: 20, ai: 'shooter',
      projectile: 'arrow', shootEvery: 2.0, aggro: 180, xp: 9, gold: [4, 10], sprite: 'hunter',
      flavor: "PAID A LOT OF MONEY TO SHOOT YOU. WOULD LIKE A REFUND. DO NOT GIVE HIM ONE." },
    hound: { name: 'BLOOD HOUND', tier: 6, hp: 30, dmg: 4, speed: 50, w: 20, h: 12, ai: 'charger',
      chargeSpeed: 210, aggro: 170, xp: 8, gold: [3, 8], sprite: 'hound',
      flavor: "GOOD BOY. NOT YOUR GOOD BOY. SOMEBODY ELSE'S VERY BAD GOOD BOY." },
    masked_noble: { name: 'MASKED NOBLE', tier: 6, hp: 90, dmg: 5, speed: 40, w: 14, h: 22, ai: 'shooter',
      projectile: 'knife', shootEvery: 1.8, aggro: 170, armor: 2, kb: 0.3, xp: 26, gold: [12, 24], sprite: 'masked_noble',
      flavor: "OLD MONEY, NEW KNIVES. CONSIDERS YOU A SPORTING INCONVENIENCE." },

    /* floor 7 */
    ghoul: { name: 'MANOR GHOUL', tier: 7, hp: 42, dmg: 4, speed: 40, w: 14, h: 20, ai: 'chaser',
      aggro: 140, xp: 11, gold: [4, 10], sprite: 'ghoul',
      flavor: "USED TO BE THE BUTLER. STILL DOES THE DISHES. THE DISHES ARE CRAWLERS NOW." },
    gargoyle: { name: 'GARGOYLE', tier: 7, hp: 40, dmg: 5, speed: 54, w: 18, h: 16, ai: 'flyer', flying: true,
      armor: 2, xp: 12, gold: [4, 11], sprite: 'gargoyle',
      flavor: "SPENT FOUR HUNDRED YEARS ON A ROOF FROWNING. NOW IT GETS TO FROWN AT YOU UP CLOSE." },
    skeleton: { name: 'BONE THROWER', tier: 7, hp: 34, dmg: 4, speed: 34, w: 12, h: 20, ai: 'bomber',
      projectile: 'rock', shootEvery: 2.2, aggro: 170, xp: 10, gold: [3, 9], sprite: 'skeleton',
      flavor: "THROWS HIS OWN BONES. ALWAYS HAS SPARES. DO NOT ASK WHERE THE SPARES COME FROM." },

    /* floor 8 (the old ruin set; floor 8 now uses the folklore set below, floors 9 and 10 still use these) */
    mutant: { name: 'RUIN MUTANT', tier: 8, hp: 50, dmg: 5, speed: 44, w: 18, h: 22, ai: 'chaser',
      aggro: 150, jump: 210, xp: 12, gold: [5, 12], sprite: 'mutant',
      flavor: "THREE ARMS. TWO OPINIONS. ONE GOAL: HUGGING YOU UNTIL YOU POP." },
    drone: { name: 'SURVEY DRONE', tier: 8, hp: 34, dmg: 4, speed: 60, w: 14, h: 10, ai: 'flyer', flying: true,
      projectile: 'laser_orb', shootEvery: 3.0, aggro: 180, xp: 10, gold: [4, 10], sprite: 'drone',
      flavor: "FILMING YOU FOR THE HIGHLIGHT REEL. ALSO SHOOTING YOU. MULTITASKER." },
    golem: { name: 'SCRAP GOLEM', tier: 8, hp: 130, dmg: 6, speed: 26, w: 22, h: 24, ai: 'hopper',
      jump: 250, aggro: 150, armor: 3, kb: 0.1, xp: 32, gold: [14, 28], sprite: 'golem',
      flavor: "MADE OF CARS, FRIDGES AND ONE VERY CONFUSED VENDING MACHINE. STILL SELLS SODA." },
    // floor 8 retheme (THE GHOSTS OF EARTH): Appalachian folklore, seeded into a West Virginia
    // river town on December 10th. Same stat lines and AI as the ruin set they replace.
    wampus_cat: { name: 'WAMPUS CAT', tier: 8, hp: 50, dmg: 5, speed: 44, w: 18, h: 18, ai: 'chaser',
      aggro: 150, jump: 210, xp: 12, gold: [5, 12], sprite: 'wampus_cat',
      flavor: "HALF WOMAN, HALF MOUNTAIN LION, ALL ATTITUDE. DONUT HAS ASKED ME TO SAY SHE IS NOT IMPRESSED." },
    mountain_light: { name: 'BROWN MOUNTAIN LIGHT', tier: 8, hp: 34, dmg: 4, speed: 60, w: 14, h: 12, ai: 'flyer', flying: true,
      projectile: 'laser_orb', shootEvery: 3.0, aggro: 180, xp: 10, gold: [4, 10], sprite: 'mountain_light',
      flavor: "A FLOATING LIGHT OVER THE RIDGE. SCIENTISTS SAID SWAMP GAS. THE SWAMP GAS HAS A FACE. IT BITES." },
    woodbooger: { name: 'WOODBOOGER', tier: 8, hp: 130, dmg: 6, speed: 26, w: 22, h: 26, ai: 'hopper',
      jump: 250, aggro: 150, armor: 3, kb: 0.1, xp: 32, gold: [14, 28], sprite: 'woodbooger',
      flavor: "THE LOCAL BIGFOOT. NINE FEET OF HAIR AND ZERO PHOTOS IN FOCUS. LANDS LIKE A DROPPED PIANO." },
    sheepsquatch: { name: 'SHEEPSQUATCH', tier: 8, hp: 42, dmg: 5, speed: 46, w: 20, h: 18, ai: 'charger',
      chargeSpeed: 200, aggro: 170, xp: 10, gold: [4, 10], sprite: 'sheepsquatch',
      flavor: "A WOOLLY WHITE BEAST WITH RAM HORNS AND A BAD TEMPER. NOBODY HAS EVER SUCCESSFULLY SHEARED IT." },
    mothling: { name: 'MOTHLING', tier: 8, hp: 26, dmg: 4, speed: 64, w: 16, h: 12, ai: 'flyer', flying: true,
      aggro: 170, xp: 8, gold: [3, 8], sprite: 'mothling',
      flavor: "A MOTH THE SIZE OF A TURKEY. DRAWN TO LIGHT. YOU ARE WEARING A VERY SHINY JACKET." },

    /* floor 9 */
    soldier: { name: 'FACTION SOLDIER', tier: 9, hp: 54, dmg: 5, speed: 40, w: 14, h: 20, ai: 'shooter',
      projectile: 'bolt', shootEvery: 1.8, aggro: 180, xp: 12, gold: [6, 14], sprite: 'soldier',
      flavor: "SIGNED UP FOR GLORY. GOT A HELMET THAT DOES NOT FIT AND YOU." },
    sniper: { name: 'ROOF SNIPER', tier: 9, hp: 40, dmg: 6, speed: 0, w: 14, h: 20, ai: 'turret',
      projectile: 'laser_orb', shootEvery: 2.4, aggro: 240, xp: 12, gold: [6, 14], sprite: 'sniper',
      flavor: "HAS NOT MOVED IN NINE HOURS. HAS A JAR. DO NOT THINK ABOUT THE JAR." },
    war_beast: { name: 'WAR BEAST', tier: 9, hp: 150, dmg: 7, speed: 36, w: 24, h: 18, ai: 'charger',
      chargeSpeed: 220, aggro: 190, armor: 3, kb: 0.1, xp: 34, gold: [16, 32], sprite: 'war_beast',
      flavor: "SOMEBODY PUT ARMOR ON A RHINO AND TOLD IT YOU INSULTED ITS MOTHER." },
    cultist: { name: 'SHOW CULTIST', tier: 9, hp: 46, dmg: 5, speed: 0, w: 14, h: 22, ai: 'spawner',
      spawn: 'skeleton', spawnEvery: 5, aggro: 200, xp: 13, gold: [6, 14], sprite: 'cultist',
      flavor: "WORSHIPS THE RATINGS. CHANTS THE SPONSOR NAMES. SUMMONS BONY BACKUP DANCERS." }
  };

  /* ---------------- projectiles ---------------- */
  D.projectiles = {
    arrow:     { sprite: 'arrow',     w: 8, h: 3, speed: 150, dmg: 1, gravity: 0,   life: 3 },
    rock:      { sprite: 'rock',      w: 6, h: 6, speed: 120, dmg: 1, gravity: 360, life: 3 },
    fireball:  { sprite: 'fireball',  w: 8, h: 8, speed: 110, dmg: 2, gravity: 0,   life: 3 },
    bubble:    { sprite: 'bubble',    w: 8, h: 8, speed: 60,  dmg: 1, gravity: -20, life: 4.5 },
    bolt:      { sprite: 'bolt',      w: 8, h: 4, speed: 200, dmg: 2, gravity: 0,   life: 2.5 },
    bottle:    { sprite: 'bottle',    w: 6, h: 8, speed: 120, dmg: 2, gravity: 380, life: 3 },
    laser_orb: { sprite: 'laser_orb', w: 7, h: 7, speed: 130, dmg: 2, gravity: 0,   life: 3.5 },
    knife:     { sprite: 'knife',     w: 8, h: 3, speed: 180, dmg: 2, gravity: 0,   life: 2.5 },
    spore:     { sprite: 'spore',     w: 6, h: 6, speed: 50,  dmg: 1, gravity: 30,  life: 5 },
    note:      { sprite: 'note',      w: 7, h: 8, speed: 100, dmg: 1, gravity: 0,   life: 3.5 },
    missile:   { sprite: 'missile',   w: 8, h: 4, speed: 220, dmg: 2, gravity: 0,   life: 2, friendly: true }
  };

  /* ---------------- bosses ----------------
     hp ~ 40x the expected punch damage at that point; 45-90 s fights.
     Projectile dmg in bosses' attacks uses the projectile table; contact uses boss dmg. */
  D.bosses = {
    hoarder: { name: 'THE HOARDER', title: 'MOTHER OF A THOUSAND ROACHES',
      hp: 120, dmg: 2, w: 48, h: 32, sprite: 'hoarder', xp: 45, gold: [40, 70], flying: false,
      phases: [
        { below: 1.0, speed: 34, pattern: ['walk:2', 'charge', 'idle:1.2', 'spawn:roach:2', 'walk:1.5', 'jump_slam', 'idle:1.4'] },
        { below: 0.5, speed: 48, pattern: ['charge', 'idle:0.8', 'rain:rock:5', 'spawn:roach:3', 'jump_slam', 'idle:1', 'charge', 'idle:0.8'] }
      ],
      intro: ["OUR FIRST BOSS! SHE HAS NOT THROWN ANYTHING AWAY SINCE 1987, INCLUDING HER FEELINGS.",
        "SHE IS GUARDING A PILE OF CRAP AND SHE WILL DIE FOR IT. LET'S HELP HER WITH THAT."],
      defeat: "THE HOARDER IS DOWN! HER COLLECTION OF EMPTY YOGURT CUPS WILL BE AUCTIONED FOR CHARITY.",
      loot: 'boss', unlock: { skin: 'carl_jacket' } },

    juicer: { name: 'THE JUICER', title: 'GOBLIN KING OF GAINS',
      hp: 200, dmg: 2, w: 40, h: 40, sprite: 'juicer', xp: 85, gold: [70, 110], flying: false,
      phases: [
        { below: 1.0, speed: 44, pattern: ['walk:1.5', 'charge', 'idle:1', 'shoot:bottle:3', 'walk:1', 'jump_slam', 'idle:1.2'] },
        { below: 0.6, speed: 58, pattern: ['charge', 'charge', 'idle:0.8', 'spawn:juicer_minion:2', 'jump_slam', 'shockwave', 'idle:1'] },
        { below: 0.25, speed: 72, pattern: ['charge', 'shockwave', 'jump_slam', 'shockwave', 'rain:bottle:6', 'idle:0.8'] }
      ],
      intro: ["HE BENCHES GOBLINS. HE CURLS GOBLINS. HE HAS NEVER ONCE STRETCHED.",
        "CRAWLER, PLEASE WELCOME THE JUICER! HIS PROTEIN SHAKE IS MOSTLY LIGHTER FLUID!"],
      defeat: "THE JUICER HAS TAPPED OUT! SOMEBODY PLEASE SPOT HIM. NO? FAIR.",
      loot: 'boss', unlock: null },

    ringmaster: { name: 'THE RINGMASTER', title: 'MASTER OF THE MIDWAY',
      hp: 280, dmg: 3, w: 32, h: 44, sprite: 'ringmaster', xp: 120, gold: [100, 150], flying: false,
      phases: [
        { below: 1.0, speed: 50, pattern: ['walk:1.5', 'spread:note:5', 'idle:1', 'spawn:clown:2', 'teleport', 'shoot:knife:3', 'idle:1.2'] },
        { below: 0.5, speed: 66, pattern: ['teleport', 'spread:note:7', 'summon_spikes', 'spawn:clown:2', 'teleport', 'rain:bottle:6', 'charge', 'idle:0.8'] }
      ],
      intro: ["LADIES, GENTLEMEN, AND THINGS WITH TOO MANY TEETH! THE GREATEST SHOW UNDER THE GROUND!",
        "THE RINGMASTER HAS TAMED LIONS, CLOWNS, AND ONE TAX AUDITOR. YOU ARE NEXT ON THE BILL."],
      defeat: "THE SHOW IS OVER! THE CLOWNS ARE UNIONIZING! SOMEBODY GRAB THE HAT!",
      loot: 'boss', unlock: { skin: 'carl_clown' } },

    engineer: { name: 'THE ENGINEER', title: 'IRON HEART OF THE TANGLE',
      hp: 360, dmg: 3, w: 56, h: 40, sprite: 'engineer', xp: 150, gold: [140, 200], flying: false,
      phases: [
        { below: 1.0, speed: 40, pattern: ['walk:2', 'charge', 'idle:1', 'spawn:steam_goblin:2', 'shoot:bolt:3', 'laser', 'idle:1.2'] },
        { below: 0.55, speed: 58, pattern: ['charge', 'shockwave', 'laser', 'rain:bottle:6', 'charge', 'spawn:rail_rat:3', 'idle:0.8'] }
      ],
      intro: ["ALL ABOARD! THE ENGINEER IS HALF GOBLIN, HALF LOCOMOTIVE, AND ZERO PERCENT ON SCHEDULE.",
        "HE HAS NOT STOPPED FOR A PASSENGER IN SIX HUNDRED YEARS. HE IS NOT STARTING WITH YOU."],
      defeat: "THE ENGINEER HAS BEEN DERAILED! DELAYS EXPECTED ON ALL LINES! FOREVER!",
      loot: 'boss', unlock: null },

    tidemother: { name: 'THE TIDEMOTHER', title: 'QUEEN OF THE SEA QUADRANT',
      hp: 440, dmg: 4, w: 56, h: 48, sprite: 'tidemother', xp: 195, gold: [180, 260], flying: false,
      phases: [
        { below: 1.0, speed: 36, pattern: ['walk:1.5', 'spread:bubble:5', 'idle:1', 'spawn:jelly:2', 'summon_spikes', 'shoot:bubble:4', 'idle:1.2'] },
        { below: 0.5, speed: 50, pattern: ['spread:bubble:8', 'laser', 'spawn:fishman:2', 'rain:bubble:8', 'shockwave', 'summon_spikes', 'idle:0.8'] }
      ],
      intro: ["SHE HAS SEVEN HUNDRED CHILDREN AND SHE HAS NAMED NONE OF THEM. SHE WILL NOT NAME YOU EITHER.",
        "THE TIDEMOTHER, EVERYBODY! BRING A TOWEL. BRING TWO. BRING A WILL."],
      defeat: "THE TIDEMOTHER IS DOWN! LOW TIDE, BABY! SOMEBODY CALL HER KIDS. ALL OF THEM.",
      loot: 'boss', unlock: { skin: 'carl_hazmat' } },

    butcher: { name: 'THE BUTCHER', title: 'GAMEKEEPER OF THE GROUNDS',
      hp: 520, dmg: 4, w: 40, h: 44, sprite: 'butcher', xp: 240, gold: [220, 320], flying: false,
      phases: [
        { below: 1.0, speed: 46, pattern: ['walk:1.5', 'charge', 'shoot:knife:3', 'idle:0.9', 'spawn:hound:2', 'jump_slam', 'idle:1.1'] },
        { below: 0.6, speed: 60, pattern: ['charge', 'spread:knife:5', 'jump_slam', 'shockwave', 'spawn:hunter:1', 'charge', 'idle:0.8'] },
        { below: 0.25, speed: 74, pattern: ['charge', 'charge', 'rain:knife:8', 'jump_slam', 'shockwave', 'spread:knife:7', 'idle:0.6'] }
      ],
      intro: ["THE HUNT IS OVER, CRAWLER. THE PROCESSING BEGINS. THAT IS HIS JOKE. HE ONLY HAS THE ONE.",
        "THE BUTCHER RUNS THESE GROUNDS FOR RICH PEOPLE WHO WANT YOUR HEAD ON A WALL. SMILE FOR THE TAXIDERMIST!"],
      defeat: "THE BUTCHER HAS BEEN, AND I CANNOT STRESS THIS ENOUGH, TENDERIZED!",
      loot: 'boss', unlock: null },

    bride: { name: 'THE BRIDE', title: 'LADY OF THE BEDLAM MANOR',
      hp: 600, dmg: 5, w: 36, h: 48, sprite: 'bride', xp: 340, gold: [260, 360], flying: true,
      phases: [
        { below: 1.0, speed: 52, pattern: ['hover:1.5', 'swoop', 'idle:0.8', 'spread:fireball:5', 'teleport', 'spawn:ghoul:2', 'hover:1.2'] },
        { below: 0.5, speed: 68, pattern: ['teleport', 'laser', 'swoop', 'rain:fireball:8', 'spawn:skeleton:2', 'teleport', 'summon_spikes', 'hover:0.8'] }
      ],
      intro: ["SHE WAS LEFT AT THE ALTAR THREE CENTURIES AGO. SHE HAS BEEN WORKING THROUGH IT. VIOLENTLY.",
        "SPEAK NOW OR FOREVER HOLD YOUR PIECES, CRAWLER. I MEAN THE PIECES SHE IS ABOUT TO MAKE."],
      defeat: "THE BRIDE HAS FINALLY BEEN GIVEN AWAY! TO THE AFTERLIFE! NO REFUNDS ON THE GIFTS!",
      loot: 'boss', unlock: { skin: 'carl_bodyguard' } },

    // floor 8 (THE GHOSTS OF EARTH): replaces the old OVERSEER. Same hp, phases and move set,
    // so the flying boss fight plays the same; spawns moths and wampus cats instead of drones.
    mothman: { name: 'THE MOTHMAN', title: 'HARBINGER OF THE RIVER TOWN',
      hp: 680, dmg: 5, w: 48, h: 40, sprite: 'mothman', xp: 380, gold: [300, 420], flying: true,
      phases: [
        { below: 1.0, speed: 46, pattern: ['hover:1.2', 'laser', 'shoot:laser_orb:4', 'spawn:mothling:2', 'swoop', 'hover:1.2'] },
        { below: 0.6, speed: 60, pattern: ['laser', 'teleport', 'spread:laser_orb:7', 'summon_spikes', 'swoop', 'spawn:wampus_cat:1', 'laser', 'hover:0.8'] },
        { below: 0.3, speed: 74, pattern: ['laser', 'laser', 'rain:laser_orb:10', 'teleport', 'spread:laser_orb:9', 'summon_spikes', 'hover:0.6'] }
      ],
      intro: ["LOCAL LEGEND SAYS IF YOU SEE THE MOTHMAN, SOMETHING TERRIBLE IS ABOUT TO HAPPEN. WELL. LOOK AROUND. HE WAS RIGHT.",
        "TEN FEET OF WINGS AND TWO RED HEADLIGHTS FOR EYES. HE HAS BEEN STARING AT YOUR BEACON ALL NIGHT. DO NOT LOOK DIRECTLY INTO THEM."],
      defeat: "THE MOTHMAN IS DOWN! HE PREDICTED THIS, OBVIOUSLY. HE JUST DID NOT WANT TO BE A DOWNER ABOUT IT.",
      loot: 'boss', unlock: { skin: 'carl_kilt' } },

    // Floor 9's big boss. Since Update 3 he is NOT the end of the game (see grand_marshal).
    showrunner: { name: 'THE SHOWRUNNER', title: 'PRODUCER OF THE APOCALYPSE',
      hp: 950, dmg: 6, w: 48, h: 56, sprite: 'showrunner', xp: 600, gold: [500, 700], flying: false,
      phases: [
        { below: 1.0, speed: 48, pattern: ['walk:1.5', 'spread:note:6', 'teleport', 'spawn:soldier:2', 'shoot:laser_orb:4', 'idle:1', 'laser', 'idle:1'] },
        { below: 0.66, speed: 62, pattern: ['teleport', 'laser', 'rain:fireball:10', 'spawn:war_beast:1', 'summon_spikes', 'spread:note:9', 'charge', 'idle:0.8'] },
        { below: 0.33, speed: 78, pattern: ['teleport', 'laser', 'laser', 'rain:laser_orb:12', 'shockwave', 'summon_spikes', 'spawn:cultist:2', 'jump_slam', 'spread:bolt:11', 'idle:0.6'] }
      ],
      intro: ["WELL, WELL, WELL. THE BAREFOOT BOY AND HIS CAT. YOU WERE SUPPOSED TO BE A FUNNY EPISODE ONE DEATH.",
        "I GREENLIT THIS PLANET. I CAN CANCEL IT. ROLL CAMERA, KILL THE LIGHTS, AND KILL THE CRAWLER.",
        "THIS IS THE MIDSEASON FINALE, CRAWLER! THE RATINGS HAVE NEVER BEEN HIGHER! I AM NOT EVEN MAD ABOUT IT!"],
      defeat: "THE SHOWRUNNER HAS BEEN CANCELLED! THE NETWORK IS SPEECHLESS! THEY JUST ORDERED TWO MORE FLOORS. IMMEDIATELY.",
      loot: 'boss', unlock: null },

    // Floor 11 finale: a towering alien grand marshal on a throne float, with a sash,
    // a giant baton and a confetti habit. Beating him wins the game (gold skin via G.win).
    grand_marshal: { name: 'THE GRAND MARSHAL', title: 'HIGH POOBAH OF THE PROCESSION', final: true,
      hp: 1150, dmg: 7, w: 56, h: 64, sprite: 'grand_marshal', xp: 700, gold: [650, 900], flying: false,
      phases: [
        // baton and brass: marching band blasts, baton lunges, balloon minions, confetti balloons
        { below: 1.0, speed: 44, pattern: ['walk:1.5', 'spread:note:6', 'idle:0.9', 'spawn:jelly:2', 'charge', 'idle:1', 'rain:bubble:8', 'jump_slam', 'idle:1'] },
        // the throne float rolls: spotlight beam, clown honor guard, fireworks, drum stomp
        { below: 0.66, speed: 58, pattern: ['teleport', 'laser', 'spawn:clown:2', 'rain:fireball:10', 'shockwave', 'spread:note:9', 'charge', 'idle:0.8'] },
        // grand finale: everything at once, plus a big balloon release
        { below: 0.33, speed: 74, pattern: ['laser', 'spawn:jelly:3', 'summon_spikes', 'rain:laser_orb:12', 'charge', 'shockwave', 'spread:bolt:11', 'jump_slam', 'idle:0.6'] }
      ],
      intro: ["MAKE WAY! MAKE WAY! THE GRAND MARSHAL APPROACHES! BOW, WAVE, OR BE FLATTENED. THOSE ARE YOUR ONLY THREE OPTIONS.",
        "I HAVE LED TEN THOUSAND PARADES ON NINE HUNDRED WORLDS. NOT ONE OF THEM HAD A FOOD TRUCK. THIS IS AN OUTRAGE.",
        "BAND! A MARCH! BALLOONS! INFLATE! CRAWLER, YOU ARE OUT OF STEP, AND I WILL BE CORRECTING YOUR POSTURE. WITH THIS BATON."],
      defeat: "THE GRAND MARSHAL HAS BEEN DETHRONED! THE BAND IS STILL PLAYING! NOBODY KNOWS HOW TO MAKE THE BAND STOP!",
      loot: 'boss', unlock: null }
  };
})();

/* ==========================================================================
   CHUNKS - 12 rows each, all rows equal width (16-48). Ground rows 10-11 are
   solid '#' at both edges so any chunk can follow any chunk. Rows 5-9 at the
   edge columns are open. Player jump: <= 3 tiles up, <= 4 tiles across.
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

  C.amb_start = { rows: [
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '..P.............',
    '################',
    '################'] };

  C.amb_a = { rows: [
    '................................',
    '................................',
    '................................',
    '................................',
    '..........f..........f..........',
    '................................',
    '................................',
    '......====..........====........',
    '................................',
    '....e....e....E.....e.....e.....',
    '################################',
    '################################'] };

  C.amb_b = { rows: [
    '............................',
    '............................',
    '............................',
    '............................',
    '.............f..............',
    '............................',
    '..........e......e..........',
    '........============........',
    '............................',
    '...e......E......e......e...',
    '############################',
    '############################'] };

  C.amb_c = { rows: [
    '................................',
    '................................',
    '................................',
    '........f..............f........',
    '................................',
    '................................',
    '................................',
    '................................',
    '......b..................b......',
    '...e..b....e...$...e.....b.e....',
    '################################',
    '################################'] };

  /* side-area treasure chunks (shared by all floors' side stages) */
  C.sx_a = { rows: [
    '................................',
    '................................',
    '................................',
    '...........ooooo................',
    '..........=======...............',
    '................................',
    '................................',
    '......====..............bbbb....',
    '........................b..b....',
    '..e...........$.....e...b?.b..e.',
    '################################',
    '################################'] };

  C.sx_b = { rows: [
    '..........................?.....',
    '........................=====...',
    '................................',
    '................................',
    '...................>............',
    '................................',
    '..........ooooo.................',
    '..........=====.................',
    '................................',
    '..e.....o.o.o.^^^^.o.o.o...e....',
    '################################',
    '################################'] };

  C.sx_c = { rows: [
    '............................',
    '............................',
    '............................',
    '............................',
    '............................',
    '............................',
    '.........ooooooooo..........',
    '........===========.........',
    '............................',
    '..e..$......E.......$...e...',
    '############################',
    '############################'] };

  /* ---------- FLOOR 1: sewer (gentle) ---------- */
  C.f1_tut_start = { rows: [
    '........................................',
    '........................................',
    '........................................',
    '........................................',
    '........................................',
    '........................................',
    '.....................ooo................',
    '......o.o.o.........=====...............',
    '........................................',
    '..P.n.........bb.......n.....e....n..e..',
    '########################################',
    '########################################'] };

  C.f1_tut_mid = { rows: [
    '....................................',
    '....................................',
    '....................................',
    '....................................',
    '....................................',
    '....................................',
    '......o.o.o.........................',
    '.....=======........................',
    '..........................bbb.......',
    '.n.......e........m.n.....bbb.e.e...',
    '####################################',
    '####################################'] };

  C.f1_start = { rows: [
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
    '...........o.o.o........',
    '........................',
    '..P........e........b...',
    '########################',
    '########################'] };

  C.f1_a = { rows: [
    '............................',
    '............................',
    '............................',
    '............................',
    '............................',
    '............................',
    '..........ooo...............',
    '.........=====..............',
    '............................',
    '...e...........e.......b....',
    '########~~~~~###############',
    '############################'] };

  C.f1_b = { rows: [
    '............................',
    '............................',
    '............................',
    '............................',
    '............................',
    '.....................f......',
    '............................',
    '..........ooo...............',
    '............................',
    '..c...e................e....',
    '##########...###############',
    '##########...###############'] };

  C.f1_c = { rows: [
    '................................',
    '................................',
    '................................',
    '................................',
    '..............ooo...............',
    '.............H====..............',
    '.............H..................',
    '........XXX..H.......XXX........',
    '.......XXXX..H.......XXXX.......',
    '..e...XXXXX..H...e...XXXXX...e..',
    '################################',
    '################################'] };

  C.f1_d = { rows: [
    '............................',
    '............................',
    '............................',
    '............................',
    '............................',
    '............................',
    '..............ooo...........',
    '.............=====..........',
    '............................',
    '...e...b.....e.....$....e...',
    '############################',
    '############################'] };

  C.f1_e = { rows: [
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '..............f.................',
    '........ooo....ooo....ooo.......',
    '................................',
    '..c..e.......e......e.......e...',
    '########...####...####...#######',
    '########...####...####...#######'] };

  C.f1_f = { rows: [
    '............................',
    '............................',
    '............................',
    '............................',
    '...............ooo..........',
    '..............=====.........',
    '............................',
    '.......====.................',
    '............................',
    '..e........^^^^.........e...',
    '############################',
    '############################'] };

  C.f1_g = { rows: [
    'XXXXXXXXXXXXXX..................',
    'XXXXXXXXXXXXXX..................',
    'XXXXXXXXXXXXXX..................',
    'XXXXXXXXXXXXXX.........f........',
    'XXXXXXXXXXXXXX..................',
    '................................',
    '..o.o.o.o.o................ooo..',
    '..........................=====.',
    '......b.........................',
    '..e...b....e.........e.....h....',
    '################~~~~############',
    '################################'] };

  C.arena_hoarder = { rows: [
    'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
    'X..................................X',
    'X..................................X',
    'X..................................X',
    'X..................................X',
    '...................................X',
    '...................................X',
    '......====..............====.......X',
    '...................................X',
    '..c......................K.........X',
    '####################################',
    '####################################'] };

  /* ---------- FLOOR 2: cave ---------- */
  C.f2_start = { rows: [
    'XXXXXXXXXXXXXXXXXXXXXXXX',
    'XXXXXXX......XXXXXXXXXXX',
    'XXXX..............XXXXXX',
    'X.......................',
    '........................',
    '........................',
    '........................',
    '...........ooo..........',
    '..........=====.........',
    '..P...............e.....',
    '########################',
    '########################'] };

  C.f2_a = { rows: [
    'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
    'XXXXXXXXXXX.........XXXXXXXXXXXX',
    'XXXXXX......................XXXX',
    '..........................f.....',
    '................ooo.............',
    '...................e............',
    '................XXXXXX..........',
    '................XXXXXX..........',
    '...........===..XXXXXX..........',
    '...e............XXXXXX....e.....',
    '################################',
    '################################'] };

  C.f2_b = { rows: [
    'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
    'XXXXXXXX..............XXXXXXXXXX',
    'XXX..........................XXX',
    '................................',
    '................................',
    '...........f....................',
    '............ooooo...............',
    '................................',
    '..............>.................',
    '..c..e.....................e....',
    '#########............###########',
    '#########............###########'] };

  C.f2_c = { rows: [
    'XXXXXXXXXXXXXXXXXXXXXXXXXXXX',
    'XXXXXXXXXXXXXXXXXXXXXXXXXXXX',
    'XXXXXXXXXXXXXXXXXXXXXXXXXXXX',
    'XXXXXXXXXXX......XXXXXXXXXXX',
    'XXXX..................XXXXXX',
    '............................',
    '............................',
    '.o.o.o.o.o.o.o.o.o.o.o.o.o..',
    '.............b..............',
    '...e....e....b...e....bb..e.',
    '############################',
    '############################'] };

  C.f2_d = { rows: [
    'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
    'XXXXXXXXXXX.......XXXXXXXXXXXXXX',
    'XXXXXX........?..........XXXXXXX',
    '.............====...............',
    '...........................f....',
    '..........ooo.....e.............',
    '.........HXXXXXXXXXXX...........',
    '.........H......................',
    '.........H......................',
    '....e....H...............e......',
    '################################',
    '################################'] };

  C.f2_e = { rows: [
    'XXXXXXXXXXXXXXXXXXXXXXXXXXXX',
    'XXXXXXX...........XXXXXXXXXX',
    'XX..........................',
    '............................',
    '.............ooo............',
    '............................',
    '.............e..............',
    '............XXXX............',
    '............XXXX............',
    '..e.......^^XXXX^^......e...',
    '############################',
    '############################'] };

  C.f2_f = { rows: [
    'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
    'XXXXXXXXXXXXX.........XXXXXXXXXX',
    'XXXXX...........................',
    '................................',
    '...................f............',
    '................................',
    '.........ooo.......oooo.........',
    '...................====.........',
    '................................',
    '..c..e.........e.........e....e.',
    '#########...#######....#########',
    '#########...#######....#########'] };

  C.f2_g = { rows: [
    'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
    'XXXXXXXXX..................XXXXXXXXX',
    'XXXX............................XXXX',
    '....................................',
    '....................................',
    '....................................',
    '........ooo..............ooo........',
    '.......=====............=====.......',
    '....................................',
    '...e.......b...E.....$.......e......',
    '####################################',
    '####################################'] };

  C.f2_h = { rows: [
    'XXXXXXXXXXXXXXXXXXXXXXXXXXXX',
    'XXXXXXXXXXXXXXXXXXXXXXXXXXXX',
    'XXXXXXX..............XXXXXXX',
    '..........ooo.e.............',
    '........=========...........',
    '............................',
    '............................',
    '...====............====.....',
    '............................',
    '..e.......^^^^^^.......e....',
    '############################',
    '############################'] };

  C.arena_juicer = { rows: [
    'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
    'X....................................X',
    'X....................................X',
    'X....................................X',
    'X....................................X',
    '.....................................X',
    '.....................................X',
    '........====..........====...........X',
    '.....................................X',
    '..c...........h............K.........X',
    '######################################',
    '######################################'] };

  /* ---------- FLOOR 3: city / circus / swamp ---------- */
  C.f3_start = { rows: [
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
    '............ooo.........',
    '...........=====........',
    '..P.................e...',
    '########################',
    '########################'] };

  C.f3_a = { rows: [
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '............f...................',
    '.........ooo........oooo........',
    '................................',
    '....XXXX.......XXXXX.......XXX..',
    '.ce.XXXX.....e.XXXXX.......XXX..',
    '#########...########....########',
    '#########...########....########'] };

  C.f3_b = { rows: [
    '................................',
    '................................',
    '................................',
    '.........................oooo...',
    '.........................====...',
    '................................',
    '......................v.........',
    '................................',
    '............>...................',
    '..c..e...................e......',
    '#######~~~~~~~~~~~##############',
    '################################'] };

  C.f3_c = { rows: [
    '................................',
    '................................',
    '................................',
    '................................',
    '................f...............',
    '................................',
    '......ooo.........ooo...........',
    '.....=====.......=====..........',
    '................................',
    '..e.........e...............e...',
    '####~~~~~~~####~~~~~~~~#########',
    '################################'] };

  C.f3_d = { rows: [
    '............................',
    '............................',
    '............................',
    '............................',
    '............................',
    '............................',
    '.............ooo............',
    '............=====...........',
    '....XXX.................XX..',
    '..e.XXX....e...b..E.....XX..',
    '############################',
    '############################'] };

  C.f3_e = { rows: [
    '....................................',
    '....................................',
    '....................................',
    '....................................',
    '......................f.............',
    '....................................',
    '...........ooo.......ooo............',
    '....................................',
    '...........>.........<..............',
    '..c...e..........................e..',
    '########.....................#######',
    '########.....................#######'] };

  C.f3_f = { rows: [
    '................................',
    '.........................?......',
    '........................===.....',
    '..................oooo..........',
    '..................====..........',
    '................................',
    '............ooo.................',
    '...........=====................',
    '....bb..........................',
    '..e.bb....e.......E........e....',
    '################################',
    '################################'] };

  C.f3_g = { rows: [
    '............................',
    '............................',
    '.............ooooo..........',
    '............HXXXXXX.........',
    '............HXXXXXX.........',
    '............HXXXXXX.........',
    '............HXXXXXX.....f...',
    '............HXXXXXX.........',
    '............HXXXXXX.........',
    '..e......e..HXXXXXX..^^..e..',
    '############################',
    '############################'] };

  C.f3_h = { rows: [
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '..........f.............f.......',
    '................................',
    '........oooo...oooo.............',
    '........====...====.............',
    '.ce.......................E.....',
    '#######~~~~~~~~~~~~~############',
    '################################'] };

  C.arena_ringmaster = { rows: [
    'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
    'X....................................X',
    'X....................................X',
    'X....................................X',
    'X....................................X',
    '.....................................X',
    '.....................................X',
    '.....====.........====.........====..X',
    '.....................................X',
    '..c.......................K..........X',
    '######################################',
    '######################################'] };

  /* ---------- FLOOR 4: train / city ---------- */
  C.f4_start = { rows: [
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
    '.........ooo............',
    '........=====...........',
    '..P.............e.......',
    '########################',
    '########################'] };

  C.f4_a = { rows: [
    '................................',
    '................................',
    '................................',
    '................................',
    '.................f..............',
    '....ooooooo.......ooooooo.......',
    '.......e..............e.........',
    '...XXXXXXXXX......XXXXXXXXX.....',
    '...XXXXXXXXX......XXXXXXXXX.....',
    '..cXXXXXXXXX..e...XXXXXXXXX..e..',
    '################################',
    '################################'] };

  C.f4_b = { rows: [
    '................................',
    '................................',
    '................................',
    '................................',
    '...........................f....',
    '................................',
    '.........ooo.......ooo..........',
    '................................',
    '..........>.........<...........',
    '..c..e.......................e..',
    '#######...................######',
    '#######...................######'] };

  C.f4_c = { rows: [
    'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
    '................................',
    '................................',
    '................................',
    '.....ooo............ooo.........',
    '................................',
    '......e.............e...........',
    '...=========......=========.....',
    '................................',
    '..e.......b..e..........$....e..',
    '################################',
    '################################'] };

  C.f4_d = { rows: [
    '............................',
    '............................',
    '............................',
    '............................',
    '............................',
    '..............f.............',
    '....oooo....oooo....oooo....',
    '....====....====....====....',
    '............................',
    '..e.^^^^^^^^^^^^^^^^^^^^..e.',
    '############################',
    '############################'] };

  C.f4_e = { rows: [
    '................................',
    '.....................?..........',
    '...................HXXX.........',
    '...................H............',
    '...................H............',
    '...................H............',
    '...................H............',
    '...................H............',
    '......bb...........H............',
    '..e...bb...E.......H.......e....',
    '################################',
    '################################'] };

  C.f4_f = { rows: [
    '....................................',
    '....................................',
    '....................................',
    '...............f................f...',
    '....................................',
    '....................................',
    '............ooo......ooo............',
    '...........=====....=====...........',
    '....................................',
    '..c..e.....................e.....e..',
    '#########..................#########',
    '#########..................#########'] };

  C.f4_g = { rows: [
    'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
    'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
    'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
    'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
    'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
    '................................',
    '................................',
    '...o.o.o.....=====.....o.o.o....',
    '.........b..............b.......',
    '..e......b...e...$...e..b....e..',
    '################################',
    '################################'] };

  C.f4_h = { rows: [
    '............................',
    '............................',
    '............................',
    '..........ooooo.............',
    '........e.........e.........',
    '.....H===============H......',
    '.....H...............H......',
    '.....H...............H......',
    '.....H...............H......',
    '..e..H...^^^^^^^.....H...e..',
    '############################',
    '############################'] };

  C.arena_engineer = { rows: [
    'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
    'X......................................X',
    'X......................................X',
    'X......................................X',
    'X......................................X',
    '.......................................X',
    '.......................................X',
    '......====..................====.......X',
    '.......................................X',
    '..c.......................K............X',
    '########################################',
    '########################################'] };

  /* ---------- FLOOR 5: bubble / swamp ---------- */
  C.f5_start = { rows: [
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
    '...........ooo..........',
    '..........=====.........',
    '..P..............e......',
    '########################',
    '########################'] };

  C.f5_a = { rows: [
    '................................',
    '................................',
    '................................',
    '..........ooo.........ooo.......',
    '................................',
    '................................',
    '...........v..........v.........',
    '................................',
    '................................',
    '..c..e..........e...........e...',
    '#######~~~~~~~~##~~~~~~~~~######',
    '################################'] };

  C.f5_b = { rows: [
    '................................',
    '................................',
    '................................',
    '...................ooo..........',
    '................................',
    '..................e.............',
    '...............XXXXXXX..........',
    '...........XXXXXXXXXXX.....f....',
    '.......XXXXXXXXXXXXXXX..........',
    '..e....XXXXXXXXXXXXXXX....e.....',
    '################################',
    '################################'] };

  C.f5_c = { rows: [
    'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
    'XXXXXXXXXX.........XXXXXXXXXXXXXXXXX',
    'XXXXX.........................XXXXXX',
    '....................................',
    '.............f..........f...........',
    '....................................',
    '......ooo......oeo......ooo.........',
    '.....=====....=====....=====........',
    '....................................',
    '..c..............................e..',
    '####~~~~~~~~~~~~~~~~~~~~~~~~~~~~####',
    '####################################'] };

  C.f5_d = { rows: [
    '............................',
    '............................',
    '............................',
    '............................',
    '............................',
    '............................',
    '..............ooo...........',
    '.............=====..........',
    '............................',
    '..e.......b..e.....$.....e..',
    '####~~~~##############~~~###',
    '############################'] };

  C.f5_e = { rows: [
    '................................',
    '.........................?......',
    '.......................=====....',
    '................................',
    '................................',
    '................................',
    '.....ooooo..........v...........',
    '....=======.....................',
    '................................',
    '..e...........e.............e...',
    '################################',
    '################################'] };

  C.f5_f = { rows: [
    '................................',
    '................................',
    '................................',
    '......f..........f..........f...',
    '................................',
    '................................',
    '............oooo................',
    '...........======...............',
    '................................',
    '..c..e...........^^^.........e..',
    '##########....##########....####',
    '##########....##########....####'] };

  C.f5_g = { rows: [
    '....................................',
    '....................................',
    '..............f.....................',
    '................ooooooo.............',
    '....................................',
    '................e.......e...........',
    '..........H=================X.......',
    '..........H.................X.......',
    '..........H.................X.......',
    '..e.......H......$.......e..X....e..',
    '####################################',
    '####################################'] };

  C.arena_tidemother = { rows: [
    'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
    'X......................................X',
    'X......................................X',
    'X......................................X',
    'X......................................X',
    '.......................................X',
    '.......................................X',
    '.......===........====........===......X',
    '.......................................X',
    '..c........................K...........X',
    '########################################',
    '########################################'] };

  /* ---------- FLOOR 6: forest ---------- */
  C.f6_start = { rows: [
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
    '..........ooo...........',
    '.........=====..........',
    '..P..............e......',
    '########################',
    '########################'] };

  C.f6_a = { rows: [
    '................................',
    '................................',
    '................ooo.............',
    '...............=====............',
    '................................',
    '..........................f.....',
    '..........XX..........e.........',
    '...=====..XX.........=====......',
    '..........XX....................',
    '..e.......XX..^^^...........e...',
    '################################',
    '################################'] };

  C.f6_b = { rows: [
    '....................................',
    '....................................',
    '....................................',
    '..................f.................',
    '....................................',
    '....................................',
    '.........ooo..........ooo...........',
    '.........===..........===...........',
    '....................................',
    '..c..e..........e...............e...',
    '########......#######......#########',
    '########......#######......#########'] };

  C.f6_c = { rows: [
    '................................',
    '................................',
    '................................',
    '................................',
    '..................e.....e.......',
    '.................H=========.....',
    '.................H..............',
    '.................H..............',
    '.........bb......H..............',
    '..e......bb...e..H.......E......',
    '################################',
    '################################'] };

  C.f6_d = { rows: [
    '....................................',
    '....................................',
    '....................................',
    '....................................',
    '....................................',
    '...............f....................',
    '......ooo................ooo........',
    '.....=====..............=====.......',
    '....................................',
    '..e....^^^^......e.......^^^^...e...',
    '####################################',
    '####################################'] };

  C.f6_e = { rows: [
    '...........................?....',
    '.........................=====..',
    '................................',
    '................................',
    '...................<............',
    '................................',
    '..........XXXXXX................',
    '..........X....X................',
    '...............X................',
    '..e.....X...h..X..e.......e.....',
    '################################',
    '################################'] };

  C.f6_f = { rows: [
    '................................',
    '................................',
    '................................',
    '................................',
    '..........f.........f...........',
    '................................',
    '.......oooo......oooo...........',
    '................................',
    '................................',
    '..c..e.....e.........e......e...',
    '#######....######....###########',
    '#######....######....###########'] };

  C.f6_g = { rows: [
    '....................................',
    '....................................',
    '....................................',
    '......................ooo...........',
    '.....................=====..........',
    '....................................',
    '...............XXX..................',
    '...........XXX.XXX......e...........',
    '.......XXX.XXX.XXX.....XXX..........',
    '..e....XXX.XXX.XXX..e..XXX.......e..',
    '####################################',
    '####################################'] };

  C.arena_butcher = { rows: [
    'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
    'X......................................X',
    'X......................................X',
    'X......................................X',
    'X......................................X',
    '.......................................X',
    '.......................................X',
    '.....====.....====.........====........X',
    '.......................................X',
    '..c.......................K............X',
    '########################################',
    '########################################'] };

  /* ---------- FLOOR 7: castle ---------- */
  C.f7_start = { rows: [
    'XXXXXXXXXXXXXXXXXXXXXXXX',
    'XXXXXXXXXXXXXXXXXXXXXXXX',
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
    '..........ooo...........',
    '.........=====..........',
    '..P..............e......',
    '########################',
    '########################'] };

  C.f7_a = { rows: [
    'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
    '................................',
    '................................',
    '..........f.............f.......',
    '................................',
    '................................',
    '.......ooo........ooo...........',
    '......=====......=====..........',
    '................................',
    '..c..e.......e............e.....',
    '######.....######.....##########',
    '######.....######.....##########'] };

  C.f7_b = { rows: [
    'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
    'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
    '....................................',
    '..................f.................',
    '...............ooo......ooo.........',
    '....................................',
    '....................................',
    '....................................',
    '............>..........<............',
    '..c.e...........................e...',
    '#######~~~~~~~~~~~~~~~~~~~~~~~~#####',
    '####################################'] };

  C.f7_c = { rows: [
    'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
    '................................',
    '.....ooooo..........ooooo.......',
    '.....e..............e...........',
    '...H=======.......H=======......',
    '...H..............H.............',
    '...H..............H.............',
    '...H..............H.............',
    '...H......bb......H.............',
    '..eH......bb....e.H......E......',
    '################################',
    '################################'] };

  C.f7_d = { rows: [
    'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
    '................................',
    '................................',
    '..........f.......f.............',
    '................................',
    '................................',
    '.....oooo....oooo....oooo.......',
    '.....====....====....====.......',
    '................................',
    '..e..^^^^^^^^^^^^^^^^^^^^^...e..',
    '################################',
    '################################'] };

  C.f7_e = { rows: [
    'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
    'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
    'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
    'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
    'XXXXXXXXXX.......XXXXXXX.......XXXXX',
    '....................................',
    '....................................',
    '.....o.o.o.....=====.....o.o.o......',
    '....................................',
    '..e....b....e....$....e....b....E...',
    '####################################',
    '####################################'] };

  C.f7_f = { rows: [
    'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
    '................................',
    '................................',
    '................................',
    '...........ooo..................',
    '................................',
    '..........v.........v...........',
    '................................',
    '................................',
    '..c..e.........e..........e.....',
    '#######.......####.......#######',
    '#######.......####.......#######'] };

  C.f7_g = { rows: [
    'XXXXXXXXXXXXXXXXXXXXXXXXXXXX',
    '............................',
    '......f...........f.........',
    '............................',
    '............................',
    '............................',
    '........ooo.....ooo.........',
    '........XXX.....XXX.........',
    '........XXX.....XXX.........',
    '..e.....XXX..^^.XXX....e....',
    '############################',
    '############################'] };

  C.arena_bride = { rows: [
    'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
    'X......................................X',
    'X......................................X',
    'X......................................X',
    'X............====......====............X',
    '.......................................X',
    '.......................................X',
    '....====.......====.......====.........X',
    '.......................................X',
    '..c.......................K............X',
    '########################################',
    '########################################'] };

  /* ---------- FLOOR 8: ghost town / mine (f8_* chunks are also reused by floors 10-11) ---------- */
  C.f8_start = { rows: [
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
    '...........ooo..........',
    '..........=====.........',
    '..P...............e.....',
    '########################',
    '########################'] };

  C.f8_a = { rows: [
    '....................................',
    '....................................',
    '....................................',
    '......................f.............',
    '....................................',
    '....................................',
    '.......ooo............ooo...........',
    '....................................',
    '...........XXXX............XXXX.....',
    '..c..e.....XXXX...e........XXXX..e..',
    '#######...############...###########',
    '#######...############...###########'] };

  C.f8_b = { rows: [
    '................................',
    '................................',
    '................................',
    '..............ooo...............',
    '................................',
    '................................',
    '.........f..............f.......',
    '...............e................',
    '........>.....XXXX....<.........',
    '..c.e.........XXXX...........e..',
    '#####~~~~~~~~~XXXX~~~~~~~~~#####',
    '################################'] };

  C.f8_c = { rows: [
    '....................................',
    '....................................',
    '...........................?........',
    '.........................=====......',
    '....................................',
    '....ooo...............H.............',
    '......e...............H.............',
    '...=======............H.............',
    '......................H.............',
    '..e.......^^^^...E....H......e......',
    '####################################',
    '####################################'] };

  C.f8_d = { rows: [
    '................................',
    '................................',
    '........f.........f.........f...',
    '................................',
    '................................',
    '................................',
    '..........oooo......oooo........',
    '.........======....======.......',
    '................................',
    '..c..e....................e.....',
    '########.............###########',
    '########.............###########'] };

  C.f8_e = { rows: [
    'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
    'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
    'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
    'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
    '...........X..........X.............',
    '...........X..........X.............',
    '...........X..........X.............',
    '...o.o.....X...ooo....X....o.o......',
    '...........b..........b.............',
    '..e....e...b...e..$...b....e...E....',
    '####################################',
    '####################################'] };

  C.f8_f = { rows: [
    '................................',
    '................................',
    '................................',
    '................................',
    '.................ooo............',
    '.........e..oooo..e.............',
    '.......XXXXX....XXXXX...........',
    '.....XXXXXXX....XXXXX...........',
    '....XXXXXXXX....XXXXX......f....',
    '..cXXXXXXXXX....XXXXX.....e.....',
    '############....################',
    '############....################'] };

  C.f8_g = { rows: [
    '....................................',
    '....................................',
    '......ooo..............ooo..........',
    '.......e................e...........',
    '......XXX..............XXX..........',
    '......XXX..............XXX..........',
    '.....HXXX.............HXXX..........',
    '.....HXXX.............HXXX..........',
    '.....HXXX.....bb......HXXX..........',
    '..e..HXXX.....bb..e...HXXX.....e....',
    '####################################',
    '####################################'] };

  C.arena_mothman = { rows: [
    'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
    'X......................................X',
    'X......................................X',
    'X......................................X',
    'X.........====............====.........X',
    '.......................................X',
    '.......................................X',
    '......=====.......====.......=====.....X',
    '.......................................X',
    '..c.......................K............X',
    '########################################',
    '########################################'] };

  /* ---------- FLOOR 9: warzone ---------- */
  C.f9_start = { rows: [
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
    '...........ooo..........',
    '..........=====.........',
    '..P...............e.....',
    '########################',
    '########################'] };

  C.f9_a = { rows: [
    '....................................',
    '....................................',
    '....................................',
    '....................................',
    '..............f.................f...',
    '....................................',
    '......ooo..........ooo..............',
    '.....XXXXX........XXXXX.............',
    '.....XXXXX...e....XXXXX.............',
    '..e..XXXXX..XXX...XXXXX..^^^....e...',
    '####################################',
    '####################################'] };

  C.f9_b = { rows: [
    '....................................',
    '....................................',
    '....................................',
    '....................................',
    '....................................',
    '...........f..............f.........',
    '.........oooo......oooo.............',
    '........======....======............',
    '....................................',
    '..c..e^^.......^^.............e.....',
    '#########....######....#############',
    '#########....######....#############'] };

  C.f9_c = { rows: [
    'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
    'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
    'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
    'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
    'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
    '................................',
    '................................',
    '....o.o.o.......o.o.o...........',
    '..........b...........b.........',
    '..e.......b....e...E..b.....e...',
    '################################',
    '################################'] };

  C.f9_d = { rows: [
    '....................................',
    '....................................',
    '....................................',
    '....................................',
    '..........f.........f..........f....',
    '....................................',
    '........ooo...........ooo...........',
    '.................e..................',
    '..........>.....XXX.....<...........',
    '..c..e..........XXX...........e.....',
    '######..........XXX...........######',
    '######..........XXX...........######'] };

  C.f9_e = { rows: [
    '................................',
    '................................',
    '................................',
    '.............ooooo..............',
    '................................',
    '...............e................',
    '...........HXXXXXXX.............',
    '...........HXXXXXXX.............',
    '...........HXXXXXXX.............',
    '..e........HXXXXXXX.....E.......',
    '################################',
    '################################'] };

  C.f9_f = { rows: [
    '....................................',
    '....................................',
    '......f..........f..........f.......',
    '....................................',
    '....................................',
    '....................................',
    '.............ooo....................',
    '............=====.........====......',
    '....................................',
    '..c..e^^^..........e.........e......',
    '##########.....########....#########',
    '##########.....########....#########'] };

  C.f9_g = { rows: [
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '.........ooo.........ooo........',
    '........=====.......=====.......',
    '.....bb........bb..........bb...',
    '..e..bb...e....bb...E..$...bb...',
    '################################',
    '################################'] };

  C.arena_showrunner = { rows: [
    'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
    'X..........................................X',
    'X..........................................X',
    'X..........................................X',
    'X.........====..............====...........X',
    '...........................................X',
    '...........................................X',
    '.....====..........======..........====....X',
    '...........................................X',
    '..c.....h...................K..............X',
    '############################################',
    '############################################'] };
  /* ==========================================================================
     UPDATE 2 CHUNKS: levers (S), gates (L), quest item spots (Q), rescues (R).
     Q / R chunks are only ever used through stages[id].chunks.insert, so each
     quest/rescue stage gets exactly one. lv_* chunks are ordinary pool chunks.
     ========================================================================== */

  /* ---------- general lever puzzles (pool chunks, any theme) ---------- */
  // gate blocks the way; the lever sits on a ledge you climb to
  C.lv_gate_climb = { rows: [
    '......................X.........',
    '......................X.........',
    '......................X.........',
    '..........ooo.........X.........',
    '.........S............X.........',
    '........XXXX..........X.........',
    '......................L.........',
    '......................L...ooo...',
    '...===................L.........',
    '..e..........e........L....e....',
    '################################',
    '################################'] };

  // treasure nook: climb over it, punch the bell on the roof, come back down
  C.lv_cache = { rows: [
    '................................',
    '................................',
    '................................',
    '................................',
    '..................ooooo.........',
    '.................H....S.........',
    '.................HXXXXXXXXX.....',
    '.................HX.o.o.o.X.....',
    '.................HL.......X.....',
    '..e..............HL...$...X..e..',
    '################################',
    '################################'] };

  // low tunnel with a stash; the lever is up on the tunnel roof
  C.lv_tunnel = { rows: [
    '....................................',
    '....................................',
    '....................................',
    '....................................',
    '................e.......S...........',
    '............XXXXXXXXXXXXXXXX........',
    '............XXXXXXXXXXXXXXXX........',
    '.......===..XXXXXXXXXXXXXXXX........',
    '....................Lo.o.o.X........',
    '..e.................L..m...X...e....',
    '####################################',
    '####################################'] };

  // gate blocks the way; the lever hides in a nook behind a crate
  C.lv_crates = { rows: [
    '..................X.........',
    '..................X.........',
    '..................X.........',
    '..................X.........',
    '..................X.........',
    '..................X.........',
    '..................L.........',
    '..........XXXXXX..L.........',
    '..........b....X..L.........',
    '..e.......b.S..X..L...e.....',
    '############################',
    '############################'] };

  /* ---------- floor 1: the lever lesson (end chunk of the tutorial) ---------- */
  // replaces the old f1_tut_end: sign 8 explains levers, then a gate before the door
  C.f1_tut_end = { rows: [
    '..............................X.....',
    '..............................X.....',
    '..............................X.....',
    '..............................X.....',
    '..............................X.....',
    '..............................L.....',
    '..............................L.....',
    '...............ooo............L.....',
    '..............=====...........L.....',
    '..n..h....e........n.e...n.S..L..D..',
    '####################################',
    '####################################'] };

  /* ---------- floor 2 (cave) ---------- */
  // GRUB GULLY: the exit key sits at the end of an upper side tunnel
  C.q_cave_branch = { rows: [
    'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
    'XXX..................................XXX',
    'XXX.....o.o.o.................b...Q..XXX',
    'XXX..........e..^^............b......XXX',
    'XXXHXXXXXXXXXXXXXXX====XXXXXXXXXXXXXXXXX',
    '...H....................................',
    '...H....................................',
    '...H.......ooo..........................',
    '...H......=====.........................',
    '...H..e.............h.........E..e......',
    '########################################',
    '########################################'] };

  // ARCHERY RANGE: Sir Squeaks tied up in the target room; lever up the ladder
  C.r_cave_target = { rows: [
    'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
    'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
    'XXX...XXXXXXXXXXX.........XXXXXXXXXXXXXX',
    'XXXS..XXXX......L....o....XXXXXXXXXXXXXX',
    'XXX=H=XXXX......L....R....XXXXXXXXXXXXXX',
    '....H.......====XXXXXXXXXXX.............',
    '....H...................................',
    '....H.....====..........................',
    '....H...................................',
    '....H..e...........e.........e.......e..',
    '########################################',
    '########################################'] };

  /* ---------- floor 3 (city / circus / swamp) ---------- */
  // boiler room: lever on the roof, doors on both sides at street level
  C.q_city_boiler = { rows: [
    '....................................',
    '....................................',
    '.........H....S.......ooo...........',
    '.........HXXXXXXXXXXXXXXXXXX........',
    '.........HXXXXXXXXXXXXXXXXXX........',
    '.........HXX..............XX........',
    '.........HXX..............XX........',
    '.........HXX..............XX........',
    '.........HL.........Q.....LL........',
    '..e......HL......e........LL...e....',
    '####################################',
    '####################################'] };

  // lost and found / freight lockers: lever on the roof, reached from the far ladder
  C.q_city_lockers = { rows: [
    '....................................',
    '...................S...........H....',
    '.............XXXXXXXXXXXXXXXXXXH....',
    '.............X................XH....',
    '.............L.........o.o....XH....',
    '.............L............Q...XH....',
    '.........====XXXXXXXXXXXXXXXXXXH....',
    '...............................H....',
    '.....===.......................H....',
    '..e........b........e..........H..e.',
    '####################################',
    '####################################'] };

  // bayou: the ticket waits on a floating island; ride the lift up
  C.q_swamp_stump = { rows: [
    '........................................',
    '...............oo..Q....................',
    '...............XXXXXXX..................',
    '...............XXXXXXX..................',
    '.............v..........................',
    '........................................',
    '........................................',
    '........................................',
    '..........XXX.....>......XXX............',
    '..e.......XXX............XXX.........e..',
    '#######~~~XXX~~~~~~~~~~~~XXX~~~~########',
    '########################################'] };

  // the midway: ring the high striker bell to open the prize booth
  C.r_circus_prize = { rows: [
    '........................................',
    '.......S................................',
    '.....HXXH...............................',
    '.....HXXH.............ooo...............',
    '.....HXXH...........XXXXXXXXXXXX........',
    '.....HXXH...........X..........X........',
    '.....HXXH...........X..........X........',
    '.....HXXH.....===...L..........X........',
    '.....HXXH...........L..........X........',
    '..e..HXXH.....e.....L......R...X....e...',
    '########################################',
    '########################################'] };

  /* ---------- floor 4 (train / city) ---------- */
  // platform nine: office on the left, lever on the tall container across the pit
  C.q_city_stack = { rows: [
    '....................................',
    '....................................',
    '..............................S.....',
    '............................HXXX....',
    '............................HXXX....',
    '...................ooo......HXXX....',
    '.............XXXXXXXXX......HXXX....',
    '.............X.......X......HXXX....',
    '..........XX.X...Q...L......HXXX....',
    '..e.......XX.X.......L.^^^..HXXX..e.',
    '####################################',
    '####################################'] };

  // engine shed: walk over the hatch, pull the lever, drop into the pit
  C.q_train_pit = { rows: [
    '....................................',
    '....................................',
    '....................................',
    '.........ooo..........ooo...........',
    '....................................',
    '...................f................',
    '.........^^...............S.........',
    '.....XXXXXXXLLLLLLXXXXXXXXXX........',
    '...XXXXXXXXX..Q..HXXXXXXXXXXXX......',
    '.e.XXXXXXXXX.....HXXXXXXXXXXXX...e..',
    '####################################',
    '####################################'] };

  // the old spur: a caboose up on blocks; lever in the crate shed, lift up to the door
  C.r_train_caboose = { rows: [
    '........................................',
    '.....................XXXXXXXXXXXX.......',
    '.....................L..........X.......',
    '.....................L.....R....X.......',
    '....................XXXXXXXXXXXXX.......',
    '..................v.....................',
    '........................................',
    '..................................XXXXX.',
    '...................................b..X.',
    '..e.........e......................b.SX.',
    '########################################',
    '########################################'] };

  /* ---------- floor 5 (bubble / swamp) ---------- */
  // sea caves: lever up the coral stairs, then ride the bubble to the alcove
  C.q_bubble_grotto = { rows: [
    'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
    'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
    'XXXXX.....L.........................',
    'XXXXX..Q..L..................S......',
    'XXXXXXXXXXXX..............XXXXX.....',
    '..............v.....................',
    '....................................',
    '..............................===...',
    '..........ooo.......................',
    '..e.......h.........e.........e.....',
    '################~~~~################',
    '####################################'] };

  // mangrove maze: climb the root arch, cross the branches to the crown nest
  C.q_swamp_roots = { rows: [
    '........................................',
    '........................XXXXXXX.........',
    '.......H..S.............L.....X.........',
    '.......HXXXX..===...===.L..Q..X.........',
    '.......HXXXX...........XXXXXXXX.........',
    '.......HXXXX...........XXXXXXXX.........',
    '.......HXXXX............................',
    '.......H................................',
    '.......H....ooo.........................',
    '..e....H.......e................e....e..',
    '################~~~#####################',
    '########################################'] };

  // pearl vault: the conch is in the vault; the bell is up on a perch, take the bubble
  C.q_bubble_clam = { rows: [
    '....................................',
    '....................................',
    '.................S..................',
    '................XXX.................',
    '....................................',
    '............v.......................',
    '....................ooooo...........',
    '.................XXXXXXXXXXXX.......',
    '.................L.....Q....X.......',
    '..e..............L..........X....e..',
    '####################################',
    '####################################'] };

  // reef shelf: Katia in a fishing net up on the shelf; a tricky climb
  C.r_swamp_net = { rows: [
    '........................................',
    '........................................',
    '...........................ooo.R........',
    '...........===...........XXXXXXXXX......',
    '..................>.....................',
    '....................f...................',
    '........===.............................',
    '........................................',
    '....===.................................',
    '..e.........^^^......e.............e....',
    '########################################',
    '########################################'] };

  /* ---------- floor 6 (forest) ---------- */
  // trapper camp: a leaf-covered snare pit; the lever inside lets you out
  C.q_forest_snare = { rows: [
    '........................................',
    '........................................',
    '........................................',
    '..........e..............ooo............',
    '......XXXXXXXXXX..XXXXLXXXXXXXXX........',
    '......XXXXXXX.......X.HXXXXXXXXX........',
    '......XXXXXXX.......X.HXXXXXXXXX........',
    '...XX.XXXXXXX.......X.HXXXXXXXXXXX......',
    '...XX.XXXXXXX.......LQHXXXXXXXXXXX......',
    '..eXX.XXXXXXX.S.....L.HXXXXXXXXXXX..e...',
    '########################################',
    '########################################'] };

  // wolf hollow: the den under the hill; lever on the rock, hatch on top
  C.q_forest_den = { rows: [
    '....................................',
    '.........................S..........',
    '........................XXX.........',
    '..........ooo...........XXX.........',
    '........XXXXXXXXXXLXXXXXXXXX........',
    '........XXXXXXXXXXHXXXXXXXXX........',
    '........XXXX......H.....XXXX........',
    '.....XX.XXXX......H.....XXXX.XX.....',
    '.....XX.XXXX.Q....H.....XXXX.XX.....',
    '..e..XX.XXXX......H..E..XXXX.XX..e..',
    '####################################',
    '####################################'] };

  // kennels: the horn hangs at the end of a branch up the big tree
  C.q_forest_tree = { rows: [
    '..............oooo..................',
    '.............HXXXX..E.Q.............',
    '.............HXXXX=====.............',
    '.............HXXXX..................',
    '.............HXXXX..................',
    '.............HXXXX......f...........',
    '.............HXXXX..................',
    '.............HXXXX..................',
    '.............H......................',
    '..e..........H.........e............',
    '####################################',
    '####################################'] };

  // wishing well: lever on the ledge over the shaft, then the well-house door opens
  C.r_forest_well = { rows: [
    '........................................',
    '........................................',
    '........................................',
    '...........ooo..........................',
    '.............S..........................',
    '............XXX.........XXXXXXXXXX......',
    '........................X........X......',
    '........................X........X......',
    '.............<..........L...............',
    '..e.....................L...R...........',
    '##########........######################',
    '##########........######################'] };

  /* ---------- floor 7 (castle) ---------- */
  // wine cellar: smash the rack to reach the lever; the invitation is in the alcove
  C.q_castle_cellar = { rows: [
    'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
    'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
    '......bb..................L........X',
    '....S.bb..................L....Q...X',
    '...XXXXXX................XXXXXXXXXXX',
    '....................................',
    '..............f.....................',
    '........===.........===.............',
    '...........ooo......................',
    '..e.........e.......E.......e.......',
    '####################################',
    '####################################'] };

  // greenhouse: lever atop the left vine, hatch atop the right vine
  C.q_castle_vines = { rows: [
    'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
    '........................XXXXXXXX....',
    '........S...............X......X....',
    '....XXHXX...............X....Q.X....',
    '......H.................XXXLXXXX....',
    '......H...........f...........H.....',
    '......H....................H........',
    '......H....................H........',
    '......H....ooo.............H........',
    '..e...H.......e............H....e...',
    '####################################',
    '####################################'] };

  // ballroom: ride the chandelier to the lever; the tiara waits on the balcony
  C.q_castle_balcony = { rows: [
    'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
    '.............................XXXXXXXXXXX',
    '.............................L.........X',
    '...............S.............L...Q.....X',
    '..............XXX...........XXXXXXXXXXXX',
    '........................................',
    '........................................',
    '..........>...........====..............',
    '........................................',
    '..e.......e........e...........e....e...',
    '########################################',
    '########################################'] };

  // heart of the hedge maze: Signet held in the topiary chamber
  C.r_castle_hedge = { rows: [
    '........................................',
    '........................................',
    '........................................',
    '....S...............^...e...............',
    '...XXXXX......HXXXXXXXXXXXX.............',
    '..............HX..........X.............',
    '..............HX..........X.............',
    '.........===..HX..........X.............',
    '..............HL..........X.............',
    '..e...........HL.....R....X......e......',
    '########################################',
    '########################################'] };

  /* ---------- floor 8 (ghost town / mine) ---------- */
  // department store: up the steps, lever on the roof, lost and found office below
  C.q_ruin_store = { rows: [
    '........................................',
    '........................................',
    '........................................',
    '.........................e....S.........',
    '....................XXXXXXXXXXXXXXXXXX..',
    '..................XX...............X....',
    '................XXXX...............X....',
    '..............XXXXXX...............X....',
    '............XXXXXXXX....Q..........L....',
    '..e.........XXXXXXXX.........E.....L.e..',
    '########################################',
    '########################################'] };

  // radio station mast: climb the mast, hop the swinging rig to the beacon perch
  C.q_ruin_mast = { rows: [
    '...........................Q....',
    '..........................XXX...',
    '.....................<..........',
    '..............==H==.............',
    '................H...............',
    '................H.......f.......',
    '................H...............',
    '................H...............',
    '................H...............',
    '..e.............H........e......',
    '################################',
    '################################'] };

  /* ---------- floor 9 (warzone) ---------- */
  // command bunker: hatch on the roof, lever on the watchtower
  C.q_war_bunker = { rows: [
    '....................................',
    '....................................',
    '.............................S......',
    '...........................HXX......',
    '...........................HXX......',
    '...........ooo.............HXX......',
    '........XXXXXXXLXXXXXX.....HXX......',
    '........XX.....H....XX.....HXX......',
    '.....XX.XX.Q...H....XX.....HXX......',
    '..e..XX.XX.....H..e.XX.....HXX...e..',
    '####################################',
    '####################################'] };

  // artillery hill: lever on the sniper ledge, lift up to the gun nest
  C.q_war_hill = { rows: [
    '............................XXXXXXXXXX..',
    '............................L........X..',
    '............................L....Q...X..',
    '...........................XXXXXXXXXXX..',
    '.......S.e..............................',
    '......XXXXXH............v...............',
    '...........H............................',
    '...........H............................',
    '...........H............................',
    '..e........H......^^^........e........e.',
    '########################################',
    '########################################'] };

  // dropship wreck: lever on the hull, the pass at the back of the cargo bay
  C.q_war_wreck = { rows: [
    '........................................',
    '........................................',
    '........................................',
    '....................S.....e.............',
    '.........HXXXXXXXXXXXXXXXXXXXXX.........',
    '.........HXXXXXXXXXXXXXXXXXXXXX.........',
    '.........HXXXXXXXXXXXXXXXXXXXXX.........',
    '.........H..............L.....X.........',
    '.........H.....bb.......L..Q..X.........',
    '..e......H.....bb..^^...L.....X....e....',
    '########################################',
    '########################################'] };

  /* ==========================================================================
     UPDATE 3 CHUNKS
     ========================================================================== */

  /* ---------- floor 10 on foot (scrapyard / auto parts store) ---------- */
  // scrapyard: armor plating in the crusher shed; lever on the shed roof, reached by ladder + hops
  C.q_ruin_crusher = { rows: [
    '........................................',
    '........................................',
    '........................................',
    '..............ooo.......................',
    '..............................S.........',
    '..........H...===..====...XXXXXXXXXXX...',
    '..........H...............X.........X...',
    '..........H...............L.........X...',
    '..........H...............L....Q....X...',
    '..e.......H.......e.......L.........X.e.',
    '########################################',
    '########################################'] };

  // auto parts store: the turbo sits on the top shelf; lever on the stock pallets
  C.q_city_lift = { rows: [
    '........................................',
    '...XXXXXXXXXX...........................',
    '...X....Q...L...........................',
    '...X........L...........................',
    '...XXXXXXXXXXXX=====....................',
    '........................................',
    '...............................S........',
    '.....................=====..XXXXXX......',
    '........................................',
    '..e.......b.....e.........e........e....',
    '########################################',
    '########################################'] };

  /* ---------- floor 11 on foot (festival town) ---------- */
  // confetti alley: cannon in a rooftop shed (ladder on the right); lever in an alley nook behind crates
  C.q_city_cannon = { rows: [
    '........................................',
    '........................................',
    '...............XXXXXXXXXXX..............',
    '...............X....Q....L..............',
    '...............X.........L..............',
    '...............XXXXXXXXXXXXXH...........',
    '............................H...........',
    '......XXXXX.................H...........',
    '......b...X.................H...........',
    '..e...b.S.X.......e.........H.....e.....',
    '########################################',
    '########################################'] };

  // balloon barn: helium kit up in the rigging; lever on a perch, ride the prop cart up
  C.q_circus_balloons = { rows: [
    '........................................',
    '........................................',
    '..........................XXXXXXXX......',
    '..........................L..Q...X......',
    '..........................L......X......',
    '.........S...........XXXXXXXXXXXXX......',
    '........XXX.............................',
    '........................................',
    '.....===..........>.....................',
    '..e.........e..........e.........e......',
    '########################################',
    '########################################'] };

  // gilded hall: the banner hangs in a high gallery (gate on its right side); lever atop the bell tower
  C.q_castle_banner = { rows: [
    '........................................',
    '...............S........................',
    '............HXXXXX......................',
    '............H...........................',
    '............H..........XXXXXXXXXXXXX....',
    '............H..........X...Q.......L....',
    '............H..........X...........L....',
    '............H..........XXXXXXXXXXXXX==..',
    '.....===....H...........................',
    '..e.........H.......e..........e.....e..',
    '########################################',
    '########################################'] };

  // lantern park: spotlight in a treehouse up the branches; lever on a stump to the west
  C.q_forest_lantern = { rows: [
    '........................................',
    '.......................XXXXXXXX.........',
    '.......................L..Q...X.........',
    '.......................L......X.........',
    '......S..........====XXXXXXXXXX.........',
    '.....XXX................................',
    '.............===........................',
    '..........==............................',
    '......===...............................',
    '..e.............e...........e.......e...',
    '########################################',
    '########################################'] };

  /* ---------- floor 10: race chunks (theme raceway) ----------
     r rival start, Z boost pad, J jump pad, O oil slick (each in the empty cell
     right above ground), F finish line. Truck drives on row 9. */
  // heat 1 grid: the player on pole, rivals lined up behind
  C.race_start = { rows: [
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '.......................o.o.o....',
    '................................',
    '.r...r...r...r.....P............',
    '################################',
    '################################'] };

  // heats 2-3 grid: two rivals behind, two ahead
  C.race_grid = { rows: [
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '.........................o.o.o..',
    '................................',
    '..r...r....P....r...r...........',
    '################################',
    '################################'] };

  // championship grid: the champion starts right in front of you
  C.race_pole = { rows: [
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '..........................o.o...',
    '................................',
    '...P.....r...r...r...r..........',
    '################################',
    '################################'] };

  C.race_finish = { rows: [
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

  // the straightaway: boost pads and a couple of crate stacks to ram
  C.race_a = { rows: [
    '........................................',
    '........................................',
    '........................................',
    '........................................',
    '........................................',
    '.......................f................',
    '........................................',
    '.....ooo..............ooo...............',
    '........................................',
    '...Z...........b....e..........Z....b...',
    '########################################',
    '########################################'] };

  // hop the ditch: two short gaps
  C.race_b = { rows: [
    '........................................',
    '........................................',
    '........................................',
    '........................................',
    '........................................',
    '........................................',
    '........................................',
    '...........ooo..............ooo.........',
    '........................................',
    '.....e.........................e........',
    '###########...#############...##########',
    '###########...#############...##########'] };

  // oil change: slicks and pit crews on the road
  C.race_c = { rows: [
    '........................................',
    '........................................',
    '........................................',
    '........................................',
    '...........f.................f..........',
    '........................................',
    '........................................',
    '........................................',
    '........................................',
    '....OO.......e.....O.O.........e...OO...',
    '########################################',
    '########################################'] };

  // the overpass: jump pad up to a clean, coin-lined shortcut over the mess below
  C.race_d = { rows: [
    '........................................',
    '........................................',
    '........................................',
    '........................................',
    '........................................',
    '........................................',
    '...........o.o.o.Z..o.o.o...............',
    '..........=================.............',
    '........................................',
    '........J.....O.....e...^^.....e........',
    '########################################',
    '########################################'] };

  // crate alley: stacks of crates to smash through
  C.race_e = { rows: [
    '........................................',
    '........................................',
    '........................................',
    '........................................',
    '........................................',
    '.........................f..............',
    '........................................',
    '.......ooo.........ooo........ooo.......',
    '........................................',
    '...e......b.....e...bb.....Z....b...e...',
    '########################################',
    '########################################'] };

  // big air: a jump pad over a six tile gap, then a plain four tile hop
  C.race_f = { rows: [
    '........................................',
    '........................................',
    '........................................',
    '........................................',
    '........................................',
    '.............ooo........................',
    '...........o.....o......................',
    '.............................oooo.......',
    '........................................',
    '..........J.............e...............',
    '###########.....############....########',
    '###########.....############....########'] };

  // shredder row: tire shredder strips; the overpass skips most of them
  C.race_g = { rows: [
    '........................................',
    '........................................',
    '........................................',
    '........................................',
    '..................f.....................',
    '........................................',
    '...........o.o.o.o.o.o..................',
    '..........============..................',
    '........................................',
    '........J..^^^.......^^^......O...e.....',
    '########################################',
    '########################################'] };

  // double decker: a long overpass with a snack on top, a gap and oil underneath
  C.race_h = { rows: [
    '........................................',
    '........................................',
    '........................................',
    '........................................',
    '........................................',
    '........................................',
    '.........o.o.o.o.h.o.o.o.o..............',
    '........====================............',
    '........................................',
    '......J..............e.....O....e.......',
    '################....####################',
    '################....####################'] };

  // pit stop: three gaps in a row (the six tile one has a pad)
  C.race_i = { rows: [
    '............................................',
    '............................................',
    '............................................',
    '..............................f.............',
    '............................................',
    '............ooo.............................',
    '............................................',
    '........................oooo........ooo.....',
    '............................................',
    '...e......J.....................e...........',
    '###########.....########....########...#####',
    '###########.....########....########...#####'] };

  // bridge out: a broken plank bridge over a bottomless drop
  C.race_j = { rows: [
    '............................................',
    '............................................',
    '............................................',
    '............................................',
    '.................f..........................',
    '............................................',
    '............................................',
    '..............ooo......ooo.......oo.........',
    '............................................',
    '...O......e.........e...................Z...',
    '######========...======...=======..#########',
    '######.............................#########'] };

  // the gauntlet: a broken overpass up top, crates and a brute down below
  C.race_k = { rows: [
    '............................................',
    '............................................',
    '............................................',
    '...........................f................',
    '............................................',
    '............................................',
    '............o.o.o.......o.o.o.Z.............',
    '..........=========...==========............',
    '............................................',
    '........J......b....E......b.....O.....e....',
    '############################################',
    '############################################'] };

  // the widowmaker (championship): pad over a six tile gap, straight onto a second pad,
  // up onto a long overpass that carries you over the next drop
  C.race_l = { rows: [
    '................................................',
    '................................................',
    '................................................',
    '.........................f..........f...........',
    '...........ooo..................................',
    '................................................',
    '..............................o.o.o.o.o.o.Z.....',
    '............................================....',
    '................................................',
    '..........J...............J........e............',
    '###########.....###########.....######....######',
    '###########.....###########.....######....######'] };

  // heat 2 insert: a billboard overpass with the mine hopper sitting on top (Q)
  C.race_q_billboard = { rows: [
    '........................................',
    '........................................',
    '........................................',
    '........................................',
    '........................................',
    '........................................',
    '..............o.o.Q.o.o.................',
    '..........=================.............',
    '........................................',
    '........J......O.....e......^^..........',
    '########################################',
    '########################################'] };

  /* ---------- floor 11: the parade route (theme parade) ----------
     Carl rides the float along row 7-8; hecklers stand on balconies '='. */
  C.parade_start = { rows: [
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '.................o.o.o.o........',
    '................................',
    '....P...........................',
    '################################',
    '################################'] };

  C.parade_a = { rows: [
    '........................................',
    '........................................',
    '........................................',
    '........................................',
    '......e...................e.............',
    '....=====...............=====...........',
    '........................................',
    '...........o.o.o..............h.........',
    '........................................',
    '..................e.....................',
    '########################################',
    '########################################'] };

  C.parade_b = { rows: [
    '........................................',
    '........................................',
    '..........f.................f...........',
    '........................................',
    '..................e.....................',
    '................=====...................',
    '........................................',
    '....o.o.o...................o.o.o.......',
    '........................................',
    '...........e.....................e......',
    '########################################',
    '########################################'] };

  C.parade_c = { rows: [
    '........................................',
    '........................................',
    '........................................',
    '........................................',
    '...e............................e.......',
    '..====.........................====.....',
    '........................................',
    '.............ooooo......................',
    '........................................',
    '.......e...........E...........e........',
    '########################################',
    '########################################'] };

  C.parade_d = { rows: [
    '........................................',
    '........................................',
    '........................................',
    '.................f......................',
    '........................................',
    '........................................',
    '......o.o.o.o.o.......o.o.o.o.o.........',
    '........................................',
    '........................................',
    '....................h...................',
    '########################################',
    '########################################'] };

  // the reviewing stand at the end of the route
  C.arena_marshal = { rows: [
    'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
    'X..........................................X',
    'X..........................................X',
    'X..........................................X',
    'X.........====..............====...........X',
    '...........................................X',
    '...........................................X',
    '.....====..........======..........====....X',
    '...........................................X',
    '..c.....h.........................K........X',
    '############################################',
    '############################################'] };
})();

/* ==========================================================================
   STAGES + FLOORS
   ========================================================================== */
(function () {
  'use strict';
  var D = window.DCW.data;
  var S = D.stages = {};

  function st(id, o) { o.id = id; S[id] = o; return o; }

  /* shared enemy mixes */
  var MIX = {
    f1:      { enemies: [['rat', 4], ['roach', 3], ['goblin', 2]], elite: [['goblin', 1]], flyers: [['bat', 1]] },
    f2:      { enemies: [['goblin', 4], ['goblin_archer', 3], ['grub', 2], ['shaman', 1], ['juicer_minion', 1]], elite: [['goblin_brute', 3], ['juicer_minion', 1]], flyers: [['bat', 1]] },
    city3:   { enemies: [['clown', 3], ['rat', 2], ['gator', 1]], elite: [['clown_brute', 1]], flyers: [['skyfowl', 1]] },
    circus3: { enemies: [['clown', 5], ['rat', 1]], elite: [['clown_brute', 1]], flyers: [['skyfowl', 1]] },
    swamp3:  { enemies: [['gator', 3], ['clown', 1], ['rat', 1]], elite: [['swamp_troll', 1]], flyers: [['skyfowl', 1]] },
    train4:  { enemies: [['rail_rat', 4], ['steam_goblin', 3], ['bat', 1]], elite: [['conductor', 1]], flyers: [['bat', 1]] },
    city4:   { enemies: [['steam_goblin', 3], ['rail_rat', 2], ['clown', 1]], elite: [['conductor', 2], ['clown_brute', 1]], flyers: [['bat', 1], ['skyfowl', 1]] },
    bubble5: { enemies: [['fishman', 4], ['gator', 1]], elite: [['crab', 1]], flyers: [['jelly', 1]] },
    swamp5:  { enemies: [['gator', 2], ['fishman', 3]], elite: [['crab', 1], ['swamp_troll', 1]], flyers: [['jelly', 2], ['skyfowl', 1]] },
    forest6: { enemies: [['hunter', 3], ['hound', 3]], elite: [['masked_noble', 1]], flyers: [['skyfowl', 1]] },
    castle7: { enemies: [['ghoul', 4], ['skeleton', 3]], elite: [['masked_noble', 1], ['gargoyle', 1]], flyers: [['gargoyle', 2], ['bat', 1]] },
    // floor 8 (THE GHOSTS OF EARTH): town8 and mine8 replace the old ruin8 and city8 mixes (same weights and tiers)
    town8:   { enemies: [['wampus_cat', 4], ['mountain_light', 1]], elite: [['woodbooger', 1]], flyers: [['mountain_light', 1]] },
    mine8:   { enemies: [['wampus_cat', 3], ['sheepsquatch', 2]], elite: [['woodbooger', 1]], flyers: [['mountain_light', 2], ['mothling', 1]] },
    war9:    { enemies: [['soldier', 5], ['sniper', 1], ['cultist', 1], ['mutant', 1]], elite: [['war_beast', 2], ['golem', 1]], flyers: [['drone', 2], ['gargoyle', 1]] },
    // Update 3. track10 = pit crews and pests standing on the race track (the truck rams them)
    track10: { enemies: [['rail_rat', 3], ['goblin', 3], ['steam_goblin', 1]], elite: [['goblin_brute', 1]], flyers: [['drone', 2], ['skyfowl', 1]] },
    crew10:  { enemies: [['steam_goblin', 3], ['rail_rat', 3], ['juicer_minion', 2], ['goblin', 1]], elite: [['goblin_brute', 2], ['conductor', 1]], flyers: [['drone', 2], ['bat', 1]] },
    junk10:  { enemies: [['mutant', 3], ['rail_rat', 2], ['steam_goblin', 2]], elite: [['golem', 1]], flyers: [['drone', 1]] },
    city11:  { enemies: [['clown', 3], ['soldier', 2], ['cultist', 1]], elite: [['clown_brute', 2], ['masked_noble', 1]], flyers: [['skyfowl', 1], ['jelly', 1]] },
    circus11:{ enemies: [['clown', 5], ['juicer_minion', 1]], elite: [['clown_brute', 1]], flyers: [['jelly', 2], ['skyfowl', 1]] },
    castle11:{ enemies: [['ghoul', 2], ['skeleton', 2], ['clown', 1]], elite: [['masked_noble', 1], ['gargoyle', 1]], flyers: [['gargoyle', 1], ['jelly', 1]] },
    forest11:{ enemies: [['hound', 2], ['hunter', 2], ['clown', 1]], elite: [['swamp_troll', 1]], flyers: [['skyfowl', 2], ['jelly', 1]] }
  };
  function mix(name, o) { var m = MIX[name]; o.enemies = o.enemies || m.enemies; o.elite = o.elite || m.elite; o.flyers = o.flyers || m.flyers; return o; }

  var AMB = ['amb_a', 'amb_b', 'amb_c'];
  var SIDE = ['sx_a', 'sx_b', 'sx_c'];

  /* ---------------- floor 1 ---------------- */
  st('f1_s1', mix('f1', { name: 'THE DRAINAGE TUTORIAL', floor: 1, theme: 'tunnels', kind: 'main',
    chunks: { start: 'f1_tut_start', pool: ['f1_tut_mid', 'f1_a'], count: 2, end: 'f1_tut_end' },
    reward: { box: 'bronze', xp: 5 },
    intro: "TUTORIAL TIME! READ THE SIGNS, CRAWLER. THEY ARE THE ONLY THINGS DOWN HERE THAT WANT YOU TO LIVE.",
    signs: [
      "LEFT AND RIGHT TO MOVE. PRESS JUMP TO JUMP. HOLD JUMP TO JUMP HIGHER. YOU ARE DOING GREAT, SWEETIE.",
      "PRESS ATTACK TO PUNCH. PUNCH THREE TIMES FOR A COMBO. CRATES ALSO ACCEPT PUNCHES.",
      "HOLD DOWN + ATTACK ON THE GROUND TO KICK. SLOWER THAN A PUNCH. HITS LIKE A TAX BILL.",
      "IN THE AIR, HOLD DOWN + ATTACK FOR A DIVING STOMP KICK. LAND ON HEADS. BOUNCE. FEEL ALIVE.",
      "PRESS BOMB TO LOB A HOB-LOBBER. IT ARCS. IT BOOMS. IT DOES NOT CARE WHO IS STANDING THERE.",
      "PRESS POTION TO DRINK A HEALTH POTION. HEALS HALF YOUR HP. SNACKS ON THE FLOOR HEAL A LITTLE.",
      "PRINCESS DONUT FIGHTS ON HER OWN. HITTING THINGS FILLS THE SPECIAL METER. WHEN FULL, PRESS SPECIAL!",
      "SEE THE LEVER? PUNCH IT. LEVERS OPEN IRON GATES NEARBY. LATER FLOORS HIDE THEIR LEVERS. THE SHOW IS PETTY LIKE THAT."
    ] }));
  st('f1_s2', mix('f1', { name: 'THE BIG STINK', floor: 1, theme: 'tunnels', kind: 'main',
    chunks: { start: 'f1_start', pool: ['f1_a', 'f1_b', 'f1_c', 'f1_d', 'f1_e', 'f1_f', 'f1_g'], count: 5, end: 'end_door' },
    reward: { box: 'bronze', xp: 10 },
    intro: "THE SEWERS BENEATH YOUR FORMER CITY! YES, THE SMELL IS PART OF THE EXPERIENCE. NO, YOU CANNOT OPT OUT." }));
  st('f1_boss', { name: 'THE HOARD', floor: 1, theme: 'tunnels', kind: 'boss', music: 'boss',
    chunks: { start: 'f1_start', pool: ['f1_b', 'f1_d'], count: 1, end: 'arena_hoarder' },
    enemies: [['roach', 3], ['rat', 1]], elite: [['goblin', 1]], flyers: [['bat', 1]],
    boss: 'hoarder', reward: { box: 'boss', xp: 20 },
    intro: "SOMETHING IS LIVING IN THE PILE OF JUNK AHEAD. SOMETHING WITH OPINIONS ABOUT HER STUFF." });

  /* ---------------- floor 2 ---------------- */
  var P2 = ['f2_a', 'f2_b', 'f2_c', 'f2_d', 'f2_e', 'f2_f', 'f2_g', 'f2_h'];
  st('f2_s1', mix('f2', { name: 'GOBLIN FRONT DOOR', floor: 2, theme: 'cinder', kind: 'main',
    chunks: { start: 'f2_start', pool: P2.concat(['lv_crates']), count: 4, end: 'end_door' }, reward: { box: 'bronze', xp: 20 },
    intro: "GOBLIN COUNTRY! KNOCK BEFORE ENTERING. THEN PUNCH WHOEVER ANSWERS." }));
  st('f2_s2', mix('f2', { name: 'THE ARCHERY RANGE', floor: 2, theme: 'cinder', kind: 'main', rescue: 'squeaks',
    chunks: { start: 'f2_start', pool: ['f2_a', 'f2_d', 'f2_e', 'f2_g', 'f2_b', 'f2_h'], count: 5, end: 'end_door', insert: ['r_cave_target'] }, reward: { box: 'bronze', xp: 20 },
    enemies: [['goblin_archer', 4], ['goblin', 3], ['shaman', 2]],
    intro: "THE GOBLINS PRACTICE THEIR AIM HERE. GUESS WHO VOLUNTEERED TO BE THE TARGET? YOU DID. JUST NOW." }));
  st('f2_s3', mix('f2', { name: 'GRUB GULLY', floor: 2, theme: 'cinder', kind: 'main', questItem: 'goblin_key', exitNeeds: 'goblin_key', dark: true,
    chunks: { start: 'f2_start', pool: ['f2_c', 'f2_f', 'f2_b', 'f2_h', 'f2_e', 'f2_g', 'lv_gate_climb'], count: 5, end: 'end_door', insert: ['q_cave_branch'] }, reward: { box: 'silver', xp: 20 },
    enemies: [['grub', 4], ['goblin', 2], ['juicer_minion', 2], ['shaman', 1]],
    intro: "IT IS DARK. IT IS DAMP. SOMETHING IS CHEWING. STAY CLOSE TO THE CAT, SHE GLOWS WHEN SHE IS SMUG." }));
  st('f2_boss', { name: 'THE IRON GYM', floor: 2, theme: 'cinder', kind: 'boss', music: 'boss',
    chunks: { start: 'f2_start', pool: ['f2_c', 'f2_g'], count: 1, end: 'arena_juicer' },
    enemies: [['goblin', 3], ['juicer_minion', 1]], elite: [['goblin_brute', 1]], flyers: [['bat', 1]],
    boss: 'juicer', reward: { box: 'boss', xp: 35 },
    intro: "YOU HEAR GRUNTING. RHYTHMIC GRUNTING. SOMEONE IS DOING REPS ON A GOBLIN." });

  /* ---------------- floor 3 ---------------- */
  st('f3_s1', mix('city3', { name: 'TWENTY FLOORS OF RENT', floor: 3, theme: 'city', kind: 'main', questItem: 'valve', owMarker: 'ow_door',
    chunks: { start: 'f3_start', pool: ['f3_a', 'f3_d', 'f3_e', 'f3_g', 'f3_b', 'lv_cache'], count: 5, end: 'end_door', insert: ['q_city_boiler'] }, reward: { box: 'bronze', xp: 25 },
    intro: "AN APARTMENT TOWER. THE LANDLORD IS A CLOWN. THE TENANTS ARE ALSO CLOWNS. THE RENT IS YOUR LIFE." }));
  st('f3_s2', mix('circus3', { name: 'THE MIDWAY', floor: 3, theme: 'circus', kind: 'main', rescue: 'mongo', exitNeeds: 'honk_horn', owMarker: 'ow_tent',
    chunks: { start: 'f3_start', pool: ['f3_b', 'f3_f', 'f3_e', 'f3_a', 'f3_d', 'lv_gate_climb'], count: 5, end: 'end_door', insert: ['r_circus_prize'] }, reward: { box: 'silver', xp: 25 },
    intro: "STEP RIGHT UP! EVERY GAME IS RIGGED AND EVERY PRIZE BITES! FUN FOR THE WHOLE APOCALYPSE!" }));
  st('f3_s3', mix('swamp3', { name: 'STORM DRAIN BAYOU', floor: 3, theme: 'swamp', kind: 'main', questItem: 'bigtop_ticket', owMarker: 'ow_manhole',
    chunks: { start: 'f3_start', pool: ['f3_c', 'f3_h', 'f3_b', 'f3_e', 'f3_f', 'lv_crates'], count: 5, end: 'end_door', insert: ['q_swamp_stump'] }, reward: { box: 'bronze', xp: 25 },
    intro: "THE STORM DRAINS FLOODED AND THE SWAMP MOVED IN. SO DID THE GATORS. SO DID THEIR COUSINS." }));
  st('f3_x1', mix('city3', { name: 'THE LOST AND FOUND', floor: 3, theme: 'city', kind: 'side', questItem: 'honk_horn', owMarker: 'ow_door',
    chunks: { start: 'f3_start', pool: ['sx_a', 'f3_f', 'sx_b', 'f3_g', 'sx_c', 'lv_tunnel'], count: 4, end: 'end_door', insert: ['q_city_lockers'] }, reward: { box: 'silver', xp: 35 },
    intro: "A HIDDEN PARK SHED FULL OF THINGS PEOPLE DROPPED WHILE RUNNING. FINDERS KEEPERS, CRAWLER." }));
  st('f3_ambush', mix('city3', { name: 'STREET TOUGHS', floor: 3, theme: 'city', kind: 'ambush',
    chunks: { start: 'amb_start', pool: AMB, count: 1, end: 'end_door' }, reward: { xp: 10 },
    intro: "AMBUSH! THE LOCALS WOULD LIKE A WORD. THE WORD IS OW." }));
  st('f3_boss', { name: 'THE BIG TOP', floor: 3, theme: 'circus', kind: 'boss', music: 'boss', owMarker: 'ow_tent',
    chunks: { start: 'f3_start', pool: ['f3_f', 'f3_b'], count: 1, end: 'arena_ringmaster' },
    enemies: [['clown', 3]], elite: [['clown_brute', 1]], flyers: [['skyfowl', 1]],
    boss: 'ringmaster', reward: { box: 'boss', xp: 50 },
    intro: "THE BIG TOP! THE LIGHTS GO DOWN. A DRUMROLL STARTS. NOBODY IS PLAYING THE DRUM." });

  /* ---------------- floor 4 ---------------- */
  st('f4_s1', mix('city4', { name: 'PLATFORM NINE', floor: 4, theme: 'city', kind: 'main', questItem: 'switch_key', owMarker: 'ow_door',
    chunks: { start: 'f4_start', pool: ['f4_c', 'f4_f', 'f4_e', 'f4_d', 'f4_a', 'lv_tunnel'], count: 5, end: 'end_door', insert: ['q_city_stack'] }, reward: { box: 'silver', xp: 30 },
    intro: "A STATION CONCOURSE. THE DEPARTURE BOARD SAYS EVERY TRAIN IS DELAYED. FOREVER. ENJOY YOUR WAIT." }));
  st('f4_s2', mix('train4', { name: 'THE ENGINE SHED', floor: 4, theme: 'train', kind: 'main', questItem: 'drive_gear', owMarker: 'ow_door',
    chunks: { start: 'f4_start', pool: ['f4_a', 'f4_g', 'f4_h', 'f4_b', 'f4_d', 'lv_crates'], count: 5, end: 'end_door', insert: ['q_train_pit'] }, reward: { box: 'silver', xp: 30 },
    intro: "THE ENGINE SHED. MIND THE GAP BETWEEN THE CARS. THE GAP IS HUNGRY." }));
  st('f4_s3', mix('train4', { name: 'DEAD END TUNNEL', floor: 4, theme: 'train', kind: 'main', exitNeeds: 'signal_lens', owMarker: 'ow_cave', dark: true,
    chunks: { start: 'f4_start', pool: ['f4_g', 'f4_b', 'f4_h', 'f4_f', 'f4_a', 'lv_gate_climb'], count: 5, end: 'end_door' }, reward: { box: 'silver', xp: 30 },
    intro: "THE TUNNEL HAS NO LIGHTS. THE TRAINS HAVE NO DRIVERS. YOU HAVE NO PANTS. EVERYONE IS STRUGGLING." }));
  st('f4_x1', mix('train4', { name: 'THE OLD SPUR', floor: 4, theme: 'train', kind: 'side', rescue: 'samantha', owMarker: 'ow_door',
    chunks: { start: 'f4_start', pool: ['sx_b', 'f4_e', 'sx_a', 'f4_c', 'lv_cache'], count: 4, end: 'end_door', insert: ['r_train_caboose'] }, reward: { box: 'gold', xp: 45 },
    intro: "A DECOMMISSIONED PLATFORM. NOBODY COMES HERE. WHICH MEANS NOBODY TOOK THE GOOD STUFF." }));
  st('f4_x2', mix('city4', { name: 'FREIGHT MAZE', floor: 4, theme: 'city', kind: 'side', questItem: 'signal_lens', owMarker: 'ow_door',
    chunks: { start: 'f4_start', pool: ['f4_g', 'sx_c', 'f4_e', 'sx_a'], count: 4, end: 'end_door', insert: ['q_city_lockers'] }, reward: { box: 'gold', xp: 45 },
    intro: "SHIPPING CONTAINERS AS FAR AS THE EYE CAN SEE. ONE OF THEM HAS SNACKS. ONE OF THEM HAS TEETH." }));
  st('f4_ambush', mix('train4', { name: 'RAIL RAIDERS', floor: 4, theme: 'train', kind: 'ambush',
    chunks: { start: 'amb_start', pool: AMB, count: 1, end: 'end_door' }, reward: { xp: 10 },
    intro: "AMBUSH! THE YARD CREW HAS DECIDED YOU ARE CARGO." }));
  st('f4_boss', { name: 'THE ROUNDHOUSE', floor: 4, theme: 'train', kind: 'boss', music: 'boss',
    chunks: { start: 'f4_start', pool: ['f4_a', 'f4_b'], count: 1, end: 'arena_engineer' },
    enemies: [['rail_rat', 2], ['steam_goblin', 2]], elite: [['conductor', 1]], flyers: [['bat', 1]],
    boss: 'engineer', reward: { box: 'boss', xp: 60 },
    intro: "THE TRACKS ALL LEAD HERE. THE WHISTLE BLOWS. SOMETHING VERY BIG IS BACKING UP." });

  /* ---------------- floor 5 ---------------- */
  st('f5_s1', mix('bubble5', { name: 'THE SEA CAVES', floor: 5, theme: 'bubble', kind: 'main', questItem: 'tide_chart', owMarker: 'ow_cave',
    chunks: { start: 'f5_start', pool: ['f5_a', 'f5_c', 'f5_f', 'f5_b', 'f5_e', 'lv_cache'], count: 5, end: 'end_door', insert: ['q_bubble_grotto'] }, reward: { box: 'silver', xp: 35 },
    intro: "THE SEA QUADRANT OF YOUR BUBBLE! THE AIR IS WATER AND THE WATER IS ALSO WATER. PHYSICS HAS LEFT THE CHAT." }));
  st('f5_s2', mix('swamp5', { name: 'KELP MARKET', floor: 5, theme: 'swamp', kind: 'main', owMarker: 'ow_cave',
    chunks: { start: 'f5_start', pool: ['f5_d', 'f5_g', 'f5_a', 'f5_f', 'f5_b', 'lv_gate_climb', 'lv_tunnel'], count: 5, end: 'end_door' }, reward: { box: 'silver', xp: 35 },
    intro: "A FLOATING MARKET. THE FISHMEN SELL KELP. THEY ALSO SELL CRAWLERS. GUESS WHICH ONE IS IN STOCK." }));
  st('f5_s3', mix('bubble5', { name: 'THE BUBBLE GARDENS', floor: 5, theme: 'bubble', kind: 'main', exitNeeds: 'singing_conch', owMarker: 'ow_cave',
    chunks: { start: 'f5_start', pool: ['f5_e', 'f5_c', 'f5_a', 'f5_g', 'f5_f', 'lv_crates'], count: 5, end: 'end_door' }, reward: { box: 'silver', xp: 35 },
    intro: "RIDE THE BUBBLES, CRAWLER! THEY ONLY POP WHEN IT WOULD BE FUNNIEST." }));
  st('f5_s4', mix('swamp5', { name: 'MANGROVE MAZE', floor: 5, theme: 'swamp', kind: 'main', questItem: 'coral_crown', owMarker: 'ow_cave',
    chunks: { start: 'f5_start', pool: ['f5_d', 'f5_b', 'f5_f', 'f5_g', 'f5_c', 'lv_gate_climb'], count: 5, end: 'end_door', insert: ['q_swamp_roots'] }, reward: { box: 'silver', xp: 35 },
    intro: "THE MANGROVES ARE ROOTS ALL THE WAY DOWN. SOMETHING ARMORED SCUTTLES IN THERE." }));
  st('f5_x1', mix('bubble5', { name: 'THE PEARL VAULT', floor: 5, theme: 'bubble', kind: 'side', questItem: 'singing_conch', owMarker: 'ow_door',
    chunks: { start: 'f5_start', pool: ['sx_a', 'f5_e', 'sx_b', 'sx_c'], count: 4, end: 'end_door', insert: ['q_bubble_clam'] }, reward: { box: 'gold', xp: 55 },
    intro: "A LITTLE ISLAND WITH A BIG SAFE. THE SAFE HAS A CRAB. THE CRAB HAS A GRUDGE." }));
  st('f5_x2', mix('swamp5', { name: 'THE REEF SHELF', floor: 5, theme: 'swamp', kind: 'side', rescue: 'katia', owMarker: 'ow_cave',
    chunks: { start: 'f5_start', pool: ['f5_g', 'sx_c', 'f5_d', 'sx_b', 'lv_tunnel'], count: 4, end: 'end_door', insert: ['r_swamp_net'] }, reward: { box: 'gold', xp: 55 },
    intro: "THE EDGE OF THE REEF. BEYOND IT IS THE DEEP. DO NOT LOOK AT THE DEEP. IT IS LOOKING BACK." }));
  st('f5_ambush', mix('bubble5', { name: 'RIPTIDE', floor: 5, theme: 'bubble', kind: 'ambush',
    chunks: { start: 'amb_start', pool: AMB, count: 1, end: 'end_door' }, reward: { xp: 15 },
    intro: "AMBUSH! A SCHOOL OF FISHMEN. CLASS IS IN SESSION. YOU ARE THE LESSON." }));
  st('f5_boss', { name: 'THE TIDE POOL', floor: 5, theme: 'bubble', kind: 'boss', music: 'boss',
    chunks: { start: 'f5_start', pool: ['f5_c', 'f5_b'], count: 1, end: 'arena_tidemother' },
    enemies: [['fishman', 2]], elite: [['crab', 1]], flyers: [['jelly', 1]],
    boss: 'tidemother', reward: { box: 'boss', xp: 75 },
    intro: "THE WATER GOES STILL. THE BUBBLES STOP. A VERY LARGE MOTHER WOULD LIKE TO SPEAK TO YOUR MANAGER." });

  /* ---------------- floor 6 ---------------- */
  st('f6_s1', mix('forest6', { name: 'THE LODGE', floor: 6, theme: 'forest', kind: 'main', exitNeeds: 'guest_mask', owMarker: 'ow_door',
    chunks: { start: 'f6_start', pool: ['f6_a', 'f6_c', 'f6_g', 'f6_d', 'f6_b', 'lv_cache'], count: 5, end: 'end_door' }, reward: { box: 'silver', xp: 45 },
    intro: "A HUNTING LODGE! THE WALLS ARE COVERED IN TROPHIES. THERE IS AN EMPTY SPOT LABELED CARL." }));
  st('f6_s2', mix('forest6', { name: 'TRAPPER CAMP', floor: 6, theme: 'forest', kind: 'main', questItem: 'kennel_key', owMarker: 'ow_tent',
    chunks: { start: 'f6_start', pool: ['f6_d', 'f6_f', 'f6_b', 'f6_e', 'f6_a', 'lv_gate_climb'], count: 5, end: 'end_door', insert: ['q_forest_snare'] }, reward: { box: 'silver', xp: 45 },
    enemies: [['hunter', 4], ['hound', 2]],
    intro: "THE TRAPPERS SET SNARES EVERYWHERE. WATCH YOUR STEP. ACTUALLY, WATCH ALL YOUR STEPS." }));
  st('f6_s3', mix('forest6', { name: 'WOLF HOLLOW', floor: 6, theme: 'forest', kind: 'main', questItem: 'guest_mask', owMarker: 'ow_cave', dark: true,
    chunks: { start: 'f6_start', pool: ['f6_f', 'f6_b', 'f6_g', 'f6_c', 'f6_d', 'lv_crates'], count: 6, end: 'end_door', insert: ['q_forest_den'] }, reward: { box: 'silver', xp: 45 },
    enemies: [['hound', 5], ['hunter', 1]],
    intro: "A HOLLOW FULL OF HOUNDS. THEY HAVE YOUR SCENT. IT IS MOSTLY SEWER. THEY LOVE IT." }));
  st('f6_s4', mix('forest6', { name: 'THE KENNELS', floor: 6, theme: 'forest', kind: 'main', questItem: 'hunt_horn', owMarker: 'ow_door',
    chunks: { start: 'f6_start', pool: ['f6_c', 'f6_e', 'f6_a', 'f6_f', 'f6_g', 'lv_tunnel'], count: 6, end: 'end_door', insert: ['q_forest_tree'] }, reward: { box: 'silver', xp: 45 },
    intro: "WHERE THE HOUNDS ARE BRED. AND FED. GUESS WHAT IS ON THE MENU." }));
  st('f6_x1', mix('forest6', { name: 'THE QUIET GROVE', floor: 6, theme: 'forest', kind: 'side', owMarker: 'ow_cave',
    chunks: { start: 'f6_start', pool: ['sx_a', 'f6_e', 'sx_c', 'sx_b', 'lv_cache'], count: 4, end: 'end_door' }, reward: { box: 'gold', xp: 65 },
    intro: "A GROVE SO QUIET YOU CAN HEAR THE LOOT. IT SOUNDS LIKE JINGLING." }));
  st('f6_x2', mix('forest6', { name: 'THE WISHING WELL', floor: 6, theme: 'forest', kind: 'side', rescue: 'zev', owMarker: 'ow_manhole',
    chunks: { start: 'f6_start', pool: ['sx_b', 'f6_g', 'sx_a', 'f6_e'], count: 4, end: 'end_door', insert: ['r_forest_well'] }, reward: { box: 'gold', xp: 65 },
    intro: "PEOPLE THREW COINS DOWN THIS WELL FOR LUCK. NOW YOU GO DOWN THE WELL FOR THE COINS. CIRCLE OF LIFE." }));
  st('f6_ambush', mix('forest6', { name: 'THE BEATERS', floor: 6, theme: 'forest', kind: 'ambush',
    chunks: { start: 'amb_start', pool: AMB, count: 2, end: 'end_door' }, reward: { xp: 20 },
    intro: "AMBUSH! THE BEATERS FLUSHED YOU OUT OF THE BRUSH. HOW RUDE." }));
  st('f6_boss', { name: 'THE PROCESSING SHED', floor: 6, theme: 'forest', kind: 'boss', music: 'boss',
    chunks: { start: 'f6_start', pool: ['f6_a', 'f6_d'], count: 2, end: 'arena_butcher' },
    enemies: [['hound', 2], ['hunter', 1]], elite: [['masked_noble', 1]], flyers: [['skyfowl', 1]],
    boss: 'butcher', reward: { box: 'boss', xp: 90 },
    intro: "THE SHED AT THE END OF THE HUNT. THE SIGN SAYS STAFF ONLY. YOU ARE THE STAFF NOW." });

  /* ---------------- floor 7 ---------------- */
  st('f7_s1', mix('castle7', { name: 'THE WINE CELLAR', floor: 7, theme: 'castle', kind: 'main', questItem: 'invitation', exitNeeds: 'garden_key', owMarker: 'ow_door',
    chunks: { start: 'f7_start', pool: ['f7_e', 'f7_c', 'f7_g', 'f7_a', 'f7_d', 'lv_crates'], count: 5, end: 'end_door', insert: ['q_castle_cellar'] }, reward: { box: 'gold', xp: 65 },
    intro: "THE CELLAR! A VINTAGE COLLECTION. THE WINE IS FOUR HUNDRED YEARS OLD. SO IS THE BUTLER." }));
  st('f7_s2', mix('castle7', { name: 'THE BALLROOM', floor: 7, theme: 'castle', kind: 'main', questItem: 'bridal_tiara', owMarker: 'ow_door',
    chunks: { start: 'f7_start', pool: ['f7_a', 'f7_f', 'f7_b', 'f7_g', 'f7_c', 'lv_gate_climb'], count: 5, end: 'end_door', insert: ['q_castle_balcony'] }, reward: { box: 'gold', xp: 65 },
    intro: "THE DANCE OF THE DEAD IS ABOUT TO BEGIN! YOUR PARTNER IS A SKELETON. IT LEADS." }));
  st('f7_s3', mix('castle7', { name: 'THE GREENHOUSE', floor: 7, theme: 'castle', kind: 'main', questItem: 'garden_key', owMarker: 'ow_door',
    chunks: { start: 'f7_start', pool: ['f7_d', 'f7_b', 'f7_f', 'f7_e', 'f7_g', 'lv_tunnel'], count: 6, end: 'end_door', insert: ['q_castle_vines'] }, reward: { box: 'gold', xp: 65 },
    intro: "THE GREENHOUSE. THE PLANTS HAVE NOT BEEN WATERED IN CENTURIES. THEY HAVE FOUND OTHER WAYS TO DRINK." }));
  st('f7_s4', mix('castle7', { name: 'THE CHAPEL CRYPT', floor: 7, theme: 'castle', kind: 'main', owMarker: 'ow_door', dark: true,
    chunks: { start: 'f7_start', pool: ['f7_e', 'f7_d', 'f7_a', 'f7_c', 'f7_b', 'lv_cache', 'lv_crates'], count: 6, end: 'end_door' }, reward: { box: 'gold', xp: 65 },
    enemies: [['ghoul', 3], ['skeleton', 4]],
    intro: "THE CRYPT UNDER THE CHAPEL. SHHH. EVERYONE DOWN HERE IS SLEEPING. LIGHTLY." }));
  st('f7_x1', mix('castle7', { name: 'HEART OF THE HEDGE', floor: 7, theme: 'castle', kind: 'side', rescue: 'signet', owMarker: 'ow_cave',
    chunks: { start: 'f7_start', pool: ['sx_b', 'f7_g', 'sx_a', 'sx_c'], count: 4, end: 'end_door', insert: ['r_castle_hedge'] }, reward: { box: 'platinum', xp: 100 },
    intro: "YOU SOLVED THE HEDGE MAZE! MOST PEOPLE JUST DIE IN IT. THE PRIZE IS IN HERE SOMEWHERE." }));
  st('f7_ambush', mix('castle7', { name: 'NIGHT WATCH', floor: 7, theme: 'castle', kind: 'ambush',
    chunks: { start: 'amb_start', pool: AMB, count: 2, end: 'end_door' }, reward: { xp: 25 },
    intro: "AMBUSH! THE GROUNDSKEEPERS NEVER CLOCKED OUT. NOT EVEN WHEN THEY DIED." }));
  st('f7_boss', { name: 'THE GRAND STAIR', floor: 7, theme: 'castle', kind: 'boss', music: 'boss',
    chunks: { start: 'f7_start', pool: ['f7_a', 'f7_g'], count: 2, end: 'arena_bride' },
    enemies: [['ghoul', 2], ['skeleton', 1]], elite: [['gargoyle', 1]], flyers: [['bat', 1]],
    boss: 'bride', reward: { box: 'boss', xp: 130 },
    intro: "AN ORGAN PLAYS A WEDDING MARCH. BADLY. FROM INSIDE THE WALLS." });

  /* ---------------- floor 8: THE GHOSTS OF EARTH ---------------- */
  // A replica West Virginia river town on December 10th. Layouts (chunks) are the old ruin floor's.
  st('f8_s1', mix('town8', { name: 'MAIN STREET', floor: 8, theme: 'ghosttown', kind: 'main', questItem: 'security_badge', owMarker: 'ow_door',
    chunks: { start: 'f8_start', pool: ['f8_a', 'f8_e', 'f8_g', 'f8_f', 'f8_d', 'lv_gate_climb'], count: 6, end: 'end_door', insert: ['q_ruin_store'] }, reward: { box: 'gold', xp: 70 },
    intro: "MAIN STREET! FIFTEEN SHOPPING DAYS LEFT UNTIL CHRISTMAS. FOREVER. THE GHOSTS ARE STILL LOOKING FOR PARKING." }));
  st('f8_s2', mix('mine8', { name: 'THE NUMBER NINE MINE', floor: 8, theme: 'ghostmine', kind: 'main', questItem: 'power_cell', owMarker: 'ow_cave', dark: true,
    chunks: { start: 'f8_start', pool: ['f8_b', 'f8_e', 'f8_d', 'f8_g', 'f8_a', 'lv_crates'], count: 6, end: 'end_door', insert: ['q_city_boiler'] }, reward: { box: 'gold', xp: 70 },
    intro: "THE OLD COAL MINE. THE NIGHT SHIFT IS STILL DOWN HERE, SWINGING PICKS AT NOTHING. THEY DO NOT KNOW. DO NOT TELL THEM." }));
  st('f8_s3', mix('town8', { name: 'THE HIGH SCHOOL', floor: 8, theme: 'ghosttown', kind: 'main', exitNeeds: 'power_cell', owMarker: 'ow_door',
    chunks: { start: 'f8_start', pool: ['f8_c', 'f8_f', 'f8_b', 'f8_e', 'f8_g', 'lv_cache', 'lv_tunnel'], count: 6, end: 'end_door' }, reward: { box: 'gold', xp: 70 },
    elite: [['woodbooger', 2]],
    intro: "THE WINTER DANCE IS TONIGHT! THE GHOST BAND PLAYS THE SAME THREE SONGS ON A LOOP. THE CHAPERONES ARE BIGFOOT." }));
  st('f8_s4', mix('town8', { name: 'THE RADIO STATION', floor: 8, theme: 'ghosttown', kind: 'main', questItem: 'tower_lens', owMarker: 'ow_door',
    chunks: { start: 'f8_start', pool: ['f8_d', 'f8_c', 'f8_a', 'f8_b', 'f8_f', 'lv_gate_climb'], count: 6, end: 'end_door', insert: ['q_ruin_mast'] }, reward: { box: 'gold', xp: 70 },
    enemies: [['wampus_cat', 2], ['mountain_light', 3]],
    intro: "THE LOCAL AM STATION. A GHOST DJ IS TAKING CALLS ABOUT STRANGE LIGHTS ON THE RIDGE. THE LIGHTS ARE CALLING BACK." }));
  st('f8_x1', mix('town8', { name: 'THE MOONSHINE CAVE', floor: 8, theme: 'ghostmine', kind: 'side', owMarker: 'ow_cave',
    chunks: { start: 'f8_start', pool: ['sx_a', 'f8_e', 'sx_c', 'sx_b', 'lv_cache'], count: 4, end: 'end_door' }, reward: { box: 'platinum', xp: 110 },
    intro: "A HIDDEN STILL IN A HILLSIDE CAVE. THE GHOST RUNNING IT HAS BEEN TASTE TESTING SINCE 1931. HE SEEMS HAPPY." }));
  st('f8_x2', mix('mine8', { name: 'THE TOY STORE', floor: 8, theme: 'ghosttown', kind: 'side', owMarker: 'ow_door',
    chunks: { start: 'f8_start', pool: ['f8_g', 'sx_b', 'f8_d', 'sx_c'], count: 4, end: 'end_door' }, reward: { box: 'platinum', xp: 110 },
    intro: "EVERY TOY ON EVERY WISH LIST AND NOBODY AT THE REGISTER. TAKE IT ALL. IT TURNS TO DUST WHEN THE FLOOR GOES ANYWAY." }));
  st('f8_ambush', mix('mine8', { name: 'SOMETHING IN THE SNOW', floor: 8, theme: 'ghosttown', kind: 'ambush',
    chunks: { start: 'amb_start', pool: AMB, count: 2, end: 'end_door' }, reward: { xp: 25 },
    intro: "AMBUSH! THE LOCALS TELL STORIES ABOUT THESE HILLS. THE STORIES JUST CAUGHT UP WITH YOU." }));
  st('f8_boss', { name: 'THE TOWN SQUARE', floor: 8, theme: 'ghosttown', kind: 'boss', music: 'boss',
    chunks: { start: 'f8_start', pool: ['f8_d', 'f8_a'], count: 2, end: 'arena_mothman' },
    enemies: [['wampus_cat', 2]], elite: [['woodbooger', 1]], flyers: [['mothling', 1]],
    boss: 'mothman', reward: { box: 'boss', xp: 145 },
    intro: "THE TREE LIGHTING CEREMONY. THE WHOLE GHOST TOWN CAME OUT. SOMETHING WITH RED EYES IS SITTING ON TOP OF THE TREE." });

  /* ---------------- floor 9 ---------------- */
  st('f9_s1', mix('war9', { name: 'BUNKER ROW', floor: 9, theme: 'warzone', kind: 'main', questItem: 'field_map', owMarker: 'ow_door',
    chunks: { start: 'f9_start', pool: ['f9_c', 'f9_a', 'f9_g', 'f9_e', 'f9_b', 'lv_crates'], count: 6, end: 'end_door', insert: ['q_war_bunker'] }, reward: { box: 'gold', xp: 80 },
    intro: "THE FACTIONS HAVE DUG IN. EVERY BUNKER HAS A FLAG. EVERY FLAG HAS A SPONSOR." }));
  st('f9_s2', mix('war9', { name: 'THE TRENCHES', floor: 9, theme: 'warzone', kind: 'main', exitNeeds: 'blast_charge', owMarker: 'ow_manhole',
    chunks: { start: 'f9_start', pool: ['f9_a', 'f9_b', 'f9_f', 'f9_d', 'f9_g', 'lv_gate_climb', 'lv_tunnel'], count: 6, end: 'end_door' }, reward: { box: 'gold', xp: 80 },
    intro: "DOWN INTO THE TRENCHES. IT IS MUDDY, IT IS LOUD, AND THE CATERING IS TERRIBLE." }));
  st('f9_s3', mix('war9', { name: 'ARTILLERY HILL', floor: 9, theme: 'warzone', kind: 'main', questItem: 'blast_charge', owMarker: 'ow_door',
    chunks: { start: 'f9_start', pool: ['f9_f', 'f9_d', 'f9_b', 'f9_e', 'f9_a', 'lv_cache'], count: 6, end: 'end_door', insert: ['q_war_hill'] }, reward: { box: 'gold', xp: 80 },
    enemies: [['soldier', 3], ['sniper', 3], ['mutant', 1]],
    intro: "THE BIG GUNS LIVE UP HERE. THEY ARE AIMED AT YOU. THEY ARE ALWAYS AIMED AT YOU." }));
  st('f9_s4', mix('war9', { name: 'CHURCH OF THE RATINGS', floor: 9, theme: 'warzone', kind: 'main', owMarker: 'ow_door',
    chunks: { start: 'f9_start', pool: ['f9_g', 'f9_c', 'f9_e', 'f9_f', 'f9_d', 'lv_crates', 'lv_gate_climb'], count: 6, end: 'end_door' }, reward: { box: 'gold', xp: 80 },
    enemies: [['cultist', 2], ['soldier', 2], ['mutant', 2]],
    intro: "THE CULT OF THE SHOW. THEY PRAY TO THE CAMERAS. THE CAMERAS DO NOT PRAY BACK. RUDE." }));
  st('f9_x1', mix('war9', { name: 'SUPPLY DROP', floor: 9, theme: 'warzone', kind: 'side', owMarker: 'ow_tent',
    chunks: { start: 'f9_start', pool: ['sx_c', 'f9_g', 'sx_a', 'sx_b'], count: 4, end: 'end_door' }, reward: { box: 'platinum', xp: 120 },
    intro: "A SPONSOR DROPPED A CRATE OF GOODIES INTO THE CORNER. FINDERS KEEPERS. SHOOTERS WEEPERS." }));
  st('f9_x2', mix('war9', { name: 'THE DROPSHIP', floor: 9, theme: 'warzone', kind: 'side', questItem: 'backstage_pass', owMarker: 'ow_door',
    chunks: { start: 'f9_start', pool: ['f9_e', 'sx_b', 'f9_c', 'sx_a'], count: 4, end: 'end_door', insert: ['q_war_wreck'] }, reward: { box: 'platinum', xp: 120 },
    intro: "A CRASHED FACTION DROPSHIP. THE PILOT IS GONE. THE CARGO IS NOT. GO GO GO!" }));
  st('f9_ambush', mix('war9', { name: 'CROSSFIRE', floor: 9, theme: 'warzone', kind: 'ambush',
    chunks: { start: 'amb_start', pool: AMB, count: 2, end: 'end_door' }, reward: { xp: 30 },
    intro: "AMBUSH! A PATROL FROM BOTH FACTIONS. THEY AGREE ON ONE THING. YOU." }));
  st('f9_boss', { name: 'THE SOUNDSTAGE', floor: 9, theme: 'warzone', kind: 'boss', music: 'boss',
    chunks: { start: 'f9_start', pool: ['f9_a', 'f9_d'], count: 2, end: 'arena_showrunner' },
    enemies: [['soldier', 2], ['cultist', 1]], elite: [['war_beast', 1]], flyers: [['drone', 1]],
    boss: 'showrunner', reward: { box: 'boss', xp: 200 },
    intro: "THE BROADCAST TOWER. THE STUDIO AUDIENCE IS SEATED. THE APPLAUSE SIGN IS ON. THE BIGGEST BOSS YET, CRAWLER." });

  /* ---------------- floor 10: the races (Update 3) ----------------
     Heats 1-3 unlock in order (floor.locks afterCleared). Finish top `place` to clear.
     Side areas A and C are on foot and hold truck upgrades; heat 2 hides a third one
     on the billboard overpass. */
  var RACE_EASY = ['race_a', 'race_b', 'race_c', 'race_d', 'race_e'];
  st('f10_r1', mix('track10', { name: 'HEAT 1: MAPLE DRIVE', floor: 10, theme: 'raceway', kind: 'race', music: 'floor10', owMarker: 'ow_garage',
    race: { rivals: ['goblin_bike', 'beetle_mount', 'steam_buggy'], place: 3 },
    chunks: { start: 'race_start', pool: RACE_EASY, count: 6, end: 'race_finish' }, reward: { box: 'gold', xp: 90 },
    intro: "HEAT ONE! THREE NEIGHBORS, ONE FOOD TRUCK, AND A ROAD FULL OF THINGS THAT WANT TO BE HIT. FINISH TOP THREE!" }));
  st('f10_r2', mix('track10', { name: 'HEAT 2: THE BYPASS', floor: 10, theme: 'raceway', kind: 'race', music: 'floor10', owMarker: 'ow_garage',
    questItem: 'meatball_mines',
    race: { rivals: ['skull_chariot', 'goblin_bike', 'steam_buggy'], place: 3 },
    chunks: { start: 'race_grid', pool: ['race_a', 'race_c', 'race_d', 'race_f', 'race_g', 'race_h'], count: 6, end: 'race_finish', insert: ['race_q_billboard'] },
    reward: { box: 'gold', xp: 100 },
    intro: "HEAT TWO! OVERPASSES, JUMP PADS, AND A BILLBOARD WITH SOMETHING SHINY ON TOP. TAKE THE HIGH ROAD. TOP THREE OR BUST!" }));
  st('f10_r3', mix('track10', { name: "HEAT 3: DEAD MAN'S CURVE", floor: 10, theme: 'raceway', kind: 'race', music: 'floor10', owMarker: 'ow_garage',
    race: { rivals: ['skull_chariot', 'beetle_mount', 'steam_buggy', 'goblin_bike'], place: 3 },
    chunks: { start: 'race_grid', pool: ['race_d', 'race_f', 'race_g', 'race_h', 'race_i', 'race_j', 'race_k'], count: 7, end: 'race_finish' },
    reward: { box: 'platinum', xp: 110 },
    elite: [['goblin_brute', 2], ['conductor', 1]],
    intro: "HEAT THREE! DEAD MAN'S CURVE IS NAMED AFTER A MAN. HE IS STILL HERE. HE IS THE CURVE NOW. ALL FOUR RIVALS. TOP THREE!" }));
  st('f10_x1', mix('junk10', { name: 'THE SCRAPYARD', floor: 10, theme: 'ruin', kind: 'side', questItem: 'scrap_plating', owMarker: 'ow_door',
    chunks: { start: 'f8_start', pool: ['f8_a', 'f8_c', 'f8_f', 'sx_a', 'lv_crates'], count: 4, end: 'end_door', insert: ['q_ruin_crusher'] }, reward: { box: 'platinum', xp: 130 },
    intro: "A SCRAPYARD BEHIND THE WEST FENCE. CARS GO IN, CUBES COME OUT. SOMEWHERE IN HERE IS A VERY GOOD SLAB OF ARMOR." }));
  st('f10_x2', mix('crew10', { name: 'AUTO PARTS SUPERSTORE', floor: 10, theme: 'city', kind: 'side', questItem: 'turbo_kit', owMarker: 'ow_door',
    chunks: { start: 'f4_start', pool: ['f4_c', 'f4_e', 'sx_c', 'f8_d', 'lv_tunnel'], count: 4, end: 'end_door', insert: ['q_city_lift'] }, reward: { box: 'platinum', xp: 130 },
    intro: "AN AUTO PARTS SUPERSTORE! EVERYTHING IS ON SALE! THE STAFF ARE GOBLINS ON STRIKE. THEY ARE STRIKING YOU." }));
  st('f10_ambush', mix('crew10', { name: 'PIT CREW BRAWL', floor: 10, theme: 'city', kind: 'ambush',
    chunks: { start: 'amb_start', pool: AMB, count: 2, end: 'end_door' }, reward: { xp: 30 },
    intro: "AMBUSH! A RIVAL PIT CREW WANTS TO CHANGE YOUR TIRES. YOU DO NOT HAVE TIRES. THEY WILL IMPROVISE." }));
  st('f10_boss', mix('track10', { name: 'THE FINAL HEAT', floor: 10, theme: 'raceway', kind: 'race', music: 'floor10', owMarker: 'ow_garage',
    race: { rivals: ['champion'], place: 1, boss: 'champion' },
    chunks: { start: 'race_pole', pool: ['race_e', 'race_f', 'race_g', 'race_h', 'race_i', 'race_j', 'race_k', 'race_l'], count: 8, end: 'race_finish' },
    elite: [['goblin_brute', 2], ['conductor', 1]], flyers: [['drone', 3], ['skyfowl', 1]],
    reward: { box: 'boss', xp: 240 },
    intro: "THE FINAL HEAT! ONE RACE, ONE RIVAL, ONE WAY DOWN. VORN DREADAXLE HAS NEVER LOST. THERE IS A FIRST TIME FOR EVERYTHING!" }));

  /* ---------------- floor 11: the parade (Update 3) ----------------
     Four areas on foot, each with one float part behind a lever puzzle. The parade (B)
     needs all four parts. Beating the grand marshal ends the game. */
  st('f11_s1', mix('city11', { name: 'CONFETTI ALLEY', floor: 11, theme: 'city', kind: 'main', questItem: 'confetti_cannon', owMarker: 'ow_door',
    chunks: { start: 'f3_start', pool: ['f3_a', 'f3_d', 'f8_g', 'f4_e', 'lv_cache'], count: 6, end: 'end_door', insert: ['q_city_cannon'] }, reward: { box: 'gold', xp: 100 },
    intro: "CONFETTI ALLEY! THE SHOPS SELL STREAMERS, PARTY HATS AND RIOT GEAR. THE PARADE CROWD IS ALREADY ROWDY." }));
  st('f11_s2', mix('circus11', { name: 'THE BALLOON BARN', floor: 11, theme: 'circus', kind: 'main', questItem: 'balloon_rig', owMarker: 'ow_tent',
    chunks: { start: 'f3_start', pool: ['f3_b', 'f3_f', 'f3_e', 'sx_b', 'lv_gate_climb'], count: 6, end: 'end_door', insert: ['q_circus_balloons'] }, reward: { box: 'gold', xp: 100 },
    intro: "THE BALLOON BARN! WHERE BALLOONS ARE BORN. SOME OF THEM HAVE TEETH. DO NOT POP THE ONES WITH TEETH. OK, POP THEM." }));
  st('f11_s3', mix('castle11', { name: 'THE GILDED HALL', floor: 11, theme: 'castle', kind: 'main', questItem: 'gala_banner', owMarker: 'ow_door',
    chunks: { start: 'f7_start', pool: ['f7_a', 'f7_b', 'f7_f', 'f7_g', 'lv_tunnel'], count: 6, end: 'end_door', insert: ['q_castle_banner'] }, reward: { box: 'gold', xp: 100 },
    intro: "THE GILDED HALL! VIP SEATING FOR THE PARADE. THE VIPS HAVE KNIVES. SO DO SOME OF THE CHANDELIERS." }));
  st('f11_s4', mix('forest11', { name: 'LANTERN PARK', floor: 11, theme: 'forest', kind: 'main', questItem: 'spotlight_rig', owMarker: 'ow_cave',
    chunks: { start: 'f6_start', pool: ['f6_a', 'f6_c', 'f6_e', 'f6_g', 'lv_crates'], count: 6, end: 'end_door', insert: ['q_forest_lantern'] }, reward: { box: 'gold', xp: 100 },
    intro: "LANTERN PARK! A QUIET GROVE STRUNG WITH LIGHTS. QUIET UNTIL YOU SHOWED UP. THE TREES ARE TAKING NOTES." }));
  st('f11_ambush', mix('city11', { name: 'HECKLER MOB', floor: 11, theme: 'city', kind: 'ambush',
    chunks: { start: 'amb_start', pool: AMB, count: 2, end: 'end_door' }, reward: { xp: 35 },
    intro: "AMBUSH! A MOB OF HECKLERS. THEY HAVE OPINIONS ABOUT YOUR FLOAT. THEY ARE EXPRESSING THEM WITH FISTS." }));
  st('f11_boss', { name: 'THE PARADE ROUTE', floor: 11, theme: 'parade', kind: 'parade', music: 'boss_final', owMarker: 'ow_float',
    chunks: { start: 'parade_start', pool: ['parade_a', 'parade_b', 'parade_c', 'parade_d'], count: 4, end: 'arena_marshal' },
    enemies: [['clown', 3], ['soldier', 1]], elite: [['clown_brute', 1]], flyers: [['jelly', 2], ['skyfowl', 1]],
    parade: { speed: 34, waves: [['clown', 4], ['jelly', 3], ['skyfowl', 2], ['soldier', 1], ['rail_rat', 1]] },
    boss: 'grand_marshal', reward: { box: 'boss', xp: 300 },
    intro: "THE PARADE ROUTE! RIDE YOUR FLOAT PAST THE JUDGING STANDS, PUNCH THE HECKLERS AND WAVE. ALWAYS WAVE. THE MARSHAL WAITS AT THE END." });

  /* ---------------- quest items (Update 2) ----------------
     Each sits in exactly one stage (stages[id].questItem, a 'Q' in an insert
     chunk) and opens floor.locks entrances and/or stages[id].exitNeeds doors.
     hint = where to look (shown on padlocked exit doors). */
  D.questItems = {
    goblin_key: { name: 'GOBLIN SKELETON KEY', floor: 2, sprite: 'qi_key',
      desc: "A KEY CARVED FROM SOMEBODY'S FINGER BONE. OPENS THE PADLOCK ON THE GRUB GULLY EXIT. DO NOT ASK WHOSE FINGER.",
      hint: "THE GOBLINS HIDE THE KEY UP TOP. GO BACK AND FIND THE LADDER INTO THE HIGH TUNNEL. IT IS AT THE FAR END." },
    valve: { name: 'VALVE WHEEL', floor: 3, sprite: 'qi_valve',
      desc: "A RUSTY IRON WHEEL OFF A BOILER. TURN IT AT THE FLOODED STORM DRAIN AND THE WATER GOES DOWN.",
      hint: "THE APARTMENT TOWER HAS A LOCKED BOILER ROOM. THE LEVER FOR IT IS UP ON THE ROOF. THE WHEEL IS INSIDE." },
    honk_horn: { name: 'GOLDEN HONKER', floor: 3, sprite: 'qi_horn',
      desc: "A GOLD-PLATED CLOWN HORN. THE MIDWAY EXIT GATE ONLY OPENS FOR THE OFFICIAL HONK.",
      hint: "EVERYTHING DROPPED ON THIS FLOOR ENDS UP IN THE LOST AND FOUND SHED IN THE WEST PARK. LOOK IN THE LOCKERS." },
    bigtop_ticket: { name: 'BIG TOP TICKET', floor: 3, sprite: 'qi_ticket',
      desc: "ADMIT ONE. TO YOUR OWN FUNERAL, PROBABLY. THE BIG TOP WILL NOT OPEN WITHOUT IT.",
      hint: "A CLOWN WENT INTO THE STORM DRAIN BAYOU WITH A TICKET. IT IS UP ON A FLOATING ISLAND. RIDE THE LIFT." },
    switch_key: { name: 'SWITCHYARD KEY', floor: 4, sprite: 'qi_key',
      desc: "A BRASS KEY STAMPED SWITCHYARD. THROWS THE POINTS TO THE ENGINE SHED AND THE OLD SPUR.",
      hint: "THE STATION MASTER LOCKED HIS KEY IN HIS OFFICE ON PLATFORM NINE. THE LEVER IS ON THE TALL CONTAINER." },
    signal_lens: { name: 'GREEN SIGNAL LENS', floor: 4, sprite: 'qi_lens',
      desc: "GREEN GLASS FOR A RAIL SIGNAL. FIT IT AND THE TUNNEL EXIT SIGNAL FINALLY TURNS GREEN.",
      hint: "THE TUNNEL EXIT IS STUCK ON RED. SPARE SIGNAL GLASS IS STORED IN THE FREIGHT MAZE, IN A LOCKED CONTAINER." },
    drive_gear: { name: 'DRIVE GEAR', floor: 4, sprite: 'qi_gear',
      desc: "A GEAR AS BIG AS YOUR HEAD. THE ROUNDHOUSE TURNTABLE WILL NOT TURN WITHOUT IT.",
      hint: "THE ENGINE SHED HAS A PIT FULL OF SPARE GEARS UNDER A HATCH. THE HATCH LEVER IS PAST THE PIT." },
    tide_chart: { name: 'TIDE CHART', floor: 5, sprite: 'qi_map',
      desc: "A SOGGY MAP OF THE CURRENTS. SHOWS THE WAY INTO THE MANGROVE MAZE AND OUT TO THE REEF SHELF.",
      hint: "THE SEA CAVES HAD A MAPMAKER. HIS CHART IS IN A HIGH ALCOVE. CLIMB THE CORAL TO THE LEVER, THEN RIDE A BUBBLE." },
    singing_conch: { name: 'SINGING CONCH', floor: 5, sprite: 'qi_shell',
      desc: "A SHELL THAT HUMS. THE EXIT BUBBLE IN THE GARDENS ONLY RISES WHEN IT HEARS THE TUNE.",
      hint: "THE PEARL VAULT ON THE WEST ISLAND KEEPS A SINGING SHELL. THE VAULT LEVER IS ON A PERCH. TAKE A BUBBLE UP." },
    coral_crown: { name: 'CORAL CROWN', floor: 5, sprite: 'qi_crown',
      desc: "THE TIDEMOTHER'S SPARE CROWN. WEAR IT TO THE TIDE POOL AND SHE HAS TO RECEIVE YOU.",
      hint: "THE CROWN IS TANGLED HIGH IN THE MANGROVE MAZE, IN A NEST OF ROOTS. YOU NEED THE TIDE CHART TO GET IN." },
    kennel_key: { name: 'KENNEL KEY', floor: 6, sprite: 'qi_key',
      desc: "A KEY ON A CHEWED LANYARD. OPENS THE KENNEL GATES. THE HOUNDS WOULD PREFER YOU DID NOT.",
      hint: "THE TRAPPERS DROPPED THE KENNEL KEY INTO ONE OF THEIR OWN SNARE PITS. FALL IN. THERE IS A LEVER DOWN THERE." },
    guest_mask: { name: 'GUEST MASK', floor: 6, sprite: 'qi_mask',
      desc: "A FANCY HUNTING-PARTY MASK. THE LODGE DOORMAN ONLY LETS MASKED GUESTS LEAVE.",
      hint: "A LODGE GUEST WANDERED INTO WOLF HOLLOW AND THE WOLVES DRAGGED HIS MASK INTO THEIR DEN UNDER THE HILL." },
    hunt_horn: { name: 'HUNTING HORN', floor: 6, sprite: 'qi_horn',
      desc: "THE GAMEKEEPER'S HORN. BLOW IT AT THE PROCESSING SHED AND THE BUTCHER COMES OUT TO PLAY.",
      hint: "THE BUTCHER'S HORN HANGS IN THE KENNELS, OUT ON A BRANCH OF THE BIG TREE. CLIMB THE IVY." },
    invitation: { name: 'BLACK INVITATION', floor: 7, sprite: 'qi_ticket',
      desc: "A BLACK CARD WITH SILVER LETTERS. YOU ARE INVITED TO THE BALLROOM. DRESS CODE: ALIVE OR OTHERWISE.",
      hint: "THE BUTLER HID SPARE INVITATIONS IN THE WINE CELLAR, BEHIND THE RACKS. SMASH THE RACK, PULL THE LEVER." },
    garden_key: { name: 'GARDEN KEY', floor: 7, sprite: 'qi_key',
      desc: "A KEY WRAPPED IN IVY. OPENS THE CELLAR GARDEN DOOR AND THE GATE OF THE HEDGE MAZE.",
      hint: "THE GARDENER KEPT HIS KEY IN THE GREENHOUSE, UP IN A GLASS BOX OVER THE VINES. FIND THE OTHER VINE FIRST." },
    bridal_tiara: { name: 'BRIDAL TIARA', floor: 7, sprite: 'qi_crown',
      desc: "A TIARA OF BLACK PEARLS. THE BRIDE WILL NOT COME DOWN THE GRAND STAIR WITHOUT IT.",
      hint: "THE BRIDE LEFT HER TIARA ON THE BALLROOM BALCONY. THE BALCONY LEVER HANGS FROM A CHANDELIER." },
    // floor 8 (THE GHOSTS OF EARTH): ids kept from the old ruin floor so the lock chain is unchanged
    security_badge: { name: 'STATION KEYS', floor: 8, sprite: 'qi_key',
      desc: "THE NIGHT DJ'S KEYS ON A REINDEER LANYARD. SOLID, REAL, AND DUST BY NEXT WEEK. OPENS THE RADIO STATION.",
      hint: "THE DJ LOST HIS KEYS ON MAIN STREET. THE LOST AND FOUND IS IN THE DEPARTMENT STORE. ITS LEVER IS UP ON THE ROOF." },
    power_cell: { name: 'CARBIDE LAMP', floor: 8, sprite: 'qi_lamp',
      desc: "A MINER'S HEADLAMP, STILL HISSING. THE ONLY LIGHT THAT REACHES THE HIGH SCHOOL BOILER TUNNEL.",
      hint: "THE NUMBER NINE MINE HAS A LAMP ROOM. THE GHOST FOREMAN LOCKED IT. THE LEVER IS ON THE ROOF OF THE MINE OFFICE." },
    tower_lens: { name: 'RED BEACON', floor: 8, sprite: 'qi_beacon',
      desc: "THE BLINKING RED LIGHT FROM THE TOP OF THE RADIO MAST. THE MOTHMAN CANNOT RESIST IT. NEITHER CAN MOTHS.",
      hint: "THE BEACON SITS ON TOP OF THE RADIO STATION MAST. CLIMB THE LADDER, THEN HOP THE SWINGING RIG." },
    field_map: { name: 'MINEFIELD MAP', floor: 9, sprite: 'qi_map',
      desc: "A SPONSOR-BRANDED MAP OF EVERY MINE ON ARTILLERY HILL. MOSTLY ACCURATE. MOSTLY.",
      hint: "THE MAP IS IN A COMMAND BUNKER ON BUNKER ROW. THE ROOF HATCH LEVER IS ON THE WATCHTOWER." },
    blast_charge: { name: 'BLASTING CHARGE', floor: 9, sprite: 'qi_bolt',
      desc: "A SHAPED CHARGE WITH A SMILEY STICKER. BLOWS THE TRENCH BARRICADE AND THE DROPSHIP HULL.",
      hint: "THE GUN CREWS ON ARTILLERY HILL KEEP CHARGES IN A HIGH GUN NEST. LEVER ON THE SNIPER LEDGE, THEN TAKE THE LIFT." },
    backstage_pass: { name: 'BACKSTAGE PASS', floor: 9, sprite: 'qi_badge',
      desc: "ALL ACCESS. LAMINATED. SOUNDSTAGE SECURITY WILL WAVE YOU STRAIGHT THROUGH TO THE SHOWRUNNER.",
      hint: "THE PASS IS IN THE CARGO BAY OF THE CRASHED DROPSHIP. YOU NEED A BLASTING CHARGE TO GET INTO THE WRECK." },

    /* Update 3, floor 10: truck upgrades (the `truck` field is added to D.truck while held) */
    scrap_plating: { name: 'SCRAP ARMOR PLATING', floor: 10, sprite: 'qi_gear', truck: { hp: 15 },
      desc: "A SLAB OF STEEL CUT FROM A SCHOOL BUS. BOLT IT ON AND THE FOOD TRUCK TAKES A LOT MORE PUNISHMENT.",
      hint: "THE SCRAPYARD BEHIND THE WEST FENCE KEEPS ITS GOOD PLATE IN THE CRUSHER SHED. THE LEVER IS UP ON THE SHED ROOF." },
    turbo_kit: { name: 'TURBOCHARGER', floor: 10, sprite: 'qi_bolt', truck: { speed: 25 },
      desc: "A TURBO STILL IN THE BOX. THE FOOD TRUCK GOES FASTER. THE FRYER ALSO GOES FASTER. DO NOT THINK ABOUT IT.",
      hint: "THE AUTO PARTS SUPERSTORE ON THE EAST SIDE HAS ONE TURBO LEFT, ON THE TOP SHELF BEHIND A GATE. CLIMB THE PALLETS." },
    meatball_mines: { name: 'MEATBALL MINE HOPPER', floor: 10, sprite: 'qi_shell', truck: { mines: true },
      desc: "A HOPPER OF EXPLOSIVE MEATBALLS. DROP THEM BEHIND THE TRUCK FOR FREE. NO BOMBS NEEDED. DO NOT EAT THEM.",
      hint: "SOMEBODY LEFT A MINE HOPPER ON TOP OF A BILLBOARD IN HEAT TWO. HIT THE JUMP PAD AND TAKE THE HIGH ROAD." },

    /* Update 3, floor 11: float parts (the `float` field picks the float decoration and parade perk) */
    confetti_cannon: { name: 'CONFETTI CANNON', floor: 11, sprite: 'qi_horn', float: 'confetti',
      desc: "A CANNON THAT FIRES CONFETTI HARD ENOUGH TO HURT. ON THE FLOAT IT BLASTS ANY HECKLER WHO GETS CLOSE.",
      hint: "CONFETTI ALLEY KEEPS ITS CANNON IN A ROOFTOP SHED. THE SHED LEVER IS IN AN ALLEY NOOK, BEHIND A STACK OF CRATES." },
    spotlight_rig: { name: 'SPOTLIGHT RIG', floor: 11, sprite: 'qi_lens', float: 'spotlight',
      desc: "A STAGE SPOTLIGHT THE SIZE OF A BATHTUB. ON THE FLOAT IT DAZZLES ANYTHING THAT FLIES.",
      hint: "LANTERN PARK HIDES A SPOTLIGHT IN A TREEHOUSE. CLIMB THE BRANCHES. THE GATE LEVER IS ON A STUMP TO THE WEST." },
    balloon_rig: { name: 'HELIUM BALLOON KIT', floor: 11, sprite: 'qi_valve', float: 'balloons',
      desc: "A HELIUM TANK AND A HUNDRED BALLOONS. TIED TO THE FLOAT THEY MAKE YOU LIGHT ENOUGH TO JUMP TWICE.",
      hint: "THE BALLOON BARN KEEPS ITS HELIUM UP IN THE RIGGING. PULL THE LEVER ON THE LOW PERCH, THEN RIDE THE PROP CART UP." },
    gala_banner: { name: 'SEQUIN BANNER', floor: 11, sprite: 'qi_map', float: 'banner',
      desc: "A GIANT SEQUIN BANNER THAT SAYS CARL. THE CROWD LOVES IT. THE CROWD LOVES YOU. IT HEALS YOU, SOMEHOW.",
      hint: "THE GILDED HALL BANNER HANGS IN A HIGH GALLERY. THE LEVER IS AT THE TOP OF THE BELL TOWER LADDER. ENTER FROM THE RIGHT." }
  };

  /* ---------------- racers + the food truck (Update 3, floor 10) ----------------
     Original rivals. speed/accel in px/s like D.truck; hp is how much ramming and
     missile fire they soak; aggression = how often they ram/shoot; skill = how well
     they take pads, jumps and oil. weapon = projectile id they fire, or null.
     The truck's base hp/speed get the `truck` bonuses of held quest items. */
  D.truck = { name: 'THE FOOD TRUCK', sprite: 'truck', speed: 170, accel: 140, hp: 30 };
  D.racers = {
    goblin_bike: { name: 'SKARV SPOKEGNAW', title: 'GOBLIN SPEED FREAK', vehicle: 'THE RUSTBUCKET',
      desc: "A GOBLIN ON A DIRT BIKE BUILT FROM THREE BIKES AND A LAWNMOWER. THE SIDECAR IS FULL OF BOTTLES.",
      sprite: 'racer_goblin_bike', portrait: 'p_racer_goblin_bike',
      speed: 158, accel: 155, hp: 18, aggression: 0.7, weapon: 'bottle', skill: 0.45,
      lines: ["NICE TRUCK, MEAT. SHAME ABOUT THE DRIVER. AND THE CAT. AND THE TRUCK.",
        "WHEN I PASS YOU, AND I WILL, I AM THROWING A BOTTLE. IT IS NOT PERSONAL. IT IS A LITTLE PERSONAL.",
        "SKARV SPOKEGNAW DOES NOT BRAKE. SKARV SPOKEGNAW DOES NOT KNOW WHERE THE BRAKES ARE.",
        "EAT MY DUST, TACO MAN! IT IS GOBLIN DUST. IT IS EXTRA DUSTY."] },
    skull_chariot: { name: 'LADY OSSIA VANE', title: 'THE BONE DUCHESS', vehicle: 'THE OSSUARY EXPRESS',
      desc: "A SKELETAL NOBLEWOMAN IN A GILDED CHARIOT PULLED BY TWO SKELETON HORSES. FLINGS SHARPENED BONES.",
      sprite: 'racer_skull_chariot', portrait: 'p_racer_skull_chariot',
      speed: 165, accel: 125, hp: 26, aggression: 0.45, weapon: 'knife', skill: 0.65,
      lines: ["DARLING, I HAVE BEEN DEAD FOR THREE HUNDRED YEARS AND I STILL HAVE BETTER POSTURE THAN YOU.",
        "MY HORSES HAVE NO MUSCLES, NO LUNGS AND NO MERCY. YOUR TRUCK HAS A MENU BOARD.",
        "DO TRY TO KEEP UP. WINNING BY MORE THAN A MILE IS SO TERRIBLY VULGAR.",
        "A BONE FOR YOU, PEASANT! NO, NOT TO KEEP. TO DODGE."] },
    beetle_mount: { name: 'PIP THORNWHISTLE', title: 'JOCKEY OF THE CHITIN DERBY', vehicle: 'BIG MARGARET',
      desc: "A TINY GNOME JOCKEY RIDING A RHINOCEROS BEETLE THE SIZE OF A MINIVAN. SHE SPITS SPORES WHEN ANNOYED.",
      sprite: 'racer_beetle_mount', portrait: 'p_racer_beetle_mount',
      speed: 150, accel: 175, hp: 34, aggression: 0.3, weapon: 'spore', skill: 0.7,
      lines: ["BIG MARGARET HAS SIX LEGS AND ONE HORN AND SHE HAS NEVER LOST A RACE SHE WAS AWAKE FOR.",
        "DO NOT LOOK HER IN THE EYES. ANY OF THEM. SHE TAKES IT AS A CHALLENGE.",
        "I AM SMALL BUT WIRY, FRIEND. MARGARET IS NEITHER. SHE IS A TANK WITH FEELINGS.",
        "HOLD ON, MARGARET! THE TACO MAN IS RIGHT BEHIND US! HE SMELLS LIKE ONIONS AND FEAR!"] },
    steam_buggy: { name: 'GRANNY GASKET', title: 'THE BOILER QUEEN', vehicle: 'THE KETTLE',
      desc: "A CACKLING OLD STEAM GOBLIN IN A LEAKY BRASS BUGGY. LOBS HOT RIVETS OVER HER SHOULDER WITHOUT LOOKING.",
      sprite: 'racer_steam_buggy', portrait: 'p_racer_steam_buggy',
      speed: 168, accel: 110, hp: 30, aggression: 0.55, weapon: 'rock', skill: 0.6,
      lines: ["IN MY DAY WE RACED UPHILL BOTH WAYS. ON FIRE. AND WE LIKED IT, SONNY.",
        "THE KETTLE HAS FOUR HUNDRED RIVETS. I WILL BE THROWING MOST OF THEM AT YOUR FACE.",
        "OH, A FOOD TRUCK! HOW SWEET. I WILL HAVE ONE TACO AND YOUR SPOT ON THE PODIUM.",
        "FULL STEAM AHEAD! AND A LITTLE STEAM BEHIND. THAT ONE IS FOR YOU, DEARIE."] },
    champion: { name: 'VORN DREADAXLE', title: 'SIX TIME DEATH DERBY CHAMPION', vehicle: 'THE MAULER', boss: true,
      desc: "A HULKING ARMORED OGRE DRIVING A SPIKED BIG RIG WITH A GRILLE FULL OF TEETH. THE RIG SPITS FIRE. SO DOES VORN.",
      sprite: 'racer_champion', portrait: 'p_racer_champion',
      speed: 182, accel: 130, hp: 140, aggression: 0.9, weapon: 'fireball', skill: 0.85,
      lines: ["SIX CHAMPIONSHIPS. SIX HUNDRED CRASHES. YOU WANT TO BE NUMBER SIX HUNDRED AND ONE, TACO BOY?",
        "THE MAULER EATS LITTLE TRUCKS. I AM NOT BEING POETIC. IT HAS A MOUTH. IT IS HUNGRY.",
        "SECOND PLACE IS JUST THE FIRST CRASH VICTIM. REMEMBER THAT WHEN YOU SEE MY TAILLIGHTS.",
        "NOBODY PASSES VORN DREADAXLE! NOBODY! ...WHO DID THAT? WHO JUST PASSED ME?"] }
  };

  /* ---------------- floors ---------------- */
  D.floors = [
    { n: 1, name: 'THE FIRST FLOOR', tagline: 'FIVE DAYS TO FIND THE STAIRS. MIND THE RATS.', theme: 'tunnels', music: 'floor1',
      intro: ["WELCOME, CRAWLER. WELCOME TO THE FIRST FLOOR. TORCHLIT TUNNELS, A TUTORIAL, AND RATS. SO MANY RATS.",
        "CLEAR THE STAGES, FIND THE SAFE ROOM, KILL THE BOSS. NOBODY IS WATCHING LIVE YET. THAT CHANGES ON THE SECOND FLOOR. PRACTICE YOUR SMILE."],
      sequence: ['f1_s1', 'f1_s2', 'SAFE', 'f1_boss'], overworld: null,
      required: ['f1_s1', 'f1_s2'], boss: 'f1_boss', par: 600 },
    { n: 2, name: 'THE SECOND FLOOR', tagline: 'LAST TRAINING LEVEL. NO PEEING IN THE HALLS.', theme: 'cinder', music: 'floor2',
      intro: ["WELCOME TO THE SECOND FLOOR! THE LAST TRAINING LEVEL. THE VIEWERS ARE ON NOW, SO TRY TO DIE INTERESTINGLY.",
        "THREE STAGES, A SAFE ROOM, AND A BOSS WHO HAS NEVER SKIPPED A WORKOUT. LET'S GET PHYSICAL!"],
      sequence: ['f2_s1', 'f2_s2', 'f2_s3', 'SAFE', 'f2_boss'], overworld: null,
      companion: 'squeaks',
      hints: [
        "GOBLINS LOVE TARGET PRACTICE, KID. WORD IS THEY CAUGHT A RAT FOR THE ARCHERY RANGE. A RAT WITH VERY GOOD MANNERS.",
        "IRON GATES OPEN WHEN YOU PUNCH A LEVER. THE LEVER IS NEVER RIGHT NEXT TO THE GATE. THAT WOULD BE TOO NICE.",
        "THE GRUB GULLY EXIT IS PADLOCKED. THE KEY IS IN THE GULLY TOO. LOOK UP. GOBLINS LOVE A HIGH SHELF."],
      required: ['f2_s1', 'f2_s2', 'f2_s3'], boss: 'f2_boss', par: 900 },
    { n: 3, name: 'THE OVER CITY', tagline: 'A WHOLE CITY. NO EXITS. GREAT CLOWNS.', theme: 'city', music: 'floor3',
      intro: ["FLOOR THREE! YOU NOW HAVE A MAP. WALK AROUND, CRAWLER. DOORS, TENTS AND MANHOLES ARE ALL STAGES.",
        "CLEAR THE NUMBERED AREAS AND FIND THE BOSS KEY TO OPEN THE BOSS DOOR. LETTERED AREAS HIDE LOOT, KEYS AND LOST FRIENDS.",
        "SOME DOORS ARE PADLOCKED. THE KEY IS ALWAYS SOMEWHERE ELSE ON THE FLOOR. ASK THE GUILD BARTENDER FOR GOSSIP."],
      overworld: { theme: 'ow_city', music: 'ow3',
        map: [
      '##################################################',
      '#TTTTTTTTT.=###############.#############.########',
      '#T,,,,,,,T.=########,T,####.#############.########',
      '#TA,,TT,,T.=########,,,####.#############.###B####',
      '#T,,,,,,,,.======================================#',
      '#T,,,,,,,,.=...............=.............=.,,,,,X#',
      '#TTTTTTT,,.=.##..#########.=.TTTTTTTTTTT.=.T,,,,T#',
      '#,,,,,,,,,.=.##..#########.=.T,#######,T.=.,,,,,,#',
      '#,,,,,,,,T.=.#############.=.T,#######,T.=.,T,,,,#',
      '#,,,TT,,,T.=.#############.=.T,#######,T.=.,,,,T,#',
      '#,,,,,,TT,.=.#############.=.T,###2###,T.=.,,,,,,#',
      '#,TT,,,,,,.=.#############.=.T,,,,,,,,,T.=.,,T,,,#',
      '#,,,,,,,,,.=.######1######.=.TTT,,,TTTTT.=.T,,,,T#',
      '#..........=.T...........T.=.T.........T.=.......#',
      '#================================================#',
      '#,,,,,,,,,.=.T......T....T.=.T.....T...T.=~~~~~~~#',
      '#,###,###,.=.######S######.=.###########.=~~~~~~~#',
      '#,###,###,.=.#############.=.###########.=~,,,~~~#',
      '#,###,###,.=.#############.=.####...####.=,,T,~~~#',
      '#,,,,,,,,,.=.#############.=.####...####.=~,,,~~~#',
      '#,###,###,.=.#############.=.####...####.=~~~~~~~#',
      '#,###,###,.=...............=.............=~~~~~~~#',
      '#,###,###,.===============================~~~~~~~#',
      '#,,,,,,,,,.=.###..########.=.............=~~~~~~~#',
      '#,,,,,,,,,.=.###..########.=..T.....T....=====3~~#',
      '#==P========.###..########.=.....T........~~~~~~~#',
      '#,,T,,,,T,,=.#############.=..........T...~~~~~~~#',
      '##################################################'
        ],
        entrances: { '1': 'f3_s1', '2': 'f3_s2', '3': 'f3_s3', 'A': 'f3_x1', 'S': 'SAFE', 'B': 'f3_boss', 'X': 'STAIRS' },
        roamers: [{ enemy: 'clown', x: 20, y: 14 }, { enemy: 'skyfowl', x: 35, y: 5 }, { enemy: 'gator', x: 43, y: 24 }, { enemy: 'rat', x: 5, y: 19 }],
        ambush: 'f3_ambush' },
      locks: { '3': { needs: 'valve', text: "THE STORM DRAIN IS FLOODED TO THE BRIM. SOMEBODY RAN OFF WITH THE VALVE WHEEL." }, 'B': { needs: 'bigtop_ticket', text: "THE BIG TOP IS CHAINED SHUT. A CLOWN AT THE FLAP SAYS NO TICKET, NO SHOW." } },
      companion: 'mongo',
      hints: [
        "THE STORM DRAIN IS FLOODED. THERE IS A VALVE WHEEL IN THE APARTMENT TOWER BOILER ROOM. TRY THE ROOF FIRST.",
        "THE MIDWAY EXIT ONLY OPENS FOR A PROPER HONK. EVERYTHING LOST ON THIS FLOOR ENDS UP IN THE PARK SHED.",
        "THE RINGMASTER WANTS A TICKET. A CLOWN WENT DOWN INTO THE BAYOU WITH ONE. NOBODY SAW HIM COME BACK UP.",
        "ONE OF THE MIDWAY GAMES HAS A REAL EGG AS THE TOP PRIZE. RING THE BELL. TRUST ME ON THIS ONE, KID."],
      required: ['f3_s1', 'f3_s2', 'f3_s3'], boss: 'f3_boss', par: 1200 },
    { n: 4, name: 'THE IRON TANGLE', tagline: 'RIDE THE RAILS. FIND THE STAIRS. DO THE MATH.', theme: 'train', music: 'floor4',
      intro: ["FLOOR FOUR! WE CALL IT THE IRON TANGLE. A KNOT OF TRAIN LINES OVER A BOTTOMLESS VOID. THESE TRAIN THINGS ARE SO NIFTY.",
        "THREE STOPS TO CLEAR, TWO SIDE SPURS FULL OF GOODIES, AND A BOSS WHO IS MOSTLY ENGINE."],
      overworld: { theme: 'ow_rail', music: 'ow4',
        map: [
      '####################################################',
      '#.................~~~~~~......................######',
      '#............TT...~~~~~~......................######',
      '#..TT....====================================.######',
      '#..T.....=........~~~~~~....................=.######',
      '#........=.######.~~~~~~..........TTTTTTTT..==B#####',
      '#........=.######.~~~~~~..........TT####TT..=.######',
      '#........=.######.~~~~~~..TT......TT####TT..=.######',
      '#........=.##1###.~~~~~~..T.......TTT3TTTT..=.######',
      '#..TT....=........~~~~~~....................=.....X#',
      '#........======================.............=...T..#',
      '#........=........~~~~~~......=...#####.....=......#',
      '#~~~~~~~.=........~~~~~~#####.=...#####.....=......#',
      '#~~~~~~~.=...####.~~~~~~##S##.=.............=......#',
      '#A========...####.............=.............=......#',
      '#~~~~~~~.=...####.............=====================#',
      '#~~~~~~~.=....................=.............=......#',
      '#######..=....TTTTTTTTTTTTT...=.............=......#',
      '#######..=.......TTTTTTTTTT...=.............=......#',
      '#........=....TT.......TTTT...=.~~~~~~~~~~~~=~~~~~~#',
      '#........=..TTTT..#####..TT...=.~~~~~~~~~~~~=~~~~~~#',
      '#........=....TT....C....TT...=.~~~~~~~~~~~~=~~~~~~#',
      '#........=....TT.........TT.TT=.............=.######',
      '#........=....TTTTTTTTTTTTT...=...#####.....=.######',
      '#........=....TTTTTTTTTTTTT...=...#####.....==2#####',
      '#........=....................=...#####.....=.######',
      '#........=.....TT.............=.............=.######',
      '#==P===========================.........TT....######',
      '#.............................................######',
      '####################################################'
        ],
        entrances: { '1': 'f4_s1', '2': 'f4_s2', '3': 'f4_s3', 'A': 'f4_x1', 'C': 'f4_x2', 'S': 'SAFE', 'B': 'f4_boss', 'X': 'STAIRS' },
        roamers: [{ enemy: 'rail_rat', x: 30, y: 20 }, { enemy: 'steam_goblin', x: 38, y: 15 }, { enemy: 'bat', x: 5, y: 22 }, { enemy: 'rail_rat', x: 20, y: 3 }],
        ambush: 'f4_ambush' },
      locks: { '2': { needs: 'switch_key', text: "THE POINTS ARE LOCKED. NO TRAIN, AND NO CRAWLER, GETS TO THE ENGINE SHED." }, 'A': { needs: 'switch_key', text: "THE OLD SPUR SWITCH IS PADLOCKED. SOMETHING DOWN THAT LINE IS SWEARING." }, 'B': { needs: 'drive_gear', text: "THE ROUNDHOUSE TURNTABLE IS JAMMED. THERE IS A GEAR-SHAPED HOLE IN IT." } },
      companion: 'samantha',
      hints: [
        "PLATFORM NINE HAS THE SWITCHYARD KEY. IT THROWS THE POINTS FOR THE ENGINE SHED AND THE OLD SPUR.",
        "THE ROUNDHOUSE IS JAMMED UNTIL SOMEBODY BRINGS A DRIVE GEAR. THE ENGINE SHED HAS A PIT FULL OF THEM.",
        "THE DEAD END TUNNEL EXIT IS STUCK ON RED. THE FREIGHT MAZE STORES SPARE SIGNAL GLASS.",
        "THE YARD CREW SAYS SOMETHING IN A CABOOSE ON THE OLD SPUR HAS BEEN CURSING FOR A WEEK. IN A VERY POSH VOICE."],
      required: ['f4_s1', 'f4_s2', 'f4_s3'], boss: 'f4_boss', par: 1300 },
    { n: 5, name: 'THE BUBBLES', tagline: 'EVERY BUBBLE IS ITS OWN LITTLE WORLD.', theme: 'bubble', music: 'floor5',
      intro: ["FLOOR FIVE! THE BUBBLES. PICTURE BUBBLE WRAP. EVERY BUBBLE IS A SEALED LITTLE WORLD, AND YOU ARE STUCK IN ONE. THIS ONE IS MOSTLY WATER.",
        "FOUR AREAS THIS TIME. THE TIDEMOTHER WAITS ON THE FAR ISLAND. SHE HAS BEEN WAITING A WHILE. SHE IS CRANKY."],
      overworld: { theme: 'ow_reef', music: 'ow5',
        map: [
      '####################################################',
      '#~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~#',
      '#~~....~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~....######..#',
      '#~T,,,T.~~~~~~~~~~~...........~~~~~~~~.....######..#',
      '#~A,,,..~~~~~~~~~~.,,,,,.TTTTT.~~~~~~~.T...######..#',
      '#~T.....~~~~~~~~~~.,,,,,.TTTTT.~~~~~~~.....##B###..#',
      '#~.....~~~~~~~~~~~.,,,,,.TT3TT.=======.............#',
      '#~~~=~~~~~~~~~~~~~.............~~~~~~~..,,,........#',
      '#~~~=~~~~~~~~~~~~~..TT.........~~~~~~~..,,,......T.#',
      '#~~~=~~~~~~~~~~~~~..........T..~~~~~~~..,,,....TTX.#',
      '#~~~=~~~~~~~~~~~~~~...........~~~~~~~~.............#',
      '#~~~=~~~~~~~~~~~~~~~~~~~~=~~~~~~~~~~~~~...........~#',
      '#~~~.....TTTT~~~~~~~~~~~~=~~~~~~~~~~~~~~~~~~~~~~~~~#',
      '#~~.,,,,,TTTT.~~~~~~~~~~~=~~~~~~~~~~~~~~~~~~~~~~~~~#',
      '#~~.,,,,,T1TT.~~~~~~~~~~~=~~~~~~~~~~~~~~~~~~~~~~~~~#',
      '#~~.,,,,,.....~~~~~~~~~~~=~~~~~~~~~~~~~~~~~~~~~~~~~#',
      '#~~...........~~~~~~~...........~~~~~~~~~~~~~~~~~~~#',
      '#~~..TT.....T.~~~~~~.............~~~~~~~~~~~~~~~~~~#',
      '#~~...........~~~~~~..,,,,,.####.~~~~~~..........~~#',
      '#~~~.........~~~~~~~..,,,,,.####.~~~~~............~#',
      '#~~~~~~=~~~~~~~~~~~~..,,,,,.#S##.~~~~~..,,,,,..T..~#',
      '#~~~~~~=~~~~~~~~~~~~.............=====..,,,,,.....~#',
      '#~~~~~~=~~~~~~~~~~~~......T......~~~~~..,,,,,.....~#',
      '#~~~~~~=~~~~~~~~~~~~.TTTT.....T..~~~~~............~#',
      '#~~..........~~~~~~~.TTTT..T.....~~~~~.......T4TT.~#',
      '#~.,,,,...~...~~~~~~.T2TT........~~~~~.......TTTT.~#',
      '#~.,,,,.......======.............~~~~~..TT...TTTT.~#',
      '#~............~~~~~~~~.........~~~~~~~.......TTTT.~#',
      '#~...P.....T..~~~~~~~~~~~~~~~~~~~~~~~~~..........~~#',
      '#~.......T....~~~~~~~~~~~~~~~~~~~~~~~~~~~~.=..~~~~~#',
      '#~~.........~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~T..C~~~~~#',
      '####################################################'
        ],
        entrances: { '1': 'f5_s1', '2': 'f5_s2', '3': 'f5_s3', '4': 'f5_s4', 'A': 'f5_x1', 'C': 'f5_x2', 'S': 'SAFE', 'B': 'f5_boss', 'X': 'STAIRS' },
        roamers: [{ enemy: 'fishman', x: 26, y: 19 }, { enemy: 'jelly', x: 25, y: 13 }, { enemy: 'crab', x: 43, y: 25 }, { enemy: 'fishman', x: 45, y: 7 }],
        ambush: 'f5_ambush' },
      locks: { '4': { needs: 'tide_chart', text: "THE MANGROVES ARE A MAZE. WITHOUT A CHART YOU WILL JUST WALK IN WET CIRCLES." }, 'C': { needs: 'tide_chart', text: "THE CURRENTS PAST THE REEF ARE A MESS. YOU NEED A CHART TO REACH THE SHELF." }, 'B': { needs: 'coral_crown', text: "THE TIDE POOL GUARDS BOW TO A CROWN, NOT A CRAWLER. GO FIND A CROWN." } },
      companion: 'katia',
      hints: [
        "WITHOUT A TIDE CHART YOU WILL NEVER FIND THE MANGROVE MAZE OR THE REEF SHELF. CHECK THE SEA CAVES.",
        "THE GARDENS EXIT BUBBLE WANTS A SONG. THE PEARL VAULT HAS A SHELL THAT SINGS.",
        "THE TIDEMOTHER ONLY RECEIVES CROWNED GUESTS. HER SPARE CROWN IS TANGLED UP IN THE MANGROVE ROOTS.",
        "THE FISHMEN NETTED A SHAPESHIFTER OUT ON THE REEF SHELF. SHE KEEPS TURNING INTO A WALL. SOUNDS LIKE A FRIEND."],
      required: ['f5_s1', 'f5_s2', 'f5_s3', 'f5_s4'], boss: 'f5_boss', par: 1500 },
    { n: 6, name: 'THE HUNTING GROUNDS', tagline: 'YOU ARE THE GAME. LITERALLY.', theme: 'forest', music: 'floor6',
      intro: ["FLOOR SIX! A PRIVATE HUNTING PRESERVE FOR THE GALAXY'S RICHEST JERKS. YOU ARE THE PREY. SMILE!",
        "STICK TO THE PATHS. THE WOODS ARE THICK AND THE HUNTERS ARE THICKER."],
      overworld: { theme: 'ow_woods', music: 'ow6',
        map: [
      '######################################################',
      '#TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT#',
      '#TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT,X,,######,,T#',
      '#TTTT,#####,TTTTTTTTTTTTTTTTTT==========,,,,######,,T#',
      '#TTT,,##3##,,TTTTTTTTTTTTTTTTT=TTTTTTTTT,,,,##B###,,T#',
      '#TTT,,,,,,,,,TTTTTTTTTTTTTTTTT=TTTTTTTTT,,,,,,,,,,,,T#',
      '#TTT,,,,,,,T,TTTTTTTTTTTTTTTTT=TTTTTTTTT,,,,,,,,,,T,T#',
      '#TTT,,,,,,,,,TTTTTTTTTTTTTTTTT=TTTTTTTTTT,,,,,,,,,,TT#',
      '#TTTTTTT=TTTTTTTTTTT,,,,,,,,,,,,,,TTTTTTTTTTTTTTTTTTT#',
      '#TTTTTTT=TTTTTTTTTTT,,####,,,,,,,,,TTTTTTTTTTTTTTTTTT#',
      '#TTTTTTT=TTTTTTTTTTT,,#S##,,,,,,,,,========TTTTTTTTTT#',
      '#TTTTTTT=TTTTTT=====,,,,,,,,,,,,,,,TTTTTTT=TTTTTTTTTT#',
      '#TT,,,,,,,,,,,,TTTTT,,,,,,,,,,,T,,,TTTTTTT=TTTTTTTTTT#',
      '#TT,,#####,,T,,TTTTTT,,,,,,,,,,,,,,TTTTTTT=TTTTTTTTTT#',
      '#TT,,#####,,,,,TTTTTTTTTTTT=TTTTTTTTTTTTTT=TTTTTTTTTT#',
      '#TT,,##1##,,,,,TTTTTTTTTTTT=TTTTTTTTTTTTTT=TTTTTTTTTT#',
      '#TT,,,,,,,,,,T,TTTTTTTTTTTT=TTTTTTTTTTTTTT=TTTTTTTTTT#',
      '#TT,,,,,,,,,,,,TTTTTTTTTTTT=TTTTTTTTTTT,,,,,,,,,,,,TT#',
      '#TTTTTTT=TTTTTTTTTTTTTTTTTT=TTTTTTTTTT,,,,,,#####,,TT#',
      '#TTTTTTT=TTTTTTTTTTTTTTTTTT=TTTTTTTTTT,,,,,,##4##,,TT#',
      '#TTTTTTT=TTTTTTTTTTTTTTTTTT=TTTTTTTTTT,,,,,,,,,,,,,TT#',
      '#TTTTTTT=TTTTTTTTTTTTTTTTTT=TTTTTTTTTT,T,,,,,,,,T,,TT#',
      '#TA======TTTTTTTTTTTTTT,,,,,,,,,TTTTTT,,,,,,,,,,,,TTT#',
      '#TTTTTTT=TTTTTTTTTTTTT,,,,####,,,TTTTTTTTTTT=TTTTTTTT#',
      '#TTTTTTT=TTTTTTTTTTTTT,,,,#2##,,,TTTTTTTTTTT=TTTTTTTT#',
      '#TTTTTTT=TTTTTTTTTTTTT,,,,,,,,,,,TTTTTTTTTTT=TTTTTTTT#',
      '#TT,,,,,,,,,,TTTTTTTTT,,,T,,,,,,,TTTTTTTTTTT=TTTTTTTT#',
      '#TT,,...,,T,,TTTTTTTTT,,,,,,,T,,,TTTTTTT,,,,,,,,,,TTT#',
      '#TT,,...,,,,,=========,,,,,,,,,,,TTTTTTT,,,,,TTT,,,TT#',
      '#TT,,,P,,,,,,TTTTTTTTT,T,,,,,,,T,TTTTTTT,,,,,,,,,,,TT#',
      '#TT,,,,,,,,,,TTTTTTTTT,,,,,,,,,,,TTTTTTTT,,,,,C,,,,TT#',
      '######################################################'
        ],
        entrances: { '1': 'f6_s1', '2': 'f6_s2', '3': 'f6_s3', '4': 'f6_s4', 'A': 'f6_x1', 'C': 'f6_x2', 'S': 'SAFE', 'B': 'f6_boss', 'X': 'STAIRS' },
        roamers: [{ enemy: 'hound', x: 8, y: 20 }, { enemy: 'hunter', x: 27, y: 18 }, { enemy: 'skyfowl', x: 36, y: 10 }, { enemy: 'hound', x: 45, y: 21 }],
        ambush: 'f6_ambush' },
      locks: { '4': { needs: 'kennel_key', text: "THE KENNEL GATES ARE LOCKED. THE HOUNDS INSIDE ARE VERY EXCITED ABOUT IT." }, 'B': { needs: 'hunt_horn', text: "THE PROCESSING SHED IS BOLTED. THE BUTCHER ONLY COMES OUT FOR HIS OWN HORN." } },
      companion: 'zev',
      hints: [
        "CAREFUL WITH THE LODGE. THE DOORMAN WILL NOT LET YOU OUT WITHOUT A GUEST MASK. WOLF HOLLOW ATE THE LAST GUEST.",
        "THE TRAPPERS HOLD THE KENNEL KEY. IT FELL INTO ONE OF THEIR OWN SNARE PITS. HA.",
        "THE BUTCHER COMES OUT FOR HIS HORN AND NOTHING ELSE. IT HANGS IN THE KENNELS, UP A BIG TREE.",
        "SOMEBODY DOWN THE WISHING WELL IS YELLING ABOUT ENGAGEMENT NUMBERS. KID, I THINK THAT IS YOUR PR LADY."],
      required: ['f6_s1', 'f6_s2', 'f6_s3', 'f6_s4'], boss: 'f6_boss', par: 1600 },
    // book floor 7 is the Great Race, which a goat crawler destroys before anyone races; the
    // coldOpen cutscene plays that, then the show swaps in this manor as its backup floor
    { n: 7, name: 'THE BEDLAM MANOR', tagline: "THE GREAT RACE'S EMERGENCY UNDERSTUDY.", theme: 'castle', music: 'floor7', coldOpen: 'greatRace',
      intro: ["FLOOR SEVEN, TAKE TWO! THE BACKUP FLOOR: A HAUNTED MANOR WITH GARDENS, A HEDGE MAZE AND A GRAVEYARD. REAL ESTATE AGENTS CALL IT CHARMING.",
        "THE LADY OF THE HOUSE AWAITS AT THE END OF THE HALL. DRESS CODE IS FORMAL. YOU ARE IN BOXERS. GOOD LUCK."],
      overworld: { theme: 'ow_manor', music: 'ow7',
        map: [
      '##################################################',
      '#,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,#',
      '#,,,,,,,###################################,,,,,,#',
      '#,,,,,,,###################################,~~~~~#',
      '#,####,,###################################,~~~~~#',
      '#,####,,###################################,~~~~~#',
      '#,###S,,######1############################,~~~~~#',
      '#,####,,###......#...........#..........B##,~~~~~#',
      '#,,,,,,,###............#...........#....X##,~~~~~#',
      '#,T,,,,,############2###...################,,,,,,#',
      '#,,,,,,,################...################,,TTT,#',
      '#,,,,,T,################...################,,TTT,#',
      '#,,,,,,,################...################,,,,,,#',
      '#TTTTTTT,TTTTTTTTTTT,,,,,=,,,,,TTTTTTTTTTTTT,TTTT#',
      '#,,,,,,,,,,,,,,,,,,,,=========,,,,,,,,,,,,,,,,,,,#',
      '#,,,,,,,,,,,,,,,,,,,,=,~~~~~,=,,,TTT,,,,,,,,,,,,,#',
      '#,TTTTTTTTTTTTTTTTT,,=,~~~~~,=,,,,,,,,########TTT#',
      '#,T,,,,,,,,,,,,,,,,,,=,~~~~~,=,,,,,,,,########TTT#',
      '#,T,,,,,,,,,,,,,,,T,,=========,,,,,,,,########TTT#',
      '#,T,,TTTTTTTTTTTTTT,,,,,,=,,,,,,,,,,,,########,,,#',
      '#,T,,,,,,,,,,,,,,,T,,,,,,=,,,,,,,,,,,,###3####,,,#',
      '#,TTTTTTTTTTTTTT,,T,,,,T,=,T,,,,,,,,,,,,,,,,,,,,,#',
      '#,T,,,,,,,,,,,,,,,T,,,,,,=,,,,,,,,,TTTTTTTTTTTTTT#',
      '#,T,,TTTTTTTTTTTTTT,,,,,,=,,,,,,,,,T,,,,,,#####,T#',
      '#,T,,,,,,,,,,,,,,,T,,,,,,=,,,,,,,,,T,T,T,,#####,T#',
      '#,TTTTTTTTTTTTTT,,T,,,,T,=,T,,,,,,,,,,,,,,##4##,T#',
      '#,TTTTTTTT,,,,,,,,T,,,,,,=,,,,,,,,,T,,,,,,,,,,,,T#',
      '#,TTTTTTTTA,,,,,,,T,,,,,,=,,,,,,,,,T,T,T,T,,,,,TT#',
      '#,TTTTTTTTTTTTTTTTT,,,,,=P=,,,,,,,,TTTTTTTTTTTTTT#',
      '##################################################'
        ],
        entrances: { '1': 'f7_s1', '2': 'f7_s2', '3': 'f7_s3', '4': 'f7_s4', 'A': 'f7_x1', 'S': 'SAFE', 'B': 'f7_boss', 'X': 'STAIRS' },
        roamers: [{ enemy: 'ghoul', x: 33, y: 22 }, { enemy: 'gargoyle', x: 12, y: 14 }, { enemy: 'skeleton', x: 40, y: 14 }, { enemy: 'bat', x: 30, y: 7 }],
        ambush: 'f7_ambush' },
      locks: { '2': { needs: 'invitation', text: "A SKELETON BUTLER BLOCKS THE BALLROOM. INVITATION ONLY. HE IS VERY FIRM ABOUT IT." }, 'A': { needs: 'garden_key', text: "THE HEDGE MAZE GATE IS LOCKED AND OVERGROWN. SOMEONE INSIDE IS SINGING TO THE PLANTS." }, 'B': { needs: 'bridal_tiara', text: "THE GRAND STAIR IS ROPED OFF. THE BRIDE WILL NOT COME DOWN WITHOUT HER TIARA." } },
      companion: 'signet',
      hints: [
        "THE BALLROOM BUTLER WANTS AN INVITATION. THE CELLAR HAS SPARES, BUT THE CELLAR DOOR NEEDS A GARDEN KEY TO LEAVE.",
        "THE GARDEN KEY IS IN THE GREENHOUSE, UP IN THE VINES. IT ALSO OPENS THE HEDGE MAZE.",
        "THE BRIDE LEFT HER TIARA ON THE BALLROOM BALCONY. NO TIARA, NO WEDDING, NO BOSS FIGHT.",
        "AT THE HEART OF THE HEDGE MAZE IS A SUMMONER WHO ANNOYED THE BRIDE. ANYONE WHO ANNOYS THE BRIDE IS A FRIEND."],
      required: ['f7_s1', 'f7_s2', 'f7_s3', 'f7_s4'], boss: 'f7_boss', par: 1700 },
    { n: 8, name: 'THE GHOSTS OF EARTH', tagline: 'IT IS DECEMBER 10TH. IT ALWAYS WILL BE.', theme: 'ghosttown', music: 'floor8',
      intro: ["FLOOR EIGHT! WELCOME HOME! A PERFECT COPY OF A LITTLE WEST VIRGINIA RIVER TOWN, EXACTLY AS IT WAS ON DECEMBER 10TH.",
        "THE LOCALS ARE STILL HERE. SORT OF. THEY ARE GHOSTS, THEY CANNOT SEE YOU, AND THEY ARE VERY BUSY WITH THEIR CHRISTMAS SHOPPING.",
        "WE STOCKED THE HILLS WITH LOCAL FOLKLORE, FREE OF CHARGE. HELP YOURSELF TO ANYTHING. IT ALL TURNS TO DUST WHEN THE FLOOR GOES.",
        "THE MOTHMAN IS ROOSTING ON THE TOWN TREE IN THE NORTHEAST. HE KNEW YOU WERE COMING. HE ALWAYS KNOWS."],
      overworld: { theme: 'ow_town', music: 'ow8',
        map: [
      '########################################################',
      '#.................................######.....###########',
      '#.................#########.......######.....###########',
      '#..~~~~~~~~~......#########.......######.....###########',
      '#..~~~~~~~~~......#########......T######.....###########',
      '#..~~~~~~~~~......####4####..................####B######',
      '#..~~~~~~~~~..........................................X#',
      '#..~~~~~~~~~..=======================================..#',
      '#..~~~~~~~~~..=.........................=..............#',
      '#.#####.......=.######..#####...........=.######.......#',
      '#.##A##.......=.######..#####..~~~~.....=.######.......#',
      '#.............=.######..#####.~~~~~~....=.######.......#',
      '#....TT.......=.######..##S##.~~~~~~....=.######.......#',
      '#....T........=.######........~~~~~~....=.........##...#',
      '#.....######..=.######..TT....~~~~~~....=......TT.##...#',
      '#.....######..=.######..T.....~~~~~~....=...##########.#',
      '#..TT.######..=................~~~~.....=...##########.#',
      '#.............=.........................=...##########.#',
      '#.......=======.....=====================...##########.#',
      '#.#########.........=...................=...##########.#',
      '#.#########...#####.=.........TT.######.=...####3#####.#',
      '#.#########...#####.=............######.=..............#',
      '#.#########...#####.=.....~~~~~~....TT..=...~~~~~~~....#',
      '#.#########...#####.=...~~~~~~~~~~......=...~~~~~~~....#',
      '#.#########.........=...~~~~~~~~~~......=...~~~~~~~#####',
      '#.####1####.....TT..=...~~~~~~~~~~......=...~~~~~~~#####',
      '#...................=...~~~~~~~~~~......=...~~~~~~~#####',
      '#...........TT......=.2.~~~~~~~~~~......=..........#C###',
      '#...................=.....~~~~~~........=..............#',
      '#==P=================...................===============#',
      '#......................................................#',
      '########################################################'
        ],
        entrances: { '1': 'f8_s1', '2': 'f8_s2', '3': 'f8_s3', '4': 'f8_s4', 'A': 'f8_x1', 'C': 'f8_x2', 'S': 'SAFE', 'B': 'f8_boss', 'X': 'STAIRS' },
        roamers: [{ enemy: 'wampus_cat', x: 20, y: 24 }, { enemy: 'mountain_light', x: 30, y: 18 }, { enemy: 'sheepsquatch', x: 40, y: 12 }, { enemy: 'mountain_light', x: 14, y: 4 }],
        ambush: 'f8_ambush' },
      locks: { '4': { needs: 'security_badge', text: "THE RADIO STATION IS LOCKED. A GHOST DJ INSIDE SPINS CAROLS FOR NOBODY. HIS KEYS ARE ON MAIN STREET." }, 'B': { needs: 'tower_lens', text: "SOMETHING HUGE IS ROOSTING ON THE TOWN TREE. IT WILL ONLY COME DOWN FOR A BLINKING RED LIGHT." } },
      hints: [
        "THE RADIO STATION NEEDS THE NIGHT DJ'S KEYS. HE LOST THEM ON MAIN STREET. THE LOST AND FOUND LEVER IS ON THE STORE ROOF.",
        "THE HIGH SCHOOL'S WAY OUT IS A PITCH BLACK BOILER TUNNEL. BORROW A CARBIDE LAMP FROM THE NUMBER NINE MINE FIRST.",
        "THE MOTHMAN LOVES A RED LIGHT. THE BEACON ON TOP OF THE RADIO MAST WILL BRING HIM DOWN OFF THAT TREE.",
        "THE GHOSTS CANNOT SEE YOU OR HEAR YOU. YOU CANNOT HURT THEM EITHER. STOP PUNCHING THE CAROLERS, CARL."],
      required: ['f8_s1', 'f8_s2', 'f8_s3', 'f8_s4'], boss: 'f8_boss', par: 1800 },
    { n: 9, name: 'FACTION WARS', tagline: 'THE MIDSEASON FINALE. LIVE.', theme: 'warzone', music: 'floor9',
      intro: ["FLOOR NINE! THE MIDSEASON FINALE! TWO ARMIES, ONE PLANET, AND YOU IN THE MIDDLE IN YOUR UNDERWEAR.",
        "CROSS THE FRONT LINES, TAKE THE FOUR OBJECTIVES, AND STORM THE BROADCAST TOWER. THE SHOWRUNNER HIMSELF IS WAITING.",
        "SURVIVE HIM AND THE SEASON KEEPS GOING. THE NETWORK HAS TWO MORE FLOORS READY. THEY ARE VERY EXCITED. YOU SHOULD BE TOO."],
      overworld: { theme: 'ow_war', music: 'ow9',
        map: [
      '##########################################################',
      '#TTTTTTT.......T~~T............T~~T..........T~~##########',
      '#T,,,,,T.......T~~T.......#####T~~T..........T~~##########',
      '#T,A,,,T.......T~~T.......#####T~~T..........T~~######B###',
      '#T,,,,,,=..TT..T~~T.=====C#####T~~T.........TT~~T.....=###',
      '#T,,,,,T=...T..T~~T.....=.#####T~~T..........T~~TX....=###',
      '#TTTTTTT=......T~~T.....=..TTT.T~~T.#######..T~~T.....=###',
      '#.......=......T~~T.....=......T~~T.#######..T~~T.....=###',
      '#.......=================......T~~T.#######..T~~T.....=..#',
      '#.......=......T~~T.....=......T~~T.###3###..T~~T.....=..#',
      '#.......=......T~~T.....=......T~~T....=.....T~~T.....=..#',
      '#.......=......T~~T.....=......T~~T....=.....T~~T.....=..#',
      '#.#####.=......T~~T.~~~.=......T~~T.....===============..#',
      '#.#####.=......T~~T.~~~.=...TT.T~~T.....=....T~~T.....=..#',
      '#.####1.=......T~~T.~~~.=......T~~T..TT.=....T~~T.....=..#',
      '#.#####.=......T~~T.....=......T~~T.....=....T~~T.....=..#',
      '#.......=......T~~T.....=......T~~T.....=....T~~T.~~~.=..#',
      '#.......=......T~~T.....=......T~~T.....=....T~~T.~~~.=..#',
      '#.......=......T~~T.....=================....T~~T.~~~.=..#',
      '#.......=......T~~T.....=......T~~T.....=....T~~T.~~~.=..#',
      '#.......=.####.T~~T.T...=......T~~T.....=.~~~T~~T.....=..#',
      '#.......=.####.T~~T.....=......T~~T.....=.~~~T~~T.....=..#',
      '#..~~~..=.S###.T~~T.....=.#####T~~T.....=.~~~T~~T.....=..#',
      '#..~~~..=......T~~T.....=.2####T~~T.....=....T~~T.....=..#',
      '#..~~~..=......T~~T.....=.#####T~~T#####=....T~~T.TT..=..#',
      '#.......=......T~~T.....=.#####T~~T#####=....T~~T.....=..#',
      '#.......=================......T~~T#####=....T~~T.....=..#',
      '#.......=......T~~T............T~~T####4=....T~~T.....=..#',
      '#...TT..=......T~~T............T~~T#####===============..#',
      '#.......=......T~~T............T~~T#####.....T~~T........#',
      '#==P============~~T.TT.......T.T~~T#####.....T~~T........#',
      '#..............T~~T............T~~T........T.T~~T........#',
      '#..............T~~T............T~~T..........T~~T........#',
      '##########################################################'
        ],
        entrances: { '1': 'f9_s1', '2': 'f9_s2', '3': 'f9_s3', '4': 'f9_s4', 'A': 'f9_x1', 'C': 'f9_x2', 'S': 'SAFE', 'B': 'f9_boss', 'X': 'STAIRS' },
        roamers: [{ enemy: 'soldier', x: 8, y: 18 }, { enemy: 'soldier', x: 24, y: 12 }, { enemy: 'cultist', x: 40, y: 20 }, { enemy: 'soldier', x: 54, y: 20 }],
        ambush: 'f9_ambush' },
      locks: { '3': { needs: 'field_map', text: "WARNING SIGNS: MINES. LOTS OF MINES. YOU WILL WANT A MAP OF THE MINES." }, 'C': { needs: 'blast_charge', text: "THE DROPSHIP HULL IS SEALED TIGHT. A BIG ENOUGH BOOM WOULD OPEN IT RIGHT UP." }, 'B': { needs: 'backstage_pass', text: "SOUNDSTAGE SECURITY: NO PASS, NO SHOW. THE GUARDS HAVE VERY LARGE GUNS." } },
      hints: [
        "ARTILLERY HILL IS MINED. BUNKER ROW HAS THE MAP. YOU WILL NOT GET FAR WITHOUT IT.",
        "THE GUN CREWS ON THE HILL KEEP BLASTING CHARGES. ONE OPENS THE TRENCH BARRICADE. ONE OPENS THE DROPSHIP.",
        "THE BACKSTAGE PASS IS IN THE DROPSHIP WRECK. NO PASS, NO SHOWRUNNER. HE IS THE BIGGEST THING YOU HAVE FACED, KID."],
      required: ['f9_s1', 'f9_s2', 'f9_s3', 'f9_s4'], boss: 'f9_boss', bossMusic: 'boss', par: 2000 },
    { n: 10, name: "DON'T COME IN LAST", tagline: 'HEAT AFTER HEAT. LAST PLACE IS LUNCH.', theme: 'raceway', music: 'floor10',
      intro: ["FLOOR TEN! THIS FLOOR IS CALLED DON'T COME IN LAST. I GUESS YOU CAN FIGURE OUT WHAT THAT MEANS. THE GARAGES ARE ON A VERY NICE CUL-DE-SAC.",
        "YOUR RIDE: A GENUINE FOOD TRUCK! CARL DRIVES. PRINCESS DONUT RIDES SHOTGUN, FIRES MISSILES AND CRITIQUES YOUR STEERING.",
        "FINISH TOP THREE IN EACH HEAT TO UNLOCK THE NEXT GARAGE. WIN THE CHAMPIONSHIP TO LEAVE. SECOND PLACE IS A NICE WORD FOR LUNCH.",
        "YOUR RIVALS LIVE ON THE BLOCK. WALK UP TO THEIR DRIVEWAYS AND SAY HELLO. THEY WILL SAY SOMETHING RUDE BACK. IT IS TRADITION."],
      overworld: { theme: 'ow_suburb', music: 'ow10',
        map: [
      '####################################################',
      '#TTTTTTTTTTTTTTTT##################TTTTTTTTTTTTTTTT#',
      '#,,,,,,,,,,,,,,,,##################,,,,,,,,,,,,,,,,#',
      '#,#######,,,,,T,,########B#####X###,,T,,,,,#######,#',
      '#,#######,,,,,,,,..................,,,,,,,,#######,#',
      '#,#######,,,,,,,,,,,,==========,,,,,,,,,,,,#######,#',
      '#,######2.......,,================,,.......3######,#',
      '#,#######,,,,,,,======,,,,,,,,======,,,,,,,#######,#',
      '#,,,,,,,,,,,,,,=====,,,T,,,,,,,,=====,,,,,,,,,,,,,,#',
      '#,T,T,,,,,,,,,====,,,,........,,,,====,,,,,,,,,,,,,#',
      '#TTTTTTTTT,,,====,,,T,.,,,,,,.,T,,,====,,,TTTTTTTTT#',
      '#,,,,T,,,,,,,====,,,,,.,,~~,,.,,,,,====,,,,,,,T,,,,#',
      '#,,,,,,,,,,,,====,,,,,.,,~~,,.,,,,,====,,,,,,,,,,,,#',
      '#,#######,,,,====,,,T,.,,,,,,.,T,,,====,,,,#######,#',
      '#,#######,,,,,====,,,,........,,,,====,,,,,#######,#',
      '#,######1......=====,,,,,,,,T,,,=====......#######,#',
      '#,#######,,,,,,,======,,,,,,,,======,,,,,,,#######,#',
      '#,#######,,T,,,,,,================,,,,,,T,,#######,#',
      '#,,,,,,,,,,,,,,,,,,,,==========,,,,,,,,,,,,,,,,,,,,#',
      '#TTTTTTTTTT,,,,,,,,,,,,,,==,,,,,,,,,,,,,,TTTTTTTTTT#',
      '#,,,,,,,,,,,,,,,,,,,,,,,,==,,,,,,,,,,,,,,,,,,,,,,,,#',
      '#TTTTTTTTT,,T,#######,,,,==,,,,######,,T,,TTTTTTTTT#',
      '#T#######T,,,,###S###,,,,==,,,,######,,,,,T#######T#',
      '#T#######T,,,,,,,.,,,,,,,==,,,,,,.,,,,,,,,T#######T#',
      '#T######A................==................C######T#',
      '#T#######T,,,,,,,,,,,,,,,==,,,,,,,,,,,,,,,T#######T#',
      '#T#######T,,T,,,,,,,,,,,,==,,,,,,,,,,,T,,,T#######T#',
      '#TTTTTTTTT,,,,,,,,,,T,,,,P=,,,,,,T,,,,,,,,TTTTTTTTT#',
      '#,,,,,,,,,,,,,,,,,,,,,,,,==,,,,,,,,,,,,,,,,,,,,,,,,#',
      '####################################################'
        ],
        entrances: { '1': 'f10_r1', '2': 'f10_r2', '3': 'f10_r3', 'A': 'f10_x1', 'C': 'f10_x2', 'S': 'SAFE', 'B': 'f10_boss', 'X': 'STAIRS' },
        // rival racers hang out in front of their garages (press A next to them)
        npcs: [
          { racer: 'goblin_bike', x: 9, y: 14, lines: ["OI, TACO TRUCK! THAT HEAT ONE GARAGE IS MY GARAGE. I JUST LET THE RACE USE IT.",
            "MY BIKE IS HELD TOGETHER WITH SPITE AND ONE ZIP TIE. IT IS STILL FASTER THAN YOUR KITCHEN."] },
          { racer: 'skull_chariot', x: 9, y: 7, lines: ["OH. A COMMONER. ON MY DRIVEWAY. IN HIS UNDERWEAR. HOW TERRIBLY MODERN.",
            "MY HORSES HAVE BEEN DEAD FOR CENTURIES. THEY ARE STILL BETTER GROOMED THAN YOU, DARLING.",
            "DO NOT TOUCH THE CHARIOT. THE BONES ARE ORIGINAL."] },
          { racer: 'beetle_mount', x: 42, y: 7, lines: ["SHH! BIG MARGARET IS NAPPING. SHE IS GRUMPY WHEN SHE WAKES UP. SHE IS GRUMPY ON THE TRACK, TOO.",
            "SIX LEGS, ONE HORN, ZERO BRAKES. MARGARET IS THE FINEST ATHLETE ON THIS STREET."] },
          { racer: 'steam_buggy', x: 42, y: 14, lines: ["COME IN, SONNY! HAVE A COOKIE! IT IS MOSTLY RIVETS. LIKE MY DRIVING STRATEGY.",
            "I HAVE BEEN RACING SINCE BEFORE WHEELS WERE ROUND. HEXAGONS, SONNY. VERY BUMPY TIMES.",
            "THE KETTLE IS NOT LEAKING. THE KETTLE IS CRYING. IT KNOWS WHAT IT IS ABOUT TO DO TO YOU."] },
          { racer: 'champion', x: 23, y: 4, lines: ["YOU ARE STANDING ON MY LAWN, TACO BOY. PEOPLE WHO STAND ON MY LAWN END UP IN MY GRILLE.",
            "QUALIFY IN ALL THREE HEATS. THEN COME KNOCK ON THE BIG GARAGE. THE MAULER IS HUNGRY.",
            "SIX CUPS ON MY MANTEL. ROOM FOR ONE MORE. IT IS SHAPED LIKE YOUR TRUCK."] }
        ],
        roamers: [{ enemy: 'steam_goblin', x: 12, y: 12 }, { enemy: 'rail_rat', x: 39, y: 12 }, { enemy: 'juicer_minion', x: 22, y: 20 }, { enemy: 'goblin_brute', x: 36, y: 24 }],
        ambush: 'f10_ambush' },
      locks: {
        '2': { afterCleared: 'f10_r1', text: "THE HEAT TWO GARAGE IS SHUT. A SIGN SAYS QUALIFIERS ONLY. FINISH TOP THREE IN HEAT ONE." },
        '3': { afterCleared: 'f10_r2', text: "HEAT THREE IS FOR SURVIVORS OF HEAT TWO. FINISH TOP THREE THERE AND THE DOOR GOES UP." },
        'B': { afterCleared: 'f10_r3', text: "THE BIG GARAGE ONLY OPENS FOR DRIVERS WHO QUALIFIED IN ALL THREE HEATS. VORN IS WAITING." } },
      companion: null,
      hints: [
        "THE HEATS GO IN ORDER, KID. FINISH TOP THREE IN ONE AND THE NEXT GARAGE OPENS. THE CHAMPIONSHIP NEEDS ALL THREE.",
        "IN THE TRUCK: ATTACK MAKES DONUT SHOOT, BOMB DROPS A MINE OUT THE BACK, POTION PATCHES THE TRUCK, SPECIAL IS TURBO.",
        "THE SCRAPYARD BEHIND THE WEST FENCE HAS ARMOR PLATING. THE AUTO PARTS STORE ON THE EAST SIDE STILL HAS A TURBO.",
        "WORD IS SOMEONE STASHED A MINE HOPPER ON A BILLBOARD IN HEAT TWO. HIT THE JUMP PAD AND TAKE THE HIGH ROAD.",
        "JUMP PADS FLING YOU HIGH, OVERPASSES ARE SAFER, OIL SPINS YOU OUT, CRATES BREAK IF YOU ARE FAST. DO NOT BRAKE. EVER."],
      required: ['f10_r1', 'f10_r2', 'f10_r3'], boss: 'f10_boss', par: 1500 },
    { n: 11, name: 'A PARADE OF HORRIBLES', tagline: 'BUILD A FLOAT. MARCH. PERFORM. SURVIVE.', theme: 'parade', music: 'floor11',
      intro: ["FLOOR ELEVEN! A PARADE OF HORRIBLES! THE SHORTEST FLOOR OF THE CRAWL. EVERY RACER IS TURNING THEIR RIDE INTO A FLOAT. NOBODY IS THRILLED.",
        "YOUR FOOD TRUCK NEEDS A CONFETTI CANNON, A SPOTLIGHT, BALLOONS AND A BANNER. ONE IS HIDDEN IN EACH CORNER OF THE STAGING GROUNDS.",
        "BUILD THE FLOAT, JOIN THE PARADE, SURVIVE THE GRAND MARSHAL. THIS IS THE LAST FLOOR WE HAVE BUILT, CRAWLER. MAKE IT COUNT."],
      overworld: { theme: 'ow_parade', music: 'ow11',
        map: [
      '######################################################',
      '######################################################',
      '######################################################',
      '#.=================================================###',
      '#.=================================================B##',
      '#.........#...............................#..........#',
      '#.........#.##########..##########.######.#..........#',
      '#...........##########..##########.######......#####.#',
      '#.########................==...................#####.#',
      '#.########..,,,,,,,,,,,...==...................#####.#',
      '#.########..,T,,,,,,,T,...==..####...#####.....3####.#',
      '#.########..,,,,,,,,,,,...==..####...#####.....#####.#',
      '#.####1###..,,T,,,,,T,,...==...................#####.#',
      '#...........,,,,,,,,,,,...==.........................#',
      '#.........................==.........................#',
      '#.==================================================.#',
      '#.........................==.........................#',
      '#.............#####.......==......#####..............#',
      '#..########...#####.......==......#####..............#',
      '#..########...............==.........................#',
      '#..#######2..........~~...==............,,,,,,,,,,,,.#',
      '#..########..........~~...==............,TTTTTTTTTTT.#',
      '#..########...............==...###......,,,,,,,,,,,T.#',
      '#..............#####......==...###......,,,T,,,,,T,T.#',
      '#..............####S......==............,..........4.#',
      '#..T...........#####......==............,,,,,,T,,,,T.#',
      '#...........T.............==........T...,,,,T,,,T,,T.#',
      '#.......T.................P=..T.........,,,,,,,,,,,T.#',
      '#....................................................#',
      '######################################################'
        ],
        entrances: { '1': 'f11_s1', '2': 'f11_s2', '3': 'f11_s3', '4': 'f11_s4', 'S': 'SAFE', 'B': 'f11_boss' },
        roamers: [{ enemy: 'clown', x: 20, y: 14 }, { enemy: 'jelly', x: 36, y: 8 }, { enemy: 'clown_brute', x: 45, y: 16 }, { enemy: 'skyfowl', x: 8, y: 6 }],
        ambush: 'f11_ambush' },
      locks: { 'B': { needs: ['confetti_cannon', 'spotlight_rig', 'balloon_rig', 'gala_banner'],
        text: "YOUR TRUCK IS NOT A FLOAT YET. THE MARSHAL WANTS CONFETTI, A SPOTLIGHT, BALLOONS AND A BANNER." } },
      companion: null,
      hints: [
        "THE MARSHAL WILL NOT LET A PLAIN TRUCK INTO HIS PARADE. YOU NEED ALL FOUR FLOAT PARTS. EACH AREA HAS ONE.",
        "CONFETTI ALLEY KEEPS A CANNON IN A ROOFTOP SHED. THE LEVER IS IN AN ALLEY NOOK, BEHIND SOME CRATES. SMASH THEM.",
        "THE BALLOON BARN KEEPS ITS HELIUM UP IN THE RIGGING. PULL THE LOW LEVER FIRST, THEN RIDE THE PROP CART UP.",
        "THE GILDED HALL BANNER HANGS IN A HIGH GALLERY. THE LEVER IS AT THE TOP OF THE BELL TOWER. GO IN FROM THE RIGHT SIDE.",
        "LANTERN PARK HIDES A SPOTLIGHT IN A TREEHOUSE. CLIMB THE BRANCHES. THE GATE LEVER IS ON A STUMP TO THE WEST."],
      required: ['f11_s1', 'f11_s2', 'f11_s3', 'f11_s4'], boss: 'f11_boss', bossMusic: 'boss_final', par: 1600 }
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

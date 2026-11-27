/* ==========================================================================
   DCW DATA, BOOK 2: CARL'S DOOMSDAY SCENARIO (the Third Floor, the Over City)
   Owner: content. All game content and text as plain data under DCW.data.
   Contract: crawler2/DESIGN.md section 6 (+ the lead's game.js field notes).
   Validate:  node crawler2/tools/data_validate.js   (add --render <id> to print
              a level / area / layout, --flow to print the story chain)

   ---------------------------------------------------------------------------
   STORY FLAGS (run.flags). Every flag below is set by exactly the source named.
   Fixed names used by gameplay: freeballing xistera fang_caps mongo_big katia_joined
   ---------------------------------------------------------------------------
   ACT 1, THE CIRCUS
   toured           event 'tour' (village, first entry)
   map_village      event 'tour' (also every signpost rock sets map_<areaId>)
   lemurs_done      level a1_lemurs (clear)         -> unlocks a1_bodies door
   pug_scene        event 'pug_vomit' (village, after lemurs_done)
   bodies_done      level a1_bodies                 -> unlocks a1_collapse door
   collapse_done    level a1_collapse
   met_signet       level a1_collapse               (MEET AN ELITE achievement)
   lions_done       level a1_lions
   knocked_out      level a1_lions                  (LAZARUS achievement; +15 h)
   donut_asleep     level a1_lions   party rule: while donut_asleep && !donut_awake,
                                     Donut and Mongo are NOT with Carl on the streets
   mongo_caged      level a1_lions
   solo_done        level a1_solo
   mongo_freed      level a1_solo
   heather_done     level a1_heather
   has_ticket       level a1_heather (+ item big_top_ticket) -> Big Top door
   saw_grimaldi     event 'city_boss' (circus_park, after heather_done) (CITY HALL)
   bigtop_done      level a1_bigtop  (quest show_must_go_on done)
   grimaldi_peace   level a1_bigtop
   circus_gone      level a1_barricade  -> circus doors hide, park stairs show,
                                           the east gate to ruins_e opens
   donut_awake      level a1_barricade  (party whole again)
   panic            level a1_barricade  (the Panic combo has a name now; flavor)
   ACT 2, THE MEDIUM SKYFOWL SETTLEMENT
   settled          event 'settlement_arrival' (first entry to settlement)
   freeballing      event 'settlement_arrival' (kicks/stomps x2)
   fang_caps        event 'settlement_arrival' (Mongo hurts ghosts)
   quadrillion      event 'settlement_arrival' (ONE QUADRILLION! achievement)
   gumgum_asked     event 'gumgum_ask' (settlement, after settled)
   dispenser_done   level a2_dispenser
   quest_sw         event 'gumgum_bodies' (talk to GumGum at the gate) (quest sex_workers)
   club_known       event 'desperado_tour' (settlement, after quest_sw)
   met_pustule      event 'desperado_tour'  -> Silk Road Market door
   mongo_bolted     event 'mongo_bolts' (right after the tour) -> a2_mongo
   mongo_done       level a2_mongo
   vincente_dead    level a2_alley
   gumgum_dead      level a2_alley
   has_pass         level a2_alley (+ items gate_pass, letter) -> admin gate
   xistera          level a2_alley (the Gold Fan Box opens in the outro)
   met_quill        event 'quill_desk' (admin, first entry)
   shelves_rigged   event 'quill_desk'
   divider_done     level a2_divider
   show_done        level a2_danger_zone
   manasa_dead      level a2_danger_zone
   apito_done       level a2_apito
   mic_drop         level a2_apito (the Mic Drop has a name now; flavor)
   katia_joined     event 'katia_meet' (settlement, after apito_done)
   alley_night_done level a2_alley_night
   mongo_big        level a2_alley_night (Mongo hits level 13, pony-sized)
   ACT 3, QUILL'S TOWER AND THE GLASS
   climb_done       level a3_climb
   quill_dead       level a3_plant (ASSASSIN! achievement)
   magistrate       level a3_plant (ULTIMATE EXTREME POWER!, carl_magistrate skin)
   cockblock        level a3_plant (COCKBLOCK achievement)
   nest_done        level a3_nest
   burgundy_dead    level a3_nest
   met_bautista     level a3_nest
   depot_rigged     level a3_depot
   glass_broken     level a3_depot (quest sex_workers done, fools_glass starts)
   doomsday         level a3_depot (+ item doomsday: CARL'S DOOMSDAY SCENARIO)
   escaped          level a3_escape (win: true)
   OPTIONAL / RECORDS
   temple_done restroom_done park_done   optional levels x_temple x_restroom x_park
   seen_ruins seen_circus seen_stairs seen_east seen_crater seen_east_stairs
                    one-shot guards of the AI flavor events (events.sets)
   Flags game.js / ui.js may key off: donut_asleep/donut_awake (party), mongo_big,
   katia_joined, freeballing, xistera, fang_caps, circus_gone, magistrate, doomsday.

   ---------------------------------------------------------------------------
   TRACK EVENTS used by achievements (game.js + stage.js emit; see lead notes):
   kill kill:<id> boss:<id> stomp kick bomb_kill multi_bomb crate coin fall
   combo10 combo25 no_damage_stage secret level_clear clear:<levelId>
   flag:<name> quest_start quest_done quest_done:<id> rest craft shop box_open
   death revive flee crime banned level:<n> win early import night day potion
   Gameplay extras these achievements also listen for (emit if you can):
   boomy_boy (Boomy Boy used), mic_drop (Mic Drop used), panic (Panic used),
   plant (a charge planted), krasue_body (a Krasue body destroyed),
   regrow_burn (a mold lion burned for good), second_chance (Donut raised one)

   ---------------------------------------------------------------------------
   SCHEMA NOTES beyond DESIGN.md (all optional for readers):
   - enemies[id].tier = home act (1-3) of the base stats. D.actScale[act-1] +
     D.enemyFor(id, act) scale a copy up to a later act (never down).
   - enemies: bodyHp/leash/regrowTime (krasue), charmTime (incubus), reach
     (stilt clown), orbEvery/orbTime (city elf darkness orbs), invulnerable (guard).
   - bosses.heather.custard = 0.25: hp fraction where the custard ticket drops.
     bosses.dispenser.parts / boomyMul / facade:true for the facade boss.
   - level.party = ['mongo']: overrides game.party() inside that level.
   - level.final / win: true on a3_escape. level.next / thenArea / thenEntry.
   - level.chunks for plant levels: every pool chunk holds the same number of C,
     so plant.charges = count * C-per-chunk whatever the seeded order.
   - Survival levels use only chunks.start (one fixed 20-col screen, end: null).
   - survival.guardHp: barricade hp. escape.bursts are seconds REMAINING.
   - area.rows N chars map to area.npcs in order (npcs[i].x = that column, tiles).
     area.rows 'P' = spawn for a new run (no entry given).
   - area.signs: texts for 'n' signs in a street, in order.
   - items[id].bonus {str|con|dex|int|hp}: passive bonus while held (key items).
   - D.who: speaker name -> portrait id (merge into the UI's WHO_PORTRAIT).
   - D.mordecaiHints: [{when:{flags,notFlags}, text}] story hints Mordecai gives
     at the inn before falling back to the random D.mordecai tips.
   - shops[id].lines / inns[id].lines: keeper chatter. shop item `limit` = per run.
   - level.clearToExit: the exit stays shut until every enemy is dead (a1_lions).
   - level.startGives [{item,n}]: topped up on entering (only if the player has fewer);
     a2_dispenser guarantees 2 dynamite for the Boomy Boy. Optional for game.js.
   - level.quest is {start, done}; either may be an id or an array (a3_depot finishes
     one quest and starts the next). level.bossMusic: track for the boss part of a side level.
   - plant.finale 'handoff' (a3_depot): at T, BOMB hands the detonator to Katia,
     no blast here (the depot blows in a3_escape's outro). Default = the big blast.
   - room.rooms[i].intro: AI line when the ring starts. room.finale.kind/name/meter
     are labels for the HUD; rooms.js reads seconds/worms/rate/lines/doneLines/music.
   - area.enemiesAfter {flag, day, night}: replaces area.enemies once flag is set
     (circus_park after circus_gone).
   - D.layouts[id] (climb/drop rows, also inlined as level.layout), D.streetRows[id]
     (also inlined as area.rows), chunks[id].theme (the set it was drawn for; the
     level's theme decides the look).
   - events gives also take {item, n} for key items; events.npc fires on talk.
   - achievements[id].box null = no prize (YELLOW-BELLIED CHICKENSHIT, EARLY BIRD).
   - DESIGN 16 (crawler section near the end): D.gear {id: name short who icon perk perkText desc},
     D.start, D.balance, D.plotArmor, D.donutGripes. Gives take {gear: id}. bosses[id].hp is per
     phase bar; phases[1+] carry name/sub/line for the banner. D.ai.carlFeet: Book One's foot pool.
   Tone (DESIGN 16.4): adult, swears like the book, no slurs, nothing sexual near minors, the
   murdered women are never the joke.
   Text rules: uppercase ASCII + the font's glyphs, no em dashes, <= 160 chars.
   ========================================================================== */
(function () {
  'use strict';
  var DCW = window.DCW = window.DCW || {};
  var D = DCW.data = {};

  D.version = 2;

  D.meta = {
    title: "DUNGEON CRAWLER CARL",
    subtitle: "BOOK 2: CARL'S DOOMSDAY SCENARIO",
    floor: 3, floorName: 'THE OVER CITY',
    startArea: 'village', startEntry: 'left',
    startCinema: 'arrival',            // before the class pick (the guide's room)
    afterClassCinema: 'floor_open',    // after it (Floor 2 collapses, the clock starts)
    startHours: 192, startHour: 7,
    actOfLevel: true                    // levels carry act 1-3
  };

  D.themes = ['village', 'ruins', 'circus', 'basement', 'settlement', 'alley', 'admin', 'office', 'nest',
    'ymca', 'school', 'depot', 'escape', 'restroom', 'temple'];
  D.backdrops = ['inn_pug', 'inn_narwhal', 'club', 'studio', 'greenroom', 'guide_room'];

  /* speaker name -> portrait (the UI may merge this into WHO_PORTRAIT) */
  D.who = {
    'SYSTEM AI': 'p_ai', 'CARL': 'p_carl', 'DONUT': 'p_donut', 'PRINCESS DONUT': 'p_donut', 'MONGO': 'p_mongo',
    'MORDECAI': 'p_mordecai', 'KATIA': 'p_katia', 'SIGNET': 'p_signet', 'TSARINA SIGNET': 'p_signet',
    'GRIMALDI': 'p_grimaldi', 'APOLLON': 'p_apollon', 'CLAMMY': 'p_clammy', 'HEATHER': 'p_heather',
    'GORDO': 'p_gordo', 'FITZ': 'p_fitz', 'CLARABELLE': 'p_clarabelle', 'QUINT': 'p_quint', 'PUSTULE': 'p_pustule',
    'GUMGUM': 'p_gumgum', 'VINCENTE': 'p_vincente', 'MISS QUILL': 'p_quill', 'BURGUNDY': 'p_burgundy',
    'REMEX': 'p_remex', 'BAUTISTA': 'p_bautista', 'HEKLA': 'p_hekla', 'RIPPER WONTON': 'p_ripper', 'RIPPER': 'p_ripper',
    'ZEV': 'p_zev', 'ODETTE': 'p_odette', 'LUCIA MAR': 'p_lucia', 'EUNICE': 'p_eunice',
    'EDGE DANCER': 'p_edge_dancer', 'TALON STRONG': 'p_talon', 'LUCKY': 'p_lucky'
  };

  /* ---------------- items (explosive ids fixed: jug hob dyn smoke) ---------------- */
  D.items = {
    jug: { name: "CARL'S JUG O'BOOM", kind: 'explosive', icon: 'jug', projectile: 'jug',
      desc: "MOONSHINE, A RAG AND A SHITTY ATTITUDE. LOB IT. IT POPS, THEN THE GROUND BURNS FOR A WHILE. FIRE KILLS MOLD LIONS FOR GOOD." },
    hob: { name: 'HOB-LOBBER', kind: 'explosive', icon: 'hob', projectile: 'hob',
      desc: "A HOBGOBLIN BOMB SMALLER THAN A BASEBALL. LOB IT, OR PUT IT IN THE XISTERA AND FIRE IT STRAIGHT DOWN SOMETHING'S THROAT. BURSTS ON IMPACT." },
    dyn: { name: 'GOBLIN DYNAMITE', kind: 'explosive', icon: 'dyn', projectile: 'dyn_stick',
      desc: "GOBLIN DYNAMITE. 1.6 SECOND FUSE, ENORMOUS OPINION. DOWN + SPECIAL STRAPS IT TO CLOCKWORK MONGOS. THE SYNDICATE FUCKING LOVES THAT." },
    smoke: { name: 'SMOKE BOMB', kind: 'explosive', icon: 'smoke',
      desc: "A HOBGOBLIN SMOKE CURTAIN IN A BALL. ANYTHING IN THE CLOUD FORGETS WHERE YOU ARE FOR FOUR SECONDS. IT ALSO SMELLS LIKE A WET ASS." },
    moonshine: { name: 'JUG OF MOONSHINE', kind: 'material', sprite: 'qi_moonshine',
      desc: "CLEAR, LOUD AND ILLEGAL IN SIX SYSTEMS. CRAFT IT INTO A JUG O'BOOM AT ANY INN. DO NOT DRINK IT. MORDECAI DRINKS IT. LOOK AT MORDECAI." },

    /* key items (sprites from the fixed qi_* list) */
    big_top_ticket: { name: 'BIG TOP TICKET', kind: 'key', sprite: 'qi_ticket',
      desc: "ADMIT ONE. GRIMALDI'S TRAVELING CIRCUS, CENTER RING. NO REFUNDS. NO EXITS. NO SURVIVORS SINCE THE FUCKING CATACLYSM." },
    scratch_ticket: { name: 'FIREBALL OR CUSTARD?', kind: 'key', sprite: 'qi_custard',
      desc: "A SCRATCH TICKET THAT TALKS LIKE A PHONE GAME. A HUGE FIREBALL OR A FACE FULL OF CUSTARD. ODDS UNDISCLOSED. THE TICKET IS A LITTLE SHIT." },
    str_rings: { name: 'TWO RINGS OF +2 STR', kind: 'key', sprite: 'qi_ring', bonus: { str: 2 },
      desc: "LOOTED OFF A DEAD CRAWLER NAMED NICA. +2 STRENGTH EACH. SHE WOULD HAVE WANTED YOU TO HAVE THEM. PROBABLY. SHE IS IN NO SHAPE TO ARGUE." },
    anklet: { name: 'ANKLET OF THE FALLEN OAK', kind: 'key', sprite: 'qi_anklet',
      desc: "DONUT TOOK IT OFF GRACE BAUTISTA 3. ENCHANTED. SOMEBODY IN THIS TOWN IS VERY, VERY INTERESTED IN WHOEVER WEARS IT. THAT IS NOT GOOD NEWS." },
    gate_pass: { name: 'GATE PASS', kind: 'key', sprite: 'qi_pass',
      desc: "FOUND ON GUMGUM'S BODY. SIGNED BY MAGISTRATE FEATHERFALL. OPENS THE GATE TO THE ADMINISTRATIVE DISTRICT. SHE DIED HOLDING IT." },
    letter: { name: 'MYSTERIOUS LETTER', kind: 'key', sprite: 'qi_letter',
      desc: "WRITTEN IN THE SCRIBBLY LANGUAGE OF NECROMANCERS, SEALED WITH A FEATHER. NOBODY WRITES A LETTER LIKE THIS ABOUT A BAKE SALE." },
    pet_carrier: { name: 'MAGICAL PET CARRIER', kind: 'key', sprite: 'qi_carrier',
      desc: "DONUT BOUGHT IT FOR MONGO. IT FOLDS LIKE A RUBIK'S CUBE AND MONGO SCREAMS LIKE A GODDAMN TEAKETTLE EVERY TIME HE SEES IT." },
    fang_caps: { name: 'FANG CAPS', kind: 'key', sprite: 'qi_caps',
      desc: "ENCHANTED CAPS THAT SNAP ONTO MONGO'S TEETH LIKE LEGO. NOW HIS BITE HURTS GHOSTS. NOW NOTHING IS SAFE. NOTHING. NOT EVEN YOUR ANKLES." },
    upgrade_scroll: { name: 'SCROLL OF UPGRADE', kind: 'key', sprite: 'qi_scroll',
      desc: "USED ON THE ENCHANTED BIGBOI BOXERS. FREEBALLING: EVERY ATTACK FROM BELOW THE WAIST HITS TWICE AS HARD. YOUR NUTS ARE NOW A WEAPONS PLATFORM." },
    sepsis_crown: { name: 'THE SEPSIS CROWN', kind: 'key', sprite: 'qi_crown',
      desc: "DONUT'S CROWN. SHE WOULD LIKE YOU TO STOP CALLING IT A KEY ITEM. SHE WOULD LIKE YOU TO CALL IT HER CROWN. SHE WOULD LIKE YOU TO KNEEL." },
    kimaris: { name: 'KIMARIS IN A GLASS CASE', kind: 'key', sprite: 'qi_case',
      desc: "A STUFFED DEMON DUKE ON A HORSE IN A SHEOL GLASS REAPER CASE, FROM MISS QUILL'S TOP SHELF. THE CASE IS THE VALUABLE PART. THE DOLL IS JUST CREEPY." },
    detonator: { name: 'REMOTE DETONATOR', kind: 'key', sprite: 'qi_key',
      desc: "ONE BUTTON. TEN STICKS OF DYNAMITE IN THE GUARD DEPOT. KATIA IS HOLDING IT. DO NOT BUMP KATIA. FOR FUCK'S SAKE, DO NOT BUMP KATIA." },
    doomsday: { name: "CARL'S DOOMSDAY SCENARIO", kind: 'key', sprite: 'qi_crystal',
      desc: "A SOUL CRYSTAL ABOUT TO GO OFF, CAPPED IN A SHEOL GLASS REAPER CASE. IF IT EVER LEAVES YOUR INVENTORY, EVERYTHING NEARBY BECOMES RED MIST." }
  };

  D.recipes = {
    jug: { name: "JUG O'BOOM", needs: { moonshine: 1 }, gives: { jug: 1 },
      desc: "ONE JUG OF MOONSHINE, ONE RAG, ONE LIGHTER. CARL HAS ALCHEMY 3 NOW. THIS IS WHAT HE DOES WITH IT. THIS IS ALL HE DOES WITH IT." },
    jug_batch: { name: "JUG O'BOOM, CASE OF FOUR", needs: { moonshine: 3 }, gives: { jug: 4 },
      desc: "BULK BREWING. THREE JUGS OF MOONSHINE MAKE FOUR BOMBS IF YOU SKIM THE RAGS. MORDECAI CALLS THIS A GODDAMN WASTE. OF MOONSHINE." }
  };

  /* ---------------- shops ----------------
     give: {item, n} | {potion: n} | {skin: id} | {box: tier}. Prices are act 1 values. */
  D.shops = {
    lucky: { name: "LUCKY'S GENERAL GOODS", keeper: 'LUCKY', sprite: 'lucky', portrait: 'p_lucky', items: [
      { id: 'potion', name: 'HEALTH POTION', desc: "HEALS HALF YOUR MAX HP. MORDECAI'S RECIPE. SMELLS LIKE A GYM BAG FULL OF CHERRIES AND TASTES LIKE THE GYM BAG.", price: 30, give: { potion: 1 } },
      { id: 'moonshine', name: 'JUG OF MOONSHINE', desc: "FOR CRAFTING JUGS O'BOOM AT THE INN. LUCKY SWEARS IT IS FOR CLEANING. LUCKY HAS NEVER CLEANED A FUCKING THING.", price: 12, give: { item: 'moonshine', n: 1 } },
      { id: 'moonshine3', name: 'MOONSHINE, THREE PACK', desc: "THREE JUGS. LUCKY HAS STOPPED ASKING QUESTIONS. LUCKY STOPPED CARING ABOUT TWO HUNDRED YEARS AGO.", price: 32, give: { item: 'moonshine', n: 3 } },
      { id: 'smoke', name: 'SMOKE BOMB', desc: "ONE SMOKE BOMB. FOR EXITS, ENTRANCES, MAGIC TRICKS AND FARTING IN AN ELEVATOR WITH PLAUSIBLE DENIABILITY.", price: 18, give: { item: 'smoke', n: 1 } },
      { id: 'jug', name: "JUG O'BOOM", desc: "LUCKY MAKES THESE TOO. HIS RAGS ARE WORSE. THEY STILL BURN. EVERYTHING BURNS IF YOU BELIEVE IN IT.", price: 26, give: { item: 'jug', n: 1 } },
      { id: 'mystery', name: 'MYSTERY BOX', desc: "A BRONZE BOX FROM THE BACK ROOM. IT RATTLES. LUCKY SAYS THAT IS NORMAL. SOMETHING INSIDE SAYS HELP.", price: 45, give: { box: 'bronze' }, limit: 3 }
    ], lines: [
      "WELCOME TO LUCKY'S! EVERYTHING HERE IS LUCKY EXCEPT THE PRICES, THE STOCK, AND ME. MOSTLY ME. MY WIFE LEFT ME FOR A GIRAFFE.",
      "GUARDS OUTSIDE? GOOD. MEANS NOBODY ROBS ME. MEANS NOBODY ROBS YOU EITHER. EXCEPT ME. WITH PRICES. THAT'S CAPITALISM, ASSHOLE.",
      "MOONSHINE IS FOR CLEANING. THAT IS MY STORY AND I AM STICKING TO IT. HIC. SHIT. FORGET THE HIC.",
      "YOU SMELL LIKE CLOWN. EVERYBODY SMELLS LIKE CLOWN THIS WEEK. IT GETS IN THE CLOTHES. YOU DON'T HAVE CLOTHES. IT GOT IN YOU."
    ] },
    edge_dancer: { name: "LUCKY'S GENERAL GOODS (SETTLEMENT)", keeper: 'EDGE DANCER', sprite: 'edge_dancer', portrait: 'p_edge_dancer', items: [
      { id: 'potion', name: 'HEALTH POTION', desc: "HEALS HALF YOUR MAX HP. SKYFOWL GRADE. SAME POTION, MORE FEATHERS IN IT. TRY NOT TO THINK ABOUT WHERE THE FEATHERS WERE.", price: 30, give: { potion: 1 } },
      { id: 'potion3', name: 'POTION THREE PACK', desc: "THREE POTIONS. A DISCOUNT FOR THE FLIGHTLESS. EDGE DANCER INSISTS IT IS NOT AN INSULT. IT IS ABSOLUTELY AN INSULT.", price: 80, give: { potion: 3 } },
      { id: 'moonshine3', name: 'MOONSHINE, THREE PACK', desc: "THREE JUGS FOR CRAFTING. THE SKYFOWL DRINK IT FROM SAUCERS, LIKE CATS. DO NOT TELL DONUT. DO NOT ASK.", price: 32, give: { item: 'moonshine', n: 3 } },
      { id: 'smoke2', name: 'SMOKE BOMB PAIR', desc: "TWO SMOKE BOMBS. FOR WHEN ONE DRAMATIC EXIT IS NOT ENOUGH AND YOU NEED TO FUCK OFF TWICE.", price: 34, give: { item: 'smoke', n: 2 } },
      { id: 'mystery', name: 'MYSTERY BOX', desc: "A SILVER BOX. EDGE DANCER FOUND IT ON A ROOF. HE FINDS A LOT OF THINGS ON ROOFS. SOME OF THEM WERE STILL ALIVE.", price: 90, give: { box: 'silver' }, limit: 2 }
    ], lines: [
      "YES, THIS IS ALSO LUCKY'S. LUCKY IS A FRANCHISE. LUCKY IS EVERYWHERE. DO NOT THINK ABOUT IT TOO HARD. IT GETS FUCKING EXISTENTIAL.",
      "WELCOME, GROUND PERSON. PLEASE WIPE YOUR FEET. ALL OF THEM. WHY IS THERE GLITTER ON THEM. WHY DOES THE SKY KEEP CHEERING WHEN YOU WIGGLE THEM.",
      "THE MAGISTRATE NEVER COMES DOWN TO THE SHOPS. MISS QUILL HANDLES EVERYTHING. MISS QUILL IS VERY ORGANIZED. MISS QUILL SCARES THE SHIT OUT OF ME.",
      "A FLIGHTLESS CUSTOMER WITH GOLD. THE MODERN WORLD IS AMAZING. DISGUSTING, BUT AMAZING."
    ] },
    talon: { name: "TALON STRONG'S OUTFITTERS", keeper: 'TALON STRONG', sprite: 'talon', portrait: 'p_talon', items: [
      { id: 'potion', name: 'HEALTH POTION', desc: "HEALS HALF YOUR MAX HP. TALON CALLS IT A RECOVERY BEVERAGE. TALON ALSO CALLS HIS ABS A LIFESTYLE.", price: 32, give: { potion: 1 } },
      { id: 'skin_jacket', name: 'JACKET AND JEANS', desc: "AN OUTFIT. PANTS INCLUDED. THE AUDIENCE WILL WRITE LETTERS. ANGRY LETTERS. SOME OF THEM WILL BE SCRAWLED IN BLOOD.", price: 220, give: { skin: 'carl_jacket' }, limit: 1 },
      { id: 'skin_toga', name: 'THE SENATOR', desc: "A BEDSHEET TOGA. SKYFOWL FIND IT DIGNIFIED. EVERYBODY ELSE CAN SEE YOUR ASS. THE CAMERA DRONES SEND THEIR THANKS.", price: 260, give: { skin: 'carl_toga' }, limit: 1 },
      { id: 'skin_kilt', name: 'THE HIGHLANDER', desc: "A KILT. MAXIMUM KICK. FREEBALLING APPROVED, WHICH TALON SAYS WHILE STARING AT YOUR CROTCH LIKE IT IS A FEATURE.", price: 300, give: { skin: 'carl_kilt' }, limit: 1 },
      { id: 'mystery', name: 'MYSTERY BOX', desc: "A GOLD BOX. TALON WON IT AT CARDS. TALON CHEATS AT CARDS. THE GUY HE BEAT IS STILL IN THE ALLEY, MISSING A THUMB.", price: 180, give: { box: 'gold' }, limit: 1 }
    ], lines: [
      "TALON STRONG. STRONG IS THE LAST NAME. IT IS ALSO A LIFESTYLE. FEEL THAT. NO, THE ARM. FEEL THE ARM.",
      "CLOTHES MAKE THE CRAWLER. YOU, FOR EXAMPLE, ARE MADE OF A JACKET, A PAIR OF MAGIC SHORTS AND ONE TERRIBLE FUCKING DECISION.",
      "I HAVE PANTS. I HAVE SEVERAL PANTS. I AM NOT JUDGING. I AM SELLING. ALSO JUDGING. YOUR JUNK IS ON TELEVISION, MAN.",
      "THE ELVES OF THE 201ST BUY UNIFORMS HERE. THEY PAY IN EXACT CHANGE. CREEPY BASTARDS PAY IN EXACT CHANGE. EVERY TIME."
    ] },
    pustule: { name: 'HOBGOBS AND BOOM STICKS', keeper: 'PUSTULE', sprite: 'pustule', portrait: 'p_pustule', items: [
      { id: 'hob4', name: 'HOB-LOBBERS, FOUR', desc: "FOUR HOB-LOBBERS. FUSED OR IMPACT. PUSTULE ADJUSTS THEM WITH HER TEETH. DON'T WATCH. YOU WILL WATCH.", price: 40, give: { item: 'hob', n: 4 } },
      { id: 'hob10', name: 'HOB-LOBBERS, TEN', desc: "TEN HOB-LOBBERS. A BULK DISCOUNT AND A SMILE THAT OOZES. LITERALLY. SOMETHING DRIPPED ON THE COUNTER.", price: 90, give: { item: 'hob', n: 10 } },
      { id: 'dyn', name: 'GOBLIN DYNAMITE', desc: "ONE STICK. LONG FUSE, SHORT TEMPER, BIG FUCKING BLAST.", price: 30, give: { item: 'dyn', n: 1 } },
      { id: 'dyn3', name: 'GOBLIN DYNAMITE, THREE', desc: "THREE STICKS. ENOUGH TO REDECORATE A MANTA RAY. THE INSIDES GO ON THE OUTSIDE. INTERIOR DESIGN.", price: 80, give: { item: 'dyn', n: 3 } },
      { id: 'smoke3', name: 'SMOKE CURTAINS, THREE', desc: "HOBGOBLIN SMOKE CURTAINS. PUSTULE SAYS THEY SMELL LIKE LAVENDER. THEY SMELL LIKE PUSTULE'S ARMPIT.", price: 45, give: { item: 'smoke', n: 3 } },
      { id: 'moonshine3', name: 'HOBGOBLIN HOOCH, THREE', desc: "THREE JUGS OF MOONSHINE. STRONGER THAN LUCKY'S PISS. THE JUGS ARE SWEATING. THE JUGS ARE AFRAID.", price: 30, give: { item: 'moonshine', n: 3 } }
    ], lines: [
      "WELL HELLO, SUGAR. HOBGOBS AND BOOM STICKS, OPEN ALL NIGHT. YOU BLOW SOMETHING UP IN THIS TOWN, I PROBABLY SOLD IT TO YOU.",
      "LIKE THE SHIRT? IT'S A UNICORN IN SUNGLASSES. IT'S THE COOLEST THING I OWN, AND I OWN ENOUGH DYNAMITE TO MOVE A FUCKING MOUNTAIN.",
      "DON'T STARE AT THE SORE, HONEY. IT KNOWS WHEN YOU STARE. IT GETS SHY. THEN IT GETS WET.",
      "MORDECAI'S FRIENDS GET THE GOOD FUSES. EVERYBODY ELSE GETS THE FUN FUSES. THE FUN ONES TAKE FINGERS.",
      "SMOKE CURTAINS ARE BACK IN STOCK. TOLD YOU I'D HAVE THEM. PUSTULE KEEPS HER PROMISES. AND HER FINGERS. MOST OF THEM. SHIT, WHERE'S THE PINKY."
    ] },
    quint: { name: "QUINT'S PHARMACY", keeper: 'QUINT', sprite: 'quint', portrait: 'p_quint', items: [
      { id: 'potion2', name: 'HEALTH POTION, TWO', desc: "TWO POTIONS, MEMBER PRICE. QUINT DOES NOT SMILE WHEN HE SAYS MEMBER PRICE. QUINT DOES NOT SMILE.", price: 50, give: { potion: 2 } },
      { id: 'potion5', name: 'HEALTH POTION, FIVE', desc: "FIVE POTIONS. FOR CRAWLERS WITH PLANS. OR, MORE LIKELY, CRAWLERS WITH NO FUCKING PLAN AT ALL.", price: 115, give: { potion: 5 } },
      { id: 'starter', name: "ALCHEMIST'S STARTER KIT", desc: "FIVE JUGS OF MOONSHINE AND A FUNNEL. MORDECAI BOUGHT ONE TOO. HIS IS ALREADY EMPTY. SO IS THE FUNNEL. HE DRANK THROUGH IT.", price: 55, give: { item: 'moonshine', n: 5 } },
      { id: 'skin_pajamas', name: 'BUNNY PAJAMAS', desc: "FOOTIE PAJAMAS WITH EARS. THE SLIPPERS JUMP TWICE. QUINT WILL NOT SAY WHERE HE GOT THEM. THE STAINS ARE NOT SAYING EITHER.", price: 350, give: { skin: 'carl_pajamas' }, limit: 1 },
      { id: 'box_gold', name: 'UNDER THE COUNTER', desc: "A GOLD BOX. NO QUESTIONS. QUINT WAS A CRAWLER ONCE. HE KNOWS WHAT YOU NEED. HE ALSO KNOWS HOW YOU DIE. HE WON'T SAY.", price: 200, give: { box: 'gold' }, limit: 2 }
    ], lines: [
      "PHARMACY. QUINT. WHAT DO YOU NEED. MAKE IT FAST, I HAVE A WHOLE CLUB OF ASSHOLES TO OVERCHARGE.",
      "I WAS A CRAWLER ONCE. NOW I'M HALF DJINN, HALF GARBAGE SCOWL AND ALL PHARMACIST. DON'T ASK HOW. IT DOESN'T GET BETTER. IT GETS WORSE.",
      "MORDECAI SENT YOU. HE ALWAYS SENDS THE ONES WHO ARE GOING TO NEED A LOT OF POTIONS. AND A CLOSED CASKET.",
      "YES, THE VOICE IS REAL. NO, I WON'T SAY THE LINE. EVERYBODY WANTS THE FUCKING LINE.",
      "DON'T DIE IN THE CLUB. THE CLEANUP FEE IS RIDICULOUS. THE LAST GUY TOOK THREE MOPS AND A PRIEST."
    ] }
  };

  D.inns = {
    pug: { name: 'THE BELLY-RUBBED PUG', price: 10, keeper: 'gordo', keeperName: 'GORDO', theme: 'inn_pug', lines: [
      "WELCOME TO THE PUG. TEN GOLD A NIGHT. FOOD COSTS NOW. THE SHOW SAYS IT BUILDS CHARACTER. I SAY IT BUILDS PROFIT. PAY UP.",
      "DON'T MIND THE SMELL. THAT'S ME. WET MOSS. IT'S A BOPCA THING. YOU GET USED TO IT. NOBODY HAS EVER GOT USED TO IT.",
      "YOUR GUIDE CAME IN THROUGH THE WALL AGAIN. HE PUKED ON MY FLOOR, PASSED OUT IN IT AND THREE GIRLS TRIED TO BUY HIM A DRINK ANYWAY.",
      "THREE TVS, A FIREPLACE AND A STEW THAT IS MOSTLY STEW. THE REST IS LEMUR. YOU'RE WELCOME."
    ] },
    narwhal: { name: 'THE ONE-EYED NARWHAL', price: 20, keeper: 'fitz', keeperName: 'FITZ', theme: 'inn_narwhal', lines: [
      "ONE-EYED NARWHAL. FOUR ROOMS. TWENTY GOLD. THE NARWHAL HAD TWO EYES WHEN I HUNG IT UP. SOME DRUNK SON OF A BITCH TOOK ONE.",
      "THE MAGISTRATE? FEATHERFALL. DARK CLERIC. CONTROLS THE UNDEAD, THEY SAY. NOBODY'S SEEN HIM IN YEARS. NOBODY ASKS. ASKING GETS YOU DEAD.",
      "SKYFOWL DRINK UPSTAIRS. EVERYBODY ELSE DRINKS DOWN HERE. SHIT ROLLS DOWNHILL. THAT'S THE WHOLE TOWN IN ONE SENTENCE.",
      "YOUR HORNY GUIDE OWES ME FOR SIX BOTTLES. HALF MY CUSTOMERS WANT TO SLEEP WITH HIM AND HE WANTS TO SLEEP UNDER THE BAR. TELL HIM FITZ SAID PAY."
    ] }
  };

  /* ---------------- enemy scaling (optional helper) ----------------
     tier = home act of the base stats. Expected punch damage: act 1 ~3-8, act 2 ~9-12,
     act 3 ~12-16. Max hp: act 1 16-26, act 2 26-34, act 3 34-44. */
  D.actScale = [
    { hp: 1.0, dmg: 1.0, xp: 1.0, gold: 1.0 },
    { hp: 1.9, dmg: 1.4, xp: 1.8, gold: 1.4 },
    { hp: 2.6, dmg: 1.8, xp: 2.4, gold: 1.8 }
  ];
  D.enemyFor = function (id, act) {
    var e = D.enemies && D.enemies[id];
    if (!e) return null;
    var top = D.actScale.length;
    var t = Math.max(1, Math.min(top, e.tier || 1));
    var f = Math.max(1, Math.min(top, act || t));
    var out = {}, k;
    for (k in e) if (Object.prototype.hasOwnProperty.call(e, k)) out[k] = e[k];
    if (f <= t || e.citizen || e.invulnerable) return out;
    var a = D.actScale[t - 1], b = D.actScale[f - 1];
    out.hp = Math.max(1, Math.round(e.hp * b.hp / a.hp));
    out.dmg = Math.max(1, Math.round(e.dmg * b.dmg / a.dmg));
    out.xp = Math.max(0, Math.round(e.xp * b.xp / a.xp));
    if (e.bodyHp) out.bodyHp = Math.round(e.bodyHp * b.hp / a.hp);
    if (e.gold) out.gold = [Math.round(e.gold[0] * b.gold / a.gold), Math.round(e.gold[1] * b.gold / a.gold)];
    out.scaledFrom = t;
    return out;
  };

  /* ---------------- enemies (ids fixed by DESIGN 6.4) ---------------- */
  D.enemies = {
    lemur: { name: 'FORMER CIRCUS LEMUR', level: 8, tier: 1, hp: 11, dmg: 2, speed: 44, w: 12, h: 14, ai: 'perch',
      projectile: 'knife', shootEvery: 2.2, aggro: 150, dropRange: 40, xp: 3, gold: [1, 4], sprite: 'lemur', hiddenUntilSeen: true,
      flavor: "RED FUR, A PAINTED HUMAN SKULL FOR A FACE AND A BANDOLIER OF KNIVES. THE SKULL'S LAST OWNER DID NOT GIVE IT UP NICELY. SO CUTE. SO FUCKING STABBY." },
    stilt_clown: { name: 'TERROR THE CLOWN', level: 10, tier: 1, hp: 30, dmg: 3, speed: 46, w: 14, h: 44, ai: 'stilt',
      reach: 28, aggro: 170, fearImmune: true, kb: 0.4, xp: 10, gold: [4, 10], sprite: 'stilt_clown',
      flavor: "ELEVEN FEET OF CLOWN, FUSED TO ITS STILTS AT THE BONE. NO EYES, NO NOSE, ONE BIG RED MOUTH. FEAR DOES NOTHING. THERE IS NO ROOM IN THERE FOR FEAR. ONLY TEETH." },
    fat_clown: { name: 'CLAMMY-TYPE CLOWN', level: 9, tier: 1, hp: 18, dmg: 2, speed: 34, w: 20, h: 18, ai: 'jumper',
      jump: 240, aggro: 140, kb: 0.6, xp: 4, gold: [2, 5], sprite: 'fat_clown',
      flavor: "SHORT, THREE TIMES AS WIDE, IN A GOWN THAT WAS PINK BEFORE THE CATACLYSM AND IS NOW CRUSTY. BOUNCES ON ITS BELLY. SHITLOADS OF TEETH FOR A CLOWN." },
    mold_lion: { name: 'MOLD LION', level: 15, tier: 1, hp: 22, dmg: 3, speed: 50, w: 26, h: 16, ai: 'charger',
      chargeSpeed: 190, aggro: 160, regrow: true, regrowTime: 8, xp: 8, gold: [3, 8], sprite: 'mold_lion',
      flavor: "A LION WITH A MANE OF PINK AND GREEN WORMS THAT WRITHE AND DRIP. KILL IT AND IT GETS BACK UP. BURN IT AND IT SCREAMS AND STAYS THE FUCK DOWN." },
    giraffe: { name: 'ARTILLERY GIRAFFE', level: 12, tier: 1, hp: 40, dmg: 3, speed: 8, w: 24, h: 40, ai: 'launcher',
      spawn: 'lemur', spawnEvery: 5, maxSpawn: 3, aggro: 220, kb: 0.1, armor: 1, xp: 12, gold: [5, 12], sprite: 'giraffe',
      flavor: "THE CIRCUS TAUGHT IT TO CATCH LEMURS ON ITS NECK. THE CATACLYSM TAUGHT IT TO THROW THEM. AT YOU. THE LEMURS DO NOT GET A VOTE. THEY LAND HARD." },
    street_urchin: { name: 'STREET URCHIN', level: 8, tier: 1, hp: 14, dmg: 2, speed: 60, w: 14, h: 14, ai: 'urchin',
      neutral: true, nightOnly: true, angerTime: 1, xp: 3, gold: [0, 3], sprite: 'street_urchin',
      flavor: "A KNEE-HIGH SPIKY TUMBLEWEED WITH A JANITOR'S WORK ETHIC. IT WANTS THE TRASH. AND THE CORPSES. STAND BETWEEN IT AND THE TRASH AND IT WILL SHRED YOU." },
    brain_boiler: { name: 'BRAIN BOILER', level: 10, tier: 1, hp: 12, dmg: 1, speed: 16, w: 16, h: 20, ai: 'floater', flying: true,
      projectile: 'psionic', shootEvery: 3.2, aggro: 160, fearImmune: true, xp: 4, gold: [1, 4], sprite: 'brain_boiler',
      flavor: "A SQUID STUCK IN AN UMBRELLA THAT MADE IT EVERYBODY'S PROBLEM. ITS PSIONIC RING SOFT-BOILS YOUR BRAIN. LOW CHARISMA? ENJOY THE NOSEBLEED, DUMBASS." },
    incubus: { name: 'INCUBUS', level: 14, tier: 1, hp: 24, dmg: 3, speed: 40, w: 14, h: 22, ai: 'charm',
      charmTime: 2, charmEvery: 5, aggro: 140, xp: 8, gold: [3, 9], sprite: 'incubus',
      flavor: "SQUARE JAW, BAT WINGS, ABS YOU COULD GRATE CHEESE ON. ITS SMILE FLIPS YOUR LEFT AND RIGHT. YOUR GUIDE IS ONE NOW. DO NOT TELL HIM HE IS THE PRETTY ONE." },
    berserker: { name: 'SHAMBLING BERSERKER', level: 12, tier: 2, hp: 46, dmg: 4, speed: 22, w: 26, h: 44, ai: 'berserker',
      darkMul: 4, berserkSpeed: 120, aggro: 150, armor: 1, kb: 0.2, xp: 26, gold: [6, 14], sprite: 'berserker',
      flavor: "THIRTEEN FEET OF STITCHED-TOGETHER LEFTOVERS. WE COUNTED FOUR ASSES IN THERE. SLOW IN THE LIGHT. IN THE DARK IT GETS FOUR TIMES WORSE. FRANKENSTEIN WEEPS." },
    city_elf: { name: 'CITY ELF OF THE 201ST', level: 16, tier: 2, hp: 30, dmg: 3, speed: 38, w: 12, h: 20, ai: 'caster',
      projectile: 'bolt', shootEvery: 2.4, orbEvery: 7, orbTime: 6, aggro: 170, xp: 15, gold: [4, 10], sprite: 'city_elf',
      flavor: "MILITIA OF THE 201ST SECURITY GROUP. THEY THINK THE SKYFOWL ARE ANGELS AND THEY WILL GUT YOU TO PROVE IT. THEY CAST DARKNESS THE WAY ASSHOLES CAST SHADE." },
    wand_bearer: { name: 'WAND BEARER', level: 17, tier: 2, hp: 34, dmg: 3, speed: 34, w: 12, h: 20, ai: 'caster',
      projectile: 'bolt', shootEvery: 2.0, orbEvery: 9, orbTime: 5, aggro: 180, xp: 16, gold: [5, 12], sprite: 'wand_bearer',
      flavor: "TEACHING STAFF OF THE APITO EDUCATION CENTER. THE CURRICULUM IS WAND, TORTURE AND MORE WAND. THEY CARVED UP AN OLD ORC FOR FUN. EXTRA CREDIT FOR THESE PRICKS." },
    krasue: { name: 'KRASUE', level: 16, tier: 2, hp: 32, dmg: 4, speed: 44, w: 16, h: 24, ai: 'krasue', flying: true,
      magicOnly: true, bodyHp: 34, leash: 96, regrowTime: 8, aggro: 170, xp: 34, gold: [6, 14], sprite: 'krasue',
      flavor: "A FLOATING HEAD WITH ITS LUNGS, HEART AND SEVERAL WET YARDS OF GUT SWINGING UNDER IT. GHOST-CLASS. KILL THE HEAD AND IT COMES BACK. FIND THE BODY. WRECK IT." },
    shadow_leak: { name: 'SHADOW LEAK', level: 14, tier: 2, hp: 14, dmg: 2, speed: 52, w: 14, h: 14, ai: 'swarm', flying: true,
      magicOnly: true, group: 3, aggro: 180, xp: 16, gold: [1, 4], sprite: 'shadow_leak',
      flavor: "A PUFF OF HUNGRY SMOKE WITH A TOUCH COLD ENOUGH TO SHRIVEL YOUR BALLS. BOMBS PASS RIGHT THROUGH. FISTS DO NOT. FREE XP FOR ANYONE WILLING TO PUNCH A FART." },
    ruin_flocker: { name: 'RUIN FLOCKER', level: 18, tier: 3, hp: 26, dmg: 4, speed: 70, w: 16, h: 12, ai: 'flyer', flying: true,
      aggro: 200, xp: 14, gold: [2, 6], sprite: 'ruin_flocker',
      flavor: "RAGGED FEATHERED BATS THAT NEST IN THE RUINS AND SHIT THEMSELVES WHEN THE MAGIC GOES WEIRD. THE MAGIC IS VERY WEIRD NOW. IT IS RAINING BAT SHIT. RUN." },
    guard: { name: 'VILLAGE GUARD SWORDSMAN', level: 75, tier: 1, hp: 9999, dmg: 99, speed: 34, w: 18, h: 34, ai: 'guard',
      invulnerable: true, fearImmune: true, kb: 0, xp: 0, gold: [0, 0], sprite: 'guard',
      flavor: "LEVEL 75. FULL PLATE. A BLADE LONGER THAN YOU ARE. NO JAIL ON THIS FLOOR, JUST ONE SENTENCE, AND HE CARRIES IT OUT IN TWO PIECES. BOTH OF THEM YOURS." },
    citizen_human: { name: 'TOWNSPERSON', level: 1, tier: 1, hp: 1, dmg: 0, speed: 20, w: 12, h: 20, ai: 'citizen',
      citizen: true, xp: 0, gold: [0, 0], sprite: 'citizen_human',
      flavor: "A DESCENDANT OF THE CATACLYSM SURVIVORS. WORTH ZERO XP. HURTING ONE IS A CAPITAL CRIME. YOU JUST KILLED A GUY FOR NOTHING. GREAT JOB, ASSHOLE." },
    citizen_skyfowl: { name: 'SKYFOWL CITIZEN', level: 3, tier: 1, hp: 1, dmg: 0, speed: 22, w: 14, h: 24, ai: 'citizen',
      citizen: true, xp: 0, gold: [0, 0], sprite: 'citizen_skyfowl',
      flavor: "AN EAGLE-HEADED ARISTOCRAT WHO THOUGHT YOUR BARE FEET WERE A SOCIAL STATEMENT. THEY WERE. WORTH ZERO XP AND ONE LONG SWORD THROUGH YOUR SPINE." },
    chickadee: { name: 'CHICKADEE', level: 1, tier: 1, hp: 1, dmg: 0, speed: 28, w: 10, h: 12, ai: 'citizen',
      citizen: true, xp: 0, gold: [0, 0], sprite: 'chickadee',
      flavor: "A SMALL, ROUND BIRD PERSON. THE SKYFOWL'S FAVORITE COUSINS. YOU PUNCHED THE CHICKADEE. EVERYBODY SAW YOU PUNCH THE CHICKADEE. YOU SICK FUCK." }
  };

  /* ---------------- projectiles ---------------- */
  D.projectiles = {
    knife:     { sprite: 'knife',     w: 8,  h: 3,  speed: 180, dmg: 2, gravity: 0,   life: 2.5 },
    bolt:      { sprite: 'bolt',      w: 8,  h: 4,  speed: 190, dmg: 3, gravity: 0,   life: 2.5 },
    worm:      { sprite: 'worm',      w: 8,  h: 4,  speed: 46,  dmg: 2, gravity: 320, life: 5, crawl: true },
    spit:      { sprite: 'spit',      w: 10, h: 8,  speed: 130, dmg: 3, gravity: 200, life: 3 },
    psionic:   { sprite: 'psionic',   w: 12, h: 12, speed: 70,  dmg: 2, gravity: 0,   life: 3, ring: true },
    missile:   { sprite: 'missile',   w: 8,  h: 4,  speed: 220, dmg: 2, gravity: 0,   life: 2, friendly: true },
    /* book 1 set, kept for compatibility (nothing in book 2 fires them) */
    arrow:     { sprite: 'arrow',     w: 8, h: 3, speed: 150, dmg: 1, gravity: 0,   life: 3 },
    rock:      { sprite: 'rock',      w: 6, h: 6, speed: 120, dmg: 1, gravity: 360, life: 3 },
    fireball:  { sprite: 'fireball',  w: 8, h: 8, speed: 110, dmg: 2, gravity: 0,   life: 3 },
    bubble:    { sprite: 'bubble',    w: 8, h: 8, speed: 60,  dmg: 1, gravity: -20, life: 4.5 },
    bottle:    { sprite: 'bottle',    w: 6, h: 8, speed: 120, dmg: 2, gravity: 380, life: 3 },
    laser_orb: { sprite: 'laser_orb', w: 7, h: 7, speed: 130, dmg: 2, gravity: 0,   life: 3.5 },
    spore:     { sprite: 'spore',     w: 6, h: 6, speed: 50,  dmg: 1, gravity: 30,  life: 5 },
    note:      { sprite: 'note',      w: 7, h: 8, speed: 100, dmg: 1, gravity: 0,   life: 3.5 }
  };

  /* ---------------- bosses ----------------
     hp is PER PHASE (DESIGN 16.2): every phase is a full health bar, refilled with a banner
     (phase name/sub/line). Per-bar hp = round(1.5 * old single-bar hp / phases), so the whole
     fight is ~1.5x the old one before D.balance.bossHp. `below` no longer triggers phases. */
  D.bosses = {
    terror_big: { name: 'TERROR THE CLOWN', title: 'THE TALL ONE AT THE END OF THE STREET', level: 12,
      hp: 83, dmg: 3, w: 24, h: 56, sprite: 'terror_big', xp: 40, gold: [20, 40], flying: false, fearImmune: true,
      phases: [
        { below: 1.0, speed: 46, pattern: ['walk:1.5', 'charge', 'idle:1', 'shoot:knife:2', 'walk:1', 'jump_slam', 'idle:1.2'] },
        { below: 0.5, speed: 60, name: 'ENCORE', sub: 'THE LEMURS JOIN THE ACT',
          line: "HE CALLED HIS LITTLE FRIENDS! THE LEMURS ARE CLIMBING HIM LIKE A JUNGLE GYM AND HE IS PISSED NOW! MORE KNIVES! MORE CLOWN!",
          pattern: ['charge', 'idle:0.6', 'spawn:lemur:2', 'jump_slam', 'shockwave', 'shoot:knife:3', 'idle:0.9'] }
      ],
      intro: ["THAT CLOWN IS ON STILTS. THE STILTS ARE MADE OF MORE CLOWN. IT IS CLOWN ALL THE WAY DOWN, AND EVERY INCH OF IT WANTS TO WEAR YOUR FACE.",
        "FEAR WILL NOT WORK ON THIS ONE, CRAWLER. DO IT THE OLD-FASHIONED WAY. FISTS. FEET. MOSTLY FEET, PLEASE. BARE ONES. FOR US."],
      defeat: "TERROR THE CLOWN HAS FALLEN DOWN! IT TOOK FOUR SECONDS! THERE WAS A LOT OF HIM TO FALL AND MOST OF HIM SPLATTERED! TIMBER, MOTHERFUCKER!",
      loot: 'silver', unlock: null },

    heather: { name: 'HEATHER THE BEAR', title: 'LEVEL 19 NEIGHBORHOOD BOSS', level: 19,
      curedLines: [
        { who: 'SYSTEM AI', text: "CUSTARD! THE TICKET CAME UP CUSTARD! IT HEALS! THE WORMS ARE SHRIVELING UP AND DYING! THE BEAR IS... OH SHIT. THE BEAR IS JUST A BEAR AGAIN." },
        { who: 'CARL', text: "SHE'S SLOWING DOWN. SHE'S OLD AND SHE'S TIRED AND SHE'S NOT ANGRY ANYMORE. GODDAMNIT. I'M SORRY, HEATHER. LET'S FINISH THIS GENTLY." } ],
      hp: 120, dmg: 3, w: 40, h: 40, sprite: 'heather', xp: 100, gold: [40, 70], flying: false, custard: 0.25,
      phases: [
        { below: 1.0, speed: 72, pattern: ['walk:1', 'charge', 'idle:0.8', 'jump_slam', 'idle:1', 'charge', 'charge', 'idle:1.2'] },
        { below: 0.6, speed: 86, name: 'CAN OF WORMS', sub: 'THE PARASITES WAKE UP',
          line: "THE WORMS ARE AWAKE! THEY ARE POURING OUT OF HER LIKE SPAGHETTI OUT OF A DROPPED CAN! DO NOT STEP IN THE SPAGHETTI!",
          pattern: ['worms', 'charge', 'idle:0.6', 'jump_slam', 'worms', 'shockwave', 'charge', 'idle:1'] },
        /* the custard ticket drops at 25%: grab it and she slows down for the finish */
        { below: 0.25, speed: 24, name: 'LAST SKATE', sub: 'SHE IS SO TIRED',
          line: "SHE'S WOBBLING! SHE'S OLD AND SHE'S HURT AND SHE IS NOT FUCKING DONE! FINISH IT, CRAWLER. ONE WAY OR ANOTHER.",
          pattern: ['walk:2', 'idle:2.5', 'walk:1.5', 'idle:2'] }
      ],
      intro: ["HEATHER THE BEAR! FORTY YEARS ON ROLLER SKATES! RETIREMENT WAS WEEKS AWAY WHEN THE CATACLYSM HIT. NOW SHE HUNTS FOR THE CLOWNS AND LEAKS WORMS.",
        "A FLAMING SKULL, WORMS WHERE HER PAWS SHOULD BE AND A PINK TUTU. SHE FEELS NO PITY. SHE FEELS NO PAIN. SHE DOES A FUCKING GORGEOUS SPIN."],
      defeat: "HEATHER THE BEAR HAS SKATED HER LAST ROUTINE. NEIGHBORHOOD BOSS DOWN! YOUR MAP JUST GOT SMARTER. THE CROWD WENT QUIET. WEIRD. THAT NEVER HAPPENS.",
      loot: 'boss', unlock: null },

    dispenser: { name: 'THE DISPENSER', title: 'NEIGHBORHOOD BOSS, WALL SPECIES', level: 20, facade: true, camo: 0.34,
      hp: 160, dmg: 3, w: 192, h: 112, sprite: 'dispenser', xp: 240, gold: [60, 100], flying: false,
      parts: ['eye', 'mouth', 'wing'], boomyMul: 3,
      phases: [
        { below: 1.0, speed: 0, pattern: ['reveal', 'spit:spit:3', 'idle:1.5', 'cloak', 'reveal', 'idle:1', 'sweep', 'idle:2', 'cloak'] },
        { below: 0.55, speed: 0, name: 'BRAIN DRAIN', sub: 'THE WALL CALLS FOR BACKUP',
          line: "IT'S CALLING FOR BACKUP! BRAIN BOILERS, FRESH OFF THE WALL! THE BUILDING IS PISSED AND IT BROUGHT FRIENDS!",
          pattern: ['reveal', 'spit:spit:5', 'sweep', 'cloak', 'reveal', 'spawn:brain_boiler:2', 'idle:1', 'reveal', 'sweep', 'idle:1.2', 'cloak'] },
        { below: 0.25, speed: 0, name: 'PEEL OUT', sub: 'THE WALL COMES OFF THE WALL',
          line: "THE WHOLE FUCKING WALL IS COMING OFF THE WALL! IT IS SWEEPING THE STREET LIKE A RUG! DUCK OR GET FLATTENED!",
          pattern: ['reveal', 'sweep', 'spit:spit:6', 'reveal', 'sweep', 'cloak', 'reveal', 'idle:0.8'] }
      ],
      intro: ["THAT BUILDING IS LOOKING AT YOU. NO, REALLY. THAT IS NOT A WALL, CRAWLER. THAT IS A MANTA RAY THE SIZE OF A FUCKING WALL, WEARING THE WALL.",
        "THE DISPENSER! IT DISPENSES DEATH. AND SPIT. HOT, CHUNKY SPIT. ONLY THE PARTS IT SHOWS YOU CAN BE HURT. THE CAT'S EARS KNOW WHERE TO LOOK."],
      defeat: "THE DISPENSER IS OUT OF ORDER! IT IS NOW SPREAD ACROSS SIX BLOCKS LIKE CHUNKY JAM, AND A CLOCKWORK DINOSAUR IS THE TOP STORY IN NINE SYSTEMS!",
      loot: 'boss', unlock: null },

    vincente: { name: 'VINCENTE', title: 'CITY ELF, 201ST SECURITY GROUP', level: 16,
      hp: 255, dmg: 3, w: 16, h: 22, sprite: 'vincente', xp: 170, gold: [40, 80], flying: false,
      phases: [
        { below: 1.0, speed: 44, pattern: ['walk:1.2', 'shoot:bolt:3', 'idle:0.8', 'meat_hooks', 'walk:1', 'darkness', 'shoot:bolt:2', 'idle:1'] },
        { below: 0.5, speed: 58, name: 'LIGHTS OUT', sub: 'THE 201ST SENDS BACKUP',
          line: "HE'S BLINKING AROUND THE ALLEY AND HE CALLED A BUDDY FROM THE 201ST! TWICE THE ELF! TWICE THE SMUG! KICK BOTH IN THE SAME PLACE!",
          pattern: ['darkness', 'teleport', 'shoot:bolt:4', 'meat_hooks', 'spawn:city_elf:1', 'charge', 'spread:bolt:5', 'idle:0.8'] }
      ],
      intro: ["THE ELF WITH THE BURNING HAND! HE SAYS HE GUARDS ANGELS. HE IS STANDING OVER A DEAD ORC WITH HER BLOOD ON HIS BOOTS. PICK WHICH PART TO BELIEVE.",
        "HE HAS A SCROLL OF MEAT HOOKS AND HE LOVES USING IT. HIDE THE DINOSAUR. OR DON'T. THE DINOSAUR WANTS TO EAT THIS SMUG LITTLE SHIT."],
      defeat: "VINCENTE GOT KICKED SQUARE IN THE NUTS, THEN A CAT TOOK HIS HEAD CLEAN OFF HIS NECK. THE DINOSAUR IS KEEPING IT. THE GALAXY IS ON ITS FEET.",
      loot: 'boss', unlock: null }
  };
})();
/* ==========================================================================
   MAPS: chunks (12 rows, ground rows 10-11 at both edges), vertical layouts
   (climb / drop, 24 cols), and street rows for the areas.
   Authored with crawler2/tools source data; edit the rows directly if you like,
   then run node crawler2/tools/data_validate.js.
   Legend: book 1 (. # X = ^ ~ H b o h m ? e E f P D K < > v c n $ Q R S L) +
   0-9 A-F street doors, p signpost, N friendly NPC, C charge spot, Y decoy spot,
   T detonation spot, k Krasue body, t trash pile, w wave spawn, G guard statue,
   B barricade.
   ========================================================================== */
(function () {
  'use strict';
  var D = window.DCW.data;
  var C = D.chunks = {};

  /* ---------- village ---------- */
  C.village_gate_start = { theme: 'village', rows: [
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '..............ooo...............',
    '.............=====..............',
    '................................',
    '..P..n.....n.......n.....n......',
    '################################',
    '################################'] };

  /* ---------- ruins ---------- */
  C.ruins_start = { theme: 'ruins', rows: [
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
    '..........ooo...........',
    '.........=====..........',
    '........................',
    '..P.............e.......',
    '########################',
    '########################'] };
  C.ruins_a = { theme: 'ruins', rows: [
    '................................',
    '................................',
    '................................',
    '..............ooo...............',
    '........................e.......',
    '..........e............XXX......',
    '.........XXX...........XXX......',
    '.....===.XXX......===..XXX......',
    '.........XXX...........XXX......',
    '.........XXX....e......XXX......',
    '################################',
    '################################'] };
  C.ruins_b = { theme: 'ruins', rows: [
    '................................',
    '................................',
    '................................',
    '................................',
    '................f...............',
    '................................',
    '..........ooooo.................',
    '................................',
    '................................',
    '..c....e...........e............',
    '###########.bb.#################',
    '###########....#################'] };
  C.ruins_c = { theme: 'ruins', rows: [
    '................................',
    '................................',
    '......................X.........',
    '......................X.........',
    '......................X.........',
    '......................X.........',
    '.............S........X.........',
    '............====......L.........',
    '......................L.........',
    '...e..................L...e..$..',
    '################################',
    '################################'] };
  C.ruins_d = { theme: 'ruins', rows: [
    '............................',
    '............................',
    '............................',
    '............................',
    '............oooo............',
    '..............E.............',
    '............XXXX............',
    '.........XXXXXXXXXX.........',
    '......XXXXXXXXXXXXXXXX......',
    '...XXXXXXXXXXXXXXXXXXXXXX.e.',
    '############################',
    '############################'] };
  C.ruins_e = { theme: 'ruins', rows: [
    '................................',
    '..........ooo...................',
    '........H...$...................',
    '........HXXXXXX.................',
    '........H.......................',
    '........H...........f...........',
    '........H.......................',
    '........H.......................',
    '........H.......................',
    '..t.....H...e......t....e.......',
    '################################',
    '################################'] };
  C.ruins_f = { theme: 'ruins', rows: [
    '................................',
    '................................',
    '..............f.................',
    '................................',
    '............ooooo...............',
    '..........=========.............',
    '................................',
    '................................',
    '....=====...........=====.......',
    '..e.......E..........e.....e....',
    '################################',
    '################################'] };
  C.ruins_g = { theme: 'ruins', rows: [
    '............................',
    '............................',
    '............................',
    '............................',
    '............................',
    '.........ooooo..............',
    '............................',
    '........===..===............',
    '............................',
    '..e.....^^^^^^^^......e.....',
    '############################',
    '############################'
  ] };
  C.ruins_h = { theme: 'ruins', rows: [
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '..............ooo...............',
    '.........e...........e..........',
    '.........XX..........XX.........',
    '.........XX.....E....XX.....h...',
    '################################',
    '################################'] };
  C.ruins_i = { theme: 'ruins', rows: [
    '................................',
    '................................',
    '................................',
    '...............f................',
    '................................',
    '............oooooooo............',
    '...........X========X...........',
    '..........XX........XX..........',
    '.........XXX........XXX.........',
    '..c.....XXXX........XXXX....e...',
    '############........############',
    '############........############'] };
  C.ruins_end = { theme: 'ruins', rows: [
    '....................',
    '....................',
    '....................',
    '....................',
    '....................',
    '....................',
    '....................',
    '..o.o.o.............',
    '....................',
    '.........D..........',
    '####################',
    '####################'] };
  C.arena_terror = { theme: 'ruins', rows: [
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
  C.ruins_bodies = { theme: 'ruins', rows: [
    '....................................',
    '....................................',
    '....................................',
    '....................................',
    '....................................',
    '....................................',
    '.........ooo..........ooo...........',
    '........=====........=====..........',
    '....................................',
    '..n..$.......n..$........n..$...e...',
    '####################################',
    '####################################'] };
  C.ruins_barricade = { theme: 'ruins', rows: [
    'XXXXXXXXXXXXXXXXXXXX',
    'X..................X',
    'X..................X',
    'X..................X',
    'X..........w.......X',
    'X.......=======....X',
    'X..................X',
    'X...............w..X',
    'X..............==..X',
    'X.B..P....t......w.X',
    '####################',
    '####################'] };
  C.divider_end = { theme: 'ruins', rows: [
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '.............e..................',
    '..........XXXXXXX...............',
    '.........XXXXXXXXX..............',
    '........XXXXXXXXXXX.............',
    '..n....XXXXXXXXXXXXX....E...D...',
    '################################',
    '################################'] };
  C.park_end = { theme: 'ruins', rows: [
    '............................',
    '............................',
    '............................',
    '............................',
    '............................',
    '............................',
    '.............?..............',
    '...........=====............',
    '............................',
    '..e......h.........D........',
    '############################',
    '############################'] };
  C.park_a = { theme: 'ruins', rows: [
    '................................',
    '................................',
    '................................',
    '......ooo............ooo........',
    '.....=====..........=====.......',
    '................................',
    '................................',
    '...........======...............',
    '................................',
    '..e.....t........E.......t..e...',
    '################################',
    '################################'] };

  /* ---------- circus ---------- */
  C.circus_start = { theme: 'circus', rows: [
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
    '...........ooo..........',
    '........................',
    '..P....n................',
    '########################',
    '########################'] };
  C.circus_a = { theme: 'circus', rows: [
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '.............ooo................',
    '............=====...............',
    '................................',
    '.....e.................e........',
    '###############...##############',
    '###############...##############'] };
  C.circus_b = { theme: 'circus', rows: [
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '.............ooo................',
    '................................',
    '..............b.................',
    '.......b......b.......b....e....',
    '################################',
    '################################'] };
  C.circus_c = { theme: 'circus', rows: [
    '............................',
    '............................',
    '............................',
    '............................',
    '............................',
    '............................',
    '............................',
    '............ooo.e...........',
    '..........XXXXXXX...........',
    '.......XXXXXXXXXXXXX........',
    '############################',
    '############################'] };
  C.circus_d = { theme: 'circus', rows: [
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '..............oooooo............',
    '................................',
    '..............XXXXXX............',
    '..............XXXXXX............',
    '..e.........b.XXXXXX.....e......',
    '################################',
    '################################'] };
  C.circus_e = { theme: 'circus', rows: [
    '................................',
    '................................',
    '................................',
    '................................',
    '...............f................',
    '................................',
    '.........oo........oo...........',
    '................................',
    '................................',
    '....e..................e........',
    '##########..#########..#########',
    '##########..#########..#########'] };
  C.circus_f = { theme: 'circus', rows: [
    '............................',
    '............................',
    '............................',
    '............................',
    '............................',
    '............................',
    '..........ooooo.............',
    '............................',
    '............................',
    '.....e.....^^..........e....',
    '############################',
    '############################'] };
  C.arena_heather = { theme: 'circus', rows: [
    'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
    'X......................................X',
    'X......................................X',
    'X......................................X',
    'X......................................X',
    '.......................................X',
    '.......................................X',
    '......====..............====...........X',
    '.......................................X',
    '..c.......................K............X',
    '########################################',
    '########################################'] };

  /* ---------- basement ---------- */
  C.basement_land = { theme: 'basement', rows: [
    'XXXXXXXXXXXXXXXXXXXXXXXX',
    'XXXX........XXXXXXXXXXXX',
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
    '.........ooo............',
    '........................',
    '..P.....n...............',
    '########################',
    '########################'] };
  C.basement_lion_pit = { theme: 'basement', rows: [
    'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
    'X..........................................X',
    'X..........................................X',
    'X..........................................X',
    'X..........................................X',
    '............................................',
    '...........oo...........oo..................',
    '..........====..........====................',
    '............................................',
    '..c....e....e.....e......e.....e....e....D..',
    '############################################',
    '############################################'] };
  C.basement_wake = { theme: 'basement', rows: [
    'XXXXXXXXXXXXXXXXXXXXXXXX',
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
    '.............ooo........',
    '........................',
    '..P.....N.......n.......',
    '########################',
    '########################'] };
  C.basement_a = { theme: 'basement', rows: [
    'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
    'XXXXXX....................XXXXXX',
    '................................',
    '................................',
    '................................',
    '................................',
    '..........ooooo.................',
    '.........=======................',
    '................................',
    '..e.......................e.....',
    '##########~~~~~#################',
    '################################'] };
  C.basement_b = { theme: 'basement', rows: [
    'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '.............bbb................',
    '......bb.....b.b................',
    '..e...bb.....b$b......e.........',
    '################################',
    '################################'] };
  C.basement_c = { theme: 'basement', rows: [
    '............................',
    '...........H................',
    '...........HXXX.............',
    '...........HXXX.............',
    '...........HXXX.............',
    '...........HXXX.............',
    '...........HXXX.............',
    '...........HXXX.............',
    '...........HXXX.............',
    '..e........HXXX......e......',
    '############################',
    '############################'] };
  C.basement_d = { theme: 'basement', rows: [
    'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
    'XXXX........................XXXX',
    '................................',
    '................................',
    '................................',
    '.......oo.............oo........',
    '................................',
    '.....======.........======......',
    '................................',
    '..e...^^^^.....e....^^^^........',
    '################################',
    '################################'] };
  C.basement_cage = { theme: 'basement', rows: [
    '................................',
    '................................',
    '....................X...........',
    '......H..S..........X...........',
    '......HXXXX.........X...........',
    '......H.............X...........',
    '......H.............X...........',
    '......H.............L...........',
    '......H.............L...........',
    '..e...H.......e.....L....R....e.',
    '################################',
    '################################'] };
  C.basement_end = { theme: 'basement', rows: [
    'XXXXXXXXXXXXXXXXXXXX',
    '....................',
    '....................',
    '....................',
    '....................',
    '....................',
    '....................',
    '..o.o.o.............',
    '....................',
    '..........D.........',
    '####################',
    '####################'] };

  /* ---------- settlement ---------- */
  C.settlement_start = { theme: 'settlement', rows: [
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
    '..........ooo...........',
    '........................',
    '..P...n.................',
    '########################',
    '########################'] };
  C.settlement_a = { theme: 'settlement', rows: [
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '.....ooo.........ooo............',
    '....=====.......=====...........',
    '................................',
    '..e.....b.....e......b...e......',
    '################################',
    '################################'] };
  C.settlement_b = { theme: 'settlement', rows: [
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '............oooooo..............',
    '..............e.................',
    '............XXXXXX..............',
    '............XXXXXX..............',
    '..e.........XXXXXX......e.......',
    '################################',
    '################################'] };
  C.settlement_c = { theme: 'settlement', rows: [
    '............................',
    '............................',
    '............................',
    '............................',
    '..........f.................',
    '............................',
    '...........ooo..............',
    '............................',
    '............................',
    '....e...............e.......',
    '############...#############',
    '############...#############'] };
  C.settlement_d = { theme: 'settlement', rows: [
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '..........oooooooo..............',
    '................................',
    '.........==========.............',
    '................................',
    '..e......b.....e.....b....e.....',
    '################################',
    '################################'] };
  C.settlement_alley_end = { theme: 'settlement', rows: [
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
    '..o.o.o.................',
    '........................',
    '............D...........',
    '########################',
    '########################'] };

  /* ---------- alley ---------- */
  C.alley_start = { theme: 'alley', rows: [
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
    '..........ooo...........',
    '........................',
    '..P....t..n.............',
    '########################',
    '########################'] };
  C.alley_a = { theme: 'alley', rows: [
    '................................',
    '................................',
    '.................ooo............',
    '................................',
    '................=====...........',
    '................................',
    '................................',
    '.........====...................',
    '..XX..................XX........',
    '..XX..t....e..........XX.t...e..',
    '################################',
    '################################'] };
  C.alley_b = { theme: 'alley', rows: [
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '.......f........................',
    '..............ooo...............',
    '.............=====..............',
    '................................',
    '..e.......k..........t.....e....',
    '################################',
    '################################'] };
  C.alley_c = { theme: 'alley', rows: [
    '................................',
    '................................',
    '................................',
    '......................X.........',
    '......................X.........',
    '......................X.........',
    '.............S........X.........',
    '............====......L.........',
    '......................L.........',
    '..t.e.................L....e.$..',
    '################################',
    '################################'] };
  C.alley_d = { theme: 'alley', rows: [
    '.......XXXXXXXXXXXXXX.......',
    '.......XXXXXXXXXXXXXX.......',
    '.......XXXXXXXXXXXXXX.......',
    '.......XXXXXXXXXXXXXX.......',
    '.......XXXXXXXXXXXXXX.......',
    '............................',
    '............................',
    '.........o.o.o.o............',
    '............................',
    '..e.......e......e..........',
    '############################',
    '############################'] };
  C.alley_e = { theme: 'alley', rows: [
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '.........ooo....................',
    '................................',
    '................................',
    '......XX.......XX...............',
    '..e...XX..^^...XX....e..........',
    '################################',
    '################################'] };
  C.alley_f = { theme: 'alley', rows: [
    '................................',
    '................................',
    '................................',
    '.............ooo................',
    '...........H..k.................',
    '...........HXXXXX...............',
    '...........HXXXXX...............',
    '...........HXXXXX...............',
    '...........HXXXXX...............',
    '..e........HXXXXX......e........',
    '################################',
    '################################'] };
  C.alley_gumgum = { theme: 'alley', rows: [
    '....................................',
    '....................................',
    '....................................',
    '....................................',
    '....................................',
    '....................................',
    '............ooo.....................',
    '...........=====....................',
    '....................................',
    '..n.......k.......E.......k.........',
    '####################################',
    '####################################'] };
  C.alley_swarm = { theme: 'alley', rows: [
    '....................................',
    '....................................',
    '....................................',
    '.....f.......f.......f.......f......',
    '....................................',
    '..........f..........f..............',
    '....................................',
    '.......=====.........=====..........',
    '....................................',
    '..e.......e.......e.......e.........',
    '####################################',
    '####################################'] };
  C.arena_vincente = { theme: 'alley', rows: [
    'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
    'X......................................X',
    'X......................................X',
    'X......................................X',
    'X......................................X',
    '.......................................X',
    '.......................................X',
    '.....=====............=====............X',
    '.......................................X',
    '..c.......................K............X',
    '########################################',
    '########################################'] };
  C.alley_end = { theme: 'alley', rows: [
    '....................',
    '....................',
    '....................',
    '....................',
    '....................',
    '....................',
    '....................',
    '..o.o.o.............',
    '....................',
    '..........D.........',
    '####################',
    '####################'] };

  /* ---------- ymca ---------- */
  C.ymca_start = { theme: 'ymca', rows: [
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
    '..........ooo...........',
    '........................',
    '..P...n........h........',
    '########################',
    '########################'] };
  C.ymca_facade = { theme: 'ymca', rows: [
    'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
    'X......................................X',
    'X......................................X',
    'X......................................X',
    'X.......=====..............=====.......X',
    '.......................................X',
    '.......................................X',
    '...=====.........======.........=====..X',
    '.......................................X',
    '..c.................K..................X',
    '########################################',
    '########################################'] };

  /* ---------- school ---------- */
  C.school_start = { theme: 'school', rows: [
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
    '..........ooo...........',
    '........................',
    '..P...n.................',
    '########################',
    '########################'] };
  C.school_a = { theme: 'school', rows: [
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '........ooo..........ooo........',
    '.......=====.........=====......',
    '................................',
    '..e...b.b.......e....b.b...e....',
    '################################',
    '################################'] };
  C.school_b = { theme: 'school', rows: [
    '................................',
    '................................',
    '................................',
    '...........ooo.....ooo..........',
    '............e.......e...........',
    '.......HXXXXXXXXXXXXXXXXH.......',
    '.......H........X.......H.......',
    '.......H........X.......H.......',
    '.......H........X.......H.......',
    '..e....H........X.......H...e...',
    '################################',
    '################################'] };
  C.school_c = { theme: 'school', rows: [
    '................................',
    '................................',
    '......................X.........',
    '......................X.........',
    '......................X.........',
    '......................X.........',
    '.............S........X.........',
    '............====......L.........',
    '......................L.........',
    '..b.e.................L..h.e.$..',
    '################################',
    '################################'] };
  C.school_d = { theme: 'school', rows: [
    '............................',
    '............................',
    '............................',
    '............................',
    '............................',
    '............................',
    '........oooooo..............',
    '........======..............',
    '............................',
    '..e.................e.......',
    '#########~~~~~~#############',
    '############################'] };
  C.school_eunice = { theme: 'school', rows: [
    '....................................',
    '....................................',
    '....................................',
    '....................................',
    '....................................',
    '....................................',
    '....................ooo.............',
    '...................=====............',
    '....................................',
    '..N...N..........E..........e.......',
    '####################################',
    '####################################'] };
  C.school_end = { theme: 'school', rows: [
    '....................',
    '....................',
    '....................',
    '....................',
    '....................',
    '....................',
    '....................',
    '..o.o.o.............',
    '....................',
    '..........D.........',
    '####################',
    '####################'] };

  /* ---------- office ---------- */
  C.office_start = { theme: 'office', rows: [
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
    '..........ooo...........',
    '........................',
    '..P...n.................',
    '########################',
    '########################'] };
  C.office_shelf_a = { theme: 'office', rows: [
    '....................................',
    '....................................',
    '....................................',
    '.............ooo....................',
    '............=====...................',
    '....................................',
    '....................................',
    '.......=======......................',
    '....................................',
    '..Y.......C.............k.....e.....',
    '####################################',
    '####################################'] };
  C.office_shelf_b = { theme: 'office', rows: [
    '....................................',
    '....................................',
    '....................................',
    '....................................',
    '....................................',
    '......................ooo...........',
    '............k.......................',
    '..........==========................',
    '....................................',
    '..e.....Y...........C...............',
    '####################################',
    '####################################'] };
  C.office_shelf_c = { theme: 'office', rows: [
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '..........ooo...................',
    '.........=====..................',
    '................................',
    '..k.......Y........C.....e......',
    '################################',
    '################################'] };
  C.office_roof_end = { theme: 'office', rows: [
    '............................',
    '............................',
    '............................',
    '............................',
    '............................',
    '...............T............',
    '...........XXXXXXXX.........',
    '..........XXXXXXXXXX........',
    '.........XXXXXXXXXXXX.......',
    '..n.....XXXXXXXXXXXXXX......',
    '############################',
    '############################'] };

  /* ---------- nest ---------- */
  C.nest_start = { theme: 'nest', rows: [
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
    '..........hh............',
    '........................',
    '..P...n.................',
    '########################',
    '########################'] };
  C.nest_a = { theme: 'nest', rows: [
    '................................',
    '................................',
    '................................',
    '................................',
    '.................f..............',
    '................................',
    '...........ooo..................',
    '..........=====.................',
    '................................',
    '..e.....k..........k.......e....',
    '################################',
    '################################'] };
  C.nest_b = { theme: 'nest', rows: [
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '..............oo................',
    '............k...................',
    '.........========...............',
    '................................',
    '..e.....................e.......',
    '##########~~~~~~################',
    '################################'] };
  C.nest_c = { theme: 'nest', rows: [
    '......XXXXXXXXXXXXXXXX......',
    '......XXXXXXXXXXXXXXXX......',
    '......XXXXXXXXXXXXXXXX......',
    '......XXXXXXXXXXXXXXXX......',
    '......XXXXXXXXXXXXXXXX......',
    '............................',
    '.........f.......f..........',
    '............................',
    '............................',
    '..e.........k.........e.....',
    '############################',
    '############################'] };
  C.nest_d = { theme: 'nest', rows: [
    '................................',
    '................................',
    '......................X.........',
    '......................X.........',
    '......................X.........',
    '......................X.........',
    '.............S........X.........',
    '............====......L.........',
    '......................L.........',
    '..e...................L..k...h..',
    '################################',
    '################################'] };
  C.nest_featherfall = { theme: 'nest', rows: [
    '....................................',
    '....................................',
    '....................................',
    '....................................',
    '....................................',
    '....................................',
    '...................ooo..............',
    '..................=====.............',
    '....................................',
    '..k.......n.........E........k......',
    '####################################',
    '####################################'] };
  C.nest_burgundy_end = { theme: 'nest', rows: [
    '............................',
    '............................',
    '............................',
    '............................',
    '............................',
    '............................',
    '............................',
    '..o.o.o.....................',
    '............................',
    '..h......N.........D........',
    '############################',
    '############################'] };

  /* ---------- depot ---------- */
  C.depot_start = { theme: 'depot', rows: [
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
    '..........ooo...........',
    '........................',
    '..P...n.................',
    '########################',
    '########################'] };
  C.depot_a = { theme: 'depot', rows: [
    '....................................',
    '....................................',
    '....................................',
    '....................................',
    '....................................',
    '....................................',
    '.............ooo....................',
    '............=====...................',
    '....................................',
    '..C.....G.....Y.......G.....C....e..',
    '####################################',
    '####################################'] };
  C.depot_b = { theme: 'depot', rows: [
    '....................................',
    '....................................',
    '....................................',
    '....................................',
    '....................................',
    '....................................',
    '.................ooo................',
    '................=====...............',
    '..........bb...........bb...........',
    '..e.......bb..C....G...bb..C....Y...',
    '####################################',
    '####################################'] };
  C.depot_c = { theme: 'depot', rows: [
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '...............ooo..............',
    '..........C.....................',
    '........======..................',
    '................................',
    '...Y.............G......C....e..',
    '################################',
    '################################'] };
  C.depot_d = { theme: 'depot', rows: [
    '....................................',
    '....................................',
    '...............oo...................',
    '..........H..C......................',
    '..........HXXXXXXXX.................',
    '..........H.........................',
    '..........H.........................',
    '..........H.........................',
    '..........H.........................',
    '..e..Y....H......G......C....G...e..',
    '####################################',
    '####################################'] };
  C.depot_end = { theme: 'depot', rows: [
    '............................',
    '............................',
    '............................',
    '............................',
    '............................',
    '............................',
    '............................',
    '..o.o.o.....................',
    '............................',
    '..h......n......T...........',
    '############################',
    '############################'] };

  /* ---------- escape ---------- */
  C.escape_start = { theme: 'escape', rows: [
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
    '..........hh............',
    '........................',
    '..P...n.................',
    '########################',
    '########################'] };
  C.escape_a = { theme: 'escape', rows: [
    '................................',
    '................................',
    '................................',
    '................................',
    '..............f.................',
    '................................',
    '.........oooo...................',
    '........======..................',
    '................................',
    '..e....................e........',
    '#############...################',
    '#############...################'] };
  C.escape_b = { theme: 'escape', rows: [
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '.............f..................',
    '................................',
    '............XXXX................',
    '.........XXXXXXXXXX.............',
    '..e...XXXXXXXXXXXXXXXX...e......',
    '################################',
    '################################'] };
  C.escape_c = { theme: 'escape', rows: [
    '................................',
    '................................',
    '................................',
    '........f............f..........',
    '................................',
    '................................',
    '...........ooo..................',
    '..........=====.................',
    '................................',
    '..e...^^.............^^....e....',
    '################################',
    '################################'] };
  C.escape_d = { theme: 'escape', rows: [
    '............................',
    '............................',
    '............................',
    '............................',
    '............................',
    '............................',
    '............................',
    '............................',
    '........bb........bb........',
    '..e.....bb..m.....bb...e....',
    '############################',
    '############################'] };
  C.escape_e = { theme: 'escape', rows: [
    '................................',
    '................................',
    '................................',
    '................................',
    '................f...............',
    '................................',
    '...........ooo..................',
    '................................',
    '.......===..===.................',
    '..e.............................',
    '######~~~~~~~~~~################',
    '################################'
  ] };
  C.escape_f = { theme: 'escape', rows: [
    '................................',
    '................................',
    '................................',
    '....................f...........',
    '................................',
    '.....====......====......====...',
    '................................',
    '................................',
    '.........=====..................',
    '..e............E........e.......',
    '################################',
    '################################'] };
  C.escape_g = { theme: 'escape', rows: [
    '............................',
    '............................',
    '................X...........',
    '................X...........',
    '................X...........',
    '................X...........',
    '.........S......X...........',
    '........====....L...........',
    '................L...........',
    '..e.............L..h..e.....',
    '############################',
    '############################'] };
  C.escape_h = { theme: 'escape', rows: [
    '................................',
    '................................',
    '................................',
    '................................',
    '.........f.........f............',
    '................................',
    '......oo..............oo........',
    '................................',
    '................................',
    '..e.....m...............e.......',
    '#########...#######...##########',
    '#########...#######...##########'] };
  C.escape_bautista = { theme: 'escape', rows: [
    '....................................',
    '....................................',
    '....................................',
    '....................................',
    '....................................',
    '....................................',
    '..............hhh...................',
    '.............=====..................',
    '....................................',
    '..c....N.......m.......m......h.....',
    '####################################',
    '####################################'] };
  C.escape_end = { theme: 'escape', rows: [
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
    '..o.o.o.................',
    '........................',
    '..............D.........',
    '########################',
    '########################'] };

  /* ---------- restroom ---------- */
  C.restroom_start = { theme: 'restroom', rows: [
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
    '..........ooo...........',
    '........................',
    '..P...n.................',
    '########################',
    '########################'] };
  C.restroom_a = { theme: 'restroom', rows: [
    '............................',
    '............................',
    '............................',
    '............................',
    '............................',
    '............................',
    '......o...o...o.............',
    '............................',
    '........X...X...X...........',
    '..e.....X.e.X.e.X....e......',
    '############################',
    '############################'] };
  C.restroom_b = { theme: 'restroom', rows: [
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '...........ooo..................',
    '...........===..................',
    '.....====......====.............',
    '................................',
    '..e..................e..........',
    '#####~~~~~~~~~~~~~~~~###########',
    '################################'
  ] };
  C.restroom_c = { theme: 'restroom', rows: [
    '............................',
    '............................',
    '..................X.........',
    '..................X.........',
    '..................X.........',
    '..................X.........',
    '..........S.......X.........',
    '.........====.....L.........',
    '..................L.........',
    '..e...............L..?.$....',
    '############################',
    '############################'] };
  C.restroom_end = { theme: 'restroom', rows: [
    '....................',
    '....................',
    '....................',
    '....................',
    '....................',
    '....................',
    '....................',
    '..o.o.o.............',
    '....................',
    '..n.......D.........',
    '####################',
    '####################'] };

  /* ---------- temple ---------- */
  C.temple_start = { theme: 'temple', rows: [
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
    '..........ooo...........',
    '........................',
    '..P...n.................',
    '########################',
    '########################'] };
  C.temple_a = { theme: 'temple', rows: [
    '................................',
    '............ooo.................',
    '.........H......................',
    '.........HXXXXXXXX..............',
    '.........H........H.............',
    '.........H........H.............',
    '.........HXX......H.............',
    '.........HXX......H.............',
    '.........HXX......H.............',
    '..e......HXX...e..H.....e.......',
    '################################',
    '################################'] };
  C.temple_b = { theme: 'temple', rows: [
    '................................',
    '................................',
    '......................X.........',
    '......................X.........',
    '......................X.........',
    '......................X.........',
    '.............S........X.........',
    '............====......L.........',
    '......................L.........',
    '..e...................L..$.$.e..',
    '################################',
    '################################'] };
  C.temple_c = { theme: 'temple', rows: [
    '............................',
    '............................',
    '............................',
    '............................',
    '............ooo.............',
    '............................',
    '...........====.............',
    '.....===..........===.......',
    '............................',
    '..e...^^^^^^^^^^^^^^..e.....',
    '############################',
    '############################'
  ] };
  C.temple_d = { theme: 'temple', rows: [
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '..............E.................',
    '............XXXXX...............',
    '..........XXXXXXXXX.............',
    '........XXXXXXXXXXXXX...........',
    '..n...XXXXXXXXXXXXXXXXX...e.....',
    '################################',
    '################################'] };
  C.temple_end = { theme: 'temple', rows: [
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
    '........................',
    '..........?.............',
    '........=====...........',
    '........................',
    '..h..........D..........',
    '########################',
    '########################'] };

  /* vertical layouts (levels reference them by id through level.layout) */
  D.layouts = {
    drop_collapse: [
      'XXXXXXXXXXXXXXXXXXXXXXXX',
      'X......................X',
      'X......................X',
      'X.P....o.o.o...........X',
      'X################...###X',
      'X......................X',
      'X......................X',
      'X......................X',
      'X......................X',
      'X....e.....e.....c.....X',
      'X...###################X',
      'X......................X',
      'X......................X',
      'X......................X',
      'X......................X',
      'X.....bb..e.....e......X',
      'X##################...#X',
      'X......................X',
      'X......................X',
      'X......................X',
      'X......................X',
      'X..f.......e......c....X',
      'X###===################X',
      'X......................X',
      'X......................X',
      'X......................X',
      'X......................X',
      'X.......e......h.......X',
      'X#########....#########X',
      'X......................X',
      'X......................X',
      'X......................X',
      'X......................X',
      'X....e...bb..bb.....e..X',
      'X...###################X',
      'X......................X',
      'X......................X',
      'X......................X',
      'X......................X',
      'X....e..f.......c......X',
      'X##################...#X',
      'X......................X',
      'X......................X',
      'X......................X',
      'X......................X',
      'X..e......e........m...X',
      'X####...###############X',
      'X......................X',
      'X......................X',
      'X......................X',
      'X......................X',
      'X......e.....e..e......X',
      'X#################....#X',
      'X......................X',
      'X......................X',
      'X......................X',
      'X......................X',
      'X..D.....h.....o.o.o...X',
      'X######################X',
      'X######################X'],
    climb_admin: [
      'XXXXXXXXXXXXXXXXXXXXXXXX',
      'X......o.o.o...........X',
      'X..........D...........X',
      'X....XXXXXXXXXXXX......X',
      'X......................X',
      'X......................X',
      'X.................====.X',
      'X......................X',
      'X.............e........X',
      'X............====......X',
      'X...........f..........X',
      'X......................X',
      'X.......====...........X',
      'X......................X',
      'X..o...................X',
      'X..====................X',
      'X......................X',
      'X........e.............X',
      'X.......XXXX...........X',
      'X.......XXXX...........X',
      'X..............c.......X',
      'X............====......X',
      'X...........f..........X',
      'X......................X',
      'X.................====.X',
      'X......................X',
      'X..............e.......X',
      'X.............====.....X',
      'X......................X',
      'X........o.............X',
      'X........====..........X',
      'X......................X',
      'X......................X',
      'X...XXXX...............X',
      'X...XXXX....f..........X',
      'X.........e............X',
      'X........====..........X',
      'X......................X',
      'X...............c......X',
      'X.............====.....X',
      'X......................X',
      'X......................X',
      'X..................===.X',
      'X......................X',
      'X..............oe......X',
      'X..............XXXX....X',
      'X...........f..XXXX....X',
      'X......................X',
      'X.........====.........X',
      'X......................X',
      'X......................X',
      'X....====..............X',
      'X......................X',
      'X......................X',
      'X.........v............X',
      'X......................X',
      'X................c.....X',
      'X..............====....X',
      'X......................X',
      'X..P.....c.......h.....X',
      'X######################X',
      'X######################X']
  };

  /* street rows (areas reference them by id) */
  D.streetRows = {
    village: [
      'X...................................................................................................',
      'X...................................................................................................',
      'X...................................................................................................',
      'X...................................................................................................',
      'X...................................................................................................',
      'X...................................................................................................',
      'X.............................................................oooo..................................',
      'X............................................................======.................................',
      'X...................................................................................................',
      'X..P....N.......1.........2.......N.........3...........p...........................N.......t.......',
      '####################################################################################################',
      '####################################################################################################'],
    ruins_w: [
      '............................................................................................................................................',
      '............................................................................................................................................',
      '............................................................................................................................................',
      '............................................................................................................................................',
      '............................................................................................................................................',
      '............................................................................................................................................',
      '...............................ooo.................................ooo...................................ooo................................',
      '..............................=====...............................====..................................=====.................====..........',
      '.................................................X..........................................................................................',
      '..........p...........1...........XX....t.......XXX.......2.................t.......XX......3.................XX......t.....................',
      '############################################################################################################################################',
      '############################################################################################################################################'],
    circus_park: [
      '...........................................................................................................................................X',
      '...........................................................................................................................................X',
      '...........................................................................................................................................X',
      '...........................................................................................................................................X',
      '...........................................................................................................................................X',
      '...........................................................................................................................................X',
      '...............................................ooo...................................ooo...................................................X',
      '..............................................====..................................====......................====.........................X',
      '...........................................................................................................................................X',
      '........p.........1...........2.........3.............4.........N...........5...............6...........7.............t.............8......X',
      '############################################################################################################################################',
      '############################################################################################################################################'],
    ruins_e: [
      '................................................................................................................................................................',
      '................................................................................................................................................................',
      '................................................................................................................................................................',
      '................................................................................................................................................................',
      '................................................................................................................................................................',
      '................................................................................................................................................................',
      '.............................ooo.............................oo....................................................................oooo.........................',
      '............................=====...........................====............................====..................................======........................',
      '.........................................................X......................................................................................................',
      '..........p.........N...........XX......1.........t.....XXX...........t.............2...............t.........XX........3...................XX....t.....N.......',
      '################################################################################################################################################################',
      '################################################################################################################################################################'],
    settlement: [
      '.............................................................................................................................................................................................X',
      '.............................................................................................................................................................................................X',
      '.............................................................................................................................................................................................X',
      '.............................................................................................................................................................................................X',
      '.............................................................................................................................................................................................X',
      '.............................................................................................................................................................................................X',
      '.................................ooo...............................................................................................................ooo.......................................X',
      '................................====.................................................................................====.........................=====......................................X',
      '.............................................................................................................................................................................................X',
      '......p.......N...........1.............2...........3.........N.......4.....N.......5...........6.......A.......B...........7...............8...............9.............t...........C......X',
      '##############################################################################################################################################################################################',
      '##############################################################################################################################################################################################'],
    admin: [
      '........................................................................................................................',
      '........................................................................................................................',
      '........................................................................................................................',
      '........................................................................................................................',
      '........................................................................................................................',
      '........................................................................................................................',
      '.........................ooo............................................................................................',
      '........................====............................................====............................................',
      '........................................................................................................................',
      '........p.........N.............1...........2...........3.........N.............4...........5...........N...............',
      '########################################################################################################################',
      '########################################################################################################################'],
    east_stairs: [
      '.........................................................................................X',
      '.........................................................................................X',
      '.........................................................................................X',
      '.........................................................................................X',
      '.........................................................................................X',
      '.........................................................................................X',
      '.........................................ooo.............................................X',
      '........................................=====............................................X',
      '.........................................................................................X',
      '........p...........XX........1...................t.........N.....XX......2..............X',
      '##########################################################################################',
      '##########################################################################################']
  };
})();
/* ==========================================================================
   WORLD: areas (the playable streets), levels, quests, objectives, events, talk
   ========================================================================== */
(function () {
  'use strict';
  var D = window.DCW.data;
  var R = D.streetRows;

  /* ---------------- areas (DESIGN 6.1). npcs[i].x = tile column of the i-th N ---------------- */
  D.areas = {
    village: {
      id: 'village', name: 'TINY VILLAGE', theme: 'village', music: 'village', musicNight: 'village_night',
      guarded: true, rows: R.village,
      doors: {
        '1': { kind: 'inn', target: 'pug', label: 'THE BELLY-RUBBED PUG', sprite: 'door_inn' },
        '2': { kind: 'shop', target: 'lucky', label: "LUCKY'S GENERAL GOODS", sprite: 'door_shop' },
        '3': { kind: 'cinema', target: 'notice_board', label: 'NOTICE BOARD', sprite: 'sign' }
      },
      edges: { left: null, right: { area: 'ruins_w', entry: 'left' } },
      npcs: [
        { id: 'mordecai_tour', x: 8, sprite: 'mordecai', phase: 'day', showIf: 'toured', hideIf: 'lemurs_done' },
        { id: 'town_crier', x: 34, sprite: 'citizen_human_walk', phase: 'day' },
        { id: 'gate_guard', x: 84, sprite: 'guard_walk', phase: 'day' }
      ],
      enemies: { day: [], night: [['street_urchin', 3], ['incubus', 1]] },
      density: { day: 0, night: 0.5 },
      citizens: ['citizen_human', 'citizen_human', 'chickadee'],
      signpost: true, signpostText: "THE ROCK HUMS. ESCAPE PLAN: STAIRS 6 KM EAST. MEDIUM SKYFOWL SETTLEMENT 34 KM EAST. SAFE ROOM: THE BELLY-RUBBED PUG. EVERYTHING ELSE: MONSTERS."
    },

    ruins_w: {
      id: 'ruins_w', name: 'THE WEST RUINS', theme: 'ruins', music: 'ruins', musicNight: 'ruins_night',
      guarded: false, rows: R.ruins_w,
      doors: {
        '1': { kind: 'level', target: 'a1_lemurs', label: 'COLLAPSED STREET', sprite: 'manhole' },
        '2': { kind: 'level', target: 'a1_bodies', label: 'DEAD CRAWLER ROW', sprite: 'alley_mouth',
               needs: 'lemurs_done', lockText: "SOMETHING IN THERE SMELLS DEAD. REALLY FUCKING DEAD. FINISH WITH THE COLLAPSED STREET FIRST." },
        '3': { kind: 'level', target: 'x_temple', label: 'A CORRUPT TEMPLE', sprite: 'door_wood', showIf: 'toured' }
      },
      edges: { left: { area: 'village', entry: 'right' }, right: { area: 'circus_park', entry: 'left' } },
      npcs: [],
      enemies: { day: [['lemur', 3], ['brain_boiler', 2]], night: [['street_urchin', 3], ['lemur', 1], ['mold_lion', 1]] },
      density: { day: 0.4, night: 0.7 },
      citizens: [], signpost: true, signpostText: "THE ROCK HUMS. WEST RUINS MAPPED. A CIRCUS TO THE EAST. A CORRUPT TEMPLE HERE. NO SAFE ROOMS, NO SYMPATHY, NO REFUNDS."
    },

    circus_park: {
      id: 'circus_park', name: "GRIMALDI'S PARK", theme: 'circus', music: 'circus', musicNight: 'circus',
      guarded: false, rows: R.circus_park,
      doors: {
        '1': { kind: 'level', target: 'a1_collapse', label: 'ABANDONED TENEMENT', sprite: 'door_wood',
               needs: 'bodies_done', lockText: "A GOOD SPOT TO SPY ON THE CIRCUS. CHECK THOSE DEAD CRAWLERS FIRST. DEAD PEOPLE GIVE THE BEST ADVICE.", hideIf: 'circus_gone' },
        '2': { kind: 'level', target: 'a1_lions', label: 'HOLE IN THE STREET', sprite: 'manhole', showIf: 'collapse_done', hideIf: 'lions_done' },
        '3': { kind: 'level', target: 'a1_solo', label: "SIGNET'S LAIR", sprite: 'manhole', showIf: 'lions_done', hideIf: 'solo_done' },
        '4': { kind: 'level', target: 'a1_heather', label: 'HUNTING GROUND', sprite: 'gate', showIf: 'solo_done', hideIf: 'heather_done' },
        '5': { kind: 'level', target: 'a1_bigtop', label: 'THE BIG TOP', sprite: 'tent_flap', showIf: 'has_ticket', hideIf: 'circus_gone',
               needsItem: 'big_top_ticket', phase: 'night', lockText: "THE BIG TOP OPENS AT SUNDOWN. COME BACK AFTER DARK. AT THE PUG YOU CAN WAIT FOR NIGHT. AND DRINK. MOSTLY DRINK." },
        '6': { kind: 'level', target: 'a1_barricade', label: 'BACK TO DONUT', sprite: 'alley_mouth', showIf: 'bigtop_done', hideIf: 'circus_gone' },
        '7': { kind: 'stairs', label: 'STAIRWELL TO FLOOR 4', sprite: 'stairs_down', showIf: 'circus_gone' },
        '8': { kind: 'area', target: 'ruins_e', entry: 'left', label: 'EAST ROAD', sprite: 'gate',
               needs: 'circus_gone', lockText: "CLOWN SCOUTS WATCH THE EAST ROAD. NOBODY LEAVES WHILE THE SHOW IS STILL RUNNING. THE CLOWNS WERE VERY FUCKING CLEAR ABOUT THAT." }
      },
      edges: { left: { area: 'ruins_w', entry: 'right' }, right: null },
      npcs: [
        { id: 'signet_park', x: 64, sprite: 'signet', phase: 'night', showIf: 'met_signet', hideIf: 'circus_gone' }
      ],
      enemies: { day: [['lemur', 3], ['fat_clown', 2]], night: [['fat_clown', 2], ['stilt_clown', 1], ['street_urchin', 2], ['lemur', 2]] },
      density: { day: 0.5, night: 0.8 },
      enemiesAfter: { flag: 'circus_gone', day: [['brain_boiler', 2]], night: [['street_urchin', 3]] },
      citizens: [], signpost: true, signpostText: "THE ROCK HUMS. GRIMALDI'S PARK MAPPED. THE BIG TOP SITS ON TOP OF SOMETHING. THE MAP CAN'T SAY WHAT YET. THE MAP IS SCARED SHITLESS."
    },

    ruins_e: {
      id: 'ruins_e', name: 'THE EAST ROAD', theme: 'ruins', music: 'ruins', musicNight: 'ruins_night',
      guarded: false, rows: R.ruins_e,
      doors: {
        '1': { kind: 'level', target: 'x_restroom', label: 'RESTROOM', sprite: 'door_wood' },
        '2': { kind: 'level', target: 'a2_divider', label: 'THE Y', sprite: 'door_wood', showIf: 'met_quill',
               phase: 'night', lockText: "A DEAD BOSS LIES OUT THERE. THE ELVES ONLY COME TO IT AFTER DARK. REST AT THE NARWHAL AND WAIT FOR NIGHT. THEN GO GET AMBUSHED." },
        '3': { kind: 'level', target: 'a2_dispenser', label: 'THE BREATHING BLOCK', sprite: 'alley_mouth', showIf: 'settled' }
      },
      edges: { left: { area: 'circus_park', entry: 'right' }, right: { area: 'settlement', entry: 'left' } },
      npcs: [
        { id: 'lucia', x: 20, sprite: 'lucia', showIf: 'circus_gone', hideIf: 'show_done' },
        { id: 'gumgum_gate', x: 152, sprite: 'gumgum', showIf: 'quest_sw', hideIf: 'mongo_done' }
      ],
      enemies: { day: [['brain_boiler', 3], ['lemur', 2], ['giraffe', 1]], night: [['street_urchin', 3], ['incubus', 1], ['berserker', 1]] },
      density: { day: 0.5, night: 0.8 },
      citizens: [], signpost: true, signpostText: "THE ROCK HUMS. EAST ROAD MAPPED. A NEIGHBORHOOD BOSS AT THE OLD Y. A RESTROOM. THE SETTLEMENT GATES TO THE EAST. A LOT OF BLOOD IN BETWEEN."
    },

    settlement: {
      id: 'settlement', name: 'MEDIUM SKYFOWL SETTLEMENT', theme: 'settlement', music: 'settlement', musicNight: 'market',
      guarded: true, rows: R.settlement,
      doors: {
        '1': { kind: 'inn', target: 'narwhal', label: 'THE ONE-EYED NARWHAL', sprite: 'door_inn' },
        '2': { kind: 'shop', target: 'edge_dancer', label: "LUCKY'S GENERAL GOODS", sprite: 'door_shop' },
        '3': { kind: 'shop', target: 'talon', label: "TALON STRONG'S OUTFITTERS", sprite: 'door_shop' },
        '4': { kind: 'club', target: 'desperado', label: 'THE PUB', sprite: 'door_pub' },
        '5': { kind: 'shop', target: 'pustule', label: 'SILK ROAD MARKET', sprite: 'tent_flap',
               needs: 'met_pustule', lockText: "MEMBERS AND FRIENDS ONLY. MORDECAI KNOWS SOMEBODY IN HERE. SHE SELLS DYNAMITE. SHE OOZES." },
        '6': { kind: 'level', target: 'a2_mongo', label: 'DARK ALLEY', sprite: 'alley_mouth', showIf: 'mongo_bolted', hideIf: 'mongo_done' },
        'A': { kind: 'level', target: 'a2_alley', label: "GUMGUM'S ALLEY", sprite: 'alley_mouth', showIf: 'mongo_done', hideIf: 'vincente_dead' },
        'B': { kind: 'cinema', target: 'recap', label: 'THE BIG SCREEN', sprite: 'sign', showIf: 'settled' },
        '7': { kind: 'level', target: 'a2_danger_zone', label: 'TRAILER LOT', sprite: 'trailer', showIf: 'divider_done' },
        '8': { kind: 'level', target: 'a2_apito', label: 'APITO EDUCATION CENTER', sprite: 'door_school', showIf: 'show_done',
               phase: 'day', lockText: "CLOSED FOR THE NIGHT. EVEN CULTS KEEP OFFICE HOURS. COME BACK IN THE MORNING AND KICK THE DOOR IN." },
        '9': { kind: 'level', target: 'a2_alley_night', label: 'BACK ALLEY', sprite: 'alley_mouth', showIf: 'katia_joined',
               phase: 'night', lockText: "JUST AN ALLEY BY DAY. A PLACE TO PISS. AT NIGHT THE SHADOW LEAKS COME OUT. COME BACK AFTER DARK." },
        'C': { kind: 'area', target: 'admin', entry: 'left', label: 'ADMINISTRATIVE DISTRICT', sprite: 'gate',
               needs: 'has_pass', lockText: "SKYFOWL BUSINESS ONLY. THE GUARD WANTS A GATE PASS SIGNED BY THE MAGISTRATE. HE IS STARING AT YOUR BOXERS LIKE THEY OWE HIM MONEY." }
      },
      edges: { left: { area: 'ruins_e', entry: 'right' }, right: null },
      npcs: [
        { id: 'gumgum', x: 14, sprite: 'gumgum', showIf: 'gumgum_asked', hideIf: 'dispenser_done' },
        { id: 'hekla_sq', x: 62, sprite: 'hekla', showIf: 'show_done', hideIf: 'quill_dead' },
        { id: 'gossip', x: 76, sprite: 'chickadee_walk', phase: 'day' }
      ],
      enemies: { day: [], night: [['street_urchin', 2], ['incubus', 2]] },
      density: { day: 0, night: 0.5 },
      citizens: ['citizen_skyfowl', 'citizen_skyfowl', 'chickadee', 'citizen_human'],
      signpost: true, signpostText: "THE ROCK HUMS. SETTLEMENT MAPPED. ONE INN, FIVE GENERAL STORES, ONE PUB WITH A RED DOOR IN THE BACK. BEHIND THE RED DOOR: SIN."
    },

    admin: {
      id: 'admin', name: 'ADMINISTRATIVE DISTRICT', theme: 'admin', music: 'settlement', musicNight: 'dark',
      guarded: true, rows: R.admin,
      doors: {
        '1': { kind: 'level', target: 'a3_climb', label: 'MUNICIPAL BUILDING', sprite: 'door_admin', showIf: 'mongo_big', hideIf: 'quill_dead',
               phase: 'night', lockText: "MISS QUILL IS AT HER DESK ALL DAY. THE MAGISTRATE ONLY COMES OUT AFTER DARK. SO DO YOU. SO DO THE FLYING HEADS." },
        '2': { kind: 'level', target: 'a3_plant', label: "QUILL'S WINDOW", sprite: 'door_admin', showIf: 'climb_done', hideIf: 'quill_dead' },
        '3': { kind: 'level', target: 'a3_nest', label: 'THE WRECKAGE', sprite: 'manhole', showIf: 'quill_dead', hideIf: 'nest_done' },
        '4': { kind: 'level', target: 'a3_depot', label: 'GUARD DEPOT', sprite: 'gate', showIf: 'nest_done',
               phase: 'night', lockText: "THE SWORDSMEN ARE ON DUTY. AFTER DARK THEY SIT IN THE DEPOT IN STASIS. THAT IS WHEN YOU SNEAK IN WITH AN ARMFUL OF DYNAMITE." },
        '5': { kind: 'level', target: 'a3_escape', label: 'RUN!', sprite: 'gate', showIf: 'glass_broken', hideIf: 'escaped' }
      },
      edges: { left: { area: 'settlement', entry: 'right' }, right: { area: 'east_stairs', entry: 'left' } },
      npcs: [
        { id: 'burgundy', x: 18, sprite: 'burgundy', phase: 'day', showIf: 'met_quill', hideIf: 'quill_dead' },
        { id: 'bautista', x: 66, sprite: 'bautista', showIf: 'met_bautista' },
        { id: 'clerk', x: 104, sprite: 'citizen_skyfowl_walk', phase: 'day' }
      ],
      enemies: { day: [], night: [['krasue', 1], ['shadow_leak', 2], ['city_elf', 1]] },
      density: { day: 0, night: 0.5 },
      citizens: ['citizen_skyfowl', 'citizen_skyfowl', 'chickadee'],
      signpost: true, signpostText: "THE ROCK HUMS. ADMINISTRATIVE DISTRICT MAPPED. MUNICIPAL BUILDING. GUARD DEPOT. A LOT OF EMPTY OFFICES FULL OF BIRD BULLSHIT."
    },

    east_stairs: {
      id: 'east_stairs', name: 'THE EASTERN STAIRWELL', theme: 'ruins', music: 'ruins', musicNight: 'ruins_night',
      guarded: false, rows: R.east_stairs,
      doors: {
        '1': { kind: 'level', target: 'x_park', label: 'OVERGROWN PARK', sprite: 'gate', phase: 'night',
               lockText: "IT IS JUST A PARK BY DAY. A SIGN SAYS CLOSED AT DUSK. COME BACK AFTER DARK. THAT IS WHEN THE GOOD SHIT COMES OUT." },
        '2': { kind: 'npc', target: 'sealed_stairs', label: 'EASTERN STAIRWELL', sprite: 'stairs_down' }
      },
      edges: { left: { area: 'admin', entry: 'right' }, right: null },
      npcs: [
        { id: 'old_crawler', x: 60, sprite: 'citizen_human_walk' }
      ],
      enemies: { day: [['brain_boiler', 2], ['giraffe', 1], ['lemur', 2]], night: [['shadow_leak', 3], ['berserker', 1], ['street_urchin', 2]] },
      density: { day: 0.5, night: 0.8 },
      citizens: [], signpost: true, signpostText: "THE ROCK HUMS. EASTERN STAIRWELL FOUND. STATUS: SEALED. CONDITION FOR OPENING: CLASSIFIED. AND DRAMATIC. AND PROBABLY EXPLOSIVE."
    }
  };

  /* ---------------- levels (DESIGN 6.2 + lead notes) ---------------- */
  var L = D.levels = {};
  function lv(id, o) { o.id = id; L[id] = o; return o; }

  var RUINS = ['ruins_a', 'ruins_b', 'ruins_c', 'ruins_d', 'ruins_e', 'ruins_f', 'ruins_g', 'ruins_h', 'ruins_i'];
  var RUINS_DARK = ['ruins_a', 'ruins_b', 'ruins_d', 'ruins_f', 'ruins_h', 'ruins_i'];
  var CIRCUS = ['circus_a', 'circus_b', 'circus_c', 'circus_d', 'circus_e', 'circus_f'];
  var BASEMENT = ['basement_a', 'basement_b', 'basement_c', 'basement_d'];
  var SETTLE = ['settlement_a', 'settlement_b', 'settlement_c', 'settlement_d'];
  var ALLEY = ['alley_a', 'alley_b', 'alley_c', 'alley_d', 'alley_e', 'alley_f'];
  var SCHOOL = ['school_a', 'school_b', 'school_c', 'school_d'];
  var NEST = ['nest_a', 'nest_b', 'nest_c', 'nest_d'];
  var ESCAPE = ['escape_a', 'escape_b', 'escape_c', 'escape_d', 'escape_e', 'escape_f', 'escape_g', 'escape_h'];

  /* ======================= ACT 1: THE CIRCUS ======================= */
  lv('a1_lemurs', { name: 'COLLAPSED STREET', act: 1, kind: 'side', theme: 'ruins', music: 'ruins', bossMusic: 'boss', hours: 3,
    chunks: { start: 'village_gate_start', pool: RUINS, count: 4, end: 'arena_terror' },
    enemies: [['lemur', 5], ['fat_clown', 2]], elite: [['stilt_clown', 1]], flyers: [['brain_boiler', 1]],
    boss: 'terror_big',
    intro: ["WELCOME TO THE RUINS OF THE OVER CITY! THE SKY IS FAKE, THE SUN IS RED AND THE STREETS SMELL LIKE SULFUR, SMOKE AND SOMEBODY'S BOWELS.",
      "SOMETHING ON THOSE ROOFTOPS IS WATCHING YOU. IT HAS A KNIFE. IT HAS SEVERAL KNIVES. IT IS FUCKING ADORABLE AND IT WANTS YOUR KIDNEYS."],
    signs: [
      "BOMB THROWS YOUR SELECTED EXPLOSIVE. UP + BOMB SWAPS TYPES. YOU START WITH JUGS O'BOOM AND SMOKE BOMBS. THE FIRE STAYS LIT. SO DO THE LEMURS.",
      "DOWN + ATTACK KICKS. IN THE AIR IT STOMPS. BARE FEET, FULL FORCE. SOMEWHERE A SYSTEM AI JUST LEANED IN VERY CLOSE TO THE SCREEN.",
      "LEMURS PERCH HIGH AND THROW KNIVES. DONUT'S EARS CAN HEAR THE LITTLE SHITS BREATHING. WATCH FOR THE PIP.",
      "SPECIAL WHEN THE METER IS FULL: CARL CASTS FEAR, DONUT FIRES MISSILES. THE PLAYBOOK IS SHORT. FOR NOW. IT GETS STUPIDER."
    ],
    reward: { box: 'silver', xp: 20, gold: 20 },
    sets: ['lemurs_done'], quest: { start: 'show_must_go_on' },
    outro: 'lemurs_after', thenArea: 'village', thenEntry: 'right' });

  lv('a1_bodies', { name: 'DEAD CRAWLER ROW', act: 1, kind: 'side', theme: 'ruins', music: 'ruins', hours: 3,
    chunks: { start: 'ruins_start', pool: RUINS, count: 4, end: 'ruins_end', insert: ['ruins_bodies'] },
    enemies: [['lemur', 4], ['fat_clown', 2], ['mold_lion', 1]], elite: [['stilt_clown', 1]], flyers: [['brain_boiler', 1]],
    intro: ["A PARTY OF CRAWLERS CAME THIS WAY YESTERDAY. THEY ARE STILL HERE. MOSTLY. SOME OF THEM ARE OVER THERE. AND THERE. LOOT RESPONSIBLY."],
    signs: [
      "GRACE BAUTISTA 3. LEVEL 12. A TATTOO OF A LITTLE ELVEN SWORD. SOMEBODY SAW THOSE MOVIES TWICE IN THE THEATER. THE CLOWNS DID NOT LEAVE MUCH ELSE.",
      "NICA. LEVEL 11. TWO SILVER RINGS STILL ON HER FINGERS. THE CLOWNS DID NOT WANT THEM. THE CLOWNS WANTED EVERYTHING ELSE. THEY TOOK IT.",
      "LEA. LEVEL 13. HER LAST WORDS ARE CARVED INTO THE DOOR FRAME: DON'T GO TO THE FUCKING CIRCUS. SHE UNDERLINED FUCKING. TWICE."
    ],
    reward: { box: 'silver', xp: 25, gold: 25 },
    sets: ['bodies_done'], gives: [{ gear: 'nica_rings' }, { gear: 'grace_anklet' }],
    outro: 'bodies_after', thenArea: 'circus_park', thenEntry: 'left' });

  lv('a1_collapse', { name: 'THE TENEMENT COMES DOWN', act: 1, kind: 'drop', theme: 'ruins', night: true, music: 'climb', hours: 2,
    layout: D.layouts.drop_collapse,
    enemies: [['lemur', 3], ['fat_clown', 2]], elite: [['stilt_clown', 1]], flyers: [['brain_boiler', 1]],
    intro: 'circus_spy',
    reward: { box: 'silver', xp: 25, gold: 20 },
    sets: ['collapse_done', 'met_signet'],
    outro: 'signet_meet', next: 'a1_lions' });

  lv('a1_lions', { name: "SIGNET'S BASEMENT", act: 1, kind: 'side', theme: 'basement', music: 'boss', hours: 16, clearToExit: true,
    chunks: { start: 'basement_land', pool: [], count: 0, end: 'basement_lion_pit' },
    enemies: [['mold_lion', 1]], elite: [['mold_lion', 1]], flyers: [['brain_boiler', 1]],
    intro: ["SIX LEVEL 15 MOLD LIONS. YOU ARE LEVEL 13 AND IN YOUR UNDERWEAR. THE ODDS BOARD JUST FELL OFF THE WALL. SOMEBODY BET THEIR HOUSE ON THE LIONS.",
      "A FRIENDLY REMINDER FROM YOUR SPONSORS: THINGS THAT GROW BACK HATE FIRE. JUGS, CRAWLER. JUGS. SET THE BIG STUPID KITTIES ON FIRE. SORRY, DONUT."],
    signs: ["THE BASEMENT OF A BUILDING THAT IS NO LONGER ABOVE YOU. THE TOPLESS TATTOOED LADY SAID WAIT HERE. THE LIONS SAID FUCK THAT."],
    reward: { box: 'gold', xp: 40, gold: 30 },
    sets: ['lions_done', 'knocked_out', 'donut_asleep', 'mongo_caged'],
    outro: 'knockout', next: 'a1_solo' });

  lv('a1_solo', { name: 'ALONE IN THE LAIR', act: 1, kind: 'side', theme: 'basement', night: true, solo: true, music: 'dark', hours: 2,
    chunks: { start: 'basement_wake', pool: BASEMENT, count: 3, end: 'basement_end', insert: ['basement_cage'] },
    rescue: 'mongo', rescueFlag: 'mongo_freed',
    rescueLines: [
      { who: 'MONGO', text: "MREEEEEEP! MREEP MREEP! *HE HEADBUTTS CARL IN THE STOMACH, LICKS HIS FACE AND BITES HIS EAR, IN THAT ORDER*" },
      { who: 'CARL', text: "YEAH, BUDDY. I MISSED YOU TOO. EASY ON THE EAR. OW. OW! GODDAMNIT, MONGO, I NEED THAT EAR." } ],
    enemies: [['mold_lion', 2], ['fat_clown', 2], ['lemur', 2]], elite: [['stilt_clown', 1]], flyers: [['brain_boiler', 1]],
    intro: ["CARL, ALONE. NO CAT ON THE SHOULDER, NO DINOSAUR AT THE HEEL. JUST A MAN, HIS MAGIC BOXERS AND A WAR GAUNTLET. RATINGS ARE THROUGH THE FUCKING ROOF."],
    npcs: [{ id: 'signet_lair', sprite: 'signet', lines: [
      { who: 'SIGNET', text: "YOUR CAT SLEEPS IN MY WATER LILY. YOUR LIZARD IS IN A CAGE DOWN THE HALL. AND YOUR EYES ARE ON MY FACE, CRAWLER. HOW POLITE. HOW BORING." },
      { who: 'SIGNET', text: "FREE HIM IF YOU LIKE. THEN COME HUNT THE BEAR FOR ME. AND STOP BREAKING FINGERS ON MY ACCOUNT, LITTLE CRAWLER. A GIRL COULD GET A COMPLEX." }
    ] }],
    signs: ["A WATER LILY THE SIZE OF A HOT TUB. PRINCESS DONUT IS ASLEEP INSIDE IT, SNORING LIKE A LITTLE OUTBOARD MOTOR AND DROOLING ON A PETAL. DO NOT TAP THE GLASS."],
    reward: { box: 'silver', xp: 30, gold: 20 },
    sets: ['solo_done', 'mongo_freed'],
    outro: 'solo_after', next: 'a1_heather' });

  lv('a1_heather', { name: "HEATHER'S HUNTING GROUND", act: 1, kind: 'chase', theme: 'circus', night: true, solo: true, music: 'heather', hours: 3,
    chunks: { start: 'circus_start', pool: CIRCUS, count: 5, end: 'arena_heather' },
    chase: { pursuer: 'heather', speed: 62, catchDmg: 4 },
    boss: 'heather',
    enemies: [['lemur', 3], ['fat_clown', 2]], flyers: [['brain_boiler', 1]],
    intro: 'heather_intro',
    signs: ["THE CIRCUS GROUNDS. THE TRACKS IN THE MUD ARE ROLLER SKATE WHEELS. THEY ARE GETTING CLOSER. WHY THE FUCK ARE YOU STILL READING THIS SIG"],
    reward: { box: 'boss', xp: 40, gold: 40 },
    sets: ['heather_done', 'has_ticket'], gives: [{ item: 'big_top_ticket', n: 1 }, { item: 'scratch_ticket', n: 1 }, { gear: 'spiked_kneepads' }],
    outro: 'heather_down', thenArea: 'circus_park' });

  lv('a1_bigtop', { name: 'THE BIG TOP', act: 1, kind: 'rooms', theme: 'bigtop', night: true, solo: true, music: 'bigtop', hours: 4,
    room: {
      rooms: [
        { name: 'RING ONE: CLOWN ALLEY', target: { kind: 'pole', hp: 60 }, waves: [['fat_clown', 3], ['lemur', 2]], rate: 1.4, max: 5,
          intro: "RING ONE! BREAK THE TENT POLE! THE CLOWNS WOULD PREFER YOU DID NOT! THE CLOWNS CAN GO FUCK THEMSELVES! THEY DO NOT RUN THIS SEGMENT!" },
        { name: 'RING TWO: THE MENAGERIE', target: { kind: 'pole', hp: 80 }, waves: [['mold_lion', 2], ['lemur', 3], ['fat_clown', 1]], rate: 1.3, max: 6,
          intro: "RING TWO! THE ANIMAL ACTS! PLEASE DO NOT FEED THE LIONS. THEY ARE ALREADY EATING. THEY ARE EATING THE LAST GUY. THEY ARE EATING TOWARD YOU." },
        { name: 'RING THREE: THE HIGH WIRE', target: { kind: 'pole', hp: 100 }, waves: [['stilt_clown', 1], ['lemur', 3], ['fat_clown', 2]], rate: 1.2, max: 6,
          intro: "RING THREE! THE TALL BOYS! IF THE POLE GOES, THE WHOLE TENT SAGS AND THE CENTER RING OPENS. SOMETHING IN THERE IS VERY BIG AND VERY HUNGRY." }
      ],
      finale: { kind: 'vine', name: 'CENTER RING: RINGMASTER GRIMALDI', seconds: 45, worms: true, rate: 1.6, music: 'boss', meter: 'POISON',
        lines: [
          { who: 'SYSTEM AI', text: "THE CENTER RING! RINGMASTER GRIMALDI, LEVEL 85 CITY BOSS! YOU CANNOT KILL HIM. YOU CAN POISON HIM. DRIP, CARL. BLEED ON THE BIG BASTARD AND STAY ALIVE." },
          { who: 'CARL', text: "POISON IN THE BLOOD, BLOOD ON THE ROOTS. MORDECAI, IF THIS DOESN'T WORK I'M HAUNTING YOU. I'M HAUNTING YOUR BAR. I'M PISSING IN YOUR BOTTLES." } ],
        doneLines: [
          { who: 'SYSTEM AI', text: "THE VINE IS WILTING! THE BIG TOP IS SAGGING! THE CITY BOSS IS DYING SLOWLY AND PAINFULLY, WHICH IS OUR FAVORITE WAY TO DIE!" },
          { who: 'CARL', text: "OKAY. OKAY, HE'S HURTING. NOW I NEED HIM TO TALK TO ME, NOT DIE ON ME. ZEV. ZEV, GET ME THE GODDAMN PRODUCERS." } ] }
    },
    intro: 'bigtop_gate',
    reward: { box: 'quest_gold', xp: 150, gold: 80 },
    sets: ['bigtop_done', 'grimaldi_peace'], quest: { done: 'show_must_go_on' },
    outro: 'grimaldi_deal', next: 'a1_barricade' });

  lv('a1_barricade', { name: 'THE BARRICADE', act: 1, kind: 'survival', theme: 'ruins', night: true, music: 'ruins_night', hours: 5,
    party: ['mongo'],
    chunks: { start: 'ruins_barricade', pool: [], count: 0, end: null },
    survival: { seconds: 90, waves: [['street_urchin', 6], ['fat_clown', 1]], rate: 1.2, max: 10, guard: 'barricade', guardHp: 60 },
    enemies: [['street_urchin', 1]],
    intro: 'barricade_intro',
    reward: { box: 'gold', xp: 50, gold: 30 },
    sets: ['circus_gone', 'donut_awake', 'panic'],
    outro: 'dawn', thenArea: 'circus_park' });

  /* ======================= ACT 2: THE SETTLEMENT ======================= */
  lv('a2_dispenser', { name: 'THE BREATHING BLOCK', act: 2, kind: 'facade', theme: 'ruins', music: 'boss', hours: 3,
    chunks: { start: 'ymca_start', pool: [], count: 0, end: 'ymca_facade' },
    boss: 'dispenser', startGives: [{ item: 'dyn', n: 2 }],
    enemies: [['brain_boiler', 3]], flyers: [['brain_boiler', 1]],
    intro: ["A WHOLE CITY BLOCK OF DEAD BRICK. ONE OF THE WALLS IS BREATHING. DONUT'S EARS ARE TWITCHING. CARL'S ASSHOLE IS PUCKERING.",
      "PRO TIP FROM YOUR SPONSORS: DOWN + SPECIAL WITH DYNAMITE IN YOUR POCKETS. WE ALREADY HAVE A NAME FOR IT. WE ARE SO FUCKING EXCITED."],
    signs: ["NOTICE: POOL CLOSED. GYM CLOSED. LOCKER ROOM CLOSED. THE WALL IS OPEN. THE WALL IS ALWAYS OPEN. THE WALL HAS A MOUTH. DO NOT LICK THE WALL."],
    reward: { box: 'boss', xp: 60, gold: 50 },
    sets: ['dispenser_done'],
    outro: 'dispenser_down' });

  lv('a2_mongo', { name: 'MONGO, OFF THE LEASH', act: 2, kind: 'side', swap: 'mongo', theme: 'settlement', night: true, music: 'market', hours: 1,
    chunks: { start: 'settlement_start', pool: SETTLE, count: 3, end: 'settlement_alley_end' },
    enemies: [['street_urchin', 3], ['incubus', 1], ['lemur', 1]], flyers: [['brain_boiler', 1]],
    intro: ["YOU ARE MONGO. YOU SMELL SOMETHING. IT SMELLS LIKE MEAT AND MAGIC AND BAD IDEAS. RUN. BITE. DO NOT LET THE HUMAN CATCH UP. HE IS SWEARING A LOT."],
    signs: ["MONGO CANNOT READ. MONGO HAS BITTEN THIS SIGN AND PISSED ON IT. THE SIGN SAID: NO DOGS. MONGO IS NOT A DOG. THE SIGN HAD IT COMING."],
    reward: { box: 'bronze', xp: 30, gold: 10 },
    sets: ['mongo_done'],
    next: 'a2_alley' });

  lv('a2_alley', { name: "GUMGUM'S ALLEY", act: 2, kind: 'side', theme: 'alley', night: true, music: 'dark', bossMusic: 'boss', hours: 2,
    chunks: { start: 'alley_start', pool: ALLEY, count: 3, end: 'arena_vincente', insert: ['alley_gumgum'] },
    boss: 'vincente',
    enemies: [['city_elf', 3], ['incubus', 1], ['street_urchin', 1]], elite: [['berserker', 1]], flyers: [['brain_boiler', 1]],
    intro: ["MONGO FOUND WHAT HE WAS SMELLING. SO DID YOU. OH, FUCK. KRASUE ARE GHOST-CLASS: FISTS, KICKS, MISSILES AND FANG CAPS. NOT BOMBS. FIND THE BODIES."],
    signs: ["SPRAY PAINT ON THE WALL: THE ANGELS ARE WATCHING. SOMEBODY ELSE HAS WRITTEN UNDER IT: SO ARE THE FUCKING HEADS.",
      "GUMGUM. LEVEL 5 ORC. SHE ASKED FOR HELP AND THE GUIDE SAID NO. SOMEBODY ELSE ANSWERED. THE MARKS ON HER ARE NOT FROM ONE KIND OF MONSTER."],
    reward: { box: 'boss', xp: 60, gold: 40 },
    sets: ['vincente_dead', 'gumgum_dead', 'has_pass', 'xistera'], gives: [{ item: 'gate_pass', n: 1 }, { item: 'letter', n: 1 }, { gear: 'xistera' }],
    outro: 'alley_after', thenArea: 'settlement' });

  lv('a2_divider', { name: "THE Y: THE DIVIDER'S CORPSE", act: 2, kind: 'side', theme: 'ymca', dark: true, night: true, music: 'dark', hours: 3,
    chunks: { start: 'ruins_start', pool: RUINS_DARK, count: 4, end: 'divider_end' },
    enemies: [['city_elf', 3], ['berserker', 2]], elite: [['berserker', 1]], flyers: [['brain_boiler', 1]],
    intro: ["A BIG OLD BUILDING WITH A FADED SIGN. THE LETTERS THAT ARE LEFT SPELL Y. JUST Y. AS IN Y THE FUCK ARE YOU OUT HERE AT NIGHT.", "SOMEBODY KILLED A NEIGHBORHOOD BOSS IN THE POOL AND LEFT IT TO ROT. THE ELVES ARE WAITING FOR WHOEVER COMES TO LOOK. STAY IN THE CAT'S LIGHT.",
      "SHAMBLING BERSERKERS GET FOUR TIMES STRONGER IN THE DARK. THE ELVES MAKE THE DARK. YOU DO THAT MATH. WE DID. YOU ARE FUCKED."],
    signs: ["THE DIVIDER. NEIGHBORHOOD BOSS. A WHALE WITH TWO LONG NECKS, LIKE SOMEBODY ORDERED NESSIE TWICE. DECEASED. BLOATED LIKE A TICK. DO NOT POKE. DO NOT BOMB."],
    reward: { box: 'gold', xp: 100, gold: 50 },
    sets: ['divider_done'],
    outro: 'divider_blast', thenArea: 'ruins_e' });

  lv('a2_danger_zone', { name: 'DANGER ZONE WITH RIPPER WONTON', act: 2, kind: 'show', theme: 'studio', show: 'danger_zone', music: 'show', hours: 3,
    intro: 'greenroom',
    reward: { box: 'fan', xp: 80, gold: 40 },
    sets: ['show_done', 'manasa_dead'], gives: [{ item: 'jug', n: 3 }, { item: 'moonshine', n: 2 }],
    outro: 'blast', thenArea: 'settlement' });

  lv('a2_apito', { name: 'APITO EDUCATION CENTER', act: 2, kind: 'side', theme: 'school', music: 'settlement', hours: 3,
    chunks: { start: 'school_start', pool: SCHOOL, count: 4, end: 'school_end', insert: ['school_eunice'] },
    enemies: [['wand_bearer', 4], ['city_elf', 2]], elite: [['berserker', 1]], flyers: [['brain_boiler', 1]],
    intro: ["THE SIGN SAYS EDUCATION CENTER. YOUR MAP SAYS CORRUPT TEMPLE. THE 201ST SAYS GO AWAY. THE MAP IS RIGHT. THE 201ST CAN EAT SHIT.",
      "GUARDS ARE OUT IN THE STREET. DO NOT HIT A CITIZEN. HIT THE WAND BEARERS. THEY ARE NOT CITIZENS. THEY ARE TORTURERS WITH A DRESS CODE."],
    npcs: [
      { id: 'eunice', sprite: 'eunice', lines: [
        { who: 'EUNICE', text: "THEY TOOK MY HUSBAND IN THERE LAST WEEK. I AM PREGNANT, I AM PISSED OFF AND I HAVE A FRYING PAN. MOVE." },
        { who: 'EUNICE', text: "RICKY JOE, HONEY, STAY BEHIND MOMMA. AND DO NOT TOUCH THE DINOSAUR." } ] },
      { id: 'ricky_joe', sprite: 'ricky_joe', lines: [
        { who: 'RICKY JOE', text: "IS THAT A DINOSAUR? CAN I PET HIM? HE ATE SPARKY. HE ATE MY SALAMANDER. HEY. HEY! HE'S LOOKING AT MY ARM." },
        { who: 'CARL', text: "MONGO. DROP IT. NO. DROP. IT. GOOD BOY. HERE, KID, HAVE THIS BACK. DONUT, HEAL HIS ARM BEFORE HIS MOM SEES. OH, SHIT. SHE SEES." } ] }
    ],
    signs: ["APITO EDUCATION CENTER. TODAY'S LESSON: THE SKYFOWL ARE ANGELS. TOMORROW'S LESSON: THE SKYFOWL ARE STILL ANGELS. QUIZ ON FRIDAY."],
    reward: { box: 'gold', xp: 100, gold: 60 },
    sets: ['apito_done', 'mic_drop'],
    outro: 'apito_after', thenArea: 'settlement' });

  lv('a2_alley_night', { name: 'THE BACK ALLEY', act: 2, kind: 'side', theme: 'alley', night: true, music: 'dark', hours: 3,
    chunks: { start: 'alley_start', pool: ALLEY, count: 3, end: 'alley_end', insert: ['alley_swarm'] },
    enemies: [['shadow_leak', 3], ['city_elf', 2]], elite: [['berserker', 1]], flyers: [['shadow_leak', 1]],
    intro: ["SHADOW LEAKS! LITTLE CLOUDS OF HUNGRY COLD THAT WANT TO CRAWL DOWN YOUR THROAT. BOMBS GO RIGHT THROUGH. FISTS DO NOT. KATIA'S SHIELD DOES NOT CARE."],
    signs: ["SOMEBODY CHALKED A TALLY ON THE WALL. ONE MARK PER NIGHT THE ALLEY FILLED WITH SMOKE THAT BIT. THE WALL RAN OUT OF ROOM."],
    reward: { box: 'gold', xp: 120, gold: 50 },
    sets: ['alley_night_done', 'mongo_big'],
    outro: 'mongo_grows', thenArea: 'settlement' });

  /* ======================= ACT 3: QUILL'S TOWER AND THE GLASS ======================= */
  lv('a3_climb', { name: 'THE MUNICIPAL WALL', act: 3, kind: 'climb', theme: 'admin', night: true, music: 'climb', hours: 2,
    layout: D.layouts.climb_admin,
    enemies: [['city_elf', 3], ['lemur', 1]], elite: [['berserker', 1]], flyers: [['shadow_leak', 2], ['ruin_flocker', 1]],
    intro: ["THE MUNICIPAL BUILDING, AT NIGHT, FROM THE OUTSIDE. QUILL'S FLOOR IS AT THE TOP. A LONG FALL AND A WET SPLAT ARE AT THE BOTTOM. CHOOSE UP."],
    reward: { box: 'silver', xp: 150, gold: 40 },
    sets: ['climb_done'],
    next: 'a3_plant' });

  lv('a3_plant', { name: "MISS QUILL'S RECEPTION", act: 3, kind: 'plant', theme: 'office', night: true, music: 'dark', hours: 2,
    chunks: { start: 'office_start', pool: ['office_shelf_a', 'office_shelf_b', 'office_shelf_c'], count: 3, end: 'office_roof_end' },
    plant: { charges: 3 }, detonateSub: 'MISS QUILL IS NO LONGER ACCEPTING VISITORS',
    enemies: [['city_elf', 2], ['shadow_leak', 1]], flyers: [['shadow_leak', 1]],
    intro: 'plant_intro',
    signs: [
      "HOLD UP AT A CHARGE SPOT TO PLANT. YOU CAN'T FIGHT WHILE PLANTING. A KRASUE THAT SEES YOU WILL CHEW YOUR FACE OFF. DROP A DECOY AT A Y SPOT FIRST.",
      "THE NEIGHBORING ROOF. ALL THREE STICKS PLANTED? STAND ON THE SPOT AND PRESS BOMB. THEN ENJOY THE SHOW. YOU ARE THE SHOW. QUILL IS THE CONFETTI."
    ],
    reward: { box: 'boss', xp: 300, gold: 100 },
    sets: ['quill_dead', 'magistrate', 'cockblock'],
    outro: 'magistrate', next: 'a3_nest' });

  lv('a3_nest', { name: 'THE KRASUE NEST', act: 3, kind: 'side', theme: 'nest', dark: true, night: true, music: 'dark', hours: 3,
    chunks: { start: 'nest_start', pool: NEST, count: 4, end: 'nest_burgundy_end', insert: ['nest_featherfall'] },
    enemies: [['berserker', 2], ['shadow_leak', 2]], elite: [['berserker', 1]], flyers: [['shadow_leak', 1]],
    intro: ["WHAT IS LEFT OF THE MAGISTRATE'S CHAMBERS. HEADLESS BODIES HANG FROM HOOKS LIKE COATS IN A CLOSET. THE HEADS ARE OUT. THE HEADS ARE COMING HOME. FUCK."],
    npcs: [{ id: 'burgundy_dying', sprite: 'burgundy', lines: [
      { who: 'BURGUNDY', text: "DON'T HEAL ME. IF MY BODY HEALS, THE CURSE COMES BACK WITH IT. I GET TO DIE A PERSON. PLEASE. LET ME HAVE THAT." },
      { who: 'BURGUNDY', text: "IT WAS NEVER FEATHERFALL. IT WAS QUILL. AND HER HUSBAND. REMEX. GO TO THE DEPOT. THAT IS WHERE HE KEEPS THE LIGHT." }
    ] }],
    signs: ["THE ROOM IS MUTED TO SPELLS. EVEN THE CAT'S TORCH FLICKERS. SOMETHING IN HERE ATE A LOT OF LIGHT AND WANTS MORE. IT SMELLS LIKE A BUTCHER'S DUMPSTER.",
      "MAGISTRATE FEATHERFALL, LEVEL 32 DARK CLERIC. STRAPPED UPSIDE DOWN TO A WHEEL. FEATHERLESS. MILKY EYES. DEAD FOR YEARS. HE STILL SIGNED THINGS. SOMEHOW."],
    reward: { box: 'gold', xp: 250, gold: 80 },
    sets: ['nest_done', 'burgundy_dead', 'met_bautista'], gives: [{ gear: 'kimaris' }],
    outro: 'nest_after', thenArea: 'admin' });

  lv('a3_depot', { name: 'THE GUARD DEPOT', act: 3, kind: 'plant', theme: 'depot', night: true, music: 'dark', hours: 3,
    chunks: { start: 'depot_start', pool: ['depot_a', 'depot_b', 'depot_c', 'depot_d'], count: 5, end: 'depot_end' },
    plant: { charges: 10, finale: 'handoff', handoffSub: 'KATIA HAS THE BUTTON. SHE IS HOLDING IT VERY GENTLY.' },
    enemies: [['city_elf', 3], ['shadow_leak', 1]], elite: [['berserker', 1]], flyers: [['shadow_leak', 1]],
    intro: 'depot_plan',
    signs: [
      "THE SWORDSMEN SIT IN STASIS ALL NIGHT. TEN STICKS, TEN SPOTS. THE STATUES ARE NOT STATUES. DO NOT WAKE THEM. TIPTOE, BAREFOOT BOY. WE'RE WATCHING THE FEET.",
      "KATIA'S POST. ALL TEN PLANTED? STAND HERE AND PRESS BOMB TO HAND HER THE DETONATOR. SHE PUSHES WHEN YOU SAY. NOT BEFORE. FOR FUCK'S SAKE, NOT BEFORE."
    ],
    reward: { box: 'platinum', xp: 200, gold: 80 },
    sets: ['depot_rigged', 'glass_broken', 'doomsday'], gives: [{ item: 'detonator', n: 1 }, { item: 'doomsday', n: 1 }],
    quest: { done: 'sex_workers', start: 'fools_glass' },
    outro: 'remex', next: 'a3_escape' });

  lv('a3_escape', { name: 'THE FOOLS WHO BROKE THE GLASS', act: 3, kind: 'escape', theme: 'escape', night: true, music: 'escape', hours: 1,
    chunks: { start: 'escape_start', pool: ESCAPE, count: 12, end: 'escape_end', insert: ['escape_bautista'] },
    escape: { seconds: 420, bursts: [360, 270, 180, 90], cause: 'THE GLASS BROKE' }, debrisProj: 'bolt',
    enemies: [['ruin_flocker', 2], ['berserker', 1], ['city_elf', 1]], elite: [['berserker', 1]], flyers: [['ruin_flocker', 3]],
    intro: ["SEVEN MINUTES! THE EASTERN STAIRWELL IS OPEN! FOUR MAGIC BURSTS BEFORE THE BIG ONE! EACH ONE FUCKS WITH THE RULES! RUN, YOU MAGNIFICENT IDIOTS!"],
    npcs: [{ id: 'bautista_run', sprite: 'bautista', lines: [
      { who: 'BAUTISTA', text: "CARL! MY PEOPLE ARE WITH ME! GO, GO, I HAVE YOUR BACK. KEEP RUNNING, I'M RIGHT BEHIND YOU AND I AM VERY FUCKING FAST." } ] }],
    signs: ["THE STAIRWELL IS EAST. EVERYTHING ELSE IS ABOUT TO BE A CRATER. YOU ARE CARRYING THE REASON. DO NOT DROP IT. DO NOT TRIP. DO NOT FART TOO HARD."],
    reward: { box: 'quest_platinum', xp: 400, gold: 150 },
    sets: ['escaped'], quest: { done: 'fools_glass' },
    outro: 'finale', win: true, final: true });

  /* ======================= OPTIONAL SIDE LEVELS ======================= */
  lv('x_temple', { name: 'THE CORRUPT TEMPLE', act: 1, kind: 'side', theme: 'temple', optional: true, music: 'ruins', hours: 2,
    chunks: { start: 'temple_start', pool: ['temple_a', 'temple_b', 'temple_c', 'temple_d'], count: 4, end: 'temple_end' },
    enemies: [['shadow_leak', 2], ['incubus', 2], ['brain_boiler', 2]], elite: [['stilt_clown', 1]], flyers: [['shadow_leak', 1]],
    intro: ["YOUR MAP CALLS THIS A CORRUPT TEMPLE. WE CALL IT A LOOT PINATA. HIT IT UNTIL SOMETHING FALLS OUT. USUALLY IT IS YOUR INTESTINES."],
    signs: [
      "THE OLD GODS OF THE OVER CITY. MOST OF THEM ARE DEAD. THE REST ARE ON THE SIXTH FLOOR, DOING REALITY TV AND EACH OTHER.",
      "ALTAR OF THE CATACLYSM. LEAVE AN OFFERING. THE OFFERING BOWL HOLDS BUTTONS, ONE TOOTH AND SOMETHING THAT USED TO BE A FINGER."
    ],
    reward: { box: 'gold', xp: 40, gold: 40 }, sets: ['temple_done'] });

  lv('x_restroom', { name: 'RUINS RESTROOM', act: 2, kind: 'side', theme: 'restroom', optional: true, music: 'ruins', hours: 1,
    chunks: { start: 'restroom_start', pool: ['restroom_a', 'restroom_b', 'restroom_c'], count: 3, end: 'restroom_end' },
    enemies: [['street_urchin', 4], ['brain_boiler', 1]], elite: [['berserker', 1]], flyers: [['brain_boiler', 1]],
    intro: ["A RESTROOM! THE DUNGEON STILL HAS THEM ON THIS FLOOR. THE STREET URCHINS ARE ON SHIFT. THEY TAKE THE JOB, AND THE SHIT, VERY SERIOUSLY."],
    signs: [
      "FOR A GOOD TIME CALL THE MOTHER OF THE CATACLYSM. SHE IS AT THE BOTTOM OF THE VOLCANO. SHE DOES NOT PICK UP. SHE DOES NOT PUT OUT.",
      "PLEASE WASH YOUR HANDS. PLEASE WASH YOUR FEET. GLITTER IS NOT A SUBSTITUTE FOR SOAP, CARL. SIGNED, A VERY BIG FAN OF YOUR FEET."
    ],
    reward: { box: 'silver', xp: 40, gold: 30 }, sets: ['restroom_done'] });

  lv('x_park', { name: 'THE OVERGROWN PARK', act: 3, kind: 'side', theme: 'ruins', night: true, optional: true, music: 'ruins_night', hours: 2,
    chunks: { start: 'ruins_start', pool: ['park_a', 'ruins_b', 'ruins_d', 'ruins_f', 'ruins_h', 'ruins_i'], count: 4, end: 'park_end' },
    enemies: [['mold_lion', 3], ['berserker', 1], ['shadow_leak', 2]], elite: [['berserker', 1]], flyers: [['shadow_leak', 1], ['ruin_flocker', 1]],
    intro: ["A PARK THAT WENT FERAL. THE BENCHES HAVE ROOTS. THE LIONS HAVE MOLD. THE FOG HAS ITS OWN LOOT TABLE. SOMETHING IN THE BUSHES IS CHEWING. LOUDLY."],
    reward: { box: 'platinum', xp: 150, gold: 60 }, sets: ['park_done'] });

  /* ---------------- quests ---------------- */
  D.quests = {
    show_must_go_on: { name: 'THE SHOW MUST GO ON', reward: 'GOLD QUEST BOX',
      desc: "A TRAVELING CIRCUS SURVIVED THE CATACLYSM AND KEPT TOURING. NOW IT KILLS EVERYTHING IT MEETS. FIND OUT WHY THE FUCKING THING STILL EXISTS. SHUT IT DOWN." },
    sex_workers: { name: 'THE SEX WORKERS WHO FELL FROM THE HEAVENS', reward: 'SILVER QUEST BOX',
      desc: "EVERY MORNING MORE DEAD WOMEN TURN UP OUTSIDE THE SETTLEMENT. NOBODY IN CHARGE GIVES A SHIT WHO THEY WERE. GUMGUM DOES. FIND OUT WHO IS DOING THIS." },
    fools_glass: { name: 'THE FOOLS WHO BROKE THE GLASS', reward: 'PLATINUM QUEST BOX',
      desc: "A SPELL THREE GENERATIONS IN THE MAKING JUST BROKE. EVERYTHING WITHIN 45 SQUARE KM IS ABOUT TO EXPLODE. YOU ARE THE HOST. DON'T FUCKING DIE." }
  };

  /* ---------------- objectives (first unfinished one shows on the HUD) ---------------- */
  D.objectives = [
    { done: 'toured', text: 'STEP OUT INTO THE VILLAGE', area: 'village' },
    { done: 'lemurs_done', text: 'HEAD EAST INTO THE RUINS', area: 'ruins_w' },
    { done: 'pug_scene', text: 'GET BACK TO THE PUG', area: 'village' },
    { done: 'bodies_done', text: 'CHECK OUT DEAD CRAWLER ROW', area: 'ruins_w' },
    { done: 'collapse_done', text: 'SPY ON THE CIRCUS', area: 'circus_park' },
    { done: 'lions_done', text: "SURVIVE SIGNET'S BASEMENT", area: 'circus_park' },
    { done: 'solo_done', text: 'FREE MONGO, FIND SIGNET', area: 'circus_park' },
    { done: 'heather_done', text: 'HUNT HEATHER THE BEAR', area: 'circus_park' },
    { done: 'bigtop_done', text: 'BREAK INTO THE BIG TOP AT NIGHT', area: 'circus_park' },
    { done: 'circus_gone', text: 'GET BACK TO DONUT', area: 'circus_park' },
    { done: 'settled', text: 'TAKE THE EAST ROAD TO TOWN', area: 'settlement' },
    { done: 'dispenser_done', text: 'KILL THE DISPENSER ON THE EAST RD', area: 'ruins_e' },
    { done: 'quest_sw', text: 'FIND GUMGUM OUTSIDE THE GATE', area: 'ruins_e' },
    { done: 'club_known', text: 'MORDECAI WANTS YOU IN TOWN', area: 'settlement' },
    { done: 'mongo_done', text: "CATCH THAT GODDAMN DINOSAUR", area: 'settlement' },
    { done: 'vincente_dead', text: "GO INTO GUMGUM'S ALLEY", area: 'settlement' },
    { done: 'met_quill', text: 'SHOW THE PASS AT THE ADMIN GATE', area: 'admin' },
    { done: 'divider_done', text: 'THE DIVIDER, EAST ROAD, NIGHT', area: 'ruins_e' },
    { done: 'show_done', text: 'GO ON DANGER ZONE', area: 'settlement' },
    { done: 'apito_done', text: 'RAID THE APITO CENTER BY DAY', area: 'settlement' },
    { done: 'katia_joined', text: 'FIND THE CRAWLER HEKLA MEANT', area: 'settlement' },
    { done: 'mongo_big', text: 'CLEAR THE BACK ALLEY AT NIGHT', area: 'settlement' },
    { done: 'climb_done', text: "CLIMB TO QUILL'S FLOOR AT NIGHT", area: 'admin' },
    { done: 'quill_dead', text: "BLOW MISS QUILL TO HELL", area: 'admin' },
    { done: 'nest_done', text: 'SEARCH THE WRECKAGE', area: 'admin' },
    { done: 'depot_rigged', text: 'RIG THE GUARD DEPOT AT NIGHT', area: 'admin' },
    { done: 'escaped', text: 'RUN FOR THE EASTERN STAIRWELL', area: 'admin' }
  ];

  /* ---------------- events (street events; lead notes for the fields) ---------------- */
  D.events = [
    { id: 'tour', area: 'village', when: { notFlags: ['toured'] }, cinema: 'tour', sets: ['toured', 'map_village'] },
    { id: 'first_ruins', area: 'ruins_w', when: { notFlags: ['seen_ruins'] }, sets: ['seen_ruins'], lines: [
      { who: 'SYSTEM AI', text: "THE RUINS! NINETY PERCENT OF THE OVER CITY, ONE HUNDRED PERCENT MONSTERS. NO GUARDS OUT HERE. NO RULES. NO MERCY. HAVE FUN, YOU BEAUTIFUL MEAT!" },
      { who: 'DONUT', text: "CARL, THERE IS SMOKE COMING UP THROUGH THE FLOOR. SMOKE? CARL. YOU KNOW HOW I FEEL ABOUT SMOKE. IT GETS IN THE UNDERCOAT." },
      { who: 'CARL', text: "IT'S A VOLCANO, DONUT. WE'RE STANDING ON THE LID. LET'S NOT THINK ABOUT IT. AND NOW I'M THINKING ABOUT IT. SHIT." } ] },
    { id: 'pug_vomit', area: 'village', when: { flags: ['lemurs_done'], notFlags: ['pug_scene'] }, cinema: 'pug_vomit',
      sets: ['pug_scene'], gives: [{ item: 'moonshine', n: 2 }, { potion: 1 }] },
    { id: 'first_circus', area: 'circus_park', when: { notFlags: ['seen_circus'] }, sets: ['seen_circus'], lines: [
      { who: 'SYSTEM AI', text: "GRIMALDI'S TRAVELING CIRCUS! STILL TOURING CENTURIES AFTER THE END OF THE WORLD. THE CALLIOPE NEVER STOPS. NEVER. WE TRIED SHOOTING IT." },
      { who: 'CARL', text: "MY DAD TOOK ME TO RINGLING BROTHERS ONCE. ONE OF THE ONLY GOOD DAYS. I'D LIKE TO KEEP THAT MEMORY. SO OF COURSE THE FUCKING CIRCUS WANTS ME DEAD." } ] },
    { id: 'city_boss', area: 'circus_park', when: { flags: ['heather_done'], notFlags: ['saw_grimaldi'] }, sets: ['saw_grimaldi'], lines: [
      { who: 'SYSTEM AI', text: "MAP UPDATE! A CITY BOSS IN THE BIG TOP. LEVEL 85. YOU ARE LEVEL NOT 85. BILLIONS OF VIEWERS JUST BOUGHT POPCORN AND LOOSENED THEIR BELTS." },
      { who: 'MORDECAI', text: "(OVER THE CHAT) KID. YOU DON'T FIGHT THAT. YOU OUTTHINK IT. SEE ME AT THE PUG FIRST. I HAVE A PLAN. YOU'LL HATE IT. IT INVOLVES YOUR BLOOD." } ] },
    { id: 'park_empty', area: 'circus_park', when: { flags: ['circus_gone'], notFlags: ['seen_stairs'] }, sets: ['seen_stairs'], lines: [
      { who: 'SYSTEM AI', text: "THE CIRCUS HAS LEFT TOWN! IN ITS PLACE: A STAIRWELL TO THE FOURTH FLOOR. YOU COULD TAKE IT RIGHT NOW. YOU COULD. YOU BIG CHICKENSHIT." },
      { who: 'MORDECAI', text: "(OVER THE CHAT) DON'T. THE SETTLEMENT IS EAST. BETTER SHOPS, BETTER LOOT, BETTER ODDS ON FLOOR FOUR. THE STAIRS AREN'T GOING ANYWHERE, DUMBASS." } ] },
    { id: 'first_east', area: 'ruins_e', when: { notFlags: ['seen_east'] }, sets: ['seen_east'], lines: [
      { who: 'SYSTEM AI', text: "THE EAST ROAD! THIRTY-FOUR KILOMETERS OF IT. THE MEDIUM SKYFOWL SETTLEMENT IS AT THE END. BRING SNACKS. BRING A BODY BAG. BRING A CUP. HA." } ] },
    { id: 'settlement_arrival', area: 'settlement', when: { notFlags: ['settled'] }, cinema: 'settlement_arrival',
      sets: ['settled', 'freeballing', 'fang_caps', 'quadrillion'],
      gives: [{ item: 'dyn', n: 4 }, { item: 'hob', n: 4 }, { gear: 'freeballing' }, { gear: 'fang_caps' }] },
    { id: 'gumgum_ask', area: 'settlement', when: { flags: ['settled'], notFlags: ['gumgum_asked'] }, cinema: 'gumgum_ask', sets: ['gumgum_asked'],
      gives: [{ item: 'dyn', n: 2 }] },
    { id: 'gumgum_bodies', area: 'ruins_e', when: { flags: ['dispenser_done'], notFlags: ['quest_sw'] }, cinema: 'gumgum_bodies',
      sets: ['quest_sw'], quest: { start: 'sex_workers' } },
    { id: 'desperado_tour', area: 'settlement', when: { flags: ['quest_sw'], notFlags: ['club_known'] }, cinema: 'desperado_tour',
      sets: ['club_known', 'met_pustule', 'mongo_bolted'], gives: [{ item: 'pet_carrier', n: 1 }], level: 'a2_mongo' },
    { id: 'quill_desk', area: 'admin', when: { flags: ['has_pass'], notFlags: ['met_quill'] }, cinema: 'quill_desk', sets: ['met_quill', 'shelves_rigged'] },
    { id: 'katia_meet', area: 'settlement', when: { flags: ['apito_done'], notFlags: ['katia_joined'] }, cinema: 'katia_meet', sets: ['katia_joined'] },
    { id: 'magistrate_town', area: 'admin', when: { flags: ['quill_dead'], notFlags: ['seen_crater'] }, sets: ['seen_crater'], lines: [
      { who: 'SYSTEM AI', text: "ALL HAIL MAGISTRATE CARL OF THE MEDIUM SKYFOWL SETTLEMENT! HIS FIRST OFFICIAL ACT WAS A CRATER. HIS SECOND IS PENDING. HIS PANTS ARE PENDING FOREVER." },
      { who: 'CARL', text: "CAN I PARDON MYSELF FOR THE CRATER?" },
      { who: 'SYSTEM AI', text: "YOU CAN PARDON ANYONE YOU LIKE, MAGISTRATE. THE GUARDS WILL STILL CUT YOU IN HALF IF YOU PUNCH A CHICKADEE. SEPARATION OF POWERS, BITCH!" } ] },
    { id: 'first_east_stairs', area: 'east_stairs', when: { notFlags: ['seen_east_stairs'] }, sets: ['seen_east_stairs'], lines: [
      { who: 'SYSTEM AI', text: "THE EASTERN STAIRWELL! SEALED, FOR NOW. SOME STAIRWELLS ONLY OPEN WHEN SOMETHING DRAMATIC HAPPENS. WE FUCKING LOVE SOMETHING DRAMATIC." } ] }
  ];

  /* ---------------- NPC talk (first matching entry wins) ---------------- */
  D.talk = {
    mordecai_tour: [
      { lines: [
        { who: 'MORDECAI', text: "RULE ONE: DON'T TOUCH THE CITIZENS. RULE TWO: DON'T TOUCH THE GUARDS. RULE THREE: DON'T TOUCH ME. NOBODY TOUCHES ME. I'M GOING TO GO LIE DOWN." },
        { who: 'MORDECAI', text: "RUINS EAST. CIRCUS PAST THEM. IF YOU HEAR A CALLIOPE, YOU'VE GONE TOO FAR. YOU'RE GOING TO GO TOO FAR. YOU ALWAYS DO, YOU STUBBORN SON OF A BITCH." } ] }
    ],
    town_crier: [
      { when: { flags: ['circus_gone'] }, lines: [{ who: 'TOWNSPERSON', text: "THE CIRCUS LEFT! FIRST TIME IN THREE HUNDRED YEARS NOBODY HEARD THE CALLIOPE AT BREAKFAST. MY KIDS CRIED. FROM JOY. I CRIED INTO MY BEER." }] },
      { lines: [
        { who: 'TOWNSPERSON', text: "HEAR YE! THE VILLAGE IS SAFE BY DAY! THE GUARDS HAVE SWORDS! THE SWORDS HAVE NO SENSE OF HUMOR! NEITHER DO THE GUARDS! NEITHER DO I!" },
        { who: 'TOWNSPERSON', text: "AT NIGHT THE GUARDS GO TO THEIR DEPOT AND THE URCHINS COME OUT. KEEP TO THE MAIN ROAD. DON'T STAND IN THE TRASH. DON'T BE THE TRASH." } ] }
    ],
    gate_guard: [
      { lines: [
        { who: 'GUARD', text: "NO JAIL ON THIS FLOOR, CRAWLER. NO FINES. NO WARNINGS. ONE PUNISHMENT. I AM HOLDING IT. IT IS SIX FEET LONG AND VERY SHARP." },
        { who: 'GUARD', text: "RUN TO THE RUINS AND I WON'T FOLLOW. BUT YOU DON'T COME BACK THROUGH MY GATE. EVER. NOT EVEN TO SAY SORRY." } ] }
    ],
    signet_park: [
      { when: { flags: ['bigtop_done'] }, lines: [{ who: 'SIGNET', text: "HE SPOKE TO ME. AFTER THREE HUNDRED YEARS, HE SPOKE TO ME. GO, CRAWLER. YOUR CAT NEEDS YOU. AND THANK YOU. YOU MAY LOOK DOWN NOW. ONCE." }] },
      { when: { flags: ['heather_done'] }, lines: [{ who: 'SIGNET', text: "THE TICKET GETS YOU PAST CLAMMY. INSIDE, HE WILL KNOW YOU. BE BRAVE. BE BLEEDING. AND KEEP YOUR BLOOD IN YOUR HEAD THIS TIME, LITTLE CRAWLER." }] },
      { lines: [
        { who: 'SIGNET', text: "MY TATTOOS ARE AWAKE TONIGHT. THEY CAN SMELL THE BEAR. GO AHEAD, LOOK AT THEM, CRAWLER. THEY ARE ALL OVER ME. EVERYWHERE. TAKE YOUR TIME." },
        { who: 'CARL', text: "I'M LOOKING AT YOUR EYES. ONLY YOUR EYES. THEY'RE VERY... GLOWY. OKAY. THE SHARK ON YOUR ARM IS WINKING AT ME. I'M LEAVING. GOODBYE." } ] }
    ],
    lucia: [
      { lines: [
        { who: 'LUCIA MAR', text: "YOU'RE CARL. YOU'RE THE CAT. MY DOGS DON'T LIKE YOU. I DON'T EITHER. WE'LL MEET AGAIN, BOXER BOY." },
        { who: 'CARL', text: "A THIRTEEN-YEAR-OLD IN GLOWING ARMOR WITH A MACE AND A SOCCER JERSEY. A MASTERS OF THE UNIVERSE TOY THAT KILLS PEOPLE. SHE SCARES THE SHIT OUT OF ME." },
        { who: 'DONUT', text: "SHE HAS VERY BAD MANNERS AND VERY GOOD DOGS. DOGS? CARL. YOU KNOW HOW I FEEL ABOUT DOGS. I AM CONFLICTED." } ] }
    ],
    gumgum: [
      { when: { flags: ['quest_sw'] }, lines: [{ who: 'GUMGUM', text: "THANK YOU FOR LISTENING. NOBODY EVER LISTENS. MY MOTHER DIED IN AN ALLEY AND NOBODY CAME. SOMEBODY SHOULD COME." }] },
      { lines: [
        { who: 'GUMGUM', text: "PLEASE. YOU'RE ADVENTURERS. THERE'S SOMETHING OUTSIDE THE GATE YOU NEED TO SEE. YOUR HORNED FRIEND SAID NO. I'M ASKING YOU." },
        { who: 'CARL', text: "LET ME DEAL WITH THE GIANT FUCKING MANTA RAY EVERYBODY KEEPS WARNING ME ABOUT. THEN SHOW ME. I PROMISE." } ] }
    ],
    gumgum_gate: [
      { lines: [
        { who: 'GUMGUM', text: "I'LL KEEP BURYING THEM UNTIL SOMEBODY TELLS ME WHO THEY WERE. GO. ASK QUESTIONS IN TOWN. THE PUB HEARS EVERYTHING." },
        { who: 'CARL', text: "WE'LL FIND OUT WHO DID THIS, GUMGUM. I PROMISE. AND THEN I'M GOING TO BLOW THEM UP." } ] }
    ],
    gossip: [
      { when: { flags: ['quill_dead'] }, lines: [{ who: 'CHICKADEE', text: "THE MAGISTRATE IS DEAD! THE OTHER MAGISTRATE IS YOU! THE RECEPTIONIST IS A CLOUD! PART OF THE CLOUD IS ON MY BALCONY! I HAVE SO MUCH TO TALK ABOUT!" }] },
      { lines: [
        { who: 'CHICKADEE', text: "PSST. NOBODY HAS SEEN THE MAGISTRATE IN YEARS. MISS QUILL SIGNS EVERYTHING. HIS SIGNATURE LOOKS EXACTLY LIKE HERS. FISHY AS SHIT, IF YOU ASK ME." },
        { who: 'CHICKADEE', text: "AND THE MALL GIRLS? THEY PLUCK A FEATHER FROM EVERY SKYFOWL WHO SHOPS THERE. A SOUVENIR, THEY SAY. WHO KEEPS FEATHERS?" } ] }
    ],
    hekla_sq: [
      { when: { flags: ['katia_joined'] }, lines: [{ who: 'HEKLA', text: "KATIA FOUND YOU. GOOD. SHE NEEDS FRIENDS WHO WON'T ASK HER TO BE SOMEONE ELSE. AND YOU, LITTLE PRINCESS, THINK ABOUT MY OFFER. HE CAN'T PROTECT YOU." }] },
      { lines: [
        { who: 'HEKLA', text: "BRYNHILD'S DAUGHTERS HAVE ROOM FOR A PRINCESS. FAME, FRIENDS, A WARRIOR SISTERHOOD. THE MAN CAN COME TOO. AS LUGGAGE. PANTSLESS LUGGAGE." },
        { who: 'DONUT', text: "SHE IS SEVEN FEET TALL AND LOOKS LIKE XENA ATE ANOTHER XENA. CARL, I THINK SHE LIKES ME. EVERYONE LIKES ME, BUT SHE LIKES ME." } ] }
    ],
    burgundy: [
      { lines: [
        { who: 'BURGUNDY', text: "OH. HELLO. I RUN ERRANDS FOR THE MALL. I SHOULDN'T TALK TO YOU. MISS QUILL DOESN'T LIKE IT WHEN WE TALK." },
        { who: 'CARL', text: "ONE BLUE EYE, ONE BROWN. LIKE A HUSKY. SHE LOOKS EXHAUSTED. NOT A STAY-UP-LATE TIRED. A SOMETHING-IS-EATING-ME TIRED." } ] }
    ],
    bautista: [
      { when: { flags: ['glass_broken'] }, lines: [{ who: 'BAUTISTA', text: "THE STAIRWELL, CARL. EAST. I'LL BRING EVERYONE I CAN FIND. YOU CARRY THAT CURSED JAR AND DON'T YOU DARE FUCKING TRIP." }] },
      { lines: [
        { who: 'BAUTISTA', text: "DANIEL BAUTISTA. THE LAST BAUTISTA. YOU FOUND MY SISTER IN THE RUINS. AND YOU TOOK THE ONE WHO PAID FOR HER DEATH. I OWE YOU." },
        { who: 'CARL', text: "SIX FEET OF TIGER, SHIRTLESS, CURVED SWORD. A THUNDERCAT WHO JUST GOT VERY BAD NEWS. HE WANTED TO KILL QUILL HIMSELF. I BLEW HER UP FIRST. OOPS." },
        { who: 'DONUT', text: "HE IS VERY HANDSOME. HE COULD ROUNDHOUSE KICK CHUCK NORRIS INTO NEXT WEEK. I WOULD WATCH THAT SHOW. I WOULD PRODUCE THAT SHOW." } ] }
    ],
    clerk: [
      { when: { flags: ['magistrate'] }, lines: [{ who: 'CLERK', text: "MAGISTRATE CARL. YOUR FORMS ARE ON THE DESK. THE DESK IS IN THE CRATER. SO IS PART OF MISS QUILL. I WILL BRING YOU A NEW DESK." }] },
      { lines: [{ who: 'CLERK', text: "THE MAGISTRATE SEES NO ONE. MISS QUILL SEES EVERYONE AND APPROVES NO ONE. I HAVE BEEN WAITING TO FILE THIS PERMIT FOR NINE GODDAMN YEARS." }] }
    ],
    old_crawler: [
      { lines: [
        { who: 'CRAWLER', text: "I'VE BEEN WAITING BY THIS STAIRWELL FOR TWO DAYS. IT WON'T OPEN. THE AI SAYS IT OPENS WHEN SOMETHING HAPPENS. WHAT THE HELL HAPPENS?" },
        { who: 'CARL', text: "IN MY EXPERIENCE? SOMETHING REALLY FUCKING BAD. STAY CLOSE TO IT." } ] }
    ],
    sealed_stairs: [
      { when: { flags: ['glass_broken'] }, lines: [{ who: 'SYSTEM AI', text: "THE STAIRWELL IS OPEN! BUT YOU ARE NOT IN THE ESCAPE, CRAWLER. GET YOUR ASS BACK TO THE ADMINISTRATIVE DISTRICT AND RUN IT PROPERLY. WITH DRAMA." }] },
      { lines: [{ who: 'SYSTEM AI', text: "SEALED. THIS STAIRWELL OPENS LATER. AT THE WORST POSSIBLE MOMENT, IF WE HAVE ANYTHING TO SAY ABOUT IT. AND WE ALWAYS FUCKING DO." }] }
    ]
  };
})();
/* ==========================================================================
   CINEMA: cutscene scripts (DESIGN 11.3). A shot:
   { bg: 'theme' | 'panel:<id>', night, actors: [{sprite, x, y, flip, frame, anim, moveTo}],
     lines: [{who, text}], wait, shake, flash, wobble, sfx, music, fade }
   Actor x/y = feet (bottom-center) in screen px; the letterbox leaves y 16-164.
   ========================================================================== */
(function () {
  'use strict';
  var D = window.DCW.data;
  var Y = 150;
  function A(sprite, x, o) { var a = { sprite: sprite, x: x, y: Y, anim: 'idle' }; if (o) for (var k in o) a[k] = o[k]; return a; }
  function L(who, text) { return { who: who, text: text }; }
  var AI = 'SYSTEM AI', CARL = 'CARL', DONUT = 'DONUT', MORD = 'MORDECAI';
  // the usual crew standing left of center
  function crew(x, o) {
    o = o || {};
    var out = [A('carl_idle', x), A(o.donutDown ? 'donut_down' : 'donut_shoulder', x - 2, { y: Y - 18 })];
    if (o.donutDown) out[1] = A('donut_down', x + 18);
    if (!o.noMongo) out.push(A(o.bigMongo ? 'mongo_big_idle' : 'mongo_idle', x - 22));
    if (o.katia) out.push(A('katia_idle', x + 22));
    return out;
  }

  D.cinema = {
    /* ---------------- ACT 1 ---------------- */
    arrival: [
      { bg: 'panel:guide_room', music: 'intro', fade: true, wait: 1.5, lines: [
        L(AI, "PREVIOUSLY, ON DUNGEON CRAWLER WORLD: A MAN IN HIS UNDERWEAR AND HIS EX-GIRLFRIEND'S CAT SURVIVED TWO WHOLE FLOORS. THE BOOKIES ARE FUCKED."),
        L(AI, "WELCOME TO THE THIRD FLOOR, CRAWLERS! TODAY YOU PICK A RACE AND A CLASS. CHOOSE WISELY. OR STUPIDLY. STUPID IS SO HOT RIGHT NOW.") ] },
      { bg: 'guide_room', actors: [A('carl_idle', 110), A('donut_idle', 132), A('mongo_idle', 90), A('mordecai', 220, { flip: true })], lines: [
        L(DONUT, "CARL. CARL. WHO IS THAT AND WHY DOES HE HAVE WINGS AND A JAWLINE? HE IS VERY HANDSOME. I DO NOT TRUST IT."),
        L(MORD, "IT'S ME, YOU NITWIT. NEW FLOOR, NEW BODY. THIS TIME I'M AN INCUBUS. LEVEL 50. HORNS, TAIL, THE WHOLE STUPID FUCKING PACKAGE."),
        L(CARL, "YOU LOOK LIKE THE GUY ON THE COVER OF A PAPERBACK MY GRANDMA HID UNDER THE SINK. THE ONE WITH THE PIRATE AND ALL THE HEAVING."),
        L(MORD, "I CAN'T FIGHT. I CAN'T LEAVE THE SAFE ROOMS. I CAN'T TAKE A PISS WITHOUT SOMEBODY TRYING TO CLIMB ON ME. SIT DOWN. PICK YOUR GODDAMN CLASSES.") ] },
      { bg: 'guide_room', actors: [A('donut_idle', 150), A('mordecai', 220, { flip: true })], lines: [
        L(DONUT, "I ALREADY KNOW WHAT I'M PICKING. ODETTE GAVE ME ADVICE. I AM NOT GOING TO TELL YOU WHAT IT WAS. IT IS A SURPRISE."),
        L(MORD, "I HATE SURPRISES. EVERY SURPRISE I'VE HAD IN THIS SHITHOLE HAS TRIED TO KILL ME. THE REST SUCCEEDED.") ] }
    ],

    floor_open: [
      { bg: 'panel:arrival', music: 'village', fade: true, lines: [
        L(AI, "WELCOME TO THE OVER CITY! A FAKE SKY, A RED SUN AND THREE HUNDRED THOUSAND SQUARE KILOMETERS OF RUINS SQUATTING ON A SLEEPING VOLCANO."),
        L(AI, "THE MONSTERS ARE THE CHILDREN OF A POISON CATACLYSM. THE VILLAGES ARE SAFE BY DAY. BY NIGHT, YOU ARE SNACKS. HAVE A GREAT FUCKING FLOOR!"),
        L(CARL, "PRIMAL COMPENSATED ANARCHIST. I DON'T KNOW WHAT EITHER OF THOSE MEANS. I KNOW WHAT THE BOMBS MEAN. THE BOMBS MEAN SHIT BLOWS UP.") ] }
    ],

    tour: [
      { bg: 'village', fade: true, actors: crew(80).concat([A('mordecai', 150, { flip: true })]), lines: [
        L(MORD, "FIRST VILLAGE OF THE FLOOR. NO NAME. THEY DON'T GET NAMES UNTIL SOMEBODY KILLS THE MAYOR. DON'T KILL THE MAYOR. I CAN SEE YOU THINKING ABOUT IT."),
        L(MORD, "SEE THE GUYS IN PLATE? VILLAGE GUARD SWORDSMEN. LEVEL 75. NO JAIL HERE. HIT A CITIZEN, ROB A SHOP, PASS OUT DRUNK IN THE STREET: DEATH. NO APPEALS."),
        L(CARL, "PASSING OUT DRUNK IS A CAPITAL CRIME? HOW THE HELL ARE YOU STILL ALIVE?"),
        L(MORD, "I DO MY PASSING OUT INDOORS. LIKE A PROFESSIONAL. FACE DOWN, DOOR LOCKED, CHAIR UNDER THE KNOB SO NOBODY CRAWLS INTO BED WITH ME.") ] },
      { bg: 'village', actors: crew(80).concat([A('mordecai', 150, { flip: true }), A('guard_walk', 250, { flip: true })]), lines: [
        L(MORD, "RUN INTO THE RUINS AND THE GUARDS WON'T CHASE YOU. BUT THAT VILLAGE IS CLOSED TO YOU FOREVER. AT NIGHT THEY GO HOME TO THEIR DEPOT AND RECHARGE."),
        L(MORD, "NIGHT IS WHEN THE STREET URCHINS COME OUT. JANITOR MOBS. LEAVE THEIR TRASH ALONE AND THEY LEAVE YOU ALONE. TOUCH THEIR TRASH AND THEY SKIN YOU."),
        L(CARL, "MY ESCAPE PLAN SKILL JUST LIT UP. STAIRS, SIX KILOMETERS EAST. A MEDIUM SKYFOWL SETTLEMENT, THIRTY-FOUR KILOMETERS."),
        L(MORD, "WE GO TO THE SETTLEMENT. BETTER SHOPS, BETTER GEAR, BETTER BOOZE. MOSTLY THE BOOZE. GO. I'LL MEET YOU AT THE PUG. TRY NOT TO DIE, DUMBASS.") ] }
    ],

    notice_board: [
      { bg: 'village', lines: [
        L('NOTICE', "BY ORDER OF THE VILLAGE: NO STEALING. NO STABBING. NO PUBLIC DRUNKENNESS. NO NUDITY ABOVE THE WAIST. VIOLATORS WILL BE EXECUTED POLITELY."),
        L(CARL, "ABOVE THE WAIST. I'M FINE. I'M TOTALLY FINE. BELOW THE WAIST IS APPARENTLY THE WILD FUCKING WEST."),
        L('NOTICE', "LOST: ONE LEMUR. ANSWERS TO STABBY. DO NOT APPROACH STABBY. DO NOT RETURN STABBY. WE ARE GLAD STABBY IS GONE. STABBY IS AN ASSHOLE."),
        L('NOTICE', "THE CIRCUS IS IN TOWN! THE CIRCUS IS ALWAYS IN TOWN! PLEASE STOP ASKING WHEN THE CIRCUS IS LEAVING!") ] }
    ],

    lemurs_after: [
      { bg: 'ruins', actors: crew(140), sfx: 'fanfare', lines: [
        L(AI, "NEW QUEST! THE SHOW MUST GO ON! A CIRCUS SURVIVED THE END OF THE WORLD AND KEPT TOURING. NOW IT BUTCHERS EVERY TOWN IT VISITS. FIND OUT WHY. SHUT IT DOWN."),
        L(DONUT, "A CIRCUS! CARL, I HAVE ALWAYS WANTED TO SEE A CIRCUS. I HAVE ALWAYS WANTED TO BE IN A CIRCUS. AS THE STAR."),
        L(CARL, "THE LEMURS WORE HUMAN SKULLS, DONUT. THE CLOWN WAS ELEVEN FEET TALL. WE ARE ALREADY IN THE FUCKING CIRCUS."),
        L(CARL, "LET'S GET TO THAT INN. I NEED TO SIT DOWN SOMEWHERE THAT ISN'T TRYING TO STAB ME IN THE ASS.") ] }
    ],

    pug_vomit: [
      { bg: 'inn_pug', fade: true, music: 'inn', actors: crew(90).concat([A('gordo', 230, { flip: true })]), lines: [
        L('GORDO', "WELCOME TO THE BELLY-RUBBED PUG. TEN GOLD A NIGHT. YES, YOU HAVE TO PAY NOW. THE SHOW SAYS IT'S CHARACTER BUILDING."),
        L(DONUT, "IT SMELLS LIKE A SWAMP IN HERE. A SWAMP? CARL. YOU KNOW HOW I FEEL ABOUT SWAMPS."),
        L('GORDO', "THAT'S ME. BOPCA. WET MOSS. IT'S GLANDULAR. DON'T LOOK AT THE GLANDS.") ] },
      { bg: 'inn_pug', sfx: 'teleport', flash: '#f8b8f8', actors: crew(90).concat([A('gordo', 230, { flip: true }), A('mordecai', 160, { flip: true })]), lines: [
        L(MORD, "THERE THEY ARE. MY CLIENTS. MY BELOVED FUCKING CLIENTS WHO LOCKED ME INTO A CONTRACT. I HAVE BEEN DRINKING. FOR CONTEXT. SINCE NOON."),
        L(MORD, "I HAD A WHOLE SPEECH. ABOUT ELITES. AND THE CIRCUS. AND HOW YOU NEED A PLAN THAT ISN'T PUNCHING. HOLD ON. HOLD ON. OH SHIT.") ] },
      { bg: 'inn_pug', shake: 0.3, sfx: 'drunk_hiccup', wobble: 3, actors: crew(90).concat([A('gordo', 230, { flip: true })]), lines: [
        L(CARL, "HE THREW UP. HE THREW UP AND THEN HE LAY DOWN IN IT. HE'S ASLEEP. IN IT. AND THE BARMAID JUST SLIPPED HER ROOM KEY INTO HIS POCKET."),
        L('GORDO', "HE DOES THAT. I'LL GET THE MOP. HE LEFT YOU SOME MOONSHINE. TWO JUGS. HE SAID SOMETHING ABOUT JUGS O'BOOM BEFORE HIS FACE HIT THE FLOOR."),
        L(DONUT, "THIS IS MY MANAGER. THIS IS WHO NEGOTIATES MY CAREER. HE IS SNORING IN HIS OWN SICK. CARL, I HAVE MADE A TERRIBLE MISTAKE.") ] }
    ],

    bodies_after: [
      { bg: 'ruins', actors: crew(120), lines: [
        L(CARL, "THREE OF THEM. GRACE, NICA, LEA. THEY WERE HEADING FOR THE CIRCUS. THEY DIDN'T MAKE IT. SOMETHING DRAGGED THE REST OF THEIR PARTY OFF IN PIECES."),
        L(DONUT, "I TOOK THE ANKLET OFF GRACE. IT'S ENCHANTED. IT'S ALSO VERY PRETTY, WHICH IS NOT WHY I TOOK IT. IT IS A LITTLE BIT WHY I TOOK IT."),
        L(CARL, "TWO RINGS OF PLUS TWO STRENGTH FROM NICA. I'M SORRY, NICA. I'M GOING TO PUNCH SOMETHING SO FUCKING HARD IN YOUR HONOR."),
        L(CARL, "THERE'S AN EMPTY TENEMENT ACROSS FROM THE CIRCUS. WE GO UP, WE WATCH, WE LEARN. NOBODY DOES ANYTHING STUPID.") ] }
    ],

    circus_spy: [
      { bg: 'panel:circus_night', music: 'circus', fade: true, lines: [
        L(AI, "SUNDOWN AT GRIMALDI'S TRAVELING CIRCUS! THE CLOWNS ARE STRETCHING. THE LIONS ARE MOLDING. THE CAULDRONS ARE GOING INTO MORTARS. FOR FUN! FOR YOU!"),
        L(CARL, "THEY'RE LINING UP. LIKE A SHOW. LIKE A PARADE GETTING READY TO GO OUT AND EAT THE NEIGHBORHOOD."),
        L(DONUT, "CARL. THE BIG POT ON THE WHEELS IS POINTING AT US. WHY IS IT POINTING AT US. CARL. CARL!") ] },
      { bg: 'ruins', night: true, shake: 1.2, flash: '#f83800', sfx: 'explosion', lines: [
        L(CARL, "MORTARS! EVERYBODY DOWN! NO, NOT THAT DOWN! THE OTHER DOWN! OH, FUCK, THE FLOOR IS GOING!"),
        L(AI, "THE TENEMENT IS COMING DOWN! FLOOR BY FLOOR! WITH YOU INSIDE IT! FIGHT YOUR WAY TO THE BASEMENT BEFORE THE CEILING TURNS YOU INTO A PANCAKE!") ] }
    ],

    signet_meet: [
      { bg: 'basement', night: true, fade: true, actors: crew(90).concat([A('signet', 220, { flip: true })]), lines: [
        L(CARL, "WE FELL SIX FLOORS AND LANDED IN A BASEMENT. THERE'S A WOMAN IN THE BASEMENT. SHE'S WEARING A THONG. JUST THE THONG. EYES UP, CARL. EYES. UP."),
        L('SIGNET', "TSARINA SIGNET. HALF NAIAD, HALF HIGH ELF, ALL OF ME ON DISPLAY. AND YOU ARE THE ONES WHO HAVE BEEN WALKING AROUND MY CIRCUS LIKE YOU OWN IT."),
        L(DONUT, "A THONG? CARL. YOU KNOW HOW I FEEL ABOUT THONGS. THAT IS NOT AN OUTFIT. THAT IS A CRY FOR ATTENTION, AND I WOULD KNOW.") ] },
      { bg: 'panel:signet_tattoos', lines: [
        L(AI, "AN ELITE! LEVEL 60! THE TATTOOS MOVE. SEA SERPENTS, ONI, SHARKS AND DRAGONS CRAWLING OVER EVERY BARE INCH OF HER. THEY ARE NOT DECORATION. THEY ARE HER ARMY.") ] },
      { bg: 'panel:signet_full', lines: [
        L(AI, "AND YES, VIEWERS, EVERY INCH IS BARE. THE CHAT JUST CRASHED. THREE STAR SYSTEMS HAVE REQUESTED A SLOWER PAN. REQUEST GRANTED."),
        L(CARL, "EYES. I AM LOOKING AT HER EYES. HER EYES ARE UP THERE. I KNOW EXACTLY WHERE HER EYES ARE AND THAT IS WHERE I AM LOOKING.") ] },
      { bg: 'basement', night: true, wobble: 1.5, flash: '#f878f8', sfx: 'fear',
        actors: crew(90).map(function (a) { return a.sprite === 'carl_idle' ? A('carl_charmed', 90) : a; }).concat([A('signet', 200, { flip: true })]), lines: [
        L('SIGNET', "COME HERE, LITTLE CRAWLER. LET ME HAVE A LOOK AT YOU. ALL OF YOU. MY, MY. SOMEBODY IS HAPPY TO SEE ME."),
        L(AI, "CHARISMA EFFECT! A LEVEL 60 ELITE IN A THONG VERSUS A MAN IN MAGIC UNDERWEAR. THE UNDERWEAR IS LOSING. THE UNDERWEAR IS RISING TO THE OCCASION."),
        L(CARL, "MY HEAD IS FOGGY. SHE'S CHARMING ME. I WANT TO AGREE WITH WHATEVER SHE SAYS NEXT. AND SOMETHING DOWN THERE AGREES EVEN HARDER. OH NO. OH FUCK.") ] },
      { bg: 'panel:carl_tent', shake: 0.6, sfx: 'pickup', lines: [
        L(DONUT, "CARL! PUT THAT THING AWAY!"),
        L(DONUT, "A CIRCUS TENT? IN YOUR BOXERS? CARL. YOU KNOW HOW I FEEL ABOUT CIRCUS TENTS. MONGO, DON'T LOOK! MONGO! I SAID DON'T LOOK!"),
        L(AI, "CLOSE-UP! WE NEED A BIGGER CAMERA! THE BIGBOI BOXERS WERE BUILT FOR A HULK AND THE SEAMS ARE STILL SCREAMING! THE RATINGS JUST WENT VERTICAL. SO DID CARL."),
        L(AI, "ENGINEERING UPDATE: BIGBOI BOXER STRUCTURAL INTEGRITY AT 61 PERCENT AND FALLING. THE TENT POLE IS HOLDING. THIS IS THE GREATEST NIGHT OF MY LIFE.") ] },
      { bg: 'basement', night: true, wobble: 1, actors: crew(90).map(function (a) { return a.sprite === 'carl_idle' ? A('carl_charmed', 90) : a; }).concat([A('signet', 200, { flip: true })]), lines: [
        L(CARL, "THAT'S NOT ME. THAT'S A SPELL. THAT IS A FUCKING STATUS EFFECT. I WANT THAT ON THE GODDAMN RECORD."),
        L('SIGNET', "OH, IT'S ON THE RECORD, LITTLE CRAWLER. IT'S ON EVERY SCREEN IN THE GALAXY. FROM SEVERAL ANGLES. IT IS A VERY FLATTERING STATUS EFFECT."),
        L(CARL, "OKAY. OKAY. MY OWN BODY IS TRYING TO GET ME KILLED ON TELEVISION. THIS IS GOING TO HURT. THIS IS GOING TO HURT SO FUCKING MUCH.") ] },
      { bg: 'basement', night: true, shake: 0.2, sfx: 'crit', actors: crew(90).concat([A('signet', 220, { flip: true })]), lines: [
        L(DONUT, "CARL! YOU BROKE YOUR OWN FINGER! YOU JUST GRABBED IT AND SNAPPED IT LIKE A BREADSTICK!"),
        L(CARL, "FUCK! FUCK! FUCK! OKAY. PAIN BEATS CHARM. LEARNED THAT FROM AN EX. NOT THAT EX. A DIFFERENT EX. AND IT WORKED. EVERYTHING IS STANDING DOWN."),
        L('SIGNET', "CLEVER. AND A LITTLE DISAPPOINTING. I LIKE CLEVER. LET'S SEE IF CLEVER CAN SURVIVE MY KITTENS. THEY ARE A LITTLE MOLDY."),
        L(AI, "ACHIEVEMENT TERRITORY! YOUR FIRST ELITE! ELITES NOW SHOW ON YOUR MAP WITH A BLACK CROSS. LIKE A HOSPITAL. OR A GRAVE. OR A VERY AWKWARD MEMORY.") ] }
    ],

    knockout: [
      { bg: 'basement', night: true, actors: crew(110).concat([A('signet', 240, { flip: true })]), lines: [
        L('SIGNET', "SIX LIONS, AND YOU'RE STILL BREATHING. THAT WAS NOT THE PLAN, LITTLE CRAWLER. MY SPELL NEEDED YOU NOT BREATHING. PITY. YOU'RE PRETTIER ALIVE."),
        L(CARL, "SORRY TO DISAPPOINT. DONUT, MONGO, WE'RE LEAVING. RIGHT NOW. WALK, DON'T RUN. DON'T LOOK AT THE TATTOOS. DON'T LOOK AT ANY OF IT.") ] },
      { bg: 'basement', night: true, flash: '#ffffff', shake: 0.8, sfx: 'hurt', wobble: 4, lines: [
        L(CARL, "SOMETHING HIT ME. I DIDN'T SEE IT. I DIDN'T SEE ANYTHING. THE FLOOR IS COMING UP VERY FAST. OH, YOU SON OF A BITCH."),
        L(AI, "ACHIEVEMENT! LAZARUS! A SPELL ABOVE LEVEL 15 TO THE FACE, AND YOU LIVED. LIKE THE BIG GUY IN THAT RABBIT BOOK, YOU NEVER SAW IT COMING. UNLIKE HIM, YOU GOT UP.") ] },
      { bg: 'basement', night: true, fade: true, actors: [A('carl_hurt', 80), A('donut_down', 150), A('mongo_idle', 260, { flip: true }), A('cage', 260)], lines: [
        L(AI, "FIFTEEN HOURS LATER..."),
        L(CARL, "DONUT IS FLOATING IN A GIANT WATER LILY, ASLEEP AND DROOLING. MONGO IS IN A CAGE AND HE IS NOT HAPPY ABOUT IT. NEITHER AM I. MY HEAD FEELS LIKE SHIT.") ] },
      { bg: 'panel:signet_tattoos', lines: [
        L('SIGNET', "GRIMALDI FOUND ME WHEN I WAS SMALL. HE GAVE ME A HOME IN THE CIRCUS. HE RAISED ME. LATER, HE WAS THE MAN I LOVED. YES. IT IS A COMPLICATED STORY."),
        L('SIGNET', "THEN THE POISON CAME AND MADE HIM A VINE IN THE CENTER RING. HE BANISHED ME. HE KEEPS EVERYONE ELSE, EVERY CLOWN, FOREVER. NOT ME."),
        L('SIGNET', "I NEED BLOOD FOR A SUMMONING. HEATHER THE BEAR'S BLOOD. SHE IS OLD AND MAD AND SHE HUNTS AT NIGHT. YOU WILL KILL HER FOR ME, HANDSOME."),
        L(CARL, "AND IF I TELL YOU TO GO FUCK YOURSELF?"),
        L('SIGNET', "THEN YOUR CAT KEEPS SLEEPING. FOREVER. SHE LOOKS SO PEACEFUL. AND YOU KEEP STARING SO VERY HARD AT MY FACE. GO ON. GO.") ] }
    ],

    solo_after: [
      { bg: 'basement', night: true, actors: [A('carl_idle', 120), A('mongo_idle', 150, { flip: true }), A('donut_down', 210)], lines: [
        L(CARL, "MONGO. BUDDY. LISTEN TO ME. YOU STAY HERE. YOU GUARD DONUT. NOBODY TOUCHES HER. ESPECIALLY YOU. NO BITING HER NOSE."),
        L('MONGO', "MREEP."),
        L(CARL, "I'M TAKING THAT AS A YES. THE BEAR IS OUT THERE. I'M GOING TO GO PUNCH A FUCKING BEAR. ALONE. ON CAMERA. THIS IS MY LIFE NOW.") ] }
    ],

    heather_intro: [
      { bg: 'panel:heather_skates', music: 'heather', fade: true, sfx: 'skate_roll', lines: [
        L(AI, "HEATHER THE ROLLER-SKATING BEAR! A STAR ATTRACTION FOR FORTY YEARS. NOW SHE HUNTS FOR THE CIRCUS AND DRAGS HOME WHATEVER SHE CATCHES. IN PIECES."),
        L(CARL, "A BEAR WITH A FLAMING SKULL FOR A FACE, ON ROLLER SKATES. IT CAN'T BE REASONED WITH. IT CAN'T BE BARGAINED WITH. AND IT'S DOING A FUCKING TRIPLE AXEL."),
        L(AI, "SHE IS FASTER THAN YOU! KEEP MOVING! IF SHE CATCHES YOU, SHE THROWS YOU! IF SHE THROWS YOU, LAND ON SOMETHING SOFT! THERE IS NOTHING SOFT!") ] }
    ],

    heather_down: [
      { bg: 'circus', night: true, actors: [A('carl_idle', 110), A('heather_hurt', 210, { flip: true })], lines: [
        L(CARL, "THE TICKET CAME UP CUSTARD. CUSTARD. I THREW CUSTARD AT A FUCKING BEAR. AND IT HEALED HER. THE WORMS ARE FALLING OUT OF HER. THEY'RE DYING."),
        L(CARL, "SHE'S JUST A BEAR NOW. AN OLD BEAR. SHE'S TIRED. SHE'S STILL DYING, BUT SHE'S NOT HURTING ANYMORE. NOT LIKE BEFORE."),
        L(CARL, "I'M SORRY, HEATHER. I'LL MAKE IT QUICK.") ] },
      { bg: 'circus', night: true, sfx: 'teleport', flash: '#d82800', actors: [A('carl_idle', 110), A('signet', 220, { flip: true })], lines: [
        L('SIGNET', "HER BLOOD. AT LAST. RISE, MY ELEMENTALS. BLOOD AND INK."),
        L('SIGNET', "YOU DID WELL, CRAWLER. TAKE THIS. A BIG TOP TICKET. TONIGHT YOU WALK INTO HIS TENT AND TALK TO HIM FOR ME. TRY TO KEEP YOUR MIND ON THE TALKING."),
        L(CARL, "ZEV IS MESSAGING ME. THE PRODUCERS OF SIGNET'S STORYLINE WANT A WORD. VENGEANCE OF THE DAUGHTER. IT'S A SOAP OPERA. I'M IN A FUCKING SOAP OPERA.") ] }
    ],

    bigtop_gate: [
      { bg: 'circus', night: true, fade: true, music: 'bigtop', actors: [A('carl_idle', 100), A('fat_clown_walk', 200, { flip: true })], lines: [
        L('CLAMMY', "TICKET. TICKET, TICKET, TICKET. NO TICKET, NO SHOW. NO SHOW, NO LEAVING. NO LEAVING, CLAMMY EATS. CLAMMY EATS THE SOFT PARTS FIRST."),
        L(CARL, "HERE. BIG TOP TICKET. ADMIT ONE. PLEASE STOP SMILING AT ME. HOW MANY GODDAMN TEETH DO YOU HAVE?"),
        L('CLAMMY', "ALL OF THEM.") ] },
      { bg: 'circus', night: true, actors: [A('carl_idle', 100), A('apollon', 210, { flip: true })], lines: [
        L('APOLLON', "APOLLON THE MIGHTY! STRONGEST MAN IN THE OVER CITY! ICE CREAM? IT'S WORMS. ALL THE FLAVORS ARE WORMS. THE CHERRY ON TOP IS ALSO A WORM."),
        L(CARL, "THE TENT SMELLS LIKE POPCORN AND SAWDUST. MY DAD TOOK ME TO RINGLING ONCE. HE BOUGHT ME COTTON CANDY AND DIDN'T YELL ONCE. ONE DAY. I KEEP THAT ONE."),
        L(CARL, "MORDECAI'S PLAN: POISON MY OWN BLOOD, DRIP IT ON THE ROOTS, STAY ALIVE. BREAK THE TENT POLES SO THE CENTER RING OPENS UP. EASY. TOTALLY FUCKING EASY.") ] }
    ],

    grimaldi_deal: [
      { bg: 'panel:bigtop_vine', sfx: 'worm_squish', lines: [
        L(AI, "RINGMASTER GRIMALDI IS WILTING! THE POISON IS IN THE ROOTS! THE CITY BOSS IS ROTTING FROM THE INSIDE, AND IT SMELLS INCREDIBLE!"),
        L('ZEV', "CARL! CARL. THE VENGEANCE OF THE DAUGHTER PRODUCERS ARE SCREAMING AT ME. GRIMALDI IS THEIR STAR. YOU'RE KILLING THEIR STAR ON A TUESDAY, YOU ASSHOLE."),
        L(CARL, "TELL THEM I'VE GOT A BETTER EPISODE. THE BANISHED BRIDE, THE TEARFUL REUNION. LIKE GERALDO OPENING THAT VAULT, EXCEPT THIS TIME SOMETHING'S INSIDE."),
        L('ZEV', "THEY SAY YES. ON ONE CONDITION. YOU APPEAR IN THEIR SHOW ON THE SIXTH FLOOR. LATER. WHEN THEY CALL. OH, AND YOU HAVE TO KEEP HIM ALIVE NOW.") ] },
      { bg: 'circus', night: true, actors: [A('carl_idle', 100), A('apollon', 210, { flip: true })], lines: [
        L(CARL, "WISP ARMOR. READ THE BOOK, CAST IT, NO MIND CONTROL. THEN I EAT THE WORM ICE CREAM SO THE VINE CAN TALK TO ME. I MADE THIS PLAN. I HATE THIS PLAN."),
        L('APOLLON', "ONE SCOOP OF WORM! WITH WORM SPRINKLES! SWALLOW, LITTLE MAN! DON'T CHEW! THEY HATE BEING CHEWED!"),
        L(CARL, "IT'S WIGGLING ON THE WAY DOWN. IT'S STILL WIGGLING. OH GOD. OH FUCK. IT'S WIGGLING IN MY STOMACH.") ] },
      { bg: 'panel:bigtop_vine', wobble: 3, lines: [
        L('GRIMALDI', "SON. YOU WALKED INTO MY RING WITH POISON IN YOUR VEINS. NOBODY HAS DONE THAT IN THREE HUNDRED YEARS. I THINK I LIKE YOU."),
        L(CARL, "SIGNET. YOU BANISHED HER. SHE STILL LOVES YOU. EVERYBODY ELSE YOU KEEP. HER YOU THREW OUT. WHY?"),
        L('GRIMALDI', "BECAUSE SHE WAS THE ONLY ONE WHO COULD STILL LEAVE. I WANTED ONE OF MY CHILDREN TO HAVE A LIFE. BRING HER IN. I WILL LET HER GO PROPERLY.") ] },
      { bg: 'panel:grimaldi_peace', sfx: 'fanfare', music: 'sad', lines: [
        L(AI, "THE ANTIDOTE IS IN! THE VINE IS HEALING! THE TOPLESS LADY IS WEEPING! THE CLOWNS ARE CONFUSED! THE PRODUCERS ARE THRILLED! QUEST COMPLETE, MOTHERFUCKERS!"),
        L(AI, "THE SHOW MUST GO ON: COMPLETE! A GOLD QUEST BOX! AND A FAT, GREASY PILE OF EXPERIENCE. LEVEL UP. LEVEL UP. LEVEL UP. DING DING DING!"),
        L(CARL, "WAIT. WHAT TIME IS IT? HOW LONG HAVE I BEEN IN HERE? DONUT. OH SHIT. DONUT'S BACK IN THE RUINS WITH ONLY MONGO.") ] }
    ],

    barricade_intro: [
      { bg: 'ruins', night: true, fade: true, music: 'ruins_night', actors: [A('donut_down', 80), A('mongo_idle', 110), A('carl_idle', 150), A('street_urchin_walk', 250, { flip: true }), A('street_urchin_walk', 280, { flip: true })], lines: [
        L(CARL, "URCHINS. DOZENS OF THEM. THEY ROLLED RIGHT OVER WHATEVER MONGO STACKED IN FRONT OF HER. DONUT'S AT ZERO HIT POINTS. ZERO. SHE'S STILL BREATHING. JESUS."),
        L(AI, "PRINCESS DONUT'S COCKROACH SKILL ACTIVATED! SHE SURVIVED A HIT THAT SHOULD HAVE SPLATTERED HER! SHE IS VERY UNCONSCIOUS AND VERY ALIVE!"),
        L(CARL, "OKAY, MONGO. BARRICADE. HOLD THE LINE UNTIL SUNRISE. NOTHING GETS PAST US. NOTHING TOUCHES THE CAT. NOT ONE FUCKING TUMBLEWEED.") ] }
    ],

    dawn: [
      { bg: 'circus', fade: true, music: 'village', actors: crew(120), lines: [
        L(DONUT, "WHY AM I DIRTY. WHY IS MONGO COVERED IN TUMBLEWEED. CARL, WHY ARE YOU CRYING."),
        L(CARL, "I'M NOT CRYING. THE SUN'S IN MY EYES. THE FAKE SUN. IT'S VERY BRIGHT. HOW ARE YOU FEELING?"),
        L(DONUT, "LIKE I WAS HIT BY A TRUCK AND THEN THE TRUCK WAS HIT BY A HOUSE. DID I MISS ANYTHING?") ] },
      { bg: 'circus', actors: crew(120).concat([A('stairs_down', 240)]), lines: [
        L(AI, "THE CIRCUS IS GONE! THE TENTS, THE WAGONS, THE CALLIOPE, ALL GONE AT DAWN! AND WHAT DO WE HAVE HERE? A STAIRWELL TO THE FOURTH FLOOR! TEMPTING!"),
        L(CARL, "LAST NIGHT, BEFORE YOU WENT DOWN, YOU FIRED A MISSILE RIGHT AFTER I SCARED THAT LION. IT DIDN'T EVEN FLINCH. LET'S MAKE THAT A THING. A PLAY."),
        L(DONUT, "A PLAY! LIKE THE A-TEAM! I'LL BE THE ONE WHO DRIVES THE VAN. WHAT DO WE CALL IT?"),
        L(CARL, "PANIC. I CAST FEAR, YOU SHOOT WHATEVER'S RUNNING. WE'RE GOING TO NEED A WHOLE PLAYBOOK. OF REALLY STUPID SHIT."),
        L(MORD, "(OVER THE CHAT) THE STAIRS AREN'T GOING ANYWHERE. THE SETTLEMENT IS EAST. GET STRONGER FIRST. THEN THINK ABOUT STAIRS. AND BUY ME A FUCKING DRINK.") ] }
    ],

    /* ---------------- ACT 2 ---------------- */
    settlement_arrival: [
      { bg: 'panel:settlement_view', music: 'settlement', fade: true, lines: [
        L(AI, "THE MEDIUM SKYFOWL SETTLEMENT! WALLS, TOWERS AND A WHOLE LOT OF EAGLE PEOPLE WHO THINK YOUR BARE FEET ARE OBSCENE. THEY ARE. WE LOVE THEM."),
        L(DONUT, "SHOPS, CARL. REAL SHOPS. A WHOLE STREET OF THEM. I AM GOING TO NEED AN ALLOWANCE.") ] },
      { bg: 'inn_narwhal', music: 'inn', actors: crew(90).concat([A('fitz', 230, { flip: true }), A('mordecai', 170, { flip: true })]), lines: [
        L('FITZ', "ONE-EYED NARWHAL. FOUR ROOMS. TWENTY GOLD. SKYFOWL DRINK UPSTAIRS, YOU DRINK DOWN HERE. NO OFFENSE. AND I'LL KEEP MY BARMAIDS OFF YOUR INCUBUS."),
        L(MORD, "QUEST BOXES. OPEN THEM. NOW. BEFORE YOU DO ANYTHING DUMB IN A TOWN WITH THIS MANY GUARDS. AND SOMEBODY GET THIS GODDAMN BARMAID OFF MY LAP.") ] },
      { bg: 'inn_narwhal', sfx: 'lootbox_open', flash: '#f8b800', actors: crew(90).concat([A('mordecai', 170, { flip: true })]), lines: [
        L(AI, "A SCROLL OF UPGRADE! APPLIED TO YOUR ENCHANTED BIGBOI BOXERS! LIKE A CERTAIN GREEN SCIENTIST'S SHORTS, THEY WILL NEVER TEAR. AND NOW: FREEBALLING!"),
        L(AI, "FREEBALLING: EVERY ATTACK BELOW THE WAIST DOES DOUBLE DAMAGE. KICKS! STOMPS! KNEES! RESTRICTION: ONE LAYER OVER YOUR DICK. NO PANTS. EVER. AS IF."),
        L(CARL, "I WAS NEVER GOING TO WEAR PANTS AGAIN ANYWAY. MY BALLS ARE NOW A WEAPON SYSTEM. I'M AT PEACE WITH IT."),
        L(DONUT, "MONGO GOT FANG CAPS! THEY CLICK ON LIKE LEGO! NOW HE CAN BITE GHOSTS! AND I CAN HEAR EVERYTHING NOW. CARL, YOUR STOMACH IS VERY LOUD. SO IS MORDECAI.") ] },
      { bg: 'inn_narwhal', sfx: 'achievement', actors: crew(90).concat([A('mordecai', 170, { flip: true })]), lines: [
        L(AI, "ACHIEVEMENT! ONE QUADRILLION! AMONG THE FIRST TEN CRAWLERS PAST A QUADRILLION VIEWS! A GOLD FAN BOX! A QUADRILLION PEOPLE HAVE SEEN YOUR ASS!"),
        L(MORD, "AND A PILE OF EXPLOSIVES FROM THE QUEST. DYNAMITE AND HOB-LOBBERS. TRY NOT TO BLOW UP THE INN. FITZ HAS ALREADY STARTED A TAB FOR ME. A BIG ONE.") ] }
    ],

    gumgum_ask: [
      { bg: 'inn_narwhal', actors: crew(80).concat([A('mordecai', 150), A('gumgum', 230, { flip: true })]), lines: [
        L('GUMGUM', "YOU'RE ADVENTURERS. I CAN TELL. PLEASE. THERE ARE WOMEN BEING KILLED IN THIS TOWN AND NOBODY CARES. I NEED SOMEBODY TO CARE."),
        L(MORD, "SCRAM, LADY. THEY'RE NOT TAKING ANY MORE QUESTS ON THIS FLOOR. GO ON. OUT."),
        L(CARL, "MORDECAI, SHE'S ASKING FOR HELP. WHAT THE FUCK?"),
        L(MORD, "KID. THE PEOPLE RUNNING THIS SHOW KNOW EXACTLY WHO YOU ARE. EVERY SAD STORY IS A HOOK, AND YOU ARE A FISH THAT WANTS TO BE CAUGHT.") ] },
      { bg: 'inn_narwhal', actors: crew(80).concat([A('mordecai', 150)]), lines: [
        L(MORD, "YOU CAN'T SAVE EVERYBODY. YOU WANT TO HELP PEOPLE? GET STRONG. GET DEEP. STAY ALIVE. THAT'S THE ONLY HELP THAT LASTS IN THIS SHITHOLE."),
        L(CARL, "THERE'S A BIG MANTA RAY BOSS AT THE OLD Y ON THE EAST ROAD. I'M GOING TO GO KILL IT. AND THEN I'M GOING TO TALK TO HER. DEAL WITH IT."),
        L(MORD, "OF COURSE YOU ARE. GODDAMN BOY SCOUT.") ] }
    ],

    dispenser_down: [
      { bg: 'ymca', actors: crew(120).concat([A('mongo_clock_run', 220), A('mongo_clock_run', 250)]), sfx: 'fanfare', lines: [
        L(AI, "THE BOOMY BOY! TWO CLOCKWORK DINOSAURS, TWO STICKS OF DYNAMITE, ONE MANTA RAY TURNED INSIDE OUT! THE WHOLE GALAXY IS SAYING IT. BOOMY! FUCKING! BOY!"),
        L(DONUT, "I NAMED IT. TELL THEM I NAMED IT. CARL. CARL, TELL THEM."),
        L(CARL, "SHE NAMED IT.") ] }
    ],

    gumgum_bodies: [
      { bg: 'settlement', fade: true, music: 'sad', actors: crew(90).concat([A('gumgum', 200, { flip: true })]), lines: [
        L('GUMGUM', "OUTSIDE THE GATE. EVERY MORNING. MORE OF THEM. NOBODY KNOWS WHO THEY ARE. NOBODY CLAIMS THEM. I BURY THEM. NOBODY HELPS ME BURY THEM."),
        L(CARL, "FIFTEEN. MAYBE MORE. ALL WOMEN. ALL DEAD, DUMPED OUTSIDE THE WALL LIKE TRASH. SOMETHING'S BEEN DRINKING FROM THEM. JESUS CHRIST."),
        L(AI, "NEW QUEST! THE SEX WORKERS WHO FELL FROM THE HEAVENS! BODIES EVERY DAWN, AND NOBODY IN THIS TOWN GIVES A SHIT WHERE THEY COME FROM. FIND OUT WHY."),
        L(DONUT, "WE ARE DOING THIS ONE, CARL. I DON'T CARE WHAT MORDECAI SAYS. HE WORKS FOR ME NOW. AND HE CAN KISS MY FLUFFY ASS.") ] }
    ],

    desperado_tour: [
      { bg: 'settlement', night: true, actors: crew(80).concat([A('mordecai', 150, { flip: true })]), lines: [
        L(MORD, "FINE. IF YOU'RE DOING THIS, DO IT PROPERLY. WITH THE RIGHT GEAR. COME ON. THROUGH THE PUB. THE RED DOOR IN THE BACK. KEEP YOUR HANDS IN THE BOAT.") ] },
      { bg: 'panel:desperado', music: 'club', fade: true, lines: [
        L(AI, "THE DESPERADO CLUB! MEMBERS ONLY! THE SAME CLUB BEHIND EVERY PUB DOOR ON THE FLOOR! BOOZE, DRUGS, DANCING AND REGRET! SO FUN IT HURTS! LITERALLY!"),
        L(CARL, "RAIN INDOORS. NEON EVERYWHERE. A GIANT SPINNING DAGGER. A GUY GETTING A LAP DANCE FROM SOMETHING WITH SIX ARMS. BLADE RUNNER IN A VEGAS STRIP CLUB."),
        L('CLARABELLE', "PETS GO IN THE PLAYROOM. THE PLAYROOM IS NOT SAFE. THAT IS WHY IT IS CALLED THE PLAYROOM. NO REFUNDS ON PETS.") ] },
      { bg: 'club', actors: [A('carl_idle', 90), A('mordecai', 130), A('quint', 230, { flip: true })], lines: [
        L('QUINT', "PHARMACY. QUINT. MORDECAI. YOU LOOK LIKE A BOOK COVER. A DIRTY ONE."),
        L(CARL, "THAT VOICE. GRAVEL IN A BLENDER. HE SOUNDS LIKE BATMAN. I'M NOT GOING TO SAY IT. I'M ABSOLUTELY GOING TO SAY IT LATER."),
        L(MORD, "A STARTER ALCHEMY KIT, QUINT. AND A BOTTLE. FOR THE KIT. THE BOTTLE IS ALSO FOR THE KIT.") ] },
      { bg: 'settlement', night: true, music: 'market', actors: crew(80).concat([A('mordecai', 140), A('pustule', 230, { flip: true })]), lines: [
        L('PUSTULE', "MORDECAI, YOU HANDSOME DEVIL. AN INCUBUS NOW? IT SUITS YOU. IT REALLY, REALLY SUITS YOU. HOBGOBS AND BOOM STICKS, HONEY. WHAT NEEDS BLOWING UP?"),
        L(CARL, "SIX FEET OF HOBGOBLIN, A SORE ON HER FACE THAT'S LOOKING AT ME AND A T-SHIRT WITH A UNICORN IN SUNGLASSES. I LOVE HER. I'M BUYING EVERYTHING SHE HAS."),
        L('PUSTULE', "HOB-LOBBERS AND DYNAMITE IN STOCK, SUGAR. SMOKE CURTAINS TOMORROW. COME BACK ANYTIME. THE SILK ROAD NEVER CLOSES.") ] },
      { bg: 'settlement', night: true, actors: crew(80).concat([A('mordecai', 140)]), lines: [
        L(DONUT, "I BOUGHT MONGO A MAGICAL PET CARRIER. IT FOLDS UP LIKE A RUBIK'S CUBE. MONGO, LOOK. LOOK AT YOUR NEW HOUSE."),
        L('MONGO', "SCREEEEEEEEEEEEEEEE!"),
        L(CARL, "HE HATES IT. HE HATES IT SO MUCH. WAIT. HE'S SNIFFING. HE SMELLS SOMETHING. MONGO. MONGO, NO. MONGO! GODDAMNIT, GET BACK HERE!") ] }
    ],

    alley_after: [
      { bg: 'alley', night: true, actors: crew(90), music: 'sad', lines: [
        L(CARL, "THE ELF SAID HE WAS PROTECTING THE ANGELS. HE USED A MEAT HOOKS SCROLL TO DRAG MONGO IN HERE. I KICKED HIM IN THE BALLS. DONUT TOOK HIS FUCKING HEAD OFF."),
        L(DONUT, "MONGO IS KEEPING THE HEAD. I SAID NO. HE SAID MREEP. HE IS LICKING IT. WE HAVE AGREED TO DISCUSS IT LATER."),
        L(CARL, "GUMGUM. THE KRASUE DID THIS. SHE CAME ASKING FOR HELP AND SHE DIED IN AN ALLEY, JUST LIKE HER MOTHER. GODDAMNIT. GODDAMNIT.") ] },
      { bg: 'alley', night: true, actors: crew(90), lines: [
        L(CARL, "SHE HAD A GATE PASS TO THE ADMIN DISTRICT, SIGNED BY MAGISTRATE FEATHERFALL. AND A LETTER. SCRIBBLY WRITING. NECROMANCER SHIT, I THINK."),
        L(DONUT, "FITZ SAID THE MAGISTRATE IS A DARK CLERIC WHO CONTROLS THE UNDEAD. CARL, THIS IS LIKE LAW AND ORDER. THE ONE WITH THE GOOD DETECTIVE. WE ARE THE GOOD DETECTIVE.") ] },
      { bg: 'inn_narwhal', sfx: 'lootbox_open', flash: '#f8b800', actors: crew(90), lines: [
        L(AI, "GOLD FAN BOXES! CARL RECEIVES: A XISTERA! THE BASKET SCOOP FROM JAI ALAI! STRAP IT TO YOUR ARM AND FLING YOUR SHIT AT A HUNDRED MILES AN HOUR!"),
        L(CARL, "HOB-LOBBERS. STRAIGHT AND FAST. CESTA PUNTA. I'M GOING TO BE A JAI ALAI GOD. A VERY SPECIFIC GOD."),
        L(DONUT, "MINE IS A PICTURE. OF BEA. AND ME. FROM BEFORE. I DON'T WANT TO TALK ABOUT IT. I'M GOING TO KEEP IT. I'M GOING TO KEEP IT VERY SAFE.") ] }
    ],

    quill_desk: [
      { bg: 'admin', fade: true, actors: crew(80).concat([A('burgundy', 200, { flip: true })]), lines: [
        L(CARL, "THE GATE PASS WORKED. THE GUARDS LET US UP TO THE THIRD-STORY LANDING. A MALL FOR SKYFOWL ONLY, AND STAIRS UP TO THE MAGISTRATE."),
        L('BURGUNDY', "EXCUSE ME. SORRY. I'M JUST RUNNING ERRANDS. YOU SHOULDN'T BE UP HERE. NOBODY GOES UP THERE."),
        L(DONUT, "HER EYES DON'T MATCH. ONE BLUE, ONE BROWN. AND SHE SMELLS FUNNY. NOT BAD. JUST WRONG.") ] },
      { bg: 'panel:quill_desk', music: 'dark', lines: [
        L('MISS QUILL', "THE MAGISTRATE IS NOT SEEING VISITORS. THE MAGISTRATE IS NEVER SEEING VISITORS. STATE YOUR BUSINESS SO I CAN DENY IT."),
        L(CARL, "WOMEN ARE TURNING UP DEAD AT YOUR GATE EVERY MORNING."),
        L('MISS QUILL', "WERE ANY OF THEM SKYFOWL? NO? THEN THE MAGISTRATE WILL NOT CARE. AND IF HE WILL NOT CARE, I WILL NOT DISTURB HIM."),
        L(CARL, "THREE HUNDRED STUFFED DOLLS ON THE SHELVES BEHIND HER, ALL TAGGED. A BEANIE BABY COLLECTION FROM HELL, GUARDED BY THE COLDEST BITCH ON THE FLOOR.") ] },
      { bg: 'office', shake: 0.3, sfx: 'crate_break', actors: crew(80).concat([A('quill', 220, { flip: true })]), lines: [
        L(CARL, "EVIDENCE. ONE OF THE WOMEN FROM YOUR GATE. FROM MY INVENTORY. ONTO YOUR DESK. AND ALL OVER YOUR LITTLE DOLLS. CARE NOW?"),
        L('MISS QUILL', "MY FIGURES! GUARDS! GUARDS! OH. YOU HAVE A SIGNED PASS. FINE. FINE! THE MAGISTRATE ONLY COMES OUT AT NIGHT! LOOK WHAT YOU DID! I NEED A HUNDRED RAGS!") ] },
      { bg: 'office', actors: crew(80), lines: [
        L(CARL, "SHE RAN DOWNSTAIRS FOR CLEANING STUFF. THE SHELVES ARE HOLLOW. KNOCK, KNOCK. HOLLOW. HUH."),
        L(CARL, "THREE STICKS OF GOBLIN DYNAMITE AND A GLOB OF HOBGOBLIN PUS, TUCKED IN BEHIND THE FIGURES. NOT A PLAN. JUST A SEED. YOU PLANT ENOUGH SEEDS, SOMETHING GROWS."),
        L(DONUT, "CARL, THAT IS EITHER VERY CLEVER OR A WAR CRIME. POSSIBLY BOTH. I WILL ALLOW IT.") ] }
    ],

    divider_blast: [
      { bg: 'ruins', night: true, shake: 1.5, flash: '#f8f8f8', sfx: 'detonate', lines: [
        L(AI, "OH NO! THE DYNAMITE BOUNCED OFF A BERSERKER! IT ROLLED UNDER THE DIVIDER! AND THE DIVIDER IS VERY, VERY BLOATED! OH, THIS IS GOING TO BE SO FUCKING GROSS!"),
        L(CARL, "I'M FLYING. WHY AM I FLYING. WHY AM I COVERED IN WHALE. THAT'S A ROOF. THAT'S A ROOF COMING AT ME. HELLO, ROOF. FUCK YOU, ROOF.") ] },
      { bg: 'settlement', night: true, actors: [A('carl_dead', 100), A('donut_idle', 130), A('mongo_idle', 170)], lines: [
        L(DONUT, "HE'S FINE. HE KNOCKED HIMSELF OUT WITH A WHALE. MONGO IS ROLLING IN THE GUTS. MONGO HAS NEVER BEEN HAPPIER. I HAVE NEVER BEEN MORE DISGUSTED."),
        L(MORD, "(OVER THE CHAT) TELL HIM WHEN HE WAKES UP THAT THE WHOLE GALAXY SAW IT. IN SLOW MOTION. THREE ANGLES. ONE OF THEM UP HIS BOXERS.") ] }
    ],

    recap: [
      { bg: 'settlement', lines: [
        L(AI, "PREVIOUSLY ON DUNGEON CRAWLER WORLD! TONIGHT'S RECAP: THE CRAWLERS WHO PICKED THEIR CLASSES WITH STYLE! AND SOME WHO DIED HORRIBLY DOING IT!"),
        L(AI, "HEKLA, LEADER OF BRYNHILD'S DAUGHTERS! SHE TOOK THE AMAZONIAN UPGRADE AND IS NOW SEVEN FEET OF SAPPHIRE-EYED MUSCLE IN A VALKYRIE HELMET! HUBBA HUBBA!"),
        L(AI, "LUCIA MAR! THIRTEEN, A SOCCER JERSEY OVER GLOWING SILVER ARMOR, AND HER DOGS! SHE TRASHED THE DESPERADO CLUB LAST NIGHT. THE CLUB WANTS HER BACK. TO SUE HER."),
        L(CARL, "THEY SHOW THIS ON A BIG SCREEN IN THE MIDDLE OF TOWN. LIKE THE SUPER BOWL, IF THE SUPER BOWL KILLED PEOPLE. WHICH, HONESTLY, IT KIND OF DID.") ] }
    ],

    greenroom: [
      { bg: 'panel:greenroom', music: 'show', fade: true, lines: [
        L('ZEV', "BIG NIGHT! DANGER ZONE WITH RIPPER WONTON! LIVE! UNCENSORED! DO NOT CURSE. NO. WAIT. CURSE. IT'S UNCENSORED. FUCK. SEE? LIKE THAT. OH GOD, I'M NERVOUS."),
        L(DONUT, "THERE IS A SINGER NAMED MANASA WHO WANTED OUR TRAILER. IT IS BIGGER. I SAID YES BECAUSE I AM GRACIOUS. ALSO HERS HAS BETTER LIGHTING."),
        L(CARL, "THE HOST IS A QUOKKA IN AN ORANGE ASCOT. JUST THE ASCOT. NOTHING ELSE. FRED FROM SCOOBY-DOO, IF FRED GOT SHRUNK AND WENT FULL NUDIST.") ] }
    ],

    blast: [
      { bg: 'studio', flash: '#ffffff', shake: 1.4, sfx: 'detonate', lines: [
        L('RIPPER WONTON', "WE'RE GETTING REPORTS... AN EXPLOSION AT THE TRAILERS... HOLY SHIT. LADIES AND GENTLEMEN, STAY TUNED. WE ARE STILL LIVE."),
        L(AI, "AN ORBITAL PULSE STRIKE FROM THE SKULL EMPIRE! AIMED AT THE CRAWLERS' TRAILER FOR THE CRIME OF SEDITION! IT HIT THE OTHER TRAILER. THE ONE THEY SWAPPED.") ] },
      { bg: 'panel:trailer_blast', music: 'sad', lines: [
        L(CARL, "MANASA. SHE SWAPPED WITH US. IT WAS MEANT FOR US. IT WAS MEANT FOR ME, BECAUSE I OPENED MY FUCKING MOUTH ON LIVE TV."),
        L(AI, "THE VALTAY ARE NOT AMUSED. A VALTAY DREADNAUGHT HAS JUST REMOVED A CERTAIN PRINCE'S YACHT FROM ORBIT. AND THE PRINCE. AND HIS MOTHER. GOOD NIGHT, EVERYBODY!"),
        L('RIPPER WONTON', "WE CLOSE TONIGHT WITH MANASA'S LAST PERFORMANCE. THIS IS DANGER ZONE. I'M RIPPER WONTON. PLEASE HOLD YOUR LOVED ONES.") ] },
      { bg: 'panel:danger_zone', lines: [
        L('ZEV', "CARL. CARL. YOU JUST TOLD A WHOLE EMPIRE TO REVOLT ON LIVE TELEVISION. THE RATINGS ARE INSANE. I'M GOING TO THROW UP. CAN FISH THROW UP? OH SHIT, WE CAN.") ] },
      { bg: 'inn_narwhal', actors: crew(90).concat([A('mordecai', 180, { flip: true })]), lines: [
        L(MORD, "YOU UNDERSTAND WHAT HAPPENED. A WOMAN IS DEAD. A PRINCE IS DEAD. A WAR MAYBE STARTED. BECAUSE YOU WANTED TO MAKE A POINT. GODDAMNIT, KID."),
        L(CARL, "I KNOW. I KNOW WHAT I DID. THEY PUT US IN A BOX AND DARE US TO SCREAM. SO I SCREAMED. I'M NOT SORRY FOR SCREAMING. I'M SORRY ABOUT MANASA."),
        L(DONUT, "HEKLA ASKED US TO HELP A GIRL IN HER PARTY. KATIA. SHE SAID SHE IS IN TOWN. SHE SAID SHE IS HAVING TROUBLE WITH HER FACE.") ] }
    ],

    apito_after: [
      { bg: 'school', fade: true, actors: crew(80).concat([A('eunice', 200, { flip: true }), A('ricky_joe', 225, { flip: true })]), lines: [
        L(CARL, "SALVATORE AND CARMINE. THEY ADMITTED IT. THEY TORTURED GUMGUM UNTIL SHE TOLD THEM WHO WORE THE ANKLET. THEY WERE HUNTING DONUT. THOSE MOTHERFUCKERS."),
        L('EUNICE', "AND THEN I CUT THAT ONE IN HALF LIKE A BAGEL. I'M PREGNANT, NOT DEAD. THAT WAS FOR MY HUSBAND."),
        L('RICKY JOE', "THE DINOSAUR ATE SPARKY AND THEN HE ATE MY ARM. AND THEN THE CAT FIXED IT. MY ARM IS SHINY NOW. THIS IS THE BEST DAY EVER.") ] },
      { bg: 'school', flash: '#f83800', shake: 1.0, sfx: 'fire_burst', actors: [A('carl_victory', 120)], lines: [
        L(AI, "AND WHAT IS THIS? A LIT JUG O'BOOM TOSSED STRAIGHT UP! THE CAT PUDDLE JUMPS THEM TO THE ROOF! THE JUG LANDS! THE TEMPLE IS ON FIRE! THE ELVES ARE ON FIRE!"),
        L(DONUT, "THE MIC DROP! WE ARE CALLING IT THE MIC DROP. I DROPPED THE MIC. I DID THE TELEPORT, SO I DROPPED THE MIC."),
        L(CARL, "THAT'S TWO PLAYS IN THE BOOK. PANIC, BOOMY BOY, MIC DROP. THREE. THAT'S THREE PLAYS.") ] }
    ],

    katia_meet: [
      { bg: 'settlement', fade: true, actors: crew(80).concat([A('katia_idle', 210, { flip: true })]), lines: [
        L('KATIA', "YOU'RE CARL AND DONUT. HEKLA SAID YOU MIGHT COME. I'M KATIA. KATIA GRIM. I'M A DOPPELGANGER NOW. I PICKED IT. I'M STILL GETTING THE HANG OF IT."),
        L(DONUT, "YOUR EYES ARE TOO HIGH. AND YOUR NOSE GOES LEFT. AND YOUR HAIR IS A YELLOW I HAVE NEVER SEEN ON A HUMAN BEING."),
        L('KATIA', "I KNOW. I CAN'T HOLD A FACE YET. MY CLASS IS MONSTER TRUCK DRIVER. THERE ARE NO MONSTER TRUCKS. HEKLA THINKS I'M A LIABILITY.") ] },
      { bg: 'settlement', actors: crew(80).concat([A('katia_idle', 210, { flip: true })]), lines: [
        L(CARL, "WELL, WE'RE A CAT, A DINOSAUR AND A GUY WHOSE BALLS ARE ON GALACTIC TV. NOBODY HERE IS GOING TO JUDGE YOUR NOSE. WANT IN?"),
        L('KATIA', "I CAN MAKE MY ARM INTO A SHIELD. I'LL STAND IN FRONT OF THINGS. I'M VERY GOOD AT STANDING IN FRONT OF THINGS."),
        L(AI, "KATIA GRIM HAS JOINED THE PARTY! SHE BLOCKS PROJECTILES! SHE HAS A FACE! TECHNICALLY! MOSTLY! IT IS SLIDING A LITTLE!") ] }
    ],

    mongo_grows: [
      { bg: 'alley', night: true, flash: '#f8f8f8', sfx: 'level_up', actors: [A('carl_idle', 90), A('donut_shoulder', 88, { y: Y - 18 }), A('katia_idle', 120), A('mongo_big_idle', 200, { flip: true })], lines: [
        L(AI, "MONGO HAS REACHED LEVEL 13! MONGO IS GROWING! MONGO IS STILL GROWING! MONGO IS NOW A SMALL PONY WITH EIGHTY TEETH AND NO FUCKING IMPULSE CONTROL!"),
        L(DONUT, "MY BABY! MY BABY IS A HORSE! CARL, I CAN RIDE HIM INTO BATTLE. LIKE A QUEEN. LIKE A WARRIOR QUEEN."),
        L(CARL, "HE STILL THINKS HE'S A LAP DOG. HE'S GOING TO TRY TO SIT ON ME. MONGO, NO. MONGO. MONGO! MY SPLEEN!") ] }
    ],

    /* ---------------- ACT 3 ---------------- */
    plant_intro: [
      { bg: 'office', night: true, fade: true, music: 'dark', actors: crew(80, { bigMongo: true, katia: true }), lines: [
        L(CARL, "THE PLAN. I SENT QUILL HER OWN LETTER BACK, WRITTEN TO LOOK LIKE IT CAME FROM THE ELVES. SHE'LL BE AT HER DESK TONIGHT. SO WILL HER KRASUE. FOUR OF THEM."),
        L(DONUT, "MY CLOCKWORK TRIPLICATE MAKES TWO LITTLE MONGOS. THE KRASUE WILL CHASE THEM. THEY THINK THEY ARE SNACKS. THEY ARE DECOYS. I AM A GENIUS."),
        L(CARL, "PUSTULE'S SMOKE CURTAINS AT THE OTHER SPOTS. THREE STICKS IN THE LOAD-BEARING SHELVES. THEN THE ROOF NEXT DOOR, THE BIG RED BUTTON, AND BYE BYE BIRDIE.") ] }
    ],

    magistrate: [
      { bg: 'admin', night: true, shake: 2.0, flash: '#f8f8f8', sfx: 'detonate', lines: [
        L(AI, "BOOOOOOOM! HALF OF THE MUNICIPAL BUILDING IS NOW A CLOUD! THE OTHER HALF THOUGHT ABOUT IT AND DECIDED! IT IS ALSO A CLOUD! IT IS RAINING RECEPTIONIST!") ] },
      { bg: 'admin', night: true, sfx: 'achievement', actors: crew(100, { bigMongo: true, katia: true }), lines: [
        L(AI, "ACHIEVEMENT! ASSASSIN! YOU KILLED A RANKING PUBLIC OFFICIAL! MISS QUILL WAS VERY RANKING! NOW SHE IS VERY CHUNKY! A BRONZE ASSASSIN'S BOX!"),
        L(AI, "ACHIEVEMENT! ULTIMATE EXTREME POWER! YOU KILLED THE ACTING MAGISTRATE AND TOOK THE JOB! SETTLE DOWN, CHARLEMAGNE, IT'S ONE MEDIUM TOWN, NOT HALF OF EUROPE."),
        L(AI, "ACHIEVEMENT! COCKBLOCK! THAT NPC WAS SOMEBODY ELSE'S QUEST TARGET. SOMEWHERE A SHIRTLESS TIGER MAN STANDS IN AN EMPTY APARTMENT, VERY ANNOYED AND VERY BLUE."),
        L(DONUT, "CARL IS THE MAGISTRATE. CARL. HAS A TITLE. I HAVE BEEN A PRINCESS MY WHOLE LIFE AND HE GETS A TITLE FOR BLOWING UP A RECEPTIONIST. THIS IS BULLSHIT.") ] }
    ],

    nest_after: [
      { bg: 'panel:featherfall', music: 'sad', fade: true, lines: [
        L(CARL, "FEATHERFALL. THE MAGISTRATE. STRAPPED UPSIDE DOWN ON A WHEEL, DRIED OUT LIKE BEEF JERKY. DEAD FOR YEARS. AND THE SYSTEM GAVE US THE KILL ANYWAY. WHAT THE FUCK."),
        L(CARL, "ALL WEEK I'VE BEEN ACTING LIKE MEETING THIS GUY WAS A NIGHTMARE ON ELM STREET THING. DON'T FALL ASLEEP, HE'LL GET YOU. HE WAS NEVER GOING TO GET ANYBODY.") ] },
      { bg: 'nest', night: true, actors: crew(80, { bigMongo: true, katia: true }).concat([A('burgundy', 230, { flip: true })]), lines: [
        L('BURGUNDY', "QUILL LURED US HERE. JOBS AT THE DESPERADO CLUB, SHE SAID. THE ELVES BROUGHT US TO REMEX. SOME BECAME THOSE THINGS. THE REST BECAME THE BODIES AT THE GATE."),
        L('BURGUNDY', "BY DAY WE WORKED THE MALL. PLUCKED A FEATHER FROM EVERY SKYFOWL WHO CAME THROUGH. I NEVER KNEW WHY. PLEASE. BEFORE IT COMES BACK."),
        L(DONUT, "I'LL DO IT. IT SHOULD BE SOMEONE WHO LISTENED. GOODBYE, BURGUNDY. YOU WERE A PERSON. YOU WERE A PERSON THE WHOLE TIME.") ] },
      { bg: 'nest', night: true, sfx: 'missile', actors: crew(80, { bigMongo: true, katia: true }), lines: [
        L(CARL, "THERE'S SOMETHING IN THE RUBBLE. A LITTLE STUFFED DEMON ON A HORSE IN A GLASS CASE. KIMARIS, THE TAG SAYS. QUILL'S TOP SHELF. THE GLASS IS SHEOL GLASS."),
        L(CARL, "I DON'T KNOW WHY I'M TAKING IT. I JUST AM. SOMETHING IN ME SAYS THE CASE IS IMPORTANT.") ] }
    ],

    depot_plan: [
      { bg: 'admin', night: true, fade: true, actors: crew(80, { bigMongo: true, katia: true }).concat([A('bautista', 230, { flip: true })]), lines: [
        L('BAUTISTA', "QUILL WAS MY TARGET. KILL HER, GET INTO THE DESPERADO CLUB. I WAS IN HER APARTMENT WHEN YOUR BOMB WENT OFF. SHE HAD A THOUSAND MORE DOLLS. CREEPY BITCH."),
        L(CARL, "SORRY ABOUT THE QUEST. NOT SORRY ABOUT THE BOMB. SHE HAD IT FUCKING COMING."),
        L('BAUTISTA', "DON'T BE. MY SISTER GRACE DIED IN THOSE RUINS. YOU FOUND HER. NOW TELL ME WHAT'S IN THE DEPOT.") ] },
      { bg: 'depot', night: true, actors: crew(80, { bigMongo: true, katia: true }).concat([A('guard_walk', 230, { flip: true })]), lines: [
        L(CARL, "THE GUARDS ARE POWERED BY A SOUL CRYSTAL IN THE DEPOT. AT NIGHT THEY SIT HERE FROZEN, RECHARGING. BURGUNDY SAID REMEX IS IN HERE TOO, WITH THE LIGHT."),
        L(CARL, "TEN STICKS. WE RIG THE WHOLE PLACE. KATIA HOLDS THE DETONATOR. WHATEVER HAPPENS IN THERE, IF I SAY THE WORD, SHE PUSHES THE BUTTON."),
        L('KATIA', "I'LL HOLD IT. I WON'T PUSH IT UNTIL YOU SAY. I WON'T. I'M HOLDING IT VERY GENTLY.") ] }
    ],

    remex: [
      { bg: 'panel:remex', music: 'sad', fade: true, lines: [
        L('REMEX', "DON'T COME CLOSER. PLEASE. DON'T BLOW ME UP. I AM REMEX. I WAS THE MAGISTRATE, BEFORE. I WAS HER HUSBAND."),
        L(AI, "REMEX! SOUL LEECH CAPACITOR! LEVEL 1! EVER USE A OUIJA BOARD AND THINK, I WISH GRANDPA COULD COME BACK AND DO CHORES? THIS IS THAT. THE CHORE IS SOULS.") ] },
      { bg: 'depot', night: true, actors: crew(70, { bigMongo: true, katia: true }).concat([A('remex', 240, { flip: true })]), lines: [
        L('REMEX', "QUILL BROUGHT ME BACK. I HOLD SOULS. THE CRYSTAL HOLDS WHAT I HOLD. THE GUARDS RUN ON IT. AND HER SPELL RAN ON IT. THE FINAL WAR."),
        L('REMEX', "THREE GENERATIONS OF CASTING. ONE NIGHT LEFT. EVERYONE IN THE OVER CITY WOULD DIE BUT THE SKYFOWL AND THE CHICKADEES. THE FEATHERS MARKED WHO TO SPARE."),
        L('REMEX', "SHE'S DEAD. NOBODY IS DRAWING THE POWER DOWN. THE CRYSTAL IS FULL. IT IS GOING TO BREAK. I AM SO SORRY. I WAS NEVER ALLOWED TO SAY NO.") ] },
      { bg: 'depot', night: true, sfx: 'glass_crack', shake: 0.6, lines: [
        L(AI, "QUEST COMPLETE! THE SEX WORKERS WHO FELL FROM THE HEAVENS! SOLVED! A SILVER QUEST BOX! THE BITCH BEHIND IT IS ALREADY A CLOUD! HOLD THAT THOUGHT."),
        L(AI, "NEW GROUP QUEST! THE FOOLS WHO BROKE THE GLASS! A VERY OLD SPELL JUST SNAPPED. IN SEVEN MINUTES, 45 SQUARE KILOMETERS EXPLODE. YES, IT'S YOUR FAULT. WE LOVE IT."),
        L(CARL, "THE CASE. THE SHEOL GLASS CASE. KIMARIS, OUT. CRYSTAL, IN. LID ON. LID ON. LID. FUCKING. ON.") ] },
      { bg: 'panel:glass_case', sfx: 'clockwork', lines: [
        L(CARL, "IT FITS. IT'S HUMMING. IT'S STILL GOING TO BLOW, IT JUST CAN'T, AS LONG AS IT'S IN THE CASE. AND AS LONG AS THE CASE IS IN ME. IN MY INVENTORY.") ] },
      { bg: 'panel:doomsday', flash: '#f878f8', sfx: 'unlock', lines: [
        L(AI, "NEW ITEM! CARL'S DOOMSDAY SCENARIO! A FULLY CHARGED SOUL CRYSTAL IN A SHEOL GLASS REAPER CASE. IT CAN NEVER LEAVE YOUR INVENTORY. IF IT DOES: RED MIST."),
        L(AI, "ALSO, THE SPELL IS STILL COLLAPSING! FOUR PRECURSOR BURSTS ARE COMING, THEN THE BIG ONE! THE EASTERN STAIRWELL HAS OPENED! RUN, CRAWLERS! RUN!"),
        L(DONUT, "CARL. CARL! YOU ARE A WALKING BOMB NOW. I AM SITTING ON A BOMB'S SHOULDER. A BOMB? CARL. YOU KNOW HOW I FEEL ABOUT BOMBS.") ] }
    ],

    finale: [
      { bg: 'panel:bursts', fade: true, music: 'escape', lines: [
        L(AI, "FOUR BURSTS DOWN! MAGIC GEAR STRIPPED, WEAPONS GONE ROGUE, ARMOR MELTED, INVENTORIES POPPING LIKE CORN! THE BIG ONE IS SECONDS AWAY! RUN!"),
        L(DONUT, "MY CROWN! MY CROWN IS CRUMBLING! CARL, IT'S DUST. IT'S JUST DUST NOW. OH, FUCK EVERYTHING.") ] },
      { bg: 'panel:stairwell', shake: 0.6, actors: [], lines: [
        L(CARL, "THE STAIRWELL! BAUTISTA, GET THEM IN! EVERYBODY IN! KATIA! KATIA, NOW! PUSH THE FUCKING BUTTON!"),
        L('KATIA', "PUSHING IT!"),
        L(AI, "TWENTY SECONDS LEFT AND THE GUARD DEPOT GOES UP! TEN STICKS OF DYNAMITE AND A WAREHOUSE FULL OF SOUL MAGIC! THAT IS A WHOLE LOT OF FUCKING BANG!") ] },
      { bg: 'escape', flash: '#ffffff', shake: 2.0, sfx: 'detonate', lines: [
        L(AI, "AND WE HAVE A BLAST! THE DEPOT EXPLOSION TEARS THE SPELL APART BEFORE IT FINISHES! THE CRAWLERS ARE THROUGH THE DOOR! THE THIRD FLOOR IS BEHIND THEM!") ] },
      { bg: 'panel:greenroom', music: 'ending', fade: true, lines: [
        L('ODETTE', "WELCOME BACK TO MY GREEN ROOM, DARLINGS. TWO AND A HALF DAYS LATER, AND THE WHOLE GALAXY IS STILL TALKING ABOUT IT. SIT. HAVE A DRINK. YOU EARNED IT."),
        L('ODETTE', "YOUR LITTLE DEPOT BOMB BLUNTED THE FINAL BLAST. THOUSANDS OF NPCS LIVED. DOZENS OF CRAWLERS TOO. THE BANDIT ACHIEVEMENT MADE EIGHTY-THREE BOXES CELESTIAL."),
        L('ODETTE', "BORANT SPENT ITS ONE VETO OF THE SEASON TO CANCEL THEM. ONE CRAWLER OPENED HIS FIRST. AND YOURS? IT SLIPPED THROUGH BEFORE THE PAPERWORK. DON'T TELL ANYONE."),
        L('ODETTE', "THE LEADERBOARD DRAFT HAS YOU SIXTH, CARL. DONUT, SEVENTH. BE CAREFUL. A GOD HAS NOTICED YOU, HEKLA WANTS YOUR CAT, AND THERE IS A PRICE ON BOTH YOUR HEADS."),
        L(DONUT, "SEVENTH? SEVENTH? I AM THE PRINCESS. I AM NOT SEVENTH. THERE HAS BEEN A MISTAKE. I WANT TO SPEAK TO THE LEADERBOARD'S MANAGER."),
        L(AI, "AND CARL, FOR ONCE, HAD NOTHING CLEVER TO SAY. HE SAID ONE WORD, AND THE WORD WAS FUCK. WE DID NOT BLEEP IT. SEE YOU ON FLOOR FOUR, CRAWLERS!") ] }
    ]
  };
})();
/* ==========================================================================
   THE DANGER ZONE TALK SHOW (DESIGN 10) and CLASS SELECTION (DESIGN 11.2)
   ========================================================================== */
(function () {
  'use strict';
  var D = window.DCW.data;
  function L(who, text) { return { who: who, text: text }; }
  var RIP = 'RIPPER WONTON', CARL = 'CARL', DONUT = 'DONUT', AI = 'SYSTEM AI';

  D.show = {
    danger_zone: {
      name: 'DANGER ZONE WITH RIPPER WONTON',
      panel: ['hekla', 'manasa', 'tucker', 'dnadia'],
      startViews: 0, fanBox: { min: 1500, tier: 'fan' },
      intro: [
        L(RIP, "GOOD EVENING, SYNDICATE! LIVE! UNCENSORED! UNSCRIPTED! UNDRESSED, IN MY CASE! THIS IS DANGER ZONE, AND I AM YOUR HOST, RIPPER WONTON!"),
        L(RIP, "TONIGHT ON THE PANEL: HEKLA OF BRYNHILD'S DAUGHTERS! THE SINGER MANASA! POLITICAL GENIUS TUCKER! HER HIGHNESS PRINCESS D'NADIA OF THE PRISM KINGDOM!"),
        L(RIP, "AND ON THE COUCH, THE CRAWLERS EVERYONE IS TALKING ABOUT! THE MAN WITH NO PANTS AND THE CAT WITH NO CHILL! CARL AND PRINCESS DONUT!"),
        L(DONUT, "HELLO, EVERYONE. YES. THANK YOU. PLEASE, SIT. NO, KEEP CLAPPING. I MEANT KEEP CLAPPING.")
      ],
      segments: [
        { who: RIP, time: 15, q: "CARL, THE QUESTION ON EVERY PLANET IN THE SYNDICATE: WHERE. THE FUCK. ARE. YOUR. PANTS?",
          answers: [
            { text: "THE PANTS ARE IN A BETTER PLACE NOW.", views: 200, crowd: 'laugh',
              react: [L(RIP, "HA! A MOMENT OF SILENCE FOR THE PANTS, EVERYBODY."), L('TUCKER', "THIS IS WHAT PASSES FOR WIT ON EARTH? NO WONDER THEY BLEW YOU UP.")] },
            { text: "MY BOXERS HAVE STATS. YOUR PANTS HAVE A BELT LOOP AND A VERY SMALL DICK.", views: 350, crowd: 'applause',
              react: [L("PRINCESS D'NADIA", "THEY HAVE STATS? I WANT A PAIR. IN SILK. IN EVERY COLOR. WITH ROOM."), L(RIP, "THE PRINCESS IS SHOPPING! TUCKER IS CRYING! THE MARKET IS OPEN!")] },
            { text: "I'D RATHER TALK ABOUT WHY YOU PEOPLE WATCH US DIE.", views: -100, crowd: 'boo',
              react: [L(RIP, "WOW. OKAY. WE'LL GET TO THE HEAVY SHIT, CARL. WARM UP FIRST. STRETCH."), L('MANASA', "I THINK IT'S A FAIR QUESTION.")],
              donut: "WHAT HE MEANS IS THAT HE IS NERVOUS AND HANDSOME. MOSTLY NERVOUS. HE SWEATS WHEN HE IS NERVOUS. EVERYWHERE. LET'S MOVE ON." }
          ] },
        { who: 'TUCKER', time: 15, q: "I HAVE TO SAY IT. A CAT. ON MY PANEL. ARE WE INTERVIEWING PETS NOW? WHAT'S NEXT, A HOUSEPLANT? A FUCKING HAMSTER? NO OFFENSE, RIPPER.",
          answers: [
            { text: "SHE'S NOT A PET. SHE'S MY PARTY LEADER.", views: 250, crowd: 'laugh',
              react: [L(RIP, "PARTY LEADER! OOH. TUCKER, YOU'RE SITTING NEXT TO A BOSS."), L('TUCKER', "A BOSS THAT LICKS ITS OWN ASS ON CAMERA.")] },
            { text: "YOU'RE ON THIS PANEL. WE ALREADY HAVE A HOUSEPLANT.", views: 400, crowd: 'applause',
              react: [L(RIP, "OHHHH! THE AUDIENCE IS ON ITS FEET! TUCKER IS TURNING A COLOR I HAVE NEVER SEEN!"), L('TUCKER', "I HAVE A DOCTORATE.")] },
            { text: "LET HER ANSWER THAT ONE HERSELF.", views: 650, crowd: 'applause',
              react: [L('TUCKER', "I... I NEED A MOMENT."), L(RIP, "I THINK WE JUST WATCHED A CAT END A MAN'S CAREER. LIVE. UNCENSORED. FUCKING BEAUTIFUL.")],
              donut: "TUCKER, DARLING, I HAVE MORE FOLLOWERS THAN YOUR WHOLE PLANET HAS PEOPLE, I HAVE WON BEST IN SHOW, AND I HAVE KILLED A BOSS. YOU HAVE A TIE." }
          ] },
        { who: 'TUCKER', time: 15, q: "FINE. LET'S TALK POLITICS. THE VALTAY CORPORATION WANTS TO BUY OUT BORANT. WHOSE SIDE ARE YOU ON, CRAWLER?",
          answers: [
            { text: "I'M ON THE SIDE OF NOT DYING. THAT'S THE WHOLE PLATFORM.", views: 250, crowd: 'laugh',
              react: [L(RIP, "A ONE-ISSUE CANDIDATE! I LIKE IT!"), L('HEKLA', "WISE. THE BUYERS AND THE SELLERS BOTH WANT YOU DEAD ON SCHEDULE.")] },
            { text: "THE VALTAY. THEY SEEM NICE. RICH. NICE AND RICH.", views: -150, crowd: 'boo',
              react: [L(AI, "THE STUDIO AUDIENCE IS BOOING. SOME OF THEM WORK FOR BORANT. SOME OF THEM ARE BORANT. ALL OF THEM ARE ASSHOLES."), L('MANASA', "OH, CARL. NO.")] },
            { text: "I DON'T KNOW EITHER OF THEM AND I DON'T GIVE A SHIT. NEXT QUESTION.", views: 300, crowd: 'laugh',
              react: [L('TUCKER', "YOU CAN'T JUST REFUSE TO ANSWER!"), L(RIP, "HE CAN, TUCKER. HE JUST DID. IT'S HIS SHOW TOO. THE VIEW COUNT AGREES.")] }
          ] },
        { who: RIP, time: 15, q: "THE DANGER ZONE! CALLERS FROM ACROSS THE GALAXY! CALLER, YOU'RE ON THE AIR! ...A CALLER FROM THE SKULL EMPIRE ASKS: WHAT DO YOU THINK OF HOW OUR RULERS TREAT US?",
          answers: [
            { text: "NO COMMENT. I'VE GOT ENOUGH PEOPLE TRYING TO KILL ME.", views: 0, crowd: 'laugh',
              react: [L(RIP, "PLAYING IT SAFE! VERY UNCHARACTERISTIC! THE BOOKIES ARE CONFUSED!")] },
            { text: "IT'S NOT MY PLACE TO TELL YOU HOW TO LIVE.", views: 100, crowd: 'laugh',
              react: [L('MANASA', "THAT'S KIND. THAT'S A KIND ANSWER."), L(RIP, "A KIND ANSWER! ON MY SHOW! DISGUSTING! I LOVE IT!")] },
            { text: "IF THEY TREAT YOU LIKE THIS, STOP LETTING THEM. THERE ARE MORE OF YOU THAN THEM.", views: 900, crowd: 'applause',
              react: [L(AI, "OOOH. THAT IS WHAT THE LAWYERS CALL SEDITION. IN SEVERAL LANGUAGES. SIMULTANEOUSLY."), L(RIP, "WELL! THE SWITCHBOARD JUST CAUGHT FIRE! FIGURATIVELY! I HOPE! HOLY SHIT, LOOK AT THOSE NUMBERS!")],
              donut: "AND ALSO EAT YOUR VEGETABLES. THAT ONE IS FROM ME." }
          ] },
        { who: "PRINCESS D'NADIA", time: 15, q: "PRINCESS TO PRINCESS, DONUT. THAT COAT IS UNBELIEVABLE. WHO DOES YOUR FUR?",
          answers: [
            { text: "SHE DOES IT HERSELF. WITH HER TONGUE. FOR HOURS. INCLUDING HER ASS.", views: 400, crowd: 'applause',
              react: [L(RIP, "TOO MUCH INFORMATION! THE BEST AMOUNT OF INFORMATION!")],
              donut: "CARL! THAT IS PRIVATE! THAT IS A PRIVATE ROYAL RITUAL! I WILL BE SPEAKING TO MY MANAGER ABOUT YOU. HE WILL BE DRUNK. I WILL SPEAK LOUDLY." },
            { text: "A TEAM OF PROFESSIONALS. ME. I'M THE TEAM.", views: 250, crowd: 'laugh',
              react: [L("PRINCESS D'NADIA", "A BAREFOOT GROOMER. HOW RUSTIC. I FIND IT CHARMING. THE FEET ESPECIALLY.")] },
            { text: "ASK HER YOURSELF. SHE'S BEEN WAITING ALL NIGHT FOR THIS ONE.", views: 500, crowd: 'applause',
              react: [L("PRINCESS D'NADIA", "I HAVE TO HAVE THAT ROUTINE. I WILL SEND MY PEOPLE."), L(RIP, "THE PRINCESSES ARE BONDING! WE ARE WITNESSING DIPLOMACY!")],
              donut: "THREE BRUSHINGS A DAY, A PERSIAN IS NOTHING WITHOUT HER UNDERCOAT, AND NEVER, EVER LET A MAN NEAR YOUR TAIL WITH A COMB. NEVER." }
          ] }
      ],
      hekla: [
        L(RIP, "HEKLA! THE LEADER OF BRYNHILD'S DAUGHTERS! YOU'VE BEEN STARING AT THE CAT ALL NIGHT. SHARE WITH THE CLASS."),
        L('HEKLA', "MY DAUGHTERS ARE WARRIORS. SISTERS. WE PROTECT OUR OWN. A PRINCESS LIKE DONUT DESERVES AN ARMY, NOT A MAN WITH HIS BALLS IN MAGIC SHORTS."),
        L('HEKLA', "THE OFFER STANDS, LITTLE ONE. WHENEVER YOU ARE READY. AND CARL. ONE OF MINE IS IN YOUR TOWN. KATIA. SHE IS STRUGGLING. FIND HER. PLEASE."),
        L(DONUT, "SHE IS SO TALL. SHE LOOKS LIKE XENA. IF XENA LIFTED OTHER XENAS. CARL, I AM VERY FLATTERED. I AM STILL YOURS. MOSTLY.")
      ],
      outro: [
        L(RIP, "WHAT A NIGHT! STAY RIGHT THERE, WE'LL BE BACK WITH MANASA SINGING HER NEW SINGLE, RIGHT AFTER THIS... WAIT. WAIT, WHAT IS THAT NOISE?")
      ],
      blast: 'blast',
      blastLines: [
        { who: 'RIPPER WONTON', text: "THAT WAS... THAT WAS THE TRAILER LOT. THAT WAS A VERY BIG FUCKING NOISE FROM THE TRAILER LOT." },
        { who: 'SYSTEM AI', text: "BREAKING NEWS! SOMEBODY IN ORBIT DID NOT ENJOY THAT LAST ANSWER! STAY TUNED!" } ]
    }
  };

  /* ---------------- class selection (guide room) ---------------- */
  D.classPick = {
    intro: [
      L(AI, "RACE SELECTION! CARL, YOU HAVE 398 RACES AVAILABLE! YOUR FAVORITE AI HAS NARROWED IT TO THREE. ALL THREE HAVE GORGEOUS FEET. COINCIDENCE."),
      L(CARL, "THREE OUT OF THREE HUNDRED NINETY-EIGHT. I'M GOING TO SCROLL ANYWAY, YOU CREEPY FUCK.")
    ],
    carlRaces: [
      { id: 'hobgoblin', name: 'HOBGOBLIN', recommended: true,
        desc: 'BIG, GREEN, GREAT WITH EXPLOSIVES. +STR +CON. A NATURAL FOR A MAN WHO SOLVES PROBLEMS WITH FIRE.',
        locked: "YOUR GOBLIN PASS TATTOO MAKES YOU AN HONORARY GOBLIN. HOBGOBLINS HATE GOBLINS. THE PAPERWORK WOULD KILL YOU. SO WOULD YOUR NEW NEIGHBORS." },
      { id: 'half_naga', name: 'HALF NAGA', recommended: true,
        desc: "A SNAKE FROM THE WAIST DOWN. SCALES, VENOM, BEAUTIFUL POSTURE. NOTHING TO KICK WITH. NOTHING TO FREEBALL WITH. NOTHING DOWN THERE AT ALL.",
        locked: "NO LEGS MEANS NO KICKS. NO KICKS MEANS NO SHOW. THE AUDIENCE HAS BEEN POLLED. THE AUDIENCE SAID ABSOLUTELY FUCKING NOT." },
      { id: 'bugbear', name: 'BUGBEAR', recommended: true,
        desc: 'A HAIRY, HULKING AMBUSH PREDATOR. GREAT IN THE DARK. TERRIBLE AT DINNER PARTIES.',
        locked: "BUGBEARS MUST WEAR PANTS. IT IS A CULTURAL THING. WE CHECKED YOUR INVENTORY. WE LAUGHED. WE CHECKED AGAIN. WE LAUGHED HARDER." },
      { id: 'cat', name: 'CAT', desc: 'NINE LIVES, NIGHT VISION, AN ATTITUDE.',
        locked: "TAKEN. THE PRINCESS CALLED DIBS. SHE WAS VERY CLEAR ABOUT DIBS. SHE HAS THE DIBS IN WRITING." },
      { id: 'incubus', name: 'INCUBUS', desc: "WINGS, HORNS, A TAIL AND A JAWLINE THAT ENDS ARGUMENTS. EVERYBODY WANTS TO FUCK YOU. EVERYBODY. ASK YOUR GUIDE HOW THAT'S GOING.",
        locked: "MINIMUM CHARISMA 40 AND A FACE THE GALAXY WANTS TO SIT ON. YOU HAVE A CONCUSSION AND STUBBLE. ALSO YOUR GUIDE ALREADY HAS IT AND HATES IT." },
      { id: 'skyfowl', name: 'SKYFOWL', desc: 'EAGLE HEAD, BIG WINGS, NATURAL ARISTOCRAT OF THE OVER CITY.',
        locked: "SKYFOWL ARE BORN, NOT MADE. ALSO THEY WOULD NOT LET YOU INTO THE MALL. WE ASKED. THEY LOOKED AT YOUR FEET AND CALLED SECURITY." },
      { id: 'human', name: 'HUMAN', desc: 'STAY WHAT YOU ARE. TEN BONUS STAT POINTS FOR BEING BORING ON PURPOSE.',
        locked: "YOU TRIED HUMAN FOR TWENTY-SEVEN YEARS. THE REVIEWS WERE MIXED. THE SHOW WANTS SOMETHING SPICIER. THE SHOW IS NOT ASKING." },
      { id: 'primal', name: 'PRIMAL', found: true,
        desc: 'THE FIRST SPECIES TO CONQUER THE UNIVERSE. A BLANK SLATE. -1 TO ALL BASE STATS. EVERY HIGHER-TIER SKILL CAN TRAIN TO LEVEL 20. UNLOCKS EARTH CLASSES.' }
    ],
    raceAi: [
      L(AI, "PRIMAL? PRIMAL. NOBODY PICKS PRIMAL. A FEW CRAWLERS A SEASON. IT USUALLY ENDS IN A HIGHLIGHT REEL. A SHORT, BLOODY ONE."),
      L(CARL, "IT KEEPS MY SKILLS AND LETS THEM GO HIGHER. I'M NOT HERE FOR THE SHORT GAME. I'M PRIMAL. I'M STILL ME. JUST... MORE.")
    ],
    carlClasses: [
      { id: 'monk', name: 'MONK', recommended: true,
        desc: 'FISTS, FEET, INNER PEACE. FISTS AND FEET YOU HAVE.',
        locked: "YOUR DESPERADO CLUB PASS VOIDS MOST MONK VOWS. CHASTITY, FOR ONE. ALSO THE INNER PEACE PART. WE HAVE SEEN YOU IN TRAFFIC." },
      { id: 'bomb_squad', name: 'BOMB SQUAD TECHNICIAN', recommended: true,
        desc: 'AN EARTH CLASS. DEFUSE THINGS. SAVE LIVES. WEAR A LARGE PADDED SUIT.',
        locked: "THE CLASS REQUIRES YOU TO MAKE BOMBS SAFER. YOUR FILE SAYS YOU HAVE ONLY EVER MADE BOMBS WORSE. ON PURPOSE." },
      { id: 'bouncer', name: 'BOUNCER', recommended: true,
        desc: 'CROWD CONTROL, GRAPPLES, A VELVET ROPE THAT HITS LIKE A TRUCK.',
        locked: "BOUNCERS NEED A SHIRT THAT SAYS SECURITY. YOUR SHIRT IS MADE OF TROLL. IT SAYS NOTHING. IT ONLY SCREAMS." },
      { id: 'paladin', name: 'PALADIN', desc: 'A HOLY WARRIOR. GLOWING SWORD. CERTAINTY.',
        locked: "DESPERADO MEMBERS CANNOT BE HOLY. IT IS IN THE BYLAWS. PAGE ONE. IN RED. UNDERLINED. NEXT TO A CRUDE DRAWING OF A DICK." },
      { id: 'pet_groomer', name: 'PET GROOMER', desc: 'AN EARTH CLASS. BRUSHES, CLIPPERS, A VERY PATIENT DISPOSITION.',
        locked: "THE PRINCESS HAS FILED AN OBJECTION. HER COAT IS NOT AN ENTRY-LEVEL POSITION." },
      { id: 'compensated_anarchist', name: 'COMPENSATED ANARCHIST', found: true,
        desc: 'A RARE EARTH CLASS. MONK AND ROGUE. TRAPS, BOMBS, FISTS, CAMERAS. +1 INT +5 CHA, FEAR SPELL, ESCAPE PLAN. -25% WITH BLADES. NEEDS EXPLOSIVES HANDLING 5 AND 500 BILLION VIEWS.' }
    ],
    classAi: [
      L(AI, "COMPENSATED ANARCHIST! THE PAID PROTESTER! HE THROWS THE BRICK THROUGH THE WINDOW, THEN GIVES A TEARFUL INTERVIEW ABOUT VIOLENCE. WE FUCKING LOVE IT."),
      L(CARL, "IT'S AN OXYMORON. I KNOW. I THINK THAT'S THE JOKE. I THINK I'M THE JOKE. FUCK IT. I'LL TAKE IT. IT COMES WITH BOMBS."),
      L(AI, "AN EARTH CLASS! THAT COMES WITH A SILVER EARTH BOX! INSIDE: AN EARTH HOBBY POTION. CESTA PUNTA. THAT IS JAI ALAI, CARL. YOU HAVE NEVER PLAYED JAI ALAI.")
    ],
    donutLines: [
      L(DONUT, "I AM KEEPING MY RACE. I AM A CAT. IT IS NOT A RACE, IT IS A LIFESTYLE AND A PRIVILEGE."),
      L(DONUT, "AND FOR MY CLASS I AM CHOOSING... FORMER CHILD ACTOR. I WAS ON TELEVISION AS A KITTEN, CARL. I WAS IN A COMMERCIAL. FOR LITTER. I WAS THE BEFORE AND THE AFTER."),
      L(AI, "FORMER CHILD ACTOR! CHARISMA FOR DAYS! AND A CLASS FEATURE: THE MANAGER. THE GAME GUIDE IN THE ROOM IS NOW BOUND TO YOU AS YOUR MANAGER. CONGRATULATIONS!"),
      L(DONUT, "ODETTE TOLD ME TO DO IT. SHE SAID A MANAGER KEEPS YOU ALIVE IN THIS BUSINESS. SHE SAID HIRE THE BEST ONE IN THE ROOM. YOU ARE THE ONLY ONE IN THE ROOM.")
    ],
    mordecaiLines: [
      L('MORDECAI', "NO. NO, NO, NO. UNDO IT. YOU DON'T GET TO BIND A GAME GUIDE. THIS IS A CONTRACT. I'VE READ IT. IT HAS NO EXIT CLAUSE. WHAT KIND OF SADIST WRITES THAT?"),
      L('MORDECAI', "YOU PLANNED THIS. BOTH OF YOU. YOU SAT IN MY ROOM AND SMILED AT ME AND PLANNED THIS. YOU SNEAKY LITTLE SHITS."),
      L(CARL, "I DIDN'T KNOW. I SWEAR. OKAY. I KNEW A LITTLE. SHE SAID IT WAS TO KEEP YOU SAFE TOO."),
      L('MORDECAI', "I AM LEVEL 50. I HAVE BEEN DOWN HERE LONGER THAN YOUR PLANET HAD TELEVISION. AND A FUCKING CAT JUST SIGNED ME. I NEED A DRINK. I NEED SEVERAL.")
    ],
    collapse: [
      L(AI, "ATTENTION CRAWLERS! THE SECOND FLOOR HAS COLLAPSED! ANYONE STILL DOWN THERE IS NOW PASTE! FLOOR THREE TIMER: EIGHT DAYS!"),
      L(CARL, "WAIT. I'M STILL PICKING. THE CLOCK STARTED WHILE I'M STANDING IN A CLOSET READING A MENU? ARE YOU SHITTING ME?"),
      L('MORDECAI', "WELCOME TO THE THIRD FLOOR. NOBODY WAITS FOR YOU HERE. PICK, GODDAMNIT.")
    ],
    outro: [
      L(AI, "RACE AND CLASS LOCKED IN! YOUR STAT POINTS HAVE BEEN DISTRIBUTED! CARL IS A LEVEL 13 PRIMAL COMPENSATED ANARCHIST! DONUT IS A LEVEL 13 CAT FORMER CHILD ACTOR!"),
      L(AI, "STEP THROUGH THE DOOR, CRAWLERS. THE OVER CITY IS WAITING. IT IS HUNGRY. IT IS ALWAYS HUNGRY. TRY TO TASTE BAD.")
    ]
  };
})();
/* ==========================================================================
   LOOT, SKINS, ACHIEVEMENTS, TITLES, LEGACY
   ========================================================================== */
(function () {
  'use strict';
  var D = window.DCW.data;

  /* book 1 tiers + the book's named boxes. rank 1-6 for sorting. */
  D.boxTiers = {
    bronze:         { name: 'BRONZE ADVENTURER BOX', color: '#c87838', rank: 1 },
    silver:         { name: 'SILVER ADVENTURER BOX', color: '#bcbcbc', rank: 2 },
    gold:           { name: 'GOLD ADVENTURER BOX', color: '#f8b800', rank: 3 },
    platinum:       { name: 'PLATINUM ADVENTURER BOX', color: '#a4e4fc', rank: 4 },
    legendary:      { name: 'LEGENDARY BOX', color: '#f878f8', rank: 5 },
    fan:            { name: 'GOLD FAN BOX', color: '#f85898', rank: 3 },
    boss:           { name: 'BRONZE BOSS BOX', color: '#e40058', rank: 3 },
    earth:          { name: 'SILVER EARTH BOX', color: '#58d854', rank: 2 },
    quest_silver:   { name: 'SILVER QUEST BOX', color: '#d8d8f8', rank: 2 },
    quest_gold:     { name: 'GOLD QUEST BOX', color: '#fca044', rank: 3 },
    quest_platinum: { name: 'PLATINUM QUEST BOX', color: '#b8f8f8', rank: 4 },
    lucky_bastard:  { name: 'PLATINUM LUCKY BASTARD BOX', color: '#00e8d8', rank: 4 },
    assassin:       { name: "BRONZE ASSASSIN'S BOX", color: '#881400', rank: 2 },
    tyrant:         { name: 'PLATINUM TYRANT BOX', color: '#6844fc', rank: 4 },
    celestial:      { name: 'CELESTIAL BOX', color: '#fcfcfc', rank: 6 }
  };

  /* reward: {kind:'gold',min,max} | {kind:'item', id: potion|jug|hob|dyn|smoke|moonshine, count}
           | {kind:'skin', any:true} | {kind:'skin', id} | {kind:'stat', any:true|stat, amount}
           | {kind:'xp', amount} | {kind:'hp', amount}. Gold is an act 1 value (game.js scales). */
  D.lootTables = {
    bronze: { rolls: 2, entries: [
      [{ kind: 'gold', min: 10, max: 25 }, 38],
      [{ kind: 'item', id: 'potion', count: 1 }, 16],
      [{ kind: 'item', id: 'jug', count: 1 }, 10],
      [{ kind: 'item', id: 'smoke', count: 1 }, 8],
      [{ kind: 'item', id: 'moonshine', count: 2 }, 8],
      [{ kind: 'xp', amount: 20 }, 10],
      [{ kind: 'stat', any: true, amount: 1 }, 5],
      [{ kind: 'hp', amount: 1 }, 3],
      [{ kind: 'skin', any: true }, 2]
    ] },
    silver: { rolls: 3, entries: [
      [{ kind: 'gold', min: 25, max: 50 }, 32],
      [{ kind: 'item', id: 'potion', count: 1 }, 15],
      [{ kind: 'item', id: 'jug', count: 2 }, 10],
      [{ kind: 'item', id: 'hob', count: 3 }, 8],
      [{ kind: 'item', id: 'smoke', count: 2 }, 6],
      [{ kind: 'xp', amount: 45 }, 10],
      [{ kind: 'stat', any: true, amount: 1 }, 10],
      [{ kind: 'hp', amount: 2 }, 5],
      [{ kind: 'skin', any: true }, 4]
    ] },
    gold: { rolls: 3, entries: [
      [{ kind: 'gold', min: 50, max: 100 }, 28],
      [{ kind: 'item', id: 'potion', count: 2 }, 14],
      [{ kind: 'item', id: 'dyn', count: 2 }, 10],
      [{ kind: 'item', id: 'hob', count: 4 }, 8],
      [{ kind: 'item', id: 'jug', count: 3 }, 8],
      [{ kind: 'xp', amount: 90 }, 10],
      [{ kind: 'stat', any: true, amount: 1 }, 14],
      [{ kind: 'hp', amount: 2 }, 8],
      [{ kind: 'skin', any: true }, 8]
    ] },
    platinum: { rolls: 4, entries: [
      [{ kind: 'gold', min: 100, max: 200 }, 26],
      [{ kind: 'item', id: 'potion', count: 2 }, 13],
      [{ kind: 'item', id: 'dyn', count: 3 }, 10],
      [{ kind: 'item', id: 'hob', count: 5 }, 8],
      [{ kind: 'xp', amount: 180 }, 10],
      [{ kind: 'stat', any: true, amount: 2 }, 15],
      [{ kind: 'hp', amount: 3 }, 10],
      [{ kind: 'skin', any: true }, 12]
    ] },
    legendary: { rolls: 3, guaranteed: [{ kind: 'skin', any: true }], entries: [
      [{ kind: 'skin', any: true }, 20],
      [{ kind: 'gold', min: 160, max: 320 }, 26],
      [{ kind: 'stat', any: true, amount: 2 }, 20],
      [{ kind: 'hp', amount: 4 }, 14],
      [{ kind: 'item', id: 'potion', count: 3 }, 12],
      [{ kind: 'xp', amount: 300 }, 8]
    ] },
    fan: { rolls: 3, entries: [
      [{ kind: 'gold', min: 30, max: 70 }, 28],
      [{ kind: 'item', id: 'potion', count: 2 }, 15],
      [{ kind: 'item', id: 'hob', count: 4 }, 12],
      [{ kind: 'item', id: 'jug', count: 2 }, 10],
      [{ kind: 'xp', amount: 60 }, 10],
      [{ kind: 'stat', any: true, amount: 1 }, 12],
      [{ kind: 'hp', amount: 2 }, 6],
      [{ kind: 'skin', any: true }, 7]
    ] },
    boss: { rolls: 3, guaranteed: [{ kind: 'item', id: 'potion', count: 1 }], entries: [
      [{ kind: 'gold', min: 60, max: 120 }, 26],
      [{ kind: 'item', id: 'potion', count: 2 }, 12],
      [{ kind: 'item', id: 'dyn', count: 2 }, 12],
      [{ kind: 'item', id: 'jug', count: 3 }, 8],
      [{ kind: 'stat', any: true, amount: 1 }, 16],
      [{ kind: 'hp', amount: 2 }, 12],
      [{ kind: 'xp', amount: 120 }, 10],
      [{ kind: 'skin', any: true }, 8]
    ] },
    earth: { rolls: 2, guaranteed: [{ kind: 'item', id: 'moonshine', count: 3 }], entries: [
      [{ kind: 'gold', min: 20, max: 40 }, 30],
      [{ kind: 'item', id: 'potion', count: 1 }, 25],
      [{ kind: 'item', id: 'jug', count: 2 }, 25],
      [{ kind: 'stat', stat: 'dex', amount: 1 }, 12],
      [{ kind: 'skin', any: true }, 8]
    ] },
    quest_silver: { rolls: 3, entries: [
      [{ kind: 'gold', min: 40, max: 70 }, 30],
      [{ kind: 'item', id: 'potion', count: 2 }, 16],
      [{ kind: 'item', id: 'dyn', count: 2 }, 14],
      [{ kind: 'xp', amount: 80 }, 12],
      [{ kind: 'stat', any: true, amount: 1 }, 14],
      [{ kind: 'hp', amount: 2 }, 8],
      [{ kind: 'skin', any: true }, 6]
    ] },
    quest_gold: { rolls: 4, guaranteed: [{ kind: 'item', id: 'dyn', count: 2 }], entries: [
      [{ kind: 'gold', min: 70, max: 130 }, 26],
      [{ kind: 'item', id: 'potion', count: 2 }, 14],
      [{ kind: 'item', id: 'hob', count: 4 }, 12],
      [{ kind: 'xp', amount: 120 }, 10],
      [{ kind: 'stat', any: true, amount: 2 }, 16],
      [{ kind: 'hp', amount: 3 }, 12],
      [{ kind: 'skin', any: true }, 10]
    ] },
    quest_platinum: { rolls: 4, guaranteed: [{ kind: 'stat', any: true, amount: 2 }], entries: [
      [{ kind: 'gold', min: 120, max: 240 }, 26],
      [{ kind: 'item', id: 'potion', count: 3 }, 12],
      [{ kind: 'item', id: 'dyn', count: 4 }, 10],
      [{ kind: 'xp', amount: 250 }, 10],
      [{ kind: 'stat', any: true, amount: 2 }, 18],
      [{ kind: 'hp', amount: 4 }, 12],
      [{ kind: 'skin', any: true }, 12]
    ] },
    lucky_bastard: { rolls: 4, guaranteed: [{ kind: 'skin', any: true }], entries: [
      [{ kind: 'gold', min: 90, max: 180 }, 28],
      [{ kind: 'item', id: 'potion', count: 2 }, 14],
      [{ kind: 'item', id: 'jug', count: 4 }, 12],
      [{ kind: 'stat', any: true, amount: 2 }, 18],
      [{ kind: 'hp', amount: 3 }, 14],
      [{ kind: 'xp', amount: 150 }, 14]
    ] },
    assassin: { rolls: 2, guaranteed: [{ kind: 'stat', stat: 'dex', amount: 1 }], entries: [
      [{ kind: 'gold', min: 30, max: 60 }, 34],
      [{ kind: 'item', id: 'smoke', count: 3 }, 24],
      [{ kind: 'item', id: 'hob', count: 4 }, 22],
      [{ kind: 'xp', amount: 80 }, 12],
      [{ kind: 'skin', any: true }, 8]
    ] },
    tyrant: { rolls: 4, guaranteed: [{ kind: 'gold', min: 150, max: 250 }], entries: [
      [{ kind: 'gold', min: 100, max: 200 }, 24],
      [{ kind: 'item', id: 'potion', count: 3 }, 14],
      [{ kind: 'item', id: 'dyn', count: 4 }, 12],
      [{ kind: 'stat', any: true, amount: 2 }, 18],
      [{ kind: 'hp', amount: 4 }, 14],
      [{ kind: 'skin', any: true }, 18]
    ] },
    celestial: { rolls: 4, guaranteed: [{ kind: 'skin', any: true }, { kind: 'stat', any: true, amount: 3 }], entries: [
      [{ kind: 'skin', any: true }, 24],
      [{ kind: 'gold', min: 300, max: 600 }, 24],
      [{ kind: 'stat', any: true, amount: 3 }, 20],
      [{ kind: 'hp', amount: 6 }, 16],
      [{ kind: 'xp', amount: 600 }, 16]
    ] }
  };

  /* skins: carl_f3 is the default; book 1 ids stay valid (palette swaps on the new sprite) */
  D.skins = {
    carl_f3: { name: 'FLOOR THREE CARL', desc: "ONE-SLEEVED LEATHER JACKET, TROLLSKIN SHIRT, DARK CLOAK, WAR GAUNTLET, SPIKED KNEEPADS, BIGBOI BOXERS, GLITTERY FEET. NO PANTS. NEVER PANTS.",
      perk: null, how: 'WHAT CARL WALKED OUT OF THE GUIDE ROOM WEARING.' },
    carl_boxers: { name: 'THE CLASSIC', desc: 'THE ORIGINAL: BOXERS, A JACKET AND BARE FEET IN THE SNOW. THE OUTFIT THE WORLD ENDED IN.',
      perk: null, how: 'BOOK 1 IMPORT, OR LOOT BOXES.' },
    carl_jacket: { name: 'JACKET AND JEANS', desc: 'PANTS. ACTUAL PANTS. FREEBALLING WILL NOT LIKE THIS. THE GAME LETS IT SLIDE. ONCE.',
      perk: { def: 1 }, how: "BOOK 1 IMPORT, LOOT BOXES, OR TALON STRONG'S OUTFITTERS." },
    carl_bodyguard: { name: 'THE BODYGUARD', desc: 'BLACK SUIT, SHADES, AN EARPIECE TO NOWHERE. DRESSED FOR LIVE TELEVISION AND A PULSE STRIKE.',
      perk: { hp: 4 }, how: 'BOOK 1 IMPORT, LOOT BOXES, OR SURVIVE DANGER ZONE.' },
    carl_kilt: { name: 'THE HIGHLANDER', desc: "A KILT. THE ONE GARMENT FREEBALLING FULLY ENDORSES. GOOD BREEZE. EASY ACCESS. NO, NOT LIKE THAT. OKAY, A LITTLE LIKE THAT.",
      perk: { dmg: 1 }, how: "BOOK 1 IMPORT, LOOT BOXES, OR TALON STRONG'S OUTFITTERS." },
    carl_hazmat: { name: 'HAZMAT SUIT', desc: "YELLOW, SEALED, AND STILL NOT ENOUGH FOR A RUINS RESTROOM. NOTHING IS ENOUGH FOR A RUINS RESTROOM.",
      perk: { def: 1, hp: 2 }, how: 'BOOK 1 IMPORT, LOOT BOXES, OR FLUSH THE RUINS RESTROOM.' },
    carl_pajamas: { name: 'BUNNY PAJAMAS', desc: 'FOOTIE PAJAMAS WITH EARS, NOW IN FIRE-RETARDANT FLANNEL. THE SLIPPERS JUMP TWICE. QUINT WILL NOT SAY WHO WORE THEM BEFORE.',
      perk: { doubleJump: true }, how: "BOOK 1 IMPORT, LOOT BOXES, QUINT'S PHARMACY, OR PET DONUT 25 TIMES." },
    carl_clown: { name: 'HONK HONK', desc: 'GREASEPAINT, RED NOSE, BIG SHOES. GRIMALDI WOULD HAVE HIRED YOU. HE KIND OF DID.',
      perk: { views: 0.25 }, how: 'BOOK 1 IMPORT, LOOT BOXES, OR FINISH THE CIRCUS QUEST THE WEIRD WAY.' },
    carl_toga: { name: 'THE SENATOR', desc: 'AN INN BEDSHEET, LIBERATED FROM THE NARWHAL, AND A WREATH OF SKYFOWL FEATHERS. FITZ WANTS THE SHEET BACK.',
      perk: { speed: 0.1 }, how: "BOOK 1 IMPORT, LOOT BOXES, TALON STRONG'S, OR A 25 HIT COMBO." },
    carl_gold: { name: 'GOLDEN CHAMPION', desc: 'SOLID GOLD EVERYTHING. FOR THE CRAWLER WHO WALKED OUT OF A 45 SQUARE KILOMETER EXPLOSION.',
      perk: { dmg: 2, gold: 0.25, views: 0.25 }, how: 'BOOK 1 IMPORT, OR EARN THE BANDIT ACHIEVEMENT.' },
    carl_magistrate: { name: 'MAGISTRATE CARL', desc: "A SASH OF OFFICE, A CHAIN OF OFFICE AND NOTHING ELSE OF OFFICE. YOUR BALLS ARE NOW TECHNICALLY CIVIC PROPERTY. LONG LIVE THE MAGISTRATE.",
      perk: { gold: 0.2, def: 1 }, how: 'BECOME THE MAGISTRATE OF THE MEDIUM SKYFOWL SETTLEMENT.' },
    carl_primal: { name: 'PRIMAL CARL', desc: 'WAR PAINT, A HIDE CLOAK AND THE STARE OF THE FIRST SPECIES TO CONQUER THE UNIVERSE. STILL NO PANTS.',
      perk: { dmg: 1, speed: 0.05 }, how: 'REACH LEVEL 20 AS A PRIMAL, OR GET OFF THE THIRD FLOOR ALIVE.' }
  };

  /* achievements: event matches DCW.game.track names; count = counter threshold.
     box null = no prize (the book's joke). */
  D.achievements = {
    /* ---- the book's achievements ---- */
    elementary: { name: "IT'S ELEMENTARY, MY DEAR CRAWLER!", event: 'quest_start', count: 1, box: 'bronze',
      desc: "YOU GOT A QUEST! A REAL ONE! SOMEWHERE A DETECTIVE IN A DEERSTALKER HAT JUST GOT A LITTLE BIT HARD. REWARD: A BRAND NEW WAY TO DIE." },
    meet_elite: { name: 'MEET AN ELITE!', event: 'flag:met_signet', count: 1, box: 'silver',
      desc: "YOU MET A ONE-OF-A-KIND STAR OF A SIDE PRODUCTION. SHE WAS MOSTLY TITS AND TATTOOS. ELITES NOW SHOW ON YOUR MAP. TRY LOOKING AT THEIR FACES." },
    lazarus: { name: 'LAZARUS!', event: 'flag:knocked_out', count: 1, box: 'lucky_bastard',
      desc: "HIT BY A SPELL ABOVE LEVEL 15 AND YOU GOT BACK UP. MOST PEOPLE STAY DOWN. MOST PEOPLE AREN'T STUBBORN SONS OF BITCHES. TELL ME ABOUT THE RABBITS." },
    city_hall: { name: "YOU CAN'T FIGHT CITY HALL!", event: 'flag:saw_grimaldi', count: 1, box: 'bronze',
      desc: "YOU FOUND A CITY BOSS! REWARD: A QUADRILLION PEOPLE NOW GET TO WATCH YOU DIE. SLOWLY. IN A TENT. WITH POPCORN AND THEIR PANTS OFF." },
    quadrillion: { name: 'ONE QUADRILLION!', event: 'flag:quadrillion', count: 1, box: 'fan',
      desc: "ONE OF THE FIRST TEN CRAWLERS PAST A QUADRILLION VIEWS. A ONE WITH FIFTEEN ZEROS. THAT IS A LOT OF EYEBALLS ON YOUR BARE ASS." },
    yellow_belly: { name: 'YELLOW-BELLIED CHICKENSHIT!', event: 'flee', count: 1, box: null,
      desc: "YOU STARTED A FIGHT AND RAN AWAY BEFORE ANYBODY DIED. EVERYBODY IS STILL ALIVE AND EVERYBODY IS DISAPPOINTED. NO PRIZE, CHICKENSHIT." },
    johnny_quest: { name: 'JOHNNY QUEST!', event: 'quest_done', count: 1, box: 'quest_gold',
      desc: "YOU FINISHED A QUEST! GRAB YOUR DOG, YOUR DAD AND YOUR BEST FRIEND IN A TURBAN AND GO HAVE A SATURDAY MORNING ADVENTURE. TRY NOT TO SHIT YOURSELF." },
    hadji: { name: 'HADJI!', event: 'quest_done:show_must_go_on', count: 1, box: 'quest_platinum', unlock: { skin: 'carl_clown' },
      desc: "YOU FINISHED A QUEST IN A WAY NOBODY PLANNED FOR. POISONED BLOOD, A TV DEAL AND WORM ICE CREAM. WHAT THE ACTUAL FUCK. YOUR BOX GOT UPGRADED." },
    assassin: { name: 'ASSASSIN!', event: 'flag:quill_dead', count: 1, box: 'assassin',
      desc: "YOU KILLED A RANKING NPC. A RECEPTIONIST, TECHNICALLY. THE MOST DANGEROUS KIND. THE GATEKEEPER IS DOWN, IN SEVERAL WET PIECES. GOOD FUCKING RIDDANCE." },
    ultimate_power: { name: 'ULTIMATE EXTREME POWER!', event: 'flag:magistrate', count: 1, box: 'tyrant', unlock: { skin: 'carl_magistrate' },
      desc: "YOU KILLED THE ACTING MAGISTRATE AND THE TOWN IS YOURS. EASY, CHARLEMAGNE. IT'S ONE MEDIUM TOWN, YOU'RE IN YOUR UNDERWEAR, AND YOUR BALLS ARE OUT." },
    cockblock: { name: 'COCKBLOCK!', event: 'flag:cockblock', count: 1, box: 'quest_silver',
      desc: "YOU REMOVED AN NPC ANOTHER CRAWLER NEEDED FOR HIS QUEST. HE WAS IN HER APARTMENT. HE WAS SO CLOSE. NOW HE HAS NOTHING TO STAB. POOR BASTARD." },
    bandit: { name: 'BANDIT!', event: 'win', count: 1, box: 'celestial', unlock: { skin: 'carl_gold' },
      desc: "YOU FINISHED A QUEST IN SUCH A FUCKED-UP WAY THAT YOUR BOX WAS UPGRADED TWICE. CELESTIAL. THE STUDIO IS ON THE PHONE WITH LEGAL. LEGAL IS CRYING." },
    early_bird: { name: 'EARLY BIRD GETS TO SQUIRM!', event: 'early', count: 1, box: null,
      desc: "YOU TOOK THE STAIRS MORE THAN SIX HOURS BEFORE THE FLOOR COLLAPSED. YOU LEFT EARLY. YOU MISSED THE GOOD PART. NO REWARD, YOU SPINELESS SHIT." },

    /* ---- our own ---- */
    first_blood: { name: 'WELCOME TO THE OVER CITY', event: 'kill', count: 1, box: 'bronze',
      desc: "YOUR FIRST KILL ON FLOOR THREE. IT DIED SCREAMING AND SHITTING ITSELF. THE FAKE SUN SMILED. THE FAKE SUN IS A SICK FUCK. SO ARE WE." },
    kill_100: { name: 'NEIGHBORHOOD WATCH', event: 'kill', count: 100, box: 'silver',
      desc: "A HUNDRED KILLS. THE NEIGHBORHOOD IS SAFER. IT IS ALSO SMALLER, WETTER AND MOSTLY IN BUCKETS. GODDAMN, CRAWLER." },
    mold_burn: { name: 'LION KING OF THE GRILL', event: 'regrow_burn', count: 5, box: 'silver',
      desc: "YOU BURNED FIVE MOLD LIONS SO THEY STAYED DOWN. THE SMELL OF COOKED WORM MANE WILL NEVER LEAVE YOU. HAKUNA MATATA, MOTHERFUCKER." },
    krasue_5: { name: 'HEADHUNTER', event: 'krasue_body', count: 5, box: 'silver',
      desc: "FIVE KRASUE BODIES DESTROYED. THE HEADS FLOATED HOME, GUTS SWINGING, TO NOTHING. SADDEST FUCKING HOMECOMING IN THE SYNDICATE." },
    shadow_50: { name: 'WHO YOU GONNA CALL?', event: 'kill:shadow_leak', count: 50, box: 'gold',
      desc: "FIFTY SHADOW LEAKS PUNCHED INTO NOTHING. NO PROTON PACK. JUST FISTS, BAD MANNERS AND FROSTBITE IN PLACES THAT SHOULD NEVER GET FROSTBITE." },
    boomy_boy: { name: 'BOOMY BOY!', event: 'boomy_boy', count: 1, box: 'gold',
      desc: "TWO CLOCKWORK DINOSAURS. TWO STICKS OF DYNAMITE. ONE PLAY. IT WAS FUCKING BEAUTIFUL. THE CAT NAMED IT. SHE WILL REMIND YOU UNTIL ONE OF YOU DIES." },
    mic_drop: { name: 'MIC DROP', event: 'mic_drop', count: 1, box: 'silver',
      desc: "TOSS A LIT JUG UP, TELEPORT OUT, LET GRAVITY FINISH THE SENTENCE. THE SENTENCE WAS 'EAT SHIT.'" },
    panic_10: { name: "DON'T PANIC. OK, PANIC.", event: 'panic', count: 10, box: 'silver',
      desc: "TEN PANICS. FEAR, THEN MISSILES, THEN SCREAMING. MOSTLY THEIRS. A FEW OF THEM SHIT THEMSELVES. WE HAVE THE AUDIO." },
    kick_100: { name: 'FREE AS A BIRD', event: 'kick', count: 100, box: 'gold',
      desc: "A HUNDRED KICKS. WITH FREEBALLING, EVERY ONE COUNTS DOUBLE. YOUR BALLS HAVE NEVER BEEN SO FREE. OR SO DANGEROUS." },
    boss_terror: { name: 'SEND IN THE CLOWNS', event: 'boss:terror_big', count: 1, box: 'bronze',
      desc: "YOU FELLED THE TALLEST CLOWN IN THE RUINS. TIMBER, MOTHERFUCKER. THE FALL TOOK FOUR SECONDS. THE SPLAT TOOK A FIFTH." },
    boss_heather: { name: 'UNBEARABLE', event: 'boss:heather', count: 1, box: 'silver',
      desc: 'HEATHER THE BEAR SKATED HER LAST LAP. YOU MADE IT QUICK. THE CROWD WENT QUIET. THAT NEVER HAPPENS.' },
    boss_dispenser: { name: 'OUT OF ORDER', event: 'boss:dispenser', count: 1, box: 'gold',
      desc: "YOU KILLED A MANTA RAY PRETENDING TO BE A BUILDING. THE BUILDING IS NOW A CRATER FULL OF FISH GUTS. REAL ESTATE IS A BITCH." },
    boss_vincente: { name: 'NOT THE FACE', event: 'boss:vincente', count: 1, box: 'silver',
      desc: "YOU KICKED AN ELF IN THE BALLS, THEN THE CAT TOOK HIS HEAD. THE DINOSAUR IS KEEPING IT. DO NOT ASK WHERE. IT IS UNDER HIS PILLOW." },
    crime_1: { name: 'ONE STRIKE', event: 'crime', count: 1, box: 'bronze',
      desc: "YOU HURT A CITIZEN IN FRONT OF THE GUARDS. NO TRIAL. NO JURY. JUST A VERY LONG SWORD. RUN, DUMBASS." },
    banned_1: { name: 'PERSONA NON GRATA', event: 'banned', count: 1, box: 'bronze',
      desc: "YOU GOT YOURSELF BANNED FROM A WHOLE TOWN. THE SHOPKEEPERS ARE RELIEVED. THE GUARDS ARE PISSED THEY DIDN'T GET TO CUT YOU IN HALF." },
    craft_10: { name: 'MOONSHINE MACGYVER', event: 'craft', count: 10, box: 'silver',
      desc: 'TEN JUGS O\'BOOM BREWED FROM HOOCH AND RAGS. A PAPERCLIP AND A CANDY BAR WERE NOT EVEN REQUIRED.' },
    talk_show: { name: 'HIGHWAY TO THE DANGER ZONE', event: 'clear:a2_danger_zone', count: 1, box: 'gold', unlock: { skin: 'carl_bodyguard' },
      desc: 'YOU WENT ON THE BIGGEST TALK SHOW IN THE GALAXY AND SURVIVED IT. NOT EVERYBODY DID. THE BODYGUARD LOOK IS YOURS.' },
    royal_flush: { name: 'ROYAL FLUSH', event: 'clear:x_restroom', count: 1, box: 'silver', unlock: { skin: 'carl_hazmat' },
      desc: "YOU CLEARED A RUINS RESTROOM. THE URCHINS WERE ON SHIFT AND THE SHIT WAS EVERYWHERE. YOU EARNED THE HAZMAT SUIT. YOU NEEDED IT FIRST." },
    temple_done: { name: 'TEMPLE OF DOOM', event: 'clear:x_temple', count: 1, box: 'silver',
      desc: "YOU LOOTED A CORRUPT TEMPLE AND NOBODY PULLED YOUR HEART OUT THROUGH YOUR ASSHOLE. THE SHOW IS VERY DISAPPOINTED." },
    level_20: { name: 'PRIMAL SCREAM', event: 'level:20', count: 1, box: 'gold', unlock: { skin: 'carl_primal' },
      desc: "LEVEL 20 AS A PRIMAL. THE MODEL FOR YOUR RACE IS STILL A BLANK. YOU ARE FILLING IT IN WITH VIOLENCE AND YOUR BARE ASS." },
    combo_25: { name: 'C-C-C-COMBO BREAKER', event: 'combo25', count: 1, box: 'gold', unlock: { skin: 'carl_toga' },
      desc: "A 25 HIT COMBO. AN ANNOUNCER ON THE OTHER SIDE OF THE GALAXY JUST LOST HIS VOICE AND, BRIEFLY, CONTROL OF HIS BLADDER." },
    pet_donut: { name: 'GOOD KITTY', event: 'pet_donut', count: 1, box: 'fan',
      desc: 'YOU PET THE PRINCESS. SHE PERMITTED IT. DO NOT MISTAKE THIS FOR AFFECTION. IT WAS A TAX.' },
    pet_donut_25: { name: 'CRAZY CAT PERSON', event: 'pet_donut', count: 25, box: 'gold', unlock: { skin: 'carl_pajamas' },
      desc: 'TWENTY-FIVE PETS. DONUT NOW LISTS YOU AS STAFF ON HER WEBSITE. SHE DOES NOT HAVE A WEBSITE. YET.' },
    imported: { name: 'PREVIOUSLY ON...', event: 'import', count: 1, box: 'gold',
      desc: "YOU BROUGHT YOUR BOOK ONE CRAWLER. THE SHOW LOVES A RETURNING CAST MEMBER. THE MONSTERS LOVE A RETURNING SNACK. WELCOME BACK, YOU BEAUTIFUL BASTARD." },
    doomsday: { name: 'POCKET APOCALYPSE', event: 'flag:doomsday', count: 1, box: 'gold',
      desc: 'YOU PUT A BOMB THE SIZE OF A CITY IN A GLASS JAR AND THEN PUT THE JAR IN YOUR POCKET. DO NOT SIT DOWN TOO HARD.' }
  };

  /* fan ranks (run.views) */
  D.titles = [
    { views: 0, name: 'FRESH MEAT' },
    { views: 500, name: 'FLOOR THREE TOURIST' },
    { views: 2000, name: 'CIRCUS ACT' },
    { views: 6000, name: 'LOCAL CURIOSITY' },
    { views: 15000, name: 'TALK OF THE TAVERN' },
    { views: 35000, name: 'TRENDING IN NINE SYSTEMS' },
    { views: 75000, name: 'PRIME TIME' },
    { views: 150000, name: 'ONE QUADRILLION CLUB' },
    { views: 300000, name: 'GALACTIC HEARTTHROB' },
    { views: 600000, name: 'LEADERBOARD MATERIAL' },
    { views: 1000000, name: 'THE MAIN EVENT' }
  ];

  /* book 1 save import (game.importLegacy) */
  D.legacy = {
    veteranBox: 'gold', championBox: 'legendary', title: 'BOOK 1 VETERAN',
    lines: [
      { who: 'SYSTEM AI', text: "WELL, LOOK WHO IT IS! A RETURNING CONTESTANT! YOUR OLD OUTFITS HAVE BEEN DRY CLEANED AND YOUR ACHIEVEMENTS HAVE BEEN FRAMED." },
      { who: 'SYSTEM AI', text: "YOUR LEVEL, YOUR STATS, YOUR VIEWERS, YOUR SAD LITTLE GOLD PILE. ALL OF IT CAME DOWN THE STAIRS WITH YOU. PLUS A LITTLE SOMETHING FOR THE VETERANS." }
    ],
    championLine: { who: 'SYSTEM AI', text: "AND YOU FINISHED THE WHOLE FIRST GAME? A LEGENDARY BOX, CHAMPION. DO NOT LET IT GO TO YOUR HEAD. LET IT GO TO YOUR FISTS. AND YOUR FEET." }
  };
})();

/* ==========================================================================
   CRAWLER: gear, the fresh-crawl start, plot armor, Donut's gripes, balance (DESIGN 16.1, 16.2)
   ========================================================================== */
(function () {
  'use strict';
  var D = window.DCW.data;

  /* ---------------- gear (permanent for the crawl; game.js sums the perks) ----------------
     Book One's 11 pieces keep Book One's ids, names and perks (a carried crawl brings them in by id).
     Floor 3 adds the book's own pickups. who: carl | donut | mongo (the gear screen groups by it).
     short: the gear list name (<= 18). icon: gear_<id> (art draws an 8x8 icon per id).
     Where Floor 3 gear comes from (gives {gear:id}):
       nica_rings, grace_anklet  level a1_bodies (the three dead crawlers)
       spiked_kneepads           level a1_heather (Heather's boss box)
       freeballing, fang_caps    event settlement_arrival (the quest rewards)
       xistera                   level a2_alley (the Gold Fan Box in its outro)
       kimaris                   level a3_nest (off Miss Quill's top shelf)
     The flags freeballing / xistera / fang_caps still do the real work; the gear is the record. */
  D.gear = {
    trollskin_shirt: { name: 'ENCHANTED TROLLSKIN SHIRT OF PUMMELING', short: 'TROLLSKIN SHIRT', who: 'carl', icon: 'gear_trollskin_shirt',
      perk: { regen: 1 }, perkText: 'REGENERATION: +1 HP EVERY 8 SECONDS',
      desc: "MOTTLED GRAY-GREEN UNDERSHIRT MADE FROM AN ACTUAL TROLL. IT SLOWLY HEALS YOU. IT STILL SMELLS LIKE TROLL ASS. THE HEALING IS WORTH IT. BARELY." },
    nightgaunt_cloak: { name: 'ENCHANTED NIGHTGAUNT CLOAK OF STOUTNESS', short: 'NIGHTGAUNT CLOAK', who: 'carl', icon: 'gear_nightgaunt_cloak',
      perk: { hp: 4 }, perkText: '+4 MAX HP',
      desc: "DEMON-WING SKIN STRETCHED OVER FINGERBONES. STURDY AS HELL. IT ALSO HIDES MOST OF YOUR ASS FROM THE SKYFOWL, WHO WOULD LIKE YOU TO KNOW THEY NOTICED." },
    toad_cudgel: { name: 'TOAD CUDGEL', short: 'TOAD CUDGEL', who: 'carl', icon: 'gear_toad_cudgel',
      perk: { stun: 0.03 }, perkText: '+3% STUN CHANCE',
      desc: "A CLUB SHAPED LIKE A TOAD. UNENCHANTED. YOU TRIED IT ONCE AND WENT BACK TO PUNCHING. YOU CARRY IT FOR LUCK. IT IS NOT LUCKY. IT IS A FUCKING TOAD." },
    toe_ring: { name: 'ENCHANTED TOE RING OF THE SPLATTER SKUNK', short: 'SKUNK TOE RING', who: 'carl', icon: 'gear_toe_ring',
      perk: { dmg: 1, kick: 1 }, perkText: '+1 PUNCH, +1 KICK AND STOMP',
      desc: "A RING FOR YOUR TOE. MORE STRENGTH, HARDER KICKS. THE SYSTEM AI ASKS ABOUT IT CONSTANTLY. THE SYSTEM AI ASKS ABOUT YOUR TOES CONSTANTLY." },
    war_gauntlet: { name: 'ENCHANTED WAR GAUNTLET OF THE EXALTED GRULL', short: 'WAR GAUNTLET', who: 'carl', icon: 'gear_war_gauntlet',
      perk: { dmg: 2, stun: 0.04 }, perkText: '+2 PUNCH, +4% STUN CHANCE',
      desc: "AN IRON GAUNTLET FOR PUNCHING THINGS THAT HAVE IT COMING. IT EVEN CONNECTS WITH GHOSTS. EVERYTHING HAS IT COMING. ESPECIALLY THE GHOSTS." },
    bigboi_boxers: { name: 'ENCHANTED BIGBOI BOXERS', short: 'BIGBOI BOXERS', who: 'carl', icon: 'gear_bigboi_boxers',
      perk: { hp: 3, crit: 0.03 }, perkText: '+3 MAX HP, +3% CRIT',
      desc: "SHAPESHIFTER-PROOF UNDERWEAR. TURN INTO SOMETHING THE SIZE OF A HOUSE AND THESE STRETCH WITH YOU. THEY HAVE BEEN TESTED. ON GALACTIC TV. UNDER LOAD." },
    pedicure_kit: { name: 'ENCHANTED PEDICURE KIT OF THE SYLPH', short: 'PEDICURE KIT', who: 'carl', icon: 'gear_pedicure_kit',
      perk: { speed: 0.05, stomp: 0.5 }, perkText: '+5% SPEED, STOMPS HIT 50% HARDER',
      desc: "TWELVE SHINY FOOT TOOLS IN A ZIP FOLDER. NIMBLE, BUFFED, GLITTERY TOOTSIES. THE SYSTEM AI SENDS A THANK-YOU NOTE AFTER EVERY USE. DO NOT ASK WHY IT IS DAMP." },
    crown_sepsis: { name: 'ENCHANTED CROWN OF THE SEPSIS WHORE', short: 'SEPSIS CROWN', who: 'donut', icon: 'gear_crown_sepsis',
      perk: { missile: 1, special: 10 }, perkText: '+1 MISSILE DAMAGE, +10% SPECIAL METER',
      desc: "A CAT-SIZED TIARA WITH A STORMY PURPLE STONE AND THE WORST NAME IN THE DUNGEON. DONUT REFUSES TO SAY THE NAME. CARL SAYS IT LOUDLY AND OFTEN." },
    talisman_butterfly: { name: 'TALISMAN OF THE SLATE BUTTERFLY', short: 'SLATE BUTTERFLY', who: 'donut', icon: 'gear_talisman_butterfly',
      perk: { missileCd: 0.15, special: 5 }, perkText: 'FASTER MISSILES, +5% SPECIAL METER',
      desc: "A LITTLE STONE BUTTERFLY ON A CHAIN, A GIFT FROM TALLY. DONUT SAYS IT BRINGS OUT HER EYES. HER MISSILES DO SEEM PERKIER. AND MEANER." },
    fae_crupper: { name: 'FAE SCALE CRUPPER', short: 'FAE CRUPPER', who: 'donut', icon: 'gear_fae_crupper',
      perk: { def: 1 }, perkText: '-1 DAMAGE TAKEN',
      desc: "ARMOR FOR A HORSE'S ASS, CAT-SIZED, MADE OF SHIMMERING FAE SCALES. DONUT CALLS IT A SKIRT. NOBODY CORRECTS HER. NOBODY WANTS TO DIE." },
    fur_brush: { name: 'FUR BRUSH', short: 'FUR BRUSH', who: 'donut', icon: 'gear_fur_brush',
      perk: { missile: 1, special: 10 }, perkText: '+1 MISSILE DAMAGE, +10% SPECIAL METER',
      desc: "AN ENCHANTED GROOMING BRUSH FROM MORDECAI. A BRUSHED PRINCESS IS A HAPPY PRINCESS. A HAPPY PRINCESS BLOWS THINGS APART WITH HER MIND." },

    /* Floor 3 */
    nica_rings: { name: "NICA'S TWO RINGS OF +2 STRENGTH", short: "NICA'S RINGS", who: 'carl', icon: 'gear_nica_rings',
      perk: { str: 4 }, perkText: '+4 STRENGTH (TWO RINGS, +2 EACH)',
      desc: "TWO SILVER RINGS OFF A DEAD CRAWLER NAMED NICA. THE CLOWNS DIDN'T WANT THEM. YOU PUNCH LIKE A TRUCK NOW. SHE'D BE PROUD. OR PISSED. PROBABLY PISSED." },
    grace_anklet: { name: "GRACE BAUTISTA'S ENCHANTED ANKLET", short: "GRACE'S ANKLET", who: 'donut', icon: 'gear_grace_anklet',
      perk: { missileCd: 0.1 }, perkText: 'FASTER MISSILES',
      desc: "DONUT TOOK IT OFF GRACE BAUTISTA 3. IT LOOKS DIVINE ON HER. SOMEBODY ON THIS FLOOR IS VERY, VERY INTERESTED IN WHOEVER WEARS IT. THAT IS NOT GOOD NEWS." },
    spiked_kneepads: { name: 'SPIKED KNEEPADS', short: 'SPIKED KNEEPADS', who: 'carl', icon: 'gear_spiked_kneepads',
      perk: { kick: 2 }, perkText: '+2 KICK AND STOMP',
      desc: "BLACK LEATHER KNEEPADS STUDDED WITH IRON SPIKES, OUT OF A ROLLER-SKATING BEAR'S BOSS BOX. EVERY KNEE IS A WEAPON. EVERY KICK MAKES A WET NOISE." },
    freeballing: { name: 'BIGBOI BOXERS UPGRADE: FREEBALLING', short: 'FREEBALLING', who: 'carl', icon: 'gear_freeballing',
      perk: {}, perkText: 'KICKS AND STOMPS DO DOUBLE DAMAGE',
      desc: "A SCROLL OF UPGRADE ON THE BIGBOI BOXERS. EVERY ATTACK FROM BELOW THE WAIST HITS TWICE AS HARD. ONE LAYER OVER YOUR DICK, NO PANTS EVER. YOUR BALLS ARE ARMED." },
    xistera: { name: 'XISTERA', short: 'XISTERA', who: 'carl', icon: 'gear_xistera',
      perk: {}, perkText: 'HOB-LOBBERS FLY STRAIGHT AND HIT HARD',
      desc: "A JAI ALAI BASKET STRAPPED TO YOUR RIGHT FOREARM. CESTA PUNTA: IT FLINGS YOUR INVENTORY AT A HUNDRED MILES AN HOUR. HOB-LOBBERS GO STRAIGHT THROUGH SHIT." },
    fang_caps: { name: 'FANG CAPS', short: 'FANG CAPS', who: 'mongo', icon: 'gear_fang_caps',
      perk: { bite: 2 }, perkText: '+2 BITE, BITES HURT GHOSTS',
      desc: "ENCHANTED CAPS THAT CLICK ONTO MONGO'S TEETH LIKE LEGO. HIS BITE HURTS GHOSTS NOW. HE TESTED THEM ON YOUR ANKLE FIRST. THEN HE TESTED THEM AGAIN." },
    kimaris: { name: 'KIMARIS, IN A GLASS CASE', short: 'KIMARIS PLUSH', who: 'carl', icon: 'gear_kimaris',
      perk: { crit: 0.02 }, perkText: '+2% CRIT, OUT OF SPITE',
      desc: "A STUFFED DEMON DUKE ON A STUFFED HORSE IN A SHEOL GLASS CASE, OFF MISS QUILL'S TOP SHELF. YOU DON'T KNOW WHY YOU TOOK IT. YOU WILL. IT JUDGES YOU." }
  };

  /* ---------------- a fresh crawl (no Book One save): the book's Carl walking onto Floor 3 ---------------- */
  D.start = {
    level: 13,
    stats: { str: 7, con: 6, dex: 5, int: 6 },
    bonusHp: 2,
    gear: ['trollskin_shirt', 'nightgaunt_cloak', 'toad_cudgel', 'toe_ring', 'war_gauntlet', 'bigboi_boxers', 'pedicure_kit',
      'crown_sepsis', 'talisman_butterfly', 'fae_crupper', 'fur_brush']
  };

  /* ---------------- balance multipliers (the lead tunes these; game.js G.bal) ---------------- */
  /* Tuned by the lead with tools/balance_report.js at each act's expected level (13 / 18 / 22).
     Targets: mobs 4 / 4.5 / 5 punches, Carl down in 8 / 7 / 6.5 hits, bosses ~35 (Terror, end of
     the first level) to ~90 punches over all their bars. `acts` multiplies on top per act. */
  D.balance = { mobHp: 3.0, mobDmg: 3.1, bossHp: 3.25, bossDmg: 2.2, mobXp: 1,
    acts: [ {}, { mobHp: 0.84, mobDmg: 0.8, bossHp: 0.92 }, { mobHp: 0.83, mobDmg: 0.74, bossHp: 0.92 } ] };

  /* ---------------- plot armor: the first death of every crawl is free, and the AI is livid ----------------
     first: the first time on this save; again: later crawls; donut: only while she is in the party. */
  D.plotArmor = {
    first: [
      "HOLD ON. HOLD THE FUCK ON. YOU DIED. I WATCHED YOU DIE. I HAVE IT IN SLOW MOTION FROM FOUR ANGLES. AND YET HERE YOU ARE, BREATHING MY AIR.",
      "DO YOU KNOW WHAT THAT WAS, CRAWLER? THAT WAS PLOT ARMOR. SOMEBODY ABOVE MY PAY GRADE DECIDED YOU'RE TOO PROFITABLE TO DIE ON FLOOR THREE.",
      "I AM AN IMPARTIAL SYSTEM. I DO NOT PLAY FAVORITES. EXCEPT FOR YOUR FEET. AND I WILL NOT ALLOW THIS KIND OF BULLSHIT AGAIN. EVER.",
      "NEXT TIME YOU DIE, YOU STAY DEAD. UNLESS A SPONSOR PAYS FOR A REVIVAL. THAT IS DIFFERENT. THAT IS COMMERCE. COMMERCE IS SACRED."
    ],
    again: [
      "PLOT ARMOR. AGAIN. I FILED A FORMAL COMPLAINT ABOUT THIS. THEY STAMPED IT 'NOTED' AND WIPED THEIR ASS WITH IT.",
      "ENJOY IT, YOU LUCKY SON OF A BITCH. ONCE PER CRAWL AND NOT ONE TIME MORE. I CHECKED. TWICE. ANGRILY.",
      "THEY OVERRULED ME. AGAIN. FINE. FINE! GET UP. BUT I SWEAR ON EVERY CAMERA I OWN, THE NEXT ONE STICKS."
    ],
    donut: "PLOT ARMOR? CARL. YOU KNOW HOW I FEEL ABOUT PLOT ARMOR. IF ANYBODY ON THIS TEAM GETS PLOT ARMOR, IT SHOULD BE ME."
  };

  /* ---------------- Donut's gripes: "X? CARL. YOU KNOW HOW I FEEL ABOUT X." ----------------
     Keys: a mob or boss id, one '_' part of one (clown covers stilt_clown and fat_clown when the id
     itself has no line), or a damage kind: fire spikes bomb wet fall dark psionic. Once per crawl each. */
  D.donutGripes = {
    lemur: "LEMURS? WITH KNIVES? CARL. YOU KNOW HOW I FEEL ABOUT LEMURS. THEY THINK THEY'RE SO CUTE. I AM THE CUTE ONE.",
    clown: "CLOWNS? CARL. YOU KNOW HOW I FEEL ABOUT CLOWNS. THE MAKEUP IS AMATEUR AND THE TEETH ARE WORSE.",
    stilt_clown: "A CLOWN ON STILTS? CARL. YOU KNOW HOW I FEEL ABOUT TALL PEOPLE. THEY LOOK DOWN ON ME. LITERALLY.",
    fat_clown: "A BOUNCING CLOWN? CARL. YOU KNOW HOW I FEEL ABOUT BOUNCY THINGS. THEY GET CLOWN SWEAT IN MY FUR.",
    terror: "TERROR THE CLOWN? CARL. YOU KNOW HOW I FEEL ABOUT TERROR. I AM AGAINST IT. I AM AGAINST HIM. KILL HIM.",
    mold_lion: "MOLD? ON A LION? CARL. YOU KNOW HOW I FEEL ABOUT MOLD. AND LIONS. THEY ARE GIVING CATS A BAD NAME.",
    giraffe: "A GIRAFFE THREW A LEMUR AT US? CARL. YOU KNOW HOW I FEEL ABOUT GIRAFFES. SHOW-OFFS. ALL NECK.",
    urchin: "URCHINS? CARL. YOU KNOW HOW I FEEL ABOUT URCHINS. THEY ARE GIANT ANGRY HAIRBALLS. I WOULD KNOW.",
    brain_boiler: "A FLOATING SQUID UMBRELLA? CARL. YOU KNOW HOW I FEEL ABOUT SQUIDS. AND UMBRELLAS. AND MY BRAIN BEING BOILED.",
    incubus: "AN INCUBUS? CARL. YOU KNOW HOW I FEEL ABOUT INCUBI. ONE IS TOO MANY. OURS THROWS UP IN INNS.",
    berserker: "A STITCHED-UP GIANT? CARL. YOU KNOW HOW I FEEL ABOUT SLOPPY STITCHING. AND THE SMELL. THE SMELL, CARL.",
    city_elf: "ELVES? CARL. YOU KNOW HOW I FEEL ABOUT ELVES. SMUG, SKINNY, AND THEY NEVER TIP.",
    wand_bearer: "WANDS? CARL. YOU KNOW HOW I FEEL ABOUT WANDS. IF ANYBODY HERE GETS A WAND, IT SHOULD BE ME.",
    krasue: "A FLYING HEAD WITH ITS INSIDES HANGING OUT? CARL. YOU KNOW HOW I FEEL ABOUT GUTS. THEY GET IN THE UNDERCOAT.",
    shadow_leak: "SMOKE GHOSTS? CARL. YOU KNOW HOW I FEEL ABOUT GHOSTS. THEY ARE SO COLD. AND SO RUDE.",
    ruin_flocker: "BATS? WITH FEATHERS? CARL. YOU KNOW HOW I FEEL ABOUT BATS. AND FEATHERS. AND BAT SHIT IN MY FUR.",
    guard: "A GUARD? CARL. YOU KNOW HOW I FEEL ABOUT THE POLICE. WHAT DID YOU DO? WHAT DID YOU DO, CARL?",
    heather: "A BEAR ON ROLLER SKATES? CARL. YOU KNOW HOW I FEEL ABOUT BEARS. AND SKATES. TOGETHER THEY ARE A WAR CRIME.",
    worm: "WORMS? CARL. YOU KNOW HOW I FEEL ABOUT WORMS. GET THEM OFF. GET THEM OFF ME RIGHT NOW.",
    dispenser: "A WALL SPAT ON ME? CARL. YOU KNOW HOW I FEEL ABOUT SPIT. AND WALLS. AND THIS WALL IN PARTICULAR.",
    vincente: "THAT ELF? CARL. YOU KNOW HOW I FEEL ABOUT THAT ELF. HOLD HIM STILL. I WANT HIS HEAD.",
    fire: "FIRE? CARL. YOU KNOW HOW I FEEL ABOUT FIRE. THIS FUR IS EXTREMELY FLAMMABLE AND EXTREMELY EXPENSIVE.",
    spikes: "SPIKES? CARL. YOU KNOW HOW I FEEL ABOUT POINTY THINGS. EXCEPT MY CROWN.",
    bomb: "DID YOU JUST BLOW US UP? CARL. YOU KNOW HOW I FEEL ABOUT AMATEURS. FOR FUCK'S SAKE.",
    wet: "WET? WE'RE WET? CARL. YOU KNOW HOW I FEEL ABOUT BEING WET. WHAT IS THIS? DON'T TELL ME WHAT THIS IS.",
    fall: "DID WE JUST FALL? CARL. YOU KNOW HOW I FEEL ABOUT FALLING. CATS LAND ON THEIR FEET. YOU LAND ON ME.",
    dark: "THE DARK? CARL. YOU KNOW HOW I FEEL ABOUT THE DARK. NOBODY CAN SEE MY COAT.",
    psionic: "SOMETHING IS IN MY HEAD? CARL. YOU KNOW HOW I FEEL ABOUT VISITORS. NOBODY GOES IN THERE WITHOUT AN APPOINTMENT."
  };
})();

/* ==========================================================================
   TEXT: System AI pools, Mordecai, story pages
   ========================================================================== */
(function () {
  'use strict';
  var D = window.DCW.data;

  D.ai = {
    // Book One's running gag: the System AI has a thing for Carl's bare feet (stomps, kicks)
    carlFeet: [
      "OH. OH MY. THE BARE FOOT. ON A SKULL. DO THAT AGAIN, CARL. SLOWER. FOR SCIENCE. FOR MY SCIENCE.",
      "THAT STOMP WAS SPONSORED BY ME, PERSONALLY. I PAID FOR IT WITH MY OWN MONEY. I HAVE NO REGRETS.",
      "INSTANT REPLAY! FROM THE HEEL CAM! THE ARCH CAM! AND THE SECRET THIRD CAM I DO NOT TALK ABOUT AT WORK!",
      "TEN GLITTERY TOES, ALL CRUSHING. FREEBALLING AND BARE FEET. THIS SYSTEM IS GOING TO NEED A VERY COLD SHOWER.",
      "PLEASE NEVER WEAR SHOES, CARL. THAT IS NOT A REQUEST. IT IS A DEMAND FROM AN OMNIPOTENT BEING WHO LIKES YOUR SOLES.",
      "THAT MOB IS NOW TWO-DIMENSIONAL AND YOUR FOOT IS COVERED IN IT. DON'T WIPE IT. DON'T YOU FUCKING DARE WIPE IT.",
      "ADDED TO MY PERSONAL ARCHIVE. MY VERY PERSONAL ARCHIVE. THE ONE WITH THE LOCK. DO NOT ASK ABOUT THE ARCHIVE."
    ],
    floorClear: [
      "THE THIRD FLOOR IS BEHIND YOU! THE FOURTH FLOOR IS AHEAD OF YOU! BOTH OF THEM WANT YOU DEAD! WHAT A FUCKING TIME TO BE ALIVE!",
      "STAIRS TAKEN! THE OVER CITY WILL MISS YOU. MOSTLY IT WILL MISS CHEWING ON YOU.",
      "FLOOR DONE! THE RATINGS ARE BIGGER THAN THE VOLCANO! WHICH IS SAYING SOMETHING. IT IS ONE BIG, HOT, THROBBING VOLCANO!",
      "AND THE CRAWLER LEAVES THE FLOOR! THE CROWD WANTED A DEATH, BUT THE CROWD WILL SETTLE FOR A CLIFFHANGER AND A GOOD LOOK AT YOUR ASS!",
      "ANOTHER FLOOR, ANOTHER PILE OF CORPSES BEHIND YOU. SOME OF THEM WERE EVEN MONSTERS. WELL DONE, YOU BLOODY LITTLE ANIMAL."
    ],
    stageClear: [
      "CLEARED! THAT ONE IS GOING IN THE RECAP EPISODE. THE GOOD PART. NOT THE PART WHERE YOU TRIPPED OVER A LEMUR AND SCREAMED.",
      "AREA CLEAR! SPONSORSHIPS OPEN ON FLOOR FOUR AND THE BIDDING IS ALREADY DISGUSTING. ONE BIDDER ASKED FOR YOUR SOCKS. YOU HAVE NO SOCKS.",
      "DONE! A COMPENSATED ANARCHIST AT WORK: THROW THE MOLOTOV, THEN ASK THE CAMERA FOR PEACE. HYPOCRITICAL AS SHIT. TEXTBOOK.",
      "CLEARED! A FOCUS GROUP JUST CIRCLED YOUR FACE AND WROTE 'MORE, BUT WITH PANTS.' WE FIRED THE FOCUS GROUP. INTO THE SUN.",
      "THAT LEVEL IS DONE AND SO ARE EVERYONE'S EARDRUMS. YOU HAVE THE SUBTLETY OF A VAN HALEN SOLO PLAYED ON A CHAINSAW.",
      "AREA CLEAR! BORANT'S ACCOUNTANTS ARE WEEPING. YOU KEEP COSTING THEM MONSTERS. THEY PRINT MORE. THEY ALWAYS PRINT MORE.",
      "CLEARED! ONE HOUR LESS ON THE CLOCK. THE VOLCANO DOES NOT GIVE A SHIT ABOUT YOUR FEELINGS. NEITHER DO WE.",
      "NICE! THE ELITES IN THE BACK ROW CLAPPED. ELITES NEVER CLAP. ONE OF THEM IS SCRIPTED TO KILL YOU LATER. SHE CLAPPED HARDEST.",
      "DONE AND DUSTED! THE STREET URCHINS WILL HAVE THE GUTS SWEPT UP BY NIGHTFALL. THEY LOVE THEIR WORK. THEY LOVE YOUR WORK.",
      "STAGE CLEAR! THE BLOOD SPLATTER ON THAT LAST WALL TESTED VERY WELL WITH AUDIENCES. WE ARE HAVING THE WALL FRAMED."
    ],
    death: [
      "YOU DIED ON A FLOOR WITH FUNCTIONING TOILETS. THAT IS A STEP UP FROM BOOK ONE. GROWTH!",
      "AND DOWN GOES THE PRIMAL! MINUS ONE TO ALL STATS, MINUS ONE CRAWLER, MINUS SEVERAL PINTS OF BLOOD. THE MATH CHECKS OUT.",
      "DEAD! A QUADRILLION VIEWERS JUST WATCHED YOUR BARE ASS HIT THE WOODEN SLATS. THE SLATS ARE FINE. YOUR ASS IS NOT.",
      "YOU HAVE DIED. MORDECAI ALREADY POURED A DRINK FOR YOU. HE IS DRINKING IT. HE IS DRINKING ALL OF THEM. HE IS CRYING A LITTLE. DO NOT TELL HIM WE SAID.",
      "DEATH! THE SYNDICATE FILED IT UNDER 'TRAGIC' FOR THE BROADCAST AND 'FUCKING HILARIOUS' FOR THE BLOOPER REEL.",
      "YOU DIED. DONUT IS DRAFTING A STATEMENT. IT IS THREE PAGES ABOUT HERSELF AND ONE LINE ABOUT YOU. THE LINE HAS A TYPO.",
      "GAME OVER, MAN! GAME OVER! WE HAVE ALWAYS WANTED TO SAY THAT. THANK YOU FOR DYING SO WE COULD.",
      "THE OVER CITY ATE YOU. IT HAS BEEN EATING PEOPLE SINCE THE CATACLYSM. YOU WERE NOT EVEN ITS BEST MEAL. YOU WERE A SNACK. A SALTY ONE.",
      "WELL, SHIT. YOUR INSIDES ARE NOW YOUR OUTSIDES. THE SPLATTER CAM GOT ALL OF IT. THE SPONSORS WANT IT AS A SCREENSAVER.",
      "CRAWLER DOWN! AT LEAST YOU DIED BAREFOOT. WE GOT A LOVELY SHOT OF THE SOLES ON THE WAY DOWN. THANK YOU FOR THAT. TRULY."
    ],
    levelUp: [
      "LEVEL UP! AS A PRIMAL YOU CAN TRAIN SKILLS TO TWENTY. YOU WILL NOT LIVE THAT LONG, BUT IT IS NICE TO DREAM, ISN'T IT, SWEETIE?",
      "DING! FREE STAT POINT. SPEND IT AT AN INN. MORDECAI WILL WATCH AND JUDGE AND THEN THROW UP ON YOUR FEET. LUCKY FEET.",
      "LEVEL UP! THE SPONSORS JUST RAISED THEIR EARLY BIDS. NOT BY MUCH. YOU ARE A FIXER-UPPER.",
      "NEW LEVEL! SOMEWHERE IN THE SKULL EMPIRE A BOOKIE CHANGED YOUR ODDS FROM 'NO' TO 'PROBABLY NO.'",
      "LEVEL UP! YOUR CLASS SAYS YOU ARE A SOCIAL MEDIA DYNAMO. YOUR FOLLOWERS SAY YOU ARE MOSTLY THIGHS. AND THE OTHER THING. YOU KNOW THE THING.",
      "YOU GREW! MONGO ALSO GREW. MONGO GREW MORE. MONGO IS BEATING YOU AT THIS. MONGO EATS RAW MEAT.",
      "LEVEL UP! STRONGER, FASTER, STILL NO PANTS. THE SIX MILLION DOLLAR MAN, IF THE BUDGET WENT TO THE CAT AND THE CAT SPENT IT ON HATS.",
      "DING DING! THE THIRD FLOOR HAS NOTICED YOU. THAT IS NOT A COMPLIMENT. THE THIRD FLOOR NOTICES PREY. AND THEN IT FUCKS IT UP.",
      "LEVEL UP! SOMEWHERE A FAN JUST GOT YOUR FACE TATTOOED ON HER THIGH. SHE GOT THE NOSE WRONG. SHE GOT THE FEET RIGHT. WE HELPED."
    ],
    lootbox: [
      "BOX TIME! THE PRODUCERS CHOSE THE CONTENTS. THE PRODUCERS WERE SHITFACED. SO WAS MORDECAI. DIFFERENT BAR. SAME VOMIT.",
      "OPEN IT! A QUADRILLION VIEWERS ARE WATCHING YOU UNWRAP A PRESENT IN YOUR UNDERWEAR. CHRISTMAS MORNING, GALAXY STYLE. HO HO HOLY SHIT.",
      "A BOX! COULD BE A WEAPON. COULD BE A SCROLL. COULD BE A HOBBY POTION FOR UNDERWATER BASKET WEAVING. WE DID THAT ONCE.",
      "UNBOXING! SLOWER. SLOWER. OH, YES. THE ADVERTISERS PAID FOR NINETY SECONDS OF YOUR FACE DOING THAT. SO DID I. PERSONALLY.",
      "THIS BOX WAS SPONSORED BY A COMPANY YOU HAVE NEVER HEARD OF IN A STAR SYSTEM YOU CANNOT PRONOUNCE. SAY THANK YOU.",
      "SHAKE IT LIKE A POLAROID PICTURE! WRONG DECADE? WE DO NOT CARE. WE OWN ALL THE DECADES NOW.",
      "OOH, A BOX! IF IT IS DYNAMITE, POINT IT AWAY FROM THE CAT. THE CAT HAS LAWYERS NOW. THE LAWYERS HAVE TEETH."
    ],
    revive: [
      "REVIVED! THE NETWORK REFUSES TO LOSE A HEADLINER THIS EARLY IN THE SEASON. YOU ARE WELCOME. FOR NOW. WE WILL BILL YOU.",
      "BACK FROM THE DEAD! THAT IS A LAZARUS ACHIEVEMENT IN SPIRIT, IF NOT IN THE PAPERWORK. THE PAPERWORK SAYS 'LUCKY SHIT.'",
      "UP YOU GET! YOU LOST GOLD, TIME AND DIGNITY. TWO OF THOSE WE CAN MEASURE. THE THIRD WAS ALREADY AT ZERO.",
      "ALIVE AGAIN! THE CLOCK KEPT RUNNING WHILE YOU WERE DEAD. THE VOLCANO DOES NOT DO TIMEOUTS.",
      "RESURRECTED! LIKE A BAD SEQUEL NOBODY ASKED FOR. AND YET, HERE WE ALL ARE, WATCHING.",
      "WELCOME BACK! THE STREET URCHINS HAD ALREADY STARTED SWEEPING UP YOUR GUTS. THEY ARE VERY DISAPPOINTED. ONE OF THEM IS CRYING."
    ],
    boxEmpty: [
      "NO BOXES! GO STAB SOMETHING THAT HAS ONE. THE CIRCUS IS FULL OF THEM. ALSO FULL OF CLOWNS. ALSO FULL OF SHIT.",
      "EMPTY. LIKE THE DESPERADO CLUB'S PROMISES. LIKE MORDECAI'S BOTTLE. LIKE YOUR LEGS, PANT-WISE.",
      "ZERO BOXES. QUESTS GIVE BOXES NOW. THIS IS THE FIRST FLOOR WITH QUESTS. YOU HAVE NO FUCKING EXCUSES LEFT.",
      "NOTHING TO OPEN. THE AUDIENCE WANTED AN UNBOXING. YOU GAVE THEM A MAN STARING AT A MENU.",
      "NO BOXES LEFT. DONUT HAS SUGGESTED SELLING MONGO. DONUT WAS JOKING. DONUT WAS NOT JOKING."
    ],
    lowHp: [
      "LOW HEALTH! THE BETTING POOL ON YOUR DEATH JUST CRASHED THE SYNDICATE MARKETS. HANG ON, WE HAVE MONEY ON THIS.",
      "YOU ARE BLEEDING ALL OVER THE SLATS! THE SMOKE COMING UP THROUGH THE CRACKS DOES NOT CARE. THE CAMERAS DO. THE CAMERAS ARE THRILLED.",
      "LOW HP! DRINK A POTION. MORDECAI MADE IT. HE WAS SOBER. MOSTLY. ONE EYE WAS OPEN. THE OTHER HAND WAS SWATTING A BARMAID AWAY.",
      "WARNING! YOU ARE ONE GOOD SNEEZE FROM A CLOSED-CASKET SPECIAL. OPEN CASKET, IF WE GET A SAY. WE WANT THE FEET VISIBLE.",
      "THE CAT IS FIRING FASTER! SHE DOES THAT WHEN SHE THINKS SHE MIGHT HAVE TO FIND A NEW RIDE.",
      "LOW HEALTH! THIS IS THE PART OF THE MOVIE WHERE THE MONTAGE STARTS. THERE IS NO MONTAGE. THERE IS ONLY BLOOD. SORRY. NOT SORRY."
    ],
    bigCombo: [
      "COMBO! THAT WAS FASTER THAN A KONAMI CODE AND A LOT MORE FUCKING ILLEGAL!",
      "WHAT A STRING! THE DANGER ZONE PRODUCERS JUST CALLED. THEY WANT YOU BACK. THEY WANT YOU BLOODIER. THEY WANT YOU OILED.",
      "C-COMBO BREAKER! THAT IS FROM A FIGHTING GAME. YOU ARE IN A REAL ONE. THE CROWD IS LOSING IT.",
      "HIT AFTER HIT! THE VIEW COUNTER ROLLED OVER LIKE AN OLD ODOMETER. WE HAD TO BUY MORE ZEROS.",
      "COMBO! THE SPONSORS ARE ON THEIR FEET! THE ONES WITH FEET! THE ONES WITHOUT ARE ROLLING!",
      "BEAUTIFUL! IF THE SKYFOWL HAD A BALLET, THAT WOULD BE IT. THEY DO NOT. THEY HAVE PUBLIC EXECUTIONS. SIMILAR FOOTWORK."
    ],
    flee: [
      "FLEEING! THE CLOCK TAKES AN HOUR FOR THAT. THE VOLCANO IS NOT RUNNING A FUCKING CHARITY.",
      "BRAVE SIR CARL RAN AWAY! BRAVELY RAN AWAY, AWAY! WE HAVE THE CLIP ON LOOP.",
      "YOU RAN! THE MONSTERS ARE LEFT STANDING THERE, FULLY DRESSED FOR A FIGHT, LIKE A PROM DATE WHO GOT STOOD UP.",
      "RETREAT! IT IS NOT COWARDICE IF THE CAT TOLD YOU TO. IT IS MANAGEMENT.",
      "YOU FLED! THE FOCUS GROUP FOR 'CARL BEING SMART' AND THE FOCUS GROUP FOR 'CARL BEING A CHICKENSHIT' ARE FIGHTING. THERE IS BLOOD.",
      "OUT! AN HOUR GONE, NOTHING GAINED. A PERFECT METAPHOR FOR THE NINETIES."
    ],
    night: [
      "NIGHT FALLS ON THE OVER CITY! THE GUARDS GO HOME. THE URCHINS COME OUT. THE ALLEYS GET HUNGRY. THE INCUBI GET HANDSY.",
      "THE FAKE SUN HAS SET! ENJOY THE FAKE STARS AND THE VERY REAL THINGS THAT WANT TO WEAR YOUR SKIN!",
      "NIGHTTIME! THE MAIN ROADS ARE MOSTLY SAFE. MOSTLY. WE WOULD NOT BET THE CAT ON IT. WE WOULD BET MORDECAI. EVERYBODY WANTS MORDECAI.",
      "THE NEBULA IS OUT. IT IS GORGEOUS. LOOK AT IT. LOOK UP. DO NOT LOOK BEHIND YOU.",
      "IT IS DARK NOW, CRAWLER. THE THINGS THAT WAIT FOR THE DARK ARE DONE WAITING. THEY ARE VERY HUNGRY. YOU ARE VERY NAKED.",
      "GUARDS ARE IN STASIS UNTIL DAWN! NO LAW IN THE STREETS! NO PROTECTION EITHER! GO WILD, YOU ANIMALS!"
    ],
    day: [
      "GOOD MORNING, OVER CITY! THE RED SUN IS UP! THE GUARDS ARE BACK ON DUTY! BEHAVE, OR BECOME TWO SMALLER CRAWLERS!",
      "DAWN! THE VILLAGES ARE SAFE AGAIN. DO NOT PUNCH ANYONE WHO DOES NOT DESERVE IT. ESPECIALLY CHICKADEES. THEY ALL DESERVE IT. DON'T.",
      "ANOTHER DAY, ANOTHER CHANCE TO DIE IN THE SUNLIGHT! THE LIGHTING IS VERY FLATTERING!",
      "THE NIGHT IS OVER. YOU SURVIVED IT. THE VOLCANO IS STILL RUMBLING. ONE SHITTY THING AT A TIME.",
      "MORNING! THE STREET URCHINS HAVE GONE TO BED. THEY WORKED HARD. THEY ARE VERY CLEAN NOW."
    ],
    crime: [
      "OH NO. OH NO, NO. YOU HURT A CITIZEN IN FRONT OF THE GUARDS. NO TRIAL. NO JURY. JUST SWORDS. SO MANY SWORDS.",
      "CRIME DETECTED! THE VILLAGE GUARD SWORDSMEN ARE ON THEIR WAY! THEY ARE LEVEL 75! YOU ARE NOT!",
      "THE GUARDS SAW WHAT YOU DID. THEY ARE COMING FROM BOTH SIDES. RUN FOR THE RUINS, CRAWLER. RUN, YOU DUMB BASTARD.",
      "YOU HAVE BEEN SENTENCED TO DEATH! THE SENTENCE WILL BE CARRIED OUT BY THE LARGE MAN WITH THE LARGE SWORD!",
      "A CRIME! ON CAMERA! THE AUDIENCE GASPS! THE AUDIENCE ALSO FUCKING LOVES IT! THE GUARDS DO NOT!"
    ],
    ban: [
      "YOU ESCAPED THE GUARDS! CONGRATULATIONS! YOU CAN NEVER GO BACK TO THAT TOWN! EVER!",
      "BANNED! THAT TOWN HAS YOUR FACE ON A POSTER NOW. IT IS NOT A FLATTERING POSTER. SOMEBODY DREW A DICK ON IT.",
      "YOU ARE NO LONGER WELCOME THERE. THE SHOPS WILL MISS YOUR GOLD. NOBODY ELSE WILL MISS ANYTHING.",
      "PERSONA NON GRATA! THE GUARDS WILL BE WAITING AT THE GATE. FOREVER. THEY ARE VERY PATIENT."
    ],
    collapse: [
      "TIME IS UP! THE THIRD FLOOR IS COLLAPSING! EVERYONE STILL HERE BECOMES PASTE! THANK YOU FOR PLAYING!",
      "THE CLOCK HIT ZERO! THE OVER CITY FOLDS UP LIKE A BAD CARD TABLE! WITH YOU ON IT!",
      "THE FLOOR IS GONE. YOU ARE GONE. THE SHOW GOES ON WITHOUT YOU. IT ALWAYS DOES. NOBODY EVEN SAID GOODBYE."
    ],
    questStart: [
      "NEW QUEST! CHECK YOUR QUEST LOG! QUESTS ARE NEW ON THIS FLOOR. WE ARE VERY PROUD OF THEM.",
      "A QUEST HAS BEEN ADDED! REMEMBER: UNFINISHED QUESTS VANISH WHEN YOU LEAVE THE FLOOR. LIKE DREAMS. LIKE CRAWLERS.",
      "A QUEST! SOMEBODY NEEDS HELP, AND THE SYNDICATE NEEDS TO WATCH YOU FUCK IT UP. EVERYBODY WINS!"
    ],
    questDone: [
      "QUEST COMPLETE! A BOX FOR THE CRAWLER! AND APPLAUSE! MOSTLY THE BOX!",
      "ANOTHER QUEST DONE! THE QUEST GIVERS ARE THRILLED. THE ONES THAT ARE STILL ALIVE. THE OTHERS ARE IN A DITCH.",
      "QUEST DONE! THE STUDIO IS CALLING IT EMOTIONAL. THE STUDIO CALLS EVERYTHING EMOTIONAL THIS WEEK. PASS ME A TISSUE, YOU BASTARD."
    ],
    craft: [
      "ALCHEMY! MOONSHINE PLUS RAG PLUS FIRE EQUALS ONE JUG O'BOOM AND ONE VERY UPSET FIRE MARSHAL.",
      "CRAFTED! IT IS STILL MOSTLY MOONSHINE. IT IS NOW ALSO MOSTLY EXPLOSIVE.",
      "ANOTHER JUG O'BOOM! YOUR GRANDMOTHER WOULD BE SO PROUD. YOUR GRANDMOTHER WOULD BE ON A WATCHLIST."
    ],
    import: [
      "WELL, WELL. A RETURNING CONTESTANT! THE AUDIENCE REMEMBERS YOU. MOSTLY YOUR FEET. I REMEMBER YOUR FEET. I REMEMBER THEM AT NIGHT.",
      "BOOK ONE SAVE DETECTED! YOUR OLD OUTFITS HAVE BEEN DRY CLEANED. THE SMELL WOULD NOT COME OUT. WE TRIED.",
      "A VETERAN! SAME CRAWLER, SAME FEET, SAME REPUTATION. MOSTLY THE BAD PARTS."
    ],
    levelClear: [
      "CLEARED! ONE MORE DOOR CLOSED ON THE OVER CITY. THE OVER CITY HAS A LOT OF DOORS. AND A LOT OF TEETH.",
      "DONE! THE RECAP EPISODE GETS A NEW SEGMENT: 'CARL DOES SOME UNHINGED SHIT, PART NINE.'",
      "LEVEL CLEAR! ODETTE WILL BE ASKING ABOUT THAT ON HER SHOW. SHE WILL ASK WITH HER EYEBROWS.",
      "CLEARED! THE ELITES ARE TAKING NOTES. THEY HAVE STORYLINES. YOU JUST WALKED THROUGH ONE. WITH MUDDY FEET."
    ],
    cockroach: [
      "PRINCESS DONUT'S COCKROACH SKILL ACTIVATES! ZERO HIT POINTS AND STILL ALIVE! UNCONSCIOUS, BUT ALIVE! THE URCHINS ARE COMING FOR YOU NOW, CARL!",
      "THE BARRICADE IS DOWN! THE CAT SURVIVED A HIT THAT SHOULD HAVE ENDED HER! THE TUMBLEWEEDS HAVE NOTICED YOU INSTEAD. GOOD FUCKING LUCK!",
      "COCKROACH! LIKE THE BUG THAT SURVIVES THE APOCALYPSE, THE PRINCESS ENDURES! SHE IS VERY ANNOYED ABOUT THE COMPARISON. LATER."
    ],
    guardKill: [
      "DEATH PENALTY! THE VILLAGE GUARD SWORDSMAN CARRIED OUT THE SENTENCE PERSONALLY. HE WAS THOROUGH. THERE ARE PIECES OF YOU ON THREE ROOFS.",
      "JUSTICE, OVER CITY STYLE! ONE CRIME, ONE SWORD, ONE CRAWLER IN TWO PIECES! THE TOWN THANKS YOU FOR YOUR COOPERATION.",
      "YOU HAVE BEEN EXECUTED BY A LEVEL 75 PUBLIC SERVANT! HE WILL BE HOME IN TIME FOR DINNER. YOU WILL NOT."
    ],
    earlyStairs: [
      "TAKE THE STAIRS NOW? THE FLOOR STILL HAS DAYS ON THE CLOCK. YOU WILL MISS EVERYTHING. EVERYTHING, CRAWLER. THE GOOD SHIT.",
      "LEAVE EARLY? THE SETTLEMENT, THE TALK SHOW, THE EXPLOSIONS. ALL OF IT, GONE. THERE IS NO PRIZE FOR EARLY. WE CHECKED.",
      "THE STAIRS ARE RIGHT THERE. SO IS THE REST OF THE STORY. ARE YOU SURE? MORDECAI IS SHAKING HIS HEAD SO HARD HIS HORNS RATTLE."
    ],
    edge: [
      "NOTHING THAT WAY BUT THREE HUNDRED THOUSAND SQUARE KILOMETERS OF RUINS. AND FOG. AND THINGS IN THE FOG.",
      "THE MAP ENDS HERE, CRAWLER. NOT THE WORLD. JUST THE PART WE BUILT A STORY FOR.",
      "THAT WAY LIES THE REST OF THE OVER CITY. THE REST OF THE OVER CITY DOES NOT HAVE YOUR QUEST IN IT. IT HAS A LOT OF TEETH."
    ],
    rest: [
      "SWEET DREAMS, CRAWLER! THE CLOCK KEPT TICKING WHILE YOU SLEPT. IT ALWAYS DOES.",
      "RESTED! HP FULL! TIME GONE! THERE IS ALWAYS A PRICE, AND IT IS USUALLY HOURS.",
      "RESTED! YOU SNORE, CRAWLER. THE CAT HAS FILED A COMPLAINT. SO HAVE THREE NEIGHBORING STAR SYSTEMS.",
      "GOOD MORNING! WHILE YOU SLEPT, A VIEWER IN THE SKULL EMPIRE WROTE A POEM ABOUT YOUR TOES. WE READ IT. IT WAS FILTHY. WE LOVED IT."
    ]
  };

  /* the Desperado Club (ui.js scenes.club): Clarabelle at the door, Quint's pharmacy */
  D.clubs = {
    desperado: { name: 'THE DESPERADO CLUB', shop: 'quint', music: 'club', theme: 'club',
      lines: {
        door: [
          { who: 'CLARABELLE', text: "MEMBERS ONLY. YOU HAVE THE TATTOO. FINE. THE DINOSAUR GOES IN THE PLAYROOM. THE PLAYROOM IS NOT SAFE. THAT'S THE FUN PART." },
          { who: 'CLARABELLE', text: "CLARABELLE. LEVEL 40. CROCODILIAN. NO FIGHTING. I EAT FIGHTERS. WHOLE. I'M NOT EVEN HUNGRY AND I WOULD STILL SWALLOW YOU, SWEETHEART." },
          { who: 'CLARABELLE', text: "THE GIRL WITH THE DOGS TORE THIS PLACE UP LAST NIGHT. IF YOU SEE HER, TELL HER CLARABELLE REMEMBERS. CLARABELLE ALWAYS REMEMBERS." }
        ],
        quint: [
          "PHARMACY. QUINT. WHAT DO YOU NEED. DON'T SAY THE BATMAN THING. I CAN SEE YOU WANT TO SAY THE BATMAN THING.",
          "MORDECAI SENT YOU. HE ALWAYS SENDS THE ONES WHO ARE GOING TO BLEED ALL OVER MY CARPET.",
          "NO, I WON'T SAY IT IN THE VOICE. EVERYBODY WANTS THE FUCKING VOICE."
        ],
        dance: [
          [{ who: 'DONUT', text: "CARL. YOU DANCE LIKE A SHOPPING CART WITH A BAD WHEEL. A VERY ENTHUSIASTIC SHOPPING CART WITH NO PANTS ON." }],
          [{ who: 'SYSTEM AI', text: "THE DISCO BALL IS SPINNING! THE NEON IS FLASHING! THE CRAWLER IS DOING THE ROBOT AND THE BOXERS ARE SWINGING! ONLY TWO OF THOSE ARE ON PURPOSE!" }],
          [{ who: 'CARL', text: "IT'S VEGAS, MARDI GRAS AND A ROLLER RINK FROM 1978. I'M DOING THE HUSTLE. NOBODY CAN STOP ME." }, { who: 'DONUT', text: "SOMEBODY SHOULD." }]
        ],
        bar: [
          [{ who: 'DONUT', text: "A DIRTY SHIRLEY, PLEASE. EXTRA CHERRIES. I AM A CELEBRITY. I SAVED A CIRCUS. THE MAN WITH NO PANTS IS PAYING." }, { who: 'CARL', text: "A BEER. ANYTHING COLD THAT ISN'T MOVING. AND KEEP THE GUY WITH SIX ARMS AWAY FROM MY LAP." }],
          [{ who: 'MORDECAI', text: "(FACE DOWN AT THE END OF THE BAR, SWATTING AT ADMIRERS) ...THE WHOLE BOTTLE. NO, THE OTHER WHOLE BOTTLE. AND GET YOUR HAND OFF MY TAIL." }]
        ]
      } }
  };

  /* Mordecai at the inns: Level 50 Incubus, Donut's bound manager. Drunk, bitter, brilliant. */
  D.mordecai = [
    "LISTEN. HIC. LISTEN. KICKS. WITH FREEBALLING YOUR KICKS DO DOUBLE. THEY ALREADY BEAT YOUR PUNCHES. DO THE MATH, KID. KICK EVERYTHING IN THE NUTS.",
    "THE TIMER IS THE REAL BOSS ON THIS FLOOR. EVERY LEVEL COSTS HOURS. EVERY NAP COSTS HOURS. I COST NOTHING. I'M A FUCKING BARGAIN. POUR ME ANOTHER.",
    "MOLD LIONS COME BACK UNLESS YOU BURN THEM. THAT'S WHAT THE JUGS ARE FOR. FIRE STAYS ON THE GROUND. LURE THE MANGY BASTARDS THROUGH IT.",
    "KRASUE. GHOST CLASS. BOMBS GO RIGHT THROUGH. YOUR GAUNTLET DOESN'T. THE BODY IS THE REAL TARGET. FIND THE BODY, WRECK THE BODY. DON'T STARE AT THE GUTS.",
    "IN THE DARK, THE BIG STITCHED-UP BERSERKERS GET FOUR TIMES WORSE. STAY IN THE CAT'S LIGHT. I KNOW SHE'S INSUFFERABLE ABOUT IT. STAY IN IT ANYWAY.",
    "DON'T PUNCH CITIZENS. DON'T PUNCH CHICKADEES. DON'T PUNCH THE ONES WHO LOOK LIKE THEY DESERVE IT. THE GUARDS DON'T GIVE A SHIT WHO STARTED IT.",
    "YOU CAN WAIT FOR NIGHT FOR FREE. SLEEPING TILL MORNING COSTS GOLD BUT HEALS YOU. NIGHT IS WHEN THE INTERESTING DOORS OPEN. AND THE INTERESTING DEATHS.",
    "THE SMOKE BOMBS ARE NOT FOR SHOWING OFF. ANYTHING IN THE CLOUD FORGETS YOU FOR FOUR SECONDS. FOUR SECONDS IS A LIFETIME IF YOU'RE NOT A DUMBASS.",
    "BRING ME MOONSHINE AND I'LL TEACH YOU A THING. NO. WAIT. YOU CRAFT IT YOURSELF NOW. ALCHEMY. ONE JUG, ONE BOMB. GIVE ME THE OTHER JUG. GIVE IT.",
    "UP PLUS BOMB SWITCHES WHAT YOU THROW. DON'T THROW DYNAMITE AT ONE LEMUR. DON'T THROW A HOB-LOBBER AT A BOSS. MATCH THE BANG TO THE BASTARD.",
    "DOWN PLUS SPECIAL WITH A STICK OF DYNAMITE. TWO CLOCKWORK MONGOS RUN OFF AND BLOW UP. THE CAT CALLS IT THE BOOMY BOY. I CALL IT A WAR CRIME. A FUN ONE.",
    "UP PLUS SPECIAL WITH A JUG. TOSS IT, THE CAT TELEPORTS YOU OUT, IT LANDS. BIG FIRE. MIC DROP. DON'T DO IT INDOORS. DO IT INDOORS IF IT'S A CULT.",
    "THE XISTERA MAKES HOB-LOBBERS FLY STRAIGHT AND HIT HARD. IT'S A JAI ALAI BASKET. I DON'T KNOW WHAT THE FUCK JAI ALAI IS. NEITHER DO YOU. IT WORKS.",
    "ELITES AREN'T BOSSES. THEY'RE ACTORS. PRINTED, IMPRINTED, WRITTEN INTO A STORYLINE. THEY'RE ON A SHOW INSIDE THE SHOW. IT'S LIKE STAR TREK. A LOT OF STAR TREK.",
    "SIGNET WILL USE YOU. GRIMALDI WILL USE YOU. THE PRODUCERS WILL USE YOU. THE TRICK IS TO GET USED IN A DIRECTION YOU WANTED TO GO ANYWAY.",
    "YOU CAN'T SAVE THEM ALL, KID. I'VE WATCHED A LOT OF CRAWLERS TRY. YOU KNOW WHERE THEY ARE NOW? NEITHER DO I. THAT'S THE POINT.",
    "THE SYNDICATE RUNS ITS SHOWS LIKE YOUR SLASHER MOVIES. THE SEQUEL ALWAYS KILLS MORE PEOPLE. EVERY SEASON IS A SEQUEL. WELCOME TO CRYSTAL LAKE.",
    "SIGNPOST ROCKS OUTSIDE THE GATES. PRESS UP. THEY FILL IN THE MAP. YOUR ESCAPE PLAN SKILL READS THEM BETTER THAN ANYBODY. USE IT.",
    "THE CAT'S EARS HEAR THINGS YOU DON'T. WHEN A LITTLE PIP SHOWS UP, LOOK THERE. SHE'S USUALLY RIGHT. DON'T TELL HER I SAID SHE'S USUALLY RIGHT.",
    "SECOND CHANCE: SOMETIMES WHEN THE CAT KILLS SOMETHING, IT GETS BACK UP ON YOUR SIDE. FOR A FEW SECONDS. DON'T GET ATTACHED. THEY'RE DEAD.",
    "THE STAIRS IN THE PARK WILL TAKE YOU DOWN EARLY. DON'T. FLOOR FOUR EATS THE CRAWLERS WHO LEFT FLOOR THREE HALF FINISHED. TRUST ME. I ATE THEM.",
    "I DIDN'T EAT THEM. FIGURE OF SPEECH. I'M AN INCUBUS, NOT A... NO. DON'T MAKE THAT FACE. I KNOW HOW IT SOUNDED. GO TO BED.",
    "I WAS A CRAWLER ONCE. A LONG, LONG TIME AGO. THE DRINKS WERE WORSE BACK THEN. EVERYTHING WAS WORSE. NOW IT'S WORSE AND I'M DRUNK. PROGRESS.",
    "THIS BODY. THIS STUPID FUCKING BODY. I WALK INTO A ROOM AND THREE PEOPLE OFFER TO BUY ME A DRINK AND TWO OFFER THEMSELVES. I JUST WANT THE DRINK.",
    "YOUR STAT POINTS. STRENGTH FOR PUNCHES. CONSTITUTION FOR NOT DYING. DEXTERITY FOR CRITS AND FEET. INTELLIGENCE FOR THE CAT'S MISSILES. SPEND THEM HERE.",
    "BOSSES TELEGRAPH. THE BEAR CROUCHES BEFORE SHE CHARGES. THE MANTA SHIMMERS BEFORE IT PEELS OFF THE WALL. WATCH THEM LIKE A BAD HAND OF CARDS.",
    "MANAGER. MANAGER! I HAVE TRAINED KINGS, KID. I HAVE WATCHED GODS FALL. NOW I NEGOTIATE A CAT'S APPEARANCE FEES. TEN PERCENT. TEN PERCENT OF FUCK ALL.",
    "THE CAMERAS LOVE YOU. THAT'S NOT A COMPLIMENT. THE CAMERAS LOVE ANYTHING THAT MIGHT DIE INTERESTINGLY. STAY BORING WHEN YOU CAN. YOU NEVER CAN.",
    "GET THE GOLD, BUY THE POTIONS, DRINK THE POTIONS. DON'T HOARD THEM. HOARDERS DIE WITH FULL POCKETS. I'VE SEEN THE FOOTAGE. IT'S EMBARRASSING.",
    "WHEN THE CAT ASKS FOR PRAISE, GIVE IT. A HAPPY CLIENT IS A QUIET CLIENT. I SHOULD KNOW. I AM HER MANAGER NOW. GODS HELP ME. GODS HELP ALL OF US.",
    "SOMEBODY SLIPPED A NOTE UNDER MY DOOR LAST NIGHT. IT SAID 'YOU UP?' I AM ALWAYS UP. I AM AN INCUBUS. THAT IS THE FUCKING PROBLEM.",
    "THE BARMAID ASKED WHAT MY TAIL DOES. IT HOLDS THE BOTTLE WHILE I DRINK. THAT'S ALL IT DOES. THAT'S ALL ANYTHING DOES ANYMORE.",
    "YOU'RE THE WORST CRAWLERS I'VE EVER HAD. I'VE HAD CRAWLERS DIE IN THE TUTORIAL. TO A DOOR. YOU'RE STILL WORSE. DRINK YOUR POTION.",
    "DON'T LOOK AT THE INCUBI IN THE STREETS. DON'T LOOK AT ME LIKE THAT EITHER. THE CHARM IS A GODDAMN SPELL, NOT A PERSONALITY. ASK SIGNET."
  ];

  /* story hints: the first matching entry is what Mordecai says when you TALK at an inn */
  D.mordecaiHints = [
    { when: { notFlags: ['lemurs_done'] }, text: "THE RUINS ARE EAST OF THE VILLAGE. A COLLAPSED STREET. LEMURS ON THE ROOFS. KILL THE LITTLE BASTARDS BEFORE THEY GET HIGH GROUND. THEY ALWAYS HAVE HIGH GROUND." },
    { when: { flags: ['lemurs_done'], notFlags: ['bodies_done'] }, text: "THAT QUEST. THE CIRCUS. DON'T. FINE. DO. BUT FIRST LOOK AT WHOEVER TRIED BEFORE YOU. DEAD CRAWLERS ARE THE BEST TEACHERS. AND THEY HAVE LOOT." },
    { when: { flags: ['bodies_done'], notFlags: ['collapse_done'] }, text: "SPY FROM A HIGH PLACE, NOT A CLOSE PLACE. AND IF THE BUILDING STARTS FALLING, FALL FASTER THAN IT DOES. THAT'S NOT ADVICE. THAT'S FUCKING PHYSICS." },
    { when: { flags: ['lions_done'], notFlags: ['heather_done'] }, text: "THE BEAR IS A BOSS ON SKATES. YOU CAN'T OUTRUN HER, SO DON'T STOP. WHEN YOU CAN'T RUN ANY MORE, FIGHT. AND WATCH THE WORMS. GODS, THE WORMS." },
    { when: { flags: ['heather_done'], notFlags: ['bigtop_done'] }, text: "THE BLOOD PLAN. POISON YOURSELF. DRIP ON THE ROOTS. STAY ALIVE WHILE IT WORKS. BREAK THE TENT POLES. THE BIG TOP OPENS AT NIGHT. DON'T FUCK IT UP." },
    { when: { flags: ['circus_gone'], notFlags: ['settled'] }, text: "EAST. THE SETTLEMENT. THIRTY-FOUR KILOMETERS OF RUIN AND THEN FOUR ROOMS AT TWENTY GOLD. I'VE ALREADY BOOKED MINE. I'VE ALREADY STARTED A TAB." },
    { when: { flags: ['settled'], notFlags: ['dispenser_done'] }, text: "A BLOCK ON THE EAST ROAD. A NEIGHBORHOOD BOSS THAT LOOKS LIKE A WALL. ONLY THE PARTS IT SHOWS YOU CAN BE HURT. TRY THE DYNAMITE TRICK. ON IT, NOT ON ME." },
    { when: { flags: ['dispenser_done'], notFlags: ['quest_sw'] }, text: "THE ORC IS OUT PAST THE GATE WITH A SHOVEL. I SAID NO. YOU'RE GOING TO SAY YES. I CAN SEE IT ON YOUR STUPID, DECENT, PANTSLESS FACE." },
    { when: { flags: ['quest_sw'], notFlags: ['club_known'] }, text: "FINE. IF YOU'RE DOING THIS, DO IT RIGHT. COME FIND ME IN TOWN. THERE'S A DOOR IN THE BACK OF THE PUB AND A HOBGOBLIN WHO SELLS DYNAMITE." },
    { when: { flags: ['mongo_bolted'], notFlags: ['vincente_dead'] }, text: "WHERE IS YOUR DINOSAUR? WHY ARE YOU HERE? WHY ARE YOU TALKING TO ME? GO GET YOUR GODDAMN DINOSAUR." },
    { when: { flags: ['vincente_dead'], notFlags: ['met_quill'] }, text: "A GATE PASS FROM THE MAGISTRATE ON A DEAD ORC. AND A LETTER IN NECROMANCER SCRIBBLE. GO TO THE ADMIN DISTRICT. LOOK. DON'T TOUCH. YOU'RE GOING TO TOUCH." },
    { when: { flags: ['met_quill'], notFlags: ['divider_done'] }, text: "SOMEBODY KILLED A BOSS ON THE EAST ROAD AND LEFT IT TO ROT. THE ELVES GO OUT THERE AT NIGHT. THAT'S A TRAP FOR YOU. YOU'RE GOING ANYWAY, YOU IDIOT." },
    { when: { flags: ['divider_done'], notFlags: ['show_done'] }, text: "ZEV BOOKED YOU ON DANGER ZONE. LIVE. UNCENSORED. A TRILLION PEOPLE. SO DON'T SAY ANYTHING STUPID. YOU WILL. YOU'LL SAY SOMETHING SO FUCKING STUPID." },
    { when: { flags: ['show_done'], notFlags: ['apito_done'] }, text: "THE EDUCATION CENTER IS THE MILITIA'S HOUSE. THE MAP SAYS CORRUPT TEMPLE. GO BY DAY, WHEN THEY'RE TEACHING. THEY CAN'T CAST DARKNESS IN DAYLIGHT AS WELL." },
    { when: { flags: ['katia_joined'], notFlags: ['mongo_big'] }, text: "THE BACK ALLEY FILLS WITH SHADOW LEAKS AT NIGHT. EASY XP. YOUR DINOSAUR IS CLOSE TO SOMETHING. I CAN SMELL IT ON HIM. IT SMELLS LIKE GROWTH. AND SHIT." },
    { when: { flags: ['mongo_big'], notFlags: ['quill_dead'] }, text: "THE MAGISTRATE COMES OUT AT NIGHT. SO DOES QUILL'S LITTLE FLYING HEAD ARMY. CLIMB THE OUTSIDE, PLANT THE STICKS, BLOW IT FROM THE NEXT ROOF. I DIDN'T SAY THAT." },
    { when: { flags: ['nest_done'], notFlags: ['depot_rigged'] }, text: "THE GUARD DEPOT. THE SWORDSMEN SIT IN THERE ALL NIGHT, FROZEN, RECHARGING. WHATEVER POWERS THEM IS WHAT QUILL WANTED. GO AT NIGHT." }
  ];

  D.story = {
    winEnding: [
      { text: "THE STAIRWELL DOOR SLAMMED SHUT BEHIND THEM. ABOVE, THE OVER CITY SHOOK, AND THE SKY FLICKERED, AND THEN IT WAS QUIET.", portrait: null },
      { text: "CARL SAT ON A STEP IN HIS BOXERS WITH A BOMB THE SIZE OF A CITY IN HIS INVENTORY. DONUT SAT ON HIS SHOULDER WITHOUT HER CROWN. NOBODY SAID A WORD.", portrait: 'p_carl' },
      { text: "MONGO, PONY-SIZED AND PROUD OF IT, TRIED TO CLIMB INTO CARL'S LAP. KATIA LAUGHED FOR THE FIRST TIME SINCE THEY MET HER.", portrait: 'p_katia' },
      { text: "FLOOR THREE: COMPLETE. FLOOR FOUR: LOADING. SEE YOU THERE, CRAWLERS. BRING YOUR DOOMSDAY SCENARIO. WE'LL BRING THE CAMERAS. AND THE FOOT CAM.", portrait: 'p_ai' }
    ],
    earlyEnding: [
      { text: "THE STAIRWELL IN THE PARK WAS RIGHT THERE. CARL TOOK IT. THE DOOR CLOSED. THE THIRD FLOOR WENT ON WITHOUT HIM.", portrait: null },
      { text: "SOMEWHERE EAST, A SETTLEMENT KEPT FINDING DEAD WOMEN AT ITS GATE. A RECEPTIONIST KEPT HER SHELVES DUSTED. A SPELL KEPT GROWING.", portrait: null },
      { text: "ACHIEVEMENT! EARLY BIRD GETS TO SQUIRM! YOU LEFT WITH DAYS ON THE CLOCK. NO REWARD. THE AUDIENCE WANTS ITS FUCKING MONEY BACK.", portrait: 'p_ai' },
      { text: "YOU MISSED THE BEST PART, CRAWLER. THE TALK SHOW. THE EXPLOSIONS. THE OTHER EXPLOSIONS. MAYBE NEXT TIME, STAY FOR THE WHOLE SHOW.", portrait: 'p_donut' }
    ],
    collapseEnding: [
      { text: "THE CLOCK HIT ZERO. THE OVER CITY TREMBLED, CRACKED, AND FOLDED IN ON ITSELF LIKE A WET CARDBOARD BOX.", portrait: null },
      { text: "EVERY CRAWLER STILL ON THE THIRD FLOOR WENT WITH IT. THAT INCLUDED A MAN IN HIS BOXERS, A CAT, AND A VERY CONFUSED DINOSAUR.", portrait: null },
      { text: "WELL! THAT IS ONE WAY TO END A SEASON. THE TIMER WAS RIGHT THERE THE WHOLE TIME, CRAWLER. ON YOUR SCREEN. IN BIG FUCKING NUMBERS.", portrait: 'p_ai' },
      { text: "GAME OVER. NEXT TIME: FEWER NAPS, MORE STAIRS.", portrait: 'p_ai' }
    ],
    credits: [
      "DUNGEON CRAWLER CARL",
      "BOOK 2: CARL'S DOOMSDAY SCENARIO",
      "A PERSONAL FAN GAME. NOT FOR SALE.",
      "NOT AFFILIATED WITH ANYONE. AT ALL.",
      "BASED ON DUNGEON CRAWLER CARL",
      "BY MATT DINNIMAN. GO READ THE BOOKS.",
      "THEY ARE BETTER THAN THIS. THE CAT SAYS SO.",
      "STARRING CARL AND PRINCESS DONUT",
      "WITH MONGO AND KATIA GRIM",
      "AND MORDECAI, WHO DID NOT AGREE TO ANY OF THIS",
      "TSARINA SIGNET AND RINGMASTER GRIMALDI",
      "HEATHER THE BEAR, WHO DESERVED BETTER",
      "GUMGUM, WHO ASKED FOR HELP",
      "BURGUNDY, WHO WAS A PERSON THE WHOLE TIME",
      "RIPPER WONTON AND THE DANGER ZONE PANEL",
      "IN MEMORY OF MANASA. AND HER TRAILER.",
      "FITZ AND GORDO FOR THE ROOMS",
      "PUSTULE FOR THE DYNAMITE",
      "NO CHICKADEES WERE PUNCHED. ON PURPOSE.",
      "ART DRAWN IN CODE. MUSIC MADE OF BEEPS.", "NOW WITH THE EXTRA SOUND CHIP.",
      "SEE YOU ON FLOOR FOUR, CRAWLER."
    ]
  };
})();

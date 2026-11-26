# DUNGEON CRAWLER CARL - BOOK ONE (8-bit) - design + module contract

A personal fan game for adults, made to look and sound like a 1987 NES cartridge. It retells
**only Book 1** of Dungeon Crawler Carl: the First Floor and the Second Floor, in story order.
It is the first game of a planned series (Book 2 next, then "generation upgrades": a 16-bit
SNES-style game later). This folder is a fork of `../crawler/` (Dungeon Crawler World), which
stays untouched. Reuse its engine, controls, save slots, menus, combat and stage generator.

**Source material**: the fandom wiki (chapter summaries, First Floor, Second Floor, character
pages). Use the book's names, characters, mobs, bosses, items, achievements and events. Only
things that appear in Book 1. Nothing from Book 2 or later (no races/classes chosen, no Katia,
no Floor 3, no Samantha, no Signet, no overworld maps).

**Tone and language**: adult. The books swear constantly and so do we: the System AI is a
gleeful, profane game-show host; Carl is a sardonic, exhausted everyman ("Goddamnit, Donut");
Donut is a pampered, imperious, dramatic show cat who talks about Miss Beatrice and her
ratings; Mordecai is gruff and tired. Fuck, shit, asshole, bitch are all fine. No slurs,
nothing sexual about real people, nothing hateful. Keep it funny. Write ORIGINAL lines in the
characters' voices; very short iconic catchphrases and the official names of achievements/
items are fine, but do not paste paragraphs from the books or the wiki.

## The 8-bit rules (binding for art, UI and stage drawing)

The parent game drifted into 16-bit territory (dithered light maps, glows, alpha, gradients,
ambient particles). Book One goes back to strict NES:
- Colors: ONLY the NES 2C02 palette (the `C` table at the top of `art_actors.js`). No other hex values anywhere in drawing code.
- No alpha blending, no `globalAlpha` fades inside the playfield, no gradients, no glow, no
  light maps, no blur. Screen fades to black (`DCW.fade`) are fine (NES games stepped the
  palette to black). Flashes are full-color swaps, not translucent overlays.
- Sprites: 3 colors + black outline (+ transparent). Big bosses may use up to 6 by "layering" like NES metasprites. 1px black outline. Chunky readable silhouettes, big heads.
- Tiles: 16x16, at most 4 colors per tile. Clear solid tops.
- Backgrounds: a flat back color (usually black or a very dark NES color) plus at most two layers of repeating tile art, slow parallax. Dark and less saturated than the playfield. Torches flicker by swapping 2 frames / palette cycling.
- Animation: 2-4 frames per action is plenty (Carl and Donut keep their existing frames).
- Text: the existing 5x7 bitmap font, uppercase. Boxes are NES windows (`DCW.box`).
- `DCW.fancy()` now always returns false. stage.js must not run the light map or AMBIENT systems at all.
- Dark stages: a hard-edged circle of visibility around Carl (stepped, no gradient), black elsewhere.

## Files and owners (Book One)

| File | Owner | What |
|---|---|---|
| `index.html`, `js/engine.js`, `js/game.js`, `js/audio.js`, `DESIGN.md`, `tools/` | lead | shell, engine, run flow, gear/flags, audio aliases |
| `js/art_actors.js`, `js/art.js` | art | every sprite, portrait, tile, background |
| `js/data.js` | content | floors, stages, chunks, enemies, bosses, gear, loot, achievements, safe rooms, cutscene scripts, all text |
| `js/stage.js` | gameplay | the side-scrolling scene + new mechanics below |
| `js/ui.js` | ui | title, cutscene player, safe rooms, menus, HUD, gear screen, floor card, ending |

Rules for every builder:
- Edit ONLY your own files. Several builders work in this folder at the same time.
- Keep your file loadable at all times: make each edit complete, and run `node --check js/<file>.js` after every batch. A syntax error in your file breaks everyone's testing.
- Do NOT run any git command that changes state (no commit, add, checkout, stash, reset). The lead commits.
- Code defensively against other modules still being in progress (feature-detect, fall back, no crashes). If you need something from another module that this contract does not give you, write it down in your final report.
- Test in the browser with Playwright (see Tools). Screenshots of your work are expected.
- Classic scripts only (no ES modules, must run from `file://`), no network requests, no external assets.
- Old Dungeon Crawler World content (floors 3-11, races, parade, overworld, Katia, Samantha, Signet, Zev-as-companion, squeaks, skins other than the ones below) is dead. You may delete dead code/data/art in your own file when it is safe, which also keeps the game small. `overworld.js` is gone from this fork.

## Run flow and the floor sequence (game.js, lead)

New run: `CUT:prologue` (the Transformation on the surface) -> name entry (existing gag: you type a name, the AI calls you Carl anyway) -> floor card -> floor 1 sequence.

Floors are linear. `floor.sequence` is a list of steps:
- `'<stageId>'` - play a stage (`DCW.data.stages[id]`)
- `'SAFE:<roomId>'` - a safe room (`DCW.data.safeRooms[roomId]`)
- `'CUT:<cutsceneId>'` - a cutscene (`DCW.data.cutscenes[id]`)

When the sequence ends, the floor ends: next floor card, or (after floor 2) the win -> ending scene.
Death in a stage: existing revive/continue flow, retry the same stage.

### FLOOR 1 - THE FIRST FLOOR (5 days to collapse; floor is closed to live viewers: views do not count, HUD shows OFF AIR)
| step | id | what happens (book chapter) |
|---|---|---|
| cut | `f1_entrance` | Through the doors: crawler number, a flood of achievements (Crazy Cat Lady, Why Aren't You Wearing Pants?, Unarmed Combat, Early Adopter) and their boxes. The guild halls only admit crawlers who have killed a mob. (ch 2) |
| stage | `f1_hall` | THE FIRST HALLWAY. Tutorial stage: torchlit stone tunnel, rats, a couple of goblins, official dungeon signs teach the controls. Short. (ch 2) |
| stage | `f1_dozer_chase` | MURDER DOZER! Chase stage: the Goblin Murder Dozer (pursuer) grinds after you; run right, jump pits, goblins on top throw junk; the end door is Mordecai's guild hall. (ch 2-3) |
| cut | `f1_mordecai` | Mordecai the Rat Hooligan. Donut insults his mother. HUD and inventory switch on. Donut learns Magic Missile (flag `missile`). The dozer is still idling outside the door. (ch 3-7) |
| safe | `guild` | The tutorial guild hall, where Mordecai works as their assigned game guide (he doesn't run the guild): open the first boxes (Trollskin Shirt, Toad Cudgel, Enhanced Pet Biscuit, Crown of the Sepsis Whore...), tips, rest. |
| stage | `f1_dozer` | Boss: THE MURDER DOZER (mini-boss) in the hallway outside the guild. Armored front, hit the boiler on its back, or bomb it. Its blast is enchanted to hit the nearest non-goblin. (ch 3) |
| stage | `f1_llamas` | LLAMA COUNTRY. Bad Llamas (lava spit; punch the glowing throat pouch for an instant kill), rats. A llama drops the quest item `meth` (Baggie of Trailer-Park-Grade Meth). Scatterers start showing up. (ch 8) |
| stage | `f1_scatter` | SCATTERER ALLEY. Scatterers and brood guardians; stomping them is the point (Smush). (ch 8-10) |
| safe | `tally` | Tally's safe room: a Polish fast-food restaurant with a kids' play area. Tally the Bopca Protector serves Murgh Vindaloo (rest) and runs the shop. Salmon pate for Donut. (ch 9) |
| stage | `f1_hoarder` | Boss: THE HOARDER. A short approach to an old grimy door with a Spanish health-department notice, then her garbage-mountain chamber. She vomits scatterers; killing one as it emerges chokes her. (ch 10-12) |
| cut | `f1_episode1` | The first recap episode of Dungeon Crawler World: Earth airs on the safe-room TVs, plus the patch notes (bathroom doors no longer explode people, one roll of toilet paper per floor). (ch 14) |
| stage | `f1_goblins` | GOBLIN TOWN. Goblins, goblin shamankas, goblin bomb bards. Rory and Lorelai stand around as talkable NPCs. (ch 15) |
| cut | `f1_chopper` | Donut's charisma and Carl's Goblin Pass charm Rory and Lorelai; the meth buys the Goblin Copper Chopper with a sidecar fit for a princess (flag `chopper`). Carl eyes the workshop: steal everything that isn't nailed down. (ch 15-16) |
| stage | `f1_workshop` | Boss: THE GOBLIN WAR CHIEFTAIN in the goblin workshop, with bomb bards. (ch 17) |
| stage | `f1_fire` | GODDAMNIT, DONUT. Chase stage: the workshop is on fire (pursuer = wall of fire) and full of goblin dynamite. Run. (ch 17-18) |
| stage | `f1_rot` | ROT STICKER ROW. Rot stickers drop from the ceiling, latch on and explode. Rats, goblins. (ch 19) |
| safe | `cookie` | An unstaffed safe room: Experience Cookies (+XP once per visit), the TVs, a crate of boxes. The workshop earned War Criminal and You Monster!, a Bronze Asshole's Box with the Desperado Pass. Donut is appalled. (ch 19) |
| cut | `f1_frank` | Frank Q and Maggie My in the safe room; the second recap introduces Hekla; Frank and Maggie try an ambush; Carl plants goblin dynamite in a rat corpse's inventory and rides away. (ch 20) |
| stage | `f1_ride` | 100 MILES EAST. Ride stage on the Goblin Copper Chopper: jumps, ramps, mobs on the road, crates to smash. Ends at spray-painted MEADOW LARK signs. (ch 21) |
| cut | `f1_meadowlark` | The Meadow Lark Adult Care Community: Imani, Yolanda Martinez, Brandon and Chris Andrews, and the mysterious Agatha. Plans: kill the borough boss, claim its stairwell. (ch 22) |
| stage | `f1_trogs` | TROGLODYTE NEIGHBORHOOD. Troglodyte pygmies (fast, venomous, jump at you), bashers, virtuosos (15-foot tongue whip), rats. (ch 23) |
| stage | `f1_juicer` | Boss: THE JUICER. A 24-hour gym: "Bro. I need a spot, bro." He throws flaming plates; when he flexes his veins are exposed (double damage). (ch 24) |
| safe | `guild2` | A training guild hall with Mordecai: Carl finally gets the Enchanted War Gauntlet of the Exalted Grull; Donut learns Puddle Jumper. Gods and bosses discussed. (ch 25) |
| cut | `f1_swine_plan` | Scouting the Ball of Swine through the sealed portcullises. The redoubt plan. Le Mouvement mention on the recap. (ch 26) |
| stage | `f1_swine` | FLOOR BOSS: THE BALL OF SWINE (borough boss, a.k.a. the Porkchop Express), fought alongside Brandon, Chris, Yolanda, Imani and Agatha (allies). Dodge the rolling ball up on the redoubt platforms, punish it when it slams into a wall; when it pops, 30 dazed tusklings and a tuskling Dominatrix. The stairwell is in the middle. (ch 26-27) |
| cut | `f1_odette` | Down the stairs, teleported to a production trailer: Lexis, then Dungeon Crawler After Hours with Odette. Donut has the crowd eating out of her paws. Odette on race selection and not-so-random loot. (ch 27-29) |

### FLOOR 2 - THE SECOND FLOOR (6 days, the legal minimum; views, follows and favorites switch ON)
| step | id | what happens |
|---|---|---|
| cut | `f2_welcome` | The announcement: followers are live, patronage, and the bathroom rule (pee in the hall, get a level 93 Rage Elemental). (ch 30) |
| stage | `f2_maze` | THE CINDERBLOCK MAZE. White cracked floors, cinderblock walls with orange lichen. Brindle grubs (janitor mob: they spawn on corpses), Danger Dingoes, Mind Horrors (psionic headache aura). (ch 30) |
| safe | `shelter` | A safe room (a restaurant run by Qwist the Bopca): This Little Piggy Went to Market! (Enchanted Pedicure Kit of the Sylph); Donut joins the Dungeon Book of the Floor Club (Second Chance spell); Elle McGibbons wheels in. (ch 30-31) |
| stage | `f2_revup` | REV-UP COUNTRY. Unvaccinated Clurichaun Rev-Up Consultants (slingshots, the Taint), Laminak Rev-Up Consultant Elites (flying soccer moms who cast Magic Missile), grubs. (ch 32-33) |
| cut | `f2_jug` | Carl invents Carl's Jug O'Boom (moonshine, goblin oil, a torch for a cork). Dungeonpreneur. From now on bombs are Jug O'Booms: a blast plus burning splash (flag `jugs`). (ch 32) |
| stage | `f2_krakaren` | Boss: THE KRAKAREN CLONE. The Rev-Up distillery ("Live, Laugh, Love" over the door). Halfway through the stage she blasts out of her chamber through the cinderblock: Wait, Bosses Can Leave Their Rooms? Tentacle slams, sweeps, Taint snot, measles mist. (ch 33-34) |
| safe | `bugaboo` | Mordecai, now a Bugaboo. BigBoi Boxers for Carl, the Fur Brush for Donut. Zev the PR agent arrives. (ch 35-36) |
| cut | `f2_jack` | Escorting Meadow Lark to the stairs. Elle flirts. Played out, not narrated: Jack wanders to the wall; Donut's missile goes wide and Yolanda's crossbow bolt parts his hair; too late, the yellow arc hits the wall; the Rage Elemental tears in; Yolanda's last stand (bolts that do nothing) buys Randall four seconds; reverse gravity and everyone floats up. Then the plan: lure it into the stairwell with the chopper. (ch 37-39) |
| stage | `f2_rage` | THE DRIVE OF A LIFETIME. Ride stage with the Rage Elemental (unkillable pursuer) on your tail: keep speed up, drop Jug O'Booms behind you to stagger it, survive Reverse Gravity, and drive it into the stairwell (the finish). (ch 40) |
| cut | `f2_deathwatch` | Death Watch Extreme Dungeon Mayhem with the orc host the Maestro: Li Jun and Zhang, Frank and Maggie, Carl's gamble. Le Mouvement wiped; under a million crawlers. Zev brings news of Pork Boy. (ch 41-44) |
| stage | `f2_kobolds` | KOBOLD COUNTRY. Kobold riders on Danger Dingoes (lance charges), kobolds, dingoes, cow-tailed grubs, a Brindled Vespa or two. (ch 41, 45) |
| stage | `f2_ralph` | Boss: RALPH THE FRENZIED GERBIL in a Portuguese municipal dog pound. Caged dingoes line the arena: feed each a pet biscuit (PETA Enthusiast) or it joins Ralph in phase 2. Ralph is tiny: stomp him (time to pay the daddy tax). (ch 45-46) |
| cut | `f2_menagerie` | The pet reward room: I'll Take the Ceramic Dalmatian, Pat! and Menagerie. Ten cages. Mongo, a baby Mongoliensis, joins the Royal Court and chomps Donut's nose. (ch 46-47) |
| stage | `f2_return` | THE LONG WAY BACK. Fight back to the stairwell with Mongo (an extra ally) as the grubs hit the spawn limit and vespas hatch. (ch 47) |
| cut | `f2_descent` | Mongo bonds with Donut. Agatha shows up at the stairwell. The Royal Court descends. Epilogue on Odette's show: Pork Boy, Mongo, race selection, class advice. THE END OF BOOK ONE. |

Approximate playtime target: 60-75 minutes. Regular stages are short and punchy (NES length: 2-4 minutes).

## Data contract additions (data.js, content)

Everything in the inherited contract below still holds unless overridden here.

```js
D.floors = [
  { n: 1, name: 'THE FIRST FLOOR', tagline: '...', theme: 'tunnels', music: 'floor1', days: 5, viewers: false,
    intro: ['AI line', ...],                  // shown on the floor card
    sequence: ['CUT:f1_entrance', 'f1_hall', ...], par: 2400 },
  { n: 2, name: 'THE SECOND FLOOR', ..., theme: 'cinder', music: 'floor2', days: 6, viewers: true, sequence: [...] }
];

D.safeRooms = {
  guild: { name: "MORDECAI'S GUILD HALL", theme: 'safe_guild', music: 'safe',
    npc: 'mordecai',                         // 'mordecai' | 'tally' | 'qwist' | null  (who stands at the counter/table)
    services: ['mordecai', 'boxes', 'rest'], // stations, left to right, from: shop mordecai boxes rest cookies tv mailbox
    greet: [ {who, portrait, text}, ... ],   // first visit only
    extras: [ { sprite: 'zev_idle', x: 210, flip: true, lines: [...] } ]   // optional standing NPCs you can talk to
  }, tally: {...}, cookie: {...}, guild2: {...}, shelter: {...}, bugaboo: {...}
};
// station meanings: shop (buy from the npc), mordecai (tips + train stat points), boxes (open loot boxes),
// rest (full heal once per visit; text from restLine), cookies (experience cookies: +XP once per visit),
// tv (shows a random line from tvLines: recap gossip, patch notes, crawler counts), mailbox (F2 joke / club mail)
// optional per room: restLine, tvLines: [], mailLines: [], cookieXp: 30

D.cutscenes = {
  f1_entrance: {
    music: 'intro',
    panels: [
      { bg: 'stairwell',                      // any art background id (themes + cutscene backdrops, see Art)
        actors: [ { sprite: 'carl_idle', x: 140, flip: false, frame: 0 }, { sprite: 'donut_idle', x: 162 } ],  // feet on the panel floor
        fx: null,                             // optional: 'shake' | 'flash' | 'snow' | 'collapse' | 'fire' | 'static' | 'confetti'
        lines: [ { who: 'SYSTEM AI', portrait: 'p_ai', text: '...' }, { who: 'CARL', portrait: 'p_carl', text: '...' } ] },
      ...
    ],
    give: [ { kind: 'achieve', id: 'crazy_cat_lady' }, { kind: 'box', tier: 'bronze', from: 'EMPTY POCKETS' },
            { kind: 'gear', id: 'trollskin_shirt' }, { kind: 'item', id: 'biscuit', count: 2 }, { kind: 'flag', id: 'missile' },
            { kind: 'xp', amount: 20 }, { kind: 'gold', amount: 50 } ]    // applied by game.js when the cutscene ends
  }
};
// lines: who/portrait optional (default SYSTEM AI / p_ai). Text is auto-wrapped and paged (about 4 lines of 42 chars per page).
// Keep each panel to 1-5 lines. A cutscene is 3-8 panels. Actor x is 0-320, feet at the panel floor.

D.gear = {   // permanent for the crawl, shown in the GEAR screen; perks summed by game.js
  trollskin_shirt: { name: 'ENCHANTED TROLLSKIN SHIRT OF PUMMELING', who: 'carl', icon: 'shirt',
    perk: { regen: 1 }, skin: 'carl_trollskin', desc: 'short original AI-voice description' },
  ...
};
// perk keys: hp (+max hp), dmg (+punch), kick (+kick/stomp), stomp (x multiplier bonus, e.g. 0.5), def, crit (0.05),
// speed (0.05), regen (hp per 8 s in stages), missile (+Donut missile damage), missileCd (-seconds), special (+meter fill %),
// stun (chance), bombs (+max carry). `skin` (optional) switches Carl's outfit when gained.
// Book 1 gear ids (use these): trollskin_shirt, nightgaunt_cloak, toad_cudgel, toe_ring, war_gauntlet, bigboi_boxers,
// pedicure_kit (Carl); crown_sepsis, talisman_butterfly, fae_crupper, fur_brush (Donut).
// Gear is given by cutscenes (give), safe-room first visits (safeRooms[id].give: [...], same format), achievements
// (achievements[id].gear) and boss clears (bosses[id].gear).

D.items: potion (HEALTH POTION), bomb (GOBLIN DYNAMITE; becomes CARL'S JUG O'BOOM once flag `jugs`), biscuit (PET BISCUIT).
D.questItems: meth (BAGGIE OF TRAILER-PARK-GRADE METH, floor 1, sprite 'qi_meth') - dropped/placed in f1_llamas ('Q').

stages[id] new fields:
  kind: 'main' | 'boss' | 'chase' | 'ride'
  pursuer: { id: 'murder_dozer' | 'fire' | 'rage_elemental', speed: 62, delay: 2.5, dmg: 4 }   // chase + ride stages
  ride: { finishText: 'MEADOW LARK THIS WAY' }    // kind 'ride': the chopper; finish line 'F' in the end chunk
  breakout: true                 // boss stages: the boss bursts in through the wall when you reach the arena (Krakaren)
  allies: ['brandon', 'chris', 'yolanda', 'imani', 'agatha']   // NPC fighters standing on 'A' cells, in order
  extraAlly: 'mongo'             // a second companion that follows and bites (f2_return)
  janitor: { id: 'brindle_grub', chance: 0.4, cap: 10 }        // a kill can spawn grubs at the corpse (floor 2)
  npcs: [ { sprite: 'rory', portrait: 'p_rory', name: 'RORY', lines: ['...'] } ]          // standing NPCs on 'N' cells, in order
  noCompanionAttack: true        // Donut follows but cannot attack yet (before flag `missile`; f1_hall, f1_dozer_chase)

New chunk chars: `A` ally spot, `N` talkable story NPC, `C` dingo cage (pound arena; on ground), `B` pet biscuit pickup.
Ride/race chars from the parent still work: `Z` boost, `J` jump ramp, `O` oil, `F` finish (end chunk), `r` unused.

enemies[id] new optional fields:
  throatWeak: true          // melee hit during its attack telegraph kills it instantly ('throat_punch' event) - bad_llama
  dropper: true             // hangs on the ceiling, drops when Carl walks under, then latches on and explodes - rot_sticker
  aura: { r: 60, dmg: 1, every: 2.5 }   // psionic headache while Carl is within r px - mind_horror
  taint: 5                  // contact (or its projectile) applies the Taint for N seconds: no healing at all - clurichaun
  armed: true               // carries a weapon: bare-handed kill fires 'kill_armed'
  sprite: 'roach'           // reuse another sprite set (scatterer uses the parent's roach art)
bosses[id] new optional fields:
  armor: 'front'            // melee/missiles from the front do 0 ("CLANG"); behind or bombs do full (murder_dozer)
  gear: 'bigboi_boxers'     // gear granted on first kill
  phases[i].sprite / .w / .h // a phase can swap the boss to another sprite set and size (ball_of_swine -> dominatrix)
  phases[i].spawnOnEnter: ['tuskling', 12]  // spawn mobs when this phase starts (the ball pops)
  phases[i].releaseCages: true              // ralph: un-fed caged dingoes join the fight
  pursuer: true             // rage_elemental: cannot be killed; used only as a ride pursuer
New boss move primitives (stage.js implements): `roll` (accelerate to the far wall, slam, stunned 1.5 s; contact hurts a lot),
`tentacle` (telegraphed column slam at Carl's x), `sweep` (low tentacle sweep across the arena: jump it),
`mist:SECONDS` (drifting cloud that applies the Taint), `frenzy:N` (N quick hop-bites at Carl), `scream` (giant mouth,
short cone shockwave; uses `<sprite>_special`), `flex:SECONDS` (posing; takes double damage, flashes), `throw:PROJ:N`
(arcing lobs, like rain but aimed). Existing primitives stay.

New projectiles: `lava_spit` (bad llama, arcs a bit), `plate` (juicer's flaming weight, arcs, fire on landing),
`snot` (krakaren, taint), `acid` (vespa), `pebble` (clurichaun slingshot), `tongue` (virtuoso, short range, fast),
`dynamite` (bomb bard, arcs, explodes), `junk` (goblins on the dozer, arcs). Also keep `missile` (Donut, laminak).

D.mordecaiForms: { 1: { name: 'RAT HOOLIGAN', line: '...' }, 2: { name: 'BUGABOO', line: '...' } }  (art: mordecai_f1 / mordecai_f2)
D.truck: { name: 'GOBLIN COPPER CHOPPER', sprite: 'chopper', speed: 170, accel: 140, hp: 30 }   // the ride vehicle
D.skins: carl_boxers (default: leather jacket, boxers, bare feet), carl_trollskin (+ trollskin shirt under the jacket),
         carl_bigboi (trollskin shirt + BigBoi boxers). Unlocked by gear, switchable in the GEAR screen.
D.companions: donut (missile), mongo (bite; only as f2_return extraAlly and in the ending).

### Achievements and events
Achievements use the book's names (adult wording ok), each with an original snarky AI description and a reward
(`box`, optional `gear`). Events available to `achievements[id].event`:
existing: kill, kill:<enemyId>, boss:<bossId>, stomp, kick, bomb_kill, multi_bomb, potion, crate, coin, fall, death,
revive, box_open, combo10, combo25, no_damage_stage, floor:<n>, level:<n>, shop, flee, secret, win, pet_donut
new (stage.js emits): hit (damaged a mob), boss_hit, stomp_kill, throat_punch, spike, bomb (threw one), double_kill
(two kills within 0.4 s), sign (read a sign), ride_jump, boss_breakout, reverse_gravity, pursuer_hit, mine_hit (a dropped
jug/dynamite hit something chasing you), cage_calm, taint, sticker (a rot sticker latched on), janitor (grubs spawned)
new (game.js emits): gear (gained any gear), cookie, story:<cutsceneId> (when a cutscene finishes), safe:<roomId>
Required achievements (ids): crazy_cat_lady, why_no_pants, unarmed_combat, early_adopter, read_sign, entered_guild,
first_damage, first_kill, bare_hands, podophilia (gives toe_ring), boom, boss_babe, smush, level_up, throat_punch,
war_criminal, you_monster, fall_trap, two_chicks, borough_boss, found_stairs, grease_monkey, bosses_leave, dungeonpreneur,
what_goes_up, moth_flame, call_that_trap, ceramic_dalmatian, menagerie, peta, little_piggy (gives pedicure_kit), unvaccinated.
Add more if they fit the book.

## Stage mechanics (stage.js, gameplay)

- Remove/disable the light map, glow pass and AMBIENT life entirely. Dark stages use the hard-edged circle.
- `noCompanionAttack` stages (and any stage while the run lacks flag `missile`): Donut follows, never attacks, special does nothing ("DONUT HAS NO SPELLS YET").
- Gear perks from `DCW.game.playerStats()`: new fields `stompMul`, `regen`, `stun`, `missileDmg`, `missileCd`, `specialMul`, `jugs` (bool).
- **Chase stages** (`kind: 'chase'`, `pursuer`): after `delay` s the pursuer enters from the left edge and moves right at `speed`, rubber-banding (faster when far behind the camera's left edge, never slower than `speed`). The camera may not scroll left of it. Touching it: `dmg` damage and Carl is flung forward. murder_dozer = boss sprite `murder_dozer_walk` with goblins tossing `junk`; fire = a 2-frame wall of flame (`fire_wall`) with ember sprites; rage_elemental = boss sprite `rage_elemental_walk`. Bombs/jugs that hit the pursuer stagger it for 1.5 s ('pursuer_hit').
- **Ride stages** (`kind: 'ride'`): reuse the parent race engine with no rivals and no placement: the chopper (D.truck, sprite `chopper`) drives to the finish. A = jump, B/X = punch from the saddle (short range), bomb = drop a jug/dynamite behind (a mine). Enemies and crates on the road. Falling in a pit costs hp and respawns. Optional `pursuer` (rage_elemental) as above; the rage elemental also casts Reverse Gravity every ~8 s: a telegraph, then the chopper is flung high ('reverse_gravity'). Reaching `F` clears the stage.
- **Allies** (`stage.allies`, `A` cells): Meadow Lark fighters stand on their spots (on the redoubt platforms), fire at the boss/mobs every 1.5-2.5 s (Brandon and Chris: shotgun pellets; Imani: crossbow bolt; Yolanda: pistol; Agatha: a bubbling potion lob). They cannot die (they duck when hit). Sprites `<id>_idle` (2 frames) and `<id>_attack`.
- **extraAlly** (`mongo`): follows like a companion, bites the nearest mob (uses mongo_idle/run/act).
- **NPCs** (`N` cells, stage.npcs in order): stand idle; press UP next to one to show its lines with `DCW.ui.say`.
- **Rot stickers** (`dropper`): hang from the ceiling above the spawn point (search up to the first solid tile), drop when Carl is within 20 px horizontally, skitter toward him; on contact they latch (follow Carl, blink), fuse 1.5 s, then explode for 3 damage + knockdown. Pressing attack while latched flicks it off and kills it.
- **Bad llama** (`throatWeak`): its attack has a 0.6 s telegraph where its throat glows red (sprite `_attack`); any melee hit in that window kills it instantly with "THROAT PUNCH!".
- **Mind horror** (`aura`): headache damage ticks while within r; the screen wobbles 1 px. Stomps splat them.
- **Taint**: Carl cannot heal (snacks, potions, regen, rest do nothing) while tainted; HUD shows TAINTED with a timer; emits 'taint'.
- **Janitor** (`stage.janitor`): a kill has `chance` to spawn 1-3 grubs at the corpse (cap alive), emits 'janitor'.
- **Cages** (`C`): a cage with a hostile caged dingo (sprite `cage_dingo` frame 0 hostile / 1 calm). Stand next to it and press UP to feed a pet biscuit (needs `run.biscuits > 0`, `DCW.game.useBiscuit()`), turns calm, 'cage_calm'. When a boss phase has `releaseCages`, every hostile cage opens and a `dingo` jumps out.
- **Breakout** (`stage.breakout`): when Carl enters the arena chunk the wall at its left erupts (debris, shake, AI line), the boss appears, 'boss_breakout' fires.
- **Armor front** boss: hits from the side it faces show CLANG and do 0; from behind (or bombs/jugs) full damage.
- **Jugs** (flag `jugs`): bombs become Jug O'Booms: same throw, bigger blast, and leave burning blue fire patches on the ground for 3 s that hurt mobs (not Carl).
- **Pet biscuit pickup** (`B`): +1 biscuit.
- Boss moves listed above. Murder dozer uses `charge` + `armor: 'front'`; Hoarder uses `spawn:scatterer:N` from her mouth (a mob killed within 0.5 s of spawning chokes her for 15% of her max hp: "CHOKED!"), `walk`, a `grab` lunge (use `charge` short); Juicer `throw:plate:N`, `flex:2`, `charge`; Chieftain `throw:dynamite:N`, `spawn:goblin_bomber:2`, `jump_slam`; Ball of Swine `roll` loop, then pop phase (dominatrix: `walk`, `charge`, whip `shoot:pebble`); Krakaren `tentacle`, `sweep`, `shoot:snot:3`, `mist:4` (immobile: speed 0); Ralph `frenzy:3`, `scream`, `idle` with `releaseCages` in phase 2.
- Views: if `DCW.game.viewersOn()` is false (floor 1), stage.js still calls `addViews` (game.js returns 0) and must not show view popups.

## UI (ui.js, ui)

- Title: an 8-bit cartridge title screen. Logo DUNGEON CRAWLER CARL, ribbon BOOK ONE, Carl and Donut, the AI screen, "PUSH START". Menu: CONTINUE, NEW CRAWL, SAVE SLOT n, ACHIEVEMENTS, SETTINGS, HOW TO PLAY. "A FAN GAME" small. Dark flat background (no gradients).
- `ui.scenes.cutscene.enter({ id, onDone })`: plays `DCW.data.cutscenes[id]` Ninja Gaiden style: a letterboxed picture (black bars; the panel's `bg` drawn with `DCW.art.background(ctx, bg, camX, 0)` clipped to the picture area, actor sprites standing on the picture floor, simple 2-frame idles), then an NES text box under it with portrait + name + typewriter text. `fx` effects done the NES way (shake, white flash frames, falling snow pixels, sinking buildings, flicker of flames, TV static). confirm advances, start skips the whole cutscene. Missing ids/sprites never crash (fallback text page).
- Safe rooms: `ui.scenes.safeRoom.enter({ room })` builds stations from `D.safeRooms[room].services` (left to right) plus the exit door. Background `DCW.art.background(ctx, room.theme, 0, 0)`. Greet lines on first visit. Stations: shop (npc behind a counter), mordecai (the floor's Mordecai form: tips/train/rest), boxes, rest, cookies, tv, mailbox. Down near Donut = pet (existing).
- `ui.openGear()`: list of the run's gear (Carl's then Donut's), perk summary, scrollable description; outfit switch row when more than one skin is unlocked. SELECT (the old MAP button) opens it in stages and safe rooms; also in the pause menu. Remove the wardrobe and the map from menus.
- HUD (`drawHUD`): views show "OFF AIR" when `hud.viewersOff`; TAINTED tag when `hud.taint > 0`; biscuit count when `hud.biscuits > 0`; bomb icon becomes the jug when `hud.jugs`. Chase/ride stages: a small pursuer distance bar when `hud.pursuer` (0..1, 1 = on top of you).
- Floor card: FLOOR 1 / THE FIRST FLOOR / COLLAPSE IN 5 DAYS (floor.days), plus floor.intro lines.
- Settings: remove FANCY EFFECTS. Keep the rest (music, sfx, shake, CRT, touch, easy, keyboard controls, save slots).
- Ending: "THE END OF BOOK ONE", credits (D.story.credits), the stats page, and a teaser: CARL AND DONUT WILL RETURN IN CARL'S DOOMSDAY SCENARIO.
- Death scene keeps the parent's flow. Results screen as parent.
- How to play: rewrite for Book One controls (no map; SELECT = gear).

## Game API additions (game.js, lead)
```js
DCW.game.cutscene(id, onDone)      // play a cutscene, apply its give list + 'story:<id>', then onDone
DCW.game.enterSafeRoom(roomId)     // roomId from the current SAFE step if omitted
DCW.game.safeRoomDef()             // D.safeRooms[current room] (+ id)
DCW.game.giveGear(id, from) -> bool, hasGear(id), gearList() -> [{id, def}]
DCW.game.flag(id) -> bool, setFlag(id)            // 'missile', 'chopper', 'jugs', ...
DCW.game.biscuits() -> n, useBiscuit() -> bool, giveItem(id, n)
DCW.game.viewersOn() -> bool                      // floor.viewers !== false
DCW.game.eatCookie() -> xp gained (0 if already this visit)
DCW.game.give(list)                               // cutscene/safe-room reward list
DCW.game.playerStats() adds: stompMul, regen, stun, missileDmg, missileCd, specialMul, jugs
```
Run fields: `run.gear {id:true}`, `run.flags {id:true}`, `run.biscuits`, `run.room` (current safe room id),
`run.cookieHere`, `run.seenRooms {id:true}`.

## Art (art_actors.js + art.js, art)

All facing right, `(x, y)` = feet, NES palette only, outlines on actors. Sizes are guides.

Carl and Donut: keep. Add skins `carl_trollskin` (a mottled gray-green trollskin shirt under the jacket via the `t` torso
color) and `carl_bigboi` (trollskin shirt + gold-and-purple BigBoi boxers). Keep `carl_crouch` etc.

Mobs (`<id>_walk`(2) `<id>_attack` `<id>_hurt`):
| id | look | size |
|---|---|---|
| rat | keep parent art | 16x10 |
| goblin | keep | 14x14 |
| goblin_shamanka | goblin woman shaman with bone staff and beads (recolor/redo of parent `shaman`) | 18x16 |
| goblin_bomber | goblin bomb bard: a goblin with a lit dynamite stick and a little lute on its back | 15x15 |
| scatterer | use parent `roach` (alias the names: scatterer_walk = roach_walk etc.) | 17x10 |
| brood_guardian | cat-sized red-brown roach, bigger mandibles, angrier | 22x13 |
| bad_llama | horse-sized tan llama, huge yellow buckteeth, mean eyes; attack = throat pouch glowing red | 26x28 |
| rot_sticker | small black "ravioli" blob with tiny legs and one white eye; attack = blinking red | 10x8 |
| trog_pygmy | 3-ft komodo-dragon-headed troglodyte, loincloth, crude club, kangaroo legs | 13x16 |
| trog_basher | human-sized troglodyte, straighter legs, big fists | 18x24 |
| trog_virtuoso | small troglodyte; attack frame = long wet pink tongue lashing out | 13x16 (attack 40 wide) |
| tuskling | a small pink pig-orc aristocrat (knight with a dented helmet / lady in a ruffled dress), dazed | 14x18 |
| brindle_grub | fuzzy fat cat-sized worm, tortoiseshell black and brown | 18x9 |
| cow_grub | cow-tailed brindle grub: bigger, black-and-white cow spots, a tail | 22x11 |
| vespa | Brindled Vespa: human-sized hornet, clawed hands, brindled stripes | 24x20 |
| dingo | Danger Dingo: mastiff-sized, absurdly long fangs, black-metal corpse paint face | 24x16 |
| kobold | upright chihuahua man, spiked metal cap, beer-tab chainmail | 11x14 |
| kobold_rider | a kobold with a long feathered lance riding a dingo | 28x24 |
| mind_horror | floating brain-jellyfish, dangling tentacles, pink/purple | 16x20 |
| clurichaun | small hillbilly leprechaun: ruddy cheeks, runny nose, patched green overalls, buckled shoes, slingshot | 12x16 |
| laminak | crow-sized fat fairy, hummingbird wings, inverted bob haircut, leaf pantsuit; attack = red glowing hands | 14x14 |

Bosses (`<id>_idle`(2) `_walk`(2) `_attack` `_hurt` `_special`, portrait `p_<id>`):
| id | look | size |
|---|---|---|
| murder_dozer | rusty tractor-sized steam machine on tank treads, spiked spinning wheel on the front, black-smoke pipes, a fur-lined pit on top with goblin heads poking out, a small ladder and a glowing boiler on the back | 72x44 |
| hoarder | REDRAW for the book: a 15-foot obese woman, matted black hair, sores, one crooked tooth, ripped filthy t-shirt, tight blue sweatpants with PINK down the leg, barefoot; special = mouth open with a scatterer crawling out | 52x58 |
| chieftain | goblin war chieftain: big goblin, bone crown, war paint, huge cleaver, belt of dynamite | 30x32 |
| juicer | REDRAW for the book: 6'6" troglodyte-human monstrosity, lizard head with zits around beady eyes, absurd muscles with bulging veins, arms too big to lower, wide waddling stance, tiny black shorts, a tail; special = flexing (veins glowing) | 44x48 |
| ball_of_swine | a huge sphere of fused pink pig-orc bodies (snouts, hooves, helmets, frills), rolling frames rotate the detail | 56x56 |
| dominatrix | tuskling dominatrix: pig-orc woman in black leather with a whip | 22x30 |
| krakaren | 20-ft pink octopus: beaked mouth, clusters of eyes, a big suburban-mom blonde bob, tentacles covered in red-lipped screaming mouths; special = tentacle raised; `krakaren_tentacle` (16x96 vertical slam piece, 2 frames) | 80x72 |
| ralph | an absurdly cute gerbil; `ralph_special` = the mouth opened wider than physics, hiding the body (48x40) | 16x14 |
| rage_elemental | 15-ft mass of black and purple smoke, a flickering badger skull with curved goat horns and fire eyes, six obsidian rake claws, galloping | 72x60 |

Story NPCs (`<id>_idle`(2), most also `_attack` if they fight) and portraits `p_<id>` 32x32:
mordecai_f1 (Rat Hooligan: bearded rat-man a head shorter than Carl, black vest, blue pants, worn sandals - Master Splinter
energy), mordecai_f2 (Bugaboo: 7-ft neckless black-furred bear shape, huge owl eyes, comically skinny legs and arms),
tally (Bopca: barely counter-high, all hair - brown with a green tinge - black eyes, red bulbous nose, blue apron, paper hat),
qwist (another Bopca, different apron/hat colors), rory and lorelai (goblin shamanka sisters, bone jewelry; Lorelai younger),
frank_q (older man, white beard, bloodshot eyes, dirty coat), maggie_my (fierce woman, wild hair, crossbow),
brandon and chris (the Andrews brothers, big guys, shotguns; Chris taller and quieter), imani (calm leader, nurse scrubs,
crossbow), yolanda (tough older woman, pistol), agatha (tiny ancient lady in a shawl, unsettling smile, a potion),
elle (Elle McGibbons: older woman in a wheelchair, attitude), jack (old man, pants down, trouble), zev (keep parent art and
p_zev), odette (talk-show host, big personality, glam), lexis (stressed production assistant with a clipboard),
maestro (orc talk-show host in a tux), mongo (keep parent baby raptor + p_mongo), ai_screen + p_ai (keep).
Portraits for the bosses: p_murder_dozer, p_hoarder, p_chieftain, p_juicer, p_ball_of_swine, p_krakaren, p_ralph, p_rage_elemental.
Portrait expressions (nice to have): p_carl_mad, p_donut_smug.

Vehicles and objects:
`chopper` (Goblin Copper Chopper: mismatched copper scrap frame, thumping steam engine, alligator-skull seat with white fur,
disc wheels; Carl driving with his legs out, Donut in the sidecar on an orc-skull seat; 56x30, 2 frames) and `chopper_hurt`;
`fire_wall` (32x180 wall of flame, 2 frames) and `ember`(2); `cage_dingo` (24x24 cage, frame 0 snarling dingo, frame 1 calm
sleeping dingo) and `cage_open`; `stairwell` (the descending stairwell object, 48x40, for f1_swine/f2_rage/f2_return ends);
`guild_door` (a heavy wooden guild hall door with a shield sign, 26x38); `jug` (8x10 clay jug with a torch cork, spin 2 frames);
`blue_fire`(2) (16x10 burning puddle); `plate` (flaming weight plate 10x10); `lava_spit`, `snot`, `acid`, `pebble`, `tongue`,
`dynamite`, `junk` projectiles; `qi_meth` (a baggie); `biscuit` pickup; `sign` (keep).
Icons (8x8): `biscuit`, `jug`, `dynamite`, `shirt`, `cloak`, `ring`, `club`, `gauntlet`, `boxers`, `foot`, `crown`, `talisman`, `brush`, `skirt`.

Themes (tiles via `DCW.art.tile` for `# X = ^ ~ H b L`, backgrounds via `DCW.art.background`), all flat NES:
| theme | look |
|---|---|
| tunnels | First Floor: 30-foot torchlit hewn-stone tunnels, iron wall torches (2-frame flicker), lichen patches, side alleys of black |
| hoard | Hoarder's chamber: mountains of garbage, broken appliances, bags; skull torches |
| goblin | goblin town + workshop: rickety wood scaffolds, gear wheels, pipes, banners, junk |
| gym | the Juicer's 24-hour gym: rubber floor, weight racks, mirrors, motivational posters ("TODAY IS THE DAY YOU GAIN"), red boss light variant |
| swine | Ball of Swine lair: curved stone track walls, rounded portcullises, red forcefield around the stairwell |
| cinder | Second Floor: white cracked concrete floor, gray magical cinderblock walls, orange lichen, ambient-lit |
| distillery | Rev-Up distillery: copper still, moonshine jugs, bicycle blenders, "LIVE LAUGH LOVE" sign |
| pound | the kobold dog pound: chain-link, kennels, concrete, kobold banners |
| safe_guild, safe_tally, safe_cookie, safe_shelter, safe_bugaboo | safe room interiors (backgrounds; floor tile = theme `safe`): guild hall with potion shelves and a table; a Polish fast-food restaurant with a counter and a kids' play area and posters of plastic hippo/ferret toys; a small unstaffed room with three TVs and a cookie plate; a restaurant with booths (Qwist's); a guild hall with a different look |
Cutscene backdrops (backgrounds only): `surface` (a freezing night street: collapsed buildings sinking, snow, one ornate wrought-iron stairwell), `stairwell` (descending stone stairs and the big double doors), `trailer` (cramped production trailer), `studio` (Odette's talk-show set: couch, desk, audience rows, stage lights as flat shapes), `reward_room` (rows of pet cages), `tvroom` (a safe-room TV close-up frame: a big TV bezel filling the screen; cutscenes draw recaps "on" it), `deathwatch` (round-table TV set with a ring of light).

## Audio (lead)
Tracks: title intro floor1 floor2 boss boss_final safe results gameover ending lootbox, plus aliases: `chase`, `ride`,
`goblin`, `gym`, `rage`, `odette`, `tension`, `sad`. Use these names in data (`stage.music`, `cutscene.music`, `safeRoom.music`).
SFX: the parent list (jump land punch kick hit crit enemy_die hurt coin pickup bomb_throw explosion missile bite shield
menu_move menu_select menu_back lootbox_shake lootbox_open unlock level_up door boss_roar boss_die achievement stairs death
heal block buy error text_blip pause checkpoint crate_break spawn laser warn stomp splash fanfare views engine boost horn
countdown go skid crash).

## Integration notes (lead, after the build)
- `stages[id].arenaTheme`: the stage switches to this theme when the boss arena locks (f1_juicer -> `gym_red`, the gym turns red when the doors shut).
- Book box names: `achievements[id].boxName` and give entries `{kind:'box', tier, name}` keep the tier for the loot table but show the book's name ("BRONZE ASSHOLE'S BOX") in toasts, the box list and the opening screen (`DCW.game.giveLootBox(tier, from, quiet, name)`).
- Skipping: Enter is START + CONFIRM, so Enter only advances text. A whole cutscene or dialog is skipped by START alone (Esc, P, gamepad Start, touch START); the hint reads ESC: SKIP.
- Achievements are remembered per profile but re-earned (and re-rewarded) once per crawl, so gear tied to an achievement (podophilia -> toe ring, little_piggy -> pedicure kit) shows up in every crawl.
- Level design: the longest normal running jump is about 65 px, so plain gaps stay at 3 tiles or less (4+ only with moving platforms, or on the chopper). The tutorial's only pit is 2 tiles.
- Test hooks: `DCW.testHold = {right:1, jump:1}` holds several logical buttons at once; `tools/flow_test.js <dir> [--intro]` walks the whole book.

## Playtest round 2 (lead)
- Donut can't talk until she eats the Enhanced Pet Biscuit in Mordecai's guild (`f1_mordecai`, flag `talks`). Before that she only hisses and meows.
- Donut mode: beating the book sets `meta.donutMode` + `settings.donutMode` (all slots). Title shows NEW CRAWL AS DONUT -> `DCW.game.newRun('donut')`: `run.hero = 'donut'`, companion `carl` (ability bite, special GODDAMNIT, DONUT rampage). Donut's body is 12x13, she can't crouch, attack is a claw swipe until flag `missile`, then a homing Magic Missile (`castMissile`). Carl can't perch on a cat, so he catches up when she lands. Menus always show the duo (`pairComp()`); safe rooms swap who walks and who follows. Debug: `&hero=donut`.
- Companions never fall to their death: they leap gaps toward the player when there is somewhere to land, wait at the edge otherwise, and ride Carl's shoulder (`perch`) when he is mid-air over a drop.
- The Murder Dozer smashes every tile above the floor at its front edge (walls come down whole); the fire wall and the rage elemental pass through.
- Mob introductions: the System AI reads a mob's `flavor` when the first one of that kind dies (once per crawl, never during a boss fight). Stage intros no longer warn about mobs.
- Rot stickers stalk along the ceiling and drop where Carl will be (leading his speed); the first latch of a crawl shows PRESS ATTACK!
- Chopper ramps (`J`) never launch on their own: jumping while on one gives big air.
- Text always draws on whole pixels (half-pixel left-aligned text garbled on TV browsers).
- Jump rules, enforced by `node tools/reach_test.js` (exact physics) and `COMFORT=1 node tools/reach_test.js` (82 px/s run, a human margin): every non-arena chunk must pass both. In practice: spike strips on flat ground at most 2 tiles, plain gaps at most 3, acid pools at most 3.

## No boss spoilers (lead)
Never tell the player a boss's weak spot or trick before they find it: no "hit the boiler", "kill a minion as it crawls out", "hit the veins when he flexes", "hit the ball when it slams a wall", "stomp him", "feed the dogs". That goes for boss intros, phase lines, stage intros, cutscenes, Mordecai's tips, item descriptions and achievement text (locked achievements already hide theirs). Reactive feedback is fine and is how players learn: CLANG! on armor, CHOKED!, DIZZY!, and a phase line after the cages have already opened. Interactables get a blinking UP arrow when you stand at them; what they do is for the player to find out.

## Calm camera (lead)
The screen moves only when the player travels. Players reported motion sickness in boss arenas, where the old camera swung its look-ahead on every turn and slid toward the boss while Carl stood still, with two parallax layers sliding at different speeds behind it.
- Look-ahead (32 px) builds only after 0.35 s of running one way, at 60 px/s. Turning round to swing changes nothing.
- A dead zone (20 px in stages, 56 px in locked arenas) soaks up small steps. The follow target is clamped to the level and arena bounds before easing, so the view never drifts past a wall.
- Locked arenas never track the boss. When it is off screen, a white arrow blinks at that edge, level with it.
- Parallax rates are 1/4 (far) and 1/2 (near) on every theme, for an even NES cadence (0.2 and 0.45 stepped unevenly).
- The psionic headache is a slow 1 px vertical sway, not a 7.5 Hz jitter.
- A companion special shows its big name card the first time it is used each run (`run.specialsSeen`). After that the name pops over the caster. There is no full-screen white flash.
- `node tools/cam_test.js <stageId> idle|turn|fight|run` reports camera travel and how often the view moved while Carl stood still. Idle and turn should be 0 in arenas.

## Readable playfield (lead)
The background must always be darker, or a different hue, than anything the player stands on or fights. Floor 2 broke this: mid-gray cinderblock behind light-gray cinderblock floors, gray catwalks, gray kobolds and white cow grubs, so everything blended into the wall.
- Floor 2's far wall and pillars (`CN` in art.js) are deep slate (`c0` faces, black mortar, `c1` lit edges). The distillery wall uses the same shadow.
- Lichen in the background stays dark rust (`n0`). Bright orange blobs there read as brindle grubs.
- New themes: check a screenshot with mobs on screen. If a tile or a mob is the same color family as the wall behind it, darken the wall, not the sprite.

## Difficulty pass 1 (lead)
Playtesters never needed a revive, and floor 2 mobs felt no stronger than floor 1. Measured with Carl at the level he normally has at each stage: floor 2 mobs died in under 2 punches, and Carl could take 21 to 28 hits.
- **Pits are death,** on foot and on the motorcycle (god mode keeps the old drop-back respawn). Every death sets `run.hp = 0`, so quitting to the title and continuing lands on the death screen again instead of a free restart.
- **Checkpoint flags are saved to the run** (`run.checkpoint`). A sponsor revival rebuilds the same seeded layout and starts Carl at the last flag he touched. The checkpoint clears on stage clear, on entering a different stage, or on fleeing.
- **Mobs level up with the dungeon.** `D.floors[i].mobs = { hp: [first, last], dmg: [first, last] }` gives an HP multiplier and added hit damage, ramped by the stage's place in the floor. Floor 1 goes from 1.0x/+0 to 1.6x/+2; floor 2 from 1.8x/+2 to 2.4x/+3. This applies to mobs, elites and enemy shots. Bosses keep their hand-tuned numbers.
- **Result at the normal level for each stage:** floor 2 takes 3 to 4 punches per mob, and Carl goes down in 7 to 9 hits. Late floor 1 takes 2 to 3 punches and 9 to 11 hits. The hall tutorial is unchanged.
- **Plot armor:** the first death of every crawl is free. Carl returns to the last checkpoint flag with full HP, no revival spent and no gold lost. The System AI complains that it was plot armor and swears it won't allow that meddling again (`D.plotArmor`: `first` plays once per save, `again` on later crawls, plus a Donut line once she can talk). The stage-name banner is skipped on that return. Every later death goes to the death screen and the sponsor revivals.
- Remaining levers, not yet changed: the level-up heal (1 + 30% of max HP), a full heal at every safe room, +1 max HP per level, the regen shirt, 1.1 s of i-frames, and boss damage.

## Donut mode controls (lead)
- **Attack:** always a paw swipe (the punch chain, drawn as claws).
- **Bomb button:** her homing Magic Missile, with no ammo and just a cooldown. Before she learns it, it says "NO SPELLS YET". The HUD shows a magic icon instead of the bomb count, and the touch button reads MAGIC.
- **Carl's special, BAREFOOT JUSTICE** (`special.kind: 'stomp'`): Carl leaps, dropping through thin platforms, and a giant bare foot with its shin running out of frame slams onto the floor. Every mob on screen takes heavy damage and gets a "SQUISH!", and bosses take 1.5x. Each stomp gets a line from `D.ai.carlFeet`.
- **Carl follows Donut's trail** (`updCarlTrail`). The game records the path Donut actually takes, and Carl walks it a `follow` distance behind her. He speeds up in proportion to his lag, so he stays roughly 12-40 px back even in chases. Where her path breaks (a moving platform, a door, a respawn, his own stomp), he makes one big human leap (`carlArc`) to the next solid ground on it, or waits at the edge while she's still out on a platform. The levels are built for Carl, so anywhere she got, he can: he never falls and never vanishes. He punches anything within arm's reach without leaving the trail (`carlPunch`).
- **Running joke:** the System AI has a thing for Carl's feet. Keep it comic, never explicit.

## Boss phases are full health bars (lead)
Every boss phase is its own full health bar. When a bar empties and another phase is left, the boss enters it immediately at full health, with the phase banner and a "FULL HEALTH!" pop. Only the last bar kills it. `D.bosses[id].hp` is per bar, set so the whole fight is about 1.5x the old single-bar length. Two-phase bosses: Murder Dozer 53, Hoarder 173, Chieftain 203, Ralph 405. Three-phase bosses: Juicer 190, Ball of Swine 200, Krakaren 230. A phase's `below` value no longer triggers anything.

## Donut rides Carl's shoulder (lead)
Donut no longer leaps gaps or puffs back to Carl in smoke. Whenever she couldn't follow him on foot, she hops onto his back shoulder in a short arc (`mountShoulder`) and rides there, drawn in front of him and still casting. That covers: a gap, spikes or liquid ahead of her; Carl on a ladder or a moving platform; a ledge more than a cat-hop up; falling far behind. She stays up for the whole of a chase. She hops down once Carl has stood for 0.45 s on flat, safe ground two tiles either side (`safeToDismount`). Carl as companion (Donut mode) follows Donut's trail instead; see Donut mode controls.

## Character notes (lead)
- **Mordecai:** their assigned game guide, nothing more. He doesn't own or run the guild halls. He's gruff, tired and rude about them ("the worst crawlers I've seen to date"), and only grudgingly fond.
- **Hekla:** Donut idolizes her through Book Two; that only sours in Book Three. In Books One and Two, Donut only ever gushes about her and wants to impress her. She never gripes about her or distrusts her.

## Pet biscuits (lead)
Biscuits only matter in Ralph's dog pound: four dingo cages, and any cage not fed by his second phase opens. They're scarce on purpose, so a crawl can arrive short.
- **World cap:** the world hands out at most 4 per crawl (`D.biscuitRules.found`), counting Mordecai's 2. `run.biscuitsFound` tracks it, and `G.biscuitsLeftToFind()` reports what's left. Loot boxes no longer drop biscuits.
- **Biscuit spots:** each `B` tile is stocked only on a `spotChance` (0.2) roll from the stage's seed, so a revive sees the same result. A taken spot is remembered (`run.biscuitSpots`) and stays empty after a revive. When the cap is hit, any other biscuit still in the stage puffs away.
- **Shop:** one per crawl, across both shops (`limit: 1`, `run.bought`). It doesn't count toward the cap. Max ever held: 5.
- **Odds** (simulated over 400 crawls through the real floor 2 builds): no biscuits found beyond Mordecai's 17%, one 39%, two 44%. Enough for all four cages: 44% without the shop, 83% with it.

## Donut's running gag (lead)
When Donut is upset she uses one formula: "X? CARL. YOU KNOW HOW I FEEL ABOUT X." It runs through the whole series, so use it whenever she's put out, and keep it short and flat. The joke is the repetition.
- **Cutscenes:** bad lighting on the recap, being left on the floor, Carl's Jug O'Boom credit, Pork Boy taking her ratings. Her plot-armor line is "PLOT ARMOR? CARL. YOU KNOW HOW I FEEL ABOUT PLOT ARMOR."
- **In play:** `D.donutGripes` maps a mob id (or one `_`-separated part of it) or a damage kind (`wet`, `fire`, `spikes`, `bomb`) to a gripe. When one hurts the player, Donut says it in a pink toast. Each gripe plays once per crawl (`run.gripes`), at most one every 20 s, and only once she can talk. Contact hits pass `mob: e.id`. Enemy shots remember their shooter, so death screens now name the shooter instead of "PROJECTILE".

## Tools
- `node tools/shot.js "?debug&stage=f1_hall" out.png 120 "<js to eval first>"` screenshot after N frames.
- `?debug&stage=<id>` jumps into a stage; `?debug&scene=safe&room=tally`, `?debug&cut=<id>`, `?debug&floor=2`; `&god` god mode; in stages key `9` clears, `0` toggles god.
- `tools/actors_preview.html?f=<regex>&s=4` and `node tools/actors_shot.js "?f=..." out.png` render actor art.
- `tools/art_gallery.html` / `node tools/art_shot.js <dir>` render themes, tiles, backgrounds, sprites.
- Write scratch screenshots under `/tmp/claude-0/-home-user-Cards-n-more/0c0faa75-d6b9-5b3e-b7d7-c5f597bb95f7/scratchpad/`, not in the repo.

---

# Inherited contract from Dungeon Crawler World (still binding unless overridden above)
## Engine (exists - `js/engine.js`)

- Internal resolution **320x180**, tile size **16**. `DCW.W`, `DCW.H`, `DCW.TILE`.
- `DCW.ctx` is the 2D context (smoothing off). Draw in integer pixels.
- Fixed step: every `scene.update(dt)` gets `dt = 1/60`. `DCW.t` (seconds), `DCW.frame`.
- `DCW.setScene(sceneObj, params)` - scene = `{enter(params), update(dt), draw(ctx), exit(), idle(dt)?}`.
  `idle(dt)` (optional) runs instead of `update` while a UI modal blocks.
- Each frame: input sampled, `DCW.ui.update(dt)` runs, then if `DCW.ui.blocking()` is false
  the scene updates. Draw: scene (with screen shake), then `DCW.ui.draw(ctx)` (no shake), then fade.
- `DCW.fade(callback, {time, color})` - fade to black, run callback (usually a setScene), fade back. Input is locked while fading. `DCW.fading()`.
- `DCW.shake(mag, seconds)`, `DCW.freeze(frames)` (hitstop: skips scene updates).
- Input: `DCW.input.down(b)`, `.pressed(b)`, `.released(b)`, `.any()`, `.axisX()`, `.axisY()`, `.consume()`.
  Buttons: `left right up down jump attack bomb special potion start select confirm back`.
  Keyboard: arrows/WASD move; Z/Space/K = jump+confirm; X/J = attack+back; C/L = bomb;
  V/I/Shift = special; Q/U = potion; Enter/P = start (Enter also confirm); Esc = back+start;
  Tab/M = select. Gamepad and on-screen touch buttons map to the same names.
  In menus use `confirm` to accept and `back` to cancel.
- Text: `DCW.text(str, x, y, color, {align:'left'|'center'|'right', shadow:'#000'|null, scale, wrap:px, lineH})`
  returns `{w,h}`. 5x7 font in a 6x8 cell, uppercase only, line height 10. Special glyphs:
  `♥` heart, `▶` / `◀` cursors, `▼` continue arrow, `▲`, `★` star,
  `×` times, arrows `←↑→↓`, `●` dot, `☠` skull, `✓` check.
  `DCW.textWidth(str, scale)`, `DCW.wrapText(str, px, scale)`.
- Draw helpers: `DCW.rect(x,y,w,h,color)`, `DCW.box(x,y,w,h,{fill,border,border2})` (NES window),
  `DCW.bar(x,y,w,h,frac,color,back)`.
- Utils `DCW.U`: `clamp lerp sign rand randi chance pick shuffle(arr,rnd) rng(seed) hash(str) overlap(a,b) approach weighted([[item,w]],rnd) fmtTime fmtNum`.
- Save: `DCW.save` (live object), `DCW.persist()`, `DCW.resetSave()`. Settings in `DCW.save.settings`
  `{music, sfx, shake, crt, touch:'auto'|'on'|'off', easy, fancy}`; after changing call `DCW.applyCrt()` / `DCW.applyTouchSetting()` / `DCW.audio.setVolumes()`.
  `fancy` (FANCY EFFECTS, default on) gates the heavy stage lighting and ambient background life; read it with `DCW.fancy()`.
  All screen shake and camera kicks obey `shake`.
- `DCW.debug` true with `?debug` in the URL. `DCW.params` is the URLSearchParams.
- Test hooks: `DCW.stepFrames(n)` advances n frames synchronously; `DCW.pressKey(btn, frames)`.


## Save schema

```js
DCW.save = {
  unlocks: { skins: ['carl_boxers'], companions: ['donut'] },   // permanent
  equipped: { skin: 'carl_boxers', companion: 'donut' },
  run: null | RUN,                                              // current crawl
  meta: { achievements: {id:true}, counters: {event:n}, bestFloor, runs, wins, deaths, boxesOpened, seenIntro },
  settings: { music, sfx, shake, crt, touch }
}
RUN = {
  floor: 1,
  cleared: { stageId: true },        // cleared stages this floor (reset each floor)
  bossDown: false,                    // this floor's boss beaten
  seqIndex: 0,                        // linear floors: index into floor.sequence
  owPos: null | {x, y},               // overworld tile position to return to
  roamersDown: [],                    // overworld roamer indexes beaten this floor
  hp: 12,                             // current hp (max comes from DCW.game.playerStats())
  level: 1, xp: 0, statPoints: 0,
  stats: { str: 3, con: 3, dex: 3, int: 3 },
  bonus: { hp: 0 },                   // permanent pickups
  gold: 0, bombs: 3, potions: 1,
  views: 0,                           // total viewers ("followers"), a score
  boxes: [ { tier: 'bronze', from: 'text' } ],   // unopened loot boxes
  revivals: 3,
  floorTime: 0,                       // seconds spent on this floor
  kills: 0,
  seed: 12345
}
```


## Game flow API (`js/game.js`, lead) - what other modules call

```js
DCW.game.run                         // getter: DCW.save.run (or null)
DCW.game.floorDef()                  // data floor object for run.floor
DCW.game.newRun()                    // story intro -> floor 1
DCW.game.continueRun()
DCW.game.enterStage(stageId)         // fades into DCW.stage.scene with {stageId}
DCW.game.stageCleared(result)        // stage.js calls on exit door / boss kill. result below
DCW.game.playerDied(result)          // stage.js calls after the death animation. {stageId, cause}
DCW.game.fleeStage()                 // pause menu "flee" on overworld floors: back to overworld, no rewards
DCW.game.enterEntrance(code)         // overworld.js calls when player enters an entrance char
DCW.game.entranceState(code)         // -> {kind:'stage'|'safe'|'boss'|'stairs', stageId, name, cleared, locked, lockText}
DCW.game.enterSafeRoom()
DCW.game.leaveSafeRoom()
DCW.game.takeStairs()
DCW.game.quitToTitle()
DCW.game.tick(dt)                    // stage + overworld call every update: floor timer
DCW.game.playerStats()               // derived stats, see formulas
DCW.game.addXP(n), addGold(n), addViews(n), heal(n), damageTaken(n)
DCW.game.giveLootBox(tier, from)
DCW.game.openLootBox(index)          // removes box, applies + returns rewards [Reward]
DCW.game.buy(shopItemId)             // -> {ok, msg}
DCW.game.price(shopItemId)
DCW.game.usePotion()                 // -> bool
DCW.game.spendStat(stat)             // -> bool
DCW.game.equip(kind, id)             // kind 'skin'|'companion'
DCW.game.track(event, n)             // counters + achievement checks
DCW.game.achieve(id)                 // unlock achievement (toast + reward box), once ever
DCW.game.objectives()                // overworld objective lines for the MAP screen
```

`result` passed to `stageCleared`:
```js
{ stageId, kills, time, damageTaken, maxCombo, views, gold, secrets }
```
`gold` and xp are applied live during the stage via `addGold/addXP`; `result.gold` is only for the results screen.

Reward objects (from loot boxes, results):
```js
{kind:'gold', amount} | {kind:'item', id:'potion'|'bomb', count} | {kind:'skin', id, isNew}
{kind:'companion', id, isNew} | {kind:'stat', stat:'str'|'con'|'dex'|'int', amount}
{kind:'xp', amount} | {kind:'hp', amount}   // hp = permanent +max hp
```


## Player formulas (game.js implements, content balances against them)

- `maxHp = 10 + (con-3)*2 + (level-1) + bonus.hp` (+ skin perk)
- punch damage `dmg = 2 + (str-3) + floor((level-1)/2)`; kick/stomp = `dmg*1.5`, rounded
- `crit = 0.04 + (dex-3)*0.02` (x2 damage); move speed multiplier `1 + (dex-3)*0.03`
- bomb damage `8 + level*2 + (str-3)`, radius 28px
- companion power multiplier `1 + (int-3)*0.15 + (level-1)*0.04`
- xp to next level `round(18 * level^1.5)`; level up gives +1 stat point (+2 every 5th level), heals 30%
- potion heals 50% max hp. Health snack pickup heals 3 hp. Gold coin 1-3 gold scaled by floor.
- Starting run: hp 12/12 (`con` 3 gives 10, plus the run starts with bonus.hp 2), 3 bombs, 1 potion, 3 revivals.

`DCW.game.playerStats()` returns
`{maxHp, dmg, kickDmg, crit, speedMul, bombDmg, bombRadius, compPower, def, goldMul, viewMul, extraJump, skinPerk}`
(`def` = flat damage reduction, min 1 damage taken; `extraJump` true if the skin grants a double jump).

Enemy HP/damage should be set so floor N regular enemies take ~2-4 punches from a player at
the level they'd naturally be (about level `1 + (N-1)*2.5`), and bosses take ~45-90 seconds.


## Data contract (`js/data.js`, content)

All under `DCW.data`.

### Themes (ids are fixed; art draws them)
Side-scroll themes: `sewer cave city circus swamp train bubble forest castle ruin warzone safe`
(+ `ghosttown ghostmine` for Floor 8).
Overworld themes: `ow_city ow_rail ow_reef ow_woods ow_manor ow_waste ow_war` (+ `ow_town` for Floor 8).

### floors
```js
DCW.data.floors = [ {
  n: 1, name: 'THE TUTORIAL DUNGEON', tagline: 'short line',
  theme: 'sewer', music: 'floor1',
  intro: ['AI line', ...],               // System AI announcement at floor start
  sequence: ['f1_s1', 'f1_s2', 'SAFE', 'f1_boss'],   // linear floors only (1 and 2)
  overworld: null | {
    theme: 'ow_city', music: 'ow3',
    map: [ 'string rows...' ],          // any size >= 20x12; see legend
    entrances: { '1': 'f3_s1', '2': 'f3_s2', 'A': 'f3_x1', 'S': 'SAFE', 'B': 'f3_boss', 'X': 'STAIRS' },
    roamers: [ {enemy:'clown', x:10, y:5} ],   // wandering overworld mobs, touch = ambush stage
    ambush: 'f3_ambush'                  // stage id used for roamer fights
  },
  required: ['f3_s1','f3_s2','f3_s3'],  // stages that must be cleared before the boss door opens
  boss: 'f3_boss',
  par: 900                               // seconds; beating the floor under par = bonus gold box
} ]
```
Overworld map legend: `#` wall/building (blocked), `.` ground, `,` grass/decor ground,
`=` road/path, `~` water/void (blocked), `T` tree/rock (blocked), `P` player start,
any char in `entrances` is a walkable entrance tile. Entrance chars: `1-9` main areas,
`A-F` optional side areas, `S` safe room, `B` boss, `X` stairwell. The map should be fully
enclosed by blocking tiles.

### stages
```js
DCW.data.stages = {
  'f1_s1': {
    id: 'f1_s1', name: 'COLLAPSED STAIRWELL', floor: 1, theme: 'sewer',
    kind: 'main' | 'side' | 'boss' | 'ambush',
    chunks: { start: 'f1_start', pool: ['f1_a','f1_b','f1_c'], count: 5, end: 'end_door' },
            // boss stages: end = boss arena chunk id (contains 'K'); count may be 0-2
    enemies: [['rat', 3], ['goblin', 2]],    // weighted pool for 'e'
    elite: [['goblin_brute', 1]],            // for 'E'
    flyers: [['bat', 1]],                    // for 'f' (falls back to enemies)
    boss: 'hoarder',                         // boss stages only
    reward: { box: 'bronze', xp: 20 },       // clear reward
    intro: 'optional AI line on entry',
    signs: ['text for n signs in order'],
    dark: false,                             // optional: limited light radius
    music: 'optional override track'
  }
}
```

### chunks
```js
DCW.data.chunks = { 'f1_a': { rows: [ /* exactly 12 strings, all the same length (16-48) */ ] } }
```
Row 0 is the top, row 11 the bottom. A stage is laid out left to right:
`start` chunk, `count` chunks picked from `pool` (seeded, no immediate repeats), then `end`.
Adjacent chunks must line up: every chunk should have walkable floor at its left and right
edges at rows 9-10 (the standard ground line is row 10-11 solid, `#` in rows 10 and 11) so
any chunk can follow any chunk. Chunks are shared across stages of a floor/theme. Provide
generic `end_door` (exit door on flat ground) and per-boss arena chunks (wide, ~30-40 cols,
flat, walls at both ends, maybe a couple of `=` platforms, `K` where the boss spawns).

Legend:
| ch | meaning |
|---|---|
| `.` or space | empty |
| `#` | solid ground (theme) |
| `X` | solid alternate (brick/decor variant, still solid) |
| `=` | one-way platform (jump up through, stand on, down+jump drops through) |
| `^` | spikes (hurt 2 + knock up) |
| `~` | hazard liquid (hurts 1 per 0.5s while touching; theme decides look) |
| `H` | ladder (climb with up/down) |
| `b` | breakable crate (solid; punch/kick/bomb to break; drops something) |
| `o` | coin |
| `h` | health snack |
| `m` | bomb pickup |
| `?` | mystery loot box pickup (gives a bronze box) - rare, reward secrets |
| `e` | enemy spawn from `enemies` |
| `E` | elite spawn from `elite` |
| `f` | flying enemy spawn from `flyers` |
| `P` | player start (start chunk only) |
| `D` | exit door (stage end) |
| `K` | boss spawn (arena chunk) |
| `<` `>` | horizontal moving platform (3 tiles wide one-way, moves 3 tiles each way) |
| `v` | vertical moving platform |
| `c` | checkpoint (respawn point after falling in a pit) |
| `n` | sign (text from stage.signs in order) |
| `$` | NPC/decoration chest that gives gold when opened (punch it) |

A pit is any column with no ground at the bottom; falling out of the level costs 3 hp and
respawns the player at the last checkpoint/safe ground.

### enemies
```js
DCW.data.enemies = {
  rat: { name: 'TUTORIAL RAT', hp: 3, dmg: 1, speed: 28, w: 12, h: 8, ai: 'walker',
         xp: 2, gold: [0, 2], sprite: 'rat', flavor: 'AI snark for bestiary/first sight',
         // optional AI params (defaults in stage.js):
         aggro: 96, jump: 220, shootEvery: 2, projectile: 'arrow', chargeSpeed: 160,
         spawn: 'roach', spawnEvery: 4, flying: false, armor: 0, kb: 1 }
}
```
AI types implemented by stage.js: `walker` (patrols, turns at walls and ledges), `chaser`
(walks toward the player inside aggro, else patrols), `jumper` (hops toward player),
`flyer` (sine-wave flight, swoops at the player), `shooter` (keeps distance, fires
`projectile` every `shootEvery` s), `charger` (telegraphs then dashes), `turret`
(stationary, aimed shots), `spawner` (stationary nest, spawns `spawn` every `spawnEvery` s,
max 3 alive), `bomber` (lobs arcing projectiles), `hopper` (big jumps, lands with a small
shockwave).

Sprite naming (art provides): `<sprite>_walk` (2+ frames), `<sprite>_attack`, `<sprite>_hurt`.

### projectiles
```js
DCW.data.projectiles = { arrow: { sprite: 'arrow', w: 8, h: 3, speed: 150, dmg: 1, gravity: 0, life: 3 } }
```
`gravity` > 0 makes it arc. Provide at least: `arrow rock fireball bubble bolt bottle laser_orb knife spore note`.

### bosses
```js
DCW.data.bosses = {
  hoarder: { name: 'THE HOARDER', title: 'MOTHER OF A THOUSAND ROACHES',
    hp: 120, dmg: 2, w: 44, h: 30, sprite: 'hoarder', xp: 80, gold: [60, 90], flying: false,
    phases: [
      { below: 1.0, speed: 40, pattern: ['walk:2', 'charge', 'spawn:roach:2', 'idle:1', 'jump_slam'] },
      { below: 0.5, speed: 60, pattern: ['charge', 'charge', 'spawn:roach:3', 'jump_slam', 'rain:rock:6'] }
    ],
    intro: ['AI line', 'AI line'], defeat: 'AI line',
    loot: 'gold', unlock: { companion: 'mongo' } | { skin: 'id' } | null }
}
```
Move primitives (stage.js implements all): `walk:SECONDS`, `idle:SECONDS`, `charge`,
`jump_slam`, `shoot:PROJ:N` (aimed burst), `spread:PROJ:N` (fan), `rain:PROJ:N` (falls from
ceiling at random x), `spawn:ENEMY:N`, `swoop` (flyers), `hover:SECONDS` (flyers), `teleport`,
`laser` (telegraphed horizontal beam at the player's height), `shockwave` (ground wave both
ways), `summon_spikes` (telegraphed spikes erupt under player). Patterns loop. Phase switches
when hp fraction drops below the next phase's `below`.

Boss sprite naming: `<sprite>_idle`, `<sprite>_walk`, `<sprite>_attack`, `<sprite>_hurt`, optional `<sprite>_special`.

### loot, shop, skins, companions
```js
DCW.data.boxTiers = { bronze: {name:'BRONZE ADVENTURER BOX', color:'#c87838'}, silver, gold, platinum, legendary, fan, boss }
DCW.data.lootTables = { bronze: { rolls: 2, entries: [ [reward, weight], ... ] }, ... }
   // reward: {kind:'gold', min, max} | {kind:'item', id:'potion'|'bomb', count}
   //       | {kind:'skin', id} | {kind:'skin', any:true} | {kind:'companion', id} | {kind:'companion', any:true}
   //       | {kind:'stat', stat, amount} | {kind:'stat', any:true, amount} | {kind:'xp', amount} | {kind:'hp', amount}
   // gold scales by floor in game.js. Already-owned skins/companions convert to gold.
DCW.data.shop = [ { id: 'potion', name: 'HEALTH POTION', desc, price: 30, give: {kind:'item', id:'potion', count:1} }, ... ]
   // prices scale with floor in game.js: price * (1 + (floor-1)*0.35)
DCW.data.skins = { carl_boxers: { name, desc, perk: null | {dmg|def|hp|speed|gold|views|bombs|doubleJump}, how: 'how to unlock text' } }
DCW.data.companions = { donut: { name, desc, ability: 'missile'|'bite'|'shield'|'magnet'|'fetch',
     cooldown: 1.6, power: 2, special: { name: 'MAGIC MISSILE BARRAGE', desc }, sprite: 'donut', how: '...' } }
DCW.data.achievements = { id: { name, desc, event: 'kill', count: 1, box: 'bronze' } }   // event matches DCW.game.track names, see below
DCW.data.ai = { floorClear:[], stageClear:[], death:[], levelUp:[], lootbox:[], revive:[], boxEmpty:[], lowHp:[], bigCombo:[], flee:[] }
DCW.data.mordecai = ['tip', ...]        // guide in safe rooms
DCW.data.shopkeeper = { name, lines: [] }
DCW.data.story = { intro: [ {text, portrait?} ...pages ], ending: [...], credits: [...] }
DCW.data.titles = [ {views: 0, name: 'NOBODY'}, {views: 1000, name: '...'} ]   // fan-count ranks
```
Skins (ids fixed): `carl_boxers` (default), `carl_jacket`, `carl_bodyguard`, `carl_kilt`,
`carl_hazmat`, `carl_pajamas`, `carl_clown`, `carl_toga`, `carl_gold`.
Companions (ids fixed): `donut` (default, Princess Donut - Persian show cat, magic missile),
`mongo` (baby velociraptor, bites/charges), `katia` (shapeshifter, shield that blocks hits),
`zev` (PR handler fish-lady, gold magnet + bonus views), `squeaks` (Sir Squeaks, a tutorial
rat you spared, fetches pickups and occasionally finds bombs).

Track events (stage.js / game.js emit via `DCW.game.track`): `kill`, `kill:<enemyId>`,
`boss:<bossId>`, `stomp`, `kick`, `bomb_kill`, `multi_bomb` (3+ kills one bomb), `potion`,
`crate`, `coin`, `fall`, `death`, `revive`, `box_open`, `combo10`, `combo25`, `no_damage_stage`,
`floor:<n>` (reached floor n), `level:<n>`, `skin_equip`, `companion_equip`, `shop`, `flee`,
`secret` (`?` box found), `win` (beat the game), `pet_donut` (press down near Donut while idle in a safe room).

## Art contract (`js/art.js`, art)

```js
DCW.art.init()
DCW.art.sprite(ctx, name, x, y, { frame, flip, skin, alpha, flash, scale })
  // (x, y) = BOTTOM-CENTER of the sprite (feet). frame is any integer (mod frame count).
  // flip = face left (sprites are authored facing right). flash = draw solid white (hit flash).
  // skin = player skin id (only for carl_* sprites). Unknown names draw a magenta placeholder box.
DCW.art.has(name) -> bool
DCW.art.info(name) -> { w, h, frames }
DCW.art.icon(ctx, name, x, y)            // top-left; 8x8 HUD icons
DCW.art.portrait(ctx, name, x, y)        // top-left; 32x32 dialog portraits
DCW.art.tile(ctx, theme, ch, x, y, ctxInfo)  // top-left 16x16 for chunk chars '#','X','=','^','~','H','b'
  // ctxInfo = { up, down, left, right } booleans = same-solid neighbour exists (for edge/grass tops), plus {t} time
DCW.art.background(ctx, theme, camX, camY)  // fills the whole screen; parallax layers
DCW.art.owTile(ctx, owTheme, ch, x, y, info) // overworld 16x16 tile for '#','.',',','=','~','T' (info like tile)
DCW.art.boxColor(tier) -> css color
DCW.art.bgLights(theme, camX, camY, out) // pushes screen-space lights {x, y, r, c:[r,g,b], i} from the theme's
  // background (torches etc., at their parallax positions) for the stage light map. BG specs may define
  // `lights(out, camX, camY, t, oy)`, and a parallax layer may carry `after(ctx, camX, camY, t, oy)` to draw
  // animated life right after that layer (so depth reads right).
```

Required sprite names (all face right):
- Player (16x24-ish): `carl_idle`(5: rest, inhale, exhale, blink, glance back) `carl_run`(8: contact,
  down, pass, up, then the far leg leading) `carl_jump`(2: rise, apex) `carl_fall`(2: drop, flail)
  `carl_land`(2: squash, recover) `carl_skid` (turning at speed, faces the new direction) `carl_crouch`
  `carl_punch`(5: chamber, jab, cross, haymaker windup, haymaker) `carl_kick`(3: chamber, extended,
  anticipation) `carl_airkick` (diving stomp kick) `carl_throw` `carl_hurt` `carl_dead`
  `carl_climb`(2) `carl_victory`; overworld: `carl_ow_down`(2) `carl_ow_up`(2) `carl_ow_side`(2).
  All support `skin`.
- Companions (~16x14): `donut_idle`(6: rest, breath, tail curl, tail flick, ear twitch, blink) `donut_run`(6, bounding
  gallop, 18x13) `donut_act`; frame order is a contract with stage.js timelines; same for `mongo_*`,
  `katia_*`, `zev_*`, `squeaks_*`.
- Enemies (12-24 px): `<id>_walk`(2) `<id>_attack` `<id>_hurt` for ids:
  `rat roach goblin goblin_archer goblin_brute bat grub shaman juicer_minion clown clown_brute
  skyfowl swamp_troll gator steam_goblin conductor rail_rat fishman jelly crab hunter hound
  masked_noble ghoul gargoyle skeleton mutant drone golem soldier sniper war_beast cultist`.
- Bosses (32-64 px): `<id>_idle(2) _walk(2) _attack _hurt _special` for
  `hoarder juicer ringmaster engineer tidemother butcher bride overseer showrunner`.
- Floor 8 retheme (THE GHOSTS OF EARTH): enemies `wampus_cat mountain_light woodbooger sheepsquatch
  mothling`, boss `mothman` (+ `p_mothman`; replaces overseer in data), quest items `qi_lamp qi_beacon`.
  Floor 8 no longer uses mutant/drone/golem/overseer, but floors 9-10 still use the first three.
- Projectiles/fx: `arrow rock fireball bubble bolt bottle laser_orb knife spore note missile`
  `bomb` `explosion`(5) `hit`(3) `dust`(3) `sparkle`(4) `shockwave`(2) `smoke`(3)
- Pickups/objects: `coin`(4) `snack` `bomb_pickup` `potion` `box_bronze box_silver box_gold box_platinum
  box_legendary box_fan box_boss` `door` `door_open` `checkpoint`(2) `sign` `chest` `chest_open`
  `crate` `stairs`.
- NPCs: `mordecai`(2) `bopca`(2) (shopkeeper), `ai_screen`(2) (floating TV head of the System AI).
- Overworld markers (16x16): `ow_door ow_manhole ow_tent ow_cave ow_safe ow_boss ow_boss_locked
  ow_stairs ow_stairs_locked ow_flag` (cleared flag) and roamer icons use enemy `_walk` sprites.
- Portraits (32x32): `p_carl p_donut p_mongo p_katia p_zev p_squeaks p_ai p_mordecai p_bopca`
  and one per boss `p_<bossId>`.
- Icons (8x8): `heart heart_half heart_empty coin bomb potion star skull box key sword shield boot brain eye`.

Look: NES-like palette (use the classic 2C02 colors), 1px black outlines on characters,
3-4 colors per sprite plus outline, chunky readable silhouettes, big heads (Code Monkeys /
NES cartoon proportions). Backgrounds: 2-3 parallax layers, darker and less saturated than
the playfield so sprites pop. Tiles: clear solid tops so platforms read instantly.

### Shared pixel-art definition format (art_actors.js -> art.js)

`art_actors.js` loads first and only fills plain data; `art.js` rasterizes everything at `init()`.
```js
DCW.artDefs = DCW.artDefs || {};
DCW.artDefs['rat_walk'] = {
  w: 16, h: 10,                          // frame size in px
  pal: { k: '#000000', g: '#7c7c7c', p: '#f8b8f8', a: null },  // char -> color; '.' and ' ' are transparent; null = transparent
  frames: [ [ '................', ...h rows ], [ ...frame 2 ] ],
  ox: 0, oy: 0                           // optional: shift of the feet anchor in px
};
DCW.artProcs = DCW.artProcs || {};       // procedural alternative for big/odd sprites
DCW.artProcs['tidemother_idle'] = { w: 64, h: 48, frames: 2, draw: function (g, frame) { /* 2D ctx of a w x h canvas */ } };
DCW.artSkins = DCW.artSkins || {};       // palette overrides applied to every sprite whose name starts with 'carl_'
DCW.artSkins['carl_kilt'] = { pal: { b: '#2038ec', B: '#d82800', a: null } };
```
Carl's sprites use these palette chars so skins can recolor regions: `k` outline, `s` skin,
`S` skin shade, `h` hair, `e` eye, `j` jacket, `J` jacket shade, `b` boxers/legwear, `B`
boxer pattern/shade, `f` feet/shoes, `t` shirt/torso under jacket (default skin-colored = bare
chest), `a`/`A` accessory layer (hat, crown, mask; transparent `null` by default so skins can
turn it on), `w` white detail. Skins may also set any of these to `null`.


## Audio contract (`js/audio.js`, audio)

```js
DCW.audio.init(); DCW.audio.unlock()      // unlock is called on first user gesture
DCW.audio.sfx(name, {vol, pitch})
DCW.audio.music(track)                    // crossfade/switch; same track = no restart; null = stop
DCW.audio.stopMusic(); DCW.audio.setVolumes(); DCW.audio.suspend(); DCW.audio.resume()
DCW.audio.current -> track name
```
SFX names: `jump land punch kick hit crit enemy_die hurt coin pickup bomb_throw explosion
missile bite shield menu_move menu_select menu_back lootbox_shake lootbox_open unlock level_up
door boss_roar boss_die achievement stairs death heal block buy error text_blip pause
checkpoint crate_break spawn laser warn stomp splash fanfare views`.
Music tracks: `title intro floor1 floor2 floor3 floor4 floor5 floor6 floor7 floor8 floor9
ow3 ow4 ow5 ow6 ow7 ow8 ow9 boss boss_final safe results gameover ending lootbox`.
`results`, `gameover` and jingles may be non-looping. Everything synthesized: NES-style
2 pulse + triangle + noise voices.


## UI contract (`js/ui.js` + `js/overworld.js`, ui)

```js
DCW.ui.init(); DCW.ui.update(dt); DCW.ui.draw(ctx); DCW.ui.blocking() -> bool (modal open)
DCW.ui.say(lines, {onDone})   // modal dialog. lines: string | {who, text, portrait}. Typewriter, confirm to advance.
                              // default speaker: {who:'SYSTEM AI', portrait:'p_ai'}
DCW.ui.toast(text, {icon, color, title, time})   // non-blocking popup (achievements, pickups, level up)
DCW.ui.announce(text, {color, time, sub})        // big centered banner, non-blocking
DCW.ui.menu(items, opts)                         // generic modal list: items [{label, action(), disabled, hint}]
DCW.ui.openPause({canFlee})
DCW.ui.openBoxes(), openWardrobe(), openCharacter(), openAchievements(), openSettings(), openShop(), openMap()
DCW.ui.drawHUD(ctx, hud)   // hud = {hp, maxHp, special 0..1, bombs, potions, gold, level, xpFrac, views,
                           //        combo, companion, bossHp 0..1|null, bossName, time|null, par|null, stageName}
DCW.ui.scenes = { title, intro, floorCard, results, death, safeRoom, ending }
   // floorCard.enter({floor, onDone}); results.enter({result, rewards, onDone}); death.enter({result})
   // safeRoom.enter({}) ; ending.enter({}) ; intro.enter({onDone})
DCW.overworld.scene   // enter({floor}) ; reads floor.overworld, run.owPos, calls DCW.game.enterEntrance(ch)
```


## Stage contract (`js/stage.js`, gameplay)

`DCW.stage.scene.enter({stageId})` builds the level from data (seed = run.seed + hash(stageId)
so a stage keeps its layout for the run), spawns the player at `P`, runs the stage, draws the
HUD through `DCW.ui.drawHUD`, opens pause via `DCW.ui.openPause({canFlee})` on `start`, and
ends by calling `DCW.game.stageCleared(result)` or `DCW.game.playerDied(result)`.
Player hp lives in `run.hp` (write it back as it changes). Use `DCW.game.playerStats()` for
numbers. Abilities: run, variable-height jump (coyote time + jump buffer), punch combo
(attack), crouch, kick (down+attack on ground, slower, more damage), diving stomp kick
(down+attack in air), bounce off enemy heads, climb ladders, throw bomb (bomb button,
arcing), use potion, companion special (special button when meter full: meter fills from
damage dealt and over time). Companion follows the player and uses its ability on cooldown.
Combo counter: hits within 2s chain; views gained per kill scale with combo.
Debug (`DCW.debug`): key `9` (code Digit9) clears the stage, `0` toggles god mode.
Lighting: stage.js builds one dithered light map per frame (ambient + colored lights from the
background, Carl, projectiles, blasts, pickups, doors, hazards). Per-theme config lives in `LIGHTING`
(Floor 1 `tunnels` uses it); `dark` stages use the same path with a near-black ambient. The background is
multiplied by the map, tiles and actors by "lifted" copies so gameplay stays readable. Ambient life that never
collides (drips, rumble grit) is per-theme in `AMBIENT`. Juice: camera kick on hits, slow motion on a combo
finisher (10+) and boss phase changes, sprite-colored gibs, landing dust scaled by fall height.


## Update 2: quests, rescues, levers (binding for this update)

Goals from playtesting: companions came too early and too easily (loot boxes, bosses). Now every
companion except Donut must be FOUND and RESCUED, one per floor, spread from Floor 2 to Floor 7,
and they are per-crawl (each new run you find them again). Floors need more effort: key items
found in one area unlock another area's entrance or exit, the boss door needs the floor's key
item, and in-level levers open gates.

### Companions (ids fixed)
`donut` (start), `squeaks` (Floor 2), `mongo` (Floor 3, found as an egg), `samantha` (Floor 4),
`katia` (Floor 5), `zev` (Floor 6), `signet` (Floor 7).
- **Samantha**: a cursed porcelain doll head with curly black hair and big red lips. She insists she
  is a demigoddess. Ability `lunge`: hurls herself at the nearest enemy (big bite damage) and bounces
  back. Special: an ear-splitting shriek that damages and stuns everything on screen.
- **Signet**: a wild-haired half-elf summoner in a leafy cloak with a carved staff. Ability `summon`:
  calls a fae spirit that orbits Carl and zaps enemies for a few seconds. Special: a stampede of
  spirits sweeps the screen.
- No loot table may contain `{kind:'companion'}`. No boss `unlock` may be a companion.
  Boss skin unlocks: hoarder `carl_jacket`, ringmaster `carl_clown`, tidemother `carl_hazmat`,
  bride `carl_bodyguard`, overseer (now mothman) `carl_kilt`, showrunner `carl_gold`; juicer, engineer, butcher: none.

### New data
```js
DCW.data.questItems = {
  valve: { name: 'VALVE WHEEL', floor: 3, sprite: 'qi_valve', desc: 'what it is (<=120 chars)',
           hint: 'where to look, in Mordecai voice (<=140 chars)' }
}
stages[id].questItem = 'valve'     // this stage contains exactly one 'Q'; it spawns that item (until the run holds it)
stages[id].rescue = 'mongo'        // this stage contains exactly one 'R'; the companion's cage (or egg for mongo)
stages[id].exitNeeds = 'valve'     // the exit door is padlocked until the run holds the item
stages[id].chunks.insert = ['q_city_vault']   // extra chunk ids spliced into the middle of the generated chunk list, in order
floor.locks = { '3': { needs: 'valve' } }      // overworld entrance char -> blocked until the item is held (works on 'B' too)
floor.companion = 'mongo'          // companion hidden on this floor (objectives, hints)
floor.hints = ['Mordecai rumor lines pointing at where the items and companion are']
```
Linear floors (1, 2) use the same stage fields (`questItem`, `exitNeeds`, `rescue`); an item may be
found and used in the same stage (the key is on a side branch, the exit door needs it).

### New chunk legend chars
| ch | meaning |
|---|---|
| `Q` | quest item spot (stage.questItem). Floats; put it on/above walkable ground |
| `R` | rescue cage / egg (stage.rescue) standing on ground. Punch it open |
| `S` | lever standing on ground. Punch it: every `L` in the SAME chunk opens |
| `L` | gate tile: solid until a lever in its chunk is pulled |

Puzzle rules: a chunk with `L` must contain at least one `S`, reachable from the chunk's left edge
without passing any `L`. Gates guard the route forward, a `Q`, or an `R`. Chunks keep the standard
ground at both edges (rows 10-11) so they chain.

### Chain rules (overworld floors 3-9)
Each floor has 2-3 quest items: at least one main area whose ENTRANCE is locked (`floor.locks`) by an
item found in another area, at least one area whose EXIT is locked (`exitNeeds`) by an item found in
a different area, and the boss entrance `B` needs the floor's boss key item (also listed in
`floor.locks`). The chain must be solvable from the start with no cycles, and an item may never sit
inside a stage that needs it to enter.

### New art names
- Companions: `samantha_idle(2) samantha_run(2) samantha_act`, `signet_idle(2) signet_run(2) signet_act`,
  portraits `p_samantha p_signet`, summon fx `signet_spirit(2)` (~10x10 glowing wisp).
- Objects: `cage(2)` (~24x28, bars with gaps; the companion's idle sprite is drawn behind it),
  `cage_broken`, `egg(2)` (16x18 speckled dinosaur egg, wobble), `egg_broken`, `lever(2)` (16x16:
  frame 0 up/off, frame 1 down/on), `door_locked` (26x38, the door with chains and a padlock).
- Tile `L` for every side-scroll theme through `DCW.art.tile` (an iron portcullis / bars block).
- Quest items (16x16, glowing, readable): `qi_key qi_valve qi_ticket qi_gear qi_shell qi_horn
  qi_mask qi_crown qi_badge qi_map qi_lens qi_bolt`.
- Overworld: `ow_lock` (16x16 padlock badge drawn over a locked entrance marker). Icon (8x8): `quest`.


## Update 3: Floor 10 (the races) and Floor 11 (the parade)  (binding for this update)

The game grows to 11 floors. Floor 9's boss is no longer the end; the ending, the gold skin
(`G.win`, automatic after the last floor) and `boss_final` music move to Floor 11.
All content is ORIGINAL writing and ORIGINAL character/vehicle designs (the player told us the
premise only: Floor 10 is a series of races in vehicles or on mounts, Carl and Donut race in a food
truck, other racers plus enemies along the way, the overworld is a cul-de-sac with the other racers;
Floor 11 is a parade where the same vehicles become floats, and you find the parts to build your float).

### Floor 10 - THE RACES
- `floor.overworld.theme: 'ow_suburb'` (a suburban cul-de-sac: houses, lawns, driveways, mailboxes,
  rival garages). Entrances: `1 2 3` race heats, `A C` side areas on foot (truck upgrades), `S` safe
  room, `B` the championship race, `X` stairs. Heats unlock in order:
  `floor.locks = { '2': {afterCleared: 'f10_r1'}, '3': {afterCleared: 'f10_r2'}, 'B': {afterCleared: 'f10_r3'} }`.
  `floor.required = ['f10_r1','f10_r2','f10_r3']`. Roamers on this floor are rival pit crews (use enemy ids).
- Rival racers wait in their driveways as overworld NPCs: `floor.overworld.npcs = [{ racer: 'id', x, y, lines: ['trash talk'] }]`
  (walkable tiles; press A next to them to hear a line).
- Race stages: `kind: 'race'`, theme `raceway`, music `floor10`, plus
  `race: { rivals: ['racer ids'], place: 3 }` (must finish in top `place` to clear; championship `place: 1`,
  `boss: 'champion'`). Chunk legend additions (race chunks only):
  `r` rival start spot (start chunk), `Z` boost pad, `J` jump pad, `O` oil slick (each sits in the empty
  cell directly above ground), `F` finish line (end chunk `race_finish`). Gaps up to 6 tiles (jump pads before
  wide ones), crates `b` as ram-through obstacles, enemies `e`/`f` on the track, `=` overpass routes.
  Race chunks are 12 rows and 32-48 wide; a heat is ~6-9 chunks.
- `DCW.data.racers = { id: { name, title, sprite, portrait, speed, accel, hp, aggression (0..1), weapon: projectile id|null, skill (0..1), lines: [] } }`
  4-5 original rivals (vehicle OR mount) + `champion` (the boss racer: a big vehicle, has `boss: true`).
- `DCW.data.truck = { name: 'THE FOOD TRUCK', sprite: 'truck', speed: 170, accel: 140, hp: 30 }`.
  Truck upgrades are quest items with a `truck` field: `{ hp: 15 }`, `{ speed: 25 }`, `{ mines: true }`.


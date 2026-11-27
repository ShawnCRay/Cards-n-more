# DUNGEON CRAWLER WORLD, BOOK 2: CARL'S DOOMSDAY SCENARIO - design + module contract

Book 2 of a personal fan-game series that follows the Dungeon Crawler Carl novels, one game per
book. This game covers **book 2 only: the Third Floor, the Over City**. Source facts (plot beats,
cast and their looks, monsters, items, pop culture references) are in `SOURCE.md`. Read it.

Book One lives in `../crawler-book1/`. Book 2 started as a copy of the older Dungeon Crawler World
prototype in `../crawler/`, not of the finished Book One, so it missed Book One's playtest work.
Section 16 brings that work over and is binding. Unless this document overrides it, the prototype's
contract in `../crawler/DESIGN.md` still applies (engine API, art def format, sprite naming, audio
API, UI helpers, input names), and `../crawler-book1/DESIGN.md` is the reference for everything
Section 16 ports.

## 0. Series rules (binding, from the owner)

- **Adult game for adults.** Private, not for sale, played by the owner and a few close friends.
  Vulgar language, gore and adult humor are in, because they are in the book. Book 1's "keep it
  PG-13" rule does NOT apply here.
- **Dressed as in the book.** A character who is topless in the book is topless in the game (rare,
  which is why it lands). On this floor: Tsarina Signet (wears only a thong; covered in moving
  tattoos), Bautista (shirtless tiger man), the headless Krasue bodies. Draw it plainly, not
  sexualized, at NES pixel scale.
- **Pop culture references** from the early 1980s to the early 2000s are part of the voice
  (SOURCE.md section 8 lists the ones the book makes; use those and add more in the same spirit).
- **Original writing.** All dialog, System AI descriptions and achievement text are written fresh
  in the book's style. Never copy sentences from the novel or the wiki's quoted AI descriptions.
  Names of characters, places, items, quests and achievements come from the book.
- **No em dashes in any player-facing text** (use commas, periods or hyphens).
- **Look and feel: late NES, as we remember it as kids, not as it plays today.** A modest step up
  from book 1, which is the baseline that felt right. Same NES 2C02 palette, same 320x180 screen,
  same 5x7 font, same chunky outlined sprites, CRT scanlines on by default. What is new:
  - richer chip audio: extra voices like the Famicom expansion chips (2 extra pulses + sawtooth)
    and crunchy low-rate samples (drums, slap bass, stabs),
  - line-scroll parallax with many bands, heat/wild-magic wobble (per-scanline offsets),
  - cutscenes between beats (letterboxed, panels/backdrops + actors + typewriter text),
  - bigger, multi-part bosses, a bit more animation (3-4 frame walks, talking portraits that
    blink and move their mouth).
  Don't overdo it. If in doubt, do what book 1 does.
- **Level variety, Contra-style.** The game mixes level types: side-scroll brawler (core), chase,
  vertical climb, vertical drop, darkness, survival, plant-and-detonate, timed escape, screen-filling
  boss, into-the-screen rooms, a talk show, and a swap stage played as Mongo. Every type comes from
  a beat in the book.
- **Playable overworld (Addams Family style).** No token-on-a-map overworld. The Over City is a
  set of side-view STREET areas you walk and fight through (light enemies), with doors, manholes,
  tents, gates and stairs that lead into levels with their own feel.

## 1. Tech (same as book 1)

No build step. Classic `<script>` files (NOT ES modules; must run from `file://`). Each file is an
IIFE attaching to `window.DCW`. No network requests of any kind. All art drawn from code, all audio
synthesized with WebAudio. Internal resolution 320x180, tile 16.

Load order (index.html):
`engine.js, data.js, art_actors.js, art.js, audio.js, ui.js, stage.js, rooms.js, show.js, game.js`.
`overworld.js` is gone. `DCW.boot()` calls `init()` on art, audio, ui, stage, rooms, show, game.

## 2. Files and owners

| File | Owner | What |
|---|---|---|
| `index.html`, `js/engine.js`, `js/game.js`, `tools/flow_test.js`, `DESIGN.md` | lead | shell, engine, run flow, integration tests |
| `js/data.js` | content | every piece of content and text: areas, levels, chunks, enemies, bosses, items, shops, loot, achievements, story, cutscene scripts, talk show script, AI lines |
| `js/art_actors.js` | art-actors | pixel data: Carl (+skins, back view), Donut, Mongo (small, big, clockwork), Katia, all NPCs, enemies, bosses, portraits (3 frames) |
| `js/art.js` | art-core | rasterizer (keep), themes: tiles + backgrounds (day and night), objects, doors, fx, projectiles, pickups, icons, cutscene panels, raster wobble |
| `js/audio.js` | audio | synth upgrade (expansion voices + samples), all SFX, all music |
| `js/stage.js` | gameplay | every side-view mode: streets (the overworld), side, chase, climb, drop, survival, plant, escape, boss/facade; player kit, party, enemies, bosses |
| `js/rooms.js` | scenes | into-the-screen room mode (the Big Top) |
| `js/show.js` | scenes | the Danger Zone talk show scene |
| `js/ui.js` | ui | HUD, dialog (talking portraits), toasts, menus, pause, title (+book 1 import prompt), class selection scene, cinema player, map screen, quest log, inn (safe room), shops, Desperado Club, loot boxes, wardrobe, character, achievements, settings, results, death, ending/credits |

Do not edit files you do not own. Code defensively against missing pieces (feature-detect, fall
back, never crash). If you need something the contract doesn't give you, write it down in your
final report. Do not `git commit`; the lead commits.

## 3. Engine changes (lead; done before modules start)

- Save key `dcw2_save_v1`. Book One's save (`crawler-book1/`, key `dcc1_save_v1` or its active slot
  `dcc1_save_v1_s<n>` from `dcc1_slot`; the archived prototype's `dcw_save_v1` as a fallback, same origin on
  the website) is read once at boot into `DCW.legacy.book1` (parsed object or null). Read-only.
- **Continuous crawl.** Book One saves its finished crawler in `meta.carry` when you win (the run itself
  is cleared when you leave the ending). Book Two's import builds `save.meta.carry` from that snapshot,
  or from a Book One run still on disk, and every new crawl starts as that crawler: same level number
  (`run.lvBase = level - 1`, so Floor 3's scale starts at L 1 there), stats carried as they are with
  Floor 3's starting stats as the floor, bonus hp, xp, stat points, views, gold, potions, bombs as
  hob-lobbers, unopened boxes, name and skin. Without a carry, a crawl starts fresh at level 13.
- `DCW.boot()` also inits `DCW.rooms` and `DCW.show`.
- Debug: `?debug` as before. Keys in debug: `9` clears the current level, `0` god mode,
  `8` flips day/night (lead, through `DCW.game.debugFlipPhase`).
- Everything else in engine.js is unchanged from book 1.

## 4. Save + run schema (game.js)

```js
DCW.save = {
  version: 1,
  unlocks: { skins: ['carl_f3'] },
  equipped: { skin: 'carl_f3' },
  run: null | RUN,
  meta: { achievements: {id:true}, counters: {}, runs, wins, deaths, boxesOpened, seenIntro,
          imported: false | { skins: n, achievements: n, wins: n } },
  settings: { music, sfx, shake, crt, touch, easy, keys }
}
RUN = {
  hoursLeft: 192,           // floor timer: 8 days. 0 = the floor collapses (game over)
  hour: 7,                  // clock hour of day 0-23 (day is 07:00-18:59, night 19:00-06:59)
  area: 'village', areaX: null,   // street area + x (px) to return to
  levelId: null,            // current level id while inside one (run.level is Carl's level number)
  inInn: null, inClub: null,  // inn / club id while inside one
  act: 1,                   // 1-3, raised by levels (level.act) and flags act2 / act3
  wanted: null,             // areaId while guards are after you
  cleared: { levelId: true },
  flags: { flagName: true },      // story flags (data.events / levels set them)
  quests: { questId: 'active' | 'done' },
  items: { id: count },     // explosives, consumables, key items (see data.items)
  hp, level: 13, xp, statPoints, stats: { str, con, dex, int }, bonus: { hp, str, con, dex, int },
  gold, potions, views, boxes: [ {tier, from} ], revivals: 3,
  kills, deaths, totalTime, seed,
  banned: { areaId: hoursLeftWhenBanLifts },   // guard law
  selected: 'jug',          // selected explosive type
  won: false
}
```

### Player formulas (game.js implements `DCW.game.playerStats()`)

Book levels: Carl starts at **13** (as in the book) and should end near 27. Let `L = level - 12`.
- `maxHp = 16 + (con-4)*2 + (L-1)*2 + bonus.hp` (+ skin perk), start: str 5, con 4, dex 4, int 4
- punch `dmg = 3 + (str-5) + floor((L-1)/2)`; kick/stomp `round(dmg*1.5)`, **x2 with flag
  `freeballing`** (the boxers upgrade). Crit `0.05 + (dex-4)*0.02` (x2). Speed mul `1 + (dex-4)*0.03`.
- explosives: `hob 10 + L*2` (r 20), `dyn 22 + L*3` (r 40, 1.6 s fuse), `jug 8 + L*2` (r 30) then
  fire 1 dmg per 0.25 s for 3 s in a 48px strip, `smoke` 0 dmg (enemies inside lose track 4 s).
- Donut missile `3 + floor(int/2) + floor((L-1)/2)`; Mongo bite `2 + L` (x1.8 when `mongo_big`).
- xp to next `round(25 * L^1.5)`; level up: +1 stat point (+2 every 5th), heal 30%.
- potion heals 50% max hp; snack 4 hp; starting run: 3 revivals, 2 potions, 120 gold,
  items `{ jug: 2, hob: 0, dyn: 0, smoke: 2 }`.

`playerStats()` returns `{maxHp, dmg, kickDmg, crit, speedMul, def, hobDmg, dynDmg, jugDmg,
missileDmg, biteDmg, goldMul, viewMul, extraJump, skinPerk, freeballing, xistera, fangCaps,
mongoBig, party}`. `party` is the list of companions with you right now (see 7).

Enemy balance: regular mobs take 2-4 punches at the expected level (Act 1: 13-18, Act 2: 18-22,
Act 3: 22-27); bosses 45-90 s.

## 5. Game flow API (game.js, lead) - what other modules call

```js
DCW.game.run                       // getter
DCW.game.newRun(), continueRun(), toTitle()
DCW.game.clock()                   // {hoursLeft, day (1-8, counting up), hour, phase:'day'|'night', label:'6D 14H', night:bool}
DCW.game.advanceClock(hours)       // may trigger collapse
DCW.game.flag(name) -> bool; setFlag(name, v=true)
DCW.game.hasItem(id), itemCount(id), giveItem(id, n=1), useItem(id, n=1) -> bool
DCW.game.party() -> ['donut','mongo'] (+'katia' after flag katia_joined); [] inside solo levels
DCW.game.playerStats()
DCW.game.addXP(n), addGold(n), addViews(n), heal(n), damageTaken(n)
DCW.game.giveLootBox(tier, from), openLootBox(i) -> [Reward], buy(shopId, itemId) -> {ok,msg},
         price(shopId, itemId), usePotion() -> bool, spendStat(stat) -> bool, equip('skin', id)
DCW.game.track(event, n), achieve(id)
DCW.game.objective() -> {text, area} | null    // first unfinished entry of data.objectives

// streets (the overworld)
DCW.game.goArea(areaId, entry)     // entry: 'left' | 'right' | doorChar | {x}. Fades into the street.
DCW.game.doorState(areaId, ch)     // {visible, locked, lockText, label, kind, cleared, target}
DCW.game.useDoor(areaId, ch)       // stage.js calls when the player presses UP at a door
DCW.game.edge(areaId, side)        // stage.js calls when the player walks off a street edge
DCW.game.crime(areaId)             // a citizen was hurt in a guarded area: guards come (stage.js handles the guards)
DCW.game.saveStreetPos(areaId, x)
DCW.game.talk(npcId)               // NPC on a street: lines / event script
DCW.game.areaEvents(areaId)        // called by stage.js on street enter; runs any pending events

// levels
DCW.game.enterLevel(levelId)       // dispatches by level.kind to stage / rooms / show scenes
DCW.game.levelCleared(result)      // {levelId, kills, time, damageTaken, maxCombo, views, gold, secrets}
DCW.game.playerDied(result)        // {levelId, cause}
DCW.game.fleeLevel()               // pause menu FLEE: back to the street, no rewards, costs 1 hour

// places
DCW.game.enterInn(innId), leaveInn(), rest(innId, until) -> {ok,msg}   // until 'morning' | 'night'
DCW.game.craft(recipeId) -> {ok,msg}
DCW.game.playCinema(id, onDone)    // data.cinema[id] through DCW.ui.scenes.cinema
DCW.game.importLegacy() -> summary | null
DCW.game.takeStairs()              // early stairs (circus park) = early ending, after a confirm
```

Time costs: clearing a level costs `level.hours` (default 3). Fleeing or dying costs 1-2 hours.
`rest(inn,'morning')` jumps to 07:00 next day (costs the inn's price, full heal);
`rest(inn,'night')` jumps to 19:00 today (free, no heal). If `hoursLeft` hits 0 the floor
collapses: game over scene.

## 6. Data contract (data.js, content)

Everything under `DCW.data`. Book 1's data is replaced wholesale.

### 6.1 Areas (streets: the overworld)

```js
DCW.data.areas = {
  village: {
    id: 'village', name: 'TINY VILLAGE', theme: 'village', music: 'village', musicNight: 'village_night',
    guarded: true,                         // guards + citizens by day, guard law applies
    rows: [ /* 12 strings, all the same length, 60-200 cols; same tile legend as chunks */ ],
    doors: {                               // door chars '0'-'9' and 'A'-'F' placed in rows
      '1': { kind: 'inn', target: 'pug', label: 'THE BELLY-RUBBED PUG', sprite: 'door_inn' },
      '2': { kind: 'level', target: 'a1_lemurs', label: 'COLLAPSED STREET', sprite: 'manhole',
             phase: 'any'|'day'|'night', showIf: 'flag', hideIf: 'flag', needs: 'flag', lockText: '...' },
      '3': { kind: 'shop', target: 'lucky', label: "LUCKY'S GENERAL GOODS", sprite: 'door_shop' },
      '4': { kind: 'area', target: 'ruins_w', entry: 'left', label: 'VILLAGE GATE', sprite: 'gate' },
      '5': { kind: 'club', target: 'desperado', label: 'PUB', sprite: 'door_pub' },
      '6': { kind: 'stairs', label: 'STAIRWELL', sprite: 'stairs_down', showIf: 'circus_gone' },
      '7': { kind: 'npc', target: 'gumgum', sprite: null }      // talk spot without a door
    },
    edges: { left: null, right: { area: 'ruins_w', entry: 'left' } },   // walking off an edge
    npcs: [ { id: 'mordecai_tour', x: 12, sprite: 'mordecai', phase: 'day', showIf, hideIf } ],
    enemies: { day: [['lemur', 2]], night: [['street_urchin', 3], ['incubus', 1]] },
    density: { day: 0.3, night: 0.7 },     // light enemies per screen, they respawn slowly
    citizens: ['citizen_human', 'citizen_skyfowl'],   // day crowd in guarded areas
    signpost: true                         // a signpost rock (map reveal) somewhere: char 'p'
  }
}
```
Areas needed: `village` (starting tiny village, Belly-Rubbed Pug), `ruins_w` (ruins between the
village and the circus), `circus_park` (outside Grimaldi's circus; after `circus_gone` the circus
is gone and the Floor 4 stairs stand in the park), `ruins_e` (the long road to the settlement:
the Dispenser's neighborhood, the YMCA-like building), `settlement` (Medium Skyfowl Settlement main
street: One-Eyed Narwhal, Lucky's, merchants, the pub with the Desperado Club door, Silk Road
Market, the Danger Zone trailer lot, Apito Education Center, alley mouths), `admin` (the elevated
administrative district: Quill's building, the guard depot, the 201st temple), `east_stairs`
(beyond the settlement, the eastern stairwell, used by the finale).

### 6.2 Levels

```js
DCW.data.levels = {
  a1_lemurs: {
    id, name: 'COLLAPSED STREET', act: 1, kind: 'side', theme: 'ruins',
    night: false,            // force the night palette (else follows the clock)
    dark: false,             // limited light radius (Donut's Torch spell lights around Carl)
    music: 'ruins', hours: 3,
    chunks: { start, pool: [], count, end, insert: [] },      // side, chase, survival, plant, escape, boss, facade
    layout: [ 'rows', ... ],                                  // climb / drop: explicit rows, 20-30 cols wide, any height
    enemies: [['lemur', 3]], elite: [['stilt_clown', 1]], flyers: [['brain_boiler', 1]],
    boss: 'heather',         // boss / facade / chase-into-boss levels
    solo: false,             // true = no companions (Carl alone)
    swap: null,              // 'mongo' = the player IS Mongo for this level
    chase: { pursuer: 'heather', speed: 62, catchDmg: 4 },    // kind 'chase'
    survival: { seconds: 90, waves: [['street_urchin', 3]], rate: 1.2, max: 10, guard: 'barricade' },
    plant: { charges: 3 },   // kind 'plant': plant at 'C', decoys at 'Y', detonate at 'T'
    escape: { seconds: 420, bursts: [360, 270, 180, 90] },    // kind 'escape'
    room: { ... },           // kind 'rooms', see 9
    show: 'danger_zone',     // kind 'show', see 10
    intro: 'cinemaId' | ['AI line'], outro: 'cinemaId',       // played before / after (on clear)
    signs: ['...'], npcs: [ {id, sprite, lines:[...]} ],      // 'n' signs, 'N' NPC spots in order
    questItem: 'scratch_ticket', rescue: 'mongo',             // 'Q' and 'R' as in book 1
    reward: { box: 'silver', xp: 40, gold: 30 },
    sets: ['flag'], gives: [ {item:'dyn', n:3} ], quest: { start: 'show_must_go_on' } | { done: '...' },
    optional: false          // side areas
  }
}
```
Kinds: `side | chase | climb | drop | survival | plant | escape | boss | facade | rooms | show`.
`side` with `dark:true` is the darkness type. `boss` = side arena with a boss. `facade` = the
screen-filling boss on a building front.

### 6.3 Chunks + legend

Chunks are as in book 1 (12 rows, same lengths, ground rows 10-11 at both edges so any chunk
chains). Book 1's legend applies (`. # X = ^ ~ H b o h m ? e E f P D K < > v c n $ Q R S L`).
Additions:

| ch | meaning |
|---|---|
| `0-9 A-F` | street door spot (areas only), key into `area.doors` |
| `p` | signpost rock (streets): reveals the map |
| `N` | friendly NPC spot (level.npcs / area.npcs in order) |
| `C` | dynamite charge spot (plant levels): press UP to plant |
| `Y` | decoy spot (plant levels): press UP to leave a clockwork Mongo / smoke decoy |
| `T` | detonation spot (plant levels): stand here with all charges planted, press BOMB |
| `k` | Krasue: a headless body object here + its flying head nearby (see enemies) |
| `t` | trash pile (Street Urchins go for it; standing in their way angers them) |
| `w` | wave spawn point (survival) |
| `G` | guard statue (depot, in stasis at night; decoration that blocks) |
| `B` | barricade (survival guard object with hp) |

Vertical levels (`climb`, `drop`) use `layout`: explicit rows (20-30 columns, any number of rows).
Climb: `P` near the bottom, `D` at the top. Drop: `P` at the top, `D` at the bottom. Breakable
crates `b` can make floors you punch through. Checkpoints `c` matter here.

### 6.4 Enemies (ids fixed, art draws `<id>_walk(2+) _attack _hurt`)

Book 1's enemy fields apply (`name hp dmg speed w h ai xp gold sprite flavor` + AI params).
New fields: `magicOnly` (ghost-class: explosives and fire do nothing; punches with the gauntlet,
kicks, Donut's missiles and Mongo with Fang Caps work), `fearImmune`, `darkMul` (damage and speed
multiplier while outside the light), `regrow` (mold lions come back once unless burned),
`neutral` (won't attack until provoked), `citizen` (0 xp; hurting one is a crime), `body` (Krasue).

Ids and AIs (gameplay implements the new AIs):
| id | ai | notes |
|---|---|---|
| `lemur` | `perch` | Former Circus Lemur L8: waits high (rooftop/ledge), throws knives, drops down when close |
| `stilt_clown` | `stilt` | Terror the Clown L10: 11-foot clown fused to stilts, long reach, chases, `fearImmune` |
| `fat_clown` | `jumper` | Clammy-type clown L9: belly bounce |
| `mold_lion` | `charger` | L15: pounces, `regrow` |
| `giraffe` | `launcher` | artillery giraffe: stationary-ish, flings lemurs in arcs (a spawner) |
| `street_urchin` | `urchin` | L8 spiky tumbleweed janitor, night only, `neutral` |
| `brain_boiler` | `floater` | slow floating squid-umbrella, psionic ring pulse, `fearImmune` |
| `berserker` | `berserker` | Shambling Berserker L12, 13 ft (about 44 px tall), slow; `darkMul: 4` and berserk dash in the dark |
| `city_elf` | `caster` | L16 201st militia elf: casts a darkness orb (local dark zone 6 s) and bolts |
| `wand_bearer` | `caster` | Apito Education Center elves (Salvatore/Carmine look) |
| `krasue` | `krasue` | L16 flying head trailing organs, `magicOnly`; the head regrows at its body unless the body (`krasue_body` object at `k`) is destroyed; XP only when the body dies |
| `shadow_leak` | `swarm` | L14 smoke ghosts, cold touch, `magicOnly`, lots of XP |
| `incubus` | `charm` | night streets: charm flips your left/right for 2 s |
| `ruin_flocker` | `flyer` | escape level swarm (original design: ragged feathered ruin bats) |
| `guard` | `guard` | Village Guard Swordsman L75: invulnerable, slow, lethal; only appears for a crime |
| `citizen_human`, `citizen_skyfowl`, `chickadee` | `citizen` | day crowd in guarded streets, 1 hp, 0 xp |

Book 1 AIs (`walker chaser jumper flyer shooter charger turret spawner bomber hopper`) still exist.

### 6.5 Bosses

Book 1 boss fields + move primitives apply. Bosses: `heather` (Heather the Bear: roller-skate
charges, jump slam, a parasite-worm phase; at 25% a `custard` scratch ticket drops: grabbing it
cures her worms, she slows, and Carl finishes her), `dispenser` (facade boss, see 8.7),
`vincente` (City Elf with Meat Hooks: `meat_hooks` move yanks Mongo away for 6 s, plus darkness and
bolts), `terror_big` (a big Terror the Clown miniboss). New primitives: `worms` (spawns crawling
worm projectiles), `meat_hooks`, `darkness`, `cloak` / `reveal` / `sweep` / `spit:PROJ:N` (facade).

### 6.6 Items (`DCW.data.items`)

```js
items = { jug: { name: "CARL'S JUG O'BOOM", kind: 'explosive', icon, desc },
          hob: { name: 'HOB-LOBBER', kind: 'explosive' }, dyn: { name: 'GOBLIN DYNAMITE', kind: 'explosive' },
          smoke: { name: 'SMOKE BOMB', kind: 'explosive' },
          moonshine: { kind: 'material' },   // crafted into jugs at an inn
          big_top_ticket: { kind: 'key' }, scratch_ticket: { kind: 'key' }, gate_pass: { kind: 'key' }, ... }
```
Explosive ids are fixed: `jug hob dyn smoke`. Key items are the content agent's.

### 6.7 Other data

- `DCW.data.shops = { lucky: { name, keeper, sprite, items: [ {id, price, give:{item,n}|{potion:n}|{skin}} ] }, pustule, quint, edge_dancer, ... }`
- `DCW.data.inns = { pug: { name, price: 10, keeper: 'gordo' }, narwhal: { name, price: 20, keeper: 'fitz' } }`
- `DCW.data.recipes = { jug: { name, needs: {moonshine:1}, gives: {jug:1} } }`
- `DCW.data.boxTiers`, `lootTables` (book 1 format; tiers include the book's named boxes such as
  Silver Earth Box, Gold Fan Box, Platinum Quest Box, Lucky Bastard Box, Celestial),
  `skins` (ids below), `achievements` (book 1 format), `titles`, `ai` (System AI line pools as in
  book 1 plus `night`, `day`, `crime`, `ban`, `collapse`), `mordecai` (inn tips, he is a Level 50 Incubus here),
- `DCW.data.quests = { show_must_go_on: { name, desc }, sex_workers: {...}, fools_glass: {...} }`
- `DCW.data.objectives = [ { done: 'flag', text: 'FIND OUT WHAT THE CIRCUS WANTS', area: 'circus_park' }, ... ]`
- `DCW.data.events = [ { id, area: 'village', when: { flags:[], notFlags:[], phase }, cinema: 'id' | lines: [...], sets: ['flag'], gives: [...], once: true } ]`
  (street events fire on entering the area when conditions hold)
- `DCW.data.cinema = { intro: [shot, ...], ... }` (see 11.3)
- `DCW.data.show = { danger_zone: {...} }` (see 10)
- `DCW.data.story = { credits: [...], earlyEnding: [...], collapseEnding: [...] }`
- `DCW.data.classPick = {...}` (see 11.2)
- `DCW.data.legacy = { veteranBox: 'gold', championBox: 'legendary', title: 'BOOK 1 VETERAN' }`

Skins: `carl_f3` is the default (Carl's Floor 3 look). Book 1 skin ids stay valid as palette
swaps on the new sprite so imported skins work: `carl_boxers carl_jacket carl_bodyguard carl_kilt
carl_hazmat carl_pajamas carl_clown carl_toga carl_gold`. New: `carl_magistrate` (unlocked by
becoming Magistrate), `carl_primal`.

## 7. Party (gameplay)

- **Donut** rides on Carl's shoulder (`donut_shoulder` sprite drawn at Carl's shoulder anchor). She
  auto-fires Magic Missile at the nearest enemy in range (~1.4 s). **Second Chance**: 12% on a kill,
  the dead enemy rises as a tinted ally for 8 s. **Acute Ears**: hidden enemies (perched lemurs,
  the Dispenser's next strike) get a small pip. **Torch**: in dark levels she lights a radius
  around Carl.
- **Mongo** runs alongside (book 1 mongo AI), bites and charges, never dies (stunned when hit).
  Small until flag `mongo_big`, then `mongo_big_*` sprites and stronger. Flag `fang_caps`: he
  hurts ghosts.
- **Katia** (flag `katia_joined`) follows and blocks projectiles with a shield every few seconds
  (book 1's katia shield ability).
- `level.solo` = Carl alone. `level.swap = 'mongo'`: the player is Mongo (fast, pounce jump,
  bite on attack, no bombs/special/potion, smaller hitbox).

## 8. Stage contract (stage.js, gameplay)

`DCW.stage.scene.enter({ levelId })` for levels, `DCW.stage.scene.enter({ areaId, entry })` for
streets. Book 1's stage behaviour is the base (physics, combat, combo, views, pickups, pits,
checkpoints, crates, levers, cages, quest items, HUD via `DCW.ui.drawHUD`, pause via
`DCW.ui.openPause`). Debug keys as in book 1.

### 8.1 Player kit (inputs)
- `attack` punch combo (the War Gauntlet). `down+attack` kick, `down+attack` in the air: stomp.
  Kicks and stomps double with `freeballing`.
- `bomb` throws the selected explosive (`run.selected`); `up+bomb` cycles among owned types.
  `jug`: lob, explodes into a burning strip (fire kills regrowing mold lions for good and burns
  Krasue bodies and nests). `hob`: lob; with flag `xistera` it launches fast and straight and
  bursts on impact. `dyn`: lob, 1.6 s fuse, big blast. `smoke`: cloud, enemies inside lose you.
- `special` (meter full): **Panic** = Fear (stuns all non-`fearImmune` enemies on screen 2.5 s)
  + a Donut missile barrage. `down+special` with a `dyn`: **Boomy Boy** (two clockwork Mongos run
  forward and blow up). `up+special` with a `jug`: **Mic Drop** (jug tossed straight up, Carl
  Puddle Jumps ~5 tiles forward/up to safe footing, jug lands and blows big).
- `potion` drinks a potion. `up` at a door/NPC/sign/charge spot interacts.

### 8.2 Streets (the overworld)
Side-view, one long street per area, built from `area.rows`. Doors drawn by `door.sprite` with
their label shown when near; locked doors show a padlock and `lockText`. `up` at a door calls
`DCW.game.useDoor(areaId, ch)`. Walking off an edge calls `DCW.game.edge(areaId, side)`. Light
enemies spawn off-screen from `area.enemies[phase]` at `area.density`, few at a time, respawning
slowly; they give normal xp/gold. Day/night follows `DCW.game.clock()` (theme night variant,
night enemy list). In `guarded` areas by day: citizens wander; hurting a citizen calls
`DCW.game.crime(areaId)` and spawns `guard`s from both sides (invulnerable, slow, lethal). At
night the guards are gone. NPCs from `area.npcs` stand at their x (press `up` to talk ->
`DCW.game.talk(id)`). Signpost rock `p`: `up` reveals the map (`DCW.game.setFlag('map_'+areaId)`).
No exit door, no results screen. The HUD shows the clock and the objective. `DCW.game.saveStreetPos`
on leaving. Call `DCW.game.areaEvents(areaId)` once after entering.

### 8.3 Chase (`kind:'chase'`)
Camera autoscrolls right at `chase.speed`; the pursuer (boss sprite) is drawn at the left edge and
lunges; touching it does `catchDmg` and throws Carl forward. Reaching the end chunk starts the
boss fight with the same boss in an arena (book 1 boss logic).

### 8.4 Climb and drop (`climb`, `drop`)
Built from `level.layout`; the camera follows vertically (and horizontally if wider than 20 cols).
Falling off the bottom of the screen in a climb = pit rule (3 hp, back to checkpoint). Drop:
collapsing floors, breakable crate floors, enemies on each floor, exit `D` at the bottom.

### 8.5 Darkness (`dark: true`)
Light radius around Carl (Donut's Torch, ~56 px); City Elf darkness orbs make local zones where
even the torch fails. Enemies with `darkMul` are multiplied while outside any light.

### 8.6 Survival (`survival`)
Fixed camera arena. Waves spawn at `w` spots for `survival.seconds` (HUD countdown to dawn). The
barricade `B` has hp; urchins go for it. If it breaks, Donut's Cockroach line plays and the
urchins turn on Carl. Surviving the timer clears the level.

### 8.7 Facade boss (`facade`, the Dispenser)
Arena on a street whose whole background is a building front. The boss is a giant manta ray
camouflaged against the wall: mostly invisible (drawn faint), it reveals parts (eyes, mouth,
wing edges) one at a time; only revealed parts take damage. Moves: `sweep` (its body peels off
the wall and sweeps across the street, telegraphed), `spit`, `cloak` (relocates). Donut's Acute
Ears shows a pip where the next part will open. Boomy Boy deals triple damage to it.

### 8.8 Plant and detonate (`plant`)
Charges `C`: hold `up` 1 s to plant (vulnerable while planting). Decoys `Y`: `up` to drop a
clockwork Mongo decoy that lures Krasue heads within 120 px to hover over it. A Krasue that sees
you planting (within 64 px) attacks. With all `plant.charges` planted, stand on `T` and press
`bomb`: a huge blast (flash, shake, rumble), then the level clears.

### 8.9 Timed escape (`escape`)
HUD timer `escape.seconds`. At each burst time: (1) magic stripped: no Donut missiles, special
meter emptied and locked 20 s; (2) magic weapons fire on their own: projectiles rain from the top
for 30 s; (3) magic armor destroyed: def 0 and max hp -25% for the rest of the level; (4) stored
magic goes off: while Carl carries explosives, one goes off near him every 5 s (press `bomb` to
throw them; `up+bomb` dumps the lot), and Donut's crown crumbles. Timer at 0 = death. The exit
`D` is the eastern stairwell door.

### 8.10 Krasue, regrow, urchins, guards
- `k`: spawns a `krasue_body` object (hp, physical, hurt by anything incl. fire) and a `krasue`
  head that hovers within 96 px of it. Head at 0 hp: it shrieks and vanishes, reappearing at the
  body after 8 s, unless the body is gone. Destroying the body kills the head for good and gives
  the XP.
- `regrow`: a mold lion killed by anything but fire rises again once after 8 s.
- `urchin`: neutral; heads for `t` trash and corpses; standing in its path for 1 s or hitting it
  makes it hostile.

## 9. Rooms contract (rooms.js, scenes): into-the-screen (Contra base style)

`DCW.rooms.scene.enter({ levelId })`. View from behind Carl (`carl_back_*` sprites) at the bottom
of the screen; he moves left/right, jumps, ducks. The room is drawn procedurally in rooms.js with
the NES palette: for the Big Top, a circus ring seen in perspective (striped tent walls, bleachers,
sawdust ring, trapezes), a back wall with the room's target (a huge `tent_pole` sprite or drawn
procedurally). Enemies appear at the back (doors, tent flaps, trapezes) and come toward the
camera, drawn with nearest-neighbor scale steps (0.5, 0.75, 1.0, 1.25 as they approach).
`attack` throws ring junk into the screen (weak, unlimited); `bomb` throws the selected explosive
(strong, uses inventory). Destroying the target clears the room; next room. Data:
```js
levels.a1_bigtop = { kind: 'rooms', theme: 'bigtop', music: 'bigtop', boss: null,
  room: { rooms: [ { name: 'RING ONE', target: { kind: 'pole', hp: 60 }, waves: [['fat_clown',2],['lemur',2]], rate: 1.4 },
                   { name: 'RING TWO', ... }, { name: 'RING THREE', ... } ],
          finale: { kind: 'vine', seconds: 45 } } }
```
Finale `vine`: Grimaldi's center ring. Vine tendrils lash from the back and sides and worms crawl
at Carl; a POISON meter fills over `seconds`; survive it (the blood plan is working), then the
level clears and its `outro` cinema plays. Enemies use their `_walk` sprites (back view not
needed). Results via `DCW.game.levelCleared` / `playerDied`. HUD via `DCW.ui.drawHUD`.

## 10. Talk show contract (show.js, scenes)

`DCW.show.scene.enter({ levelId })` with `level.show = 'danger_zone'`. Studio backdrop (art theme
`studio`), host Ripper Wonton at his desk, the panel (Hekla, Manasa, Tucker, Princess D'nadia), Carl
and Donut on the couch, an audience strip, an APPLAUSE / VIEWS meter. The script:
```js
DCW.data.show.danger_zone = {
  intro: [ {who, text} ], segments: [
    { who: 'RIPPER WONTON', q: 'question text', answers: [ { text, views: +200, react: [ {who,text} ], donut: 'optional Donut cut-in' } x3 ] }, ...
  ],
  hekla: [ {who, text} ], outro: [ ... ], blast: 'cinemaId'   // the trailer explosion
}
```
Characters talk with talking portraits (UI dialog). The views meter climbs/falls with answers
(+ applause SFX, a laugh-track blip). The final total gives `views` and a Gold Fan Box if high.
Ends with the `blast` cinema and `DCW.game.levelCleared({..., views})`.

## 11. UI contract (ui.js, ui)

Book 1's UI API stays (`say, toast, announce, menu, confirm, openPause, openBoxes, openWardrobe,
openCharacter, openAchievements, openSettings, drawHUD, readMore`). Changes and additions:

### 11.1 Dialog with talking portraits
Portraits are 32x32 with 3 frames: 0 neutral, 1 mouth open, 2 blink. While the typewriter runs,
alternate 0/1; blink (frame 2) every few seconds. `WHO_PORTRAIT` covers the new cast
(`p_carl p_donut p_mongo p_mordecai p_katia p_signet p_grimaldi p_apollon p_clammy p_heather
p_gordo p_fitz p_clarabelle p_quint p_pustule p_gumgum p_vincente p_quill p_burgundy p_remex
p_bautista p_hekla p_ripper p_zev p_odette p_lucia p_ai p_eunice p_edge_dancer p_talon p_lucky`).

### 11.2 Title, import, class selection
- Title: "DUNGEON CRAWLER WORLD" / "BOOK 2: CARL'S DOOMSDAY SCENARIO". If `DCW.legacy.book1` exists
  and `meta.imported` is false, offer IMPORT BOOK 1 SAVE (calls `DCW.game.importLegacy()` and
  shows what came over) before NEW CRAWL.
- `DCW.ui.scenes.classPick.enter({ onDone })`: the game guide's room (art theme `guide_room`:
  golden brick, fake starry ceiling, red carpet). Data `DCW.data.classPick = { carlRaces:
  [ {id, name, desc, locked: 'why'} ], carlClasses: [...], donutLines, mordecaiLines }`. The AI
  narrows each list to three; only Primal and Compensated Anarchist can actually be picked; the
  others are locked with rude reasons. Donut's Former Child Actor pick and the manager binding
  play as dialog.

### 11.3 Cinema player
`DCW.ui.scenes.cinema.enter({ id | shots, onDone })`, letterboxed (16 px bars). A shot:
```js
{ bg: 'theme' | 'panel:<id>', night: false, actors: [ { sprite, x, y, flip, frame, anim:'idle'|'walk'|'talk', moveTo:{x,y,t} } ],
  lines: [ {who, text} ], wait: 2.0, shake: 0, flash: '#fff', wobble: 0, sfx: 'name', music: 'track', fade: true }
```
`bg` draws `DCW.art.background(theme)` or `DCW.art.panel(ctx, id, ...)`. Lines play as dialog with
portraits (skippable with START, advance with A). Actors are drawn with `DCW.art.sprite`.

### 11.4 HUD
`drawHUD(ctx, h)` adds: `clock` (label + sun/moon icon), `objective` (short line, streets only),
`explosive` (selected id + count), `party` icons (donut, mongo, katia), `timer` (escape /
survival / chase), `boss` bar as book 1, `meters` (e.g. POISON for rooms, VIEWS for the show).

### 11.5 Map screen
`DCW.ui.openMap()` on `select`: a schematic of the areas (village - ruins_w - circus_park -
ruins_e - settlement - admin - east_stairs) as boxes linked by roads, the current area flashing,
door icons for known levels (cleared flags), the objective's area marked, the clock.

### 11.6 Inn, shops, club
- `DCW.ui.scenes.inn.enter({ innId })` (book 1 safe room adapted): Renaissance-fair pub (art
  theme `inn_pug` / `inn_narwhal`), Mordecai as a Level 50 Incubus (`mordecai` sprite + `p_mordecai`),
  the keeper (Gordo / Fitz). Menu: SLEEP UNTIL MORNING (price), WAIT FOR NIGHT, TALK TO MORDECAI,
  CRAFT (recipes), LOOT BOXES, CHARACTER, WARDROBE, ACHIEVEMENTS, LEAVE. Pet Donut gag stays.
- `DCW.ui.openShop(shopId)`: buy list from `data.shops[shopId]` via `DCW.game.buy`.
- `DCW.ui.scenes.club.enter({ clubId })`: the Desperado Club (theme `club`: Vegas strip + Mardi
  Gras + 70s disco), Clarabelle at the door, Quint's pharmacy (shop `quint`), the dance floor
  gag, LEAVE back to the pub door.
- Pause: RESUME, MAP, QUESTS (quest log from run.quests + data.quests), CHARACTER, INVENTORY,
  SETTINGS, FLEE (levels only), QUIT TO TITLE.

### 11.7 Results, death, endings
Results after a level (book 1). Death: revivals as book 1; guard deaths say DEATH PENALTY. Game
over when the clock hits 0. Ending: `DCW.ui.scenes.ending.enter({ kind: 'win'|'early' })` then credits.

## 12. Art contract (art.js art-core, art_actors.js art-actors)

Book 1's API and def format apply (`sprite, has, info, icon, portrait, tile, background,
boxColor`). Additions:
- `DCW.art.background(ctx, theme, camX, camY, opts)` with `opts.night` (night variant) and
  `opts.t`. Line-scroll bands welcome.
- `DCW.art.tile(ctx, theme, ch, x, y, info)` with `info.night`.
- `DCW.art.panel(ctx, id, x, y, t)` + `DCW.art.hasPanel(id)`: cutscene panels, 256x112 or so.
  Panels: `guide_room arrival circus_night signet_tattoos heather_skates bigtop_vine
  grimaldi_peace settlement_view desperado danger_zone trailer_blast quill_desk featherfall
  remex glass_case doomsday bursts stairwell greenroom`.
- `DCW.art.wobble(ctx, y0, y1, amp, freq, t)`: per-scanline horizontal offsets of what is already
  drawn (heat haze, wild magic, drunk).

Themes (tiles + backgrounds, each with day and night): `village ruins circus basement settlement
alley admin office nest ymca school depot escape restroom temple` (side-view), and backdrops for
`inn_pug inn_narwhal club studio greenroom guide_room` (UI/cinema; `background()` only).
`bigtop` is drawn by rooms.js itself.

Objects/doors (sprites): `door_inn door_shop door_pub door_club door_wood door_school door_admin
manhole tent_flap gate trailer stairs_down alley_mouth signpost` (+ `signpost_on`), `charge`
(planted dynamite, 2 frames blinking), `charge_spot`, `decoy_mongo`, `detonator`, `krasue_body`,
`trash`, `barricade` (+ `barricade_broken`), `guard_statue`, `tent_pole`, `scratch_ticket`,
`custard`, `ring_junk`, `fire` (3), `darkness_orb` (2), `lock`, `crate`, `chest`, `door`,
`door_open`, `door_locked`, `checkpoint`, `sign`, `cage`, `cage_broken`, `lever`, plus book 1's
fx (`explosion hit dust sparkle shockwave smoke`), pickups (`coin snack potion box_*`),
projectiles (`knife bolt worm spit dyn_stick hob jug psionic missile`), icons (book 1 set +
`sun moon jug hob dyn smoke clock quest map`).

Actors (art-actors). Facing right, bottom-center anchored, 1px black outline, 3-4 colors + outline
per region, big readable silhouettes. **Use SOURCE.md section 5/6 for looks.**
- Carl, Floor 3 look (`carl_f3` palette chars as book 1 so book 1 skins still recolor): leather
  jacket missing its right sleeve, trollskin shirt, dark cloak over the jacket, War Gauntlet on
  the right hand, spiked kneepads, BigBoi boxers, bare glittery feet. Frames as book 1
  (`carl_idle(2) run(4) jump fall punch(2) kick(2) airkick throw hurt dead climb(2) victory`) plus
  `carl_launch` (xistera shot), `carl_plant`, `carl_back_idle(2) carl_back_run(2) carl_back_throw
  carl_back_jump carl_back_hurt` (rooms view).
- Donut: `donut_shoulder(2)` (sitting on Carl's shoulder), `donut_cast`, `donut_idle(2)`,
  `donut_run(2)`, `donut_down` (knocked out).
- Mongo small (`mongo_idle(2) mongo_run(2) mongo_act`, dog-sized, pink/blue/red feathers),
  big (`mongo_big_idle(2) mongo_big_run(4) mongo_big_act`, pony-sized), clockwork
  (`mongo_clock_run(2)`, brass), and player-Mongo frames `mongo_jump mongo_hurt`.
- Katia (`katia_idle(2) katia_run(2) katia_act`): her first human disguise is off (blond, eyes too
  high, crooked nose).
- NPCs (idle 2 frames each): `mordecai` (Level 50 Incubus: gray skin, gray-black ponytail, short
  horns, barbed tail, black bat wings, tuxedo shirt), `gordo` (Bopca), `fitz`, `lucky`,
  `edge_dancer`, `talon` (skyfowl merchants), `pustule`, `clarabelle`, `quint`, `gumgum`,
  `signet`, `grimaldi_face` (if used), `apollon`, `bautista`, `burgundy`, `quill` (elderly
  skyfowl on a perch), `featherfall` (mummified corpse), `remex`, `hekla`, `ripper`, `manasa`,
  `tucker`, `dnadia`, `zev`, `odette`, `lucia`, `eunice`, `ricky_joe`, `ai_screen` (keep).
- Enemies: every id in 6.4 (`_walk(2) _attack _hurt`), `krasue` (head trailing organs).
- Bosses: `heather` (8-ft black bear, flaming skull face, roller skates), `dispenser` (huge manta,
  drawn in pieces: `dispenser_body`, `dispenser_eye(2)`, `dispenser_mouth(2)`, `dispenser_wing`),
  `vincente`, `terror_big`, each `_idle(2) _walk(2) _attack _hurt _special`.
- Portraits 32x32 x3 frames for every name in 11.1.

## 13. Audio contract (audio.js)

Book 1's API stays. The synth gains expansion voices (two more pulse channels with 8 duty steps
and a sawtooth, like the Famicom expansion chips) and a low-rate sample voice (kick, snare, toms,
timpani, slap bass, orchestra stab, crowd cheer, "whoa"), mixed so music sounds as full and loud as
it did in our heads. SFX: book 1's set plus `plant detonate fuse fire_burst launch smoke_puff
fear clockwork teleport krasue_shriek urchin_roll psionic guard_alarm crime bell_day bell_night
applause laugh boo meter burst glass_crack countdown_tick skate_roll calliope_stab worm_squish
ticket_scratch drunk_hiccup`. Music (looping unless noted): `title intro village village_night
ruins ruins_night circus bigtop heather boss settlement market club show dark climb escape inn
cutscene sad results(jingle) gameover(jingle) lootbox(jingle) ending credits`. `circus` is a
calliope oom-pah polka played at half speed, creepy.

## 14. Story layout (content follows this; others build to support it)

Act 1, the circus (days 8-6): class pick (guide room) -> village (Mordecai's rules) -> `a1_lemurs`
(side: knife lemurs, Terror the Clown at the end; quest The Show Must Go On starts) -> the
Belly-Rubbed Pug (drunk Mordecai teleports in) -> `a1_bodies` (side: the three dead crawlers, loot,
spying on the circus) -> `a1_collapse` (drop: mortars bring the building down into the basement;
Signet waits, Carl breaks his own finger) -> `a1_lions` (boss-style arena, six Mold Lions) ->
cinema (knocked out 15 h, Donut in Water Lily, Mongo caged, Signet's story) -> `a1_solo` (side,
night, solo: free Mongo at `R`, follow Signet) -> `a1_heather` (chase into boss Heather; custard)
-> `a1_bigtop` (rooms: three rings, three tent poles, then Grimaldi's vine finale) -> cinema (the
deal with the producers via Zev, the cure, peace) -> `a1_barricade` (survival, night, Street
Urchins) -> dawn: circus gone, stairs in the park.
Act 2, the Medium Skyfowl Settlement (days 5-3): `ruins_e` -> `a2_dispenser` (facade boss; Boomy
Boy) -> settlement (rewards: freeballing, xistera, dynamite; Fang Caps) -> GumGum, the corpses,
quest The Sex Workers Who Fell from the Heavens -> Desperado Club + Pustule's market ->
`a2_mongo` (swap: Mongo bolts after the lure) -> `a2_alley` (side: GumGum dead, Krasue, Vincente
boss) -> admin district talk (Burgundy, Miss Quill) -> `a2_divider` (side, dark, night: elves,
berserkers, the Divider's corpse blows) -> `a2_danger_zone` (show) -> `a2_apito` (side: Wand
Bearers, the Ricky Joe gag, Mic Drop) -> `a2_alley_night` (side, night: Katia joins, Shadow Leaks,
Mongo grows).
Act 3, Quill's tower and the Glass (days 3-2): `a3_climb` (climb, night) -> `a3_plant` (plant:
three charges, decoys, Krasue; Carl becomes Magistrate) -> `a3_nest` (side, dark: Krasue nest,
Featherfall, Burgundy) -> `a3_depot` (plant: ten charges in the guard depot, Katia gets the
detonator) -> cinema (Remex, The Final War) -> `a3_escape` (escape: The Fools Who Broke the Glass,
Carl's Doomsday Scenario, four bursts, the eastern stairwell) -> epilogue cinema (Odette's green
room) -> credits.
Optional side levels (loot, xp, gags): `x_temple` (a "corrupt temple" in the ruins), `x_restroom`
(a ruins restroom, the floor still has them), `x_park` (overgrown park at night).
Early ending: taking the circus-park stairs before the finale (confirm) ends the game with the
Early Bird Gets to Squirm achievement and a short "you missed the best part" ending.

## 15. Testing

Each owner verifies their module boots without console errors (Playwright + Chromium are
installed; see `tools/`). The lead's `tools/flow_test.js` drives a full run with debug clears.
URL params (debug): `?debug&level=<id>`, `?debug&area=<id>`, `?debug&cinema=<id>`,
`?debug&scene=title|classPick|inn|club|map|ending`, `&night` forces night, `&flags=a,b,c`.

## 16. Playtest round 1: catch up with Book One, then pass it (binding)

The owner played Book Two after Book One and reported: it feels *behind* Book One, not more
advanced; it feels like the same game but in some ways not as good; and it is far less edgy than
it should be. Adult game, adult book, adult players. The diagnosis:

- Book Two was forked from the old prototype (`../crawler/`), so none of Book One's playtest work
  is here: calm camera, pits-are-death with saved checkpoints, plot armor, mob scaling, full-health
  boss phases, the off-screen boss arrow, mob introductions, Donut's gripes, UP arrows on things you
  can use, the once-per-crawl special card, the jump-reach rules.
- The crawler gets *weaker* walking into Book Two. Book One's level 6 Carl has 25 HP; Book Two's
  level 13 Carl has 16 HP and punches for 3. Book One's gear (trollskin shirt, war gauntlet,
  BigBoi boxers, the crown...) is thrown away on import even though Book Two's art shows Carl
  wearing it. There is no gear screen.
- The script has zero "fuck", zero "shit", zero "goddamn" in it. The book swears on every page.
- The title still says DUNGEON CRAWLER WORLD (the prototype's name). The series is Dungeon Crawler
  Carl: the hub says so, Book One says so.
- Floor 3's backgrounds sit at the same brightness and hue as the floor and the mobs (red lemurs on
  red ruins). Book One fixed exactly this on its Floor 2.

### 16.1 Continuous crawler (game.js)

One crawler across the series. Numbers only ever go up.
- **Formulas are Book One's, continued** (absolute level, no `L = level - 12` for these):
  `maxHp = 10 + (con-3)*2 + (level-1) + bonus.hp + gear.hp + skin.hp`
  `dmg = 2 + (str-3) + floor((level-1)/2) + gear.dmg + skin.dmg` (+ gear stat perks `str` etc. count as stats)
  `kickDmg = round(dmg*1.5) + gear.kick`, then x2 with `freeballing`
  `crit = 0.04 + (dex-3)*0.02 + gear.crit + skin.crit` (cap 0.6); `speedMul = (1 + (dex-3)*0.03) * skin * (1 + gear.speed)`
  `def = gear.def + skin.def`, plus Book One's `stompMul regen stun missileDmg missileCd specialMul`.
  Explosives, Donut's missile and Mongo's bite keep the ratio to punch damage they have today
  (e.g. hob ~1.6x punch, dynamite ~3.2x, jug ~1.3x plus fire ticks of ~15% punch).
  XP curve stays Book Two's (`xpNeed` from `level - lvBase`), so the book's 13 -> 27 pace holds.
- **Fresh crawl** (no Book One carry): level 13, stats `str 7 con 6 dex 5 int 6`, `bonus.hp 2`, and
  Book One's full end-of-book gear: `trollskin_shirt nightgaunt_cloak toad_cudgel toe_ring
  war_gauntlet bigboi_boxers pedicure_kit` (Carl) and `crown_sepsis talisman_butterfly fae_crupper
  fur_brush` (Donut). Read it from `D.start` when present (content), these values as the fallback.
- **Carried crawl**: Book One's snapshot as it is: level, stats, unspent points, `bonus.hp` (as is),
  gold, potions, bombs -> hob-lobbers, views, kills, boxes, name, skin, and **`run.gear`**. If the
  snapshot has no gear (older saves), give the fresh-crawl gear set. Book One's flag `jugs` is
  already implied on Floor 3.
- **Gear system** as Book One: `run.gear {id:true}`; `G.giveGear(id, from) -> bool` (toast "GOT",
  `track('gear')`), `G.hasGear(id)`, `G.gearList() -> [{id, def}]` (Carl's first, then Donut's,
  then Mongo's), gear perks summed in `playerStats()`. `def.skin` switches Carl's outfit when gained
  (as Book One). New gives entry `{gear: 'id'}` works in level `gives`, event `gives` and cinema
  `give` lists. Perk keys: Book One's (`hp dmg kick stomp def crit speed regen missile missileCd
  special stun bombs`) plus `str con dex int` (flat stat bonus) and `bite` (Mongo).
- **Balance hook**: `D.balance = { mobHp, mobDmg, bossHp, bossDmg, mobXp }` multipliers, applied on
  top of `D.enemyFor` (mobs, elites, enemy shots) and boss setup. Defaults 1 if missing. The lead
  tunes them by measurement so that, at the expected level for each act, regular mobs take 3-5
  punches and Carl goes down in 6-8 hits (a step harder than Book One's Floor 2: 3-4 and 7-9).

### 16.2 Book One systems to port (stage.js, engine.js, game.js)

Port each from `../crawler-book1/js/` and its DESIGN.md sections of the same names; adapt to
Book Two's modes (streets, climb, drop, chase, survival, plant, escape, facade, swap, rooms).
- **Calm camera.** Look-ahead (32 px) builds only after 0.35 s of running one way, at 60 px/s;
  dead zone 20 px (56 px in locked arenas); the follow target is clamped before easing; locked
  arenas never track the boss; parallax rates 1/4 and 1/2. Vertical modes get the same calm on Y.
  Autoscroll (chase, survival) is exempt. Port `tools/cam_test.js` too: idle and turn must be 0 in arenas.
- **Off-screen boss arrow.** When the boss is off screen in an arena, a white arrow blinks at that
  edge, level with it.
- **Pits are death** on foot, on every mode (god mode keeps the old drop-back). Every death sets
  `run.hp = 0` so continuing lands on the death screen.
- **Checkpoint flags are saved to the run** (`run.checkpoint`). A revival rebuilds the same seeded
  level and starts Carl at the last flag. Clears on level clear, entering another level, or fleeing.
  Climb and drop layouts need a `c` at least every two screens (content).
- **Plot armor.** The first death of every crawl is free: back to the last flag, full HP, no
  revival spent, no gold or hours lost. Lines from `D.plotArmor` (`first` once per save, `again`
  on later crawls, plus a Donut line). Every later death goes to the death screen.
- **Boss phases are full health bars.** Each phase is its own full bar; when one empties and
  another is left, the boss enters it at full health with the phase banner and a "FULL HEALTH!"
  pop. `D.bosses[id].hp` is per bar (content sets it so the whole fight is ~1.5x today's length,
  before `D.balance.bossHp`).
- **Mob introductions.** The System AI reads a mob's `flavor` when the first one of that kind dies
  (once per crawl, never in a boss fight), queued so it never stacks on other dialog.
- **Donut's gripes.** `D.donutGripes` maps a mob id (or one `_`-separated part of it) or a damage
  kind (`fire spikes bomb wet fall dark psionic`) to a line. When one hurts the player, Donut says it
  in a pink toast; each once per crawl (`run.gripes`), at most one per 20 s, only while she is in the
  party and awake. Enemy shots remember their shooter, so the death screen names the shooter.
- **UP arrows.** A blinking NES UP arrow over anything you can use when you stand at it: doors,
  NPCs, signs, signposts, charge spots, decoy spots, cages, levers.
- **Special name card once per crawl** (`run.specialsSeen`); after that the name pops over Carl.
  No full-screen white flash.
- **Jump reach rules.** Port `tools/reach_test.js` (exact physics + `COMFORT=1`). Every non-arena
  chunk and every climb/drop layout must pass both. Report failures to the lead.
- **Test hook** `DCW.testHold = {right:1, jump:1}` in engine.js (holds logical buttons).
- **Gore.** The book is gory. On a kill: a burst of red blood pixels with the sprite-colored gibs,
  and a blood splat decal (art `blood_splat`, 3 variants) left on the floor under the kill for
  ~20 s (cap ~24, oldest goes first). Bigger bursts for stomps, explosions and bosses. Ghost-class
  mobs (`magicOnly`) and urchins leave smoke or straw instead of blood. A setting `GORE: ON/OFF`
  (default ON) in `save.settings.gore`.

### 16.3 UI (ui.js)

- **Title**: Book One's cartridge layout. Logo DUNGEON CRAWLER (small) over CARL (big), a ribbon
  BOOK TWO, and CARL'S DOOMSDAY SCENARIO under it. Keep Book Two's circus night backdrop, Carl,
  Donut and Mongo, and the AI screen. "A FAN GAME. NOT FOR SALE." small.
- **Gear screen** (Book One's `openGear`, adapted): Carl's gear, then Donut's, then Mongo's, perk
  summary, scrollable description, outfit switch row. On SELECT in levels and inns, and GEAR in the
  pause menu and the inn menu. Keep MAP reachable from the pause menu and from SELECT on streets.
- Boss bar shows the phase count (pips) and refills on a new phase.
- Death screen names the shooter (`result.cause` from the mob name).
- Settings: GORE ON/OFF.

### 16.4 Tone (data.js, binding for all player-facing text)

Section 0 already says adult. The first pass came out PG-13 anyway. This pass fixes it.
- **Swear like the book.** Fuck, shit, goddamn, asshole, bitch, bastard, dick, cock, tits, piss,
  son of a bitch, motherfucker. Not every line, but the cast talks like stressed adults in a death
  game. Carl swears when scared, hurt or furious ("Goddamnit, Donut."). Mordecai swears like the
  bitter drunk he is. The System AI is a gleeful, filthy game-show host. Donut is prim and grand,
  so when she does swear it lands.
- **Adult humor, adult targets.** Mordecai is now an incubus: people throw themselves at him and he
  hates it. Carl is freeballing in magic boxers on galactic TV. The System AI's thing for Carl's
  feet (Book One's running joke) continues. The Desperado Club is a seedy Vegas-strip nightclub.
  Signet wears a thong and nothing else and Carl very deliberately keeps his eyes up. Sex jokes
  are fine between adults.
- **Gore and cruelty played the book's way.** Kills, mob flavors and achievements can be graphic.
  The Syndicate is monstrous and the AI loves it.
- **Hard limits.** No slurs. Nothing sexual involving anyone under 18 (Lucia Mar is about 13; the
  Apito Education Center kids; any child). The murdered women of "The Sex Workers Who Fell from the
  Heavens" are never the punchline: the jokes land on Quill, the 201st and the Syndicate. No jokes
  about sexual violence. Nothing sexual about real people.
- **Running gags** from Book One continue: "X? CARL. YOU KNOW HOW I FEEL ABOUT X." (Donut), Carl's
  feet and the AI, Mordecai's tired contempt for "the worst crawlers I've ever had".
- Original writing (no copied sentences), the book's names, no em dashes, no boss weak spots
  spoiled before the player finds them (unless the story itself shows it in a cutscene).

### 16.5 Art

- **Readable playfield** (Book One rule): every background darker than, or a different hue from,
  anything the player stands on or fights. Check every theme, day and night, with its mobs on
  screen. Darken the wall, not the sprite.
- **Signet steps up (owner's call).** Her charm gives Carl an erection in the book, so she has to
  read as a topless woman at a glance: bare breasts with nipples on her sprite and in a close-up
  framed horns-to-waist, tattoos crawling over her skin, the thong the only thing she wears. Plain
  NES pixel art, no genitals, no sexual acts. Carl's reaction stays the comic tent in his
  heart-print BigBoi boxers (clothed). The charm scene's writing matches: she knows what she's
  doing, Carl swears and fights his own body on galactic TV, the AI is filthy about it, Donut is
  appalled, and he breaks his own finger to snap out of it.
- 8x8 icons for every gear id (Book One's set plus the new Floor 3 gear), `blood_splat` (3
  variants, ~16x4, NES reds), `blood` (2x2 droplet).

### 16.6 Owners for this round

| File | Owner |
|---|---|
| `js/stage.js`, `js/engine.js`, `js/game.js`, `js/rooms.js`, `js/show.js`, new `tools/*` | gameplay |
| `js/ui.js` | ui |
| `js/data.js` | content |
| `js/art.js`, `js/art_actors.js` | art |
| `DESIGN.md`, `index.html`, integration, balance numbers in `D.balance`, chunk fixes from reach_test | lead |

Same rules as before: edit only your files, `node --check` after every batch, no git commands that
change state, code defensively against modules still in progress, Playwright screenshots of your
work under the scratchpad, report anything you need from another module.

### 16.7 Integration notes (lead, after round 1)
- **Balance** is measured, not guessed: `node tools/balance_report.js [regex] [--json]` loads every
  side-view level at its act's debug level and prints punches-to-kill and hits-to-die. `D.balance`
  now carries per-act multipliers (`acts: [{}, {...}, {...}]`, applied by `G.bal`) because Carl's
  punch grows slower (15 / 18 / 21 at levels 13 / 18 / 22) than the act scaling the mobs were first
  tuned against. Result: mobs 4 / 5 / 5 punches (median), Carl down in 8 / 8 / 7 hits, Terror 36
  punches, Heather 78, the Dispenser 80, Vincente 85 (all bars). Berserkers are the tanks (7-8
  punches in the light, more in the dark).
- **Explosives keep their punch.** The example ratios first written in 16.1 were half of what the
  game had. `G.ratios`: hob 3.4x a punch, dynamite 6.5x, jug 3.2x plus fire ticks of 0.33x.
- **Import catch-up.** A Book One crawler below Floor 3's level 13 is raised to 13 on arrival, with
  the stat points for every level gained (unspent, for the first inn) and a CATCH-UP toast. Stats,
  gear and everything else carry as they were.
- **Heather's custard** drops when her last bar starts. Grabbing it cuts her to a fifth of a bar, a
  quick mercy kill, because in the book she is dying anyway.
- **Phase banners** read `name`, `sub` and `line` (or `lines`). The System AI's foot gag
  (`D.ai.carlFeet`) plays on some stomps, at most one per 40 s.
- **Tests:** `stage_test` 142, `gameplay_check` 21, `flow_test` to WIN, `reach_test` 0 problems in
  both modes, `cam_test` 0 idle/turn moves in arenas, `rooms_test`, `show_test`, `stage_smoke`,
  `data_validate`, `actors_validate` all clean. The street crime test in `stage_test` still fails
  about 1 run in 6 for a reason not yet found; it now prints diagnostics when it does.
- **Palette caveat (art):** Book Two's backgrounds and tiles were never snapped to the strict 2C02
  table the way Book One's are. New art (Signet, icons, gore, krasue body) uses table colors only.
- **Book One bug seen while porting** (not fixed, Book One is the owner's baseline): its gear
  `special` perks sum to 25 and `specialMul` uses them as a multiplier, so the special meter fills
  about 26x faster than intended.

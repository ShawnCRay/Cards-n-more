# DUNGEON CRAWLER WORLD: EARTH - design + module contract

A personal fan game. 8-bit (NES-era, Code Monkeys-style chunky pixel art) side-scrolling
brawler-platformer set on a fan version of Dungeon Crawler World, Earth edition. You play
Carl (boxers, leather jacket, bare feet, kicks things) with Princess Donut riding along.
Floors follow the in-universe floors loosely. Floors 1-2 are linear stage sequences.
From Floor 3 on, each floor has a top-down OVERWORLD (like the NES TMNT game: you walk
around a map and drop into side-scrolling areas through doors, manholes, tents, etc.).
Loot boxes unlock skins and companions permanently.

Tone: the System AI is a snarky, gleeful game-show announcer. Achievements have rude,
funny descriptions. Keep it PG-13: cheeky, not crude. All text is original writing,
never quoted from the books.

No build step. Classic `<script>` files (NOT ES modules, the game must work from
`file://`). Each file is an IIFE that attaches to `window.DCW`. Load order:
`engine.js, data.js, art_actors.js, art.js, audio.js, ui.js, stage.js, overworld.js, game.js`.
Nothing may run game logic at load time except defining things; `DCW.boot()` calls each
module's `init()` in the order art, audio, ui, stage, overworld, game.

No external network requests of any kind (no CDNs, no fonts, no images). All art is drawn
from code. All audio is synthesized with WebAudio.

## Files and owners

| File | Owner | What |
|---|---|---|
| `index.html` | lead | shell, canvas, touch overlay, script tags |
| `js/engine.js` | lead | loop, input, font, scenes, fade/shake/hitstop, save, utils |
| `js/game.js` | lead | run flow, progression, rewards, loot box rolling, achievements, unlocks |
| `js/art.js` | art-core | art API + rasterizer, tiles, backgrounds, overworld tiles, fx, projectiles, pickups, objects, markers, icons |
| `js/art_actors.js` | art-actors | pixel data for Carl (+skins), companions, enemies, bosses, NPCs, portraits |
| `js/audio.js` | audio | chiptune SFX + music |
| `js/data.js` | content | floors, stages, chunks, overworld maps, enemies, bosses, loot, skins, companions, achievements, all story/AI text |
| `js/stage.js` | gameplay | the side-scrolling stage scene: physics, player, companion, enemies, bosses, pickups, particles |
| `js/ui.js` | ui | HUD, dialog, toasts, menus, pause, title, intro, floor card, results, death, safe room, loot box opening, wardrobe, character, achievements, settings, ending |
| `js/overworld.js` | ui | the top-down overworld scene |

Do not edit files you do not own. If you need something from another module that the
contract below does not give you, code defensively (feature-detect, fall back) and list
the request in your final report.

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

## Floor plan (content follows this; art/audio provide matching themes)

| Floor | Name idea | Layout | Side-scroll themes | Enemies | Boss | Boss unlock |
|---|---|---|---|---|---|---|
| 1 | The First Floor (tutorial; sewers stand in for the books' torchlit tunnels) | linear: 2 stages, safe room, boss | sewer | rat roach goblin bat | hoarder | companion `squeaks` |
| 2 | The Second Floor (last training level; goblin tunnels) | linear: 3 stages, safe room, boss | cave | goblin goblin_archer goblin_brute grub shaman bat juicer_minion | juicer | companion `mongo` |
| 3 | The over city (FIRST OVERWORLD) | overworld `ow_city` | city circus swamp | clown clown_brute skyfowl swamp_troll gator rat | ringmaster | skin `carl_clown` |
| 4 | The Iron Tangle | overworld `ow_rail` | train city | steam_goblin conductor rail_rat bat | engineer | companion `katia` |
| 5 | The Bubbles (one bubble's sea quadrant) | overworld `ow_reef` | bubble swamp | fishman jelly crab gator | tidemother | skin `carl_hazmat` |
| 6 | The hunting grounds | overworld `ow_woods` | forest | hunter hound masked_noble skyfowl | butcher | companion `zev` |
| 7 | The bedlam manor | overworld `ow_manor` | castle | ghoul gargoyle skeleton bat | bride | skin `carl_bodyguard` |
| 8 | The ghosts of Earth (a replica West Virginia river town on December 10th; ghost townsfolk, Appalachian folklore) | overworld `ow_town` | ghosttown ghostmine | wampus_cat mountain_light woodbooger sheepsquatch mothling | mothman | skin `carl_kilt` |
| 9 | Faction wars (finale) | overworld `ow_war` | warzone | soldier sniper war_beast cultist + mix | showrunner | skin `carl_gold`, game won |

Other skins (`carl_jacket`, `carl_pajamas`, `carl_toga`) come from loot boxes and achievements.
Safe rooms use theme `safe`. Overworld floors: 3-4 main areas + 1-2 optional side areas +
safe room + boss + stairwell, roughly 40-60 tiles wide and 24-36 tall.

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

### Floor 11 - THE PARADE
- `floor.overworld.theme: 'ow_parade'` (parade staging grounds: half-built floats, bleachers, tents, a
  route banner). Areas `1-4` on foot, each holds one float part (quest item with a `float` field:
  `'confetti' | 'spotlight' | 'balloons' | 'banner'`), `S` safe room, `B` the parade itself, locked by
  `floor.locks.B = { needs: ['part1','part2','part3','part4'] }` (array = all required). No stairs: the parade is the finale.
- Parade stage: `kind: 'parade'`, theme `parade`, boss `grand_marshal`, `parade: { speed: 34, waves: [['enemy id', weight], ...] }`.
  The camera autoscrolls; Carl fights on top of the float. Chunks are street (flat ground row 10-11, crowd
  barriers, a few `=` for hecklers), ending in the boss arena chunk (`K`).
- New final boss `grand_marshal` (original design: a towering alien parade grand marshal on a throne float,
  sash, giant baton, confetti, multiple phases incl. summoning balloon minions). Floor 9's showrunner stays as the Floor 9 boss.

### New art (art agent)
- `truck` (~48x28, side view food truck, 2 frames wheel spin, Donut visible in the window) + `truck_hurt`;
  float overlays drawn on top of the truck at the same anchor: `float_confetti float_spotlight float_balloons float_banner`
  (each its own decoration so any combination stacks) and `float_base` (bunting skirt for the parade).
- Rival vehicles/mounts `racer_<id>` (2 frames, 40-56 wide) for each racer id the content agent defines
  (art agent gets the list; ids: `goblin_bike skull_chariot beetle_mount steam_buggy champion`).
- Portraits `p_racer_<id>` for each; `p_grand_marshal`; boss sprites `grand_marshal_idle(2) _walk(2) _attack _hurt _special`
  (~64x64), `p_champion` alias ok.
- Tiles/backgrounds for themes `raceway` (asphalt track with curbs, barriers, grandstands + crowd + flags
  background, fast parallax) and `parade` (street with crowd barriers, confetti, buildings with bunting).
- Objects: `boost_pad(2)` 16x6, `jump_pad(2)` 16x8, `oil_slick` 16x4, `finish_line` (32x48 checkered arch),
  `mine` (8x6), `countdown` not needed (UI draws it).
- Overworld tiles for `ow_suburb` and `ow_parade`; markers `ow_garage` (race entrance), `ow_float` (parade entrance).
- Mordecai forms `mordecai_f10 mordecai_f11` + `p_mordecai_f10 p_mordecai_f11` (same method as existing forms).

### New audio (audio agent)
Tracks `floor10` (driving race theme), `ow10` (sunny suburban), `floor11` (parade march), `ow11` (festival),
SFX `engine` (short loopable rev), `boost`, `horn`, `countdown` (beep), `go` (higher beep), `skid`, `crash`.

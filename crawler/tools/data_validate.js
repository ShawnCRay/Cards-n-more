#!/usr/bin/env node
// Validates crawler/js/data.js against the DESIGN.md data contract.
// Usage: node crawler/tools/data_validate.js [--quiet]
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const DATA = path.resolve(__dirname, '../js/data.js');
const ctx = { window: {}, console };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(DATA, 'utf8'), ctx, { filename: 'data.js' });
const D = ctx.window.DCW && ctx.window.DCW.data;
const quiet = process.argv.includes('--quiet');

const errors = [], warns = [];
const err = (m) => errors.push(m);
const warn = (m) => warns.push(m);
if (!D) { console.log('DCW.data missing'); process.exit(1); }

/* ---------------- fixed lists from DESIGN.md ---------------- */
const THEMES = 'sewer cave city circus swamp train bubble forest castle ruin warzone safe raceway parade'.split(' ');
const OW_THEMES = 'ow_city ow_rail ow_reef ow_woods ow_manor ow_waste ow_war ow_suburb ow_parade'.split(' ');
const NFLOORS = 11;   // Update 3: floor 10 = the races, floor 11 = the parade (the finale)
const ENEMY_IDS = ('rat roach goblin goblin_archer goblin_brute bat grub shaman juicer_minion clown clown_brute ' +
  'skyfowl swamp_troll gator steam_goblin conductor rail_rat fishman jelly crab hunter hound masked_noble ghoul ' +
  'gargoyle skeleton mutant drone golem soldier sniper war_beast cultist').split(' ');
const BOSS_IDS = 'hoarder juicer ringmaster engineer tidemother butcher bride overseer showrunner grand_marshal'.split(' ');
// Update 3: racer ids are fixed (art draws racer_<id> + p_racer_<id>); champion is the boss racer
const RACER_IDS = 'goblin_bike skull_chariot beetle_mount steam_buggy champion'.split(' ');
const FLOAT_PARTS = 'confetti spotlight balloons banner'.split(' ');
const TRUCK_KEYS = 'hp speed accel mines'.split(' ');
const PROJ_SPRITES = 'arrow rock fireball bubble bolt bottle laser_orb knife spore note missile'.split(' ');
const REQ_PROJ = 'arrow rock fireball bubble bolt bottle laser_orb knife spore note'.split(' ');
const SKINS = 'carl_boxers carl_jacket carl_bodyguard carl_kilt carl_hazmat carl_pajamas carl_clown carl_toga carl_gold'.split(' ');
const COMPANIONS = 'donut mongo katia zev squeaks samantha signet'.split(' ');
const ABILITIES = 'missile bite shield magnet fetch lunge summon'.split(' ');
// Update 2: where each companion must be rescued (donut starts with you)
const COMP_FLOOR = { squeaks: 2, mongo: 3, samantha: 4, katia: 5, zev: 6, signet: 7 };
const QI_SPRITES = 'qi_key qi_valve qi_ticket qi_gear qi_shell qi_horn qi_mask qi_crown qi_badge qi_map qi_lens qi_bolt'.split(' ');
const AI_TYPES = 'walker chaser jumper flyer shooter charger turret spawner bomber hopper'.split(' ');
const TIERS = 'bronze silver gold platinum legendary fan boss'.split(' ');
const MUSIC = ('title intro floor1 floor2 floor3 floor4 floor5 floor6 floor7 floor8 floor9 floor10 floor11 ' +
  'ow3 ow4 ow5 ow6 ow7 ow8 ow9 ow10 ow11 boss boss_final safe results gameover ending lootbox').split(' ');
const MARKERS = 'ow_door ow_manhole ow_tent ow_cave ow_garage ow_float'.split(' ');
const PORTRAITS = ['p_carl', 'p_donut', 'p_mongo', 'p_katia', 'p_zev', 'p_squeaks', 'p_samantha', 'p_signet', 'p_ai', 'p_mordecai', 'p_bopca']
  .concat(BOSS_IDS.map(b => 'p_' + b)).concat(RACER_IDS.map(r => 'p_racer_' + r));
const EVENTS = ('kill stomp kick bomb_kill multi_bomb potion crate coin fall death revive box_open combo10 combo25 ' +
  'no_damage_stage skin_equip companion_equip shop flee secret win pet_donut quest_item ' +
  'race_win race_flawless float_part parade_done').split(' ');
const STATS = 'str con dex int'.split(' ');
const PERKS = 'dmg def hp speed gold views bombs doubleJump'.split(' ');

const CHUNK_CHARS = new Set('. #X=^~Hbohm?eEfPDK<>vcn$QRSLrZJOF'.split(''));
// Update 3 race legend: only in race_* chunks. r rival start, Z boost, J jump pad, O oil, F finish
const RACE_CHARS = new Set('rZJOF'.split(''));
const RACE_GROUND = new Set(['#', 'X', '=']);
const SOLID = new Set(['#', 'X', 'b']);
const SUPPORT = new Set(['#', 'X', 'b', '=', 'H']);
const HAZARD = new Set(['^', '~']);
const OW_CHARS = new Set('#.,=~TP123456789ABCDEFSX'.split(''));
const OW_BLOCK = new Set(['#', '~', 'T']);
const OW_WALK = new Set(['.', ',', '=', 'P']);
const ENT_RE = /^[1-9A-FSBX]$/;
const TEXT_RE = /^[A-Z0-9 .,!?'":;\-+/()%*#$<>=_&@\[\]~|]*$/;

/* ---------------- text checks ---------------- */
function text(where, s, max) {
  if (typeof s !== 'string') { err(where + ': not a string'); return; }
  if (!s.length) { err(where + ': empty text'); return; }
  // sign text may name the player's real buttons: {jump} {attack} {bomb} {potion} {special} {up} {down} {left} {right}
  const BTN_TOKEN = /\{(jump|attack|bomb|potion|special|up|down|left|right)\}/g;
  if (/\.signs\[/.test(where)) s = s.replace(BTN_TOKEN, 'X');
  if (!TEXT_RE.test(s)) {
    const bad = [...new Set(s.split('').filter(c => !TEXT_RE.test(c)))].join('');
    err(where + ': illegal chars [' + bad + '] in "' + s.slice(0, 50) + '"');
  }
  const lim = max || 140;
  if (s.length > lim) err(where + ': ' + s.length + ' chars > ' + lim + ': "' + s.slice(0, 40) + '..."');
}
function texts(where, arr, min, max) {
  if (!Array.isArray(arr)) { err(where + ': not an array'); return; }
  if (min && arr.length < min) err(where + ': only ' + arr.length + ' entries (want ' + min + '+)');
  arr.forEach((s, i) => text(where + '[' + i + ']', s, max));
}

/* ---------------- enemies / projectiles / bosses ---------------- */
for (const id of ENEMY_IDS) if (!D.enemies[id]) err('enemy missing: ' + id);
for (const [id, e] of Object.entries(D.enemies)) {
  const w = 'enemies.' + id;
  if (!ENEMY_IDS.includes(id)) err(w + ': id not in DESIGN enemy list (no art)');
  if (!ENEMY_IDS.includes(e.sprite)) err(w + ': sprite ' + e.sprite + ' not in art list');
  for (const k of ['hp', 'dmg', 'speed', 'w', 'h', 'xp']) if (typeof e[k] !== 'number') err(w + ': ' + k + ' not a number');
  if (!AI_TYPES.includes(e.ai)) err(w + ': bad ai ' + e.ai);
  if (!Array.isArray(e.gold) || e.gold.length !== 2) err(w + ': gold must be [min,max]');
  if (e.projectile && !D.projectiles[e.projectile]) err(w + ': projectile ' + e.projectile + ' missing');
  if ((e.ai === 'shooter' || e.ai === 'turret' || e.ai === 'bomber') && !e.projectile) err(w + ': ' + e.ai + ' without projectile');
  if (e.ai === 'spawner' && !D.enemies[e.spawn]) err(w + ': spawner spawn missing');
  if (e.ai === 'flyer' && !e.flying) warn(w + ': flyer without flying:true');
  text(w + '.name', e.name, 24); text(w + '.flavor', e.flavor);
}
for (const id of REQ_PROJ) if (!D.projectiles[id]) err('projectile missing: ' + id);
for (const [id, p] of Object.entries(D.projectiles)) {
  if (!PROJ_SPRITES.includes(p.sprite)) err('projectiles.' + id + ': sprite not in art list');
  for (const k of ['w', 'h', 'speed', 'dmg', 'gravity', 'life']) if (typeof p[k] !== 'number') err('projectiles.' + id + ': ' + k);
}
const PRIM = /^(walk|idle|hover):\d+(\.\d+)?$|^(charge|jump_slam|swoop|teleport|laser|shockwave|summon_spikes)$|^(shoot|spread|rain):[a-z_]+:\d+$|^spawn:[a-z_]+:\d+$/;
for (const id of BOSS_IDS) if (!D.bosses[id]) err('boss missing: ' + id);
for (const [id, b] of Object.entries(D.bosses)) {
  const w = 'bosses.' + id;
  if (!BOSS_IDS.includes(b.sprite)) err(w + ': sprite not in art list');
  text(w + '.name', b.name, 24); text(w + '.title', b.title, 32); texts(w + '.intro', b.intro, 1); text(w + '.defeat', b.defeat);
  if (!TIERS.includes(b.loot)) err(w + ': loot tier ' + b.loot);
  if (b.unlock) {
    if (b.unlock.skin && !SKINS.includes(b.unlock.skin)) err(w + ': unlock skin ' + b.unlock.skin);
    if (b.unlock.companion) err(w + ': companion unlock not allowed');
  }
  if (!b.phases || !b.phases.length || b.phases[0].below !== 1) err(w + ': first phase must have below 1.0');
  let last = 2;
  (b.phases || []).forEach((ph, i) => {
    if (!(ph.below < last)) err(w + '.phases[' + i + ']: below must decrease');
    last = ph.below;
    ph.pattern.forEach(mv => {
      if (!PRIM.test(mv)) { err(w + ': bad move "' + mv + '"'); return; }
      const p = mv.split(':');
      if ((p[0] === 'shoot' || p[0] === 'spread' || p[0] === 'rain') && !D.projectiles[p[1]]) err(w + ': move projectile ' + p[1] + ' missing');
      if (p[0] === 'spawn' && !D.enemies[p[1]]) err(w + ': spawn enemy ' + p[1] + ' missing');
      if (b.flying && /^(charge|jump_slam|shockwave)$/.test(mv)) warn(w + ': flying boss uses ground move ' + mv);
      if (!b.flying && /^(swoop|hover)/.test(mv)) warn(w + ': ground boss uses flyer move ' + mv);
    });
  });
}
if (!D.enemyFor || !D.enemyFor('bat', 7) || D.enemyFor('bat', 7).hp <= D.enemies.bat.hp) err('enemyFor helper broken');

/* ---------------- chunks ---------------- */
const chunkUse = {};
function cell(rows, x, y) { if (y < 0) return '.'; if (y >= rows.length || x < 0 || x >= rows[0].length) return null; return rows[y][x]; }
function isSolid(c) { return c !== null && SOLID.has(c); }

// approximate platformer reachability inside one chunk
function reach(id, rows0, starts, breakCrates) {
  const rows = breakCrates ? rows0.map(r => r.replace(/b/g, '.')) : rows0;
  const H = rows.length, W = rows[0].length;
  const sup = rows.map(r => r.split('').map(c => SUPPORT.has(c)));
  // virtual supports for moving platforms
  rows.forEach((r, y) => r.split('').forEach((c, x) => {
    if (c === '<' || c === '>') for (let dx = -4; dx <= 4; dx++) if (x + dx >= 0 && x + dx < W) sup[y][x + dx] = true;
    if (c === 'v') for (let dy = -3; dy <= 3; dy++) for (let dx = -1; dx <= 1; dx++) { const yy = y + dy, xx = x + dx; if (yy >= 0 && yy < H && xx >= 0 && xx < W && !isSolid(rows[yy][xx])) sup[yy][xx] = true; }
  }));
  const free = (x, y) => { const c = cell(rows, x, y); return c !== null && !isSolid(c); };
  const valid = (x, y) => x >= 0 && x < W && y >= 0 && y < H && free(x, y) && free(x, y - 1);
  const supported = (x, y) => rows[y][x] === 'H' || (y + 1 < H && sup[y + 1][x]);
  function fall(x, y) { // returns landing y or -1 (pit)
    while (y < H) { if (!valid(x, y)) return -2; if (supported(x, y)) return y; y++; }
    return -1;
  }
  const seen = new Set(), q = [];
  const push = (x, y) => { const k = x + ',' + y; if (!seen.has(k)) { seen.add(k); q.push([x, y]); } };
  starts.forEach(s => { const y = fall(s[0], s[1]); if (y >= 0) push(s[0], y); });
  while (q.length) {
    const [x, y] = q.shift();
    // walk / step off
    for (const dx of [-1, 1]) {
      const nx = x + dx;
      if (valid(nx, y)) { const ly = fall(nx, y); if (ly >= 0) push(nx, ly); }
      else if (valid(nx, y - 1) && supported(nx, y - 1)) push(nx, y - 1); // 1-tile step
    }
    // ladders
    if (rows[y][x] === 'H' && valid(x, y - 1)) push(x, y - 1);
    if (y + 1 < H && rows[y + 1][x] === 'H' && valid(x, y + 1)) push(x, y + 1);
    // drop through one-way
    if (y + 1 < H && rows[y + 1][x] === '=') { const ly = fall(x, y + 2); if (ly >= 0 && valid(x, y + 2)) push(x, ly); }
    // jumps
    for (let tx = Math.max(0, x - 5); tx <= Math.min(W - 1, x + 5); tx++) {
      for (let ty = Math.max(0, y - 3); ty <= Math.min(H - 1, y + 4); ty++) {
        const dx = Math.abs(tx - x), up = y - ty;
        if (dx > (up > 1 ? 4 : 5)) continue;
        if (!valid(tx, ty)) continue;
        const apex = Math.min(y, ty);
        let ok = true;
        for (let yy = apex - 1; yy <= y && ok; yy++) if (!free(x, yy)) ok = false;        // rise
        const s = Math.sign(tx - x);
        for (let xx = x; xx !== tx + s && ok; xx += (s || 1)) { if (!free(xx, apex) || !free(xx, apex - 1)) ok = false; if (!s) break; } // across
        for (let yy = apex - 1; yy <= ty && ok; yy++) if (!free(tx, yy)) ok = false;      // descend
        if (!ok) continue;
        const ly = fall(tx, ty); if (ly >= 0) push(tx, ly);
      }
    }
  }
  return seen;
}

// Update 3: food truck reachability in a race chunk. The truck (36x18 px) needs 2 free rows,
// rams crates, cannot climb ladders or 1-tile steps. Plain (held) jump: up <= 3 rows, across
// <= 6 (<= 4 when rising 2+). From a J pad: up <= 3, across <= 7 (a pad launch is shortened
// when jump is not held, so plan for the short arc). Supports: # X = (one-way).
function raceReach(rows0, starts) {
  const rows = rows0.map(r => r.replace(/b/g, '.'));
  const H = rows.length, W = rows[0].length;
  const free = (x, y) => { const c = cell(rows, x, y); return c !== null && !isSolid(c); };
  const valid = (x, y) => x >= 0 && x < W && y >= 0 && y < H && free(x, y) && free(x, y - 1);
  const supported = (x, y) => y + 1 < H && RACE_GROUND.has(rows[y + 1][x]);
  function fall(x, y) { while (y < H) { if (!valid(x, y)) return -2; if (supported(x, y)) return y; y++; } return -1; }
  const seen = new Set(), q = [];
  const push = (x, y) => { const k = x + ',' + y; if (!seen.has(k)) { seen.add(k); q.push([x, y]); } };
  starts.forEach(s => { const y = fall(s[0], s[1]); if (y >= 0) push(s[0], y); });
  while (q.length) {
    const [x, y] = q.shift();
    for (const dx of [-1, 1]) { const nx = x + dx; if (valid(nx, y)) { const ly = fall(nx, y); if (ly >= 0) push(nx, ly); } }
    const pad = rows[y][x] === 'J', maxUp = 3, reachX = pad ? 7 : 6;
    for (let tx = Math.max(0, x - reachX); tx <= Math.min(W - 1, x + reachX); tx++) {
      for (let ty = Math.max(0, y - maxUp); ty <= Math.min(H - 1, y + 4); ty++) {
        const dx = Math.abs(tx - x), up = y - ty;
        // climbing 3 rows (onto an overpass) only works close in: the arc peaks ~3 tiles out
        if (dx > (up >= 3 ? 3 : up === 2 ? 4 : pad ? 7 : 6)) continue;
        if (!valid(tx, ty)) continue;
        const apex = Math.min(y, ty) - (pad ? 1 : 0);
        let ok = true;
        for (let yy = apex - 1; yy <= y && ok; yy++) if (!free(x, yy)) ok = false;
        const sg = Math.sign(tx - x);
        for (let xx = x; xx !== tx + sg && ok; xx += (sg || 1)) { if (!free(xx, apex) || !free(xx, apex - 1)) ok = false; if (!sg) break; }
        for (let yy = apex - 1; yy <= ty && ok; yy++) if (!free(tx, yy)) ok = false;
        if (!ok) continue;
        const ly = fall(tx, ty); if (ly >= 0) push(tx, ly);
      }
    }
  }
  return seen;
}

for (const [id, ch] of Object.entries(D.chunks)) {
  const w = 'chunks.' + id, rows = ch.rows;
  chunkUse[id] = 0;
  if (!Array.isArray(rows) || rows.length !== 12) { err(w + ': must have 12 rows'); continue; }
  const W = rows[0].length;
  if (W < 16 || W > 48) err(w + ': width ' + W + ' outside 16-48');
  let bad = false;
  rows.forEach((r, y) => {
    if (r.length !== W) { err(w + ': row ' + y + ' width ' + r.length + ' != ' + W); bad = true; }
    for (const c of r) if (!CHUNK_CHARS.has(c)) err(w + ': illegal char "' + c + '" row ' + y);
  });
  if (bad) continue;
  const isArena = rows.some(r => r.includes('K'));
  // Update 3: race chunks (race_*) are the only ones with r Z J O F
  const isRace = ch._race = /^race_/.test(id);
  ch._parade = /^parade_/.test(id);
  if (!isRace) rows.forEach((r, y) => { for (const c of r) if (RACE_CHARS.has(c)) err(w + ': race char "' + c + '" outside a race_ chunk (row ' + y + ')'); });
  if (isRace) {
    rows.forEach((r, y) => r.split('').forEach((c, x) => {
      if (RACE_CHARS.has(c) && !RACE_GROUND.has(cell(rows, x, y + 1) || '')) err(w + ': "' + c + '" at ' + x + ',' + y + ' must sit right above ground (# X =)');
      if (c === '=' && y !== 7 && y !== 10) err(w + ': overpass "=" at row ' + y + ' (overpasses sit at row 7: a short pad launch reaches it and 2 rows stay free below; bridges at row 10)');
      if ('DKSLRHv<>'.includes(c)) err(w + ': "' + c + '" does not belong in a race chunk');
    }));
    // gaps in the road: <= 4 plain, 5 needs a J pad right at the edge (2 tiles), never wider than 5
    for (let x = 0; x < W;) {
      if (RACE_GROUND.has(rows[10][x])) { x++; continue; }
      let x1 = x; while (x1 < W && !RACE_GROUND.has(rows[10][x1])) x1++;
      const gw = x1 - x;
      let pad = false; for (let k = Math.max(0, x - 2); k < x; k++) if (rows[9][k] === 'J') pad = true;
      if (gw > 5) err(w + ': road gap of ' + gw + ' tiles at col ' + x + ' (max 5)');
      else if (gw >= 5 && !pad) err(w + ': ' + gw + ' tile road gap at col ' + x + ' needs a J pad right at its edge (2 tiles before)');
      // a spin-out lasts 0.8 s (no jumping) and slides ~6-8 tiles: keep oil well clear of gaps
      for (let k = Math.max(0, x - 9); k < x; k++) if (rows[9][k] === 'O') err(w + ': oil slick at col ' + k + ' is within 9 tiles of the gap at col ' + x + ' (a spin-out cannot jump)');
      x = x1;
    }
  }
  for (const x of [0, W - 1]) {
    if (rows[10][x] !== '#' || rows[11][x] !== '#') err(w + ': edge col ' + x + ' rows 10-11 must be #');
    if (isArena && x === W - 1) continue;
    for (let y = 5; y <= 9; y++) { const c = rows[y][x]; if (SOLID.has(c) || HAZARD.has(c) || c === 'L') err(w + ': edge col ' + x + ' row ' + y + ' blocked "' + c + '"'); }
  }
  // gates: L is solid while closed, empty once its lever is pulled
  const closedRows = rows.map(r => r.replace(/L/g, 'X')), openRows = rows.map(r => r.replace(/L/g, '.'));
  // standing things need ground and headroom
  rows.forEach((r, y) => r.split('').forEach((c, x) => {
    if ('eEPDKcn$?SR'.includes(c)) {
      const below = cell(rows, x, y + 1);
      if (!below || !SUPPORT.has(below)) err(w + ': "' + c + '" at ' + x + ',' + y + ' has no ground below');
    }
    if ('eEPDKR'.includes(c) && (isSolid(cell(rows, x, y - 1)) || cell(rows, x, y - 1) === 'L')) err(w + ': "' + c + '" at ' + x + ',' + y + ' has no headroom');
    if (c === 'Q') { // floats on/above walkable ground (within 3 tiles)
      let ok = false;
      for (let dy = 1; dy <= 3 && !ok; dy++) { const b = cell(rows, x, y + dy); if (b && SUPPORT.has(b)) ok = true; else if (!b || isSolid(b) || b === 'L' || HAZARD.has(b)) break; }
      if (!ok) err(w + ': "Q" at ' + x + ',' + y + ' not on/above walkable ground');
    }
    if (c === '<' || c === '>') for (let dx = -3; dx <= 3; dx++) { const cc = cell(openRows, x + dx, y); if (cc === null || isSolid(cc)) err(w + ': moving platform at ' + x + ',' + y + ' blocked'); }
    if (c === 'v') for (let dy = -3; dy <= 3; dy++) { const cc = cell(openRows, x, y + dy); if (cc === null || isSolid(cc)) err(w + ': v platform at ' + x + ',' + y + ' blocked at dy ' + dy); }
  }));
  const count = (c) => rows.join('').split(c).length - 1;
  ch._P = count('P'); ch._D = count('D'); ch._K = count('K'); ch._n = count('n'); ch._q = count('?');
  ch._e = count('e') + count('E'); ch._Q = count('Q'); ch._R = count('R'); ch._S = count('S'); ch._L = count('L');
  ch._r = count('r'); ch._F = count('F');
  // reachability: from left edge (or P) to right edge, plus targets
  const starts = ch._P ? [] : [[0, 9], [1, 9]];
  rows.forEach((r, y) => { const x = r.indexOf('P'); if (x >= 0) starts.push([x, y]); });
  // pass 1: as built; pass 2: crates broken (punch/kick/bomb) - targets may need that. Gates open (lever pulled).
  const seen0 = isRace ? raceReach(openRows, starts) : reach(id, openRows, starts, false);
  const seen = isRace ? seen0 : reach(id, openRows, starts, true);
  const near = (S, x, y, up) => { for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= (up || 1); dy++) if (S.has((x + dx) + ',' + (y + dy))) return true; return false; };
  const right = (S) => [...S].some(k => +k.split(',')[0] === W - 1);
  if (!isArena && !right(seen)) err(w + ': right edge not reachable from left edge');
  else if (!isArena && !right(seen0) && !quiet) warn(w + ': right edge needs crates broken');
  ch._reach = seen0.size;
  rows.forEach((r, y) => r.split('').forEach((c, x) => {
    if ('?D$KR'.includes(c) && !near(seen, x, y)) err(w + ': "' + c + '" at ' + x + ',' + y + ' not reachable');
    if (c === 'Q' && !near(seen, x, y, 2)) err(w + ': "Q" at ' + x + ',' + y + ' not reachable');
  }));
  // lever puzzles: every L needs an S reachable from the left edge without passing any L
  if (ch._L && !ch._S) err(w + ': has L gate tiles but no S lever');
  if (ch._S && !ch._L) warn(w + ': lever S without any L gate');
  if (ch._L && ch._S) {
    const shut = reach(id, closedRows, starts, true);
    let lever = false;
    rows.forEach((r, y) => r.split('').forEach((c, x) => { if (c === 'S' && near(shut, x, y)) lever = true; }));
    if (!lever) err(w + ': no S lever reachable from the left edge without crossing L');
    // the gate should guard something: the way forward, a Q, an R or loot
    let guards = !isArena && right(seen) && !right(shut);
    rows.forEach((r, y) => r.split('').forEach((c, x) => {
      if ('QR?$ohm'.includes(c) && near(seen, x, y, c === 'Q' ? 2 : 1) && !near(shut, x, y, c === 'Q' ? 2 : 1)) guards = true;
    }));
    if (!guards) warn(w + ': gate L guards nothing (route, Q, R and loot all reachable with it shut)');
  }
}

/* ---------------- stages ---------------- */
const KINDS = ['main', 'side', 'boss', 'ambush', 'race', 'parade'];
function weighted(w, list, what) {
  if (!Array.isArray(list) || !list.length) { err(w + ': ' + what + ' empty'); return; }
  list.forEach(e => { if (!Array.isArray(e) || !D.enemies[e[0]] || !(e[1] > 0)) err(w + ': bad ' + what + ' entry ' + JSON.stringify(e)); });
}
for (const [id, s] of Object.entries(D.stages)) {
  const w = 'stages.' + id;
  if (s.id !== id) err(w + ': id mismatch');
  text(w + '.name', s.name, 24);
  if (!THEMES.includes(s.theme) || s.theme === 'safe') err(w + ': bad theme ' + s.theme);
  if (!KINDS.includes(s.kind)) err(w + ': bad kind');
  if (!(s.floor >= 1 && s.floor <= NFLOORS)) err(w + ': bad floor');
  const isRaceSt = s.kind === 'race', isParade = s.kind === 'parade';
  if ((s.theme === 'raceway') !== isRaceSt) err(w + ': theme raceway is for race stages only (and race stages use it)');
  if ((s.theme === 'parade') !== isParade) err(w + ': theme parade is for the parade stage only (and it uses it)');
  if (isRaceSt && s.floor !== 10) err(w + ': race stages belong on floor 10');
  if (isParade && s.floor !== 11) err(w + ': the parade belongs on floor 11');
  if (isRaceSt) {
    const rc = s.race;
    if (!rc || !Array.isArray(rc.rivals) || !rc.rivals.length) err(w + ': race.rivals missing');
    else {
      rc.rivals.forEach(r => { if (!(D.racers || {})[r]) err(w + ': race rival ' + r + ' not in racers'); });
      if (new Set(rc.rivals).size !== rc.rivals.length) err(w + ': duplicate rival');
      if (rc.boss) {
        const bd = (D.racers || {})[rc.boss];
        if (!bd || !bd.boss) err(w + ': race.boss ' + rc.boss + ' must be a racer with boss:true');
        if (!rc.rivals.includes(rc.boss)) err(w + ': race.boss must be one of the rivals');
        if (rc.place !== 1) err(w + ': a boss race must be won (place 1)');
      } else {
        if (rc.rivals.length < 3 || rc.rivals.length > 4) err(w + ': a heat wants 3-4 rivals');
        if (rc.rivals.some(r => ((D.racers || {})[r] || {}).boss)) err(w + ': the boss racer only races the championship');
        if (!(rc.place >= 1 && rc.place <= rc.rivals.length)) err(w + ': race.place must be 1..' + rc.rivals.length);
      }
    }
    if (s.music && s.music !== 'floor10') warn(w + ': race music should be floor10');
  } else if (s.race) err(w + ': race field on a ' + s.kind + ' stage');
  if (isParade) {
    const pd = s.parade;
    if (!pd || !(pd.speed > 0)) err(w + ': parade.speed missing');
    else { weighted(w + '.parade', pd.waves, 'waves'); if (pd.speed > 60) warn(w + ': parade speed ' + pd.speed + ' is fast for an autoscroller'); }
  } else if (s.parade) err(w + ': parade field on a ' + s.kind + ' stage');
  if (s.music && !MUSIC.includes(s.music)) err(w + ': bad music');
  if (s.owMarker && !MARKERS.includes(s.owMarker)) err(w + ': bad owMarker');
  if (s.intro) { if (Array.isArray(s.intro)) texts(w + '.intro', s.intro, 1); else text(w + '.intro', s.intro); }
  if (s.signs) texts(w + '.signs', s.signs);
  weighted(w, s.enemies, 'enemies'); weighted(w, s.elite, 'elite'); weighted(w, s.flyers, 'flyers');
  if (!s.reward || typeof s.reward.xp !== 'number') err(w + ': reward.xp missing');
  if (s.reward && s.reward.box && !TIERS.includes(s.reward.box)) err(w + ': reward box tier');
  if (s.kind !== 'ambush' && !(s.reward && s.reward.box)) warn(w + ': no reward box');
  const c = s.chunks || {};
  const start = D.chunks[c.start], end = D.chunks[c.end];
  if (!start) { err(w + ': start chunk ' + c.start + ' missing'); continue; }
  if (!end) { err(w + ': end chunk ' + c.end + ' missing'); continue; }
  chunkUse[c.start]++; chunkUse[c.end]++;
  if (start._P !== 1) err(w + ': start chunk must have exactly one P (has ' + start._P + ')');
  // Update 3: race chunks only in race stages and vice versa; parade street chunks only in the parade
  const allIds = [c.start, c.end].concat(c.pool || [], c.insert || []);
  allIds.forEach(cid => {
    const k = D.chunks[cid]; if (!k) return;
    if (isRaceSt !== !!k._race) err(w + ': chunk ' + cid + (isRaceSt ? ' is not a race_ chunk' : ' is a race chunk'));
    if (!isParade && k._parade) err(w + ': parade chunk ' + cid + ' outside the parade');
  });
  if (isRaceSt) {
    const need = ((s.race || {}).rivals || []).length;
    if (start._r < 3 || start._r > 4) err(w + ': race start chunk wants 3-4 r spots (has ' + start._r + ')');
    if (start._r < need) err(w + ': ' + need + ' rivals but only ' + start._r + ' r spots');
    if (end._F !== 1) err(w + ': race end chunk needs exactly one F (has ' + end._F + ')');
    if (start._F) err(w + ': F in the start chunk');
    (c.pool || []).concat(c.insert || []).forEach(p => { const k = D.chunks[p]; if (k && (k._F || k._r)) err(w + ': pool/insert chunk ' + p + ' has F or r'); });
    const n = 2 + (c.count || 0) + (c.insert || []).length;
    if (n < 6 || n > 11) warn(w + ': race is ' + n + ' chunks (want ~6-9 plus start/end)');
  } else if (start._r || end._F) err(w + ': r/F outside a race');
  if (!Array.isArray(c.pool)) err(w + ': pool not array');
  (c.pool || []).forEach(p => { if (!D.chunks[p]) err(w + ': pool chunk ' + p + ' missing'); else { chunkUse[p]++; const k = D.chunks[p]; if (k._P || k._D || k._K) err(w + ': pool chunk ' + p + ' has P/D/K'); } });
  if (c.count > 1 && (c.pool || []).length < 2) err(w + ': count>1 needs 2+ pool chunks (no immediate repeats)');
  if (c.count > (c.pool || []).length + 4) warn(w + ': count large for pool');
  if (end._P) err(w + ': end chunk has P');
  // Update 2: insert chunks (spliced into the middle) + quest item / rescue / padlocked exit
  const ins = c.insert || [];
  if (!Array.isArray(ins)) err(w + ': chunks.insert must be an array');
  const insChunks = [];
  ins.forEach(p => { const k = D.chunks[p]; if (!k) { err(w + ': insert chunk ' + p + ' missing'); return; } chunkUse[p]++; insChunks.push(k); if (k._P || k._D || k._K) err(w + ': insert chunk ' + p + ' has P/D/K'); });
  (c.pool || []).forEach(p => { const k = D.chunks[p]; if (k && (k._Q || k._R)) err(w + ': pool chunk ' + p + ' has Q/R (put Q/R only in insert chunks)'); });
  const fixed = [start, end].concat(insChunks);
  const nQ = fixed.reduce((a, k) => a + (k._Q || 0), 0), nR = fixed.reduce((a, k) => a + (k._R || 0), 0);
  if (s.questItem) {
    const qi = (D.questItems || {})[s.questItem];
    if (!qi) err(w + ': questItem ' + s.questItem + ' not in questItems');
    else if (qi.floor !== s.floor) err(w + ': questItem ' + s.questItem + ' belongs to floor ' + qi.floor);
    if (nQ !== 1) err(w + ': questItem stage needs exactly one Q in start+insert+end (has ' + nQ + ')');
    if (s.kind === 'boss' || s.kind === 'ambush' || isParade || (s.race && s.race.boss)) err(w + ': questItem on a ' + s.kind + ' stage');
  } else if (nQ) err(w + ': has Q but no questItem');
  if (s.rescue) {
    if (!COMP_FLOOR[s.rescue]) err(w + ': rescue ' + s.rescue + ' is not a rescuable companion');
    else if (COMP_FLOOR[s.rescue] !== s.floor) err(w + ': rescue ' + s.rescue + ' belongs on floor ' + COMP_FLOOR[s.rescue]);
    if (nR !== 1) err(w + ': rescue stage needs exactly one R in start+insert+end (has ' + nR + ')');
    if (s.kind !== 'main' && s.kind !== 'side') err(w + ': rescue on a ' + s.kind + ' stage');
  } else if (nR) err(w + ': has R but no rescue');
  if (s.exitNeeds) {
    const qi = (D.questItems || {})[s.exitNeeds];
    if (!qi) err(w + ': exitNeeds ' + s.exitNeeds + ' not in questItems');
    else if (qi.floor !== s.floor) err(w + ': exitNeeds ' + s.exitNeeds + ' is a floor ' + qi.floor + ' item');
    if (s.kind !== 'main' && s.kind !== 'side') err(w + ': exitNeeds on a ' + s.kind + ' stage');
  }
  if (s.kind === 'boss' || isParade) {
    if (!D.bosses[s.boss]) err(w + ': boss ' + s.boss + ' missing');
    if (end._K !== 1) err(w + ': boss arena must have exactly one K');
    if (s.kind === 'boss' && !(c.count >= 0 && c.count <= 2)) err(w + ': boss stage count should be 0-2');
    if (isParade) {
      if (!(c.count >= 3 && c.count <= 8)) warn(w + ': parade route is ' + c.count + ' street chunks (want 3-8)');
      (c.pool || []).forEach(p => { const k = D.chunks[p]; if (k && !k._parade) err(w + ': parade pool chunk ' + p + ' should be a parade_ street chunk'); });
      (c.pool || []).concat([c.start]).forEach(p => { const k = D.chunks[p]; if (k && k.rows && !k.rows[10].split('').every(ch => ch === '#')) err(w + ': parade street chunk ' + p + ' needs flat ground (row 10 all #) for the float'); });
    }
  } else if (isRaceSt) {
    if (end._K || end._D) err(w + ': race end chunk has K/D');
    if (s.boss) err(w + ': race stages name their boss in race.boss');
  } else {
    if (end._D < 1) err(w + ': end chunk needs a D');
    if (end._K) err(w + ': non-boss end has K');
    if (start._D || start._K) err(w + ': start chunk has D/K');
  }
  const poolSigns = Math.max(0, ...(c.pool || []).map(p => (D.chunks[p] || {})._n || 0));
  const insSigns = insChunks.reduce((a, k) => a + (k._n || 0), 0);
  if (insSigns && poolSigns && c.count) err(w + ': insert chunk signs + pool chunk signs make sign order depend on the seed');
  const needSigns = start._n + end._n + insSigns + (c.count ? poolSigns : 0);
  if (needSigns && !(s.signs && s.signs.length >= needSigns)) err(w + ': ' + needSigns + ' sign slots but ' + ((s.signs || []).length) + ' texts');
}
for (const [id, n] of Object.entries(chunkUse)) if (!n) warn('chunk ' + id + ' unused');

/* ---------------- floors / overworld ---------------- */
if (!Array.isArray(D.floors) || D.floors.length !== NFLOORS) err('floors must have ' + NFLOORS + ' entries');
const stageFloorRef = {};
D.floors.forEach((f, i) => {
  const w = 'floors[' + i + ']';
  if (f.n !== i + 1) err(w + ': n should be ' + (i + 1));
  text(w + '.name', f.name, 26); text(w + '.tagline', f.tagline, 50); texts(w + '.intro', f.intro, 1);
  if (!THEMES.includes(f.theme)) err(w + ': theme');
  if (!MUSIC.includes(f.music)) err(w + ': music');
  if (!(f.par > 0)) err(w + ': par');
  const bossSt = D.stages[f.boss];
  // Update 3: floor 10's boss is the championship race (race.boss), floor 11's is the parade
  const bossKindOk = bossSt && (f.n === 10 ? (bossSt.kind === 'race' && bossSt.race && bossSt.race.boss) : f.n === NFLOORS ? bossSt.kind === 'parade' : bossSt.kind === 'boss');
  if (!bossSt || !bossKindOk || bossSt.floor !== f.n) err(w + ': boss stage ' + f.boss + ' bad');
  const mainKind = f.n === 10 ? 'race' : 'main';
  (f.required || []).forEach(r => { const s = D.stages[r]; if (!s || s.floor !== f.n || s.kind !== mainKind) err(w + ': required ' + r + ' bad (want a ' + mainKind + ' stage)'); });
  if (f.bossMusic != null && !MUSIC.includes(f.bossMusic)) err(w + ': bossMusic');
  if (f.n === NFLOORS && f.bossMusic !== 'boss_final') warn(w + ': the last floor should use boss_final');
  if (f.n < NFLOORS && f.bossMusic === 'boss_final') err(w + ': boss_final is for the last floor');
  const used = new Set();
  if (f.n <= 2) {
    if (f.overworld) err(w + ': floors 1-2 must be linear');
    if (!Array.isArray(f.sequence)) err(w + ': sequence missing');
    (f.sequence || []).forEach(sid => { if (sid === 'SAFE') return; if (!D.stages[sid]) err(w + ': sequence stage ' + sid + ' missing'); used.add(sid); });
    if (!(f.sequence || []).includes('SAFE')) err(w + ': sequence lacks SAFE');
    if ((f.sequence || []).slice(-1)[0] !== f.boss) err(w + ': sequence should end with boss');
    (f.required || []).forEach(r => { if (!(f.sequence || []).includes(r)) err(w + ': required ' + r + ' not in sequence'); });
  } else {
    const o = f.overworld;
    if (!o) { err(w + ': overworld missing'); return; }
    if (!OW_THEMES.includes(o.theme)) err(w + ': ow theme');
    if (!MUSIC.includes(o.music)) err(w + ': ow music');
    const rows = o.map, H = rows.length, W = rows[0].length;
    if (W < 20 || H < 12) err(w + ': map too small');
    if (W < 40 || W > 60 || H < 24 || H > 36) warn(w + ': map ' + W + 'x' + H + ' outside 40-60 x 24-36');
    const found = {}; let P = null;
    rows.forEach((r, y) => {
      if (r.length !== W) err(w + ': map row ' + y + ' width ' + r.length);
      r.split('').forEach((c, x) => {
        if (!OW_CHARS.has(c)) err(w + ': map illegal char ' + c + ' at ' + x + ',' + y);
        if (c === 'P') { if (P) err(w + ': multiple P'); P = [x, y]; }
        if (ENT_RE.test(c)) { if (found[c]) err(w + ': entrance ' + c + ' used twice'); found[c] = [x, y]; }
        if ((x === 0 || y === 0 || x === W - 1 || y === H - 1) && !OW_BLOCK.has(c)) err(w + ': map not enclosed at ' + x + ',' + y);
      });
    });
    if (!P) { err(w + ': no P'); return; }
    const ents = o.entrances || {};
    for (const k of Object.keys(found)) if (!(k in ents)) err(w + ': map entrance ' + k + ' not in entrances');
    for (const k of Object.keys(ents)) if (!found[k]) err(w + ': entrance ' + k + ' not on map');
    for (const [k, v] of Object.entries(ents)) {
      if (k === 'S') { if (v !== 'SAFE') err(w + ': S must map to SAFE'); continue; }
      if (k === 'X') { if (v !== 'STAIRS') err(w + ': X must map to STAIRS'); continue; }
      if (k === 'B') { if (v !== f.boss) err(w + ': B must map to floor boss'); }
      const s = D.stages[v];
      if (!s) { err(w + ': entrance ' + k + ' -> missing stage ' + v); continue; }
      if (s.floor !== f.n) err(w + ': entrance ' + k + ' stage on wrong floor');
      if (/[1-9]/.test(k) && s.kind !== mainKind) err(w + ': entrance ' + k + ' should be a ' + mainKind + ' stage');
      if (s.kind === 'race' && s.owMarker !== 'ow_garage') warn(w + ': race entrance ' + k + ' should use owMarker ow_garage');
      if (s.kind === 'parade' && s.owMarker !== 'ow_float') warn(w + ': parade entrance ' + k + ' should use owMarker ow_float');
      if (/[ACDEF]/.test(k) && s.kind !== 'side') err(w + ': entrance ' + k + ' should be a side stage');
      used.add(v);
    }
    ['S', 'B'].forEach(k => { if (!ents[k]) err(w + ': missing ' + k); });
    // the last floor (the parade) has no stairwell; every other overworld floor has one
    if (f.n === NFLOORS) { if (ents.X || found.X) err(w + ': the last floor has no stairs X'); }
    else if (!ents.X) err(w + ': missing X');
    (f.required || []).forEach(r => { if (!Object.values(ents).includes(r)) err(w + ': required ' + r + ' has no entrance'); });
    // flood fill (entrances are reachable but not passable)
    const seen = new Set([P.join()]), q = [[P[0], P[1], 0]], hit = new Set(), dist = {};
    while (q.length) {
      const [x, y, d] = q.shift();
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy, k = nx + ',' + ny;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H || seen.has(k)) continue;
        const c = rows[ny][nx];
        if (OW_WALK.has(c)) { seen.add(k); q.push([nx, ny, d + 1]); } else if (ENT_RE.test(c)) { hit.add(c); if (!(c in dist)) dist[c] = d + 1; }
      }
    }
    for (const k of Object.keys(found)) if (!hit.has(k)) err(w + ': entrance ' + k + ' unreachable from P');
    rows.forEach((r, y) => r.split('').forEach((c, x) => { if (OW_WALK.has(c) && !seen.has(x + ',' + y)) err(w + ': walkable ' + x + ',' + y + ' unreachable'); }));
    if (found.B) {
      const dB = dist.B || 0; // walking distance
      if (dB < (W + H) / 2) warn(w + ': boss is close to start (walk ' + dB + ')');
      if (!quiet) console.log('  floor ' + f.n + ' walk distances from P: ' + Object.keys(dist).sort().map(k => k + '=' + dist[k]).join(' '));
      if (found.X) { const dX = Math.abs(found.B[0] - found.X[0]) + Math.abs(found.B[1] - found.X[1]); if (dX > 10) warn(w + ': stairs far from boss (' + dX + ')'); }
    }
    const nMain = Object.keys(found).filter(k => /[1-9]/.test(k)).length, nSide = Object.keys(found).filter(k => /[ACDEF]/.test(k)).length;
    if (nMain < 3 || nMain > 4) warn(w + ': ' + nMain + ' main areas');
    // Update 3: overworld NPCs (floor 10 rival racers in their driveways)
    const npcAt = new Set();
    if (o.npcs != null && !Array.isArray(o.npcs)) err(w + ': npcs must be an array');
    (o.npcs || []).forEach((n, i) => {
      const nw = w + '.npcs[' + i + ']';
      if (!(D.racers || {})[n.racer]) err(nw + ': racer ' + n.racer + ' not in racers');
      const c = rows[n.y] && rows[n.y][n.x];
      if (!c || !OW_WALK.has(c) || c === 'P') err(nw + ': not on a walkable tile (' + c + ')');
      else if (!seen.has(n.x + ',' + n.y)) err(nw + ': unreachable');
      let byHouse = false;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const cc = rows[n.y + dy] && rows[n.y + dy][n.x + dx]; if (cc === '#' || ENT_RE.test(cc || '')) byHouse = true; }
      if (!byHouse) warn(nw + ': not standing next to a garage/house');
      for (const [ex, ey] of Object.values(found)) if (Math.abs(ex - n.x) + Math.abs(ey - n.y) === 1 && (rows[ey][ex] !== 'B')) warn(nw + ': stands right in front of entrance ' + rows[ey][ex]);
      if (npcAt.has(n.x + ',' + n.y)) err(nw + ': two NPCs on one tile'); npcAt.add(n.x + ',' + n.y);
      if (Math.abs(n.x - P[0]) + Math.abs(n.y - P[1]) < 3) err(nw + ': too close to the player start');
      if (n.lines != null) texts(nw + '.lines', n.lines, 2);
      if (n.lines && n.lines.length > 3) warn(nw + ': more than 3 lines');
    });
    if (f.n === 10) for (const r of RACER_IDS) if (!(o.npcs || []).some(n => n.racer === r)) warn(w + ': racer ' + r + ' has no driveway NPC');
    if ((nSide < 1 && f.n !== NFLOORS) || nSide > 2) warn(w + ': ' + nSide + ' side areas');
    if (!(o.roamers && o.roamers.length >= 2 && o.roamers.length <= 4)) warn(w + ': want 2-4 roamers');
    (o.roamers || []).forEach((r, i) => {
      if (!D.enemies[r.enemy]) err(w + ': roamer ' + i + ' enemy ' + r.enemy);
      const c = rows[r.y] && rows[r.y][r.x];
      if (!c || !OW_WALK.has(c) || c === 'P') err(w + ': roamer ' + i + ' not on walkable tile (' + c + ')');
      if ((o.npcs || []).some(n => Math.abs(n.x - r.x) + Math.abs(n.y - r.y) < 2)) err(w + ': roamer ' + i + ' on top of an NPC');
    });
    const amb = D.stages[o.ambush];
    if (!amb || amb.kind !== 'ambush' || amb.floor !== f.n) err(w + ': ambush stage bad');
    else used.add(o.ambush);
  }
  used.forEach(s => { stageFloorRef[s] = (stageFloorRef[s] || 0) + 1; });
});
for (const id of Object.keys(D.stages)) if (!stageFloorRef[id]) err('stage ' + id + ' is not referenced by any floor');
// boss unlocks per DESIGN Update 2 (no companion unlocks any more)
// Update 3: the gold skin comes from winning (G.win after the last floor), not from a boss unlock
const PLAN = { hoarder: 'carl_jacket', juicer: null, ringmaster: 'carl_clown', engineer: null,
  tidemother: 'carl_hazmat', butcher: null, bride: 'carl_bodyguard', overseer: 'carl_kilt', showrunner: null, grand_marshal: null };
const finals = Object.keys(D.bosses).filter(b => D.bosses[b].final);
if (finals.length !== 1 || finals[0] !== 'grand_marshal') err('bosses: exactly one final boss (grand_marshal) wanted, got ' + finals.join(','));
if (D.floors[NFLOORS - 1] && D.stages[D.floors[NFLOORS - 1].boss] && D.stages[D.floors[NFLOORS - 1].boss].boss !== finals[0]) err('the last floor boss stage must hold the final boss');
for (const [b, sk] of Object.entries(PLAN)) {
  const u = D.bosses[b] && D.bosses[b].unlock;
  if (u && u.companion) err('boss ' + b + ' unlocks a companion (companions are rescued now)');
  if (sk && !(u && u.skin === sk)) err('boss ' + b + ' unlock should be skin ' + sk);
  if (!sk && u) err('boss ' + b + ' should unlock nothing');
}

/* ---------------- quest items, rescues, chains (Update 2) ---------------- */
const QI = D.questItems || {};
if (!D.questItems) err('questItems missing');
const qiWhere = {};
for (const [sid, s] of Object.entries(D.stages)) if (s.questItem) (qiWhere[s.questItem] = qiWhere[s.questItem] || []).push(sid);
const qiUsed = {};
for (const s of Object.values(D.stages)) if (s.exitNeeds) qiUsed[s.exitNeeds] = true;
// locks: {needs:'id'} | {needs:['id',...]} (all of them) | {afterCleared:'stageId'} (Update 3)
const lockNeeds = (l) => !l || l.needs == null ? [] : Array.isArray(l.needs) ? l.needs : [l.needs];
D.floors.forEach(f => Object.values(f.locks || {}).forEach(l => lockNeeds(l).forEach(n => { qiUsed[n] = true; })));
for (const [id, q] of Object.entries(QI)) {
  const w = 'questItems.' + id;
  text(w + '.name', q.name, 22); text(w + '.desc', q.desc, 120); text(w + '.hint', q.hint, 140);
  if (!(q.floor >= 2 && q.floor <= NFLOORS)) err(w + ': floor must be 2-' + NFLOORS);
  if (q.truck != null) {
    if (q.floor !== 10) err(w + ': truck upgrades belong on floor 10');
    const ks = Object.keys(q.truck);
    if (!ks.length || ks.some(k => !TRUCK_KEYS.includes(k))) err(w + ': truck must be {hp}|{speed}|{accel}|{mines:true}');
    if (q.truck.mines != null && q.truck.mines !== true) err(w + ': truck.mines must be true');
    for (const k of ['hp', 'speed', 'accel']) if (q.truck[k] != null && !(q.truck[k] > 0 && q.truck[k] <= 60)) err(w + ': truck.' + k + ' out of range');
  }
  if (q.float != null) {
    if (q.floor !== NFLOORS) err(w + ': float parts belong on floor ' + NFLOORS);
    if (!FLOAT_PARTS.includes(q.float)) err(w + ': float must be one of ' + FLOAT_PARTS.join(' '));
  }
  if (q.truck != null && q.float != null) err(w + ': both truck and float');
  if (!QI_SPRITES.includes(q.sprite)) err(w + ': sprite ' + q.sprite + ' not in qi_* art list');
  const where = qiWhere[id] || [];
  if (where.length !== 1) err(w + ': placed in ' + where.length + ' stages (want exactly 1): ' + where.join(','));
  if (!qiUsed[id] && q.truck == null) warn(w + ': never needed by a lock or exit');
}
const rescueAt = {};
for (const [sid, s] of Object.entries(D.stages)) if (s.rescue) (rescueAt[s.rescue] = rescueAt[s.rescue] || []).push(sid);
for (const [cid, fl] of Object.entries(COMP_FLOOR)) {
  const at = rescueAt[cid] || [];
  if (at.length !== 1) err('companion ' + cid + ': ' + at.length + ' rescue stages (want exactly 1 on floor ' + fl + ')');
  const f = D.floors[fl - 1];
  if (f && f.companion !== cid) err('floors[' + (fl - 1) + '].companion should be ' + cid);
}
for (const [cid, sids] of Object.entries(rescueAt)) if (!COMP_FLOOR[cid]) err('rescue of ' + cid + ' in ' + sids.join(','));

const chainReport = [];
D.floors.forEach((f, i) => {
  const w = 'floors[' + i + ']';
  if (f.companion != null) {
    if (!COMP_FLOOR[f.companion] || COMP_FLOOR[f.companion] !== f.n) err(w + ': companion ' + f.companion + ' does not belong on this floor');
  }
  if (f.n >= 2) texts(w + '.hints', f.hints, 3);
  if (f.hints && f.hints.length > 5) warn(w + ': more than 5 hints');
  const floorStages = Object.keys(D.stages).filter(k => D.stages[k].floor === f.n);
  const items = Object.keys(QI).filter(k => QI[k].floor === f.n);
  const has = (it) => !!QI[it] && QI[it].floor === f.n && (qiWhere[it] || []).some(sid => D.stages[sid].floor === f.n);
  const locks = f.locks || {};
  for (const [ch, l] of Object.entries(locks)) {
    const lw = w + '.locks.' + ch;
    if (!l || (l.needs == null && l.afterCleared == null)) { err(lw + ': needs or afterCleared missing'); continue; }
    if (l.needs != null && l.afterCleared != null) err(lw + ': use needs OR afterCleared, not both');
    if (Array.isArray(l.needs) && (!l.needs.length || new Set(l.needs).size !== l.needs.length)) err(lw + ': needs array empty or has duplicates');
    for (const n of lockNeeds(l)) {
      if (!QI[n]) err(lw + ': item ' + n + ' not in questItems');
      else if (!has(n)) err(lw + ': item ' + n + ' not obtainable on this floor');
    }
    if (l.afterCleared != null) {
      const as = D.stages[l.afterCleared];
      if (!as || as.floor !== f.n) err(lw + ': afterCleared ' + l.afterCleared + ' is not a stage on this floor');
      else if (f.overworld && (f.overworld.entrances || {})[ch] === l.afterCleared) err(lw + ': entrance locked behind itself');
    }
    if (l.text != null) text(lw + '.text', l.text, 100);
  }
  for (const sid of floorStages) { const s = D.stages[sid]; if (s.exitNeeds && !has(s.exitNeeds)) err('stages.' + sid + ': exitNeeds ' + s.exitNeeds + ' not obtainable on its floor'); }

  const held = new Set(), entered = new Set(), cleared = new Set(), rescued = new Set(), order = [];
  const visit = (sid) => {
    const s = D.stages[sid];
    if (!entered.has(sid)) { entered.add(sid); order.push(sid); }
    if (s.questItem && !held.has(s.questItem)) { held.add(s.questItem); order.push('+' + s.questItem); }
    if (s.rescue && !rescued.has(s.rescue)) { rescued.add(s.rescue); order.push('@' + s.rescue); }
    if (!cleared.has(sid) && (!s.exitNeeds || held.has(s.exitNeeds))) { cleared.add(sid); if (s.exitNeeds) order.push(sid + ':exit'); }
  };
  if (!f.overworld) {
    if (Object.keys(locks).length) err(w + ': linear floors cannot use locks');
    for (const sid of (f.sequence || [])) {
      if (sid === 'SAFE' || !D.stages[sid]) continue;
      visit(sid);
      if (!cleared.has(sid)) { err(w + ': chain stuck, ' + sid + ' exit needs ' + D.stages[sid].exitNeeds + ' (not held by then)'); break; }
    }
  } else {
    const ents = f.overworld.entrances || {};
    for (const ch of Object.keys(locks)) if (!(ch in ents) || ch === 'S' || ch === 'X') err(w + '.locks: ' + ch + ' is not a stage entrance');
    for (const [ch, l] of Object.entries(locks)) { const sid = ents[ch]; const s = D.stages[sid]; if (s && s.questItem && lockNeeds(l).includes(s.questItem)) err(w + ': item ' + s.questItem + ' sits inside ' + sid + ', which needs it to enter'); }
    if (f.n >= 3 && f.n <= 9) {
      if (items.length < 2 || items.length > 3) err(w + ': wants 2-3 quest items (has ' + items.length + ')');
      if (!locks.B) err(w + ': boss entrance B must be locked by the boss key');
      const mainLock = Object.entries(locks).some(([ch, l]) => /[1-9]/.test(ch) && !(qiWhere[l.needs] || []).includes(ents[ch]));
      if (!mainLock) err(w + ': no main area entrance locked by an item from another area');
      const exitLock = floorStages.some(sid => { const s = D.stages[sid]; return s.exitNeeds && !(qiWhere[s.exitNeeds] || []).includes(sid); });
      if (!exitLock) err(w + ': no area exit locked by an item from a different area');
    }
    const req = f.required || [];
    let changed = true, guard = 0;
    while (changed && guard++ < 100) {
      changed = false;
      for (const [ch, sid] of Object.entries(ents)) {
        if (ch === 'S' || ch === 'X' || !D.stages[sid]) continue;
        const lk = locks[ch];
        if (lk && !lockNeeds(lk).every(n => held.has(n))) continue;
        if (lk && lk.afterCleared != null && !cleared.has(lk.afterCleared)) continue;
        if (ch === 'B' && !req.every(r => cleared.has(r))) continue;
        const before = entered.size + held.size + cleared.size + rescued.size;
        visit(sid);
        if (entered.size + held.size + cleared.size + rescued.size !== before) changed = true;
      }
    }
    req.forEach(r => { if (!cleared.has(r)) err(w + ': chain unsolvable, required ' + r + ' never cleared'); });
    if (!cleared.has(f.boss)) err(w + ': chain unsolvable, boss ' + f.boss + ' never reachable');
    for (const [ch, sid] of Object.entries(ents)) if (D.stages[sid] && !entered.has(sid)) warn(w + ': entrance ' + ch + ' (' + sid + ') never becomes enterable');
  }
  for (const it of items) if (!held.has(it)) err(w + ': item ' + it + ' never obtained by the chain');
  // Update 3 floor rules
  if (f.n === 10) {
    const want = { '2': 'f10_r1', '3': 'f10_r2', 'B': 'f10_r3' };
    for (const [ch, sid] of Object.entries(want)) if (!locks[ch] || locks[ch].afterCleared !== sid) err(w + ': locks.' + ch + ' should be {afterCleared: ' + sid + '}');
    if (Object.keys(locks).some(ch => !want[ch])) err(w + ': floor 10 only locks 2, 3 and B');
    if (f.companion) err(w + ': no companion on floor 10');
    const ents = (f.overworld || {}).entrances || {};
    ['A', 'C'].forEach(k => { const st = D.stages[ents[k]]; if (!st || !st.questItem || !(QI[st.questItem] || {}).truck) err(w + ': side area ' + k + ' should hold a truck upgrade'); });
    if (!items.length || items.some(it => !QI[it].truck)) err(w + ': floor 10 quest items should all be truck upgrades');
    if (Object.values(ents).filter(v => D.stages[v] && D.stages[v].kind === 'race').length !== 4) err(w + ': want 3 heats + the championship');
  }
  if (f.n === NFLOORS) {
    const need = lockNeeds(locks.B);
    if (!Array.isArray((locks.B || {}).needs)) err(w + ': locks.B.needs must be an array of the float parts');
    const parts = items.filter(it => QI[it].float);
    const kinds = parts.map(it => QI[it].float).sort().join(' ');
    if (kinds !== FLOAT_PARTS.slice().sort().join(' ')) err(w + ': want exactly one float part of each kind (' + FLOAT_PARTS.join(' ') + '), got ' + kinds);
    parts.forEach(it => { if (!need.includes(it)) err(w + ': float part ' + it + ' not required by locks.B'); if (!held.has(it)) err(w + ': float part ' + it + ' not obtainable'); });
    need.forEach(n => { if (!(QI[n] || {}).float) err(w + ': locks.B needs ' + n + ', which is not a float part'); });
    Object.keys(locks).forEach(ch => { if (ch !== 'B') warn(w + ': extra lock on ' + ch); });
    if (f.companion) err(w + ': no companion on floor ' + NFLOORS);
    const ents = (f.overworld || {}).entrances || {};
    for (const p of parts) { const sid = qiWhere[p][0]; if (!/[1-9]/.test(Object.keys(ents).find(k => ents[k] === sid) || '')) err(w + ': float part ' + p + ' should sit in a numbered area'); }
  }
  if (f.companion && !rescued.has(f.companion)) err(w + ': companion ' + f.companion + ' never rescued by the chain');
  chainReport.push('  floor ' + f.n + ' chain: ' + order.join(' > '));
});
if (!quiet) chainReport.forEach(l => console.log(l));

/* ---------------- loot / shop / skins / companions ---------------- */
function reward(w, r, inShop) {
  const k = r.kind;
  if (k === 'gold') { if (!(r.min >= 0 && r.max >= r.min)) err(w + ': gold min/max'); }
  else if (k === 'item') { if (!['potion', 'bomb'].includes(r.id) || !(r.count > 0)) err(w + ': item'); }
  else if (k === 'skin') { if (!r.any && !SKINS.includes(r.id)) err(w + ': skin id'); }
  else if (k === 'companion') err(w + ': companion rewards are not allowed (companions are rescued)');
  else if (k === 'stat') { if (!r.any && !STATS.includes(r.stat)) err(w + ': stat'); if (!(r.amount > 0)) err(w + ': stat amount'); }
  else if (k === 'xp' || k === 'hp') { if (!(r.amount > 0)) err(w + ': amount'); }
  else if (inShop && k === 'revival') { if (!(r.count > 0)) err(w + ': revival count'); }
  else if (inShop && k === 'box') { if (!TIERS.includes(r.tier)) err(w + ': box tier'); }
  else err(w + ': unknown reward kind ' + k);
}
for (const t of TIERS) {
  if (!D.boxTiers[t]) err('boxTiers.' + t + ' missing'); else { text('boxTiers.' + t + '.name', D.boxTiers[t].name, 26); if (!/^#[0-9a-f]{6}$/i.test(D.boxTiers[t].color)) err('boxTiers.' + t + ' color'); }
  const lt = D.lootTables[t];
  if (!lt) { err('lootTables.' + t + ' missing'); continue; }
  if (!(lt.rolls > 0)) err('lootTables.' + t + ': rolls');
  lt.entries.forEach((e, i) => { reward('lootTables.' + t + '[' + i + ']', e[0]); if (!(e[1] > 0)) err('lootTables.' + t + ': weight'); });
  (lt.guaranteed || []).forEach((r, i) => reward('lootTables.' + t + '.guaranteed[' + i + ']', r));
  const cos = lt.entries.filter(e => e[0].kind === 'skin' || e[0].kind === 'companion').length;
  if (!cos && t !== 'bronze') warn('lootTables.' + t + ' has no cosmetics');
}
const leg = D.lootTables.legendary;
if (!(leg && (leg.guaranteed || []).some(r => r.kind === 'skin' && r.any))) err('legendary must guarantee a skin any:true');
const shopIds = new Set();
D.shop.forEach((s, i) => {
  const w = 'shop[' + i + ']';
  if (shopIds.has(s.id)) err(w + ': duplicate id'); shopIds.add(s.id);
  text(w + '.name', s.name, 24); text(w + '.desc', s.desc, 90);
  if (!(s.price > 0)) err(w + ': price'); reward(w + '.give', s.give, true);
});
['potion', 'bomb', 'bomb_bundle', 'tonic_str', 'tonic_con', 'tonic_dex', 'tonic_int', 'heart', 'revival'].forEach(id => { if (!shopIds.has(id)) err('shop missing ' + id); });
for (const id of SKINS) {
  const s = D.skins[id];
  if (!s) { err('skin missing ' + id); continue; }
  text('skins.' + id + '.name', s.name, 20); text('skins.' + id + '.desc', s.desc); text('skins.' + id + '.how', s.how, 60);
  if (s.perk) for (const k of Object.keys(s.perk)) if (!PERKS.includes(k)) err('skins.' + id + ': bad perk ' + k);
}
for (const id of Object.keys(D.skins)) if (!SKINS.includes(id)) err('skin ' + id + ' not in fixed list');
for (const id of COMPANIONS) {
  const c = D.companions[id];
  if (!c) { err('companion missing ' + id); continue; }
  const w = 'companions.' + id;
  text(w + '.name', c.name, 20); text(w + '.desc', c.desc); text(w + '.how', c.how, 60);
  text(w + '.special.name', c.special.name, 24); text(w + '.special.desc', c.special.desc);
  if (!ABILITIES.includes(c.ability)) err(w + ': ability');
  if (!(c.cooldown > 0 && c.power > 0)) err(w + ': cooldown/power');
  if (c.sprite !== id) err(w + ': sprite should be ' + id);
  if (id !== 'donut') {
    if (!Array.isArray(c.rescueLines) || c.rescueLines.length < 1 || c.rescueLines.length > 2) err(w + ': rescueLines wants 1-2 lines');
    else texts(w + '.rescueLines', c.rescueLines, 1, 120);
  }
  if (c.special.time != null && !(c.special.time >= 0)) err(w + ': special.time');
}
for (const id of Object.keys(D.companions)) if (!COMPANIONS.includes(id)) err('companion ' + id + ' not in fixed list');

/* ---------------- achievements ---------------- */
const nAch = Object.keys(D.achievements).length;
if (nAch < 35 || nAch > 65) err('achievements: ' + nAch + ' (want 35-65)');
for (const [id, a] of Object.entries(D.achievements)) {
  const w = 'achievements.' + id;
  text(w + '.name', a.name, 24); text(w + '.desc', a.desc);
  const ev = a.event || '';
  const ok = EVENTS.includes(ev) || (/^kill:/.test(ev) && D.enemies[ev.slice(5)]) || (/^boss:/.test(ev) && D.bosses[ev.slice(5)]) ||
    /^floor:([1-9]|1[01])$/.test(ev) || /^level:\d+$/.test(ev) || /^race_place:[1-5]$/.test(ev);
  if (!ok) err(w + ': bad event ' + ev);
  if (!(a.count >= 1)) err(w + ': count');
  if (!TIERS.includes(a.box)) err(w + ': box tier');
  if (a.unlock) { if (a.unlock.skin && !SKINS.includes(a.unlock.skin)) err(w + ': unlock skin'); if (a.unlock.companion) err(w + ': companion unlocks are not allowed (companions are rescued)'); }
}
for (const b of BOSS_IDS) if (!Object.values(D.achievements).some(a => a.event === 'boss:' + b)) warn('no achievement for boss ' + b);

/* ---------------- racers, truck, Mordecai forms (Update 3) ---------------- */
const RC = D.racers || {};
if (!D.racers) err('racers missing');
for (const id of RACER_IDS) if (!RC[id]) err('racer missing: ' + id);
for (const [id, r] of Object.entries(RC)) {
  const w = 'racers.' + id;
  if (!RACER_IDS.includes(id)) err(w + ': id not in the fixed racer list (no art)');
  if (r.sprite !== 'racer_' + id) err(w + ': sprite should be racer_' + id);
  if (r.portrait !== 'p_racer_' + id) err(w + ': portrait should be p_racer_' + id);
  text(w + '.name', r.name, 24); text(w + '.title', r.title, 32);
  if (r.vehicle != null) text(w + '.vehicle', r.vehicle, 24);
  if (r.desc != null) text(w + '.desc', r.desc, 120);
  for (const k of ['speed', 'accel', 'hp']) if (!(typeof r[k] === 'number' && r[k] > 0)) err(w + ': ' + k + ' not a positive number');
  for (const k of ['aggression', 'skill']) if (!(r[k] >= 0 && r[k] <= 1)) err(w + ': ' + k + ' must be 0..1');
  if (r.weapon !== null && !(D.projectiles[r.weapon] && !D.projectiles[r.weapon].friendly)) err(w + ': weapon must be an enemy projectile id or null');
  texts(w + '.lines', r.lines, 3);
  const boss = id === 'champion';
  if (!!r.boss !== boss) err(w + ': boss:true is for the champion only');
  if (!boss && (r.speed < 140 || r.speed > 180)) warn(w + ': rival speed ' + r.speed + ' far from the truck (170)');
}
if (RC.champion) {
  const others = RACER_IDS.filter(i => i !== 'champion' && RC[i]);
  if (!others.every(i => RC.champion.hp >= RC[i].hp * 3)) err('racers.champion: should be much tougher (hp >= 3x every rival)');
  if (!others.every(i => RC.champion.speed > RC[i].speed)) err('racers.champion: should be the fastest racer');
}
const TK = D.truck;
if (!TK) err('truck missing');
else {
  text('truck.name', TK.name, 24);
  if (TK.sprite !== 'truck') err('truck.sprite should be truck');
  if (TK.speed !== 170 || TK.accel !== 140 || TK.hp !== 30) err('truck should be speed 170, accel 140, hp 30 (spec)');
}
const MF = D.mordecaiForms || {};
for (let n = 1; n <= NFLOORS; n++) {
  const m = MF[n];
  if (!m) { err('mordecaiForms[' + n + '] missing'); continue; }
  text('mordecaiForms[' + n + '].name', m.name, 20); text('mordecaiForms[' + n + '].line', m.line);
}

/* ---------------- text pools ---------------- */
for (const k of ['floorClear', 'stageClear', 'death', 'levelUp', 'lootbox', 'revive', 'boxEmpty', 'lowHp', 'bigCombo', 'flee']) texts('ai.' + k, D.ai[k], 8);
texts('mordecai', D.mordecai, 15);
text('shopkeeper.name', D.shopkeeper.name, 24); texts('shopkeeper.lines', D.shopkeeper.lines, 5);
for (const k of ['intro', 'ending']) (D.story[k] || []).forEach((p, i) => {
  text('story.' + k + '[' + i + ']', p.text);
  if (p.portrait != null && !PORTRAITS.includes(p.portrait)) err('story.' + k + '[' + i + ']: portrait ' + p.portrait);
});
if (!(D.story.intro || []).length || !(D.story.ending || []).length) err('story intro/ending empty');
texts('story.credits', D.story.credits, 3, 50);
let lastV = -1;
D.titles.forEach((t, i) => { text('titles[' + i + ']', t.name, 22); if (!(t.views > lastV)) err('titles must ascend'); lastV = t.views; });
if (D.titles[0].views !== 0) err('titles[0].views must be 0');

/* ---------------- report ---------------- */
const counts = {
  floors: D.floors.length, stages: Object.keys(D.stages).length, chunks: Object.keys(D.chunks).length,
  enemies: Object.keys(D.enemies).length, projectiles: Object.keys(D.projectiles).length, bosses: Object.keys(D.bosses).length,
  achievements: nAch, shop: D.shop.length, mordecai: D.mordecai.length
};
console.log('counts:', JSON.stringify(counts));
if (!quiet || errors.length) warns.forEach(m => console.log('WARN  ' + m));
errors.forEach(m => console.log('ERROR ' + m));
console.log(errors.length ? errors.length + ' error(s), ' + warns.length + ' warning(s)' : 'OK - 0 errors, ' + warns.length + ' warning(s)');
process.exit(errors.length ? 1 : 0);

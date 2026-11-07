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
const THEMES = 'sewer cave city circus swamp train bubble forest castle ruin warzone safe'.split(' ');
const OW_THEMES = 'ow_city ow_rail ow_reef ow_woods ow_manor ow_waste ow_war'.split(' ');
const ENEMY_IDS = ('rat roach goblin goblin_archer goblin_brute bat grub shaman juicer_minion clown clown_brute ' +
  'skyfowl swamp_troll gator steam_goblin conductor rail_rat fishman jelly crab hunter hound masked_noble ghoul ' +
  'gargoyle skeleton mutant drone golem soldier sniper war_beast cultist').split(' ');
const BOSS_IDS = 'hoarder juicer ringmaster engineer tidemother butcher bride overseer showrunner'.split(' ');
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
const MUSIC = ('title intro floor1 floor2 floor3 floor4 floor5 floor6 floor7 floor8 floor9 ow3 ow4 ow5 ow6 ow7 ow8 ow9 ' +
  'boss boss_final safe results gameover ending lootbox').split(' ');
const MARKERS = 'ow_door ow_manhole ow_tent ow_cave'.split(' ');
const PORTRAITS = ['p_carl', 'p_donut', 'p_mongo', 'p_katia', 'p_zev', 'p_squeaks', 'p_samantha', 'p_signet', 'p_ai', 'p_mordecai', 'p_bopca'].concat(BOSS_IDS.map(b => 'p_' + b));
const EVENTS = ('kill stomp kick bomb_kill multi_bomb potion crate coin fall death revive box_open combo10 combo25 ' +
  'no_damage_stage skin_equip companion_equip shop flee secret win pet_donut').split(' ');
const STATS = 'str con dex int'.split(' ');
const PERKS = 'dmg def hp speed gold views bombs doubleJump'.split(' ');

const CHUNK_CHARS = new Set('. #X=^~Hbohm?eEfPDK<>vcn$QRSL'.split(''));
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
  // reachability: from left edge (or P) to right edge, plus targets
  const starts = ch._P ? [] : [[0, 9], [1, 9]];
  rows.forEach((r, y) => { const x = r.indexOf('P'); if (x >= 0) starts.push([x, y]); });
  // pass 1: as built; pass 2: crates broken (punch/kick/bomb) - targets may need that. Gates open (lever pulled).
  const seen0 = reach(id, openRows, starts, false), seen = reach(id, openRows, starts, true);
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
const KINDS = ['main', 'side', 'boss', 'ambush'];
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
  if (!(s.floor >= 1 && s.floor <= 9)) err(w + ': bad floor');
  if (s.music && !MUSIC.includes(s.music)) err(w + ': bad music');
  if (s.owMarker && !MARKERS.includes(s.owMarker)) err(w + ': bad owMarker');
  if (s.intro) text(w + '.intro', s.intro);
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
    if (s.kind === 'boss' || s.kind === 'ambush') err(w + ': questItem on a ' + s.kind + ' stage');
  } else if (nQ) err(w + ': has Q but no questItem');
  if (s.rescue) {
    if (!COMP_FLOOR[s.rescue]) err(w + ': rescue ' + s.rescue + ' is not a rescuable companion');
    else if (COMP_FLOOR[s.rescue] !== s.floor) err(w + ': rescue ' + s.rescue + ' belongs on floor ' + COMP_FLOOR[s.rescue]);
    if (nR !== 1) err(w + ': rescue stage needs exactly one R in start+insert+end (has ' + nR + ')');
    if (s.kind === 'boss' || s.kind === 'ambush') err(w + ': rescue on a ' + s.kind + ' stage');
  } else if (nR) err(w + ': has R but no rescue');
  if (s.exitNeeds) {
    const qi = (D.questItems || {})[s.exitNeeds];
    if (!qi) err(w + ': exitNeeds ' + s.exitNeeds + ' not in questItems');
    else if (qi.floor !== s.floor) err(w + ': exitNeeds ' + s.exitNeeds + ' is a floor ' + qi.floor + ' item');
    if (s.kind === 'boss' || s.kind === 'ambush') err(w + ': exitNeeds on a ' + s.kind + ' stage');
  }
  if (s.kind === 'boss') {
    if (!D.bosses[s.boss]) err(w + ': boss ' + s.boss + ' missing');
    if (end._K !== 1) err(w + ': boss arena must have exactly one K');
    if (!(c.count >= 0 && c.count <= 2)) err(w + ': boss stage count should be 0-2');
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
if (!Array.isArray(D.floors) || D.floors.length !== 9) err('floors must have 9 entries');
const stageFloorRef = {};
D.floors.forEach((f, i) => {
  const w = 'floors[' + i + ']';
  if (f.n !== i + 1) err(w + ': n should be ' + (i + 1));
  text(w + '.name', f.name, 26); text(w + '.tagline', f.tagline, 50); texts(w + '.intro', f.intro, 1);
  if (!THEMES.includes(f.theme)) err(w + ': theme');
  if (!MUSIC.includes(f.music)) err(w + ': music');
  if (!(f.par > 0)) err(w + ': par');
  const bossSt = D.stages[f.boss];
  if (!bossSt || bossSt.kind !== 'boss' || bossSt.floor !== f.n) err(w + ': boss stage ' + f.boss + ' bad');
  (f.required || []).forEach(r => { const s = D.stages[r]; if (!s || s.floor !== f.n || s.kind !== 'main') err(w + ': required ' + r + ' bad'); });
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
      if (/[1-9]/.test(k) && s.kind !== 'main') err(w + ': entrance ' + k + ' should be a main stage');
      if (/[ACDEF]/.test(k) && s.kind !== 'side') err(w + ': entrance ' + k + ' should be a side stage');
      used.add(v);
    }
    ['S', 'B', 'X'].forEach(k => { if (!ents[k]) err(w + ': missing ' + k); });
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
    if (nSide < 1 || nSide > 2) warn(w + ': ' + nSide + ' side areas');
    if (!(o.roamers && o.roamers.length >= 2 && o.roamers.length <= 4)) warn(w + ': want 2-4 roamers');
    (o.roamers || []).forEach((r, i) => {
      if (!D.enemies[r.enemy]) err(w + ': roamer ' + i + ' enemy ' + r.enemy);
      const c = rows[r.y] && rows[r.y][r.x];
      if (!c || !OW_WALK.has(c) || c === 'P') err(w + ': roamer ' + i + ' not on walkable tile (' + c + ')');
    });
    const amb = D.stages[o.ambush];
    if (!amb || amb.kind !== 'ambush' || amb.floor !== f.n) err(w + ': ambush stage bad');
    else used.add(o.ambush);
  }
  used.forEach(s => { stageFloorRef[s] = (stageFloorRef[s] || 0) + 1; });
});
for (const id of Object.keys(D.stages)) if (!stageFloorRef[id]) err('stage ' + id + ' is not referenced by any floor');
// boss unlocks per DESIGN Update 2 (no companion unlocks any more)
const PLAN = { hoarder: 'carl_jacket', juicer: null, ringmaster: 'carl_clown', engineer: null,
  tidemother: 'carl_hazmat', butcher: null, bride: 'carl_bodyguard', overseer: 'carl_kilt', showrunner: 'carl_gold' };
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
D.floors.forEach(f => Object.values(f.locks || {}).forEach(l => { qiUsed[l.needs] = true; }));
for (const [id, q] of Object.entries(QI)) {
  const w = 'questItems.' + id;
  text(w + '.name', q.name, 22); text(w + '.desc', q.desc, 120); text(w + '.hint', q.hint, 140);
  if (!(q.floor >= 2 && q.floor <= 9)) err(w + ': floor must be 2-9');
  if (!QI_SPRITES.includes(q.sprite)) err(w + ': sprite ' + q.sprite + ' not in qi_* art list');
  const where = qiWhere[id] || [];
  if (where.length !== 1) err(w + ': placed in ' + where.length + ' stages (want exactly 1): ' + where.join(','));
  if (!qiUsed[id]) warn(w + ': never needed by a lock or exit');
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
    if (!l || !l.needs) { err(w + '.locks.' + ch + ': needs missing'); continue; }
    if (!QI[l.needs]) err(w + '.locks.' + ch + ': item ' + l.needs + ' not in questItems');
    else if (!has(l.needs)) err(w + '.locks.' + ch + ': item ' + l.needs + ' not obtainable on this floor');
    if (l.text != null) text(w + '.locks.' + ch + '.text', l.text, 100);
  }
  for (const sid of floorStages) { const s = D.stages[sid]; if (s.exitNeeds && !has(s.exitNeeds)) err('stages.' + sid + ': exitNeeds ' + s.exitNeeds + ' not obtainable on its floor'); }

  const held = new Set(), entered = new Set(), cleared = new Set(), rescued = new Set(), order = [];
  const visit = (sid) => {
    const s = D.stages[sid];
    if (!entered.has(sid)) { entered.add(sid); order.push(sid); }
    if (s.questItem && !held.has(s.questItem)) { held.add(s.questItem); order.push('+' + s.questItem); }
    if (s.rescue && !rescued.has(s.rescue)) { rescued.add(s.rescue); order.push('@' + s.rescue); }
    if (!s.exitNeeds || held.has(s.exitNeeds)) cleared.add(sid);
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
    for (const [ch, l] of Object.entries(locks)) { const sid = ents[ch]; const s = D.stages[sid]; if (s && s.questItem && s.questItem === l.needs) err(w + ': item ' + l.needs + ' sits inside ' + sid + ', which needs it to enter'); }
    if (f.n >= 3) {
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
        if (locks[ch] && !held.has(locks[ch].needs)) continue;
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
if (nAch < 35 || nAch > 50) err('achievements: ' + nAch + ' (want 35-50)');
for (const [id, a] of Object.entries(D.achievements)) {
  const w = 'achievements.' + id;
  text(w + '.name', a.name, 24); text(w + '.desc', a.desc);
  const ev = a.event || '';
  const ok = EVENTS.includes(ev) || (/^kill:/.test(ev) && D.enemies[ev.slice(5)]) || (/^boss:/.test(ev) && D.bosses[ev.slice(5)]) ||
    /^floor:[1-9]$/.test(ev) || /^level:\d+$/.test(ev);
  if (!ok) err(w + ': bad event ' + ev);
  if (!(a.count >= 1)) err(w + ': count');
  if (!TIERS.includes(a.box)) err(w + ': box tier');
  if (a.unlock) { if (a.unlock.skin && !SKINS.includes(a.unlock.skin)) err(w + ': unlock skin'); if (a.unlock.companion) err(w + ': companion unlocks are not allowed (companions are rescued)'); }
}
for (const b of BOSS_IDS) if (!Object.values(D.achievements).some(a => a.event === 'boss:' + b)) warn('no achievement for boss ' + b);

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

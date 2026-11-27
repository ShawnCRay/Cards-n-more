#!/usr/bin/env node
// Validates crawler2/js/data.js (book 2) against crawler2/DESIGN.md section 6 + the lead's field notes.
// Usage: node crawler2/tools/data_validate.js [--quiet] [--flow] [--render <levelId|areaId|chunkId>]
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const DATA = path.resolve(__dirname, '../js/data.js');
const ctx = { window: {}, console };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(DATA, 'utf8'), ctx, { filename: 'data.js' });
const D = ctx.window.DCW && ctx.window.DCW.data;
const argv = process.argv.slice(2);
const quiet = argv.includes('--quiet');
const errors = [], warns = [];
const err = (m) => errors.push(m);
const warn = (m) => warns.push(m);
if (!D) { console.log('DCW.data missing'); process.exit(1); }
const has = (o, k) => o && Object.prototype.hasOwnProperty.call(o, k);

/* ---------------- fixed lists from DESIGN.md ---------------- */
const SIDE_THEMES = 'village ruins circus basement settlement alley admin office nest ymca school depot escape restroom temple'.split(' ');
const BACKDROPS = 'inn_pug inn_narwhal club studio greenroom guide_room'.split(' ');
const LEVEL_THEMES = SIDE_THEMES.concat(['bigtop', 'studio']);
const PANELS = ('guide_room arrival circus_night signet_tattoos carl_tent heather_skates bigtop_vine grimaldi_peace settlement_view desperado ' +
  'danger_zone trailer_blast quill_desk featherfall remex glass_case doomsday bursts stairwell greenroom').split(' ');
const AREA_IDS = 'village ruins_w circus_park ruins_e settlement admin east_stairs'.split(' ');
const LEVEL_IDS = ('a1_lemurs a1_bodies a1_collapse a1_lions a1_solo a1_heather a1_bigtop a1_barricade a2_dispenser a2_mongo a2_alley ' +
  'a2_divider a2_danger_zone a2_apito a2_alley_night a3_climb a3_plant a3_nest a3_depot a3_escape').split(' ');
const OPT_LEVELS = 'x_temple x_restroom x_park'.split(' ');
const KINDS = 'side chase climb drop survival plant escape boss facade rooms show'.split(' ');
const ENEMY_AI = {
  lemur: 'perch', stilt_clown: 'stilt', fat_clown: 'jumper', mold_lion: 'charger', giraffe: 'launcher', street_urchin: 'urchin',
  brain_boiler: 'floater', berserker: 'berserker', city_elf: 'caster', wand_bearer: 'caster', krasue: 'krasue', shadow_leak: 'swarm',
  incubus: 'charm', ruin_flocker: 'flyer', guard: 'guard', citizen_human: 'citizen', citizen_skyfowl: 'citizen', chickadee: 'citizen'
};
const ENEMY_IDS = Object.keys(ENEMY_AI);
const BOSS_IDS = 'heather dispenser vincente terror_big'.split(' ');
const PROJ_SPRITES = 'knife bolt worm spit dyn_stick hob jug psionic missile arrow rock fireball bubble bottle laser_orb spore note'.split(' ');
const REQ_PROJ = 'knife bolt worm spit psionic missile'.split(' ');
const EXPLOSIVES = 'jug hob dyn smoke'.split(' ');
const QI_SPRITES = 'qi_ticket qi_key qi_letter qi_pass qi_ring qi_anklet qi_crown qi_case qi_crystal qi_moonshine qi_custard qi_scroll qi_carrier qi_caps'.split(' ');
const SKINS = 'carl_f3 carl_boxers carl_jacket carl_bodyguard carl_kilt carl_hazmat carl_pajamas carl_clown carl_toga carl_gold carl_magistrate carl_primal'.split(' ');
const PERKS = 'dmg def hp speed gold views bombs doubleJump'.split(' ');
const MUSIC = ('title intro village village_night ruins ruins_night circus bigtop heather boss settlement market club show dark climb escape ' +
  'inn cutscene sad results gameover lootbox ending credits').split(' ');
const SFX = ('jump land punch kick hit crit enemy_die hurt coin pickup bomb_throw explosion missile bite shield menu_move menu_select menu_back ' +
  'lootbox_shake lootbox_open unlock level_up door boss_roar boss_die achievement stairs death heal block buy error text_blip pause ' +
  'checkpoint crate_break spawn laser warn stomp splash fanfare views ' +
  'plant detonate fuse fire_burst launch smoke_puff fear clockwork teleport krasue_shriek urchin_roll psionic guard_alarm crime bell_day ' +
  'bell_night applause laugh boo meter burst glass_crack countdown_tick skate_roll calliope_stab worm_squish ticket_scratch drunk_hiccup').split(' ');
const PORTRAITS = ('p_carl p_donut p_mongo p_mordecai p_katia p_signet p_grimaldi p_apollon p_clammy p_heather p_gordo p_fitz p_clarabelle ' +
  'p_quint p_pustule p_gumgum p_vincente p_quill p_burgundy p_remex p_bautista p_hekla p_ripper p_zev p_odette p_lucia p_ai p_eunice ' +
  'p_edge_dancer p_talon p_lucky').split(' ');
const NPC_SPRITES = ('mordecai gordo fitz lucky edge_dancer talon pustule clarabelle quint gumgum signet grimaldi_face apollon bautista burgundy ' +
  'quill featherfall remex hekla ripper manasa tucker dnadia zev odette lucia eunice ricky_joe ai_screen').split(' ');
const OBJ_SPRITES = ('door_inn door_shop door_pub door_club door_wood door_school door_admin manhole tent_flap gate trailer stairs_down alley_mouth ' +
  'signpost signpost_on charge charge_spot decoy_mongo detonator krasue_body trash barricade barricade_broken guard_statue tent_pole ' +
  'scratch_ticket custard ring_junk fire darkness_orb lock crate chest door door_open door_locked checkpoint sign cage cage_broken lever').split(' ');
const ACTOR_SPRITES = new Set([].concat(
  'carl_idle carl_run carl_jump carl_fall carl_punch carl_kick carl_airkick carl_throw carl_hurt carl_dead carl_climb carl_victory carl_launch carl_plant carl_charmed carl_crouch'.split(' '),
  'carl_back_idle carl_back_run carl_back_throw carl_back_jump carl_back_hurt'.split(' '),
  'donut_shoulder donut_cast donut_idle donut_run donut_down'.split(' '),
  'mongo_idle mongo_run mongo_act mongo_big_idle mongo_big_run mongo_big_act mongo_clock_run mongo_jump mongo_hurt'.split(' '),
  'katia_idle katia_run katia_act'.split(' '),
  NPC_SPRITES, OBJ_SPRITES,
  ...ENEMY_IDS.map(id => [id + '_walk', id + '_attack', id + '_hurt']),
  ...BOSS_IDS.map(id => [id + '_idle', id + '_walk', id + '_attack', id + '_hurt', id + '_special']),
  'dispenser_body dispenser_eye dispenser_mouth dispenser_wing'.split(' ')
));
const DOOR_KINDS = 'level area inn shop club stairs npc cinema'.split(' ');
const TIER_EVENTS = ('kill stomp kick bomb_kill multi_bomb crate coin fall combo10 combo25 no_damage_stage secret level_clear quest_start quest_done ' +
  'rest craft shop box_open death revive flee crime banned win early import night day potion pet_donut ' +
  'boomy_boy mic_drop panic plant krasue_body regrow_burn second_chance').split(' ');
const STATS = 'str con dex int'.split(' ');

const CHUNK_CHARS = new Set('. #X=^~Hbohm?eEfPDK<>vcn$QRSLpNCYTktwGB'.split(''));
const DOOR_CHARS = new Set('0123456789ABCDEF'.split(''));
const SOLID = new Set(['#', 'X', 'b', 'G']);
const SUPPORT = new Set(['#', 'X', 'b', '=', 'H', 'G']);
const HAZARD = new Set(['^', '~']);
const STANDERS = 'eEPDKcn$?SRNCYTktwGBp';
const GLYPHS = '♥▶◀▼▲★×←↑→↓●☠✓';
const TEXT_RE = new RegExp('^[A-Z0-9 .,!?\'":;\\-+/()%*#$<>=_&@\\[\\]~|' + GLYPHS + ']*$');

/* ---------------- text checks ---------------- */
let textCount = 0;
function text(where, s, max) {
  if (typeof s !== 'string') { err(where + ': not a string'); return; }
  if (!s.length) { err(where + ': empty text'); return; }
  textCount++;
  if (/[–—]/.test(s)) err(where + ': em/en dash in "' + s.slice(0, 50) + '"');
  if (!TEXT_RE.test(s)) {
    const bad = [...new Set(s.split('').filter(c => !TEXT_RE.test(c)))].join('');
    err(where + ': illegal chars [' + bad + '] in "' + s.slice(0, 50) + '"');
  }
  const lim = max || 160;
  if (s.length > lim) err(where + ': ' + s.length + ' chars > ' + lim + ': "' + s.slice(0, 40) + '..."');
}
function texts(where, arr, min, max) {
  if (!Array.isArray(arr)) { err(where + ': not an array'); return; }
  if (min && arr.length < min) err(where + ': only ' + arr.length + ' entries (want ' + min + '+)');
  arr.forEach((s, i) => text(where + '[' + i + ']', s, max));
}
function lines(where, arr, min) {
  if (!Array.isArray(arr)) { err(where + ': lines not an array'); return; }
  if (min && arr.length < min) err(where + ': only ' + arr.length + ' lines');
  arr.forEach((l, i) => {
    if (typeof l === 'string') { text(where + '[' + i + ']', l); return; }
    if (!l || typeof l !== 'object') { err(where + '[' + i + ']: bad line'); return; }
    text(where + '[' + i + '].who', l.who, 24); text(where + '[' + i + '].text', l.text);
  });
}

/* ---------------- flags: producible set ---------------- */
const PRODUCED = new Map();   // flag -> [sources]
function produce(flag, src) { if (!PRODUCED.has(flag)) PRODUCED.set(flag, []); PRODUCED.get(flag).push(src); }
for (const [id, l] of Object.entries(D.levels || {})) (l.sets || []).forEach(f => produce(f, 'level ' + id));
(D.events || []).forEach(e => (e.sets || []).forEach(f => produce(f, 'event ' + e.id)));
AREA_IDS.forEach(a => produce('map_' + a, 'signpost'));
const USED_FLAGS = new Map();
function useFlag(f, where) {
  if (f === undefined || f === null) return;
  if (Array.isArray(f)) { f.forEach(x => useFlag(x, where)); return; }
  if (typeof f !== 'string') { err(where + ': flag not a string'); return; }
  if (!PRODUCED.has(f)) err(where + ': flag "' + f + '" is never set by any level or event');
  if (!USED_FLAGS.has(f)) USED_FLAGS.set(f, []); USED_FLAGS.get(f).push(where);
}
const FIXED_FLAGS = 'freeballing xistera fang_caps mongo_big katia_joined'.split(' ');
FIXED_FLAGS.forEach(f => { if (!PRODUCED.has(f)) err('fixed gameplay flag "' + f + '" is never set'); });

/* ---------------- meta ---------------- */
const M = D.meta || {};
if (!M.startArea || !(D.areas || {})[M.startArea]) err('meta.startArea missing/unknown');
['title', 'subtitle'].forEach(k => text('meta.' + k, M[k], 40));
if (M.startHours !== 192) warn('meta.startHours ' + M.startHours + ' (DESIGN says 192)');

/* ---------------- enemies / projectiles / bosses ---------------- */
const E = D.enemies || {};
for (const id of ENEMY_IDS) if (!E[id]) err('enemy missing: ' + id);
for (const [id, e] of Object.entries(E)) {
  const w = 'enemies.' + id;
  if (!ENEMY_AI[id]) err(w + ': id not in DESIGN enemy list (no art)');
  else if (e.ai !== ENEMY_AI[id]) err(w + ': ai ' + e.ai + ' (DESIGN says ' + ENEMY_AI[id] + ')');
  if (e.sprite !== id) err(w + ': sprite must equal id (art draws <id>_walk)');
  for (const k of ['hp', 'dmg', 'speed', 'w', 'h', 'xp']) if (typeof e[k] !== 'number') err(w + ': ' + k + ' not a number');
  if (!Array.isArray(e.gold) || e.gold.length !== 2) err(w + ': gold must be [min,max]');
  if (e.projectile && !D.projectiles[e.projectile]) err(w + ': projectile ' + e.projectile + ' missing');
  if (['perch', 'floater', 'caster'].includes(e.ai) && !e.projectile) err(w + ': ' + e.ai + ' without projectile');
  if ((e.ai === 'launcher') && !E[e.spawn]) err(w + ': launcher spawn missing');
  if (e.citizen && (e.xp !== 0 || e.ai !== 'citizen')) err(w + ': citizens give 0 xp and use ai citizen');
  if (e.flying === undefined && ['flyer', 'floater', 'swarm', 'krasue'].includes(e.ai)) warn(w + ': flying ai without flying:true');
  if (!(e.tier >= 1 && e.tier <= 3)) err(w + ': tier must be 1-3');
  text(w + '.name', e.name, 26); text(w + '.flavor', e.flavor);
}
if (!E.krasue || !E.krasue.magicOnly || !E.krasue.bodyHp) err('enemies.krasue: needs magicOnly + bodyHp');
if (!E.shadow_leak || !E.shadow_leak.magicOnly) err('enemies.shadow_leak: needs magicOnly');
if (!E.berserker || E.berserker.darkMul !== 4) err('enemies.berserker: darkMul 4');
if (!E.mold_lion || !E.mold_lion.regrow) err('enemies.mold_lion: regrow');
if (!E.street_urchin || !E.street_urchin.neutral) err('enemies.street_urchin: neutral');
if (!E.stilt_clown || !E.stilt_clown.fearImmune) err('enemies.stilt_clown: fearImmune');
for (const id of REQ_PROJ) if (!D.projectiles[id]) err('projectile missing: ' + id);
for (const [id, p] of Object.entries(D.projectiles)) {
  if (!PROJ_SPRITES.includes(p.sprite)) err('projectiles.' + id + ': sprite not in art list');
  for (const k of ['w', 'h', 'speed', 'dmg', 'gravity', 'life']) if (typeof p[k] !== 'number') err('projectiles.' + id + ': ' + k);
}
if (!D.enemyFor || !D.enemyFor('city_elf', 3) || D.enemyFor('city_elf', 3).hp <= E.city_elf.hp) err('enemyFor helper broken');
const PRIM = /^(walk|idle|hover):\d+(\.\d+)?$|^(charge|jump_slam|swoop|teleport|laser|shockwave|summon_spikes|worms|meat_hooks|darkness|cloak|reveal|sweep)$|^(shoot|spread|rain|spit):[a-z_]+:\d+$|^spawn:[a-z_]+:\d+$/;
const TIERS = Object.keys(D.boxTiers || {});
for (const id of BOSS_IDS) if (!D.bosses[id]) err('boss missing: ' + id);
for (const [id, b] of Object.entries(D.bosses)) {
  const w = 'bosses.' + id;
  if (!BOSS_IDS.includes(id)) err(w + ': id not in DESIGN boss list');
  if (b.sprite !== id) err(w + ': sprite must equal id');
  text(w + '.name', b.name, 24); text(w + '.title', b.title, 40); texts(w + '.intro', b.intro, 1); text(w + '.defeat', b.defeat);
  if (!TIERS.includes(b.loot)) err(w + ': loot tier ' + b.loot);
  if (b.unlock && b.unlock.skin && !SKINS.includes(b.unlock.skin)) err(w + ': unlock skin ' + b.unlock.skin);
  if (b.curedLines) lines(w + '.curedLines', b.curedLines, 1);
  if (!b.phases || !b.phases.length || b.phases[0].below !== 1) err(w + ': first phase must have below 1.0');
  let last = 2;
  (b.phases || []).forEach((ph, i) => {
    if (!(ph.below < last)) err(w + '.phases[' + i + ']: below must decrease');
    last = ph.below;
    ph.pattern.forEach(mv => {
      if (!PRIM.test(mv)) { err(w + ': bad move "' + mv + '"'); return; }
      const p = mv.split(':');
      if (['shoot', 'spread', 'rain', 'spit'].includes(p[0]) && !D.projectiles[p[1]]) err(w + ': move projectile ' + p[1] + ' missing');
      if (p[0] === 'spawn' && !E[p[1]]) err(w + ': spawn enemy ' + p[1] + ' missing');
      if (!b.facade && ['cloak', 'reveal', 'sweep', 'spit'].includes(p[0])) warn(w + ': facade move ' + mv + ' on a non-facade boss');
    });
  });
}
if (!D.bosses.heather || !(D.bosses.heather.phases || []).some(p => p.pattern.includes('worms'))) err('bosses.heather: needs a worms phase');
if (!D.bosses.vincente || !(D.bosses.vincente.phases || []).some(p => p.pattern.includes('meat_hooks'))) err('bosses.vincente: needs meat_hooks');
if (!D.bosses.dispenser || !D.bosses.dispenser.facade) err('bosses.dispenser: facade:true');

/* ---------------- items, recipes, shops, inns ---------------- */
const I = D.items || {};
for (const id of EXPLOSIVES) if (!I[id] || I[id].kind !== 'explosive') err('items.' + id + ': explosive missing');
for (const [id, it] of Object.entries(I)) {
  const w = 'items.' + id;
  if (!['explosive', 'material', 'key'].includes(it.kind)) err(w + ': bad kind ' + it.kind);
  if (it.kind === 'explosive' && !EXPLOSIVES.includes(id)) err(w + ': explosive ids are fixed (jug hob dyn smoke)');
  if (it.kind !== 'explosive' && !QI_SPRITES.includes(it.sprite)) err(w + ': sprite ' + it.sprite + ' not in the qi_* list');
  if (it.kind === 'explosive' && !['jug', 'hob', 'dyn', 'smoke'].includes(it.icon)) err(w + ': icon');
  if (it.bonus) for (const k of Object.keys(it.bonus)) if (!STATS.concat(['hp']).includes(k)) err(w + ': bonus key ' + k);
  text(w + '.name', it.name, 32); text(w + '.desc', it.desc);
}
const ITEM_REWARD_IDS = ['potion'].concat(Object.keys(I).filter(k => I[k].kind !== 'key'));
for (const [id, r] of Object.entries(D.recipes || {})) {
  const w = 'recipes.' + id;
  text(w + '.name', r.name, 32); if (r.desc) text(w + '.desc', r.desc);
  for (const k of Object.keys(r.needs || {})) if (!I[k]) err(w + ': needs unknown item ' + k);
  for (const k of Object.keys(r.gives || {})) if (!I[k]) err(w + ': gives unknown item ' + k);
}
if (!(D.recipes || {}).jug || !(D.recipes.jug.needs || {}).moonshine) err('recipes.jug must need moonshine');
function checkGive(where, g) {
  if (!g || typeof g !== 'object') { err(where + ': bad give'); return; }
  if (g.item !== undefined) { if (!I[g.item]) err(where + ': unknown item ' + g.item); if (g.n !== undefined && !(g.n > 0)) err(where + ': n'); }
  else if (g.potion !== undefined) { if (!(g.potion > 0)) err(where + ': potion count'); }
  else if (g.gold !== undefined) { if (!(g.gold > 0)) err(where + ': gold'); }
  else if (g.box !== undefined) { if (!TIERS.includes(g.box)) err(where + ': box tier ' + g.box); }
  else if (g.skin !== undefined) { if (!SKINS.includes(g.skin)) err(where + ': skin ' + g.skin); }
  else if (g.gear !== undefined) { if (!(D.gear || {})[g.gear]) err(where + ': unknown gear ' + g.gear); }
  else err(where + ': give needs item|potion|gold|box|skin|gear');
}
const SHOP_IDS = 'lucky pustule quint edge_dancer talon'.split(' ');
for (const id of SHOP_IDS) if (!(D.shops || {})[id]) err('shop missing: ' + id);
for (const [id, s] of Object.entries(D.shops || {})) {
  const w = 'shops.' + id;
  text(w + '.name', s.name, 40); text(w + '.keeper', s.keeper, 24);
  if (!NPC_SPRITES.includes(s.sprite)) err(w + ': sprite ' + s.sprite);
  if (s.portrait && !PORTRAITS.includes(s.portrait)) err(w + ': portrait ' + s.portrait);
  if (!Array.isArray(s.items) || !s.items.length) err(w + ': no items');
  const ids = new Set();
  (s.items || []).forEach((it, i) => {
    const ww = w + '.items[' + i + ']';
    if (ids.has(it.id)) err(ww + ': dup id'); ids.add(it.id);
    if (!(it.price > 0)) err(ww + ': price'); text(ww + '.name', it.name, 32); text(ww + '.desc', it.desc);
    checkGive(ww + '.give', it.give);
  });
  if (s.lines) texts(w + '.lines', s.lines, 1);
}
if (!D.inns || !D.inns.pug || D.inns.pug.price !== 10) err('inns.pug price 10');
if (!D.inns || !D.inns.narwhal || D.inns.narwhal.price !== 20) err('inns.narwhal price 20');
for (const [id, inn] of Object.entries(D.inns || {})) {
  text('inns.' + id + '.name', inn.name, 32);
  if (!NPC_SPRITES.includes(inn.keeper)) err('inns.' + id + ': keeper sprite ' + inn.keeper);
  if (inn.theme && !BACKDROPS.includes(inn.theme)) err('inns.' + id + ': theme ' + inn.theme);
  if (inn.lines) texts('inns.' + id + '.lines', inn.lines, 1);
}

/* ---------------- loot, skins, achievements, titles ---------------- */
const REQ_TIERS = 'bronze silver gold platinum legendary fan boss earth quest_silver quest_gold quest_platinum lucky_bastard assassin tyrant celestial'.split(' ');
for (const t of REQ_TIERS) if (!D.boxTiers[t]) err('boxTiers missing ' + t);
for (const [t, bt] of Object.entries(D.boxTiers)) {
  text('boxTiers.' + t + '.name', bt.name, 32);
  if (!/^#[0-9a-f]{6}$/i.test(bt.color || '')) err('boxTiers.' + t + ': color');
  if (!D.lootTables[t]) err('lootTables missing ' + t);
}
if (!D.boxTiers.fan || D.boxTiers.fan.name !== 'GOLD FAN BOX') err('boxTiers.fan must be the GOLD FAN BOX');
function checkReward(where, r) {
  if (!r || typeof r !== 'object') { err(where + ': bad reward'); return; }
  switch (r.kind) {
    case 'gold': if (!(r.min > 0 && r.max >= r.min)) err(where + ': gold min/max'); break;
    case 'item': if (!ITEM_REWARD_IDS.includes(r.id)) err(where + ': item id ' + r.id); if (!(r.count > 0)) err(where + ': count'); break;
    case 'skin': if (!r.any && !SKINS.includes(r.id)) err(where + ': skin'); break;
    case 'stat': if (!r.any && !STATS.includes(r.stat)) err(where + ': stat'); if (!(r.amount > 0)) err(where + ': amount'); break;
    case 'xp': case 'hp': if (!(r.amount > 0)) err(where + ': amount'); break;
    default: err(where + ': kind ' + r.kind);
  }
}
for (const [t, lt] of Object.entries(D.lootTables)) {
  if (!D.boxTiers[t]) err('lootTables.' + t + ': no tier');
  if (!(lt.rolls > 0)) err('lootTables.' + t + ': rolls');
  (lt.entries || []).forEach((en, i) => { checkReward('lootTables.' + t + '[' + i + ']', en[0]); if (!(en[1] > 0)) err('lootTables.' + t + '[' + i + ']: weight'); });
  (lt.guaranteed || []).forEach((r, i) => checkReward('lootTables.' + t + '.guaranteed[' + i + ']', r));
}
for (const id of SKINS) if (!D.skins[id]) err('skin missing: ' + id);
for (const [id, s] of Object.entries(D.skins)) {
  if (!SKINS.includes(id)) err('skins.' + id + ': not a DESIGN skin id');
  text('skins.' + id + '.name', s.name, 24); text('skins.' + id + '.desc', s.desc); text('skins.' + id + '.how', s.how);
  if (s.perk) for (const k of Object.keys(s.perk)) if (!PERKS.includes(k)) err('skins.' + id + ': perk ' + k);
}
const BOOK_ACH = ["IT'S ELEMENTARY, MY DEAR CRAWLER!", 'MEET AN ELITE!', 'LAZARUS!', "YOU CAN'T FIGHT CITY HALL!", 'ONE QUADRILLION!',
  'YELLOW-BELLIED CHICKENSHIT!', 'JOHNNY QUEST!', 'HADJI!', 'ASSASSIN!', 'ULTIMATE EXTREME POWER!', 'COCKBLOCK!', 'BANDIT!', 'EARLY BIRD GETS TO SQUIRM!'];
const achNames = Object.values(D.achievements).map(a => a.name);
BOOK_ACH.forEach(n => { if (!achNames.includes(n)) err('achievement missing: ' + n); });
function checkEvent(where, ev) {
  if (TIER_EVENTS.includes(ev)) return;
  const m = /^([a-z_]+):(.+)$/.exec(ev || '');
  if (!m) { err(where + ': unknown event ' + ev); return; }
  const [, k, v] = m;
  if (k === 'kill' && !E[v]) err(where + ': kill:' + v + ' unknown enemy');
  else if (k === 'boss' && !D.bosses[v]) err(where + ': boss:' + v + ' unknown');
  else if (k === 'clear' && !D.levels[v]) err(where + ': clear:' + v + ' unknown level');
  else if (k === 'flag') useFlag(v, where);
  else if (k === 'quest_done' && !D.quests[v]) err(where + ': quest_done:' + v + ' unknown quest');
  else if (k === 'level' && !(+v > 13)) err(where + ': level:' + v);
  else if (!['kill', 'boss', 'clear', 'flag', 'quest_done', 'level'].includes(k)) err(where + ': unknown event ' + ev);
}
for (const [id, a] of Object.entries(D.achievements)) {
  const w = 'achievements.' + id;
  text(w + '.name', a.name, 36); text(w + '.desc', a.desc);
  checkEvent(w, a.event);
  if (!(a.count >= 1)) err(w + ': count');
  if (a.box !== null && !TIERS.includes(a.box)) err(w + ': box ' + a.box);
  if (a.unlock && a.unlock.skin && !SKINS.includes(a.unlock.skin)) err(w + ': unlock skin');
}
const own = Object.keys(D.achievements).length - BOOK_ACH.length;
if (own < 15) warn('only ' + own + ' original achievements (want 15-25)');
(D.titles || []).forEach((t, i) => { text('titles[' + i + ']', t.name, 26); if (i && !(t.views > D.titles[i - 1].views)) err('titles: views must increase'); });
if (!D.legacy || !TIERS.includes(D.legacy.veteranBox) || !TIERS.includes(D.legacy.championBox)) err('legacy boxes');
else { text('legacy.title', D.legacy.title, 24); if (D.legacy.lines) lines('legacy.lines', D.legacy.lines); }

/* ---------------- chunks ---------------- */
function cell(rows, x, y) { if (y < 0) return '.'; if (y >= rows.length || x < 0 || x >= rows[0].length) return null; return rows[y][x]; }
function solidAt(rows, x, y) { const c = cell(rows, x, y); if (c === null) return true; if (SOLID.has(c)) return true; if (cell(rows, x, y + 1) === 'G') return true; return false; }
// approximate platformer reachability (jump <= 3 up, <= 4 across when rising 2+, <= 5 flat/down)
function reach(rows0, starts, breakCrates) {
  const rows = breakCrates ? rows0.map(r => r.replace(/b/g, '.')) : rows0;
  const H = rows.length, W = rows[0].length;
  const sup = rows.map(r => r.split('').map(c => SUPPORT.has(c)));
  rows.forEach((r, y) => r.split('').forEach((c, x) => {
    if (c === '<' || c === '>') for (let dx = -4; dx <= 4; dx++) if (x + dx >= 0 && x + dx < W) sup[y][x + dx] = true;
    if (c === 'v') for (let dy = -3; dy <= 3; dy++) for (let dx = -1; dx <= 1; dx++) { const yy = y + dy, xx = x + dx; if (yy >= 0 && yy < H && xx >= 0 && xx < W && !SOLID.has(rows[yy][xx])) sup[yy][xx] = true; }
    if (c === 'G' && y > 0) sup[y - 1][x] = true;   // a statue is 2 tiles tall; stand on its head
  }));
  const free = (x, y) => { const c = cell(rows, x, y); return c !== null && !solidAt(rows, x, y); };
  const valid = (x, y) => x >= 0 && x < W && y >= 0 && y < H && free(x, y) && free(x, y - 1);
  const supported = (x, y) => rows[y][x] === 'H' || (y + 1 < H && sup[y + 1][x]);
  function fall(x, y) { while (y < H) { if (!valid(x, y)) return -2; if (supported(x, y)) return y; y++; } return -1; }
  const seen = new Set(), q = [];
  const push = (x, y) => { const k = x + ',' + y; if (!seen.has(k)) { seen.add(k); q.push([x, y]); } };
  starts.forEach(s => { const y = fall(s[0], s[1]); if (y >= 0) push(s[0], y); });
  while (q.length) {
    const [x, y] = q.shift();
    for (const dx of [-1, 1]) {
      const nx = x + dx;
      if (valid(nx, y)) { const ly = fall(nx, y); if (ly >= 0) push(nx, ly); }
      else if (valid(nx, y - 1) && supported(nx, y - 1)) push(nx, y - 1);
    }
    if (rows[y][x] === 'H' && valid(x, y - 1)) push(x, y - 1);
    if (y + 1 < H && rows[y + 1][x] === 'H' && valid(x, y + 1)) push(x, y + 1);
    if (y + 1 < H && rows[y + 1][x] === '=') { const ly = fall(x, y + 2); if (ly >= 0 && valid(x, y + 2)) push(x, ly); }
    for (let tx = Math.max(0, x - 5); tx <= Math.min(W - 1, x + 5); tx++) {
      for (let ty = Math.max(0, y - 3); ty <= Math.min(H - 1, y + 4); ty++) {
        const dx = Math.abs(tx - x), up = y - ty;
        if (dx > (up > 1 ? 4 : 5)) continue;
        if (!valid(tx, ty)) continue;
        const apex = Math.min(y, ty);
        let ok = true;
        for (let yy = apex - 1; yy <= y && ok; yy++) if (!free(x, yy)) ok = false;
        const s = Math.sign(tx - x);
        for (let xx = x; xx !== tx + s && ok; xx += (s || 1)) { if (!free(xx, apex) || !free(xx, apex - 1)) ok = false; if (!s) break; }
        for (let yy = apex - 1; yy <= ty && ok; yy++) if (!free(tx, yy)) ok = false;
        if (!ok) continue;
        const ly = fall(tx, ty); if (ly >= 0) push(tx, ly);
      }
    }
  }
  return seen;
}
const near = (S, x, y, up) => { for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= (up || 1); dy++) if (S.has((x + dx) + ',' + (y + dy))) return true; return false; };
const count = (rows, c) => rows.join('').split(c).length - 1;

function checkStanders(w, rows, allowDoors) {
  rows.forEach((r, y) => r.split('').forEach((c, x) => {
    if (/[0-9]/.test(c) && !allowDoors) err(w + ': door char "' + c + '" only belongs in street rows');
    if (STANDERS.includes(c) || (allowDoors && DOOR_CHARS.has(c))) {
      const below = cell(rows, x, y + 1);
      if (!below || !SUPPORT.has(below)) err(w + ': "' + c + '" at ' + x + ',' + y + ' has no ground below');
    }
    if ('eEPDKRNCTkG'.includes(c) || (allowDoors && DOOR_CHARS.has(c))) {
      const up = cell(rows, x, y - 1);
      if (up && (SOLID.has(up) || up === 'L')) err(w + ': "' + c + '" at ' + x + ',' + y + ' has no headroom');
    }
    if (c === '<' || c === '>') for (let dx = -3; dx <= 3; dx++) { const cc = cell(rows.map(r2 => r2.replace(/L/g, '.')), x + dx, y); if (cc === null || SOLID.has(cc)) err(w + ': moving platform at ' + x + ',' + y + ' blocked'); }
    if (c === 'v') for (let dy = -3; dy <= 3; dy++) { const cc = cell(rows, x, y + dy); if (cc === null || SOLID.has(cc)) err(w + ': v platform at ' + x + ',' + y + ' blocked at dy ' + dy); }
  }));
}

const CH = D.chunks || {};
for (const [id, ch] of Object.entries(CH)) {
  const w = 'chunks.' + id, rows = ch.rows;
  if (!Array.isArray(rows) || rows.length !== 12) { err(w + ': must have 12 rows'); continue; }
  const W = rows[0].length;
  if (W < 16 || W > 48) err(w + ': width ' + W + ' outside 16-48');
  let bad = false;
  rows.forEach((r, y) => {
    if (r.length !== W) { err(w + ': row ' + y + ' width ' + r.length + ' != ' + W); bad = true; }
    for (const c of r) if (!CHUNK_CHARS.has(c)) err(w + ': illegal char "' + c + '" row ' + y);
  });
  if (bad) continue;
  if (ch.theme && !SIDE_THEMES.includes(ch.theme)) err(w + ': theme ' + ch.theme);
  const isArena = rows.some(r => r.includes('K'));
  const walled = rows.some(r => r.includes('w'));   // survival screen, walls both sides
  for (const x of [0, W - 1]) {
    if (rows[10][x] !== '#' || rows[11][x] !== '#') err(w + ': edge col ' + x + ' rows 10-11 must be #');
    if ((isArena && x === W - 1) || walled) continue;
    for (let y = 5; y <= 9; y++) { const c = rows[y][x]; if (SOLID.has(c) || HAZARD.has(c) || c === 'L') err(w + ': edge col ' + x + ' row ' + y + ' blocked "' + c + '"'); }
  }
  checkStanders(w, rows, false);
  const closedRows = rows.map(r => r.replace(/L/g, 'X')), openRows = rows.map(r => r.replace(/L/g, '.'));
  ch._P = count(rows, 'P');
  const starts = ch._P ? [] : [[0, 9], [1, 9]];
  rows.forEach((r, y) => { const x = r.indexOf('P'); if (x >= 0) starts.push([x, y]); });
  const seen0 = reach(openRows, starts, false), seen = reach(openRows, starts, true);
  const right = (S) => [...S].some(k => +k.split(',')[0] === W - 1);
  if (!isArena && !walled && !right(seen)) err(w + ': right edge not reachable from left edge');
  else if (!isArena && !walled && !right(seen0) && !quiet) warn(w + ': right edge needs crates broken');
  rows.forEach((r, y) => r.split('').forEach((c, x) => {
    if ('?D$KRNCYTkS'.includes(c) && !near(seen, x, y)) err(w + ': "' + c + '" at ' + x + ',' + y + ' not reachable');
  }));
  const nL = count(rows, 'L'), nS = count(rows, 'S');
  if (nL && !nS) err(w + ': has L gate tiles but no S lever');
  if (nS && !nL) warn(w + ': lever S without any L gate');
  if (nL && nS) {
    const shut = reach(closedRows, starts, true);
    let lever = false;
    rows.forEach((r, y) => r.split('').forEach((c, x) => { if (c === 'S' && near(shut, x, y)) lever = true; }));
    if (!lever) err(w + ': no S lever reachable from the left edge without crossing L');
    let guards = !isArena && right(seen) && !right(shut);
    rows.forEach((r, y) => r.split('').forEach((c, x) => { if ('QR?$ohmkCN'.includes(c) && near(seen, x, y) && !near(shut, x, y)) guards = true; }));
    if (!guards) warn(w + ': gate L guards nothing');
  }
  ch._used = 0;
}

/* ---------------- vertical layouts (climb / drop) ---------------- */
function checkLayout(w, rows, kind) {
  if (!Array.isArray(rows) || !rows.length) { err(w + ': layout missing'); return; }
  const W = rows[0].length, H = rows.length;
  if (W < 20 || W > 30) err(w + ': layout width ' + W + ' outside 20-30');
  if (H < 40 || H > 80) err(w + ': layout height ' + H + ' outside 40-80');
  rows.forEach((r, y) => { if (r.length !== W) err(w + ': layout row ' + y + ' width ' + r.length); for (const c of r) if (!CHUNK_CHARS.has(c)) err(w + ': illegal "' + c + '" row ' + y); });
  checkStanders(w, rows, false);
  let P = null, Dd = null;
  rows.forEach((r, y) => { const px = r.indexOf('P'), dx = r.indexOf('D'); if (px >= 0) P = [px, y]; if (dx >= 0) Dd = [dx, y]; });
  if (count(rows, 'P') !== 1 || count(rows, 'D') !== 1) err(w + ': layout needs exactly one P and one D');
  if (!P || !Dd) return;
  if (kind === 'climb' && !(P[1] > H * 0.8 && Dd[1] < H * 0.2)) err(w + ': climb: P near the bottom, D near the top');
  if (kind === 'drop' && !(P[1] < H * 0.2 && Dd[1] > H * 0.8)) err(w + ': drop: P at the top, D at the bottom');
  const seen = reach(rows.map(r => r.replace(/L/g, '.')), [P], true);
  if (!near(seen, Dd[0], Dd[1])) err(w + ': D not reachable from P');
  const seen0 = reach(rows, [P], false);
  if (!near(seen0, Dd[0], Dd[1]) && !quiet) warn(w + ': D needs crates broken');
  if (count(rows, 'c') < 2) warn(w + ': vertical level with fewer than 2 checkpoints');
  // Carl is 2 tiles tall: every walkable floor cell needs 2 free tiles above it (stage.js note)
  for (let y = 1; y < H - 1; y++) for (let x = 0; x < W; x++) {
    const c = rows[y][x], below = rows[y + 1][x];
    if (SOLID.has(c) || c === 'L' || !SUPPORT.has(below) || below === 'H') continue;
    const up = rows[y - 1][x];
    if (SOLID.has(up) || up === 'L' || up === '=') err(w + ': floor at ' + x + ',' + (y + 1) + ' has only 1 tile of headroom');
  }
  // climb: falling never leaves the map (bottom row solid)
  if (kind === 'climb' && !/^[X#]+$/.test(rows[H - 1])) err(w + ': climb bottom row must be solid');
}

/* ---------------- areas ---------------- */
const A = D.areas || {};
for (const id of AREA_IDS) if (!A[id]) err('area missing: ' + id);
function checkLines(w, ls) { lines(w, ls, 1); }
for (const [id, a] of Object.entries(A)) {
  const w = 'areas.' + id;
  if (a.id !== id) err(w + ': id mismatch');
  text(w + '.name', a.name, 28);
  if (!SIDE_THEMES.includes(a.theme)) err(w + ': theme ' + a.theme);
  if (!MUSIC.includes(a.music) || !MUSIC.includes(a.musicNight)) err(w + ': music');
  const rows = a.rows;
  if (!Array.isArray(rows) || rows.length !== 12) { err(w + ': rows must be 12'); continue; }
  const W = rows[0].length;
  if (W < 60 || W > 200) err(w + ': width ' + W + ' outside 60-200');
  rows.forEach((r, y) => { if (r.length !== W) err(w + ': row ' + y + ' width'); for (const c of r) if (!CHUNK_CHARS.has(c) && !DOOR_CHARS.has(c)) err(w + ': illegal "' + c + '"'); });
  checkStanders(w, rows, true);
  if (/[KDRQ]/.test(rows.join(''))) err(w + ': K D R Q do not belong in streets');
  // doors <-> rows
  const doorCols = {};
  rows.forEach((r, y) => r.split('').forEach((c, x) => { if (DOOR_CHARS.has(c)) { if (doorCols[c] !== undefined) err(w + ': door "' + c + '" twice'); doorCols[c] = x; } }));
  for (const c of Object.keys(doorCols)) if (!has(a.doors, c)) err(w + ': door char "' + c + '" in rows has no door entry');
  for (const [c, d] of Object.entries(a.doors || {})) {
    const ww = w + '.doors.' + c;
    if (doorCols[c] === undefined) err(ww + ': not placed in rows');
    if (!DOOR_KINDS.includes(d.kind)) err(ww + ': kind ' + d.kind);
    text(ww + '.label', d.label, 32);
    if (d.lockText) text(ww + '.lockText', d.lockText);
    if (d.sprite !== null && !OBJ_SPRITES.includes(d.sprite)) err(ww + ': sprite ' + d.sprite);
    if (d.kind === 'level' && !D.levels[d.target]) err(ww + ': level ' + d.target);
    if (d.kind === 'area' && !A[d.target]) err(ww + ': area ' + d.target);
    if (d.kind === 'inn' && !D.inns[d.target]) err(ww + ': inn ' + d.target);
    if (d.kind === 'shop' && !D.shops[d.target]) err(ww + ': shop ' + d.target);
    if (d.kind === 'club' && d.target !== 'desperado') err(ww + ': club target desperado');
    if (d.kind === 'cinema' && !D.cinema[d.target]) err(ww + ': cinema ' + d.target);
    if (d.kind === 'npc' && !has(D.talk, d.target)) err(ww + ': npc ' + d.target + ' has no D.talk');
    if (d.phase && !['any', 'day', 'night'].includes(d.phase)) err(ww + ': phase');
    // convention (game.js default texts, flow_test.js): night locks say AFTER DARK, day locks say MORNING
    if (d.phase === 'night' && d.lockText && !/AFTER DARK/.test(d.lockText)) err(ww + ': night lockText should say AFTER DARK');
    if (d.phase === 'day' && d.lockText && !/MORNING/.test(d.lockText)) err(ww + ': day lockText should say MORNING');
    if (d.needsItem && !I[d.needsItem]) err(ww + ': needsItem ' + d.needsItem);
    useFlag(d.showIf, ww + '.showIf'); useFlag(d.hideIf, ww + '.hideIf'); useFlag(d.needs, ww + '.needs');
    if (d.lockText === undefined && (d.needs || d.needsItem)) warn(ww + ': needs without lockText');
  }
  for (const side of ['left', 'right']) {
    const e = (a.edges || {})[side];
    if (e && !A[e.area]) err(w + '.edges.' + side + ': area ' + e.area);
    if (!e) { const x = side === 'left' ? 0 : W - 1; if (rows[5][x] !== 'X') warn(w + ': closed ' + side + ' edge without a wall column'); }
  }
  // npcs <-> N
  const nCols = []; rows[9].split('').forEach((c, x) => { if (c === 'N') nCols.push(x); });
  rows.forEach((r, y) => { if (y !== 9 && r.includes('N')) err(w + ': N only on row 9 in streets'); });
  if ((a.npcs || []).length !== nCols.length) err(w + ': ' + (a.npcs || []).length + ' npcs vs ' + nCols.length + ' N spots');
  (a.npcs || []).forEach((n, i) => {
    const ww = w + '.npcs[' + i + ']';
    if (nCols[i] !== undefined && n.x !== nCols[i]) err(ww + ': x ' + n.x + ' but N is at col ' + nCols[i]);
    if (!ACTOR_SPRITES.has(n.sprite)) err(ww + ': sprite ' + n.sprite);
    if (!has(D.talk, n.id) && !(n.lines) && !(D.events || []).some(e => e.npc === n.id)) err(ww + ': ' + n.id + ' has no talk lines');
    useFlag(n.showIf, ww + '.showIf'); useFlag(n.hideIf, ww + '.hideIf');
    if (n.lines) checkLines(ww + '.lines', n.lines);
  });
  for (const ph of ['day', 'night']) ((a.enemies || {})[ph] || []).forEach(e => { if (!E[e[0]] || E[e[0]].citizen || !(e[1] > 0)) err(w + '.enemies.' + ph + ': ' + JSON.stringify(e)); });
  if (a.enemiesAfter) { useFlag(a.enemiesAfter.flag, w + '.enemiesAfter'); for (const ph of ['day', 'night']) (a.enemiesAfter[ph] || []).forEach(e => { if (!E[e[0]]) err(w + '.enemiesAfter: ' + e[0]); }); }
  (a.citizens || []).forEach(c => { if (!E[c] || !E[c].citizen) err(w + '.citizens: ' + c); });
  if (a.guarded && !(a.citizens || []).length) err(w + ': guarded area without citizens');
  if (!a.guarded && (a.citizens || []).length) warn(w + ': citizens in an unguarded area');
  if (a.signpost && !rows.join('').includes('p')) err(w + ': signpost true but no p');
  if (a.signs) texts(w + '.signs', a.signs, 1);
  if (a.signpostText) text(w + '.signpostText', a.signpostText);
  // walkable end to end
  const seen = reach(rows, [[1, 9], [2, 9]], true);
  if (![...seen].some(k => +k.split(',')[0] >= W - 2)) err(w + ': street not walkable end to end');
  rows[9].split('').forEach((c, x) => { if ((DOOR_CHARS.has(c) || 'Np'.includes(c)) && !near(seen, x, 9)) err(w + ': "' + c + '" at col ' + x + ' not reachable'); });
}

/* ---------------- levels ---------------- */
const LV = D.levels || {};
for (const id of LEVEL_IDS.concat(OPT_LEVELS)) if (!LV[id]) err('level missing: ' + id);
function pool(w, list, what) {
  if (!Array.isArray(list) || !list.length) { err(w + ': ' + what + ' empty'); return; }
  list.forEach(e => { if (!Array.isArray(e) || !E[e[0]] || !(e[1] > 0)) err(w + ': bad ' + what + ' entry ' + JSON.stringify(e)); else if (E[e[0]].citizen || E[e[0]].invulnerable) err(w + ': ' + e[0] + ' does not belong in a level pool'); });
}
const CIN_USED = new Set();
function cinemaRef(w, id) { if (typeof id !== 'string') return; if (!D.cinema[id]) err(w + ': cinema ' + id + ' missing'); else CIN_USED.add(id); }
for (const [id, l] of Object.entries(LV)) {
  const w = 'levels.' + id;
  if (l.id !== id) err(w + ': id mismatch');
  text(w + '.name', l.name, 32);
  if (!KINDS.includes(l.kind)) err(w + ': kind ' + l.kind);
  if (!(l.act >= 1 && l.act <= 3)) err(w + ': act');
  if (!LEVEL_THEMES.includes(l.theme)) err(w + ': theme ' + l.theme);
  if (l.kind === 'rooms' && l.theme !== 'bigtop') err(w + ': rooms use theme bigtop');
  if (!MUSIC.includes(l.music)) err(w + ': music ' + l.music);
  if (l.bossMusic && !MUSIC.includes(l.bossMusic)) err(w + ': bossMusic');
  if (!(l.hours >= 0)) err(w + ': hours');
  if (typeof l.intro === 'string') cinemaRef(w + '.intro', l.intro); else if (l.intro) texts(w + '.intro', l.intro, 1);
  if (l.outro) cinemaRef(w + '.outro', l.outro);
  if (l.next && !LV[l.next]) err(w + ': next ' + l.next);
  if (l.thenArea && !A[l.thenArea]) err(w + ': thenArea ' + l.thenArea);
  if (l.boss && !D.bosses[l.boss]) err(w + ': boss ' + l.boss);
  if (['boss', 'facade', 'chase'].includes(l.kind) && !l.boss) err(w + ': ' + l.kind + ' needs a boss');
  if (l.kind === 'facade' && !(D.bosses[l.boss] || {}).facade) err(w + ': facade boss must be facade:true');
  if (!l.reward || !TIERS.includes(l.reward.box)) err(w + ': reward box');
  (l.sets || []).forEach(f => { if (typeof f !== 'string') err(w + ': sets'); });
  (l.gives || []).forEach((g, i) => checkGive(w + '.gives[' + i + ']', g));
  if (Array.isArray(l.quest)) err(w + ': quest must be an object {start, done} (arrays inside are fine)');
  if (l.quest) ['start', 'done'].forEach(k => [].concat(l.quest[k] || []).forEach(qid => { if (!D.quests[qid]) err(w + ': quest ' + qid); }));
  if (l.party) l.party.forEach(p => { if (!['donut', 'mongo', 'katia'].includes(p)) err(w + ': party ' + p); });
  if (l.swap && l.swap !== 'mongo') err(w + ': swap');
  if (l.signs) texts(w + '.signs', l.signs, 1);
  if (l.rescueLines) lines(w + '.rescueLines', l.rescueLines, 1);
  if (l.rescueFlag && !PRODUCED.has(l.rescueFlag)) produce(l.rescueFlag, 'rescue ' + id);
  ['detonateSub'].forEach(k => { if (l[k]) text(w + '.' + k, l[k], 60); });
  if (l.plant && l.plant.handoffSub) text(w + '.plant.handoffSub', l.plant.handoffSub, 60);
  if (l.debrisProj && !D.projectiles[l.debrisProj]) err(w + ': debrisProj ' + l.debrisProj);
  (l.startGives || []).forEach((g, i) => checkGive(w + '.startGives[' + i + ']', g));
  (l.npcs || []).forEach((n, i) => { if (!ACTOR_SPRITES.has(n.sprite)) err(w + '.npcs[' + i + ']: sprite ' + n.sprite); lines(w + '.npcs[' + i + '].lines', n.lines, 1); });
  if (l.kind === 'show') {
    if (!D.show[l.show]) err(w + ': show ' + l.show);
    if (!l.outro) err(w + ': show level outro must be the trailer blast cinema');
    continue;
  }
  if (l.kind === 'rooms') {
    const R = l.room || {};
    if (!Array.isArray(R.rooms) || R.rooms.length !== 3) err(w + ': room.rooms needs 3 rooms');
    (R.rooms || []).forEach((r, i) => {
      const ww = w + '.room.rooms[' + i + ']';
      text(ww + '.name', r.name, 32);
      if (!r.target || !(r.target.hp > 0)) err(ww + ': target.hp');
      pool(ww, r.waves, 'waves');
      if (!(r.rate > 0) || !(r.max > 0)) err(ww + ': rate/max');
      if (r.intro) text(ww + '.intro', r.intro);
    });
    const F = R.finale || {};
    if (!(F.seconds > 0)) err(w + ': finale.seconds');
    lines(w + '.finale.lines', F.lines, 1); lines(w + '.finale.doneLines', F.doneLines, 1);
    if (F.music && !MUSIC.includes(F.music)) err(w + ': finale.music');
    continue;
  }
  pool(w, l.enemies, 'enemies');
  if (l.elite) pool(w, l.elite, 'elite');
  if (l.flyers) pool(w, l.flyers, 'flyers');
  let rowsAll = [];
  if (l.kind === 'climb' || l.kind === 'drop') {
    checkLayout(w, l.layout, l.kind);
    rowsAll = l.layout || [];
  } else {
    const cd = l.chunks || {};
    const ids = [cd.start].concat(cd.pool || [], cd.insert || [], cd.end ? [cd.end] : []);
    ids.forEach(c => { if (!CH[c]) err(w + ': chunk ' + c + ' missing'); else CH[c]._used++; });
    if (!CH[cd.start] || !count(CH[cd.start].rows, 'P')) err(w + ': start chunk needs P');
    (cd.pool || []).concat(cd.insert || [], cd.end ? [cd.end] : []).forEach(c => { if (CH[c] && count(CH[c].rows, 'P')) err(w + ': P outside the start chunk (' + c + ')'); });
    if ((cd.pool || []).length && !(cd.count > 0)) err(w + ': pool without count');
    (cd.pool || []).forEach(c => { if (CH[c] && /[NRQ]/.test(CH[c].rows.join(''))) err(w + ': pool chunk ' + c + ' has N/R/Q (only fixed chunks may)'); });
    const fixed = [cd.start].concat(cd.insert || [], cd.end ? [cd.end] : []).filter(c => CH[c]);
    const cntFixed = (c) => fixed.reduce((n, k) => n + count(CH[k].rows, c), 0);
    const cntPool = (c) => { const ps = (cd.pool || []).filter(k => CH[k]).map(k => count(CH[k].rows, c)); return ps.length ? Math.max(...ps) : 0; };
    if (l.kind === 'survival') {
      const sr = CH[cd.start] ? CH[cd.start].rows : [];
      if (cd.end) err(w + ': survival uses only the start chunk');
      if (sr.length && sr[0].length !== 20) err(w + ': survival screen must be 20 cols');
      if (!count(sr, 'B') || count(sr, 'w') < 2) err(w + ': survival needs B and 2+ w');
      const S = l.survival || {};
      if (!(S.seconds > 0) || !(S.rate > 0) || !(S.max > 0)) err(w + ': survival seconds/rate/max');
      pool(w + '.survival', S.waves, 'waves');
    } else {
      const endRows = CH[cd.end] ? CH[cd.end].rows : [];
      const wantK = !!l.boss, hasK = count(endRows, 'K') === 1;
      if (wantK !== hasK) err(w + ': end chunk K mismatch (boss ' + l.boss + ')');
      if (l.kind === 'plant') {
        if (!count(endRows, 'T')) err(w + ': plant end chunk needs T');
        const per = (cd.pool || []).filter(k => CH[k]).map(k => count(CH[k].rows, 'C'));
        if (new Set(per).size > 1) err(w + ': plant pool chunks must hold the same number of C (' + per.join(',') + ')');
        const total = cntFixed('C') + (cd.count || 0) * (per[0] || 0);
        if (total !== (l.plant || {}).charges) err(w + ': ' + total + ' C spots vs plant.charges ' + (l.plant || {}).charges);
        if (!cntPool('Y') && !cntFixed('Y')) err(w + ': plant level without decoy Y');
      } else if (!l.boss && !count(endRows, 'D')) err(w + ': end chunk needs D');
      if (l.kind === 'escape') { const S = l.escape || {}; if (!(S.seconds > 0) || !Array.isArray(S.bursts) || S.bursts.length !== 4) err(w + ': escape seconds + 4 bursts'); }
      if (l.kind === 'chase') { const S = l.chase || {}; if (!D.bosses[S.pursuer] || !(S.speed > 0)) err(w + ': chase fields'); }
    }
    const nN = cntFixed('N');
    if ((l.npcs || []).length !== nN) err(w + ': ' + (l.npcs || []).length + ' npcs vs ' + nN + ' N spots');
    const nSigns = cntFixed('n') + (cd.count || 0) * cntPool('n');
    if (nSigns && (l.signs || []).length < Math.min(nSigns, cntFixed('n') + 1)) warn(w + ': ' + (l.signs || []).length + ' signs for up to ' + nSigns + ' n spots');
    if (l.rescue && cntFixed('R') !== 1) err(w + ': rescue needs exactly one R in a fixed chunk');
    if (!l.rescue && cntFixed('R')) err(w + ': R without rescue');
    if ((cntFixed('k') + cntPool('k')) && !(l.kind === 'plant' || true)) err(w + ': k');
    rowsAll = fixed.map(k => CH[k].rows.join(''));
  }
  if (l.kind === 'climb' || l.kind === 'drop') { if ((l.npcs || []).length) err(w + ': npcs in a vertical level'); }
}
for (const [id, ch] of Object.entries(CH)) if (!ch._used) warn('chunks.' + id + ': not used by any level');

/* ---------------- quests, objectives, events, talk ---------------- */
for (const [id, q] of Object.entries(D.quests || {})) { text('quests.' + id + '.name', q.name, 44); text('quests.' + id + '.desc', q.desc); }
['show_must_go_on', 'sex_workers', 'fools_glass'].forEach(q => { if (!(D.quests || {})[q]) err('quest missing ' + q); });
(D.objectives || []).forEach((o, i) => {
  const w = 'objectives[' + i + ']';
  useFlag(o.done, w); text(w + '.text', o.text, 34);
  if (o.area && !A[o.area]) err(w + ': area ' + o.area);
});
const evIds = new Set();
(D.events || []).forEach((e, i) => {
  const w = 'events[' + i + '] ' + e.id;
  if (!e.id || evIds.has(e.id)) err(w + ': id missing/dup'); evIds.add(e.id);
  if (!A[e.area]) err(w + ': area ' + e.area);
  const wh = e.when || {};
  useFlag(wh.flags, w + '.when.flags'); useFlag(wh.notFlags, w + '.when.notFlags');
  if (wh.phase && !['day', 'night'].includes(wh.phase)) err(w + ': phase');
  if (e.cinema) cinemaRef(w, e.cinema); else lines(w + '.lines', e.lines, 1);
  (e.gives || []).forEach((g, k) => checkGive(w + '.gives[' + k + ']', g));
  if (e.quest) ['start', 'done'].forEach(k => [].concat(e.quest[k] || []).forEach(qid => { if (!D.quests[qid]) err(w + ': quest ' + qid); }));
  if (e.level && !LV[e.level]) err(w + ': level ' + e.level);
  if (e.npc && !(A[e.area].npcs || []).some(n => n.id === e.npc)) err(w + ': npc ' + e.npc + ' not in area ' + e.area);
  if (!(e.sets || []).length) warn(w + ': event sets no flag (it would repeat if once is off)');
});
for (const [id, list] of Object.entries(D.talk || {})) {
  if (!Array.isArray(list) || !list.length) { err('talk.' + id + ': empty'); continue; }
  list.forEach((t, i) => { const w = 'talk.' + id + '[' + i + ']'; if (t.when) { useFlag(t.when.flags, w); useFlag(t.when.notFlags, w); } lines(w + '.lines', t.lines, 1); });
  if (list[list.length - 1].when) warn('talk.' + id + ': last entry should have no when (fallback)');
}
(D.mordecaiHints || []).forEach((h, i) => { useFlag((h.when || {}).flags, 'mordecaiHints[' + i + ']'); useFlag((h.when || {}).notFlags, 'mordecaiHints[' + i + ']'); text('mordecaiHints[' + i + ']', h.text); });
texts('mordecai', D.mordecai, 20);
for (const k of 'floorClear stageClear death levelUp lootbox revive boxEmpty lowHp bigCombo flee night day crime ban collapse cockroach guardKill earlyStairs edge import levelClear'.split(' ')) texts('ai.' + k, (D.ai || {})[k], 3);
for (const [k, v] of Object.entries(D.ai || {})) if (!/^(floorClear|stageClear|death|levelUp|lootbox|revive|boxEmpty|lowHp|bigCombo|flee|night|day|crime|ban|collapse)$/.test(k)) texts('ai.' + k, v, 1);
for (const [name, por] of Object.entries(D.who || {})) { if (!PORTRAITS.includes(por)) err('who.' + name + ': portrait ' + por); }

/* ---------------- cinema ---------------- */
cinemaRef('meta.startCinema', M.startCinema); cinemaRef('meta.afterClassCinema', M.afterClassCinema);
for (const [id, shots] of Object.entries(D.cinema || {})) {
  if (!Array.isArray(shots) || !shots.length) { err('cinema.' + id + ': no shots'); continue; }
  shots.forEach((s, i) => {
    const w = 'cinema.' + id + '[' + i + ']';
    if (typeof s.bg !== 'string') err(w + ': bg');
    else if (s.bg.indexOf('panel:') === 0) { if (!PANELS.includes(s.bg.slice(6))) err(w + ': panel ' + s.bg); }
    else if (!SIDE_THEMES.includes(s.bg) && !BACKDROPS.includes(s.bg)) err(w + ': bg theme ' + s.bg);
    (s.actors || []).forEach((a, k) => { if (!ACTOR_SPRITES.has(a.sprite)) err(w + '.actors[' + k + ']: sprite ' + a.sprite); if (!(a.x >= 0 && a.x <= 320) || !(a.y >= 16 && a.y <= 164)) err(w + '.actors[' + k + ']: position'); });
    if (s.lines) lines(w + '.lines', s.lines); else if (!(s.wait > 0)) warn(w + ': no lines and no wait');
    if (s.sfx && !SFX.includes(s.sfx)) err(w + ': sfx ' + s.sfx);
    if (s.music && !MUSIC.includes(s.music)) err(w + ': music ' + s.music);
  });
}

/* ---------------- show ---------------- */
const SH = (D.show || {}).danger_zone;
if (!SH) err('show.danger_zone missing');
else {
  lines('show.intro', SH.intro, 1); lines('show.hekla', SH.hekla, 1); lines('show.outro', SH.outro, 1);
  if (SH.blastLines) lines('show.blastLines', SH.blastLines, 1);
  cinemaRef('show.blast', SH.blast);
  if (!SH.fanBox || !(SH.fanBox.min > 0) || !TIERS.includes(SH.fanBox.tier)) err('show.fanBox {min, tier}');
  if (!Array.isArray(SH.segments) || SH.segments.length < 4) err('show: 4+ segments');
  (SH.segments || []).forEach((sg, i) => {
    const w = 'show.segments[' + i + ']';
    text(w + '.who', sg.who, 24); text(w + '.q', sg.q, 170);
    if (!Array.isArray(sg.answers) || sg.answers.length !== 3) err(w + ': 3 answers');
    (sg.answers || []).forEach((a, k) => {
      const ww = w + '.answers[' + k + ']';
      text(ww + '.text', a.text, 90);
      if (typeof a.views !== 'number') err(ww + ': views');
      if (!['applause', 'laugh', 'boo'].includes(a.crowd)) err(ww + ': crowd');
      lines(ww + '.react', a.react, 1);
      if (a.donut) text(ww + '.donut', a.donut);
    });
  });
  const levelOutro = (LV.a2_danger_zone || {}).outro;
  if (levelOutro !== SH.blast) err('levels.a2_danger_zone.outro should be the blast cinema (' + SH.blast + ')');
}

/* ---------------- class pick ---------------- */
const CP = D.classPick;
if (!CP) err('classPick missing');
else {
  for (const k of ['carlRaces', 'carlClasses']) {
    const list = CP[k] || [];
    const pick = list.filter(r => !r.locked);
    const rec = list.filter(r => r.recommended);
    if (pick.length !== 1) err('classPick.' + k + ': exactly one pickable entry');
    if (rec.length !== 3) err('classPick.' + k + ': three recommended');
    if (rec.some(r => !r.locked)) err('classPick.' + k + ': recommended entries are locked');
    list.forEach((r, i) => { text('classPick.' + k + '[' + i + '].name', r.name, 28); text('classPick.' + k + '[' + i + '].desc', r.desc, 200); if (r.locked) text('classPick.' + k + '[' + i + '].locked', r.locked); });
  }
  if (!(CP.carlRaces || []).some(r => r.id === 'primal' && !r.locked)) err('classPick: primal must be pickable');
  if (!(CP.carlClasses || []).some(r => r.id === 'compensated_anarchist' && !r.locked)) err('classPick: compensated_anarchist must be pickable');
  ['intro', 'raceAi', 'classAi', 'donutLines', 'mordecaiLines', 'collapse', 'outro'].forEach(k => lines('classPick.' + k, CP[k], 1));
}
const CLUB = (D.clubs || {}).desperado;
if (!CLUB) err('clubs.desperado missing (ui.js scenes.club reads it)');
else {
  text('clubs.desperado.name', CLUB.name, 32);
  if (!D.shops[CLUB.shop]) err('clubs.desperado.shop ' + CLUB.shop);
  if (!MUSIC.includes(CLUB.music)) err('clubs.desperado.music');
  if (!BACKDROPS.includes(CLUB.theme)) err('clubs.desperado.theme');
  lines('clubs.desperado.lines.door', CLUB.lines.door, 1); lines('clubs.desperado.lines.quint', CLUB.lines.quint, 1);
  ['dance', 'bar'].forEach(k => (CLUB.lines[k] || []).forEach((g, i) => lines('clubs.desperado.lines.' + k + '[' + i + ']', g, 1)));
}

/* ---------------- story ---------------- */
for (const k of ['earlyEnding', 'collapseEnding', 'winEnding']) ((D.story || {})[k] || []).forEach((p, i) => { text('story.' + k + '[' + i + ']', p.text); if (p.portrait && !PORTRAITS.includes(p.portrait)) err('story.' + k + '[' + i + ']: portrait'); });
['earlyEnding', 'collapseEnding'].forEach(k => { if (!((D.story || {})[k] || []).length) err('story.' + k + ' missing'); });
texts('story.credits', (D.story || {}).credits, 5, 48);

for (const id of Object.keys(D.cinema || {})) if (!CIN_USED.has(id) && !Object.values(A).some(a => Object.values(a.doors || {}).some(d => d.kind === 'cinema' && d.target === id))) warn('cinema.' + id + ': never played');
// record flags: set for game.js / ui.js (party rules, map, logs) or as story records; nothing in data has to read them
const RECORD_FLAGS = 'donut_asleep donut_awake mongo_caged mongo_freed grimaldi_peace panic gumgum_dead manasa_dead mic_drop alley_night_done burgundy_dead temple_done restroom_done park_done shelves_rigged'.split(' ');
for (const f of PRODUCED.keys()) if (!USED_FLAGS.has(f) && !FIXED_FLAGS.includes(f) && !RECORD_FLAGS.includes(f) && !/^map_/.test(f)) warn('flag "' + f + '" is set but nothing reads it (' + PRODUCED.get(f).join(', ') + ')');

/* ---------------- story chain simulation ---------------- */
const flow = [];
(function simulate() {
  const F = new Set(), items = new Set(['jug', 'smoke']), cleared = new Set(), fired = new Set();
  const isSet = (f) => [].concat(f || []).every(x => F.has(x));
  const visible = (o) => (!o.showIf || F.has(o.showIf)) && (!o.hideIf || !F.has(o.hideIf));
  function apply(o, src) {
    (o.sets || []).forEach(f => F.add(f));
    (o.gives || []).forEach(g => { if (g.item) items.add(g.item); });
  }
  function clearLevel(id, via) {
    if (cleared.has(id)) return;
    const l = LV[id]; cleared.add(id); flow.push('  ' + (l.optional ? '(opt) ' : '') + id + '  [' + l.kind + ', ' + l.hours + 'h] via ' + via + (l.sets ? '  sets ' + l.sets.join(' ') : ''));
    apply(l, id);
    if (l.next) clearLevel(l.next, 'next of ' + id);
  }
  function accessible() {
    const seen = new Set([M.startArea]), q = [M.startArea];
    while (q.length) {
      const a = A[q.shift()];
      const nexts = [];
      for (const s of ['left', 'right']) if ((a.edges || {})[s]) nexts.push(a.edges[s].area);
      for (const d of Object.values(a.doors || {})) if (d.kind === 'area' && visible(d) && isSet(d.needs) && (!d.needsItem || items.has(d.needsItem))) nexts.push(d.target);
      nexts.forEach(n => { if (!seen.has(n)) { seen.add(n); q.push(n); } });
    }
    return seen;
  }
  let guard = 0, progress = true;
  while (progress && guard++ < 500) {
    progress = false;
    const acc = accessible();
    // events first (area entry or npc talk), in data order
    for (const e of D.events || []) {
      if (fired.has(e.id) || !acc.has(e.area)) continue;
      const wh = e.when || {};
      if (!isSet(wh.flags) || (wh.notFlags || []).some(f => F.has(f))) continue;
      if (e.npc) { const n = (A[e.area].npcs || []).find(x => x.id === e.npc); if (!n || !visible(n)) continue; }
      fired.add(e.id); apply(e); flow.push('  event ' + e.id + (e.sets ? '  sets ' + e.sets.join(' ') : ''));
      if (e.level) clearLevel(e.level, 'event ' + e.id);
      progress = true; break;
    }
    if (progress) continue;
    // then the first usable story level door (data order), optional ones last
    const order = Object.keys(LV).sort((a, b) => (LV[a].optional ? 1 : 0) - (LV[b].optional ? 1 : 0));
    for (const id of order) {
      if (cleared.has(id)) continue;
      let door = null, area = null;
      for (const aid of acc) for (const [c, d] of Object.entries(A[aid].doors || {})) if (d.kind === 'level' && d.target === id && visible(d) && isSet(d.needs) && (!d.needsItem || items.has(d.needsItem))) { door = c; area = aid; }
      if (!door) continue;
      clearLevel(id, area + ' door ' + door); progress = true; break;
    }
  }
  const missing = Object.keys(LV).filter(id => !cleared.has(id));
  if (missing.length) err('story chain: never reachable: ' + missing.join(', '));
  if (!F.has('escaped')) err('story chain: the finale flag "escaped" is never reached');
  // objectives should complete in order
  let lastIdx = -1;
  const setOrder = [];
  flow.forEach(line => { const m = /sets (.*)$/.exec(line); if (m) m[1].split(' ').forEach(f => setOrder.push(f)); });
  (D.objectives || []).forEach((o, i) => {
    const idx = setOrder.indexOf(o.done);
    if (idx < 0) err('objectives[' + i + ']: ' + o.done + ' never set in the chain');
    else if (idx < lastIdx) warn('objectives[' + i + '] (' + o.done + ') completes before the previous objective');
    lastIdx = Math.max(lastIdx, idx);
  });
  // story hours on the critical path
  const hours = [...cleared].filter(id => !LV[id].optional).reduce((n, id) => n + (LV[id].hours || 0), 0);
  flow.push('  main path level hours: ' + hours + ' of ' + (M.startHours || 192));
  if (hours > 150) warn('main path uses ' + hours + ' hours of the 192 hour clock');
})();

/* ---------------- render ---------------- */
const ri = argv.indexOf('--render');
if (ri >= 0) {
  const id = argv[ri + 1];
  if (LV[id]) {
    const l = LV[id];
    if (l.layout) l.layout.forEach(r => console.log(r));
    else if (l.chunks) { const cd = l.chunks; const ids = [cd.start].concat(cd.insert || [], cd.end ? [cd.end] : []); console.log('start + inserts + end (pool: ' + (cd.pool || []).join(' ') + ' x' + cd.count + ')'); for (let y = 0; y < 12; y++) console.log(ids.map(c => CH[c].rows[y]).join('|')); }
  } else if (A[id]) A[id].rows.forEach(r => console.log(r));
  else if (CH[id]) CH[id].rows.forEach(r => console.log(r));
  else console.log('nothing named ' + id);
}
if (argv.includes('--flow')) { console.log('STORY CHAIN (simulated):'); flow.forEach(l => console.log(l)); }

console.log('data_validate: ' + Object.keys(LV).length + ' levels, ' + Object.keys(CH).length + ' chunks, ' + Object.keys(A).length + ' areas, ' +
  Object.keys(D.cinema).length + ' cinemas, ' + textCount + ' text strings, ' + PRODUCED.size + ' flags');
if (warns.length && !quiet) { console.log('\nWARNINGS (' + warns.length + '):'); warns.forEach(m => console.log('  ' + m)); }
if (errors.length) { console.log('\nERRORS (' + errors.length + '):'); errors.forEach(m => console.log('  ' + m)); process.exit(1); }
console.log('OK');

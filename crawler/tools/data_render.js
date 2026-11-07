#!/usr/bin/env node
// ASCII preview of assembled stages + a balance summary for crawler/js/data.js.
// Usage:
//   node crawler/tools/data_render.js f1_s1 f3_s2      render stages (seeded like a run)
//   node crawler/tools/data_render.js --map 5          print floor 5's overworld map
//   node crawler/tools/data_render.js --balance        enemies per stage + xp/level pacing
//   node crawler/tools/data_render.js --chain          quest items, locks and rescues per floor
//   add --seed=123 to change the layout seed
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ctx = { window: {} };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.resolve(__dirname, '../js/data.js'), 'utf8'), ctx);
const D = ctx.window.DCW.data;

const args = process.argv.slice(2);
const seedArg = args.find(a => a.startsWith('--seed='));
const SEED = seedArg ? +seedArg.slice(7) : 12345;

function hash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

function assemble(id, seed) {
  const s = D.stages[id];
  const r = rng(seed + hash(id));
  const order = [s.chunks.start];
  let prev = null;
  for (let i = 0; i < s.chunks.count; i++) {
    const opts = s.chunks.pool.filter(p => p !== prev);
    const pick = opts[Math.floor(r() * opts.length)];
    order.push(pick); prev = pick;
  }
  // Update 2: chunks.insert are spliced into the middle of the generated list (after start + half the picks)
  const ins = s.chunks.insert || [];
  if (ins.length) order.splice(1 + Math.floor(s.chunks.count / 2), 0, ...ins);
  order.push(s.chunks.end);
  const rows = Array.from({ length: 12 }, () => '');
  order.forEach(c => D.chunks[c].rows.forEach((row, y) => { rows[y] += row; }));
  return { order, rows };
}

function render(id) {
  const s = D.stages[id];
  if (!s) { console.log('no stage ' + id); return; }
  const a = assemble(id, SEED);
  console.log('\n=== ' + id + ' "' + s.name + '" floor ' + s.floor + ' ' + s.theme + ' ' + s.kind + ' | ' + a.order.join(' > ') + ' | ' + a.rows[0].length + ' tiles');
  const tags = [];
  if (s.questItem) tags.push('Q=' + s.questItem);
  if (s.rescue) tags.push('R=' + s.rescue);
  if (s.exitNeeds) tags.push('exit needs ' + s.exitNeeds);
  if (tags.length) console.log('    ' + tags.join(' | ') + '   (S lever, L gate)');
  const W = a.rows[0].length, step = 120;
  for (let x0 = 0; x0 < W; x0 += step) {
    let ruler = '';
    for (let x = x0; x < Math.min(W, x0 + step); x++) ruler += x % 10 === 0 ? String((x / 10) % 10) : ' ';
    console.log('   ' + ruler);
    a.rows.forEach((r, y) => console.log((y < 10 ? ' ' : '') + y + ' ' + r.slice(x0, x0 + step).replace(/\./g, ' ')));
  }
}

function avg(list, floor) {
  let tw = 0, xp = 0, hp = 0;
  list.forEach(([id, w]) => { const e = D.enemyFor ? D.enemyFor(id, floor) : D.enemies[id]; tw += w; xp += e.xp * w; hp += e.hp * w; });
  return { xp: xp / tw, hp: hp / tw };
}

function balance() {
  console.log('stage        kind   tiles  e  E  f  boxXP  ~killXP  avgHP(e)');
  const xpFor = (L) => Math.round(18 * Math.pow(L, 1.5));
  let total = 0, level = 1, xp = 0;
  const addXP = (n) => { xp += n; while (xp >= xpFor(level)) { xp -= xpFor(level); level++; } };
  D.floors.forEach(f => {
    const ids = Object.keys(D.stages).filter(k => D.stages[k].floor === f.n);
    const startLevel = level;
    let floorXP = 0;
    ids.forEach(id => {
      const s = D.stages[id];
      const a = assemble(id, SEED), all = a.rows.join('');
      const n = (c) => all.split(c).length - 1;
      const e = n('e'), E = n('E'), fl = n('f');
      const ae = avg(s.enemies, f.n), aE = avg(s.elite, f.n), af = avg(s.flyers, f.n);
      let kxp = e * ae.xp + E * aE.xp + fl * af.xp;
      if (s.kind === 'boss') kxp += D.bosses[s.boss].xp;
      // assume ambush fought ~2x per floor, side areas done, everything else once
      const times = s.kind === 'ambush' ? 2 : 1;
      const got = (kxp + s.reward.xp) * times;
      floorXP += got;
      console.log(id.padEnd(12) + ' ' + s.kind.padEnd(6) + ' ' + String(a.rows[0].length).padStart(5) + ' ' + String(e).padStart(2) + ' ' + String(E).padStart(2) + ' ' + String(fl).padStart(2) +
        ' ' + String(s.reward.xp).padStart(6) + ' ' + String(Math.round(kxp)).padStart(8) + ' ' + String(Math.round(ae.hp)).padStart(9));
    });
    addXP(floorXP); total += floorXP;
    const L = startLevel, dmg = 2 + Math.floor((L - 1) * 0.3) + Math.floor((L - 1) / 2);
    console.log('  -> floor ' + f.n + ': enters at level ' + startLevel + ' (est punch ~' + dmg + '), earns ' + Math.round(floorXP) + ' xp, leaves at level ' + level + '\n');
  });
}

// --chain: per floor, where each quest item / rescue is and what each item opens
function chain() {
  const QI = D.questItems || {};
  D.floors.forEach(f => {
    const ids = Object.keys(D.stages).filter(k => D.stages[k].floor === f.n);
    const ents = f.overworld ? f.overworld.entrances : {};
    const entOf = (sid) => Object.keys(ents).find(k => ents[k] === sid) || '-';
    const lines = [];
    ids.forEach(sid => {
      const s = D.stages[sid], bits = [];
      if (s.questItem) bits.push('holds ' + s.questItem);
      if (s.rescue) bits.push('cage: ' + s.rescue);
      if (s.exitNeeds) bits.push('exit needs ' + s.exitNeeds);
      const lk = f.locks && f.locks[entOf(sid)];
      if (lk) bits.push('entrance needs ' + lk.needs);
      if (bits.length) lines.push('    ' + entOf(sid) + ' ' + sid.padEnd(9) + ' ' + bits.join(', '));
    });
    if (!lines.length) return;
    console.log('floor ' + f.n + ' (' + Object.keys(QI).filter(k => QI[k].floor === f.n).join(', ') + ')' + (f.companion ? ' companion ' + f.companion : ''));
    lines.forEach(l => console.log(l));
  });
}
if (args.includes('--chain')) chain();
if (args.includes('--balance')) balance();
const mi = args.indexOf('--map');
if (mi >= 0) {
  const f = D.floors[+args[mi + 1] - 1];
  if (f && f.overworld) { console.log(f.name); f.overworld.map.forEach((r, y) => console.log((y < 10 ? ' ' : '') + y + ' ' + r)); }
}
args.filter(a => !a.startsWith('--') && !/^\d+$/.test(a)).forEach(render);
if (!args.length) console.log('usage: data_render.js <stageId...> | --map N | --balance | --chain [--seed=N]');

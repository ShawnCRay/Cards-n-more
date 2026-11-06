// node crawler/tools/actors_validate.js  - loads js/art_actors.js in a fake window and checks every def
const fs = require('fs'), path = require('path'), vm = require('vm');
const src = fs.readFileSync(path.resolve(__dirname, '../js/art_actors.js'), 'utf8');
const win = {}; win.window = win;
vm.runInNewContext(src, win);
const D = win.DCW, defs = D.artDefs, procs = D.artProcs, skins = D.artSkins;
let bad = 0;
const err = m => { bad++; console.log('ERR ' + m); };
for (const [n, d] of Object.entries(defs)) {
  if (!(d.w > 0 && d.h > 0)) err(n + ' bad size');
  if (!Array.isArray(d.frames) || !d.frames.length) err(n + ' no frames');
  d.frames.forEach((f, i) => {
    if (f.length !== d.h) err(`${n}[${i}] has ${f.length} rows, want ${d.h}`);
    f.forEach((r, y) => {
      if (r.length !== d.w) err(`${n}[${i}] row ${y} len ${r.length} want ${d.w}`);
      for (const ch of r) if (ch !== '.' && ch !== ' ' && !(ch in d.pal)) err(`${n}[${i}] char '${ch}' not in pal`);
    });
  });
  for (const [k, v] of Object.entries(d.pal)) if (v !== null && !/^#[0-9a-f]{6}$/i.test(v)) err(`${n} pal ${k}=${v}`);
}
for (const [n, p] of Object.entries(procs)) if (!(p.w > 0 && p.h > 0 && typeof p.draw === 'function')) err('proc ' + n);
for (const [s, sk] of Object.entries(skins)) for (const [k, v] of Object.entries(sk.pal)) if (v !== null && !/^#[0-9a-f]{6}$/i.test(v)) err(`skin ${s} ${k}=${v}`);
// required names
const need = [];
const fr = (n, c) => need.push([n, c]);
['idle:2', 'run:4', 'jump:1', 'fall:1', 'punch:2', 'kick:2', 'airkick:1', 'throw:1', 'hurt:1', 'dead:1', 'climb:2', 'victory:1', 'ow_down:2', 'ow_up:2', 'ow_side:2'].forEach(s => { const [a, c] = s.split(':'); fr('carl_' + a, +c); });
['donut', 'mongo', 'katia', 'zev', 'squeaks'].forEach(c => { fr(c + '_idle', 2); fr(c + '_run', 2); fr(c + '_act', 1); });
'rat roach goblin goblin_archer goblin_brute bat grub shaman juicer_minion clown clown_brute skyfowl swamp_troll gator steam_goblin conductor rail_rat fishman jelly crab hunter hound masked_noble ghoul gargoyle skeleton mutant drone golem soldier sniper war_beast cultist'.split(' ').forEach(e => { fr(e + '_walk', 2); fr(e + '_attack', 1); fr(e + '_hurt', 1); });
'hoarder juicer ringmaster engineer tidemother butcher bride overseer showrunner'.split(' ').forEach(b => { fr(b + '_idle', 2); fr(b + '_walk', 2); fr(b + '_attack', 1); fr(b + '_hurt', 1); fr(b + '_special', 1); fr('p_' + b, 1); });
fr('mordecai', 2); fr('bopca', 2); fr('ai_screen', 2);
'p_carl p_donut p_mongo p_katia p_zev p_squeaks p_ai p_mordecai p_bopca'.split(' ').forEach(p => fr(p, 1));
const skinIds = 'carl_boxers carl_jacket carl_bodyguard carl_kilt carl_hazmat carl_pajamas carl_clown carl_toga carl_gold'.split(' ');
let missing = 0;
for (const [n, c] of need) {
  const d = defs[n], p = procs[n];
  const nf = d ? d.frames.length : p ? (p.frames || 1) : 0;
  if (!d && !p) { missing++; console.log('MISSING ' + n); }
  else if (nf < c) err(`${n} has ${nf} frames, want >= ${c}`);
  if (n.startsWith('p_') && d && (d.w !== 32 || d.h !== 32)) err(n + ' portrait not 32x32');
}
for (const s of skinIds) if (!skins[s]) { missing++; console.log('MISSING skin ' + s); }
console.log(`defs ${Object.keys(defs).length}, procs ${Object.keys(procs).length}, skins ${Object.keys(skins).length}, errors ${bad}, missing ${missing}`);
process.exit(bad ? 1 : 0);

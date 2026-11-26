// node crawler2/tools/actors_validate.js - loads js/art_actors.js in a fake window, checks every def and
// that every art-actors name in the book 2 contract (DESIGN.md sections 11.1 and 12) exists with enough frames.
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
      for (const ch of r) if (ch !== '.' && ch !== ' ' && !(ch in d.pal) && ch !== 'k') err(`${n}[${i}] char '${ch}' not in pal`);
    });
  });
  for (const [k, v] of Object.entries(d.pal)) if (v !== null && !/^#[0-9a-f]{6}$/i.test(v)) err(`${n} pal ${k}=${v}`);
  if (k => k.length > 1) for (const k of Object.keys(d.pal)) if (k.length !== 1) err(`${n} pal key '${k}' is not one char`);
}
for (const [n, p] of Object.entries(procs)) if (!(p.w > 0 && p.h > 0 && typeof p.draw === 'function')) err('proc ' + n);
for (const [s, sk] of Object.entries(skins)) for (const [k, v] of Object.entries(sk.pal)) if (v !== null && !/^#[0-9a-f]{6}$/i.test(v)) err(`skin ${s} ${k}=${v}`);
// ---- the contract ----
const need = [];
const fr = (n, c) => need.push([n, c || 1]);
'idle:2 run:4 jump fall punch:2 kick:2 airkick throw hurt dead climb:2 victory launch plant back_idle:2 back_run:2 back_throw back_jump back_hurt'
  .split(' ').forEach(s => { const [a, c] = s.split(':'); fr('carl_' + a, +(c || 1)); });
'donut_shoulder:2 donut_cast donut_idle:2 donut_run:2 donut_down'.split(' ').forEach(s => { const [a, c] = s.split(':'); fr(a, +(c || 1)); });
'mongo_idle:2 mongo_run:2 mongo_act mongo_big_idle:2 mongo_big_run:4 mongo_big_act mongo_clock_run:2 mongo_jump mongo_hurt katia_idle:2 katia_run:2 katia_act'
  .split(' ').forEach(s => { const [a, c] = s.split(':'); fr(a, +(c || 1)); });
'mordecai gordo fitz lucky edge_dancer talon pustule clarabelle quint gumgum signet grimaldi_face apollon bautista burgundy quill featherfall remex hekla ripper manasa tucker dnadia zev odette lucia eunice ricky_joe ai_screen'
  .split(' ').forEach(n => fr(n, 2));
'lemur stilt_clown fat_clown mold_lion giraffe street_urchin brain_boiler berserker city_elf wand_bearer krasue shadow_leak incubus ruin_flocker guard citizen_human citizen_skyfowl chickadee'
  .split(' ').forEach(e => { fr(e + '_walk', 2); fr(e + '_attack'); fr(e + '_hurt'); });
'heather vincente terror_big dispenser'.split(' ').forEach(b => { fr(b + '_idle', 2); fr(b + '_walk', 2); fr(b + '_attack'); fr(b + '_hurt'); fr(b + '_special'); });
'dispenser_body dispenser_eye:2 dispenser_mouth:2 dispenser_wing'.split(' ').forEach(s => { const [a, c] = s.split(':'); fr(a, +(c || 1)); });
const PORTRAITS = 'p_carl p_donut p_mongo p_mordecai p_katia p_signet p_grimaldi p_apollon p_clammy p_heather p_gordo p_fitz p_clarabelle p_quint p_pustule p_gumgum p_vincente p_quill p_burgundy p_remex p_bautista p_hekla p_ripper p_zev p_odette p_lucia p_ai p_eunice p_edge_dancer p_talon p_lucky'.split(' ');
PORTRAITS.forEach(p => fr(p, 3));
const skinIds = 'carl_f3 carl_boxers carl_jacket carl_bodyguard carl_kilt carl_hazmat carl_pajamas carl_clown carl_toga carl_gold carl_magistrate carl_primal'.split(' ');
// names art-core owns: art_actors.js must NOT define them (its defs would shadow art.js)
const artCoreOwned = 'krasue_body decoy_mongo charge charge_spot detonator trash barricade barricade_broken guard_statue tent_pole scratch_ticket custard ring_junk fire darkness_orb lock crate chest door door_open door_locked checkpoint sign cage cage_broken lever explosion hit dust sparkle shockwave smoke coin snack potion knife bolt worm spit dyn_stick hob jug psionic missile'.split(' ');
let missing = 0;
for (const [n, c] of need) {
  const d = defs[n], p = procs[n];
  const nf = d ? d.frames.length : p ? (p.frames || 1) : 0;
  if (!d && !p) { missing++; console.log('MISSING ' + n); }
  else if (nf < c) err(`${n} has ${nf} frames, want >= ${c}`);
  if (n.startsWith('p_') && d && (d.w !== 32 || d.h !== 32)) err(n + ' portrait not 32x32');
  if (n.startsWith('p_') && d && d.frames.length !== 3) err(n + ' portrait must have exactly 3 frames');
}
for (const n of Object.keys(defs)) if (n.startsWith('p_') && defs[n].frames.length !== 3) err(n + ' portrait must have exactly 3 frames');
for (const s of skinIds) if (!skins[s]) { missing++; console.log('MISSING skin ' + s); }
for (const n of artCoreOwned) if (defs[n] || procs[n]) err('defines art-core name ' + n);
// every carl_* def must use the shared Carl palette so skins recolour it
const cp = defs.carl_idle && defs.carl_idle.pal;
for (const n of Object.keys(defs)) if (n.startsWith('carl_') && defs[n].pal !== cp) err(n + ' does not share the Carl palette');
console.log(`defs ${Object.keys(defs).length}, procs ${Object.keys(procs).length}, skins ${Object.keys(skins).length}, carlChars ${D.artActorsKit.carlCharsUsed}, contract names ${need.length}, errors ${bad}, missing ${missing}`);
process.exit(bad || missing ? 1 : 0);

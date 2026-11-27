// Reachability checker (port of crawler-book1/tools/reach_test.js for Book Two): can Carl get from
// the left edge of every side-view chunk to its right edge (or its exit door) with the game's real
// physics (stage.js K values, 10x22 hitbox, 60 fps)? And from P to D in every climb / drop layout?
// It simulates runs and jumps of every height in both directions from every resting spot and BFS's
// over the landings. Arena chunks (boss K, survival, facade) are skipped: they are flat rooms.
// Climb / drop layouts also get the checkpoint rule (DESIGN 16.2): a 'c' at least every two screens.
// Usage: [COMFORT=1] node crawler2/tools/reach_test.js [chunkOrLevelId ...]
//   COMFORT=1: a human margin instead of frame-perfect inputs (82 px/s run instead of 95).
const path = require('path');
global.window = {}; window.DCW = { U: {} };
require(path.resolve(__dirname, '../js/data.js'));
const D = window.DCW.data;
const K = { gravity: 900, fallMax: 330, fallGravMul: 1.12, runMax: 95, accelGround: 1050, accelAir: 700, airFriction: 260, jumpV: 318, jumpCut: 0.42, coyote: 6 };
if (process.env.COMFORT) { K.runMax = 82; }
const TS = 16, PW = 10, PH = 22, DT = 1 / 60, SCREEN_H = 180;

// rows -> padded grid. side chunks: 4 tiles of standard ground on both sides so the chunk edges
// connect like real neighbours. layouts: no padding (their walls are their own).
function grid(rows, pad) {
  const h = rows.length, cw = Math.max.apply(null, rows.map(r => r.length)), w = cw + pad * 2;
  const g = [];
  for (let y = 0; y < h; y++) {
    const edge = y >= h - 2 ? '#' : '.';
    const row = (rows[y] + '.'.repeat(cw)).slice(0, cw);
    g.push((edge.repeat(pad) + row + edge.repeat(pad)).split(''));
  }
  // moving platforms: give them their whole sweep as one-way surface (generous on purpose)
  const virt = {};
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const c = g[y][x];
    if (c === '<' || c === '>') { for (let k = -4; k <= 5; k++) virt[y + ',' + (x + k)] = 1; g[y][x] = '.'; }
    if (c === 'v') { for (let k = -3; k <= 3; k++) for (let j = -1; j <= 2; j++) virt[(y + k) + ',' + (x + j)] = 1; g[y][x] = '.'; }
  }
  return { g, w, h, pad, virt };
}
function tile(G, tx, ty) { if (tx < 0 || tx >= G.w) return 'X'; if (ty < 0 || ty >= G.h) return '.'; return G.g[ty][tx]; }
// walls: '#' 'X' and guard statues 'G'. Crates 'b' break and gates 'L' open: standable, not walls.
const SOLID = c => c === '#' || c === 'X' || c === 'G';
const STAND = (G, tx, ty) => { const c = tile(G, tx, ty); return SOLID(c) || c === 'b' || c === '=' || (c === 'H' && tile(G, tx, ty - 1) !== 'H') || !!G.virt[ty + ',' + tx]; };
const HAZ = c => c === '^' || c === '~';

// simulate one input program; returns landing {x, feet} or null
// dropFr: frames that one-way floors are ignored (down+jump drops through them, as in stage.js)
function sim(G, x0, feet0, vx0, dirA, frA, dirB, hold, dropFr) {
  let x = x0, y = feet0 - PH, vx = vx0, vy = -K.jumpV, jumping = hold > 0, onGround = false;
  if (hold === 0) vy = 0;
  if (dropFr) { y += 3; vy = 0; jumping = false; }
  let left = false;
  for (let f = 0; f < 300; f++) {
    const dir = f < frA ? dirA : dirB;
    const grounded = onGround;
    const acc = grounded ? K.accelGround : K.accelAir;
    if (dir) vx = vx + Math.sign(dir * K.runMax - vx) * Math.min(Math.abs(dir * K.runMax - vx), acc * DT);
    else vx = vx + Math.sign(-vx) * Math.min(Math.abs(vx), (grounded ? 1200 : K.airFriction) * DT);
    if (jumping && vy < 0 && f >= hold) { vy *= K.jumpCut; jumping = false; }
    if (vy >= 0) jumping = false;
    vy = Math.min(vy + K.gravity * (vy > 0 ? K.fallGravMul : 1) * DT, K.fallMax);
    let nx = x + vx * DT;
    if (vx > 0) { const tx = Math.floor((nx + PW - 0.01) / TS); for (let ty = Math.floor(y / TS); ty <= Math.floor((y + PH - 0.01) / TS); ty++) if (SOLID(tile(G, tx, ty))) { nx = tx * TS - PW; vx = 0; break; } }
    else if (vx < 0) { const tx = Math.floor(nx / TS); for (let ty = Math.floor(y / TS); ty <= Math.floor((y + PH - 0.01) / TS); ty++) if (SOLID(tile(G, tx, ty))) { nx = (tx + 1) * TS; vx = 0; break; } }
    x = nx;
    const oldBottom = y + PH; let ny = y + vy * DT; onGround = false;
    if (vy >= 0) {
      const ty = Math.floor((ny + PH) / TS);
      for (let tx = Math.floor((x + 0.5) / TS); tx <= Math.floor((x + PW - 0.5) / TS); tx++) {
        const c = tile(G, tx, ty);
        if (SOLID(c) || ((c === 'b' || (!(dropFr && f < dropFr) && (c === '=' || (c === 'H' && tile(G, tx, ty - 1) !== 'H') || G.virt[ty + ',' + tx]))) && oldBottom <= ty * TS + 0.5)) { ny = ty * TS - PH; vy = 0; onGround = true; break; }
      }
    } else {
      const ty = Math.floor(ny / TS);
      for (let tx = Math.floor((x + 0.5) / TS); tx <= Math.floor((x + PW - 0.5) / TS); tx++) if (SOLID(tile(G, tx, ty))) { ny = (ty + 1) * TS; vy = 0; break; }
    }
    y = ny;
    // hazards (same test as stage.js afterMove): spikes bite 6 px below the cell top, liquid 4 px
    for (let ty = Math.floor((y + 2) / TS); ty <= Math.floor((y + PH + 0.5) / TS); ty++) for (let tx = Math.floor((x + 1) / TS); tx <= Math.floor((x + PW - 1) / TS); tx++) {
      const c = tile(G, tx, ty);
      if ((c === '^' && y + PH > ty * TS + 6) || (c === '~' && y + PH > ty * TS + 4)) return null;
    }
    if (y > G.h * TS) return null;                 // fell in a pit
    if (onGround) { if ((left || f > 2) && !(dropFr && Math.round(y + PH) <= feet0)) return { x: Math.round(x), feet: Math.round(y + PH) }; if (dropFr) return null; }
    else left = true;
  }
  return null;
}

// BFS from (startX, startFeet); goal(x, feet) -> bool. Returns { ok, best }
function search(G, startX, startFeet, goal) {
  const key = (x, f) => (x >> 1) + ':' + f;
  const seen = new Set([key(startX, startFeet)]), q = [[startX, startFeet]];
  let best = { x: startX, feet: startFeet };
  const ladders = [];
  for (let x = 0; x < G.w; x++) { let top = -1; for (let y = 0; y <= G.h; y++) { const c = y < G.h ? G.g[y][x] : '.'; if (c === 'H' && top < 0) top = y; if (c !== 'H' && top >= 0) { ladders.push({ x, top, bot: y }); top = -1; } } }
  const progs = [];
  for (const d of [-1, 0, 1]) for (const hold of [0, 3, 6, 9, 12, 16, 22]) {
    progs.push([d, 999, d, hold]);
    if (d !== 0) { progs.push([0, 10, d, hold]); progs.push([d, 12, 0, hold]); progs.push([d, 20, -d, hold]); }
  }
  let n = 0;
  while (q.length) {
    const [x, feet] = q.shift();
    if (++n > 60000) break;
    if (x > best.x || feet > best.feet + 64) best = { x, feet };
    if (goal(x, feet)) return { ok: true };
    const push = (nx, nf) => { const k = key(nx, nf); if (!seen.has(k)) { seen.add(k); q.push([nx, nf]); } };
    for (const [dA, fA, dB, hold] of progs) {
      for (const run of [0, 1]) {
        const vx0 = run ? dA * K.runMax : 0;
        if (hold === 0 && dA === 0) continue;
        if (hold === 0) { // walking: step 8px or walk off an edge
          const nx = x + dA * 8;
          const r = sim(G, x, feet, dA * K.runMax, dA, 999, dA, 0);
          const tx0 = Math.floor((nx + 0.5) / TS), tx1 = Math.floor((nx + PW - 0.5) / TS), ty = feet / TS;
          let blocked = false; for (let ty2 = Math.floor((feet - PH) / TS); ty2 < ty; ty2++) for (let tx = tx0; tx <= tx1; tx++) if (SOLID(tile(G, tx, ty2))) blocked = true;
          let ground = false; for (let tx = tx0; tx <= tx1; tx++) if (STAND(G, tx, ty)) ground = true;
          let haz = false; for (let ty2 = Math.floor((feet - PH) / TS); ty2 < ty; ty2++) for (let tx = Math.floor(nx / TS); tx <= Math.floor((nx + PW - 0.01) / TS); tx++) if (HAZ(tile(G, tx, ty2))) haz = true;
          if (!blocked && ground && !haz) push(nx, feet);
          else if (!blocked && !ground && r) push(r.x, r.feet);
          continue;
        }
        const r = sim(G, x, feet, vx0, dA, fA, dB, hold);
        if (r) push(r.x, r.feet);
      }
    }
    // down+jump on a one-way floor (or a ladder top) drops through it
    { const tx0 = Math.floor((x + 0.5) / TS), tx1 = Math.floor((x + PW - 0.5) / TS), ty = feet / TS; let pass = false, wall = false;
      for (let tx = tx0; tx <= tx1; tx++) { const c = tile(G, tx, ty); if (SOLID(c) || c === 'b') wall = true; if (c === '=' || c === 'H' || G.virt[ty + ',' + tx]) pass = true; }
      if (pass && !wall) for (const d of [-1, 0, 1]) { const r = sim(G, x, feet, 0, d, 999, d, 0, 13); if (r) push(r.x, r.feet); } }
    for (const L of ladders) {
      const lx = L.x * TS + 3;
      if (Math.abs(x - lx) < 12 && (feet === L.bot * TS || feet === L.top * TS || (feet > L.top * TS && feet <= L.bot * TS))) { push(lx, L.top * TS); push(lx, L.bot * TS); }
    }
  }
  return { ok: false, best };
}

function find(rows, ch) { for (let y = 0; y < rows.length; y++) { const x = rows[y].indexOf(ch); if (x >= 0) return { x, y }; } return null; }
function findAll(rows, ch) { const out = []; rows.forEach((r, y) => { for (let x = 0; x < r.length; x++) if (r[x] === ch) out.push({ x, y }); }); return out; }

// a side-view chunk: left edge -> right edge, or -> its exit door D when it has one
function checkChunk(rows) {
  const G = grid(rows, 4), h = rows.length;
  const startX = 8, startFeet = (h - 2) * TS;
  const dPos = find(rows, 'D');
  const goalX = (G.pad + rows[0].length) * TS + 8;
  const goal = dPos
    ? (x, feet) => Math.abs((x + PW / 2) - ((dPos.x + G.pad) * TS + 8)) < 14 && feet === (dPos.y + 1) * TS || x >= goalX
    : (x) => x >= goalX;
  const r = search(G, startX, startFeet, goal);
  return r.ok ? { ok: true } : { ok: false, reached: r.best.x - G.pad * TS, door: !!dPos };
}
// a climb / drop layout: P -> D
function checkLayout(rows) {
  const G = grid(rows, 0);
  const p = find(rows, 'P'), d = find(rows, 'D');
  if (!p || !d) return { ok: false, why: 'no P or no D' };
  const startX = p.x * TS + 8 - PW / 2;
  // P's feet: the first standable cell at or below P
  let fy = p.y + 1; while (fy < G.h && !STAND(G, p.x, fy)) fy++;
  const dx = d.x * TS + 8, dFeet = (() => { let y = d.y + 1; while (y < G.h && !STAND(G, d.x, y)) y++; return y * TS; })();
  const r = search(G, startX, fy * TS, (x, feet) => Math.abs((x + PW / 2) - dx) < 14 && Math.abs(feet - dFeet) <= TS);
  return r.ok ? { ok: true } : { ok: false, reached: { x: r.best.x, row: Math.round(r.best.feet / TS) } };
}
// checkpoint spacing in a vertical layout: P, every c, D sorted by row; a gap over two screens fails
function checkFlags(rows) {
  const ys = [find(rows, 'P'), find(rows, 'D')].filter(Boolean).map(o => o.y).concat(findAll(rows, 'c').map(o => o.y)).sort((a, b) => a - b);
  const bad = [];
  for (let i = 1; i < ys.length; i++) if ((ys[i] - ys[i - 1]) * TS > SCREEN_H * 2) bad.push('rows ' + ys[i - 1] + '-' + ys[i] + ' (' + ((ys[i] - ys[i - 1]) * TS) + ' px)');
  return bad;
}

const wanted = process.argv.slice(2);
const usedBy = {}, arena = new Set();
for (const lid in D.levels) {
  const lv = D.levels[lid], c = lv.chunks || {};
  if (lv.kind === 'rooms' || lv.kind === 'show' || lv.layout) continue;
  const list = [c.start, c.end].concat(c.pool || [], c.insert || []).filter(Boolean);
  list.forEach(k => { (usedBy[k] = usedBy[k] || []).push(lid); });
  if (lv.kind === 'survival' || lv.kind === 'facade') list.forEach(k => arena.add(k));
}
for (const k in D.chunks) { const rows = D.chunks[k].rows || D.chunks[k]; if (Array.isArray(rows) && rows.some(r => r.indexOf('K') >= 0)) arena.add(k); }
let bad = 0, n = 0;
for (const id of Object.keys(D.chunks)) {
  if (wanted.length && !wanted.includes(id)) continue;
  if (!wanted.length && (!usedBy[id] || arena.has(id))) continue;
  const rows = D.chunks[id].rows || D.chunks[id]; if (!Array.isArray(rows)) continue;
  n++;
  const r = checkChunk(rows);
  if (!r.ok) { bad++; console.log('BLOCKED chunk  ' + id.padEnd(22) + ' stuck around x=' + r.reached + 'px (tile ' + Math.floor(r.reached / TS) + ' of ' + rows[0].length + ')' + (r.door ? ', exit door not reached' : '') + '  used by ' + usedBy[id].join(',')); }
}
for (const lid in D.levels) {
  const lv = D.levels[lid];
  if (!lv.layout || !lv.layout.length) continue;
  if (wanted.length && !wanted.includes(lid)) continue;
  n++;
  const r = checkLayout(lv.layout);
  if (!r.ok) { bad++; console.log('BLOCKED layout ' + lid.padEnd(22) + ' (' + lv.kind + ') ' + (r.why || ('best reach: col ' + Math.floor(r.reached.x / TS) + ', row ' + r.reached.row))); }
  const fl = checkFlags(lv.layout);
  if (fl.length) { bad++; console.log('FLAGS   layout ' + lid.padEnd(22) + ' (' + lv.kind + ') no checkpoint c for over two screens: ' + fl.join('; ')); }
}
console.log(n + ' chunks/layouts checked, ' + bad + ' problems' + (process.env.COMFORT ? ' (COMFORT)' : ''));
process.exit(bad ? 1 : 0);

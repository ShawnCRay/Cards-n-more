// Reachability checker: can Carl actually get from the left edge of every chunk to the right
// edge with the game's real physics (stage.js K values, 10x22 hitbox, 60 fps, coyote time)?
// It simulates runs and jumps of every height in both directions from every resting spot, BFS
// over the landings, and reports chunks whose right edge (or exit door) can't be reached.
// Usage: [COMFORT=1] node crawler-book1/tools/reach_test.js [chunkId ...]   (default: every non-ride chunk)
const path = require('path');
global.window = {}; window.DCW = { U: {} };
require(path.resolve(__dirname, '../js/data.js'));
const D = window.DCW.data;
const K = { gravity: 900, fallMax: 330, fallGravMul: 1.12, runMax: 95, accelGround: 1050, accelAir: 700, airFriction: 260, jumpV: 318, jumpCut: 0.42, coyote: 6 };
// COMFORT=1: a human margin instead of frame-perfect inputs (slower run, a little less jump)
if (process.env.COMFORT) { K.runMax = 82; }
const TS = 16, PW = 10, PH = 22, DT = 1 / 60;

function grid(rows) {
  // pad 4 tiles of standard ground on both sides so the chunk edges connect like real neighbours
  const pad = 4, w = rows[0].length + pad * 2, h = rows.length;
  const g = [];
  for (let y = 0; y < h; y++) {
    let r = '';
    const edge = y >= 10 ? '#' : y === 0 ? 'X' : '.';
    r = edge.repeat(pad) + rows[y] + edge.repeat(pad);
    g.push(r.split(''));
  }
  // moving platforms: give them their whole sweep as one-way surface (generous on purpose)
  const virt = {};
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const c = g[y][x];
    if (c === '<' || c === '>') { for (let k = -4; k <= 5; k++) virt[(y) + ',' + (x + k)] = 1; g[y][x] = '.'; }
    if (c === 'v') { for (let k = -3; k <= 3; k++) for (let j = -1; j <= 2; j++) virt[(y + k) + ',' + (x + j)] = 1; g[y][x] = '.'; }
  }
  return { g, w, h, pad, virt };
}
function tile(G, tx, ty) { if (tx < 0 || tx >= G.w) return 'X'; if (ty < 0) return '.'; if (ty >= G.h) return '.'; return G.g[ty][tx]; }
const SOLID = c => c === '#' || c === 'X';           // crates 'b' break, gates 'L' open: not walls
const STAND = (G, tx, ty) => { const c = tile(G, tx, ty); return SOLID(c) || c === 'b' || c === '=' || c === 'H' && tile(G, tx, ty - 1) !== 'H' || !!G.virt[ty + ',' + tx]; };
const HAZ = c => c === '^' || c === '~';

// simulate one input program; returns landing {x, feet} or null
function sim(G, x0, feet0, vx0, dirA, frA, dirB, hold) {
  let x = x0, y = feet0 - PH, vx = vx0, vy = -K.jumpV, jumping = hold > 0, onGround = false, t = 0;
  if (hold === 0) vy = 0;
  let left = false;
  for (let f = 0; f < 240; f++) {
    const dir = f < frA ? dirA : dirB;
    const grounded = onGround;
    const acc = grounded ? K.accelGround : K.accelAir;
    if (dir) vx = vx + Math.sign(dir * K.runMax - vx) * Math.min(Math.abs(dir * K.runMax - vx), acc * DT);
    else vx = vx + Math.sign(-vx) * Math.min(Math.abs(vx), (grounded ? 1200 : K.airFriction) * DT);
    if (jumping && vy < 0 && f >= hold) { vy *= K.jumpCut; jumping = false; }
    if (vy >= 0) jumping = false;
    vy = Math.min(vy + K.gravity * (vy > 0 ? K.fallGravMul : 1) * DT, K.fallMax);
    // X
    let nx = x + vx * DT;
    if (vx > 0) { const tx = Math.floor((nx + PW - 0.01) / TS); for (let ty = Math.floor(y / TS); ty <= Math.floor((y + PH - 0.01) / TS); ty++) if (SOLID(tile(G, tx, ty))) { nx = tx * TS - PW; vx = 0; break; } }
    else if (vx < 0) { const tx = Math.floor(nx / TS); for (let ty = Math.floor(y / TS); ty <= Math.floor((y + PH - 0.01) / TS); ty++) if (SOLID(tile(G, tx, ty))) { nx = (tx + 1) * TS; vx = 0; break; } }
    x = nx;
    // Y
    const oldBottom = y + PH; let ny = y + vy * DT; onGround = false;
    if (vy >= 0) {
      const ty = Math.floor((ny + PH) / TS);
      for (let tx = Math.floor((x + 0.5) / TS); tx <= Math.floor((x + PW - 0.5) / TS); tx++) {
        const c = tile(G, tx, ty);
        if (SOLID(c) || ((c === 'b' || c === '=' || (c === 'H' && tile(G, tx, ty - 1) !== 'H') || G.virt[ty + ',' + tx]) && oldBottom <= ty * TS + 0.5)) { ny = ty * TS - PH; vy = 0; onGround = true; break; }
      }
    } else {
      const ty = Math.floor(ny / TS);
      for (let tx = Math.floor((x + 0.5) / TS); tx <= Math.floor((x + PW - 0.5) / TS); tx++) if (SOLID(tile(G, tx, ty))) { ny = (ty + 1) * TS; vy = 0; break; }
    }
    y = ny;
    // hazards: touching a spike or liquid cell ends the attempt
    // same test as stage.js afterMove: spikes bite 6px below the cell top, liquid 4px, inner 8px of the hitbox
    for (let ty = Math.floor((y + 2) / TS); ty <= Math.floor((y + PH + 0.5) / TS); ty++) for (let tx = Math.floor((x + 1) / TS); tx <= Math.floor((x + PW - 1) / TS); tx++) {
      const c = tile(G, tx, ty);
      if ((c === '^' && y + PH > ty * TS + 6) || (c === '~' && y + PH > ty * TS + 4)) return null;
    }
    if (y > G.h * TS) return null;                 // fell in a pit
    if (onGround) { if (left || f > 2) return { x: Math.round(x), feet: Math.round(y + PH) }; }
    else left = true;
  }
  return null;
}

function check(id, rows) {
  const G = grid(rows);
  const startX = 8, startFeet = 10 * TS;
  const key = (x, f) => (x >> 1) + ':' + f;
  const seen = new Set([key(startX, startFeet)]), q = [[startX, startFeet]];
  const goalX = (G.pad + rows[0].length) * TS + 8;
  let best = 0;
  // ladders: connect bottom and top of every ladder column
  const ladders = [];
  for (let x = 0; x < G.w; x++) { let top = -1; for (let y = 0; y <= G.h; y++) { const c = y < G.h ? G.g[y][x] : '.'; if (c === 'H' && top < 0) top = y; if (c !== 'H' && top >= 0) { ladders.push({ x, top, bot: y }); top = -1; } } }
  const progs = [];
  for (const d of [-1, 0, 1]) for (const hold of [0, 3, 6, 9, 12, 16, 22]) {
    progs.push([d, 999, d, hold]);
    if (d !== 0) { progs.push([0, 10, d, hold]); progs.push([d, 12, 0, hold]); progs.push([d, 20, -d, hold]); }
  }
  while (q.length) {
    const [x, feet] = q.shift();
    if (x > best) best = x;
    if (x >= goalX) return { ok: true };
    const push = (nx, nf) => { const k = key(nx, nf); if (!seen.has(k)) { seen.add(k); q.push([nx, nf]); } };
    for (const [dA, fA, dB, hold] of progs) {
      for (const run of [0, 1]) {
        const vx0 = run ? dA * K.runMax : 0;
        if (hold === 0 && dA === 0) continue;
        if (hold === 0) { // walking: step 8px or walk off an edge
          let nx = x + dA * 8;
          const r = sim(G, x, feet, dA * K.runMax, dA, 999, dA, 0);
          // a short step along flat ground
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
    // ladders
    for (const L of ladders) {
      const lx = L.x * TS + 3;
      if (Math.abs(x - lx) < 12 && (feet === L.bot * TS || feet === L.top * TS || (feet > L.top * TS && feet <= L.bot * TS))) { push(lx, L.top * TS); push(lx, L.bot * TS); }
    }
  }
  return { ok: false, reached: best - G.pad * TS };
}

const wanted = process.argv.slice(2);
const rideOnly = new Set();
const usedBy = {};
for (const sid in D.stages) { const s = D.stages[sid], c = s.chunks || {}; [c.start, c.end].concat(c.pool || [], c.insert || []).forEach(k => { if (!k) return; (usedBy[k] = usedBy[k] || []).push(sid); }); }
for (const k in usedBy) if (usedBy[k].every(sid => D.stages[sid].kind === 'ride')) rideOnly.add(k);
let bad = 0, n = 0;
for (const id of Object.keys(D.chunks)) {
  if (wanted.length && !wanted.includes(id)) continue;
  if (!wanted.length && (rideOnly.has(id) || !usedBy[id])) continue;
  const rows = D.chunks[id].rows; if (!rows) continue;
  n++;
  const r = check(id, rows);
  if (!r.ok) { bad++; console.log('BLOCKED ' + id.padEnd(18) + ' stuck around x=' + r.reached + 'px (tile ' + Math.floor(r.reached / TS) + ' of ' + rows[0].length + ')  used by ' + usedBy[id].join(',')); }
}
console.log(n + ' chunks checked, ' + bad + ' blocked');

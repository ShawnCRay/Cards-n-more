#!/usr/bin/env node
// Floor 10 race fairness check: drives a simulated food truck through every race stage
// (assembled like a run, many seeds) using the truck numbers from stage.js
// (36x18 body, jump vy -320 held, J pad vy -430 with the jump-release cut applied because
// nobody holds jump on a pad, gravity 900, fall cap 330, boost x1.45,
// oil spin-out 0.8 s, crates rammed above 50 px/s) and a simple "late jumper" driver who
// holds right and only presses jump when the road ends right in front of the truck.
// Reports falls (pits) per stage and the time to the finish line.
// Usage: node crawler/tools/data3_race_sim.js [--seeds=40] [--speed=170] [--verbose]
//   --speed=195 is the truck with the turbo kit; boost pads add x1.45 on top.
//   --fullpad: J pads keep their full arc (if stage.js stops cutting pad launches).
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ctx = { window: {} };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.resolve(__dirname, '../js/data.js'), 'utf8'), ctx);
const D = ctx.window.DCW.data;

const args = process.argv.slice(2);
const opt = (k, d) => { const a = args.find(x => x.startsWith('--' + k + '=')); return a ? +a.split('=')[1] : d; };
const SEEDS = opt('seeds', 40), VERBOSE = args.includes('--verbose'), FULLPAD = args.includes('--fullpad');
const TS = 16, DT = 1 / 60, GRAV = 900, FALLMAX = 330, TW = 36, TH = 18;

function hash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function assemble(id, seed) { // same as data_render.js
  const s = D.stages[id], r = rng(seed + hash(id)), order = [s.chunks.start];
  let prev = null;
  for (let i = 0; i < s.chunks.count; i++) { const o = s.chunks.pool.filter(p => p !== prev); const pick = o[Math.floor(r() * o.length)]; order.push(pick); prev = pick; }
  const ins = s.chunks.insert || [];
  if (ins.length) order.splice(1 + Math.floor(s.chunks.count / 2), 0, ...ins);
  order.push(s.chunks.end);
  const rows = Array.from({ length: 12 }, () => '');
  order.forEach(c => D.chunks[c].rows.forEach((row, y) => { rows[y] += row; }));
  return { order, rows: rows.map(r => r.split('')) };
}

function drive(id, seed, topSpeed) {
  const { rows, order } = assemble(id, seed);
  const H = rows.length, W = rows[0].length;
  const at = (tx, ty) => (ty < 0 || tx < 0 || tx >= W) ? '.' : ty >= H ? '.' : rows[ty][tx];
  const solid = (c) => c === '#' || c === 'X' || c === 'b';
  let sx = 0, sy = 0, finishX = W * TS - 48;
  rows.forEach((r, y) => r.forEach((c, x) => { if (c === 'P') { sx = x * TS + 8; sy = (y + 1) * TS; } if (c === 'F') finishX = x * TS + 8; }));
  const b = { x: sx - TW / 2, y: sy - TH, vx: 0, vy: 0, g: false };
  let hold = 0, t = 0, falls = 0, boost = 0, spin = 0, lastSafe = { x: b.x, y: b.y }, coins = 0, Q = false;
  const groundAhead = (px) => { // is there road under x=px at the truck's feet?
    const fy = Math.floor((b.y + b.h + 2) / TS);
    const c = at(Math.floor(px / TS), fy), c2 = at(Math.floor(px / TS), fy + 1);
    return solid(c) || c === '=' || solid(c2) || c2 === '=';
  };
  b.h = TH; b.w = TW;
  while (t < 240) {
    t += DT;
    if (boost > 0) boost -= DT; if (spin > 0) spin -= DT;
    const top = topSpeed * (boost > 0 ? 1.45 : 1);
    if (spin <= 0) b.vx = Math.min(top, b.vx + 140 * DT); else b.vx *= Math.pow(0.4, DT);
    if (boost > 0) b.vx = Math.max(b.vx, top * 0.9);
    // the driver jumps late: road ends within ~10 px of the front bumper
    if (b.g && spin <= 0 && !groundAhead(b.x + b.w + 10)) { b.vy = -320; b.g = false; hold = 0.4; }
    if (hold > 0) hold -= DT; else if (b.vy < -120 && !FULLPAD) b.vy += 900 * DT; // release cut
    b.vy = Math.min(b.vy + GRAV * DT, FALLMAX);
    // x move (crates get rammed)
    let nx = b.x + b.vx * DT;
    const ftx = Math.floor((nx + b.w - 0.01) / TS);
    for (let ty = Math.floor(b.y / TS); ty <= Math.floor((b.y + b.h - 0.01) / TS); ty++) {
      const c = at(ftx, ty);
      if (c === 'b' && b.vx > 50) { rows[ty][ftx] = '.'; b.vx *= 0.7; continue; }
      if (solid(c)) { nx = ftx * TS - b.w; b.vx = 0; break; }
    }
    b.x = nx;
    // y move
    const oldBottom = b.y + b.h; let ny = b.y + b.vy * DT; b.g = false;
    if (b.vy >= 0) {
      const ty = Math.floor((ny + b.h) / TS);
      for (let tx = Math.floor((b.x + 0.5) / TS); tx <= Math.floor((b.x + b.w - 0.5) / TS); tx++) {
        const c = at(tx, ty);
        if (solid(c) || (c === '=' && oldBottom <= ty * TS + 0.5)) { ny = ty * TS - b.h; b.vy = 0; b.g = true; break; }
      }
    } else {
      const ty = Math.floor(ny / TS);
      for (let tx = Math.floor((b.x + 0.5) / TS); tx <= Math.floor((b.x + b.w - 0.5) / TS); tx++) if (solid(at(tx, ty))) { ny = (ty + 1) * TS; b.vy = 0; break; }
    }
    b.y = ny;
    // pads / oil / pickups (16px cells right above ground)
    for (let tx = Math.floor(b.x / TS); tx <= Math.floor((b.x + b.w) / TS); tx++) for (let ty = Math.floor(b.y / TS); ty <= Math.floor((b.y + b.h - 1) / TS); ty++) {
      const c = at(tx, ty);
      if (c === 'Z') boost = 1.3;
      else if (c === 'J' && b.g) { b.vy = -430; b.g = false; }
      else if (c === 'O' && spin <= 0 && b.g) spin = 0.8;
      else if (c === 'o') { coins++; rows[ty][tx] = '.'; }
      else if (c === 'Q') { Q = true; rows[ty][tx] = '.'; }
    }
    if (b.g) {
      const l = Math.floor((b.x + 1) / TS), r = Math.floor((b.x + b.w - 1) / TS), fy = Math.floor((b.y + b.h + 1) / TS);
      if ((solid(at(l, fy)) || at(l, fy) === '=') && (solid(at(r, fy)) || at(r, fy) === '=')) lastSafe = { x: b.x, y: b.y };
    }
    if (b.y > H * TS + 8) { // pit: back up 110 px onto safe ground, slow restart
      falls++;
      if (VERBOSE) console.log('    ' + id + ' seed ' + seed + ': fell at tile ' + Math.floor(b.x / TS) + (boost > 0 ? ' (boosted)' : '') + ', last safe tile ' + Math.floor(lastSafe.x / TS));
      b.x = Math.max(8, lastSafe.x - 110); b.y = lastSafe.y; b.vy = 0; b.vx = 60;
      while (b.x > 8 && !groundAhead(b.x) ) b.x -= 16;
    }
    if (b.x + b.w >= finishX) return { t, falls, coins, Q, order, W };
  }
  return { t: Infinity, falls, coins, Q, order, W, where: 'tile ' + Math.round(b.x / TS) + ',' + Math.round(b.y / TS) };
}

let bad = 0;
const speed = opt('speed', D.truck ? D.truck.speed : 170);
const raceIds = Object.keys(D.stages).filter(k => D.stages[k].kind === 'race');
console.log('truck top speed ' + speed + ' px/s, ' + SEEDS + ' seeds per race, late-jump driver\n');
console.log('stage      tiles   avg time  worst  falls(total)  qi pickup   name');
for (const id of raceIds) {
  let tot = 0, worst = 0, falls = 0, tiles = 0, gotQ = 0, stuck = 0;
  const failSeeds = [];
  for (let k = 0; k < SEEDS; k++) {
    const seed = 12345 + k * 7919;
    const r = drive(id, seed, speed);
    tiles += r.W;
    if (!isFinite(r.t)) { stuck++; failSeeds.push(seed + ' (stuck at ' + r.where + ', ' + r.falls + ' falls) ' + r.order.join('>')); continue; }
    tot += r.t; worst = Math.max(worst, r.t); falls += r.falls; if (r.Q) gotQ++;
    if (r.falls) failSeeds.push(seed + ' (' + r.falls + ' falls) ' + r.order.join('>'));
  }
  const s = D.stages[id], done = SEEDS - stuck;
  const avg = done ? tot / done : Infinity;
  console.log(id.padEnd(10) + ' ' + String(Math.round(tiles / SEEDS)).padStart(5) + ' ' + avg.toFixed(1).padStart(9) + 's ' + worst.toFixed(1).padStart(5) + 's ' +
    String(falls).padStart(8) + (stuck ? ' +' + stuck + ' stuck' : '      ') + (s.questItem ? (gotQ + '/' + done).padStart(7) : '      -') + '   ' + s.name);
  if (stuck || falls) { bad++; if (VERBOSE) failSeeds.slice(0, 5).forEach(l => console.log('    ' + l)); }
}
console.log(bad ? '\n' + bad + ' race(s) had falls or got stuck with the simple driver (try --verbose)' : '\nOK - the late-jump driver finishes every race without falling');
process.exit(0);

// Headless test for js/stage.js using tools/stage_test.html + stage_fixtures.js.
// Usage: node crawler/tools/stage_test.js [screenshotDir]
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const OUT = process.argv[2] || path.resolve(__dirname, '../../../stage_shots');
fs.mkdirSync(OUT, { recursive: true });
const HTML = 'file://' + path.resolve(__dirname, 'stage_test.html');

let failures = 0;
function check(cond, msg, extra) {
  console.log((cond ? 'PASS ' : 'FAIL ') + msg + (extra !== undefined ? '  ' + JSON.stringify(extra) : ''));
  if (!cond) failures++;
}

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
  const errors = [];
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.type() + ': ' + m.text()); });
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));

  const ev = (fn, arg) => page.evaluate(fn, arg);
  const step = n => ev(n => DCW.stepFrames(n), n);
  const shot = name => page.screenshot({ path: path.join(OUT, name + '.png') });
  async function load(stage, extra) {
    await page.goto(HTML + '?manual&debug&stage=' + stage + (extra || ''));
    await page.waitForFunction(() => window.DCW && DCW.stage && DCW.stage.state);
    await step(2);
  }
  async function hold(keys, frames) {
    for (const k of keys) await page.keyboard.down(k);
    await step(frames);
    for (const k of keys) await page.keyboard.up(k);
  }
  async function tap(key, after) { await page.keyboard.down(key); await step(2); await page.keyboard.up(key); await step(after || 1); }
  const P = () => ev(() => { const p = DCW.stage.state.player; return { x: p.x, y: p.y, w: p.w, h: p.h, vx: p.vx, vy: p.vy, state: p.state, onGround: p.onGround, feet: p.y + p.h }; });
  const setP = o => ev(o => { const p = DCW.stage.state.player; Object.assign(p, o); p.vx = p.vx || 0; }, o);
  const log = () => ev(() => DCW.testLog);
  const run = () => ev(() => DCW.save.run);

  /* ---------- walk / jump / one-way / drop ---------- */
  await load('t_walk');
  check((await log()).say.length === 0, 'intro not shown on frame 2 (delayed)');
  await step(40);
  check((await log()).say.some(s => /TEST INTRO/.test(s)), 'stage intro line via ui.say');
  check((await log()).music[0] === 'floor1', 'music from floor def', (await log()).music);
  let p0 = await P();
  await hold(['ArrowRight'], 45);
  let p1 = await P();
  check(p1.x > p0.x + 40, 'walks right', { from: p0.x, to: p1.x });
  check(Math.abs(p1.vx - 95) < 2, 'top run speed ~95', p1.vx);
  await shot('01_walk');
  await hold([], 30);
  // jump onto one-way platform (cols 10-13, top y=112)
  await setP({ x: 185, y: 140, vx: 0, vy: 0 }); await step(10);
  await hold(['KeyZ'], 25); await step(30);
  p1 = await P();
  check(p1.onGround && Math.abs(p1.feet - 112) < 0.5, 'jumps onto one-way platform', p1);
  await shot('02_platform');
  // short hop vs full jump height
  await setP({ x: 100, y: 140, vx: 0, vy: 0 }); await step(10);
  let minY = 999; await page.keyboard.down('KeyZ'); for (let i = 0; i < 40; i++) { await step(1); minY = Math.min(minY, (await P()).feet); } await page.keyboard.up('KeyZ');
  check(160 - minY > 50 && 160 - minY < 60, 'full jump ~3.5 tiles', 160 - minY);
  await step(40);
  await page.keyboard.down('KeyZ'); await step(3); await page.keyboard.up('KeyZ');
  minY = 999; for (let i = 0; i < 40; i++) { await step(1); minY = Math.min(minY, (await P()).feet); }
  check(160 - minY < 30, 'tap jump is a short hop', 160 - minY);
  // drop through
  await setP({ x: 185, y: 90, vx: 0, vy: 0 }); await step(20);
  await page.keyboard.down('ArrowDown'); await tap('KeyZ', 30); await page.keyboard.up('ArrowDown');
  p1 = await P();
  check(Math.abs(p1.feet - 160) < 0.5, 'down+jump drops through one-way', p1.feet);

  /* ---------- sign, pause ---------- */
  await setP({ x: 50, y: 140 }); await step(10);
  await tap('ArrowUp', 2);
  check((await log()).say.some(s => /LICK THE WALLS/.test(s)), 'sign text via ui.say');
  await tap('Enter', 2);
  check((await log()).pause.length === 1 && (await log()).pause[0].canFlee === false, 'pause opens with canFlee=false', (await log()).pause);

  /* ---------- punch combo kills an enemy ---------- */
  await setP({ x: 60, y: 140, face: 1 }); await step(10);
  await ev(() => { const p = DCW.stage.state.player; DCW.stage.spawn('goblin', p.x + 26, 160); });
  await step(30);
  let kills = 0;
  for (let i = 0; i < 40 && kills < 1; i++) { await tap('KeyX', 6); kills = await ev(() => DCW.stage.state.kills); if (i === 1) await shot('03_punch'); }
  check(kills >= 1, 'punch combo kills goblin', kills);
  check((await ev(() => DCW.stage.state.maxCombo)) >= 2, 'combo counter chains', await ev(() => DCW.stage.state.maxCombo));
  await step(5); await shot('04_kill_poof');
  check((await log()).tracked['kill:goblin'] === 1, 'tracks kill:goblin');
  await step(60);
  check((await run()).gold > 0 || (await ev(() => DCW.stage.state.pickups.filter(p => p.kind === 'coin' && p.phys).length)) > 0, 'enemy dropped coins');

  /* ---------- ground kick ---------- */
  await ev(() => { const p = DCW.stage.state.player; DCW.stage.spawn('goblin_brute', p.x + 30, 160); });
  await step(5);
  await page.keyboard.down('ArrowDown'); await tap('KeyX', 30); await page.keyboard.up('ArrowDown');
  check((await log()).tracked.kick >= 1, 'down+attack kick hits (track kick)');
  await ev(() => DCW.stage.state.enemies.forEach(e => e.dead = true)); await step(2);

  /* ---------- stomp ---------- */
  await setP({ x: 100, y: 140, inv: 0, state: 'normal' }); await ev(() => DCW.save.run.hp = 12); await step(10);
  const trace = await ev(() => { const p = DCW.stage.state.player; const e = DCW.stage.spawn('goblin', p.x + 5, 160); e.speed = 0; p.y = e.y - 50; p.vy = 0;
    const r = []; for (let i = 0; i < 40; i++) { DCW.stepFrames(1); r.push([i, (p.y + p.h) | 0, p.vy | 0, p.state, p.x | 0, e.x | 0, e.y | 0, e.dead, DCW.save.run.hp]); } return r; });
  if (process.env.TRACE) trace.forEach(l => console.log(JSON.stringify(l)));
  check((await log()).tracked.stomp >= 1, 'falling on enemy head = stomp', (await log()).tracked.stomp);
  check((await run()).hp === 12, 'stomp did not hurt the player', (await run()).hp);
  await ev(() => DCW.stage.state.enemies.forEach(e => e.dead = true)); await step(2);

  /* ---------- diving air kick ---------- */
  await setP({ x: 100, y: 140, inv: 0, face: 1 }); await step(10);
  await ev(() => { const p = DCW.stage.state.player; const e = DCW.stage.spawn('goblin_brute', p.x + 40, 160); e.speed = 0; e.hp = 99; });
  await step(2);
  await hold(['KeyZ'], 14);
  await page.keyboard.down('ArrowDown'); await tap('KeyX', 2); await page.keyboard.up('ArrowDown');
  check((await P()).state === 'airkick', 'down+attack in air starts airkick', (await P()).state);
  await shot('05_airkick');
  await step(25);
  check((await log()).tracked.stomp >= 2, 'airkick hits and bounces (track stomp)', (await log()).tracked.stomp);
  await ev(() => DCW.stage.state.enemies.forEach(e => e.dead = true)); await step(30);

  /* ---------- bomb multi-kill ---------- */
  await setP({ x: 100, y: 140, inv: 0, face: 1 }); await step(10);
  await ev(() => { const p = DCW.stage.state.player; [72, 76, 80].forEach(d => { const e = DCW.stage.spawn('rat', p.x + d, 160); e.speed = 0; }); });
  const bombs0 = (await run()).bombs;
  await tap('KeyC', 1);
  check((await run()).bombs === bombs0 - 1, 'bomb consumed');
  let sawBomb = false;
  for (let i = 0; i < 80; i++) { await step(1); const n = await ev(() => DCW.stage.state.parts.filter(p => p.name === 'explosion').length); if (n && !sawBomb) { sawBomb = true; await shot('06_bomb'); } }
  check((await log()).tracked.bomb_kill >= 3 && (await log()).tracked.multi_bomb === 1, 'bomb kills 3 (bomb_kill, multi_bomb)', (await log()).tracked);
  // self damage
  const hpb = (await run()).hp;
  await setP({ inv: 0 }); await tap('KeyC', 1); await setP({ vx: 0 });
  await ev(() => { const b = DCW.stage.state.pproj[0]; b.vx = 0; b.vy = 0; b.x = DCW.stage.state.player.x; });
  await step(90);
  check((await run()).hp === hpb - 2, 'own bomb hurts player for 2', [(await run()).hp, hpb]);

  /* ---------- crate + chest ---------- */
  await setP({ x: 384, y: 140, inv: 0, face: 1 }); await step(20); // crate at col 25 (x 400)
  for (let i = 0; i < 3; i++) await tap('KeyX', 10);
  check((await log()).tracked.crate === 1, 'punching crate breaks it');
  await setP({ x: 258, y: 140, inv: 0, face: 1 }); await step(20); // chest at col 17 (x 272)
  for (let i = 0; i < 3; i++) await tap('KeyX', 10);
  check(await ev(() => DCW.stage.state.objects.some(o => o.kind === 'chest' && o.open)), 'punching chest opens it');
  await step(60); await shot('07_chest_coins');

  /* ---------- ladder ---------- */
  await setP({ x: 515, y: 140, vx: 0 }); await step(10);
  await hold(['ArrowUp'], 100);
  p1 = await P();
  check(p1.state === 'normal' && Math.abs(p1.feet - 80) < 0.5, 'climbs ladder to the top', p1);
  await hold(['ArrowRight'], 20);
  p1 = await P();
  check(p1.onGround && Math.abs(p1.feet - 80) < 0.5 && p1.x > 530, 'walks off ladder top onto ledge', p1);
  await shot('08_ladder');
  await setP({ x: 515, y: 60, vx: 0 }); await step(10);
  await hold(['ArrowDown'], 110);
  p1 = await P();
  check(Math.abs(p1.feet - 160) < 0.5, 'climbs down ladder', p1);
  // checkpoint at col 37
  await setP({ x: 594, y: 140 }); await step(5);
  check(await ev(() => DCW.stage.state.objects.some(o => o.kind === 'checkpoint' && o.on)), 'checkpoint activates');

  /* ---------- pit + respawn ---------- */
  const hp0 = (await run()).hp;
  await setP({ x: 780, y: 140, inv: 0 }); await step(5);
  await hold(['ArrowRight'], 50);
  await step(60);
  p1 = await P();
  check((await run()).hp === hp0 - 3, 'pit costs 3 hp', [hp0, (await run()).hp]);
  check(p1.state === 'normal' && p1.feet <= 160.5 && (await log()).tracked.fall === 1, 'respawned on safe ground', p1);
  await shot('09_respawn');

  /* ---------- moving platform carries ---------- */
  await ev(() => { const s = DCW.stage.state, pl = s.platforms[0], p = s.player; p.x = pl.x + 20; p.y = pl.y - p.h - 2; p.vy = 0; p.inv = 1; });
  await step(6);
  const carried = await ev(() => { const s = DCW.stage.state, p = s.player, pl = s.platforms[0], a = p.x - pl.x; DCW.stepFrames(20); return { rel0: a, rel1: p.x - pl.x, moved: pl.dx, on: Math.abs(p.y + p.h - pl.y) < 1 }; });
  check(carried.on && Math.abs(carried.rel0 - carried.rel1) < 0.5, 'moving platform carries player', carried);

  /* ---------- companion missile + special ---------- */
  await setP({ x: 1000, y: 140, inv: 0 }); await step(20);
  await ev(() => { const p = DCW.stage.state.player; for (let i = 0; i < 3; i++) DCW.stage.spawn('rat', p.x + 70 + i * 20, 160).speed = 0; });
  await step(90);
  check(((await log()).sfx.missile || 0) >= 1, 'donut fires magic missile', (await log()).sfx.missile);
  await ev(() => DCW.stage.state.special = 1);
  await tap('KeyV', 8); await shot('10_special');
  check((await log()).announce.includes('MAGIC MISSILE BARRAGE'), 'special announces name');
  await step(120);
  await shot('11_after_special');

  /* ---------- potion ---------- */
  await ev(() => { DCW.save.run.hp = 4; });
  await tap('KeyQ', 2);
  check((await run()).hp === 10 && (await log()).tracked.potion === 1, 'potion via game.usePotion', (await run()).hp);

  /* ---------- exit door ---------- */
  await ev(() => { const s = DCW.stage.state, d = s.objects.find(o => o.kind === 'door'), p = s.player; p.x = d.x + 6; p.y = d.y + d.h - p.h - 2; p.inv = 2; s.enemies.forEach(e => e.dead = true); });
  await step(5); await shot('12_door');
  await tap('ArrowUp', 30); await shot('13_victory');
  await step(120);
  let calls = (await log()).calls;
  check(calls.length === 1 && calls[0][0] === 'stageCleared', 'door -> stageCleared', calls);
  if (calls[0]) { const r = calls[0][1]; check(r.stageId === 't_walk' && r.kills >= 5 && r.damageTaken >= 5 && r.time > 0 && 'views' in r && 'gold' in r && 'secrets' in r && 'maxCombo' in r, 'result has fields', r); }

  /* ---------- death ---------- */
  await load('t_walk');
  await ev(() => { DCW.save.run.hp = 1; const p = DCW.stage.state.player; DCW.stage.spawn('goblin', p.x + 8, 160); });
  await step(40); await shot('14_dying');
  await step(150);
  calls = (await log()).calls;
  check(calls.length === 1 && calls[0][0] === 'playerDied' && calls[0][1].stageId === 't_walk', 'death -> playerDied', calls);

  /* ---------- boss fights (god mode, simple bot) ---------- */
  for (const [stage, label] of [['t_boss', 'ground boss'], ['t_boss2', 'flying boss']]) {
    await load(stage);
    await ev(() => DCW.stage.debugGod());
    const res = await ev(() => {
      const seen = {}, phases = {};
      const down = {};
      function key(code, on) { if (!!down[code] === on) return; down[code] = on; window.dispatchEvent(new KeyboardEvent(on ? 'keydown' : 'keyup', { code })); }
      let f = 0, said = 0, shotAt = {}, maxPhase = 0, lockedAt = -1;
      for (f = 0; f < 20000; f++) {
        const s = DCW.stage.state, p = s.player, B = s.boss;
        if (DCW.testLog.calls.length) break;
        if (B && B.move) { seen[B.move.name] = 1; }
        if (B) { phases[B.phase] = 1; maxPhase = Math.max(maxPhase, B.phase); }
        if (s.locked && lockedAt < 0) lockedAt = f;
        const tx = B && !B.dead ? B.x + B.w / 2 : p.x + 100;
        const dx = tx - (p.x + p.w / 2);
        const close = Math.abs(dx) < (B ? B.w / 2 + 14 : 20);
        key('ArrowRight', !close && dx > 0); key('ArrowLeft', !close && dx < 0);
        if (close && Math.abs(dx) > 2) { key(dx > 0 ? 'ArrowRight' : 'ArrowLeft', true); }
        key('KeyX', f % 8 < 3 && Math.abs(dx) < 60);
        key('KeyZ', (B && B.flying) ? (f % 50 < 22) : (f % 90 < 18));
        if (f % 400 === 0 && DCW.save.run.bombs < 1) DCW.save.run.bombs = 2;
        key('KeyC', f % 300 === 0);
        DCW.stepFrames(1);
      }
      ['ArrowRight', 'ArrowLeft', 'KeyX', 'KeyZ', 'KeyC'].forEach(c => key(c, false));
      return { frames: f, seen: Object.keys(seen).sort(), maxPhase, lockedAt, calls: DCW.testLog.calls, say: DCW.testLog.say, music: DCW.testLog.music, tracked: DCW.testLog.tracked };
    });
    const prims = ['walk', 'idle', 'charge', 'jump_slam', 'shoot', 'spread', 'rain', 'spawn', 'swoop', 'hover', 'teleport', 'laser', 'shockwave', 'summon_spikes'];
    const missing = prims.filter(m => !res.seen.includes(m));
    check(res.lockedAt >= 0, label + ': arena locks', res.lockedAt);
    check(res.music.includes('boss'), label + ': boss music', res.music);
    check(res.say.length >= 2, label + ': intro + defeat lines via ui.say', res.say);
    check(missing.length === 0, label + ': every move primitive ran', { missing, seen: res.seen });
    if (stage === 't_boss') check(res.maxPhase === 2, label + ': reached all 3 phases', res.maxPhase);
    const c = res.calls[0];
    check(c && c[0] === 'stageCleared' && c[1].boss === (stage === 't_boss' ? 'tboss' : 'tflyer'), label + ': win -> stageCleared with result.boss', { frames: res.frames, c });
  }
  // screenshots of boss telegraphs
  await load('t_boss');
  await ev(() => { DCW.stage.debugGod(); DCW.stage.debugWarpBoss(); });
  await step(80);
  await shot('15_boss_intro');
  const want = ['laser', 'summon_spikes', 'rain', 'charge', 'spread', 'shockwave'];
  for (const mv of want) {
    await ev(mv => { const B = DCW.stage.state.boss; B.active = true; B.move = { name: mv, a: mv === 'rain' ? 'rock' : 'fireball', b: '5', t: 0, sub: 0, st: 0, n: 0 }; }, mv);
    await step(mv === 'shockwave' ? 40 : mv === 'spread' ? 36 : 20);
    await shot('16_boss_' + mv + '_tele');
    await step(mv === 'laser' ? 36 : mv === 'summon_spikes' ? 32 : 22);
    await shot('17_boss_' + mv + '_fire');
  }
  await ev(() => { const B = DCW.stage.state.boss; B.hp = 1; B.flash = 0; });
  await ev(() => { const s = DCW.stage.state; const B = s.boss; B.move = { name: 'idle', a: '5', t: 0, sub: 0, st: 0 }; s.player.x = B.x - 14; s.player.face = 1; });
  for (let i = 0; i < 6; i++) await tap('KeyX', 5);
  await step(30); await shot('18_boss_dying');
  await step(150); await shot('19_boss_dead');

  /* ---------- other companions ---------- */
  for (const comp of ['mongo', 'katia', 'zev', 'squeaks']) {
    await load('t_empty', '&comp=' + comp);
    await ev(() => { const p = DCW.stage.state.player; p.inv = 0; for (let i = 0; i < 4; i++) DCW.stage.spawn('rat', p.x + 60 + i * 24, 160).speed = 0; DCW.stage.state.pickups.length; });
    await ev(() => { const p = DCW.stage.state.player; for (let i = 0; i < 3; i++) { /* drop some coins for magnet/fetch */ } });
    await step(150);
    await ev(() => DCW.stage.state.special = 1);
    await tap('KeyV', 20);
    await shot('20_comp_' + comp);
    await step(200);
    const st = await ev(() => { const s = DCW.stage.state; return { kills: s.kills, shield: s.player.shield, invuln: s.player.invuln, ann: DCW.testLog.announce.slice(-1)[0], dv: s.doubleViewsT }; });
    check(!!st.ann, comp + ': special fires (' + st.ann + ')', st);
  }

  /* ---------- dark stage + elites ---------- */
  await load('t_dark');
  await hold(['ArrowRight'], 60);
  await shot('21_dark');

  /* ---------- perf: 30 enemies ---------- */
  await load('t_empty');
  const perf = await ev(() => {
    const ids = ['rat', 'goblin', 'grub', 'bat', 'goblin_archer', 'goblin_brute', 'gargoyle', 'cultist', 'steam_goblin', 'swamp_troll'];
    const s = DCW.stage.state, p = s.player;
    for (let i = 0; i < 30; i++) {
      const e = DCW.stage.spawn(ids[i % ids.length], p.x + 40 + (i % 15) * 17, 160);
      if (e.flying) { e.y = 60 + (i % 3) * 14; e.baseY = e.y; }
    }
    DCW.stage.debugGod();
    DCW.stepFrames(10);
    const t0 = performance.now();
    for (let i = 0; i < 300; i++) DCW.stepFrames(1); // includes a full render each frame
    const t1 = performance.now();
    return { avg: (t1 - t0) / 300, alive: s.enemies.length, eproj: s.eproj.length };
  });
  await shot('22_perf_30');
  check(perf.avg < 8, '30 enemies frame time (update+render) well under 16ms', perf);

  check(errors.length === 0, 'zero console errors', errors.slice(0, 20));
  console.log(failures ? failures + ' FAILURES' : 'ALL PASS');
  await browser.close();
  process.exit(failures ? 1 : 0);
})();

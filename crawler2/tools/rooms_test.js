// Drives the Big Top rooms scene headless: a simple bot plays ring one for real (no god mode),
// then a god-mode run plays every ring and the vine finale to levelCleared; plus a death check
// and a bare run (no data.js, no game.js) for the fallback paths. Screenshots at 1x.
// Usage: node crawler2/tools/rooms_test.js [shotsDir] [--real]   (--real: let levelCleared run on into the game)
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const SHOTS = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2]
  : '/tmp/claude-0/-home-user-Cards-n-more/5126f6e1-8ae9-52b1-b560-09304b97a236/scratchpad/rooms/';
const REAL = process.argv.includes('--real');
fs.mkdirSync(SHOTS, { recursive: true });
const HARNESS = 'file://' + path.resolve(__dirname, 'rooms_harness.html');

async function open(browser, qs) {
  const page = await browser.newPage({ viewport: { width: 320, height: 180 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push('pageerror: ' + e.message + '\n' + (e.stack || '').split('\n').slice(0, 4).join('\n')));
  await page.goto(HARNESS + qs);
  await page.waitForTimeout(300);
  await page.evaluate(REAL => {
    window.__ends = [];
    if (window.DCW && DCW.game) {
      const lc = DCW.game.levelCleared, pd = DCW.game.playerDied;
      DCW.game.levelCleared = r => { window.__ends.push({ kind: 'cleared', r: r }); if (REAL) lc.call(DCW.game, r); };
      DCW.game.playerDied = r => { window.__ends.push({ kind: 'died', r: r }); if (REAL) pd.call(DCW.game, r); };
    }
  }, REAL);
  return { page, errors };
}
const step = (page, n) => page.evaluate(n => DCW.stepFrames(n), n);
const snap = (page, name) => page.locator('#screen').screenshot({ path: SHOTS + name + '.png' });
// close any dialog by pressing confirm
const clearModals = async page => {
  for (let i = 0; i < 40; i++) {
    const b = await page.evaluate(() => !!(DCW.ui && DCW.ui.blocking && DCW.ui.blocking()));
    if (!b) return;
    await page.evaluate(() => { DCW.pressKey('confirm', 2); DCW.stepFrames(4); });
  }
};
const info = page => page.evaluate(() => {
  const S = DCW.rooms.state; if (!S) return null;
  const r = (DCW.game && DCW.game.run) || DCW.save.run || {};
  return { phase: S.phase, ri: S.ri, hp: r.hp, kills: S.kills, enemies: S.enemies.length, pole: S.target ? S.target.hp : null,
    poison: S.finale ? +S.finale.poison.toFixed(2) : null, X: Math.round(S.carl.X), dead: S.carl.dead, done: S.done, views: S.views, ends: window.__ends.length };
});
// one bot decision: hold attack, dodge what is coming, drift to the pole lane
async function botTick(page, frames) {
  const act = await page.evaluate(() => {
    const S = DCW.rooms.state; if (!S || S.done) return null;
    const C = S.carl;
    let jump = false, duck = false, move = 0;
    S.shocks.forEach(w => { const d = Math.abs(Math.abs(C.X - w.X) - w.r); if (d < 50 && !w.hit) jump = true; });
    S.tend.forEach(t => {
      if (t.kind === 'sweep' && (t.st === 'sweep' || t.t > 0.6)) { if (t.low) jump = true; else duck = true; }
      if (t.kind === 'lane' && Math.abs(C.X - t.X) < 30) move = C.X > t.X ? 1 : -1;
    });
    S.enemies.forEach(e => { if (e.mode === 'stilt' && e.st === 'wind' && Math.abs(C.X - e.X) < 60) duck = true; });
    S.eproj.forEach(q => { if (Math.abs(C.X - q.X1) < 16) move = C.X > q.X1 ? 1 : -1; });
    S.enemies.forEach(e => { if (e.mode === 'charger' && (e.st === 'wind' || e.st === 'charge') && Math.abs(C.X - e.X) < 34) move = C.X > e.X ? 1 : -1; });
    if (!move && !duck) { const goal = S.finale ? 60 * Math.sin(S.t * 0.7) : 0; if (Math.abs(C.X - goal) > 8) move = C.X < goal ? 1 : -1; }
    return { jump, duck, move, bomb: Math.random() < 0.02 };
  });
  if (!act) return false;
  await page.evaluate(([a, n]) => {
    if (a.jump) DCW.pressKey('jump', 1);
    if (a.bomb) DCW.pressKey('bomb', 1);
    const b = a.duck ? 'down' : a.move > 0 ? 'right' : a.move < 0 ? 'left' : null;
    if (b) DCW.pressKey(b, n); else DCW.stepFrames(n);
  }, [act, frames]);
  return true;
}

(async () => {
  const browser = await chromium.launch();
  const report = [];

  /* ---- 1: real play in ring one (no god), screenshots ---- */
  {
    const { page, errors } = await open(browser, '?debug&level=a1_bigtop');
    await step(page, 40); await snap(page, '01_enter'); await clearModals(page);
    await page.keyboard.down('KeyX'); // hold attack: Carl keeps throwing junk
    let shots = 0, t0 = Date.now();
    for (let i = 0; i < 300; i++) {
      if (!(await botTick(page, 6))) break;
      await clearModals(page);
      if (i === 60 || i === 130 || i === 220) await snap(page, '02_ring1_' + (shots++));
      const s = await info(page);
      if (s && (s.dead || s.done || s.ri > 0)) break;
    }
    await page.keyboard.up('KeyX');
    const s1 = await info(page);
    report.push(['ring one, real play 30 s', JSON.stringify(s1)]);
    await snap(page, '03_ring1_end');
    report.push(['errors', errors.length ? errors.join('\n') : 'none']);
    await page.close();
  }

  /* ---- 2: god mode through every ring and the finale ---- */
  {
    const { page, errors } = await open(browser, '?debug&level=a1_bigtop');
    await step(page, 30); await clearModals(page);
    await page.evaluate(() => DCW.rooms.debugGod());
    await page.keyboard.down('KeyX');
    let lastRi = 0, shot = 0, ringT = 0, finShots = 0;
    for (let i = 0; i < 2400; i++) {
      if (!(await botTick(page, 6))) { await step(page, 6); }
      await clearModals(page);
      const s = await info(page);
      if (!s) break;
      if (s.ends) break;
      if (s.ri !== lastRi) { lastRi = s.ri; ringT = 0; await snap(page, '10_ring' + s.ri + '_start'); }
      ringT++;
      if (s.phase === 'fight' && ringT === 90) await snap(page, '11_ring' + s.ri + '_fight');
      if (s.phase === 'poleDown' && !shot) { shot = 1; await snap(page, '12_ring' + s.ri + '_poledown'); }
      if (s.phase !== 'poleDown') shot = 0;
      // keep it quick: after 25 s of a ring, force the pole down (still exercises the break + advance)
      if (s.phase === 'fight' && ringT > 250) await page.evaluate(() => DCW.rooms.debugClear());
      if (s.phase === 'finale' && [20, 120, 260, 380].includes(ringT)) await snap(page, '20_finale_' + (finShots++));
      if (s.phase === 'vineDie' && ringT % 40 === 0) await snap(page, '21_vinedie_' + ringT);
    }
    await page.keyboard.up('KeyX');
    for (let i = 0; i < 40; i++) { await clearModals(page); await step(page, 10); const e = await page.evaluate(() => window.__ends.length); if (e) break; }
    const ends = await page.evaluate(() => window.__ends);
    report.push(['god run end', JSON.stringify(ends)]);
    report.push(['god run state', JSON.stringify(await info(page))]);
    report.push(['errors', errors.length ? errors.join('\n') : 'none']);
    await page.close();
  }

  /* ---- 3: death path ---- */
  {
    const { page, errors } = await open(browser, '?debug&level=a1_bigtop');
    await step(page, 30); await clearModals(page);
    await page.evaluate(() => { const r = DCW.game.run; r.hp = 1; const S = DCW.rooms.state; S.phase = 'fight'; S.carl.inv = 0; for (let i = 0; i < 4; i++) DCW.rooms.spawn('fat_clown', 0, 0.85); });
    for (let i = 0; i < 120; i++) { await step(page, 6); await clearModals(page); const e = await page.evaluate(() => window.__ends.length); if (e) break; }
    await snap(page, '30_death');
    report.push(['death end', JSON.stringify(await page.evaluate(() => window.__ends))]);
    report.push(['errors', errors.length ? errors.join('\n') : 'none']);
    await page.close();
  }

  /* ---- 4: bare (no data.js, no game.js) ---- */
  {
    const { page, errors } = await open(browser, '?bare&scene=rooms');
    await step(page, 60); await clearModals(page);
    await page.keyboard.down('KeyX');
    for (let i = 0; i < 150; i++) { if (!(await botTick(page, 6))) break; await clearModals(page); }
    await snap(page, '40_bare');
    await page.evaluate(() => { DCW.rooms.debugGod(); });
    for (let i = 0; i < 1400; i++) {
      const s = await info(page); if (!s || s.done) break;
      if (s.phase === 'fight') await page.evaluate(() => DCW.rooms.debugClear());
      if (s.phase === 'finale') await page.evaluate(() => DCW.rooms.debugClear());
      await step(page, 10); await clearModals(page);
    }
    await page.keyboard.up('KeyX');
    report.push(['bare end', JSON.stringify(await info(page))]);
    await snap(page, '41_bare_end');
    report.push(['errors', errors.length ? errors.join('\n') : 'none']);
    await page.close();
  }

  /* ---- 5: staged moments for screenshots (each mechanic on screen) ---- */
  {
    const { page, errors } = await open(browser, '?debug&level=a1_bigtop');
    await step(page, 30); await clearModals(page);
    await page.evaluate(() => { const S = DCW.rooms.state; DCW.rooms.debugGod(); S.phase = 'fight'; S.spawnT = 99; S.room.max = 0; });
    await page.evaluate(() => { DCW.rooms.spawn('lemur'); DCW.rooms.spawn('lemur'); DCW.rooms.spawn('stilt_clown', -40, 0.86); DCW.rooms.spawn('fat_clown', 60, 0.88); DCW.rooms.spawn('mold_lion', 20, 0.3); });
    for (const [n, f] of [[40, '50_staged_a'], [50, '51_staged_b'], [40, '52_staged_c'], [40, '53_staged_d']]) { await step(page, n); await clearModals(page); await snap(page, f); }
    // bombs: jug fire strip, dynamite, smoke
    await page.evaluate(() => { const r = DCW.game.run; r.items.dyn = 3; r.items.smoke = 2; r.items.jug = 3; r.selected = 'jug'; });
    await page.evaluate(() => { DCW.pressKey('bomb', 2); DCW.stepFrames(40); });
    await snap(page, '54_jug');
    await page.evaluate(() => { DCW.game.run.selected = 'dyn'; DCW.pressKey('bomb', 2); DCW.stepFrames(70); });
    await snap(page, '55_dyn');
    await page.evaluate(() => { DCW.rooms.state.special = 1; DCW.pressKey('special', 2); DCW.stepFrames(20); });
    await snap(page, '56_panic');
    // finale: lane lash + sweep telegraph + worms + Apollon
    await page.evaluate(() => { const S = DCW.rooms.state; S.ri = 2; S.rd.rooms.length = 3; S.enemies.length = 0; S.target = null; });
    await page.evaluate(() => { DCW.rooms.state.phase = 'advance'; DCW.rooms.state.pt = 2; DCW.stepFrames(2); });
    for (let i = 0; i < 12; i++) { await clearModals(page); await step(page, 10); }
    await page.evaluate(() => { const S = DCW.rooms.state; S.tend.push({ kind: 'lane', X: S.carl.X + 30, st: 'warn', t: 0.5, k: 0, hit: false, dmg: 3 }); S.tend.push({ kind: 'sweep', side: 1, low: true, st: 'warn', t: 0.2, x: 0, hit: false, dmg: 3 }); });
    await step(page, 22); await snap(page, '57_finale_lash');
    await step(page, 30); await snap(page, '58_finale_sweep');
    report.push(['staged', JSON.stringify(await info(page))]);
    report.push(['errors', errors.length ? errors.join('\n') : 'none']);
    await page.close();
  }

  report.forEach(r => console.log(r[0] + ': ' + r[1]));
  console.log('shots in ' + SHOTS);
  await browser.close();
})();

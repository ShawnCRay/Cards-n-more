// Drives the Danger Zone talk show headless: plays the whole script answering through the
// in-scene choice box, lets one question time out (dead air), checks the blast paths
// (in-scene blast, level.outro skip, show.blast cinema) and a bare run (no data, no game).
// Screenshots at 1x. Usage: node crawler2/tools/show_test.js [shotsDir] [--real]
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const SHOTS = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2]
  : '/tmp/claude-0/-home-user-Cards-n-more/5126f6e1-8ae9-52b1-b560-09304b97a236/scratchpad/show/';
const REAL = process.argv.includes('--real');
fs.mkdirSync(SHOTS, { recursive: true });
const HARNESS = 'file://' + path.resolve(__dirname, 'rooms_harness.html');

async function open(browser, qs, setup) {
  const page = await browser.newPage({ viewport: { width: 320, height: 180 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push('pageerror: ' + e.message + '\n' + (e.stack || '').split('\n').slice(0, 4).join('\n')));
  await page.goto(HARNESS + qs);
  await page.waitForTimeout(300);
  await page.evaluate(REAL => {
    window.__ends = []; window.__cinemas = [];
    if (window.DCW && DCW.game) {
      const lc = DCW.game.levelCleared, pc = DCW.game.playCinema;
      DCW.game.levelCleared = r => { window.__ends.push({ kind: 'cleared', r: r, boxes: (DCW.game.run.boxes || []).map(b => b.tier) }); if (REAL) lc.call(DCW.game, r); };
      DCW.game.playCinema = (id, cb) => { window.__cinemas.push(id); pc.call(DCW.game, id, cb); };
    }
  }, REAL);
  if (setup) await page.evaluate(setup);
  return { page, errors };
}
const step = (page, n) => page.evaluate(n => DCW.stepFrames(n), n);
const snap = (page, name) => page.locator('#screen').screenshot({ path: SHOTS + name + '.png' });
const st = page => page.evaluate(() => {
  const S = DCW.show.state; if (!S) return null;
  return { q: S.q.length, busy: S.busy, choice: !!S.choice, seg: S.segI, total: S.total, cut: !!S.cutin, blast: !!S.blast, done: S.done, sent: S.sent,
    blocking: !!(DCW.ui && DCW.ui.blocking && DCW.ui.blocking()), ends: window.__ends.length, scene: DCW.scene === DCW.show.scene ? 'show' : 'other' };
});

// play to the end; answers: array of answer indexes per segment (null = let it time out)
async function playShow(page, answers, tag, shots) {
  let lastSeg = -2, said = 0, cutShot = false, booShot = false, blastShot = 0, i;
  for (i = 0; i < 3000; i++) {
    const s = await st(page);
    if (!s) break;
    if (s.ends) break;
    if (s.scene !== 'show' && !s.blocking) { await step(page, 10); continue; }
    if (s.choice) {
      if (s.seg !== lastSeg) {
        lastSeg = s.seg;
        await step(page, 12);
        if (shots) await snap(page, tag + '_q' + s.seg);
        const a = answers[s.seg];
        if (a === null || a === undefined) { await step(page, 60 * 16); continue; } // dead air
        for (let k = 0; k < a; k++) await page.evaluate(() => { DCW.pressKey('down', 2); DCW.stepFrames(2); });
        await page.evaluate(() => DCW.pressKey('confirm', 2));
      } else await step(page, 4);
      continue;
    }
    if (s.cut && shots && !cutShot) { await step(page, 30); cutShot = true; await snap(page, tag + '_cutin'); }
    if (s.blast && shots && blastShot < 3) { await step(page, 40); await snap(page, tag + '_blast' + (blastShot++)); }
    if (s.blocking) {
      said++;
      if (shots && (said === 2 || said === 9)) { await step(page, 70); await snap(page, tag + '_talk' + said); }
      const boo = await page.evaluate(() => DCW.show.state.crowd === 'boo' && DCW.show.state.crowdT > 1);
      if (shots && boo && !booShot) { booShot = true; await snap(page, tag + '_boo'); }
      await page.evaluate(() => { DCW.pressKey('confirm', 2); DCW.stepFrames(3); });
      continue;
    }
    await step(page, 6);
  }
  return i;
}

(async () => {
  const browser = await chromium.launch();
  const report = [];

  /* 1: the whole show, in-scene blast, best-ish answers + one boo + one dead air */
  {
    const { page, errors } = await open(browser, '?debug&level=a2_danger_zone');
    await step(page, 50); await snap(page, '01_open');
    const n = await playShow(page, [0, 2, 1, null], '1', true);
    const ends = await page.evaluate(() => window.__ends);
    report.push(['show run 1 (' + n + ' iters)', JSON.stringify(ends)]);
    report.push(['errors', errors.length ? errors.join('\n') : 'none']);
    await page.close();
  }
  /* 2: best answers -> fan box; level.outro set -> no in-scene blast */
  {
    const { page, errors } = await open(browser, '?debug&level=a2_danger_zone');
    await page.evaluate(() => { DCW.data.levels.a2_danger_zone.outro = 'trailer_blast'; DCW.setScene(DCW.show.scene, { levelId: 'a2_danger_zone' }); });
    await step(page, 30);
    await playShow(page, [0, 0, 1, 0], '2', false);
    const ends = await page.evaluate(() => ({ ends: window.__ends, blast: !!DCW.show.state.blast }));
    report.push(['show run 2 (outro set, best answers)', JSON.stringify(ends)]);
    report.push(['errors', errors.length ? errors.join('\n') : 'none']);
    await page.close();
  }
  /* 3: show.blast cinema present -> DCW.game.playCinema, then levelCleared */
  {
    const { page, errors } = await open(browser, '?debug&level=a2_danger_zone');
    await page.evaluate(() => {
      DCW.data.cinema = DCW.data.cinema || {};
      DCW.data.cinema.trailer_blast = [{ bg: 'studio', lines: [{ who: 'SYSTEM AI', text: 'TEST CINEMA: THE TRAILER GOES BOOM.' }], wait: 0.5 }];
      DCW.setScene(DCW.show.scene, { levelId: 'a2_danger_zone' });
      DCW.show.debugClear();
    });
    for (let i = 0; i < 200; i++) { await page.evaluate(() => { DCW.pressKey('confirm', 2); DCW.stepFrames(8); }); if (await page.evaluate(() => window.__ends.length)) break; }
    report.push(['show run 3 (blast cinema)', JSON.stringify(await page.evaluate(() => ({ cinemas: window.__cinemas, ends: window.__ends })))]);
    report.push(['errors', errors.length ? errors.join('\n') : 'none']);
    await page.close();
  }
  /* 4: bare: no data.js, no game.js -> fallback script, local result */
  {
    const { page, errors } = await open(browser, '?bare&scene=show');
    await step(page, 30);
    await playShow(page, [1, 0, 2, 0], '4', false);
    for (let i = 0; i < 80; i++) { const s = await st(page); if (s.done) break; await page.evaluate(() => { DCW.pressKey('confirm', 2); DCW.stepFrames(10); }); }
    await snap(page, '4_end');
    report.push(['bare', JSON.stringify(await page.evaluate(() => ({ done: DCW.show.state.done, result: DCW.show.state.result, msg: DCW.show.state.fallbackMsg })))]);
    report.push(['errors', errors.length ? errors.join('\n') : 'none']);
    await page.close();
  }
  report.forEach(r => console.log(r[0] + ': ' + r[1]));
  console.log('shots in ' + SHOTS);
  await browser.close();
})();

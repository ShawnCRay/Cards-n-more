// Camera motion meter: how much does the screen slide that the player didn't ask for?
// Warps to a stage's boss (or runs a main stage) with god mode and measures camera travel,
// direction reversals and how often the view moves while Carl stands still.
// Usage: node crawler-book1/tools/cam_test.js <stageId> [idle|fight|run] [frames]
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const id = process.argv[2] || 'f1_workshop', mode = process.argv[3] || 'fight', N = +(process.argv[4] || 900);
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('file://' + path.resolve(__dirname, '../index.html') + '?debug&god&stage=' + id);
  await page.waitForTimeout(300);
  const step = n => page.evaluate(n => DCW.stepFrames(n), n);
  const closeModals = async () => { for (let i = 0; i < 40 && await page.evaluate(() => DCW.ui.blocking && DCW.ui.blocking()); i++) { await page.evaluate(() => DCW.pressKey('confirm', 2)); await step(6); } };
  await step(30); await closeModals();
  const boss = await page.evaluate(() => !!DCW.stage.state.def.boss);
  if (boss && mode !== 'run') { await page.evaluate(() => DCW.stage.debugWarpBoss()); await step(10); for (let i = 0; i < 60 && !(await page.evaluate(() => DCW.stage.state.locked)); i++) { await page.evaluate(() => { DCW.testHold = { right: 1 }; }); await step(5); } await page.evaluate(() => { DCW.testHold = {}; }); await step(30); await closeModals(); await step(30); await closeModals(); }
  const r = await page.evaluate(([mode, N]) => {
    const S = DCW.stage.state; let last = S.cam.x, lastY = S.cam.y, travel = 0, travelY = 0, still = 0, stillMove = 0, rev = 0, dir = 0, lastPx = S.player.x;
    for (let f = 0; f < N; f++) {
      if (mode === 'fight') DCW.testHold = (Math.floor(f / 40) % 2) ? { left: 1, attack: f % 10 < 2 ? 1 : 0 } : { right: 1, attack: f % 10 < 2 ? 1 : 0 };
      else if (mode === 'turn') DCW.testHold = (Math.floor(f / 40) % 2) ? { left: f % 40 < 3 ? 1 : 0, attack: f % 10 < 2 ? 1 : 0 } : { right: f % 40 < 3 ? 1 : 0, attack: f % 10 < 2 ? 1 : 0 };
      else if (mode === 'run') DCW.testHold = { right: 1, jump: f % 50 < 12 ? 1 : 0 };
      else DCW.testHold = {};
      DCW.stepFrames(1);
      const cx = Math.round(S.cam.x), cy = Math.round(S.cam.y), d = cx - Math.round(last);
      travel += Math.abs(d); travelY += Math.abs(cy - Math.round(lastY));
      const pMoved = Math.abs(S.player.x - lastPx) > 0.05;
      if (!pMoved) { still++; if (d) stillMove++; }
      if (d) { const s = Math.sign(d); if (dir && s !== dir) rev++; dir = s; }
      last = S.cam.x; lastY = S.cam.y; lastPx = S.player.x;
    }
    DCW.testHold = {};
    return { locked: !!S.locked, theme: S.theme, camTravelPx: travel, camTravelYPx: travelY, reversals: rev, framesPlayerStill: still, framesCamMovedWhilePlayerStill: stillMove };
  }, [mode, N]);
  console.log(id, mode, JSON.stringify(r));
  if (errors.length) console.log('ERRORS', errors.join('\n'));
  await browser.close();
})();

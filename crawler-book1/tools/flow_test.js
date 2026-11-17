// Walks the whole of Book One through the real game flow: every cutscene, safe room and stage
// in sequence order (stages are cleared through DCW.game.stageCleared, cutscenes skipped with
// START after their first panel is captured). Reports the step order, missing ids, dead ends
// and console errors, and saves a screenshot of every cutscene and safe room.
// Usage: node crawler-book1/tools/flow_test.js <outDir> [--intro]
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
(async () => {
  const out = process.argv[2] || '.';
  const withIntro = process.argv.includes('--intro');
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
  const errors = [];
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.type() + ': ' + m.text()); });
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  await page.goto('file://' + path.resolve(__dirname, '../index.html') + (withIntro ? '' : '?skipintro'));
  await page.evaluate(() => { localStorage.clear(); DCW.resetSave(); });
  await page.waitForTimeout(200);
  const scn = () => page.evaluate(() => {
    const s = DCW.scene, U = DCW.ui.scenes;
    for (const k in U) if (U[k] === s) return k;
    if (DCW.stage && s === DCW.stage.scene) return 'stage';
    return '?';
  });
  const step = n => page.evaluate(n => DCW.stepFrames(n), n);
  const press = async (b, f = 2) => { await page.evaluate(([b, f]) => DCW.pressKey(b, f), [b, f]); };
  const closeModals = async () => { for (let i = 0; i < 40 && await page.evaluate(() => DCW.ui.blocking()); i++) { await press('confirm'); await step(8); } };
  await page.evaluate(() => DCW.game.newRun());
  await step(40);
  const log = [];
  let shots = 0, last = '', same = 0;
  for (let guard = 0; guard < 600; guard++) {
    const s = await scn();
    const info = await page.evaluate(() => { const r = DCW.game.run; return r ? { floor: r.floor, seq: r.seqIndex, stage: r.currentStage, room: r.room, won: r.won, hp: r.hp, level: r.level, gear: Object.keys(r.gear || {}), flags: Object.keys(r.flags || {}), boxes: r.boxes.length } : null; });
    const key = s + ':' + JSON.stringify(info && [info.floor, info.seq, info.stage]);
    if (key === last) { same++; } else { same = 0; last = key; log.push(s + ' ' + JSON.stringify(info)); }
    if (same > 25) { log.push('STUCK at ' + key); break; }
    if (s === 'ending') { log.push('REACHED ENDING'); await page.screenshot({ path: path.join(out, String(shots++).padStart(2, '0') + '_ending.png') }); break; }
    if (s === 'cutscene') {
      if (same === 0) { await step(50); await page.screenshot({ path: path.join(out, String(shots++).padStart(2, '0') + '_cut_' + (await page.evaluate(() => DCW.ui.scenes.cutscene.id || (DCW.ui.scenes.cutscene.p && DCW.ui.scenes.cutscene.p.id) || 'x')) + '.png') }); }
      await closeModals(); await press('start'); await step(40); continue;
    }
    if (s === 'safeRoom') {
      if (same === 0) { await step(30); await page.screenshot({ path: path.join(out, String(shots++).padStart(2, '0') + '_safe_' + info.room + '.png') }); }
      await closeModals();
      await page.evaluate(() => { DCW.ui.closeAll && DCW.ui.closeAll(); DCW.game.leaveSafeRoom(); });
      await step(40); continue;
    }
    if (s === 'stage') {
      await closeModals(); await step(10);
      await page.evaluate(() => { const r = DCW.game.run; DCW.game.stageCleared({ stageId: r.currentStage, kills: 3, time: 60, damageTaken: 1, maxCombo: 4, views: 0, gold: 0, secrets: 0 }); });
      await step(40); continue;
    }
    if (s === 'results' || s === 'floorCard' || s === 'nameEntry' || s === 'intro') { await closeModals(); await press('confirm'); await step(25); await press('start'); await step(25); continue; }
    await closeModals(); await press('confirm'); await step(20);
  }
  const fin = await page.evaluate(() => { const r = DCW.game.run; const m = DCW.save.meta; return { run: r && { floor: r.floor, level: r.level, won: r.won, gear: Object.keys(r.gear || {}), flags: Object.keys(r.flags || {}), boxes: r.boxes.length, biscuits: r.biscuits }, achievements: Object.keys(m.achievements || {}) }; });
  console.log(log.join('\n'));
  console.log('FINAL', JSON.stringify(fin));
  console.log(errors.length ? 'ERRORS:\n' + [...new Set(errors)].slice(0, 30).join('\n') : 'no console errors');
  await browser.close();
})();

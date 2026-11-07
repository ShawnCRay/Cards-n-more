// Full-run flow test: walks a run from title through every floor by forcing stage clears,
// visiting safe rooms, overworld entrances, the stairwell and the ending. Reports errors.
// Usage: node crawler/tools/flow_test.js [maxFloor]
const { chromium } = require('playwright');
const path = require('path');
const SHOTS = '/tmp/claude-0/-home-user-Cards-n-more/b83025b8-a245-5c35-8e64-17484dc5caba/scratchpad/flow/';
require('fs').mkdirSync(SHOTS, { recursive: true });
(async () => {
  const maxFloor = parseInt(process.argv[2] || '9', 10);
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push('pageerror: ' + e.message + '\n' + (e.stack || '').split('\n').slice(0, 4).join('\n')));
  await page.goto('file://' + path.resolve(__dirname, '../index.html') + '?debug&skipintro');
  await page.waitForTimeout(300);
  await page.evaluate(() => { localStorage.clear(); DCW.resetSave(); });
  const name = () => page.evaluate(() => {
    const s = DCW.scene, U = DCW.ui && DCW.ui.scenes || {};
    for (const k in U) if (U[k] === s) return k;
    if (DCW.stage && s === DCW.stage.scene) return 'stage';
    if (DCW.overworld && s === DCW.overworld.scene) return 'overworld';
    return 'unknown';
  });
  const step = n => page.evaluate(n => DCW.stepFrames(n), n);
  // press confirm until scene matches one of targets
  async function advanceTo(targets, maxIters = 400) {
    for (let i = 0; i < maxIters; i++) {
      const n = await name();
      if (targets.includes(n) && !(await page.evaluate(() => DCW.fading() || (DCW.ui.blocking && DCW.ui.blocking())))) return n;
      await page.evaluate(() => DCW.pressKey('confirm', 2));
      await step(6);
    }
    throw new Error('stuck: wanted ' + targets + ' got ' + (await name()));
  }
  let shot = 0;
  const snap = async label => page.screenshot({ path: SHOTS + String(shot++).padStart(2, '0') + '_' + label + '.png' });
  try {
    await step(30); await snap('title');
    await page.evaluate(() => DCW.game.newRun());
    for (let f = 1; f <= maxFloor; f++) {
      const n = await advanceTo(['stage', 'overworld', 'safeRoom']);
      await snap('floor' + f + '_' + n);
      const fd = await page.evaluate(() => { const f = DCW.game.floorDef(); return { ow: !!f.overworld, seq: f.sequence, req: f.required, boss: f.boss, ents: f.overworld && f.overworld.entrances }; });
      if (!fd.ow) {
        for (let guard = 0; guard < 12; guard++) {
          const cur = await name();
          if (cur === 'stage') {
            await step(60); await snap('f' + f + '_stage');
            await page.evaluate(() => { (() => { const st = DCW.data.stages[DCW.game.run.currentStage] || {}; if (st.questItem) DCW.game.giveItem(st.questItem); if (st.rescue) DCW.game.rescueCompanion(st.rescue); })(); DCW.game.stageCleared({ stageId: DCW.game.run.currentStage, kills: 5, time: 60, damageTaken: 1, maxCombo: 4, views: 100, gold: 10 }); });
          } else if (cur === 'safeRoom') {
            await snap('f' + f + '_safe');
            await page.evaluate(() => DCW.game.leaveSafeRoom());
          } else if (cur === 'results' || cur === 'floorCard') {
            await page.evaluate(() => DCW.pressKey('confirm', 2)); await step(10);
          }
          await step(40);
          const fl = await page.evaluate(() => DCW.game.run && DCW.game.run.floor);
          if (fl !== f) break;
          await advanceTo(['stage', 'safeRoom', 'floorCard', 'overworld', 'ending']).catch(() => {});
        }
      } else {
        await step(30); await snap('f' + f + '_ow');
        const codes = Object.keys(fd.ents);
        // keep sweeping the map: locked areas open as key items turn up
        for (let pass = 0; pass < 6; pass++) {
          let progressed = false;
          for (const c of codes) {
            const st = await page.evaluate(c => DCW.game.entranceState(c), c);
            if (st.kind !== 'stage' || st.locked || st.cleared) continue;
            await page.evaluate(c => DCW.game.enterEntrance(c), c);
            await advanceTo(['stage']);
            await step(30);
            const exitNeeds = await page.evaluate(() => (DCW.data.stages[DCW.game.run.currentStage] || {}).exitNeeds);
            await page.evaluate(() => { (() => { const st = DCW.data.stages[DCW.game.run.currentStage] || {}; if (st.questItem) DCW.game.giveItem(st.questItem); if (st.rescue) DCW.game.rescueCompanion(st.rescue); })(); });
            if (exitNeeds && !(await page.evaluate(n => DCW.game.hasItem(n), exitNeeds))) {
              await page.evaluate(() => DCW.game.fleeStage()); await advanceTo(['overworld']); continue;  // padlocked: come back later
            }
            await page.evaluate(() => DCW.game.stageCleared({ stageId: DCW.game.run.currentStage, kills: 5, time: 60, damageTaken: 0, maxCombo: 4, views: 100, gold: 10 }));
            await advanceTo(['overworld']);
            progressed = true;
          }
          if (!progressed) break;
        }
        const bossCode = codes.find(c => fd.ents[c] === fd.boss);
        const bs = await page.evaluate(c => DCW.game.entranceState(c), bossCode);
        if (bs.locked) throw new Error('boss still locked on floor ' + f + ': ' + bs.lockText);
        await page.evaluate(c => DCW.game.enterEntrance(c), bossCode);
        await advanceTo(['stage']); await step(90); await snap('f' + f + '_boss');
        await page.evaluate(() => DCW.game.stageCleared({ stageId: DCW.game.run.currentStage, kills: 1, time: 90, damageTaken: 3, maxCombo: 9, views: 900, gold: 50, boss: DCW.data.stages[DCW.game.run.currentStage].boss }));
        if ((await advanceTo(['overworld', 'ending'])) === 'ending') { console.log('reached the ending after floor ' + f); break; }
        const stairs = codes.find(c => fd.ents[c] === 'STAIRS');
        await page.evaluate(c => DCW.game.enterEntrance(c), stairs);
        await step(20);
        await advanceTo(['floorCard', 'ending', 'stage', 'overworld']);
      }
      const st = await page.evaluate(() => ({ floor: DCW.game.run && DCW.game.run.floor, lvl: DCW.game.run && DCW.game.run.level, boxes: DCW.game.run && DCW.game.run.boxes.length, skins: DCW.save.unlocks.skins, comps: DCW.game.run && DCW.game.run.companions, items: DCW.game.run && Object.keys(DCW.game.run.items || {}).length }));
      console.log('after floor', f, JSON.stringify(st));
    }
    await snap('end_' + (await name()));
  } catch (e) { errors.push('FLOW: ' + e.message); await snap('fail'); }
  console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'flow ok, no errors');
  await browser.close();
})();

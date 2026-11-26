// Real-input playthrough from the title screen (no debug shortcuts). Screenshots along the way.
const { chromium } = require('playwright');
const path = require('path');
const OUT = process.argv[2] || '/tmp/claude-0/-home-user-Cards-n-more/b83025b8-a245-5c35-8e64-17484dc5caba/scratchpad/play/';
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
  const errors = [];
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.type() + ': ' + m.text()); });
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  await page.goto('file://' + path.resolve(__dirname, '../index.html'));
  await page.evaluate(() => { localStorage.clear(); DCW.resetSave(); });
  await page.reload(); await page.waitForTimeout(400);
  let i = 0;
  const snap = async l => page.screenshot({ path: OUT + String(i++).padStart(2, '0') + '_' + l + '.png' });
  const tap = async (key, n = 1) => { for (let k = 0; k < n; k++) { await page.keyboard.down(key); await page.waitForTimeout(60); await page.keyboard.up(key); await page.waitForTimeout(90); } };
  const scn = () => page.evaluate(() => { const s = DCW.scene, U = DCW.ui.scenes; for (const k in U) if (U[k] === s) return k; if (s === DCW.stage.scene) return 'stage'; if (s === DCW.overworld.scene) return 'overworld'; return '?'; });
  await page.waitForTimeout(1500); await snap('title');
  await tap('Enter'); await page.waitForTimeout(800); await snap('after_enter');
  // drive through intro / floor card until stage
  for (let k = 0; k < 80 && (await scn()) !== 'stage'; k++) { await tap('Enter'); await page.waitForTimeout(150); if (k === 3) await snap('intro'); if (k === 20) await snap('mid'); }
  await page.waitForTimeout(800);
  console.log('scene now', await scn());
  // dismiss any stage intro dialog
  for (let k = 0; k < 10; k++) { const b = await page.evaluate(() => DCW.ui.blocking()); if (!b) break; await tap('KeyZ'); await page.waitForTimeout(200); }
  await snap('stage_start');
  // play: run right, jump, punch
  for (let s = 0; s < 40; s++) {
    await page.keyboard.down('ArrowRight');
    if (s % 3 === 0) { await page.keyboard.down('KeyZ'); await page.waitForTimeout(250); await page.keyboard.up('KeyZ'); }
    await tap('KeyX', 2);
    await page.waitForTimeout(300);
    if (await page.evaluate(() => DCW.ui.blocking())) { await page.keyboard.up('ArrowRight'); await snap('dialog_' + s); for (let k = 0; k < 8 && await page.evaluate(() => DCW.ui.blocking()); k++) { await tap('KeyZ'); await page.waitForTimeout(150); } }
    if (s % 8 === 4) await snap('play_' + s);
  }
  await page.keyboard.up('ArrowRight');
  const st = await page.evaluate(() => ({ scene: DCW.scene === DCW.stage.scene, hp: DCW.game.run.hp, xp: DCW.game.run.xp, kills: DCW.stage.state && DCW.stage.state.kills, x: DCW.stage.state && DCW.stage.state.player && Math.round(DCW.stage.state.player.x) }));
  console.log(JSON.stringify(st));
  await tap('Enter'); await page.waitForTimeout(400); await snap('pause');
  console.log(errors.length ? errors.join('\n') : 'no console errors');
  await browser.close();
})();

// Balance meter for the lead (DESIGN 16.1): loads every side-view level the way ?debug&level=<id>
// sets Carl up for its act (level 13 / 18 / 22) and prints DCW.stage.debugBalance(): Carl's punch and
// max HP against each mob of the level after D.enemyFor + D.balance, as punches to kill and hits to
// die, plus the boss (bars x hp per bar). Targets: mobs 3-5 punches, Carl down in 6-8 hits.
// Usage: node crawler2/tools/balance_report.js [levelIdRegex] [--json]
const { chromium } = require('playwright');
const path = require('path');
const FILTER = new RegExp(process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : '.');
const JSON_OUT = process.argv.includes('--json');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 640, height: 360 } });
  const INDEX = 'file://' + path.resolve(__dirname, '../index.html');
  await page.goto(INDEX + '?debug');
  await page.waitForTimeout(250);
  const ids = await page.evaluate(() => Object.keys(DCW.data.levels).filter(id => ['rooms', 'show'].indexOf(DCW.data.levels[id].kind) < 0));
  const all = [];
  for (const id of ids.filter(i => FILTER.test(i))) {
    await page.goto(INDEX + '?debug&god&skipintro&level=' + id);
    await page.waitForTimeout(200);
    const r = await page.evaluate(() => { window.requestAnimationFrame = function () {}; DCW.stepFrames(5); return DCW.stage.debugBalance ? DCW.stage.debugBalance() : null; });
    if (!r) { console.log(id, 'no debugBalance'); continue; }
    all.push(r);
    if (JSON_OUT) continue;
    const c = r.carl;
    console.log(id.padEnd(16) + ' act ' + r.act + '  Carl L' + c.level + ' punch ' + c.punch + ' kick ' + c.kick + ' hp ' + c.maxHp + ' def ' + c.def + '  (hob ' + c.hob + ' dyn ' + c.dyn + ' jug ' + c.jug + ' missile ' + c.missile + ' bite ' + c.bite + ')');
    r.mobs.forEach(m => console.log('   ' + m.id.padEnd(16) + ' hp ' + String(m.hp).padStart(4) + ' dmg ' + String(m.dmg).padStart(3) + '   punches ' + String(m.punches).padStart(3) + '   hits to die ' + (m.hitsToDie === null ? '-' : m.hitsToDie)));
    if (r.boss) console.log('   BOSS ' + r.boss.id.padEnd(11) + ' ' + r.boss.bars + ' bars x ' + r.boss.barHp + ' hp, dmg ' + r.boss.dmg + '   punches ' + r.boss.punches + '   hits to die ' + r.boss.hitsToDie);
  }
  if (JSON_OUT) console.log(JSON.stringify(all, null, 1));
  else if (all[0]) console.log('balance in play: ' + JSON.stringify(all[0].balance));
  await browser.close();
})();

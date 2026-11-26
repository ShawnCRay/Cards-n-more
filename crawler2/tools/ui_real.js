// Boots the real game (index.html) on each ?debug&scene=... entry point and screenshots it.
// Usage: node crawler2/tools/ui_real.js [outDir]
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const out = process.argv[2] || '/tmp/ui2_real';
fs.mkdirSync(out, { recursive: true });
const runs = [
  ['index', ''], ['title', 'debug&scene=title'], ['classPick', 'debug&scene=classPick'], ['inn', 'debug&scene=inn'], ['inn_narwhal', 'debug&scene=inn&inn=narwhal&act=2'],
  ['club', 'debug&scene=club&act=2'], ['map', 'debug&scene=map'], ['ending', 'debug&scene=ending'], ['ending_early', 'debug&scene=ending&kind=early'],
  ['ending_collapse', 'debug&scene=ending&kind=collapse'], ['death', 'debug&scene=death&cause=guard'], ['results', 'debug&scene=results'],
  ['cinema_arrival', 'debug&cinema=arrival'], ['cinema_tour', 'debug&cinema=tour'], ['area_village', 'debug&area=village']
];
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 640, height: 360 }, deviceScaleFactor: 1 });
  await ctx.addInitScript(() => { try { localStorage.clear(); } catch (e) { /* file:// */ } });
  const page = await ctx.newPage();
  let errors = [];
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.type() + ': ' + m.text()); });
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  const base = 'file://' + path.resolve(__dirname, '../index.html');
  for (const [name, q] of runs) {
    errors = [];
    await page.goto(base + (q ? '?' + q : ''));
    await page.waitForTimeout(700);
    await page.evaluate(() => DCW.stepFrames(120));
    const el = await page.$('#screen');
    await el.screenshot({ path: path.join(out, 'real_' + name + '.png') });
    // poke a few buttons to make sure the screen takes input without errors
    for (const b of ['down', 'confirm', 'up', 'back', 'start', 'back']) { await page.evaluate(b => DCW.pressKey(b, 1), b); await page.evaluate(() => DCW.stepFrames(20)); }
    await el.screenshot({ path: path.join(out, 'real_' + name + '_b.png') });
    const sc = await page.evaluate(() => { for (const k in DCW.ui.scenes) if (DCW.ui.scenes[k] === DCW.scene) return 'ui.' + k; return DCW.scene === (DCW.stage && DCW.stage.scene) ? 'stage' : '?'; });
    console.log(name + ' [' + sc + ']: ' + (errors.length ? 'ERRORS\n  ' + errors.slice(0, 8).join('\n  ') : 'ok'));
  }
  await browser.close();
})();

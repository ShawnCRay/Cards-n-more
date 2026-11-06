// node crawler/tools/actors_shot.js "<query>" out.png [width]
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const qs = process.argv[2] || '', out = process.argv[3] || 'actors.png', width = +(process.argv[4] || 1400);
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width, height: 600 } });
  const errs = [];
  p.on('pageerror', e => errs.push('pageerror: ' + e.message));
  p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto('file://' + path.resolve(__dirname, 'actors_preview.html') + qs);
  await p.waitForTimeout(200);
  await p.screenshot({ path: out, fullPage: true });
  console.log(errs.length ? errs.join('\n') : 'ok');
  await b.close();
})();

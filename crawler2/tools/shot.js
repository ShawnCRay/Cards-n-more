// Usage: node crawler/tools/shot.js "<query string e.g. ?debug>" out.png [framesToStep] [jsToEval]
// Loads crawler/index.html headless at 3x, steps frames, screenshots, prints console errors.
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const qs = process.argv[2] || '';
  const out = process.argv[3] || 'shot.png';
  const frames = parseInt(process.argv[4] || '60', 10);
  const js = process.argv[5] || '';
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
  const errors = [];
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.type() + ': ' + m.text()); });
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  const url = 'file://' + path.resolve(__dirname, '../index.html') + qs;
  await page.goto(url);
  await page.waitForTimeout(300);
  if (js) { try { const r = await page.evaluate(js); if (r !== undefined) console.log('eval:', JSON.stringify(r)); } catch (e) { errors.push('eval error: ' + e.message); } }
  await page.evaluate(n => window.DCW && DCW.stepFrames && DCW.stepFrames(n), frames);
  await page.screenshot({ path: out });
  console.log(errors.length ? errors.join('\n') : 'no console errors');
  await browser.close();
})();

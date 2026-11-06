// Usage: node crawler/tools/art_shot.js <outDir> [query e.g. "t=1.3&cam=200"] [sectionFilter regex]
// Renders tools/art_gallery.html headless, saves one PNG per gallery section, prints
// errors, the placeholder/info checks and a per-theme perf benchmark (ms/frame for
// background + 20x12 tiles + 400 sprites).
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
(async () => {
  const outDir = process.argv[2] || '.';
  const qs = process.argv[3] || '';
  const filt = process.argv[4] ? new RegExp(process.argv[4]) : null;
  fs.mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1300, height: 900 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.type() + ': ' + m.text()); });
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  await page.goto('file://' + path.resolve(__dirname, 'art_gallery.html') + (qs ? '?' + qs : ''));
  await page.waitForTimeout(300);
  const ids = await page.evaluate(() => Array.from(document.querySelectorAll('.sec')).map(d => d.id));
  for (const id of ids) {
    if (filt && !filt.test(id)) continue;
    await page.locator('#' + id).screenshot({ path: path.join(outDir, id + '.png') });
  }
  const rep = await page.evaluate(() => window.ART_REPORT);
  console.log('report:', JSON.stringify(rep));
  if (!filt || filt.test('perf')) {
    const perf = await page.evaluate(() => window.artPerf(120));
    console.log('perf ms/frame:', JSON.stringify(perf));
  }
  console.log(errors.length ? errors.join('\n') : 'no console errors');
  console.log('sections:', ids.join(' '));
  await browser.close();
})();

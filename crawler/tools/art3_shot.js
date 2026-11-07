// Usage: node crawler/tools/art3_shot.js <outDir> [sectionFilter regex]
// Renders tools/art3_gallery.html (update-3 art: food truck + float overlays, racers,
// Grand Marshal, raceway/parade themes, ow_suburb/ow_parade + markers, race objects,
// portraits, Mordecai forms 10/11) headless and saves one PNG per section.
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
(async () => {
  const outDir = process.argv[2] || '.';
  const filt = process.argv[3] ? new RegExp(process.argv[3]) : null;
  fs.mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.type() + ': ' + m.text()); });
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  await page.goto('file://' + path.resolve(__dirname, 'art3_gallery.html'));
  await page.waitForTimeout(300);
  const ids = await page.evaluate(() => Array.from(document.querySelectorAll('.sec')).map(d => d.id));
  for (const id of ids) {
    if (filt && !filt.test(id)) continue;
    await page.locator('#' + id).screenshot({ path: path.join(outDir, id + '.png') });
  }
  const rep = await page.evaluate(() => window.ART_REPORT);
  console.log('missing:', rep.missing.join(' ') || 'none');
  console.log('errors:', rep.errors.join(' | ') || 'none');
  console.log('sizes:', Object.entries(rep.info).map(([n, i]) => `${n} ${i.w}x${i.h}x${i.frames}`).join(', '));
  console.log(errors.length ? errors.join('\n') : 'no console errors');
  await browser.close();
})();

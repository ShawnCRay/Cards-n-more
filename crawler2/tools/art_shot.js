// Usage: node crawler2/tools/art_shot.js <outDir> [query e.g. "t=1.3&cam=200"] [sectionFilter regex] [--perf]
// Renders tools/art_gallery.html headless (Chromium, deviceScaleFactor 1), saves one PNG per
// gallery section, prints console errors, the gallery's error report and (with --perf) a
// per-theme benchmark in ms/frame (background + a screen of tiles + 200 sprites).
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
(async () => {
  const args = process.argv.slice(2).filter(a => a !== '--perf');
  const perf = process.argv.includes('--perf');
  const outDir = args[0] || '.';
  const qs = args[1] || '';
  const filt = args[2] ? new RegExp(args[2]) : null;
  fs.mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.type() + ': ' + m.text()); });
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  await page.goto('file://' + path.resolve(__dirname, 'art_gallery.html') + (qs ? '?' + qs : ''));
  await page.waitForTimeout(400);
  const ids = await page.evaluate(() => Array.from(document.querySelectorAll('.sec')).map(d => d.id));
  let n = 0;
  for (const id of ids) {
    if (filt && !filt.test(id)) continue;
    await page.locator('#' + id).screenshot({ path: path.join(outDir, id + '.png') });
    n++;
  }
  const rep = await page.evaluate(() => window.ART_REPORT);
  console.log('gallery errors:', JSON.stringify(rep.errors));
  if (perf) console.log('perf ms/frame:', JSON.stringify(await page.evaluate(() => window.artPerf(60))));
  console.log(errors.length ? errors.join('\n') : 'no console errors');
  console.log('saved', n, 'of', ids.length, 'sections to', outDir);
  await browser.close();
})();

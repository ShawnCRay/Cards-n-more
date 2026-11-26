// Real keyboard events (not DCW.pressKey) through the title, sub-menus and the inn. Usage: node crawler2/tools/ui_keys.js
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 640, height: 360 } });
  await ctx.addInitScript(() => { try { localStorage.clear(); } catch (e) { /* file:// */ } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push(e.message));
  const key = async (k, n = 1) => { for (let i = 0; i < n; i++) { await page.keyboard.press(k); await page.waitForTimeout(60); } };
  const top = () => page.evaluate(() => (DCW.ui.top() || {}).kind || null);
  const scene = () => page.evaluate(() => { for (const k in DCW.ui.scenes) if (DCW.ui.scenes[k] === DCW.scene) return k; return '?'; });
  const log = [];
  await page.goto('file://' + path.resolve(__dirname, '../index.html'));
  await page.waitForTimeout(900);
  log.push('boot:' + await scene());
  // title: NEW CRAWL is first (no run). Walk the menu: WARDROBE, ACHIEVEMENTS, SETTINGS > CONTROLS, HOW TO PLAY
  await key('ArrowDown'); await key('Enter'); log.push('wardrobe:' + await top()); await key('ArrowDown', 2); await key('Escape'); log.push('closed:' + await top());
  await key('ArrowDown'); await key('KeyZ'); log.push('achievements:' + await top()); await key('ArrowDown', 3); await key('KeyX'); log.push('closed:' + await top());
  await key('ArrowDown'); await key('Enter'); log.push('settings:' + await top()); await key('ArrowDown', 6); await key('Enter'); log.push('controls:' + await top());
  await key('Escape'); await key('Escape'); log.push('closed:' + await top());
  await key('ArrowDown'); await key('Space'); log.push('howto:' + await top()); await key('ArrowRight', 2); await key('Escape'); log.push('closed:' + await top());
  // inn via debug entry: walk, open the inn menu with Enter, navigate it, open the map with Tab
  await page.goto('file://' + path.resolve(__dirname, '../index.html') + '?debug&scene=inn');
  await page.waitForTimeout(900);
  log.push('inn:' + await scene());
  await page.keyboard.down('ArrowLeft'); await page.waitForTimeout(1500); await page.keyboard.up('ArrowLeft');
  log.push('near:' + await page.evaluate(() => DCW.scene.near && DCW.scene.near.id));
  await key('Enter'); log.push('innmenu:' + await top()); await key('ArrowDown', 4); await key('KeyZ'); log.push('boxes:' + await top()); await key('KeyX'); await key('Escape');
  await key('Tab'); log.push('map:' + await top()); await key('ArrowRight'); await key('Escape'); log.push('closed:' + await top());
  await key('KeyP'); log.push('pmenu:' + await top()); await key('ArrowUp'); await key('Enter'); log.push('more->pause:' + await top());
  await key('ArrowDown', 2); await key('Enter'); log.push('quests:' + await top()); await key('Escape'); await key('ArrowDown', 2); await key('Enter'); log.push('inventory:' + await top()); await key('Escape'); await key('Escape');
  log.push('end:' + await top());
  console.log(log.join('\n'));
  console.log(errors.length ? 'ERRORS ' + errors.join(' | ') : 'NO CONSOLE ERRORS');
  await browser.close();
})();

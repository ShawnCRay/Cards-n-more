// Usage: node crawler2/tools/art_names.js [--list]   (--list prints the parsed names and exits)
// Name check for art-core against DESIGN.md section 12: parses the theme, backdrop, panel,
// object/fx/pickup/projectile and icon lists, then (headless Chromium) checks that every
// sprite exists with enough frames, every icon exists, every theme draws a full background
// day and night and all tile chars (# X = ^ ~ H b L) draw pixels day and night, every
// backdrop fills the screen and every panel draws. Exit code 1 on any miss.
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const design = fs.readFileSync(path.resolve(__dirname, '../DESIGN.md'), 'utf8');
const s12 = design.slice(design.indexOf('## 12.'), design.indexOf('## 13.'));
const ticks = (txt) => (txt.match(/`[^`]+`/g) || []).map(t => t.slice(1, -1));
const words = (txt) => ticks(txt).join(' ').split(/\s+/).filter(Boolean);
function between(a, b) { const i = s12.indexOf(a); const j = s12.indexOf(b, i + a.length); if (i < 0 || j < 0) throw new Error('DESIGN.md section 12 changed: cannot find ' + a); return s12.slice(i + a.length, j); }

const panels = words(between('Panels:', 'DCW.art.wobble')).filter(w => /^[a-z_]+$/.test(w));
const themes = words(between('Themes (tiles + backgrounds, each with day and night):', '(side-view)'));
const backdrops = words(between('backdrops for', '(UI/cinema'));
const objTxt = between('Objects/doors (sprites):', 'Actors (art-actors)');
const iconsTxt = objTxt.slice(objTxt.indexOf('icons'));
const spriteTxt = objTxt.slice(0, objTxt.indexOf('icons'));
// sprite names with optional minimum frame counts: "`fire` (3)" or "`charge`\n(planted dynamite, 2 frames"
const sprites = {};
const re = /`([^`]+)`(\s*\((\d+)\)|\s*\([^)]*?(\d+) frames)?/g;
let m;
while ((m = re.exec(spriteTxt))) {
  const n = +(m[3] || m[4] || 1);
  m[1].split(/\s+/).filter(Boolean).forEach((w, i, arr) => { if (/^[a-z_*0-9]+$/.test(w)) sprites[w] = i === arr.length - 1 ? n : 1; });
}
delete sprites['box_*'];
['bronze', 'silver', 'gold', 'platinum', 'legendary', 'fan', 'boss'].forEach(t => { sprites['box_' + t] = 4; });
// extras the lead / task asked for
Object.assign(sprites, { tent_pole: 4, ring_junk: 4, worm: 2, barricade_broken: 1, signpost_on: 1, charge: 2, darkness_orb: 2, fire: 3, smoke_bomb: 1 });
['qi_ticket', 'qi_key', 'qi_letter', 'qi_pass', 'qi_ring', 'qi_anklet', 'qi_crown', 'qi_case', 'qi_crystal', 'qi_moonshine', 'qi_custard', 'qi_scroll', 'qi_carrier', 'qi_caps'].forEach(q => { sprites[q] = 2; });
const book1Icons = ['heart', 'heart_half', 'heart_empty', 'coin', 'bomb', 'potion', 'star', 'skull', 'box', 'key', 'sword', 'shield', 'boot', 'brain', 'eye', 'quest'];
const icons = book1Icons.concat(words(iconsTxt));

if (process.argv.includes('--list')) {
  console.log('panels:', panels.join(' ')); console.log('themes:', themes.join(' ')); console.log('backdrops:', backdrops.join(' '));
  console.log('sprites:', Object.entries(sprites).map(([k, v]) => v > 1 ? k + '(' + v + ')' : k).join(' ')); console.log('icons:', icons.join(' '));
  process.exit(0);
}
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ deviceScaleFactor: 1 });
  const errors = [];
  page.on('console', x => { if (x.type() === 'error' || x.type() === 'warning') errors.push(x.type() + ': ' + x.text()); });
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  await page.goto('file://' + path.resolve(__dirname, 'art_gallery.html') + '?only=none');
  await page.waitForTimeout(200);
  const res = await page.evaluate(({ panels, themes, backdrops, sprites, icons }) => {
    const A = DCW.art, miss = [], c = document.createElement('canvas'); c.width = 320; c.height = 180;
    const g = c.getContext('2d', { willReadFrequently: true });
    const filled = (x, y, w, h) => { const d = g.getImageData(x, y, w, h).data; let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 0) n++; return n / (w * h); };
    for (const t of themes) {
      if ((A.themes || []).indexOf(t) < 0) miss.push('theme not registered: ' + t);
      for (const night of [false, true]) {
        g.clearRect(0, 0, 320, 180); A.background(g, t, 333, 12, { night, t: 1 });
        if (filled(0, 0, 320, 180) < 0.999) miss.push('background ' + t + (night ? ' night' : ' day') + ' leaves holes');
        for (const ch of '#X=^~HbL') { g.clearRect(0, 0, 32, 32); A.tile(g, t, ch, 8, 8, { night, tx: 3, ty: 4, t: 0 }); if (filled(8, 8, 16, 16) < 0.05) miss.push('tile ' + t + ' ' + ch + (night ? ' night' : '') + ' draws nothing'); }
      }
    }
    for (const b of backdrops) { if ((A.backdrops || []).indexOf(b) < 0) miss.push('backdrop not registered: ' + b); g.clearRect(0, 0, 320, 180); A.background(g, b, 0, 0, { t: 1 }); if (filled(0, 0, 320, 180) < 0.999) miss.push('backdrop ' + b + ' leaves holes'); }
    for (const p of panels) { if (!A.hasPanel(p)) { miss.push('panel missing: ' + p); continue; } g.clearRect(0, 0, 320, 180); A.panel(g, p, 0, 0, 1); if (filled(0, 0, 256, 112) < 0.999) miss.push('panel ' + p + ' leaves holes'); }
    for (const n in sprites) { if (!A.has(n)) { miss.push('sprite missing: ' + n); continue; } const inf = A.info(n); if (inf.frames < sprites[n]) miss.push('sprite ' + n + ' has ' + inf.frames + ' frames, want ' + sprites[n]); }
    for (const i of icons) if (!A.has('icon_' + i)) miss.push('icon missing: ' + i);
    if (typeof A.wobble !== 'function') miss.push('wobble missing');
    return { miss, counts: { themes: themes.length, backdrops: backdrops.length, panels: panels.length, sprites: Object.keys(sprites).length, icons: icons.length } };
  }, { panels, themes, backdrops, sprites, icons });
  console.log('checked', JSON.stringify(res.counts));
  console.log(res.miss.length ? 'MISSING:\n  ' + res.miss.join('\n  ') : 'all names present');
  console.log(errors.length ? errors.join('\n') : 'no console errors');
  await browser.close();
  process.exit(res.miss.length || errors.length ? 1 : 0);
})();

// node crawler2/tools/actors_realcheck.js - loads art_actors.js + the real art.js in Chromium, runs art.init(),
// draws every actor (all frames, flipped, flashed, every Carl skin) and reports console errors and name clashes.
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ deviceScaleFactor: 1 });
  const errs = [];
  p.on('pageerror', e => errs.push('pageerror: ' + e.message));
  p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto('file://' + path.resolve(__dirname, 'actors_preview.html') + '?f=^$');
  const res = await p.evaluate(() => new Promise(done => {
    const mine = Object.keys(DCW.artDefs).concat(Object.keys(DCW.artProcs));
    const s = document.createElement('script'); s.src = '../js/art.js';
    s.onload = () => {
      const out = { mine: mine.length, clash: [], drawn: 0, missing: [] };
      try { DCW.art.init(); } catch (e) { console.error('art.init ' + e.message); }
      (DCW.art.ownNames || []).forEach(n => { if (mine.indexOf(n) >= 0) out.clash.push(n); });
      const c = document.createElement('canvas'); c.width = 320; c.height = 180; const g = c.getContext('2d');
      mine.forEach(n => {
        const inf = DCW.art.info(n); if (inf.missing) { out.missing.push(n); return; }
        for (let f = 0; f < inf.frames; f++) { DCW.art.sprite(g, n, 160, 170, { frame: f }); DCW.art.sprite(g, n, 160, 170, { frame: f, flip: true, flash: true }); out.drawn++; }
        if (n.indexOf('p_') === 0) for (let f = 0; f < 3; f++) DCW.art.portrait(g, n, 0, 0, { frame: f });
        if (n.indexOf('carl_') === 0) Object.keys(DCW.artSkins).forEach(sk => DCW.art.sprite(g, n, 160, 170, { skin: sk }));
      });
      done(out);
    };
    s.onerror = () => done({ error: 'art.js failed to load' });
    document.body.appendChild(s);
  }));
  console.log(JSON.stringify(res));
  console.log(errs.length ? errs.join('\n') : 'no console errors');
  await b.close();
})();

// Integration smoke for js/stage.js through the real index.html + real data/ui/art/audio/game:
// every level stage.js runs and every street (day + night), driven by a dumb bot with a little
// kind-specific help. Reports console errors, build info, how each level ended, and art names
// stage.js asked for that art does not have yet.
// Usage: node crawler2/tools/stage_smoke.js [outDir] [filterRegex]
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const OUT = process.argv[2] || path.resolve(__dirname, '../../../stage2_smoke');
const FILTER = new RegExp(process.argv[3] || '.');
fs.mkdirSync(OUT, { recursive: true });
const INDEX = 'file://' + path.resolve(__dirname, '../index.html');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 960, height: 540 }, deviceScaleFactor: 1 });
  await page.addInitScript(() => { window.requestAnimationFrame = function () {}; });
  let errors = [];
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.type() + ': ' + m.text()); });
  page.on('pageerror', e => errors.push('pageerror: ' + e.message + ' ' + (e.stack || '').split('\n').slice(1, 3).join(' ')));
  await page.goto(INDEX + '?debug');
  const ids = await page.evaluate(() => {
    const D = (window.DCW && DCW.data) || {};
    const lv = Object.keys(D.levels || {}).filter(id => ['rooms', 'show'].indexOf(D.levels[id].kind) < 0).map(id => 'level=' + id);
    const ar = Object.keys(D.areas || {});
    return lv.concat(ar.map(a => 'area=' + a), ar.map(a => 'area=' + a + '&night'));
  });
  const missing = {};
  let bad = 0;
  for (const q of ids.filter(q => FILTER.test(q))) {
    errors = [];
    await page.goto(INDEX + '?debug&god&skipintro&' + q);
    try { await page.waitForFunction(() => window.DCW && DCW.stage && DCW.stage.state && DCW.scene === DCW.stage.scene, null, { timeout: 4000 }); }
    catch (e) { console.log('BAD  ' + q + ' no stage scene ' + errors.slice(0, 3).join(' | ')); bad++; continue; }
    const res = await page.evaluate(async (q) => {
      const down = {};
      function key(code, on) { if (!!down[code] === on) return; down[code] = on; window.dispatchEvent(new KeyboardEvent(on ? 'keydown' : 'keyup', { code })); }
      function releaseAll() { Object.keys(down).forEach(c => key(c, false)); }
      const s0 = DCW.stage.state;
      const info = { mode: s0.mode, kind: s0.kind, w: s0.L.w, h: s0.L.h, enemies: s0.enemies.length, boss: s0.boss ? s0.boss.id : null, party: Object.keys(s0.party),
        objs: s0.objects.reduce((m, o) => { m[o.kind] = (m[o.kind] || 0) + 1; return m; }, {}) };
      const warp = (x, feet) => { const P = s0.player; P.x = x - P.w / 2; P.y = feet - P.h - 0.5; P.vx = 0; P.vy = 0; P.state = 'normal'; };
      const T = (x, y) => { const tx = Math.floor(x / 16), ty = Math.floor(y / 16); if (tx < 0 || tx >= s0.L.w || ty < 0 || ty >= s0.L.h) return 0; return s0.L.t[ty * s0.L.w + tx]; };
      let f, end = null, jt = 0, helped = [];
      const street = s0.mode === 'street';
      const budget = street ? 1500 : (s0.surv ? Math.round(s0.surv.total * 60) + 900 : 5400);
      let dir = 1;
      for (f = 0; f < budget; f++) {
        const s = DCW.stage.state;
        if (DCW.scene !== DCW.stage.scene || s !== s0) { end = 'left-scene'; break; }
        if (s.clearedSent) { end = 'cleared'; break; }
        if (s.diedSent) { end = 'died'; break; }
        const p = s.player, B = s.boss;
        if (DCW.ui.blocking && DCW.ui.blocking()) { releaseAll(); key('KeyZ', f % 6 < 3); DCW.stepFrames(1); continue; }
        // kind-specific help at fixed times
        if (!street && f === 600 && s.plant && !s.plant.detonated) {
          s.objects.filter(o => o.kind === 'charge' && !o.planted).forEach(c => { warp(c.x + 8, c.y + c.h); key('ArrowUp', true); DCW.stepFrames(70); key('ArrowUp', false); DCW.stepFrames(2); });
          const t = s.objects.find(o => o.kind === 'detonator'); if (t) { warp(t.x + 12, t.y + t.h); DCW.stepFrames(4); key('KeyC', true); DCW.stepFrames(2); key('KeyC', false); }
          helped.push('planted ' + s.plant.planted + '/' + s.plant.need);
        }
        if (!street && f === 900 && (s.kind === 'climb' || s.kind === 'drop')) { const d = s.objects.find(o => o.kind === 'door'); if (d) { warp(d.x - 12, d.y + d.h); helped.push('warp to door'); } }
        if (!street && f === 2400 && B && !B.dead && s.locked) { B.hp = Math.min(B.hp, 3); if (B.facade) B.parts.forEach(pt => { pt.open = 1; }); helped.push('boss hp 3'); }
        if (!street && f === 2400 && s.boss && !s.locked && s.arena) { warp(s.arena.x0 + 64, p.y + p.h); helped.push('warp arena'); }
        if (!street && f === 3600 && !s.surv) { const d = s.objects.filter(o => o.kind === 'door').pop(); if (d) { warp(d.x - 12, d.y + d.h); helped.push('warp exit'); } }
        if (street) { if (p.x > s.L.pxW - 48) dir = -1; else if (p.x < 40) dir = 1; }
        else if (B && s.locked && !B.dead) dir = (B.x + B.w / 2) > (p.x + p.w / 2) ? 1 : -1;
        else if (s.kind === 'drop') dir = (Math.floor(f / 180) % 2) ? -1 : 1;
        else dir = 1;
        key('ArrowRight', dir > 0); key('ArrowLeft', dir < 0);
        const foe = s.enemies.some(e => !e.dead && !e.citizen && Math.abs(e.x + e.w / 2 - (p.x + p.w / 2)) < 44 && Math.abs(e.y - p.y) < 40) || (B && s.locked && !B.dead);
        key('KeyX', foe && f % 10 < 3);
        const fy = p.y + p.h + 2, ahead = p.x + p.w / 2 + dir * 14;
        const gap = p.onGround && !T(ahead, fy) && !s.platforms.some(pl => ahead >= pl.x && ahead <= pl.x + pl.w);
        const wall = [1, 2, 7, 8, 9].includes(T(ahead, p.y + p.h - 4));
        const ready = jt <= -3;
        if (ready && p.onGround && (gap || wall)) jt = 22;
        if (ready && Math.abs(p.vx) < 5 && p.onGround && f % 30 === 0) jt = 20;
        if (ready && f % 140 === 0) jt = 18;
        key('KeyZ', jt-- > 0);
        if (f % 400 === 200 && !street) { key('KeyC', true); }
        if (f % 400 === 202) key('KeyC', false);
        if (f % 900 === 450 && !street) { s.special = 1; key('KeyV', true); }
        if (f % 900 === 452) key('KeyV', false);
        DCW.stepFrames(1);
      }
      releaseAll();
      const s = DCW.stage.state;
      if (!end && !street && s === s0 && !s.done) { DCW.stage.debugClear(); DCW.stepFrames(40); end = s.clearedSent ? 'debug-clear' : 'stuck'; }
      return { info, frames: f, end, helped, x: Math.round(s0.player.x), kills: s0.kills, doors: street ? s0.objects.filter(o => o.kind === 'sdoor').map(o => o.ch + (o.st && o.st.visible ? (o.st.locked ? 'L' : '') : 'h')).join(' ') : undefined,
        missing: DCW.stage.missingArt ? DCW.stage.missingArt() : [] };
    }, q);
    await page.screenshot({ path: path.join(OUT, q.replace(/[=&]/g, '_') + '.png') });
    (res.missing || []).forEach(n => { missing[n] = (missing[n] || 0) + 1; });
    delete res.missing;
    const ok = errors.length === 0 && res.end !== 'stuck';
    if (!ok) bad++;
    console.log((ok ? 'OK   ' : 'BAD  ') + q + ' ' + JSON.stringify(res) + (errors.length ? '\n     ' + errors.slice(0, 5).join('\n     ') : ''));
  }
  console.log('\nart names stage.js asked for that art does not have: ' + Object.keys(missing).sort().join(' '));
  console.log(bad ? bad + ' with problems' : 'all clean');
  await browser.close();
})();

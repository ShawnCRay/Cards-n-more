// Integration smoke test: every stage in the real DCW.data, through the real index.html
// (?debug&stage=ID&god), driven by a dumb bot. Reports console errors + build problems.
// Usage: node crawler/tools/stage_smoke.js [outDir] [stageFilterRegex]
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const OUT = process.argv[2] || path.resolve(__dirname, '../../../stage_smoke');
const FILTER = new RegExp(process.argv[3] || '.');
fs.mkdirSync(OUT, { recursive: true });
const INDEX = 'file://' + path.resolve(__dirname, '../index.html');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
  await page.addInitScript(() => { window.requestAnimationFrame = function () {}; });
  let errors = [];
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.type() + ': ' + m.text()); });
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  await page.goto(INDEX + '?debug');
  const ids = (await page.evaluate(() => Object.keys((window.DCW && DCW.data && DCW.data.stages) || {}))).filter(id => FILTER.test(id));
  console.log(ids.length + ' stages');
  let bad = 0;
  for (const id of ids) {
    errors = [];
    await page.goto(INDEX + '?debug&god&stage=' + id);
    const res = await page.evaluate(async (id) => {
      const down = {};
      function key(code, on) { if (!!down[code] === on) return; down[code] = on; window.dispatchEvent(new KeyboardEvent(on ? 'keydown' : 'keyup', { code })); }
      DCW.stepFrames(3);
      const s0 = DCW.stage && DCW.stage.state;
      if (!s0) return { err: 'no stage state', scene: !!DCW.scene };
      const info = { w: s0.L.w, enemies: s0.enemies.length, boss: !!s0.boss, chunks: s0.chunks.map(c => c.id), door: s0.objects.some(o => o.kind === 'door') };
      const bot = { jt: 0 };
      let f, cleared = null, maxX = 0, boss = null, shotFrames = [];
      for (f = 0; f < 9000; f++) {
        const s = DCW.stage.state;
        if (DCW.scene !== DCW.stage.scene || s !== s0) { cleared = 'left-scene'; break; }
        if (s.clearedSent) { cleared = 'cleared'; break; }
        const p = s.player, B = s.boss;
        maxX = Math.max(maxX, p.x);
        const blocking = DCW.ui.blocking && DCW.ui.blocking();
        if (blocking) { key('ArrowRight', false); key('KeyX', false); key('KeyZ', f % 6 < 3); DCW.stepFrames(1); continue; }
        let dir = 1;
        if (B && s.locked && !B.dead) dir = (B.x + B.w / 2) > (p.x + p.w / 2) ? 1 : -1;
        key('ArrowRight', dir > 0); key('ArrowLeft', dir < 0);
        const foe = s.enemies.some(e => !e.dead && Math.abs(e.x + e.w / 2 - (p.x + p.w / 2)) < 44 && Math.abs(e.y - p.y) < 40) || (B && s.locked && !B.dead && Math.abs(B.x + B.w / 2 - (p.x + p.w / 2)) < B.w / 2 + 30);
        key('KeyX', foe && f % 10 < 3);
        // jump at ledges/walls (look ahead for ground), when stalled, and now and then
        const T = (x, y) => { const tx = Math.floor(x / 16), ty = Math.floor(y / 16); if (tx < 0 || tx >= s.L.w || ty < 0 || ty >= s.L.h) return 0; return s.L.t[ty * s.L.w + tx]; };
        const fy = p.y + p.h + 2, ahead = p.x + p.w / 2 + dir * 14;
        const gap = p.onGround && !T(ahead, fy) && !s.platforms.some(pl => ahead >= pl.x && ahead <= pl.x + pl.w);
        const wall = [1, 2, 7].includes(T(ahead, p.y + p.h - 4));
        const ready = bot.jt <= -3; // release jump for a few frames between jumps
        if (ready && p.onGround && (gap || wall)) bot.jt = 22;
        const stalled = Math.abs(p.vx) < 5 && p.onGround;
        if (ready && stalled && f % 30 === 0) bot.jt = 20;
        if (ready && f % 140 === 0) bot.jt = 18;
        key('KeyZ', bot.jt-- > 0);
        if (f === 300 || f === 1500) shotFrames.push(f);
        DCW.stepFrames(1);
        if (f === 400) window.__shot1 = true;
      }
      ['ArrowRight', 'ArrowLeft', 'KeyX', 'KeyZ'].forEach(c => key(c, false));
      const s = DCW.stage.state;
      return { info, frames: f, cleared, maxX: Math.round(maxX), levelW: s.L.pxW, bossHp: s.boss ? s.boss.hp + '/' + s.boss.maxHp : null, kills: s.kills, hp: DCW.save.run && DCW.save.run.hp };
    }, id);
    await page.screenshot({ path: path.join(OUT, id + '.png') });
    const ok = !res.err && errors.length === 0;
    if (!ok) bad++;
    console.log((ok ? 'OK   ' : 'BAD  ') + id + ' ' + JSON.stringify(res) + (errors.length ? '\n     ' + errors.slice(0, 5).join('\n     ') : ''));
  }
  console.log(bad ? bad + ' stages with problems' : 'all stages clean');
  await browser.close();
})();

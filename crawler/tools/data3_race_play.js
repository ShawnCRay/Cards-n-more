// Real-engine race check: loads each floor 10 race through index.html (?debug&god&stage=ID),
// holds right and taps jump when the road ends in front of the truck's bumper (a late
// jumper, like data3_race_sim.js), and reports finish place, time and pit falls.
// Usage: node crawler/tools/data3_race_play.js [stageFilterRegex] [--nogod] [--nohop] [--shots=DIR]
// The driver shoots now and then and hops walkers in the road (--nohop: rams them instead).
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const args = process.argv.slice(2);
const FILTER = new RegExp(args.find(a => !a.startsWith('--')) || '^f10_(r\\d|boss)$');
const GOD = !args.includes('--nogod');
const shotArg = args.find(a => a.startsWith('--shots='));
const SHOTS = shotArg ? shotArg.slice(8) : null;
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
const INDEX = 'file://' + path.resolve(__dirname, '../index.html');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  await page.goto(INDEX + '?debug');
  const ids = (await page.evaluate(() => Object.keys(DCW.data.stages).filter(k => DCW.data.stages[k].kind === 'race'))).filter(id => FILTER.test(id));
  let bad = 0;
  for (const id of ids) {
    errors.length = 0;
    await page.goto(INDEX + '?debug' + (GOD ? '&god' : '') + '&stage=' + id);
    const res = await page.evaluate(async (HOP) => {
      const down = {};
      function key(code, on) { if (!!down[code] === on) return; down[code] = on; window.dispatchEvent(new KeyboardEvent(on ? 'keydown' : 'keyup', { code })); }
      DCW.stepFrames(3);
      const s0 = DCW.stage && DCW.stage.state;
      if (!s0) return { err: 'no stage state' };
      let f, out = null, falls = 0, lastY = 0, jt = 0, maxX = 0, stalls = 0, hops = 0;
      for (f = 0; f < 6000; f++) {
        const s = DCW.stage.state;
        if (DCW.scene !== DCW.stage.scene || s !== s0) { out = 'left-scene'; break; }
        if (s.clearedSent) { out = 'cleared'; break; }
        if (s.race && s.race.failed) { out = 'failed: ' + s.race.failed; break; }
        if (DCW.ui.blocking && DCW.ui.blocking()) { key('ArrowRight', false); key('KeyZ', f % 6 < 3); DCW.stepFrames(1); continue; }
        const p = s.player;
        if (p.y < lastY - 120) falls++; // respawned above after dropping into a pit
        lastY = p.y; maxX = Math.max(maxX, p.x);
        key('ArrowRight', true);
        const T = (x, y) => { const tx = Math.floor(x / 16), ty = Math.floor(y / 16); if (tx < 0 || tx >= s.L.w || ty < 0 || ty >= s.L.h) return 0; return s.L.t[ty * s.L.w + tx]; };
        const fy = p.y + p.h + 2, ahead = p.x + p.w + 10;
        const road = T(ahead, fy) || T(ahead, fy + 16);
        if (p.onGround && !road && jt <= -3) jt = 30;
        // hop walkers standing in the road (a human would, or shoot them first)
        const foe = s.enemies.some(e => !e.dead && e.active !== false && !(e.def && e.def.flying) && e.x > p.x + p.w - 4 && e.x < p.x + p.w + 30 && Math.abs((e.y + e.h) - (p.y + p.h)) < 12);
        if (HOP && p.onGround && foe && jt <= -3) { hops++; jt = 22; }
        // a human hops anything that stops the truck dead (e.g. a crate the ram missed)
        if (p.onGround && Math.abs(p.vx) < 20 && (!s.race || s.race.countT <= 0) && jt <= -3) { stalls++; jt = 24; }
        key('KeyZ', jt-- > 0);
        key('KeyX', f % 20 < 2); // Donut fires out of the window
        DCW.stepFrames(1);
      }
      key('ArrowRight', false); key('KeyZ', false); key('KeyX', false);
      const s = DCW.stage.state, R = s.race || {}, P = s.player;
      const tx = Math.floor((P.x + P.w / 2) / 16), ch = (s.chunks || []).filter(c => c.x0 <= tx).pop();
      return { out, frames: f, secs: Math.round(f / 6) / 10, place: R.playerPlace || null, of: (R.rivals || []).length + 1, falls, stalls, hops,
        hp: R.hp != null ? Math.round(R.hp) + '/' + R.maxHp : null, items: Object.keys((DCW.save.run && DCW.save.run.items) || {}).join(' ') || undefined, progress: Math.round(100 * maxX / s.L.pxW) + '%',
        at: out ? undefined : (ch ? ch.id + ' col ' + (tx - ch.x0) : tx) + ' row ' + Math.floor((P.y + P.h - 1) / 16) + ' vx ' + Math.round(P.vx) };
    }, !args.includes('--nohop'));
    if (SHOTS) await page.screenshot({ path: path.join(SHOTS, id + '.png') });
    const ok = !res.err && errors.length === 0 && res.out && res.out !== 'left-scene' || (res.out === 'left-scene' && res.place);
    if (!ok || !res.place) bad++;
    console.log((ok && res.place ? 'OK   ' : 'BAD  ') + id.padEnd(9) + ' ' + JSON.stringify(res) + (errors.length ? '\n     ' + errors.slice(0, 5).join('\n     ') : ''));
  }
  console.log(bad ? bad + ' race(s) with problems' : 'all races finished');
  await browser.close();
})();

// Book 2 story walker: plays a whole run from NEW CRAWL to the ending by following the story.
// On a street it picks the next open, uncleared story door (teleporting between streets),
// waits for night at an inn when a door needs it, force-clears each level, and presses
// through every cinema, dialog and results screen. Reports errors, stalls and the route.
// Usage: node crawler2/tools/flow_test.js [shotsDir] [--real]   (--real: also lets each level run 3 s first)
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const SHOTS = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2]
  : '/tmp/claude-0/-home-user-Cards-n-more/5126f6e1-8ae9-52b1-b560-09304b97a236/scratchpad/flow/';
const REAL = process.argv.includes('--real');
fs.mkdirSync(SHOTS, { recursive: true });

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push('pageerror: ' + e.message + '\n' + (e.stack || '').split('\n').slice(0, 4).join('\n')));
  await page.goto('file://' + path.resolve(__dirname, '../index.html') + '?debug');
  await page.waitForTimeout(400);
  await page.evaluate(() => { localStorage.removeItem('dcw2_save_v1'); DCW.resetSave(); });
  const step = n => page.evaluate(n => DCW.stepFrames(n), n);
  const where = () => page.evaluate(() => {
    const s = DCW.scene, U = (DCW.ui && DCW.ui.scenes) || {};
    let n = 'unknown';
    for (const k in U) if (U[k] === s) n = k;
    if (DCW.stage && s === DCW.stage.scene) n = 'stage';
    if (DCW.rooms && s === DCW.rooms.scene) n = 'rooms';
    if (DCW.show && s === DCW.show.scene) n = 'show';
    const r = DCW.game.run || {};
    return { scene: n, area: r.area, levelId: r.levelId, inn: r.inInn, club: r.inClub, blocking: !!(DCW.ui.blocking && DCW.ui.blocking()), fading: DCW.fading(), won: r.won, clock: DCW.game.clock().label, phase: DCW.game.clock().phase, flags: Object.keys(r.flags || {}).length };
  });
  let shot = 0;
  const snap = async label => page.screenshot({ path: SHOTS + String(shot++).padStart(3, '0') + '_' + label.replace(/[^a-z0-9_]/gi, '_') + '.png' });
  const route = [];
  const seenShots = new Set();

  // the next open story door anywhere (current area first)
  const nextDoor = () => page.evaluate(() => {
    const G = DCW.game, r = G.run, A = DCW.data.areas || {};
    const ids = [r.area].concat(Object.keys(A).filter(a => a !== r.area));
    let needNight = null, needDay = null;
    for (const a of ids) {
      const doors = (A[a] && A[a].doors) || {};
      for (const ch of Object.keys(doors)) {
        const d = doors[ch]; if (d.kind !== 'level') continue;
        const lv = G.levelDef(d.target); if (!lv || lv.optional || r.cleared[d.target]) continue;
        const st = G.doorState(a, ch);
        if (!st || !st.visible) continue;
        if (st.locked) {
          if (/AFTER DARK/.test(st.lockText)) needNight = needNight || { a, ch };
          else if (/MORNING/.test(st.lockText)) needDay = needDay || { a, ch };
          continue;
        }
        return { a, ch, target: d.target };
      }
    }
    return { needNight, needDay };
  });

  let stall = 0, lastSig = '';
  try {
    await step(30); await snap('title');
    await page.evaluate(() => DCW.game.newRun());
    for (let it = 0; it < 3000; it++) {
      const w = await where();
      if (w.won && (w.scene === 'ending' || w.scene === 'title')) { await snap('ending'); route.push('WIN'); break; }
      const sig = JSON.stringify([w.scene, w.area, w.levelId, w.flags, w.clock]);
      if (sig === lastSig) stall++; else { stall = 0; lastSig = sig; }
      if (stall > 400) throw new Error('stalled at ' + sig);
      if (w.fading) { await step(8); continue; }
      if (w.blocking) {   // confirm prompts default to NO: the walker always says yes (it never uses the early stairs)
        await page.evaluate(() => { const t = DCW.ui.top && DCW.ui.top(); if (t && t.kind === 'confirm') { DCW.pressKey('up', 2); DCW.stepFrames(3); } DCW.pressKey('confirm', 2); });
        await step(6); continue;
      }
      const key = w.scene + ':' + (w.levelId || w.area || '');
      if (!seenShots.has(key)) { seenShots.add(key); await step(20); await snap(key); }
      if (w.scene === 'stage' || w.scene === 'rooms' || w.scene === 'show') {
        if (w.levelId) {
          if (REAL) await step(180);
          route.push(w.levelId);
          await page.evaluate(() => {
            const r = DCW.game.run, lv = DCW.game.levelDef(r.levelId) || {};
            if (lv.questItem) DCW.game.giveItem(lv.questItem);
            DCW.game.levelCleared({ levelId: r.levelId, kills: 9, time: 80, damageTaken: 2, maxCombo: 6, views: 300, gold: 12 });
          });
          await step(10);
          continue;
        }
        // on a street: let events run, then pick a door
        await step(10);
        const nd = await nextDoor();
        if (nd && nd.target) {
          if (nd.a !== w.area) { await page.evaluate(a => DCW.game.goArea(a, 'left'), nd.a); await step(40); continue; }
          route.push('door ' + nd.a + ':' + nd.ch);
          await page.evaluate(nd => DCW.game.useDoor(nd.a, nd.ch), nd);
          await step(30);
          continue;
        }
        const npcEv = await page.evaluate(() => {
          const G = DCW.game, r = G.run;
          const ok = w => { w = w || {}; return (w.flags || []).every(G.flag) && !(w.notFlags || []).some(G.flag) && (!w.phase || w.phase === 'any' || G.clock().phase === w.phase); };
          const e = (DCW.data.events || []).find(e => e.npc && !r.events[e.id] && ok(e.when));
          return e ? { npc: e.npc, area: e.area, id: e.id } : null;
        });
        if (npcEv) {
          route.push('talk ' + npcEv.npc);
          if (npcEv.area && npcEv.area !== w.area) { await page.evaluate(a => DCW.game.goArea(a, 'left'), npcEv.area); await step(40); }
          await page.evaluate(n => DCW.game.talk(n), npcEv.npc); await step(20); continue;
        }
        if (nd && nd.needNight) { route.push('wait for night'); await page.evaluate(() => { const r = DCW.game.run; DCW.game.advanceClock(((19 - r.hour % 24) + 24) % 24 || 24); }); await page.evaluate(a => DCW.game.goArea(a, 'left'), nd.needNight.a); await step(40); continue; }
        if (nd && nd.needDay) { route.push('wait for day'); await page.evaluate(() => { const r = DCW.game.run; DCW.game.advanceClock(((7 - r.hour % 24) + 24) % 24 || 24); }); await page.evaluate(a => DCW.game.goArea(a, 'left'), nd.needDay.a); await step(40); continue; }
        // nothing left to open: walk every area once so area events can fire
        const visited = await page.evaluate(() => { const r = DCW.game.run; const sig = Object.keys(r.flags).length + '/' + Object.keys(r.cleared).length; if (r._walkSig !== sig) { r._walkSig = sig; r._walked = {}; } r._walked = r._walked || {}; const A = Object.keys(DCW.data.areas || {}); const next = A.find(a => !r._walked[a]); if (next) { r._walked[next] = true; DCW.game.goArea(next, 'left'); return next; } return null; });
        if (visited) { route.push('walk ' + visited); await step(60); continue; }
        throw new Error('no open story door and nothing to walk to; objective=' + JSON.stringify(await page.evaluate(() => DCW.game.objective())));
      }
      if (w.scene === 'inn') { await page.evaluate(() => DCW.game.leaveInn()); await step(20); continue; }
      if (w.scene === 'club') { await page.evaluate(() => DCW.game.leaveClub()); await step(20); continue; }
      if (w.scene === 'classPick') {   // the real picks hide past the AI's locked three: scroll right, then pick
        await page.evaluate(() => {
          const cp = DCW.ui.scenes.classPick;
          if (cp.phase !== 'cards' || !cp.short) { DCW.pressKey('confirm', 2); return; }
          let want = cp.short.findIndex(e => e && !e.locked && !e.scroll);
          if (want < 0) want = cp.short.findIndex(e => e && e.scroll);
          for (let i = 0; i < 8 && cp.sel !== want; i++) { DCW.pressKey('right', 2); DCW.stepFrames(14); }
          DCW.pressKey('confirm', 2);
        });
        await step(8); continue;
      }
      if (w.scene === 'cinema' || w.scene === 'results' || w.scene === 'death' || w.scene === 'unknown') {
        await page.evaluate(() => DCW.pressKey(Math.random() < 0.2 ? 'start' : 'confirm', 2)); await step(8); continue;
      }
      if (w.scene === 'ending') { await snap('ending'); route.push('ENDING'); break; }
      await page.evaluate(() => DCW.pressKey('confirm', 2)); await step(8);
    }
  } catch (e) {
    errors.push('FLOW: ' + e.message);
    await snap('fail');
  }
  const final = await where();
  console.log('ROUTE:', route.join(' > '));
  console.log('FINAL:', JSON.stringify(final));
  console.log(errors.length ? 'ERRORS (' + errors.length + '):\n' + [...new Set(errors)].slice(0, 40).join('\n') : 'NO ERRORS');
  console.log('shots in', SHOTS);
  await browser.close();
  process.exit(errors.length ? 1 : 0);
})();

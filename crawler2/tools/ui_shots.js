// UI screenshot driver (book 2). Usage: node crawler2/tools/ui_shots.js [outDir] [filter] [--extra=query]
// Loads tools/ui_test.html?screen=X for each job, drives it with DCW.pressKey/stepFrames,
// screenshots the canvas (640x360 viewport, deviceScaleFactor 1) and reports console errors.
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const args = process.argv.slice(2);
const extra = (args.find(a => a.startsWith('--extra=')) || '').slice(8);
const pos = args.filter(a => !a.startsWith('--'));
const out = pos[0] || '/tmp/ui2_shots';
const filter = pos[1] || '';
fs.mkdirSync(out, { recursive: true });

const tap = (b, wait = 2) => [['press', b, 1], ['frames', wait]];
const taps = (b, n, wait = 2) => { let r = []; for (let i = 0; i < n; i++) r = r.concat(tap(b, wait)); return r; };
const J = [
  { n: 'title', s: 'title', steps: [['frames', 90], ['shot', 'title'], ...tap('down'), ['frames', 200], ['shot', 'title_b']] },
  { n: 'title_norun', s: 'title_norun', steps: [['frames', 40], ['shot', 'title_norun'], ...tap('confirm', 40), ['eval', 'DCW.scene === DCW.ui.scenes.cinema'], ['frames', 200], ['shot', 'title_newrun_cinema'], ...tap('start', 40), ['eval', 'DCW.scene === DCW.ui.scenes.classPick'], ['eval', 'window.__calls.join(" ")']] },
  { n: 'title_import', s: 'title_import', steps: [['frames', 40], ['shot', 'title_import'], ...tap('confirm', 10), ['shot', 'import_summary'], ['frames', 40], ...tap('confirm', 10), ['shot', 'title_after_import'], ['eval', 'JSON.stringify(DCW.save.meta.imported)+" "+DCW.save.unlocks.skins.join(",")']] },
  { n: 'title_newask', s: 'title_import', steps: [['frames', 30], ...tap('down'), ...tap('confirm', 10), ['shot', 'title_import_ask'], ...tap('down'), ...tap('confirm', 30), ['eval', 'window.__calls.join(" ")']] },
  { n: 'title_new_confirm', s: 'title', steps: [['frames', 30], ...tap('down'), ...tap('confirm', 10), ['shot', 'title_newcrawl_confirm']] },
  { n: 'import', s: 'import', steps: [['frames', 30], ['shot', 'import_direct']] },
  { n: 'classpick', s: 'classpick', steps: [['frames', 50], ['shot', 'cp_intro'], ['until', "DCW.scene.phase==='roll'", 'confirm', 60, 30], ['frames', 15], ['shot', 'cp_roll'], ['until', "DCW.scene.phase==='narrow'", 'none', 300, 4], ['frames', 20], ['shot', 'cp_narrow'], ['until', "DCW.scene.phase==='cards'", 'none', 300, 4], ['frames', 10], ['shot', 'cp_cards'], ...tap('confirm', 40), ['shot', 'cp_locked'], ['until', '!DCW.ui.blocking()', 'confirm', 20, 20], ...tap('right', 4), ['shot', 'cp_primal'], ...tap('confirm', 10), ['shot', 'cp_confirm'], ...tap('up', 2), ...tap('confirm', 30), ['shot', 'cp_chosen'], ['until', "DCW.scene.phase==='quake'", 'none', 400, 4], ['frames', 30], ['shot', 'cp_quake'], ['until', "DCW.scene.phase==='cards' && !DCW.ui.blocking()", 'confirm', 40, 30], ['frames', 30], ['shot', 'cp_class_cards'], ...tap('right', 4), ...tap('confirm', 10), ...tap('up', 2), ...tap('confirm', 30), ['until', "DCW.scene.phase==='bind'", 'confirm', 60, 30], ['frames', 45], ['shot', 'cp_bind'], ['until', "DCW.scene.STEPS[DCW.scene.step]==='outro'", 'confirm', 60, 30], ['frames', 60], ['shot', 'cp_outro'], ['until', 'window.__pickDone', 'confirm', 40, 30], ['eval', 'JSON.stringify(window.__pickDone)']] },
  { n: 'classpick_real', s: 'classpick', q: 'realdata', steps: [['frames', 50], ['shot', 'cpr_intro'], ['until', "DCW.scene.phase==='cards'", 'confirm', 80, 30], ['frames', 10], ['shot', 'cpr_cards'], ...tap('right'), ...tap('right'), ...tap('right', 4), ['shot', 'cpr_scroll_sel'], ...tap('confirm', 50), ['shot', 'cpr_scrolling'], ['until', "DCW.scene.phase==='cards'", 'none', 300, 4], ['frames', 20], ['shot', 'cpr_found'], ...tap('confirm', 10), ...tap('up', 2), ...tap('confirm', 120), ['shot', 'cpr_raceai'], ['until', "DCW.scene.phase==='cards' && DCW.scene.kind==='class' && !DCW.ui.blocking()", 'confirm', 80, 30], ['frames', 10], ['shot', 'cpr_class_cards'], ...tap('right'), ...tap('right'), ...tap('right', 4), ...tap('confirm', 4), ['until', "DCW.scene.phase==='cards'", 'none', 300, 4], ['frames', 20], ['shot', 'cpr_class_found'], ...tap('confirm', 10), ...tap('up', 2), ...tap('confirm', 30), ['until', "DCW.scene.phase==='bind'", 'confirm', 80, 30], ['frames', 45], ['shot', 'cpr_bind'], ['until', 'window.__pickDone', 'confirm', 80, 30], ['eval', 'JSON.stringify(window.__pickDone)']] },
  { n: 'classpick_empty', s: 'classpick_empty', steps: [['frames', 60], ['shot', 'cp_empty']] },
  { n: 'cinema', s: 'cinema', steps: [['frames', 20], ['shot', 'cine_fade'], ['frames', 60], ['shot', 'cine_walk'], ['until', 'DCW.scene.i===1 && DCW.ui.blocking()', 'none', 300, 4], ['frames', 60], ['shot', 'cine_lines'], ['until', 'DCW.scene.i===2', 'confirm', 30, 30], ['frames', 3], ['shot', 'cine_panel_flash'], ['frames', 60], ['shot', 'cine_panel'], ['until', 'DCW.scene.i===3', 'confirm', 30, 30], ['frames', 30], ['shot', 'cine_wobble'], ['until', 'DCW.scene.i===4', 'none', 300, 4], ['frames', 60], ['shot', 'cine_club'], ...tap('start', 10), ['eval', 'window.__cineDone']] },
  { n: 'cinema_empty', s: 'cinema_empty', steps: [['frames', 60], ['eval', 'window.__calls.join(" ")'], ['shot', 'cine_empty']] },
  { n: 'inn', s: 'inn', steps: [['frames', 10], ['shot', 'inn_tele'], ['frames', 40], ['shot', 'inn_a'], ['until', "DCW.scene.near && DCW.scene.near.id==='mordecai'", 'left', 300, 0], ['frames', 2], ['shot', 'inn_mordecai'], ...tap('confirm', 60), ['shot', 'inn_mord_hello'], ['until', "DCW.ui.isOpen('menu')", 'confirm', 10, 10], ['shot', 'inn_mord_menu'], ...taps('down', 2), ...tap('confirm', 8), ['shot', 'inn_craft'], ...tap('confirm', 10), ['shot', 'inn_crafted'], ['until', '!DCW.ui.blocking()', 'back', 10, 5], ['until', "DCW.scene.near && DCW.scene.near.id==='keeper'", 'right', 300, 0], ['frames', 2], ['shot', 'inn_keeper'], ...tap('confirm', 8), ['shot', 'inn_keeper_menu'], ...tap('confirm', 50), ['shot', 'inn_sleep'], ['until', '!DCW.ui.blocking()', 'none', 300, 5], ['frames', 10], ['shot', 'inn_after_sleep'], ['until', "DCW.scene.near && DCW.scene.near.id==='board'", 'left', 300, 0], ['frames', 2], ['shot', 'inn_tv'], ['until', "DCW.scene.near && DCW.scene.near.id==='wardrobe'", 'left', 400, 0], ['frames', 2], ['shot', 'inn_trunk'], ...tap('start', 8), ['shot', 'inn_menu'], ...tap('back', 4), ['until', 'Math.abs(DCW.scene.cx-DCW.scene.x)<24 && !DCW.scene.cmoving', 'none', 200, 5], ...tap('down', 10), ['shot', 'inn_pet'], ['eval', 'window.__calls.join(" ")']] },
  { n: 'inn_leave', s: 'inn', steps: [['frames', 30], ['hold', 'right', 30], ['frames', 2], ['shot', 'inn_door'], ...tap('confirm', 8), ['shot', 'inn_leave_confirm'], ...tap('up', 2), ...tap('confirm', 40), ['eval', 'window.__calls.join(" ")']] },
  { n: 'inn_narwhal', s: 'inn_narwhal', steps: [['frames', 60], ['shot', 'inn_narwhal'], ['eval', 'DCW.game.inSafeRoom()']] },
  { n: 'inn_empty', s: 'inn_empty', steps: [['frames', 60], ['shot', 'inn_empty']] },
  { n: 'club', s: 'club', steps: [['frames', 30], ['shot', 'club_a'], ['until', "DCW.scene.near && DCW.scene.near.id==='quint'", 'right', 300, 0], ['frames', 2], ['shot', 'club_quint'], ...tap('confirm', 10), ['shot', 'club_shop'], ...tap('back', 6), ['until', "DCW.scene.near && DCW.scene.near.id==='dance'", 'right', 300, 0], ['frames', 2], ['shot', 'club_dancefloor'], ...tap('confirm', 60), ['shot', 'club_dancing'], ['until', 'DCW.ui.blocking()', 'none', 300, 5], ['frames', 60], ['shot', 'club_dance_quip'], ['until', '!DCW.ui.blocking()', 'confirm', 10, 20], ...tap('start', 6), ['shot', 'club_menu'], ...tap('back', 4), ['until', "DCW.scene.near && DCW.scene.near.id==='bar'", 'right', 300, 0], ...tap('confirm', 60), ['shot', 'club_bar'], ['until', '!DCW.ui.blocking()', 'confirm', 10, 20], ['until', "DCW.scene.near && DCW.scene.near.id==='door'", 'left', 400, 0], ['frames', 2], ['shot', 'club_door'], ...tap('confirm', 30), ['eval', 'window.__calls.join(" ")']] },
  { n: 'club_empty', s: 'club_empty', steps: [['frames', 60], ['shot', 'club_empty']] },
  { n: 'results', s: 'results', steps: [['frames', 60], ['shot', 'results_a'], ['frames', 400], ['shot', 'results_b'], ...tap('confirm', 5), ['eval', 'window.__resultsDone']] },
  { n: 'results_empty', s: 'results_empty', steps: [['frames', 400], ['shot', 'results_empty']] },
  { n: 'death', s: 'death', steps: [['frames', 30], ['shot', 'death_a'], ['frames', 120], ['shot', 'death_b'], ...tap('down'), ...tap('confirm', 10), ['shot', 'death_quit_confirm']] },
  { n: 'death_guard', s: 'death_guard', steps: [['frames', 150], ['shot', 'death_guard']] },
  { n: 'death_rev', s: 'death', steps: [['frames', 150], ...tap('confirm', 30), ['eval', 'window.__calls.join(" ")']] },
  { n: 'death0', s: 'death0', steps: [['frames', 150], ['shot', 'death0'], ...tap('confirm', 40), ['eval', 'window.__calls.join(" ")']] },
  { n: 'ending_win', s: 'ending_win', steps: [['frames', 120], ['shot', 'end_win_p1'], ...tap('confirm', 200), ['shot', 'end_win_p2'], ...taps('confirm', 6, 120), ['frames', 200], ['shot', 'end_credits'], ['frames', 300], ['shot', 'end_credits2'], ...tap('start', 60), ['shot', 'end_stats'], ...tap('confirm', 40), ['eval', 'window.__calls.join(" ")']] },
  { n: 'ending_early', s: 'ending_early', steps: [['frames', 120], ['shot', 'end_early_p1'], ...tap('start', 30), ['frames', 100], ['shot', 'end_early_credits'], ...tap('start', 60), ['shot', 'end_early_stats'], ...tap('confirm', 30), ['eval', 'window.__calls.join(" ")']] },
  { n: 'ending_collapse', s: 'ending_collapse', steps: [['frames', 100], ['shot', 'end_collapse_card'], ...tap('confirm', 120), ['shot', 'end_collapse_p1'], ...tap('start', 60), ['shot', 'end_collapse_stats'], ...tap('confirm', 30), ['eval', 'window.__calls.join(" ")']] },
  { n: 'ending_empty', s: 'ending_empty', steps: [['frames', 100], ['shot', 'end_empty']] },
  { n: 'card', s: 'card', steps: [['frames', 150], ['shot', 'card'], ['frames', 60], ...tap('confirm', 4), ...tap('confirm', 6), ['eval', 'window.__cardDone']] },
  { n: 'hud', s: 'hud', steps: [['frames', 30], ['shot', 'hud_street']] },
  { n: 'hud_night', s: 'hud_night', steps: [['frames', 30], ['shot', 'hud_night']] },
  { n: 'hud_level', s: 'hud_level', steps: [['frames', 30], ['shot', 'hud_level'], ['eval', 'DCW.save.run.selected="jug"; 1'], ['frames', 6], ['shot', 'hud_cycle']] },
  { n: 'hud_wanted', s: 'hud_wanted', steps: [['frames', 30], ['shot', 'hud_wanted']] },
  { n: 'hud_low', s: 'hud_low', steps: [['frames', 30], ['shot', 'hud_low']] },
  { n: 'pause', s: 'pause', steps: [['frames', 10], ['shot', 'pause'], ...tap('up'), ...tap('confirm', 5), ['shot', 'pause_quit_confirm']] },
  { n: 'pause_level', s: 'pause_level', steps: [['frames', 10], ['shot', 'pause_level'], ...taps('up', 2), ...tap('confirm', 5), ['shot', 'pause_flee_confirm'], ...tap('up'), ...tap('confirm', 40), ['eval', 'window.__calls.join(" ")']] },
  { n: 'pause_nav', s: 'pause', steps: [['frames', 5], ...tap('down'), ...tap('confirm', 5), ['shot', 'pause_map'], ...tap('back', 4), ...tap('down'), ...tap('confirm', 5), ['shot', 'pause_quests'], ...tap('back', 4), ...tap('down'), ...tap('confirm', 5), ['shot', 'pause_character'], ...tap('back', 4), ...tap('down'), ...tap('confirm', 5), ['shot', 'pause_inventory'], ...tap('back', 4), ...tap('down'), ...tap('confirm', 5), ['shot', 'pause_settings']] },
  { n: 'character', s: 'character', steps: [['frames', 10], ['shot', 'character'], ...tap('confirm', 5), ['shot', 'character_nosafe']] },
  { n: 'boxes', s: 'boxes', steps: [['frames', 10], ['shot', 'boxes_list'], ...tap('confirm', 10), ['shot', 'boxes_locked']] },
  { n: 'wardrobe', s: 'wardrobe', steps: [['frames', 10], ['shot', 'wardrobe'], ...tap('down'), ['shot', 'wardrobe_locked'], ...tap('down'), ...tap('down'), ...tap('confirm', 5), ['shot', 'wardrobe_equip']] },
  { n: 'achievements', s: 'achievements', steps: [['frames', 10], ['shot', 'achievements'], ...taps('down', 3), ['shot', 'ach_locked'], ...tap('confirm', 5), ['shot', 'ach_read']] },
  { n: 'settings', s: 'settings', steps: [['frames', 10], ['shot', 'settings'], ...taps('down', 6), ...tap('confirm', 5), ['shot', 'controls']] },
  { n: 'shop', s: 'shop', steps: [['frames', 10], ['shot', 'shop'], ...tap('confirm', 5), ['shot', 'shop_bought'], ...taps('down', 6), ...tap('confirm', 5), ['shot', 'shop_limit'], ...tap('confirm', 5), ['shot', 'shop_soldout'], ['eval', 'window.__calls.join(" ")']] },
  { n: 'shop_pustule', s: 'shop_pustule', steps: [['frames', 10], ['shot', 'shop_pustule']] },
  { n: 'shop_missing', s: 'shop_missing', steps: [['frames', 10], ['shot', 'shop_missing']] },
  { n: 'map', s: 'map', steps: [['frames', 10], ['shot', 'map'], ...tap('right'), ['shot', 'map_right'], ...taps('left', 3), ['shot', 'map_village'], ...taps('right', 6), ['shot', 'map_far']] },
  { n: 'map_settle', s: 'map_settle', steps: [['frames', 10], ['shot', 'map_settle'], ...tap('up'), ['shot', 'map_admin']] },
  { n: 'map_norun', s: 'map_norun', steps: [['frames', 10], ['shot', 'map_norun']] },
  { n: 'quests', s: 'quests', steps: [['frames', 10], ['shot', 'quests'], ...tap('confirm', 5), ['shot', 'quests_read']] },
  { n: 'quests_none', s: 'quests_none', steps: [['frames', 10], ['shot', 'quests_none']] },
  { n: 'inventory', s: 'inventory', steps: [['frames', 10], ['shot', 'inventory'], ...taps('down', 2), ...tap('confirm', 5), ['shot', 'inventory_select'], ...taps('down', 3), ['shot', 'inventory_keys']] },
  { n: 'howto', s: 'howto', steps: [['frames', 10], ['shot', 'howto_kb'], ...tap('left'), ['shot', 'howto_city'], ...tap('left'), ['shot', 'howto_moves']] },
  { n: 'dialog', s: 'dialog', steps: [['frames', 20], ['shot', 'dialog_typing'], ['frames', 200], ['shot', 'dialog_full'], ...tap('confirm', 200), ['shot', 'dialog_p2'], ...tap('confirm', 100), ['shot', 'dialog_carl'], ...tap('confirm', 100), ['shot', 'dialog_donut'], ...tap('confirm', 100), ['shot', 'dialog_mordecai'], ...tap('confirm', 100), ['shot', 'dialog_signet'], ...tap('confirm', 100), ['shot', 'dialog_ripper'], ...tap('confirm', 100), ['shot', 'dialog_rando']] },
  { n: 'toasts', s: 'toasts', steps: [['frames', 4], ['shot', 'toasts_in'], ['frames', 40], ['shot', 'toasts']] },
  { n: 'menu', s: 'menu', steps: [['frames', 10], ['shot', 'menu'], ...tap('down'), ...tap('confirm', 5), ['shot', 'menu_disabled'], ...tap('down'), ['shot', 'menu_hint']] },
  { n: 'confirm', s: 'confirm', steps: [['frames', 10], ['shot', 'confirm']] },
  { n: 'versus', s: 'versus', steps: [['frames', 70], ['shot', 'versus']] }
];

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 640, height: 360 }, deviceScaleFactor: 1 });
  await ctx.addInitScript(() => { try { localStorage.clear(); } catch (e) { /* file:// */ } });
  const page = await ctx.newPage();
  let errors = [];
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.type() + ': ' + m.text()); });
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  const base = 'file://' + path.resolve(__dirname, 'ui_test.html');
  let bad = 0;
  for (const job of J) {
    if (filter && !job.n.includes(filter)) continue;
    errors = [];
    await page.goto(base + '?screen=' + job.s + (job.q ? '&' + job.q : '') + (extra ? '&' + extra : ''));
    await page.waitForTimeout(120);
    const evals = [];
    for (const st of job.steps) {
      if (st[0] === 'frames') await page.evaluate(n => DCW.stepFrames(n), st[1]);
      else if (st[0] === 'press' || st[0] === 'hold') await page.evaluate(([b, n]) => DCW.pressKey(b, n), [st[1], st[2]]);
      else if (st[0] === 'eval') { const r = await page.evaluate(st[1]); evals.push(r); }
      else if (st[0] === 'until') { // press a button (or just step) until a condition holds
        let ok = false;
        for (let i = 0; i < (st[3] || 100); i++) {
          if (await page.evaluate(st[1])) { ok = true; break; }
          if (st[2] && st[2] !== 'none') await page.evaluate(b => DCW.pressKey(b, 1), st[2]); else await page.evaluate(() => DCW.stepFrames(1));
          if (st[4]) await page.evaluate(n => DCW.stepFrames(n), st[4]);
        }
        if (!ok) evals.push('UNTIL FAILED: ' + st[1]);
      }
      else if (st[0] === 'shot') { const el = await page.$('#screen'); await el.screenshot({ path: path.join(out, st[1] + '.png') }); }
    }
    if (errors.length) bad++;
    console.log(job.n + ': ' + (errors.length ? 'ERRORS\n  ' + errors.join('\n  ') : 'ok') + (evals.length ? '  eval=' + JSON.stringify(evals) : ''));
  }
  await browser.close();
  console.log(bad ? bad + ' JOB(S) WITH CONSOLE ERRORS' : 'ALL CLEAN');
})();

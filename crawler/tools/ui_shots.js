// UI screenshot driver. Usage: node crawler/tools/ui_shots.js [outDir] [filter]
// Loads tools/ui_test.html?screen=X for a list of jobs, drives it with DCW.pressKey/stepFrames,
// screenshots the canvas at 3x, and reports console errors.
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const out = process.argv[2] || '/tmp/ui_shots';
const filter = process.argv[3] || '';
fs.mkdirSync(out, { recursive: true });

const tap = (b, wait = 2) => [['press', b, 1], ['frames', wait]];
const J = [
  { n: 'title', s: 'title', steps: [['frames', 90], ['shot', 'title'], ...tap('down'), ['frames', 200], ['shot', 'title_b']] },
  { n: 'title_norun', s: 'title_norun', steps: [['frames', 40], ['shot', 'title_norun'], ...tap('confirm', 30), ['shot', 'title_newrun']] },
  { n: 'title_new_confirm', s: 'title', steps: [['frames', 30], ...tap('down'), ...tap('confirm', 10), ['shot', 'title_newcrawl_confirm']] },
  { n: 'howto', s: 'howto', steps: [['frames', 10], ['shot', 'howto_kb'], ...tap('right'), ['shot', 'howto_pad'], ...tap('right'), ['shot', 'howto_touch'], ...tap('right'), ['shot', 'howto_moves']] },
  { n: 'intro', s: 'intro', steps: [['frames', 40], ['shot', 'intro_typing'], ['frames', 200], ['shot', 'intro_p1'], ...tap('confirm', 300), ['shot', 'intro_p2'], ...tap('confirm', 300), ['shot', 'intro_p3'], ...tap('confirm', 300), ['shot', 'intro_p4'], ...tap('confirm', 300), ['shot', 'intro_p5'], ...tap('start', 5), ['eval', 'window.__introDone']] },
  { n: 'floorcard', s: 'floorcard', steps: [['frames', 20], ['shot', 'floorcard_a'], ['frames', 80], ['shot', 'floorcard_b'], ['frames', 80], ['shot', 'floorcard_c'], ['frames', 120], ['shot', 'floorcard_say'], ...tap('confirm', 2), ...tap('confirm', 5), ['eval', 'window.__cardDone']] },
  { n: 'floorcard1', s: 'floorcard1', steps: [['frames', 150], ['shot', 'floorcard1']] },
  { n: 'results', s: 'results', steps: [['frames', 60], ['shot', 'results_a'], ['frames', 400], ['shot', 'results_b'], ...tap('confirm', 5), ['eval', 'window.__resultsDone']] },
  { n: 'death', s: 'death', steps: [['frames', 30], ['shot', 'death_a'], ['frames', 120], ['shot', 'death_b'], ...tap('down'), ...tap('confirm', 10), ['shot', 'death_quit_confirm']] },
  { n: 'death_rev', s: 'death', steps: [['frames', 150], ...tap('confirm', 5), ['eval', 'window.__calls.join(" ")']] },
  { n: 'death0', s: 'death0', steps: [['frames', 150], ['shot', 'death0'], ...tap('confirm', 40), ['eval', 'window.__calls.join(" ")'], ['shot', 'death0_after']] },
  { n: 'safe', s: 'safe', steps: [['frames', 30], ['shot', 'safe_a'], ['hold', 'left', 30], ['frames', 10], ['shot', 'safe_wardrobe'], ['hold', 'left', 50], ['frames', 2], ['shot', 'safe_boxes'], ['hold', 'left', 60], ['frames', 2], ['shot', 'safe_mordecai'], ...tap('confirm', 5), ['shot', 'safe_mordecai_menu'], ...tap('down'), ...tap('confirm', 60), ['shot', 'safe_rest_say'], ...tap('confirm', 3), ...tap('confirm', 3), ['hold', 'left', 60], ['frames', 2], ['shot', 'safe_shop'], ...tap('confirm', 5), ['shot', 'safe_shop_open'], ...tap('confirm', 5), ['shot', 'safe_shop_bought'], ...tap('back', 5), ['hold', 'right', 20], ['frames', 30], ...tap('down', 10), ['shot', 'safe_pet'], ['eval', 'window.__calls.join(" ")']] },
  { n: 'ending', s: 'ending', steps: [['frames', 120], ['shot', 'ending_p1'], ...tap('confirm', 200), ['shot', 'ending_p2'], ...tap('confirm', 2), ...tap('confirm', 120), ['shot', 'ending_credits'], ['frames', 300], ['shot', 'ending_credits2'], ...tap('start', 60), ['shot', 'ending_stats']] },
  { n: 'overworld', s: 'overworld', steps: [['frames', 30], ['shot', 'ow_a'], ['hold', 'up', 40], ['frames', 2], ['shot', 'ow_on1'], ['hold', 'right', 60], ['frames', 2], ['shot', 'ow_walk'], ['hold', 'down', 70], ['hold', 'right', 40], ['frames', 2], ['shot', 'ow_safe_near'], ['hold', 'down', 20], ['frames', 2], ['shot', 'ow_b'], ...tap('select', 5), ['shot', 'ow_map'], ...tap('back', 5), ...tap('start', 5), ['shot', 'ow_pause']] },
  { n: 'ow_roam', s: 'overworld', steps: [['eval', 'DCW.save.run.owPos={x:19,y:9}; DCW.setScene(DCW.overworld.scene,{floor:3}); 1'], ['frames', 30], ['shot', 'ow_roam_a'], ['hold', 'down', 30], ['frames', 120], ['shot', 'ow_roam_b'], ['frames', 120], ['shot', 'ow_roam_c'], ['eval', 'window.__calls.join(" ")']] },
  { n: 'ow_boss', s: 'overworld', steps: [['eval', 'DCW.save.run.owPos={x:23,y:3}; DCW.setScene(DCW.overworld.scene,{floor:3}); 1'], ['frames', 20], ['shot', 'ow_boss_locked'], ...tap('confirm', 4), ['shot', 'ow_boss_shake'], ['eval', 'DCW.save.run.owPos={x:28,y:1}; DCW.setScene(DCW.overworld.scene,{floor:3}); 1'], ['frames', 20], ['shot', 'ow_stairs']] },
  { n: 'hud', s: 'hud', steps: [['frames', 30], ['shot', 'hud']] },
  { n: 'hud3', s: 'hud3', steps: [['frames', 30], ['shot', 'hud3']] },
  { n: 'hud2', s: 'hud2', steps: [['frames', 30], ['shot', 'hud2']] },
  { n: 'pause', s: 'pause', steps: [['frames', 10], ['shot', 'pause'], ...tap('up'), ...tap('confirm', 5), ['shot', 'pause_quit_confirm'], ...tap('back', 5), ...tap('up'), ...tap('confirm', 5), ['shot', 'pause_flee_confirm']] },
  { n: 'character', s: 'character', steps: [['frames', 10], ['shot', 'character'], ...tap('confirm', 5), ['shot', 'character_spent'], ...tap('confirm'), ...tap('confirm', 5), ['shot', 'character_nopoints']] },
  { n: 'boxes', s: 'boxes', steps: [['frames', 10], ['shot', 'boxes_list'], ...tap('down'), ...tap('confirm', 40), ['shot', 'box_shake'], ['frames', 80], ['shot', 'box_shake2'], ['frames', 15], ['shot', 'box_burst'], ['frames', 40], ['shot', 'box_reveal'], ['frames', 60], ['shot', 'box_card'], ...tap('confirm', 70), ['shot', 'box_card2'], ...tap('confirm', 120), ['shot', 'box_done'], ...tap('confirm', 5), ['shot', 'boxes_after']] },
  { n: 'boxes_empty', s: 'boxes', steps: [['eval', 'DCW.save.run.boxes=[]; 1'], ['frames', 5], ['shot', 'boxes_empty']] },
  { n: 'wardrobe', s: 'wardrobe', steps: [['frames', 10], ['shot', 'wardrobe'], ...tap('down'), ['shot', 'wardrobe_locked'], ...tap('confirm', 5), ['shot', 'wardrobe_locked_msg'], ...tap('right', 5), ['shot', 'wardrobe_pals'], ...tap('down'), ...tap('down'), ['shot', 'wardrobe_pals2']] },
  { n: 'achievements', s: 'achievements', steps: [['frames', 10], ['shot', 'achievements'], ...tap('down'), ['shot', 'ach_locked'], ['hold', 'down', 60], ['shot', 'ach_scrolled']] },
  { n: 'settings', s: 'settings', steps: [['frames', 10], ['shot', 'settings'], ...tap('left'), ...tap('down'), ...tap('down'), ...tap('confirm'), ['shot', 'settings_changed'], ...tap('down'), ...tap('down'), ...tap('down'), ...tap('down'), ...tap('down'), ...tap('down'), ...tap('confirm', 5), ['shot', 'settings_reset1'], ...tap('up'), ...tap('confirm', 5), ['shot', 'settings_reset2']] },
  { n: 'shop', s: 'shop', steps: [['frames', 10], ['shot', 'shop'], ...tap('down'), ...tap('down'), ...tap('down'), ...tap('down'), ...tap('down'), ...tap('confirm', 5), ['shot', 'shop_fail']] },
  { n: 'mapow', s: 'mapow', steps: [['frames', 10], ['shot', 'map_ow']] },
  { n: 'maplinear', s: 'maplinear', steps: [['frames', 10], ['shot', 'map_linear']] },
  { n: 'dialog', s: 'dialog', steps: [['frames', 20], ['shot', 'dialog_typing'], ['frames', 200], ['shot', 'dialog_full'], ...tap('confirm', 200), ['shot', 'dialog_p2'], ...tap('confirm', 100), ['shot', 'dialog_carl'], ...tap('confirm', 100), ['shot', 'dialog_donut']] },
  { n: 'toasts', s: 'toasts', steps: [['frames', 4], ['shot', 'toasts_in'], ['frames', 40], ['shot', 'toasts'], ['frames', 160], ['shot', 'toasts_later']] },
  { n: 'menu', s: 'menu', steps: [['frames', 10], ['shot', 'menu'], ...tap('down'), ...tap('confirm', 5), ['shot', 'menu_disabled'], ...tap('down'), ['shot', 'menu_hint']] },
  { n: 'confirm', s: 'confirm', steps: [['frames', 10], ['shot', 'confirm']] }
];

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
  let errors = [];
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.type() + ': ' + m.text()); });
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  const base = 'file://' + path.resolve(__dirname, 'ui_test.html');
  for (const job of J) {
    if (filter && !job.n.includes(filter)) continue;
    errors = [];
    await page.goto(base + '?screen=' + job.s);
    await page.waitForTimeout(150);
    const evals = [];
    for (const st of job.steps) {
      if (st[0] === 'frames') await page.evaluate(n => DCW.stepFrames(n), st[1]);
      else if (st[0] === 'press') await page.evaluate(([b, n]) => DCW.pressKey(b, n), [st[1], st[2]]);
      else if (st[0] === 'hold') await page.evaluate(([b, n]) => DCW.pressKey(b, n), [st[1], st[2]]);
      else if (st[0] === 'eval') { const r = await page.evaluate(st[1]); evals.push(r); }
      else if (st[0] === 'shot') { const el = await page.$('#screen'); await el.screenshot({ path: path.join(out, st[1] + '.png') }); }
    }
    console.log(job.n + ': ' + (errors.length ? 'ERRORS\n  ' + errors.join('\n  ') : 'ok') + (evals.length ? '  eval=' + JSON.stringify(evals) : ''));
  }
  await browser.close();
})();

// Checks the Section 16 gameplay ports in the real game (index.html + real data/ui/art/game):
// fresh crawl + carry, gear, plot armor, pits, checkpoints, full-health boss bars, mob intros,
// Donut's gripes, gore, the once-per-crawl special card, the UP arrow and the boss arrow.
// Usage: node crawler2/tools/gameplay_check.js [shotsDir]
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const OUT = process.argv[2] || '/tmp/claude-0/-home-user-Cards-n-more/587c0249-9497-5ea6-95f8-fd439f13ca77/scratchpad/gameplay/check/';
fs.mkdirSync(OUT, { recursive: true });
const INDEX = 'file://' + path.resolve(__dirname, '../index.html');
let fails = 0, passes = 0;
function check(ok, msg, extra) { if (ok) passes++; else fails++; console.log((ok ? 'PASS ' : 'FAIL ') + msg + (extra !== undefined ? '  ' + JSON.stringify(extra) : '')); }

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push('pageerror: ' + e.message + ' ' + (e.stack || '').split('\n').slice(1, 3).join(' ')));
  const shot = name => page.screenshot({ path: path.join(OUT, name + '.png') });
  const load = async (q) => {
    await page.goto(INDEX + q);
    await page.waitForTimeout(250);
    await page.evaluate(() => {
      window.requestAnimationFrame = function () {};
      window.LOG = { toast: [], say: [], announce: [] };
      ['toast', 'say', 'announce'].forEach(fn => {
        const o = DCW.ui[fn];
        DCW.ui[fn] = function (a, b) { LOG[fn].push(Array.isArray(a) ? a.map(l => (l && l.text) || l).join(' | ') : (b && b.title ? b.title + ': ' : '') + a); return o.apply(this, arguments); };
      });
      window.T = {
        S: () => DCW.stage.state, P: () => DCW.stage.state.player,
        close() { for (let i = 0; i < 60 && DCW.ui.blocking && DCW.ui.blocking(); i++) { DCW.pressKey('confirm', 2); DCW.stepFrames(4); } },
        warp(x, feet) { const P = this.P(); P.x = x - P.w / 2; P.y = feet - P.h - 0.5; P.vx = 0; P.vy = 0; P.state = 'normal'; P.inv = 0; DCW.stepFrames(2); },
        until(fn, max) { for (let i = 0; i < (max || 600); i++) { if (fn()) return i; if (DCW.ui.blocking && DCW.ui.blocking()) DCW.pressKey('confirm', 2); DCW.stepFrames(1); } return -1; },
        hold(b, n) { DCW.testHold = b; DCW.stepFrames(n); DCW.testHold = null; DCW.stepFrames(1); }
      };
    });
  };
  const ev = fn => page.evaluate(fn);

  /* ---------- fresh crawl, gear, formulas ---------- */
  await load('?debug&skipintro');
  let r = await ev(() => {
    localStorage.removeItem('dcw2_save_v1'); DCW.resetSave(); DCW.legacy = { book1: null };
    DCW.game.newRun(); DCW.stepFrames(30);
    const run = DCW.game.run, st = DCW.game.playerStats();
    return { level: run.level, lvBase: run.lvBase, stats: run.stats, bonusHp: run.bonus.hp, gear: Object.keys(run.gear), list: DCW.game.gearList().map(g => g.id), st: { maxHp: st.maxHp, dmg: st.dmg, kick: st.kickDmg, hob: st.hobDmg, dyn: st.dynDmg, jug: st.jugDmg, fire: st.fireDmg, missile: st.missileDmg, bite: st.biteDmg, def: st.def, regen: st.regen }, xpNeed: DCW.game.xpNeed(13) };
  });
  check(r.level === 13 && r.lvBase === 12 && r.stats.str === 7 && r.stats.con === 6 && r.stats.dex === 5 && r.stats.int === 6 && r.bonusHp === 2, 'fresh crawl: level 13, str 7 con 6 dex 5 int 6, bonus hp 2', r);
  check(r.gear.length >= 11 && r.list.length === r.gear.length, 'fresh crawl: Book One end-of-book gear set', r.list);
  check(r.xpNeed === 25, 'XP curve stays Book Two (25 to level 14)', r.xpNeed);
  const exp = 2 + (7 - 3) + 6;
  check(r.st.dmg >= exp && r.st.hob === Math.round(r.st.dmg * 1.6) && r.st.dyn === Math.round(r.st.dmg * 3.2), 'punch = Book One formula (+gear), explosives keep their ratio', r.st);
  r = await ev(() => {
    const G = DCW.game, run = G.run, hp0 = G.playerStats().maxHp;
    DCW.data.gear = DCW.data.gear || {};
    DCW.data.gear.test_ring = DCW.data.gear.test_ring || { name: 'TEST RING', who: 'mongo', icon: 'ring', perk: { hp: 5, str: 1, bite: 2 }, desc: 'X' };
    const ok = G.giveGear('test_ring', 'TEST'), again = G.giveGear('test_ring', 'TEST');
    const st = G.playerStats();
    const last = G.gearList().slice(-1)[0].id;
    delete run.gear.test_ring;
    return { ok, again, has: true, gain: st.maxHp - hp0, last, counters: DCW.save.meta.counters.gear };
  });
  check(r.ok && !r.again && r.gain === 5 && r.last === 'test_ring' && r.counters >= 1, 'giveGear: once, perks summed, Mongo gear sorts last, track(gear)', r);


  await load('?debug&level=a1_bodies&skipintro');
  r = await ev(() => {
    DCW.stepFrames(30); T.close(); const G = DCW.game; DCW.data.gear = DCW.data.gear || {}; DCW.data.gear.test_cape = { name: 'TEST CAPE', who: 'carl', perk: {}, desc: 'X' };
    DCW.data.cinema.test_give = [{ bg: 'ruins', lines: [{ who: 'X', text: 'Y' }], give: [{ gear: 'test_cape' }] }];
    let done = false; G.playCinema('test_give', () => { done = true; });
    for (let i = 0; i < 400 && !done; i++) { DCW.pressKey('start', 2); DCW.pressKey('confirm', 2); DCW.stepFrames(4); }
    const has = G.hasGear('test_cape'); delete G.run.gear.test_cape;
    return { done, has };
  });
  check(r.done && r.has, 'cinema give list hands out {gear}', r);

  /* ---------- Book One carry ---------- */
  r = await ev(() => {
    localStorage.removeItem('dcw2_save_v1'); DCW.resetSave();
    DCW.legacy = { book1: { meta: { achievements: {}, wins: 1, carry: { level: 6, xp: 10, statPoints: 2, stats: { str: 5, con: 4, dex: 4, int: 3 }, bonus: { hp: 3 }, gold: 222, potions: 4, bombs: 5, views: 7000, kills: 300, boxes: [{ tier: 'gold', from: 'X' }], name: 'CARL', gear: { war_gauntlet: true, crown_sepsis: true }, won: true } }, unlocks: { skins: [] }, equipped: { skin: 'carl_boxers' } } };
    const sum = DCW.game.importLegacy();
    DCW.game.newRun(); DCW.stepFrames(10);
    const run = DCW.game.run;
    return { sum: !!sum, level: run.level, lvBase: run.lvBase, stats: run.stats, points: run.statPoints, bonusHp: run.bonus.hp, gold: run.gold, potions: run.potions, hob: run.items.hob, views: run.views, kills: run.kills, gear: Object.keys(run.gear), name: run.name, boxes: run.boxes.length };
  });
  check(r.level === 6 && r.lvBase === 5 && r.stats.str === 5 && r.points === 2 && r.bonusHp === 3 && r.gold === 222 && r.potions === 4 && r.hob >= 5 && r.views === 7000 && r.kills === 300 && r.name === 'CARL', 'carry: Book One snapshot as it is', r);
  check(r.gear.length === 2 && r.gear.indexOf('war_gauntlet') >= 0, 'carry: the snapshot gear comes along', r.gear);
  r = await ev(() => {
    localStorage.removeItem('dcw2_save_v1'); DCW.resetSave();
    DCW.legacy = { book1: { meta: { achievements: {}, wins: 0 }, run: { level: 4, stats: { str: 4, con: 3, dex: 3, int: 3 }, bonus: { hp: 2 }, gold: 5, potions: 1, bombs: 0, views: 0, kills: 9, boxes: [] }, unlocks: { skins: [] }, equipped: {} } };
    DCW.game.importLegacy(); DCW.game.newRun(); DCW.stepFrames(10);
    return Object.keys(DCW.game.run.gear).length;
  });
  check(r >= 11, 'carry without gear gets the end-of-book gear set', r);

  /* ---------- a level: mob intro, gore, gripe, checkpoint, pit, plot armor ---------- */
  await load('?debug&level=a1_bodies&skipintro');
  await ev(() => { localStorage.removeItem('dcw2_save_v1'); });
  await load('?debug&level=a1_bodies&skipintro');
  r = await ev(() => {
    DCW.stepFrames(40); T.close();
    const S = T.S(), P = T.P();
    S.enemies.forEach(e => { e.dead = true; }); DCW.stepFrames(2);
    const gy = P.y + P.h; T.warp(P.x + 40, gy);
    const e = DCW.stage.spawn('fat_clown', P.x + 26, gy); e.hp = 1; e.stun = 9;
    P.face = 1; T.hold({ attack: 1 }, 3); DCW.stepFrames(30);
    const intro = S.mobIntroQ.length + LOG.say.filter(t => /CLAMMY|CLOWN/.test(t)).length;
    T.close();
    return { dead: e.dead, splats: S.splats.length, met: !!DCW.game.run.mobsMet.fat_clown, intro, said: LOG.say.slice(-1)[0] };
  });
  check(r.dead && r.splats > 0, 'gore: a kill leaves a blood splat on the floor', r);
  check(r.met && r.intro > 0, 'mob introduction from flavor on the first kill', r);
  await ev(() => { const S = T.S(); const P = T.P(); const e = DCW.stage.spawn('lemur', P.x + 30, P.y + P.h); e.hp = 1; e.init = true; e.perched = false; e.hidden = false; P.face = 1; T.hold({ attack: 1 }, 3); DCW.stepFrames(4); });
  await shot('gore_splat');
  r = await ev(() => {
    const S = T.S(), P = T.P(); T.close();
    S.gripeT = 0; DCW.game.run.gripes = {};
    const e = DCW.stage.spawn('fat_clown', P.x + 4, P.y + P.h); e.hostile = true;
    const hp0 = DCW.game.run.hp; P.inv = 0;
    T.until(() => DCW.game.run.hp < hp0, 200);
    e.dead = true; DCW.stepFrames(2);
    return { hurt: DCW.game.run.hp < hp0, gripe: LOG.toast.filter(t => /^DONUT/.test(t)), gripes: DCW.game.run.gripes };
  });
  check(r.hurt && r.gripe.length === 1, "Donut's gripe toast on a hit (once per crawl)", r);
  r = await ev(() => {
    const S = T.S(), P = T.P();
    let cp = S.objects.find(o => o.kind === 'checkpoint');
    if (!cp) { cp = { kind: 'checkpoint', x: P.x + 40, y: P.y + P.h - 24, w: 12, h: 24, on: false }; S.objects.push(cp); }   // this seed has no flag: plant one
    T.warp(cp.x + cp.w / 2, cp.y + cp.h); DCW.stepFrames(3);
    return { saved: DCW.game.run.checkpoint, cpx: cp.x + cp.w / 2 };
  });
  check(r.saved && r.saved.level === 'a1_bodies' && Math.abs(r.saved.x - r.cpx) < 1, 'checkpoint flag saved to run.checkpoint', r);
  r = await ev(() => {
    T.close();
    const run = DCW.game.run, S = T.S(), P = T.P();
    S.god = false; run.god = false; P.state = 'normal'; const rev0 = run.revivals, gold0 = run.gold, hours0 = run.hoursLeft;
    P.y = S.L.pxH + 20; DCW.stepFrames(2);
    const dead = P.state === 'dead', hpAtDeath = run.hp;
    T.until(() => DCW.stage.state !== S, 600); DCW.stepFrames(40);
    const S2 = DCW.stage.state, P2 = S2 && S2.player;
    const lines = LOG.say.filter(t => /PLOT ARMOR/.test(t)).length;
    return { dead, hpAtDeath, newState: S2 !== S, used: run.plotArmorUsed, hp: run.hp, max: DCW.game.playerStats().maxHp, rev: run.revivals === rev0, gold: run.gold === gold0, hours: run.hoursLeft === hours0,
      atCp: run.checkpoint && P2 ? Math.abs((P2.x + P2.w / 2) - run.checkpoint.x) < 30 : 'no checkpoint', lines, scene: DCW.scene === DCW.stage.scene };
  });
  check(r.dead && r.hpAtDeath === 0, 'pits are death (hp 0)', r);
  check(r.newState && r.used && r.hp === r.max && r.rev && r.gold && r.hours && r.scene, 'plot armor: first death is free, full hp, no revival/gold/hours lost', r);
  check(r.atCp === true, 'plot armor returns Carl to the last flag', r.atCp);
  await ev(() => { DCW.stepFrames(20); });
  await shot('plot_armor_return');
  r = await ev(() => {
    T.close();
    const run = DCW.game.run, S = T.S(), P = T.P(); S.god = false;
    P.y = S.L.pxH + 20; DCW.stepFrames(2);
    for (let i = 0; i < 400 && DCW.scene === DCW.stage.scene; i++) { if (DCW.ui.blocking()) DCW.pressKey('confirm', 2); DCW.stepFrames(1); }
    DCW.stepFrames(30);
    let n = 'other'; for (const k in DCW.ui.scenes) if (DCW.ui.scenes[k] === DCW.scene) n = k;
    return { scene: n, hp: run.hp, cause: run.lastDeath && run.lastDeath.cause };
  });
  check(r.scene === 'death' && r.hp === 0, 'second death goes to the death screen with hp 0', r);
  await shot('death_screen');

  /* ---------- boss: full-health bars, boss arrow, special card ---------- */
  await load('?debug&level=a1_lemurs&skipintro&god');
  r = await ev(() => {
    DCW.stepFrames(30); T.close();
    DCW.stage.debugWarpBoss(); DCW.stepFrames(5);
    const S = T.S();
    T.until(() => { if (DCW.ui.blocking()) { DCW.pressKey('confirm', 2); } DCW.testHold = { right: 1 }; return S.locked; }, 600); DCW.testHold = null;
    for (let i = 0; i < 300 && !(S.boss.active && !DCW.ui.blocking()); i++) { if (DCW.ui.blocking()) DCW.pressKey('confirm', 2); DCW.stepFrames(2); }
    const B = S.boss, P = T.P();
    const bars = B.phases.length, max = B.maxHp;
    B.hp = 1; B.stun = 3; B.flash = 0; T.warp(B.x - 6, B.groundY); P.face = 1;
    T.hold({ attack: 1 }, 3); DCW.stepFrames(8);
    const full = B.phase === 1 && B.hp === B.maxHp, pop = S.nums.some(n => /FULL HEALTH/.test(n.text));
    return { bars, max, phase: B.phase, hp: B.hp, full, pop, announce: LOG.announce.slice(-2) };
  });
  check(r.bars >= 2 && r.full && r.pop, 'boss phase = a full bar again, FULL HEALTH! pop', r);
  await shot('boss_full_health');
  r = await ev(() => {
    const S = T.S(), B = S.boss, P = T.P();
    DCW.stepFrames(70);
    B.stun = 30; B.x = S.cam.x + 330; B.vx = 0; DCW.stepFrames(1);
    return { cam: S.cam.x, bx: B.x, locked: S.locked };
  });
  for (let i = 0; i < 4; i++) { await ev(() => DCW.stepFrames(1)); }
  await shot('boss_arrow_a'); await ev(() => DCW.stepFrames(8)); await shot('boss_arrow_b');
  r = await ev(() => {
    const S = T.S(); S.special = 1; DCW.pressKey('special', 2); DCW.stepFrames(30); T.close();
    const a1 = LOG.announce.filter(t => /PANIC/.test(t)).length;
    S.special = 1; DCW.pressKey('special', 2); DCW.stepFrames(2);
    const a2 = LOG.announce.filter(t => /PANIC/.test(t)).length, pop = S.nums.some(n => /PANIC/.test(n.text));
    return { a1, a2, pop, seen: DCW.game.run.specialsSeen };
  });
  check(r.a1 === 1 && r.a2 === 1 && r.pop, 'special name card once per crawl, then a pop over Carl', r);
  r = await ev(() => DCW.stage.debugBalance());
  check(r && r.carl && r.mobs.length > 0 && r.boss, 'debugBalance reports Carl vs the level', r && { carl: r.carl, boss: r.boss });

  /* ---------- UP arrow at a door ---------- */
  await load('?debug&area=village&skipintro');
  r = await ev(() => {
    DCW.stepFrames(30);
    for (let i = 0; i < 300 && (DCW.scene !== DCW.stage.scene || DCW.ui.blocking() || DCW.fading()); i++) { DCW.pressKey(i % 2 ? 'confirm' : 'start', 2); DCW.stepFrames(4); }
    DCW.stepFrames(20); T.close();
    const S = T.S(), d = S.objects.find(o => o.kind === 'sdoor' && o.st && o.st.visible);
    if (!d) return null;
    T.warp(d.x + d.w / 2, d.fy); DCW.stepFrames(120);
    for (let i = 0; i < 30 && Math.floor(S.t * 3) % 3 === 2; i++) DCW.stepFrames(1);   // the arrow blinks
    return { door: d.ch };
  });
  await shot('up_arrow_door');
  check(!!r, 'standing at a street door (see up_arrow_door.png)', r);

  console.log(errors.length ? 'ERRORS:\n' + [...new Set(errors)].slice(0, 20).join('\n') : 'NO PAGE ERRORS');
  console.log(passes + ' passed, ' + fails + ' failed; shots in ' + OUT);
  await browser.close();
  process.exit(fails || errors.length ? 1 : 0);
})();

// Headless test for js/stage.js (book 2) using tools/stage_test.html + stage_fixtures.js + the real game.js.
// Usage: node crawler2/tools/stage_test.js [screenshotDir]
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const OUT = process.argv[2] || path.resolve(__dirname, '../../../stage2_shots');
fs.mkdirSync(OUT, { recursive: true });
const HTML = 'file://' + path.resolve(__dirname, 'stage_test.html');

let failures = 0, passes = 0;
function check(cond, msg, extra) {
  if (cond) passes++; else failures++;
  console.log((cond ? 'PASS ' : 'FAIL ') + msg + (extra !== undefined ? '  ' + JSON.stringify(extra) : ''));
}

// in-page helpers
const HELPERS = () => {
  window.T = {
    down: {},
    key(code, on) { if (!!this.down[code] === on) return; this.down[code] = on; window.dispatchEvent(new KeyboardEvent(on ? 'keydown' : 'keyup', { code })); },
    release() { Object.keys(this.down).forEach(c => this.key(c, false)); },
    hold(codes, frames) { codes.forEach(c => this.key(c, true)); DCW.stepFrames(frames); codes.forEach(c => this.key(c, false)); DCW.stepFrames(1); },
    tap(code, after) { this.key(code, true); DCW.stepFrames(2); this.key(code, false); DCW.stepFrames(after === undefined ? 1 : after); },
    S() { return DCW.stage.state; }, P() { return DCW.stage.state.player; },
    warp(x, feet) { const P = this.P(); P.x = x - P.w / 2; P.y = feet - P.h - 0.5; P.vx = 0; P.vy = 0; P.state = 'normal'; P.inv = 0; DCW.stepFrames(2); },
    calls(fn) { return DCW.testLog.calls.filter(c => c[0] === fn); },
    objs(kind) { return DCW.stage.state.objects.filter(o => o.kind === kind); },
    god(on) { const S = this.S(); S.god = on; },
    until(fn, max) { for (let i = 0; i < (max || 600); i++) { if (fn()) return i; DCW.stepFrames(1); } return -1; },
    count(id) { return DCW.game && DCW.game.itemCount ? DCW.game.itemCount(id) : (DCW.save.run.items[id] || 0); },
    clearEnemies() { DCW.stage.state.enemies.forEach(e => { e.dead = true; }); DCW.stepFrames(1); },
    face(dir) { const S = this.S(); S.player.face = dir; }
  };
};

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 960, height: 540 }, deviceScaleFactor: 1 });
  let errors = [];
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.type() + ': ' + m.text()); });
  page.on('pageerror', e => errors.push('pageerror: ' + e.message + ' ' + (e.stack || '').split('\n').slice(1, 3).join(' ')));
  await page.addInitScript(HELPERS);
  const ev = (fn, arg) => page.evaluate(fn, arg);
  const shot = name => page.screenshot({ path: path.join(OUT, name + '.png') });
  async function load(q) {
    errors = [];
    await page.goto(HTML + '?manual&debug&' + q);
    await page.waitForFunction(() => window.DCW && DCW.stage && DCW.stage.state);
    await ev(() => DCW.stepFrames(3));
  }
  function noErrors(tag) { check(errors.length === 0, tag + ': no console errors', errors.slice(0, 4)); errors = []; }

  /* ================= STREETS ================= */
  await load('area=village');
  let r = await ev(() => {
    DCW.stepFrames(30);
    const S = T.S(), doors = T.objs('sdoor');
    const st = ch => { const d = doors.find(o => o.ch === ch); return d && d.st; };
    return { mode: S.mode, area: S.areaId, ev: T.calls('areaEvents').map(c => c[1]), said: DCW.testLog.say.join(' '), ndoors: doors.length,
      d6: st('6'), d5: st('5'), d8: st('8'), d2: st('2'), citizens: S.enemies.filter(e => e.citizen).length,
      hud: DCW.testLog.hud, npc: T.objs('npc').map(o => [o.id, o.visible]), night: S.night };
  });
  check(r.mode === 'street' && r.area === 'village', 'street mode for village', r.mode);
  check(r.ev.length === 1 && r.ev[0] === 'village', 'areaEvents called once on enter', r.ev);
  check(/WELCOME TO THE THIRD FLOOR/.test(r.said), 'area event ran (dialog shown)');
  check(r.ndoors === 8, 'eight street doors built from area.doors', r.ndoors);
  check(r.d6 && r.d6.visible === false, 'showIf door hidden until its flag', r.d6);
  check(r.d5 && r.d5.locked === true, 'night-only door locked by day', r.d5);
  check(r.d8 && r.d8.locked && /SEALED/.test(r.d8.lockText), 'needs-flag door locked with lockText', r.d8);
  check(r.citizens >= 3, 'citizens wander by day in a guarded area', r.citizens);
  check(r.hud && r.hud.clock && r.hud.clock.label && r.hud.objective === 'FIND OUT WHAT THE CIRCUS WANTS', 'HUD has clock + objective on streets', r.hud && [r.hud.clock, r.hud.objective]);
  check(r.hud && r.hud.explosive && r.hud.explosive.id === 'jug' && r.hud.party.join() === 'donut,mongo', 'HUD has explosive + party', r.hud && [r.hud.explosive, r.hud.party]);
  check(r.npc.some(n => n[0] === 'mordecai_tour' && n[1]), 'area NPC placed by x and visible by day', r.npc);
  // walk to the shop door and press up
  r = await ev(() => {
    T.god(true); T.S().enemies.forEach(e => { if (!e.citizen) e.dead = true; }); T.S().street.spawnT = 999;
    const d = T.objs('sdoor').find(o => o.ch === '3'); T.warp(d.x + d.w / 2, d.fy); T.tap('ArrowUp', 5);
    return { door: T.calls('useDoor').slice(-1)[0], shop: DCW.testLog.shop.slice(-1)[0], pos: T.calls('saveStreetPos').length };
  });
  check(r.door && r.door[1] === 'village' && r.door[2] === '3', 'UP at a door calls game.useDoor(area, ch)', r.door);
  check(r.shop === 'lucky', 'shop door opened the shop UI (through game.js)', r.shop);
  check(r.pos > 0, 'saveStreetPos called before using a door', r.pos);
  await shot('street_village_shop_door');
  r = await ev(() => {
    DCW.stepFrames(60);
    const d = T.objs('sdoor').find(o => o.ch === '7'); T.warp(d.x + d.w / 2, d.fy); T.tap('ArrowUp', 5);
    const sp = T.objs('signpost')[0]; DCW.stepFrames(60); T.warp(sp.x + sp.w / 2, sp.y + sp.h); T.tap('ArrowUp', 3);
    const n = T.objs('npc')[0]; DCW.stepFrames(60); T.warp(n.x + n.w / 2, n.fy); T.tap('ArrowUp', 3);
    return { talkDoor: T.calls('useDoor').slice(-1)[0], said: DCW.testLog.say.join(' '), map: DCW.game.flag('map_village'), talk: T.calls('talk').map(c => c[1]) };
  });
  check(r.talkDoor && r.talkDoor[2] === '7' && /HELP ME/.test(r.said), 'npc talk spot door -> game talks', r.talkDoor);
  check(r.map === true, 'signpost rock sets map_village', r.map);
  check(r.talk.indexOf('mordecai_tour') >= 0, 'UP at an area NPC calls game.talk(id)', r.talk);
  // crime: punch a citizen
  r = await ev(() => {
    const S = T.S(); T.god(false);
    const c = S.enemies.find(e => e.citizen && !e.dead);
    c.vx = 0; c.stun = 5; // hold still
    // full hp and no street mobs around: they hit harder now, and a death here would eat the punches
    DCW.save.run.hp = DCW.game.playerStats().maxHp; S.enemies.forEach(e => { if (!e.citizen && e.ai !== 'guard') e.dead = true; });
    T.warp(c.x - 8, c.y + c.h); T.face(1); T.tap('KeyX', 20);
    const guards = S.enemies.filter(e => e.ai === 'guard' && !e.dead).length;
    const P = T.P();
    return { crime: T.calls('crime').map(x => x[1]), guards, wanted: DCW.save.run.wanted, dead: !!c.dead, diag: { ps: P.state, px: Math.round(P.x), py: Math.round(P.y), cx: Math.round(c.x), cy: Math.round(c.y), cw: c.w, ch: c.h, chp: c.hp, cid: c.id, face: P.face, ground: P.onGround, hp: DCW.save.run.hp, inv: c.inv, flying: c.flying } };
  });
  check(r.crime[0] === 'village' && r.dead, 'hurting a citizen calls game.crime(area)', r);
  check(r.guards === 2 && r.wanted === 'village', 'guards spawn from both sides', r);
  await ev(() => DCW.stepFrames(30));
  await shot('street_village_crime');
  r = await ev(() => {
    const S = T.S(), g = S.enemies.find(e => e.ai === 'guard');
    g.hp = 1; T.warp(g.x - 6, g.y + g.h); T.face(1); T.tap('KeyX', 10);
    const alive = !g.dead && g.hp === 999 ? 'invuln' : (g.dead ? 'dead' : 'hp' + g.hp);
    const n = T.until(() => T.calls('playerDied').length > 0, 900);
    return { alive, guardHp: g.hp, n, died: T.calls('playerDied').slice(-1)[0] };
  });
  check(!r.alive.startsWith('dead'), 'guards are invulnerable', r.alive);
  check(r.died && r.died[1].cause === 'guard', 'guards kill: playerDied({cause:"guard"})', r.died);
  noErrors('street village day');
  // edges
  await load('area=village');
  r = await ev(() => {
    const S = T.S(); T.warp(S.L.pxW - 30, 160); T.hold(['ArrowRight'], 40);
    const e = T.calls('edge').slice(-1)[0];
    DCW.stepFrames(60);
    return { edge: e, now: DCW.stage.state.areaId, x: Math.round(DCW.stage.state.player.x) };
  });
  check(r.edge && r.edge[1] === 'village' && r.edge[2] === 'right', 'walking off the right edge calls game.edge(area, "right")', r.edge);
  check(r.now === 'ruins_w' && r.x < 60, 'edge led into the next street at its left entry', r);
  r = await ev(() => {
    const S = T.S(); T.warp(14, 160); T.hold(['ArrowLeft'], 40); DCW.stepFrames(60);
    return { edge: T.calls('edge').slice(-1)[0], now: DCW.stage.state.areaId, x: Math.round(DCW.stage.state.player.x), w: DCW.stage.state.L.pxW };
  });
  check(r.edge && r.edge[2] === 'left' && r.now === 'village' && r.x > r.w - 80, 'left edge back to the village, entering at the right', r);
  await shot('street_edge_return');
  // a level door
  r = await ev(() => {
    const d = T.objs('sdoor').find(o => o.ch === '2'); T.warp(d.x + d.w / 2, d.fy); T.tap('ArrowUp', 40);
    const S = DCW.stage.state;
    return { enter: T.calls('enterLevel').map(c => c[1]), mode: S.mode, id: S.id };
  });
  check(r.enter[0] === 't_side' && r.mode === 'level' && r.id === 't_side', 'level door -> enterLevel -> stage level', r);
  noErrors('street edges + level door');
  // night street
  await load('area=village&night');
  r = await ev(() => {
    DCW.stepFrames(30);
    const S = T.S();
    return { night: S.night, citizens: S.enemies.filter(e => e.citizen).length, ids: S.enemies.map(e => e.id), d5: T.objs('sdoor').find(o => o.ch === '5').st.locked, npc: T.objs('npc').map(o => o.visible), hud: DCW.testLog.hud.clock };
  });
  check(r.night && r.citizens === 0, 'no citizens at night', r);
  check(r.ids.length && r.ids.every(id => id === 'street_urchin' || id === 'incubus'), 'night enemy list', r.ids);
  check(r.d5 === false, 'night door opens at night', r.d5);
  check(r.npc.every(v => !v), 'day-only NPC hidden at night', r.npc);
  // urchin: neutral until provoked
  r = await ev(() => {
    const S = T.S(); T.clearEnemies();
    const u = DCW.stage.spawn('street_urchin', T.P().x + 60, 160); u.hostile = false;
    const hp0 = DCW.save.run.hp; DCW.stepFrames(120);
    const harmless = DCW.save.run.hp === hp0 && !u.hostile;
    T.warp(u.x - 8, u.y + u.h); T.face(1); T.tap('KeyX', 2);
    return { harmless, hostile: u.hostile };
  });
  check(r.harmless && r.hostile, 'street urchin neutral until hit, then hostile', r);
  await ev(() => DCW.stepFrames(20));
  await shot('street_village_night');
  noErrors('street night');

  /* ================= SIDE LEVEL + CARL'S KIT ================= */
  await load('level=t_side');
  r = await ev(() => {
    DCW.stepFrames(40);
    const S = T.S();
    return { mode: S.mode, kind: S.kind, said: DCW.testLog.say.join(' '), party: Object.keys(S.party), signs: T.objs('sign').length, npcs: T.objs('npc').length, q: T.objs('qitem').length, perch: S.enemies.filter(e => e.ai === 'perch').length };
  });
  check(r.mode === 'level' && r.kind === 'side', 'side level', r);
  check(/TEST INTRO LINE/.test(r.said), 'level intro lines said');
  check(r.party.join() === 'donut,mongo', 'party donut + mongo (act 1)', r.party);
  check(r.npcs === 1 && r.q === 1, 'N npc spot + Q quest item placed', r);
  r = await ev(() => {
    const n = T.objs('npc')[0]; T.warp(n.x + n.w / 2, n.fy); T.tap('ArrowUp', 3);
    const q = T.objs('qitem')[0]; T.warp(q.x + 8, q.y + q.h + 2); DCW.stepFrames(5);
    return { said: DCW.testLog.say.join(' '), item: T.count('scratch_ticket') };
  });
  check(/PUNCHES THINGS/.test(r.said), 'level NPC lines via ui.say', r.said.slice(-60));
  check(r.item === 1, 'quest item collected into run.items', r.item);
  // punches, kick, stomp
  r = await ev(() => {
    T.clearEnemies(); T.god(true);
    const P = T.P(); T.warp(200, 160); T.face(1);
    const e = DCW.stage.spawn('fat_clown', 222, 160); e.stun = 99;
    const hp0 = e.hp; T.tap('KeyX', 14); const hp1 = e.hp;
    e.hp = 50; e.maxHp = 50; T.warp(204, 160); T.face(1);
    T.key('ArrowDown', true); T.tap('KeyX', 24); T.key('ArrowDown', false); DCW.stepFrames(4);
    return { punch: hp0 - hp1, kick: 50 - e.hp, kd: DCW.game.playerStats().kickDmg, pd: DCW.game.playerStats().dmg };
  });
  check(r.punch > 0, 'punch hurts', r);
  check(r.kick >= r.kd, 'down+attack kick does kickDmg', r);
  // explosives
  r = await ev(() => {
    T.clearEnemies(); const S = T.S(); T.warp(120, 160); T.face(1);
    const jug0 = T.count('jug'); T.tap('KeyC', 1); const thrown = S.pproj.filter(p => p.xid === 'jug').length;
    T.until(() => S.fires.length > 0, 120); const fire = S.fires.length;
    DCW.stepFrames(12); DCW.save.run.selected = 'jug'; T.key('ArrowUp', true); T.tap('KeyC', 1); T.key('ArrowUp', false);
    const sel = DCW.save.run.selected;
    DCW.save.run.selected = 'dyn'; T.warp(200, 160); T.tap('KeyC', 1); const dynP = S.pproj.find(p => p.xid === 'dyn');
    const fuseFrames = T.until(() => !S.pproj.some(p => p.xid === 'dyn'), 200);
    DCW.stepFrames(12); DCW.save.run.selected = 'smoke'; T.warp(300, 160); const lem = DCW.stage.spawn('lemur', 360, 160); lem.init = true; lem.perched = false;
    T.tap('KeyC', 1); T.until(() => S.clouds.length > 0, 120);
    const c = S.clouds[0]; if (c) { lem.x = c.x - lem.w / 2; lem.y = c.y - lem.h / 2; } DCW.stepFrames(2);
    return { jug0, jug1: T.count('jug'), thrown, fire, sel, dynFuse: !!dynP, fuseFrames, cloud: S.clouds.length, lost: lem.lostT };
  });
  check(r.thrown === 1 && r.jug1 === r.jug0 - 1, 'bomb throws the selected explosive (jug) and uses one', r);
  check(r.fire > 0, "jug o'boom leaves a burning strip", r.fire);
  check(r.sel === 'hob', 'up+bomb cycles the selected explosive', r.sel);
  check(r.dynFuse && r.fuseFrames > 80 && r.fuseFrames < 110, 'dynamite has a ~1.6 s fuse', r.fuseFrames);
  check(r.cloud > 0 && r.lost > 0, 'smoke bomb cloud makes enemies lose track', r);
  await shot('side_explosives');
  // specials
  r = await ev(() => {
    const S = T.S(); T.clearEnemies(); S.allies.length = 0; T.warp(150, 160); T.face(1);
    const a = DCW.stage.spawn('fat_clown', 200, 160), b = DCW.stage.spawn('stilt_clown', 240, 160);
    S.special = 1; T.tap('KeyV', 2);
    const panic = { stunA: a.stun > 0, stunB: b.stun > 0, queue: (S.missileQueue || []).length };
    DCW.stepFrames(60);
    T.clearEnemies(); S.special = 1; const dyn0 = T.count('dyn');
    T.key('ArrowDown', true); T.tap('KeyV', 2); T.key('ArrowDown', false);
    const boomy = { n: S.allies.filter(x => x.kind === 'boomy').length, dyn: dyn0 - T.count('dyn') };
    DCW.stepFrames(240);
    S.special = 1; const jug0 = T.count('jug'); T.warp(150, 160); T.face(1); const x0 = T.P().x;
    T.key('ArrowUp', true); T.tap('KeyV', 2); T.key('ArrowUp', false);
    const mic = { dx: Math.round(T.P().x - x0), jug: jug0 - T.count('jug'), proj: S.pproj.some(p => p.xid === 'mic') };
    const boom = T.until(() => !S.pproj.some(p => p.xid === 'mic'), 200);
    return { panic, boomy, mic, boom, fires: S.fires.length };
  });
  check(r.panic.stunA && !r.panic.stunB && r.panic.queue >= 10, 'Panic: Fear stuns (not fearImmune) + missile barrage', r.panic);
  check(r.boomy.n === 2 && r.boomy.dyn === 1, 'Boomy Boy: two clockwork Mongos, one dynamite', r.boomy);
  check(r.mic.dx >= 40 && r.mic.jug === 1 && r.mic.proj && r.boom > 0, 'Mic Drop: jug up, Carl puddle-jumps forward, jug lands', r);
  // potion, Donut missiles, Mongo bite, second chance, regrow
  r = await ev(() => {
    const S = T.S(); const run = DCW.save.run; T.god(false); S.fires.length = 0; DCW.stepFrames(10);
    run.hp = 3; const p0 = run.potions; T.tap('KeyQ', 2); const healed = run.hp > 3 && run.potions === p0 - 1;
    T.god(true); T.clearEnemies(); S.pproj.length = 0; T.warp(150, 160); T.face(1);
    const e = DCW.stage.spawn('fat_clown', 205, 160); e.stun = 99; e.hp = e.maxHp = 200;
    const fired = T.until(() => S.pproj.some(p => p.kind === 'missile'), 150);
    const bit = T.until(() => S.party.mongo.state === 'dash', 200);
    DCW.stepFrames(60); const dmg = 200 - e.hp;
    T.clearEnemies(); S.fires.length = 0; DCW.stage.K.secondChance = 1;
    const v = DCW.stage.spawn('fat_clown', 180, 160); v.hp = 1; v.stun = 9; T.warp(160, 160); T.face(1); T.tap('KeyX', 10);
    DCW.stage.K.secondChance = 0.12;
    const risen = S.allies.filter(a => a.kind === 'risen').length;
    S.allies.length = 0; T.clearEnemies();
    const lion = DCW.stage.spawn('mold_lion', 180, 160); lion.hp = 1; lion.stun = 9; T.warp(160, 160); T.face(1); T.tap('KeyX', 10);
    const pile = S.regrows.length;
    const back = T.until(() => S.enemies.some(x => x.id === 'mold_lion' && x.regrown), 600);
    S.fires.length = 0; const lion2 = S.enemies.find(x => x.id === 'mold_lion' && !x.dead) || DCW.stage.spawn('mold_lion', 200, 160); lion2.hp = 1; lion2.stun = 9; T.warp(lion2.x - 10, 160); T.face(1); T.tap('KeyX', 10);
    const pile2 = S.regrows.length;
    const lion3 = DCW.stage.spawn('mold_lion', 260, 160); lion3.hp = 1; lion3.stun = 99; S.fires.push({ x0: 240, x1: 290, y: 160, life: 3, tick: 0, t: 0 }); DCW.stepFrames(20);
    return { healed, fired, bit, dmg, risen, pile, back, pile2, burned: lion3.dead && S.regrows.length === 0 };
  });
  check(r.healed, 'potion heals', r.healed);
  check(r.fired >= 0 && r.dmg > 0, 'Donut auto-fires Magic Missile', r);
  check(r.bit >= 0, 'Mongo dashes to bite', r.bit);
  check(r.risen >= 1, 'Second Chance raises the dead as an ally', r.risen);
  check(r.pile === 1 && r.back > 0 && r.pile2 === 0, 'mold lion regrows once (not twice)', r);
  check(r.burned, 'fire kills a regrowing mold lion for good', r.burned);
  // levers, real exit
  r = await ev(() => {
    const S = T.S(); T.clearEnemies();
    const lever = T.objs('lever')[0]; let gate = false;
    if (lever) { T.warp(lever.x - 4, lever.y + lever.h); T.face(1); T.tap('KeyX', 10); gate = lever.on; }
    const d = T.objs('door')[0]; T.warp(d.x - 20, d.y + d.h); T.hold(['ArrowRight'], 30);
    T.until(() => T.calls('levelCleared').length > 0, 200);
    return { gate, cleared: T.calls('levelCleared').map(c => c[1]) };
  });
  check(r.gate, 'lever opens the gate', r.gate);
  check(r.cleared[0] && r.cleared[0].levelId === 't_side' && r.cleared[0].kills >= 1, 'exit door -> game.levelCleared(result)', r.cleared[0]);
  noErrors('side');

  /* ================= DARK ================= */
  await load('level=t_dark');
  r = await ev(() => {
    const S = T.S(); T.god(true); DCW.stepFrames(20);
    const b = S.enemies.find(e => e.ai === 'berserker') || DCW.stage.spawn('berserker', T.P().x + 300, 160); b.hp = b.maxHp = 999;
    const keepDonut = S.party.donut; S.party.donut = null; S.pproj.length = 0;
    T.warp(b.x - 130, b.y + b.h); T.until(() => b.inDark, 120);
    const inDarkFar = b ? (b.inDark ? b.speed / b.baseSpeed : 0) : -1;
    S.party.donut = keepDonut;
    T.warp(b.x - 30, b.y + b.h); DCW.stepFrames(3);
    const nearLit = b.inDark;
    const elf = S.enemies.find(e => e.ai === 'caster') || DCW.stage.spawn('city_elf', T.P().x + 200, 160); elf.hp = elf.maxHp = 999; T.warp(elf.x - 80, elf.y + elf.h); T.face(1);
    const orb = T.until(() => S.orbs.length > 0, 600);
    // xistera (act 2): hob launches straight
    DCW.save.run.selected = 'hob'; T.tap('KeyC', 1); const h = S.pproj.find(p => p.xid === 'hob');
    return { dark: S.dark, inDarkFar, nearLit, orb, straight: h && h.straight, lights: S.lights.length };
  });
  check(r.dark && r.lights > 0, 'dark level with torch light', r);
  check(r.inDarkFar >= 2, 'berserker in the dark is multiplied (darkMul)', r.inDarkFar);
  check(r.nearLit === false, 'berserker inside the torch radius is not boosted', r.nearLit);
  check(r.orb >= 0, 'city elf casts a darkness orb', r.orb);
  check(r.straight === true, 'xistera: hob-lobber launches straight', r.straight);
  await ev(() => DCW.stepFrames(10));
  await shot('dark_orb');
  r = await ev(() => {
    const S = T.S(); T.clearEnemies();
    const sw = DCW.stage.spawn('shadow_leak', T.P().x + 30, 150); sw.stun = 99;
    const hp0 = sw.hp; DCW.save.run.selected = 'dyn';
    S.pproj.length = 0;
    // magicOnly: explosion does nothing, punch works
    const st = DCW.game.playerStats();
    const x = sw.x + sw.w / 2, y = sw.y + sw.h / 2;
    S.pproj.push({ kind: 'x', xid: 'dyn', x: x - 3, y: y - 3, w: 6, h: 6, vx: 0, vy: 0, grav: 0, fuse: 0, spin: 0, t: 0 });
    DCW.stepFrames(3);
    const afterBomb = sw.hp;
    T.warp(sw.x - 10, T.P().y + T.P().h); T.face(1); sw.y = T.P().y; T.tap('KeyX', 10);
    return { hp0, afterBomb, afterPunch: sw.hp, dead: sw.dead };
  });
  check(r.afterBomb === r.hp0, 'magicOnly: explosives do nothing to ghosts', r);
  check(r.dead || r.afterPunch < r.hp0, 'magicOnly: the gauntlet punch works', r);
  noErrors('dark');

  /* ================= CHASE -> BOSS (Heather + custard) ================= */
  await load('level=t_chase');
  r = await ev(() => {
    const S = T.S(); T.god(false);
    const c0 = S.cam.x; DCW.stepFrames(120); const c1 = S.cam.x;
    const hp0 = DCW.save.run.hp; T.until(() => DCW.save.run.hp < hp0, 400);
    return { scroll: c1 - c0, caught: hp0 - DCW.save.run.hp, hidden: S.boss.hidden };
  });
  check(r.scroll > 100, 'chase camera autoscrolls', r.scroll);
  check(r.caught >= 4 && r.hidden, 'pursuer catches Carl for catchDmg', r);
  await shot('chase_pursuer');
  r = await ev(() => {
    const S = T.S(); T.god(true);
    T.key('ArrowRight', true); const n = T.until(() => S.locked, 1500); T.key('ArrowRight', false);
    DCW.stepFrames(90);
    const B = S.boss;
    return { n, locked: S.locked, arrived: S.chase.arrived, active: B.active, hidden: B.hidden, id: B.id };
  });
  check(r.arrived && r.locked && !r.hidden && r.id === 'heather', 'chase reaches the arena: same boss fight starts', r);
  r = await ev(() => {
    const S = T.S(), B = S.boss;
    B.move = { name: 'worms', a: '4', t: 0, sub: 0, st: 0, n: 0 }; DCW.stepFrames(80);
    const worms = S.enemies.filter(e => e.id === 'worm' && !e.dead).length;
    B.phase = B.phases.length - 1; B.pendingPhase = -1; B.hp = Math.round(B.maxHp * 0.26); B.flash = 0;   // the ticket drops on the last bar
    const P = T.P(); T.warp(B.x - 8, B.groundY); T.face(1); B.stun = 2; T.tap('KeyX', 14);
    const t = T.objs('ticket')[0];
    let cured = false;
    if (t) { T.warp(t.x + 8, t.y + t.h + 1); DCW.stepFrames(3); cured = !!B.cured; }
    const wormsAfter = S.enemies.filter(e => e.id === 'worm' && !e.dead).length;
    return { worms, ticket: !!t, cured, wormsAfter, said: DCW.testLog.say.join(' ').slice(-80) };
  });
  check(r.worms >= 2, 'worms primitive spawns crawling worms (Donut and Mongo may already have eaten a couple)', r.worms);
  check(r.ticket && r.cured && r.wormsAfter === 0, 'Heather: custard ticket at 25% cures her worms', r);
  await shot('chase_boss_custard');
  r = await ev(() => {
    const S = T.S(), B = S.boss; B.hp = 1; T.warp(B.x - 8, B.groundY); T.face(1); B.stun = 2; T.tap('KeyX', 10);
    T.until(() => T.calls('levelCleared').length > 0, 600);
    return T.calls('levelCleared').map(c => c[1]);
  });
  check(r[0] && r[0].levelId === 't_chase' && r[0].boss === 'heather', 'boss kill clears the chase level', r[0]);
  noErrors('chase');

  /* ================= CLIMB ================= */
  await load('level=t_climb');
  r = await ev(() => {
    const S = T.S(); T.god(true); const y0 = S.cam.y;
    T.warp(80, 9 * 16); DCW.stepFrames(60); const y1 = S.cam.y;
    T.god(false); const hp0 = DCW.save.run.hp;
    T.warp(300, 9 * 16); const P = T.P(); P.y = S.cam.y + 200; DCW.stepFrames(3);
    const pit = P.state === 'pit' || DCW.save.run.hp < hp0;
    DCW.stepFrames(60); T.god(true);
    const d = T.objs('door')[0]; T.warp(d.x - 16, d.y + d.h); T.hold(['ArrowRight'], 30);
    T.until(() => T.calls('levelCleared').length > 0, 200);
    return { y0, y1, pit, cleared: T.calls('levelCleared').length };
  });
  check(r.y1 < r.y0 - 40, 'climb camera follows upward', r);
  check(r.pit, 'falling below the screen in a climb is a pit', r.pit);
  check(r.cleared === 1, 'climb clears at the top door', r.cleared);
  await load('level=t_climb');
  await ev(() => { T.warp(120, 11 * 16); DCW.stepFrames(40); });
  await shot('climb');
  noErrors('climb');

  /* ================= DROP ================= */
  await load('level=t_drop');
  r = await ev(() => {
    const S = T.S(); T.god(true); DCW.stepFrames(30);
    const L = S.L, idx = 9 * L.w + 3; const before = L.t[idx];
    T.warp(3 * 16 + 8, 9 * 16); DCW.stepFrames(50);
    const after = L.t[idx];
    const d = T.objs('door')[0]; T.warp(d.x - 16, d.y + d.h); T.hold(['ArrowRight'], 30);
    T.until(() => T.calls('levelCleared').length > 0, 200);
    return { before, after, camY: S.cam.y, cleared: T.calls('levelCleared').length };
  });
  check(r.before === 3 && r.after === 0, 'drop: one-way floors collapse under Carl', r);
  check(r.cleared === 1, 'drop clears at the bottom door', r.cleared);
  await load('level=t_drop');
  await ev(() => { T.god(true); T.warp(100, 8 * 16); DCW.stepFrames(30); });
  await shot('drop');
  noErrors('drop');

  /* ================= SURVIVAL ================= */
  await load('level=t_survival');
  r = await ev(() => {
    const S = T.S(); T.god(true);
    const bar = T.objs('barricade')[0];
    DCW.stepFrames(240);
    const u = S.enemies.filter(e => e.ai === 'urchin');
    T.until(() => bar.hp < bar.maxHp, 600);
    const target = bar.hp < bar.maxHp;
    const hud = DCW.testLog.hud.timer;
    bar.hp = 1; T.until(() => bar.broken, 600);
    const hostile = S.enemies.filter(e => !e.dead && e.ai === 'urchin').every(e => e.hostile);
    T.until(() => T.calls('levelCleared').length > 0, 900);
    return { barHp: bar.maxHp, urchins: u.length, target, hud, broken: bar.broken, hostile, cockroach: /COCKROACH/.test(DCW.testLog.say.join(' ')), cleared: T.calls('levelCleared').map(c => c[1].levelId) };
  });
  check(r.barHp === 20 && r.urchins > 0 && r.target, 'survival: waves spawn, urchins go for the barricade', r);
  check(r.hud && r.hud.label === 'DAWN' && r.hud.t > 0, 'HUD timer counts to dawn', r.hud);
  check(r.broken && r.hostile && r.cockroach, 'barricade breaks: cockroach line, urchins turn on Carl', r);
  check(r.cleared[0] === 't_survival', 'surviving to dawn clears the level', r.cleared);
  await load('level=t_survival');
  await ev(() => { T.god(true); DCW.stepFrames(300); });
  await shot('survival');
  noErrors('survival');

  /* ================= PLANT ================= */
  await load('level=t_plant');
  r = await ev(() => {
    const S = T.S(); T.god(true);
    const det = T.objs('detonator')[0];
    T.warp(det.x + 12, det.y + det.h); T.tap('KeyC', 3);
    const early = S.plant.detonated;
    // krasue: head vanishes and comes back; body kill ends it
    const head = S.enemies.find(e => e.ai === 'krasue' && e.body);
    head.body.hp = 999; head.hp = 1; const hx = head.x; head.stun = 0;
    T.warp(head.x - 4, 160); head.y = T.P().y + 2; head.x = T.P().x + 8; T.face(1); T.tap('KeyX', 6);
    const gone = head.state === 'gone';
    T.until(() => head.state !== 'gone', 700);
    const back = head.state !== 'gone' && !head.dead;
    // decoy
    const y = T.objs('decoySpot')[0]; T.warp(y.x + 8, y.y + y.h); T.tap('ArrowUp', 3);
    const decoys = S.allies.filter(a => a.kind === 'decoy').length;
    // plant all charges
    T.objs('charge').forEach(c => { T.warp(c.x + 8, c.y + c.h); T.hold(['ArrowUp'], 70); });
    const planted = S.plant.planted;
    const body = head.body; body.hp = 1; T.warp(body.x - 8, body.y + body.h); T.face(1); T.tap('KeyX', 10);
    const headDead = head.dead;
    T.warp(det.x + 12, det.y + det.h); T.tap('KeyC', 3);
    const det2 = S.plant.detonated;
    T.until(() => T.calls('levelCleared').length > 0, 400);
    return { early, gone, back, decoys, planted, need: S.plant.need, headDead, det2, hud: DCW.testLog.hud.meters, cleared: T.calls('levelCleared').length };
  });
  check(r.early === false, 'cannot detonate before all charges are planted', r.early);
  check(r.gone && r.back, 'Krasue head vanishes at 0 hp and regrows at its body', r);
  check(r.decoys === 1, 'UP at Y drops a clockwork Mongo decoy', r.decoys);
  check(r.planted === 3 && r.need === 3, 'hold UP 1 s plants charges', r);
  check(r.headDead, 'destroying the body kills the head for good', r.headDead);
  check(r.det2 && r.cleared === 1, 'bomb on T detonates and clears the level', r);
  await load('level=t_plant');
  await ev(() => { T.god(true); const c = T.objs('charge')[1]; T.warp(c.x + 8, c.y + c.h); T.key('ArrowUp', true); DCW.stepFrames(30); });
  await shot('plant_planting');
  await ev(() => { T.release(); });
  noErrors('plant');

  /* ================= ESCAPE ================= */
  await load('level=t_escape');
  r = await ev(() => {
    const S = T.S(); T.god(true);
    const t0 = S.esc.t;
    T.until(() => S.esc.fired >= 1, 400); const b1 = { noMagic: S.noMagic, lock: S.specialLockT > 0, special: S.special };
    T.until(() => S.esc.fired >= 2, 400); DCW.stepFrames(60); const rain = S.haz.length + S.eproj.length;
    T.until(() => S.esc.fired >= 3, 400); const b3 = { mul: S.maxHpMul, max: DCW.stage.state.maxHpMul, def: S.defZero };
    const items0 = ['jug', 'hob', 'dyn', 'smoke'].reduce((a, id) => a + T.count(id), 0);
    T.until(() => S.esc.fired >= 4, 400); DCW.stepFrames(320);
    const items1 = ['jug', 'hob', 'dyn', 'smoke'].reduce((a, id) => a + T.count(id), 0);
    T.key('ArrowUp', true); T.tap('KeyC', 2); T.key('ArrowUp', false);
    const items2 = ['jug', 'hob', 'dyn', 'smoke'].reduce((a, id) => a + T.count(id), 0);
    return { t0, b1, rain, b3, items0, items1, items2, hud: DCW.testLog.hud.timer };
  });
  check(r.b1.noMagic && r.b1.lock && r.b1.special === 0, 'burst 1: magic stripped, meter locked', r.b1);
  check(r.rain > 0, 'burst 2: projectiles rain from the top', r.rain);
  check(r.b3.mul === 0.75 && r.b3.def, 'burst 3: armor gone, max hp -25%', r.b3);
  check(r.items1 < r.items0, 'burst 4: carried explosives go off', r);
  check(r.items2 === 0, 'burst 4: up+bomb dumps the lot', r.items2);
  check(r.hud && r.hud.label === 'ESCAPE', 'HUD escape timer', r.hud);
  await shot('escape_bursts');
  r = await ev(() => {
    T.god(false); const S = T.S(); S.esc.t = 0.5;
    T.until(() => T.calls('playerDied').length > 0, 300);
    return T.calls('playerDied').map(c => c[1]);
  });
  check(r[0] && /GLASS/.test(r[0].cause), 'escape timer at 0 = death', r[0]);
  await load('level=t_escape');
  r = await ev(() => { T.god(true); const d = T.objs('door')[0]; T.warp(d.x - 16, d.y + d.h); T.hold(['ArrowRight'], 30); T.until(() => T.calls('levelCleared').length > 0, 200); return T.calls('levelCleared').length; });
  check(r === 1, 'escape clears at the stairwell door', r);
  noErrors('escape');

  /* ================= BOSS (Vincente: meat hooks, darkness) ================= */
  await load('level=t_boss');
  r = await ev(() => {
    const S = T.S(); T.god(true);
    T.warp(S.arena.x0 + 80, 160); T.until(() => S.boss.active, 200);
    const B = S.boss; const M = S.party.mongo;
    M.x = B.x - 40; M.y = B.groundY - M.h;
    B.move = { name: 'meat_hooks', t: 0, sub: 0, st: 0, n: 0 }; T.until(() => M.heldT > 0, 200);
    const held = M.heldT;
    B.move = { name: 'darkness', a: '6', t: 0, sub: 0, st: 0, n: 0 }; T.until(() => S.darkT > 0, 120);
    return { held, dark: S.darkT, orbs: S.orbs.length, hud: [DCW.testLog.hud.bossName, DCW.testLog.hud.bossHp] };
  });
  check(r.held > 0, 'meat_hooks yanks Mongo away', r.held);
  check(r.dark > 0 && r.orbs > 0, 'darkness primitive darkens the arena', r);
  check(r.hud[0] === 'VINCENTE' && r.hud[1] > 0, 'boss bar in HUD', r.hud);
  await ev(() => DCW.stepFrames(20));
  await shot('boss_vincente_dark');
  r = await ev(() => { T.calls('x'); const B = T.S().boss; B.hp = 1; T.warp(B.x - 8, B.groundY); T.face(1); B.stun = 2; B.move = { name: 'idle', a: '3', t: 0, sub: 0, st: 0, n: 0 }; T.tap('KeyX', 10); T.until(() => T.calls('levelCleared').length > 0, 600); return T.calls('levelCleared').map(c => c[1]); });
  check(r[0] && r[0].boss === 'vincente', 'boss kill clears', r[0]);
  noErrors('boss');

  /* ================= FACADE (the Dispenser) ================= */
  await load('level=t_facade');
  r = await ev(() => {
    const S = T.S(); T.god(true);
    T.warp(S.arena.x0 + 80, 160); T.until(() => S.boss.active, 200);
    const B = S.boss;
    const hp0 = B.hp;
    // closed parts take nothing
    const wing = B.parts.find(p => p.id === 'wing_l'); const wr = { x: B.x + wing.dx, y: B.y + wing.dy };
    B.move = { name: 'idle', a: '9', t: 0, sub: 0, st: 0, n: 0 };
    T.warp(wr.x - 6, B.groundY); T.face(1); T.tap('KeyX', 12);
    const closedHp = B.hp;
    wing.open = 1; T.tap('KeyX', 12);
    const openHp = B.hp;
    wing.open = 0;
    // pattern runs reveal/spit: wait for any part to open
    B.move = null; const opened = T.until(() => B.parts.some(p => p.open > 0), 600);
    // Boomy Boy triple damage
    B.hp = B.maxHp = 999; const hpB = B.hp; S.special = 1; T.warp(B.x - 30, B.groundY); T.face(1); T.key('ArrowDown', true); T.tap('KeyV', 2); T.key('ArrowDown', false);
    T.until(() => !S.allies.some(a => a.kind === 'boomy'), 200);
    const boomyDmg = hpB - B.hp;
    const pip = B.nextPart ? B.nextPart.id : null;
    return { hp0, closedHp, openHp, opened, boomyDmg, dyn: DCW.game.playerStats().dynDmg, pip };
  });
  check(r.closedHp === r.hp0, 'facade: camouflaged parts take no damage', r);
  check(r.openHp < r.closedHp, 'facade: a revealed part takes damage', r);
  check(r.opened >= 0, 'facade: reveal/spit open parts over time', r.opened);
  check(r.boomyDmg >= r.dyn * 3 - 1, 'Boomy Boy deals triple damage to the Dispenser', r);
  await ev(() => DCW.stepFrames(30));
  await shot('facade_dispenser');
  r = await ev(() => {
    const S = T.S(), B = S.boss; T.god(false);
    B.move = { name: 'sweep', t: 0, sub: 0, st: 0, n: 0 };
    const P = T.P(); T.warp(S.arena.x0 + 200, B.groundY); const hp0 = DCW.save.run.hp;
    T.key('ArrowDown', true); DCW.stepFrames(200); T.key('ArrowDown', false);
    const ducked = DCW.save.run.hp === hp0;
    return { ducked };
  });
  check(r.ducked, 'facade sweep: ducking under it is safe', r);
  r = await ev(() => { T.god(true); const B = T.S().boss; B.phase = B.phases.length - 1; B.pendingPhase = -1; B.hp = 1; B.move = { name: 'idle', a: '5', t: 0, sub: 0, st: 0, n: 0 }; const p = B.parts[2]; p.open = 1; const rx = B.x + p.dx; T.warp(rx - 6, B.groundY); T.face(1); T.P().y = B.y + p.dy - 6; T.P().vy = 0; T.tap('KeyX', 6); T.until(() => T.calls('levelCleared').length > 0, 600); return { cleared: T.calls('levelCleared').map(c => c[1]), hp: B.hp }; });
  check(r.cleared[0] && r.cleared[0].boss === 'dispenser', 'facade boss kill clears', r);
  noErrors('facade');

  /* ================= SWAP (Mongo) ================= */
  await load('level=t_swap');
  r = await ev(() => {
    const S = T.S(); T.god(true); DCW.stepFrames(10);
    const P = T.P(); const items0 = T.count('jug');
    T.tap('KeyC', 3); T.tap('KeyQ', 3); S.special = 1; T.tap('KeyV', 3);
    const e = DCW.stage.spawn('lemur', P.x + 24, 160); e.init = true; e.perched = false; e.stun = 99; const hp0 = e.hp;
    T.face(1); T.tap('KeyX', 14);
    const d = T.objs('door')[0]; T.warp(d.x - 16, d.y + d.h); T.hold(['ArrowRight'], 30);
    T.until(() => T.calls('levelCleared').length > 0, 200);
    return { mongo: P.mongo, w: P.w, h: P.h, party: Object.keys(S.party).length, items: T.count('jug') === items0, bite: hp0 - e.hp, hud: DCW.testLog.hud.companion, cleared: T.calls('levelCleared').length };
  });
  check(r.mongo && r.w <= 16 && r.h <= 18 && r.party === 0, 'swap: the player is Mongo, smaller hitbox, alone', r);
  check(r.items, 'swap: no bombs/special/potion', r.items);
  check(r.bite > 0, 'swap: attack bites', r.bite);
  check(r.cleared === 1, 'swap level clears at the door', r.cleared);
  await load('level=t_swap');
  await ev(() => { T.god(true); T.hold(['ArrowRight', 'KeyZ'], 20); });
  await shot('swap_mongo');
  noErrors('swap');

  /* ================= SOLO + RESCUE ================= */
  await load('level=t_solo');
  r = await ev(() => {
    const S = T.S(); T.god(true);
    const p0 = Object.keys(S.party).length;
    const cage = T.objs('cage')[0]; T.clearEnemies();
    for (let i = 0; i < 3; i++) { T.warp(cage.x - 6, cage.y + cage.h); T.face(1); T.tap('KeyX', 20); }
    return { p0, broken: cage.broken, mongo: !!S.party.mongo };
  });
  check(r.p0 === 0, 'solo level: no companions', r.p0);
  check(r.broken && r.mongo, 'rescue cage R frees Mongo into the party', r);
  await ev(() => DCW.stepFrames(30));
  await shot('solo_rescue');
  noErrors('solo');

  /* ================= NEST: charm, launcher, floater ================= */
  await load('level=t_nest');
  r = await ev(() => {
    const S = T.S(); T.god(true); T.clearEnemies(); S.party = {};
    const P = T.P(); T.warp(120, 160);
    const inc = DCW.stage.spawn('incubus', 190, 160);
    T.until(() => P.charmT > 0, 600);
    const charmed = P.charmT > 0;
    let moved = 0;
    if (charmed) { const x0 = P.x; T.hold(['ArrowRight'], 20); moved = P.x - x0; }
    T.god(true); T.clearEnemies();
    const g = DCW.stage.spawn('giraffe', 300, 160); T.warp(200, 160);
    T.until(() => g.kids > 0, 400);
    const bb = DCW.stage.spawn('brain_boiler', 240, 130); bb.baseY = 130;
    const ring = T.until(() => S.haz.some(h => h.kind === 'ring'), 400);
    return { charmed, moved, kids: g.kids, ring };
  });
  check(r.charmed && r.moved < 0, 'incubus charm flips left/right', r);
  check(r.kids > 0, 'artillery giraffe flings lemurs', r.kids);
  check(r.ring >= 0, 'brain boiler emits a psionic ring', r.ring);
  await ev(() => DCW.stepFrames(30));
  await shot('nest');
  noErrors('nest');

  /* ================= debug clear, pause ================= */
  await load('level=t_dark');
  r = await ev(() => { T.tap('KeyP', 2); const pause = DCW.testLog.pause.slice(-1)[0]; window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Digit9' })); T.until(() => T.calls('levelCleared').length > 0, 120); return { pause, cleared: T.calls('levelCleared').length }; });
  check(r.pause && r.pause.canFlee === true, 'pause opens with canFlee in levels', r.pause);
  check(r.cleared === 1, 'debug key 9 clears the level', r.cleared);
  await load('area=village');
  r = await ev(() => { T.tap('KeyP', 2); T.tap('Tab', 2); return { pause: DCW.testLog.pause.slice(-1)[0], map: DCW.testLog.map.length }; });
  check(r.pause && r.pause.canFlee === false && r.map === 1, 'streets: pause without flee, select opens the map', r);
  noErrors('debug/pause');

  /* ================= standalone (no game.js) and no art ================= */
  for (const q of ['nogame&level=t_side', 'nogame&area=village', 'nogame&level=t_plant', 'noart&level=t_facade', 'noart&area=village&night', 'noart&level=t_chase']) {
    await load(q);
    r = await ev(() => {
      T.key('ArrowRight', true); DCW.stepFrames(200); T.key('ArrowRight', false);
      T.tap('KeyX', 5); T.tap('KeyC', 60); const S = T.S(); S.special = 1; T.tap('KeyV', 30);
      T.warp(T.S().L.pxW - 30, 160); T.hold(['ArrowRight'], 30); T.tap('ArrowUp', 5);
      return { mode: T.S().mode, msg: T.S().fallbackMsg || null };
    });
    check(true, 'loaded ' + q, r);
    if (/area=village/.test(q) && /nogame/.test(q)) check(r.msg === 'EDGE RIGHT', 'standalone street edge falls back without game.js', r.msg);
    noErrors(q);
  }
  await load('noart&level=t_facade');
  await ev(() => { T.god(true); const S = T.S(); T.warp(S.arena.x0 + 80, 160); T.until(() => S.boss.active, 200); S.boss.parts[0].open = 1; DCW.stepFrames(20); });
  await shot('noart_facade');

  console.log('\n' + passes + ' passed, ' + failures + ' failed');
  await browser.close();
  process.exit(failures ? 1 : 0);
})();

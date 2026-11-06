// Usage: node crawler/tools/audio_report.js [name ...]
// Headless check of js/audio.js: renders every music track and SFX through an
// OfflineAudioContext (same graph code as live), prints duration / peak / RMS / silence stats,
// pattern warnings, and runs a live-API smoke test (pre-unlock no-ops, switching, voice cap).
const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const only = process.argv.slice(2);
  const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const page = await browser.newPage();
  const errors = [];
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.type() + ': ' + m.text()); });
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  await page.goto('file://' + path.resolve(__dirname, 'audio_test.html'));
  await page.waitForTimeout(200);

  const CONTRACT_SFX = 'jump land punch kick hit crit enemy_die hurt coin pickup bomb_throw explosion missile bite shield menu_move menu_select menu_back lootbox_shake lootbox_open unlock level_up door boss_roar boss_die achievement stairs death heal block buy error text_blip pause checkpoint crate_break spawn laser warn stomp splash fanfare views'.split(' ');
  const CONTRACT_MUSIC = 'title intro floor1 floor2 floor3 floor4 floor5 floor6 floor7 floor8 floor9 ow3 ow4 ow5 ow6 ow7 ow8 ow9 boss boss_final safe results gameover ending lootbox'.split(' ');
  const names = await page.evaluate(() => ({ tracks: DCW.audio.tracks, sfx: DCW.audio.sfxNames }));
  const missS = CONTRACT_SFX.filter(n => !names.sfx.includes(n)), missM = CONTRACT_MUSIC.filter(n => !names.tracks.includes(n));
  console.log('contract sfx missing:', missS.length ? missS.join(',') : 'none', '| music missing:', missM.length ? missM.join(',') : 'none');

  // ---- pre-unlock API calls must be silent no-ops
  const pre = await page.evaluate(() => {
    const A = DCW.audio; let threw = null;
    try { A.sfx('jump'); A.music('title'); A.setVolumes(); A.suspend(); A.resume(); A.sfx('nope'); } catch (e) { threw = e.message; }
    return { threw, current: A.current, state: A.debugState() };
  });
  console.log('pre-unlock:', JSON.stringify(pre));

  const fmt = (v, w) => String(v).padStart(w);
  let bad = 0;
  console.log('\n(peak/rms = through compressor+limiter at bus gain 1; raw = same mix without dynamics; cpu = offline render time / audio time)');
  console.log('MUSIC  name          intro  loop   rendered  peak   rms     rawPeak rawRms  seamRms longestSil warns cpu');
  for (const n of names.tracks) {
    if (only.length && !only.includes(n)) continue;
    const r = await page.evaluate(n => DCW.audio.renderOffline('music', n), n);
    const q = await page.evaluate(n => DCW.audio.renderOffline('music', n, { raw: true }), n);
    const flag = (r.peak < 0.05 || r.peak >= 1 || r.clipped || r.rms < 0.01 || r.longestSilence > 1.5 || (r.warns && r.warns.length)) ? '  <-- CHECK' : '';
    if (flag) bad++;
    console.log('       ' + n.padEnd(13) + fmt(r.introSec, 6) + fmt(r.loopSec, 7) + fmt(r.sec, 9) + 's' + fmt(r.peak, 7) + fmt(r.rms, 8) + fmt(q.peak, 8) + fmt(q.rms, 8) + fmt(r.seamRms == null ? '-' : r.seamRms, 9) + fmt(r.longestSilence, 8) + 's' + fmt((r.warns || []).length, 4) + fmt((r.renderMs / 1000 / r.sec * 100).toFixed(1) + '%', 7) + flag);
    (r.warns || []).forEach(w => console.log('         warn: ' + w));
  }
  console.log('\nSFX    name            dur    peak   rms     rawPeak');
  for (const n of names.sfx) {
    if (only.length && !only.includes(n)) continue;
    const r = await page.evaluate(n => DCW.audio.renderOffline('sfx', n), n);
    const q = await page.evaluate(n => DCW.audio.renderOffline('sfx', n, { raw: true }), n);
    const quiet = n === 'text_blip' ? 0.01 : 0.03;
    const flag = (r.peak < quiet || r.peak >= 1 || r.clipped || r.rms < 0.0003) ? '  <-- CHECK' : '';
    if (flag) bad++;
    console.log('       ' + n.padEnd(15) + fmt(r.dur, 5) + 's' + fmt(r.peak, 7) + fmt(r.rms, 8) + fmt(q.peak, 8) + flag);
  }

  // ---- live smoke test
  const live = await page.evaluate(async () => {
    const A = DCW.audio, out = {}, wait = ms => new Promise(r => setTimeout(r, ms));
    A.unlock();
    await wait(300);
    out.afterUnlock = A.debugState(); // title should have auto-started (requested before unlock)
    A.music('title'); out.sameTrack = A.debugState();
    A.music('boss'); await wait(100); out.switched = A.debugState();
    for (let i = 0; i < 40; i++) A.sfx(A.sfxNames[i % A.sfxNames.length]);
    out.voicesAfterSpam = A.debugState().voices;
    await wait(1500); out.voicesDrained = A.debugState().voices;
    for (let i = 0; i < 10; i++) A.sfx('coin'); out.coinBurstVoices = A.debugState().voices; // rate limit -> 1
    DCW.save.settings.music = 0.2; A.setVolumes();
    A.music('results'); await wait(4500); out.oneShot = A.debugState();
    A.music('results'); out.oneShotReplay = A.debugState();
    A.suspend(); await wait(100); out.suspended = A.debugState().state;
    A.resume(); await wait(100); out.resumed = A.debugState().state;
    A.music(null); await wait(500); out.stopped = A.debugState();
    return out;
  });
  console.log('\nlive:', JSON.stringify(live, null, 1));
  console.log('\nconsole errors/warnings:', errors.length ? '\n' + errors.join('\n') : 'none');
  console.log(bad ? `\n${bad} item(s) flagged` : '\nall items OK');
  await browser.close();
})();

// Usage: node crawler2/tools/audio_report.js [name ...] [--no-live] [--raw-only]
// Headless check of crawler2/js/audio.js: checks every SFX and music name in DESIGN.md section 13
// (plus book 1's SFX set) exists, renders every track and SFX through an OfflineAudioContext (same
// graph code as live), prints duration / peak / RMS / loudness / silence stats and pattern warnings,
// and runs a live-API smoke test (pre-unlock no-ops, switching, same-track no-restart, voice cap).
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

(async () => {
  const args = process.argv.slice(2), only = args.filter(a => !a.startsWith('--')), noLive = args.includes('--no-live');
  const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const page = await browser.newPage();
  const errors = [];
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.type() + ': ' + m.text()); });
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  await page.goto('file://' + path.resolve(__dirname, 'audio_test.html'));
  await page.waitForTimeout(200);

  // contract names: book 1's SFX set + DESIGN.md section 13 (parsed from the doc so it stays in sync)
  const BOOK1_SFX = 'jump land punch kick hit crit enemy_die hurt coin pickup bomb_throw explosion missile bite shield menu_move menu_select menu_back lootbox_shake lootbox_open unlock level_up door boss_roar boss_die achievement stairs death heal block buy error text_blip pause checkpoint crate_break spawn laser warn stomp splash fanfare views engine boost horn countdown go skid crash'.split(' ');
  let NEW_SFX = [], MUSIC = [];
  try {
    const doc = fs.readFileSync(path.resolve(__dirname, '../DESIGN.md'), 'utf8');
    const sec = doc.split(/^## 13\./m)[1].split(/^## 14\./m)[0];
    const sfxM = /book 1's set plus `([^`]+)`/.exec(sec), musM = /Music \(looping unless noted\): `([^`]+)`/.exec(sec);
    NEW_SFX = sfxM[1].split(/\s+/).filter(Boolean);
    MUSIC = musM[1].split(/\s+/).filter(Boolean).map(s => s.replace(/\(.*\)$/, ''));
  } catch (e) { console.log('could not parse DESIGN.md section 13: ' + e.message); }
  const JINGLES = ['results', 'gameover', 'lootbox'];
  const names = await page.evaluate(() => ({ tracks: DCW.audio.tracks, sfx: DCW.audio.sfxNames, samples: DCW.audio.sampleInfo() }));
  const missS = BOOK1_SFX.concat(NEW_SFX).filter(n => !names.sfx.includes(n)), missM = MUSIC.filter(n => !names.tracks.includes(n));
  const extraM = names.tracks.filter(n => !MUSIC.includes(n));
  console.log('contract: ' + (BOOK1_SFX.length + NEW_SFX.length) + ' sfx, ' + MUSIC.length + ' tracks');
  console.log('contract sfx missing:', missS.length ? missS.join(',') : 'none', '| music missing:', missM.length ? missM.join(',') : 'none', '| extra tracks:', extraM.length ? extraM.join(',') : 'none');
  console.log('samples:', Object.keys(names.samples).map(n => n + '@' + names.samples[n].rate + 'Hz/' + names.samples[n].sec + 's').join(' '));

  // ---- pre-unlock API calls must be silent no-ops
  const pre = await page.evaluate(() => {
    const A = DCW.audio; let threw = null;
    try { A.sfx('jump'); A.music('title'); A.setVolumes(); A.suspend(); A.resume(); A.sfx('nope'); } catch (e) { threw = e.message; }
    return { threw, current: A.current, state: A.debugState() };
  });
  console.log('pre-unlock:', JSON.stringify(pre));

  const fmt = (v, w) => String(v).padStart(w);
  let bad = 0;
  const loudList = [];
  console.log('\n(peak/rms/loud = through the master chain at bus gain 1; loud = mean RMS of the louder half of 400 ms windows; raw = no dynamics; cpu = render time / audio time)');
  console.log('MUSIC  name           intro   loop  rendered  peak   rms     loud    rawPeak rawLoud seamRms longestSil warns cpu');
  for (const n of names.tracks) {
    if (only.length && !only.includes(n)) continue;
    const r = await page.evaluate(n => DCW.audio.renderOffline('music', n), n);
    const q = await page.evaluate(n => DCW.audio.renderOffline('music', n, { raw: true }), n);
    const quiet = ['dark', 'sad', 'village_night', 'cutscene', 'ending', 'intro'].includes(n);
    const flag = (r.peak < 0.05 || r.peak >= 1 || r.clipped || r.loud < (quiet ? 0.04 : 0.08) || r.longestSilence > (r.loop ? 2.5 : 1.2) || (r.warns && r.warns.length) || (r.loop && JINGLES.includes(n))) ? '  <-- CHECK' : '';
    if (flag) bad++;
    loudList.push([n, r.loud, quiet]);
    console.log('       ' + n.padEnd(14) + fmt(r.introSec, 6) + fmt(r.loopSec, 7) + fmt(r.sec, 9) + 's' + fmt(r.peak, 7) + fmt(r.rms, 8) + fmt(r.loud, 8) + fmt(q.peak, 8) + fmt(q.loud, 8) + fmt(r.seamRms == null ? '-' : r.seamRms, 8) + fmt(r.longestSilence, 8) + 's' + fmt((r.warns || []).length, 4) + fmt((r.renderMs / 1000 / r.sec * 100).toFixed(1) + '%', 7) + (r.loop ? '' : ' once') + flag);
    (r.warns || []).forEach(w => console.log('         warn: ' + w));
  }
  if (loudList.length > 2) {
    const normal = loudList.filter(x => !x[2]).map(x => x[1]);
    if (normal.length) console.log('\nloudness spread (non-quiet tracks): min ' + Math.min(...normal).toFixed(3) + ' max ' + Math.max(...normal).toFixed(3) + ' (' + (20 * Math.log10(Math.max(...normal) / Math.min(...normal))).toFixed(1) + ' dB)');
  }
  console.log('\nSFX    name             dur    peak   rms     rawPeak');
  for (const n of names.sfx) {
    if (only.length && !only.includes(n)) continue;
    const r = await page.evaluate(n => DCW.audio.renderOffline('sfx', n), n);
    const q = await page.evaluate(n => DCW.audio.renderOffline('sfx', n, { raw: true }), n);
    const quiet = n === 'text_blip' ? 0.01 : 0.03;
    const flag = (r.peak < quiet || r.peak >= 1 || r.clipped || r.rms < 0.0003) ? '  <-- CHECK' : '';
    if (flag) bad++;
    console.log('       ' + n.padEnd(16) + fmt(r.dur, 5) + 's' + fmt(r.peak, 7) + fmt(r.rms, 8) + fmt(q.peak, 8) + (NEW_SFX.includes(n) ? '  (book 2)' : '') + flag);
  }

  // ---- live smoke test
  if (!noLive) {
    const live = await page.evaluate(async () => {
      const A = DCW.audio, out = {}, wait = ms => new Promise(r => setTimeout(r, ms));
      A.unlock();
      await wait(300);
      out.afterUnlock = A.debugState(); // title should have auto-started (requested before unlock)
      A.music('title'); out.sameTrack = A.debugState();
      A.music('escape'); await wait(150); out.switched = A.debugState();
      A.music('safe'); await wait(100); out.aliasSafe = A.debugState().playing;
      for (let i = 0; i < 40; i++) A.sfx(A.sfxNames[i % A.sfxNames.length]);
      out.voicesAfterSpam = A.debugState().voices;
      await wait(3500); out.voicesDrained = A.debugState().voices;
      for (let i = 0; i < 10; i++) A.sfx('coin'); out.coinBurstVoices = A.debugState().voices; // rate limit -> 1
      DCW.save.settings.music = 0.2; A.setVolumes();
      A.music('results'); await wait(4800); out.oneShot = A.debugState();
      A.music('results'); out.oneShotReplay = A.debugState();
      A.suspend(); await wait(100); out.suspended = A.debugState().state;
      A.resume(); await wait(100); out.resumed = A.debugState().state;
      A.music(null); await wait(500); out.stopped = A.debugState();
      return out;
    });
    console.log('\nlive:', JSON.stringify(live));
  }
  console.log('\nconsole errors/warnings:', errors.length ? '\n' + errors.join('\n') : 'none');
  console.log(bad ? `\n${bad} item(s) flagged` : '\nall items OK');
  await browser.close();
})();

/* ============================================================
   DCW SHOW (book 2, scenes owner) - DANGER ZONE WITH RIPPER WONTON.
   A live talk show: studio set, host at his desk, the panel, Carl
   and Donut on the couch, an audience strip and an APPLAUSE meter.
   The script (DCW.data.show.danger_zone, DESIGN.md section 10)
   plays line by line; each segment the host asks and the player
   picks one of three answers live, the meter swings, the crowd
   reacts, Donut cuts in. Then Hekla's pitch, the outro, and the
   trailer blast (the level outro cinema, the show's blast cinema,
   or an in-scene blast), then DCW.game.levelCleared({views}).
   DCW.show = { init(), scene, state, debugClear() }
   ============================================================ */
(function () {
  'use strict';
  var DCW = window.DCW = window.DCW || {};
  var W = 320, H = 180;

  /* ---------------- plumbing ---------------- */
  function D() { return DCW.data || {}; }
  function gfn(name) { return !!(DCW.game && typeof DCW.game[name] === 'function'); }
  function gcall(name) {
    if (!gfn(name)) return undefined;
    try { return DCW.game[name].apply(DCW.game, [].slice.call(arguments, 1)); } catch (e) { console.error('[show] game.' + name, e); return undefined; }
  }
  function ufn(name) { return !!(DCW.ui && typeof DCW.ui[name] === 'function'); }
  function ucall(name) {
    if (!ufn(name)) return undefined;
    try { return DCW.ui[name].apply(DCW.ui, [].slice.call(arguments, 1)); } catch (e) { console.error('[show] ui.' + name, e); return undefined; }
  }
  function sfx(n, o) { try { if (DCW.audio && DCW.audio.sfx) DCW.audio.sfx(n, o); } catch (e) { /* optional */ } }
  function music(t) { try { if (DCW.audio && DCW.audio.music) DCW.audio.music(t); } catch (e) { /* optional */ } }
  function inp() { return DCW.input || { pressed: function () { return false; }, down: function () { return false; } }; }
  function P(b) { return inp().pressed(b); }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function rand(a, b) { return a + Math.random() * (b - a); }
  function num(v, d) { return typeof v === 'number' && isFinite(v) ? v : d; }
  function run() {
    var r = null;
    try { r = DCW.game ? DCW.game.run : null; } catch (e) { r = null; }
    return r || (DCW.save && DCW.save.run) || null;
  }
  function fmt(n) { n = Math.round(n); var s = String(Math.abs(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ','); return (n < 0 ? '-' : '') + s; }

  /* ---------------- fallback pixel kit (same shape as rooms.js) ---------------- */
  var FB = {};
  function R(g, x, y, w, h, c) { g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); }
  function PX(g, x, y, c) { g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), 1, 1); }
  function disc(g, cx, cy, r, c) { g.fillStyle = c; for (var y = -r; y <= r; y++) { var w = Math.floor(Math.sqrt(r * r - y * y) + 0.35); g.fillRect(Math.round(cx - w), Math.round(cy + y), w * 2 + 1, 1); } }
  function ell(g, cx, cy, rx, ry, c) { g.fillStyle = c; for (var y = -ry; y <= ry; y++) { var w = Math.floor(rx * Math.sqrt(Math.max(0, 1 - (y * y) / (ry * ry))) + 0.35); g.fillRect(Math.round(cx - w), Math.round(cy + y), w * 2 + 1, 1); } }
  function defProc(name, w, h, n, draw) { FB[name] = { w: w, h: h, n: n, draw: draw, v: [] }; }
  function mk(w, h) { var c = document.createElement('canvas'); c.width = Math.max(1, w); c.height = Math.max(1, h); c.getContext('2d').imageSmoothingEnabled = false; return c; }
  function outline(cv, fw, fh, n) {
    var g = cv.getContext('2d'), Wd = cv.width, Ht = cv.height;
    var img = g.getImageData(0, 0, Wd, Ht), d = img.data, src = new Uint8Array(Wd * Ht), i, x, y;
    for (i = 0; i < Wd * Ht; i++) src[i] = d[i * 4 + 3] > 0 ? 1 : 0;
    for (var f = 0; f < n; f++) for (y = 0; y < fh; y++) for (x = 0; x < fw; x++) {
      i = y * Wd + f * fw + x; if (src[i]) continue;
      if ((x > 0 && src[i - 1]) || (x < fw - 1 && src[i + 1]) || (y > 0 && src[i - Wd]) || (y < fh - 1 && src[i + Wd])) { d[i * 4] = 0; d[i * 4 + 1] = 0; d[i * 4 + 2] = 0; d[i * 4 + 3] = 255; }
    }
    g.putImageData(img, 0, 0);
  }
  function fbCanvas(e, flip) {
    if (!e.v[0]) {
      var cv = mk(e.w * e.n, e.h), g = cv.getContext('2d');
      for (var f = 0; f < e.n; f++) { g.save(); g.translate(f * e.w, 0); g.beginPath(); g.rect(0, 0, e.w, e.h); g.clip(); try { e.draw(g, f); } catch (er) { R(g, 0, 0, e.w, e.h, '#ff00ff'); } g.restore(); }
      outline(cv, e.w, e.h, e.n); e.v[0] = cv;
    }
    if (!flip) return e.v[0];
    if (!e.v[1]) {
      var b = e.v[0], c2 = mk(b.width, b.height), g2 = c2.getContext('2d');
      for (var i = 0; i < e.n; i++) { g2.save(); g2.translate((i + 1) * e.w, 0); g2.scale(-1, 1); g2.drawImage(b, i * e.w, 0, e.w, e.h, 0, 0, e.w, e.h); g2.restore(); }
      e.v[1] = c2;
    }
    return e.v[1];
  }
  function fbDraw(ctx, name, x, y, o) {
    var e = FB[name]; if (!e) return false;
    o = o || {};
    var img = fbCanvas(e, !!o.flip), fr = ((o.frame | 0) % e.n + e.n) % e.n, sc = o.scale || 1;
    var w = Math.round(e.w * sc), h = Math.round(e.h * sc);
    ctx.drawImage(img, fr * e.w, 0, e.w, e.h, Math.round(x - w / 2), Math.round(y - h), w, h);
    return true;
  }
  function artHas(name) { try { return !!(DCW.art && DCW.art.has && DCW.art.has(name)); } catch (e) { return false; } }
  function artInfo(name) { try { var i = DCW.art.info(name); return i && !i.missing ? i : null; } catch (e) { return null; } }

  /* ---------------- fallback cast (front-ish, 2 frames: 0 rest, 1 mouth open) ---------------- */
  defProc('show_ripper', 24, 28, 2, function (g, f) {
    var B = '#a85010', L = '#e45c10', C = '#fca044';
    R(g, 2, 18, 4, 6, B); R(g, 18, 18, 4, 6, B);                  // little arms
    ell(g, 12, 21, 8, 7, B); ell(g, 12, 23, 5, 4, L);             // pudgy body, lighter belly
    disc(g, 5, 3, 2, B); disc(g, 19, 3, 2, B); PX(g, 5, 3, '#f8a4c0'); PX(g, 19, 3, '#f8a4c0');
    disc(g, 12, 9, 8, B);
    ell(g, 7, 12, 3, 2, C); ell(g, 17, 12, 3, 2, C);              // giant cheeks
    disc(g, 9, 8, 2, '#000'); disc(g, 15, 8, 2, '#000'); PX(g, 8, 7, '#fcfcfc'); PX(g, 14, 7, '#fcfcfc');
    R(g, 11, 11, 3, 1, '#000');
    if (f) { R(g, 10, 13, 5, 2, '#000'); R(g, 11, 14, 3, 1, '#f85898'); } else { PX(g, 10, 13, '#000'); R(g, 11, 14, 3, 1, '#000'); PX(g, 14, 13, '#000'); }
    R(g, 8, 16, 9, 2, C); R(g, 11, 15, 3, 4, '#f83800'); R(g, 12, 18, 2, 3, C); PX(g, 9, 17, '#f83800'); // orange ascot, tied like Fred's
    for (var i = 0; i < 6; i++) PX(g, 5 + i * 3, 21 + (i % 2) * 3, L);
  });
  function person(g, f, o) {
    // generic panel guest: o = {skin, hair, hair2, top, top2, tall, hat, extra}
    var y0 = o.tall ? 0 : 6;
    R(g, 3, y0 + 14, 3, 9, o.skin); R(g, 14, y0 + 14, 3, 9, o.skin);
    R(g, 5, y0 + 12, 10, 14 - (o.tall ? 0 : 2), o.top); R(g, 5, y0 + 12, 10, 2, o.top2);
    R(g, 7, y0 + 10, 6, 3, o.skin);
    R(g, 5, y0 + 2, 10, 9, o.skin);
    if (o.hair) { R(g, 4, y0 + 1, 12, 3, o.hair); R(g, 4, y0 + 1, 2, o.long ? 12 : 6, o.hair); R(g, 14, y0 + 1, 2, o.long ? 12 : 6, o.hair); }
    PX(g, 7, y0 + 5, o.eye || '#000'); PX(g, 12, y0 + 5, o.eye || '#000');
    if (f) R(g, 8, y0 + 8, 4, 2, '#000'); else R(g, 8, y0 + 8, 4, 1, '#a81000');
    if (o.extra) o.extra(g, y0, f);
  }
  defProc('show_hekla', 20, 40, 2, function (g, f) {
    person(g, f, { skin: '#fce0a8', hair: '#f8d878', long: true, top: '#bcbcbc', top2: '#f8b800', tall: true, eye: '#0058f8', extra: function (g2, y0) {
      R(g2, 1, y0 + 12, 4, 10, '#fce0a8'); R(g2, 15, y0 + 12, 4, 10, '#fce0a8');                 // bodybuilder arms
      R(g2, 4, y0 - 0, 12, 3, '#bcbcbc'); R(g2, 6, y0 - 0, 8, 1, '#fcfcfc');                   // valkyrie helmet
      R(g2, 1, y0 + 0, 3, 2, '#fcfcfc'); R(g2, 16, y0 + 0, 3, 2, '#fcfcfc'); PX(g2, 0, y0 + 1, '#fcfcfc'); PX(g2, 19, y0 + 1, '#fcfcfc');
      PX(g2, 7, y0 + 15, '#fcfcfc'); PX(g2, 12, y0 + 17, '#fcfcfc'); PX(g2, 9, y0 + 20, '#fcfcfc'); // glittering breastplate
      R(g2, 5, y0 + 26, 10, 12, '#881400');
    } });
  });
  defProc('show_manasa', 20, 32, 2, function (g, f) {
    person(g, f, { skin: '#f0d0b0', hair: '#d800cc', long: true, top: '#f878f8', top2: '#fcfcfc', extra: function (g2, y0) {
      disc(g2, 10, y0 + 1, 6, '#d800cc'); R(g2, 5, y0 + 2, 10, 9, '#f0d0b0'); PX(g2, 7, y0 + 5, '#000'); PX(g2, 12, y0 + 5, '#000');
      PX(g2, 7, y0 + 15, '#fcfcfc'); PX(g2, 12, y0 + 18, '#fcfcfc'); PX(g2, 9, y0 + 21, '#fcfcfc'); PX(g2, 4, y0 + 7, '#f8b800'); PX(g2, 15, y0 + 7, '#f8b800');
    } });
  });
  defProc('show_tucker', 20, 32, 2, function (g, f) {
    person(g, f, { skin: '#fce0a8', hair: '#881400', top: '#a81000', top2: '#000', extra: function (g2, y0) {
      R(g2, 4, y0 - 1, 12, 3, '#f83800'); R(g2, 13, y0 + 1, 5, 1, '#f83800'); R(g2, 6, y0 - 1, 4, 2, '#fcfcfc'); // trucker cap
      R(g2, 5, y0 + 8, 10, 3, '#881400'); if (f) R(g2, 8, y0 + 9, 4, 1, '#000');                        // beard
      R(g2, 5, y0 + 15, 10, 1, '#000'); R(g2, 5, y0 + 19, 10, 1, '#000'); R(g2, 9, y0 + 12, 1, 12, '#000'); // flannel
    } });
  });
  defProc('show_dnadia', 20, 32, 2, function (g, f) {
    person(g, f, { skin: '#a4e4fc', hair: '#4428bc', long: true, top: '#00a844', top2: '#f8b800', eye: '#d800cc', extra: function (g2, y0) {
      R(g2, 6, y0 - 1, 8, 2, '#f8b800'); PX(g2, 7, y0 - 2, '#f8b800'); PX(g2, 10, y0 - 3, '#f8b800'); PX(g2, 12, y0 - 2, '#f8b800'); PX(g2, 10, y0 - 1, '#e40058');
    } });
  });
  defProc('show_carl', 20, 28, 2, function (g, f) {
    R(g, 5, 22, 3, 5, '#fce0a8'); R(g, 11, 22, 3, 5, '#fce0a8'); R(g, 4, 18, 11, 5, '#fcfcfc'); PX(g, 7, 20, '#f83800'); PX(g, 11, 19, '#f83800');
    R(g, 4, 9, 11, 10, '#881400'); R(g, 8, 9, 3, 9, '#fce0a8'); R(g, 2, 10, 3, 8, '#881400'); R(g, 14, 10, 3, 6, '#fce0a8'); R(g, 14, 15, 4, 3, '#bcbcbc');
    R(g, 5, 1, 9, 8, '#fce0a8'); R(g, 5, 0, 9, 3, '#503000'); PX(g, 7, 4, '#000'); PX(g, 11, 4, '#000');
    if (f) R(g, 8, 6, 3, 2, '#000'); else R(g, 8, 6, 3, 1, '#000');
  });
  defProc('show_donut', 18, 16, 2, function (g, f) {
    ell(g, 8, 11, 6, 4, '#fce0a8'); R(g, 3, 12, 3, 3, '#fcfcfc'); R(g, 1, 7, 2, 6, '#000');
    disc(g, 12, 6, 4, '#503000'); ell(g, 12, 8, 3, 2, '#fce0a8'); PX(g, 10, 5, '#f8d878'); PX(g, 14, 5, '#f8d878');
    R(g, 8, 1, 2, 3, '#503000'); R(g, 15, 1, 2, 3, '#503000');
    R(g, 10, 0, 5, 2, '#f8b800'); PX(g, 12, 0, '#e40058');
    if (f) PX(g, 12, 9, '#000');
  });

  /* ---------------- who is who ---------------- */
  var CAST = {
    ripper: { names: ['RIPPER WONTON', 'RIPPER', 'WONTON'], art: ['ripper', 'ripper_idle'], fb: 'show_ripper', portrait: 'p_ripper' },
    hekla: { names: ['HEKLA'], art: ['hekla', 'hekla_idle'], fb: 'show_hekla', portrait: 'p_hekla' },
    manasa: { names: ['MANASA'], art: ['manasa', 'manasa_idle'], fb: 'show_manasa', portrait: 'p_manasa' },
    tucker: { names: ['TUCKER'], art: ['tucker', 'tucker_idle'], fb: 'show_tucker', portrait: 'p_tucker' },
    dnadia: { names: ["PRINCESS D'NADIA", "D'NADIA", 'DNADIA', 'PRINCESS DNADIA'], art: ['dnadia', 'dnadia_idle'], fb: 'show_dnadia', portrait: 'p_dnadia' },
    carl: { names: ['CARL'], art: ['carl_idle'], fb: 'show_carl', portrait: 'p_carl' },
    donut: { names: ['DONUT', 'PRINCESS DONUT'], art: ['donut_idle'], fb: 'show_donut', portrait: 'p_donut' }
  };
  function castOf(who) {
    var u = String(who || '').toUpperCase();
    for (var k in CAST) if (CAST[k].names.indexOf(u) >= 0) return k;
    return null;
  }
  function lineObj(l) {
    var o = typeof l === 'string' ? { who: 'SYSTEM AI', text: l } : { who: l.who || 'SYSTEM AI', text: l.text || '' };
    if (l && l.portrait !== undefined) o.portrait = l.portrait;
    else { var c = castOf(o.who); if (c && artHas(CAST[c].portrait)) o.portrait = CAST[c].portrait; }
    if (l && l.color) o.color = l.color;
    return o;
  }

  /* ---------------- the fallback script (original writing) ---------------- */
  var FALLBACK = {
    intro: [
      { who: 'SYSTEM AI', text: 'YOU ARE WATCHING DANGER ZONE, LIVE FROM THE MEDIUM SKYFOWL SETTLEMENT. KEEP YOUR LIMBS INSIDE THE STUDIO AT ALL TIMES.' },
      { who: 'RIPPER WONTON', text: 'GOOD EVENING, CRAWLERS AND CRAWLER ADJACENT! I AM RIPPER WONTON AND THIS IS DANGER ZONE!' },
      { who: 'RIPPER WONTON', text: 'ON THE COUCH TONIGHT: THE MAN WITH NO PANTS AND THE CAT WITH NO CHILL. CARL AND PRINCESS DONUT!' },
      { who: 'DONUT', text: 'IT IS PRINCESS DONUT THE SHOW CAT. THE CAT PART IS SILENT BUT IMPLIED.' },
      { who: 'RIPPER WONTON', text: "AND ON OUR PANEL: HEKLA OF BRYNHILD'S DAUGHTERS, THE GORGEOUS MANASA, TUCKER, AND HER ROYAL HIGHNESS PRINCESS D'NADIA!" }
    ],
    segments: [
      { who: 'RIPPER WONTON', q: 'CARL. THE BIG TOP. YOU POISONED YOUR OWN BLOOD TO TAKE DOWN A CITY BOSS. WALK US THROUGH THAT DECISION.', answers: [
        { text: 'IT WAS THAT OR ARM WRESTLE A SALAD. I PICKED THE OPTION WITH FEWER ARMS.', views: 250, crowd: 'laugh', react: [{ who: 'RIPPER WONTON', text: 'FEWER ARMS! SOMEBODY PUT THAT ON A SHIRT!' }] },
        { text: 'THE CIRCUS HAD IT COMING. SO DID THE CLOWNS. MOSTLY THE CLOWNS.', views: 150, crowd: 'applause', react: [{ who: 'TUCKER', text: 'NOBODY LIKES CLOWNS, MAN. NOBODY.' }] },
        { text: "I'D RATHER NOT TALK ABOUT MY BLOOD ON TELEVISION.", views: -100, crowd: 'boo', react: [{ who: 'RIPPER WONTON', text: 'WOW. OKAY. CAN WE GET SOME MUSIC IN HERE? NO? WE CAN NOT? GREAT.' }], donut: 'HE IS SHY ABOUT HIS FLUIDS. IT IS A HUMAN THING.' }
      ] },
      { who: 'RIPPER WONTON', q: 'LET US TALK FASHION. THE BOXERS. THE BARE FEET. THE ONE SLEEVE. IS THIS A STATEMENT?', answers: [
        { text: 'THE STATEMENT IS THAT THE GAME STOLE MY PANTS AND I HAVE NOT FORGIVEN IT.', views: 200, crowd: 'applause', react: [{ who: 'MANASA', text: 'HONESTLY? ICON BEHAVIOR.' }] },
        { text: 'THE BOXERS ARE ENCHANTED. THEY HIT HARDER THAN THIS WHOLE PANEL.', views: 120, crowd: 'laugh', react: [{ who: 'HEKLA', text: 'BOLD WORDS FROM A MAN IN HIS UNDERPANTS.' }] },
        { text: 'I AM BRINGING BACK THE TOGA. HALF A TOGA. A TO.', views: -50, crowd: 'boo', react: [{ who: "PRINCESS D'NADIA", text: 'IN MY KINGDOM WE EXILE PEOPLE FOR JOKES LIKE THAT.' }], donut: 'I PICK HIS OUTFITS. NOT THAT ONE. THAT ONE IS A CRY FOR HELP.' }
      ] },
      { who: 'RIPPER WONTON', q: 'PRINCESS DONUT HAS MILLIONS OF FANS. CARL, HOW DOES IT FEEL TO BE THE SIDEKICK?', answers: [
        { text: 'I CARRY HER. LITERALLY. ON MY SHOULDER. ALL DAY LONG.', views: 150, crowd: 'laugh', donut: 'HE IS A VERY GOOD SHOULDER. FIVE STARS. WOULD SIT AGAIN.' },
        { text: 'WE ARE A TEAM. SHE SHOOTS THE MISSILES, I GET HIT IN THE FACE. IT WORKS.', views: 250, crowd: 'applause', react: [{ who: 'RIPPER WONTON', text: 'THAT, FOLKS, IS WHAT LOVE LOOKS LIKE IN A DEATH GAME.' }] },
        { text: 'SIDEKICK? SHE IS A CAT. SHE CAN NOT EVEN OPEN A DOOR.', views: -150, crowd: 'boo', donut: 'I CAN OPEN DOORS, CARL. I SIMPLY HAVE STAFF FOR IT. YOU ARE THE STAFF.' }
      ] },
      { who: 'RIPPER WONTON', q: 'LAST ONE. THE WHOLE GALAXY IS WATCHING. ANYTHING YOU WANT TO SAY TO THE PEOPLE RUNNING THIS DUNGEON?', answers: [
        { text: 'YEAH. I AM COMING FOR YOU. ALL OF YOU. BRING SNACKS.', views: 300, crowd: 'applause', react: [{ who: 'HEKLA', text: "NOW THAT IS A WARRIOR'S ANSWER." }] },
        { text: 'PLEASE GIVE ME PANTS.', views: 100, crowd: 'laugh', react: [{ who: 'TUCKER', text: 'SECONDED.' }] },
        { text: 'NO COMMENT. MY LAWYER IS A VELOCIRAPTOR.', views: 60, crowd: 'laugh', donut: 'MONGO PASSED THE BAR. THEN HE ATE THE BAR.' }
      ] }
    ],
    hekla: [
      { who: 'HEKLA', text: "DONUT. YOU ARE WASTED ON THIS MAN. BRYNHILD'S DAUGHTERS COULD MAKE YOU A QUEEN." },
      { who: 'HEKLA', text: 'ARMOR. GLORY. AN ARMY OF WOMEN WHO WOULD DIE FOR YOU. AND NOBODY WALKING AROUND IN UNDERWEAR.' },
      { who: 'DONUT', text: 'THAT IS VERY FLATTERING. MY MANAGER WILL CALL YOUR MANAGER. MY MANAGER IS A DEMON.' },
      { who: 'CARL', text: 'SHE IS NOT GOING ANYWHERE. ALSO XENA CALLED. SHE WANTS HER HELMET BACK.' }
    ],
    outro: [
      { who: 'RIPPER WONTON', text: 'THAT IS OUR SHOW! CARL, DONUT, THANK YOU FOR NOT KILLING ANYBODY ON SET.' },
      { who: 'MANASA', text: 'THANKS FOR SWAPPING TRAILERS, YOU TWO. YOURS HAS A HOT TUB. I AM GOING TO GO SOAK.' },
      { who: 'RIPPER WONTON', text: 'GOOD NIGHT, CRAWLERS! STAY DANGEROUS!' }
    ],
    blastLines: [
      { who: 'SYSTEM AI', text: 'BREAKING NEWS. A TRAILER IN THE DANGER ZONE LOT HAS JUST EXPLODED. IT WAS THE TRAILER BOOKED FOR CARL AND PRINCESS DONUT.' },
      { who: 'CARL', text: 'MANASA WAS IN THAT TRAILER. THAT WAS MEANT FOR US.' },
      { who: 'DONUT', text: 'SOMEBODY TRIED TO MURDER US ON A TALK SHOW, CARL. ON LIVE TELEVISION. THE NERVE.' }
    ],
    blast: 'trailer_blast'
  };
  function script(lv) {
    var key = (lv && lv.show) || 'danger_zone';
    var s = (D().show || {})[key];
    if (!s || !Array.isArray(s.segments) || !s.segments.length) s = FALLBACK;
    return s;
  }

  /* ================================================================
     STATE + FLOW (a queue of beats, one line per ui.say)
     ================================================================ */
  var S = null;
  function enter(params) {
    var id = (params && params.levelId) || (run() && run().levelId) || 'a2_danger_zone';
    var lv = gcall('levelDef', id) || (D().levels || {})[id] || {};
    var sc = script(lv);
    var maxV = 0, minV = 0;
    (sc.segments || []).forEach(function (sg) {
      var vs = (sg.answers || []).map(function (a) { return num(a.views, 0); });
      if (vs.length) { maxV += Math.max.apply(null, vs); minV += Math.min.apply(null, vs); }
    });
    S = { id: id, lv: lv, sc: sc, t: 0, q: [], busy: false, waitT: 0, speaker: null, choice: null,
      total: 0, shown: 0, maxV: Math.max(200, maxV), minV: Math.min(-200, minV),
      needle: 0.5, needleV: 0, crowd: null, crowdT: 0, cue: null, cueT: 0, cutin: null, tomatoes: [], picks: [],
      blast: null, done: false, sent: false, manasaGone: 0, lightsT: 0, segI: -1 };
    music(lv.music || 'show');
    build();
  }
  function exit() { if (S) S.exited = true; }
  function Q(item) { S.q.push(item); }
  function sayLines(lines) { (lines || []).forEach(function (l) { if (l) Q({ say: lineObj(l) }); }); }
  function build() {
    var sc = S.sc;
    Q({ fn: function () { crowd('applause', 2.2); } });
    Q({ wait: 1.2 });
    sayLines(sc.intro);
    (sc.segments || []).forEach(function (sg, i) {
      Q({ fn: function () { S.segI = i; } });
      Q({ say: lineObj({ who: sg.who || 'RIPPER WONTON', text: sg.q || '...' }) });
      Q({ choice: sg });
    });
    if (sc.hekla && sc.hekla.length) { Q({ wait: 0.4 }); sayLines(sc.hekla); }
    sayLines(sc.outro);
    Q({ fn: function () { crowd('applause', 2.5); S.manasaGone = 0.01; } });
    Q({ wait: 1.6 });
    Q({ fn: finale });
  }
  function next() {
    while (S && !S.busy && S.waitT <= 0 && S.q.length && !S.choice && !S.done) {
      var it = S.q.shift();
      if (it.fn) { it.fn(); continue; }
      if (it.wait) { S.waitT = it.wait; break; }
      if (it.say) { speak(it.say); break; }
      if (it.choice) { openChoice(it.choice); break; }
      if (it.cutin) { S.cutin = { t: 0, line: it.cutin }; S.busy = true; sfx('meter', { pitch: 1.5 }); break; }
    }
  }
  function speak(line) {
    S.busy = true;
    S.speaker = castOf(line.who);
    var done = function () { if (!S) return; S.busy = false; S.speaker = null; if (S.cutin && S.cutin.speaking) S.cutin = null; };
    if (ufn('say')) { var m = ucall('say', [line], { onDone: done }); if (m === undefined || m === null) { /* say finished at once */ if (S.busy && !DCW.ui.blocking()) done(); } }
    else { S.local = { line: line, shown: 0, done: done }; }
  }
  function openChoice(sg) {
    var ans = (sg.answers || []).slice(0, 3);
    if (!ans.length) return;
    S.choice = { sg: sg, ans: ans, sel: 0, t: 0, time: sg.time === 0 ? 0 : num(sg.time, 15), lines: ans.map(function (a) { return DCW.wrapText(String(a.text || '').toUpperCase(), 268).slice(0, 2); }) };
    sfx('menu_move');
  }
  function pickAnswer(i) {
    var C = S.choice; if (!C) return;
    var a = i < 0 ? null : C.ans[i];
    S.choice = null;
    sfx('menu_select');
    if (!a) { // dead air
      S.picks.push(-1);
      S.q = [{ fn: function () { swing(-120, 'boo'); } },
        { say: lineObj({ who: C.sg.who || 'RIPPER WONTON', text: 'AND THAT, FOLKS, IS WHAT WE IN THE BUSINESS CALL DEAD AIR.' }) }].concat(S.q);
      return;
    }
    S.picks.push(i);
    var items = [];
    items.push({ say: lineObj({ who: a.who || 'CARL', text: a.text || '' }) });
    items.push({ fn: function () { swing(num(a.views, 0), a.crowd || a.sfx); } });
    items.push({ wait: 1.1 });
    (a.react || []).forEach(function (l) { if (l) items.push({ say: lineObj(l) }); });
    if (a.donut) {
      var dl = lineObj(typeof a.donut === 'string' ? { who: 'DONUT', text: a.donut } : a.donut);
      items.push({ cutin: dl });
      items.push({ say: dl, cut: true });
    }
    S.q = items.concat(S.q);
  }
  function crowd(kind, t) {
    S.crowd = kind; S.crowdT = t || 2;
    S.cue = kind === 'boo' ? 'BOO!' : kind === 'laugh' ? 'LAUGH' : kind === 'gasp' ? 'GASP' : 'APPLAUSE';
    S.cueT = S.crowdT;
    if (kind === 'applause' || kind === 'laugh' || kind === 'boo') sfx(kind);
    else if (kind === 'gasp') sfx('boo', { pitch: 1.4 });
    if (kind === 'boo') for (var i = 0; i < 5; i++) S.tomatoes.push({ x: rand(20, 300), y: 176, vx: rand(-20, 20), vy: rand(-170, -130), t: 0 });
  }
  function swing(v, kind) {
    S.total += v;
    if (!kind) kind = v >= 180 ? 'applause' : v > 0 ? 'laugh' : 'boo';
    crowd(kind, 2.2);
    S.needleV += (v >= 0 ? 1 : -1) * (1.2 + Math.abs(v) / 200);
    sfx('meter');
    S.popV = { v: v, t: 0 };
  }
  function meterTarget() {
    var v = S.total;
    return v >= 0 ? 0.5 + 0.5 * clamp(v / S.maxV, 0, 1) : 0.5 - 0.5 * clamp(v / S.minV, 0, 1);
  }

  /* ---------------- the end: blast, rewards, levelCleared ---------------- */
  function finale() {
    var lv = S.lv || {}, sc = S.sc, cin = D().cinema || {};
    if (lv.outro) { endShow(); return; }                       // the content's outro cinema is the blast: no double play
    var bid = sc.blast;
    if (bid && cin[bid] && gfn('playCinema')) { rewards(); S.done = true; gcall('playCinema', bid, function () { clearLevel(); }); return; }
    // in-scene blast
    S.blast = { t: 0 };
    sfx('burst'); DCW.shake(2, 0.8);
  }
  function updBlast(dt) {
    var B = S.blast; B.t += dt;
    if (B.t > 0.8 && !B.boom) { B.boom = true; sfx('explosion'); sfx('detonate'); DCW.shake(6, 1.0); crowd('gasp', 3); }
    if (B.t > 2.6 && !B.said) {
      B.said = true;
      sayLines(S.sc.blastLines || FALLBACK.blastLines);
      Q({ fn: endShow });
    }
  }
  function rewards() {
    if (S.rewarded) return; S.rewarded = true;
    var fb = S.sc.fanBox || {};
    var min = num(fb.min, Math.round(S.maxV * 0.7));
    if (S.total >= min && S.total > 0) {
      var tier = fb.tier || 'fan';
      if (gfn('giveLootBox')) gcall('giveLootBox', tier, fb.from || 'DANGER ZONE');
      S.fanBox = tier;
    }
    gcall('track', 'show_done'); gcall('track', 'show_views', Math.max(0, Math.round(S.total)));
    if (S.picks.length && S.picks.every(function (p, i) { var sg = S.sc.segments[i]; if (!sg || p < 0) return false; var best = Math.max.apply(null, sg.answers.map(function (a) { return num(a.views, 0); })); return num(sg.answers[p].views, 0) === best; })) gcall('track', 'show_perfect');
  }
  function endShow() {
    rewards();
    clearLevel();
  }
  function clearLevel() {
    if (S.sent) return;
    S.sent = true; S.done = true;
    var res = { levelId: S.id, kills: 0, time: Math.round(S.t * 10) / 10, damageTaken: 0, maxCombo: 0, views: Math.max(0, Math.round(S.total)), gold: 0, secrets: 0, show: true, fanBox: S.fanBox || null };
    S.result = res;
    if (gfn('levelCleared')) gcall('levelCleared', res);
    else S.fallbackMsg = 'SHOW OVER  ' + fmt(res.views) + ' VIEWS';
  }

  /* ================================================================
     UPDATE
     ================================================================ */
  function anim(dt) {
    S.t += dt;
    // needle: spring toward the running total, with a kick on each answer
    var tg = meterTarget();
    S.needleV += (tg - S.needle) * 30 * dt;
    S.needleV *= Math.pow(0.04, dt);
    S.needle = clamp(S.needle + S.needleV * dt, -0.05, 1.05);
    if (S.crowdT > 0) S.crowdT -= dt;
    if (S.cueT > 0) S.cueT -= dt;
    if (S.popV) { S.popV.t += dt; if (S.popV.t > 1.6) S.popV = null; }
    S.shown = lerp(S.shown, S.total, Math.min(1, dt * 5)); if (Math.abs(S.shown - S.total) < 1) S.shown = S.total;
    S.tomatoes.forEach(function (t) { t.t += dt; t.vy += 380 * dt; t.x += t.vx * dt; t.y += t.vy * dt; });
    S.tomatoes = S.tomatoes.filter(function (t) { return t.y < 190 && t.t < 2; });
    if (S.manasaGone > 0 && S.manasaGone < 2) S.manasaGone += dt;
    if (S.cutin) { S.cutin.t += dt; }
  }
  function update(dt) {
    if (!S || S.exited) return;
    anim(dt);
    if (S.done) return;
    if (P('start') && !S.blast && ufn('openPause')) { ucall('openPause', { canFlee: true }); return; }
    if (P('select') && !S.blast && ufn('onSelect')) { ucall('onSelect'); return; }   // SELECT: gear
    if (S.waitT > 0) S.waitT -= dt;
    if (S.blast) updBlast(dt);
    if (S.cutin && !S.cutin.speaking && S.cutin.t > 0.55) { S.cutin.speaking = true; S.busy = false; }
    if (S.local) updLocalSay(dt);
    if (S.choice) updChoice(dt);
    next();
  }
  function idle(dt) { if (S && !S.exited) anim(dt); }
  function updChoice(dt) {
    var C = S.choice;
    C.t += dt;
    if (C.t < 0.15) return;
    var n = C.ans.length;
    if (P('up')) { C.sel = (C.sel + n - 1) % n; sfx('menu_move'); }
    if (P('down')) { C.sel = (C.sel + 1) % n; sfx('menu_move'); }
    if (P('confirm')) { pickAnswer(C.sel); return; }
    if (C.time > 0 && C.t >= C.time) pickAnswer(-1);
  }
  // minimal dialog when ui.say is missing
  function updLocalSay(dt) {
    var L = S.local, len = L.line.text.length;
    L.shown = Math.min(len, L.shown + dt * 55);
    if (P('confirm') || P('back')) { if (L.shown < len) L.shown = len; else { var d = L.done; S.local = null; d(); } }
  }

  /* ================================================================
     DRAW
     ================================================================ */
  var hudMeters = null;
  function hudDrawsMeters() {
    if (hudMeters !== null) return hudMeters;
    try { hudMeters = !!(DCW.ui && (DCW.ui.hudMeters === true || String(DCW.ui.drawHUD).indexOf('meters') >= 0)); } catch (e) { hudMeters = false; }
    return hudMeters;
  }
  function studioArt() {
    if (!DCW.art || typeof DCW.art.background !== 'function') return false;
    var a = DCW.art;
    try {
      if (typeof a.hasBackground === 'function') return !!a.hasBackground('studio');
      var lists = [a.backgrounds, a.backdrops, a.bgThemes, a.themes];
      for (var i = 0; i < lists.length; i++) if (Array.isArray(lists[i]) && lists[i].indexOf('studio') >= 0) return true;
    } catch (e) { /* ignore */ }
    return false;
  }
  function draw(ctx) {
    if (!S) { R(ctx, 0, 0, W, H, '#000'); return; }
    var shakeLights = S.blast && S.blast.boom;
    // art's studio backdrop brings its own neon logo, light rig and stage floor; ours is the fallback set
    var own = true;
    if (studioArt()) { try { DCW.art.background(ctx, 'studio', 0, 0, { t: S.t }); own = false; } catch (e) { own = true; } }
    if (own) drawBackdrop(ctx);
    if (S.blast) drawBlastBack(ctx);
    if (own) { drawNeon(ctx); drawStage(ctx); }
    drawPanel(ctx);
    drawCouch(ctx);
    drawDesk(ctx);
    if (own) drawLights(ctx, shakeLights);
    else if (shakeLights) drawSwingLights(ctx);
    drawAudience(ctx);
    drawMeter(ctx);
    drawCue(ctx);
    if (S.cutin) drawCutin(ctx);
    if (S.choice) drawChoice(ctx);
    if (S.local) drawLocalSay(ctx);
    if (S.blast && S.blast.boom && S.blast.t < 1.1) { ctx.globalAlpha = clamp(1 - (S.blast.t - 0.8) / 0.3, 0, 1); R(ctx, 0, 0, W, H, '#fcfcfc'); ctx.globalAlpha = 1; }
    if (S.fallbackMsg) { DCW.box(70, 74, 180, 30); DCW.text(S.fallbackMsg, 160, 85, '#f8d878', { align: 'center' }); }
  }
  /* --- back wall: night sky + Over City skyline flat --- */
  var SKY = ['#000000', '#0000bc', '#4428bc', '#940084', '#a81000'];
  function drawBackdrop(ctx) {
    R(ctx, 0, 0, W, 120, '#000');
    // painted sunset flat, banded like a real NES gradient
    for (var i = 0; i < SKY.length; i++) R(ctx, 8, 14 + i * 14, W - 16, 14, SKY[i]);
    for (var j = 0; j < SKY.length - 1; j++) for (var x = 8 + (j & 1); x < W - 8; x += 2) PX(ctx, x, 14 + (j + 1) * 14, SKY[j]);
    // stars and the fake moon
    for (var s = 0; s < 26; s++) PX(ctx, 12 + (s * 53) % 296, 16 + (s * 29) % 26, (s + Math.floor(S.t * 2)) % 7 ? '#fcfcfc' : '#3cbcfc');
    disc(ctx, 258, 30, 7, '#f8d878'); disc(ctx, 261, 28, 6, '#0000bc');
    // skyline: towers, a ruined dome, the admin tower on the hill
    var bl = [[10, 40], [24, 58], [40, 34], [52, 66], [70, 48], [86, 38], [100, 72], [118, 44], [134, 54], [150, 30], [166, 62], [184, 40], [198, 80], [214, 46], [228, 56], [246, 36], [262, 64], [280, 42], [296, 52]];
    bl.forEach(function (b, k) {
      var x = b[0], h = b[1], w = 14 + (k % 3) * 2, top = 96 - h;
      R(ctx, x, top, w, h + 10, '#000');
      R(ctx, x + 1, top + 1, w - 2, h + 9, k % 2 ? '#0000bc' : '#4428bc');
      for (var wy = top + 4; wy < 100; wy += 6) for (var wx = x + 3; wx < x + w - 3; wx += 4) if (((wx * 7 + wy * 3 + k) % 5) < 2) R(ctx, wx, wy, 2, 2, '#f8d878');
      if (k === 12) { R(ctx, x + 5, top - 10, 4, 10, '#000'); disc(ctx, x + 7, top - 12, 3, '#f83800'); } // admin tower beacon
    });
    ell(ctx, 132, 98, 16, 10, '#000'); ell(ctx, 132, 98, 15, 9, '#6844fc'); R(ctx, 116, 98, 33, 10, '#000');  // ruined dome
    // the flat's wooden frame
    R(ctx, 0, 10, 8, 110, '#503000'); R(ctx, W - 8, 10, 8, 110, '#503000'); R(ctx, 0, 10, W, 4, '#503000'); R(ctx, 8, 14, W - 16, 1, '#000');
    R(ctx, 7, 14, 1, 106, '#000'); R(ctx, W - 8, 14, 1, 106, '#000');
  }
  function drawBlastBack(ctx) {
    var B = S.blast; if (!B.boom) return;
    var k = clamp((B.t - 0.8) / 1.6, 0, 1);
    var cx = 70, cy = 70, r = Math.round(10 + k * 60);
    disc(ctx, cx, cy, r + 4, '#a81000'); disc(ctx, cx, cy, r, '#f83800'); disc(ctx, cx, cy - 4, Math.round(r * 0.7), '#fca044'); disc(ctx, cx, cy - 6, Math.round(r * 0.4), '#fcfcfc');
    for (var i = 0; i < 10; i++) { var a = i * 0.63 + 0.2; R(ctx, Math.round(cx + Math.cos(a) * r * 1.3), Math.round(cy + Math.sin(a) * r * 1.1 - k * 20), 3, 3, '#000'); }
    // a tear in the backdrop
    ctx.globalAlpha = 0.5; R(ctx, 8, 14, W - 16, 106, '#f83800'); ctx.globalAlpha = 1;
  }
  /* --- DANGER ZONE neon --- */
  function drawNeon(ctx) {
    var t = S.t, flick = (Math.floor(t * 7) % 23) === 0;
    var x = 160, y = 20;
    DCW.box(92, 16, 136, 30, { fill: '#000', border: '#7c7c7c', border2: '#000' });
    var on = !(S.blast && S.blast.boom && Math.floor(t * 12) % 2);
    DCW.text('DANGER', x, y + 1, on ? '#f85898' : '#3c0020', { align: 'center', scale: 2, shadow: on ? '#940084' : null });
    var zc = on && !flick ? '#00fcfc' : '#004058';
    DCW.text('ZONE', x - 30, y + 15, zc, { align: 'left', shadow: on && !flick ? '#0058f8' : null });
    DCW.text('WITH RIPPER', x + 32, y + 15, on ? '#f8d878' : '#503000', { align: 'center', shadow: '#000' });
    // bolt
    if (on) [99, 213].forEach(function (bx) {
      R(ctx, bx + 3, 20, 3, 2, '#f8d878'); R(ctx, bx + 2, 22, 3, 2, '#f8d878'); R(ctx, bx + 1, 24, 6, 2, '#f8d878');
      R(ctx, bx + 3, 26, 3, 2, '#f8d878'); R(ctx, bx + 2, 28, 3, 2, '#f8d878'); R(ctx, bx + 1, 30, 2, 3, '#f8d878');
    });
  }
  /* --- stage floor --- */
  function drawStage(ctx) {
    R(ctx, 0, 118, W, 40, '#0000bc');
    for (var y = 120; y < 158; y += 6) R(ctx, 0, y, W, 1, '#4428bc');
    for (var x = 0; x < W; x += 20) { R(ctx, x, 118, 1, 40, '#000'); }
    R(ctx, 0, 117, W, 2, '#000');
    // spot pools on the floor
    ctx.globalAlpha = 0.18; ell(ctx, 150, 142, 60, 9, '#a4e4fc'); ell(ctx, 262, 140, 44, 8, '#f8d878'); ell(ctx, 52, 142, 48, 8, '#f8b8f8'); ctx.globalAlpha = 1;
  }
  /* --- people --- */
  function castSprite(k) {
    var c = CAST[k];
    for (var i = 0; i < c.art.length; i++) if (artHas(c.art[i])) return { art: c.art[i] };
    return { fb: c.fb };
  }
  // seated: 'line' is the furniture edge that hides the legs; 'vis' the share of the sprite above it
  function seat(ctx, k, x, line, vis, flip) {
    var h = spriteH(castSprite(k));
    drawCast(ctx, k, x, line + Math.round(h * (1 - vis)), flip);
  }
  function drawCast(ctx, k, x, feetY, flip) {
    var talking = S.speaker === k;
    var bob = talking ? (Math.floor(S.t * 8) % 2) : 0;
    var cs = castSprite(k);
    var frame = talking ? Math.floor(S.t * 8) : (Math.floor(S.t * 0.7 + x) % 5 === 0 ? 1 : 0);
    var o = { frame: frame, flip: !!flip };
    if (k === 'carl') o.skin = (DCW.save && DCW.save.equipped && DCW.save.equipped.skin) || undefined;
    if (cs.art) DCW.art.sprite(ctx, cs.art, x, feetY - bob, o);
    else fbDraw(ctx, cs.fb, x, feetY - bob, { frame: talking ? Math.floor(S.t * 8) : 0, flip: !!flip });
    if (talking && Math.floor(S.t * 3) % 2 === 0) DCW.text('▼', x, feetY - spriteH(cs) - 10 - bob, '#f8d878', { align: 'center' });
    // boo: they flinch at tomatoes
  }
  function spriteH(cs) { if (cs.art) { var i = artInfo(cs.art); return i ? i.h : 28; } return FB[cs.fb] ? FB[cs.fb].h : 28; }
  function drawPanel(ctx) {
    // riser + long panel desk on the left
    R(ctx, 2, 112, 104, 8, '#503000'); R(ctx, 2, 112, 104, 1, '#000');
    var slots = [['hekla', 18], ['manasa', 42], ['tucker', 66], ['dnadia', 90]];
    slots.forEach(function (sl) {
      if (sl[0] === 'manasa' && S.manasaGone > 0) {
        var gx = sl[1] - S.manasaGone * 60;
        if (S.manasaGone < 1.6) drawCast(ctx, 'manasa', gx, 120, true);
        return;
      }
      seat(ctx, sl[0], sl[1], 104, 0.66, false);
    });
    R(ctx, 2, 104, 104, 4, '#ac7c00'); R(ctx, 2, 103, 104, 1, '#000'); R(ctx, 2, 104, 104, 1, '#fce0a8');
    R(ctx, 4, 108, 100, 26, '#881400'); R(ctx, 4, 108, 100, 2, '#000'); R(ctx, 3, 108, 1, 26, '#000'); R(ctx, 104, 108, 1, 26, '#000');
    R(ctx, 8, 114, 92, 12, '#000'); DCW.text('THE PANEL', 54, 116, '#f8d878', { align: 'center', shadow: null });
    R(ctx, 4, 134, 100, 1, '#000');
  }
  function drawCouch(ctx) {
    var x0 = 112, x1 = 200;
    // back + arms
    R(ctx, x0, 104, x1 - x0, 14, '#000'); R(ctx, x0 + 1, 105, x1 - x0 - 2, 12, '#a81000');
    R(ctx, x0 + 3, 107, (x1 - x0) / 2 - 5, 9, '#f83800'); R(ctx, x0 + (x1 - x0) / 2 + 2, 107, (x1 - x0) / 2 - 5, 9, '#f83800');
    seat(ctx, 'carl', 138, 118, 0.76, false);
    drawCast(ctx, 'donut', 176, 119, false);
    // seat front over their legs
    R(ctx, x0 - 6, 118, x1 - x0 + 12, 18, '#000'); R(ctx, x0 - 5, 119, x1 - x0 + 10, 14, '#a81000'); R(ctx, x0 - 5, 119, x1 - x0 + 10, 2, '#f83800');
    R(ctx, x0 - 7, 106, 9, 28, '#000'); R(ctx, x0 - 6, 107, 7, 26, '#881400'); R(ctx, x1 - 2, 106, 9, 28, '#000'); R(ctx, x1 - 1, 107, 7, 26, '#881400');
    R(ctx, x0 - 6, 107, 7, 2, '#f83800'); R(ctx, x1 - 1, 107, 7, 2, '#f83800');
    R(ctx, x0 - 4, 134, 3, 4, '#503000'); R(ctx, x1 + 1, 134, 3, 4, '#503000');
  }
  function drawDesk(ctx) {
    seat(ctx, 'ripper', 262, 108, 0.74, true);
    var x = 214, w = 96;
    R(ctx, x, 108, w, 4, '#000'); R(ctx, x + 1, 109, w - 2, 2, '#ac7c00');
    R(ctx, x + 2, 112, w - 4, 26, '#000'); R(ctx, x + 3, 112, w - 6, 25, '#4428bc');
    R(ctx, x + 3, 112, w - 6, 2, '#6844fc');
    // DZ logo plate
    R(ctx, x + 30, 117, 36, 14, '#000'); R(ctx, x + 31, 118, 34, 12, '#f85898');
    DCW.text('DZ', x + 48, 120, '#fcfcfc', { align: 'center', shadow: '#940084' });
    // mug + microphone
    R(ctx, x + 66, 101, 7, 7, '#000'); R(ctx, x + 67, 102, 5, 6, '#fcfcfc'); R(ctx, x + 73, 103, 2, 3, '#000'); PX(ctx, x + 68, 104, '#f83800');
    R(ctx, x + 22, 98, 1, 10, '#7c7c7c'); R(ctx, x + 20, 95, 4, 4, '#000'); R(ctx, x + 21, 96, 2, 2, '#bcbcbc');
  }
  /* --- truss + studio lights --- */
  function drawLights(ctx, wild) {
    R(ctx, 0, 0, W, 6, '#000'); for (var x = 0; x < W; x += 8) { R(ctx, x, 1, 7, 1, '#7c7c7c'); R(ctx, x + 3, 2, 1, 3, '#7c7c7c'); } R(ctx, 0, 5, W, 1, '#7c7c7c');
    var cans = [40, 120, 200, 280];
    cans.forEach(function (cx, i) {
      var sw = wild ? Math.sin(S.t * 9 + i) * 6 : Math.sin(S.t * 0.8 + i * 1.7) * 2;
      var bx = Math.round(cx + sw);
      R(ctx, bx - 4, 6, 8, 7, '#000'); R(ctx, bx - 3, 6, 6, 6, '#7c7c7c'); R(ctx, bx - 3, 11, 6, 2, '#fcfcfc');
      ctx.globalAlpha = S.crowd && S.crowdT > 0 ? 0.16 : 0.09;
      ctx.fillStyle = ['#f878f8', '#a4e4fc', '#f8d878', '#b8f818'][i];
      var tx = bx + (i < 2 ? 18 : -18) + sw * 6;
      ctx.beginPath(); ctx.moveTo(bx - 3, 13); ctx.lineTo(bx + 3, 13); ctx.lineTo(tx + 26, 140); ctx.lineTo(tx - 26, 140); ctx.closePath(); ctx.fill();
      ctx.globalAlpha = 1;
    });
  }
  function drawSwingLights(ctx) { // the blast knocks the rig around
    ctx.globalAlpha = 0.12;
    for (var i = 0; i < 4; i++) {
      var bx = 40 + i * 80, sw = Math.sin(S.t * 9 + i) * 60;
      ctx.fillStyle = ['#f83800', '#f8d878', '#fcfcfc', '#f83800'][i];
      ctx.beginPath(); ctx.moveTo(bx - 2, 10); ctx.lineTo(bx + 2, 10); ctx.lineTo(bx + sw + 24, 150); ctx.lineTo(bx + sw - 24, 150); ctx.closePath(); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  /* --- the studio audience (silhouettes in front of the stage) --- */
  function drawAudience(ctx) {
    var kind = S.crowdT > 0 ? S.crowd : null;
    R(ctx, 0, 148, W, 32, '#000');
    for (var row = 0; row < 2; row++) {
      var y = row ? 171 : 157, step = row ? 18 : 14, off = row ? 2 : 9;
      for (var x = off, n = 0; x < W + 12; x += step, n++) {
        var seed = (n * 5 + row * 3 + (n * n) % 7) % 9;
        var r = (row ? 7 : 5) + (seed === 4 ? 1 : seed === 7 ? -1 : 0);
        var bob = 0, dx = (seed % 3) - 1;
        if (kind === 'applause' || kind === 'laugh') bob = Math.round(Math.abs(Math.sin(S.t * (kind === 'laugh' ? 12 : 9) + seed)) * (row ? 3 : 2));
        if (kind === 'boo') dx += Math.round(Math.sin(S.t * 16 + seed) * 1.5);
        if (kind === 'gasp') bob = 3;
        var col = row ? '#000' : '#08081c';
        var hx = x + dx, hy = y - bob + (seed & 1);
        // shoulders
        R(ctx, hx - r - 4, hy + r - 2, r * 2 + 9, 24, '#4428bc'); R(ctx, hx - r - 3, hy + r - 1, r * 2 + 8, 24, col);
        // head with a rim of stage light on the top-left
        disc(ctx, hx, hy, r, '#4428bc'); disc(ctx, hx + 1, hy + 1, r, col);
        if (seed === 2) { R(ctx, hx - r - 1, hy - r + 1, r * 2 + 3, 2, col); R(ctx, hx - r + 2, hy - r - 2, r * 2 - 3, 3, col); } // hat
        if (seed === 5) { R(ctx, hx - r, hy - r - 2, 2, 4, col); R(ctx, hx + r - 1, hy - r - 2, 2, 4, col); }                     // horns: not everyone is human
        if (seed === 8) disc(ctx, hx + 1, hy - r, 2, col);                                                                         // bun
        if ((kind === 'applause' || kind === 'gasp') && seed % 3 === 0) { R(ctx, hx - r - 3, hy - r - 6 - bob, 2, 9, col); R(ctx, hx + r + 2, hy - r - 6 - bob, 2, 9, col); }
      }
    }
    S.tomatoes.forEach(function (t) { disc(ctx, Math.round(t.x), Math.round(t.y), 2, '#f83800'); PX(ctx, Math.round(t.x), Math.round(t.y) - 2, '#00a800'); });
  }
  /* --- the APPLAUSE / VIEWS meter (top right) --- */
  function drawMeter(ctx) {
    var x = 240, y = 8, w = 76, h = 40, cx = x + w / 2, cy = y + 30;
    DCW.box(x, y, w, h, { fill: '#000', border: '#bcbcbc', border2: '#000' });
    // dial: red (boo) to green (wow)
    var segs = ['#a81000', '#f83800', '#fca044', '#f8d878', '#b8f818', '#58d854', '#00a800'];
    for (var i = 0; i < 28; i++) {
      var a = Math.PI + (i + 0.5) / 28 * Math.PI;
      var c = segs[Math.floor(i / 4)];
      R(ctx, Math.round(cx + Math.cos(a) * 22) - 1, Math.round(cy + Math.sin(a) * 20) - 1, 3, 3, c);
    }
    var na = Math.PI + clamp(S.needle, 0, 1) * Math.PI;
    for (var k = 0; k < 20; k++) PX(ctx, Math.round(cx + Math.cos(na) * k), Math.round(cy + Math.sin(na) * k * 0.9), '#fcfcfc');
    R(ctx, cx - 2, cy - 2, 5, 4, '#bcbcbc');
    DCW.text('BOO', x + 4, y + h - 10, '#f83800', { shadow: null });
    DCW.text('WOW', x + w - 4, y + h - 10, '#58d854', { align: 'right', shadow: null });
    // views earned this show
    var vy = y + h + 3;
    DCW.box(x, vy, w, 13, { fill: '#000', border: '#f878f8', border2: '#000' });
    DCW.text(fmt(S.shown), x + w - 4, vy + 3, S.shown < 0 ? '#f83800' : '#f878f8', { align: 'right', shadow: null });
    DCW.text('VIEWS', x + 4, vy + 3, '#7c7c7c', { shadow: null });
    if (S.popV) {
      var pv = S.popV, py = vy + 16 - Math.round(pv.t * 8);
      DCW.text((pv.v >= 0 ? '+' : '') + fmt(pv.v), x + w / 2, py, pv.v >= 0 ? '#58d854' : '#f83800', { align: 'center' });
    }
  }
  /* --- crowd cue sign (top left) --- */
  function drawCue(ctx) {
    var x = 4, y = 8, w = 62, h = 14;
    var lit = S.cueT > 0 && Math.floor(S.t * 6) % 2 === 0;
    var txt = S.cue || 'APPLAUSE';
    var col = txt === 'BOO!' ? '#f83800' : txt === 'LAUGH' ? '#f8d878' : txt === 'GASP' ? '#a4e4fc' : '#f83800';
    DCW.box(x, y, w, h, { fill: lit ? '#3c0000' : '#000', border: lit ? col : '#7c7c7c', border2: '#000' });
    DCW.text(S.cueT > 0 ? txt : 'APPLAUSE', x + w / 2, y + 4, lit ? '#fcfcfc' : '#503000', { align: 'center', shadow: lit ? col : null });
    // ON AIR
    DCW.box(x, y + 17, 40, 12, { fill: '#000', border: '#7c7c7c', border2: '#000' });
    var onair = Math.floor(S.t * 1.5) % 2 === 0;
    DCW.text('● LIVE', x + 20, y + 20, onair ? '#f83800' : '#a81000', { align: 'center', shadow: null });
  }
  /* --- Donut cut-in --- */
  var cutCv = null;
  function drawCutin(ctx) {
    var c = S.cutin, k = clamp(c.t / 0.3, 0, 1), e = 1 - Math.pow(1 - k, 3);
    var y0 = 34, hh = 66, off = Math.round((1 - e) * 340);
    // slanted band
    ctx.fillStyle = '#000'; ctx.beginPath(); ctx.moveTo(off + 20, y0 - 2); ctx.lineTo(off + W + 40, y0 - 2); ctx.lineTo(off + W + 20, y0 + hh + 2); ctx.lineTo(off, y0 + hh + 2); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#d800cc'; ctx.beginPath(); ctx.moveTo(off + 22, y0); ctx.lineTo(off + W + 40, y0); ctx.lineTo(off + W + 20, y0 + hh); ctx.lineTo(off + 2, y0 + hh); ctx.closePath(); ctx.fill();
    for (var i = 0; i < 8; i++) R(ctx, off + 30 + ((i * 47 + Math.floor(S.t * 300)) % 300), y0 + 6 + i * 7, 30, 1, '#f878f8');
    // big portrait (2x nearest neighbour)
    if (!cutCv) cutCv = mk(32, 32);
    var g = cutCv.getContext('2d'); g.clearRect(0, 0, 32, 32);
    var px = off + 36, py = y0 + 1;
    if (artHas('p_donut') && DCW.art.portrait) {
      DCW.art.portrait(g, 'p_donut', 0, 0, { frame: Math.floor(S.t * 6) % 2 });
      R(ctx, px - 2, py - 1, 68, 66, '#000');
      ctx.drawImage(cutCv, 0, 0, 32, 32, px, py, 64, 64);
    } else {
      R(ctx, px - 2, py - 1, 68, 66, '#000'); R(ctx, px, py, 64, 64, '#940084');
      ctx.save(); ctx.beginPath(); ctx.rect(px, py, 64, 64); ctx.clip();
      if (artHas('donut_idle')) DCW.art.sprite(ctx, 'donut_idle', px + 32, py + 60, { scale: 3, frame: Math.floor(S.t * 6) });
      else fbDraw(ctx, 'show_donut', px + 32, py + 60, { scale: 3, frame: Math.floor(S.t * 6) });
      ctx.restore();
    }
    DCW.text('PRINCESS DONUT', off + 112, y0 + 14, '#fcfcfc', { scale: 2, shadow: '#000' });
    DCW.text('CUTS IN!', off + 112, y0 + 36, '#f8d878', { scale: 2, shadow: '#000' });
  }
  /* --- the answer box --- */
  function drawChoice(ctx) {
    var C = S.choice;
    // the question stays up top
    var q = DCW.wrapText(String(C.sg.q || '').toUpperCase(), 296).slice(0, 3);
    var qh = 14 + q.length * 10;
    DCW.box(4, 54 - qh, 312, qh, { fill: '#0f1630' });
    DCW.text(String(C.sg.who || 'RIPPER WONTON').toUpperCase() + ' ASKS:', 10, 58 - qh, '#f8d878');
    q.forEach(function (l, i) { DCW.text(l, 10, 68 - qh + i * 10, '#fcfcfc'); });
    // answers
    var rows = 0; C.lines.forEach(function (ls) { rows += ls.length; });
    var hgt = 18 + rows * 10 + C.lines.length * 3 + (C.time > 0 ? 6 : 0);
    var y = H - 2 - hgt;
    DCW.box(4, y, 312, hgt, { fill: '#000' });
    DCW.text('YOUR ANSWER, LIVE:', 10, y + 4, '#f878f8');
    var yy = y + 15;
    C.lines.forEach(function (ls, i) {
      var sel = i === C.sel;
      if (sel) { R(ctx, 8, yy - 2, 304, ls.length * 10 + 2, '#202048'); DCW.text('▶', 12, yy, '#f8d878'); }
      ls.forEach(function (l, j) { DCW.text(l, 26, yy + j * 10, sel ? '#fcfcfc' : '#bcbcbc'); });
      yy += ls.length * 10 + 3;
    });
    if (C.time > 0) {
      var left = clamp(1 - C.t / C.time, 0, 1);
      DCW.bar(10, y + hgt - 7, 300, 2, left, left < 0.3 ? '#f83800' : '#58d854', '#202020');
      if (left < 0.3 && Math.floor(S.t * 4) % 2) DCW.text('DEAD AIR!', 310, y + 4, '#f83800', { align: 'right' });
    }
  }
  function drawLocalSay(ctx) {
    var L = S.local;
    DCW.box(4, 126, 312, 50);
    DCW.text(String(L.line.who || '').toUpperCase(), 10, 130, '#f8d878');
    DCW.text(L.line.text.slice(0, Math.floor(L.shown)).toUpperCase(), 10, 141, '#fcfcfc', { wrap: 296 });
  }

  /* ---------------- debug ---------------- */
  function debugClear() {
    if (!S || S.done) return;
    // answer the rest with the best option, skip the talk, go to the blast
    (S.sc.segments || []).forEach(function (sg, i) {
      if (i <= S.segI && !S.choice) return;
      var best = 0; (sg.answers || []).forEach(function (a, j) { if (num(a.views, 0) > num(sg.answers[best].views, 0)) best = j; });
      S.total += num((sg.answers[best] || {}).views, 0);
    });
    S.choice = null; S.q = []; S.busy = false; S.waitT = 0; S.cutin = null;
    if (DCW.ui && DCW.ui.closeAll) DCW.ui.closeAll();
    Q({ fn: finale });
  }

  var scene = { enter: enter, exit: exit, update: update, idle: idle, draw: draw };
  var inited = false;
  DCW.show = {
    scene: scene,
    init: function () {
      if (inited) return; inited = true;
      window.addEventListener('keydown', function (e) {
        if (!DCW.debug || DCW.scene !== scene || !S) return;
        if (e.code === 'Digit9') debugClear();
      });
    },
    get state() { return S; },
    debugClear: debugClear,
    fallbackScript: FALLBACK,
    fallbackArt: FB
  };
})();

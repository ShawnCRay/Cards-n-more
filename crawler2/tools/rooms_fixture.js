/* Test fixture for rooms.js / show.js: fills in ONLY what data.js does not define yet. */
(function () {
  var DCW = window.DCW = window.DCW || {};
  var D = DCW.data = DCW.data || {};
  D.levels = D.levels || {};
  if (!D.levels.a1_bigtop) D.levels.a1_bigtop = {
    id: 'a1_bigtop', name: 'THE BIG TOP', act: 1, kind: 'rooms', theme: 'bigtop', music: 'bigtop', hours: 3,
    intro: ['WELCOME TO THE BIG TOP. THREE RINGS, THREE TENT POLES, ONE EXTREMELY BAD IDEA.'],
    room: { rooms: [
      { name: 'RING ONE', target: { kind: 'pole', hp: 60 }, waves: [['fat_clown', 2], ['lemur', 2]], rate: 1.6 },
      { name: 'RING TWO', target: { kind: 'pole', hp: 70 }, waves: [['fat_clown', 2], ['stilt_clown', 2], ['lemur', 1]], rate: 1.5 },
      { name: 'RING THREE', target: { kind: 'pole', hp: 80 }, waves: [['stilt_clown', 1], ['mold_lion', 2], ['lemur', 1]], rate: 1.4 }
    ], finale: { kind: 'vine', seconds: 45 } },
    reward: { box: 'gold', xp: 80, gold: 60 }
  };
  if (!D.levels.a2_danger_zone) D.levels.a2_danger_zone = { id: 'a2_danger_zone', name: 'DANGER ZONE', act: 2, kind: 'show', show: 'danger_zone', music: 'show', hours: 2, reward: { xp: 40 } };
  D.enemies = D.enemies || {};
  var E = {
    fat_clown: { name: 'CLAMMY-TYPE CLOWN', hp: 14, dmg: 3, speed: 40, w: 20, h: 20, ai: 'jumper', xp: 9, gold: [1, 4], sprite: 'fat_clown' },
    stilt_clown: { name: 'TERROR THE CLOWN', hp: 22, dmg: 4, speed: 50, w: 12, h: 44, ai: 'stilt', xp: 14, gold: [2, 5], sprite: 'stilt_clown', fearImmune: true },
    lemur: { name: 'FORMER CIRCUS LEMUR', hp: 8, dmg: 2, speed: 70, w: 12, h: 12, ai: 'perch', xp: 7, gold: [1, 3], sprite: 'lemur' },
    mold_lion: { name: 'MOLD LION', hp: 18, dmg: 4, speed: 60, w: 22, h: 16, ai: 'charger', xp: 15, gold: [2, 6], sprite: 'mold_lion', regrow: true }
  };
  Object.keys(E).forEach(function (k) { if (!D.enemies[k]) D.enemies[k] = E[k]; });
})();

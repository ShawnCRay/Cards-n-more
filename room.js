/* ============================================================
   Vault 21 room layer — shared across the landing page and every game.

   The room, not the individual game, is the unit friends gather in. A host
   opens a room on the landing page; friends join it with one code/link and
   wait together. Only the host picks the game (and its settings). When the
   host picks or switches a game, the whole table hops together.

   Mechanics: the host's PeerJS id is `v21-<CODE>` on the landing page AND on
   every game page (a single namespace, not one per game), so an invite link
   always reaches the host wherever the group currently is. To move everyone,
   the host broadcasts {type:'switch', game} and navigates; guests receive it
   and follow. Identity survives the page load via sessionStorage.

   This file is inert without room context: a game opened with no room params
   plays exactly as it did before (pure solo / legacy ?join still work). All
   the games declare the same global functions and element ids, so this layer
   wraps them directly with no per-game adapters.
   ============================================================ */
(function () {
  'use strict';
  if (!window.Peer) return; // no PeerJS build present -> nothing to do

  var PREFIX = 'v21-';
  var STORAGE_KEY = 'v21room';
  var MAX_AGE_MS = 6 * 60 * 60 * 1000; // forget a stored room after 6h

  // Guest capacities = how many *remote* friends the host can seat (host not
  // counted). Used to grey out games a room is too big for.
  var GAMES = [
    { id: 'blackjack',  title: 'Blackjack',            path: 'blackjack/',  icon: '♠', cap: 5 },
    { id: 'flip7',      title: 'Flip 7',               path: 'flip7/',      icon: '7',      cap: 5 },
    { id: 'caravan',    title: 'Caravan',              path: 'caravan/',    icon: '🐂', cap: 1 },
    { id: 'uno',        title: 'UNO',                  path: 'uno/',        icon: '⇄', cap: 5 },
    { id: 'rome',       title: 'Glory to Rome',        path: 'rome/',       icon: '◆', cap: 2 },
    { id: 'innovation', title: 'Eras of the Wasteland',path: 'innovation/', icon: '☢', cap: 2 },
    { id: 'liarsdice',  title: "Liar's Dice",          path: 'liarsdice/',  icon: '⚄', cap: 5 },
    { id: 'holdem',     title: "Texas Hold'em",        path: 'holdem/',     icon: '♣', cap: 5 },
  ];

  var IN_GAME = !!window.__V21_GAME__;
  var BASE = IN_GAME ? '../' : './'; // path back to the repo root from here

  function gameById(id) {
    for (var i = 0; i < GAMES.length; i++) if (GAMES[i].id === id) return GAMES[i];
    return null;
  }

  /* ---------- session identity (survives the hop navigation) ---------- */

  function saveSession(s) {
    try { s.ts = Date.now(); sessionStorage.setItem(STORAGE_KEY, JSON.stringify(s)); } catch (e) { /* private mode */ }
  }
  function loadSession() {
    try {
      var s = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || 'null');
      if (!s) return null;
      if (Date.now() - (s.ts || 0) > MAX_AGE_MS) { clearSession(); return null; }
      return s;
    } catch (e) { return null; }
  }
  function clearSession() {
    try { sessionStorage.removeItem(STORAGE_KEY); } catch (e) { /* private mode */ }
  }

  function myName() {
    var p = window.__V21_host; // host player object (aliased by each game: `player`/`me`)
    if (p && p.name && p.name !== 'You') return p.name;
    var s = loadSession();
    return (s && s.name) || (p && p.name) || 'Player';
  }

  /* ---------- peer helpers (mirror each game's makePeer) ---------- */

  function psValue() { return new URLSearchParams(location.search).get('ps'); }
  // a custom signaling server (used by the tests) must ride along on every hop
  function psParam() { var ps = psValue(); return ps ? '&ps=' + encodeURIComponent(ps) : ''; }

  function peerOpts(withId) {
    var ps = psValue();
    var opts = ps
      ? { host: ps.split(':')[0], port: Number(ps.split(':')[1]), path: '/', secure: false }
      : {};
    opts.config = {
      iceServers: [
        { urls: ['stun:stun.l.google.com:19302', 'stun:global.stun.twilio.com:3478'] },
        {
          urls: ['turn:openrelay.metered.ca:80', 'turn:openrelay.metered.ca:443',
                 'turns:openrelay.metered.ca:443?transport=tcp'],
          username: 'openrelayproject',
          credential: 'openrelayproject',
        },
      ],
    };
    if (withId) {
      // one session token per room so a rebuilt host REPLACES its lingering
      // broker registration instead of colliding with it
      V21._token = V21._token || (Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2));
      opts.token = V21._token;
    }
    return opts;
  }
  function makeRoomPeer(id) {
    var peer = id ? new Peer(id, peerOpts(true)) : new Peer(peerOpts(false));
    peer.on('disconnected', function () { if (!peer.destroyed) peer.reconnect(); });
    return peer;
  }
  function peerId(code) { return PREFIX + code; }

  function randCode() {
    var chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // no 0/O/1/I/L
    var c = '';
    for (var i = 0; i < 6; i++) c += chars[Math.floor(Math.random() * chars.length)];
    return c;
  }

  /* ---------- navigation (the hop itself) ---------- */

  function gameUrl(gameId, role, code) {
    return BASE + gameById(gameId).path + 'index.html?room=' + code + '&role=' + role + psParam();
  }
  function lobbyUrl(role, code) {
    return BASE + 'index.html?room=' + code + '&role=' + role + psParam();
  }
  function hopToGame(gameId, role, code, name) {
    saveSession({ code: code, role: role, name: name || myName(), game: gameId });
    location.href = gameUrl(gameId, role, code);
  }
  function hopToLobby(role, code, name) {
    saveSession({ code: code, role: role, name: name || myName(), game: 'lobby' });
    location.href = lobbyUrl(role, code);
  }

  /* ---------- game-page glue: wrap the game's own net functions ---------- */

  function currentCode() {
    return (window.net && window.net.roomCode) || (loadSession() || {}).code || '';
  }

  function installGameHooks() {
    var gameId = window.__V21_GAME__;

    // Host side: a probe from a landing-page joiner (a late arrival hitting the
    // invite link while we're mid-game) is answered with "we're in <game>" and
    // closed — never seated here. Plain in-game hellos are untouched.
    if (typeof window.handleGuestMsg === 'function') {
      var origGuestMsg = window.handleGuestMsg;
      window.handleGuestMsg = function (conn, d) {
        if (V21.switching) return; // mid-hop teardown — don't seat late arrivals onto a dying host
        if (d && typeof d === 'object' && d.type === 'hello' && d.lobby) {
          try { conn.send({ type: 'switch', game: gameId }); } catch (e) { /* dead conn */ }
          setTimeout(function () { try { conn.close(); } catch (e) {} }, 400);
          return;
        }
        return origGuestMsg.apply(this, arguments);
      };
    }

    // Guest side: a {switch} from the host means the table is moving — follow.
    if (typeof window.handleHostMsg === 'function') {
      var origHostMsg = window.handleHostMsg;
      window.handleHostMsg = function (d) {
        if (d && typeof d === 'object' && d.type === 'switch') {
          V21.switching = true; // expected navigation — suppress the "lost host" UI
          var code = currentCode();
          if (d.game === 'lobby') hopToLobby('guest', code);
          else hopToGame(d.game, 'guest', code);
          return;
        }
        return origHostMsg.apply(this, arguments);
      };
    }

    // Guest side: distinguish the host navigating us (expected) from the host
    // actually vanishing (tab closed). Only the latter gets the session-over UI,
    // plus a link back to the room in case the host is just refreshing.
    if (typeof window.hostLost === 'function') {
      var origHostLost = window.hostLost;
      window.hostLost = function () {
        if (V21.switching) return;
        origHostLost.apply(this, arguments);
        showReturnLink();
      };
    }
  }

  function showReturnLink() {
    if (document.getElementById('v21-return')) return;
    var code = currentCode();
    var a = document.createElement('a');
    a.id = 'v21-return';
    a.href = BASE + 'index.html' + (code ? '?join=' + code : '');
    a.textContent = 'Return to the game room';
    a.style.cssText = 'position:fixed;left:50%;bottom:18px;transform:translateX(-50%);z-index:50;' +
      'background:var(--gold,#d9973f);color:#1a140b;font:inherit;font-size:13px;font-weight:700;' +
      'letter-spacing:1px;text-decoration:none;padding:9px 18px;border-radius:9px;' +
      'box-shadow:0 6px 24px rgba(0,0,0,0.5)';
    document.body.appendChild(a);
  }

  /* ---------- host-only in-game switch menu ---------- */

  function connectedGuestCount() {
    var seats = window.__V21_seats || [];
    var n = 0;
    for (var i = 0; i < seats.length; i++) if (seats[i] && seats[i].remote) n++;
    return n;
  }

  function installSwitchMenu() {
    var bar = document.querySelector('.small-btns');
    if (!bar || document.getElementById('btn-switch')) return;
    var btn = document.createElement('button');
    btn.id = 'btn-switch';
    btn.type = 'button';
    btn.textContent = 'Switch game';
    btn.style.display = 'none';
    btn.addEventListener('click', openSwitchMenu);
    // sit it right after "More games"
    if (bar.firstChild) bar.insertBefore(btn, bar.firstChild.nextSibling);
    else bar.appendChild(btn);
    // the host role is only known once hostRoom() has run; poll to reveal it
    setInterval(function () {
      btn.style.display = (window.net && window.net.mode === 'host') ? '' : 'none';
    }, 1000);
  }

  function openSwitchMenu() {
    if (!(window.net && window.net.mode === 'host')) return;
    closeSwitchMenu();
    var code = window.net.roomCode;
    var guests = connectedGuestCount();
    var cur = window.__V21_GAME__;

    var back = document.createElement('div');
    back.id = 'v21-switch';
    back.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.75);display:flex;' +
      'align-items:center;justify-content:center;z-index:60;padding:16px';

    var panel = document.createElement('div');
    panel.style.cssText = 'background:var(--felt-dark,#191f14);border:1px solid var(--gold,#d9973f);' +
      'border-radius:14px;padding:22px 24px;max-width:360px;width:100%;text-align:center;' +
      'box-shadow:0 10px 40px rgba(0,0,0,0.6);max-height:88vh;overflow:auto';
    panel.innerHTML = '<h2 style="color:var(--gold,#d9973f);font-size:18px;letter-spacing:1px;' +
      'margin:0 0 6px">Switch the table</h2><p style="font-size:12.5px;opacity:0.85;margin:0 0 14px">' +
      'Everyone at the table moves with you. The current game ends for the whole room.</p>';

    var list = document.createElement('div');
    list.style.cssText = 'display:flex;flex-direction:column;gap:8px';

    function row(label, sub, disabled, onGo) {
      var b = document.createElement('button');
      b.type = 'button';
      b.disabled = !!disabled;
      b.style.cssText = 'font:inherit;text-align:left;padding:10px 12px;border-radius:9px;' +
        'border:1px solid rgba(217,151,63,0.4);background:rgba(0,0,0,0.35);color:var(--cream,#e6d9b8);' +
        'cursor:pointer' + (disabled ? ';opacity:0.4;cursor:not-allowed' : '');
      b.innerHTML = '<span style="letter-spacing:1px">' + label + '</span>' +
        (sub ? '<span style="display:block;font-size:11px;opacity:0.7;margin-top:2px">' + sub + '</span>' : '');
      if (!disabled) b.addEventListener('click', onGo);
      list.appendChild(b);
      return b;
    }

    for (var i = 0; i < GAMES.length; i++) {
      (function (g) {
        if (g.id === cur) return;
        var tooBig = g.cap < guests;
        var sub = tooBig
          ? (g.cap === 1 ? '1v1 only — too many players in the room' : 'Seats ' + g.cap + ' — too many players in the room')
          : '';
        row(g.icon + '  ' + g.title, sub, tooBig, function () { doSwitch(g.id, 'host', code); });
      })(GAMES[i]);
    }
    row('←  Back to the game room', 'Return to the lobby and pick from there', false,
      function () { doSwitchLobby('host', code); });

    var cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.textContent = 'Cancel';
    cancel.style.cssText = 'font:inherit;margin-top:14px;padding:8px 18px;border-radius:8px;' +
      'border:1px solid rgba(217,151,63,0.5);background:transparent;color:var(--cream,#e6d9b8);cursor:pointer';
    cancel.addEventListener('click', closeSwitchMenu);

    panel.appendChild(list);
    panel.appendChild(cancel);
    back.appendChild(panel);
    back.addEventListener('click', function (e) { if (e.target === back) closeSwitchMenu(); });
    document.body.appendChild(back);
  }

  function closeSwitchMenu() {
    var el = document.getElementById('v21-switch');
    if (el) el.parentNode.removeChild(el);
  }

  function doSwitch(gameId, role, code) {
    var g = gameById(gameId);
    if (!confirm('Move everyone to ' + g.title + '? The current game ends for the whole table.')) return;
    closeSwitchMenu();
    performHop(function () {
      window.netBroadcast({ type: 'switch', game: gameId });
      saveSession({ code: code, role: role, name: myName(), game: gameId });
      return gameUrl(gameId, role, code);
    });
  }
  function doSwitchLobby(role, code) {
    if (!confirm('Move everyone back to the game room? The current game ends for the whole table.')) return;
    closeSwitchMenu();
    performHop(function () {
      window.netBroadcast({ type: 'switch', game: 'lobby' });
      saveSession({ code: code, role: role, name: myName(), game: 'lobby' });
      return lobbyUrl(role, code);
    });
  }
  // broadcast, let the message flush, tear down the host peer, then navigate
  function performHop(build) {
    V21.switching = true; // stop seating new joiners on this soon-to-die host
    var url = build();
    setTimeout(function () {
      try { if (window.net && window.net.peer) window.net.peer.destroy(); } catch (e) { /* already gone */ }
      location.href = url;
    }, 400);
  }

  /* ---------- boot glue for a game page opened with room params ---------- */

  function bootGamePage() {
    installGameHooks();
    installSwitchMenu();

    var q = new URLSearchParams(location.search);
    var room = q.get('room');
    if (!room) return; // solo / legacy ?join: hands stay off, game behaves as before
    room = room.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
    if (room.length !== 6) return;
    var role = q.get('role') === 'host' ? 'host' : 'guest';
    var name = (loadSession() || {}).name || '';

    if (role === 'host') {
      var p = window.__V21_host;
      if (p && name) p.name = name;
      // a host refresh re-runs this with the same code, so it just re-hosts
      if (typeof window.hostRoom === 'function') window.hostRoom(room);
    } else {
      // reuse the game's own join pipeline (retries, status messages and all)
      if (typeof window.showOverlay === 'function') window.showOverlay('join', room);
      var nameInput = document.getElementById('overlay-name');
      if (nameInput && name) nameInput.value = name;
      var go = document.getElementById('overlay-go');
      if (go) go.click();
    }
  }

  /* ---------- public surface (the landing-page lobby drives itself) ---------- */

  var V21 = window.V21 = {
    GAMES: GAMES,
    PREFIX: PREFIX,
    _token: null,
    switching: false,
    peerId: peerId,
    makeRoomPeer: makeRoomPeer,
    randCode: randCode,
    saveSession: saveSession,
    loadSession: loadSession,
    clearSession: clearSession,
    psParam: psParam,
    psValue: psValue,
    myName: myName,
    gameById: gameById,
    gameUrl: gameUrl,
    lobbyUrl: lobbyUrl,
    hopToGame: hopToGame,
    hopToLobby: hopToLobby,
  };

  if (IN_GAME) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bootGamePage);
    else bootGamePage();
  }
})();

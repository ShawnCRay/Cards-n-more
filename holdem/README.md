# Vault 21 Texas Hold'em

A single-file, ad-free No-Limit Texas Hold'em table in the same post-war
casino skin as the rest of the game room. Open `index.html` in any browser —
no build step, no dependencies, works fully offline.

## The game

Standard **No-Limit Texas Hold'em**. Each player gets two private **hole
cards**; five **community cards** come out face-up — the flop (3), the turn
(1), and the river (1). Make your best five-card hand from your seven.

Betting goes around after the hole cards and after each community street:
**check**, **call**, **bet/raise** (any amount up to your whole stack), or
**fold**. The two seats left of the dealer button post the small and big
blind. If everyone folds to one player they take the pot; otherwise it's a
**showdown** and the best hand wins. Ties split, and all-ins create side pots
(fully supported).

Hand ranking, high to low: Straight Flush · Four of a Kind · Full House ·
Flush · Straight · Three of a Kind · Two Pair · Pair · High Card.

It's a **cash table**: everyone starts with **1,000 caps**, blinds
**10/20**, and you top back up to 1,000 whenever you bust. Solo you play
three-handed against **Cass** (tight, plays the odds) and **Boone** (likes to
bluff); the table seats up to **six**. Hands won are tracked per device via
`localStorage`.

## Multiplayer

Tap **Play with friends** to open a table, then share the invite link or read
out the **table code** (friends type it via **Join with code**). Up to five
friends grab the open seats or take over Cass and Boone. The host's browser
runs the authoritative game, and each player's hole cards are sent only to
them — no one can see another player's cards until showdown. Uses the same
peer-to-peer layer as the other games (session-token reconnect, host-freeze
watchdog, guest auto-retry, screen wake lock, TURN relay fallback), with a 45s
per-turn timeout that checks or folds by default so a disconnected player
never stalls the table.

## Files

- `index.html` — the whole game (markup, CSS, JS, poker engine, and 7-card
  hand evaluator in one file).
- `peerjs.min.js` — vendored PeerJS for the WebRTC handshake. If it's missing,
  the game still runs solo; the multiplayer buttons just hide themselves.

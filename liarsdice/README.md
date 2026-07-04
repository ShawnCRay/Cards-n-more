# Vault 21 Liar's Dice

A single-file, ad-free Liar's Dice table in the same post-war casino skin as
the rest of the game room. Open `index.html` in any browser — no build step,
no dependencies, works fully offline.

## The game

Every player starts with **five dice under a cup**, rolled in secret — you
only ever see your own until someone gets called out. **1s are wild** (a 1
counts as any face), so all bidding is on the faces **2 through 6**.

On your turn you must either:

- **Raise the bid** — a bid guesses about *all* the dice on the table, e.g.
  "three fives" means at least three dice show a 5 (counting wild 1s) across
  everyone's cups. Each new bid must be higher: more dice, or the same many at
  a higher face.
- **Call liar** — you think the last bid is a bluff. Every cup lifts and that
  face is counted, plus every wild 1.

If the bid was **true**, the **caller** loses a die; if it was a **bluff**, the
**bidder** loses one. Lose your last die and you're out. **Last cup standing
wins.** Wins are tracked per device via `localStorage`.

Solo you play three-handed against **Cass** (plays the odds) and **Boone**
(bluffs more than he should). A game seats up to **six cups**.

## Multiplayer

Tap **Play with friends** to open a table, then share the invite link or read
out the **table code** (friends can type it via **Join with code**). Up to five
friends grab the open seats or take over Cass and Boone. The host's browser
runs the authoritative game; each player's dice are sent only to them, so no
one can peek at another cup. It uses the same peer-to-peer layer as the other
games (session-token reconnect, host-freeze watchdog, guest auto-retry, screen
wake lock, TURN relay fallback), with a 45s per-turn timeout that calls by
default so a disconnected player never stalls the table.

## Files

- `index.html` — the whole game (markup, CSS, and JS in one file).
- `peerjs.min.js` — vendored PeerJS for the WebRTC handshake. If it's missing,
  the game still runs solo; the multiplayer buttons just hide themselves.

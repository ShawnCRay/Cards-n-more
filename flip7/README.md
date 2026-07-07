# Vault 21 Flip 7

A single-file, ad-free Flip 7 table in the same post-war casino skin as the
blackjack room next door. Open `index.html` in any browser — no build step,
no dependencies, works fully offline.

## The game

Push your luck against Cass and Boone (CPU players who play the odds). Each
round you Hit to flip number cards onto your row or Stay to bank what's
showing. Flip a duplicate number and you bust for the round. Land **seven
unique numbers** and the round ends instantly with a **+15 bonus**. First to
**200 points** wins.

The deck (94 cards): a single 0 and 1, two 2s, three 3s … twelve 12s, plus
+2/+4/+6/+8/+10 and ×2 modifiers, and three each of Freeze (target banks and
sits out), Flip Three (target must flip three in a row), and Second Chance
(your next duplicate is discarded instead of busting you).

Wins are tracked per device via `localStorage`. Keyboard: **H**it, **S**tay.
"How to play" in the footer covers the rules in plain English.

## With a Vengeance

An optional mode picked before round 1 (the host chooses it; once the first
card is dealt it's locked for the whole game — "New game" lets you choose
again). The deck grows to 108 cards, numbers run to **13**, and every safety
net is gone — no Freeze, Flip Three or Second Chance. Instead:

- **−2/−4/−6/−8/−10** — handed to any player still standing (stayed players
  included); subtracts at scoring. Round scores never drop below zero.
- **÷2** — handed to anyone still standing; halves their number-card points
  (rounded up).
- **Flip Four** (×2) — a player still in must flip four in a row.
- **Just One More** (×2) — a player still in flips one card, then must stay.
- **Steal** (×2) — take the best number card you can use from another
  player's row; it can even complete your Flip 7.
- **Swap** (×2) — pick two players; their biggest numbers trade places, and a
  duplicate busts on arrival.
- **Discard** (×2) — a player of your choice loses their biggest number.
- **Unlucky 7** — the seventh 7. Flip it and your row burns: numbers and
  modifiers gone, only that 7 remains.
- **Lucky 13** — the thirteenth 13. Never busts, coexists with a regular 13,
  and counts toward your seven.
- **The 0** is cursed: while it's showing you score nothing that round unless
  you Flip 7.

## Playing with friends

Same setup as the blackjack room: tap **Play with friends**, pick a name, and
send the invite link. Up to five friends join — open seats first, then they
take over Cass or Boone (inheriting the CPU's score mid-game, which can be a
gift or a curse). Freeze and Flip Three prompt their holder to pick a target,
so grudges are fully supported. A player who takes too long (45s) auto-stays;
leavers hand their seat back to the CPU or leave it open. The host's browser
runs the game; guests connect peer-to-peer (vendored PeerJS, broker for the
handshake only), with the same reconnect/wake-lock hardening as blackjack.

## Structure

Everything is in `index.html` — markup, CSS (shared wasteland theme), and
game logic in one file, plus a vendored `peerjs.min.js` for multiplayer
(the game works without it; the button just hides). The CPU push-your-luck heuristic lives in
`aiWantsHit()` if you want to make Cass braver.

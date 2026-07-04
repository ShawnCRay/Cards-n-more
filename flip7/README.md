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

# Vault 21 Uno

A single-file, ad-free Uno table in the game room's post-war casino skin.
Open `index.html` in any browser — no build step, works fully offline.

## The game

Classic 108-card rules against Cass and Boone (or your friends): match the
top of the discard by color or number/symbol, or play a wild. Skips,
reverses, +2s; wilds pick the color; Wild +4 hits the next player for four
(house rule: playable any time, no challenges). Can't play? Draw one — if
it's playable you may play it immediately. First to empty their hand takes
the round and scores everyone else's cards (numbers face value, actions 20,
wilds 50). First to 500 wins. UNO calls are automatic — no penalties, just
the dread.

## Playing with friends

Same invite-link multiplayer as the other tables — up to five friends fill
the open seats or take over the CPUs. Uno adds hidden hands: the host's
browser runs the game and sends each player a private view (your cards, only
counts for everyone else), so nobody can peek. 45s turn timeout auto-draws;
a mid-round leaver's hand is played out by the book so the round finishes.

## Structure

Everything is in `index.html`; `peerjs.min.js` is the vendored multiplayer
transport (the game works without it — the button just hides). CPU play
lives in `aiChoose()`: hold wilds, spend the pain cards on whoever is low.

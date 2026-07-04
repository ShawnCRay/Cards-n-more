# Vault 21 Caravan

The card game from Fallout: New Vegas, single-file in the game room's
post-war skin. Open `index.html` in any browser — no build step, offline-
capable. Fan implementation of the published rules; no game assets copied.

## The game

One on one (you vs Cass, or a friend over an invite link). Each player runs
a 54-card deck and builds three caravans facing the opponent's. Sell a
caravan by landing it between 21 and 26; the higher sold caravan takes the
track; take two of three tracks to win.

Number cards extend your own caravans — after the second card the caravan
has a direction, and each card must follow it unless it matches the previous
card's suit (which bends the direction). Equal values never stack. Face
cards play onto anyone's cards: Jack removes a card, Queen (on the last
card) reverses direction and changes suit, King doubles a card (stacking),
Joker on an ace burns every other card of that suit table-wide, on a number
burns every other card of that value. Over 26 is a bust — fix it or disband.
Run out of cards entirely and you forfeit.

Opening: your first three plays must each start a caravan with a number
card. You draw back up to five cards after each turn.

## Multiplayer

1v1 over the same peer-to-peer layer as the other tables, with private
views — you only ever see your rival's card count. If they leave, Cass
plays out the match.

## Structure

Everything is in `index.html`; `peerjs.min.js` is the vendored multiplayer
transport. The CPU's route smarts live in `aiChoose()` — she values selling
tracks, jacks your sold caravans, and isn't above kinging your ten to shove
you over 26.

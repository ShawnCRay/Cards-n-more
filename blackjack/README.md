# Blackjack

A single-file, ad-free blackjack simulator. Open `index.html` in any browser —
no build step, no dependencies, no network calls, nothing tracked or served
from anywhere.

## The game

You sit at a three-seat table between two CPU players (Ruby and Max) who play
textbook basic strategy with their own bankrolls. Real casino rules and odds:

- 6-deck shoe, reshuffled at 75% penetration (cut card)
- Blackjack pays 3:2, dealer stands on all 17s
- Dealer peeks for blackjack on an ace or ten up
- Double on any first two cards, double after split allowed
- Split up to 4 hands; split aces get one card each
- Late surrender; insurance pays 2:1 (offered when the dealer shows an ace)

## Chips and stats

Your bankroll and session stats (hands, W–L–P, blackjacks, net) persist in the
browser via `localStorage`, so they survive closing the tab. Buttons in the
footer reset stats or the bankroll; a buy-in button appears if you go broke.
Table stakes are $5–$1,000, bet with chip buttons ($5/$25/$100/$500) or Rebet.

Keyboard shortcuts while playing a hand: **H**it, **S**tand, **D**ouble,
s**P**lit, su**R**render.

## Structure

Everything is in `index.html` — markup, CSS, and game logic in one file. The
basic-strategy table the CPUs use (and the house rules above) are implemented
at the top of the script block if you want to tweak rules like number of decks,
penetration, or table limits.

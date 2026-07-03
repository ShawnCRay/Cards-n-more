# Blackjack

A single-file, ad-free blackjack simulator. Open `index.html` in any browser —
no build step, no accounts, nothing tracked. Solo play works fully offline;
optional multiplayer connects browsers directly to each other.

## The game

You sit at a three-seat table between two CPU players (Ruby and Max) who play
textbook basic strategy with their own bankrolls. Real casino rules and odds:

- Configurable shoe: 1, 2, 4, 6, or 8 decks (footer selector, host's choice
  at a multiplayer table), reshuffled at 75% penetration — the top-bar shoe
  meter drains as cards go and the red tick marks the cut card
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

## Learning the game

Two opt-in helpers live in the footer for players new to blackjack:

- **How to play** opens a plain-English primer: the goal, card values, what
  each button does, and the payouts.
- **Coach** (off by default, remembered per device) highlights the
  mathematically best move on your turn — the same basic-strategy chart the
  CPU players follow — and nudges you to decline insurance. Works for guests
  at a multiplayer table too.

## Playing with friends

Tap **Play with friends** (bottom of the page), pick a name, and send the
invite link it gives you. Friends who open the link just type a name and sit
down — they take over the CPU seats (chips included), up to two friends plus
the host. If someone leaves, the CPU quietly takes the seat back.

How it works: the host's browser runs the actual game (shoe, payouts, turn
order) and is the source of truth. Guests connect peer-to-peer over WebRTC
using PeerJS — the public PeerJS broker is used only for the initial
handshake; after that, game traffic flows directly between browsers. No
server of ours, no accounts, nothing stored anywhere.

Multiplayer notes:

- Bets: guests place a bet each round; the host deals when ready. Seats show
  "BET $x" / "WAITING TO BET" badges during the betting phase and the host
  gets a note naming anyone who hasn't bet, since a guest without a bet in
  sits the round out.
- A guest who takes too long on their turn (45s) auto-stands so the table
  never stalls.
- Insurance is host-only (basic strategy never takes it anyway).
- Host chip counts and stats persist as usual; guest chips live at the host's
  table for that session.

If a friend gets "no table found" even though the code is right, the host's
browser probably dropped off the signaling broker — the table lives in the
host's tab, so it must stay open with the screen on (the game requests a
screen wake lock and auto-reconnects to the broker, but a killed tab is a
closed table). If joining hangs at "Connecting…", a strict network (cellular
carrier-grade NAT, hotel/corporate wifi) may be blocking the direct path;
the game falls back to free TURN relays, but when all else fails, putting
both players on the same wifi works.

## Structure

Everything is in `index.html` — markup, CSS, and game logic in one file. The
basic-strategy table the CPUs use (and the house rules above) are implemented
at the top of the script block if you want to tweak rules like number of decks,
penetration, or table limits.

`peerjs.min.js` is a vendored copy of [PeerJS](https://peerjs.com) (MIT),
loaded by `index.html` for multiplayer. If the file is missing (e.g. you only
downloaded `index.html`), the game still works — the multiplayer button just
hides itself.

For development: automated tests can point the game at a self-hosted PeerJS
signaling server with `?ps=host:port` instead of the public broker.

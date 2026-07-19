# Vault 21 · Fallout Glory to Rome

A fan adaptation of Carl Chudyk's classic engine-building card game, single-
file in the game room's post-war skin. Open `index.html` in any browser — no
build step, offline-capable. Mechanics only, curated building list, no
assets or card text copied.

## The game

Every order card is three things: a role to lead, a material to build with,
and a building to construct. On your turn, RESEARCH (refill your hand, or take
a Mysterious Stranger) or LEAD a role; others follow or research; everyone who joined
performs the action once plus once per matching dweller. Played cards wash
into the shared wasteland that Scavengers, Recruiters, and Raiders feed on.

Roles: Scavenger (stockpile from wasteland), Recruiter (hire dwellers), Engineer
(build from hand), Overseer (build from stockpile), Raider (demand
materials from the wasteland and every rival's hand), Trader (bank stockpile
into your safe for points).

Buildings complete at materials = site value (1/2/3), grant that much
population (raising dweller and safe limits), and switch on their power.
The curated set of 19: Insula, Bar, Road, Dock, Market, Palisade, Circus,
Shrine, Atrium, Bath, Academy, Aqueduct, Wall, Tower, Villa, Scriptorium,
Statue, Temple, and the Forum — complete it with a dweller of every role and
you win instantly.

Game ends when the deck or the sites run out; population + safe decides it.
Simplifications vs the tabletop original: trimmed building list, no
out-of-town sites, no petitions, no trader majority bonus.

## Multiplayer

Two friends can take over Cass and Boone via the usual invite link. Hands
are private (per-player views); every decision travels as a labeled option
list, so remote play is identical to local. 60s timeout picks the first
option; leavers hand their seat back to the CPU.

## Structure

Everything is in `index.html`; `peerjs.min.js` is the vendored multiplayer
transport. All decisions flow through one generic `choose()` — the CPU picks
by per-option scores computed at each decision site.

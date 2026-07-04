# Vault 21 Eras of the Wasteland

An Innovation-style civilization card game with an entirely wasteland-
original card set and vocabulary, single-file in the game room's post-war
skin. Open `index.html` in any browser — no build step, offline-capable.
Mechanics in the spirit of the classic; every card, term, and instruction
is our own.

## The game

Rebuild the world across ten eras — Dust, Settlements, Trade Routes, Chems,
Firearms, Industry, Energy, Robotics, Atomics, New World — with 61 original
techs across five camp domains (WAR / CROPS / TECH / SALVAGE / CREED), each
carrying icons: ⚔ Guns, ₵ Caps, ❧ Crops, ⚛ Science, ⚙ Scrap, ☢ Rads.

Two actions per turn:
- **SCAVENGE** — draw a tech of your highest active era.
- **BUILD** — play a tech onto its domain stack (top tech is active).
- **ACTIVATE** — fire a top tech. Rivals with as many of its key icon share
  the effect (and word gets around: you scavenge free). Effects marked
  **AT GUNPOINT** instead hit every rival with fewer icons — stash caps
  surrendered, pack techs handed over, camp techs seized.
- **CLAIM LANDMARK** — stash ≥ 5× an era's value in caps, hold a tech of
  that era, bank the landmark. Five landmarks wins.

**SPREAD** effects fan a domain left/right/up, exposing extra icons on
covered techs. Stashed techs are worth their era in caps; if anyone must
scavenge past Era 10, the game ends and the richest stash wins.

## Multiplayer

Two friends take over Cass and Boone via the usual invite link. Packs are
private (per-player views); every decision travels as a labeled option
list. 60s timeout picks the first option; leavers hand their camp back.

## Structure

Everything is in `index.html`; `peerjs.min.js` is the vendored transport.
Cards are data (`CARDS`) with a small effect interpreter (`runOp` /
`runDemand`) — adding a tech is one line of data.

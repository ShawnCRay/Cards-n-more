# Cards-n-more

[Cards-n-more](https://shawncray.github.io/Cards-n-more/)

Personal collection of ad-free card games. Each game lives in its own folder
as a single self-contained `index.html` — no build step, no dependencies, no
ads. Open the file in a browser to play.

| Game | Folder | Notes |
|---|---|---|
| Blackjack | [`blackjack/`](blackjack/) | 6-deck shoe, real casino rules, CPU players, chip tracking |
| Flip 7 | [`flip7/`](flip7/) | Push your luck, number matching game — classic or With a Vengeance mode |
| Caravan | [`caravan/`](caravan/) | New Vegas caravan duel, 1v1 |
| UNO | [`uno/`](uno/) | Match color or number, hidden hands, first to 500 |
| Glory to Rome | [`rome/`](rome/) | Engine-building city game |
| Eras of the Wasteland | [`innovation/`](innovation/) | Civilization builder |
| Liar's Dice | [`liarsdice/`](liarsdice/) | Bluffing dice, last cup wins |
| Texas Hold'em | [`holdem/`](holdem/) | No-limit cash table, hidden hands |

## Off the felt

| App | Folder | Notes |
|---|---|---|
| Holotape Library | [`audiobook/`](audiobook/) | Text-to-speech audiobook reader — load any book as plain text, dialogue is traced to its characters and each gets its own voice, pitch and pace. Chapter navigation, sleep timer, adjustable speed, remembers your spot. Optional premium narration through an OpenAI API key: natural voices with per-character acting directions, generated once and cached on-device, with lock-screen controls and screen-off playback. Solo only; not part of the game room. |
| Sudoku | [`sudoku/`](sudoku/) | Classic 9×9 in four levels (Easy to Expert), graded by the solving techniques each puzzle actually needs. Hints explain the next logical move on the board, one step at a time, instead of just filling a square. Notes, undo, pause, best times, and your puzzle saves as you go. Any grid that follows the rules counts as solved. Solo only. |
| Dungeon Crawler Carl | [`dcc/`](dcc/) | Fan-made hub for the Dungeon Crawler Carl games: one game per book, each on its own console generation. Shows your Book One progress, a locked Book Two, and the archived prototype. Solo only. |
| ↳ Book One | [`crawler-book1/`](crawler-book1/) | Strictly 8-bit retelling of Book 1 only: the First and Second Floors in story order, with Ninja Gaiden-style cutscenes between stages. The Murder Dozer, the Hoarder, Tally's safe room, the goblin workshop fire, the Copper Chopper, Meadow Lark, the Juicer, the Ball of Swine, the Krakaren clone, the Rage Elemental chase, Ralph and Mongo. Book loot as gear, book achievements, an adult System AI. Keyboard, gamepad or touch. |
| ↳ Book Two | [`crawler2/`](crawler2/) | Book 2, Carl's Doomsday Scenario: the Third Floor as a late 8-bit cartridge. A walkable Over City with a day and night clock, mixed level types (chase, climb, drop, survival, plant-and-detonate, timed escape, into-the-screen Big Top, a talk show), cutscenes, and an import of your Book One save. Adult content, as in the book. |
| ↳ Prototype (archive) | [`crawler/`](crawler/) | Dungeon Crawler World, the first, much bigger take: nine floors following the in-universe floors, TMNT-style overworld maps from Floor 3, skins and companions. Kept as is, with separate saves. |

## The game room

Multiplayer is peer-to-peer (PeerJS) and works across the whole collection as
one **room**, not per game. Open the landing page (`index.html`), open a room,
and send friends the single invite link. They join the room once and wait
together; the **host** picks the game, and everyone hops into it at the same
time. The host can switch games (or head back to the room) at any point from
the in-game **Switch game** button — the whole table moves along. Only the host
chooses the game and its settings; guests follow. Playing solo is unchanged:
just open a game folder directly.


# Cards-n-more

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

## The game room

Multiplayer is peer-to-peer (PeerJS) and works across the whole collection as
one **room**, not per game. Open the landing page (`index.html`), open a room,
and send friends the single invite link. They join the room once and wait
together; the **host** picks the game, and everyone hops into it at the same
time. The host can switch games (or head back to the room) at any point from
the in-game **Switch game** button — the whole table moves along. Only the host
chooses the game and its settings; guests follow. Playing solo is unchanged:
just open a game folder directly.


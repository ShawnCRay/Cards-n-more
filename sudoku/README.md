# Vault 21 Sudoku

A single-file, ad-free sudoku in the same post-war skin as the rest of the
game room: a sheet of aged newsprint on the felt, clues printed in heavy ink,
your numbers in blue pen. Open `index.html` in any browser. No build step, no
dependencies, no accounts, works fully offline.

## The game

Fill the grid so every row, every column and every 3×3 box holds the numbers
1 to 9 exactly once. Every puzzle is generated fresh in your browser, has
exactly one solution (proved by an exhaustive solver before you see it), and
can be cracked by logic alone, so you never need to guess. Clues are removed
in mirrored pairs, so every grid has the rotational symmetry of a printed
puzzle.

Your grid is judged by the rules, not by an answer key: the moment every row,
column and box is complete and clash-free, it's solved. "Wrong" means the
same thing everywhere in the game: a number that can't be part of any valid
finished grid. No answer is stored with your game at all.

## Levels

Difficulty comes from the techniques a puzzle needs, not just its clue count.
Each new puzzle is solved the way a person would (simplest technique first)
and only kept if the hardest step it needed matches the level:

| Level | Clues | What it takes |
|---|---|---|
| Easy | 36 to 41 | Hidden singles: every number has one spot you can find by scanning |
| Medium | 30 to 34 | Naked singles: some squares only crack once you count what they can still hold |
| Hard | about 24 to 30 | Pointing pairs, box-line reductions, naked and hidden pairs and triples |
| Expert | about 25 to 30 | X-Wing, Swordfish, XY-Wing, XYZ-Wing, naked and hidden quads |

## Hints

A hint finds the next move a person would make and explains it, in three
taps:

1. **Hint**: a nudge toward where to look ("Look at the center box: one digit
   has only one place it can go.")
2. **Show me**: the reasoning, drawn on the board. Candidates that matter
   glow green, the ones being ruled out are struck through in red. When a
   move takes a chain of deductions, it steps through them one at a time.
3. **Fill it in**: places the number.

If you've put down a number that can't be part of any finished grid, the hint
points that out first and offers to clear it. Hints are unlimited; best times
only count puzzles solved without one.

## Playing

- Tap a square, then a number. Clashes in a row, column or box turn red.
- **Notes** switches the pad to pencil marks, **Fill notes** pencils in every
  possibility, **Erase** clears a square, and **Undo** goes back as far as you
  like.
- Tap the clock to pause. It also stops while a dialog is open or you're away
  from the page.
- **Settings**: flag wrong numbers as you go, highlight matching numbers,
  shade the selected row, column and box, auto-clear notes.
- Keyboard: `1`-`9` fill in, `Shift`+number pencils a note, arrows move,
  `Backspace` erases, `N` notes, `H` hint, `U` or `Ctrl`+`Z` undo, `P` pause.

The puzzle in progress, your settings and per-level stats (solved, hint-free
solves, best and average time) are kept in `localStorage`, on your device
only. Close the tab mid-puzzle and it's waiting when you come back.

## Files

- `index.html`: the whole game (markup, CSS, and JS in one file). The puzzle
  engine (generator, grader, hint finder) sits between the `CORE:BEGIN` and
  `CORE:END` markers and never touches the page, so it can be tested on its
  own.

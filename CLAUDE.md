# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A standard 9×9 Sudoku game built with plain HTML, CSS, and vanilla JavaScript. No
framework, no build step, no dependencies. The game runs by opening `index.html`
directly in a browser.

## Running

There is nothing to build, lint, or install. To preview during development, serve
the folder statically (needed so the browser loads the JS modules over HTTP):

```
python -m http.server 8123
```

then open `http://localhost:8123/index.html`. A ready-made config for the Claude
Code preview server lives in `.claude/launch.json` (server name: `sudoku`).

There is no test suite. Logic is verified by exercising it in the browser — see
the "Verifying" note below.

## Architecture

Three scripts, loaded in order from `index.html` (`sudoku.js` before `app.js`):

- **`js/sudoku.js`** — pure puzzle logic, **no DOM access**. Exposes everything on
  the global `window.Sudoku`. Key functions:
  - `generateSolved()` — randomized backtracking fill of a complete grid.
  - `countSolutions(grid, limit)` — backtracking solver that short-circuits once
    `limit` solutions are found; used to guarantee uniqueness.
  - `generatePuzzle(difficulty)` — starts from a solved grid and removes cells one
    at a time, keeping a removal only if `countSolutions` stays at exactly 1.
    Returns `{ puzzle, solution }`. Difficulty maps to a clue target via
    `CLUE_TARGETS` (easy 45 / medium 34 / hard 28).
  - Grids are `9×9` arrays of arrays; `0` means empty.

- **`js/app.js`** — all DOM, state, and interaction, wrapped in an IIFE so nothing
  leaks to the global scope. A single `state` object holds the game; a single
  `render()` function reconciles the 81 pre-built cell elements against `state`
  (full re-render on every change — there is no diffing). `notes` is a `9×9` grid
  of `Set`s of pencil-mark candidates.

- **`css/styles.css`** — board is a CSS grid; 3×3 box separators come from
  thicker borders on cells with specific `data-col`/`data-row` values. Cell
  appearance is driven entirely by classes that `render()` toggles: `given`,
  `selected`, `peer`, `same-number`, `conflict`, plus a nested `.notes` mini-grid.

### Key design points

- **Logic/UI separation is deliberate** — keep generation and solving in
  `sudoku.js` as pure functions; keep all rendering and event handling in
  `app.js`. Don't reach into the DOM from `sudoku.js`.
- **`render()` is the single source of UI truth.** To change what the board shows,
  mutate `state` and call `render()` rather than touching cell elements directly.
- **Mistake counting vs. conflict highlighting are different things.** Conflicts
  (`computeConflicts`) are duplicate values within a row/col/box and are purely
  visual. A "mistake" is counted only when a committed value differs from
  `state.solution` at placement time.
- **Heavy work happens on New Game.** `generatePuzzle` (especially Hard) runs
  repeated `countSolutions` passes; it's the one compute-bound moment.

## Verifying

Since there are no tests, validate changes in the browser. The pure functions on
`window.Sudoku` can be exercised directly from the devtools/preview console — e.g.
generate a puzzle and assert `countSolutions(puzzle, 3) === 1` to confirm
uniqueness, or count non-zero clues to confirm difficulty targets.

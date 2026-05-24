// Pure Sudoku logic — no DOM access.
// Grids are 9x9 arrays of arrays; 0 means empty.

const SIZE = 9;
const BOX = 3;

function deepCopy(grid) {
  return grid.map((row) => row.slice());
}

function emptyGrid() {
  return Array.from({ length: SIZE }, () => new Array(SIZE).fill(0));
}

// Can `val` go at (r, c) without breaking row/col/box constraints?
function isValidPlacement(grid, r, c, val) {
  for (let i = 0; i < SIZE; i++) {
    if (grid[r][i] === val) return false;
    if (grid[i][c] === val) return false;
  }
  const br = Math.floor(r / BOX) * BOX;
  const bc = Math.floor(c / BOX) * BOX;
  for (let i = 0; i < BOX; i++) {
    for (let j = 0; j < BOX; j++) {
      if (grid[br + i][bc + j] === val) return false;
    }
  }
  return true;
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Fill an empty grid with a random valid complete solution.
function generateSolved() {
  const grid = emptyGrid();
  fillGrid(grid);
  return grid;
}

function fillGrid(grid) {
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (grid[r][c] !== 0) continue;
      const candidates = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9]);
      for (const val of candidates) {
        if (isValidPlacement(grid, r, c, val)) {
          grid[r][c] = val;
          if (fillGrid(grid)) return true;
          grid[r][c] = 0;
        }
      }
      return false; // no candidate worked — backtrack
    }
  }
  return true; // no empty cells left — solved
}

// Count solutions, stopping early once `limit` is reached.
function countSolutions(grid, limit = 2) {
  const work = deepCopy(grid);
  let count = 0;

  function solve() {
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        if (work[r][c] !== 0) continue;
        for (let val = 1; val <= SIZE; val++) {
          if (isValidPlacement(work, r, c, val)) {
            work[r][c] = val;
            solve();
            work[r][c] = 0;
            if (count >= limit) return;
          }
        }
        return; // this empty cell had no further options
      }
    }
    count++; // reached a full grid
  }

  solve();
  return count;
}

// Approximate number of clues left in the finished puzzle per difficulty.
const CLUE_TARGETS = { easy: 45, medium: 34, hard: 28 };

// Build a puzzle by digging cells out of a solved grid while keeping a unique
// solution. Returns { puzzle, solution }.
function generatePuzzle(difficulty = "easy") {
  const solution = generateSolved();
  const puzzle = deepCopy(solution);
  const target = CLUE_TARGETS[difficulty] ?? CLUE_TARGETS.easy;

  const cells = shuffle(
    Array.from({ length: SIZE * SIZE }, (_, i) => i)
  );

  let clues = SIZE * SIZE;
  for (const idx of cells) {
    if (clues <= target) break;
    const r = Math.floor(idx / SIZE);
    const c = idx % SIZE;
    const backup = puzzle[r][c];
    if (backup === 0) continue;

    puzzle[r][c] = 0;
    if (countSolutions(puzzle, 2) !== 1) {
      puzzle[r][c] = backup; // removing it broke uniqueness — keep it
    } else {
      clues--;
    }
  }

  return { puzzle, solution };
}

window.Sudoku = {
  SIZE,
  BOX,
  deepCopy,
  isValidPlacement,
  generateSolved,
  countSolutions,
  generatePuzzle,
};

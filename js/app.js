(function () {
  const { SIZE, generatePuzzle } = window.Sudoku;

  // --- DOM refs ---
  const boardEl = document.getElementById("board");
  const timerEl = document.getElementById("timer");
  const mistakesEl = document.getElementById("mistakes");
  const hintsEl = document.getElementById("hints");
  const difficultyEl = document.getElementById("difficulty");
  const newGameBtn = document.getElementById("new-game");
  const notesToggleBtn = document.getElementById("notes-toggle");
  const notesStateEl = document.getElementById("notes-state");
  const eraseBtn = document.getElementById("erase");
  const hintBtn = document.getElementById("hint");
  const overlayEl = document.getElementById("overlay");
  const overlayStatsEl = document.getElementById("overlay-stats");
  const overlayNewBtn = document.getElementById("overlay-new");

  // --- State ---
  const state = {
    solution: null,
    givens: null,
    current: null,
    notes: null,
    selected: null, // { r, c }
    difficulty: "easy",
    mistakes: 0,
    hintsUsed: 0,
    notesMode: false,
    elapsed: 0,
    timerId: null,
    solved: false,
  };

  const cells = []; // cells[r][c] -> element

  // --- Setup: build the 81 cell elements once ---
  function buildBoard() {
    boardEl.innerHTML = "";
    for (let r = 0; r < SIZE; r++) {
      cells[r] = [];
      for (let c = 0; c < SIZE; c++) {
        const cell = document.createElement("div");
        cell.className = "cell";
        cell.dataset.row = r;
        cell.dataset.col = c;
        cell.addEventListener("click", () => selectCell(r, c));
        boardEl.appendChild(cell);
        cells[r][c] = cell;
      }
    }
  }

  // --- New game ---
  function newGame() {
    state.difficulty = difficultyEl.value;
    const { puzzle, solution } = generatePuzzle(state.difficulty);
    state.solution = solution;
    state.current = puzzle.map((row) => row.slice());
    state.givens = puzzle.map((row) => row.map((v) => v !== 0));
    state.notes = Array.from({ length: SIZE }, () =>
      Array.from({ length: SIZE }, () => new Set())
    );
    state.selected = null;
    state.mistakes = 0;
    state.hintsUsed = 0;
    state.solved = false;
    setNotesMode(false);
    overlayEl.classList.add("hidden");
    resetTimer();
    startTimer();
    render();
  }

  // --- Timer ---
  function resetTimer() {
    stopTimer();
    state.elapsed = 0;
    timerEl.textContent = formatTime(0);
  }

  function startTimer() {
    state.timerId = setInterval(() => {
      state.elapsed++;
      timerEl.textContent = formatTime(state.elapsed);
    }, 1000);
  }

  function stopTimer() {
    if (state.timerId) {
      clearInterval(state.timerId);
      state.timerId = null;
    }
  }

  function formatTime(total) {
    const m = String(Math.floor(total / 60)).padStart(2, "0");
    const s = String(total % 60).padStart(2, "0");
    return `${m}:${s}`;
  }

  // --- Selection ---
  function selectCell(r, c) {
    state.selected = { r, c };
    render();
  }

  function moveSelection(dr, dc) {
    if (!state.selected) {
      state.selected = { r: 0, c: 0 };
    } else {
      const r = Math.min(SIZE - 1, Math.max(0, state.selected.r + dr));
      const c = Math.min(SIZE - 1, Math.max(0, state.selected.c + dc));
      state.selected = { r, c };
    }
    render();
  }

  // --- Notes mode ---
  function setNotesMode(on) {
    state.notesMode = on;
    notesToggleBtn.setAttribute("aria-pressed", String(on));
    notesStateEl.textContent = on ? "On" : "Off";
  }

  // --- Input actions ---
  function inputNumber(num) {
    if (state.solved || !state.selected) return;
    const { r, c } = state.selected;
    if (state.givens[r][c]) return;

    if (state.notesMode) {
      const set = state.notes[r][c];
      if (set.has(num)) set.delete(num);
      else set.add(num);
      // Notes only make sense when the cell has no committed value.
      state.current[r][c] = 0;
    } else {
      state.current[r][c] = num;
      state.notes[r][c].clear();
      if (num !== state.solution[r][c]) {
        state.mistakes++;
      } else {
        clearPeerNotes(r, c, num);
      }
    }
    render();
    checkWin();
  }

  function eraseCell() {
    if (state.solved || !state.selected) return;
    const { r, c } = state.selected;
    if (state.givens[r][c]) return;
    state.current[r][c] = 0;
    state.notes[r][c].clear();
    render();
  }

  function giveHint() {
    if (state.solved) return;
    let target = null;
    const { selected } = state;
    if (selected && !state.givens[selected.r][selected.c] &&
        state.current[selected.r][selected.c] !== state.solution[selected.r][selected.c]) {
      target = selected;
    } else {
      const empties = [];
      for (let r = 0; r < SIZE; r++) {
        for (let c = 0; c < SIZE; c++) {
          if (state.current[r][c] !== state.solution[r][c]) empties.push({ r, c });
        }
      }
      if (empties.length === 0) return;
      target = empties[Math.floor(Math.random() * empties.length)];
    }
    const { r, c } = target;
    state.current[r][c] = state.solution[r][c];
    state.notes[r][c].clear();
    clearPeerNotes(r, c, state.solution[r][c]);
    state.hintsUsed++;
    state.selected = { r, c };
    render();
    checkWin();
  }

  // Remove `num` from notes of peers (same row, col, box).
  function clearPeerNotes(r, c, num) {
    for (let i = 0; i < SIZE; i++) {
      state.notes[r][i].delete(num);
      state.notes[i][c].delete(num);
    }
    const br = Math.floor(r / 3) * 3;
    const bc = Math.floor(c / 3) * 3;
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        state.notes[br + i][bc + j].delete(num);
      }
    }
  }

  // --- Conflict detection: cells whose value duplicates a peer's value ---
  function computeConflicts() {
    const conflict = Array.from({ length: SIZE }, () =>
      new Array(SIZE).fill(false)
    );
    const g = state.current;

    const mark = (group) => {
      const seen = new Map();
      for (const [r, c] of group) {
        const v = g[r][c];
        if (v === 0) continue;
        if (seen.has(v)) {
          conflict[r][c] = true;
          const [pr, pc] = seen.get(v);
          conflict[pr][pc] = true;
        } else {
          seen.set(v, [r, c]);
        }
      }
    };

    for (let r = 0; r < SIZE; r++) {
      mark(Array.from({ length: SIZE }, (_, c) => [r, c]));
    }
    for (let c = 0; c < SIZE; c++) {
      mark(Array.from({ length: SIZE }, (_, r) => [r, c]));
    }
    for (let br = 0; br < SIZE; br += 3) {
      for (let bc = 0; bc < SIZE; bc += 3) {
        const group = [];
        for (let i = 0; i < 3; i++)
          for (let j = 0; j < 3; j++) group.push([br + i, bc + j]);
        mark(group);
      }
    }
    return conflict;
  }

  // --- Render ---
  function render() {
    mistakesEl.textContent = state.mistakes;
    hintsEl.textContent = state.hintsUsed;

    const conflicts = computeConflicts();
    const sel = state.selected;
    const selVal = sel ? state.current[sel.r][sel.c] : 0;

    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        const cell = cells[r][c];
        const val = state.current[r][c];
        cell.className = "cell";

        // Content: value, notes, or empty.
        if (val !== 0) {
          cell.textContent = val;
        } else if (state.notes[r][c].size > 0) {
          cell.innerHTML = renderNotes(state.notes[r][c]);
        } else {
          cell.textContent = "";
        }

        if (state.givens[r][c]) cell.classList.add("given");

        // Peer / same-number highlighting relative to selection.
        if (sel) {
          const samePeer =
            r === sel.r ||
            c === sel.c ||
            (Math.floor(r / 3) === Math.floor(sel.r / 3) &&
              Math.floor(c / 3) === Math.floor(sel.c / 3));
          if (samePeer && !(r === sel.r && c === sel.c)) {
            cell.classList.add("peer");
          }
          if (selVal !== 0 && val === selVal && !(r === sel.r && c === sel.c)) {
            cell.classList.add("same-number");
          }
        }

        if (conflicts[r][c]) cell.classList.add("conflict");
        if (sel && sel.r === r && sel.c === c) cell.classList.add("selected");
      }
    }
  }

  function renderNotes(set) {
    let html = '<div class="notes">';
    for (let n = 1; n <= 9; n++) {
      html += `<span>${set.has(n) ? n : ""}</span>`;
    }
    return html + "</div>";
  }

  // --- Win check ---
  function checkWin() {
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        if (state.current[r][c] !== state.solution[r][c]) return;
      }
    }
    state.solved = true;
    stopTimer();
    overlayStatsEl.textContent =
      `Time ${formatTime(state.elapsed)} · ${state.mistakes} mistakes · ${state.hintsUsed} hints`;
    overlayEl.classList.remove("hidden");
  }

  // --- Wire up events ---
  newGameBtn.addEventListener("click", newGame);
  overlayNewBtn.addEventListener("click", newGame);
  difficultyEl.addEventListener("change", newGame);
  eraseBtn.addEventListener("click", eraseCell);
  hintBtn.addEventListener("click", giveHint);
  notesToggleBtn.addEventListener("click", () => setNotesMode(!state.notesMode));

  document.querySelectorAll(".pad__btn").forEach((btn) => {
    btn.addEventListener("click", () =>
      inputNumber(Number(btn.dataset.num))
    );
  });

  document.addEventListener("keydown", (e) => {
    if (e.key >= "1" && e.key <= "9") {
      inputNumber(Number(e.key));
      e.preventDefault();
    } else if (e.key === "Backspace" || e.key === "Delete" || e.key === "0") {
      eraseCell();
      e.preventDefault();
    } else if (e.key === "ArrowUp") {
      moveSelection(-1, 0);
      e.preventDefault();
    } else if (e.key === "ArrowDown") {
      moveSelection(1, 0);
      e.preventDefault();
    } else if (e.key === "ArrowLeft") {
      moveSelection(0, -1);
      e.preventDefault();
    } else if (e.key === "ArrowRight") {
      moveSelection(0, 1);
      e.preventDefault();
    } else if (e.key.toLowerCase() === "n") {
      setNotesMode(!state.notesMode);
    }
  });

  // --- Boot ---
  buildBoard();
  newGame();
})();

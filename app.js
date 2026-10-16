"use strict";

// ---------- Génération ----------
// Grille de type mots croisés : des équations "a op b = c" de 5 cases, horizontales ou verticales,
// qui se croisent sur des cases-nombres. Les cases vides sont noires.

const OPS = {
  "+": (a, b) => a + b,
  "−": (a, b) => a - b,
  "×": (a, b) => a * b,
  "÷": (a, b) => (b !== 0 && a % b === 0 ? a / b : NaN),
};

const LEVELS = {
  easy: { size: 11, target: 10, ratio: 0.4 },
  medium: { size: 15, target: 18, ratio: 0.5 },
  hard: { size: 19, target: 28, ratio: 0.6 },
};

const rnd = (lo, hi) => lo + Math.floor(Math.random() * (hi - lo + 1));
const pick = (arr) => arr[rnd(0, arr.length - 1)];

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = rnd(0, i);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function valid(op, a, b, c, max) {
  if ([a, b, c].some((x) => !Number.isInteger(x) || x < 1 || x > max)) return false;
  if (op === "×" && (a < 2 || b < 2)) return false;
  if (op === "÷" && b < 2) return false;
  return OPS[op](a, b) === c;
}

// Retrouve b dans "a op b = c".
function solveRight(op, a, c) {
  switch (op) {
    case "+": return c - a;
    case "−": return a - c;
    case "×": return c % a === 0 ? c / a : NaN;
    case "÷": return a % c === 0 ? a / c : NaN;
  }
}

// Retrouve a dans "a op b = c".
function solveLeft(op, b, c) {
  switch (op) {
    case "+": return c - b;
    case "−": return c + b;
    case "×": return c % b === 0 ? c / b : NaN;
    case "÷": return c * b;
  }
}

// Tire au hasard [a, b] tels que "a op b = c".
function decompose(op, c, max) {
  switch (op) {
    case "+": {
      if (c < 2) return null;
      const a = rnd(1, c - 1);
      return [a, c - a];
    }
    case "−": {
      if (c >= max) return null;
      const b = rnd(1, max - c);
      return [c + b, b];
    }
    case "×": {
      const ds = [];
      for (let d = 2; d * 2 <= c; d++) if (c % d === 0) ds.push(d);
      if (!ds.length) return null;
      const d = pick(ds);
      return [d, c / d];
    }
    case "÷": {
      const hi = Math.floor(max / c);
      if (hi < 2) return null;
      const b = rnd(2, hi);
      return [c * b, b];
    }
  }
}

// Tire une équation [a, b, c] valide pour op, compatible avec les valeurs imposées fx = [a|null, b|null, c|null].
function fits(op, fx, max) {
  const [a, b, c] = fx;
  const found = [];
  const add = (x, y, z) => { if (valid(op, x, y, z, max)) found.push([x, y, z]); };
  if (a !== null && b !== null) {
    const z = OPS[op](a, b);
    if (c === null || c === z) add(a, b, z);
  } else if (a !== null && c !== null) add(a, solveRight(op, a, c), c);
  else if (b !== null && c !== null) add(solveLeft(op, b, c), b, c);
  else if (a !== null) for (let y = 1; y <= max; y++) add(a, y, OPS[op](a, y));
  else if (b !== null) for (let x = 1; x <= max; x++) add(x, b, OPS[op](x, b));
  else {
    const target = c !== null ? c : rnd(1, max);
    const d = decompose(op, target, max);
    if (d) add(d[0], d[1], target);
  }
  return found.length ? pick(found) : null;
}

// Place une équation de 5 cases à partir de (r, c) dans la direction dir ("H" ou "V").
// Les croisements ne se font que sur des cases-nombres, et deux équations ne se touchent jamais autrement.
function tryPlace(grid, rows, cols, ops, max, r, c, dir) {
  const [dr, dc] = dir === "H" ? [0, 1] : [1, 0];
  const inside = (y, x) => y >= 0 && y < rows && x >= 0 && x < cols;
  if (!inside(r, c) || !inside(r + 4 * dr, c + 4 * dc)) return null;
  for (const [y, x] of [[r - dr, c - dc], [r + 5 * dr, c + 5 * dc]]) {
    if (inside(y, x) && grid[y][x]) return null;
  }
  const fixed = [null, null, null];
  for (let i = 0; i < 5; i++) {
    const y = r + i * dr, x = c + i * dc, cell = grid[y][x];
    if (cell) {
      if (i % 2 === 1 || cell.kind !== "num" || cell.dirs.includes(dir)) return null;
      fixed[i / 2] = cell.value;
    } else {
      for (const s of [-1, 1]) {
        const ny = y + s * dc, nx = x + s * dr;
        if (inside(ny, nx) && grid[ny][nx]) return null;
      }
    }
  }
  for (const op of shuffle([...ops])) {
    const t = fits(op, fixed, max);
    if (!t) continue;
    const coords = [];
    for (let i = 0; i < 5; i++) {
      const y = r + i * dr, x = c + i * dc;
      if (i % 2 === 0) {
        if (grid[y][x]) grid[y][x].dirs.push(dir);
        else grid[y][x] = { kind: "num", value: t[i / 2], dirs: [dir] };
      } else {
        grid[y][x] = { kind: "sym", text: i === 1 ? op : "=" };
      }
      coords.push([y, x]);
    }
    return coords;
  }
  return null;
}

function build(ops, max, nRows, nCols, target) {
  const grid = Array.from({ length: nRows }, () => Array(nCols).fill(null));
  const eqs = [];
  let first = null;
  for (let k = 0; k < 50 && !first; k++) {
    first = tryPlace(grid, nRows, nCols, ops, max, Math.floor(nRows / 2), Math.floor((nCols - 5) / 2), "H");
  }
  if (!first) return null;
  eqs.push(first);

  while (eqs.length < target) {
    const cands = [];
    for (let r = 0; r < nRows; r++) {
      for (let c = 0; c < nCols; c++) {
        const cell = grid[r][c];
        if (!cell || cell.kind !== "num" || cell.dirs.length !== 1) continue;
        const dir = cell.dirs[0] === "H" ? "V" : "H";
        for (const p of [0, 2, 4]) cands.push([r - (dir === "V" ? p : 0), c - (dir === "H" ? p : 0), dir]);
      }
    }
    shuffle(cands);
    let placed = null;
    for (const [r, c, dir] of cands) {
      placed = tryPlace(grid, nRows, nCols, ops, max, r, c, dir);
      if (placed) break;
    }
    if (!placed) break;
    eqs.push(placed);
  }

  // Recadre sur la zone utilisée.
  const all = eqs.flat();
  const r0 = Math.min(...all.map((p) => p[0])), r1 = Math.max(...all.map((p) => p[0]));
  const c0 = Math.min(...all.map((p) => p[1])), c1 = Math.max(...all.map((p) => p[1]));
  return {
    rows: r1 - r0 + 1,
    cols: c1 - c0 + 1,
    cells: grid.slice(r0, r1 + 1).map((row) => row.slice(c0, c1 + 1)),
    eqs: eqs.map((eq) => eq.map(([y, x]) => [y - r0, x - c0])),
  };
}

function generate(ops, max, { rows, cols, target }, budgetMs = 3000) {
  const t0 = Date.now();
  let best = null;
  const score = (p) => p.eqs.length * 100 + p.cols;
  for (let n = 0; n < 60 && Date.now() - t0 < budgetMs; n++) {
    const p = build(ops, max, rows, cols, target);
    if (p && (!best || score(p) > score(best))) best = p;
    if (best && best.eqs.length >= target && best.cols >= cols - 1) break;
  }
  return best;
}

// ---------- Jeu ----------

const state = {
  puzzle: null,
  hidden: new Set(), // index (r * cols + c) des cases à remplir
  tiles: [], // { id, value }
  fill: {}, // index de case -> id de tuile
  selTile: null,
  selCell: null,
  startedAt: 0,
  timerId: null,
  done: false,
  configKey: "",
};

const $ = (id) => document.getElementById(id);
const fmt = (s) => String(Math.floor(s / 60)).padStart(2, "0") + ":" + String(s % 60).padStart(2, "0");
const idxOf = ([r, c]) => r * state.puzzle.cols + c;

function readSettings() {
  return {
    ops: [...document.querySelectorAll('input[name="op"]:checked')].map((i) => i.value),
    max: Number(document.querySelector('input[name="max"]:checked').value),
    level: $("difficulty").value,
  };
}

function applySettings(s) {
  document.querySelectorAll('input[name="op"]').forEach((i) => (i.checked = s.ops.includes(i.value)));
  document.querySelectorAll('input[name="max"]').forEach((i) => (i.checked = Number(i.value) === s.max));
  if (LEVELS[s.level]) $("difficulty").value = s.level;
}

function cellValue(idx) {
  const { cols, cells } = state.puzzle;
  if (!state.hidden.has(idx)) return cells[Math.floor(idx / cols)][idx % cols].value;
  const tid = state.fill[idx];
  return tid === undefined ? null : state.tiles.find((t) => t.id === tid).value;
}

function render() {
  const { rows, cols, cells } = state.puzzle;
  $("grid").style.setProperty("--cols", cols);
  const status = new Map();
  for (const eq of state.puzzle.eqs) {
    const s = eqStatus(eq);
    if (!s) continue;
    for (const i of eq.map(idxOf)) if (s === "bad" || !status.has(i)) status.set(i, s);
  }
  let html = "";
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cell = cells[r][c];
      const idx = r * cols + c;
      if (!cell) {
        html += `<div class="cell block"></div>`;
        continue;
      }
      const bad = status.has(idx) ? " " + status.get(idx) : "";
      if (cell.kind === "sym") {
        html += `<div class="cell sym${bad}">${cell.text}</div>`;
        continue;
      }
      const v = cellValue(idx);
      const blank = state.hidden.has(idx);
      const len = v === null ? 0 : String(v).length;
      const cls = "cell num" + (len >= 4 ? " l4" : len === 3 ? " l3" : "") +
        (blank ? (v === null ? " blank" : " blank filled") : "") +
        (state.selCell === idx ? " selected" : "") + bad;
      html += `<div class="${cls}" data-idx="${idx}">${v === null ? "" : v}</div>`;
    }
  }
  $("grid").innerHTML = html;

  const used = new Set(Object.values(state.fill));
  $("bank").innerHTML = state.tiles
    .filter((t) => !used.has(t.id))
    .map((t) => `<button type="button" class="tile${state.selTile === t.id ? " selected" : ""}" data-tile="${t.id}">${t.value}</button>`)
    .join("");
}

function setMessage(text, cls = "") {
  const el = $("message");
  el.textContent = text;
  el.className = "message " + cls;
}

function place(idx, tileId) {
  state.fill[idx] = tileId;
  state.selTile = null;
  state.selCell = null;
  render();
  checkWin();
}

// "ok" ou "bad" quand les 3 nombres de l'équation sont connus, sinon null.
function eqStatus(eq) {
  const v = [0, 2, 4].map((i) => cellValue(idxOf(eq[i])));
  if (v.some((x) => x === null)) return null;
  const op = state.puzzle.cells[eq[1][0]][eq[1][1]].text;
  return OPS[op](v[0], v[1]) === v[2] ? "ok" : "bad";
}

function checkWin() {
  if (![...state.hidden].every((i) => state.fill[i] !== undefined)) {
    setMessage("");
    return;
  }
  if (state.puzzle.eqs.some((eq) => eqStatus(eq) !== "ok")) {
    setMessage("Il y a des erreurs, regarde les équations en rouge.", "error");
    return;
  }
  state.done = true;
  clearInterval(state.timerId);
  const secs = Math.floor((Date.now() - state.startedAt) / 1000);
  const best = Number(localStorage.getItem("crossmath-best-" + state.configKey));
  let msg = `Bravo ! Résolu en ${fmt(secs)}.`;
  if (!best || secs < best) {
    localStorage.setItem("crossmath-best-" + state.configKey, String(secs));
    if (best) msg += " Nouveau record !";
  }
  setMessage(msg, "win");
  showBest();
}

function showBest() {
  const best = Number(localStorage.getItem("crossmath-best-" + state.configKey));
  $("best").textContent = best ? "Record : " + fmt(best) : "";
}

// Réduit la grille pour que les cases restent lisibles (>= 32 px) sur petit écran.
function fitLevel(level) {
  const L = LEVELS[level];
  const avail = Math.min(window.innerWidth, 1000) - 24;
  const cols = Math.min(L.size, Math.max(7, Math.floor(avail / 34)));
  return { rows: L.size, cols, target: Math.round(L.target * (cols / L.size)) };
}

function newGame() {
  const s = readSettings();
  if (!s.ops.length) {
    setMessage("Choisis au moins une opération.", "error");
    return;
  }
  localStorage.setItem("crossmath-settings-v2", JSON.stringify(s));
  clearInterval(state.timerId);
  setMessage("Génération…");
  // Laisse le navigateur afficher le message avant le calcul.
  setTimeout(() => {
    const puzzle = generate(s.ops, s.max, fitLevel(s.level));
    if (!puzzle) {
      setMessage("Impossible de générer une grille avec ces options.", "error");
      return;
    }
    const nums = [];
    puzzle.cells.forEach((row, r) => row.forEach((cell, c) => {
      if (cell && cell.kind === "num") nums.push(r * puzzle.cols + c);
    }));
    const hidden = new Set(shuffle([...nums]).slice(0, Math.round(nums.length * LEVELS[s.level].ratio)));
    // Chaque équation doit avoir au moins un trou.
    for (const eq of puzzle.eqs) {
      const ids = [0, 2, 4].map((i) => eq[i][0] * puzzle.cols + eq[i][1]);
      if (!ids.some((i) => hidden.has(i))) hidden.add(pick(ids));
    }
    const values = [...hidden]
      .map((i) => puzzle.cells[Math.floor(i / puzzle.cols)][i % puzzle.cols].value)
      .sort((a, b) => a - b);
    Object.assign(state, {
      puzzle,
      hidden,
      tiles: values.map((value, id) => ({ id, value })),
      fill: {},
      selTile: null,
      selCell: null,
      done: false,
      startedAt: Date.now(),
      configKey: [...s.ops].sort().join("") + "-" + s.max + "-" + s.level,
    });
    setMessage("");
    showBest();
    $("timer").textContent = "00:00";
    state.timerId = setInterval(() => {
      $("timer").textContent = fmt(Math.floor((Date.now() - state.startedAt) / 1000));
    }, 250);
    render();
  }, 20);
}

function onGridClick(e) {
  const el = e.target.closest("[data-idx]");
  if (!el || state.done) return;
  const idx = Number(el.dataset.idx);
  if (!state.hidden.has(idx)) return;
  if (state.selTile !== null) {
    place(idx, state.selTile);
  } else if (state.fill[idx] !== undefined) {
    delete state.fill[idx];
    setMessage("");
    render();
  } else {
    state.selCell = state.selCell === idx ? null : idx;
    render();
  }
}

function onBankClick(e) {
  const el = e.target.closest("[data-tile]");
  if (!el || state.done) return;
  const id = Number(el.dataset.tile);
  if (state.selCell !== null) {
    place(state.selCell, id);
  } else {
    state.selTile = state.selTile === id ? null : id;
    render();
  }
}

function init() {
  const saved = localStorage.getItem("crossmath-settings-v2");
  if (saved) applySettings(JSON.parse(saved));
  $("grid").addEventListener("click", onGridClick);
  $("bank").addEventListener("click", onBankClick);
  $("new-game").addEventListener("click", newGame);
  document.querySelector(".settings").addEventListener("change", newGame);
  newGame();
}

if (typeof document !== "undefined") init();

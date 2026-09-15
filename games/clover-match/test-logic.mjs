#!/usr/bin/env node
/** Headless checks for Clover Match grid logic (no DOM). */
const SIZE = 8;
const idx = (r, c) => r * SIZE + c;

function findMatches(grid) {
  const set = new Set();
  for (let r = 0; r < SIZE; r++) {
    let run = 1;
    for (let c = 1; c < SIZE; c++) {
      if (grid[idx(r, c)] === grid[idx(r, c - 1)] && grid[idx(r, c)] != null) run++;
      else {
        if (run >= 3) for (let k = 0; k < run; k++) set.add(idx(r, c - 1 - k));
        run = 1;
      }
    }
    if (run >= 3) for (let k = 0; k < run; k++) set.add(idx(r, SIZE - 1 - k));
  }
  for (let c = 0; c < SIZE; c++) {
    let run = 1;
    for (let r = 1; r < SIZE; r++) {
      if (grid[idx(r, c)] === grid[idx(r - 1, c)] && grid[idx(r, c)] != null) run++;
      else {
        if (run >= 3) for (let k = 0; k < run; k++) set.add(idx(r - 1 - k, c));
        run = 1;
      }
    }
    if (run >= 3) for (let k = 0; k < run; k++) set.add(idx(SIZE - 1 - k, c));
  }
  return set;
}

function uniqueGrid() {
  const grid = new Array(SIZE * SIZE);
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) grid[idx(r, c)] = (r * 3 + c * 5) % 6;
  }
  return grid;
}

const g1 = uniqueGrid();
g1[idx(5, 2)] = g1[idx(6, 2)] = g1[idx(7, 2)] = 3;
if (g1[idx(4, 2)] === 3) g1[idx(4, 2)] = 0;
const m1 = findMatches(g1);
const expect1 = new Set([idx(5, 2), idx(6, 2), idx(7, 2)]);
if (m1.size !== 3 || ![...expect1].every((i) => m1.has(i))) {
  console.error("FAIL bottom vertical match", [...m1], [...expect1]);
  process.exit(1);
}

console.log("Clover Match logic checks passed.");

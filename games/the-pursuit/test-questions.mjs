#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const dir = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(dir, "questions.js"), "utf8");
const fn = new Function("window", src + "; return window.QUIZ_BANK;");
const bank = fn({});

if (!Array.isArray(bank) || bank.length < 80) {
  console.error("FAIL: expected 80+ questions, got", bank?.length);
  process.exit(1);
}

const diffs = { easy: 0, medium: 0, hard: 0, expert: 0 };
for (const q of bank) {
  if (!q.q || !Array.isArray(q.o) || q.o.length !== 4) {
    console.error("FAIL: invalid question shape", q);
    process.exit(1);
  }
  if (q.a < 0 || q.a > 3) {
    console.error("FAIL: invalid answer index", q.q);
    process.exit(1);
  }
  diffs[q.d] = (diffs[q.d] || 0) + 1;
}

for (const d of ["easy", "medium", "hard", "expert"]) {
  if ((diffs[d] || 0) < 20) {
    console.error("FAIL: need 20+ per difficulty", d, diffs[d]);
    process.exit(1);
  }
}

const html = readFileSync(join(dir, "index.html"), "utf8");
if (!html.includes("noindex,nofollow")) {
  console.error("FAIL: index.html missing noindex");
  process.exit(1);
}
if (!html.includes("og:image") || !html.includes("og-preview.png")) {
  console.error("FAIL: index.html missing Open Graph image tags");
  process.exit(1);
}

console.log(`Question bank OK: ${bank.length} questions`, diffs);

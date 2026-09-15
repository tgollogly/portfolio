#!/usr/bin/env node
/**
 * Seed pursuit-questions D1 from games/the-pursuit/questions.js
 * Run: npx wrangler d1 execute pursuit-questions --remote --file=scripts/pursuit-d1-seed.sql
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = readFileSync(join(root, "games/the-pursuit/questions.js"), "utf8");
const fn = new Function("window", `${src}; return window.QUIZ_BANK;`);
const bank = fn({});
const now = Date.now();
const esc = (s) => String(s).replace(/'/g, "''");
const lines = bank.map((q) => {
  const opts = JSON.stringify(q.o).replace(/'/g, "''");
  return `INSERT OR IGNORE INTO questions (id,difficulty,question,options,answer,source,created_at) VALUES ('${q.id}','${q.d}','${esc(q.q)}','${opts}',${q.a},'seed',${now});`;
});
const out = join(root, "scripts/pursuit-d1-seed.sql");
writeFileSync(out, lines.join("\n") + "\n");
console.log(`Wrote ${lines.length} statements to ${out}`);

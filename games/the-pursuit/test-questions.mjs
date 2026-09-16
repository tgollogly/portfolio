#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const dir = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(dir, "questions.js"), "utf8");
const fn = new Function("window", src + "; return window.QUIZ_BANK;");
const bank = fn({});

if (!Array.isArray(bank) || bank.length < 200) {
  console.error("FAIL: expected 200+ questions, got", bank?.length);
  process.exit(1);
}

const ids = new Set();
const diffs = { easy: 0, medium: 0, hard: 0, expert: 0 };
for (const q of bank) {
  if (!q.id || typeof q.id !== "string") {
    console.error("FAIL: missing question id", q.q);
    process.exit(1);
  }
  if (ids.has(q.id)) {
    console.error("FAIL: duplicate question id", q.id);
    process.exit(1);
  }
  ids.add(q.id);
  if (!q.q || !Array.isArray(q.o) || q.o.length !== 4) {
    console.error("FAIL: invalid question shape", q);
    process.exit(1);
  }
  if (q.a < 0 || q.a > 3) {
    console.error("FAIL: invalid answer index", q.q);
    process.exit(1);
  }
  const norm = q.o.map((s) => String(s).trim().toLowerCase());
  if (new Set(norm).size !== 4) {
    console.error("FAIL: duplicate options", q.id, q.q, q.o);
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
if (!html.includes("apple-touch-icon") || !html.includes("manifest.webmanifest")) {
  console.error("FAIL: index.html missing PWA / home screen icon tags");
  process.exit(1);
}
if (!html.includes("/games/the-pursuit/apple-touch-icon.png")) {
  console.error("FAIL: apple-touch-icon must live beside index (iOS requirement)");
  process.exit(1);
}
if (!html.includes("usedIds") || !html.includes("pursuit-leaderboard")) {
  console.error("FAIL: index.html missing no-repeat or leaderboard logic");
  process.exit(1);
}
if (!html.includes("pursuit-questions") || !html.includes("pursuit-memory")) {
  console.error("FAIL: index.html missing cloud question bank or memory API");
  process.exit(1);
}
if (!html.includes("pursuit-check-answer") || !html.includes("escapeHtml(q.q)")) {
  console.error("FAIL: index.html missing server-side answer check or XSS escape");
  process.exit(1);
}
if (!html.includes("playerName") || !html.includes("localStorage")) {
  console.error("FAIL: index.html missing name persistence");
  process.exit(1);
}
if (!html.includes("clock-ring") || !html.includes("round-splash") || !html.includes("chaser-panel")) {
  console.error("FAIL: index.html missing TV-studio timer/chaser UI");
  process.exit(1);
}
if (!html.includes("isValidQuestion")) {
  console.error("FAIL: index.html missing client-side question validation");
  process.exit(1);
}
if (!html.includes("pursuit_player_level") || !html.includes("saveLevel")) {
  console.error("FAIL: index.html missing local level persistence");
  process.exit(1);
}
if (!html.includes("pursuit-feeds") || !html.includes("feedPanel")) {
  console.error("FAIL: index.html missing news feed panel");
  process.exit(1);
}

const server = readFileSync(join(dir, "../../server.js"), "utf8");
if (!server.includes("pursuit-mcp") || !server.includes("pursuit-news-feeds")) {
  console.error("FAIL: server.js missing news feeds or MCP endpoints");
  process.exit(1);
}
if (!server.includes("pursuit-mcp-guardrails") || !server.includes("runMcpWithGuardrails")) {
  console.error("FAIL: server.js missing MCP guardrail gateway");
  process.exit(1);
}
if (!server.includes("pursuit-store") || !server.includes("scheduled")) {
  console.error("FAIL: server.js missing pursuit store or cron refresh");
  process.exit(1);
}
if (server.includes("CF-Scheduled") || server.includes("maybeBackgroundPursuitRefresh")) {
  console.error("FAIL: server.js still has insecure refresh paths");
  process.exit(1);
}
if (!server.includes("pursuit-check-answer") || !server.includes("publicQuestion")) {
  console.error("FAIL: server.js missing secure answer check");
  process.exit(1);
}

const wrangler = readFileSync(join(dir, "../../wrangler.toml"), "utf8");
const wranglerP1 = readFileSync(join(dir, "../../wrangler.portfolio1.toml"), "utf8");
if (/^\[triggers\]/m.test(wrangler) || wrangler.includes('crons = [')) {
  console.error("FAIL: shared wrangler.toml must not define cron triggers (multi-worker quota)");
  process.exit(1);
}
if (!wranglerP1.includes('crons = ["0 6 * * *", "0 18 * * *"]')) {
  console.error("FAIL: wrangler.portfolio1.toml missing portfolio1 cron schedules");
  process.exit(1);
}

console.log(`Question bank OK: ${bank.length} questions`, diffs);

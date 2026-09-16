#!/usr/bin/env node
/**
 * Fetch no-auth RSS/trivia/wikipedia questions and write JSON for D1 import.
 * Used by local refresh and GitHub Actions (with wrangler d1 execute).
 */
import { writeFileSync } from "node:fs";
import { generateFeedQuestions } from "../lib/pursuit-news-feeds.js";

function sqlString(value) {
  return `'${String(value ?? "").replace(/'/g, "''")}'`;
}

const outPath = process.argv[2] || "/tmp/pursuit-feed-questions.json";
const { questions, headlinesByFeed, errors, generated } = await generateFeedQuestions(fetch, {});

const sqlLines = [
  "BEGIN TRANSACTION;",
];
const now = Date.now();
for (const q of questions) {
  sqlLines.push(
    `INSERT OR IGNORE INTO questions (id, difficulty, question, options, answer, source, topic, created_at) VALUES (${sqlString(q.id)}, ${sqlString(q.d)}, ${sqlString(q.q)}, ${sqlString(JSON.stringify(q.o))}, ${Number(q.a)}, ${sqlString(q.source)}, ${sqlString(q.topic || "")}, ${q.created_at || now});`
  );
}
sqlLines.push(
  `INSERT INTO pursuit_meta (key, value) VALUES ('last_feed_refresh', '${now}') ON CONFLICT(key) DO UPDATE SET value = excluded.value;`
);
sqlLines.push("COMMIT;");

writeFileSync(outPath, JSON.stringify({ questions, headlinesByFeed, errors, generated, at: now }, null, 2));
writeFileSync(outPath.replace(/\.json$/, ".sql"), sqlLines.join("\n"));
console.log(
  JSON.stringify({ ok: true, generated, valid: questions.length, errors, outPath, sql: outPath.replace(/\.json$/, ".sql") })
);

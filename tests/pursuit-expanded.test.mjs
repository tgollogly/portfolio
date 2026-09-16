#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  PURSUIT_LB_KEY,
  publicQuestion,
  resetLeaderboard,
  sanitizePlayerId,
  sanitizePursuitName,
  sanitizeQuestionText,
  validateQuestion,
} from "../lib/pursuit-store.js";
import {
  decodeHtmlEntities,
  mapOpenTdbItem,
  parseRssTitles,
  questionsFromHeadlines,
  questionsFromWikipediaOnThisDay,
  RSS_FEEDS,
} from "../lib/pursuit-news-feeds.js";
import { createSuite } from "./harness.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const s = createSuite("pursuit-expanded");

const validBase = { q: "Test?", o: ["A", "B", "C", "D"], a: 0 };

s.assert("validate good question", validateQuestion(validBase));
s.assert("reject empty q", !validateQuestion({ ...validBase, q: "" }));
s.assert("reject 3 options", !validateQuestion({ ...validBase, o: ["A", "B", "C"] }));
s.assert("reject dup options", !validateQuestion({ ...validBase, o: ["A", "A", "B", "C"] }));
s.assert("reject index 4", !validateQuestion({ ...validBase, a: 4 }));
s.assert("reject empty option", !validateQuestion({ ...validBase, o: ["", "B", "C", "D"] }));
s.assert("reject whitespace dup", !validateQuestion({ ...validBase, o: ["Cat", "cat", "B", "C"] }));

for (let i = 0; i < 4; i++) {
  s.assert(`valid answer index ${i}`, validateQuestion({ ...validBase, a: i, o: ["A", "B", "C", "D"] }));
}

s.assert("sanitize strips tags", sanitizeQuestionText("<b>Hi</b>") === "Hi");
s.assert("sanitize trims", sanitizeQuestionText("  Q?  ") === "Q?");
s.assert("sanitize max len", sanitizeQuestionText("x".repeat(400)).length <= 280);

s.assert("name trim", sanitizePursuitName("  Bob  ") === "Bob");
s.assert("name max 20", sanitizePursuitName("x".repeat(30)).length === 20);
s.assert("name keeps apostrophe", sanitizePursuitName("O'Brien").includes("'"));
s.assert("player id clean", sanitizePlayerId("p_1-2") === "p_1-2");
s.assert("player id strip", sanitizePlayerId("a b!") === "ab");

const q = { id: "e1", d: "easy", q: "Q?", o: ["A", "B", "C", "D"], a: 1, source: "seed" };
const pub = publicQuestion(q);
s.assert("public omits answer", pub.a === undefined);
s.assert("public keeps id", pub.id === "e1");
s.assert("public keeps options", pub.o.length === 4);

s.assert("decode amp", decodeHtmlEntities("&amp;") === "&");
s.assert("decode quot", decodeHtmlEntities("&quot;") === '"');
s.assert("decode numeric", decodeHtmlEntities("&#65;") === "A");

const rss = `<rss><channel><title>BBC News</title>
<item><title><![CDATA[Headline one]]></title></item>
<item><title><![CDATA[Headline two]]></title></item>
<item><title><![CDATA[Headline three]]></title></item>
<item><title><![CDATA[Headline four]]></title></item></channel></rss>`;
const titles = parseRssTitles(rss, 10);
s.assert("rss 4 titles", titles.length === 4);
s.assert("rss no channel", !titles.includes("BBC News"));

const hq = questionsFromHeadlines(titles, "bbc_news", Date.now(), 2);
s.assert("headline q count", hq.length >= 1);
s.assert("headline q valid", hq.every((x) => validateQuestion(x)));

const otdb = mapOpenTdbItem(
  {
    difficulty: "hard",
    category: "Science",
    question: "Water formula?",
    correct_answer: "H2O",
    incorrect_answers: ["CO2", "O2", "NaCl"],
  },
  1,
  999
);
s.assert("otdb valid", otdb && validateQuestion(otdb));
s.assert("otdb hard", otdb?.d === "hard");

const wiki = questionsFromWikipediaOnThisDay(
  {
    selected: [
      { text: "Event A happened.", year: 2000 },
      { text: "Event B happened.", year: 2001 },
      { text: "Event C happened.", year: 2002 },
      { text: "Event D happened.", year: 2003 },
    ],
  },
  Date.now(),
  3
);
s.assert("wiki q count", wiki.length >= 1);
s.assert("wiki q valid", wiki.every((x) => validateQuestion(x)));

s.assert("rss feeds configured", RSS_FEEDS.length >= 5);
s.assert("lb key constant", PURSUIT_LB_KEY === "pursuit:leaderboard");

const kvStore = new Map();
kvStore.set(PURSUIT_LB_KEY, JSON.stringify([{ name: "A", score: 100, at: 1 }]));
const env = {
  PURSUIT_KV: {
    get: (k) => kvStore.get(k) ?? null,
    put: (k, v) => kvStore.set(k, v),
  },
};
const reset = await resetLeaderboard(env);
s.assert("reset ok", reset.ok === true);
s.assert("reset cleared", reset.cleared === 1);
s.assert("kv empty", JSON.parse(kvStore.get(PURSUIT_LB_KEY)).length === 0);

const server = readFileSync(join(root, "server.js"), "utf8");
s.assert("server pursuit-mcp", server.includes("/api/pursuit-mcp"));
s.assert("server pursuit-feeds", server.includes("/api/pursuit-feeds"));
s.assert("server lb delete", server.includes("handlePursuitLeaderboardReset"));
s.assert("server no CF-Scheduled", !server.includes("CF-Scheduled"));
s.assert("server check-answer", server.includes("pursuit-check-answer"));

const html = readFileSync(join(root, "games/the-pursuit/index.html"), "utf8");
s.assert("html escapeHtml", html.includes("escapeHtml(q.q)"));
s.assert("html check-answer api", html.includes("pursuit-check-answer"));
s.assert("html noindex", html.includes("noindex,nofollow"));
s.assert("html saveLevel", html.includes("saveLevel"));
s.assert("html feedPanel", html.includes("feedPanel"));

const wrangler = readFileSync(join(root, "wrangler.portfolio1.toml"), "utf8");
s.assert("wrangler d1 binding", wrangler.includes("PURSUIT_DB"));
s.assert("wrangler kv binding", wrangler.includes("PURSUIT_KV"));
s.assert("wrangler crons", wrangler.includes("0 6 * * *"));

export function runPursuitExpandedTests() {
  return s.summary();
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const r = runPursuitExpandedTests();
  if (r.failed) process.exit(1);
  console.log(`${r.name}: ${r.passed}/${r.total} passed`);
}

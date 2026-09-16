/** Free no-auth feeds → validated Pursuit quiz questions. */

import {
  ensureSchema,
  getQuestionCount,
  insertQuestions,
  validateQuestion,
} from "./pursuit-store.js";

const OPENTDB_URL = "https://opentdb.com/api.php";
const WIKI_ONTHISDAY = "https://en.wikipedia.org/api/rest_v1/feed/onthisday/all";

/** Public RSS sources — no API keys. */
export const RSS_FEEDS = [
  { id: "bbc_news", name: "BBC News", url: "https://feeds.bbci.co.uk/news/rss.xml" },
  { id: "bbc_uk", name: "BBC UK", url: "https://feeds.bbci.co.uk/news/uk/rss.xml" },
  { id: "bbc_world", name: "BBC World", url: "https://feeds.bbci.co.uk/news/world/rss.xml" },
  { id: "bbc_science", name: "BBC Science", url: "https://feeds.bbci.co.uk/news/science_and_environment/rss.xml" },
  { id: "bbc_sport", name: "BBC Sport", url: "https://feeds.bbci.co.uk/sport/rss.xml" },
];

export const PURSUIT_MCP_TOOLS = [
  {
    name: "get_stats",
    description: "Question bank totals, sources, and last refresh timestamps.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "get_feeds",
    description: "List configured news/trivia feed sources (no auth).",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "get_headlines",
    description: "Fetch latest headlines from BBC RSS feeds.",
    inputSchema: {
      type: "object",
      properties: {
        feed: { type: "string", description: "Feed id e.g. bbc_news, bbc_sport" },
        limit: { type: "number", description: "Max headlines (1–15)", default: 8 },
      },
      additionalProperties: false,
    },
  },
  {
    name: "sample_questions",
    description: "Preview questions generated from feeds (not saved to DB).",
    inputSchema: {
      type: "object",
      properties: {
        limit: { type: "number", description: "Max preview questions (1–10)", default: 5 },
      },
      additionalProperties: false,
    },
  },
];

export function decodeHtmlEntities(text) {
  return String(text || "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&eacute;/g, "é")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)));
}

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0;
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function trimOpt(text, max = 118) {
  const t = String(text || "").trim();
  return t.length <= max ? t : t.slice(0, max - 1) + "…";
}

function hashStr(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h).toString(36);
}

export function parseRssTitles(xml, max = 20) {
  const titles = [];
  const skip = new Set(["BBC News", "BBC Sport", "BBC"]);
  const re = /<title>(?:<!\[CDATA\[([\s\S]*?)\]\]>|([^<]*))<\/title>/gi;
  let m;
  while ((m = re.exec(xml)) && titles.length < max + 2) {
    const t = (m[1] || m[2] || "").trim();
    if (!t || skip.has(t)) continue;
    if (!titles.includes(t)) titles.push(t);
  }
  return titles.slice(0, max);
}

export function mapOpenTdbItem(item, idx, now) {
  const correct = decodeHtmlEntities(item.correct_answer);
  const wrong = item.incorrect_answers.map(decodeHtmlEntities);
  const options = shuffle([correct, ...wrong]);
  const diffMap = { easy: "easy", medium: "medium", hard: "hard" };
  const qText = decodeHtmlEntities(item.question).replace(/\?+$/, "") + "?";
  const candidate = {
    id: `otdb${now}${idx}`,
    d: diffMap[item.difficulty] || "medium",
    q: qText,
    o: options.map((x) => trimOpt(x)),
    a: options.indexOf(correct),
    source: "opentdb",
    topic: decodeHtmlEntities(item.category).slice(0, 80),
    created_at: now,
  };
  return validateQuestion(candidate) ? candidate : null;
}

export function questionsFromHeadlines(headlines, feedId, now, max = 8) {
  const out = [];
  const seen = new Set();
  const pool = headlines.filter(Boolean);
  if (pool.length < 4) return out;

  for (let i = 0; i < pool.length && out.length < max; i++) {
    const correct = pool[i];
    const key = correct.toLowerCase().slice(0, 60);
    if (seen.has(key)) continue;
    seen.add(key);

    const others = pool.filter((_, j) => j !== i);
    if (others.length < 3) continue;
    const distractors = shuffle(others).slice(0, 3);
    const rawOpts = shuffle([correct, ...distractors]);
    const o = rawOpts.map((t) => trimOpt(t));
    const correctOpt = trimOpt(correct);
    const a = o.indexOf(correctOpt);
    if (a < 0) continue;

    const candidate = {
      id: `news${hashStr(feedId + correct)}`,
      d: "medium",
      q: `Which of these was a recent ${feedId.replace(/_/g, " ")} headline?`,
      o,
      a,
      source: "news_feed",
      topic: feedId,
      created_at: now,
    };
    if (validateQuestion(candidate)) out.push(candidate);
  }
  return out;
}

export function questionsFromWikipediaOnThisDay(data, now, max = 12) {
  const out = [];
  const events = [];
  for (const key of ["selected", "events", "births", "deaths"]) {
    const list = data?.[key];
    if (!Array.isArray(list)) continue;
    for (const item of list) {
      if (item?.text && item?.year) {
        events.push({ text: String(item.text).trim(), year: Number(item.year) });
      }
    }
  }
  if (events.length < 4) return out;

  const seen = new Set();
  const shuffled = shuffle(events);
  for (const ev of shuffled) {
    if (out.length >= max) break;
    const key = ev.text.toLowerCase().slice(0, 50);
    if (seen.has(key)) continue;
    seen.add(key);

    const others = shuffle(events.filter((e) => e.text !== ev.text)).slice(0, 3);
    if (others.length < 3) continue;

    const rawOpts = shuffle([
      trimOpt(ev.text, 100),
      ...others.map((e) => trimOpt(`${e.year}: ${e.text}`, 100)),
    ]);
    const correctOpt = trimOpt(ev.text, 100);
    const a = rawOpts.indexOf(correctOpt);
    if (a < 0) continue;

    const d = new Date(now);
    const month = d.toLocaleString("en-GB", { month: "long" });
    const day = d.getDate();

    const candidate = {
      id: `wiki${hashStr(String(ev.year) + ev.text)}`,
      d: "medium",
      q: `On ${day} ${month}, which historical event occurred in ${ev.year}?`,
      o: rawOpts,
      a,
      source: "wikipedia",
      topic: "on this day",
      created_at: now,
    };
    if (validateQuestion(candidate)) out.push(candidate);
  }
  return out;
}

export async function fetchOpenTdb(amount, fetchFn = fetch) {
  const url = `${OPENTDB_URL}?amount=${Math.min(50, Math.max(1, amount))}&type=multiple`;
  const res = await fetchFn(url, {
    headers: { Accept: "application/json", "User-Agent": "PursuitQuiz/1.0 (tgollogly.dev)" },
  });
  if (!res.ok) throw new Error(`opentdb ${res.status}`);
  const data = await res.json();
  if (data.response_code !== 0 || !Array.isArray(data.results)) {
    throw new Error(`opentdb code ${data.response_code}`);
  }
  const now = Date.now();
  return data.results
    .map((item, i) => mapOpenTdbItem(item, i, now))
    .filter(Boolean);
}

export async function fetchWikipediaOnThisDay(date = new Date(), fetchFn = fetch) {
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(date.getUTCDate()).padStart(2, "0");
  const url = `${WIKI_ONTHISDAY}/${mm}/${dd}`;
  const res = await fetchFn(url, {
    headers: { Accept: "application/json", "User-Agent": "PursuitQuiz/1.0 (tgollogly.dev)" },
  });
  if (!res.ok) throw new Error(`wikipedia ${res.status}`);
  const data = await res.json();
  return questionsFromWikipediaOnThisDay(data, Date.now());
}

export async function fetchRssHeadlines(feedUrl, fetchFn = fetch, max = 15) {
  const res = await fetchFn(feedUrl, {
    headers: { Accept: "application/rss+xml, application/xml, text/xml", "User-Agent": "PursuitQuiz/1.0" },
  });
  if (!res.ok) throw new Error(`rss ${res.status}`);
  const xml = await res.text();
  return parseRssTitles(xml, max);
}

function dedupeQuestions(items) {
  const seen = new Set();
  const out = [];
  for (const q of items) {
    if (!validateQuestion(q)) continue;
    const key = q.q.toLowerCase().slice(0, 100);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(q);
  }
  return out;
}

export async function generateFeedQuestions(fetchFn = fetch, opts = {}) {
  const now = Date.now();
  const all = [];
  const errors = [];
  const headlinesByFeed = {};

  const otdbAmount = opts.otdbAmount ?? 50;
  try {
    all.push(...(await fetchOpenTdb(otdbAmount, fetchFn)));
  } catch (e) {
    errors.push({ source: "opentdb", error: String(e.message || e) });
  }

  try {
    all.push(...(await fetchWikipediaOnThisDay(new Date(), fetchFn)));
  } catch (e) {
    errors.push({ source: "wikipedia", error: String(e.message || e) });
  }

  for (const feed of RSS_FEEDS) {
    try {
      const headlines = await fetchRssHeadlines(feed.url, fetchFn, 12);
      headlinesByFeed[feed.id] = headlines.slice(0, 8);
      all.push(...questionsFromHeadlines(headlines, feed.id, now, 5));
    } catch (e) {
      errors.push({ source: feed.id, error: String(e.message || e) });
    }
  }

  return {
    questions: dedupeQuestions(all),
    headlinesByFeed,
    errors,
    generated: all.length,
  };
}

export async function refreshQuestionsFromFeeds(env, fetchFn = fetch, opts = {}) {
  if (!env.PURSUIT_DB) return { ok: false, error: "no db" };
  await ensureSchema(env);

  const { questions, headlinesByFeed, errors, generated } = await generateFeedQuestions(fetchFn, opts);
  if (!questions.length) {
    return { ok: false, error: "no questions from feeds", errors, generated };
  }

  const inserted = await insertQuestions(env, questions, "news_feed");
  const now = Date.now();

  await env.PURSUIT_DB.prepare(
    "INSERT INTO pursuit_meta (key, value) VALUES ('last_feed_refresh', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
  ).bind(String(now)).run();

  if (env.PURSUIT_KV && Object.keys(headlinesByFeed).length) {
    await env.PURSUIT_KV.put(
      "pursuit:feed_headlines",
      JSON.stringify({ at: now, feeds: headlinesByFeed }),
      { expirationTtl: 86400 * 3 }
    );
  }

  return {
    ok: true,
    inserted,
    generated,
    errors,
    total: await getQuestionCount(env),
    at: now,
  };
}

export async function getCachedHeadlines(env) {
  if (!env.PURSUIT_KV) return null;
  const raw = await env.PURSUIT_KV.get("pursuit:feed_headlines");
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

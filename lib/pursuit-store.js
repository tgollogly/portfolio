/** Pursuit quiz — D1 question bank, KV player memory, AI refresh. */

export const PURSUIT_LB_KEY = "pursuit:leaderboard";
export const PURSUIT_LB_MAX = 100;
export const PURSUIT_MEMORY_PREFIX = "pursuit:memory:";
export const PURSUIT_META_KEY = "pursuit:meta";
export const PURSUIT_SEED_FLAG = "seeded_v1";
const DIFFICULTIES = new Set(["easy", "medium", "hard", "expert"]);
const BATCH_INSERT = 40;
const AI_BATCH_SIZE = 30;

/** Reject questions with duplicate options, bad answer index, or empty text. */
export function validateQuestion(q) {
  if (!q) return false;
  const text = sanitizeQuestionText(q.q || q.question || "");
  if (!text) return false;
  const opts = Array.isArray(q.o) ? q.o : Array.isArray(q.options) ? q.options : [];
  if (opts.length !== 4) return false;
  const normalized = opts.map((x) => String(x).trim().toLowerCase());
  if (new Set(normalized).size !== 4) return false;
  if (normalized.some((x) => !x)) return false;
  const ans = Number(q.a ?? q.answer);
  if (!Number.isInteger(ans) || ans < 0 || ans > 3) return false;
  if (!String(opts[ans]).trim()) return false;
  return true;
}

function normalizeQuestion(q) {
  if (!validateQuestion(q)) return null;
  return {
    id: q.id,
    d: q.d || q.difficulty,
    q: sanitizeQuestionText(q.q || q.question),
    o: q.o.map((x) => String(x).trim().slice(0, 120)),
    a: Number(q.a ?? q.answer),
    source: q.source,
    topic: q.topic || undefined,
  };
}

export async function ensureSchema(env) {
  if (!env.PURSUIT_DB) return false;
  const sql = `-- Pursuit quiz — D1 schema
CREATE TABLE IF NOT EXISTS questions (
  id TEXT PRIMARY KEY,
  difficulty TEXT NOT NULL,
  question TEXT NOT NULL,
  options TEXT NOT NULL,
  answer INTEGER NOT NULL,
  source TEXT NOT NULL DEFAULT 'seed',
  topic TEXT,
  created_at INTEGER NOT NULL,
  times_asked INTEGER NOT NULL DEFAULT 0,
  times_wrong INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_questions_diff ON questions(difficulty);
CREATE INDEX IF NOT EXISTS idx_questions_source ON questions(source);
CREATE INDEX IF NOT EXISTS idx_questions_created ON questions(created_at DESC);
CREATE TABLE IF NOT EXISTS pursuit_meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);`;
  await env.PURSUIT_DB.exec(sql);
  return true;
}

export async function getQuestionCount(env) {
  if (!env.PURSUIT_DB) return 0;
  await ensureSchema(env);
  const row = await env.PURSUIT_DB.prepare("SELECT COUNT(*) AS n FROM questions").first();
  return Number(row?.n || 0);
}

function rowToQuestion(row) {
  if (!row) return null;
  let opts = row.options;
  if (typeof opts === "string") {
    try {
      opts = JSON.parse(opts);
    } catch {
      opts = [];
    }
  }
  return {
    id: row.id,
    d: row.difficulty,
    q: row.question,
    o: opts,
    a: row.answer,
    source: row.source,
    topic: row.topic || undefined,
  };
}

export async function pickQuestionsFromDb(env, { count = 24, difficulties = [], excludeIds = [] } = {}) {
  if (!env.PURSUIT_DB) return [];
  await ensureSchema(env);
  const diffs = difficulties.filter((d) => DIFFICULTIES.has(d));
  if (!diffs.length) diffs.push("easy", "medium");

  const exclude = excludeIds.filter(Boolean).slice(0, 200);
  const placeholders = diffs.map(() => "?").join(",");
  let sql = `SELECT id, difficulty, question, options, answer, source, topic
    FROM questions WHERE difficulty IN (${placeholders})`;
  const binds = [...diffs];

  if (exclude.length) {
    sql += ` AND id NOT IN (${exclude.map(() => "?").join(",")})`;
    binds.push(...exclude);
  }
  sql += " ORDER BY RANDOM() LIMIT ?";
  binds.push(Math.min(count * 3, 120));

  const result = await env.PURSUIT_DB.prepare(sql).bind(...binds).all();
  const rows = result.results || [];
  const picked = [];
  const seen = new Set(exclude);
  for (const row of rows) {
    if (picked.length >= count) break;
    if (seen.has(row.id)) continue;
    const q = normalizeQuestion(rowToQuestion(row));
    if (!q) continue;
    seen.add(row.id);
    picked.push(q);
  }
  return picked;
}

export async function insertQuestions(env, items, source = "seed") {
  if (!env.PURSUIT_DB || !items?.length) return 0;
  await ensureSchema(env);
  const now = Date.now();
  let inserted = 0;
  for (let i = 0; i < items.length; i += BATCH_INSERT) {
    const chunk = items.slice(i, i + BATCH_INSERT);
    const stmts = chunk.filter(validateQuestion).map((q) => {
      const opts = JSON.stringify(q.o || q.options || []);
      return env.PURSUIT_DB.prepare(
        `INSERT OR IGNORE INTO questions (id, difficulty, question, options, answer, source, topic, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        q.id,
        q.d || q.difficulty,
        sanitizeQuestionText(q.q || q.question),
        opts,
        q.a ?? q.answer,
        q.source || source,
        q.topic || null,
        q.created_at || now
      );
    });
    if (!stmts.length) continue;
    const results = await env.PURSUIT_DB.batch(stmts);
    inserted += results.filter((r) => r.meta?.changes > 0).length;
  }
  await env.PURSUIT_DB.prepare(
    "INSERT INTO pursuit_meta (key, value) VALUES ('last_seed_at', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
  ).bind(String(now)).run();
  return inserted;
}

export async function seedIfEmpty(env, seedBank) {
  const count = await getQuestionCount(env);
  if (count > 0) return { seeded: false, count };
  const inserted = await insertQuestions(env, seedBank, "seed");
  await env.PURSUIT_DB?.prepare(
    "INSERT INTO pursuit_meta (key, value) VALUES (?, '1') ON CONFLICT(key) DO UPDATE SET value = excluded.value"
  ).bind(PURSUIT_SEED_FLAG).run();
  return { seeded: true, inserted, count: await getQuestionCount(env) };
}

export async function recordQuestionFeedback(env, questionId, correct) {
  if (!env.PURSUIT_DB || !questionId) return;
  await ensureSchema(env);
  if (correct) {
    await env.PURSUIT_DB.prepare(
      "UPDATE questions SET times_asked = times_asked + 1 WHERE id = ?"
    ).bind(questionId).run();
  } else {
    await env.PURSUIT_DB.prepare(
      "UPDATE questions SET times_asked = times_asked + 1, times_wrong = times_wrong + 1 WHERE id = ?"
    ).bind(questionId).run();
  }
}

export async function getPursuitStats(env) {
  const total = await getQuestionCount(env);
  let bySource = {};
  let lastRefresh = null;
  if (env.PURSUIT_DB && total > 0) {
    const src = await env.PURSUIT_DB.prepare(
      "SELECT source, COUNT(*) AS n FROM questions GROUP BY source"
    ).all();
    for (const row of src.results || []) {
      bySource[row.source] = Number(row.n);
    }
    const meta = await env.PURSUIT_DB.prepare(
      "SELECT value FROM pursuit_meta WHERE key = 'last_ai_refresh'"
    ).first();
    lastRefresh = meta?.value ? Number(meta.value) : null;
  }
  return { total, bySource, lastRefresh, scalable: true };
}

export function sanitizePursuitName(name) {
  return String(name || "")
    .replace(/[^\w\s\-'.]/gi, "")
    .trim()
    .slice(0, 20);
}

export function sanitizeQuestionText(text) {
  return String(text || "")
    .replace(/<[^>]*>/g, "")
    .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, "")
    .trim()
    .slice(0, 280);
}

export function publicQuestion(q) {
  if (!q) return q;
  return { id: q.id, d: q.d, q: q.q, o: q.o, source: q.source, topic: q.topic };
}

export async function checkQuestionAnswer(env, questionId, choice) {
  if (!env.PURSUIT_DB || !questionId) return null;
  await ensureSchema(env);
  const row = await env.PURSUIT_DB.prepare("SELECT answer FROM questions WHERE id = ?")
    .bind(questionId)
    .first();
  if (!row || row.answer == null) return null;
  const answer = Number(row.answer);
  const picked = Number(choice);
  if (picked < 0 || picked > 3) return null;
  return { correct: answer === picked, answer };
}

export function sanitizePlayerId(id) {
  return String(id || "")
    .replace(/[^a-zA-Z0-9_\-]/g, "")
    .slice(0, 64);
}

export async function getPlayerMemory(env, playerId) {
  const pid = sanitizePlayerId(playerId);
  if (!pid || !env.PURSUIT_KV) return null;
  const raw = await env.PURSUIT_KV.get(PURSUIT_MEMORY_PREFIX + pid);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function savePlayerMemory(env, playerId, data) {
  const pid = sanitizePlayerId(playerId);
  if (!pid || !env.PURSUIT_KV) return false;
  const payload = {
    playerId: pid,
    name: sanitizePursuitName(data.name),
    level: Math.max(1, Math.min(999, Math.floor(Number(data.level) || 1))),
    gamesPlayed: Math.max(0, Math.floor(Number(data.gamesPlayed) || 0)),
    wins: Math.max(0, Math.floor(Number(data.wins) || 0)),
    bestPot: Math.max(0, Math.floor(Number(data.bestPot) || 0)),
    preferredDiff: String(data.preferredDiff || "standard").slice(0, 20),
    weakTopics: Array.isArray(data.weakTopics) ? data.weakTopics.slice(0, 20) : [],
    updatedAt: Date.now(),
  };
  await env.PURSUIT_KV.put(PURSUIT_MEMORY_PREFIX + pid, JSON.stringify(payload));
  return payload;
}

export async function getLeaderboard(env) {
  if (!env.PURSUIT_KV) return [];
  const raw = await env.PURSUIT_KV.get(PURSUIT_LB_KEY);
  if (!raw) return [];
  try {
    const entries = JSON.parse(raw);
    return Array.isArray(entries) ? entries : [];
  } catch {
    return [];
  }
}

export async function addLeaderboardEntry(env, entry) {
  if (!env.PURSUIT_KV) return null;
  let entries = await getLeaderboard(env);
  entries.push(entry);
  entries.sort((a, b) => (b.score || 0) - (a.score || 0) || (b.at || 0) - (a.at || 0));
  entries = entries.slice(0, PURSUIT_LB_MAX);
  await env.PURSUIT_KV.put(PURSUIT_LB_KEY, JSON.stringify(entries));
  const rank = entries.findIndex(
    (e) => e.at === entry.at && e.name === entry.name && e.score === entry.score
  ) + 1;
  return rank || null;
}

function parseAiQuestions(text) {
  const cleaned = text.replace(/```json\s*/gi, "").replace(/```/g, "").trim();
  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    const match = cleaned.match(/\[[\s\S]*\]/);
    if (!match) return [];
    try {
      parsed = JSON.parse(match[0]);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(parsed)) return [];
  const out = [];
  const now = Date.now();
  for (let i = 0; i < parsed.length; i++) {
    const q = parsed[i];
    const opts = Array.isArray(q.o) ? q.o : Array.isArray(q.options) ? q.options : [];
    const diff = DIFFICULTIES.has(q.d) ? q.d : DIFFICULTIES.has(q.difficulty) ? q.difficulty : "medium";
    const ans = Number(q.a ?? q.answer);
    const textQ = sanitizeQuestionText(q.q || q.question || "");
    const candidate = {
      id: `ai${now}${i}`,
      d: diff,
      q: textQ,
      o: opts.map((x) => String(x).slice(0, 120)),
      a: ans,
      source: "current_events",
      topic: String(q.topic || "current events").slice(0, 80),
      created_at: now,
    };
    if (!validateQuestion(candidate)) continue;
    out.push(candidate);
  }
  return out;
}

export async function refreshQuestionsWithAi(env, geminiFn, apiKey, { batchSize = AI_BATCH_SIZE } = {}) {
  if (!env.PURSUIT_DB || !apiKey || !geminiFn) {
    return { ok: false, error: "missing db or ai key" };
  }
  await ensureSchema(env);

  const weak = await env.PURSUIT_DB.prepare(
    `SELECT topic FROM questions WHERE times_wrong > 2 AND times_asked > 0
     ORDER BY (CAST(times_wrong AS REAL) / times_asked) DESC LIMIT 5`
  ).all();
  const weakTopics = (weak.results || []).map((r) => r.topic).filter(Boolean);

  const month = new Date().toLocaleString("en-GB", { month: "long", year: "numeric" });
  const prompt = `You are a UK pub-quiz question writer for an original quiz game (NOT copying any TV show).
Generate exactly ${batchSize} multiple-choice general-knowledge questions as a JSON array.
Mix difficulty: easy, medium, hard, expert.
Include 40% about recent public facts and current events from ${month} (sport, politics, science, UK/Ireland news — only well-established public facts, no gossip).
Avoid repeating these weak topics players struggle with: ${weakTopics.join(", ") || "none yet"}.
Each item: {"d":"easy|medium|hard|expert","q":"question?","o":["A","B","C","D"],"a":0-3,"topic":"short tag"}
Return ONLY valid JSON array, no markdown.`;

  const raw = await geminiFn(prompt, apiKey);
  const candidates = parseAiQuestions(raw);
  if (!candidates.length) return { ok: false, error: "ai returned no valid questions" };

  const inserted = await insertQuestions(env, candidates, "current_events");
  const now = Date.now();
  await env.PURSUIT_DB.prepare(
    "INSERT INTO pursuit_meta (key, value) VALUES ('last_ai_refresh', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
  ).bind(String(now)).run();

  return { ok: true, inserted, total: await getQuestionCount(env), at: now };
}

/** Procedural expansion — unique template variants for massive banks (offline, no AI cost). */
export async function expandProceduralQuestions(env, targetCount = 5000) {
  if (!env.PURSUIT_DB) return { ok: false, error: "no db" };
  await ensureSchema(env);
  const current = await getQuestionCount(env);
  if (current >= targetCount) return { ok: true, inserted: 0, total: current };

  const batch = [];
  const now = Date.now();
  let seq = current;
  while (current + batch.length < targetCount && batch.length < 2000) {
    const n = 2 + (seq % 97);
    const m = 1 + (seq % 53);
    const sum = n + m;
    batch.push({
      id: `p${seq}`,
      d: "easy",
      q: `What is ${n} plus ${m}?`,
      o: [String(sum), String(sum + 1), String(sum + 2), String(sum + 3)],
      a: 0,
      source: "procedural",
      topic: "math",
      created_at: now,
    });
    seq++;
    if (current + batch.length >= targetCount || batch.length >= 2000) break;
    const sq = n * n;
    batch.push({
      id: `p${seq}`,
      d: "medium",
      q: `What is the square of ${n}?`,
      o: [String(sq), String(sq + 1), String(sq - 1), String(n * 10)],
      a: 0,
      source: "procedural",
      topic: "math",
      created_at: now,
    });
    seq++;
    if (current + batch.length >= targetCount || batch.length >= 2000) break;
    const days = n * 7;
    batch.push({
      id: `p${seq}`,
      d: "medium",
      q: `How many days are in ${n} weeks?`,
      o: [String(days), String(days + 7), String(n), String(n * 30)],
      a: 0,
      source: "procedural",
      topic: "math",
      created_at: now,
    });
    seq++;
  }
  const inserted = await insertQuestions(env, batch, "procedural");
  return { ok: true, inserted, total: await getQuestionCount(env) };
}


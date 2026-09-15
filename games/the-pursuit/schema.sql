-- Pursuit quiz — D1 schema (scales to millions of rows)
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
);

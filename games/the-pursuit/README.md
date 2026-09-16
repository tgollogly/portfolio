# The Pursuit

Original UK studio-style quiz game (Cash Builder → Head-to-Head → Final Chase). Fan-made demo — **not affiliated with any TV broadcast, trademark, or production company**.

## URLs

- **Subdomain:** https://pursuit.tgollogly.dev/ (also https://clover.tgollogly.dev/ redirects)
- **Path:** https://tgollogly.dev/games/the-pursuit/

## Cloudflare setup (one-time)

Workers & Pages → **portfolio1** → Settings → Domains → add `pursuit.tgollogly.dev`.

### Deploy command (important — cron fix)

This repo builds **three** Workers (`portfolio`, `test`, `portfolio1`) from one repo. Cron triggers must **only** attach to **portfolio1** (Free plan: 5 crons per account).

| Worker | Deploy command |
|--------|----------------|
| **portfolio1** (production) | `bash scripts/deploy-portfolio1.sh` |
| portfolio / test | `npx wrangler deploy` |

If `portfolio1` builds fail after adding Pursuit, delete stray crons on **portfolio** and **test** (Triggers tab), then redeploy portfolio1.

Bindings (in `wrangler.toml`):

| Binding | Purpose |
|---------|---------|
| `PURSUIT_KV` | Leaderboard + player memory (MCP-accessible) |
| `PURSUIT_DB` | D1 question bank (scales to millions of rows) |

Optional secret: `PURSUIT_REFRESH_SECRET` — Bearer token for manual `POST /api/pursuit-refresh` and `DELETE /api/pursuit-leaderboard` (reset global scores).

Reset leaderboard: `bash scripts/reset-pursuit-leaderboard.sh` or `PURSUIT_REFRESH_SECRET=… bash scripts/reset-pursuit-leaderboard.sh --api`

## Question bank (millions-scale)

Questions are **not** bundled in the browser anymore. The Worker serves them from **D1**:

| Endpoint | Purpose |
|----------|---------|
| `GET /api/pursuit-questions?count=24&pool=easy,medium&exclude=id1,id2` | Random questions for a game |
| `GET /api/pursuit-stats` | Total count, sources, last AI & feed refresh |
| `GET /api/pursuit-feeds` | BBC RSS sources, cached headlines, stats (no auth) |
| `GET /api/pursuit-mcp` | MCP manifest + **guardrails** policy (no auth) |
| `POST /api/pursuit-mcp` | Invoke read-only tools via **MCP Guardrail gateway** |

### MCP Guardrails (Agent Guardrails)

The Pursuit MCP server uses **programmatic guardrails** at the gateway layer (`lib/pursuit-mcp-guardrails.js`):

| Layer | Term | What it does |
|-------|------|--------------|
| **Tool-level restrictions** | Scope enforcement | Only `public_read` tools exposed; admin/write tools blocklisted |
| **Action guardrails** | Pre-execution authorization | `preToolHook` evaluates tool + scope before execution |
| **Content guardrails** | Payload inspection | Regex + AI privacy checks on all argument strings (SQL/XSS/path/PII) |
| **Programmatic guardrails** | Schema validation | Deterministic JSON schema per tool — no prompt-only rules |
| **Post-tool hook** | Output sanitization | Strips answer indices, redacts sensitive output |

Public tools: `get_stats`, `get_feeds`, `get_headlines`, `sample_questions`.  
Blocked from MCP: `reset_leaderboard`, `run_sql`, `insert_questions`, etc.

Works alongside **Cloudflare MCP** (`Cloudflare-bindings` KV/D1) — use Cloudflare MCP for infra; use `/api/pursuit-mcp` for quiz data with guardrails.
| `POST /api/pursuit-feedback` | `{ questionId, correct }` — self-improvement stats |
| `POST /api/pursuit-refresh` | Cron / admin: feeds + AI + procedural expansion |

**Growth:**

1. **Seed** — 743 hand-written questions from `questions.js` on first request
2. **News feeds** (no API keys) — twice daily on cron: ~50 Open Trivia DB + Wikipedia “on this day” + BBC RSS headline questions
3. **AI refresh** — after feeds: Gemini adds ~30 current-events questions using cached headlines; weak topics deprioritised
4. **Procedural** — math variants expand toward 10M (5k per cron run, cron only)

Static `questions.js` remains as offline fallback only.

## Player memory (MCP / KV)

Each player gets a stable ID in `localStorage`. Profile syncs to KV:

| Endpoint | Purpose |
|----------|---------|
| `GET /api/pursuit-memory?playerId=…` | Load cloud profile |
| `POST /api/pursuit-memory` | Save name, level, wins, best pot |

**Cloudflare MCP** (`Cloudflare-bindings` → KV namespace `pursuit-leaderboard`):

- Leaderboard: key `pursuit:leaderboard`
- Player memory: keys `pursuit:memory:{playerId}`

## Hidden from Google

- `noindex,nofollow` meta tags
- `X-Robots-Tag` from Worker
- `robots.txt` Disallow
- Not linked from homepage

## Difficulty

| Mode | Chaser strength | Question pool |
|------|-----------------|---------------|
| Rookie | 62% | Easy + Medium |
| Standard | 74% | Easy + Medium + Hard |
| Expert | 84% | Medium + Hard |
| Legend | 93% | Hard + Expert |

## iPhone Home Screen

1. Open https://tgollogly.dev/games/the-pursuit/ in **Safari**
2. Tap **Share** → **Add to Home Screen**
3. The gold crosshair **Pursuit** icon appears on your home screen

Regenerate icons: `python3 scripts/build-pursuit-icons.py`  
Regenerate seed file: `python3 scripts/build-pursuit-questions.py`

## Test

```bash
node games/the-pursuit/test-questions.mjs
node tests/pursuit-store.test.mjs
```

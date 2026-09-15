# The Pursuit

Original UK studio-style quiz game (Cash Builder → Head-to-Head → Final Chase). Fan-made demo — **not affiliated with any TV broadcast, trademark, or production company**.

## URLs

- **Subdomain:** https://pursuit.tgollogly.dev/ (also https://clover.tgollogly.dev/ redirects)
- **Path:** https://tgollogly.dev/games/the-pursuit/

## Cloudflare setup (one-time)

Workers & Pages → **portfolio1** → Settings → Domains → add `pursuit.tgollogly.dev`.

Bindings (in `wrangler.toml`):

| Binding | Purpose |
|---------|---------|
| `PURSUIT_KV` | Leaderboard + player memory (MCP-accessible) |
| `PURSUIT_DB` | D1 question bank (scales to millions of rows) |

Optional secret: `PURSUIT_REFRESH_SECRET` — Bearer token for manual `POST /api/pursuit-refresh`.

## Question bank (millions-scale)

Questions are **not** bundled in the browser anymore. The Worker serves them from **D1**:

| Endpoint | Purpose |
|----------|---------|
| `GET /api/pursuit-questions?count=24&pool=easy,medium&exclude=id1,id2` | Random questions for a game |
| `GET /api/pursuit-stats` | Total count, sources, last AI refresh |
| `POST /api/pursuit-feedback` | `{ questionId, correct }` — self-improvement stats |
| `POST /api/pursuit-refresh` | Cron / admin: AI current-events batch + procedural expansion |

**Growth:**

1. **Seed** — 743 hand-written questions from `questions.js` on first request
2. **Procedural** — math variants expand the bank toward 10M (5k per cron run)
3. **AI refresh** — twice daily (06:00 & 18:00 UTC): Gemini adds ~30 current-events questions; weak topics are deprioritised using wrong-answer stats

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

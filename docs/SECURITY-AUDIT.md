# Security audit (portfolio + Pursuit)

Last reviewed: 2026-09-16.

## Search engine & crawler blocking

| Layer | What it does |
|-------|----------------|
| `robots.txt` | `Disallow: /` for `*` and common AI crawlers (GPTBot, ClaudeBot, CCBot, Google-Extended, Bytespider, …) |
| `X-Robots-Tag` | Every HTML page gets `noindex, nofollow, noarchive, nosnippet, noimageindex` from `server.js` |
| `<meta name="robots">` | Key pages (home, privacy, Bettystown, Pursuit, CV, job finder) also carry noindex in HTML |

Social link previews (Facebook, WhatsApp, etc.) still work via explicit OG tags — robots blocking does not remove those.

Verify: `node tests/security-audit.test.mjs` or `node tests/run-all.mjs`.

## Fixed in code

| Issue | Fix |
|-------|-----|
| `/api/pursuit-refresh` trusted spoofable `CF-Scheduled` header | Cron runs via `scheduled()` only; HTTP requires `PURSUIT_REFRESH_SECRET` |
| Open refresh when secret unset | Fail closed (503) without secret |
| Background Gemini refresh on public GETs | Removed — refresh only via cron or authenticated POST |
| Answers exposed in `/api/pursuit-questions` | Stripped; scoring via `POST /api/pursuit-check-answer` |
| XSS in Pursuit question HTML | `escapeHtml()` on question text and options |
| AI question insert | `sanitizeQuestionText()` strips HTML |

## Cloudflare manual cleanup

| Item | Action |
|------|--------|
| Cron on **portfolio** / **test** | Dashboard → Triggers → delete (keep only on **portfolio1** if desired) |
| **portfolio** vs **portfolio1** | Keep **portfolio1** for production; review whether **portfolio** is still needed |
| Rate limiting | Dashboard → Security → WAF rate limit on `/api*` (recommended) |

## Production secrets checklist

| Secret | Required for |
|--------|----------------|
| `GEMINI_API_KEY` | AI chat, ATS; optional Pursuit refresh when `PURSUIT_USE_AI=true` |
| `CHALLENGE_SECRET` | Access gate cookies |
| `TURNSTILE_*` | Captcha (recommended if challenge enabled) |
| `PURSUIT_REFRESH_SECRET` | Manual `POST /api/pursuit-refresh` only |
| `JOB_FINDER_PASSWORD` | Job finder (recommended) |

## Already in good shape

- Privacy guardrails on `/api` AI (`lib/privacy-guardrails.js`)
- Parameterized D1 queries
- Gate cookie HMAC + HttpOnly
- CV/card paths blocked from AI context
- No committed secrets (`.dev.vars` gitignored)

## Residual risks (accepted / follow-up)

- `/api` AI has no built-in rate limit (use Cloudflare WAF)
- CORS `*` on API routes
- Offline `questions.js` fallback still contains answers in browser
- Pursuit leaderboard/memory POSTs are unauthenticated (demo scope)

Run tests: `node tests/run-all.mjs` (includes security-audit, privacy, pursuit, bettystown).

# Changelog

All notable changes to this portfolio site and repository.

---

## 2026-08-14 — Privacy, abuse response & security

### Why these changes were made

The site owner received abusive attention linked from **Facebook**, including unwanted sharing of personal content. These changes reduce public exposure of personal data, limit access to CV/downloads, and add optional server-side access controls. **Cloudflare Under Attack Mode** is also enabled at the DNS/dashboard level for immediate site-wide protection (separate from this repo).

Facebook does **not** get notified when you enable Under Attack Mode or change this repository. Visitors who click links **from** Facebook may see Cloudflare’s browser check before reaching the site.

---

### Privacy — live site

- **Mobile number removed** from CV page, business card, vCard, and wallet config.
- **CV page and PDF blocked** (`CV_HIDDEN = true` in `config.js` and `server.js`) — returns 404 on the live site; footer CV links hidden via `assets/cv-privacy.js`.
- **`cv.html` replaced** in the repo with a short “temporarily unavailable” stub (email contact only).
- **Personal CV sample removed** from ATS matcher demo; generic placeholder used instead.
- **`scripts/cv-profile.json`** — personal name/location removed from the repo.
- **Git history rewritten** to remove phone number and old full CV content from past commits.

### Privacy — chat & contact

- **Temporary chat maintenance message** (`CHAT_MAINTENANCE_MODE` in `config.js`) while AI backend keys are configured.
- **Work email only** remains the primary public contact: `thomas@tgollogly.dev`.

### Security — access challenge (optional, in code)

Added in `server.js` (can be disabled with `ACCESS_CHALLENGE_ENABLED = false`):

- Challenge for **Facebook referrer** traffic and **Northern Ireland / Belfast** geo (when enabled).
- **VPN/proxy blocking** (best-effort, via Cloudflare network data + ip-api.com).
- **Cloudflare Turnstile** captcha when `TURNSTILE_SITE_KEY` / `TURNSTILE_SECRET_KEY` secrets are set.
- **Logging** of IP, approximate geo, ISP, optional visit reason and GPS to Worker logs.
- **`privacy.html` updated** to describe the `tg_gate` cookie and security logging.

> **Note:** If using **Cloudflare Under Attack Mode** alone, set `ACCESS_CHALLENGE_ENABLED = false` in `server.js` to avoid visitors facing two challenges.

### AI backend

- Improved **GEMINI_API_KEY** handling and `/api/health` check.
- Added `.dev.vars.example` for local development.

### Documentation & legal

- **README** — MIT licence badge and disclaimer section.
- **LICENSE** — MIT, Copyright (c) 2026 Thomas Gollogly (unchanged).

---

## How to restore normal operation later

| Feature | Set |
|--------|-----|
| CV page & PDF | `CV_HIDDEN = false` in `config.js` and `server.js` |
| AI chat | `CHAT_MAINTENANCE_MODE = false` in `config.js` + set `GEMINI_API_KEY` in Cloudflare |
| Custom access gate | `ACCESS_CHALLENGE_ENABLED = false` in `server.js` |
| Under Attack Mode | Cloudflare dashboard → Overview → Off |

---

## Commits (main branch)

- Privacy mode (added then reverted on request)
- Remove mobile number site-wide; fix AI chat key handling
- Temporary chat maintenance message
- README disclaimer & licence badge
- Hide CV/PDF on live site; scrub repo CV data; rewrite git history
- Facebook/NI access challenge + VPN detection + expanded logging

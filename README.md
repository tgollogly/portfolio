
# Thomas Gollogly — Developer Portfolio

> A live portfolio of web applications I've designed, built and deployed end to end.
> Self-taught developer based in Northern Ireland — fluent with modern web tech and
> AI-assisted development. **Open to developer roles: junior, trainee, apprentice or contract.**

[![Live site](https://img.shields.io/badge/Live_site-tgollogly.dev-2f39c9?style=for-the-badge)](https://tgollogly.dev)
[![Email](https://img.shields.io/badge/Email-thomas@tgollogly.dev-2f39c9?style=for-the-badge&logo=maildotru&logoColor=white)](mailto:thomas@tgollogly.dev)
[![GitHub](https://img.shields.io/badge/GitHub-tgollogly%2Fportfolio-2f39c9?style=for-the-badge&logo=github&logoColor=white)](https://github.com/tgollogly/portfolio)
[![LinkedIn](https://img.shields.io/badge/LinkedIn-Thomas_Gollogly-2f39c9?style=for-the-badge&logo=linkedin&logoColor=white)](https://www.linkedin.com/in/thomasgollogly)

---

## 🚀 Projects

Each project is a **real, deployed application** — not a mockup. Case studies on the live site explain the technical choices behind each one.

| Project | What it does | Built with |
|---|---|---|
| 🧭 **[AI ATS Resume Matcher](https://tgollogly.dev/ats-matcher.html)** | Scores a CV against a job description, flags missing keywords, and generates a tailored cover letter + improved CV. Full-stack, with a secure serverless backend holding the API key. | JavaScript · Cloudflare Worker · Google Gemini API |
| 🌡️ **[Heat Anomaly Detector](https://tgollogly.dev/heat-dome.html)** | Live heat-risk dashboard that compares today with the 30-year climate average (WMO 1991–2020) to flag real heat anomalies — 3D terrain map, live precipitation radar, colour-coded warnings. | JavaScript · Open-Meteo API · MapLibre GL · RainViewer |
| 🏗️ **[BOM Desk](https://tgollogly.dev/bom-desk.html)** | Data administration console for manufacturing bills of materials. Eight live validation rules, import screening, CSV reports and a full audit log. Invented demo data. | React (client-side) |
| 🗄️ **[SQL Lab](https://tgollogly.dev/sql-lab.html)** | A real SQLite engine (WebAssembly) running in the browser over a five-table schema. Free-form query editor, worked examples from joins to window functions, CSV export. | SQL · SQLite · JavaScript |
| ✅ **[Test Bench](https://tgollogly.dev/test-bench.html)** | A typed validation library and its 28-case unit test suite, both compiled and executed in the browser. Includes a deliberate-regression button. | TypeScript · Testing |
| 📊 **[Beneish M-Score Screener](https://tgollogly.dev/beneish.html)** | Runs the full eight-factor forensic-accounting model in the browser to flag earnings-manipulation risk. Data never leaves the device. | JavaScript (client-side) |
| 🔥 **[Thermal Compare](https://tgollogly.dev/thermal-compare.html)** | Compares live "feels-like" conditions across multiple locations, ranked. | JavaScript · Open-Meteo API |
| 📁 **[BundleBuilder](https://tgollogly.dev/bundlebuilder.html)** | Creates the structure of a court bundle — a case title page, a numbered index, and a printable divider for each exhibit, in the order you set. Print and slot your documents behind each divider. | JavaScript (client-side) |

---

## 🛠️ Tech

**Frontend** — JavaScript · HTML5 / CSS · MapLibre / Leaflet · SVG / Canvas · responsive / mobile-first
**Backend** — Serverless (Cloudflare Workers) · REST / JSON APIs
**Data / AI** — Google Gemini API · public APIs · AI-assisted development
**DevOps** — Git / GitHub · continuous deployment · encrypted secrets · wrangler
**Also working with** — React · Node.js · Python · PostgreSQL

---

## 🔒 Running the AI features

The chatbot and ATS Matcher call a small serverless backend (`server.js`) that reads a Google Gemini API key from an **encrypted secret** (`GEMINI_API_KEY`) set in Cloudflare. The key is **never** committed to this repo.

---

## 📂 Structure

    index.html            Homepage (projects, terminal intro, AI chatbot)
    cv.html               Developer profile page
    ats-matcher.html      AI ATS Resume Matcher tool
    heat-dome.html        Live demo + case study
    thermal-compare.html  Live demo + case study
    beneish.html          Live demo + case study
    bundlebuilder.html    Live demo + case study
    server.js             Serverless backend: serves the site + AI endpoint (/api)
    config.js             Points the frontend at the AI backend (/api)
    wrangler.toml         Cloudflare deployment config
    .assetsignore         Keeps backend/config files out of public assets
    README.md             This file — project overview
    LICENSE               MIT licence

---

## 📝 Notes

Demos are for demonstration only and are not legal, financial or professional advice. AI features send entered text to Google's Gemini API to generate a response; that text is not stored by the site. The site uses no tracking cookies.

---

*Designed and built by Thomas Gollogly · Licensed under the [MIT License](LICENSE).*

## Design system

Everything visual lives in `assets/site.css`. It is the single source of truth.

- **Type** — Fraunces (headings), Inter (body), IBM Plex Mono (code). Reference them as `var(--serif)`, `var(--sans)`, `var(--mono)`. Never name a font family directly in a page.
- **Colour** — one palette, declared once in `:root` in `site.css`. Pages must not declare `:root` and must not use raw hex. The only exception is the CSS embedded in the Word export in `ats-matcher.html`: that markup is downloaded and opened outside the browser, so custom properties cannot resolve and the token values are hardcoded there on purpose (with a comment saying so).
- **Shell** — `.sitebar` and `.sitefoot` are identical on every page except the home page, which has its own nav. Every demo page opens the same way: eyebrow (`Demo NN · topic`) → `h1` → lede → chips. Demo numbers match the `PROJECTS` array in `index.html`.
- **Brand mark** — the inline `TG` SVG carries `class="tg-mark"`; its colours come from `site.css`, not from `fill` attributes.
- **Chat** — `assets/chat.js` injects the AI assistant on every page. It has no page-specific styling and reads only tokens.

To add a page: link `assets/site.css`, then `assets/chat.js` and `config.js` before `</body>`, and use `.sitebar` / `.wrap head` / `.sitefoot`. Do not write a new `:root`.

The assistant's knowledge base is `THOMAS_CONTEXT` at the top of `server.js`. **If you add or change a demo, update it there too** — it is the only place the chatbot's facts live.

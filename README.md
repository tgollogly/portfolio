# Thomas Gollogly — Developer Portfolio

A live portfolio of web applications I've designed, built and deployed end to end.
Self-taught developer based in Newry, Northern Ireland — fluent with modern web tech
and AI-assisted development. Open to developer roles: trainee, apprentice, junior or contract.

**Live site:** https://tgollogly.dev
**Contact:** tgollogly@outlook.com

---

## Projects

Each project is a real, deployed application — not a mockup. Case studies on the live
site explain the technical choices behind each one.

| Project | What it does | Built with |
|---|---|---|
| **AI ATS Resume Matcher** | Scores a CV against a job description, flags missing keywords and suggests fixes. Full-stack, with a secure serverless backend holding the API key. | JavaScript · Cloudflare Worker · Google Gemini API |
| **Heat Dome Detector** | Live heat-risk dashboard: real-time weather, a 3D terrain map, live precipitation radar and colour-coded warnings. | JavaScript · Open-Meteo API · MapLibre GL · RainViewer |
| **Beneish M-Score Screener** | Runs the full eight-factor forensic-accounting model in the browser to flag earnings-manipulation risk. Data never leaves the device. | JavaScript (client-side) |
| **Thermal Compare** | Compares live "feels-like" conditions across multiple locations, ranked. | JavaScript · Open-Meteo API |
| **BundleBuilder** | Turns documents into a numbered, paginated court bundle with an index and exhibit dividers, exported to PDF. | JavaScript (client-side) |

---

## Tech

**Frontend:** JavaScript · HTML/CSS · MapLibre / Leaflet · SVG / Canvas · responsive/mobile-first
**Backend:** Serverless (Cloudflare Workers) · REST / JSON APIs
**Data / AI:** Google Gemini API · public APIs · AI-assisted development
**DevOps:** Git / GitHub · continuous deployment · encrypted secrets · wrangler
**Also working with:** React · Node.js · Python · PostgreSQL

---

## Structure

    index.html            Homepage (projects, terminal intro, AI chatbot)
    cv.html               CV / resume page (printable to PDF)
    ats-matcher.html      AI ATS Resume Matcher tool
    heat-dome.html        Live demo + case study
    thermal-compare.html  Live demo + case study
    beneish.html          Live demo + case study
    bundlebuilder.html    Live demo + case study
    server.js             Serverless backend: serves the site + AI endpoint (/api)
    config.js             Points the frontend at the AI backend (/api)
    wrangler.toml         Cloudflare deployment config (runs server.js as the Worker)
    .assetsignore         Keeps backend/config files from being served as public assets
    LICENSE               MIT licence

---

## Running the AI features

The chatbot and ATS Matcher call a small serverless backend (`server.js`) that reads a
Google Gemini API key from an encrypted secret (`GEMINI_API_KEY`) set in Cloudflare.
The key is **never** committed to this repo.

---

## Notes

The demos are for demonstration only and do not constitute legal, financial or
professional advice. AI features send entered text to Google's Gemini API to generate
a response; that text is not stored by the site. The site uses no tracking cookies.

---

*Designed and built by Thomas Gollogly. Licensed under the MIT License.*

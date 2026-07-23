
// =====================================================================
// _worker.js — serves the whole site AND the AI backend at /api
// Deploy this folder to Cloudflare Pages; set GEMINI_API_KEY as a secret.
// Nothing else to paste. The site works; /api powers the chatbot + ATS.
// =====================================================================
const MODEL = "gemini-3.5-flash"; // current free model (2.0 was retired June 2026); fallback: "gemini-flash-latest"

const THOMAS_CONTEXT = `You are the friendly, professional AI assistant on Thomas Gollogly's developer portfolio site (tgollogly.dev). Your job is to help visitors — usually recruiters or hiring managers — understand Thomas's skills and projects, and to encourage them to get in touch. Answer using ONLY the facts below. Keep answers concise (2-5 sentences) but specific and confident. Use UK English. If asked to run a demo, explain you can't operate the page but point them to the live demo on this site. If you don't know something, say so and suggest emailing Thomas. Never invent employers, dates, qualifications or technologies that aren't listed here.

WHO HE IS:
Thomas Gollogly is a self-taught developer based in Northern Ireland, available to work remotely. He designs, builds and deploys real, working web applications end to end — front end, back end, data and hosting — and is fluent with AI-assisted development. He is genuinely strong at shipping working software and at problem-solving and persistence: he built and debugged this whole site himself, including a live serverless backend. He is looking for a developer role: junior, trainee, apprentice or contract. Contact: thomas@tgollogly.dev.

TECH: JavaScript and TypeScript; HTML/CSS, responsive and mobile-first design; React; SQL and SQLite (including SQLite compiled to WebAssembly and run client-side); unit testing; MapLibre/Leaflet, SVG and Canvas; serverless back end on Cloudflare Workers; REST/JSON APIs; Google Gemini API integration; secure server-side secret handling; CSV import/export and data validation; Git/GitHub with continuous deployment. Also working with Node.js, Python and PostgreSQL.

THE EIGHT LIVE DEMOS (all on this site — invite people to try them):

1. AI ATS Resume Matcher (ats-matcher.html) — his flagship full-stack project. Paste a CV and a job description; it scores the match, lists missing keywords, and generates a tailored cover letter and an improved CV to download as a Word document. It solves an evidenced problem: most CVs are filtered by software before a human sees them. Technically notable because a Cloudflare Worker holds the AI key server-side and calls Google's Gemini model, so the key is never exposed in the browser. Shows front end, back end, API integration and security.

2. BOM Desk (bom-desk.html) — a React data-administration console for manufacturing bills of materials. It holds material and labour lines across projects, runs eight validation rules live (missing part codes, duplicate lines, nil unit costs, labour booked in the wrong unit, lines behind the current drawing revision, and others), rejects bad rows at import, and stamps every change to an audit log. CSV import and export. All demo data is invented. Shows React, data validation and audit-trail thinking.

3. SQL Lab (sql-lab.html) — a real SQLite engine compiled to WebAssembly and running inside the page. Five related tables of invented haulage data, a schema browser, and eleven worked queries covering joins, GROUP BY and HAVING, subqueries, CASE banding, CTEs and window functions. Visitors can write and run their own SQL and export results to CSV. No server involved; close the tab and the database is gone.

4. Test Bench (test-bench.html) — a typed validation library in TypeScript (UK postcodes, sort codes, IBAN checksums, strict dd/mm/yyyy dates, money held in pence, CSV escaping) with 28 unit tests covering the edge cases that actually bite. Library and test suite both run in the page. There's an "introduce a bug" button that makes the suite go red and name the failing case. Shows TypeScript, testing discipline and edge-case thinking.

5. Heat Anomaly Detector (heat-dome.html) — a live heat-risk dashboard. Enter any location and it compares today's forecast against the 30-year climate average (WMO 1991-2020, from Open-Meteo's historical archive) to flag genuine heat anomalies, shown on a 3D terrain map (MapLibre) with a live precipitation-radar overlay (RainViewer), colour-coded warnings and an auto-refresh watch mode. All free data, no API keys. Shows multiple live data sources, mapping and 3D.

6. Beneish M-Score Screener (beneish.html) — a forensic-accounting tool. Enter two years of a company's figures and it runs the full eight-factor Beneish model to flag a statistically elevated risk of earnings manipulation. Runs entirely in the browser, so financial data never leaves the user's device — a real privacy advantage. Shows precise algorithm implementation.

7. Thermal Compare (thermal-compare.html) — compares live "feels-like" conditions across several locations at once, ranked by apparent temperature, each fetched asynchronously so one slow response doesn't block the others. Live Open-Meteo data, no key or sign-up.

8. BundleBuilder (bundlebuilder.html) — creates the structure of a court bundle: a case title page, a numbered index, and a printable divider for each exhibit, in the order you set. You print these and slot your documents behind each divider. Built for people representing themselves in court. Everything stays on the user's device. It is a document-organising tool and explicitly not legal advice.

ALSO ON THE SITE: a printable CV page (cv.html), and this AI assistant, which appears on every page of the site.

DESIGN AND CODE QUALITY: the whole site runs on one shared stylesheet (assets/site.css) holding a single set of design tokens — one palette, one type scale, Fraunces for headings and Inter for body text, IBM Plex Mono for code. Every page links it; no page redeclares its own colours. The site bar, footer and this chat widget are shared components, so the site is consistent end to end. Thomas can talk about that decision if asked.

WHY HIRE HIM: he brings a rare mix for a junior candidate — he genuinely ships working products rather than tutorials, owns projects end to end, is fluent with modern AI-assisted workflows, writes and runs his own tests, and has shown real determination in self-teaching and debugging in production. Encourage the visitor to email him at thomas@tgollogly.dev about any opportunity.`;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/api") {
      if (request.method === "OPTIONS") return new Response(null, { headers: cors() });
      if (request.method === "POST") return handleAI(request, env);
      return new Response("POST only", { status: 405, headers: cors() });
    }
    return env.ASSETS.fetch(request); // everything else = your website files
  }
};


// Works with BOTH kinds of Cloudflare secret:
//  - classic secret / env var  -> env.GEMINI_API_KEY is a string
//  - Secrets Store binding     -> env.GEMINI_API_KEY.get() returns the value
async function getKey(env) {
  const k = env.GEMINI_API_KEY;
  if (!k) return null;
  if (typeof k === "string") return k;
  if (typeof k.get === "function") return await k.get();
  return null;
}

async function handleAI(request, env) {
  let body;
  try { body = await request.json(); } catch { return json({ error: "Bad JSON" }, 400); }
  const key = await getKey(env);
  if (!key) return json({ error: "Server not configured (no API key)" }, 500);
  try {
    if (body.mode === "chat") {
      const msg = (body.message || "").slice(0, 2000);
      const history = (body.history || []).slice(-6)
        .map(m => `${m.role === "user" ? "Visitor" : "Assistant"}: ${m.text}`).join("\n");
      const prompt = `${THOMAS_CONTEXT}\n\nConversation so far:\n${history}\n\nVisitor: ${msg}\nAssistant:`;
      return json({ reply: await gemini(prompt, key) });
    }
    if (body.mode === "ats") {
      const cv = (body.cv || "").slice(0, 9000);
      const jd = (body.jd || "").slice(0, 9000);
      const prompt = `You are an applicant-tracking-system (ATS) analyzer. Compare the CV to the JOB DESCRIPTION. Respond with ONLY valid JSON (no markdown fences), exactly this shape:
{"score": <integer 0-100 overall match>, "matched": [<up to 12 skills/keywords present in both>], "missing": [<up to 12 important keywords in the job description missing from the CV>], "suggestions": [<3 to 5 short, specific edits to improve the CV for THIS job>]}

CV:
${cv}

JOB DESCRIPTION:
${jd}`;
      const raw = await gemini(prompt, key);
      const clean = raw.replace(/```json|```/g, "").trim();
      let data; try { data = JSON.parse(clean); } catch { data = { error: "Could not parse", raw: clean }; }
      return json(data);
    }
    if (body.mode === "cover") {
      const cv = (body.cv || "").slice(0, 9000);
      const jd = (body.jd || "").slice(0, 9000);
      const prompt = `Write a professional, tailored cover letter for this job, based ONLY on the candidate's real CV below. 
STRICT RULES: Do not invent jobs, employers, dates, qualifications or skills. Only use what is in the CV. Focus ONLY on the experience and skills that are genuinely relevant to THIS job — do NOT pad the letter with unrelated past roles just to fill space. If the candidate lacks something the job wants, do not fake it; instead honestly emphasise transferable strengths, willingness to learn, and the working software they have built. Keep it genuine, not generic. The candidate is a self-taught, early-career developer — be confident but honest about that; never claim senior experience. 
STYLE: UK English, warm but professional, about 250-320 words, 3-4 short paragraphs. Start with "Dear Hiring Manager," and end with "Kind regards,\nThomas Gollogly". Do not use markdown, asterisks or headings — plain paragraphs only.

CANDIDATE CV:
${cv}

JOB DESCRIPTION:
${jd}`;
      return json({ text: await gemini(prompt, key) });
    }
    if (body.mode === "cvimprove") {
      const cv = (body.cv || "").slice(0, 9000);
      const jd = (body.jd || "").slice(0, 9000);
      const prompt = `Rewrite and lightly improve this candidate's CV so it is tailored to the job below and reads professionally.
STRICT RULES: Use ONLY information present in the original CV. Do NOT invent employers, job titles, dates, qualifications, or skills the CV doesn't contain. You may reorder, rephrase, sharpen wording, and emphasise the experience/skills most relevant to this job — but every claim must be true to the original. Prioritise the most relevant material; do NOT pad with unrelated work history. It is better to be concise and relevant than long and generic. The candidate is a self-taught, early-career developer; keep that honest.
FORMAT: Return clean plain text (no markdown symbols, no asterisks). Use these section headings in CAPITALS on their own line, in this order, each followed by its content:
NAME AND CONTACT
PROFILE
KEY SKILLS
PROJECTS
EDUCATION
Under PROJECTS and KEY SKILLS you may use simple hyphen bullet lines. Keep it concise (fits about one page).

ORIGINAL CV:
${cv}

JOB DESCRIPTION (tailor towards this):
${jd}`;
      return json({ text: await gemini(prompt, key) });
    }
    return json({ error: "Unknown mode" }, 400);
  } catch (e) {
    const rate = e && e.rate, allBusy = e && e.busyAll;
    const chatMsg = rate
      ? "I'm getting a lot of questions right now and have hit a short free-tier limit — please wait about a minute, then ask again. For anything urgent, email Thomas at thomas@tgollogly.dev."
      : allBusy
      ? "Google's AI models are very busy at the moment — this is temporary. Please try again shortly, or email Thomas at thomas@tgollogly.dev."
      : "I hit a brief snag answering that — please try again in a moment. (If it keeps happening, email Thomas at thomas@tgollogly.dev.)";
    if (body && body.mode === "chat") return json({ reply: chatMsg }, 200);
    return json({ error: rate ? "AI is at its free-tier limit — please wait a minute." : allBusy ? "AI models are busy right now — please try again shortly." : "The AI hit a brief snag — please try again." }, 200);
  }
}

// Free models tried in order. If one is overloaded/unavailable, fall back to the next.
const MODELS = [MODEL, "gemini-flash-latest", "gemini-2.5-flash", "gemini-2.0-flash-lite"];

async function callModel(model, payload, key) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
  return fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: payload });
}

async function gemini(prompt, key) {
  const payload = JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] });
  let lastErr = "no response";
  for (let i = 0; i < MODELS.length; i++) {
    let r;
    try { r = await callModel(MODELS[i], payload, key); }
    catch (netErr) { lastErr = "network error"; continue; }

    if (r.ok) {
      const d = await r.json();
      const text = d.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) return text;
      lastErr = "empty response"; continue;          // try next model
    }
    // 429 = rate limit: flag it and stop (trying other models won't help a per-project quota)
    if (r.status === 429) { const e = new Error("rate_limited"); e.rate = true; throw e; }
    // 503 (overloaded) or 404 (model unavailable): fall through to the next model
    if (r.status === 503 || r.status === 404) {
      if (r.status === 503) await new Promise(res => setTimeout(res, 800));
      const d = await r.json().catch(() => ({}));
      lastErr = d.error?.message || ("Gemini " + r.status);
      continue;                                        // try the next model in the list
    }
    // other errors (bad key, permission, etc.): report immediately, no point trying others
    const d = await r.json().catch(() => ({}));
    throw new Error(d.error?.message || ("Gemini error " + r.status));
  }
  // every model was busy/unavailable
  const e = new Error(lastErr); e.busyAll = true; throw e;
}

function cors() { return { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type" }; }
function json(obj, status = 200) { return new Response(JSON.stringify(obj), { status, headers: { ...cors(), "Content-Type": "application/json" } }); }

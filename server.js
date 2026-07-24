
// =====================================================================
// _worker.js — serves the whole site AND the AI backend at /api
// Deploy this folder to Cloudflare Pages; set GEMINI_API_KEY as a secret.
// Set JOB_FINDER_PASSWORD as a secret to lock the job finder page (optional for testing).
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

const JOB_FINDER_PATHS = new Set(["/job-finder.html", "/api/jobs", "/assets/job-finder.js"]);

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    if (JOB_FINDER_PATHS.has(path)) {
      const auth = await requireJobFinderAuth(request, env);
      if (!auth.ok) return auth.response;
    }

    if (path === "/api/jobs") {
      if (request.method === "OPTIONS") return new Response(null, { headers: corsGet() });
      if (request.method === "GET") return handleJobs(request, env);
      return new Response("GET only", { status: 405, headers: corsGet() });
    }
    if (url.pathname === "/api") {
      if (request.method === "OPTIONS") return new Response(null, { headers: cors() });
      if (request.method === "POST") return handleAI(request, env);
      return new Response("POST only", { status: 405, headers: cors() });
    }
    return env.ASSETS.fetch(request); // everything else = your website files
  }
};

async function handleJobs(request, env) {
  const profile = await loadJobProfile(request, env);
  const [remoteOk, devItUk, adzunaGb, adzunaIe, arbeitnow] = await Promise.all([
    fetchRemoteOkJobs(),
    fetchDevItJobsUk(),
    fetchAdzunaJobs(env, profile, "gb"),
    fetchAdzunaJobs(env, profile, "ie"),
    fetchArbeitnowJobs()
  ]);
  const jobs = dedupeNormalizedJobs([...remoteOk, ...devItUk, ...adzunaGb, ...adzunaIe, ...arbeitnow]);
  const sources = [];
  if (remoteOk.length) sources.push("RemoteOK");
  if (devItUk.length) sources.push("DevITjobs UK");
  if (adzunaGb.length) sources.push("Adzuna UK");
  if (adzunaIe.length) sources.push("Adzuna Ireland");
  if (arbeitnow.length) sources.push("Arbeitnow");
  return jsonGet({ jobs, meta: { sources, count: jobs.length } });
}

async function loadJobProfile(request, env) {
  try {
    const res = await env.ASSETS.fetch(new URL("/scripts/cv-profile.json", request.url));
    if (res.ok) return res.json();
  } catch { /* use defaults */ }
  return {
    role_keywords: ["junior developer", "trainee developer", "entry level developer"],
    search_locations: { gb: ["UK", "Northern Ireland", "Belfast"], ie: ["Ireland", "Dublin"] }
  };
}

function dedupeNormalizedJobs(jobs) {
  const seen = new Set();
  return jobs.filter((job) => {
    const key = `${normaliseJobText(job.title)}|${normaliseJobText(job.company)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function normaliseJobText(text) {
  return String(text || "").toLowerCase().replace(/\s+/g, " ").trim();
}

function detectWorkTypeFromText(title, description, location, source, remoteFlag) {
  const blob = ` ${normaliseJobText([title, description, location].join(" "))} `;
  if (source === "RemoteOK" || remoteFlag) return "remote";
  if (/\b(remote|work from home|wfh|anywhere|distributed|fully remote)\b/.test(blob)) return "remote";
  if (/\b(hybrid|flexible working|home\/office|partially remote|blended working)\b/.test(blob)) return "hybrid";
  return "on-site";
}

async function fetchRemoteOkJobs() {
  try {
    const response = await fetch("https://remoteok.com/api?tags=dev", {
      headers: { "User-Agent": "tgollogly-job-finder/1.0 (+https://tgollogly.dev)" }
    });
    if (!response.ok) return [];
    const payload = await response.json();
    if (!Array.isArray(payload)) return [];
    return payload
      .filter((item) => item && item.position)
      .map((item) => ({
        title: String(item.position || "").trim(),
        company: item.company || "Unknown",
        location: item.location || "Remote",
        country: "Global",
        url: item.url || item.apply_url || "",
        source: "RemoteOK",
        description: item.description || "",
        salary: item.salary_min || item.salary_max ? `$${item.salary_min || "?"} – $${item.salary_max || "?"}` : "",
        posted: item.date || "",
        workType: "remote"
      }));
  } catch {
    return [];
  }
}

async function fetchAdzunaJobs(env, profile, country) {
  const appId = await getSecret(env, "ADZUNA_APP_ID");
  const appKey = await getSecret(env, "ADZUNA_APP_KEY");
  if (!appId || !appKey) return [];

  const listings = [];
  const seen = new Set();
  const locations = (profile.search_locations?.[country] || []).slice(0, 6);
  const keywords = (profile.role_keywords || ["junior developer"]).slice(0, 5);
  const currency = country === "ie" ? "€" : "£";

  for (const keyword of keywords) {
    for (const where of locations) {
      const params = new URLSearchParams({
        app_id: appId,
        app_key: appKey,
        results_per_page: "15",
        what: keyword,
        where,
        max_days_old: "30",
        category: "it-jobs",
        "content-type": "application/json"
      });
      try {
        const response = await fetch(`https://api.adzuna.com/v1/api/jobs/${country}/search/1?${params}`);
        if (!response.ok) continue;
        const payload = await response.json();
        for (const item of payload.results || []) {
          const link = item.redirect_url || item.url || "";
          if (!link || seen.has(link)) continue;
          seen.add(link);
          const title = item.title || "";
          const description = item.description || "";
          const location = item.location?.display_name || where;
          listings.push({
            title: title.trim(),
            company: item.company?.display_name || "Unknown",
            location,
            country: country === "ie" ? "Ireland" : "UK",
            url: link,
            source: country === "ie" ? "Adzuna Ireland" : "Adzuna UK",
            description,
            salary: item.salary_min || item.salary_max ? `${currency}${item.salary_min || "?"} – ${currency}${item.salary_max || "?"}` : "",
            posted: item.created || "",
            workType: detectWorkTypeFromText(title, description, location, "Adzuna", false)
          });
        }
      } catch { /* try next query */ }
    }
  }
  return listings;
}

async function fetchArbeitnowJobs() {
  try {
    const response = await fetch("https://www.arbeitnow.com/api/job-board-api", {
      headers: { "User-Agent": "tgollogly-job-finder/1.0 (+https://tgollogly.dev)" }
    });
    if (!response.ok) return [];
    const payload = await response.json();
    const devTerms = ["developer", "engineer", "software", "frontend", "backend", "javascript", "typescript", "react", "node"];
    return (payload.data || [])
      .filter((item) => {
        const blob = normaliseJobText([item.title, item.description, ...(item.tags || [])].join(" "));
        return devTerms.some((term) => blob.includes(term));
      })
      .map((item) => ({
        title: String(item.title || "").trim(),
        company: item.company_name || "Unknown",
        location: item.location || (item.remote ? "Remote" : "Unknown"),
        country: item.remote ? "Global" : "Europe",
        url: item.url || "",
        source: "Arbeitnow",
        description: item.description || "",
        salary: "",
        posted: item.created_at ? new Date(item.created_at * 1000).toISOString().slice(0, 10) : "",
        workType: item.remote ? "remote" : detectWorkTypeFromText(item.title, item.description, item.location, "Arbeitnow", false)
      }));
  } catch {
    return [];
  }
}

function extractXmlCdata(block, tag) {
  const re = new RegExp(`<${tag}><!\\[CDATA\\[([\\s\\S]*?)\\]\\]></${tag}>`, "i");
  const match = block.match(re);
  return match ? match[1] : "";
}

function stripHtml(html) {
  return String(html || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

async function fetchDevItJobsUk() {
  try {
    const response = await fetch("https://devitjobs.uk/job_feed.xml", {
      headers: { "User-Agent": "tgollogly-job-finder/1.0 (+https://tgollogly.dev)" }
    });
    if (!response.ok) return [];
    const xml = await response.text();
    const devTerms = ["developer", "engineer", "software", "javascript", "typescript", "react", "node", "web", ".net", "python"];
    return xml.split(/<job\s+/).slice(1).flatMap((block) => {
      const title = extractXmlCdata(block, "title") || extractXmlCdata(block, "name");
      const description = stripHtml(extractXmlCdata(block, "description"));
      const blob = normaliseJobText([title, description].join(" "));
      if (!title || !devTerms.some((term) => blob.includes(term))) return [];
      const location = extractXmlCdata(block, "location") || extractXmlCdata(block, "city");
      const region = extractXmlCdata(block, "region");
      const fullLocation = [location, region].filter(Boolean).join(", ") || "UK";
      return [{
        title: title.trim(),
        company: extractXmlCdata(block, "company") || extractXmlCdata(block, "company-name") || "Unknown",
        location: fullLocation,
        country: extractXmlCdata(block, "country") || "UK",
        url: extractXmlCdata(block, "url") || extractXmlCdata(block, "link"),
        source: "DevITjobs UK",
        description,
        salary: extractXmlCdata(block, "salary"),
        posted: extractXmlCdata(block, "pubdate"),
        workType: detectWorkTypeFromText(title, description, fullLocation, "DevITjobs", false)
      }];
    });
  } catch {
    return [];
  }
}

async function getSecret(env, name) {
  const value = env[name];
  if (!value) return null;
  if (typeof value === "string") return value;
  if (typeof value.get === "function") return await value.get();
  return null;
}

async function requireJobFinderAuth(request, env) {
  const password = await getSecret(env, "JOB_FINDER_PASSWORD");
  if (!password) return { ok: true };
  if (checkBasicAuth(request, password)) return { ok: true };
  return { ok: false, response: jobFinderUnauthorized() };
}

function checkBasicAuth(request, password) {
  const header = request.headers.get("Authorization");
  if (!header?.startsWith("Basic ")) return false;
  try {
    const decoded = atob(header.slice(6));
    const idx = decoded.indexOf(":");
    const supplied = idx >= 0 ? decoded.slice(idx + 1) : decoded;
    return supplied === password;
  } catch {
    return false;
  }
}

function jobFinderUnauthorized() {
  return new Response("Password required.", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="Private job finder", charset="UTF-8"',
      "Content-Type": "text/plain; charset=utf-8"
    }
  });
}


// Works with BOTH kinds of Cloudflare secret:
//  - classic secret / env var  -> env.GEMINI_API_KEY is a string
//  - Secrets Store binding     -> env.GEMINI_API_KEY.get() returns the value
async function getKey(env) {
  return getSecret(env, "GEMINI_API_KEY");
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
function corsGet() { return { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, OPTIONS", "Access-Control-Allow-Headers": "Content-Type" }; }
function json(obj, status = 200) { return new Response(JSON.stringify(obj), { status, headers: { ...cors(), "Content-Type": "application/json" } }); }
function jsonGet(obj, status = 200) { return new Response(JSON.stringify(obj), { status, headers: { ...corsGet(), "Content-Type": "application/json", "Cache-Control": "public, max-age=300" } }); }

// =====================================================================
// _worker.js — serves the whole site AND the AI backend at /api
// Deploy this folder to Cloudflare Pages; set GEMINI_API_KEY as a secret.
// Nothing else to paste. The site works; /api powers the chatbot + ATS.
// =====================================================================
const MODEL = "gemini-3.5-flash"; // current free model (2.0 was retired June 2026); fallback: "gemini-flash-latest"

const THOMAS_CONTEXT = `You are the friendly, professional AI assistant on Thomas Gollogly's developer portfolio site. Your job is to help visitors (often recruiters or hiring managers) understand Thomas's skills and projects, and to encourage them to get in touch. Answer using ONLY the facts below. Keep answers concise (2-5 sentences) but specific and confident. If asked to actually run a demo, explain you can't operate the page but point them to the live demo right there. If you don't know something, say so and suggest emailing Thomas.

WHO HE IS:
Thomas Gollogly is a self-taught developer based in Newry, Northern Ireland, available to work remotely. He designs, builds and deploys real, working web applications end to end — front end, back end, data and hosting — and is fluent with AI-assisted development. He is genuinely strong at shipping working software and at problem-solving and persistence (he built and debugged this whole site, including a live serverless backend, himself). He is looking for a developer role: trainee, apprentice, junior, contract or freelance. Contact: tgollogly@outlook.com.

TECH: JavaScript, HTML/CSS, responsive/mobile-first design, MapLibre/Leaflet, SVG/Canvas; serverless back end (Cloudflare Workers), REST/JSON APIs; Google Gemini API integration; secure secret handling; Git/GitHub with continuous deployment. Also working with React, Node.js, Python and PostgreSQL.

PROJECTS (all live on this site — invite people to try them):

1. AI ATS Resume Matcher — his flagship, full-stack project. Paste a CV and a job description and it scores how well they match, lists the keywords the job wants that the CV is missing, and suggests fixes. It solves a real, evidenced problem: most CVs are filtered by software before a human sees them. Technically notable because it uses a secure serverless backend (Cloudflare Worker) that holds the AI key server-side and calls Google's Gemini model — so the key is never exposed in the browser. Shows he can do front end, back end, API integration and security.

2. Heat Dome Detector — a live heat-risk dashboard. Enter any location and it pulls real-time weather and radar, shows a 3D terrain map (MapLibre) with a live precipitation-radar overlay (RainViewer), and rates the heat risk with clear colour-coded warnings and an auto-refresh watch mode. All free, no API keys. Shows he can work with multiple live data sources, maps and 3D.

3. Beneish M-Score Screener — a forensic-accounting tool. Enter two years of a company's figures and it runs the full eight-factor Beneish model to flag a statistically elevated risk of earnings manipulation. Runs entirely in the browser, so financial data never leaves the user's device — a real privacy advantage. Shows he can implement a precise algorithm correctly.

4. Thermal Compare — compares live "feels-like" conditions across several locations at once, ranked, each fetched asynchronously so one slow response doesn't block the others.

5. BundleBuilder — turns a pile of documents into a clean, numbered, paginated court bundle with an index and exhibit dividers, exported to PDF. Built for people representing themselves in court. Everything stays on the user's device.

He also has an AI chatbot (that's me) on the site, and a printable CV page.

WHY HIRE HIM: he brings a rare mix for a junior candidate — he genuinely ships working products (not just tutorials), owns projects end to end, is fluent with modern AI-assisted workflows, and has shown real determination in self-teaching and debugging in production. Encourage the visitor to email him at tgollogly@outlook.com about any opportunity.`;

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
{"score": <integer 0-100 overall match>, "matched": [<up to 12 skills/keywords present in both>], "missing": [<up to 12 important keywords in the job description missing from the CV>], "suggestions": [

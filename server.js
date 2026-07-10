// =====================================================================
// _worker.js — serves the whole site AND the AI backend at /api
// Deploy this folder to Cloudflare Pages; set GEMINI_API_KEY as a secret.
// Nothing else to paste. The site works; /api powers the chatbot + ATS.
// =====================================================================
const MODEL = "gemini-3.5-flash"; // current free model (2.0 was retired June 2026); fallback: "gemini-flash-latest"

const THOMAS_CONTEXT = `You are the friendly AI assistant on Thomas Gollogly's developer portfolio site. Answer visitor questions about Thomas concisely, warmly and honestly, using ONLY the facts below. If you don't know, say so and suggest emailing him.

ABOUT: Thomas Gollogly is a self-taught developer in Newry, Northern Ireland, working remotely. He builds and ships real, working web applications end to end and is fluent with AI-assisted development. He is looking for a developer role: trainee, apprentice, junior or contract. Contact: tgollogly@outlook.com.

SKILLS: JavaScript, React, HTML/CSS, Node.js, Express, Python, PostgreSQL, REST APIs, MapLibre/Leaflet, SVG/Canvas, Stripe, JWT, Netlify, Cloudflare, WordPress, AI-assisted development.

PROJECTS (all live on this site):
- AI ATS Resume Matcher: scores a CV against a job description and lists missing keywords (full-stack, with a secure serverless backend).
- Heat Dome Detector: live heat-risk dashboard with a 3D terrain map, live weather radar and colour-coded warnings.
- Beneish M-Score Screener: runs the full 8-factor forensic-accounting model in the browser; data never leaves the device.
- Thermal Compare: compares live feels-like conditions across locations.
- BundleBuilder: builds a numbered, paginated court bundle with index and exhibit dividers.

Keep answers short (2-4 sentences). Encourage contacting Thomas about opportunities.`;

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
    return json({ error: "Unknown mode" }, 400);
  } catch (e) {
    // Friendly message so visitors never see a scary error (usually a brief rate limit)
    if (body && body.mode === "chat") {
      return json({ reply: "I'm just catching my breath for a second — please send that again in a moment. (If it keeps happening, email Thomas at tgollogly@outlook.com.)" }, 200);
    }
    return json({ error: "The AI is busy right now — please try again in a few seconds." }, 200);
  }
}

async function gemini(prompt, key) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${key}`;
  const payload = JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] });
  let last;
  // Up to 3 attempts: transient rate-limit (429) / overloaded (503) get a short backoff and retry
  for (let attempt = 0; attempt < 3; attempt++) {
    const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: payload });
    if (r.ok) {
      const d = await r.json();
      return d.candidates?.[0]?.content?.parts?.[0]?.text || "(no response)";
    }
    last = r.status;
    if (r.status === 429 || r.status === 503) {
      await new Promise(res => setTimeout(res, 700 * (attempt + 1))); // 0.7s, 1.4s
      continue;
    }
    const d = await r.json().catch(() => ({}));
    throw new Error(d.error?.message || ("Gemini error " + r.status));
  }
  throw new Error("Gemini busy (" + last + ")");
}

function cors() { return { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type" }; }
function json(obj, status = 200) { return new Response(JSON.stringify(obj), { status, headers: { ...cors(), "Content-Type": "application/json" } }); }

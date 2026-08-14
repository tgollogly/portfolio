
// =====================================================================
// _worker.js — serves the whole site AND the AI backend at /api
// Deploy this folder to Cloudflare Pages; set GEMINI_API_KEY as a secret.
// Set JOB_FINDER_PASSWORD as a secret to lock the job finder page (optional for testing).
// Nothing else to paste. The site works; /api powers the chatbot + ATS.
// =====================================================================
const MODEL = "gemini-3.5-flash"; // current free model (2.0 was retired June 2026); fallback: "gemini-flash-latest"

// Keep in sync with CV_HIDDEN in config.js — set false to restore CV page and PDF.
const CV_HIDDEN = true;

const CV_BLOCKED_PATHS = new Set(["/cv.html", "/Thomas-Gollogly-CV.pdf"]);

function isCvBlockedPath(path) {
  if (!CV_HIDDEN) return false;
  if (CV_BLOCKED_PATHS.has(path)) return true;
  if (/Thomas-Gollogly.*\.pdf$/i.test(path)) return true;
  return false;
}

function getThomasContext() {
  if (!CV_HIDDEN) return THOMAS_CONTEXT;
  return THOMAS_CONTEXT.replace(
    "ALSO ON THE SITE: a printable CV page (cv.html), and this AI assistant, which appears on every page of the site.",
    "ALSO ON THE SITE: this AI assistant, which appears on every page of the site. Thomas's CV is not published on the site right now — if asked for a CV, suggest emailing thomas@tgollogly.dev."
  );
}

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

// ===== ACCESS CHALLENGE (anti-abuse from Facebook sharing) =====
// Set TURNSTILE_SITE_KEY + TURNSTILE_SECRET_KEY in Cloudflare to enable captcha.
// Keep ACCESS_CHALLENGE_ENABLED false to disable entirely.
const ACCESS_CHALLENGE_ENABLED = true;
const CHALLENGE_FACEBOOK_REFERRER = true;
// WARNING: if true, EVERY visitor from NI/Belfast must pass the gate — including recruiters and you.
const CHALLENGE_NI_GEO = false;

const GATE_COOKIE = "tg_gate";
const GATE_MAX_AGE_SEC = 7 * 24 * 60 * 60;
const FACEBOOK_RE = /(^|\.)facebook\.com$|(^|\.)fb\.com$/i;

function isDocumentPath(path) {
  if (path === "/") return true;
  if (path.endsWith(".html")) return true;
  if (!path.includes(".") && !path.startsWith("/api") && !path.startsWith("/assets/")) return true;
  return false;
}

function isFacebookTraffic(request, url) {
  if (!CHALLENGE_FACEBOOK_REFERRER) return false;
  if (url.searchParams.has("fbclid")) return true;
  const referer = request.headers.get("Referer") || "";
  if (!referer) return false;
  try {
    return FACEBOOK_RE.test(new URL(referer).hostname);
  } catch {
    return /facebook\.com|fb\.com/i.test(referer);
  }
}

function isNorthernIrelandTraffic(request) {
  if (!CHALLENGE_NI_GEO) return false;
  const cf = request.cf || {};
  const country = String(cf.country || request.headers.get("CF-IPCountry") || "").toUpperCase();
  if (country !== "GB") return false;
  const region = String(cf.region || cf.regionCode || "").toLowerCase();
  const city = String(cf.city || "").toLowerCase();
  return region.includes("northern ireland") || city.includes("belfast");
}

function clientIp(request) {
  return request.headers.get("CF-Connecting-IP") || request.headers.get("X-Forwarded-For")?.split(",")[0]?.trim() || "unknown";
}

function geoSnapshot(request) {
  const cf = request.cf || {};
  return {
    ip: clientIp(request),
    country: cf.country || request.headers.get("CF-IPCountry") || null,
    region: cf.region || null,
    city: cf.city || null,
    colo: cf.colo || null,
    timezone: cf.timezone || null,
    asn: cf.asn || null,
  };
}

async function hmacSign(secret, message) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return btoa(String.fromCharCode(...new Uint8Array(sig)))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function gateSecret(env) {
  return (await getSecret(env, "CHALLENGE_SECRET")) || (await getSecret(env, "GEMINI_API_KEY")) || "change-me-in-cloudflare-secrets";
}

async function makeGateCookie(env) {
  const exp = Math.floor(Date.now() / 1000) + GATE_MAX_AGE_SEC;
  const sig = await hmacSign(await gateSecret(env), String(exp));
  return `${exp}.${sig}`;
}

async function hasValidGateCookie(request, env) {
  const raw = getCookie(request, GATE_COOKIE);
  if (!raw) return false;
  const dot = raw.lastIndexOf(".");
  if (dot < 1) return false;
  const exp = Number(raw.slice(0, dot));
  const sig = raw.slice(dot + 1);
  if (!Number.isFinite(exp) || exp < Math.floor(Date.now() / 1000)) return false;
  const expected = await hmacSign(await gateSecret(env), String(exp));
  return sig === expected;
}

function getCookie(request, name) {
  const header = request.headers.get("Cookie") || "";
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx < 0) continue;
    if (part.slice(0, idx).trim() === name) return decodeURIComponent(part.slice(idx + 1).trim());
  }
  return null;
}

function shouldApplyChallenge(request, url, path) {
  if (!ACCESS_CHALLENGE_ENABLED) return false;
  if (!CHALLENGE_FACEBOOK_REFERRER && !CHALLENGE_NI_GEO) return false;
  if (path === "/access-challenge" || path === "/api/access-verify") return false;
  if (path.startsWith("/api/")) return false;
  if (!isDocumentPath(path)) return false;
  return isFacebookTraffic(request, url) || isNorthernIrelandTraffic(request);
}

function logAccessChallenge(entry) {
  console.log(JSON.stringify({ event: "access_challenge", ...entry, ts: new Date().toISOString() }));
}

async function verifyTurnstile(token, secret, ip) {
  const body = new URLSearchParams({ secret, response: token, remoteip: ip });
  const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body });
  const data = await res.json().catch(() => ({}));
  return !!data.success;
}

function challengeResponseHtml(siteKey, returnPath) {
  const safeReturn = returnPath.replace(/"/g, "&quot;");
  const turnstileBlock = siteKey
    ? `<div class="cf-turnstile" data-sitekey="${siteKey}" data-theme="light"></div><script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer><\/script>`
    : `<p class="warn">Captcha is not configured yet. The site owner must add Turnstile keys in Cloudflare.</p><label class="check"><input type="checkbox" id="confirm" required> I am a real visitor and not automated abuse traffic</label>`;

  return `<!DOCTYPE html>
<html lang="en"><head>
<meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<meta name="robots" content="noindex,nofollow"/>
<title>Quick access check · tgollogly.dev</title>
<style>
  :root{--accent:#2f39c9;--ink:#0b0f14;--muted:#4d5660;--line:#d6dbe1;--card:#fff;--sans:system-ui,-apple-system,Segoe UI,sans-serif}
  *{box-sizing:border-box} body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;background:#eef0fe;font-family:var(--sans);color:var(--ink);line-height:1.55}
  .card{max-width:520px;width:100%;background:var(--card);border:1px solid var(--line);border-radius:16px;padding:28px 26px;box-shadow:0 12px 32px rgba(15,20,23,.08)}
  h1{font-size:22px;margin:0 0 10px} p{color:var(--muted);margin:0 0 14px;font-size:15px}
  .why{background:#f7f8ff;border:1px solid #dfe3ff;border-radius:10px;padding:12px 14px;margin:0 0 16px;font-size:14px;color:#333}
  label{display:block;font-weight:600;font-size:13px;margin:12px 0 6px}
  textarea,input[type=text]{width:100%;border:1px solid var(--line);border-radius:10px;padding:10px 12px;font:inherit;font-size:14px}
  textarea{min-height:72px;resize:vertical}
  .check{display:flex;gap:8px;align-items:flex-start;font-weight:500;font-size:14px;color:var(--muted)}
  .check input{margin-top:3px}
  .warn{color:#8a6116;background:#fff8e6;border:1px solid #f0dfa8;border-radius:8px;padding:10px 12px;font-size:13px}
  button{margin-top:16px;width:100%;border:none;border-radius:10px;padding:12px 16px;font:inherit;font-weight:600;font-size:15px;background:var(--accent);color:#fff;cursor:pointer}
  button:disabled{opacity:.55;cursor:not-allowed}
  .fine{font-size:12px;color:#6b7280;margin-top:12px}
  .err{color:#b42318;font-size:13px;min-height:18px;margin-top:8px}
</style></head><body>
<main class="card">
  <h1>Quick access check</h1>
  <div class="why"><strong>Why am I seeing this?</strong> This portfolio site has had abusive traffic linked from Facebook. If you are a genuine visitor, please complete this short check so the site stays online for everyone else.</div>
  <p>Please turn off any VPN if you are using one — VPNs often block security checks. We log your <strong>IP address</strong> and <strong>approximate location from your connection</strong> (city/region level, not GPS) for security. Precise GPS is only recorded if you choose to share it below.</p>
  <form id="gateForm">
    <label for="reason">Why are you visiting? (optional)</label>
    <textarea id="reason" name="reason" maxlength="500" placeholder="e.g. Recruiter reviewing portfolio, saw a project demo link…"></textarea>
    <label for="gps">Precise location (optional — browser will ask permission)</label>
    <input id="gps" name="gps" type="text" readonly placeholder="Click ‘Share location’ if you want to provide GPS"/>
    <button type="button" id="geoBtn" style="margin-top:8px;background:#4750e6">Share location (optional)</button>
    ${turnstileBlock}
    <div class="err" id="err"></div>
    <button type="submit" id="submitBtn">Continue to site</button>
    <p class="fine">By continuing you agree to this security log as described in the <a href="/privacy.html">privacy notice</a>. This sets a short-lived access cookie (<code>tg_gate</code>).</p>
  </form>
</main>
<script>
(function(){
  var ret=${JSON.stringify(returnPath)};
  document.getElementById("geoBtn").onclick=function(){
    if(!navigator.geolocation){ document.getElementById("gps").value="Geolocation not supported"; return; }
    navigator.geolocation.getCurrentPosition(function(p){
      document.getElementById("gps").value=p.coords.latitude.toFixed(5)+", "+p.coords.longitude.toFixed(5)+" (accuracy ~"+Math.round(p.coords.accuracy||0)+"m)";
    }, function(){ document.getElementById("gps").value="Location not shared"; }, { enableHighAccuracy:false, timeout:10000, maximumAge:0 });
  };
  document.getElementById("gateForm").onsubmit=async function(e){
    e.preventDefault();
    var err=document.getElementById("err"); err.textContent="";
    var btn=document.getElementById("submitBtn"); btn.disabled=true;
    var token=window.turnstile ? turnstile.getResponse() : (document.getElementById("confirm")&&document.getElementById("confirm").checked ? "fallback-ok" : "");
    if(!token){ err.textContent="Please complete the captcha (or tick the confirmation box)."; btn.disabled=false; return; }
    try{
      var r=await fetch("/api/access-verify",{method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({ token:token, reason:document.getElementById("reason").value.trim(), gps:document.getElementById("gps").value.trim(), return:ret })});
      var d=await r.json();
      if(!r.ok||!d.ok){ err.textContent=d.error||"Could not verify access."; btn.disabled=false; if(window.turnstile) turnstile.reset(); return; }
      location.href=d.return||"/";
    }catch(x){ err.textContent="Network error — please try again."; btn.disabled=false; }
  };
})();
<\/script></body></html>`;
}

async function serveChallengePage(request, env) {
  const url = new URL(request.url);
  const returnPath = url.searchParams.get("r") || "/";
  const siteKey = (await getSecret(env, "TURNSTILE_SITE_KEY")) || "";
  return new Response(challengeResponseHtml(siteKey, returnPath), {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
  });
}

async function handleAccessVerify(request, env) {
  if (request.method === "OPTIONS") return new Response(null, { headers: cors() });
  if (request.method !== "POST") return json({ error: "POST only" }, 405);
  let body;
  try { body = await request.json(); } catch { return json({ error: "Bad JSON" }, 400); }

  const ip = clientIp(request);
  const geo = geoSnapshot(request);
  const turnstileSecret = await getSecret(env, "TURNSTILE_SECRET_KEY");
  const token = String(body.token || "");

  if (turnstileSecret) {
    if (!token || !(await verifyTurnstile(token, turnstileSecret, ip))) {
      return json({ error: "Captcha failed. If you use a VPN, try turning it off and retry." }, 403);
    }
  } else if (token !== "fallback-ok") {
    return json({ error: "Captcha not configured on server." }, 503);
  }

  const reason = String(body.reason || "").slice(0, 500);
  const gps = String(body.gps || "").slice(0, 120);
  const returnPath = safeReturnPath(body.return);

  logAccessChallenge({
    ip: geo.ip,
    country: geo.country,
    region: geo.region,
    city: geo.city,
    colo: geo.colo,
    asn: geo.asn,
    referer: request.headers.get("Referer") || null,
    userAgent: request.headers.get("User-Agent") || null,
    reason: reason || null,
    gps: gps || null,
    trigger: isFacebookTraffic(request, new URL(request.url)) ? "facebook" : "geo",
  });

  const cookieVal = await makeGateCookie(env);
  return new Response(JSON.stringify({ ok: true, return: returnPath }), {
    status: 200,
    headers: {
      ...cors(),
      "Content-Type": "application/json",
      "Set-Cookie": `${GATE_COOKIE}=${encodeURIComponent(cookieVal)}; Path=/; Max-Age=${GATE_MAX_AGE_SEC}; HttpOnly; Secure; SameSite=Lax`,
    },
  });
}

function safeReturnPath(value) {
  const path = String(value || "/");
  if (!path.startsWith("/") || path.startsWith("//")) return "/";
  return path;
}

function redirectChallenge(request, path) {
  const r = encodeURIComponent(path + (new URL(request.url).search || ""));
  return Response.redirect(`${new URL(request.url).origin}/access-challenge?r=${r}`, 302);
}

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
    if (url.pathname === "/api" || url.pathname === "/api/health") {
      if (request.method === "OPTIONS") return new Response(null, { headers: cors() });
      if (url.pathname === "/api/health" && request.method === "GET") return handleAIHealth(env);
      if (url.pathname === "/api" && request.method === "POST") return handleAI(request, env);
      return new Response(url.pathname === "/api/health" ? "GET only" : "POST only", { status: 405, headers: cors() });
    }
    if (path === "/api/access-verify") return handleAccessVerify(request, env);
    if (path === "/access-challenge") return serveChallengePage(request, env);
    if (isCvBlockedPath(path)) {
      return new Response("Not found", { status: 404 });
    }
    if (path.endsWith(".pkpass")) {
      const asset = await env.ASSETS.fetch(request);
      if (!asset.ok) return asset;
      const headers = new Headers(asset.headers);
      headers.set("Content-Type", "application/vnd.apple.pkpass");
      headers.set("Content-Disposition", 'attachment; filename="Thomas-Gollogly.pkpass"');
      return new Response(asset.body, { status: asset.status, headers });
    }
    if (path.endsWith(".vcf")) {
      const asset = await env.ASSETS.fetch(request);
      if (!asset.ok) return asset;
      const headers = new Headers(asset.headers);
      headers.set("Content-Type", "text/vcard; charset=utf-8");
      headers.set("Content-Disposition", 'attachment; filename="Thomas-Gollogly.vcf"');
      return new Response(asset.body, { status: asset.status, headers });
    }
    if (shouldApplyChallenge(request, url, path) && !(await hasValidGateCookie(request, env))) {
      return redirectChallenge(request, path);
    }
    return env.ASSETS.fetch(request); // everything else = your website files
  }
};

const DEV_ROLE_TERMS = ["developer", "engineer", "software", "frontend", "backend", "javascript", "typescript", "react", "node", "full-stack", "fullstack", "devops", ".net", "python", "web"];
const JOB_FETCH_HEADERS = { "User-Agent": "tgollogly-job-finder/1.0 (+https://tgollogly.dev)" };

async function handleJobs(request, env) {
  const profile = await loadJobProfile(request, env);
  const [remoteOk, devItUk, adzunaGb, adzunaIe, arbeitnow, jobicy, remotive, wwr, remote1st] = await Promise.all([
    fetchRemoteOkJobs(),
    fetchDevItJobsUk(),
    fetchAdzunaJobs(env, profile, "gb"),
    fetchAdzunaJobs(env, profile, "ie"),
    fetchArbeitnowJobs(),
    fetchJobicyJobs(),
    fetchRemotiveJobs(),
    fetchWeWorkRemotelyJobs(),
    fetchRemote1stJobs()
  ]);
  const jobs = dedupeNormalizedJobs([...remoteOk, ...devItUk, ...adzunaGb, ...adzunaIe, ...arbeitnow, ...jobicy, ...remotive, ...wwr, ...remote1st]);
  const sources = [];
  if (remoteOk.length) sources.push("RemoteOK");
  if (devItUk.length) sources.push("DevITjobs UK");
  if (adzunaGb.length) sources.push("Adzuna UK");
  if (adzunaIe.length) sources.push("Adzuna Ireland");
  if (arbeitnow.length) sources.push("Arbeitnow");
  if (jobicy.length) sources.push("Jobicy");
  if (remotive.length) sources.push("Remotive");
  if (wwr.length) sources.push("We Work Remotely");
  if (remote1st.length) sources.push("Remote1stJobs");
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

function isDevRoleBlob(blob) {
  return DEV_ROLE_TERMS.some((term) => blob.includes(term));
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
      headers: JOB_FETCH_HEADERS
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
      headers: JOB_FETCH_HEADERS
    });
    if (!response.ok) return [];
    const payload = await response.json();
    return (payload.data || [])
      .filter((item) => {
        const blob = normaliseJobText([item.title, item.description, ...(item.tags || [])].join(" "));
        return isDevRoleBlob(blob);
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

function extractXmlTag(block, tag) {
  const cdata = extractXmlCdata(block, tag);
  if (cdata) return cdata;
  const re = new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, "i");
  const match = block.match(re);
  return match ? match[1].trim() : "";
}

function decodeXmlEntities(text) {
  return String(text || "")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'");
}

function stripHtml(html) {
  return decodeXmlEntities(String(html || "")).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function splitCompanyTitle(rawTitle) {
  const title = String(rawTitle || "").trim();
  const idx = title.indexOf(": ");
  if (idx < 0) return { company: "Unknown", title };
  return { company: title.slice(0, idx).trim(), title: title.slice(idx + 2).trim() };
}

async function fetchJobicyJobs() {
  try {
    const response = await fetch("https://jobicy.com/api/v2/remote-jobs?count=100&tag=dev", {
      headers: JOB_FETCH_HEADERS
    });
    if (!response.ok) return [];
    const payload = await response.json();
    return (payload.jobs || []).map((item) => ({
      title: String(item.jobTitle || "").trim(),
      company: item.companyName || "Unknown",
      location: item.jobGeo || "Remote",
      country: "Global",
      url: item.url || "",
      source: "Jobicy",
      description: item.jobDescription || item.jobExcerpt || "",
      salary: "",
      posted: item.pubDate || "",
      workType: "remote"
    }));
  } catch {
    return [];
  }
}

async function fetchRemotiveJobs() {
  try {
    const response = await fetch("https://remotive.com/api/remote-jobs?category=software-dev", {
      headers: JOB_FETCH_HEADERS
    });
    if (!response.ok) return [];
    const payload = await response.json();
    return (payload.jobs || [])
      .filter((item) => {
        const blob = normaliseJobText([item.title, item.description, item.category, ...(item.tags || [])].join(" "));
        return isDevRoleBlob(blob);
      })
      .map((item) => ({
        title: String(item.title || "").trim(),
        company: item.company_name || "Unknown",
        location: item.candidate_required_location || "Remote",
        country: "Global",
        url: item.url || "",
        source: "Remotive",
        description: item.description || "",
        salary: item.salary || "",
        posted: item.publication_date || "",
        workType: "remote"
      }));
  } catch {
    return [];
  }
}

async function fetchWeWorkRemotelyJobs() {
  try {
    const response = await fetch("https://weworkremotely.com/categories/remote-programming-jobs.rss", {
      headers: JOB_FETCH_HEADERS
    });
    if (!response.ok) return [];
    const xml = await response.text();
    return xml.split(/<item>/).slice(1).flatMap((block) => {
      const rawTitle = extractXmlTag(block, "title");
      const { company, title } = splitCompanyTitle(rawTitle);
      const description = stripHtml(extractXmlTag(block, "description"));
      const blob = normaliseJobText([title, description, extractXmlTag(block, "category")].join(" "));
      if (!title || !isDevRoleBlob(blob)) return [];
      const location = extractXmlTag(block, "region") || "Remote";
      return [{
        title,
        company,
        location,
        country: "Global",
        url: extractXmlTag(block, "link"),
        source: "We Work Remotely",
        description,
        salary: "",
        posted: extractXmlTag(block, "pubDate"),
        workType: "remote"
      }];
    });
  } catch {
    return [];
  }
}

async function fetchRemote1stJobs() {
  try {
    const response = await fetch("https://www.remote1stjobs.com/jobs.json", {
      headers: JOB_FETCH_HEADERS
    });
    if (!response.ok) return [];
    const payload = await response.json();
    return (payload.jobs || [])
      .filter((item) => {
        const blob = normaliseJobText([item.title, item.description, item.category].join(" "));
        return isDevRoleBlob(blob);
      })
      .map((item) => ({
        title: String(item.title || "").trim(),
        company: item.company || "Unknown",
        location: item.location || "Remote",
        country: "UK/Europe",
        url: item.url || "",
        source: "Remote1stJobs",
        description: item.description || "",
        salary: "",
        posted: item.created_at || "",
        workType: "remote"
      }));
  } catch {
    return [];
  }
}

async function fetchDevItJobsUk() {
  try {
    const response = await fetch("https://devitjobs.uk/job_feed.xml", {
      headers: JOB_FETCH_HEADERS
    });
    if (!response.ok) return [];
    const xml = await response.text();
    return xml.split(/<job\s+/).slice(1).flatMap((block) => {
      const title = extractXmlCdata(block, "title") || extractXmlCdata(block, "name");
      const description = stripHtml(extractXmlCdata(block, "description"));
      const blob = normaliseJobText([title, description].join(" "));
      if (!title || !isDevRoleBlob(blob)) return [];
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
  if (value == null) return null;
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed || null;
  }
  if (typeof value === "object" && typeof value.get === "function") {
    try {
      const resolved = await value.get();
      if (typeof resolved === "string") {
        const trimmed = resolved.trim();
        return trimmed || null;
      }
      return resolved || null;
    } catch {
      return null;
    }
  }
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
  for (const name of ["GEMINI_API_KEY", "GOOGLE_API_KEY"]) {
    const key = await getSecret(env, name);
    if (key) return key;
  }
  return null;
}

const NO_AI_KEY_CHAT_REPLY =
  "The AI assistant isn't connected right now. Please email Thomas at thomas@tgollogly.dev and he'll get back to you.";

async function handleAIHealth(env) {
  const key = await getKey(env);
  return json({ ok: true, aiConfigured: !!key });
}

async function handleAI(request, env) {
  let body;
  try { body = await request.json(); } catch { return json({ error: "Bad JSON" }, 400); }
  const key = await getKey(env);
  if (!key) {
    if (body.mode === "chat") return json({ reply: NO_AI_KEY_CHAT_REPLY });
    return json({ error: "AI backend not configured. Set GEMINI_API_KEY in Cloudflare Pages → Settings → Variables and Secrets (Production)." }, 503);
  }
  try {
    if (body.mode === "chat") {
      const msg = (body.message || "").slice(0, 2000);
      const history = (body.history || []).slice(-6)
        .map(m => `${m.role === "user" ? "Visitor" : "Assistant"}: ${m.text}`).join("\n");
      const prompt = `${getThomasContext()}\n\nConversation so far:\n${history}\n\nVisitor: ${msg}\nAssistant:`;
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

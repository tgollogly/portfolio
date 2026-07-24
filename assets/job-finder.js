/** Shared profile + scoring for remote junior developer job search. */
export const CV_PROFILE = {
  skills: [
    "javascript", "typescript", "html", "css", "react", "node.js", "nodejs", "express",
    "sql", "sqlite", "postgresql", "postgres", "webassembly", "wasm", "serverless",
    "cloudflare", "rest", "api", "json", "jwt", "stripe", "gemini", "llm", "python",
    "git", "github", "ci/cd", "unit testing", "testing", "maplibre", "leaflet", "csv"
  ],
  preferredTerms: [
    "junior", "trainee", "apprentice", "entry level", "entry-level", "graduate scheme",
    "no experience required", "no prior experience", "no degree required", "degree not required",
    "self-taught", "self taught", "bootcamp", "career changer", "first developer role"
  ],
  excludeTerms: [
    "senior ", " lead ", "principal ", "staff engineer", "architect",
    "5+ years", "5 years", "7+ years", "10+ years", "minimum 3 years", "minimum 4 years",
    "minimum 5 years", "3+ years", "4+ years", "5 years experience", "3 years experience",
    "degree required", "bachelor's required", "bachelors required", "master's required",
    "masters required", "phd", "computer science degree required", "cs degree required",
    "must have a degree", "commercial experience required", "proven commercial experience",
    "extensive experience", "data entry clerk", "data entry ", "virtual assistant",
    "customer support representative", "on-site only", "onsite only", "office based only"
  ],
  developerTitleTerms: [
    "developer", "engineer", "programmer", "software", "web dev", "full stack", "fullstack",
    "frontend", "front end", "backend", "back end", "devops"
  ],
  remoteTerms: ["remote", "work from home", "wfh", "anywhere", "distributed", "worldwide"]
};

function normalise(text) {
  return String(text || "").toLowerCase().replace(/\s+/g, " ").trim();
}

function isDeveloperRole(title) {
  const haystack = normalise(title);
  return CV_PROFILE.developerTitleTerms.some((term) => haystack.includes(term));
}

function isRemoteJob(job) {
  if (job.source === "RemoteOK") return true;
  const blob = ` ${normalise([job.title, job.description, job.location].join(" "))} `;
  return CV_PROFILE.remoteTerms.some((term) => blob.includes(term)) || normalise(job.location).includes("remote");
}

export function rejectionReason(text, title) {
  const haystack = ` ${normalise(text)} `;
  for (const term of CV_PROFILE.excludeTerms) {
    if (haystack.includes(term.toLowerCase())) {
      return `excluded: contains '${term.trim()}'`;
    }
  }
  if (!isDeveloperRole(title)) {
    return "excluded: title is not a developer/engineer role";
  }
  const years = haystack.match(/(\d+)\+?\s*years?(?:\s+of)?\s+(?:commercial\s+)?experience/);
  if (years && Number(years[1]) >= 2) {
    return `excluded: asks for ${years[1]}+ years experience`;
  }
  if (/\b(degree|bachelor|masters?|phd)\b.{0,40}\b(required|essential|must)\b/.test(haystack)) {
    return "excluded: degree appears required";
  }
  return "";
}

function friendlySignals(text) {
  const haystack = ` ${normalise(text)} `;
  return CV_PROFILE.preferredTerms.filter((term) => haystack.includes(term.toLowerCase())).slice(0, 6);
}

function skillMatches(text) {
  const haystack = normalise(text);
  const matched = [];
  for (const skill of CV_PROFILE.skills) {
    const token = skill.toLowerCase();
    if (token === "node.js" || token === "nodejs") {
      if (/\bnode(?:\.js)?\b/.test(haystack)) matched.push("Node.js");
      continue;
    }
    if (token === "ci/cd") {
      if (haystack.includes("ci/cd") || haystack.includes("continuous integration")) matched.push("CI/CD");
      continue;
    }
    const pattern = token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/ /g, "[\\s/-]?");
    if (new RegExp(`\\b${pattern}\\b`).test(haystack)) {
      matched.push(skill[0] === skill[0].toUpperCase() ? skill : skill.replace(/\b\w/g, (c) => c.toUpperCase()));
    }
  }
  const seen = new Set();
  const unique = [];
  for (const item of matched) {
    const key = item.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(item);
    }
  }
  return unique;
}

export function scoreJob(job, { remoteOnly = true } = {}) {
  const blob = [job.title, job.description, job.location].join(" ");
  const reason = rejectionReason(blob, job.title);
  if (reason) {
    return { ...job, rejectionReason: reason, matchScore: 0, matchedSkills: [], friendlySignals: [] };
  }
  if (remoteOnly && !isRemoteJob(job)) {
    return { ...job, rejectionReason: "excluded: not a remote role", matchScore: 0, matchedSkills: [], friendlySignals: [] };
  }

  const skills = skillMatches(blob);
  const signals = friendlySignals(blob);
  const title = normalise(job.title);
  let score = Math.min(skills.length * 8, 56);
  score += Math.min(signals.length * 5, 25);
  if (["junior", "trainee", "apprentice", "graduate", "entry level", "entry-level"].some((word) => title.includes(word))) {
    score += 12;
  }
  if (isRemoteJob(job)) score += 6;

  return {
    ...job,
    matchedSkills: skills,
    friendlySignals: signals,
    matchScore: Math.round(Math.min(score, 100) * 10) / 10,
    rejectionReason: ""
  };
}

export function mapRemoteOkItem(item) {
  const salary =
    item.salary_min || item.salary_max
      ? `$${item.salary_min || "?"} – $${item.salary_max || "?"}`
      : "";
  return {
    title: String(item.position || "").trim(),
    company: item.company || "Unknown",
    location: item.location || "Remote",
    url: item.url || item.apply_url || "",
    source: "RemoteOK",
    description: item.description || "",
    salary,
    posted: item.date || ""
  };
}

export function rankJobs(rawJobs, { minScore = 20, limit = 30, remoteOnly = true } = {}) {
  const seen = new Set();
  const scored = [];
  for (const raw of rawJobs) {
    const key = `${normalise(raw.title)}|${normalise(raw.company)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const job = scoreJob(raw, { remoteOnly });
    if (!job.rejectionReason && job.matchScore >= minScore) scored.push(job);
  }
  scored.sort((a, b) => b.matchScore - a.matchScore || a.title.localeCompare(b.title));
  return scored.slice(0, limit);
}

export async function fetchRemoteJobs() {
  const response = await fetch("/api/jobs", {
    headers: { Accept: "application/json" },
    credentials: "same-origin"
  });
  if (!response.ok) throw new Error(`Job feed unavailable (${response.status})`);
  const payload = await response.json();
  if (!Array.isArray(payload)) throw new Error("Unexpected job feed format");
  return payload
    .filter((item) => item && typeof item === "object" && item.position)
    .map(mapRemoteOkItem);
}

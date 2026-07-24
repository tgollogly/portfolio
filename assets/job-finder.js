/** Shared profile + scoring for junior developer job search. */
export const CV_PROFILE = {
  skills: [
    "javascript", "typescript", "html", "css", "react", "node.js", "nodejs", "express",
    "sql", "sqlite", "postgresql", "postgres", "webassembly", "wasm", "serverless",
    "cloudflare", "rest", "api", "json", "jwt", "stripe", "gemini", "llm", "python",
    "git", "github", "ci/cd", "unit testing", "testing", "maplibre", "leaflet", "csv"
  ],
  preferredTerms: [
    "junior", "trainee", "apprentice", "entry level", "entry-level", "graduate scheme",
    "graduate programme", "no experience required", "no prior experience", "no degree required",
    "degree not required", "self-taught", "self taught", "bootcamp", "career changer",
    "first developer role"
  ],
  excludeTerms: [
    "senior ", " lead ", "principal ", "staff engineer", "architect",
    "5+ years", "5 years", "7+ years", "10+ years", "minimum 3 years", "minimum 4 years",
    "minimum 5 years", "3+ years", "4+ years", "5 years experience", "3 years experience",
    "degree required", "bachelor's required", "bachelors required", "master's required",
    "masters required", "phd", "computer science degree required", "cs degree required",
    "must have a degree", "commercial experience required", "proven commercial experience",
    "extensive experience", "data entry clerk", "data entry ", "virtual assistant",
    "customer support representative"
  ],
  developerTitleTerms: [
    "developer", "engineer", "programmer", "software", "web dev", "full stack", "fullstack",
    "frontend", "front end", "backend", "back end", "devops"
  ],
  remoteTerms: ["remote", "work from home", "wfh", "anywhere", "distributed", "worldwide", "fully remote"],
  hybridTerms: ["hybrid", "flexible working", "home/office", "office and home", "partially remote", "blended working"],
  localLocationTerms: [
    "northern ireland", "belfast", "newry", "armagh", "derry", "londonderry", "dublin", "cork",
    "galway", "limerick", "ireland", "united kingdom", " uk", "england", "scotland", "wales"
  ]
};

function normalise(text) {
  return String(text || "").toLowerCase().replace(/\s+/g, " ").trim();
}

function isDeveloperRole(title) {
  const haystack = normalise(title);
  return CV_PROFILE.developerTitleTerms.some((term) => haystack.includes(term));
}

export function detectWorkType(job) {
  if (job.workType) return job.workType;
  const blob = ` ${normalise([job.title, job.description, job.location].join(" "))} `;
  const remoteSources = new Set(["RemoteOK", "Jobicy", "Remotive", "We Work Remotely", "Remote1stJobs"]);
  if (remoteSources.has(job.source) || CV_PROFILE.remoteTerms.some((term) => blob.includes(term))) return "remote";
  if (CV_PROFILE.hybridTerms.some((term) => blob.includes(term))) return "hybrid";
  if (CV_PROFILE.localLocationTerms.some((term) => blob.includes(term))) return "on-site";
  return "unknown";
}

function isLocalUkIe(job) {
  const blob = ` ${normalise([job.title, job.description, job.location, job.country || ""].join(" "))} `;
  return CV_PROFILE.localLocationTerms.some((term) => blob.includes(term));
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

function matchesWorkType(job, workTypeFilter) {
  if (!workTypeFilter || workTypeFilter === "all") return true;
  const type = detectWorkType(job);
  if (workTypeFilter === "remote") return type === "remote";
  if (workTypeFilter === "hybrid") return type === "hybrid";
  if (workTypeFilter === "local") return type === "on-site" || isLocalUkIe(job);
  return true;
}

export function scoreJob(job, { workTypeFilter = "all" } = {}) {
  const blob = [job.title, job.description, job.location].join(" ");
  const reason = rejectionReason(blob, job.title);
  if (reason) {
    return { ...job, rejectionReason: reason, matchScore: 0, matchedSkills: [], friendlySignals: [], workType: detectWorkType(job) };
  }
  if (!matchesWorkType(job, workTypeFilter)) {
    return { ...job, rejectionReason: `excluded: does not match ${workTypeFilter} filter`, matchScore: 0, matchedSkills: [], friendlySignals: [], workType: detectWorkType(job) };
  }

  const skills = skillMatches(blob);
  const signals = friendlySignals(blob);
  const title = normalise(job.title);
  const workType = detectWorkType(job);
  let score = Math.min(skills.length * 8, 56);
  score += Math.min(signals.length * 5, 25);
  if (["junior", "trainee", "apprentice", "graduate", "entry level", "entry-level"].some((word) => title.includes(word))) {
    score += 12;
  }
  if (workType === "remote") score += 5;
  if (workType === "hybrid") score += 4;
  if (isLocalUkIe(job)) score += 6;

  return {
    ...job,
    workType,
    matchedSkills: skills,
    friendlySignals: signals,
    matchScore: Math.round(Math.min(score, 100) * 10) / 10,
    rejectionReason: ""
  };
}

export function rankJobs(rawJobs, { minScore = 20, limit = 40, workTypeFilter = "all" } = {}) {
  const seen = new Set();
  const scored = [];
  for (const raw of rawJobs) {
    const key = `${normalise(raw.title)}|${normalise(raw.company)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const job = scoreJob(raw, { workTypeFilter });
    if (!job.rejectionReason && job.matchScore >= minScore) scored.push(job);
  }
  scored.sort((a, b) => b.matchScore - a.matchScore || a.title.localeCompare(b.title));
  return scored.slice(0, limit);
}

export function normalizeRawJob(item) {
  if (item.title) return item;
  if (!item.position) return null;
  return {
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
  };
}

export async function fetchJobs() {
  const response = await fetch("/api/jobs", {
    headers: { Accept: "application/json" },
    credentials: "same-origin"
  });
  if (!response.ok) throw new Error(`Job feed unavailable (${response.status})`);
  const payload = await response.json();
  if (Array.isArray(payload.jobs)) return payload;
  if (Array.isArray(payload)) {
    const jobs = payload.map(normalizeRawJob).filter(Boolean);
    return { jobs, meta: { sources: ["RemoteOK"], count: jobs.length, note: "Site update pending — UK listings loading after deploy." } };
  }
  throw new Error("Unexpected job feed format");
}

export function workTypeLabel(type) {
  if (type === "remote") return "Remote";
  if (type === "hybrid") return "Hybrid";
  if (type === "on-site") return "On-site";
  return "Flexible";
}

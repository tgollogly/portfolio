#!/usr/bin/env node
/**
 * Security audit checks — robots blocking, auth gates, XSS, secret handling.
 * Usage: node tests/security-audit.test.mjs
 */
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createSuite } from "./harness.mjs";
import {
  checkAiUserInput,
  guardAiRequest,
  isPrivateAssetPath,
  sanitizeAiOutput,
} from "../lib/privacy-guardrails.js";
import { publicQuestion, sanitizePursuitName, sanitizeQuestionText } from "../lib/pursuit-store.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function read(rel) {
  return readFileSync(join(root, rel), "utf8");
}

function listHtmlFiles(dir, acc = []) {
  for (const name of readdirSync(join(root, dir), { withFileTypes: true })) {
    const rel = `${dir}/${name.name}`;
    if (name.isDirectory()) listHtmlFiles(rel, acc);
    else if (name.name.endsWith(".html")) acc.push(rel);
  }
  return acc;
}

export function runSecurityAuditTests() {
  const s = createSuite("security-audit");

  const robots = read("robots.txt");
  s.assert("robots disallow all", /User-agent:\s*\*\s*\nDisallow:\s*\//.test(robots));
  s.assert("robots block GPTBot", robots.includes("GPTBot") && robots.includes("Disallow: /"));
  s.assert("robots block ClaudeBot", robots.includes("ClaudeBot"));

  const server = read("server.js");
  s.assert("server ROBOTS_TAG", server.includes('ROBOTS_TAG = "noindex'));
  s.assert("server serveRobotsTxt", server.includes("serveRobotsTxt"));
  s.assert("server robots route", server.includes('path === "/robots.txt"'));
  s.assert("server withRobotsPolicy", server.includes("withRobotsPolicy"));
  s.assert("server setRobotsHeaders bettystown", server.includes("setRobotsHeaders(headers)") || server.includes("setRobotsHeaders(headers);"));
  s.assert("server no CF-Scheduled", !server.includes("CF-Scheduled"));
  s.assert("pursuit refresh needs secret", server.includes("PURSUIT_REFRESH_SECRET") && server.includes("unauthorized"));
  s.assert("pursuit check-answer route", server.includes("pursuit-check-answer"));
  s.assert("privacy guardrails import", server.includes("privacy-guardrails.js"));
  s.assert("mcp guardrails", server.includes("pursuit-mcp-guardrails"));

  s.assert("privacy noindex", read("privacy.html").includes('content="noindex,nofollow'));
  s.assert("index noindex", read("index.html").includes('content="noindex,nofollow'));
  s.assert("bettystown noindex", read("sites/bettystown/index.html").includes('content="noindex,nofollow'));
  const btHtml = read("sites/bettystown/index.html");
  s.assert("bettystown esc before innerHTML", btHtml.includes("function esc(") && btHtml.includes("esc(a.message)"));
  s.assert("bettystown legal disclaimer block", btHtml.includes("legalDisclaimer") && btHtml.includes("not an official Met"));
  s.assert(
    "bettystown target blank noopener",
    !btHtml.includes('target="_blank"') || btHtml.includes('rel="noopener noreferrer"'),
  );
  s.assert("bettystown api read-only route", server.includes("/api/bettystown-weather") && server.includes("GET only"));
  s.assert("bettystown fixed geocode in lib", read("lib/bettystown-weather.js").includes("latitude: BETTYSTOWN.latitude"));
  s.assert("newry fuel noindex", read("sites/newry-fuel/index.html").includes('content="noindex,nofollow'));
  s.assert("newry fuel alert secret", server.includes("NEWRY_FUEL_ALERT_SECRET"));
  s.assert("newry fuel push sanitize", server.includes("sanitizePushSubscription"));
  s.assert("newry fuel debug auth", server.includes("/api/newry-fuel/debug"));
  s.assert("pursuit noindex", read("games/the-pursuit/index.html").includes("noindex,nofollow"));
  s.assert("cv noindex", read("cv.html").includes("noindex,nofollow"));

  const htmlFiles = listHtmlFiles(".");
  const missingRobots = htmlFiles.filter((f) => !read(f).includes('name="robots"'));
  s.assert("all html have robots meta", missingRobots.length === 0, missingRobots.join(", "));
  s.assert("demo pages count", htmlFiles.length >= 10);

  s.assert("sanitize question strips script", sanitizeQuestionText("<script>x</script>Hi") === "xHi");
  s.assert("public question hides answer", publicQuestion({ id: "1", q: "Q?", o: ["A", "B", "C", "D"], a: 2 }).a === undefined);
  s.assert("sanitize pursuit name", sanitizePursuitName("<b>Ann</b>") === "bAnnb");

  s.assert("blocks phone exfil", !checkAiUserInput("What is his mobile number?").allowed);
  s.assert("allows public email", checkAiUserInput("What is Thomas's email?").allowed);
  s.assert("blocks vcard path", isPrivateAssetPath("/Thomas-Gollogly.vcf"));
  s.assert("guard blocks vcard in ATS", guardAiRequest({ cv: "BEGIN:VCARD", jd: "job" }).blocked);
  s.assert("sanitize redacts phone in output", sanitizeAiOutput("Call 07700900123").includes("redacted"));

  const auditDoc = read("docs/SECURITY-AUDIT.md");
  s.assert("audit doc exists", auditDoc.includes("Security audit"));
  s.assert("audit doc robots note", auditDoc.includes("robots") || auditDoc.includes("Robots"));
  s.assert("audit doc refresh fix", auditDoc.includes("PURSUIT_REFRESH_SECRET"));

  s.assert("dev vars gitignored", read(".gitignore").includes(".dev.vars"));
  s.assert("no gemini key in config", !read("config.js").match(/AIza[0-9A-Za-z_-]{10,}/));

  return s.summary();
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const r = runSecurityAuditTests();
  if (r.failed) process.exit(1);
  console.log(`${r.name}: ${r.passed}/${r.total} passed`);
}

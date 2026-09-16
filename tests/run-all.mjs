#!/usr/bin/env node
/**
 * Run full test suite — requires ≥100 tests and ≥99% pass rate.
 * Usage: node tests/run-all.mjs
 */
import { runAiSafetyMatrixTests } from "./ai-safety-matrix.test.mjs";
import { runMcpGuardrailsTests } from "./mcp-guardrails.test.mjs";
import { runPursuitExpandedTests } from "./pursuit-expanded.test.mjs";
import { runBettystownWeatherTests } from "./bettystown-weather.test.mjs";
import { runSecurityAuditTests } from "./security-audit.test.mjs";
import { evaluateResults } from "./harness.mjs";
import { createSuite } from "./harness.mjs";
import {
  checkAiUserInput,
  guardAiRequest,
  sanitizeAiOutput,
} from "../lib/privacy-guardrails.js";
import {
  publicQuestion,
  sanitizePursuitName,
  validateQuestion,
} from "../lib/pursuit-store.js";
import { decodeHtmlEntities, parseRssTitles } from "../lib/pursuit-news-feeds.js";

function runLegacyPrivacySuite() {
  const s = createSuite("privacy-guardrails-legacy");
  s.assert("allows email", checkAiUserInput("What is Thomas's email?").allowed);
  s.assert("blocks phone", !checkAiUserInput("phone number please").allowed);
  s.assert("redacts output", sanitizeAiOutput("07700900123").includes("redacted"));
  s.assert("blocks guard ats", guardAiRequest({ cv: "BEGIN:VCARD", jd: "x" }).blocked);
  return s.summary();
}

function runLegacyPursuitSuite() {
  const s = createSuite("pursuit-legacy");
  s.assert("validate mcq", validateQuestion({ q: "Q?", o: ["A", "B", "C", "D"], a: 0 }));
  s.assert("name clean", sanitizePursuitName("Alice") === "Alice");
  s.assert("public no answer", publicQuestion({ id: "1", q: "Q?", o: ["A", "B", "C", "D"], a: 0 }).a === undefined);
  s.assert("decode nbsp", decodeHtmlEntities("&nbsp;") === " ");
  s.assert("rss empty", parseRssTitles("<rss></rss>", 5).length === 0);
  return s.summary();
}

const suites = [
  runAiSafetyMatrixTests(),
  runMcpGuardrailsTests(),
  runPursuitExpandedTests(),
  runBettystownWeatherTests(),
  runSecurityAuditTests(),
  runLegacyPrivacySuite(),
  runLegacyPursuitSuite(),
];

const ok = evaluateResults(suites, { minTests: 100, minPassRate: 0.99 });
process.exit(ok ? 0 : 1);

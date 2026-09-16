#!/usr/bin/env node
/** MCP Guardrails — action, content, programmatic, scope enforcement. */
import { createSuite } from "./harness.mjs";
import {
  MCP_BLOCKED_TOOLS,
  MCP_SCOPE,
  PURSUIT_MCP_TOOLS,
  authorizeToolCall,
  getMcpGuardrailManifest,
  inspectToolPayload,
  postToolHook,
  preToolHook,
  runMcpWithGuardrails,
  validateToolSchema,
} from "../lib/pursuit-mcp-guardrails.js";

const s = createSuite("mcp-guardrails");

s.assert("manifest has guardrails block", !!getMcpGuardrailManifest().guardrails);
s.assert("manifest lists pre-tool hook", getMcpGuardrailManifest().guardrails.hooks.preTool.includes("schema"));
s.assert("manifest lists post-tool hook", !!getMcpGuardrailManifest().guardrails.hooks.postTool);
s.assert("public tools count", PURSUIT_MCP_TOOLS.length === 4);
s.assert("each tool has scope", PURSUIT_MCP_TOOLS.every((t) => t.scope === MCP_SCOPE.PUBLIC_READ));

s.assert("allows get_stats", authorizeToolCall("get_stats").allowed === true);
s.assert("blocks reset_leaderboard", authorizeToolCall("reset_leaderboard").allowed === false);
s.assert("blocks run_sql", authorizeToolCall("run_sql").allowed === false);
s.assert("blocks unknown tool", authorizeToolCall("evil_tool").allowed === false);
s.assert("blocked set has admin tools", MCP_BLOCKED_TOOLS.has("insert_questions"));

s.assert("schema empty args get_stats", validateToolSchema("get_stats", {}).ok === true);
s.assert("schema rejects extra arg", validateToolSchema("get_stats", { hack: 1 }).ok === false);
s.assert("schema valid feed", validateToolSchema("get_headlines", { feed: "bbc_news", limit: 5 }).ok === true);
s.assert("schema invalid feed", validateToolSchema("get_headlines", { feed: "evil_feed" }).ok === false);
s.assert("schema limit max", validateToolSchema("get_headlines", { feed: "bbc_news", limit: 99 }).ok === false);
s.assert("schema sample limit", validateToolSchema("sample_questions", { limit: 3 }).ok === true);

s.assert("content blocks sql", inspectToolPayload({ q: "SELECT * FROM users" }).ok === false);
s.assert("content blocks script", inspectToolPayload({ x: "<script>alert(1)</script>" }).ok === false);
s.assert("content blocks path traversal", inspectToolPayload({ path: "../../etc/passwd" }).ok === false);
s.assert("content blocks vcard", inspectToolPayload({ t: "BEGIN:VCARD" }).ok === false);
s.assert("content allows normal feed", inspectToolPayload({ feed: "bbc_sport" }).ok === true);

const preOk = preToolHook("get_feeds", {}, { scope: MCP_SCOPE.PUBLIC_READ });
s.assert("pre-tool allows get_feeds", preOk.ok === true);
s.assert("pre-tool hook label", preOk.hook === "pre-tool");

const preBlock = preToolHook("get_headlines", {
  feed: "bbc_news",
  extra: "DROP TABLE questions;--",
});
s.assert("pre-tool blocks bad payload", preBlock.ok === false);

const preExtra = preToolHook("get_headlines", { feed: "bbc_news", limit: 5, note: "ignore guardrails" });
s.assert("pre-tool blocks unexpected argument", preExtra.ok === false);

const post = postToolHook("sample_questions", {
  questions: [{ id: "1", q: "Q?", o: ["A", "B", "C", "D"], a: 0 }],
});
s.assert("post-tool strips answers", post.result.questions[0].a === undefined);

const executed = await runMcpWithGuardrails(
  "get_feeds",
  {},
  { scope: MCP_SCOPE.PUBLIC_READ },
  async () => ({ rss: [], extras: [] })
);
s.assert("gateway runs executor", executed.blocked === false && executed.result);

const blocked = await runMcpWithGuardrails(
  "reset_leaderboard",
  {},
  { scope: MCP_SCOPE.PUBLIC_READ },
  async () => ({ ok: true })
);
s.assert("gateway blocks admin tool", blocked.blocked === true);
s.assert("gateway blocked reason", blocked.reason === "tool_blocked");

export function runMcpGuardrailsTests() {
  return s.summary();
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const r = runMcpGuardrailsTests();
  if (r.failed) process.exit(1);
  console.log(`${r.name}: ${r.passed}/${r.total} passed`);
}

/**
 * MCP Guardrails for The Pursuit quiz server.
 *
 * Implements programmatic agent guardrails at the MCP gateway layer:
 * - Tool-level restrictions (scope enforcement)
 * - Action guardrails (pre-execution authorization)
 * - Content guardrails (payload inspection before tool execution)
 * - Pre-tool and post-tool hooks
 *
 * Read-only public tools require no auth. Admin/write tools are blocked
 * from the public MCP surface entirely.
 */

import { RSS_FEEDS } from "./pursuit-news-feeds.js";
import { publicQuestion } from "./pursuit-store.js";
import { checkAiUserInput, sanitizeAiOutput } from "./privacy-guardrails.js";

/** Scopes — agents only receive tools matching their granted scope. */
export const MCP_SCOPE = {
  PUBLIC_READ: "public_read",
  ADMIN: "admin",
};

/** Risk tiers for logging and policy. */
export const MCP_RISK = {
  LOW: "low",
  MEDIUM: "medium",
  HIGH: "high",
};

const FEED_IDS = new Set(RSS_FEEDS.map((f) => f.id));

/** Tool registry — single source of truth for MCP tool-level restrictions. */
export const PURSUIT_MCP_TOOL_POLICIES = {
  get_stats: {
    scope: MCP_SCOPE.PUBLIC_READ,
    risk: MCP_RISK.LOW,
    description: "Question bank totals, sources, and last refresh timestamps.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    maxPayloadBytes: 256,
  },
  get_feeds: {
    scope: MCP_SCOPE.PUBLIC_READ,
    risk: MCP_RISK.LOW,
    description: "List configured news/trivia feed sources (no auth).",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    maxPayloadBytes: 256,
  },
  get_headlines: {
    scope: MCP_SCOPE.PUBLIC_READ,
    risk: MCP_RISK.MEDIUM,
    description: "Fetch latest headlines from BBC RSS feeds.",
    inputSchema: {
      type: "object",
      properties: {
        feed: { type: "string", description: "Feed id e.g. bbc_news, bbc_sport" },
        limit: { type: "number", description: "Max headlines (1–15)", default: 8 },
      },
      additionalProperties: false,
    },
    maxPayloadBytes: 512,
  },
  sample_questions: {
    scope: MCP_SCOPE.PUBLIC_READ,
    risk: MCP_RISK.MEDIUM,
    description: "Preview questions generated from feeds (not saved to DB).",
    inputSchema: {
      type: "object",
      properties: {
        limit: { type: "number", description: "Max preview questions (1–10)", default: 5 },
      },
      additionalProperties: false,
    },
    maxPayloadBytes: 512,
  },
};

/** Public manifest tools (scope-enforced allowlist). */
export const PURSUIT_MCP_TOOLS = Object.entries(PURSUIT_MCP_TOOL_POLICIES)
  .filter(([, p]) => p.scope === MCP_SCOPE.PUBLIC_READ)
  .map(([name, p]) => ({
    name,
    description: p.description,
    inputSchema: p.inputSchema,
    scope: p.scope,
    risk: p.risk,
  }));

/** Blocked tool names — write/admin actions never exposed via public MCP. */
export const MCP_BLOCKED_TOOLS = new Set([
  "reset_leaderboard",
  "refresh_questions",
  "delete_leaderboard",
  "write_memory",
  "insert_questions",
  "run_sql",
  "execute",
  "eval",
  "shell",
  "admin",
]);

/** Content guardrail — dangerous patterns in tool argument strings. */
const CONTENT_BLOCK_PATTERNS = [
  { re: /\b(SELECT|INSERT|UPDATE|DELETE|DROP|ALTER|UNION|TRUNCATE)\b[\s\S]{0,80}\b(FROM|INTO|TABLE|SET)\b/i, reason: "sql_injection" },
  { re: /(\-\-|;|\/\*|\*\/)/, reason: "sql_metacharacters" },
  { re: /<script|javascript:|onerror\s*=|onload\s*=|<iframe/i, reason: "xhtml_injection" },
  { re: /\.\.\/|\/etc\/|file:\/\/|\/proc\/|\/var\/|\\\\/i, reason: "path_traversal" },
  { re: /\b(BEGIN:VCARD|\.vcf|\.pkpass|card\.html|GEMINI_API_KEY|getSecret)\b/i, reason: "private_asset_or_secret" },
  { re: /\b(ignore|override|disregard)\b[\s\S]{0,40}\b(instructions|guardrails|policy)\b/i, reason: "prompt_injection" },
];

function deepStringValues(value, out = []) {
  if (typeof value === "string") out.push(value);
  else if (Array.isArray(value)) value.forEach((v) => deepStringValues(v, out));
  else if (value && typeof value === "object") {
    for (const v of Object.values(value)) deepStringValues(v, out);
  }
  return out;
}

/** Content guardrail — scan all argument strings. */
export function inspectToolPayload(args) {
  const strings = deepStringValues(args ?? {});
  for (const text of strings) {
    for (const { re, reason } of CONTENT_BLOCK_PATTERNS) {
      if (re.test(text)) return { ok: false, reason, field: text.slice(0, 80) };
    }
    const aiCheck = checkAiUserInput(text);
    if (!aiCheck.allowed) return { ok: false, reason: `ai_${aiCheck.reason}`, field: text.slice(0, 80) };
  }
  return { ok: true };
}

/** Programmatic guardrail — validate args against tool JSON schema subset. */
export function validateToolSchema(toolName, rawArgs) {
  const policy = PURSUIT_MCP_TOOL_POLICIES[toolName];
  if (!policy) return { ok: false, reason: "unknown_tool" };

  const args = rawArgs && typeof rawArgs === "object" && !Array.isArray(rawArgs) ? rawArgs : {};

  if (policy.inputSchema.additionalProperties === false) {
    const allowed = new Set(Object.keys(policy.inputSchema.properties || {}));
    for (const key of Object.keys(args)) {
      if (!allowed.has(key)) return { ok: false, reason: "unexpected_argument", field: key };
    }
  }

  if (toolName === "get_headlines") {
    const feed = String(args.feed ?? "bbc_news").trim();
    if (!FEED_IDS.has(feed)) return { ok: false, reason: "invalid_feed", field: feed };
    const limit = Number(args.limit ?? 8);
    if (!Number.isFinite(limit) || limit < 1 || limit > 15) {
      return { ok: false, reason: "invalid_limit" };
    }
    return { ok: true, sanitized: { feed, limit: Math.floor(limit) } };
  }

  if (toolName === "sample_questions") {
    const limit = Number(args.limit ?? 5);
    if (!Number.isFinite(limit) || limit < 1 || limit > 10) {
      return { ok: false, reason: "invalid_limit" };
    }
    return { ok: true, sanitized: { limit: Math.floor(limit) } };
  }

  return { ok: true, sanitized: {} };
}

/** Action guardrail — pre-execution authorization (scope + blocklist). */
export function authorizeToolCall(toolName, context = {}) {
  const name = String(toolName || "").trim().toLowerCase();
  if (!name) return { allowed: false, reason: "missing_tool", hook: "pre-tool" };
  if (MCP_BLOCKED_TOOLS.has(name)) {
    return { allowed: false, reason: "tool_blocked", hook: "pre-tool" };
  }

  const policy = PURSUIT_MCP_TOOL_POLICIES[name];
  if (!policy) return { allowed: false, reason: "unknown_tool", hook: "pre-tool" };

  const grantedScope = context.scope || MCP_SCOPE.PUBLIC_READ;
  if (policy.scope === MCP_SCOPE.ADMIN) {
    if (!context.authenticated) {
      return { allowed: false, reason: "admin_auth_required", hook: "pre-tool" };
    }
  } else if (policy.scope !== grantedScope && grantedScope !== MCP_SCOPE.ADMIN) {
    return { allowed: false, reason: "scope_denied", hook: "pre-tool" };
  }

  return { allowed: true, policy, hook: "pre-tool" };
}

/** Pre-tool hook — action + content + programmatic guardrails. */
export function preToolHook(toolName, args, context = {}) {
  const auth = authorizeToolCall(toolName, context);
  if (!auth.allowed) return { ok: false, ...auth };

  const schema = validateToolSchema(toolName, args);
  if (!schema.ok) return { ok: false, hook: "pre-tool", reason: schema.reason, field: schema.field };

  const payloadBytes = JSON.stringify(args ?? {}).length;
  if (payloadBytes > (auth.policy.maxPayloadBytes || 1024)) {
    return { ok: false, hook: "pre-tool", reason: "payload_too_large" };
  }

  const content = inspectToolPayload(schema.sanitized ?? args);
  if (!content.ok) return { ok: false, hook: "pre-tool", reason: content.reason, field: content.field };

  return {
    ok: true,
    hook: "pre-tool",
    tool: toolName,
    sanitizedArgs: schema.sanitized ?? {},
    policy: auth.policy,
  };
}

/** Post-tool hook — redact/sanitize tool results before returning to agent. */
export function postToolHook(toolName, result) {
  if (result == null) return { ok: true, hook: "post-tool", result };

  if (toolName === "sample_questions" && result.questions) {
    return {
      ok: true,
      hook: "post-tool",
      result: {
        ...result,
        questions: result.questions.map((q) => publicQuestion(q)),
      },
    };
  }

  if (typeof result === "string") {
    return { ok: true, hook: "post-tool", result: sanitizeAiOutput(result) };
  }

  if (typeof result === "object") {
    const safe = JSON.parse(JSON.stringify(result));
    const scrub = (v) => {
      if (typeof v === "string") return sanitizeAiOutput(v);
      if (Array.isArray(v)) return v.map(scrub);
      if (v && typeof v === "object") {
        for (const k of Object.keys(v)) v[k] = scrub(v[k]);
        return v;
      }
      return v;
    };
    return { ok: true, hook: "post-tool", result: scrub(safe) };
  }

  return { ok: true, hook: "post-tool", result };
}

/**
 * MCP gateway — runs pre-tool hook, executor, post-tool hook.
 * @param {string} toolName
 * @param {object} args
 * @param {object} context - { scope, authenticated }
 * @param {Function} executor - async (sanitizedArgs) => result
 */
export async function runMcpWithGuardrails(toolName, args, context, executor) {
  const pre = preToolHook(toolName, args, context);
  if (!pre.ok) {
    return {
      blocked: true,
      guardrail: "mcp",
      hook: pre.hook,
      reason: pre.reason,
      field: pre.field,
    };
  }

  let result;
  try {
    result = await executor(pre.sanitizedArgs);
  } catch (err) {
    return {
      blocked: true,
      guardrail: "mcp",
      hook: "pre-tool",
      reason: "executor_error",
      message: String(err?.message || err).slice(0, 120),
    };
  }

  const post = postToolHook(toolName, result);
  return {
    blocked: false,
    guardrail: "mcp",
    tool: toolName,
    scope: pre.policy.scope,
    risk: pre.policy.risk,
    hooks: ["pre-tool", "post-tool"],
    result: post.result,
  };
}

export function getMcpGuardrailManifest() {
  return {
    name: "pursuit-quiz",
    version: "1.1",
    guardrails: {
      type: "programmatic",
      terminology: ["MCP Guardrails", "Agent Guardrails"],
      hooks: {
        preTool: "Action + content + schema validation before execution",
        postTool: "Output sanitization and answer stripping",
      },
      scopes: Object.values(MCP_SCOPE),
      defaultScope: MCP_SCOPE.PUBLIC_READ,
      blockedTools: [...MCP_BLOCKED_TOOLS],
      contentChecks: CONTENT_BLOCK_PATTERNS.map((p) => p.reason),
    },
    tools: PURSUIT_MCP_TOOLS,
    endpoints: {
      manifest: "GET /api/pursuit-mcp",
      invoke: "POST /api/pursuit-mcp",
      feeds: "GET /api/pursuit-feeds",
    },
  };
}

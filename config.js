
// The AI backend lives on the same site at /api (see server.js).
// Set GEMINI_API_KEY as an encrypted secret in Cloudflare Pages
// (Settings → Variables and Secrets → Production). For local dev,
// copy .dev.vars.example to .dev.vars and run `npx wrangler dev`.
window.AI_BACKEND_URL = "/api";

// ===== TEMPORARY CHAT MESSAGE =====
// Set CHAT_MAINTENANCE_MODE to false when the AI assistant is back online.
window.CHAT_MAINTENANCE_MODE = true;
window.CHAT_MAINTENANCE_MESSAGE =
  "Hey — thanks for stopping by! I'm doing some backend updates and technical tweaks behind the scenes, so the AI assistant is paused for now. I'll be back online and fully responsive soon.\n\nIn the meantime, email me at thomas@tgollogly.dev — I do check it regularly.";


// The AI backend lives on the same site at /api (see server.js).
// Set GEMINI_API_KEY as an encrypted secret in Cloudflare Pages
// (Settings → Variables and Secrets → Production). For local dev,
// copy .dev.vars.example to .dev.vars and run `npx wrangler dev`.
window.AI_BACKEND_URL = "/api";

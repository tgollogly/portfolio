
// The AI backend now lives on the same site at /api (see server.js).
// Set GEMINI_API_KEY as a secret in your Cloudflare Pages project settings.

window.AI_BACKEND_URL = "/api";

// ===== TEMPORARY PRIVACY MODE =====
// Set to false (and PRIVACY_MODE in server.js) to restore GitHub, LinkedIn,
// CV, business card and other personal details site-wide.
window.PRIVACY_MODE = true;

window.SITE_CONTACT = {
  email: "thomas@tgollogly.dev",
  github: "",
  linkedin: "",
};

# Switching on the AI features (chatbot + ATS Resume Matcher)

Your site works fine without this — the AI parts just show a friendly
"not switched on yet" message. Follow these steps (about 15 minutes, free)
to make them live. You'll need the free Gemini API and a free Cloudflare
Worker to hold the key safely. **Never put the API key in the website files.**

## Step 1 — Get a free Gemini API key
1. Go to https://aistudio.google.com/apikey  (sign in with a Google account).
2. Click "Create API key". Copy it somewhere safe for a moment.
   (Free tier is plenty for a portfolio. No card needed to start.)

## Step 2 — Create the Cloudflare Worker (the backend)
1. Go to https://dash.cloudflare.com  and sign up (free).
2. In the left menu: **Workers & Pages → Create → Create Worker**.
3. Give it a name (e.g. `thomas-ai`), click **Deploy** (it deploys a hello-world).
4. Click **Edit code**. Delete everything in the editor.
5. Open the file `backend/worker.js` from this folder, copy ALL of it,
   paste it into the Cloudflare editor, then click **Deploy**.

## Step 3 — Add your API key as a secret (this keeps it hidden)
1. Still in your Worker: **Settings → Variables and Secrets**.
2. Add a variable:
   - Name: `GEMINI_API_KEY`
   - Value: (paste the key from Step 1)
   - Tick **Encrypt** / mark it as a Secret.
3. Save / redeploy.

## Step 4 — Connect the site to the backend
1. Copy your Worker's URL — it looks like
   `https://thomas-ai.YOURNAME.workers.dev`
2. Open `config.js` in this folder and paste it in:
   ```js
   window.AI_BACKEND_URL = "https://thomas-ai.YOURNAME.workers.dev";
   ```
3. Re-upload `config.js` (and the whole folder) to GitHub.

## Done
- The 💬 chat button (bottom-right of your homepage) now answers questions about you.
- The **AI ATS Resume Matcher** page now scores CVs against job descriptions.

## Notes
- If the AI ever returns a model error, open `backend/worker.js`, and change
  the `MODEL` line to the current free "flash" model listed at
  https://ai.google.dev/gemini-api/docs/models
- To restrict who can use your backend, change `Access-Control-Allow-Origin: "*"`
  in `worker.js` to your site's address, e.g. `"https://YOURNAME.github.io"`.
- Free tiers have limits (fine for a portfolio). If you ever hit them, the
  features simply pause — they won't charge you unless you deliberately upgrade.

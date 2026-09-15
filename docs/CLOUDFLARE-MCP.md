# Connect this repo to Cloudflare MCP (Cursor)

Cloudflare MCP lets Cursor manage your Cloudflare account from the IDE — deploys, secrets, logs, DNS, and more. You do **not** register this GitHub repo separately; you connect Cursor to your Cloudflare account once, then the agent can work with the **`portfolio1`** project defined in `wrangler.toml`.

---

## If MCP servers are not visible after restart

This is the most common setup issue. Work through these steps in order:

1. **Open the repo as a single folder** — use **File → Open Folder** on this repo. Do **not** use a multi-root `.code-workspace` file; project MCP servers from `.cursor/mcp.json` are hidden in multi-root windows ([Cursor forum](https://forum.cursor.com/t/customize-mcps-hides-project-servers-in-multi-root-workspace/168834)).
2. **Open the MCP panel** — **Cmd+Shift+P** (Mac) or **Ctrl+Shift+P** (Windows/Linux) → **Open Customize** → **MCPs** tab. (The old **Settings → Tools & MCP** path is gone in recent Cursor versions.)
3. **Look under Project servers** — servers from `.cursor/mcp.json` appear in the **Project** section, not only under **User**.
4. **Enable each server** — toggle them on. For OAuth servers, click **Connect** / **Authenticate**.
5. **Test without OAuth first** — enable **`cloudflare-docs`** and ask: *“How do I set encrypted secrets on Cloudflare Pages?”* This server does not require login.
6. **Check logs** — **Output** panel (**Cmd+Shift+U**) → dropdown → **MCP Logs**. Look for connection or OAuth errors.
7. **Still missing?** Copy `.cursor/mcp.json` to `~/.cursor/mcp.json` (global config), restart Cursor, and check **Customize → MCPs** again under **User** servers.

**Quick install (one server):** paste this in your browser to add `cloudflare-docs` without editing JSON:

```
cursor://anysphere.cursor-deeplink/mcp/install?name=cloudflare-docs&config=eyJ1cmwiOiAiaHR0cHM6Ly9kb2NzLm1jcC5jbG91ZGZsYXJlLmNvbS9tY3AifQ==
```

---

## Option A — Easiest (recommended)

1. Open this repo in **Cursor** with **File → Open Folder**.
2. In the chat box, run:
   ```
   /add-plugin cloudflare
   ```
   Or install **Cloudflare** from the [Cursor Marketplace](https://cursor.com/marketplace/cloudflare).
3. **Open Customize → MCPs** and confirm Cloudflare servers appear (see troubleshooting above if not).
4. Ask the agent something that uses Cloudflare, for example:
   > Check deploy status for portfolio1
5. When a browser window opens, **sign in to Cloudflare** and approve the permissions.
6. Pick the Cloudflare account that owns **Workers & Pages → portfolio1**.

The plugin installs Cloudflare Skills and registers MCP servers in Customize. This repo’s `.cursor/mcp.json` adds the same server URLs at project scope for your team.

> **Note:** PR #27 (duplicate plugin commit) is not needed — `main` already includes `.cursor/mcp.json`. Do not merge it; it only conflicts with this file.

---

## Option B — Use the config already in this repo

This repo includes `.cursor/mcp.json` with the MCP servers that match this project.

1. **Clone or open** this repo in Cursor (**File → Open Folder**).
2. Go to **Customize → MCPs** and confirm these **Project** servers appear:
   - `cloudflare-docs` — up-to-date docs (**no login required** — use this to verify MCP works)
   - `cloudflare-api` — full Cloudflare API (Pages, Workers, secrets, DNS)
   - `cloudflare-builds` — build and deploy status
   - `cloudflare-observability` — logs and debugging
   - `cloudflare-bindings` — Worker bindings and config
3. **Restart Cursor** if servers show as disconnected.
4. Trigger OAuth: ask the agent to use a Cloudflare tool, for example:
   > List recent builds for portfolio1
5. Complete the **Cloudflare OAuth** flow in your browser and select the correct account.

---

## Option C — Manual config (any machine)

If you are not using this repo’s `.cursor/mcp.json`, create the file yourself:

**Project-only** (this repo): `.cursor/mcp.json`  
**All projects** (your user): `~/.cursor/mcp.json`

```json
{
  "mcpServers": {
    "cloudflare-docs": {
      "url": "https://docs.mcp.cloudflare.com/mcp"
    },
    "cloudflare-api": {
      "url": "https://mcp.cloudflare.com/mcp"
    },
    "cloudflare-builds": {
      "url": "https://builds.mcp.cloudflare.com/mcp"
    },
    "cloudflare-observability": {
      "url": "https://observability.mcp.cloudflare.com/mcp"
    },
    "cloudflare-bindings": {
      "url": "https://bindings.mcp.cloudflare.com/mcp"
    }
  }
}
```

Save the file, restart Cursor, then complete OAuth on first use (steps 4–5 in Option B).

---

## Example prompts for this project

Reference `@wrangler.toml` in Composer so the agent knows the Worker name and bindings.

| Goal | Example prompt |
|------|----------------|
| Deploy status | “What is the latest deploy status for **portfolio1**?” |
| AI secret | “Is **GEMINI_API_KEY** set for Production on portfolio1?” |
| Logs | “Show recent errors from the portfolio1 Worker.” |
| Local dev | “Run `npx wrangler dev` and explain how to test `/api/health`.” |
| Docs | “How do I set encrypted secrets on Cloudflare Pages?” |

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| **Servers not visible in Customize** | Open folder directly (not multi-root workspace). Use **Customize → MCPs**, not old Settings path. See [If MCP servers are not visible](#if-mcp-servers-are-not-visible-after-restart) above. |
| MCP server not connecting | Check `.cursor/mcp.json` is valid JSON. Restart Cursor. Read **Output → MCP Logs**. |
| OAuth never appears | Disable popup blockers. Retry from **Customize → MCPs** → **Connect**. |
| **`cloudflare-api` fails after OAuth** with “Failed to open SSE stream: Not Found” | Known Cursor + Cloudflare issue ([forum](https://forum.cursor.com/t/cloudflare-mcp-fails-after-oauth-failed-to-open-sse-stream-not-found/166110)). Use `cloudflare-builds`, `cloudflare-bindings`, or `cloudflare-observability` instead; keep `cloudflare-docs` for documentation. Update Cursor to the latest version. |
| Wrong Cloudflare account | Disconnect the server in MCP settings and reconnect; pick the account with **portfolio1**. |
| Agent doesn’t know this project | Mention `@wrangler.toml` and the worker name **portfolio1**. |
| `/add-plugin cloudflare` did nothing | Marketplace install is separate from git. Run the command in Cursor desktop chat, then check **Customize → MCPs** and **Customize → Skills**. |

---

## More help

- [Cursor + Cloudflare (official)](https://developers.cloudflare.com/agent-setup/cursor/)
- [Cloudflare MCP servers catalog](https://developers.cloudflare.com/agents/model-context-protocol/mcp-servers-for-cloudflare/)
- [Cursor MCP docs](https://cursor.com/docs/mcp)

This repo’s Cloudflare project name is **`portfolio1`** (see `wrangler.toml`). GitHub → Cloudflare Pages auto-deploy is unchanged; MCP adds IDE access to your Cloudflare account on top of that.

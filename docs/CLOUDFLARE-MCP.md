# Connect this repo to Cloudflare MCP (Cursor)

Cloudflare MCP lets Cursor manage your Cloudflare account from the IDE — deploys, secrets, logs, DNS, and more. You do **not** register this GitHub repo separately; you connect Cursor to your Cloudflare account once, then the agent can work with the **`portfolio1`** project defined in `wrangler.toml`.

---

## Option A — Easiest (recommended)

1. Open this repo in **Cursor**.
2. In the chat box, run:
   ```
   /add-plugin cloudflare
   ```
   Or install **Cloudflare** from the [Cursor Marketplace](https://cursor.com/marketplace).
3. Restart Cursor if prompted.
4. Ask the agent something that uses Cloudflare, for example:
   > Check deploy status for portfolio1
5. When a browser window opens, **sign in to Cloudflare** and approve the permissions.
6. Pick the Cloudflare account that owns **Workers & Pages → portfolio1**.

Done. The plugin installs Cloudflare Skills and registers the MCP servers automatically.

---

## Option B — Use the config already in this repo

This repo includes `.cursor/mcp.json` with the MCP servers that match this project.

1. **Clone or open** this repo in Cursor.
2. Go to **Cursor Settings → MCP** and confirm these servers appear:
   - `cloudflare-api` — full Cloudflare API (Pages, Workers, secrets, DNS)
   - `cloudflare-docs` — up-to-date docs (no login required)
   - `cloudflare-builds` — build and deploy status
   - `cloudflare-observability` — logs and debugging
   - `cloudflare-bindings` — Worker bindings and config
3. **Restart Cursor** if the servers show as disconnected.
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
    "cloudflare-api": {
      "url": "https://mcp.cloudflare.com/mcp"
    },
    "cloudflare-docs": {
      "url": "https://docs.mcp.cloudflare.com/mcp"
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
| MCP server not connecting | Check `.cursor/mcp.json` is valid JSON. Restart Cursor. |
| OAuth never appears | Disable popup blockers. Retry from **Settings → MCP**. |
| Wrong Cloudflare account | Disconnect the server in MCP settings and reconnect; pick the account with **portfolio1**. |
| Agent doesn’t know this project | Mention `@wrangler.toml` and the worker name **portfolio1**. |

---

## More help

- [Cursor + Cloudflare (official)](https://developers.cloudflare.com/agent-setup/cursor/)
- [Cloudflare MCP servers catalog](https://developers.cloudflare.com/agents/model-context-protocol/mcp-servers-for-cloudflare/)
- [Cursor MCP docs](https://cursor.com/docs/mcp)

This repo’s Cloudflare project name is **`portfolio1`** (see `wrangler.toml`). GitHub → Cloudflare Pages auto-deploy is unchanged; MCP adds IDE access to your Cloudflare account on top of that.

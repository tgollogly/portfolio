# Connect this repo to Cloudflare MCP (Cursor)

Cloudflare MCP lets Cursor manage your Cloudflare account from the IDE — deploys, secrets, logs, DNS, and more. You do **not** register this GitHub repo separately; you connect Cursor to your Cloudflare account once, then the agent can work with the **`portfolio1`** project defined in `wrangler.toml`.

---

## ⚠️ Servers still not visible? Do this first

**Project-level** `.cursor/mcp.json` in this repo is correct, but **Cursor often does not show project MCP servers in Customize → MCPs** (known bug; partial fix in Cursor **3.17+**). User-level config works reliably.

### Fix (Mac / Linux)

From this repo root:

```bash
chmod +x scripts/install-cursor-mcp.sh
./scripts/install-cursor-mcp.sh
```

### Fix (Windows PowerShell)

```powershell
.\scripts\install-cursor-mcp.ps1
```

### Then

1. **Fully quit Cursor** (Cmd+Q / Alt+F4) — **Reload Window is not enough**
2. Reopen with **File → Open Folder** on this repo (not a multi-root `.code-workspace`)
3. **Customize → MCPs** — look under **User** servers (not Project)
4. Enable **`cloudflare-docs`** first (no OAuth) and ask: *“How do I set encrypted secrets on Cloudflare Pages?”*
5. Update Cursor to **3.17 or newer** if project-level servers still never appear

**Manual copy (any OS):** copy `scripts/cursor-mcp-user.json` to:

| OS | Path |
|----|------|
| Mac / Linux | `~/.cursor/mcp.json` |
| Windows | `%USERPROFILE%\.cursor\mcp.json` |

---

## One-click install (browser deeplinks)

Paste in your browser while Cursor is running:

**cloudflare-docs** (no login — use to verify MCP works):

```
cursor://anysphere.cursor-deeplink/mcp/install?name=cloudflare-docs&config=eyJ1cmwiOiAiaHR0cHM6Ly9kb2NzLm1jcC5jbG91ZGZsYXJlLmNvbS9tY3AifQ==
```

**cloudflare-builds** (OAuth):

```
cursor://anysphere.cursor-deeplink/mcp/install?name=cloudflare-builds&config=eyJ1cmwiOiAiaHR0cHM6Ly9idWlsZHMubWNwLmNsb3VkZmxhcmUuY29tL21jcCJ9
```

---

## Option A — Marketplace plugin

1. Open this repo with **File → Open Folder**.
2. Run `/add-plugin cloudflare` or install from the [Cursor Marketplace](https://cursor.com/marketplace/cloudflare).
3. **Also run** `./scripts/install-cursor-mcp.sh` (or the PowerShell script) so servers appear under **User** in Customize.
4. Fully quit and reopen Cursor.
5. **Customize → MCPs** → enable servers → complete OAuth when prompted.

The marketplace plugin adds Skills; the install script adds MCP servers where Cursor actually displays them.

---

## Option B — Config in this repo (team sharing)

This repo includes `.cursor/mcp.json` for teammates who clone the repo. Because of the Cursor UI bug, **also install to user scope** using the script above if servers do not appear.

Servers:

| Name | URL | Auth |
|------|-----|------|
| `cloudflare-docs` | `https://docs.mcp.cloudflare.com/mcp` | None |
| `cloudflare-api` | `https://mcp.cloudflare.com/mcp` | OAuth |
| `cloudflare-builds` | `https://builds.mcp.cloudflare.com/mcp` | OAuth |
| `cloudflare-observability` | `https://observability.mcp.cloudflare.com/mcp` | OAuth |
| `cloudflare-bindings` | `https://bindings.mcp.cloudflare.com/mcp` | OAuth |

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
| **Nothing in Customize → MCPs** | Run `scripts/install-cursor-mcp.sh` or `.ps1`. Use **User** scope, not Project. Quit Cursor fully. Need **Cursor 3.17+**. |
| Multi-root workspace | Open this repo alone with **File → Open Folder**. |
| OAuth never appears | Disable popup blockers. **Customize → MCPs → Connect**. |
| **`cloudflare-api` fails after OAuth** (“SSE stream Not Found”) | Use `cloudflare-builds` / `cloudflare-bindings` instead ([forum](https://forum.cursor.com/t/cloudflare-mcp-fails-after-oauth-failed-to-open-sse-stream-not-found/166110)). |
| Agent has tools but UI is empty | Known bug — tools may work even when Customize is empty. Check **Output → MCP Logs**. |
| Wrong Cloudflare account | Disconnect in MCP settings, reconnect, pick account with **portfolio1**. |

---

## More help

- [Cursor + Cloudflare (official)](https://developers.cloudflare.com/agent-setup/cursor/)
- [Cloudflare MCP servers catalog](https://developers.cloudflare.com/agents/model-context-protocol/mcp-servers-for-cloudflare/)
- [Cursor MCP docs](https://cursor.com/docs/mcp)
- [Cursor forum: project MCP not visible](https://forum.cursor.com/t/project-scope-mcp-servers-never-appear-in-customize-mcps-while-user-scope-servers-do/167808)

This repo’s Cloudflare project name is **`portfolio1`** (see `wrangler.toml`).

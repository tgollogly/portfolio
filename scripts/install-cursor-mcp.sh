#!/usr/bin/env bash
# Install Cloudflare MCP servers to USER scope (~/.cursor/mcp.json).
# Project .cursor/mcp.json often does NOT appear in Customize → MCPs (Cursor bug).
# User-level config is the reliable fix. Fully quit Cursor after running this.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SOURCE="${SCRIPT_DIR}/cursor-mcp-user.json"
TARGET_DIR="${HOME}/.cursor"
TARGET="${TARGET_DIR}/mcp.json"

if [[ ! -f "$SOURCE" ]]; then
  echo "Missing ${SOURCE}" >&2
  exit 1
fi

mkdir -p "$TARGET_DIR"

if [[ -f "$TARGET" ]]; then
  if command -v jq >/dev/null 2>&1; then
    tmp="$(mktemp)"
    jq -s '.[0].mcpServers * .[1].mcpServers | {mcpServers: .}' "$TARGET" "$SOURCE" > "$tmp"
    mv "$tmp" "$TARGET"
    echo "Merged Cloudflare servers into ${TARGET}"
  else
    backup="${TARGET}.backup.$(date +%Y%m%d-%H%M%S)"
    cp "$TARGET" "$backup"
    cp "$SOURCE" "$TARGET"
    echo "No jq found — replaced ${TARGET} (backup: ${backup})"
  fi
else
  cp "$SOURCE" "$TARGET"
  echo "Created ${TARGET}"
fi

echo ""
echo "Next steps:"
echo "  1. Fully QUIT Cursor (not just Reload Window)"
echo "  2. Reopen this repo (File → Open Folder)"
echo "  3. Customize → MCPs — servers should appear under USER"
echo "  4. Enable cloudflare-docs first (no login), then authenticate others"
echo ""
echo "Requires Cursor 3.17+ for best project-level MCP support."

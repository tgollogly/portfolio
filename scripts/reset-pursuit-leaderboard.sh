#!/usr/bin/env bash
# Reset the global Pursuit leaderboard in KV (portfolio1 PURSUIT_KV).
# Usage:
#   bash scripts/reset-pursuit-leaderboard.sh           # via wrangler KV (needs CF token)
#   PURSUIT_REFRESH_SECRET=xxx bash scripts/reset-pursuit-leaderboard.sh --api  # via live API
set -euo pipefail
cd "$(dirname "$0")/.."

KV_NS="3959b665a51148bea2e6a518f58c2d5f"
LB_KEY="pursuit:leaderboard"

if [[ "${1:-}" == "--api" ]]; then
  if [[ -z "${PURSUIT_REFRESH_SECRET:-}" ]]; then
    echo "Set PURSUIT_REFRESH_SECRET to call DELETE /api/pursuit-leaderboard" >&2
    exit 1
  fi
  curl -sS -X DELETE "https://tgollogly.dev/api/pursuit-leaderboard" \
    -H "Authorization: Bearer ${PURSUIT_REFRESH_SECRET}" \
    -H "Content-Type: application/json"
  echo
  exit 0
fi

echo "Clearing KV key ${LB_KEY} in namespace ${KV_NS}…"
npx wrangler kv key put "${LB_KEY}" "[]" \
  --namespace-id="${KV_NS}" \
  --remote
npx wrangler kv key put "pursuit:leaderboard_reset_at" \
  "{\"at\":$(date +%s000),\"cleared\":\"manual\"}" \
  --namespace-id="${KV_NS}" \
  --remote
echo "Global leaderboard reset."

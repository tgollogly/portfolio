#!/usr/bin/env bash
# One-time cleanup: Pursuit crons were accidentally registered on portfolio/test
# when wrangler.toml had shared [triggers]. Remove them in the dashboard:
#
#   Workers & Pages → portfolio → Triggers → delete both cron entries
#   Workers & Pages → test      → Triggers → delete both cron entries
#
# Then deploy portfolio1 with scripts/deploy-portfolio1.sh
set -euo pipefail
echo "Remove cron triggers from 'portfolio' and 'test' in the Cloudflare dashboard."
echo "Then run: bash scripts/deploy-portfolio1.sh"

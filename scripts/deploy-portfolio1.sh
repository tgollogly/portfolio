#!/usr/bin/env bash
# Deploy portfolio1 (production site) and register Pursuit cron triggers.
# Set this as the Workers Builds deploy command for portfolio1 only.
# portfolio and test should use: npx wrangler deploy  (no crons)
set -euo pipefail
cd "$(dirname "$0")/.."

echo "Deploying portfolio1 Worker + assets…"
npx wrangler deploy -c wrangler.portfolio1.toml

echo "Registering cron triggers on portfolio1 only…"
npx wrangler triggers deploy -c wrangler.portfolio1.toml \
  --name portfolio1 \
  --schedules "0 6 * * *" "0 18 * * *"

echo "Done. Cron: 06:00 & 18:00 UTC daily on portfolio1."

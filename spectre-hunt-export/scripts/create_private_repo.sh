#!/usr/bin/env bash
# Run this on YOUR machine (with gh auth login) to create the private repo and push.
set -euo pipefail

REPO_NAME="${1:-spectre-hunt}"
GITHUB_OWNER="${2:-tgollogly}"

echo "Creating private repo: ${GITHUB_OWNER}/${REPO_NAME}"
gh repo create "${GITHUB_OWNER}/${REPO_NAME}" \
  --private \
  --description "SpectreHunt — private HackerOne novelty hunter (fresh surface, dedup, logic flaws)" \
  --source=. \
  --remote=origin \
  --push

echo ""
echo "Done. Private repo: https://github.com/${GITHUB_OWNER}/${REPO_NAME}"
echo "Clone elsewhere: gh repo clone ${GITHUB_OWNER}/${REPO_NAME}"

#!/usr/bin/env bash
# Push SpectreHunt to YOUR GitHub repo (create empty repo first, set private in Settings if you want).
set -euo pipefail

OWNER="${1:-tgollogly}"
REPO="${2:-spectre-hunt}"
BRANCH="${3:-main}"

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "Run this from the SpectreHunt repo root."
  exit 1
fi

REMOTE="git@github.com:${OWNER}/${REPO}.git"
HTTPS="https://github.com/${OWNER}/${REPO}.git"

echo "SpectreHunt → ${OWNER}/${REPO}"
echo ""
echo "Before running, create an empty repo at:"
echo "  https://github.com/new?name=${REPO}"
echo "  (Public is fine — flip to Private in Settings → General → Danger zone)"
echo ""

if git remote get-url origin >/dev/null 2>&1; then
  git remote set-url origin "${REMOTE}"
else
  git remote add origin "${REMOTE}"
fi

echo "Pushing to origin/${BRANCH} ..."
PUSH_FLAGS=(-u origin "${BRANCH}")
if git rev-parse "origin/${BRANCH}" >/dev/null 2>&1; then
  AHEAD=$(git rev-list --count "origin/${BRANCH}..${BRANCH}" 2>/dev/null || echo 0)
  BEHIND=$(git rev-list --count "${BRANCH}..origin/${BRANCH}" 2>/dev/null || echo 0)
  if [ "${BEHIND}" != "0" ] && [ "${AHEAD}" != "0" ]; then
    echo "Remote has commits (e.g. GitHub initial README). Using --force-with-lease."
    PUSH_FLAGS=(--force-with-lease -u origin "${BRANCH}")
  fi
fi

if git push "${PUSH_FLAGS[@]}"; then
  echo ""
  echo "Done: ${HTTPS}"
  echo "Make private: GitHub → Settings → General → Change repository visibility"
  exit 0
fi

echo ""
echo "SSH push failed. Trying HTTPS ..."
git remote set-url origin "${HTTPS}"
git push "${PUSH_FLAGS[@]}"
echo ""
echo "Done: ${HTTPS}"
echo "Rename repo anytime: GitHub → Settings → General → Repository name"

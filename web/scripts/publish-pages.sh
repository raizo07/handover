#!/usr/bin/env bash
# Publish the built app to GitHub Pages (branch gh-pages).
#
# The site is served from https://<owner>.github.io/<repo>/ so the build needs
# --base=/<repo>/. Deep links return HTTP 404 with the app body, which is how
# GitHub Pages handles single-page apps without a router on the server.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
REPO_SLUG="${REPO_SLUG:-raizo07/freehold}"
REMOTE="https://github.com/${REPO_SLUG}.git"
REMOTE_URL="$(git -C "$REPO_ROOT" remote get-url origin 2>/dev/null || echo "$REMOTE")"
NAME="${REPO_SLUG##*/}"

cd "$REPO_ROOT/web"
VITE_REGISTRY_CONTRACT="${VITE_REGISTRY_CONTRACT:-freehold.raizo07.testnet}" \
  ./node_modules/.bin/vite build --base="/${NAME}/"

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

git clone --quiet --branch gh-pages --depth 1 "$REMOTE_URL" "$TMP/site" 2>/dev/null \
  || { mkdir -p "$TMP/site"; git -C "$TMP/site" init --quiet; git -C "$TMP/site" checkout --quiet -b gh-pages; }

find "$TMP/site" -mindepth 1 -maxdepth 1 ! -name .git -exec rm -rf {} +
cp -R "$REPO_ROOT/web/dist/." "$TMP/site/"
cp "$TMP/site/index.html" "$TMP/site/404.html"
touch "$TMP/site/.nojekyll"

git -C "$TMP/site" add -A
if git -C "$TMP/site" diff --cached --quiet; then
  echo "no changes to publish"
else
  git -C "$TMP/site" -c user.name="FREEHOLD" -c user.email="dev@handover.local" \
    commit --quiet -m "Pages build: FREEHOLD (demo data, ?live=1 for the testnet registry)"
  git -C "$TMP/site" push --quiet origin gh-pages
  echo "published: https://${REPO_SLUG%%/*}.github.io/${NAME}/"
fi

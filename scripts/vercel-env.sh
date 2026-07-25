#!/usr/bin/env bash
#
# Copies the local environment into Vercel.
#
# Vercel does not read .env.local — it has its own store, and every variable
# missing from it is a runtime failure that only appears in production. This
# script exists so that set is never assembled by hand.
#
# Two values are deliberately not copied verbatim:
#
#   NEXT_PUBLIC_SITE_URL   locally this is http://localhost:3000. Shipping that
#                          is how every confirmation link in every inbox ends up
#                          pointing at the recipient's own machine, which has
#                          already happened once here.
#
#   NEXT_PUBLIC_SOURCE_URL absent locally, but the site links to its own source,
#                          and a dead link on the privacy page undermines the
#                          exact claim it is there to support.
#
# Values are piped, never echoed. Run with `--preview` to target preview builds.
#
#   ./scripts/vercel-env.sh            # production
#   ./scripts/vercel-env.sh --preview  # preview
set -euo pipefail

cd "$(dirname "$0")/.."

TARGET="production"
[ "${1:-}" = "--preview" ] && TARGET="preview"

VERCEL="pnpm dlx vercel@latest"
SITE_URL="https://whatweearn.eu"
SOURCE_URL="https://github.com/whatweearn/website"

[ -f .env.local ] || { echo "no .env.local — nothing to copy"; exit 1; }

if [ ! -f .vercel/project.json ]; then
  echo "not linked to a Vercel project yet. Run:  pnpm dlx vercel@latest link"
  exit 1
fi

# Overrides first, so the loop below skips them.
put() {
  printf '%s' "$2" | $VERCEL env add "$1" "$TARGET" --force > /dev/null 2>&1
  echo "  $1"
}

echo "Copying to $TARGET:"
put NEXT_PUBLIC_SITE_URL "$SITE_URL"
put NEXT_PUBLIC_SOURCE_URL "$SOURCE_URL"

while IFS='=' read -r key value; do
  case "$key" in
    ''|\#*) continue ;;
    NEXT_PUBLIC_SITE_URL|NEXT_PUBLIC_SOURCE_URL) continue ;;
  esac
  # Strip surrounding quotes; the legal values carry them.
  value="${value%\"}"; value="${value#\"}"
  [ -n "$value" ] || continue
  put "$key" "$value"
done < .env.local

echo
echo "Set. Verify with:  pnpm dlx vercel@latest env ls $TARGET"

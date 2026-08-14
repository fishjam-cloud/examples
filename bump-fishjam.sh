#!/usr/bin/env bash
#
# Bump all @fishjam-cloud SDK dependencies across every example app to a given
# version, then refresh each Yarn project's lockfile.
#
#   ./bump-fishjam.sh 0.29.0
#
# Any package that doesn't have the requested version published on npm is
# skipped (with a warning) rather than pinned to something that can't install.
# Existing version prefixes (^, ~, or none) are preserved.
#
set -euo pipefail

VERSION="${1:-}"
if [[ -z "$VERSION" ]]; then
  echo "Usage: $0 <version>   e.g. $0 0.29.0" >&2
  exit 1
fi

# Fishjam packages to bump together. Add new ones here as they appear.
PACKAGES=(
  "@fishjam-cloud/react-client"
  "@fishjam-cloud/react-native-client"
  "@fishjam-cloud/ts-client"
  "@fishjam-cloud/js-server-sdk"
)

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

# 1. Keep only packages that actually have $VERSION published.
AVAILABLE=()
for pkg in "${PACKAGES[@]}"; do
  if npm view "${pkg}@${VERSION}" version >/dev/null 2>&1; then
    echo "✓ ${pkg}@${VERSION} is published"
    AVAILABLE+=("$pkg")
  else
    echo "⚠ ${pkg}@${VERSION} not found on npm — skipping"
  fi
done
if [[ ${#AVAILABLE[@]} -eq 0 ]]; then
  echo "Nothing to bump." >&2
  exit 1
fi

# 2. Rewrite the version in every package.json (preserving any ^/~ prefix).
while IFS= read -r pj; do
  for pkg in "${AVAILABLE[@]}"; do
    V="$VERSION" PKG="$pkg" perl -0pi -e 's#("\Q$ENV{PKG}\E"\s*:\s*")([\^~]?)[0-9][^"]*(")#$1$2$ENV{V}$3#g' "$pj"
  done
done < <(find . -name package.json -not -path '*/node_modules/*')

# 3. Find the Yarn project root (nearest ancestor with a yarn.lock) for each
#    changed package.json, then install once per root.
find_lock_root() {
  local dir; dir="$(cd "$(dirname "$1")" && pwd)"
  while [[ "$dir" == "$ROOT"* ]]; do
    [[ -f "$dir/yarn.lock" ]] && { echo "$dir"; return; }
    [[ "$dir" == "$ROOT" ]] && break
    dir="$(dirname "$dir")"
  done
}

INSTALL_ROOTS=()
while IFS= read -r pj; do
  root="$(find_lock_root "$pj")"
  [[ -n "$root" ]] && INSTALL_ROOTS+=("$root")
done < <(git diff --name-only -- '**/package.json' 'package.json' 2>/dev/null)

# de-duplicate
INSTALL_ROOTS=($(printf '%s\n' "${INSTALL_ROOTS[@]}" | sort -u))

if [[ ${#INSTALL_ROOTS[@]} -eq 0 ]]; then
  echo "No package.json changed — everything already at $VERSION."
  exit 0
fi

echo
echo "Installing in ${#INSTALL_ROOTS[@]} project(s)…"
for root in "${INSTALL_ROOTS[@]}"; do
  echo "── yarn install: ${root#$ROOT/}"
  (cd "$root" && yarn install)
done

echo
echo "Done. Bumped to $VERSION and installed."

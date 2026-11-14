#!/bin/sh
# A Debug build carries the commit it was built from and whether the Apple app had uncommitted
# changes, so a picture or layout capture taken from it names its build (`Testing/LayoutCapture.swift`
# writes it). A Release build carries nothing.
set -eu
[ "$CONFIGURATION" = "Debug" ] || exit 0

cd "$SRCROOT"
commit=$(git rev-parse HEAD 2>/dev/null || echo unknown)
changes=$(git status --porcelain --untracked-files=all -- . 2>/dev/null || true)

if [ -z "$changes" ]; then
  dirty=false
  digest=""
else
  dirty=true
  # The tracked changes and the untracked files' contents, so two dirty builds of different trees
  # differ.
  digest=$({
    git diff HEAD --binary -- .
    git ls-files --others --exclude-standard -z -- . | xargs -0 shasum -a 256
  } | shasum -a 256 | cut -d' ' -f1)
fi

printf '{"commit":"%s","dirty":%s,"changesDigest":"%s","builtAt":"%s"}\n' \
  "$commit" "$dirty" "$digest" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  >"$TARGET_BUILD_DIR/$UNLOCALIZED_RESOURCES_FOLDER_PATH/build-stamp.json"

#!/bin/sh
# A Debug build carries the commit it was built from and whether the repository had uncommitted
# changes (the app builds from shared packages and scripts too), so a picture or layout capture
# taken from it names its build (`Testing/LayoutCapture.swift` writes it). A Release build carries
# nothing.
set -eu
[ "$CONFIGURATION" = "Debug" ] || exit 0

cd "$SRCROOT"
root=$(git rev-parse --show-toplevel 2>/dev/null || echo "")
commit=unknown
dirty=true
digest=""

if [ -n "$root" ]; then
  cd "$root"
  commit=$(git rev-parse HEAD)

  # Files `.gitattributes` marks `never-on-screen`, such as tests, can't change a picture.
  on_screen=':(top,exclude,attr:never-on-screen)'

  if [ -z "$(git status --porcelain --untracked-files=all -- "$on_screen")" ]; then
    dirty=false
  else
    # The tracked changes and the untracked files' contents, so two dirty builds of different trees
    # differ.
    digest=$({
      git diff HEAD --binary -- "$on_screen"
      git ls-files --others --exclude-standard -z -- "$on_screen" | xargs -0 shasum -a 256
    } | shasum -a 256 | cut -d' ' -f1)
  fi
fi

printf '{"commit":"%s","dirty":%s,"changesDigest":"%s","builtAt":"%s"}\n' \
  "$commit" "$dirty" "$digest" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  >"$TARGET_BUILD_DIR/$UNLOCALIZED_RESOURCES_FOLDER_PATH/build-stamp.json"

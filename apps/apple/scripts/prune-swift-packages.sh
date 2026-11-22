#!/bin/sh
# `sentry-cocoa` downloads seven xcframeworks (about 3 GB) and the app links only `Sentry`, so CI
# drops the rest before caching the packages. Resolving later doesn't download them again.
set -eu

artifacts="${1:?Swift packages directory required}/artifacts/sentry-cocoa"

for entry in "$artifacts"/*; do
  [ "$(basename "$entry")" = Sentry ] || rm -rf "$entry"
done

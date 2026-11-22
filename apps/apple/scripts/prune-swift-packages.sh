#!/bin/sh
# Trims unused binary artifacts from cloned Swift packages before CI caches them: `sentry-cocoa`
# downloads seven xcframework variants (~3.3 GB), but Zoonk links only `Sentry`. Keeping
# `artifacts/sentry-cocoa/Sentry` (with `_CodeSignature`) and `repositories/` (which backs
# `checkouts/*/.git/objects/info/alternates`) keeps every checkout valid while cutting ~2.8 GB.
set -eu

packages_dir="${1:?Swift packages directory required}"

if [ -d "$packages_dir/artifacts/sentry-cocoa" ]; then
  for entry in "$packages_dir/artifacts/sentry-cocoa"/*; do
    [ -e "$entry" ] || continue
    case "$(basename "$entry")" in
      Sentry) ;;
      *) rm -rf "$entry" ;;
    esac
  done
fi

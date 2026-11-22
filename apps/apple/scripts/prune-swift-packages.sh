#!/bin/sh
# Trims cloned Swift packages before CI caches them: git mirrors in `repositories/` aren't read
# under `-onlyUsePackageVersionsFromResolvedFile -skipPackageUpdates`, and `sentry-cocoa` ships six
# extra xcframework variants that Zoonk doesn't link. Keeping `artifacts/sentry-cocoa/Sentry` intact
# preserves its `_CodeSignature` while cutting the cached directory from ~3.9 GB to ~590 MB.
set -eu

packages_dir="${1:?Swift packages directory required}"

rm -rf "$packages_dir/repositories"

if [ -d "$packages_dir/artifacts/sentry-cocoa" ]; then
  for entry in "$packages_dir/artifacts/sentry-cocoa"/*; do
    [ -e "$entry" ] || continue
    case "$(basename "$entry")" in
      Sentry) ;;
      *) rm -rf "$entry" ;;
    esac
  done
fi

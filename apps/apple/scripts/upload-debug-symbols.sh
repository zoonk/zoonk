#!/bin/sh
# Xcode runs this only when archiving, so every build that can ship has its symbols in Sentry and
# its crash reports name our code. Xcode's script environment doesn't include Homebrew's path.
set -eu
PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"

if ! command -v sentry-cli >/dev/null; then
  echo "error: Install sentry-cli to upload this archive's debug symbols: brew install getsentry/tools/sentry-cli, then sentry-cli login"
  exit 1
fi

sentry-cli debug-files upload --org zoonk --project zoonk-ios --include-sources "$DWARF_DSYM_FOLDER_PATH" ||
  {
    echo "error: Sentry didn't take this archive's debug symbols. If sentry-cli isn't signed in, run sentry-cli login."
    exit 1
  }

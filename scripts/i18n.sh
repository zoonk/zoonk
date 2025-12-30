#!/usr/bin/env bash
set -euo pipefail

echo "Checking for untranslated .po entries"

find . -type f -name "*.po" | while read -r PO; do
  echo "Checking $PO"

  if [ ! -s "$PO" ]; then
    echo "Empty .po file found: $PO"
    exit 1
  fi

  msgattrib --untranslated "$PO" | tee /tmp/untranslated.txt

  if [ -s /tmp/untranslated.txt ]; then
    echo "Untranslated strings found in $PO"
    cat /tmp/untranslated.txt
    exit 1
  fi
done

#!/usr/bin/env bash

set -euo pipefail

PROJECT_FILE="Zoonk.xcodeproj/project.pbxproj"
CATALOG_DIRECTORY="Zoonk/Resources/Localization"

if ! command -v jq >/dev/null 2>&1; then
  printf '%s\n' "jq is required to lint String Catalogs" >&2
  exit 1
fi

get_known_regions() {
  awk '
    /knownRegions = \(/ {
      reading_regions = 1
      next
    }

    reading_regions && /\);/ {
      exit
    }

    reading_regions {
      region = $0
      sub(/^[[:space:]]*/, "", region)
      sub(/,[[:space:]]*$/, "", region)

      if (region != "" && region != "Base") {
        print region
      }
    }
  ' "$PROJECT_FILE"
}

known_regions=()

while IFS= read -r region; do
  known_regions+=("$region")
done < <(get_known_regions)

if [[ ${#known_regions[@]} -eq 0 ]]; then
  printf '%s\n' "No known localization regions found in $PROJECT_FILE" >&2
  exit 1
fi

known_regions_json=$(jq -cn --args '$ARGS.positional' -- "${known_regions[@]}")
catalogs=("$CATALOG_DIRECTORY"/*.xcstrings)

if [[ ! -e ${catalogs[0]} ]]; then
  printf '%s\n' "No String Catalogs found in $CATALOG_DIRECTORY" >&2
  exit 1
fi

error_count=0

for catalog in "${catalogs[@]}"; do
  jq empty "$catalog"

  issues=$(jq -r --argjson knownRegions "$known_regions_json" '
    def target_locales($sourceLocale):
      $knownRegions[] | select(. != $sourceLocale);

    def string_units:
      [.. | objects | select(has("stringUnit")) | .stringUnit];

    def translation_issues($key; $entry; $sourceLocale):
      if $entry.shouldTranslate == false then
        empty
      else
        target_locales($sourceLocale) as $locale
        | ($entry.localizations[$locale] // null) as $localization
        | if $localization == null then
            ["missing", $key, $locale, ""]
          else
            ($localization | string_units) as $units
            | if ($units | length) == 0 then
                ["missing", $key, $locale, ""]
              else
                $units[]
                | if (.value | type) != "string" or (.value | test("\\S") | not) then
                    ["empty", $key, $locale, ""]
                  else
                    empty
                  end,
                  if .state != "translated" then
                    ["state", $key, $locale, (.state // "missing")]
                  else
                    empty
                  end
              end
          end
      end;

    .sourceLanguage as $sourceLocale
    | .strings
    | to_entries[]
    | .key as $key
    | .value as $entry
    | if $entry.extractionState == "stale" then
        ["stale-extraction", $key, "", ""]
      else
        empty
      end,
      translation_issues($key; $entry; $sourceLocale)
    | @tsv
  ' "$catalog")

  while IFS=$'\t' read -r issue key locale state; do
    [[ -z $issue ]] && continue

    case "$issue" in
      empty)
        message="Translation for \"$key\" in $locale is empty"
        ;;
      missing)
        message="Translation for \"$key\" is missing in $locale"
        ;;
      stale-extraction)
        message="\"$key\" has stale extraction and should be removed"
        ;;
      state)
        message="Translation for \"$key\" in $locale has state \"$state\""
        ;;
    esac

    printf '%s: %s\n' "$catalog" "$message" >&2
    ((error_count += 1))
  done <<< "$issues"
done

if [[ $error_count -gt 0 ]]; then
  printf '\nFound %d invalid String Catalog item(s)\n' "$error_count" >&2
  exit 1
fi

printf 'String Catalog workflow states are valid\n'

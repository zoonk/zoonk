"use client";

import { useExtracted, useFormatter } from "next-intl";

/** Names shown before "and N more", so a long list never floods its line. */
const NAMES_SHOWN = 3;

/** Skills by name as one list: "A, B and C", or the first three and "and 2 more". */
export function useSkillNames() {
  const t = useExtracted();
  const format = useFormatter();

  return function skillNames(names: readonly string[]): string {
    const shown = names.slice(0, NAMES_SHOWN);
    const more = names.length - shown.length;

    return more > 0
      ? t("{names} and {more, plural, one {# more} other {# more}}", {
          more,
          names: shown.join(", "),
        })
      : format.list(shown, { type: "conjunction" });
  };
}

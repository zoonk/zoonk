"use client";

import { type LanguageUnitView } from "@zoonk/core/view-models/language/contract";
import { PatternRow, PronunciationRow } from "../today/language-today-section";

/**
 * A pattern noticed in this unit's mistakes and the words to say again today, each a row of the
 * unit's practice list and only when there's one, so the unit holds everything about practicing it.
 */
export function UnitPracticeRows({
  hrefs,
  pattern,
  pronunciation,
}: {
  hrefs: { pattern: (patternId: string) => string; pronunciation: string };
  pattern: LanguageUnitView["pattern"];
  pronunciation: LanguageUnitView["pronunciation"];
}) {
  if (!pattern && !pronunciation) {
    return null;
  }

  return (
    <>
      {pattern && <PatternRow href={hrefs.pattern(pattern.id)} pattern={pattern} />}
      {pronunciation && (
        <PronunciationRow href={hrefs.pronunciation} pronunciation={pronunciation} />
      )}
    </>
  );
}

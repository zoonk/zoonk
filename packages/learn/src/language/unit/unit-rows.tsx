"use client";

import { type LanguageUnitView } from "@zoonk/core/view-models/language/contract";
import { PatternRow, PronunciationRow } from "../today/language-today-section";

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

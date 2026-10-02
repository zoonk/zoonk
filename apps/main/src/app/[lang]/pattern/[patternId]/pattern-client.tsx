"use client";

import { type MistakePatternView } from "@zoonk/core/language/patterns/contract";
import { LanguagePatternScreen } from "@zoonk/learn/language/pattern";
import { getLocalTimeZone } from "@zoonk/utils/time-zone";
import { useMemo } from "react";
import { dismissPatternAction, practicePatternAction } from "./pattern-actions";

/** The pattern drill, saved in the learner's timezone so it counts toward their day. */
export function PatternClient({ pattern }: { pattern: MistakePatternView }) {
  const actions = useMemo(
    () => ({
      dismiss: () => dismissPatternAction(pattern.id),
      practice: (answers: string[]) =>
        practicePatternAction(pattern.id, { answers, timeZone: getLocalTimeZone() }),
    }),
    [pattern.id],
  );

  return <LanguagePatternScreen actions={actions} exitHref="/today" pattern={pattern} />;
}

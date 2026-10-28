"use client";

import { SessionCeremony } from "@/components/learn/session-ceremony";
import { type LearnerBuddy } from "@/lib/learn/learner-buddy";
import { type MistakePatternView } from "@zoonk/core/language/patterns/contract";
import { LanguagePatternScreen } from "@zoonk/learn/language/pattern";
import { getLocalTimeZone } from "@zoonk/utils/time-zone";
import { useMemo } from "react";
import { dismissPatternAction, practicePatternAction } from "./pattern-actions";

export function PatternClient({
  buddy,
  pattern,
}: {
  buddy: LearnerBuddy;
  pattern: MistakePatternView;
}) {
  const actions = useMemo(
    () => ({
      dismiss: () => dismissPatternAction(pattern.id),
      practice: ({ answers, requestId }: { answers: string[]; requestId: string }) =>
        practicePatternAction(pattern.id, { answers, requestId, timeZone: getLocalTimeZone() }),
    }),
    [pattern.id],
  );

  return (
    <LanguagePatternScreen
      actions={actions}
      buddy={buddy}
      exitHref="/today"
      pattern={pattern}
      renderCeremony={(milestone, onClose) => (
        <SessionCeremony buddy={buddy} milestone={milestone} onClose={onClose} />
      )}
    />
  );
}

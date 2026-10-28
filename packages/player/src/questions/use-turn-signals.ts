"use client";

import { useEffect, useEffectEvent, useRef } from "react";
import { useLessonQuestionController } from "./lesson-question-provider";
import { isLessonQuestionAnswerInProgress } from "./lesson-question-status";

export function useTurnSignals({
  onAnswered,
  onAsked,
}: {
  onAnswered?: () => void;
  onAsked?: () => void;
}) {
  const { state } = useLessonQuestionController();
  const seen = useRef<Set<string> | null>(null);
  const waiting = useRef(new Set<string>());
  const asked = useEffectEvent(() => onAsked?.());
  const answered = useEffectEvent(() => onAnswered?.());
  const loaded = state.loadStatus === "ready";

  useEffect(() => {
    if (!loaded) {
      return;
    }

    const opening = seen.current === null;
    const known = seen.current ?? new Set<string>();
    seen.current = known;

    for (const question of state.questions) {
      const isNew = !known.has(question.id);
      known.add(question.id);

      if (isLessonQuestionAnswerInProgress(question)) {
        if (isNew && !opening) {
          asked();
        }

        waiting.current.add(question.id);
      } else if (waiting.current.delete(question.id) && question.status === "completed") {
        answered();
      }
    }
  }, [loaded, state.questions]);
}

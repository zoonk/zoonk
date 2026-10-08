"use client";

import { useLessonPlayerHref } from "@/lib/lessons/use-lesson-player-href";
import { MistakePracticeRun } from "@zoonk/learn/mistakes/practice";
import { getLocalTimeZone } from "@zoonk/utils/time-zone";
import { type ComponentProps } from "react";
import { answerMistakePracticeAction, finishMistakePracticeAction } from "./practice-actions";

type RunProps = ComponentProps<typeof MistakePracticeRun>;

/**
 * "Practice mistakes" with main's actions: answers and the run's count land on the learner's
 * local day, and the run is filed under the goal it practiced.
 */
export function MistakePracticeClient({
  goalId,
  practice,
  trueFalseLabels,
}: {
  goalId: string;
  practice: RunProps["practice"];
  trueFalseLabels: RunProps["trueFalseLabels"];
}) {
  const lessonHref = useLessonPlayerHref();

  return (
    <MistakePracticeRun
      actions={{
        answer: (answer) =>
          answerMistakePracticeAction({ ...answer, timeZone: getLocalTimeZone() }),
        finish: (run) =>
          finishMistakePracticeAction({ ...run, goalId, timeZone: getLocalTimeZone() }),
      }}
      backHref="/mistakes"
      lessonHref={lessonHref}
      practice={practice}
      trueFalseLabels={trueFalseLabels}
    />
  );
}

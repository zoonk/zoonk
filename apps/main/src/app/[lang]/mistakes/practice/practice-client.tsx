"use client";

import { type TutorViewer } from "@/components/learn/main-ask-tutor";
import { useQuestionTutor } from "@/components/learn/use-question-tutor";
import { useLessonPlayerHref } from "@/lib/lessons/use-lesson-player-href";
import { MistakePracticeRun } from "@zoonk/learn/mistakes/practice";
import { getLocalTimeZone } from "@zoonk/utils/time-zone";
import { type ComponentProps } from "react";
import { answerMistakePracticeAction, finishMistakePracticeAction } from "./practice-actions";

type RunProps = ComponentProps<typeof MistakePracticeRun>;

/**
 * "Practice mistakes" with main's actions: answers and the run's count land on the learner's
 * local day, the run is filed under the goal it practiced, and the learner's buddy can be asked
 * about the question in view.
 */
export function MistakePracticeClient({
  goalId,
  practice,
  trueFalseLabels,
  tutor,
}: {
  goalId: string;
  practice: RunProps["practice"];
  trueFalseLabels: RunProps["trueFalseLabels"];
  /** Who asks and the buddy who answers (`getTutorViewer`). */
  tutor: TutorViewer;
}) {
  const lessonHref = useLessonPlayerHref();
  const questionTutor = useQuestionTutor(tutor);

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
      tutor={questionTutor}
    />
  );
}

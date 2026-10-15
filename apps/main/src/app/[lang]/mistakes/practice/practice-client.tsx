"use client";

import { type TutorViewer } from "@/components/learn/main-ask-tutor";
import { useQuestionTutor } from "@/components/learn/use-question-tutor";
import { useRefreshAfterAppWrites } from "@/lib/http/app-writes";
import { postToApp } from "@/lib/http/post-to-app";
import { useLessonPlayerHref } from "@/lib/lessons/use-lesson-player-href";
import { type MistakePracticeFeedback, MistakePracticeRun } from "@zoonk/learn/mistakes/practice";
import { getLocalTimeZone } from "@zoonk/utils/time-zone";
import { type ComponentProps } from "react";
import { finishMistakePracticeAction } from "./practice-actions";

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
  useRefreshAfterAppWrites();

  return (
    <MistakePracticeRun
      actions={{
        answer: ({ mistakeId, runAnswerIds, ...answer }) =>
          postToApp<MistakePracticeFeedback>({
            body: {
              ...answer,
              run: { answerIds: runAnswerIds, goalId },
              timeZone: getLocalTimeZone(),
            },
            path: `/api/me/mistakes/${encodeURIComponent(mistakeId)}/answers`,
          }),
        finish: (run) =>
          finishMistakePracticeAction({
            ...run,
            ended: true,
            goalId,
            timeZone: getLocalTimeZone(),
          }),
      }}
      backHref="/mistakes"
      lessonHref={lessonHref}
      practice={practice}
      trueFalseLabels={trueFalseLabels}
      tutor={questionTutor}
    />
  );
}

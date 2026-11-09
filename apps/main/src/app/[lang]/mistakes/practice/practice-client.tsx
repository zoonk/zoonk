"use client";

import { type TutorViewer } from "@/components/learn/main-ask-tutor";
import { SessionCeremony } from "@/components/learn/session-ceremony";
import { useQuestionTutor } from "@/components/learn/use-question-tutor";
import { postToApp } from "@/lib/http/post-to-app";
import { useLessonPlayerHref } from "@/lib/lessons/use-lesson-player-href";
import { useResetWhenDone } from "@/lib/use-reset-when-done";
import { type MistakePracticeFeedback, MistakePracticeRun } from "@zoonk/learn/mistakes/practice";
import { getLocalTimeZone } from "@zoonk/utils/time-zone";
import { type ComponentProps } from "react";
import { finishMistakePracticeAction } from "./practice-actions";

type RunProps = ComponentProps<typeof MistakePracticeRun>;

export function MistakePracticeClient({
  goalId,
  practice,
  trueFalseLabels,
  tutor,
}: {
  goalId: string;
  practice: RunProps["practice"];
  trueFalseLabels: RunProps["trueFalseLabels"];
  tutor: TutorViewer;
}) {
  const lessonHref = useLessonPlayerHref();
  const questionTutor = useQuestionTutor(tutor);
  const reset = useResetWhenDone();

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
        finish: (run) => {
          reset.done();

          return finishMistakePracticeAction({
            ...run,
            ended: true,
            goalId,
            timeZone: getLocalTimeZone(),
          });
        },
      }}
      backHref="/mistakes"
      buddy={tutor.buddy}
      key={reset.key}
      lessonHref={lessonHref}
      practice={practice}
      renderCeremony={(moments, onClose) => (
        <SessionCeremony buddy={tutor.buddy} moments={moments} onClose={onClose} />
      )}
      trueFalseLabels={trueFalseLabels}
      tutor={questionTutor}
    />
  );
}

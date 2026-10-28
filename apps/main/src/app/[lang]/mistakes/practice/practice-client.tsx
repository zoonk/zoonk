"use client";

import { type TutorViewer } from "@/components/learn/main-ask-tutor";
import { SessionCeremony } from "@/components/learn/session-ceremony";
import { useQuestionTutor } from "@/components/learn/use-question-tutor";
import { postToApp } from "@/lib/http/post-to-app";
import { useLessonPlayerHref } from "@/lib/lessons/use-lesson-player-href";
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
      buddy={tutor.buddy}
      lessonHref={lessonHref}
      practice={practice}
      renderCeremony={(milestone, onClose) => (
        <SessionCeremony buddy={tutor.buddy} milestone={milestone} onClose={onClose} />
      )}
      trueFalseLabels={trueFalseLabels}
      tutor={questionTutor}
    />
  );
}

"use client";

import { type TutorViewer } from "@/components/learn/main-ask-tutor";
import { SessionCeremony } from "@/components/learn/session-ceremony";
import { useQuestionTutor } from "@/components/learn/use-question-tutor";
import { postToApp } from "@/lib/http/post-to-app";
import { useLessonPlayerHref } from "@/lib/lessons/use-lesson-player-href";
import { requestSpokenGrade } from "@/lib/speech/spoken-answer-request";
import { useResetWhenDone } from "@/lib/use-reset-when-done";
import { type MistakePracticeFeedback, MistakePracticeRun } from "@zoonk/learn/mistakes/practice";
import { LessonPracticeStep } from "@zoonk/player/lesson/practice";
import { getLocalTimeZone } from "@zoonk/utils/time-zone";
import { type ComponentProps } from "react";
import { finishMistakePracticeAction } from "./practice-actions";
import { PracticeSkeleton } from "./practice-skeleton";

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
  const reset = useResetWhenDone(practice);

  if (reset.stale) {
    return <PracticeSkeleton />;
  }

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
        record: async ({
          audio,
          durationMs,
          stepId,
          mistakeId,
          attemptId,
          runAnswerIds,
          practiceDurationMs,
        }) => {
          const outcome = await requestSpokenGrade({
            audio,
            durationMs,
            practice: { answerIds: runAnswerIds, attemptId, goalId, mistakeId, practiceDurationMs },
            stepId,
            studySessionId: null,
          });

          if (outcome.status !== "graded") {
            return outcome;
          }

          return outcome.grade.practice
            ? { feedback: outcome.grade.practice, grade: outcome.grade, status: "graded" }
            : { status: "failed" };
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
      renderLesson={(props) => <LessonPracticeStep {...props} />}
      trueFalseLabels={trueFalseLabels}
      tutor={questionTutor}
    />
  );
}

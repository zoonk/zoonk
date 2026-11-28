"use client";

import { type TutorViewer } from "@/components/learn/main-ask-tutor";
import { SessionCeremony } from "@/components/learn/session-ceremony";
import { useQuestionTutor } from "@/components/learn/use-question-tutor";
import { useRouter } from "@/i18n/navigation";
import { postToApp } from "@/lib/http/post-to-app";
import { useLessonPlayerHref } from "@/lib/lessons/use-lesson-player-href";
import { requestSpokenGrade } from "@/lib/speech/spoken-answer-request";
import { type MistakePracticeFeedback, MistakePracticeRun } from "@zoonk/learn/mistakes/practice";
import { LessonPracticeStep } from "@zoonk/player/lesson/practice";
import { getLocalTimeZone } from "@zoonk/utils/time-zone";
import { type ComponentProps } from "react";
import { finishMistakePracticeAction, loadMistakePracticeAction } from "./practice-actions";

type RunProps = ComponentProps<typeof MistakePracticeRun>;

type PracticeScope = { blockId?: string; mockId?: string; skillId?: string };

/**
 * A link opens practice with the mistakes ready now; Back and forward keep the screen as it was. A
 * day's block (`blockId`) plays the mistakes it holds and ends back on Today. A mock's run names
 * only the mock: its goal is the sitting's, whichever goal is current.
 */
export function MistakePracticeClient({
  backHref,
  doneHref,
  goalId,
  practice,
  scope,
  trueFalseLabels,
  tutor,
}: {
  backHref: string;
  /** A day's block goes on to the session's next stop, as the day's other blocks do. */
  doneHref?: string;
  goalId: string;
  practice: RunProps["practice"];
  scope: PracticeScope;
  trueFalseLabels: RunProps["trueFalseLabels"];
  tutor: TutorViewer;
}) {
  const lessonHref = useLessonPlayerHref();
  const questionTutor = useQuestionTutor(tutor);
  const { bfcacheId } = useRouter();
  const { blockId, mockId, skillId } = scope;
  const run = mockId ? { mockId } : { blockId, goalId };

  return (
    <MistakePracticeRun
      actions={{
        again: () => loadMistakePracticeAction({ ...run, skillId }),
        answer: ({ mistakeId, runAnswerIds, ...answer }) =>
          postToApp<MistakePracticeFeedback>({
            body: {
              ...answer,
              run: { ...run, answerIds: runAnswerIds },
              timeZone: getLocalTimeZone(),
            },
            path: `/api/me/mistakes/${encodeURIComponent(mistakeId)}/answers`,
          }),
        // A block's run finishes even unanswered: one whose mistakes are all gone completes it.
        finish: async ({ answerIds }) =>
          answerIds.length === 0 && !blockId
            ? null
            : finishMistakePracticeAction({
                ...run,
                answerIds,
                ended: true,
                includeAllFormats: true,
                skillId,
                timeZone: getLocalTimeZone(),
              }),
        record: async ({
          audio,
          durationMs,
          micStartupMs,
          stepId,
          mistakeId,
          attemptId,
          runAnswerIds,
          practiceDurationMs,
        }) => {
          const outcome = await requestSpokenGrade({
            attemptId,
            audio,
            durationMs,
            micStartupMs,
            practice: { ...run, answerIds: runAnswerIds, mistakeId, practiceDurationMs },
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
      backHref={backHref}
      buddy={tutor.buddy}
      dayBlock={Boolean(blockId)}
      doneHref={doneHref}
      key={bfcacheId}
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

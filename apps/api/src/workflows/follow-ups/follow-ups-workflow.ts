import { type OwedFollowUp } from "@zoonk/core/follow-ups/contract";
import { getCallWritingKey } from "@zoonk/core/language/conversations/call-writing";
import { createHook } from "workflow";
import { start } from "workflow/api";
import { retryPlanConflicts } from "../_shared/plan-conflict-retry";
import { repeatUntil } from "../_shared/repeat-until";
import { startOnce } from "../_shared/run-token";
import { callContentWorkflow } from "../calls/call-content-workflow";
import { placementItemsWorkflow } from "../goals/placement-items-workflow";
import { rebuildGoalCurriculumWorkflow } from "../goals/rebuild-goal-curriculum-workflow";
import { getLessonContentHookToken } from "../lessons/lesson-content-result";
import { lessonContentWorkflow } from "../lessons/lesson-content-workflow";
import { alphabetReviewWorkflow } from "../quality/alphabet-review-workflow";
import { sourceVisibilityWorkflow } from "../research/source-visibility-workflow";
import { sessionPreparationWorkflow } from "../sessions/session-preparation-workflow";
import { backgroundTaskWorkflow, getBackgroundTaskToken } from "./background-task-workflow";
import {
  countFollowUpsStep,
  endFollowUpStep,
  listFollowUpsStep,
  requestLessonWritingStep,
} from "./steps/follow-up-steps";
import { refreshStudyDayStep } from "./steps/refresh-study-day-step";

const MAX_PASSES = 20;

export type FollowUpsInput = { userId: string };

export function getFollowUpsToken(userId: string): string {
  return `follow-ups:${userId}`;
}

/** `start()` in a workflow is a step, so a replay never starts the same run twice. */
// oxlint-disable-next-line complexity -- Each follow-up kind starts its own workflow.
async function startFollowUp(followUp: OwedFollowUp): Promise<void> {
  const { userId } = followUp;

  switch (followUp.kind) {
    case "refreshStudyDay":
      await retryPlanConflicts(refreshStudyDayStep, { ...followUp.input, userId });
      return;
    case "prepareSession":
      await start(sessionPreparationWorkflow, [{ sessionId: followUp.input.sessionId, userId }]);
      return;
    case "prepareGoalLessons":
      await start(sessionPreparationWorkflow, [{ ...followUp.input, userId }]);
      return;
    case "rebuildGoalCurriculum": {
      const ask = `goal-rebuild:${followUp.input.goalId}:${followUp.id}:${followUp.revision}`;
      await startOnce(rebuildGoalCurriculumWorkflow, [followUp.input], ask);
      return;
    }
    case "preparePlacementItems": {
      const ask = `placement-items:${followUp.input.goalId}:${followUp.id}:${followUp.revision}`;

      await startOnce(
        placementItemsWorkflow,
        [{ ...followUp.input, analytics: { distinctId: userId } }],
        ask,
      );

      return;
    }
    case "writeLesson": {
      const writing = await requestLessonWritingStep({ lessonId: followUp.input.lessonId, userId });

      if (writing) {
        await startOnce(
          lessonContentWorkflow,
          [writing],
          getLessonContentHookToken(writing.lessonId),
        );
      }

      return;
    }
    case "askToCancelSecondStorePlus":
    case "checkFactSensitivity":
    case "classifyMistakeCause":
    case "endWebPlusBesideStore":
    case "rememberSession":
    case "settleSessionDay":
    case "voiceWord":
      await startOnce(backgroundTaskWorkflow, [followUp], getBackgroundTaskToken(followUp));
      return;
    // These read the learner's state as of when they run, and a run that's working may have read it
    // before this ask. So each ask (a row at a revision) gets one run of its own, which waits its turn.
    case "checkDailyInsight":
    case "findMistakePattern":
    case "rememberOnboarding": {
      const ask = `${getBackgroundTaskToken(followUp)}:${followUp.id}:${followUp.revision}`;
      await startOnce(backgroundTaskWorkflow, [followUp], ask);
      return;
    }
    case "writeSpeakingPaper": {
      const { mockId } = followUp.input;
      const writing = { kind: "speakingPaper", mockId, userId } as const;
      await startOnce(callContentWorkflow, [writing], getCallWritingKey(writing));
      return;
    }
    case "reviewAlphabetLesson": {
      const analytics = { distinctId: userId };
      await start(alphabetReviewWorkflow, [{ ...followUp.input, analytics }]);
      return;
    }
    case "checkUploadVisibility": {
      const { sourceId } = followUp.input;
      await start(sourceVisibilityWorkflow, [{ ownerId: userId, sourceId }]);
      return;
    }
    default:
      followUp satisfies never;
  }
}

/** A row asked for again while its run started survives its end and starts on the next pass. */
async function runFollowUp(followUp: OwedFollowUp): Promise<void> {
  await startFollowUp(followUp);
  await endFollowUpStep({ id: followUp.id, revision: followUp.revision });
}

async function runPass(userId: string): Promise<number> {
  const followUps = await listFollowUpsStep(userId);
  await Promise.all(followUps.map((followUp) => runFollowUp(followUp)));

  return followUps.length;
}

export async function followUpsWorkflow({ userId }: FollowUpsInput): Promise<void> {
  "use workflow";

  const startHook = createHook({ token: getFollowUpsToken(userId) });

  await repeatUntil({
    done: (count) => count === 0,
    run: () => runPass(userId),
    times: MAX_PASSES,
  });

  // Releases the run's start token, so it can start its successor for work asked for while it ran:
  // those starts found this run.
  startHook.dispose();

  if ((await countFollowUpsStep(userId)) > 0) {
    await startOnce(followUpsWorkflow, [{ userId }], getFollowUpsToken(userId));
  }
}

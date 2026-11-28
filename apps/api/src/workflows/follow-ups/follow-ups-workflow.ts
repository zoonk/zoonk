import { startLevelTestBank } from "@/lib/level-test-bank";
import { type OwedFollowUp } from "@zoonk/core/follow-ups/contract";
import { getCallWritingKey } from "@zoonk/core/language/conversations/call-writing";
import { createHook } from "workflow";
import { start } from "workflow/api";
import { retryPlanConflicts } from "../_shared/plan-conflict-retry";
import { repeatUntil } from "../_shared/repeat-until";
import { startOnce } from "../_shared/run-token";
import { callContentWorkflow } from "../calls/call-content-workflow";
import { getGoalRebuildAsk } from "../goals/goal-rebuild-ask";
import { startMockSupply } from "../goals/mock-questions-workflow";
import { placementItemsWorkflow } from "../goals/placement-items-workflow";
import { rebuildGoalCurriculumWorkflow } from "../goals/rebuild-goal-curriculum-workflow";
import { levelTestOutPreparationWorkflow } from "../language/level-test-out-preparation-workflow";
import { replenishLevelTestChecksWorkflow } from "../language/replenish-level-test-checks";
import {
  getSentenceOrdersToken,
  sentenceOrdersWorkflow,
} from "../language/sentence-orders-workflow";
import { getLessonContentHookToken } from "../lessons/lesson-content-result";
import { type LessonContentInput, lessonContentWorkflow } from "../lessons/lesson-content-workflow";
import { getChapterMindMapToken, toChapterMindMapInput } from "../mind-maps/chapter-mind-map-input";
import { chapterMindMapWorkflow } from "../mind-maps/chapter-mind-map-workflow";
import { alphabetReviewWorkflow } from "../quality/alphabet-review-workflow";
import { startResearchUploadAnswer } from "../research/answer-research-upload-workflow";
import { sourceVisibilityWorkflow } from "../research/source-visibility-workflow";
import { startOrResumeResearch } from "../research/start-or-resume-research";
import { waitForMaterialReading } from "../research/wait-for-material-reading";
import { sessionPreparationWorkflow } from "../sessions/session-preparation-workflow";
import { backgroundTaskWorkflow, getBackgroundTaskToken } from "./background-task-workflow";
import { catchUpMockReplanStep } from "./steps/catch-up-mock-replan-step";
import {
  endFollowUpStep,
  listFollowUpsStep,
  requestLessonWritingStep,
  requestOwedMindMapStep,
} from "./steps/follow-up-steps";
import { refreshPlanSuggestionStep } from "./steps/refresh-plan-suggestion-step";
import { refreshStudyDayStep } from "./steps/refresh-study-day-step";
import { refreshTestedOutPlanStep } from "./steps/refresh-tested-out-plan-step";
import { settleSessionPlanStep } from "./steps/settle-session-plan-step";

const MAX_PASSES = 20;

export type FollowUpsInput = { userId: string };

export function getFollowUpsToken(userId: string): string {
  return `follow-ups:${userId}`;
}

function startSentenceOrders(lessonId: string) {
  return startOnce(
    sentenceOrdersWorkflow,
    [{ lessonId, wait: "soon" }],
    getSentenceOrdersToken(lessonId),
  );
}

async function startPlacementPreparation(
  followUp: Extract<OwedFollowUp, { kind: "preparePlacementItems" }>,
) {
  const { input, userId } = followUp;
  const ask = `placement-items:${input.goalId}:${followUp.id}:${followUp.revision}`;

  await startOnce(placementItemsWorkflow, [{ ...input, analytics: { distinctId: userId } }], ask);
}

async function startLessonContent(writing: LessonContentInput | null): Promise<void> {
  if (writing) {
    await startOnce(lessonContentWorkflow, [writing], getLessonContentHookToken(writing.lessonId));
  }
}

/** `start()` in a workflow is a step, so a replay never starts the same run twice. */
// oxlint-disable-next-line complexity -- Each follow-up kind starts its own workflow.
async function startFollowUp(followUp: OwedFollowUp): Promise<void> {
  const { userId } = followUp;

  switch (followUp.kind) {
    case "refreshStudyDay":
      await retryPlanConflicts(refreshStudyDayStep, { ...followUp.input, userId });
      return;
    case "refreshPlanSuggestion":
      await retryPlanConflicts(refreshPlanSuggestionStep, { ...followUp.input, userId });
      return;
    case "catchUpMockReplan":
      await retryPlanConflicts(catchUpMockReplanStep, { ...followUp.input, userId });
      return;
    case "settleSessionPlan":
      await settleSessionPlanStep({ ...followUp.input, userId });
      return;
    case "prepareMockSupply":
      await startMockSupply(followUp.input, { id: followUp.id, revision: followUp.revision });
      return;
    case "prepareSession":
      await start(sessionPreparationWorkflow, [{ sessionId: followUp.input.sessionId, userId }]);
      return;
    case "prepareGoalLessons":
      await refreshTestedOutPlanStep({ goalId: followUp.input.goalId, userId });
      await start(sessionPreparationWorkflow, [{ ...followUp.input, userId }]);
      return;
    case "prepareLevelTestBank":
      await startLevelTestBank({
        analytics: { distinctId: userId, goalId: followUp.input.goalId },
        pair: followUp.input.pair,
        upgrade: true,
        wait: "learner",
      });

      return;
    case "replenishLevelTestChecks": {
      const batchId = `${followUp.id}:${followUp.revision}`;

      await startOnce(
        replenishLevelTestChecksWorkflow,
        [{ ...followUp.input, batchId, userId }],
        `replenish-level-test-checks:${batchId}`,
      );

      return;
    }
    case "prepareLevelTestOut":
      await startOnce(
        levelTestOutPreparationWorkflow,
        [{ ...followUp.input, userId }],
        `prepare-level-test-out:${followUp.id}:${followUp.revision}`,
      );

      return;
    case "rebuildGoalCurriculum": {
      const ask = getGoalRebuildAsk({ followUp, goalId: followUp.input.goalId });

      await startOnce(
        rebuildGoalCurriculumWorkflow,
        [{ ...followUp.input, followUp: { id: followUp.id, revision: followUp.revision } }],
        ask,
      );

      return;
    }
    case "preparePlacementItems":
      return startPlacementPreparation(followUp);
    case "researchGoal":
      return startOrResumeResearch(followUp.input.goalId);

    case "writeSecondTake":
    case "writeLesson":
      return startLessonContent(await requestLessonWritingStep(followUp.input, userId));
    case "writeSentenceOrders":
      await startSentenceOrders(followUp.input.lessonId);
      return;
    case "makeChapterMindMap": {
      const { chapterId, goalId, launch } = followUp.input;

      // Only a map's admission owes its launch, so an owed map without one asks first, and the
      // launch it owes starts on the next pass.
      await (launch
        ? startOnce(
            chapterMindMapWorkflow,
            [toChapterMindMapInput({ chapterId, launch })],
            getChapterMindMapToken(chapterId),
          )
        : requestOwedMindMapStep({ chapterId, goalId, userId }));

      return;
    }
    case "askToCancelSecondStorePlus":
    case "checkFactSensitivity":
    case "classifyMistakeCause":
    case "endWebPlusBesideStore":
    case "rememberSession":
    case "settleSessionDay":
    case "prepareContentFixMedia":
    case "voiceContentFix":
    case "voiceWord":
      await startOnce(backgroundTaskWorkflow, [followUp], getBackgroundTaskToken(followUp));
      return;
    // These read the state as of when they run, and a run that's working may have read it before
    // this ask. So each ask (a row at a revision) gets one run of its own, which waits its turn.
    case "checkDailyInsight":
    case "findMistakePattern":
    case "rememberOnboarding":
    case "suggestProfileTools":
    case "updateLessonsShowing": {
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
    case "answerResearchUpload":
      await startResearchUploadAnswer({ answerId: followUp.input.answerId, userId });
      return;
    case "readUpload":
      await waitForMaterialReading({ kind: "sources", sourceIds: [followUp.input.sourceId] });
      return;
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

  if (
    followUp.kind !== "answerResearchUpload" &&
    followUp.kind !== "rebuildGoalCurriculum" &&
    followUp.kind !== "prepareMockSupply" &&
    followUp.kind !== "suggestProfileTools"
  ) {
    await endFollowUpStep({ id: followUp.id, revision: followUp.revision });
  }
}

async function runPass(
  userId: string,
  started: Pick<OwedFollowUp, "id" | "revision">[],
): Promise<number> {
  const followUps = await listFollowUpsStep(userId, started);
  await Promise.all(followUps.map((followUp) => runFollowUp(followUp)));
  started.push(...followUps.map(({ id, revision }) => ({ id, revision })));
  return followUps.length;
}

export async function followUpsWorkflow({ userId }: FollowUpsInput): Promise<void> {
  "use workflow";

  const startHook = createHook({ token: getFollowUpsToken(userId) });
  const started: Pick<OwedFollowUp, "id" | "revision">[] = [];

  await repeatUntil({
    done: (count) => count === 0,
    run: () => runPass(userId, started),
    times: MAX_PASSES,
  });

  // Releases the run's start token, so an ask arriving after this can start its successor.
  startHook.dispose();

  const remaining = await listFollowUpsStep(userId, started);

  if (remaining.length > 0) {
    await startOnce(followUpsWorkflow, [{ userId }], getFollowUpsToken(userId));
  }
}

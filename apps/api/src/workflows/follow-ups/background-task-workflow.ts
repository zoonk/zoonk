import { type OwedFollowUp } from "@zoonk/core/follow-ups/contract";
import { rememberProposedMemory } from "../_shared/remember-memory";
import { waitForRunToken } from "../_shared/run-token";
import { prepareContentFixMedia } from "./content-fix-media";
import {
  askToCancelSecondStorePlusStep,
  checkFactSensitivityStep,
  checkMistakePatternStep,
  claimDailyInsightStep,
  endWebPlusBesideStoreStep,
  proposeOnboardingMemoryStep,
  proposeSessionMemoryStep,
  resolveMistakeCauseStep,
  saveDailyInsightStep,
  settleSessionDayStep,
  updateLessonsShowingStep,
  voiceWordStep,
  writeDailyInsightStep,
} from "./steps/background-task-steps";
import {
  finishProfileToolSuggestionsStep,
  writeProfileToolSuggestionsStep,
} from "./steps/suggest-profile-tools-steps";

export type BackgroundTask = Exclude<
  OwedFollowUp,
  {
    kind:
      | "checkUploadVisibility"
      | "makeChapterMindMap"
      | "prepareMockSupply"
      | "prepareGoalLessons"
      | "preparePlacementItems"
      | "prepareLevelTestBank"
      | "prepareLevelTestOut"
      | "replenishLevelTestChecks"
      | "rebuildGoalCurriculum"
      | "prepareSession"
      | "refreshStudyDay"
      | "settleSessionPlan"
      | "reviewAlphabetLesson"
      | "writeLesson"
      | "writeSentenceOrders"
      | "writeSpeakingPaper";
  }
>;

export function getBackgroundTaskToken({ key, kind, userId }: BackgroundTask): string {
  return `${kind}:${userId}:${key}`;
}

type InsightTask = Extract<BackgroundTask, { kind: "checkDailyInsight" }>;

/** Claim, write and save are separate steps, so a retried save never asks the model again. */
async function checkDailyInsight({ input, userId }: InsightTask): Promise<void> {
  const claim = await claimDailyInsightStep({ ...input, userId });

  if (!claim) {
    return;
  }

  const { endedAt, timeZone } = input;
  const written = await writeDailyInsightStep({ claim, endedAt, timeZone, userId });

  await saveDailyInsightStep({ claim, userId, written });
}

async function suggestProfileTools(
  task: Extract<BackgroundTask, { kind: "suggestProfileTools" }>,
): Promise<void> {
  const result = await writeProfileToolSuggestionsStep(task).then(
    (tools) => ({ status: "generated" as const, tools }),
    () => ({ status: "failed" as const }),
  );

  await finishProfileToolSuggestionsStep({ result, task });
}

async function runTask(task: BackgroundTask): Promise<void> {
  const { userId } = task;

  switch (task.kind) {
    case "classifyMistakeCause":
      return resolveMistakeCauseStep({ ...task.input, userId });
    case "findMistakePattern":
      return checkMistakePatternStep({ ...task.input, userId });
    case "rememberOnboarding":
      return rememberProposedMemory(await proposeOnboardingMemoryStep({ ...task.input, userId }));
    case "suggestProfileTools":
      return suggestProfileTools(task);
    case "rememberSession":
      return rememberProposedMemory(await proposeSessionMemoryStep({ ...task.input, userId }));
    case "checkDailyInsight":
      return checkDailyInsight(task);
    case "checkFactSensitivity":
      return checkFactSensitivityStep(task.input);
    case "settleSessionDay":
      return settleSessionDayStep({ ...task.input, userId });
    case "voiceWord":
      return voiceWordStep(task.input);
    case "updateLessonsShowing":
      return updateLessonsShowingStep(task.input);
    case "prepareContentFixMedia":
    case "voiceContentFix":
      return prepareContentFixMedia(task.input.fixId);
    case "endWebPlusBesideStore":
      return endWebPlusBesideStoreStep(userId);
    case "askToCancelSecondStorePlus":
      return askToCancelSecondStorePlusStep({ ...task.input, userId });
    default:
      return task satisfies never;
  }
}

/** One model call per step. A run started holding its token goes at once; any other waits its turn. */
export async function backgroundTaskWorkflow(task: BackgroundTask): Promise<void> {
  "use workflow";

  await waitForRunToken(getBackgroundTaskToken(task));
  await runTask(task);
}

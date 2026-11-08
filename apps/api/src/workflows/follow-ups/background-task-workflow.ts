import { type OwedFollowUp } from "@zoonk/core/follow-ups/contract";
import { rememberProposedMemory } from "../_shared/remember-memory";
import { waitForRunToken } from "../_shared/run-token";
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
  voiceWordStep,
  writeDailyInsightStep,
} from "./steps/background-task-steps";

export type BackgroundTask = Exclude<
  OwedFollowUp,
  {
    kind:
      | "checkUploadVisibility"
      | "prepareGoalLessons"
      | "prepareSession"
      | "refreshStudyDay"
      | "reviewAlphabetLesson"
      | "writeLesson"
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

async function runTask(task: BackgroundTask): Promise<void> {
  const { userId } = task;

  switch (task.kind) {
    case "classifyMistakeCause":
      return resolveMistakeCauseStep({ ...task.input, userId });
    case "findMistakePattern":
      return checkMistakePatternStep({ ...task.input, userId });
    case "rememberOnboarding":
      return rememberProposedMemory(await proposeOnboardingMemoryStep({ ...task.input, userId }));
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

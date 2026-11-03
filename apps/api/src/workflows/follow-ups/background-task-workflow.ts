import { type OwedFollowUp } from "@zoonk/core/follow-ups/contract";
import { rememberProposedMemory } from "../_shared/remember-memory";
import { claimRunToken } from "../_shared/run-token";
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
      | "reviewAlphabetLesson"
      | "writeLesson"
      | "writeSpeakingPaper";
  }
>;

export type BackgroundTaskResult = { status: "alreadyRunning" | "done" };

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

/**
 * One model call per step. A run already working on the same thing for the learner makes this one
 * exit: each works on one fixed thing, or on the learner's state as of when it runs.
 */
export async function backgroundTaskWorkflow(task: BackgroundTask): Promise<BackgroundTaskResult> {
  "use workflow";

  using claim = await claimRunToken(`${task.kind}:${task.userId}:${task.key}`);

  if (claim.conflict) {
    return { status: "alreadyRunning" };
  }

  await runTask(task);

  return { status: "done" };
}

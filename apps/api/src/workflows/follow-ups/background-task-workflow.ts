import { type OwedFollowUp } from "@zoonk/core/follow-ups/contract";
import { claimRunToken } from "../_shared/run-token";
import {
  type ProposedMemory,
  checkFactSensitivityStep,
  checkMistakePatternStep,
  claimDailyInsightStep,
  gateMemoryCandidateStep,
  proposeOnboardingMemoryStep,
  proposeSessionMemoryStep,
  rememberMemoryCandidateStep,
  resolveMistakeCauseStep,
  saveDailyInsightStep,
  voiceWordStep,
  writeDailyInsightStep,
} from "./steps/background-task-steps";

export type BackgroundTask = Exclude<
  OwedFollowUp,
  { kind: "prepareGoalLessons" | "prepareSession" | "writeLesson" | "writeSpeakingPaper" }
>;

export type BackgroundTaskResult = { status: "alreadyRunning" | "done" };

type InsightTask = Extract<BackgroundTask, { kind: "checkDailyInsight" }>;

async function rememberCandidate({
  candidate,
  context,
}: {
  candidate: ProposedMemory["candidates"][number];
  context: ProposedMemory["context"];
}): Promise<void> {
  const gate = await gateMemoryCandidateStep(candidate);

  if (gate) {
    await rememberMemoryCandidateStep({ candidate, context, gate });
  }
}

/** Each candidate sees what the one before it changed. */
async function remember(proposed: ProposedMemory | null): Promise<void> {
  if (!proposed) {
    return;
  }

  await proposed.candidates.reduce<Promise<void>>(
    (previous, candidate) =>
      previous.then(() => rememberCandidate({ candidate, context: proposed.context })),
    Promise.resolve(),
  );
}

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
      return remember(await proposeOnboardingMemoryStep({ ...task.input, userId }));
    case "rememberSession":
      return remember(await proposeSessionMemoryStep({ ...task.input, userId }));
    case "checkDailyInsight":
      return checkDailyInsight(task);
    case "checkFactSensitivity":
      return checkFactSensitivityStep(task.input);
    case "voiceWord":
      return voiceWordStep(task.input);
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

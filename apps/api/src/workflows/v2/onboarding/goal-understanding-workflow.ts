import { startLevelTestBank } from "@/lib/level-test-bank";
import { GOAL_UNDERSTANDING_READY_STEP } from "@zoonk/core/library/generation/steps";
import {
  type UnderstandingRunDraft,
  type UnderstoodLanguagePair,
} from "@zoonk/core/view-models/onboarding/understanding-run";
import { WORKFLOW_ERROR_STEP } from "@zoonk/core/workflows/steps";
import { getWorkflowMetadata } from "workflow";
import { claimRunToken } from "../_shared/run-token";
import {
  completeUnderstandingStep,
  failUnderstandingStep,
  readGoalStep,
  recordUnderstandingRunStep,
  understandingProgressStep,
} from "./steps/goal-understanding-steps";

async function startLevelTests({
  pairs,
  userId,
}: {
  pairs: UnderstoodLanguagePair[];
  userId: string;
}) {
  await Promise.allSettled(
    pairs.map((pair) => startLevelTestBank({ analytics: { distinctId: userId }, pair })),
  );
}

async function understandDraft(draft: UnderstandingRunDraft): Promise<UnderstoodLanguagePair[]> {
  if (draft.status === "understood") {
    return [];
  }

  try {
    const read = await readGoalStep(draft);
    return await completeUnderstandingStep({ draft, read });
  } catch (error) {
    await Promise.all([
      failUnderstandingStep(draft.id),
      understandingProgressStep({
        entityId: draft.id,
        reason: "aiGenerationFailed",
        status: "error",
        step: WORKFLOW_ERROR_STEP,
      }),
    ]);

    throw error;
  }
}

export type GoalUnderstandingRunResult = {
  draftId: string;
  status: "joined" | "missing" | "understood";
};

export async function goalUnderstandingWorkflow({
  draftId,
}: {
  draftId: string;
}): Promise<GoalUnderstandingRunResult> {
  "use workflow";

  const { workflowRunId } = getWorkflowMetadata();
  const { conflict } = await claimRunToken(`goal-understanding:${draftId}`);

  if (conflict) {
    await understandingProgressStep({
      entityId: conflict.runId,
      status: "started",
      step: "joinRunningUnderstanding",
    });

    return { draftId, status: "joined" };
  }

  const draft = await recordUnderstandingRunStep({ draftId, runId: workflowRunId });

  if (!draft) {
    await understandingProgressStep({
      entityId: draftId,
      reason: "notFound",
      status: "error",
      step: WORKFLOW_ERROR_STEP,
    });

    return { draftId, status: "missing" };
  }

  const pairs = await understandDraft(draft);

  await understandingProgressStep({
    entityId: draftId,
    status: "completed",
    step: GOAL_UNDERSTANDING_READY_STEP,
  });

  await startLevelTests({ pairs, userId: draft.userId });

  return { draftId, status: "understood" };
}

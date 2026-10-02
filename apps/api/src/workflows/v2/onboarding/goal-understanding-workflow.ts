import { startLevelTestBank } from "@/lib/level-test-bank";
import { GOAL_UNDERSTANDING_READY_STEP } from "@zoonk/core/library/generation/steps";
import {
  type UnderstandingRunDraft,
  type UnderstoodLanguagePair,
} from "@zoonk/core/view-models/onboarding/understanding-run";
import { WORKFLOW_ERROR_STEP } from "@zoonk/core/workflows/steps";
import { createHook, getWorkflowMetadata } from "workflow";
import {
  completeUnderstandingStep,
  failUnderstandingStep,
  readGoalStep,
  recordUnderstandingRunStep,
  understandingProgressStep,
} from "./steps/goal-understanding-steps";

/**
 * A language goal's level test is written as soon as its pair is known, while the learner reads
 * the card and answers the first questions. It's extra: a start that fails never fails the
 * understanding, and the goal's curriculum run starts it again.
 */
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

/**
 * The words with the model, then the card with the named exam's dates. A draft already understood
 * (the same words were read for it meanwhile) isn't read again. Returns its language goals.
 */
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

/**
 * Reads a goal the learner typed on the first onboarding screen and keeps what it understood on
 * the draft, so a refresh shows the same card: the words with the model (the unsafe-intent
 * classifier checks them beside it), then the named exam's dates for the year they said, then the
 * card. The stream says `readGoal`, `findExamDates`, then `understandingReady`; a language goal's
 * level test starts being written right after. One run per draft: a second start joins it. A run
 * that can't read the words marks the draft failed, so the learner sees it and can try again.
 */
export async function goalUnderstandingWorkflow({
  draftId,
}: {
  draftId: string;
}): Promise<GoalUnderstandingRunResult> {
  "use workflow";

  const { workflowRunId } = getWorkflowMetadata();
  const hook = createHook({ token: `goal-understanding:${draftId}` });
  const conflict = await hook.getConflict();

  // Whoever follows this run's id moves to the run reading the draft.
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

import { createStepStream, progressStep } from "@/workflows/_shared/stream-status";
import { type GoalUnderstandingStepName } from "@zoonk/core/library/generation/steps";
import {
  type UnderstandingRunDraft,
  completeUnderstandingDraft,
  failUnderstandingDraft,
  loadUnderstandingDraft,
  readGoalWords,
  recordUnderstandingRun,
} from "@zoonk/core/view-models/onboarding/understanding-run";
import { type WORKFLOW_ERROR_STEP } from "@zoonk/core/workflows/steps";
import { withAiRetry } from "../../_shared/ai-retry";

type UnderstandingStreamStep = GoalUnderstandingStepName | typeof WORKFLOW_ERROR_STEP;

type ReadWords = Awaited<ReturnType<typeof readGoalWords>>;

export const understandingProgressStep = progressStep<UnderstandingStreamStep>;

export async function recordUnderstandingRunStep(input: {
  draftId: string;
  runId: string;
}): Promise<UnderstandingRunDraft | null> {
  "use step";

  await recordUnderstandingRun(input);
  return loadUnderstandingDraft(input.draftId);
}

export async function readGoalStep(draft: UnderstandingRunDraft): Promise<ReadWords> {
  "use step";

  await using stream = createStepStream<UnderstandingStreamStep>();
  await stream.status({ entityId: draft.id, status: "started", step: "readGoal" });

  return await withAiRetry(() => readGoalWords(draft));
}

export async function completeUnderstandingStep(input: {
  draft: UnderstandingRunDraft;
  read: ReadWords;
}) {
  "use step";

  await using stream = createStepStream<UnderstandingStreamStep>();
  await stream.status({ entityId: input.draft.id, status: "started", step: "findExamDates" });

  return await completeUnderstandingDraft({ draft: input.draft, ...input.read });
}

export async function failUnderstandingStep(draftId: string): Promise<void> {
  "use step";

  await failUnderstandingDraft(draftId);
}

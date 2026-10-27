import { WORKFLOW_ERROR_STEP } from "@zoonk/core/workflows/steps";
import { progressStep } from "../../_shared/stream-status";
import { claimRunToken } from "../_shared/run-token";

export type QuestionWritingResult = { status: "failed" | "joined" | "written" };

/**
 * A run that writes the questions a test, mock or challenge still needs into the shared bank, while
 * the learner is asked the ones that exist: one run per `token` (a second start joins it, and its
 * stream names the run to follow), and it fails only when `write` could write nothing.
 */
export async function runQuestionWriting<TStep extends string>({
  steps,
  token,
  write,
}: {
  steps: { join: TStep; ready: TStep; write: TStep };
  token: string;
  write: () => Promise<"failed" | "written">;
}): Promise<QuestionWritingResult> {
  const progress = progressStep<TStep | typeof WORKFLOW_ERROR_STEP>;
  using claim = await claimRunToken(token);

  if (claim.conflict) {
    await progress({ entityId: claim.conflict.runId, status: "started", step: steps.join });
    return { status: "joined" };
  }

  await progress({ status: "started", step: steps.write });

  const outcome = await write().catch(async (error: unknown) => {
    await progress({ reason: "aiGenerationFailed", status: "error", step: WORKFLOW_ERROR_STEP });
    throw error;
  });

  await progress(
    outcome === "failed"
      ? { reason: "aiGenerationFailed", status: "error", step: WORKFLOW_ERROR_STEP }
      : { status: "completed", step: steps.ready },
  );

  return { status: outcome };
}

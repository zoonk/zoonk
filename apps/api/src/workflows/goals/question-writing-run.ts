import { WORKFLOW_ERROR_STEP } from "@zoonk/core/workflows/steps";
import { claimRunToken } from "../_shared/run-token";
import { progressStep } from "../_shared/stream-status";

export type QuestionWritingResult = { status: "failed" | "joined" | "written" };

/** One run per `token`: a second start joins it. Fails only when `write` could write nothing. */
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
    await progress(
      { entityId: claim.conflict.runId, status: "started", step: steps.join },
      { last: true },
    );

    return { status: "joined" };
  }

  await progress({ status: "started", step: steps.write });

  const outcome = await write().catch(async (error: unknown) => {
    await progress(
      { reason: "aiGenerationFailed", status: "error", step: WORKFLOW_ERROR_STEP },
      { last: true },
    );

    throw error;
  });

  await progress(
    outcome === "failed"
      ? { reason: "aiGenerationFailed", status: "error", step: WORKFLOW_ERROR_STEP }
      : { status: "completed", step: steps.ready },
    { last: true },
  );

  return { status: outcome };
}

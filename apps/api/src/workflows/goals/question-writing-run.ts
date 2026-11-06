import { WORKFLOW_ERROR_STEP } from "@zoonk/core/workflows/steps";
import { progressStep } from "../_shared/stream-status";

export type QuestionWritingResult = { status: "failed" | "written" };

/** Fails only when `write` could write nothing. */
export async function runQuestionWriting<TStep extends string>({
  steps,
  write,
}: {
  steps: { ready: TStep; write: TStep };
  write: () => Promise<"failed" | "written">;
}): Promise<QuestionWritingResult> {
  const progress = progressStep<TStep | typeof WORKFLOW_ERROR_STEP>;

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

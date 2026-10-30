import { WORKFLOW_ERROR_STEP } from "@zoonk/core/workflows/steps";
import { closeStreamAfter, progressStep } from "../../_shared/stream-status";
import { claimRunToken } from "../_shared/run-token";

export type QuestionWritingResult = { status: "failed" | "joined" | "written" };

type QuestionWriting<TStep extends string> = {
  steps: { join: TStep; ready: TStep; write: TStep };
  token: string;
  write: () => Promise<"failed" | "written">;
};

async function writeQuestions<TStep extends string>({
  steps,
  token,
  write,
}: QuestionWriting<TStep>): Promise<QuestionWritingResult> {
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

/**
 * One run per `token`: a second start joins it. Fails only when `write` could write nothing. Ends
 * the run's stream, so the calling workflow returns it as its last step.
 */
export function runQuestionWriting<TStep extends string>(
  writing: QuestionWriting<TStep>,
): Promise<QuestionWritingResult> {
  return closeStreamAfter(() => writeQuestions(writing));
}

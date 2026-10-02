import { createStepStream } from "@/workflows/_shared/stream-status";
import { writeLevelTestBank } from "@zoonk/core/language/level-test/write-bank";
import { type LevelTestBankStepName } from "@zoonk/core/library/generation/steps";
import { type StepStreamMessage, type WORKFLOW_ERROR_STEP } from "@zoonk/core/workflows/steps";
import { withAiRetry } from "../../_shared/ai-retry";
import { type ContentAnalytics } from "../../_shared/content-analytics";

export type LevelTestBankStreamStep = LevelTestBankStepName | typeof WORKFLOW_ERROR_STEP;

export type LanguagePair = { language: string; targetLanguage: string };

type WriteStatus = Awaited<ReturnType<typeof writeLevelTestBank>>["status"];

/** Writes one progress event of a level test bank run to its stream. */
export async function levelTestBankProgressStep(
  message: StepStreamMessage<LevelTestBankStreamStep>,
): Promise<void> {
  "use step";

  await using stream = createStepStream<LevelTestBankStreamStep>();
  await stream.status(message);
}

/**
 * Writes the pair's level test when nobody has (each level in its own call, a minute or two in
 * all), or says it's `ready` or that another run is writing it (`running`). A run that went quiet
 * lost its claim, so asking again later takes it over. A rate limit is retried after a minute.
 */
export async function writeLevelTestBankStep({
  analytics,
  pair,
  workflowRunId,
}: {
  analytics?: ContentAnalytics;
  pair: LanguagePair;
  workflowRunId: string;
}): Promise<WriteStatus> {
  "use step";

  const { status } = await withAiRetry(() =>
    writeLevelTestBank({
      analytics: {
        distinctId: analytics?.distinctId,
        goalId: analytics?.goalId,
        traceId: workflowRunId,
      },
      pair,
    }),
  );

  return status;
}

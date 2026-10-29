import { progressStep } from "@/workflows/_shared/stream-status";
import { prepareLevelTestBankAudio } from "@zoonk/core/language/level-test/prepare-audio";
import { writeLevelTestBank } from "@zoonk/core/language/level-test/write-bank";
import { type LevelTestBankStepName } from "@zoonk/core/library/generation/steps";
import { type WORKFLOW_ERROR_STEP } from "@zoonk/core/workflows/steps";
import { withAiRetry } from "../../_shared/ai-retry";
import { type ContentAnalytics } from "../../_shared/content-analytics";

export type LevelTestBankStreamStep = LevelTestBankStepName | typeof WORKFLOW_ERROR_STEP;

export type LanguagePair = { language: string; targetLanguage: string };

type WriteStatus = Awaited<ReturnType<typeof writeLevelTestBank>>["status"];

export const levelTestBankProgressStep = progressStep<LevelTestBankStreamStep>;

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

export async function prepareLevelTestBankAudioStep({
  analytics,
  pair,
  workflowRunId,
}: {
  analytics?: ContentAnalytics;
  pair: LanguagePair;
  workflowRunId: string;
}): Promise<void> {
  "use step";

  await withAiRetry(() =>
    prepareLevelTestBankAudio({
      analytics: {
        distinctId: analytics?.distinctId,
        goalId: analytics?.goalId,
        traceId: workflowRunId,
      },
      pair,
    }),
  );
}

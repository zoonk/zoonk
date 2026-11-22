import {
  type Replenishment,
  appendLevelTestChecks,
  readLevelTestCheckShortage,
  writeLevelTestChecks,
} from "@zoonk/core/language/level-test/replenish-checks";
import { isTTSSupportedLanguage } from "@zoonk/utils/languages";
import { getWorkflowMetadata } from "workflow";
import { acquireRunToken } from "../_shared/run-token";
import { voiceLevelTestPassageStep } from "./steps/level-test-bank-steps";

async function readShortageStep(input: Replenishment & { userId: string }) {
  "use step";

  return readLevelTestCheckShortage(input);
}

async function writeChecksStep(input: Parameters<typeof writeLevelTestChecks>[0]) {
  "use step";

  return writeLevelTestChecks(input);
}

async function saveChecksStep(input: Parameters<typeof appendLevelTestChecks>[0]) {
  "use step";

  return appendLevelTestChecks(input);
}

async function prepareChecks(
  input: Replenishment & { batchId: string; userId: string; runId: string },
) {
  const { batchId, goalId, level, pair, runId, userId } = input;

  using claim = await acquireRunToken(
    `level-test-checks:${pair.language}:${pair.targetLanguage}:${level}`,
  );

  if (claim.conflict) {
    throw new Error("The level check bank is still being replenished.");
  }

  const previousPassages = await readShortageStep(input);

  if (!previousPassages) {
    return [];
  }

  const confirmations = await writeChecksStep({
    analytics: { distinctId: userId, goalId, traceId: runId },
    level,
    pair,
    previousPassages,
  });

  return await saveChecksStep({ batchId, confirmations, pair });
}

export async function replenishLevelTestChecks(
  input: Replenishment & { batchId: string; userId: string },
) {
  const { goalId, pair, userId } = input;
  const { workflowRunId } = getWorkflowMetadata();
  const passages = await prepareChecks({ ...input, runId: workflowRunId });

  if (!isTTSSupportedLanguage(pair.targetLanguage)) {
    return;
  }

  await Promise.allSettled(
    passages.map((text) =>
      voiceLevelTestPassageStep({
        analytics: { distinctId: userId, goalId },
        language: pair.targetLanguage,
        text,
        workflowRunId,
      }),
    ),
  );
}

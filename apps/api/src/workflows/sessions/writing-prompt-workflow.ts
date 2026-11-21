import { createHash } from "node:crypto";
import { trackSystemEvent } from "@zoonk/core/analytics/server";
import { type WritingPromptStepName } from "@zoonk/core/library/generation/steps";
import {
  type WritingSupplyInput,
  getWritingPromptId,
  loadWritingSupply,
  writeWritingItem,
} from "@zoonk/core/library/items/write-writing-item";
import { reserveWritingPromptSpend } from "@zoonk/core/library/items/writing-prompt-spend";
import { getWorkflowMetadata } from "workflow";
import { startOnce, waitForRun } from "../_shared/run-token";
import { progressStep } from "../_shared/stream-status";

async function writePromptStep(input: WritingSupplyInput, runId: string, slot: number) {
  "use step";

  await writeWritingItem(input, getWritingPromptId(runId, slot));
}

async function admitPromptWorkStep(input: WritingSupplyInput, runId: string) {
  "use step";

  const supply = await loadWritingSupply(input);
  const count = supply?.missing ?? 0;

  if (count === 0) {
    return { count, status: "ready" as const };
  }

  const reserved = await reserveWritingPromptSpend({ count, runId, userId: input.userId });

  return reserved === null
    ? { count: 0, status: "signUpRequired" as const }
    : { count: reserved, status: "writing" as const };
}

async function trackFailureStep() {
  "use step";

  await trackSystemEvent({
    name: "Generation Failed",
    properties: { content_kind: "essay", model: null, task: "write-writing-prompt" },
  });
}

/** @internal */
export async function writingPromptWorkflow(input: WritingSupplyInput) {
  "use workflow";

  const { workflowRunId } = getWorkflowMetadata();

  try {
    const { count, status } = await admitPromptWorkStep(input, workflowRunId);

    if (status !== "writing") {
      await progressStep<WritingPromptStepName>(
        { status: "completed", step: status },
        { last: true },
      );

      return { status };
    }

    for (let slot = 0; slot < count; slot += 1) {
      // oxlint-disable-next-line no-await-in-loop -- Each item changes the number of prompts still needed.
      await writePromptStep(input, workflowRunId, slot);
    }

    await progressStep<WritingPromptStepName>(
      { status: "completed", step: "writeWritingPrompt" },
      { last: true },
    );

    return { status: "ready" as const };
  } catch (error) {
    await trackFailureStep();

    await progressStep<WritingPromptStepName>(
      { reason: "aiGenerationFailed", status: "error", step: "writeWritingPrompt" },
      { last: true },
    );

    throw error;
  }
}

export async function ensureWritingPrompts(
  input: WritingSupplyInput,
): Promise<{ status: "ready" } | { runId: string; status: "writing" }> {
  "use step";

  const supply = await loadWritingSupply(input);

  if (!supply) {
    return { status: "ready" };
  }

  if (supply.missing === 0) {
    return { status: "ready" };
  }

  const runId = await startOnce(
    writingPromptWorkflow,
    [input],
    writingRunToken(input, supply.chosenSubjects),
  );

  const current = await loadWritingSupply(input);
  return current?.missing === 0 ? { status: "ready" } : { runId, status: "writing" };
}

function writingRunToken(input: WritingSupplyInput, choices: string[]): string {
  return writingToken("writing-prompt", [
    input.userId,
    input.goalId,
    input.taskKey,
    input.unit,
    String(input.count),
    input.skillId ?? "",
    ...choices,
  ]);
}

function writingToken(prefix: string, parts: string[]): string {
  return `${prefix}:${createHash("sha256").update(JSON.stringify(parts)).digest("hex")}`;
}

async function writingBatchWorkflow(runIds: string[]) {
  "use workflow";

  const ready = await Promise.all(runIds.map((runId) => waitForRun(runId)));

  if (ready.every(Boolean)) {
    await progressStep<WritingPromptStepName>(
      { status: "completed", step: "writeWritingPrompt" },
      { last: true },
    );

    return;
  }

  await progressStep<WritingPromptStepName>(
    { reason: "aiGenerationFailed", status: "error", step: "writeWritingPrompt" },
    { last: true },
  );

  throw new Error("Writing prompt preparation did not finish.");
}

export async function ensureMockWritingPrompts(requests: WritingSupplyInput[]) {
  const results = await Promise.all(requests.map((request) => ensureWritingPrompts(request)));
  const runIds = results.flatMap((result) => (result.status === "writing" ? [result.runId] : []));
  const first = runIds[0];

  if (!first) {
    return { status: "ready" as const };
  }

  const runId =
    runIds.length === 1
      ? first
      : await startOnce(
          writingBatchWorkflow,
          [runIds],
          writingToken("writing-batch", runIds.toSorted()),
        );

  return { runId, status: "writing" as const };
}

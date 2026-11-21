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
import { startOnce } from "../_shared/run-token";
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

  if (!supply || supply.missing === 0) {
    return { status: "ready" };
  }

  const runId = await startOnce(
    writingPromptWorkflow,
    [input],
    [`writing-prompt:${supply.blueprint.id}:${input.taskKey}`, ...supply.chosenSubjects].join(":"),
  );

  const current = await loadWritingSupply(input);
  return current?.missing === 0 ? { status: "ready" } : { runId, status: "writing" };
}

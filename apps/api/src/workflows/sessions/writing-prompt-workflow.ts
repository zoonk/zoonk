import { trackSystemEvent } from "@zoonk/core/analytics/server";
import {
  type WritingSupplyInput,
  getWritingPromptId,
  loadWritingSupply,
  reserveWritingPromptSpend,
  writeWritingItem,
} from "@zoonk/core/library/items/write-writing-item";
import { getWorkflowMetadata } from "workflow";
import { startOnce } from "../_shared/run-token";
import { progressStep } from "../_shared/stream-status";

async function writePromptStep(input: WritingSupplyInput, runId: string, slot: number) {
  "use step";

  await writeWritingItem(input, getWritingPromptId(runId, slot));
}

async function admitPromptWorkStep(input: WritingSupplyInput) {
  "use step";

  const supply = await loadWritingSupply(input);
  const count = supply?.missing ?? 0;

  if (count === 0) {
    return { count, status: "ready" as const };
  }

  const allowed = await reserveWritingPromptSpend(input, count);
  return { count, status: allowed ? ("writing" as const) : ("signUpRequired" as const) };
}

async function trackFailureStep() {
  "use step";

  await trackSystemEvent({
    name: "Generation Failed",
    properties: { content_kind: "essay", model: null, task: "write-writing-prompt" },
  });
}

export async function writingPromptWorkflow(input: WritingSupplyInput) {
  "use workflow";

  const { workflowRunId } = getWorkflowMetadata();

  try {
    const { count, status } = await admitPromptWorkStep(input);

    if (status !== "writing") {
      await progressStep({ status: "completed", step: status }, { last: true });
      return { status };
    }

    for (let slot = 0; slot < count; slot += 1) {
      // oxlint-disable-next-line no-await-in-loop -- Each item changes the number of prompts still needed.
      await writePromptStep(input, workflowRunId, slot);
    }

    await progressStep({ status: "completed", step: "writeWritingPrompt" }, { last: true });
    return { status: "ready" as const };
  } catch (error) {
    await trackFailureStep();

    await progressStep(
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
    throw new Error("Writing supply requires an owned exam and a saved written task.");
  }

  if (supply.missing === 0) {
    return { status: "ready" };
  }

  const runId = await startOnce(
    writingPromptWorkflow,
    [input],
    `writing-prompt:${supply.blueprint.id}:${input.taskKey}`,
  );

  const current = await loadWritingSupply(input);
  return current?.missing === 0 ? { status: "ready" } : { runId, status: "writing" };
}

import { createHash } from "node:crypto";
import { trackSystemEvent } from "@zoonk/core/analytics/server";
import { type WritingPromptStepName } from "@zoonk/core/library/generation/steps";
import { writeWritingItem } from "@zoonk/core/library/items/write-writing-item";
import {
  type WritingSupplyInput,
  loadWritingSupply,
} from "@zoonk/core/library/items/writing-prompt-pool";
import { admitWritingPromptWork } from "@zoonk/core/library/items/writing-prompt-spend";
import { getWorkflowMetadata } from "workflow";
import { getRun } from "workflow/api";
import { claimRunToken, startOnce, waitForRun, waitForRunToken } from "../_shared/run-token";
import { progressStep } from "../_shared/stream-status";

type WritingPromptRun = { input: WritingSupplyInput; poolToken: string };

async function writePromptStep(
  { input, poolToken }: WritingPromptRun,
  runId: string,
  slot: number,
) {
  "use step";

  await writeWritingItem({ input, poolToken, runId, slot });
}

async function admitPromptWorkStep({ input, poolToken }: WritingPromptRun, runId: string) {
  "use step";

  return admitWritingPromptWork({ input, poolToken, runId });
}

async function trackFailureStep() {
  "use step";

  await trackSystemEvent({
    name: "Generation Failed",
    properties: { content_kind: "essay", model: null, task: "write-writing-prompt" },
  });
}

/** @internal */
export async function writingPromptWorkflow(run: WritingPromptRun) {
  "use workflow";

  return writePrompt(run);
}

async function writingDrillWorkflow(run: WritingPromptRun) {
  "use workflow";

  return writePrompt(run);
}

async function writePrompt(run: WritingPromptRun) {
  const { workflowRunId } = getWorkflowMetadata();

  try {
    const token = run.poolToken;
    // Only this run reports its learner's status. The pool claim serializes the shared writes.
    using claim = await claimRunToken(token);

    if (claim.conflict && !(await waitForRunToken(token))) {
      throw new Error("The writing prompt pool is still being prepared.");
    }

    const { count, status } = await admitPromptWorkStep(run, workflowRunId);

    if (status !== "writing") {
      await progressStep<WritingPromptStepName>(
        { status: "completed", step: status },
        { last: true },
      );

      return { status };
    }

    for (let slot = 0; slot < count; slot += 1) {
      // oxlint-disable-next-line no-await-in-loop -- Each item changes the number of prompts still needed.
      await writePromptStep(run, workflowRunId, slot);
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

  const { poolToken } = supply;

  const runToken = writingToken("writing-prompt", [
    input.userId,
    input.goalId,
    String(input.count),
    poolToken,
  ]);

  const workflow = input.unit === "drill" ? writingDrillWorkflow : writingPromptWorkflow;
  const runId = await startOnce(workflow, [{ input, poolToken }], runToken);

  const current = await loadWritingSupply(input);
  return !current || current.missing === 0 ? { status: "ready" } : { runId, status: "writing" };
}

function writingToken(prefix: string, parts: string[]): string {
  return `${prefix}:${createHash("sha256").update(JSON.stringify(parts)).digest("hex")}`;
}

async function readWritingResultStep(runId: string) {
  "use step";

  const result = await getRun<Awaited<ReturnType<typeof writingPromptWorkflow>>>(runId).returnValue;
  return result.status;
}

async function waitForWriting(runId: string) {
  return (await waitForRun(runId)) ? readWritingResultStep(runId) : "failed";
}

async function writingBatchWorkflow(runIds: string[]) {
  "use workflow";

  const results = await Promise.all(runIds.map((runId) => waitForWriting(runId)));

  if (results.every((status) => status !== "failed")) {
    await progressStep<WritingPromptStepName>(
      {
        status: "completed",
        step: results.includes("signUpRequired") ? "signUpRequired" : "writeWritingPrompt",
      },
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

import { randomUUID } from "node:crypto";
import { getPromptVersion } from "@zoonk/utils/prompt-version";
import { type AiGenerationContext } from "./ai-generation-event";
import { captureAiGeneration } from "./ai-generation-sink";
import {
  type FinishedGeneration,
  type TaskProvenance,
  buildTaskProvenance,
} from "./task-provenance";

export type TaskGenerationInput = {
  analytics?: AiGenerationContext;
  /** A manual version for changes the system prompt text doesn't show. */
  promptVersion?: string;
  systemPrompt: string;
  /** Stable task name, matching the task's eval id. */
  task: string;
};

/** What every run knows before its model answers, whatever the model's output type. */
export type TaskRunDetails = {
  generatedAt: string;
  latencyMs: number;
  promptVersion: string;
  runId: string;
};

/**
 * Times one task run and sends its `$ai_generation` event when it finishes.
 * Text and image runs share it; each builds provenance from its own result.
 */
export function startTaskRun({
  analytics,
  promptVersion,
  systemPrompt,
  task,
}: TaskGenerationInput) {
  const runId = randomUUID();
  const startedAt = performance.now();
  const version = getPromptVersion({ systemPrompt, version: promptVersion });

  return {
    async finish(build: (details: TaskRunDetails) => TaskProvenance): Promise<TaskProvenance> {
      const provenance = build({
        generatedAt: new Date().toISOString(),
        latencyMs: Math.round(performance.now() - startedAt),
        promptVersion: version,
        runId,
      });

      await captureAiGeneration({ context: analytics, provenance, task });

      return provenance;
    },
    promptVersion: version,
    runId,
  };
}

/**
 * Starts timing one task run. Streamed tasks call `finish` from their end
 * callback because the generation completes after the task returns.
 */
export function startTaskGeneration(input: TaskGenerationInput) {
  const run = startTaskRun(input);

  return {
    finish: (generation: FinishedGeneration): Promise<TaskProvenance> =>
      run.finish((details) => buildTaskProvenance({ ...details, generation })),
    /** Known from the start, for rows a streamed task saves before it ends. */
    promptVersion: run.promptVersion,
    runId: run.runId,
  };
}

/**
 * Runs one task generation and returns its provenance next to the untouched
 * AI SDK result, so every task reports the model that actually ran, its
 * prompt version, usage, cost and latency the same way, and sends one
 * `$ai_generation` event.
 */
export async function runTaskGeneration<TGeneration extends FinishedGeneration>({
  generate,
  ...input
}: TaskGenerationInput & { generate: () => Promise<TGeneration> }): Promise<{
  provenance: TaskProvenance;
  result: TGeneration;
}> {
  const run = startTaskGeneration(input);
  const result = await generate();
  const provenance = await run.finish(result);

  return { provenance, result };
}

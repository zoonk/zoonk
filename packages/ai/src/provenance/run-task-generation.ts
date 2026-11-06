import { randomUUID } from "node:crypto";
import { getPromptVersion } from "@zoonk/utils/prompt-version";
import { type PromptTrainingInput, runUnderPromptTrainingRule } from "../data-protection";
import { type AiGenerationContext } from "./ai-generation-event";
import { type AiGeneration, captureAiGeneration } from "./ai-generation-sink";
import { collectRunCalls } from "./billed-calls";
import {
  type FinishedGeneration,
  type GenerationStep,
  type StreamedGeneration,
  type TaskProvenance,
  buildTaskProvenance,
} from "./task-provenance";

export type TaskGenerationInput = {
  analytics?: AiGenerationContext;
  /** A manual version for changes the system prompt text doesn't show. */
  promptVersion?: string;
  systemPrompt: string;
  /** Matches the task's eval id. */
  task: string;
};

export type TaskRunDetails = {
  generatedAt: string;
  latencyMs: number;
  promptVersion: string;
  runId: string;
};

const FAILED_RUN = { $ai_is_error: true } as const;

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
    async finish(
      build: (details: TaskRunDetails) => TaskProvenance,
      properties?: AiGeneration["properties"],
    ): Promise<TaskProvenance> {
      const provenance = build({
        generatedAt: new Date().toISOString(),
        latencyMs: Math.round(performance.now() - startedAt),
        promptVersion: version,
        runId,
      });

      await captureAiGeneration({ context: analytics, properties, provenance, task });

      return provenance;
    },
    promptVersion: version,
    runId,
  };
}

function startTaskGeneration(input: TaskGenerationInput) {
  const run = startTaskRun(input);

  return {
    finish: (generation: FinishedGeneration, properties?: AiGeneration["properties"]) =>
      run.finish((details) => buildTaskProvenance({ ...details, generation }), properties),
    promptVersion: run.promptVersion,
    runId: run.runId,
  };
}

/**
 * `provenance` resolves once the stream ends, whether or not its output passes, and rejects when
 * it fails. Streamed runs always keep the no-training filter.
 */
export function streamTaskGeneration<TGeneration extends StreamedGeneration>({
  stream,
  ...input
}: TaskGenerationInput & { stream: () => TGeneration }) {
  const run = startTaskGeneration(input);
  const generation = stream();

  const provenance = Promise.all([generation.finalStep, generation.steps]).then(
    ([finalStep, steps]) => run.finish({ finalStep, steps }),
  );

  // A failed stream rejects this too; nothing else may be waiting for it.
  void provenance.catch(() => null);

  return { generation, promptVersion: run.promptVersion, provenance, runId: run.runId };
}

export async function runTaskGeneration<TGeneration extends FinishedGeneration>({
  generate,
  libraryInput,
  ...input
}: TaskGenerationInput &
  PromptTrainingInput & {
    generate: (rule: { promptTraining: boolean }) => Promise<TGeneration>;
  }): Promise<{ provenance: TaskProvenance; result: TGeneration }> {
  const run = startTaskGeneration(input);
  const billed: GenerationStep[] = [];

  const result = await collectRunCalls(billed, () =>
    runUnderPromptTrainingRule({
      contentScope: input.analytics?.contentScope,
      generate,
      libraryInput,
    }),
  ).catch(async (error: unknown) => {
    const finalStep = billed.at(-1);

    // A failed run has no answer to read its calls from, so it records the ones the provider billed.
    if (finalStep) {
      await run.finish({ finalStep, steps: billed }, FAILED_RUN);
    }

    throw error;
  });

  const provenance = await run.finish(result);

  return { provenance, result };
}

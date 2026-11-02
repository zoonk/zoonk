import { randomUUID } from "node:crypto";
import { getPromptVersion } from "@zoonk/utils/prompt-version";
import { type PromptTrainingInput, runUnderPromptTrainingRule } from "../data-protection";
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
  /** Matches the task's eval id. */
  task: string;
};

export type TaskRunDetails = {
  generatedAt: string;
  latencyMs: number;
  promptVersion: string;
  runId: string;
};

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

/** Streamed tasks call `finish` from their end callback: the generation ends after they return. */
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

/** Streamed runs (`startTaskGeneration`) always keep the no-training filter. */
export async function runTaskGeneration<TGeneration extends FinishedGeneration>({
  generate,
  libraryInput,
  ...input
}: TaskGenerationInput &
  PromptTrainingInput & {
    generate: (rule: { promptTraining: boolean }) => Promise<TGeneration>;
  }): Promise<{ provenance: TaskProvenance; result: TGeneration }> {
  const run = startTaskGeneration(input);

  const result = await runUnderPromptTrainingRule({
    contentScope: input.analytics?.contentScope,
    generate,
    libraryInput,
  });

  const provenance = await run.finish(result);

  return { provenance, result };
}

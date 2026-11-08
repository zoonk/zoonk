/** No gateway imports: the evals app's pages list these in the browser. */

/**
 * The default decision model; a task whose eval chose another names it. Liquid d1 trains on
 * prompts, so it never reads a learner's input, and GPT-6 Luna Decisions cost more than the native
 * model chosen on every decision eval that ran it (8 Nov 2026).
 */
export const JEV_MODEL_ID = "typesafe-ai/jev";

export const LUNA_DECISIONS_MODEL_ID = "openai/gpt-6-luna-decisions";

const TOKEN_LIMITS: Readonly<Record<string, number>> = {
  [JEV_MODEL_ID]: 32_000,
  "baseten/elephant-1": 16_384,
  "baseten/joey-1": 16_384,
  "baseten/mammoth-1": 16_384,
  "microsoft/microsoft-decision-1": 32_768,
  "typesafe-ai/jev-1.14.0": 32_000,
};

const NATIVE_EVALUATION_MODELS: ReadonlySet<string> = new Set([
  JEV_MODEL_ID,
  "typesafe-ai/jev-1.14.0",
  "baseten/joey-1",
  "baseten/elephant-1",
  "baseten/mammoth-1",
  "microsoft/microsoft-decision-1",
  "perplexity/pplx-decider-flash-v1.2",
  "perplexity/pplx-decider-v1.2",
  LUNA_DECISIONS_MODEL_ID,
  "liquid/d1",
]);

export function isNativeEvaluationModel(modelId: string): boolean {
  return NATIVE_EVALUATION_MODELS.has(modelId);
}

/** Returns null for models whose limit is far above any classification input. */
export function getEvaluationTokenLimit(modelId: string): number | null {
  return TOKEN_LIMITS[modelId] ?? null;
}

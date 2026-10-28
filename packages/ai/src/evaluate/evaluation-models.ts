/** No gateway imports: the evals app's pages list these in the browser. */

/**
 * On the seven decision evals (7 Oct 2026), GPT-6 Luna Decisions cost 1.8 to 2.5 times as much and
 * was less accurate on four; Liquid d1 cost more on library identity, the one with volume.
 */
export const JEV_MODEL_ID = "typesafe-ai/jev";

export const LUNA_DECISIONS_MODEL_ID = "openai/gpt-6-luna-decisions";

const TOKEN_LIMITS: Readonly<Record<string, number>> = { [JEV_MODEL_ID]: 32_000 };

const NATIVE_EVALUATION_MODELS: ReadonlySet<string> = new Set([
  JEV_MODEL_ID,
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

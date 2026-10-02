import { Experimental_EvaluationLanguageModel } from "@ai-sdk/provider-utils/experimental-evaluation";
import { type Experimental_EvaluationModel } from "ai";
import { getModelFamily } from "../_utils/model-family";
import { zoonkGateway } from "../gateway";

export const JEV_MODEL_ID = "typesafe-ai/jev";

/** Jev accepts at most 32k tokens for the state plus the longest question. */
const TOKEN_LIMITS: Readonly<Record<string, number>> = { [JEV_MODEL_ID]: 32_000 };

const NATIVE_EVALUATION_PROVIDERS = new Set(["typesafe-ai"]);

function isNativeEvaluationModel(modelId: string): boolean {
  return NATIVE_EVALUATION_PROVIDERS.has(getModelFamily(modelId));
}

/**
 * Jev is the gateway's native evaluation model. Any other gateway id (Luna,
 * Flash Lite, Haiku) runs through the AI SDK's language-model evaluation
 * adapter, the same class `openai.evaluationModel()` and
 * `anthropic.evaluationModel()` wrap around their own models, so every
 * candidate shares the gateway's key, routing, fallback and billing.
 */
export function getEvaluationModel(modelId: string): Experimental_EvaluationModel {
  if (isNativeEvaluationModel(modelId)) {
    return zoonkGateway.evaluationModel(modelId);
  }

  return new Experimental_EvaluationLanguageModel({ model: zoonkGateway.languageModel(modelId) });
}

/** Returns null for models whose limit is far above any classification input. */
export function getEvaluationTokenLimit(modelId: string): number | null {
  return TOKEN_LIMITS[modelId] ?? null;
}

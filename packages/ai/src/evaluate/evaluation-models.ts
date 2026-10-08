import { Experimental_DecisionLanguageModel } from "@ai-sdk/provider-utils/experimental-decision";
import { type Experimental_DecisionModel } from "ai";
import { zoonkGateway } from "../gateway";

/**
 * Every `decide` call's model. On the seven decision evals (7 Oct 2026) GPT-6 Luna Decisions cost
 * 1.8 to 2.5 times as much at the same speed and was less accurate on four of them (memory
 * reconcile 79% against 100%, memory gate 87% against 97%); Liquid d1 cost less on short inputs
 * but more on library identity, the one with volume, and was less accurate on two memory tasks.
 * With a confidence fallback, d1 first and Jev on uncertain answers cost 40% more than Jev alone,
 * and Jev first with d1 on uncertain ones 27% more for one more right verdict in 39.
 */
export const JEV_MODEL_ID = "typesafe-ai/jev";

/** OpenAI's Decisions API on GPT-6 Luna: typed answers with probabilities, input tokens only. */
export const LUNA_DECISIONS_MODEL_ID = "openai/gpt-6-luna-decisions";

/** Jev accepts at most 32k tokens for the state plus the longest question. */
const TOKEN_LIMITS: Readonly<Record<string, number>> = { [JEV_MODEL_ID]: 32_000 };

/** The gateway's decision models, which answer typed questions without writing text. */
const NATIVE_EVALUATION_MODELS: ReadonlySet<string> = new Set([
  JEV_MODEL_ID,
  LUNA_DECISIONS_MODEL_ID,
  "liquid/d1",
]);

export function isNativeEvaluationModel(modelId: string): boolean {
  return NATIVE_EVALUATION_MODELS.has(modelId);
}

/**
 * Jev and Luna Decisions are the gateway's native decision models. Any other gateway id (Luna,
 * Flash Lite, Haiku) runs through the AI SDK's language-model decision adapter, the same class
 * `openai.decisionModel()` and `anthropic.decisionModel()` wrap around their own models, so every
 * candidate shares the gateway's key, routing, fallback and billing.
 */
export function getEvaluationModel(modelId: string): Experimental_DecisionModel {
  if (isNativeEvaluationModel(modelId)) {
    return zoonkGateway.decisionModel(modelId);
  }

  return new Experimental_DecisionLanguageModel({ model: zoonkGateway.languageModel(modelId) });
}

/** Returns null for models whose limit is far above any classification input. */
export function getEvaluationTokenLimit(modelId: string): number | null {
  return TOKEN_LIMITS[modelId] ?? null;
}

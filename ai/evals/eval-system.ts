import "server-only";
import type { LanguageModelV2Usage } from "@ai-sdk/provider";
import { generateObject } from "ai";
import { z } from "zod";
import { repairAIText } from "@/lib/utils";
import type { ModelConfig } from "./models";
import { calculateCost, SCORER_MODEL } from "./models";
import scorePrompt from "./score-prompt.md";

const MAX_CONTEXT_LENGTH = 100;
const CALLS_PER_HUNDRED = 100;
const ZERO = 0;
const LAST_INDEX = -1;
const HALF_DIVISOR = 2;

const stepSchema = z.object({
  kind: z.enum(["major_errors", "minor_errors", "potential_improvements"]),
  conclusion: z.string(),
  score: z.number().min(1).max(10),
});

const scoreSchema = z.object({
  steps: z.array(stepSchema),
});

export interface EvalStep {
  kind: "major_errors" | "minor_errors" | "potential_improvements";
  conclusion: string;
  score: number;
}

export interface EvalScore {
  steps: EvalStep[];
  finalScore: number;
}

/**
 * Score an AI output using the scoring model.
 */
export async function scoreOutput({
  userPrompt,
  systemPrompt,
  expectations,
  aiOutput,
}: {
  userPrompt: string;
  systemPrompt: string;
  expectations: string;
  aiOutput: string;
}): Promise<EvalScore> {
  const evalUserPrompt = `
**User provided variables and values**
${userPrompt}

**Instructions**
${systemPrompt}

**Expectations**
${expectations}

**Result**
${aiOutput}
  `.trim();

  const { object } = await generateObject({
    model: SCORER_MODEL.id,
    schema: scoreSchema,
    prompt: [
      { role: "system", content: scorePrompt },
      { role: "user", content: evalUserPrompt },
    ],
    experimental_repairText: async ({ text, error }) =>
      repairAIText({
        text,
        error,
        context: `[evalScoring] "${aiOutput.substring(0, MAX_CONTEXT_LENGTH)}"`,
      }),
    ...(SCORER_MODEL.reasoningEffort && {
      experimental_reasoningEffort: SCORER_MODEL.reasoningEffort,
    }),
  });

  const finalScore = object.steps.at(LAST_INDEX)?.score ?? ZERO;

  return {
    steps: object.steps,
    finalScore,
  };
}

/**
 * Calculate average of an array of numbers.
 */
export function calculateAverage(numbers: number[]): number {
  if (numbers.length === ZERO) {
    return ZERO;
  }
  const sum = numbers.reduce((acc, num) => acc + num, 0);
  return sum / numbers.length;
}

/**
 * Calculate median of an array of numbers.
 */
export function calculateMedian(numbers: number[]): number {
  if (numbers.length === ZERO) {
    return ZERO;
  }
  const sorted = [...numbers].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / HALF_DIVISOR);
  if (sorted.length % HALF_DIVISOR === ZERO) {
    return ((sorted[mid - 1] ?? ZERO) + (sorted[mid] ?? ZERO)) / HALF_DIVISOR;
  }
  return sorted[mid] ?? ZERO;
}

/**
 * Calculate cost per 100 calls.
 */
export function calculateCostPer100Calls(
  usages: LanguageModelV2Usage[],
  model: ModelConfig,
): number {
  const avgCost =
    usages.reduce(
      (sum, usage) =>
        sum +
        calculateCost(
          {
            promptTokens: usage.inputTokens ?? ZERO,
            completionTokens: usage.outputTokens ?? ZERO,
          },
          model,
        ),
      ZERO,
    ) / usages.length;

  return avgCost * CALLS_PER_HUNDRED;
}

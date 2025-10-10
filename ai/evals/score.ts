import { generateObject, type LanguageModelUsage } from "ai";
import z from "zod";
import type { ModelConfig } from "./models";

const TOKENS_PER_MILLION = 1_000_000;
const COST_MULTIPLIER = 100;
const EVAL_MODEL = process.env.AI_MODEL_EVALS || "openai/gpt-5";

const stepSchema = z.object({
  kind: z.enum(["major_errors", "minor_errors", "potential_improvements"]),
  conclusion: z.string(),
  score: z.number().min(1).max(10),
});

const schema = z.object({
  steps: z.array(stepSchema),
});

type Step = z.infer<typeof stepSchema>;

function sumUsages(usages: LanguageModelUsage[]): LanguageModelUsage {
  const add = (a: number = 0, b: number = 0) => a + b;

  return usages.reduce(
    (acc, usage) => ({
      inputTokens: add(acc.inputTokens, usage.inputTokens),
      outputTokens: add(acc.outputTokens, usage.outputTokens),
      totalTokens: add(acc.totalTokens, usage.totalTokens),
      reasoningTokens: add(acc.reasoningTokens, usage.reasoningTokens),
      cachedInputTokens: add(acc.cachedInputTokens, usage.cachedInputTokens),
    }),
    {} as LanguageModelUsage,
  );
}

function calculateAverageUsage(
  usages: LanguageModelUsage[],
): LanguageModelUsage {
  const count = usages.length;
  const sum = sumUsages(usages);

  return {
    inputTokens: (sum.inputTokens || 0) / count,
    outputTokens: (sum.outputTokens || 0) / count,
    totalTokens: (sum.totalTokens || 0) / count,
    reasoningTokens: (sum.reasoningTokens || 0) / count,
    cachedInputTokens: (sum.cachedInputTokens || 0) / count,
  };
}

function calculateCost(usage: LanguageModelUsage, model: ModelConfig): number {
  const inputTokens = usage.inputTokens ?? 0;
  const outputTokens = usage.outputTokens ?? 0;

  const inputCost = (inputTokens / TOKENS_PER_MILLION) * model.inputCost;
  const outputCost = (outputTokens / TOKENS_PER_MILLION) * model.outputCost;

  return inputCost + outputCost;
}

// Gets the average score from all steps
function calculateScore(steps: Step[]) {
  const total = steps.reduce((acc, step) => acc + step.score, 0);
  return total / steps.length;
}

export async function generateScore(params: {
  system: string;
  prompt: string;
  expectations: string;
  output: string;
}) {
  const { system, prompt, expectations, output } = params;

  const evalPrompt = `
    **User provided variables and values**
    ${prompt}

    **Instructions**
    ${system}

    **Expectations**
    ${expectations}

    **Result**
    ${output}
  `;

  const { object } = await generateObject({
    model: EVAL_MODEL,
    schema,
    system,
    prompt: evalPrompt,
  });

  return {
    steps: object.steps,
    score: calculateScore(object.steps),
  };
}

export function calculateAverage(scores: number[]) {
  const total = scores.reduce((acc, score) => acc + score, 0);
  return total / scores.length;
}

export function calculateMedian(scores: number[]) {
  const sorted = [...scores].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);

  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function calculateUsageCost(
  usages: LanguageModelUsage[],
  model: ModelConfig,
  multipler = COST_MULTIPLIER,
): number {
  const averageUsage = calculateAverageUsage(usages);
  const costPerCall = calculateCost(averageUsage, model);
  return costPerCall * multipler;
}

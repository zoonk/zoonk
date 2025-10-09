import { readFileSync } from "node:fs";
import { join } from "node:path";
import { generateObject } from "ai";
import { z } from "zod";

const EVAL_MODEL = "openai/gpt-5";
const SCORE_PROMPT_FILE = join(process.cwd(), "ai", "evals", "score-prompt.md");

const stepSchema = z.object({
  kind: z.enum(["major_errors", "minor_errors", "potential_improvements"]),
  conclusion: z.string(),
  score: z.number().min(1).max(10),
});

const scoreSchema = z.object({
  steps: z.array(stepSchema),
});

export type ScoreResult = z.infer<typeof scoreSchema>;

export interface ScoreInput {
  userPrompt: string;
  systemPrompt: string;
  expectations: string;
  aiOutput: string;
}

/**
 * Score an AI response using the evaluation model
 */
export async function scoreResponse(input: ScoreInput): Promise<ScoreResult> {
  // Load score prompt from file
  const scoreSystemPrompt = readFileSync(SCORE_PROMPT_FILE, "utf-8");

  const userContent = `
**User provided variables and values**
${input.userPrompt}

**Instructions**
${input.systemPrompt}

**Expectations**
${input.expectations}

**Result**
${input.aiOutput}
  `.trim();

  const { object } = await generateObject({
    model: EVAL_MODEL,
    schema: scoreSchema,
    prompt: [
      { role: "system", content: scoreSystemPrompt },
      { role: "user", content: userContent },
    ],
  });

  return object;
}

/**
 * Calculate the final score from the evaluation steps
 * Uses the score from the last step as the final score
 */
export function getFinalScore(result: ScoreResult): number {
  const lastStep = result.steps.at(-1);
  if (!lastStep) {
    throw new Error("No steps found in score result");
  }
  return lastStep.score;
}

/**
 * Calculate the average score from multiple results
 */
export function calculateAverage(scores: number[]): number {
  if (scores.length === 0) {
    return 0;
  }
  const sum = scores.reduce((acc, score) => acc + score, 0);
  return sum / scores.length;
}

/**
 * Calculate the median score from multiple results
 */
export function calculateMedian(scores: number[]): number {
  if (scores.length === 0) {
    return 0;
  }

  const sorted = [...scores].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 0) {
    const middleLeft = sorted[middle - 1];
    const middleRight = sorted[middle];
    if (middleLeft === undefined || middleRight === undefined) {
      return 0;
    }
    return (middleLeft + middleRight) / 2;
  }

  const medianValue = sorted[middle];
  return medianValue ?? 0;
}

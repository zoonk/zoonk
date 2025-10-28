import { cn } from "@zoonk/ui/lib/utils";
import { generateObject } from "ai";
import systemPrompt from "./system-prompt.md";
import { type ScoreStep, scoreSchema } from "./types";

const BAD_SCORE = 8;
const GOOD_SCORE = 9.2;

// Weight configuration for different step types
const STEP_WEIGHTS = {
  major_errors: 3,
  minor_errors: 2,
  potential_improvements: 1,
} as const;

/**
 * Calculates a weighted average score from evaluation steps.
 * Major errors have 3x weight, minor errors 2x, and potential improvements 1x.
 */
export function calculateScore(steps: ScoreStep[]): number {
  const weightedTotal = steps.reduce(
    (acc, step) => acc + step.score * STEP_WEIGHTS[step.kind],
    0,
  );

  const totalWeight = steps.reduce(
    (acc, step) => acc + STEP_WEIGHTS[step.kind],
    0,
  );

  return weightedTotal / totalWeight;
}

/**
 * This function analyzes the output of a given task and run
 * through our score task/prompt to evaluate the quality of the output.
 *
 * It returns a list of steps with conclusions and scores, as well as
 * an overall score which is the average of all step scores.
 */
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
    model: "google/gemini-2.5-pro",
    prompt: evalPrompt,
    schema: scoreSchema,
    system: systemPrompt,
  });

  return {
    score: calculateScore(object.steps),
    steps: object.steps,
  };
}

export const getScoreClassName = (score: number) => {
  const isBadScore = score < BAD_SCORE;
  const isAverageScore = score >= BAD_SCORE && score < GOOD_SCORE;
  const isGoodScore = score >= GOOD_SCORE;

  return cn({
    "text-destructive": isBadScore,
    "text-success": isGoodScore,
    "text-warning": isAverageScore,
  });
};

import { cn } from "@zoonk/ui/lib/utils";
import { generateObject } from "ai";
import systemPrompt from "./system-prompt.md";
import { type ScoreStep, scoreSchema } from "./types";

const BAD_SCORE = 7;
const GOOD_SCORE = 9;

// Gets the average score from all steps
function calculateScore(steps: ScoreStep[]) {
  const total = steps.reduce((acc, step) => acc + step.score, 0);
  return total / steps.length;
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
    model: "openai/gpt-5",
    schema: scoreSchema,
    system: systemPrompt,
    prompt: evalPrompt,
  });

  return {
    steps: object.steps,
    score: calculateScore(object.steps),
  };
}

export const getScoreClassName = (score: number) => {
  const isBadScore = score < BAD_SCORE;
  const isAverageScore = score >= BAD_SCORE && score < GOOD_SCORE;
  const isGoodScore = score >= GOOD_SCORE;

  return cn({
    "text-destructive": isBadScore,
    "text-warning": isAverageScore,
    "text-success": isGoodScore,
  });
};

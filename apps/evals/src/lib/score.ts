import { generateObject } from "ai";
import z from "zod";
import systemPrompt from "./system-prompt.md";

const stepSchema = z.object({
  kind: z.enum(["major_errors", "minor_errors", "potential_improvements"]),
  conclusion: z.string(),
  score: z.number().min(1).max(10),
});

const schema = z.object({
  steps: z.array(stepSchema),
});

type Step = z.infer<typeof stepSchema>;

// Gets the average score from all steps
function calculateScore(steps: Step[]) {
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
    schema,
    system: systemPrompt,
    prompt: evalPrompt,
  });

  return {
    steps: object.steps,
    score: calculateScore(object.steps),
  };
}

import "server-only";
import { type AiGenerationContext } from "../provenance/ai-generation-event";
import { type EvaluationRunDetails, evaluateQuestions } from "./evaluate-questions";

type ClassificationResult<LABEL extends string> = EvaluationRunDetails & {
  choice: LABEL;
  /** Only native evaluation models such as Jev return a distribution. */
  probabilities?: Readonly<Record<string, number>>;
};

/**
 * Picks one label for one input with an evaluation model: Jev natively, or any
 * gateway language model (Luna, Flash Lite, Haiku) through the SDK's
 * structured-output adapter. The same labels and instructions reach every
 * model, so evals can compare them directly and a runner-up can be the fallback.
 */
export async function classify<const LABEL extends string>({
  analytics,
  fallbackModel,
  input,
  instructions,
  keepInput,
  labels,
  model,
  task,
}: {
  analytics?: AiGenerationContext;
  fallbackModel?: string;
  input: Readonly<Record<string, string>>;
  instructions: string;
  /** Keep the input in the evaluation log; see `evaluateQuestions`. */
  keepInput?: boolean;
  /** Each label with a short description of when it applies. */
  labels: Readonly<Record<LABEL, string>>;
  model?: string;
  /** Stable task name, matching the task's eval id, for the logged run. */
  task: string;
}): Promise<ClassificationResult<LABEL>> {
  const { answers, ...run } = await evaluateQuestions({
    analytics,
    fallbackModel,
    input,
    keepInput,
    model,
    questions: { label: { criteria: labels, instructions, type: "choice" } },
    task,
  });

  return { ...run, choice: answers.label.choice, probabilities: answers.label.probabilities };
}

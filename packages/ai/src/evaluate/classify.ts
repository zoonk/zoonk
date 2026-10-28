import "server-only";
import { type AiGenerationContext } from "../provenance/ai-generation-event";
import { type EvaluationRunDetails, evaluateQuestions } from "./evaluate-questions";

type ClassificationResult<LABEL extends string> = EvaluationRunDetails & {
  choice: LABEL;
  /** Only native evaluation models such as Jev return a distribution. */
  probabilities?: Readonly<Record<string, number>>;
};

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
  keepInput?: boolean;
  labels: Readonly<Record<LABEL, string>>;
  model?: string;
  /** Matches the task's eval id. */
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

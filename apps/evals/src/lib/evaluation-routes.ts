import { classify } from "@zoonk/ai/evaluate/classify";
import { decideBoolean } from "@zoonk/ai/evaluate/decisions";
import { evaluateQuestions } from "@zoonk/ai/evaluate/evaluate-questions";
import { type Experimental_EvaluationQuestion } from "ai";

type EvaluationInput<TInput> = TInput & { model: string };
type BooleanQuestion = Extract<Experimental_EvaluationQuestion, { type: "boolean" }>;

/** Evals score every case at even odds; product code picks its own thresholds from these results. */
const EVAL_BOOLEAN_THRESHOLD = 0.5;

/** Evaluation runs name their task for logs; the evals app registers no sink, so none are sent. */
const EVAL_TASK = "evals";

/**
 * Builds a task's `evaluate` route for a choice classifier. The model's label
 * is mapped back into the task's own output shape so the task's scorer grades
 * evaluation models and generation models the same way.
 */
export function createChoiceEvaluation<TInput, LABEL extends string, TOutput>({
  classifier,
  toOutput,
}: {
  classifier: {
    instructions: string;
    labels: Readonly<Record<LABEL, string>>;
    toInput: (input: TInput) => Record<string, string>;
  };
  toOutput: (label: LABEL) => TOutput;
}) {
  return async (input: EvaluationInput<TInput>) => {
    const result = await classify({
      input: classifier.toInput(input),
      instructions: classifier.instructions,
      labels: classifier.labels,
      model: input.model,
      task: EVAL_TASK,
    });

    return {
      data: toOutput(result.choice),
      probabilities: result.probabilities,
      systemPrompt: classifier.instructions,
      usage: result.usage,
      userPrompt: result.state,
    };
  };
}

/** Builds a task's `evaluate` route for a yes-or-no classifier. */
export function createBooleanEvaluation<TInput, TOutput>({
  classifier,
  toOutput,
}: {
  classifier: {
    question: BooleanQuestion & { instructions: string };
    toInput: (input: TInput) => Record<string, string>;
  };
  toOutput: (value: boolean) => TOutput;
}) {
  return async (input: EvaluationInput<TInput>) => {
    const run = await evaluateQuestions({
      input: classifier.toInput(input),
      model: input.model,
      questions: { answer: classifier.question },
      task: EVAL_TASK,
    });

    const { probability } = run.answers.answer;

    return {
      data: toOutput(decideBoolean({ probability, threshold: EVAL_BOOLEAN_THRESHOLD })),
      probabilities: { true: probability },
      systemPrompt: classifier.question.instructions,
      usage: run.usage,
      userPrompt: run.state,
    };
  };
}

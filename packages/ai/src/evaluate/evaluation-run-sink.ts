import { safeAsync } from "@zoonk/utils/error";
import { isTestEnvironment } from "../_utils/is-test-environment";

/** One question's verdict, as the evaluation model returned it. */
export type EvaluationRunAnswer =
  | { choice: string; probabilities?: Readonly<Record<string, number>>; type: "choice" }
  | { probabilities?: Readonly<Record<string, number>>; score: number; type: "score" }
  | { probability: number; type: "boolean" };

/**
 * One evaluation run as the log keeps it: what the model decided with its probabilities, the model
 * that answered, and the input only when the caller keeps it. `inputHash` identifies the input
 * either way, so sampling can skip repeats without reading learner text.
 */
export type EvaluationRunRecord = {
  answers: Readonly<Record<string, EvaluationRunAnswer>>;
  contentScope: "personal" | "shared";
  costUsd?: number;
  /** The learner the run was for, when a learner triggered it. */
  distinctId?: string;
  goalId?: string;
  /** The untrusted fields the model read, by name; null when the task doesn't keep its input. */
  input: Readonly<Record<string, string>> | null;
  inputHash: string;
  inputTokens: number;
  latencyMs: number;
  model: string;
  outputTokens: number;
  promptVersion: string;
  requestedModel: string;
  task: string;
  traceId?: string;
};

type EvaluationRunSink = (run: EvaluationRunRecord) => Promise<void>;

declare global {
  /** On `globalThis` for the same reason as `zoonkAiGenerationSink`: bundles don't share modules. */
  var zoonkEvaluationRunSink: EvaluationRunSink | undefined;
}

/**
 * Lets the apps store every evaluation run (the database log in `@zoonk/core`) without this
 * package depending on the database. Apps that never register one, like evals, keep nothing.
 */
export function registerEvaluationRunSink(sink: EvaluationRunSink): void {
  globalThis.zoonkEvaluationRunSink = sink;
}

/** Logging never fails a verdict that already came back, and tests never write logs. */
export async function captureEvaluationRun(run: EvaluationRunRecord): Promise<void> {
  const sink = globalThis.zoonkEvaluationRunSink;

  if (!sink || isTestEnvironment()) {
    return;
  }

  await safeAsync(() => sink(run));
}

import { safeAsync } from "@zoonk/utils/error";
import { isTestEnvironment } from "../_utils/is-test-environment";

export type EvaluationRunAnswer =
  | { choice: string; probabilities?: Readonly<Record<string, number>>; type: "choice" }
  | { probabilities?: Readonly<Record<string, number>>; score: number; type: "score" }
  | { probability: number; type: "boolean" };

/** `inputHash` lets sampling skip repeats without reading learner text. */
export type EvaluationRunRecord = {
  answers: Readonly<Record<string, EvaluationRunAnswer>>;
  contentScope: "personal" | "shared";
  distinctId?: string;
  goalId?: string;
  /** Null when the task doesn't keep its input. */
  input: Readonly<Record<string, string>> | null;
  inputHash: string;
  latencyMs: number;
  model: string;
  promptVersion: string;
  requestedModel: string;
  runId: string;
  task: string;
  traceId?: string;
};

type EvaluationRunSink = (run: EvaluationRunRecord) => Promise<void>;

declare global {
  /** On `globalThis` for the same reason as `zoonkAiGenerationSink`: bundles don't share modules. */
  var zoonkEvaluationRunSink: EvaluationRunSink | undefined;
}

/** Lets apps store evaluation runs without this package depending on the database. */
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

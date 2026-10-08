import { createHash } from "node:crypto";
import { type AiGenerationContext } from "../provenance/ai-generation-event";
import { type TaskProvenance } from "../provenance/task-provenance";
import { type EvaluationRunAnswer, type EvaluationRunRecord } from "./evaluation-run-sink";

/**
 * What one evaluation run answered: the choice, score or probability per question, never the
 * learner text it read.
 */
type EvaluationAnswers = Readonly<Record<string, EvaluationRunAnswer>>;

/**
 * An evaluation run as its log row. The input the model read is kept only when the caller says the
 * task stores that text elsewhere anyway (a goal's prompt, a tutor question, Library titles), and
 * never for learner-made content with no learner to delete it with. `inputHash` identifies the
 * input either way.
 */
export function toEvaluationRunRecord({
  analytics = {},
  answers,
  input,
  keepInput,
  provenance,
  state,
  task,
}: {
  analytics?: AiGenerationContext;
  answers: EvaluationAnswers;
  input: Readonly<Record<string, string>>;
  keepInput: boolean;
  provenance: TaskProvenance;
  /** The delimited text the model evaluated. */
  state: string;
  task: string;
}): EvaluationRunRecord {
  const contentScope = analytics.contentScope ?? "shared";
  const ownedInput = contentScope === "shared" || Boolean(analytics.distinctId);

  return {
    answers,
    contentScope,
    distinctId: analytics.distinctId,
    goalId: analytics.goalId,
    input: keepInput && ownedInput ? input : null,
    inputHash: createHash("sha256").update(state).digest("hex"),
    latencyMs: provenance.latencyMs,
    model: provenance.model,
    promptVersion: provenance.promptVersion,
    requestedModel: provenance.requestedModel,
    runId: provenance.runId,
    task,
    traceId: analytics.traceId,
  };
}

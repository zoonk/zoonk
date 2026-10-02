import { createHash } from "node:crypto";
import {
  type AiGenerationContext,
  type AiGenerationEvent,
  toAiGenerationEvent,
} from "../provenance/ai-generation-event";
import { type TaskProvenance } from "../provenance/task-provenance";
import { type EvaluationRunAnswer, type EvaluationRunRecord } from "./evaluation-run-sink";

/**
 * What one evaluation run answered: the choice, score or probability per question, never the
 * learner text it read.
 */
type EvaluationAnswers = Readonly<Record<string, EvaluationRunAnswer>>;

/**
 * An evaluation run as an `$ai_generation` event, so Jev's cost and latency sit next to every
 * other task's, plus what tuning a threshold needs: each question's answer with its
 * probabilities and the model that answered.
 * The state it evaluated stays out, like prompts in every other event, because it holds what
 * learners typed.
 */
export function toEvaluationEvent({
  analytics,
  answers,
  provenance,
  task,
}: {
  analytics?: AiGenerationContext;
  answers: EvaluationAnswers;
  provenance: TaskProvenance;
  task: string;
}): AiGenerationEvent {
  const event = toAiGenerationEvent({ context: analytics, provenance, task });

  return {
    ...event,
    properties: { ...event.properties, evaluation_answers: JSON.stringify(answers) },
  };
}

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
    costUsd: provenance.costUsd,
    distinctId: analytics.distinctId,
    goalId: analytics.goalId,
    input: keepInput && ownedInput ? input : null,
    inputHash: createHash("sha256").update(state).digest("hex"),
    inputTokens: provenance.usage.inputTokens ?? 0,
    latencyMs: provenance.latencyMs,
    model: provenance.model,
    outputTokens: provenance.usage.outputTokens ?? 0,
    promptVersion: provenance.promptVersion,
    requestedModel: provenance.requestedModel,
    task,
    traceId: analytics.traceId,
  };
}

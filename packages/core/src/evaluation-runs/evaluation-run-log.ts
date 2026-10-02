import "server-only";
import { type EvaluationRunRecord, registerEvaluationRunSink } from "@zoonk/ai/evaluation-run-sink";
import { DbNull, isPrismaForeignKeyError, prisma } from "@zoonk/db";
import { isUuid } from "@zoonk/utils/uuid";

function toRow(run: EvaluationRunRecord) {
  return {
    answers: run.answers,
    contentScope: run.contentScope,
    costUsd: run.costUsd ?? null,
    goalId: isUuid(run.goalId) ? run.goalId : null,
    input: run.input ?? DbNull,
    inputHash: run.inputHash,
    inputTokens: run.inputTokens,
    latencyMs: run.latencyMs,
    model: run.model,
    outputTokens: run.outputTokens,
    promptVersion: run.promptVersion,
    requestedModel: run.requestedModel,
    task: run.task,
    traceId: run.traceId ?? null,
    userId: isUuid(run.distinctId) ? run.distinctId : null,
  };
}

/**
 * Stores one evaluation run. A run for a learner or goal deleted while it ran keeps its verdict
 * for tuning but loses the link and the input, so nothing of theirs outlives them.
 */
async function recordEvaluationRun(run: EvaluationRunRecord): Promise<void> {
  const row = toRow(run);

  try {
    await prisma.evaluationRun.create({ data: row });
  } catch (error) {
    if (!isPrismaForeignKeyError(error)) {
      throw error;
    }

    await prisma.evaluationRun.create({
      data: { ...row, goalId: null, input: DbNull, userId: null },
    });
  }
}

/**
 * Keeps every evaluation run of `@zoonk/ai` (Jev and its fallbacks) in `evaluation_runs` for
 * audits, threshold tuning and eval sampling. Apps call this from `instrumentation.ts`, next to
 * `registerAiGenerationAnalytics`.
 */
export function registerEvaluationRunLog() {
  registerEvaluationRunSink(recordEvaluationRun);
}

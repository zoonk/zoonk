import "server-only";
import { type EvaluationRunRecord, registerEvaluationRunSink } from "@zoonk/ai/evaluation-run-sink";
import { DbNull, isPrismaForeignKeyError, prisma } from "@zoonk/db";
import { isUuid } from "@zoonk/utils/uuid";

/**
 * A run deciding about shared Library content reads only Library text, so it belongs to the
 * Library, not to the learner whose request started it: it isn't linked to them and stays when
 * they go. A run that read a learner's own text goes away with its learner and goal.
 */
function toRow(run: EvaluationRunRecord) {
  const personal = run.contentScope === "personal";

  return {
    answers: run.answers,
    contentScope: run.contentScope,
    goalId: personal && isUuid(run.goalId) ? run.goalId : null,
    input: run.input ?? DbNull,
    inputHash: run.inputHash,
    latencyMs: run.latencyMs,
    model: run.model,
    promptVersion: run.promptVersion,
    requestedModel: run.requestedModel,
    runId: run.runId,
    task: run.task,
    traceId: run.traceId ?? null,
    userId: personal && isUuid(run.distinctId) ? run.distinctId : null,
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

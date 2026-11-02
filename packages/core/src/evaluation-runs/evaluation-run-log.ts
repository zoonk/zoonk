import "server-only";
import { type EvaluationRunRecord, registerEvaluationRunSink } from "@zoonk/ai/evaluation-run-sink";
import { DbNull, isPrismaForeignKeyError, prisma } from "@zoonk/db";
import { isUuid } from "@zoonk/utils/uuid";

/** Shared-content evaluations outlive their initiator; personal-text evaluations leave with the learner and goal. */
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

export function registerEvaluationRunLog() {
  registerEvaluationRunSink(recordEvaluationRun);
}

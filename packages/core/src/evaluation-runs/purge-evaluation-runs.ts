import "server-only";
import { prisma } from "@zoonk/db";
import { MS_PER_DAY } from "@zoonk/utils/date";

/** How long evaluation runs stay available for audits, tuning and eval sampling. */
const EVALUATION_RUN_RETENTION_DAYS = 30;

/**
 * The scheduled sweep: removes evaluation runs older than the retention window. Returns how many
 * rows were removed, for the job's log.
 */
export async function purgeEvaluationRuns(): Promise<{ purged: number }> {
  const cutoff = new Date(Date.now() - EVALUATION_RUN_RETENTION_DAYS * MS_PER_DAY);
  const { count } = await prisma.evaluationRun.deleteMany({ where: { createdAt: { lt: cutoff } } });

  return { purged: count };
}

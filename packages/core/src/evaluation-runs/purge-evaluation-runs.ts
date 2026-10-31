import "server-only";
import { prisma } from "@zoonk/db";
import { MS_PER_DAY } from "@zoonk/utils/date";

const EVALUATION_RUN_RETENTION_DAYS = 30;

export async function purgeEvaluationRuns(): Promise<{ purged: number }> {
  const cutoff = new Date(Date.now() - EVALUATION_RUN_RETENTION_DAYS * MS_PER_DAY);
  const { count } = await prisma.evaluationRun.deleteMany({ where: { createdAt: { lt: cutoff } } });

  return { purged: count };
}

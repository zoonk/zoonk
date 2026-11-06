import "server-only";
import { type TransactionClient, prisma, sql } from "@zoonk/db";

/** Read by step id without this filter when finishing a learner's already-open retired version. */
export const CURRENT_STEPS = { retiredAt: null, staged: false } as const;

const RETIRED_STEPS_KEPT_MS = 86_400_000;

/** A staged version replaces only an earlier staged one: the current version stays until it's published. */
export async function startLessonVersion(
  tx: TransactionClient,
  lessonId: string,
  { staged = false }: { staged?: boolean } = {},
): Promise<number> {
  const latest = await tx.step.aggregate({ _max: { version: true }, where: { lessonId } });

  await tx.step.updateMany({
    data: { retiredAt: new Date() },
    where: { lessonId, retiredAt: null, ...(staged ? { staged } : {}) },
  });

  return (latest._max.version ?? 0) + 1;
}

/** Marks and pictures fill a staged version while it waits, else the current one. */
export function toPreparedSteps<Step extends { staged: boolean }>(steps: readonly Step[]): Step[] {
  const staged = steps.some((step) => step.staged);
  return steps.filter((step) => step.staged === staged);
}

export function toPreparedVersion<Step extends { staged: boolean }, Summary>({
  stagedSummary,
  steps,
  summary,
}: {
  stagedSummary: Summary;
  steps: readonly Step[];
  summary: Summary;
}): { staged: boolean; steps: Step[]; summary: Summary } {
  const staged = steps.some((step) => step.staged);
  return { staged, steps: toPreparedSteps(steps), summary: staged ? stagedSummary : summary };
}

export async function readStagedLessonVersion(lessonId: string): Promise<number | null> {
  const staged = await prisma.step.findFirst({
    select: { version: true },
    where: { lessonId, retiredAt: null, staged: true },
  });

  return staged?.version ?? null;
}

export async function lockCurrentLessonVersion(
  tx: TransactionClient,
  lessonId: string,
): Promise<number | null> {
  await tx.$queryRaw(sql`SELECT id FROM library_lessons WHERE id = ${lessonId}::uuid FOR UPDATE`);

  const current = await tx.step.findFirst({
    select: { version: true },
    where: { lesson: { contentStatus: "completed" }, lessonId, ...CURRENT_STEPS },
  });

  return current?.version ?? null;
}

export async function readCurrentLessonVersion(lessonId: string): Promise<number | null> {
  const current = await prisma.step.findFirst({
    select: { version: true },
    where: { lessonId, ...CURRENT_STEPS },
  });

  return current?.version ?? null;
}

export async function deleteRetiredSteps({
  now = new Date(),
}: { now?: Date } = {}): Promise<number> {
  const { count } = await prisma.step.deleteMany({
    where: { retiredAt: { lt: new Date(now.getTime() - RETIRED_STEPS_KEPT_MS) } },
  });

  return count;
}

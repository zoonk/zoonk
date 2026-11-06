import "server-only";
import { type StepWhereInput, type TransactionClient, prisma, sql } from "@zoonk/db";
import { lockPlanSourceWrite, writePlanInputs } from "../_utils/plan-input-write";

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

export async function readStagedLessonVersion(
  lessonId: string,
  db: TransactionClient = prisma,
): Promise<{ savedAt: number; version: number } | null> {
  const staged = await db.step.findFirst({
    select: { createdAt: true, version: true },
    where: { lessonId, retiredAt: null, staged: true },
  });

  return staged && { savedAt: staged.createdAt.getTime(), version: staged.version };
}

export async function lockCurrentLessonVersion(
  tx: TransactionClient,
  lessonId: string,
): Promise<number | null> {
  await tx.$queryRaw(
    sql`SELECT id FROM library_lessons WHERE id = ${lessonId}::uuid FOR NO KEY UPDATE`,
  );

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

/**
 * A replaced question may have been wrong, so it leaves the practice bank once no current screen
 * of a lesson still taught asks it.
 */
export async function retireUnaskedQuestions(
  tx: TransactionClient,
  askedBy: StepWhereInput,
): Promise<void> {
  const unasked = await tx.item.findMany({
    select: { id: true, skillId: true },
    where: {
      retiredAt: null,
      steps: { none: { ...CURRENT_STEPS, lesson: { setAsideAt: null } }, some: askedBy },
    },
  });

  if (unasked.length === 0) {
    return;
  }

  await lockPlanSourceWrite(tx, { skillIds: [...new Set(unasked.map(({ skillId }) => skillId))] });

  await tx.item.updateMany({
    data: { retiredAt: new Date() },
    where: { id: { in: unasked.map(({ id }) => id) } },
  });
}

export async function deleteRetiredSteps({
  now = new Date(),
}: { now?: Date } = {}): Promise<number> {
  const retired = { retiredAt: { lt: new Date(now.getTime() - RETIRED_STEPS_KEPT_MS) } };

  await writePlanInputs((tx) => retireUnaskedQuestions(tx, retired));
  const { count } = await prisma.step.deleteMany({ where: retired });

  return count;
}

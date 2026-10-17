import "server-only";
import { type TransactionClient, prisma, sql } from "@zoonk/db";

/**
 * A lesson's current screens: every read of a lesson's screens filters by it, so a version a check
 * replaced is never what a lesson opens with. A screen read by its id (grading an answer,
 * completing a run) isn't filtered: a learner playing a version that was replaced finishes it.
 */
export const CURRENT_STEPS = { retiredAt: null } as const;

/** How long a replaced version stays for the learners still playing it: runs end in half an hour. */
const RETIRED_STEPS_KEPT_MS = 86_400_000;

/**
 * Retires the lesson's current screens (they stay for whoever is playing them) and returns the
 * version the new screens are saved as.
 */
export async function startLessonVersion(tx: TransactionClient, lessonId: string): Promise<number> {
  const latest = await tx.step.aggregate({ _max: { version: true }, where: { lessonId } });

  await tx.step.updateMany({
    data: { retiredAt: new Date() },
    where: { lessonId, ...CURRENT_STEPS },
  });

  return (latest._max.version ?? 0) + 1;
}

/**
 * The version a lesson opens with now, read under a lock on the lesson, so a check that read one
 * version publishes its fix only while that version is still the current one. Null when the
 * lesson has no screens or isn't published.
 */
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

/** The version a lesson opens with now, or null when it has no screens. */
export async function readCurrentLessonVersion(lessonId: string): Promise<number | null> {
  const current = await prisma.step.findFirst({
    select: { version: true },
    where: { lessonId, ...CURRENT_STEPS },
  });

  return current?.version ?? null;
}

/**
 * Deletes screens replaced more than a day ago: nobody plays them anymore (a run ends within half
 * an hour). Answers and mistakes keep their snapshots; their link to the screen is cleared.
 */
export async function deleteRetiredSteps({
  now = new Date(),
}: { now?: Date } = {}): Promise<number> {
  const { count } = await prisma.step.deleteMany({
    where: { retiredAt: { lt: new Date(now.getTime() - RETIRED_STEPS_KEPT_MS) } },
  });

  return count;
}

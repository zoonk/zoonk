import "server-only";
import { type LearningEvent, type TransactionClient, prisma, sql } from "@zoonk/db";
import { getString } from "@zoonk/utils/json";

/**
 * A run left open for half an hour (the longest a lesson's time counts) is abandoned; a new start
 * opens a new run instead of resuming it.
 */
const RUN_RESUME_WINDOW_MS = 1_800_000;

/** Namespaces the per-learner, per-lesson advisory lock so it never collides with other locks. */
const RUN_LOCK_NAMESPACE = 51_874;

/** The ledger kinds a lesson run is stored as: a first completion or a replay. */
const LESSON_RUN_KINDS = ["lesson", "review"] as const satisfies LearningEvent["kind"][];

/** A run keeps its lesson as a plain id, so the ledger row outlives the content. */
function getRunLessonId(run: Pick<LearningEvent, "contentIds">): string | null {
  return getString(run.contentIds, "lessonId");
}

/** The session a run was started from, when the lesson was one of its blocks. */
export function getRunStudySessionId(run: Pick<LearningEvent, "contentIds">): string | null {
  return getString(run.contentIds, "studySessionId");
}

/** The signed-in learner's run of this lesson, or null for anyone else's or another lesson's. */
export async function findLessonRun({
  lessonId,
  runId,
  userId,
}: {
  lessonId: string;
  runId: string;
  userId: string;
}): Promise<LearningEvent | null> {
  const run = await prisma.learningEvent.findFirst({
    where: { id: runId, kind: { in: [...LESSON_RUN_KINDS] }, userId },
  });

  return run && getRunLessonId(run) === lessonId ? run : null;
}

/**
 * Serializes starts of one lesson by one learner, so a double mount or a retried request resumes
 * the same run instead of opening two.
 */
export async function lockLessonRuns(
  tx: TransactionClient,
  { lessonId, userId }: { lessonId: string; userId: string },
): Promise<void> {
  await tx.$queryRaw(
    sql`SELECT pg_advisory_xact_lock(${RUN_LOCK_NAMESPACE}::int, hashtext(${`${userId}:${lessonId}`}))::text`,
  );
}

/** The learner's open run of a lesson started recently enough to resume. */
export function findResumableRun(
  tx: TransactionClient,
  { lessonId, now, userId }: { lessonId: string; now: Date; userId: string },
) {
  return tx.learningEvent.findFirst({
    orderBy: { startedAt: "desc" },
    where: {
      contentIds: { equals: lessonId, path: ["lessonId"] },
      endedAt: null,
      kind: { in: [...LESSON_RUN_KINDS] },
      startedAt: { gte: new Date(now.getTime() - RUN_RESUME_WINDOW_MS) },
      userId,
    },
  });
}

/** Whether the learner finished this lesson before, in a run other than this one. */
export async function hasFinishedLessonBefore(
  tx: TransactionClient,
  { lessonId, runId, userId }: { lessonId: string; runId: string; userId: string },
): Promise<boolean> {
  const earlier = await tx.learningEvent.findFirst({
    select: { id: true },
    where: {
      contentIds: { equals: lessonId, path: ["lessonId"] },
      endedAt: { not: null },
      id: { not: runId },
      kind: { in: [...LESSON_RUN_KINDS] },
      userId,
    },
  });

  return earlier !== null;
}

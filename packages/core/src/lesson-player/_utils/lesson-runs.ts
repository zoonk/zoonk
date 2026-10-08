import "server-only";
import { type LearningEvent, type TransactionClient, prisma, sql } from "@zoonk/db";
import { MS_PER_DAY } from "@zoonk/utils/date";
import { getString } from "@zoonk/utils/json";
import { CURRENT_STEPS } from "../../library/lessons/lesson-versions";
import { type LibraryLessonRun } from "../contract";

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

/**
 * How long an unfinished lesson keeps the learner's answers for them to come back to. A week covers
 * coming back later the same day or after a weekend; a lesson set aside longer starts over, since
 * its first screens are forgotten by then and the plan has moved on.
 */
const PROGRESS_WINDOW_MS = 7 * MS_PER_DAY;

/** A sitting of a lesson: the run's start and the session it was a block of. */
type ProgressRun = Pick<LearningEvent, "contentIds" | "startedAt">;

/**
 * The learner's sittings of a lesson they haven't finished, oldest first, up to `until`: the runs
 * they left unfinished since they last finished it, at most a week back. The lesson's progress is
 * every answer since the first of them.
 */
export async function loadProgressRuns({
  lessonId,
  until,
  userId,
}: {
  lessonId: string;
  until: Date;
  userId: string;
}): Promise<ProgressRun[]> {
  const lessonRuns = {
    contentIds: { equals: lessonId, path: ["lessonId"] },
    kind: { in: [...LESSON_RUN_KINDS] },
    userId,
  };

  const finished = await prisma.learningEvent.findFirst({
    orderBy: { endedAt: "desc" },
    select: { endedAt: true },
    where: { ...lessonRuns, endedAt: { not: null } },
  });

  const windowStart = new Date(until.getTime() - PROGRESS_WINDOW_MS);

  const after =
    finished?.endedAt && finished.endedAt > windowStart ? finished.endedAt : windowStart;

  return prisma.learningEvent.findMany({
    orderBy: { startedAt: "asc" },
    select: { contentIds: true, startedAt: true },
    where: { ...lessonRuns, endedAt: null, startedAt: { gte: after, lte: until } },
  });
}

/**
 * The learner's answers to the lesson's screens since `since`, oldest first: the progress a run
 * continues from and what its completion counts. A rewritten lesson has new screens, so answers to
 * the old ones no longer count.
 */
export async function loadProgressAnswers({
  lessonId,
  since,
  userId,
}: {
  lessonId: string;
  since: Date;
  userId: string;
}): Promise<LibraryLessonRun["answers"]> {
  const rows = await prisma.attempt.findMany({
    orderBy: { answeredAt: "asc" },
    select: { answeredAt: true, isCorrect: true, stepId: true },
    where: { answeredAt: { gte: since }, step: { lessonId, ...CURRENT_STEPS }, userId },
  });

  return rows.flatMap((row) =>
    row.stepId
      ? [{ answeredAt: row.answeredAt.toISOString(), isCorrect: row.isCorrect, stepId: row.stepId }]
      : [],
  );
}

/** Each sitting's start and session, for scoring a lesson played over several. */
export function toSittings(runs: readonly ProgressRun[]) {
  return runs.map((run) => ({
    startedAt: run.startedAt,
    studySessionId: getRunStudySessionId(run),
  }));
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

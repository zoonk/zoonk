import "server-only";
import { type LearningEvent, type TransactionClient, prisma } from "@zoonk/db";
import { MS_PER_DAY } from "@zoonk/utils/date";
import { getString } from "@zoonk/utils/json";
import { CURRENT_STEPS } from "../../library/lessons/lesson-versions";
import { type LibraryLessonRun } from "../contract";

/** Runs older than the counted lesson-time limit must restart rather than resume. */
const RUN_RESUME_WINDOW_MS = 1_800_000;

const LESSON_RUN_KINDS = ["lesson", "review"] as const satisfies LearningEvent["kind"][];

/** A run keeps its lesson as a plain id, so the ledger row outlives the content. */
function getRunLessonId(run: Pick<LearningEvent, "contentIds">): string | null {
  return getString(run.contentIds, "lessonId");
}

export function getRunStudySessionId(run: Pick<LearningEvent, "contentIds">): string | null {
  return getString(run.contentIds, "studySessionId");
}

/** Returns null for another learner's run or a run of another lesson. */
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

/** Locks against completion; returns false once finished so late grades cannot record an answer. */
export async function lockOpenRun(transaction: TransactionClient, runId: string): Promise<boolean> {
  const open = await transaction.$queryRaw<{ id: string }[]>`
    SELECT "id" FROM "learning_events"
    WHERE "id" = ${runId}::uuid AND "ended_at" IS NULL
    FOR SHARE
  `;

  return open.length > 0;
}

/** Uses arrival order, not grading completion order; excludes a retry with the same attemptId. */
export async function hasAnswerSince(
  transaction: TransactionClient,
  {
    attemptId,
    since,
    stepId,
    userId,
  }: { attemptId?: string; since: Date; stepId: string; userId: string },
): Promise<boolean> {
  const later = await transaction.attempt.findFirst({
    select: { id: true },
    where: {
      answeredAt: { gt: since },
      stepId,
      userId,
      ...(attemptId && { id: { not: attemptId } }),
    },
  });

  return later !== null;
}

export async function loadStartedLessonIds({
  lessonIds,
  userId,
}: {
  lessonIds: readonly string[];
  userId: string;
}): Promise<Set<string>> {
  if (lessonIds.length === 0) {
    return new Set();
  }

  const runs = await prisma.learningEvent.findMany({
    select: { contentIds: true },
    where: {
      OR: lessonIds.map((lessonId) => ({ contentIds: { equals: lessonId, path: ["lessonId"] } })),
      kind: { in: [...LESSON_RUN_KINDS] },
      userId,
    },
  });

  return new Set(runs.flatMap((run) => getRunLessonId(run) ?? []));
}

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

/** Progress survives a weekend, but a lesson left longer than a week starts over. */
const PROGRESS_WINDOW_MS = 7 * MS_PER_DAY;

type ProgressRun = Pick<LearningEvent, "contentIds" | "startedAt">;

/** Oldest first, bounded by until and the last completion, at most one week back. */
export async function loadProgressRuns({
  client = prisma,
  lessonId,
  until,
  userId,
}: {
  client?: TransactionClient;
  lessonId: string;
  until: Date;
  userId: string;
}): Promise<ProgressRun[]> {
  const lessonRuns = {
    contentIds: { equals: lessonId, path: ["lessonId"] },
    kind: { in: [...LESSON_RUN_KINDS] },
    userId,
  };

  const finished = await client.learningEvent.findFirst({
    orderBy: { endedAt: "desc" },
    select: { endedAt: true },
    where: { ...lessonRuns, endedAt: { not: null } },
  });

  const windowStart = new Date(until.getTime() - PROGRESS_WINDOW_MS);

  const after =
    finished?.endedAt && finished.endedAt > windowStart ? finished.endedAt : windowStart;

  return client.learningEvent.findMany({
    orderBy: { startedAt: "asc" },
    select: { contentIds: true, startedAt: true },
    where: { ...lessonRuns, endedAt: null, startedAt: { gte: after, lte: until } },
  });
}

/** Oldest first; rewritten screens exclude answers to their replaced versions. */
export async function loadProgressAnswers({
  lessonId,
  since,
  userId,
  version = null,
}: {
  lessonId: string;
  since: Date;
  userId: string;
  version?: number | null;
}): Promise<LibraryLessonRun["answers"]> {
  const rows = await prisma.attempt.findMany({
    orderBy: { answeredAt: "asc" },
    select: { answeredAt: true, isCorrect: true, stepId: true },
    where: {
      answeredAt: { gte: since },
      step: { lessonId, ...(version === null ? CURRENT_STEPS : { version }) },
      userId,
    },
  });

  return rows.flatMap((row) =>
    row.stepId
      ? [{ answeredAt: row.answeredAt.toISOString(), isCorrect: row.isCorrect, stepId: row.stepId }]
      : [],
  );
}

export function toSittings(runs: readonly ProgressRun[]) {
  return runs.map((run) => ({
    startedAt: run.startedAt,
    studySessionId: getRunStudySessionId(run),
  }));
}

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

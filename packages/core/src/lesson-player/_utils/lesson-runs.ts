import "server-only";
import { type Attempt, type LearningEvent, type TransactionClient, prisma } from "@zoonk/db";
import { MS_PER_DAY } from "@zoonk/utils/date";
import { getString } from "@zoonk/utils/json";
import { CURRENT_STEPS } from "../../library/lessons/lesson-versions";
import { CAPSULE_LEDGER_KIND } from "../../milestones/award-milestones";

/** Runs older than the counted lesson-time limit must restart rather than resume. */
const RUN_RESUME_WINDOW_MS = 1_800_000;

const LESSON_RUN_KINDS = ["lesson", "review"] as const satisfies LearningEvent["kind"][];

/** Capsule reviews name their lesson but don't complete a lesson run. */
export const NOT_A_CAPSULE = {
  OR: [{ lessonKind: null }, { lessonKind: { not: CAPSULE_LEDGER_KIND } }],
};

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

/** Internal: `userId` comes from the session. */
export async function hasFinishedLesson({
  lessonId,
  userId,
}: {
  lessonId: string;
  userId: string;
}): Promise<boolean> {
  const run = await prisma.learningEvent.findFirst({
    select: { id: true },
    where: {
      ...NOT_A_CAPSULE,
      contentIds: { equals: lessonId, path: ["lessonId"] },
      endedAt: { not: null },
      kind: { in: [...LESSON_RUN_KINDS] },
      userId,
    },
  });

  return run !== null;
}

/** The learner's latest unfinished run of a lesson, however long ago it started. */
export function findOpenLessonRun({ lessonId, userId }: { lessonId: string; userId: string }) {
  return prisma.learningEvent.findFirst({
    orderBy: { startedAt: "desc" },
    select: { startedAt: true },
    where: {
      contentIds: { equals: lessonId, path: ["lessonId"] },
      endedAt: null,
      kind: { in: [...LESSON_RUN_KINDS] },
      userId,
    },
  });
}

function resumableSince(now: Date): Date {
  return new Date(now.getTime() - RUN_RESUME_WINDOW_MS);
}

export async function listResumableLessonIds({
  goalId,
  lessonIds,
  now,
  userId,
}: {
  goalId: string;
  lessonIds: readonly string[];
  now: Date;
  userId: string;
}): Promise<string[]> {
  const runs = await prisma.learningEvent.findMany({
    orderBy: { startedAt: "desc" },
    select: { contentIds: true },
    take: lessonIds.length,
    where: {
      AND: [
        NOT_A_CAPSULE,
        { OR: lessonIds.map((id) => ({ contentIds: { equals: id, path: ["lessonId"] } })) },
      ],
      endedAt: null,
      goalId,
      kind: { in: [...LESSON_RUN_KINDS] },
      startedAt: { gte: resumableSince(now) },
      userId,
    },
  });

  return runs.flatMap((run) => getRunLessonId(run) ?? []);
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
      startedAt: { gte: resumableSince(now) },
      userId,
    },
  });
}

/** Progress survives a weekend, but a lesson left longer than a week starts over. */
const PROGRESS_WINDOW_MS = 7 * MS_PER_DAY;

type ProgressRun = Pick<LearningEvent, "contentIds" | "startedAt">;

function lessonRunsWhere({ lessonId, userId }: { lessonId: string; userId: string }) {
  return {
    contentIds: { equals: lessonId, path: ["lessonId"] },
    kind: { in: [...LESSON_RUN_KINDS] },
    userId,
  };
}

/** When the learner last finished the lesson, or null if they never have. */
export async function findLastLessonFinish({
  client = prisma,
  lessonId,
  userId,
}: {
  client?: TransactionClient;
  lessonId: string;
  userId: string;
}): Promise<Date | null> {
  const finished = await client.learningEvent.findFirst({
    orderBy: { endedAt: "desc" },
    select: { endedAt: true },
    where: { ...lessonRunsWhere({ lessonId, userId }), ...NOT_A_CAPSULE, endedAt: { not: null } },
  });

  return finished?.endedAt ?? null;
}

/** Oldest first, bounded by until and the last completion, at most one week back. */
export async function loadProgressRuns({
  client = prisma,
  finishedAt,
  lessonId,
  until,
  userId,
}: {
  client?: TransactionClient;
  /** The last completion, when the caller already read it. */
  finishedAt?: Date | null;
  lessonId: string;
  until: Date;
  userId: string;
}): Promise<ProgressRun[]> {
  const lessonRuns = lessonRunsWhere({ lessonId, userId });

  const finished =
    finishedAt === undefined
      ? await findLastLessonFinish({ client, lessonId, userId })
      : finishedAt;

  const windowStart = new Date(until.getTime() - PROGRESS_WINDOW_MS);
  const after = finished && finished > windowStart ? finished : windowStart;

  return client.learningEvent.findMany({
    orderBy: { startedAt: "asc" },
    select: { contentIds: true, startedAt: true },
    where: { ...lessonRuns, endedAt: null, startedAt: { gte: after, lte: until } },
  });
}

/** Where the lesson's progress starts: its oldest unfinished sitting this week, else until. */
export async function loadProgressSince(
  input: Parameters<typeof loadProgressRuns>[0],
): Promise<Date> {
  const [first] = await loadProgressRuns(input);
  return first?.startedAt ?? input.until;
}

export type ProgressAttempt = Pick<Attempt, "answer" | "answeredAt" | "isCorrect" | "score"> & {
  stepId: string;
};

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
}): Promise<ProgressAttempt[]> {
  const rows = await prisma.attempt.findMany({
    orderBy: { answeredAt: "asc" },
    select: { answer: true, answeredAt: true, isCorrect: true, score: true, stepId: true },
    where: {
      answeredAt: { gte: since },
      step: { lessonId, ...(version === null ? CURRENT_STEPS : { version }) },
      userId,
    },
  });

  return rows.flatMap(({ stepId, ...row }) => (stepId ? [{ ...row, stepId }] : []));
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
      ...NOT_A_CAPSULE,
      contentIds: { equals: lessonId, path: ["lessonId"] },
      endedAt: { not: null },
      id: { not: runId },
      kind: { in: [...LESSON_RUN_KINDS] },
      userId,
    },
  });

  return earlier !== null;
}

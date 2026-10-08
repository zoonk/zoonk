import "server-only";
import { cacheAdminData } from "@/data/_utils/admin-data-cache";
import { prisma } from "@zoonk/db";

type CompletedLessonRow = Awaited<ReturnType<typeof findUserCompletedLessonRows>>[number];
type LearningDayRow = Awaited<ReturnType<typeof findUserLearningDayRows>>[number];

type LessonKindTotals = {
  completedLessons: number;
  durationSampleCount: number;
  totalDurationSeconds: number;
};

export type UserLearningKindStat = {
  avgDurationSeconds: number | null;
  completedLessons: number;
  kind: string;
  totalDurationSeconds: number;
};

export type UserLearningStats = {
  completedLessons: number;
  learningDays: number;
  lessonKinds: UserLearningKindStat[];
  totalLearningSeconds: number;
};

const UNKNOWN_LESSON_KIND = "unknown";

const cachedGetUserLearningStats = cacheAdminData(
  async (userId: string): Promise<UserLearningStats> => {
    const [completedLessons, learningDays] = await Promise.all([
      findUserCompletedLessonRows({ userId }),
      findUserLearningDayRows({ userId }),
    ]);

    return buildUserLearningStats({ completedLessons, learningDays });
  },
);

/**
 * User detail sections pass route params as primitive cache keys so React can
 * dedupe the admin-only progress queries across one request.
 */
export async function getUserLearningStats(params: { userId: string }) {
  return cachedGetUserLearningStats(params.userId);
}

/**
 * Finished lesson rows in the learning ledger keep the lesson kind as a text
 * snapshot, so the breakdown survives the lessons being deleted.
 */
function findUserCompletedLessonRows({ userId }: { userId: string }) {
  return prisma.learningEvent.findMany({
    orderBy: [{ endedAt: "asc" }, { id: "asc" }],
    where: { endedAt: { not: null }, kind: "lesson", userId },
  });
}

/**
 * DailyProgress stores the learner's client-local completion date, so it stays
 * the best source for counting calendar learning days, lesson totals and time.
 * `lessonsCompleted` also covers days recovered from legacy lessons.
 */
function findUserLearningDayRows({ userId }: { userId: string }) {
  return prisma.dailyProgress.findMany({
    orderBy: [{ date: "asc" }, { id: "asc" }],
    where: {
      OR: [
        { interactiveCompleted: { gt: 0 } },
        { lessonsCompleted: { gt: 0 } },
        { staticCompleted: { gt: 0 } },
      ],
      userId,
    },
  });
}

/**
 * The user page needs one compact object for the summary fields and the lesson
 * kind breakdown, while each source table answers a different part of that view.
 */
function buildUserLearningStats({
  completedLessons,
  learningDays,
}: {
  completedLessons: CompletedLessonRow[];
  learningDays: LearningDayRow[];
}): UserLearningStats {
  return {
    completedLessons: learningDays.reduce((total, row) => total + row.lessonsCompleted, 0),
    learningDays: learningDays.length,
    lessonKinds: buildLessonKindStats({ rows: completedLessons }),
    totalLearningSeconds: sumLearningTime({ rows: learningDays }),
  };
}

/**
 * DailyProgress is the durable aggregate for total learning time. Completion
 * writes cap each increment before updating this row so admin metrics can keep
 * using the cheap per-day summary without replaying raw lesson events.
 */
function sumLearningTime({ rows }: { rows: LearningDayRow[] }) {
  return rows.reduce((total, row) => total + row.timeSpentSeconds, 0);
}

/**
 * Grouping by lesson kind lets support compare how this learner spends time
 * across explanations, practice, quizzes, and language companion lessons.
 */
function buildLessonKindStats({ rows }: { rows: CompletedLessonRow[] }) {
  const grouped = groupCompletedLessonsByKind({ rows });

  return Array.from(grouped.entries(), ([kind, totals]) =>
    buildLessonKindStat({ kind, totals }),
  ).toSorted(sortLessonKindStats);
}

/**
 * Duration can be missing on historical completions, so each kind tracks both
 * total completions and the number of rows that can safely contribute to an average.
 */
function groupCompletedLessonsByKind({ rows }: { rows: CompletedLessonRow[] }) {
  const grouped = new Map<string, LessonKindTotals>();

  for (const row of rows) {
    const kind = row.lessonKind ?? UNKNOWN_LESSON_KIND;
    const totals = grouped.get(kind) ?? createEmptyLessonKindTotals();

    grouped.set(kind, addCompletedLessonToKindTotals({ seconds: row.seconds, totals }));
  }

  return grouped;
}

/**
 * A fresh totals object avoids sharing mutable state between lesson-kind groups.
 */
function createEmptyLessonKindTotals(): LessonKindTotals {
  return { completedLessons: 0, durationSampleCount: 0, totalDurationSeconds: 0 };
}

/**
 * Completed rows without a duration still count as completed lessons, but they
 * should not pull the average duration down to zero. Backfilled legacy
 * completions that never recorded a duration store zero seconds.
 */
function addCompletedLessonToKindTotals({
  seconds,
  totals,
}: {
  seconds: number;
  totals: LessonKindTotals;
}): LessonKindTotals {
  if (seconds === 0) {
    return { ...totals, completedLessons: totals.completedLessons + 1 };
  }

  return {
    completedLessons: totals.completedLessons + 1,
    durationSampleCount: totals.durationSampleCount + 1,
    totalDurationSeconds: totals.totalDurationSeconds + seconds,
  };
}

/**
 * The UI displays null averages as empty data, which is clearer than showing
 * zero seconds for old completions that simply lack duration telemetry.
 */
function buildLessonKindStat({
  kind,
  totals,
}: {
  kind: string;
  totals: LessonKindTotals;
}): UserLearningKindStat {
  return {
    avgDurationSeconds: getAverageDurationSeconds({ totals }),
    completedLessons: totals.completedLessons,
    kind,
    totalDurationSeconds: totals.totalDurationSeconds,
  };
}

/**
 * Average lesson time should only use rows that actually recorded time spent.
 */
function getAverageDurationSeconds({ totals }: { totals: LessonKindTotals }) {
  if (totals.durationSampleCount === 0) {
    return null;
  }

  return Math.round(totals.totalDurationSeconds / totals.durationSampleCount);
}

/**
 * Admins usually scan for the most-used lesson kinds first, with a stable
 * alphabetical fallback when two kinds have the same completion count.
 */
function sortLessonKindStats(first: UserLearningKindStat, second: UserLearningKindStat) {
  const completedLessonDifference = second.completedLessons - first.completedLessons;

  if (completedLessonDifference !== 0) {
    return completedLessonDifference;
  }

  return first.kind.localeCompare(second.kind);
}

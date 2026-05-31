import "server-only";
import { isAdmin } from "@/lib/admin-guard";
import { type LessonKind, prisma } from "@zoonk/db";
import { cache } from "react";

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
  kind: LessonKind;
  totalDurationSeconds: number;
};

export type UserLearningStats = {
  completedLessons: number;
  learningDays: number;
  lessonKinds: UserLearningKindStat[];
  totalLearningSeconds: number;
};

const emptyUserLearningStats: UserLearningStats = {
  completedLessons: 0,
  learningDays: 0,
  lessonKinds: [],
  totalLearningSeconds: 0,
};

const cachedGetUserLearningStats = cache(async (userId: string): Promise<UserLearningStats> => {
  if (!(await isAdmin())) {
    return emptyUserLearningStats;
  }

  const [completedLessons, learningDays] = await Promise.all([
    findUserCompletedLessonRows({ userId }),
    findUserLearningDayRows({ userId }),
  ]);

  return buildUserLearningStats({ completedLessons, learningDays });
});

/**
 * User detail sections pass route params as primitive cache keys so React can
 * dedupe the admin-only progress queries across one request.
 */
export async function getUserLearningStats(params: { userId: string }) {
  return cachedGetUserLearningStats(params.userId);
}

/**
 * LessonProgress is the source of truth for completed lesson counts and
 * duration by kind because each completion row points at the exact lesson type.
 */
function findUserCompletedLessonRows({ userId }: { userId: string }) {
  return prisma.lessonProgress.findMany({
    include: { lesson: { select: { kind: true } } },
    orderBy: [{ completedAt: "asc" }, { id: "asc" }],
    where: { completedAt: { not: null }, userId },
  });
}

/**
 * DailyProgress stores the learner's client-local completion date, so it is the
 * best source for counting calendar learning days and total app learning time.
 */
function findUserLearningDayRows({ userId }: { userId: string }) {
  return prisma.dailyProgress.findMany({
    orderBy: [{ date: "asc" }, { id: "asc" }],
    where: { OR: [{ interactiveCompleted: { gt: 0 } }, { staticCompleted: { gt: 0 } }], userId },
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
    completedLessons: completedLessons.length,
    learningDays: learningDays.length,
    lessonKinds: buildLessonKindStats({ rows: completedLessons }),
    totalLearningSeconds: sumLearningTime({ rows: learningDays }),
  };
}

/**
 * DailyProgress may contain decay-only rows, so callers filter to learning days
 * first and this helper can stay a simple duration sum.
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
  const grouped = new Map<LessonKind, LessonKindTotals>();

  for (const row of rows) {
    const kind = row.lesson.kind;
    const totals = grouped.get(kind) ?? createEmptyLessonKindTotals();

    grouped.set(
      kind,
      addCompletedLessonToKindTotals({ durationSeconds: row.durationSeconds, totals }),
    );
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
 * should not pull the average duration down to zero.
 */
function addCompletedLessonToKindTotals({
  durationSeconds,
  totals,
}: {
  durationSeconds: number | null;
  totals: LessonKindTotals;
}): LessonKindTotals {
  if (durationSeconds === null) {
    return { ...totals, completedLessons: totals.completedLessons + 1 };
  }

  return {
    completedLessons: totals.completedLessons + 1,
    durationSampleCount: totals.durationSampleCount + 1,
    totalDurationSeconds: totals.totalDurationSeconds + durationSeconds,
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
  kind: LessonKind;
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

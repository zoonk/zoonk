import "server-only";
import { cacheAdminData } from "@/data/_utils/admin-data-cache";
import { type LearningEvent, prisma } from "@zoonk/db";

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

/** A learner's totals, counted from their days with study in them. */
export const getUserLearningTotals = cacheAdminData(async (userId: string) => {
  const totals = await prisma.dailyProgress.aggregate({
    _count: { id: true },
    _sum: { lessonsCompleted: true, timeSpentSeconds: true },
    where: {
      OR: [
        { interactiveCompleted: { gt: 0 } },
        { lessonsCompleted: { gt: 0 } },
        { staticCompleted: { gt: 0 } },
      ],
      userId,
    },
  });

  return {
    completedLessons: totals._sum.lessonsCompleted ?? 0,
    learningDays: totals._count.id,
    totalLearningSeconds: totals._sum.timeSpentSeconds ?? 0,
  };
});

export const listUserLessonKinds = cacheAdminData(async (userId: string) => {
  const completedLessons = await prisma.learningEvent.findMany({
    where: { endedAt: { not: null }, kind: "lesson", userId },
  });

  return buildLessonKindStats(completedLessons);
});

function buildLessonKindStats(rows: LearningEvent[]): UserLearningKindStat[] {
  const grouped = new Map<string, LessonKindTotals>();

  for (const row of rows) {
    const kind = row.lessonKind ?? "unknown";

    const totals = grouped.get(kind) ?? {
      completedLessons: 0,
      durationSampleCount: 0,
      totalDurationSeconds: 0,
    };

    grouped.set(kind, {
      completedLessons: totals.completedLessons + 1,
      // A completion can record zero seconds when another sitting already accounted for its time.
      durationSampleCount: totals.durationSampleCount + (row.seconds === 0 ? 0 : 1),
      totalDurationSeconds: totals.totalDurationSeconds + row.seconds,
    });
  }

  return Array.from(grouped, ([kind, totals]) => ({
    avgDurationSeconds:
      totals.durationSampleCount === 0
        ? null
        : Math.round(totals.totalDurationSeconds / totals.durationSampleCount),
    completedLessons: totals.completedLessons,
    kind,
    totalDurationSeconds: totals.totalDurationSeconds,
  })).toSorted(
    (first, second) =>
      second.completedLessons - first.completedLessons || first.kind.localeCompare(second.kind),
  );
}

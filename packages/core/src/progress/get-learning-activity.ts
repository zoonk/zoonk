import "server-only";
import { prisma } from "@zoonk/db";
import {
  type ContributionCalendarDateRange,
  getContributionCalendarDateKey,
  getContributionCalendarDateRangeFromEndDate,
  getContributionCalendarDates,
} from "@zoonk/utils/contribution-calendar";
import { getProgressSession } from "./_utils/progress-cache";
import {
  type LearningActivityTotals,
  getLearningActivityTotals,
} from "./get-learning-activity-totals";
import { getRequestProgressDateContext } from "./get-request-date-context";

export type LearningActivityDay = { date: Date; lessonCompletions: number };

export type LearningActivityData = LearningActivityTotals & { days: LearningActivityDay[] };

type LearningActivityRow = Awaited<ReturnType<typeof listLearningActivityRows>>[number];

type LearningActivityDateQuery = ContributionCalendarDateRange & { userId: string };

type LessonCompletionsByDate = Record<string, number>;

/**
 * LessonProgress stores one durable learner-local completion date per lesson,
 * so reviews never create extra calendar activity. The query remains bounded
 * to the visible calendar instead of loading the learner's lifetime rows.
 */
function listLearningActivityRows({ endDate, startDate, userId }: LearningActivityDateQuery) {
  return prisma.lessonProgress.findMany({
    orderBy: { completedDate: "asc" },
    where: { completedDate: { gte: startDate, lte: endDate }, userId },
  });
}

/**
 * The database filter excludes incomplete rows, but the early return preserves
 * that invariant if the query shape changes without silently inventing a date.
 */
function countLessonCompletionByDate({
  completionCounts,
  row,
}: {
  completionCounts: LessonCompletionsByDate;
  row: LearningActivityRow;
}): LessonCompletionsByDate {
  if (!row.completedDate) {
    return completionCounts;
  }

  const dateKey = getContributionCalendarDateKey(row.completedDate);

  return { ...completionCounts, [dateKey]: (completionCounts[dateKey] ?? 0) + 1 };
}

/**
 * Immutable date counts let the complete calendar fill absent dates with zero
 * while preserving one event per durable LessonProgress row.
 */
function buildLessonCompletionsByDate(rows: LearningActivityRow[]): LessonCompletionsByDate {
  return rows.reduce(
    (completionCounts, row) => countLessonCompletionByDate({ completionCounts, row }),
    {},
  );
}

/**
 * Each calendar square needs a concrete date even when no LessonProgress row
 * exists, so the UI can render a stable 53-week grid for new learners too.
 */
function buildLearningActivityDay({
  date,
  lessonCompletionsByDate,
}: {
  date: Date;
  lessonCompletionsByDate: LessonCompletionsByDate;
}): LearningActivityDay {
  return {
    date,
    lessonCompletions: lessonCompletionsByDate[getContributionCalendarDateKey(date)] ?? 0,
  };
}

/**
 * The heatmap covers every date from the first Sunday through the learner's
 * current local date instead of returning only non-empty dates.
 */
function buildLearningActivityDays({
  endDate,
  rows,
  startDate,
}: {
  endDate: Date;
  rows: LearningActivityRow[];
  startDate: Date;
}): LearningActivityDay[] {
  const lessonCompletionsByDate = buildLessonCompletionsByDate(rows);
  const dates = getContributionCalendarDates({ endDate, startDate });

  return dates.map((date) => buildLearningActivityDay({ date, lessonCompletionsByDate }));
}

/**
 * Reads only the bounded rows needed for the calendar. Lifetime totals have a
 * separate compact query so Home never loads this 53-week dataset.
 */
async function findLearningActivityDays({
  endDate,
  startDate,
  userId,
}: ContributionCalendarDateRange & { userId: string }): Promise<LearningActivityDay[]> {
  const rows = await listLearningActivityRows({ endDate, startDate, userId });

  return buildLearningActivityDays({ endDate, rows, startDate });
}

/**
 * Returns the signed-in learner's 53-week completion-activity calendar and
 * lifetime totals using the current learner-local date.
 */
export async function getLearningActivity(): Promise<LearningActivityData | null> {
  "use cache: private";

  const [session, dateContext] = await Promise.all([
    getProgressSession(),
    getRequestProgressDateContext(),
  ]);

  if (!session) {
    return null;
  }

  const dateRange = getContributionCalendarDateRangeFromEndDate(dateContext.currentDate);

  const [days, totals] = await Promise.all([
    findLearningActivityDays({ ...dateRange, userId: session.user.id }),
    getLearningActivityTotals(),
  ]);

  return totals ? { ...totals, days } : null;
}

/**
 * Wraps the complete Activity read as a current-user resource so delivery
 * adapters can distinguish missing authentication from a valid zero-activity
 * calendar without reimplementing an authorization check.
 */
export async function getCurrentUserActivity(): Promise<{ activity: LearningActivityData } | null> {
  const activity = await getLearningActivity();
  return activity ? { activity } : null;
}

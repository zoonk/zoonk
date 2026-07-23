import "server-only";
import { getRequestTimeZone } from "@/data/_utils/get-request-time-zone";
import { getUserProgressCacheTag } from "@/data/cache-tags";
import { getSession } from "@/data/users/get-session";
import { prisma } from "@zoonk/db";
import {
  type ContributionCalendarDateRange,
  getContributionCalendarDateKey,
  getContributionCalendarDateRange,
  getContributionCalendarDates,
} from "@zoonk/utils/contribution-calendar";
import { cacheTag } from "next/cache";
import {
  type LearningActivityTotals,
  getLearningActivityTotals,
} from "./get-learning-activity-totals";

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
 * Capturing the approximate current date inside a cache keeps the production
 * route prerenderable while allowing tests to inject an exact date directly.
 */
async function getCurrentLearningActivityQueryDateRange(
  timeZone: string,
): Promise<ContributionCalendarDateRange> {
  "use cache";

  return getContributionCalendarDateRange({ now: new Date(), timeZone });
}

/**
 * Request timezone lookup stays outside the shared cache while the resulting
 * IANA name becomes a stable cache argument for the date-only calendar range.
 */
async function getCurrentLearningActivityRequestDateRange(): Promise<ContributionCalendarDateRange> {
  return getCurrentLearningActivityQueryDateRange(await getRequestTimeZone());
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
  "use cache";

  cacheTag(getUserProgressCacheTag(userId));

  const rows = await listLearningActivityRows({ endDate, startDate, userId });

  return buildLearningActivityDays({ endDate, rows, startDate });
}

/**
 * Returns the signed-in learner's 53-week completion-activity calendar and
 * lifetime totals. Optional request timing keeps boundary tests deterministic.
 */
export async function getLearningActivity({
  now,
  timeZone,
}: { now?: Date; timeZone?: string } = {}): Promise<LearningActivityData | null> {
  const dateRangePromise = now
    ? Promise.resolve(getContributionCalendarDateRange({ now, timeZone }))
    : getCurrentLearningActivityRequestDateRange();

  const [dateRange, session] = await Promise.all([dateRangePromise, getSession()]);

  if (!session) {
    return null;
  }

  const [days, totals] = await Promise.all([
    findLearningActivityDays({ ...dateRange, userId: session.user.id }),
    getLearningActivityTotals(),
  ]);

  return totals ? { ...totals, days } : null;
}

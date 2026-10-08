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
import { LEARNING_DAY_WHERE, countActivitiesCompleted } from "./progress-metrics";

/**
 * One calendar day: the activities finished (lessons, reviews, practice), which light the day
 * exactly when it counts as a learning day, and the lessons finished for the first time.
 */
export type LearningActivityDay = {
  activitiesCompleted: number;
  date: Date;
  lessonCompletions: number;
};

export type LearningActivityData = LearningActivityTotals & { days: LearningActivityDay[] };

type LearningActivityRow = Awaited<ReturnType<typeof listLearningActivityRows>>[number];

type LearningActivityDateQuery = ContributionCalendarDateRange & { userId: string };

type ActivityByDate = Record<string, Omit<LearningActivityDay, "date">>;

/**
 * The learning days in the visible calendar, by the same definition as the lifetime total, so
 * the calendar and "learning days" never disagree. Daily totals survive lessons being deleted, and
 * the query stays bounded to the visible calendar instead of the learner's lifetime rows.
 */
function listLearningActivityRows({ endDate, startDate, userId }: LearningActivityDateQuery) {
  return prisma.dailyProgress.findMany({
    orderBy: { date: "asc" },
    where: { ...LEARNING_DAY_WHERE, date: { gte: startDate, lte: endDate }, userId },
  });
}

/** One daily row per date lets the calendar look up each square's counts by its date key. */
function buildActivityByDate(rows: LearningActivityRow[]): ActivityByDate {
  return Object.fromEntries(
    rows.map((row) => [
      getContributionCalendarDateKey(row.date),
      {
        activitiesCompleted: countActivitiesCompleted(row),
        lessonCompletions: row.lessonsCompleted,
      },
    ]),
  );
}

/**
 * Each calendar square needs a concrete date even when no daily row exists, so
 * the UI can render a stable 53-week grid for new learners too.
 */
function buildLearningActivityDay({
  activityByDate,
  date,
}: {
  activityByDate: ActivityByDate;
  date: Date;
}): LearningActivityDay {
  const activity = activityByDate[getContributionCalendarDateKey(date)];

  return {
    activitiesCompleted: activity?.activitiesCompleted ?? 0,
    date,
    lessonCompletions: activity?.lessonCompletions ?? 0,
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
  const activityByDate = buildActivityByDate(rows);
  const dates = getContributionCalendarDates({ endDate, startDate });

  return dates.map((date) => buildLearningActivityDay({ activityByDate, date }));
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

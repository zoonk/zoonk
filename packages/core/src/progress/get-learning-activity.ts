import "server-only";
import { prisma } from "@zoonk/db";
import {
  type ContributionCalendarDateRange,
  getContributionCalendarDateKey,
  getContributionCalendarDateRangeFromEndDate,
  getContributionCalendarDates,
} from "@zoonk/utils/contribution-calendar";
import {
  type ProgressHistoryOptions,
  dailyProgressInWindow,
  readLifetimeDailyProgress,
} from "./_utils/daily-progress-rows";
import { getProgressSession } from "./_utils/progress-cache";
import {
  type LearningActivityTotals,
  getLearningActivityTotals,
} from "./get-learning-activity-totals";
import { getRequestProgressDateContext } from "./get-request-date-context";
import { LEARNING_DAY_WHERE, countActivitiesCompleted } from "./progress-metrics";

/** Dates are learner-local labels; any completed activity counts as a learning day. */
export type LearningActivityDay = {
  activitiesCompleted: number;
  date: Date;
  lessonCompletions: number;
};

export type LearningActivityData = LearningActivityTotals & { days: LearningActivityDay[] };

type LearningActivityRow = Awaited<ReturnType<typeof listLearningActivityRows>>[number];

type LearningActivityDateQuery = ContributionCalendarDateRange & { userId: string };

type ActivityByDate = Record<string, Omit<LearningActivityDay, "date">>;

function listLearningActivityRows({ endDate, startDate, userId }: LearningActivityDateQuery) {
  return prisma.dailyProgress.findMany({
    orderBy: { date: "asc" },
    where: { ...LEARNING_DAY_WHERE, date: { gte: startDate, lte: endDate }, userId },
  });
}

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

async function findLearningActivityDays({
  endDate,
  startDate,
  userId,
  history,
}: ContributionCalendarDateRange & ProgressHistoryOptions & { userId: string }): Promise<
  LearningActivityDay[]
> {
  const rows =
    history === "lifetime"
      ? dailyProgressInWindow({
          endDate,
          rows: await readLifetimeDailyProgress(userId),
          startDate,
        }).filter((row) => countActivitiesCompleted(row) > 0)
      : await listLearningActivityRows({ endDate, startDate, userId });

  return buildLearningActivityDays({ endDate, rows, startDate });
}

/** Returns 53 weeks of local dates plus lifetime totals; null without a session. */
export async function getLearningActivity({
  history,
}: ProgressHistoryOptions = {}): Promise<LearningActivityData | null> {
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
    findLearningActivityDays({ ...dateRange, history, userId: session.user.id }),
    history ? getLearningActivityTotals({ history }) : getLearningActivityTotals(),
  ]);

  return totals ? { ...totals, days } : null;
}

/** Null means unauthenticated, never an empty authenticated calendar. */
export async function getCurrentUserActivity(): Promise<{ activity: LearningActivityData } | null> {
  const activity = await getLearningActivity();
  return activity ? { activity } : null;
}

import { prisma } from "@zoonk/db";
import { MS_PER_DAY } from "@zoonk/utils/date";
import { type WeeklyActivityDay } from "../guardian-contract";

const WEEK_DAYS = 7;
const SECONDS_PER_MINUTE = 60;

type WeeklyActivity = { days: WeeklyActivityDay[]; lessonsCompleted: number; minutes: number };

function getWeekStart(today: Date): Date {
  return new Date(today.getTime() - (WEEK_DAYS - 1) * MS_PER_DAY);
}

function getWeekDates(today: Date): Date[] {
  const start = getWeekStart(today);

  return Array.from(
    { length: WEEK_DAYS },
    (_, index) => new Date(start.getTime() + index * MS_PER_DAY),
  );
}

/**
 * The last seven days of each learner from their daily totals, which never join content, so the
 * guardian sees minutes and finished lessons, not what the learner studied.
 */
export async function getWeeklyActivity({
  today,
  userIds,
}: {
  today: Date;
  userIds: string[];
}): Promise<Map<string, WeeklyActivity>> {
  const dates = getWeekDates(today);

  const rows = await prisma.dailyProgress.findMany({
    where: { date: { gte: getWeekStart(today), lte: today }, userId: { in: userIds } },
  });

  const toDay = (userId: string, date: Date): WeeklyActivityDay => {
    const row = rows.find(
      (candidate) => candidate.userId === userId && candidate.date.getTime() === date.getTime(),
    );

    return {
      date,
      lessonsCompleted: row?.lessonsCompleted ?? 0,
      minutes: Math.floor((row?.timeSpentSeconds ?? 0) / SECONDS_PER_MINUTE),
    };
  };

  return new Map(
    userIds.map((userId) => {
      const days = dates.map((date) => toDay(userId, date));

      return [
        userId,
        {
          days,
          lessonsCompleted: days.reduce((sum, day) => sum + day.lessonsCompleted, 0),
          minutes: days.reduce((sum, day) => sum + day.minutes, 0),
        },
      ];
    }),
  );
}

import "server-only";
import { prisma } from "@zoonk/db";
import { MS_PER_DAY } from "@zoonk/utils/date";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { getAllowance } from "../../entitlements/get-allowance";
import { loadOftenTestedSkillIds } from "../../exams/map/load-often-tested";
import { getAnswerTimeZone } from "../../learner/_utils/owned-goal";
import { getDailyTimeLimitStatus } from "../../minors/get-daily-time-limit";
import { getStartOfWeek } from "../../plans/planner/plan-calendar";
import { getWeekDays } from "../daily-goal";
import { getGoalDayMinutes } from "./day-minutes";
import { getExamPrepAccess } from "./exam-access";
import { loadSessionAnswers } from "./session-answers";
import { countMistakesFixedToday, getSessionMissions } from "./session-missions";
import { type StudySessionView, toStudySessionView } from "./session-view";
import { type StudySessionRow } from "./study-session-access";

const WEEK_DAYS = 7;

/**
 * The learner's time goal for a day is shared by their active goals ("ENEM and English" split one
 * budget): the sum of what each goal's plan gives that day, rest days and light weeks included.
 */
async function loadWeek({ session, userId }: { session: StudySessionRow; userId: string }) {
  const weekStart = getStartOfWeek(session.localDate);

  const [days, goals] = await Promise.all([
    prisma.dailyProgress.findMany({
      select: { date: true, timeSpentSeconds: true },
      where: {
        date: { gte: weekStart, lt: new Date(weekStart.getTime() + WEEK_DAYS * MS_PER_DAY) },
        userId,
      },
    }),
    prisma.goal.findMany({
      include: { plan: { select: { settings: true } } },
      where: { status: "active", userId },
    }),
  ]);

  // Days before a goal existed weren't days to study for it, so a new learner's week doesn't open
  // with days that read as missed.
  const getGoalMinutes = (date: Date) =>
    goals.reduce((sum, goal) => {
      const startDate = getDateInTimeZone({
        date: goal.createdAt,
        timeZone: getAnswerTimeZone({ goal }),
      });

      return date < startDate
        ? sum
        : sum + getGoalDayMinutes({ date, goal, planSettings: goal.plan?.settings });
    }, 0);

  return getWeekDays({
    days: days.map((day) => ({ date: day.date, seconds: day.timeSpentSeconds })),
    getGoalMinutes,
    today: session.localDate,
  });
}

/** Loads what the session view model reads: answers, missions, the week, limits and access. */
export async function loadStudySessionView({
  session,
  timeZone,
  userId,
}: {
  session: StudySessionRow;
  timeZone: string;
  userId: string;
}): Promise<StudySessionView> {
  const [answers, fixedToday, week, dailyLimit, allowance, plan, oftenTestedSkillIds] =
    await Promise.all([
      loadSessionAnswers({ blocks: session.blocks, sessionId: session.id, userId }),
      countMistakesFixedToday({ localDate: session.localDate, timeZone, userId }),
      loadWeek({ session, userId }),
      getDailyTimeLimitStatus(),
      getAllowance(),
      session.goalId
        ? prisma.plan.findUnique({ select: { settings: true }, where: { goalId: session.goalId } })
        : null,
      loadOftenTestedSkillIds(session.goal),
    ]);

  const answeredItemIds = new Set(
    answers.flatMap((answer) => (answer.itemId ? [answer.itemId] : [])),
  );

  return toStudySessionView({
    answers,
    dailyLimit,
    dayMinutes: session.goal
      ? getGoalDayMinutes({
          date: session.localDate,
          goal: session.goal,
          planSettings: plan?.settings,
        })
      : 0,
    examAccess: session.goal
      ? getExamPrepAccess({
          examPrep: allowance?.examPrep ?? null,
          goal: session.goal,
          timeZone,
          today: session.localDate,
        })
      : { includesMockExams: true, trialEnded: false },
    missions: getSessionMissions({ answeredItemIds, blocks: session.blocks, fixedToday }),
    oftenTestedSkillIds,
    session,
    week,
  });
}

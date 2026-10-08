import "server-only";
import { prisma } from "@zoonk/db";
import { MS_PER_DAY } from "@zoonk/utils/date";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { getAllowance } from "../../entitlements/get-allowance";
import { loadOftenTestedSkillIds } from "../../exams/map/load-often-tested";
import { getAnswerTimeZone } from "../../learner/_utils/owned-goal";
import { getDailyTimeLimitStatus } from "../../minors/get-daily-time-limit";
import { getStartOfWeek } from "../../plans/planner/plan-calendar";
import { DEFAULT_LESSON_MINUTES } from "../../plans/planner/plan-units";
import { type PlanDay, getWeekDayKind, getWeekDays } from "../daily-goal";
import { loadBlockSubjects } from "./block-subjects";
import { loadCatchUpView } from "./catch-up";
import { isCurrentSession } from "./current-session";
import { getGoalDayMinutes } from "./day-minutes";
import { getExamPrepAccess } from "./exam-access";
import { withExtraStudyCheck } from "./extra-blocks";
import { loadSessionAnswers } from "./session-answers";
import { countMistakesFixedToday, getSessionMissions } from "./session-missions";
import { type EmptyDay, type StudySessionView, toStudySessionView } from "./session-view";
import { type StudySessionRow } from "./study-session-access";

const WEEK_DAYS = 7;

/**
 * The learner's time goal for a day is shared by their active goals ("ENEM and English" split one
 * budget): the sum of what each goal's plan gives that day, rest days and light weeks included.
 */
async function loadWeek({ session, userId }: { session: StudySessionRow; userId: string }) {
  const weekStart = getStartOfWeek(session.localDate);

  const weekDates = { gte: weekStart, lt: new Date(weekStart.getTime() + WEEK_DAYS * MS_PER_DAY) };

  const [days, completed, goals] = await Promise.all([
    prisma.dailyProgress.findMany({
      select: { date: true, timeSpentSeconds: true },
      where: { date: weekDates, userId },
    }),
    prisma.studySession.findMany({
      select: { localDate: true },
      // Ended once: "10 more minutes" reopens a finished session, and the day still counts.
      where: { endedAt: { not: null }, localDate: weekDates, userId },
    }),
    prisma.goal.findMany({
      include: { plan: { select: { settings: true } } },
      where: { status: "active", userId },
    }),
  ]);

  const started = goals.map((goal) => ({
    goal,
    isExam: goal.kind === "exam",
    startDate: getDateInTimeZone({ date: goal.createdAt, timeZone: getAnswerTimeZone({ goal }) }),
    targetDate: goal.targetDate,
  }));

  // Days before a goal existed weren't days to study for it, so a new learner's week doesn't open
  // with days that read as missed, or as rest days they never chose.
  const getPlanDay = (date: Date): PlanDay => {
    const goalMinutes = started.reduce(
      (sum, { goal, startDate }) =>
        date < startDate
          ? sum
          : sum + getGoalDayMinutes({ date, goal, planSettings: goal.plan?.settings }),
      0,
    );

    return { goalMinutes, kind: getWeekDayKind({ date, goalMinutes, goals: started }) };
  };

  return getWeekDays({
    completedDates: completed.map((day) => day.localDate),
    days: days.map((day) => ({ date: day.date, seconds: day.timeSpentSeconds })),
    getPlanDay,
    today: session.localDate,
  });
}

/**
 * A lesson's minutes as the lesson itself says them (the lesson player shows the same), not the
 * estimate its block copied when the day was built, which a lesson written later can change.
 */
async function withLessonMinutes(view: StudySessionView): Promise<StudySessionView> {
  const lessonIds = view.blocks.flatMap((block) =>
    block.kind === "learn" && block.lessonId ? [block.lessonId] : [],
  );

  if (lessonIds.length === 0) {
    return view;
  }

  const lessons = await prisma.lesson.findMany({
    select: { estimatedMinutes: true, id: true },
    where: { estimatedMinutes: { gt: 0 }, id: { in: lessonIds } },
  });

  const minutes = new Map(lessons.map((lesson) => [lesson.id, lesson.estimatedMinutes]));

  return {
    ...view,
    blocks: view.blocks.map((block) => {
      const lessonMinutes = block.lessonId ? minutes.get(block.lessonId) : undefined;

      return lessonMinutes && block.kind === "learn"
        ? { ...block, estimatedMinutes: Math.max(1, Math.round(lessonMinutes)) }
        : block;
    }),
  };
}

/**
 * Why a session with no blocks has none, when its day has study time: the plan still outlines the
 * lessons it waits for (its stand-ins, `isWritingItem`), which land in the day on their own, or it
 * has no new lesson left for the day, which no wait would change.
 */
async function loadEmptyDay({
  dayMinutes,
  session,
}: {
  dayMinutes: number;
  session: StudySessionRow;
}): Promise<EmptyDay | null> {
  if (session.blocks.length > 0 || dayMinutes === 0 || !session.goalId) {
    return null;
  }

  const coming = await prisma.planItem.count({
    where: {
      chapterId: null,
      kind: "lesson",
      lessonId: null,
      plan: { goalId: session.goalId },
      status: "todo",
    },
  });

  return coming > 0 ? "lessonsComing" : "nothingNew";
}

/**
 * Whether the day holds time for lessons still being outlined: it's the learner's day, not done,
 * with time left for a lesson, and lessons due by then are stand-ins (`hasStandInsDue`), which
 * join its end once they land (`refreshDayFromPlan`).
 */
async function loadLessonsComing({
  current,
  dayMinutes,
  session,
}: {
  current: boolean;
  dayMinutes: number;
  session: StudySessionRow;
}): Promise<boolean> {
  const hasTime = dayMinutes - session.plannedMinutes >= DEFAULT_LESSON_MINUTES;

  if (!current || !hasTime || session.status === "completed" || !session.goalId) {
    return false;
  }

  const waiting = await prisma.planItem.findFirst({
    select: { id: true },
    where: {
      chapterId: null,
      kind: "lesson",
      lessonId: null,
      plan: { goalId: session.goalId },
      scheduledFor: { lte: session.localDate },
      skillId: { not: null },
      status: "todo",
    },
  });

  return waiting !== null;
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
  const [
    answers,
    fixedToday,
    week,
    dailyLimit,
    allowance,
    plan,
    oftenTestedSkillIds,
    blockSubjects,
  ] = await Promise.all([
    loadSessionAnswers({ blocks: session.blocks, sessionId: session.id, userId }),
    countMistakesFixedToday({ localDate: session.localDate, timeZone, userId }),
    loadWeek({ session, userId }),
    getDailyTimeLimitStatus(),
    getAllowance(),
    session.goalId
      ? prisma.plan.findUnique({ select: { settings: true }, where: { goalId: session.goalId } })
      : null,
    loadOftenTestedSkillIds(session.goal),
    loadBlockSubjects({ blocks: session.blocks, goal: session.goal }),
  ]);

  const answeredItemIds = new Set(
    answers.flatMap((answer) => (answer.itemId ? [answer.itemId] : [])),
  );

  const dayMinutes = session.goal
    ? getGoalDayMinutes({
        date: session.localDate,
        goal: session.goal,
        planSettings: plan?.settings,
      })
    : 0;

  const current = isCurrentSession({ now: new Date(), session, timeZone });

  const [emptyDay, lessonsComing] = await Promise.all([
    loadEmptyDay({ dayMinutes, session }),
    loadLessonsComing({ current, dayMinutes, session }),
  ]);

  const view = toStudySessionView({
    answers,
    blockSubjects,
    current,
    dailyLimit,
    dayMinutes,
    emptyDay,
    examAccess: session.goal
      ? getExamPrepAccess({
          examPrep: allowance?.examPrep ?? null,
          goal: session.goal,
          timeZone,
          today: session.localDate,
        })
      : { includesMockExams: true, trialEnded: false },
    lessonsComing,
    missions: getSessionMissions({ answeredItemIds, blocks: session.blocks, fixedToday }),
    oftenTestedSkillIds,
    session,
    week,
  });

  const [extraTime, withMinutes, catchUp] = await Promise.all([
    withExtraStudyCheck({ extraTime: view.extraTime, session, userId }),
    withLessonMinutes(view),
    loadCatchUpView({ blocks: session.blocks, goalId: session.goalId, userId }),
  ]);

  return { ...withMinutes, catchUp, extraTime };
}

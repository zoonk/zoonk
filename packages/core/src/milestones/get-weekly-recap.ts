import "server-only";
import { type Goal, type MasteryState, type Milestone, prisma } from "@zoonk/db";
import { MS_PER_DAY, parseLocalDate } from "@zoonk/utils/date";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { getLocalDateInstants, getStartOfLocalDay } from "../learner/_utils/local-time";
import { findOwnedGoal, getAnswerTimeZone } from "../learner/_utils/owned-goal";
import { getStartOfWeek } from "../plans/planner/plan-calendar";
import { type StudyWeek, loadStudyWeekPair } from "../progress/_utils/load-study-week";
import { loadTomorrow } from "../sessions/_utils/load-summary-parts";
import { type WeekDay, getWeekDays } from "../sessions/daily-goal";
import { getSession } from "../users/get-session";
import { type BuddyDiet, loadBuddyDiet } from "./_utils/buddy-diet";
import { loadPhasesFinished } from "./_utils/recap-goal";
import { type WeeklyRecapInput } from "./contract";
import {
  type Turnaround,
  type WeekNumbers,
  compareWeeks,
  findBiggestTurnaround,
  summarizeWeek,
  summarizeWeekTotals,
} from "./weekly-recap";

const DAYS_PER_WEEK = 7;
const SUNDAY_OFFSET = 6;

type TurnaroundReason = "gold" | "practice" | "solid";

type WeeklyRecap = {
  badges: Milestone[];
  days: WeekDay[];
  comparison: ReturnType<typeof compareWeeks>;
  lastWeek: WeekNumbers;
  nextFocus: { title: string } | null;
  buddyAte: BuddyDiet;
  phasesFinished: { name: string; phase: number }[];
  /** The recap is ready on Sunday; before that the week is still being written. */
  ready: boolean;
  turnaround: (Turnaround & { name: string; reason: TurnaroundReason; state: MasteryState }) | null;
  week: WeekNumbers;
  weekEnd: Date;
  weekStart: Date;
};

export type WeeklyRecapResult =
  | { recap: WeeklyRecap; status: "ready" }
  | { status: "notFound" }
  | { status: "unauthorized" };

function getReason(state: MasteryState): TurnaroundReason {
  if (state === "mastered") {
    return "gold";
  }

  return state === "solid" ? "solid" : "practice";
}

async function loadTurnaround({ userId, weekStart }: { userId: string; weekStart: Date }) {
  const weekDates = {
    gte: weekStart,
    lt: new Date(weekStart.getTime() + DAYS_PER_WEEK * MS_PER_DAY),
  };

  const answers = await prisma.attempt.findMany({
    select: { answeredAt: true, isCorrect: true, localDate: true, skillId: true },
    where: {
      answeredAt: getLocalDateInstants({ from: weekDates.gte, until: weekDates.lt }),
      localDate: weekDates,
      skillId: { not: null },
      userId,
    },
  });

  const turnaround = findBiggestTurnaround({
    answers: answers.flatMap((answer) =>
      answer.skillId ? [{ ...answer, skillId: answer.skillId }] : [],
    ),
    weekStart,
  });

  if (!turnaround) {
    return null;
  }

  const [skill, memory] = await Promise.all([
    prisma.skill.findUnique({ select: { name: true }, where: { id: turnaround.skillId } }),
    prisma.learnerSkill.findUnique({
      select: { state: true },
      where: { userSkill: { skillId: turnaround.skillId, userId } },
    }),
  ]);

  const state = memory?.state ?? "learning";
  return { ...turnaround, name: skill?.name ?? "", reason: getReason(state), state };
}

function toWeekNumbers(studyWeek: StudyWeek): WeekNumbers {
  return summarizeWeekTotals({
    ...studyWeek.totals,
    daysStudied: studyWeek.days.filter((day) => day.studied).map((day) => day.date),
  });
}

async function loadWeeks({
  goal,
  userId,
  weekStart,
  today,
}: {
  goal: Goal | null;
  userId: string;
  weekStart: Date;
  today: Date;
}) {
  if (goal) {
    const pair = await loadStudyWeekPair({ goal, localDate: today, weekStart });
    const week = toWeekNumbers(pair.week);
    const lastWeek = toWeekNumbers(pair.lastWeek);

    return {
      comparison: compareWeeks({ current: week, previous: lastWeek }),
      days: pair.week.days,
      lastWeek,
      week,
    };
  }

  const lastWeekStart = new Date(weekStart.getTime() - DAYS_PER_WEEK * MS_PER_DAY);

  const days = await prisma.dailyProgress.findMany({
    where: {
      date: { gte: lastWeekStart, lt: new Date(weekStart.getTime() + DAYS_PER_WEEK * MS_PER_DAY) },
      userId,
    },
  });

  const recapDays = days.map((day) => ({
    correct: day.correctAnswers,
    date: day.date,
    incorrect: day.incorrectAnswers,
    seconds: day.timeSpentSeconds,
  }));

  const week = summarizeWeek({ days: recapDays, weekStart });
  const lastWeek = summarizeWeek({ days: recapDays, weekStart: lastWeekStart });

  return {
    comparison: compareWeeks({ current: week, previous: lastWeek }),
    days: getWeekDays({
      days: recapDays,
      getPlanDay: () => ({ goalMinutes: 0, kind: "rest" }),
      today,
      weekStart,
    }),
    lastWeek,
    week,
  };
}

/** Before Sunday, default to last week; new learners use their first week, marked not ready until Sunday. */
async function getDefaultWeekStart({
  goal,
  today,
  userId,
}: {
  goal: Goal | null;
  today: Date;
  userId: string;
}): Promise<Date> {
  const currentWeekStart = getStartOfWeek(today);
  const isSunday = today.getTime() >= currentWeekStart.getTime() + SUNDAY_OFFSET * MS_PER_DAY;

  if (isSunday) {
    return currentWeekStart;
  }

  if (goal) {
    const where = { goalId: goal.id, localDate: { lt: currentWeekStart }, userId };

    const [study, finished] = await Promise.all([
      prisma.learningEvent.findFirst({
        select: { id: true },
        where: { ...where, kind: { not: "session" }, seconds: { gt: 0 } },
      }),
      prisma.studySession.findFirst({
        select: { id: true },
        where: { ...where, endedAt: { not: null } },
      }),
    ]);

    return study || finished
      ? new Date(currentWeekStart.getTime() - DAYS_PER_WEEK * MS_PER_DAY)
      : currentWeekStart;
  }

  const studiedBefore = await prisma.dailyProgress.findFirst({
    select: { id: true },
    where: { date: { lt: currentWeekStart }, timeSpentSeconds: { gt: 0 }, userId },
  });

  return studiedBefore
    ? new Date(currentWeekStart.getTime() - DAYS_PER_WEEK * MS_PER_DAY)
    : currentWeekStart;
}

/** Defaults to the last finished week; a prefetched recap retains the day it was read. */
export async function getWeeklyRecap(input: WeeklyRecapInput): Promise<WeeklyRecapResult> {
  "use cache: private";

  const session = await getSession();

  if (!session) {
    return { status: "unauthorized" };
  }

  const owned = input.goalId ? await findOwnedGoal(input.goalId) : null;

  if (owned && owned.status !== "ready") {
    return owned;
  }

  const userId = session.user.id;
  const goal = owned?.status === "ready" ? owned.goal : null;
  const timeZone = getAnswerTimeZone({ goal, timeZone: input.timeZone });
  const today = getDateInTimeZone({ date: new Date(), timeZone });

  const weekStart = input.weekStart
    ? getStartOfWeek(parseLocalDate(input.weekStart))
    : await getDefaultWeekStart({ goal, today, userId });

  const weekEnd = new Date(weekStart.getTime() + SUNDAY_OFFSET * MS_PER_DAY);
  const from = getStartOfLocalDay({ localDate: weekStart, timeZone });
  const to = getStartOfLocalDay({ localDate: new Date(weekEnd.getTime() + MS_PER_DAY), timeZone });

  const [weeks, turnaround, badges, buddyAte, phasesFinished, nextFocus] = await Promise.all([
    loadWeeks({ goal, today, userId, weekStart }),
    loadTurnaround({ userId, weekStart }),
    prisma.milestone.findMany({
      orderBy: { earnedAt: "asc" },
      where: { earnedAt: { gte: from, lt: to }, kind: "badge", userId },
    }),
    loadBuddyDiet({ from, to, userId }),
    goal ? loadPhasesFinished({ from, goalId: goal.id, to }) : [],
    loadTomorrow({ session: { goal, goalId: goal?.id ?? null, localDate: today } }),
  ]);

  return {
    recap: {
      ...weeks,
      badges,
      buddyAte,
      nextFocus,
      phasesFinished,
      ready: today.getTime() >= weekEnd.getTime(),
      turnaround,
      weekEnd,
      weekStart,
    },
    status: "ready",
  };
}

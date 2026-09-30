import "server-only";
import { type MasteryState, type Milestone, prisma } from "@zoonk/db";
import { MS_PER_DAY, parseLocalDate } from "@zoonk/utils/date";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { getStartOfLocalDay } from "../learner/_utils/local-time";
import { findOwnedGoal, getAnswerTimeZone } from "../learner/_utils/owned-goal";
import { getStartOfWeek } from "../plans/planner/plan-calendar";
import { loadTomorrow } from "../sessions/_utils/load-summary-parts";
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
} from "./weekly-recap";

const DAYS_PER_WEEK = 7;
const SUNDAY_OFFSET = 6;

/** Why the turnaround happened, in the learner's terms: a gold card, a Solid skill, or practice. */
type TurnaroundReason = "gold" | "practice" | "solid";

/**
 * The week as a logbook: the learner's numbers against their own last week, the biggest
 * turnaround and why, badges earned, what the buddy ate, phases finished and next week's focus.
 * Written from templates in the apps; nothing here calls a model.
 */
type WeeklyRecap = {
  badges: Milestone[];
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
  const answers = await prisma.attempt.findMany({
    select: { answeredAt: true, isCorrect: true, localDate: true, skillId: true },
    where: {
      localDate: { gte: weekStart, lt: new Date(weekStart.getTime() + DAYS_PER_WEEK * MS_PER_DAY) },
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

async function loadWeeks({ userId, weekStart }: { userId: string; weekStart: Date }) {
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

  return { comparison: compareWeeks({ current: week, previous: lastWeek }), lastWeek, week };
}

/** The Sunday logbook for one week (the current one by default), the same data in both modes. */
export async function getWeeklyRecap(input: WeeklyRecapInput): Promise<WeeklyRecapResult> {
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
  const weekStart = getStartOfWeek(input.weekStart ? parseLocalDate(input.weekStart) : today);
  const weekEnd = new Date(weekStart.getTime() + SUNDAY_OFFSET * MS_PER_DAY);
  const from = getStartOfLocalDay({ localDate: weekStart, timeZone });
  const to = getStartOfLocalDay({ localDate: new Date(weekEnd.getTime() + MS_PER_DAY), timeZone });

  const [weeks, turnaround, badges, buddyAte, phasesFinished, nextFocus] = await Promise.all([
    loadWeeks({ userId, weekStart }),
    loadTurnaround({ userId, weekStart }),
    prisma.milestone.findMany({
      orderBy: { earnedAt: "asc" },
      where: { earnedAt: { gte: from, lt: to }, kind: "badge", userId },
    }),
    loadBuddyDiet({ from, to, userId }),
    goal ? loadPhasesFinished({ from, goalId: goal.id, to }) : [],
    loadTomorrow(goal?.id ?? null),
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

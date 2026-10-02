import "server-only";
import { type Goal, prisma } from "@zoonk/db";
import { MS_PER_DAY } from "@zoonk/utils/date";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { getSession } from "../users/get-session";
import { loadGoalSkillIds } from "./_utils/goal-skill-graph";
import { getStartOfLocalDay } from "./_utils/local-time";
import { findOwnedGoal, getAnswerTimeZone } from "./_utils/owned-goal";
import { type ReviewScheduleInput } from "./contract";
import { getSkillRetrievability } from "./fsrs-scheduler";
import {
  type ReviewCandidate,
  forecastReviewLoad,
  getDailyReviewCap,
  selectDueReviews,
} from "./review-load";

/** A week of review load: enough for "Opens Friday" and the plan's view of this week. */
const FORECAST_DAYS = 7;

/** The daily time new goals start with, used for the cap when no goal is given. */
const DEFAULT_DAILY_MINUTES = 20;

type ReviewSchedule = {
  /** Most skills one day's reviews hold at the goal's daily time. */
  cap: number;
  /** Today's reviews, most at risk of being forgotten first. */
  dueToday: { due: Date | null; name: string; retrievability: number | null; skillId: string }[];
  /** Reviews per learner-local day from today, overdue ones spread under the cap. */
  forecast: { localDate: Date; reviews: number }[];
};

export type ReviewScheduleResult =
  | { schedule: ReviewSchedule; status: "ready" }
  | { status: "notFound" }
  | { status: "unauthorized" };

async function resolveGoal(goalId: string | undefined) {
  if (!goalId) {
    return { goal: null };
  }

  const owned = await findOwnedGoal(goalId);
  return owned.status === "ready" ? { goal: owned.goal } : null;
}

async function loadCandidates({ goal, userId }: { goal: Goal | null; userId: string }) {
  const skillIds = goal ? await loadGoalSkillIds(goal.id) : null;

  const rows = await prisma.learnerSkill.findMany({
    include: { skill: { select: { name: true } } },
    where: {
      due: { not: null },
      reps: { gt: 0 },
      userId,
      ...(skillIds ? { skillId: { in: skillIds } } : {}),
    },
  });

  return rows.map((row) => ({ memory: row, name: row.skill.name, skillId: row.skillId }));
}

/**
 * Returns the learner's review schedule: what is due today (never more than the daily cap, most at
 * risk first) and the load of the coming days. Missed days re-flow: overdue skills fill the next
 * days under the cap instead of piling onto one.
 */
export async function getCurrentUserReviewSchedule(
  input: ReviewScheduleInput,
): Promise<ReviewScheduleResult> {
  const session = await getSession();

  if (!session) {
    return { status: "unauthorized" };
  }

  const userId = session.user.id;
  const scope = await resolveGoal(input.goalId);

  if (!scope) {
    return { status: "notFound" };
  }

  const now = new Date();
  const timeZone = getAnswerTimeZone({ goal: scope.goal, timeZone: input.timeZone });
  const today = getDateInTimeZone({ date: now, timeZone });

  const endOfToday = getStartOfLocalDay({
    localDate: new Date(today.getTime() + MS_PER_DAY),
    timeZone,
  });

  const cap = getDailyReviewCap({
    dailyMinutes: scope.goal?.dailyMinutes ?? DEFAULT_DAILY_MINUTES,
  });

  const candidates = await loadCandidates({ goal: scope.goal, userId });
  const dueToday: ReviewCandidate[] = selectDueReviews({ candidates, cap, until: endOfToday });

  return {
    schedule: {
      cap,
      dueToday: dueToday.map(({ memory, skillId }) => ({
        due: memory.due,
        name: candidates.find((candidate) => candidate.skillId === skillId)?.name ?? "",
        retrievability: getSkillRetrievability({ memory, now }),
        skillId,
      })),
      forecast: forecastReviewLoad({ candidates, cap, days: FORECAST_DAYS, from: today, timeZone }),
    },
    status: "ready",
  };
}

import "server-only";
import { type Goal, prisma } from "@zoonk/db";
import { MS_PER_DAY } from "@zoonk/utils/date";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { getSession } from "../users/get-session";
import { loadGoalSkillIds } from "./_utils/goal-skill-graph";
import { getStartOfLocalDay } from "./_utils/local-time";
import { getAnswerTimeZone } from "./_utils/owned-goal";
import { type ReviewScheduleInput } from "./contract";
import { getRequestInstant } from "./facts/request-instant";
import { getSkillRetrievability } from "./fsrs-scheduler";
import { getOwnedGoal } from "./get-owned-goal";
import {
  type ReviewCandidate,
  forecastReviewLoad,
  getDailyReviewCap,
  selectDueReviews,
} from "./review-load";

const FORECAST_DAYS = 7;

const DEFAULT_DAILY_MINUTES = 20;

type ReviewSchedule = {
  cap: number;
  /** Lowest retrievability first. */
  dueToday: { due: Date | null; name: string; retrievability: number | null; skillId: string }[];
  /** Local-day counts from today; overdue work is spread under the daily cap. */
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

  const owned = await getOwnedGoal(goalId);
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

/** Never exceeds the daily cap; overdue reviews spread over later days rather than piling onto today. */
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

  const now = await getRequestInstant();
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

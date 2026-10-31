import "server-only";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { findActiveGoalId } from "../../goals/_utils/goal-view";
import { findOwnedGoal, getAnswerTimeZone } from "../../learner/_utils/owned-goal";
import { toIsoDate } from "../../plans/planner/plan-calendar";
import { getSession } from "../../users/get-session";
import { type TodayStudySessionInput } from "../contract";
import { type StudySessionResult } from "../get-study-session";
import { openStudyDay } from "../open-study-day";

type TodayStudySessionResult = StudySessionResult | { status: "goalNotActive" };

/** Test-only POST adapter; never use to model a read-only Today GET. */
export async function getTodayStudySession(
  input: TodayStudySessionInput,
): Promise<TodayStudySessionResult> {
  const session = await getSession();

  if (!session) {
    return { status: "unauthorized" };
  }

  const goalId = input.goalId ?? (await findActiveGoalId(session.user.id));

  if (!goalId) {
    return { status: "notFound" };
  }

  const owned = await findOwnedGoal(goalId);

  if (owned.status !== "ready") {
    return owned;
  }

  if (owned.goal.status !== "active") {
    return { status: "goalNotActive" };
  }

  const timeZone = getAnswerTimeZone({ goal: owned.goal, timeZone: input.timeZone });

  const opened = await openStudyDay({
    goalId,
    keepEmpty: true,
    shownDate: toIsoDate(getDateInTimeZone({ date: new Date(), timeZone })),
    timeZone: input.timeZone,
  });

  if (opened.status !== "opened") {
    throw new Error(`Expected the test learner's day to open, received ${opened.status}`);
  }

  return { session: opened.session, status: "ready" };
}

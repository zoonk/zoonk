import "server-only";
import { type GoalKind } from "@zoonk/db";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { getAnswerTimeZone } from "../../learner/_utils/owned-goal";
import { getGoalPlan } from "../../plans/get-goal-plan";
import { type PlanView } from "../../plans/plan-view-contract";
import { loadStudyWeek } from "../../progress/_utils/load-study-week";
import { type WeeklyStudyTime } from "../../progress/weekly-study-time-contract";
import { getSession } from "../../users/get-session";
import { resolveViewGoal } from "../_utils/resolve-view-goal";

type PlanTabView = {
  goal: { id: string; kind: GoalKind; title: string };
  plan: PlanView;
  weekTime: WeeklyStudyTime;
};

export type PlanTabViewResult =
  | { status: "noGoal" | "notFound" | "unauthorized" }
  | { status: "ready"; view: PlanTabView };

/**
 * The Plan tab for a goal (the active goal by default): the goal's header and its plan at every
 * zoom level. One cached read, so the tab prefetches whole.
 */
export async function getPlanTabView(input: { goalId?: string } = {}): Promise<PlanTabViewResult> {
  "use cache: private";

  const [resolved, session] = await Promise.all([resolveViewGoal(input.goalId), getSession()]);

  if (resolved.status !== "ready") {
    return resolved;
  }

  if (!session) {
    return { status: "unauthorized" };
  }

  const { goal } = resolved;

  const [result, week] = await Promise.all([
    getGoalPlan(goal.id),
    loadStudyWeek({
      localDate: getDateInTimeZone({ date: new Date(), timeZone: getAnswerTimeZone({ goal }) }),
      userId: session.user.id,
    }),
  ]);

  if (result.status !== "ready") {
    return result;
  }

  return {
    status: "ready",
    view: {
      goal: { id: goal.id, kind: goal.kind, title: goal.title },
      plan: result.plan,
      weekTime: week.time,
    },
  };
}

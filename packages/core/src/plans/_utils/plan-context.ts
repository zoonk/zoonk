import "server-only";
import { type Goal, type Plan, prisma } from "@zoonk/db";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { getAnswerTimeZone } from "../../learner/_utils/owned-goal";
import { fromIsoDate, toIsoDate } from "../planner/plan-calendar";
import { type ExistingPlanItem } from "../planner/plan-items";
import {
  type PlanState,
  parsePlanGraph,
  parsePlanPhases,
  parsePlanSettings,
} from "../planner/plan-state";

/** Everything a planning run starts from: the goal, its plan and items, and the learner's today. */
export type PlanContext = {
  goal: Goal;
  items: ExistingPlanItem[];
  plan: Pick<Plan, "coveredShare" | "estimateHours" | "id" | "noticeWaitUntil" | "version">;
  phases: ReturnType<typeof parsePlanPhases>;
  state: PlanState;
  timeZone: string;
  today: Date;
};

const itemSelect = {
  chapterId: true,
  completedAt: true,
  id: true,
  kind: true,
  lessonId: true,
  phase: true,
  position: true,
  scheduledFor: true,
  skillId: true,
  status: true,
  titleSnapshot: true,
} as const;

/** What an undo restores and a change edits: the goal's time, the graph and the settings. */
function getPlanState({
  goal,
  plan,
}: {
  goal: Pick<Goal, "dailyMinutes" | "targetDate">;
  plan: Pick<Plan, "graph" | "settings">;
}): PlanState {
  return {
    goal: {
      dailyMinutes: goal.dailyMinutes,
      targetDate: goal.targetDate ? toIsoDate(goal.targetDate) : null,
    },
    graph: parsePlanGraph(plan.graph),
    settings: parsePlanSettings(plan.settings),
  };
}

export function getStateTargetDate(state: PlanState): Date | null {
  return state.goal.targetDate ? fromIsoDate(state.goal.targetDate) : null;
}

/**
 * Loads a goal's plan for a planning run, with "today" in the learner's timezone: the request's,
 * then the goal's, then UTC. Null when the goal has no plan yet.
 */
export async function loadPlanContext({
  goal,
  now = new Date(),
  timeZone,
}: {
  goal: Goal;
  now?: Date;
  timeZone?: string | null;
}): Promise<PlanContext | null> {
  const plan = await prisma.plan.findUnique({
    include: { items: { orderBy: { position: "asc" }, select: itemSelect } },
    where: { goalId: goal.id },
  });

  if (!plan) {
    return null;
  }

  const zone = getAnswerTimeZone({ goal, timeZone });

  return {
    goal,
    items: plan.items,
    phases: parsePlanPhases(plan.phases),
    plan: {
      coveredShare: plan.coveredShare,
      estimateHours: plan.estimateHours,
      id: plan.id,
      noticeWaitUntil: plan.noticeWaitUntil,
      version: plan.version,
    },
    state: getPlanState({ goal, plan }),
    timeZone: zone,
    today: getDateInTimeZone({ date: now, timeZone: zone }),
  };
}

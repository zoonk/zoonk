import "server-only";
import { type Goal, type Plan, type PlanItem, prisma } from "@zoonk/db";
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
import { readSelectedItemFacts } from "./selected-item-contract";

export type ContextPlanItem = ExistingPlanItem & {
  facts?: PlanItem["facts"];
  minutes?: number | null;
};

export type PlanContext = {
  goal: Goal;
  items: ContextPlanItem[];
  plan: Pick<
    Plan,
    | "coveredShare"
    | "estimateHours"
    | "id"
    | "inputsKey"
    | "inputVersion"
    | "noticeWaitUntil"
    | "sourceSkillIds"
    | "summary"
    | "version"
  >;
  phases: ReturnType<typeof parsePlanPhases>;
  state: PlanState;
  timeZone: string;
  today: Date;
};

const itemSelect = {
  chapterId: true,
  completedAt: true,
  facts: true,
  id: true,
  kind: true,
  lessonId: true,
  lessons: true,
  minutes: true,
  phase: true,
  position: true,
  scheduledFor: true,
  skillId: true,
  status: true,
  titleSnapshot: true,
} as const;

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
    items: plan.items.map((item) => ({ ...item, facts: readSelectedItemFacts(item.facts) })),
    phases: parsePlanPhases(plan.phases),
    plan: {
      coveredShare: plan.coveredShare,
      estimateHours: plan.estimateHours,
      id: plan.id,
      inputVersion: plan.inputVersion,
      inputsKey: plan.inputsKey,
      noticeWaitUntil: plan.noticeWaitUntil,
      sourceSkillIds: plan.sourceSkillIds,
      summary: plan.summary,
      version: plan.version,
    },
    state: getPlanState({ goal, plan }),
    timeZone: zone,
    today: getDateInTimeZone({ date: now, timeZone: zone }),
  };
}

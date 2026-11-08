import "server-only";
import { type Goal, type Plan, type PlanItem, prisma } from "@zoonk/db";
import { isJsonObject } from "@zoonk/utils/json";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { readLanguageAim } from "../../language/aims/language-aims";
import { getAnswerTimeZone } from "../../learner/_utils/owned-goal";
import { type SavedPlan } from "../../learner/facts/saved-plan";
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
    | "sourceVersion"
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

/** The same item fields whether the plan was read here or by `readSavedPlan`. */
function toContextItem(item: Pick<PlanItem, keyof typeof itemSelect>): ContextPlanItem {
  return {
    chapterId: item.chapterId,
    completedAt: item.completedAt,
    facts: readSelectedItemFacts(item.facts),
    id: item.id,
    kind: item.kind,
    lessonId: item.lessonId,
    lessons: item.lessons,
    minutes: item.minutes,
    phase: item.phase,
    position: item.position,
    scheduledFor: item.scheduledFor,
    skillId: item.skillId,
    status: item.status,
    titleSnapshot: item.titleSnapshot,
  };
}

export function getPlanState({
  goal,
  plan,
}: {
  goal: Pick<Goal, "dailyMinutes" | "details" | "kind" | "targetDate">;
  plan: Pick<Plan, "graph" | "settings">;
}): PlanState {
  return {
    goal: {
      aim:
        goal.kind === "language" && isJsonObject(goal.details)
          ? readLanguageAim(goal.details)
          : null,
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

function loadPlan(goalId: string) {
  return prisma.plan.findUnique({
    include: { items: { orderBy: { position: "asc" }, select: itemSelect } },
    where: { goalId },
  });
}

export async function loadPlanContext({
  goal,
  now = new Date(),
  saved,
  timeZone,
}: {
  goal: Goal;
  now?: Date;
  /** A GET's `readSavedPlan` row, so the request reads the plan once; writes leave it out. */
  saved?: SavedPlan | null;
  timeZone?: string | null;
}): Promise<PlanContext | null> {
  const plan = saved === undefined ? await loadPlan(goal.id) : saved;

  if (!plan) {
    return null;
  }

  const zone = getAnswerTimeZone({ goal, timeZone });

  return {
    goal,
    items: plan.items.map((item) => toContextItem(item)),
    phases: parsePlanPhases(plan.phases),
    plan: {
      coveredShare: plan.coveredShare,
      estimateHours: plan.estimateHours,
      id: plan.id,
      inputVersion: plan.inputVersion,
      inputsKey: plan.inputsKey,
      noticeWaitUntil: plan.noticeWaitUntil,
      sourceSkillIds: plan.sourceSkillIds,
      sourceVersion: plan.sourceVersion,
      summary: plan.summary,
      version: plan.version,
    },
    state: getPlanState({ goal, plan }),
    timeZone: zone,
    today: getDateInTimeZone({ date: now, timeZone: zone }),
  };
}

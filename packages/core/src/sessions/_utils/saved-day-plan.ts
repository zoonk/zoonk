import "server-only";
import { type Goal } from "@zoonk/db";
import { type GoalPlanSource } from "../../learner/_utils/goal-skill-graph";
import { type SavedPlan } from "../../learner/facts/saved-plan";
import { type PlanCarrySnapshot } from "../../plans/_utils/carried-lessons";
import { loadLeftWorkSelection } from "../../plans/_utils/left-work";
import { type PlanContext, loadPlanContext } from "../../plans/_utils/plan-context";
import { addsLessonsAfterLessonsDone } from "../../plans/_utils/plan-refresh-admission";
import { readPlanSummary } from "../../plans/_utils/plan-summary";
import { computePlan } from "../../plans/_utils/replan";
import { type SelectedSummary } from "../../plans/_utils/selected-summary-contract";
import { type PlannedStudyDay } from "./plan-study-day";
import { type SelectedDayPlan } from "./selected-day-plan";
import { getSessionItemIdentity } from "./session-plan-item";
import { dropSettledEvents } from "./settled-events";

export function toSource({
  items,
  phases,
  state,
}: Pick<SelectedDayPlan, "items" | "phases" | "state">): GoalPlanSource {
  return {
    graph: state.graph,
    items: items.map((item) => ({ ...item, id: getSessionItemIdentity(item) })),
    phases,
    settings: state.settings,
  };
}

export function savedSelection({
  context,
  summary,
}: {
  context: PlanContext;
  summary: SelectedSummary | null;
}): SelectedDayPlan {
  const items = context.items.map((item) => ({
    ...item,
    facts: item.facts ?? null,
    lessons: item.lessons ?? null,
    minutes: item.minutes ?? null,
  }));

  const state = context.state;
  const phases = context.phases;

  return {
    computed: null,
    context,
    items,
    left: [],
    phases,
    source: toSource({ items, phases, state }),
    state,
    summary,
  };
}

function selectSavedDay({
  context,
  left,
  summary,
}: {
  context: PlanContext;
  left: PlanContext["items"];
  summary: SelectedSummary | null;
}): SelectedDayPlan {
  const selection = savedSelection({ context, summary });

  const items = dropSettledEvents({
    items: selection.items,
    settings: context.state.settings,
    today: context.today,
  });

  return { ...selection, items, left, source: toSource({ ...selection, items }) };
}

function listOpenedKeys(day: PlannedStudyDay): string[] {
  return day.blocks.flatMap((block) =>
    block.payload.planItemKey ? [block.payload.planItemKey] : [],
  );
}

/** Start plans the saved day first, so the settle keeps that day whole on today and dates the rest around it. */
export async function settleAroundSavedDay({
  context,
  left,
  now,
  planDay,
  snapshot,
  summary,
}: {
  context: PlanContext;
  left: PlanContext["items"];
  now: Date;
  planDay?: (selection: SelectedDayPlan) => Promise<PlannedStudyDay>;
  snapshot: PlanCarrySnapshot;
  summary: SelectedSummary | null;
}): Promise<SelectedDayPlan> {
  const day = selectSavedDay({ context, left, summary });
  const opened = planDay && (await planDay(day));

  const computed = await computePlan({
    carrySnapshot: snapshot,
    context,
    keepPhaseDates: true,
    mode: "forced",
    now,
    openedKeys: opened && listOpenedKeys(opened),
    setAsideLeftWork: true,
    todayShown: true,
  });

  // A day rollover alone cannot add lessons after teaching finished.
  if (addsLessonsAfterLessonsDone({ computed, context })) {
    return { ...day, left: [], opened, retained: computed };
  }

  return { ...day, computed, opened, summary: computed.selected };
}

/** Read-only replay of the saved allocation, including unfinished work regardless of freshness. */
export async function readSavedDayPlan({
  goal,
  now,
  saved,
  timeZone,
}: {
  goal: Goal;
  now: Date;
  saved: SavedPlan | null;
  timeZone: string;
}): Promise<SelectedDayPlan | null> {
  const context = await loadPlanContext({ goal, now, saved, timeZone });

  if (!context || context.items.length === 0) {
    return null;
  }

  const summary =
    readPlanSummary({ plan: { ...context.plan, userId: goal.userId }, value: context.plan.summary })
      ?.selected ?? null;

  const { left } = await loadLeftWorkSelection(context);

  return left.length > 0
    ? selectSavedDay({ context, left, summary })
    : savedSelection({ context, summary });
}

import { type Goal } from "@zoonk/db";
import { getDaysToExam } from "../../exams/final-stretch/final-stretch-rules";
import { LEARN_KINDS, isWritingItem } from "../../plans/planner/plan-item-rules";
import { getFreshStart } from "../fresh-start";
import { getPracticeShare } from "../practice-share";
import { type PlannedBlock } from "../session-builder";
import { getUnwrittenMinutesOn } from "./day-lessons";
import { type loadDayPlan } from "./day-plan";
import { getTestSkillIds } from "./review-skills";
import { type SessionPlanItem } from "./session-plan-item";

function isNewPhase({
  blocks,
  items,
}: {
  blocks: readonly PlannedBlock[];
  items: readonly SessionPlanItem[];
}): boolean {
  const first = blocks.find((block) => block.kind === "learn" || block.kind === "checkpoint");

  const firstItem = items.find(
    (item) =>
      (item.id !== null && item.id === first?.payload.planItemId) ||
      (item.key !== undefined && item.key === first?.payload.planItemKey),
  );

  const phase =
    firstItem && LEARN_KINDS.has(firstItem.kind) && !isWritingItem(firstItem)
      ? firstItem.phase
      : undefined;

  return (
    phase !== undefined &&
    phase > 0 &&
    items.every((item) => item.phase !== phase || item.status === "todo")
  );
}

function getPlanProgress(items: readonly SessionPlanItem[]): number {
  return items.filter((item) => item.status !== "todo").length / Math.max(1, items.length);
}

export function getDayFreshStart({
  blocks = [],
  plan,
  today,
}: {
  blocks?: readonly PlannedBlock[];
  plan: Pick<
    Awaited<ReturnType<typeof loadDayPlan>>,
    "isFirstDay" | "items" | "lastStudyDate" | "planStart"
  >;
  today: Date;
}) {
  return getFreshStart({
    isFirstDay: plan.isFirstDay,
    isNewPhase: isNewPhase({ blocks, items: plan.items }),
    lastStudyDate: plan.lastStudyDate,
    startDate: plan.planStart,
    today,
  });
}

export function getPlanTestSkillIds(plan: Awaited<ReturnType<typeof loadDayPlan>>): string[] {
  return getTestSkillIds({
    graph: plan.graph,
    planSkillIds: plan.skills.map((skill) => skill.id),
    settings: plan.settings,
  });
}

export function getDayWritingMinutes({
  reservedItems,
  today,
}: {
  reservedItems: readonly SessionPlanItem[];
  today: Date;
}): number {
  return getUnwrittenMinutesOn({ items: reservedItems, today });
}

export function getDayPracticeShare({
  goal,
  items,
  today,
}: {
  goal: Pick<Goal, "targetDate">;
  items: readonly SessionPlanItem[];
  today: Date;
}): number {
  return getPracticeShare({
    daysToExam: getDaysToExam({ targetDate: goal.targetDate, today }),
    planProgress: getPlanProgress(items),
  });
}

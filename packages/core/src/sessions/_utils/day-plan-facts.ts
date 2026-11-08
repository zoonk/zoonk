import { type Goal } from "@zoonk/db";
import { getDaysToExam } from "../../exams/final-stretch/final-stretch-rules";
import { LEARN_KINDS, isWritingItem } from "../../plans/planner/plan-item-rules";
import { getItemKey } from "../../plans/planner/plan-items";
import { getFreshStart } from "../fresh-start";
import { getPracticeShare } from "../practice-share";
import { type PlannedCheckpoint } from "../session-builder";
import { getUnwrittenMinutesOn } from "./day-lessons";
import { type loadDayPlan } from "./day-plan";
import { keepDuelLessons, markLessonsAroundChallenges } from "./lessons-before-challenges";
import { getTestSkillIds } from "./review-skills";
import { type SessionPlanItem } from "./session-plan-item";

function isNewPhase(items: readonly SessionPlanItem[]): boolean {
  const phase = items.find(
    (item) => LEARN_KINDS.has(item.kind) && item.status === "todo" && !isWritingItem(item),
  )?.phase;

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
  plan,
  today,
}: {
  plan: Pick<
    Awaited<ReturnType<typeof loadDayPlan>>,
    "isFirstDay" | "items" | "lastStudyDate" | "planStart"
  >;
  today: Date;
}) {
  return getFreshStart({
    isFirstDay: plan.isFirstDay,
    isNewPhase: isNewPhase(plan.items),
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
  checkpoints,
  items,
  reservedItems,
  today,
}: {
  checkpoints: readonly PlannedCheckpoint[];
  items: readonly SessionPlanItem[];
  reservedItems: readonly SessionPlanItem[];
  today: Date;
}): number {
  const writing = keepDuelLessons({
    checkpoints,
    lessons: markLessonsAroundChallenges({
      checkpoints,
      items,
      lessons: reservedItems.map((item) => ({
        ...item,
        planItemId: item.id,
        planItemKey: getItemKey(item),
      })),
      today,
    }),
  });

  return getUnwrittenMinutesOn({ items: writing, today });
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

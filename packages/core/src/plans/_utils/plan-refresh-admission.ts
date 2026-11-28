import { LEARN_KINDS } from "../planner/plan-item-rules";
import { type PlanContext } from "./plan-context";
import { areLessonsFinished } from "./plan-end";
import { type ComputedPlan } from "./replan";

export function isPlanLaidOut(context: PlanContext): boolean {
  return context.phases.some((phase) => phase.startDate !== null);
}

export function addsLessonsAfterLessonsDone({
  computed,
  context,
}: {
  computed: ComputedPlan;
  context: PlanContext;
}): boolean {
  const { goal, items, state } = context;

  if (!isPlanLaidOut(context) || context.phases.some((phase) => phase.later)) {
    return false;
  }

  const done = areLessonsFinished({
    items,
    studiesPastTarget: goal.kind === "exam" && state.settings.fullCourse,
    targetDate: goal.targetDate,
  });

  // Lessons a written skill's test-out stood in for still come back: only writing shows it.
  return (
    done &&
    computed.reopenedItemIds.length === 0 &&
    computed.built.items.some((item) => LEARN_KINDS.has(item.kind) && item.status === "todo")
  );
}

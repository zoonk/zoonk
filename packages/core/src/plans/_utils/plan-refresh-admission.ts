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

  if (!isPlanLaidOut(context)) {
    return false;
  }

  const done = areLessonsFinished({
    items,
    studiesPastTarget: goal.kind === "exam" && state.settings.fullCourse,
    targetDate: goal.targetDate,
  });

  return (
    done &&
    computed.built.items.some((item) => LEARN_KINDS.has(item.kind) && item.status === "todo")
  );
}

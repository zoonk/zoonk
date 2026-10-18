import { type PlanContext } from "./plan-context";
import { areLessonsFinished } from "./plan-end";
import { type ComputedPlan } from "./replan";

/**
 * The planner dated the plan's phases: a plan written but never laid out (no phase has a start
 * date; the learner saw only "Building your plan") has nothing a day build could move.
 */
export function isPlanLaidOut(context: PlanContext): boolean {
  return context.phases.some((phase) => phase.startDate !== null);
}

/**
 * Every lesson of a plan the learner saw laid out is done and the run would add some: no run the
 * learner didn't ask for does that. Pedro won his first challenge with every lesson done, and the
 * session's new pace added 4 lessons to his plan, so it went from 100% to 67% and never reached
 * "Finished". The Plan offers what the learner's time fits instead (see `loadFitOffer`). A plan
 * never laid out holds only what placement settled, and is laid out on its first read.
 */
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
    computed.built.items.some(
      (item) => (item.kind === "lesson" || item.kind === "chapter") && item.status === "todo",
    )
  );
}

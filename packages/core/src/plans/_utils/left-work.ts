import "server-only";
import { carriesGiven } from "../planner/carry-over";
import { loadCarryOver, loadTodaySettledItemIds } from "./carried-lessons";
import { type PlanContext } from "./plan-context";

const LEARN_KINDS = new Set(["chapter", "lesson"]);

/**
 * The work earlier days left that today doesn't start with yet: lessons due before today, a
 * phase's challenge due before today and still to play (the plan dates it again, so the day it
 * goes on holds it: Today played one beside a funded mock's day the plan didn't count it on), and
 * lessons the last study day gave the learner that the plan has after today. Once today settled
 * them (a new day's settling, or a resume, see `loadTodaySettle`), those that didn't fit today come
 * first tomorrow: they aren't left again. A new day settles it (see `refreshGoalPlan`), and so does
 * a goal back from a pause (see `computeResumedPlan`).
 */
export async function loadLeftWork(context: PlanContext): Promise<PlanContext["items"]> {
  const [carryOver, settledIds] = await Promise.all([
    loadCarryOver({ goalId: context.goal.id, today: context.today }),
    loadTodaySettledItemIds(context),
  ]);

  const given = new Set(settledIds === null ? carryOver.lessonIds : []);
  const carries = carriesGiven(context.items);
  const { today } = context;

  return context.items.filter(
    (item) =>
      item.status === "todo" &&
      (LEARN_KINDS.has(item.kind) || item.kind === "boss") &&
      item.scheduledFor !== null &&
      (item.scheduledFor < today ||
        (item.lessonId !== null &&
          given.has(item.lessonId) &&
          item.scheduledFor > today &&
          carries(item))),
  );
}

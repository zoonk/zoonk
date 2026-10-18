import { type PlanView } from "../plan-view-contract";
import { toIsoDate } from "../planner/plan-calendar";
import { type PlanReadContext } from "./plan-read-projection";
import { type ComputedPlan } from "./replan";

export const MINUTES_PER_HOUR = 60;

function toHours(minutes: number): number {
  return Math.round((minutes / MINUTES_PER_HOUR) * 10) / 10;
}

/**
 * The day the plan the Plan shows ends: its last item's, or the end of its time after the exam
 * when that's later, as the build that saved it says (see `PlanFeasibility.endDate`). Read from
 * the shown plan, so the change that saved it and the read after it say the same day: the read's
 * own rebuild laid an exam's time after it out again and ended it a week sooner.
 */
function getShownEnd(context: PlanReadContext): string | null {
  const dates = context.items.flatMap((item) =>
    item.scheduledFor ? [toIsoDate(item.scheduledFor)] : [],
  );

  const afterExam = context.phases.find((phase) => phase.kind === "afterExam")?.endDate;
  return [...dates, ...(afterExam ? [afterExam] : [])].toSorted().at(-1) ?? null;
}

/**
 * The plan's size and end (see `getShownEnd`). A plan without a graph (a seeded one) keeps the
 * estimate it was saved with.
 */
export function buildEstimateView({
  computed,
  context,
}: {
  computed: ComputedPlan | null;
  context: PlanReadContext;
}): PlanView["estimate"] {
  const pace = context.state.settings.pace;

  if (computed) {
    const { estimate } = computed.built;

    return {
      endDate: getShownEnd(context),
      pace,
      remainingHours: toHours(estimate.remainingMinutes),
      totalHours: toHours(estimate.totalMinutes),
    };
  }

  const { items } = context;
  const totalHours = context.plan.estimateHours ?? 0;
  const todo = items.filter((item) => item.status === "todo").length;

  return {
    endDate: getShownEnd(context),
    pace,
    remainingHours: items.length > 0 ? Math.round((totalHours * todo * 10) / items.length) / 10 : 0,
    totalHours: Math.round(totalHours * 10) / 10,
  };
}

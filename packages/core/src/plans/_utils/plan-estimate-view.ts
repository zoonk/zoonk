import { type PlanView } from "../plan-view-contract";
import { toIsoDate } from "../planner/plan-calendar";
import { type PlanContext } from "./plan-context";
import { type ComputedPlan } from "./replan";

export const MINUTES_PER_HOUR = 60;

function toHours(minutes: number): number {
  return Math.round((minutes / MINUTES_PER_HOUR) * 10) / 10;
}

function toIsoOrNull(date: Date | null): string | null {
  return date ? toIsoDate(date) : null;
}

/**
 * The plan's size and end. The end is the one the plan's graph sizes (see `PlanFeasibility`), so
 * it stays put while the Library outlines lessons. A plan without a graph (a seeded one) keeps the
 * estimate it was saved with and ends on its last item.
 */
export function buildEstimateView({
  computed,
  context,
}: {
  computed: ComputedPlan | null;
  context: PlanContext;
}): PlanView["estimate"] {
  const pace = context.state.settings.pace;

  if (computed) {
    const { estimate } = computed.built;

    return {
      endDate: toIsoOrNull(computed.feasibility.endDate),
      pace,
      remainingHours: toHours(estimate.remainingMinutes),
      totalHours: toHours(estimate.totalMinutes),
    };
  }

  const { items } = context;
  const totalHours = context.plan.estimateHours ?? 0;
  const todo = items.filter((item) => item.status === "todo").length;
  const last = items.reduce((end, item) => Math.max(end, item.scheduledFor?.getTime() ?? 0), 0);

  return {
    endDate: last > 0 ? toIsoDate(new Date(last)) : null,
    pace,
    remainingHours: items.length > 0 ? Math.round((totalHours * todo * 10) / items.length) / 10 : 0,
    totalHours: Math.round(totalHours * 10) / 10,
  };
}

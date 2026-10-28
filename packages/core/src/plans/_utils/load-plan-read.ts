import "server-only";
import { loadCatchUpItems } from "../../sessions/_utils/catch-up";
import { readEarlierWork } from "./left-work";
import { type PlanContext } from "./plan-context";
import { readPlanSummary } from "./plan-summary";

/** Saved items and their summary are the only authority for a screen or prefetch. */
export async function loadPlanReadProjection({ context }: { context: PlanContext; now: Date }) {
  const catchUp = await loadCatchUpItems(context.goal.id);

  return {
    catchUp: [
      ...new Map([...readEarlierWork(context), ...catchUp].map((item) => [item.id, item])).values(),
    ],
    context,
    summary: readPlanSummary({
      plan: { ...context.plan, userId: context.goal.userId },
      value: context.plan.summary,
    }),
  };
}

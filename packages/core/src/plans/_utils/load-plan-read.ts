import "server-only";
import { readCatchUpItems } from "../../learner/facts/catch-up-items";
import { selectLeftWork } from "./left-work";
import { type PlanContext } from "./plan-context";
import { readPlanSummary } from "./plan-summary";

export async function loadPlanReadProjection({ context }: { context: PlanContext; now: Date }) {
  const catchUp = await readCatchUpItems(context.goal.userId, context.goal.id);

  return {
    catchUp: [
      ...new Map([...selectLeftWork(context), ...catchUp].map((item) => [item.id, item])).values(),
    ],
    context,
    summary: readPlanSummary({
      plan: { ...context.plan, userId: context.goal.userId },
      value: context.plan.summary,
    }),
  };
}

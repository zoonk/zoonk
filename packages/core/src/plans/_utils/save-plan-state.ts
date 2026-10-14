import "server-only";
import { type PlanState } from "../planner/plan-state";
import { type PlanContext, getStateTargetDate } from "./plan-context";
import { writePlanMetadata } from "./plan-metadata-write";

/** Saves a learner's settings before setup, or an unchanged base choice, without laying out a plan. */
export async function savePlanState({
  context,
  state,
}: {
  context: PlanContext;
  state: PlanState;
}) {
  await writePlanMetadata({
    plan: context.plan,
    write: async (tx) => {
      await tx.goal.update({
        data: { dailyMinutes: state.goal.dailyMinutes, targetDate: getStateTargetDate(state) },
        where: { id: context.goal.id },
      });

      await tx.plan.update({ data: { settings: state.settings }, where: { id: context.plan.id } });
    },
  });
}

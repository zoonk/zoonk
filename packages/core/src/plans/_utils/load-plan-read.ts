import "server-only";
import {
  getSelectedCatchUpItems,
  selectDayPlanFromContext,
} from "../../sessions/_utils/selected-day-plan";
import { type PlanContext } from "./plan-context";
import { projectPlanForRead } from "./plan-read-projection";

/** Replaces Plan's existing compute and reuses Today's selected work from the loaded context. */
export async function loadPlanReadProjection({
  context,
  now,
}: {
  context: PlanContext;
  now: Date;
}) {
  if (context.phases.length === 0) {
    return { catchUp: null, computed: null, context, coverage: null };
  }

  const selection = await selectDayPlanFromContext({
    context,
    now,
    readAnalysis: true,
    reuseReadBuild: true,
  });

  return {
    catchUp: selection.left.length > 0 ? getSelectedCatchUpItems(selection) : null,
    computed: selection.advice ?? selection.computed,
    context: projectPlanForRead(selection),
    // What the plan it shows covers: its saved allocation's when the read keeps it.
    coverage: selection.summary?.coverage ?? null,
  };
}

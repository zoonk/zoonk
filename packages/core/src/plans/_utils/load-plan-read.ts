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
  screen,
}: {
  context: PlanContext;
  now: Date;
  screen: boolean;
}) {
  if (context.phases.length === 0) {
    return { catchUp: null, computed: null, context };
  }

  const selection = await selectDayPlanFromContext({
    context,
    now,
    readAnalysis: screen ? "screen" : "full",
  });

  return {
    catchUp: selection.left.length > 0 ? getSelectedCatchUpItems(selection) : null,
    computed: selection.advice ?? selection.computed,
    context: projectPlanForRead(selection),
  };
}

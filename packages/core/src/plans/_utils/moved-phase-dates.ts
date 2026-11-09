import "server-only";
import { type BuiltPlan } from "../planner/build-plan";
import { getShownPhaseEnds } from "../planner/kept-phase-ends";
import { getPhaseDatesMoveMode } from "../planner/phase-dates-move";
import { toIsoDate } from "../planner/plan-calendar";
import { type MoveRequest, moveEnds } from "./phase-end-layout";
import { type ComputedPlan, computePlan } from "./replan";

export async function planPhaseDatesMove({
  kept,
  ...request
}: MoveRequest & {
  kept: Pick<BuiltPlan, "endsBeforeLessons" | "strainedEnds">;
}): Promise<ComputedPlan> {
  if (kept.strainedEnds.length === 0 && kept.endsBeforeLessons.length === 0) {
    return computePlan({ ...request, keepPhaseDates: false });
  }

  const shown = getShownPhaseEnds({ items: request.context.items, phases: request.context.phases });
  const ends = new Map([...shown].map(([phase, date]) => [phase, toIsoDate(date)]));

  const mode = getPhaseDatesMoveMode({
    kept,
    mode: request.mode,
    shown,
    today: request.context.today,
  });

  const moved = await moveEnds({
    ...request,
    before: kept.endsBeforeLessons,
    compute: computePlan,
    ends,
    mode,
    strained: kept.strainedEnds,
  });

  return moved ?? computePlan({ ...request, keepPhaseDates: true, mode });
}

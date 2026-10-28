import "server-only";
import { type LearnerPlanOperation } from "../plan-contract";
import { type PlanOffer } from "../plan-view-contract";
import { computeChange } from "./compute-change";
import { applyChangeOperations } from "./part-areas";
import { type PlanContext } from "./plan-context";
import { areLessonsFinished, hasPlanDeadline } from "./plan-end";
import { type ShownFeasibility } from "./plan-feasibility-view";
import { type ComputedPlan } from "./replan";

const FIT_OPERATIONS: LearnerPlanOperation[] = [{ kind: "fitLessons" }];

function mayFitMore({
  context,
  feasibility,
}: {
  context: PlanContext;
  feasibility: Pick<ShownFeasibility, "fits" | "timeCovers">;
}) {
  const { goal, items, state } = context;
  const studiesPastTarget = goal.kind === "exam" && state.settings.fullCourse;
  const targetDate = goal.targetDate;

  if (!hasPlanDeadline({ studiesPastTarget, targetDate })) {
    return false;
  }

  const timeCovers = !feasibility.fits && feasibility.timeCovers;

  return timeCovers || areLessonsFinished({ items, studiesPastTarget, targetDate });
}

export async function loadFitOffer({
  baseline,
  context,
  feasibility,
}: {
  context: PlanContext;
  feasibility: Pick<ShownFeasibility, "fits" | "timeCovers">;
  baseline?: ComputedPlan;
}): Promise<PlanOffer | null> {
  if (!mayFitMore({ context, feasibility })) {
    return null;
  }

  const applied = await applyChangeOperations({ context, operations: FIT_OPERATIONS });

  if ("error" in applied) {
    return null;
  }

  const change = await computeChange({
    baseline,
    context,
    operations: applied.operations,
    state: applied.state,
  });

  return !change.unchanged && change.effect.lessonsAdded > 0
    ? { effect: change.effect, fits: change.computed.feasibility.fits, operations: FIT_OPERATIONS }
    : null;
}

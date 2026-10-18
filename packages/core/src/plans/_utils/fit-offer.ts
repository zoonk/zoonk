import "server-only";
import { type LearnerPlanOperation } from "../plan-contract";
import { type PlanOffer } from "../plan-view-contract";
import { planLearnerChange } from "./learner-change";
import { type PlanContext } from "./plan-context";
import { areLessonsFinished, hasPlanDeadline } from "./plan-end";
import { type ShownFeasibility } from "./plan-feasibility-view";

const FIT_OPERATIONS: LearnerPlanOperation[] = [{ kind: "fitLessons" }];

/**
 * Whether the learner's own time may fit lessons the plan doesn't hold by its date, so the change
 * is worth planning: every lesson the plan holds is done (no run adds any on its own then, see
 * `refreshGoalPlan`), or their time covers everything while the plan doesn't (`timeCovers`): a
 * date they moved closer left topics out, and they then studied faster than planned.
 */
function mayFitMore({
  context,
  feasibility,
}: {
  context: PlanContext;
  /** What fits in the plan the Plan shows (see `readShownFeasibility`). */
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

/**
 * The lessons the learner's own time fits by the plan's date that the plan doesn't hold, as one
 * change (`fitLessons`) worked out before they see it, so the Plan's suggestion shows its diff at
 * once and Apply is one tap. Pedro moved his date a week closer, which left two phases out, then
 * studied ahead: his 15 minutes a day covered everything again, and the Plan offered "10 min a day
 * covers everything", while winning a challenge added 4 lessons to a plan whose lessons were all
 * done. The owner's call: never add them behind the learner's back, and never offer less time
 * framed as covering more; offer what their time fits (Todoist and Linear never add tasks on their
 * own). Null when the change adds no lesson, and for a plan its date has no room for.
 */
export async function loadFitOffer({
  context,
  feasibility,
}: {
  context: PlanContext;
  feasibility: Pick<ShownFeasibility, "fits" | "timeCovers">;
}): Promise<PlanOffer | null> {
  if (!mayFitMore({ context, feasibility })) {
    return null;
  }

  const change = await planLearnerChange({
    context,
    operations: FIT_OPERATIONS,
    reuseReadBuild: true,
  });

  return change && !change.unchanged && change.effect.lessonsAdded > 0
    ? { effect: change.effect, fits: change.computed.feasibility.fits, operations: FIT_OPERATIONS }
    : null;
}

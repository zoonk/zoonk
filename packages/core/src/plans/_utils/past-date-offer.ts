import "server-only";
import { type LearnerPlanOperation } from "../plan-contract";
import { type PlanOffer } from "../plan-view-contract";
import { FITTING_DATE_TRIES } from "../planner/fitting-date";
import { addDays, toIsoDate } from "../planner/plan-calendar";
import { type PlannedItem } from "../planner/plan-items";
import { planLearnerChange } from "./learner-change";
import { applyChangeOperations } from "./part-areas";
import { type PlanContext } from "./plan-context";
import { computePlan } from "./replan";
import { getChangePlanning } from "./steered-areas";

/** Lessons a plan keeps set aside: the ones a change didn't bring back (see `splitExistingItems`). */
function countSetAside(items: readonly Pick<PlannedItem, "kind" | "status">[]): number {
  return items.filter(
    (item) => (item.kind === "lesson" || item.kind === "chapter") && item.status === "skipped",
  ).length;
}

/**
 * The plan without its date, as a learner's change plans it: everything left comes back (but
 * lessons the Library couldn't write, which stay set aside), laid out at the learner's time.
 */
async function planWithoutDate(context: PlanContext) {
  const operations: LearnerPlanOperation[] = [{ kind: "setTargetDate", targetDate: null }];
  const result = await applyChangeOperations({ context, operations });

  if ("error" in result) {
    return null;
  }

  return computePlan({
    ...getChangePlanning(result.operations),
    context,
    reuseReadBuild: true,
    state: result.state,
  });
}

/**
 * A goal's own date, moved to the earliest day the learner's time covers everything left by: the
 * day after the plan without a date ends (its lessons end before its date), a day later at a time
 * when a dated plan lays them out otherwise. Each try plans the change itself, so its diff is the
 * one Apply makes.
 */
async function offerNewDate(context: PlanContext): Promise<PlanOffer | null> {
  const open = await planWithoutDate(context);
  const end = open?.built.estimate.endDate;

  if (!open || !end) {
    return null;
  }

  const kept = countSetAside(open.built.items);

  for (const days of Array.from({ length: FITTING_DATE_TRIES }, (_, index) => index + 1)) {
    const operations: LearnerPlanOperation[] = [
      { kind: "setTargetDate", targetDate: toIsoDate(addDays(end, days)) },
    ];

    // oxlint-disable-next-line no-await-in-loop -- the earliest date that fits wins, so each try waits for the one before it.
    const change = await planLearnerChange({ context, operations, reuseReadBuild: true });

    if (
      change &&
      !change.unchanged &&
      change.computed.built.droppedSkillIds.length === 0 &&
      countSetAside(change.computed.built.items) <= kept
    ) {
      return { effect: change.effect, operations };
    }
  }

  return null;
}

/** An exam's date is the exam's: its plan goes on after it, at the learner's pace. */
async function offerStudyAfterExam(context: PlanContext): Promise<PlanOffer | null> {
  const operations: LearnerPlanOperation[] = [{ fullCourse: true, kind: "setFullCourse" }];
  const change = await planLearnerChange({ context, operations, reuseReadBuild: true });

  return change && !change.unchanged ? { effect: change.effect, operations } : null;
}

/**
 * The one change that keeps a plan going once its date came with lessons left (status
 * `pastDate`): the owner's call (Oct 13) was that plans don't end, and that the learner gets a way
 * to adjust them automatically. Runners' plans realign the same way (Runna extends a plan without a
 * fixed end and rebuilds toward a race's fixed date), and an exam's date is fixed: it stays, and
 * what's left goes on after it. Null when no change brings the lessons back.
 */
export function loadPastDateOffer(context: PlanContext): Promise<PlanOffer | null> {
  return context.goal.kind === "exam" ? offerStudyAfterExam(context) : offerNewDate(context);
}

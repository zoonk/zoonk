import { OWN_LEVEL_SOURCE } from "../own-level-contract";
import { type PlanChangeView } from "../plan-view-contract";
import { SMALL_CHANGE_LESSONS } from "../planner/plan-change-thresholds";
import { parsePlanChangePayload } from "./plan-change-payload";

/** Changes the learner made on purpose (in the plan editor, in words, or their own level). */
const LEARNER_SOURCES: ReadonlySet<string> = new Set(["learner", "planEdit", OWN_LEVEL_SOURCE]);

/**
 * A resumed goal stays quiet unless topics moved.
 */
const QUIET_KINDS: ReadonlySet<string> = new Set(["resumed"]);

/** A moved milestone is news even when settling missed days left no backlog. */
function hasMovedMilestone(effect: PlanChangeView["effect"]): boolean {
  return (effect?.phaseEnds?.length ?? 0) > 0 || Boolean(effect?.nextMock);
}

/**
 * Computed and stored Today notices have the same eligibility. Past-date recovery already says
 * why work was set aside, so its missed-day warning must not appear only until Open persists it.
 */
export function isAutomaticPlanChange({
  change,
  dateReached,
}: {
  change: { kind: string; payload: unknown };
  dateReached: boolean;
}): boolean {
  if (dateReached && change.kind === "missedDays") {
    return false;
  }

  const { behind, effect, source } = parsePlanChangePayload(change.payload);

  if (LEARNER_SOURCES.has(source)) {
    return false;
  }

  if (hasMovedMilestone(effect)) {
    return true;
  }

  if (change.kind === "estimateUpdated") {
    return (
      (effect?.lessonsLeftOut?.length ?? 0) > 0 ||
      Math.abs((effect?.lessonsAdded ?? 0) - (effect?.lessonsRemoved ?? 0)) > SMALL_CHANGE_LESSONS
    );
  }

  const movesTopics = (effect?.topicsLeftOut?.length ?? 0) + (effect?.topicsAdded?.length ?? 0) > 0;

  return (
    movesTopics ||
    (!QUIET_KINDS.has(change.kind) && (change.kind !== "missedDays" || behind !== null))
  );
}

import { type Goal } from "@zoonk/db";
import { type PlanPhaseView } from "../plan-view-contract";
import { type ExistingPlanItem } from "../planner/plan-items";
import { type PlanPhase, type PlanSettings } from "../planner/plan-state";
import { hasPlanDeadline, isPlanOver, withinLessonScope } from "./plan-end";
import { findShortPlanPhase, getShortPlanShape } from "./short-plan-view";
import { isWorkFinished } from "./work-progress";

type PhaseItem = Pick<ExistingPlanItem, "chapterId" | "kind" | "lessonId" | "phase" | "status">;

/** What a phase's work is: its lessons, written or still being written, and its challenge. */
export const PHASE_WORK_KINDS = new Set<PhaseItem["kind"]>(["boss", "chapter", "lesson"]);

/**
 * The phase the learner is in, the same on Plan, on the map, on Today and on the exam page: the
 * earliest phase with work left, its challenge included, or the last phase once everything is done.
 * A later phase's lesson the plan gives first doesn't move the learner on: read from the next thing
 * to do, Pedro's Plan said he was in the second phase, and went back to the first once a change
 * planned that phase's last lessons first (see `loadCurrentPhases`, its SQL twin).
 */
export function findCurrentPhase({
  phaseChallengesRequired = true,
  items,
  phaseCount,
}: {
  phaseChallengesRequired?: boolean;
  items: readonly PhaseItem[];
  phaseCount: number;
}): number | null {
  const left = items.flatMap((item) =>
    item.status === "todo" &&
    PHASE_WORK_KINDS.has(item.kind) &&
    (item.kind !== "boss" || phaseChallengesRequired)
      ? [item.phase]
      : [],
  );

  if (left.length > 0) {
    return Math.min(...left);
  }

  return phaseCount > 0 && items.length > 0 ? phaseCount - 1 : null;
}

/**
 * The phase the learner is in on every screen that draws the plan's phases (the Plan, the map):
 * the earliest with work left (`findCurrentPhase`), read from the calendar too for a test days
 * away (`findShortPlanPhase`).
 */
export function findPlanPhase({
  phaseChallengesRequired = true,
  goal,
  items,
  phases,
  settings,
  today,
}: {
  phaseChallengesRequired?: boolean;
  goal: Pick<Goal, "kind" | "targetDate">;
  items: readonly PhaseItem[];
  phases: readonly PlanPhase[];
  settings: Pick<PlanSettings, "shortMockMinutes" | "startDate">;
  today: Date;
}): number | null {
  return findShortPlanPhase({
    phases,
    progressPhase: findCurrentPhase({ items, phaseChallengesRequired, phaseCount: phases.length }),
    shape: getShortPlanShape({ goal, settings }),
    today,
  });
}

/**
 * The learner finished a phase's work: every lesson and its challenge studied, won or tested out.
 * One whose work was set aside isn't, though the plan moved past it: Rafaela's first phase, one
 * lesson studied before 30 days away set the rest aside, read "done" on her Plan.
 */
export function isPhaseFinished(items: readonly Pick<PhaseItem, "kind" | "status">[]): boolean {
  return items.every((item) => !PHASE_WORK_KINDS.has(item.kind) || isWorkFinished(item.status));
}

/**
 * Where a phase stands against the current one; every one is done without one. One the plan
 * moved past is done only once the learner finished its work (`isPhaseFinished`): with work set
 * aside it's `unfinished`. One the plan holds nothing of is `leftOut` (see `buildPhaseViews`).
 */
function getProgressState({
  current,
  finished,
  index,
}: {
  current: number | null;
  finished: boolean;
  index: number;
}) {
  if (current === null || index < current) {
    return finished ? ("done" as const) : ("unfinished" as const);
  }

  return index === current ? ("current" as const) : ("upcoming" as const);
}

type StateItem = Pick<ExistingPlanItem, "kind" | "phase" | "scheduledFor" | "status">;

/**
 * Each phase's state (see `getProgressState`), the one the Plan's path and the map read: from the
 * lessons the plan's number and "finished" count (see `isInLessonScope`), with no phase current
 * once nothing of the plan is left, its challenges included (`isPlanOver`), though
 * `findCurrentPhase` still names the last one. A date too near for a phase's topics leaves the plan
 * holding none of its work: it's `leftOut`, never done. Read by a rule of its own, the map kept
 * Pedro's finished plan in its last phase and read Lucas's phases left out for his date as ahead.
 */
export function getPhaseStates({
  phaseChallengesRequired = true,
  currentPhase,
  goalKind,
  items: planItems,
  phases,
  studiesPastTarget = false,
  targetDate = null,
  today = null,
}: {
  phaseChallengesRequired?: boolean;
  currentPhase: number | null;
  goalKind: Goal["kind"];
  items: readonly StateItem[];
  phases: readonly Pick<PlanPhase, "kind">[];
  /** An exam the learner goes on studying after (see `isPlanFinished`). */
  studiesPastTarget?: boolean;
  targetDate?: Date | null;
  /** The learner's day, for mocks and reviews past the date. */
  today?: Date | null;
}): PlanPhaseView["state"][] {
  const deadline = hasPlanDeadline({ studiesPastTarget, targetDate });
  const items = withinLessonScope({ deadline, items: planItems });

  const current = isPlanOver({ goalKind, items, phaseChallengesRequired, targetDate, today })
    ? null
    : currentPhase;

  return phases.map((phase, index) => {
    const inPhase = items.filter((item) => item.phase === index);

    if (items.length > 0 && inPhase.length === 0 && phase.kind !== "afterExam") {
      return "leftOut";
    }

    const required = phaseChallengesRequired
      ? inPhase
      : inPhase.filter((item) => item.kind !== "boss");

    return getProgressState({ current, finished: isPhaseFinished(required), index });
  });
}

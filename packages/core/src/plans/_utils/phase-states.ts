import { type Goal } from "@zoonk/db";
import { type PlanPhaseView } from "../plan-view-contract";
import { type ExistingPlanItem } from "../planner/plan-items";
import { type PlanPhase, type PlanSettings } from "../planner/plan-state";
import { hasPlanDeadline, isPlanOver, withinLessonScope } from "./plan-end";
import { findShortPlanPhase, getShortPlanShape } from "./short-plan-view";
import { isWorkFinished } from "./work-progress";

type PhaseItem = Pick<ExistingPlanItem, "chapterId" | "kind" | "lessonId" | "phase" | "status">;

export const PHASE_WORK_KINDS = new Set<PhaseItem["kind"]>(["boss", "chapter", "lesson"]);

/** `loadCurrentPhases` is its SQL twin: change both together. */
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

export function isPhaseFinished(items: readonly Pick<PhaseItem, "kind" | "status">[]): boolean {
  return items.every((item) => !PHASE_WORK_KINDS.has(item.kind) || isWorkFinished(item.status));
}

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
  studiesPastTarget?: boolean;
  targetDate?: Date | null;
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

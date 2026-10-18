import { isDeepStrictEqual } from "node:util";
import { getChangeLevers, replacesProposal } from "../../_utils/change-levers";
import { type ComputedPlan } from "../../_utils/replan";
import { getChangePlanning } from "../../_utils/steered-areas";
import { PHASE_DATES_SOURCE } from "../../plan-change-contract";
import { type BuiltPlan, type PlanningMode } from "../../planner/build-plan";
import { getShownPhaseEnds } from "../../planner/kept-phase-ends";
import {
  getPhaseDatesEffect,
  getPhaseDatesMoveMode,
  isKeptOver,
  isPhaseDatesMoveWorth,
  mayCostToKeepPhaseDates,
  moveStrainedEnds,
  showsPhaseDatesMove,
} from "../../planner/phase-dates-move";
import { toIsoDate } from "../../planner/plan-calendar";
import { type PlanEffect, getPlanEffect } from "../../planner/plan-effect";
import { type PlanPhase, type PlanState } from "../../planner/plan-state";
import { computeSimPlan } from "./sim-planner";
import { type SimChange, type SimWorld } from "./sim-world";

/**
 * `updatePhaseDatesProposal`'s copy (see `sim-planner.ts`): after a system run keeps the phase
 * dates the learner saw, Today proposes moving them when that leaves lessons out by the goal's
 * date that moving them fits in, and withdraws a waiting proposal that no longer applies. A
 * learner who kept their dates isn't asked again while those are the dates they see. The learner
 * answers on their next look at Today (`SimLife.proposals`), or a later run replaces it.
 */

/** Whether a proposal's moves start from these phase ends, the ones the learner still sees. */
function startsFromEnds({
  effect,
  phases,
}: {
  effect: PlanEffect | null;
  phases: readonly PlanPhase[];
}): boolean {
  return (effect?.phaseEnds ?? []).every(
    (move) => phases.find((phase) => phase.name === move.name)?.endDate === move.before,
  );
}

type MoveRequest = {
  bringBackSetAside?: boolean;
  mode: PlanningMode;
  pace: "sampled" | "saved";
  state?: PlanState;
  todayExceptAreas?: readonly string[] | null;
  world: SimWorld;
};

/** `ChangePlanning`'s copy: how a learner's change planned the plan it saved. */
type ChangePlanning = {
  bringBackSetAside: boolean;
  state: PlanState;
  todayExceptAreas: readonly string[] | null;
};

/** `MAX_END_MOVES`' copy. */
const MAX_END_MOVES = 8;

/** `moveEnds`' copy: ends with no room to the next day with room, ends before their lessons let go. */
function moveEnds({
  before,
  ends,
  released = new Set(),
  round = 1,
  strained,
  ...request
}: MoveRequest & {
  before: readonly number[];
  ends: ReadonlyMap<number, string>;
  released?: ReadonlySet<number>;
  round?: number;
  strained: BuiltPlan["strainedEnds"];
}): ComputedPlan | null {
  const moved = moveStrainedEnds({ ends, strained });
  const letGo = new Set([...released, ...before]);

  if (isDeepStrictEqual(moved, ends) && letGo.size === released.size) {
    return null;
  }

  const next = computeSimPlan({
    ...request,
    keepPhaseDates: true,
    movedEnds: moved,
    releasedPhases: letGo,
  });

  const left = next.built.strainedEnds;
  const after = next.built.endsBeforeLessons.filter((phase) => !letGo.has(phase));

  if ((left.length === 0 && after.length === 0) || round >= MAX_END_MOVES) {
    return next;
  }

  return (
    moveEnds({
      ...request,
      before: after,
      ends: moved,
      released: letGo,
      round: round + 1,
      strained: left,
    }) ?? next
  );
}

/**
 * `planPhaseDatesMove`'s copy: from the plan that keeps the dates, only the ends that can't hold
 * their challenge or would come before its lessons move (with those they'd pass), else every end
 * is planned again. Today's proposal and applying it both use it.
 */
export function planSimPhaseDatesMove({
  kept,
  ...request
}: MoveRequest & { kept: Pick<BuiltPlan, "endsBeforeLessons" | "strainedEnds"> }): ComputedPlan {
  if (kept.strainedEnds.length === 0 && kept.endsBeforeLessons.length === 0) {
    return computeSimPlan({ ...request, keepPhaseDates: false });
  }

  const { plan, today } = request.world;
  const shown = getShownPhaseEnds({ items: plan.items, phases: plan.phases });
  const ends = new Map([...shown].map(([phase, date]) => [phase, toIsoDate(date)]));
  const mode = getPhaseDatesMoveMode({ kept, mode: request.mode, shown, today });

  return (
    moveEnds({
      ...request,
      before: kept.endsBeforeLessons,
      ends,
      mode,
      strained: kept.strainedEnds,
    }) ?? computeSimPlan({ ...request, keepPhaseDates: true, mode })
  );
}

/** What moving the phase dates would do, or null when keeping them costs nothing. */
function findMovedDatesEffect({
  computed,
  mode,
  pace,
  planning,
  world,
}: {
  computed: ComputedPlan;
  mode: PlanningMode;
  pace: "sampled" | "saved";
  planning?: ChangePlanning;
  world: SimWorld;
}): PlanEffect | null {
  if (!mayCostToKeepPhaseDates(computed.built)) {
    return null;
  }

  const moved = planSimPhaseDatesMove({ ...planning, kept: computed.built, mode, pace, world });

  if (
    !isPhaseDatesMoveWorth({
      graph: computed.state.graph,
      kept: computed.built,
      moved: moved.built,
    })
  ) {
    return null;
  }

  const effect = {
    ...getPlanEffect({
      after: moved.built.items,
      before: computed.built.items,
      standInLessons: moved.standInLessons,
      standInLessonsBefore: computed.standInLessons,
    }),
    ...getPhaseDatesEffect({
      graph: computed.state.graph,
      kept: computed.built,
      moved: moved.built,
      shown: computed.built.phases,
    }),
  };

  return showsPhaseDatesMove(effect) ? effect : null;
}

/**
 * Today's proposal to move the phase dates, while it waits for an answer. A run that replaces it
 * records it again as replaced, so the last one recorded tells.
 */
export function findWaitingProposal(changes: readonly SimChange[]): SimChange | undefined {
  const last = changes.findLast((change) => change.source === PHASE_DATES_SOURCE);
  return last?.status === "proposed" ? last : undefined;
}

/**
 * `withdrawUnneededPhaseDatesProposal`'s copy: a refresh with nothing new to plan withdraws the
 * waiting proposal when the plan it finds no longer needs it.
 */
export function withdrawUnneededSimProposal({
  computed,
  world,
}: {
  computed?: ComputedPlan;
  world: SimWorld;
}): SimChange[] {
  const waiting = findWaitingProposal(world.changes);

  const unneeded = computed
    ? !mayCostToKeepPhaseDates(computed.built)
    : !waiting?.effect || !startsFromEnds({ effect: waiting.effect, phases: world.plan.phases });

  return waiting && unneeded ? [{ ...waiting, status: "replaced" }] : [];
}

/** A change applied lays the phase dates out again, so it changes what moving them would. */
const APPLIED_LEVERS = getChangeLevers({
  operations: [{ kind: "fitPhaseDates" }],
  source: PHASE_DATES_SOURCE,
});

/**
 * `replaceWaitingProposals`' copy for a change applied: the waiting proposal it changes the same
 * thing as, recorded again as replaced, so the learner never answers it.
 */
function replaceWaitingProposal({
  change,
  world,
}: {
  change: SimChange;
  world: SimWorld;
}): SimChange[] {
  const waiting = findWaitingProposal(world.changes);

  if (!waiting) {
    return [];
  }

  const newer = new Set([...getChangeLevers(change), ...APPLIED_LEVERS]);
  const replaces = replacesProposal({ newer, waiting: getChangeLevers(waiting) });

  return replaces ? [{ ...waiting, status: "replaced" }] : [];
}

/**
 * The changes a system run writes for the phase dates: a new proposal, the one it replaces. Also
 * right after a learner's change, from the state it planned with (`askPhaseDatesAfterChange`).
 */
export function updateSimPhaseDates({
  computed,
  mode,
  pace,
  planned,
  planning,
  world,
}: {
  computed: ComputedPlan;
  mode: PlanningMode;
  pace: "sampled" | "saved";
  /** The world the run planned from: a session's new pace lays the rest out from tomorrow. */
  planned?: SimWorld;
  planning?: ChangePlanning;
  world: SimWorld;
}): SimChange[] {
  const effect = findMovedDatesEffect({ computed, mode, pace, planning, world: planned ?? world });
  const waiting = findWaitingProposal(world.changes);

  if (waiting && effect && isDeepStrictEqual(waiting.effect, effect)) {
    return [];
  }

  const kept =
    effect !== null &&
    world.changes.some(
      (change) =>
        change.source === PHASE_DATES_SOURCE &&
        change.status === "declined" &&
        startsFromEnds({ effect: change.effect, phases: computed.built.phases }) &&
        isKeptOver({ declined: change.effect, effect }),
    );

  const proposal: SimChange[] =
    effect && !kept
      ? [
          {
            day: toIsoDate(world.today),
            effect,
            kind: "edited",
            operations: [{ kind: "fitPhaseDates" }],
            source: PHASE_DATES_SOURCE,
            status: "proposed",
          },
        ]
      : [];

  return [...(waiting ? [{ ...waiting, status: "replaced" as const }] : []), ...proposal];
}

/**
 * `commitEdit`'s copy for the phase dates: the change replaces the proposal waiting, then Today
 * asks again from the plan it saved, planned as the change was (`askPhaseDatesAfterChange`).
 */
export function askSimPhaseDatesAfterChange({
  bringBackSetAside,
  change,
  computed,
  world,
}: {
  /** The change's plan brought work set aside back (`ComputedChange.bringsBackSetAside`). */
  bringBackSetAside: boolean;
  change: SimChange;
  computed: ComputedPlan;
  world: SimWorld;
}): SimChange[] {
  const replaced = replaceWaitingProposal({ change, world });
  const { mode, todayExceptAreas } = getChangePlanning(change.operations);

  const asked = updateSimPhaseDates({
    computed,
    mode,
    pace: "saved",
    planning: { bringBackSetAside, state: computed.state, todayExceptAreas },
    world: { ...world, changes: [...world.changes, ...replaced] },
  });

  return [...replaced, ...asked];
}

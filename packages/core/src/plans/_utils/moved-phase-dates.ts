import "server-only";
import { isDeepStrictEqual } from "node:util";
import { type BuiltPlan, type PlanningMode } from "../planner/build-plan";
import { getShownPhaseEnds } from "../planner/kept-phase-ends";
import { getPhaseDatesMoveMode, moveStrainedEnds } from "../planner/phase-dates-move";
import { toIsoDate } from "../planner/plan-calendar";
import { type PlanState } from "../planner/plan-state";
import { type PlanContext } from "./plan-context";
import { type ComputedPlan, computePlan } from "./replan";

/**
 * A moved end can land where another challenge then strains its day (the ends it passed come to
 * it), and an end let go can push the next phase's lessons past its end: a few more moves settle
 * it, one per phase at most, and a plan that keeps straining stops there.
 */
const MAX_END_MOVES = 8;

type MoveRequest = {
  /** A learner's change planned the kept plan (see `getChangePlanning`). */
  bringBackSetAside?: boolean;
  context: PlanContext;
  mode: PlanningMode;
  pace: "sampled" | "saved";
  reuseReadBuild?: boolean;
  state?: PlanState;
  todayExceptAreas?: readonly string[] | null;
};

/**
 * The plan with each end whose challenge has no room moved to the first later day with room, and
 * the ends it passes with it (see `moveStrainedEnds`), and each end whose challenge would come
 * before lessons it tests let go (`released`, see `listEndsBeforeLessons`), so it ends right after
 * them: until no kept end strains its day or comes before its lessons.
 */
async function moveEnds({
  before,
  ends,
  released = new Set(),
  round = 1,
  strained,
  ...request
}: MoveRequest & {
  /** The ends whose challenge would come before its lessons. */
  before: readonly number[];
  /** The phase ends a run kept, by phase. */
  ends: ReadonlyMap<number, string>;
  released?: ReadonlySet<number>;
  round?: number;
  strained: BuiltPlan["strainedEnds"];
}): Promise<ComputedPlan | null> {
  const moved = moveStrainedEnds({ ends, strained });
  const letGo = new Set([...released, ...before]);

  if (isDeepStrictEqual(moved, ends) && letGo.size === released.size) {
    return null;
  }

  const next = await computePlan({
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
    (await moveEnds({
      ...request,
      before: after,
      ends: moved,
      released: letGo,
      round: round + 1,
      strained: left,
    })) ?? next
  );
}

/**
 * The plan with its phase dates moved, from the plan that keeps them (`kept`, see `keepPhaseEnds`):
 * when keeping them holds a challenge on a day without room for it (see `listStrainedEnds`), or
 * before lessons it tests (see `listEndsBeforeLessons`), only those ends move, to the next day
 * with room or to right after those lessons, with the later ones they'd pass, and every other end
 * the learner saw stays (the smallest move, see `moveStrainedEnds`); otherwise every end is
 * planned again as the lessons fall, which fits in the lessons keeping them leaves out. Today's
 * proposal says what this plan moves, and applying it commits the same plan.
 */
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
    ends,
    mode,
    strained: kept.strainedEnds,
  });

  return moved ?? computePlan({ ...request, keepPhaseDates: true, mode });
}

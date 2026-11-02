import "server-only";
import { isDeepStrictEqual } from "node:util";
import { type BuiltPlan, type PlanningMode } from "../planner/build-plan";
import { getShownPhaseEnds } from "../planner/kept-phase-ends";
import { getPhaseDatesMoveMode, moveStrainedEnds } from "../planner/phase-dates-move";
import { toIsoDate } from "../planner/plan-calendar";
import { type PlanState } from "../planner/plan-state";
import { type PlanContext } from "./plan-context";
import { type ComputedPlan, computePlan } from "./replan";

const MAX_END_MOVES = 8;

type MoveRequest = {
  bringBackSetAside?: boolean;
  context: PlanContext;
  mode: PlanningMode;
  pace: "sampled" | "saved";
  state?: PlanState;
  todayExceptAreas?: readonly string[] | null;
};

async function moveEnds({
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

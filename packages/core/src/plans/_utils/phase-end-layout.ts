import "server-only";
import { isDeepStrictEqual } from "node:util";
import { type BuiltPlan, type PlanningMode } from "../planner/build-plan";
import {
  getPhaseDatesEffect,
  getPhaseDatesMoveMode,
  isPhaseDatesMoveWorth,
  mayCostToKeepPhaseDates,
  moveStrainedEnds,
} from "../planner/phase-dates-move";
import { toIsoDate } from "../planner/plan-calendar";
import { type PlanState } from "../planner/plan-state";
import { type PlanContext } from "./plan-context";
import { type ComputePlanRequest, type ComputedPlan, type computePlan } from "./replan";
import { hasTakenChallenge } from "./taken-challenge";

const MAX_END_MOVES = 8;

export type MoveRequest = {
  bringBackSetAside?: boolean;
  context: PlanContext;
  mode: PlanningMode;
  pace: "sampled" | "saved";
  state?: PlanState;
  todayExceptAreas?: readonly string[] | null;
};

export async function moveEnds({
  compute,
  before,
  ends,
  released = new Set(),
  round = 1,
  strained,
  ...request
}: MoveRequest & {
  compute: typeof computePlan;
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

  const next = await compute({
    ...request,
    keepPhaseDates: true,
    movedEnds: moved,
    releasedPhases: letGo,
  });

  const left = strained.length > 0 ? next.built.strainedEnds : [];
  const after = next.built.endsBeforeLessons.filter((phase) => !letGo.has(phase));

  if ((left.length === 0 && after.length === 0) || round >= MAX_END_MOVES) {
    return next;
  }

  return (
    (await moveEnds({
      ...request,
      before: after,
      compute,
      ends: moved,
      released: letGo,
      round: round + 1,
      strained: left,
    })) ?? next
  );
}

/**
 * Asking to move a challenge the learner has never met is noise: until they take one, a plan that
 * would pay for keeping its phase dates lays its phases out again instead of proposing the move.
 */
export async function layOutUnmetPhaseDates({
  compute,
  built,
  graph,
  kept,
  request,
}: {
  compute: typeof computePlan;
  built: BuiltPlan;
  graph: PlanState["graph"];
  kept: ReadonlyMap<number, Date> | undefined;
  request: ComputePlanRequest;
}): Promise<ComputedPlan | null> {
  const { goal } = request.context;

  if (kept?.size && built.endsBeforeLessons.length > 0) {
    const moved = await moveEnds({
      ...request,
      before: built.endsBeforeLessons,
      compute,
      ends: new Map([...kept].map(([phase, date]) => [phase, toIsoDate(date)])),
      mode: getPhaseDatesMoveMode({
        kept: { endsBeforeLessons: built.endsBeforeLessons, strainedEnds: [] },
        mode: request.mode,
        shown: kept,
        today: request.context.today,
      }),
      pace: request.pace ?? "saved",
      strained: [],
    });

    return (
      moved && {
        ...moved,
        effect: {
          ...moved.effect,
          ...getPhaseDatesEffect({
            graph,
            kept: { ...built, strainedEnds: [] },
            moved: moved.built,
            shown: request.context.phases,
          }),
        },
      }
    );
  }

  if (
    !kept?.size ||
    !mayCostToKeepPhaseDates(built) ||
    (await hasTakenChallenge({ goalId: goal.id, userId: goal.userId }))
  ) {
    return null;
  }

  const mode = getPhaseDatesMoveMode({
    kept: built,
    mode: request.mode,
    shown: kept,
    today: request.context.today,
  });

  const laidOut = await compute({ ...request, keepPhaseDates: false, mode });
  return isPhaseDatesMoveWorth({ graph, kept: built, moved: laidOut.built }) ? laidOut : null;
}

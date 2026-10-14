import "server-only";
import { isDeepStrictEqual } from "node:util";
import { prisma } from "@zoonk/db";
import { PHASE_DATES_SOURCE } from "../plan-change-contract";
import { type PlanOperation } from "../plan-contract";
import { type PlanningMode } from "../planner/build-plan";
import {
  getPhaseDatesEffect,
  isKeptOver,
  isPhaseDatesMoveWorth,
  mayCostToKeepPhaseDates,
  showsPhaseDatesMove,
} from "../planner/phase-dates-move";
import { type PlanEffect, getPlanEffect } from "../planner/plan-effect";
import { type PlanPhase, type PlanState } from "../planner/plan-state";
import { planPhaseDatesMove } from "./moved-phase-dates";
import { parsePlanChangePayload, toPlanChangePayload } from "./plan-change-payload";
import { type PlanContext } from "./plan-context";
import { writePlanMetadata } from "./plan-metadata-write";
import { type ComputedPlan, type PlanTagRevalidation, revalidatePlanTags } from "./replan";
import { getChangePlanning } from "./steered-areas";

/**
 * How a learner's change planned the plan it saved (see `getChangePlanning`), from its own state:
 * moving the phase dates is planned the same way, to compare.
 */
type ChangePlanning = {
  bringBackSetAside: boolean;
  state: PlanState;
  todayExceptAreas: readonly string[] | null;
};

/**
 * The plan with its phase dates moved, when keeping the dates the learner saw (`computed`, see
 * `keepPhaseEnds`) leaves lessons out by the goal's date that moving them fits in: the lessons
 * written since took more or less time than planned, and the days a phase no longer needs can't
 * go to the phases after it. Also when keeping them holds a challenge on a day without room for it
 * (see `listStrainedEnds`) and moving them gives it another day. Null when keeping them costs
 * nothing, so the dates simply stay.
 */
async function findMovedPhaseDates({
  computed,
  context,
  mode,
  pace,
  planning,
}: {
  computed: ComputedPlan;
  context: PlanContext;
  mode: PlanningMode;
  pace: "sampled" | "saved";
  planning?: ChangePlanning;
}): Promise<ComputedPlan | null> {
  if (!mayCostToKeepPhaseDates(computed.built)) {
    return null;
  }

  const moved = await planPhaseDatesMove({
    ...planning,
    context,
    kept: computed.built,
    mode,
    pace,
  });

  return isPhaseDatesMoveWorth({
    graph: computed.state.graph,
    kept: computed.built,
    moved: moved.built,
  })
    ? moved
    : null;
}

/**
 * What moving the phase dates does: the lessons it fits in by the goal's date, and the phases, each
 * from the end the plan this run saves shows. Named from the ends before the run, a proposal moved
 * an ended phase's end its settling had already moved to its carried lessons, so the next run read
 * it as not starting from the ends the learner sees and withdrew it (career 1160).
 */
function getMovedDatesEffect({
  computed,
  moved,
}: {
  computed: ComputedPlan;
  moved: ComputedPlan;
}): PlanEffect {
  return {
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
}

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

async function loadPhaseDatesChanges(planId: string) {
  const changes = await prisma.planChange.findMany({
    select: { id: true, payload: true, status: true },
    where: {
      payload: { equals: PHASE_DATES_SOURCE, path: ["source"] },
      planId,
      status: { in: ["declined", "proposed"] },
    },
  });

  return changes.map((change) => ({
    effect: parsePlanChangePayload(change.payload).effect,
    id: change.id,
    status: change.status,
  }));
}

/**
 * Withdraws Today's proposal to move the phase dates when the plan a refresh finds unchanged no
 * longer needs it (see `mayCostToKeepPhaseDates`): that refresh doesn't weigh the proposal again,
 * so one an earlier version of the planner made stayed while nothing the plan reads changed, and
 * an on-track learner kept reading that lessons came out longer than planned (walk, Lucas).
 */
export async function withdrawUnneededPhaseDatesProposal({
  computed,
  context,
  revalidation,
}: {
  computed: ComputedPlan;
  context: PlanContext;
  revalidation: PlanTagRevalidation;
}): Promise<void> {
  if (mayCostToKeepPhaseDates(computed.built)) {
    return;
  }

  const waiting = await prisma.planChange.findMany({
    select: { id: true },
    where: {
      payload: { equals: PHASE_DATES_SOURCE, path: ["source"] },
      planId: context.plan.id,
      status: "proposed",
    },
  });

  if (waiting.length === 0) {
    return;
  }

  const { count } = await writePlanMetadata({
    plan: context.plan,
    write: (tx) =>
      tx.planChange.updateMany({
        data: { status: "replaced" },
        where: { id: { in: waiting.map((change) => change.id) }, status: "proposed" },
      }),
  });

  if (count > 0 && revalidation === "now") {
    revalidatePlanTags(context.goal.userId);
  }
}

/**
 * Keeps Today's proposal to move the phase dates true to the plan as a system refresh leaves it
 * (with the dates the learner saw, see `keepPhaseEnds`): when keeping them leaves lessons out by
 * the goal's date that moving them fits in, Today asks, with what moves (Apply, or "Keep mine");
 * otherwise a proposal still waiting no longer applies and is withdrawn. A learner who kept their
 * dates isn't asked again while those are the dates they see, the ones this run saves (a missed
 * day's settling may move one: career 1160 waited a run for its card), unless keeping them now
 * costs what the card they answered didn't name (see `isKeptOver`). A learner's change asks again
 * right away (see `askPhaseDatesAfterChange`).
 */
export async function updatePhaseDatesProposal({
  computed,
  context,
  mode,
  pace,
  planning,
  revalidation,
  writeVersion = context.plan,
}: {
  computed: ComputedPlan;
  context: PlanContext;
  /** How `computed` was planned: moving the dates is planned the same way, to compare. */
  mode: PlanningMode;
  pace: "sampled" | "saved";
  /** How a learner's change planned `computed`, right after it (see `askPhaseDatesAfterChange`). */
  planning?: ChangePlanning;
  revalidation: PlanTagRevalidation;
  /** The committed plan's version when the proposal was computed from its preceding context. */
  writeVersion?: PlanContext["plan"];
}): Promise<void> {
  const [moved, earlier] = await Promise.all([
    findMovedPhaseDates({ computed, context, mode, pace, planning }),
    loadPhaseDatesChanges(context.plan.id),
  ]);

  const found = moved ? getMovedDatesEffect({ computed, moved }) : null;
  const effect = found && showsPhaseDatesMove(found) ? found : null;
  const waiting = earlier.filter((change) => change.status === "proposed");
  const current = waiting.find((change) => effect && isDeepStrictEqual(change.effect, effect));

  const kept =
    effect !== null &&
    earlier.some(
      (change) =>
        change.status === "declined" &&
        startsFromEnds({ effect: change.effect, phases: computed.built.phases }) &&
        isKeptOver({ declined: change.effect, effect }),
    );

  const proposes = effect !== null && !kept && !current;
  const stale = waiting.filter((change) => change.id !== current?.id).map((change) => change.id);

  if (!proposes && stale.length === 0) {
    return;
  }

  await writePlanMetadata({
    plan: writeVersion,
    write: async (tx) => {
      await tx.planChange.updateMany({
        data: { status: "replaced" },
        where: { id: { in: stale }, status: "proposed" },
      });

      if (proposes) {
        await tx.planChange.create({
          data: {
            kind: "edited",
            payload: toPlanChangePayload({
              effect,
              operations: [{ kind: "fitPhaseDates" }],
              source: PHASE_DATES_SOURCE,
            }),
            planId: context.plan.id,
            reason: "",
            status: "proposed",
          },
        });
      }
    },
  });

  if (revalidation === "now") {
    revalidatePlanTags(context.goal.userId);
  }
}

/**
 * Today asks again right after a learner's change when the plan it saved still needs the phase
 * dates moved: the change replaced the proposal waiting (see `APPLIED_LEVERS`), but a change of
 * focus keeps the dates, so the challenges the card was about still came before their lessons,
 * with no card until the next session's run (career 1230, 2107). The change's plan is planned from
 * the context before it with its own state and planning (see `getChangePlanning`), so moving the
 * dates is planned the same way. Applying Today's own proposal moved every end it needed to.
 */
export async function askPhaseDatesAfterChange({
  bringBackSetAside,
  computed,
  context,
  operations,
}: {
  /** The change's plan brought work set aside for time back (see `ComputedChange`). */
  bringBackSetAside: boolean;
  computed: ComputedPlan;
  context: PlanContext;
  operations: readonly PlanOperation[];
}): Promise<void> {
  if (operations.some((operation) => operation.kind === "fitPhaseDates")) {
    return;
  }

  const { mode, todayExceptAreas } = getChangePlanning(operations);

  await updatePhaseDatesProposal({
    computed,
    context,
    mode,
    pace: "saved",
    planning: { bringBackSetAside, state: computed.state, todayExceptAreas },
    revalidation: "now",
    writeVersion: {
      ...context.plan,
      inputVersion: context.plan.inputVersion + 1,
      version: context.plan.version + 1,
    },
  });
}

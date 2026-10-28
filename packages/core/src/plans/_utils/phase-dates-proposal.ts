import "server-only";
import { isDeepStrictEqual } from "node:util";
import { type TransactionClient, prisma } from "@zoonk/db";
import { PHASE_DATES_SOURCE } from "../plan-change-contract";
import { type PlanningMode } from "../planner/build-plan";
import {
  getPhaseDatesEffect,
  isKeptOver,
  isPhaseDatesMoveWorth,
  mayCostToKeepPhaseDates,
  showsPhaseDatesMove,
} from "../planner/phase-dates-move";
import { type PlanEffect } from "../planner/plan-effect";
import { type PlanPhase, type PlanState } from "../planner/plan-state";
import { planPhaseDatesMove } from "./moved-phase-dates";
import { parsePlanChangePayload, toPlanChangePayload } from "./plan-change-payload";
import { type PlanContext } from "./plan-context";
import { writePlanMetadata } from "./plan-metadata-write";
import { getPlanPreviewBasis } from "./plan-preview-basis";
import { type ComputedPlan, type PlanTagRevalidation, revalidatePlanTags } from "./replan";
import { getBuiltChange } from "./seen-effect";

type ChangePlanning = {
  bringBackSetAside: boolean;
  state: PlanState;
  todayExceptAreas: readonly string[] | null;
};

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

function getMovedDatesEffect({
  computed,
  moved,
}: {
  computed: ComputedPlan;
  moved: ComputedPlan;
}): PlanEffect {
  return {
    ...getBuiltChange({ after: moved, before: computed }),
    ...getPhaseDatesEffect({
      graph: computed.state.graph,
      kept: computed.built,
      moved: moved.built,
      shown: computed.built.phases,
    }),
  };
}

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

async function loadPhaseDatesChanges(
  planId: string,
  client: Pick<TransactionClient, "planChange"> = prisma,
) {
  const changes = await client.planChange.findMany({
    orderBy: { id: "asc" },
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
    payload: change.payload,
    status: change.status,
  }));
}

export async function withdrawUnneededPhaseDatesProposal({
  computed,
  context,
  revalidation,
}: {
  computed?: ComputedPlan;
  context: PlanContext;
  revalidation: PlanTagRevalidation;
}): Promise<void> {
  if (computed && mayCostToKeepPhaseDates(computed.built)) {
    return;
  }

  const earlier = await loadPhaseDatesChanges(context.plan.id);

  const waiting = earlier.filter(
    (change) =>
      change.status === "proposed" &&
      (computed || !startsFromEnds({ effect: change.effect, phases: context.phases })),
  );

  if (waiting.length === 0) {
    return;
  }

  const { count } = await writePlanMetadata({
    context,
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

export async function preparePhaseDatesProposal({
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
}): Promise<((tx: TransactionClient) => Promise<void>) | null> {
  const moved = await findMovedPhaseDates({ computed, context, mode, pace, planning });
  const found = moved ? getMovedDatesEffect({ computed, moved }) : null;
  const effect = found && showsPhaseDatesMove(found) ? found : null;

  return async (tx) => {
    const earlier = await loadPhaseDatesChanges(context.plan.id, tx);
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

    const stale = waiting.filter((change) => change.id !== current?.id).map((change) => change.id);

    await tx.planChange.updateMany({
      data: { status: "replaced" },
      where: { id: { in: stale }, status: "proposed" },
    });

    if (current) {
      await tx.planChange.updateMany({
        data: {
          payload: toPlanChangePayload({
            ...parsePlanChangePayload(current.payload),
            previewBasis: getPlanPreviewBasis(context),
          }),
        },
        where: { id: current.id, status: "proposed" },
      });
    }

    if (effect && !kept && !current) {
      await tx.planChange.create({
        data: {
          kind: "edited",
          payload: toPlanChangePayload({
            effect,
            operations: [{ kind: "fitPhaseDates" }],
            previewBasis: getPlanPreviewBasis(context),
            source: PHASE_DATES_SOURCE,
          }),
          planId: context.plan.id,
          reason: "",
          status: "proposed",
        },
      });
    }
  };
}

import "server-only";
import { type TransactionClient } from "@zoonk/db";
import { getEstimateChange } from "../../plans/_utils/estimate-change";
import { preparePhaseDatesProposal } from "../../plans/_utils/phase-dates-proposal";
import { parsePlanChangePayload } from "../../plans/_utils/plan-change-payload";
import { type PlanContext } from "../../plans/_utils/plan-context";
import { type PlanSummary, readFreshPlanSummary } from "../../plans/_utils/plan-summary";
import { preparePlanWrite, prepareRetainedPlanWrite } from "../../plans/_utils/prepare-plan-write";
import { type PlanChangeRecord } from "../../plans/_utils/replan";
import { getSettledPlanChange } from "../../plans/_utils/settled-change";
import { type PlanWrite, writePlan } from "../../plans/_utils/write-plan";
import { PHASE_DATES_SOURCE } from "../../plans/plan-change-contract";
import { toIsoDate } from "../../plans/planner/plan-calendar";
import { type PlanState } from "../../plans/planner/plan-state";
import { type SelectedDayPlan } from "./selected-day-plan";

export function getSelectedPlanChange(selection: SelectedDayPlan): PlanChangeRecord | null {
  const { computed, context, left } = selection;

  if (!computed) {
    return null;
  }

  if (left.length === 0) {
    return getEstimateChange({ computed, context });
  }

  return getSettledPlanChange({ computed, context, left });
}

type SelectedPlanMetadata = {
  graph?: PlanState["graph"];
  inputsKey?: string;
  summary?: PlanSummary;
};

/** Only materialized data enters the transaction; lazy advice cannot extend its lock lifetime. */
type ProposalWrite = (tx: TransactionClient) => Promise<void>;

export type PreparedSelectedPlanSave =
  | { kind: "skip" }
  | {
      data: SelectedPlanMetadata | null;
      kind: "metadata";
      previews?: PlanWrite["previews"];
      proposals?: ProposalWrite | null;
    }
  | {
      change: PlanChangeRecord | null;
      kind: "computed";
      replacesPhaseDates: boolean;
      write: PlanWrite;
      proposals?: ProposalWrite | null;
    };

function prepareMetadata(selection: SelectedDayPlan): SelectedPlanMetadata | null {
  const { context } = selection;
  const update = selection.inputKeyUpdate;

  const summary = readFreshPlanSummary({
    basis: {
      layoutInputVersion: context.plan.inputVersion,
      layoutStudyDay: toIsoDate(context.today),
      planId: context.plan.id,
      planVersion: context.plan.version,
      timeZone: context.timeZone,
      userId: context.goal.userId,
    },
    value: context.plan.summary,
  });

  const selected = update?.summary ?? summary?.selected;

  if (!selected && !update) {
    return null;
  }

  return {
    ...(update && { graph: update.graph, inputsKey: update.inputsKey }),
    ...(selected && {
      summary: {
        basis: {
          layoutInputVersion: context.plan.inputVersion + 1,
          layoutStudyDay: toIsoDate(context.today),
          planId: context.plan.id,
          planVersion: context.plan.version,
          timeZone: context.timeZone,
          userId: context.goal.userId,
        },
        ...(summary?.advice && { advice: summary.advice }),
        schemaVersion: 2,
        selected,
      },
    }),
  };
}

/** The same selected plan's exact write and notice are prepared before taking any row locks. */
export async function prepareSelectedPlanSave({
  selection,
  shown,
}: {
  selection: SelectedDayPlan;
  shown: boolean;
}): Promise<PreparedSelectedPlanSave> {
  const { computed, context } = selection;

  if (!shown) {
    return { kind: "skip" };
  }

  const candidate = computed ?? selection.retained;

  const proposals = candidate
    ? await preparePhaseDatesProposal({
        computed: candidate,
        context: {
          ...context,
          plan: {
            ...context.plan,
            inputVersion: context.plan.inputVersion + 1,
            version: context.plan.version + Number(computed !== null),
          },
        },
        mode: selection.left.length > 0 ? "forced" : "automatic",
        pace: "saved",
      })
    : null;

  if (!computed) {
    const retained = candidate
      ? await prepareRetainedPlanWrite({ computed: candidate, context })
      : null;

    const metadata = prepareMetadata(selection);

    return {
      data: retained
        ? {
            graph: retained.graph,
            inputsKey: retained.inputsKey ?? undefined,
            summary: retained.summary ?? undefined,
          }
        : metadata,
      kind: "metadata",
      previews: retained?.previews,
      proposals,
    };
  }

  const change = getSelectedPlanChange(selection);

  return {
    change,
    kind: "computed",
    proposals,
    replacesPhaseDates: replacesPhaseDates(change),
    write: await preparePlanWrite({
      computed,
      context: {
        ...context,
        plan: { ...context.plan, inputVersion: context.plan.inputVersion + 1 },
      },
    }),
  };
}

export async function saveSelectedPlan({
  acknowledge,
  context,
  prepared,
  tx,
}: {
  acknowledge?: { inputVersion: number; studyDay: string; version: number };
  context: PlanContext;
  prepared: PreparedSelectedPlanSave;
  tx: TransactionClient;
}): Promise<number> {
  if (prepared.kind === "skip") {
    return context.plan.version;
  }

  if (prepared.kind === "metadata") {
    if (prepared.data) {
      await tx.plan.update({ data: prepared.data, where: { id: context.plan.id } });
    }

    await Promise.all(
      (prepared.previews ?? []).map((preview) =>
        tx.planChange.updateMany({
          data: { payload: preview.payload },
          where: { id: preview.id, status: "proposed" },
        }),
      ),
    );

    await prepared.proposals?.(tx);
    return context.plan.version;
  }

  await writePlan({
    context: { ...context, plan: { ...context.plan, inputVersion: context.plan.inputVersion + 1 } },
    plan: prepared.write,
    tx,
  });

  await prepared.proposals?.(tx);

  const { change } = prepared;

  if (change) {
    if (prepared.replacesPhaseDates) {
      await tx.planChange.updateMany({
        data: { status: "replaced" },
        where: {
          payload: { equals: PHASE_DATES_SOURCE, path: ["source"] },
          planId: context.plan.id,
          status: "proposed",
        },
      });
    }

    await tx.planChange.create({
      data: {
        kind: change.kind,
        payload: {
          ...change.payload,
          ...(acknowledge && { acknowledgedRead: acknowledge, seenAt: new Date().toISOString() }),
          versionAfter: context.plan.version + 1,
        },
        planId: context.plan.id,
        reason: change.reason,
        status: change.status,
      },
    });
  }

  return context.plan.version + 1;
}

/**
 * Whether a change the selected plan saves moves the phase dates itself: a waiting proposal to
 * move them no longer describes the plan, so saving it replaces that proposal.
 */
function replacesPhaseDates(change: PlanChangeRecord | null): boolean {
  return (
    change !== null && (parsePlanChangePayload(change.payload).effect?.phaseEnds?.length ?? 0) > 0
  );
}

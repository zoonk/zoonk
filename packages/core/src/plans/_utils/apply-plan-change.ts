import "server-only";
import { type TransactionClient } from "@zoonk/db";
import {
  type OfficialExamDate,
  findOfficialDateConflict,
  loadExamNoticeFacts,
} from "../../exams/_utils/exam-notice-facts";
import { type PlanOperation } from "../plan-contract";
import { getFocusTargets } from "../planner/focus-targets";
import { toIsoDate } from "../planner/plan-calendar";
import { needsApproval } from "../planner/plan-effect";
import { type PlanChangeRefusal } from "../planner/plan-operations";
import { type PlanGraph, type PlanState } from "../planner/plan-state";
import { commitPlan } from "./commit-plan";
import { computeChange } from "./compute-change";
import { followPlanToday } from "./follow-plan-today";
import { markPlanWrite } from "./mark-plan-write";
import { findUnfundedMove, hasMissingWeeklyMove } from "./missing-weekly-move";
import { applyChangeOperations } from "./part-areas";
import { type PlanChangeSource, toPlanChangePayload } from "./plan-change-payload";
import { type PlanContext, getStateTargetDate } from "./plan-context";
import { writePlanMetadata } from "./plan-metadata-write";
import { getPlanPreviewBasis } from "./plan-preview-basis";
import { ensureQuickBaseLessons } from "./quick-bases";
import { replaceWaitingProposals } from "./replace-waiting-proposals";
import { type ComputedChange, type PlanChangeRecord, revalidatePlanTags } from "./replan";
import { getAskedAreas, getChangePlanning } from "./steered-areas";

type Provenance = NonNullable<PlanChangeRecord["provenance"]>;

export type AppliedChange =
  | { changeId: string; replaced?: string[]; status: "applied" | "proposed" }
  | PlanChangeRefusal;

type UnchangedPlan = { status: "unchanged" };

export type UnchangedFocusReason = "alreadyIn" | "cantMove";

function hasEveryLesson({
  areas,
  computed,
}: {
  areas: readonly string[];
  computed: ComputedChange["computed"];
}): boolean {
  const { graph, settings } = computed.state;
  const dropped = new Set(computed.built.droppedSkillIds);
  const targets = getFocusTargets({ areas, graph, settings });

  return targets.every((target) => [...target.skillIds].every((id) => !dropped.has(id)));
}

export function isPlanReady(context: Pick<PlanContext, "state">): boolean {
  return context.state.graph.skills.length > 0;
}

type ChangeRequest = {
  context: PlanContext;
  extraWrites?: (tx: TransactionClient) => Promise<unknown>;
  followToday?: boolean;
  operations: readonly PlanOperation[];
  provenance?: Provenance | null;
  reason: string;
  source: PlanChangeSource;
};

async function commitEdit({
  change: { bringsBackSetAside, computed, effect },
  context,
  extraWrites,
  followToday = false,
  operations,
  provenance = null,
  reason,
  source,
}: ChangeRequest & { change: ComputedChange }): Promise<AppliedChange> {
  let replaced: string[] = [];

  const changeId = await commitPlan({
    change: {
      kind: "edited",
      payload: toPlanChangePayload({ effect, operations: [...operations], source }),
      provenance,
      reason,
      status: "applied",
    },
    computed,
    context,
    extraWrites: async (tx) => {
      await extraWrites?.(tx);

      replaced = await replaceWaitingProposals({
        applied: true,
        operations,
        planId: context.plan.id,
        source,
        tx,
      });
    },
    phaseDates: {
      ...getChangePlanning(operations),
      pace: "saved",
      planning: {
        ...getChangePlanning(operations),
        bringBackSetAside: bringsBackSetAside,
        state: computed.state,
      },
    },
    replacement: { applied: true, operations, source },
  });

  if (followToday) {
    await followPlanToday({ changeId, context });
  }

  return { changeId: changeId ?? "", replaced, status: "applied" };
}

async function savePlanState({
  context,
  operations,
  source,
  state,
}: Pick<ChangeRequest, "context" | "operations" | "source"> & { state: PlanState }) {
  await writePlanMetadata({
    context,
    write: async (tx) => {
      await markPlanWrite(tx, context.plan);

      await tx.goal.update({
        data: { dailyMinutes: state.goal.dailyMinutes, targetDate: getStateTargetDate(state) },
        where: { id: context.goal.id },
      });

      await tx.plan.update({ data: { settings: state.settings }, where: { id: context.plan.id } });

      await replaceWaitingProposals({
        applied: false,
        operations,
        planId: context.plan.id,
        source,
        tx,
      });
    },
  });
}

async function computeRequest({
  context,
  operations,
  source,
}: Pick<ChangeRequest, "context" | "operations" | "source">): Promise<
  { change: ComputedChange; status: "computed" } | PlanChangeRefusal | { status: "saved" }
> {
  const result = await applyChangeOperations({ context, operations });

  if ("error" in result) {
    return { error: result.error, status: "invalid" };
  }

  if (!isPlanReady(context)) {
    await savePlanState({ context, operations, source, state: result.state });
    revalidatePlanTags(context.goal.userId);
    return { status: "saved" };
  }

  await ensureQuickBaseLessons(result.state.settings);

  const change = await computeChange({
    context,
    operations: result.operations,
    state: result.state,
  });

  if (hasMissingWeeklyMove({ items: change.computed.built.items, operations })) {
    const unfundedMove = findUnfundedMove({
      items: context.items,
      operations,
      unfunded: change.computed.built.mocks.unfundedMocks,
    });

    return unfundedMove
      ? { error: "unfundedMove", status: "invalid", unfundedMove }
      : { error: "badMove", status: "invalid" };
  }

  if (change.unchanged && operations.every((operation) => operation.kind === "setBaseChoices")) {
    await savePlanState({ context, operations, source, state: result.state });
    revalidatePlanTags(context.goal.userId);
    return { status: "saved" };
  }

  return { change, status: "computed" };
}

export async function applyChangeNow(
  request: ChangeRequest,
): Promise<AppliedChange | { status: "saved" }> {
  const computed = await computeRequest(request);

  if (computed.status !== "computed") {
    return computed;
  }

  return commitEdit({ ...request, change: computed.change });
}

export async function applySteeringNow(
  request: ChangeRequest,
): Promise<
  AppliedChange | { status: "saved" } | { reason: UnchangedFocusReason; status: "unchanged" }
> {
  const computed = await computeRequest(request);

  if (computed.status !== "computed") {
    return computed;
  }

  const { change } = computed;
  const focusOnly = request.operations.every((operation) => operation.kind === "focusAreas");

  if (focusOnly ? change.unchanged : change.contradicts) {
    const { context, operations } = request;
    const areas = getAskedAreas({ focused: context.state.settings.focusAreas, operations });
    const allIn = hasEveryLesson({ areas, computed: change.computed });

    return { reason: allIn ? "alreadyIn" : "cantMove", status: "unchanged" };
  }

  return commitEdit({ ...request, change });
}

async function findOfficialDate({
  context,
  operations,
}: {
  context: PlanContext;
  operations: readonly PlanOperation[];
}): Promise<OfficialExamDate | null> {
  const dateChange = operations.findLast((operation) => operation.kind === "setTargetDate");

  if (dateChange?.kind !== "setTargetDate" || dateChange.targetDate === null) {
    return null;
  }

  const facts = await loadExamNoticeFacts(context.goal);

  return findOfficialDateConflict({
    facts,
    targetDate: dateChange.targetDate,
    today: toIsoDate(context.today),
  });
}

export type NoticeChange = {
  edition: string | null;
  graph: PlanGraph | null;
  noticeId: string | null;
};

export async function proposeChange({
  approval = "whenLarge",
  context,
  extraWrites,
  notice = null,
  operations,
  provenance = null,
  reason,
  source,
}: ChangeRequest & { approval?: "always" | "whenLarge"; notice?: NoticeChange | null }): Promise<
  AppliedChange | UnchangedPlan | { status: "saved" }
> {
  const result = await applyChangeOperations({ context, noticeGraph: notice?.graph, operations });

  if ("error" in result) {
    return { error: result.error, status: "invalid" };
  }

  if (!isPlanReady(context)) {
    return applyChangeNow({ context, extraWrites, operations, provenance, reason, source });
  }

  await ensureQuickBaseLessons(result.state.settings);

  const [change, officialDate] = await Promise.all([
    computeChange({ context, operations: result.operations, state: result.state }),
    findOfficialDate({ context, operations }),
  ]);

  if (change.unchanged) {
    return { status: "unchanged" };
  }

  if (approval === "whenLarge" && !officialDate && !needsApproval(change.effect)) {
    return commitEdit({ change, context, extraWrites, operations, provenance, reason, source });
  }

  const proposal = await writePlanMetadata({
    context,
    write: async (tx) => {
      const created = await tx.planChange.create({
        data: {
          kind: "edited",
          payload: toPlanChangePayload({
            effect: change.effect,
            noticeEdition: notice?.edition ?? null,
            noticeGraph: notice?.graph ?? null,
            noticeId: notice?.noticeId ?? null,
            officialDate,
            operations: [...operations],
            previewBasis: getPlanPreviewBasis(context),
            source,
          }),
          planId: context.plan.id,
          reason,
          status: "proposed",
          ...provenance,
        },
      });

      await extraWrites?.(tx);

      const replaced = await replaceWaitingProposals({
        applied: false,
        except: created.id,
        operations,
        planId: context.plan.id,
        source,
        tx,
      });

      return { id: created.id, replaced };
    },
  });

  revalidatePlanTags(context.goal.userId);

  return { changeId: proposal.id, replaced: proposal.replaced, status: "proposed" };
}

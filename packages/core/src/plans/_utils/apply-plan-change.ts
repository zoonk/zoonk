import { type TransactionClient } from "@zoonk/db";
import "server-only";
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
  | {
      changeId: string;
      /** Proposals still waiting that this change replaced (see `replaceWaitingProposals`). */
      replaced?: string[];
      status: "applied" | "proposed";
    }
  | PlanChangeRefusal;

/** The plan would stay as it is (see `computeChange`): nothing is offered. */
type UnchangedPlan = { status: "unchanged" };

/**
 * Why a focus would leave the plan as it is: the subjects it asks more of (see `getAskedAreas`)
 * already have every lesson in the plan (`alreadyIn`), or they already start as early as what they
 * build on allows and more of them doesn't fit (`cantMove`).
 */
export type UnchangedFocusReason = "alreadyIn" | "cantMove";

/** Whether every skill these areas focus on (their parts, when named) has all its lessons in. */
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

/** A plan is ready once its graph has skills; before that, a change only updates the settings. */
export function isPlanReady(context: Pick<PlanContext, "state">): boolean {
  return context.state.graph.skills.length > 0;
}

type ChangeRequest = {
  context: PlanContext;
  /** Other writes that must land with the change, such as ending the plan setup task it is. */
  extraWrites?: (tx: TransactionClient) => Promise<unknown>;
  /**
   * The learner made the change in their own request, so today's session follows it now (see
   * `followPlanToday`). Changes the system applies reach a day not started the next time it's read.
   */
  followToday?: boolean;
  operations: readonly PlanOperation[];
  provenance?: Provenance | null;
  reason: string;
  source: PlanChangeSource;
};

/** Saves a computed edit and records it with the state its undo restores. */
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
  });

  if (followToday) {
    await followPlanToday({ changeId, context });
  }

  return { changeId: changeId ?? "", replaced, status: "applied" };
}

/** Saves settings without laying out a plan, answering proposals about the same choices. */
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

/** A change's operations applied to the plan's state and planned, or why they can't be. */
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

  // A stale or inconsistent source day must not save a move with no challenge at its destination.
  // The caller would otherwise report success, skip today's block and lose its confirmation/Undo.
  if (hasMissingWeeklyMove({ items: change.computed.built.items, operations })) {
    // A mock the plan can't fund there (see `fundMocks`) or place before the goal's date is refused
    // with why; a weekly challenge that can't go there is a bad move.
    const unfundedMove = findUnfundedMove({
      items: context.items,
      operations,
      unfunded: change.computed.built.mocks.unfundedMocks,
    });

    return unfundedMove
      ? { error: "unfundedMove", status: "invalid", unfundedMove }
      : { error: "badMove", status: "invalid" };
  }

  // How to study bases, when it moves no lesson, is kept for later runs and changes nothing now: a
  // quick lesson for a base whose core the learner studied re-planned the day and let cell theory
  // go for work missed days had set aside.
  if (change.unchanged && operations.every((operation) => operation.kind === "setBaseChoices")) {
    await savePlanState({ context, operations, source, state: result.state });
    revalidatePlanTags(context.goal.userId);
    return { status: "saved" };
  }

  return { change, status: "computed" };
}

/**
 * Applies a change right away and re-plans from today, recording it with the state an undo
 * restores. Learners' own changes go through here; so do proposals small enough to need no OK.
 */
export async function applyChangeNow(
  request: ChangeRequest,
): Promise<AppliedChange | { status: "saved" }> {
  const computed = await computeRequest(request);

  if (computed.status !== "computed") {
    return computed;
  }

  return commitEdit({ ...request, change: computed.change });
}

/**
 * Applies the learner's choice of where to focus, or of areas to give less time, like
 * `applyChangeNow`, except when it wouldn't do what it asks: a focus that would leave the plan as
 * it is, or a change that would do the opposite in the plan the learner sees (see
 * `ComputedChange.contradicts`), isn't saved, and the learner is told nothing moved, and why,
 * instead of seeing a change that does nothing or ends what they wanted less of sooner. Less of an
 * area that keeps every lesson because everything fits is saved, its card saying so, for when time
 * gets short.
 */
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

/**
 * The exam day the notice officially sets, when a change moves the goal's date off it: the change
 * says so, and the learner keeps their own date only by applying it knowing that.
 */
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

/** What a change the exam's notice brings keeps with it (see `followNotice`). */
export type NoticeChange = {
  /** The edition its graph was read from (see `getNoticeEdition`). */
  edition: string | null;
  graph: PlanGraph | null;
  noticeId: string | null;
};

/**
 * A change someone other than the learner suggests (the plan-edit AI, memory, a rebalance): never
 * offered when it would leave the plan as it is, applied at once when it moves at most a lesson and
 * the end date by a day, otherwise stored as a proposal with its effect, waiting for the learner's
 * OK. With `approval: "always"` (the buddy, in the conversation, and the exam's notice) even a
 * small change waits for the learner's tap, and so does one that moves an exam off the day its
 * notice sets, which keeps that day with it to say.
 */
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

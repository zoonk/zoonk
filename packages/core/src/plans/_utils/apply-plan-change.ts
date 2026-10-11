import "server-only";
import { type TransactionClient, prisma } from "@zoonk/db";
import {
  type OfficialExamDate,
  findOfficialDateConflict,
  loadExamNoticeFacts,
} from "../../exams/_utils/exam-notice-facts";
import { type PlanOperation } from "../plan-contract";
import { getFocusTargets } from "../planner/focus-targets";
import { toIsoDate } from "../planner/plan-calendar";
import { needsApproval } from "../planner/plan-effect";
import { type PlanOperationError } from "../planner/plan-operations";
import { type PlanGraph, type PlanState } from "../planner/plan-state";
import { getChangeLevers, replacesProposal } from "./change-levers";
import { type ComputedChange, computeChange } from "./compute-change";
import { followPlanToday } from "./follow-plan-today";
import { applyChangeOperations } from "./part-areas";
import { askPhaseDatesAfterChange } from "./phase-dates-proposal";
import {
  type PlanChangeSource,
  parsePlanChangePayload,
  toPlanChangePayload,
} from "./plan-change-payload";
import { type PlanContext, getStateTargetDate } from "./plan-context";
import { ensureQuickBaseLessons } from "./quick-bases";
import { type PlanChangeRecord, commitPlan, revalidatePlanTags } from "./replan";
import { getAskedAreas } from "./steered-areas";

type Provenance = NonNullable<PlanChangeRecord["provenance"]>;

export type AppliedChange =
  | {
      changeId: string;
      /** Proposals still waiting that this change replaced (see `replaceWaitingProposals`). */
      replaced?: string[];
      status: "applied" | "proposed";
    }
  | { error: PlanOperationError; status: "invalid" };

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

/**
 * Saves a new state without planning: the goal's time and the settings, so the plan is built from
 * them when it is, or keeps them for the next run when they move no lesson.
 */
async function saveStateOnly({ context, state }: { context: PlanContext; state: PlanState }) {
  await prisma.$transaction([
    prisma.goal.update({
      data: { dailyMinutes: state.goal.dailyMinutes, targetDate: getStateTargetDate(state) },
      where: { id: context.goal.id },
    }),
    prisma.plan.update({ data: { settings: state.settings }, where: { id: context.plan.id } }),
  ]);

  revalidatePlanTags(context.goal.userId);
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

/**
 * A change applied re-plans from today and lays the phase dates out again, so it changes the phase
 * dates too: a proposal to move the ones the learner saw no longer describes the plan (the next
 * system refresh asks again when keeping the new ones leaves lessons out).
 */
const APPLIED_LEVERS = ["phaseDates"];

/**
 * One rule for every proposal, whoever made it (the buddy, the exam's notice, memory, a
 * rebalance): it waits for the learner's own answer until a newer change, proposed or made,
 * changes the same thing (see `getChangeLevers`, and `APPLIED_LEVERS` for a change applied). Then
 * it's `replaced`, so the learner never answers two changes that contradict, and its card says so.
 * Proposals about other things stay answerable. Returns the ones it replaced.
 */
export async function replaceWaitingProposals({
  applied,
  except = null,
  operations,
  planId,
  source,
}: {
  applied: boolean;
  except?: string | null;
  operations: readonly PlanOperation[];
  planId: string;
  source: PlanChangeSource;
}): Promise<string[]> {
  const newer = new Set([
    ...getChangeLevers({ operations, source }),
    ...(applied ? APPLIED_LEVERS : []),
  ]);

  const waiting = await prisma.planChange.findMany({
    select: { id: true, payload: true },
    where: { planId, status: "proposed", ...(except ? { id: { not: except } } : {}) },
  });

  const replaced = waiting.flatMap((change) => {
    const payload = parsePlanChangePayload(change.payload);
    const levers = getChangeLevers({ operations: payload.operations, source: payload.source });
    return replacesProposal({ newer, waiting: levers }) ? [change.id] : [];
  });

  if (replaced.length > 0) {
    await prisma.planChange.updateMany({
      data: { status: "replaced" },
      where: { id: { in: replaced }, status: "proposed" },
    });
  }

  return replaced;
}

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
    extraWrites,
  });

  if (followToday) {
    await followPlanToday({ changeId, context });
  }

  const replaced = await replaceWaitingProposals({
    applied: true,
    operations,
    planId: context.plan.id,
    source,
  });

  if (replaced.length > 0) {
    revalidatePlanTags(context.goal.userId);
  }

  await askPhaseDatesAfterChange({
    bringBackSetAside: bringsBackSetAside,
    computed,
    context,
    operations,
  });

  return { changeId: changeId ?? "", replaced, status: "applied" };
}

/** A change's operations applied to the plan's state and planned, or why they can't be. */
async function computeRequest({
  context,
  operations,
}: Pick<ChangeRequest, "context" | "operations">): Promise<
  | { change: ComputedChange; status: "computed" }
  | { error: PlanOperationError; status: "invalid" }
  | { status: "saved" }
> {
  const result = await applyChangeOperations({ context, operations });

  if ("error" in result) {
    return { error: result.error, status: "invalid" };
  }

  if (!isPlanReady(context)) {
    await saveStateOnly({ context, state: result.state });
    return { status: "saved" };
  }

  await ensureQuickBaseLessons(result.state.settings);

  const change = await computeChange({
    context,
    operations: result.operations,
    state: result.state,
  });

  // How to study bases, when it moves no lesson, is kept for later runs and changes nothing now: a
  // quick lesson for a base whose core the learner studied re-planned the day and let cell theory
  // go for work missed days had set aside.
  if (change.unchanged && operations.every((operation) => operation.kind === "setBaseChoices")) {
    await saveStateOnly({ context, state: result.state });
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

  const proposal = await prisma.$transaction(async (tx) => {
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
          source,
        }),
        planId: context.plan.id,
        reason,
        status: "proposed",
        ...provenance,
      },
    });

    await extraWrites?.(tx);
    return created;
  });

  const replaced = await replaceWaitingProposals({
    applied: false,
    except: proposal.id,
    operations,
    planId: context.plan.id,
    source,
  });

  revalidatePlanTags(context.goal.userId);

  return { changeId: proposal.id, replaced, status: "proposed" };
}

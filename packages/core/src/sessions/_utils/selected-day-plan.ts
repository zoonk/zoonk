import "server-only";
import { type Goal } from "@zoonk/db";
import { type GoalPlanSource } from "../../learner/_utils/goal-skill-graph";
import { getEstimateChange } from "../../plans/_utils/estimate-change";
import { loadLeftWorkSelection, selectLeftWork } from "../../plans/_utils/left-work";
import { type PlanContext, loadPlanContext } from "../../plans/_utils/plan-context";
import {
  addsLessonsAfterLessonsDone,
  isPlanLaidOut,
} from "../../plans/_utils/plan-refresh-admission";
import {
  getPlanSummaryBasis,
  planSummarySchema,
  readFreshPlanSummary,
  readPlanSummary,
} from "../../plans/_utils/plan-summary";
import { loadPlanAtToken } from "../../plans/_utils/plan-token";
import { isPlanUnchanged } from "../../plans/_utils/plan-unchanged";
import { type ComputedPlan, computePlan } from "../../plans/_utils/replan";
import { type SelectedSummary } from "../../plans/_utils/selected-summary-contract";
import { getItemKey } from "../../plans/planner/plan-items";
import { type PlanPhase, type PlanState } from "../../plans/planner/plan-state";
import { type SessionPlanItem, getSessionItemIdentity } from "./session-plan-item";

/** A request selects once; the writer saves this allocation with its session. */
export type SelectedDayPlan = {
  computed: ComputedPlan | null;
  retained?: ComputedPlan;
  context: PlanContext;
  /** A recount can update its input fingerprint without rewriting the learner's shown layout. */
  inputKeyUpdate?: {
    graph: PlanState["graph"];
    inputsKey: string;
    summary: SelectedSummary | null;
    computed: ComputedPlan;
  };
  items: SessionPlanItem[];
  left: PlanContext["items"];
  phases: PlanPhase[];
  source: GoalPlanSource;
  state: PlanState;
  summary: SelectedSummary | null;
};

function toSource({
  items,
  phases,
  state,
}: Pick<SelectedDayPlan, "items" | "phases" | "state">): GoalPlanSource {
  return {
    graph: state.graph,
    items: items.map((item) => ({ ...item, id: getSessionItemIdentity(item) })),
    phases,
    settings: state.settings,
  };
}

function savedSelection({
  context,
  summary,
}: {
  context: PlanContext;
  summary: SelectedSummary | null;
}): SelectedDayPlan {
  const items = context.items.map((item) => ({
    ...item,
    facts: item.facts ?? null,
    lessons: item.lessons ?? null,
    minutes: item.minutes ?? null,
  }));

  const state = context.state;
  const phases = context.phases;

  return {
    computed: null,
    context,
    items,
    left: [],
    phases,
    source: toSource({ items, phases, state }),
    state,
    summary,
  };
}

/**
 * Missing persisted checkpoints are a reconciliation; an automatic advisory layout is not. The
 * phase after an exam has none by design (see `listBossCandidates`).
 */
function needsCheckpointReconciliation(context: PlanContext): boolean {
  if (!context.phases.some((phase) => phase.startDate !== null)) {
    return false;
  }

  const challenges = new Set(
    context.items.filter((item) => item.kind === "boss").map((item) => item.phase),
  );

  return context.items.some(
    (item) =>
      (item.kind === "lesson" || item.kind === "chapter") &&
      item.status !== "skipped" &&
      !challenges.has(item.phase) &&
      context.phases[item.phase]?.kind !== "afterExam",
  );
}

/** A day rollover cannot replace a shown layout whose actual inputs are still current. */
function keepsShownLayout(context: PlanContext): boolean {
  const stored = planSummarySchema.safeParse(context.plan.summary);

  const hasManualPlaceholder = context.items.some(
    (item) => item.chapterId !== null && item.lessonId === null && !item.facts,
  );

  const hasShownLayout = isPlanLaidOut(context) || hasManualPlaceholder;

  const sameInputs =
    !stored.success ||
    (stored.data.basis.layoutInputVersion === context.plan.inputVersion &&
      readFreshPlanSummary({
        basis: {
          ...getPlanSummaryBasis(context),
          layoutStudyDay: stored.data.basis.layoutStudyDay,
        },
        value: context.plan.summary,
      }) !== null);

  return hasShownLayout && sameInputs && !needsCheckpointReconciliation(context);
}

/** Start and Continue select from fresh inputs before saving their queue. */
export async function selectDayPlan({
  goal,
  now,
  timeZone,
  useFreshSaved = false,
}: {
  useFreshSaved?: boolean;
  goal: Goal;
  now: Date;
  timeZone: string;
}): Promise<SelectedDayPlan | null> {
  const context = await loadPlanAtToken(goal.id, { now, timeZone });

  if (!context || (context.items.length === 0 && context.state.graph.skills.length === 0)) {
    return null;
  }

  return selectDayPlanFromContext({ context, now, useFreshSaved });
}

/** Queue writers select from one authorized context without loading it twice. */
export async function selectDayPlanFromContext({
  context,
  now,
  useFreshSaved = false,
}: {
  context: PlanContext;
  now: Date;
  useFreshSaved?: boolean;
}): Promise<SelectedDayPlan> {
  const fresh = readFreshPlanSummary({
    basis: getPlanSummaryBasis(context),
    value: context.plan.summary,
  });

  if (useFreshSaved && fresh?.basis.layoutInputVersion === context.plan.inputVersion) {
    return savedSelection({ context, summary: fresh.selected });
  }

  // A legacy item-only goal has no graph to rebuild; its real saved work remains playable.
  if (context.state.graph.skills.length === 0) {
    return savedSelection({ context, summary: fresh?.selected ?? null });
  }

  const { left, snapshot } = await loadLeftWorkSelection(context);

  const request = {
    carrySnapshot: snapshot,
    context,
    keepPhaseDates: true,
    mode: left.length > 0 ? ("forced" as const) : ("automatic" as const),
    now,
    setAsideLeftWork: left.length > 0,
    todayShown: true,
  };

  const computed =
    useFreshSaved && canSkipBuild({ fresh, left })
      ? await computePlan({ ...request, skipUnchangedInputs: true })
      : await computePlan(request);

  if (!computed) {
    return savedSelection({ context, summary: fresh?.selected ?? null });
  }

  const unchanged =
    left.length === 0 &&
    isPlanUnchanged({ computed, context }) &&
    getEstimateChange({ computed, context }) === null;

  // Day rollover alone is not permission to reselect teaching. Real changed inputs still rebuild.
  // The refresh writer's finished-scope rule also applies when a read or Open selects its work.
  if (
    addsLessonsAfterLessonsDone({ computed, context }) ||
    unchanged ||
    (left.length === 0 && keepsShownLayout(context))
  ) {
    return retainSelection({ computed, context, fresh, unchanged });
  }

  const items = computed.built.items.map((item, position) => ({
    ...item,
    facts: computed.itemFacts.get(item.key)
      ? { ...computed.itemFacts.get(item.key), schemaVersion: 1 }
      : null,
    lessons: item.lessons ?? null,
    position,
  }));

  const state = computed.state;
  const phases = computed.built.phases;

  return {
    computed,
    context,
    items,
    left,
    phases,
    source: toSource({ items, phases, state }),
    state,
    summary: computed.selected,
  };
}

function retainSelection({
  computed,
  context,
  fresh,
  unchanged,
}: {
  computed: ComputedPlan;
  context: PlanContext;
  fresh: ReturnType<typeof readFreshPlanSummary>;
  unchanged: boolean;
}): SelectedDayPlan {
  const summary = unchanged ? computed.summarizeRetained() : null;

  const selection = {
    ...savedSelection({ context, summary: summary ?? fresh?.selected ?? null }),
    retained: computed,
  };

  if (!unchanged || (computed.inputsKey === context.plan.inputsKey && fresh)) {
    return selection;
  }

  return {
    ...selection,
    inputKeyUpdate: {
      computed,
      graph: computed.state.graph,
      inputsKey: computed.inputsKey,
      summary,
    },
  };
}

function canSkipBuild({
  fresh,
  left,
}: {
  fresh: ReturnType<typeof readFreshPlanSummary>;
  left: readonly unknown[];
}): boolean {
  return fresh !== null && left.length === 0;
}

/** Actual lessons the selected settling carried; the Plan never applies Today's quiet-day rule. */
export function getSelectedCatchUpItems({
  items,
  left,
}: Pick<SelectedDayPlan, "items" | "left">): SessionPlanItem[] {
  const leftKeys = new Set(left.map((item) => getItemKey(item)));

  return items.filter(
    (item) =>
      item.status === "todo" &&
      (item.kind === "lesson" || item.kind === "chapter") &&
      (item.lessonId !== null || item.chapterId !== null) &&
      leftKeys.has(item.key ?? getItemKey(item)),
  );
}

/** Screens replay the saved allocation, including earlier unfinished work, whatever its freshness. */
export async function readSavedDayPlan({
  goal,
  now,
  timeZone,
}: {
  goal: Goal;
  now: Date;
  timeZone: string;
}): Promise<SelectedDayPlan | null> {
  const context = await loadPlanContext({ goal, now, timeZone });

  if (!context || context.items.length === 0) {
    return null;
  }

  const summary = readPlanSummary({
    plan: { ...context.plan, userId: goal.userId },
    value: context.plan.summary,
  });

  return {
    ...savedSelection({ context, summary: summary?.selected ?? null }),
    left: selectLeftWork(context),
  };
}

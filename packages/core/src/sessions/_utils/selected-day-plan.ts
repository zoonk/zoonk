import "server-only";
import { type Goal } from "@zoonk/db";
import { type GoalPlanSource } from "../../learner/_utils/goal-skill-graph";
import { getEstimateChange } from "../../plans/_utils/estimate-change";
import { hasOverduePlanWork, loadLeftWorkSelection } from "../../plans/_utils/left-work";
import { type PlanContext, loadPlanContext } from "../../plans/_utils/plan-context";
import {
  addsLessonsAfterLessonsDone,
  isPlanLaidOut,
} from "../../plans/_utils/plan-refresh-admission";
import { readFreshPlanSummary, savedPlanSummarySchema } from "../../plans/_utils/plan-summary";
import { isPlanUnchanged } from "../../plans/_utils/plan-unchanged";
import { type ComputedPlan, computePlan } from "../../plans/_utils/replan";
import { type SelectedSummary } from "../../plans/_utils/selected-summary-contract";
import { toIsoDate } from "../../plans/planner/plan-calendar";
import { getItemKey } from "../../plans/planner/plan-items";
import { type PlanPhase, type PlanState } from "../../plans/planner/plan-state";
import { type SessionPlanItem, getSessionItemIdentity } from "./session-plan-item";

/** A request selects once. Readers and the learner's POST consume this same value. */
export type SelectedDayPlan = {
  /** Existing advice is not authority to add unaccepted teaching on a read or Open. */
  advice?: ComputedPlan;
  computed: ComputedPlan | null;
  context: PlanContext;
  /** A recount can update its input fingerprint without rewriting the learner's shown layout. */
  inputKeyUpdate?: {
    graph: PlanState["graph"];
    inputsKey: string;
    summary: SelectedSummary | null;
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

/** Missing persisted checkpoints are a reconciliation; an automatic advisory layout is not. */
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
      !challenges.has(item.phase),
  );
}

/** A day rollover cannot replace a shown layout whose actual inputs are still current. */
function keepsShownLayout(context: PlanContext): boolean {
  const { goal, timeZone } = context;

  const stored = savedPlanSummarySchema.safeParse(context.plan.summary);

  const hasManualPlaceholder = context.items.some(
    (item) => item.chapterId !== null && item.lessonId === null && !item.facts,
  );

  const hasShownLayout = isPlanLaidOut(context) || hasManualPlaceholder;

  const sameInputs =
    !stored.success ||
    readFreshPlanSummary({
      basis: {
        inputVersion: context.plan.inputVersion,
        planId: context.plan.id,
        planVersion: context.plan.version,
        studyDay: stored.data.basis.studyDay,
        timeZone,
        userId: goal.userId,
      },
      value: context.plan.summary,
    }) !== null;

  return hasShownLayout && sameInputs && !needsCheckpointReconciliation(context);
}

/** Current saved summaries skip the producer. Stale reads build in memory and never save. */
export async function selectDayPlan({
  goal,
  now,
  reuseReadBuild = false,
  timeZone,
}: {
  goal: Goal;
  now: Date;
  /** Only GET delivery opts in; Open and other writers retain the fresh default. */
  reuseReadBuild?: boolean;
  timeZone: string;
}): Promise<SelectedDayPlan | null> {
  const context = await loadPlanContext({ goal, now, timeZone });

  if (!context || context.items.length === 0) {
    return null;
  }

  return selectDayPlanFromContext({ context, now, reuseReadBuild });
}

/** Plan and Today select from one authorized context, without reloading it or building twice. */
export async function selectDayPlanFromContext({
  context,
  now,
  readAnalysis,
  reuseReadBuild,
}: {
  context: PlanContext;
  now: Date;
  /** Plan retains its existing advisory response until the separately agreed R7 cutover. */
  readAnalysis?: boolean;
  /** Only GET delivery opts in; Open and other writers retain the fresh default. */
  reuseReadBuild?: boolean;
}): Promise<SelectedDayPlan> {
  const { goal, timeZone } = context;

  const fresh = readFreshPlanSummary({
    basis: {
      inputVersion: context.plan.inputVersion,
      planId: context.plan.id,
      planVersion: context.plan.version,
      studyDay: toIsoDate(context.today),
      timeZone,
      userId: goal.userId,
    },
    value: context.plan.summary,
  });

  // A legacy item-only goal has no graph to rebuild; its real saved work remains playable.
  if (
    (fresh && !readAnalysis && !hasOverduePlanWork(context)) ||
    context.state.graph.skills.length === 0
  ) {
    return savedSelection({ context, summary: fresh?.selected ?? null });
  }

  const { left, snapshot } = await loadLeftWorkSelection(context);

  const computed = await computePlan({
    carrySnapshot: snapshot,
    context,
    keepPhaseDates: true,
    mode: left.length > 0 ? "forced" : "automatic",
    now,
    readAnalysis,
    reuseReadBuild,
    setAsideLeftWork: left.length > 0,
    todayShown: true,
  });

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
    const retained = unchanged ? computed.summarizeRetained() : null;

    return {
      ...savedSelection({ context, summary: retained ?? fresh?.selected ?? null }),
      ...(readAnalysis && { advice: computed }),
      ...(unchanged && {
        inputKeyUpdate: {
          graph: computed.state.graph,
          inputsKey: computed.inputsKey,
          summary: retained,
        },
      }),
    };
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

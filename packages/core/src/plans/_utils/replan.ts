import "server-only";
import { type PlanChangeStatus, type TransactionClient, prisma } from "@zoonk/db";
import { revalidateCacheTags } from "../../cache/revalidate-cache-tags";
import { getGoalsCacheTag, getLearnerModelCacheTag } from "../../cache/tags";
import { type BuiltPlan, type PlanningMode, buildPlan } from "../planner/build-plan";
import { toIsoDate } from "../planner/plan-calendar";
import { type PlanEffect, getPlanEffect } from "../planner/plan-effect";
import { type PlanFeasibility, getPlanFeasibility } from "../planner/plan-feasibility";
import { type Pace, choosePace } from "../planner/plan-pace";
import { type PlanState } from "../planner/plan-state";
import { getStandInLessons } from "../planner/plan-units";
import { loadPaceSamples } from "./pace-samples";
import { type PlanChangeKind, type StoredPlanChangePayload } from "./plan-change-payload";
import { type PlanContext, getStateTargetDate } from "./plan-context";
import { loadPlannerInputs, resolveMergedSkills } from "./planner-inputs";
import { savePlanItems } from "./save-plan-items";

const MINUTES_PER_HOUR = 60;

/** The course pace compares others on the lessons the learner has coming up. */
const PACE_LESSON_LIMIT = 500;

export type ComputedPlan = {
  built: BuiltPlan;
  effect: PlanEffect;
  feasibility: PlanFeasibility;
  pace: Pace;
  /** The lessons each skill's stand-in plans, for counting what a change adds or skips. */
  standInLessons: Map<string, number>;
  /** The state the plan was built from, with merged skills resolved and the pace and start set. */
  state: PlanState;
};

/** What a planning run records for the learner to see; system runs may record nothing. */
export type PlanChangeRecord = {
  kind: PlanChangeKind;
  payload: StoredPlanChangePayload;
  provenance?: { generatedAt: Date; model: string; promptVersion: string; runId: string } | null;
  reason: string;
  status: PlanChangeStatus;
};

/**
 * Whether a commit clears the plan's caches: right away from actions, route handlers and
 * workflows (`now`), or not at all when it happens while a page renders (`skip`: building today's
 * session from the Today screen or its prefetch). Next.js throws when a render clears caches,
 * even from `after()`, and there is nothing to clear: the plan's tags only tag
 * `"use cache: private"` reads, which no server keeps between requests, and only a Server Action's
 * revalidation reaches the browser's copies.
 */
export type PlanTagRevalidation = "now" | "skip";

/** Another planning run committed first; the caller reloads and tries again. */
class PlanConflictError extends Error {
  constructor() {
    super("The plan changed while it was being planned.");
    this.name = "PlanConflictError";
  }
}

/** Plans a goal from a state without saving anything: what the plan would be and what changes. */
export async function computePlan({
  context,
  mode,
  now = new Date(),
  state = context.state,
}: {
  context: PlanContext;
  mode: PlanningMode;
  now?: Date;
  state?: PlanState;
}): Promise<ComputedPlan> {
  const graph = await resolveMergedSkills(state.graph);
  const targetDate = getStateTargetDate(state);
  const userId = context.goal.userId;
  const inputs = await loadPlannerInputs({ goal: context.goal, graph, targetDate, userId });

  const samples = await loadPaceSamples({
    lessonIds: inputs.lessons.slice(0, PACE_LESSON_LIMIT).map((lesson) => lesson.lessonId),
    now,
    userId,
  });

  const pace = choosePace(samples);

  const settings = {
    ...state.settings,
    pace,
    shortMockMinutes: inputs.shortMockMinutes,
    startDate: state.settings.startDate ?? toIsoDate(context.today),
  };

  const input = {
    ...inputs,
    goal: { dailyMinutes: state.goal.dailyMinutes, kind: context.goal.kind, targetDate },
    graph,
    items: context.items,
    mode,
    paceFactor: pace.factor,
    settings,
    today: context.today,
  };

  const built = buildPlan(input);
  const standInLessons = getStandInLessons({ lessons: inputs.lessons, skills: graph.skills });

  return {
    built,
    effect: getPlanEffect({ after: built.items, before: context.items, standInLessons }),
    feasibility: getPlanFeasibility({ built, input }),
    pace,
    standInLessons,
    state: { ...state, graph, settings },
  };
}

function getGoalUpdate({ context, state }: { context: PlanContext; state: PlanState }) {
  const targetDate = getStateTargetDate(state);
  const sameDate = targetDate?.getTime() === context.goal.targetDate?.getTime();

  if (state.goal.dailyMinutes === context.goal.dailyMinutes && sameDate) {
    return null;
  }

  return { dailyMinutes: state.goal.dailyMinutes, targetDate };
}

/**
 * Saves a computed plan and the change the learner sees, in one transaction. The plan's version
 * guards against a concurrent run; the goal's time settings follow the state.
 */
export async function commitPlan({
  change,
  computed,
  context,
  extraWrites,
  revalidation = "now",
}: {
  change: PlanChangeRecord | null;
  computed: ComputedPlan;
  context: PlanContext;
  /** Other writes that must land with the plan, such as marking a change applied or undone. */
  extraWrites?: (tx: TransactionClient) => Promise<unknown>;
  revalidation?: PlanTagRevalidation;
}): Promise<string | null> {
  const { built, state } = computed;

  const changeId = await prisma.$transaction(async (tx) => {
    const { count } = await tx.plan.updateMany({
      data: {
        estimateHours: built.estimate.totalMinutes / MINUTES_PER_HOUR,
        graph: state.graph,
        phases: built.phases,
        settings: state.settings,
        version: { increment: 1 },
      },
      where: { id: context.plan.id, version: context.plan.version },
    });

    if (count === 0) {
      throw new PlanConflictError();
    }

    const goalUpdate = getGoalUpdate({ context, state });

    if (goalUpdate) {
      await tx.goal.update({ data: goalUpdate, where: { id: context.goal.id } });
    }

    await savePlanItems({
      existing: context.items,
      items: built.items,
      planId: context.plan.id,
      tx,
    });

    await extraWrites?.(tx);

    if (!change) {
      return null;
    }

    const created = await tx.planChange.create({
      data: {
        kind: change.kind,
        payload: { ...change.payload, versionAfter: getVersionAfter(context) },
        planId: context.plan.id,
        reason: change.reason,
        status: change.status,
        ...change.provenance,
      },
    });

    return created.id;
  });

  if (revalidation === "now") {
    revalidatePlanTags(context.goal.userId);
  }

  return changeId;
}

/** The version a commit leaves the plan at: an undo stays possible while it's still current. */
export function getVersionAfter(context: Pick<PlanContext, "plan">): number {
  return context.plan.version + 1;
}

/** Plans and goals read these tags; preparation and placement read the learner model's. */
export function revalidatePlanTags(userId: string) {
  revalidateCacheTags([getGoalsCacheTag(userId), getLearnerModelCacheTag(userId)]);
}

/**
 * Runs a planning step that reloads its context: when another run commits first, it starts over
 * once from the new plan instead of overwriting it.
 */
export async function withPlanRetry<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    if (error instanceof PlanConflictError) {
      return run();
    }

    throw error;
  }
}

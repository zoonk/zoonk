import "server-only";
import { isDeepStrictEqual } from "node:util";
import { type PlanChangeStatus, type TransactionClient, prisma } from "@zoonk/db";
import { revalidateCacheTags } from "../../cache/revalidate-cache-tags";
import { getGoalsCacheTag, getLearnerModelCacheTag } from "../../cache/tags";
import { getKnownSubjects } from "../../learner/placement/placement-contract";
import { type BuiltPlan, type PlanningMode, buildPlan } from "../planner/build-plan";
import { readCourseWeights } from "../planner/course-weights";
import { weighGraphForExam } from "../planner/exam-weights";
import { sizeLanguageGraph } from "../planner/language-size";
import { toIsoDate } from "../planner/plan-calendar";
import { type PlanEffect, getPlanEffect } from "../planner/plan-effect";
import { type PlanFeasibility, getPlanFeasibility } from "../planner/plan-feasibility";
import { type PlannedItem, getItemKey } from "../planner/plan-items";
import { type Pace, choosePace } from "../planner/plan-pace";
import { getSettledSkillIds } from "../planner/plan-queue";
import { type PlanState } from "../planner/plan-state";
import { getStandInLessons } from "../planner/plan-units";
import { isTodayShown, loadCarryOver } from "./carried-lessons";
import { keepPastBasicsBands } from "./level-bands";
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
  /** What re-planning does to the stored plan: a system run records it as its change. */
  effect: PlanEffect;
  feasibility: PlanFeasibility;
  pace: Pace;
  /** The lessons each skill's stand-in plans in this run (see `getStandInLessons`). */
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

/** The pace a plan is computed at: the one it was saved with, else sampled now. */
async function choosePlanPace({
  lessons,
  now,
  pace,
  saved,
  userId,
}: {
  lessons: readonly { lessonId: string }[];
  now: Date;
  pace: "sampled" | "saved";
  saved: Pace | null;
  userId: string;
}): Promise<Pace> {
  if (pace === "saved" && saved) {
    return saved;
  }

  const samples = await loadPaceSamples({
    lessonIds: lessons.slice(0, PACE_LESSON_LIMIT).map((lesson) => lesson.lessonId),
    now,
    userId,
  });

  return choosePace(samples);
}

/**
 * Plans a goal from a state without saving anything: what the plan would be and what changes.
 * A plan keeps the pace it was saved with (`saved`), so a read, the time question and a change the
 * learner makes all say the same numbers however others' lessons went in between; only learning
 * moves them, when a session ends (`sampled`: other learners' recent lessons and the learner's
 * own). A plan with no pace saved yet samples one.
 */
export async function computePlan({
  context,
  mode,
  now = new Date(),
  pace: paceSource = "saved",
  state = context.state,
}: {
  context: PlanContext;
  mode: PlanningMode;
  now?: Date;
  pace?: "sampled" | "saved";
  state?: PlanState;
}): Promise<ComputedPlan> {
  const resolved = await resolveMergedSkills(state.graph);
  const targetDate = getStateTargetDate(state);
  const userId = context.goal.userId;

  // Re-planning from today settles what earlier days left first (see `CarryOver`); an automatic
  // run keeps a day the learner was shown as it is (see `placeLandedThisWeek`).
  const [{ areaShares, examSubjects, topicLevels, ...loaded }, carryOver, todayShown] =
    await Promise.all([
      loadPlannerInputs({
        difficultyBias: state.settings.difficultyBias,
        goal: context.goal,
        graph: resolved,
        targetDate,
        userId,
      }),
      mode === "forced" ? loadCarryOver({ goalId: context.goal.id, today: context.today }) : null,
      mode === "automatic" && isTodayShown({ goalId: context.goal.id, today: context.today }),
    ]);

  // A language goal plans the lessons that reach the level the learner aims for.
  const graph = sizeLanguageGraph({
    details: context.goal.details,
    graph: resolved,
    kind: context.goal.kind,
    settledSkillIds: getSettledSkillIds({ items: context.items, lessons: loaded.lessons }),
  });

  // The areas the learner said they're past the basics of take their higher bands.
  const inputs = {
    ...loaded,
    lessons: keepPastBasicsBands({
      graph,
      lessons: loaded.lessons,
      pastBasicsAreas: state.settings.pastBasicsAreas,
    }),
  };

  const pace = await choosePlanPace({
    lessons: inputs.lessons,
    now,
    pace: paceSource,
    saved: state.settings.pace,
    userId,
  });

  const settings = {
    ...state.settings,
    pace,
    shortMockMinutes: inputs.shortMockMinutes,
    startDate: state.settings.startDate ?? toIsoDate(context.today),
  };

  const input = {
    ...inputs,
    carryOver,
    goal: { dailyMinutes: state.goal.dailyMinutes, kind: context.goal.kind, targetDate },
    graph: weighGraphForExam({
      areaShares,
      courseWeights: readCourseWeights(context.goal.details),
      graph,
      topicLevels,
    }),
    items: context.items,
    knownAreas: new Set([...getKnownSubjects(context.goal), ...state.settings.pastBasicsAreas]),
    mode,
    noticeAreas: areaShares ? new Set(areaShares.keys()) : null,
    paceFactor: pace.factor,
    settings,
    today: context.today,
    todayShown,
    topicLevels,
  };

  const built = buildPlan(input);
  const standInLessons = getStandInLessons({ lessons: inputs.lessons, skills: graph.skills });

  return {
    built,
    effect: getPlanEffect({ after: built.items, before: context.items, standInLessons }),
    feasibility: getPlanFeasibility({ examSubjects, input, planned: built }),
    pace,
    standInLessons,
    state: { ...state, graph, settings },
  };
}

export function getGoalUpdate({ context, state }: { context: PlanContext; state: PlanState }) {
  const targetDate = getStateTargetDate(state);
  const sameDate = targetDate?.getTime() === context.goal.targetDate?.getTime();

  if (state.goal.dailyMinutes === context.goal.dailyMinutes && sameDate) {
    return null;
  }

  return { dailyMinutes: state.goal.dailyMinutes, targetDate };
}

function toDay(date: Date | null): string | null {
  return date ? toIsoDate(date) : null;
}

/** The same items in the same order, each on the same day and in the same phase. */
export function hasSameItems({
  after,
  before,
}: {
  after: readonly Pick<PlannedItem, "key" | "phase" | "scheduledFor">[];
  before: readonly Pick<PlannedItem, "key" | "phase" | "scheduledFor">[];
}) {
  return (
    after.length === before.length &&
    after.every((item, index) => {
      const current = before[index];

      return (
        current !== undefined &&
        item.key === current.key &&
        item.phase === current.phase &&
        toDay(item.scheduledFor) === toDay(current.scheduledFor)
      );
    })
  );
}

/** The stored items, keyed as a planning run keys them. */
function toKeyedItems(context: PlanContext) {
  return context.items.map((item) => ({ ...item, key: getItemKey(item) }));
}

/** Each item's work and where it stands, in any order. */
function listWork(items: readonly Pick<PlannedItem, "key" | "status">[]): string[] {
  return items.map((item) => `${item.key}:${item.status}`).toSorted();
}

/**
 * A planning run that changes nothing: the same graph, settings (pace included) and goal dates,
 * and the same work to do. Its days aren't compared: the same work planned again can land on
 * other days (an exam's study cycle starts over where a run re-plans from), and moving what the
 * learner was shown when nothing changed is churn. Saving it would also bump the plan's version,
 * which turns a learner's open plan editor or a buddy's plan change into a conflict.
 */
export function isPlanUnchanged({
  computed,
  context,
}: {
  computed: ComputedPlan;
  context: PlanContext;
}): boolean {
  const { state } = computed;

  return (
    getGoalUpdate({ context, state }) === null &&
    isDeepStrictEqual(state.graph, context.state.graph) &&
    isDeepStrictEqual(state.settings, context.state.settings) &&
    isDeepStrictEqual(listWork(computed.built.items), listWork(toKeyedItems(context)))
  );
}

/**
 * Saves a computed plan and the change the learner sees, in one transaction. The plan's version
 * guards against a concurrent run; the goal's time settings follow the state. Today's session
 * follows a change the learner made (`followPlanToday`); one the system made reaches a day not
 * started yet the next time the learner opens it.
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
        coveredShare: computed.feasibility.deadline ? computed.feasibility.coveredShare : null,
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

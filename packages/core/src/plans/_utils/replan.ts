import "server-only";
import { type PlanChangeStatus, type TransactionClient, prisma } from "@zoonk/db";
import { once } from "@zoonk/utils/once";
import { revalidateCacheTags } from "../../cache/revalidate-cache-tags";
import { getGoalsCacheTag, getLearnerModelCacheTag } from "../../cache/tags";
import { getKnownSubjects } from "../../learner/placement/placement-contract";
import { chooseBases } from "../planner/base-choices";
import {
  type BuildPlanInput,
  type BuiltPlan,
  type PlanningMode,
  buildPlan,
} from "../planner/build-plan";
import { applyBaseChoices, getKeptBaseChoices } from "../planner/chosen-bases";
import { withPlannedLessons } from "../planner/core-first";
import { readCourseWeights } from "../planner/course-weights";
import { weighGraphForExam } from "../planner/exam-weights";
import { getShownPhaseEnds } from "../planner/kept-phase-ends";
import { sizeLanguageGraph } from "../planner/language-size";
import { type PlanBases } from "../planner/plan-bases";
import { toIsoDate } from "../planner/plan-calendar";
import { type PlanEffect, getFittedStandInLessons, getPlanEffect } from "../planner/plan-effect";
import { type PlanFeasibility, getPlanFeasibility } from "../planner/plan-feasibility";
import { type Pace } from "../planner/plan-pace";
import { toExamWindows } from "../planner/plan-phases";
import { type PlanState } from "../planner/plan-state";
import { getStandInLessons } from "../planner/plan-units";
import { getSettledSkillIds } from "../planner/settled-skills";
import { isTodayShown, loadPlanCarryOver } from "./carried-lessons";
import { choosePlanPace } from "./choose-plan-pace";
import { chooseExamOptionSkills } from "./exam-option-skills";
import { keepPastBasicsBands } from "./level-bands";
import {
  type PlanChangeKind,
  type StoredPlanChangePayload,
  isUndoableChange,
} from "./plan-change-payload";
import { type PlanContext, getStateTargetDate } from "./plan-context";
import { getPlanInputsKey, isOnlyLanding } from "./plan-inputs-key";
import { toPlanSnapshot } from "./plan-snapshot";
import { loadPlannerInputs, resolveMergedSkills } from "./planner-inputs";
import { loadQuickBaseLessons } from "./quick-bases";
import { PlanConflictError, writePlan } from "./write-plan";

const MINUTES_PER_HOUR = 60;

export type ComputedPlan = {
  /** The plan's bases with what the app recommends for them (see `findPlanBases`). */
  bases: PlanBases;
  built: BuiltPlan;
  /** What re-planning does to the stored plan: a system run records it as its change. */
  effect: PlanEffect;
  feasibility: PlanFeasibility;
  /**
   * What the run planned from, with the progress the plan it saves holds (see `getPlanInputsKey`):
   * a later system refresh with the same key has nothing new to plan.
   */
  inputsKey: string;
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

/** Each stand-in as the plan has it: a base's core, or the one lesson of its quick lesson. */
function getChosenStandInLessons(input: BuildPlanInput): Map<string, number> {
  const studied = applyBaseChoices({
    bases: input.bases ?? [],
    choices: getKeptBaseChoices(input),
    graph: input.graph,
    items: input.items,
    lessons: input.lessons,
    quickLessons: input.quickLessons,
  });

  return getStandInLessons({ lessons: studied.lessons, skills: studied.graph.skills });
}

/**
 * Plans a goal from a state without saving anything: what the plan would be and what changes.
 * A plan keeps the pace it was saved with (`saved`), so a read, the time question and a change the
 * learner makes all say the same numbers however others' lessons went in between; only learning
 * moves them, when a session ends (`sampled`: other learners' recent lessons and the learner's
 * own). A plan with no pace saved yet samples one. An automatic run keeps the phase end dates the
 * learner saw (see `keepPhaseEnds`), and so does a forced one the learner didn't ask for, such as a
 * new day settling what earlier days left (`keepPhaseDates`); a learner's change re-plans them.
 */
export async function computePlan({
  bringBackSetAside = false,
  context,
  mode,
  keepPhaseDates = mode === "automatic",
  now = new Date(),
  movedEnds,
  pace: paceSource = "saved",
  releasedPhases,
  setAsideLeftWork = false,
  state = context.state,
  todayExceptAreas = null,
}: {
  /** A learner's change: work set aside for time comes back where it fits (see `buildPlan`). */
  bringBackSetAside?: boolean;
  context: PlanContext;
  /**
   * Keep the saved phase end dates (an automatic run's default, and a system change's); false plans
   * them as the lessons fall, as a learner's change does, or to compare.
   */
  keepPhaseDates?: boolean;
  mode: PlanningMode;
  /** The kept ends moving the phase dates puts on other days, by phase (see `planPhaseDatesMove`). */
  movedEnds?: ReadonlyMap<number, string>;
  now?: Date;
  pace?: "sampled" | "saved";
  /** Phases whose shown end isn't kept: a missed day's settling lets it go (see `computeSettledPlan`). */
  releasedPhases?: ReadonlySet<number>;
  /**
   * A new day's settling: work earlier days left that no longer fits is set aside, never deleted
   * (see `setAsideLeftWork`).
   */
  setAsideLeftWork?: boolean;
  state?: PlanState;
  /**
   * For a focus planned from today: the areas it gives less time to. Today's other lessons stay
   * first, as the learner sees them (see `CarryOver`).
   */
  todayExceptAreas?: readonly string[] | null;
}): Promise<ComputedPlan> {
  // The plan studies only the options the learner takes of their exam's choices.
  const resolved = await resolveMergedSkills(
    await chooseExamOptionSkills({
      choices: state.settings.examChoices,
      goal: context.goal,
      graph: state.graph,
    }),
  );

  const targetDate = getStateTargetDate(state);
  const userId = context.goal.userId;

  // Re-planning from today settles what earlier days left first, and so does every later run that
  // day, with the steering of the day's change of focus (see `CarryOver`); an automatic run keeps a
  // day the learner was shown as it is (see `putLandedLessons`).
  const [{ areaShares, examSubjects, topicLevels, ...loaded }, carryOver, todayShown, quick] =
    await Promise.all([
      loadPlannerInputs({
        difficultyBias: state.settings.difficultyBias,
        examChoices: state.settings.examChoices,
        focus: state.settings,
        goal: context.goal,
        graph: resolved,
        targetDate,
        userId,
      }),
      loadPlanCarryOver({ context, mode }).then(
        (loadedCarry) =>
          loadedCarry && {
            ...loadedCarry,
            todayExceptAreas: todayExceptAreas ?? loadedCarry.todayExceptAreas ?? null,
          },
      ),
      mode === "automatic" && isTodayShown({ goalId: context.goal.id, today: context.today }),
      loadQuickBaseLessons(state.settings),
    ]);

  // A language goal plans the lessons that reach the level the learner aims for.
  const graph = sizeLanguageGraph({
    details: context.goal.details,
    graph: resolved,
    kind: context.goal.kind,
    settledSkillIds: getSettledSkillIds({ ...loaded, items: context.items }),
  });

  // The areas the learner said they're past the basics of take their higher bands, but a basic
  // they then missed a question on.
  const inputs = {
    ...loaded,
    lessons: keepPastBasicsBands({
      graph,
      keepSkillIds: loaded.missedSkillIds,
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

  // Today's proposal plans the phase ends it moves as the lessons fall (see `movesPhaseEnds`).
  const movesPhaseEnds = !keepPhaseDates || movedEnds !== undefined || releasedPhases !== undefined;

  // The planner studies each base as the learner chose (see `chooseBases`).
  const chosen = chooseBases({
    ...inputs,
    bringBackSetAside,
    carryOver,
    examWindows: toExamWindows(context.phases),
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
    movesPhaseEnds,
    noticeAreas: areaShares ? new Set(areaShares.keys()) : null,
    paceFactor: pace.factor,
    phaseEnds: keepPhaseDates
      ? getShownPhaseEnds({
          items: context.items,
          moved: movedEnds,
          phases: context.phases,
          released: releasedPhases,
        })
      : undefined,
    quickLessons: quick,
    setAsideLeftWork,
    settings,
    today: context.today,
    todayShown,
    topicLevels,
  });

  const { input } = chosen;

  // A run whose only news is lessons written for the plan's stand-ins keeps every other item as the
  // plan has it (see `landedOnly`).
  const landedOnly = isOnlyLanding({ input, savedKey: context.plan.inputsKey });

  const built = buildPlan({ ...input, landedOnly });
  // Measuring what fits builds the plan again as its graph sizes it: Progress never asks.
  const feasibility = once(() => getPlanFeasibility({ examSubjects, input, planned: built }));

  const standInLessons = getChosenStandInLessons(input);

  // What the app recommends for the bases builds the plan with every base in depth: only the plan
  // screen reads it.
  const bases = once(chosen.advise);
  const saved = withPlannedLessons({ graph, skillLessons: built.skillLessons });

  return {
    get bases() {
      return bases();
    },
    built,
    effect: getPlanEffect({ after: built.items, before: context.items, standInLessons }),
    get feasibility() {
      return feasibility();
    },
    inputsKey: getPlanInputsKey({ input, items: built.items }),
    pace,
    standInLessons,
    state: { ...state, graph: saved, settings },
  };
}

/**
 * Saves a computed plan and the change the learner sees, in one transaction. The plan's version
 * guards against a concurrent run; the goal's time settings follow the state. Today's session
 * follows a change the learner made (`followPlanToday`); one the system made reaches a day not
 * started yet the next time the learner opens it. A change the learner can undo keeps the plan as
 * it was before it (see `PlanSnapshot`), which the undo puts back.
 */
export async function commitPlan({
  change,
  computed,
  context,
  extraWrites,
  restorable = null,
  revalidation = "now",
}: {
  change: PlanChangeRecord | null;
  computed: ComputedPlan;
  context: PlanContext;
  /** Other writes that must land with the plan, such as marking a change applied or undone. */
  extraWrites?: (tx: TransactionClient) => Promise<unknown>;
  /** A change already recorded that this commit applies and the learner can undo: an accepted proposal. */
  restorable?: string | null;
  revalidation?: PlanTagRevalidation;
}): Promise<string | null> {
  const { built, state } = computed;

  const changeId = await prisma.$transaction(async (tx) => {
    await writePlan({
      context,
      plan: {
        coveredShare: computed.feasibility.deadline ? computed.feasibility.coveredShare : null,
        estimateHours: built.estimate.totalMinutes / MINUTES_PER_HOUR,
        inputsKey: computed.inputsKey,
        items: built.items,
        phases: built.phases,
        standInLessons: getFittedStandInLessons({
          skillMinutes: built.skillMinutes,
          standInLessons: computed.standInLessons,
        }),
        state,
      },
      tx,
    });

    await extraWrites?.(tx);

    const created = change
      ? await tx.planChange.create({
          data: {
            kind: change.kind,
            payload: { ...change.payload, versionAfter: getVersionAfter(context) },
            planId: context.plan.id,
            reason: change.reason,
            status: change.status,
            ...change.provenance,
          },
        })
      : null;

    const undoable = created && isUndoableChange(created) ? created.id : restorable;

    if (undoable) {
      await tx.planChangeSnapshot.create({
        data: { changeId: undoable, plan: toPlanSnapshot(context) },
      });
    }

    return created?.id ?? null;
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

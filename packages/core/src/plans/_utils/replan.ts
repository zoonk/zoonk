import "server-only";
import { type PlanChangeStatus, type TransactionClient, prisma } from "@zoonk/db";
import { isJsonObject } from "@zoonk/utils/json";
import { revalidateCacheTags } from "../../cache/revalidate-cache-tags";
import { getGoalsCacheTag, getLearnerModelCacheTag } from "../../cache/tags";
import { readCourseStart } from "../../goals/course-start-details";
import { getKnownSubjects } from "../../learner/placement/placement-contract";
import { chooseBases } from "../planner/base-choices";
import { type BuiltPlan, type PlanningMode, buildPlan } from "../planner/build-plan";
import { getChosenStandInLessons } from "../planner/chosen-bases";
import { withPlannedLessons } from "../planner/core-first";
import { readCourseWeights } from "../planner/course-weights";
import { type StudyScheduleAt } from "../planner/daily-time-plans";
import { weighGraphForExam } from "../planner/exam-weights";
import { getShownPhaseEnds } from "../planner/kept-phase-ends";
import { sizeLanguageGraph } from "../planner/language-size";
import { type PlanBases } from "../planner/plan-bases";
import { type PlanEffect, getFittedStandInLessons } from "../planner/plan-effect";
import { type PlanFeasibility } from "../planner/plan-feasibility";
import { type Pace } from "../planner/plan-pace";
import { toExamWindows } from "../planner/plan-phases";
import { type PlanState } from "../planner/plan-state";
import { getRunEffect, withBuiltSettings } from "../planner/run-outcome";
import { getSettledSkillIds } from "../planner/settled-skills";
import { loadRunBossFacts } from "./boss-plan-facts";
import { isTodayShown, loadPlanCarryOver } from "./carried-lessons";
import { choosePlanSettings } from "./choose-plan-pace";
import { chooseExamOptionSkills } from "./exam-option-skills";
import { listFinishedDays } from "./finished-days";
import { keepPastBasicsBands } from "./level-bands";
import { listRequestedMoveDates } from "./missing-weekly-move";
import {
  type PlanChangeKind,
  type StoredPlanChangePayload,
  isUndoableChange,
} from "./plan-change-payload";
import { type PlanContext, getStateTargetDate } from "./plan-context";
import { getPlanInputsKey, readLanding } from "./plan-inputs-key";
import { loadPlanReadAdvice } from "./plan-read-advice";
import { savePlanSnapshot } from "./plan-snapshot";
import { loadPlannerInputs, resolveMergedSkills } from "./planner-inputs";
import { loadQuickBaseLessons } from "./quick-bases";
import { readBuiltPlan } from "./read-built-plan";
import { type PlanAnalysisPurpose } from "./read-plan-analysis";
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
 * even from `after()`. Pure read caches key their full freshly loaded input, so render-time
 * writes remain fresh without eviction; only a Server Action clears the browser's copies.
 */
export type PlanTagRevalidation = "now" | "skip";

type ComputePlanRequest = {
  /** A learner's change: work set aside for time comes back where it fits (see `buildPlan`). */
  bringBackSetAside?: boolean;
  context: PlanContext;
  /**
   * Keep the saved phase end dates (an automatic run's default, and a system change's); false plans
   * them as the lessons fall, as a learner's change does, or to compare.
   */
  keepPhaseDates?: boolean;
  /** Moving a weekly event also keeps the last phase's challenge, rather than shortening the plan. */
  keepLastPhaseDate?: boolean;
  mode: PlanningMode;
  /** The kept ends moving the phase dates puts on other days, by phase (see `planPhaseDatesMove`). */
  movedEnds?: ReadonlyMap<number, string>;
  now?: Date;
  pace?: "sampled" | "saved";
  /** Phases whose shown end isn't kept: a missed day's settling lets it go (see `computeSettledPlan`). */
  releasedPhases?: ReadonlySet<number>;
  /** Read-only consumers can share the same pure build; mutation preconditions stay fresh. */
  reuseReadBuild?: boolean;
  /** Only the Plan read requests advice; Progress and effects retain their local lazy analysis. */
  readAnalysis?: PlanAnalysisPurpose;
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
  /** Time-advice candidates scale the saved calendar before applying the learner's overrides. */
  studyScheduleAt?: StudyScheduleAt;
};

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
  keepLastPhaseDate = false,
  now = new Date(),
  movedEnds,
  pace: paceSource = "saved",
  releasedPhases,
  reuseReadBuild = false,
  readAnalysis,
  setAsideLeftWork = false,
  state = context.state,
  todayExceptAreas = null,
  studyScheduleAt,
}: ComputePlanRequest): Promise<ComputedPlan> {
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

  const bossFacts = loadRunBossFacts({ context, graph, lessons: inputs.lessons, quick });
  const settings = await choosePlanSettings({ context, inputs, now, paceSource, state });

  const { pace } = settings;

  // Today's proposal plans the phase ends it moves as the lessons fall (see `movesPhaseEnds`).
  const movesPhaseEnds = !keepPhaseDates || movedEnds !== undefined || releasedPhases !== undefined;

  // The planner studies each base as the learner chose (see `chooseBases`).
  const { advise, input } = chooseBases({
    ...inputs,
    bossFacts: await bossFacts,
    bringBackSetAside,
    carryOver,
    courseStart:
      readCourseStart(isJsonObject(context.goal.details) ? context.goal.details : {}) !== null,
    examWindows: toExamWindows(context.phases),
    finishedOn: listFinishedDays({ items: context.items, timeZone: context.timeZone }),
    goal: { dailyMinutes: state.goal.dailyMinutes, kind: context.goal.kind, targetDate },
    goalId: context.goal.id,
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
          includeLast: keepLastPhaseDate,
          items: context.items,
          moved: movedEnds,
          phases: context.phases,
          released: releasedPhases,
        })
      : undefined,
    quickLessons: quick,
    requestedMoveDates: listRequestedMoveDates({ saved: context.state, state }),
    setAsideLeftWork,
    settings,
    today: context.today,
    todayShown,
    topicLevels,
  });

  // A run whose only news is lessons written for the plan's stand-ins keeps every other item as the
  // plan has it (see `landedOnly`).
  const landing = readLanding({ input, savedKey: context.plan.inputsKey });

  const builtInput = { ...input, ...landing };

  const built = reuseReadBuild
    ? await readBuiltPlan({ input: builtInput, userId })
    : buildPlan(builtInput);

  // Measuring what fits builds the plan again as its graph sizes it: Progress never asks.
  const { bases, feasibility } = await loadPlanReadAdvice({
    advise,
    examSubjects,
    input,
    landing,
    planned: built,
    readAnalysis,
    reuseReadBuild,
    studyScheduleAt,
    userId,
  });

  const standInLessons = getChosenStandInLessons(builtInput);

  const saved = withPlannedLessons({ graph, skillLessons: built.skillLessons });

  const savedSettings = withBuiltSettings({ built, settings });

  return {
    get bases() {
      return bases();
    },
    built,
    effect: getRunEffect({ built, context, kept: input.phaseEnds, standInLessons }),
    get feasibility() {
      return feasibility();
    },
    inputsKey: getPlanInputsKey({
      input: { ...input, settings: savedSettings },
      items: built.items,
    }),
    pace,
    standInLessons,
    // The mocks this build funds are saved with it, so Today reads the same days (see `fundMocks`).
    state: { ...state, graph: saved, settings: savedSettings },
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
      await savePlanSnapshot({ changeId: undoable, context, tx });
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

import "server-only";
import { type PlanChangeStatus } from "@zoonk/db";
import { isJsonObject } from "@zoonk/utils/json";
import { once } from "@zoonk/utils/once";
import { revalidateCacheTags } from "../../cache/revalidate-cache-tags";
import { getGoalsCacheTag, getLearnerModelCacheTag } from "../../cache/tags";
import { readCourseStart } from "../../goals/course-start-details";
import { getKnownSubjects } from "../../learner/placement/placement-contract";
import { chooseBases } from "../planner/base-choices";
import { type BossMinutes } from "../planner/boss-minutes";
import { type BuiltPlan, type PlanningMode, buildPlan } from "../planner/build-plan";
import { getChosenStandInLessons } from "../planner/chosen-bases";
import { withPlannedLessons } from "../planner/core-first";
import { readCourseWeights } from "../planner/course-weights";
import { type StudyScheduleAt } from "../planner/daily-time-plans";
import { weighGraphForExam } from "../planner/exam-weights";
import { getShownPhaseEnds } from "../planner/kept-phase-ends";
import { sizeLanguageGraph } from "../planner/language-size";
import { type PlanBases } from "../planner/plan-bases";
import { type PlanEffect } from "../planner/plan-effect";
import { type PlanFeasibility, getPlanFeasibility } from "../planner/plan-feasibility";
import { type Pace } from "../planner/plan-pace";
import { toExamWindows } from "../planner/plan-phases";
import { type PlanState } from "../planner/plan-state";
import { getBossKey } from "../planner/plan-units";
import { getRunEffect, withBuiltSettings } from "../planner/run-outcome";
import { type SelectedItemFacts, listSelectedItemFacts } from "../planner/selected-item-facts";
import { summarizeSelectedPlan } from "../planner/selected-plan-summary";
import { getSettledSkillIds } from "../planner/settled-skills";
import { loadRunBossFacts } from "./boss-plan-facts";
import { type PlanCarrySnapshot, isTodayShown, loadPlanCarryOver } from "./carried-lessons";
import { choosePlanSettings } from "./choose-plan-pace";
import { chooseExamOptionSkills } from "./exam-option-skills";
import { listFinishedDays } from "./finished-days";
import { keepPastBasicsBands } from "./level-bands";
import { type PlanChangeKind, type StoredPlanChangePayload } from "./plan-change-payload";
import { type PlanContext, getStateTargetDate } from "./plan-context";
import { getPlanInputsKey, readLanding, shouldSkipPlanBuild } from "./plan-inputs-key";
import { loadPlannerInputs, resolveMergedSkills } from "./planner-inputs";
import { loadQuickBaseLessons } from "./quick-bases";
import { summarizeRetainedPlan } from "./retained-plan-allocation";
import { type SelectedSummary } from "./selected-summary-contract";

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
  itemFacts: ReadonlyMap<string, SelectedItemFacts>;
  pace: Pace;
  /** The lessons each skill's stand-in plans in this run (see `getStandInLessons`). */
  standInLessons: Map<string, number>;
  /** The state the plan was built from, with merged skills resolved and the pace and start set. */
  state: PlanState;
  selected: SelectedSummary;
  /** Fresh facts measured against the actual unchanged saved allocation, not candidate dates. */
  summarizeRetained: () => SelectedSummary | null;
};

export type ComputedChange = {
  baseline: ComputedPlan;
  /**
   * The plan brings work set aside for time back to compete (see `pickSetAsidePlans`): moving the
   * phase dates right after the change is planned the same way (see `askPhaseDatesAfterChange`).
   */
  bringsBackSetAside: boolean;
  computed: ComputedPlan;
  /**
   * More or less of some areas would do the opposite of what it asks in the plan the learner sees
   * (see `contradictsSteering`): neither offered nor applied when the learner asks for it.
   */
  contradicts: boolean;
  effect: PlanEffect;
  /**
   * The plan would stay as it is (see `hasNoEffect`), or the change `contradicts`: nothing to offer
   * or apply.
   */
  unchanged: boolean;
};

/** What a planning run records for the learner to see; system runs may record nothing. */
export type PlanChangeRecord = {
  kind: PlanChangeKind;
  payload: StoredPlanChangePayload;
  provenance?: { generatedAt: Date; model: string; promptVersion: string; runId: string } | null;
  reason: string;
  status: PlanChangeStatus;
};

/** Whether a writer expires screen data immediately or lets its caller do it. */
export type PlanTagRevalidation = "now" | "skip";

/**
 * The time each challenge took as the plan last saved it, which a run starts from (see
 * `settlePlannedBosses`): read again from the start, every run built its plan twice.
 */
function listSavedBossMinutes(items: PlanContext["items"]): BossMinutes {
  return new Map(
    items.flatMap((item) =>
      item.kind === "boss" && typeof item.minutes === "number"
        ? [[getBossKey(item.phase), item.minutes] as const]
        : [],
    ),
  );
}

type ComputePlanRequest = {
  /** Reuse this request's settling facts; mutation callers load fresh facts by default. */
  carrySnapshot?: PlanCarrySnapshot;
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
  /** Preview and Start both hold the current day's allocation before its session exists. */
  todayShown?: boolean;
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
export function computePlan(
  input: ComputePlanRequest & { skipUnchangedInputs: true },
): Promise<ComputedPlan | null>;
export function computePlan(input: ComputePlanRequest): Promise<ComputedPlan>;
export async function computePlan({
  carrySnapshot,
  context,
  mode,
  keepPhaseDates = mode === "automatic",
  now = new Date(),
  movedEnds,
  pace: paceSource = "saved",
  releasedPhases,
  setAsideLeftWork = false,
  skipUnchangedInputs,
  state = context.state,
  todayShown: shownToday,
  ...options
}: ComputePlanRequest & { skipUnchangedInputs?: boolean }): Promise<ComputedPlan | null> {
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
      loadPlanCarryOver({ context, mode, snapshot: carrySnapshot }).then(
        (loadedCarry) =>
          loadedCarry && {
            ...loadedCarry,
            todayExceptAreas: options.todayExceptAreas ?? loadedCarry.todayExceptAreas ?? null,
          },
      ),
      shownToday ??
        (mode === "automatic" && isTodayShown({ goalId: context.goal.id, today: context.today })),
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

  // The planner studies each base as the learner chose (see `chooseBases`).
  const { advise, input } = chooseBases({
    ...inputs,
    bossFacts: await bossFacts,
    bossMinutes: listSavedBossMinutes(context.items),
    bringBackSetAside: options.bringBackSetAside ?? false,
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
    movesPhaseEnds: !keepPhaseDates || movedEnds !== undefined || releasedPhases !== undefined,
    noticeAreas: areaShares ? new Set(areaShares.keys()) : null,
    paceFactor: settings.pace.factor,
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

  // Compare the inputs before the producer can change its own funding. Its output
  // is not news: rebuilding identical inputs moved a saved boss and deleted a funded mock.
  if (shouldSkipPlanBuild({ input, savedKey: context.plan.inputsKey, skipUnchangedInputs })) {
    return null;
  }

  // A run whose only news is lessons written for the plan's stand-ins keeps every other item as the
  // plan has it (see `landedOnly`).
  const landing = readLanding({ input, savedKey: context.plan.inputsKey });

  const builtInput = { ...input, ...landing };

  const built = buildPlan(builtInput);

  const bases = once(advise);

  const feasibility = once(() =>
    getPlanFeasibility({
      examSubjects,
      input,
      planned: built,
      studyScheduleAt: options.studyScheduleAt,
    }),
  );

  const standInLessons = getChosenStandInLessons(builtInput);

  const saved = withPlannedLessons({ graph, skillLessons: built.skillLessons });

  const savedSettings = withBuiltSettings({ built, settings });

  return {
    get bases() {
      return bases();
    },
    built,
    effect: getRunEffect({ built, context, graph: saved, kept: input.phaseEnds, standInLessons }),
    get feasibility() {
      return feasibility();
    },
    inputsKey: getPlanInputsKey({
      input: { ...input, settings: savedSettings },
      items: built.items,
    }),
    itemFacts: listSelectedItemFacts({ built, input: builtInput }),
    pace: settings.pace,
    selected: summarizeSelectedPlan({ built, examSubjects, input: builtInput }),
    standInLessons,
    // The mocks this build funds are saved with it, so Today reads the same days (see `fundMocks`).
    state: { ...state, graph: saved, settings: savedSettings },
    summarizeRetained: () =>
      summarizeRetainedPlan({ built, context, examSubjects, input: builtInput }),
  };
}

/**
 * Saves a computed plan and the change the learner sees, in one transaction. The plan's version
 * guards against a concurrent run; the goal's time settings follow the state. Today's session
 * follows a change the learner made (`followPlanToday`); one the system made reaches a day not
 * started yet the next time the learner opens it. A change the learner can undo keeps the plan as
 * it was before it (see `PlanSnapshot`), which the undo puts back.
 */
/** Plans and goals read these tags; preparation and placement read the learner model's. */
export function revalidatePlanTags(userId: string) {
  revalidateCacheTags([getGoalsCacheTag(userId), getLearnerModelCacheTag(userId)]);
}

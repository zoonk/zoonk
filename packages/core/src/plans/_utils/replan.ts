import "server-only";
import { type PlanChangeStatus } from "@zoonk/db";
import { once } from "@zoonk/utils/once";
import { revalidateCacheTags } from "../../cache/revalidate-cache-tags";
import { getGoalsCacheTag, getLearnerModelCacheTag } from "../../cache/tags";
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
import {
  getPhaseDatesMoveMode,
  isPhaseDatesMoveWorth,
  mayCostToKeepPhaseDates,
} from "../planner/phase-dates-move";
import { type PlanBases } from "../planner/plan-bases";
import { type PlanEffect } from "../planner/plan-effect";
import { type PlanFeasibility, getPlanFeasibility } from "../planner/plan-feasibility";
import { hasTakenChallenge } from "../planner/plan-item-rules";
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
  bases: PlanBases;
  built: BuiltPlan;
  effect: PlanEffect;
  feasibility: PlanFeasibility;
  inputsKey: string;
  itemFacts: ReadonlyMap<string, SelectedItemFacts>;
  pace: Pace;
  standInLessons: Map<string, number>;
  state: PlanState;
  selected: SelectedSummary;
  summarizeRetained: () => SelectedSummary | null;
};

export type ComputedChange = {
  baseline: ComputedPlan;
  bringsBackSetAside: boolean;
  computed: ComputedPlan;
  contradicts: boolean;
  effect: PlanEffect;
  unchanged: boolean;
};

export type PlanChangeRecord = {
  kind: PlanChangeKind;
  payload: StoredPlanChangePayload;
  provenance?: { generatedAt: Date; model: string; promptVersion: string; runId: string } | null;
  reason: string;
  status: PlanChangeStatus;
};

export type PlanTagRevalidation = "now" | "skip";

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
  carrySnapshot?: PlanCarrySnapshot;
  bringBackSetAside?: boolean;
  context: PlanContext;
  keepPhaseDates?: boolean;
  mode: PlanningMode;
  movedEnds?: ReadonlyMap<number, string>;
  now?: Date;
  pace?: "sampled" | "saved";
  releasedPhases?: ReadonlySet<number>;
  setAsideLeftWork?: boolean;
  state?: PlanState;
  todayExceptAreas?: readonly string[] | null;
  todayShown?: boolean;
  studyScheduleAt?: StudyScheduleAt;
};

/**
 * Asking to move a challenge the learner has never met is noise: until they take one, a plan that
 * would pay for keeping its phase dates lays its phases out again instead of proposing the move.
 */
async function layOutUnmetPhaseDates({
  built,
  graph,
  kept,
  request,
}: {
  built: BuiltPlan;
  graph: PlanState["graph"];
  kept: ReadonlyMap<number, Date> | undefined;
  request: ComputePlanRequest;
}): Promise<ComputedPlan | null> {
  if (!kept?.size || hasTakenChallenge(request.context.items) || !mayCostToKeepPhaseDates(built)) {
    return null;
  }

  const mode = getPhaseDatesMoveMode({
    kept: built,
    mode: request.mode,
    shown: kept,
    today: request.context.today,
  });

  const laidOut = await computePlan({ ...request, keepPhaseDates: false, mode });
  return isPhaseDatesMoveWorth({ graph, kept: built, moved: laidOut.built }) ? laidOut : null;
}

/** Plans a goal from a state without saving anything. */
export function computePlan(
  input: ComputePlanRequest & { skipUnchangedInputs: true },
): Promise<ComputedPlan | null>;
export function computePlan(input: ComputePlanRequest): Promise<ComputedPlan>;
export async function computePlan({
  skipUnchangedInputs,
  ...request
}: ComputePlanRequest & { skipUnchangedInputs?: boolean }): Promise<ComputedPlan | null> {
  const {
    carrySnapshot,
    context,
    mode,
    keepPhaseDates = mode === "automatic",
    now = new Date(),
    movedEnds,
    pace: paceSource = "saved",
    releasedPhases,
    setAsideLeftWork = false,
    state = context.state,
    todayShown: shownToday,
    ...options
  } = request;

  const resolved = await resolveMergedSkills(
    await chooseExamOptionSkills({
      choices: state.settings.examChoices,
      goal: context.goal,
      graph: state.graph,
    }),
  );

  const targetDate = getStateTargetDate(state);
  const userId = context.goal.userId;

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

  const graph = sizeLanguageGraph({
    details: context.goal.details,
    graph: resolved,
    kind: context.goal.kind,
    settledSkillIds: getSettledSkillIds({ ...loaded, items: context.items }),
  });

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

  const { advise, input } = chooseBases({
    ...inputs,
    bossFacts: await bossFacts,
    bossMinutes: listSavedBossMinutes(context.items),
    bringBackSetAside: options.bringBackSetAside ?? false,
    carryOver,
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

  // Compare the inputs before the producer changes its own funding: its output isn't news.
  if (shouldSkipPlanBuild({ input, savedKey: context.plan.inputsKey, skipUnchangedInputs })) {
    return null;
  }

  const landing = readLanding({ input, savedKey: context.plan.inputsKey });

  const builtInput = { ...input, ...landing };

  const built = buildPlan(builtInput);
  const laidOut = await layOutUnmetPhaseDates({ built, graph, kept: input.phaseEnds, request });

  if (laidOut) {
    return laidOut;
  }

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
    state: { ...state, graph: saved, settings: savedSettings },
    summarizeRetained: () =>
      summarizeRetainedPlan({ built, context, examSubjects, input: builtInput }),
  };
}

export function revalidatePlanTags(userId: string) {
  revalidateCacheTags([getGoalsCacheTag(userId), getLearnerModelCacheTag(userId)]);
}

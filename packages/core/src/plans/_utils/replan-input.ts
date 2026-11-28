import "server-only";
import { getKnownSubjects } from "../../learner/placement/placement-contract";
import { chooseBases } from "../planner/base-choices";
import { type BossMinutes } from "../planner/boss-minutes";
import { readCourseWeights } from "../planner/course-weights";
import { weighGraphForExam } from "../planner/exam-weights";
import { getShownPhaseEnds } from "../planner/kept-phase-ends";
import { sizeLanguageGraph } from "../planner/language-size";
import { toExamWindows } from "../planner/plan-phases";
import { type PlanState } from "../planner/plan-state";
import { getBossKey } from "../planner/plan-units";
import { getSettledSkillIds, getStartedSkillIds } from "../planner/settled-skills";
import { reopenWrittenTestOuts } from "../planner/written-test-outs";
import { loadRunBossFacts } from "./boss-plan-facts";
import { isTodayShown, loadPlanCarryOver } from "./carried-lessons";
import { choosePlanSettings } from "./choose-plan-pace";
import { loadExtraPlanGraph } from "./extra-plan-graph";
import { listFinishedDays } from "./finished-days";
import { keepPastBasicsBands } from "./level-bands";
import { type PlanContext, getStateTargetDate } from "./plan-context";
import { loadPlannerInputs } from "./planner-inputs";
import { loadQuickBaseLessons } from "./quick-bases";
import { type ComputePlanRequest } from "./replan";

function listSavedBossMinutes(items: PlanContext["items"]): BossMinutes {
  return new Map(
    items.flatMap((item) =>
      item.kind === "boss" && typeof item.minutes === "number"
        ? [[getBossKey(item.phase), item.minutes] as const]
        : [],
    ),
  );
}

function shapePlannerInputs<
  Loaded extends Pick<
    Awaited<ReturnType<typeof loadPlannerInputs>>,
    "bands" | "currentLanguageLevel" | "lessons" | "missedSkillIds"
  >,
>({
  context,
  loaded,
  resolved,
  state,
}: {
  context: PlanContext;
  loaded: Loaded;
  resolved: PlanState["graph"];
  state: PlanState;
}) {
  const { graph: fullGraph, planned: graph } = sizeLanguageGraph({
    bands: loaded.bands,
    currentLevel: loaded.currentLanguageLevel,
    goal: context.goal,
    graph: resolved,
    keepSkillIds: new Set([...loaded.missedSkillIds, ...getStartedSkillIds(context.items)]),
    settledSkillIds: getSettledSkillIds({ ...loaded, items: context.items }),
    state,
  });

  return {
    fullGraph,
    graph,
    inputs: {
      ...loaded,
      lessons: keepPastBasicsBands({
        graph,
        keepSkillIds: loaded.missedSkillIds,
        lessons: loaded.lessons,
        pastBasicsAreas: state.settings.pastBasicsAreas,
      }),
    },
  };
}

export async function loadReplanFacts({
  carrySnapshot,
  context,
  mode,
  now = new Date(),
  pace: paceSource = "saved",
  readExamOptionSource,
  state,
  todayShown: shownToday,
}: Pick<
  ComputePlanRequest,
  "carrySnapshot" | "context" | "mode" | "now" | "pace" | "readExamOptionSource" | "todayShown"
> & { state: PlanState }) {
  const { extraSkills, getActiveItemIds, resolved } = await loadExtraPlanGraph({
    context,
    now,
    readExamOptionSource,
    state,
  });

  const targetDate = getStateTargetDate(state);

  const [
    {
      areaShares,
      examSubjects,
      materialExam,
      topicLevels,
      unprovenWrittenSkillIds,
      writtenSkillIds,
      ...loaded
    },
    carryOver,
    todayShown,
    quick,
  ] = await Promise.all([
    loadPlannerInputs({
      difficultyBias: state.settings.difficultyBias,
      examPicks: state.settings,
      goal: context.goal,
      graph: resolved,
      mockReplan: state.settings.mockReplan,
      now,
      skippedAreas: state.settings.skippedAreas,
      targetDate,
      userId: context.goal.userId,
    }),
    loadPlanCarryOver({ context, mode, snapshot: carrySnapshot }),
    shownToday ??
      (mode === "automatic" && isTodayShown({ goalId: context.goal.id, today: context.today })),
    loadQuickBaseLessons(state.settings),
  ]);

  const project = (forContext: PlanContext) => {
    const { items, reopenedItemIds } = reopenWrittenTestOuts({
      items: forContext.items,
      unprovenSkillIds: unprovenWrittenSkillIds,
    });

    return {
      ...shapePlannerInputs({ context: { ...forContext, items }, loaded, resolved, state }),
      items,
      reopenedItemIds,
    };
  };

  const initial = project(context);

  const [bossFacts, settings] = await Promise.all([
    loadRunBossFacts({ context, graph: initial.graph, lessons: initial.inputs.lessons, quick }),
    choosePlanSettings({ context, inputs: initial.inputs, now, paceSource, state }),
  ]);

  return {
    areaShares,
    bossFacts,
    carryOver,
    examSubjects,
    extraSkills,
    getActiveItemIds,
    materialExam,
    project: (forContext: PlanContext) => (forContext === context ? initial : project(forContext)),
    quick,
    settings,
    targetDate,
    todayShown,
    topicLevels,
    writtenSkillIds,
  };
}

export async function readReplanInputs(request: ComputePlanRequest & { state: PlanState }) {
  const {
    context,
    mode,
    keepPhaseDates = mode === "automatic",
    movedEnds,
    releasedPhases,
    setAsideLeftWork = false,
    state,
    sharedReads,
    ...options
  } = request;

  const {
    areaShares,
    bossFacts,
    carryOver,
    examSubjects,
    extraSkills,
    getActiveItemIds,
    materialExam,
    project,
    quick,
    settings: readSettings,
    targetDate,
    todayShown,
    topicLevels,
    writtenSkillIds,
  } = await (sharedReads?.facts() ?? loadReplanFacts(request));

  const { fullGraph, graph, inputs, items, reopenedItemIds } = project(context);

  const settings = sharedReads?.mockMisses
    ? { ...readSettings, mockReplan: state.settings.mockReplan }
    : readSettings;

  const mockMisses = sharedReads?.mockMisses ?? inputs.mockMisses;
  const extras = graph.skills.filter((skill) => skill.extra);

  const weighted = weighGraphForExam({
    areaShares,
    courseWeights: readCourseWeights(context.goal.details),
    graph: { ...graph, skills: graph.skills.filter((skill) => !skill.extra) },
    topicLevels,
  });

  const { advise, input } = chooseBases({
    ...inputs,
    ...(mockMisses && { mockMisses }),
    bossFacts,
    bossMinutes: listSavedBossMinutes(items),
    bringBackSetAside: options.bringBackSetAside ?? false,
    carryOver: carryOver && {
      ...carryOver,
      todayExceptAreas: options.todayExceptAreas ?? carryOver.todayExceptAreas ?? null,
    },
    examWindows: toExamWindows(context.phases),
    extras: {
      activeItemIds: getActiveItemIds(context),
      bringBack: options.bringBackExtras ?? false,
      previousSkillIds: new Set(extraSkills.keys()),
    },
    finishedOn: listFinishedDays({ items, timeZone: context.timeZone }),
    goal: { dailyMinutes: state.goal.dailyMinutes, kind: context.goal.kind, targetDate },
    goalId: context.goal.id,
    graph: { ...weighted, skills: [...weighted.skills, ...extras] },
    items,
    knownAreas: new Set([...getKnownSubjects(context.goal), ...state.settings.pastBasicsAreas]),
    // Like a test-out ahead (`withTestOutsAhead`), reopened lessons lay the plan out again from today.
    mode: reopenedItemIds.length > 0 ? "forced" : mode,
    movesPhaseEnds: !keepPhaseDates || movedEnds !== undefined || releasedPhases !== undefined,
    noticeAreas: areaShares ? new Set(areaShares.keys()) : null,
    openedKeys: options.openedKeys,
    paceFactor: settings.pace.factor,
    phaseEnds: keepPhaseDates
      ? getShownPhaseEnds({
          items,
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

  return {
    advise,
    examSubjects,
    extraSkills,
    fullGraph,
    graph,
    input,
    materialExam,
    reopenedItemIds,
    settings,
    writtenSkillIds,
  };
}

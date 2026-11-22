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
    "bands" | "lessons" | "missedSkillIds"
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

export async function readReplanInputs(request: ComputePlanRequest & { state: PlanState }) {
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
    state,
    todayShown: shownToday,
    ...options
  } = request;

  const { activeExtraItemIds, extraSkills, resolved } = await loadExtraPlanGraph({
    context,
    now,
    state,
  });

  const targetDate = getStateTargetDate(state);

  const [
    { areaShares, examSubjects, materialExam, topicLevels, writtenSkillIds, ...loaded },
    carryOver,
    todayShown,
    quick,
  ] = await Promise.all([
    loadPlannerInputs({
      difficultyBias: state.settings.difficultyBias,
      examPicks: state.settings,
      goal: context.goal,
      graph: resolved,
      skippedAreas: state.settings.skippedAreas,
      targetDate,
      userId: context.goal.userId,
    }),
    loadPlanCarryOver({ context, mode, snapshot: carrySnapshot }),
    shownToday ??
      (mode === "automatic" && isTodayShown({ goalId: context.goal.id, today: context.today })),
    loadQuickBaseLessons(state.settings),
  ]);

  const { fullGraph, graph, inputs } = shapePlannerInputs({ context, loaded, resolved, state });

  const bossFacts = loadRunBossFacts({ context, graph, lessons: inputs.lessons, quick });
  const settings = await choosePlanSettings({ context, inputs, now, paceSource, state });

  const extras = graph.skills.filter((skill) => skill.extra);

  const weighted = weighGraphForExam({
    areaShares,
    courseWeights: readCourseWeights(context.goal.details),
    graph: { ...graph, skills: graph.skills.filter((skill) => !skill.extra) },
    topicLevels,
  });

  const { advise, input } = chooseBases({
    ...inputs,
    bossFacts: await bossFacts,
    bossMinutes: listSavedBossMinutes(context.items),
    bringBackSetAside: options.bringBackSetAside ?? false,
    carryOver: carryOver && {
      ...carryOver,
      todayExceptAreas: options.todayExceptAreas ?? carryOver.todayExceptAreas ?? null,
    },
    examWindows: toExamWindows(context.phases),
    extras: {
      activeItemIds: activeExtraItemIds,
      bringBack: options.bringBackExtras ?? false,
      previousSkillIds: new Set(extraSkills.keys()),
    },
    finishedOn: listFinishedDays({ items: context.items, timeZone: context.timeZone }),
    goal: { dailyMinutes: state.goal.dailyMinutes, kind: context.goal.kind, targetDate },
    goalId: context.goal.id,
    graph: { ...weighted, skills: [...weighted.skills, ...extras] },
    items: context.items,
    knownAreas: new Set([...getKnownSubjects(context.goal), ...state.settings.pastBasicsAreas]),
    mode,
    movesPhaseEnds: !keepPhaseDates || movedEnds !== undefined || releasedPhases !== undefined,
    noticeAreas: areaShares ? new Set(areaShares.keys()) : null,
    openedKeys: options.openedKeys,
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

  return {
    advise,
    examSubjects,
    extraSkills,
    fullGraph,
    graph,
    input,
    materialExam,
    settings,
    writtenSkillIds,
  };
}

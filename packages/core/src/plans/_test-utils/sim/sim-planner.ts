import { getKnownSubjects, getOwnLevel } from "../../../learner/placement/placement-contract";
import { getLevelFloor, keepPastBasicsBands } from "../../_utils/level-bands";
import { getPlanInputsKey, isOnlyLanding } from "../../_utils/plan-inputs-key";
import { type ComputedPlan } from "../../_utils/replan";
import { isStandIn } from "../../_utils/stand-in-lessons";
import { chooseBases } from "../../planner/base-choices";
import { type BuildPlanInput, type PlanningMode, buildPlan } from "../../planner/build-plan";
import { applyBaseChoices, getKeptBaseChoices } from "../../planner/chosen-bases";
import { withPlannedLessons } from "../../planner/core-first";
import { readCourseWeights } from "../../planner/course-weights";
import { weighGraphForExam } from "../../planner/exam-weights";
import { getShownPhaseEnds } from "../../planner/kept-phase-ends";
import { sizeLanguageGraph } from "../../planner/language-size";
import { fromIsoDate, toIsoDate } from "../../planner/plan-calendar";
import { getFittedStandInLessons, getPlanEffect } from "../../planner/plan-effect";
import { getPlanFeasibility } from "../../planner/plan-feasibility";
import { type ExistingPlanItem } from "../../planner/plan-items";
import { type Pace, choosePace } from "../../planner/plan-pace";
import { toExamWindows } from "../../planner/plan-phases";
import {
  type PlanState,
  parsePlanGraph,
  parsePlanPhases,
  parsePlanSettings,
} from "../../planner/plan-state";
import { type PlannerLesson, getStandInLessons } from "../../planner/plan-units";
import { getSettledSkillIds } from "../../planner/settled-skills";
import { listGapSkillIds, readSimEvidence } from "./sim-claims";
import { type SimPlan, type SimWorld, getSimGoal, getSimPlanCarryOver } from "./sim-world";

/**
 * The pure simulator's copy of the few lines that compose the planner in `computePlan` around
 * its database reads (and in `computeChange` and `refreshGoalPlan`, see `sim-change.ts` and
 * `sim-refresh.ts`): everything else is the real planner. The database tier runs the real
 * functions on the same library, and its conformance test fails when this copy drifts.
 */

export type SimPlanRequest = {
  bringBackSetAside?: boolean;
  keepPhaseDates?: boolean;
  mode: PlanningMode;
  movedEnds?: ReadonlyMap<number, string>;
  pace?: "sampled" | "saved";
  releasedPhases?: ReadonlySet<number>;
  setAsideLeftWork?: boolean;
  state?: PlanState;
  todayExceptAreas?: readonly string[] | null;
  world: SimWorld;
};

/** The lessons the Library has now: the fixture's as loaded without pending skills, and those that landed. */
function listLessons(world: SimWorld): PlannerLesson[] {
  return [...world.lessons, ...world.landedLessons];
}

/**
 * The Library lessons a planning run plans from (`computePlan`'s `inputs.lessons`): the graph's,
 * but the basic bands of an area the learner said they're past, unless they missed a question
 * there.
 */
function listPlannedLessons({
  graph,
  settings,
  world,
}: {
  graph: PlanState["graph"];
  settings: PlanState["settings"];
  world: SimWorld;
}): PlannerLesson[] {
  const skillIds = new Set(graph.skills.map((skill) => skill.skillId));

  return keepPastBasicsBands({
    graph,
    keepSkillIds: listGapSkillIds(world),
    lessons: listLessons(world).filter((lesson) => lesson.skillIds.some((id) => skillIds.has(id))),
    pastBasicsAreas: settings.pastBasicsAreas,
  });
}

/**
 * The saved pace, or one sampled from the learner's lessons. Others' aren't simulated, so everyone's
 * pace (`typical`, which counts the learner's own lessons too) is theirs alone, and no one else's
 * is on the plan's lessons (`course`).
 */
function getPace({ pace, world }: { pace: "sampled" | "saved"; world: SimWorld }): Pace {
  const saved = world.plan.state.settings.pace;
  const { own } = world.learner;

  return pace === "saved" && saved ? saved : choosePace({ course: null, own, typical: own });
}

/** The planner's input, as `computePlan` builds it from what it loads. */
function toPlannerInput({
  bringBackSetAside = false,
  keepPhaseDates,
  mode,
  movedEnds,
  pace: paceSource = "saved",
  releasedPhases,
  setAsideLeftWork = false,
  state,
  todayExceptAreas = null,
  world,
}: SimPlanRequest & { state: PlanState }): {
  /** The graph the plan saves: a language goal's sized, never the exam-weighted copy. */
  graph: PlanState["graph"];
  input: BuildPlanInput;
  pace: Pace;
  settings: PlanState["settings"];
} {
  const { inputs, learner, plan, today } = world;
  const goal = getSimGoal({ ...world, plan: { ...plan, state } });
  const graphSkills = new Set(state.graph.skills.map((skill) => skill.skillId));

  const loaded = listLessons(world).filter((lesson) =>
    lesson.skillIds.some((skillId) => graphSkills.has(skillId)),
  );

  const pace = getPace({ pace: paceSource, world });
  const targetDate = state.goal.targetDate ? fromIsoDate(state.goal.targetDate) : null;
  const isExam = goal.kind === "exam";

  const graph = sizeLanguageGraph({
    details: goal.details,
    graph: state.graph,
    kind: goal.kind,
    settledSkillIds: getSettledSkillIds({ items: plan.items, lessons: loaded }),
  });

  const settings = {
    ...state.settings,
    pace,
    shortMockMinutes: inputs.shortMockMinutes,
    startDate: state.settings.startDate ?? toIsoDate(today),
  };

  const quickLessons = new Map(
    settings.baseChoices.flatMap((entry) => {
      const lesson = entry.choice === "quick" ? inputs.quickLessons.get(entry.skillId) : null;
      return lesson ? [[entry.skillId, lesson] as const] : [];
    }),
  );

  const carryOver = getSimPlanCarryOver({ mode, world });
  const evidence = readSimEvidence(world, { focus: state.settings });

  const input: BuildPlanInput = {
    announcements: inputs.announcements,
    answeredWrongSkillIds: evidence.answeredWrongSkillIds,
    bands: inputs.bands,
    bringBackSetAside,
    carryOver: carryOver && {
      ...carryOver,
      todayExceptAreas: todayExceptAreas ?? carryOver.todayExceptAreas ?? null,
    },
    examWindows: toExamWindows(plan.phases),
    fullMockMinutes: inputs.fullMockMinutes,
    goal: { dailyMinutes: state.goal.dailyMinutes, kind: goal.kind, targetDate },
    graph: weighGraphForExam({
      areaShares: inputs.areaShares,
      courseWeights: readCourseWeights(goal.details),
      graph,
      topicLevels: inputs.topicLevels,
    }),
    items: plan.items,
    knownAreas: new Set([...getKnownSubjects(goal), ...settings.pastBasicsAreas]),
    knownSkillIds: evidence.knownSkillIds,
    lessons: listPlannedLessons({ graph, settings, world }),
    levelFloor: getLevelFloor(getOwnLevel({ goal })),
    missedSkillIds: listGapSkillIds(world),
    mockMinutes: inputs.mockMinutes,
    mode,
    movesPhaseEnds:
      !(keepPhaseDates ?? mode === "automatic") ||
      movedEnds !== undefined ||
      releasedPhases !== undefined,
    noticeAreas: inputs.areaShares ? new Set(inputs.areaShares.keys()) : null,
    paceFactor: pace.factor,
    phaseEnds:
      (keepPhaseDates ?? mode === "automatic")
        ? getShownPhaseEnds({
            items: plan.items,
            moved: movedEnds,
            phases: plan.phases,
            released: releasedPhases,
          })
        : undefined,
    prerequisites: inputs.prerequisites,
    quickLessons,
    readiness: isExam && targetDate ? learner.readiness : new Map(),
    setAsideLeftWork,
    settings,
    strongAreas: new Set(),
    today,
    todayShown: mode === "automatic" && world.sessions.has(toIsoDate(today)),
    topicLevels: inputs.topicLevels,
  };

  return { graph, input, pace, settings };
}

/** `computePlan` on the simulator's world. */
export function computeSimPlan(request: SimPlanRequest): ComputedPlan {
  const { world } = request;
  const state = request.state ?? world.plan.state;
  const prepared = toPlannerInput({ ...request, state });
  const chosen = chooseBases(prepared.input);
  const { input } = chosen;

  const landedOnly = isOnlyLanding({ input, savedKey: world.plan.inputsKey });

  const built = buildPlan({ ...input, landedOnly });

  const studied = applyBaseChoices({
    bases: input.bases ?? [],
    choices: getKeptBaseChoices(input),
    graph: input.graph,
    items: input.items,
    lessons: input.lessons,
    quickLessons: input.quickLessons,
  });

  const standInLessons = getStandInLessons({
    lessons: studied.lessons,
    skills: studied.graph.skills,
  });

  return {
    bases: chosen.advise(),
    built,
    effect: getPlanEffect({ after: built.items, before: world.plan.items, standInLessons }),
    feasibility: getPlanFeasibility({
      examSubjects: world.inputs.examSubjects,
      input,
      planned: built,
    }),
    inputsKey: getPlanInputsKey({ input, items: built.items }),
    pace: prepared.pace,
    standInLessons,
    state: {
      ...state,
      graph: withPlannedLessons({ graph: prepared.graph, skillLessons: built.skillLessons }),
      settings: prepared.settings,
    },
  };
}

let nextItemId = 0;

/** `savePlanItems` moves every position out of the way first, by this much. */
const ORPHAN_OFFSET = 1_000_000;

/** A value as a JSON column stores it: dates become strings and undefined fields go. */
function asStored(value: unknown): unknown {
  const json = JSON.stringify(value);
  return JSON.parse(json);
}

/**
 * `savePlanItems` keeps a row's status, but sets aside a todo row the run sets aside, and turns a
 * set-aside row the run plans as todo back to todo.
 */
function getSavedStatus({
  existing,
  item,
}: {
  existing: ExistingPlanItem | undefined;
  item: ComputedPlan["built"]["items"][number];
}): ExistingPlanItem["status"] {
  if (!existing) {
    return item.status;
  }

  if (item.status === "skipped" && existing.status === "todo") {
    return "skipped";
  }

  return item.status === "todo" && existing.status === "skipped" ? "todo" : existing.status;
}

/** The saved row of a planned item: a kept item keeps its status, lesson and completion. */
function toSavedItem({
  existing,
  fitted,
  item,
  position,
}: {
  existing: ExistingPlanItem | undefined;
  fitted: ReadonlyMap<string, number>;
  item: ComputedPlan["built"]["items"][number];
  position: number;
}): ExistingPlanItem {
  nextItemId += 1;

  return {
    chapterId: item.chapterId,
    completedAt: existing ? existing.completedAt : item.completedAt,
    id: item.id ?? `item-${nextItemId}`,
    kind: item.kind,
    lessonId: existing ? existing.lessonId : item.lessonId,
    lessons: isStandIn(item) ? (fitted.get(item.skillId ?? "") ?? null) : null,
    phase: item.phase,
    position,
    scheduledFor: item.scheduledFor,
    skillId: item.skillId,
    status: getSavedStatus({ existing, item }),
    titleSnapshot: item.titleSnapshot,
  };
}

/** `commitPlan` on the simulator's world: the plan as `savePlanItems` leaves it. */
export function commitSimPlan({
  computed,
  world,
}: {
  computed: ComputedPlan;
  world: SimWorld;
}): SimPlan {
  const { built, state } = computed;

  const fitted = getFittedStandInLessons({
    skillMinutes: built.skillMinutes,
    standInLessons: computed.standInLessons,
  });

  const existing = new Map(world.plan.items.map((item) => [item.id, item]));
  const keptIds = new Set(built.items.flatMap((item) => (item.id ? [item.id] : [])));

  // `savePlanItems` deletes only todo items that left; anything else keeps its row, moved past
  // the new positions.
  const orphans = world.plan.items
    .filter((item) => !keptIds.has(item.id) && item.status !== "todo")
    .map((item) => ({ ...item, position: item.position + ORPHAN_OFFSET }));

  const items = built.items.map((item, position) =>
    toSavedItem({ existing: item.id ? existing.get(item.id) : undefined, fitted, item, position }),
  );

  return {
    coveredShare: computed.feasibility.deadline ? computed.feasibility.coveredShare : null,
    inputsKey: computed.inputsKey,
    items: [...items, ...orphans],
    knownSkillIds: [...readSimEvidence(world, { focus: state.settings }).knownSkillIds],
    phases: parsePlanPhases(asStored(built.phases)),
    // The plan's JSON as the next run reads it back, which compares it with what it plans.
    state: {
      goal: state.goal,
      graph: parsePlanGraph(asStored(state.graph)),
      settings: parsePlanSettings(asStored(state.settings)),
    },
    version: world.plan.version + 1,
  };
}

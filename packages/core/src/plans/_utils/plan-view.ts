import "server-only";
import { prisma } from "@zoonk/db";
import { arePhaseChallengesRequired } from "../../checkpoints/_utils/phase-challenge-access";
import { getAllowance } from "../../entitlements/get-allowance";
import { loadGoalDateKind } from "../../exams/_utils/goal-date-estimate";
import { loadNoticeDates } from "../../exams/_utils/notice-day";
import { loadExamChoiceViews } from "../../exams/choices/load-exam-choices";
import { getExamDocument } from "../../exams/exam-document";
import { getOwnLevel } from "../../learner/placement/placement-contract";
import { listTaughtStandInSkills } from "../../lookahead/plan-outline-needs";
import { getMinutesPerItem, getPlanStatus } from "../../preparation/plan-status";
import { loadCatchUpItems } from "../../sessions/_utils/catch-up";
import { getExamPrepAccess, getFreeWeekEnd } from "../../sessions/_utils/exam-access";
import { loadTodayLearnBlocks } from "../../view-models/_utils/today-lesson-order";
import { getNoticeWaitState } from "../notice-wait";
import { type PlanScreenView, type PlanView } from "../plan-view-contract";
import { getSkillArea } from "../planner/graph-areas";
import { addDays, getPlanCalendar, getStartOfWeek, toIsoDate } from "../planner/plan-calendar";
import { DAYS_PER_WEEK, type PlanGraph, type PlanSettings } from "../planner/plan-state";
import { loadFitOffer } from "./fit-offer";
import { foldChangeAreas } from "./fold-part-areas";
import { loadPlanReadProjection } from "./load-plan-read";
import { loadGraphPartAreas } from "./part-areas";
import { loadPastDateOffer } from "./past-date-offer";
import { findPlanPhase } from "./phase-states";
import { toPlanBasesView } from "./plan-bases-view";
import { loadPlanChangeViews } from "./plan-change-view";
import { type PlanContext } from "./plan-context";
import { loadPlanCourse } from "./plan-course";
import { isPlanFinished } from "./plan-end";
import { MINUTES_PER_HOUR, buildEstimateView } from "./plan-estimate-view";
import { toFeasibilityView, toScreenFeasibilityView } from "./plan-feasibility-view";
import { buildPlanNumbersView } from "./plan-numbers-view";
import { buildPlanPath } from "./plan-path-view";
import { getSkillAreas } from "./plan-phase-views";
import { type PlanReadContext } from "./plan-read-projection";
import { buildScheduleView } from "./plan-schedule-view";
import { buildPlanTimingView } from "./plan-timing-view";
import { loadPlanTools, toPlanToolViews } from "./plan-tools";
import { type ComputedPlan } from "./replan";
import { getShortPlanShape, toShortPlanView } from "./short-plan-view";
import { getWrittenPracticeView } from "./written-practice-view";

function listAreaNames(graph: PlanGraph): string[] {
  return [...new Set(graph.skills.map((skill) => getSkillArea({ graph, skill })))];
}

function buildAreas({
  graph,
  partAreas,
  settings,
}: {
  graph: PlanGraph;
  partAreas: ReadonlyMap<string, string>;
  settings: PlanSettings;
}): PlanView["areas"] {
  const names = graph.skills.map((skill) => getSkillArea({ graph, skill }));

  return listAreaNames(graph).map((name) => ({
    focusPart: settings.focusParts.find((part) => part.area === name)?.name ?? null,
    focused: settings.focusAreas.includes(name),
    name,
    partOf: partAreas.get(name) ?? null,
    pastBasics: settings.pastBasicsAreas.includes(name),
    reduced: settings.reducedAreas.includes(name),
    skillCount: names.filter((area) => area === name).length,
    skipped: settings.skippedAreas.includes(name),
  }));
}

/** Free exam plans cover the first week and no mocks; Plus covers everything. */
async function getAccess(context: PlanReadContext): Promise<PlanView["access"]> {
  if (context.goal.kind !== "exam") {
    return { freeUntil: null, freeWeekOver: false, mocksRequirePlus: false };
  }

  const allowance = await getAllowance();
  const examPrep = allowance?.examPrep ?? null;

  const freeUntil = getFreeWeekEnd({ examPrep, goal: context.goal, timeZone: context.timeZone });

  return {
    freeUntil: freeUntil ? toIsoDate(freeUntil) : null,
    freeWeekOver: getExamPrepAccess({
      examPrep,
      goal: context.goal,
      timeZone: context.timeZone,
      today: context.today,
    }).trialEnded,
    mocksRequirePlus: !(examPrep?.includesMockExams ?? false),
  };
}

async function loadChapterTitles(chapterIds: string[]): Promise<Map<string, string>> {
  const chapters = await prisma.chapter.findMany({
    select: { id: true, title: true },
    where: { id: { in: chapterIds } },
  });

  return new Map(chapters.map((chapter) => [chapter.id, chapter.title]));
}

/** The days this week the learner studied, so a day left empty by re-planning reads honestly. */
async function loadStudiedDates({ today, userId }: { today: Date; userId: string }) {
  const start = getStartOfWeek(today);

  const days = await prisma.dailyProgress.findMany({
    select: { date: true },
    where: {
      date: { gte: start, lt: addDays(start, DAYS_PER_WEEK) },
      timeSpentSeconds: { gt: 0 },
      userId,
    },
  });

  return new Set(days.map((day) => toIsoDate(day.date)));
}

/** Where the plan stands (see `getPlanStatus`), from its items and the plan's estimate. */
function readPlanStatus({
  phaseChallengesRequired,
  catchUp,
  context,
  freeWeekOver,
  studiesPastTarget,
}: {
  phaseChallengesRequired: boolean;
  catchUp: number;
  context: PlanReadContext;
  freeWeekOver: boolean;
  studiesPastTarget: boolean;
}): PlanView["status"] {
  const { goal, items, plan, today } = context;

  return getPlanStatus({
    catchUp,
    freeWeekOver,
    goalKind: goal.kind,
    items,
    minutesPerItem: getMinutesPerItem({
      estimateHours: plan.estimateHours,
      itemCount: items.length,
    }),
    phaseChallengesRequired,
    studiesPastTarget,
    targetDate: goal.targetDate,
    today,
  });
}

/**
 * The plan view model: every phase with its chapters and checkpoint, this week day
 * by day, the status and estimate, what fits in the learner's time, the areas they can focus on
 * or skip, the tools its chapters use, the exam's choices with the learner's picks, recent changes
 * with proposals waiting for an OK, and the notice's exam day when the plan counts down to another,
 * for the learner to take with one tap.
 */
type PlanViewInput = { context: PlanContext; now: Date };

/**
 * The changes the Plan offers worked out before the learner sees them: for a plan whose date came
 * with lessons left, the one that keeps it going; for any other, what the learner's own time fits
 * that it doesn't hold. None while the plan isn't planned.
 */
async function loadPlanOffers({
  computed,
  context,
  status,
}: {
  computed: ComputedPlan | null;
  context: PlanContext;
  status: PlanView["status"];
}): Promise<Pick<PlanView, "fitOffer" | "pastDateOffer">> {
  if (!computed) {
    return { fitOffer: null, pastDateOffer: null };
  }

  return status?.kind === "pastDate"
    ? { fitOffer: null, pastDateOffer: await loadPastDateOffer(context) }
    : { fitOffer: await loadFitOffer({ computed, context }), pastDateOffer: null };
}

export function buildPlanView(input: PlanViewInput & { screen: true }): Promise<PlanScreenView>;
export function buildPlanView(input: PlanViewInput & { screen?: false }): Promise<PlanView>;
export async function buildPlanView({
  context: savedContext,
  now,
  screen = false,
}: PlanViewInput & { screen?: boolean }): Promise<PlanScreenView | PlanView> {
  const ready = savedContext.phases.length > 0;

  const {
    catchUp: selectedCatchUp,
    computed,
    context,
  } = await loadPlanReadProjection({ context: savedContext, now, screen });

  const { goal, items, phases, state } = context;
  const shortPlan = getShortPlanShape({ goal, settings: state.settings });

  const phaseChallengesRequired = await arePhaseChallengesRequired({
    goalKind: goal.kind,
    userId: goal.userId,
  });

  const currentPhase = findPlanPhase({
    goal,
    items,
    phaseChallengesRequired,
    phases,
    settings: state.settings,
    today: context.today,
  });

  const chapterIds = [...new Set(items.flatMap((item) => item.chapterId ?? []))];

  const [
    changes,
    access,
    chapterTitles,
    course,
    tools,
    studiedDates,
    dateKind,
    noticeDates,
    catchUp,
    examChoices,
    todayBlocks,
    partAreas,
    taughtSkillIds,
  ] = await Promise.all([
    loadPlanChangeViews({ goal, now, planId: context.plan.id, planVersion: context.plan.version }),
    getAccess(context),
    loadChapterTitles(chapterIds),
    loadPlanCourse({ goal, items }),
    loadPlanTools({ currentPhase, goal, items }),
    loadStudiedDates({ today: context.today, userId: goal.userId }),
    loadGoalDateKind(goal),
    loadNoticeDates({
      goal,
      goalDate: state.goal.targetDate,
      noticeDate: state.settings.noticeDate,
      today: toIsoDate(context.today),
    }),
    selectedCatchUp ?? loadCatchUpItems(goal.id),
    loadExamChoiceViews({
      choices: state.settings.examChoices,
      examBlueprintId: goal.examBlueprintId,
    }),
    loadTodayLearnBlocks(goal),
    loadGraphPartAreas({ examBlueprintId: goal.examBlueprintId, graph: state.graph }),
    listTaughtStandInSkills({ goal, graph: state.graph, items }),
  ]);

  const minutes = new Map(
    computed ? computed.built.items.map((item) => [item.key, item.minutes]) : null,
  );

  const skillAreas = getSkillAreas({
    courseTitle: course?.title ?? null,
    skills: state.graph.skills,
  });

  const calendar = getPlanCalendar({ dailyMinutes: goal.dailyMinutes, settings: state.settings });
  const fullCourse = goal.kind === "exam" && state.settings.fullCourse;

  const status = readPlanStatus({
    catchUp: catchUp.length,
    context,
    freeWeekOver: access.freeWeekOver,
    phaseChallengesRequired,
    studiesPastTarget: fullCourse,
  });

  const { fitOffer, pastDateOffer } = await loadPlanOffers({
    computed,
    context: savedContext,
    status,
  });

  return {
    access,
    areas: buildAreas({ ...state, partAreas }),
    bases: computed ? toPlanBasesView({ bases: computed.bases, settings: state.settings }) : null,
    changes: changes.map((change) => foldChangeAreas({ change, partAreas })),
    course,
    currentPhase,
    end: isPlanFinished({
      goalKind: goal.kind,
      items,
      phaseChallengesRequired,
      studiesPastTarget: fullCourse,
      targetDate: goal.targetDate,
      today: context.today,
    })
      ? { kind: "finished" }
      : null,
    estimate: buildEstimateView({ computed, context }),
    examChoices,
    examDocument: getExamDocument(goal),
    feasibility: computed
      ? (screen ? toScreenFeasibilityView : toFeasibilityView)(computed.feasibility)
      : null,
    fitOffer: fitOffer && foldChangeAreas({ change: fitOffer, partAreas }),
    goalId: goal.id,
    notice: getNoticeWaitState({ noticeWaitUntil: context.plan.noticeWaitUntil, now }),
    numbers: computed ? await buildPlanNumbersView({ computed, context, saved: true }) : null,
    ownLevel: getOwnLevel({ goal }),
    pastDateOffer: pastDateOffer && foldChangeAreas({ change: pastDateOffer, partAreas }),
    phases: buildPlanPath({
      challengesOpen: phaseChallengesRequired && !access.freeWeekOver,
      chapterTitles,
      context,
      currentPhase,
      estimateMinutes: computed
        ? computed.built.estimate.totalMinutes
        : (context.plan.estimateHours ?? 0) * MINUTES_PER_HOUR,
      phaseChallengesRequired,
      shortPlan,
      skillAreas,
      taughtSkillIds,
      todayBlocks,
    }),
    planId: context.plan.id,
    ready,
    schedule: buildScheduleView({ calendar, context, dateKind, fullCourse, noticeDates }),
    shortPlan: toShortPlanView({ items, shape: shortPlan }),
    status,
    steering: {
      difficultyBias: state.settings.difficultyBias,
      lessonsStudied: items.filter((item) => item.kind === "lesson" && item.status === "done")
        .length,
      practiceBias: state.settings.practiceBias,
      skippedActivities: state.settings.skippedActivities,
    },
    tools: toPlanToolViews({ settings: state.settings, tools }),
    ...buildPlanTimingView({ access, calendar, context, minutes, skillAreas, studiedDates }),
    writtenPractice: getWrittenPracticeView({ goal, graph: state.graph, settings: state.settings }),
  };
}

import "server-only";
import { prisma } from "@zoonk/db";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { getAllowance } from "../../entitlements/get-allowance";
import { loadIsEstimatedGoalDate } from "../../exams/_utils/goal-date-estimate";
import { getOwnLevel } from "../../learner/placement/placement-contract";
import { getMinutesPerItem, getPlanStatus } from "../../preparation/plan-status";
import { loadCatchUpItems } from "../../sessions/_utils/catch-up";
import { getNoticeWaitState } from "../notice-wait";
import { type PlanView } from "../plan-view-contract";
import { getSkillArea } from "../planner/graph-areas";
import {
  addDays,
  countStudyDays,
  fromIsoDate,
  getPlanCalendar,
  getStartOfWeek,
  getWeekdayMinutes,
  toIsoDate,
} from "../planner/plan-calendar";
import { getExamDayRules } from "../planner/plan-days";
import { type PlanFeasibility } from "../planner/plan-feasibility";
import { DAYS_PER_WEEK, type PlanGraph, type PlanSettings } from "../planner/plan-state";
import { isPlanReady } from "./apply-plan-change";
import { loadPlanChangeViews } from "./plan-change-view";
import { type PlanContext } from "./plan-context";
import { isPlanFinished, loadPlanCourse } from "./plan-course";
import { buildPhaseViews, findCurrentPhase } from "./plan-phase-views";
import { loadPlanTools, toPlanToolViews } from "./plan-tools";
import { buildWeekView } from "./plan-week-view";
import { type ComputedPlan, computePlan } from "./replan";
import { type ShortPlanShape, findShortPlanPhase, getShortPlanShape } from "./short-plan-view";
import { getWrittenPracticeView } from "./written-practice-view";

const MINUTES_PER_HOUR = 60;

function toHours(minutes: number): number {
  return Math.round((minutes / MINUTES_PER_HOUR) * 10) / 10;
}

function toIsoOrNull(date: Date | null): string | null {
  return date ? toIsoDate(date) : null;
}

/** Shares go out as whole percentages' worth, so the screens never show "14.7%". */
function roundShare(share: number): number {
  return Math.round(share * 100) / 100;
}

function toFeasibilityView(feasibility: PlanFeasibility): PlanView["feasibility"] {
  const { maximum } = feasibility;

  return {
    alternative: feasibility.alternative
      ? {
          dailyMinutes: feasibility.alternative.dailyMinutes,
          endDate: toIsoOrNull(feasibility.alternative.endDate),
        }
      : null,
    coreFits: feasibility.coreFits,
    coreMinutes: feasibility.coreMinutes,
    coveredShare: roundShare(feasibility.coveredShare),
    deadline: toIsoOrNull(feasibility.deadline),
    fits: feasibility.fits,
    maximum: maximum
      ? { coveredShare: roundShare(maximum.coveredShare), dailyMinutes: maximum.dailyMinutes }
      : null,
    measure: feasibility.measure,
    recommendedMinutes: feasibility.recommendedMinutes,
  };
}

function buildAreas({
  graph,
  settings,
}: {
  graph: PlanGraph;
  settings: PlanSettings;
}): PlanView["areas"] {
  const names = graph.skills.map((skill) => getSkillArea({ graph, skill }));

  return [...new Set(names)].map((name) => ({
    focusPart: settings.focusParts.find((part) => part.area === name)?.name ?? null,
    focused: settings.focusAreas.includes(name),
    name,
    pastBasics: settings.pastBasicsAreas.includes(name),
    reduced: settings.reducedAreas.includes(name),
    skillCount: names.filter((area) => area === name).length,
    skipped: settings.skippedAreas.includes(name),
  }));
}

/** Free exam plans cover the first week and no mocks; Plus covers everything. */
async function getAccess(context: PlanContext): Promise<PlanView["access"]> {
  if (context.goal.kind !== "exam") {
    return { freeUntil: null, mocksRequirePlus: false };
  }

  const allowance = await getAllowance();
  const studyDays = allowance?.examPrep.studyDays ?? null;
  const { startDate } = context.state.settings;

  return {
    freeUntil:
      studyDays !== null && startDate
        ? toIsoDate(addDays(fromIsoDate(startDate), studyDays - 1))
        : null,
    mocksRequirePlus: !(allowance?.examPrep.includesMockExams ?? false),
  };
}

/**
 * The plan's size and end. The end is the one the plan's graph sizes (see `PlanFeasibility`), so
 * it stays put while the Library outlines lessons. A plan without a graph (a seeded one) keeps the
 * estimate it was saved with and ends on its last item.
 */
function buildEstimate({
  computed,
  context,
}: {
  computed: ComputedPlan | null;
  context: PlanContext;
}): PlanView["estimate"] {
  const pace = context.state.settings.pace;

  if (computed) {
    const { estimate } = computed.built;

    return {
      endDate: toIsoOrNull(computed.feasibility.endDate),
      pace,
      remainingHours: toHours(estimate.remainingMinutes),
      totalHours: toHours(estimate.totalMinutes),
    };
  }

  const { items } = context;
  const totalHours = context.plan.estimateHours ?? 0;
  const todo = items.filter((item) => item.status === "todo").length;
  const last = items.reduce((end, item) => Math.max(end, item.scheduledFor?.getTime() ?? 0), 0);

  return {
    endDate: last > 0 ? toIsoDate(new Date(last)) : null,
    pace,
    remainingHours: items.length > 0 ? Math.round((totalHours * todo * 10) / items.length) / 10 : 0,
    totalHours: Math.round(totalHours * 10) / 10,
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

/** A short plan's days and the day of its short mock, as the plan scheduled it. */
function toShortPlanView({
  context,
  shape,
}: {
  context: PlanContext;
  shape: ShortPlanShape | null;
}): PlanView["shortPlan"] {
  if (!shape) {
    return null;
  }

  const mock = context.items.find((item) => item.kind === "mock" && item.scheduledFor);

  return { days: shape.days, mockDate: toIsoOrNull(mock?.scheduledFor ?? null) };
}

/**
 * The plan view model: every phase with its chapters and checkpoint, this week day
 * by day, the status and estimate, what fits in the learner's time, the areas they can focus on
 * or skip, the tools its chapters use, and recent changes with proposals waiting for an OK.
 */
export async function buildPlanView({
  context,
  now,
}: {
  context: PlanContext;
  now: Date;
}): Promise<PlanView> {
  const { goal, items, phases, state } = context;
  const ready = phases.length > 0;
  const skillAreas = new Map(state.graph.skills.map((skill) => [skill.skillId, skill.area]));
  const shortPlan = getShortPlanShape({ goal, settings: state.settings });

  const currentPhase = findShortPlanPhase({
    phases,
    progressPhase: findCurrentPhase({ items, phaseCount: phases.length }),
    shape: shortPlan,
    today: context.today,
  });

  const chapterIds = [...new Set(items.flatMap((item) => item.chapterId ?? []))];

  const [
    computed,
    changes,
    access,
    chapterTitles,
    course,
    tools,
    studiedDates,
    targetDateEstimated,
    catchUp,
  ] = await Promise.all([
    ready && isPlanReady(context)
      ? computePlan({ context, mode: "automatic", now, pace: "saved" })
      : null,
    loadPlanChangeViews({ now, planId: context.plan.id, planVersion: context.plan.version }),
    getAccess(context),
    loadChapterTitles(chapterIds),
    loadPlanCourse({ goal, items }),
    loadPlanTools({ currentPhase, goal, items }),
    loadStudiedDates({ today: context.today, userId: goal.userId }),
    loadIsEstimatedGoalDate(goal),
    loadCatchUpItems(goal.id),
  ]);

  const minutes = new Map(
    computed ? computed.built.items.map((item) => [item.key, item.minutes]) : null,
  );

  const calendar = getPlanCalendar({ dailyMinutes: goal.dailyMinutes, settings: state.settings });

  return {
    access,
    areas: buildAreas(state),
    changes,
    course,
    currentPhase,
    estimate: buildEstimate({ computed, context }),
    feasibility: computed ? toFeasibilityView(computed.feasibility) : null,
    finished: isPlanFinished(items),
    goalId: goal.id,
    notice: getNoticeWaitState({ noticeWaitUntil: context.plan.noticeWaitUntil, now }),
    ownLevel: getOwnLevel({ goal }),
    phases: buildPhaseViews({
      chapterTitles,
      currentPhase,
      estimateMinutes: computed
        ? computed.built.estimate.totalMinutes
        : (context.plan.estimateHours ?? 0) * MINUTES_PER_HOUR,
      items,
      phases,
      shortPlan,
      skillAreas,
    }),
    planId: context.plan.id,
    ready,
    schedule: {
      dailyMinutes: goal.dailyMinutes,
      lightWeeks: state.settings.lightWeeks,
      studyDays: countStudyDays(calendar),
      targetDate: toIsoOrNull(goal.targetDate),
      targetDateEstimated,
      weekdayMinutes: Array.from({ length: DAYS_PER_WEEK }, (_, weekday) =>
        getWeekdayMinutes({ calendar, weekday }),
      ),
    },
    shortPlan: toShortPlanView({ context, shape: shortPlan }),
    status: getPlanStatus({
      catchUp: catchUp.length,
      items,
      minutesPerItem: getMinutesPerItem({
        estimateHours: context.plan.estimateHours,
        itemCount: items.length,
      }),
      targetDate: goal.targetDate,
      today: context.today,
    }),
    steering: {
      difficultyBias: state.settings.difficultyBias,
      lessonsStudied: items.filter((item) => item.kind === "lesson" && item.status === "done")
        .length,
      practiceBias: state.settings.practiceBias,
      skippedActivities: state.settings.skippedActivities,
    },
    tools: toPlanToolViews({ settings: state.settings, tools }),
    week: buildWeekView({
      access,
      calendar,
      exam: getExamDayRules({ isExam: goal.kind === "exam", settings: state.settings }),
      items,
      minutes,
      skillAreas,
      startDate: getDateInTimeZone({ date: goal.createdAt, timeZone: context.timeZone }),
      studiedDates,
      targetDate: goal.targetDate,
      today: context.today,
    }),
    writtenPractice: getWrittenPracticeView({ goal, graph: state.graph, settings: state.settings }),
  };
}

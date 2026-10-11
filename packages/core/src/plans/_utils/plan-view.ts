import "server-only";
import { prisma } from "@zoonk/db";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
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
import { type PlanView } from "../plan-view-contract";
import { getSkillArea } from "../planner/graph-areas";
import {
  addDays,
  countStudyDays,
  getPlanCalendar,
  getStartOfWeek,
  getWeekdayMinutes,
  toIsoDate,
} from "../planner/plan-calendar";
import { getExamDayRules } from "../planner/plan-days";
import { DAYS_PER_WEEK, type PlanGraph, type PlanSettings } from "../planner/plan-state";
import { isPlanReady } from "./apply-plan-change";
import { foldChangeAreas } from "./fold-part-areas";
import { loadGraphPartAreas } from "./part-areas";
import { toPlanBasesView } from "./plan-bases-view";
import { loadPlanChangeViews } from "./plan-change-view";
import { type PlanContext } from "./plan-context";
import { loadPlanCourse } from "./plan-course";
import { getPlanEnd } from "./plan-end";
import { toFeasibilityView } from "./plan-feasibility-view";
import { buildPhaseViews, findCurrentPhase, getSkillAreas } from "./plan-phase-views";
import { loadPlanTools, toPlanToolViews } from "./plan-tools";
import { buildWeekView } from "./plan-week-view";
import { type ComputedPlan, computePlan } from "./replan";
import { findShortPlanPhase, getShortPlanShape, toShortPlanView } from "./short-plan-view";
import { getOutlinedUntil } from "./stand-in-lessons";
import { findUpNextItem } from "./up-next-item";
import { getWrittenPracticeView } from "./written-practice-view";

const MINUTES_PER_HOUR = 60;

function toHours(minutes: number): number {
  return Math.round((minutes / MINUTES_PER_HOUR) * 10) / 10;
}

function toIsoOrNull(date: Date | null): string | null {
  return date ? toIsoDate(date) : null;
}

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
async function getAccess(context: PlanContext): Promise<PlanView["access"]> {
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

/**
 * The plan view model: every phase with its chapters and checkpoint, this week day
 * by day, the status and estimate, what fits in the learner's time, the areas they can focus on
 * or skip, the tools its chapters use, the exam's choices with the learner's picks, recent changes
 * with proposals waiting for an OK, and the notice's exam day when the plan counts down to another,
 * for the learner to take with one tap.
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
    dateKind,
    noticeDates,
    catchUp,
    examChoices,
    todayBlocks,
    partAreas,
    taughtSkillIds,
  ] = await Promise.all([
    ready && isPlanReady(context)
      ? computePlan({ context, mode: "automatic", now, pace: "saved" })
      : null,
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
    loadCatchUpItems(goal.id),
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

  return {
    access,
    areas: buildAreas({ ...state, partAreas }),
    bases: computed ? toPlanBasesView({ bases: computed.bases, settings: state.settings }) : null,
    changes: changes.map((change) => foldChangeAreas({ change, partAreas })),
    course,
    currentPhase,
    end: getPlanEnd(items),
    estimate: buildEstimate({ computed, context }),
    examChoices,
    examDocument: getExamDocument(goal),
    feasibility: computed ? toFeasibilityView(computed.feasibility) : null,
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
      outlinedUntil: getOutlinedUntil(context.today),
      phases,
      shortPlan,
      skillAreas,
      skillPhases: new Map(state.graph.skills.map((skill) => [skill.skillId, skill.phase])),
      taughtSkillIds,
      upNextItemId: findUpNextItem({ items, todayBlocks })?.id ?? null,
    }),
    planId: context.plan.id,
    ready,
    schedule: {
      dailyMinutes: goal.dailyMinutes,
      fullCourse,
      lightWeeks: state.settings.lightWeeks,
      nextSitting: fullCourse ? noticeDates.nextSitting : null,
      noSitting: noticeDates.noSitting,
      noticeDay: noticeDates.day,
      studyDays: countStudyDays(calendar),
      targetDate: toIsoOrNull(goal.targetDate),
      targetDateEstimated: dateKind.estimated,
      targetDateNamedMonth: dateKind.namedMonth,
      weekdayMinutes: Array.from({ length: DAYS_PER_WEEK }, (_, weekday) =>
        getWeekdayMinutes({ calendar, weekday }),
      ),
    },
    shortPlan: toShortPlanView({ items, shape: shortPlan }),
    status: getPlanStatus({
      catchUp: catchUp.length,
      freeWeekOver: access.freeWeekOver,
      items,
      minutesPerItem: getMinutesPerItem({
        estimateHours: context.plan.estimateHours,
        itemCount: items.length,
      }),
      studiesPastTarget: fullCourse,
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

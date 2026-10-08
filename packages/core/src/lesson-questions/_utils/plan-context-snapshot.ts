import "server-only";
import {
  type PlanItemReason,
  type PlanScopeContext,
} from "@zoonk/ai/tasks/lessons/question-context";
import { type Goal, type PlanItemKind, type StudySessionBlock, prisma } from "@zoonk/db";
import { getString } from "@zoonk/utils/json";
import { loadExamNoticeFacts } from "../../exams/_utils/exam-notice-facts";
import { loadGoalSkillIds } from "../../learner/_utils/goal-skill-graph";
import { getLibraryCourse } from "../../library/courses/get-library-course";
import { readMistakeSnapshot } from "../../mistakes/mistake-snapshot";
import { getGoalPlan } from "../../plans/get-goal-plan";
import { type PlanItemView, type PlanView } from "../../plans/plan-view-contract";
import { fromIsoDate, toIsoDate } from "../../plans/planner/plan-calendar";
import { type PlanStatus } from "../../preparation/plan-status";
import { readBlockPayload } from "../../sessions/block-payload";
import { getBlockReason } from "./block-reason";
import { loadGoalCutoff } from "./goal-cutoff";

/** "What comes next" covers the next few study days of the week. */
const NEXT_DAYS = 3;

/**
 * Every message sends the context, so it carries what a question about the plan needs, not the
 * whole plan: a day's first lessons, the phase's chapters still ahead (an exam's phase can hold a
 * hundred), and the course's levels without their chapters.
 */
const NEXT_DAY_ITEMS = 8;
const PHASE_CHAPTERS_AHEAD = 8;

/** The buddy sees the learner's latest few open mistakes, each question cut to a short line. */
const RECENT_MISTAKES = 3;
const MAX_MISTAKE_TEXT = 300;

type SessionBlock = StudySessionBlock & { lesson: { title: string } | null };

type PlanScopeItem = NonNullable<PlanScopeContext["today"]>["items"][number];

function toSessionItem(block: SessionBlock): PlanScopeItem {
  const payload = readBlockPayload(block);

  return {
    canDo: block.canDo,
    kind: block.kind,
    minutes: block.estimatedMinutes,
    reason: getBlockReason(block),
    status: block.status,
    title: block.lesson?.title ?? payload.title ?? payload.capsules[0]?.title ?? null,
  };
}

const PLAN_ITEM_REASONS: Record<PlanItemKind, PlanItemReason> = {
  boss: "checkpoint",
  chapter: "newSkill",
  checkpoint: "checkpoint",
  lesson: "newSkill",
  mock: "checkpoint",
  review: "reviewDue",
};

/**
 * A mock exam the learner's plan doesn't include stays on its day, marked: features are never
 * hidden, so the buddy can say it comes with Plus when asked about it, and that the day is a full
 * review of every topic instead.
 */
function toPlusMark(item: Pick<PlanItemView, "kind" | "requiresPlus">) {
  return item.kind === "mock" && item.requiresPlus ? { plusRequired: true as const } : {};
}

function toPlanItem(item: PlanItemView): PlanScopeItem {
  return {
    canDo: null,
    kind: item.kind,
    minutes: item.minutes,
    reason: PLAN_ITEM_REASONS[item.kind],
    status: item.status,
    title: item.title,
    ...toPlusMark(item),
  };
}

/** Today's session once the learner opened it; until then, what the plan gives the day. */
async function loadToday({
  goal,
  plan,
}: {
  goal: Goal;
  plan: PlanView;
}): Promise<PlanScopeContext["today"] | null> {
  const day = plan.week.days.find((candidate) => candidate.state === "today");

  if (!day) {
    return null;
  }

  const session = await prisma.studySession.findUnique({
    include: {
      blocks: { include: { lesson: { select: { title: true } } }, orderBy: { position: "asc" } },
    },
    where: {
      userGoalDate: { goalId: goal.id, localDate: fromIsoDate(day.date), userId: goal.userId },
    },
  });

  if (session && session.blocks.length > 0) {
    return { date: day.date, items: session.blocks.map(toSessionItem), source: "session" };
  }

  return { date: day.date, items: day.items.map((item) => toPlanItem(item)), source: "plan" };
}

function toStatus(status: PlanStatus | null): PlanScopeContext["status"] {
  if (!status) {
    return null;
  }

  return {
    days: "days" in status ? status.days : null,
    extraMinutesPerDay: status.kind === "behind" ? status.extraMinutesPerDay : null,
    kind: status.kind,
    lessons: status.kind === "behind" ? status.lessons : null,
    options: status.kind === "needsAdjusting" ? status.options : [],
  };
}

function toPhase(plan: PlanView): PlanScopeContext["phase"] {
  const phase = plan.phases.find((candidate) => candidate.state === "current");

  if (!phase) {
    return null;
  }

  const ahead = phase.chapters.filter((chapter) => chapter.state !== "done");
  const shown = ahead.slice(0, PHASE_CHAPTERS_AHEAD);

  return {
    chapters: shown.map((chapter) => ({
      lessonsDone: chapter.lessonsDone,
      lessonsTotal: chapter.lessonsTotal,
      state: chapter.state,
      title: chapter.title,
    })),
    chaptersDone: phase.chapters.length - ahead.length,
    chaptersLater: ahead.length - shown.length,
    endDate: phase.endDate,
    index: phase.index,
    kind: phase.kind,
    name: phase.name,
  };
}

function toNextDays(plan: PlanView): PlanScopeContext["next"] {
  return plan.week.days
    .filter((day) => day.state === "upcoming" && day.items.length > 0)
    .slice(0, NEXT_DAYS)
    .map((day) => ({
      date: day.date,
      items: day.items
        .slice(0, NEXT_DAY_ITEMS)
        .map((item) => ({ kind: item.kind, title: item.title, ...toPlusMark(item) })),
      moreItems: Math.max(0, day.items.length - NEXT_DAY_ITEMS),
    }));
}

/**
 * The course the plan is built from, so one "Ask" on the plan answers about both: what it is and
 * its chapters' titles level by level, with the levels the plan teaches from. An exam's plan is
 * built from the notice's subjects (`setup.areas`), not from one course, so it has none.
 */
async function loadCourse({
  goal,
  plan,
}: {
  goal: Goal;
  plan: PlanView;
}): Promise<PlanScopeContext["course"]> {
  const planCourse = goal.kind === "exam" ? null : plan.course;
  const course = planCourse ? await getLibraryCourse({ courseId: planCourse.courseId }) : null;

  if (!planCourse || !course) {
    return null;
  }

  const inPlan = new Set(
    planCourse.levels.filter((level) => level.inPlan).map(({ level }) => level),
  );

  return {
    description: course.description,
    levels: course.levels.map((band) => ({
      chapters: band.chapters.map((chapter) => chapter.title),
      inPlan: inPlan.has(band.level),
      level: band.level,
    })),
    targetLanguage: course.targetLanguage,
    title: course.title,
  };
}

/** How the learner shaped the plan, so the buddy can say what a change would touch. */
function toSetup(plan: PlanView): NonNullable<PlanScopeContext["setup"]> {
  return {
    areas: plan.areas.map((area) => ({
      focusPart: area.focusPart,
      focused: area.focused,
      name: area.name,
      pastBasics: area.pastBasics,
      reduced: area.reduced,
      skipped: area.skipped,
    })),
    coverage: plan.feasibility && {
      coreFits: plan.feasibility.coreFits,
      coreMinutes: plan.feasibility.coreMinutes,
      coveredShare: plan.feasibility.coveredShare,
      fits: plan.feasibility.fits,
      measure: plan.feasibility.measure,
      recommendedMinutes: plan.feasibility.recommendedMinutes,
    },
    difficultyBias: plan.steering.difficultyBias,
    lightWeeks: plan.schedule.lightWeeks.map((week) => ({
      endDate: week.endDate,
      startDate: week.startDate,
    })),
    ownLevel: plan.ownLevel,
    practiceBias: plan.steering.practiceBias,
    weekdayMinutes: plan.schedule.weekdayMinutes,
    writtenCadence: plan.writtenPractice?.cadence ?? null,
  };
}

function shorten(text: string | null | undefined): string | null {
  return text ? text.slice(0, MAX_MISTAKE_TEXT) : null;
}

/** The learner's latest open mistakes in this goal, so "explain my mistake" has them. */
async function loadRecentMistakes(goal: Goal): Promise<NonNullable<PlanScopeContext["mistakes"]>> {
  const skillIds = await loadGoalSkillIds(goal.id);

  if (skillIds.length === 0) {
    return [];
  }

  const mistakes = await prisma.mistake.findMany({
    orderBy: { createdAt: "desc" },
    select: { skill: { select: { name: true } }, snapshot: true },
    take: RECENT_MISTAKES,
    where: { skillId: { in: skillIds }, status: "open", userId: goal.userId },
  });

  return mistakes.map((mistake) => {
    const snapshot = readMistakeSnapshot(mistake.snapshot);

    return {
      answer: shorten(snapshot.answer),
      correctAnswer: shorten(snapshot.correctAnswer),
      question: shorten(snapshot.question) ?? "",
      skill: mistake.skill?.name ?? null,
    };
  });
}

/** What the learner said they aim for: a score, a course, a position ("750 · Medicina, UFMG"). */
function getGoalTarget(goal: Goal): string | null {
  const parts = ["targetScore", "targetCourse", "targetPosition"].flatMap(
    (field) => getString(goal.details, field)?.trim() || [],
  );

  return parts.length > 0 ? parts.join(" · ") : null;
}

function toGoalContext({
  cutoff,
  dailyMinutes,
  goal,
}: {
  cutoff: PlanScopeContext["goal"]["cutoff"];
  dailyMinutes: number;
  goal: Goal;
}): PlanScopeContext["goal"] {
  return {
    cutoff,
    dailyMinutes,
    kind: goal.kind,
    target: getGoalTarget(goal),
    targetDate: goal.targetDate ? toIsoDate(goal.targetDate) : null,
    title: goal.title,
  };
}

/**
 * While the planner is still writing the plan, the buddy knows the goal and nothing of the plan
 * yet: doubts about the subject get answered, and a plan change waits for the plan.
 */
async function buildPlanBuildingSnapshot(goal: Goal): Promise<PlanScopeContext> {
  const [exam, cutoff] = await Promise.all([loadExamNoticeFacts(goal), loadGoalCutoff(goal)]);

  return {
    course: null,
    estimate: { endDate: null, remainingHours: 0 },
    exam,
    goal: toGoalContext({ cutoff, dailyMinutes: goal.dailyMinutes, goal }),
    language: goal.language,
    mistakes: [],
    next: [],
    phase: null,
    scope: { kind: "plan" },
    status: null,
    today: null,
    version: 1,
  };
}

/**
 * The buddy's view of the learner's goal and plan, from the same plan view the apps show and
 * today's session: where they are, why each thing is in their day, what comes next, how they
 * shaped the plan, their latest mistakes, the course it's built from, and for an exam what its
 * notice says. Null for a goal without a plan.
 */
export async function buildPlanContextSnapshot(goal: Goal): Promise<PlanScopeContext | null> {
  const result = await getGoalPlan(goal.id);

  if (result.status !== "ready") {
    return null;
  }

  if (!result.plan.ready) {
    return buildPlanBuildingSnapshot(goal);
  }

  const { plan } = result;

  const [course, today, mistakes, exam, cutoff] = await Promise.all([
    loadCourse({ goal, plan }),
    loadToday({ goal, plan }),
    loadRecentMistakes(goal),
    loadExamNoticeFacts(goal),
    loadGoalCutoff(goal),
  ]);

  return {
    course,
    estimate: { endDate: plan.estimate.endDate, remainingHours: plan.estimate.remainingHours },
    exam,
    goal: toGoalContext({ cutoff, dailyMinutes: plan.schedule.dailyMinutes, goal }),
    language: goal.language,
    mistakes,
    next: toNextDays(plan),
    phase: toPhase(plan),
    scope: { kind: "plan" },
    setup: toSetup(plan),
    status: toStatus(plan.status),
    today,
    version: 1,
  };
}

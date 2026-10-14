import "server-only";
import { type PlanScopeContext } from "@zoonk/ai/tasks/lessons/question-context";
import { type Goal, prisma } from "@zoonk/db";
import { getString } from "@zoonk/utils/json";
import { loadExamNoticeFacts } from "../../exams/_utils/exam-notice-facts";
import { findActiveGoalId } from "../../goals/_utils/goal-view";
import { loadGoalSkillIds } from "../../learner/_utils/goal-skill-graph";
import { getLibraryCourse } from "../../library/courses/get-library-course";
import { readMistakeSnapshot } from "../../mistakes/mistake-snapshot";
import { getGoalPlan } from "../../plans/get-goal-plan";
import { type PlanView } from "../../plans/plan-view-contract";
import { toIsoDate } from "../../plans/planner/plan-calendar";
import { type PlanStatus } from "../../preparation/plan-status";
import { loadGoalCutoff } from "./goal-cutoff";
import { loadPlanDayContext, toChallengeLink, toPlusMark } from "./plan-day-context";

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

function toStatus(status: PlanStatus | null): PlanScopeContext["status"] {
  if (!status) {
    return null;
  }

  return {
    challenges: status.kind === "challengesLeft" ? status.challenges : null,
    days: "days" in status ? status.days : null,
    extraMinutesPerDay: status.kind === "behind" ? status.extraMinutesPerDay : null,
    kind: status.kind,
    lessons: status.kind === "behind" || status.kind === "pastDate" ? status.lessons : null,
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
        .map((item) => ({
          kind: item.kind,
          link: toChallengeLink(item),
          title: item.title,
          ...toPlusMark(item),
        })),
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
export async function buildPlanContextSnapshot(
  goal: Goal,
  {
    conversation = false,
  }: {
    /**
     * The buddy's own conversation about the goal, not a screen of it: only there may answers link
     * what acts on the open goal (see `LinkScope`).
     */
    conversation?: boolean;
  } = {},
): Promise<PlanScopeContext | null> {
  const result = await getGoalPlan(goal.id);

  if (result.status !== "ready") {
    return null;
  }

  if (!result.plan.ready) {
    return buildPlanBuildingSnapshot(goal);
  }

  const { plan } = result;

  const activeGoalId = conversation ? await findActiveGoalId(goal.userId) : null;
  const scope = { activeGoal: activeGoalId === goal.id };

  const [course, day, mistakes, exam, cutoff] = await Promise.all([
    loadCourse({ goal, plan }),
    loadPlanDayContext({ goal, plan, scope }),
    loadRecentMistakes(goal),
    loadExamNoticeFacts(goal),
    loadGoalCutoff(goal),
  ]);

  return {
    ...day,
    course,
    estimate: { endDate: plan.estimate.endDate, remainingHours: plan.estimate.remainingHours },
    exam,
    goal: toGoalContext({ cutoff, dailyMinutes: plan.schedule.dailyMinutes, goal }),
    language: goal.language,
    mistakes,
    next: toNextDays(plan),
    phase: toPhase(plan),
    scope: { kind: "plan" },
    ...(scope.activeGoal && { selectedGoal: true as const }),
    setup: toSetup(plan),
    status: toStatus(plan.status),
    version: 1,
  };
}

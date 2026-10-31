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

const NEXT_DAYS = 3;

const NEXT_DAY_ITEMS = 8;
const PHASE_CHAPTERS_AHEAD = 8;

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

async function loadCourse({
  goal,
  plan,
}: {
  goal: Goal;
  plan: PlanView;
}): Promise<{ course: PlanScopeContext["course"]; ownCourse: boolean }> {
  const planCourse = goal.kind === "exam" ? null : plan.course;
  const course = planCourse ? await getLibraryCourse({ courseId: planCourse.courseId }) : null;

  if (!planCourse || !course) {
    return { course: null, ownCourse: false };
  }

  const inPlan = new Set(
    planCourse.levels.filter((level) => level.inPlan).map(({ level }) => level),
  );

  return {
    course: {
      description: course.description,
      levels: course.levels.map((band) => ({
        chapters: band.chapters.map((chapter) => chapter.title),
        inPlan: inPlan.has(band.level),
        level: band.level,
      })),
      targetLanguage: course.targetLanguage,
      title: course.title,
    },
    ownCourse: course.visibility === "private",
  };
}

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
      coveredShare: plan.feasibility.coveredShare,
      fits: plan.feasibility.fits,
      measure: plan.feasibility.measure,
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

/** A pending plan can answer subject questions but cannot propose plan changes yet. */
async function buildPlanBuildingSnapshot(goal: Goal): Promise<PlanScopeContext> {
  const [exam, cutoff] = await Promise.all([loadExamNoticeFacts(goal), loadGoalCutoff(goal)]);

  return {
    catchUp: null,
    challenges: [],
    course: null,
    estimate: { endDate: null, remainingHours: 0 },
    exam,
    goal: toGoalContext({ cutoff, dailyMinutes: goal.dailyMinutes, goal }),
    language: goal.language,
    mistakes: [],
    next: [],
    phase: null,
    scope: { kind: "plan" },
    setup: null,
    status: null,
    today: null,
    version: 1,
  };
}

/** Returns null without a plan. */
export async function buildPlanContextSnapshot(
  goal: Goal,
  {
    conversation = false,
  }: {
    /** Only the goal's own conversation may link actions on the currently open goal. */
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

  const [{ course, ownCourse }, day, mistakes, exam, cutoff] = await Promise.all([
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
    privateContent: ownCourse || exam?.fromMaterial === true,
    scope: { kind: "plan" },
    ...(scope.activeGoal && { selectedGoal: true as const }),
    setup: toSetup(plan),
    status: toStatus(plan.status),
    version: 1,
  };
}

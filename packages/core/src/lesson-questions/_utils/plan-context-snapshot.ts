import "server-only";
import {
  type PlanItemReason,
  type PlanScopeContext,
} from "@zoonk/ai/tasks/lessons/question-context";
import { type Goal, type PlanItemKind, type StudySessionBlock, prisma } from "@zoonk/db";
import { getLibraryCourse } from "../../library/courses/get-library-course";
import { getGoalPlan } from "../../plans/get-goal-plan";
import { type PlanView } from "../../plans/plan-view-contract";
import { fromIsoDate, toIsoDate } from "../../plans/planner/plan-calendar";
import { type PlanStatus } from "../../preparation/plan-status";
import { readBlockPayload } from "../../sessions/block-payload";

/** "What comes next" covers the next few study days of the week. */
const NEXT_DAYS = 3;

type SessionBlock = StudySessionBlock & { lesson: { title: string } | null };

/**
 * Why a block is in today's session, as the session builder put it there: daily practice rotates
 * through the weakest skills, and drills are on saved mistakes.
 */
function getBlockReason(block: SessionBlock): PlanItemReason {
  const payload = readBlockPayload(block);

  if (payload.extra) {
    return "extraPractice";
  }

  switch (block.kind) {
    case "checkpoint":
      return "checkpoint";
    case "learn":
      return payload.reinforcement ? "reinforcement" : "newSkill";
    case "practice":
      return payload.drills.length > 0 ? "mistakes" : "weakArea";
    case "produce":
      return "produce";
    case "review":
      return "reviewDue";
    default:
      return block.kind satisfies never;
  }
}

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

function toPlanItem(item: PlanView["week"]["days"][number]["items"][number]): PlanScopeItem {
  return {
    canDo: null,
    kind: item.kind,
    minutes: item.minutes,
    reason: PLAN_ITEM_REASONS[item.kind],
    status: item.status,
    title: item.title,
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

  return { date: day.date, items: day.items.map(toPlanItem), source: "plan" };
}

function toStatus(status: PlanStatus | null): PlanScopeContext["status"] {
  if (!status) {
    return null;
  }

  return {
    days: "days" in status ? status.days : null,
    extraMinutesPerDay: status.kind === "behind" ? status.extraMinutesPerDay : null,
    kind: status.kind,
    options: status.kind === "needsAdjusting" ? status.options : [],
  };
}

function toPhase(plan: PlanView): PlanScopeContext["phase"] {
  const phase = plan.phases.find((candidate) => candidate.state === "current");

  if (!phase) {
    return null;
  }

  return {
    chapters: (phase.chapters ?? []).map((chapter) => ({
      lessonsDone: chapter.lessonsDone,
      lessonsTotal: chapter.lessonsTotal,
      state: chapter.state,
      title: chapter.title,
    })),
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
      items: day.items.map((item) => ({ kind: item.kind, title: item.title })),
    }));
}

/**
 * The course the plan is built from, so one "Ask" on the plan answers about both: what it is and
 * its chapters, level by level.
 */
async function loadCourse(plan: PlanView): Promise<PlanScopeContext["course"]> {
  const course = plan.course ? await getLibraryCourse({ courseId: plan.course.courseId }) : null;

  if (!course) {
    return null;
  }

  return {
    description: course.description,
    levels: course.levels.map((band) => ({
      chapters: band.chapters.map((chapter) => ({
        lessonCount: chapter.lessons.length,
        title: chapter.title,
      })),
      level: band.level,
    })),
    targetLanguage: course.targetLanguage,
    title: course.title,
  };
}

/**
 * The tutor's view of the learner's plan for a goal, from the same plan view both modes show and
 * today's session: where they are, why each thing is in their day, what comes next, and the
 * course it's built from. Null while the planner is still writing the plan.
 */
export async function buildPlanContextSnapshot(goal: Goal): Promise<PlanScopeContext | null> {
  const result = await getGoalPlan(goal.id);

  if (result.status !== "ready" || !result.plan.ready) {
    return null;
  }

  const { plan } = result;
  const [course, today] = await Promise.all([loadCourse(plan), loadToday({ goal, plan })]);

  return {
    course,
    estimate: { endDate: plan.estimate.endDate, remainingHours: plan.estimate.remainingHours },
    goal: {
      dailyMinutes: plan.schedule.dailyMinutes,
      kind: goal.kind,
      targetDate: goal.targetDate ? toIsoDate(goal.targetDate) : null,
      title: goal.title,
    },
    language: goal.language,
    next: toNextDays(plan),
    phase: toPhase(plan),
    scope: { kind: "plan" },
    status: toStatus(plan.status),
    today,
    version: 1,
  };
}

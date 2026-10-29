import "server-only";
import { type Goal, type StudySessionBlock, prisma } from "@zoonk/db";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { findOwnedGoal, getAnswerTimeZone } from "../learner/_utils/owned-goal";
import {
  canRedraftLesson,
  getLessonGenerationStates,
} from "../library/generation/lesson-generation-state";
import { getGoalFieldInput } from "../library/items/item-field";
import { findPlanFirstLessonId } from "../plans/_utils/plan-first-lesson";
import { parsePlanSettings } from "../plans/planner/plan-state";
import { loadExamPrepAccess } from "../sessions/_utils/plus-only-lessons";
import { findOwnedStudySession } from "../sessions/_utils/study-session-access";
import { type LearnerLookahead, getLearnerTier, getLookahead } from "./learner-lookahead";

const OPEN_BLOCK_STATUSES = new Set<StudySessionBlock["status"]>(["active", "pending"]);

export type SessionPreparationAccess =
  | { goalId: string; sessionId: string; status: "ready"; timeZone: string; userId: string }
  /** Guests may prepare only their next lesson, counted as its start, and the outlines their plan reaches. */
  | {
      goalId: string | null;
      lessonId: string | null;
      status: "guest";
      timeZone: string;
      userId: string;
    }
  | { status: "plusRequired" }
  | { status: "notFound" }
  | { status: "unauthorized" };

export type GoalPreparationAccess =
  | Exclude<SessionPreparationAccess, { status: "ready" }>
  | { goalId: string; status: "ready"; timeZone: string; userId: string };

export type SessionPreparation = {
  forExam: boolean;
  /** Generate these immediately; the learner is only minutes away. */
  lessonIds: string[];
  /** Next-day lessons use background generation at the flex tier. */
  laterLessonIds: string[];
  /** Includes written lessons too, in plan order. */
  plannedLessonIds: string[];
  /** Write the personal layer only after the underlying shared lessons finish. */
  personalized: boolean;
};

const NOTHING_TO_PREPARE: SessionPreparation = {
  forExam: false,
  laterLessonIds: [],
  lessonIds: [],
  personalized: false,
  plannedLessonIds: [],
};

function findNextLessonId(blocks: readonly StudySessionBlock[]): string | null {
  const next = blocks.find(
    (block) => block.kind === "learn" && block.lessonId && block.status === "pending",
  );

  return next?.lessonId ?? null;
}

async function isPrepHeldForPlus(goal: Goal): Promise<boolean> {
  const access = await loadExamPrepAccess({ goal });
  return access.trialEnded;
}

/** Guests may prepare only their next lesson, never the full session. */
export async function getSessionPreparationAccess({
  sessionId,
}: {
  sessionId: string;
}): Promise<SessionPreparationAccess> {
  const owned = await findOwnedStudySession(sessionId);

  if (owned.status !== "ready") {
    return owned;
  }

  const { session, userId } = owned;

  const user = await prisma.user.findUnique({
    select: { isAnonymous: true },
    where: { id: userId },
  });

  if (user?.isAnonymous) {
    return {
      goalId: session.goalId,
      lessonId: findNextLessonId(session.blocks),
      status: "guest",
      timeZone: getAnswerTimeZone({ goal: session.goal, timeZone: null }),
      userId,
    };
  }

  if (!session.goalId || !session.goal) {
    return { status: "notFound" };
  }

  if (await isPrepHeldForPlus(session.goal)) {
    return { status: "plusRequired" };
  }

  return {
    goalId: session.goalId,
    sessionId: session.id,
    status: "ready",
    timeZone: getAnswerTimeZone({ goal: session.goal, timeZone: null }),
    userId,
  };
}

/** Before session creation, guests may prepare only the plan's first lesson, counted as its start. */
export async function getGoalPreparationAccess({
  goalId,
}: {
  goalId: string;
}): Promise<GoalPreparationAccess> {
  const owned = await findOwnedGoal(goalId);

  if (owned.status !== "ready") {
    return owned;
  }

  const user = await prisma.user.findUnique({
    select: { isAnonymous: true },
    where: { id: owned.userId },
  });

  if (user?.isAnonymous) {
    return {
      goalId,
      lessonId: await findPlanFirstLessonId(goalId),
      status: "guest",
      timeZone: getAnswerTimeZone({ goal: owned.goal, timeZone: null }),
      userId: owned.userId,
    };
  }

  if (await isPrepHeldForPlus(owned.goal)) {
    return { status: "plusRequired" };
  }

  return {
    goalId,
    status: "ready",
    timeZone: getAnswerTimeZone({ goal: owned.goal, timeZone: null }),
    userId: owned.userId,
  };
}

async function loadPlannedDayLessons({ goal, day }: { goal: Goal; day: Date }) {
  const items = await prisma.planItem.findMany({
    orderBy: { position: "asc" },
    select: { lessonId: true },
    where: {
      lessonId: { not: null },
      plan: { goalId: goal.id },
      scheduledFor: day,
      status: "todo",
    },
  });

  return items.flatMap((item) => (item.lessonId ? [item.lessonId] : []));
}

async function loadTodayLessons({
  goal,
  today,
  userId,
}: {
  goal: Goal;
  today: Date;
  userId: string;
}) {
  const session = await prisma.studySession.findUnique({
    include: { blocks: { orderBy: { position: "asc" } } },
    where: { userGoalDate: { goalId: goal.id, localDate: today, userId } },
  });

  if (!session) {
    const planned = await loadPlannedDayLessons({ day: today, goal });
    return { inSession: new Set(planned), open: planned };
  }

  const learnBlocks = session.blocks.filter(
    (block): block is StudySessionBlock & { lessonId: string } =>
      block.kind === "learn" && block.lessonId !== null,
  );

  return {
    inSession: new Set(learnBlocks.map((block) => block.lessonId)),
    open: learnBlocks
      .filter((block) => OPEN_BLOCK_STATUSES.has(block.status))
      .map((block) => block.lessonId),
  };
}

function loadUpcomingLessons({ goal, today }: { goal: Goal; today: Date }) {
  return prisma.planItem.findMany({
    orderBy: { position: "asc" },
    select: { lessonId: true, scheduledFor: true },
    where: {
      lessonId: { not: null },
      plan: { goalId: goal.id },
      scheduledFor: { gt: today },
      status: "todo",
    },
  });
}

/** Next-day picks exclude lessons pulled into today's session; never build tomorrow's session ahead of its own allowance checks. */
function pickNextLessons({
  count,
  inSession,
  upcoming,
}: {
  count: number;
  inSession: ReadonlySet<string>;
  upcoming: Awaited<ReturnType<typeof loadUpcomingLessons>>;
}): string[] {
  const ahead = upcoming.filter((item) => item.lessonId && !inSession.has(item.lessonId));
  const nextDay = ahead[0]?.scheduledFor?.getTime();

  return ahead
    .flatMap((item) =>
      item.lessonId && item.scheduledFor?.getTime() === nextDay ? [item.lessonId] : [],
    )
    .slice(0, count);
}

function filterUnwritten({
  lessonIds,
  states,
}: {
  lessonIds: readonly string[];
  states: Awaited<ReturnType<typeof getLessonGenerationStates>>;
}): string[] {
  return lessonIds.filter((lessonId) => {
    const state = states.get(lessonId);
    return state?.status === "notStarted" || canRedraftLesson(state);
  });
}

function pickTodayWindow({
  lookahead,
  open,
}: {
  lookahead: LearnerLookahead;
  open: readonly string[];
}): string[] {
  return open.slice(0, 1 + lookahead.lessonsAhead);
}

async function hasPersonalLayer(goal: Goal) {
  if (getGoalFieldInput(goal.details)) {
    return true;
  }

  const plan = await prisma.plan.findUnique({
    select: { settings: true },
    where: { goalId: goal.id },
  });

  return parsePlanSettings(plan?.settings).tools.length > 0;
}

/** Workflow bridge: ids must come from getSessionPreparationAccess. Preserves plan order and excludes already-written or running content. */
export async function listSessionPreparation({
  goalId,
  timeZone,
  userId,
}: {
  goalId: string;
  timeZone: string;
  userId: string;
}): Promise<SessionPreparation> {
  const goal = await prisma.goal.findUnique({ where: { id: goalId } });

  if (!goal || goal.status !== "active") {
    return NOTHING_TO_PREPARE;
  }

  const today = getDateInTimeZone({ date: new Date(), timeZone });

  const [todayLessons, upcoming, tier] = await Promise.all([
    loadTodayLessons({ goal, today, userId }),
    loadUpcomingLessons({ goal, today }),
    getLearnerTier(userId),
  ]);

  const lookahead = getLookahead(tier);
  const todayWindow = pickTodayWindow({ lookahead, open: todayLessons.open });

  const nextLessons = pickNextLessons({
    count: lookahead.nextDayLessons,
    inSession: todayLessons.inSession,
    upcoming,
  }).filter((lessonId) => !todayWindow.includes(lessonId));

  const planned = [...todayWindow, ...nextLessons];
  const states = await getLessonGenerationStates(planned);

  return {
    forExam: goal.kind === "exam",
    laterLessonIds: filterUnwritten({ lessonIds: nextLessons, states }),
    lessonIds: filterUnwritten({ lessonIds: todayWindow, states }),
    personalized: planned.length > 0 && (await hasPersonalLayer(goal)),
    plannedLessonIds: planned,
  };
}

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
import { findOwnedStudySession } from "../sessions/_utils/study-session-access";
import { type LearnerLookahead, getLearnerTier, getLookahead } from "./learner-lookahead";

const OPEN_BLOCK_STATUSES = new Set<StudySessionBlock["status"]>(["active", "pending"]);

export type SessionPreparationAccess =
  | { goalId: string; sessionId: string; status: "ready"; timeZone: string; userId: string }
  /**
   * A guest gets only the lesson they reach next in this session written ahead (`lessonId`, the
   * first learn block still to do), counted as its start like opening it; nothing else.
   */
  | { lessonId: string | null; status: "guest" }
  | { status: "notFound" }
  | { status: "unauthorized" };

/**
 * Whether the signed-in learner may prepare a goal's content before today's session exists, such
 * as right after placement: the same as a session's (`SessionPreparationAccess`), a guest getting
 * only the plan's first lesson.
 */
export type GoalPreparationAccess =
  | Exclude<SessionPreparationAccess, { status: "ready" }>
  | { goalId: string; status: "ready"; timeZone: string; userId: string };

export type SessionPreparation = {
  /** The goal is an exam: its lessons always get the reasoning check, as on-demand runs do. */
  forExam: boolean;
  /**
   * Today's next lessons, the one the learner is in and the few after it, whose content isn't
   * written yet: the learner gets there within minutes, so they're written now.
   */
  lessonIds: string[];
  /**
   * The next study day's first lessons whose content isn't written yet: nobody waits on them for
   * hours, so they're written in the background at the flex tier.
   */
  laterLessonIds: string[];
  /** Every lesson of both, written or not, in plan order. */
  plannedLessonIds: string[];
  /**
   * The learner has a personal layer to write over the lessons being written (a field or a tool
   * they chose), so their preparation writes it once those lessons are done.
   */
  personalized: boolean;
};

const NOTHING_TO_PREPARE: SessionPreparation = {
  forExam: false,
  laterLessonIds: [],
  lessonIds: [],
  personalized: false,
  plannedLessonIds: [],
};

/** The lesson a session's learner reaches next: its first learn block still to do. */
function findNextLessonId(blocks: readonly StudySessionBlock[]): string | null {
  const next = blocks.find(
    (block) => block.kind === "learn" && block.lessonId && OPEN_BLOCK_STATUSES.has(block.status),
  );

  return next?.lessonId ?? null;
}

/**
 * Whether the signed-in learner may prepare this study session's content, and what preparing it
 * needs. Guests never trigger the whole preparation: only the lesson they reach next is written
 * ahead, so the day's first lesson isn't written only once they open it.
 */
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
    return { lessonId: findNextLessonId(session.blocks), status: "guest" };
  }

  if (!session.goalId) {
    return { status: "notFound" };
  }

  return {
    goalId: session.goalId,
    sessionId: session.id,
    status: "ready",
    timeZone: getAnswerTimeZone({ goal: session.goal, timeZone: null }),
    userId,
  };
}

/**
 * Whether the signed-in learner may prepare their goal's content with no session open yet (right
 * after placement, before Day 1's session is built): a guest gets only the plan's first lesson
 * written ahead, counted as its start like opening it.
 */
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
    return { lessonId: await findPlanFirstLessonId(goalId), status: "guest" };
  }

  return {
    goalId,
    status: "ready",
    timeZone: getAnswerTimeZone({ goal: owned.goal, timeZone: null }),
    userId: owned.userId,
  };
}

/** The plan's lessons scheduled for a day that are still to do, in plan order. */
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

/**
 * Today's lessons still to play, in order, and every one today holds: the session's, or, before
 * today's session is built (right after placement), the plan's lessons for today, which it's
 * built from.
 */
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

/** The plan's lessons scheduled after today that are still to do, in plan order. */
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

/**
 * The first lessons the plan has for the next study day: what the next session's learn blocks are
 * drawn from. They come from the plan rather than a session built ahead, because a session is
 * built on its own day, from that day's allowance and time limit. Lessons today's session already
 * pulled ahead (to fill its time, or "10 more minutes") don't count, so the day after them is
 * prepared.
 */
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

/** A lesson to write: one never started, or one its checks held back while it has drafts left. */
function filterUnwritten({
  lessonIds,
  states,
}: {
  lessonIds: readonly string[];
  states: Awaited<ReturnType<typeof getLessonGenerationStates>>;
}): string[] {
  return lessonIds.filter((lessonId) => {
    const state = states.get(lessonId);
    // A run that just stopped is retried when a learner opens the lesson.
    return state?.status === "notStarted" || canRedraftLesson(state);
  });
}

/**
 * Today's lessons from the one the learner is in (the first still open) to as many after it as
 * their plan writes ahead.
 */
function pickTodayWindow({
  lookahead,
  open,
}: {
  lookahead: LearnerLookahead;
  open: readonly string[];
}): string[] {
  return open.slice(0, 1 + lookahead.lessonsAhead);
}

/**
 * Whether anything personal goes over this learner's lessons: questions and challenges set in
 * their field, or hands-on screens in the tool they chose.
 */
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

/**
 * What to prepare for a learner's goal around a session, whether it's starting or just ended: the
 * lesson the learner is in and the next few of today's session, and the next study day's first
 * lessons, whose content isn't written. How many depends on the learner's plan
 * (`getLearnerTier`): Plus subscribers get more written ahead. Every block the learner opens
 * prepares again, so today's window moves with them and nobody waits on a lesson. Lessons already
 * written or being written are left out; one the checks held back is drafted again while it has
 * drafts left, before the learner gets there. Each lesson writes its chapter's specs when it's the
 * chapter's first, so specs are never written for chapters nobody reached.
 *
 * This is a workflow bridge: the ids come from `getSessionPreparationAccess`.
 */
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

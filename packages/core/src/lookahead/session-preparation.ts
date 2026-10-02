import "server-only";
import { type Goal, type StudySessionBlock, prisma } from "@zoonk/db";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { getAnswerTimeZone } from "../learner/_utils/owned-goal";
import {
  canRedraftLesson,
  getLessonGenerationStates,
} from "../library/generation/lesson-generation-state";
import { getGoalFieldInput } from "../library/items/item-field";
import { parsePlanSettings } from "../plans/planner/plan-state";
import { resolveDeeperByDefault } from "../profile/_utils/deeper-by-default";
import { findOwnedStudySession } from "../sessions/_utils/study-session-access";

/** Specs are written a chapter ahead; a chapter rarely has more lessons than this. */
const MAX_SPEC_LESSONS = 12;

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

export type SessionPreparation = {
  /** The goal is an exam: its lessons always get the reasoning check, as on-demand runs do. */
  forExam: boolean;
  /** Lessons in this session or the next whose content isn't written yet: write them now. */
  lessonIds: string[];
  /** Every lesson of this session and the next, written or not, in plan order. */
  plannedLessonIds: string[];
  /**
   * The learner has a personal layer to write over the lessons being written (a field, a tool
   * they chose or "Go deeper" first), so their preparation writes it once those lessons are done.
   */
  personalized: boolean;
  /** Lessons of the chapter after the one being studied that have no spec yet. */
  specLessonIds: string[];
  /**
   * Today's next lesson when it isn't written yet: the learner reaches it within minutes, so it's
   * written at the priority tier (about twice as fast at twice the price); the rest can wait.
   */
  urgentLessonId: string | null;
};

const NOTHING_TO_PREPARE: SessionPreparation = {
  forExam: false,
  lessonIds: [],
  personalized: false,
  plannedLessonIds: [],
  specLessonIds: [],
  urgentLessonId: null,
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

/** Today's session's lessons: the ones still to play, in session order, and every one it holds. */
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

  const learnBlocks = (session?.blocks ?? []).filter(
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
 * The lessons the plan has for the next study day: what the next session's learn blocks are drawn
 * from. They come from the plan rather than a session built ahead, because a session is built on
 * its own day, from that day's allowance and time limit. Lessons today's session already pulled
 * ahead (to fill its time, or "10 more minutes") don't count, so the day after them is prepared.
 */
function pickNextLessons({
  inSession,
  upcoming,
}: {
  inSession: ReadonlySet<string>;
  upcoming: Awaited<ReturnType<typeof loadUpcomingLessons>>;
}): string[] {
  const ahead = upcoming.filter((item) => item.lessonId && !inSession.has(item.lessonId));
  const nextDay = ahead[0]?.scheduledFor?.getTime();

  return ahead.flatMap((item) =>
    item.lessonId && item.scheduledFor?.getTime() === nextDay ? [item.lessonId] : [],
  );
}

/** Lessons of the chapter right after each chapter being studied, in course order, still unplanned. */
async function findNextChapterSpecLessons(lessonIds: readonly string[]): Promise<string[]> {
  const lessons = await prisma.lesson.findMany({
    select: {
      homeChapter: {
        select: { courses: { select: { courseId: true, level: true, position: true } } },
      },
    },
    where: { id: { in: [...lessonIds] } },
  });

  const placements = lessons.flatMap((lesson) => lesson.homeChapter?.courses ?? []);

  if (placements.length === 0) {
    return [];
  }

  const next = await prisma.courseChapter.findMany({
    select: { chapterId: true },
    where: {
      OR: placements.map((placement) => ({
        courseId: placement.courseId,
        level: placement.level,
        position: placement.position + 1,
      })),
    },
  });

  if (next.length === 0) {
    return [];
  }

  const specless = await prisma.chapterLesson.findMany({
    orderBy: { position: "asc" },
    select: { lessonId: true },
    take: MAX_SPEC_LESSONS,
    where: {
      chapterId: { in: next.map((chapter) => chapter.chapterId) },
      lesson: { specStatus: { in: ["failed", "pending"] } },
    },
  });

  return specless.map((row) => row.lessonId);
}

/**
 * Whether anything personal goes over this learner's lessons: questions and challenges set in
 * their field, hands-on screens in the tool they chose, or "Go deeper" versions opening first.
 */
async function hasPersonalLayer({ goal, userId }: { goal: Goal; userId: string }) {
  if (getGoalFieldInput(goal.details)) {
    return true;
  }

  const [plan, profile] = await Promise.all([
    prisma.plan.findUnique({ select: { settings: true }, where: { goalId: goal.id } }),
    prisma.userLearningProfile.findUnique({
      select: { deeperByDefault: true, memoryAsksDeeper: true, memoryEnabled: true },
      where: { userId },
    }),
  ]);

  return (
    parsePlanSettings(plan?.settings).tools.length > 0 ||
    resolveDeeperByDefault(profile).deeperByDefault
  );
}

/**
 * What to prepare for a learner's goal around a session, whether it's starting or just ended: the
 * rest of today's lessons and the next study day's whose content isn't written, and the specs of
 * the chapter after the one being studied. Lessons already written or being written are left out;
 * one the checks held back is drafted again while it has drafts left, before the learner gets there.
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

  const [todayLessons, upcoming] = await Promise.all([
    loadTodayLessons({ goal, today, userId }),
    loadUpcomingLessons({ goal, today }),
  ]);

  const nextLessons = pickNextLessons({ inSession: todayLessons.inSession, upcoming });
  const planned = [...new Set([...todayLessons.open, ...nextLessons])];

  const [states, nextChapterLessonIds] = await Promise.all([
    getLessonGenerationStates(planned),
    findNextChapterSpecLessons(planned),
  ]);

  const lessonIds = planned.filter((lessonId) => {
    const state = states.get(lessonId);
    // A lesson the checks held back is drafted again while it has drafts left; a run that just
    // stopped is retried when a learner opens the lesson.
    return state?.status === "notStarted" || canRedraftLesson(state);
  });

  // A lesson written now plans its own spec first: waiting on the chapter's other specs would
  // only delay it.
  const writing = new Set(lessonIds);

  return {
    forExam: goal.kind === "exam",
    lessonIds,
    personalized: planned.length > 0 && (await hasPersonalLayer({ goal, userId })),
    plannedLessonIds: planned,
    specLessonIds: nextChapterLessonIds.filter((lessonId) => !writing.has(lessonId)),
    urgentLessonId: todayLessons.open.find((lessonId) => writing.has(lessonId)) ?? null,
  };
}

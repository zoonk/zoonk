import "server-only";
import { type Goal, type StudySessionBlock, prisma } from "@zoonk/db";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { findGoalFor, findOwnedGoal, getAnswerTimeZone } from "../learner/_utils/owned-goal";
import {
  canRedraftLesson,
  getLessonGenerationStates,
} from "../library/generation/lesson-generation-state";
import { getGoalFieldInput } from "../library/items/item-field";
import { readSelectedItemFacts } from "../plans/_utils/selected-item-contract";
import { isStandIn } from "../plans/planner/plan-item-rules";
import { parsePlanSettings } from "../plans/planner/plan-state";
import {
  type StudySessionRow,
  findOwnedStudySession,
  findStudySessionFor,
} from "../sessions/_utils/study-session-access";
import { getSessionUsedMinutes } from "../sessions/session-minutes";
import { loadPlanWindowItems } from "./_utils/preparation-window";
import { loadWindowChallenges } from "./_utils/window-challenges";
import { getLearnerTier, getLookahead } from "./learner-lookahead";

const OPEN_BLOCK_STATUSES = new Set<StudySessionBlock["status"]>(["active", "pending"]);

export type SessionPreparationAccess =
  | { goalId: string; sessionId: string; status: "ready"; timeZone: string; userId: string }
  | { goalId: string; status: "guest"; timeZone: string; userId: string }
  | { status: "notFound" }
  | { status: "unauthorized" };

export type GoalPreparationAccess =
  | Exclude<SessionPreparationAccess, { status: "ready" }>
  | { goalId: string; status: "ready"; timeZone: string; userId: string };

type PreparationDates = { nextDay: number | null; today: number };

export type SessionPreparation = {
  dates: PreparationDates | null;
  guestSessionLessonId?: string;
  standInSkillIds: string[];
  forExam: boolean;
  /** Generate these immediately; the learner is only minutes away. */
  lessonIds: string[];
  /** Next-day lessons use background generation at the flex tier. */
  laterLessonIds: string[];
  /** Includes written lessons and the window's chapter challenges too. */
  plannedLessonIds: string[];
  /** Write the personal layer only after the underlying shared lessons finish. */
  personalized: boolean;
};

const NOTHING_TO_PREPARE: SessionPreparation = {
  dates: null,
  forExam: false,
  laterLessonIds: [],
  lessonIds: [],
  personalized: false,
  plannedLessonIds: [],
  standInSkillIds: [],
};

async function isGuest(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    select: { isAnonymous: true },
    where: { id: userId },
  });

  return user?.isAnonymous === true;
}

async function decideSessionAccess({
  session,
  userId,
}: {
  session: StudySessionRow;
  userId: string;
}): Promise<SessionPreparationAccess> {
  if (!session.goalId || !session.goal) {
    return { status: "notFound" };
  }

  const common = {
    goalId: session.goalId,
    timeZone: getAnswerTimeZone({ goal: session.goal, timeZone: null }),
    userId,
  };

  return (await isGuest(userId))
    ? { ...common, status: "guest" }
    : { ...common, sessionId: session.id, status: "ready" };
}

export async function getSessionPreparationAccess({
  sessionId,
}: {
  sessionId: string;
}): Promise<SessionPreparationAccess> {
  const owned = await findOwnedStudySession(sessionId);
  return owned.status === "ready" ? decideSessionAccess(owned) : owned;
}

/** Internal, for preparation runs: `userId` must come from the learner's own write. */
export async function getSessionPreparationAccessFor({
  sessionId,
  userId,
}: {
  sessionId: string;
  userId: string;
}): Promise<SessionPreparationAccess> {
  const owned = await findStudySessionFor({ sessionId, userId });
  return owned.status === "ready" ? decideSessionAccess(owned) : owned;
}

async function decideGoalAccess({
  goal,
  userId,
}: {
  goal: Goal;
  userId: string;
}): Promise<GoalPreparationAccess> {
  return {
    goalId: goal.id,
    status: (await isGuest(userId)) ? "guest" : "ready",
    timeZone: getAnswerTimeZone({ goal, timeZone: null }),
    userId,
  };
}

export async function getGoalPreparationAccess({
  goalId,
}: {
  goalId: string;
}): Promise<GoalPreparationAccess> {
  const owned = await findOwnedGoal(goalId);
  return owned.status === "ready" ? decideGoalAccess(owned) : owned;
}

/** Internal, for preparation runs: `userId` must come from the learner's own write. */
export async function getGoalPreparationAccessFor({
  goalId,
  userId,
}: {
  goalId: string;
  userId: string;
}): Promise<GoalPreparationAccess> {
  const owned = await findGoalFor({ goalId, userId });
  return owned.status === "ready" ? decideGoalAccess(owned) : owned;
}

type WindowItem = Awaited<ReturnType<typeof loadPlanWindowItems>>[number];

function readStudyDates(item: WindowItem): number[] {
  if (isStandIn(item)) {
    const days = readSelectedItemFacts(item.facts)?.days;

    if (days) {
      return days.flatMap(([day, , minutes]) => (minutes > 0 ? [Date.parse(day)] : []));
    }
  }

  return item.scheduledFor ? [item.scheduledFor.getTime()] : [];
}

function loadWindowSession({
  goalId,
  sessionId,
  today,
  userId,
}: {
  goalId: string;
  sessionId?: string;
  today: Date;
  userId: string;
}) {
  return prisma.studySession.findUnique({
    include: { blocks: { orderBy: { position: "asc" } } },
    where: sessionId
      ? { goalId, id: sessionId, userId }
      : { userGoalDate: { goalId, localDate: today, userId } },
  });
}

type WindowTarget = { lessonId: string | null; skillId: string | null };

function listTodayTargets({
  guest,
  planned,
  session,
  today,
}: {
  guest: boolean;
  planned: readonly (WindowItem & { dates: number[] })[];
  session: Awaited<ReturnType<typeof loadWindowSession>>;
  today: number;
}): { inSession: Set<string>; open: WindowTarget[] } {
  if (guest && !session) {
    const first = planned.find((item) => item.kind === "lesson");
    return { inSession: new Set(), open: first ? [first] : [] };
  }

  const due = planned.filter(
    (item) =>
      item.dates.includes(today) ||
      (isStandIn(item) && item.scheduledFor !== null && item.scheduledFor.getTime() < today),
  );

  if (!session) {
    return { inSession: new Set(), open: due };
  }

  const learn = session.blocks.filter((block) => block.kind === "learn" && block.lessonId);
  const inSession = new Set(learn.flatMap((block) => block.lessonId ?? []));

  const open = learn
    .filter((block) => (guest ? block.status === "pending" : OPEN_BLOCK_STATUSES.has(block.status)))
    .map((block) => ({ lessonId: block.lessonId, skillId: null }));

  const room = session.plannedMinutes - getSessionUsedMinutes(session.blocks);

  const remaining =
    session.status !== "completed" && room >= 1
      ? due.filter((item) => !item.lessonId || !inSession.has(item.lessonId))
      : [];

  return { inSession, open: [...open, ...remaining] };
}

function getWritableWindow(items: readonly WindowTarget[]): string[] {
  const firstStandIn = items.findIndex((item) => item.lessonId === null);
  const reached = firstStandIn === -1 ? items : items.slice(0, firstStandIn);
  return reached.flatMap((item) => item.lessonId ?? []);
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
    return canRedraftLesson(state);
  });
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

/** Workflow bridge: ids must come from preparation access. */
export async function listSessionPreparation({
  dates,
  goalId,
  guestSessionId,
  timeZone,
  userId,
}: {
  dates?: PreparationDates | null;
  goalId: string;
  guestSessionId?: string;
  timeZone: string;
  userId: string;
}): Promise<SessionPreparation> {
  const [goal, tier] = await Promise.all([
    prisma.goal.findUnique({ where: { id: goalId, userId } }),
    getLearnerTier(userId),
  ]);

  const today = getDateInTimeZone({ date: new Date(), timeZone });

  if (!goal || goal.status !== "active" || (dates && dates.today !== today.getTime())) {
    return NOTHING_TO_PREPARE;
  }

  const guest = tier === "guest";
  const forGuestGoal = guest && !guestSessionId;

  const [items, session] = await Promise.all([
    loadPlanWindowItems({ goalId, includeUnscheduledLessons: forGuestGoal }),
    forGuestGoal ? null : loadWindowSession({ goalId, sessionId: guestSessionId, today, userId }),
  ]);

  if (guestSessionId && !session) {
    return NOTHING_TO_PREPARE;
  }

  const lookahead = getLookahead(tier);
  const planned = items.map((item) => ({ ...item, dates: readStudyDates(item) }));

  const { inSession, open } = listTodayTargets({ guest, planned, session, today: today.getTime() });
  const todayTargets = open.slice(0, guest ? 1 : 1 + lookahead.lessonsAhead);
  const todayWindow = getWritableWindow(todayTargets);
  const guestSessionLessonId = guest ? todayWindow.find((id) => inSession.has(id)) : undefined;

  const upcoming = planned.filter((item) => !item.lessonId || !inSession.has(item.lessonId));

  const futureDates = upcoming.flatMap((item) =>
    item.dates.filter((date) => date > today.getTime()),
  );

  const nextDay = dates ? dates.nextDay : (futureDates.toSorted((a, b) => a - b)[0] ?? null);

  const nextTargets = upcoming
    .filter((item) => nextDay !== null && item.dates.includes(nextDay))
    .slice(0, lookahead.nextDayLessons);

  const nextLessons =
    guest && todayTargets.some((item) => !item.lessonId)
      ? []
      : getWritableWindow(nextTargets).filter((id) => !todayWindow.includes(id));

  const standInSkillIds = [
    ...new Set(
      [...todayTargets, ...nextTargets].flatMap((item) =>
        !item.lessonId && item.skillId ? [item.skillId] : [],
      ),
    ),
  ];

  const challenges = guest
    ? []
    : await loadWindowChallenges({ goalId, lessonIds: [...todayWindow, ...nextLessons], userId });

  const soon = [...new Set([...todayWindow, ...challenges])];
  const later = nextLessons.filter((lessonId) => !soon.includes(lessonId));
  const plannedLessonIds = [...soon, ...later];
  const states = await getLessonGenerationStates(plannedLessonIds);

  // The request for a queued lesson can also recover an abandoned generation run.
  const lessonIds = guestSessionLessonId
    ? [guestSessionLessonId]
    : filterUnwritten({ lessonIds: soon, states });

  return {
    dates: { nextDay, today: today.getTime() },
    forExam: goal.kind === "exam",
    ...(guestSessionLessonId ? { guestSessionLessonId } : {}),
    laterLessonIds: filterUnwritten({ lessonIds: later, states }),
    lessonIds,
    personalized: !guest && plannedLessonIds.length > 0 && (await hasPersonalLayer(goal)),
    plannedLessonIds,
    standInSkillIds,
  };
}

import "server-only";
import { type Goal, prisma } from "@zoonk/db";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { findActiveGoalId } from "../goals/_utils/goal-view";
import { findOwnedGoal, getAnswerTimeZone } from "../learner/_utils/owned-goal";
import { getSession } from "../users/get-session";
import { findCarriedOverSession } from "./_utils/current-session";
import { loadStudySessionView } from "./_utils/load-session-view";
import { refreshDayFromPlan } from "./_utils/refresh-day-session";
import { type StudySessionRow } from "./_utils/study-session-access";
import { type TodayStudySessionInput } from "./contract";
import { ensureStudySession } from "./ensure-study-session";
import { type StudySessionResult } from "./get-study-session";

type TodayStudySessionResult = StudySessionResult | { status: "goalNotActive" };

/** Whether the learner already started the new day's session (on another screen or device). */
async function hasStartedDay({
  goalId,
  localDate,
  userId,
}: {
  goalId: string;
  localDate: Date;
  userId: string;
}) {
  const started = await prisma.studySession.findFirst({
    select: { id: true },
    where: { goalId, localDate, startedAt: { not: null }, userId },
  });

  return started !== null;
}

/**
 * The learner's day for the goal: the session they're still in from before midnight, unless they
 * already started the new day's, else today's, built the first time it's opened and brought up to
 * date with the plan without moving what the learner was shown.
 */
async function resolveTodaySession({
  goal,
  timeZone,
  userId,
}: {
  goal: Goal;
  timeZone: string;
  userId: string;
}): Promise<StudySessionRow> {
  const now = new Date();
  const localDate = getDateInTimeZone({ date: now, timeZone });
  const carried = await findCarriedOverSession({ goalId: goal.id, now, timeZone, userId });

  if (carried && !(await hasStartedDay({ goalId: goal.id, localDate, userId }))) {
    return carried;
  }

  const today = await ensureStudySession({ goal, localDate, timeZone, userId });

  return refreshDayFromPlan({ session: today, timeZone });
}

/**
 * Today's session for a goal (the active goal by default), built the first time it's opened on
 * the learner's local day: capsules first, the new lesson and practice in the middle, a
 * checkpoint when one is due, fitted to the goal's daily minutes. Opening it again the same day
 * returns the same session with its progress, and a session the learner is in when midnight comes
 * stays theirs until they finish it or have been away for a while.
 */
export async function getTodayStudySession(
  input: TodayStudySessionInput,
): Promise<TodayStudySessionResult> {
  const session = await getSession();

  if (!session) {
    return { status: "unauthorized" };
  }

  const goalId = input.goalId ?? (await findActiveGoalId(session.user.id));

  if (!goalId) {
    return { status: "notFound" };
  }

  const owned = await findOwnedGoal(goalId);

  if (owned.status !== "ready") {
    return owned;
  }

  // A paused, completed or archived goal has no day to plan: nothing is built for it.
  if (owned.goal.status !== "active") {
    return { status: "goalNotActive" };
  }

  const timeZone = getAnswerTimeZone({ goal: owned.goal, timeZone: input.timeZone });

  const studySession = await resolveTodaySession({
    goal: owned.goal,
    timeZone,
    userId: owned.userId,
  });

  return {
    session: await loadStudySessionView({ session: studySession, timeZone, userId: owned.userId }),
    status: "ready",
  };
}

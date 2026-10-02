import "server-only";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { findActiveGoalId } from "../goals/_utils/goal-view";
import { findOwnedGoal, getAnswerTimeZone } from "../learner/_utils/owned-goal";
import { getSession } from "../users/get-session";
import { loadStudySessionView } from "./_utils/load-session-view";
import { type TodayStudySessionInput } from "./contract";
import { ensureStudySession } from "./ensure-study-session";
import { type StudySessionResult } from "./get-study-session";

type TodayStudySessionResult = StudySessionResult | { status: "goalNotActive" };

/**
 * Today's session for a goal (the active goal by default), built the first time it's opened on
 * the learner's local day: capsules first, the new lesson and practice in the middle, a
 * checkpoint when one is due, fitted to the goal's daily minutes. Opening it again the same day
 * returns the same session with its progress.
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

  const studySession = await ensureStudySession({
    goal: owned.goal,
    localDate: getDateInTimeZone({ date: new Date(), timeZone }),
    timeZone,
    userId: owned.userId,
  });

  return {
    session: await loadStudySessionView({ session: studySession, timeZone, userId: owned.userId }),
    status: "ready",
  };
}

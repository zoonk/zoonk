import "server-only";
import { prisma } from "@zoonk/db";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { getAnswerTimeZone } from "../learner/_utils/owned-goal";
import { getSession } from "../users/get-session";
import { isCurrentSession } from "./_utils/current-session";
import { persistEntitlementLapseRefill } from "./_utils/entitlement-lapse-refill";
import { loadStudySessionView } from "./_utils/load-session-view";
import { findOpenDayTarget } from "./_utils/open-day-target";
import { loadOpenedDayView } from "./_utils/open-day-view";
import { followOpenDayZone } from "./_utils/open-day-zone";
import { openPlannedDay } from "./_utils/open-planned-day";
import { appendLandedLessons } from "./_utils/refresh-day-session";
import { findOwnedStudySession } from "./_utils/study-session-access";
import { type StudySessionTimeZoneInput } from "./contract";
import { type StudySessionResult } from "./get-study-session";
import { type OpenStudyDayInput, type OpenStudyDayResult } from "./open-day-contract";

/** The explicit learner POST owns persistence; renders and prefetches only select in memory. */
export async function openStudyDay(input: OpenStudyDayInput): Promise<OpenStudyDayResult> {
  const actor = await getSession();

  if (!actor) {
    return { status: "unauthorized" };
  }

  const userId = actor.user.id;
  const goal = await prisma.goal.findFirst({ where: { id: input.goalId, userId } });

  if (!goal) {
    return { status: "notFound" };
  }

  if (goal.status !== "active") {
    return { status: "goalNotActive" };
  }

  const followed = await followOpenDayZone({ goal, timeZone: input.timeZone, userId });
  const currentGoal = followed.status === "ready" ? followed.goal : goal;

  if (currentGoal.status !== "active") {
    return { status: "goalNotActive" };
  }

  const now = new Date();
  const timeZone = getAnswerTimeZone({ goal: currentGoal, timeZone: input.timeZone });
  const localDate = getDateInTimeZone({ date: now, timeZone });

  const opened =
    followed.status === "retryable"
      ? { status: "stale" as const }
      : await openPlannedDay({
          goal: currentGoal,
          keepEmpty: input.keepEmpty,
          localDate,
          now,
          timeZone,
          userId,
        });

  const session =
    opened.status === "opened"
      ? await loadOpenedDayView({
          initialDay: opened.initialDay,
          session: opened.session,
          timeZone,
          userId,
        })
      : null;

  const binding = { goalId: goal.id, localDate };

  if (opened.status !== "opened" || !session) {
    return opened.status === "preparing"
      ? { status: "preparing" }
      : { ...binding, status: opened.status === "empty" ? "empty" : "retryable" };
  }

  return {
    ...binding,
    ...findOpenDayTarget({ session, shownDate: input.shownDate, target: input.target }),
    created: opened.created,
    localDate: session.localDate,
    session,
    sessionId: session.id,
    status: "opened",
  };
}

/** The palette's Continue is an explicit POST too; read-only session lookup never fills a queue. */
export async function openStudySession({
  input,
  sessionId,
}: {
  input: StudySessionTimeZoneInput;
  sessionId: string;
}): Promise<StudySessionResult | { status: "goalNotActive" | "retryable" }> {
  const owned = await findOwnedStudySession(sessionId);

  if (owned.status !== "ready") {
    return owned;
  }

  const { session, userId } = owned;
  const timeZone = getAnswerTimeZone({ goal: session.goal, timeZone: input.timeZone });

  if (!isCurrentSession({ now: new Date(), session, timeZone }) || !session.goal) {
    return { session: await loadStudySessionView({ session, timeZone, userId }), status: "ready" };
  }

  if (session.goal.status !== "active") {
    return { status: "goalNotActive" };
  }

  const refilled = await persistEntitlementLapseRefill({ goal: session.goal, session, timeZone });

  if (!refilled) {
    return { status: "retryable" };
  }

  const current = await appendLandedLessons({ goal: session.goal, session: refilled, timeZone });

  return {
    session: await loadOpenedDayView({ session: current, timeZone, userId }),
    status: "ready",
  };
}

import "server-only";
import { prisma } from "@zoonk/db";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { findCarriedOverSession } from "./current-session";
import { STUDY_SESSION_INCLUDE, type StudySessionRow } from "./study-session-access";

/**
 * The goal's day as Today opens it, without building it: the session from before midnight the
 * learner is still in, unless they already started the new day's (see `resolveTodaySession`), else
 * today's saved one; null while the day isn't built yet. A read: it never creates, refreshes or
 * settles anything.
 */
export async function findSavedDaySession({
  goalId,
  now,
  timeZone,
  userId,
}: {
  goalId: string;
  now: Date;
  timeZone: string;
  userId: string;
}): Promise<StudySessionRow | null> {
  const localDate = getDateInTimeZone({ date: now, timeZone });

  const [today, carried] = await Promise.all([
    prisma.studySession.findUnique({
      include: STUDY_SESSION_INCLUDE,
      where: { userGoalDate: { goalId, localDate, userId } },
    }),
    findCarriedOverSession({ goalId, now, timeZone, userId }),
  ]);

  return carried && !today?.startedAt ? carried : today;
}

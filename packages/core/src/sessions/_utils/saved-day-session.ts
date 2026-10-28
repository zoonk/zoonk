import "server-only";
import { prisma } from "@zoonk/db";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { findCarriedOverSession } from "./current-session";
import { STUDY_SESSION_INCLUDE, type StudySessionRow } from "./study-session-access";

/** Read-only; returns an unfinished pre-midnight session unless the learner already started today's, or null when unbuilt. */
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

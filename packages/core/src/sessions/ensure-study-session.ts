import "server-only";
import { type Goal } from "@zoonk/db";
import { PlanConflictError } from "../plans/_utils/write-plan";
import { openPlannedDay } from "./_utils/open-planned-day";
import { type StudySessionRow } from "./_utils/study-session-access";

/** Internal POST-only entry: the same selected plan and atomic writer as the explicit day open. */
export async function ensureStudySession(day: {
  goal: Goal;
  localDate: Date;
  timeZone: string;
  userId: string;
}): Promise<StudySessionRow> {
  const result = await openPlannedDay({ ...day, keepEmpty: true, now: new Date() });

  if (result.status === "opened") {
    return result.session;
  }

  if (result.status === "stale") {
    throw new PlanConflictError();
  }

  throw new Error(`The plan of goal ${day.goal.id} is not ready to open.`);
}

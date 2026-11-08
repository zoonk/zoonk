import "server-only";
import { getAnswerTimeZone } from "../learner/_utils/owned-goal";
import { isCurrentSession } from "./_utils/current-session";
import { followSavedDay } from "./_utils/refresh-study-day-selection";
import { findStudySessionFor } from "./_utils/study-session-access";

/** Internal workflow entry; the owed write supplies its learner and session. */
export async function refreshOwedStudyDay({
  sessionId,
  timeZone,
  userId,
}: {
  sessionId: string;
  timeZone: string;
  userId: string;
}): Promise<void> {
  const owned = await findStudySessionFor({ sessionId, userId });

  if (owned.status !== "ready" || !owned.session.goal || owned.session.goal.status !== "active") {
    return;
  }

  const zone = getAnswerTimeZone({ goal: owned.session.goal, timeZone });

  if (!isCurrentSession({ now: new Date(), session: owned.session, timeZone: zone })) {
    return;
  }

  await followSavedDay({ session: owned.session, timeZone: zone });
}

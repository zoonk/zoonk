import "server-only";
import { getAnswerTimeZone } from "../learner/_utils/owned-goal";
import { loadStudySessionView } from "./_utils/load-session-view";
import { type StudySessionView } from "./_utils/session-view";
import { findOwnedStudySession } from "./_utils/study-session-access";
import { type StudySessionTimeZoneInput } from "./contract";

export type StudySessionResult =
  | { session: StudySessionView; status: "ready" }
  | { status: "notFound" }
  | { status: "unauthorized" };

/** One of the learner's study sessions with its blocks, missions and progress. */
export async function getStudySession({
  input,
  sessionId,
}: {
  input: StudySessionTimeZoneInput;
  sessionId: string;
}): Promise<StudySessionResult> {
  const owned = await findOwnedStudySession(sessionId);

  if (owned.status !== "ready") {
    return owned;
  }

  return {
    session: await loadStudySessionView({
      session: owned.session,
      timeZone: getAnswerTimeZone({ goal: owned.session.goal, timeZone: input.timeZone }),
      userId: owned.userId,
    }),
    status: "ready",
  };
}

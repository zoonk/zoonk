import { STUDY_SESSION_PARAM } from "@/lib/lessons/lesson-player-params";

/**
 * Where a checkpoint or a mock continues once it's done. The session navigation opens them with
 * `?session=`, as it opens lessons: from their session, they continue back to it, which opens the
 * next block or the day's summary; opened any other way (the exam page, a shared link), to Today.
 */
export function getSessionBlockReturn({
  query,
  sessionId,
}: {
  query: Record<string, string | string[] | undefined>;
  sessionId: string;
}) {
  const fromSession = query[STUDY_SESSION_PARAM] === sessionId;

  return {
    continueHref: fromSession ? "/session" : "/today",
    /** Kept when the screen hands over to another, such as a checkpoint to its mock. */
    search: fromSession ? `?${STUDY_SESSION_PARAM}=${sessionId}` : "",
  };
}

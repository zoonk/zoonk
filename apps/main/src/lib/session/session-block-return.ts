import { STUDY_SESSION_PARAM } from "@/lib/lessons/lesson-player-params";

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

import "server-only";
import { getStudySession } from "@zoonk/core/sessions/get";
import { type StudySession } from "@zoonk/learn/session/types";

/** What the lesson player shows of the session it's a block of: the bar and what's done so far. */
export type LessonSessionContext = {
  id: string;
  missions: StudySession["missions"];
  sessionBar: StudySession["sessionBar"];
};

/**
 * The session a lesson was opened from (`?session=`), when it's the learner's own. Null
 * otherwise, and the lesson then plays on its own.
 */
export async function getLessonSessionContext(
  sessionId: string | null,
): Promise<LessonSessionContext | null> {
  if (!sessionId) {
    return null;
  }

  const result = await getStudySession({ input: {}, sessionId });

  if (result.status !== "ready") {
    return null;
  }

  const { session } = result;

  return { id: session.id, missions: session.missions, sessionBar: session.sessionBar };
}

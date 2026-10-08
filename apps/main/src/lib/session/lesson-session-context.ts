import "server-only";
import { getStudySession } from "@zoonk/core/sessions/get";
import { type StudySession } from "@zoonk/learn/session/types";
import { connection } from "next/server";

/**
 * What the lesson player shows of the session it's a block of, in the lesson's completion moment:
 * the blocks (the next one is named), the missions done so far, and its goal, whose chapter tests
 * the moment can open.
 */
export type LessonSessionContext = Pick<StudySession, "blocks" | "goalId" | "id" | "missions">;

/**
 * The session a lesson was opened from (`?session=`), when it's the learner's own. Null
 * otherwise, and the lesson then plays on its own. A session block is opened by its action, never
 * from a prefetch, and the session's state is live (where the day stands right now), so it's read
 * at request time; a lesson outside a session stays prefetchable.
 */
export async function getLessonSessionContext(
  sessionId: string | null,
): Promise<LessonSessionContext | null> {
  if (!sessionId) {
    return null;
  }

  await connection();

  const result = await getStudySession({ input: {}, sessionId });

  if (result.status !== "ready") {
    return null;
  }

  const { session } = result;

  return {
    blocks: session.blocks,
    goalId: session.goalId,
    id: session.id,
    missions: session.missions,
  };
}

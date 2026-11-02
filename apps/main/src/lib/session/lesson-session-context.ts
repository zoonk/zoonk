import "server-only";
import { getStudySession } from "@zoonk/core/sessions/get";
import { type StudySession } from "@zoonk/learn/session/types";
import { connection } from "next/server";

export type LessonSessionContext = Pick<StudySession, "blocks" | "goalId" | "id">;

/**
 * A session block is opened by its action, never from a prefetch, and the session's state is live,
 * so it's read at request time; a lesson outside a session stays prefetchable.
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

  return { blocks: session.blocks, goalId: session.goalId, id: session.id };
}

import "server-only";
import { isUuid } from "@zoonk/utils/uuid";
import { getSession } from "../users/get-session";
import { loadLessonSupport } from "./_utils/lesson-support";
import { type LessonSupport } from "./contract";

/**
 * How a lesson opens for the learner or guest in the session (`LessonSupport`), read with the
 * page so the first screens are in the right order before the run starts. The lesson's content is
 * shared by everyone, so this per-learner order travels next to it. Null without a session or for
 * a lesson without skills: the lesson plays in its own order.
 */
export async function getLessonSupport({
  lessonId,
}: {
  lessonId: string;
}): Promise<LessonSupport | null> {
  if (!isUuid(lessonId)) {
    return null;
  }

  const session = await getSession();

  if (!session) {
    return null;
  }

  return loadLessonSupport({ lessonId: lessonId.toLowerCase(), userId: session.user.id });
}

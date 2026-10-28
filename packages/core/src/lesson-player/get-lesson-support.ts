import "server-only";
import { isUuid } from "@zoonk/utils/uuid";
import { readLessonProgressRuns } from "../learner/facts/lesson-progress-runs";
import { getSession } from "../users/get-session";
import { getRunLessonSupport, loadLessonSupport } from "./_utils/lesson-support";
import { type LessonSupport } from "./contract";

/** Null without a session or lesson skills; keep this learner-specific order separate from shared content. */
export async function getLessonSupport({
  lessonId,
}: {
  lessonId: string;
}): Promise<LessonSupport | null> {
  "use cache: private";

  if (!isUuid(lessonId)) {
    return null;
  }

  const session = await getSession();

  if (!session) {
    return null;
  }

  const id = lessonId.toLowerCase();
  const userId = session.user.id;
  const [first] = await readLessonProgressRuns(userId, id);
  const support = first ? getRunLessonSupport(first) : null;

  return support ?? loadLessonSupport({ lessonId: id, userId });
}

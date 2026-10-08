import "server-only";
import { isUuid } from "@zoonk/utils/uuid";
import { getSession } from "../users/get-session";
import { loadProgressAnswers, loadProgressRuns } from "./_utils/lesson-runs";
import { type LibraryLessonRun } from "./contract";

/**
 * The learner's answers in a lesson they left unfinished in the last week, read with the page so
 * the lesson opens where they left off before its run starts (the start returns the same answers).
 * Empty without a session or an unfinished lesson. Private cached, so a prefetched lesson opens
 * where the learner left off; an answer given after the prefetch still counts, since the run's
 * start returns the open run's answers and the player continues from them.
 */
export async function getLessonProgress({
  lessonId,
}: {
  lessonId: string;
}): Promise<LibraryLessonRun["answers"]> {
  "use cache: private";

  if (!isUuid(lessonId)) {
    return [];
  }

  const session = await getSession();

  if (!session) {
    return [];
  }

  const userId = session.user.id;
  const id = lessonId.toLowerCase();
  const [first] = await loadProgressRuns({ lessonId: id, until: new Date(), userId });

  return first ? loadProgressAnswers({ lessonId: id, since: first.startedAt, userId }) : [];
}

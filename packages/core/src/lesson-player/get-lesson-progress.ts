import "server-only";
import { isUuid } from "@zoonk/utils/uuid";
import { readLessonProgressRuns } from "../learner/facts/lesson-progress-runs";
import { getSession } from "../users/get-session";
import { loadProgressAnswers } from "./_utils/lesson-runs";
import { type LibraryLessonRun } from "./contract";

/** Empty without an unfinished lesson or session; start returns fresh answers to supersede a stale prefetch. */
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
  const [first] = await readLessonProgressRuns(userId, id);

  return first ? loadProgressAnswers({ lessonId: id, since: first.startedAt, userId }) : [];
}

/** Whether a lesson's public page offers "Continue the lesson": an unfinished sitting with an answer. */
export async function hasStartedLesson({ lessonId }: { lessonId: string }): Promise<boolean> {
  const answers = await getLessonProgress({ lessonId });
  return answers.length > 0;
}

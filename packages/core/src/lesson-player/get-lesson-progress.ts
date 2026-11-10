import "server-only";
import { isUuid } from "@zoonk/utils/uuid";
import { readLessonProgressRuns } from "../learner/facts/lesson-progress-runs";
import { getSession } from "../users/get-session";
import { type ProgressAttempt, loadProgressAnswers } from "./_utils/lesson-runs";
import { restoreRunAnswers } from "./_utils/restore-run-answers";
import { type LibraryLessonRun } from "./contract";
import { getPlayableLibraryLesson } from "./get-playable-library-lesson";

async function readProgressAttempts({
  lessonId,
  userId,
}: {
  lessonId: string;
  userId: string;
}): Promise<ProgressAttempt[]> {
  const id = lessonId.toLowerCase();
  const [first] = await readLessonProgressRuns(userId, id);
  return first ? loadProgressAnswers({ lessonId: id, since: first.startedAt, userId }) : [];
}

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

  const [attempts, played] = await Promise.all([
    readProgressAttempts({ lessonId, userId }),
    getPlayableLibraryLesson({ lessonId }),
  ]);

  const lesson = played?.status === "ready" ? played.lesson : null;
  return restoreRunAnswers({ attempts, lesson, userId });
}

/** Whether a lesson's public page offers "Continue the lesson": an unfinished sitting with an answer. */
export async function hasStartedLesson({ lessonId }: { lessonId: string }): Promise<boolean> {
  if (!isUuid(lessonId)) {
    return false;
  }

  const session = await getSession();
  const attempts = session ? await readProgressAttempts({ lessonId, userId: session.user.id }) : [];
  return attempts.length > 0;
}

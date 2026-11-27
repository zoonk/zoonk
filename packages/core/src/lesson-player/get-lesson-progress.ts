import "server-only";
import { isUuid } from "@zoonk/utils/uuid";
import { readLessonProgressRuns } from "../learner/facts/lesson-progress-runs";
import { readSavedLessonIds } from "../learner/facts/saved-lessons";
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

export async function getLessonVisit({
  lessonId,
}: {
  lessonId: string;
}): Promise<{ resume: LibraryLessonRun["answers"]; saved: boolean }> {
  "use cache: private";

  const session = isUuid(lessonId) ? await getSession() : null;

  if (!session) {
    return { resume: [], saved: false };
  }

  const userId = session.user.id;

  const [attempts, played, saved] = await Promise.all([
    readProgressAttempts({ lessonId, userId }),
    getPlayableLibraryLesson({ lessonId }),
    readSavedLessonIds(userId),
  ]);

  const lesson = played?.status === "ready" ? played.lesson : null;
  const resume = await restoreRunAnswers({ attempts, lesson, userId });
  return { resume, saved: saved.has(lessonId.toLowerCase()) };
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

import "server-only";
import { cacheTag } from "next/cache";
import { getUserProgressCacheTag } from "../../cache/tags";
import { findLastLessonFinish, loadProgressRuns } from "../../lesson-player/_utils/lesson-runs";
import { getRequestInstant } from "./request-instant";

export async function readLastLessonFinish(userId: string, lessonId: string) {
  "use cache: private";

  cacheTag(getUserProgressCacheTag(userId));

  return findLastLessonFinish({ lessonId, userId });
}

export async function readLessonProgressRuns(userId: string, lessonId: string) {
  "use cache: private";

  cacheTag(getUserProgressCacheTag(userId));

  const [finishedAt, until] = await Promise.all([
    readLastLessonFinish(userId, lessonId),
    getRequestInstant(),
  ]);

  return loadProgressRuns({ finishedAt, lessonId, until, userId });
}

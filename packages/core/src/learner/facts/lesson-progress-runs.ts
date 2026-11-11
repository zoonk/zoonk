import "server-only";
import { cacheTag } from "next/cache";
import { getUserProgressCacheTag } from "../../cache/tags";
import { loadProgressRuns } from "../../lesson-player/_utils/lesson-runs";
import { getRequestInstant } from "./request-instant";

export async function readLessonProgressRuns(userId: string, lessonId: string) {
  "use cache: private";

  cacheTag(getUserProgressCacheTag(userId));

  return loadProgressRuns({ lessonId, until: await getRequestInstant(), userId });
}

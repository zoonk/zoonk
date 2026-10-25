import "server-only";
import { cacheLife } from "next/cache";
import { loadProgressRuns } from "../../lesson-player/_utils/lesson-runs";
import { getRequestInstant } from "./request-instant";

/** The page's opening order and answers use the same unfinished sittings at one request instant. */
export async function readLessonProgressRuns(userId: string, lessonId: string) {
  "use cache: private";

  cacheLife({ stale: Infinity });
  return loadProgressRuns({ lessonId, until: await getRequestInstant(), userId });
}

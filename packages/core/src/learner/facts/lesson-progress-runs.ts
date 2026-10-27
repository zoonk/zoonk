import "server-only";
import { loadProgressRuns } from "../../lesson-player/_utils/lesson-runs";
import { getRequestInstant } from "./request-instant";

/** The page's opening order and answers use the same unfinished sittings at one request instant. */
export async function readLessonProgressRuns(userId: string, lessonId: string) {
  "use cache: private";

  return loadProgressRuns({ lessonId, until: await getRequestInstant(), userId });
}

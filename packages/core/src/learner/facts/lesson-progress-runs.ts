import "server-only";
import { loadProgressRuns } from "../../lesson-player/_utils/lesson-runs";
import { getRequestInstant } from "./request-instant";

export async function readLessonProgressRuns(userId: string, lessonId: string) {
  "use cache: private";

  return loadProgressRuns({ lessonId, until: await getRequestInstant(), userId });
}

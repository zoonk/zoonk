import "server-only";
import { postAsLearner } from "@/lib/api/learner-api";
import { after } from "next/server";

/** Only POSTs start it, never a page view, so crawlers can't. The next block the learner opens prepares again. */
export function prepareStudySession(sessionId: string): void {
  after(async () => {
    await postAsLearner({
      path: `/v1/study-sessions/${encodeURIComponent(sessionId)}/preparations`,
    });
  });
}

/** Opening the lesson asks again with its own wait and retry, so a failure here is only logged. */
export function writeLessonAhead(lessonId: string): void {
  after(async () => {
    await postAsLearner({
      path: `/v1/library/lessons/${encodeURIComponent(lessonId)}/generations`,
    });
  });
}

export function prepareGoalLessons(goalId: string): void {
  after(async () => {
    await postAsLearner({ path: `/v1/goals/${encodeURIComponent(goalId)}/lesson-preparations` });
  });
}

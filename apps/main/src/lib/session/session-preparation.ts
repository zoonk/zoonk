import "server-only";
import { postAsLearner } from "@/lib/api/learner-api";
import { after } from "next/server";

/**
 * Starts getting the learner's next lessons written after the response is sent, the way the API's
 * session routes do: every block they open and every session that ends or stops prepares the rest
 * of today's session and the next study day. Only these requests start it, never a page view, so
 * crawlers can't. A failure is logged; the next block the learner opens prepares again.
 */
export function prepareStudySession(sessionId: string): void {
  after(async () => {
    await postAsLearner({
      path: `/v1/study-sessions/${encodeURIComponent(sessionId)}/preparations`,
    });
  });
}

/**
 * Starts writing a lesson the learner opens within minutes, after the response is sent (it counts
 * as its start, like opening it), at the priority tier. Opening it asks again, with its own wait
 * and retry, so a failure here is only logged by the API call.
 */
export function writeLessonAhead(lessonId: string): void {
  after(async () => {
    await postAsLearner({
      path: `/v1/library/lessons/${encodeURIComponent(lessonId)}/generations`,
    });
  });
}

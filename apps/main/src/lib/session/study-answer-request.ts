import { postToApp } from "@/lib/http/post-to-app";
import { type StudyAnswerOutcome, type StudyQuestionAnswer } from "@zoonk/learn/session/types";
import { getLocalTimeZone } from "@zoonk/utils/time-zone";

/**
 * Sends one answer to a session question to the app's answer route, in the learner's timezone. A
 * request that didn't get through is a failure the screen offers to send again.
 */
export async function sendStudyAnswer({
  blockId,
  sessionId,
  ...answer
}: {
  answer: StudyQuestionAnswer;
  blockId: string;
  durationMs: number;
  itemId: string;
  sessionId: string;
}): Promise<StudyAnswerOutcome> {
  const outcome = await postToApp<StudyAnswerOutcome>({
    body: { ...answer, timeZone: getLocalTimeZone() },
    path: `/api/study-sessions/${encodeURIComponent(sessionId)}/blocks/${encodeURIComponent(blockId)}/answers`,
  });

  return outcome ?? { status: "failed" };
}

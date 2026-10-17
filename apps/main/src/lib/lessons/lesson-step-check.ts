import { postToApp } from "@/lib/http/post-to-app";
import { type LessonStepAnswer } from "@zoonk/core/lesson-player/contract";
import { type LessonCheckOutcome } from "@zoonk/player/lesson/types";
import { getLocalTimeZone } from "@zoonk/utils/time-zone";

/**
 * The web player's `checkStep` adapter: one answer to the app's check route, which saves it (and
 * grades a typed one) without queuing behind the lesson's other requests. One that didn't get
 * through is a failure the player sends again, with the same `attemptId`, so it's saved once.
 */
export async function checkLessonStep({
  stepId,
  ...input
}: {
  answer: LessonStepAnswer;
  attemptId?: string;
  durationMs: number;
  runId: string;
  stepId: string;
  usedHelp: boolean;
}): Promise<LessonCheckOutcome> {
  const outcome = await postToApp<LessonCheckOutcome>({
    body: { ...input, timeZone: getLocalTimeZone() },
    path: `/api/steps/${encodeURIComponent(stepId)}/checks`,
  });

  return outcome ?? { status: "failed" };
}

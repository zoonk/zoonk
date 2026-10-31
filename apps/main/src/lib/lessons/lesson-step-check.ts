import { postToApp } from "@/lib/http/post-to-app";
import { type LessonStepAnswer } from "@zoonk/core/lesson-player/contract";
import { type LessonCheckOutcome } from "@zoonk/player/lesson/types";
import { getLocalTimeZone } from "@zoonk/utils/time-zone";

/** The player resends a failure with the same `attemptId`, so it's saved once. */
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

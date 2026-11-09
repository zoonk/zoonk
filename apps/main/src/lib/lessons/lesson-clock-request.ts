import { postToApp } from "@/lib/http/post-to-app";
import { type LessonClockOutcome } from "@zoonk/core/lesson-player/clock";
import { type LessonClockInput } from "@zoonk/core/lesson-player/clock-contract";

export async function sendLessonClock({
  input,
  lessonId,
}: {
  input: LessonClockInput;
  lessonId: string;
}): Promise<LessonClockOutcome | null> {
  return postToApp<LessonClockOutcome>({
    body: input,
    keepalive: true,
    path: `/api/library/lessons/${encodeURIComponent(lessonId)}/clock`,
  });
}

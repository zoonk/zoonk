import { postToApp } from "@/lib/http/post-to-app";
import { type LessonClockInput } from "@zoonk/core/lesson-player/clock-contract";

export async function sendLessonClock({
  input,
  lessonId,
}: {
  input: LessonClockInput;
  lessonId: string;
}): Promise<boolean> {
  const outcome = await postToApp({
    body: input,
    keepalive: true,
    path: `/api/library/lessons/${encodeURIComponent(lessonId)}/clock`,
  });

  return outcome !== null;
}

import { appPostRoute, readJsonBody } from "@/lib/http/app-post-route";
import { type LessonClockOutcome, updateLessonClock } from "@zoonk/core/lesson-player/clock";
import { lessonClockInputSchema } from "@zoonk/core/lesson-player/clock-contract";

/** A route, not a Server Action: the pause sent as the page hides is a keepalive request. */
export const POST = appPostRoute<{ lessonId: string }>(
  "lessonClockRoute",
  async (request, { lessonId }): Promise<LessonClockOutcome> => {
    const input = lessonClockInputSchema.safeParse(await readJsonBody(request));

    return input.success
      ? updateLessonClock({ input: input.data, lessonId })
      : { status: "notFound" };
  },
);

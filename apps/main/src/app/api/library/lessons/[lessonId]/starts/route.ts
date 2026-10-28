import { isSameOriginRequest } from "@/lib/http/is-same-origin-request";
import { libraryLessonStartInputSchema } from "@zoonk/core/lesson-player/contract";
import { startLibraryLesson } from "@zoonk/core/lesson-player/start";
import { safeAsync } from "@zoonk/utils/error";
import { logError } from "@zoonk/utils/logger";
import { z } from "zod";

const lessonIdSchema = z.uuid();

/**
 * A plain HTTP request, not a Server Action: an action's React Flight response could replace a
 * prefetched lesson while its route params still resolve. Every business outcome is a 200.
 */
export async function POST(
  request: Request,
  context: RouteContext<"/api/library/lessons/[lessonId]/starts">,
) {
  if (!isSameOriginRequest(request.headers)) {
    return new Response(null, { status: 403 });
  }

  const [{ lessonId }, body] = await Promise.all([
    context.params,
    request.json().then(
      (json: unknown) => json,
      () => null,
    ),
  ]);

  const input = libraryLessonStartInputSchema.safeParse(body ?? {});

  if (!lessonIdSchema.safeParse(lessonId).success || !input.success) {
    return new Response(null, { status: 400 });
  }

  const { data: response, error } = await safeAsync(async () =>
    Response.json(await startLibraryLesson({ input: input.data, lessonId })),
  );

  if (error) {
    logError("[libraryLessonStartRoute] Failed to start a lesson:", error);
    return new Response(null, { status: 500 });
  }

  return response;
}

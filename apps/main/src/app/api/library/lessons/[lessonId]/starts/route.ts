import { isSameOriginRequest } from "@/lib/http/is-same-origin-request";
import { libraryLessonStartInputSchema } from "@zoonk/core/lesson-player/contract";
import { startLibraryLesson } from "@zoonk/core/lesson-player/start";
import { safeAsync } from "@zoonk/utils/error";
import { logError } from "@zoonk/utils/logger";
import { z } from "zod";

const lessonIdSchema = z.uuid();

/**
 * The web player's lesson start. Like today's lesson start, it runs as a plain HTTP request after
 * the player mounts: a Server Action response takes part in the React Flight protocol and could
 * replace a prefetched lesson while its route params still resolve. Same-origin only, since it
 * reads the session cookie; core claims the allowance and opens the run. Every business outcome
 * (started, slow down, a limit reached) is a 200 with the outcome, for the player to act on.
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

  const { data: outcome, error } = await safeAsync(() =>
    startLibraryLesson({ input: input.data, lessonId }),
  );

  if (error) {
    logError("[libraryLessonStartRoute] Failed to start a lesson:", error);
    return new Response(null, { status: 500 });
  }

  return Response.json(outcome);
}

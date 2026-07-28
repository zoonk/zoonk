import { startLesson } from "@zoonk/core/player/commands/start-lesson";
import { logError } from "@zoonk/utils/logger";
import { z } from "zod";
import { isSameOriginRequest } from "./_utils/is-same-origin-request";

const lessonIdSchema = z.uuid();

/**
 * Records the mounted player's background write without using the React Flight
 * transport. Core derives the acting learner and owns the mutation.
 */
export async function POST(
  request: Request,
  context: RouteContext<"/api/lessons/[lessonId]/starts">,
) {
  if (!isSameOriginRequest(request.headers)) {
    return new Response(null, { status: 403 });
  }

  const { lessonId } = await context.params;

  if (!lessonIdSchema.safeParse(lessonId).success) {
    return new Response(null, { status: 400 });
  }

  try {
    const result = await startLesson(lessonId);

    if (result.status !== "started") {
      return new Response(null, { status: 401 });
    }

    return new Response(null, { status: 204 });
  } catch (error) {
    logError("[lessonStartRoute] Failed to persist lesson start:", error);
    return new Response(null, { status: 500 });
  }
}

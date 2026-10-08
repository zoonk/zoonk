import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { withApiImageUrls } from "@/lib/file-urls";
import { usageDecisionError } from "@/lib/lesson-player-errors";
import { lessonPathParamsSchema } from "@/lib/openapi/schemas/paths";
import { parsePathParams } from "@/lib/path-params";
import { getPlayableLibraryLesson } from "@zoonk/core/lesson-player/get";
import { NextResponse } from "next/server";

/**
 * A Library lesson ready to play, or its outline while its content is written. Its screens need a
 * session (a guest's is enough); without one, a public lesson returns only its outline. Reading
 * screens too fast is a 429 with `Retry-After`. A private lesson is readable only by its owner.
 */
async function getLibraryLessonRoute(
  _request: Request,
  context: RouteContext<"/v1/library/lessons/[lessonId]">,
) {
  const parsed = parsePathParams({ params: await context.params, schema: lessonPathParamsSchema });

  if (!parsed.success) {
    return errors.validation(parsed.error);
  }

  const result = await getPlayableLibraryLesson({ lessonId: parsed.data.lessonId });

  if (!result) {
    return errors.notFound();
  }

  if (result.status === "slowDown") {
    return usageDecisionError({ retryAfterSeconds: result.retryAfterSeconds, status: "slowDown" });
  }

  return NextResponse.json(withApiImageUrls(result));
}

export const GET = withApiErrorBoundary(getLibraryLessonRoute);

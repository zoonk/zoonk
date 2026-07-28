import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { lessonPathParamsSchema } from "@/lib/openapi/schemas/paths";
import { parsePathParams } from "@/lib/path-params";
import { startLesson } from "@zoonk/core/player/commands/start-lesson";
import { NextResponse } from "next/server";

/**
 * Records an idempotent start for the authenticated learner and enrolls them in
 * the lesson's course without accepting an acting user ID.
 */
async function createLessonStartRoute(
  _request: Request,
  context: RouteContext<"/v1/lessons/[lessonId]/starts">,
) {
  const parsed = parsePathParams({ params: await context.params, schema: lessonPathParamsSchema });

  if (!parsed.success) {
    return errors.validation(parsed.error);
  }

  const result = await startLesson(parsed.data.lessonId);

  if (result.status === "unauthorized") {
    return errors.unauthorized();
  }

  if (result.status === "notFound") {
    return errors.notFound();
  }

  return new NextResponse(null, { status: 204 });
}

export const POST = withApiErrorBoundary(createLessonStartRoute);

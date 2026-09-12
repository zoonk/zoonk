import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { parseBody } from "@/lib/body-parser";
import { toChapterLesson } from "@/lib/catalog-responses";
import { optionalActivityBodySchema } from "@/lib/openapi/schemas/learning-discovery";
import { lessonPathParamsSchema } from "@/lib/openapi/schemas/paths";
import { parsePathParams } from "@/lib/path-params";
import {
  getLessonOptionalActivities,
  startLessonOptionalActivity,
} from "@zoonk/core/lessons/optional-activities";
import { type NextRequest, NextResponse } from "next/server";

async function startActivity(
  request: NextRequest,
  context: RouteContext<"/v1/me/lessons/[lessonId]/optional-activities">,
) {
  const path = parsePathParams({ params: await context.params, schema: lessonPathParamsSchema });

  if (!path.success) {
    return errors.validation(path.error);
  }

  const body = await parseBody(request, optionalActivityBodySchema);

  if (!body.success) {
    return errors.validation(body.error);
  }

  const result = await startLessonOptionalActivity({ ...path.data, ...body.data });

  if (result.status === "unauthorized") {
    return errors.unauthorized();
  }

  if (result.status === "notFound") {
    return errors.notFound("Lesson not found");
  }

  if (result.status === "invalid") {
    return errors.unprocessableEntity("Choose quiz or practice");
  }

  const source = await getLessonOptionalActivities(path.data);

  if (source.status !== "ready") {
    return errors.notFound("Lesson was replaced");
  }

  return NextResponse.json({
    ...result,
    lesson: toChapterLesson({ courseId: source.source.courseId, lesson: result.lesson }),
  });
}
export const POST = withApiErrorBoundary(startActivity);

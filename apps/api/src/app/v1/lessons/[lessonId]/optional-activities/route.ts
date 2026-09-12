import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { toChapterLesson } from "@/lib/catalog-responses";
import { lessonPathParamsSchema } from "@/lib/openapi/schemas/paths";
import { parsePathParams } from "@/lib/path-params";
import { getLessonOptionalActivities } from "@zoonk/core/lessons/optional-activities";
import { NextResponse } from "next/server";

async function getActivities(
  _request: Request,
  context: RouteContext<"/v1/lessons/[lessonId]/optional-activities">,
) {
  const path = parsePathParams({ params: await context.params, schema: lessonPathParamsSchema });

  if (!path.success) {
    return errors.validation(path.error);
  }

  const result = await getLessonOptionalActivities(path.data);

  if (result.status === "notFound") {
    return errors.notFound("Lesson not found");
  }

  return NextResponse.json({
    ...result,
    activities: result.activities.map(({ kind, lesson }) => ({
      kind,
      lesson: lesson ? toChapterLesson({ courseId: result.source.courseId, lesson }) : null,
    })),
  });
}
export const GET = withApiErrorBoundary(getActivities);

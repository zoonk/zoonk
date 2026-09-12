import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { toChapterLesson } from "@/lib/catalog-responses";
import { chapterActivitiesQuerySchema } from "@/lib/openapi/schemas/learning-discovery";
import { chapterPathParamsSchema } from "@/lib/openapi/schemas/paths";
import { parsePathParams } from "@/lib/path-params";
import { parseQueryParams } from "@/lib/query-params";
import { listChapterOptionalActivities } from "@zoonk/core/lessons/optional-activities";
import { NextResponse } from "next/server";

async function getActivities(
  request: Request,
  context: RouteContext<"/v1/chapters/[chapterId]/optional-activities">,
) {
  const path = parsePathParams({ params: await context.params, schema: chapterPathParamsSchema });

  if (!path.success) {
    return errors.validation(path.error);
  }

  const query = parseQueryParams(new URL(request.url).searchParams, chapterActivitiesQuerySchema);

  if (!query.success) {
    return errors.validation(query.error);
  }

  const result = await listChapterOptionalActivities({ ...path.data, ...query.data });

  if (result.status === "notFound") {
    return errors.notFound("Chapter not found");
  }

  return NextResponse.json({
    ...result,
    groups: result.groups.map((group) => ({
      ...group,
      activities: group.activities.map(({ kind, lesson }) => ({
        kind,
        lesson: lesson ? toChapterLesson({ courseId: group.source.courseId, lesson }) : null,
      })),
    })),
    reviews: result.reviews.map((lesson) => toChapterLesson({ courseId: result.courseId, lesson })),
  });
}
export const GET = withApiErrorBoundary(getActivities);

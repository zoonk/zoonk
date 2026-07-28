import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { toCourseResource } from "@/lib/catalog-responses";
import { coursePathParamsSchema } from "@/lib/openapi/schemas/paths";
import { parsePathParams } from "@/lib/path-params";
import { getCourseById } from "@zoonk/core/courses/get-by-id";
import { NextResponse } from "next/server";

/**
 * Returns the canonical metadata for one published brand course.
 */
async function getCourse(_request: Request, context: RouteContext<"/v1/courses/[courseId]">) {
  const parsed = parsePathParams({ params: await context.params, schema: coursePathParamsSchema });

  if (!parsed.success) {
    return errors.validation(parsed.error);
  }

  const course = await getCourseById({ courseId: parsed.data.courseId });

  if (!course) {
    return errors.notFound("Course not found");
  }

  return NextResponse.json(toCourseResource(course));
}

export const GET = withApiErrorBoundary(getCourse);

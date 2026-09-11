import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { parseBody } from "@/lib/body-parser";
import { courseEditionRequestSchema } from "@/lib/openapi/schemas/course-editions";
import { coursePathParamsSchema } from "@/lib/openapi/schemas/paths";
import { parsePathParams } from "@/lib/path-params";
import { parseQueryParams } from "@/lib/query-params";
import { getCourseEdition, resolveCourseEdition } from "@zoonk/core/courses/editions";
import { type NextRequest, NextResponse } from "next/server";

function getEditionResponse(result: Awaited<ReturnType<typeof resolveCourseEdition>>) {
  if (result.kind === "notFound") {
    return errors.notFound("Course not found");
  }

  if (result.kind === "unauthorized") {
    return errors.unauthorized();
  }

  if (result.kind === "course") {
    return NextResponse.json({ courseId: result.course.id, kind: result.kind });
  }

  return NextResponse.json(result);
}

async function getEdition(
  request: NextRequest,
  context: RouteContext<"/v1/courses/[courseId]/editions">,
) {
  const path = parsePathParams({ params: await context.params, schema: coursePathParamsSchema });

  if (!path.success) {
    return errors.validation(path.error);
  }

  const query = parseQueryParams(request.nextUrl.searchParams, courseEditionRequestSchema);

  if (!query.success) {
    return errors.validation(query.error);
  }

  const result = await getCourseEdition({ ...path.data, ...query.data });
  return getEditionResponse(result);
}

async function resolveEdition(
  request: NextRequest,
  context: RouteContext<"/v1/courses/[courseId]/editions">,
) {
  const path = parsePathParams({ params: await context.params, schema: coursePathParamsSchema });

  if (!path.success) {
    return errors.validation(path.error);
  }

  const body = await parseBody(request, courseEditionRequestSchema);

  if (!body.success) {
    return errors.validation(body.error);
  }

  const result = await resolveCourseEdition({ ...path.data, ...body.data });
  return getEditionResponse(result);
}

export const GET = withApiErrorBoundary(getEdition);
export const POST = withApiErrorBoundary(resolveEdition);

import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { coursePathParamsSchema } from "@/lib/openapi/schemas/paths";
import { parsePathParams } from "@/lib/path-params";
import { removeCurrentUserCourse } from "@zoonk/core/courses/remove-current-user";
import { NextResponse } from "next/server";

/**
 * Removes one course from the authenticated learner's library while Core keeps
 * progress data intact and derives the acting user from the trusted session.
 */
async function removeCourse(_request: Request, context: RouteContext<"/v1/me/courses/[courseId]">) {
  const parsed = parsePathParams({ params: await context.params, schema: coursePathParamsSchema });

  if (!parsed.success) {
    return errors.validation(parsed.error);
  }

  const result = await removeCurrentUserCourse({ courseId: parsed.data.courseId });

  if (!result) {
    return errors.unauthorized();
  }

  return new NextResponse(null, { status: 204 });
}

export const DELETE = withApiErrorBoundary(removeCourse);

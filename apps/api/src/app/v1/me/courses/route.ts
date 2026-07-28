import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { toCurrentUserCourse } from "@/lib/current-learning-responses";
import { resourcePageQuerySchema } from "@/lib/openapi/schemas/catalog-resources";
import { createPaginatedResponse, decodeCursor } from "@/lib/pagination";
import { parseQueryParams } from "@/lib/query-params";
import { listCurrentUserCoursesPage } from "@zoonk/core/courses/list-current-user";
import { NextResponse } from "next/server";

/**
 * Lists the authenticated learner's course library in most-recently-started
 * order without accepting a caller-selected user identity.
 */
async function listCurrentUserCourses(request: Request) {
  const parsed = parseQueryParams(new URL(request.url).searchParams, resourcePageQuerySchema);

  if (!parsed.success) {
    return errors.validation(parsed.error);
  }

  const offset = parsed.data.cursor ? decodeCursor(parsed.data.cursor) : 0;

  if (offset === null) {
    return errors.badRequest("Invalid pagination cursor");
  }

  const page = await listCurrentUserCoursesPage({ limit: parsed.data.limit, offset });

  if (!page) {
    return errors.unauthorized();
  }

  return NextResponse.json(
    createPaginatedResponse({
      hasMore: page.hasMore,
      items: page.courses.map((course) => toCurrentUserCourse(course)),
      offset,
    }),
  );
}

export const GET = withApiErrorBoundary(listCurrentUserCourses);

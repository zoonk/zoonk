import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { toCourseSummary } from "@/lib/catalog-responses";
import { currentUserCoursesQuerySchema } from "@/lib/openapi/schemas/current-learning";
import { createPaginatedResponse, decodeCursor } from "@/lib/pagination";
import { readQueryParams } from "@/lib/request-input";
import { listCurrentUserCoursesPage } from "@zoonk/core/courses/list-current-user";
import { NextResponse } from "next/server";

/**
 * Lists the authenticated learner's course library in most-recently-started
 * order without accepting a caller-selected user identity.
 */
async function listCurrentUserCourses(request: Request) {
  const parsed = readQueryParams(request, currentUserCoursesQuerySchema);

  const offset = parsed.cursor ? decodeCursor(parsed.cursor) : 0;

  if (offset === null) {
    return errors.badRequest("Invalid pagination cursor");
  }

  const page = await listCurrentUserCoursesPage({
    limit: parsed.limit,
    offset,
    query: parsed.query,
  });

  if (!page) {
    return errors.unauthorized();
  }

  return NextResponse.json(
    createPaginatedResponse({
      hasMore: page.hasMore,
      items: page.courses.map((course) => toCourseSummary(course)),
      offset,
    }),
  );
}

export const GET = withApiErrorBoundary(listCurrentUserCourses);

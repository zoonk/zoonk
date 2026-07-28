import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { toCourseSummary } from "@/lib/catalog-responses";
import { courseListQuerySchema } from "@/lib/openapi/schemas/courses";
import { createPaginatedResponse, decodeCursor } from "@/lib/pagination";
import { parseQueryParams } from "@/lib/query-params";
import { listCoursesPage } from "@zoonk/core/courses/list";
import { NextResponse } from "next/server";

type CoursePage = Awaited<ReturnType<typeof listCoursesPage>>;

/**
 * Applies the shared cursor envelope and public DTO mapper to course collection
 * results.
 */
function toCoursePageResponse({ offset, page }: { offset: number; page: CoursePage }) {
  return createPaginatedResponse({
    hasMore: page.hasMore,
    items: page.courses.map((course) => toCourseSummary(course)),
    offset,
  });
}

/**
 * Lists published courses in one language with an optional category filter.
 * Cross-resource search remains a separate catalog capability.
 */
async function listCourses(request: Request) {
  const { searchParams } = new URL(request.url);
  const parsed = parseQueryParams(searchParams, courseListQuerySchema);

  if (!parsed.success) {
    return errors.validation(parsed.error);
  }

  const { category, cursor, language, limit } = parsed.data;
  const offset = cursor ? decodeCursor(cursor) : 0;

  if (offset === null) {
    return errors.badRequest("Invalid pagination cursor");
  }

  const page = await listCoursesPage({ category, language, limit, offset });
  return NextResponse.json(toCoursePageResponse({ offset, page }));
}

export const GET = withApiErrorBoundary(listCourses);

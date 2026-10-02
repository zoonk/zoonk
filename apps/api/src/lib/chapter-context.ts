import { chapterCourseContextQuerySchema } from "./openapi/schemas/catalog-resources";
import { chapterPathParamsSchema } from "./openapi/schemas/paths";
import { parsePathParams } from "./path-params";
import { parseQueryParams } from "./query-params";

/**
 * Chapter reads take the chapter from the path and, optionally, the course to
 * read it in from the query, since a chapter can be placed in several courses.
 */
export function parseChapterContext({ params, request }: { params: unknown; request: Request }) {
  const path = parsePathParams({ params, schema: chapterPathParamsSchema });

  if (!path.success) {
    return path;
  }

  const query = parseQueryParams(
    new URL(request.url).searchParams,
    chapterCourseContextQuerySchema,
  );

  if (!query.success) {
    return query;
  }

  return { data: { ...path.data, ...query.data }, success: true as const };
}

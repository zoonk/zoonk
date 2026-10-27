import { chapterCourseContextQuerySchema } from "./openapi/schemas/catalog-resources";
import { chapterPathParamsSchema } from "./openapi/schemas/paths";
import { readPathParams, readQueryParams } from "./request-input";

/**
 * Chapter reads take the chapter from the path and, optionally, the course to
 * read it in from the query, since a chapter can be placed in several courses.
 */
export async function readChapterContext({
  context,
  request,
}: {
  context: { params: Promise<unknown> };
  request: Request;
}) {
  const path = await readPathParams(context, chapterPathParamsSchema);
  return { ...path, ...readQueryParams(request, chapterCourseContextQuerySchema) };
}

import { chapterCourseContextQuerySchema } from "./openapi/schemas/catalog-resources";
import { chapterPathParamsSchema } from "./openapi/schemas/paths";
import { readPathParams, readQueryParams } from "./request-input";

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

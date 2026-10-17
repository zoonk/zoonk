import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { courseCategoryCountsQuerySchema } from "@/lib/openapi/schemas/courses";
import { parseQueryParams } from "@/lib/query-params";
import { countCatalogCourses } from "@zoonk/core/courses/count-catalog";
import { NextResponse } from "next/server";

/**
 * Counts the published courses of one language, in all and per category, so a
 * client can list the catalog's categories with their sizes.
 */
async function listCourseCategoryCounts(request: Request) {
  const parsed = parseQueryParams(
    new URL(request.url).searchParams,
    courseCategoryCountsQuerySchema,
  );

  if (!parsed.success) {
    return errors.validation(parsed.error);
  }

  return NextResponse.json(await countCatalogCourses({ language: parsed.data.language }));
}

export const GET = withApiErrorBoundary(listCourseCategoryCounts);

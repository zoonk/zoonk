import { withApiErrorBoundary } from "@/lib/api-handler";
import { courseCategoryCountsQuerySchema } from "@/lib/openapi/schemas/courses";
import { readQueryParams } from "@/lib/request-input";
import { countCatalogCourses } from "@zoonk/core/courses/count-catalog";
import { NextResponse } from "next/server";

async function listCourseCategoryCounts(request: Request) {
  const parsed = readQueryParams(request, courseCategoryCountsQuerySchema);

  return NextResponse.json(await countCatalogCourses({ language: parsed.language }));
}

export const GET = withApiErrorBoundary(listCourseCategoryCounts);

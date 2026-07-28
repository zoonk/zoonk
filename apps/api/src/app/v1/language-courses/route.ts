import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { toLanguageCourse } from "@/lib/catalog-responses";
import { languageCourseQuerySchema } from "@/lib/openapi/schemas/catalog-resources";
import { parseQueryParams } from "@/lib/query-params";
import { listCompletedLanguageCourses } from "@zoonk/core/courses/language";
import { NextResponse } from "next/server";

/**
 * Lists the finite completed language-course collection for one learner
 * language. This collection is intentionally not cursor-paginated because the
 * supported target-language taxonomy is finite and product-controlled.
 */
async function listLanguageCourses(request: Request) {
  const parsed = parseQueryParams(new URL(request.url).searchParams, languageCourseQuerySchema);

  if (!parsed.success) {
    return errors.validation(parsed.error);
  }

  const courses = await listCompletedLanguageCourses({ language: parsed.data.language });
  return NextResponse.json({ data: courses.map((course) => toLanguageCourse(course)) });
}

export const GET = withApiErrorBoundary(listLanguageCourses);

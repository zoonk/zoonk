import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { courseEstimateQuerySchema } from "@/lib/openapi/schemas/course-estimates";
import { coursePathParamsSchema } from "@/lib/openapi/schemas/paths";
import { parsePathParams } from "@/lib/path-params";
import { parseQueryParams } from "@/lib/query-params";
import { estimateCoursePlan } from "@zoonk/core/catalog/course-estimate";
import { coursePlanEstimateInputSchema } from "@zoonk/core/catalog/course-estimate-contract";
import { NextResponse } from "next/server";

async function estimateCourse(
  request: Request,
  context: { params: Promise<{ courseId: string }> },
) {
  const path = parsePathParams({ params: await context.params, schema: coursePathParamsSchema });

  if (!path.success) {
    return errors.validation(path.error);
  }

  const query = parseQueryParams(new URL(request.url).searchParams, courseEstimateQuerySchema);

  if (!query.success) {
    return errors.validation(query.error);
  }

  const input = coursePlanEstimateInputSchema.safeParse({
    ...path.data,
    ...query.data,
    studyDays: query.data.studyDays.split(",").map(Number),
  });

  if (!input.success) {
    return errors.validation(input.error);
  }

  return NextResponse.json(await estimateCoursePlan(input.data));
}

export const GET = withApiErrorBoundary(estimateCourse);

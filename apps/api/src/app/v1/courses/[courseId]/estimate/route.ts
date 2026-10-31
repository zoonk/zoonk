import { withApiErrorBoundary } from "@/lib/api-handler";
import { courseEstimateQuerySchema } from "@/lib/openapi/schemas/course-estimates";
import { coursePathParamsSchema } from "@/lib/openapi/schemas/paths";
import { parseInput, readPathParams, readQueryParams } from "@/lib/request-input";
import { estimateCoursePlan } from "@zoonk/core/catalog/course-estimate";
import { coursePlanEstimateInputSchema } from "@zoonk/core/catalog/course-estimate-contract";
import { NextResponse } from "next/server";

async function estimateCourse(
  request: Request,
  context: { params: Promise<{ courseId: string }> },
) {
  const path = await readPathParams(context, coursePathParamsSchema);
  const query = readQueryParams(request, courseEstimateQuerySchema);

  const input = parseInput(coursePlanEstimateInputSchema, {
    ...path,
    ...query,
    studyDays: query.studyDays.split(",").map(Number),
  });

  return NextResponse.json(await estimateCoursePlan(input));
}

export const GET = withApiErrorBoundary(estimateCourse);

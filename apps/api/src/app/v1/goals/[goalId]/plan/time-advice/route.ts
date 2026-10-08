import { accessError, errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { goalPathParamsSchema } from "@/lib/openapi/schemas/paths";
import { planTimeAdviceQuerySchema } from "@/lib/openapi/schemas/time-advice";
import { parsePathParams } from "@/lib/path-params";
import { parseQueryParams } from "@/lib/query-params";
import { getPlanTimeAdvice } from "@zoonk/core/plans/time-advice";
import { NextResponse } from "next/server";

/** The daily time the goal's plan needs, on the study days asked about. */
async function readTimeAdvice(
  request: Request,
  context: RouteContext<"/v1/goals/[goalId]/plan/time-advice">,
) {
  const path = parsePathParams({ params: await context.params, schema: goalPathParamsSchema });

  const query = parseQueryParams(new URL(request.url).searchParams, planTimeAdviceQuerySchema);

  if (!path.success) {
    return errors.validation(path.error);
  }

  if (!query.success) {
    return errors.validation(query.error);
  }

  const result = await getPlanTimeAdvice({
    goalId: path.data.goalId,
    input: { studyDays: query.data.studyDays?.split(",").map(Number) },
  });

  return result.status === "ready" ? NextResponse.json(result.advice) : accessError(result.status);
}

export const GET = withApiErrorBoundary(readTimeAdvice);

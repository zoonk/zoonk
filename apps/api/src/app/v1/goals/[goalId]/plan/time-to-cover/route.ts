import { accessError, errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { parseBody } from "@/lib/body-parser";
import { goalPathParamsSchema } from "@/lib/openapi/schemas/paths";
import { planTimeToCoverInputSchema } from "@/lib/openapi/schemas/time-advice";
import { parsePathParams } from "@/lib/path-params";
import { findPlanTimeToCover } from "@zoonk/core/plans/time-advice";
import { type NextRequest, NextResponse } from "next/server";

/**
 * The daily time that studies the goal's whole plan in depth by its date, found when the learner
 * asks for it ("Find the time that covers everything"): it plans the goal at each daily time, so
 * it's a POST a learner sends, never a read a page or prefetch makes.
 */
async function findTimeToCover(
  request: NextRequest,
  context: RouteContext<"/v1/goals/[goalId]/plan/time-to-cover">,
) {
  const [body, path] = await Promise.all([
    parseBody(request, planTimeToCoverInputSchema),
    context.params.then((params) => parsePathParams({ params, schema: goalPathParamsSchema })),
  ]);

  if (!path.success) {
    return errors.validation(path.error);
  }

  if (!body.success) {
    return errors.validation(body.error);
  }

  const result = await findPlanTimeToCover({
    goalId: path.data.goalId,
    input: { studyDays: body.data.studyDays, weekendMinutes: body.data.weekendMinutes },
  });

  return result.status === "ready" ? NextResponse.json(result.time) : accessError(result.status);
}

export const POST = withApiErrorBoundary(findTimeToCover);

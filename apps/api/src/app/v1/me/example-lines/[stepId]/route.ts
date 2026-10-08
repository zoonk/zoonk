import { errors, slowDownError } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { usageDecisionError } from "@/lib/lesson-player-errors";
import { stepPathParamsSchema } from "@/lib/openapi/schemas/steps";
import { parsePathParams } from "@/lib/path-params";
import { getStepExampleLine } from "@zoonk/core/library/variants/example-line";
import { type NextRequest, NextResponse } from "next/server";

/**
 * The signed-in learner's example line for one explanation screen, written the first time. A POST,
 * since writing it calls a model: a GET never starts AI work.
 */
async function requestExampleLine(
  _request: NextRequest,
  context: RouteContext<"/v1/me/example-lines/[stepId]">,
) {
  const path = parsePathParams({ params: await context.params, schema: stepPathParamsSchema });

  if (!path.success) {
    return errors.validation(path.error);
  }

  const result = await getStepExampleLine({ stepId: path.data.stepId });

  if (result.status === "unauthorized") {
    return errors.unauthorized();
  }

  if (result.status === "notFound") {
    return errors.notFound("Screen not found");
  }

  if (result.status === "slowDown") {
    return slowDownError({
      details: result,
      message: "Too many new example lines at once",
      retryAfterSeconds: result.retryAfterSeconds,
    });
  }

  if (result.status === "limitReached") {
    return usageDecisionError(result);
  }

  return NextResponse.json({ line: result.line, stepId: path.data.stepId });
}

export const POST = withApiErrorBoundary(requestExampleLine);

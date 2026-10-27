import { errors, slowDownError } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { usageDecisionError } from "@/lib/lesson-player-errors";
import { stepPathParamsSchema } from "@/lib/openapi/schemas/steps";
import { readPathParams } from "@/lib/request-input";
import { isRefusedUsage } from "@zoonk/core/entitlements/contract";
import {
  getStepExampleLine,
  requestStepExampleLine,
} from "@zoonk/core/library/variants/example-line";
import { type NextRequest, NextResponse } from "next/server";

/**
 * The signed-in learner's example line for one explanation screen, written the first time. A POST,
 * since writing it calls a model: a GET never starts AI work.
 */
async function exampleLine(
  request: NextRequest,
  context: RouteContext<"/v1/me/example-lines/[stepId]">,
) {
  const path = await readPathParams(context, stepPathParamsSchema);

  const capability = request.method === "POST" ? requestStepExampleLine : getStepExampleLine;
  const result = await capability({ stepId: path.stepId });

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

  if (isRefusedUsage(result)) {
    return usageDecisionError(result);
  }

  return NextResponse.json({
    canRequest: result.canRequest,
    line: result.line,
    stepId: path.stepId,
  });
}

export const GET = withApiErrorBoundary(exampleLine);
export const POST = withApiErrorBoundary(exampleLine);

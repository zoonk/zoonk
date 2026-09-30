import { createErrorResponse, errors, slowDownError } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { parseBody } from "@/lib/body-parser";
import { usageDecisionError } from "@/lib/lesson-player-errors";
import {
  stepPathParamsSchema,
  stepVariantRequestSchema,
} from "@/lib/openapi/schemas/step-variants";
import { parsePathParams } from "@/lib/path-params";
import { requestStepVariant } from "@zoonk/core/library/variants/request";
import { type NextRequest, NextResponse } from "next/server";

const SERVICE_UNAVAILABLE = 503;

/**
 * "Simpler" or "Go deeper" for one lesson screen. The version is shared, so
 * this returns the stored one or writes it the first time anyone asks.
 */
async function postStepVariant(
  request: NextRequest,
  context: RouteContext<"/v1/steps/[stepId]/variants">,
) {
  const [body, path] = await Promise.all([
    parseBody(request, stepVariantRequestSchema),
    context.params.then((params) => parsePathParams({ params, schema: stepPathParamsSchema })),
  ]);

  if (!path.success) {
    return errors.validation(path.error);
  }

  if (!body.success) {
    return errors.validation(body.error);
  }

  const result = await requestStepVariant({ kind: body.data.kind, stepId: path.data.stepId });

  if (result.status === "unauthorized") {
    return errors.unauthorized();
  }

  if (result.status === "notFound") {
    return errors.notFound("Screen not found");
  }

  if (result.status === "unsupported") {
    return errors.unprocessableEntity("This screen has no simpler or deeper version");
  }

  if (result.status === "slowDown") {
    return slowDownError({
      details: result,
      message: "Too many new versions at once",
      retryAfterSeconds: result.retryAfterSeconds,
    });
  }

  if (result.status === "limitReached") {
    return usageDecisionError(result);
  }

  if (result.status === "failed") {
    return createErrorResponse({
      code: "VARIANT_UNAVAILABLE",
      message: "No version could be written this time",
      status: SERVICE_UNAVAILABLE,
    });
  }

  return NextResponse.json(result.variant);
}

export const POST = withApiErrorBoundary(postStepVariant);

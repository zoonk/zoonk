import { accessError } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { goalPathParamsSchema } from "@/lib/openapi/schemas/paths";
import { planChangeInvalid } from "@/lib/plan-errors";
import { readBody, readPathParams } from "@/lib/request-input";
import { planChangeInputSchema } from "@zoonk/core/plans/contract";
import { previewPlanChange } from "@zoonk/core/plans/preview";
import { type NextRequest, NextResponse } from "next/server";

async function createPreview(
  request: NextRequest,
  context: RouteContext<"/v1/goals/[goalId]/plan/change-previews">,
) {
  const [body, path] = await Promise.all([
    readBody(request, planChangeInputSchema),
    readPathParams(context, goalPathParamsSchema),
  ]);

  const result = await previewPlanChange({ goalId: path.goalId, input: body });

  if (result.status === "invalid") {
    return planChangeInvalid(result);
  }

  return result.status === "ready" ? NextResponse.json(result.preview) : accessError(result.status);
}

export const POST = withApiErrorBoundary(createPreview);

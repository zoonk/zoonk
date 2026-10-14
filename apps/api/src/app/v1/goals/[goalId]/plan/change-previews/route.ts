import { accessError, errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { parseBody } from "@/lib/body-parser";
import { goalPathParamsSchema } from "@/lib/openapi/schemas/paths";
import { parsePathParams } from "@/lib/path-params";
import { planChangeInvalid } from "@/lib/plan-errors";
import { planChangeInputSchema } from "@zoonk/core/plans/contract";
import { previewPlanChange } from "@zoonk/core/plans/preview";
import { type NextRequest, NextResponse } from "next/server";

/** What a change would do to the learner's plan, before they make it; nothing is saved. */
async function createPreview(
  request: NextRequest,
  context: RouteContext<"/v1/goals/[goalId]/plan/change-previews">,
) {
  const [body, path] = await Promise.all([
    parseBody(request, planChangeInputSchema),
    context.params.then((params) => parsePathParams({ params, schema: goalPathParamsSchema })),
  ]);

  if (!path.success) {
    return errors.validation(path.error);
  }

  if (!body.success) {
    return errors.validation(body.error);
  }

  const result = await previewPlanChange({ goalId: path.data.goalId, input: body.data });

  if (result.status === "invalid") {
    return planChangeInvalid(result);
  }

  return result.status === "ready" ? NextResponse.json(result.preview) : accessError(result.status);
}

export const POST = withApiErrorBoundary(createPreview);

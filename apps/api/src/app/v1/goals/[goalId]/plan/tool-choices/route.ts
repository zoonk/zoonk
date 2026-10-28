import { accessError } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { goalPathParamsSchema } from "@/lib/openapi/schemas/paths";
import { planChangeInvalid } from "@/lib/plan-errors";
import { readBody, readPathParams } from "@/lib/request-input";
import { choosePlanTools } from "@zoonk/core/plans/choose-tools";
import { planToolChoiceInputSchema } from "@zoonk/core/plans/contract";
import { type NextRequest, NextResponse } from "next/server";

async function createToolChoice(
  request: NextRequest,
  context: RouteContext<"/v1/goals/[goalId]/plan/tool-choices">,
) {
  const [body, path] = await Promise.all([
    readBody(request, planToolChoiceInputSchema),
    readPathParams(context, goalPathParamsSchema),
  ]);

  const result = await choosePlanTools({ goalId: path.goalId, input: body });

  if (result.status === "invalid") {
    return planChangeInvalid(result);
  }

  if (result.status !== "applied") {
    return accessError(result.status);
  }

  return NextResponse.json({ change: result.change, status: result.status });
}

export const POST = withApiErrorBoundary(createToolChoice);

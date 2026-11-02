import { accessError } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { goalPathParamsSchema } from "@/lib/openapi/schemas/paths";
import { goalRefusedError, planChangeInvalid } from "@/lib/plan-errors";
import { readBody, readPathParams } from "@/lib/request-input";
import { goalUpdateInputSchema } from "@zoonk/core/goals/contract";
import { getGoal } from "@zoonk/core/goals/get";
import { updateGoal } from "@zoonk/core/goals/update";
import { type NextRequest, NextResponse } from "next/server";

async function readGoal(_request: Request, context: RouteContext<"/v1/goals/[goalId]">) {
  const path = await readPathParams(context, goalPathParamsSchema);

  const result = await getGoal(path.goalId);

  return result.status === "ready" ? NextResponse.json(result.goal) : accessError(result.status);
}

async function editGoal(request: NextRequest, context: RouteContext<"/v1/goals/[goalId]">) {
  const [body, path] = await Promise.all([
    readBody(request, goalUpdateInputSchema),
    readPathParams(context, goalPathParamsSchema),
  ]);

  const result = await updateGoal({ goalId: path.goalId, input: body });

  if (result.status === "invalid") {
    return planChangeInvalid(result);
  }

  if (result.status === "limitReached") {
    return goalRefusedError({ limit: result.limit, status: "limitReached" });
  }

  if (result.status !== "updated") {
    return accessError(result.status);
  }

  return NextResponse.json({ change: result.change, goal: result.goal });
}

export const GET = withApiErrorBoundary(readGoal);
export const PATCH = withApiErrorBoundary(editGoal);

import { accessError, errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { parseBody } from "@/lib/body-parser";
import { goalPathParamsSchema } from "@/lib/openapi/schemas/paths";
import { parsePathParams } from "@/lib/path-params";
import { goalRefusedError, planChangeInvalid } from "@/lib/plan-errors";
import { goalUpdateInputSchema } from "@zoonk/core/goals/contract";
import { getGoal } from "@zoonk/core/goals/get";
import { updateGoal } from "@zoonk/core/goals/update";
import { type NextRequest, NextResponse } from "next/server";

/** One of the learner's goals with a short summary of its plan. */
async function readGoal(_request: Request, context: RouteContext<"/v1/goals/[goalId]">) {
  const path = parsePathParams({ params: await context.params, schema: goalPathParamsSchema });

  if (!path.success) {
    return errors.validation(path.error);
  }

  const result = await getGoal(path.data.goalId);

  return result.status === "ready" ? NextResponse.json(result.goal) : accessError(result.status);
}

/** Edits a goal: title and details, time, study days and date (re-planning), or its status. */
async function editGoal(request: NextRequest, context: RouteContext<"/v1/goals/[goalId]">) {
  const [body, path] = await Promise.all([
    parseBody(request, goalUpdateInputSchema),
    context.params.then((params) => parsePathParams({ params, schema: goalPathParamsSchema })),
  ]);

  if (!path.success) {
    return errors.validation(path.error);
  }

  if (!body.success) {
    return errors.validation(body.error);
  }

  const result = await updateGoal({ goalId: path.data.goalId, input: body.data });

  if (result.status === "invalid") {
    return planChangeInvalid(result.error);
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

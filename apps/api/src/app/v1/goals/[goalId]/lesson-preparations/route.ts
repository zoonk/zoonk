import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { goalPathParamsSchema } from "@/lib/openapi/schemas/paths";
import { readPathParams } from "@/lib/request-input";
import { startGoalPreparation } from "@/lib/session-preparation";
import { NextResponse } from "next/server";

const ACCEPTED = 202;

async function createLessonPreparation(
  _request: Request,
  context: RouteContext<"/v1/goals/[goalId]/lesson-preparations">,
) {
  const path = await readPathParams(context, goalPathParamsSchema);

  const result = await startGoalPreparation({ goalId: path.goalId });

  if (result.status === "unauthorized") {
    return errors.unauthorized();
  }

  if (result.status === "notFound") {
    return errors.notFound();
  }

  return NextResponse.json({ preparationId: result.preparationId }, { status: ACCEPTED });
}

export const POST = withApiErrorBoundary(createLessonPreparation);

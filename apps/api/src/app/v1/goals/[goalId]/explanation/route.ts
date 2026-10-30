import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { withBaseMaps } from "@/lib/base-maps";
import { withApiImageUrls } from "@/lib/file-urls";
import { goalPathParamsSchema } from "@/lib/openapi/schemas/paths";
import { readPathParams } from "@/lib/request-input";
import { getExplanation } from "@zoonk/core/view-models/explain/get";
import { NextResponse } from "next/server";

async function getGoalExplanation(
  _request: Request,
  context: RouteContext<"/v1/goals/[goalId]/explanation">,
) {
  const path = await readPathParams(context, goalPathParamsSchema);

  const result = await getExplanation({ goalId: path.goalId });

  if (result.status === "unauthorized") {
    return errors.unauthorized();
  }

  if (result.status !== "ready") {
    return errors.notFound();
  }

  const { lesson } = result.explanation;

  return NextResponse.json(
    withApiImageUrls({
      ...result.explanation,
      lesson: lesson && { ...lesson, steps: await withBaseMaps(lesson.steps) },
    }),
  );
}

export const GET = withApiErrorBoundary(getGoalExplanation);

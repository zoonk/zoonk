import { withApiErrorBoundary } from "@/lib/api-handler";
import { languageError } from "@/lib/language-errors";
import { goalPathParamsSchema } from "@/lib/openapi/schemas/paths";
import { readPathParams } from "@/lib/request-input";
import { getPronunciationReviews } from "@zoonk/core/language/pronunciation/get";
import { NextResponse } from "next/server";

async function listPronunciationReviews(
  _request: Request,
  context: RouteContext<"/v1/goals/[goalId]/pronunciation-reviews">,
) {
  const path = await readPathParams(context, goalPathParamsSchema);

  const result = await getPronunciationReviews({ goalId: path.goalId });

  if (result.status !== "ready") {
    return languageError(result.status, "Goal not found");
  }

  return NextResponse.json(result.reviews);
}

export const GET = withApiErrorBoundary(listPronunciationReviews);

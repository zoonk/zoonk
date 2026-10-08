import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { languageError } from "@/lib/language-errors";
import { goalPathParamsSchema } from "@/lib/openapi/schemas/paths";
import { parsePathParams } from "@/lib/path-params";
import { getPronunciationReviews } from "@zoonk/core/language/pronunciation/get";
import { NextResponse } from "next/server";

/** Returns the words a language goal's learner mispronounced that are due to be said again. */
async function listPronunciationReviews(
  _request: Request,
  context: RouteContext<"/v1/goals/[goalId]/pronunciation-reviews">,
) {
  const path = parsePathParams({ params: await context.params, schema: goalPathParamsSchema });

  if (!path.success) {
    return errors.validation(path.error);
  }

  const result = await getPronunciationReviews({ goalId: path.data.goalId });

  if (result.status !== "ready") {
    return languageError(result.status, "Goal not found");
  }

  return NextResponse.json(result.reviews);
}

export const GET = withApiErrorBoundary(listPronunciationReviews);

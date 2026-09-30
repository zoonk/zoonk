import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { parseBody } from "@/lib/body-parser";
import { learnerAccessError } from "@/lib/learner-errors";
import { goalPathParamsSchema } from "@/lib/openapi/schemas/paths";
import { parsePathParams } from "@/lib/path-params";
import { answerPlacementQuestion } from "@zoonk/core/learner/placement/answer";
import { placementAnswerInputSchema } from "@zoonk/core/learner/placement/contract";
import { type NextRequest, NextResponse } from "next/server";

/** Grades one placement answer and returns the updated placement. */
async function createPlacementAnswer(
  request: NextRequest,
  context: RouteContext<"/v1/goals/[goalId]/placement/answers">,
) {
  const [body, path] = await Promise.all([
    parseBody(request, placementAnswerInputSchema),
    context.params.then((params) => parsePathParams({ params, schema: goalPathParamsSchema })),
  ]);

  if (!path.success) {
    return errors.validation(path.error);
  }

  if (!body.success) {
    return errors.validation(body.error);
  }

  const result = await answerPlacementQuestion({ goalId: path.data.goalId, input: body.data });

  if (result.status !== "ready") {
    return learnerAccessError(result.status);
  }

  return NextResponse.json({ isCorrect: result.isCorrect, placement: result.placement });
}

export const POST = withApiErrorBoundary(createPlacementAnswer);

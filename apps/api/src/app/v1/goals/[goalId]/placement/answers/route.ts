import { withApiErrorBoundary } from "@/lib/api-handler";
import { withApiImageUrls } from "@/lib/file-urls";
import { learnerAccessError } from "@/lib/learner-errors";
import { goalPathParamsSchema } from "@/lib/openapi/schemas/paths";
import { readBody, readPathParams } from "@/lib/request-input";
import { answerPlacementQuestion } from "@zoonk/core/learner/placement/answer";
import { placementAnswerInputSchema } from "@zoonk/core/learner/placement/contract";
import { type NextRequest, NextResponse } from "next/server";

/** Grades one placement answer and returns the updated placement. */
async function createPlacementAnswer(
  request: NextRequest,
  context: RouteContext<"/v1/goals/[goalId]/placement/answers">,
) {
  const [body, path] = await Promise.all([
    readBody(request, placementAnswerInputSchema),
    readPathParams(context, goalPathParamsSchema),
  ]);

  const result = await answerPlacementQuestion({ goalId: path.goalId, input: body });

  if (result.status !== "ready") {
    return learnerAccessError(result.status);
  }

  return NextResponse.json(
    withApiImageUrls({ isCorrect: result.isCorrect, placement: result.placement }),
  );
}

export const POST = withApiErrorBoundary(createPlacementAnswer);

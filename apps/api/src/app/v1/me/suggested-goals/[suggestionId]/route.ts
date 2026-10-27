import { createErrorResponse, errors, httpStatus } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { suggestedGoalPathParamsSchema } from "@/lib/openapi/schemas/paths";
import { readBody, readPathParams } from "@/lib/request-input";
import { todayErrorCodes } from "@/lib/today-errors";
import { suggestedGoalAnswerSchema } from "@zoonk/core/goals/suggestions/contract";
import { respondToSuggestedGoal } from "@zoonk/core/goals/suggestions/respond";
import { type NextRequest, NextResponse } from "next/server";

/**
 * Accepts or dismisses a suggested goal; after accepting, apps open its course's start, or
 * onboarding with its title when the course is gone (`courseId` null).
 */
async function answerSuggestedGoal(
  request: NextRequest,
  context: RouteContext<"/v1/me/suggested-goals/[suggestionId]">,
) {
  const [body, path] = await Promise.all([
    readBody(request, suggestedGoalAnswerSchema),
    readPathParams(context, suggestedGoalPathParamsSchema),
  ]);

  const result = await respondToSuggestedGoal({ input: body, suggestionId: path.suggestionId });

  if (result.status === "updated") {
    return NextResponse.json({ suggestedGoal: result.suggestedGoal });
  }

  if (result.status === "alreadyAnswered") {
    return createErrorResponse({
      code: todayErrorCodes.suggestedGoalAlreadyAnswered,
      message: "This suggested goal was already answered",
      status: httpStatus.conflict,
    });
  }

  return result.status === "unauthorized" ? errors.unauthorized() : errors.notFound();
}

export const PATCH = withApiErrorBoundary(answerSuggestedGoal);

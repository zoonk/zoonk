import { createErrorResponse, errors, httpStatus } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { parseBody } from "@/lib/body-parser";
import { suggestedGoalPathParamsSchema } from "@/lib/openapi/schemas/paths";
import { parsePathParams } from "@/lib/path-params";
import { todayErrorCodes } from "@/lib/today-errors";
import { suggestedGoalAnswerSchema } from "@zoonk/core/goals/suggestions/contract";
import { respondToSuggestedGoal } from "@zoonk/core/goals/suggestions/respond";
import { type NextRequest, NextResponse } from "next/server";

/** Accepts or dismisses a suggested goal; after accepting, apps open onboarding with its title. */
async function answerSuggestedGoal(
  request: NextRequest,
  context: RouteContext<"/v1/me/suggested-goals/[suggestionId]">,
) {
  const [body, path] = await Promise.all([
    parseBody(request, suggestedGoalAnswerSchema),
    context.params.then((params) =>
      parsePathParams({ params, schema: suggestedGoalPathParamsSchema }),
    ),
  ]);

  if (!path.success) {
    return errors.validation(path.error);
  }

  if (!body.success) {
    return errors.validation(body.error);
  }

  const result = await respondToSuggestedGoal({
    input: body.data,
    suggestionId: path.data.suggestionId,
  });

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

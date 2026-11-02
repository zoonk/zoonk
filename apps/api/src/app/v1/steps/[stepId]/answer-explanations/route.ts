import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { usageDecisionError } from "@/lib/lesson-player-errors";
import { stepPathParamsSchema } from "@/lib/openapi/schemas/steps";
import { readBody, readPathParams } from "@/lib/request-input";
import { answerExplanationInputSchema } from "@zoonk/core/lesson-player/contract";
import { explainAnswer } from "@zoonk/core/library/items/explain-answer";
import { type NextRequest, NextResponse } from "next/server";

async function createAnswerExplanation(
  request: NextRequest,
  context: RouteContext<"/v1/steps/[stepId]/answer-explanations">,
) {
  const [body, path] = await Promise.all([
    readBody(request, answerExplanationInputSchema),
    readPathParams(context, stepPathParamsSchema),
  ]);

  const result = await explainAnswer({ answer: body.answer, target: { stepId: path.stepId } });

  switch (result.status) {
    case "unauthorized":
      return errors.unauthorized();
    case "notFound":
      return errors.notFound();
    case "invalid":
      return errors.unprocessableEntity("That answer can't be explained");
    case "correct":
      return errors.unprocessableEntity("That answer is right, so there's nothing to explain");
    case "limitReached":
    case "signUpRequired":
    case "slowDown":
      return usageDecisionError(result);
    case "explained":
      return NextResponse.json({
        explanation: result.explanation,
        explanationId: result.explanationId,
        reused: result.reused,
      });
    default:
      return result satisfies never;
  }
}

export const POST = withApiErrorBoundary(createAnswerExplanation);

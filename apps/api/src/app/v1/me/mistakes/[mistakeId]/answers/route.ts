import { withApiErrorBoundary } from "@/lib/api-handler";
import { learnerAccessError } from "@/lib/learner-errors";
import { mistakePathParamsSchema } from "@/lib/openapi/schemas/paths";
import { readBody, readPathParams } from "@/lib/request-input";
import { mistakePracticeAnswerInputSchema } from "@zoonk/core/mistakes/contract";
import { answerMistakePractice } from "@zoonk/core/mistakes/practice-answer";
import { type NextRequest, NextResponse } from "next/server";

async function createMistakePracticeAnswer(
  request: NextRequest,
  context: RouteContext<"/v1/me/mistakes/[mistakeId]/answers">,
) {
  const [body, path] = await Promise.all([
    readBody(request, mistakePracticeAnswerInputSchema),
    readPathParams(context, mistakePathParamsSchema),
  ]);

  const result = await answerMistakePractice({ input: body, mistakeId: path.mistakeId });

  if (result.status !== "ready") {
    return learnerAccessError(result.status);
  }

  return NextResponse.json(result.feedback);
}

export const POST = withApiErrorBoundary(createMistakePracticeAnswer);

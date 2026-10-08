import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { parseBody } from "@/lib/body-parser";
import { learnerAccessError } from "@/lib/learner-errors";
import { mistakePathParamsSchema } from "@/lib/openapi/schemas/paths";
import { parsePathParams } from "@/lib/path-params";
import { mistakePracticeAnswerInputSchema } from "@zoonk/core/mistakes/contract";
import { answerMistakePractice } from "@zoonk/core/mistakes/practice-answer";
import { type NextRequest, NextResponse } from "next/server";

/** Grades one mistake-practice answer; a right answer on a later day fixes the entry. */
async function createMistakePracticeAnswer(
  request: NextRequest,
  context: RouteContext<"/v1/me/mistakes/[mistakeId]/answers">,
) {
  const [body, path] = await Promise.all([
    parseBody(request, mistakePracticeAnswerInputSchema),
    context.params.then((params) => parsePathParams({ params, schema: mistakePathParamsSchema })),
  ]);

  if (!path.success) {
    return errors.validation(path.error);
  }

  if (!body.success) {
    return errors.validation(body.error);
  }

  const result = await answerMistakePractice({ input: body.data, mistakeId: path.data.mistakeId });

  if (result.status !== "ready") {
    return learnerAccessError(result.status);
  }

  return NextResponse.json(result.feedback);
}

export const POST = withApiErrorBoundary(createMistakePracticeAnswer);

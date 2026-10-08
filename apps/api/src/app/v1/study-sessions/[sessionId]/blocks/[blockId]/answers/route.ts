import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { parseBody } from "@/lib/body-parser";
import { studyBlockPathParamsSchema } from "@/lib/openapi/schemas/paths";
import { parsePathParams } from "@/lib/path-params";
import { studySessionError } from "@/lib/study-session-errors";
import { answerStudyQuestion } from "@zoonk/core/sessions/answer";
import { studyAnswerInputSchema } from "@zoonk/core/sessions/contract";
import { type NextRequest, NextResponse } from "next/server";

/** Grades one answer and records it as learning; reviews only slow down at unusual volume. */
async function createAnswer(
  request: NextRequest,
  context: RouteContext<"/v1/study-sessions/[sessionId]/blocks/[blockId]/answers">,
) {
  const [body, path] = await Promise.all([
    parseBody(request, studyAnswerInputSchema),
    context.params.then((params) =>
      parsePathParams({ params, schema: studyBlockPathParamsSchema }),
    ),
  ]);

  if (!path.success) {
    return errors.validation(path.error);
  }

  if (!body.success) {
    return errors.validation(body.error);
  }

  const result = await answerStudyQuestion({ ...path.data, input: body.data });

  if (result.status !== "ready") {
    return studySessionError(result);
  }

  return NextResponse.json(result.feedback);
}

export const POST = withApiErrorBoundary(createAnswer);

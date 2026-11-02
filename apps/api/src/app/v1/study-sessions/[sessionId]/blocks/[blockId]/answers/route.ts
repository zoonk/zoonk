import { withApiErrorBoundary } from "@/lib/api-handler";
import { studyBlockPathParamsSchema } from "@/lib/openapi/schemas/paths";
import { readBody, readPathParams } from "@/lib/request-input";
import { studySessionError } from "@/lib/study-session-errors";
import { answerStudyQuestion } from "@zoonk/core/sessions/answer";
import { studyAnswerInputSchema } from "@zoonk/core/sessions/contract";
import { type NextRequest, NextResponse } from "next/server";

async function createAnswer(
  request: NextRequest,
  context: RouteContext<"/v1/study-sessions/[sessionId]/blocks/[blockId]/answers">,
) {
  const [body, path] = await Promise.all([
    readBody(request, studyAnswerInputSchema),
    readPathParams(context, studyBlockPathParamsSchema),
  ]);

  const result = await answerStudyQuestion({ ...path, input: body });

  if (result.status !== "ready") {
    return studySessionError(result);
  }

  return NextResponse.json(result.feedback);
}

export const POST = withApiErrorBoundary(createAnswer);

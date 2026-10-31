import { withApiErrorBoundary } from "@/lib/api-handler";
import { examError } from "@/lib/exam-errors";
import { mockPathParamsSchema } from "@/lib/openapi/schemas/paths";
import { readBody, readPathParams } from "@/lib/request-input";
import { saveMockAnswer } from "@zoonk/core/exams/mocks/answer";
import { mockAnswerInputSchema } from "@zoonk/core/exams/mocks/answer-contract";
import { type NextRequest } from "next/server";

const NO_CONTENT = 204;

async function putAnswer(
  request: NextRequest,
  context: RouteContext<"/v1/mocks/[blockId]/answers">,
) {
  const path = await readPathParams(context, mockPathParamsSchema);

  const body = await readBody(request, mockAnswerInputSchema);

  const result = await saveMockAnswer({ blockId: path.blockId, input: body });

  if (result.status !== "saved") {
    return examError({ status: result.status });
  }

  return new Response(null, { status: NO_CONTENT });
}

export const PUT = withApiErrorBoundary(putAnswer);

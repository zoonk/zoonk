import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { parseBody } from "@/lib/body-parser";
import { examError } from "@/lib/exam-errors";
import { mockPathParamsSchema } from "@/lib/openapi/schemas/paths";
import { parsePathParams } from "@/lib/path-params";
import { saveMockAnswer } from "@zoonk/core/exams/mocks/answer";
import { mockAnswerInputSchema } from "@zoonk/core/exams/mocks/contract";
import { type NextRequest } from "next/server";

const NO_CONTENT = 204;

/** Saves a draft answer in the running section; nothing says whether it's right until the end. */
async function putAnswer(
  request: NextRequest,
  context: RouteContext<"/v1/mocks/[blockId]/answers">,
) {
  const path = parsePathParams({ params: await context.params, schema: mockPathParamsSchema });

  if (!path.success) {
    return errors.validation(path.error);
  }

  const body = await parseBody(request, mockAnswerInputSchema);

  if (!body.success) {
    return errors.validation(body.error);
  }

  const result = await saveMockAnswer({ blockId: path.data.blockId, input: body.data });

  if (result.status !== "saved") {
    return examError({ status: result.status });
  }

  return new Response(null, { status: NO_CONTENT });
}

export const PUT = withApiErrorBoundary(putAnswer);

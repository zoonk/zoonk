import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { parseBody } from "@/lib/body-parser";
import { examError } from "@/lib/exam-errors";
import { mockPathParamsSchema } from "@/lib/openapi/schemas/paths";
import { parsePathParams } from "@/lib/path-params";
import { mockTimeZoneInputSchema } from "@zoonk/core/exams/mocks/contract";
import { finishMock } from "@zoonk/core/exams/mocks/finish";
import { type NextRequest, NextResponse } from "next/server";

/** Ends the mock now: unanswered questions count as blank and it's graded as it stands. */
async function postFinish(
  request: NextRequest,
  context: RouteContext<"/v1/mocks/[blockId]/finishes">,
) {
  const path = parsePathParams({ params: await context.params, schema: mockPathParamsSchema });

  if (!path.success) {
    return errors.validation(path.error);
  }

  const body = await parseBody(request, mockTimeZoneInputSchema);

  if (!body.success) {
    return errors.validation(body.error);
  }

  const result = await finishMock({ blockId: path.data.blockId, input: body.data });

  if (result.status !== "finished") {
    return examError(result);
  }

  return NextResponse.json({ status: "finished" });
}

export const POST = withApiErrorBoundary(postFinish);

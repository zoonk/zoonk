import { withApiErrorBoundary } from "@/lib/api-handler";
import { examError } from "@/lib/exam-errors";
import { mockPathParamsSchema } from "@/lib/openapi/schemas/paths";
import { readBody, readPathParams } from "@/lib/request-input";
import { mockTimeZoneInputSchema } from "@zoonk/core/exams/mocks/contract";
import { finishMock } from "@zoonk/core/exams/mocks/finish";
import { type NextRequest, NextResponse } from "next/server";

/** Ends the mock now: unanswered questions count as blank and it's graded as it stands. */
async function postFinish(
  request: NextRequest,
  context: RouteContext<"/v1/mocks/[blockId]/finishes">,
) {
  const path = await readPathParams(context, mockPathParamsSchema);

  const body = await readBody(request, mockTimeZoneInputSchema);

  const result = await finishMock({ blockId: path.blockId, input: body });

  if (result.status !== "finished" && result.status !== "expired") {
    return examError(result);
  }

  return NextResponse.json({ status: result.status });
}

export const POST = withApiErrorBoundary(postFinish);

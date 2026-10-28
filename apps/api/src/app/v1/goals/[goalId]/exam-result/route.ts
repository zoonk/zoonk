import { withApiErrorBoundary } from "@/lib/api-handler";
import { examError } from "@/lib/exam-errors";
import { goalPathParamsSchema } from "@/lib/openapi/schemas/paths";
import { readBody, readPathParams, readQueryParams } from "@/lib/request-input";
import { examResultInputSchema } from "@zoonk/core/exams/results/contract";
import { reportExamResult } from "@zoonk/core/exams/results/report";
import { studySessionTimeZoneInputSchema } from "@zoonk/core/sessions/contract";
import { type NextRequest, NextResponse } from "next/server";

async function putExamResult(
  request: NextRequest,
  context: RouteContext<"/v1/goals/[goalId]/exam-result">,
) {
  const path = await readPathParams(context, goalPathParamsSchema);

  const query = readQueryParams(request, studySessionTimeZoneInputSchema);

  const body = await readBody(request, examResultInputSchema);

  const result = await reportExamResult({
    goalId: path.goalId,
    input: body,
    timeZone: query.timeZone,
  });

  if (result.status !== "reported") {
    return examError(result);
  }

  return NextResponse.json(result.result);
}

export const PUT = withApiErrorBoundary(putExamResult);

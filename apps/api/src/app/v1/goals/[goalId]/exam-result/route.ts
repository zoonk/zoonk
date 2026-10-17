import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { parseBody } from "@/lib/body-parser";
import { examError } from "@/lib/exam-errors";
import { goalPathParamsSchema } from "@/lib/openapi/schemas/paths";
import { parsePathParams } from "@/lib/path-params";
import { parseQueryParams } from "@/lib/query-params";
import { examResultInputSchema } from "@zoonk/core/exams/results/contract";
import { reportExamResult } from "@zoonk/core/exams/results/report";
import { studySessionTimeZoneInputSchema } from "@zoonk/core/sessions/contract";
import { type NextRequest, NextResponse } from "next/server";

/** "How did it go?": stores the official result after the exam, replacing an earlier report. */
async function putExamResult(
  request: NextRequest,
  context: RouteContext<"/v1/goals/[goalId]/exam-result">,
) {
  const path = parsePathParams({ params: await context.params, schema: goalPathParamsSchema });

  const query = parseQueryParams(
    new URL(request.url).searchParams,
    studySessionTimeZoneInputSchema,
  );

  if (!path.success) {
    return errors.validation(path.error);
  }

  if (!query.success) {
    return errors.validation(query.error);
  }

  const body = await parseBody(request, examResultInputSchema);

  if (!body.success) {
    return errors.validation(body.error);
  }

  const result = await reportExamResult({
    goalId: path.data.goalId,
    input: body.data,
    timeZone: query.data.timeZone,
  });

  if (result.status !== "reported") {
    return examError(result);
  }

  return NextResponse.json(result.result);
}

export const PUT = withApiErrorBoundary(putExamResult);

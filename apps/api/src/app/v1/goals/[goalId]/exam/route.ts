import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { examError } from "@/lib/exam-errors";
import { goalPathParamsSchema } from "@/lib/openapi/schemas/paths";
import { parsePathParams } from "@/lib/path-params";
import { parseQueryParams } from "@/lib/query-params";
import { getExamView } from "@zoonk/core/exams/view/get";
import { studySessionTimeZoneInputSchema } from "@zoonk/core/sessions/contract";
import { NextResponse } from "next/server";

/** Returns the exam screen for an exam goal: days, exam map, scoring, mocks and result. */
async function getExam(request: Request, context: RouteContext<"/v1/goals/[goalId]/exam">) {
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

  const result = await getExamView({ goalId: path.data.goalId, timeZone: query.data.timeZone });

  if (result.status !== "ready") {
    return examError(result);
  }

  return NextResponse.json(result.exam);
}

export const GET = withApiErrorBoundary(getExam);

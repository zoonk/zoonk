import { withApiErrorBoundary } from "@/lib/api-handler";
import { examError } from "@/lib/exam-errors";
import { goalPathParamsSchema } from "@/lib/openapi/schemas/paths";
import { readPathParams, readQueryParams } from "@/lib/request-input";
import { getExamView } from "@zoonk/core/exams/view/get";
import { studySessionTimeZoneInputSchema } from "@zoonk/core/sessions/contract";
import { NextResponse } from "next/server";

/** Returns the exam screen for an exam goal: days, exam map, scoring, mocks and result. */
async function getExam(request: Request, context: RouteContext<"/v1/goals/[goalId]/exam">) {
  const path = await readPathParams(context, goalPathParamsSchema);

  const query = readQueryParams(request, studySessionTimeZoneInputSchema);

  const result = await getExamView({ goalId: path.goalId, timeZone: query.timeZone });

  if (result.status !== "ready") {
    return examError(result);
  }

  return NextResponse.json(result.exam);
}

export const GET = withApiErrorBoundary(getExam);

import { withApiErrorBoundary } from "@/lib/api-handler";
import { examError } from "@/lib/exam-errors";
import { mockPathParamsSchema } from "@/lib/openapi/schemas/paths";
import { readBody, readPathParams } from "@/lib/request-input";
import { mockTimeZoneInputSchema } from "@zoonk/core/exams/mocks/contract";
import { gradeMockEssays } from "@zoonk/core/exams/mocks/grade-essays";
import { type NextRequest, NextResponse } from "next/server";

/** Grades a finished full mock's essays with the exam's official rubric, right after hand-in. */
async function postEssayGrades(
  request: NextRequest,
  context: RouteContext<"/v1/mocks/[blockId]/essay-grades">,
) {
  const path = await readPathParams(context, mockPathParamsSchema);

  const body = await readBody(request, mockTimeZoneInputSchema);

  const result = await gradeMockEssays({ blockId: path.blockId, input: body });

  if (result.status !== "graded") {
    return examError({ status: result.status });
  }

  return NextResponse.json({ status: "graded" });
}

export const POST = withApiErrorBoundary(postEssayGrades);

import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { parseBody } from "@/lib/body-parser";
import { examError } from "@/lib/exam-errors";
import { mockPathParamsSchema } from "@/lib/openapi/schemas/paths";
import { parsePathParams } from "@/lib/path-params";
import { mockTimeZoneInputSchema } from "@zoonk/core/exams/mocks/contract";
import { gradeMockEssays } from "@zoonk/core/exams/mocks/grade-essays";
import { type NextRequest, NextResponse } from "next/server";

/** Grades a finished full mock's essays with the exam's official rubric, right after hand-in. */
async function postEssayGrades(
  request: NextRequest,
  context: RouteContext<"/v1/mocks/[blockId]/essay-grades">,
) {
  const path = parsePathParams({ params: await context.params, schema: mockPathParamsSchema });

  if (!path.success) {
    return errors.validation(path.error);
  }

  const body = await parseBody(request, mockTimeZoneInputSchema);

  if (!body.success) {
    return errors.validation(body.error);
  }

  const result = await gradeMockEssays({ blockId: path.data.blockId, input: body.data });

  if (result.status !== "graded") {
    return examError({ status: result.status });
  }

  return NextResponse.json({ status: "graded" });
}

export const POST = withApiErrorBoundary(postEssayGrades);

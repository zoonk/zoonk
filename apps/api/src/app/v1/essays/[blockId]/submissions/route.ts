import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { parseBody } from "@/lib/body-parser";
import { examError } from "@/lib/exam-errors";
import { essayPathParamsSchema } from "@/lib/openapi/schemas/paths";
import { parsePathParams } from "@/lib/path-params";
import { essaySubmissionInputSchema } from "@zoonk/core/exams/essays/contract";
import { submitEssay } from "@zoonk/core/exams/essays/submit";
import { type NextRequest, NextResponse } from "next/server";

/** Grades a draft of the block's essay with the official rubric and records it. */
async function postSubmission(
  request: NextRequest,
  context: RouteContext<"/v1/essays/[blockId]/submissions">,
) {
  const path = parsePathParams({ params: await context.params, schema: essayPathParamsSchema });

  if (!path.success) {
    return errors.validation(path.error);
  }

  const body = await parseBody(request, essaySubmissionInputSchema);

  if (!body.success) {
    return errors.validation(body.error);
  }

  const result = await submitEssay({ blockId: path.data.blockId, input: body.data });

  if (result.status !== "graded") {
    return examError({ status: result.status });
  }

  return NextResponse.json(result.grade);
}

export const POST = withApiErrorBoundary(postSubmission);

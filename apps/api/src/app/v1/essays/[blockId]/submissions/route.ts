import { withApiErrorBoundary } from "@/lib/api-handler";
import { examError } from "@/lib/exam-errors";
import { essayPathParamsSchema } from "@/lib/openapi/schemas/paths";
import { readBody, readPathParams } from "@/lib/request-input";
import { essaySubmissionInputSchema } from "@zoonk/core/exams/essays/contract";
import { submitEssay } from "@zoonk/core/exams/essays/submit";
import { type NextRequest, NextResponse } from "next/server";

/** Grades a draft of the block's essay with the official rubric and records it. */
async function postSubmission(
  request: NextRequest,
  context: RouteContext<"/v1/essays/[blockId]/submissions">,
) {
  const path = await readPathParams(context, essayPathParamsSchema);

  const body = await readBody(request, essaySubmissionInputSchema);

  const result = await submitEssay({ blockId: path.blockId, input: body });

  if (result.status !== "graded") {
    return examError({ status: result.status });
  }

  return NextResponse.json(result.grade);
}

export const POST = withApiErrorBoundary(postSubmission);

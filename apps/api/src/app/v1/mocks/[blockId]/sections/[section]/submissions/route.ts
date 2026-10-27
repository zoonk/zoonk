import { withApiErrorBoundary } from "@/lib/api-handler";
import { examError } from "@/lib/exam-errors";
import { mockSectionPathParamsSchema } from "@/lib/openapi/schemas/paths";
import { readBody, readPathParams } from "@/lib/request-input";
import { mockTimeZoneInputSchema } from "@zoonk/core/exams/mocks/contract";
import { submitMockSection } from "@zoonk/core/exams/mocks/submit-section";
import { type NextRequest, NextResponse } from "next/server";

/**
 * Hands in the running section: the next one starts, or the mock ends and is graded, or its time ran
 * out while the learner was away and it isn't scored.
 */
async function postSubmission(
  request: NextRequest,
  context: RouteContext<"/v1/mocks/[blockId]/sections/[section]/submissions">,
) {
  const path = await readPathParams(context, mockSectionPathParamsSchema);

  const body = await readBody(request, mockTimeZoneInputSchema);

  const result = await submitMockSection({
    blockId: path.blockId,
    input: body,
    section: path.section,
  });

  if (result.status === "next" || result.status === "finished" || result.status === "expired") {
    return NextResponse.json({ status: result.status });
  }

  return examError({ status: result.status });
}

export const POST = withApiErrorBoundary(postSubmission);

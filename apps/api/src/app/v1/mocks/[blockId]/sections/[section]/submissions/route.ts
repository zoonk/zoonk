import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { parseBody } from "@/lib/body-parser";
import { examError } from "@/lib/exam-errors";
import { mockSectionPathParamsSchema } from "@/lib/openapi/schemas/paths";
import { parsePathParams } from "@/lib/path-params";
import { mockTimeZoneInputSchema } from "@zoonk/core/exams/mocks/contract";
import { submitMockSection } from "@zoonk/core/exams/mocks/submit-section";
import { type NextRequest, NextResponse } from "next/server";

/** Hands in the running section: the next one starts, or the mock ends and is graded. */
async function postSubmission(
  request: NextRequest,
  context: RouteContext<"/v1/mocks/[blockId]/sections/[section]/submissions">,
) {
  const path = parsePathParams({
    params: await context.params,
    schema: mockSectionPathParamsSchema,
  });

  if (!path.success) {
    return errors.validation(path.error);
  }

  const body = await parseBody(request, mockTimeZoneInputSchema);

  if (!body.success) {
    return errors.validation(body.error);
  }

  const result = await submitMockSection({
    blockId: path.data.blockId,
    input: body.data,
    section: path.data.section,
  });

  if (result.status === "next" || result.status === "finished") {
    return NextResponse.json({ status: result.status });
  }

  return examError({ status: result.status });
}

export const POST = withApiErrorBoundary(postSubmission);

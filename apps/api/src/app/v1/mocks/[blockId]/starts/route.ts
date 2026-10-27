import { withApiErrorBoundary } from "@/lib/api-handler";
import { examError } from "@/lib/exam-errors";
import { mockPathParamsSchema } from "@/lib/openapi/schemas/paths";
import { readBody, readPathParams } from "@/lib/request-input";
import { mockTimeZoneInputSchema } from "@zoonk/core/exams/mocks/contract";
import { startMock } from "@zoonk/core/exams/mocks/start";
import { type NextRequest } from "next/server";

const NO_CONTENT = 204;

/** Starts the mock (or resumes it): its sections are fixed and the first section's clock starts. */
async function postStart(
  request: NextRequest,
  context: RouteContext<"/v1/mocks/[blockId]/starts">,
) {
  const path = await readPathParams(context, mockPathParamsSchema);

  const body = await readBody(request, mockTimeZoneInputSchema);

  const result = await startMock({ blockId: path.blockId, input: body });

  if (result.status !== "ready") {
    return examError({ status: result.status });
  }

  return new Response(null, { status: NO_CONTENT });
}

export const POST = withApiErrorBoundary(postStart);

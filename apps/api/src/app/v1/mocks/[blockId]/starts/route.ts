import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { parseBody } from "@/lib/body-parser";
import { examError } from "@/lib/exam-errors";
import { mockPathParamsSchema } from "@/lib/openapi/schemas/paths";
import { parsePathParams } from "@/lib/path-params";
import { mockTimeZoneInputSchema } from "@zoonk/core/exams/mocks/contract";
import { startMock } from "@zoonk/core/exams/mocks/start";
import { type NextRequest } from "next/server";

const NO_CONTENT = 204;

/** Starts the mock (or resumes it): its sections are fixed and the first section's clock starts. */
async function postStart(
  request: NextRequest,
  context: RouteContext<"/v1/mocks/[blockId]/starts">,
) {
  const path = parsePathParams({ params: await context.params, schema: mockPathParamsSchema });

  if (!path.success) {
    return errors.validation(path.error);
  }

  const body = await parseBody(request, mockTimeZoneInputSchema);

  if (!body.success) {
    return errors.validation(body.error);
  }

  const result = await startMock({ blockId: path.data.blockId, input: body.data });

  if (result.status !== "ready") {
    return examError({ status: result.status });
  }

  return new Response(null, { status: NO_CONTENT });
}

export const POST = withApiErrorBoundary(postStart);

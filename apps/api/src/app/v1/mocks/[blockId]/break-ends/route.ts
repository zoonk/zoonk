import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { examError } from "@/lib/exam-errors";
import { mockPathParamsSchema } from "@/lib/openapi/schemas/paths";
import { parsePathParams } from "@/lib/path-params";
import { endMockBreak } from "@zoonk/core/exams/mocks/end-break";
import { type NextRequest } from "next/server";

/** Ends the break between two sections now: the next section's clock starts. */
async function postBreakEnd(
  _request: NextRequest,
  context: RouteContext<"/v1/mocks/[blockId]/break-ends">,
) {
  const path = parsePathParams({ params: await context.params, schema: mockPathParamsSchema });

  if (!path.success) {
    return errors.validation(path.error);
  }

  const result = await endMockBreak({ blockId: path.data.blockId });

  if (result.status !== "started") {
    return examError({ status: result.status });
  }

  return new Response(null, { status: 204 });
}

export const POST = withApiErrorBoundary(postBreakEnd);

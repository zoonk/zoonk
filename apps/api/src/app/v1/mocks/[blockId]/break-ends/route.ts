import { withApiErrorBoundary } from "@/lib/api-handler";
import { examError } from "@/lib/exam-errors";
import { mockPathParamsSchema } from "@/lib/openapi/schemas/paths";
import { readPathParams } from "@/lib/request-input";
import { endMockBreak } from "@zoonk/core/exams/mocks/end-break";
import { type NextRequest } from "next/server";

async function postBreakEnd(
  _request: NextRequest,
  context: RouteContext<"/v1/mocks/[blockId]/break-ends">,
) {
  const path = await readPathParams(context, mockPathParamsSchema);

  const result = await endMockBreak({ blockId: path.blockId });

  if (result.status !== "started") {
    return examError({ status: result.status });
  }

  return new Response(null, { status: 204 });
}

export const POST = withApiErrorBoundary(postBreakEnd);

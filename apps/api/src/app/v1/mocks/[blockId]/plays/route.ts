import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { parseBody } from "@/lib/body-parser";
import { examError } from "@/lib/exam-errors";
import { mockPathParamsSchema } from "@/lib/openapi/schemas/paths";
import { parsePathParams } from "@/lib/path-params";
import { mockPlayInputSchema } from "@zoonk/core/exams/mocks/answer-contract";
import { recordMockPlay } from "@zoonk/core/exams/mocks/record-play";
import { type NextRequest, NextResponse } from "next/server";

/** Counts a play of a recording in the running listening section, as it starts. */
async function postPlay(request: NextRequest, context: RouteContext<"/v1/mocks/[blockId]/plays">) {
  const path = parsePathParams({ params: await context.params, schema: mockPathParamsSchema });

  if (!path.success) {
    return errors.validation(path.error);
  }

  const body = await parseBody(request, mockPlayInputSchema);

  if (!body.success) {
    return errors.validation(body.error);
  }

  const result = await recordMockPlay({ blockId: path.data.blockId, setId: body.data.setId });

  if (result.status !== "counted") {
    return examError({ status: result.status });
  }

  return NextResponse.json({ played: result.played });
}

export const POST = withApiErrorBoundary(postPlay);

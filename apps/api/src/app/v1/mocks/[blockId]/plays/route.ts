import { withApiErrorBoundary } from "@/lib/api-handler";
import { examError } from "@/lib/exam-errors";
import { mockPathParamsSchema } from "@/lib/openapi/schemas/paths";
import { readBody, readPathParams } from "@/lib/request-input";
import { mockPlayInputSchema } from "@zoonk/core/exams/mocks/answer-contract";
import { recordMockPlay } from "@zoonk/core/exams/mocks/record-play";
import { type NextRequest, NextResponse } from "next/server";

async function postPlay(request: NextRequest, context: RouteContext<"/v1/mocks/[blockId]/plays">) {
  const path = await readPathParams(context, mockPathParamsSchema);

  const body = await readBody(request, mockPlayInputSchema);

  const result = await recordMockPlay({ blockId: path.blockId, setId: body.setId });

  if (result.status !== "counted") {
    return examError({ status: result.status });
  }

  return NextResponse.json({ played: result.played });
}

export const POST = withApiErrorBoundary(postPlay);

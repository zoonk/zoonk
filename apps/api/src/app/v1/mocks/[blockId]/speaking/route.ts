import { withApiErrorBoundary } from "@/lib/api-handler";
import { examError } from "@/lib/exam-errors";
import { conversationRefusalError } from "@/lib/language-errors";
import { mockPathParamsSchema } from "@/lib/openapi/schemas/paths";
import { readPathParams } from "@/lib/request-input";
import { startMockSpeaking } from "@zoonk/core/exams/mocks/start-speaking";
import { type NextRequest, NextResponse } from "next/server";

async function postMockSpeaking(
  _request: NextRequest,
  context: RouteContext<"/v1/mocks/[blockId]/speaking">,
) {
  const path = await readPathParams(context, mockPathParamsSchema);

  const result = await startMockSpeaking({ blockId: path.blockId });

  if (result.status === "callsPaused") {
    return conversationRefusalError({ status: result.status });
  }

  if (result.status !== "ready") {
    return examError({ status: result.status });
  }

  return NextResponse.json(result.section);
}

export const POST = withApiErrorBoundary(postMockSpeaking);

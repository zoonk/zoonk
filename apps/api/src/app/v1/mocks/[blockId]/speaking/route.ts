import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { examError } from "@/lib/exam-errors";
import { conversationRefusalError } from "@/lib/language-errors";
import { mockPathParamsSchema } from "@/lib/openapi/schemas/paths";
import { parsePathParams } from "@/lib/path-params";
import { startMockSpeaking } from "@zoonk/core/exams/mocks/start-speaking";
import { type NextRequest, NextResponse } from "next/server";

/**
 * Starts the running mock's speaking section: its paper's task cards are written now (or the ones
 * written on an earlier start are returned), each task a live call to open.
 */
async function postMockSpeaking(
  _request: NextRequest,
  context: RouteContext<"/v1/mocks/[blockId]/speaking">,
) {
  const path = parsePathParams({ params: await context.params, schema: mockPathParamsSchema });

  if (!path.success) {
    return errors.validation(path.error);
  }

  const result = await startMockSpeaking({ blockId: path.data.blockId });

  if (result.status === "callsPaused") {
    return conversationRefusalError({ status: result.status });
  }

  if (result.status !== "ready") {
    return examError({ status: result.status });
  }

  return NextResponse.json(result.section);
}

export const POST = withApiErrorBoundary(postMockSpeaking);

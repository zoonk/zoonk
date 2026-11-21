import { withApiErrorBoundary } from "@/lib/api-handler";
import { examError } from "@/lib/exam-errors";
import { mockPathParamsSchema } from "@/lib/openapi/schemas/paths";
import { readBody, readPathParams } from "@/lib/request-input";
import { ensureMockWritingPrompts } from "@/workflows/sessions/writing-prompt-workflow";
import { mockTimeZoneInputSchema } from "@zoonk/core/exams/mocks/contract";
import { startMock } from "@zoonk/core/exams/mocks/start";
import { type NextRequest, NextResponse } from "next/server";

const ACCEPTED = 202;
const NO_CONTENT = 204;

async function postStart(
  request: NextRequest,
  context: RouteContext<"/v1/mocks/[blockId]/starts">,
) {
  const path = await readPathParams(context, mockPathParamsSchema);

  const body = await readBody(request, mockTimeZoneInputSchema);

  const result = await startMock({ blockId: path.blockId, input: body });

  if (result.status === "writing") {
    const supply = await ensureMockWritingPrompts(result.requests);

    return supply.status === "writing"
      ? NextResponse.json(
          { generationId: supply.runId, status: "generating" },
          {
            headers: { Location: `/v1/generations/${encodeURIComponent(supply.runId)}` },
            status: ACCEPTED,
          },
        )
      : NextResponse.json({ generationId: null, status: "ready" }, { status: ACCEPTED });
  }

  if (result.status !== "ready") {
    return examError(result.status === "needsChoice" ? result : { status: result.status });
  }

  return new Response(null, { status: NO_CONTENT });
}

export const POST = withApiErrorBoundary(postStart);

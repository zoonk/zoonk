import { withApiErrorBoundary } from "@/lib/api-handler";
import { readBody } from "@/lib/request-input";
import { studySessionError } from "@/lib/study-session-errors";
import { openStudyBlock } from "@zoonk/core/sessions/open-block";
import { openStudyBlockInputSchema } from "@zoonk/core/sessions/open-block-contract";
import { type NextRequest, NextResponse } from "next/server";

async function createOpening(request: NextRequest) {
  const body = await readBody(request, openStudyBlockInputSchema);
  const result = await openStudyBlock(body);

  if (result.status !== "ready") {
    return studySessionError(result);
  }

  return NextResponse.json(result.opening);
}

export const POST = withApiErrorBoundary(createOpening);

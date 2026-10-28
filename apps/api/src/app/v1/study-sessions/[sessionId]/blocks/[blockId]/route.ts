import { withApiErrorBoundary } from "@/lib/api-handler";
import { withApiImageUrls } from "@/lib/file-urls";
import { studyBlockPathParamsSchema } from "@/lib/openapi/schemas/paths";
import { readPathParams } from "@/lib/request-input";
import { studySessionError } from "@/lib/study-session-errors";
import { getStudyBlock } from "@zoonk/core/sessions/block";
import { NextResponse } from "next/server";

async function getBlock(
  _request: Request,
  context: RouteContext<"/v1/study-sessions/[sessionId]/blocks/[blockId]">,
) {
  const path = await readPathParams(context, studyBlockPathParamsSchema);

  const result = await getStudyBlock(path);

  if (result.status !== "ready") {
    return studySessionError(result);
  }

  return NextResponse.json(withApiImageUrls(result.detail));
}

export const GET = withApiErrorBoundary(getBlock);

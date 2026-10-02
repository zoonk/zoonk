import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { studyBlockPathParamsSchema } from "@/lib/openapi/schemas/paths";
import { parsePathParams } from "@/lib/path-params";
import { studySessionError } from "@/lib/study-session-errors";
import { getStudyBlock } from "@zoonk/core/sessions/block";
import { NextResponse } from "next/server";

/** Returns a block with its questions, never their answers, and what was answered already. */
async function getBlock(
  _request: Request,
  context: RouteContext<"/v1/study-sessions/[sessionId]/blocks/[blockId]">,
) {
  const path = parsePathParams({
    params: await context.params,
    schema: studyBlockPathParamsSchema,
  });

  if (!path.success) {
    return errors.validation(path.error);
  }

  const result = await getStudyBlock(path.data);

  if (result.status !== "ready") {
    return studySessionError(result);
  }

  return NextResponse.json(result.detail);
}

export const GET = withApiErrorBoundary(getBlock);

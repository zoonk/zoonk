import { withApiErrorBoundary } from "@/lib/api-handler";
import { withApiImageUrls } from "@/lib/file-urls";
import { checkpointPathParamsSchema } from "@/lib/openapi/schemas/paths";
import { readPathParams } from "@/lib/request-input";
import { studySessionError } from "@/lib/study-session-errors";
import { getCheckpoint } from "@zoonk/core/checkpoints/get";
import { NextResponse } from "next/server";

async function getCheckpointRoute(
  _request: Request,
  context: RouteContext<"/v1/checkpoints/[blockId]">,
) {
  const path = await readPathParams(context, checkpointPathParamsSchema);

  const result = await getCheckpoint(path.blockId);

  if (result.status !== "ready") {
    return studySessionError(result);
  }

  return NextResponse.json(withApiImageUrls(result.checkpoint));
}

export const GET = withApiErrorBoundary(getCheckpointRoute);

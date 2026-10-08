import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { withApiImageUrls } from "@/lib/file-urls";
import { checkpointPathParamsSchema } from "@/lib/openapi/schemas/paths";
import { parsePathParams } from "@/lib/path-params";
import { studySessionError } from "@/lib/study-session-errors";
import { getCheckpoint } from "@zoonk/core/checkpoints/get";
import { NextResponse } from "next/server";

/** Returns a checkpoint of the learner's session: its questions, pass mark, reward and result. */
async function getCheckpointRoute(
  _request: Request,
  context: RouteContext<"/v1/checkpoints/[blockId]">,
) {
  const path = parsePathParams({
    params: await context.params,
    schema: checkpointPathParamsSchema,
  });

  if (!path.success) {
    return errors.validation(path.error);
  }

  const result = await getCheckpoint(path.data.blockId);

  if (result.status !== "ready") {
    return studySessionError(result);
  }

  return NextResponse.json(withApiImageUrls(result.checkpoint));
}

export const GET = withApiErrorBoundary(getCheckpointRoute);

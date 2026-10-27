import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { generationPathParamsSchema } from "@/lib/openapi/schemas/paths";
import { readPathParams } from "@/lib/request-input";
import { readClientRunStatus } from "@/workflows/v2/_shared/run-activity";
import { NextResponse } from "next/server";

/**
 * Returns the current status of a durable generation so clients can recover
 * without depending on an uninterrupted event-stream connection.
 */
async function getGeneration(
  _request: Request,
  context: RouteContext<"/v1/generations/[generationId]">,
) {
  const path = await readPathParams(context, generationPathParamsSchema);

  const status = await readClientRunStatus(path.generationId);

  if (!status) {
    return errors.notFound("Generation not found");
  }

  // Only the run id and status: clients never see Workflow's own run shape. A run that stalled
  // reads as failed, so the client offers to start it again (see `readClientRunStatus`).
  return NextResponse.json({ id: path.generationId, status });
}

export const GET = withApiErrorBoundary(getGeneration);

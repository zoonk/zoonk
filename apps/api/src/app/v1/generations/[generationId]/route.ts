import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { generationPathParamsSchema } from "@/lib/openapi/schemas/paths";
import { parsePathParams } from "@/lib/path-params";
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
  const path = parsePathParams({
    params: await context.params,
    schema: generationPathParamsSchema,
  });

  if (!path.success) {
    return errors.validation(path.error);
  }

  const status = await readClientRunStatus(path.data.generationId);

  if (!status) {
    return errors.notFound("Generation not found");
  }

  // Only the run id and status: clients never see Workflow's own run shape. A run that stalled
  // reads as failed, so the client offers to start it again (see `readClientRunStatus`).
  return NextResponse.json({ id: path.data.generationId, status });
}

export const GET = withApiErrorBoundary(getGeneration);

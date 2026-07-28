import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { toGenerationResource } from "@/lib/generation-resource";
import { generationPathParamsSchema } from "@/lib/openapi/schemas/paths";
import { parsePathParams } from "@/lib/path-params";
import { NextResponse } from "next/server";
import { getRun } from "workflow/api";

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

  const run = getRun(path.data.generationId);

  if (!(await run.exists)) {
    return errors.notFound("Generation not found");
  }

  return NextResponse.json(await toGenerationResource(run));
}

export const GET = withApiErrorBoundary(getGeneration);

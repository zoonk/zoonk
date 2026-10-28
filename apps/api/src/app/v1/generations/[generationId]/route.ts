import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { generationPathParamsSchema } from "@/lib/openapi/schemas/paths";
import { readPathParams } from "@/lib/request-input";
import { readClientRunStatus } from "@/workflows/v2/_shared/run-activity";
import { NextResponse } from "next/server";

async function getGeneration(
  _request: Request,
  context: RouteContext<"/v1/generations/[generationId]">,
) {
  const path = await readPathParams(context, generationPathParamsSchema);

  const status = await readClientRunStatus(path.generationId);

  if (!status) {
    return errors.notFound("Generation not found");
  }

  return NextResponse.json({ id: path.generationId, status });
}

export const GET = withApiErrorBoundary(getGeneration);

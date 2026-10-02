import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { researchPathParamsSchema } from "@/lib/openapi/schemas/research-sources";
import { parsePathParams } from "@/lib/path-params";
import { researchResultSchema } from "@/workflows/v2/research/research-result";
import { NextResponse } from "next/server";
import { getRun } from "workflow/api";

/**
 * A research run's status and, once done, its result: the blueprint to read,
 * or `needsUpload` when the learner should upload the notice. Like
 * generations, the unguessable run id is the capability.
 */
async function getResearch(_request: Request, context: RouteContext<"/v1/research/[researchId]">) {
  const parsed = parsePathParams({
    params: await context.params,
    schema: researchPathParamsSchema,
  });

  if (!parsed.success) {
    return errors.validation(parsed.error);
  }

  const run = getRun(parsed.data.researchId);

  if (!(await run.exists)) {
    return errors.notFound("Research not found");
  }

  const status = await run.status;

  const result =
    status === "completed" ? researchResultSchema.safeParse(await run.returnValue).data : null;

  return NextResponse.json({ id: run.runId, result: result ?? null, status });
}

export const GET = withApiErrorBoundary(getResearch);

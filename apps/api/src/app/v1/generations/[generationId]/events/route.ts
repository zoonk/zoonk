import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { generationPathParamsSchema } from "@/lib/openapi/schemas/paths";
import { workflowEventsQuerySchema } from "@/lib/openapi/schemas/workflows";
import { parsePathParams } from "@/lib/path-params";
import { parseQueryParams } from "@/lib/query-params";
import { getRun } from "workflow/api";

/**
 * Validates a generation-events request and streams its durable workflow run
 * without changing the SSE chunks returned by Workflow.
 */
async function streamGenerationEvents(
  request: Request,
  context: RouteContext<"/v1/generations/[generationId]/events">,
) {
  const path = parsePathParams({
    params: await context.params,
    schema: generationPathParamsSchema,
  });

  if (!path.success) {
    return errors.validation(path.error);
  }

  const query = parseQueryParams(new URL(request.url).searchParams, workflowEventsQuerySchema);

  if (!query.success) {
    return errors.validation(query.error);
  }

  const run = getRun(path.data.generationId);

  if (!(await run.exists)) {
    return errors.notFound("Generation not found");
  }

  const stream = run.getReadable<string>({ startIndex: query.data.startIndex });

  return new Response(stream, {
    headers: { "Cache-Control": "no-cache, no-transform", "Content-Type": "text/event-stream" },
  });
}

export const GET = withApiErrorBoundary(streamGenerationEvents);

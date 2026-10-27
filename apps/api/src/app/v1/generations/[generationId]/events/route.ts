import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { generationPathParamsSchema } from "@/lib/openapi/schemas/paths";
import { workflowEventsQuerySchema } from "@/lib/openapi/schemas/workflows";
import { readPathParams, readQueryParams } from "@/lib/request-input";
import { readRunState } from "@/workflows/v2/_shared/run-activity";
import { getRun } from "workflow/api";

const SSE_HEADERS = {
  "Cache-Control": "no-cache, no-transform",
  "Content-Type": "text/event-stream",
};

/**
 * Validates a generation-events request and streams its durable workflow run
 * without changing the SSE chunks returned by Workflow.
 */
async function streamGenerationEvents(
  request: Request,
  context: RouteContext<"/v1/generations/[generationId]/events">,
) {
  const path = await readPathParams(context, generationPathParamsSchema);

  const query = readQueryParams(request, workflowEventsQuerySchema);

  const { stalled, status } = await readRunState(path.generationId);

  if (!status) {
    return errors.notFound("Generation not found");
  }

  // A stalled run would hold the stream open forever: it ends at once, and the run's status
  // (failed, see `readClientRunStatus`) has the client offer to start it again.
  const stream = stalled
    ? ""
    : getRun(path.generationId).getReadable<string>({ startIndex: query.startIndex });

  return new Response(stream, { headers: SSE_HEADERS });
}

export const GET = withApiErrorBoundary(streamGenerationEvents);

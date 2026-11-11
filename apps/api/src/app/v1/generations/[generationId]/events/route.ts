import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { generationPathParamsSchema } from "@/lib/openapi/schemas/paths";
import { workflowEventsQuerySchema } from "@/lib/openapi/schemas/workflows";
import { readPathParams, readQueryParams } from "@/lib/request-input";
import { hasRunEnded, readRunState } from "@/workflows/_shared/run-activity";
import { getRun } from "workflow/api";

const SSE_HEADERS = {
  "Cache-Control": "no-cache, no-transform",
  "Content-Type": "text/event-stream",
};

/**
 * What an ended run wrote, then the end. Workflow can leave a cancelled run's stream open
 * (vercel/workflow#964), and a client can only tell it has every event once the stream ends.
 */
async function writtenEvents(runId: string, startIndex = 0): Promise<ReadableStream<string>> {
  const readable = getRun(runId).getReadable<string>({ startIndex });
  let left = (await readable.getTailIndex()) + 1 - startIndex;
  const reader = readable.getReader();

  return new ReadableStream<string>({
    cancel: (reason) => reader.cancel(reason),
    async pull(controller) {
      const next = left > 0 ? await reader.read() : null;

      if (!next || next.done) {
        controller.close();
        await reader.cancel();
        return;
      }

      left -= 1;
      controller.enqueue(next.value);
    },
  });
}

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

  if (stalled) {
    // A stalled run would hold the stream open forever.
    return new Response("", { headers: SSE_HEADERS });
  }

  const stream = hasRunEnded(status)
    ? await writtenEvents(path.generationId, query.startIndex)
    : getRun(path.generationId).getReadable<string>({ startIndex: query.startIndex });

  return new Response(stream, { headers: SSE_HEADERS });
}

export const GET = withApiErrorBoundary(streamGenerationEvents);

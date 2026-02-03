import { errors } from "@/lib/api-errors";
import { workflowStatusQuerySchema } from "@/lib/openapi/schemas/workflows";
import { parseQueryParams } from "@/lib/query-params";
import { getRun } from "workflow/api";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const parsed = parseQueryParams(searchParams, workflowStatusQuerySchema);

  if (!parsed.success) {
    return errors.validation(parsed.error);
  }

  const run = getRun(parsed.data.runId);

  const stream = run.getReadable<string>({
    startIndex: parsed.data.startIndex,
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream" },
  });
}

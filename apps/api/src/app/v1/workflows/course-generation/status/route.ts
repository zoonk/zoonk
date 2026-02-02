import { errors } from "@/lib/api-errors";
import { parseQueryParams } from "@/lib/query-params";
import { getRun } from "workflow/api";
import { z } from "zod";

const schema = z.object({
  runId: z.string().min(1),
  startIndex: z.coerce.number().int().optional(),
});

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const parsed = parseQueryParams(searchParams, schema);

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

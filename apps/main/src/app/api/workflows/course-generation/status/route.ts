import { getRun } from "workflow/api";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const runId = url.searchParams.get("runId");
  const startIndex = url.searchParams.get("startIndex");

  if (!runId) {
    return Response.json({ error: "Missing runId" }, { status: 400 });
  }

  const run = getRun(runId);
  const stream = run.getReadable<string>({
    startIndex: startIndex ? Number.parseInt(startIndex, 10) : undefined,
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream" },
  });
}

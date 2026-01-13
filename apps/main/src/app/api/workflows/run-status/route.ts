import { getRun } from "workflow/api";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const runId = url.searchParams.get("runId");

  if (!runId) {
    return Response.json({ error: "Missing runId" }, { status: 400 });
  }

  const run = getRun(runId);
  const status = await run.status;

  return Response.json({ status });
}

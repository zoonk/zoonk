import { NextResponse } from "next/server";
import { getRun } from "workflow/api";

import { getCourseGenerationRun } from "@/data/course-generation-runs/get-course-generation-run";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ runId: string }> },
) {
  const { runId } = await params;
  const url = new URL(req.url);
  const startIndex = url.searchParams.get("startIndex");

  const dbRun = await getCourseGenerationRun(runId);

  if (!dbRun) {
    return NextResponse.json({ error: "Run not found" }, { status: 404 });
  }

  const run = getRun(runId);
  const stream = run.getReadable({
    startIndex: startIndex ? Number(startIndex) : undefined,
  });

  return new Response(stream, {
    headers: {
      "Cache-Control": "no-cache",
      "Content-Type": "text/event-stream",
      connection: "keep-alive",
    },
  });
}

import { NextResponse } from "next/server";
import { start } from "workflow/api";

import { courseGenerationWorkflow } from "@/workflows/course-generation/course-generation-workflow";

export async function POST(req: Request) {
  const body = await req.json();
  const { courseSuggestionId, courseTitle } = body;

  if (!courseSuggestionId || typeof courseSuggestionId !== "number") {
    return NextResponse.json(
      { error: "courseSuggestionId is required and must be a number" },
      { status: 400 },
    );
  }

  if (!courseTitle || typeof courseTitle !== "string") {
    return NextResponse.json(
      { error: "courseTitle is required and must be a string" },
      { status: 400 },
    );
  }

  const run = await start(courseGenerationWorkflow, [
    { courseSuggestionId, courseTitle },
  ]);

  return new Response(run.readable, {
    headers: {
      "Cache-Control": "no-cache",
      "Content-Type": "text/event-stream",
      connection: "keep-alive",
      "X-Workflow-Run-Id": run.runId,
    },
  });
}

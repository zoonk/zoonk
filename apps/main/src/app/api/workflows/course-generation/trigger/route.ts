import { parseNumericId } from "@zoonk/utils/string";
import { start } from "workflow/api";
import { courseGenerationWorkflow } from "@/workflows/course-generation/course-generation-workflow";

export async function POST(request: Request) {
  const body = await request.json();
  const courseSuggestionId = parseNumericId(
    String(body.courseSuggestionId ?? ""),
  );

  if (!courseSuggestionId) {
    return Response.json(
      { error: "Missing or invalid courseSuggestionId" },
      { status: 400 },
    );
  }

  const run = await start(courseGenerationWorkflow, [courseSuggestionId]);

  return Response.json({
    message: "Workflow started",
    runId: run.runId,
  });
}

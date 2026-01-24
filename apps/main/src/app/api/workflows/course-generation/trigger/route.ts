import { courseGenerationWorkflow } from "@/workflows/course-generation/course-generation-workflow";
import { getNumericString } from "@zoonk/utils/json";
import { parseNumericId } from "@zoonk/utils/string";
import { start } from "workflow/api";

export async function POST(request: Request) {
  const body: unknown = await request.json();
  const courseSuggestionId = parseNumericId(getNumericString(body, "courseSuggestionId"));

  if (!courseSuggestionId) {
    return Response.json({ error: "Missing or invalid courseSuggestionId" }, { status: 400 });
  }

  const run = await start(courseGenerationWorkflow, [courseSuggestionId]);

  return Response.json({
    message: "Workflow started",
    runId: run.runId,
  });
}

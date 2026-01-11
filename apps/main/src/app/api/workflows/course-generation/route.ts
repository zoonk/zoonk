import { start } from "workflow/api";
import { courseGenerationWorkflow } from "@/workflows/course-generation/course-generation-workflow";

export async function POST(request: Request) {
  const { courseSuggestionId, courseTitle } = await request.json();

  if (!(courseSuggestionId && courseTitle)) {
    return Response.json(
      { error: "courseSuggestionId and courseTitle are required" },
      { status: 400 },
    );
  }

  const result = await start(courseGenerationWorkflow, [
    { courseSuggestionId, courseTitle },
  ]);

  return Response.json({
    message: "Course generation workflow started",
    ...result,
  });
}

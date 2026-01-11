"use server";

import { start } from "workflow/api";
import { courseGenerationWorkflow } from "@/workflows/course-generation/course-generation-workflow";

export async function startCourseGeneration(params: {
  courseSuggestionId: number;
  courseTitle: string;
}) {
  const { courseSuggestionId, courseTitle } = params;

  await start(courseGenerationWorkflow, [{ courseSuggestionId, courseTitle }]);
}

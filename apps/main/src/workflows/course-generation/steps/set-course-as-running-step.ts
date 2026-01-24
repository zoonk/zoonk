import { updateAICourse } from "@/data/courses/update-ai-course";
import { updateCourseSuggestionStatus } from "@/data/courses/update-course-suggestion-status";
import { streamStatus } from "../stream-status";

export async function setCourseAsRunningStep(input: {
  courseId: number;
  courseSuggestionId: number;
  workflowRunId: string;
}): Promise<void> {
  "use step";

  await streamStatus({ status: "started", step: "setCourseAsRunning" });

  const [courseResult, suggestionResult] = await Promise.all([
    updateAICourse({
      courseId: input.courseId,
      generationStatus: "running",
    }),
    updateCourseSuggestionStatus({
      generationRunId: input.workflowRunId,
      generationStatus: "running",
      id: input.courseSuggestionId,
    }),
  ]);

  if (courseResult.error || suggestionResult.error) {
    await streamStatus({ status: "error", step: "setCourseAsRunning" });
    throw courseResult.error || suggestionResult.error;
  }

  await streamStatus({ status: "completed", step: "setCourseAsRunning" });
}

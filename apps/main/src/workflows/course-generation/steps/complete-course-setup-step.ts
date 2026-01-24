import { updateAICourse } from "@/data/courses/update-ai-course";
import { updateCourseSuggestionStatus } from "@/data/courses/update-course-suggestion-status";
import { streamStatus } from "../stream-status";

export async function completeCourseSetupStep(input: {
  courseSuggestionId: number;
  courseId: number;
}): Promise<void> {
  "use step";

  await streamStatus({ status: "started", step: "completeCourseSetup" });

  const [courseResult, suggestionResult] = await Promise.all([
    updateAICourse({
      courseId: input.courseId,
      generationStatus: "completed",
    }),
    updateCourseSuggestionStatus({
      generationStatus: "completed",
      id: input.courseSuggestionId,
    }),
  ]);

  const error = courseResult.error || suggestionResult.error;

  if (error) {
    await streamStatus({ status: "error", step: "completeCourseSetup" });
    throw error;
  }

  await streamStatus({ status: "completed", step: "completeCourseSetup" });
}

import { updateAICourse } from "@/data/courses/update-ai-course";
import { updateCourseSuggestionStatus } from "@/data/courses/update-course-suggestion-status";
import { streamStatus } from "../stream-status";

type FinalizeInput = {
  courseSuggestionId: number;
  courseId: number;
};

export async function finalizeStep(input: FinalizeInput): Promise<void> {
  "use step";

  await streamStatus({ status: "started", step: "finalize" });

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

  if (courseResult.error || suggestionResult.error) {
    await streamStatus({ status: "error", step: "finalize" });
    throw courseResult.error || suggestionResult.error;
  }

  await streamStatus({ status: "completed", step: "finalize" });
}

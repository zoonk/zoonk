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

  // Update course generation status to completed
  const { error: courseError } = await updateAICourse({
    courseId: input.courseId,
    generationStatus: "completed",
  });

  if (courseError) {
    await streamStatus({ status: "error", step: "finalize" });
    throw courseError;
  }

  // Update course suggestion status to completed
  const { error: suggestionError } = await updateCourseSuggestionStatus({
    generationStatus: "completed",
    id: input.courseSuggestionId,
  });

  if (suggestionError) {
    await streamStatus({ status: "error", step: "finalize" });
    throw suggestionError;
  }

  await streamStatus({ status: "completed", step: "finalize" });
}

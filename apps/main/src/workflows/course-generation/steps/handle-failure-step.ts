import { updateChapterGenerationStatus } from "@/data/chapters/update-chapter-generation-status";
import { updateAICourse } from "@/data/courses/update-ai-course";
import { updateCourseSuggestionStatus } from "@/data/courses/update-course-suggestion-status";

export async function handleCourseFailureStep(input: {
  courseId: number;
  courseSuggestionId: number;
}): Promise<void> {
  "use step";

  await Promise.all([
    updateAICourse({ courseId: input.courseId, generationStatus: "failed" }),
    updateCourseSuggestionStatus({
      generationStatus: "failed",
      id: input.courseSuggestionId,
    }),
  ]);
}

export async function handleChapterFailureStep(input: { chapterId: number }): Promise<void> {
  "use step";

  await updateChapterGenerationStatus({
    chapterId: input.chapterId,
    generationStatus: "failed",
  });
}

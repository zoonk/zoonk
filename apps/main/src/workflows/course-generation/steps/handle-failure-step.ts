import { updateChapterGenerationStatus } from "@/data/chapters/update-chapter-generation-status";
import { updateAICourse } from "@/data/courses/update-ai-course";
import { updateCourseSuggestionStatus } from "@/data/courses/update-course-suggestion-status";

type HandleCourseFailureInput = {
  courseId: number;
  courseSuggestionId: number;
};

export async function handleCourseFailureStep(
  input: HandleCourseFailureInput,
): Promise<void> {
  "use step";

  await Promise.all([
    updateAICourse({ courseId: input.courseId, generationStatus: "failed" }),
    updateCourseSuggestionStatus({
      generationStatus: "failed",
      id: input.courseSuggestionId,
    }),
  ]);
}

type HandleChapterFailureInput = {
  chapterId: number;
};

export async function handleChapterFailureStep(
  input: HandleChapterFailureInput,
): Promise<void> {
  "use step";

  await updateChapterGenerationStatus({
    chapterId: input.chapterId,
    generationStatus: "failed",
  });
}

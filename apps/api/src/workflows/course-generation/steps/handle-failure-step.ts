import { createStepStream } from "@/workflows/_shared/stream-status";
import { type CourseWorkflowStepName } from "@zoonk/core/workflows/steps";
import { prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";

export async function handleCourseFailureStep(input: {
  courseId: number | null;
  courseSuggestionId: number;
}): Promise<void> {
  "use step";

  const { courseId, courseSuggestionId } = input;

  if (courseId) {
    await Promise.allSettled([
      prisma.course.update({
        data: { generationRunId: null, generationStatus: "failed" },
        where: { id: courseId },
      }),
      prisma.courseSuggestion.update({
        data: { generationRunId: null, generationStatus: "failed" },
        where: { id: courseSuggestionId },
      }),
    ]);
  } else {
    await prisma.courseSuggestion.update({
      data: { generationRunId: null, generationStatus: "failed" },
      where: { id: courseSuggestionId },
    });
  }

  await using stream = createStepStream<CourseWorkflowStepName>();
  await stream.error({ reason: "aiGenerationFailed", step: "workflowError" });
}

export async function handleChapterFailureStep(input: { chapterId: number }): Promise<void> {
  "use step";

  await safeAsync(() =>
    prisma.chapter.update({
      data: { generationRunId: null, generationStatus: "failed" },
      where: { id: input.chapterId },
    }),
  );

  await using stream = createStepStream<CourseWorkflowStepName>();
  await stream.error({ reason: "aiGenerationFailed", step: "workflowError" });
}

import { prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";

export async function handleCourseFailureStep(input: {
  courseId: number;
  courseSuggestionId: number;
}): Promise<void> {
  "use step";

  await Promise.all([
    safeAsync(() =>
      prisma.course.update({
        data: { generationStatus: "failed" },
        where: { id: input.courseId },
      }),
    ),
    safeAsync(() =>
      prisma.courseSuggestion.update({
        data: { generationStatus: "failed" },
        where: { id: input.courseSuggestionId },
      }),
    ),
  ]);
}

export async function handleChapterFailureStep(input: { chapterId: number }): Promise<void> {
  "use step";

  await safeAsync(() =>
    prisma.chapter.update({
      data: { generationStatus: "failed" },
      select: { generationStatus: true, id: true },
      where: { id: input.chapterId },
    }),
  );
}

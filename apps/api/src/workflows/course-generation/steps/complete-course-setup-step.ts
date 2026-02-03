import { prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { streamStatus } from "../stream-status";

export async function completeCourseSetupStep(input: {
  courseSuggestionId: number;
  courseId: number;
}): Promise<void> {
  "use step";

  await streamStatus({ status: "started", step: "completeCourseSetup" });

  const [courseResult, suggestionResult] = await Promise.all([
    safeAsync(() =>
      prisma.course.update({
        data: { generationStatus: "completed" },
        where: { id: input.courseId },
      }),
    ),
    safeAsync(() =>
      prisma.courseSuggestion.update({
        data: { generationStatus: "completed" },
        where: { id: input.courseSuggestionId },
      }),
    ),
  ]);

  const error = courseResult.error || suggestionResult.error;

  if (error) {
    await streamStatus({ status: "error", step: "completeCourseSetup" });
    throw error;
  }

  await streamStatus({ status: "completed", step: "completeCourseSetup" });
}

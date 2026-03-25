import { createStepStream } from "@/workflows/_shared/stream-status";
import { type CourseWorkflowStepName } from "@/workflows/config";
import { prisma } from "@zoonk/db";
import { rejected } from "@zoonk/utils/settled";

export async function completeCourseSetupStep(input: {
  courseSuggestionId: number;
  courseId: number;
}): Promise<void> {
  "use step";

  await using stream = createStepStream<CourseWorkflowStepName>();

  await stream.status({ status: "started", step: "completeCourseSetup" });

  const results = await Promise.allSettled([
    prisma.course.update({
      data: { generationStatus: "completed" },
      where: { id: input.courseId },
    }),
    prisma.courseSuggestion.update({
      data: { generationStatus: "completed" },
      where: { id: input.courseSuggestionId },
    }),
  ]);

  if (rejected(results)) {
    await stream.error({ reason: "dbSaveFailed", step: "completeCourseSetup" });
    throw new Error("DB save failed in completeCourseSetup");
  }

  await stream.status({ status: "completed", step: "completeCourseSetup" });
}

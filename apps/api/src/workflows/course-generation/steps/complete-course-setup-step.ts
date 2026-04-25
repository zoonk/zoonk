import { createStepStream } from "@/workflows/_shared/stream-status";
import { type CourseWorkflowStepName } from "@zoonk/core/workflows/steps";
import { prisma } from "@zoonk/db";
import { throwSettledFailures } from "@zoonk/utils/settled";

export async function completeCourseSetupStep(input: {
  courseSuggestionId: string;
  courseId: string;
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

  throwSettledFailures({ message: "Failed to complete course setup", results });

  await stream.status({ status: "completed", step: "completeCourseSetup" });
}

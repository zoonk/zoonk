import { createStepStream } from "@/workflows/_shared/stream-status";
import { type CourseWorkflowStepName } from "@zoonk/core/workflows/steps";
import { prisma } from "@zoonk/db";
import { throwSettledFailures } from "@zoonk/utils/settled";

/**
 * Marks the course and every suggestion already linked to it as completed.
 * Duplicate workflow starts can link more than one suggestion to the same
 * in-progress course, and they should all resolve when the winning run
 * finishes the shared course.
 */
export async function completeCourseSetupStep(input: {
  courseSuggestionId: string;
  courseId: string;
  courseSlug: string;
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
      data: { courseId: input.courseId, generationStatus: "completed" },
      where: { id: input.courseSuggestionId },
    }),
    prisma.courseSuggestion.updateMany({
      data: { generationStatus: "completed" },
      where: { courseId: input.courseId },
    }),
  ]);

  throwSettledFailures({ message: "Failed to complete course setup", results });

  await stream.status({
    entityId: input.courseSlug,
    status: "completed",
    step: "completeCourseSetup",
  });
}

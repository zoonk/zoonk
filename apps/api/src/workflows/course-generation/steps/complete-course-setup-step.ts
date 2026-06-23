import { createStepStream } from "@/workflows/_shared/stream-status";
import { type CourseWorkflowStepName } from "@zoonk/core/workflows/steps";
import { prisma } from "@zoonk/db";
import { throwSettledFailures } from "@zoonk/utils/settled";

/**
 * Marks the course and every start request already linked to it as completed.
 * Duplicate workflow starts can link more than one request to the same
 * in-progress course, and they should all resolve when the winning run
 * finishes the shared course.
 */
export async function completeCourseSetupStep(input: {
  courseStartRequestId: string;
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
    prisma.courseStartRequest.update({
      data: { courseId: input.courseId, generationStatus: "completed" },
      where: { id: input.courseStartRequestId },
    }),
    prisma.courseStartRequest.updateMany({
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

import { createStepStream } from "@/workflows/_shared/stream-status";
import { type CourseWorkflowStepName } from "@zoonk/core/workflows/steps";
import { prisma } from "@zoonk/db";

/**
 * Marks the course and every linked prompt as completed only while this run
 * owns the in-progress course. An already-completed course is also successful
 * so a durable-step retry can re-emit the redirect event after committing,
 * while an older run cannot complete a course reclaimed by a newer run.
 */
export async function completeCourseSetupStep(input: {
  coursePromptId: string;
  courseId: string;
  courseSlug: string;
  workflowRunId: string;
}): Promise<void> {
  "use step";

  await using stream = createStepStream<CourseWorkflowStepName>();

  await stream.status({ status: "started", step: "completeCourseSetup" });

  const completed = await prisma.$transaction(async (transaction) => {
    const ownedCourse = await transaction.course.updateMany({
      data: { generationStatus: "completed" },
      where: {
        generationRunId: input.workflowRunId,
        generationStatus: "running",
        id: input.courseId,
      },
    });

    if (ownedCourse.count === 0) {
      const course = await transaction.course.findUniqueOrThrow({ where: { id: input.courseId } });

      if (course.generationStatus !== "completed") {
        return false;
      }
    }

    await transaction.coursePrompt.update({
      data: { courseId: input.courseId, generationStatus: "completed" },
      where: { id: input.coursePromptId },
    });

    await transaction.coursePrompt.updateMany({
      data: { generationStatus: "completed" },
      where: { courseId: input.courseId },
    });

    return true;
  });

  if (!completed) {
    return;
  }

  await stream.status({
    entityId: input.courseSlug,
    status: "completed",
    step: "completeCourseSetup",
  });
}

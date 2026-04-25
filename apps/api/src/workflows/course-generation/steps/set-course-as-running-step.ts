import { createStepStream } from "@/workflows/_shared/stream-status";
import { type CourseWorkflowStepName } from "@zoonk/core/workflows/steps";
import { prisma } from "@zoonk/db";
import { throwSettledFailures } from "@zoonk/utils/settled";

export async function setCourseAsRunningStep(input: {
  courseId: string;
  courseSuggestionId: string;
  workflowRunId: string;
}): Promise<void> {
  "use step";

  await using stream = createStepStream<CourseWorkflowStepName>();

  await stream.status({ status: "started", step: "setCourseAsRunning" });

  const results = await Promise.allSettled([
    prisma.course.update({
      data: { generationStatus: "running" },
      where: { id: input.courseId },
    }),
    prisma.courseSuggestion.update({
      data: {
        generationRunId: input.workflowRunId,
        generationStatus: "running",
      },
      where: { id: input.courseSuggestionId },
    }),
  ]);

  throwSettledFailures({ message: "Failed to set course as running", results });

  await stream.status({ status: "completed", step: "setCourseAsRunning" });
}

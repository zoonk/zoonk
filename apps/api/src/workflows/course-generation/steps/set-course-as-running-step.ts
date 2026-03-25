import { createStepStream } from "@/workflows/_shared/stream-status";
import { type CourseWorkflowStepName } from "@/workflows/config";
import { prisma } from "@zoonk/db";
import { rejected } from "@zoonk/utils/settled";

export async function setCourseAsRunningStep(input: {
  courseId: number;
  courseSuggestionId: number;
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

  if (rejected(results)) {
    await stream.error({ reason: "dbSaveFailed", step: "setCourseAsRunning" });
    throw new Error("DB save failed in setCourseAsRunning");
  }

  await stream.status({ status: "completed", step: "setCourseAsRunning" });
}

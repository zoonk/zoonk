import { prisma } from "@zoonk/db";
import { streamError, streamStatus } from "../stream-status";

export async function setCourseAsRunningStep(input: {
  courseId: number;
  courseSuggestionId: number;
  workflowRunId: string;
}): Promise<void> {
  "use step";

  await streamStatus({ status: "started", step: "setCourseAsRunning" });

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

  const rejected = results.find((result) => result.status === "rejected");

  if (rejected) {
    await streamError({ reason: "dbSaveFailed", step: "setCourseAsRunning" });
    throw rejected.reason;
  }

  await streamStatus({ status: "completed", step: "setCourseAsRunning" });
}

import { prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { streamError, streamStatus } from "../stream-status";

export async function setCourseAsRunningStep(input: {
  courseId: number;
  courseSuggestionId: number;
  workflowRunId: string;
}): Promise<void> {
  "use step";

  await streamStatus({ status: "started", step: "setCourseAsRunning" });

  const [courseResult, suggestionResult] = await Promise.all([
    safeAsync(() =>
      prisma.course.update({
        data: { generationStatus: "running" },
        where: { id: input.courseId },
      }),
    ),
    safeAsync(() =>
      prisma.courseSuggestion.update({
        data: {
          generationRunId: input.workflowRunId,
          generationStatus: "running",
        },
        where: { id: input.courseSuggestionId },
      }),
    ),
  ]);

  const error = courseResult.error || suggestionResult.error;

  if (error) {
    await streamError({ reason: "dbSaveFailed", step: "setCourseAsRunning" });
    throw error;
  }

  await streamStatus({ status: "completed", step: "setCourseAsRunning" });
}

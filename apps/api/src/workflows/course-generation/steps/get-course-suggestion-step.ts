import { createStepStream } from "@/workflows/_shared/stream-status";
import { type CourseWorkflowStepName } from "@zoonk/core/workflows/steps";
import { type CourseSuggestion, prisma } from "@zoonk/db";
import { FatalError } from "workflow";

/**
 * Fetches the course suggestion from the database.
 * Always returns the suggestion so the workflow can decide what to do
 * based on the generation status (e.g., skip if running, stream completion if completed).
 */
export async function getCourseSuggestionStep(
  courseSuggestionId: number,
): Promise<CourseSuggestion> {
  "use step";

  await using stream = createStepStream<CourseWorkflowStepName>();

  await stream.status({ status: "started", step: "getCourseSuggestion" });

  const suggestion = await prisma.courseSuggestion.findUnique({
    where: { id: courseSuggestionId },
  });

  if (!suggestion) {
    await stream.error({ reason: "notFound", step: "getCourseSuggestion" });
    throw new FatalError("Course suggestion not found");
  }

  await stream.status({ status: "completed", step: "getCourseSuggestion" });

  return suggestion;
}

import { type CourseSuggestion, prisma } from "@zoonk/db";
import { FatalError } from "workflow";
import { streamError, streamStatus } from "../stream-status";

/**
 * Fetches the course suggestion from the database.
 * Always returns the suggestion so the workflow can decide what to do
 * based on the generation status (e.g., skip if running, stream completion if completed).
 */
export async function getCourseSuggestionStep(
  courseSuggestionId: number,
): Promise<CourseSuggestion> {
  "use step";

  await streamStatus({ status: "started", step: "getCourseSuggestion" });

  const suggestion = await prisma.courseSuggestion.findUnique({
    where: { id: courseSuggestionId },
  });

  if (!suggestion) {
    await streamError({ reason: "notFound", step: "getCourseSuggestion" });
    throw new FatalError("Course suggestion not found");
  }

  await streamStatus({ status: "completed", step: "getCourseSuggestion" });

  return suggestion;
}

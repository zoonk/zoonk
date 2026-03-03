import { type CourseSuggestion, prisma } from "@zoonk/db";
import { FatalError } from "workflow";
import { streamError, streamStatus } from "../stream-status";

export async function getCourseSuggestionStep(
  courseSuggestionId: number,
): Promise<CourseSuggestion | null> {
  "use step";

  await streamStatus({ status: "started", step: "getCourseSuggestion" });

  const suggestion = await prisma.courseSuggestion.findUnique({
    where: { id: courseSuggestionId },
  });

  if (!suggestion) {
    await streamError({ reason: "notFound", step: "getCourseSuggestion" });
    throw new FatalError("Course suggestion not found");
  }

  // When the generation is running or already completed, we return null to skip the workflow,
  // Avoiding this running multiple times for the same course suggestion.
  if (suggestion.generationStatus === "running" || suggestion.generationStatus === "completed") {
    await streamStatus({ status: "completed", step: "getCourseSuggestion" });
    return null;
  }

  await streamStatus({ status: "completed", step: "getCourseSuggestion" });

  return suggestion;
}

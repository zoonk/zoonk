import { prisma } from "@zoonk/db";
import { FatalError } from "workflow";
import { streamError, streamStatus } from "../stream-status";
import { type CourseSuggestionData } from "../types";

export async function getCourseSuggestionStep(
  courseSuggestionId: number,
): Promise<CourseSuggestionData | null> {
  "use step";

  await streamStatus({ status: "started", step: "getCourseSuggestion" });

  const suggestion = await prisma.courseSuggestion.findUnique({
    select: {
      description: true,
      generationRunId: true,
      generationStatus: true,
      language: true,
      slug: true,
      targetLanguage: true,
      title: true,
    },
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

  return {
    description: suggestion.description,
    generationRunId: suggestion.generationRunId,
    generationStatus: suggestion.generationStatus,
    id: courseSuggestionId,
    language: suggestion.language,
    slug: suggestion.slug,
    targetLanguage: suggestion.targetLanguage,
    title: suggestion.title,
  };
}

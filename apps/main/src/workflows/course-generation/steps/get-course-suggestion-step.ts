import { FatalError } from "workflow";
import { getCourseSuggestionById } from "@/data/courses/course-suggestions";
import { streamStatus } from "../stream-status";
import type { CourseSuggestionData } from "../types";

export async function getCourseSuggestionStep(
  courseSuggestionId: number,
): Promise<CourseSuggestionData | null> {
  "use step";

  await streamStatus({ status: "started", step: "getCourseSuggestion" });

  const suggestion = await getCourseSuggestionById(courseSuggestionId);

  if (!suggestion) {
    await streamStatus({ status: "error", step: "getCourseSuggestion" });
    throw new FatalError("Course suggestion not found");
  }

  if (
    suggestion.generationStatus === "running" ||
    suggestion.generationStatus === "completed"
  ) {
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
    title: suggestion.title,
  };
}

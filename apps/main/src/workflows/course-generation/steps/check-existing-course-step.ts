import { type ExistingCourse, findExistingCourse } from "@/data/courses/find-existing-course";
import { streamStatus } from "../stream-status";
import { type CourseSuggestionData } from "../types";

export async function checkExistingCourseStep(
  suggestion: CourseSuggestionData,
): Promise<ExistingCourse | null> {
  "use step";

  await streamStatus({ status: "started", step: "checkExistingCourse" });

  const { data: existingCourse, error } = await findExistingCourse({
    language: suggestion.language,
    slug: suggestion.slug,
  });

  if (error) {
    await streamStatus({ status: "error", step: "checkExistingCourse" });
    throw error;
  }

  await streamStatus({ status: "completed", step: "checkExistingCourse" });
  return existingCourse;
}

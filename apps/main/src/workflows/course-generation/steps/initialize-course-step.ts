import { createAICourse } from "@/data/courses/create-ai-course";
import { deleteAICourse } from "@/data/courses/delete-ai-course";
import { findExistingCourse } from "@/data/courses/find-existing-course";
import { updateCourseSuggestionStatus } from "@/data/courses/update-course-suggestion-status";
import { getAIOrganization } from "@/data/orgs/get-ai-organization";
import { streamStatus } from "../stream-status";
import type { CourseContext, CourseSuggestionData } from "../types";

type InitializeInput = {
  suggestion: CourseSuggestionData;
  workflowRunId: string;
};

export async function initializeCourseStep(
  input: InitializeInput,
): Promise<CourseContext> {
  "use step";

  await streamStatus({ status: "started", step: "initializeCourse" });

  const { suggestion, workflowRunId } = input;

  // Fetch AI org and check for existing course in parallel
  const [aiOrg, { data: existingCourse }] = await Promise.all([
    getAIOrganization(),
    findExistingCourse({
      language: suggestion.language,
      slug: suggestion.slug,
    }),
  ]);

  if (existingCourse && existingCourse.generationStatus === "failed") {
    await deleteAICourse(existingCourse.id);
  }

  // Update course suggestion status to running
  const { error: updateError } = await updateCourseSuggestionStatus({
    generationRunId: workflowRunId,
    generationStatus: "running",
    id: suggestion.id,
  });

  if (updateError) {
    await streamStatus({ status: "error", step: "initializeCourse" });
    throw updateError;
  }

  // Create the course
  const { data: course, error: createError } = await createAICourse({
    generationRunId: workflowRunId,
    language: suggestion.language,
    organizationId: aiOrg.id,
    title: suggestion.title,
  });

  if (createError || !course) {
    await streamStatus({ status: "error", step: "initializeCourse" });
    throw createError ?? new Error("Failed to create course");
  }

  await streamStatus({ status: "completed", step: "initializeCourse" });

  return {
    courseId: course.id,
    courseSlug: course.slug,
    courseTitle: suggestion.title,
    language: suggestion.language,
    organizationId: aiOrg.id,
  };
}

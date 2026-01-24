import { createAICourse } from "@/data/courses/create-ai-course";
import { updateCourseSuggestionStatus } from "@/data/courses/update-course-suggestion-status";
import { getAIOrganization } from "@/data/orgs/get-ai-organization";
import { streamStatus } from "../stream-status";
import { type CourseContext, type CourseSuggestionData } from "../types";

export async function initializeCourseStep(input: {
  suggestion: CourseSuggestionData;
  workflowRunId: string;
}): Promise<CourseContext> {
  "use step";

  await streamStatus({ status: "started", step: "initializeCourse" });

  const { suggestion, workflowRunId } = input;

  const aiOrg = await getAIOrganization();

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

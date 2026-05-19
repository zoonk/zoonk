import { createStepStream } from "@/workflows/_shared/stream-status";
import { type CourseWorkflowStepName } from "@zoonk/core/workflows/steps";
import { type CourseSuggestion, prisma } from "@zoonk/db";
import { AI_ORG_SLUG } from "@zoonk/utils/org";
import { ensureLocaleSuffix, normalizeString, toSlug } from "@zoonk/utils/string";

export type CourseContext = {
  courseId: string;
  courseSlug: string;
  courseTitle: string;
  language: string;
  organizationId: string;
  targetLanguage: string | null;
};

/**
 * Links the suggestion to the new course and marks it as running. The course id
 * is required because later generation requests use it to reuse the in-progress
 * course instead of creating another one.
 */
async function updateCourseSuggestionToRunning({
  courseId,
  suggestionId,
  workflowRunId,
}: {
  courseId: string;
  suggestionId: string;
  workflowRunId: string;
}): Promise<void> {
  await prisma.courseSuggestion.update({
    data: { courseId, generationRunId: workflowRunId, generationStatus: "running" },
    where: { id: suggestionId },
  });
}

/**
 * Creates the course entity in the database.
 * This is a pure save step — one DB operation.
 */
async function createCourseEntity({
  organizationId,
  suggestion,
  workflowRunId,
}: {
  organizationId: string;
  suggestion: CourseSuggestion;
  workflowRunId: string;
}): Promise<CourseContext> {
  const slug = ensureLocaleSuffix(toSlug(suggestion.title), suggestion.language);
  const normalizedTitle = normalizeString(suggestion.title);

  const course = await prisma.course.create({
    data: {
      generationRunId: workflowRunId,
      generationStatus: "running",
      isPublished: true,
      language: suggestion.language,
      normalizedTitle,
      organizationId,
      slug,
      targetLanguage: suggestion.targetLanguage,
      title: suggestion.title,
    },
  });

  return {
    courseId: course.id,
    courseSlug: course.slug,
    courseTitle: suggestion.title,
    language: suggestion.language,
    organizationId,
    targetLanguage: suggestion.targetLanguage,
  };
}

/**
 * Initializes a new course from a suggestion.
 * Split into two DB operations:
 * 1. Create the course entity
 * 2. Link the suggestion to the course and mark it as "running"
 *
 * This avoids a redundant pre-create update while keeping failures attributable
 * to a specific action.
 */
export async function initializeCourseStep(input: {
  suggestion: CourseSuggestion;
  workflowRunId: string;
}): Promise<CourseContext> {
  "use step";

  await using stream = createStepStream<CourseWorkflowStepName>();

  await stream.status({ status: "started", step: "initializeCourse" });

  const { suggestion, workflowRunId } = input;

  const aiOrg = await prisma.organization.findUniqueOrThrow({ where: { slug: AI_ORG_SLUG } });

  const course = await createCourseEntity({ organizationId: aiOrg.id, suggestion, workflowRunId });

  await updateCourseSuggestionToRunning({
    courseId: course.courseId,
    suggestionId: suggestion.id,
    workflowRunId,
  });

  await stream.status({ status: "completed", step: "initializeCourse" });

  return course;
}

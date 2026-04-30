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
 * Updates the course suggestion status to "running" so other workflow
 * instances know this suggestion is being processed.
 * This is a pure save step — one DB operation.
 */
async function updateCourseSuggestionToRunning({
  suggestionId,
  workflowRunId,
}: {
  suggestionId: string;
  workflowRunId: string;
}): Promise<void> {
  await prisma.courseSuggestion.update({
    data: {
      generationRunId: workflowRunId,
      generationStatus: "running",
    },
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
 * 1. Mark the course suggestion as "running"
 * 2. Create the course entity
 *
 * Each operation is isolated so failures are attributable to a specific action.
 */
export async function initializeCourseStep(input: {
  suggestion: CourseSuggestion;
  workflowRunId: string;
}): Promise<CourseContext> {
  "use step";

  await using stream = createStepStream<CourseWorkflowStepName>();

  await stream.status({ status: "started", step: "initializeCourse" });

  const { suggestion, workflowRunId } = input;

  const aiOrg = await prisma.organization.findUniqueOrThrow({
    where: { slug: AI_ORG_SLUG },
  });

  await updateCourseSuggestionToRunning({
    suggestionId: suggestion.id,
    workflowRunId,
  });

  const course = await createCourseEntity({
    organizationId: aiOrg.id,
    suggestion,
    workflowRunId,
  });

  await stream.status({ status: "completed", step: "initializeCourse" });

  return course;
}

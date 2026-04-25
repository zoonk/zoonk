import { createStepStream } from "@/workflows/_shared/stream-status";
import { type CourseWorkflowStepName } from "@zoonk/core/workflows/steps";
import { type CourseSuggestion, prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
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
}): Promise<{ error: Error | null }> {
  const { error } = await safeAsync(() =>
    prisma.courseSuggestion.update({
      data: {
        generationRunId: workflowRunId,
        generationStatus: "running",
      },
      where: { id: suggestionId },
    }),
  );

  return { error };
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
}): Promise<{ course: CourseContext | null; error: Error | null }> {
  const slug = ensureLocaleSuffix(toSlug(suggestion.title), suggestion.language);
  const normalizedTitle = normalizeString(suggestion.title);

  const { data: course, error } = await safeAsync(() =>
    prisma.course.create({
      data: {
        generationRunId: workflowRunId,
        generationStatus: "running",
        isPublished: true,
        language: suggestion.language,
        managementMode: "ai",
        normalizedTitle,
        organizationId,
        slug,
        targetLanguage: suggestion.targetLanguage,
        title: suggestion.title,
      },
    }),
  );

  if (error || !course) {
    return { course: null, error: error ?? new Error("Failed to create course") };
  }

  return {
    course: {
      courseId: course.id,
      courseSlug: course.slug,
      courseTitle: suggestion.title,
      language: suggestion.language,
      organizationId,
      targetLanguage: suggestion.targetLanguage,
    },
    error: null,
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

  const { data: aiOrg, error: orgError } = await safeAsync(() =>
    prisma.organization.findUniqueOrThrow({
      where: { slug: AI_ORG_SLUG },
    }),
  );

  if (orgError || !aiOrg) {
    throw orgError ?? new Error("AI organization not found");
  }

  const { error: suggestionError } = await updateCourseSuggestionToRunning({
    suggestionId: suggestion.id,
    workflowRunId,
  });

  if (suggestionError) {
    throw suggestionError;
  }

  const { course, error: createError } = await createCourseEntity({
    organizationId: aiOrg.id,
    suggestion,
    workflowRunId,
  });

  if (createError || !course) {
    throw createError ?? new Error("Failed to create course");
  }

  await stream.status({ status: "completed", step: "initializeCourse" });

  return course;
}

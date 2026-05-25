import { createStepStream } from "@/workflows/_shared/stream-status";
import { type CourseWorkflowStepName } from "@zoonk/core/workflows/steps";
import {
  type Course,
  type CourseSuggestion,
  isPrismaUniqueConstraintError,
  prisma,
} from "@zoonk/db";
import { AI_ORG_SLUG } from "@zoonk/utils/org";
import { normalizeString } from "@zoonk/utils/string";
import { getCourseSlugForTitle } from "../_internal/course-slug";
import {
  type ExistingCourseContent,
  courseContentInclude,
  getExistingCourseContent,
} from "../_internal/existing-course-content";

export type CourseContext = {
  courseId: string;
  courseSlug: string;
  courseTitle: string;
  language: string;
  organizationId: string;
  targetLanguage: string | null;
};

export type InitializedCourse = {
  course: CourseContext;
  existing: ExistingCourseContent | null;
  generationStatus: Course["generationStatus"];
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
 * Links a suggestion to a course discovered after a unique-key race. Completed
 * courses can satisfy the suggestion immediately; every other state means this
 * workflow or the already-running workflow should keep the suggestion in a
 * running state until the course finishes or fails.
 */
async function updateCourseSuggestionForRecoveredCourse({
  courseId,
  generationStatus,
  suggestionId,
  workflowRunId,
}: {
  courseId: string;
  generationStatus: Course["generationStatus"];
  suggestionId: string;
  workflowRunId: string;
}): Promise<void> {
  await prisma.courseSuggestion.update({
    data:
      generationStatus === "completed"
        ? { courseId, generationStatus: "completed" }
        : { courseId, generationRunId: workflowRunId, generationStatus: "running" },
    where: { id: suggestionId },
  });
}

/**
 * Converts a persisted course row into the stable workflow context shape.
 * The workflow keeps the suggestion title/language as the learner-facing
 * request while using the database course id and slug as the durable target.
 */
export function getCourseContext({
  course,
  organizationId,
  suggestion,
}: {
  course: Pick<Course, "id" | "slug">;
  organizationId: string;
  suggestion: CourseSuggestion;
}): CourseContext {
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
}): Promise<Course> {
  const slug = getCourseSlugForTitle({ language: suggestion.language, title: suggestion.title });
  const normalizedTitle = normalizeString(suggestion.title);

  return prisma.course.create({
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
}

/**
 * Loads the course that won a concurrent insert for the same organization slug.
 * If the unique error was for a different constraint or the winning row is not
 * visible yet, rethrow the original error so Workflow can retry the step.
 */
async function getRecoveredCourse({
  error,
  organizationId,
  slug,
}: {
  error: unknown;
  organizationId: string;
  slug: string;
}) {
  if (!isPrismaUniqueConstraintError(error)) {
    throw error;
  }

  const course = await prisma.course.findUnique({
    include: courseContentInclude,
    where: { orgSlug: { organizationId, slug } },
  });

  if (!course) {
    throw error;
  }

  return course;
}

/**
 * Creates the course when this workflow wins the insert race, or returns the
 * existing course that another workflow already created for the same unique
 * organization slug. This keeps duplicate starts idempotent at the database
 * boundary instead of treating a valid race as a terminal failure.
 */
async function createOrRecoverCourse({
  organizationId,
  suggestion,
  workflowRunId,
}: {
  organizationId: string;
  suggestion: CourseSuggestion;
  workflowRunId: string;
}): Promise<InitializedCourse> {
  const slug = getCourseSlugForTitle({ language: suggestion.language, title: suggestion.title });

  try {
    const course = await createCourseEntity({ organizationId, suggestion, workflowRunId });

    await updateCourseSuggestionToRunning({
      courseId: course.id,
      suggestionId: suggestion.id,
      workflowRunId,
    });

    return {
      course: getCourseContext({ course, organizationId, suggestion }),
      existing: null,
      generationStatus: course.generationStatus,
    };
  } catch (error) {
    const course = await getRecoveredCourse({ error, organizationId, slug });

    await updateCourseSuggestionForRecoveredCourse({
      courseId: course.id,
      generationStatus: course.generationStatus,
      suggestionId: suggestion.id,
      workflowRunId,
    });

    return {
      course: getCourseContext({ course, organizationId, suggestion }),
      existing: getExistingCourseContent(course),
      generationStatus: course.generationStatus,
    };
  }
}

/**
 * Initializes the course target for a suggestion. The normal path creates the
 * course and links the suggestion; the duplicate-start path links to the row
 * that won the unique slug race so the workflow can stop or resume based on
 * that course's current generation status.
 */
export async function initializeCourseStep(input: {
  suggestion: CourseSuggestion;
  workflowRunId: string;
}): Promise<InitializedCourse> {
  "use step";

  await using stream = createStepStream<CourseWorkflowStepName>();

  await stream.status({ status: "started", step: "initializeCourse" });

  const { suggestion, workflowRunId } = input;

  const aiOrg = await prisma.organization.findUniqueOrThrow({ where: { slug: AI_ORG_SLUG } });

  const course = await createOrRecoverCourse({
    organizationId: aiOrg.id,
    suggestion,
    workflowRunId,
  });

  await stream.status({ status: "completed", step: "initializeCourse" });

  return course;
}

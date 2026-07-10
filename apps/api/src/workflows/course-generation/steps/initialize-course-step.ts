import { createStepStream } from "@/workflows/_shared/stream-status";
import { getCourseSlugForTitle } from "@zoonk/core/courses/slug";
import { type CourseWorkflowStepName } from "@zoonk/core/workflows/steps";
import {
  type Course,
  type TransactionClient,
  isPrismaUniqueConstraintError,
  prisma,
} from "@zoonk/db";
import { AI_ORG_SLUG } from "@zoonk/utils/org";
import { normalizeString } from "@zoonk/utils/string";
import { FatalError } from "workflow";
import {
  type ExistingCourseContent,
  courseContentInclude,
  getExistingCourseContent,
} from "../_internal/existing-course-content";
import { assertCourseMatchesPromptIdentity } from "../_utils/course-identity-validation";
import { type GeneratableCoursePrompt } from "./get-course-prompt-step";

type CourseContextBase = {
  courseId: string;
  courseSlug: string;
  courseTitle: string;
  language: string;
  organizationId: string;
};

export type CourseContext =
  | (CourseContextBase & { format: "core"; targetLanguage: null })
  | (CourseContextBase & { format: "language"; targetLanguage: string });

export type InitializedCourse = { course: CourseContext; existing: ExistingCourseContent | null };

/**
 * Converts a persisted course row into the stable workflow context shape.
 * The prompt title and language remain the learner-facing request while the
 * persisted course owns the generation format and its dependent target.
 */
export function getCourseContext({
  course,
  organizationId,
  prompt,
}: {
  course: Pick<Course, "format" | "id" | "language" | "slug" | "targetLanguage">;
  organizationId: string;
  prompt: GeneratableCoursePrompt;
}): CourseContext {
  assertCourseMatchesPromptIdentity({ course, prompt });

  const context = {
    courseId: course.id,
    courseSlug: course.slug,
    courseTitle: prompt.canonicalTitle,
    language: prompt.language,
    organizationId,
  };

  if (course.format === "core" && course.targetLanguage === null) {
    return { ...context, format: "core", targetLanguage: null };
  }

  if (
    course.format === "language" &&
    course.targetLanguage &&
    course.targetLanguage !== course.language
  ) {
    return { ...context, format: "language", targetLanguage: course.targetLanguage };
  }

  throw new FatalError("Course format does not match its language configuration");
}

/**
 * Creates the course entity in the database.
 * This is a pure save step — one DB operation.
 */
async function createCourseEntity({
  organizationId,
  prompt,
  transaction,
  workflowRunId,
}: {
  organizationId: string;
  prompt: GeneratableCoursePrompt;
  transaction: TransactionClient;
  workflowRunId: string;
}): Promise<Course> {
  const slug = getCourseSlugForTitle({ language: prompt.language, title: prompt.canonicalTitle });
  const normalizedTitle = normalizeString(prompt.canonicalTitle);

  return transaction.course.create({
    data: {
      format: prompt.courseFormat,
      generationRunId: workflowRunId,
      generationStatus: "running",
      isPublished: true,
      language: prompt.language,
      normalizedTitle,
      organizationId,
      slug,
      targetLanguage: prompt.targetLanguage,
      title: prompt.canonicalTitle,
    },
  });
}

/**
 * Runs course creation and prompt linking atomically so Workflow can safely
 * retry after a database or response failure without leaving partial state.
 */
async function createCourseAndLinkPrompt({
  organizationId,
  prompt,
  workflowRunId,
}: {
  organizationId: string;
  prompt: GeneratableCoursePrompt;
  workflowRunId: string;
}): Promise<Course> {
  return prisma.$transaction(async (transaction) => {
    const course = await createCourseEntity({ organizationId, prompt, transaction, workflowRunId });

    await transaction.coursePrompt.update({
      data: { courseId: course.id, generationRunId: workflowRunId, generationStatus: "running" },
      where: { id: prompt.id },
    });

    return course;
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
  prompt,
  slug,
}: {
  error: unknown;
  organizationId: string;
  prompt: GeneratableCoursePrompt;
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

  assertCourseMatchesPromptIdentity({ course, prompt });

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
  prompt,
  workflowRunId,
}: {
  organizationId: string;
  prompt: GeneratableCoursePrompt;
  workflowRunId: string;
}): Promise<InitializedCourse> {
  const slug = getCourseSlugForTitle({ language: prompt.language, title: prompt.canonicalTitle });

  try {
    const course = await createCourseAndLinkPrompt({ organizationId, prompt, workflowRunId });

    return { course: getCourseContext({ course, organizationId, prompt }), existing: null };
  } catch (error) {
    const course = await getRecoveredCourse({ error, organizationId, prompt, slug });

    return {
      course: getCourseContext({ course, organizationId, prompt }),
      existing: getExistingCourseContent(course),
    };
  }
}

/**
 * Initializes the course target for a prompt. The normal path creates and
 * links the course atomically. The duplicate-start path only returns the row
 * that won the unique slug race; the next step locks that row before it links
 * the prompt and decides whether this workflow can resume generation.
 */
export async function initializeCourseStep(input: {
  request: GeneratableCoursePrompt;
  workflowRunId: string;
}): Promise<InitializedCourse> {
  "use step";

  await using stream = createStepStream<CourseWorkflowStepName>();

  await stream.status({ status: "started", step: "initializeCourse" });

  const { request, workflowRunId } = input;

  const aiOrg = await prisma.organization.findUniqueOrThrow({ where: { slug: AI_ORG_SLUG } });

  const course = await createOrRecoverCourse({
    organizationId: aiOrg.id,
    prompt: request,
    workflowRunId,
  });

  await stream.status({ status: "completed", step: "initializeCourse" });

  return course;
}

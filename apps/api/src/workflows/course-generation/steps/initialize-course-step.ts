import { createStepStream } from "@/workflows/_shared/stream-status";
import { getCourseEditionForPrompt } from "@zoonk/core/courses/edition-link";
import {
  type RegularCourseFormat,
  isRegularCourseFormat,
} from "@zoonk/core/courses/prompt-generation";
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

export type RegularCourseContext = CourseContextBase & {
  format: RegularCourseFormat;
  targetLanguage: null;
};

export type CourseContext =
  | RegularCourseContext
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

  if (isRegularCourseFormat(course.format) && course.targetLanguage === null) {
    return { ...context, format: course.format, targetLanguage: null };
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
  familyId,
  organizationId,
  prompt,
  transaction,
  workflowRunId,
}: {
  familyId: string | null;
  organizationId: string;
  prompt: GeneratableCoursePrompt;
  transaction: TransactionClient;
  workflowRunId: string;
}): Promise<Course> {
  const slug = getCourseSlugForTitle({ language: prompt.language, title: prompt.canonicalTitle });
  const normalizedTitle = normalizeString(prompt.canonicalTitle);

  return transaction.course.create({
    data: {
      familyId,
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
 * Claims the family edition before creating a localized course. Titles can
 * differ between equivalent requests, so the existing slug constraint alone
 * cannot prevent two requests from generating different editions together.
 */
async function createCourseAndLinkPrompt({
  organizationId,
  prompt,
  workflowRunId,
}: {
  organizationId: string;
  prompt: GeneratableCoursePrompt;
  workflowRunId: string;
}): Promise<InitializedCourse> {
  return prisma.$transaction(async (transaction) => {
    const edition = await getCourseEditionForPrompt({ coursePromptId: prompt.id, transaction });

    if (edition?.course) {
      const course = await transaction.course.findUniqueOrThrow({
        include: courseContentInclude,
        where: { id: edition.course.id },
      });

      return {
        course: getCourseContext({ course, organizationId, prompt }),
        existing: getExistingCourseContent(course),
      };
    }

    const course = await createCourseEntity({
      familyId: edition?.familyId ?? null,
      organizationId,
      prompt,
      transaction,
      workflowRunId,
    });

    await transaction.coursePrompt.update({
      data: { courseId: course.id, generationRunId: workflowRunId, generationStatus: "running" },
      where: { id: prompt.id },
    });

    return { course: getCourseContext({ course, organizationId, prompt }), existing: null };
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

  // A hidden row can still reserve its slug. Do not expose it or publish it
  // implicitly when the public identity search correctly ignored it.
  if (!course.isPublished) {
    throw new FatalError("Course is not published");
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
    return await createCourseAndLinkPrompt({ organizationId, prompt, workflowRunId });
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

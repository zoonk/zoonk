import { serializeWorkflowError } from "@/workflows/_shared/workflow-error";
import { chapterGenerationWorkflow } from "@/workflows/chapter-generation/chapter-generation-workflow";
import { type Chapter, type Course } from "@zoonk/db";
import { logError } from "@zoonk/utils/logger";
import { getWorkflowMetadata } from "workflow";
import { getOrCreateCourse } from "./_internal/get-or-create-course";
import { setupCourse } from "./_internal/setup-course";
import { completeCourseSetupStep } from "./steps/complete-course-setup-step";
import { assertGeneratableCoursePrompt, getCoursePromptStep } from "./steps/get-course-prompt-step";
import { handleCourseFailureStep } from "./steps/handle-failure-step";
import { resolveCourseIdentityStep } from "./steps/resolve-course-identity-step";
import { startChapterImagesWorkflowStep } from "./steps/start-chapter-images-workflow-step";

/**
 * Runs course setup through final persistence and only then marks the course
 * complete. The returned chapters are the lesson-generation targets; the
 * thumbnail workflow loads the current saved chapter list by course id.
 */
async function setupCourseContent({
  course,
  description,
  coursePromptId,
  existing,
  workflowRunId,
}: {
  course: Awaited<ReturnType<typeof getOrCreateCourse>>["course"];
  description: string | null;
  coursePromptId: string;
  existing: Awaited<ReturnType<typeof getOrCreateCourse>>["existing"];
  workflowRunId: string;
}): Promise<Chapter[]> {
  const chapters = await setupCourse(course, description, existing);

  await completeCourseSetupStep({
    courseId: course.courseId,
    coursePromptId,
    courseSlug: course.courseSlug,
    workflowRunId,
  });

  return chapters;
}

/**
 * Starts optional chapter thumbnail generation without letting artwork setup
 * failures change the already-completed course status.
 */
async function startChapterImagesWithoutFailingCourse(courseId: string): Promise<void> {
  await startChapterImagesWorkflowStep({ courseId }).catch((error: unknown) => {
    logError("Chapter image workflow failed to start after course setup completed", error);
  });
}

/**
 * Starts the optional image workflow for every course and generates the first
 * chapter only for language courses. Core courses already generate their
 * introduction lessons during setup, so they no longer need another chapter
 * workflow to start automatically.
 */
async function startChapterImagesAndGenerateFirstLanguageChapter({
  chapters,
  courseId,
  format,
}: {
  chapters: Chapter[];
  courseId: string;
  format: Course["format"];
}): Promise<void> {
  const firstLanguageChapter = format === "language" ? chapters[0] : null;

  const [, chapterResult] = await Promise.allSettled([
    startChapterImagesWithoutFailingCourse(courseId),
    firstLanguageChapter ? chapterGenerationWorkflow(firstLanguageChapter.id) : Promise.resolve(),
  ]);

  if (chapterResult.status === "rejected") {
    throw chapterResult.reason;
  }
}

export async function courseGenerationWorkflow(coursePromptId: string): Promise<void> {
  "use workflow";

  const { workflowRunId } = getWorkflowMetadata();

  const prompt = await getCoursePromptStep(coursePromptId);

  assertGeneratableCoursePrompt(prompt);

  const existingCourse = await resolveCourseIdentityStep(prompt);

  const courseSetup = await getOrCreateCourse({
    coursePromptId,
    existingCourse,
    prompt,
    workflowRunId,
  }).catch(async (error: unknown) => {
    await handleCourseFailureStep({
      courseId: null,
      coursePromptId,
      error: serializeWorkflowError(error),
      workflowRunId,
    });

    logError(`[workflow ${workflowRunId}] Course initialization failed`, error);

    throw error;
  });

  if (courseSetup.status === "running") {
    return;
  }

  if (courseSetup.status === "completed") {
    await completeCourseSetupStep({
      courseId: courseSetup.course.courseId,
      coursePromptId,
      courseSlug: courseSetup.course.courseSlug,
      workflowRunId,
    });

    return;
  }

  const chapters = await setupCourseContent({
    course: courseSetup.course,
    coursePromptId,
    description: null,
    existing: courseSetup.existing,
    workflowRunId,
  }).catch(async (error: unknown) => {
    await handleCourseFailureStep({
      courseId: courseSetup.course.courseId,
      coursePromptId,
      error: serializeWorkflowError(error),
      workflowRunId,
    });

    logError(`[workflow ${workflowRunId}] Course generation failed`, error);

    throw error;
  });

  // Start post-setup workflows outside the course error handling.
  // Language chapter generation has its own error handling that marks the chapter as failed.
  // We don't want chapter failures to mark the entire course as failed.
  await startChapterImagesAndGenerateFirstLanguageChapter({
    chapters,
    courseId: courseSetup.course.courseId,
    format: courseSetup.course.format,
  });
}

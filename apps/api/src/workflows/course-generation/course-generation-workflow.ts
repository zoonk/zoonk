import { streamSkipStep } from "@/workflows/_shared/stream-skip-step";
import { serializeWorkflowError } from "@/workflows/_shared/workflow-error";
import { chapterGenerationWorkflow } from "@/workflows/chapter-generation/chapter-generation-workflow";
import { COURSE_COMPLETION_STEP } from "@zoonk/core/workflows/steps";
import { type Chapter } from "@zoonk/db";
import { logError } from "@zoonk/utils/logger";
import { getWorkflowMetadata } from "workflow";
import { getOrCreateCourse } from "./_internal/get-or-create-course";
import { setupCourse } from "./_internal/setup-course";
import { completeCourseSetupStep } from "./steps/complete-course-setup-step";
import {
  assertGeneratableCourseStartRequest,
  getCourseStartRequestStep,
} from "./steps/get-course-start-request-step";
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
  courseStartRequestId,
  existing,
}: {
  course: Awaited<ReturnType<typeof getOrCreateCourse>>["course"];
  description: string | null;
  courseStartRequestId: string;
  existing: Awaited<ReturnType<typeof getOrCreateCourse>>["existing"];
}): Promise<Chapter[]> {
  const chapters = await setupCourse(course, description, existing);

  await completeCourseSetupStep({
    courseId: course.courseId,
    courseSlug: course.courseSlug,
    courseStartRequestId,
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
 * Starts the optional image workflow while the first chapter workflow runs.
 * The image path only waits for the child workflow to be enqueued, not for the
 * background artwork generation to complete.
 */
async function generateFirstChapterAndStartChapterImages({
  chapters,
  courseId,
}: {
  chapters: Chapter[];
  courseId: string;
}): Promise<void> {
  const firstChapter = chapters[0];

  const [, chapterResult] = await Promise.allSettled([
    startChapterImagesWithoutFailingCourse(courseId),
    firstChapter ? chapterGenerationWorkflow(firstChapter.id) : Promise.resolve(),
  ]);

  if (chapterResult.status === "rejected") {
    throw chapterResult.reason;
  }
}

export async function courseGenerationWorkflow(courseStartRequestId: string): Promise<void> {
  "use workflow";

  const { workflowRunId } = getWorkflowMetadata();

  const request = await getCourseStartRequestStep(courseStartRequestId);

  assertGeneratableCourseStartRequest(request);

  // Skip if actively running to avoid conflicts with another workflow instance.
  if (request.generationStatus === "running") {
    return;
  }

  // Already completed — stream the completion step so the client can redirect.
  if (request.generationStatus === "completed") {
    await streamSkipStep(COURSE_COMPLETION_STEP);
    return;
  }

  const existingCourse = await resolveCourseIdentityStep(request);

  // Skip running courses to avoid conflicts with another workflow instance.
  if (existingCourse?.generationStatus === "running") {
    return;
  }

  // Already completed — stream the completion step so the client can redirect.
  if (existingCourse?.generationStatus === "completed") {
    await completeCourseSetupStep({
      courseId: existingCourse.id,
      courseSlug: existingCourse.slug,
      courseStartRequestId,
    });

    return;
  }

  const courseSetup = await getOrCreateCourse(
    existingCourse,
    request,
    courseStartRequestId,
    workflowRunId,
  ).catch(async (error: unknown) => {
    await handleCourseFailureStep({
      courseId: existingCourse?.id ?? null,
      courseStartRequestId,
      error: serializeWorkflowError(error),
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
      courseSlug: courseSetup.course.courseSlug,
      courseStartRequestId,
    });

    return;
  }

  const chapters = await setupCourseContent({
    course: courseSetup.course,
    courseStartRequestId,
    description: null,
    existing: courseSetup.existing,
  }).catch(async (error: unknown) => {
    await handleCourseFailureStep({
      courseId: courseSetup.course.courseId,
      courseStartRequestId,
      error: serializeWorkflowError(error),
    });

    logError(`[workflow ${workflowRunId}] Course generation failed`, error);

    throw error;
  });

  // Start chapter generation outside the course error handling.
  // Chapter generation has its own error handling that marks the chapter as failed.
  // We don't want chapter failures to mark the entire course as failed.
  await generateFirstChapterAndStartChapterImages({
    chapters,
    courseId: courseSetup.course.courseId,
  });
}

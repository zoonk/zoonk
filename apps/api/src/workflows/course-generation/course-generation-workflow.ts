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
import { type ChapterImageInput } from "./steps/generate-chapter-image-step";
import { getCourseSuggestionStep } from "./steps/get-course-suggestion-step";
import { handleCourseFailureStep } from "./steps/handle-failure-step";
import { resolveCourseIdentityStep } from "./steps/resolve-course-identity-step";
import { startChapterImagesWorkflowStep } from "./steps/start-chapter-images-workflow-step";

/**
 * Runs course setup through final persistence and only then marks the course
 * complete. Chapter generation owns chapter-specific content such as
 * thumbnails, so this course setup step only saves course-level metadata and
 * chapter shells.
 */
async function setupCourseContent({
  course,
  description,
  courseSuggestionId,
  existing,
}: {
  course: Awaited<ReturnType<typeof getOrCreateCourse>>["course"];
  description: string | null;
  courseSuggestionId: string;
  existing: Awaited<ReturnType<typeof getOrCreateCourse>>["existing"];
}): Promise<Chapter[]> {
  const chapters = await setupCourse(course, description, existing);

  await completeCourseSetupStep({
    courseId: course.courseId,
    courseSlug: course.courseSlug,
    courseSuggestionId,
  });

  return chapters;
}

/**
 * Narrows a chapter row to the fields the background image workflow needs.
 * Passing the smaller shape keeps the child workflow argument stable and avoids
 * serializing unrelated chapter metadata.
 */
function getChapterImageInput(chapter: Chapter): ChapterImageInput {
  return {
    description: chapter.description,
    id: chapter.id,
    imageUrl: chapter.imageUrl,
    title: chapter.title,
  };
}

/**
 * Starts optional chapter thumbnail generation without letting artwork setup
 * failures change the already-completed course status.
 */
async function startChapterImagesWithoutFailingCourse(chapters: Chapter[]): Promise<void> {
  await startChapterImagesWorkflowStep({
    chapters: chapters.map((chapter) => getChapterImageInput(chapter)),
  }).catch((error: unknown) => {
    logError("Chapter image workflow failed to start after course setup completed", error);
  });
}

/**
 * Starts the optional image workflow while the first chapter workflow runs.
 * The image path only waits for the child workflow to be enqueued, not for the
 * background artwork generation to complete.
 */
async function generateFirstChapterAndStartChapterImages(chapters: Chapter[]): Promise<void> {
  const firstChapter = chapters[0];

  const [, chapterResult] = await Promise.allSettled([
    startChapterImagesWithoutFailingCourse(chapters),
    firstChapter ? chapterGenerationWorkflow(firstChapter.id) : Promise.resolve(),
  ]);

  if (chapterResult.status === "rejected") {
    throw chapterResult.reason;
  }
}

export async function courseGenerationWorkflow(courseSuggestionId: string): Promise<void> {
  "use workflow";

  const { workflowRunId } = getWorkflowMetadata();

  const suggestion = await getCourseSuggestionStep(courseSuggestionId);

  // Skip if actively running to avoid conflicts with another workflow instance.
  if (suggestion.generationStatus === "running") {
    return;
  }

  // Already completed — stream the completion step so the client can redirect.
  if (suggestion.generationStatus === "completed") {
    await streamSkipStep(COURSE_COMPLETION_STEP);
    return;
  }

  const existingCourse = await resolveCourseIdentityStep(suggestion);

  // Skip running courses to avoid conflicts with another workflow instance.
  if (existingCourse?.generationStatus === "running") {
    return;
  }

  // Already completed — stream the completion step so the client can redirect.
  if (existingCourse?.generationStatus === "completed") {
    await completeCourseSetupStep({
      courseId: existingCourse.id,
      courseSlug: existingCourse.slug,
      courseSuggestionId,
    });

    return;
  }

  const courseSetup = await getOrCreateCourse(
    existingCourse,
    suggestion,
    courseSuggestionId,
    workflowRunId,
  ).catch(async (error: unknown) => {
    await handleCourseFailureStep({
      courseId: existingCourse?.id ?? null,
      courseSuggestionId,
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
      courseSuggestionId,
    });

    return;
  }

  const chapters = await setupCourseContent({
    course: courseSetup.course,
    courseSuggestionId,
    description: suggestion.description,
    existing: courseSetup.existing,
  }).catch(async (error: unknown) => {
    await handleCourseFailureStep({
      courseId: courseSetup.course.courseId,
      courseSuggestionId,
      error: serializeWorkflowError(error),
    });

    logError(`[workflow ${workflowRunId}] Course generation failed`, error);

    throw error;
  });

  // Start chapter generation outside the course error handling.
  // Chapter generation has its own error handling that marks the chapter as failed.
  // We don't want chapter failures to mark the entire course as failed.
  await generateFirstChapterAndStartChapterImages(chapters);
}

import { serializeWorkflowError } from "@/workflows/_shared/workflow-error";
import { type Chapter } from "@zoonk/db";
import { logError } from "@zoonk/utils/logger";
import { getWorkflowMetadata } from "workflow";
import { getOrCreateCourse } from "./_internal/get-or-create-course";
import { setupCourse } from "./_internal/setup-course";
import { completeCourseSetupStep } from "./steps/complete-course-setup-step";
import { enrollCourseUserStep } from "./steps/enroll-course-user-step";
import {
  type GeneratableCoursePrompt,
  assertGeneratableCoursePrompt,
  getCoursePromptStep,
} from "./steps/get-course-prompt-step";
import { handleCourseFailureStep } from "./steps/handle-failure-step";
import { linkCourseEditionStep } from "./steps/link-course-edition-step";
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
  const chapters = await setupCourse(
    { ...course, generationRunId: workflowRunId },
    description,
    existing,
  );

  await completeCourseSetupStep({
    courseId: course.courseId,
    coursePromptId,
    courseSlug: course.courseSlug,
    workflowRunId,
  });

  return chapters;
}

/**
 * Starts required chapter thumbnail generation without letting artwork setup
 * failures change the already-completed course status.
 */
async function startChapterImagesWithoutFailingCourse(courseId: string): Promise<void> {
  await startChapterImagesWorkflowStep({ courseId }).catch((error: unknown) => {
    logError("Chapter image workflow failed to start after course setup completed", error);
  });
}

/** Keeps identity validation failures inside the same retryable initialization outcome. */
async function prepareCourseForPrompt({
  coursePromptId,
  prompt,
  workflowRunId,
}: {
  coursePromptId: string;
  prompt: GeneratableCoursePrompt;
  workflowRunId: string;
}) {
  const existingCourse = await resolveCourseIdentityStep(prompt);
  return getOrCreateCourse({ coursePromptId, existingCourse, prompt, workflowRunId });
}

/**
 * Generates or resumes a course and enrolls the authenticated requester once
 * the workflow resolves the concrete course. Enrollment runs before completed
 * or running courses return so reused courses are added to the learner's
 * library too.
 */
export async function courseGenerationWorkflow({
  coursePromptId,
  userId,
}: {
  coursePromptId: string;
  userId: string | null;
}): Promise<void> {
  "use workflow";

  const { workflowRunId } = getWorkflowMetadata();

  const prompt = await getCoursePromptStep(coursePromptId);

  assertGeneratableCoursePrompt(prompt);

  const courseSetup = await prepareCourseForPrompt({ coursePromptId, prompt, workflowRunId }).catch(
    async (error: unknown) => {
      await handleCourseFailureStep({
        courseId: null,
        coursePromptId,
        error: serializeWorkflowError(error),
        workflowRunId,
      });

      logError(`[workflow ${workflowRunId}] Course initialization failed`, error);

      throw error;
    },
  );

  await linkCourseEditionStep({ courseId: courseSetup.course.courseId, coursePromptId }).catch(
    async (error: unknown) => {
      await handleCourseFailureStep({
        courseId: courseSetup.course.courseId,
        coursePromptId,
        error: serializeWorkflowError(error),
        workflowRunId,
      });

      logError(`[workflow ${workflowRunId}] Course edition linking failed`, error);

      throw error;
    },
  );

  if (userId) {
    await enrollCourseUserStep({ courseId: courseSetup.course.courseId, userId });
  }

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

  await setupCourseContent({
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

  // Artwork retries must not change the completed curriculum's status.
  await startChapterImagesWithoutFailingCourse(courseSetup.course.courseId);
}

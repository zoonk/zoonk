import { streamSkipStep } from "@/workflows/_shared/stream-skip-step";
import { getAIOrganizationStep } from "../steps/get-ai-organization-step";
import { type GeneratableCoursePrompt } from "../steps/get-course-prompt-step";
import {
  type CourseContext,
  type InitializedCourse,
  getCourseContext,
  initializeCourseStep,
} from "../steps/initialize-course-step";
import { type ExistingCourse } from "../steps/resolve-course-identity-step";
import {
  type CourseSetupStatus,
  setCourseAsRunningStep,
} from "../steps/set-course-as-running-step";
import {
  EMPTY_EXISTING_CONTENT,
  type ExistingCourseContent,
  getExistingCourseContent,
} from "./existing-course-content";

export type GetOrCreateCourseResult = {
  course: CourseContext;
  existing: ExistingCourseContent;
  status: CourseSetupStatus;
};

/**
 * Atomically claims reusable existing courses from their current database
 * state. The identity resolver snapshot is intentionally not trusted for run
 * ownership because another workflow may have claimed it after that read.
 */
async function prepareExistingCourse({
  course,
  coursePromptId,
  existing,
  workflowRunId,
}: {
  course: CourseContext;
  coursePromptId: string;
  existing: ExistingCourseContent;
  workflowRunId: string;
}): Promise<GetOrCreateCourseResult> {
  const status = await setCourseAsRunningStep({
    courseId: course.courseId,
    coursePromptId,
    workflowRunId,
  });

  return { course, existing, status };
}

/**
 * Converts the initialize step result into the caller's setup plan. A recovered
 * existing course can be running or completed, so creation recovery must go
 * through the same status gate as a resolver-found existing course.
 */
async function prepareInitializedCourse({
  coursePromptId,
  initialized,
  workflowRunId,
}: {
  coursePromptId: string;
  initialized: InitializedCourse;
  workflowRunId: string;
}): Promise<GetOrCreateCourseResult> {
  if (!initialized.existing) {
    await streamSkipStep("setCourseAsRunning");
    return { course: initialized.course, existing: EMPTY_EXISTING_CONTENT, status: "ready" };
  }

  return prepareExistingCourse({
    course: initialized.course,
    coursePromptId,
    existing: initialized.existing,
    workflowRunId,
  });
}

/**
 * Produces the course setup plan after identity resolution. It creates a new
 * course when possible, recovers from concurrent unique-key inserts, and tells
 * the workflow to stop when another run already owns the same course.
 */
export async function getOrCreateCourse({
  coursePromptId,
  existingCourse,
  prompt,
  workflowRunId,
}: {
  coursePromptId: string;
  existingCourse: ExistingCourse | null;
  prompt: GeneratableCoursePrompt;
  workflowRunId: string;
}): Promise<GetOrCreateCourseResult> {
  if (!existingCourse) {
    const initialized = await initializeCourseStep({ request: prompt, workflowRunId });
    return prepareInitializedCourse({ coursePromptId, initialized, workflowRunId });
  }

  await streamSkipStep("initializeCourse");
  const aiOrg = await getAIOrganizationStep();

  return prepareExistingCourse({
    course: getCourseContext({ course: existingCourse, organizationId: aiOrg.id, prompt }),
    coursePromptId,
    existing: getExistingCourseContent(existingCourse),
    workflowRunId,
  });
}

import { streamSkipStep } from "@/workflows/_shared/stream-skip-step";
import { type Course } from "@zoonk/db";
import { getAIOrganizationStep } from "../steps/get-ai-organization-step";
import { type GeneratableCourseStartRequest } from "../steps/get-course-start-request-step";
import {
  type CourseContext,
  type InitializedCourse,
  getCourseContext,
  initializeCourseStep,
} from "../steps/initialize-course-step";
import { type ExistingCourse } from "../steps/resolve-course-identity-step";
import { setCourseAsRunningStep } from "../steps/set-course-as-running-step";
import {
  EMPTY_EXISTING_CONTENT,
  type ExistingCourseContent,
  getExistingCourseContent,
} from "./existing-course-content";

type CourseSetupStatus = "completed" | "ready" | "running";

export type GetOrCreateCourseResult = {
  course: CourseContext;
  existing: ExistingCourseContent;
  status: CourseSetupStatus;
};

/**
 * Only failed or pending existing courses need this workflow to continue setup.
 * Running and completed courses already have another run or a finished result,
 * so the caller should stop after linking the request.
 */
function getCourseSetupStatus(generationStatus: Course["generationStatus"]): CourseSetupStatus {
  if (generationStatus === "running") {
    return "running";
  }

  if (generationStatus === "completed") {
    return "completed";
  }

  return "ready";
}

/**
 * Starts generation for reusable existing courses, or reports that setup should
 * stop because a concurrent run is already responsible for this course.
 */
async function prepareExistingCourse({
  course,
  courseStartRequestId,
  existing,
  generationStatus,
  workflowRunId,
}: {
  course: CourseContext;
  courseStartRequestId: string;
  existing: ExistingCourseContent;
  generationStatus: Course["generationStatus"];
  workflowRunId: string;
}): Promise<GetOrCreateCourseResult> {
  const status = getCourseSetupStatus(generationStatus);

  if (status !== "ready") {
    await streamSkipStep("setCourseAsRunning");
    return { course, existing, status };
  }

  await setCourseAsRunningStep({ courseId: course.courseId, courseStartRequestId, workflowRunId });

  return { course, existing, status: "ready" };
}

/**
 * Converts the initialize step result into the caller's setup plan. A recovered
 * existing course can be running or completed, so creation recovery must go
 * through the same status gate as a resolver-found existing course.
 */
async function prepareInitializedCourse({
  courseStartRequestId,
  initialized,
  workflowRunId,
}: {
  courseStartRequestId: string;
  initialized: InitializedCourse;
  workflowRunId: string;
}): Promise<GetOrCreateCourseResult> {
  if (!initialized.existing) {
    await streamSkipStep("setCourseAsRunning");
    return { course: initialized.course, existing: EMPTY_EXISTING_CONTENT, status: "ready" };
  }

  return prepareExistingCourse({
    course: initialized.course,
    courseStartRequestId,
    existing: initialized.existing,
    generationStatus: initialized.generationStatus,
    workflowRunId,
  });
}

/**
 * Produces the course setup plan after identity resolution. It creates a new
 * course when possible, recovers from concurrent unique-key inserts, and tells
 * the workflow to stop when another run already owns the same course.
 */
export async function getOrCreateCourse(
  existingCourse: ExistingCourse | null,
  request: GeneratableCourseStartRequest,
  courseStartRequestId: string,
  workflowRunId: string,
): Promise<GetOrCreateCourseResult> {
  if (!existingCourse) {
    const initialized = await initializeCourseStep({ request, workflowRunId });
    return prepareInitializedCourse({ courseStartRequestId, initialized, workflowRunId });
  }

  await streamSkipStep("initializeCourse");
  const aiOrg = await getAIOrganizationStep();

  return prepareExistingCourse({
    course: getCourseContext({ course: existingCourse, organizationId: aiOrg.id, request }),
    courseStartRequestId,
    existing: getExistingCourseContent(existingCourse),
    generationStatus: existingCourse.generationStatus,
    workflowRunId,
  });
}

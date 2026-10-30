import { getWorkflowMetadata } from "workflow";
import { type ContentAnalytics } from "../_shared/content-analytics";
import { deliverCourseContent } from "../_shared/course-content-notification";
import { claimRunToken, joinRun } from "../_shared/run-token";
import {
  drawCourseIconStep,
  saveCourseIconStep,
  writeCourseDetailsStep,
} from "./steps/course-details-steps";

export type CourseDetailsInput = {
  analytics?: ContentAnalytics;
  courseId: string;
  copyOnly?: boolean;
};

export type CourseDetailsResult = {
  details: "failed" | "skipped" | "written";
  iconUrl: string | null;
};

async function createIcon(context: CourseDetailsInput & { workflowRunId: string }) {
  const icon = await drawCourseIconStep(context);
  return deliverCourseContent(saveCourseIconStep(context, icon));
}

export async function courseDetailsWorkflow(
  input: CourseDetailsInput,
): Promise<CourseDetailsResult> {
  "use workflow";

  const { workflowRunId } = getWorkflowMetadata();
  const { conflict } = await claimRunToken(`course-details:${input.courseId}`);

  if (conflict) {
    await joinRun(conflict);
  }

  const context = {
    analytics: input.analytics,
    copyOnly: input.copyOnly,
    courseId: input.courseId,
    workflowRunId,
  };

  const [details] = await Promise.allSettled([
    deliverCourseContent(writeCourseDetailsStep(context)),
  ]);

  const [icon] = await Promise.allSettled([
    input.copyOnly ? Promise.resolve(null) : createIcon(context),
  ]);

  return {
    details: details.status === "fulfilled" ? details.value : "failed",
    iconUrl: icon.status === "fulfilled" ? icon.value : null,
  };
}

/**
 * A run of its own, not a step of the outline's: a run moves on only once the steps it runs
 * together are done, so the picture would hold the outline back.
 */
export async function courseIconWorkflow(input: CourseDetailsInput): Promise<string | null> {
  "use workflow";

  const { workflowRunId } = getWorkflowMetadata();

  const [icon] = await Promise.allSettled([createIcon({ ...input, workflowRunId })]);

  return icon.status === "fulfilled" ? icon.value : null;
}

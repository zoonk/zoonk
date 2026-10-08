import { getWorkflowMetadata } from "workflow";
import { type ContentAnalytics } from "../_shared/content-analytics";
import { claimRunToken, joinRun } from "../_shared/run-token";
import { createCourseIconStep, writeCourseDetailsStep } from "./steps/course-details-steps";

export type CourseDetailsInput = { analytics?: ContentAnalytics; courseId: string };

export type CourseDetailsResult = {
  details: "failed" | "skipped" | "written";
  iconUrl: string | null;
};

/**
 * Fills a shared course's public page once its outline exists, in the background: the
 * description, the landing copy and the categories (one model call, only for what's missing),
 * then the course's icon, which it still gets when the details failed. One run per course at a
 * time; a second one waits for the first and fills only what the first left missing.
 */
export async function courseDetailsWorkflow(
  input: CourseDetailsInput,
): Promise<CourseDetailsResult> {
  "use workflow";

  const { workflowRunId } = getWorkflowMetadata();
  const { conflict } = await claimRunToken(`course-details:${input.courseId}`);

  // However the run filling this course's details ends, this run fills whatever is still missing.
  if (conflict) {
    await joinRun(conflict);
  }

  const context = { analytics: input.analytics, courseId: input.courseId, workflowRunId };
  const [details] = await Promise.allSettled([writeCourseDetailsStep(context)]);
  const [icon] = await Promise.allSettled([createCourseIconStep(context)]);

  return {
    details: details.status === "fulfilled" ? details.value : "failed",
    iconUrl: icon.status === "fulfilled" ? icon.value : null,
  };
}

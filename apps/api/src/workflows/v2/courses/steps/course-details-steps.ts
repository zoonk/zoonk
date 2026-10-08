import { writeCourseDetails } from "@zoonk/core/library/courses/details";
import { createCourseIcon } from "@zoonk/core/library/courses/icon";
import { withAiRetry } from "../../_shared/ai-retry";
import { type ContentAnalytics, toContentAnalytics } from "../../_shared/content-analytics";

type CourseDetailsContext = {
  analytics?: ContentAnalytics;
  courseId: string;
  workflowRunId: string;
};

/** Shared courses only: their details are shared content, whoever's goal caused them. */
function toSharedAnalytics({ analytics, workflowRunId }: CourseDetailsContext) {
  return toContentAnalytics({ analytics, scope: { ownerId: null }, workflowRunId });
}

/** The description, landing copy and categories the course's page still lacks. */
export async function writeCourseDetailsStep(
  context: CourseDetailsContext,
): Promise<"skipped" | "written"> {
  "use step";

  return withAiRetry(() =>
    writeCourseDetails({ analytics: toSharedAnalytics(context), courseId: context.courseId }),
  );
}

/** The course's icon, unless it has one or shows a flag instead. */
export async function createCourseIconStep(context: CourseDetailsContext): Promise<string | null> {
  "use step";

  return withAiRetry(() =>
    createCourseIcon({ analytics: toSharedAnalytics(context), courseId: context.courseId }),
  );
}

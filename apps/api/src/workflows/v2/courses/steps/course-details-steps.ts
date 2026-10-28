import { writeCourseDetails } from "@zoonk/core/library/courses/details";
import { createCourseIcon } from "@zoonk/core/library/courses/icon";
import { withAiRetry } from "../../_shared/ai-retry";
import { type ContentAnalytics, toContentAnalytics } from "../../_shared/content-analytics";

type CourseDetailsContext = {
  analytics?: ContentAnalytics;
  courseId: string;
  copyOnly?: boolean;
  workflowRunId: string;
};

function toSharedAnalytics({ analytics, workflowRunId }: CourseDetailsContext) {
  return toContentAnalytics({ analytics, scope: { ownerId: null }, workflowRunId });
}

export async function writeCourseDetailsStep(
  context: CourseDetailsContext,
): Promise<"skipped" | "written"> {
  "use step";

  return withAiRetry(() =>
    writeCourseDetails({
      analytics: toSharedAnalytics(context),
      copyOnly: context.copyOnly,
      courseId: context.courseId,
    }),
  );
}

export async function createCourseIconStep(context: CourseDetailsContext): Promise<string | null> {
  "use step";

  return withAiRetry(() =>
    createCourseIcon({ analytics: toSharedAnalytics(context), courseId: context.courseId }),
  );
}

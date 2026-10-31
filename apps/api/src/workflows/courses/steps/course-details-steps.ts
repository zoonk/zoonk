import {
  type CourseContentWrite,
  collectCourseContentTags,
} from "@zoonk/core/cache/course-content";
import { writeCourseDetails } from "@zoonk/core/library/courses/details";
import { drawCourseIcon, saveCourseIcon } from "@zoonk/core/library/courses/icon";
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
): Promise<CourseContentWrite<"skipped" | "written">> {
  "use step";

  return collectCourseContentTags(() =>
    writeCourseDetails({
      analytics: toSharedAnalytics(context),
      copyOnly: context.copyOnly,
      courseId: context.courseId,
    }),
  );
}

export async function drawCourseIconStep(context: CourseDetailsContext) {
  "use step";
  return drawCourseIcon({ analytics: toSharedAnalytics(context), courseId: context.courseId });
}

export async function saveCourseIconStep(
  context: CourseDetailsContext,
  icon: Awaited<ReturnType<typeof drawCourseIcon>>,
): Promise<CourseContentWrite<string | null>> {
  "use step";

  return collectCourseContentTags(() => saveCourseIcon({ courseId: context.courseId, icon }));
}

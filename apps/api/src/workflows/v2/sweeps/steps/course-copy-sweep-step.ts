import { sweepCourseDetails } from "@zoonk/core/library/courses/regenerate-details";
import { listInFlightCourseDetails } from "../../courses/course-details-runs";
import { startCourseDetailsRun } from "../../courses/start-course-details-run";

/** Called only by the daily workflow behind the cron secret; reserves at most today's cap. */
export async function sweepCourseCopyStep(): Promise<number> {
  "use step";

  const result = await sweepCourseDetails({
    getInFlightCourseIds: listInFlightCourseDetails,
    startCourseDetails: (courseId) => startCourseDetailsRun({ copyOnly: true, courseId }),
  });

  return result.courseIds.length;
}

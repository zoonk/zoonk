import { enrollUserInCourse } from "@zoonk/core/courses/enroll-user";

/**
 * Enrolls the authenticated learner after the workflow has resolved a concrete
 * course. The shared operation is idempotent because workflow steps may retry.
 */
export async function enrollCourseUserStep({
  courseId,
  userId,
}: {
  courseId: string;
  userId: string;
}): Promise<void> {
  "use step";

  await enrollUserInCourse({ courseId, userId });
}

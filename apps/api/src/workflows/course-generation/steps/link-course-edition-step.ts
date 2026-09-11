import { linkCourseToEditionRequests } from "@zoonk/core/courses/edition-link";

/**
 * Links every requesting source after reuse or creation resolves the actual
 * course, including workflows that immediately join an existing active run.
 */
export async function linkCourseEditionStep({
  courseId,
  coursePromptId,
}: {
  courseId: string;
  coursePromptId: string;
}): Promise<void> {
  "use step";

  await linkCourseToEditionRequests({ courseId, coursePromptId });
}

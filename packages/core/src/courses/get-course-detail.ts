import "server-only";
import { getCourseExamDays } from "../catalog/course-exam-days";
import { getCoursePlanExample } from "../catalog/course-plan-example";
import { getCourseById } from "./get-course-by-id";

/**
 * Canonical course detail, with its public exam days when it is a published exam course, and a
 * catalog course's example plan, which its page shows; a learner's private course has none.
 */
export async function getCourseDetail({ courseId }: { courseId: string }) {
  const [course, exam] = await Promise.all([
    getCourseById({ courseId }),
    getCourseExamDays(courseId),
  ]);

  if (!course) {
    return null;
  }

  const examplePlan = course.organization ? await getCoursePlanExample(course) : null;
  return { ...course, exam, examplePlan };
}

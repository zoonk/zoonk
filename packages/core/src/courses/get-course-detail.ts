import "server-only";
import { getCourseExamDays } from "../catalog/course-exam-days";
import { getCoursePlanExample } from "../catalog/course-plan-example";
import { getCourseById } from "./get-course-by-id";
import { listPublishedCourseEditions } from "./list-published-course-editions";

export async function getCourseDetail({ courseId }: { courseId: string }) {
  const [course, exam] = await Promise.all([
    getCourseById({ courseId }),
    getCourseExamDays(courseId),
  ]);

  if (!course) {
    return null;
  }

  if (!course.organization) {
    return { ...course, editions: [], exam, examplePlan: null };
  }

  const [examplePlan, editions] = await Promise.all([
    getCoursePlanExample(course),
    listPublishedCourseEditions({ courseId }),
  ]);

  return { ...course, editions, exam, examplePlan };
}

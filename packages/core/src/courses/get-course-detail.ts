import "server-only";
import { getCourseExamDays } from "../catalog/course-exam-days";
import { getCoursePlanExample } from "../catalog/course-plan-example";
import { listCourseLevels } from "../library/courses/course-levels";
import { getLibraryCourse } from "../library/courses/get-library-course";
import { getCourseById } from "./get-course-by-id";
import { listPublishedCourseEditions } from "./list-published-course-editions";

export async function getCourseDetail({ courseId }: { courseId: string }) {
  const [course, exam, outline] = await Promise.all([
    getCourseById({ courseId }),
    getCourseExamDays(courseId),
    getLibraryCourse({ courseId }),
  ]);

  if (!course) {
    return null;
  }

  const written = outline?.levels.map((band) => band.level) ?? [];

  const levels = listCourseLevels({ format: course.format, written }).map((level) => ({
    level,
    written: written.includes(level),
  }));

  if (!course.organization) {
    return { ...course, editions: [], exam, examplePlan: null, levels };
  }

  const [examplePlan, editions] = await Promise.all([
    getCoursePlanExample(course),
    listPublishedCourseEditions({ courseId }),
  ]);

  return { ...course, editions, exam, examplePlan, levels };
}

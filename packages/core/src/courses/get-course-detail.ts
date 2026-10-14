import "server-only";
import { getCourseExamDays } from "../catalog/course-exam-days";
import { getCourseById } from "./get-course-by-id";

/** Canonical course detail, with its public exam days when it is a published exam course. */
export async function getCourseDetail({ courseId }: { courseId: string }) {
  const [course, exam] = await Promise.all([
    getCourseById({ courseId }),
    getCourseExamDays(courseId),
  ]);

  return course ? { ...course, exam } : null;
}

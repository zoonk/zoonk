import { generateCurriculumOutline } from "../_internal/generate-curriculum-outline";
import { getCurriculumCourseStep } from "./get-curriculum-course-step";
import { type CourseContext } from "./initialize-course-step";

export async function generateChaptersStep(course: CourseContext) {
  const currentCourse = await getCurriculumCourseStep(course.courseId);
  return generateCurriculumOutline(currentCourse);
}

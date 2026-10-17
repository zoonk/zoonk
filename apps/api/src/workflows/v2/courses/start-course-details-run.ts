import { start } from "workflow/api";
import { type CourseDetailsInput, courseDetailsWorkflow } from "./course-details-workflow";

/** Creation-time metadata identifies pending runs before their per-course hook is registered. */
export function startCourseDetailsRun(input: CourseDetailsInput) {
  return start(courseDetailsWorkflow, [input], { attributes: { courseId: input.courseId } });
}

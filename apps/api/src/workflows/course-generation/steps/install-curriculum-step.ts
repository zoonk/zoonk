import { CURRENT_CURRICULUM_VERSION } from "@zoonk/core/courses/learning-plan-contract";
import {
  type CourseRevisionContext,
  type PlannedCourseChapter,
  replaceCourseCurriculum,
} from "@zoonk/core/workflows/internal/course-curriculum";

export async function installCurriculumStep(input: {
  context: CourseRevisionContext;
  chapters: PlannedCourseChapter[];
}) {
  "use step";
  return replaceCourseCurriculum({ ...input, curriculumVersion: CURRENT_CURRICULUM_VERSION });
}

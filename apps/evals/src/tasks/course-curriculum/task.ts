import { type Task } from "@/lib/types";
import {
  type CourseCurriculumParams,
  generateCourseCurriculumLevel,
} from "@zoonk/ai/tasks/courses/curriculum";
import { TEST_CASES } from "./test-cases";

export const courseCurriculumTask: Task<
  CourseCurriculumParams,
  Awaited<ReturnType<typeof generateCourseCurriculumLevel>>["data"]
> = {
  description: "Generate a complete explicit course level or a focused question/private outline",
  generate: generateCourseCurriculumLevel,
  id: "course-curriculum",
  name: "Course Curriculum",
  testCases: TEST_CASES,
};

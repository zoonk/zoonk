import { type OptionalCountry, type Task } from "@/lib/types";
import {
  type CourseOutlineParams,
  generateCourseOutline,
} from "@zoonk/ai/tasks/curriculum/course-outline";
import { type CourseOutlineExpected, scoreCourseOutline } from "./scorer";
import { TEST_CASES } from "./test-cases";

type CourseOutlineOutput = Awaited<ReturnType<typeof generateCourseOutline>>["data"];

export const courseOutlineTask: Task<
  OptionalCountry<CourseOutlineParams>,
  CourseOutlineOutput,
  CourseOutlineExpected
> = {
  description:
    "Write one level band of a shared course: chapters with objectives and tools, and every lesson's title, description, can-do line, minutes and skills",
  generate: (input) => generateCourseOutline({ ...input, country: input.country ?? null }),
  id: "course-outline",
  name: "Course Outline",
  score: scoreCourseOutline,
  testCases: TEST_CASES,
};

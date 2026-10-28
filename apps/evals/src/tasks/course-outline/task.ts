import { type Task, toTokenUsage } from "@/lib/types";
import {
  type CourseOutlineParams,
  generateCourseOutline,
} from "@zoonk/ai/tasks/v2/curriculum/course-outline";
import { type CourseOutlineExpected, scoreCourseOutline } from "./scorer";
import { TEST_CASES } from "./test-cases";

type CourseOutlineOutput = Awaited<ReturnType<typeof generateCourseOutline>>["data"];

export const courseOutlineTask: Task<
  CourseOutlineParams,
  CourseOutlineOutput,
  CourseOutlineExpected
> = {
  description:
    "Write one level band of a shared course: chapters with objectives and tools, and every lesson's title, description, can-do line, minutes and skills",
  generate: async (params) => {
    const result = await generateCourseOutline(params);

    return {
      ...result,
      extraCalls: result.setAside.map(({ model, usage }) => ({
        modelId: model,
        usage: toTokenUsage(usage),
      })),
    };
  },
  id: "course-outline",
  name: "Course Outline",
  score: scoreCourseOutline,
  testCases: TEST_CASES,
};

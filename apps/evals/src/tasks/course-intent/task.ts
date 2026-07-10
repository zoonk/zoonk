import { type Task } from "@/lib/types";
import {
  type CourseIntentParams,
  type CourseIntentSchema,
  classifyCourseIntent,
} from "@zoonk/ai/tasks/courses/intent";
import { type CourseIntentExpected, scoreCourseIntent } from "./scorer";
import { TEST_CASES } from "./test-cases";

export const courseIntentTask: Task<CourseIntentParams, CourseIntentSchema, CourseIntentExpected> =
  {
    description: "Classify prompts into unsafe, exam, question, learn, or ambiguous",
    generate: classifyCourseIntent,
    id: "course-intent",
    name: "Course Intent",
    score: scoreCourseIntent,
    testCases: TEST_CASES,
  };

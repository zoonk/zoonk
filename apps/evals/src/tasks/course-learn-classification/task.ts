import { type Task } from "@/lib/types";
import {
  type CourseLearnClassificationParams,
  type CourseLearnClassificationSchema,
  classifyLearnRequest,
} from "@zoonk/ai/tasks/courses/learn-classification";
import { type CourseLearnClassificationExpected, scoreCourseLearnClassification } from "./scorer";
import { TEST_CASES } from "./test-cases";

export const courseLearnClassificationTask: Task<
  CourseLearnClassificationParams,
  CourseLearnClassificationSchema,
  CourseLearnClassificationExpected
> = {
  description: "Classify learn-flow prompts into question, course, or personalized shapes",
  generate: classifyLearnRequest,
  id: "course-learn-classification",
  name: "Course Learn Classification",
  score: scoreCourseLearnClassification,
  testCases: TEST_CASES,
};

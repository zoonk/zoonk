import { type Task } from "@/lib/types";
import {
  type CourseGoalRoutingParams,
  type CourseGoalRoutingSchema,
  routeCourseGoal,
} from "@zoonk/ai/tasks/courses/goal-routing";
import { TEST_CASES } from "./test-cases";

export const courseGoalRoutingTask: Task<CourseGoalRoutingParams, CourseGoalRoutingSchema> = {
  description: "Classify a raw learner goal before course generation",
  generate: routeCourseGoal,
  id: "course-goal-routing",
  name: "Course Goal Routing",
  testCases: TEST_CASES,
};

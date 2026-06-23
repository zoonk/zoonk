import { type Task } from "@/lib/types";
import {
  type CourseRequestRoutingParams,
  type CourseRequestRoutingSchema,
  routeCourseRequest,
} from "@zoonk/ai/tasks/courses/request-routing";
import { type CourseRequestRoutingExpected, scoreCourseRequestRouting } from "./scorer";
import { TEST_CASES } from "./test-cases";

export const courseRequestRoutingTask: Task<
  CourseRequestRoutingParams,
  CourseRequestRoutingSchema,
  CourseRequestRoutingExpected
> = {
  description: "Route course start prompts into unsafe, language, exam, or learn flow",
  generate: routeCourseRequest,
  id: "course-request-routing",
  name: "Course Request Routing",
  score: scoreCourseRequestRouting,
  testCases: TEST_CASES,
};

import { type Task } from "@/lib/types";
import {
  type LessonCustomActivitiesParams,
  type LessonCustomActivitiesSchema,
  generateLessonCustomActivities,
} from "@zoonk/ai/tasks/lessons/custom-activities";
import { TEST_CASES } from "./test-cases";

export const lessonCustomActivitiesTask: Task<
  LessonCustomActivitiesParams,
  LessonCustomActivitiesSchema
> = {
  description:
    "Generate a list of activities for custom lessons (tutorials, guides, how-to content)",
  generate: generateLessonCustomActivities,
  id: "lesson-custom-activities",
  name: "Custom Lesson Activities",
  testCases: TEST_CASES,
};

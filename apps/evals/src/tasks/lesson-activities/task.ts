import {
  generateLessonActivities,
  type LessonActivitiesParams,
  type LessonActivitiesSchema,
} from "@zoonk/ai/lesson-activities/generate";
import type { Task } from "@/lib/types";
import { TEST_CASES } from "./test-cases";

export const lessonActivitiesTask: Task<
  LessonActivitiesParams,
  LessonActivitiesSchema
> = {
  description:
    "Generate a list of activities for custom lessons (tutorials, guides, how-to content)",
  generate: generateLessonActivities,
  id: "lesson-activities",
  name: "Lesson Activities",
  testCases: TEST_CASES,
};

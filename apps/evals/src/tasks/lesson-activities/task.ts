import {
  generateLessonActivities,
  type LessonActivitiesParams,
  type LessonActivitiesSchema,
} from "@zoonk/ai/tasks/lessons/activities";
import { TEST_CASES } from "./test-cases";
import type { Task } from "@/lib/types";

export const lessonActivitiesTask: Task<LessonActivitiesParams, LessonActivitiesSchema> = {
  description:
    "Generate a list of activities for custom lessons (tutorials, guides, how-to content)",
  generate: generateLessonActivities,
  id: "lesson-activities",
  name: "Lesson Activities",
  testCases: TEST_CASES,
};

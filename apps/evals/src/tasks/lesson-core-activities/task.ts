import { type Task } from "@/lib/types";
import {
  type LessonCoreActivitiesParams,
  type LessonCoreActivitiesSchema,
  generateLessonCoreActivities,
} from "@zoonk/ai/tasks/lessons/core-activities";
import { TEST_CASES } from "./test-cases";

export const lessonCoreActivitiesTask: Task<
  LessonCoreActivitiesParams,
  LessonCoreActivitiesSchema
> = {
  description: "Generate practical explanation activity titles and goals for core lessons",
  generate: generateLessonCoreActivities,
  id: "lesson-core-activities",
  name: "Core Lesson Activities",
  testCases: TEST_CASES,
};

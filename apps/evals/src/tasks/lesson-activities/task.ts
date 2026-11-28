import { type Task } from "@/lib/types";
import { applyLessonActivityPlan } from "@zoonk/ai/tasks/lesson-spec/activity-plan";
import { writeLessonActivities } from "@zoonk/ai/tasks/lesson-writer/activities";
import { describeActivityTemplates } from "@zoonk/core/library/activities/writer-templates";
import { publishedLesson } from "../lesson-activity-plan/published-lessons";
import {
  LESSON_ACTIVITIES_SCORE_CATEGORIES,
  checkLessonActivities,
  scoreLessonActivities,
} from "./scorer";
import { type LessonActivitiesInput, TEST_CASES } from "./test-cases";

type LessonActivitiesOutput = Awaited<ReturnType<typeof writeLessonActivities>>["data"];

export const lessonActivitiesTask: Task<LessonActivitiesInput, LessonActivitiesOutput> = {
  codeChecks: checkLessonActivities,
  description:
    "Write only the activity screens an older lesson's revised plan asks for, with the writer's rules and the lesson's own case",
  generate: ({ activities, lessonId, model, reasoning, useFallback }) => {
    const lesson = publishedLesson(lessonId);
    const templates = activities.map(({ activityTemplate }) => activityTemplate);

    const { changes, spec } = applyLessonActivityPlan({
      proposed: activities.map((activity) => ({ ...activity, visual: null })),
      spec: lesson.spec,
      templateIds: new Set(templates),
    });

    return writeLessonActivities({
      activityTemplates: describeActivityTemplates(templates),
      chapterTitle: lesson.chapterTitle,
      country: null,
      courseTitle: lesson.courseTitle,
      indexes: changes.map(({ index }) => index),
      language: lesson.language,
      level: lesson.level,
      model,
      reasoning,
      screens: lesson.screens,
      spec,
      useFallback,
    });
  },
  id: "lesson-activities",
  name: "Lesson activities",
  priorities: {
    distribution: "shared",
    first: "quality",
    reads:
      "Core's validator and the lesson check, a staff approver, then every learner of the lesson",
    reason: "Adds screens to a shared lesson; runs on the shared writer's model",
    waits: "A staff person drafting a batch of fixes",
  },
  score: scoreLessonActivities,
  scoreCategories: LESSON_ACTIVITIES_SCORE_CATEGORIES,
  testCases: TEST_CASES,
};

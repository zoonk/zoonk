import { type Task } from "@/lib/types";
import { planLessonActivities } from "@zoonk/ai/tasks/lesson-spec/activity-plan";
import { listPlannerTemplates } from "@zoonk/core/library/activities/writer-templates";
import { publishedLesson } from "./published-lessons";
import {
  LESSON_ACTIVITY_PLAN_SCORE_CATEGORIES,
  checkLessonActivityPlan,
  scoreLessonActivityPlan,
} from "./scorer";
import {
  type LessonActivityPlanExpected,
  type LessonActivityPlanInput,
  TEST_CASES,
} from "./test-cases";

type LessonActivityPlanOutput = Awaited<ReturnType<typeof planLessonActivities>>["data"];

export const lessonActivityPlanTask: Task<
  LessonActivityPlanInput,
  LessonActivityPlanOutput,
  LessonActivityPlanExpected
> = {
  codeChecks: checkLessonActivityPlan,
  description:
    "Pick which practice screens of a lesson planned before activities were common become the activity built for the skill, or none for a lesson about ideas",
  generate: ({ lessonId, model, reasoning, useFallback }) =>
    planLessonActivities({
      ...publishedLesson(lessonId),
      activityTemplates: listPlannerTemplates(),
      model,
      reasoning,
      useFallback,
    }),
  id: "lesson-activity-plan",
  name: "Lesson activity plan",
  priorities: {
    distribution: "shared",
    first: "quality",
    reads: "The writer follows the briefs; a staff approver reviews the fix",
    reason: "Decides what a shared lesson's learners do, once per lesson",
    waits: "A staff person drafting a batch of fixes",
  },
  score: scoreLessonActivityPlan,
  scoreCategories: LESSON_ACTIVITY_PLAN_SCORE_CATEGORIES,
  testCases: TEST_CASES,
};

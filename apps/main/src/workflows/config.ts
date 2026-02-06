export const CHAPTER_STEPS = [
  "getChapter",
  "setChapterAsRunning",
  "generateLessons",
  "addLessons",
  "setChapterAsCompleted",
] as const;

export type ChapterStepName = (typeof CHAPTER_STEPS)[number];

export const LESSON_STEPS = [
  "getLesson",
  "setLessonAsRunning",
  "determineLessonKind",
  "updateLessonKind",
  "generateCustomActivities",
  "addActivities",
  "setLessonAsCompleted",
] as const;

export type LessonStepName = (typeof LESSON_STEPS)[number];
export const LESSON_COMPLETION_STEP: LessonStepName = "setLessonAsCompleted";
export const ACTIVITY_GENERATION_COMPLETION_STEP: ActivityStepName = "setActivityAsCompleted";

export const ACTIVITY_STEPS = [
  "getLessonActivities",
  "generateBackgroundContent",
  "generateExplanationContent",
  "generateExamplesContent",
  "generateMechanicsContent",
  "generateQuizContent",
  "generateVisuals",
  "generateImages",
  "generateQuizImages",
  "setActivityAsRunning",
  "setBackgroundAsCompleted",
  "setExamplesAsCompleted",
  "setExplanationAsCompleted",
  "setMechanicsAsCompleted",
  "setQuizAsCompleted",
  "setActivityAsCompleted",
  "workflowError",
] as const;

export type ActivityStepName = (typeof ACTIVITY_STEPS)[number];

export type ActivityCompletionStep =
  | "setBackgroundAsCompleted"
  | "setExamplesAsCompleted"
  | "setExplanationAsCompleted"
  | "setMechanicsAsCompleted"
  | "setQuizAsCompleted";

const activityCompletionSteps: Partial<Record<string, ActivityCompletionStep>> = {
  background: "setBackgroundAsCompleted",
  examples: "setExamplesAsCompleted",
  explanation: "setExplanationAsCompleted",
  mechanics: "setMechanicsAsCompleted",
  quiz: "setQuizAsCompleted",
};

/**
 * Get the completion step name for an activity kind.
 * Used by the UI to detect when generation is complete.
 *
 * For unsupported kinds (story, etc.), returns a fallback.
 * These kinds shouldn't reach the generation page, but if they do,
 * the UI won't redirect until the correct step is emitted.
 */
export function getActivityCompletionStep(kind: string): ActivityCompletionStep {
  return activityCompletionSteps[kind] ?? "setBackgroundAsCompleted";
}

export const COURSE_STEPS = [
  "getCourseSuggestion",
  "checkExistingCourse",
  "initializeCourse",
  "setCourseAsRunning",
  "getExistingChapters",
  "generateDescription",
  "generateImage",
  "generateAlternativeTitles",
  "generateCategories",
  "generateChapters",
  "updateCourse",
  "addAlternativeTitles",
  "addCategories",
  "addChapters",
  "completeCourseSetup",
] as const;

export type CourseStepName = (typeof COURSE_STEPS)[number];

// Chapter workflow includes lesson steps since we generate the first lesson
export type ChapterWorkflowStepName = ChapterStepName | LessonStepName | ActivityStepName;

// We also generate the first chapter as part of the course workflow
// So the course generation is only complete after chapter and lesson workflow is done
export type CourseWorkflowStepName = CourseStepName | ChapterWorkflowStepName;

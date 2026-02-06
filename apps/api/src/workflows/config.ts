const CHAPTER_STEPS = [
  "getChapter",
  "setChapterAsRunning",
  "generateLessons",
  "addLessons",
  "setChapterAsCompleted",
] as const;

export type ChapterStepName = (typeof CHAPTER_STEPS)[number];

const LESSON_STEPS = [
  "getLesson",
  "setLessonAsRunning",
  "determineLessonKind",
  "updateLessonKind",
  "generateCustomActivities",
  "addActivities",
  "setLessonAsCompleted",
] as const;

export type LessonStepName = (typeof LESSON_STEPS)[number];

const ACTIVITY_STEPS = [
  "getLessonActivities",
  "generateBackgroundContent",
  "generateExplanationContent",
  "generateExamplesContent",
  "generateMechanicsContent",
  "generateQuizContent",
  "generateStoryContent",
  "generateVisuals",
  "generateImages",
  "generateQuizImages",
  "setActivityAsRunning",
  "setBackgroundAsCompleted",
  "setExamplesAsCompleted",
  "setExplanationAsCompleted",
  "setMechanicsAsCompleted",
  "setQuizAsCompleted",
  "setStoryAsCompleted",
  "setActivityAsCompleted",
  "workflowError",
] as const;

export type ActivityStepName = (typeof ACTIVITY_STEPS)[number];

const COURSE_STEPS = [
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

// Chapter workflow includes lesson steps since we generate the first lesson
export type ChapterWorkflowStepName = ChapterStepName | LessonStepName | ActivityStepName;

// We also generate the first chapter as part of the course workflow
// So the course generation is only complete after chapter and lesson workflow is done
export type CourseWorkflowStepName = (typeof COURSE_STEPS)[number] | ChapterWorkflowStepName;

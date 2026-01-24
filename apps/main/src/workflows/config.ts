export const CHAPTER_STEPS = [
  "getChapter",
  "setChapterAsRunning",
  "generateLessons",
  "addLessons",
  "setChapterAsCompleted",
] as const;

export type ChapterStepName = (typeof CHAPTER_STEPS)[number];
export const CHAPTER_COMPLETION_STEP: ChapterStepName = "setChapterAsCompleted";

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

// We also generate the first chapter as part of the course workflow
// So the course generation is only complete after chapter workflow is done
export type CourseWorkflowStepName = CourseStepName | ChapterStepName;

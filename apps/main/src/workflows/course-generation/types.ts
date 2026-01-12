export type StepName =
  | "getCourseSuggestion"
  | "checkCourseExists"
  | "cleanupFailedCourse"
  | "createCourse"
  | "generateDescription"
  | "generateImage"
  | "generateAlternativeTitles"
  | "generateCategories"
  | "generateChapters"
  | "updateCourse"
  | "addAlternativeTitles"
  | "addCategories"
  | "addChapters"
  | "generateLessons"
  | "updateRunStatus";

export type StepStatus = "started" | "completed" | "failed";

export type CourseGenerationEvent = {
  step: StepName;
  status: StepStatus;
  timestamp: number;
  data?: Record<string, unknown>;
};

export type CourseGenerationRunStatus = "running" | "completed" | "failed";

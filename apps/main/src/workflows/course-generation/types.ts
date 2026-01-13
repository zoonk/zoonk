import type { GenerationStatus } from "@zoonk/db";

export type StepName =
  | "getCourseSuggestion"
  | "checkExistingCourse"
  | "initializeCourse"
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
  | "addLessons"
  | "finalize";

export type StepStatus = "started" | "completed" | "error";

export type StreamMessage = {
  step: StepName;
  status: StepStatus;
};

export type CourseSuggestionData = {
  id: number;
  language: string;
  slug: string;
  title: string;
  description: string;
  generationStatus: GenerationStatus;
  generationRunId: string | null;
};

export type CourseContext = {
  courseId: number;
  courseSlug: string;
  courseTitle: string;
  language: string;
  organizationId: number;
};

export type GeneratedChapter = {
  title: string;
  description: string;
};

export type CreatedChapter = {
  id: number;
  slug: string;
  title: string;
  description: string;
  position: number;
};

export type GeneratedLesson = {
  title: string;
  description: string;
};

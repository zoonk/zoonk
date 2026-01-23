import type { GenerationStatus } from "@zoonk/db";

export type ExistingCourseContent = {
  description: string | null;
  imageUrl: string | null;
  hasAlternativeTitles: boolean;
  hasCategories: boolean;
  hasChapters: boolean;
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

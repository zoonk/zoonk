import { type LessonKind } from "@zoonk/db";

export type EstimateKind =
  | "coreLesson"
  | "languageLesson"
  | "tutorialLesson"
  | "regularCourse"
  | "languageCourse";

export type EstimateLineItem = {
  averageCostPerRequest: number;
  averageRequestsPerRun: number;
  estimatedCost: number;
  hasUsageData: boolean;
  isInferred: boolean;
  label: string;
  note?: string;
  taskName?: string;
};

export type AiGenerationCostEstimate = {
  description: string;
  kind: EstimateKind;
  lineItems: EstimateLineItem[];
  notes: string[];
  runLabel: string;
  sampleCount: number;
  title: string;
  totalEstimatedCost: number;
};

export type AiCourseEstimateInputs = {
  languageChapterCount: number;
  languageLessonsPerChapter: number;
  regularChapterCount: number;
  regularCoreLessonsPerChapter: number;
  regularTutorialLessonsPerChapter: number;
};

export type AiCourseEstimateInputOverrides = Partial<
  Record<keyof AiCourseEstimateInputs, number | string | null>
>;

export type AiCostEstimateReport = {
  courseInputs: AiCourseEstimateInputs;
  defaultCourseInputs: AiCourseEstimateInputs;
  estimates: AiGenerationCostEstimate[];
};

export type LanguageAudioUsageRow = {
  sentenceWordCount: bigint | null;
  wordClipCount: bigint | null;
};

export type StepImageUsageRow = {
  count: bigint;
  lessonKind: Extract<LessonKind, "explanation" | "practice" | "tutorial">;
};

export type StructureStats = {
  completedLanguageChapterCount: number;
  completedRegularChapterCount: number;
  coreLessonCount: number;
  coreLessonExplanationCount: number;
  coreLessonPracticeCount: number;
  coreLessonQuizCount: number;
  languageAudioSentenceWordCount: number;
  languageAudioWordClipCount: number;
  languageCourseChapterCount: number;
  languageCourseCount: number;
  languageLessonCount: number;
  languageLessonCountInCourses: number;
  regularCoreLessonCountInCourses: number;
  regularCourseChapterCount: number;
  regularCourseCount: number;
  regularTutorialLessonCountInCourses: number;
  tutorialLessonCount: number;
  stepImageCountsByLessonKind: Partial<Record<StepImageUsageRow["lessonKind"], number>>;
};

export type StepStatus = "started" | "completed" | "error";

export type WorkflowErrorReason =
  | "aiEmptyResult"
  | "aiGenerationFailed"
  | "audioGenerationFailed"
  | "contentValidationFailed"
  | "dbFetchFailed"
  | "dbSaveFailed"
  | "noSourceData"
  | "notFound"
  | "romanizationFailed"
  | "translationGenerationFailed";

/**
 * The SSE message shape sent from the API and consumed by the UI.
 * This is the contract between the workflow streaming layer and the client.
 */
export type StepStreamMessage<TStep extends string = string> = {
  entityId?: string;
  reason?: WorkflowErrorReason;
  status: StepStatus;
  step: TStep;
};

/**
 * Canonical step name definitions shared between the API (which emits SSE events)
 * and the main app (which tracks progress in the UI). Both apps import from here
 * so TypeScript catches any mismatches at build time.
 *
 * When adding a new step:
 * 1. Add the step name to the appropriate array below
 * 2. The API uses the type in `createStepStream<...>()`
 * 3. The main app's phase validation will fail if the new step isn't assigned to a phase
 *    in the matching generation phase config — add it there too
 */

export const CHAPTER_STEPS = [
  "getChapter",
  "setChapterAsRunning",
  "generateLessons",
  "generateLessonKind",
  "addLessons",
  "setChapterAsCompleted",
] as const;

export type ChapterStepName = (typeof CHAPTER_STEPS)[number];

export const CHAPTER_COMPLETION_STEP: ChapterStepName = "setChapterAsCompleted";

export const WORKFLOW_ERROR_STEP = "workflowError" as const;

export type WorkflowErrorStepName = typeof WORKFLOW_ERROR_STEP;

export const LESSON_STEPS = [
  "getLesson",
  "setLessonAsRunning",
  "generateExplanationContent",
  "generateImagePrompts",
  "generateStepImages",
  "saveExplanationLesson",
  "generateTutorialContent",
  "saveTutorialLesson",
  "generatePracticeContent",
  "savePracticeLesson",
  "generateQuizContent",
  "generateQuizImages",
  "saveQuizLesson",
  "generateVocabularyContent",
  "generateVocabularyDistractors",
  "generateVocabularyPronunciation",
  "generateVocabularyAudio",
  "generateVocabularyRomanization",
  "saveVocabularyLesson",
  "saveTranslationLesson",
  "generateReadingContent",
  "generateReadingAudio",
  "generateReadingRomanization",
  "generateSentenceDistractors",
  "generateSentenceWordMetadata",
  "generateSentenceWordAudio",
  "generateSentenceWordPronunciation",
  "saveReadingLesson",
  "saveListeningLesson",
  "generateGrammarContent",
  "generateGrammarUserContent",
  "generateGrammarRomanization",
  "saveGrammarLesson",
  "setLessonAsCompleted",
] as const;

export type LessonStepName = (typeof LESSON_STEPS)[number];

export const LESSON_COMPLETION_STEP: LessonStepName = "setLessonAsCompleted";

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

export const COURSE_COMPLETION_STEP: CourseStepName = "completeCourseSetup";

/**
 * All step names the SSE stream can emit during chapter generation.
 * The chapter workflow also generates the first lesson, so the stream includes
 * both chapter and lesson step events.
 */
export type ChapterWorkflowStepName = ChapterStepName | LessonStepName | WorkflowErrorStepName;

/**
 * All step names the SSE stream can emit during course generation.
 * The course workflow also generates the first chapter and lesson, so the
 * stream includes all downstream step events.
 */
export type CourseWorkflowStepName = CourseStepName | ChapterWorkflowStepName;

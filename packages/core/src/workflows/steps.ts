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
  entityId?: number;
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
 * 2. The API uses the type in `createStepStream<ActivityStepName>()`
 * 3. The main app's phase validation will fail if the new step isn't assigned to a phase
 *    in `activity-generation-phase-config.ts` — add it there too
 */

export const CHAPTER_STEPS = [
  "getChapter",
  "setChapterAsRunning",
  "generateLessons",
  "addLessons",
  "setChapterAsCompleted",
] as const;

export type ChapterStepName = (typeof CHAPTER_STEPS)[number];

export const CHAPTER_COMPLETION_STEP: ChapterStepName = "setChapterAsCompleted";

export const LESSON_STEPS = [
  "getLesson",
  "setLessonAsRunning",
  "determineLessonKind",
  "determineAppliedActivity",
  "updateLessonKind",
  "removeNonLanguageLesson",
  "generateCustomActivities",
  "addActivities",
  "setLessonAsCompleted",
] as const;

export type LessonStepName = (typeof LESSON_STEPS)[number];

export const LESSON_COMPLETION_STEP: LessonStepName = "setLessonAsCompleted";

export const ACTIVITY_STEPS = [
  // Shared setup
  "getLessonActivities",
  "getNeighboringConcepts",
  "setActivityAsRunning",

  // Content generation (pure data producers — no DB writes)
  "generateCustomContent",
  "generateExplanationContent",
  "generateInvestigationScenario",
  "generateInvestigationAccuracy",
  "generateInvestigationActions",
  "generateInvestigationFindings",
  "generateInvestigationInterpretations",
  "generateInvestigationDebrief",
  "generateInvestigationVisuals",
  "generateInvestigationVisualContent",
  "generateQuizContent",
  "generatePracticeContent",
  "generateStoryContent",
  "generateStoryDebrief",
  "generateGrammarContent",
  "generateGrammarUserContent",
  "generateGrammarRomanization",
  "generateVocabularyContent",
  "generateSentences",
  "generateVocabularyDistractors",
  "generateVocabularyPronunciation",
  "generateSentenceDistractors",
  "generateSentenceWordPronunciation",
  "generateVocabularyRomanization",
  "generateVocabularyAudio",
  "generateAudio",
  "generateReadingRomanization",
  "generateSentenceWordMetadata",
  "generateSentenceWordAudio",
  "generateVisualDescriptions",
  "generateVisualContent",
  "generateQuizImages",

  // Listening (copies steps from vocabulary/reading)
  "copyListeningSteps",

  // Per-entity save steps (write to DB + mark activity completed)
  "saveVocabularyActivity",
  "saveReadingActivity",
  "saveQuizActivity",
  "savePracticeActivity",
  "saveStoryActivity",
  "saveInvestigationActivity",
  "saveExplanationActivity",
  "saveCustomActivity",
  "saveGrammarActivity",
  "saveListeningActivity",

  // Error
  "workflowError",
] as const;

export type ActivityStepName = (typeof ACTIVITY_STEPS)[number];

type ActivityCompletionStep = Extract<
  ActivityStepName,
  | "saveCustomActivity"
  | "saveExplanationActivity"
  | "saveGrammarActivity"
  | "saveInvestigationActivity"
  | "saveListeningActivity"
  | "savePracticeActivity"
  | "saveQuizActivity"
  | "saveReadingActivity"
  | "saveStoryActivity"
  | "saveVocabularyActivity"
>;

const activityCompletionSteps: Partial<Record<string, ActivityCompletionStep>> = {
  custom: "saveCustomActivity",
  explanation: "saveExplanationActivity",
  grammar: "saveGrammarActivity",
  investigation: "saveInvestigationActivity",
  listening: "saveListeningActivity",
  practice: "savePracticeActivity",
  quiz: "saveQuizActivity",
  reading: "saveReadingActivity",
  story: "saveStoryActivity",
  translation: "saveVocabularyActivity",
  vocabulary: "saveVocabularyActivity",
};

/**
 * Get the completion step name for an activity kind.
 * Used by the UI to detect when generation is complete and trigger redirect.
 *
 * Each activity kind's save step doubles as its completion signal —
 * when the save step completes, the activity is both persisted and done.
 */
export function getActivityCompletionStep(kind: string): ActivityCompletionStep {
  return activityCompletionSteps[kind] ?? "saveExplanationActivity";
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

export const COURSE_COMPLETION_STEP: CourseStepName = "completeCourseSetup";

/**
 * All step names the SSE stream can emit during chapter generation.
 * The chapter workflow also generates the first lesson and activity,
 * so the stream includes lesson and activity step events.
 */
export type ChapterWorkflowStepName = ChapterStepName | LessonStepName | ActivityStepName;

/**
 * All step names the SSE stream can emit during course generation.
 * The course workflow also generates the first chapter, lesson, and activity,
 * so the stream includes all downstream step events.
 */
export type CourseWorkflowStepName = CourseStepName | ChapterWorkflowStepName;

/**
 * The applied activity kind assigned to a core lesson by the AI classifier.
 * Applied activities are scenario-based experiences (story, investigation, etc.)
 * added on top of the standard explanation/practice/quiz set.
 */
export type AppliedActivityKind = "investigation" | "story" | null;

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
const ACTIVITY_GENERATION_COMPLETION_STEP: ActivityStepName = "setActivityAsCompleted";

export const ACTIVITY_STEPS = [
  "getLessonActivities",
  "getNeighboringConcepts",
  "generateChallengeContent",
  "generateCustomContent",
  "generateExplanationContent",
  "generateQuizContent",
  "generatePracticeContent",
  "generateGrammarContent",
  "generateSentences",
  "generateVisuals",
  "generateImages",
  "generateQuizImages",
  "setActivityAsRunning",
  "setChallengeAsCompleted",
  "setCustomAsCompleted",
  "setExplanationAsCompleted",
  "setQuizAsCompleted",
  "setPracticeAsCompleted",
  "setGrammarAsCompleted",
  "generateVocabularyContent",
  "saveVocabularyWords",
  "generateVocabularyPronunciation",
  "generateVocabularyAudio",
  "updateVocabularyEnrichments",
  "saveSentences",
  "generateAudio",
  "updateSentenceEnrichments",
  "copyListeningSteps",
  "setTranslationAsCompleted",
  "setVocabularyAsCompleted",
  "setReadingAsCompleted",
  "setListeningAsCompleted",
  "setActivityAsCompleted",
  "workflowError",
] as const;

export type ActivityStepName = (typeof ACTIVITY_STEPS)[number];

type ActivityCompletionStep =
  | "setChallengeAsCompleted"
  | "setCustomAsCompleted"
  | "setExplanationAsCompleted"
  | "setQuizAsCompleted"
  | "setPracticeAsCompleted"
  | "setGrammarAsCompleted"
  | "setTranslationAsCompleted"
  | "setVocabularyAsCompleted"
  | "setReadingAsCompleted"
  | "setListeningAsCompleted";

const activityCompletionSteps: Partial<Record<string, ActivityCompletionStep>> = {
  challenge: "setChallengeAsCompleted",
  custom: "setCustomAsCompleted",
  explanation: "setExplanationAsCompleted",
  grammar: "setGrammarAsCompleted",
  listening: "setListeningAsCompleted",
  practice: "setPracticeAsCompleted",
  quiz: "setQuizAsCompleted",
  reading: "setReadingAsCompleted",
  translation: "setTranslationAsCompleted",
  vocabulary: "setVocabularyAsCompleted",
};

/**
 * Get the completion step name for an activity kind.
 * Used by the UI to detect when generation is complete.
 *
 * For unsupported kinds, returns a fallback.
 * These kinds shouldn't reach the generation page, but if they do,
 * the UI won't redirect until the correct step is emitted.
 */
export function getActivityCompletionStep(kind: string): ActivityCompletionStep {
  return activityCompletionSteps[kind] ?? "setExplanationAsCompleted";
}

/**
 * Course and chapter generation should redirect as soon as the first generated
 * activity in the first lesson is playable.
 *
 * Language lessons always start with a vocabulary activity at position 0.
 * The generic "setActivityAsCompleted" event is too broad there because
 * grammar can finish first while vocabulary is still saving pronunciations
 * and audio. For non-language lessons we keep using the generic event because
 * the first generated activity kind is not fixed ahead of time.
 */
export function getFirstGeneratedActivityCompletionStep(
  targetLanguage: string | null,
): ActivityStepName {
  if (targetLanguage) {
    return "setVocabularyAsCompleted";
  }

  return ACTIVITY_GENERATION_COMPLETION_STEP;
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

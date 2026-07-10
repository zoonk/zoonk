import { type RegisteredTask } from "@/lib/types";
import { chapterLessonsTask } from "./chapter-lessons/task";
import { courseCanonicalTitleTask } from "./course-canonical-title/task";
import { courseCategoriesTask } from "./course-categories/task";
import { courseChaptersTask } from "./course-chapters/task";
import { courseDescriptionTask } from "./course-description/task";
import { courseFormatTask } from "./course-format/task";
import { courseIdentitySearchTask } from "./course-identity-search/task";
import { courseIdentityClassificationTask } from "./course-identity/task";
import { courseIntentTask } from "./course-intent/task";
import { courseIntroductionTask } from "./course-introduction/task";
import { courseLandingPageTask } from "./course-landing-page/task";
import { coursePersonalizationTask } from "./course-personalization/task";
import { imageInputSafetyRewriteTask } from "./image-prompt-safety-rewrite/task";
import { languageChapterLessonsTask } from "./language-chapter-lessons/task";
import { languageCourseChaptersTask } from "./language-course-chapters/task";
import { lessonAlphabetTask } from "./lesson-alphabet/task";
import { lessonDistractorsTask } from "./lesson-distractors/task";
import { lessonExplanationTask } from "./lesson-explanation/task";
import { lessonGrammarTask } from "./lesson-grammar/task";
import { lessonKindTask } from "./lesson-kind/task";
import { lessonPracticeTask } from "./lesson-practice/task";
import { lessonPronunciationTask } from "./lesson-pronunciation/task";
import { lessonQuizTask } from "./lesson-quiz/task";
import { lessonRomanizationTask } from "./lesson-romanization/task";
import { lessonSentencesTask } from "./lesson-sentences/task";
import { lessonTranslationTask } from "./lesson-translation/task";
import { lessonTutorialTask } from "./lesson-tutorial/task";
import { lessonVocabularyTask } from "./lesson-vocabulary/task";

export const TASKS: readonly RegisteredTask[] = [
  lessonDistractorsTask,
  lessonQuizTask,
  lessonExplanationTask,
  lessonGrammarTask,
  lessonKindTask,
  lessonPronunciationTask,
  lessonTranslationTask,
  lessonSentencesTask,
  lessonPracticeTask,
  lessonRomanizationTask,
  lessonTutorialTask,
  lessonAlphabetTask,
  lessonVocabularyTask,
  courseIdentitySearchTask,
  courseIdentityClassificationTask,
  courseIntentTask,
  coursePersonalizationTask,
  courseFormatTask,
  courseCanonicalTitleTask,
  chapterLessonsTask,
  courseCategoriesTask,
  courseChaptersTask,
  courseIntroductionTask,
  courseDescriptionTask,
  courseLandingPageTask,
  imageInputSafetyRewriteTask,
  languageChapterLessonsTask,
  languageCourseChaptersTask,
];

// Number of times each test case should be run for more reliable results
export const RUNS_PER_TEST_CASE = 1;

export function getTaskById(taskId: string): RegisteredTask | null {
  return TASKS.find((t) => t.id === taskId) ?? null;
}

export function getTotalTestCases(taskId: string): number {
  const task = getTaskById(taskId);
  const totalTestCases = task?.testCases.length ?? 0;
  return totalTestCases * RUNS_PER_TEST_CASE;
}

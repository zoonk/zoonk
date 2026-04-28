import { type Task } from "@/lib/types";
import { alternativeTitlesTask } from "./alternative-titles/task";
import { chapterLessonsTask } from "./chapter-lessons/task";
import { courseCategoriesTask } from "./course-categories/task";
import { courseChaptersTask } from "./course-chapters/task";
import { courseDescriptionTask } from "./course-description/task";
import { courseSuggestionsTask } from "./course-suggestions/task";
import { languageChapterLessonsTask } from "./language-chapter-lessons/task";
import { languageCourseChaptersTask } from "./language-course-chapters/task";
import { lessonCustomTask } from "./lesson-custom/task";
import { lessonDistractorsTask } from "./lesson-distractors/task";
import { lessonExplanationTask } from "./lesson-explanation/task";
import { lessonGrammarContentTask } from "./lesson-grammar-content/task";
import { lessonGrammarUserContentTask } from "./lesson-grammar-user-content/task";
import { lessonKindTask } from "./lesson-kind/task";
import { lessonPracticeTask } from "./lesson-practice/task";
import { lessonPronunciationTask } from "./lesson-pronunciation/task";
import { lessonQuizTask } from "./lesson-quiz/task";
import { lessonRomanizationTask } from "./lesson-romanization/task";
import { lessonSentencesTask } from "./lesson-sentences/task";
import { lessonTranslationTask } from "./lesson-translation/task";
import { lessonVocabularyTask } from "./lesson-vocabulary/task";

export const TASKS: readonly Task[] = [
  lessonCustomTask,
  lessonDistractorsTask,
  lessonQuizTask,
  lessonExplanationTask,
  lessonGrammarContentTask,
  lessonGrammarUserContentTask,
  lessonKindTask,
  lessonPronunciationTask,
  lessonTranslationTask,
  lessonSentencesTask,
  lessonPracticeTask,
  lessonRomanizationTask,
  lessonVocabularyTask,
  alternativeTitlesTask,
  chapterLessonsTask,
  courseCategoriesTask,
  courseChaptersTask,
  courseDescriptionTask,
  courseSuggestionsTask,
  languageChapterLessonsTask,
  languageCourseChaptersTask,
];

// Number of times each test case should be run for more reliable results
export const RUNS_PER_TEST_CASE = 1;

export function getTaskById(taskId: string): Task | null {
  return TASKS.find((t) => t.id === taskId) ?? null;
}

export function getTotalTestCases(taskId: string): number {
  const task = getTaskById(taskId);
  const totalTestCases = task?.testCases.length ?? 0;
  return totalTestCases * RUNS_PER_TEST_CASE;
}

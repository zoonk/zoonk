import { type Task } from "@/lib/types";
import { activityChallengeTask } from "./activity-challenge/task";
import { activityCustomTask } from "./activity-custom/task";
import { activityExplanationTask } from "./activity-explanation/task";
import { activityGrammarTask } from "./activity-grammar/task";
import { activityPracticeTask } from "./activity-practice/task";
import { activityPronunciationTask } from "./activity-pronunciation/task";
import { activityQuizTask } from "./activity-quiz/task";
import { activitySentenceVariantsTask } from "./activity-sentence-variants/task";
import { activitySentenceWordTranslationTask } from "./activity-sentence-word-translation/task";
import { activitySentencesTask } from "./activity-sentences/task";
import { activityVocabularyTask } from "./activity-vocabulary/task";
import { alternativeTitlesTask } from "./alternative-titles/task";
import { chapterLessonsTask } from "./chapter-lessons/task";
import { courseCategoriesTask } from "./course-categories/task";
import { courseChaptersTask } from "./course-chapters/task";
import { courseDescriptionTask } from "./course-description/task";
import { courseSuggestionsTask } from "./course-suggestions/task";
import { languageChapterLessonsTask } from "./language-chapter-lessons/task";
import { languageCourseChaptersTask } from "./language-course-chapters/task";
import { lessonActivitiesTask } from "./lesson-activities/task";
import { lessonKindTask } from "./lesson-kind/task";
import { stepVisualTask } from "./step-visual/task";

export const TASKS: readonly Task[] = [
  activityChallengeTask,
  activityCustomTask,
  activityQuizTask,
  activityExplanationTask,
  activityGrammarTask,
  activityPronunciationTask,
  activitySentenceVariantsTask,
  activitySentenceWordTranslationTask,
  activitySentencesTask,
  activityPracticeTask,

  activityVocabularyTask,
  alternativeTitlesTask,
  chapterLessonsTask,
  courseCategoriesTask,
  courseChaptersTask,
  courseDescriptionTask,
  courseSuggestionsTask,
  lessonActivitiesTask,
  languageChapterLessonsTask,
  languageCourseChaptersTask,
  lessonKindTask,
  stepVisualTask,
];

// Number of times each test case should be run for more reliable results
export const RUNS_PER_TEST_CASE = 1;

export function getTaskById(taskId: string): Task | undefined {
  return TASKS.find((t) => t.id === taskId);
}

export function getTotalTestCases(taskId: string): number {
  const task = getTaskById(taskId);
  const totalTestCases = task?.testCases.length ?? 0;
  return totalTestCases * RUNS_PER_TEST_CASE;
}

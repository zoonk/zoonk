import { type Task } from "@/lib/types";
import { activityCustomTask } from "./activity-custom/task";
import { activityDistractorsTask } from "./activity-distractors/task";
import { activityExplanationTask } from "./activity-explanation/task";
import { activityGrammarContentTask } from "./activity-grammar-content/task";
import { activityGrammarUserContentTask } from "./activity-grammar-user-content/task";
import { activityInvestigationAccuracyTask } from "./activity-investigation-accuracy/task";
import { activityInvestigationActionsTask } from "./activity-investigation-actions/task";
import { activityInvestigationDebriefTask } from "./activity-investigation-debrief/task";
import { activityInvestigationFindingsTask } from "./activity-investigation-findings/task";
import { activityInvestigationScenarioTask } from "./activity-investigation-scenario/task";
import { activityPracticeTask } from "./activity-practice/task";
import { activityPronunciationTask } from "./activity-pronunciation/task";
import { activityQuizTask } from "./activity-quiz/task";
import { activityRomanizationTask } from "./activity-romanization/task";
import { activitySentencesTask } from "./activity-sentences/task";
import { activityStoryDebriefTask } from "./activity-story-debrief/task";
import { activityStoryStepsTask } from "./activity-story-steps/task";
import { activityTranslationTask } from "./activity-translation/task";
import { activityVocabularyTask } from "./activity-vocabulary/task";
import { alternativeTitlesTask } from "./alternative-titles/task";
import { appliedActivityKindTask } from "./applied-activity-kind/task";
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
import { visualChartTask } from "./visual-chart/task";
import { visualCodeTask } from "./visual-code/task";
import { visualDiagramTask } from "./visual-diagram/task";
import { visualFormulaTask } from "./visual-formula/task";
import { visualMusicTask } from "./visual-music/task";
import { visualQuoteTask } from "./visual-quote/task";
import { visualTableTask } from "./visual-table/task";
import { visualTimelineTask } from "./visual-timeline/task";

export const TASKS: readonly Task[] = [
  activityCustomTask,
  activityDistractorsTask,
  activityQuizTask,
  activityExplanationTask,
  activityGrammarContentTask,
  activityGrammarUserContentTask,
  activityPronunciationTask,
  activityTranslationTask,
  activitySentencesTask,
  activityPracticeTask,
  activityStoryDebriefTask,
  activityStoryStepsTask,
  activityInvestigationAccuracyTask,
  activityInvestigationActionsTask,
  activityInvestigationDebriefTask,
  activityInvestigationFindingsTask,

  activityInvestigationScenarioTask,
  activityRomanizationTask,
  activityVocabularyTask,
  appliedActivityKindTask,
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
  visualChartTask,
  visualCodeTask,
  visualDiagramTask,
  visualFormulaTask,
  visualMusicTask,
  visualQuoteTask,
  visualTableTask,
  visualTimelineTask,
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

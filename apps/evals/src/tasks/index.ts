import { type RegisteredTask } from "@/lib/types";
import { alphabetLessonTask } from "./alphabet-lesson/task";
import { answerFromMaterialTask } from "./answer-from-material/task";
import { assessPronunciationTask } from "./assess-pronunciation/task";
import { challengeCaseTask } from "./challenge-case/task";
import { changingFactsTask } from "./changing-facts/task";
import { checkCitedFactsTask } from "./check-cited-facts/task";
import { citeMaterialTask } from "./cite-material/task";
import { conversationFeedbackTask } from "./conversation-feedback/task";
import { conversationObjectivesTask } from "./conversation-objectives/task";
import { conversationScenarioTask } from "./conversation-scenario/task";
import { courseDetailsTask } from "./course-details/task";
import { courseIconTask } from "./course-icon/task";
import { courseIntentTask } from "./course-intent/task";
import { courseOutlineTask } from "./course-outline/task";
import { coverageCheckTask } from "./coverage-check/task";
import { examIdentityDecisionTask } from "./exam-identity-decision/task";
import { exampleLineTask } from "./example-line/task";
import { explainSpokenAnswerTask } from "./explain-spoken-answer/task";
import { explainWrongAnswerTask } from "./explain-wrong-answer/task";
import { extractExamBlueprintTask } from "./extract-exam-blueprint/task";
import { findOfficialSourcesTask } from "./find-official-sources/task";
import { generateItemsTask } from "./generate-items/task";
import { goalSpecificityTask } from "./goal-specificity/task";
import { gradeEssayTask } from "./grade-essay/task";
import { gradeTypedAnswerTask } from "./grade-typed-answer/task";
import { imageCheckTask } from "./image-check/task";
import { imageInputSafetyRewriteTask } from "./image-prompt-safety-rewrite/task";
import { imageSceneTask } from "./image-scene/task";
import { languageLessonTask } from "./language-lesson/task";
import { lessonFixTask } from "./lesson-fix/task";
import { lessonImageTask } from "./lesson-image/task";
import { lessonQualityCheckTask } from "./lesson-quality-check/task";
import { lessonQuestionTask } from "./lesson-question/task";
import { lessonSpecTask } from "./lesson-spec/task";
import { lessonWriterTask } from "./lesson-writer/task";
import { levelTestBankTask } from "./level-test-bank/task";
import { libraryIdentityDecisionTask } from "./library-identity-decision/task";
import { librarySearchTermsTask } from "./library-search-terms/task";
import { liveConversationTask } from "./live-conversation/task";
import { memoryDepthTask } from "./memory-depth/task";
import { memoryExtractionTask } from "./memory-extraction/task";
import { memoryGateTask } from "./memory-gate/task";
import { memoryInsightTask } from "./memory-insight/task";
import { memoryReconcileTask } from "./memory-reconcile/task";
import { memoryRelevanceTask } from "./memory-relevance/task";
import { memorySearchTermsTask } from "./memory-search-terms/task";
import { mistakeCauseTask } from "./mistake-cause/task";
import { mistakePatternTask } from "./mistake-pattern/task";
import { pastQuestionsTask } from "./past-questions/task";
import { placementItemsTask } from "./placement-items/task";
import { planEditIntentTask } from "./plan-edit-intent/task";
import { questionGeneralityTask } from "./question-generality/task";
import { quickExplanationTask } from "./quick-explanation/task";
import { researchPlanTask } from "./research-plan/task";
import { setupLessonOutlineTask } from "./setup-lesson-outline/task";
import { skillGraphTask } from "./skill-graph/task";
import { sourceChangeNoticeTask } from "./source-change-notice/task";
import { speakingMockScoreTask } from "./speaking-mock-score/task";
import { statuteDrillsTask } from "./statute-drills/task";
import { stepVariantTask } from "./step-variant/task";
import { transcribeSpeechTask } from "./transcribe-speech/task";
import { understandGoalTask } from "./understand-goal/task";
import { uploadVisibilityTask } from "./upload-visibility/task";
import { workFieldTask } from "./work-field/task";

export const TASKS: readonly RegisteredTask[] = [
  changingFactsTask,
  researchPlanTask,
  findOfficialSourcesTask,
  extractExamBlueprintTask,
  checkCitedFactsTask,
  citeMaterialTask,
  answerFromMaterialTask,
  examIdentityDecisionTask,
  uploadVisibilityTask,
  sourceChangeNoticeTask,
  lessonQuestionTask,
  courseIntentTask,
  imageInputSafetyRewriteTask,
  imageSceneTask,
  lessonImageTask,
  imageCheckTask,
  generateItemsTask,
  placementItemsTask,
  statuteDrillsTask,
  pastQuestionsTask,
  workFieldTask,
  gradeTypedAnswerTask,
  gradeEssayTask,
  explainWrongAnswerTask,
  quickExplanationTask,
  challengeCaseTask,
  questionGeneralityTask,
  skillGraphTask,
  courseOutlineTask,
  courseDetailsTask,
  courseIconTask,
  coverageCheckTask,
  lessonSpecTask,
  lessonWriterTask,
  lessonQualityCheckTask,
  lessonFixTask,
  stepVariantTask,
  exampleLineTask,
  librarySearchTermsTask,
  libraryIdentityDecisionTask,
  goalSpecificityTask,
  mistakeCauseTask,
  planEditIntentTask,
  understandGoalTask,
  memoryExtractionTask,
  memoryDepthTask,
  memoryGateTask,
  memoryReconcileTask,
  memorySearchTermsTask,
  memoryRelevanceTask,
  memoryInsightTask,
  languageLessonTask,
  explainSpokenAnswerTask,
  transcribeSpeechTask,
  assessPronunciationTask,
  conversationScenarioTask,
  conversationFeedbackTask,
  conversationObjectivesTask,
  liveConversationTask,
  speakingMockScoreTask,
  mistakePatternTask,
  levelTestBankTask,
  alphabetLessonTask,
  setupLessonOutlineTask,
];

// Number of times each test case should be run for more reliable results
export const RUNS_PER_TEST_CASE = 1;

export function getTaskById(taskId: string): RegisteredTask | null {
  return TASKS.find((t) => t.id === taskId) ?? null;
}

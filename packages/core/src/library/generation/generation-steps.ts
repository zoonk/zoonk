const LESSON_CONTENT_STEPS = [
  "joinRunningLesson",
  "planLesson",
  "writeLesson",
  "lessonReady",
] as const;

export type LessonContentStepName = (typeof LESSON_CONTENT_STEPS)[number];

export const LESSON_READY_STEP: LessonContentStepName = "lessonReady";

const GOAL_CONTENT_STEPS = [
  "joinRunningGoal",
  "understandGoal",
  "readExamNotice",
  "buildSkillGraph",
  "saveSkills",
  "preparePlacement",
  "createPlan",
  "outlineCourses",
  "prepareFirstLessons",
  "goalReady",
] as const;

export type GoalContentStepName = (typeof GOAL_CONTENT_STEPS)[number];

export const GOAL_READY_STEP: GoalContentStepName = "goalReady";

const LEVEL_TEST_BANK_STEPS = [
  "joinLevelTestBank",
  "writeLevelTestBank",
  "levelTestBankReady",
] as const;

export type LevelTestBankStepName = (typeof LEVEL_TEST_BANK_STEPS)[number];

export const LEVEL_TEST_BANK_READY_STEP: LevelTestBankStepName = "levelTestBankReady";

const TEST_OUT_QUESTIONS_STEPS = [
  "joinTestOutQuestions",
  "writeTestOutQuestions",
  "testOutQuestionsReady",
] as const;

export type TestOutQuestionsStepName = (typeof TEST_OUT_QUESTIONS_STEPS)[number];

export const TEST_OUT_QUESTIONS_READY_STEP: TestOutQuestionsStepName = "testOutQuestionsReady";

const FOCUS_TEST_QUESTIONS_STEPS = [
  "joinFocusTestQuestions",
  "writeFocusTestQuestions",
  "focusTestQuestionsReady",
] as const;

export type FocusTestQuestionsStepName = (typeof FOCUS_TEST_QUESTIONS_STEPS)[number];

export const FOCUS_TEST_QUESTIONS_READY_STEP: FocusTestQuestionsStepName =
  "focusTestQuestionsReady";

const MOCK_QUESTIONS_STEPS = [
  "joinMockQuestions",
  "writeMockQuestions",
  "mockQuestionsReady",
] as const;

export type MockQuestionsStepName = (typeof MOCK_QUESTIONS_STEPS)[number];

export const MOCK_QUESTIONS_READY_STEP: MockQuestionsStepName = "mockQuestionsReady";

const CHALLENGE_QUESTIONS_STEPS = [
  "joinChallengeQuestions",
  "writeChallengeQuestions",
  "challengeQuestionsReady",
] as const;

export type ChallengeQuestionsStepName = (typeof CHALLENGE_QUESTIONS_STEPS)[number];

export const CHALLENGE_QUESTIONS_READY_STEP: ChallengeQuestionsStepName = "challengeQuestionsReady";

const EXPLANATION_STEPS = [
  "joinRunningExplanation",
  "classifyQuestion",
  "findExplanation",
  "writeExplanation",
  "explanationReady",
] as const;

export type ExplanationStepName = (typeof EXPLANATION_STEPS)[number];

export const EXPLANATION_READY_STEP: ExplanationStepName = "explanationReady";

const GOAL_UNDERSTANDING_STEPS = [
  "joinRunningUnderstanding",
  "readGoal",
  "findExamDates",
  "understandingReady",
] as const;

export type GoalUnderstandingStepName = (typeof GOAL_UNDERSTANDING_STEPS)[number];

export const GOAL_UNDERSTANDING_READY_STEP: GoalUnderstandingStepName = "understandingReady";

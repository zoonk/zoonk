/**
 * Progress events the generation workflows write to their stream (`StepStreamMessage`). Clients map
 * each step to an honest progress line and treat the `*Ready` step as done.
 */

/** A lesson's content: planned (spec), then written and checked, then ready to play. */
const LESSON_CONTENT_STEPS = [
  "joinRunningLesson",
  "planLesson",
  "writeLesson",
  "lessonReady",
] as const;

export type LessonContentStepName = (typeof LESSON_CONTENT_STEPS)[number];

export const LESSON_READY_STEP: LessonContentStepName = "lessonReady";

/**
 * A new goal: its skill graph (after research reads a class test's own material, `readExamNotice`,
 * or reads a stored exam notice again with newer instructions, `readNotice`; a new exam's notice
 * is read beside the plan and reconciles it without steps of its own), its skills in the Library,
 * placement's questions (written while the skills are saved), the plan, the outlines and the first
 * lessons.
 */
const GOAL_CONTENT_STEPS = [
  "joinRunningGoal",
  "understandGoal",
  "readExamNotice",
  "readNotice",
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

/** A language pair's level test questions: joined when another run writes them, then written. */
const LEVEL_TEST_BANK_STEPS = [
  "joinLevelTestBank",
  "writeLevelTestBank",
  "levelTestBankReady",
] as const;

export type LevelTestBankStepName = (typeof LEVEL_TEST_BANK_STEPS)[number];

export const LEVEL_TEST_BANK_READY_STEP: LevelTestBankStepName = "levelTestBankReady";

/**
 * A chapter's test-out questions, written when the learner asks for its test. A run started while
 * another one writes them reports `joinTestOutQuestions` with that run's id, so clients follow the
 * run doing the work.
 */
const TEST_OUT_QUESTIONS_STEPS = [
  "joinTestOutQuestions",
  "writeTestOutQuestions",
  "testOutQuestionsReady",
] as const;

export type TestOutQuestionsStepName = (typeof TEST_OUT_QUESTIONS_STEPS)[number];

export const TEST_OUT_QUESTIONS_READY_STEP: TestOutQuestionsStepName = "testOutQuestionsReady";

/**
 * A goal's focus test questions, written when the learner starts the test. A run started while
 * another one writes them reports `joinFocusTestQuestions` with that run's id.
 */
const FOCUS_TEST_QUESTIONS_STEPS = [
  "joinFocusTestQuestions",
  "writeFocusTestQuestions",
  "focusTestQuestionsReady",
] as const;

export type FocusTestQuestionsStepName = (typeof FOCUS_TEST_QUESTIONS_STEPS)[number];

export const FOCUS_TEST_QUESTIONS_READY_STEP: FocusTestQuestionsStepName =
  "focusTestQuestionsReady";

/**
 * The questions a mock taken any time still needs, written when the learner starts it. A run
 * started while another one writes them reports `joinMockQuestions` with that run's id.
 */
const MOCK_QUESTIONS_STEPS = [
  "joinMockQuestions",
  "writeMockQuestions",
  "mockQuestionsReady",
] as const;

export type MockQuestionsStepName = (typeof MOCK_QUESTIONS_STEPS)[number];

export const MOCK_QUESTIONS_READY_STEP: MockQuestionsStepName = "mockQuestionsReady";

/**
 * An explain question: shared or personal, an explanation someone already asked for, or a new one.
 * A new one can be read once `writeExplanation` completes; `explanationReady` follows when its
 * course to go further is linked. A run started while another one answers the question reports
 * `joinRunningExplanation` with that run's id, so clients follow the run doing the work.
 */
const EXPLANATION_STEPS = [
  "joinRunningExplanation",
  "classifyQuestion",
  "findExplanation",
  "writeExplanation",
  "explanationReady",
] as const;

export type ExplanationStepName = (typeof EXPLANATION_STEPS)[number];

export const EXPLANATION_READY_STEP: ExplanationStepName = "explanationReady";

/**
 * A typed goal read in onboarding: the words, then the named exam's dates, then the card. A run
 * started while another one reads the same draft reports `joinRunningUnderstanding` with that
 * run's id, so clients follow the run doing the work.
 */
const GOAL_UNDERSTANDING_STEPS = [
  "joinRunningUnderstanding",
  "readGoal",
  "findExamDates",
  "understandingReady",
] as const;

export type GoalUnderstandingStepName = (typeof GOAL_UNDERSTANDING_STEPS)[number];

export const GOAL_UNDERSTANDING_READY_STEP: GoalUnderstandingStepName = "understandingReady";

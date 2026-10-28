import {
  type ChallengeQuestionsStepName,
  type ExplanationStepName,
  type FocusTestQuestionsStepName,
  type GoalContentStepName,
  type GoalUnderstandingStepName,
  type LessonContentStepName,
  type LevelTestBankStepName,
  type MockQuestionsStepName,
  type TestOutQuestionsStepName,
} from "@zoonk/core/library/generation/steps";

type StepPlace<TPhase extends string> = TPhase | "done" | "join";

type PhaseDefinition<TPhase extends string> = {
  id: TPhase;
  optional?: boolean;
  /** Its usual duration on real runs, which weighs it in the bar. */
  seconds: number;
};

type StepStates<TStep extends string> = Partial<Record<TStep, "completed" | "started">>;

export type GenerationKindDefinition<TStep extends string, TPhase extends string> = {
  isDone?: (steps: StepStates<TStep>) => boolean;
  phases: readonly PhaseDefinition<TPhase>[];
  steps: Record<TStep, StepPlace<TPhase>>;
};

const GOAL_PHASES = [
  { id: "goal", seconds: 8 },
  { id: "notice", optional: true, seconds: 15 },
  { id: "skills", seconds: 60 },
] as const;

const GOAL_STEPS = {
  buildSkillGraph: "skills",
  joinRunningGoal: "join",
  readExamNotice: "notice",
  understandGoal: "goal",
} as const;

const understanding = {
  phases: [
    { id: "read", seconds: 8 },
    { id: "dates", optional: true, seconds: 12 },
  ],
  steps: {
    findExamDates: "dates",
    joinRunningUnderstanding: "join",
    readGoal: "read",
    understandingReady: "done",
  },
} as const satisfies GenerationKindDefinition<GoalUnderstandingStepName, "dates" | "read">;

const curriculum = {
  isDone: (steps) => steps.createPlan === "completed",
  phases: [...GOAL_PHASES, { id: "plan", seconds: 15 }],
  steps: {
    ...GOAL_STEPS,
    createPlan: "plan",
    goalReady: "done",
    outlineCourses: "done",
    prepareFirstLessons: "done",
    preparePlacement: "plan",
    saveSkills: "plan",
  },
} as const satisfies GenerationKindDefinition<
  GoalContentStepName,
  "goal" | "notice" | "plan" | "skills"
>;

const placement = {
  phases: [...GOAL_PHASES, { id: "questions", seconds: 40 }],
  steps: {
    ...GOAL_STEPS,
    createPlan: "questions",
    goalReady: "done",
    outlineCourses: "questions",
    prepareFirstLessons: "questions",
    preparePlacement: "questions",
    saveSkills: "questions",
  },
} as const satisfies GenerationKindDefinition<
  GoalContentStepName,
  "goal" | "notice" | "questions" | "skills"
>;

const firstLesson = {
  isDone: (steps) => steps.createPlan === "completed",
  phases: [...GOAL_PHASES, { id: "day", seconds: 15 }],
  steps: {
    ...GOAL_STEPS,
    createPlan: "day",
    goalReady: "done",
    outlineCourses: "done",
    prepareFirstLessons: "done",
    preparePlacement: "day",
    saveSkills: "day",
  },
} as const satisfies GenerationKindDefinition<
  GoalContentStepName,
  "day" | "goal" | "notice" | "skills"
>;

const courseOutline = {
  phases: [
    { id: "skills", seconds: 60 },
    { id: "plan", seconds: 15 },
    { id: "outline", seconds: 75 },
  ],
  steps: {
    buildSkillGraph: "skills",
    createPlan: "plan",
    goalReady: "done",
    joinRunningGoal: "join",
    outlineCourses: "outline",
    prepareFirstLessons: "done",
    preparePlacement: "plan",
    readExamNotice: "skills",
    saveSkills: "plan",
    understandGoal: "skills",
  },
} as const satisfies GenerationKindDefinition<GoalContentStepName, "outline" | "plan" | "skills">;

const levelTestBank = {
  phases: [{ id: "bank", seconds: 60 }],
  steps: { joinLevelTestBank: "bank", levelTestBankReady: "done", writeLevelTestBank: "bank" },
} as const satisfies GenerationKindDefinition<LevelTestBankStepName, "bank">;

const testOutQuestions = {
  phases: [{ id: "questions", seconds: 20 }],
  steps: {
    joinTestOutQuestions: "join",
    testOutQuestionsReady: "done",
    writeTestOutQuestions: "questions",
  },
} as const satisfies GenerationKindDefinition<TestOutQuestionsStepName, "questions">;

const focusTestQuestions = {
  phases: [{ id: "questions", seconds: 25 }],
  steps: {
    focusTestQuestionsReady: "done",
    joinFocusTestQuestions: "join",
    writeFocusTestQuestions: "questions",
  },
} as const satisfies GenerationKindDefinition<FocusTestQuestionsStepName, "questions">;

const mockQuestions = {
  phases: [{ id: "questions", seconds: 100 }],
  steps: { joinMockQuestions: "join", mockQuestionsReady: "done", writeMockQuestions: "questions" },
} as const satisfies GenerationKindDefinition<MockQuestionsStepName, "questions">;

const challengeQuestions = {
  phases: [{ id: "questions", seconds: 32 }],
  steps: {
    challengeQuestionsReady: "done",
    joinChallengeQuestions: "join",
    writeChallengeQuestions: "questions",
  },
} as const satisfies GenerationKindDefinition<ChallengeQuestionsStepName, "questions">;

const explanation = {
  isDone: (steps) => steps.writeExplanation === "completed",
  phases: [
    { id: "read", seconds: 2 },
    { id: "find", seconds: 2 },
    { id: "write", seconds: 12 },
  ],
  steps: {
    classifyQuestion: "read",
    explanationReady: "done",
    findExplanation: "find",
    joinRunningExplanation: "join",
    writeExplanation: "write",
  },
} as const satisfies GenerationKindDefinition<ExplanationStepName, "find" | "read" | "write">;

const lesson = {
  phases: [
    { id: "plan", seconds: 40 },
    { id: "write", seconds: 50 },
  ],
  steps: {
    joinRunningLesson: "join",
    lessonReady: "done",
    planLesson: "plan",
    writeLesson: "write",
  },
} as const satisfies GenerationKindDefinition<LessonContentStepName, "plan" | "write">;

const conversationCall = {
  phases: [{ id: "write", seconds: 20 }],
  steps: { writeCall: "write" },
} as const satisfies GenerationKindDefinition<"writeCall", "write">;

const speakingMock = {
  phases: [{ id: "write", seconds: 22 }],
  steps: { writeMock: "write" },
} as const satisfies GenerationKindDefinition<"writeMock", "write">;

const examSpeaking = {
  phases: [{ id: "write", seconds: 30 }],
  steps: { writeTask: "write" },
} as const satisfies GenerationKindDefinition<"writeTask", "write">;

const GENERATION_KINDS = {
  challengeQuestions,
  conversationCall,
  courseOutline,
  curriculum,
  examSpeaking,
  explanation,
  firstLesson,
  focusTestQuestions,
  lesson,
  levelTestBank,
  mockQuestions,
  placement,
  speakingMock,
  testOutQuestions,
  understanding,
};

export type GenerationKind = keyof typeof GENERATION_KINDS;

export type GenerationPhase<TKind extends GenerationKind> =
  (typeof GENERATION_KINDS)[TKind]["phases"][number]["id"];

export function getGenerationKind(kind: GenerationKind): GenerationKindDefinition<string, string> {
  return GENERATION_KINDS[kind];
}

export function getStepMeaning({
  kind,
  status,
  step,
}: {
  kind: GenerationKind;
  status: "completed" | "error" | "started";
  step: string;
}): "error" | "join" | "progress" {
  if (status === "error" || step === "workflowError") {
    return "error";
  }

  return getGenerationKind(kind).steps[step] === "join" ? "join" : "progress";
}

export function isGenerationDone({
  definition,
  steps,
}: {
  definition: GenerationKindDefinition<string, string>;
  steps: StepStates<string>;
}): boolean {
  const reportedDone = Object.entries(definition.steps).some(
    ([step, place]) => place === "done" && steps[step] !== undefined,
  );

  return reportedDone || (definition.isDone?.(steps) ?? false);
}

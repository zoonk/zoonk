import {
  type ExplanationStepName,
  type GoalContentStepName,
  type GoalUnderstandingStepName,
  type LessonContentStepName,
  type LevelTestBankStepName,
  type TestOutQuestionsStepName,
} from "@zoonk/core/library/generation/steps";

/**
 * Where a step of the run's stream belongs in a wait: one of its phases, `done` when it means the
 * content is ready (a later step or the run's ready step), or `join` when the run hands over to
 * another run already doing the work, which the host follows instead.
 */
type StepPlace<TPhase extends string> = TPhase | "done" | "join";

type PhaseDefinition<TPhase extends string> = {
  id: TPhase;
  /** Only shown once one of its steps is reported: runs skip it when it doesn't apply. */
  optional?: boolean;
  /** Its usual duration, measured on real runs: the phase's weight in the bar and its pace. */
  seconds: number;
};

type StepStates<TStep extends string> = Partial<Record<TStep, "completed" | "started">>;

export type GenerationKindDefinition<TStep extends string, TPhase extends string> = {
  /**
   * Whether the wait's content is ready although the run goes on (the plan before the outlines).
   * A step placed as `done` ends it too.
   */
  isDone?: (steps: StepStates<TStep>) => boolean;
  phases: readonly PhaseDefinition<TPhase>[];
  /** Every step the run can report, so a new step can't go unmapped. */
  steps: Record<TStep, StepPlace<TPhase>>;
};

/*
 * Durations measured on real runs (impl-log, ONB-GOALWORK timings, 2026-09-27/28): reading a
 * goal's answers and scope about 8 s, a class test's own material up to 15 s when research reads it, the
 * skill graph 15 to 45 s (exams longest), saving the skills with the placement questions and the
 * plan 15 to 30 s, a course's first outline band about 60 s, a lesson's plan 20 s and its writing
 * 30 s, a quick explanation 12 s, a language pair's level test questions 30 to 85 s.
 */

const GOAL_PHASES = [
  { id: "goal", seconds: 8 },
  { id: "notice", optional: true, seconds: 15 },
  { id: "skills", seconds: 45 },
] as const;

/** Goal steps up to the skill graph, shared by every wait on a goal's run. */
const GOAL_STEPS = {
  buildSkillGraph: "skills",
  joinRunningGoal: "join",
  readExamNotice: "notice",
  understandGoal: "goal",
} as const;

const understanding = {
  phases: [
    { id: "read", seconds: 8 },
    { id: "dates", optional: true, seconds: 3 },
  ],
  steps: {
    findExamDates: "dates",
    joinRunningUnderstanding: "join",
    readGoal: "read",
    understandingReady: "done",
  },
} as const satisfies GenerationKindDefinition<GoalUnderstandingStepName, "dates" | "read">;

/** Plan creation: done once the plan is saved, while outlines and first lessons go on. */
const curriculum = {
  isDone: (steps) => steps.createPlan === "completed",
  phases: [...GOAL_PHASES, { id: "plan", seconds: 25 }],
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

/**
 * Placement preparation: its questions are written alongside the plan, and done once all are (a
 * plan that came with the goal has no `createPlan`: the first lessons start right after its
 * questions). The wait doesn't hold placement back: it asks each question as soon as that one is
 * written and the plan exists, which the placement step checks for itself.
 */
const placement = {
  isDone: (steps) =>
    steps.preparePlacement === "completed" &&
    (steps.createPlan === "completed" || steps.prepareFirstLessons !== undefined),
  phases: [...GOAL_PHASES, { id: "questions", seconds: 30 }],
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

/** Day 1 opens once the plan is saved: Today builds the first day from it. */
const firstLesson = {
  isDone: (steps) => steps.createPlan === "completed",
  phases: [...GOAL_PHASES, { id: "day", seconds: 25 }],
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

/** The plan, then the outlines of its courses: the first band of the first course takes longest. */
const courseOutline = {
  phases: [
    { id: "skills", seconds: 55 },
    { id: "plan", seconds: 25 },
    { id: "outline", seconds: 60 },
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

/** A language pair's level test questions, written once for every learner of the pair. */
const levelTestBank = {
  phases: [{ id: "bank", seconds: 60 }],
  steps: { joinLevelTestBank: "bank", levelTestBankReady: "done", writeLevelTestBank: "bank" },
} as const satisfies GenerationKindDefinition<LevelTestBankStepName, "bank">;

/**
 * A chapter's test-out questions, written when the learner asks: one call per skill it samples
 * that has none yet, all at once at the priority tier.
 */
const testOutQuestions = {
  phases: [{ id: "questions", seconds: 20 }],
  steps: {
    joinTestOutQuestions: "join",
    testOutQuestionsReady: "done",
    writeTestOutQuestions: "questions",
  },
} as const satisfies GenerationKindDefinition<TestOutQuestionsStepName, "questions">;

/**
 * A new explanation can be read once writing completes (it's saved then); the run goes on to link
 * its course to go further, which the ending asks for again.
 */
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
    { id: "plan", seconds: 20 },
    { id: "write", seconds: 30 },
  ],
  steps: {
    joinRunningLesson: "join",
    lessonReady: "done",
    planLesson: "plan",
    writeLesson: "write",
  },
} as const satisfies GenerationKindDefinition<LessonContentStepName, "plan" | "write">;

/**
 * A language call the learner starts before it's written (a checkpoint the session's preparation
 * hasn't reached, or a unit's practice call at a level no one practiced yet): one request writes
 * it, 16 to 31 s on real runs (LAT-LANGUAGE, 2026-09-28).
 */
const conversationCall = {
  phases: [{ id: "write", seconds: 20 }],
  steps: { writeCall: "write" },
} as const satisfies GenerationKindDefinition<"writeCall", "write">;

/**
 * A speaking mock the learner starts before the next one is written ahead (rare: a session's
 * preparation and the end of a mock write it): one request writes the examiner and script, 19 to
 * 31 s on real runs (LAT-LANGUAGE, 2026-09-28). The card shows the wait once the start takes
 * longer than a mock written ahead would, about a second in.
 */
const speakingMock = {
  phases: [{ id: "write", seconds: 22 }],
  steps: { writeMock: "write" },
} as const satisfies GenerationKindDefinition<"writeMock", "write">;

/**
 * Every generation wait: which run it follows and how that run's steps read as phases, weighted
 * by how long each usually takes. The copy for each phase lives with the wait component.
 */
const GENERATION_KINDS = {
  conversationCall,
  courseOutline,
  curriculum,
  explanation,
  firstLesson,
  lesson,
  levelTestBank,
  placement,
  speakingMock,
  testOutQuestions,
  understanding,
};

export type GenerationKind = keyof typeof GENERATION_KINDS;

export type GenerationPhase<TKind extends GenerationKind> =
  (typeof GENERATION_KINDS)[TKind]["phases"][number]["id"];

/** A kind's definition, widened so pure helpers can read any kind the same way. */
export function getGenerationKind(kind: GenerationKind): GenerationKindDefinition<string, string> {
  return GENERATION_KINDS[kind];
}

/**
 * What a reported step means for a wait of this kind: `join` when the run hands over to another,
 * `error` when the run failed, `progress` otherwise (whether it's done is `isGenerationDone`).
 */
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

/** Whether a wait's content is ready from what its run reported so far. */
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

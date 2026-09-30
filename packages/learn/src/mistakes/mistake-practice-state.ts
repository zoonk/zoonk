import { type MistakePracticeResult } from "@zoonk/core/mistakes/practice";
import { type FinishMistakePracticeResult } from "@zoonk/core/mistakes/practice-finish";
import { type ChoiceAnswer, type ChoiceFeedback } from "../questions/choice-question";
import { isIdeaFirst, isReadFirst } from "./drill/drill-types";

export type PracticeEntry = Extract<MistakePracticeResult, { status: "ready" }>["practice"][number];

/** One practice answer: which mistake, which question, the answer and how long it took. */
export type MistakePracticeAnswer = {
  answer: ChoiceAnswer;
  durationMs: number;
  itemId: string;
  mistakeId: string;
};

/** The grade of one answer, the trap a trap drill names, and the answer's id the run counts. */
export type MistakePracticeFeedback =
  | (ChoiceFeedback & { answerId: string; fixed: boolean; trap: string | null })
  | null;

/** What the run earned: its Brain Power, right answers and the time it added to today. */
export type MistakePracticeSummary = Extract<
  FinishMistakePracticeResult,
  { status: "ready" }
>["result"];

/** One question of the run, with the mistake it drills. */
export type PracticeStep = {
  entry: PracticeEntry;
  firstOfEntry: boolean;
  question: PracticeEntry["questions"][number];
};

type Graded = NonNullable<MistakePracticeFeedback>;

/**
 * Where the run is: a gap's idea before its questions, a misread's question before its answers,
 * answering, waiting for the grade, reading it, saving the run, or done.
 */
type PracticePhase =
  | { kind: "idea" }
  | { kind: "reading" }
  | { kind: "answering"; selected: ChoiceAnswer | null }
  | { answer: ChoiceAnswer; kind: "checking"; timedOut: boolean }
  | { answer: ChoiceAnswer; kind: "answerFailed"; timedOut: boolean }
  | { answer: ChoiceAnswer; feedback: Graded; kind: "feedback"; timedOut: boolean }
  | { kind: "ending" }
  | { kind: "ended"; summary: MistakePracticeSummary | null };

/**
 * The run keeps the questions it started with: grading or counting an answer refreshes the page,
 * and a fixed mistake leaves the server's practice, but not the run in progress.
 */
type PracticeState = {
  answerIds: string[];
  fixedIds: string[];
  index: number;
  phase: PracticePhase;
  steps: PracticeStep[];
};

type PracticeAction =
  | { type: "start" }
  | { type: "reveal" }
  | { answer: ChoiceAnswer; type: "select" }
  | { answer: ChoiceAnswer; timedOut: boolean; type: "check" }
  | { feedback: Graded; mistakeId: string; type: "answered" }
  | { type: "answerFailed" }
  | { type: "next" }
  | { type: "end" }
  | { summary: MistakePracticeSummary | null; type: "ended" };

function toPracticeSteps(practice: readonly PracticeEntry[]): PracticeStep[] {
  return practice.flatMap((entry) =>
    entry.questions.map((question, index) => ({ entry, firstOfEntry: index === 0, question })),
  );
}

/**
 * How a question opens: a content gap's first question waits behind its idea, and a misread's
 * questions show their answers only once read.
 */
function getOpeningPhase(step: PracticeStep | undefined): PracticePhase {
  if (!step) {
    return { kind: "ending" };
  }

  if (step.firstOfEntry && isIdeaFirst(step.entry.drill)) {
    return { kind: "idea" };
  }

  return isReadFirst(step.entry.drill)
    ? { kind: "reading" }
    : { kind: "answering", selected: null };
}

export function createPracticeState(practice: readonly PracticeEntry[]): PracticeState {
  const steps = toPracticeSteps(practice);

  return {
    answerIds: [],
    fixedIds: [],
    index: 0,
    phase: steps.length === 0 ? { kind: "ended", summary: null } : getOpeningPhase(steps[0]),
    steps,
  };
}

function afterIdea(step: PracticeStep | undefined): PracticePhase {
  return isReadFirst(step?.entry.drill ?? null)
    ? { kind: "reading" }
    : { kind: "answering", selected: null };
}

function answered(state: PracticeState, action: Extract<PracticeAction, { type: "answered" }>) {
  const { phase } = state;

  if (phase.kind !== "checking") {
    return state;
  }

  return {
    ...state,
    answerIds: [...state.answerIds, action.feedback.answerId],
    fixedIds:
      action.feedback.fixed && !state.fixedIds.includes(action.mistakeId)
        ? [...state.fixedIds, action.mistakeId]
        : state.fixedIds,
    phase: { ...phase, feedback: action.feedback, kind: "feedback" as const },
  };
}

/** The run's steps, one question at a time, ending once every question is answered or it's ended. */
export function practiceReducer(state: PracticeState, action: PracticeAction): PracticeState {
  switch (action.type) {
    case "start":
      return { ...state, phase: afterIdea(state.steps[state.index]) };
    case "reveal":
      return { ...state, phase: { kind: "answering", selected: null } };
    case "select":
      return { ...state, phase: { kind: "answering", selected: action.answer } };
    case "check":
      return {
        ...state,
        phase: { answer: action.answer, kind: "checking", timedOut: action.timedOut },
      };
    case "answered":
      return answered(state, action);
    case "answerFailed":
      return state.phase.kind === "checking"
        ? { ...state, phase: { ...state.phase, kind: "answerFailed" } }
        : state;
    case "next":
      return {
        ...state,
        index: state.index + 1,
        phase: getOpeningPhase(state.steps[state.index + 1]),
      };
    case "end":
      return { ...state, phase: { kind: "ending" } };
    case "ended":
      return { ...state, phase: { kind: "ended", summary: action.summary } };
    default:
      return state;
  }
}

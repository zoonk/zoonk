import { type MistakePracticeResult } from "@zoonk/core/mistakes/practice";
import { type FinishMistakePracticeResult } from "@zoonk/core/mistakes/practice-finish";
import { type TaskSegment } from "../_components/task-header";
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
  | (ChoiceFeedback & {
      answerId: string;
      fixed: boolean;
      fixedMistakeIds: string[];
      mistakeStatus: "open" | "fixed";
      trap: string | null;
    })
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
type PracticeVerdict = "read" | "right" | "wrong";

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
 * and a fixed mistake leaves the server's practice, but not the run in progress. `verdicts` holds
 * each answered question's grade, in order, for the header's segments.
 */
type PracticeState = {
  answerIds: string[];
  fixedIds: string[];
  index: number;
  phase: PracticePhase;
  steps: PracticeStep[];
  verdicts: PracticeVerdict[];
};

type PracticeAction =
  | { type: "start" }
  | { type: "reveal" }
  | { answer: ChoiceAnswer | null; type: "select" }
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
    verdicts: [],
  };
}

function afterIdea(step: PracticeStep | undefined): PracticePhase {
  return isReadFirst(step?.entry.drill ?? null)
    ? { kind: "reading" }
    : { kind: "answering", selected: null };
}

function getFixedIds(state: PracticeState, action: Extract<PracticeAction, { type: "answered" }>) {
  const fixed = [...new Set([...state.fixedIds, ...action.feedback.fixedMistakeIds])];

  if (action.feedback.mistakeStatus === "open") {
    return fixed.filter((id) => id !== action.mistakeId);
  }

  return action.feedback.fixed && !fixed.includes(action.mistakeId)
    ? [...fixed, action.mistakeId]
    : fixed;
}

/** An explicit unknown is neutral; the clock running out remains a miss. */
function getPracticeVerdict({
  answer,
  isCorrect,
  timedOut,
}: {
  answer: ChoiceAnswer;
  isCorrect: boolean;
  timedOut: boolean;
}): PracticeVerdict {
  if (!timedOut && "dontKnow" in answer) {
    return "read";
  }

  return isCorrect ? "right" : "wrong";
}

function answered(state: PracticeState, action: Extract<PracticeAction, { type: "answered" }>) {
  const { phase } = state;

  if (phase.kind !== "checking") {
    return state;
  }

  return {
    ...state,
    answerIds: [...state.answerIds, action.feedback.answerId],
    fixedIds: getFixedIds(state, action),
    phase: { ...phase, feedback: action.feedback, kind: "feedback" as const },
    verdicts: [
      ...state.verdicts,
      getPracticeVerdict({ ...phase, isCorrect: action.feedback.isCorrect }),
    ],
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

/**
 * Each question of the run as a segment of its header: green once answered right, red once
 * answered wrong or the time runs out, neutral for an explicit "I'm not sure", the one in view,
 * then the ones ahead.
 */
export function getPracticeSegments(state: PracticeState): TaskSegment[] {
  return state.steps.map((_, index) => {
    const verdict = state.verdicts[index];

    if (verdict !== undefined) {
      return verdict;
    }

    return index === state.index ? "current" : "ahead";
  });
}

/**
 * Which of the run's mistakes the question in view drills, and how many the run holds ("2 of 3"),
 * from the questions it started with: a mistake can bring several questions.
 */
export function getPracticeMistakePosition(state: PracticeState): {
  current: number;
  total: number;
} {
  const mistakeIds = [...new Set(state.steps.map((step) => step.entry.mistakeId))];
  const current = state.steps[state.index]?.entry.mistakeId;

  return { current: current ? mistakeIds.indexOf(current) + 1 : 0, total: mistakeIds.length };
}

/** Spaces and line breaks as one space, so a text reads the same however it was joined. */
function squashSpaces(text: string): string {
  return text.replaceAll(/\s+/gu, " ").trim();
}

/**
 * Whether the question in view is the one the mistake was made on. The notebook keeps a lesson's
 * question with its context before it, and a bank question as it's asked.
 */
export function isMistakeQuestion(step: PracticeStep): boolean {
  const saved = squashSpaces(step.entry.snapshot.question);
  const { context, question } = step.question;

  return (
    saved === squashSpaces(question) ||
    (Boolean(context) && saved === squashSpaces(`${context} ${question}`))
  );
}

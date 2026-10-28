import { type MistakePracticeResult } from "@zoonk/core/mistakes/practice";
import { type FinishMistakePracticeResult } from "@zoonk/core/mistakes/practice-finish";
import { NOTHING_REACHED, type Reached } from "@zoonk/core/sessions/reached";
import { type TaskSegment } from "../_components/task-header";
import { mergeReached } from "../_utils/merge-reached";
import { type ChoiceAnswer, type ChoiceFeedback } from "../questions/choice-question";
import { isIdeaFirst, isReadFirst } from "./drill/drill-types";

export type PracticeEntry = Extract<MistakePracticeResult, { status: "ready" }>["practice"][number];

/** `attemptId` stays the same when an answer is sent again, so the server records one answer per question. */
export type MistakePracticeAnswer = {
  answer: ChoiceAnswer;
  attemptId: string;
  durationMs: number;
  itemId: string;
  mistakeId: string;
  runAnswerIds: string[];
};

export type MistakePracticeFeedback =
  | (ChoiceFeedback & {
      answerId: string;
      fixed: boolean;
      fixedMistakeIds: string[];
      mistakeStatus: "open" | "fixed";
      reached: Reached;
      trap: string | null;
    })
  | null;

export type MistakePracticeSummary = Extract<
  FinishMistakePracticeResult,
  { status: "ready" }
>["result"];

export type PracticeStep = {
  entry: PracticeEntry;
  firstOfEntry: boolean;
  question: PracticeEntry["questions"][number];
};

type Graded = NonNullable<MistakePracticeFeedback>;
type PracticeVerdict = "read" | "right" | "wrong";

type PracticePhase =
  | { kind: "idea" }
  | { kind: "reading" }
  | { kind: "answering"; selected: ChoiceAnswer | null }
  | { answer: ChoiceAnswer; kind: "checking"; timedOut: boolean }
  | { answer: ChoiceAnswer; kind: "answerFailed"; timedOut: boolean }
  | { answer: ChoiceAnswer; feedback: Graded; kind: "feedback"; timedOut: boolean }
  | { kind: "ending" }
  | { kind: "ended"; summary: MistakePracticeSummary | null };

/** Keeps the questions it started with: an answer refreshes the page, and a fixed mistake leaves the server's practice, not the run. */
type PracticeState = {
  answerIds: string[];
  fixedIds: string[];
  index: number;
  phase: PracticePhase;
  reached: Reached;
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
    reached: NOTHING_REACHED,
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
    reached: mergeReached(state.reached, action.feedback.reached),
    verdicts: [
      ...state.verdicts,
      getPracticeVerdict({ ...phase, isCorrect: action.feedback.isCorrect }),
    ],
  };
}

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
      return {
        ...state,
        phase: { kind: "ended", summary: action.summary },
        reached: action.summary
          ? mergeReached(state.reached, action.summary.reached)
          : state.reached,
      };
    default:
      return state;
  }
}

export function getPracticeSegments(state: PracticeState): TaskSegment[] {
  return state.steps.map((_, index) => {
    const verdict = state.verdicts[index];

    if (verdict !== undefined) {
      return verdict;
    }

    return index === state.index ? "current" : "ahead";
  });
}

function squashSpaces(text: string): string {
  return text.replaceAll(/\s+/gu, " ").trim();
}

/** The notebook saves a lesson's question with its context before it, and a bank question as it's asked. */
export function isMistakeQuestion(step: PracticeStep): boolean {
  const saved = squashSpaces(step.entry.snapshot.question);
  const { context, question } = step.question;

  return (
    saved === squashSpaces(question) ||
    (Boolean(context) && saved === squashSpaces(`${context} ${question}`))
  );
}

import { type LessonStepAnswer } from "@zoonk/core/lesson-player/contract";
import { type SpokenAnswerGrade } from "@zoonk/core/library/language/spoken-answer-contract";
import { type MistakePracticeResult } from "@zoonk/core/mistakes/practice";
import { type MistakePracticeAnswerResult } from "@zoonk/core/mistakes/practice-answer";
import { type FinishMistakePracticeResult } from "@zoonk/core/mistakes/practice-finish";
import { type QuestionAnswer } from "@zoonk/core/sessions/contract";
import { NOTHING_REACHED, type Reached } from "@zoonk/core/sessions/reached";
import { type TaskSegment } from "../_components/task-header";
import { mergeReached } from "../_utils/merge-reached";
import { type AnswerSender, isIdeaFirst, isUnchangedAnswer } from "./drill/drill-types";

export type PracticeEntry = Extract<MistakePracticeResult, { status: "ready" }>["practice"][number];

export type PracticeAnswer = QuestionAnswer | LessonStepAnswer;

/**
 * `attemptId` stays the same when an answer is sent again, so the server records one answer per
 * question.
 */
export type MistakePracticeAnswer = {
  answer: PracticeAnswer;
  attemptId: string;
  durationMs: number;
  itemId?: string;
  stepId?: string;
  mistakeId: string;
  runAnswerIds: string[];
};

export type MistakePracticeFeedback =
  | Extract<MistakePracticeAnswerResult, { status: "ready" }>["feedback"]
  | null;

export type MistakePracticeSummary = Extract<
  FinishMistakePracticeResult,
  { status: "ready" }
>["result"];

export type PracticeStep = {
  entry: PracticeEntry;
  firstOfEntry: boolean;
  question: PracticeEntry["questions"][number] | null;
  lesson: PracticeEntry["lesson"];
};

type Graded = NonNullable<MistakePracticeFeedback>;
type PracticeVerdict = "read" | "right" | "wrong";
export type SentPracticeAnswer = {
  answer: PracticeAnswer;
  durationMs: number;
  sender: AnswerSender;
};

type PracticePhase =
  | { kind: "idea" }
  | { kind: "answering"; selected: PracticeAnswer | null }
  | ({ kind: "checking" } & SentPracticeAnswer)
  | ({ kind: "answerFailed" } & SentPracticeAnswer)
  | ({ feedback: Graded; kind: "feedback"; spoken?: SpokenAnswerGrade } & SentPracticeAnswer)
  | { kind: "ending" }
  | { kind: "ended"; summary: MistakePracticeSummary | null };

/**
 * Keeps the questions it started with: an answer refreshes the page, and a fixed mistake leaves the
 * server's practice, not the run.
 */
type PracticeState = {
  answerIds: string[];
  failures: number;
  fixedIds: string[];
  index: number;
  phase: PracticePhase;
  reached: Reached;
  steps: PracticeStep[];
  verdicts: PracticeVerdict[];
};

export type PracticeAction =
  | { type: "start" }
  | { answer: PracticeAnswer | null; type: "select" }
  | ({ type: "check" } & SentPracticeAnswer)
  | { feedback: Graded; mistakeId: string; spoken?: SpokenAnswerGrade; type: "answered" }
  | { type: "answerFailed" }
  | { type: "retry" }
  | { type: "next" }
  | { type: "end" }
  | { summary: MistakePracticeSummary | null; type: "ended" };

function toPracticeSteps(practice: readonly PracticeEntry[]): PracticeStep[] {
  return practice.flatMap<PracticeStep>((entry) => {
    if (entry.lesson) {
      return [{ entry, firstOfEntry: true, lesson: entry.lesson, question: null }];
    }

    return entry.questions.map((question, index) => ({
      entry,
      firstOfEntry: index === 0,
      lesson: null,
      question,
    }));
  });
}

function getOpeningPhase(step: PracticeStep | undefined): PracticePhase {
  if (!step) {
    return { kind: "ending" };
  }

  return step.firstOfEntry && isIdeaFirst(step.entry.drill)
    ? { kind: "idea" }
    : { kind: "answering", selected: null };
}

export function createPracticeState(practice: readonly PracticeEntry[]): PracticeState {
  const steps = toPracticeSteps(practice);

  return {
    answerIds: [],
    failures: 0,
    fixedIds: [],
    index: 0,
    phase: steps.length === 0 ? { kind: "ended", summary: null } : getOpeningPhase(steps[0]),
    reached: NOTHING_REACHED,
    steps,
    verdicts: [],
  };
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
  sender,
}: {
  answer: PracticeAnswer;
  isCorrect: boolean;
  sender: AnswerSender;
}): PracticeVerdict {
  if (sender !== "timer" && "dontKnow" in answer) {
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
    answerIds: action.feedback.answerId
      ? [...state.answerIds, action.feedback.answerId]
      : state.answerIds,
    failures: 0,
    fixedIds: getFixedIds(state, action),
    phase: {
      ...phase,
      answer: action.spoken
        ? { kind: "spokenAnswer" as const, text: action.spoken.transcript }
        : phase.answer,
      feedback: action.feedback,
      kind: "feedback" as const,
      spoken: action.spoken,
    },
    reached: mergeReached(state.reached, action.feedback.reached),
    verdicts: [
      ...state.verdicts,
      action.feedback.lessonResult?.checked === false
        ? "read"
        : getPracticeVerdict({ ...phase, isCorrect: action.feedback.isCorrect }),
    ],
  };
}

export function practiceReducer(state: PracticeState, action: PracticeAction): PracticeState {
  switch (action.type) {
    case "start":
      return { ...state, phase: { kind: "answering", selected: null } };
    case "select":
      return state.phase.kind === "answerFailed" &&
        isUnchangedAnswer(action.answer, state.phase.answer)
        ? state
        : { ...state, phase: { kind: "answering", selected: action.answer } };
    case "check":
      return {
        ...state,
        phase: {
          answer: action.answer,
          durationMs: action.durationMs,
          kind: "checking",
          sender: action.sender,
        },
      };
    case "answered":
      return answered(state, action);
    case "answerFailed":
      return state.phase.kind === "checking"
        ? {
            ...state,
            failures: state.failures + 1,
            phase: { ...state.phase, kind: "answerFailed" },
          }
        : state;
    case "retry":
      return state.phase.kind === "answerFailed"
        ? { ...state, phase: { ...state.phase, kind: "checking" } }
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

export type PracticeEndNote = "missed" | "missedAndUnreached" | "unreached";

export function getPracticeEndNote(state: PracticeState): PracticeEndNote | null {
  const missed = state.verdicts.some((verdict) => verdict !== "right");
  const unreached = state.verdicts.length < state.steps.length;

  if (missed) {
    return unreached ? "missedAndUnreached" : "missed";
  }

  return unreached ? "unreached" : null;
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

export function getPracticeAnswer(state: PracticeState): PracticeAnswer | null {
  if (state.phase.kind === "answering") {
    return state.phase.selected;
  }

  return "answer" in state.phase ? state.phase.answer : null;
}

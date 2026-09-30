import { type CheckpointView } from "@zoonk/core/checkpoints/contract";
import { type StudyBlockCompletionView } from "@zoonk/core/sessions/completion-contract";

/** What the learner picked: an option, true or false for a statement, or a math answer. */
export type CheckpointAnswer = { selectedIndex: number } | { isTrue: boolean } | { number: number };

type DuelPhase = "intro" | "duel" | "result";

type DuelError = "answer" | "finish" | "start";

/**
 * A checkpoint on screen: the intro that says what it asks and what it's worth, the duel one
 * question at a time (right or wrong shows, never the answer or why), and the result, which is
 * when the answers and the traps are finally explained.
 */
export type CheckpointDuelState = {
  completion: StudyBlockCompletionView | null;
  error: DuelError | null;
  /** The last answer and its verdict, shown until the learner moves on. */
  feedback: { answer: CheckpointAnswer; isCorrect: boolean; itemId: string } | null;
  pending: boolean;
  phase: DuelPhase;
  selected: CheckpointAnswer | null;
  /** Each answered question's verdict, by item. */
  verdicts: Record<string, boolean>;
};

type CheckpointDuelAction =
  | { answer: CheckpointAnswer | null; type: "select" }
  | { error: DuelError; type: "failed" }
  | { isCorrect: boolean; itemId: string; type: "answered" }
  | { completion: StudyBlockCompletionView; type: "finished" }
  | { type: "next" }
  | { type: "pending" }
  | { type: "started" };

/** A finished checkpoint opens on its result, a started one where the learner left it. */
export function createDuelState(checkpoint: CheckpointView): CheckpointDuelState {
  const verdicts = Object.fromEntries(
    checkpoint.questions.flatMap((question) =>
      question.answered ? [[question.itemId, question.answered.isCorrect] as const] : [],
    ),
  );

  const phase = checkpoint.status === "completed" ? "result" : "intro";

  return {
    completion: null,
    error: null,
    feedback: null,
    pending: false,
    phase: phase === "intro" && Object.keys(verdicts).length > 0 ? "duel" : phase,
    selected: null,
    verdicts,
  };
}

export function checkpointDuelReducer(
  state: CheckpointDuelState,
  action: CheckpointDuelAction,
): CheckpointDuelState {
  switch (action.type) {
    case "pending":
      return { ...state, error: null, pending: true };
    case "failed":
      return { ...state, error: action.error, pending: false };
    case "started":
      return { ...state, pending: false, phase: "duel" };
    case "select":
      return state.feedback ? state : { ...state, selected: action.answer };
    case "answered":
      return {
        ...state,
        feedback: state.selected
          ? { answer: state.selected, isCorrect: action.isCorrect, itemId: action.itemId }
          : null,
        pending: false,
        selected: null,
        verdicts: { ...state.verdicts, [action.itemId]: action.isCorrect },
      };
    case "next":
      return { ...state, feedback: null };
    case "finished":
      return {
        ...state,
        completion: action.completion,
        feedback: null,
        pending: false,
        phase: "result",
      };
    default:
      return state;
  }
}

/** The first question without a verdict, in the checkpoint's order. */
export function getCurrentQuestion({
  checkpoint,
  state,
}: {
  checkpoint: CheckpointView;
  state: CheckpointDuelState;
}) {
  const feedbackItem = state.feedback?.itemId;

  return (
    checkpoint.questions.find((question) => question.itemId === feedbackItem) ??
    checkpoint.questions.find((question) => state.verdicts[question.itemId] === undefined) ??
    null
  );
}

/** Right answers so far and whether every question has its verdict. */
export function getDuelScore({
  checkpoint,
  state,
}: {
  checkpoint: CheckpointView;
  state: CheckpointDuelState;
}) {
  const verdicts = checkpoint.questions.flatMap((question) => {
    const verdict = state.verdicts[question.itemId];
    return verdict === undefined ? [] : [verdict];
  });

  return {
    answered: verdicts.length,
    correct: verdicts.filter(Boolean).length,
    done: verdicts.length === checkpoint.questions.length,
  };
}

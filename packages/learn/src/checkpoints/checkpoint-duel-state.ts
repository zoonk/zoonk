import { type CheckpointView } from "@zoonk/core/checkpoints/contract";
import { type ListeningSetView } from "@zoonk/core/library/listening/view";
import { type StudyBlockCompletionView } from "@zoonk/core/sessions/completion-contract";

/**
 * What the learner picked: an option, true or false for a statement, a math answer, or a few typed
 * words (a recording's gap to fill).
 */
export type CheckpointAnswer =
  | { selectedIndex: number }
  | { isTrue: boolean }
  | { number: number }
  | { text: string };

/** Who said what in a recording, once its questions are answered. */
type Transcript = NonNullable<ListeningSetView["transcript"]>;

type DuelPhase = "duel" | "result";

type DuelError = "answer" | "finish";

/**
 * A started checkpoint on screen (its challenge page introduced and started it): the duel one
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
  /** A recording's transcript by its set, from the answer that finished its questions. */
  transcripts: Record<string, Transcript>;
  /** Each answered question's verdict, by item. */
  verdicts: Record<string, boolean>;
};

type CheckpointDuelAction =
  | { answer: CheckpointAnswer | null; type: "select" }
  | { error: DuelError; type: "failed" }
  | {
      isCorrect: boolean;
      itemId: string;
      /** The question's recording and its transcript, when this answer finished its questions. */
      recording: { setId: string; transcript: Transcript } | null;
      type: "answered";
    }
  | { completion: StudyBlockCompletionView; type: "finished" }
  | { type: "next" }
  | { type: "pending" };

/** A finished checkpoint opens on its result, a started one where the learner left it. */
export function createDuelState(checkpoint: CheckpointView): CheckpointDuelState {
  const verdicts = Object.fromEntries(
    checkpoint.questions.flatMap((question) =>
      question.answered ? [[question.itemId, question.answered.isCorrect] as const] : [],
    ),
  );

  return {
    completion: null,
    error: null,
    feedback: null,
    pending: false,
    phase: checkpoint.status === "completed" ? "result" : "duel",
    selected: null,
    transcripts: {},
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
        transcripts: action.recording
          ? { ...state.transcripts, [action.recording.setId]: action.recording.transcript }
          : state.transcripts,
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

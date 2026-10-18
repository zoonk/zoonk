import { type CheckpointView, getDuelDecision } from "@zoonk/core/checkpoints/contract";
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
  /**
   * The answer on its way to be graded: the pick can't change meanwhile, and its verdict is shown
   * on this answer, whatever happens on screen while it's graded.
   */
  confirmed: CheckpointAnswer | null;
  error: DuelError | null;
  /** The last answer and its verdict, shown until the learner moves on. */
  feedback: { answer: CheckpointAnswer; isCorrect: boolean; itemId: string } | null;
  pending: boolean;
  phase: DuelPhase;
  /** Updated by core's answer feedback, so the deciding loss needs no reload. */
  reinforcementLessons: number;
  selected: CheckpointAnswer | null;
  /** A recording's transcript by its set, from the answer that finished its questions. */
  transcripts: Record<string, Transcript>;
  /** Each answered question's verdict, by item. */
  verdicts: Record<string, boolean>;
};

type CheckpointDuelAction =
  | { answer: CheckpointAnswer | null; type: "select" }
  | { answer: CheckpointAnswer; type: "confirm" }
  | { error: DuelError; type: "failed" }
  | {
      isCorrect: boolean;
      itemId: string;
      /** The question's recording and its transcript, when this answer finished its questions. */
      recording: { setId: string; transcript: Transcript } | null;
      reinforcementLessons: number | null;
      type: "answered";
    }
  | { completion: StudyBlockCompletionView; type: "finished" }
  | { type: "next" }
  | { type: "pending" };

/**
 * A finished checkpoint opens on its result, a started one where the learner left it. One set aside
 * because its questions were removed before any answer opens on its result too, which has no
 * verdict.
 */
export function createDuelState(checkpoint: CheckpointView): CheckpointDuelState {
  const verdicts = Object.fromEntries([
    ...(checkpoint.answeredQuestions ?? []).map(
      (answer) => [answer.itemId, answer.isCorrect] as const,
    ),
    ...checkpoint.questions.flatMap((question) =>
      question.answered ? [[question.itemId, question.answered.isCorrect] as const] : [],
    ),
  ]);

  return {
    completion: null,
    confirmed: null,
    error: null,
    feedback: null,
    pending: false,
    phase:
      checkpoint.status === "completed" || checkpoint.endedWithoutQuestions ? "result" : "duel",
    reinforcementLessons: checkpoint.reinforcementLessons,
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
    case "confirm":
      return { ...state, confirmed: action.answer, error: null, pending: true };
    case "failed":
      return { ...state, confirmed: null, error: action.error, pending: false };
    case "select":
      return state.feedback || state.pending ? state : { ...state, selected: action.answer };
    case "answered": {
      const answer = state.confirmed ?? state.selected;

      return {
        ...state,
        confirmed: null,
        feedback: answer ? { answer, isCorrect: action.isCorrect, itemId: action.itemId } : null,
        pending: false,
        reinforcementLessons: action.reinforcementLessons ?? state.reinforcementLessons,
        selected: null,
        transcripts: action.recording
          ? { ...state.transcripts, [action.recording.setId]: action.recording.transcript }
          : state.transcripts,
        verdicts: { ...state.verdicts, [action.itemId]: action.isCorrect },
      };
    }
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

/**
 * Right answers so far, whether a boss's duel is decided (won once his shield breaks, lost once it
 * can't anymore: core's `getDuelDecision`) and whether it's over: decided, or every question has
 * its verdict.
 */
export function getDuelScore({
  checkpoint,
  state,
}: {
  checkpoint: CheckpointView;
  state: CheckpointDuelState;
}) {
  const verdicts = Object.values(state.verdicts);

  const questions = new Set([
    ...checkpoint.questions.map((question) => question.itemId),
    ...Object.keys(state.verdicts),
  ]).size;

  const correct = verdicts.filter(Boolean).length;

  const decision = getDuelDecision({
    answered: verdicts.length,
    correct,
    kind: checkpoint.kind,
    passMark: checkpoint.passMark,
    questions,
  });

  return {
    answered: verdicts.length,
    correct,
    decision,
    done: decision !== null || verdicts.length === questions,
    questions,
  };
}

/**
 * The question on screen: the one whose verdict shows, else the first without a verdict, in the
 * checkpoint's order. None once the duel is decided: the questions left aren't asked.
 */
export function getCurrentQuestion({
  checkpoint,
  state,
}: {
  checkpoint: CheckpointView;
  state: CheckpointDuelState;
}) {
  const feedbackItem = state.feedback?.itemId;
  const inFeedback = checkpoint.questions.find((question) => question.itemId === feedbackItem);

  if (inFeedback) {
    return inFeedback;
  }

  if (getDuelScore({ checkpoint, state }).decision) {
    return null;
  }

  return (
    checkpoint.questions.find((question) => state.verdicts[question.itemId] === undefined) ?? null
  );
}

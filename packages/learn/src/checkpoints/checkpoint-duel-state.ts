import { type CheckpointView, getDuelDecision } from "@zoonk/core/checkpoints/contract";
import { type ListeningSetView } from "@zoonk/core/library/listening/view";
import { type StudyBlockCompletionView } from "@zoonk/core/sessions/completion-contract";

export type CheckpointAnswer =
  | { selectedIndex: number }
  | { isTrue: boolean }
  | { number: number }
  | { text: string };

type Transcript = NonNullable<ListeningSetView["transcript"]>;

type DuelPhase = "duel" | "result";

type DuelError = "answer" | "finish";

export type CheckpointDuelState = {
  completion: StudyBlockCompletionView | null;
  confirmed: CheckpointAnswer | null;
  error: DuelError | null;
  feedback: { answer: CheckpointAnswer; isCorrect: boolean; itemId: string } | null;
  pending: boolean;
  phase: DuelPhase;
  reinforcementLessons: number;
  selected: CheckpointAnswer | null;
  transcripts: Record<string, Transcript>;
  verdicts: Record<string, boolean>;
};

type CheckpointDuelAction =
  | { answer: CheckpointAnswer | null; type: "select" }
  | { answer: CheckpointAnswer; type: "confirm" }
  | { error: DuelError; type: "failed" }
  | {
      isCorrect: boolean;
      itemId: string;
      recording: { setId: string; transcript: Transcript } | null;
      reinforcementLessons: number | null;
      type: "answered";
    }
  | { completion: StudyBlockCompletionView; type: "finished" }
  | { type: "next" }
  | { type: "pending" };

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

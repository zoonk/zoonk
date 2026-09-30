import {
  advance,
  continueChallenge,
  continueReading,
  explainFirst,
  goBack,
  resolveCheck,
  skipStepKinds,
  startQuickCheck,
} from "./_utils/lesson-flow";
import { isReadStep } from "./_utils/lesson-steps";
import {
  type LessonPlayerAction,
  type LessonPlayerState,
  createInitialState,
  getCurrentStep,
} from "./lesson-player-state";

type ActionOf<TType extends LessonPlayerAction["type"]> = Extract<
  LessonPlayerAction,
  { type: TType }
>;

function selectAnswer(
  state: LessonPlayerState,
  action: ActionOf<"selectAnswer">,
): LessonPlayerState {
  if (state.phase !== "playing") {
    return state;
  }

  if (!action.answer) {
    return {
      ...state,
      answers: Object.fromEntries(
        Object.entries(state.answers).filter(([id]) => id !== action.stepId),
      ),
    };
  }

  return { ...state, answers: { ...state.answers, [action.stepId]: action.answer } };
}

function continueFrom(state: LessonPlayerState): LessonPlayerState {
  if (state.phase === "feedback") {
    return advance(state);
  }

  const step = getCurrentStep(state);

  if (state.phase === "playing" && step?.kind === "challenge") {
    return continueChallenge(state);
  }

  if (state.phase === "playing" && step && isReadStep(step)) {
    return continueReading(state);
  }

  return state;
}

function navigate(state: LessonPlayerState, action: ActionOf<"navigate">): LessonPlayerState {
  if (state.phase !== "playing") {
    return state;
  }

  return action.direction === "prev" ? goBack(state) : continueFrom(state);
}

function confirmCheck(
  state: LessonPlayerState,
  action: ActionOf<"checkConfirmed">,
): LessonPlayerState {
  const current = state.results[action.stepId];

  if (!current) {
    return state;
  }

  const { nextReviewAt, savedMistake } = action.result;

  return {
    ...state,
    results: { ...state.results, [action.stepId]: { ...current, nextReviewAt, savedMistake } },
  };
}

/** A typed or spoken answer is being graded: the screen waits for the verdict. */
function startChecking(state: LessonPlayerState): LessonPlayerState {
  return state.phase === "playing"
    ? { ...state, checkFailed: false, checkIssue: null, phase: "checking" }
    : state;
}

/**
 * The server didn't grade the answer: the learner can try again, told why when it wasn't the
 * connection (nothing heard, or their small AI help needs a break or is used up).
 */
function failCheck(state: LessonPlayerState, action: ActionOf<"checkFailed">): LessonPlayerState {
  if (state.phase !== "checking") {
    return state;
  }

  return { ...state, checkFailed: true, checkIssue: action.issue ?? null, phase: "playing" };
}

/** Starting over plays the same lesson from the top in a new run. */
function restart(state: LessonPlayerState): LessonPlayerState {
  return createInitialState(
    { id: state.lessonId, steps: Object.values(state.steps) },
    state.support,
  );
}

function setCompletionStatus(
  state: LessonPlayerState,
  status: "failed" | "saving",
): LessonPlayerState {
  return state.completion ? { ...state, completion: { ...state.completion, status } } : state;
}

function completionSaved(
  state: LessonPlayerState,
  action: ActionOf<"completionSaved">,
): LessonPlayerState {
  return state.completion
    ? { ...state, completion: { ...state.completion, result: action.result, status: "saved" } }
    : state;
}

/**
 * The one lesson reducer: every screen kind, both modes. It has no idea how a mode looks; skins
 * read its state. Network work happens outside it and reports back through actions.
 */
export function lessonPlayerReducer(
  state: LessonPlayerState,
  action: LessonPlayerAction,
): LessonPlayerState {
  switch (action.type) {
    case "selectAnswer":
      return selectAnswer(state, action);
    case "continue":
      return continueFrom(state);
    case "skipKinds":
      return skipStepKinds(state, action.kinds);
    case "navigate":
      return navigate(state, action);
    case "explainFirst":
      return explainFirst(state);
    case "knowThis":
      return startQuickCheck(state);
    case "restart":
      return restart(state);
    case "checkStarted":
      return startChecking(state);
    case "checkResolved":
      return state.phase === "completed" ? state : resolveCheck(state, action);
    case "checkFailed":
      return failCheck(state, action);
    case "checkConfirmed":
      return confirmCheck(state, action);
    case "runStarting":
      return { ...state, run: { status: "starting" } };
    case "runStarted":
      return {
        ...state,
        run: { hyperdrive: action.hyperdrive, runId: action.runId, status: "started" },
      };
    case "runRefused":
      return { ...state, run: { refusal: action.refusal, status: "refused" } };
    case "completionSaved":
      return completionSaved(state, action);
    case "completionFailed":
      return setCompletionStatus(state, "failed");
    case "completionRetried":
      return setCompletionStatus(state, "saving");
    default:
      return action satisfies never;
  }
}

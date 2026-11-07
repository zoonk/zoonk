import { isAtEnd, leaveMap, setCompletionStatus } from "./_utils/lesson-end";
import {
  advance,
  continueChallenge,
  continueReading,
  explainFirst,
  goBack,
  resolveCheck,
  skipSteps,
  startQuickCheck,
} from "./_utils/lesson-flow";
import { isReadStep } from "./_utils/lesson-steps";
import { placeUnsent, restartChanged, resyncRun, startRun } from "./_utils/run-placement";
import { restoreWriting, skipWriting } from "./_utils/writing-skip";
import {
  type LessonPlayerAction,
  type LessonPlayerState,
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

  if (state.phase === "map") {
    return leaveMap(state);
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
  if (state.phase !== "playing" && state.phase !== "map") {
    return state;
  }

  return action.direction === "prev" ? goBack(state) : continueFrom(state);
}

function confirmCheck(
  state: LessonPlayerState,
  action: ActionOf<"checkConfirmed">,
): LessonPlayerState {
  const current = state.results[action.stepId];

  if (!current || current.attemptId !== action.attemptId) {
    return state;
  }

  const { nextReviewAt, savedMistake } = action.result;

  return {
    ...state,
    results: { ...state.results, [action.stepId]: { ...current, nextReviewAt, savedMistake } },
  };
}

function startChecking(state: LessonPlayerState): LessonPlayerState {
  return state.phase === "playing"
    ? { ...state, checkFailed: false, checkIssue: null, phase: "checking" }
    : state;
}

function failCheck(state: LessonPlayerState, action: ActionOf<"checkFailed">): LessonPlayerState {
  if (state.phase !== "checking") {
    return state;
  }

  return { ...state, checkFailed: true, checkIssue: action.issue ?? null, phase: "playing" };
}

function completionSaved(
  state: LessonPlayerState,
  action: ActionOf<"completionSaved">,
): LessonPlayerState {
  return state.completion
    ? { ...state, completion: { ...state.completion, result: action.result, status: "saved" } }
    : state;
}

function recordVerdict(state: LessonPlayerState, action: ActionOf<"checkResolved">) {
  return isAtEnd(state) ? state : resolveCheck(state, action);
}

const SERVER_ACTION_TYPES = [
  "allSaved",
  "completionFailed",
  "completionRetried",
  "completionSaved",
  "runRefused",
  "runResynced",
  "runStarted",
  "runStarting",
  "saveFailed",
  "unsentPlaced",
] as const;

type ServerAction = ActionOf<(typeof SERVER_ACTION_TYPES)[number]>;

function isServerAction(action: LessonPlayerAction): action is ServerAction {
  return SERVER_ACTION_TYPES.some((type) => type === action.type);
}

function reduceServerAction(state: LessonPlayerState, action: ServerAction): LessonPlayerState {
  switch (action.type) {
    case "runStarting":
      return { ...state, run: { status: "starting" } };
    case "runStarted":
      return restartChanged(state, startRun(state, action));
    case "runResynced":
      return restartChanged(state, resyncRun(state, action));
    case "runRefused":
      return { ...state, run: { refusal: action.refusal, status: "refused" } };
    case "unsentPlaced":
      return restartChanged(state, placeUnsent(state, action));
    case "saveFailed":
      return state.unsavedAnswers ? state : { ...state, unsavedAnswers: true };
    case "allSaved":
      return state.unsavedAnswers ? { ...state, unsavedAnswers: false } : state;
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

const LEARNER_WORK = new Set<LessonPlayerAction["type"]>([
  "checkResolved",
  "checkStarted",
  "explainFirst",
  "knowThis",
  "selectAnswer",
  "skipWriting",
  "writingRestored",
]);

function isLearnerWork(action: LessonPlayerAction): boolean {
  return LEARNER_WORK.has(action.type) && !(action.type === "skipWriting" && action.opening);
}

function markActedOn({
  action,
  next,
  state,
}: {
  action: LessonPlayerAction;
  next: LessonPlayerState;
  state: LessonPlayerState;
}): LessonPlayerState {
  const stepId = ("stepId" in action ? action.stepId : undefined) ?? getCurrentStep(state)?.id;

  if (!stepId || next.actedOn.includes(stepId)) {
    return next;
  }

  return { ...next, actedOn: [...next.actedOn, stepId] };
}

function reduceLearnerAction(
  state: LessonPlayerState,
  action: Exclude<LessonPlayerAction, ServerAction>,
): LessonPlayerState {
  switch (action.type) {
    case "selectAnswer":
      return selectAnswer(state, action);
    case "continue":
      return continueFrom(state);
    case "skipWriting":
      return skipWriting(state, action);
    case "writingRestored":
      return restoreWriting(state);
    case "skipSteps":
      return skipSteps(state, action.stepIds);
    case "navigate":
      return navigate(state, action);
    case "explainFirst":
      return explainFirst(state);
    case "knowThis":
      return startQuickCheck(state);
    case "checkStarted":
      return startChecking(state);
    case "checkResolved":
      return recordVerdict(state, action);
    case "checkFailed":
      return failCheck(state, action);
    case "checkConfirmed":
      return confirmCheck(state, action);
    default:
      return action satisfies never;
  }
}

export function lessonPlayerReducer(
  state: LessonPlayerState,
  action: LessonPlayerAction,
): LessonPlayerState {
  if (isServerAction(action)) {
    return reduceServerAction(state, action);
  }

  const next = reduceLearnerAction(state, action);

  if (next === state) {
    return next;
  }

  if (action.type === "continue" || action.type === "navigate") {
    return next.moved ? next : { ...next, moved: true };
  }

  return isLearnerWork(action) ? markActedOn({ action, next, state }) : next;
}

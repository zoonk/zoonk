import { isAtEnd, leaveMap } from "./_utils/lesson-end";
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
import { getRunVerdicts, requeueRetries, resumeLesson } from "./_utils/lesson-resume";
import { isReadStep } from "./_utils/lesson-steps";
import { restorePicturedSteps } from "./_utils/restore-pictured-steps";
import { restoreWriting, skipWriting } from "./_utils/writing-skip";
import {
  type LessonPlayerAction,
  type LessonPlayerState,
  createInitialState,
  getCurrentStep,
} from "./lesson-player-state";
import { type LessonRunAnswers } from "./lesson-player-types";

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

function setCompletionStatus(
  state: LessonPlayerState,
  status: "failed" | "saving",
): LessonPlayerState {
  return state.completion ? { ...state, completion: { ...state.completion, status } } : state;
}

function isSameList(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((id, index) => b[index] === id);
}

function isSameProgress(a: Record<string, boolean>, b: Record<string, boolean>): boolean {
  const entries = Object.entries(a);

  return (
    entries.length === Object.keys(b).length && entries.every(([id, value]) => b[id] === value)
  );
}

function resumeFrom(state: LessonPlayerState, answers: LessonRunAnswers): LessonPlayerState {
  const fresh = createInitialState({
    hasMap: state.hasMap,
    id: state.lessonId,
    steps: Object.values(state.steps),
  });

  const writingRestore = state.notice === "writingSkipped" ? state.writingRestore : null;

  const skippedWritingStepIds =
    writingRestore?.skippedWritingStepIds ?? state.skippedWritingStepIds;

  const available = {
    ...fresh,
    queue: fresh.queue.filter(
      (id) => ![...state.unavailableStepIds, ...skippedWritingStepIds].includes(id),
    ),
  };

  if (available.queue.length === 0) {
    return state;
  }

  const resumed = {
    ...resumeLesson(available, answers),
    rounds: Object.fromEntries(
      Object.keys(state.steps).map((id) => [id, (state.rounds[id] ?? 0) + 1]),
    ),
    run: state.run,
    skippedWritingStepIds,
    unavailableStepIds: state.unavailableStepIds,
    unsavedAnswers: state.unsavedAnswers,
  };

  return writingRestore ? skipWriting(resumed, { opening: true }) : resumed;
}

function startRun(state: LessonPlayerState, action: ActionOf<"runStarted">): LessonPlayerState {
  const startedAt = Date.parse(action.startedAt);

  const run = {
    carriedStepIds: action.answers
      .filter((answer) => Date.parse(answer.answeredAt) < startedAt)
      .map((answer) => answer.stepId),
    hyperdrive: action.hyperdrive,
    replay: action.replay,
    runId: action.runId,
    status: "started" as const,
  };

  const started = skipSteps({ ...state, run }, action.optionalStepIds ?? []);

  const answers = [...action.answers, ...action.held].filter(
    (answer) => answer.stepId in state.steps,
  );

  if (!isUntouched(state)) {
    return started;
  }

  if (!isSameProgress(state.firstVerdicts, getRunVerdicts(answers))) {
    return resumeFrom(started, answers);
  }

  return placeRetries(started, answers);
}

function isUntouched(state: LessonPlayerState): boolean {
  return (
    Object.keys(state.answers).length === 0 &&
    Object.keys(state.results).length === 0 &&
    !state.quickCheck
  );
}

/**
 * Answers that only change how often a screen was tried (a miss counted twice because its reply was
 * lost) change which checks come back at the end, not the screen the learner is on.
 */
function placeRetries(state: LessonPlayerState, answers: LessonRunAnswers): LessonPlayerState {
  const requeued = requeueRetries(state, answers);

  if (isSameList(requeued.queue, state.queue)) {
    return state;
  }

  const keepsScreen =
    !isAtEnd(state) && requeued.queue[state.position] === state.queue[state.position];

  return keepsScreen ? requeued : resumeFrom(state, answers);
}

function placeUnsent(
  state: LessonPlayerState,
  action: ActionOf<"unsentPlaced">,
): LessonPlayerState {
  return isUntouched(state) ? resumeFrom(state, action.answers) : state;
}

function resyncRun(state: LessonPlayerState, action: ActionOf<"runResynced">): LessonPlayerState {
  if (state.phase !== "completed") {
    return state;
  }

  if (
    state.run.status === "started" &&
    action.runId !== undefined &&
    action.runId !== state.run.runId
  ) {
    return setCompletionStatus(state, "failed");
  }

  const optionalStepIds = action.optionalStepIds ?? [];
  const available = skipSteps(state, optionalStepIds);
  const missing = resumeFrom(available, action.answers);

  if (!isAtEnd(missing)) {
    return { ...missing, notice: "answerNotSaved" };
  }

  const pictures = (action.pictures ?? []).filter(
    (picture) => !optionalStepIds.includes(picture.stepId),
  );

  const pictured = resumeFrom(restorePicturedSteps(available, pictures), action.answers);

  return isAtEnd(pictured)
    ? setCompletionStatus(state, "failed")
    : { ...pictured, notice: "pictureReady" };
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
      return startRun(state, action);
    case "runResynced":
      return resyncRun(state, action);
    case "runRefused":
      return { ...state, run: { refusal: action.refusal, status: "refused" } };
    case "unsentPlaced":
      return placeUnsent(state, action);
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

export function lessonPlayerReducer(
  state: LessonPlayerState,
  action: LessonPlayerAction,
): LessonPlayerState {
  if (isServerAction(action)) {
    return reduceServerAction(state, action);
  }

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
    case "recordingStarted":
      return state.checkFailed ? { ...state, checkFailed: false, checkIssue: null } : state;
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

import {
  advance,
  continueChallenge,
  continueReading,
  explainFirst,
  goBack,
  resolveCheck,
  skipStepKinds,
  skipSteps,
  startQuickCheck,
} from "./_utils/lesson-flow";
import { getRunVerdicts, resumeLesson } from "./_utils/lesson-resume";
import { isReadStep } from "./_utils/lesson-steps";
import { restorePicturedSteps } from "./_utils/restore-pictured-steps";
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

function setCompletionStatus(
  state: LessonPlayerState,
  status: "failed" | "saving",
): LessonPlayerState {
  return state.completion ? { ...state, completion: { ...state.completion, status } } : state;
}

/** Whether two sets of first verdicts are the same answers. */
function isSameProgress(a: Record<string, boolean>, b: Record<string, boolean>): boolean {
  const entries = Object.entries(a);

  return (
    entries.length === Object.keys(b).length && entries.every(([id, value]) => b[id] === value)
  );
}

/** The lesson from the top, continued from the run's answers. */
function resumeFrom(state: LessonPlayerState, answers: LessonRunAnswers): LessonPlayerState {
  const fresh = createInitialState(
    { id: state.lessonId, steps: Object.values(state.steps) },
    state.support,
  );

  const available = {
    ...fresh,
    queue: fresh.queue.filter(
      (id) => ![...state.unavailableStepIds, ...state.skippedWritingStepIds].includes(id),
    ),
  };

  if (available.queue.length === 0) {
    return state;
  }

  return {
    ...resumeLesson(available, answers),
    run: state.run,
    skippedWritingStepIds: state.skippedWritingStepIds,
    unavailableStepIds: state.unavailableStepIds,
  };
}

/**
 * The run started. When it already holds answers the screen doesn't show (the learner came back
 * to an open run), the lesson continues from them. Once the learner answered anything here, their
 * screen leads.
 */
function startRun(state: LessonPlayerState, action: ActionOf<"runStarted">): LessonPlayerState {
  const startedAt = Date.parse(action.startedAt);

  const run = {
    carriedStepIds: action.answers
      .filter((answer) => Date.parse(answer.answeredAt) < startedAt)
      .map((answer) => answer.stepId),
    hyperdrive: action.hyperdrive,
    runId: action.runId,
    status: "started" as const,
  };

  const started = skipSteps({ ...state, run }, action.optionalStepIds ?? []);
  const isUntouched = Object.keys(state.results).length === 0 && !state.quickCheck;
  const answers = action.answers.filter((answer) => answer.stepId in state.steps);

  if (!isUntouched || isSameProgress(state.firstVerdicts, getRunVerdicts(answers))) {
    return started;
  }

  return resumeFrom(started, answers);
}

/**
 * The server couldn't finish the lesson because an answer the screens show never reached it: the
 * lesson goes back to the first screen it's missing, never to a save that can't succeed. A
 * question left out because its picture was missing stays out of the run, as the server leaves it
 * out once its picture comes late (`isPictureLateForRun`). Only when nothing else is missing does
 * the server still ask for one: its picture came within its wait and this screen never got it, so
 * the question comes back with it.
 */
function resyncRun(state: LessonPlayerState, action: ActionOf<"runResynced">): LessonPlayerState {
  if (state.phase !== "completed") {
    return state;
  }

  /** A host returning another sitting cannot describe the answers or omissions of this run. */
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

  if (missing.phase !== "completed") {
    return { ...missing, notice: "answerNotSaved" };
  }

  const pictures = (action.pictures ?? []).filter(
    (picture) => !optionalStepIds.includes(picture.stepId),
  );

  const pictured = resumeFrom(restorePicturedSteps(available, pictures), action.answers);

  return pictured.phase === "completed"
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

/**
 * The one lesson reducer: every screen kind. It has no idea how the lesson looks; the player's
 * parts read its state. Network work happens outside it and reports back through actions.
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
      return skipStepKinds(state, action.kinds, action.stepIds);
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
      return state.phase === "completed" ? state : resolveCheck(state, action);
    case "checkFailed":
      return failCheck(state, action);
    case "checkConfirmed":
      return confirmCheck(state, action);
    case "runStarting":
      return { ...state, run: { status: "starting" } };
    case "runStarted":
      return startRun(state, action);
    case "runResynced":
      return resyncRun(state, action);
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

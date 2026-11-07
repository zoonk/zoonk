import { isAnswerableStep } from "@zoonk/core/lesson-player/run";
import {
  type LessonPlayerAction,
  type LessonPlayerState,
  createInitialState,
} from "../lesson-player-state";
import { type LessonRunAnswers } from "../lesson-player-types";
import { isAtEnd, setCompletionStatus } from "./lesson-end";
import { enterPosition, skipSteps } from "./lesson-flow";
import {
  addHeldAnswers,
  getRunVerdicts,
  mergeUntouched,
  refreshAnswers,
  requeueRetries,
  resumeLesson,
} from "./lesson-resume";
import { pickKeys } from "./records";
import { restorePicturedSteps } from "./restore-pictured-steps";
import { skipWriting } from "./writing-skip";

function isSameList(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((id, index) => b[index] === id);
}

function isSameProgress(a: Record<string, boolean>, b: Record<string, boolean>): boolean {
  const entries = Object.entries(a);

  return (
    entries.length === Object.keys(b).length && entries.every(([id, value]) => b[id] === value)
  );
}

/** A guess is never sent, so only this page knows it. */
function getGuessIds(state: LessonPlayerState): string[] {
  return Object.keys(state.results).filter((id) => {
    const step = state.steps[id];
    return step !== undefined && !isAnswerableStep(step);
  });
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

  const resumedLesson = resumeLesson(available, answers);
  const guessIds = getGuessIds(state);

  const resumed = {
    ...resumedLesson,
    actedOn: state.actedOn,
    answers: { ...pickKeys(state.answers, guessIds), ...resumedLesson.answers },
    moved: state.moved,
    results: { ...pickKeys(state.results, guessIds), ...resumedLesson.results },
    rounds: state.rounds,
    run: state.run,
    skippedWritingStepIds,
    unavailableStepIds: state.unavailableStepIds,
    unsavedAnswers: state.unsavedAnswers,
  };

  return writingRestore ? skipWriting(resumed, { opening: true }) : resumed;
}

function showsSameAnswer({
  after,
  before,
  id,
}: {
  after: LessonPlayerState;
  before: LessonPlayerState;
  id: string;
}): boolean {
  return (
    id in before.results === id in after.results &&
    JSON.stringify(before.answers[id]) === JSON.stringify(after.answers[id])
  );
}

/** Screens whose renderers seed themselves from the answer start anew only when placing changes it. */
export function restartChanged(
  before: LessonPlayerState,
  after: LessonPlayerState,
): LessonPlayerState {
  const changed = Object.keys(after.steps).filter(
    (id) => after.rounds[id] === before.rounds[id] && !showsSameAnswer({ after, before, id }),
  );

  if (changed.length === 0) {
    return after;
  }

  const rounds = changed.map((id) => [id, (after.rounds[id] ?? 0) + 1] as const);
  return { ...after, rounds: { ...after.rounds, ...Object.fromEntries(rounds) } };
}

function hasActed(state: LessonPlayerState): boolean {
  return state.moved || state.actedOn.length > 0;
}

export function startRun(
  state: LessonPlayerState,
  action: Extract<LessonPlayerAction, { type: "runStarted" }>,
): LessonPlayerState {
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

  const answers = addHeldAnswers(action.answers, action.held).filter(
    (answer) => answer.stepId in state.steps,
  );

  if (hasActed(state)) {
    return mergeUntouched(started, answers);
  }

  if (!isSameProgress(state.firstVerdicts, getRunVerdicts(answers))) {
    return resumeFrom(started, answers);
  }

  return placeRetries(refreshAnswers(started, answers), answers);
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

export function placeUnsent(
  state: LessonPlayerState,
  action: Extract<LessonPlayerAction, { type: "unsentPlaced" }>,
): LessonPlayerState {
  return hasActed(state)
    ? mergeUntouched(state, action.answers)
    : resumeFrom(state, action.answers);
}

function getMissing({
  answers,
  leftOut,
  state,
}: {
  answers: LessonRunAnswers;
  leftOut: readonly string[];
  state: LessonPlayerState;
}): LessonPlayerState["missing"] {
  const answered = new Set(answers.map((answer) => answer.stepId));

  const ids = [...new Set(state.queue)].filter((id) => {
    const step = state.steps[id];
    return step !== undefined && isAnswerableStep(step) && !answered.has(id);
  });

  return Object.fromEntries(
    ids.map((id) => [id, leftOut.includes(id) ? "pictureReady" : "answerNotSaved"]),
  );
}

export function resyncRun(
  state: LessonPlayerState,
  action: Extract<LessonPlayerAction, { type: "runResynced" }>,
): LessonPlayerState {
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

  const pictures = (action.pictures ?? []).filter(
    (picture) => !optionalStepIds.includes(picture.stepId),
  );

  const resumed = resumeFrom(restorePicturedSteps(available, pictures), action.answers);

  const missing = getMissing({
    answers: action.answers,
    leftOut: available.unavailableStepIds,
    state: resumed,
  });

  const first = resumed.queue.findIndex((id) => id in missing);

  if (first === -1) {
    return setCompletionStatus(state, "failed");
  }

  return enterPosition({ ...resumed, completion: null, missing }, first);
}

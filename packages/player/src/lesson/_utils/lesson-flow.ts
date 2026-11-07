import { type LessonPlayerState, getCurrentStep } from "../lesson-player-state";
import { type LessonStepResult, type PlayableLibraryStep } from "../lesson-player-types";
import { getChallengeProgress } from "./challenge-progress";
import { finishScreens, isAtEnd } from "./lesson-end";
import {
  canSelfCorrect,
  getExplanationsAfter,
  getQuickCheckQueue,
  isQuestionStep,
  isRetryStep,
} from "./lesson-steps";
import { omitKeys } from "./records";

function startOver(state: LessonPlayerState, ids: readonly string[]): LessonPlayerState {
  const rounds = ids.map((id) => [id, (state.rounds[id] ?? 0) + 1] as const);

  return {
    ...state,
    answers: omitKeys(state.answers, ids),
    results: omitKeys(state.results, ids),
    rounds: { ...state.rounds, ...Object.fromEntries(rounds) },
  };
}

function isLaterCopy(state: LessonPlayerState, position: number): boolean {
  return state.queue.indexOf(state.queue[position] ?? "") < position;
}

function startsOver(state: LessonPlayerState, position: number): boolean {
  const id = state.queue[position] ?? "";
  return id in state.results && (state.quickCheck !== null || isLaterCopy(state, position));
}

function awaitsMissingAnswer(state: LessonPlayerState, id: string): boolean {
  return id in state.missing && !(id in state.firstVerdicts) && !(id in state.results);
}

function getEntryNotice(state: LessonPlayerState, id: string): LessonPlayerState["notice"] {
  if (id in state.results) {
    return null;
  }

  if (state.selfCorrected.includes(id)) {
    return "selfCorrect";
  }

  return awaitsMissingAnswer(state, id) ? (state.missing[id] ?? null) : null;
}

function showPosition(state: LessonPlayerState, position: number): LessonPlayerState {
  const id = state.queue[position] ?? "";
  const reviewing = id in state.results;

  return {
    ...state,
    checkFailed: false,
    checkIssue: null,
    notice: getEntryNotice(state, id),
    phase: reviewing ? "feedback" : "playing",
    position,
    reviewing,
    stepStartedAt: Date.now(),
  };
}

export function enterPosition(state: LessonPlayerState, position: number): LessonPlayerState {
  const id = state.queue[position] ?? "";
  return showPosition(startsOver(state, position) ? startOver(state, [id]) : state, position);
}

function leaveQuickCheck(state: LessonPlayerState): LessonPlayerState {
  const { quickCheck } = state;

  if (!quickCheck) {
    return state;
  }

  const answered = state.queue.filter((id) => state.results[id]);
  const passed = new Set(answered.filter((id) => state.results[id]?.isCorrect));
  const missed = answered.filter((id) => !passed.has(id));

  const rest = quickCheck.returnQueue.filter(
    (id, index) => index <= quickCheck.returnPosition || (!passed.has(id) && !missed.includes(id)),
  );

  const left = {
    ...state,
    queue: [...rest, ...missed],
    quickCheck: null,
    retried: [...new Set([...state.retried, ...missed])],
  };

  return enterPosition(startOver(left, missed), quickCheck.returnPosition);
}

function isStillNeeded(state: LessonPlayerState, position: number): boolean {
  return awaitsMissingAnswer(state, state.queue[position] ?? "") || isLaterCopy(state, position);
}

/**
 * Once a finished lesson comes back incomplete, Continue goes only to what the run still needs,
 * except through "I know this", whose every check counts.
 */
function getNextPosition(state: LessonPlayerState): number {
  if (state.quickCheck || Object.keys(state.missing).length === 0) {
    return state.position + 1;
  }

  const next = state.queue.findIndex(
    (_, index) => index > state.position && isStillNeeded(state, index),
  );

  return next === -1 ? state.queue.length : next;
}

export function advance(state: LessonPlayerState): LessonPlayerState {
  if (state.quickCheck?.missed) {
    return leaveQuickCheck(state);
  }

  const queue = state.queue.filter(
    (id, index) => index <= state.position || !state.unavailableStepIds.includes(id),
  );

  const available = queue.length === state.queue.length ? state : { ...state, queue };
  const next = getNextPosition(available);

  if (next >= queue.length) {
    return finishScreens(available);
  }

  return enterPosition(available, next);
}

export function leaveOutAhead(
  state: LessonPlayerState,
  isLeftOut: (stepId: string) => boolean,
  completionStatus: "ready" | "saving",
): LessonPlayerState {
  if (isAtEnd(state)) {
    return state;
  }

  const start = state.position + (state.phase === "playing" ? 0 : 1);
  const ahead = state.queue.slice(start).filter((id) => !isLeftOut(id));

  if (ahead.length === state.queue.length - start) {
    return state;
  }

  const next = { ...state, queue: [...state.queue.slice(0, start), ...ahead] };

  if (next.queue[state.position] === state.queue[state.position]) {
    return next;
  }

  return state.position >= next.queue.length
    ? finishScreens(next, completionStatus)
    : enterPosition(next, state.position);
}

export function skipSteps(state: LessonPlayerState, stepIds: readonly string[]): LessonPlayerState {
  const added = stepIds.filter((id) => id in state.steps && !state.unavailableStepIds.includes(id));

  if (added.length === 0) {
    return state;
  }

  const unavailableStepIds = [...state.unavailableStepIds, ...new Set(added)];
  const isLeftOut = (id: string) => unavailableStepIds.includes(id);

  const quickCheck = state.quickCheck && {
    ...state.quickCheck,
    returnPosition: state.quickCheck.returnQueue
      .slice(0, state.quickCheck.returnPosition)
      .filter((id) => !isLeftOut(id)).length,
    returnQueue: state.quickCheck.returnQueue.filter((id) => !isLeftOut(id)),
  };

  return leaveOutAhead({ ...state, quickCheck, unavailableStepIds }, isLeftOut, "ready");
}

export function continueReading(state: LessonPlayerState): LessonPlayerState {
  const step = getCurrentStep(state);

  if (step?.kind !== "workedExample") {
    return advance(state);
  }

  const shown = state.revealed[step.id] ?? 1;

  if (shown >= step.content.steps.length) {
    return advance(state);
  }

  return { ...state, revealed: { ...state.revealed, [step.id]: shown + 1 } };
}

export function continueChallenge(state: LessonPlayerState): LessonPlayerState {
  const step = getCurrentStep(state);

  if (step?.kind !== "challenge") {
    return state;
  }

  const shown = state.revealed[step.id] ?? 0;
  const progress = getChallengeProgress({ answer: state.answers[step.id], shown, step });

  const canMove =
    progress.stage === "intro" || (progress.stage === "deciding" && progress.pendingChoiceId);

  return canMove ? { ...state, revealed: { ...state.revealed, [step.id]: shown + 1 } } : state;
}

export function goBack(state: LessonPlayerState): LessonPlayerState {
  const position = state.phase === "map" ? state.position : state.position - 1;

  if (!canGoBack(state) || !state.queue[position]) {
    return state;
  }

  return showPosition(state, position);
}

/**
 * A missed question that came back holds its attempt in the later copy, so the earlier one, its
 * result cleared, would show it unanswered and let the learner answer it twice.
 */
function isEarlierCopy(state: LessonPlayerState, position: number): boolean {
  const id = state.queue[position] ?? "";
  return !(id in state.results) && state.queue.includes(id, position + 1);
}

export function canGoBack(state: LessonPlayerState): boolean {
  if (state.run.status === "refused") {
    return false;
  }

  if (state.phase === "map") {
    return true;
  }

  return (
    state.phase === "playing" &&
    state.position > 0 &&
    !state.quickCheck &&
    !isEarlierCopy(state, state.position - 1)
  );
}

function offerSelfCorrection({
  isFirst,
  state,
  stepId,
}: {
  isFirst: boolean;
  state: LessonPlayerState;
  stepId: string;
}): LessonPlayerState {
  return {
    ...state,
    checkFailed: false,
    firstVerdicts: isFirst ? { ...state.firstVerdicts, [stepId]: false } : state.firstVerdicts,
    notice: "selfCorrect",
    phase: "playing",
    selfCorrected: [...state.selfCorrected, stepId],
  };
}

function getMisses({
  counts,
  isCorrect,
  state,
  step,
}: {
  counts: boolean;
  isCorrect: boolean;
  state: LessonPlayerState;
  step: PlayableLibraryStep | undefined;
}): LessonPlayerState["misses"] {
  if (!counts || !step) {
    return state.misses;
  }

  return isCorrect ? [] : [...state.misses, { skillId: step.skillId, stepId: step.id }];
}

export function resolveCheck(
  state: LessonPlayerState,
  { counts, result, stepId }: { counts: boolean; result: LessonStepResult; stepId: string },
): LessonPlayerState {
  const step = state.steps[stepId];
  const isFirst = counts && !(stepId in state.firstVerdicts);
  const isMiss = counts && !result.isCorrect;

  if (
    isMiss &&
    step &&
    canSelfCorrect(step) &&
    !state.quickCheck &&
    !state.selfCorrected.includes(stepId)
  ) {
    return offerSelfCorrection({ isFirst, state, stepId });
  }

  const willRetry =
    isMiss &&
    !state.quickCheck &&
    step &&
    isRetryStep(step) &&
    ![...state.retried, ...state.unavailableStepIds].includes(stepId);

  const resolved: LessonPlayerState = {
    ...state,
    checkFailed: false,
    firstVerdicts: isFirst
      ? { ...state.firstVerdicts, [stepId]: result.isCorrect }
      : state.firstVerdicts,
    misses: getMisses({ counts, isCorrect: result.isCorrect, state, step }),
    notice: state.notice === "writingSkipped" ? state.notice : null,
    phase: "feedback",
    queue: willRetry ? [...state.queue, stepId] : state.queue,
    quickCheck:
      state.quickCheck && isMiss ? { ...state.quickCheck, missed: true } : state.quickCheck,
    results: { ...state.results, [stepId]: result },
    retried: willRetry ? [...state.retried, stepId] : state.retried,
  };

  return step?.kind === "matchColumns" ? advance(resolved) : resolved;
}

export function explainFirst(state: LessonPlayerState): LessonPlayerState {
  const step = getCurrentStep(state);

  if (state.phase !== "playing" || !step || !isQuestionStep(step)) {
    return state;
  }

  const ids = getExplanationsAfter(state);

  if (ids.length === 0) {
    return state;
  }

  const before = state.queue.slice(0, state.position);
  const rest = state.queue.slice(state.position).filter((id) => !ids.includes(id));

  return {
    ...state,
    helped: [...state.helped, step.id],
    queue: [...before, ...ids, ...rest],
    stepStartedAt: Date.now(),
  };
}

export function startQuickCheck(state: LessonPlayerState): LessonPlayerState {
  const queue = getQuickCheckQueue(state);

  if (state.phase !== "playing" || state.quickCheck || queue.length === 0) {
    return state;
  }

  return enterPosition(
    {
      ...state,
      queue,
      quickCheck: { missed: false, returnPosition: state.position, returnQueue: state.queue },
    },
    0,
  );
}

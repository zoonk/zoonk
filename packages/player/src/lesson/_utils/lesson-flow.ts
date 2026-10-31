import { type LessonPlayerState, getCurrentStep } from "../lesson-player-state";
import { type LessonStepResult, type PlayableLibraryStep } from "../lesson-player-types";
import { getChallengeProgress } from "./challenge-progress";
import {
  canSelfCorrect,
  getExplanationsAfter,
  getQuickCheckQueue,
  isQuestionStep,
  isRetryStep,
} from "./lesson-steps";

function omitKey<TValue>(record: Record<string, TValue>, key: string): Record<string, TValue> {
  return Object.fromEntries(Object.entries(record).filter(([entry]) => entry !== key));
}

export function enterPosition(state: LessonPlayerState, position: number): LessonPlayerState {
  const id = state.queue[position] ?? "";

  return {
    ...state,
    answers: omitKey(state.answers, id),
    checkFailed: false,
    checkIssue: null,
    phase: "playing",
    position,
    results: omitKey(state.results, id),
    reviewing: false,
    stepStartedAt: Date.now(),
  };
}

function complete(
  state: LessonPlayerState,
  status: "ready" | "saving" = "saving",
): LessonPlayerState {
  return {
    ...state,
    completion: { result: null, status, testedOut: state.quickCheck !== null },
    phase: "completed",
  };
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

  return enterPosition(
    {
      ...state,
      notice: null,
      queue: [...rest, ...missed],
      quickCheck: null,
      retried: [...new Set([...state.retried, ...missed])],
    },
    quickCheck.returnPosition,
  );
}

export function advance(state: LessonPlayerState): LessonPlayerState {
  if (state.quickCheck?.missed) {
    return leaveQuickCheck(state);
  }

  const queue = state.queue.filter(
    (id, index) => index <= state.position || !state.unavailableStepIds.includes(id),
  );

  const available = queue.length === state.queue.length ? state : { ...state, queue };
  const next = state.position + 1;

  if (next >= queue.length) {
    return complete(available);
  }

  return enterPosition({ ...available, notice: null }, next);
}

export function leaveOutAhead(
  state: LessonPlayerState,
  isLeftOut: (stepId: string) => boolean,
  completionStatus: "ready" | "saving",
): LessonPlayerState {
  if (state.phase === "completed") {
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
    ? complete(next, completionStatus)
    : enterPosition({ ...next, notice: null }, state.position);
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
  const previousId = state.queue[state.position - 1];

  if (!canGoBack(state) || !previousId) {
    return state;
  }

  const current = state.queue[state.position] ?? "";
  const reviewing = previousId in state.results;

  return {
    ...state,
    answers: omitKey(state.answers, current),
    checkFailed: false,
    checkIssue: null,
    notice: null,
    phase: reviewing ? "feedback" : "playing",
    position: state.position - 1,
    reviewing,
    stepStartedAt: Date.now(),
  };
}

export function canGoBack(state: LessonPlayerState): boolean {
  return (
    state.phase === "playing" &&
    state.position > 0 &&
    !state.quickCheck &&
    state.run.status !== "refused"
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
    notice: state.notice === "selfCorrect" ? null : state.notice,
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
    answers: omitKey(state.answers, step.id),
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
      notice: null,
      queue,
      quickCheck: { missed: false, returnPosition: state.position, returnQueue: state.queue },
    },
    0,
  );
}

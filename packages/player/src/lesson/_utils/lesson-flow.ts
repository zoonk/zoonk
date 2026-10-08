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

/**
 * Shows the screen at `position`. A question coming back (after a miss, or after a missed quick
 * check) starts fresh: its old answer and verdict are cleared, while its first verdict still
 * counts.
 */
function enterPosition(state: LessonPlayerState, position: number): LessonPlayerState {
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

function complete(state: LessonPlayerState): LessonPlayerState {
  return {
    ...state,
    completion: { result: null, status: "saving", testedOut: state.quickCheck !== null },
    phase: "completed",
  };
}

/**
 * A missed quick check returns to where the learner was, without the checks they just got right,
 * which already count. The missed one comes back at the end of the lesson, like any missed check.
 */
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

/** Moves past the current screen: to the next one, back to the lesson, or to the end. */
export function advance(state: LessonPlayerState): LessonPlayerState {
  if (state.quickCheck?.missed) {
    return leaveQuickCheck(state);
  }

  const next = state.position + 1;

  if (next >= state.queue.length) {
    return complete(state);
  }

  return enterPosition({ ...state, notice: null }, next);
}

/**
 * Leaves out the screens of kinds the learner just skipped ("Skip writing"): the rest of the
 * lesson goes on from where they are, and a lesson with nothing left ends.
 */
export function skipStepKinds(
  state: LessonPlayerState,
  kinds: readonly PlayableLibraryStep["kind"][],
): LessonPlayerState {
  if (state.phase !== "playing") {
    return state;
  }

  const ahead = state.queue.slice(state.position).filter((id) => {
    const kind = state.steps[id]?.kind;
    return !kind || !kinds.includes(kind);
  });

  const next = { ...state, queue: [...state.queue.slice(0, state.position), ...ahead] };

  return state.position >= next.queue.length
    ? complete(next)
    : enterPosition({ ...next, notice: null }, state.position);
}

/** Continue on a reading screen reveals a worked example one step at a time, then moves on. */
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

/**
 * Continue in a challenge starts the case from its intro, then confirms the pick for the decision
 * on screen, which shows the replies and the next decision. The finished case is checked instead.
 */
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

/**
 * Previous goes back one screen from any screen after the first. A screen already answered shows
 * its result again (Continue goes on); one not answered yet plays as it was.
 */
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

/** Previous is on every screen after the first, while it's being played (not during "I know this"). */
export function canGoBack(state: LessonPlayerState): boolean {
  return (
    state.phase === "playing" &&
    state.position > 0 &&
    !state.quickCheck &&
    state.run.status !== "refused"
  );
}

/**
 * A wrong language answer the learner built stays on screen, without the right form, for one
 * more try. The first verdict still counts; outside language practice the answer shows at once.
 */
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

/** Counted answers missed in a row; a right one starts over. */
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

/**
 * Records a verdict. The first one on a screen is what counts. A missed check or activity comes
 * back once at the end of the lesson; during a quick check, a miss ends the quick check instead.
 * A missed language answer gets one chance to self-correct first.
 */
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
    isMiss && !state.quickCheck && step && isRetryStep(step) && !state.retried.includes(stepId);

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

  /** Matching pairs gives feedback pair by pair, so its check moves on without a second tap. */
  return step?.kind === "matchColumns" ? advance(resolved) : resolved;
}

/**
 * "Explain first" on a question that comes before its explanation: the explanation screens move
 * in front of it, and the answer counts as helped.
 */
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

/** "I know this": ask the checks not yet answered right; passing them all ends the lesson. */
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

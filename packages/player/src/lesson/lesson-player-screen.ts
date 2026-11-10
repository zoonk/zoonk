import { type TaskSegment } from "@zoonk/learn/task-header";
import { getChallengeProgress } from "./_utils/challenge-progress";
import { isAtEnd } from "./_utils/lesson-end";
import { canGoBack, continueStopsAt } from "./_utils/lesson-flow";
import { getHyperdriveStreak } from "./_utils/lesson-hyperdrive";
import {
  getExplanationsAfter,
  getQuickCheckQueue,
  isQuestionStep,
  isReadStep,
} from "./_utils/lesson-steps";
import { type ExplainingStep, getStruggleOffer } from "./_utils/lesson-struggle";
import { type LessonPlayerState, getCurrentStep } from "./lesson-player-state";
import { type LessonPlayerAnswer, type PlayableLibraryStep } from "./lesson-player-types";

export type LessonPrimaryLabel =
  | "check"
  | "confirm"
  | "continue"
  | "dontKnowYet"
  | "next"
  | "nextStep"
  | "seeAnswer"
  | "seeHowItWent"
  | "start";

/** `reveal`: an opening guess with nothing picked shows its answer, counting for nothing. */
type LessonPrimaryAction = {
  action: "check" | "continue" | "reveal";
  busy: boolean;
  disabled: boolean;
  label: LessonPrimaryLabel;
};

export type LessonScreen = {
  canExplainFirst: boolean;
  canGoBack: boolean;
  canGoForward: boolean;
  canKnowThis: boolean;
  hyperdriveStreak: number | null;
  primary: LessonPrimaryAction | null;
  progress: { current: number; total: number };
  segments: TaskSegment[];
  quickCheck: { current: number; total: number } | null;
  step: PlayableLibraryStep | null;
  struggleOffer: ExplainingStep | null;
  unsentAnswer: boolean;
};

function hasText(text: string): boolean {
  return text.trim().length > 0;
}

function isAnswerReady(answer: LessonPlayerAnswer | undefined): boolean {
  if (!answer) {
    return false;
  }

  if (answer.kind === "typedAnswer" || answer.kind === "spokenAnswer") {
    return hasText(answer.text);
  }

  return true;
}

function hasUnsentAnswer(state: LessonPlayerState, step: PlayableLibraryStep | null): boolean {
  const awaitingCheck = state.phase === "playing" || state.phase === "checking";
  const answer = step && awaitingCheck ? state.answers[step.id] : undefined;

  return (
    (answer?.kind === "typedAnswer" || answer?.kind === "spokenAnswer") && hasText(answer.text)
  );
}

function getReadLabel(state: LessonPlayerState, step: PlayableLibraryStep): LessonPrimaryLabel {
  if (step.kind === "workedExample" && (state.revealed[step.id] ?? 1) < step.content.steps.length) {
    return "nextStep";
  }

  return state.position === state.queue.length - 1 ? "continue" : "next";
}

function getChallengeAction(
  state: LessonPlayerState,
  step: Extract<PlayableLibraryStep, { kind: "challenge" }>,
): LessonPrimaryAction {
  const progress = getChallengeProgress({
    answer: state.answers[step.id],
    shown: state.revealed[step.id] ?? 0,
    step,
  });

  if (progress.stage === "intro") {
    return { action: "continue", busy: false, disabled: false, label: "start" };
  }

  if (progress.stage === "ended") {
    return { action: "check", busy: false, disabled: false, label: "seeHowItWent" };
  }

  return { action: "continue", busy: false, disabled: !progress.pendingChoiceId, label: "confirm" };
}

function getAnswerAction(state: LessonPlayerState, step: PlayableLibraryStep): LessonPrimaryAction {
  if (isReadStep(step)) {
    return { action: "continue", busy: false, disabled: false, label: getReadLabel(state, step) };
  }

  if (step.kind === "challenge") {
    return getChallengeAction(state, step);
  }

  if (step.kind === "hook") {
    return state.answers[step.id]
      ? { action: "check", busy: false, disabled: false, label: "seeAnswer" }
      : { action: "reveal", busy: false, disabled: false, label: "dontKnowYet" };
  }

  return {
    action: "check",
    busy: false,
    disabled: !isAnswerReady(state.answers[step.id]),
    label: "check",
  };
}

function getPrimaryAction(
  state: LessonPlayerState,
  step: PlayableLibraryStep,
): LessonPrimaryAction | null {
  if (state.phase === "completed" || state.run.status === "refused") {
    return null;
  }

  if (state.phase === "feedback") {
    return { action: "continue", busy: false, disabled: false, label: "continue" };
  }

  const action = getAnswerAction(state, step);
  return state.phase === "checking" ? { ...action, busy: true, disabled: true } : action;
}

function canTurnForward(state: LessonPlayerState, step: PlayableLibraryStep | null): boolean {
  if (!step || state.run.status === "refused") {
    return false;
  }

  return state.phase === "feedback" || (state.phase === "playing" && isReadStep(step));
}

/** A retry or a quick check starts its screen over, so only a first copy keeps the run's answer. */
function hasRunAnswer(state: LessonPlayerState, index: number): boolean {
  const stepId = state.queue[index] ?? "";

  return (
    !state.quickCheck &&
    state.queue.indexOf(stepId) === index &&
    (stepId in state.results || stepId in state.firstVerdicts)
  );
}

function isDone(state: LessonPlayerState, index: number): boolean {
  if (index < state.position || isAtEnd(state)) {
    return true;
  }

  if (index === state.position) {
    return state.phase === "feedback";
  }

  return hasRunAnswer(state, index) || !continueStopsAt(state, index);
}

function getDoneSegment(state: LessonPlayerState, index: number): TaskSegment {
  const stepId = state.queue[index] ?? "";

  const verdict =
    state.queue.indexOf(stepId) === index
      ? state.firstVerdicts[stepId]
      : state.results[stepId]?.isCorrect;

  if (verdict === undefined) {
    return "read";
  }

  return verdict ? "right" : "wrong";
}

function endsOnMap(state: LessonPlayerState): boolean {
  return state.hasMap && !state.quickCheck && !state.completion?.testedOut;
}

function getMapSegment(state: LessonPlayerState): TaskSegment {
  if (state.phase === "map") {
    return "current";
  }

  return state.phase === "completed" ? "read" : "ahead";
}

function getSegments(state: LessonPlayerState): TaskSegment[] {
  const screens = state.queue.map((_, index): TaskSegment => {
    if (isDone(state, index)) {
      return getDoneSegment(state, index);
    }

    return index === state.position ? "current" : "ahead";
  });

  return endsOnMap(state) ? [...screens, getMapSegment(state)] : screens;
}

const MAP_PRIMARY: LessonPrimaryAction = {
  action: "continue",
  busy: false,
  disabled: false,
  label: "continue",
};

function getProgress(segments: TaskSegment[]): LessonScreen["progress"] {
  const done = segments.filter((segment) => segment !== "ahead" && segment !== "current");
  return { current: done.length, total: segments.length };
}

function getScreenActions(
  state: LessonPlayerState,
  step: PlayableLibraryStep | null,
): Pick<LessonScreen, "canGoBack" | "canGoForward" | "primary"> {
  if (state.phase === "map" && state.run.status !== "refused") {
    return { canGoBack: canGoBack(state), canGoForward: true, primary: MAP_PRIMARY };
  }

  return {
    canGoBack: step ? canGoBack(state) : false,
    canGoForward: canTurnForward(state, step),
    primary: step && getPrimaryAction(state, step),
  };
}

export function getLessonScreen(state: LessonPlayerState): LessonScreen {
  const step = isAtEnd(state) ? null : getCurrentStep(state);
  const isPlaying = state.phase === "playing" && state.run.status !== "refused";
  const segments = getSegments(state);

  return {
    canExplainFirst:
      isPlaying &&
      Boolean(step && isQuestionStep(step)) &&
      !state.answers[step?.id ?? ""] &&
      getExplanationsAfter(state).length > 0,
    ...getScreenActions(state, step),
    canKnowThis:
      isPlaying &&
      !state.quickCheck &&
      step?.kind === "explanation" &&
      getQuickCheckQueue(state).length > 0,
    hyperdriveStreak:
      state.phase === "feedback" && step ? getHyperdriveStreak({ state, stepId: step.id }) : null,
    progress: getProgress(segments),
    quickCheck: state.quickCheck ? { current: state.position, total: state.queue.length } : null,
    segments,
    step,
    struggleOffer: getStruggleOffer(state),
    unsentAnswer: hasUnsentAnswer(state, step),
  };
}

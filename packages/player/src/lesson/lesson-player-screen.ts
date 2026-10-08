import { getChallengeProgress } from "./_utils/challenge-progress";
import { canGoBack } from "./_utils/lesson-flow";
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
  | "checking"
  | "confirm"
  | "continue"
  | "next"
  | "nextStep"
  | "seeAnswer"
  | "seeHowItWent"
  | "start";

type LessonPrimaryAction = {
  action: "check" | "continue";
  /** A grade is on its way, so the button waits instead of acting. */
  busy: boolean;
  disabled: boolean;
  label: LessonPrimaryLabel;
};

/**
 * What the learner can do on the screen in view. The shell, the header and the keyboard read this
 * one model, so the visible button and Enter always do the same thing.
 */
export type LessonScreen = {
  canExplainFirst: boolean;
  canGoBack: boolean;
  /**
   * The screen moves on with the arrow key or a swipe, the way its main action does: a reading
   * screen, and a question once its result shows. A question waiting for its answer moves on only
   * through its main action, so a stray swipe never skips or checks one.
   */
  canGoForward: boolean;
  canKnowThis: boolean;
  /** Right answers in a row the result on screen made (Hyperdrive), from three on. */
  hyperdriveStreak: number | null;
  primary: LessonPrimaryAction | null;
  progress: { current: number; total: number };
  /** Position within "I know this", when it's running. */
  quickCheck: { current: number; total: number } | null;
  step: PlayableLibraryStep | null;
  /**
   * The explanation of an idea missed twice in a row, so help can come at the moment the learner
   * struggles.
   */
  struggleOffer: ExplainingStep | null;
};

function hasText(text: string): boolean {
  return text.trim().length > 0;
}

/** Whether the answer on screen is complete enough to check. */
function isAnswerReady(answer: LessonPlayerAnswer | undefined): boolean {
  if (!answer) {
    return false;
  }

  if (answer.kind === "typedAnswer" || answer.kind === "spokenAnswer") {
    return hasText(answer.text);
  }

  return true;
}

function getReadLabel(state: LessonPlayerState, step: PlayableLibraryStep): LessonPrimaryLabel {
  if (step.kind === "workedExample" && (state.revealed[step.id] ?? 1) < step.content.steps.length) {
    return "nextStep";
  }

  return state.position === state.queue.length - 1 ? "continue" : "next";
}

/** A challenge starts from its intro, confirms one decision at a time, then checks the path. */
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

  if (state.phase === "checking") {
    return { action: "check", busy: true, disabled: true, label: "checking" };
  }

  if (isReadStep(step)) {
    return { action: "continue", busy: false, disabled: false, label: getReadLabel(state, step) };
  }

  if (step.kind === "challenge") {
    return getChallengeAction(state, step);
  }

  return {
    action: "check",
    busy: false,
    disabled: !isAnswerReady(state.answers[step.id]),
    label: step.kind === "hook" ? "seeAnswer" : "check",
  };
}

/** A reading screen, or a question showing its result, turns forward as its button would. */
function canTurnForward(state: LessonPlayerState, step: PlayableLibraryStep | null): boolean {
  if (!step || state.run.status === "refused") {
    return false;
  }

  return state.phase === "feedback" || (state.phase === "playing" && isReadStep(step));
}

/** Derives the screen from the reducer state. */
export function getLessonScreen(state: LessonPlayerState): LessonScreen {
  const step = state.phase === "completed" ? null : getCurrentStep(state);
  const isPlaying = state.phase === "playing" && state.run.status !== "refused";

  return {
    canExplainFirst:
      isPlaying &&
      Boolean(step && isQuestionStep(step)) &&
      !state.answers[step?.id ?? ""] &&
      getExplanationsAfter(state).length > 0,
    canGoBack: step ? canGoBack(state) : false,
    canGoForward: canTurnForward(state, step),
    canKnowThis:
      isPlaying &&
      !state.quickCheck &&
      step?.kind === "explanation" &&
      getQuickCheckQueue(state).length > 0,
    hyperdriveStreak:
      state.phase === "feedback" && step ? getHyperdriveStreak({ state, stepId: step.id }) : null,
    primary: step ? getPrimaryAction(state, step) : null,
    progress: {
      current: state.phase === "completed" ? state.queue.length : state.position,
      total: state.queue.length,
    },
    quickCheck: state.quickCheck ? { current: state.position, total: state.queue.length } : null,
    step,
    struggleOffer: getStruggleOffer(state),
  };
}

import { type AnswerResult } from "@zoonk/core/player/contracts/check-answer";
import { getCappedLessonDurationSeconds } from "@zoonk/core/player/contracts/completion-duration";
import { type SerializedStep } from "@zoonk/core/player/contracts/prepare-lesson-data";
import { type LessonKind } from "@zoonk/core/steps/contract/content";
import { type PlayerCompletionMilestoneKey } from "./completion-milestone-keys";
import {
  type PlayerCompletionResult,
  type PlayerProgressSnapshot,
  getCompletionMilestones,
  getInitialCompletionMilestoneIndex,
} from "./completion-milestones";
import { computeLocalCompletion } from "./player-completion";
import { getLocalDate } from "./player-date";
import { buildInitialAnswers } from "./player-initial-state";
import { describePlayerStep } from "./player-step";
import { getPlayerStepBehavior } from "./player-step-behavior";
import { canNavigatePrev } from "./step-navigation";

export type PlayerPhase = "startWarning" | "playing" | "feedback" | "completed";

export type SelectedAnswer =
  | { kind: "fillBlank"; userAnswers: string[] }
  | { kind: "listening"; arrangedWords: string[] }
  | { kind: "matchColumns"; userPairs: { left: string; right: string }[]; mistakes: number }
  | { kind: "multipleChoice"; selectedOptionId: string }
  | { kind: "reading"; arrangedWords: string[] }
  | { kind: "selectImage"; selectedOptionId: string }
  | { kind: "sortOrder"; userOrder: string[] }
  | { kind: "translation"; selectedOptionId: string };

export type StepResult = { stepId: string; answer?: SelectedAnswer; result: AnswerResult };

type StepTiming = {
  answeredAt: number;
  dayOfWeek: number;
  durationSeconds: number;
  hourOfDay: number;
};

export type PlayerState = {
  completionMilestoneIndex: number | null;
  lessonId: string;
  lessonKind: LessonKind;
  completion: PlayerCompletionResult | null;
  currentStepIndex: number;
  localDate: string;
  phase: PlayerPhase;
  progressSnapshot: PlayerProgressSnapshot | null;
  results: Record<string, StepResult>;
  selectedAnswers: Record<string, SelectedAnswer>;
  startedAt: number;
  stepStartedAt: number;
  steps: SerializedStep[];
  stepTimings: Record<string, StepTiming>;
  shownCompletionMilestoneKeys: PlayerCompletionMilestoneKey[];
  totalBrainPower: number;
};

export type PlayerAction =
  | { type: "START" }
  | { type: "SELECT_ANSWER"; stepId: string; answer: SelectedAnswer }
  | { type: "CLEAR_ANSWER"; stepId: string }
  | { type: "CHECK_ANSWER"; stepId: string; result: AnswerResult }
  | { type: "CONTINUE" }
  | { type: "COMPLETE" }
  | { type: "NAVIGATE_STEP"; direction: "next" | "prev" }
  | { type: "RESTART" };

export { createInitialState } from "./player-initial-state";

function handleSelectAnswer(
  state: PlayerState,
  action: Extract<PlayerAction, { type: "SELECT_ANSWER" }>,
): PlayerState {
  if (state.phase === "startWarning") {
    return state;
  }

  return {
    ...state,
    selectedAnswers: { ...state.selectedAnswers, [action.stepId]: action.answer },
  };
}

function handleClearAnswer(
  state: PlayerState,
  action: Extract<PlayerAction, { type: "CLEAR_ANSWER" }>,
): PlayerState {
  if (state.phase === "startWarning") {
    return state;
  }

  const { [action.stepId]: _, ...rest } = state.selectedAnswers;
  return { ...state, selectedAnswers: rest };
}

/**
 * Moves a pre-lesson warning into active play and starts the lesson timers at
 * that moment. Signed-out learners can spend time deciding whether to log in,
 * and that hesitation should not inflate answer duration or lesson duration.
 */
function handleStart(state: PlayerState): PlayerState {
  if (state.phase !== "startWarning") {
    return state;
  }

  const now = Date.now();

  return { ...state, phase: "playing", startedAt: now, stepStartedAt: now };
}

function recordStepTiming(state: PlayerState, stepId: string): Record<string, StepTiming> {
  const now = Date.now();
  const answeredDate = new Date(now);

  return {
    ...state.stepTimings,
    [stepId]: {
      answeredAt: now,
      dayOfWeek: answeredDate.getDay(),
      durationSeconds: Math.max(0, Math.round((now - state.stepStartedAt) / 1000)),
      hourOfDay: answeredDate.getHours(),
    },
  };
}

/**
 * Only answer-producing completions should count as interactive progress.
 * Static lessons can complete without checked answers, and score-based nudges
 * would feel wrong there because no weekday score changed.
 */
function hasCompletedInteractiveLesson(state: Pick<PlayerState, "results">) {
  return Object.keys(state.results).length > 0;
}

/**
 * The milestone preview uses the same lesson-duration cap as persistence. The
 * value is attached to the completion result so later milestone screens do not
 * change if the learner pauses before pressing Continue.
 */
function getCompletionWithDuration(state: PlayerState): PlayerCompletionResult {
  return {
    ...computeLocalCompletion(state),
    completedInteractiveLesson: hasCompletedInteractiveLesson(state),
    lessonDurationSeconds: getCappedLessonDurationSeconds({ startedAt: state.startedAt }),
  };
}

function handleCheckAnswer(
  state: PlayerState,
  action: Extract<PlayerAction, { type: "CHECK_ANSWER" }>,
): PlayerState {
  if (state.phase !== "playing") {
    return state;
  }

  const currentStep = state.steps[state.currentStepIndex];

  const stepResult: StepResult = {
    answer: state.selectedAnswers[action.stepId],
    result: action.result,
    stepId: action.stepId,
  };

  const checked: PlayerState = {
    ...state,
    phase: "feedback",
    results: { ...state.results, [action.stepId]: stepResult },
    stepTimings: recordStepTiming(state, action.stepId),
  };

  // matchColumns validates each pair during interaction, so feedback is redundant.
  if (currentStep?.kind === "matchColumns") {
    return handleContinue(checked);
  }

  return checked;
}

function completeWith(state: PlayerState): PlayerState {
  const localDate = getLocalDate(new Date());
  const completed: PlayerState = { ...state, localDate, phase: "completed" };
  const completion = getCompletionWithDuration(completed);

  return {
    ...completed,
    completion,
    completionMilestoneIndex: getInitialCompletionMilestoneIndex({
      completion,
      lessonDurationSeconds: completion.lessonDurationSeconds,
      localDate,
      previousTotalBrainPower: state.totalBrainPower,
      progressSnapshot: state.progressSnapshot,
      shownMilestoneKeys: state.shownCompletionMilestoneKeys,
    }),
  };
}

/**
 * Advances through completion milestone screens before exposing the normal
 * completion summary. The reducer owns this instead of component state so
 * Enter, visible buttons, and restart all observe the same completed state.
 */
function continueCompletionMilestone(state: PlayerState): PlayerState {
  if (state.phase !== "completed" || state.completionMilestoneIndex === null || !state.completion) {
    return state;
  }

  const nextIndex = state.completionMilestoneIndex + 1;

  const milestones = getCompletionMilestones({
    completion: state.completion,
    lessonDurationSeconds: state.completion.lessonDurationSeconds,
    localDate: state.localDate,
    previousTotalBrainPower: state.totalBrainPower,
    progressSnapshot: state.progressSnapshot,
    shownMilestoneKeys: state.shownCompletionMilestoneKeys,
  });

  if (nextIndex >= milestones.length) {
    return { ...state, completionMilestoneIndex: null };
  }

  return { ...state, completionMilestoneIndex: nextIndex };
}

function handleContinue(state: PlayerState): PlayerState {
  if (state.phase === "completed") {
    return continueCompletionMilestone(state);
  }

  if (state.phase !== "feedback") {
    return state;
  }

  const nextIndex = state.currentStepIndex + 1;
  const isLast = nextIndex >= state.steps.length;

  if (isLast) {
    return completeWith(state);
  }

  return { ...state, currentStepIndex: nextIndex, phase: "playing", stepStartedAt: Date.now() };
}

/**
 * Moves the player to the next step, or completes the lesson if there
 * are no more steps.
 */
function advanceForward(state: PlayerState): PlayerState {
  const nextIndex = state.currentStepIndex + 1;

  if (nextIndex >= state.steps.length) {
    return completeWith(state);
  }

  return { ...state, currentStepIndex: nextIndex, stepStartedAt: Date.now() };
}

function handleNavigateStep(
  state: PlayerState,
  action: Extract<PlayerAction, { type: "NAVIGATE_STEP" }>,
): PlayerState {
  if (state.phase !== "playing") {
    return state;
  }

  const currentStep = state.steps[state.currentStepIndex];
  const currentBehavior = getPlayerStepBehavior(describePlayerStep(currentStep));

  if (currentBehavior?.layout !== "navigable") {
    return state;
  }

  if (action.direction === "prev") {
    if (!canNavigatePrev({ currentStepIndex: state.currentStepIndex, steps: state.steps })) {
      return state;
    }

    const prevIndex = state.currentStepIndex - 1;

    return { ...state, currentStepIndex: prevIndex, stepStartedAt: Date.now() };
  }

  return advanceForward(state);
}

function handleRestart(state: PlayerState): PlayerState {
  const now = Date.now();

  return {
    ...state,
    completion: null,
    completionMilestoneIndex: null,
    currentStepIndex: 0,
    localDate: getLocalDate(new Date()),
    phase: "playing",
    progressSnapshot: state.progressSnapshot,
    results: {},
    selectedAnswers: buildInitialAnswers(state.steps),
    startedAt: now,
    stepStartedAt: now,
    stepTimings: {},
  };
}

function handleComplete(state: PlayerState): PlayerState {
  if (state.phase === "completed") {
    return state;
  }

  return completeWith(state);
}

export function playerReducer(state: PlayerState, action: PlayerAction): PlayerState {
  switch (action.type) {
    case "START":
      return handleStart(state);

    case "SELECT_ANSWER":
      return handleSelectAnswer(state, action);

    case "CLEAR_ANSWER":
      return handleClearAnswer(state, action);

    case "CHECK_ANSWER":
      return handleCheckAnswer(state, action);

    case "CONTINUE":
      return handleContinue(state);

    case "NAVIGATE_STEP":
      return handleNavigateStep(state, action);

    case "COMPLETE":
      return handleComplete(state);

    case "RESTART":
      return handleRestart(state);

    default:
      return state;
  }
}
